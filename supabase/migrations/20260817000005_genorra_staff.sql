-- ============================================================================
-- GENORRA staff: the accounts that may open the cross-family console.
--
-- ── WHAT THIS IS FOR ────────────────────────────────────────────────────────
-- Everything else in this schema is family-scoped, and deliberately so: RLS is
-- built on `auth_family_code()`, every policy is a predicate over one family's
-- rows, and the service role is the only thing that sees past it. That is the
-- right shape for the product and it leaves one job unserved — the people who
-- RUN GENORRA need to be able to look at every family: to answer a support
-- ticket, to see how many families are on which plan, and (this is the one that
-- forced the table) to RESTORE a family an administrator removed by mistake.
--
-- Removal lives in the member-facing product; restoration deliberately does not.
-- A family that can un-remove itself has not been removed, it has been paused,
-- and the confirmation the product asks for would then be theatre. So the way
-- back is through a console only GENORRA staff can open, and this table is the
-- list of who that is.
--
-- ── WHY A TABLE, AND NOT A CLAIM ON THE ACCOUNT ─────────────────────────────
-- The obvious alternative is a flag on `auth.users`, and both halves of it are
-- worse:
--
--   raw_user_meta_data  is WRITABLE BY ITS OWNER through GoTrue's own
--                       `PUT /auth/v1/user`. This repo already has the scar:
--                       20260602000000 shipped a policy reading `user_metadata`
--                       and it decided production reads until Supabase's advisor
--                       caught it (see AGENTS.md, "How migrations reach the
--                       hosted project"). A self-service staff flag is not a
--                       staff flag.
--   raw_app_meta_data   is not writable by its owner, so it would be sound — but
--                       it is edited through the Auth admin API rather than
--                       through SQL, which means there is nowhere to record who
--                       granted the access, when, or why. Those three facts are
--                       the whole reason a privileged list is auditable.
--
-- A table takes `granted_by`, `granted_at` and `note`, is visible to a plain
-- SELECT by whoever is investigating, and is versioned by nothing — which is the
-- next point.
--
-- ── ROWS ARE INSERTED BY HAND, WITH SQL, DELIBERATELY ───────────────────────
-- There is no UI for this and there must not be one until somebody can say what
-- would stop it being used to grant staff access to a stranger. The population is
-- a handful of employees, changes about never, and every automated path would need
-- its own authorization model — the one thing this table is the foundation OF.
--
-- To grant, from the SQL editor or `supabase db query`:
--
--   INSERT INTO public.genorra_staff (user_id, role, note, granted_by)
--   SELECT u.id, 'support', 'Ticket triage — asked for by CA 2026-08-17',
--          (SELECT id FROM auth.users WHERE email = '<your address>')
--     FROM auth.users u WHERE u.email = '<their address>';
--
-- To revoke, DELETE the row. Nothing caches it: `is_genorra_staff()` is STABLE
-- (per statement), not IMMUTABLE, and the console resolves it on every request.
--
-- ── RLS IS ENABLED AND THERE IS NO POLICY. THAT IS THE PROTECTION ───────────
-- A table with RLS enabled and no policy at all returns NO ROWS to any role that
-- is neither its owner nor BYPASSRLS, and refuses every INSERT, UPDATE and DELETE
-- from them — for every statement, with no expression to get wrong. So `anon` and
-- `authenticated` cannot read this table, cannot count it, and cannot discover
-- whether a given account is on it. That matters beyond the obvious: the list of
-- people who can see every family in the product is exactly the list an attacker
-- would want next.
--
-- It is deliberately NOT "a policy that admits nobody". A policy is an expression,
-- an expression can be rewritten by a later migration that means to widen
-- something adjacent, and `20260806000009` records this schema having a policy
-- resurrected outside the migration chain. No policy is the version that cannot
-- drift.
--
-- `service_role` bypasses RLS (that is what the role is), so the staff console
-- reads this table through the admin client — see 20260817000006's
-- `staff_set_family_status()` for the write side, and AGENTS.md §3 for the
-- obligation that comes with using it.
--
-- No table-level REVOKE is issued, and the reason is worth stating rather than
-- leaving as an omission: `supabase/seed.sql` runs
-- `GRANT ALL ON ALL TABLES IN SCHEMA public TO anon, authenticated` after every
-- local reset, and the hosted project carries the same grants, so a REVOKE here
-- would be undone within seconds of being written and would read in the file as a
-- protection that is not there. AGENTS.md §2b names that exact failure ("passed
-- for ten seconds and was false thereafter"). RLS is the layer that survives
-- seed.sql, so RLS is the layer this relies on — and §5's verify block asserts the
-- structural property rather than a privilege that is about to be re-granted.
--
-- ── IT HAS NO `family_code`, WHICH ONE STANDING AUDIT NOTICES ───────────────
-- `supabase/scripts/audit_global_lookups.sql` §2 reports any table in `public`
-- with no transitive foreign-key path to a `family_code` that is also EMPTY,
-- because that is indistinguishable from a global lookup somebody has purged.
-- `genorra_staff` is unreachable by construction (its only foreign key points into
-- `auth`) and is empty on every fresh database, so it is added to that file's
-- `allowed_empty` list in this same commit, with the reason: it is empty BY
-- DESIGN — nothing seeds it, a laptop has no GENORRA employees on it, and a
-- database where nobody has been granted staff access is correct rather than
-- damaged.
--
-- It is deliberately NOT added to the keep-list in
-- `truncate_entire_database.sql`. Its foreign key is `ON DELETE CASCADE` from
-- `auth.users`, and that script empties `auth.users` — so a staff row goes away
-- with the account it names whether or not the table is truncated, and a
-- keep-list entry would be decoration that reads as a guarantee. It IS added to
-- `reset_families.sql` §11's keep-list, because that script keeps one account and
-- a surviving staff row for that account is legitimate rather than leftover.
--
-- ── THE GRANT DECISION FOR is_genorra_staff() IS: NOTHING ───────────────────
-- Stated here because AGENTS.md §2b says adding a function means adding its grant,
-- and "none" is an answer that has to be written down or it looks like an
-- oversight.
--
--   * No RLS policy in this migration references it, so §2b's second rule (a
--     function named in a policy needs the grant, because a policy is evaluated
--     as the querying role) does not apply. If a policy ever does name it, the
--     grant to `authenticated` has to arrive in the same migration or every
--     authenticated query against that table dies with "permission denied for
--     function".
--   * The app resolves staffness on the SERVER, through the service role, and
--     `service_role` keeps EXECUTE from the default privileges 20260806000015 §6
--     installed. So there is nothing for `authenticated` to call.
--   * And a function `authenticated` may execute appears in PostgREST's OpenAPI
--     document, which any signed-in member can fetch. A console that 404s a
--     non-staff caller rather than telling them they are not staff should not
--     announce itself in the schema either.
--
-- IDEMPOTENT. The table is IF NOT EXISTS, the functions are CREATE OR REPLACE,
-- and the verify block creates no rows that survive it.
--
-- HOW THIS REACHES A DATABASE
--   `supabase db push`, from CI on merge to master — never `psql -f` by hand,
--   which records nothing and can replay this file out of order. See AGENTS.md,
--   "How migrations reach the hosted project".
-- ============================================================================

BEGIN;

-- ── 1. The table ────────────────────────────────────────────────────────────
-- `user_id` is the PRIMARY KEY rather than a surrogate id with a UNIQUE beside
-- it: an account either is staff or is not, and a table that can hold two rows
-- for one person is a table two rows can disagree in.
--
-- ON DELETE CASCADE, not SET NULL. A staff grant belonging to no account is not a
-- record worth keeping — it is a row that would sit in the list forever, matching
-- nobody, and `is_genorra_staff()` compares on this column. Deleting the account
-- is the strongest possible revocation and the table should say so.
CREATE TABLE IF NOT EXISTS public.genorra_staff (
  user_id    UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  -- Carried now, consumed by nothing yet. The console's first pass is read-only
  -- over families and accounts, so every staff member needs the same access and
  -- a check on this column would be a control nothing reads — the thing
  -- 20260808000000 spent a section removing. It is here because the ALTER that
  -- adds it later is a second migration and a backfill, and because a CHECK is
  -- how the vocabulary gets agreed once rather than per call site.
  --
  --   support   answer a ticket: look, do not touch
  --   engineer  the same, plus the operations a console offers (restore a family)
  --   owner     the above, plus granting staff access — which today is SQL
  role       TEXT NOT NULL DEFAULT 'support'
             CHECK (role IN ('support', 'engineer', 'owner')),
  -- WHY this person has it, in words, for whoever reads the list in a year. The
  -- table is an audit record and a bare uuid is not one.
  note       TEXT,
  -- An `auth.users` id, and deliberately NOT a foreign key. ON DELETE SET NULL
  -- would erase the record of who granted the access the moment that person left,
  -- and ON DELETE CASCADE would delete the GRANT because the granter went — both
  -- destroy the trail this column exists to be. A dangling uuid that no longer
  -- resolves is the honest outcome, and it still narrows an investigation.
  granted_by UUID,
  granted_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- See the header: RLS with no policy denies every row and every write to `anon`
-- and `authenticated`, which is the entire access model for this table.
ALTER TABLE public.genorra_staff ENABLE ROW LEVEL SECURITY;

COMMENT ON TABLE public.genorra_staff IS
  'The GENORRA employees who may open the staff console at /staff. ROWS ARE INSERTED BY '
  'HAND WITH SQL, deliberately — there is no UI to grant staff access and there must not '
  'be one until something can say what would stop it granting access to a stranger. RLS '
  'is enabled with NO POLICY, so anon and authenticated can neither read the list nor '
  'discover whether an account is on it; service_role bypasses RLS, which is how the '
  'console reads it. Ask through public.is_genorra_staff(). Added 20260817000005.';

COMMENT ON COLUMN public.genorra_staff.role IS
  'support | engineer | owner. Recorded now and consulted by nothing yet — the first '
  'console pass gives every staff member the same access. The CHECK is what keeps the '
  'vocabulary agreed in one place when something does start reading it.';

COMMENT ON COLUMN public.genorra_staff.granted_by IS
  'The auth.users id that granted this, and NOT a foreign key: ON DELETE SET NULL would '
  'erase who granted it and ON DELETE CASCADE would delete the grant itself, and this '
  'column exists to survive both of those people leaving.';

COMMENT ON COLUMN public.genorra_staff.note IS
  'Why this account has staff access, in words. The table is an audit record and a bare '
  'uuid is not one.';

-- ── 2. The predicate, for a named account ───────────────────────────────────
-- The uuid form is the DEFINITION and the no-argument form below delegates to it,
-- so there is exactly one answer to "is this account staff" in the schema. Two
-- copies of that expression is how they come to disagree, which is the same
-- argument AGENTS.md makes about `is_minor` and about the two "text on navy"
-- tokens.
--
-- TAKING AN IDENTITY AS A PARAMETER IS THE THING §2b WARNS ABOUT, so the two
-- reasons it is safe here are worth stating rather than assuming:
--
--   1. It ANSWERS, it does not ACT. The return value is one boolean about an id
--      the caller already has. Nothing is read on the caller's behalf and nothing
--      is written, so there is no authority to borrow by naming somebody else.
--   2. It is executable by nothing but `service_role` (see the grants below), and
--      the one caller that passes an id — `staff_set_family_status()` in
--      20260817000006 — honours a supplied id only for a verified `service_role`
--      JWT claim and re-derives it from `auth.uid()` for everybody else. That is
--      `redeem_family_invitation`'s shape, which §2b names as the sanctioned one.
--
-- `p_user_id IS NOT NULL` is written out rather than left to the comparison. It is
-- already true that `user_id = NULL` matches no row, but a NULL id arriving here
-- means the caller could not work out who is acting, and a function that answers
-- "not staff" to that question by accident of SQL semantics is one refactor away
-- from answering something else.
CREATE OR REPLACE FUNCTION public.is_genorra_staff(p_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT p_user_id IS NOT NULL
     AND EXISTS (
           SELECT 1 FROM public.genorra_staff s WHERE s.user_id = p_user_id
         );
$$;

-- ── 3. The predicate, for the caller ────────────────────────────────────────
-- SECURITY DEFINER because the whole point is to answer a question about a table
-- the caller cannot read — the no-policy RLS in §1 is what makes that true, and it
-- is what makes this function the only route to the answer.
--
-- `auth.uid()` is NULL for an anonymous request and for a `service_role` request
-- (the service key's JWT carries a role and no `sub`), and in both cases this
-- returns FALSE. That is the correct direction and it is also the reason
-- 20260817000006's RPC cannot use this form: called through the admin client there
-- is no caller in the JWT to derive, which is precisely why that function takes
-- the actor and passes it to §2 instead.
CREATE OR REPLACE FUNCTION public.is_genorra_staff()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT public.is_genorra_staff((SELECT auth.uid()));
$$;

COMMENT ON FUNCTION public.is_genorra_staff() IS
  'True when the CALLING session is GENORRA staff. Reads auth.uid(), so it is false for '
  'anon and false for service_role (a service key has no `sub`) — a server-side caller '
  'that needs the answer for a known account calls is_genorra_staff(uuid). Executable by '
  'service_role only: no policy references it and the console resolves staffness on the '
  'server, so granting it to authenticated would publish the console in PostgREST''s '
  'OpenAPI document for nothing (AGENTS.md §2b).';

COMMENT ON FUNCTION public.is_genorra_staff(uuid) IS
  'True when the NAMED account is GENORRA staff. The single definition; the no-argument '
  'form delegates here. Safe to take an id because it only answers and is reachable only '
  'by service_role — see 20260817000005 §2 and AGENTS.md §2b on redeem_family_invitation.';

-- ── 4. Grants: none, and PUBLIC swept first ─────────────────────────────────
-- 20260806000015 §6 already revokes EXECUTE on new functions from PUBLIC, anon and
-- authenticated by default privilege, and grants it to service_role. These
-- statements are restated anyway, for the reason that file gives about thirteen
-- functions that carried the built-in `=X/postgres` PUBLIC grant no migration ever
-- removed: a default privilege applies to the role that CREATEd the object, and
-- that role differs between a local reset and a hosted push. A REVOKE that names
-- PUBLIC first is cheap and cannot be wrong.
--
-- No GRANT follows. See the header for the three reasons.
REVOKE ALL ON FUNCTION public.is_genorra_staff()      FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.is_genorra_staff(uuid)  FROM PUBLIC, anon, authenticated;

-- ── 5. Verify ───────────────────────────────────────────────────────────────
-- Every assertion below is fixture-free and unconditional except the last, which
-- says out loud that it is skipping and why — the split AGENTS.md prescribes after
-- 20260806000012 reported success over a function that could not run.
--
-- The functions are EXERCISED rather than merely asserted to exist. plpgsql and
-- SQL bodies alike resolve their names when they run, not when they are created,
-- so `SET search_path = ''` plus one unqualified reference is a migration that
-- applies cleanly and throws for its first caller. Calling them here is the only
-- thing that rules that out.
DO $mig$
DECLARE
  v_policies int;
  v_rls      boolean;
  v_answer   boolean;
  v_denied   boolean := false;
  v_switched boolean := false;
BEGIN
  -- 5a. The table, and the two properties that ARE its access model.
  IF NOT EXISTS (
    SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'genorra_staff'
  ) THEN
    RAISE EXCEPTION 'ROLLBACK: public.genorra_staff was not created';
  END IF;

  SELECT c.relrowsecurity INTO v_rls
    FROM pg_class c WHERE c.oid = 'public.genorra_staff'::regclass;
  IF NOT v_rls THEN
    RAISE EXCEPTION
      'ROLLBACK: RLS is not enabled on public.genorra_staff. With seed.sql granting '
      'ALL on every table to anon and authenticated, that makes the list of people who '
      'can see every family in the product world-readable.';
  END IF;

  SELECT COUNT(*) INTO v_policies
    FROM pg_policies WHERE schemaname = 'public' AND tablename = 'genorra_staff';
  IF v_policies <> 0 THEN
    RAISE EXCEPTION
      'ROLLBACK: public.genorra_staff carries % policy(ies). It is meant to carry none — '
      'RLS-enabled-with-no-policy is what denies every row to anon and authenticated, and '
      'a policy is an expression somebody can widen later.', v_policies;
  END IF;

  -- 5b. Both functions are SECURITY DEFINER with a pinned search_path. The second
  -- half is not decoration: `db advisors` flags a mutable search_path on a
  -- SECURITY DEFINER function as the combination that matters, and this pair reads
  -- a table nothing else can.
  -- `search_path=""` is how `SET search_path = ''` is stored in `proconfig` — the
  -- empty string arrives quoted. Checked against a live pg_proc rather than
  -- guessed, because `ARRAY['search_path=']` looks right, matches nothing, and
  -- would turn this into an assertion that always passes.
  IF EXISTS (
    SELECT 1 FROM pg_proc p
     WHERE p.pronamespace = 'public'::regnamespace
       AND p.proname = 'is_genorra_staff'
       AND (NOT p.prosecdef
            OR p.provolatile <> 's'
            OR p.proconfig IS NULL
            OR NOT ('search_path=""' = ANY (p.proconfig)))
  ) THEN
    RAISE EXCEPTION
      'ROLLBACK: is_genorra_staff is not SECURITY DEFINER + STABLE + search_path='''' '
      'in every overload';
  END IF;

  -- 5c. Grants. Durable, unlike a table privilege: supabase/seed.sql deliberately
  -- sets no function EXECUTE and asserts that exactly one public function is
  -- anon-callable, so this assertion is still true after a reset — which is the
  -- test AGENTS.md §2b sets before an assertion of this shape may be believed.
  IF has_function_privilege('anon', 'public.is_genorra_staff()', 'EXECUTE')
     OR has_function_privilege('authenticated', 'public.is_genorra_staff()', 'EXECUTE')
     OR has_function_privilege('anon', 'public.is_genorra_staff(uuid)', 'EXECUTE')
     OR has_function_privilege('authenticated', 'public.is_genorra_staff(uuid)', 'EXECUTE')
  THEN
    RAISE EXCEPTION
      'ROLLBACK: a browser role can execute is_genorra_staff. Nothing calls it from the '
      'browser and no policy names it, so this is either an accidental grant or a policy '
      'that arrived without one — see 20260817000005 §4.';
  END IF;

  -- And service_role CAN, or the console is dead on arrival and nothing else here
  -- would have said so.
  IF NOT has_function_privilege('service_role', 'public.is_genorra_staff(uuid)', 'EXECUTE')
     OR NOT has_function_privilege('service_role', 'public.is_genorra_staff()', 'EXECUTE')
  THEN
    RAISE EXCEPTION 'ROLLBACK: service_role cannot execute is_genorra_staff';
  END IF;

  -- 5d. RUN THEM. No session and no rows, so every answer must be false — and
  -- getting a false back is what proves `public.genorra_staff` and `auth.uid()`
  -- both resolve inside a body whose search_path is empty.
  SELECT public.is_genorra_staff() INTO v_answer;
  IF v_answer IS DISTINCT FROM false THEN
    RAISE EXCEPTION
      'ROLLBACK: is_genorra_staff() answered % with no session, expected false', v_answer;
  END IF;

  SELECT public.is_genorra_staff(NULL) INTO v_answer;
  IF v_answer IS DISTINCT FROM false THEN
    RAISE EXCEPTION
      'ROLLBACK: is_genorra_staff(NULL) answered %, expected false. A NULL actor means '
      'the caller could not work out who is acting and must never be admitted.', v_answer;
  END IF;

  SELECT public.is_genorra_staff(gen_random_uuid()) INTO v_answer;
  IF v_answer IS DISTINCT FROM false THEN
    RAISE EXCEPTION
      'ROLLBACK: is_genorra_staff() admitted an account that is not in genorra_staff';
  END IF;

  -- 5e. The write side, as `anon`, for real.
  --
  -- A SELECT probe is deliberately NOT what this does. The table is empty at this
  -- point, so `SELECT count(*)` returns 0 whether RLS is protecting it or not — an
  -- assertion that passes for the wrong reason, which is the failure mode §7 of
  -- AGENTS.md is about. Seeding a row to make the SELECT meaningful needs an
  -- `auth.users` row, and that fixture dependency is exactly what let
  -- 20260806000012's verify block skip itself into a false pass.
  --
  -- An INSERT needs no fixture and tests the more dangerous direction anyway: a
  -- browser role writing ITSELF into the staff list. It must be refused, and either
  -- refusal is acceptable — 42501 from the missing table privilege before seed.sql
  -- runs, or 42501 "new row violates row-level security policy" after it has. What
  -- must never happen is that it succeeds.
  --
  -- The SET ROLE is attempted in its own sub-block so that a database where the
  -- migration role cannot become `anon` reports a visible SKIP rather than
  -- swallowing the failure and counting it as a refusal.
  BEGIN
    SET LOCAL ROLE anon;
    v_switched := true;
  EXCEPTION WHEN OTHERS THEN
    v_switched := false;
  END;

  IF v_switched THEN
    BEGIN
      INSERT INTO public.genorra_staff (user_id, role, note)
      VALUES (gen_random_uuid(), 'owner', 'RLS probe — must never land');
    EXCEPTION WHEN insufficient_privilege THEN
      v_denied := true;
    END;
    RESET ROLE;

    IF NOT v_denied THEN
      RAISE EXCEPTION
        'ROLLBACK: role `anon` inserted a row into public.genorra_staff. Anyone holding '
        'the anon key — which ships in the browser bundle — could grant themselves access '
        'to every family in the product.';
    END IF;
    RAISE NOTICE 'genorra_staff: anon INSERT refused (RLS enabled, no policy)';
  ELSE
    RESET ROLE;
    RAISE NOTICE
      'genorra_staff: SKIPPED the anon INSERT probe — this database''s migration role '
      'cannot SET ROLE anon. The structural assertions above (RLS on, zero policies) '
      'still hold and are what Postgres enforces.';
  END IF;

  RAISE NOTICE
    'genorra_staff: table created, RLS on with 0 policies, is_genorra_staff() answers '
    'false for anon/service_role/unknown, executable by service_role only';
END $mig$;

COMMIT;
