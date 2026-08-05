-- ============================================================================
-- Rename the 'admin/account' permission resource: Account Management → Accounting.
--
-- Display-only. The resource KEY is untouched on purpose: 'admin/account' is
-- referenced by permission_table_map (dues_schedules), by group_permissions and
-- individual_permissions rows, and by the route itself. Renaming the key would
-- orphan every grant; renaming the label just changes what administrators read
-- in Groups & Permissions and User Access.
--
-- The label lives in the database because those two grids render the resource
-- list straight from permission_resources. The sidebar and Coming Soon copy read
-- their own label from lib/features.ts, which changes in the same commit.
--
-- Idempotent: matches on key, and re-running with the label already set is a
-- no-op write. 20260618000000's seed is ON CONFLICT DO UPDATE on label, so if
-- that migration is ever replayed after this one it would revert the name — its
-- seed literal was updated to 'Accounting' as well to keep the two in step.
-- ============================================================================

BEGIN;

UPDATE public.permission_resources
   SET label = 'Accounting'
 WHERE key = 'admin/account'
   AND label <> 'Accounting';

COMMIT;
