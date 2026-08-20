-- ═══════════════════════════════════════════════════════════════════════════════════
-- GATHERING TEMPLATE STEPS: A PLACE IS A STEP, AND A TEMPLATE CAN BE A STEP
--
-- Three changes, and the first two are one decision seen from both ends.
--
--   §A  a new step kind, `location` — a step that ASKS somebody for a place
--   §B  `gathering_templates.default_location` is DROPPED — a template no longer STATES one
--   §C  a new step kind, `template`, plus `child_template_id`: a step that is another
--       template, expanded into that template's own steps when a gathering is built
--   §D  a fix to `tg_gathering_task_same_family()` that §C made necessary — it refused a
--       CASCADE, which is not a caller writing anything
--
-- ── §A AND §B ARE THE SAME DECISION ────────────────────────────────────────────────
-- `default_location` said "this kind of gathering is usually held here", and it was copied
-- onto every segment built from the template. That is a template AUTHOR guessing at a fact
-- that belongs to one occasion — this year's reunion is at the lodge, last year's was at
-- Zilker — and the guess then had to be corrected on every segment it was copied onto.
--
-- A `location` STEP inverts it: the template says "somebody has to settle the venue", the
-- gathering hands that job to a named relative with a due date, and the answer is reviewed
-- like every other answer. That is what the rest of this feature already does with every
-- other fact about a gathering, and there was no reason a place should have been the one
-- exception.
--
-- SO THE COLUMN GOES, rather than being kept and quietly unwritten. A column nothing writes
-- and one thing still reads is how a product ends up with two facts that disagree — the
-- `is_minor` lesson AGENTS.md §4b records at length. `attachTemplatesToGathering` loses its
-- fall-back in the same commit; a segment's `location` is now stated per segment or not at
-- all, which is what `gathering_template_uses.location` always meant on its own.
--
-- ── WHY `location` IS ITS OWN KIND AND NOT JUST `text` ─────────────────────────────
-- It is stored as text and it renders as one line, so the kind buys nothing in the database
-- — and that is not what it is for. `kind` is what the AUTHOR picks and what the ASSIGNEE's
-- field is built from, and a screen that knows an answer is a place can label it, autofill
-- it from the browser's address hints, and one day map it. `text`'s own hint says "a name, a
-- phone number, a venue"; splitting the venue out of that list is the step that lets any of
-- the rest happen without re-reading every stored answer to guess which ones were places.
--
-- ── §C: A TEMPLATE AS A STEP ───────────────────────────────────────────────────────
-- "Give Family Reunion a step of Test." A step of kind `template` names another template of
-- the same family; when a gathering is built, that step becomes the CHILD TEMPLATE'S STEPS
-- rather than a task of its own. It is composition, not a reference: a family that runs the
-- same five-step catering checklist inside three different occasions writes it once.
--
-- FOUR THINGS ABOUT IT ARE LOAD-BEARING.
--
--  1. **`gathering_tasks.kind` is NOT widened to `template`, deliberately.** A template step
--     never becomes a task — it expands into the child's steps — so a task carrying that
--     kind would be a task with no answerable field, and `parseAnswer` has no branch for it.
--     The CHECK on `gathering_tasks` is the thing that would catch an expansion bug rather
--     than letting it render as an unanswerable row, so it stays exactly as it is.
--
--  2. **`child_template_id` is `ON DELETE CASCADE`.** A step that says "do the Test
--     checklist" has no meaning once Test is gone; SET NULL would leave a `template` step
--     pointing at nothing, which the CHECK below forbids anyway, and NO ACTION would make
--     deleting a template fail with a foreign-key error naming a table the author has never
--     heard of. Tasks ALREADY instantiated are untouched: they carry their own copied label
--     and kind, and their `step_id` is `ON DELETE SET NULL` (AGENTS.md — a task is a copy of
--     its step, not a reference).
--
--  3. **The two are locked to each other by a CHECK**, in both directions. A `template` step
--     with no child is unexpandable, and a non-`template` step with a child is a reference
--     nothing reads — either would be a row whose `kind` and whose data disagree.
--
--  4. **CYCLES ARE REFUSED IN THE DATABASE**, by trigger, not only in the action. A template
--     containing itself — directly, or through three hops — makes instantiation
--     non-terminating, and the action that adds a step is a public HTTP endpoint (§2b) whose
--     argument is a template id the caller chose. The walk is written here, once, so a second
--     write path cannot skip it. The application keeps its own depth guard as well, because
--     the trigger closes the door and the guard is what keeps a bug behind it from spinning.
--
-- ── §D: A CASCADE IS NOT A CALLER, AND THE TASK GUARD DID NOT KNOW THE DIFFERENCE ──
-- `tg_gathering_task_same_family()` validates five ids on a `gathering_tasks` row — the
-- gathering, the template, the step, the assignee and the decider — against the row's own
-- `family_code`, on INSERT **and on UPDATE**. That is §4's rule and it is right: a task
-- carrying another family's step is a row every policy is satisfied by.
--
-- It fires on a CASCADE too, and there it was wrong. A `gathering_tasks` row can hold both
-- `template_id` and `step_id` pointing into the same template. Deleting that template makes
-- Postgres run TWO cascade actions against that one row — `template_id` SET NULL because the
-- template went, and `step_id` SET NULL because the step went with it — as separate UPDATE
-- statements. Whichever runs first presents the trigger with a row whose OTHER id still names
-- something already deleted in the same statement, the lookup finds no row, and the trigger
-- raises:
--
--   gathering_tasks: step 25a967a2-… belongs to family missing, not ALPHATEST
--
-- So an ordinary, authorized `deleteGatheringTemplate` fails with a message about a family
-- that does not exist. **FOUND BY THE RLS SUITE, not by reading**: §C added a second cascade
-- path into `gathering_template_steps` (`child_template_id`), which changed the set of cascade
-- actions and therefore their order, and
-- `admin/gathering-templates.deleteGatheringTemplate (pending member)` went red with
-- "owner's own write did nothing". The hazard predates §C — two cascades on one row is all it
-- needs — and §C is what made it reachable.
--
-- THE FIX IS TO VALIDATE WHAT IS BEING WRITTEN, WHICH IS ALL THAT WAS EVER INTENDED. On UPDATE
-- an id that has not changed was validated when it WAS written, so re-checking it buys nothing
-- and is the only thing that can fail here. `family_code` is in the test because it is what
-- every id is checked AGAINST: if that moves, every id needs looking at again — and it cannot
-- move in practice (`gathering_tasks` has no update path that touches it), which is exactly
-- why it is written down rather than assumed.
--
-- WHAT THIS DOES NOT WEAKEN. Every INSERT is checked in full, unchanged. Every UPDATE that
-- writes an id is checked, unchanged — `assignGatheringTask` writing an assignee, a review
-- writing `decided_by`. What stops being checked is a column the statement is not changing,
-- and the only way for such a column to be wrong is to have been written wrong, which the
-- write itself refused.
--
-- Verify: `npx supabase db reset`, then `npm run test:rls` and `npm test`. The case above is
-- the regression test: it goes red without §D.
-- ═══════════════════════════════════════════════════════════════════════════════════

BEGIN;

-- ── §A. The two new step kinds ─────────────────────────────────────────────────────
ALTER TABLE public.gathering_template_steps
  DROP CONSTRAINT IF EXISTS gathering_template_steps_kind_valid;

ALTER TABLE public.gathering_template_steps
  ADD CONSTRAINT gathering_template_steps_kind_valid
  CHECK (kind IN ('text', 'long_text', 'date', 'list', 'yes_no', 'number', 'money',
                  'location', 'template'));

-- `gathering_tasks.kind` gains `location` AND NOT `template` — see note 1 above.
ALTER TABLE public.gathering_tasks
  DROP CONSTRAINT IF EXISTS gathering_tasks_kind_valid;

ALTER TABLE public.gathering_tasks
  ADD CONSTRAINT gathering_tasks_kind_valid
  CHECK (kind IN ('text', 'long_text', 'date', 'list', 'yes_no', 'number', 'money',
                  'location'));

-- ── §C. The child template ─────────────────────────────────────────────────────────
ALTER TABLE public.gathering_template_steps
  ADD COLUMN IF NOT EXISTS child_template_id uuid
    REFERENCES public.gathering_templates(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS gathering_template_steps_child_idx
  ON public.gathering_template_steps (child_template_id)
  WHERE child_template_id IS NOT NULL;

ALTER TABLE public.gathering_template_steps
  DROP CONSTRAINT IF EXISTS gathering_template_steps_child_matches_kind;

ALTER TABLE public.gathering_template_steps
  ADD CONSTRAINT gathering_template_steps_child_matches_kind
  CHECK ((kind = 'template') = (child_template_id IS NOT NULL));

-- The step may not be its own parent. This is the ONE-HOP case, and it is a CHECK rather
-- than left to the trigger because a constraint states an invariant a reader can see on the
-- table; the trigger below is what catches the three-hop case a CHECK cannot express.
ALTER TABLE public.gathering_template_steps
  DROP CONSTRAINT IF EXISTS gathering_template_steps_child_is_not_parent;

ALTER TABLE public.gathering_template_steps
  ADD CONSTRAINT gathering_template_steps_child_is_not_parent
  CHECK (child_template_id IS NULL OR child_template_id <> template_id);

-- ── The family guard, widened to the child ─────────────────────────────────────────
-- §4: RLS checks the ROW, never the ids the row references, and this table's guard already
-- exists because `template_id` is exactly that shape. `child_template_id` is a second one,
-- arriving from the client through `addTemplateStep`, and without this a step of BRAVO's
-- template could name ALPHA's — a row whose own `family_code` satisfies every policy while
-- the id it carries points into another family. The trigger is what refuses it under the
-- SERVICE ROLE too, which ignores RLS and does not ignore triggers.
--
-- CYCLE DETECTION LIVES HERE AS WELL, in the same walk, because both questions are about the
-- same edge and asking them separately would mean reading the graph twice.
CREATE OR REPLACE FUNCTION public.tg_gathering_template_step_same_family()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
DECLARE
  v_template_family text;
  v_child_family    text;
  v_cycle           boolean;
BEGIN
  SELECT t.family_code INTO v_template_family
    FROM public.gathering_templates t WHERE t.id = NEW.template_id;
  IF v_template_family IS DISTINCT FROM NEW.family_code THEN
    RAISE EXCEPTION
      'gathering_template_steps: template % belongs to family %, not % — a step may only be added to its own family''s template',
      NEW.template_id, COALESCE(v_template_family, 'missing'), NEW.family_code
      USING ERRCODE = '23514';
  END IF;

  IF NEW.child_template_id IS NOT NULL THEN
    SELECT t.family_code INTO v_child_family
      FROM public.gathering_templates t WHERE t.id = NEW.child_template_id;
    IF v_child_family IS DISTINCT FROM NEW.family_code THEN
      RAISE EXCEPTION
        'gathering_template_steps: template % belongs to family %, not % — a step may only include its own family''s template',
        NEW.child_template_id, COALESCE(v_child_family, 'missing'), NEW.family_code
        USING ERRCODE = '23514';
    END IF;

    -- THE CYCLE WALK. Start at the child and follow `template` steps downwards; if the
    -- parent is reachable, adding this edge closes a loop. `UNION` (not `UNION ALL`) is what
    -- terminates the recursion over a graph that may ALREADY contain a cycle — it cannot,
    -- because this trigger has refused every one, but a recursive CTE that assumes its own
    -- invariant is a recursive CTE that hangs the day the invariant is wrong.
    --
    -- The one-hop case is a CHECK constraint as well. Both are kept: the constraint states
    -- the invariant where a reader of the table will see it, and this catches the rest.
    WITH RECURSIVE reachable(template_id) AS (
      SELECT NEW.child_template_id
      UNION
      SELECT s.child_template_id
        FROM public.gathering_template_steps s
        JOIN reachable r ON s.template_id = r.template_id
       WHERE s.child_template_id IS NOT NULL
    )
    SELECT EXISTS (SELECT 1 FROM reachable WHERE template_id = NEW.template_id)
      INTO v_cycle;

    IF v_cycle THEN
      RAISE EXCEPTION
        'gathering_template_steps: including template % in template % would make a loop — a template cannot contain itself, directly or through another',
        NEW.child_template_id, NEW.template_id
        USING ERRCODE = '23514';
    END IF;
  END IF;

  RETURN NEW;
END
$$;

-- INVOKER and `search_path = ''`, both deliberate and both unchanged from the original.
-- A SECURITY DEFINER trigger sees its own owner as `current_user` for every caller alike,
-- which is what `20260806000011` chose INVOKER over; and an unset `search_path` on a function
-- that names `public.` tables is what `db advisors` reports. No grant is needed: EXECUTE on a
-- trigger function is checked at `CREATE TRIGGER` time, not at fire time (AGENTS.md §2b).

-- ── §B. `default_location` goes ────────────────────────────────────────────────────
-- Dropped rather than left unwritten — see the header. `gathering_template_uses.location` is
-- untouched: a segment's own place is still stated per segment, and every value already
-- copied onto one stays exactly where it is. Nothing is lost by this DROP that was not
-- already recorded on the segments it had been copied to.
ALTER TABLE public.gathering_templates
  DROP COLUMN IF EXISTS default_location;

-- ── §D. The task guard, so a CASCADE is not mistaken for a write ───────────────────
CREATE OR REPLACE FUNCTION public.tg_gathering_task_same_family()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
DECLARE
  v_gathering_family text;
  v_template_family  text;
  v_step_family      text;
  v_step_template    uuid;
  v_assignee_family  text;
  v_decider_family   text;
  v_is_update  boolean := TG_OP = 'UPDATE';
  -- True when the row's own family moved, which makes every id worth re-checking. It cannot
  -- happen through any write in the application; stated so that it stays true if one appears.
  --
  -- `v_is_update AND …` and never the other way round: in a plpgsql INSERT trigger `OLD` is
  -- UNASSIGNED, so `OLD.family_code` raises `record "old" is not assigned yet`. Every test
  -- below therefore reads `NOT v_is_update OR …`, which short-circuits before touching OLD.
  v_family_moved boolean := (TG_OP = 'UPDATE') AND NEW.family_code IS DISTINCT FROM OLD.family_code;
  -- Whether the step's own family, and the step-belongs-to-template pair, are worth asking
  -- about at all. They are SEPARATE questions with separate conditions — see below.
  v_check_step_family boolean;
  v_check_step_pair   boolean;
BEGIN
  -- EACH ID IS CHECKED WHEN IT IS WRITTEN, and only then. An unchanged id was checked by the
  -- write that put it there, so re-checking it buys nothing — and it is the only thing that
  -- can FAIL here, because a CASCADE presents a row whose other columns still name rows the
  -- same statement has already deleted.
  IF (NOT v_is_update OR v_family_moved
      OR NEW.gathering_id IS DISTINCT FROM OLD.gathering_id)
     AND NEW.gathering_id IS NOT NULL THEN
    SELECT g.family_code INTO v_gathering_family
      FROM public.gatherings g WHERE g.id = NEW.gathering_id;
    IF v_gathering_family IS DISTINCT FROM NEW.family_code THEN
      RAISE EXCEPTION
        'gathering_tasks: gathering % belongs to family %, not %',
        NEW.gathering_id, COALESCE(v_gathering_family, 'missing'), NEW.family_code
        USING ERRCODE = '23514';
    END IF;
  END IF;

  IF (NOT v_is_update OR v_family_moved
      OR NEW.template_id IS DISTINCT FROM OLD.template_id)
     AND NEW.template_id IS NOT NULL THEN
    SELECT t.family_code INTO v_template_family
      FROM public.gathering_templates t WHERE t.id = NEW.template_id;
    IF v_template_family IS DISTINCT FROM NEW.family_code THEN
      RAISE EXCEPTION
        'gathering_tasks: template % belongs to family %, not %',
        NEW.template_id, COALESCE(v_template_family, 'missing'), NEW.family_code
        USING ERRCODE = '23514';
    END IF;
  END IF;

  -- ── THE STEP IS TWO QUESTIONS, AND CONFLATING THEM IS WHAT §D GOT WRONG FIRST ────
  -- Is the step this family's, and is it a step OF the template on the row? The second is why
  -- a nested-template task carries the CHILD template rather than the root
  -- (`instantiateTemplateTasks` writes `template_id` = the template the step lives on).
  --
  -- The first attempt at this fix re-asked BOTH whenever EITHER id moved, and that is exactly
  -- the cascade case: `template_id` going to NULL made `NEW.template_id IS DISTINCT FROM
  -- OLD.template_id` true, so the step's FAMILY was looked up again — and the step had already
  -- been deleted by the same statement. Measured, and the suite stayed red.
  --
  -- So: the step's family is asked only when the STEP moved. The pair is asked only when
  -- either moved AND there is still a template to pair it with — dropping `template_id` to
  -- NULL withdraws the claim rather than making a new one.
  v_check_step_family := NEW.step_id IS NOT NULL
    AND (NOT v_is_update OR v_family_moved OR NEW.step_id IS DISTINCT FROM OLD.step_id);
  v_check_step_pair := NEW.step_id IS NOT NULL AND NEW.template_id IS NOT NULL
    AND (NOT v_is_update
         OR NEW.step_id IS DISTINCT FROM OLD.step_id
         OR NEW.template_id IS DISTINCT FROM OLD.template_id);

  IF v_check_step_family OR v_check_step_pair THEN
    SELECT s.family_code, s.template_id INTO v_step_family, v_step_template
      FROM public.gathering_template_steps s WHERE s.id = NEW.step_id;

    IF v_check_step_family AND v_step_family IS DISTINCT FROM NEW.family_code THEN
      RAISE EXCEPTION
        'gathering_tasks: step % belongs to family %, not %',
        NEW.step_id, COALESCE(v_step_family, 'missing'), NEW.family_code
        USING ERRCODE = '23514';
    END IF;

    IF v_check_step_pair AND v_step_template IS DISTINCT FROM NEW.template_id THEN
      RAISE EXCEPTION
        'gathering_tasks: step % is not a step of template % (it belongs to %)',
        NEW.step_id, NEW.template_id, COALESCE(v_step_template::text, 'nothing')
        USING ERRCODE = '23514';
    END IF;
  END IF;

  IF (NOT v_is_update OR v_family_moved
      OR NEW.assignee_id IS DISTINCT FROM OLD.assignee_id)
     AND NEW.assignee_id IS NOT NULL THEN
    SELECT p.family_code INTO v_assignee_family
      FROM public.people p WHERE p.id = NEW.assignee_id;
    IF v_assignee_family IS DISTINCT FROM NEW.family_code THEN
      RAISE EXCEPTION
        'gathering_tasks: person % belongs to family %, not %',
        NEW.assignee_id, COALESCE(v_assignee_family, 'missing'), NEW.family_code
        USING ERRCODE = '23514';
    END IF;
  END IF;

  IF (NOT v_is_update OR v_family_moved
      OR NEW.decided_by IS DISTINCT FROM OLD.decided_by)
     AND NEW.decided_by IS NOT NULL THEN
    SELECT p.family_code INTO v_decider_family
      FROM public.people p WHERE p.id = NEW.decided_by;
    IF v_decider_family IS DISTINCT FROM NEW.family_code THEN
      RAISE EXCEPTION
        'gathering_tasks: person % belongs to family %, not %',
        NEW.decided_by, COALESCE(v_decider_family, 'missing'), NEW.family_code
        USING ERRCODE = '23514';
    END IF;
  END IF;

  RETURN NEW;
END
$$;

-- ── Assertions ─────────────────────────────────────────────────────────────────────
DO $$
DECLARE
  v_ok boolean;
BEGIN
  -- The two CHECKs disagree on purpose, and that is the assertion: `template` is a step kind
  -- and never a task kind.
  SELECT pg_get_constraintdef(oid) LIKE '%''template''%' INTO v_ok
    FROM pg_constraint WHERE conname = 'gathering_template_steps_kind_valid';
  IF NOT COALESCE(v_ok, false) THEN
    RAISE EXCEPTION 'gathering_step_kinds: step kinds do not include template';
  END IF;

  SELECT pg_get_constraintdef(oid) LIKE '%''template''%' INTO v_ok
    FROM pg_constraint WHERE conname = 'gathering_tasks_kind_valid';
  IF COALESCE(v_ok, false) THEN
    RAISE EXCEPTION 'gathering_step_kinds: task kinds must NOT include template — a template step expands, it never becomes a task';
  END IF;

  SELECT pg_get_constraintdef(oid) LIKE '%''location''%' INTO v_ok
    FROM pg_constraint WHERE conname = 'gathering_tasks_kind_valid';
  IF NOT COALESCE(v_ok, false) THEN
    RAISE EXCEPTION 'gathering_step_kinds: task kinds do not include location';
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.columns
     WHERE table_schema = 'public' AND table_name = 'gathering_templates'
       AND column_name = 'default_location'
  ) THEN
    RAISE EXCEPTION 'gathering_step_kinds: gathering_templates.default_location still exists';
  END IF;

  -- The trigger still fires. It is CREATE OR REPLACE on the function rather than a new
  -- trigger, so this is checking that the original binding was not dropped by an earlier
  -- migration in some future chain.
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger
     WHERE tgrelid = 'public.gathering_template_steps'::regclass
       AND tgname = 'gathering_template_steps_same_family'
       AND NOT tgisinternal
  ) THEN
    RAISE EXCEPTION 'gathering_step_kinds: the same-family trigger is not attached';
  END IF;

  -- INVOKER, per the note above. `prosecdef` true here would silently make `current_user`
  -- the owner for every caller and take the boundary away.
  SELECT NOT prosecdef INTO v_ok FROM pg_proc
   WHERE proname = 'tg_gathering_template_step_same_family';
  IF NOT COALESCE(v_ok, false) THEN
    RAISE EXCEPTION 'gathering_step_kinds: the same-family trigger must stay SECURITY INVOKER';
  END IF;

  -- §D. Both properties, because the fix would be undone by losing either: the task guard is
  -- still INVOKER, and it still tests `TG_OP` — a version that dropped the `TG_OP` test would
  -- re-introduce the cascade failure and nothing else here would notice.
  SELECT NOT prosecdef INTO v_ok FROM pg_proc
   WHERE proname = 'tg_gathering_task_same_family';
  IF NOT COALESCE(v_ok, false) THEN
    RAISE EXCEPTION 'gathering_step_kinds: the task guard must stay SECURITY INVOKER';
  END IF;

  SELECT prosrc LIKE '%TG_OP%' INTO v_ok FROM pg_proc
   WHERE proname = 'tg_gathering_task_same_family';
  IF NOT COALESCE(v_ok, false) THEN
    RAISE EXCEPTION 'gathering_step_kinds: the task guard must check only ids that CHANGED — see §D';
  END IF;
END $$;

COMMIT;
