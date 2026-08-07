-- ============================================================================
-- Take EXECUTE on public functions away from the browser, then hand it back
-- only where something actually needs it.
--
-- WHY
--   PostgREST publishes every function in `public` at POST /rest/v1/rpc/<name>,
--   and the anon key is in the browser bundle. A SECURITY DEFINER function with a
--   blanket grant is therefore an unauthenticated HTTP endpoint that runs as its
--   owner with RLS switched off.
--
--   This was not theoretical. Called with the ANON key,
--   `seed_family_system_groups('ZZTOP9')` wrote 3 user_groups + 155
--   group_permissions + 17 resource_visibility rows for a family code that has
--   never existed — `user_groups.family_code` has no foreign key, so every fresh
--   random string writes another 175 rows. Worse, because its inserts are
--   ON CONFLICT DO NOTHING (idempotent against re-insertion, and no defence at all
--   against a deliberate DELETE), an anonymous call RESTORED an
--   Administrators / admin/groups / delete = 'any' grant that an administrator had
--   removed in Groups & Permissions.
--
--   Its migration had `REVOKE ALL … FROM PUBLIC` and granted it to nobody. That is
--   how little a REVOKE is worth here.
--
-- THREE THINGS THAT MAKE THE OBVIOUS VERSION A NO-OP. All three are handled.
--   1. Thirteen of these functions still carry the built-in `=X/postgres` PUBLIC
--      grant that no migration ever removed. `REVOKE … FROM anon, authenticated`
--      leaves PUBLIC alone and changes nothing. Every revoke below names PUBLIC
--      FIRST.
--   2. Future functions are re-opened by `pg_default_acl`. A schema-scoped
--      ALTER DEFAULT PRIVILEGES cannot remove PUBLIC's built-in EXECUTE — only the
--      schema-LESS (global) form can. Both are issued.
--   3. supabase/seed.sql re-granted everything after every local `db reset`. It is
--      edited in the same change; without that, this file is documentation.
--
-- WHAT NEEDS NO GRANT, AND WAS PROVEN NOT TO
--   * Trigger functions. EXECUTE is checked at CREATE TRIGGER time, not at fire
--     time — an authenticated UPDATE on `people` still fired all four of its
--     triggers with their EXECUTE revoked.
--   * Anything called only from inside another SECURITY DEFINER function, which
--     runs as that function's owner. `create_family()` still produced a family with
--     3 groups, 155 permissions, 17 visibility rows and 2 memberships as a plain
--     `authenticated` caller, with `gen_family_code()` and
--     `seed_family_system_groups()` both revoked from it.
--   * anon, for everything but one function. Not a single policy in `public` is
--     `TO anon` or `TO public`, so an anonymous request never evaluates a policy
--     and never reaches a helper: with all the auth_* helpers revoked, anon SELECTs
--     on people, notifications and chat_messages returned 0 rows and no error.
--
-- MUST BE ONE TRANSACTION. Between the revoke and the re-grant, auth_family_code()
-- is unreachable and every authenticated request fails. `supabase db push` wraps a
-- migration file in a transaction; running this by hand in the SQL editor means
-- wrapping it in BEGIN … COMMIT yourself.
--
-- IDEMPOTENT. Re-running produces the same ACLs and passes the same assertions.
-- ============================================================================

BEGIN;

-- ── 1. Sweep. PUBLIC first, or the next two lines are decoration ────────────
REVOKE EXECUTE ON ALL FUNCTIONS IN SCHEMA public FROM PUBLIC;
REVOKE EXECUTE ON ALL FUNCTIONS IN SCHEMA public FROM anon;
REVOKE EXECUTE ON ALL FUNCTIONS IN SCHEMA public FROM authenticated;

-- ── 2. service_role keeps everything ────────────────────────────────────────
-- It is the admin client's role, it already bypasses RLS, and the server-side
-- paths depend on it. Nothing is gained by narrowing it here.
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO service_role;

-- ── 3. authenticated: functions the APP calls through the user client ───────
GRANT EXECUTE ON FUNCTION public.create_family(text)                           TO authenticated;
GRANT EXECUTE ON FUNCTION public.join_family_by_code(text)                     TO authenticated;
GRANT EXECUTE ON FUNCTION public.validate_family_code(text)                    TO authenticated;
GRANT EXECUTE ON FUNCTION public.set_membership_status(uuid, text, text)       TO authenticated;
GRANT EXECUTE ON FUNCTION public.create_family_invitation(text, boolean, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.peek_family_invitation(text)                  TO authenticated;
GRANT EXECUTE ON FUNCTION public.redeem_family_invitation(text, uuid)          TO authenticated;
GRANT EXECUTE ON FUNCTION public.revoke_family_invitation(uuid)                TO authenticated;
-- Invoked DYNAMICALLY — `supabase.rpc(fn, …)` with a union-typed `fn` in
-- app/actions/family.ts:35. A grep for .rpc('set_active_family' finds nothing, and
-- these two are the only door to user_family_settings, which has no write policy.
GRANT EXECUTE ON FUNCTION public.set_active_family(text)                       TO authenticated;
GRANT EXECUTE ON FUNCTION public.set_default_family(text)                      TO authenticated;
-- SECURITY INVOKER, so it is already RLS-contained and confers nothing a direct
-- UPDATE would not. All three call sites use the admin client, so this grant is
-- almost certainly unnecessary — kept because removing a grant nothing is PROVEN
-- to need is a worse trade than removing one something might, and an invoker
-- function is not an escalation vector. Revisit with a caller check.
GRANT EXECUTE ON FUNCTION public.cancel_overdue_event_assignments()            TO authenticated;

-- ── 4. authenticated: functions RLS POLICIES call ───────────────────────────
-- A policy expression is evaluated as the QUERYING role, so the caller needs
-- EXECUTE even though no application code ever names the function. Proven: with
-- auth_family_code() revoked, `SELECT count(*) FROM public.people` fails for an
-- authenticated caller with "permission denied for function auth_family_code".
--
-- DERIVED FROM THE LIVE POLICIES rather than hard-coded, and that is deliberate.
-- The policies here are COMPOSED at migration time out of pg_policies
-- (20260618000001), and this repo has already had one policy survive outside the
-- migration chain and govern production reads (d9d91c0). A hard-coded list would
-- be correct for the database it was written against and quietly wrong for any
-- other; this grants whatever the database in front of it actually needs.
--
-- Over-granting here is self-limiting: it can only ever name a function some
-- policy already forces the caller to execute.
DO $$
DECLARE r record; n int := 0;
BEGIN
  FOR r IN
    SELECT DISTINCT p.oid::regprocedure AS sig, p.proname
      FROM pg_proc p
     WHERE p.pronamespace = 'public'::regnamespace
       AND EXISTS (
         SELECT 1 FROM pg_policies pol
          WHERE pol.schemaname = 'public'
            -- `name(` and not just `name`, so auth_can does not match auth_can_on
            AND (COALESCE(pol.qual, '') || COALESCE(pol.with_check, ''))
                LIKE '%' || p.proname || '(%'
       )
  LOOP
    EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO authenticated', r.sig);
    n := n + 1;
    RAISE NOTICE 'policy helper: granted EXECUTE on % to authenticated', r.sig;
  END LOOP;

  -- Zero would mean the matcher stopped working, not that the policies stopped
  -- needing helpers — and the app would be dead on arrival.
  IF n = 0 THEN
    RAISE EXCEPTION
      'ROLLBACK: no policy-referenced functions found. Every authenticated query '
      'in the app would fail. The pg_policies matcher is broken.';
  END IF;
END $$;

-- Realtime evaluates RLS as the SUBSCRIBING role (realtime.apply_rls does its own
-- SET ROLE), so a policy helper on a published table is needed by the websocket
-- path too, not only by REST. auth_uid_is_room_participant is the case that makes
-- this concrete: no app call site and only four policies, so it reads as orphaned
-- — but those four gate chat_messages / chat_rooms / chat_participants, and
-- revoking it would kill chat realtime silently. The §4 sweep covers it because it
-- is named in those policies; this note is here so nobody "tidies it up" later.

-- ── 5. anon: exactly one ────────────────────────────────────────────────────
-- /invite/<token> and /register?invite=<token> must be able to name the family
-- before the visitor has an account. The 32-byte token is the credential; showing
-- its holder the family name and the invited address discloses nothing the link
-- did not already carry.
GRANT EXECUTE ON FUNCTION public.peek_family_invitation(text)                  TO anon;

-- ── 6. Functions created by FUTURE migrations ───────────────────────────────
-- Without this, the next CREATE FUNCTION in this schema is anon-executable the
-- moment it exists, and this whole file is a one-off.
--
-- The schema-LESS revoke from PUBLIC is the load-bearing statement and is not
-- interchangeable with the `IN SCHEMA public` form: a schema-scoped default ACL
-- can only add to the built-in default, never remove PUBLIC's EXECUTE from it.
--
-- Issued through format() against current_user because ALTER DEFAULT PRIVILEGES
-- only affects objects created by the role it names, and that role differs
-- between a local reset and a hosted push.
DO $$
DECLARE r text := current_user;
BEGIN
  EXECUTE format(
    'ALTER DEFAULT PRIVILEGES FOR ROLE %I REVOKE EXECUTE ON FUNCTIONS FROM PUBLIC', r);
  EXECUTE format(
    'ALTER DEFAULT PRIVILEGES FOR ROLE %I IN SCHEMA public REVOKE EXECUTE ON FUNCTIONS FROM anon, authenticated', r);
  EXECUTE format(
    'ALTER DEFAULT PRIVILEGES FOR ROLE %I IN SCHEMA public GRANT EXECUTE ON FUNCTIONS TO service_role', r);

  -- CREATE EXTENSION installs functions that expect PUBLIC EXECUTE (pgcrypto's
  -- digest and gen_random_bytes are called from our own functions). The global
  -- revoke above would otherwise apply to them too.
  IF EXISTS (SELECT 1 FROM pg_namespace WHERE nspname = 'extensions') THEN
    EXECUTE format(
      'ALTER DEFAULT PRIVILEGES FOR ROLE %I IN SCHEMA extensions GRANT EXECUTE ON FUNCTIONS TO PUBLIC', r);
  END IF;
END $$;

-- ── 7. Assert the end state ─────────────────────────────────────────────────
-- Runs on hosted too, so a drifted project fails the push rather than landing
-- somewhere between the two states. The "STILL HAS" halves are the ones that earn
-- their keep: they catch a function added by a later migration that nobody
-- re-audited, which is precisely how this hole appeared in the first place.
DO $$
DECLARE
  app_sigs CONSTANT text[] := ARRAY[
    'public.create_family(text)',
    'public.join_family_by_code(text)',
    'public.validate_family_code(text)',
    'public.set_membership_status(uuid, text, text)',
    'public.create_family_invitation(text, boolean, text)',
    'public.peek_family_invitation(text)',
    'public.redeem_family_invitation(text, uuid)',
    'public.revoke_family_invitation(uuid)',
    'public.set_active_family(text)',
    'public.set_default_family(text)',
    'public.cancel_overdue_event_assignments()'
  ];
  expected_authed oid[];
  s   text;
  bad text[] := '{}';
BEGIN
  -- Expected = the explicit app list PLUS whatever the live policies reference.
  SELECT array_agg(oid) INTO expected_authed FROM (
    SELECT x::regprocedure::oid AS oid FROM unnest(app_sigs) AS x
    UNION
    SELECT p.oid FROM pg_proc p
     WHERE p.pronamespace = 'public'::regnamespace
       AND EXISTS (SELECT 1 FROM pg_policies pol
                    WHERE pol.schemaname = 'public'
                      AND (COALESCE(pol.qual,'') || COALESCE(pol.with_check,''))
                          LIKE '%' || p.proname || '(%')
  ) q;

  FOREACH s IN ARRAY app_sigs LOOP
    IF NOT has_function_privilege('authenticated', s::regprocedure, 'EXECUTE') THEN
      bad := bad || ('authenticated LOST ' || s);
    END IF;
  END LOOP;

  IF NOT has_function_privilege('anon', 'public.peek_family_invitation(text)'::regprocedure, 'EXECUTE') THEN
    bad := bad || 'anon LOST public.peek_family_invitation(text)';
  END IF;

  FOR s IN SELECT p.oid::regprocedure::text FROM pg_proc p
            WHERE p.pronamespace = 'public'::regnamespace
              AND has_function_privilege('anon', p.oid, 'EXECUTE')
              AND p.oid <> 'public.peek_family_invitation(text)'::regprocedure::oid
  LOOP bad := bad || ('anon STILL HAS ' || s); END LOOP;

  FOR s IN SELECT p.oid::regprocedure::text FROM pg_proc p
            WHERE p.pronamespace = 'public'::regnamespace
              AND has_function_privilege('authenticated', p.oid, 'EXECUTE')
              AND NOT (p.oid = ANY (expected_authed))
  LOOP bad := bad || ('authenticated STILL HAS ' || s); END LOOP;

  FOR s IN SELECT p.oid::regprocedure::text FROM pg_proc p
            WHERE p.pronamespace = 'public'::regnamespace
              AND NOT has_function_privilege('service_role', p.oid, 'EXECUTE')
  LOOP bad := bad || ('service_role LOST ' || s); END LOOP;

  IF array_length(bad, 1) IS NOT NULL THEN
    RAISE EXCEPTION 'ROLLBACK: function EXECUTE lockdown assertion failed:%',
      E'\n  ' || array_to_string(bad, E'\n  ');
  END IF;

  RAISE NOTICE 'function EXECUTE lockdown: OK';
END $$;

-- PostgREST caches the schema, including which functions it may expose. Its
-- ddl_command_end watch already fires on GRANT/REVOKE; this is belt and braces.
NOTIFY pgrst, 'reload schema';

COMMIT;
