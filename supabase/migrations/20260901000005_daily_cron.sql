-- ═══════════════════════════════════════════════════════════════════════════════════════
-- BOTH SCHEDULED JOBS RUN ONCE A DAY, JUST AFTER MIDNIGHT UTC
-- ═══════════════════════════════════════════════════════════════════════════════════════
-- 2026-09-01. `platform-tier-sweep` (20260823000006) and `platform-billing-ladder`
-- (20260901000002) both shipped hourly. They are daily now, and the third schedule in this
-- product — the Vercel cron that drains the notice queue — moves with them in `vercel.json`.
--
-- ── WHY DAILY IS EXACT RATHER THAN A CONCESSION ────────────────────────────────────────
-- Both jobs decide everything from `CURRENT_DATE`: a term that ended, a delinquency that
-- reached day 5, 15, 30, 45 or 60, a withheld window that reached day 60. Those are DATES, in
-- UTC, and a date changes once a day at midnight. So twenty-three of every twenty-four runs
-- were asking a question whose answer could not have changed since the last one.
--
-- `20260823000006` said so when it chose hourly — *"the dates are UTC and change at midnight,
-- so a single daily run at 00:05 would be exact"* — and picked hourly anyway for a reason that
-- is honest and small: a missed run then costs an hour rather than a day. This file takes the
-- other side of that trade, and the times are the ones that comment already identified.
--
-- ── WHAT IT COSTS, STATED RATHER THAN WAVED AT ─────────────────────────────────────────
-- Three things get slower, and none of them is the thing that matters:
--
--   * A missed run delays a family's tier change or ladder step by a day. `pg_cron` does not
--     catch up a run it missed, so a database that was down at 00:05 waits until tomorrow.
--   * A FAILED NOTICE RETRIES DAILY. `finish_platform_billing_notice` puts a failed row back to
--     `pending` and gives up at five attempts, so a mail outage now burns those five attempts
--     over five days rather than five hours. **That is the safe direction**: both deletion paths
--     refuse to act unless the notices they owed are recorded `sent`, so a slower retry
--     postpones a deletion and can never permit one.
--   * The stale-claim recovery window is unchanged at 15 minutes, and does not want to be. It
--     covers a drain that died mid-batch, which is a property of that request rather than of
--     the schedule.
--
-- ── AND WHAT DOES *NOT* GET SLOWER, WHICH IS THE POINT ─────────────────────────────────
-- **A tier change somebody PAID for still lands within seconds.**
-- `app/api/stripe/platform/route.ts` calls `applyDuePlatformTierChanges()` at the end of every
-- signature-verified delivery, so an upgrade, a downgrade taking effect and a renewal are all
-- applied by the webhook. The cron is the BACKSTOP for the one case that produces no event at
-- all: a term simply lapsing. Nobody waits a day for a purchase.
--
-- ── THE ORDER IS LOAD-BEARING AND IS PRESERVED EXACTLY ─────────────────────────────────
-- Three schedules, and each depends on the one before it:
--
--     00:05 UTC   platform-tier-sweep        a term that ended moves the tier
--     00:20 UTC   platform-billing-ladder    measures AFTER that, enqueues notices, deletes
--     00:40 UTC   POST /api/billing/notices  sends what was enqueued (vercel.json)
--
-- The gaps are the hourly file's own gaps, kept rather than re-derived. The ladder must not
-- share a minute with the sweep it depends on, and the mail must not be composed before the
-- state it describes is settled.
--
-- ── AND `vercel.json` HAD A SECOND REASON TO MOVE ──────────────────────────────────────
-- Vercel's Hobby plan permits cron jobs at a DAILY granularity only; an hourly expression is
-- rejected at deploy time on that plan and silently costs nothing on Pro. Making it daily means
-- the same file deploys on either, which removes a class of "it works on my plan".
--
-- ── IDEMPOTENT, LIKE THE FILES IT AMENDS ───────────────────────────────────────────────
-- `cron.schedule` upserts on the job name, so this REPLACES the hourly entries rather than
-- adding to them, and a replay is a no-op. The earlier migrations are left exactly as they
-- are: editing an applied file changes fresh databases only and would never reach hosted
-- (AGENTS.md, "How migrations reach the hosted project"), so on a `db reset` the jobs are
-- created hourly and moved here, and on hosted they are moved here from wherever they are.
-- Either way the final state is what this file asserts.
-- ═══════════════════════════════════════════════════════════════════════════════════════

BEGIN;

-- ── §1. THE TWO SCHEDULES ──────────────────────────────────────────────────────────────
-- The commands are repeated verbatim from the files that created them. `cron.schedule` takes
-- the whole job, so a re-schedule that changed the SQL by accident would be invisible — §2
-- asserts the command as well as the timing for that reason.

SELECT cron.schedule(
  'platform-tier-sweep',
  '5 0 * * *',
  $job$SELECT public.apply_due_platform_tier_changes()$job$
);

SELECT cron.schedule(
  'platform-billing-ladder',
  '20 0 * * *',
  $job$SELECT public.sweep_platform_billing()$job$
);

-- ── §2. VERIFY ─────────────────────────────────────────────────────────────────────────
DO $mig$
DECLARE
  v_n         INT;
  v_sched     TEXT;
  v_cmd       TEXT;
  v_sweep_min INT;
  v_ladd_min  INT;
  r           RECORD;
BEGIN
  -- 1. Each job exists exactly once and is active. The upsert is what makes that true on a
  --    replay; asserting it is what says the upsert happened rather than an insert.
  FOR r IN SELECT unnest(ARRAY['platform-tier-sweep','platform-billing-ladder']) AS jobname
  LOOP
    SELECT count(*) INTO v_n FROM cron.job j WHERE j.jobname = r.jobname;
    IF v_n <> 1 THEN
      RAISE EXCEPTION 'ROLLBACK: expected exactly one % job, found %', r.jobname, v_n;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM cron.job j WHERE j.jobname = r.jobname AND j.active) THEN
      RAISE EXCEPTION 'ROLLBACK: % exists and is not active', r.jobname;
    END IF;
  END LOOP;

  -- 2. The timing AND the command, together. A schedule change that dropped the SQL would
  --    leave a job that runs on time and does nothing, which no other check in this repo could
  --    see — `db:check` compares versions and `db:audit` reads policies; a cron row is neither.
  SELECT j.schedule, j.command INTO v_sched, v_cmd
    FROM cron.job j WHERE j.jobname = 'platform-tier-sweep';
  IF v_sched <> '5 0 * * *' THEN
    RAISE EXCEPTION 'ROLLBACK: platform-tier-sweep is scheduled %, expected 5 0 * * *', v_sched;
  END IF;
  IF v_cmd NOT LIKE '%apply_due_platform_tier_changes%' THEN
    RAISE EXCEPTION 'ROLLBACK: platform-tier-sweep no longer runs the tier sweep: %', v_cmd;
  END IF;

  SELECT j.schedule, j.command INTO v_sched, v_cmd
    FROM cron.job j WHERE j.jobname = 'platform-billing-ladder';
  IF v_sched <> '20 0 * * *' THEN
    RAISE EXCEPTION 'ROLLBACK: platform-billing-ladder is scheduled %, expected 20 0 * * *', v_sched;
  END IF;
  IF v_cmd NOT LIKE '%sweep_platform_billing%' THEN
    RAISE EXCEPTION 'ROLLBACK: platform-billing-ladder no longer runs the ladder: %', v_cmd;
  END IF;

  -- 3. THE ORDER, DERIVED FROM THE ROWS RATHER THAN FROM THE TWO LITERALS ABOVE. The ladder
  --    measures state the sweep has just moved, so it must run strictly after it on the same
  --    day. Reading both minutes back out of `cron.job` means a future edit to one schedule
  --    and not the other is caught here rather than by a family whose tier changed after the
  --    ladder had already decided it had not.
  SELECT split_part(j.schedule, ' ', 1)::int INTO v_sweep_min
    FROM cron.job j WHERE j.jobname = 'platform-tier-sweep';
  SELECT split_part(j.schedule, ' ', 1)::int INTO v_ladd_min
    FROM cron.job j WHERE j.jobname = 'platform-billing-ladder';
  IF v_ladd_min <= v_sweep_min THEN
    RAISE EXCEPTION
      'ROLLBACK: the ladder runs at :% and the tier sweep it depends on at :% — the ladder '
      'would measure a tier the sweep had not yet moved', v_ladd_min, v_sweep_min;
  END IF;

  -- 4. AND THE RULE ITSELF, DERIVED: every job this product owns runs at most once a day.
  --    Listed job names go stale the moment a third is added — the lesson
  --    `audit_global_lookups.sql` learned from a hand-written keep-list — so the test is the
  --    HOUR FIELD of every `platform-` job: a literal hour runs daily, and a `*` or a step
  --    runs more often. A fourth job added hourly by accident fails this line.
  FOR r IN SELECT j.jobname, j.schedule FROM cron.job j WHERE j.jobname LIKE 'platform-%'
  LOOP
    IF split_part(r.schedule, ' ', 2) ~ '[*/,-]' THEN
      RAISE EXCEPTION
        'ROLLBACK: % is scheduled "%" — the hour field is not a single literal, so it runs '
        'more than once a day. Everything these jobs read is a UTC DATE.', r.jobname, r.schedule;
    END IF;
  END LOOP;

  -- 5. Both commands still RESOLVE. plpgsql resolves nothing until a body runs, so a
  --    mis-qualified reference in scheduled SQL sits in `cron.job` looking perfectly correct
  --    and fails once a day into a log nobody reads. Calling each one is the only thing that
  --    says otherwise, and on a database with no billing rows both must move nothing.
  --    `20260823000006` §5 makes this same call for the same reason; it is repeated because
  --    the schedule changing is exactly when somebody might also retype the command.
  SELECT public.apply_due_platform_tier_changes() INTO v_n;
  IF v_n <> 0 THEN
    RAISE EXCEPTION 'ROLLBACK: the scheduled sweep moved % families on a database with no '
                    'billing rows', v_n;
  END IF;
  PERFORM public.sweep_platform_billing();

  RAISE NOTICE 'cron: platform-tier-sweep 00:05 UTC, platform-billing-ladder 00:20 UTC, both daily.';
END $mig$;

COMMIT;
