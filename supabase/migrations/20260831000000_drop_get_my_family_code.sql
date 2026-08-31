-- ═══════════════════════════════════════════════════════════════════════════════════
-- DROP public.get_my_family_code() — the last loose end of the 2026-08-06 lockdown
-- ═══════════════════════════════════════════════════════════════════════════════════
--
-- `20260806000015` closed the anon-callable-function hole and derived every policy-helper
-- grant from `pg_policies` PER DATABASE. That is the right mechanism (AGENTS.md §2b rule 2:
-- the policies here are composed at migration time, and hosted has drifted from the chain
-- before) and it has one consequence worth naming: a helper referenced by NO policy is
-- granted on no database, so `get_my_family_code()` ended up granted on hosted only if a
-- hosted policy happened to reference it. A function whose reachability depends on which
-- database you are looking at is the exact ambiguity that section exists to remove.
--
-- ── IT IS SUPERSEDED, AND HAS BEEN SINCE 20260617000000 ────────────────────────────
-- `auth_family_code()` is the resolver every current policy uses. `get_my_family_code()` is
-- its predecessor, kept through `20260617000000`'s multi-family rewrite so the chat policies
-- created by `20260603000003` would keep resolving — and those policies were renamed and
-- recomposed by `20260618000001`'s sweep, which left this function with no caller anywhere.
--
-- ── FOUR WAYS SOMETHING COULD STILL DEPEND ON IT, ALL FOUR ASKED ───────────────────
-- Measured against a fresh `db reset` on 2026-08-31 before writing this, because "grep found
-- nothing" is a statement about the repo and this is a question about the database:
--
--   pg_policies, qual and with_check .......... 0 rows
--   every function body in public (prosrc) .... 0 rows
--   every view and matview definition ......... 0 rows
--   app code, outside migration files ......... none
--
-- The verify block below re-asks the first three, so a hosted database that has drifted into
-- referencing it fails the deploy rather than losing the function underneath a live policy.
-- That ordering is deliberate: the assertions run BEFORE the drop.
--
-- ── WHAT THIS DELIBERATELY DOES NOT DO ─────────────────────────────────────────────
-- It does not touch `auth_uid_is_room_participant()`, which looks similar and is the
-- opposite case: it has no call site in the app either, and it is LOAD-BEARING because
-- Realtime evaluates the `chat_messages` SELECT policy as the subscribing role. AGENTS.md
-- says so twice. Dropping a function because grep found no caller is how that one would go.

DO $$
DECLARE
  offender text;
BEGIN
  -- 1. No policy may reference it. A policy expression is evaluated as the QUERYING role,
  --    so a live reference plus a dropped function is "permission denied for function" on
  --    every query the policy guards — a whole feature down, reported as an outage.
  SELECT format('%s.%s (%s)', schemaname, tablename, policyname) INTO offender
  FROM pg_policies
  WHERE schemaname = 'public'
    AND (coalesce(qual, '') || coalesce(with_check, '')) LIKE '%get_my_family_code%'
  LIMIT 1;
  IF offender IS NOT NULL THEN
    RAISE EXCEPTION 'get_my_family_code() is still referenced by policy %', offender;
  END IF;

  -- 2. No other function body. A SECURITY DEFINER function calling it would fail for its
  --    first caller and not before — plpgsql resolves names when the body RUNS.
  SELECT p.proname INTO offender
  FROM pg_proc p
  JOIN pg_namespace n ON n.oid = p.pronamespace
  WHERE n.nspname = 'public'
    AND p.proname <> 'get_my_family_code'
    AND p.prokind = 'f'
    AND p.prosrc LIKE '%get_my_family_code%'
  LIMIT 1;
  IF offender IS NOT NULL THEN
    RAISE EXCEPTION 'get_my_family_code() is still called by function %', offender;
  END IF;

  -- 3. No view or materialized view.
  SELECT c.relname INTO offender
  FROM pg_class c
  JOIN pg_namespace n ON n.oid = c.relnamespace
  WHERE n.nspname = 'public'
    AND c.relkind IN ('v', 'm')
    AND pg_get_viewdef(c.oid) LIKE '%get_my_family_code%'
  LIMIT 1;
  IF offender IS NOT NULL THEN
    RAISE EXCEPTION 'get_my_family_code() is still used by view %', offender;
  END IF;
END $$;

DROP FUNCTION IF EXISTS public.get_my_family_code();

-- ── AND IT STAYS GONE ──────────────────────────────────────────────────────────────
-- `auth_family_code()` is asserted present in the same breath, because the failure this
-- guards against is not "the drop did not happen" — it is somebody reading this file as
-- licence to tidy the resolver that replaced it.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.proname = 'get_my_family_code'
  ) THEN
    RAISE EXCEPTION 'get_my_family_code() survived the drop';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.proname = 'auth_family_code'
  ) THEN
    RAISE EXCEPTION 'auth_family_code() is missing — it is the resolver every policy uses';
  END IF;

  RAISE NOTICE 'get_my_family_code() dropped; auth_family_code() is the one resolver.';
END $$;
