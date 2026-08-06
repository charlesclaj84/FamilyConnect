-- ============================================================================
-- Remove any RLS policy that derives family_code from auth.jwt() user_metadata.
--
-- WHAT WAS FOUND
--   Supabase's "user_metadata in RLS" advisor flagged public.families. It was
--   right, and not stale: the hosted database carried TWO SELECT policies on that
--   table at once —
--
--     members can view own family        family_code = auth.jwt()->'user_metadata'->>'family_code'
--     perm:members can view own family   family_code = auth_family_code() AND (permission check)
--
--   Permissive policies are OR-ed, so the first one decided the outcome on its own
--   and the second was decoration. `user_metadata` is writable by its owner
--   (supabase.auth.updateUser({ data })), so any signed-in member could point
--   their own family_code at another family and read that family's row.
--
-- HOW IT CAME BACK
--   20260615000004 replaced this exact policy, and 20260618000001 then renamed its
--   replacement to 'perm:members can view own family'. That left NO policy called
--   'members can view own family' — so replaying 20260602000000_families.sql, whose
--   CREATE POLICY has neither a preceding DROP nor IF NOT EXISTS, recreated the
--   original spoofable policy without erroring. Its CREATE TABLE and ALTER TABLE
--   are both idempotent, so nothing else in that file objected either.
--
--   The evidence that this was one replayed file rather than a general rollback:
--   20260602000003_schema_redesign.sql carries user_metadata policies for `people`
--   and `person_relationships` and none of those reappeared; is_admin references
--   were still zero and people.is_admin still dropped, so 20260618000003 held.
--
-- WHAT THE EXPOSURE WAS, AND WAS NOT
--   families holds id, family_code, family_name, created_by, created_at — so the
--   reachable data is another family's name and the user id that created it. It did
--   NOT widen to the rest of the schema: the other 116 family-scoped policies go
--   through auth_family_code(), a SECURITY DEFINER lookup against `people` keyed on
--   auth.uid(), which rewriting user_metadata cannot move.
--
-- WHY THIS KEYS ON THE EXPRESSION AND NOT THE POLICY NAME
--   'members can view own family' is the CORRECT policy's name on a database where
--   the sweep skipped families — which is every database built from the current
--   chain, because 20260618000001 no longer maps families onto the unregistered
--   'dashboard' resource. Dropping by name would delete the only SELECT policy on
--   families there and make the table unreadable. Dropping by expression is right in
--   both states, and is a standing cleanup rather than a one-off.
--
-- IDEMPOTENT. On a database with no such policy this is a no-op.
-- ============================================================================

BEGIN;

-- ── 1. Drop every policy whose expression reads user_metadata ───────────────
DO $$
DECLARE
  p       record;
  v_count int := 0;
BEGIN
  FOR p IN
    SELECT tablename, policyname
      FROM pg_policies
     WHERE schemaname = 'public'
       AND (COALESCE(qual, '') || COALESCE(with_check, '')) LIKE '%user_metadata%'
     ORDER BY tablename, policyname
  LOOP
    EXECUTE format('DROP POLICY %I ON public.%I', p.policyname, p.tablename);
    RAISE NOTICE 'dropped spoofable policy %.%', p.tablename, p.policyname;
    v_count := v_count + 1;
  END LOOP;

  RAISE NOTICE 'dropped % policy(ies) deriving family_code from user_metadata', v_count;
END $$;

-- ── 2. Verify ───────────────────────────────────────────────────────────────
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_policies
     WHERE schemaname = 'public'
       AND (COALESCE(qual, '') || COALESCE(with_check, '')) LIKE '%user_metadata%'
  ) THEN
    RAISE EXCEPTION 'ROLLBACK: a user_metadata policy survived the drop';
  END IF;

  -- The drop must not have taken the last SELECT policy with it. Asserted on the
  -- expression, so it passes whether the surviving policy is the swept
  -- 'perm:members can view own family' or the plain one.
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
     WHERE schemaname = 'public' AND tablename = 'families' AND cmd = 'SELECT'
       AND COALESCE(qual, '') LIKE '%auth_family_code%'
  ) THEN
    RAISE EXCEPTION
      'ROLLBACK: families has no auth_family_code-based SELECT policy left — its members could not read their own family';
  END IF;
END $$;

COMMIT;
