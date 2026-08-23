-- ═══════════════════════════════════════════════════════════════════════════════════════
-- A FAMILY'S OWN STRIPE ACCOUNT, and members paying their dues online.
--
-- The counterpart to 20260823000004 and the opposite direction of money. That file is a
-- family paying GENORRA; this is a relative paying THEIR FAMILY, into the family's own bank
-- account, with GENORRA nowhere in the flow but the software.
--
-- ── WE STORE AN ACCOUNT ID. WE DO NOT STORE A KEY, AND WE MUST NOT START ──────────────
-- `payment_info.md` §4 is the long version and it is the single most important decision in
-- this feature. The tempting shortcut is a field where a treasurer pastes their
-- `sk_live_…`; there is no such column here and there must never be one.
--
--   a family's secret key      a credential that OWNS their money. It can refund everything,
--                              read full customer PII, and change their bank details. Nothing
--                              scopes it, we could not verify what a hand-built restricted
--                              key was allowed to do, and a breach of GENORRA would be a
--                              total compromise of every family's Stripe account at once.
--                              Stripe's own terms forbid a third party holding one.
--   an `acct_…` id             an IDENTIFIER. Useless without our platform key, revocable by
--                              the family from their own Dashboard, and it arrives with an
--                              event when they revoke it.
--
-- So the account id is the whole of what we keep, and every call acting for a family is our
-- platform key plus a `Stripe-Account` header — `onAccount()` in lib/stripe/client.ts, which
-- is deliberately the only place that header is set so a grep for it is the complete list.
--
-- ── THE FAMILY IS THE MERCHANT OF RECORD. DIRECT CHARGES, `dashboard: full` ───────────
-- `payment_info.md` §3 chose this over Express/destination charges and the reasons are worth
-- restating because they are the reasons this schema is as thin as it is:
--
--   the family pays Stripe's processing fees      not GENORRA
--   Stripe bears negative-balance liability       not GENORRA (`losses_collector: 'stripe'`)
--   Stripe issues the 1099-K to the family        GENORRA is out of that conversation
--   the family's name is on the card statement    which for dues is clearer anyway
--
-- What it gives up is control: the family can disconnect whenever they like, sets its own
-- payout schedule, and handles its own refunds and disputes. All three are correct for a
-- family's own money and none of them is a thing this schema tries to model.
--
-- AND CRUCIALLY: **GENORRA TAKES NO CUT.** No `application_fee_amount` anywhere in
-- `app/actions/pay-dues.ts`, and no column here to hold one. A platform fee on a family
-- collecting its own reunion dues is a pricing decision nobody has taken, and adding one
-- later is a line of code — whereas taking one now and reversing it means refunding families.
-- TODO.md carries it as an open question rather than a default.
--
-- ── WHAT LANDS IN `dues_payments`, AND WHY THAT IS THE RIGHT TABLE ────────────────────
-- The exact opposite of 20260823000004's rule, and both are right. A dues payment made with
-- a card IS the family's money and belongs in the family's ledger — same table, same fund
-- routing, same P&L, same member payment history as a cheque recorded by hand. The schema was
-- built for it: `dues_payments.source` has permitted `'stripe'` since 20260610000005 and
-- `(source, processor_ref)` has carried a unique index since the same file, explicitly for
-- webhook-retry idempotency. This migration adds no column to that table.
--
-- What it does NOT do is let a member attest their own payment. `20260806000001` pins
-- `source`, `processor_ref` and `routed_at` in the INSERT policy precisely so a browser can
-- never claim `source='stripe'`, and that policy is untouched: the row is written by the
-- webhook on the service role, after Stripe has said the money moved.
--
-- ── TWO TABLES, ZERO POLICIES, FIVE GUARD TRIGGERS ───────────────────────────────────
-- The Gatherings arrangement (20260819000000) for the same reasons. §2c: a new table is born
-- readable and writable by both browser roles, RLS is the entire boundary, and a table with no
-- policy for a command denies it. Every write goes through a gated server action on the
-- service role which re-applies family scoping by hand (§3) — and because the service role
-- ignores RLS and does NOT ignore triggers, the guards below refuse a cross-family id
-- underneath it (§4).
--
-- NO SELECT POLICY EITHER, which is a step further than Gatherings went and is deliberate.
-- `family_stripe_accounts` holds a processor identifier; `dues_autopay` holds a card
-- arrangement. A member's own autopay is genuinely theirs to see, and they see it through
-- `getMyDuesSummary`'s gated read rather than off PostgREST — which also means there is no
-- policy on this pair that could participate in the mutual-recursion class of bug
-- 20260823000001 §7 records (`42P17`, invisible to every verify block and to the whole
-- feature, because the admin client does not evaluate RLS).
--
-- IDEMPOTENT. Safe to re-run.
-- ═══════════════════════════════════════════════════════════════════════════════════════

BEGIN;

-- ── §1. family_stripe_accounts ─────────────────────────────────────────────────────────
--
-- ONE ACCOUNT PER FAMILY. Not one per treasurer: the account belongs to the FAMILY, and a
-- second one would split its dues across two bank accounts with no screen able to say which
-- payments went where. `family_code` is UNIQUE and a reconnection updates the row rather than
-- inserting beside it.
--
-- `disconnected_at` RATHER THAN A DELETE, and the reason is the same one that makes
-- `families.status` a soft flag: `dues_payments.processor_ref` rows point at charges on this
-- account forever, and a treasurer asking "what was this payment?" a year after disconnecting
-- needs the account id to still be here. A row is never deleted; reconnecting the same account
-- clears the timestamp.
CREATE TABLE IF NOT EXISTS public.family_stripe_accounts (
  id                 UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  family_code        TEXT        NOT NULL UNIQUE,

  -- The `acct_…`. UNIQUE across the product: one Stripe account must not be claimed by two
  -- families, or a payment arriving on the Connect webhook could not be attributed. That is
  -- not hypothetical — `connectAccountOf(event)` is the only family-scoping key the Connect
  -- handler has, so this uniqueness is what makes AGENTS.md §3's obligation dischargeable at
  -- all on that path.
  stripe_account_id  TEXT        NOT NULL UNIQUE,

  -- ── THE CAPABILITY, NOT `charges_enabled` ────────────────────────────────────────────
  -- Stripe's v2 guidance is explicit: check
  -- `configuration.merchant.capabilities.card_payments.status`, and do NOT use
  -- `charges_enabled`, which is a deprecated v1 field. They disagree during onboarding — an
  -- account can have submitted everything and still be `pending` while Stripe verifies — and
  -- offering members a Pay Online button in that window produces a checkout that fails at the
  -- till. Free text for the same reason `subscription_status` is: it is Stripe's vocabulary.
  card_payments_status TEXT,
  -- Whether the family finished the onboarding form. Distinct from the capability above: a
  -- family can complete every field and still be under review, and the two facts want
  -- different sentences on screen.
  details_submitted  BOOLEAN     NOT NULL DEFAULT false,
  country            TEXT,

  -- Who connected it, for the audit question a treasurer change makes somebody ask. Nullable
  -- via ON DELETE SET NULL — a treasurer who leaves the family must stay deletable, the rule
  -- `dues_payments.recorded_by` already follows.
  connected_by       UUID        REFERENCES public.people(id) ON DELETE SET NULL,
  connected_at       TIMESTAMPTZ,
  disconnected_at    TIMESTAMPTZ,

  created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.family_stripe_accounts ENABLE ROW LEVEL SECURITY;

DROP TRIGGER IF EXISTS family_stripe_accounts_updated_at ON public.family_stripe_accounts;
CREATE TRIGGER family_stripe_accounts_updated_at
  BEFORE UPDATE ON public.family_stripe_accounts
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

COMMENT ON TABLE public.family_stripe_accounts IS
  'A family''s OWN Stripe account, held as an acct_ id and never as a key. See '
  'payment_info.md §4. RLS enabled with zero policies: reads go through a gated action.';

-- ── §2. dues_autopay — a member's standing arrangement against ONE dues schedule ───────
--
-- ── RECURRING IS PER SCHEDULE, WHICH IS THE REQUIREMENT AND NOT AN IMPLEMENTATION CHOICE ─
-- A family can run several dues at once — national dues, a chapter due, a building fund —
-- with different amounts and different cadences. A single "autopay for this family" switch
-- could not say which of them it was paying, and the money would arrive with nothing to credit
-- it against. So the unique key is `(person_id, schedule_id)`, one live row each.
--
-- ── AND IT IS DUES ONLY. A DONATION MAY NOT HAVE ONE ────────────────────────────────────
-- `dues_schedules` holds both kinds (`kind IN ('dues','donation')`, 20260805000002), and the
-- guard trigger in §3 refuses a donation schedule outright. A recurring gift is a different
-- product decision with different consent — somebody agreeing to give once has not agreed to
-- give monthly — and `recordPayment` already treats the two kinds differently at every step.
-- Refusing it in the database means no future action can add it by accident.
--
-- `cancelled_at` is what the partial unique index keys on, so a member may cancel and start
-- again against the same schedule without the old row being deleted. The old row is the
-- evidence of what they had agreed to.
CREATE TABLE IF NOT EXISTS public.dues_autopay (
  id                     UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  family_code            TEXT        NOT NULL,
  person_id              UUID        NOT NULL REFERENCES public.people(id) ON DELETE CASCADE,
  schedule_id            UUID        NOT NULL REFERENCES public.dues_schedules(id) ON DELETE CASCADE,

  -- The family's account this lives on, denormalised from `family_stripe_accounts`. Carried
  -- so a webhook can assert the subscription arrived on the account it was created on — an
  -- event whose `account` disagrees with this is not something to act on.
  stripe_account_id      TEXT        NOT NULL,
  -- The subscription and the customer both live on the FAMILY's account, not ours. A customer
  -- id from our own account would be meaningless there, which is the trap Stripe's Connect
  -- guidance warns about ("do not create v1 Customer objects to bill connected accounts").
  stripe_subscription_id TEXT        NOT NULL UNIQUE,
  stripe_customer_id     TEXT,

  cadence                TEXT        NOT NULL DEFAULT 'monthly'
                           CHECK (cadence IN ('weekly','monthly','quarterly','annual')),
  -- What each charge is for, as agreed. Stored so a screen can say what the member signed up
  -- to; the AMOUNT ACTUALLY CHARGED comes off the invoice, for the reason
  -- `platform_payments.amount_cents` gives.
  amount_cents           INT         NOT NULL CHECK (amount_cents > 0),

  status                 TEXT,
  current_period_end     DATE,

  created_at             TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at             TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  cancelled_at           TIMESTAMPTZ
);

-- One LIVE arrangement per member per schedule. Partial, so a cancelled row stays as the
-- record of what was agreed rather than being deleted to make room.
CREATE UNIQUE INDEX IF NOT EXISTS dues_autopay_live_uniq
  ON public.dues_autopay (person_id, schedule_id)
  WHERE cancelled_at IS NULL;

CREATE INDEX IF NOT EXISTS dues_autopay_family_idx ON public.dues_autopay (family_code);
CREATE INDEX IF NOT EXISTS dues_autopay_schedule_idx ON public.dues_autopay (schedule_id);
-- The referencing side of a foreign key is not indexed by Postgres, and 20260822000014
-- created 73 of these for exactly that reason: without it one `people` delete seq-scans this
-- table once per row.
CREATE INDEX IF NOT EXISTS dues_autopay_person_idx ON public.dues_autopay (person_id);

ALTER TABLE public.dues_autopay ENABLE ROW LEVEL SECURITY;

DROP TRIGGER IF EXISTS dues_autopay_updated_at ON public.dues_autopay;
CREATE TRIGGER dues_autopay_updated_at
  BEFORE UPDATE ON public.dues_autopay
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

COMMENT ON TABLE public.dues_autopay IS
  'A member''s recurring card payment against ONE dues schedule, as a Stripe subscription '
  'on the FAMILY''s own connected account. Dues only — the guard trigger refuses a '
  'donation schedule.';

-- ── §3. The guards. The service role ignores RLS and does not ignore triggers ─────────
--
-- AGENTS.md §4 is the hole RLS structurally cannot close: an id arriving from a caller,
-- written onto a row of the caller's OWN family, satisfies every policy while pointing into
-- somebody else's family. Every write here is on the service role, so there is no policy
-- underneath at all — these triggers are the only thing standing there.
CREATE OR REPLACE FUNCTION public.tg_family_stripe_account_same_family()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_person_family text;
BEGIN
  IF NEW.connected_by IS NOT NULL THEN
    SELECT p.family_code INTO v_person_family FROM public.people p WHERE p.id = NEW.connected_by;
    IF v_person_family IS DISTINCT FROM NEW.family_code THEN
      RAISE EXCEPTION
        'family_stripe_accounts: connected_by % belongs to family %, not %',
        NEW.connected_by, COALESCE(v_person_family, 'missing'), NEW.family_code
        USING ERRCODE = '23514';
    END IF;
  END IF;
  RETURN NEW;
END $$;

REVOKE ALL ON FUNCTION public.tg_family_stripe_account_same_family() FROM PUBLIC;

DROP TRIGGER IF EXISTS family_stripe_accounts_same_family ON public.family_stripe_accounts;
CREATE TRIGGER family_stripe_accounts_same_family
  BEFORE INSERT OR UPDATE ON public.family_stripe_accounts
  FOR EACH ROW EXECUTE FUNCTION public.tg_family_stripe_account_same_family();

-- Four checks on one row, and the fourth is not a family question at all — it is the
-- dues-only rule from §2, enforced where no future action can forget it.
CREATE OR REPLACE FUNCTION public.tg_dues_autopay_same_family()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_person_family   text;
  v_schedule_family text;
  v_schedule_kind   text;
  v_account_family  text;
BEGIN
  SELECT p.family_code INTO v_person_family FROM public.people p WHERE p.id = NEW.person_id;
  IF v_person_family IS DISTINCT FROM NEW.family_code THEN
    RAISE EXCEPTION
      'dues_autopay: person % belongs to family %, not %',
      NEW.person_id, COALESCE(v_person_family, 'missing'), NEW.family_code
      USING ERRCODE = '23514';
  END IF;

  SELECT s.family_code, s.kind INTO v_schedule_family, v_schedule_kind
    FROM public.dues_schedules s WHERE s.id = NEW.schedule_id;
  IF v_schedule_family IS DISTINCT FROM NEW.family_code THEN
    RAISE EXCEPTION
      'dues_autopay: schedule % belongs to family %, not %',
      NEW.schedule_id, COALESCE(v_schedule_family, 'missing'), NEW.family_code
      USING ERRCODE = '23514';
  END IF;

  -- The family's connected account, matched on the account id rather than assumed. A
  -- subscription created on one family's Stripe account and filed under another's
  -- `family_code` would credit the wrong family's ledger with every renewal.
  SELECT a.family_code INTO v_account_family
    FROM public.family_stripe_accounts a WHERE a.stripe_account_id = NEW.stripe_account_id;
  IF v_account_family IS DISTINCT FROM NEW.family_code THEN
    RAISE EXCEPTION
      'dues_autopay: stripe account % belongs to family %, not %',
      NEW.stripe_account_id, COALESCE(v_account_family, 'missing'), NEW.family_code
      USING ERRCODE = '23514';
  END IF;

  -- Dues only. See §2: a recurring GIFT is a different consent and a different product
  -- decision, and refusing it here means no action can add one by accident.
  IF v_schedule_kind IS DISTINCT FROM 'dues' THEN
    RAISE EXCEPTION
      'dues_autopay: schedule % is a % — recurring payments are for dues only',
      NEW.schedule_id, COALESCE(v_schedule_kind, 'missing')
      USING ERRCODE = '23514';
  END IF;

  RETURN NEW;
END $$;

REVOKE ALL ON FUNCTION public.tg_dues_autopay_same_family() FROM PUBLIC;

DROP TRIGGER IF EXISTS dues_autopay_same_family ON public.dues_autopay;
CREATE TRIGGER dues_autopay_same_family
  BEFORE INSERT OR UPDATE ON public.dues_autopay
  FOR EACH ROW EXECUTE FUNCTION public.tg_dues_autopay_same_family();

-- ── §4. VERIFY ─────────────────────────────────────────────────────────────────────────
DO $mig$
DECLARE
  v_n   INT;
  v_bad TEXT;
BEGIN
  FOR v_bad IN SELECT unnest(ARRAY['family_stripe_accounts','dues_autopay'])
  LOOP
    SELECT count(*) INTO v_n
      FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
     WHERE n.nspname = 'public' AND c.relname = v_bad AND c.relrowsecurity;
    IF v_n <> 1 THEN
      RAISE EXCEPTION '% does not have RLS enabled — §2c makes it world-writable', v_bad;
    END IF;

    SELECT count(*) INTO v_n FROM pg_policies
     WHERE schemaname = 'public' AND tablename = v_bad;
    IF v_n <> 0 THEN
      RAISE EXCEPTION '% has % policy/policies; the gated actions are the boundary', v_bad, v_n;
    END IF;

    -- A map row would compose an auth_permission factor onto these the next time policies are
    -- swept, and `view` falls back to 'everyone' — publishing a family's processor identifiers
    -- and every member's card arrangement to anybody holding the key.
    IF EXISTS (SELECT 1 FROM public.permission_table_map WHERE table_name = v_bad) THEN
      RAISE EXCEPTION '% has a permission_table_map row — see the header', v_bad;
    END IF;

    -- The guard trigger exists and is INVOKER-agnostic in the way that matters: it fires for
    -- the service role too, which is the entire reason it is a trigger and not a check in an
    -- action.
    SELECT count(*) INTO v_n FROM pg_trigger t
      JOIN pg_class c ON c.oid = t.tgrelid
      JOIN pg_namespace n ON n.oid = c.relnamespace
     WHERE n.nspname = 'public' AND c.relname = v_bad AND NOT t.tgisinternal
       AND t.tgname LIKE '%same_family';
    IF v_n <> 1 THEN
      RAISE EXCEPTION '% has no cross-family guard trigger', v_bad;
    END IF;
  END LOOP;

  -- THERE IS NO COLUMN ANYWHERE THAT COULD HOLD A FAMILY'S SECRET KEY, asserted rather than
  -- promised. This is the one rule in this file whose violation would not break anything and
  -- would be catastrophic, so it is worth a check that fails the deploy: a future migration
  -- adding `stripe_secret_key` or `api_key` to either table stops here.
  SELECT string_agg(table_name || '.' || column_name, ', ') INTO v_bad
    FROM information_schema.columns
   WHERE table_schema = 'public'
     AND table_name IN ('family_stripe_accounts','dues_autopay')
     AND (column_name ILIKE '%secret%' OR column_name ILIKE '%api_key%'
          OR column_name ILIKE '%private_key%' OR column_name ILIKE '%access_token%');
  IF v_bad IS NOT NULL THEN
    RAISE EXCEPTION
      'a column that looks like a credential was added to the processor tables: % — see payment_info.md §4',
      v_bad;
  END IF;

  -- `dues_payments` is untouched by this migration, and the two properties the webhook path
  -- depends on are asserted rather than assumed: 'stripe' is a permitted source, and
  -- (source, processor_ref) is unique so a redelivered charge cannot post twice.
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
     WHERE conrelid = 'public.dues_payments'::regclass
       AND contype = 'c'
       AND pg_get_constraintdef(oid) LIKE '%stripe%'
  ) THEN
    RAISE EXCEPTION 'dues_payments.source does not permit ''stripe'' — the webhook cannot post';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes
     WHERE schemaname = 'public' AND tablename = 'dues_payments'
       AND indexdef LIKE '%UNIQUE%' AND indexdef LIKE '%processor_ref%'
  ) THEN
    RAISE EXCEPTION 'dues_payments has no unique index on (source, processor_ref) — a redelivered charge would post twice';
  END IF;

  RAISE NOTICE 'family payment processor: 2 tables, 0 policies, 2 guard triggers, no credential columns.';
END $mig$;

COMMIT;
