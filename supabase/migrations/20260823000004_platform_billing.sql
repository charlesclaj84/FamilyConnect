-- ═══════════════════════════════════════════════════════════════════════════════════════
-- WHAT A FAMILY PAYS GENORRA — the platform side of billing, and nothing else.
--
-- ── THE ONE RULE THIS FILE EXISTS TO ENFORCE ──────────────────────────────────────────
-- **GENORRA's money and a family's money are two ledgers and they must never meet.**
--
-- `dues_payments`, `fund_contributions`, `fund_disbursements` and `fund_transfers` are the
-- FAMILY's books: what its relatives paid it, and what it did with that. What a family pays
-- GENORRA for its plan is OUR revenue and belongs nowhere near them. A subscription charge
-- written into `dues_payments` would:
--
--   * inflate `getFamilyDuesCollected()` — the dashboard headline — with money the family
--     never received;
--   * be picked up by `routePaidPayment` and split across the family's own funds by the
--     routing waterfall, so a slice of GENORRA's invoice would land in their Reunion fund;
--   * appear in `/reporting/pl-summary` as income, in `/reporting/dues-projections` as
--     something a member owes, and in that member's payment history as a due they paid;
--   * and be UNREMOVABLE, because `dues_payments` is append-only (20260806000002) — the
--     correction is a negative row, so the mistake stays visible in the family's ledger
--     forever.
--
-- Two tables here, and neither is reachable from any of that. Nothing in `app/actions/dues.ts`
-- reads them, nothing in `lib/fund-routing.ts` knows they exist, and `fund_balance_cents()`
-- is untouched. The tables are named `platform_*` so a grep for the prefix is the complete
-- list of places our own revenue is recorded.
--
-- ── FIVE PRODUCT RULES, WRITTEN INTO THE COLUMNS ──────────────────────────────────────
--
--   1. ONE RATE PER TIER, MONTHLY. `TIER_PRICE[tier].monthlyCents` in lib/plans.ts. There is
--      deliberately no annual rate — that figure was withdrawn on 2026-08-19 and lib/plans.ts
--      says why. A year in advance is twelve months at the monthly rate, which is what
--      `months` on `platform_payments` records.
--
--   2. PAY IN ADVANCE, AS FAR AHEAD AS YOU LIKE. `mode` says which shape: a monthly
--      subscription that renews, or one payment covering N months. Both end up as one fact —
--      `paid_through` — which is what makes the entitlement question answerable without
--      caring which was bought.
--
--   3. NO REFUNDS. There is no refund column, no credit-note table and no negative amount
--      permitted (`amount_cents > 0`). Moving down a tier takes nothing back.
--
--   4. A DOWNGRADE WAITS FOR THE TERM TO END. `scheduled_tier` / `scheduled_tier_on` is that
--      promise stored: the family keeps what it paid for, and the tier moves the day AFTER
--      `paid_through`. `scheduleDowngrade()` in lib/platform-billing.ts computes the date and
--      is mutation-tested on exactly that off-by-one, because a day early is a refund in the
--      one direction this system does not do.
--
--   5. MOVING UP TAKES EFFECT AT ONCE. See `upgradeCreditDays()` — the unused remainder is
--      converted at the dearer tier's rate rather than refunded or forfeited.
--
-- ── `families.tier` IS STILL THE ONLY THING ANY GATE READS ────────────────────────────
-- Nothing here is consulted by `requireView`, `tierAllows` or any policy — and that is not an
-- oversight to be tidied up later, it is the design. AGENTS.md is explicit that no RLS policy
-- consults `families.tier` and none may; making a family's ACCESS depend on a billing read
-- would put a Stripe-shaped query on the hot path of every page load and make their pages
-- flicker with a webhook.
--
-- So the column stays authoritative and ONE function moves it:
-- `apply_due_platform_tier_changes()` in §5. That is the only writer, which is what keeps
-- `entitlementOn()` in TypeScript a DESCRIPTION rather than a second opinion.
--
-- ── AND IT ONLY EVER TOUCHES A FAMILY THAT HAS A BILLING ROW ──────────────────────────
-- The sharpest thing to get right in this file. `setFamilyTier` has been scaffolding since
-- 2026-08-13: an administrator picks a plan, nothing is charged, and `/admin/settings` says
-- so. Every family in existence — and every family in `tests/rls` — has a tier that was set
-- that way and no billing record at all.
--
-- A sweep that read "tier above free, nothing paid, therefore downgrade" would silently
-- revoke the plan of every one of them on the first webhook delivery. So the sweep is
-- INNER-JOINED to `platform_billing_accounts`: no row, no opinion. Billing is authoritative
-- only for a family that has actually entered it.
--
-- ── NO POLICIES ON EITHER TABLE, WHICH IS THE §2c PATTERN AND NOT AN OMISSION ─────────
-- Supabase's default ACL hands `anon` and `authenticated` every privilege on a new table
-- before this file runs, so RLS is the entire boundary and a table with NO policy for a
-- command denies it. These get none at all — the `genorra_staff` and
-- `family_removal_challenges` shape — because every row holds a Stripe customer or
-- subscription id, and there is no member-facing question these answer that a gated server
-- action cannot answer better. `app/actions/billing.ts` reads them behind
-- `requireRead('admin/family')` on the service role, re-applying the family scoping by hand
-- (§3).
--
-- NO `permission_table_map` ROW EITHER, and §9 asserts it in both directions. A future policy
-- sweep composing an `auth_permission('admin/family', …)` factor onto these would publish
-- every family's Stripe ids to anybody holding a view grant, because `view` falls back to
-- 'everyone'.
--
-- IDEMPOTENT. Safe to re-run.
-- ═══════════════════════════════════════════════════════════════════════════════════════

BEGIN;

-- ── §1. platform_billing_accounts — one row per family that has entered billing ────────
--
-- ONE ROW PER FAMILY, not one per subscription. A family may cancel and come back, and a
-- history of subscriptions is what `platform_payments` is for; this is the CURRENT standing,
-- and there must be exactly one answer to "what has this family paid for" or two screens will
-- disagree about it.
--
-- `paid_through` IS A DATE AND IS INCLUSIVE. Nothing in this product records a family
-- timezone, so a TIMESTAMPTZ here would be a moment in no particular zone and would end
-- somebody's plan on the wrong day for half the country — the rule lib/calendar.ts states and
-- the reason `starts_on`/`ends_on`/`due_on` are all DATE. Inclusive because "paid through the
-- 30th" is what a person means; `scheduleDowngrade` adds the day.
CREATE TABLE IF NOT EXISTS public.platform_billing_accounts (
  id                   UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  family_code          TEXT        NOT NULL UNIQUE,

  -- Stripe's own identifiers. The customer is the FAMILY, and it survives a cancellation so a
  -- family that comes back keeps its payment history and its saved card.
  stripe_customer_id   TEXT        UNIQUE,
  stripe_subscription_id TEXT      UNIQUE,

  -- 'recurring' | 'prepaid' | NULL before anything is bought. Mirrors BillingMode in
  -- lib/platform-billing.ts; the CHECK is what keeps a third value from arriving from a
  -- webhook handler that learned a new word.
  mode                 TEXT        CHECK (mode IN ('recurring','prepaid')),

  -- What the current term was bought at, and the last day it covers.
  paid_tier            TEXT        CHECK (paid_tier IN ('free','standard','plus','premium')),
  paid_through         DATE,

  -- Stripe's own word for the subscription: active, trialing, past_due, canceled, …
  -- Stored as free text rather than a CHECK: this is THEIR vocabulary, it has grown before,
  -- and a CHECK on it would turn a new Stripe status into a webhook that fails to record
  -- anything. `subscriptionIsCurrent()` is where the meaning is decided.
  subscription_status  TEXT,
  cancel_at_period_end BOOLEAN     NOT NULL DEFAULT false,

  -- A downgrade that has been promised but not yet applied. Both or neither.
  scheduled_tier       TEXT        CHECK (scheduled_tier IN ('free','standard','plus','premium')),
  scheduled_tier_on    DATE,

  -- ── DELINQUENCY IS RECORDED HERE AND ACTED ON NOWHERE ───────────────────────────────
  -- `invoice.payment_failed` stamps this and `invoice.paid` clears it, so the DATA exists
  -- from day one. What the product should DO about a family two weeks past due — a grace
  -- period, an email, a tier that drops, a screen that says so — is a policy decision nobody
  -- has taken, and TODO.md carries it as its own item. Recording it now is cheap; guessing
  -- the policy now would mean a family losing pages on a rule nobody agreed to.
  delinquent_since     DATE,
  last_payment_failure TEXT,

  created_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- Both halves of a scheduled change, or neither. A tier with no date would never be
  -- applied; a date with no tier would apply nothing on a day somebody is waiting for.
  CONSTRAINT platform_billing_scheduled_pair CHECK (
    (scheduled_tier IS NULL) = (scheduled_tier_on IS NULL)
  ),
  -- A paid term is a tier AND an end date. Either alone describes nothing, and
  -- `entitlementOn()` would report Free over a family that had paid.
  CONSTRAINT platform_billing_term_pair CHECK (
    (paid_tier IS NULL) = (paid_through IS NULL)
  )
);

CREATE INDEX IF NOT EXISTS platform_billing_accounts_due_idx
  ON public.platform_billing_accounts (scheduled_tier_on)
  WHERE scheduled_tier_on IS NOT NULL;
CREATE INDEX IF NOT EXISTS platform_billing_accounts_lapse_idx
  ON public.platform_billing_accounts (paid_through)
  WHERE paid_through IS NOT NULL;

ALTER TABLE public.platform_billing_accounts ENABLE ROW LEVEL SECURITY;

DROP TRIGGER IF EXISTS platform_billing_accounts_updated_at ON public.platform_billing_accounts;
CREATE TRIGGER platform_billing_accounts_updated_at
  BEFORE UPDATE ON public.platform_billing_accounts
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

COMMENT ON TABLE public.platform_billing_accounts IS
  'What a family has paid GENORRA. NOT the family''s own books — see dues_payments for '
  'those. RLS enabled with zero policies on purpose: every read goes through a gated '
  'server action on the service role.';

-- ── §2. platform_payments — our revenue ledger, and a receipt trail ────────────────────
--
-- APPEND-ONLY BY CONVENTION RATHER THAN BY TRIGGER, and the difference from `dues_payments`
-- is worth stating. That table carries a trigger the service role cannot bypass, because the
-- rows are the FAMILY's evidence about its own money and a treasurer must not be able to
-- rewrite one. These rows are OUR copy of what Stripe already holds authoritatively — Stripe
-- is the ledger of record, this is a local index of it — so the cost of an UPDATE here is a
-- stale mirror rather than a destroyed audit trail. Nothing in the app issues one.
--
-- `stripe_ref` IS THE IDEMPOTENCY KEY AND IT IS THE CHARGE, never the subscription. Every
-- renewal of one subscription shares the subscription id, so keying on that would make month
-- two look like a duplicate of month one and discard it forever — silently, because a
-- suppressed duplicate is indistinguishable from a working integration. This is the same
-- mistake `lib/meta/billing.ts` documents at length for `transactionId`, and the two now
-- carry the same value for the same reason.
CREATE TABLE IF NOT EXISTS public.platform_payments (
  id                UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  family_code       TEXT        NOT NULL,

  -- 'subscription' — one period of a recurring plan.
  -- 'prepaid'      — one payment covering `months` months.
  kind              TEXT        NOT NULL CHECK (kind IN ('subscription','prepaid')),
  tier              TEXT        NOT NULL CHECK (tier IN ('standard','plus','premium')),
  -- Always 1 for a subscription period; 1..36 for a prepaid term. NOT derivable from the
  -- amount: after a proration or a coupon the amount and the rate disagree, and the months
  -- are what the term was extended by.
  months            INT         NOT NULL DEFAULT 1 CHECK (months >= 1),

  -- WHAT WAS ACTUALLY CHARGED, from the transaction — never `TIER_PRICE × months`. After a
  -- proration, a coupon, a tax line or a currency the plan table does not know about, the
  -- catalogue price and the charge disagree, and the figure on a receipt has to be the one
  -- the bank moved. `> 0` rather than `>= 0`: a zero-amount row is not a payment, and a
  -- negative one would be a refund, which rule 3 says does not exist.
  amount_cents      INT         NOT NULL CHECK (amount_cents > 0),
  currency          TEXT        NOT NULL DEFAULT 'usd',

  -- The charge. UNIQUE, and it is what makes a redelivered webhook harmless even years later
  -- — past `stripe_webhook_events`, past Stripe's own 24-hour idempotency window.
  stripe_ref        TEXT        NOT NULL UNIQUE,
  stripe_session_id TEXT,
  stripe_invoice_id TEXT,
  stripe_subscription_id TEXT,

  -- The term this payment bought, so a receipt can say what it covered without recomputing
  -- it from a paid_through that has since moved on.
  covers_from       DATE,
  covers_through    DATE,

  -- STATED BY STRIPE (`invoice.billing_reason = 'subscription_create'`), never inferred from
  -- our own records. `lib/meta/billing.ts` argues it: inferring "have we seen this family pay
  -- before?" is wrong the first time a family cancels and resubscribes, and the first time
  -- this table is restored from a backup.
  first_payment     BOOLEAN     NOT NULL DEFAULT false,

  paid_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS platform_payments_family_idx
  ON public.platform_payments (family_code, paid_at DESC);

ALTER TABLE public.platform_payments ENABLE ROW LEVEL SECURITY;

COMMENT ON TABLE public.platform_payments IS
  'GENORRA''s revenue from a family''s plan. Deliberately NOT dues_payments: nothing in '
  'the family''s funds, P&L, projections or collected total may ever read this.';

-- ── §3. stripe_webhook_events — the only thing standing between a redelivery and a ─────
--        second month of credit on one payment.
--
-- NO `family_code`, deliberately: a platform event is about GENORRA's account and belongs to
-- no family, and the Connect events that DO belong to one arrive before we have resolved
-- which. `account_id` is the raw `acct_…` off the delivery and is what the Connect handler
-- resolves a family FROM.
--
-- RLS enabled, zero policies, granted to nobody. The `family_removal_challenges` pattern: the
-- browser must never read this table, because knowing which events have been processed is
-- knowing which ones have not.
CREATE TABLE IF NOT EXISTS public.stripe_webhook_events (
  event_id     TEXT        PRIMARY KEY,
  endpoint     TEXT        NOT NULL CHECK (endpoint IN ('platform','connect')),
  event_type   TEXT        NOT NULL,
  account_id   TEXT,
  claimed_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  processed_at TIMESTAMPTZ,
  attempts     INT         NOT NULL DEFAULT 1,
  last_error   TEXT
);

CREATE INDEX IF NOT EXISTS stripe_webhook_events_unfinished_idx
  ON public.stripe_webhook_events (claimed_at)
  WHERE processed_at IS NULL;

ALTER TABLE public.stripe_webhook_events ENABLE ROW LEVEL SECURITY;

-- ── §4. Claiming an event, in ONE statement ────────────────────────────────────────────
--
-- WHY THIS IS SQL AND NOT TYPESCRIPT: the app races itself. Stripe can deliver the same event
-- twice concurrently, and a read-then-write from a server process lets both deliveries decide
-- they are the first — which here means a family credited for two months on one payment, or
-- one dues payment posted twice against a member. `claim_distribution_recipients` is the same
-- shape for the same reason and its header makes the same argument.
--
-- ── AND WHY THE CLAIM CAN BE RECOVERED, which is the half a first draft leaves out ─────
-- A handler that dies mid-event leaves the row claimed and unprocessed. Without recovery,
-- every redelivery Stripe makes is refused as a duplicate and the event is PERMANENTLY LOST
-- by the very mechanism that exists to stop it being applied twice. So a claim older than the
-- stale window with `processed_at IS NULL` is re-claimable, and `attempts` counts how often
-- that has happened so the condition is visible rather than silent.
--
-- FIFTEEN MINUTES is chosen against the platform's own ceiling rather than picked: a Vercel
-- function cannot run anywhere near that long, so a claim that old cannot belong to a live
-- handler. Shortening it below the maximum function duration would let a SLOW handler be
-- overtaken by a redelivery of the event it is still processing, which is the failure this
-- whole table exists to prevent.
--
-- GRANTED TO NOBODY. Default privileges revoke EXECUTE from `anon` and `authenticated`
-- (20260806000015), and `service_role` keeps it — which is correct, because the only caller is
-- a webhook handler on the admin client. §2b rule 3 still applies and the body asserts its own
-- arguments rather than trusting that it is unreachable.
CREATE OR REPLACE FUNCTION public.claim_stripe_event(
  p_event_id   TEXT,
  p_event_type TEXT,
  p_endpoint   TEXT,
  p_account_id TEXT DEFAULT NULL
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_stale INTERVAL := INTERVAL '15 minutes';
  v_claimed BOOLEAN;
BEGIN
  IF p_event_id IS NULL OR p_event_id = '' THEN
    RAISE EXCEPTION 'claim_stripe_event needs an event id' USING ERRCODE = 'invalid_parameter_value';
  END IF;
  IF p_endpoint NOT IN ('platform','connect') THEN
    RAISE EXCEPTION 'claim_stripe_event: unknown endpoint %', p_endpoint
      USING ERRCODE = 'invalid_parameter_value';
  END IF;

  -- `AS e` is not decoration: inside ON CONFLICT DO UPDATE the existing row is referenced by
  -- the table's name or alias, and a schema-qualified `public.stripe_webhook_events.attempts`
  -- is not accepted there. With `search_path = ''` an unqualified table name is not either,
  -- so the alias is the only form that works in both halves of this statement.
  INSERT INTO public.stripe_webhook_events AS e (event_id, endpoint, event_type, account_id)
  VALUES (p_event_id, p_endpoint, p_event_type, p_account_id)
  ON CONFLICT (event_id) DO UPDATE
    -- Re-claim ONLY a stale, unfinished claim. `WHERE` on DO UPDATE means a live claim or a
    -- finished event updates no row at all, and RETURNING then yields nothing — which is how
    -- the boolean below comes out false without a second query.
    SET claimed_at = NOW(),
        attempts   = e.attempts + 1
    WHERE e.processed_at IS NULL
      AND e.claimed_at < NOW() - v_stale
  RETURNING true INTO v_claimed;

  RETURN COALESCE(v_claimed, false);
END $$;

REVOKE ALL ON FUNCTION public.claim_stripe_event(TEXT, TEXT, TEXT, TEXT) FROM PUBLIC;

CREATE OR REPLACE FUNCTION public.finish_stripe_event(
  p_event_id TEXT,
  p_error    TEXT DEFAULT NULL
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  -- A FAILURE LEAVES `processed_at` NULL ON PURPOSE, so the claim goes stale and Stripe's next
  -- redelivery can pick it up. Stamping it with an error recorded would mark a failed event as
  -- done and lose it — the same permanent-loss failure the recovery window above exists for.
  IF p_error IS NULL THEN
    UPDATE public.stripe_webhook_events
       SET processed_at = NOW(), last_error = NULL
     WHERE event_id = p_event_id;
  ELSE
    UPDATE public.stripe_webhook_events
       SET last_error = left(p_error, 500)
     WHERE event_id = p_event_id;
  END IF;
END $$;

REVOKE ALL ON FUNCTION public.finish_stripe_event(TEXT, TEXT) FROM PUBLIC;

-- ── §5. The ONE writer of `families.tier` from billing ─────────────────────────────────
--
-- Two things come due with nobody watching, and this is what notices:
--
--   A SCHEDULED DOWNGRADE   `scheduled_tier_on <= today`. The family's paid term has ended
--                           and the tier they asked to move to takes effect.
--   A LAPSED PREPAID TERM   `paid_through < today` with nothing renewing it. A prepaid term
--                           has no Stripe event at its end — there is no renewal to fail and
--                           no subscription to cancel — so without this a family that paid
--                           for three months in January would keep Premium forever.
--
-- ── IT ONLY EVER TOUCHES A FAMILY WITH A BILLING ROW, and that is the load-bearing part ─
-- The INNER JOIN in both statements. `setFamilyTier` is scaffolding: every existing family,
-- and every family in `tests/rls`, has a tier somebody picked with nothing charged. A sweep
-- reasoning "tier above free, nothing paid, therefore downgrade" would revoke every one of
-- them on the first webhook delivery. No billing row means no opinion.
--
-- ── AND IT PASSES `families_guard_tier` BECAUSE OF WHAT THAT GUARD ACTUALLY TESTS ──────
-- That trigger (20260813000003) refuses a tier change when the JWT `role` claim is
-- 'authenticated'. It says nothing about the service role and nothing about a definer
-- function, deliberately — "the boundary being drawn is around the ROLE the browser speaks
-- as, not around the column". A `.rpc()` from the admin client carries role 'service_role'; a
-- future cron call carries no claims at all. Both pass. The browser still cannot.
--
-- ── WHO CALLS IT, AND THE GAP THAT LEAVES ──────────────────────────────────────────────
-- Every webhook handler, at the end of every delivery. That is a poor man's scheduler and it
-- is honest about being one: it is exact for the recurring case (the renewal invoice IS the
-- period boundary), and for a lapsed PREPAID term it only fires when some other family's
-- payment happens to arrive. A product with no families paying would never sweep at all.
--
-- The real answer is `pg_cron`, which TODO.md already carries as one migration's work — the
-- extension is available on this project and not installed. This function is deliberately
-- shaped for it: no arguments, no caller, idempotent, and safe to run every hour forever.
CREATE OR REPLACE FUNCTION public.apply_due_platform_tier_changes()
RETURNS INT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_moved INT := 0;
  r       RECORD;
BEGIN
  -- ── A. Scheduled changes that have come due ─────────────────────────────────────────
  --
  -- A LOOP RATHER THAN A CHAIN OF DATA-MODIFYING CTEs, and the reason is not style. Both
  -- tables have to move together, and the value driving the `families` write is the very
  -- column the other write clears — `RETURNING` on an UPDATE yields the NEW row, so a CTE
  -- that cleared `scheduled_tier` could only return NULL to the statement that needed it.
  -- Writing it the other way round (families first, from a plain SELECT) would work and
  -- leaves the two statements able to disagree about which rows they matched.
  --
  -- `FOR UPDATE OF b` locks the billing row for the duration. Two sweeps running at once —
  -- two webhook deliveries, or a webhook and a future cron tick — would otherwise both read
  -- the same due row and apply it twice. Under READ COMMITTED the second waits, re-evaluates
  -- the WHERE against the committed row, finds `scheduled_tier` now NULL, and skips it. That
  -- is the whole concurrency argument, and it is the reason this is one statement per row
  -- inside a lock rather than a bulk UPDATE.
  FOR r IN
    SELECT b.family_code, b.scheduled_tier
      FROM public.platform_billing_accounts b
      JOIN public.families f ON f.family_code = b.family_code
     WHERE b.scheduled_tier IS NOT NULL
       AND b.scheduled_tier_on IS NOT NULL
       AND b.scheduled_tier_on <= CURRENT_DATE
       FOR UPDATE OF b
  LOOP
    UPDATE public.families
       SET tier = r.scheduled_tier
     WHERE family_code = r.family_code;

    -- The scheduled tier IS now the paid standing. A move to Free clears the term entirely;
    -- a move to a cheaper paid tier keeps the dates, which the next `invoice.paid` restates.
    UPDATE public.platform_billing_accounts
       SET scheduled_tier    = NULL,
           scheduled_tier_on = NULL,
           paid_tier    = CASE WHEN r.scheduled_tier = 'free' THEN NULL ELSE r.scheduled_tier END,
           paid_through = CASE WHEN r.scheduled_tier = 'free' THEN NULL ELSE paid_through END,
           mode         = CASE WHEN r.scheduled_tier = 'free' THEN NULL ELSE mode END
     WHERE family_code = r.family_code;

    v_moved := v_moved + 1;
  END LOOP;

  -- ── B. Prepaid terms that ran out with nothing renewing them ────────────────────────
  --
  -- `mode = 'prepaid'` and not merely "no live subscription": a recurring plan whose card is
  -- failing is `past_due`, Stripe is still retrying it for days, and dropping the tier there
  -- would be taking a decision about delinquency that nobody has taken. That case is left
  -- exactly as it is, with `delinquent_since` recorded, and TODO.md carries the policy.
  FOR r IN
    SELECT b.family_code
      FROM public.platform_billing_accounts b
      JOIN public.families f ON f.family_code = b.family_code
     WHERE b.mode = 'prepaid'
       AND b.paid_through IS NOT NULL
       AND b.paid_through < CURRENT_DATE
       AND f.tier <> 'free'
       FOR UPDATE OF b
  LOOP
    UPDATE public.families SET tier = 'free' WHERE family_code = r.family_code;
    UPDATE public.platform_billing_accounts
       SET paid_tier = NULL, paid_through = NULL, mode = NULL
     WHERE family_code = r.family_code;
    v_moved := v_moved + 1;
  END LOOP;

  RETURN v_moved;
END $$;

REVOKE ALL ON FUNCTION public.apply_due_platform_tier_changes() FROM PUBLIC;

COMMENT ON FUNCTION public.apply_due_platform_tier_changes() IS
  'The ONE writer of families.tier from billing. Idempotent, no arguments, safe on a '
  'schedule. Only ever touches a family that has a platform_billing_accounts row — '
  'setFamilyTier scaffolding must not be swept.';

-- ── §6. VERIFY ─────────────────────────────────────────────────────────────────────────
--
-- What a verify block CAN and CANNOT see here, stated because AGENTS.md's Safety Check-Ins
-- entry is about exactly this: a policy that reads back as well-formed text can still be
-- broken at query time. Nothing below executes a member-role query, so this asserts SHAPE.
-- What it can assert absolutely is the negative space — no policies, no map row, no browser
-- grant — and that is where this feature's risk actually is.
DO $mig$
DECLARE
  v_n   INT;
  v_bad TEXT;
BEGIN
  -- 1. All three tables: RLS on, and ZERO policies. The whole boundary.
  FOR v_bad IN SELECT unnest(ARRAY['platform_billing_accounts','platform_payments','stripe_webhook_events'])
  LOOP
    SELECT count(*) INTO v_n
      FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
     WHERE n.nspname = 'public' AND c.relname = v_bad AND c.relrowsecurity;
    IF v_n <> 1 THEN
      RAISE EXCEPTION '% does not have RLS enabled — §2c makes it world-writable', v_bad;
    END IF;

    SELECT count(*) INTO v_n
      FROM pg_policies WHERE schemaname = 'public' AND tablename = v_bad;
    IF v_n <> 0 THEN
      RAISE EXCEPTION '% has % policy/policies. Reads go through a gated action; see the header', v_bad, v_n;
    END IF;

    -- A map row would compose an auth_permission factor onto these tables the next time
    -- the policies are swept, with `view` falling back to 'everyone'.
    IF EXISTS (SELECT 1 FROM public.permission_table_map WHERE table_name = v_bad) THEN
      RAISE EXCEPTION '% has a permission_table_map row — see the header', v_bad;
    END IF;
  END LOOP;

  -- 2. Nothing here is reachable from the browser as a function.
  FOR v_bad IN SELECT unnest(ARRAY['claim_stripe_event','finish_stripe_event','apply_due_platform_tier_changes'])
  LOOP
    SELECT count(*) INTO v_n
      FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
     WHERE n.nspname = 'public' AND p.proname = v_bad;
    IF v_n = 0 THEN
      RAISE EXCEPTION '% was not created', v_bad;
    END IF;

    IF has_function_privilege('authenticated', (
         SELECT p.oid FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
          WHERE n.nspname = 'public' AND p.proname = v_bad LIMIT 1), 'EXECUTE')
    THEN
      RAISE EXCEPTION '% is EXECUTEable by authenticated — it writes families.tier', v_bad;
    END IF;
    IF has_function_privilege('anon', (
         SELECT p.oid FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
          WHERE n.nspname = 'public' AND p.proname = v_bad LIMIT 1), 'EXECUTE')
    THEN
      RAISE EXCEPTION '% is EXECUTEable by anon', v_bad;
    END IF;

    -- SET search_path = '' on all three. AGENTS.md: a mutable path on a SECURITY DEFINER
    -- function is the one combination that matters, and 20260822000010's assertion is what
    -- keeps it true for functions added since.
    --
    -- `LIKE 'search\_path=%'` rather than an equality, matching 20260822000010 — and the
    -- reason is worth carrying, because the obvious version of this assertion FAILS ON A
    -- CORRECTLY-WRITTEN FUNCTION. `SET search_path = ''` is stored in `proconfig` as
    -- `search_path=""`, quotes included, so `'search_path=' = ANY(proconfig)` never matches
    -- and the migration refuses itself. Measured here on the first run.
    SELECT count(*) INTO v_n
      FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
     WHERE n.nspname = 'public' AND p.proname = v_bad
       AND EXISTS (
         SELECT 1 FROM unnest(COALESCE(p.proconfig, '{}'::text[])) c
          WHERE c LIKE 'search\_path=%'
       );
    IF v_n = 0 THEN
      RAISE EXCEPTION '% has a mutable search_path', v_bad;
    END IF;
  END LOOP;

  -- 3. THE SWEEP MUST NOT TOUCH A FAMILY WITH NO BILLING ROW. Asserted by running it: there
  --    are no billing rows on a fresh database, so it must move nothing and must not throw.
  --    That is a weak assertion about the join and a strong one about the function being
  --    CALLABLE — plpgsql does not resolve names until the body runs (AGENTS.md on
  --    20260806000012, which applied cleanly and threw for its first caller), so a
  --    mis-qualified reference in either statement above surfaces here and not in production.
  SELECT public.apply_due_platform_tier_changes() INTO v_n;
  IF v_n <> 0 THEN
    RAISE EXCEPTION 'the tier sweep moved % families on a database with no billing rows', v_n;
  END IF;

  -- 4. And claiming works, including the duplicate refusal. Same argument: this is the one
  --    function whose failure mode is silent — a claim that always returns true turns every
  --    redelivery into a second month of credit.
  IF public.claim_stripe_event('evt_migration_probe', 'probe', 'platform') IS NOT TRUE THEN
    RAISE EXCEPTION 'claim_stripe_event refused a first claim';
  END IF;
  IF public.claim_stripe_event('evt_migration_probe', 'probe', 'platform') IS NOT FALSE THEN
    RAISE EXCEPTION 'claim_stripe_event allowed a SECOND claim of one event — every redelivery would be applied twice';
  END IF;
  PERFORM public.finish_stripe_event('evt_migration_probe');
  IF public.claim_stripe_event('evt_migration_probe', 'probe', 'platform') IS NOT FALSE THEN
    RAISE EXCEPTION 'claim_stripe_event re-claimed a FINISHED event';
  END IF;
  DELETE FROM public.stripe_webhook_events WHERE event_id = 'evt_migration_probe';

  RAISE NOTICE 'platform billing: 3 tables, 3 functions, 0 policies, sweep callable, claim idempotent.';
END $mig$;

COMMIT;
