-- ============================================================================
-- A dues schedule can be owed by the bloodline alone.
--
-- ── WHY A FAMILY NEEDS THIS ─────────────────────────────────────────────────
-- Some dues are the descendants' obligation and not the household's: a burial fund for
-- the line, an inheritance levy, a cemetery plot. The product had no way to say it. The
-- three things that already narrow a due each answer a different question and none of
-- them is this one:
--
--   required = false   the MEMBER may decline it. Their choice, not the family's rule.
--   start_age          a child grows into it. On a timer.
--   beneficiaries      donations only, and it hides a drive rather than un-owing it.
--
-- ── IT IS DERIVED AT READ TIME, LIKE THE AGE RULE AND FOR THE SAME REASON ───
-- No `people.is_blood` column, and none may be added. AGENTS.md §4c is explicit that
-- blood is a property of the LINK and not of the person — the same child is a step-child
-- of one parent and a blood child of the other, so a boolean on the person would have to
-- be wrong about one of them. `bloodlineIds()` walks `person_relationships.link_kind`
-- from `families.bloodline_anchor_id` on every read, exactly as `ageShareOfPeriod` derives
-- an age from a birthday rather than trusting a stored flag.
--
-- That makes this column a POINTER at a derivation, which has one consequence worth
-- stating: correcting a relationship, or moving the bloodline anchor, changes who owes
-- this due. That is the intended behaviour — the alternative is a stored answer that goes
-- wrong the moment somebody fixes the tree — and it is why the anchor's own audit warning
-- (20260813000008, surfaced on the tree since 2026-08-17) matters more now than it did.
--
-- ── AN UNKNOWN BLOODLINE BILLS NOBODY ──────────────────────────────────────
-- `bloodlineIds` returns NULL, not an empty set, when the family has no anchor. Its own
-- header forbids reading that as "nobody is blood", and for money the two readings are
-- wrong in opposite directions: billing everybody charges the step-children the family
-- ticked this box to exclude, silently. Billing nobody is visible — the family collects
-- less than expected and the projection says why.
--
-- So `duesEligibility` answers 'bloodline-unknown', every reader treats it as not owed,
-- and the Accounting form refuses to set the flag until the family has named the line.
-- Under-collecting loudly beats over-billing quietly.
--
-- ── NOT ON A DONATION ──────────────────────────────────────────────────────
-- Nobody owes a gift, so there is nothing for a bloodline to narrow. Held by a CHECK as
-- well as by `kindInvariants`, the same pair `start_age` and `required` are held by: one
-- stale form must not be able to post a row whose fields contradict its kind.
--
-- A donation that should be visible only to the line is a different feature and would use
-- `donation_beneficiaries` inverted, not this column. Do not overload it.
--
-- ── NO POLICY, NO FUNCTION, NO GRANT ───────────────────────────────────────
-- This withholds no rows. It changes what one member OWES, which is computed in
-- `getMyDuesSummary` and `getDuesProjection` out of a schedule, a tree and a ledger. There
-- is nothing for RLS to filter and no family boundary it could be crossed through — the
-- same reasoning 20260814000000 records for `start_age`.
--
-- HOW THIS REACHES A DATABASE
--   `supabase db push`, from CI on merge to master — never `psql -f` by hand, which
--   records nothing and can replay this file out of order. See AGENTS.md, "How
--   migrations reach the hosted project".
-- ============================================================================

BEGIN;

-- NOT NULL with a false default, unlike `start_age`, and the difference is deliberate:
-- there is no third state to express. An age has "no rule" as a distinct answer from
-- "from birth"; a bloodline restriction is on or off, and a nullable boolean would invite
-- three-valued logic into a question that has two answers.
ALTER TABLE dues_schedules
  ADD COLUMN IF NOT EXISTS bloodline_only BOOLEAN NOT NULL DEFAULT false;

COMMENT ON COLUMN dues_schedules.bloodline_only IS
  'Dues only: TRUE when only members in the family''s bloodline owe this. Derived at read time from person_relationships.link_kind and families.bloodline_anchor_id — never stored per member, because blood is a property of the LINK (AGENTS.md §4c). A family with no bloodline anchor bills NOBODY for it; see duesEligibility in lib/dues-utils.ts.';

-- The data half, for the same reason 20260805000003 carried one: any row that somehow
-- holds it against a donation is corrected before the constraint refuses it.
UPDATE dues_schedules SET bloodline_only = false WHERE kind = 'donation' AND bloodline_only;

ALTER TABLE dues_schedules
  DROP CONSTRAINT IF EXISTS dues_schedules_donation_is_not_bloodline_only;
ALTER TABLE dues_schedules
  ADD CONSTRAINT dues_schedules_donation_is_not_bloodline_only
    CHECK (kind <> 'donation' OR bloodline_only = false);

-- Unconditional catalogue reads, no fixture — so this cannot report success by skipping.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
     WHERE table_schema = 'public' AND table_name = 'dues_schedules'
       AND column_name = 'bloodline_only' AND is_nullable = 'NO'
  ) THEN
    RAISE EXCEPTION 'dues_schedules.bloodline_only was not created NOT NULL';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
     WHERE conrelid = 'public.dues_schedules'::regclass
       AND conname = 'dues_schedules_donation_is_not_bloodline_only'
  ) THEN
    RAISE EXCEPTION 'the donation invariant on bloodline_only was not created';
  END IF;

  -- The derivation this column points at must still exist. `bloodline_anchor_id` is what
  -- `bloodlineIds` walks from, and without it every bloodline-only due would bill nobody
  -- for a reason no screen could explain.
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
     WHERE table_schema = 'public' AND table_name = 'families'
       AND column_name = 'bloodline_anchor_id'
  ) THEN
    RAISE EXCEPTION 'families.bloodline_anchor_id is missing — bloodline_only has nothing to derive from';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
     WHERE table_schema = 'public' AND table_name = 'person_relationships'
       AND column_name = 'link_kind'
  ) THEN
    RAISE EXCEPTION 'person_relationships.link_kind is missing — bloodline_only has nothing to derive from';
  END IF;
END $$;

COMMIT;
