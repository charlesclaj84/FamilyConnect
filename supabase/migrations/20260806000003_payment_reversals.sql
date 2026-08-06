-- ============================================================================
-- Reversals: the correction path an append-only ledger needs.
--
-- 20260806000002 froze dues_payments. That is right — a posted payment is a record of
-- something that happened — but with no correction path a treasurer who fat-fingers an
-- amount has no recourse at all. The accounting answer is not to edit the row; it is to
-- post an equal and opposite one and leave both visible.
--
-- SHAPE
--   A reversal is an ordinary dues_payments row with:
--     * amount_cents  = -(original.amount_cents)
--     * reverses_id   = the original's id
--     * same person_id, schedule_id and family_code as the original
--   dues_payments.amount_cents has no CHECK, so negatives were already representable.
--
-- THE MIRROR, AND WHY IT IS NOT A RE-RUN OF THE WATERFALL
--   A paid payment is split across funds by routePaidPayment's priority waterfall.
--   Reversing it must undo THAT split — the negated mirror of the fund_contributions
--   rows the original actually produced. Re-running the waterfall would allocate
--   against today's fund priorities and balances, so money would come back out of
--   whichever funds happen to be low now rather than the ones it went into. Over time
--   that silently moves money between funds with no record of a transfer.
--   fund_contributions.amount_cents CHECK (>= 0) is therefore relaxed for, and only
--   for, rows carrying the new 'reversal' source.
--
-- ONE REVERSAL PER PAYMENT, enforced by a partial unique index rather than by the
-- application, so a double-click cannot double-reverse.
--
-- reverses_id IS ON DELETE CASCADE, deliberately: a reversal has no meaning without
-- the row it reverses, and both belong to the same person, so they already disappear
-- together when that member is deleted. CASCADE also means reverses_id never receives
-- an RI *update*, so unlike the other four foreign keys it can be frozen outright —
-- which the trigger below does.
--
-- IDEMPOTENT. Safe to re-run.
-- ============================================================================

BEGIN;

-- ── 1. The link ─────────────────────────────────────────────────────────────
ALTER TABLE public.dues_payments
  ADD COLUMN IF NOT EXISTS reverses_id UUID REFERENCES public.dues_payments(id) ON DELETE CASCADE;

CREATE UNIQUE INDEX IF NOT EXISTS dues_payments_reverses_uniq
  ON public.dues_payments (reverses_id) WHERE reverses_id IS NOT NULL;

-- A row cannot reverse itself.
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'dues_payments_reverses_not_self') THEN
    ALTER TABLE public.dues_payments
      ADD CONSTRAINT dues_payments_reverses_not_self CHECK (reverses_id IS NULL OR reverses_id <> id);
  END IF;
END $$;

-- ── 2. Let the mirror contributions be negative ─────────────────────────────
ALTER TABLE public.fund_contributions
  DROP CONSTRAINT IF EXISTS fund_contributions_source_check,
  DROP CONSTRAINT IF EXISTS fund_contributions_amount_cents_check;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fund_contributions_source_valid') THEN
    ALTER TABLE public.fund_contributions
      ADD CONSTRAINT fund_contributions_source_valid
      CHECK (source IN ('dues_routing', 'admin_manual', 'reversal'));
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fund_contributions_amount_sign') THEN
    ALTER TABLE public.fund_contributions
      ADD CONSTRAINT fund_contributions_amount_sign
      -- Negative only for a reversal mirror; every other source stays non-negative.
      CHECK (amount_cents >= 0 OR source = 'reversal');
  END IF;
END $$;

-- ── 3. Freeze reverses_id, and let a reversal's own row settle normally ─────
-- Re-declared here rather than in 20260806000002 because the column does not exist
-- until this migration runs. Everything else about the function is unchanged.
CREATE OR REPLACE FUNCTION public.dues_payments_immutable()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    IF NOT EXISTS (SELECT 1 FROM public.people WHERE id = OLD.person_id) THEN
      RETURN OLD;
    END IF;
    RAISE EXCEPTION 'dues_payments is append-only: payment % cannot be deleted', OLD.id
      USING ERRCODE = '42501';
  END IF;

  IF NEW.id             IS DISTINCT FROM OLD.id
     OR NEW.family_code    IS DISTINCT FROM OLD.family_code
     OR NEW.person_id      IS DISTINCT FROM OLD.person_id
     OR NEW.amount_cents   IS DISTINCT FROM OLD.amount_cents
     OR NEW.payment_date   IS DISTINCT FROM OLD.payment_date
     OR NEW.payment_method IS DISTINCT FROM OLD.payment_method
     OR NEW.notes          IS DISTINCT FROM OLD.notes
     OR NEW.source         IS DISTINCT FROM OLD.source
     OR NEW.created_at     IS DISTINCT FROM OLD.created_at
     -- ON DELETE CASCADE, so this never receives an RI update: freeze it outright.
     OR NEW.reverses_id    IS DISTINCT FROM OLD.reverses_id
  THEN
    RAISE EXCEPTION 'dues_payments is immutable: payment % cannot be altered', OLD.id
      USING ERRCODE = '42501';
  END IF;

  IF NEW.status IS DISTINCT FROM OLD.status
     AND NOT (OLD.status = 'pending' AND NEW.status = 'paid')
  THEN
    RAISE EXCEPTION 'dues_payments.status may only settle pending -> paid (payment %)', OLD.id
      USING ERRCODE = '42501';
  END IF;

  IF NEW.processor_ref IS DISTINCT FROM OLD.processor_ref
     AND OLD.processor_ref IS NOT NULL
  THEN
    RAISE EXCEPTION 'dues_payments.processor_ref is write-once (payment %)', OLD.id
      USING ERRCODE = '42501';
  END IF;

  IF NEW.schedule_id IS DISTINCT FROM OLD.schedule_id
     AND NOT (NEW.schedule_id IS NULL
              AND NOT EXISTS (SELECT 1 FROM public.dues_schedules WHERE id = OLD.schedule_id))
  THEN
    RAISE EXCEPTION 'dues_payments.schedule_id is immutable (payment %)', OLD.id
      USING ERRCODE = '42501';
  END IF;

  IF NEW.recorded_by IS DISTINCT FROM OLD.recorded_by
     AND NOT (NEW.recorded_by IS NULL
              AND NOT EXISTS (SELECT 1 FROM public.people WHERE id = OLD.recorded_by))
  THEN
    RAISE EXCEPTION 'dues_payments.recorded_by is immutable (payment %)', OLD.id
      USING ERRCODE = '42501';
  END IF;

  IF NEW.plan_id IS DISTINCT FROM OLD.plan_id
     AND NOT (NEW.plan_id IS NULL
              AND NOT EXISTS (SELECT 1 FROM public.dues_member_plans WHERE id = OLD.plan_id))
  THEN
    RAISE EXCEPTION 'dues_payments.plan_id is immutable (payment %)', OLD.id
      USING ERRCODE = '42501';
  END IF;

  RETURN NEW;
END $$;

-- ── 4. Who may reverse ──────────────────────────────────────────────────────
-- Its own key, so reversing is separable from recording: the person who posts
-- payments need not be the person who can undo one.
INSERT INTO public.permission_resources (key, label, category, subsection, sort_order, actions)
VALUES ('transactions/reversals', 'Payment Reversals', 'accounting', 'Transactions', 120, ARRAY['create']::TEXT[])
ON CONFLICT (key) DO UPDATE
  SET label = EXCLUDED.label, category = EXCLUDED.category,
      subsection = EXCLUDED.subsection, sort_order = EXCLUDED.sort_order,
      actions = EXCLUDED.actions;

-- The insert policy from 20260806000001 accepts the two recording keys; a reversal is
-- also an insert into dues_payments, so it needs its key admitted there too.
DROP POLICY IF EXISTS "perm:dues_payments:insert" ON public.dues_payments;
CREATE POLICY "perm:dues_payments:insert"
  ON public.dues_payments FOR INSERT TO authenticated
  WITH CHECK (
    family_code = public.auth_family_code()
    AND source        = 'manual'
    AND processor_ref IS NULL
    AND routed_at     IS NULL
    AND recorded_by   = public.auth_person_id()
    AND (
      public.auth_permission('transactions/dues-payments',      'create'::public.permission_action) = 'any'
      OR public.auth_permission('transactions/donation-payments', 'create'::public.permission_action) = 'any'
      OR (reverses_id IS NOT NULL
          AND public.auth_permission('transactions/reversals',    'create'::public.permission_action) = 'any')
    )
  );

-- ── 5. Verify ───────────────────────────────────────────────────────────────
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
     WHERE table_schema = 'public' AND table_name = 'dues_payments' AND column_name = 'reverses_id'
  ) THEN
    RAISE EXCEPTION 'ROLLBACK: reverses_id was not added';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fund_contributions_amount_sign') THEN
    RAISE EXCEPTION 'ROLLBACK: fund_contributions amount constraint not replaced';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.permission_resources WHERE key = 'transactions/reversals') THEN
    RAISE EXCEPTION 'ROLLBACK: reversals resource missing';
  END IF;
END $$;

COMMIT;
