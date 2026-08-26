-- ═══════════════════════════════════════════════════════════════════════════════════════
-- WHERE THE FAMILY IS, FOR THE QUESTIONS EVERY MEMBER MUST GET THE SAME ANSWER TO
-- ═══════════════════════════════════════════════════════════════════════════════════════
--
-- Phase 2 settled that a member has a timezone and that an author states the zone a TIME is
-- written in. Both are right, and neither can answer a third kind of question that turned out
-- to be everywhere:
--
--     is this gathering over?          is this task overdue?       how many are upcoming?
--
-- ── WHY NEITHER EXISTING ZONE ANSWERS IT ─────────────────────────────────────────────
-- **The reader's zone is the WORST answer for the one person it matters to.** A cousin in
-- Tokyo asking "is the Austin reunion over" would be told yes while it is still Sunday evening
-- in Austin. For a family in one place every candidate agrees; they differ exactly for the
-- relative who moved away, which is the case worth being right about.
--
-- **The gathering's own stated zone is right and applies to a minority of rows.** A zone is
-- recorded only where a TIME is given (`gatherings_time_needs_zone`), and most gatherings are a
-- date alone — so one list would judge some gatherings in their own zone and others in a
-- fallback, with nothing on screen saying which.
--
-- **And these are family-wide judgements**: two members must not disagree about whether a
-- deadline has passed. That is the same argument `20260826000005` makes about an election
-- closing date, and this column is what lets that function stop hard-coding Central.
--
-- ── THE ACTUAL BUG BEING FIXED, WHICH IS NOT SUBTLE ──────────────────────────────────
-- `todayLocal()` reads whatever zone the process is in. In a browser that is the member's and
-- is correct; on the SERVER it is UTC, which rolls over to tomorrow at 7pm Central. So for the
-- last five hours of every day the server believes it is already tomorrow, and:
--
--   * a gathering reads **"Past" while the family is at it** — an evening picnic on the 26th is
--     filed as over at 19:00 on the 26th
--   * a task due today reads **"Overdue" five hours early**, which is the election bug's twin
--
-- ── `NOT NULL DEFAULT`, WHICH IS THE OPPOSITE OF THE LAST TWO ZONE COLUMNS ───────────
-- `gatherings.time_zone` and `meeting_sessions.time_zone` are NULLABLE, and this one is not.
-- That is not an inconsistency; the three columns answer different questions:
--
--   a gathering's zone   QUALIFIES A TIME THAT MAY NOT EXIST. A date-only gathering has
--                        nothing for it to qualify, so a stored value there would be the
--                        `dues_member_plans.start_date` trap — a plausible value nothing reads.
--
--   a family's zone      IS ALWAYS NEEDED AND ALWAYS MEANINGFUL. Every family is somewhere, and
--                        every family-wide date judgement needs an answer today. A nullable
--                        column would put a `?? DEFAULT_ZONE` at every one of a dozen call
--                        sites, which is a fallback repeated rather than a decision recorded.
--
-- It is a SETTING with a sensible default, exactly as `families.tier` is — `NOT NULL DEFAULT`,
-- changeable by an administrator, and the default is honest rather than a guess dressed up: the
-- product's families are US-centred and Central is the most populous US zone.
--
-- ── AND IT IS NOT GUARDED, WHICH IS ALSO DELIBERATE ──────────────────────────────────
-- `families` carries three guard triggers — `families_guard_family_code`,
-- `families_guard_tier` and `families_guard_removal` — each refusing the `authenticated` role
-- because the UPDATE policy admits an administrator's write and a policy has no opinion about
-- WHICH column changed. This column gets no such guard, and the distinction is the point:
--
--   guarded      an immutable identity, a BILLING fact, a disable switch. Things an
--                administrator must not be able to set by posting to an endpoint.
--   not guarded  ordinary configuration. A family that moves, or that was defaulted wrongly,
--                should be able to fix this from `/admin/family` like their own name.
--
-- So `setFamilyZone` writes it through the USER client under `admin/family:edit`, the same path
-- `renameFamily` takes, and the composed UPDATE policy is what authorizes it.
-- ═══════════════════════════════════════════════════════════════════════════════════════

-- ── A. The column ─────────────────────────────────────────────────────────────────────
-- No CHECK, matching `elections.time_zone` and for the same reason: the valid set is the
-- runtime's tz database rather than a list this product maintains. `isValidZone` in
-- `lib/tz.ts` validates at the write boundary, and every reader coerces an unusable value to
-- Central rather than erroring — which is the right failure direction for a value consulted on
-- every page that shows a date.

ALTER TABLE public.families
  ADD COLUMN IF NOT EXISTS time_zone TEXT NOT NULL DEFAULT 'America/Chicago';

COMMENT ON COLUMN public.families.time_zone IS
  'Where the family is, for the date questions every member must get the SAME answer to: is '
  'this gathering over, is this task overdue, how many are upcoming, and when an election '
  'window closes. NOT NULL with a default because a family is always somewhere and every one '
  'of those questions needs an answer — unlike gatherings.time_zone, which qualifies a time '
  'that may not exist. Deliberately NOT guarded: ordinary configuration an administrator may '
  'fix from /admin/family, unlike tier, status and family_code. See this migration''s header.';

-- ── B. `election_window_open` stops hard-coding Central ───────────────────────────────
-- `20260826000005` wrote `COALESCE(e.time_zone, 'America/Chicago')` because there was nothing
-- better to fall back to. There is now: an election with no zone of its own belongs to a family
-- that has one, and reading it is strictly closer to what the family means.
--
-- The literal stays as the LAST resort. `families.time_zone` is NOT NULL so the second branch
-- should be unreachable — and a `COALESCE` whose final arm is a constant is what keeps this
-- expression from ever evaluating to NULL, which is the one failure mode that would read as
-- "the window is closed forever" (measured: it takes ten RLS assertions with it).
--
-- Everything else is byte-identical to 20260826000005's version, including the same-day
-- handover clause and its comment.

CREATE OR REPLACE FUNCTION public.election_window_open(
  p_election_id uuid,
  p_window      text
)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_family text := public.auth_family_code();
  e        record;
  v_today  date;
  v_zone   text;
BEGIN
  IF p_election_id IS NULL OR v_family IS NULL OR v_family = '' THEN
    RETURN false;
  END IF;

  SELECT status, family_code, time_zone,
         nominations_open_on, nominations_close_on, voting_open_on, voting_close_on
    INTO e
    FROM public.elections WHERE id = p_election_id;
  IF NOT FOUND OR e.family_code IS DISTINCT FROM v_family THEN
    RETURN false;
  END IF;

  -- A draft is not open for anything, whatever its dates say. That is what a draft IS.
  IF e.status <> 'published' THEN
    RETURN false;
  END IF;

  -- THE ELECTION'S OWN ZONE, THEN THE FAMILY'S, THEN CENTRAL. The database's own date is what
  -- this used before 20260826000005 and it is UTC on hosted Supabase, which cut a Central-time
  -- family off at 19:00 on their closing day. The family fallback arrived with
  -- 20260826000006; the literal is last so the expression can never be NULL, which would read
  -- as a window closed forever.
  SELECT f.time_zone INTO v_zone
    FROM public.families f WHERE f.family_code = e.family_code;
  v_today := (now() AT TIME ZONE
                COALESCE(e.time_zone, v_zone, 'America/Chicago'))::date;

  -- BETWEEN is inclusive on both ends, which is the close-date rule stated in 20260821000001
  -- PART A: the last day anybody may act is the close date itself.
  --
  -- THE SECOND CLAUSE IS THE SAME-DAY HANDOVER, 2026-08-22. Where voting opens ON the closing
  -- day, nominations are shut for that day: `voting_open_on` may now equal
  -- `nominations_close_on`, and the ballot must never be live while the slate can change.
  -- `lib/election-phase.ts` answers `voting` for that day and this refuses the write, which is
  -- the two halves agreeing rather than the database being merely the looser of the two.
  IF p_window = 'nominations' THEN
    RETURN e.nominations_open_on IS NOT NULL AND e.nominations_close_on IS NOT NULL
       AND v_today BETWEEN e.nominations_open_on AND e.nominations_close_on
       AND (e.voting_open_on IS NULL OR v_today < e.voting_open_on);
  END IF;
  IF p_window = 'voting' THEN
    RETURN e.voting_open_on IS NOT NULL AND e.voting_close_on IS NOT NULL
       AND v_today BETWEEN e.voting_open_on AND e.voting_close_on;
  END IF;

  -- An unrecognized window name is not a window. Fails closed rather than defaulting to one
  -- of the two, because guessing which would be a guess about a ballot.
  RETURN false;
END $$;

-- §2b: `CREATE OR REPLACE` keeps the existing ACL, so this is a restatement. Worth making for
-- 20260822000015's reason: a future `DROP FUNCTION … CREATE` here would silently drop the grant
-- and every nomination and vote policy that calls this would ERROR rather than refuse.
REVOKE ALL ON FUNCTION public.election_window_open(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.election_window_open(uuid, text) TO authenticated;

-- ── C. Verify ─────────────────────────────────────────────────────────────────────────

DO $mig$
DECLARE
  v_src  text;
  v_null integer;
BEGIN
  -- C1. The column exists, is NOT NULL, and every family has a real zone.
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
     WHERE table_schema = 'public' AND table_name = 'families' AND column_name = 'time_zone'
       AND is_nullable = 'NO'
  ) THEN
    RAISE EXCEPTION 'families.time_zone is missing or nullable — every family needs a zone';
  END IF;

  SELECT count(*) INTO v_null FROM public.families
   WHERE time_zone IS NULL OR btrim(time_zone) = '';
  IF v_null > 0 THEN
    RAISE EXCEPTION '% family/families have no usable zone', v_null;
  END IF;

  -- C2. IT IS NOT GUARDED, and that is asserted rather than merely intended. Three sibling
  -- columns on this table ARE guarded against the `authenticated` role, so the natural next
  -- edit is a fourth guard — which would silently break `setFamilyZone`, an administrator
  -- action that deliberately writes on the USER client. If a guard is ever wanted here, that
  -- action has to move to the service role in the same commit.
  IF EXISTS (
    SELECT 1 FROM pg_trigger t
     WHERE t.tgrelid = 'public.families'::regclass
       AND NOT t.tgisinternal
       AND pg_get_triggerdef(t.oid) ILIKE '%time_zone%'
  ) THEN
    RAISE EXCEPTION
      'a trigger on families now names time_zone. This column is ordinary configuration and '
      'setFamilyZone writes it on the USER client — a guard here refuses that write. See the '
      'header, and move the action to the service role first if a guard is really wanted.';
  END IF;

  -- C3. The window function reads the family's zone, and still cannot evaluate to NULL.
  -- Comments stripped, for the reason 20260826000005's verify block records: `prosrc` includes
  -- them, and the comment above `v_today` names the old expression while explaining its removal.
  SELECT regexp_replace(prosrc, '--[^\n]*', '', 'g') INTO v_src
    FROM pg_proc
   WHERE oid = 'public.election_window_open(uuid, text)'::regprocedure;

  IF v_src ~ 'CURRENT_DATE' THEN
    RAISE EXCEPTION 'election_window_open regressed to CURRENT_DATE, which is UTC on hosted';
  END IF;
  IF v_src !~ 'COALESCE\(e\.time_zone, v_zone' THEN
    RAISE EXCEPTION
      'election_window_open does not fall back to the family zone before the literal';
  END IF;
  IF v_src !~ 'FROM public\.families' THEN
    RAISE EXCEPTION 'election_window_open does not read families.time_zone at all';
  END IF;
  -- The last arm must stay a CONSTANT. `families.time_zone` is NOT NULL so `v_zone` should
  -- always answer — but a missing families row (a deleted family with a surviving election)
  -- would leave it NULL, and `now() AT TIME ZONE NULL` is NULL, and `NULL BETWEEN …` reads as a
  -- window closed forever. Measured on the previous migration: that shape costs ten assertions
  -- and every attack half stays green, because a function refusing everybody is perfectly
  -- isolated.
  IF v_src !~ '''America/Chicago''\)\)::date' THEN
    RAISE EXCEPTION
      'election_window_open no longer ends its COALESCE in a constant — the expression can '
      'evaluate to NULL, which reads as a window closed forever';
  END IF;

  -- C4. 20260822000015's three guarantees and the draft guard, re-asserted. A repair that
  -- drops its predecessor's assertions is how the same-day handover gets undone by accident.
  IF v_src !~ 'v_today < e\.voting_open_on' THEN
    RAISE EXCEPTION 'election_window_open(''nominations'') is open on the day voting opens';
  END IF;
  IF v_src ~ 'voting_open_on\s*-\s*1' THEN
    RAISE EXCEPTION 'election_window_open(''nominations'') closed a day early';
  END IF;
  IF v_src !~ 'e\.voting_open_on IS NULL OR' THEN
    RAISE EXCEPTION 'election_window_open(''nominations'') refuses a draft-shaped row';
  END IF;
  IF v_src !~ 'e\.status <> ''published''' THEN
    RAISE EXCEPTION 'election_window_open no longer refuses a draft';
  END IF;

  -- C5. Still reachable from the browser, still not from anon (§2b rule 2).
  IF NOT has_function_privilege('authenticated',
        'public.election_window_open(uuid, text)', 'EXECUTE') THEN
    RAISE EXCEPTION 'authenticated lost EXECUTE on election_window_open';
  END IF;
  IF has_function_privilege('anon',
        'public.election_window_open(uuid, text)', 'EXECUTE') THEN
    RAISE EXCEPTION 'anon has EXECUTE on election_window_open';
  END IF;

  RAISE NOTICE 'families.time_zone added; % family/families, all with a zone',
    (SELECT count(*) FROM public.families);
END $mig$;
