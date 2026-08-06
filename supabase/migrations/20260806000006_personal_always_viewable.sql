-- ============================================================================
-- Take Dashboard and the Personal features out of the permission model entirely.
--
-- DECISION: the Dashboard and everything under Personal — My Profile, My Families,
-- My Children, Family Tree — are always viewable by every member and are not
-- administrable. They are a member's own things. Offering a switch to hide someone's
-- own profile from themselves is not a control anybody wants, and it clutters Groups &
-- Permissions with five rows nobody should ever touch.
--
-- HOW "ALWAYS VIEWABLE" IS ACHIEVED
--   By deleting the permission_resources rows. auth_permission() and its TypeScript
--   twin resolveScope() both default the 'view' action to 'any' for a key with no
--   resource_visibility row (20260618000000; lib/auth/permissions.ts). An unregistered
--   resource is therefore viewable by default and cannot be restricted — which is
--   normally a defect, and is here precisely the requirement.
--
--   The pages keep their requireView() calls. Those still do real work: resolveScope
--   returns 'none' when the caller has no person row at all, so a signed-in user who
--   is not a member of the family is still turned away. What goes is the family's
--   ability to switch these off.
--
--   This is a DELIBERATE exception to AGENTS.md §5 ("a new page needs a row in
--   permission_resources so administrators can restrict it"). The rule exists so a
--   surface cannot be un-hideable by accident; these five are un-hideable on purpose.
--
-- THE PART THAT NEEDS CARE: WRITES
--   The RLS sweep AND-ed a permission clause onto every policy of every mapped table,
--   with the resource key baked in as a literal. Deleting a resource does not rewrite
--   those policies — it changes what auth_permission() RETURNS for that key:
--
--     view                  -> 'any'  (default above)   -> clause is a tautology, base
--                                                          policy stands. Harmless.
--     create / edit / delete -> 'none' (fails closed)   -> clause collapses to the
--                                                          table's self_expr.
--
--   So for each mapped table the question is whether its self_expr alone is the right
--   write rule:
--
--     families              SELECT-only policy. Nothing writes it through the user
--                           client (registration uses the service role). Safe.
--     relationship_types    SELECT-only lookup table. Safe.
--     kids                  self_expr = parent_user_id = auth.uid(). "My own children
--                           are mine to manage" — correct, and unchanged.
--     family_ancestors      self_expr = user_id = auth.uid(). Same. Correct.
--     person_relationships  self_expr = 'false'.  <-- THE PROBLEM. Its write policies
--                           would collapse to FALSE and the family tree would become
--                           permanently read-only. Section 1 fixes this before the
--                           resource is removed.
--
--   (kids and family_ancestors are mapped but may not exist in every database; the
--   sweep skips absent tables and so does this migration.)
--
-- IDEMPOTENT. Safe to re-run.
-- ============================================================================

BEGIN;

-- ── 1. person_relationships becomes self-service ────────────────────────────
-- Rebuilt longhand rather than textually patched, because the SHAPE changes: the
-- permission disjunct disappears entirely rather than swapping one key for another.
-- The base expressions are reproduced verbatim from the swept policies — ownership by
-- created_by — with family scoping added to UPDATE and DELETE, which only ever had it
-- on INSERT. That can only narrow: a member with rows in two families was previously
-- able to touch either from whichever one they were viewing.
DO $$
DECLARE p record;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_tables WHERE schemaname='public' AND tablename='person_relationships') THEN
    RAISE NOTICE 'skip person_relationships: table not present';
    RETURN;
  END IF;

  FOR p IN
    SELECT policyname FROM pg_policies
     WHERE schemaname = 'public' AND tablename = 'person_relationships'
       AND cmd IN ('INSERT', 'UPDATE', 'DELETE', 'ALL')
  LOOP
    EXECUTE format('DROP POLICY %I ON public.person_relationships', p.policyname);
  END LOOP;

  EXECUTE $q$
    CREATE POLICY "users can insert own relationships"
      ON public.person_relationships FOR INSERT TO authenticated
      WITH CHECK (family_code = public.auth_family_code() AND created_by = (SELECT auth.uid()))
  $q$;

  EXECUTE $q$
    CREATE POLICY "users can update own relationships"
      ON public.person_relationships FOR UPDATE TO authenticated
      USING      (family_code = public.auth_family_code() AND created_by = (SELECT auth.uid()))
      WITH CHECK (family_code = public.auth_family_code() AND created_by = (SELECT auth.uid()))
  $q$;

  EXECUTE $q$
    CREATE POLICY "users can delete own relationships"
      ON public.person_relationships FOR DELETE TO authenticated
      USING (family_code = public.auth_family_code() AND created_by = (SELECT auth.uid()))
  $q$;
END $$;

-- ── 2. Drop the five resources ──────────────────────────────────────────────
-- ON DELETE CASCADE removes their permission_table_map rows and any group, person or
-- visibility rows that referenced them. All of those were configuration for a control
-- that is going away.
DELETE FROM public.permission_resources
 WHERE key IN ('dashboard', 'personal-info', 'my-families', 'direct-lineage', 'family-tree');

-- ── 3. Verify ───────────────────────────────────────────────────────────────
DO $$
DECLARE v_left int; v_writes int;
BEGIN
  SELECT COUNT(*) INTO v_left FROM public.permission_resources
   WHERE key IN ('dashboard', 'personal-info', 'my-families', 'direct-lineage', 'family-tree');
  IF v_left > 0 THEN
    RAISE EXCEPTION 'ROLLBACK: % personal resources still registered', v_left;
  END IF;

  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname='public' AND tablename='person_relationships') THEN
    SELECT COUNT(*) INTO v_writes FROM pg_policies
     WHERE schemaname='public' AND tablename='person_relationships' AND cmd IN ('INSERT','UPDATE','DELETE');
    IF v_writes <> 3 THEN
      RAISE EXCEPTION 'ROLLBACK: person_relationships has % write policies, expected 3', v_writes;
    END IF;
    IF EXISTS (
      SELECT 1 FROM pg_policies
       WHERE schemaname='public' AND tablename='person_relationships'
         AND (COALESCE(qual,'') LIKE '%family-tree%' OR COALESCE(with_check,'') LIKE '%family-tree%')
         AND cmd IN ('INSERT','UPDATE','DELETE')
    ) THEN
      RAISE EXCEPTION 'ROLLBACK: a person_relationships write policy still consults family-tree';
    END IF;
  END IF;
END $$;

COMMIT;
