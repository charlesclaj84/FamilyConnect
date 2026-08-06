-- ============================================================================
-- Put Family Finances after the Transactions sub-section, not inside it.
--
-- 20260806000000 gave the four recording resources sort_order 116-119 and
-- 20260806000003 gave Payment Reversals 120 — which collided with Family Finances,
-- also 120. Ordered by sort_order the Accounting category came out as:
--
--     My Summary (100) · Dues Records (110) · Transactions (115)
--     [Transactions sub-section: 116, 117, 118, 119]
--     Family Finances (120) / Payment Reversals (120)   <- tie, and one row inside
--                                                          a sub-section it does not
--                                                          belong to
--
-- The grids emit a sub-section header the moment `subsection` changes, so a tie there
-- puts Family Finances either in the middle of the Transactions block or immediately
-- after it with no header to close the block. Moving it to 130 makes the sub-section
-- contiguous and leaves Family Finances plainly outside it:
--
--     Accounting
--       My Summary · Dues Records · Transactions
--       └─ Transactions
--            Dues Payments · Donation Payments · Fund Contributions
--            Fund Disbursements · Payment Reversals
--       Family Finances
--
-- Display only. No key, grant or policy changes.
-- ============================================================================

BEGIN;

UPDATE public.permission_resources
   SET sort_order = 130
 WHERE key = 'family-finances' AND sort_order <> 130;

DO $$
DECLARE v_dupes int;
BEGIN
  SELECT COUNT(*) INTO v_dupes FROM (
    SELECT sort_order FROM public.permission_resources
     WHERE category = 'accounting'
     GROUP BY sort_order HAVING COUNT(*) > 1
  ) d;
  IF v_dupes > 0 THEN
    RAISE EXCEPTION 'ROLLBACK: % duplicate sort_order values remain in the accounting category', v_dupes;
  END IF;
END $$;

COMMIT;
