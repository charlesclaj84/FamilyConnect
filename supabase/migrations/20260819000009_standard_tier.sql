-- ============================================================================
-- A fourth plan: Standard, between Free and Plus.
--
-- ── WHAT THIS FILE ACTUALLY DOES ────────────────────────────────────────────
-- One thing: widens `families_tier_check` so the word `'standard'` is admissible.
-- Nothing else in the database knows or may know what a plan is, so there is
-- nothing else here — no policy, no function, no backfill, and deliberately no
-- re-tiering of any existing family.
--
-- `20260813000003` said so in as many words when it created the column: *"the
-- CHECK is what keeps `lib/tiers.ts` and this column agreeing about the
-- vocabulary; adding a fourth plan means editing both, in the same commit, and
-- the constraint is what will remind whoever forgets."* This is that commit, and
-- the constraint is what made it necessary: without it `setFamilyTier(…,
-- 'standard')` is refused by Postgres with 23514 on a value the whole app
-- considers ordinary, and the failure surfaces as "Could not change the plan" on
-- a screen with nothing wrong with it.
--
-- ── THE `IF NOT EXISTS` GUARD IN 20260813000003 IS WHY THIS IS A DROP ───────
-- That migration adds the constraint only when it is absent, which is correct
-- there and means it can never widen one. So a re-run of the chain would leave
-- the OLD three-value CHECK in place on any database that already has it, i.e.
-- every database that matters. The constraint is therefore dropped and rebuilt
-- here, unconditionally, and the rebuild is what makes this file idempotent in
-- the only sense that counts: applying it to a database that already has the
-- four-value CHECK produces the same four-value CHECK.
--
-- ── NO FAMILY IS MOVED, AND THAT IS THE DECISION RATHER THAN THE DEFAULT ────
-- Standard was carved out of Free: the family tree, the whole dues-and-donations
-- ledger, the permission-template editor and the planning half of Gatherings all
-- moved UP a rung, and profile pictures moved DOWN from Plus. So a family sitting
-- on Free loses ROUTES today that it could open yesterday.
--
-- That is admissible for one reason, and it is a fact about the world rather than
-- an argument: NO FAMILY IS USING THIS PRODUCT YET. Nothing has ever been sold —
-- `TIER_IS_SOLD` is false for all three paid plans and there is no payment step
-- anywhere in the product — so there is no customer whose expectations this
-- disappoints and nobody to grandfather onto a plan they were never charged for.
-- If that stops being true before billing exists, a restructure of this shape
-- needs a backfill (`UPDATE families SET tier = 'standard' WHERE tier = 'free'`)
-- and this comment is where the next person should expect to find that decision
-- recorded. Do not write that backfill now: it would put every family on a plan
-- nobody has agreed to pay for, which is the same mistake in the other direction.
--
-- WHAT A FAMILY ON PLUS OR PREMIUM LOSES: nothing, and nothing could be lost.
-- Tiers are inclusive (`tierMeets` is `>=` on a rank derived from the array
-- order), so inserting a rung BELOW Plus leaves every Plus family reaching
-- strictly everything it reached before, plus whatever came down from Plus. The
-- column holds a word and not a position — no policy consults it — so no stored
-- value had to be re-ranked.
--
-- ── AND NOTHING HERE WITHHOLDS A ROW ────────────────────────────────────────
-- Restated because a four-value vocabulary makes it more tempting, not less. A
-- tier withholds SCREENS. A family that ends up on Free keeps every dues payment,
-- every relationship on the tree, every gathering task and every permission
-- template it ever created, and finds all of it exactly as it was on the day it
-- moves back up. That is why there is no `auth_family_tier()` to match
-- `auth_family_code()`, why `families_guard_tier` (unchanged by this file) keeps
-- the column out of the browser's reach, and why the server actions behind a paid
-- page are deliberately not tier-checked.
-- ============================================================================

BEGIN;

-- ── 1. The vocabulary ───────────────────────────────────────────────────────
ALTER TABLE public.families DROP CONSTRAINT IF EXISTS families_tier_check;
ALTER TABLE public.families
  ADD CONSTRAINT families_tier_check
  CHECK (tier IN ('free', 'standard', 'plus', 'premium'));

COMMENT ON COLUMN public.families.tier IS
  'Billing plan: free | standard | plus | premium, cheapest first and INCLUSIVE. '
  'Withholds SCREENS only — no RLS policy may consult it, so a downgraded family keeps '
  'every row it ever entered. Set by the service role; families_guard_tier refuses the '
  'authenticated role. The order lives in lib/tiers.ts (TIERS); this column stores a word, '
  'not a position, so a plan inserted in the middle needs no data change here.';

-- ── 2. Verify ───────────────────────────────────────────────────────────────
-- Fixture-free and unconditional, so it cannot skip itself into a false pass —
-- the failure `20260806000012` shipped and AGENTS.md records. The CHECK is
-- exercised for real in BOTH directions, because an assertion that the constraint
-- merely EXISTS would pass just as happily against the three-value version this
-- file is here to replace.
DO $mig$
DECLARE
  v_code text := 'STDPROBE';
  v_tier text;
  v_before bigint;
  v_after bigint;
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
     WHERE conrelid = 'public.families'::regclass AND conname = 'families_tier_check'
  ) THEN
    RAISE EXCEPTION 'ROLLBACK: families_tier_check is missing';
  END IF;

  -- Nothing may have moved. Counted before and after the probe so the assertion is
  -- about THIS migration rather than about whatever the estate happened to look
  -- like — see the note above on why there is no backfill.
  SELECT count(*) INTO v_before FROM public.families WHERE tier <> 'free';

  -- A throwaway family, created and removed inside this transaction. Same shape and
  -- same ordering as 20260813000003's own verify block, and for the same reason: the
  -- only honest way to check a constraint is to write against it. `created_by` is
  -- left NULL deliberately — requiring an `auth.users` row is exactly what let an
  -- earlier verify block skip itself.
  INSERT INTO public.families (family_code, family_name) VALUES (v_code, 'Standard probe');

  -- THE NEW VALUE IS ADMITTED. This is the assertion the whole file exists for.
  UPDATE public.families SET tier = 'standard' WHERE family_code = v_code;
  SELECT f.tier INTO v_tier FROM public.families f WHERE f.family_code = v_code;
  IF v_tier <> 'standard' THEN
    RAISE EXCEPTION 'ROLLBACK: families_tier_check refused standard (read back %)', v_tier;
  END IF;

  -- The other three still are, so widening did not narrow the vocabulary elsewhere.
  UPDATE public.families SET tier = 'plus'    WHERE family_code = v_code;
  UPDATE public.families SET tier = 'premium' WHERE family_code = v_code;
  UPDATE public.families SET tier = 'free'    WHERE family_code = v_code;

  -- AND IT IS STILL CLOSED. A widened CHECK that admits anything is not a widened
  -- CHECK, and `normalizeTier()` in the app falls back to Free for an unknown word —
  -- so a typo written straight into the column would silently DOWNGRADE a family
  -- rather than fail, which is the outcome this half protects against.
  BEGIN
    UPDATE public.families SET tier = 'standrd' WHERE family_code = v_code;
    RAISE EXCEPTION 'ROLLBACK: families_tier_check admitted an unknown tier';
  EXCEPTION WHEN check_violation THEN
    NULL;  -- expected
  END;

  -- ORDER IS LOAD-BEARING, and it is 20260813000003's order rather than a fresh
  -- guess: inserting a family fires families_seed_permission_templates and
  -- families_seed_system_funds, and funds_protect_system() releases a system fund
  -- for deletion on exactly one condition — that the `families` row is already gone.
  DELETE FROM public.families             WHERE family_code = v_code;
  DELETE FROM public.funds                WHERE family_code = v_code;
  DELETE FROM public.template_permissions tp
   USING public.permission_templates t
   WHERE tp.template_id = t.id AND t.family_code = v_code;
  DELETE FROM public.permission_templates WHERE family_code = v_code;
  DELETE FROM public.resource_visibility  WHERE family_code = v_code;

  SELECT count(*) INTO v_after FROM public.families WHERE tier <> 'free';
  IF v_after <> v_before THEN
    RAISE EXCEPTION
      'ROLLBACK: this migration moved % family(ies) between plans and must move none',
      v_after - v_before;
  END IF;

  RAISE NOTICE 'families.tier: standard admitted, vocabulary still closed, no family moved';
END $mig$;

COMMIT;
