-- ═══════════════════════════════════════════════════════════════════════════════════════
-- THE ZONE A GATHERING'S TIMES WERE STATED IN
-- ═══════════════════════════════════════════════════════════════════════════════════════
--
-- `20260826000001` gave a gathering times of day and argued, at length and correctly, that
-- they are WALL-CLOCK LABELS rather than instants:
--
--   > `11:00` here means what it means on a paper invitation: eleven o'clock, where the
--   > gathering is. It is never converted, never compared across zones, never turned into a
--   > `timestamptz` … **If a family timezone is ever recorded, do NOT convert these.**
--
-- **THAT RULE IS NOT BEING BROKEN, AND THIS MIGRATION IS NOT AN EXCEPTION TO IT.** The
-- distinction is between converting a stored label and QUALIFYING one:
--
--   CONVERTING   re-reading `11:00` as an instant and rendering it as `12:00` to somebody
--                east of the family. Forbidden. It would move every gathering in the product
--                by an offset nobody chose, in a diff that mentions only "adding a column".
--
--   QUALIFYING   recording that `11:00` was stated in `America/Chicago`, and printing
--                `11:00 AM CDT`. The label is untouched and authoritative; what it gains is
--                the fact that makes it unambiguous to a relative who is not local.
--
-- The second is strictly MORE information than a bare label, and it is what a printed
-- invitation actually says. So the display rule that comes with this column, and which the app
-- layer must keep:
--
--     11:00 AM CDT          <- what the family said. Always shown. Never converted.
--     1:00 PM your time     <- secondary, attributed, and only when the zones differ.
--
-- Inverting that — the viewer's time large, the stated time small — is what turns this back
-- into the forbidden thing. Two relatives on a telephone would then be reading different
-- numbers off the same screen with nothing saying which is the real one.
--
-- ── WHY IT IS ON `gatherings` AND NOT ON `gathering_occurrences` ─────────────────────
-- `20260826000001`'s rule is that `gathering_occurrences` is the ONLY place a date or a time
-- is WRITTEN, and this does not weaken it: a zone is not a date or a time, and one zone
-- covering every occurrence is not a second copy of any of them. A reunion in Austin is in
-- Austin on all three of its days.
--
-- Per-occurrence would buy a gathering whose Friday is in one city and whose Sunday is in
-- another. That is a roadshow, not a reunion, and nothing in the product asks for it.
--
-- ── THE CONSTRAINT IS ONE-DIRECTIONAL, WHICH LOOKS LIKE AN OVERSIGHT AND IS NOT ──────
--
--     CHECK (start_time IS NULL OR time_zone IS NOT NULL)
--
-- A time REQUIRES a zone. A zone with no time is permitted and inert. Both halves are
-- deliberate:
--
--   * **`NOT NULL DEFAULT 'America/Chicago'` was the obvious alternative and is the
--     `dues_member_plans.start_date` trap.** That column was `NOT NULL DEFAULT CURRENT_DATE`
--     and written by nothing, so every row held the date its plan row happened to be created
--     — "a column full of plausible dates that describe nothing, which is precisely what a
--     later change picks up and trusts". A zone on a date-only gathering ("the reunion is on
--     4 July", which is a real and complete answer) would be exactly that.
--
--   * **The reverse conjunct would fail on a row nobody touched.** `gatherings.start_time` is
--     the TRIGGER-MAINTAINED envelope over the occurrences. A family deleting their only
--     timed occasion would leave a zone with no time — and a two-directional check would
--     refuse that edit, or else force `tg_gathering_when_envelope` to become a second writer
--     of a column the author owns. Nothing reads the zone except code that is also reading a
--     time beside it, so a leftover is unreachable rather than misleading.
--
-- ── BACKFILLED, WHICH IS THE OPPOSITE OF WHAT 20260826000002 DOES ────────────────────
-- Every gathering that already has a time gets `America/Chicago`; every date-only gathering
-- stays NULL. That is admissible on one ground, stated rather than assumed: **no family is
-- using this product yet, so there is no row whose author had a different zone in mind.**
--
-- It is worth contrasting with `people.locale` in the migration before this one, which is
-- deliberately NOT backfilled. The difference is what the value qualifies. A locale qualifies
-- nothing — it is purely a choice somebody has or has not made, so a stored default would
-- erase the difference between "chose English" and "never looked". A zone qualifies a TIME
-- THAT ALREADY EXISTS in the row, so a timed row without one is an incomplete record, and
-- completing it removes an "unqualified time" state that every display site would otherwise
-- have to branch on forever.
--
-- If this ever runs against real data, the honest alternative is to leave those rows NULL and
-- carry the branch.
--
-- ── §2c: NO POLICY CHANGE, AND NONE IS NEEDED ────────────────────────────────────────
-- `gatherings` has exactly one policy — `perm:gatherings:select` — and no write policy at all,
-- which per §2c denies INSERT, UPDATE and DELETE to the browser outright. A new column on that
-- table is readable by whoever could already read the row and writable by nobody but the
-- service role. There is no grant to add (a column-level grant cannot narrow anything) and no
-- policy to recompose.
-- ═══════════════════════════════════════════════════════════════════════════════════════

-- ── 1. The column ─────────────────────────────────────────────────────────────────────

ALTER TABLE public.gatherings
  ADD COLUMN IF NOT EXISTS time_zone TEXT;

COMMENT ON COLUMN public.gatherings.time_zone IS
  'The IANA zone the gathering''s TIMES WERE STATED IN — not a zone to convert them into. '
  'NULL where no time was given. The stated time plus this zone is what every surface shows '
  'first; a viewer''s local equivalent is secondary and attributed. See this migration''s '
  'header, and 20260826000001 for why the times themselves are never converted.';

-- ── 2. Backfill, before the constraint that would otherwise refuse these rows ─────────
-- Order matters: the CHECK below requires a zone wherever there is a time, so a timed row
-- with no zone has to be filled first or the ALTER fails on existing data.

UPDATE public.gatherings
   SET time_zone = 'America/Chicago'
 WHERE start_time IS NOT NULL
   AND time_zone IS NULL;

-- ── 3. The constraint ─────────────────────────────────────────────────────────────────

ALTER TABLE public.gatherings DROP CONSTRAINT IF EXISTS gatherings_time_needs_zone;
ALTER TABLE public.gatherings
  ADD CONSTRAINT gatherings_time_needs_zone
  CHECK (start_time IS NULL OR time_zone IS NOT NULL);

-- ── 4. Verify ─────────────────────────────────────────────────────────────────────────

DO $mig$
DECLARE
  v_def       text;
  v_gathering uuid;
  v_family    text;
BEGIN
  -- 4a. Column and constraint exist, and the constraint is the ONE-DIRECTIONAL form. A
  -- two-directional version would refuse an edit that removes the last timed occurrence, so
  -- the shape is asserted rather than just the presence.
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
     WHERE table_schema = 'public' AND table_name = 'gatherings' AND column_name = 'time_zone'
  ) THEN
    RAISE EXCEPTION 'gatherings.time_zone was not created';
  END IF;

  SELECT pg_get_constraintdef(oid) INTO v_def
    FROM pg_constraint
   WHERE conrelid = 'public.gatherings'::regclass
     AND conname  = 'gatherings_time_needs_zone';

  IF v_def IS NULL THEN
    RAISE EXCEPTION 'gatherings_time_needs_zone is missing — a time could be stated with no zone';
  END IF;
  IF v_def NOT LIKE '%start_time IS NULL%' OR v_def NOT LIKE '%time_zone IS NOT NULL%' THEN
    RAISE EXCEPTION 'gatherings_time_needs_zone is not the expected form: %', v_def;
  END IF;

  -- 4b. NO ROW IS LEFT WITH A TIME AND NO ZONE. The constraint guarantees this going
  -- forward; this asserts the BACKFILL did its job, which the constraint cannot distinguish
  -- from there having been no such rows.
  IF EXISTS (
    SELECT 1 FROM public.gatherings WHERE start_time IS NOT NULL AND time_zone IS NULL
  ) THEN
    RAISE EXCEPTION 'a gathering still has a time with no zone — the backfill did not run';
  END IF;

  -- 4c. A DATE-ONLY GATHERING STILL HAS NO ZONE. The other direction, and the one that
  -- catches a well-meaning `SET time_zone = 'America/Chicago'` with no WHERE clause: that
  -- would leave a plausible zone on every row that has nothing for it to qualify, which is
  -- the trap the header names.
  IF EXISTS (
    SELECT 1 FROM public.gatherings WHERE start_time IS NULL AND time_zone IS NOT NULL
  ) THEN
    RAISE EXCEPTION
      'a gathering with no time was given a zone — the backfill was too wide. A zone that '
      'qualifies nothing is the dues_member_plans.start_date trap.';
  END IF;

  -- 4d. THE TIMES THEMSELVES ARE UNTOUCHED. The whole promise of this migration, asserted
  -- rather than trusted: adding a qualifier must not have rewritten a single stored label.
  -- Checked as a real probe, because "the UPDATE above has no time in its SET list" is a
  -- reading of the file and not a fact about the database.
  SELECT g.id, g.family_code INTO v_gathering, v_family
    FROM public.gatherings g
   WHERE g.start_time IS NOT NULL
   LIMIT 1;

  IF v_gathering IS NULL THEN
    -- A skip must be VISIBLE, never silent (20260806000012). An empty local database is the
    -- ordinary case for this file, so there is nothing wrong here — but it is said out loud.
    RAISE NOTICE 'no timed gathering exists, so the label-preservation probe did not run';
  ELSE
    IF NOT EXISTS (
      SELECT 1
        FROM public.gatherings g
        JOIN public.gathering_occurrences o ON o.gathering_id = g.id
       WHERE g.id = v_gathering
         AND g.start_time = (
               SELECT o2.start_time FROM public.gathering_occurrences o2
                WHERE o2.gathering_id = g.id AND o2.start_time IS NOT NULL
                ORDER BY o2.starts_on, o2.start_time LIMIT 1)
    ) THEN
      RAISE EXCEPTION
        'the envelope no longer matches its occurrences — a stored time was altered';
    END IF;
    RAISE NOTICE 'label-preservation probe passed on gathering % (family %)',
      v_gathering, v_family;
  END IF;

  -- 4e. AND THE RULE THIS MIGRATION MUST NOT HAVE BROKEN, asserted against the schema
  -- itself: the times are still `time`, not `timestamptz`. Converting them is the one thing
  -- 20260826000001's header forbids, and it would be a plausible-looking next step for
  -- somebody who read this column as permission to start converting.
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
     WHERE table_schema = 'public' AND table_name = 'gatherings'
       AND column_name IN ('start_time', 'end_time')
       AND data_type <> 'time without time zone'
  ) THEN
    RAISE EXCEPTION
      'a gathering time is no longer a bare TIME. These are wall-clock labels and must never '
      'become instants — see 20260826000001.';
  END IF;

  RAISE NOTICE 'gatherings.time_zone added; % timed gathering(s) qualified, % date-only left NULL',
    (SELECT count(*) FROM public.gatherings WHERE start_time IS NOT NULL),
    (SELECT count(*) FROM public.gatherings WHERE start_time IS NULL);
END $mig$;
