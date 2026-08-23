-- ═══════════════════════════════════════════════════════════════════════════════════════
-- EMERGENCY CHECK-IN — `/community/safety-check-ins`, Free.
--
-- A hurricane crosses the Gulf coast. Somebody with the grant raises a check-in addressed to
-- the relatives who live there; everybody addressed is asked one question — *are you safe?* —
-- and answers with one tap. Whoever raised it watches a roster fill in.
--
-- FutureFeature.md §5 argued this design before a line of it existed, and its first sentence
-- governs every decision in this file:
--
--     *"The unanswered column is the product. The other two are only how it gets shorter."*
--
-- ── WHY IT IS CALLED SAFETY CHECK-INS AND NOT CHECK-INS ────────────────────────────────
-- AGENTS.md lists **day-of check-in** among the three things Gatherings deliberately did NOT
-- replace when Events was retired, alongside RSVPs and hotel room blocks. A rail item captioned
-- "Check-Ins" would read as that retired feature returning, on a product whose marketing copy
-- was swept to stop selling it. The caption is the route and the route is the key, so the word
-- had to be settled before anything else here.
--
-- ── WHAT IS DELIBERATELY NOT IN THIS MIGRATION ─────────────────────────────────────────
-- **NOTHING RAISES A CHECK-IN AUTOMATICALLY, AND NOTHING HERE POLLS AN ALERT FEED.** The
-- National Weather Service publishes free CAP alerts at `api.weather.gov` with no API key, and
-- `pg_cron` and `pg_net`/`http` are all AVAILABLE-but-not-installed on this project's Postgres,
-- so a poller is genuinely within reach. It is still absent, for two reasons that are not about
-- effort:
--
--   1. §5's fourth decision is that raising is `canAny` because *"a false alarm to the whole
--      family at 3 a.m. is exactly what the grant exists to prevent"*. An automated raiser IS
--      that abuse case, arriving from a robot, unattended, at scale. NWS issues tens of
--      thousands of alerts a year and almost none of them warrants waking a family.
--   2. There would be no caller to authorize. Every action in this codebase derives its caller
--      from `auth.uid()`; a scheduled job has none, so automating the RAISE means inventing a
--      system actor and hanging the family's most sensitive write off it — with §2b's rule
--      about never taking an identity as a parameter standing directly in the way.
--
-- If an alert feed is ever wired in, it must SUGGEST and a person must RAISE. The audit trail
-- then still names somebody, and a false positive costs a dismissed notification rather than a
-- panic across a hundred and forty relatives.
--
-- ── WHY THIS IS TWO TABLES, AND WHY THE SECOND IS NOT A QUERY ──────────────────────────
-- `safety_check_ins` records what was ASKED FOR — the scope, and the area if there is one.
-- `safety_check_in_people` records who that turned out to be, resolved ONCE, at raise time.
--
-- §5's second decision is why the roster is rows rather than a predicate re-evaluated on read:
--
--     *"All three — chapter, geography, hand-picked names — must resolve to ONE EXPLICIT ROSTER
--     at raise time, and the roster is then the list rather than the rule that built it.
--     Anything else silently drops the relative who moved, who is the person most likely to be
--     in the wrong place."*
--
-- A relative who joins the family, changes chapter or leaves it tomorrow does not appear in, or
-- vanish from, a check-in raised today. That is what makes the unanswered column a fact about an
-- event rather than a query whose answer drifts under it — and it is the same decision
-- `gathering_tasks` makes by COPYING its `label` and `kind` from the step instead of reading
-- them through `step_id`.
--
-- ── THE TWO COLUMNS THAT LOOK LIKE ONE, AND MUST NOT BE MERGED ─────────────────────────
-- `state` is what a relative SAID: `awaiting | safe | needs_help`.
-- `reach`  is whether the ask GOT to them: `pending | sent | failed | skipped`.
--
-- They answer different questions and a single enum cannot hold both, because a relative can be
-- `reach = 'sent'` with `state = 'awaiting'` (asked, silent) or `reach = 'skipped'` with
-- `state = 'awaiting'` (never asked). §5's third decision is the one that forced the split:
--
--     *"A record cannot answer, and must not read as unanswered. The roster owes a third state
--     — no way to reach them — sitting apart from 'not answered'. Leaving her in the unanswered
--     column turns the one number this feature exists to drive to zero into a number that cannot
--     reach zero."*
--
-- `skipped` is that state. A recorded grandmother has a GENERATED placeholder address, and
-- `placeholderEmail()` builds those on **@genorra.com** — a REAL domain — so `sendEmail`'s
-- reserved-TLD guard does NOT catch them and mailing one is a hard bounce against our own
-- sending reputation. Filed as `failed` she would sit forever in the column somebody works
-- through; folded into `awaiting` she would make that column unable to empty.
--
-- Putting `unreachable` into `state` instead was the first draft, and it is the `is_minor` trap
-- (§4b): two facts about one thing, kept in step by whichever write path remembered.
--
-- ── AN ANSWER IS NOT A VOTE, AND MAY BE CHANGED ────────────────────────────────────────
-- `meeting_votes_are_final` refuses UPDATE for every role including `service_role`, because a
-- vote is a DECISION and a decision a successor can quietly rewrite is not one. A safety status
-- is the opposite kind of fact: *"I said I needed help, and now I am safe"* is the whole point,
-- and a check-in that could not record it would be worse than useless. So the row is updatable
-- BY ITS OWNER while the check-in is open, `responded_at` moves with it, and there is
-- deliberately no submission-history table.
--
-- WHAT THAT GIVES UP, stated rather than discovered: there is no record that somebody once said
-- they needed help. If that is ever wanted it is a third table, not a column — and it should be
-- argued on its own terms, because a permanent log of a relative's worst hour is not obviously
-- the kind thing to keep.
--
-- ── AND THERE IS NO "I SPOKE TO HER, SHE'S FINE" BUTTON ────────────────────────────────
-- §5's fourth decision names it: *"It is the most requested feature in every system of this kind
-- and it is a write to somebody else's row."* Nothing in this schema lets one member answer for
-- another, and the honest alternative is already here — an `unreachable` relative shows up in
-- their own column, which is precisely the list of people somebody has to telephone.
--
-- ── THE BOUNDARY: NO WRITE POLICY, AND `self_expr` IS LOAD-BEARING ─────────────────────
-- Each table gets ONE `perm:…:select` policy reproducing `_perm_predicate()`'s rendering exactly
-- (§2c, the shape all six Gatherings tables use), and no INSERT/UPDATE/DELETE policy at all —
-- which denies the browser those commands outright. Every write is a server action on
-- `createAdminClient()` re-applying family scoping by hand (§3), with guard triggers refusing a
-- cross-family id underneath (§4).
--
-- BOTH TABLES CARRY A REAL `self_expr`, and it is the same decision `gathering_tasks` makes: an
-- addressed relative can always reach the check-in they were asked about and their own row in
-- it, WHATEVER the family has done to `community/safety-check-ins:view`. Without it a family that
-- restricted this key would have made its own emergency check-in unanswerable — the feature
-- silently disabled by a switch whose label says nothing about answering.
--
-- `own_expr` IS THE RAISER, which is a coherent narrowing offered at scope `'own'`: the
-- check-ins I raised, and their rosters. It is NOT "the ones I am on" — that is what `self_expr`
-- already answers, for everybody, at every scope.
--
-- ── THE KEY GATES ROWS, NOT A SCREEN BAND ──────────────────────────────────────────────
-- Unlike `library/bylaws` or `gatherings/budget`, this key has `permission_table_map` rows, so
-- the SELECT policies compose `auth_permission` and the key withholds ROWS. §5's fifth decision
-- is why that had to be true rather than convenient:
--
--     *"A completed check-in is the sharpest PII this product would hold — a list of relatives,
--     where they live, and which are unreachable, assembled at the moment it is most useful to
--     somebody else."*
--
-- Hence a **restricted** `resource_visibility` backfill rather than the `everyone`-for-view
-- default, and §2c is why the distinction matters: a key that gates no table cannot hide
-- anything, so a "restricted" switch over an ungated table would be a control an administrator
-- believes is protecting a roster that PostgREST is serving anyway.
--
-- ── CHECKED BY MUTATION, per AGENTS.md §7 ─────────────────────────────────────────────
--   a write policy added to either table
--     ERROR: safety_check_in_people has 1 write policy/policies — the actions are the boundary
--   `self_expr` reduced to `(false)` on either policy
--     ERROR: safety_check_in_people' SELECT policy has no self expression — an addressed
--            relative could not answer
--   the parent's `self_expr` written back as an inline `EXISTS` on the child
--     ERROR: safety_check_ins' SELECT policy reads safety_check_in_people directly, whose own
--            policy reads safety_check_ins — that is the 42P17 infinite recursion …
--     AND — the reason that assertion exists at all — `tests/rls` goes red on the
--     `getCheckIns` and `getMyOpenCheckIns` CONTROLS, which is how the recursion was found in
--     the first place. Neither the migration nor any action-shaped case could see it.
--   `auth_is_on_safety_check_in` made SECURITY INVOKER, or its EXECUTE grant dropped
--     ERROR: … is not SECURITY DEFINER / … is not executable by authenticated
--   the guard trigger on safety_check_ins not created
--     ERROR: safety_check_ins accepted a cross-family raiser
--   the guard trigger on safety_check_in_people not created
--     ERROR: safety_check_in_people accepted a person from another family
--   the one-row-per-person index not created
--     ERROR: safety_check_in_people accepted two rows for one person
--   the area CHECK relaxed
--     ERROR: safety_check_ins accepted a region scope naming no region
--   the named-scope CHECK relaxed
--     ERROR: safety_check_ins accepted a named scope carrying an area
--   `FOR UPDATE SKIP LOCKED` removed from the claim function
--     not detectable here — a concurrency property a single-session migration cannot observe.
--     Asserted textually instead, the way 20260822000025 asserts the same clause.
--   the Administrators grant omitted
--     ERROR: community/safety-check-ins is restricted and no system template grants it
--   the General `view` grant omitted or set to 'none'
--     ERROR: General holds no view grant on community/safety-check-ins — members could not
--            open the screen to answer
--
-- HOW THIS REACHES A DATABASE
--   `supabase db push`, from CI on merge to master — never `psql -f` by hand. See AGENTS.md,
--   "How migrations reach the hosted project".
-- ═══════════════════════════════════════════════════════════════════════════════════════

BEGIN;

-- ── §1. THE ASK ────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.safety_check_ins (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  family_code   text NOT NULL,
  -- What is happening, in the raiser's own words: "Hurricane Delia", "Wildfire near Paradise".
  -- It is the subject line of the email and the heading on the screen, so it is required and
  -- may not be blank — an unnamed emergency is one nobody can act on.
  title         text NOT NULL,
  -- Anything else worth saying. Optional, because the whole value of this feature is that it
  -- can be raised in fifteen seconds.
  detail        text,
  -- ── WHERE IT WAS AIMED ────────────────────────────────────────────────────
  -- The first three words are `lib/distribution-audience.ts`' and `lib/election-area.ts`'
  -- vocabulary, kept identical rather than re-spelled. `named` is new here and §5's second
  -- decision is why: a disaster addresses where people ARE, and there is no derivable audience
  -- for "the relatives in the path of this storm".
  --
  -- THESE COLUMNS ARE NOT REDUNDANT WITH THE ROSTER. The roster records who was addressed; this
  -- records what was ASKED FOR, which is the only thing that can be checked afterwards against
  -- what somebody meant.
  scope         text NOT NULL DEFAULT 'family',
  region_id     uuid REFERENCES public.regions(id)  ON DELETE SET NULL,
  chapter_id    uuid REFERENCES public.chapters(id) ON DELETE SET NULL,
  -- Who raised it. SET NULL rather than CASCADE: removing a person must not delete the record
  -- that a family once asked whether everybody was safe.
  raised_by     uuid REFERENCES public.people(id) ON DELETE SET NULL,
  -- The sender's own address at raise time, so a relative pressing Reply reaches the person who
  -- asked rather than support@. Resolved server-side from the caller's `people` row and NEVER a
  -- parameter — a client-chosen reply-to on mail carrying our SPF and DKIM is the phishing shape
  -- lib/email/README.md's first rule is about.
  reply_to      text,
  status        text NOT NULL DEFAULT 'open',
  closed_at     timestamptz,
  closed_by     uuid REFERENCES public.people(id) ON DELETE SET NULL,
  -- Relatives the audience did NOT address, at raise time. Kept because the roster has changed
  -- by the time anybody reads this back, so "38 of 141" could not be recomputed — the same
  -- reason `distributions.not_addressed` is stored.
  not_addressed int NOT NULL DEFAULT 0,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT safety_check_ins_scope_check
    CHECK (scope IN ('family', 'region', 'chapter', 'named')),
  CONSTRAINT safety_check_ins_status_check
    CHECK (status IN ('open', 'closed')),
  CONSTRAINT safety_check_ins_title_not_blank CHECK (btrim(title) <> ''),
  -- AN AREA SCOPE NAMES ITS AREA, AND A NON-AREA SCOPE NAMES NONE. The inverse of the
  -- announcement rule, deliberately: there, 'chapter' with no chapter is treated as family-wide
  -- because publishing to nobody is worse. Here, widening a misconfigured audience to the whole
  -- family means waking a hundred and forty relatives about a storm four of them are in.
  --
  -- BOTH DIRECTIONS. `named` carrying a `region_id` would be a row whose two halves disagree
  -- about who was asked, and the screen would print the region while the roster held hand-picked
  -- names — which is the sort of quiet contradiction nobody looks for.
  CONSTRAINT safety_check_ins_area_named CHECK (
    (scope IN ('family', 'named') AND region_id IS NULL AND chapter_id IS NULL)
    OR (scope = 'region'  AND region_id  IS NOT NULL AND chapter_id IS NULL)
    OR (scope = 'chapter' AND chapter_id IS NOT NULL AND region_id  IS NULL)
  ),
  -- A closed check-in knows when it closed. Not the other way round: `closed_by` may be NULL on
  -- a closed row if that person's record has since been removed (the FK is SET NULL).
  CONSTRAINT safety_check_ins_closed_consistently CHECK (
    (status = 'open'   AND closed_at IS NULL)
    OR (status = 'closed' AND closed_at IS NOT NULL)
  )
);

CREATE INDEX IF NOT EXISTS safety_check_ins_family_recent_idx
  ON public.safety_check_ins (family_code, created_at DESC);
-- The one query the Dashboard banner makes on every page load, so it gets its own index: the
-- OPEN check-ins in this family. Partial, because a closed one is never what that banner wants.
CREATE INDEX IF NOT EXISTS safety_check_ins_open_idx
  ON public.safety_check_ins (family_code, created_at DESC) WHERE status = 'open';
CREATE INDEX IF NOT EXISTS safety_check_ins_raised_by_fk_idx ON public.safety_check_ins (raised_by);
CREATE INDEX IF NOT EXISTS safety_check_ins_closed_by_fk_idx ON public.safety_check_ins (closed_by);
CREATE INDEX IF NOT EXISTS safety_check_ins_region_fk_idx    ON public.safety_check_ins (region_id);
CREATE INDEX IF NOT EXISTS safety_check_ins_chapter_fk_idx   ON public.safety_check_ins (chapter_id);

COMMENT ON TABLE public.safety_check_ins IS
  'One emergency check-in: what is happening, where it was aimed, and who raised it. Who was '
  'actually asked is safety_check_in_people, resolved once at raise time and never recomputed. '
  'There is deliberately no progress column — it is derived from those rows by '
  'checkInProgress() in lib/safety-check-in.ts.';
COMMENT ON COLUMN public.safety_check_ins.scope IS
  'family | region | chapter | named. `named` exists because a disaster addresses where people '
  'ARE and a chapter is how a family organised itself — see the migration.';

-- ── §2. THE ROSTER, RESOLVED ONCE ──────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.safety_check_in_people (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  family_code   text NOT NULL,
  check_in_id   uuid NOT NULL REFERENCES public.safety_check_ins(id) ON DELETE CASCADE,
  -- KEYED ON `people.id`, NEVER `auth.users.id`. The retired `event_assignments` keyed its
  -- assignee on an auth id and AGENTS.md records what that cost: one auth id is identical across
  -- every family the user belongs to, so every query needs an `!inner` join — and an
  -- account-less relative could never be addressed at all, which for THIS feature would mean the
  -- `skipped` state could not exist and the recorded grandmother would be invisible.
  person_id     uuid NOT NULL REFERENCES public.people(id) ON DELETE CASCADE,
  -- WHAT THEY SAID. Never "we could not ask" — that is `reach`. See the header.
  state         text NOT NULL DEFAULT 'awaiting',
  -- WHETHER THE ASK GOT TO THEM. A different question, and the reason there are two columns.
  reach         text NOT NULL DEFAULT 'pending',
  -- The address AS ASKED, or NULL where there was none to record. A snapshot, not a join: when
  -- somebody is investigating a message that did not arrive, the only useful answer is which
  -- address it actually went to.
  email         text,
  -- Server-side diagnostics for a delivery failure — a Resend status, a DNS error. Shown to
  -- nobody, the same caveat `sendEmail`'s own `SendResult.error` carries.
  reach_error   text,
  asked_at      timestamptz,
  responded_at  timestamptz,
  -- Their own words, if they left any. Optional and short: the value of this feature is one tap,
  -- and a required note is a reason not to answer at all.
  note          text,
  created_at    timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT safety_check_in_people_state_check
    CHECK (state IN ('awaiting', 'safe', 'needs_help')),
  CONSTRAINT safety_check_in_people_reach_check
    CHECK (reach IN ('pending', 'sending', 'sent', 'failed', 'skipped')),
  -- AN ANSWER HAS A TIME AND SILENCE DOES NOT. Both directions, because a `responded_at` on an
  -- `awaiting` row would put a relative in the answered column of any query that read the
  -- timestamp instead of the state, and those two must never be able to disagree.
  CONSTRAINT safety_check_in_people_answer_consistently CHECK (
    (state = 'awaiting' AND responded_at IS NULL)
    OR (state <> 'awaiting' AND responded_at IS NOT NULL)
  )
);

-- ── ONE ROW PER PERSON PER CHECK-IN — AND IT IS AN INDEX, NOT A CONSTRAINT ─────────────
-- The guarantee is identical (Postgres enforces both through the same index) and the reason to
-- prefer the index is PostgREST. This table has foreign keys to exactly two tables,
-- `safety_check_ins` and `people`, which is the junction-table SHAPE §8's `announcement_unpins`
-- incident is about: PostgREST then reports a many-to-many path between that pair, and every
-- bare `people(...)` embed on `safety_check_ins` becomes PGRST201 — which arrives as `[]` from
-- an action that discards the error, on a page nobody edited.
--
-- A surrogate `id` primary key normally prevents that inference, and a UNIQUE CONSTRAINT across
-- exactly the two foreign-key columns is the other thing that can look like a junction key. So
-- the uniqueness lives in an index, which relationship inference does not read, AND every embed
-- in `app/actions/safety-check-ins.ts` names its constraint. Two independent reasons it cannot
-- happen, for a rule that has cost this codebase a production page twice.
--
-- ASKING SOMEBODY TWICE IS THE DEFECT THIS PREVENTS, and it is not the same defect as a
-- duplicate email. Two rows for one person means two rows in the unanswered column, one of which
-- can never be cleared — the number this feature exists to drive to zero, made unable to.
CREATE UNIQUE INDEX IF NOT EXISTS safety_check_in_people_one_per_person_idx
  ON public.safety_check_in_people (check_in_id, person_id);

-- The queue, and the roster read. `state` is in the second index because the screen's four
-- columns are counted by it on every load.
CREATE INDEX IF NOT EXISTS safety_check_in_people_queue_idx
  ON public.safety_check_in_people (check_in_id, reach, created_at);
CREATE INDEX IF NOT EXISTS safety_check_in_people_roster_idx
  ON public.safety_check_in_people (check_in_id, state);
CREATE INDEX IF NOT EXISTS safety_check_in_people_family_idx
  ON public.safety_check_in_people (family_code);
-- The Dashboard banner's half: "which open check-ins am I on, and have I answered?"
CREATE INDEX IF NOT EXISTS safety_check_in_people_person_idx
  ON public.safety_check_in_people (person_id, state);

-- ── `sending` IS A FIFTH `reach` THAT THE TYPESCRIPT DOES NOT NAME, ON PURPOSE ─────────
-- It exists for a few seconds between being claimed and the provider answering, and it IS the
-- claim: a row in `sending` is one another worker must not pick up. It is deliberately absent
-- from `CheckInReach` in lib/safety-check-in.ts, because nothing outside this table's own
-- transaction should be reasoning about it — the same arrangement `distribution_recipients`
-- makes, and for the same reason. A row STRANDED there (the process died between the claim and
-- the write-back) is recovered by `retryCheckInAsks`, which the screen offers as "Try again".
COMMENT ON COLUMN public.safety_check_in_people.reach IS
  'pending | sending | sent | failed | skipped. `sending` is the claim held by '
  'claim_safety_check_in_asks() and is not part of CheckInReach in lib/safety-check-in.ts. '
  '`skipped` means there is no mailbox to try — a phone call, not a retry.';
COMMENT ON COLUMN public.safety_check_in_people.state IS
  'awaiting | safe | needs_help — what the relative SAID. Whether the ask reached them at all '
  'is `reach`; the two must never be merged. See the migration header.';
COMMENT ON TABLE public.safety_check_in_people IS
  'One row per addressed relative: the queue, the delivery record and the answer. Resolved once '
  'at raise time and never recomputed, so the roster is a fact about an event rather than a '
  'query whose answer drifts. Written only through app/actions/safety-check-ins.ts.';

-- ── §3. RLS: ONE SELECT POLICY EACH, AND NO WRITE POLICY ───────────────────────────────
--
-- Each reproduces `_perm_predicate()`'s rendering EXACTLY, so the hand-written policy and the
-- `permission_table_map` row in §5 cannot disagree and a future sweep re-composing from that row
-- would produce the identical predicate:
--
--     ((<self_expr>) OR auth_permission(k,a) = 'any' OR (auth_permission(k,a) = 'own' AND (<own_expr>)))
--
-- `auth_membership_approved()` on both, as every policy has carried since 20260806000011 —
-- written out rather than assumed, because a policy dropped and recreated without it quietly
-- re-admits an applicant.

ALTER TABLE public.safety_check_ins        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.safety_check_in_people  ENABLE ROW LEVEL SECURITY;

-- ── THE `self_expr` IS A FUNCTION, AND IT HAS TO BE. MEASURED, NOT CHOSEN ─────────────
--
-- "I was asked about this" — so an addressed relative can always read the check-in they are
-- being asked about, at any scope, including `none`. `gathering_tasks` carries a real `self_expr`
-- for exactly this reason and AGENTS.md says why: an assignee must reach their own task whatever
-- the family has done to the key.
--
-- IT MATTERS MORE HERE THAN THERE. A restricted `gatherings:view` costs somebody a screen; a
-- restricted key without this expression would make a family's own emergency check-in
-- UNANSWERABLE, silently, from a switch whose label says nothing about answering.
--
-- ── WHY IT IS `auth_is_on_safety_check_in(id)` AND NOT AN INLINE `EXISTS` ─────────────
-- The first draft of this file wrote the subquery inline, and it produced **42P17, "infinite
-- recursion detected in policy for relation safety_check_ins"**, on every read through the user
-- client. The cycle is one line long in each direction:
--
--     safety_check_ins.select        -> EXISTS on safety_check_in_people   (the self expression)
--     safety_check_in_people.select  -> EXISTS on safety_check_ins         (the own expression)
--
-- Each table's policy needs the other table, whose policy needs the first. `auth_uid_is_room_participant`
-- (`20260603000001`) exists for precisely this, on precisely this shape, and this is the same
-- answer: a SECURITY DEFINER function runs as its OWNER, so the read inside it does not
-- re-enter RLS and the chain terminates.
--
-- **NOTHING IN THIS REPO COULD HAVE CAUGHT IT EXCEPT A RUN.** Every read in
-- `app/actions/safety-check-ins.ts` but one is on the ADMIN client, which ignores RLS entirely,
-- so the whole screen worked. The verify block below reads `pg_policies` as TEXT and a recursive
-- policy is perfectly well-formed text. What found it was `tests/rls`' POSITIVE CONTROL — ALPHA's
-- own administrator getting `null` from `getCheckIns` — which is AGENTS.md §7's argument for the
-- control half, made again: *"an action that returns `[]` for everybody passes an isolation
-- assertion trivially."*
--
-- BREAKING ONE SIDE IS SUFFICIENT and only one side is broken, deliberately. The child's own
-- expression still reads the parent under RLS, and that terminates: the parent's policy now calls
-- a DEFINER function rather than reading the child. Wrapping both would hide the cycle rather
-- than remove it, and the next person to add a third table would have no way to see the rule.
CREATE OR REPLACE FUNCTION public.auth_is_on_safety_check_in(p_check_in_id uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = ''
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.safety_check_in_people m
     WHERE m.check_in_id = p_check_in_id
       AND m.person_id = public.auth_person_id()
  )
$$;

-- §2b RULE 2: A FUNCTION NAMED IN AN RLS POLICY NEEDS THE GRANT. Policy expressions are
-- evaluated as the QUERYING role, so without this every authenticated read of `safety_check_ins`
-- dies with "permission denied for function" — a BROKEN feature rather than a closed hole, and
-- indistinguishable from a refusal on the realtime path where there is no HTTP response to read.
GRANT EXECUTE ON FUNCTION public.auth_is_on_safety_check_in(uuid) TO authenticated;

COMMENT ON FUNCTION public.auth_is_on_safety_check_in(uuid) IS
  'Is the caller on this check-in''s roster? SECURITY DEFINER so the policy on '
  'safety_check_ins can ask without re-entering RLS on safety_check_in_people, whose own '
  'policy reads safety_check_ins — see 20260823000001 on the 42P17 that produced.';

DROP POLICY IF EXISTS "perm:safety_check_ins:select" ON public.safety_check_ins;
CREATE POLICY "perm:safety_check_ins:select"
  ON public.safety_check_ins FOR SELECT TO authenticated
  USING (
    family_code = public.auth_family_code()
    AND public.auth_membership_approved()
    AND (
      (public.auth_is_on_safety_check_in(id))                              -- self_expr
      OR public.auth_permission('community/safety-check-ins', 'view'::public.permission_action) = 'any'
      OR (public.auth_permission('community/safety-check-ins', 'view'::public.permission_action) = 'own'
          AND (raised_by = public.auth_person_id()))                       -- own_expr
    )
  );

-- ── MY OWN ROW, AND NOBODY ELSE'S ─────────────────────────────────────────────────────
-- `self_expr` is the narrowest thing it can be: the row is MINE. It deliberately does not admit
-- everybody on the same roster — that would publish the whole list of who is unreachable and who
-- needs help to exactly the set of people the list is made of, which is the argument
-- `distribution_recipients` makes about its own `self_expr` being `false`.
--
-- The difference between the two is that a distribution's recipient has nothing to DO. Here they
-- have to answer, so they need their row and only their row.
DROP POLICY IF EXISTS "perm:safety_check_in_people:select" ON public.safety_check_in_people;
CREATE POLICY "perm:safety_check_in_people:select"
  ON public.safety_check_in_people FOR SELECT TO authenticated
  USING (
    family_code = public.auth_family_code()
    AND public.auth_membership_approved()
    AND (
      (person_id = public.auth_person_id())                                -- self_expr
      OR public.auth_permission('community/safety-check-ins', 'view'::public.permission_action) = 'any'
      OR (public.auth_permission('community/safety-check-ins', 'view'::public.permission_action) = 'own'
          AND (EXISTS (SELECT 1 FROM public.safety_check_ins c
                        WHERE c.id = check_in_id
                          AND c.raised_by = public.auth_person_id())))     -- own_expr
    )
  );

-- §2c: a statement of what these tables are for, not what makes them safe. The absence of a
-- write policy is what makes them safe.
GRANT SELECT ON public.safety_check_ins       TO authenticated;
GRANT SELECT ON public.safety_check_in_people TO authenticated;

-- ── §4. THE RESOURCE ROW ───────────────────────────────────────────────────────────────
--
-- IT COMES BEFORE THE MAP ROW BECAUSE `permission_table_map.resource_key` REFERENCES IT.
-- 20260822000025's first draft registered its key last and aborted its own first `db reset` with
-- 23503; the policies above need no such ordering, carrying the key as a string literal inside
-- `auth_permission(...)` with nothing to resolve.
--
-- CATEGORY `community`, sort_order 66 — immediately after Distributions (65) and before
-- Directory (70). The two sit together because they are the two ways this product reaches the
-- whole family, and an administrator deciding who may do either wants the switches adjacent.
--
-- THREE ACTIONS, AND `edit` IS ABSENT ON PURPOSE. There is nothing to edit: a check-in is raised
-- and then it is a record of what was asked. Changing the question after people have answered it
-- would leave every answer being an answer to something else — the argument `gathering_tasks`
-- makes for COPYING its label, one level up. `permission_resources.actions` decides which
-- switches the grid renders, and a switch nothing consults reads as a control being honoured.
--
-- WHAT EACH ACTION BUYS:
--   view    read the check-ins and their rosters. Scope `'own'` narrows to the ones you raised
--           — and NOBODY needs a grant to see and answer their own row, which is `self_expr`.
--   create  raise one, and CLOSE one. Whoever may wake the family may also stand them down, and
--           making the all-clear harder to reach than the alarm is backwards.
--   delete  remove the record entirely. Strictly stronger, because it destroys the account of
--           who was asked and who never answered.
INSERT INTO public.permission_resources (key, label, category, subsection, sort_order, actions)
VALUES
  ('community/safety-check-ins', 'Safety Check-Ins', 'community', NULL, 66,
   ARRAY['view', 'create', 'delete']::TEXT[])
ON CONFLICT (key) DO UPDATE
  SET label      = EXCLUDED.label,
      category   = EXCLUDED.category,
      subsection = EXCLUDED.subsection,
      sort_order = EXCLUDED.sort_order,
      actions    = EXCLUDED.actions;

-- ── §5. THE MAP ROWS ───────────────────────────────────────────────────────────────────
-- What makes the policies above re-derivable, and what a future sweep would compose from. Both
-- tables key on the ONE resource, because a family that may read a check-in may read who was
-- asked — splitting them would produce a screen listing emergencies with no roster, which is a
-- screen with no content.
INSERT INTO public.permission_table_map (table_name, resource_key, own_expr, self_expr) VALUES
  -- THE PARENT'S `self_expr` IS THE FUNCTION CALL, NOT THE SUBQUERY IT REPLACED. This column is
  -- what a future policy sweep composes from, so writing the inline `EXISTS` here would have the
  -- sweep reintroduce the 42P17 recursion argued at §3 — silently, in a migration whose diff
  -- mentions only "recomposing policies".
  ('safety_check_ins', 'community/safety-check-ins',
   'raised_by = public.auth_person_id()',
   'public.auth_is_on_safety_check_in(id)'),
  ('safety_check_in_people', 'community/safety-check-ins',
   'EXISTS (SELECT 1 FROM public.safety_check_ins c WHERE c.id = check_in_id AND c.raised_by = public.auth_person_id())',
   'person_id = public.auth_person_id()')
ON CONFLICT (table_name) DO UPDATE
  SET resource_key = EXCLUDED.resource_key,
      own_expr     = EXCLUDED.own_expr,
      self_expr    = EXCLUDED.self_expr;

-- ── §6. THE GUARDS (§4) ────────────────────────────────────────────────────────────────
-- The service role ignores RLS and does not ignore triggers. Every id a caller can influence is
-- checked against the row's own family here, underneath the action's own `belongsToFamily`.

CREATE OR REPLACE FUNCTION public.tg_safety_check_in_same_family()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_other text;
BEGIN
  IF NEW.raised_by IS NOT NULL THEN
    SELECT p.family_code INTO v_other FROM public.people p WHERE p.id = NEW.raised_by;
    IF v_other IS DISTINCT FROM NEW.family_code THEN
      RAISE EXCEPTION 'safety_check_ins: raiser % is not in family %',
        NEW.raised_by, NEW.family_code USING ERRCODE = '23514';
    END IF;
  END IF;
  IF NEW.closed_by IS NOT NULL THEN
    SELECT p.family_code INTO v_other FROM public.people p WHERE p.id = NEW.closed_by;
    IF v_other IS DISTINCT FROM NEW.family_code THEN
      RAISE EXCEPTION 'safety_check_ins: closer % is not in family %',
        NEW.closed_by, NEW.family_code USING ERRCODE = '23514';
    END IF;
  END IF;
  IF NEW.region_id IS NOT NULL THEN
    SELECT r.family_code INTO v_other FROM public.regions r WHERE r.id = NEW.region_id;
    IF v_other IS DISTINCT FROM NEW.family_code THEN
      RAISE EXCEPTION 'safety_check_ins: region % is not in family %',
        NEW.region_id, NEW.family_code USING ERRCODE = '23514';
    END IF;
  END IF;
  IF NEW.chapter_id IS NOT NULL THEN
    SELECT c.family_code INTO v_other FROM public.chapters c WHERE c.id = NEW.chapter_id;
    IF v_other IS DISTINCT FROM NEW.family_code THEN
      RAISE EXCEPTION 'safety_check_ins: chapter % is not in family %',
        NEW.chapter_id, NEW.family_code USING ERRCODE = '23514';
    END IF;
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS safety_check_ins_same_family ON public.safety_check_ins;
CREATE TRIGGER safety_check_ins_same_family
  BEFORE INSERT OR UPDATE ON public.safety_check_ins
  FOR EACH ROW EXECUTE FUNCTION public.tg_safety_check_in_same_family();

DROP TRIGGER IF EXISTS safety_check_ins_updated_at ON public.safety_check_ins;
CREATE TRIGGER safety_check_ins_updated_at BEFORE UPDATE ON public.safety_check_ins
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- THE CHILD NEEDS ITS OWN, AND IT IS THE ONE A READER WOULD SKIP.
-- `gathering_template_steps` was missing exactly this for a day: a child table whose parent FK
-- can point into another family. Both ids are checked — the person, and the parent check-in.
CREATE OR REPLACE FUNCTION public.tg_safety_check_in_person_same_family()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_other text;
BEGIN
  SELECT p.family_code INTO v_other FROM public.people p WHERE p.id = NEW.person_id;
  IF v_other IS DISTINCT FROM NEW.family_code THEN
    RAISE EXCEPTION 'safety_check_in_people: person % is not in family %',
      NEW.person_id, NEW.family_code USING ERRCODE = '23514';
  END IF;
  SELECT c.family_code INTO v_other
    FROM public.safety_check_ins c WHERE c.id = NEW.check_in_id;
  IF v_other IS DISTINCT FROM NEW.family_code THEN
    RAISE EXCEPTION 'safety_check_in_people: check-in % is not in family %',
      NEW.check_in_id, NEW.family_code USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS safety_check_in_people_same_family ON public.safety_check_in_people;
CREATE TRIGGER safety_check_in_people_same_family
  BEFORE INSERT OR UPDATE ON public.safety_check_in_people
  FOR EACH ROW EXECUTE FUNCTION public.tg_safety_check_in_person_same_family();

-- ── §7. CLAIMING A BATCH OF ASKS, IN ONE STATEMENT ─────────────────────────────────────
--
-- `sendEmail` takes ONE recipient per call and there is no cron, worker or queue anywhere in
-- this product, so the roster rows ARE the work list and the client drives it a batch at a time
-- — the arrangement `app/actions/distributions.ts` argues at length and the reason
-- FutureFeature.md tells the next feature to read that file first.
--
-- `FOR UPDATE SKIP LOCKED` is the whole reason this is SQL rather than three supabase-js calls.
-- Two administrators pressing "Ask again" at the same moment, or one member with two tabs, is a
-- read-modify-write racing itself — and what it produces is not a lost update, it is the same
-- relative asked twice about the same emergency, which cannot be taken back and which in this
-- feature specifically is the thing most likely to make somebody stop trusting the alert.
--
-- THE FAMILY CODE IS A PARAMETER AND IS ASSERTED, not trusted. Per §2b rule 3 this is written as
-- if reachable even though it is granted to nobody. It does NOT re-derive the caller from
-- `auth.uid()`, because it has no caller: only the admin client invokes it and the ACTION
-- resolves the permission. Making it self-authorizing would mean granting it to `authenticated`,
-- which is the one thing §2b says not to do to a function nothing in the browser needs.
CREATE OR REPLACE FUNCTION public.claim_safety_check_in_asks(
  p_check_in_id uuid,
  p_family_code text,
  p_limit       int
)
RETURNS TABLE (id uuid, person_id uuid, email text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.safety_check_ins c
     WHERE c.id = p_check_in_id AND c.family_code = p_family_code
  ) THEN
    RAISE EXCEPTION 'check-in % is not in family %', p_check_in_id, p_family_code
      USING ERRCODE = '42501';
  END IF;

  RETURN QUERY
  UPDATE public.safety_check_in_people r
     SET reach = 'sending'
   WHERE r.id IN (
     SELECT m.id FROM public.safety_check_in_people m
      WHERE m.check_in_id = p_check_in_id
        AND m.family_code = p_family_code
        AND m.reach       = 'pending'
      ORDER BY m.created_at, m.id
      LIMIT GREATEST(p_limit, 0)
      FOR UPDATE SKIP LOCKED
   )
  RETURNING r.id, r.person_id, r.email;
END $$;

-- §2b RULE 1: NO GRANT. `service_role` keeps EXECUTE by default and nothing in the browser calls
-- this. Default privileges (20260806000015) already revoke it from `anon` and `authenticated`;
-- the verify block below asserts that rather than assuming it.
REVOKE ALL ON FUNCTION public.claim_safety_check_in_asks(uuid, text, int) FROM PUBLIC;

COMMENT ON FUNCTION public.claim_safety_check_in_asks(uuid, text, int) IS
  'Flip up to p_limit pending asks to `sending` and return them, under FOR UPDATE SKIP LOCKED, '
  'so two concurrent senders cannot ask one relative twice. Service role only — no grant to '
  'authenticated, deliberately.';

-- ── §8. RESTRICTED FOR EVERY EXISTING FAMILY ───────────────────────────────────────────
-- §6's obligation, and here it is not the usual caution. This key gates a TABLE, so absence of a
-- visibility row would resolve `view` to the `'everyone'` default and publish every completed
-- check-in's roster — a list of relatives with which of them are unreachable — to the whole
-- family through PostgREST. §5's fifth decision calls that the sharpest PII this product would
-- hold, and it is right.
--
-- Derived from `people` rather than `families`, matching 20260820000003, 20260822000023 and
-- 20260822000025: a family whose row predates the `families` backfills still has members, and a
-- family with no members has nobody to restrict anything from.
INSERT INTO public.resource_visibility (family_code, resource_key, visibility)
SELECT DISTINCT p.family_code, 'community/safety-check-ins', 'restricted'
  FROM public.people p
 WHERE p.family_code IS NOT NULL AND p.family_code <> ''
ON CONFLICT (family_code, resource_key) DO NOTHING;

-- ── §9. THE ADMINISTRATORS GRANT ───────────────────────────────────────────────────────
-- "Restricted with nobody granted is a screen that exists and cannot be opened", and in the
-- worst ordering the screen that just locked is the one that could unlock it. All three actions
-- at `'any'`, which is what an administrator template means.
INSERT INTO public.template_permissions (template_id, resource_key, action, scope, updated_at)
SELECT t.id, 'community/safety-check-ins', a.action::public.permission_action,
       'any'::public.permission_scope, NOW()
  FROM public.permission_templates t
 CROSS JOIN (VALUES ('view'), ('create'), ('delete')) AS a(action)
 WHERE t.is_system AND t.name = 'Administrators'
ON CONFLICT (template_id, resource_key, action) DO NOTHING;

-- ── §10. AND GENERAL GETS `view` AT `'own'`, WHICH IS NOT THE DISTRIBUTIONS ANSWER ─────
-- The grid is MATERIALIZED (20260807000000): every template carries an explicit row for every
-- resource and action, so a resource registered later has no row in the templates that already
-- exist. This writes what `seed_family_permission_templates` will write for a family created
-- after today.
--
-- `community/distributions` gives General `'none'` on all three, on the argument that an ordinary
-- member has no business reading the family's contact list with delivery outcomes against it.
-- THE SAME ARGUMENT GIVES A DIFFERENT ANSWER HERE, and the difference is worth stating because a
-- future reader will see two neighbouring keys treated unlike:
--
--   * A distribution's recipient has nothing to DO. A check-in's has to answer, and the screen is
--     where they do it. `view: 'none'` would make `requireView` answer 404 for every ordinary
--     member — so the family's own emergency check-in would be answerable only by administrators,
--     which is the feature switched off by a switch that does not say so.
--   * `'own'` rather than `'any'` because the ROSTER is the PII. At `'own'` the policies admit
--     exactly two things: the check-ins this member raised (`own_expr`), and their own row in any
--     check-in they were asked about (`self_expr`, which holds at every scope). They do not see
--     who else is unreachable or who else needs help.
--   * `create` and `delete` stay `'none'`. Raising is the 3 a.m. abuse case §5 names, and it is
--     what the grant exists to gate.
--
-- AND THE DASHBOARD BANNER IS THE BELT TO THIS BRACES. A family that sets even this to `'none'`
-- can still answer, because `/dashboard` has no permission row and cannot be restricted — see
-- `components/dashboard/SafetyCheckInBanner.tsx`. That is deliberate redundancy on the one
-- surface where being locked out has a cost nobody would accept.
INSERT INTO public.template_permissions (template_id, resource_key, action, scope, updated_at)
SELECT t.id, 'community/safety-check-ins', a.action::public.permission_action,
       a.scope::public.permission_scope, NOW()
  FROM public.permission_templates t
 CROSS JOIN (VALUES ('view', 'own'), ('create', 'none'), ('delete', 'none')) AS a(action, scope)
 WHERE t.is_system AND t.name = 'General'
ON CONFLICT (template_id, resource_key, action) DO NOTHING;

-- ── §11. NEW FAMILIES GET IT RESTRICTED TOO ────────────────────────────────────────────
-- `seed_family_permission_templates()` carries a `v_restricted` array. REWRITTEN IN PLACE rather
-- than restated: the function has been redefined by six migrations since it was written, and
-- restating a hundred lines to change one array is how a grant added in one of them gets quietly
-- reverted. 20260822000023 and 20260822000025 do the same thing for the same reason.
DO $mig$
DECLARE
  v_def text;
  -- MATCHED ON THE WHOLE ARRAY LITERAL, not on one key or on a fragment of two. That is
  -- 20260822000023's instruction and its reason: 20260820000004 leaves an assertion in this
  -- function's body naming some of the same keys, so a narrower match can hit two places — and a
  -- match that can hit two places is one that will.
  v_old text := 'ARRAY[''reporting/dues-projections'', ''gatherings/budget'','
                || E'\n' || '                               ''reporting/membership'','
                || E'\n' || '                               ''reporting/gatherings'', ''reporting/elections'','
                || E'\n' || '                               ''reporting/meetings'', ''reporting/board'','
                || E'\n' || '                               ''community/distributions'']';
  v_new text := 'ARRAY[''reporting/dues-projections'', ''gatherings/budget'','
                || E'\n' || '                               ''reporting/membership'','
                || E'\n' || '                               ''reporting/gatherings'', ''reporting/elections'','
                || E'\n' || '                               ''reporting/meetings'', ''reporting/board'','
                || E'\n' || '                               ''community/distributions'','
                || E'\n' || '                               ''community/safety-check-ins'']';
BEGIN
  SELECT pg_get_functiondef(p.oid) INTO v_def
    FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
   WHERE n.nspname = 'public' AND p.proname = 'seed_family_permission_templates';

  IF v_def IS NULL THEN
    RAISE EXCEPTION 'seed_family_permission_templates() is missing — cannot restrict the new key';
  END IF;

  IF position(v_new IN v_def) > 0 THEN
    RAISE NOTICE 'safety check-ins: seed already restricts community/safety-check-ins';
  ELSIF position(v_old IN v_def) = 0 THEN
    -- LOUD RATHER THAN SILENT. A no-op rewrite would leave every family created afterwards with
    -- the key at its 'everyone' default — and because this key gates a TABLE rather than a
    -- screen, that publishes every check-in's roster to the whole family.
    RAISE EXCEPTION
      'seed_family_permission_templates() no longer holds the v_restricted array this '
      'migration expects — it has been reformatted or extended. Re-read the function and '
      'update this replacement rather than widening the match.';
  ELSE
    EXECUTE replace(v_def, v_old, v_new);
    RAISE NOTICE 'safety check-ins: seed now restricts community/safety-check-ins for new families';
  END IF;
END $mig$;

-- The lockdown's rule (§2b): called only by the families trigger and by the service role, so it
-- is granted to nobody. Restated after a redefinition because CREATE OR REPLACE keeps the ACL
-- but a future refactor into DROP + CREATE would not.
REVOKE ALL ON FUNCTION public.seed_family_permission_templates(text) FROM PUBLIC, anon, authenticated;

-- ── §12. VERIFY ────────────────────────────────────────────────────────────────────────
DO $mig$
DECLARE
  v_n    int;
  v_bad  text;
  v_src  text;
  v_fam  text := 'ZZSCI001';
  v_fam2 text := 'ZZSCI002';
  v_p1   uuid;
  v_p2   uuid;
  v_c1   uuid;
  v_ok   boolean;
BEGIN
  -- 1. No write policy on either table; one SELECT policy each, evaluating the right key, and
  --    carrying a REAL self expression.
  FOR v_bad IN SELECT unnest(ARRAY['safety_check_ins', 'safety_check_in_people']) LOOP
    SELECT count(*) INTO v_n FROM pg_policies
     WHERE schemaname = 'public' AND tablename = v_bad AND cmd <> 'SELECT';
    IF v_n > 0 THEN
      RAISE EXCEPTION '% has % write policy/policies — the actions are the boundary', v_bad, v_n;
    END IF;
    IF NOT EXISTS (
      SELECT 1 FROM pg_policies
       WHERE schemaname = 'public' AND tablename = v_bad AND cmd = 'SELECT'
         AND COALESCE(qual, '') LIKE '%auth_permission(''community/safety-check-ins''%'
    ) THEN
      RAISE EXCEPTION '%''s SELECT policy does not evaluate community/safety-check-ins', v_bad;
    END IF;
    IF NOT EXISTS (
      SELECT 1 FROM pg_policies
       WHERE schemaname = 'public' AND tablename = v_bad AND cmd = 'SELECT'
         AND COALESCE(qual, '') LIKE '%auth_membership_approved%'
    ) THEN
      RAISE EXCEPTION '%''s SELECT policy does not test membership approval', v_bad;
    END IF;
  END LOOP;

  -- ── THE SELF EXPRESSIONS, ASSERTED ONE TABLE AT A TIME AND BY THEIR OWN TEXT ─────────
  -- These are the only assertions in this file that are about the feature WORKING rather than
  -- about it being closed: reduced to `(false)`, a family that restricted this key would have
  -- made its own emergency check-in unanswerable, and nothing else in the tree would report it
  -- — the screen would simply show an addressed member nothing.
  --
  -- SPECIFIC TEXT, NOT A BARE `auth_person_id` MATCH, and the first draft of this block got it
  -- wrong in exactly the way AGENTS.md keeps warning about. `own_expr` mentions
  -- `auth_person_id()` too, so a generic match passed with `self_expr` reduced to `(false)` —
  -- an assertion that could not fail for the thing it was written to catch. Each half names the
  -- fragment only its own expression can produce.
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
     WHERE schemaname = 'public' AND tablename = 'safety_check_ins' AND cmd = 'SELECT'
       AND COALESCE(qual, '') LIKE '%auth_is_on_safety_check_in%'
  ) THEN
    RAISE EXCEPTION 'safety_check_ins'' SELECT policy has no self expression — an addressed '
      'relative could not read the check-in they are being asked about';
  END IF;

  -- ── AND THE CYCLE MUST NOT COME BACK ────────────────────────────────────────────────
  -- The parent's policy may not read the child table directly. That is what produced 42P17 on
  -- the first run of this file, and it is invisible to everything else: a recursive policy is
  -- well-formed text, every action in the feature but one reads on the admin client, and the
  -- only thing that caught it was `tests/rls`' positive control.
  --
  -- THIS IS A TEXTUAL ASSERTION AND SAYS SO. It cannot prove the policies are recursion-FREE —
  -- a third table added later could close a longer loop — it only refuses the one edit that
  -- reintroduces this one, which is somebody "simplifying" the function call back into the
  -- subquery it replaced. The runtime proof is the `safety-check-ins.getCheckIns` and
  -- `getMyOpenCheckIns` controls in `tests/rls/cases.mjs`; both go red on a recursive policy.
  IF EXISTS (
    SELECT 1 FROM pg_policies
     WHERE schemaname = 'public' AND tablename = 'safety_check_ins' AND cmd = 'SELECT'
       AND COALESCE(qual, '') LIKE '%safety_check_in_people%'
  ) THEN
    RAISE EXCEPTION 'safety_check_ins'' SELECT policy reads safety_check_in_people directly, '
      'whose own policy reads safety_check_ins — that is the 42P17 infinite recursion this '
      'migration fixed. Use public.auth_is_on_safety_check_in(id).';
  END IF;

  -- §2b RULE 2, ASSERTED RATHER THAN ASSUMED. A policy helper with no EXECUTE grant makes every
  -- authenticated read ERROR rather than be refused, which is a broken feature — and on the
  -- realtime path it is indistinguishable from a policy correctly withholding a row, because
  -- there is no HTTP response for anybody to see the failure on.
  IF NOT has_function_privilege('authenticated',
       'public.auth_is_on_safety_check_in(uuid)', 'EXECUTE') THEN
    RAISE EXCEPTION 'auth_is_on_safety_check_in is not executable by authenticated — every '
      'read of safety_check_ins would fail with permission denied for function';
  END IF;
  -- SECURITY DEFINER IS THE WHOLE MECHANISM. As INVOKER it would read the child table as the
  -- caller, RLS and all, and the recursion would be straight back.
  IF NOT EXISTS (
    SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
     WHERE n.nspname = 'public' AND p.proname = 'auth_is_on_safety_check_in' AND p.prosecdef
  ) THEN
    RAISE EXCEPTION 'auth_is_on_safety_check_in is not SECURITY DEFINER — the recursion it '
      'exists to break is back';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
     WHERE schemaname = 'public' AND tablename = 'safety_check_in_people' AND cmd = 'SELECT'
       AND COALESCE(qual, '') LIKE '%(person_id = auth_person_id())%'
  ) THEN
    RAISE EXCEPTION 'safety_check_in_people'' SELECT policy has no self expression — an '
      'addressed relative could not answer';
  END IF;

  -- `OR true` is never intentional and 20260822000013 found five of them. Cheap to re-assert on
  -- a file that writes two new policies.
  SELECT string_agg(tablename || '.' || policyname, ', ') INTO v_bad FROM pg_policies
   WHERE schemaname = 'public'
     AND tablename IN ('safety_check_ins', 'safety_check_in_people')
     AND (COALESCE(qual, '') || COALESCE(with_check, '')) LIKE '%OR true%';
  IF v_bad IS NOT NULL THEN
    RAISE EXCEPTION 'a safety check-in policy contains OR true: %', v_bad;
  END IF;

  -- 2. The claim function is reachable by nobody in the browser (§2b rule 1), and still carries
  --    its concurrency clause. The second half is TEXTUAL because it cannot be observed from one
  --    session — stated rather than left to be assumed away later.
  IF has_function_privilege('authenticated',
       'public.claim_safety_check_in_asks(uuid, text, int)', 'EXECUTE') THEN
    RAISE EXCEPTION 'claim_safety_check_in_asks is executable by authenticated';
  END IF;
  IF has_function_privilege('anon',
       'public.claim_safety_check_in_asks(uuid, text, int)', 'EXECUTE') THEN
    RAISE EXCEPTION 'claim_safety_check_in_asks is executable by anon';
  END IF;
  SELECT p.prosrc INTO v_src FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
   WHERE n.nspname = 'public' AND p.proname = 'claim_safety_check_in_asks';
  IF v_src IS NULL OR v_src NOT LIKE '%FOR UPDATE SKIP LOCKED%' THEN
    RAISE EXCEPTION 'claim_safety_check_in_asks has lost FOR UPDATE SKIP LOCKED — two '
      'concurrent senders can now ask one relative twice';
  END IF;

  -- 3. The resource is registered, restricted, and grantable.
  IF NOT EXISTS (SELECT 1 FROM public.permission_resources
                  WHERE key = 'community/safety-check-ins' AND category = 'community') THEN
    RAISE EXCEPTION 'community/safety-check-ins is not registered in the community category';
  END IF;
  SELECT string_agg(key, ', ') INTO v_bad
    FROM (SELECT key FROM public.permission_resources
           WHERE category = 'community' AND sort_order = 66) s;
  IF v_bad IS DISTINCT FROM 'community/safety-check-ins' THEN
    RAISE EXCEPTION 'sort_order 66 in the community category is held by: %', v_bad;
  END IF;
  IF EXISTS (SELECT 1 FROM public.people WHERE family_code IS NOT NULL AND family_code <> '')
     AND NOT EXISTS (SELECT 1 FROM public.resource_visibility
                      WHERE resource_key = 'community/safety-check-ins'
                        AND visibility = 'restricted') THEN
    RAISE EXCEPTION 'community/safety-check-ins has no restricted visibility row — a key that '
      'gates a table would publish every check-in''s roster';
  END IF;
  IF EXISTS (SELECT 1 FROM public.permission_templates WHERE is_system AND name = 'Administrators')
     AND NOT EXISTS (
       SELECT 1 FROM public.template_permissions tp
         JOIN public.permission_templates t ON t.id = tp.template_id
        WHERE t.is_system AND t.name = 'Administrators'
          AND tp.resource_key = 'community/safety-check-ins' AND tp.action = 'view'
          AND tp.scope = 'any') THEN
    RAISE EXCEPTION 'community/safety-check-ins is restricted and no system template grants it';
  END IF;
  -- AND THE HALF THAT IS ABOUT THE FEATURE WORKING. Without a General `view` grant every
  -- ordinary member gets a 404 from `requireView`, so the only people who could answer their own
  -- check-in would be administrators.
  IF EXISTS (SELECT 1 FROM public.permission_templates WHERE is_system AND name = 'General')
     AND NOT EXISTS (
       SELECT 1 FROM public.template_permissions tp
         JOIN public.permission_templates t ON t.id = tp.template_id
        WHERE t.is_system AND t.name = 'General'
          AND tp.resource_key = 'community/safety-check-ins' AND tp.action = 'view'
          AND tp.scope IN ('own', 'any')) THEN
    RAISE EXCEPTION 'General holds no view grant on community/safety-check-ins — members could '
      'not open the screen to answer';
  END IF;

  -- 3b. The map rows exist and their expressions match what the policies were written with. Two
  --     expressions of one predicate, so the check is that they still agree.
  SELECT own_expr INTO v_bad FROM public.permission_table_map
   WHERE table_name = 'safety_check_ins';
  IF v_bad IS DISTINCT FROM 'raised_by = public.auth_person_id()' THEN
    RAISE EXCEPTION 'safety_check_ins'' map own_expr disagrees with its policy: %', v_bad;
  END IF;
  SELECT self_expr INTO v_bad FROM public.permission_table_map
   WHERE table_name = 'safety_check_in_people';
  IF v_bad IS DISTINCT FROM 'person_id = public.auth_person_id()' THEN
    RAISE EXCEPTION 'safety_check_in_people'' map self_expr disagrees with its policy: %', v_bad;
  END IF;

  -- 4. The guards, the CHECKs and the index, exercised. Unwound by a sentinel, because a probe
  --    here writes real rows and there is no correct way to leave them behind.
  BEGIN
    INSERT INTO public.families (family_code, family_name) VALUES (v_fam,  'sci probe 1');
    INSERT INTO public.families (family_code, family_name) VALUES (v_fam2, 'sci probe 2');
    INSERT INTO public.people (family_code, first_name, last_name, primary_email)
      VALUES (v_fam, 'Probe', 'One', 'zzsci1@example.invalid') RETURNING id INTO v_p1;
    INSERT INTO public.people (family_code, first_name, last_name, primary_email)
      VALUES (v_fam2, 'Probe', 'Two', 'zzsci2@example.invalid') RETURNING id INTO v_p2;

    -- 4a. A raiser from another family.
    v_ok := false;
    BEGIN
      INSERT INTO public.safety_check_ins (family_code, title, raised_by)
        VALUES (v_fam, 'probe storm', v_p2);
    EXCEPTION WHEN check_violation THEN v_ok := true;
    END;
    IF NOT v_ok THEN RAISE EXCEPTION 'safety_check_ins accepted a cross-family raiser'; END IF;

    -- 4b. The positive control, which everything below depends on.
    INSERT INTO public.safety_check_ins (family_code, title, raised_by)
      VALUES (v_fam, 'probe storm', v_p1) RETURNING id INTO v_c1;

    -- 4c. A person from another family on the roster.
    v_ok := false;
    BEGIN
      INSERT INTO public.safety_check_in_people (family_code, check_in_id, person_id)
        VALUES (v_fam, v_c1, v_p2);
    EXCEPTION WHEN check_violation THEN v_ok := true;
    END;
    IF NOT v_ok THEN
      RAISE EXCEPTION 'safety_check_in_people accepted a person from another family';
    END IF;

    INSERT INTO public.safety_check_in_people
      (family_code, check_in_id, person_id, email)
      VALUES (v_fam, v_c1, v_p1, 'probe@example.invalid');

    -- 4d. ASKING ONE PERSON TWICE IS REFUSED. Two rows for one relative means two rows in the
    --     unanswered column, one of which can never be cleared.
    v_ok := false;
    BEGIN
      INSERT INTO public.safety_check_in_people
        (family_code, check_in_id, person_id, email)
        VALUES (v_fam, v_c1, v_p1, 'probe@example.invalid');
    EXCEPTION WHEN unique_violation THEN v_ok := true;
    END;
    IF NOT v_ok THEN
      RAISE EXCEPTION 'safety_check_in_people accepted two rows for one person';
    END IF;

    -- 4e. AN ANSWER WITHOUT A TIME, AND A TIME WITHOUT AN ANSWER, are both refused. The pair
    --     that stops `state` and `responded_at` from ever disagreeing.
    v_ok := false;
    BEGIN
      UPDATE public.safety_check_in_people SET state = 'safe'
       WHERE check_in_id = v_c1 AND person_id = v_p1;
    EXCEPTION WHEN check_violation THEN v_ok := true;
    END;
    IF NOT v_ok THEN
      RAISE EXCEPTION 'safety_check_in_people accepted an answer with no responded_at';
    END IF;
    v_ok := false;
    BEGIN
      UPDATE public.safety_check_in_people SET responded_at = now()
       WHERE check_in_id = v_c1 AND person_id = v_p1;
    EXCEPTION WHEN check_violation THEN v_ok := true;
    END;
    IF NOT v_ok THEN
      RAISE EXCEPTION 'safety_check_in_people accepted a responded_at with no answer';
    END IF;
    -- The positive control for the pair: together they are accepted.
    UPDATE public.safety_check_in_people SET state = 'safe', responded_at = now()
     WHERE check_in_id = v_c1 AND person_id = v_p1;

    -- 4f. The claim function claims, and refuses the wrong family. Re-queued first, because 4e
    --     answered the one row and answering does not reset `reach`.
    UPDATE public.safety_check_in_people SET reach = 'pending'
     WHERE check_in_id = v_c1 AND person_id = v_p1;
    IF (SELECT count(*) FROM public.claim_safety_check_in_asks(v_c1, v_fam, 10)) <> 1 THEN
      RAISE EXCEPTION 'claim_safety_check_in_asks did not claim the one pending ask';
    END IF;
    IF (SELECT count(*) FROM public.claim_safety_check_in_asks(v_c1, v_fam, 10)) <> 0 THEN
      RAISE EXCEPTION 'claim_safety_check_in_asks re-claimed a row it had already claimed';
    END IF;
    v_ok := false;
    BEGIN
      PERFORM count(*) FROM public.claim_safety_check_in_asks(v_c1, v_fam2, 10);
    EXCEPTION WHEN insufficient_privilege THEN v_ok := true;
    END;
    IF NOT v_ok THEN
      RAISE EXCEPTION 'claim_safety_check_in_asks served a check-in from another family';
    END IF;

    -- 4g. An area scope with no area named is refused, and so is a named scope carrying one.
    v_ok := false;
    BEGIN
      INSERT INTO public.safety_check_ins (family_code, title, scope)
        VALUES (v_fam, 'probe', 'region');
    EXCEPTION WHEN check_violation THEN v_ok := true;
    END;
    IF NOT v_ok THEN
      RAISE EXCEPTION 'safety_check_ins accepted a region scope naming no region';
    END IF;

    DECLARE v_region uuid;
    BEGIN
      INSERT INTO public.regions (family_code, name) VALUES (v_fam, 'probe region')
        RETURNING id INTO v_region;
      v_ok := false;
      BEGIN
        INSERT INTO public.safety_check_ins (family_code, title, scope, region_id)
          VALUES (v_fam, 'probe', 'named', v_region);
      EXCEPTION WHEN check_violation THEN v_ok := true;
      END;
      IF NOT v_ok THEN
        RAISE EXCEPTION 'safety_check_ins accepted a named scope carrying an area';
      END IF;
      -- And the region scope's own positive control, so the CHECK above is not passing because
      -- the constraint refuses everything.
      INSERT INTO public.safety_check_ins (family_code, title, scope, region_id)
        VALUES (v_fam, 'probe regional', 'region', v_region);
    END;

    -- 4h. A closed check-in must carry a time, and an open one must not.
    v_ok := false;
    BEGIN
      UPDATE public.safety_check_ins SET status = 'closed' WHERE id = v_c1;
    EXCEPTION WHEN check_violation THEN v_ok := true;
    END;
    IF NOT v_ok THEN
      RAISE EXCEPTION 'safety_check_ins accepted a closed check-in with no closed_at';
    END IF;
    UPDATE public.safety_check_ins SET status = 'closed', closed_at = now(), closed_by = v_p1
     WHERE id = v_c1;

    RAISE EXCEPTION 'unwind-safety-check-in-probe';
  EXCEPTION WHEN raise_exception THEN
    IF SQLERRM <> 'unwind-safety-check-in-probe' THEN RAISE; END IF;
  END;

  RAISE NOTICE 'safety check-ins: two tables, no write policy, guards, CHECKs and claim exercised';
END $mig$;

COMMIT;
