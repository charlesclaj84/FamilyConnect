-- ============================================================================
-- Dues do not prorate. Drop `dues_member_plans.start_date`.
-- ----------------------------------------------------------------------------
-- THE DECISION THIS RECORDS
--   TODO.md asked one question — *do dues prorate for a member who joins
--   mid-period?* — and offered two answers: use this column as the floor for the
--   installment ladder, or drop it. The answer is **no, dues do not prorate**, so
--   this drops it.
--
--   That is the status quo made explicit rather than a change of behaviour.
--   Nothing in this product has ever prorated: `remainingBalanceCents` has always
--   charged a member the full annual total of a schedule they are enrolled on,
--   whichever month they were admitted, and `duesPlanMath` (20260814) itemizes
--   that same debt as arrears rather than inventing it. A family that wants a
--   half-year rate expresses it the way the schema already allows — a second
--   schedule with a smaller `amount_cents` — which is a decision an organizer
--   makes and states, not one a derivation makes on their behalf.
--
-- WHY THE COLUMN CANNOT SIMPLY BE LEFT ALONE
--   `20260610000005_accounting.sql` gave every plan row
--   `start_date DATE NOT NULL DEFAULT CURRENT_DATE`, and in the two months since,
--   NOTHING has ever read it or written it:
--
--     * `getMyDuesSummary` selects `schedule_id, cadence, opted_out` — not this.
--     * `setMyDuesPlan` upserts `cadence` and `opted_out` — not this.
--     * no policy on the table names it (all four are
--       `family_code = auth_family_code() AND person_id = auth_person_id()`),
--     * no function, index, constraint or trigger names it. Measured against the
--       local stack on 2026-08-20, not read off the migrations.
--
--   So every row carries the date its plan row happened to be created, and that
--   value has never meant anything. **That is the whole hazard.** A NOT NULL
--   column full of plausible dates is exactly the thing a future change picks up
--   and trusts: floor the ladder on it and a member who re-picked their cadence
--   last Tuesday owes from last Tuesday, which would let anybody reduce their own
--   arrears by changing cadence twice. It is the `is_minor` shape (20260813000006)
--   in a quieter costume — a stored value that describes nothing, sitting where a
--   derivation should be — and the repair is the same one: delete it, so that
--   whoever needs the fact has to decide it deliberately.
--
-- ── IF PRORATING EVER ARRIVES, WHAT IT COSTS ────────────────────────────────
--   Recorded here because it is the reason this file is longer than one line, and
--   because the next person to want it will find this migration before they find
--   TODO.md. Re-adding a column is trivial; the three things around it are not:
--
--     1. THE BALANCE HAS TO MOVE WITH THE LADDER. `remainingBalanceCents` and
--        `duesPlanMath`'s arrears are two views of ONE debt. Floor the ladder on a
--        join date while the balance still charges the annual total and the
--        member's screen shows two figures describing different debts, which is
--        worse than the un-prorated version it replaced.
--     2. IT MUST BE WRITTEN ONCE AND NEVER ON A RE-PICK — the abuse above. That
--        makes it a column with a guard, not a column with a default.
--     3. `dues_schedules.start_date` IS FROZEN once any payment references it
--        (20260807000001), so there is no data-entry remedy for a schedule whose
--        start date was wrong. The derivation is the only lever, which is what
--        makes getting it right the first time load-bearing.
--
-- ── WHY THE DROP IS SAFE IN BOTH DEPLOY ORDERINGS ───────────────────────────
--   Migrations reach hosted from CI on merge and the OLD code serves while they
--   apply (AGENTS.md, "How migrations reach the hosted project"). Both directions
--   are fine here, and it is worth saying which, because the Phase 3 incident was
--   the opposite case:
--
--     * old code + new schema — the running code never SELECTs the column, so
--       there is no 42703 to kill a query. This is the direction that broke
--       `getMyFamilies` when `membership_status` was missing.
--     * new code + old schema — the column keeps its NOT NULL DEFAULT until this
--       applies, and no INSERT in the tree names it, so the default fills it.
--
--   No `dues_member_plans` INSERT anywhere — app, seed, or `tests/rls/seed.mjs` —
--   passes `start_date`. Checked, because an INSERT naming a dropped column is
--   the one thing that would fail loudly.
-- ============================================================================

BEGIN;

-- ── 1. Refuse to run if anything has started depending on it ────────────────
-- Belt and braces, and cheap. The measurement above was taken on a laptop; this
-- one is taken on whatever database is applying the file, which is the only one
-- whose answer matters. A dependency found here means somebody wired prorating up
-- while this was pending, and the drop must not silently take it out.
DO $mig$
DECLARE
  v_attnum smallint;
  v_bad    text;
BEGIN
  SELECT attnum INTO v_attnum
    FROM pg_attribute
   WHERE attrelid = 'public.dues_member_plans'::regclass
     AND attname = 'start_date'
     AND NOT attisdropped;

  IF v_attnum IS NULL THEN
    RAISE NOTICE 'dues_member_plans.start_date is already gone — nothing to drop';
    RETURN;
  END IF;

  -- Policies. `pg_get_expr` renders the stored parse tree, so this sees a
  -- reference however the policy was written or composed.
  SELECT string_agg(polname, ', ') INTO v_bad
    FROM pg_policy
   WHERE polrelid = 'public.dues_member_plans'::regclass
     AND (coalesce(pg_get_expr(polqual, polrelid), '') ILIKE '%start_date%'
       OR coalesce(pg_get_expr(polwithcheck, polrelid), '') ILIKE '%start_date%');
  IF v_bad IS NOT NULL THEN
    RAISE EXCEPTION 'ROLLBACK: policy/policies reference start_date: %', v_bad;
  END IF;

  -- Indexes and constraints, via the dependency graph rather than by name, so a
  -- partial index or a CHECK added later is caught without being listed.
  SELECT string_agg(DISTINCT c.relname, ', ') INTO v_bad
    FROM pg_depend d
    JOIN pg_class c ON c.oid = d.objid
   WHERE d.refobjid = 'public.dues_member_plans'::regclass
     AND d.refobjsubid = v_attnum
     AND c.relkind IN ('i', 'v', 'm');
  IF v_bad IS NOT NULL THEN
    RAISE EXCEPTION 'ROLLBACK: index/view still depends on start_date: %', v_bad;
  END IF;

  SELECT string_agg(conname, ', ') INTO v_bad
    FROM pg_constraint
   WHERE conrelid = 'public.dues_member_plans'::regclass
     AND v_attnum = ANY (conkey);
  IF v_bad IS NOT NULL THEN
    RAISE EXCEPTION 'ROLLBACK: constraint(s) cover start_date: %', v_bad;
  END IF;

  -- Function bodies, which no dependency edge records: plpgsql resolves names at
  -- RUN time, so a function naming the column is created without complaint and
  -- throws for its first caller. This is the check 20260806000012 did not have.
  SELECT string_agg(p.proname, ', ') INTO v_bad
    FROM pg_proc p
   WHERE p.pronamespace = 'public'::regnamespace
     AND pg_get_functiondef(p.oid) ILIKE '%dues_member_plans%'
     AND pg_get_functiondef(p.oid) ILIKE '%start_date%';
  IF v_bad IS NOT NULL THEN
    RAISE EXCEPTION 'ROLLBACK: function(s) name both the table and start_date: %', v_bad;
  END IF;
END $mig$;

-- ── 2. Drop it ──────────────────────────────────────────────────────────────
-- No CASCADE, deliberately. §1 has already established that nothing depends on
-- the column, so CASCADE could only ever destroy something §1 failed to find —
-- silently, which is the opposite of what that block is for.
ALTER TABLE public.dues_member_plans DROP COLUMN IF EXISTS start_date;

-- ── 3. Verify ───────────────────────────────────────────────────────────────
-- Both directions. "The column is gone" alone would pass against a table that had
-- lost its policies along with it, and the four `person_id = auth_person_id()`
-- policies are the entire boundary on this table — there is no permission key in
-- `permission_table_map` for it, because a member's own cadence is self-service.
DO $mig$
DECLARE
  v_count int;
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_attribute
     WHERE attrelid = 'public.dues_member_plans'::regclass
       AND attname = 'start_date' AND NOT attisdropped
  ) THEN
    RAISE EXCEPTION 'ROLLBACK: dues_member_plans.start_date survived the drop';
  END IF;

  SELECT count(*) INTO v_count
    FROM pg_policy WHERE polrelid = 'public.dues_member_plans'::regclass;
  IF v_count <> 4 THEN
    RAISE EXCEPTION 'ROLLBACK: expected 4 policies on dues_member_plans, found %', v_count;
  END IF;

  -- The columns a member's enrolment actually consists of. Named individually so
  -- that a future drop taking the wrong one is caught here rather than by a
  -- member finding their cadence reset.
  SELECT count(*) INTO v_count
    FROM pg_attribute
   WHERE attrelid = 'public.dues_member_plans'::regclass
     AND NOT attisdropped AND attnum > 0
     AND attname IN ('id', 'family_code', 'person_id', 'schedule_id', 'cadence', 'opted_out');
  IF v_count <> 6 THEN
    RAISE EXCEPTION 'ROLLBACK: expected the 6 load-bearing plan columns, found %', v_count;
  END IF;

  RAISE NOTICE 'dues_member_plans.start_date dropped; dues do not prorate';
END $mig$;

COMMIT;
