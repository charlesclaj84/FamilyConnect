-- ============================================================================
-- A candidacy is one row. The people who put it forward are many.
--
-- ── THE PRODUCT CHANGE THIS IS UNDERNEATH ───────────────────────────────────
-- The member's election screen is being rebuilt around POSITIONS: each office on the ballot,
-- and under it the people standing for it. Adding somebody is a dialog; taking your own name
-- off a nomination you made is a control on the row. And the sentence that forces a schema
-- change is this one:
--
--     "if more than myself nominated them they remain in the list"
--
-- `election_nominations` cannot say that. It is UNIQUE (election_id, position_id, nominee_id)
-- with a single `nominated_by`, so "who nominated this person" has exactly one answer and
-- retracting it can only mean deleting the candidacy out from under everybody else who
-- wanted it.
--
-- ── WHY A JUNCTION TABLE AND NOT A LOOSER UNIQUE CONSTRAINT ─────────────────
-- The obvious cheaper move is to widen the constraint to (election_id, position_id,
-- nominee_id, nominated_by) so one nominee can hold several rows. It does not work, and the
-- reason is `accepted`:
--
--   * ACCEPTANCE IS A PROPERTY OF THE CANDIDACY, NOT OF THE ASKING. A nominee accepts
--     standing for an office once. With a row per nominator, `accepted` is per-row — so the
--     same person is simultaneously accepted (by the row Martha created) and pending (by the
--     row Joseph created), and every count, every ballot and every tally has to pick one.
--   * `election_votes` names a `nominee_id`, not a nomination. `castVote` checks there is an
--     ACCEPTED nomination for that (election, position, nominee); with several rows that
--     check has to decide what "accepted" means across them, which is the same question again.
--
-- So the candidacy stays one row and the nominators become a set. That is what this table is.
--
--   election_nominations              the CANDIDACY   — who is standing, for what, accepted?
--   election_nomination_supporters    the ASKING      — who put them forward, and when
--
-- `election_nominations.nominated_by` STAYS, as provenance: who first put them forward. It is
-- not the authority on the set any more, and §5 backfills a supporter row from every one of
-- them so the two never disagree about the first name.
--
-- ── THE RULE THE TABLE EXISTS TO EXPRESS, IN ONE SENTENCE ───────────────────
-- **You may retract a nomination you made.** Not one somebody else made, and not one the
-- nominee has already accepted. If other people nominated the same person for the same
-- position, they stay on the list — you have only taken your own name off it.
--
-- ONE CARVE-OUT, and it is what "withdraw my own nomination" means: the accepted-block does
-- NOT apply when the caller is the nominee. A self-nomination is auto-accepted by
-- `submitNomination`, so without this the one person guaranteed to be able to put themselves
-- forward could never take themselves back off. Their acceptance is their own to reverse.
--
-- AFTER NOMINATIONS CLOSE, NOBODY RETRACTS ANYTHING. Both write policies test
-- `election_window_open(election_id, 'nominations')`, which is the same boundary the
-- nomination INSERT has had since 20260821000001. Two reasons, and the second is the one that
-- would bite: the ballot a family is voting on must not change under them, and
-- `election_votes.nominee_id` references `people` rather than a nomination — so a candidacy
-- deleted mid-poll would leave votes cast for somebody who is no longer standing, with
-- nothing in the schema to notice. The way off the ballot once nominations have closed is
-- DECLINE (`accepted = false`), which preserves the record of having been asked.
--
-- ── §2c: THREE POLICIES, BECAUSE HERE RLS CAN ACTUALLY DO THE WORK ──────────
-- Gatherings' six tables carry one SELECT policy each and route every write through an action
-- on the service role, and AGENTS.md sanctions that shape. This table does NOT copy it,
-- deliberately: both of its rules are predicates over the row being written, which is exactly
-- what a policy is for. "You may only speak for yourself" is `person_id =
-- auth_person_id()`; "not once they have accepted" is one EXISTS against the parent. Written
-- as policies they are the boundary rather than a courtesy, and `tests/rls` can attack them.
--
-- There is NO UPDATE policy and no UPDATE path. A support row is a fact with a timestamp;
-- there is nothing on it to change, and per §2c a table with no policy for a command denies
-- that command to the browser outright.
--
-- ── `election_id` IS DENORMALISED ONTO THE ROW, AND GUARDED ─────────────────
-- It is derivable through `nomination_id`, and it is stored anyway so the three policies can
-- call `election_window_open(election_id, …)` and `auth_may_see_election_id(election_id)`
-- directly instead of joining to the parent inside every predicate. Same bargain
-- `gathering_tasks` takes with `family_code`. `tg_nomination_supporter_guard` is what stops
-- the copy drifting, and it is AGENTS.md §4 in the database: a row whose `election_id` is one
-- the caller may act in, pointing at a `nomination_id` in an election they may not, would
-- satisfy every policy here.
--
-- ── AND THE GRANT THAT MADE THIS FEATURE HALF-WORK ─────────────────────────
-- §6. `submitNomination`'s own header says "Any approved member may nominate — `create`
-- defaults to scope 'none', so demanding a grant would leave nobody able to stand for
-- anything." The ACTION is written that way — `requireMember()`, no grant check — but the
-- INSERT policy underneath it reads
--
--     nominee_id = auth_person_id()
--       OR auth_permission('community/elections', 'create') = 'any'
--       OR (… = 'own' AND nominated_by = auth_person_id())
--
-- and the General template grants `create` at 'none'. So the self-expression was carrying the
-- whole feature: **an ordinary member could nominate only themselves.** Nominating a relative
-- was refused with 42501 — honestly, since an INSERT refused by RLS raises rather than
-- reporting zero rows (§8b), but refused. The dialog this rebuild adds would have been a
-- dialog that does not work for anybody outside the Administrators template.
--
-- 20260820000007's pattern, and its two bounds: `is_system` templates only, because a custom
-- grid is one an administrator built and looked at; and only where the cell still reads
-- 'none', so a family that had already widened it keeps what they chose.
--
-- ── CHECKED BY MUTATION, per AGENTS.md §7 ──────────────────────────────────
-- Eleven mutations, each applied on its own and reverted before the next, with §8 and §9 run
-- against the mutated schema. Every one aborted with the message named beside it below, and
-- the clean file prints both NOTICEs. §8's assertions are catalogue reads and §9's are live
-- rows, so neither needed a full `db reset` per mutation — `ALTER POLICY` / `DROP TRIGGER` /
-- `CREATE OR REPLACE FUNCTION` reach exactly what each one asserts about.
--
-- §8, the catalogue:
--   the person_id pin dropped from the INSERT policy
--     ERROR: the support INSERT policy does not pin person_id to the caller
--   the window conjunct dropped from the DELETE policy
--     ERROR: the support DELETE policy does not test the nominations window
--   the acceptance test dropped from the DELETE policy
--     ERROR: the support DELETE policy does not test acceptance
--   the nominee carve-out dropped from the DELETE policy
--     ERROR: the support DELETE policy does not carry the nominee carve-out
--   an UPDATE policy added
--     ERROR: election_nomination_supporters must have no UPDATE path — found policy for: UPDATE
--   either trigger dropped
--     ERROR: election_nomination_supporters is missing trigger(s): …_drop_orphan
--     ERROR: election_nominations is missing trigger election_nominations_seed_supporter
--   §6's grant reverted to 'none'
--     ERROR: the General template still cannot nominate a relative in family/families: …
--
-- §9, the live rows:
--   the seed trigger dropped     VERIFY: the first supporter was not seeded by the candidacy insert
--   the drop trigger dropped     VERIFY: the candidacy survived the retraction of its last supporter
--   the guard trigger dropped    VERIFY: the guard allowed a supporter row on the wrong election
--   the drop trigger made over-eager (its NOT EXISTS conjunct removed)
--                                VERIFY: the candidacy was dropped while another supporter still
--                                        stood behind it
--
-- TWO OF §8's ASSERTIONS FIRED FOR REAL WHILE THIS FILE WAS BEING WRITTEN, which is the best
-- evidence any of them are live: the seeder staleness check matched a single-spaced literal
-- against a column-aligned VALUES list, and the search_path check matched `search_path=`
-- against a proconfig that reads `search_path=""`. Both reported a fault in code that was
-- correct. Their comments carry what the pattern has to be.
--
-- ── AND THE POLICIES THEMSELVES ARE MUTATION-CHECKED THROUGH `tests/rls` ────
-- §8 asserts a policy's TEXT and §9 asserts the triggers' BEHAVIOUR; neither can say a policy
-- refuses the right caller, because a migration runs as the table owner and RLS does not apply
-- to the owner. That is `tests/rls`' job, and every conjunct of §4c was checked by deleting it
-- and re-running the suite:
--
--   the person_id pin removed
--     `raw:election_nomination_supporters DELETE (somebody else's nomination)` goes red,
--     and NOTHING ELSE DOES — see the next paragraph, which is the finding.
--   the acceptance test removed
--     `elections.retractNomination (one the nominee has accepted)` attack + told go red
--   the nominee carve-out removed
--     the same case's CONTROL goes red: "owner's own write did nothing"
--   the nominations window removed
--     `elections.retractNomination (after nominations closed)` attack + told go red
--   §6's grant reverted in the seeder (not in the rows — `seed()` recreates the family, so
--   the trigger reseeds the grid and a row-level revert is wiped before the run)
--     both `elections.submitNomination` controls go red; the third stays green, because it is
--     a SELF-nomination and that is exactly the branch an ordinary member could satisfy before
--     this migration
--
-- ── THE FINDING: AN ACTION THAT NARROWS BY HAND HIDES ITS OWN POLICY ───────
-- `retractNomination` states `.eq('person_id', g.personId)` in its statement — belt on this
-- policy's brace, and worth keeping, because without it the DELETE asks to remove EVERY
-- supporter of the nomination and is narrowed to one row only by the policy. But it means no
-- action-shaped case can reach the `person_id = auth_person_id()` conjunct at all: the action
-- narrows before PostgREST sees the request, so with that conjunct DELETED all ten
-- action-shaped retraction assertions stayed green. Measured, not reasoned about.
--
-- The answer is a RAW probe — `tests/rls/raw/elections.mjs`, `deleteNominationSupport` — which
-- sends what the action refuses to send. It is the same lesson that file's own header records
-- about the area rule, arriving from the opposite direction: there, an app-layer filter made an
-- action-shaped case blind; here it is the action's own belt. **Whenever an action narrows a
-- write by hand, the policy underneath it needs a raw case or it is untested.**
--
-- ONE MORE, ON THE ACTION RATHER THAN THE SCHEMA: `confirmWrite` neutered in
-- `retractNomination` turns all three `told` lines red and leaves every `attack` line green —
-- perfectly isolated, and lying to the caller about whether their name came off a ballot.
-- AGENTS.md §8b in one measurement.
--
-- ── AND ONE ASSERTION IS VACUOUS ON A FRESH DATABASE, WHICH IS WHY §9 EXISTS ─
-- §8's invariant check — "every candidacy naming a nominated_by has that nominator as a
-- supporter" — walks `election_nominations`, and a database this file has just migrated has
-- NO nominations in it. So on every `db reset` it passes over zero rows, and it would pass
-- just as happily with §3a's trigger and §5's backfill both deleted. That is precisely the
-- shape AGENTS.md warns about ("a verify block that can skip must not be the only check"),
-- and it is not fixable by rewording: the rows it is about arrive from the product, months
-- later. §9 is the answer — it CREATES the rows, in a subtransaction it then unwinds, so the
-- invariant is exercised on every single run instead of only on a database that happens to
-- have data. The mutation results above are the proof: dropping §3a's trigger is invisible to
-- §8 and fatal to §9.
--
-- HOW THIS REACHES A DATABASE
--   `supabase db push`, from CI on merge to master — never `psql -f` by hand. See AGENTS.md,
--   "How migrations reach the hosted project".
-- ============================================================================

BEGIN;

-- ── 1. The table ────────────────────────────────────────────────────────────
-- PRIMARY KEY (nomination_id, person_id) is the whole of "one person, one nomination": a
-- second press of the same button is a 23505 the action turns into a sentence, not a second
-- row inflating a count.
--
-- BOTH FOREIGN KEYS TO A PARENT CASCADE, and they mean different things. `nomination_id`
-- ON DELETE CASCADE is the candidacy going and taking its supporters with it — which is what
-- happens when a nominee withdraws or an organizer deletes the election. `election_id`
-- ON DELETE CASCADE is redundant beside it (the nomination cascades from the election too)
-- and is stated so the column cannot outlive the row it names.
--
-- `person_id` ON DELETE CASCADE: a person removed from the family stops having nominated
-- anybody. That is the same choice `election_votes.voter_id` makes, and §3's drop trigger is
-- what then retires a candidacy whose last supporter has left.
CREATE TABLE IF NOT EXISTS public.election_nomination_supporters (
  nomination_id uuid        NOT NULL REFERENCES public.election_nominations(id) ON DELETE CASCADE,
  election_id   uuid        NOT NULL REFERENCES public.elections(id)            ON DELETE CASCADE,
  person_id     uuid        NOT NULL REFERENCES public.people(id)               ON DELETE CASCADE,
  created_at    timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (nomination_id, person_id)
);

-- The read this table exists for is "every supporter of every candidacy on this election",
-- issued once per screen. The PK serves lookups by nomination; this serves that one.
CREATE INDEX IF NOT EXISTS election_nomination_supporters_election_idx
  ON public.election_nomination_supporters (election_id);

-- And the read behind every delete control: "which of these did I nominate?"
CREATE INDEX IF NOT EXISTS election_nomination_supporters_person_idx
  ON public.election_nomination_supporters (person_id);

ALTER TABLE public.election_nomination_supporters ENABLE ROW LEVEL SECURITY;

-- ── 2. The guard trigger — AGENTS.md §4 in the database ─────────────────────
-- Two ids arrive from a caller on every insert and neither is checked by any policy above:
--
--   `election_id`   a policy tests THIS column, so a row naming an election the caller may
--                   act in while its `nomination_id` points into another one satisfies every
--                   predicate here and is filed under the wrong ballot. This is the
--                   denormalisation's whole cost and this is what pays it.
--   `person_id`     the INSERT policy pins it to `auth_person_id()`, so a browser cannot get
--                   this wrong — but the SERVICE ROLE ignores RLS and does not ignore
--                   triggers, and `20260821000001`'s backfill and any future admin-client
--                   write land here. A supporter from another family is a name on a ballot
--                   that family cannot see.
--
-- SECURITY DEFINER with an empty search_path: it reads `election_nominations`, `elections`
-- and `people` rows the calling role may not be able to see, and the answer must not depend
-- on that. ERRCODE 23514 with a distinctive message, so a verify block can tell it from a
-- CHECK. A trigger function needs no GRANT — EXECUTE is checked at CREATE TRIGGER time.
CREATE OR REPLACE FUNCTION public.tg_nomination_supporter_guard()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_parent_election uuid;
  v_election_family text;
  v_person_family   text;
BEGIN
  SELECT n.election_id INTO v_parent_election
    FROM public.election_nominations n WHERE n.id = NEW.nomination_id;
  IF v_parent_election IS NULL THEN
    RAISE EXCEPTION 'election_nomination_supporters: nomination % does not exist',
      NEW.nomination_id USING ERRCODE = '23514';
  END IF;
  IF v_parent_election IS DISTINCT FROM NEW.election_id THEN
    RAISE EXCEPTION
      'election_nomination_supporters: nomination % is on election %, not % — the denormalised election_id must match its parent',
      NEW.nomination_id, v_parent_election, NEW.election_id USING ERRCODE = '23514';
  END IF;

  SELECT e.family_code INTO v_election_family
    FROM public.elections e WHERE e.id = NEW.election_id;
  SELECT p.family_code INTO v_person_family
    FROM public.people p WHERE p.id = NEW.person_id;
  IF v_person_family IS DISTINCT FROM v_election_family THEN
    RAISE EXCEPTION
      'election_nomination_supporters: person % belongs to family %, and election % to %',
      NEW.person_id, COALESCE(v_person_family, 'missing'),
      NEW.election_id, COALESCE(v_election_family, 'missing')
      USING ERRCODE = '23514';
  END IF;

  RETURN NEW;
END $$;

REVOKE ALL ON FUNCTION public.tg_nomination_supporter_guard() FROM PUBLIC;

DROP TRIGGER IF EXISTS election_nomination_supporters_guard
  ON public.election_nomination_supporters;
CREATE TRIGGER election_nomination_supporters_guard
  BEFORE INSERT OR UPDATE ON public.election_nomination_supporters
  FOR EACH ROW EXECUTE FUNCTION public.tg_nomination_supporter_guard();

-- ── 3. The two triggers that keep the invariant ─────────────────────────────
-- **A candidacy exists exactly while somebody supports it.** That is a database invariant
-- rather than business logic, which is why it is here and not in an action: an action that
-- forgets half of it leaves either a candidacy nobody asked for or a nomination that vanished
-- while two people still wanted it.
--
-- 3a. The FIRST supporter is written by the insert of the candidacy itself, so the common
--     case — one member nominating one relative — is a single statement through the USER
--     client with the INSERT policy as its boundary, and there is no window in which the
--     candidacy exists with an empty supporter list. Doing this in the action instead would
--     be two writes on two clients and a §8b-shaped apology when the second failed.
CREATE OR REPLACE FUNCTION public.tg_nomination_seed_supporter()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  -- `nominated_by` is nullable (ON DELETE SET NULL, and an organizer-authored row need not
  -- name anybody). A candidacy with no supporters is legitimate and simply offers no
  -- retract control to anyone; inventing a supporter would be inventing a fact.
  IF NEW.nominated_by IS NOT NULL THEN
    INSERT INTO public.election_nomination_supporters (nomination_id, election_id, person_id)
    VALUES (NEW.id, NEW.election_id, NEW.nominated_by)
    ON CONFLICT (nomination_id, person_id) DO NOTHING;
  END IF;
  RETURN NULL;
END $$;

REVOKE ALL ON FUNCTION public.tg_nomination_seed_supporter() FROM PUBLIC;

DROP TRIGGER IF EXISTS election_nominations_seed_supporter ON public.election_nominations;
CREATE TRIGGER election_nominations_seed_supporter
  AFTER INSERT ON public.election_nominations
  FOR EACH ROW EXECUTE FUNCTION public.tg_nomination_seed_supporter();

-- 3b. The last retraction takes the candidacy with it, which is the other half of "if more
--     than myself nominated them they remain in the list" — read the other way round, if
--     only I nominated them, they do NOT remain.
--
-- IT IS A TRIGGER AND NOT AN ACTION for one reason worth stating: it means the action only
-- ever writes THIS table, through one policy, in one statement. The alternative is an action
-- that reads the supporter list, decides whether it is the last one, and then deletes either
-- a support row or a candidacy — two code paths, a race between two members retracting at
-- once, and a DELETE on `election_nominations` that the composed policy would refuse anyway
-- unless the caller happened to be the nominee or the original `nominated_by`.
--
-- THE CASCADE CANNOT LOOP. When a candidacy is deleted directly, `nomination_id`'s ON DELETE
-- CASCADE removes its supporters and fires this per row; the DELETE below then matches
-- nothing, because the parent is already gone within the same command. The `NOT EXISTS`
-- conjunct is what makes that a no-op rather than an error, and it is also the real predicate:
-- a supporter leaving a candidacy that still has others must not touch it.
CREATE OR REPLACE FUNCTION public.tg_nomination_drop_when_unsupported()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  DELETE FROM public.election_nominations n
   WHERE n.id = OLD.nomination_id
     AND NOT EXISTS (
       SELECT 1 FROM public.election_nomination_supporters s
        WHERE s.nomination_id = OLD.nomination_id);
  RETURN NULL;
END $$;

REVOKE ALL ON FUNCTION public.tg_nomination_drop_when_unsupported() FROM PUBLIC;

DROP TRIGGER IF EXISTS election_nomination_supporters_drop_orphan
  ON public.election_nomination_supporters;
CREATE TRIGGER election_nomination_supporters_drop_orphan
  AFTER DELETE ON public.election_nomination_supporters
  FOR EACH ROW EXECUTE FUNCTION public.tg_nomination_drop_when_unsupported();

-- ── 4. The three policies ───────────────────────────────────────────────────
-- 4a. SELECT mirrors `perm:family can view nominations` conjunct for conjunct — the area
--     rule, the family, and the same view expression with `person_id` where that policy has
--     `nominated_by`. It has to: a screen that can see a candidacy and not who asked for it
--     would render every retract control wrong, and a screen that can see supporters for a
--     candidacy it cannot see is a leak the parent policy already refused.
DROP POLICY IF EXISTS "perm:family can view nomination supporters"
  ON public.election_nomination_supporters;
CREATE POLICY "perm:family can view nomination supporters"
  ON public.election_nomination_supporters FOR SELECT TO authenticated
  USING (
    public.auth_may_see_election_id(election_id)
    AND election_id IN (SELECT e.id FROM public.elections e
                         WHERE e.family_code = public.auth_family_code())
    AND (
      (person_id = public.auth_person_id())                                        -- self_expr
      OR public.auth_permission('community/elections', 'view'::public.permission_action) = 'any'
      OR (public.auth_permission('community/elections', 'view'::public.permission_action) = 'own'
          AND (person_id = public.auth_person_id()))                               -- own_expr
    )
  );

-- 4b. INSERT. `person_id = auth_person_id()` is a CONJUNCT and not one of the alternatives,
--     which is the difference between this policy and the one on the parent: you may add your
--     own name to a nomination and nobody else's. Putting words in another member's mouth is
--     not a thing a grant should be able to buy, so no scope widens it.
--
--     The EXISTS is the authority test, and it mirrors the parent's: you may support a
--     candidacy that is your own, or one you would have been allowed to create. `create` has
--     no own/any distinction in the grid, so 'any' is the only grant that reads here — and §6
--     is what gives the General template one.
--
--     `auth_may_see_election_id` is the CALLER's area check. The candidacy's own area was
--     settled by `election_area_includes_person` when it was created; this is the other side
--     of it, and without it a National member could second a chapter's candidate.
DROP POLICY IF EXISTS "perm:family can support a nomination"
  ON public.election_nomination_supporters;
CREATE POLICY "perm:family can support a nomination"
  ON public.election_nomination_supporters FOR INSERT TO authenticated
  WITH CHECK (
    person_id = public.auth_person_id()
    AND public.auth_membership_approved()
    AND public.election_window_open(election_id, 'nominations')
    AND public.auth_may_see_election_id(election_id)
    AND EXISTS (
      SELECT 1 FROM public.election_nominations n
       WHERE n.id = nomination_id
         AND (n.nominee_id = public.auth_person_id()
              OR public.auth_permission('community/elections',
                                        'create'::public.permission_action) = 'any')
    )
  );

-- 4c. DELETE — the rule this whole file is for, stated once, in SQL.
--
--     `person_id = auth_person_id()`: your own name only.
--     the window: nobody rewrites a ballot that is being voted on.
--     the EXISTS: not once the nominee has accepted — UNLESS the caller IS the nominee, which
--                 is the one carve-out and is what "withdraw my own nomination" means. A
--                 self-nomination is auto-accepted, so without it the person guaranteed to be
--                 able to stand could never stand down.
DROP POLICY IF EXISTS "perm:family can retract a nomination"
  ON public.election_nomination_supporters;
CREATE POLICY "perm:family can retract a nomination"
  ON public.election_nomination_supporters FOR DELETE TO authenticated
  USING (
    person_id = public.auth_person_id()
    AND public.auth_membership_approved()
    AND public.election_window_open(election_id, 'nominations')
    AND EXISTS (
      SELECT 1 FROM public.election_nominations n
       WHERE n.id = nomination_id
         AND (n.accepted IS NOT TRUE OR n.nominee_id = public.auth_person_id())
    )
  );

-- ── 4d. Table grants, stated ────────────────────────────────────────────────
-- Per §2c these record what the table is FOR and are not what makes it safe: Supabase's
-- default ACL on `public` already hands both browser roles everything before this file runs,
-- and `supabase/seed.sql` re-grants after every local reset. RLS above is the entire
-- boundary. Written out anyway, for 20260811000000's and 20260819000000's reason — a reader
-- should be able to see the intended shape without deriving it from four policies.
--
-- NO UPDATE, deliberately, matching the absence of an UPDATE policy.
GRANT SELECT, INSERT, DELETE ON public.election_nomination_supporters TO authenticated;
GRANT ALL                    ON public.election_nomination_supporters TO service_role;

-- ── 5. Backfill: every existing candidacy keeps its first nominator ─────────
-- Without this, every nomination made before today has an empty supporter list — so the
-- rebuilt screen would offer no retract control on any of them and §8's invariant assertion
-- would be false the moment it ran. §3a's trigger covers rows written from now on; this is
-- the ones already there.
--
-- The guard trigger fires on these too, which is the point: if any existing row's
-- `nominated_by` points into another family, this migration ABORTS rather than copying the
-- fault forward. That is `audit_cross_family_refs.sql`'s finding class arriving as a failed
-- deploy instead of a blank name on a screen.
INSERT INTO public.election_nomination_supporters (nomination_id, election_id, person_id)
SELECT n.id, n.election_id, n.nominated_by
  FROM public.election_nominations n
 WHERE n.nominated_by IS NOT NULL
ON CONFLICT (nomination_id, person_id) DO NOTHING;

-- ── 6. The General template may nominate a relative ─────────────────────────
-- See the header. The action has never demanded a grant; the policy underneath it has, and
-- the self-expression was hiding that by letting a self-nomination through. One row per
-- family fixes it, and the bounds are 20260820000007's:
--
--   * `is_system` ONLY. A custom template is a grid an administrator built while looking at
--     it, and a migration must not overrule a cell somebody set in a UI that showed them the
--     answer.
--   * ONLY WHERE IT STILL READS 'none'. A family that had already widened this keeps what
--     they chose; a backfill that overwrote a setting would be a silent change issued by a
--     migration whose purpose is to widen.
--   * NAME the template, because `is_system` is also true of Administrators — which already
--     holds 'any' and would be a no-op, but naming it is what makes the intent readable.
--
-- WHY 'any' AND NOT 'own'. `create` has no own/any distinction anywhere in the model —
-- `SCOPES_FOR.create` is ['none', 'any'] and the grid renders two buttons — because you
-- cannot own a record you are about to make. What bounds a nomination is not a scope: it is
-- `election_area_includes_person`, which refuses a nominee outside the election's level, and
-- the nominations window. Both are in the INSERT policy already.
UPDATE public.template_permissions tp
   SET scope = 'any', updated_at = now()
  FROM public.permission_templates t
 WHERE t.id = tp.template_id
   AND t.is_system
   AND t.name = 'General'
   AND tp.resource_key = 'community/elections'
   AND tp.action = 'create'
   AND tp.scope = 'none';

-- ── 7. `seed_family_permission_templates()` grants it to families created later ──
-- §6 covers the families that exist. This is the one that covers tomorrow's, and it is the
-- half 20260820000007's header calls out as the easy one to forget: without it, only families
-- created before this migration can nominate each other.
--
-- CREATE OR REPLACE TAKES A WHOLE BODY, so this is copied from the NEWEST definition —
-- `grep -l 'FUNCTION public.seed_family_permission_templates' supabase/migrations/*.sql`,
-- newest wins, which is 20260821000000 — with ONE row added to the General VALUES list and
-- nothing else touched. §8 asserts every grant an earlier migration added is still named, so
-- copying from a stale definition fails the deploy rather than silently dropping a grant.
CREATE OR REPLACE FUNCTION public.seed_family_permission_templates(p_family_code text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_admins  uuid;
  v_general uuid;
  v_claims  jsonb := NULLIF(current_setting('request.jwt.claims', true), '')::jsonb;
  v_jwt     text  := COALESCE(v_claims ->> 'role', '');
  v_guc     text  := COALESCE(NULLIF(current_setting('role', true), 'none'), '');
  -- Non-admin resources that still start restricted. Everything family-wide about other
  -- members' money belongs here; a page of the family's own records does not — which is
  -- exactly why `community/family-tree` is NOT on this list, however family-wide the canvas
  -- is. `community/elections` is not on it either, and for a sharper reason: a ballot the
  -- family cannot see is not a ballot.
  v_restricted text[] := ARRAY['reporting/dues-projections', 'gatherings/budget',
                               'reporting/membership'];
BEGIN
  IF p_family_code IS NULL OR p_family_code = '' THEN
    RETURN;
  END IF;

  -- Gate 1: not callable from a browser, except by arriving through the trigger.
  IF pg_trigger_depth() = 0
     AND (v_jwt IN ('anon', 'authenticated') OR v_guc IN ('anon', 'authenticated'))
  THEN
    RAISE EXCEPTION
      'seed_family_permission_templates() is not callable by % — templates are seeded by the families trigger',
      COALESCE(NULLIF(v_jwt, ''), v_guc)
      USING ERRCODE = 'insufficient_privilege';
  END IF;

  -- Gate 2: the write amplification. permission_templates.family_code has no foreign
  -- key, so without this any string is a valid target for a few hundred rows.
  IF NOT EXISTS (SELECT 1 FROM public.families f WHERE f.family_code = p_family_code)
     AND NOT EXISTS (SELECT 1 FROM public.people p WHERE p.family_code = p_family_code)
  THEN
    RAISE EXCEPTION 'seed_family_permission_templates(): no such family %', p_family_code
      USING ERRCODE = 'foreign_key_violation';
  END IF;

  INSERT INTO public.permission_templates (family_code, name, description, is_system) VALUES
    (p_family_code, 'Administrators',
     'Full access to every page and action, including who else may do what.', true),
    (p_family_code, 'General',
     'Everyone else. Reads the family, manages only their own records.', true)
  ON CONFLICT (family_code, name) DO NOTHING;

  SELECT id INTO v_admins  FROM public.permission_templates
   WHERE family_code = p_family_code AND name = 'Administrators';
  SELECT id INTO v_general FROM public.permission_templates
   WHERE family_code = p_family_code AND name = 'General';

  -- Admin pages start restricted, and so does anything in v_restricted. This is what
  -- makes the General grid below deny them, and it stays the default for any resource a
  -- later migration adds.
  INSERT INTO public.resource_visibility (family_code, resource_key, visibility)
  SELECT p_family_code, pr.key, 'restricted'
    FROM public.permission_resources pr
   WHERE pr.category = 'admin' OR pr.key = ANY(v_restricted)
  ON CONFLICT (family_code, resource_key) DO NOTHING;

  -- Administrators: 'any' on every action each resource actually declares.
  INSERT INTO public.template_permissions (template_id, resource_key, action, scope)
  SELECT v_admins, pr.key, a::public.permission_action, 'any'
    FROM public.permission_resources pr
   CROSS JOIN LATERAL unnest(pr.actions) AS a
  ON CONFLICT (template_id, resource_key, action) DO NOTHING;

  -- General: the family-facing pages, and only their own records. Stated for every
  -- resource and action rather than left to fall through, because the grid on the
  -- screen is now the whole answer and a blank cell would be a lie.
  --
  -- The EXISTS guard on the literal list is load-bearing: resource_key is a foreign
  -- key, so naming one a later migration renamed would abort the INSERT and — through
  -- the trigger — the family creation that called it.
  --
  -- `community/elections` / `create` IS THE ROW 20260821000004 ADDED, and it is 'any' for
  -- the reason `community/family-tree` / `edit` is: there is no own version of the act.
  -- Nominating is something a member does FOR somebody else by definition, and what bounds
  -- it is the election's area rule and its nominations window, both of which are conjuncts
  -- of the INSERT policy. Before that row an ordinary member could nominate only themselves,
  -- because the policy's self-expression was the only branch they could satisfy.
  INSERT INTO public.template_permissions (template_id, resource_key, action, scope)
  SELECT v_general, t.k, t.act, t.sc
    FROM (VALUES
      ('accounting/summary', 'view'::public.permission_action, 'own'::public.permission_scope),
      ('community/chat',   'create', 'any'),
      ('community/chat',   'edit',   'own'),
      ('community/chat',   'delete', 'own'),
      ('community/family-tree', 'edit', 'any'),
      ('community/elections', 'create', 'any'),
      ('review/photos',    'create', 'any'),
      ('review/photos',    'edit',   'own'),
      ('review/photos',    'delete', 'own')
    ) AS t(k, act, sc)
   WHERE EXISTS (SELECT 1 FROM public.permission_resources pr WHERE pr.key = t.k)
  ON CONFLICT (template_id, resource_key, action) DO NOTHING;

  -- The view default asks what the family has restricted rather than re-deriving it from the
  -- category (20260817000000 §3b). Same answer for every key that existed before, and 'none'
  -- for the ones named in v_restricted.
  INSERT INTO public.template_permissions (template_id, resource_key, action, scope)
  SELECT v_general, pr.key, a::public.permission_action,
         CASE
           WHEN a = 'view' AND NOT EXISTS (
                  SELECT 1 FROM public.resource_visibility rv
                   WHERE rv.family_code = p_family_code
                     AND rv.resource_key = pr.key
                     AND rv.visibility = 'restricted')
             THEN 'any'::public.permission_scope
           ELSE 'none'::public.permission_scope
         END
    FROM public.permission_resources pr
   CROSS JOIN LATERAL unnest(pr.actions) AS a
  ON CONFLICT (template_id, resource_key, action) DO NOTHING;
END $$;

-- Restated because CREATE OR REPLACE does not change privileges and this must stay
-- unreachable from a browser — 20260806000015 made grants the primary control, and
-- `service_role` keeps EXECUTE by default.
REVOKE ALL ON FUNCTION public.seed_family_permission_templates(text) FROM PUBLIC, anon, authenticated;

-- ── 8. The assertions ───────────────────────────────────────────────────────
-- Everything here runs against the catalogue and the rows this file just wrote, with no
-- fixture, so the block cannot report success by skipping (AGENTS.md, "A verify block that
-- can skip must not be the only check").
DO $mig$
DECLARE
  v_bad  text;
  v_n    int;
BEGIN
  -- The mutation that trips each of these, and the message it printed, is in the header.

  -- The table, its RLS, and the absence of an UPDATE path.
  IF NOT EXISTS (SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
                  WHERE n.nspname = 'public'
                    AND c.relname = 'election_nomination_supporters'
                    AND c.relrowsecurity) THEN
    RAISE EXCEPTION 'election_nomination_supporters has no row level security';
  END IF;

  SELECT string_agg(cmd, ', ' ORDER BY cmd) INTO v_bad
    FROM pg_policies
   WHERE schemaname = 'public' AND tablename = 'election_nomination_supporters'
     AND cmd IN ('UPDATE', 'ALL');
  IF v_bad IS NOT NULL THEN
    RAISE EXCEPTION
      'election_nomination_supporters must have no UPDATE path — found policy for: %', v_bad;
  END IF;

  SELECT count(*) INTO v_n FROM pg_policies
   WHERE schemaname = 'public' AND tablename = 'election_nomination_supporters';
  IF v_n <> 3 THEN
    RAISE EXCEPTION 'expected 3 policies on election_nomination_supporters, found %', v_n;
  END IF;

  -- THE THREE CONJUNCTS THE RULE IS MADE OF, asserted as TEXT in the policy expressions.
  -- Reading the catalogue rather than trusting the file, because a policy that applied is not
  -- a policy that says what the header claims — and each of these is a sentence in the header
  -- that would otherwise be documentation of an intention.
  SELECT with_check INTO v_bad FROM pg_policies
   WHERE schemaname = 'public' AND tablename = 'election_nomination_supporters'
     AND policyname = 'perm:family can support a nomination';
  IF v_bad IS NULL OR v_bad NOT LIKE '%person_id = auth_person_id()%' THEN
    RAISE EXCEPTION 'the support INSERT policy does not pin person_id to the caller';
  END IF;

  SELECT qual INTO v_bad FROM pg_policies
   WHERE schemaname = 'public' AND tablename = 'election_nomination_supporters'
     AND policyname = 'perm:family can retract a nomination';
  IF v_bad IS NULL OR v_bad NOT LIKE '%election_window_open%' THEN
    RAISE EXCEPTION 'the support DELETE policy does not test the nominations window';
  END IF;
  IF v_bad NOT LIKE '%accepted IS NOT TRUE%' THEN
    RAISE EXCEPTION 'the support DELETE policy does not test acceptance';
  END IF;
  IF v_bad NOT LIKE '%nominee_id = auth_person_id()%' THEN
    RAISE EXCEPTION 'the support DELETE policy does not carry the nominee carve-out';
  END IF;

  -- The three triggers.
  SELECT string_agg(t, ', ' ORDER BY t) INTO v_bad
    FROM unnest(ARRAY['election_nomination_supporters_guard',
                      'election_nomination_supporters_drop_orphan']) AS t
   WHERE NOT EXISTS (
     SELECT 1 FROM pg_trigger g
       JOIN pg_class c ON c.oid = g.tgrelid
      WHERE c.relname = 'election_nomination_supporters' AND g.tgname = t AND NOT g.tgisinternal);
  IF v_bad IS NOT NULL THEN
    RAISE EXCEPTION 'election_nomination_supporters is missing trigger(s): %', v_bad;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger g JOIN pg_class c ON c.oid = g.tgrelid
     WHERE c.relname = 'election_nominations'
       AND g.tgname = 'election_nominations_seed_supporter' AND NOT g.tgisinternal) THEN
    RAISE EXCEPTION 'election_nominations is missing trigger election_nominations_seed_supporter';
  END IF;

  -- THE INVARIANT, over the rows that actually exist: every candidacy naming a nominator has
  -- that nominator as a supporter. This is what §5 is for, and it is the assertion that turns
  -- a skipped backfill into a failed deploy rather than a screen with no retract controls.
  SELECT count(*) INTO v_n
    FROM public.election_nominations n
   WHERE n.nominated_by IS NOT NULL
     AND NOT EXISTS (SELECT 1 FROM public.election_nomination_supporters s
                      WHERE s.nomination_id = n.id AND s.person_id = n.nominated_by);
  IF v_n > 0 THEN
    RAISE EXCEPTION '% candidacy/candidacies name a nominated_by with no supporter row', v_n;
  END IF;

  -- And no supporter row disagrees with its parent about which election it is on. The guard
  -- trigger refuses this on write; this is the same question asked of the rows §5 wrote,
  -- which is the one batch the guard saw all at once.
  SELECT count(*) INTO v_n
    FROM public.election_nomination_supporters s
    JOIN public.election_nominations n ON n.id = s.nomination_id
   WHERE n.election_id IS DISTINCT FROM s.election_id;
  IF v_n > 0 THEN
    RAISE EXCEPTION '% supporter row(s) name a different election from their nomination', v_n;
  END IF;

  -- ── §6/§7: the General template can nominate somebody ─────────────────────
  -- Asserted per FAMILY rather than as a count, because "some rows were updated" is also
  -- true of an update that reached one family out of ten.
  SELECT string_agg(DISTINCT t.family_code, ', ') INTO v_bad
    FROM public.permission_templates t
    JOIN public.template_permissions tp ON tp.template_id = t.id
   WHERE t.is_system AND t.name = 'General'
     AND tp.resource_key = 'community/elections' AND tp.action = 'create'
     AND tp.scope <> 'any';
  IF v_bad IS NOT NULL THEN
    RAISE EXCEPTION
      'the General template still cannot nominate a relative in family/families: %', v_bad;
  END IF;

  -- The seeder carries every grant an earlier migration added, plus this one. The staleness
  -- check 20260820000003 introduced and 20260820000004 restated — it is what catches §7
  -- having been copied from a definition that predates a row somebody else put in.
  -- WHITESPACE IS STRIPPED BEFORE MATCHING, and that is not fussiness. The VALUES list in
  -- the body is column-aligned — `('review/photos',    'delete', 'own')` — so a pattern
  -- written with single spaces matches nothing and this assertion fires on a body that is
  -- perfectly correct. It did, on the first run of this file: the check is only worth having
  -- if a failure means what it says.
  IF NOT EXISTS (
    SELECT 1 FROM pg_proc pp JOIN pg_namespace n ON n.oid = pp.pronamespace
     WHERE n.nspname = 'public' AND pp.proname = 'seed_family_permission_templates'
       AND regexp_replace(pg_get_functiondef(pp.oid), '\s+', '', 'g') LIKE ALL (ARRAY[
             '%gatherings/budget%',
             '%community/family-tree%',
             '%reporting/membership%',
             '%(''review/photos'',''delete'',''own'')%',
             '%(''community/elections'',''create'',''any'')%'])
  ) THEN
    RAISE EXCEPTION 'seed_family_permission_templates() lost a grant an earlier migration added';
  END IF;

  IF has_function_privilege('anon', 'public.seed_family_permission_templates(text)', 'EXECUTE')
     OR has_function_privilege('authenticated', 'public.seed_family_permission_templates(text)', 'EXECUTE')
  THEN
    RAISE EXCEPTION 'seed_family_permission_templates() is executable by a browser role';
  END IF;

  -- ── §2b: the three trigger functions stay unreachable from a browser ──────
  SELECT string_agg(p.proname, ', ' ORDER BY p.proname) INTO v_bad
    FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
   WHERE n.nspname = 'public'
     AND p.proname IN ('tg_nomination_supporter_guard', 'tg_nomination_seed_supporter',
                       'tg_nomination_drop_when_unsupported')
     AND (has_function_privilege('anon', p.oid, 'EXECUTE')
       OR has_function_privilege('authenticated', p.oid, 'EXECUTE'));
  IF v_bad IS NOT NULL THEN
    RAISE EXCEPTION 'trigger function(s) executable by a browser role: %', v_bad;
  END IF;

  -- All three set an empty search_path. AGENTS.md: a SECURITY DEFINER function with a mutable
  -- search_path is the combination that matters, and `db advisors` already reports seven.
  SELECT string_agg(p.proname, ', ' ORDER BY p.proname) INTO v_bad
    FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
   WHERE n.nspname = 'public'
     AND p.proname IN ('tg_nomination_supporter_guard', 'tg_nomination_seed_supporter',
                       'tg_nomination_drop_when_unsupported')
     -- `SET search_path = ''` LANDS IN proconfig AS `search_path=""` — with the empty
     -- string quoted, because proconfig stores what SET would take. Matching the bare
     -- `search_path=` finds nothing and this assertion then fires on three functions that
     -- are perfectly correct, which it did on the second run of this file. Matched on the
     -- PREFIX so a future `SET search_path = pg_catalog` is still reported.
     AND NOT EXISTS (
       SELECT 1 FROM unnest(COALESCE(p.proconfig, ARRAY[]::text[])) AS cfg
        WHERE cfg IN ('search_path=""', 'search_path='));
  IF v_bad IS NOT NULL THEN
    RAISE EXCEPTION 'trigger function(s) with a mutable search_path: %', v_bad;
  END IF;

  RAISE NOTICE 'election_nomination_supporters: 3 policies, 3 triggers, % supporter row(s) backfilled',
    (SELECT count(*) FROM public.election_nomination_supporters);
END $mig$;

-- ── 9. The guards and the invariant, exercised for real ─────────────────────
-- §8 reads the catalogue. This runs the rules against throwaway rows, because a policy that
-- exists is not a policy that refuses and a trigger that is attached is not a trigger that
-- fires. Everything is created and rolled back inside a subtransaction, so this leaves
-- nothing behind and is safe to replay.
--
-- IT CANNOT TEST THE POLICIES — a migration runs as the owner, and RLS does not apply to the
-- table owner. What it CAN test is the half the service role also has to obey, which is
-- exactly the half AGENTS.md §4 is about: the triggers. `tests/rls` is where the policies are
-- attacked, by a real member through the real action.
DO $mig$
DECLARE
  v_family     text := 'MIGVERIFY';
  v_person_a   uuid;
  v_person_b   uuid;
  v_foreign    uuid;
  v_election   uuid;
  v_position   uuid;
  v_nomination uuid;
  v_other_el   uuid;
  v_caught     text;
BEGIN
  BEGIN
    -- Two members of one throwaway family, and one member of another.
    INSERT INTO public.people (family_code, first_name, last_name, primary_email)
    VALUES (v_family, 'Verify', 'One', 'migverify1@example.invalid') RETURNING id INTO v_person_a;
    INSERT INTO public.people (family_code, first_name, last_name, primary_email)
    VALUES (v_family, 'Verify', 'Two', 'migverify2@example.invalid') RETURNING id INTO v_person_b;
    INSERT INTO public.people (family_code, first_name, last_name, primary_email)
    VALUES (v_family || 'X', 'Verify', 'Other', 'migverify3@example.invalid')
    RETURNING id INTO v_foreign;

    INSERT INTO public.elections (family_code, title, status)
    VALUES (v_family, 'Verify election', 'draft') RETURNING id INTO v_election;
    INSERT INTO public.elections (family_code, title, status)
    VALUES (v_family, 'Verify election 2', 'draft') RETURNING id INTO v_other_el;
    INSERT INTO public.election_positions (election_id, title)
    VALUES (v_election, 'Verify office') RETURNING id INTO v_position;

    -- 9a. §3a: inserting the candidacy seeds its first supporter, with no second statement.
    INSERT INTO public.election_nominations (election_id, position_id, nominee_id, nominated_by)
    VALUES (v_election, v_position, v_person_b, v_person_a) RETURNING id INTO v_nomination;
    IF NOT EXISTS (SELECT 1 FROM public.election_nomination_supporters
                    WHERE nomination_id = v_nomination AND person_id = v_person_a) THEN
      RAISE EXCEPTION 'VERIFY: the first supporter was not seeded by the candidacy insert';
    END IF;

    -- 9b. The guard refuses an `election_id` that disagrees with the parent.
    v_caught := NULL;
    BEGIN
      INSERT INTO public.election_nomination_supporters (nomination_id, election_id, person_id)
      VALUES (v_nomination, v_other_el, v_person_b);
    EXCEPTION WHEN check_violation THEN v_caught := SQLERRM;
    END;
    IF v_caught IS NULL OR v_caught NOT LIKE '%must match its parent%' THEN
      RAISE EXCEPTION 'VERIFY: the guard allowed a supporter row on the wrong election (%)',
        COALESCE(v_caught, 'no error raised');
    END IF;

    -- 9c. And a supporter from another family.
    v_caught := NULL;
    BEGIN
      INSERT INTO public.election_nomination_supporters (nomination_id, election_id, person_id)
      VALUES (v_nomination, v_election, v_foreign);
    EXCEPTION WHEN check_violation THEN v_caught := SQLERRM;
    END;
    IF v_caught IS NULL OR v_caught NOT LIKE '%belongs to family%' THEN
      RAISE EXCEPTION 'VERIFY: the guard allowed a cross-family supporter (%)',
        COALESCE(v_caught, 'no error raised');
    END IF;

    -- 9d. THE INVARIANT, both ways. A second supporter joins; one retraction leaves the
    --     candidacy standing; the last retraction takes it with it. This is the whole of
    --     "if more than myself nominated them they remain in the list", executed.
    INSERT INTO public.election_nomination_supporters (nomination_id, election_id, person_id)
    VALUES (v_nomination, v_election, v_person_b);

    DELETE FROM public.election_nomination_supporters
     WHERE nomination_id = v_nomination AND person_id = v_person_a;
    IF NOT EXISTS (SELECT 1 FROM public.election_nominations WHERE id = v_nomination) THEN
      RAISE EXCEPTION
        'VERIFY: the candidacy was dropped while another supporter still stood behind it';
    END IF;

    DELETE FROM public.election_nomination_supporters
     WHERE nomination_id = v_nomination AND person_id = v_person_b;
    IF EXISTS (SELECT 1 FROM public.election_nominations WHERE id = v_nomination) THEN
      RAISE EXCEPTION 'VERIFY: the candidacy survived the retraction of its last supporter';
    END IF;

    -- 9e. And deleting a candidacy directly does not trip 3b into an error, which is the
    --     cascade-cannot-loop claim in §3b's header run rather than reasoned about.
    INSERT INTO public.election_nominations (election_id, position_id, nominee_id, nominated_by)
    VALUES (v_election, v_position, v_person_b, v_person_a) RETURNING id INTO v_nomination;
    DELETE FROM public.election_nominations WHERE id = v_nomination;
    IF EXISTS (SELECT 1 FROM public.election_nomination_supporters
                WHERE nomination_id = v_nomination) THEN
      RAISE EXCEPTION 'VERIFY: supporter rows survived their candidacy';
    END IF;

    RAISE NOTICE 'election_nomination_supporters: guards and invariant verified for real';

    -- Unwind everything above. A sentinel compared BY MESSAGE, because a handler that
    -- swallows any exception would swallow a genuine failure from the assertions above and
    -- report it as a pass (AGENTS.md, on probing storage from a migration).
    RAISE EXCEPTION 'MIGVERIFY_ROLLBACK';
  EXCEPTION
    WHEN OTHERS THEN
      IF SQLERRM <> 'MIGVERIFY_ROLLBACK' THEN
        RAISE;
      END IF;
  END;
END $mig$;

COMMIT;
