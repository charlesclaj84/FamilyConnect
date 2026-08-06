-- ============================================================================
-- Remove 'notifications' as a permission resource.
--
-- WHY: it is a control that cannot control anything.
--
--   20260618000001 registered it as a permissionable surface for the navbar bell.
--   But notifications are addressed mail — every row already carries the person it
--   belongs to, and the base RLS enforces that directly:
--
--     SELECT (20260615000004):
--       family_code = auth_family_code()
--       AND recipient_id IN (SELECT id FROM people WHERE user_id = auth.uid())
--
--   The sweep then AND-ed the permission layer onto that base, with
--   self_expr = 'recipient_id = auth_person_id()':
--
--     (base) AND ( recipient_id = auth_person_id()
--                  OR auth_permission('notifications','view') = 'any'
--                  OR (... = 'own' AND recipient_id = auth_person_id()) )
--
--   Any row that satisfies the base is addressed to one of the caller's people rows
--   AND is in the caller's active family — which is precisely auth_person_id(). So
--   self_expr is TRUE for every row the base already admits, and the whole added
--   factor is a tautology. Concretely:
--
--     * Granting notifications:view = 'any' exposes nothing extra. The base still
--       restricts to the caller's own rows; AND can only narrow.
--     * Setting the page to 'restricted' hides nothing. self_expr is OR-ed OUTSIDE
--       the permission check specifically so a member never loses their own rows.
--
--   So the row in Groups & Permissions is a switch wired to nothing: an
--   administrator can toggle it either way and no member's bell changes. That is
--   worse than absent — it reads as a privacy control that is being honoured.
--
-- SAFETY: deleting the resource does not weaken the table.
--   Protection comes from the base policy, which this migration does not touch for
--   SELECT or INSERT. The ON DELETE CASCADE removes the permission_table_map row and
--   any group/person/visibility rows for the key; all were inert per the above. The
--   already-wrapped policies keep their baked-in auth_permission('notifications',…)
--   literal, which stays harmless: with the resource gone, 'view' falls through to
--   the default 'any' (tautology, as before) and 'edit' fails closed to 'none',
--   leaving exactly self_expr. Rewriting them would mean reconstructing the original
--   expression by string surgery for no behavioural gain, so they are left as they are.
--
-- THE ONE THING THAT WAS NOT INERT — and is preserved below:
--   The UPDATE policy ("mark as read") is still the original from 20260609000002:
--
--     USING (recipient_id IN (SELECT id FROM people WHERE user_id = auth.uid()))
--
--   20260615000004 family-scoped the SELECT and INSERT policies but not this one, so
--   for a user who belongs to several families it admits their people rows in EVERY
--   family, not just the active one. Today the wrapper's self_expr is the only thing
--   narrowing that to auth_person_id(). Removing the resource from the table map
--   would drop that narrowing on any database built fresh from these migrations, so
--   the scoping is written into the base policy here instead — where it belonged.
--
-- IDEMPOTENT: the DELETE matches nothing on a second run, and the policy is
-- recreated by name under DROP POLICY IF EXISTS.
--
-- USAGE
--   psql "$DATABASE_URL" -f 20260805000007_drop_notifications_resource.sql
-- ============================================================================

BEGIN;

-- ── 1. Family-scope the UPDATE policy, standalone ───────────────────────────
-- Both names are dropped: 'perm:…' is what the sweep left on an existing database,
-- the bare name is what a fresh run of 20260618000001 now produces (its table-map
-- entry for notifications was removed in the same commit as this migration).
DROP POLICY IF EXISTS "perm:users can update own notifications" ON public.notifications;
DROP POLICY IF EXISTS "users can update own notifications"      ON public.notifications;

CREATE POLICY "users can update own notifications"
  ON public.notifications FOR UPDATE TO authenticated
  USING (
    family_code = public.auth_family_code()
    AND recipient_id = public.auth_person_id()
  )
  WITH CHECK (
    family_code = public.auth_family_code()
    AND recipient_id = public.auth_person_id()
  );

-- ── 2. Drop the resource ────────────────────────────────────────────────────
-- Cascades to permission_table_map, group_permissions, person_permissions and
-- resource_visibility. 20260618000001's INSERT of this row was removed in the same
-- commit, so a replay of that migration will not resurrect it.
DELETE FROM public.permission_resources WHERE key = 'notifications';

-- ── 3. Verify ───────────────────────────────────────────────────────────────
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM public.permission_resources WHERE key = 'notifications') THEN
    RAISE EXCEPTION 'ROLLBACK: notifications resource still present';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
     WHERE schemaname = 'public' AND tablename = 'notifications' AND cmd = 'UPDATE'
  ) THEN
    RAISE EXCEPTION 'ROLLBACK: notifications lost its UPDATE policy';
  END IF;
END $$;

COMMIT;
