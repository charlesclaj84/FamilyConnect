-- ============================================================================
-- truncate_entire_database.sql — FULLY PURGE every table in the database.
-- ----------------------------------------------------------------------------
-- *** DESTRUCTIVE — EMPTIES THE WHOLE DATABASE. NO RECOVERY. ***
--
-- Dynamically TRUNCATEs every base table in the `public` schema (CASCADE, with
-- identity reset), regardless of FK order. Then empties auth.users (which
-- cascades to all app tables that reference it — and to GoTrue's own auth.*
-- child tables: identities, sessions, refresh_tokens, etc.).
--
-- It is dynamic on purpose: it stays correct as the schema evolves, so no table
-- is missed. Run inside a transaction; review, then COMMIT (or ROLLBACK).
--
-- USAGE
--   psql "$DATABASE_URL" -f truncate_entire_database.sql
-- ============================================================================

BEGIN;

-- ── 1. Empty every base table in the public schema ──────────────────────────
DO $$
DECLARE
  v_tables text;
BEGIN
  SELECT string_agg(format('%I.%I', schemaname, tablename), ', ')
    INTO v_tables
  FROM pg_tables
  WHERE schemaname = 'public';

  IF v_tables IS NOT NULL THEN
    EXECUTE format('TRUNCATE TABLE %s RESTART IDENTITY CASCADE', v_tables);
    RAISE NOTICE 'Truncated public tables: %', v_tables;
  ELSE
    RAISE NOTICE 'No tables found in public schema.';
  END IF;
END $$;

-- ── 2. Empty all auth accounts ───────────────────────────────────────────────
-- Cascades to any public table FK still referencing auth.users, plus GoTrue's
-- internal child tables (identities, sessions, refresh tokens, mfa factors...).
DELETE FROM auth.users;

-- Review, then:
COMMIT;
-- ROLLBACK;  -- ← uncomment instead of COMMIT to abort.
