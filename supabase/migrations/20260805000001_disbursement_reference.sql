-- ============================================================================
-- fund_disbursements: record the check number the money went out on.
--
-- Money OUT had no identifier at all — a $250 milestone award to a member and the
-- check that paid it could not be tied together when the bank statement arrived, or
-- when a member said the check never came. Named payment_reference, not check_no,
-- and left as free text for the same reason as the contribution column it mirrors:
-- not everything goes out on a check, and "Zelle confirmation 4471" belongs in the
-- same slot as "Check #1043".
--
-- Additive and idempotent — no policy changes. fund_disbursements RLS routes
-- through permission_table_map ('family-finances', own/self = person_id), and this
-- column does not affect who may read or write a row.
--
-- HOW THIS REACHES A DATABASE
--   `supabase db push`, from CI on merge to master — never `psql -f` by hand, which
--   records nothing and can replay this file out of order. See AGENTS.md, "How
--   migrations reach the hosted project".
-- ============================================================================

BEGIN;

ALTER TABLE fund_disbursements
  ADD COLUMN IF NOT EXISTS payment_reference TEXT;

COMMENT ON COLUMN fund_disbursements.payment_reference IS
  'Check number, transfer confirmation or other reference the disbursement went out on.';

COMMIT;
