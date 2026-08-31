-- ═══════════════════════════════════════════════════════════════════════════════════
-- STRIPE PROCESSING FEES — who pays them, what they actually were, and where they land
-- ═══════════════════════════════════════════════════════════════════════════════════
--
-- Until now a card payment recorded its GROSS and nothing else. `20260823000005` set
-- `fees_collector: 'stripe'`, so the family pays Stripe's fee out of its own balance — and
-- nothing in the product knew the figure. A $40 due credited the family's funds $40 while
-- about $38.54 reached their bank, permanently, with no screen able to explain the gap.
--
-- ── THE TWO FEE NUMBERS, WHICH ARE NEVER THE SAME THING ────────────────────────────
-- `lib/stripe-fees.ts` states this at length and the schema below encodes it:
--
--   ESTIMATED  computed from the family's STATED rate (`fee_percent_bps`/`fee_fixed_cents`)
--              to decide what to CHARGE. A forecast, made before Stripe has seen the card.
--   ACTUAL     `balance_transaction.fee`, after the charge settled. A measured fact, and the
--              only thing that reaches `stripe_charge_fees`.
--
-- They differ for an international card, an Amex, a currency conversion, or a negotiated rate
-- nobody typed in. THE DIFFERENCE IS ABSORBED BY THE FAMILY. The alternative is billing a
-- member a second time for a charge they have completed, for an amount nobody quoted them.
--
-- No column here holds an estimate, and none may. A stored forecast beside a measured fact is
-- the two-facts-that-disagree trap AGENTS.md names for `is_minor` and for
-- `dues_member_plans.start_date` — plausible, unowned, and wrong the moment a card differs.
--
-- ── WHY THE FEE IS NOT A COLUMN ON `dues_payments` ─────────────────────────────────
-- Three reasons, and the second is decisive:
--
--   1. A FEE BELONGS TO A CHARGE, NOT TO A DUE. One Checkout Session settles several dues
--      since 2026-08-25 (`readAllocations`), so one fee has to be divided across several
--      rows. The charge-level fact needs somewhere to live that is not one of its parts.
--   2. `dues_payments` IS APPEND-ONLY and `dues_payments_immutable()` freezes `amount_cents`,
--      `source` and the rest. The fee arrives LATER than the payment — `balance_transaction`
--      is not populated when `checkout.session.completed` fires — so a fee column would have
--      to be written by an UPDATE to a frozen row. Amending that trigger to admit one late
--      write is exactly the erosion it exists to prevent.
--   3. The fee is not always attributable to a due at all. A refund's fee, a dispute fee and
--      a payout fee are all charges against the family with no `dues_payments` row anywhere.
--      Only the dues share is apportioned; the table can hold the rest when it needs to.
--
-- ── AND WHY THE FUNDS ARE CORRECTED RATHER THAN ROUTED NET ─────────────────────────
-- `routePaidPayment` runs the moment the payment posts and sends the GROSS down the family's
-- waterfall. It stays that way. Waiting for the fee before routing would mean a payment that
-- reaches no fund at all if the settlement event is ever missed — trading a small permanent
-- overstatement for an occasional total one.
--
-- Instead the fee is removed from the funds afterwards, as NEGATIVE `fund_contributions` rows
-- carrying `source = 'stripe_fee'`, apportioned across the funds the payment routed into. That
-- is not a new idea here: `20260806000003` already does exactly this for a reversal, down to
-- the negative-amount CHECK, and re-using the shape means `fund_balance_cents()` needs no new
-- term and every existing fund screen is correct with no edit.

BEGIN;

-- ═══ 1. WHO PAYS, AND AT WHAT STATED RATE ══════════════════════════════════════════
--
-- ON `family_stripe_accounts`, WHICH IS PER FAMILY AND NOT PER SCHEDULE. Two reasons. It is a
-- property of the PROCESSING ARRANGEMENT — it belongs beside the `acct_…` it governs, and it
-- is meaningless for a family with no connected account. And one Checkout Session already
-- settles several schedules at once, so a per-schedule setting would need a rule for which
-- policy wins in a mixed session, or would have to split one payment into several charges,
-- each paying its own 30c. A family that wants that distinction can say so in the amount.
ALTER TABLE public.family_stripe_accounts
  -- 'family'  the family absorbs the fee. A member owing $40 is charged $40, the family
  --           banks ~$38.54, and the member's dues fall the full $40. The default, because
  --           it is what happens today and a migration must not silently start surcharging.
  -- 'member'  the charge is GROSSED UP so the family banks what was owed. A member owing $40
  --           is charged $41.50 and their dues fall $40. See `grossUpCents`.
  ADD COLUMN IF NOT EXISTS fee_payer TEXT NOT NULL DEFAULT 'family',
  -- The STATED rate, used only to compute a gross-up. Basis points, never a float — `0.029`
  -- has no exact representation and a rate a hair under what was intended under-charges every
  -- grossed-up payment forever.
  ADD COLUMN IF NOT EXISTS fee_percent_bps INT NOT NULL DEFAULT 290,
  ADD COLUMN IF NOT EXISTS fee_fixed_cents INT NOT NULL DEFAULT 30;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'family_stripe_accounts_fee_payer_valid') THEN
    ALTER TABLE public.family_stripe_accounts
      ADD CONSTRAINT family_stripe_accounts_fee_payer_valid
      CHECK (fee_payer IN ('family', 'member'));
  END IF;

  -- A CEILING ON THE STATED RATE, and it is not arbitrary. `grossUpCents` has no fixed point
  -- at or above 100% — every extra cent charged is entirely consumed — so a rate there makes
  -- the gross-up unsolvable and the member unable to pay at all. 50% is far above any real
  -- card rate and far below the point where the arithmetic breaks, which is what a guard on a
  -- typed figure should be: it catches a slipped decimal without having an opinion about
  -- anybody's negotiated pricing.
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'family_stripe_accounts_fee_rate_sane') THEN
    ALTER TABLE public.family_stripe_accounts
      ADD CONSTRAINT family_stripe_accounts_fee_rate_sane
      CHECK (fee_percent_bps >= 0 AND fee_percent_bps <= 5000
             AND fee_fixed_cents >= 0 AND fee_fixed_cents <= 1000);
  END IF;
END $$;

COMMENT ON COLUMN public.family_stripe_accounts.fee_payer IS
  'Who bears Stripe''s processing fee: ''family'' (absorbed) or ''member'' (charge grossed up). Never decides what is RECORDED as the fee — see stripe_charge_fees.';
COMMENT ON COLUMN public.family_stripe_accounts.fee_percent_bps IS
  'The family''s STATED percentage rate, in basis points, used only to quote a gross-up. Never the actual fee.';

-- ═══ 2. WHAT STRIPE ACTUALLY TOOK ══════════════════════════════════════════════════
--
-- One row per settled charge, written by the Connect webhook from `balance_transaction`.
CREATE TABLE IF NOT EXISTS public.stripe_charge_fees (
  id                     UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  family_code            TEXT        NOT NULL,
  -- The `acct_…` the charge happened on. Kept alongside `family_code` for the reason the
  -- Connect handler resolves one from the other: this row is written on a path with no
  -- session and no caller, and the account is the only key it starts from.
  stripe_account_id      TEXT        NOT NULL,

  -- THE IDEMPOTENCY KEY, and the reason this table is safe under redelivery. Stripe resends
  -- on a 500, on a timeout, and days later in the ordinary course — past its own 24-hour
  -- window. UNIQUE on the CHARGE, never on the balance transaction: a charge has exactly one
  -- of each today, and keying on the charge is what makes a second delivery collide rather
  -- than write a second fee against the same money.
  charge_id              TEXT        NOT NULL UNIQUE,
  balance_transaction_id TEXT,

  gross_cents            INT         NOT NULL,
  fee_cents              INT         NOT NULL,
  -- STORED, not derived, and that is deliberate. `net = gross - fee` holds for a card charge
  -- and does NOT hold once a balance transaction carries anything else Stripe nets out. This
  -- column records what the balance transaction SAID; a generated column would record what
  -- this migration assumed.
  net_cents              INT         NOT NULL,
  currency               TEXT        NOT NULL,
  -- When the money becomes available in the family's Stripe balance. Nullable: not every
  -- balance transaction has settled by the time the event arrives.
  available_on           DATE,

  created_at             TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Every read is "this family's fees", so the family code leads.
CREATE INDEX IF NOT EXISTS stripe_charge_fees_family_idx
  ON public.stripe_charge_fees (family_code, created_at DESC);

-- ═══ 3. EACH PAYMENT'S SHARE OF ITS CHARGE ═════════════════════════════════════════
--
-- One charge settles up to five dues, so the charge-level fee is divided across the rows it
-- paid — by `apportionCents`, largest-remainder, so the shares sum to the fee EXACTLY. Without
-- this table a per-schedule or per-member fee figure could only be estimated, which is the one
-- thing this whole feature exists to stop doing.
CREATE TABLE IF NOT EXISTS public.dues_payment_fees (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  family_code   TEXT        NOT NULL,
  -- ON DELETE CASCADE is unreachable and correct: `dues_payments` refuses every DELETE
  -- (`dues_payments_immutable`), so this can only fire if that rule is ever relaxed — and if a
  -- payment could vanish, its fee share must go with it rather than dangle.
  payment_id    UUID        NOT NULL UNIQUE REFERENCES public.dues_payments(id) ON DELETE CASCADE,
  charge_fee_id UUID        NOT NULL REFERENCES public.stripe_charge_fees(id) ON DELETE CASCADE,
  fee_cents     INT         NOT NULL CHECK (fee_cents >= 0),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS dues_payment_fees_family_idx
  ON public.dues_payment_fees (family_code);
CREATE INDEX IF NOT EXISTS dues_payment_fees_charge_idx
  ON public.dues_payment_fees (charge_fee_id);

-- ═══ 4. RLS: ENABLED, WITH NO POLICY, DELIBERATELY ═════════════════════════════════
--
-- AGENTS.md §2c: a table created here is born readable AND writable by `anon` and
-- `authenticated` through Supabase's default ACL, and RLS is the entire boundary — a table
-- with no policy for a command denies that command outright. Both of these are read only by
-- reports, which go through the admin client with `.eq('family_code', …)` by hand (§3), for
-- the reason every other report does: a fee total narrowed to what the READER may see is a
-- WRONG number rather than a withheld one.
--
-- Same posture as `family_stripe_accounts` and `dues_autopay`, which `app/actions/pay-dues.ts`
-- documents. A policy here would be the first step toward publishing a family's processing
-- costs to its whole membership.
ALTER TABLE public.stripe_charge_fees ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.dues_payment_fees  ENABLE ROW LEVEL SECURITY;

-- ═══ 5. THE FUND CONTRA-ENTRY ══════════════════════════════════════════════════════
--
-- `source = 'stripe_fee'` on a NEGATIVE `fund_contributions` row: the fee leaving the funds
-- the payment routed into. Both CHECKs have to be widened — the vocabulary and the sign guard
-- — exactly as `20260806000003` widened them for `'reversal'`, which is the same shape doing
-- the same job.
ALTER TABLE public.fund_contributions
  DROP CONSTRAINT IF EXISTS fund_contributions_source_valid,
  DROP CONSTRAINT IF EXISTS fund_contributions_amount_sign;

ALTER TABLE public.fund_contributions
  ADD CONSTRAINT fund_contributions_source_valid
    CHECK (source IN ('dues_routing', 'admin_manual', 'reversal', 'stripe_fee')),
  ADD CONSTRAINT fund_contributions_amount_sign
    -- Negative for the two MIRROR sources and for nothing else. A negative admin_manual row
    -- would be a treasurer taking money out of a fund through the contributions form, which
    -- is what `fund_disbursements` is for and what this guard has always refused.
    CHECK (amount_cents >= 0 OR source IN ('reversal', 'stripe_fee'));

-- ═══ 6. VERIFY ═════════════════════════════════════════════════════════════════════
--
-- Unconditional: none of this needs a fixture, so none of it may be skipped. AGENTS.md's
-- warning about `20260806000012` is that a verify block which can return early reports success
-- over a function that cannot run.
DO $$
DECLARE
  n INT;
BEGIN
  -- 6a. The setting exists and defaults to the status quo. A migration that silently began
  --     surcharging every member of every family would be this feature shipping as an
  --     incident.
  SELECT count(*) INTO n
  FROM information_schema.columns
  WHERE table_schema = 'public' AND table_name = 'family_stripe_accounts'
    AND column_name IN ('fee_payer', 'fee_percent_bps', 'fee_fixed_cents');
  IF n <> 3 THEN
    RAISE EXCEPTION 'family_stripe_accounts is missing a fee column (found % of 3)', n;
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.family_stripe_accounts WHERE fee_payer <> 'family'
  ) THEN
    RAISE EXCEPTION 'a family was migrated onto member-pays, which this migration must never do';
  END IF;

  -- 6b. NO COLUMN ANYWHERE MAY LOOK LIKE A STORED ESTIMATE. The header's whole argument is
  --     that an estimate and a measured fee must not sit in the same shape; this is what
  --     stops the next migration adding `estimated_fee_cents` beside `fee_cents`.
  SELECT count(*) INTO n
  FROM information_schema.columns
  WHERE table_schema = 'public'
    AND table_name IN ('stripe_charge_fees', 'dues_payment_fees')
    AND (column_name LIKE '%estimate%' OR column_name LIKE '%quoted%');
  IF n > 0 THEN
    RAISE EXCEPTION 'a fee table gained an estimate column — see this migration''s header';
  END IF;

  -- 6c. AND NO CREDENTIAL, which is `20260823000005`'s rule extended to the tables that
  --     joined its feature. It is asserted rather than promised because its violation would
  --     break nothing and cost everything.
  SELECT count(*) INTO n
  FROM information_schema.columns
  WHERE table_schema = 'public'
    AND table_name IN ('stripe_charge_fees', 'dues_payment_fees')
    AND (column_name LIKE '%secret%' OR column_name LIKE '%api_key%'
         OR column_name LIKE '%private_key%' OR column_name LIKE '%access_token%');
  IF n > 0 THEN
    RAISE EXCEPTION 'a fee table carries something shaped like a credential';
  END IF;

  -- 6d. RLS on, and ZERO policies on both. The gate is the absence of a policy (§2c), so its
  --     absence is the thing worth asserting — a policy added later would publish a family's
  --     processing costs to every member holding the key it was written against.
  IF NOT (SELECT relrowsecurity FROM pg_class WHERE oid = 'public.stripe_charge_fees'::regclass)
     OR NOT (SELECT relrowsecurity FROM pg_class WHERE oid = 'public.dues_payment_fees'::regclass) THEN
    RAISE EXCEPTION 'a fee table has RLS switched off';
  END IF;

  SELECT count(*) INTO n FROM pg_policies
  WHERE schemaname = 'public' AND tablename IN ('stripe_charge_fees', 'dues_payment_fees');
  IF n <> 0 THEN
    RAISE EXCEPTION 'a fee table has % polic(ies); it is meant to have none — see section 4', n;
  END IF;

  -- 6e. The contra-entry is actually possible. Asserted by reading the constraint back rather
  --     than by trusting the ALTER, which is how `20260822000013` learned to check policies.
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'fund_contributions_source_valid'
      AND pg_get_constraintdef(oid) LIKE '%stripe_fee%'
  ) THEN
    RAISE EXCEPTION 'fund_contributions still refuses source = stripe_fee';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'fund_contributions_amount_sign'
      AND pg_get_constraintdef(oid) LIKE '%stripe_fee%'
  ) THEN
    RAISE EXCEPTION 'fund_contributions still refuses a NEGATIVE stripe_fee row';
  END IF;

  -- 6f. And the vocabulary did not lose a value on the way past. Dropping and re-adding a
  --     CHECK is the one edit that can quietly narrow it.
  IF NOT (SELECT pg_get_constraintdef(oid) LIKE '%reversal%'
          FROM pg_constraint WHERE conname = 'fund_contributions_source_valid') THEN
    RAISE EXCEPTION 'the source vocabulary lost ''reversal'' while gaining ''stripe_fee''';
  END IF;

  RAISE NOTICE 'Stripe fees: fee_payer defaults to family; fees recorded per charge and apportioned per payment.';
END $$;

COMMIT;
