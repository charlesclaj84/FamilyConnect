-- ═══════════════════════════════════════════════════════════════════════════════════════
-- A FAMILY'S BOOKS HAVE A CURRENCY, AND IT IS THE ONE THEIR MERCHANT ACCOUNT SETTLES IN
--
-- `20260831000003` gave a family a COUNTRY to create its connected account in — US, Canada
-- or Mexico today — and every figure in the product stayed a dollar figure. That is the
-- mismatch this file closes: a Canadian family set a $40 due, a member was charged 40 USD,
-- and the family received about 54 CAD less Stripe's conversion. Three numbers, none of them
-- the one anybody typed.
--
-- ── §A. THE CURRENCY IS DERIVED FROM THE COUNTRY, AND THAT IS THE DECISION ────────────
-- Decided 2026-09-01. `CONNECT_COUNTRIES` in lib/stripe/connect-countries.ts already carries
-- a `currency` per country — recorded there since the picker landed and consumed by nothing —
-- and this is what consumes it. Two columns move together and neither is chosen twice:
--
--     families.connect_country   which country the account is (or will be) created in
--     families.currency          the currency the family's OWN books are kept in
--
-- The alternative — an independent currency picker — was rejected. Stripe genuinely allows a
-- USD-settling account to present CAD, so it would have WORKED; what it would also have done
-- is admit the exact mismatch this file exists to remove, in the other direction. A family
-- collecting MXN into a CAD-settling account eats a conversion on every single payment and
-- nothing on any screen would say so.
--
-- ── §B. IMMUTABLE ONCE A PAYMENT EXISTS, AND THAT CLAUSE IS THE LOAD-BEARING HALF ─────
-- `dues_payments` is append-only (`20260806000002`): a paid row's `amount_cents` is frozen for
-- everyone including the service role, and there is no currency column beside it. So the
-- family's currency is what says what every historical row MEANT. A family that switched
-- currency mid-year would have a ledger whose sum is not a quantity of anything — `$40` and
-- `$40` where the first is dollars and the second pesos, added together by
-- `getFamilyDuesCollected()` and printed as the dashboard headline.
--
-- Hence `families_guard_currency`, and it draws TWO lines rather than one:
--
--   1. The `authenticated` role may never move either column. The same shape as
--      `families_guard_tier`, `families_guard_family_code` and
--      `people_guard_permission_template`, and for the identical reason: `families` has an
--      UPDATE policy so an administrator can rename their family, and a policy has no opinion
--      about WHICH column changed. Without this, `PATCH /families {"currency":"mxn"}` from
--      devtools re-denominates a family's whole ledger.
--
--   2. NOBODY may move either column once a `dues_payments` row exists — not the service role,
--      not a migration, not a staff member. This is the `meeting_votes_are_final` shape: the
--      rule is about the RECORD rather than about the caller, so it cannot be a check in an
--      action. `setFamilyProcessingCountry` asks the same question first so the family gets a
--      sentence rather than a 42501, and the trigger is what makes the answer true.
--
-- ── §C. AN EXISTING FAMILY GETS USD, WRITTEN DOWN ────────────────────────────────────
-- Explicitly, not left NULL. A nullable currency column is a column that means "dollars,
-- probably", which is how the whole item started. The backfill reads
-- `family_stripe_accounts.country` where one exists — that column records what Stripe echoed
-- back, so it is a FACT about the account rather than an assumption — and falls through to
-- `us`/`usd`, which is what every account created before the picker genuinely is.
--
-- ── §D. GENORRA'S OWN PRICES ARE UNTOUCHED, AND THAT SEPARATION IS ASSERTED ──────────
-- `platform_payments.currency` keeps its `'usd'` default and `app/actions/billing.ts` keeps
-- refusing a price that is not USD. AGENTS.md's "MONEY HAS TWO DIRECTIONS" is the rule and
-- this is the sharpest instance of it yet: a Mexican family may pay us in USD while collecting
-- from relatives in MXN, and conflating the two would put a slice of GENORRA's invoice in the
-- family's Reunion fund. §5 below asserts the platform default did not move.
--
-- ── §E. WHAT THIS DOES NOT DO ───────────────────────────────────────────────────────
-- No policy consults either column and none may. Currency is a fact about the money, not an
-- authorization question — it withholds nothing and grants nothing, exactly like
-- `families.tier`. `permission_table_map` gains no row.
--
-- IDEMPOTENT. Safe to re-run.
-- ═══════════════════════════════════════════════════════════════════════════════════════

BEGIN;

-- ── §1. The columns ────────────────────────────────────────────────────────────────────
-- Both NOT NULL with a default, so a family created by a migration, by the seed or by
-- `registerUser` has an answer without anybody deciding one.
--
-- TEXT rather than CHAR(3): CHAR pads, so `'usd'::char(3) = 'usd '` compares equal to a
-- trailing-space value and an accidental `'us'` becomes `'us '` silently. Every other code
-- column in this schema is TEXT with a CHECK, and consistency here is worth more than three
-- bytes.
ALTER TABLE public.families
  ADD COLUMN IF NOT EXISTS currency        TEXT NOT NULL DEFAULT 'usd';
ALTER TABLE public.families
  ADD COLUMN IF NOT EXISTS connect_country TEXT NOT NULL DEFAULT 'us';

-- Added separately and idempotently: `ADD COLUMN … CHECK` is not re-runnable, and this file
-- has to be safe to replay against a database that already has the columns.
--
-- ── THE CHECK LISTS THE ENABLED SET, NOT ISO 4217 ───────────────────────────────────
-- Three currencies, matching `enabledConnectCountries()` exactly. A CHECK over all 135
-- currencies Stripe presents would admit a value nothing in the product can format, price or
-- charge a minimum against — and the failure would be a family collecting in a currency whose
-- Stripe minimum we have not looked up, which is a checkout that fails at the till.
--
-- SO ENABLING A COUNTRY IS A MIGRATION AS WELL AS A FLAG, and that is deliberate: it is the
-- same coupling `families_tier_check` has with `TIERS`, and `20260819000008`'s header says
-- what happens without it — every write of the new value refused by Postgres, on a value the
-- app considers ordinary. `lib/stripe/connect-countries.ts` names this file so the next
-- person enabling a country finds it.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
     WHERE conrelid = 'public.families'::regclass
       AND conname = 'families_currency_check'
  ) THEN
    ALTER TABLE public.families
      ADD CONSTRAINT families_currency_check
      CHECK (currency IN ('usd','cad','mxn'));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
     WHERE conrelid = 'public.families'::regclass
       AND conname = 'families_connect_country_check'
  ) THEN
    ALTER TABLE public.families
      ADD CONSTRAINT families_connect_country_check
      CHECK (connect_country IN ('us','ca','mx'));
  END IF;

  -- THE PAIR HAS TO AGREE, and this is the constraint that makes "derived from the country"
  -- true in the database rather than only in the action that writes them. Without it the two
  -- columns are two facts, and the first thing that writes one without the other is the bug
  -- this whole design was chosen to avoid.
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
     WHERE conrelid = 'public.families'::regclass
       AND conname = 'families_currency_matches_country'
  ) THEN
    ALTER TABLE public.families
      ADD CONSTRAINT families_currency_matches_country
      CHECK (
        (connect_country = 'us' AND currency = 'usd')
        OR (connect_country = 'ca' AND currency = 'cad')
        OR (connect_country = 'mx' AND currency = 'mxn')
      );
  END IF;
END $$;

COMMENT ON COLUMN public.families.currency IS
  'ISO 4217, lowercase. The currency this family''s OWN books are kept in — dues, funds, '
  'gathering budgets. DERIVED from connect_country and constrained to agree with it. '
  'Immutable once a dues_payments row exists (families_guard_currency), because that ledger '
  'is append-only and carries no currency of its own. NOT GENORRA''s price: see '
  'platform_payments.currency, which is always usd.';

COMMENT ON COLUMN public.families.connect_country IS
  'ISO 3166-1 alpha-2, lowercase. Which country the family''s Stripe connected account is, or '
  'will be, created in. identity.country cannot be changed at Stripe after creation, so this '
  'is immutable once an account exists OR once a dues payment has been recorded.';

-- ── §2. The backfill ───────────────────────────────────────────────────────────────────
-- From the account that exists, where one does. `family_stripe_accounts.country` is what
-- Stripe echoed back on `v2.core.accounts.retrieve`, so it is the account's actual country
-- rather than what somebody asked for.
--
-- ONLY where the row still reads the default, which is the `20260820000007` rule: a backfill
-- must not overwrite a value somebody has already chosen. On the day this applies nobody has
-- chosen one, and on a replay against a database where somebody has, this leaves it alone.
--
-- A country outside the enabled three is left as `us`/`usd` rather than written, because the
-- CHECK above would refuse it and rolling the whole migration back over one family's account
-- would be worse than that family reading dollars until somebody widens the set. There are
-- none today — the picker has never offered a fourth — and §5 reports any it finds as a
-- NOTICE rather than an exception, which is the visible-skip rule.
UPDATE public.families f
   SET connect_country = a.country,
       currency        = CASE a.country
                           WHEN 'ca' THEN 'cad'
                           WHEN 'mx' THEN 'mxn'
                           ELSE 'usd'
                         END
  FROM public.family_stripe_accounts a
 WHERE a.family_code = f.family_code
   AND a.country IN ('us','ca','mx')
   AND f.connect_country = 'us'
   AND f.currency = 'usd'
   AND a.country <> 'us';

-- ── §3. The guard ──────────────────────────────────────────────────────────────────────
-- Two refusals in one trigger, because they are two rules about one pair of columns and
-- splitting them across two triggers would let a reader satisfy one and believe they had
-- satisfied both.
--
-- `search_path = ''` and every reference schema-qualified — AGENTS.md on `20260806000012`,
-- which applied cleanly and threw for its first caller.
CREATE OR REPLACE FUNCTION public.families_guard_currency()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_changed BOOLEAN := NEW.currency        IS DISTINCT FROM OLD.currency
                    OR NEW.connect_country IS DISTINCT FROM OLD.connect_country;
BEGIN
  IF NOT v_changed THEN
    RETURN NEW;
  END IF;

  -- 1. THE ROLE THE BROWSER SPEAKS AS. Never, on either column.
  IF current_setting('request.jwt.claims', true) IS NOT NULL
     AND COALESCE(
           (NULLIF(current_setting('request.jwt.claims', true), '')::jsonb) ->> 'role',
           ''
         ) = 'authenticated'
  THEN
    RAISE EXCEPTION
      'families.currency and families.connect_country cannot be changed from the application'
      USING ERRCODE = 'insufficient_privilege';
  END IF;

  -- 2. THE RECORD, for everybody. A ledger row that has been written is a row whose currency
  --    is already decided, and there is no column on it to say which. `service_role` is
  --    included deliberately — see the header: this is a rule about the money, not about who
  --    is asking.
  IF EXISTS (
    SELECT 1 FROM public.dues_payments p WHERE p.family_code = OLD.family_code
  ) THEN
    RAISE EXCEPTION
      'family % has recorded payments: its currency is fixed at %', OLD.family_code, OLD.currency
      USING ERRCODE = 'insufficient_privilege';
  END IF;

  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS families_guard_currency ON public.families;
CREATE TRIGGER families_guard_currency
  BEFORE UPDATE ON public.families
  FOR EACH ROW EXECUTE FUNCTION public.families_guard_currency();

-- No GRANT. A trigger function's EXECUTE is checked at CREATE TRIGGER time rather than at fire
-- time (AGENTS.md §2b), so granting it would only make it callable directly — which for a
-- function returning a trigger record is meaningless at best.

-- ── §4. The one writer ─────────────────────────────────────────────────────────────────
-- `set_family_connect_country` exists so the pair is written in ONE statement and can never be
-- half-written. `families_currency_matches_country` would refuse a half-write anyway — this is
-- what turns that refusal into something a caller never has to think about.
--
-- SECURITY DEFINER and granted to NOBODY. `service_role` keeps EXECUTE by default (§2b rule
-- 1), and the action calls it on the admin client. A grant to `authenticated` would be an
-- unauthenticated re-denomination endpoint, which is precisely what §3's first refusal exists
-- to prevent — reintroducing it here through the front door.
--
-- IT RE-DERIVES THE CURRENCY and takes no currency parameter, which is §2b rule 3's shape: a
-- caller that could send both could send a mismatched pair, and the whole point of the design
-- is that there is one fact.
CREATE OR REPLACE FUNCTION public.set_family_connect_country(
  p_family_code TEXT,
  p_country     TEXT
)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_currency TEXT;
BEGIN
  IF p_family_code IS NULL OR p_country IS NULL THEN
    RAISE EXCEPTION 'set_family_connect_country needs a family and a country'
      USING ERRCODE = 'invalid_parameter_value';
  END IF;

  v_currency := CASE p_country
                  WHEN 'us' THEN 'usd'
                  WHEN 'ca' THEN 'cad'
                  WHEN 'mx' THEN 'mxn'
                END;
  IF v_currency IS NULL THEN
    RAISE EXCEPTION 'set_family_connect_country: % is not a country this product serves', p_country
      USING ERRCODE = 'invalid_parameter_value';
  END IF;

  UPDATE public.families
     SET connect_country = p_country,
         currency        = v_currency
   WHERE family_code = p_family_code;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'set_family_connect_country: no family %', p_family_code
      USING ERRCODE = 'no_data_found';
  END IF;

  RETURN v_currency;
END $$;

REVOKE ALL ON FUNCTION public.set_family_connect_country(TEXT, TEXT) FROM PUBLIC;

COMMENT ON FUNCTION public.set_family_connect_country(TEXT, TEXT) IS
  'Write families.connect_country and families.currency together, deriving the second from '
  'the first. The ONLY writer. Granted to nobody: service_role keeps EXECUTE by default and '
  'the browser must never reach it. Refused by families_guard_currency once a dues payment '
  'exists.';

-- ── §5. VERIFY ─────────────────────────────────────────────────────────────────────────
-- Fixture-free and unconditional so it cannot skip silently, and the trigger is EXERCISED
-- rather than asserted to exist: plpgsql resolves nothing until the body runs, so a bad
-- reference in §3 would apply cleanly and throw for the first family whose country somebody
-- set. `20260806000012` is the incident this paragraph is about.
DO $mig$
DECLARE
  v_code     TEXT := 'CURPROBE';
  v_person   UUID;
  v_currency TEXT;
  v_country  TEXT;
  v_n        INT;
BEGIN
  -- 1. The columns exist, are NOT NULL, and default to dollars.
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
     WHERE table_schema='public' AND table_name='families'
       AND column_name='currency' AND is_nullable='NO'
  ) THEN
    RAISE EXCEPTION 'ROLLBACK: families.currency is missing or nullable';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
     WHERE table_schema='public' AND table_name='families'
       AND column_name='connect_country' AND is_nullable='NO'
  ) THEN
    RAISE EXCEPTION 'ROLLBACK: families.connect_country is missing or nullable';
  END IF;

  -- 2. All three CHECKs are present. Named individually so a failure says which.
  FOR v_country IN
    SELECT unnest(ARRAY['families_currency_check',
                        'families_connect_country_check',
                        'families_currency_matches_country'])
  LOOP
    IF NOT EXISTS (
      SELECT 1 FROM pg_constraint
       WHERE conrelid='public.families'::regclass AND conname=v_country
    ) THEN
      RAISE EXCEPTION 'ROLLBACK: constraint % is missing', v_country;
    END IF;
  END LOOP;

  -- 3. NOTHING IS LEFT MEANING "dollars, probably". Every family has a pair that agrees, which
  --    the CHECK guarantees going forward and this asserts about the rows already here.
  SELECT count(*) INTO v_n FROM public.families
   WHERE currency IS NULL OR connect_country IS NULL;
  IF v_n > 0 THEN
    RAISE EXCEPTION 'ROLLBACK: % families have no currency', v_n;
  END IF;

  -- 4. A VISIBLE SKIP. An account in a country the enabled set does not admit is left on
  --    dollars, and says so rather than being silently correct. AGENTS.md: a skip must be
  --    visible, never silent.
  SELECT count(*) INTO v_n
    FROM public.family_stripe_accounts a
   WHERE a.country IS NOT NULL AND a.country NOT IN ('us','ca','mx');
  IF v_n > 0 THEN
    RAISE NOTICE
      '% connected account(s) are in a country outside the enabled set; those families keep usd '
      'until families_currency_check is widened', v_n;
  END IF;

  -- 5. THE PLATFORM SIDE DID NOT MOVE. GENORRA charges USD (§D), and the cheapest way for
  --    that to stop being true is somebody "tidying" this default to match the new column.
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
     WHERE table_schema='public' AND table_name='platform_payments'
       AND column_name='currency' AND column_default LIKE '%usd%'
  ) THEN
    RAISE EXCEPTION
      'ROLLBACK: platform_payments.currency no longer defaults to usd — GENORRA''s own prices '
      'must not follow a family''s books';
  END IF;

  -- 6. NO POLICY CONSULTS EITHER COLUMN (§E). Same assertion `20260817000006` makes about
  --    `families.status`, and for the same reason: a conjunct here would make a family's
  --    access depend on a billing fact.
  SELECT count(*) INTO v_n
    FROM pg_policies
   WHERE schemaname='public'
     AND (COALESCE(qual,'') || COALESCE(with_check,'')) ~ '(connect_country|families\.currency)';
  IF v_n > 0 THEN
    RAISE EXCEPTION 'ROLLBACK: % policies reference the currency columns', v_n;
  END IF;

  -- ── The trigger, made to fire. A throwaway family inside this transaction, the shape
  --    `20260812000000` and `20260813000003` both use. `created_by` is left NULL
  --    deliberately: requiring an `auth.users` row is what let `20260806000012`'s verify
  --    block skip itself into a false pass on an empty database.
  INSERT INTO public.families (family_code, family_name) VALUES (v_code, 'Currency probe');

  SELECT f.currency, f.connect_country INTO v_currency, v_country
    FROM public.families f WHERE f.family_code = v_code;
  IF v_currency <> 'usd' OR v_country <> 'us' THEN
    RAISE EXCEPTION 'ROLLBACK: a new family defaulted to %/%, expected us/usd', v_country, v_currency;
  END IF;

  -- 7. THE SERVICE-ROLE PATH MUST WORK. This block runs as the migration's owner with no
  --    `request.jwt.claims` set, which is the shape a service-role write has — so an
  --    over-eager guard fails here rather than in production.
  v_currency := public.set_family_connect_country(v_code, 'mx');
  IF v_currency <> 'mxn' THEN
    RAISE EXCEPTION 'ROLLBACK: set_family_connect_country(mx) returned %', v_currency;
  END IF;
  SELECT f.currency INTO v_currency FROM public.families f WHERE f.family_code = v_code;
  IF v_currency <> 'mxn' THEN
    RAISE EXCEPTION 'ROLLBACK: the pair was not written; currency is %', v_currency;
  END IF;

  -- 8. AN UNSERVED COUNTRY IS REFUSED RATHER THAN DEFAULTED. Silently creating a dollar
  --    family for one that asked for Nigeria is the failure the whole picker exists to
  --    remove (`connect-countries.ts`), and doing it in the name of robustness would hide it
  --    better than the old constant did.
  BEGIN
    PERFORM public.set_family_connect_country(v_code, 'ng');
    RAISE EXCEPTION 'ROLLBACK: set_family_connect_country accepted ng';
  EXCEPTION
    WHEN invalid_parameter_value THEN NULL;   -- expected
  END;

  -- 9. THE RECORD RULE, for the service role. A payment exists, so the pair is frozen for
  --    everybody — which is the half no action can enforce and the half a future migration
  --    would otherwise walk straight through.
  INSERT INTO public.people (family_code, first_name, last_name, primary_email)
       VALUES (v_code, 'Currency', 'Probe', 'currency-probe@genorra.com')
    RETURNING id INTO v_person;
  -- `recorded_by` is not optional: `require_recorded_by()` refuses a manually recorded
  -- transaction that does not name who recorded it. The probe records its own payment, which
  -- is the narrowest fixture that satisfies it.
  INSERT INTO public.dues_payments
              (family_code, person_id, amount_cents, payment_date, payment_method, status,
               recorded_by)
       VALUES (v_code, v_person, 4000, CURRENT_DATE, 'cash', 'paid', v_person);

  BEGIN
    PERFORM public.set_family_connect_country(v_code, 'ca');
    RAISE EXCEPTION 'ROLLBACK: the currency moved after a payment was recorded';
  EXCEPTION
    WHEN insufficient_privilege THEN NULL;   -- expected
  END;

  -- 10. The mismatch CHECK is real. Asserted by trying to write a pair that disagrees
  --     THROUGH the guard's own blind spot: a direct UPDATE on a family with no payments.
  --
  --     THE PAYMENT IS REMOVED BY DELETING THE PERSON, not by deleting the payment.
  --     `dues_payments_immutable()` refuses a direct DELETE with 42501 and permits exactly one
  --     origin — the CASCADE from a `people` row that is already gone. Reaching for the
  --     obvious `DELETE FROM dues_payments` here would abort this migration, which is the
  --     append-only rule working rather than an obstacle, and it is the same fact
  --     `delete_family_data_above_tier` has to contend with.
  DELETE FROM public.people WHERE id = v_person;
  BEGIN
    UPDATE public.families SET currency = 'cad' WHERE family_code = v_code;
    RAISE EXCEPTION 'ROLLBACK: currency and connect_country were allowed to disagree';
  EXCEPTION
    WHEN check_violation THEN NULL;   -- expected
  END;

  DELETE FROM public.families WHERE family_code = v_code;

  RAISE NOTICE 'families.currency: columns, three CHECKs, guard (role + record) and the one '
               'writer all verified; platform_payments still defaults to usd';
END $mig$;

COMMIT;
