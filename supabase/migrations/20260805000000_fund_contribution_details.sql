-- ============================================================================
-- fund_contributions: record WHO gave the money and HOW.
--
-- Until now a manually recorded contribution captured only fund, amount, date and
-- a free-text note, so "$500 into the College Fund" had no giver and no method —
-- nothing to reconcile a bank statement or a stack of cheques against.
--
--   contributor_person_id — the giver, when they are a member of the family.
--   contributor_name      — the giver when they are NOT a member (an in-law, a
--                           church, "2026 reunion surplus"). Exactly one of these
--                           two is filled in by the recording form; both are
--                           nullable because rows written before this migration
--                           have neither, and dues-routed rows never will.
--   payment_method        — how it arrived (cash, cheque, Zelle…). Free text
--                           rather than a CHECK constraint, matching
--                           dues_payments.payment_method: the list of ways people
--                           hand over money changes faster than migrations do.
--   payment_reference     — cheque number, confirmation code, deposit slip.
--
-- Deliberately NOT backfilled onto source = 'dues_routing' rows: those already
-- point at the payment they came from via dues_payment_id, and dues_payments
-- carries person_id. Copying the payer here as well would create a second place
-- for the same fact to be wrong.
--
-- Additive and idempotent — no policy changes. fund_contributions RLS already
-- routes through permission_table_map ('family-finances', own = recorded_by), and
-- these columns do not affect who may read or write a row.
--
-- USAGE
--   psql "$DATABASE_URL" -f 20260805000000_fund_contribution_details.sql
-- ============================================================================

BEGIN;

ALTER TABLE fund_contributions
  ADD COLUMN IF NOT EXISTS contributor_person_id UUID REFERENCES people(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS contributor_name      TEXT,
  ADD COLUMN IF NOT EXISTS payment_method        TEXT,
  ADD COLUMN IF NOT EXISTS payment_reference     TEXT;

-- "What has this member given?" is the one question that reads by contributor.
CREATE INDEX IF NOT EXISTS fund_contributions_contributor_idx
  ON fund_contributions(contributor_person_id)
  WHERE contributor_person_id IS NOT NULL;

COMMENT ON COLUMN fund_contributions.contributor_person_id IS
  'Family member the money came from. NULL for dues-routed rows (see dues_payment_id) and for non-member givers (see contributor_name).';
COMMENT ON COLUMN fund_contributions.contributor_name IS
  'Free-text giver for contributions that did not come from a member — an outside donor or another source.';
COMMENT ON COLUMN fund_contributions.payment_method IS
  'How the money was handed over: cash, check, Zelle, bank transfer, etc.';
COMMENT ON COLUMN fund_contributions.payment_reference IS
  'Check number, confirmation code or deposit reference for the contribution.';

COMMIT;
