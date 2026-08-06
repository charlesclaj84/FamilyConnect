-- ============================================================================
-- Donations: an optional counterpart to dues.
--
-- Donations behave exactly like dues — same label, amount, frequency, date window,
-- description; same payments recorded against them; same routing into funds; same
-- appearance in payment history. The ONE difference is obligation: dues are owed,
-- donations are offered.
--
-- So this is a column on dues_schedules, not a second table. A donation_schedules
-- table would have needed its own payments, its own member plans, its own routing
-- and its own summary reads — four near-copies of working code, kept in step by
-- hand, to express a single boolean fact.
--
-- WHY A `kind` TEXT AND NOT A `required` BOOLEAN
--   Requiredness is not an independent axis here: dues are required *because* they
--   are dues. Naming the category leaves room for a third one later (a one-off
--   assessment, a chapter fee) without every consumer having to re-derive what
--   `required = false` was supposed to mean.
--
-- The DEFAULT is what makes this safe on a live table: every existing schedule is a
-- dues schedule, and every insert that predates the code change stays one.
--
-- Members' obligations are unaffected. getMyDuesSummary counts only kind='dues', so
-- a donation never lands in anyone's remaining balance — which is the whole point of
-- it being optional.
--
-- Additive and idempotent — no policy changes. dues_schedules RLS routes through
-- permission_table_map ('admin/account'), and this column does not affect who may
-- read or write a row.
--
-- USAGE
--   psql "$DATABASE_URL" -f 20260805000002_donation_schedules.sql
-- ============================================================================

BEGIN;

ALTER TABLE dues_schedules
  ADD COLUMN IF NOT EXISTS kind TEXT NOT NULL DEFAULT 'dues';

-- Dropped and recreated rather than added conditionally, so re-running the file
-- converges on this definition instead of failing on the existing one.
ALTER TABLE dues_schedules DROP CONSTRAINT IF EXISTS dues_schedules_kind_check;
ALTER TABLE dues_schedules ADD CONSTRAINT dues_schedules_kind_check
  CHECK (kind IN ('dues', 'donation'));

-- Every read is "the active dues (or donations) for this family".
CREATE INDEX IF NOT EXISTS dues_schedules_family_kind_idx
  ON dues_schedules(family_code, kind);

COMMENT ON COLUMN dues_schedules.kind IS
  'dues = owed by every member and counted in their balance; donation = optional, never owed.';

COMMIT;
