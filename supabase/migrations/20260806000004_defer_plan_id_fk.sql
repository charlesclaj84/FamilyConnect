-- ============================================================================
-- Make dues_payments.plan_id survive a schedule deletion.
--
-- PRE-EXISTING BUG, currently latent. Not introduced by the immutability trigger —
-- reproduced with that trigger DISABLED — but armed by the first code that populates
-- plan_id, which is exactly what Pay Online will do.
--
-- THE CHAIN
--   dues_member_plans.schedule_id  REFERENCES dues_schedules(id)    ON DELETE CASCADE
--   dues_payments.plan_id          REFERENCES dues_member_plans(id) ON DELETE SET NULL
--   dues_payments.schedule_id      REFERENCES dues_schedules(id)    ON DELETE SET NULL
--
--   Deleting a schedule fires all three. The SET NULL on schedule_id issues an UPDATE
--   against dues_payments while that row's plan_id still points at a dues_member_plans
--   row the CASCADE has already removed, and the immediate FK check on that UPDATE
--   fails:
--
--     insert or update on table "dues_payments" violates foreign key constraint
--     "dues_payments_plan_id_fkey"
--
--   So deleting any dues schedule that has both a member plan and a payment aborts.
--   Today every plan_id is NULL — a repo-wide grep for plan_id over the TypeScript
--   returns nothing — so the RI update matches no rows and deleteDuesSchedule appears
--   to work. It stops working silently the moment plan_id is written, and surfaces as
--   "deleting a dues schedule fails with an accounting error".
--
-- THE FIX
--   Defer the plan_id check to commit. The intermediate state — plan_id briefly naming
--   a row already deleted in the same statement — is exactly what DEFERRABLE exists
--   for; by commit the SET NULL has run and the column is NULL.
--
--   Verified against the four RI paths in 20260806000002: after this, deleting a
--   schedule that has plans and payments succeeds and leaves the payment row intact
--   with plan_id and schedule_id both NULL. The payment itself is never destroyed —
--   which is the point, since it is a record of money that changed hands.
--
-- IDEMPOTENT: re-running re-creates the same deferrable constraint.
-- ============================================================================

BEGIN;

ALTER TABLE public.dues_payments
  DROP CONSTRAINT IF EXISTS dues_payments_plan_id_fkey;

ALTER TABLE public.dues_payments
  ADD CONSTRAINT dues_payments_plan_id_fkey
  FOREIGN KEY (plan_id) REFERENCES public.dues_member_plans(id) ON DELETE SET NULL
  DEFERRABLE INITIALLY DEFERRED;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
     WHERE conname = 'dues_payments_plan_id_fkey'
       AND condeferrable AND condeferred
  ) THEN
    RAISE EXCEPTION 'ROLLBACK: plan_id FK is not deferrable';
  END IF;
END $$;

COMMIT;
