-- ============================================================================
-- Rename the 'account-summary' permission resource: Account Summary → My Summary.
--
-- Display-only, and deliberately the same shape as 20260618000004 (Account
-- Management → Accounting), for the same reasons:
--
--   * The resource KEY is untouched. 'account-summary' is referenced by every
--     group_permissions and individual_permissions row that grants this page, by
--     resource_visibility, and by the route itself. Renaming the key would orphan
--     every grant; renaming the label just changes what administrators read in
--     Groups & Permissions and User Access.
--
--   * The ROUTE stays /account-summary too — requireView() looks the page up by
--     that key, so the path and the key have to stay in step.
--
-- The label lives in the database because those two grids render the resource list
-- straight from permission_resources. The sidebar and Coming Soon copy read their
-- own label from lib/features.ts, which changes in the same commit.
--
-- Idempotent: matches on key, and re-running with the label already set is a no-op
-- write. 20260618000000's seed is ON CONFLICT DO UPDATE on label, so if that
-- migration is ever replayed after this one it would revert the name — its seed
-- literal was updated to 'My Summary' as well to keep the two in step.
--
-- USAGE
--   psql "$DATABASE_URL" -f 20260805000004_rename_account_summary.sql
-- ============================================================================

BEGIN;

UPDATE public.permission_resources
   SET label = 'My Summary'
 WHERE key = 'account-summary'
   AND label <> 'My Summary';

COMMIT;
