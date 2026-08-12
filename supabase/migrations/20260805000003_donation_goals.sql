-- ============================================================================
-- Donations are a goal, not a bill.
--
-- 20260805000002 made donations dues schedules with kind='donation', which handed
-- them two fields that make no sense for a gift:
--
--   amount_cents — "what you owe per period". A donation asks for nothing in
--                  particular; the family advises a target and members give what
--                  they give.
--   frequency    — dues recur; a donation drive opens and closes. Its start_date and
--                  end_date already say everything there is to say about its timing.
--
-- So: a new goal_cents, and the other two pinned to inert values for donations.
--
-- goal_cents is nullable and carries no CHECK tying it to kind. Dues never have a
-- goal, donations always should, but a constraint expressing that would fail this
-- migration on any donation already created without one — and the create action
-- enforces it going forward, where a friendly message is possible.
--
-- OVER-GIVING IS FINE, and nothing here caps it. The goal is a target to render
-- progress against, not a limit: a member may give past 100% and the reads report
-- exactly what was given.
--
-- The UPDATE is the data half. Any donation created between 20260805000002 and this
-- migration typed its target into the "suggested amount" field, so that number
-- becomes the goal rather than being thrown away. Re-runnable: once amount_cents is
-- 0 the NULLIF yields NULL and COALESCE keeps whatever goal is already there.
--
-- HOW THIS REACHES A DATABASE
--   `supabase db push`, from CI on merge to master — never `psql -f` by hand, which
--   records nothing and can replay this file out of order. See AGENTS.md, "How
--   migrations reach the hosted project".
-- ============================================================================

BEGIN;

ALTER TABLE dues_schedules
  ADD COLUMN IF NOT EXISTS goal_cents INT CHECK (goal_cents IS NULL OR goal_cents >= 0);

-- Carry across anything already entered, then blank the two fields donations no
-- longer use. 'one-time' rather than a new frequency value: it is the existing
-- "does not recur" member of the frequency CHECK, and nothing reads it for a
-- donation anyway.
UPDATE dues_schedules
   SET goal_cents   = COALESCE(goal_cents, NULLIF(amount_cents, 0)),
       amount_cents = 0,
       frequency    = 'one-time'
 WHERE kind = 'donation'
   AND (amount_cents <> 0 OR frequency <> 'one-time');

COMMENT ON COLUMN dues_schedules.goal_cents IS
  'Donations only: the total a member is encouraged to reach across the drive. Advisory — giving may exceed it. NULL for dues, which use amount_cents.';

COMMIT;
