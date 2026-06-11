-- Fund enhancements:
--   * open_contributions flag — any family member may contribute freely
--   * a distinct ledger source for member-initiated contributions

ALTER TABLE funds
  ADD COLUMN IF NOT EXISTS open_contributions BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE fund_contributions DROP CONSTRAINT IF EXISTS fund_contributions_source_check;
ALTER TABLE fund_contributions ADD CONSTRAINT fund_contributions_source_check
  CHECK (source IN ('dues_routing', 'admin_manual', 'member_contribution'));
