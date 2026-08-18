-- ============================================================================
-- A dues schedule belongs to the whole family, to one region, or to one chapter.
--
-- ── WHY A FAMILY NEEDS THIS ─────────────────────────────────────────────────
-- Regions & Chapters ships again in this change, and a chapter that cannot bill is an
-- address book. The whole reason a family of a hundred and forty splits itself into
-- chapters is that the Texas chapter rents a hall the Georgia chapter never sees, and the
-- Eastern region runs a scholarship its own members fund. Until now every dues schedule
-- was owed by every member, so that money was collected by hand and off the books.
--
-- Nothing else in this table can say it. The four things that already narrow a due each
-- answer a different question:
--
--   required = false   the MEMBER may decline it. Their choice, not the family's rule.
--   start_age          a child grows into it. On a timer.
--   bloodline_only     the descendants owe it and those who married in do not.
--   beneficiaries      donations only, and it HIDES a drive rather than un-owing it.
--
-- WHERE somebody lives is orthogonal to all four, and composes with each: a Texas
-- chapter due can still be optional, still start at 18, and still be the bloodline's.
--
-- ── NATIONAL ALWAYS EXISTS, ON EVERY TIER, AND EVERYTHING POINTS AT IT ──────
-- This is the requirement, and the schema makes it fall out rather than enforcing it:
--
--   * **National is the ABSENCE of a region, not a row.** `regions` has never held a
--     "National" row — 20260604000005's own header says so, `createRegion` refuses the
--     name as reserved, and the admin screen renders National as a fixed group above the
--     regions a family made. So there is nothing to seed, nothing that can be deleted by
--     accident, and nothing to tier-gate.
--   * **`DEFAULT 'national'` decides the backfill by not having one.** Every schedule that
--     exists when this file runs becomes National, which is exactly what every one of them
--     already meant: owed by everybody. No UPDATE, and therefore no judgement call about
--     rows nobody is watching.
--   * **A Free family cannot reach a region or a chapter to point at.** `/admin/chapters`
--     is `tier: 'plus'` in lib/features.ts, so `requireView` sends a Free family to
--     /upgrade; with no regions and no chapters, `getDuesScopeOptions()` offers National
--     alone and the form has one option. Every schedule in a Free family is therefore
--     National by construction, with no tier test anywhere in this file.
--   * **And a family that DOWNGRADES keeps its scoped schedules.** No policy here consults
--     `families.tier` and none may — AGENTS.md is explicit that a tier withholds SCREENS
--     and never rows. A lapsed family loses the screen that edits the scope and keeps
--     billing exactly who it was billing.
--
-- ── WHO OWES A SCOPED DUE ───────────────────────────────────────────────────
--   national    everyone who would otherwise owe it. Today's behaviour, unchanged.
--   regional    only members whose CHAPTER'S REGION is this region.
--   chapter     only members in this chapter.
--
-- A MEMBER WITH NO CHAPTER IS UNDER NATIONAL. They owe every national due and no regional
-- or chapter one — which is the only coherent answer (there is no region to compare
-- against) and is also the safe direction: an unplaced member is never billed for a hall
-- they do not use. `duesScopeMatch` in lib/dues-utils.ts is where that rule lives in one
-- place, and /help's Regions & Chapters chapter is where a family reads it.
--
-- ── A MEMBER'S REGION IS DERIVED, AND THERE IS NO `people.region_id` ────────
-- `people.chapter_id -> chapters.region_id`, walked at read time. Do not add a region
-- column to `people`: it would be a second copy of a fact `chapters` already holds, and it
-- would go wrong silently the moment a chapter moves between regions — which
-- `setChapterRegion` now makes an ordinary act. Same argument as `is_minor`
-- (20260813000006) and as `people.is_blood` never existing (AGENTS.md §4c): a stored answer
-- to a derived question is wrong from the first edit nobody re-ran.
--
-- ── THE TWO COLUMNS ARE MUTUALLY EXCLUSIVE, AND A CHECK SAYS SO ─────────────
-- `scope` is not decoration on top of two nullable ids — it is what the row MEANS, and
-- without the invariant below there are eight combinations of three fields for three
-- legitimate states. A row reading `scope = 'chapter'` with a region_id and no chapter_id
-- is not a bug anybody would see: it would bill the region and the screen would say
-- "chapter".
--
-- ── THE FOREIGN KEYS ARE `NO ACTION`, DELIBERATELY ─────────────────────────
-- lib/money-attached.ts rejects `ON DELETE RESTRICT` as a guard, on the grounds that it
-- makes a record permanently undeletable with a bare 23503 for a message. That reasoning
-- does NOT transfer here, and the difference is worth stating because it looks like the
-- same decision:
--
--   * There is no "orphan quietly" option to choose instead. `ON DELETE SET NULL` on
--     `region_id` would leave `scope = 'regional', region_id = NULL`, which the invariant
--     below refuses — so the delete fails either way, and it fails with a CHECK violation
--     naming a column nobody touched instead of a foreign key naming the region.
--   * The record is not permanently undeletable. Re-scope the schedule to National — one
--     control on the Accounting form — and the region deletes.
--
-- So the FK is the backstop and `lib/scope-attached.ts` is the sentence: `deleteRegion`
-- and `deleteChapter` count what points at the row first and refuse with a message naming
-- it, exactly as `deleteDuesSchedule` does with `moneyAttachedTo`.
--
-- ── SCOPE JOINS THE FROZEN TERMS ───────────────────────────────────────────
-- 20260807000001 freezes a due's start date, amount and frequency once the ledger has been
-- posted against it, because each payment was made against those terms. Scope belongs in
-- that set for a stronger reason than any of them: moving a due from National to one
-- chapter does not restate what a member owed, it restates WHETHER THEY OWED IT AT ALL for
-- periods already billed — so last March's payment by a Georgia member becomes a payment
-- against a Texas-only due, and every projection of that period changes shape.
--
-- WHILE HERE, `start_age` AND `bloodline_only` JOIN IT TOO, and that is a repair rather
-- than a widening. `updateDuesSchedule` has refused to move either of them on a used
-- schedule since each shipped, and its message says so in words a treasurer reads — but
-- the trigger's `v_terms_moved` never named them, so the action was the ONLY guard on a
-- write that goes through the service-role client. AGENTS.md's line about this file is
-- that the database is "the one that decides"; for those two it was not.
--
-- ── NO POLICY, NO FUNCTION, NO GRANT ───────────────────────────────────────
-- This withholds no rows. It changes what one member OWES, computed in `getMyDuesSummary`
-- and `getDuesProjection` out of a schedule, a chapter and a ledger — there is nothing for
-- RLS to filter and no family boundary it could be crossed through. Same reasoning
-- 20260814000000 recorded for `start_age` and 20260817000002 for `bloodline_only`.
--
-- The family boundary on the two new ids is the app's, and it is AGENTS.md §4 rather than
-- §3: a row carrying the caller's own `family_code` satisfies every policy above while the
-- `region_id` written onto it points into another family. `createDuesSchedule` and
-- `updateDuesSchedule` both call `belongsToFamily` on each id, and tests/rls has a case
-- per id — which the "NOT COVERED" note at the foot of cases.mjs used to excuse on the
-- grounds that `createDuesSchedule` had no foreign id to supply. It has two now.
--
-- ── §8: TWO NEW FOREIGN KEYS, AND WHICH EMBEDS THEY COULD HAVE BROKEN ──────
-- AGENTS.md §8's second-order lesson is that adding a table with two foreign keys breaks
-- bare embeds on tables you did not touch — `announcement_unpins` made every
-- `announcements`+`people` query answer PGRST201, which is to say `[]`, on pages nobody had
-- edited. `dues_schedules` now has foreign keys to BOTH `regions` and `chapters`, and
-- `chapters.region_id` already joins that same pair, so this is exactly that shape.
--
-- IT DOES NOT BREAK, AND THE REASON IS WORTH WRITING DOWN because the rule as stated in
-- AGENTS.md would predict otherwise. PostgREST infers a many-to-many only where the
-- junction's two foreign-key columns ARE its primary key. `announcement_unpins` is
-- `PRIMARY KEY (announcement_id, person_id)`; `dues_schedules` has a surrogate `id`, as
-- does `user_roles` — which has held foreign keys to `chapters` AND `regions` since
-- 20260610000008 without ever making `chapters(… regions(name) …)` ambiguous.
--
-- Measured against the live schema after applying this file, not reasoned about: the bare
-- `chapters?select=regions(name)`, `announcements?select=chapters(name)` and
-- `people?select=chapters(name)` embeds all still resolve. `getChapters()` names its
-- constraint anyway — `regions!chapters_region_id_fkey(name)` — because the cost of being
-- explicit is nil and the failure mode is a silent empty list.
--
-- ── NO INDEX ON EITHER COLUMN, AND WHY THAT IS NOT AN OVERSIGHT ────────────
-- PostgreSQL does not index the referencing side of a foreign key automatically, so a
-- `DELETE FROM regions` scans `dues_schedules`. That table holds single digits of rows per
-- family and tens of thousands across the product; the scan is cheaper than the index page
-- it would need. `dues_schedules_family_kind_idx` is the one index it has, and it is there
-- because every read filters on both of those columns.
--
-- ── CHECKED BY MUTATION, per AGENTS.md §7 ──────────────────────────────────
-- A green verify block is not evidence until it has been seen to fail. Seven copies of
-- this file, one line changed in each, replayed with `psql -f`; every one aborted, and the
-- clean file prints its NOTICE. Observed output, not expected:
--
--   m1  the targets CHECK is never created
--         ERROR: scope constraint(s) not created: dues_schedules_scope_targets
--   m2  the targets CHECK forgets `AND chapter_id IS NULL` on the regional branch
--         ERROR: a regional schedule was accepted carrying a chapter as well
--   m3  `NEW.scope IS DISTINCT FROM OLD.scope` deleted from the freeze trigger
--         ERROR: the freeze trigger does not test every frozen term
--   m4  region_id re-created as ON DELETE SET NULL
--         ERROR: dues_schedules.region_id is not a NO ACTION foreign key to regions
--   m5  the donation CHECK is never created
--         ERROR: scope constraint(s) not created: dues_schedules_donation_is_national
--   m5b the donation CHECK is created under its own name but vacuous
--         ERROR: a donation drive was accepted with a chapter scope
--   m6  the column default is 'chapter'
--         ERROR: dues_schedules.scope was not created NOT NULL DEFAULT 'national'
--
-- m5 and m5b are the pair worth keeping: m5 is caught by the CATALOGUE half, which proves
-- only that a constraint of that name exists, and m5b is what proves the constraint does
-- what its name says. A verify block with only the first kind of assertion passes over a
-- constraint that has been quietly weakened, which is the commoner failure.
--
-- HOW THIS REACHES A DATABASE
--   `supabase db push`, from CI on merge to master — never `psql -f` by hand, which
--   records nothing and can replay this file out of order. See AGENTS.md, "How
--   migrations reach the hosted project".
-- ============================================================================

BEGIN;

-- ── 1. The columns ──────────────────────────────────────────────────────────
-- NOT NULL with a 'national' default, like `bloodline_only` and unlike `start_age`: there
-- is no third state. A schedule is owed by the whole family, by a region, or by a chapter,
-- and a NULL would invite a fourth meaning into a question with three answers.
ALTER TABLE dues_schedules
  ADD COLUMN IF NOT EXISTS scope TEXT NOT NULL DEFAULT 'national';

ALTER TABLE dues_schedules DROP CONSTRAINT IF EXISTS dues_schedules_scope_valid;
ALTER TABLE dues_schedules
  ADD CONSTRAINT dues_schedules_scope_valid
    CHECK (scope IN ('national', 'regional', 'chapter'));

-- The vocabulary is the same three words `family_roles.scope` and `user_roles.scope` have
-- used since 20260604000002, and that is deliberate: a board position scoped to a chapter
-- and a due scoped to a chapter mean the same thing about the same row in `chapters`. Two
-- spellings of one idea is how the two screens come to disagree.
ALTER TABLE dues_schedules
  ADD COLUMN IF NOT EXISTS region_id  UUID REFERENCES regions(id),
  ADD COLUMN IF NOT EXISTS chapter_id UUID REFERENCES chapters(id);

COMMENT ON COLUMN dues_schedules.scope IS
  'Who owes this due: national (everybody), regional (members whose chapter is in region_id), chapter (members in chapter_id). National is the ABSENCE of a region rather than a row, so it exists on every tier and needs no seed. A member with no chapter is under National. Derived per member at read time from people.chapter_id -> chapters.region_id; there is no people.region_id and none may be added.';
COMMENT ON COLUMN dues_schedules.region_id IS
  'Set exactly when scope = ''regional''. NO ACTION on delete: lib/scope-attached.ts refuses to delete a region a schedule is scoped to, with a sentence naming it.';
COMMENT ON COLUMN dues_schedules.chapter_id IS
  'Set exactly when scope = ''chapter''. NO ACTION on delete, for the reason on region_id.';

-- ── 2. The invariant ────────────────────────────────────────────────────────
-- The data half first, for the reason 20260817000002 carried one: a column added with a
-- default cannot already be wrong, but this file is also the one a replay runs, and a row
-- that somehow holds a target against 'national' must be corrected before the constraint
-- refuses it rather than aborting the chain.
UPDATE dues_schedules
   SET region_id = NULL, chapter_id = NULL
 WHERE scope = 'national' AND (region_id IS NOT NULL OR chapter_id IS NOT NULL);

ALTER TABLE dues_schedules DROP CONSTRAINT IF EXISTS dues_schedules_scope_targets;
ALTER TABLE dues_schedules
  ADD CONSTRAINT dues_schedules_scope_targets
    CHECK (
      (scope = 'national' AND region_id IS NULL     AND chapter_id IS NULL)
   OR (scope = 'regional' AND region_id IS NOT NULL AND chapter_id IS NULL)
   OR (scope = 'chapter'  AND region_id IS NULL     AND chapter_id IS NOT NULL)
    );

-- ── 3. A donation is always national ────────────────────────────────────────
-- `scope` answers "who OWES it", and nobody owes a gift — so the question does not arise
-- for a drive, and a `scope` on one would be a control that changes nothing. Held by a
-- CHECK as well as by `kindInvariants`, the same pair `required`, `start_age` and
-- `bloodline_only` are held by: one stale form must not post a row whose fields contradict
-- its kind.
--
-- A DRIVE FOR ONE CHAPTER IS A DIFFERENT FEATURE and would be built on visibility, not on
-- obligation — `donation_beneficiaries` is the existing mechanism for narrowing who a
-- drive concerns. Do not overload this column with it.
UPDATE dues_schedules
   SET scope = 'national', region_id = NULL, chapter_id = NULL
 WHERE kind = 'donation' AND scope <> 'national';

ALTER TABLE dues_schedules DROP CONSTRAINT IF EXISTS dues_schedules_donation_is_national;
ALTER TABLE dues_schedules
  ADD CONSTRAINT dues_schedules_donation_is_national
    CHECK (kind <> 'donation' OR scope = 'national');

-- ── 4. Scope, the age rule and the bloodline join the frozen terms ──────────
-- CREATE OR REPLACE of 20260807000001's function, changing `v_terms_moved` and the message
-- and nothing else. See the header for why scope belongs in the set, and for why adding
-- `start_age` and `bloodline_only` is a repair of a claim the app has been making alone.
CREATE OR REPLACE FUNCTION public.dues_schedules_freeze_used_terms()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  -- Read from the STORED row. `kind` is not editable through updateDuesSchedule,
  -- and taking it from NEW would let a write choose which rules apply to it.
  v_kind text := CASE WHEN OLD.kind = 'donation' THEN 'donation' ELSE 'dues' END;
  v_terms_moved boolean :=
        NEW.start_date     IS DISTINCT FROM OLD.start_date
     OR NEW.amount_cents   IS DISTINCT FROM OLD.amount_cents
     OR NEW.frequency      IS DISTINCT FROM OLD.frequency
     -- Added 20260817000008. Each of these decides what a member owed for periods the
     -- ledger has already been posted against, and `scope` decides whether they owed it
     -- at all — the strongest case in the set.
     OR NEW.scope          IS DISTINCT FROM OLD.scope
     OR NEW.region_id      IS DISTINCT FROM OLD.region_id
     OR NEW.chapter_id     IS DISTINCT FROM OLD.chapter_id
     -- Claimed frozen by updateDuesSchedule since each shipped, and enforced by nothing
     -- until now: that action writes through the service-role client, so its own check
     -- was the only guard on either.
     OR NEW.start_age      IS DISTINCT FROM OLD.start_age
     OR NEW.bloodline_only IS DISTINCT FROM OLD.bloodline_only;
  v_used boolean;
BEGIN
  -- The end-date floor first: it applies whether or not anything has been posted,
  -- and only when the value actually moves. See (4) in 20260807000001's header for why
  -- the floor is CURRENT_DATE - 1 rather than CURRENT_DATE.
  IF v_kind = 'dues'
     AND NEW.end_date IS DISTINCT FROM OLD.end_date
     AND NEW.end_date IS NOT NULL
     AND NEW.end_date < CURRENT_DATE - 1
  THEN
    RAISE EXCEPTION 'A dues end date cannot be moved into the past (schedule %)', OLD.id
      USING ERRCODE = '22007';
  END IF;

  -- Nothing frozen has moved, so there is nothing to look up. Keeps the common edit
  -- — a renamed due, a corrected description, a new end date — off the payments
  -- table entirely.
  IF NOT v_terms_moved THEN
    RETURN NEW;
  END IF;

  -- "Used" differs by kind, and the difference is the point. A due is used the
  -- moment ANY row references it, waived and pending included: each one was posted
  -- against these terms and each one is read back through them. A donation is only
  -- at stake once money genuinely arrived, so it asks for a settled row.
  IF v_kind = 'donation' THEN
    SELECT EXISTS (
      SELECT 1 FROM public.dues_payments
       WHERE schedule_id = OLD.id AND status = 'paid'
    ) INTO v_used;
    IF v_used AND NEW.start_date IS DISTINCT FROM OLD.start_date THEN
      RAISE EXCEPTION 'This donation has received funds, so its start date can no longer change (schedule %)', OLD.id
        USING ERRCODE = '42501';
    END IF;
    RETURN NEW;
  END IF;

  SELECT EXISTS (
    SELECT 1 FROM public.dues_payments WHERE schedule_id = OLD.id
  ) INTO v_used;
  IF v_used THEN
    RAISE EXCEPTION 'Payments have been recorded against this due, so its start date, amount, frequency, starting age, bloodline setting and who owes it can no longer change (schedule %)', OLD.id
      USING ERRCODE = '42501';
  END IF;

  RETURN NEW;
END $$;

-- ── 5. Verify ───────────────────────────────────────────────────────────────
-- Catalogue reads first, unconditional, so this cannot report success by skipping. Then a
-- REAL BEHAVIOUR TEST of the invariant, which also needs no fixture: `dues_schedules`,
-- `regions` and `chapters` all carry `family_code` as free text with no foreign key to
-- `families`, so a probe family can be created and removed inside this transaction. That
-- is the difference AGENTS.md asks for between a verify block and a comment — the CHECK is
-- exercised in both directions rather than merely read back out of pg_constraint.
DO $$
DECLARE
  v_code    text := 'ZZSCOPEPROBE';
  v_region  uuid;
  v_chapter uuid;
  v_sched   uuid;
  v_missing text;
  v_def     text;
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
     WHERE table_schema = 'public' AND table_name = 'dues_schedules'
       AND column_name = 'scope' AND is_nullable = 'NO'
       AND column_default LIKE '%national%'
  ) THEN
    RAISE EXCEPTION 'dues_schedules.scope was not created NOT NULL DEFAULT ''national''';
  END IF;

  SELECT string_agg(c.name, ', ') INTO v_missing
    FROM (VALUES
      ('dues_schedules_scope_valid'),
      ('dues_schedules_scope_targets'),
      ('dues_schedules_donation_is_national')
    ) AS c(name)
   WHERE NOT EXISTS (
     SELECT 1 FROM pg_constraint
      WHERE conrelid = 'public.dues_schedules'::regclass AND conname = c.name
   );
  IF v_missing IS NOT NULL THEN
    RAISE EXCEPTION 'scope constraint(s) not created: %', v_missing;
  END IF;

  -- The two foreign keys, and that they are NO ACTION rather than SET NULL — see the
  -- header: SET NULL would leave a regional schedule with no region and turn a refused
  -- delete into a CHECK violation naming a column nobody touched.
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
     WHERE conrelid = 'public.dues_schedules'::regclass AND contype = 'f'
       AND confrelid = 'public.regions'::regclass AND confdeltype = 'a'
  ) THEN
    RAISE EXCEPTION 'dues_schedules.region_id is not a NO ACTION foreign key to regions';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
     WHERE conrelid = 'public.dues_schedules'::regclass AND contype = 'f'
       AND confrelid = 'public.chapters'::regclass AND confdeltype = 'a'
  ) THEN
    RAISE EXCEPTION 'dues_schedules.chapter_id is not a NO ACTION foreign key to chapters';
  END IF;

  -- The freeze trigger names all three new columns. This asserts the SOURCE rather than
  -- the behaviour, and says so: reproducing the behaviour needs a payment, which needs a
  -- person, which needs an auth user — the fixture whose absence made 20260806000012's
  -- verify block skip silently. A source check cannot skip.
  v_def := pg_get_functiondef('public.dues_schedules_freeze_used_terms()'::regprocedure);
  IF NOT (v_def LIKE '%NEW.scope%' AND v_def LIKE '%NEW.region_id%'
      AND v_def LIKE '%NEW.chapter_id%' AND v_def LIKE '%NEW.start_age%'
      AND v_def LIKE '%NEW.bloodline_only%') THEN
    RAISE EXCEPTION 'the freeze trigger does not test every frozen term';
  END IF;

  -- ── The invariant, exercised ──
  INSERT INTO public.regions (family_code, name) VALUES (v_code, 'Probe Region')
    RETURNING id INTO v_region;
  INSERT INTO public.chapters (family_code, name, region_id) VALUES (v_code, 'Probe Chapter', v_region)
    RETURNING id INTO v_chapter;
  INSERT INTO public.dues_schedules (family_code, label, amount_cents, frequency)
    VALUES (v_code, 'Probe Due', 1000, 'annual')
    RETURNING id INTO v_sched;

  IF (SELECT scope FROM public.dues_schedules WHERE id = v_sched) <> 'national' THEN
    RAISE EXCEPTION 'a schedule created without a scope did not come out national';
  END IF;

  -- national with a target
  BEGIN
    UPDATE public.dues_schedules SET region_id = v_region WHERE id = v_sched;
    RAISE EXCEPTION 'a national schedule accepted a region';
  EXCEPTION WHEN check_violation THEN NULL;
  END;

  -- regional with no region
  BEGIN
    UPDATE public.dues_schedules SET scope = 'regional' WHERE id = v_sched;
    RAISE EXCEPTION 'a regional schedule was accepted with no region';
  EXCEPTION WHEN check_violation THEN NULL;
  END;

  -- regional carrying both
  BEGIN
    UPDATE public.dues_schedules
       SET scope = 'regional', region_id = v_region, chapter_id = v_chapter
     WHERE id = v_sched;
    RAISE EXCEPTION 'a regional schedule was accepted carrying a chapter as well';
  EXCEPTION WHEN check_violation THEN NULL;
  END;

  -- chapter with no chapter
  BEGIN
    UPDATE public.dues_schedules SET scope = 'chapter' WHERE id = v_sched;
    RAISE EXCEPTION 'a chapter schedule was accepted with no chapter';
  EXCEPTION WHEN check_violation THEN NULL;
  END;

  -- an unknown word
  BEGIN
    UPDATE public.dues_schedules SET scope = 'planetary' WHERE id = v_sched;
    RAISE EXCEPTION 'the scope vocabulary accepted a word that is not one of the three';
  EXCEPTION WHEN check_violation THEN NULL;
  END;

  -- the two legitimate targeted states
  UPDATE public.dues_schedules SET scope = 'regional', region_id = v_region, chapter_id = NULL
   WHERE id = v_sched;
  UPDATE public.dues_schedules SET scope = 'chapter', region_id = NULL, chapter_id = v_chapter
   WHERE id = v_sched;
  UPDATE public.dues_schedules SET scope = 'national', region_id = NULL, chapter_id = NULL
   WHERE id = v_sched;

  -- a donation may not be scoped
  UPDATE public.dues_schedules SET kind = 'donation', amount_cents = 0,
         frequency = 'one-time', goal_cents = 5000, start_age = NULL
   WHERE id = v_sched;
  BEGIN
    UPDATE public.dues_schedules SET scope = 'chapter', chapter_id = v_chapter WHERE id = v_sched;
    RAISE EXCEPTION 'a donation drive was accepted with a chapter scope';
  EXCEPTION WHEN check_violation THEN NULL;
  END;

  -- The region cannot go while a schedule is scoped to it. This is the FK backstop the
  -- header describes; the sentence a treasurer reads comes from lib/scope-attached.ts.
  UPDATE public.dues_schedules SET kind = 'dues', amount_cents = 1000, frequency = 'annual',
         scope = 'regional', region_id = v_region, chapter_id = NULL
   WHERE id = v_sched;
  BEGIN
    DELETE FROM public.regions WHERE id = v_region;
    RAISE EXCEPTION 'a region was deleted while a dues schedule was scoped to it';
  EXCEPTION WHEN foreign_key_violation THEN NULL;
  END;

  DELETE FROM public.dues_schedules WHERE family_code = v_code;
  DELETE FROM public.chapters       WHERE family_code = v_code;
  DELETE FROM public.regions        WHERE family_code = v_code;

  IF EXISTS (SELECT 1 FROM public.dues_schedules WHERE family_code = v_code)
     OR EXISTS (SELECT 1 FROM public.chapters WHERE family_code = v_code)
     OR EXISTS (SELECT 1 FROM public.regions WHERE family_code = v_code) THEN
    RAISE EXCEPTION 'the scope probe left rows behind';
  END IF;

  RAISE NOTICE 'dues_schedules.scope: three states, six refusals and one FK backstop verified; probe family % removed', v_code;
END $$;

COMMIT;
