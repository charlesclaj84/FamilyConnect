-- ═══════════════════════════════════════════════════════════════════════════════════════
-- THE BILLING CYCLE GETS A CREDIT BALANCE, AND THE SWEEP GETS A CLOCK.
--
-- Two things, and they are in one file because neither is useful without the other: the
-- upgrade credit is what makes a mid-term upgrade fair, and the scheduler is what makes any
-- of the dated rules in this feature actually happen.
--
-- ── §1. WHY A CREDIT COLUMN AT ALL ────────────────────────────────────────────────────
-- Decided 2026-08-23. Upgrading a family that paid ahead values the unused part of the old
-- term AT THE OLD RATE and spends it on the new tier. The worked example, at the 10/20/30
-- prices:
--
--     6 months of Standard bought 1 Jan (through 30 Jun), upgrading to Premium on 15 Feb
--
--     unused at the OLD rate     rest of Feb $5.00 + Mar..Jun $40.00   =  $45.00
--     rest of Feb at the NEW rate           $30 x 14/28                =  $15.00
--     ---------------------------------------------------------------------------
--     due now                                                             $0.00
--     credit carried                                                     $30.00
--
-- What is NOT charged is the difference across the whole prepaid term — 6 x $20 = $120 — which
-- was ruled out explicitly: it is a bill nobody asked for on the day they chose to spend more.
-- `upgradeQuote` in lib/platform-billing.ts is the arithmetic and is mutation-tested against
-- exactly this example.
--
-- ── AND WHY IT IS MIRRORED HERE RATHER THAN ONLY AT STRIPE ────────────────────────────
-- **Stripe is the ledger of record.** A customer credit balance
-- (`customers.createBalanceTransaction`) is what actually reduces the next invoice, and this
-- column is a local copy so a screen can say "$30.00 in credit" without a round trip on every
-- page load. That makes it exactly the kind of derived value AGENTS.md §4b warns about — a
-- stored figure that can disagree with the truth — so the rule is stated on the column: it is
-- for DISPLAY, nothing reads it to decide an amount, and a family's invoice is reduced by
-- Stripe's balance and never by this number.
--
-- NON-NEGATIVE, by CHECK. A negative credit is a debt, and a debt wearing a credit's name is
-- how a family comes to be shown money they do not have. `upgradeQuote` already floors both of
-- its outputs at zero; this is the second layer, on the column, where a future writer cannot
-- forget it.
--
-- ── §2. THE SCHEDULER, AND WHAT IT UNBLOCKS ───────────────────────────────────────────
-- `apply_due_platform_tier_changes()` has existed since 20260823000004 with no clock. Its own
-- header says so at length: it is called at the end of every Stripe webhook delivery, which is
-- EXACT for a monthly renewal (the invoice IS the period boundary) and a real gap for a term
-- bought outright — a family that prepaid three months in January keeps its tier until some
-- OTHER family's payment happens to arrive, and on a product with nobody paying, until nothing
-- does.
--
-- `pg_cron` closes that. It is in `shared_preload_libraries` on this stack (measured, both
-- locally and on the hosted project) so `CREATE EXTENSION` is all that is required.
--
-- ── A CRON JOB IS DATABASE STATE, WHICH IS THE INVISIBILITY CLASS AGENTS.md NAMES ─────
-- `db:check` compares migration versions, `db:audit` reads policies, and a fresh `db reset`
-- schedules nothing. That is the same hole realtime publication membership sat in for months —
-- and the same rule applies: **it is created in a migration and asserted in the same file**,
-- never in the dashboard. A job created by hand is drift, and AGENTS.md's warning about an
-- instruction in a migration addressed to a person applies word for word.
--
-- HOURLY RATHER THAN DAILY, at five past. The dates are UTC and change at midnight, so a
-- single daily run at 00:05 would be exact — and hourly is chosen anyway because it is
-- idempotent, costs nothing on a table with a partial index, and a missed run then delays a
-- family's tier change by an hour instead of a day. Five past rather than on the hour so it is
-- not sharing a minute with every other hourly job on the instance.
--
-- IDEMPOTENT. `cron.schedule` upserts on the job name, so re-running replaces rather than
-- duplicating — verified below by scheduling twice and counting.
-- ═══════════════════════════════════════════════════════════════════════════════════════

BEGIN;

-- ── §1. The credit balance ─────────────────────────────────────────────────────────────
ALTER TABLE public.platform_billing_accounts
  ADD COLUMN IF NOT EXISTS credit_cents INT NOT NULL DEFAULT 0;

-- Added separately and idempotently: `ADD COLUMN … CHECK` is not re-runnable, and this file has
-- to be safe to replay against a database that already has the column.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
     WHERE conrelid = 'public.platform_billing_accounts'::regclass
       AND conname = 'platform_billing_credit_non_negative'
  ) THEN
    ALTER TABLE public.platform_billing_accounts
      ADD CONSTRAINT platform_billing_credit_non_negative CHECK (credit_cents >= 0);
  END IF;
END $$;

COMMENT ON COLUMN public.platform_billing_accounts.credit_cents IS
  'Unused value carried forward from an upgrade, in cents. A DISPLAY MIRROR of the Stripe '
  'customer credit balance, which is the ledger of record and the thing that actually reduces '
  'an invoice. Nothing reads this to decide an amount.';

-- ── §2. The clock ──────────────────────────────────────────────────────────────────────
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- The sweep, hourly. `apply_due_platform_tier_changes()` takes no arguments, is idempotent,
-- and only ever touches a family that has a `platform_billing_accounts` row — so it is safe to
-- run forever against a database where nobody has ever paid, which is every laptop.
--
-- ── IT RUNS AS THE MIGRATION'S OWN ROLE, AND THAT IS WHY THE FUNCTION IS DEFINER ──────
-- A cron job has no `auth.uid()` and no JWT claims at all. `families_guard_tier`
-- (20260813000003) refuses a tier change only when the JWT `role` claim is 'authenticated', so
-- a job with no claims passes — which is the same reason the webhook's service-role call
-- passes, arrived at from the other direction. Nothing here weakens that guard: the browser
-- still cannot move a tier.
SELECT cron.schedule(
  'platform-tier-sweep',
  '5 * * * *',
  $job$SELECT public.apply_due_platform_tier_changes()$job$
);

-- ── §3. VERIFY ─────────────────────────────────────────────────────────────────────────
DO $mig$
DECLARE
  v_n INT;
BEGIN
  -- 1. The column, its default, and its floor.
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
     WHERE table_schema = 'public' AND table_name = 'platform_billing_accounts'
       AND column_name = 'credit_cents' AND is_nullable = 'NO'
  ) THEN
    RAISE EXCEPTION 'credit_cents is missing or nullable';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
     WHERE conrelid = 'public.platform_billing_accounts'::regclass
       AND conname = 'platform_billing_credit_non_negative'
  ) THEN
    RAISE EXCEPTION 'credit_cents has no non-negative CHECK — a debt could wear a credit''s name';
  END IF;

  -- 2. THE FLOOR IS ASSERTED BY TRYING TO CROSS IT, not by reading the catalogue. A CHECK that
  --    exists and does not bite is the failure mode AGENTS.md records twice (a `NOT
  --    has_function_privilege` assertion that passed for ten seconds; a column-level grant that
  --    narrowed nothing). The subtransaction is the only way to attempt a refused write and
  --    carry on, and the sentinel is compared by MESSAGE so a DIFFERENT failure is not
  --    swallowed as a pass.
  BEGIN
    INSERT INTO public.platform_billing_accounts (family_code, credit_cents)
    VALUES ('ZZCREDIT', -1);
    RAISE EXCEPTION 'a negative credit was accepted';
  EXCEPTION
    WHEN check_violation THEN NULL;
  END;
  DELETE FROM public.platform_billing_accounts WHERE family_code = 'ZZCREDIT';

  -- 3. The job exists, exactly once, and is enabled.
  SELECT count(*) INTO v_n FROM cron.job WHERE jobname = 'platform-tier-sweep';
  IF v_n <> 1 THEN
    RAISE EXCEPTION 'expected exactly one platform-tier-sweep job, found %', v_n;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'platform-tier-sweep' AND active) THEN
    RAISE EXCEPTION 'the platform-tier-sweep job exists and is not active';
  END IF;

  -- 4. AND RE-SCHEDULING DOES NOT DUPLICATE IT, which is what makes this file replayable.
  --    Asserted by doing it: a `cron.schedule` that INSERTED rather than upserted would leave
  --    two jobs running the sweep every hour, and nothing else in the repo could see that.
  PERFORM cron.schedule('platform-tier-sweep', '5 * * * *',
    $job$SELECT public.apply_due_platform_tier_changes()$job$);
  SELECT count(*) INTO v_n FROM cron.job WHERE jobname = 'platform-tier-sweep';
  IF v_n <> 1 THEN
    RAISE EXCEPTION 're-scheduling duplicated the job — % rows', v_n;
  END IF;

  -- 5. The job's command must actually run. plpgsql resolves nothing until a body executes, so
  --    a mis-qualified reference in the scheduled SQL would sit in `cron.job` looking correct
  --    and fail every hour in a log nobody reads. Calling it here is the only thing that says
  --    otherwise, and it must move nothing on a database with no billing rows.
  SELECT public.apply_due_platform_tier_changes() INTO v_n;
  IF v_n <> 0 THEN
    RAISE EXCEPTION 'the scheduled sweep moved % families on a database with no billing rows', v_n;
  END IF;

  RAISE NOTICE 'billing cycle: credit_cents floored at 0, platform-tier-sweep scheduled hourly.';
END $mig$;

COMMIT;
