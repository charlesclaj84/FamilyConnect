-- ═══════════════════════════════════════════════════════════════════════════════════════
-- EMAIL DISTRIBUTIONS — `/community/distributions`, Premium.
--
-- `/pricing` has sold this since the Premium card existed: *"Email the whole family without
-- building a list — distributions that draw straight from your membership, so nobody is
-- missed and nobody is on it twice."* FutureFeature.md §1 has carried it as a claim with no
-- code, and this is the code. THE FIRST PREMIUM ROUTE: `lib/features.ts` said "NOTHING IS
-- PREMIUM, and that is correct rather than an omission" until today.
--
-- ── WHY THIS IS TWO TABLES AND THE SECOND ONE IS THE FEATURE ───────────────────────────
-- `distributions` is what somebody wrote. `distribution_recipients` is one row per addressed
-- relative, and it is doing three jobs at once that would otherwise need three mechanisms:
--
--   THE QUEUE      `lib/email/send.ts` takes ONE `to` per call and there is no job runner
--                  anywhere in this product — no cron, no worker, no vercel.json. So the
--                  fan-out is chunked and resumable, and these rows ARE the work list. A
--                  send interrupted by a closed laptop resumes because the state is here
--                  rather than in a request.
--   THE RECORD     `sendEmail` FAILS SOFT by design (its header argues why), so per-recipient
--                  delivery is the only place the outcome can be honestly kept. AGENTS.md's
--                  rule for the whole email layer is that "a caller must not render success
--                  over an email that did not go", and a table with a state per person is
--                  what makes that possible rather than aspirational.
--   THE DEDUPE     "nobody is on it twice" is a claim about a computation, and the partial
--                  unique index below is what makes it structural instead of a property of
--                  whichever code path last wrote a row.
--
-- ── THE ADDRESS IS COPIED ONTO THE ROW, NOT JOINED ─────────────────────────────────────
-- `distribution_recipients.email` is a SNAPSHOT. Exactly the decision `gathering_tasks` makes
-- about its `label` and `kind` and for the same reason: what was asked must not change when
-- the source is edited afterwards. A relative who updates their address next month must not
-- retroactively rewrite the history of a message that reached the old one — and a bounce
-- investigated a week later has to be able to say which address bounced.
--
-- ── SIX STATES, AND THE LAST THREE ARE WHY THIS IS NOT A `sent boolean` ────────────────
-- `pending | sent | failed | duplicate | unreachable | cancelled`. lib/distribution-audience.ts
-- argues each one; the two that matter most here are:
--
--   `unreachable`  a recorded relative with a GENERATED address. `placeholderEmail()` builds
--                  those on **@genorra.com** — a REAL domain — so `sendEmail`'s reserved-TLD
--                  guard does NOT catch them, and mailing one is a hard bounce against our own
--                  sending reputation. lib/family-tree.ts says every sender owes this check;
--                  this is where it is owed. Filed as `failed` it would also sit forever in
--                  the column an organizer works through.
--   `duplicate`    both relatives sharing a mailbox keep a row, so the family's arithmetic
--                  still accounts for both of them, and only one of them is mailed.
--
-- THERE IS NO `status` COLUMN ON `distributions`. The rows are the truth and
-- `distributionProgress()` derives the label from the counts. A stored status is the `is_minor`
-- trap (AGENTS.md §4b): a second fact about the same thing, kept in step by whichever write
-- path remembered, stale the first time a send is interrupted.
--
-- ── THE BOUNDARY: NO WRITE POLICY, AND THE READ IS THE PERMISSION KEY ──────────────────
-- Both tables get ONE `perm:…:select` policy reproducing `_perm_predicate()`'s rendering
-- exactly (§2c, and the shape all six Gatherings tables use), and no INSERT/UPDATE/DELETE
-- policy at all — which denies the browser those commands outright. Every write is a server
-- action on `createAdminClient()` re-applying family scoping by hand (§3), with guard triggers
-- refusing a cross-family id underneath (§4).
--
-- THE READ IS GATED ON THE KEY, unlike Bylaws or Meeting Minutes, and that is a decision. A
-- distribution's recipient list is every relative's email address in one place with a delivery
-- outcome beside it — the sharpest contact-data surface in the product. It is not the family's
-- record of itself the way its minutes are; it is an operational log of a tool a few people
-- use. So `community/distributions` has a `permission_table_map` row and the SELECT policy
-- composes `auth_permission` from it, which makes the key withhold ROWS and not merely a
-- screen. That is the opposite of `gatherings/budget`, and §2c is why the distinction is worth
-- stating: a key that gates no table cannot hide anything.
--
-- ── `own_expr` IS THE SENDER, AND `self_expr` IS DELIBERATELY `false` ──────────────────
-- Scope `'own'` on `view` means "the distributions I sent", which is a coherent narrowing and
-- is offered. `self_expr` is `false` on both tables: there is no sense in which a RECIPIENT
-- owns the distribution that mailed them, and an expression admitting them would publish the
-- whole roster to everybody the roster contains — which is the entire audience.
--
-- ── THE CLAIM FUNCTION IS SQL BECAUSE THE APP RACES ITSELF ─────────────────────────────
-- `claim_distribution_recipients()` flips a bounded set of `pending` rows to `sending` and
-- returns them, in ONE statement, under `FOR UPDATE SKIP LOCKED`. Read-modify-write from the
-- action is what two administrators pressing Send at the same moment turn into two copies of
-- the same message — the same argument `consume_family_removal_challenge` makes about a
-- five-branch read-modify-write, and the same answer.
--
-- IT IS GRANTED TO NOBODY (§2b rule 1). Only the admin client calls it, and `service_role`
-- keeps EXECUTE by default. It takes the family code as well as the distribution id and
-- asserts the two agree, so per §2b rule 3 it is written as if reachable: even granted, it
-- could not be pointed at another family's distribution.
--
-- ── CHECKED BY MUTATION, per AGENTS.md §7 ─────────────────────────────────────────────
--   the partial unique index not created
--     ERROR: distribution_recipients accepted two live rows for one address
--   the index made unconditional (no WHERE)
--     ERROR: distribution_recipients refused a duplicate row for a shared mailbox
--   a write policy added to either table
--     ERROR: distribution_recipients has 1 write policy/policies — the actions are the boundary
--   the guard trigger on distributions not created
--     ERROR: distributions accepted a cross-family sender
--   the guard trigger on distribution_recipients not created
--     ERROR: distribution_recipients accepted a recipient from another family
--   `FOR UPDATE SKIP LOCKED` removed from the claim function
--     not detectable here — see the note above the function. It is a concurrency property and
--     a single-session migration cannot observe it; it is asserted textually instead.
--   the Administrators grant omitted
--     ERROR: community/distributions is restricted and no system template grants it
--
-- HOW THIS REACHES A DATABASE
--   `supabase db push`, from CI on merge to master — never `psql -f` by hand. See AGENTS.md,
--   "How migrations reach the hosted project".
-- ═══════════════════════════════════════════════════════════════════════════════════════

BEGIN;

-- ── §1. WHAT SOMEBODY WROTE ────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.distributions (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  family_code   text NOT NULL,
  subject       text NOT NULL,
  -- PLAIN TEXT, and it must stay plain text. `distributionEmail` escapes it with `esc()` and
  -- splits it on blank lines; storing HTML here would put a member-authored markup string one
  -- interpolation away from every relative's mail client.
  body          text NOT NULL,
  -- ── WHERE IT WAS AIMED ────────────────────────────────────────────────────
  -- 'family' is what an election calls 'national'; lib/distribution-audience.ts argues the one
  -- word of divergence. The area columns are NOT redundant with the recipient rows: those
  -- record who was addressed, and this records what was ASKED FOR, which is the only thing
  -- that can be checked against what somebody meant.
  scope         text NOT NULL DEFAULT 'family',
  region_id     uuid REFERENCES public.regions(id)  ON DELETE SET NULL,
  chapter_id    uuid REFERENCES public.chapters(id) ON DELETE SET NULL,
  -- Who sent it. SET NULL rather than CASCADE: removing a person must not delete the record
  -- that a message went to a hundred and forty relatives.
  sent_by       uuid REFERENCES public.people(id) ON DELETE SET NULL,
  -- ── THE REPLY-TO, SNAPSHOTTED FOR THE SAME REASON THE RECIPIENT ADDRESS IS ─
  -- The sender's own address at the moment they sent, so a relative pressing Reply reaches the
  -- person who wrote it rather than support@. Resolved server-side from the caller's `people`
  -- row and NEVER a parameter — a client-chosen reply-to on a mail carrying our SPF and DKIM
  -- is the phishing shape lib/email/README.md's first rule is about.
  reply_to      text,
  -- Relatives the audience did NOT address, at resolution time. `notAddressed` from the pure
  -- module, kept so the screen can print "38 of 141" long afterwards — by which time the
  -- roster has changed and the figure could not be recomputed.
  not_addressed int NOT NULL DEFAULT 0,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT distributions_scope_check
    CHECK (scope IN ('family', 'region', 'chapter')),
  CONSTRAINT distributions_subject_not_blank CHECK (btrim(subject) <> ''),
  CONSTRAINT distributions_body_not_blank    CHECK (btrim(body) <> ''),
  -- AN AREA SCOPE NAMES ITS AREA. The inverse of the announcement rule, deliberately: there,
  -- 'chapter' with no chapter is treated as family-wide because publishing to nobody is worse;
  -- here, widening a misconfigured audience to the whole family IS the mail cannon. The action
  -- refuses it first and this is the floor under that.
  CONSTRAINT distributions_area_named CHECK (
    (scope = 'family'  AND region_id IS NULL AND chapter_id IS NULL)
    OR (scope = 'region'  AND region_id  IS NOT NULL)
    OR (scope = 'chapter' AND chapter_id IS NOT NULL)
  )
);

CREATE INDEX IF NOT EXISTS distributions_family_recent_idx
  ON public.distributions (family_code, created_at DESC);
CREATE INDEX IF NOT EXISTS distributions_sent_by_fk_idx  ON public.distributions (sent_by);
CREATE INDEX IF NOT EXISTS distributions_region_fk_idx   ON public.distributions (region_id);
CREATE INDEX IF NOT EXISTS distributions_chapter_fk_idx  ON public.distributions (chapter_id);

COMMENT ON TABLE public.distributions IS
  'One email distribution: what was written, where it was aimed, and who sent it. The '
  'delivery record is distribution_recipients, one row per addressed relative. There is '
  'deliberately no status column — it is derived from those rows by '
  'distributionProgress() in lib/distribution-audience.ts.';
COMMENT ON COLUMN public.distributions.reply_to IS
  'The sender''s own address at send time, so a relative can reply to the person who wrote '
  'it. Resolved on the server from the caller''s people row; never a parameter.';

-- ── §2. WHO IT WENT TO, AND WHAT HAPPENED ──────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.distribution_recipients (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  family_code     text NOT NULL,
  distribution_id uuid NOT NULL REFERENCES public.distributions(id) ON DELETE CASCADE,
  -- KEYED ON `people.id`, NEVER `auth.users.id`. The retired `event_assignments` keyed its
  -- assignee on an auth id and AGENTS.md records what that cost: one auth id is identical
  -- across every family the user belongs to, so every query needs an `!inner` join, and an
  -- account-less relative can never be addressed at all — which for THIS feature would mean
  -- the `unreachable` state could not exist.
  person_id       uuid NOT NULL REFERENCES public.people(id) ON DELETE CASCADE,
  -- The address AS SENT. A snapshot; see the header.
  email           text NOT NULL,
  state           text NOT NULL DEFAULT 'pending',
  -- Server-side diagnostics for a failure — a Resend status, a DNS error. Shown to nobody:
  -- `sendEmail`'s own `SendResult.error` carries the same caveat and for the same reason.
  error           text,
  sent_at         timestamptz,
  created_at      timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT distribution_recipients_state_check CHECK (
    state IN ('pending', 'sending', 'sent', 'failed', 'duplicate', 'unreachable', 'cancelled')
  )
);

-- ── ONE ROW PER PERSON PER DISTRIBUTION — AND IT IS AN INDEX, NOT A CONSTRAINT ─────────
-- The guarantee is identical (Postgres enforces both through the same index) and the reason to
-- prefer the index here is PostgREST. This table has foreign keys to exactly two tables,
-- `distributions` and `people`, which is the junction-table SHAPE §8's `announcement_unpins`
-- incident is about: PostgREST then reports a many-to-many path between that pair, and every
-- bare `people(...)` embed on `distributions` becomes PGRST201 — which arrives as `[]` from an
-- action that discards the error, on a page nobody edited.
--
-- A surrogate `id` primary key is what normally prevents that inference, and `chapters`'
-- experience (recorded in lib/chapter-places.ts) is the precedent. But a UNIQUE CONSTRAINT
-- across exactly the two foreign-key columns is the other thing that can look like a junction
-- key, and the cost of finding out the hard way is a silently empty screen. So the uniqueness
-- lives in an index, which relationship inference does not read, and every embed in
-- app/actions/distributions.ts names its constraint anyway. Two independent reasons it cannot
-- happen, for a rule that has cost this codebase a production page twice.
CREATE UNIQUE INDEX IF NOT EXISTS distribution_recipients_one_per_person_idx
  ON public.distribution_recipients (distribution_id, person_id);

-- ── `sending` IS A SEVENTH STATE THAT THE TYPESCRIPT DOES NOT NAME, ON PURPOSE ─────────
-- It exists for a few seconds between being claimed and the provider answering, and it is the
-- claim itself: a row in `sending` is one another worker must not pick up. It is deliberately
-- absent from `RecipientState` in lib/distribution-audience.ts, because nothing outside this
-- table's own transaction should be reasoning about it — `countStates` ignores an unrecognised
-- value, so a row caught mid-flight is simply not counted rather than mis-reported. A row
-- STRANDED there (the process died between the claim and the write-back) is recovered by
-- `requeueDistribution`, which the screen offers as "Try again".
COMMENT ON COLUMN public.distribution_recipients.state IS
  'pending | sending | sent | failed | duplicate | unreachable | cancelled. `sending` is the '
  'claim held by claim_distribution_recipients() and is not part of RecipientState in '
  'lib/distribution-audience.ts — see the migration.';

-- ── §2b. "NOBODY IS ON IT TWICE", AS AN INDEX ──────────────────────────────────────────
-- The `/pricing` claim, enforced by the database rather than by whichever code path last wrote
-- a row. PARTIAL, and the WHERE clause is the whole subtlety:
--
--   * `state <> 'duplicate'` is what lets BOTH relatives sharing a mailbox keep a row. Without
--     the predicate this index would refuse the second one, and the family's addressed count
--     would silently disagree with the number of people in the audience.
--   * `lower(email)` matches `normalizeAddress()` in the pure module exactly. Two expressions
--     of one rule, which this codebase normally forbids — admissible here for the reason
--     `announcementAudienceFilter` is: they live on opposite sides of PostgREST. The
--     TypeScript is the AUTHORITY (it decides which row is written as `duplicate`) and this is
--     the backstop that cannot be bypassed by a future caller.
--   * A row moving pending -> sending -> sent stays inside the predicate throughout, so the
--     index constrains the whole lifecycle rather than only the insert.
CREATE UNIQUE INDEX IF NOT EXISTS distribution_recipients_one_per_address_idx
  ON public.distribution_recipients (distribution_id, lower(email))
  WHERE state <> 'duplicate';

CREATE INDEX IF NOT EXISTS distribution_recipients_queue_idx
  ON public.distribution_recipients (distribution_id, state, created_at);
CREATE INDEX IF NOT EXISTS distribution_recipients_family_idx
  ON public.distribution_recipients (family_code);
CREATE INDEX IF NOT EXISTS distribution_recipients_person_fk_idx
  ON public.distribution_recipients (person_id);

COMMENT ON TABLE public.distribution_recipients IS
  'One row per addressed relative: the queue, the delivery record and the dedupe, all three. '
  'email is a snapshot of the address at send time, never a join. Written only through '
  'app/actions/distributions.ts.';

-- ── §3. RLS: ONE SELECT POLICY EACH, AND NO WRITE POLICY ───────────────────────────────
--
-- Each reproduces `_perm_predicate()`'s rendering EXACTLY, so the hand-written policy and the
-- `permission_table_map` row in §4 cannot disagree and a future sweep re-composing from that
-- row would produce the identical predicate:
--
--     ((<self_expr>) OR auth_permission(k,a) = 'any' OR (auth_permission(k,a) = 'own' AND (<own_expr>)))
--
-- The literal `(false)` is written out rather than dropped, which reads oddly and is the point:
-- it is what makes the policy diff-able against the model.
--
-- `auth_membership_approved()` on both, as every policy has carried since 20260806000011 —
-- belt and braces, written out rather than assumed, because a policy dropped and recreated
-- without it quietly re-admits an applicant.

ALTER TABLE public.distributions            ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.distribution_recipients  ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "perm:distributions:select" ON public.distributions;
CREATE POLICY "perm:distributions:select"
  ON public.distributions FOR SELECT TO authenticated
  USING (
    family_code = public.auth_family_code()
    AND public.auth_membership_approved()
    AND (
      (false)                                                                          -- self_expr
      OR public.auth_permission('community/distributions', 'view'::public.permission_action) = 'any'
      OR (public.auth_permission('community/distributions', 'view'::public.permission_action) = 'own'
          AND (sent_by = public.auth_person_id()))                                     -- own_expr
    )
  );

-- ── THE CHILD TABLE'S `own_expr` REACHES THROUGH THE PARENT, AND MUST ─────────────────
-- "the distributions I sent" has to mean the same thing on both tables, and a recipient row
-- has no `sent_by` of its own. A `self_expr` admitting the RECIPIENT was considered and
-- rejected: every addressed relative would then be able to read their own row, and a row
-- carries an address and a delivery state — so the whole roster would be readable by exactly
-- the set of people the roster is made of.
DROP POLICY IF EXISTS "perm:distribution_recipients:select" ON public.distribution_recipients;
CREATE POLICY "perm:distribution_recipients:select"
  ON public.distribution_recipients FOR SELECT TO authenticated
  USING (
    family_code = public.auth_family_code()
    AND public.auth_membership_approved()
    AND (
      (false)                                                                          -- self_expr
      OR public.auth_permission('community/distributions', 'view'::public.permission_action) = 'any'
      OR (public.auth_permission('community/distributions', 'view'::public.permission_action) = 'own'
          AND (EXISTS (SELECT 1 FROM public.distributions d
                        WHERE d.id = distribution_id
                          AND d.sent_by = public.auth_person_id())))                    -- own_expr
    )
  );

-- §2c: a statement of what these tables are for, not what makes them safe. The absence of a
-- write policy is what makes them safe.
GRANT SELECT ON public.distributions           TO authenticated;
GRANT SELECT ON public.distribution_recipients TO authenticated;

-- ── §4. THE RESOURCE ROW ───────────────────────────────────────────────────────────────
--
-- IT COMES BEFORE THE MAP ROW BECAUSE `permission_table_map.resource_key` REFERENCES IT.
-- That foreign key is why this section is not down with the other permission plumbing where a
-- reader would expect it: the first draft of this file registered the key last, in the
-- neighbourhood of the visibility backfill and the template grants, and aborted its own first
-- `db reset` with 23503. The policies above need no such ordering — they carry the key as a
-- string literal inside `auth_permission(...)`, with nothing to resolve.
--
-- CATEGORY `community`, sort_order 65 — after the three Announcements keys (60, 61, 62) and
-- before Directory (70). It sits beside Announcements in the grid because it sits beside
-- Announcements in the rail, and the two are the pair: one puts family news on a dashboard,
-- the other puts it in an inbox.
--
-- THREE ACTIONS, AND `edit` IS ABSENT ON PURPOSE. There is no draft state — you write it and
-- send it — so there is nothing to edit, and a SENT distribution is a record that must not be
-- rewritten (the argument `meeting_votes_are_final` makes, and the one `reopenGatheringTask`
-- makes about leaving a refused submission standing). `permission_resources.actions` decides
-- which switches the grid renders, and a switch nothing consults reads as a control being
-- honoured — the reason 20260808000000 narrowed two keys to `view` alone.
--
-- WHAT EACH ACTION BUYS:
--   view    read the log and the rosters
--   create  compose and send — and STOP a send in flight. Whoever may start a mail cannon may
--           stop one, and making the emergency brake harder to reach than the trigger is
--           backwards.
--   delete  remove the record. A strictly stronger grant, because it destroys the audit trail
--           of what was mailed to whom.
INSERT INTO public.permission_resources (key, label, category, subsection, sort_order, actions)
VALUES
  ('community/distributions', 'Distributions', 'community', NULL, 65,
   ARRAY['view', 'create', 'delete']::TEXT[])
ON CONFLICT (key) DO UPDATE
  SET label      = EXCLUDED.label,
      category   = EXCLUDED.category,
      subsection = EXCLUDED.subsection,
      sort_order = EXCLUDED.sort_order,
      actions    = EXCLUDED.actions;

-- ── §5. THE MAP ROW ────────────────────────────────────────────────────────────────────
-- What makes the policies above re-derivable, and what a future sweep would compose from. Both
-- tables key on the ONE resource, because a family that may read a distribution may read who
-- it went to — splitting them would produce a screen listing messages with no roster.
INSERT INTO public.permission_table_map (table_name, resource_key, own_expr, self_expr) VALUES
  ('distributions', 'community/distributions',
   'sent_by = public.auth_person_id()', 'false'),
  ('distribution_recipients', 'community/distributions',
   'EXISTS (SELECT 1 FROM public.distributions d WHERE d.id = distribution_id AND d.sent_by = public.auth_person_id())',
   'false')
ON CONFLICT (table_name) DO UPDATE
  SET resource_key = EXCLUDED.resource_key,
      own_expr     = EXCLUDED.own_expr,
      self_expr    = EXCLUDED.self_expr;

-- ── §6. THE GUARDS (§4) ────────────────────────────────────────────────────────────────
-- The service role ignores RLS and does not ignore triggers. Every id a caller can influence
-- is checked against the row's own family here, underneath the action's own `belongsToFamily`.

CREATE OR REPLACE FUNCTION public.tg_distribution_same_family()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_other text;
BEGIN
  IF NEW.sent_by IS NOT NULL THEN
    SELECT p.family_code INTO v_other FROM public.people p WHERE p.id = NEW.sent_by;
    IF v_other IS DISTINCT FROM NEW.family_code THEN
      RAISE EXCEPTION 'distributions: sender % is not in family %', NEW.sent_by, NEW.family_code
        USING ERRCODE = '23514';
    END IF;
  END IF;
  IF NEW.region_id IS NOT NULL THEN
    SELECT r.family_code INTO v_other FROM public.regions r WHERE r.id = NEW.region_id;
    IF v_other IS DISTINCT FROM NEW.family_code THEN
      RAISE EXCEPTION 'distributions: region % is not in family %', NEW.region_id, NEW.family_code
        USING ERRCODE = '23514';
    END IF;
  END IF;
  IF NEW.chapter_id IS NOT NULL THEN
    SELECT c.family_code INTO v_other FROM public.chapters c WHERE c.id = NEW.chapter_id;
    IF v_other IS DISTINCT FROM NEW.family_code THEN
      RAISE EXCEPTION 'distributions: chapter % is not in family %', NEW.chapter_id, NEW.family_code
        USING ERRCODE = '23514';
    END IF;
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS distributions_same_family ON public.distributions;
CREATE TRIGGER distributions_same_family BEFORE INSERT OR UPDATE ON public.distributions
  FOR EACH ROW EXECUTE FUNCTION public.tg_distribution_same_family();

DROP TRIGGER IF EXISTS distributions_updated_at ON public.distributions;
CREATE TRIGGER distributions_updated_at BEFORE UPDATE ON public.distributions
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- THE CHILD NEEDS ITS OWN, AND IT IS THE ONE A READER WOULD SKIP. `gathering_template_steps`
-- was missing exactly this for a day: a child table whose parent FK can point into another
-- family. Both ids are checked — the person, and the parent distribution.
CREATE OR REPLACE FUNCTION public.tg_distribution_recipient_same_family()
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
    RAISE EXCEPTION 'distribution_recipients: person % is not in family %',
      NEW.person_id, NEW.family_code USING ERRCODE = '23514';
  END IF;
  SELECT d.family_code INTO v_other
    FROM public.distributions d WHERE d.id = NEW.distribution_id;
  IF v_other IS DISTINCT FROM NEW.family_code THEN
    RAISE EXCEPTION 'distribution_recipients: distribution % is not in family %',
      NEW.distribution_id, NEW.family_code USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS distribution_recipients_same_family ON public.distribution_recipients;
CREATE TRIGGER distribution_recipients_same_family
  BEFORE INSERT OR UPDATE ON public.distribution_recipients
  FOR EACH ROW EXECUTE FUNCTION public.tg_distribution_recipient_same_family();

-- ── §7. CLAIMING A BATCH, IN ONE STATEMENT ─────────────────────────────────────────────
--
-- `FOR UPDATE SKIP LOCKED` is the whole reason this is SQL and not three supabase-js calls.
-- Two administrators pressing Send at the same moment, or one member with two tabs open, is
-- a read-modify-write racing itself — and what it produces is not a lost update, it is the
-- same message delivered twice to the same relative, which cannot be taken back.
--
-- `SKIP LOCKED` rather than plain `FOR UPDATE`: a second caller must get the NEXT batch
-- immediately rather than blocking on the first one's rows and then finding them all claimed.
--
-- THE FAMILY CODE IS A PARAMETER AND IS ASSERTED, not trusted. Per §2b rule 3 this is written
-- as if reachable even though it is granted to nobody: the distribution must be in the family
-- the caller claims, so even a future mis-grant could not point it across the boundary. Note
-- what it deliberately does NOT do — it does not re-derive the caller from `auth.uid()`,
-- because it has no caller: only the admin client invokes it, and the ACTION resolves the
-- permission. Making it self-authorizing would mean granting it to `authenticated`, which is
-- the one thing §2b says not to do to a function nothing in the browser needs.
CREATE OR REPLACE FUNCTION public.claim_distribution_recipients(
  p_distribution_id uuid,
  p_family_code     text,
  p_limit           int
)
RETURNS TABLE (id uuid, person_id uuid, email text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.distributions d
     WHERE d.id = p_distribution_id AND d.family_code = p_family_code
  ) THEN
    RAISE EXCEPTION 'distribution % is not in family %', p_distribution_id, p_family_code
      USING ERRCODE = '42501';
  END IF;

  RETURN QUERY
  UPDATE public.distribution_recipients r
     SET state = 'sending'
   WHERE r.id IN (
     SELECT c.id FROM public.distribution_recipients c
      WHERE c.distribution_id = p_distribution_id
        AND c.family_code     = p_family_code
        AND c.state           = 'pending'
      ORDER BY c.created_at, c.id
      LIMIT GREATEST(p_limit, 0)
      FOR UPDATE SKIP LOCKED
   )
  RETURNING r.id, r.person_id, r.email;
END $$;

-- §2b RULE 1: NO GRANT. `service_role` keeps EXECUTE by default and nothing in the browser
-- calls this. Default privileges (20260806000015) already revoke it from `anon` and
-- `authenticated`; the verify block below asserts that rather than assuming it.
REVOKE ALL ON FUNCTION public.claim_distribution_recipients(uuid, text, int) FROM PUBLIC;

COMMENT ON FUNCTION public.claim_distribution_recipients(uuid, text, int) IS
  'Flip up to p_limit pending recipients to `sending` and return them, under FOR UPDATE SKIP '
  'LOCKED, so two concurrent senders cannot mail one relative twice. Service role only — no '
  'grant to authenticated, deliberately.';

-- ── §8. RESTRICTED FOR EVERY EXISTING FAMILY ───────────────────────────────────────────
-- §6's obligation, and here it is not the usual caution. This key gates a TABLE, so absence of
-- a visibility row would resolve `view` to the `'everyone'` default and publish every
-- relative's address, with a delivery state beside it, to the whole family through PostgREST.
--
-- Derived from `people` rather than `families`, matching 20260820000003 and 20260822000023: a
-- family whose row predates the `families` backfills still has members, and a family with no
-- members has nobody to restrict anything from.
INSERT INTO public.resource_visibility (family_code, resource_key, visibility)
SELECT DISTINCT p.family_code, 'community/distributions', 'restricted'
  FROM public.people p
 WHERE p.family_code IS NOT NULL AND p.family_code <> ''
ON CONFLICT (family_code, resource_key) DO NOTHING;

-- ── §9. THE ADMINISTRATORS GRANT ───────────────────────────────────────────────────────
-- "Restricted with nobody granted is a screen that exists and cannot be opened", and in the
-- worst ordering the screen that just locked is the one that could unlock it. All three
-- actions at `'any'`, which is what an administrator template means.
INSERT INTO public.template_permissions (template_id, resource_key, action, scope, updated_at)
SELECT t.id, 'community/distributions', a.action::public.permission_action,
       'any'::public.permission_scope, NOW()
  FROM public.permission_templates t
 CROSS JOIN (VALUES ('view'), ('create'), ('delete')) AS a(action)
 WHERE t.is_system AND t.name = 'Administrators'
ON CONFLICT (template_id, resource_key, action) DO NOTHING;

-- ── §10. AND AN EXPLICIT `none` FOR GENERAL ────────────────────────────────────────────
-- The grid is MATERIALIZED (20260807000000): every template carries an explicit row for every
-- resource and action, so the screen can show the whole answer without explaining a
-- fall-through. A resource registered later has no row in the templates that already exist.
-- This writes what `seed_family_permission_templates` will write for a family created after
-- today, so an existing family's General template renders a switch an administrator can move.
--
-- `none` ON ALL THREE, INCLUDING `view`. An ordinary member has no business reading the
-- family's contact list with delivery outcomes against it, and this is the one key in the
-- `community` block where that is true.
INSERT INTO public.template_permissions (template_id, resource_key, action, scope, updated_at)
SELECT t.id, 'community/distributions', a.action::public.permission_action,
       'none'::public.permission_scope, NOW()
  FROM public.permission_templates t
 CROSS JOIN (VALUES ('view'), ('create'), ('delete')) AS a(action)
 WHERE t.is_system AND t.name = 'General'
ON CONFLICT (template_id, resource_key, action) DO NOTHING;

-- ── §11. NEW FAMILIES GET IT RESTRICTED TOO ────────────────────────────────────────────
-- `seed_family_permission_templates()` carries a `v_restricted` array. REWRITTEN IN PLACE
-- rather than restated: the function has been redefined by five migrations since it was
-- written, and restating a hundred lines to change one array is how a grant added in one of
-- them gets quietly reverted. 20260822000023 does the same thing for the same reason, and the
-- verify block below asserts the grants it must not have lost.
DO $mig$
DECLARE
  v_def text;
  -- MATCHED ON THE WHOLE ARRAY LITERAL, not on one key or on a fragment of two. That is
  -- 20260822000023's own instruction and its reason: 20260820000004 leaves an assertion in
  -- this function's body that names some of the same keys, so a narrower match can hit two
  -- places — and a match that can hit two places is one that will.
  v_old text := 'ARRAY[''reporting/dues-projections'', ''gatherings/budget'','
                || E'\n' || '                               ''reporting/membership'','
                || E'\n' || '                               ''reporting/gatherings'', ''reporting/elections'','
                || E'\n' || '                               ''reporting/meetings'', ''reporting/board'']';
  v_new text := 'ARRAY[''reporting/dues-projections'', ''gatherings/budget'','
                || E'\n' || '                               ''reporting/membership'','
                || E'\n' || '                               ''reporting/gatherings'', ''reporting/elections'','
                || E'\n' || '                               ''reporting/meetings'', ''reporting/board'','
                || E'\n' || '                               ''community/distributions'']';
BEGIN
  SELECT pg_get_functiondef(p.oid) INTO v_def
    FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
   WHERE n.nspname = 'public' AND p.proname = 'seed_family_permission_templates';

  IF v_def IS NULL THEN
    RAISE EXCEPTION 'seed_family_permission_templates() is missing — cannot restrict the new key';
  END IF;

  IF position(v_new IN v_def) > 0 THEN
    RAISE NOTICE 'distributions: seed already restricts community/distributions';
  ELSIF position(v_old IN v_def) = 0 THEN
    -- LOUD RATHER THAN SILENT, and this is the one assertion in the file that must not fail
    -- open. A no-op rewrite would leave every family created afterwards with the key at its
    -- 'everyone' default — and because this key gates a TABLE rather than a screen, that
    -- publishes every relative's address with a delivery state beside it.
    RAISE EXCEPTION
      'seed_family_permission_templates() no longer holds the v_restricted array this '
      'migration expects — it has been reformatted or extended. Re-read the function and '
      'update this replacement rather than widening the match.';
  ELSE
    EXECUTE replace(v_def, v_old, v_new);
    RAISE NOTICE 'distributions: seed now restricts community/distributions for new families';
  END IF;
END $mig$;

-- The lockdown's rule (§2b): this function is called only by the families trigger and by the
-- service role, so it is granted to nobody. Restated after a redefinition because
-- CREATE OR REPLACE keeps the ACL but a future refactor into DROP + CREATE would not.
REVOKE ALL ON FUNCTION public.seed_family_permission_templates(text) FROM PUBLIC, anon, authenticated;

-- ── §12. VERIFY ────────────────────────────────────────────────────────────────────────
DO $mig$
DECLARE
  v_n     int;
  v_bad   text;
  v_src   text;
  v_fam   text := 'ZZDIST01';
  v_fam2  text := 'ZZDIST02';
  v_p1    uuid;
  v_p2    uuid;
  v_d1    uuid;
  v_ok    boolean;
BEGIN
  -- 1. No write policy on either table; one SELECT policy each, evaluating the right key.
  FOR v_bad IN SELECT unnest(ARRAY['distributions', 'distribution_recipients']) LOOP
    SELECT count(*) INTO v_n FROM pg_policies
     WHERE schemaname = 'public' AND tablename = v_bad AND cmd <> 'SELECT';
    IF v_n > 0 THEN
      RAISE EXCEPTION '% has % write policy/policies — the actions are the boundary', v_bad, v_n;
    END IF;
    IF NOT EXISTS (
      SELECT 1 FROM pg_policies
       WHERE schemaname = 'public' AND tablename = v_bad AND cmd = 'SELECT'
         AND COALESCE(qual, '') LIKE '%auth_permission(''community/distributions''%'
    ) THEN
      RAISE EXCEPTION '%''s SELECT policy does not evaluate community/distributions', v_bad;
    END IF;
    IF NOT EXISTS (
      SELECT 1 FROM pg_policies
       WHERE schemaname = 'public' AND tablename = v_bad AND cmd = 'SELECT'
         AND COALESCE(qual, '') LIKE '%auth_membership_approved%'
    ) THEN
      RAISE EXCEPTION '%''s SELECT policy does not test membership approval', v_bad;
    END IF;
  END LOOP;

  -- `OR true` is never intentional and 20260822000013 found five of them. Cheap to re-assert
  -- on a file that writes two new policies.
  SELECT string_agg(tablename || '.' || policyname, ', ') INTO v_bad FROM pg_policies
   WHERE schemaname = 'public'
     AND tablename IN ('distributions', 'distribution_recipients')
     AND (COALESCE(qual, '') || COALESCE(with_check, '')) LIKE '%OR true%';
  IF v_bad IS NOT NULL THEN
    RAISE EXCEPTION 'a distributions policy contains OR true: %', v_bad;
  END IF;

  -- 2. The claim function is reachable by nobody in the browser (§2b rule 1), and still
  --    carries its concurrency clause. The second half is TEXTUAL because it cannot be
  --    observed from one session — stated rather than left to be assumed away later.
  IF has_function_privilege('authenticated',
       'public.claim_distribution_recipients(uuid, text, int)', 'EXECUTE') THEN
    RAISE EXCEPTION 'claim_distribution_recipients is executable by authenticated';
  END IF;
  IF has_function_privilege('anon',
       'public.claim_distribution_recipients(uuid, text, int)', 'EXECUTE') THEN
    RAISE EXCEPTION 'claim_distribution_recipients is executable by anon';
  END IF;
  SELECT p.prosrc INTO v_src FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
   WHERE n.nspname = 'public' AND p.proname = 'claim_distribution_recipients';
  IF v_src IS NULL OR v_src NOT LIKE '%FOR UPDATE SKIP LOCKED%' THEN
    RAISE EXCEPTION 'claim_distribution_recipients has lost FOR UPDATE SKIP LOCKED — two '
      'concurrent senders can now mail one relative twice';
  END IF;

  -- 3. The resource is registered, restricted, and grantable.
  IF NOT EXISTS (SELECT 1 FROM public.permission_resources
                  WHERE key = 'community/distributions' AND category = 'community') THEN
    RAISE EXCEPTION 'community/distributions is not registered in the community category';
  END IF;
  SELECT string_agg(key, ', ') INTO v_bad
    FROM (SELECT key FROM public.permission_resources
           WHERE category = 'community' AND sort_order = 65) s;
  IF v_bad IS DISTINCT FROM 'community/distributions' THEN
    RAISE EXCEPTION 'sort_order 65 in the community category is held by: %', v_bad;
  END IF;
  IF EXISTS (SELECT 1 FROM public.people WHERE family_code IS NOT NULL AND family_code <> '')
     AND NOT EXISTS (SELECT 1 FROM public.resource_visibility
                      WHERE resource_key = 'community/distributions'
                        AND visibility = 'restricted') THEN
    RAISE EXCEPTION 'community/distributions has no restricted visibility row — a key that '
      'gates a table would publish every relative''s address';
  END IF;
  IF EXISTS (SELECT 1 FROM public.permission_templates WHERE is_system AND name = 'Administrators')
     AND NOT EXISTS (
       SELECT 1 FROM public.template_permissions tp
         JOIN public.permission_templates t ON t.id = tp.template_id
        WHERE t.is_system AND t.name = 'Administrators'
          AND tp.resource_key = 'community/distributions' AND tp.action = 'view'
          AND tp.scope = 'any') THEN
    RAISE EXCEPTION 'community/distributions is restricted and no system template grants it';
  END IF;

  -- 3b. The map row exists and its own_expr matches what the policies were written with. Two
  --     expressions of one predicate, so the check is that they still agree.
  SELECT own_expr INTO v_bad FROM public.permission_table_map WHERE table_name = 'distributions';
  IF v_bad IS DISTINCT FROM 'sent_by = public.auth_person_id()' THEN
    RAISE EXCEPTION 'distributions'' map own_expr disagrees with its policy: %', v_bad;
  END IF;

  -- 4. The guards and the index, exercised. Unwound by a sentinel, because a probe here writes
  --    real rows and there is no correct way to leave them behind.
  BEGIN
    INSERT INTO public.families (family_code, family_name) VALUES (v_fam,  'dist probe 1');
    INSERT INTO public.families (family_code, family_name) VALUES (v_fam2, 'dist probe 2');
    INSERT INTO public.people (family_code, first_name, last_name, primary_email)
      VALUES (v_fam, 'Probe', 'One', 'zzdist1@example.invalid') RETURNING id INTO v_p1;
    INSERT INTO public.people (family_code, first_name, last_name, primary_email)
      VALUES (v_fam2, 'Probe', 'Two', 'zzdist2@example.invalid') RETURNING id INTO v_p2;

    -- 4a. A sender from another family.
    v_ok := false;
    BEGIN
      INSERT INTO public.distributions (family_code, subject, body, sent_by)
        VALUES (v_fam, 'probe', 'probe', v_p2);
    EXCEPTION WHEN check_violation THEN v_ok := true;
    END;
    IF NOT v_ok THEN RAISE EXCEPTION 'distributions accepted a cross-family sender'; END IF;

    -- 4b. The positive control, which everything below depends on.
    INSERT INTO public.distributions (family_code, subject, body, sent_by)
      VALUES (v_fam, 'probe', 'probe body', v_p1) RETURNING id INTO v_d1;

    -- 4c. A recipient from another family.
    v_ok := false;
    BEGIN
      INSERT INTO public.distribution_recipients
        (family_code, distribution_id, person_id, email)
        VALUES (v_fam, v_d1, v_p2, 'x@example.invalid');
    EXCEPTION WHEN check_violation THEN v_ok := true;
    END;
    IF NOT v_ok THEN
      RAISE EXCEPTION 'distribution_recipients accepted a recipient from another family';
    END IF;

    INSERT INTO public.distribution_recipients
      (family_code, distribution_id, person_id, email)
      VALUES (v_fam, v_d1, v_p1, 'Shared@Example.invalid');

    -- 4d. TWO LIVE ROWS FOR ONE ADDRESS ARE REFUSED, case-insensitively. The `/pricing` claim.
    --     A second person is needed, since `one_per_person` would otherwise be what refuses it
    --     and the assertion would pass for the wrong reason.
    DECLARE v_p3 uuid;
    BEGIN
      INSERT INTO public.people (family_code, first_name, last_name, primary_email)
        VALUES (v_fam, 'Probe', 'Three', 'zzdist3@example.invalid') RETURNING id INTO v_p3;
      v_ok := false;
      BEGIN
        INSERT INTO public.distribution_recipients
          (family_code, distribution_id, person_id, email)
          VALUES (v_fam, v_d1, v_p3, 'SHARED@example.invalid');
      EXCEPTION WHEN unique_violation THEN v_ok := true;
      END;
      IF NOT v_ok THEN
        RAISE EXCEPTION 'distribution_recipients accepted two live rows for one address';
      END IF;

      -- 4e. AND THE SAME ADDRESS AS A `duplicate` IS ACCEPTED. The other half, without which
      --     the index would be silently unconditional and both relatives sharing a mailbox
      --     could not both be recorded.
      INSERT INTO public.distribution_recipients
        (family_code, distribution_id, person_id, email, state)
        VALUES (v_fam, v_d1, v_p3, 'SHARED@example.invalid', 'duplicate');
    EXCEPTION WHEN unique_violation THEN
      RAISE EXCEPTION 'distribution_recipients refused a duplicate row for a shared mailbox';
    END;

    -- 4f. The claim function claims, and refuses the wrong family.
    IF (SELECT count(*) FROM public.claim_distribution_recipients(v_d1, v_fam, 10)) <> 1 THEN
      RAISE EXCEPTION 'claim_distribution_recipients did not claim the one pending recipient';
    END IF;
    IF (SELECT count(*) FROM public.claim_distribution_recipients(v_d1, v_fam, 10)) <> 0 THEN
      RAISE EXCEPTION 'claim_distribution_recipients re-claimed a row it had already claimed';
    END IF;
    v_ok := false;
    BEGIN
      PERFORM count(*) FROM public.claim_distribution_recipients(v_d1, v_fam2, 10);
    EXCEPTION WHEN insufficient_privilege THEN v_ok := true;
    END;
    IF NOT v_ok THEN
      RAISE EXCEPTION 'claim_distribution_recipients served a distribution from another family';
    END IF;

    -- 4g. An area scope with no area named is refused.
    v_ok := false;
    BEGIN
      INSERT INTO public.distributions (family_code, subject, body, scope)
        VALUES (v_fam, 'probe', 'probe', 'region');
    EXCEPTION WHEN check_violation THEN v_ok := true;
    END;
    IF NOT v_ok THEN
      RAISE EXCEPTION 'distributions accepted a region scope naming no region';
    END IF;

    RAISE EXCEPTION 'unwind-distribution-probe';
  EXCEPTION WHEN raise_exception THEN
    IF SQLERRM <> 'unwind-distribution-probe' THEN RAISE; END IF;
  END;

  RAISE NOTICE 'distributions: two tables, no write policy, guards and dedupe exercised';
END $mig$;

COMMIT;
