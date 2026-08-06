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
GRANT ALL ON ALL FUNCTIONS IN SCHEMA public TO anon, authenticated, service_role;

ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT ALL ON TABLES TO anon, authenticated, service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT ALL ON SEQUENCES TO anon, authenticated, service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT ALL ON FUNCTIONS TO anon, authenticated, service_role;
