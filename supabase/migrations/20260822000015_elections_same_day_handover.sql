-- ============================================================================
-- Voting may open on the day nominations close.
--
-- `elections_windows_ordered` demanded `voting_open_on > nominations_close_on`, so the
-- shortest election anybody could describe was FOUR days: a day of nominations, a day of
-- nothing, and two days of voting. An organizer running a ballot over one evening was told
-- "Voting must open after nominations close" and had to invent a dead day in the middle of
-- their own election. This relaxes that one comparison to `>=`.
--
-- ── THE INVARIANT THE STRICT RULE BOUGHT IS KEPT, NOT TRADED AWAY ───────────
-- The reason the comparison was strict is written in 20260821000001 and is a good one:
-- nobody should vote on a slate that is still changing. If the two windows may share a day,
-- something has to decide who owns it, and the answer here is VOTING:
--
--     Nominations run through their close date, or until voting opens, whichever comes
--     first.
--
-- So on the shared day the nomination window is shut and the ballot is live, and a ballot is
-- still never open while the slate can change. `lib/election-phase.ts` asks `today >=
-- voting_open_on` BEFORE it asks `today <= nominations_close_on`, and §B below puts the same
-- second clause into `election_window_open('nominations')`.
--
-- WHY VOTING AND NOT NOMINATIONS. A date field captioned "Voting opens on" that does not open
-- voting on the date an organizer just typed into it is the lie. Giving nominations the day
-- instead would mean voting actually begins the day after the date on the form, which is the
-- kind of off-by-one nobody discovers until a member says the ballot would not open.
--
-- IT COSTS `nominations_close_on` ITS INCLUSIVITY IN EXACTLY THIS CONFIGURATION, and that is
-- the trade rather than an oversight. Everywhere else the close date is still the last day
-- anybody may act, which is what `formatDateRange` renders and what /help states. An organizer
-- who wants the whole of that day for nominations sets the close date one day earlier, which
-- says what they mean and costs the same keystroke.
--
-- ── THE TWO HALVES NOW AGREE, WHERE BEFORE SQL WAS MERELY LOOSER ────────────
-- `lib/election-phase.ts`' header records the older arrangement: TypeScript decides what
-- renders, SQL decides what may be written, and "the SQL half being the looser of the two is
-- the direction that matters". That tolerance would have covered leaving
-- `election_window_open('nominations')` alone — it would accept a nomination on the handover
-- day that the UI does not offer. Agreeing is better than tolerating: without §B a member who
-- kept the ballot page open across midnight, or who posts to the endpoint directly, can still
-- add a candidate to a slate people are already voting on. That is the whole hole the strict
-- comparison existed to close, arriving through the one layer that decides.
--
-- ── WHAT IS DELIBERATELY NOT TOUCHED ────────────────────────────────────────
-- * **The two within-window comparisons.** `nominations_close_on > nominations_open_on` and
--   `voting_close_on > voting_open_on` stay strict: "leave it open at least a day" is the rule
--   a family was given, and a window that opens and closes on one date is not a window.
-- * **`elections_published_has_windows`**, `election_may_see`, the scope CHECK, and every
--   policy. This changes one comparison and one function body.
-- * **No row is rewritten.** The constraint only ever gets LOOSER, so every existing row that
--   satisfied the old one satisfies the new one. 20260821000001 needed a backfill because it
--   was tightening; this needs none, and §C asserts the count is unchanged rather than
--   assuming it.
--
-- ── CHECKED BY MUTATION, per AGENTS.md §7 ──────────────────────────────────
--   the CHECK left at `>` (i.e. this file's ALTER removed)
--     ERROR: elections_windows_ordered still refuses a same-day handover
--   the CHECK loosened to `>=` on the WRONG pair (voting_close vs voting_open)
--     ERROR: elections_windows_ordered accepts a zero-length voting window
--   the `nominations` clause in election_window_open left as a bare BETWEEN
--     ERROR: election_window_open('nominations') is still open on the day voting opens
--   the `nominations` clause tightened one day too far (`< voting_open_on - 1`)
--     ERROR: election_window_open('nominations') closed a day early
--
-- The half no migration can check is the app, and it is `npm test`:
-- `lib/election-phase.test.ts` carries the same four cases against the TypeScript twin, and
-- its own header lists the mutations that trip them.
--
-- HOW THIS REACHES A DATABASE
--   `supabase db push`, from CI on merge to master — never `psql -f` by hand. See AGENTS.md,
--   "How migrations reach the hosted project".
-- ============================================================================

-- ── A. The ordering constraint ──────────────────────────────────────────────
ALTER TABLE public.elections DROP CONSTRAINT IF EXISTS elections_windows_ordered;
ALTER TABLE public.elections
  ADD CONSTRAINT elections_windows_ordered CHECK (
       (nominations_open_on  IS NULL OR nominations_close_on IS NULL
          OR nominations_close_on > nominations_open_on)
   AND (voting_open_on       IS NULL OR voting_close_on      IS NULL
          OR voting_close_on > voting_open_on)
   -- `>=`, not `>`. The handover may share a day; see the header.
   AND (nominations_close_on IS NULL OR voting_open_on       IS NULL
          OR voting_open_on >= nominations_close_on)
  );

COMMENT ON COLUMN public.elections.voting_open_on IS
  'First day a vote may be cast. On or after nominations_close_on — the two windows may share '
  'the handover day, and on that day the nomination window is shut (see election_window_open) '
  'so nobody ever votes on a slate that is still changing.';

COMMENT ON COLUMN public.elections.nominations_close_on IS
  'Last day a nomination may be submitted, INCLUSIVE — unless voting_open_on falls on it, in '
  'which case nominations close as voting opens. The rule in one line: nominations run through '
  'their close date, or until voting opens, whichever comes first. Required to publish; a '
  'draft may leave it null. The phase is DERIVED — see lib/election-phase.ts.';

-- ── B. The SQL twin of the phase rule ───────────────────────────────────────
-- RECREATED whole rather than patched, because a function body is not composed here and a
-- reader of this file should be able to see what it now says without opening 20260821000001.
-- Everything but the `nominations` branch is byte-identical to that version.
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
BEGIN
  IF p_election_id IS NULL OR v_family IS NULL OR v_family = '' THEN
    RETURN false;
  END IF;

  SELECT status, family_code,
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
       AND CURRENT_DATE BETWEEN e.nominations_open_on AND e.nominations_close_on
       AND (e.voting_open_on IS NULL OR CURRENT_DATE < e.voting_open_on);
  END IF;
  IF p_window = 'voting' THEN
    RETURN e.voting_open_on IS NOT NULL AND e.voting_close_on IS NOT NULL
       AND CURRENT_DATE BETWEEN e.voting_open_on AND e.voting_close_on;
  END IF;

  -- An unrecognized window name is not a window. Fails closed rather than defaulting to one
  -- of the two, because guessing which would be a guess about a ballot.
  RETURN false;
END $$;

-- §2b: the grant is part of adding (or replacing) a function. `CREATE OR REPLACE` keeps the
-- existing ACL, so these are a restatement rather than a repair — and a restatement is worth
-- making, because a future `DROP FUNCTION ... CREATE` in this position would silently drop it
-- and every nomination and vote policy that calls this would then ERROR rather than refuse.
REVOKE ALL ON FUNCTION public.election_window_open(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.election_window_open(uuid, text) TO authenticated;

-- ── C. Verify ───────────────────────────────────────────────────────────────
-- Every assertion here needs no fixture, so none of them can skip (AGENTS.md, "A verify block
-- that can skip must not be the only check"). Both halves are read back out of the CATALOGUE
-- rather than exercised, and that is a real limit stated rather than hidden: calling
-- `election_window_open` needs `auth_family_code()` to resolve, and a migration has no session
-- for it to resolve from. What actually runs the function against a real row and a real JWT is
-- `npm run test:rls`, and `lib/election-phase.test.ts` runs the TypeScript twin.
DO $mig$
DECLARE
  v_before  bigint;
  v_after   bigint;
  v_src     text;
BEGIN
  SELECT count(*) INTO v_before FROM public.elections;

  -- C1. The constraint accepts the handover and still refuses everything it should.
  -- Read back out of the catalogue rather than trusting the ALTER above.
  SELECT pg_get_constraintdef(oid) INTO v_src
    FROM pg_constraint
   WHERE conrelid = 'public.elections'::regclass
     AND conname  = 'elections_windows_ordered';

  IF v_src IS NULL THEN
    RAISE EXCEPTION 'elections_windows_ordered is missing';
  END IF;
  IF v_src !~ 'voting_open_on >= nominations_close_on' THEN
    RAISE EXCEPTION
      'elections_windows_ordered still refuses a same-day handover: %', v_src;
  END IF;
  IF v_src !~ 'voting_close_on > voting_open_on' THEN
    RAISE EXCEPTION
      'elections_windows_ordered accepts a zero-length voting window: %', v_src;
  END IF;
  IF v_src !~ 'nominations_close_on > nominations_open_on' THEN
    RAISE EXCEPTION
      'elections_windows_ordered accepts a zero-length nominations window: %', v_src;
  END IF;

  -- C2. The function closes nominations on the day voting opens, and not a day earlier.
  -- Asserted on the SOURCE, because calling it needs `auth_family_code()` to resolve and this
  -- migration has no session to resolve it from. Naming the whole clause rather than grepping
  -- for a fragment is what makes the "one day too far" mutation fail here too.
  SELECT prosrc INTO v_src
    FROM pg_proc
   WHERE oid = 'public.election_window_open(uuid, text)'::regprocedure;

  IF v_src !~ 'CURRENT_DATE < e\.voting_open_on' THEN
    RAISE EXCEPTION
      'election_window_open(''nominations'') is still open on the day voting opens';
  END IF;
  IF v_src ~ 'voting_open_on\s*-\s*1' THEN
    RAISE EXCEPTION
      'election_window_open(''nominations'') closed a day early';
  END IF;
  IF v_src !~ 'e\.voting_open_on IS NULL OR' THEN
    RAISE EXCEPTION
      'election_window_open(''nominations'') refuses a draft-shaped row with no voting date';
  END IF;

  -- C3. The function is still reachable from the browser, and still not from anon. A policy
  -- expression is evaluated as the QUERYING role, so a lost grant here is every nomination and
  -- every vote ERRORING rather than being refused (§2b rule 2).
  IF NOT has_function_privilege('authenticated',
        'public.election_window_open(uuid, text)', 'EXECUTE') THEN
    RAISE EXCEPTION 'election_window_open lost its authenticated EXECUTE grant';
  END IF;
  IF has_function_privilege('anon',
        'public.election_window_open(uuid, text)', 'EXECUTE') THEN
    RAISE EXCEPTION 'election_window_open is executable by anon';
  END IF;

  -- C4. Nothing was rewritten. A loosened CHECK cannot invalidate a row, so a changed count
  -- means this file did something it does not claim to.
  SELECT count(*) INTO v_after FROM public.elections;
  IF v_after <> v_before THEN
    RAISE EXCEPTION 'elections row count changed during a constraint relaxation: % -> %',
      v_before, v_after;
  END IF;

  RAISE NOTICE 'elections: voting may now open on the day nominations close; nominations shut as it does';
END $mig$;
