-- ============================================================================
-- Local-only baseline. Runs after every `supabase db reset` / first `start`.
-- Never applied to a remote — `supabase db push` ships migrations, not seeds.
--
-- WHY THIS EXISTS
--   Recent Supabase CLI versions create the `public` schema with a default ACL
--   that grants anon / authenticated / service_role only Dxtm (TRUNCATE,
--   REFERENCES, TRIGGER, MAINTAIN) — no SELECT/INSERT/UPDATE/DELETE. The hosted
--   project predates that change and carries the older, full grants, which is
--   why the app works there and a freshly-reset local database returns
--   "permission denied for table ..." for even the service-role client.
--
--   This restores the hosted baseline so local behaviour matches production.
--
-- WHY IT MATTERS FOR THE RLS SUITE — read before "simplifying" this file
--   The suite in tests/rls proves that a member of one family cannot reach
--   another family's rows. Without these grants, `authenticated` cannot reach
--   ANY row of ANY table, so every isolation assertion would pass without RLS
--   being consulted at all — a green run that proves nothing.
--
--   Granting DML to `authenticated` is therefore not a loosening of the test; it
--   is the precondition that makes the test meaningful. Row Level Security, not
--   the absence of a GRANT, is the thing under test. If you ever see the whole
--   suite go green immediately after touching this file, suspect this file.
-- ============================================================================

GRANT USAGE ON SCHEMA public TO anon, authenticated, service_role;

GRANT ALL ON ALL TABLES    IN SCHEMA public TO anon, authenticated, service_role;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO anon, authenticated, service_role;

ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT ALL ON TABLES TO anon, authenticated, service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT ALL ON SEQUENCES TO anon, authenticated, service_role;

-- ============================================================================
-- FUNCTION EXECUTE IS DELIBERATELY ABSENT FROM THIS FILE.
--
-- It used to read
--     GRANT ALL ON ALL FUNCTIONS IN SCHEMA public TO anon, authenticated, service_role;
-- plus the matching ALTER DEFAULT PRIVILEGES. Those ran AFTER the migrations on
-- every reset and re-opened all 34 public functions — undoing every REVOKE the
-- migration chain had issued. `seed_family_system_groups()` was the cost: an
-- anonymous HTTP caller could use it to restore an Administrators grant that an
-- administrator had deleted.
--
-- 20260806000015 now owns function EXECUTE. If this file sets it too, local stops
-- mirroring hosted and every test below is exercising the wrong database.
--
-- TABLES ARE THE OPPOSITE CASE and stay exactly as they are. Without table DML the
-- whole RLS suite passes without RLS ever being consulted — see the header. With a
-- blanket FUNCTION grant, the lockdown is never consulted. Same principle, opposite
-- direction: local must match hosted, and neither more nor less.
-- ============================================================================
DO $$
DECLARE
  n_anon  int;
  n_authd int;
  n_svc   int;
BEGIN
  SELECT count(*) INTO n_anon FROM pg_proc p
   WHERE p.pronamespace = 'public'::regnamespace
     AND has_function_privilege('anon', p.oid, 'EXECUTE');
  SELECT count(*) INTO n_authd FROM pg_proc p
   WHERE p.pronamespace = 'public'::regnamespace
     AND has_function_privilege('authenticated', p.oid, 'EXECUTE');
  SELECT count(*) INTO n_svc FROM pg_proc p
   WHERE p.pronamespace = 'public'::regnamespace
     AND NOT has_function_privilege('service_role', p.oid, 'EXECUTE');

  IF n_anon <> 1 OR n_svc <> 0 THEN
    RAISE EXCEPTION
      'local function grants do not match 20260806000015 (anon=%, expected 1; service_role missing=%, expected 0). '
      'Something re-granted EXECUTE after the migrations ran — suspect this file, or a CLI version that grants by default.',
      n_anon, n_svc;
  END IF;

  -- A floor, not an equality: adding a legitimately authenticated-callable
  -- function should not fail a reset. Under-granting is the failure worth catching,
  -- because a local-only over-revoke makes tests/rls pass for the wrong reason —
  -- an action that dies with "permission denied for function" returns no ALPHA
  -- markers, and the attack assertion cannot tell that from isolation working.
  IF n_authd < 15 THEN
    RAISE EXCEPTION
      'only % public functions are executable by authenticated. A local-only over-revoke '
      'makes the RLS suite green for the wrong reason.', n_authd;
  END IF;

  RAISE NOTICE 'function grants: anon=%, authenticated=%, service_role=all', n_anon, n_authd;
END $$;
