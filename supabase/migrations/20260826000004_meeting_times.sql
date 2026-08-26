-- ═══════════════════════════════════════════════════════════════════════════════════════
-- A MEETING HAPPENS AT A TIME, AND THE TIME IS STATED IN A ZONE
-- ═══════════════════════════════════════════════════════════════════════════════════════
--
-- `meeting_sessions` has held `meets_on date NOT NULL` and nothing else since
-- `20260822000019`, so a meeting has been a DAY. That was defensible when minutes were the
-- point and the date was all anybody filed them under, and it stopped being defensible the
-- moment the scheduling wizard grew an audience step: a family being invited to a meeting
-- needs to know when to be there.
--
-- ── IT IS THE SAME SHAPE AS A GATHERING'S TIME, DELIBERATELY ─────────────────────────
-- Three columns, the same three constraints, and the same rule about what they mean:
--
--   `start_time`  a WALL-CLOCK LABEL. Two o'clock where the meeting is. Never converted.
--   `end_time`    optional, and only with a start.
--   `time_zone`   the zone the labels were STATED in, so a relative who is not local can
--                 read them without guessing.
--
-- `20260826000003` argues the qualify-versus-convert distinction at length and every word of
-- it applies here. The short version: the stated time is always primary on screen and a
-- viewer's local equivalent is secondary and attributed. Inverting that is the forbidden
-- thing.
--
-- ── THE TIME IS OPTIONAL, WHICH IS A PRODUCT DECISION AND NOT A SCHEMA CONVENIENCE ───
-- `meets_on` is `NOT NULL` because a meeting with no date is not scheduled. A meeting with no
-- HOUR is perfectly ordinary — a family fixing the date first and the time later — and the
-- scheduling wizard's step 1 therefore asks for a time without requiring one. Requiring it
-- would block scheduling with nothing useful to say about why.
--
-- ── THE ORDERING CHECK IS SIMPLER THAN A GATHERING'S, AND THAT IS WHY IT IS SEPARATE ─
-- `gathering_occurrences_times_ordered` carries a cross-day exemption, because Friday 18:00 to
-- Sunday 11:00 is an ordinary reunion and only an end BEFORE the start ON THE SAME DAY is a
-- mistake. A meeting has one date, so there is no such case: an end time before its start is
-- always wrong, and the constraint says so without the exemption. Copying the gathering's
-- version would have imported a branch that can never be taken and would have read as though
-- a meeting could span days.
--
-- ── §2c AGAIN: NO POLICY CHANGE ──────────────────────────────────────────────────────
-- The five meeting tables carry SELECT policies and NO write policy at all, so per §2c the
-- browser is denied INSERT, UPDATE and DELETE outright and every write goes through
-- `app/actions/meetings.ts` on the service role with `.eq('family_code', …)` by hand. New
-- columns on `meeting_sessions` are readable by whoever could read the row and writable by
-- nobody else. Nothing to grant, nothing to recompose.
-- ═══════════════════════════════════════════════════════════════════════════════════════

-- ── 1. The columns ────────────────────────────────────────────────────────────────────

ALTER TABLE public.meeting_sessions
  ADD COLUMN IF NOT EXISTS start_time TIME,
  ADD COLUMN IF NOT EXISTS end_time   TIME,
  ADD COLUMN IF NOT EXISTS time_zone  TEXT;

COMMENT ON COLUMN public.meeting_sessions.start_time IS
  'A WALL-CLOCK LABEL, never an instant — two o''clock where the meeting is. NULL is a real '
  'answer (the date is fixed, the hour is not) rather than a missing one. Never converted '
  'between zones; see 20260826000001 and 20260826000003.';
COMMENT ON COLUMN public.meeting_sessions.end_time IS
  'Optional, and only meaningful with a start. A meeting is one day, so an end time before '
  'its start is always a mistake — unlike a gathering, which may legitimately run overnight.';
COMMENT ON COLUMN public.meeting_sessions.time_zone IS
  'The IANA zone the times WERE STATED IN — not a zone to convert them into. NULL where no '
  'time was given. Required wherever a start time exists.';

-- ── 2. The three constraints ──────────────────────────────────────────────────────────
-- Dropped and re-added so a re-run replaces rather than silently keeping an older form.

ALTER TABLE public.meeting_sessions
  DROP CONSTRAINT IF EXISTS meeting_sessions_end_time_needs_start;
ALTER TABLE public.meeting_sessions
  ADD CONSTRAINT meeting_sessions_end_time_needs_start
  -- "Ends at 4pm" with no start is half an answer and nothing can render it usefully. Same
  -- rule `gathering_occurrences_end_time_needs_start` states.
  CHECK (end_time IS NULL OR start_time IS NOT NULL);

ALTER TABLE public.meeting_sessions
  DROP CONSTRAINT IF EXISTS meeting_sessions_times_ordered;
ALTER TABLE public.meeting_sessions
  ADD CONSTRAINT meeting_sessions_times_ordered
  -- NO CROSS-DAY EXEMPTION, unlike a gathering's. `meets_on` is a single date, so there is no
  -- overnight case for an exemption to admit.
  CHECK (start_time IS NULL OR end_time IS NULL OR end_time > start_time);

ALTER TABLE public.meeting_sessions
  DROP CONSTRAINT IF EXISTS meeting_sessions_time_needs_zone;
ALTER TABLE public.meeting_sessions
  ADD CONSTRAINT meeting_sessions_time_needs_zone
  -- One-directional, for the reason 20260826000003 gives: a zone on a meeting with no time
  -- would be a plausible value qualifying nothing.
  CHECK (start_time IS NULL OR time_zone IS NOT NULL);

-- ── 3. No backfill, and there is nothing to backfill ──────────────────────────────────
-- Unlike `gatherings`, no existing row has a time for a zone to qualify — the columns did not
-- exist a moment ago. Every meeting is date-only until somebody edits it, which is exactly
-- what those meetings are.

-- ── 4. Verify ─────────────────────────────────────────────────────────────────────────

DO $mig$
DECLARE
  v_family text;
  v_person uuid;
  v_ok     boolean;
BEGIN
  -- 4a. Three columns, right types. `time without time zone` is asserted BY NAME because the
  -- one thing that must never happen to these is becoming `timestamptz`.
  IF (
    SELECT count(*) FROM information_schema.columns
     WHERE table_schema = 'public' AND table_name = 'meeting_sessions'
       AND column_name IN ('start_time', 'end_time')
       AND data_type = 'time without time zone'
  ) <> 2 THEN
    RAISE EXCEPTION
      'meeting_sessions start_time/end_time are not bare TIME columns. They are wall-clock '
      'labels and must never become instants.';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
     WHERE table_schema = 'public' AND table_name = 'meeting_sessions'
       AND column_name = 'time_zone'
  ) THEN
    RAISE EXCEPTION 'meeting_sessions.time_zone was not created';
  END IF;

  -- 4b. All three constraints exist.
  FOR v_family IN
    SELECT unnest(ARRAY[
      'meeting_sessions_end_time_needs_start',
      'meeting_sessions_times_ordered',
      'meeting_sessions_time_needs_zone'
    ])
  LOOP
    IF NOT EXISTS (
      SELECT 1 FROM pg_constraint
       WHERE conrelid = 'public.meeting_sessions'::regclass AND conname = v_family
    ) THEN
      RAISE EXCEPTION 'constraint % is missing', v_family;
    END IF;
  END LOOP;

  -- 4c. THE ORDERING CHECK HAS NO CROSS-DAY EXEMPTION. Asserted on the text, because copying
  -- the gathering's version is the obvious thing to do and it would admit an end before its
  -- start on the only day a meeting has.
  IF pg_get_constraintdef((
        SELECT oid FROM pg_constraint
         WHERE conrelid = 'public.meeting_sessions'::regclass
           AND conname  = 'meeting_sessions_times_ordered')) LIKE '%ends_on%' THEN
    RAISE EXCEPTION
      'meeting_sessions_times_ordered carries a cross-day exemption. A meeting has one date, '
      'so that branch is unreachable and it reads as though a meeting could span days.';
  END IF;

  -- 4d. THE CONSTRAINTS ACTUALLY REFUSE. Three probes against a real row, because asserting
  -- that a constraint EXISTS says nothing about what it admits. Each runs inside its own
  -- plpgsql BEGIN … EXCEPTION block — an implicit subtransaction — so a refusal unwinds
  -- without taking the migration with it.
  --
  -- The fixture needs a family and a person to satisfy the table's own NOT NULLs and foreign
  -- keys. Where the local database has none, the probes are SKIPPED OUT LOUD rather than
  -- silently: 20260806000012 shipped a verify block that returned early with no fixture and
  -- reported success over a function that could not run.
  SELECT p.family_code, p.id INTO v_family, v_person
    FROM public.people p
   ORDER BY p.created_at
   LIMIT 1;

  IF v_family IS NULL THEN
    RAISE NOTICE
      'no people row exists, so the three constraint probes did not run. The constraints are '
      'asserted to EXIST but not to REFUSE.';
  ELSE
    -- (i) an end time with no start
    v_ok := false;
    BEGIN
      INSERT INTO public.meeting_sessions (family_code, title, meets_on, secretary_id, end_time)
      VALUES (v_family, 'probe: end with no start', CURRENT_DATE, v_person, '16:00');
    EXCEPTION WHEN check_violation THEN v_ok := true;
    END;
    IF NOT v_ok THEN
      RAISE EXCEPTION 'meeting_sessions_end_time_needs_start admitted an end time with no start';
    END IF;

    -- (ii) an end before its start
    v_ok := false;
    BEGIN
      INSERT INTO public.meeting_sessions
        (family_code, title, meets_on, secretary_id, start_time, end_time, time_zone)
      VALUES (v_family, 'probe: end before start', CURRENT_DATE, v_person,
              '14:00', '09:00', 'America/Chicago');
    EXCEPTION WHEN check_violation THEN v_ok := true;
    END;
    IF NOT v_ok THEN
      RAISE EXCEPTION 'meeting_sessions_times_ordered admitted an end time before its start';
    END IF;

    -- (iii) a time with no zone
    v_ok := false;
    BEGIN
      INSERT INTO public.meeting_sessions
        (family_code, title, meets_on, secretary_id, start_time)
      VALUES (v_family, 'probe: time with no zone', CURRENT_DATE, v_person, '14:00');
    EXCEPTION WHEN check_violation THEN v_ok := true;
    END;
    IF NOT v_ok THEN
      RAISE EXCEPTION 'meeting_sessions_time_needs_zone admitted a time with no zone';
    END IF;

    -- (iv) AND THE LEGITIMATE ROW IS ADMITTED. Without this the three above would pass just
    -- as well against a table that refused everything — which is the shape AGENTS.md §7 calls
    -- the positive control, and it has caught more real defects in this codebase than the
    -- attack halves have.
    BEGIN
      INSERT INTO public.meeting_sessions
        (family_code, title, meets_on, secretary_id, start_time, end_time, time_zone)
      VALUES (v_family, 'probe: a valid meeting', CURRENT_DATE, v_person,
              '14:00', '15:30', 'America/Chicago');
      DELETE FROM public.meeting_sessions WHERE title = 'probe: a valid meeting';
    EXCEPTION WHEN others THEN
      RAISE EXCEPTION
        'a well-formed timed meeting was REFUSED (%). The constraints are too strict.', SQLERRM;
    END;

    RAISE NOTICE 'all three constraints refuse, and a valid timed meeting is admitted';
  END IF;

  -- 4e. Nothing was invented on existing rows.
  IF EXISTS (SELECT 1 FROM public.meeting_sessions WHERE time_zone IS NOT NULL) THEN
    RAISE EXCEPTION
      'a meeting was given a zone with no time to qualify — nothing here backfills';
  END IF;

  RAISE NOTICE 'meeting_sessions gained start_time, end_time and time_zone; % session(s), all date-only',
    (SELECT count(*) FROM public.meeting_sessions);
END $mig$;
