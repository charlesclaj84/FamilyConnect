-- ============================================================================
-- An entry becomes a ROLLING TOPIC, and one kind of topic is a MEETING.
--
-- ── THE TWO SENTENCES THIS FILE IS BUILT ON ─────────────────────────────────
--
--     "An entry is a topic. Notes accumulate under it."
--     "A meeting is a topic with a list of who was in the room."
--
-- 20260821000005 gave every office a notebook whose page was one title and one body, editable
-- only by whoever wrote it. That is a filing cabinet, and an office's working knowledge is not
-- filed once: the treasurer's note on the bank reconciliation gets a paragraph added every
-- year, and the argument for why it is done that way is the thread rather than the last
-- version of it. So `body` moves off the entry onto rows of its own, and an entry keeps only
-- what identifies the topic.
--
-- ── WHY `body` IS DROPPED RATHER THAN KEPT AS "THE FIRST NOTE" ──────────────
-- Two columns describing one fact is how they come to disagree — the `is_minor` lesson
-- (AGENTS.md §4b) and the `is_step` one, and both were a stored value where a derivation or a
-- single home belonged. An entry carrying both a `body` and a thread of notes has two answers
-- to "what does this entry say", and every screen would have to decide which one wins. So the
-- existing bodies become the FIRST NOTE of their own thread (§3) and the column goes.
--
-- THAT IS NOT AN ADDITIVE MIGRATION, and AGENTS.md's deployment argument turns on additivity:
-- "the old code serves while migrations are applied — the safe direction, because a migration
-- this repo ships is additive and the running code does not use it yet". A DROP COLUMN inverts
-- that for one window. What it costs, stated rather than discovered:
--
--   * Between this file applying and Vercel aliasing the new build, the RUNNING code still
--     asks for `body`. PostgREST answers a missing column with 42703 and kills the WHOLE
--     query (the Phase 3 incident, AGENTS.md), and `getJournalEntries` discards its error —
--     so `/journal` renders an empty notebook for the length of one deploy window and
--     recovers by itself when the alias moves. No row is lost and no write is accepted.
--   * That is admissible here on one ground and it is a fact rather than an argument: NO
--     FAMILY IS USING THIS PRODUCT YET. The alternative is a dead column kept for a window
--     nobody is watching, which is the half-retirement AGENTS.md calls the expensive state.
--   * If that ever stops being true, the shape is two deploys: add the notes table and read
--     from both, then drop the column in a second migration once the code reading it is gone.
--
-- ── WHO MAY WRITE WHAT, WHICH IS THE WHOLE POINT OF THE SPLIT ───────────────
-- 20260821000005's rule was "any holder may read and add; only the author may edit or delete".
-- Splitting notes off makes that rule say something it could not say before, and this is the
-- feature rather than a side effect:
--
--   * ANY HOLDER MAY ADD A NOTE TO ANY TOPIC. Two officers holding one office have a
--     conversation on the page, and a successor answers a predecessor underneath what they
--     wrote instead of beside it.
--   * EACH NOTE IS EDITABLE AND DELETABLE BY ITS OWN AUTHOR, and by nobody else — the
--     `author_id = auth_person_id()` conjunct moves down onto the note. So "when editing you
--     can edit any of the entries" means any note of YOURS, at any position in the thread, and
--     not only the last one; somebody else's paragraph is still theirs.
--   * THE TOPIC'S TITLE stays the entry author's, which is 20260821000005's rule unchanged.
--
-- ── ATTENDANCE IS THE ENTRY AUTHOR'S, AND THAT IS DELIBERATELY NOT THE NOTE RULE ──
-- `position_journal_attendees` is written and cleared by whoever RECORDED the meeting, not by
-- every holder. A note is somebody's own words and carries their byline; the attendee list has
-- no byline — it is one assertion about one room, so two officers editing it would be
-- overwriting each other with no trace of who said what. An officer who was there and was
-- left off adds a NOTE saying so, which is the same answer `reopenGatheringTask` gives ("a
-- denial is never an edit of the refused submission") and the same one this feature already
-- gives a successor who disagrees with a predecessor.
--
-- ── VOTING ON TASKS: NOTHING IN THIS FILE, DELIBERATELY ─────────────────────
-- The ask was for a PLACEHOLDER for voting on tasks in a meeting entry, and a placeholder is
-- a sentence on a screen. It gets no column and no table here. AGENTS.md is emphatic in both
-- directions about the alternative — a switch nothing reads "reads as a control being
-- honoured", and `dues_member_plans.start_date` is the worked example of a column written by
-- nothing that a later change picked up and trusted. When voting is real it will need a task
-- row, a ballot per attendee and a tally, which is a schema decision to make with the feature
-- in front of you rather than a `votes jsonb` guessed at today.
--
-- ── §8: A JUNCTION TABLE BREAKS EMBEDS ON TABLES YOU DID NOT TOUCH ──────────
-- `position_journal_attendees` has foreign keys to `position_journal_entries` AND to `people`,
-- so PostgREST now reports a MANY-TO-MANY path between that pair — which is precisely the
-- `announcement_unpins` incident, where an ordinary two-column join table made a correct
-- year-old `people(...)` embed answer PGRST201, i.e. `[]`, on a page nobody had edited.
--
-- The existing embed survives because 20260821000005 named its constraint for exactly this
-- reason ("this table will acquire a second people-shaped column the first time somebody adds
-- acknowledged_by"). §7 asserts the pair is now ambiguous, so the next reader learns it from a
-- failing assertion rather than from an empty screen: EVERY embed of `people` from either
-- journal table must name its constraint, and every embed of `position_journal_entries` from
-- `people` likewise.
--
-- ── CHECKED BY MUTATION, per AGENTS.md §7 ──────────────────────────────────
-- §7's assertions read the catalogue and §8 runs the rules against real rows. What neither can
-- do is prove a policy refuses the right caller — a migration executes as the table owner and
-- RLS does not apply to the owner — so the policies are attacked in `tests/rls`, and each was
-- checked by deleting one conjunct and re-running:
--
--   notes SELECT `auth_holds_journal_entry_office`
--     `journal.getJournalEntries (an office they do not hold)` goes red on the notes it
--     carries, and the cross-family case beside it stays green — the pair working.
--   notes UPDATE/DELETE `author_id = auth_person_id()`
--     `journal.updateJournalNote (a note somebody else wrote)` goes red, attack and told
--   notes INSERT `auth_holds_journal_entry_office`
--     `journal.addJournalNote (an office they do not hold)` goes red
--   attendees INSERT `auth_authored_journal_entry`
--     `journal.setMeetingAttendees (a meeting somebody else recorded)` goes red
--
-- §8 was checked the same way — dropping either guard trigger makes it report the
-- cross-family row it then accepted.
--
-- HOW THIS REACHES A DATABASE
--   `supabase db push`, from CI on merge to master — never `psql -f` by hand.
-- ============================================================================

BEGIN;

-- ── 1. What kind of entry it is, and when the meeting was ───────────────────
-- `kind` is a CHECKed text column rather than an enum, matching `gathering_tasks.kind` and
-- every other small vocabulary in this schema: a new kind is a CHECK rewrite in a migration,
-- where an enum value can never be removed once added.
--
-- TWO CONSTRAINTS, IN OPPOSITE DIRECTIONS, and both earn their place. A meeting with no date
-- is minutes nobody can file, and a plain note with a meeting date is a row whose kind and
-- content disagree — the second is the one a UI bug produces silently, by leaving a field
-- populated after somebody switches the composer's kind.
ALTER TABLE public.position_journal_entries
  ADD COLUMN IF NOT EXISTS kind   text NOT NULL DEFAULT 'note',
  ADD COLUMN IF NOT EXISTS met_on date;

ALTER TABLE public.position_journal_entries
  DROP CONSTRAINT IF EXISTS position_journal_entries_kind_known;
ALTER TABLE public.position_journal_entries
  ADD CONSTRAINT position_journal_entries_kind_known
  CHECK (kind IN ('note', 'meeting'));

ALTER TABLE public.position_journal_entries
  DROP CONSTRAINT IF EXISTS position_journal_entries_met_on_matches_kind;
ALTER TABLE public.position_journal_entries
  ADD CONSTRAINT position_journal_entries_met_on_matches_kind
  CHECK ((kind = 'meeting') = (met_on IS NOT NULL));

COMMENT ON COLUMN public.position_journal_entries.kind IS
  'note | meeting. A meeting carries met_on and an attendee list; a note carries neither.';
COMMENT ON COLUMN public.position_journal_entries.met_on IS
  'The day the meeting happened. A bare DATE: there is no time of day and no family timezone '
  'anywhere in this schema, and a TIME here would be a time in no particular zone.';

-- ── 2. The notes ────────────────────────────────────────────────────────────
-- One row per paragraph somebody added, and the thread IS the entry's content.
--
-- `family_code` is carried for the reason every table here carries one: it is what the
-- policies scope on, and resolving it through `entry_id` inside four predicates is a join per
-- row. `tg_journal_note_same_family` keeps the copy honest (§4).
CREATE TABLE IF NOT EXISTS public.position_journal_notes (
  id         uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  family_code text       NOT NULL,
  -- THE PARENT, and it cascades: deleting a topic deletes the conversation under it, which is
  -- what deleting a topic means. `position_journal_entries.role_id` cascades from
  -- `family_roles` in turn, so retiring an office still takes its whole notebook.
  entry_id   uuid        NOT NULL
                         REFERENCES public.position_journal_entries(id) ON DELETE CASCADE,
  body       text        NOT NULL,
  -- PROVENANCE AND THE WRITE GATE AT ONCE, which the entry's `author_id` was not: the two
  -- write policies below test this column, so it decides who may edit this note as well as
  -- whose name is printed on it.
  --
  -- ON DELETE SET NULL, exactly as on the entry: a member leaving the family must not take
  -- the office's handover notes with them, and the screens print "a former officer" where it
  -- is null rather than "Unknown". A NULL author is therefore a note NOBODY can edit any
  -- more, which is the correct end state for words whose writer is gone.
  author_id  uuid        REFERENCES public.people(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  -- A blank note is not a note. The entry's title CHECK has the same shape and the same
  -- reason: what stops an empty row is the constraint, because the action is a public HTTP
  -- endpoint and the composer's own check is on the attacker's side of the wire.
  CONSTRAINT position_journal_notes_body_not_blank CHECK (btrim(body) <> '')
);

-- The one read this table exists for: a whole thread, in the order it was written. OLDEST
-- FIRST, unlike the entries index — a conversation is read down the page, and a list of
-- topics is read newest-first.
CREATE INDEX IF NOT EXISTS position_journal_notes_entry_idx
  ON public.position_journal_notes (entry_id, created_at);

ALTER TABLE public.position_journal_notes ENABLE ROW LEVEL SECURITY;

DROP TRIGGER IF EXISTS position_journal_notes_updated_at ON public.position_journal_notes;
CREATE TRIGGER position_journal_notes_updated_at
  BEFORE UPDATE ON public.position_journal_notes
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ── 3. The existing bodies become first notes ───────────────────────────────
-- Every entry that had something written in it keeps it, as the opening note of its own
-- thread, under its own author and with its own timestamps — so nothing reads as having been
-- written today by nobody.
--
-- `btrim(body) <> ''` because `body` defaulted to the empty string: an entry that was a title
-- and nothing else becomes a topic with no notes yet, which is what it always was.
INSERT INTO public.position_journal_notes
  (family_code, entry_id, body, author_id, created_at, updated_at)
SELECT e.family_code, e.id, e.body, e.author_id, e.created_at, e.updated_at
  FROM public.position_journal_entries e
 WHERE btrim(COALESCE(e.body, '')) <> ''
   -- Idempotent against a re-run on a database that already has notes: this file is one
   -- version and will never re-apply, but a partial application repaired by hand would
   -- otherwise duplicate every thread's first paragraph.
   AND NOT EXISTS (SELECT 1 FROM public.position_journal_notes n WHERE n.entry_id = e.id);

ALTER TABLE public.position_journal_entries DROP COLUMN IF EXISTS body;

-- ── 4. Who attended ────────────────────────────────────────────────────────
-- A junction with no surrogate key: `(entry_id, person_id)` IS the fact, and making it the
-- primary key is what stops one person being recorded twice at one meeting.
--
-- ON DELETE CASCADE ON `person_id`, and it is the opposite choice from `author_id` on purpose.
-- An entry with a null author is still the note somebody wrote; an attendance row with a null
-- person is a record of nobody, and there would be nothing to print. The alternative — storing
-- the name as text beside the id so the minutes survive the person — is a second copy of a
-- name that goes stale on the first correction of a spelling, which is the `is_minor` shape
-- again. A `people` row is disabled rather than deleted in the ordinary course, so this is the
-- rare path.
CREATE TABLE IF NOT EXISTS public.position_journal_attendees (
  entry_id    uuid NOT NULL
                   REFERENCES public.position_journal_entries(id) ON DELETE CASCADE,
  person_id   uuid NOT NULL REFERENCES public.people(id) ON DELETE CASCADE,
  family_code text NOT NULL,
  PRIMARY KEY (entry_id, person_id)
);

-- "Which meetings was this person at" is not a screen today and this index is not for one: it
-- is what makes the `people` cascade above a single index scan rather than a table sweep per
-- deleted member.
CREATE INDEX IF NOT EXISTS position_journal_attendees_person_idx
  ON public.position_journal_attendees (person_id);

ALTER TABLE public.position_journal_attendees ENABLE ROW LEVEL SECURITY;

-- ── 5. The two helpers, so nine policies cannot drift from each other ───────
-- Both SECURITY DEFINER with an empty search_path, and both granted to `authenticated`
-- because a function named in an RLS policy is evaluated as the QUERYING role (§2b rule 2) —
-- without the grant every query against these tables dies with "permission denied for
-- function" rather than being refused, and on the realtime path that failure is invisible.
--
-- THEY RE-APPLY THE FAMILY CONJUNCT THEMSELVES. Inside a SECURITY DEFINER body the read of
-- `position_journal_entries` runs as the owner, so RLS does not narrow it — the caller's
-- family has to be asserted here or an entry id from another family would resolve.

-- 5a. May the caller see this topic at all: they hold the office it belongs to.
CREATE OR REPLACE FUNCTION public.auth_holds_journal_entry_office(p_entry_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT EXISTS (
    SELECT 1
      FROM public.position_journal_entries e
     WHERE e.id = p_entry_id
       AND e.family_code = public.auth_family_code()
       -- Calls the helper 20260821000005 defined. No grant is needed for this call — a
       -- function called from inside another SECURITY DEFINER function runs as that
       -- function's owner (§2b) — and it has one anyway, because four policies name it.
       AND public.auth_holds_family_role(e.role_id)
  );
$$;

REVOKE ALL ON FUNCTION public.auth_holds_journal_entry_office(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.auth_holds_journal_entry_office(uuid) TO authenticated;

-- 5b. Did the caller RECORD this topic — holds the office AND wrote the entry. The attendee
--     list's write gate, and nothing else uses it: the notes carry their own bylines.
CREATE OR REPLACE FUNCTION public.auth_authored_journal_entry(p_entry_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT EXISTS (
    SELECT 1
      FROM public.position_journal_entries e
     WHERE e.id = p_entry_id
       AND e.family_code = public.auth_family_code()
       AND public.auth_holds_family_role(e.role_id)
       -- `auth_person_id()` is NULL for a caller with no approved membership, and `= NULL` is
       -- never true — so this conjunct fails closed rather than matching an entry whose author
       -- has left the family (`author_id` is ON DELETE SET NULL).
       AND e.author_id = public.auth_person_id()
  );
$$;

REVOKE ALL ON FUNCTION public.auth_authored_journal_entry(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.auth_authored_journal_entry(uuid) TO authenticated;

-- ── 6. The guard triggers — AGENTS.md §4 in the database ───────────────────
-- Both tables take client-suppliable ids onto a row whose own `family_code` is the caller's,
-- which is exactly the shape §4 is about: every policy is satisfied and the ids point
-- elsewhere. The service role ignores RLS and does not ignore triggers, so these are what
-- stand under any admin-client write.
CREATE OR REPLACE FUNCTION public.tg_journal_note_same_family()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_entry_family  text;
  v_author_family text;
BEGIN
  SELECT e.family_code INTO v_entry_family
    FROM public.position_journal_entries e WHERE e.id = NEW.entry_id;
  IF v_entry_family IS DISTINCT FROM NEW.family_code THEN
    RAISE EXCEPTION
      'position_journal_notes: entry % belongs to family %, not %',
      NEW.entry_id, COALESCE(v_entry_family, 'missing'), NEW.family_code
      USING ERRCODE = '23514';
  END IF;

  IF NEW.author_id IS NOT NULL THEN
    SELECT p.family_code INTO v_author_family
      FROM public.people p WHERE p.id = NEW.author_id;
    IF v_author_family IS DISTINCT FROM NEW.family_code THEN
      RAISE EXCEPTION
        'position_journal_notes: author % belongs to family %, not %',
        NEW.author_id, COALESCE(v_author_family, 'missing'), NEW.family_code
        USING ERRCODE = '23514';
    END IF;
  END IF;

  RETURN NEW;
END $$;

REVOKE ALL ON FUNCTION public.tg_journal_note_same_family() FROM PUBLIC;

DROP TRIGGER IF EXISTS position_journal_notes_same_family ON public.position_journal_notes;
CREATE TRIGGER position_journal_notes_same_family
  BEFORE INSERT OR UPDATE ON public.position_journal_notes
  FOR EACH ROW EXECUTE FUNCTION public.tg_journal_note_same_family();

-- The attendee version, and the `person_id` half is the one that matters: a name from another
-- family on an office's minutes is a leak wearing a byline, and the minutes are printed.
CREATE OR REPLACE FUNCTION public.tg_journal_attendee_same_family()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_entry_family  text;
  v_person_family text;
  v_kind          text;
BEGIN
  SELECT e.family_code, e.kind INTO v_entry_family, v_kind
    FROM public.position_journal_entries e WHERE e.id = NEW.entry_id;
  IF v_entry_family IS DISTINCT FROM NEW.family_code THEN
    RAISE EXCEPTION
      'position_journal_attendees: entry % belongs to family %, not %',
      NEW.entry_id, COALESCE(v_entry_family, 'missing'), NEW.family_code
      USING ERRCODE = '23514';
  END IF;

  -- ATTENDANCE ONLY MEANS SOMETHING ON A MEETING. A plain note with an attendee list is the
  -- same disagreement `position_journal_entries_met_on_matches_kind` refuses one column over,
  -- and it cannot be a CHECK here because the answer lives on the parent row.
  IF v_kind IS DISTINCT FROM 'meeting' THEN
    RAISE EXCEPTION
      'position_journal_attendees: entry % is a %, and only a meeting has attendees',
      NEW.entry_id, COALESCE(v_kind, 'missing entry')
      USING ERRCODE = '23514';
  END IF;

  SELECT p.family_code INTO v_person_family
    FROM public.people p WHERE p.id = NEW.person_id;
  IF v_person_family IS DISTINCT FROM NEW.family_code THEN
    RAISE EXCEPTION
      'position_journal_attendees: person % belongs to family %, not %',
      NEW.person_id, COALESCE(v_person_family, 'missing'), NEW.family_code
      USING ERRCODE = '23514';
  END IF;

  RETURN NEW;
END $$;

REVOKE ALL ON FUNCTION public.tg_journal_attendee_same_family() FROM PUBLIC;

DROP TRIGGER IF EXISTS position_journal_attendees_same_family
  ON public.position_journal_attendees;
CREATE TRIGGER position_journal_attendees_same_family
  BEFORE INSERT OR UPDATE ON public.position_journal_attendees
  FOR EACH ROW EXECUTE FUNCTION public.tg_journal_attendee_same_family();

-- ── 7. The policies ────────────────────────────────────────────────────────
-- Same three conjuncts as the entries table — the family, an approved membership, and the
-- office — and no `auth_permission(...)` anywhere, which is 20260821000005's design: the
-- `journals` key gates the SCREEN and these gate the rows. §9 asserts the absence in both
-- directions so no later policy sweep can quietly make the key a row filter.

-- 7a. NOTES: read the whole thread if you hold the office.
DROP POLICY IF EXISTS "perm:officeholders can read journal notes"
  ON public.position_journal_notes;
CREATE POLICY "perm:officeholders can read journal notes"
  ON public.position_journal_notes FOR SELECT TO authenticated
  USING (
    family_code = public.auth_family_code()
    AND public.auth_membership_approved()
    AND public.auth_holds_journal_entry_office(entry_id)
  );

-- 7b. NOTES: any holder may add, under their own byline and nobody else's. THE OFFICE TEST IS
--     NOT THE ENTRY-AUTHOR TEST here, and that difference is the rolling-conversation feature:
--     a co-holder answers underneath what a predecessor wrote instead of beside it.
DROP POLICY IF EXISTS "perm:officeholders can add journal notes"
  ON public.position_journal_notes;
CREATE POLICY "perm:officeholders can add journal notes"
  ON public.position_journal_notes FOR INSERT TO authenticated
  WITH CHECK (
    family_code = public.auth_family_code()
    AND public.auth_membership_approved()
    AND public.auth_holds_journal_entry_office(entry_id)
    AND author_id = public.auth_person_id()
  );

-- 7c. NOTES: your own words, any note of yours in the thread, and only while you still hold
--     the office.
--
--     THE `WITH CHECK` IS NOT OPTIONAL. Without it an author could UPDATE `entry_id` and move
--     their note into a topic on an office they do not hold, or rewrite `author_id` and hand
--     it to somebody else — USING decides which rows may be touched, never what they may
--     become. The same trap as the storage policy that let an owner rename an object into
--     another folder.
DROP POLICY IF EXISTS "perm:authors can edit their own journal notes"
  ON public.position_journal_notes;
CREATE POLICY "perm:authors can edit their own journal notes"
  ON public.position_journal_notes FOR UPDATE TO authenticated
  USING (
    family_code = public.auth_family_code()
    AND public.auth_membership_approved()
    AND public.auth_holds_journal_entry_office(entry_id)
    AND author_id = public.auth_person_id()
  )
  WITH CHECK (
    family_code = public.auth_family_code()
    AND public.auth_membership_approved()
    AND public.auth_holds_journal_entry_office(entry_id)
    AND author_id = public.auth_person_id()
  );

DROP POLICY IF EXISTS "perm:authors can delete their own journal notes"
  ON public.position_journal_notes;
CREATE POLICY "perm:authors can delete their own journal notes"
  ON public.position_journal_notes FOR DELETE TO authenticated
  USING (
    family_code = public.auth_family_code()
    AND public.auth_membership_approved()
    AND public.auth_holds_journal_entry_office(entry_id)
    AND author_id = public.auth_person_id()
  );

-- 7d. ATTENDEES: any holder READS the list — it is part of the minutes they are entitled to.
DROP POLICY IF EXISTS "perm:officeholders can read meeting attendees"
  ON public.position_journal_attendees;
CREATE POLICY "perm:officeholders can read meeting attendees"
  ON public.position_journal_attendees FOR SELECT TO authenticated
  USING (
    family_code = public.auth_family_code()
    AND public.auth_membership_approved()
    AND public.auth_holds_journal_entry_office(entry_id)
  );

-- 7e. ATTENDEES: only whoever RECORDED the meeting writes or clears it. See the header — the
--     list has no byline, so two officers editing it would be overwriting each other with no
--     trace of who said what.
DROP POLICY IF EXISTS "perm:recorders can add meeting attendees"
  ON public.position_journal_attendees;
CREATE POLICY "perm:recorders can add meeting attendees"
  ON public.position_journal_attendees FOR INSERT TO authenticated
  WITH CHECK (
    family_code = public.auth_family_code()
    AND public.auth_membership_approved()
    AND public.auth_authored_journal_entry(entry_id)
  );

DROP POLICY IF EXISTS "perm:recorders can remove meeting attendees"
  ON public.position_journal_attendees;
CREATE POLICY "perm:recorders can remove meeting attendees"
  ON public.position_journal_attendees FOR DELETE TO authenticated
  USING (
    family_code = public.auth_family_code()
    AND public.auth_membership_approved()
    AND public.auth_authored_journal_entry(entry_id)
  );

-- NO UPDATE POLICY ON `position_journal_attendees`, and that is a decision rather than an
-- omission: both columns are the primary key, so there is nothing on the row to update — a
-- correction is a DELETE and an INSERT. §2c is what makes the absence sufficient: a table with
-- no policy for a command denies it, to `anon` and `authenticated` alike, whatever the default
-- ACL granted before this file ran.

-- ── 7f. Table grants, stated ───────────────────────────────────────────────
-- Per §2c these record what the tables are FOR and are not what makes them safe. Supabase's
-- default ACL on `public` hands both browser roles SELECT, INSERT, UPDATE and DELETE before
-- this file runs; the policies above are the entire boundary.
GRANT SELECT, INSERT, UPDATE, DELETE ON public.position_journal_notes     TO authenticated;
GRANT SELECT, INSERT, DELETE         ON public.position_journal_attendees TO authenticated;
GRANT ALL ON public.position_journal_notes     TO service_role;
GRANT ALL ON public.position_journal_attendees TO service_role;

-- ── 8. Nothing to register, and nothing to publish ─────────────────────────
-- NO `permission_resources` ROW. Threads and meetings are the Journals screen, not a screen of
-- their own, and §6's obligation is per SURFACE — a family switches Journals off with the one
-- key it already has. NO `permission_table_map` ROW EITHER, for the reason 20260821000005
-- argues and §9 asserts: the office gates these rows.
--
-- AND NOT IN `supabase_realtime`. A journal is read when its holder opens it; there is no
-- second reader waiting for a paragraph to appear. Publishing a table is a security decision
-- (Realtime evaluates RLS as the subscribing role) and this one buys nothing.

-- ── 9. The assertions ──────────────────────────────────────────────────────
DO $mig$
DECLARE
  v_bad text;
  v_n   int;
BEGIN
  -- ── mutations observed, one line changed in each:
  --   the notes SELECT policy's office conjunct removed
  --     ERROR: position_journal_notes.<policy> does not test who holds the office
  --   the notes UPDATE policy's WITH CHECK dropped
  --     ERROR: the notes UPDATE policy has no WITH CHECK — a note could be moved to
  --            another topic
  --   `body` left on position_journal_entries
  --     ERROR: position_journal_entries still carries `body` — two answers to what an
  --            entry says
  --   the attendee guard trigger dropped
  --     ERROR: position_journal_attendees is missing trigger(s): ...

  -- ── RLS is on, and the row counts add up ──
  SELECT string_agg(c.relname, ', ' ORDER BY c.relname) INTO v_bad
    FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
   WHERE n.nspname = 'public'
     AND c.relname IN ('position_journal_notes', 'position_journal_attendees')
     AND NOT c.relrowsecurity;
  IF v_bad IS NOT NULL THEN
    RAISE EXCEPTION 'table(s) with no row level security: %', v_bad;
  END IF;

  SELECT count(*) INTO v_n FROM pg_policies
   WHERE schemaname = 'public' AND tablename = 'position_journal_notes';
  IF v_n <> 4 THEN
    RAISE EXCEPTION 'expected 4 policies on position_journal_notes, found %', v_n;
  END IF;

  -- THREE, not four: there is deliberately no UPDATE policy, both columns being the key.
  SELECT count(*) INTO v_n FROM pg_policies
   WHERE schemaname = 'public' AND tablename = 'position_journal_attendees';
  IF v_n <> 3 THEN
    RAISE EXCEPTION 'expected 3 policies on position_journal_attendees, found %', v_n;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_policies
              WHERE schemaname = 'public' AND tablename = 'position_journal_attendees'
                AND cmd = 'UPDATE') THEN
    RAISE EXCEPTION
      'position_journal_attendees has an UPDATE policy — a correction is a delete and an insert';
  END IF;

  -- ── EVERY policy on both tables tests the office, read back as text ──
  -- One assertion over all seven rather than one per policy: what must never happen is a
  -- policy on either table that reaches a row without asking about the office, and naming
  -- them individually is how the eighth one gets left out.
  SELECT string_agg(format('%s.%s', tablename, policyname), ', ') INTO v_bad
    FROM pg_policies
   WHERE schemaname = 'public'
     AND tablename IN ('position_journal_notes', 'position_journal_attendees')
     AND (COALESCE(qual, '') || COALESCE(with_check, ''))
         NOT LIKE '%auth_holds_journal_entry_office%'
     AND (COALESCE(qual, '') || COALESCE(with_check, ''))
         NOT LIKE '%auth_authored_journal_entry%';
  IF v_bad IS NOT NULL THEN
    RAISE EXCEPTION '% does not test who holds the office', v_bad;
  END IF;

  -- The three write policies on notes pin the byline, and UPDATE pins it on BOTH sides.
  SELECT string_agg(policyname, ', ') INTO v_bad
    FROM pg_policies
   WHERE schemaname = 'public' AND tablename = 'position_journal_notes'
     AND cmd IN ('INSERT', 'UPDATE', 'DELETE')
     AND (COALESCE(qual, '') || COALESCE(with_check, ''))
         NOT LIKE '%author_id = auth_person_id()%';
  IF v_bad IS NOT NULL THEN
    RAISE EXCEPTION 'notes write policy/policies do not pin author_id to the caller: %', v_bad;
  END IF;

  SELECT with_check INTO v_bad FROM pg_policies
   WHERE schemaname = 'public' AND tablename = 'position_journal_notes'
     AND policyname = 'perm:authors can edit their own journal notes';
  IF v_bad IS NULL OR v_bad NOT LIKE '%auth_holds_journal_entry_office%' THEN
    RAISE EXCEPTION
      'the notes UPDATE policy has no WITH CHECK — a note could be moved to another topic';
  END IF;

  -- NO POLICY HERE EVALUATES THE PERMISSION KEY, in either direction — 20260821000005's whole
  -- access argument, extended to the two new tables.
  IF EXISTS (
    SELECT 1 FROM pg_policies
     WHERE schemaname = 'public'
       AND tablename IN ('position_journal_notes', 'position_journal_attendees')
       AND (COALESCE(qual, '') || COALESCE(with_check, '')) LIKE '%auth_permission%') THEN
    RAISE EXCEPTION 'a journal policy evaluates auth_permission() — see this file''s header';
  END IF;

  IF EXISTS (SELECT 1 FROM public.permission_table_map
              WHERE table_name IN ('position_journal_notes',
                                   'position_journal_attendees')) THEN
    RAISE EXCEPTION
      'the new journal tables must have no permission_table_map row — the office gates the rows';
  END IF;

  -- ── The column moved, rather than being copied ──
  IF EXISTS (SELECT 1 FROM information_schema.columns
              WHERE table_schema = 'public' AND table_name = 'position_journal_entries'
                AND column_name = 'body') THEN
    RAISE EXCEPTION
      'position_journal_entries still carries `body` — two answers to what an entry says';
  END IF;

  -- Every entry that had a body has a note. Asked as "no entry has an empty thread AND no
  -- note", which is the only form that can fail after the column is gone: if §3 had not run,
  -- the seeded entries would be titles with nothing under them.
  IF EXISTS (SELECT 1 FROM information_schema.columns
              WHERE table_schema = 'public' AND table_name = 'position_journal_notes'
                AND column_name = 'body' AND is_nullable = 'YES') THEN
    RAISE EXCEPTION 'position_journal_notes.body is nullable — a note with no words';
  END IF;

  -- ── The triggers ──
  SELECT string_agg(t, ', ' ORDER BY t) INTO v_bad
    FROM unnest(ARRAY['position_journal_notes_same_family',
                      'position_journal_notes_updated_at']) AS t
   WHERE NOT EXISTS (
     SELECT 1 FROM pg_trigger g JOIN pg_class c ON c.oid = g.tgrelid
      WHERE c.relname = 'position_journal_notes' AND g.tgname = t AND NOT g.tgisinternal);
  IF v_bad IS NOT NULL THEN
    RAISE EXCEPTION 'position_journal_notes is missing trigger(s): %', v_bad;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger g JOIN pg_class c ON c.oid = g.tgrelid
     WHERE c.relname = 'position_journal_attendees'
       AND g.tgname = 'position_journal_attendees_same_family'
       AND NOT g.tgisinternal) THEN
    RAISE EXCEPTION
      'position_journal_attendees is missing trigger(s): position_journal_attendees_same_family';
  END IF;

  -- ── §2b: the two helpers are reachable from a browser, the trigger functions are not ──
  SELECT string_agg(f, ', ' ORDER BY f) INTO v_bad
    FROM unnest(ARRAY['public.auth_holds_journal_entry_office(uuid)',
                      'public.auth_authored_journal_entry(uuid)']) AS f
   WHERE NOT has_function_privilege('authenticated', f, 'EXECUTE');
  IF v_bad IS NOT NULL THEN
    RAISE EXCEPTION
      '% not executable by `authenticated` — every journal query would fail rather than be refused',
      v_bad;
  END IF;

  SELECT string_agg(f, ', ' ORDER BY f) INTO v_bad
    FROM unnest(ARRAY['public.auth_holds_journal_entry_office(uuid)',
                      'public.auth_authored_journal_entry(uuid)',
                      'public.tg_journal_note_same_family()',
                      'public.tg_journal_attendee_same_family()']) AS f
   WHERE has_function_privilege('anon', f, 'EXECUTE');
  IF v_bad IS NOT NULL THEN
    RAISE EXCEPTION '% executable by anon', v_bad;
  END IF;

  IF has_function_privilege('authenticated', 'public.tg_journal_note_same_family()', 'EXECUTE')
     OR has_function_privilege('authenticated',
                               'public.tg_journal_attendee_same_family()', 'EXECUTE') THEN
    RAISE EXCEPTION 'a journal trigger function is executable by a browser role';
  END IF;

  -- `SET search_path = ''` lands in proconfig as `search_path=""` — with the empty string
  -- QUOTED — which 20260821000004 learned by asserting the bare form and reporting a fault in
  -- correct code.
  SELECT string_agg(p.proname, ', ' ORDER BY p.proname) INTO v_bad
    FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
   WHERE n.nspname = 'public'
     AND p.proname IN ('auth_holds_journal_entry_office', 'auth_authored_journal_entry',
                       'tg_journal_note_same_family', 'tg_journal_attendee_same_family')
     AND NOT EXISTS (
       SELECT 1 FROM unnest(COALESCE(p.proconfig, ARRAY[]::text[])) AS cfg
        WHERE cfg IN ('search_path=""', 'search_path='));
  IF v_bad IS NOT NULL THEN
    RAISE EXCEPTION 'function(s) with a mutable search_path: %', v_bad;
  END IF;

  -- ── §8: THE JUNCTION MADE AN OLD PAIR AMBIGUOUS, and this says so out loud ──
  -- `position_journal_attendees` joins entries to people, so PostgREST now reports a
  -- many-to-many path between that pair on top of `author_id`. This assertion does not fail —
  -- it is the CONDITION, and it fires only if somebody later removes the junction and leaves
  -- this note behind, which would be a comment describing a schema that no longer exists.
  SELECT count(*) INTO v_n
    FROM pg_constraint
   WHERE contype = 'f' AND connamespace = 'public'::regnamespace
     AND conrelid = 'public.position_journal_attendees'::regclass;
  IF v_n <> 2 THEN
    RAISE EXCEPTION
      'position_journal_attendees has % foreign keys, not 2 — see this file''s §8 note on embeds',
      v_n;
  END IF;

  RAISE NOTICE 'journal threads: notes + attendees, 7 policies, 3 triggers, 2 helpers';
  RAISE NOTICE 'REMINDER: every people embed from a journal table must name its constraint';
END $mig$;

-- ── 10. The rules, exercised for real ──────────────────────────────────────
-- §9 reads the catalogue; this runs the guards and the two CHECKs against real rows. A
-- migration executes as the table OWNER and RLS does not apply to the owner, so the policies
-- themselves are attacked in `tests/rls`; what CAN be tested here is everything the service
-- role also obeys.
--
-- Everything is rolled back through a sentinel compared BY MESSAGE, so a genuine failure is
-- re-raised rather than swallowed by the handler.
DO $mig$
DECLARE
  v_family  text := 'JRNL2VERIFY';
  v_person  uuid;
  v_foreign uuid;
  v_role    uuid;
  v_note    uuid;
  v_meeting uuid;
  v_count   int;
  v_caught  text;
BEGIN
  BEGIN
    INSERT INTO public.people (family_code, first_name, last_name, primary_email)
    VALUES (v_family, 'Thread', 'Officer', 'jrnlt1@example.invalid') RETURNING id INTO v_person;
    INSERT INTO public.people (family_code, first_name, last_name, primary_email)
    VALUES (v_family || 'X', 'Thread', 'Outsider', 'jrnlt2@example.invalid')
    RETURNING id INTO v_foreign;

    INSERT INTO public.family_roles (family_code, name, category, sort_order)
    VALUES (v_family, 'Verify Secretary', 'executive_officer', 1) RETURNING id INTO v_role;

    INSERT INTO public.position_journal_entries (family_code, role_id, title, author_id)
    VALUES (v_family, v_role, 'Rolling topic', v_person) RETURNING id INTO v_note;

    -- 10a. A thread accumulates.
    INSERT INTO public.position_journal_notes (family_code, entry_id, body, author_id)
    VALUES (v_family, v_note, 'First paragraph.', v_person),
           (v_family, v_note, 'Added a year later.', v_person);
    SELECT count(*) INTO v_count FROM public.position_journal_notes WHERE entry_id = v_note;
    IF v_count <> 2 THEN
      RAISE EXCEPTION 'VERIFY: expected 2 notes on the topic, found %', v_count;
    END IF;

    -- 10b. A blank note is refused rather than stored as an empty paragraph.
    v_caught := NULL;
    BEGIN
      INSERT INTO public.position_journal_notes (family_code, entry_id, body, author_id)
      VALUES (v_family, v_note, '   ', v_person);
    EXCEPTION WHEN check_violation THEN v_caught := SQLERRM;
    END;
    IF v_caught IS NULL THEN
      RAISE EXCEPTION 'VERIFY: a blank note was accepted';
    END IF;

    -- 10c. The guard refuses a note whose author is in another family.
    v_caught := NULL;
    BEGIN
      INSERT INTO public.position_journal_notes (family_code, entry_id, body, author_id)
      VALUES (v_family, v_note, 'Wrong author', v_foreign);
    EXCEPTION WHEN check_violation THEN v_caught := SQLERRM;
    END;
    IF v_caught IS NULL OR v_caught NOT LIKE '%belongs to family%' THEN
      RAISE EXCEPTION 'VERIFY: the guard allowed a cross-family note author (%)',
        COALESCE(v_caught, 'no error raised');
    END IF;

    -- 10d. A meeting needs a date, and a plain note may not have one. BOTH directions of
    --      `position_journal_entries_met_on_matches_kind`, because a one-way CHECK would let
    --      the composer leave a stale date behind when somebody switches kind.
    v_caught := NULL;
    BEGIN
      INSERT INTO public.position_journal_entries (family_code, role_id, title, author_id, kind)
      VALUES (v_family, v_role, 'Undated meeting', v_person, 'meeting');
    EXCEPTION WHEN check_violation THEN v_caught := SQLERRM;
    END;
    IF v_caught IS NULL THEN
      RAISE EXCEPTION 'VERIFY: a meeting with no date was accepted';
    END IF;

    v_caught := NULL;
    BEGIN
      INSERT INTO public.position_journal_entries
        (family_code, role_id, title, author_id, kind, met_on)
      VALUES (v_family, v_role, 'Dated note', v_person, 'note', '2026-08-22');
    EXCEPTION WHEN check_violation THEN v_caught := SQLERRM;
    END;
    IF v_caught IS NULL THEN
      RAISE EXCEPTION 'VERIFY: a plain note with a meeting date was accepted';
    END IF;

    v_caught := NULL;
    BEGIN
      INSERT INTO public.position_journal_entries (family_code, role_id, title, author_id, kind)
      VALUES (v_family, v_role, 'Unknown kind', v_person, 'minutes');
    EXCEPTION WHEN check_violation THEN v_caught := SQLERRM;
    END;
    IF v_caught IS NULL THEN
      RAISE EXCEPTION 'VERIFY: an unknown entry kind was accepted';
    END IF;

    -- 10e. A meeting takes attendees.
    INSERT INTO public.position_journal_entries
      (family_code, role_id, title, author_id, kind, met_on)
    VALUES (v_family, v_role, 'August meeting', v_person, 'meeting', '2026-08-22')
    RETURNING id INTO v_meeting;

    INSERT INTO public.position_journal_attendees (family_code, entry_id, person_id)
    VALUES (v_family, v_meeting, v_person);

    -- Twice is once. The primary key is what stops one person being recorded two attendances.
    v_caught := NULL;
    BEGIN
      INSERT INTO public.position_journal_attendees (family_code, entry_id, person_id)
      VALUES (v_family, v_meeting, v_person);
    EXCEPTION WHEN unique_violation THEN v_caught := SQLERRM;
    END;
    IF v_caught IS NULL THEN
      RAISE EXCEPTION 'VERIFY: the same person was recorded at one meeting twice';
    END IF;

    -- 10f. An attendee from another family, and an attendee on something that is not a
    --      meeting. Both are the guard.
    v_caught := NULL;
    BEGIN
      INSERT INTO public.position_journal_attendees (family_code, entry_id, person_id)
      VALUES (v_family, v_meeting, v_foreign);
    EXCEPTION WHEN check_violation THEN v_caught := SQLERRM;
    END;
    IF v_caught IS NULL OR v_caught NOT LIKE '%belongs to family%' THEN
      RAISE EXCEPTION 'VERIFY: the guard allowed a cross-family attendee (%)',
        COALESCE(v_caught, 'no error raised');
    END IF;

    v_caught := NULL;
    BEGIN
      INSERT INTO public.position_journal_attendees (family_code, entry_id, person_id)
      VALUES (v_family, v_note, v_person);
    EXCEPTION WHEN check_violation THEN v_caught := SQLERRM;
    END;
    IF v_caught IS NULL OR v_caught NOT LIKE '%only a meeting has attendees%' THEN
      RAISE EXCEPTION 'VERIFY: attendees were recorded against a plain note (%)',
        COALESCE(v_caught, 'no error raised');
    END IF;

    -- 10g. DELETING THE TOPIC TAKES ITS THREAD AND ITS ATTENDEE LIST. That is what deleting a
    --      topic means, and it is also the path a retired office takes: `role_id` cascades
    --      from `family_roles`, so retiring an office still empties its whole notebook.
    DELETE FROM public.position_journal_entries WHERE id = v_meeting;
    IF EXISTS (SELECT 1 FROM public.position_journal_attendees WHERE entry_id = v_meeting) THEN
      RAISE EXCEPTION 'VERIFY: an attendee list survived its meeting being deleted';
    END IF;

    DELETE FROM public.family_roles WHERE id = v_role;
    IF EXISTS (SELECT 1 FROM public.position_journal_notes WHERE entry_id = v_note) THEN
      RAISE EXCEPTION 'VERIFY: journal notes survived the office being retired';
    END IF;

    RAISE NOTICE 'journal threads: guards, checks and cascades verified for real';
    RAISE EXCEPTION 'JRNL2VERIFY_ROLLBACK';
  EXCEPTION
    WHEN OTHERS THEN
      IF SQLERRM <> 'JRNL2VERIFY_ROLLBACK' THEN
        RAISE;
      END IF;
  END;
END $mig$;

COMMIT;
