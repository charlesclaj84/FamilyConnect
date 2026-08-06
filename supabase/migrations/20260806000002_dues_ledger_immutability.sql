-- ============================================================================
-- Make the dues ledger append-only, including against the service role.
--
-- WHY A TRIGGER AND NOT RLS
--   Every accounting write in this application runs through createAdminClient().
--   The service role bypasses RLS entirely — so 20260806000001's policies, correct
--   as they are, cannot bind the application's own code path. The service role does
--   NOT bypass triggers. A BEFORE UPDATE OR DELETE trigger is therefore the only
--   layer that both the browser and the app must pass, and the only place
--   "a posted payment cannot be altered" can actually be made true.
--
-- COST: NONE. The sole UPDATE against dues_payments anywhere in the repo is
-- routePaidPayment stamping routed_at (app/actions/dues.ts:254). There is no
-- updatePayment and no deletePayment action, so freezing the ledger removes no
-- existing capability — it prevents one being added by accident.
--
-- ─────────────────────────────────────────────────────────────────────────────
-- THE HARD PART: FOUR REFERENTIAL-INTEGRITY PATHS WRITE TO THIS TABLE
--
--   dues_payments.person_id    REFERENCES people(id)             ON DELETE CASCADE
--   dues_payments.schedule_id  REFERENCES dues_schedules(id)     ON DELETE SET NULL
--   dues_payments.recorded_by  REFERENCES people(id)             ON DELETE SET NULL
--   dues_payments.plan_id      REFERENCES dues_member_plans(id)  ON DELETE SET NULL
--
--   A naive trigger breaks all four, and the failures are nasty because the error
--   message points at accounting rather than at the foreign key:
--
--     * deleteDuesSchedule -> SET NULL on schedule_id -> "dues_payments is immutable".
--       Deleting any schedule that has ever been paid becomes impossible.
--
--     * deleting a member -> CASCADE on person_id -> the DELETE is rejected.
--
--     * deleting a member -> SET NULL on recorded_by, hitting every payment that
--       person recorded FOR SOMEONE ELSE. Those rows are not cascade-deleted, so this
--       is a live UPDATE. After R1 lands, treasurers are the only people who record
--       payments, which makes "you cannot delete a treasurer" the NORMAL case rather
--       than an edge case. Worse, it is order-dependent: RI triggers fire in an
--       effectively arbitrary order, so even the self-recorded case fails
--       intermittently depending on whether SET NULL runs before CASCADE.
--
--     * clearMyDuesPlan / deleteDuesSchedule -> SET NULL on plan_id. Harmless only
--       because nothing populates plan_id yet — a landmine armed by the first line of
--       Pay Online code that does.
--
--   All four RI actions run as AFTER triggers on the PARENT row, so by the time the
--   child statement runs the parent is already gone. `NOT EXISTS` against the parent
--   is therefore an exact discriminator: it is true for the RI action and false for a
--   direct malicious write, which is why it is used instead of pg_trigger_depth().
--
-- WHAT IS PERMITTED, AND ONLY THIS
--   1. routed_at            — routePaidPayment stamps it after insert.
--   2. processor_ref        — NULL -> value once, so a webhook can record its receipt.
--   3. status               — 'pending' -> 'paid' ONLY. This keeps the standard
--                             online-payment settlement shape available (insert
--                             pending at checkout, settle on webhook) without ever
--                             allowing a paid row to be walked back, re-opened, or
--                             converted to 'waived' after the fact. Nothing else about
--                             the row may move with it — the amount is frozen.
--   4. the four RI nulls above, each gated on its parent genuinely being gone.
--
--   Everything else — amount_cents, person_id, payment_date, payment_method, notes,
--   family_code, source, created_at, id — is frozen for everyone, including the
--   service role, including an administrator.
--
-- NOT SOLVED HERE, and worth knowing: deleting a MEMBER still cascade-deletes their
-- payment history. The trigger permits it so member deletion keeps working. The ledger
-- can therefore still be erased a person at a time; changing that means ON DELETE
-- RESTRICT and a soft-delete story, which is a separate decision.
--
-- IDEMPOTENT. Safe to re-run.
-- ============================================================================

BEGIN;

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

-- ── Verify ──────────────────────────────────────────────────────────────────
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger
     WHERE tgname = 'dues_payments_immutable'
       AND tgrelid = 'public.dues_payments'::regclass
       AND NOT tgisinternal
  ) THEN
    RAISE EXCEPTION 'ROLLBACK: immutability trigger was not installed';
  END IF;
END $$;

COMMIT;
