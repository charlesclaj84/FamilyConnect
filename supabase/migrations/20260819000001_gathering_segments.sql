-- ============================================================================
-- A GATHERING IS MADE OF SEGMENTS, AND EACH ONE HAS ITS OWN DAY AND PLACE.
--
-- ── WHAT WAS MISSING ────────────────────────────────────────────────────────
-- The worked example is the one the request gave: a Family Reunion is a three-day event
-- consisting of the Welcome, the Picnic and the Send Off — each an event of its own. Since
-- 20260819000000 a gathering can already hold three templates (`gathering_template_uses`
-- is the link, and `/gatherings/[id]` already groups the task list by template), so the
-- shape was there. What was missing is that the three had NOWHERE TO RECORD that they
-- happen on different days in different places. The organizer could say a reunion runs
-- 1–3 September and could say it is at the lodge; they could not say the Picnic is on the
-- 2nd at the pavilion.
--
-- Three columns, all nullable, and no new object of any other kind:
--
--   gathering_templates.default_location   the template's usual place  (item 8)
--   gathering_template_uses.occurs_on      this segment's day          (item 9)
--   gathering_template_uses.location       this segment's place        (item 9)
--
-- ── `default_location` IS COPIED ONTO THE SEGMENT, NEVER READ THROUGH IT ────
-- The same copy-not-reference rule `gathering_tasks.label`, `.help_text`, `.kind` and
-- `.required` follow (20260819000000's header calls it "the one decision that matters
-- most"), and for the same reason one level up: a segment is a thing PEOPLE HAVE BEEN TOLD
-- ABOUT. Editing "Family Picnic" afterwards to say it is usually at Zilker must not
-- silently move a picnic forty relatives have already been given directions to.
--
-- SO THE COPY HAPPENS IN THE APPLICATION, AND THE DATABASE DELIBERATELY DOES NOT DO IT.
-- There is no DEFAULT expression here and no trigger, and §3c ASSERTS that a freshly linked
-- segment comes out with `location IS NULL` rather than pre-filled. A trigger would be the
-- wrong shape twice over: it fires on UPDATE as well as INSERT, so it would re-copy the
-- template's place over an organizer's per-segment edit, and a DEFAULT cannot see the row it
-- is defaulting for.
--
-- WHERE THE WRITERS ARE, NAMED, because a migration's prose is a record a later reader trusts
-- and §3c's assertion is only meaningful beside the code it is asserting the absence of:
--
--   lib/gathering-instantiate.ts   `attachTemplatesToGathering` — the ONE place the copy
--       happens. It writes `occurs_on` and `location` on the use row, falling back to the
--       template's `default_location` when the caller states no place. It is here rather than
--       in one action so that all THREE create paths get it: `createGathering`,
--       `scheduleGathering` and `addGatheringTemplate`.
--   app/actions/admin/gatherings.ts   `addGatheringTemplate` takes optional `occursOn` and
--       `location`; `setGatheringSegment` edits both afterwards, gated
--       `requireEdit('admin/gatherings')` and verifying BOTH ids against the family;
--       `segmentSpanWarning` is the out-of-span sentence.
--   app/actions/admin/gathering-templates.ts   `defaultLocation` on template create and
--       update, and on `GatheringTemplate`.
--
-- ── BOTH `gathering_template_uses` COLUMNS ARE NULLABLE AND MEAN "NOT STATED" ─
-- Not "unknown" and not "the same as the gathering's". A one-day gathering in one place
-- needs neither column, which is most gatherings, and the screen reads exactly as it does
-- today when both are NULL — no date beside the group heading, no place. Every row that
-- exists when this file runs stays valid with no backfill and no judgement call about rows
-- nobody is watching.
--
-- NULLABLE ALSO MEANS THERE IS NOTHING TO ORDER BY SAFELY. Segments keep being ordered by
-- `position`, which is what the organizer arranged them into; `occurs_on` is a fact about
-- one segment rather than the sequence, and a NULLS-FIRST/LAST decision taken here would
-- be a second, disagreeing answer to "what order are these in".
--
-- ── NO CHECK AND NO TRIGGER TYING `occurs_on` INSIDE THE GATHERING'S SPAN ───
-- This is the decision a later reader is most likely to try to "fix", so the argument goes
-- in the file rather than in a commit message.
--
-- A GATHERING'S DATES MOVE. An organizer shifts the weekend, and that is an ordinary edit
-- to `gatherings.starts_on` on the gathering's own form. A CHECK cannot express it at all
-- (the span is on another table), so the constraint would have to be a trigger on BOTH
-- tables — and the moment it existed, moving the reunion from September to October would
-- be REFUSED, with a 23514 naming `gathering_template_uses`: a table the administrator was
-- not looking at, about a row they did not touch, in a message that does not say which
-- segment is at fault. The product's own answer, "shift the weekend and then fix the three
-- segments", becomes unreachable — there is no order of operations that gets you there,
-- because each half refuses while the other is wrong.
--
-- So the rule is CORRECT OR SURFACE, NEVER REFUSE, which is the choice
-- `person_relationships_marriage_is_not_blood` makes in its own way (AGENTS.md §4c: it
-- rewrites 'blood' to 'step' rather than failing an ordinary "add my wife"). Here:
--   * `setGatheringSegment` validates and can say something useful at the point of entry;
--   * `/admin/gatherings/[id]` MARKS a segment whose day falls outside the span, in
--     `--brand-withheld` and never `--destructive` — nothing failed and nothing is an
--     error, the organizer has a date to reconcile.
-- §3c asserts the acceptance in BOTH forms, because it IS the decision: a segment before
-- `starts_on` and a segment after `ends_on` are both stored, and the gathering's dates can
-- then be moved with an out-of-span segment sitting there.
--
-- ── AND NO INDEX ON `occurs_on`, WHICH IS NOT AN OVERSIGHT ──────────────────
-- Every read of this table is already by `gathering_id` (`gathering_template_uses_gathering_idx`
-- is `(gathering_id, position)`) and a gathering holds single digits of segments. Nothing
-- queries "every segment on a date" — the calendar reads `gatherings`, not its parts —
-- so an index here would be a page to maintain for a scan of three rows.
--
-- ── WHAT THIS FILE DOES NOT DO, ASSERTED RATHER THAN DESCRIBED ──────────────
-- 20260819000000 §8i's move: an absence stated in prose is an absence the next migration
-- can end without noticing. Three of them, and §3b is where each is checked.
--
--   NO NEW POLICY. Both tables already carry exactly one SELECT policy —
--   `perm:gathering_template_uses:select` keys on `gatherings:view` and
--   `perm:gathering_templates:select` on `admin/gathering-templates:view` — and a column
--   added to a table is covered by its policies by construction, because a policy is a
--   predicate over the ROW. There is still no INSERT, UPDATE or DELETE policy on either,
--   which is the write boundary that migration chose: every write in this feature runs
--   through `createAdminClient()` in an action that re-applies family scoping by hand
--   (AGENTS.md §3) and lands on the same-family triggers. Editing a segment inline on the
--   organizer screen does NOT change that — `setGatheringSegment` is a server action, not
--   a PATCH from the browser — so anybody tempted to add an UPDATE policy to make inline
--   editing "work" is about to open the table to every approved member of the family.
--
--   NO NEW FUNCTION, AND THEREFORE NO GRANT TO GET WRONG. AGENTS.md §2b's first rule is
--   that adding a function means adding its grant; "none, because there is no function" is
--   an answer that has to be written down or it reads as an oversight. §3b asserts the
--   trigger set on both tables is EXACTLY what 20260819000000 left, which is the same
--   assertion from the other end: a new trigger implies a new function.
--
--   NO `permission_resources` CHANGE. A segment is not a screen and not a band; it is two
--   columns on a row the `gatherings` key already governs, read by the same screens under
--   the same grants. Registering `gatherings/segments` would be a switch nothing consults
--   (AGENTS.md, "declare only the actions something reads"), and — since it would be a
--   NON-admin key — one that resolves view 'any' for every member by default while
--   changing nothing. §3b asserts no key names a segment and that the two keys governing
--   these tables still declare exactly the actions they did.
--
-- ── §8 EMBED ANALYSIS: NOTHING TO ANALYSE, WHICH IS THE POINT ───────────────
-- AGENTS.md §8's sweep is owed after any migration that adds a FOREIGN KEY, because a new
-- path between two tables makes a bare `people(...)` embed somewhere else answer PGRST201
-- and supabase-js hands that back as `[]` with the error discarded. THIS FILE ADDS NO
-- FOREIGN KEY. `default_location` and `location` are free text and `occurs_on` is a DATE —
-- three scalars, no reference, no junction — so no pair of tables gains a path and no embed
-- anywhere can change. That is stated rather than left implicit precisely because the sweep
-- is cheap and the failure is silent: the next author touching this feature should be able
-- to see that this file is not the one that broke their query.
--
-- ── CHECKED BY MUTATION, 2026-08-19 — OBSERVED RESULTS ─────────────────────
-- AGENTS.md §7: a green run is not evidence until it has been seen to fail. Seven
-- mutations, one at a time, each recorded with the error it actually produced.
--
-- HOW EACH WAS APPLIED, because it decides what a pass means. 20260819000000's header
-- records the lesson and it applies here with more force, since every DDL statement in
-- this file is `ADD COLUMN IF NOT EXISTS`:
--   [A] on top of the real run, with the closing `COMMIT` swapped for `ROLLBACK`.
--   [B] as a real `npx supabase db reset` with the mutated file standing in for this one.
--   [C] the SHIPPED §3a predicate run against a deliberately mutated SCHEMA inside a
--       transaction that is then rolled back — `ALTER`/`DROP` the column, run the query, read
--       the message, ROLLBACK.
-- A COLUMN MUTATION MUST BE GROUP B TO PROVE IT FIRES. `ADD COLUMN IF NOT EXISTS` skips a
-- column that is already there, so deleting or retyping one of the three and re-running on
-- top of the real chain changes nothing at all and reports a false pass. Anybody adding an
-- entry to this list has to decide which group it belongs in before believing its result.
-- GROUP C PROVES SOMETHING DIFFERENT AND NARROWER: not that the assertion fires, but WHAT IT
-- SAYS WHEN IT DOES. It is the cheap way to keep the transcribed messages below honest, and
-- it is not a substitute for [B].
--
-- m1, m2 AND m3's RECORDED MESSAGES WERE CORRECTED ON 2026-08-19, and how they were corrected
-- matters. The first transcription predated the `column_default IS NULL` clause and the
-- `/no default` field in §3a's `format` string, so all three quoted a message the shipped
-- assertion cannot produce — which meant the NO-DEFAULT half of the assertion, the half the
-- header argues hardest for, had never itself been seen to say anything. The [B] runs stand as
-- the evidence that these three FIRE, and they still do: §3a only ever gained a conjunct, and a
-- mutation that trips a looser predicate trips a stricter one. What is new is the [C] column,
-- which is where the strings below came from — copied from psql output against the file as it
-- ships, not predicted.
--
--   m1  the `default_location` ALTER deleted entirely                 [B fires][C] TRIPS
--         → ERROR: ROLLBACK: column(s) missing or of the wrong shape:
--           gathering_templates.default_location (want text/YES/no default, have absent)
--   m2  `occurs_on` created NOT NULL DEFAULT CURRENT_DATE             [B fires][C] TRIPS
--         → ERROR: ROLLBACK: column(s) missing or of the wrong shape:
--           gathering_template_uses.occurs_on
--           (want date/YES/no default, have date/NO/default CURRENT_DATE)
--         BOTH DEFECTS IN ONE MESSAGE, which is why the assertion tests three things per
--         column rather than one: `date/NO` is the NOT NULL and `default CURRENT_DATE` is the
--         default, and the second is the one that would give every existing segment the day
--         this file was deployed. Caught by the CATALOGUE half. The probe would also have
--         tripped on the accepts-NULL step, one assertion later; both are kept, because the
--         catalogue half is what says WHICH column and the probe is what says the column
--         still behaves (20260817000008's m5/m5b pair, one file across).
--   m3  `occurs_on` created TEXT rather than DATE                     [B fires][C] TRIPS
--         → ERROR: ROLLBACK: column(s) missing or of the wrong shape:
--           gathering_template_uses.occurs_on
--           (want date/YES/no default, have text/YES/no default)
--         Worth an entry of its own: a date stored as text passes every behavioural probe
--         in this file — '2026-09-02' assigns, reads back and compares — and is exactly
--         the shape AGENTS.md §7c warns about, where the arithmetic goes wrong later and
--         somewhere else. Only the type assertion catches it.
--   m4  a CHECK added tying occurs_on inside the gathering's span             [A] TRIPS
--         (as a trigger, since a CHECK cannot reach another table — this is the
--         "fix" the header refuses, in the form somebody would actually write it)
--         → ROLLBACK: unexpected trigger(s) on the segment tables:
--           gathering_template_uses.gathering_template_uses_within_span
--         And with the catalogue assertion removed as well, so the probe was reached:
--         → ROLLBACK: a segment dated before its gathering's starts_on was refused
--   m5  a trigger added copying default_location onto the use row            [A] TRIPS
--         → ROLLBACK: unexpected trigger(s) on the segment tables:
--           gathering_template_uses.gathering_template_uses_copy_location
--         And with the catalogue assertion removed:
--         → ROLLBACK: the database pre-filled a segment's location from the template.
--           The copy belongs to addGatheringTemplate — see the header
--   m6  an UPDATE policy added to gathering_template_uses (the "make inline
--       editing work from the browser" change)                               [A] TRIPS
--         → ROLLBACK: 1 write policy(ies) on the segment tables:
--           gathering_template_uses.perm:gathering_template_uses:update
--   m7  a `gatherings/segments` resource registered                          [A] TRIPS
--         → ROLLBACK: permission_resources names a segment key: gatherings/segments
--
-- IDEMPOTENT. Three `ADD COLUMN IF NOT EXISTS`, three `COMMENT ON COLUMN` (which are
-- unconditional replacements), and a verify block whose probe removes everything it makes.
-- Applies to an empty database: the probe creates its own throwaway family and the
-- catalogue assertions read the catalogue, not the data.
--
-- HOW THIS REACHES A DATABASE
--   `supabase db push`, from CI on merge to master — never `psql -f` by hand, which
--   records nothing and can replay this file out of order. See AGENTS.md, "How migrations
--   reach the hosted project".
-- ============================================================================

BEGIN;

-- ── 1. The template's usual place ───────────────────────────────────────────
-- TEXT and nullable, exactly like `gatherings.location`, which it feeds. Not an
-- `addresses` reference and not structured: a segment's place is "the pavilion by the
-- lake" or "Nana's back garden" as often as it is a street address, and every existing
-- place field in this feature is one line of free text. A structured venue is a different
-- product decision and would want its own table.
ALTER TABLE public.gathering_templates
  ADD COLUMN IF NOT EXISTS default_location TEXT;

COMMENT ON COLUMN public.gathering_templates.default_location IS
  'The place this template''s segment is usually held, offered as a DEFAULT when the '
  'template is added to a gathering. COPIED onto gathering_template_uses.location by '
  'attachTemplatesToGathering (lib/gathering-instantiate.ts), which is the one place it '
  'happens and is therefore shared by all three create paths, and never read back through '
  'template_id — the same copy-not-reference rule gathering_tasks.label follows, and for the '
  'same reason: editing the template afterwards must not silently move an event people have '
  'already been told about. There is deliberately no trigger and no DEFAULT expression doing '
  'the copy; 20260819000001 §3c asserts a freshly linked segment comes out NULL when the '
  'application does not put a value there.';

-- ── 2. The segment's day and place ──────────────────────────────────────────
-- One `ALTER` for the pair, as 20260817000008 does for `region_id`/`chapter_id`: they are
-- one idea (this segment, on this day, in this place) and a reader should not have to
-- check whether the second statement is somewhere further down.
--
-- NO DEFAULT ON EITHER. `occurs_on DATE DEFAULT CURRENT_DATE` would look helpful and would
-- give every segment of every existing gathering the day this migration was deployed —
-- a stored fact that was never true, printed on the organizer's screen beside a task list
-- that has been right for months. NULL is "not stated", and the screen renders nothing.
ALTER TABLE public.gathering_template_uses
  ADD COLUMN IF NOT EXISTS occurs_on DATE,
  ADD COLUMN IF NOT EXISTS location  TEXT;

COMMENT ON COLUMN public.gathering_template_uses.occurs_on IS
  'The day THIS SEGMENT happens, or NULL for "not stated" — a one-day gathering in one '
  'place needs neither this nor location. DELIBERATELY NOT CONSTRAINED to fall inside the '
  'gathering''s starts_on..ends_on span, by CHECK or by trigger: a gathering''s dates move, '
  'and a constraint would then refuse an ordinary edit to gatherings.starts_on with a '
  '23514 naming this table — one the administrator was not looking at. setGatheringSegment and '
  'addGatheringTemplate (app/actions/admin/gatherings.ts) validate the day through the same '
  'normalizeDate the gathering''s own dates use, return segmentSpanWarning''s sentence beside '
  'success, and /admin/gatherings/[id] MARKS an out-of-span segment in --brand-withheld '
  '(nothing failed; there is a date to reconcile). Correct or surface, never refuse. '
  'Segments are still ordered by `position`, never by this column.';

COMMENT ON COLUMN public.gathering_template_uses.location IS
  'Where THIS SEGMENT is held, or NULL for "not stated" — the Welcome at the lodge and the '
  'Picnic at the pavilion, inside one reunion. Copied from '
  'gathering_templates.default_location by addGatheringTemplate at the moment the template '
  'is linked, then owned by the segment: re-reading the template would let a later edit to '
  'it move an event people have been told about.';

-- ── 3. Verify ───────────────────────────────────────────────────────────────
-- Catalogue reads FIRST and unconditionally, so this cannot report success by skipping
-- (AGENTS.md: "a verify block that can skip must not be the only check"). Then a real
-- BEHAVIOUR probe, because a catalogue-only assertion passes over a column that has been
-- quietly given a default, a NOT NULL or a trigger — 20260817000008's m5/m5b pair — and
-- because the acceptance this file is ABOUT (a segment outside its gathering's span) is
-- not visible in any catalogue at all.
--
-- NO `families` ROW IS CREATED, following 20260819000000: every table the probe touches
-- carries `family_code` as free text with no foreign key to `families`, so a throwaway
-- family needs no `families` row — and therefore leaves no permission templates, no
-- visibility rows and no system Donations fund to unpick. `created_by` is left NULL, which
-- needs no `auth.users` row: requiring a fixture is what let 20260806000012's verify block
-- skip itself into a false pass.
DO $mig$
DECLARE
  v_code    CONSTANT text := 'ZZSEGMENT';
  v_missing text;
  v_names   text;
  v_bad     int;
  v_tmpl    uuid;
  v_tmpl2   uuid;
  v_g       uuid;
  v_use     uuid;
  v_loc     text;
  v_on      date;
  v_stamped timestamptz;
BEGIN
  -- ── 3a. The three columns, by name, with the type and nullability each must have ──
  -- Nullability is asserted as hard as the type: NULL is the whole meaning of "not
  -- stated", and a NOT NULL added later would force every existing segment to claim a day.
  -- `format` prints what was WANTED beside what was FOUND, so a wrong type and an absent
  -- column produce different messages rather than one that could mean either.
  SELECT string_agg(
           format('%s.%s (want %s/%s/no default, have %s)', c.tbl, c.col, c.typ, c.nullable,
                  COALESCE((SELECT ic.data_type || '/' || ic.is_nullable || '/'
                                   || COALESCE('default ' || ic.column_default, 'no default')
                              FROM information_schema.columns ic
                             WHERE ic.table_schema = 'public'
                               AND ic.table_name = c.tbl AND ic.column_name = c.col),
                           'absent')),
           ', ' ORDER BY c.tbl, c.col)
    INTO v_missing
    FROM (VALUES
      ('gathering_templates',     'default_location', 'text', 'YES'),
      ('gathering_template_uses', 'occurs_on',        'date', 'YES'),
      ('gathering_template_uses', 'location',         'text', 'YES')
    ) AS c(tbl, col, typ, nullable)
   WHERE NOT EXISTS (
     SELECT 1 FROM information_schema.columns ic
      WHERE ic.table_schema = 'public' AND ic.table_name = c.tbl
        AND ic.column_name = c.col
        AND ic.data_type = c.typ
        AND ic.is_nullable = c.nullable
        AND ic.column_default IS NULL
   );
  IF v_missing IS NOT NULL THEN
    RAISE EXCEPTION 'ROLLBACK: column(s) missing or of the wrong shape: %', v_missing;
  END IF;

  -- ── 3b. The three absences, ASSERTED ──
  -- Each one is a decision in the header, and 20260819000000 §8i's argument is why they
  -- are here rather than only up there: an absence described in prose is an absence the
  -- next migration ends without noticing.

  -- No constraint anywhere on either table mentions one of the three new columns. That is
  -- the span rule stated from the catalogue side — a CHECK cannot reach `gatherings`, so
  -- the only shape this could take is a nonsense one-table CHECK, and it must not exist
  -- either. Matched on `pg_get_constraintdef` rather than on a name, because the name is
  -- the one thing an author choosing to add it gets to pick.
  SELECT string_agg(format('%s.%s', c.relname, con.conname), ', ' ORDER BY c.relname, con.conname)
    INTO v_names
    FROM pg_constraint con
    JOIN pg_class c ON c.oid = con.conrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
   WHERE n.nspname = 'public'
     AND c.relname IN ('gathering_templates', 'gathering_template_uses')
     AND pg_get_constraintdef(con.oid) ~ '(occurs_on|default_location|location)';
  IF v_names IS NOT NULL THEN
    RAISE EXCEPTION
      'ROLLBACK: constraint(s) reference the new segment columns: %. A gathering''s dates '
      'move, so nothing may refuse a segment outside its span — see the header.', v_names;
  END IF;

  -- The trigger set on both tables is EXACTLY what 20260819000000 left. This is three
  -- assertions in one: no span trigger, no trigger copying `default_location` onto the
  -- segment (the copy is addGatheringTemplate's, so that it happens ONCE), and — since a
  -- new trigger implies a new function — nothing this file would owe a GRANT for
  -- (AGENTS.md §2b). `tgisinternal` is excluded: RI triggers are Postgres's own.
  SELECT string_agg(format('%s.%s', c.relname, tg.tgname), ', ' ORDER BY c.relname, tg.tgname)
    INTO v_names
    FROM pg_trigger tg
    JOIN pg_class c ON c.oid = tg.tgrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
   WHERE n.nspname = 'public'
     AND c.relname IN ('gathering_templates', 'gathering_template_uses')
     AND NOT tg.tgisinternal
     AND tg.tgname NOT IN ('gathering_templates_updated_at',
                           'gathering_template_uses_updated_at',
                           'gathering_template_uses_same_family');
  IF v_names IS NOT NULL THEN
    RAISE EXCEPTION 'ROLLBACK: unexpected trigger(s) on the segment tables: %', v_names;
  END IF;

  -- And the three that MUST be there still are, so the assertion above cannot be satisfied
  -- by a table that has lost its guards altogether.
  SELECT string_agg(t.want, ', ' ORDER BY t.want) INTO v_missing
    FROM (VALUES
      ('gathering_templates',     'gathering_templates_updated_at'),
      ('gathering_template_uses', 'gathering_template_uses_updated_at'),
      ('gathering_template_uses', 'gathering_template_uses_same_family')
    ) AS t(tbl, want)
   WHERE NOT EXISTS (
     SELECT 1 FROM pg_trigger tg
       JOIN pg_class c ON c.oid = tg.tgrelid
       JOIN pg_namespace n ON n.oid = c.relnamespace
      WHERE n.nspname = 'public' AND c.relname = t.tbl
        AND tg.tgname = t.want AND NOT tg.tgisinternal
   );
  IF v_missing IS NOT NULL THEN
    RAISE EXCEPTION 'ROLLBACK: trigger(s) missing from the segment tables: %', v_missing;
  END IF;

  -- Exactly one SELECT policy per table, still named `perm:<table>:select`, and no write
  -- policy on either. The name matters as much as the count: `perm:` is what
  -- 20260618000001's sweep skips and what audit_policy_shadowing.sql tests. And a write
  -- policy is what somebody adds to make inline segment editing work from the browser,
  -- which would open the table to every approved member — the writes are server actions on
  -- the admin client and always were.
  SELECT string_agg(t.name, ', ' ORDER BY t.name) INTO v_missing
    FROM (VALUES ('gathering_templates'), ('gathering_template_uses')) AS t(name)
   WHERE NOT EXISTS (
     SELECT 1 FROM pg_policies
      WHERE schemaname = 'public' AND tablename = t.name AND cmd = 'SELECT'
        AND policyname = 'perm:' || t.name || ':select'
   );
  IF v_missing IS NOT NULL THEN
    RAISE EXCEPTION 'ROLLBACK: perm:<table>:select is missing on: %', v_missing;
  END IF;

  SELECT COUNT(*), string_agg(tablename || '.' || policyname, ', ' ORDER BY tablename, policyname)
    INTO v_bad, v_names
    FROM pg_policies
   WHERE schemaname = 'public'
     AND tablename IN ('gathering_templates', 'gathering_template_uses')
     AND cmd <> 'SELECT';
  IF v_bad > 0 THEN
    RAISE EXCEPTION 'ROLLBACK: % write policy(ies) on the segment tables: %', v_bad, v_names;
  END IF;

  -- No `permission_resources` change. A segment is two columns on a row the `gatherings`
  -- key already governs, so registering one would be a switch nothing consults — and, being
  -- a non-admin key, one that resolves view 'any' for everybody by default while changing
  -- nothing at all.
  SELECT string_agg(key, ', ' ORDER BY key) INTO v_names
    FROM public.permission_resources WHERE key ILIKE '%segment%';
  IF v_names IS NOT NULL THEN
    RAISE EXCEPTION 'ROLLBACK: permission_resources names a segment key: %', v_names;
  END IF;

  -- And the two keys that DO govern these tables still declare exactly the actions
  -- 20260819000000 §5 gave them — so "no catalogue change" covers a narrowing as well as
  -- an addition. `gatherings` declares view+create only (nothing reads its edit or delete;
  -- every mutation gates on `admin/gatherings`), and `admin/gathering-templates` all four.
  SELECT string_agg(format('%s (%s)', k.key, k.actions), ', ' ORDER BY k.key) INTO v_missing
    FROM (VALUES
      ('gatherings',                ARRAY['view','create']::TEXT[]),
      ('admin/gathering-templates', ARRAY['view','create','edit','delete']::TEXT[])
    ) AS k(key, actions)
   WHERE NOT EXISTS (
     SELECT 1 FROM public.permission_resources pr
      WHERE pr.key = k.key AND pr.actions = k.actions
   );
  IF v_missing IS NOT NULL THEN
    RAISE EXCEPTION 'ROLLBACK: the keys governing the segment tables no longer declare: %', v_missing;
  END IF;

  -- The map rows are unchanged too, which is what keeps `perm:*:select` composed from the
  -- same expressions: `gathering_template_uses` is governed by `gatherings` and
  -- `gathering_templates` by `admin/gathering-templates` (20260819000000 §5c).
  SELECT string_agg(format('%s -> %s', m.table_name, m.resource_key), ', ' ORDER BY m.table_name)
    INTO v_names
    FROM public.permission_table_map m
   WHERE m.table_name IN ('gathering_templates', 'gathering_template_uses')
     AND (m.table_name, m.resource_key) NOT IN (
       ('gathering_templates', 'admin/gathering-templates'),
       ('gathering_template_uses', 'gatherings'));
  IF v_names IS NOT NULL THEN
    RAISE EXCEPTION 'ROLLBACK: the segment tables are mapped to unexpected keys: %', v_names;
  END IF;

  -- No column-level narrowing was written, and this asserts the STATUS QUO deliberately.
  -- 20260819000000's header measured the whole argument on the live stack: `pg_default_acl`
  -- hands every new `public` table `authenticated=arwdDxtm`, a GRANT is additive and cannot
  -- take that away, and a table-level REVOKE to make a column list bite would break shipped
  -- user-client reads on hosted while every local check stayed green because seed.sql had
  -- put the grant back. So the honest position is that these three columns are readable
  -- exactly as their tables are — and asserting it is what stops a future author writing a
  -- column grant here and believing it protects something.
  SELECT string_agg(format('%s.%s', c.tbl, c.col), ', ' ORDER BY c.tbl, c.col) INTO v_names
    FROM (VALUES
      ('gathering_templates',     'default_location'),
      ('gathering_template_uses', 'occurs_on'),
      ('gathering_template_uses', 'location')
    ) AS c(tbl, col)
   WHERE has_column_privilege('authenticated', ('public.' || c.tbl)::regclass, c.col, 'SELECT')
     IS DISTINCT FROM has_table_privilege('authenticated', ('public.' || c.tbl)::regclass, 'SELECT');
  IF v_names IS NOT NULL THEN
    RAISE EXCEPTION
      'ROLLBACK: column privilege on % differs from its table''s. A column list here is not '
      'a protection — see the header and 20260819000000''s.', v_names;
  END IF;

  -- ── 3c. THE PROBE: the columns, for real, and the acceptance that IS the decision ──
  INSERT INTO public.gathering_templates (family_code, name, default_location)
  VALUES (v_code, 'Probe Welcome', 'The lodge porch') RETURNING id INTO v_tmpl;
  INSERT INTO public.gathering_templates (family_code, name)
  VALUES (v_code, 'Probe Send Off') RETURNING id INTO v_tmpl2;

  -- default_location takes a value and takes NULL. The second half is not padding: the
  -- template form leaves it empty far more often than it fills it in, and a NOT NULL added
  -- by a later "tidy-up" would make every existing template unsaveable.
  SELECT default_location INTO v_loc FROM public.gathering_templates WHERE id = v_tmpl;
  IF v_loc IS DISTINCT FROM 'The lodge porch' THEN
    RAISE EXCEPTION 'ROLLBACK: gathering_templates.default_location did not store its value (read back %)',
      COALESCE(v_loc, 'NULL');
  END IF;
  IF (SELECT default_location FROM public.gathering_templates WHERE id = v_tmpl2) IS NOT NULL THEN
    RAISE EXCEPTION 'ROLLBACK: a template created without a default_location did not come out NULL';
  END IF;
  UPDATE public.gathering_templates SET default_location = NULL WHERE id = v_tmpl;
  IF (SELECT default_location FROM public.gathering_templates WHERE id = v_tmpl) IS NOT NULL THEN
    RAISE EXCEPTION 'ROLLBACK: default_location refused to be cleared';
  END IF;
  UPDATE public.gathering_templates SET default_location = 'The lodge porch' WHERE id = v_tmpl;

  -- A three-day gathering, which is what makes "outside the span" meaningful below.
  INSERT INTO public.gatherings (family_code, title, starts_on, ends_on)
  VALUES (v_code, 'Probe Reunion', '2026-09-01', '2026-09-03') RETURNING id INTO v_g;

  -- THE DATABASE DOES NOT COPY. The segment is linked to a template that HAS a
  -- default_location, and it must come out NULL — the copy is addGatheringTemplate's, so
  -- that it happens once, at the moment the organizer chose it, and never again over an
  -- edit they have since made.
  INSERT INTO public.gathering_template_uses (family_code, gathering_id, template_id, position)
  VALUES (v_code, v_g, v_tmpl, 0) RETURNING id INTO v_use;

  SELECT location, occurs_on INTO v_loc, v_on
    FROM public.gathering_template_uses WHERE id = v_use;
  IF v_loc IS NOT NULL THEN
    RAISE EXCEPTION
      'ROLLBACK: the database pre-filled a segment''s location from the template. The copy '
      'belongs to addGatheringTemplate — see the header';
  END IF;
  IF v_on IS NOT NULL THEN
    RAISE EXCEPTION 'ROLLBACK: a freshly linked segment came out with a day already set (%)', v_on;
  END IF;

  -- Both columns take a value. The UPDATE path is also what proves
  -- `gathering_template_uses_same_family` still ACCEPTS an ordinary segment edit: that
  -- trigger fires BEFORE INSERT OR UPDATE, so `setGatheringSegment` runs through it on
  -- every save. Its cross-family half is 20260819000000's probe and is not re-run here.
  UPDATE public.gathering_template_uses
     SET occurs_on = '2026-09-02', location = 'The pavilion by the lake'
   WHERE id = v_use;
  SELECT location, occurs_on INTO v_loc, v_on
    FROM public.gathering_template_uses WHERE id = v_use;
  IF v_on IS DISTINCT FROM DATE '2026-09-02'
     OR v_loc IS DISTINCT FROM 'The pavilion by the lake' THEN
    RAISE EXCEPTION 'ROLLBACK: a segment did not store its day and place (read back %, %)',
      COALESCE(v_on::text, 'NULL'), COALESCE(v_loc, 'NULL');
  END IF;

  -- And both take NULL back, which is "not stated" — the organizer removing a day they had
  -- entered, and a one-day gathering in one place needing neither.
  UPDATE public.gathering_template_uses SET occurs_on = NULL, location = NULL WHERE id = v_use;
  SELECT location, occurs_on INTO v_loc, v_on
    FROM public.gathering_template_uses WHERE id = v_use;
  IF v_on IS NOT NULL OR v_loc IS NOT NULL THEN
    RAISE EXCEPTION 'ROLLBACK: a segment refused to have its day or place cleared';
  END IF;

  -- ── THE DECISION, ASSERTED IN BOTH DIRECTIONS ──
  -- A segment outside the gathering's span IS ACCEPTED. Written as an assertion rather
  -- than left implied, because "no constraint exists" and "an out-of-span day is stored"
  -- are different claims and only the second is the product's behaviour: the organizer
  -- screen marks it, the action explains it, and the database keeps it.
  UPDATE public.gathering_template_uses SET occurs_on = '2026-08-01' WHERE id = v_use;
  IF (SELECT occurs_on FROM public.gathering_template_uses WHERE id = v_use)
     IS DISTINCT FROM DATE '2026-08-01' THEN
    RAISE EXCEPTION 'ROLLBACK: a segment dated before its gathering''s starts_on was refused';
  END IF;

  UPDATE public.gathering_template_uses SET occurs_on = '2026-12-25' WHERE id = v_use;
  IF (SELECT occurs_on FROM public.gathering_template_uses WHERE id = v_use)
     IS DISTINCT FROM DATE '2026-12-25' THEN
    RAISE EXCEPTION 'ROLLBACK: a segment dated after its gathering''s ends_on was refused';
  END IF;

  -- AND THE EDIT THE CONSTRAINT WOULD HAVE BROKEN. This is the whole argument in the
  -- header, run: with a segment sitting on 25 December, the organizer shifts the reunion
  -- from September to October. A span trigger would refuse this with a 23514 naming
  -- `gathering_template_uses` — a table they were not looking at, about a row they did not
  -- touch — and there would be no order of operations that reached the state they want.
  UPDATE public.gatherings SET starts_on = '2026-10-01', ends_on = '2026-10-03' WHERE id = v_g;
  IF (SELECT starts_on FROM public.gatherings WHERE id = v_g) IS DISTINCT FROM DATE '2026-10-01' THEN
    RAISE EXCEPTION 'ROLLBACK: a gathering''s dates could not be moved with an out-of-span segment';
  END IF;

  -- The same edit in the other shape: back to a single day (ends_on NULL), which narrows
  -- the span to nothing while the segment stays where it is.
  UPDATE public.gatherings SET ends_on = NULL WHERE id = v_g;
  IF (SELECT ends_on FROM public.gatherings WHERE id = v_g) IS NOT NULL THEN
    RAISE EXCEPTION 'ROLLBACK: a gathering could not be narrowed to one day with an out-of-span segment';
  END IF;

  -- `set_updated_at` still fires on both tables after the ALTER. Testing
  -- `updated_at > created_at` cannot work inside one migration — NOW() is the transaction
  -- timestamp, so both are the same instant — so what proves the trigger ran is that a
  -- value written by hand does not survive. Cheap, and it is the assertion that would catch
  -- an `ALTER TABLE … DISABLE TRIGGER` left behind by an experiment.
  UPDATE public.gathering_template_uses SET updated_at = '2000-01-01T00:00:00Z' WHERE id = v_use;
  SELECT updated_at INTO v_stamped FROM public.gathering_template_uses WHERE id = v_use;
  IF v_stamped <> NOW() THEN
    RAISE EXCEPTION 'ROLLBACK: set_updated_at did not fire on gathering_template_uses (updated_at is %)', v_stamped;
  END IF;
  UPDATE public.gathering_templates SET updated_at = '2000-01-01T00:00:00Z' WHERE id = v_tmpl;
  SELECT updated_at INTO v_stamped FROM public.gathering_templates WHERE id = v_tmpl;
  IF v_stamped <> NOW() THEN
    RAISE EXCEPTION 'ROLLBACK: set_updated_at did not fire on gathering_templates (updated_at is %)', v_stamped;
  END IF;

  -- ── Cleanup ──
  -- Children before parents, and `gathering_template_uses` before `gathering_templates`
  -- specifically: `template_id` there is NO ACTION, which is the whole reason a used
  -- template cannot be deleted. Deleting the gathering would cascade the use away anyway;
  -- doing it explicitly is what makes the omission visible if a table is added later.
  DELETE FROM public.gathering_template_uses WHERE family_code = v_code;
  DELETE FROM public.gatherings             WHERE family_code = v_code;
  DELETE FROM public.gathering_templates    WHERE family_code = v_code;

  SELECT COUNT(*) INTO v_bad FROM (
    SELECT 1 FROM public.gathering_template_uses WHERE family_code = v_code
    UNION ALL SELECT 1 FROM public.gatherings          WHERE family_code = v_code
    UNION ALL SELECT 1 FROM public.gathering_templates WHERE family_code = v_code
  ) d;
  IF v_bad > 0 THEN
    RAISE EXCEPTION 'ROLLBACK: the segment probe left % row(s) behind', v_bad;
  END IF;

  RAISE NOTICE 'gathering segments verified: 3 nullable columns with no default, no constraint '
    'or trigger tying a segment to its gathering''s span, no write policy and no new '
    'permission_resources key, the database NOT pre-filling a segment''s location from its '
    'template, a segment stored both before starts_on and after ends_on, the gathering''s '
    'dates then moved and narrowed with that segment in place, and set_updated_at still '
    'firing on both tables. Probe family % removed.', v_code;
END $mig$;

COMMIT;
