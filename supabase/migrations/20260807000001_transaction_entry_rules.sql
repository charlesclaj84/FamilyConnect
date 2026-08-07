-- ============================================================================
-- Manual money entry: give dues payments a reference, and freeze the terms of a
-- dues schedule once the ledger has been posted against it.
--
-- THREE CHANGES, ALL ADDITIVE:
--
--   1. dues_payments.payment_reference — the cheque number or confirmation code a
--      manually recorded dues/donation payment arrived on. fund_contributions
--      (20260805000000) and fund_disbursements (20260805000001) have had this column
--      for two days; dues_payments was the one ledger where "$25 from Marcus" could
--      not be tied to anything on a bank statement. Free text, same as the two it
--      mirrors: not everything arrives on a cheque.
--
--   2. dues_payments_immutable() re-created to FREEZE that new column. This is the
--      part that is easy to miss. That trigger enumerates the columns that may not
--      change, so a column added afterwards is mutable by default — the one
--      exception in an otherwise append-only ledger. payment_reference is a payment
--      detail exactly like payment_method, and joins it in the frozen list.
--
--   3. dues_schedules_freeze_used_terms() — a used dues schedule's financial terms
--      stop being editable.
--
-- ─────────────────────────────────────────────────────────────────────────────
-- WHY (3) IS A TRIGGER AND NOT A CHECK IN THE ACTION
--
--   Same argument as 20260806000002. Every accounting write in this application runs
--   through createAdminClient(), and the service role bypasses RLS — so a policy
--   cannot bind the app's own code path, and updateDuesSchedule() is then the ONLY
--   thing standing between a stale form and a repriced due that members have already
--   paid against. The service role does not bypass triggers.
--
--   The rule matters because a dues schedule is not a document, it is the terms of an
--   obligation, and every payment already posted was posted against THOSE terms.
--   Moving amount_cents afterwards silently restates what every member owed for a
--   period they have already settled: getMyDuesSummary recomputes annualTotalCents
--   from the schedule on every read, so last year's paid-up member becomes this
--   morning's debtor with no ledger entry saying why. Moving start_date is the same
--   defect through currentPeriodStart(), which decides which payments count toward
--   the current period at all — slide it forward and payments that settled the period
--   drop out of it.
--
--   WHAT IS FROZEN, AND ONLY WHEN
--     dues,     any payment row references it  -> start_date, amount_cents, frequency
--     donation, a PAID payment references it   -> start_date
--
--   frequency is frozen with amount_cents rather than separately: together they are
--   what is owed (annualTotalCents multiplies one by the other), so freezing the
--   amount alone would leave the same restatement available one field over.
--
--   A donation is not an obligation — nobody owes it and amount_cents is pinned to 0
--   — so only its start_date is at stake, and only once real money has arrived
--   against it. An unfunded drive is still just a plan.
--
--   NOT frozen, deliberately: label, description, end_date. Renaming a due or fixing
--   its description restates nothing — no computation in the app reads them. end_date
--   is the field the family is meant to still control, subject to (4).
--
--   4. A dues end_date being CHANGED must not land in the past. Extending or
--      shortening the window a due is collected over is a forward-looking decision;
--      back-dating it retires the due for a period members are still inside.
--      Only checked when the value actually MOVES — a schedule that ended last
--      March can still have its name corrected.
--
--      The floor is CURRENT_DATE - 1, not CURRENT_DATE, and the day of slack is
--      load-bearing rather than lazy. The date in the form is the BROWSER's local
--      date; CURRENT_DATE here is UTC. A treasurer in Pacific time picking "today"
--      any evening after 5pm is picking a date UTC has already left, and a strict
--      floor would reject their own today for seven hours out of every twenty-four.
--      The client's `min` attribute is what holds the honest case to local today;
--      this floor exists to refuse a date that is past by any margin that cannot be
--      timezone skew.
--
-- IDEMPOTENT. Safe to re-run.
-- ============================================================================

BEGIN;

-- ── 1. The reference column ─────────────────────────────────────────────────
ALTER TABLE dues_payments
  ADD COLUMN IF NOT EXISTS payment_reference TEXT;

COMMENT ON COLUMN dues_payments.payment_reference IS
  'Check number, transfer confirmation or other reference a manually recorded payment arrived on. Frozen after insert by dues_payments_immutable().';

-- ── 2. Re-create the immutability trigger with payment_reference frozen ──────
-- Reproduced in full rather than patched: the function is the whole statement of
-- what may move on a posted payment, and a partial version of it would be a worse
-- artefact than a repeated one. Only the payment_reference conjunct is new — see
-- 20260806000002 for the reasoning behind every other branch, particularly the
-- `NOT EXISTS` discriminator that keeps the four referential-integrity paths working.
CREATE OR REPLACE FUNCTION public.dues_payments_immutable()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  -- ── DELETE ────────────────────────────────────────────────────────────────
  -- Permitted only as the CASCADE from a people row that is already gone.
  IF TG_OP = 'DELETE' THEN
    IF NOT EXISTS (SELECT 1 FROM public.people WHERE id = OLD.person_id) THEN
      RETURN OLD;
    END IF;
    RAISE EXCEPTION 'dues_payments is append-only: payment % cannot be deleted', OLD.id
      USING ERRCODE = '42501';
  END IF;

  -- ── UPDATE ────────────────────────────────────────────────────────────────
  -- Columns that may never change, under any circumstances.
  IF NEW.id            IS DISTINCT FROM OLD.id
     OR NEW.family_code   IS DISTINCT FROM OLD.family_code
     OR NEW.person_id     IS DISTINCT FROM OLD.person_id
     OR NEW.amount_cents  IS DISTINCT FROM OLD.amount_cents
     OR NEW.payment_date  IS DISTINCT FROM OLD.payment_date
     OR NEW.payment_method IS DISTINCT FROM OLD.payment_method
     -- New in 20260807000001. A payment detail exactly like payment_method above:
     -- the reference is evidence of how the money arrived, and evidence that can be
     -- rewritten after the fact is not evidence.
     OR NEW.payment_reference IS DISTINCT FROM OLD.payment_reference
     OR NEW.notes         IS DISTINCT FROM OLD.notes
     OR NEW.source        IS DISTINCT FROM OLD.source
     OR NEW.created_at    IS DISTINCT FROM OLD.created_at
  THEN
    RAISE EXCEPTION 'dues_payments is immutable: payment % cannot be altered', OLD.id
      USING ERRCODE = '42501';
  END IF;

  -- status: 'pending' -> 'paid' only.
  IF NEW.status IS DISTINCT FROM OLD.status
     AND NOT (OLD.status = 'pending' AND NEW.status = 'paid')
  THEN
    RAISE EXCEPTION 'dues_payments.status may only settle pending -> paid (payment %)', OLD.id
      USING ERRCODE = '42501';
  END IF;

  -- processor_ref: may be stamped once, never rewritten or cleared.
  IF NEW.processor_ref IS DISTINCT FROM OLD.processor_ref
     AND OLD.processor_ref IS NOT NULL
  THEN
    RAISE EXCEPTION 'dues_payments.processor_ref is write-once (payment %)', OLD.id
      USING ERRCODE = '42501';
  END IF;

  -- schedule_id: only the ON DELETE SET NULL from a schedule that is already gone.
  IF NEW.schedule_id IS DISTINCT FROM OLD.schedule_id
     AND NOT (NEW.schedule_id IS NULL
              AND NOT EXISTS (SELECT 1 FROM public.dues_schedules WHERE id = OLD.schedule_id))
  THEN
    RAISE EXCEPTION 'dues_payments.schedule_id is immutable (payment %)', OLD.id
      USING ERRCODE = '42501';
  END IF;

  -- recorded_by: only the ON DELETE SET NULL from a person who is already gone.
  -- This is the one that makes treasurers deletable.
  IF NEW.recorded_by IS DISTINCT FROM OLD.recorded_by
     AND NOT (NEW.recorded_by IS NULL
              AND NOT EXISTS (SELECT 1 FROM public.people WHERE id = OLD.recorded_by))
  THEN
    RAISE EXCEPTION 'dues_payments.recorded_by is immutable (payment %)', OLD.id
      USING ERRCODE = '42501';
  END IF;

  -- plan_id: only the ON DELETE SET NULL from a plan that is already gone.
  IF NEW.plan_id IS DISTINCT FROM OLD.plan_id
     AND NOT (NEW.plan_id IS NULL
              AND NOT EXISTS (SELECT 1 FROM public.dues_member_plans WHERE id = OLD.plan_id))
  THEN
    RAISE EXCEPTION 'dues_payments.plan_id is immutable (payment %)', OLD.id
      USING ERRCODE = '42501';
  END IF;

  -- routed_at is intentionally unconstrained: routePaidPayment stamps it.
  RETURN NEW;
END $$;

REVOKE ALL ON FUNCTION public.dues_payments_immutable() FROM PUBLIC;

DROP TRIGGER IF EXISTS dues_payments_immutable ON public.dues_payments;
CREATE TRIGGER dues_payments_immutable
  BEFORE UPDATE OR DELETE ON public.dues_payments
  FOR EACH ROW EXECUTE FUNCTION public.dues_payments_immutable();

-- ── 3 + 4. Freeze the terms of a schedule the ledger has been posted against ──
CREATE OR REPLACE FUNCTION public.dues_schedules_freeze_used_terms()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  -- Read from the STORED row. `kind` is not editable through updateDuesSchedule,
  -- and taking it from NEW would let a write choose which rules apply to it.
  v_kind text := CASE WHEN OLD.kind = 'donation' THEN 'donation' ELSE 'dues' END;
  v_terms_moved boolean :=
        NEW.start_date   IS DISTINCT FROM OLD.start_date
     OR NEW.amount_cents IS DISTINCT FROM OLD.amount_cents
     OR NEW.frequency    IS DISTINCT FROM OLD.frequency;
  v_used boolean;
BEGIN
  -- The end-date floor first: it applies whether or not anything has been posted,
  -- and only when the value actually moves. See (4) in the header for why the floor
  -- is CURRENT_DATE - 1 rather than CURRENT_DATE.
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
    RAISE EXCEPTION 'Payments have been recorded against this due, so its start date, amount and frequency can no longer change (schedule %)', OLD.id
      USING ERRCODE = '42501';
  END IF;

  RETURN NEW;
END $$;

REVOKE ALL ON FUNCTION public.dues_schedules_freeze_used_terms() FROM PUBLIC;

DROP TRIGGER IF EXISTS dues_schedules_freeze_used_terms ON public.dues_schedules;
CREATE TRIGGER dues_schedules_freeze_used_terms
  BEFORE UPDATE ON public.dues_schedules
  FOR EACH ROW EXECUTE FUNCTION public.dues_schedules_freeze_used_terms();

-- ── Verify ──────────────────────────────────────────────────────────────────
-- Unconditional: everything asserted here is schema, so none of it needs a fixture
-- and none of it can be skipped into a false pass (AGENTS.md, on 20260806000012).
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
     WHERE table_schema = 'public' AND table_name = 'dues_payments'
       AND column_name = 'payment_reference'
  ) THEN
    RAISE EXCEPTION 'ROLLBACK: dues_payments.payment_reference was not added';
  END IF;

  -- The frozen list is the reason this migration re-creates the function at all, so
  -- assert the new conjunct is really in the installed body rather than trusting that
  -- the CREATE OR REPLACE above was the version that took.
  IF NOT EXISTS (
    SELECT 1 FROM pg_proc
     WHERE oid = 'public.dues_payments_immutable()'::regprocedure
       AND prosrc LIKE '%payment_reference%'
  ) THEN
    RAISE EXCEPTION 'ROLLBACK: dues_payments_immutable() does not freeze payment_reference';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger
     WHERE tgname = 'dues_payments_immutable'
       AND tgrelid = 'public.dues_payments'::regclass
       AND NOT tgisinternal
  ) THEN
    RAISE EXCEPTION 'ROLLBACK: immutability trigger was not re-installed';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger
     WHERE tgname = 'dues_schedules_freeze_used_terms'
       AND tgrelid = 'public.dues_schedules'::regclass
       AND NOT tgisinternal
  ) THEN
    RAISE EXCEPTION 'ROLLBACK: schedule-terms trigger was not installed';
  END IF;

  RAISE NOTICE 'transaction entry rules: OK';
END $$;

COMMIT;
