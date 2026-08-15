-- ============================================================================
-- A due can start at an age, and the year it starts is prorated.
--
-- ── THE GAP THIS CLOSES ─────────────────────────────────────────────────────
-- Every dues schedule was owed by every member from the moment it existed, and the
-- product has no other way to say otherwise: `required` is a family-wide flag, and
-- opting out (20260807000003) is the MEMBER's choice, not the family's rule. So a
-- family that does not charge its children had exactly two options — charge them, or
-- make the due optional for everybody and hope.
--
-- `is_minor` used to be the thing that could have answered it, and it was dropped on
-- 2026-08-13 (20260813000006) for a reason that applies here with more force than
-- anywhere else: a stored boolean about age is wrong from the morning somebody has a
-- birthday until the day a human notices. Money must not be decided by a column that
-- goes stale. `date_of_birth` plus this number is derived at read time, every time.
--
-- ── WHAT `start_age` MEANS ──────────────────────────────────────────────────
-- The age at which a member becomes responsible for this due. NULL — the default, and
-- what every existing row gets — means what every row means today: everybody owes it,
-- whatever their age and whether or not a birthday is recorded.
--
-- The arithmetic lives in `ageShareOfPeriod` (lib/dues-utils.ts) and is tested there;
-- the rule in one line is that the member owes the months of the period AFTER the month
-- they reach the age. An annual $120 and an eighteenth birthday in July is $50 — five
-- twelfths — and the full $120 every year after.
--
-- ── WHY THERE IS NO POLICY, NO FUNCTION AND NO TRIGGER HERE ─────────────────
-- This withholds no rows. It changes what one member OWES, which is a figure computed
-- in `getMyDuesSummary` out of a schedule, a birthday and a ledger — there is nothing
-- for RLS to filter and nothing a family boundary could be crossed through. The same
-- reasoning `lib/tiers.ts` records for tiers: it withholds screens, never rows, and no
-- policy consults it.
--
-- A CHECK, though, because this is a public write path: `updateDuesSchedule` and
-- `createDuesSchedule` both spread client-supplied columns onto the row, and an age of
-- -3 or 900 is a schedule nobody can reason about. 0 is legal and means "from birth",
-- which is a real answer a family might give and is NOT the same as NULL.
--
-- ── AN UNRECORDED BIRTHDAY IS AN ADULT, DELIBERATELY ────────────────────────
-- `computeIsMinor` makes the same call and says why: most of a real tree has no
-- birthdays, and treating "not recorded" as "a child" would exempt half a family from
-- its dues on the strength of a blank field. The one place that default is dangerous is
-- a child recorded on the family tree, so `addRelative` now REQUIRES a date of birth on
-- exactly that path rather than letting the default decide it.
--
-- HOW THIS REACHES A DATABASE
--   `supabase db push`, from CI on merge to master — never `psql -f` by hand, which
--   records nothing and can replay this file out of order. See AGENTS.md, "How
--   migrations reach the hosted project".
-- ============================================================================

BEGIN;

ALTER TABLE dues_schedules
  ADD COLUMN IF NOT EXISTS start_age INT
    CHECK (start_age IS NULL OR (start_age >= 0 AND start_age <= 120));

COMMENT ON COLUMN dues_schedules.start_age IS
  'Dues only: the age at which a member becomes responsible for this due. NULL means everybody owes it whatever their age. The year a member reaches it is prorated by month — see ageShareOfPeriod in lib/dues-utils.ts. Derived from people.date_of_birth at read time; never stored per member, because an age stored is an age that goes stale.';

-- A gift is not owed, so an age at which somebody starts owing it is meaningless. Held
-- to NULL for the same reason `amount_cents` and `frequency` are pinned for a donation
-- (20260805000003): the invariant is forced in the database as well as in
-- `kindInvariants`, so one stale form cannot produce a row whose fields contradict its
-- kind. Written as a CHECK rather than a trigger because it is a statement about the row
-- rather than about who wrote it.
UPDATE dues_schedules SET start_age = NULL WHERE kind = 'donation' AND start_age IS NOT NULL;

ALTER TABLE dues_schedules
  DROP CONSTRAINT IF EXISTS dues_schedules_donation_has_no_start_age;
ALTER TABLE dues_schedules
  ADD CONSTRAINT dues_schedules_donation_has_no_start_age
    CHECK (kind <> 'donation' OR start_age IS NULL);

-- The assertion runs unconditionally and needs no fixture, which is the shape
-- AGENTS.md asks for: a verify block that can SKIP is a verify block that reports
-- success over an unapplied change. Both facts checked here are pure catalogue reads.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
     WHERE table_schema = 'public' AND table_name = 'dues_schedules'
       AND column_name = 'start_age'
  ) THEN
    RAISE EXCEPTION 'dues_schedules.start_age was not created';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
     WHERE conrelid = 'public.dues_schedules'::regclass
       AND conname = 'dues_schedules_donation_has_no_start_age'
  ) THEN
    RAISE EXCEPTION 'the donation invariant on start_age was not created';
  END IF;
END $$;

COMMIT;
