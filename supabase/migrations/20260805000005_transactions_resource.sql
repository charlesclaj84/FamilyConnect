-- ============================================================================
-- Register 'transactions' as a permission resource.
--
-- The Transactions page (dues, donations, contributions and disbursements — every
-- ledger of money that actually moved) used to be four sections of the Accounting
-- admin page, reachable only with 'admin/account' view. It is now a page of its own
-- in the main nav, because reading what the family collected and paid out is not an
-- administrative act, and a treasurer who records cheques had no business needing
-- full Accounting rights to do it.
--
-- WHY THIS ROW IS NEEDED AT ALL
--   resolveScope() already defaults an unregistered resource to 'any' for view, so
--   the page works without it. What it does NOT do is appear in Groups & Permissions
--   or User Access — both grids render straight from permission_resources — so
--   without this row a family could never restrict the page, only leave it open to
--   everyone. That is a silent, un-fixable-from-the-UI default, which is exactly the
--   sort of thing the permission rebuild was meant to end.
--
-- WHAT THIS DOES NOT GATE
--   Recording. The forms on that page check the permission for the money they touch
--   — 'dues' edit for a payment, 'family-finances' edit for a contribution or a
--   disbursement — and each server action enforces it independently of the page. A
--   member granted 'transactions' view sees four read-only ledgers.
--
-- Idempotent: ON CONFLICT DO NOTHING, so re-running changes nothing and an
-- administrator's later edits to the label are not stamped back over.
-- 20260618000000's seed is ON CONFLICT DO UPDATE, so the same row was added there
-- too — otherwise replaying that migration after this one would leave the two
-- disagreeing about sort order.
--
-- HOW THIS REACHES A DATABASE
--   `supabase db push`, from CI on merge to master — never `psql -f` by hand, which
--   records nothing and can replay this file out of order. See AGENTS.md, "How
--   migrations reach the hosted project".
-- ============================================================================

BEGIN;

INSERT INTO public.permission_resources (key, label, category, sort_order)
VALUES ('transactions', 'Transactions', 'accounting', 115)
ON CONFLICT (key) DO NOTHING;

COMMIT;
