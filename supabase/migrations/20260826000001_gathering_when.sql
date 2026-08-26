-- ═══════════════════════════════════════════════════════════════════════════════════════
-- WHEN A GATHERING HAPPENS: TIMES OF DAY, AND MORE THAN ONE OCCASION
-- ═══════════════════════════════════════════════════════════════════════════════════════
--
-- `gatherings` held two bare DATEs — `starts_on` and a nullable `ends_on` — and that answered
-- one shape of question. Three it could not answer, all of them ordinary:
--
--   * **What time does it start?** "The picnic is on 4 July" is not what anybody says out loud.
--   * **Is a three-day reunion one thing or three?** A reunion that runs Friday to Sunday is one
--     continuous block. A committee that meets on three Saturdays is three occasions with one
--     name. The old schema could not tell them apart, so the calendar drew both as a bar.
--   * **What time does it END?** Which is a different question from what day it ends on.
--
-- ── §4b's `is_minor` TRAP IS THE THING TO AVOID HERE, AND IT IS EASY TO WALK INTO ─────
-- The obvious design is `start_time`/`end_time` columns on `gatherings` for the simple case and
-- an occurrences table for the complicated one. That is two places a gathering's "when" lives,
-- read differently depending on a flag — precisely the two-facts-that-disagree shape AGENTS.md
-- records for `is_minor` and for `dues_member_plans.start_date`.
--
-- So: **`gathering_occurrences` is the ONLY place a date or a time is written.** Every gathering
-- has at least one row; a continuous one has exactly one. The four columns on `gatherings` are a
-- trigger-maintained ENVELOPE over them.
--
-- ── WHY AN ENVELOPE AT ALL, RATHER THAN JOINING EVERYWHERE ───────────────────────────
-- `gatherings.starts_on` is read by eleven places: the calendar's SQL narrowing, two indexes
-- (one of them partial, for the Dashboard's premier band), `getGatherings`' ordering, the
-- activity report, the premier resolver, `/gatherings`' past/upcoming split. Rewriting all of
-- them as aggregates over a child table would be a large diff in which a missed call site
-- silently reads a date that is no longer maintained.
--
-- A materialised derivation with ONE writer is the alternative and it is what this does. The
-- trigger is the only thing that writes those four columns, `gatherings_guard_when` refuses
-- anybody else, and the verify block asserts both.
--
-- ── THE TIMES ARE WALL-CLOCK LABELS AND DELIBERATELY NOT INSTANTS ────────────────────
-- `20260819000000` argued against a TIME column and the argument was: *"nothing records a
-- family timezone, and a TIME here would be a time in no particular zone — two facts that
-- disagree, which is the trap AGENTS.md §4b records for is_minor."*
--
-- That is right about an INSTANT and wrong about a LABEL, and the difference is the whole of
-- what these columns are. `11:00` here means what it means on a paper invitation: eleven
-- o'clock, where the gathering is. It is never converted, never compared across zones, never
-- turned into a `timestamptz`, and never used to decide whether something has started —
-- `lib/gatherings.ts` derives past/today/upcoming from the DATES and must go on doing so.
--
-- There is exactly one fact, so there is nothing for a second one to disagree with. **If a
-- family timezone is ever recorded, do NOT convert these.** A member typing 11:00 for a picnic
-- in Austin means 11:00 in Austin; re-interpreting stored labels as instants would move every
-- gathering in the product by an offset nobody chose.
--
-- ── §2c: RLS IS THE WHOLE BOUNDARY ON THE NEW TABLE ──────────────────────────────────
-- A SELECT policy keyed on `gatherings:view` — the same key the parent's policy uses, because
-- when a gathering happens is part of the gathering — and NO write policy, which denies insert,
-- update and delete to the browser outright. Every write goes through the actions on the
-- service role with `.eq('family_code', …)` by hand (§3), and a guard trigger refuses a
-- cross-family parent underneath (§4). Identical arrangement to the six tables
-- `20260819000000` shipped, for the identical reason.
--
-- ── AND ITS SELECT POLICY IS A `SECURITY DEFINER` CALL, NOT AN `EXISTS` ──────────────
-- AGENTS.md §7's 42P17 entry: two policies that read each other's tables are infinite
-- recursion, and the admin client hides it completely. `gatherings`' own policy does not read
-- this table, so a plain `EXISTS` here would terminate — but the parent's policy is COMPOSED at
-- migration time from `permission_table_map`, and a future sweep adding a `self_expr` to
-- `gatherings` that reached into a child would close the cycle in a diff that mentions only
-- "recomposing policies". `auth_may_see_gathering()` breaks it on this side once and for all.
-- ═══════════════════════════════════════════════════════════════════════════════════════

-- ── 1. The envelope columns ───────────────────────────────────────────────────────────

ALTER TABLE public.gatherings
  ADD COLUMN IF NOT EXISTS start_time    TIME,
  ADD COLUMN IF NOT EXISTS end_time      TIME,
  -- ONE BLOCK, OR SEVERAL OCCASIONS WITH ONE NAME. It is a fact about the gathering rather
  -- than something derivable from the occurrence count: a single-occurrence gathering is
  -- continuous by definition, and a family may legitimately have entered one occasion of a
  -- series so far. Default true, so every existing row is what it already was.
  ADD COLUMN IF NOT EXISTS is_continuous BOOLEAN NOT NULL DEFAULT true;

COMMENT ON COLUMN public.gatherings.start_time IS
  'A WALL-CLOCK LABEL, never an instant. The earliest occurrence''s start time, maintained by '
  'tg_gathering_when_envelope and writable by nothing else. NULL means no time was given, which '
  'is a real answer — "the reunion is on 4 July" — and not a missing one. Never converted '
  'between timezones; see this migration''s header.';
COMMENT ON COLUMN public.gatherings.end_time IS
  'The LAST occurrence''s end time, maintained by trigger. Distinct from ends_on: a picnic on '
  'one day has an end time and no end date.';
COMMENT ON COLUMN public.gatherings.is_continuous IS
  'TRUE: one unbroken block, drawn on the calendar as a bar spanning its days. FALSE: several '
  'occasions carrying one title, drawn as separate chips. A three-day reunion is the first; a '
  'committee meeting on three Saturdays is the second, and the old schema could not tell them '
  'apart. STORED rather than derived from the occurrence count — a series with one occasion '
  'entered so far is still a series.';
COMMENT ON COLUMN public.gatherings.starts_on IS
  'THE ENVELOPE, maintained by tg_gathering_when_envelope from gathering_occurrences — the '
  'earliest occurrence''s start. Read by the calendar''s SQL narrowing, two indexes, the '
  'premier resolver and the past/upcoming split, which is why it is materialised here rather '
  'than aggregated at eleven call sites. Writable only by the trigger and the service role; '
  'gatherings_guard_when refuses the authenticated role.';
COMMENT ON COLUMN public.gatherings.ends_on IS
  'THE ENVELOPE''S far end — the latest occurrence''s end, or its start where it has none. '
  'NULL means a single day. Maintained by trigger; see starts_on.';

-- ── 2. The occurrences ────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.gathering_occurrences (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  family_code  text NOT NULL,
  gathering_id uuid NOT NULL REFERENCES public.gatherings(id) ON DELETE CASCADE,
  starts_on    date NOT NULL,
  start_time   time,
  -- NULL means the occasion ends on the day it starts. Kept nullable rather than defaulted to
  -- `starts_on` so "one day" and "two days that happen to be the same" stay one answer.
  ends_on      date,
  end_time     time,
  -- The order the family entered them, so a series reads back the way it was written rather
  -- than in whatever order the database returns. NOT the date order: a family adding a
  -- forgotten Saturday to the middle of a series should not have the list resequence itself.
  position     int  NOT NULL DEFAULT 0,
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now(),
  -- THE ONE RULE THE ASK STATES OUTRIGHT: the end is never before the start.
  CONSTRAINT gathering_occurrences_dates_ordered
    CHECK (ends_on IS NULL OR ends_on >= starts_on),
  -- AND ITS TIME HALF, which the date check cannot express. Within ONE day, an end time before
  -- the start time is the same mistake one day later — 14:00 to 09:00 on 4 July is not a
  -- gathering. Across days it is perfectly ordinary (Friday 18:00 to Sunday 11:00), so the
  -- check applies only where the two days are the same.
  CONSTRAINT gathering_occurrences_times_ordered
    CHECK (
      ends_on IS NOT NULL AND ends_on > starts_on
      OR start_time IS NULL OR end_time IS NULL
      OR end_time > start_time
    ),
  -- AN END TIME WITH NO START TIME IS HALF AN ANSWER. "Ends at 4pm" with no start is a fact
  -- nothing can render usefully, and every form that writes this asks for the start first.
  CONSTRAINT gathering_occurrences_end_time_needs_start
    CHECK (end_time IS NULL OR start_time IS NOT NULL)
);

COMMENT ON TABLE public.gathering_occurrences IS
  'WHEN a gathering actually happens — the only place a gathering''s dates and times are '
  'written. Every gathering has at least one row; a continuous one has exactly one, and a '
  'series has one per occasion. gatherings.starts_on/ends_on/start_time/end_time are a '
  'trigger-maintained envelope over these and are read by everything that only needs the '
  'outer bounds.';

COMMENT ON COLUMN public.gathering_occurrences.position IS
  'ENTRY order, not date order. A family adding a forgotten date to the middle of a series '
  'should not have the list resequence itself under them.';

CREATE INDEX IF NOT EXISTS gathering_occurrences_gathering_idx
  ON public.gathering_occurrences (gathering_id, position);
CREATE INDEX IF NOT EXISTS gathering_occurrences_family_starts_idx
  ON public.gathering_occurrences (family_code, starts_on);

DROP TRIGGER IF EXISTS gathering_occurrences_updated_at ON public.gathering_occurrences;
CREATE TRIGGER gathering_occurrences_updated_at
  BEFORE UPDATE ON public.gathering_occurrences
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ── 3. §4: the parent must be in the family the row claims ────────────────────────────

CREATE OR REPLACE FUNCTION public.tg_gathering_occurrence_guard_family()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.gatherings
     WHERE id = NEW.gathering_id AND family_code = NEW.family_code
  ) THEN
    RAISE EXCEPTION
      'gathering % is not in family % (occurrence)', NEW.gathering_id, NEW.family_code
      USING ERRCODE = 'check_violation';
  END IF;
  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION public.tg_gathering_occurrence_guard_family() IS
  'AGENTS.md §4: RLS checks the row, not the ids the row references — and the service role '
  'ignores RLS while it does not ignore triggers. Refuses an occurrence filed under a family '
  'its gathering is not in. This is the fifth of the guards 20260819000000 argues for, on the '
  'one child table added since.';

DROP TRIGGER IF EXISTS gathering_occurrences_guard_family ON public.gathering_occurrences;
CREATE TRIGGER gathering_occurrences_guard_family
  BEFORE INSERT OR UPDATE ON public.gathering_occurrences
  FOR EACH ROW EXECUTE FUNCTION public.tg_gathering_occurrence_guard_family();

-- ── 4. The envelope, maintained ───────────────────────────────────────────────────────
--
-- ONE WRITER for four columns on the parent. `SECURITY DEFINER` because it updates
-- `gatherings`, which the calling role may not be able to write — a member scheduling a
-- gathering goes through the service role, but a future user-client path must not need a
-- policy on the parent just to add an occurrence.
--
-- `pg_trigger_depth()` IS NOT USED TO GUARD THIS, and the guard below is why: recursion is not
-- possible because nothing on `gatherings` writes `gathering_occurrences`.

CREATE OR REPLACE FUNCTION public.tg_gathering_when_envelope()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_gathering uuid := COALESCE(NEW.gathering_id, OLD.gathering_id);
  v_starts    date;
  v_ends      date;
  v_start_t   time;
  v_end_t     time;
  v_count     int;
BEGIN
  SELECT count(*) INTO v_count
    FROM public.gathering_occurrences WHERE gathering_id = v_gathering;

  -- EVERY OCCURRENCE DELETED. The parent's `starts_on` is NOT NULL, so it cannot be cleared —
  -- and it should not be: a gathering whose dates were all removed is a data-entry accident,
  -- not a gathering with no date. The envelope is LEFT as it was, which keeps the row valid and
  -- keeps it on the calendar where somebody can see it and fix it. Silently moving it to today
  -- would put a reunion on the wrong day; failing the delete would make the form unusable
  -- while it swaps one occurrence for another.
  IF v_count = 0 THEN
    RETURN COALESCE(NEW, OLD);
  END IF;

  SELECT min(o.starts_on),
         max(COALESCE(o.ends_on, o.starts_on))
    INTO v_starts, v_ends
    FROM public.gathering_occurrences o
   WHERE o.gathering_id = v_gathering;

  -- THE EARLIEST OCCASION'S START TIME, and the LATEST one's end time — not min() and max() of
  -- the times themselves, which would be a nonsense across days: a series running 18:00 Friday
  -- and 09:00 Saturday does not start at 09:00.
  SELECT o.start_time INTO v_start_t
    FROM public.gathering_occurrences o
   WHERE o.gathering_id = v_gathering
   ORDER BY o.starts_on, o.start_time NULLS FIRST, o.position
   LIMIT 1;

  SELECT o.end_time INTO v_end_t
    FROM public.gathering_occurrences o
   WHERE o.gathering_id = v_gathering
   ORDER BY COALESCE(o.ends_on, o.starts_on) DESC, o.end_time DESC NULLS LAST, o.position DESC
   LIMIT 1;

  UPDATE public.gatherings
     SET starts_on  = v_starts,
         -- NULL where the whole thing is one day, which is what `ends_on` has always meant on
         -- this table and what `formatDateRange` and the calendar's `overlaps` both read.
         ends_on    = CASE WHEN v_ends > v_starts THEN v_ends ELSE NULL END,
         start_time = v_start_t,
         end_time   = v_end_t
   WHERE id = v_gathering
     AND (starts_on  IS DISTINCT FROM v_starts
       OR ends_on    IS DISTINCT FROM CASE WHEN v_ends > v_starts THEN v_ends ELSE NULL END
       OR start_time IS DISTINCT FROM v_start_t
       OR end_time   IS DISTINCT FROM v_end_t);

  RETURN COALESCE(NEW, OLD);
END;
$$;

COMMENT ON FUNCTION public.tg_gathering_when_envelope() IS
  'The ONE writer of gatherings.starts_on/ends_on/start_time/end_time. Recomputes them from '
  'gathering_occurrences after any change. The WHERE clause makes it a no-op when nothing '
  'moved, so re-saving a series does not touch the parent''s updated_at.';

DROP TRIGGER IF EXISTS gathering_occurrences_envelope ON public.gathering_occurrences;
CREATE TRIGGER gathering_occurrences_envelope
  AFTER INSERT OR UPDATE OR DELETE ON public.gathering_occurrences
  FOR EACH ROW EXECUTE FUNCTION public.tg_gathering_when_envelope();

-- ── 5. Nobody in the browser edits the envelope ───────────────────────────────────────
--
-- `gatherings` has an UPDATE policy admitting `admin/gatherings:edit`, and a policy has no
-- opinion about WHICH COLUMN changed — the same shape as `families_guard_tier` and
-- `people_guard_permission_template`. Without this, a member holding that grant could PATCH
-- `starts_on` straight through PostgREST and leave the parent disagreeing with its own
-- occurrences, which is the two-facts-that-disagree failure this whole migration is arranged
-- to prevent.
--
-- INVOKER, and it tests the ROLE rather than the column's value: the trigger above runs as its
-- owner, and the actions run as `service_role`, so both sail past while `authenticated` is
-- refused. That is the boundary AGENTS.md describes for `people_guard_membership_status` — a
-- boundary around the role the browser speaks as.

CREATE OR REPLACE FUNCTION public.gatherings_guard_when()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
BEGIN
  IF current_user = 'authenticated' AND (
       NEW.starts_on  IS DISTINCT FROM OLD.starts_on
    OR NEW.ends_on    IS DISTINCT FROM OLD.ends_on
    OR NEW.start_time IS DISTINCT FROM OLD.start_time
    OR NEW.end_time   IS DISTINCT FROM OLD.end_time
  ) THEN
    RAISE EXCEPTION
      'when a gathering happens is set through its occurrences, not on the gathering (%)', OLD.id
      USING ERRCODE = 'check_violation';
  END IF;
  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION public.gatherings_guard_when() IS
  'Refuses a change to the four envelope columns made by the authenticated role. The envelope '
  'is derived from gathering_occurrences by tg_gathering_when_envelope; a browser writing it '
  'directly would leave the parent disagreeing with its own children. Same shape and same '
  'reason as families_guard_tier.';

DROP TRIGGER IF EXISTS gatherings_guard_when ON public.gatherings;
CREATE TRIGGER gatherings_guard_when
  BEFORE UPDATE ON public.gatherings
  FOR EACH ROW EXECUTE FUNCTION public.gatherings_guard_when();

-- ── 6. Backfill: every existing gathering gets its one occurrence ─────────────────────
--
-- IDEMPOTENT on the absence of any occurrence for the gathering, so a replay adds nothing. The
-- envelope trigger fires on each insert and recomputes the parent to exactly what it already
-- says — the `WHERE` in the trigger makes that a no-op, so no `updated_at` moves.

INSERT INTO public.gathering_occurrences (family_code, gathering_id, starts_on, ends_on, position)
SELECT g.family_code, g.id, g.starts_on, g.ends_on, 0
  FROM public.gatherings g
 WHERE NOT EXISTS (
   SELECT 1 FROM public.gathering_occurrences o WHERE o.gathering_id = g.id
 );

-- ── 7. RLS ────────────────────────────────────────────────────────────────────────────
--
-- `auth_may_see_gathering()` rather than an inline `EXISTS` — see the header. SECURITY DEFINER
-- so the read inside it does not re-enter RLS, `SET search_path = ''`, and an EXECUTE grant to
-- `authenticated` because a policy expression is evaluated as the QUERYING role (§2b rule 2):
-- without the grant every read ERRORS rather than being refused, which on a realtime path is
-- indistinguishable from a policy correctly withholding a row.

CREATE OR REPLACE FUNCTION public.auth_may_see_gathering(p_gathering uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.gatherings g
     WHERE g.id = p_gathering
       AND g.family_code = public.auth_family_code()
       AND public.auth_membership_approved()
       AND public.auth_permission('gatherings', 'view') = 'any'
  );
$$;

COMMENT ON FUNCTION public.auth_may_see_gathering(uuid) IS
  'May the caller see this gathering? SECURITY DEFINER so a child table''s policy can ask '
  'without re-entering RLS on gatherings — AGENTS.md §7''s 42P17 entry, pre-empted: '
  'gatherings'' own policy does not read a child today, and a future policy sweep adding a '
  'self_expr that did would close the cycle in a diff that mentions only recomposing policies. '
  'Breaks ONE side, which is the rule: the parent may still be read under RLS.';

REVOKE ALL ON FUNCTION public.auth_may_see_gathering(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.auth_may_see_gathering(uuid) TO authenticated;

ALTER TABLE public.gathering_occurrences ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "gathering_occurrences_select" ON public.gathering_occurrences;
CREATE POLICY "gathering_occurrences_select"
  ON public.gathering_occurrences FOR SELECT TO authenticated
  USING (
    family_code = public.auth_family_code()
    AND public.auth_may_see_gathering(gathering_id)
  );

-- §2c: a statement of what the table is for. NO insert, update or delete policy, so the
-- browser is refused all three and the actions are the only writers.
GRANT SELECT ON public.gathering_occurrences TO authenticated;

-- ── 8. Verify ─────────────────────────────────────────────────────────────────────────

DO $$
DECLARE
  v_code   text;
  v_other  text;
  v_g      uuid;
  v_o      uuid;
  v_n      int;
  v_date   date;
  v_time   time;
BEGIN
  -- 8a. One policy, and it is a SELECT. A write policy here would hand the browser a way past
  -- the actions, where the family scoping is applied by hand.
  SELECT count(*) INTO v_n FROM pg_policies
   WHERE schemaname = 'public' AND tablename = 'gathering_occurrences';
  IF v_n <> 1 THEN
    RAISE EXCEPTION 'gathering_occurrences should carry exactly 1 policy, found %', v_n;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
     WHERE schemaname = 'public' AND tablename = 'gathering_occurrences'
       AND cmd = 'SELECT' AND qual LIKE '%auth_may_see_gathering%'
  ) THEN
    RAISE EXCEPTION 'the SELECT policy must ask auth_may_see_gathering, not an inline EXISTS';
  END IF;

  -- 8b. The helper is granted to `authenticated`, or every read above ERRORS.
  IF NOT has_function_privilege('authenticated',
      'public.auth_may_see_gathering(uuid)', 'EXECUTE') THEN
    RAISE EXCEPTION 'auth_may_see_gathering is not executable by authenticated (§2b rule 2)';
  END IF;

  -- 8c. RLS is on.
  IF NOT EXISTS (
    SELECT 1 FROM pg_class
     WHERE oid = 'public.gathering_occurrences'::regclass AND relrowsecurity
  ) THEN
    RAISE EXCEPTION 'row level security is not enabled on gathering_occurrences';
  END IF;

  -- 8d. Every existing gathering has at least one occurrence. The backfill's whole job.
  SELECT count(*) INTO v_n
    FROM public.gatherings g
   WHERE NOT EXISTS (
     SELECT 1 FROM public.gathering_occurrences o WHERE o.gathering_id = g.id
   );
  IF v_n <> 0 THEN
    RAISE EXCEPTION '% gathering(s) have no occurrence after the backfill', v_n;
  END IF;

  -- 8e. The row probes. A fresh database legitimately has no families, and a SKIP MUST BE
  -- VISIBLE — everything above ran unconditionally.
  SELECT family_code INTO v_code FROM public.families ORDER BY created_at LIMIT 1;
  IF v_code IS NULL THEN
    RAISE NOTICE 'no families: the row probes were skipped, the schema half was asserted';
    RETURN;
  END IF;
  SELECT family_code INTO v_other
    FROM public.families WHERE family_code <> v_code ORDER BY created_at LIMIT 1;

  INSERT INTO public.gatherings (family_code, title, starts_on)
  VALUES (v_code, 'When Probe', '2026-09-10') RETURNING id INTO v_g;

  -- The parent insert made no occurrence — nothing on `gatherings` writes the child — so the
  -- envelope is whatever was inserted. Add one and check it is recomputed.
  INSERT INTO public.gathering_occurrences
    (family_code, gathering_id, starts_on, start_time, ends_on, end_time, position)
  VALUES (v_code, v_g, '2026-09-12', '11:00', '2026-09-14', '16:00', 0)
  RETURNING id INTO v_o;

  SELECT starts_on, start_time INTO v_date, v_time FROM public.gatherings WHERE id = v_g;
  IF v_date <> '2026-09-12' OR v_time <> '11:00' THEN
    RAISE EXCEPTION 'the envelope did not follow the occurrence (got %, %)', v_date, v_time;
  END IF;
  SELECT ends_on, end_time INTO v_date, v_time FROM public.gatherings WHERE id = v_g;
  IF v_date <> '2026-09-14' OR v_time <> '16:00' THEN
    RAISE EXCEPTION 'the envelope''s far end did not follow (got %, %)', v_date, v_time;
  END IF;

  -- A SECOND OCCASION EARLIER THAN THE FIRST widens the envelope in both directions and takes
  -- its start time from the EARLIER one — the ordering rule in the trigger, which a min() over
  -- the times alone would get wrong.
  INSERT INTO public.gathering_occurrences
    (family_code, gathering_id, starts_on, start_time, position)
  VALUES (v_code, v_g, '2026-09-05', '18:00', 1);
  SELECT starts_on, start_time INTO v_date, v_time FROM public.gatherings WHERE id = v_g;
  IF v_date <> '2026-09-05' OR v_time <> '18:00' THEN
    RAISE EXCEPTION 'the envelope did not widen to the earlier occasion (got %, %)', v_date, v_time;
  END IF;

  -- ends_on before starts_on is refused.
  BEGIN
    UPDATE public.gathering_occurrences SET ends_on = '2026-09-01' WHERE id = v_o;
    RAISE EXCEPTION 'an occurrence ending before it starts was admitted';
  EXCEPTION WHEN check_violation THEN NULL;
  END;

  -- An end TIME before the start time, on ONE day, is refused — and across days is admitted.
  BEGIN
    UPDATE public.gathering_occurrences
       SET ends_on = NULL, start_time = '14:00', end_time = '09:00' WHERE id = v_o;
    RAISE EXCEPTION 'a same-day occurrence ending before it starts was admitted';
  EXCEPTION WHEN check_violation THEN NULL;
  END;
  UPDATE public.gathering_occurrences
     SET ends_on = '2026-09-14', start_time = '18:00', end_time = '09:00' WHERE id = v_o;

  -- An end time with no start time is refused.
  BEGIN
    UPDATE public.gathering_occurrences
       SET start_time = NULL, end_time = '16:00' WHERE id = v_o;
    RAISE EXCEPTION 'an occurrence with an end time and no start time was admitted';
  EXCEPTION WHEN check_violation THEN NULL;
  END;

  -- §4: a cross-family occurrence is refused.
  IF v_other IS NOT NULL THEN
    BEGIN
      UPDATE public.gathering_occurrences SET family_code = v_other WHERE id = v_o;
      RAISE EXCEPTION 'the family guard admitted a cross-family occurrence';
    EXCEPTION WHEN check_violation THEN NULL;
    END;
  ELSE
    RAISE NOTICE 'only one family present: the cross-family probe was skipped';
  END IF;

  -- The envelope guard refuses `authenticated` and admits the owner. Only the first half can be
  -- probed from here — this block runs as the migration's role — so the SECOND half is what
  -- `tests/rls` owes a case for, and `cases.mjs` says so.
  UPDATE public.gatherings SET starts_on = '2026-09-05' WHERE id = v_g;   -- no-op, admitted

  DELETE FROM public.gatherings WHERE id = v_g;

  RAISE NOTICE 'gathering_occurrences and the when-envelope: asserted';
END $$;
