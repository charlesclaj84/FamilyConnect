-- ============================================================================
-- Meeting Minutes: a session, its attendees, its topics, and a vote per topic.
--
-- ── IT TAKES THE MEETING HALF OF THE OFFICER'S JOURNAL AND DROPS IT ─────────
-- 20260822000001 made a journal entry a rolling TOPIC and gave it a `kind` of 'note' or
-- 'meeting', with `met_on` and `position_journal_attendees` beside it. One day of use is
-- enough to say that was the wrong home. A meeting is not a topic in one office's notebook:
--
--   * it belongs to the FAMILY, not to an office. Everybody who was in the room is in it, and
--     the record is one the family keeps — whereas a journal is deliberately readable only by
--     whoever holds that office, and must stay that way (20260821000005 argues it at length).
--   * it has a SECRETARY, which is a job for one named person for one meeting. The journal has
--     no such role and could not express one: its write rule is "any holder of the office".
--   * it has VOTES, which nothing in a journal has anywhere to put.
--
-- So the columns are dropped and the table with them. **No data is migrated**, and that is
-- admissible on the ground AGENTS.md already states: no family is using this product yet. If
-- that stops being true, this file becomes a backfill and not a DROP.
--
-- ── FIVE TABLES, AND THE WRITE BOUNDARY IS THE ACTIONS AND THE TRIGGERS ─────
-- Each table has exactly ONE policy, `perm:<table>:select`, and no INSERT, UPDATE or DELETE
-- policy at all — which per AGENTS.md §2c denies those to the browser outright. Every write
-- goes through `createAdminClient()` in a server action that re-applies family scoping by
-- hand (§3), and five guard triggers refuse a cross-family id underneath it, because the
-- service role ignores RLS and does not ignore triggers (§4). That is the arrangement the six
-- Gatherings tables use and it is the right one here for the same reason: the rules that
-- decide these writes — "the secretary of THIS session", "an attendee of THIS session" — are
-- not things a permission key can say.
--
-- ── WHO MAY READ: THE FAMILY. WHO MAY WRITE: THE SESSION SAYS ───────────────
-- The SELECT policies test family and approval and nothing else. Minutes are the family's
-- record of its own decisions, so a member who was not in the room still reads what was
-- decided — which is the opposite of the journal's rule and is deliberate. `journals/meeting-minutes:view`
-- gates the SCREEN, so a family can switch the feature off; it decides no row, has no
-- `permission_table_map` entry, and 20260822000018 §9f asserts that absence.
--
--   schedule a meeting     `journals/meeting-minutes:create`     the action
--   change or close one    `:edit`, or be its secretary          the action
--   delete one             `:delete`                             the action
--   write the minutes      BE THE SECRETARY of that session      the action
--   vote                   BE AN ATTENDEE of that session        the action
--
-- ── A VOTE CANNOT BE CHANGED BY ANYBODY, AND THAT IS A TRIGGER ──────────────
-- `meeting_votes_are_final` refuses UPDATE and DELETE on that table for every role, the
-- service role included. This is the one rule in the feature that is not enforced by "the
-- action decides", and it is the one that has to be: a ballot somebody can quietly restate
-- afterwards is not a record of what the room decided. The only way a vote row goes is with
-- the topic it belongs to (ON DELETE CASCADE), which is deleting the whole question rather
-- than editing an answer — and the trigger tells those apart with `pg_trigger_depth()`,
-- measured rather than assumed. See the function.
--
-- IT IS A `BEFORE` TRIGGER AND NOT A RULE OR A GRANT, because a grant can be re-granted from
-- outside the migration chain (§2b's whole argument) and this must hold against the service
-- role, which no grant does.
--
-- ── A MEETING IS A DATE. NO TIME OF DAY, NO TIMEZONE ────────────────────────
-- `meets_on DATE`, exactly as `gatherings.starts_on` and `elections.nominations_open_on` are.
-- Nothing in this schema records a family timezone, so a `TIME` here would be a time in no
-- particular zone — the same two-facts-that-disagree trap as a stored `is_minor`.
--
-- ── CHECKED BY MUTATION, per AGENTS.md §7 ──────────────────────────────────
--   the immutability trigger not created
--     ERROR: meeting_votes accepted an UPDATE
--   the trigger created BEFORE UPDATE only
--     ERROR: meeting_votes accepted a DELETE
--   the `pg_trigger_depth()` test inverted (`>= 1`)
--     ERROR: a meeting vote cannot be withdrawn, raised from inside
--     `DELETE FROM public.meeting_topics` — the cascade being refused, which is the failure
--     the first draft of this file actually shipped. Note the message is the TRIGGER's and not
--     the assertion's: the DELETE raises before the row count can be looked at, so the case
--     that catches this is the topic delete succeeding at all.
--   any guard trigger not created
--     ERROR: meeting_<x> accepted a cross-family reference
--   a write policy added to any of the five
--     ERROR: meeting_<x> has N write policy/policies — the actions are the boundary
--
-- HOW THIS REACHES A DATABASE
--   `supabase db push`, from CI on merge to master — never `psql -f` by hand. See AGENTS.md,
--   "How migrations reach the hosted project".
-- ============================================================================

BEGIN;

-- ── A. The session ──────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.meeting_sessions (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  family_code  text NOT NULL,
  title        text NOT NULL,
  meets_on     date NOT NULL,
  -- THE ONE PERSON WHO MAY WRITE THE MINUTES. NOT NULL: a meeting with no secretary is a
  -- meeting nobody can record, and choosing one is part of scheduling it. ON DELETE RESTRICT
  -- would strand a family that removes a person, so it is SET NULL — and every write path
  -- treats a null secretary as "nobody may write", which fails closed.
  secretary_id uuid REFERENCES public.people(id) ON DELETE SET NULL,
  created_by   uuid REFERENCES public.people(id) ON DELETE SET NULL,
  -- CLOSED IS WHAT MAKES MINUTES A RECORD. Until then the secretary is still writing and
  -- votes are still being cast; after it nothing about the session changes again.
  closed_at    timestamptz,
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT meeting_sessions_title_not_blank CHECK (btrim(title) <> '')
);

CREATE INDEX IF NOT EXISTS meeting_sessions_family_date_idx
  ON public.meeting_sessions (family_code, meets_on DESC);
CREATE INDEX IF NOT EXISTS meeting_sessions_secretary_fk_idx
  ON public.meeting_sessions (secretary_id);
CREATE INDEX IF NOT EXISTS meeting_sessions_created_by_fk_idx
  ON public.meeting_sessions (created_by);

COMMENT ON TABLE public.meeting_sessions IS
  'One meeting of the family: a title, a date, a secretary and an attendee list. Readable by '
  'every approved member — minutes are the family''s record. Written only through '
  'app/actions/meetings.ts.';

-- ── B. Who was in the room ──────────────────────────────────────────────────
-- The attendee list is what decides who may VOTE, so it is a real table and not a text field.
CREATE TABLE IF NOT EXISTS public.meeting_attendees (
  session_id  uuid NOT NULL REFERENCES public.meeting_sessions(id) ON DELETE CASCADE,
  person_id   uuid NOT NULL REFERENCES public.people(id) ON DELETE CASCADE,
  family_code text NOT NULL,
  PRIMARY KEY (session_id, person_id)
);

CREATE INDEX IF NOT EXISTS meeting_attendees_person_idx
  ON public.meeting_attendees (person_id);

-- ── C. What was discussed ───────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.meeting_topics (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  family_code text NOT NULL,
  session_id  uuid NOT NULL REFERENCES public.meeting_sessions(id) ON DELETE CASCADE,
  title       text NOT NULL,
  -- The order the room took them in. Stated rather than derived from `created_at`, because a
  -- secretary writing up afterwards enters them in whatever order they find their notes.
  sort_order  int  NOT NULL DEFAULT 0,
  created_by  uuid REFERENCES public.people(id) ON DELETE SET NULL,
  -- ── THE VOTE, AS TWO TIMESTAMPS AND NOT A BOOLEAN ────────────────────────
  -- A topic has no vote until one is CALLED, and a called vote closes. Two nullable instants
  -- say which of the three states it is in and when each happened, where a boolean would say
  -- only the middle one and lose the record of a vote having been taken at all.
  voting_opened_at timestamptz,
  voting_closed_at timestamptz,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT meeting_topics_title_not_blank CHECK (btrim(title) <> ''),
  -- A vote cannot close before it opened, and cannot close without having opened.
  CONSTRAINT meeting_topics_voting_ordered CHECK (
    voting_closed_at IS NULL
    OR (voting_opened_at IS NOT NULL AND voting_closed_at >= voting_opened_at)
  )
);

CREATE INDEX IF NOT EXISTS meeting_topics_session_idx
  ON public.meeting_topics (session_id, sort_order, created_at);
CREATE INDEX IF NOT EXISTS meeting_topics_created_by_fk_idx
  ON public.meeting_topics (created_by);

-- ── D. The minutes themselves ───────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.meeting_topic_notes (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  family_code text NOT NULL,
  topic_id    uuid NOT NULL REFERENCES public.meeting_topics(id) ON DELETE CASCADE,
  body        text NOT NULL,
  -- THE SECRETARY, always, because they are the only person who may write one. Kept as a
  -- column anyway rather than derived from the session: a family may change its secretary
  -- mid-session, and the record of who wrote a note must not move when they do.
  author_id   uuid REFERENCES public.people(id) ON DELETE SET NULL,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT meeting_topic_notes_body_not_blank CHECK (btrim(body) <> '')
);

CREATE INDEX IF NOT EXISTS meeting_topic_notes_topic_idx
  ON public.meeting_topic_notes (topic_id, created_at);
CREATE INDEX IF NOT EXISTS meeting_topic_notes_author_fk_idx
  ON public.meeting_topic_notes (author_id);

-- ── E. The ballot ───────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.meeting_votes (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  family_code text NOT NULL,
  topic_id    uuid NOT NULL REFERENCES public.meeting_topics(id) ON DELETE CASCADE,
  -- ON DELETE CASCADE and NOT NULL: a vote with no voter is not a vote, and there is no
  -- anonymous ballot here. A meeting vote is on the record by definition — who voted which
  -- way is the thing minutes exist to state.
  voter_id    uuid NOT NULL REFERENCES public.people(id) ON DELETE CASCADE,
  choice      text NOT NULL,
  cast_at     timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT meeting_votes_choice_known CHECK (choice IN ('for', 'against', 'abstain')),
  CONSTRAINT meeting_votes_one_per_voter UNIQUE (topic_id, voter_id)
);

CREATE INDEX IF NOT EXISTS meeting_votes_voter_idx ON public.meeting_votes (voter_id);

COMMENT ON TABLE public.meeting_votes IS
  'One attendee''s vote on one topic. APPEND-ONLY: meeting_votes_are_final refuses UPDATE and '
  'DELETE for every role including service_role. A vote goes only with the topic it belongs '
  'to, which is deleting the question rather than editing the answer.';

-- ── F. RLS: read for the family, and NO write policy at all (§2c) ───────────
ALTER TABLE public.meeting_sessions    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.meeting_attendees   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.meeting_topics      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.meeting_topic_notes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.meeting_votes       ENABLE ROW LEVEL SECURITY;

DO $mig$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['meeting_sessions', 'meeting_attendees', 'meeting_topics',
                           'meeting_topic_notes', 'meeting_votes']
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', 'perm:' || t || ':select', t);
    EXECUTE format($p$
      CREATE POLICY %I ON public.%I FOR SELECT TO authenticated
        USING (family_code = public.auth_family_code()
               AND public.auth_membership_approved())
    $p$, 'perm:' || t || ':select', t);
  END LOOP;
END $mig$;

-- A GRANT STATEMENT AS A STATEMENT OF INTENT, not as what makes this safe. §2c: Supabase's
-- default ACL on `public` already hands both browser roles everything, so this records nothing
-- the tables did not hold. What denies the writes is the ABSENCE of a policy for them.
GRANT SELECT ON public.meeting_sessions, public.meeting_attendees, public.meeting_topics,
                public.meeting_topic_notes, public.meeting_votes
   TO authenticated;

-- ── G. The guard triggers (§4) ──────────────────────────────────────────────
-- RLS is a predicate over the row being written and has no opinion about the ids the row
-- CARRIES. Every one of these writes happens on the admin client, so there is no policy
-- underneath them at all — these are the whole of what stops one family's meeting naming
-- another family's person.
CREATE OR REPLACE FUNCTION public.tg_meeting_same_family()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_other text;
BEGIN
  -- ONE FUNCTION FOR FIVE TABLES, dispatching on TG_TABLE_NAME. Written this way rather than
  -- as five near-identical bodies because the CHECK is identical in every case — resolve the
  -- referenced row's family and compare — and five copies is five chances for the next table
  -- to get a conjunct that the others have.
  IF TG_TABLE_NAME = 'meeting_sessions' THEN
    IF NEW.secretary_id IS NOT NULL THEN
      SELECT p.family_code INTO v_other FROM public.people p WHERE p.id = NEW.secretary_id;
      IF v_other IS DISTINCT FROM NEW.family_code THEN
        RAISE EXCEPTION 'meeting_sessions: secretary % is not in family %',
          NEW.secretary_id, NEW.family_code USING ERRCODE = '23514';
      END IF;
    END IF;
    IF NEW.created_by IS NOT NULL THEN
      SELECT p.family_code INTO v_other FROM public.people p WHERE p.id = NEW.created_by;
      IF v_other IS DISTINCT FROM NEW.family_code THEN
        RAISE EXCEPTION 'meeting_sessions: created_by % is not in family %',
          NEW.created_by, NEW.family_code USING ERRCODE = '23514';
      END IF;
    END IF;
    RETURN NEW;
  END IF;

  IF TG_TABLE_NAME = 'meeting_attendees' THEN
    SELECT s.family_code INTO v_other
      FROM public.meeting_sessions s WHERE s.id = NEW.session_id;
    IF v_other IS DISTINCT FROM NEW.family_code THEN
      RAISE EXCEPTION 'meeting_attendees: session % is not in family %',
        NEW.session_id, NEW.family_code USING ERRCODE = '23514';
    END IF;
    SELECT p.family_code INTO v_other FROM public.people p WHERE p.id = NEW.person_id;
    IF v_other IS DISTINCT FROM NEW.family_code THEN
      RAISE EXCEPTION 'meeting_attendees: person % is not in family %',
        NEW.person_id, NEW.family_code USING ERRCODE = '23514';
    END IF;
    RETURN NEW;
  END IF;

  IF TG_TABLE_NAME = 'meeting_topics' THEN
    SELECT s.family_code INTO v_other
      FROM public.meeting_sessions s WHERE s.id = NEW.session_id;
    IF v_other IS DISTINCT FROM NEW.family_code THEN
      RAISE EXCEPTION 'meeting_topics: session % is not in family %',
        NEW.session_id, NEW.family_code USING ERRCODE = '23514';
    END IF;
    IF NEW.created_by IS NOT NULL THEN
      SELECT p.family_code INTO v_other FROM public.people p WHERE p.id = NEW.created_by;
      IF v_other IS DISTINCT FROM NEW.family_code THEN
        RAISE EXCEPTION 'meeting_topics: created_by % is not in family %',
          NEW.created_by, NEW.family_code USING ERRCODE = '23514';
      END IF;
    END IF;
    RETURN NEW;
  END IF;

  IF TG_TABLE_NAME = 'meeting_topic_notes' THEN
    SELECT t.family_code INTO v_other
      FROM public.meeting_topics t WHERE t.id = NEW.topic_id;
    IF v_other IS DISTINCT FROM NEW.family_code THEN
      RAISE EXCEPTION 'meeting_topic_notes: topic % is not in family %',
        NEW.topic_id, NEW.family_code USING ERRCODE = '23514';
    END IF;
    IF NEW.author_id IS NOT NULL THEN
      SELECT p.family_code INTO v_other FROM public.people p WHERE p.id = NEW.author_id;
      IF v_other IS DISTINCT FROM NEW.family_code THEN
        RAISE EXCEPTION 'meeting_topic_notes: author % is not in family %',
          NEW.author_id, NEW.family_code USING ERRCODE = '23514';
      END IF;
    END IF;
    RETURN NEW;
  END IF;

  IF TG_TABLE_NAME = 'meeting_votes' THEN
    SELECT t.family_code INTO v_other
      FROM public.meeting_topics t WHERE t.id = NEW.topic_id;
    IF v_other IS DISTINCT FROM NEW.family_code THEN
      RAISE EXCEPTION 'meeting_votes: topic % is not in family %',
        NEW.topic_id, NEW.family_code USING ERRCODE = '23514';
    END IF;
    SELECT p.family_code INTO v_other FROM public.people p WHERE p.id = NEW.voter_id;
    IF v_other IS DISTINCT FROM NEW.family_code THEN
      RAISE EXCEPTION 'meeting_votes: voter % is not in family %',
        NEW.voter_id, NEW.family_code USING ERRCODE = '23514';
    END IF;
    RETURN NEW;
  END IF;

  -- A table added to this trigger and not to this body would otherwise be written unchecked,
  -- which is the failure this branch exists to make loud.
  RAISE EXCEPTION 'tg_meeting_same_family has no case for %', TG_TABLE_NAME
    USING ERRCODE = '23514';
END $$;

DO $mig$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['meeting_sessions', 'meeting_attendees', 'meeting_topics',
                           'meeting_topic_notes', 'meeting_votes']
  LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS %I ON public.%I', t || '_same_family', t);
    EXECUTE format(
      'CREATE TRIGGER %I BEFORE INSERT OR UPDATE ON public.%I '
      || 'FOR EACH ROW EXECUTE FUNCTION public.tg_meeting_same_family()',
      t || '_same_family', t);
  END LOOP;
END $mig$;

-- `set_updated_at` already exists (20260821000005 and others use it).
DROP TRIGGER IF EXISTS meeting_sessions_updated_at ON public.meeting_sessions;
CREATE TRIGGER meeting_sessions_updated_at BEFORE UPDATE ON public.meeting_sessions
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
DROP TRIGGER IF EXISTS meeting_topics_updated_at ON public.meeting_topics;
CREATE TRIGGER meeting_topics_updated_at BEFORE UPDATE ON public.meeting_topics
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
DROP TRIGGER IF EXISTS meeting_topic_notes_updated_at ON public.meeting_topic_notes;
CREATE TRIGGER meeting_topic_notes_updated_at BEFORE UPDATE ON public.meeting_topic_notes
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ── H. A vote is final ──────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.tg_meeting_vote_is_final()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  -- AN UPDATE IS ALWAYS REFUSED. There is no restating a vote.
  IF TG_OP = 'UPDATE' THEN
    RAISE EXCEPTION
      'a meeting vote cannot be changed — delete the topic to withdraw the question'
      USING ERRCODE = '23514';
  END IF;

  -- ── A DELETE IS REFUSED UNLESS IT IS THE TOPIC TAKING IT ────────────
  -- `pg_trigger_depth()` is 1 for a statement somebody issued and 2 inside the referential
  -- action of `meeting_topics ... ON DELETE CASCADE`, because a foreign key's cascade IS a
  -- trigger and is already on the stack when this one fires. MEASURED rather than assumed
  -- (2026-08-22, against this database): a direct `DELETE FROM meeting_votes` reports depth 1
  -- and a `DELETE FROM meeting_topics` reports depth 2 in this same function.
  --
  -- That is what lets "a vote goes only with the question" be enforced rather than merely
  -- stated. The alternative was `storage.protect_delete()`'s device — a `SET LOCAL` escape
  -- hatch the caller opts into — and it is worse here: an escape hatch is a thing any future
  -- action can set, whereas the depth test can only be satisfied by an actual cascade.
  --
  -- The one other way to reach depth 2 is a trigger of ours that deletes a vote, and there is
  -- none. If one is ever added, it inherits this exemption silently, so this is the line to
  -- re-read before writing one.
  IF pg_trigger_depth() <= 1 THEN
    RAISE EXCEPTION
      'a meeting vote cannot be withdrawn — delete the topic to withdraw the question'
      USING ERRCODE = '23514';
  END IF;

  RETURN OLD;
END $$;

DROP TRIGGER IF EXISTS meeting_votes_are_final ON public.meeting_votes;
CREATE TRIGGER meeting_votes_are_final
  BEFORE UPDATE OR DELETE ON public.meeting_votes
  FOR EACH ROW EXECUTE FUNCTION public.tg_meeting_vote_is_final();

-- ── I. The journal gives up its meeting half ────────────────────────────────
-- A DROP COLUMN INVERTS THE DEPLOYMENT ARGUMENT in "How migrations reach the hosted project":
-- the old code runs against the new schema for one alias window, asks for a column that is
-- gone, and PostgREST answers 42703 by killing the whole query. It costs an empty Officer
-- journal for one deploy, and it is admissible on the same ground as 20260822000001's own
-- `body` drop: no family is using this product yet. If that stops being true, the shape is two
-- deploys.
DROP TABLE IF EXISTS public.position_journal_attendees;

ALTER TABLE public.position_journal_entries
  DROP CONSTRAINT IF EXISTS position_journal_entries_met_on_matches_kind;
ALTER TABLE public.position_journal_entries DROP COLUMN IF EXISTS kind;
ALTER TABLE public.position_journal_entries DROP COLUMN IF EXISTS met_on;

-- `auth_authored_journal_entry` was written for the attendee policies and has no other caller
-- — the entry UPDATE and DELETE policies test `author_id = auth_person_id()` directly. Dropped
-- rather than left: a SECURITY DEFINER function in `public` is a reachable endpoint (§2b), and
-- one nothing calls is one nobody re-reads.
DROP FUNCTION IF EXISTS public.auth_authored_journal_entry(uuid);

COMMENT ON TABLE public.position_journal_entries IS
  'A rolling topic in one office''s notebook: a title, and a thread of notes under it. '
  'Readable only by whoever holds the office. The MEETING half moved to meeting_sessions on '
  '2026-08-22 — a meeting belongs to the family and has a secretary and votes, none of which '
  'an office''s notebook can express.';

-- ── J. Verify ───────────────────────────────────────────────────────────────
DO $mig$
DECLARE
  v_n      int;
  v_bad    text;
  v_fam    text := 'ZZMEET01';
  v_fam2   text := 'ZZMEET02';
  v_p1     uuid;
  v_p2     uuid;
  v_s      uuid;
  v_t      uuid;
  v_ok     boolean;
BEGIN
  -- J1. Five tables, one SELECT policy each, and no write policy anywhere.
  SELECT string_agg(format('%s:%s', tablename, cnt), ', ') INTO v_bad FROM (
    SELECT tablename, count(*) AS cnt FROM pg_policies
     WHERE schemaname = 'public'
       AND tablename IN ('meeting_sessions', 'meeting_attendees', 'meeting_topics',
                         'meeting_topic_notes', 'meeting_votes')
       AND cmd <> 'SELECT'
     GROUP BY tablename) x;
  IF v_bad IS NOT NULL THEN
    RAISE EXCEPTION 'meeting tables have write policy/policies (%) — the actions are the boundary', v_bad;
  END IF;

  SELECT count(*) INTO v_n FROM pg_policies
   WHERE schemaname = 'public' AND cmd = 'SELECT'
     AND tablename IN ('meeting_sessions', 'meeting_attendees', 'meeting_topics',
                       'meeting_topic_notes', 'meeting_votes');
  IF v_n <> 5 THEN
    RAISE EXCEPTION 'expected 5 meeting SELECT policies, found %', v_n;
  END IF;

  -- J1b. NO POLICY CONSULTS `auth_permission`, in both directions. The key gates the screen;
  -- widening a policy to consult it would make `view`'s 'everyone' default the row rule.
  SELECT string_agg(policyname, ', ') INTO v_bad FROM pg_policies
   WHERE schemaname = 'public'
     AND tablename LIKE 'meeting\_%'
     AND (COALESCE(qual, '') || COALESCE(with_check, '')) LIKE '%auth_permission%';
  IF v_bad IS NOT NULL THEN
    RAISE EXCEPTION 'a meeting policy evaluates auth_permission: %', v_bad;
  END IF;

  -- J2. The journal has given the meeting half up.
  IF EXISTS (SELECT 1 FROM information_schema.columns
              WHERE table_schema = 'public' AND table_name = 'position_journal_entries'
                AND column_name IN ('kind', 'met_on')) THEN
    RAISE EXCEPTION 'position_journal_entries still carries the meeting columns';
  END IF;
  IF to_regclass('public.position_journal_attendees') IS NOT NULL THEN
    RAISE EXCEPTION 'position_journal_attendees still exists';
  END IF;

  -- J3. THE TRIGGERS, EXERCISED FOR REAL. A trigger that exists is not a trigger that fires,
  -- and `pg_trigger` cannot tell you which. Unwound by a sentinel, so nothing is left behind.
  BEGIN
    INSERT INTO public.families (family_code, family_name) VALUES (v_fam,  'meeting probe 1');
    INSERT INTO public.families (family_code, family_name) VALUES (v_fam2, 'meeting probe 2');
    INSERT INTO public.people (family_code, first_name, last_name, primary_email)
      VALUES (v_fam,  'Probe', 'One', 'zzmeet1@example.invalid') RETURNING id INTO v_p1;
    INSERT INTO public.people (family_code, first_name, last_name, primary_email)
      VALUES (v_fam2, 'Probe', 'Two', 'zzmeet2@example.invalid') RETURNING id INTO v_p2;

    -- A session naming the OTHER family's person as secretary.
    v_ok := false;
    BEGIN
      INSERT INTO public.meeting_sessions (family_code, title, meets_on, secretary_id)
        VALUES (v_fam, 'probe', DATE '2027-01-01', v_p2);
    EXCEPTION WHEN check_violation THEN v_ok := true;
    END;
    IF NOT v_ok THEN RAISE EXCEPTION 'meeting_sessions accepted a cross-family secretary'; END IF;

    -- The ordinary write works — the positive control, without which the line above proves
    -- only that the trigger refuses everything.
    INSERT INTO public.meeting_sessions (family_code, title, meets_on, secretary_id)
      VALUES (v_fam, 'probe', DATE '2027-01-01', v_p1) RETURNING id INTO v_s;

    v_ok := false;
    BEGIN
      INSERT INTO public.meeting_attendees (session_id, person_id, family_code)
        VALUES (v_s, v_p2, v_fam);
    EXCEPTION WHEN check_violation THEN v_ok := true;
    END;
    IF NOT v_ok THEN RAISE EXCEPTION 'meeting_attendees accepted a cross-family person'; END IF;

    INSERT INTO public.meeting_topics (family_code, session_id, title)
      VALUES (v_fam, v_s, 'probe topic') RETURNING id INTO v_t;

    v_ok := false;
    BEGIN
      INSERT INTO public.meeting_votes (family_code, topic_id, voter_id, choice)
        VALUES (v_fam, v_t, v_p2, 'for');
    EXCEPTION WHEN check_violation THEN v_ok := true;
    END;
    IF NOT v_ok THEN RAISE EXCEPTION 'meeting_votes accepted a cross-family voter'; END IF;

    -- J4. A VOTE IS FINAL. Both halves, because a BEFORE UPDATE-only trigger passes the first.
    INSERT INTO public.meeting_votes (family_code, topic_id, voter_id, choice)
      VALUES (v_fam, v_t, v_p1, 'for');

    v_ok := false;
    BEGIN
      UPDATE public.meeting_votes SET choice = 'against' WHERE topic_id = v_t;
    EXCEPTION WHEN check_violation THEN v_ok := true;
    END;
    IF NOT v_ok THEN RAISE EXCEPTION 'meeting_votes accepted an UPDATE'; END IF;

    v_ok := false;
    BEGIN
      DELETE FROM public.meeting_votes WHERE topic_id = v_t;
    EXCEPTION WHEN check_violation THEN v_ok := true;
    END;
    IF NOT v_ok THEN RAISE EXCEPTION 'meeting_votes accepted a DELETE'; END IF;

    -- ...AND THE TOPIC STILL TAKES ITS VOTES WITH IT, which is the one way out and the half
    -- that a naive "refuse every DELETE" trigger breaks: the cascade is a DELETE too, so the
    -- first draft of this file made a topic undeletable the moment anybody had voted on it.
    -- Both directions are asserted because the fix is a `pg_trigger_depth()` test that could
    -- be got backwards, and backwards means every vote is deletable by hand.
    DELETE FROM public.meeting_topics WHERE id = v_t;
    IF EXISTS (SELECT 1 FROM public.meeting_votes WHERE topic_id = v_t) THEN
      RAISE EXCEPTION 'deleting a topic left its votes behind';
    END IF;

    RAISE EXCEPTION 'unwind-meeting-probe';
  EXCEPTION WHEN raise_exception THEN
    -- Compared BY MESSAGE: swallowing every raise_exception would hide a real assertion
    -- failure above as a pass.
    IF SQLERRM <> 'unwind-meeting-probe' THEN RAISE; END IF;
  END;

  RAISE NOTICE 'Meeting Minutes: five tables, read by the family, written by the actions; votes are final';
END $mig$;

COMMIT;
