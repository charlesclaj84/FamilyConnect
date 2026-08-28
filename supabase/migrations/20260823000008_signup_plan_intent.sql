-- ═══════════════════════════════════════════════════════════════════════════════════════
-- THE PLAN SOMEBODY PICKED BEFORE THEY HAD AN ACCOUNT TO CHARGE.
--
-- ── WHY THIS COLUMN EXISTS AT ALL ─────────────────────────────────────────────────────
-- Standard and Plus went on sale on 2026-08-23 (`TIER_IS_SOLD` in lib/plans.ts), and the
-- first thing that follows is that `/pricing` now has a button on two of its cards. Pressing
-- it cannot take a payment, and the reason is structural rather than a shortcut:
--
--   * There is nothing to charge yet. A Stripe Customer is the FAMILY
--     (`platform_billing_accounts.stripe_customer_id`), and at the moment somebody presses
--     "Start with Plus" no family exists — they have not typed its name.
--   * And `enable_confirmations = true` in supabase/config.toml, so registration does not end
--     in a session. `startPlanCheckout` opens with `requireEdit('admin/settings')`; there is
--     no caller to authorize until the email is confirmed and they sign in.
--
-- So the choice has to survive the gap between "I want Plus" and "I can be charged for Plus",
-- and this is where it waits. It is a STATEMENT OF INTENT and nothing else: no money moves
-- because of it, no tier is granted by it, and `families.tier` is untouched.
--
-- ── IT MUST NOT BECOME A SECOND WAY TO HOLD A TIER, AND THAT IS THE WHOLE RISK ────────
-- AGENTS.md is unambiguous that `families.tier` is the only thing any gate reads and that the
-- webhook is its only writer besides the term sweep. This column is read by exactly one thing
-- — the prompt that offers a checkout — and the checkout it opens is the existing, audited
-- `startPlanCheckout`. Three consequences, all of them things a later change could get wrong:
--
--   * NO POLICY MAY EVER CONSULT IT. Same rule as `families.tier`, and easier to hold here
--     because this table has RLS enabled and ZERO policies (§2c): the browser cannot read the
--     row at all, and every read goes through a gated action on the service role.
--   * IT IS NOT AN ENTITLEMENT AND `entitlementOn()` DOES NOT SEE IT. A family that chose
--     Plus at signup and never paid is a Free family that once clicked a button.
--   * IT IS NOT CLEARED WHEN THE FAMILY PAYS. Whether the intent is still outstanding is
--     DERIVED — the paid tier either meets it or it does not — which is the `is_minor`
--     lesson (§4b): a stored "resolved" flag would be a second fact about the same thing,
--     wrong from the first downgrade. `signupPlanPrompt()` in lib/signup-plan.ts is the one
--     definition and `npm test` is what holds it.
--
-- ── ONE STORED FACT THAT CANNOT BE DERIVED, WHICH IS THE DISMISSAL ───────────────────
-- "I chose Plus at signup and I have decided to stay on Free" is not visible in any other
-- column: the family looks exactly like one that has not got round to paying. Without it the
-- prompt is permanent, and a banner that cannot be closed is a banner people learn to read
-- past — including on the day it says something else.
--
-- ── WHY NOT A COLUMN ON `families` ───────────────────────────────────────────────────
-- Because that table is read on the hot path of every page load through `auth_family_code()`
-- and its TypeScript mirror, it carries three guard triggers about the columns it already
-- has, and a billing-shaped column on it is one refactor away from being read by something
-- that resolves a tier. This table is the one whose entire subject is what a family has
-- agreed to pay, it is already loaded by `getPlatformBilling()` with `select('*')`, and
-- nothing outside `app/actions/billing.ts` and lib/stripe touches it.
-- ═══════════════════════════════════════════════════════════════════════════════════════

BEGIN;

-- ── §1. The intent ─────────────────────────────────────────────────────────────────────
--
-- 'free' IS NOT A PERMITTED VALUE, and the omission is the point rather than an oversight.
-- Choosing Free is choosing not to buy anything, which is what NULL already says — two ways
-- to spell "nothing was bought" is how a prompt comes to offer somebody a checkout for the
-- plan they are already on. `registerUser` narrows before it writes and the CHECK is what
-- makes that unbypassable by the service role.
--
-- PREMIUM IS PERMITTED even though `TIER_IS_SOLD.premium` is false. The CHECK is the shape of
-- the column and lives for years; what is on sale is a product decision that moves in a
-- TypeScript constant, and baking today's answer into a constraint would mean a migration on
-- the day Premium ships. The action refuses an unsold tier; this refuses a nonsense one.
ALTER TABLE public.platform_billing_accounts
  ADD COLUMN IF NOT EXISTS signup_tier TEXT
    CHECK (signup_tier IN ('standard','plus','premium')),
  ADD COLUMN IF NOT EXISTS signup_tier_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS signup_tier_dismissed_at TIMESTAMPTZ;

COMMENT ON COLUMN public.platform_billing_accounts.signup_tier IS
  'The paid plan chosen on /register, before any account existed to charge. A STATEMENT OF '
  'INTENT: it grants nothing, no policy may read it, and families.tier is untouched by it. '
  'NULL means nobody asked for a paid plan. Never ''free'' — see the migration header.';

COMMENT ON COLUMN public.platform_billing_accounts.signup_tier_at IS
  'When the plan was chosen. Kept so a stale intent can be recognised as stale — an eight '
  'month old choice is not a decision somebody is still waiting on.';

COMMENT ON COLUMN public.platform_billing_accounts.signup_tier_dismissed_at IS
  'When the family said they would stay on their current plan after all. The one fact here '
  'that cannot be derived: a family that has decided against paying is indistinguishable '
  'from one that has not got round to it in every other column.';

-- Both halves of the intent, or neither. A tier with no date cannot be aged out; a date with
-- no tier describes a choice nobody made. Same shape as `platform_billing_scheduled_pair`.
DO $mig$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
     WHERE conrelid = 'public.platform_billing_accounts'::regclass
       AND conname = 'platform_billing_signup_pair'
  ) THEN
    ALTER TABLE public.platform_billing_accounts
      ADD CONSTRAINT platform_billing_signup_pair
      CHECK ((signup_tier IS NULL) = (signup_tier_at IS NULL));
  END IF;

  -- A dismissal with nothing to dismiss. Permitting it would let the prompt be suppressed
  -- for a family that never chose a plan, which reads as "they said no" in any later report
  -- built on this column.
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
     WHERE conrelid = 'public.platform_billing_accounts'::regclass
       AND conname = 'platform_billing_signup_dismissal_needs_intent'
  ) THEN
    ALTER TABLE public.platform_billing_accounts
      ADD CONSTRAINT platform_billing_signup_dismissal_needs_intent
      CHECK (signup_tier_dismissed_at IS NULL OR signup_tier IS NOT NULL);
  END IF;
END $mig$;

-- ── §2. Verify ─────────────────────────────────────────────────────────────────────────
--
-- ASSERTED BY DOING IT rather than by reading `pg_constraint` back, for the reason
-- 20260823000005's header gives: a constraint is well-formed text whether or not it refuses
-- what you think it refuses. The probe writes real rows and unwinds itself through a sentinel
-- compared by MESSAGE, so a genuine failure above is not swallowed by the handler.
DO $mig$
DECLARE
  v_fam  TEXT := 'ZZSIGNUP';
  v_cols INT;
BEGIN
  SELECT count(*) INTO v_cols
    FROM information_schema.columns
   WHERE table_schema = 'public' AND table_name = 'platform_billing_accounts'
     AND column_name IN ('signup_tier','signup_tier_at','signup_tier_dismissed_at');
  IF v_cols <> 3 THEN
    RAISE EXCEPTION 'expected 3 signup intent columns, found %', v_cols;
  END IF;

  -- THE TABLE STAYS UNREADABLE BY THE BROWSER. This is the conjunct that makes the "no policy
  -- may consult it" rule in the header hold by construction rather than by diligence: with
  -- zero policies, §2c denies every command to `anon` and `authenticated` whatever the default
  -- ACL granted. A future policy on this table would publish the family's billing record.
  IF EXISTS (SELECT 1 FROM pg_policies
              WHERE schemaname = 'public' AND tablename = 'platform_billing_accounts') THEN
    RAISE EXCEPTION 'platform_billing_accounts has grown a policy; the signup intent is now browser-readable';
  END IF;

  -- 1. An ordinary intent is accepted.
  INSERT INTO public.platform_billing_accounts (family_code, signup_tier, signup_tier_at)
  VALUES (v_fam, 'plus', NOW());

  -- 2. 'free' is refused. Two spellings of "bought nothing" is what this prevents.
  BEGIN
    UPDATE public.platform_billing_accounts SET signup_tier = 'free' WHERE family_code = v_fam;
    RAISE EXCEPTION 'signup_tier accepted ''free''';
  EXCEPTION WHEN check_violation THEN NULL;
  END;

  -- 3. So is a tier with no timestamp, in both directions.
  BEGIN
    UPDATE public.platform_billing_accounts SET signup_tier_at = NULL WHERE family_code = v_fam;
    RAISE EXCEPTION 'signup_tier survived without its timestamp';
  EXCEPTION WHEN check_violation THEN NULL;
  END;

  -- 4. A dismissal is accepted where there is an intent to dismiss.
  UPDATE public.platform_billing_accounts
     SET signup_tier_dismissed_at = NOW() WHERE family_code = v_fam;

  -- 5. And refused where there is not. The CONTROL for probe 4 — without this the constraint
  --    could be permitting everything and probe 4 would still pass.
  BEGIN
    UPDATE public.platform_billing_accounts
       SET signup_tier = NULL, signup_tier_at = NULL WHERE family_code = v_fam;
    RAISE EXCEPTION 'a dismissal survived its intent being cleared';
  EXCEPTION WHEN check_violation THEN NULL;
  END;

  RAISE NOTICE 'signup plan intent: 3 columns, 2 constraints, 3 refusals and 2 controls.';

  RAISE EXCEPTION 'ZZ_ROLLBACK_PROBE';
EXCEPTION
  WHEN OTHERS THEN
    IF SQLERRM <> 'ZZ_ROLLBACK_PROBE' THEN RAISE; END IF;
END $mig$;

COMMIT;
