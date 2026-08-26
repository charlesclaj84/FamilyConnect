-- ═══════════════════════════════════════════════════════════════════════════════════════
-- AN ELECTION CLOSES AT THE END OF ITS CLOSING DAY — IN THE FAMILY'S OWN ZONE
-- ═══════════════════════════════════════════════════════════════════════════════════════
--
-- **THIS FIXES A LIVE BUG, and it is the only one of the four Phase 2 migrations that does.**
-- The other three add a fact. This one corrects an answer the database has been giving wrongly
-- since elections shipped.
--
-- ── THE BUG, MEASURED ────────────────────────────────────────────────────────────────
-- `election_window_open()` decides whether a nomination or a vote may be written, and it does
-- it with `CURRENT_DATE BETWEEN …`. `CURRENT_DATE` is the DATABASE's date, and on Supabase the
-- database runs in **UTC**. So for a family in Central time:
--
--   an election closing 15 August    voting stops at 19:00 CDT on the 15th — five hours of
--                                    the closing day gone
--   nominations opening 1 August     open from 19:00 CDT on 31 July — five hours early
--
-- A member with the ballot in front of them, hours before the deadline the screen shows, is
-- refused. And they are refused BY AN RLS POLICY: this function is what `election_votes` and
-- `election_nominations` compose into their write policies, so the failure is not a form
-- validation somebody can explain away — it is the database declining the row.
--
-- ── WHY THE FIX IS BOTH HALVES OR NEITHER ────────────────────────────────────────────
-- `lib/election-phase.ts` computes the phase in TypeScript and takes `today` as a parameter,
-- and every caller passes `todayLocal()`. On a server component that reads the RUNTIME's zone,
-- which is also UTC — so **today the two halves agree, and they agree on the wrong answer.**
--
-- That is the thing to be careful about: repairing only the SQL would make the screen say
-- "voting is open" while the policy refused the write, which is strictly worse than both being
-- wrong together. It is the exact divergence AGENTS.md warns about for `auth_family_code()`
-- and `lib/auth/family.ts` — "the app and the policies would then disagree". So the TypeScript
-- change lands in the same commit as this file, and `electionPhase` is passed
-- `todayIn(election.time_zone)` rather than `todayLocal()`.
--
-- ── AND THE ZONE IS THE ELECTION'S, NEVER THE READER'S ───────────────────────────────
-- THE ONE PLACE IN THIS WHOLE LOCALIZATION EFFORT WHERE "the reader's zone" IS THE WRONG
-- ANSWER, and it is worth stating because every other surface goes the other way.
--
-- A deadline is a family-wide fact. If it resolved per viewer, two members would disagree
-- about whether the ballot was open — and the one whose browser said open would be refused by
-- a policy evaluating somebody else's midnight. Worse, a member could choose their own
-- deadline by changing their profile.
--
-- So: `elections.time_zone` is a property of the ELECTION, set when it is scheduled, and both
-- halves resolve against it. `created_at` on a ledger row is read in the READER's zone;
-- whether voting is open is not. The two rules are not in tension — they are about different
-- kinds of fact.
--
-- ── THE WINDOWS STAY `DATE`. NO TIME OF DAY ON A DEADLINE ────────────────────────────
-- A decision rather than an omission. "Voting closes on the 15th" reading as the end of the
-- 15th in the family's own zone is what a family means, and it is exactly what the zone buys.
-- Adding a `voting_close_at TIME` would be a second fact for the first to disagree with, and
-- `20260821000001` already retired a `timestamptz` pair in favour of these dates.
--
-- ── WHAT TESTS THIS, AND WHAT NOTHING TESTS ──────────────────────────────────────────
-- `tests/rls/raw/elections.mjs` -> `electionWindowOpen` calls this function as a real member
-- through the real grant, and `cases.mjs` carries two cases over it. MUTATION-CHECKED: with
-- `COALESCE(e.time_zone, …)` removed, **10 assertions go red and every attack half stays
-- green** — because the fixture seeds elections with a NULL zone, so a bare `e.time_zone`
-- makes `v_today` NULL, `BETWEEN` answers NULL, and the window reads as closed for everybody.
-- A function that refuses all comers is perfectly isolated, which is §7's argument for the
-- control half measured one more time.
--
-- **NOTHING TESTS THAT THIS READS THE ELECTION'S ZONE RATHER THAN UTC**, and that is stated
-- rather than left to be assumed. `now()` cannot be overridden from a client, so the only
-- variable a probe can move is the zone — and a deterministic zone discriminator needs an
-- election whose window boundary is TODAY, which would then be the soonest-closing election in
-- the fixture and would take the Dashboard's Quick Actions cases with it. What carries that
-- half instead: §D5 below proves `AT TIME ZONE` changes the calendar date at this instant, §D2
-- proves `CURRENT_DATE` is gone from the body, and `lib/election-phase.test.ts` proves the
-- TypeScript half that has to agree with this function.
--
-- ── THE `20260822000015` ASSERTIONS ──────────────────────────────────────────────────
-- That migration asserts on the SOURCE TEXT of this function — `v_src !~ 'CURRENT_DATE <
-- e\.voting_open_on'` among them — so replacing `CURRENT_DATE` here would break its verify
-- block if it ever ran again. It cannot: `db push` keys off the version and it is already
-- applied, and on a fresh `db reset` it runs BEFORE this file and asserts against its own
-- version. **The obligation that does transfer is to re-assert the new form**, which §C below
-- does, in the same shape and for the same three properties. A repair that silently drops its
-- predecessor's guarantees is how the same-day handover gets undone by accident.
-- ═══════════════════════════════════════════════════════════════════════════════════════

-- ── A. The column ─────────────────────────────────────────────────────────────────────
-- No CHECK, unlike `people.locale`: this is an IANA zone name, and the set of valid ones is
-- the runtime's tz database rather than a list this product maintains. The app validates
-- through `isValidZone` in `lib/tz.ts` and the resolver below coalesces, so an unusable value
-- degrades to Central rather than erroring inside a policy — which is the right failure
-- direction for an expression evaluated on every read of a ballot.

ALTER TABLE public.elections
  ADD COLUMN IF NOT EXISTS time_zone TEXT;

COMMENT ON COLUMN public.elections.time_zone IS
  'The IANA zone this election''s window DATES are read in — whose midnight ends the closing '
  'day. A property of the ELECTION and never of the reader: a deadline that resolved per '
  'viewer would let two members disagree about whether the ballot is open, and would let a '
  'member move their own deadline by editing their profile. NULL falls back to '
  'America/Chicago in election_window_open() and in lib/election-phase.ts callers, which must '
  'stay in step. See this migration''s header.';

-- ── B. Backfill ───────────────────────────────────────────────────────────────────────
-- EVERY election, not just some, and this one is unlike 20260826000003's conditional backfill:
-- there is no such thing as an election without windows for a zone to qualify — the dates are
-- what an election IS. So the column is filled for every row and the fallback in the function
-- exists only for a row written before this migration reaches a hosted database.
--
-- Admissible because no family is using this product yet. With real data the honest move is to
-- ask each family and leave the rest on the documented fallback.

UPDATE public.elections
   SET time_zone = 'America/Chicago'
 WHERE time_zone IS NULL;

-- ── C. The repair ─────────────────────────────────────────────────────────────────────
-- One expression changed, twice in the nominations branch and once in the voting branch:
--
--     CURRENT_DATE
--  →  (now() AT TIME ZONE COALESCE(e.time_zone, 'America/Chicago'))::date
--
-- `now() AT TIME ZONE <zone>` yields a bare `timestamp` holding the wall-clock reading in that
-- zone; casting to `date` is that zone's current calendar date. It is resolved ONCE into a
-- local variable rather than written three times, so the two clauses of the nominations branch
-- cannot straddle midnight and disagree with each other — a real hazard, because this function
-- is `STABLE` per statement but the expression would otherwise be evaluated separately in each
-- clause.
--
-- Everything else is byte-identical to 20260822000015's version, including the same-day
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

  -- TODAY IN THE ELECTION'S OWN ZONE, not the database's. `CURRENT_DATE` is UTC on a hosted
  -- Supabase, so it cut a Central-time family off at 19:00 on their closing day and opened
  -- nominations five hours early. Resolved once, so the two clauses below cannot straddle
  -- midnight and disagree.
  v_today := (now() AT TIME ZONE COALESCE(e.time_zone, 'America/Chicago'))::date;

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

-- §2b: `CREATE OR REPLACE` keeps the existing ACL, so this is a restatement rather than a
-- repair — and it is worth making for the reason 20260822000015 gives: a future
-- `DROP FUNCTION … CREATE` in this position would silently drop the grant, and every nomination
-- and vote policy that calls this would then ERROR rather than refuse.
REVOKE ALL ON FUNCTION public.election_window_open(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.election_window_open(uuid, text) TO authenticated;

-- ── D. Verify ─────────────────────────────────────────────────────────────────────────

DO $mig$
DECLARE
  v_src text;
BEGIN
  -- D1. The column exists and every election has a zone.
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
     WHERE table_schema = 'public' AND table_name = 'elections' AND column_name = 'time_zone'
  ) THEN
    RAISE EXCEPTION 'elections.time_zone was not created';
  END IF;
  IF EXISTS (SELECT 1 FROM public.elections WHERE time_zone IS NULL) THEN
    RAISE EXCEPTION 'an election has no zone — the backfill did not run';
  END IF;

  -- THE BODY WITH ITS COMMENTS STRIPPED, and this is not fastidiousness — the first run of
  -- this verify block FAILED on itself. `prosrc` is the whole body including comments, and the
  -- comment above `v_today` explains the repair by naming `CURRENT_DATE`, so the D2 assertion
  -- below matched the documentation of the fix and reported the bug as still present.
  --
  -- Rewording the comment would have worked once and rotted the moment somebody mentioned the
  -- old expression again while explaining why it is gone. Stripping is the durable answer, and
  -- it is the same lesson `scripts/time-display.mjs` learned about doc comments discussing the
  -- patterns it searches for.
  SELECT regexp_replace(prosrc, '--[^
]*', '', 'g') INTO v_src
    FROM pg_proc
   WHERE oid = 'public.election_window_open(uuid, text)'::regprocedure;

  -- D2. THE REPAIR LANDED. `CURRENT_DATE` must be gone entirely: one surviving occurrence
  -- would leave a single clause on UTC, which is a HALF-repaired function — nominations
  -- closing correctly and opening five hours early, or the reverse. That is harder to notice
  -- than the original bug.
  IF v_src ~ 'CURRENT_DATE' THEN
    RAISE EXCEPTION
      'election_window_open still uses CURRENT_DATE, which is UTC on hosted Supabase';
  END IF;
  IF v_src !~ 'now\(\) AT TIME ZONE' THEN
    RAISE EXCEPTION 'election_window_open does not resolve today in the election''s zone';
  END IF;
  -- Resolved ONCE, into a variable. Three inline copies could straddle midnight and disagree
  -- with each other inside one call.
  IF (length(v_src) - length(replace(v_src, 'now() AT TIME ZONE', '')))
       / length('now() AT TIME ZONE') <> 1 THEN
    RAISE EXCEPTION
      'election_window_open resolves today more than once — the clauses could straddle midnight';
  END IF;
  IF v_src !~ 'COALESCE\(e\.time_zone' THEN
    RAISE EXCEPTION
      'election_window_open does not fall back for an election with no zone — a NULL would '
      'make the whole expression NULL and the window would read as closed forever';
  END IF;

  -- D3. 20260822000015'S THREE GUARANTEES, RE-ASSERTED IN THEIR NEW FORM. A repair that
  -- silently drops its predecessor's assertions is how the same-day handover gets undone by
  -- accident — so each of its three checks is restated against `v_today` rather than left
  -- behind with the expression it named.
  IF v_src !~ 'v_today < e\.voting_open_on' THEN
    RAISE EXCEPTION
      'election_window_open(''nominations'') is still open on the day voting opens';
  END IF;
  IF v_src ~ 'voting_open_on\s*-\s*1' THEN
    RAISE EXCEPTION 'election_window_open(''nominations'') closed a day early';
  END IF;
  IF v_src !~ 'e\.voting_open_on IS NULL OR' THEN
    RAISE EXCEPTION
      'election_window_open(''nominations'') refuses a draft-shaped row with no voting date';
  END IF;
  -- And the draft guard, which is the cheapest thing to lose while retyping a function body.
  IF v_src !~ 'e\.status <> ''published''' THEN
    RAISE EXCEPTION 'election_window_open no longer refuses a draft';
  END IF;

  -- D4. Still reachable from the browser and still not from anon (§2b rule 2). A policy
  -- expression is evaluated as the QUERYING role, so a lost grant here is every nomination and
  -- every vote ERRORING rather than being refused — and on the realtime path an error and a
  -- refusal are indistinguishable.
  IF NOT has_function_privilege('authenticated',
        'public.election_window_open(uuid, text)', 'EXECUTE') THEN
    RAISE EXCEPTION 'authenticated lost EXECUTE on election_window_open';
  END IF;
  IF has_function_privilege('anon',
        'public.election_window_open(uuid, text)', 'EXECUTE') THEN
    RAISE EXCEPTION 'anon has EXECUTE on election_window_open';
  END IF;

  -- D5. THE ARITHMETIC, PROVED RATHER THAN READ. The expression is evaluated directly for a
  -- pair of zones far enough apart to sit on different calendar dates for part of every day.
  -- This is what turns "the repair looks right" into "the repair computes a different date
  -- from UTC when it should".
  IF (now() AT TIME ZONE 'Pacific/Kiritimati')::date
       = (now() AT TIME ZONE 'Pacific/Midway')::date
     AND (now() AT TIME ZONE 'Pacific/Kiritimati')::time < '11:00'::time THEN
    -- +14 and -11 are 25 hours apart, so they share a calendar date for only one hour in
    -- twenty-five. Outside that hour they must differ, and inside it this assertion is skipped
    -- OUT LOUD rather than passing vacuously.
    RAISE NOTICE
      'zone-date probe skipped: Kiritimati and Midway happen to share a date at this instant';
  ELSIF (now() AT TIME ZONE 'Pacific/Kiritimati')::date
          = (now() AT TIME ZONE 'Pacific/Midway')::date THEN
    RAISE EXCEPTION
      'AT TIME ZONE is not changing the calendar date — the repair computes nothing';
  END IF;

  RAISE NOTICE
    'election_window_open now resolves today in the election''s own zone; % election(s) qualified',
    (SELECT count(*) FROM public.elections);
END $mig$;
