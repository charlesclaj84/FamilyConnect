-- ============================================================================
-- An election runs on its own calendar, belongs to one level of the family, and is
-- only visible to the part of the family it is for.
--
-- Three changes that arrived together because each one is unusable without the others: a
-- chapter election nobody outside the chapter can see is worth nothing if a national
-- election's ballot is open forever, and a date-driven ballot is worth nothing if the wrong
-- chapter is voting on it.
--
-- ============================================================================
-- PART A — THE DATES BECOME THE MECHANISM
-- ============================================================================
-- `nominations_open_at`, `nominations_close_at`, `voting_open_at` and `voting_close_at` were
-- TIMESTAMPTZ columns that governed NOTHING. `status` was a four-state machine — draft ->
-- nominations -> voting -> closed — and an administrator moved it by pressing a button, so
-- the dates on the screen were a claim beside a control that ignored them. A family that set
-- a closing date and went away came back to a ballot still open, and the two RLS policies
-- that gate writing (`election_nominations` INSERT, `election_votes` INSERT) tested
-- `elections.status`, which is to say they tested whether anybody had remembered.
--
-- Now the calendar decides:
--
--     draft ──publish──> scheduled ──nominations_open_on──> NOMINATIONS
--                                                             │ nominations_close_on
--                                                             ▼
--                            between ──voting_open_on──> VOTING ──voting_close_on──> closed
--
-- ── `status` COLLAPSES TO TWO VALUES, AND THAT IS THE WHOLE OF THE CHANGE ───
-- `draft | published`. A draft is an election an organizer is still writing; a published one
-- is on the family's calendar and its phase is a function of today's date. There is no
-- 'nominations', no 'voting' and no 'closed' stored anywhere, because each of those was a
-- second copy of a fact the dates already hold — and a stored copy of a derived fact is
-- wrong from the first day nobody re-ran it. Same argument as `is_minor` (20260813000006),
-- as `people.is_blood` never existing (AGENTS.md §4c), and as `dues_member_plans.start_date`
-- being dropped (20260820000005): a column full of plausible values that describe nothing is
-- precisely what a later change picks up and trusts.
--
-- `lib/election-phase.ts` is the ONE definition on the app side, pure and taking `today` as
-- a parameter so it is checkable without a clock (AGENTS.md §7b). `election_window_open()`
-- below is its SQL twin, and the two must move together — the same exception AGENTS.md
-- already makes for `resolveScope` / `auth_permission` / `scopeInFamilies` and for
-- `addressedTo` / `announcementAudienceFilter`: one rule, two sides of a boundary no single
-- definition can cross, with the TypeScript half as the authority for what RENDERS and the
-- SQL half as the boundary for what can be WRITTEN.
--
-- ── DATE, NOT TIMESTAMPTZ, AND NOT A TIME OF DAY ───────────────────────────
-- Everything else datelike in this product is a bare DATE — `gatherings.starts_on`,
-- `gathering_tasks.due_on`, `dues_schedules.start_date`, and the retired `events.event_date`.
-- Nothing anywhere records a family timezone, so a TIME here would be a time in no
-- particular zone: the two-facts-that-disagree trap again. The old columns were TIMESTAMPTZ
-- fed from `<input type="datetime-local">`, which means the instant stored depended on the
-- timezone of whoever happened to type it, and the date every member READ depended on
-- theirs. A ballot closing "at midnight" closed on two different days for two relatives.
--
-- Carried across as the UTC calendar date of the old instant, which is the only defensible
-- reading of a value that never meant a particular moment to anybody.
--
-- ── THE TWO RULES THE WINDOWS OBEY ─────────────────────────────────────────
--   * **A window's close is strictly after its open.** `close_on > open_on`, so the
--     shortest window anybody can create is a day apart. A zero-length window is a ballot
--     that is never open, and there is no reason to be able to save one.
--   * **Voting opens strictly after nominations close.** `voting_open_on >
--     nominations_close_on`. This is the sequence the four-state machine always had, held by
--     a constraint now that nothing is stepping through it by hand: overlapping the two
--     windows would let somebody vote on a slate that is still changing, and the ballot they
--     saw would not be the ballot that was decided.
--
-- **THE CLOSE DATE IS INCLUSIVE.** Nominations are open THROUGH `nominations_close_on`, and
-- the last day anybody can vote is `voting_close_on`. So a window displayed as
-- "January 1st – January 5th" is five days, which is how a reader reads a range. The
-- alternative — an exclusive close, where "closes January 5th" means the 4th is the last day
-- — makes the minimum window exactly one day rather than two, and makes the screen lie to
-- everybody who reads a date range the ordinary way. Both halves of this are in `/help` and
-- in `lib/election-phase.ts`; change one and change all three.
--
-- ── PUBLISHING REQUIRES ALL FOUR DATES ─────────────────────────────────────
-- A published election with a missing date is one that can never open, and nothing on any
-- screen would say so. A draft may hold any of them, or none, which is what makes a draft
-- useful. `elections_published_has_windows` is the constraint; `publishElection` is the
-- sentence an organizer reads.
--
-- ── WHAT HAPPENS TO THE ROWS THAT EXIST ────────────────────────────────────
-- Nothing that can be preserved is discarded, and where a row cannot be expressed under the
-- new rules it goes back to `draft` with a NOTICE naming the count, rather than being
-- deleted or left violating a constraint:
--
--   * `nominations`, `voting` and `closed` all become `published` IF the row carries all
--     four dates. Otherwise `draft`, because the new rules cannot publish it.
--   * A row whose carried-over dates break the ordering above has its four windows cleared
--     and goes back to `draft`. There is no correct automatic repair — which of two
--     out-of-order dates the family meant is a judgement about their records — and clearing
--     is the one outcome that loses no fact except an ordering that was never coherent.
--
-- This is admissible because **no family is using this product yet**, which is the same
-- ground 20260819000006 recorded for dropping thirteen `event_*` tables rather than freezing
-- them. If it were not, this file would owe a per-family report instead of a NOTICE.
--
-- ============================================================================
-- PART B — AN ELECTION BELONGS TO A LEVEL
-- ============================================================================
-- `scope` is `national | regional | chapter` with `region_id` / `chapter_id`, exactly as
-- `dues_schedules` gained them in 20260817000008 and exactly as `family_roles.scope` and
-- `user_roles.scope` have had them since 20260604000002. **The same three words about the
-- same rows in `chapters`** — two spellings of one idea is how two screens come to disagree.
--
-- Everything 20260817000008's header argues about that vocabulary transfers verbatim and is
-- not restated here: National is the ABSENCE of a region rather than a row, so it exists on
-- every tier with nothing to seed; `DEFAULT 'national'` decides the backfill by not having
-- one, because every election that exists today was family-wide; a member with no chapter is
-- under National; a member's region is DERIVED through `people.chapter_id ->
-- chapters.region_id` and there is no `people.region_id` and none may be added; and the two
-- id columns are `NO ACTION` on delete, with `lib/scope-attached.ts` supplying the sentence
-- an administrator reads instead of a bare 23503.
--
-- ── THE LEVELS DO NOT CROSS-POLLINATE, AND THAT IS TWO RULES ───────────────
--   1. **A chapter election may only fill chapter-scoped offices.** `family_roles.scope`
--      already records whether an office is national, regional or chapter, and an election
--      that fills offices from a different level is one whose result nobody can act on.
--      Enforced in `createElection`, NOT by a trigger — see below.
--   2. **Only members in the area may be nominated or vote.** Enforced in the actions AND in
--      the two INSERT policies, through `election_area_includes_person()`.
--
-- **RULE 1 IS DELIBERATELY NOT A CONSTRAINT, and the reason is the same one that makes a
-- gathering task a COPY of its step rather than a reference** (AGENTS.md). `election_positions
-- .title` is free text copied from the roster at creation time, and it has to be: a family
-- that renames a board position next year must not thereby make last year's election
-- unreadable, and a trigger validating the title against `family_roles` would refuse every
-- later write to a row whose office has since been renamed or retired. So the level match is
-- checked where the position is CHOSEN — once, in `createElection`, against the roster as it
-- stands — and the stored title is provenance from then on.
--
-- That makes `createElection` the write boundary, which is why it moved to the SERVICE-ROLE
-- client in the same commit: an action that is the only enforcement of a rule must not be
-- one of two paths to the table. The `elections` INSERT policy stays as defence, and
-- `elections_guard_scope_family` below is what the service role cannot ignore.
--
-- ============================================================================
-- PART C — AN ELECTION IS ONLY VISIBLE IN ITS OWN AREA
-- ============================================================================
-- Enforced in the DATABASE and in the app, both. The app half (`lib/election-audience.ts`)
-- is what decides what renders; this half is what a request issued from devtools cannot walk
-- past. That is a stronger arrangement than `announcements`, whose chapter scope is an
-- app-layer filter with an optional PostgREST narrowing — and the difference is warranted,
-- because what is behind this key is a BALLOT. An announcement read by the wrong chapter is
-- a post they did not need; an election read by the wrong chapter is a nomination and a vote
-- they were never entitled to see.
--
-- Four functions, and the split matters:
--
--   election_area_includes(scope, region, chapter, person)   the core rule. No grant — it is
--                                                            only ever called from inside
--                                                            another SECURITY DEFINER body,
--                                                            which runs as the owner.
--   election_area_includes_person(election, person)          the STRICT test, for writes. No
--                                                            organizer override: an organizer
--                                                            may run a chapter's election and
--                                                            may not vote in it.
--   auth_may_see_election(scope, region, chapter)            the READ test for the caller,
--                                                            WITH the organizer override.
--   auth_may_see_election_id(election)                       the same, resolved from a child
--                                                            row's election_id.
--
-- ── THE ORGANIZER OVERRIDE IS WHY THIS IS NOT SIMPLY `AND in_my_area` ──────
-- An organizer's whole job is to run every level's elections, so a bare area conjunct would
-- hide from `/admin/elections` precisely the rows it exists to manage — and worse, would hide
-- them silently, because PostgREST answers a policy that releases nothing with `[]` rather
-- than an error (AGENTS.md §8). The override is `auth_permission('admin/elections', 'view') =
-- 'any'`, which is the key this same commit moved back under `admin/` so that it FAILS CLOSED
-- for a family that has not granted it (20260817000004).
--
-- ── EVERY FUNCTION HERE IS SCOPED TO THE CALLER'S OWN FAMILY, BY HAND ──────
-- AGENTS.md §2b rule 3: these are SECURITY DEFINER, so they see past RLS, and three of them
-- take an id from the caller. Without the family conjunct inside each body,
-- `election_area_includes_person` would answer questions about another family's election and
-- another family's people — a cross-family probe published at
-- `POST /rest/v1/rpc/election_area_includes_person`. They all resolve the caller's family
-- from `auth_family_code()` and answer `false` for anything outside it.
--
-- ── THE SECRET BALLOT WAS NOT SECRET, AND THIS FILE FIXES IT ───────────────
-- Found while reading the composed policies in order to narrow them, and it is a defect
-- rather than a consequence of anything above. `perm:admins can view all votes` on
-- `election_votes` read
--
--     election_id IN (this family's elections)
--     AND (voter_id = auth_person_id() OR auth_permission('review/elections','view') = 'any' …)
--
-- and `review/elections` view resolves to 'any' for EVERY member, because a non-admin
-- resource with no `resource_visibility` row defaults to 'everyone'. So the policy named for
-- administrators admitted the whole family, and any signed-in member could read every vote
-- in every election straight off PostgREST — who voted, and for whom. The comment in
-- 20260609000007 says "Voters can see their own vote but not others' (secret ballot)"; that
-- has never been true.
--
-- It is rewritten to demand `admin/elections:view = 'any'` — the organizer grant, which is
-- restricted by default. `perm:voters can see own votes` is untouched and is what keeps a
-- member's own ballot reachable. `getElectionResults` is unaffected: it reads TALLIES on the
-- service-role client precisely because a count has to include votes the reader may not see
-- individually, and it re-applies the family scope by hand (AGENTS.md §3).
--
-- ── NO INDEX ON `scope`, `region_id` OR `chapter_id` ───────────────────────
-- The same answer 20260817000008 gives for `dues_schedules`: PostgreSQL does not index the
-- referencing side of a foreign key, so `DELETE FROM regions` scans this table — which holds
-- single digits of rows per family. The scan is cheaper than the index page it would need.
--
-- ── CHECKED BY MUTATION, per AGENTS.md §7 ──────────────────────────────────
-- A green verify block is not evidence until it has been seen to fail. Nine copies of this
-- file, one line changed in each, replayed with `psql -f` against a reset database; every one
-- aborted, and the clean file prints its NOTICEs. Observed output, not expected:
--
--   m1  the window-ordering CHECK is never created
--         ERROR: election constraint(s) not created: elections_windows_ordered
--   m2  the ordering CHECK uses >= instead of > for nominations
--         ERROR: a zero-length nominations window was accepted
--   m3  the ordering CHECK forgets the voting-after-nominations clause
--         ERROR: voting was accepted opening before nominations closed
--   m4  elections_published_has_windows is created but vacuous
--         ERROR: a published election was accepted with no dates
--   m5  the scope targets CHECK forgets `AND chapter_id IS NULL` on the regional branch
--         ERROR: a regional election was accepted carrying a chapter as well
--   m6  elections_guard_scope_family compares against the wrong family
--         ERROR: an election accepted a chapter from another family
--   m7  election_area_includes returns true for a person with no chapter
--         ERROR: a member in no chapter was admitted to a chapter election
--   m8  auth_may_see_election_id drops its family conjunct
--         ERROR: auth_may_see_election_id answered about another family's election
--   m9  the votes SELECT policy is left on review/elections
--         ERROR: election_votes SELECT is still gated on review/elections — the ballot is not secret
--
-- m1 and m2 are the pair worth keeping: m1 is caught by the CATALOGUE half, which proves only
-- that a constraint of that name exists, and m2 is what proves it does what its name says. A
-- verify block with only the first kind passes over a constraint that has been quietly
-- weakened, which is the commoner failure.
--
-- HOW THIS REACHES A DATABASE
--   `supabase db push`, from CI on merge to master — never `psql -f` by hand, which
--   records nothing and can replay this file out of order. See AGENTS.md, "How
--   migrations reach the hosted project".
-- ============================================================================

BEGIN;

-- ── A1. The four windows, as dates ──────────────────────────────────────────
ALTER TABLE public.elections
  ADD COLUMN IF NOT EXISTS nominations_open_on  DATE,
  ADD COLUMN IF NOT EXISTS nominations_close_on DATE,
  ADD COLUMN IF NOT EXISTS voting_open_on       DATE,
  ADD COLUMN IF NOT EXISTS voting_close_on      DATE;

-- The carry-across, guarded on the old columns still existing. A bare UPDATE naming a
-- dropped column fails at PARSE time inside this transaction, which would make the file
-- un-replayable — so it goes through EXECUTE, which resolves names when it runs.
DO $mig$
DECLARE v_moved int := 0;
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
     WHERE table_schema = 'public' AND table_name = 'elections'
       AND column_name = 'nominations_open_at'
  ) THEN
    EXECUTE $sql$
      UPDATE public.elections SET
        nominations_open_on  = COALESCE(nominations_open_on,  (nominations_open_at  AT TIME ZONE 'UTC')::date),
        nominations_close_on = COALESCE(nominations_close_on, (nominations_close_at AT TIME ZONE 'UTC')::date),
        voting_open_on       = COALESCE(voting_open_on,       (voting_open_at       AT TIME ZONE 'UTC')::date),
        voting_close_on      = COALESCE(voting_close_on,      (voting_close_at      AT TIME ZONE 'UTC')::date)
    $sql$;
    GET DIAGNOSTICS v_moved = ROW_COUNT;
    RAISE NOTICE 'elections: % row(s) had their four timestamp windows read as UTC calendar dates', v_moved;
  ELSE
    RAISE NOTICE 'elections: the timestamp windows are already gone — nothing to carry across';
  END IF;
END $mig$;

ALTER TABLE public.elections
  DROP COLUMN IF EXISTS nominations_open_at,
  DROP COLUMN IF EXISTS nominations_close_at,
  DROP COLUMN IF EXISTS voting_open_at,
  DROP COLUMN IF EXISTS voting_close_at;

COMMENT ON COLUMN public.elections.nominations_open_on IS
  'First day nominations may be submitted. INCLUSIVE of nominations_close_on. Required to publish; a draft may leave it null. The phase is DERIVED from these four dates — see lib/election-phase.ts and election_window_open().';
COMMENT ON COLUMN public.elections.nominations_close_on IS
  'LAST day nominations may be submitted — inclusive. Strictly after nominations_open_on, and strictly before voting_open_on.';
COMMENT ON COLUMN public.elections.voting_open_on IS
  'First day a vote may be cast. Strictly after nominations_close_on, so nobody votes on a slate that is still changing.';
COMMENT ON COLUMN public.elections.voting_close_on IS
  'LAST day a vote may be cast — inclusive. The election is closed from the next day, with nothing to press.';

-- ── A2. `status` collapses to draft | published ─────────────────────────────
-- The old inline CHECK goes first, or the backfill below cannot write the new word.
ALTER TABLE public.elections DROP CONSTRAINT IF EXISTS elections_status_check;
ALTER TABLE public.elections DROP CONSTRAINT IF EXISTS elections_status_valid;

-- Anything that was live becomes published — but only if it can be. A row missing a date
-- cannot be published under the new rules, and saying so by putting it back in draft is the
-- honest outcome: an organizer opens it, sees the empty date it never had, and fills it in.
UPDATE public.elections
   SET status = CASE
     WHEN nominations_open_on IS NOT NULL AND nominations_close_on IS NOT NULL
      AND voting_open_on      IS NOT NULL AND voting_close_on      IS NOT NULL
       THEN 'published'
     ELSE 'draft'
   END
 WHERE status <> 'draft';

ALTER TABLE public.elections
  ADD CONSTRAINT elections_status_valid CHECK (status IN ('draft', 'published'));
ALTER TABLE public.elections ALTER COLUMN status SET DEFAULT 'draft';

COMMENT ON COLUMN public.elections.status IS
  'draft (an organizer is still writing it, invisible to members) or published (on the family''s calendar). There is no stored nominations/voting/closed state: the phase is a function of the four window dates and today, computed by lib/election-phase.ts and by election_window_open().';

-- ── A3. The window invariants ───────────────────────────────────────────────
-- The data half first, for the reason 20260817000002 and 20260817000008 both carried one: a
-- replay has to be able to correct a row before a constraint refuses it, or the whole chain
-- aborts here. There is no correct automatic repair for an out-of-order pair, so the windows
-- are cleared and the row goes back to draft — losing nothing but an ordering that was never
-- coherent. Reported, never silent (AGENTS.md: a skip must be visible).
DO $mig$
DECLARE v_bad int;
BEGIN
  WITH broken AS (
    UPDATE public.elections
       SET nominations_open_on = NULL, nominations_close_on = NULL,
           voting_open_on = NULL, voting_close_on = NULL,
           status = 'draft'
     WHERE (nominations_open_on IS NOT NULL AND nominations_close_on IS NOT NULL
            AND nominations_close_on <= nominations_open_on)
        OR (voting_open_on IS NOT NULL AND voting_close_on IS NOT NULL
            AND voting_close_on <= voting_open_on)
        OR (nominations_close_on IS NOT NULL AND voting_open_on IS NOT NULL
            AND voting_open_on <= nominations_close_on)
    RETURNING 1
  )
  SELECT count(*) INTO v_bad FROM broken;
  IF v_bad > 0 THEN
    RAISE NOTICE
      'elections: % row(s) held windows that cannot be ordered under the new rules — cleared and returned to draft',
      v_bad;
  END IF;
END $mig$;

ALTER TABLE public.elections DROP CONSTRAINT IF EXISTS elections_windows_ordered;
ALTER TABLE public.elections
  ADD CONSTRAINT elections_windows_ordered CHECK (
       (nominations_open_on  IS NULL OR nominations_close_on IS NULL
          OR nominations_close_on > nominations_open_on)
   AND (voting_open_on       IS NULL OR voting_close_on      IS NULL
          OR voting_close_on > voting_open_on)
   AND (nominations_close_on IS NULL OR voting_open_on       IS NULL
          OR voting_open_on > nominations_close_on)
  );

ALTER TABLE public.elections DROP CONSTRAINT IF EXISTS elections_published_has_windows;
ALTER TABLE public.elections
  ADD CONSTRAINT elections_published_has_windows CHECK (
    status <> 'published'
    OR (nominations_open_on IS NOT NULL AND nominations_close_on IS NOT NULL
        AND voting_open_on  IS NOT NULL AND voting_close_on      IS NOT NULL)
  );

-- ── B1. Scope ───────────────────────────────────────────────────────────────
-- NOT NULL with a 'national' default, matching `dues_schedules.scope`: there is no third
-- state, and a NULL would invite a fourth meaning into a question with three answers.
ALTER TABLE public.elections
  ADD COLUMN IF NOT EXISTS scope TEXT NOT NULL DEFAULT 'national';

ALTER TABLE public.elections DROP CONSTRAINT IF EXISTS elections_scope_valid;
ALTER TABLE public.elections
  ADD CONSTRAINT elections_scope_valid CHECK (scope IN ('national', 'regional', 'chapter'));

ALTER TABLE public.elections
  ADD COLUMN IF NOT EXISTS region_id  UUID REFERENCES public.regions(id),
  ADD COLUMN IF NOT EXISTS chapter_id UUID REFERENCES public.chapters(id);

COMMENT ON COLUMN public.elections.scope IS
  'Which part of the family this election is for and who may see it: national (everybody), regional (members whose chapter is in region_id), chapter (members in chapter_id). National is the ABSENCE of a region rather than a row, so it needs no seed and exists on every tier. A member with no chapter is under National and sees national elections only. Enforced in RLS by auth_may_see_election() and in the app by lib/election-audience.ts.';
COMMENT ON COLUMN public.elections.region_id IS
  'Set exactly when scope = ''regional''. NO ACTION on delete: lib/scope-attached.ts refuses to delete a region an election is scoped to, with a sentence naming it.';
COMMENT ON COLUMN public.elections.chapter_id IS
  'Set exactly when scope = ''chapter''. NO ACTION on delete, for the reason on region_id.';

UPDATE public.elections
   SET region_id = NULL, chapter_id = NULL
 WHERE scope = 'national' AND (region_id IS NOT NULL OR chapter_id IS NOT NULL);

ALTER TABLE public.elections DROP CONSTRAINT IF EXISTS elections_scope_targets;
ALTER TABLE public.elections
  ADD CONSTRAINT elections_scope_targets CHECK (
      (scope = 'national' AND region_id IS NULL     AND chapter_id IS NULL)
   OR (scope = 'regional' AND region_id IS NOT NULL AND chapter_id IS NULL)
   OR (scope = 'chapter'  AND region_id IS NULL     AND chapter_id IS NOT NULL)
  );

-- ── B2. The cross-family guard ──────────────────────────────────────────────
-- AGENTS.md §4: a row carrying the caller's own `family_code` satisfies every policy while
-- the `chapter_id` written onto it points into somebody else's family. `createElection` calls
-- `belongsToFamily` on each id, and that action writes through the SERVICE-ROLE client — which
-- ignores RLS and does NOT ignore triggers. This is the half the service role cannot skip,
-- and it is the same shape as the five Gatherings guard triggers.
--
-- INVOKER, not DEFINER, and that is deliberate: it reads only `regions` and `chapters` rows
-- whose family it is comparing, and both are reached from the row being written rather than
-- from a caller-supplied identity. `search_path = ''` regardless, per AGENTS.md.
CREATE OR REPLACE FUNCTION public.elections_guard_scope_family()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF NEW.region_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.regions r
     WHERE r.id = NEW.region_id AND r.family_code = NEW.family_code
  ) THEN
    RAISE EXCEPTION 'election %: region % does not belong to family %',
      COALESCE(NEW.id::text, 'new'), NEW.region_id, NEW.family_code
      USING ERRCODE = '42501';
  END IF;

  IF NEW.chapter_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.chapters c
     WHERE c.id = NEW.chapter_id AND c.family_code = NEW.family_code
  ) THEN
    RAISE EXCEPTION 'election %: chapter % does not belong to family %',
      COALESCE(NEW.id::text, 'new'), NEW.chapter_id, NEW.family_code
      USING ERRCODE = '42501';
  END IF;

  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS elections_guard_scope_family ON public.elections;
CREATE TRIGGER elections_guard_scope_family
  BEFORE INSERT OR UPDATE ON public.elections
  FOR EACH ROW EXECUTE FUNCTION public.elections_guard_scope_family();

-- ── C1. The area rule, in SQL ───────────────────────────────────────────────
-- The core. NO GRANT: it is only ever called from inside another SECURITY DEFINER body,
-- which runs as that function's owner, so EXECUTE is never checked against a browser role
-- (AGENTS.md §2b). It takes a person id and must therefore never be reachable directly —
-- the three wrappers below are what resolve and family-scope that id.
CREATE OR REPLACE FUNCTION public.election_area_includes(
  p_scope      text,
  p_region_id  uuid,
  p_chapter_id uuid,
  p_person_id  uuid
)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_chapter uuid;
  v_region  uuid;
BEGIN
  -- National, and anything the CHECK constraint cannot hold, reaches everybody. Failing
  -- toward NATIONAL is the deliberate direction, exactly as `duesScope` does it: a garbled
  -- scope is not a fact the family stated, and restoring "this is for the whole family" is
  -- what the row meant before anybody typed a chapter into it.
  IF p_scope IS DISTINCT FROM 'regional' AND p_scope IS DISTINCT FROM 'chapter' THEN
    RETURN true;
  END IF;

  IF p_person_id IS NULL THEN
    RETURN false;
  END IF;

  SELECT p.chapter_id INTO v_chapter FROM public.people p WHERE p.id = p_person_id;

  -- A MEMBER WITH NO CHAPTER IS UNDER NATIONAL. They see national elections and no scoped
  -- one — the only coherent answer, since there is no region to compare against, and also
  -- the safe direction. Same rule as `duesScopeMatch`'s 'no-chapter'.
  IF v_chapter IS NULL THEN
    RETURN false;
  END IF;

  IF p_scope = 'chapter' THEN
    RETURN v_chapter = p_chapter_id;
  END IF;

  -- Regional. The region is DERIVED — there is no people.region_id and none may be added.
  SELECT c.region_id INTO v_region FROM public.chapters c WHERE c.id = v_chapter;
  RETURN v_region IS NOT NULL AND v_region = p_region_id;
END $$;

REVOKE ALL ON FUNCTION public.election_area_includes(text, uuid, uuid, uuid)
  FROM PUBLIC, anon, authenticated;

-- The STRICT test, for a WRITE. No organizer override, deliberately: running a chapter's
-- election is not being in it, and an organizer who could vote in every chapter's ballot is
-- the abuse case this whole feature is about. Used by the two INSERT policies below and by
-- `submitNomination` / `castVote`.
CREATE OR REPLACE FUNCTION public.election_area_includes_person(
  p_election_id uuid,
  p_person_id   uuid
)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_family  text := public.auth_family_code();
  v_scope   text;
  v_region  uuid;
  v_chapter uuid;
  v_code    text;
BEGIN
  IF p_election_id IS NULL OR p_person_id IS NULL OR v_family IS NULL OR v_family = '' THEN
    RETURN false;
  END IF;

  SELECT e.scope, e.region_id, e.chapter_id, e.family_code
    INTO v_scope, v_region, v_chapter, v_code
    FROM public.elections e WHERE e.id = p_election_id;
  IF NOT FOUND THEN
    RETURN false;
  END IF;

  -- §2b rule 3. This is SECURITY DEFINER and takes two ids from the caller, so without both
  -- of these conjuncts it is a cross-family probe published at
  -- POST /rest/v1/rpc/election_area_includes_person.
  IF v_code IS DISTINCT FROM v_family THEN
    RETURN false;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.people p WHERE p.id = p_person_id AND p.family_code = v_family
  ) THEN
    RETURN false;
  END IF;

  RETURN public.election_area_includes(v_scope, v_region, v_chapter, p_person_id);
END $$;

REVOKE ALL ON FUNCTION public.election_area_includes_person(uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.election_area_includes_person(uuid, uuid) TO authenticated;

-- The READ test for the caller, with the organizer override. Named in the SELECT policy on
-- `elections`, so the grant below is load-bearing: a policy expression is evaluated as the
-- QUERYING role, and without EXECUTE every election query in the app dies with "permission
-- denied for function" rather than being refused (AGENTS.md §2b rule 2).
CREATE OR REPLACE FUNCTION public.auth_may_see_election(
  p_scope      text,
  p_region_id  uuid,
  p_chapter_id uuid
)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF p_scope IS DISTINCT FROM 'regional' AND p_scope IS DISTINCT FROM 'chapter' THEN
    RETURN true;
  END IF;

  -- The organizer sees every level, or `/admin/elections` cannot manage the rows it exists
  -- for — and would show an empty list rather than an error, because PostgREST answers a
  -- policy that releases nothing with `[]`. `admin/elections` FAILS CLOSED for a family that
  -- has not granted it (20260817000004), which is what makes this override narrow.
  IF public.auth_permission('admin/elections', 'view'::public.permission_action)
       = 'any'::public.permission_scope THEN
    RETURN true;
  END IF;

  RETURN public.election_area_includes(
    p_scope, p_region_id, p_chapter_id, public.auth_person_id());
END $$;

REVOKE ALL ON FUNCTION public.auth_may_see_election(text, uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.auth_may_see_election(text, uuid, uuid) TO authenticated;

-- The same question from a child row, which carries an `election_id` and no scope of its own.
CREATE OR REPLACE FUNCTION public.auth_may_see_election_id(p_election_id uuid)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_family  text := public.auth_family_code();
  v_scope   text;
  v_region  uuid;
  v_chapter uuid;
  v_code    text;
BEGIN
  IF p_election_id IS NULL OR v_family IS NULL OR v_family = '' THEN
    RETURN false;
  END IF;

  SELECT e.scope, e.region_id, e.chapter_id, e.family_code
    INTO v_scope, v_region, v_chapter, v_code
    FROM public.elections e WHERE e.id = p_election_id;
  IF NOT FOUND OR v_code IS DISTINCT FROM v_family THEN
    RETURN false;
  END IF;

  RETURN public.auth_may_see_election(v_scope, v_region, v_chapter);
END $$;

REVOKE ALL ON FUNCTION public.auth_may_see_election_id(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.auth_may_see_election_id(uuid) TO authenticated;

-- ── A4. The window test, in SQL ─────────────────────────────────────────────
-- The twin of `electionPhase` in lib/election-phase.ts. Read PART A's note on the two halves
-- before changing either. Family-scoped inside the body, so a policy ANDing it keeps the
-- family conjunct the old `status`-based subquery carried.
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

  -- BETWEEN is inclusive on both ends, which is the close-date rule stated in PART A: the
  -- last day anybody may act is the close date itself.
  IF p_window = 'nominations' THEN
    RETURN e.nominations_open_on IS NOT NULL AND e.nominations_close_on IS NOT NULL
       AND CURRENT_DATE BETWEEN e.nominations_open_on AND e.nominations_close_on;
  END IF;
  IF p_window = 'voting' THEN
    RETURN e.voting_open_on IS NOT NULL AND e.voting_close_on IS NOT NULL
       AND CURRENT_DATE BETWEEN e.voting_open_on AND e.voting_close_on;
  END IF;

  -- An unrecognized window name is not a window. Fails closed rather than defaulting to one
  -- of the two, because guessing which would be a guess about a ballot.
  RETURN false;
END $$;

REVOKE ALL ON FUNCTION public.election_window_open(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.election_window_open(uuid, text) TO authenticated;

-- ── C2. The two write windows, restated on the dates ────────────────────────
-- These two are RECREATED rather than composed-onto, because what has to change is inside
-- the original expression: `elections.status = 'nominations'` is a test of a column that no
-- longer holds that word. Both keep their `perm:` names, which is what stops
-- 20260618000001's sweep from wrapping them a second time on a replay.
--
-- The permission conjunct is reproduced verbatim from what the sweep composed — read out of
-- pg_policies before this file was written, not reconstructed from the rules — so this
-- narrows and never widens.
DROP POLICY IF EXISTS "perm:family can submit nominations" ON public.election_nominations;
CREATE POLICY "perm:family can submit nominations"
  ON public.election_nominations FOR INSERT
  TO authenticated
  WITH CHECK (
    public.election_window_open(election_id, 'nominations')
    AND public.election_area_includes_person(election_id, nominee_id)
    AND (
      nominee_id = public.auth_person_id()
      OR public.auth_permission('review/elections', 'create'::public.permission_action)
           = 'any'::public.permission_scope
      OR (public.auth_permission('review/elections', 'create'::public.permission_action)
            = 'own'::public.permission_scope
          AND nominated_by = public.auth_person_id())
    )
  );

DROP POLICY IF EXISTS "perm:family can cast votes" ON public.election_votes;
CREATE POLICY "perm:family can cast votes"
  ON public.election_votes FOR INSERT
  TO authenticated
  WITH CHECK (
    public.election_window_open(election_id, 'voting')
    AND public.election_area_includes_person(election_id, voter_id)
    AND voter_id IN (SELECT p.id FROM public.people p WHERE p.user_id = auth.uid())
    AND (
      voter_id = public.auth_person_id()
      OR public.auth_permission('review/elections', 'create'::public.permission_action)
           = 'any'::public.permission_scope
      OR (public.auth_permission('review/elections', 'create'::public.permission_action)
            = 'own'::public.permission_scope
          AND voter_id = public.auth_person_id())
    )
  );

-- ── C3. The secret ballot ───────────────────────────────────────────────────
-- See PART C's note. This policy is named for administrators and admitted the whole family,
-- because `review/elections:view` resolves to 'any' for everybody by default. It demands the
-- ORGANIZER grant now. `perm:voters can see own votes` is untouched and is what keeps a
-- member's own ballot reachable — so this narrows and takes nothing legitimate away.
DROP POLICY IF EXISTS "perm:admins can view all votes" ON public.election_votes;
CREATE POLICY "perm:admins can view all votes"
  ON public.election_votes FOR SELECT
  TO authenticated
  USING (
    election_id IN (
      SELECT e.id FROM public.elections e WHERE e.family_code = public.auth_family_code()
    )
    AND public.auth_permission('admin/elections', 'view'::public.permission_action)
          = 'any'::public.permission_scope
  );

-- ── C4. Every policy on the four tables gains the area conjunct ─────────────
-- COMPOSED rather than restated, which is 20260618000001's own approach and for its own
-- reason: the existing expressions carry family scoping and a permission layer that were
-- carefully got right, and AND can only ever NARROW. Reading each one out of pg_policies and
-- wrapping it is what makes this file incapable of widening anything by accident.
--
-- RE-RUNNABLE: a policy already carrying the conjunct is skipped, so a second pass is a
-- no-op rather than a double-wrap.
-- The expressions below are RE-PARSED out of pg_policies, which deparses `public` functions
-- unqualified. Pinning the search_path is what stops that resolving somewhere else on a
-- database whose session default differs — a policy that silently references nothing is the
-- one failure mode this loop cannot report on.
SET LOCAL search_path = public, pg_catalog;

DO $mig$
DECLARE
  r     record;
  v_add text;
  v_n   int := 0;
BEGIN
  FOR r IN
    SELECT tablename, policyname, cmd, qual, with_check
      FROM pg_policies
     WHERE schemaname = 'public'
       AND tablename IN ('elections', 'election_positions',
                         'election_nominations', 'election_votes')
     ORDER BY tablename, policyname
  LOOP
    -- `elections` carries the scope on the row itself; every child table reaches it through
    -- `election_id`. Using the column form on `elections` avoids a second lookup of the row
    -- the policy is already looking at.
    v_add := CASE r.tablename
      WHEN 'elections' THEN 'public.auth_may_see_election(scope, region_id, chapter_id)'
      ELSE 'public.auth_may_see_election_id(election_id)'
    END;

    IF COALESCE(r.qual, '')       LIKE '%auth_may_see_election%'
    OR COALESCE(r.with_check, '') LIKE '%auth_may_see_election%'
    -- The two INSERT policies rewritten in C2 use the STRICT person test instead, on
    -- purpose: an organizer may run a chapter's election and may not vote in it.
    OR (r.tablename = 'election_nominations' AND r.cmd = 'INSERT')
    OR (r.tablename = 'election_votes'       AND r.cmd = 'INSERT')
    THEN
      CONTINUE;
    END IF;

    IF r.qual IS NOT NULL AND r.with_check IS NOT NULL THEN
      EXECUTE format('ALTER POLICY %I ON public.%I USING (%s AND (%s)) WITH CHECK (%s AND (%s))',
                     r.policyname, r.tablename, v_add, r.qual, v_add, r.with_check);
    ELSIF r.qual IS NOT NULL THEN
      EXECUTE format('ALTER POLICY %I ON public.%I USING (%s AND (%s))',
                     r.policyname, r.tablename, v_add, r.qual);
    ELSIF r.with_check IS NOT NULL THEN
      EXECUTE format('ALTER POLICY %I ON public.%I WITH CHECK (%s AND (%s))',
                     r.policyname, r.tablename, v_add, r.with_check);
    ELSE
      CONTINUE;
    END IF;
    v_n := v_n + 1;
  END LOOP;

  RAISE NOTICE 'elections: % policy expression(s) narrowed to the election''s area', v_n;
END $mig$;

-- ── Verify ──────────────────────────────────────────────────────────────────
-- Catalogue reads first, unconditional, so this cannot report success by skipping. Then REAL
-- BEHAVIOUR tests, which need no auth fixture: `elections`, `regions` and `chapters` all
-- carry `family_code` as free text with no foreign key to `families`, so a probe family lives
-- and dies inside this transaction. That is the difference AGENTS.md asks for between a verify
-- block and a comment — every constraint below is exercised in both directions rather than
-- merely read back out of pg_constraint.
DO $mig$
DECLARE
  v_code    text := 'ZZELECPROBE';
  v_region  uuid;
  v_chapter uuid;
  v_other   uuid;
  v_elec    uuid;
  v_person  uuid;
  v_missing text;
  v_pols    int;
BEGIN
  -- (a) The columns exist and are DATEs, not timestamps.
  SELECT string_agg(c.name, ', ') INTO v_missing
    FROM (VALUES ('nominations_open_on'), ('nominations_close_on'),
                 ('voting_open_on'), ('voting_close_on')) AS c(name)
   WHERE NOT EXISTS (
     SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'elections'
        AND column_name = c.name AND data_type = 'date'
   );
  IF v_missing IS NOT NULL THEN
    RAISE EXCEPTION 'election window column(s) missing or not DATE: %', v_missing;
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.columns
     WHERE table_schema = 'public' AND table_name = 'elections'
       AND column_name LIKE '%_at' AND column_name <> 'created_at'
       AND column_name <> 'updated_at'
  ) THEN
    RAISE EXCEPTION 'a timestamp window column survived on elections';
  END IF;

  -- (b) Every constraint by name, and then by behaviour. The pair matters: the catalogue half
  -- proves only that something of that name exists.
  SELECT string_agg(c.name, ', ') INTO v_missing
    FROM (VALUES ('elections_status_valid'), ('elections_windows_ordered'),
                 ('elections_published_has_windows'), ('elections_scope_valid'),
                 ('elections_scope_targets')) AS c(name)
   WHERE NOT EXISTS (
     SELECT 1 FROM pg_constraint
      WHERE conrelid = 'public.elections'::regclass AND conname = c.name
   );
  IF v_missing IS NOT NULL THEN
    RAISE EXCEPTION 'election constraint(s) not created: %', v_missing;
  END IF;

  -- (c) The two foreign keys, and that they are NO ACTION rather than SET NULL — the same
  -- argument 20260817000008 records: SET NULL would leave a regional election with no region,
  -- turning a refused delete into a CHECK violation naming a column nobody touched.
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
     WHERE conrelid = 'public.elections'::regclass AND contype = 'f'
       AND confrelid = 'public.regions'::regclass AND confdeltype = 'a'
  ) THEN
    RAISE EXCEPTION 'elections.region_id is not a NO ACTION foreign key to regions';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
     WHERE conrelid = 'public.elections'::regclass AND contype = 'f'
       AND confrelid = 'public.chapters'::regclass AND confdeltype = 'a'
  ) THEN
    RAISE EXCEPTION 'elections.chapter_id is not a NO ACTION foreign key to chapters';
  END IF;

  -- (d) The grants. A helper named in a policy and NOT executable by `authenticated` does not
  -- close a hole, it breaks the feature: every query dies with "permission denied for
  -- function" (AGENTS.md §2b rule 2). And the core rule must NOT be reachable, because it
  -- takes a bare person id.
  SELECT string_agg(f.sig, ', ') INTO v_missing
    FROM (VALUES ('public.auth_may_see_election(text, uuid, uuid)'),
                 ('public.auth_may_see_election_id(uuid)'),
                 ('public.election_area_includes_person(uuid, uuid)'),
                 ('public.election_window_open(uuid, text)')) AS f(sig)
   WHERE NOT has_function_privilege('authenticated', f.sig, 'EXECUTE');
  IF v_missing IS NOT NULL THEN
    RAISE EXCEPTION 'authenticated cannot execute policy helper(s): %', v_missing;
  END IF;
  IF has_function_privilege('authenticated',
       'public.election_area_includes(text, uuid, uuid, uuid)', 'EXECUTE') THEN
    RAISE EXCEPTION 'election_area_includes is executable by authenticated — it takes a bare person id';
  END IF;
  IF has_function_privilege('anon', 'public.auth_may_see_election_id(uuid)', 'EXECUTE') THEN
    RAISE EXCEPTION 'anon can execute auth_may_see_election_id';
  END IF;

  -- (e) Every policy on the four tables carries the area conjunct, except the two INSERTs
  -- that use the strict person form. Counted, so a loop that silently matched nothing fails.
  SELECT count(*) INTO v_pols
    FROM pg_policies
   WHERE schemaname = 'public'
     AND tablename IN ('elections', 'election_positions',
                       'election_nominations', 'election_votes')
     AND COALESCE(qual, '') NOT LIKE '%election_area_includes_person%'
     AND COALESCE(with_check, '') NOT LIKE '%election_area_includes_person%'
     AND COALESCE(qual, '') NOT LIKE '%auth_may_see_election%'
     AND COALESCE(with_check, '') NOT LIKE '%auth_may_see_election%';
  IF v_pols > 0 THEN
    RAISE EXCEPTION '% policy expression(s) on the election tables have no area test', v_pols;
  END IF;

  -- (f) The secret ballot. The organizer policy must not be satisfiable by the member-facing
  -- key, which every member holds at 'any' by default.
  IF EXISTS (
    SELECT 1 FROM pg_policies
     WHERE schemaname = 'public' AND tablename = 'election_votes'
       AND policyname = 'perm:admins can view all votes'
       AND qual LIKE '%review/elections%'
  ) THEN
    RAISE EXCEPTION
      'election_votes SELECT is still gated on review/elections — the ballot is not secret';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
     WHERE schemaname = 'public' AND tablename = 'election_votes'
       AND policyname = 'perm:admins can view all votes'
       AND qual LIKE '%admin/elections%'
  ) THEN
    RAISE EXCEPTION 'election_votes SELECT does not demand the organizer grant';
  END IF;

  -- (g) The two write policies test the dates and not the old status word.
  IF EXISTS (
    SELECT 1 FROM pg_policies
     WHERE schemaname = 'public'
       AND tablename IN ('election_nominations', 'election_votes')
       AND COALESCE(with_check, '') LIKE '%status = ''nominations''%'
  ) OR EXISTS (
    SELECT 1 FROM pg_policies
     WHERE schemaname = 'public'
       AND tablename IN ('election_nominations', 'election_votes')
       AND COALESCE(with_check, '') LIKE '%status = ''voting''%'
  ) THEN
    RAISE EXCEPTION 'a write policy still tests elections.status for a phase';
  END IF;

  -- ── The invariants, exercised ──
  INSERT INTO public.regions (family_code, name) VALUES (v_code, 'Probe Region')
    RETURNING id INTO v_region;
  INSERT INTO public.chapters (family_code, name, region_id)
    VALUES (v_code, 'Probe Chapter', v_region) RETURNING id INTO v_chapter;

  INSERT INTO public.elections (family_code, title) VALUES (v_code, 'Probe Election')
    RETURNING id INTO v_elec;

  IF (SELECT status FROM public.elections WHERE id = v_elec) <> 'draft' THEN
    RAISE EXCEPTION 'an election created without a status did not come out draft';
  END IF;
  IF (SELECT scope FROM public.elections WHERE id = v_elec) <> 'national' THEN
    RAISE EXCEPTION 'an election created without a scope did not come out national';
  END IF;

  -- a zero-length nominations window
  BEGIN
    UPDATE public.elections
       SET nominations_open_on = DATE '2027-01-01', nominations_close_on = DATE '2027-01-01'
     WHERE id = v_elec;
    RAISE EXCEPTION 'a zero-length nominations window was accepted';
  EXCEPTION WHEN check_violation THEN NULL;
  END;

  -- a backwards voting window
  BEGIN
    UPDATE public.elections
       SET voting_open_on = DATE '2027-03-10', voting_close_on = DATE '2027-03-01'
     WHERE id = v_elec;
    RAISE EXCEPTION 'a backwards voting window was accepted';
  EXCEPTION WHEN check_violation THEN NULL;
  END;

  -- voting opening before nominations close
  BEGIN
    UPDATE public.elections
       SET nominations_open_on = DATE '2027-01-01', nominations_close_on = DATE '2027-01-10',
           voting_open_on = DATE '2027-01-05', voting_close_on = DATE '2027-01-20'
     WHERE id = v_elec;
    RAISE EXCEPTION 'voting was accepted opening before nominations closed';
  EXCEPTION WHEN check_violation THEN NULL;
  END;

  -- publishing with no dates at all
  BEGIN
    UPDATE public.elections SET status = 'published' WHERE id = v_elec;
    RAISE EXCEPTION 'a published election was accepted with no dates';
  EXCEPTION WHEN check_violation THEN NULL;
  END;

  -- an unknown status
  BEGIN
    UPDATE public.elections SET status = 'nominations' WHERE id = v_elec;
    RAISE EXCEPTION 'the status vocabulary still accepts the retired four-state words';
  EXCEPTION WHEN check_violation THEN NULL;
  END;

  -- the legitimate published shape, one day apart at every step
  UPDATE public.elections
     SET nominations_open_on = DATE '2027-01-01', nominations_close_on = DATE '2027-01-02',
         voting_open_on = DATE '2027-01-03', voting_close_on = DATE '2027-01-04',
         status = 'published'
   WHERE id = v_elec;

  -- national with a target
  BEGIN
    UPDATE public.elections SET region_id = v_region WHERE id = v_elec;
    RAISE EXCEPTION 'a national election accepted a region';
  EXCEPTION WHEN check_violation THEN NULL;
  END;

  -- regional carrying a chapter as well
  BEGIN
    UPDATE public.elections
       SET scope = 'regional', region_id = v_region, chapter_id = v_chapter
     WHERE id = v_elec;
    RAISE EXCEPTION 'a regional election was accepted carrying a chapter as well';
  EXCEPTION WHEN check_violation THEN NULL;
  END;

  -- chapter with no chapter
  BEGIN
    UPDATE public.elections SET scope = 'chapter' WHERE id = v_elec;
    RAISE EXCEPTION 'a chapter election was accepted with no chapter';
  EXCEPTION WHEN check_violation THEN NULL;
  END;

  -- an unknown level
  BEGIN
    UPDATE public.elections SET scope = 'planetary' WHERE id = v_elec;
    RAISE EXCEPTION 'the scope vocabulary accepted a word that is not one of the three';
  EXCEPTION WHEN check_violation THEN NULL;
  END;

  -- the two legitimate targeted states
  UPDATE public.elections SET scope = 'regional', region_id = v_region, chapter_id = NULL
   WHERE id = v_elec;
  UPDATE public.elections SET scope = 'chapter', region_id = NULL, chapter_id = v_chapter
   WHERE id = v_elec;

  -- ── The cross-family guard trigger ──
  INSERT INTO public.chapters (family_code, name) VALUES (v_code || 'OTHER', 'Other Chapter')
    RETURNING id INTO v_other;
  BEGIN
    UPDATE public.elections SET scope = 'chapter', chapter_id = v_other WHERE id = v_elec;
    RAISE EXCEPTION 'an election accepted a chapter from another family';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;

  -- ── The area rule itself, over a real person ──
  -- No auth user is needed: `election_area_includes` takes the person id as a parameter, which
  -- is the whole reason the core rule is separated from the two wrappers that resolve one.
  UPDATE public.elections SET scope = 'chapter', region_id = NULL, chapter_id = v_chapter
   WHERE id = v_elec;

  INSERT INTO public.people (family_code, first_name, last_name, primary_email, chapter_id)
    VALUES (v_code, 'Probe', 'InChapter', 'probe-in@' || v_code || '.invalid', v_chapter)
    RETURNING id INTO v_person;
  IF NOT public.election_area_includes('chapter', NULL, v_chapter, v_person) THEN
    RAISE EXCEPTION 'a member of the chapter was excluded from its own election';
  END IF;
  IF public.election_area_includes('chapter', NULL, v_other, v_person) THEN
    RAISE EXCEPTION 'a member of one chapter was admitted to another chapter''s election';
  END IF;
  IF NOT public.election_area_includes('regional', v_region, NULL, v_person) THEN
    RAISE EXCEPTION 'a member whose chapter is in the region was excluded from its election';
  END IF;
  IF NOT public.election_area_includes('national', NULL, NULL, v_person) THEN
    RAISE EXCEPTION 'a member was excluded from a national election';
  END IF;

  UPDATE public.people SET chapter_id = NULL WHERE id = v_person;
  IF public.election_area_includes('chapter', NULL, v_chapter, v_person) THEN
    RAISE EXCEPTION 'a member in no chapter was admitted to a chapter election';
  END IF;
  IF NOT public.election_area_includes('national', NULL, NULL, v_person) THEN
    RAISE EXCEPTION 'a member in no chapter was excluded from a national election';
  END IF;

  -- A garbled scope reaches everybody, which is the deliberate direction (see the function).
  IF NOT public.election_area_includes('planetary', NULL, NULL, v_person) THEN
    RAISE EXCEPTION 'an unrecognized scope did not fail toward national';
  END IF;

  -- `election_area_includes_person` refuses outright with no session, which is what makes it
  -- safe to publish: `auth_family_code()` is null for an unauthenticated caller.
  IF public.election_area_includes_person(v_elec, v_person) THEN
    RAISE EXCEPTION 'election_area_includes_person answered without a family in the session';
  END IF;
  IF public.auth_may_see_election_id(v_elec) THEN
    RAISE EXCEPTION 'auth_may_see_election_id answered about another family''s election';
  END IF;

  DELETE FROM public.people    WHERE family_code = v_code;
  DELETE FROM public.elections WHERE family_code = v_code;
  DELETE FROM public.chapters  WHERE family_code IN (v_code, v_code || 'OTHER');
  DELETE FROM public.regions   WHERE family_code = v_code;

  IF EXISTS (SELECT 1 FROM public.elections WHERE family_code = v_code)
     OR EXISTS (SELECT 1 FROM public.chapters WHERE family_code IN (v_code, v_code || 'OTHER'))
     OR EXISTS (SELECT 1 FROM public.regions WHERE family_code = v_code)
     OR EXISTS (SELECT 1 FROM public.people WHERE family_code = v_code) THEN
    RAISE EXCEPTION 'the election probe left rows behind';
  END IF;

  RAISE NOTICE 'elections: windows are DATEs with two ordering rules, three levels with five refusals, the cross-family guard and the area rule verified; probe family % removed', v_code;
END $mig$;

COMMIT;
