-- ============================================================================
-- Register 'my-families' as a permission resource.
--
-- My Families moved out of My Profile (where it was a card above the profile form)
-- onto its own page at /my-families, in the Personal section. A new page needs a
-- permission_resources row or administrators can never restrict it: an unregistered
-- resource defaults to viewable, which is a default nobody can change from the UI.
--
-- The key is the route minus its leading slash, because that is what requireView()
-- is called with and what viewableResources() derives from the feature's href.
--
-- sort_order 25 places it between My Profile (20) and My Children (30) in Groups &
-- Permissions, matching where it sits in the sidebar.
--
-- NOTE: this resource governs VIEW only. The two actions on the page — switching the
-- family you are viewing, and choosing which one opens on login — are self-service
-- over the caller's own memberships (app/actions/family.ts), not grant-gated. There
-- is no table to add to permission_table_map: the page reads getMyFamilies(), which
-- resolves the caller's own people rows and is already scoped by that fact.
--
-- Idempotent, and matching the ON CONFLICT DO UPDATE shape of the seed in
-- 20260618000000 — whose insert was updated in the same commit so replaying it
-- cannot drop this row back out.
--
-- HOW THIS REACHES A DATABASE
--   `supabase db push`, from CI on merge to master — never `psql -f` by hand, which
--   records nothing and can replay this file out of order. See AGENTS.md, "How
--   migrations reach the hosted project".
-- ============================================================================

BEGIN;

INSERT INTO public.permission_resources (key, label, category, sort_order)
VALUES ('my-families', 'My Families', 'personal', 25)
ON CONFLICT (key) DO UPDATE
  SET label = EXCLUDED.label, category = EXCLUDED.category, sort_order = EXCLUDED.sort_order;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.permission_resources WHERE key = 'my-families') THEN
    RAISE EXCEPTION 'ROLLBACK: my-families resource was not created';
  END IF;
END $$;

COMMIT;
