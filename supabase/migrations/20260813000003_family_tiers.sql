-- ============================================================================
-- A family is on a plan, and the plan is not something the family can set.
--
-- WHY
--   `/pricing` sells three tiers and the codebase enforced none of them. FutureFeature.md
--   said so plainly — *"there is no tier enforcement anywhere in the codebase … until
--   there is, every flip is a Free flip, whatever the pricing page says"* — and by
--   2026-08-12 two Plus bullets were already being given away: RSVPs and day-of check-in
--   came free with the Events flip, and profile pictures were never gated. Each was
--   recorded as its own special case, because there was nothing for them to be a case OF.
--
--   This column is the fact everything else keys off. `lib/features.ts` says which plan
--   each ROUTE belongs to; this says which plan each FAMILY is on; `requireView()` and
--   the sidebar compare them.
--
-- WHAT A TIER IS NOT — and this is the load-bearing half of this migration
--   **No policy consults it, and none may start to.** A tier withholds SCREENS, never
--   rows. Family isolation is RLS and per-member authority is the permission model; both
--   are enforced here in the database, and neither knows what a plan is. Wiring `tier`
--   into a USING clause would mean a family that lapsed to Free could no longer read its
--   own dues history — data they entered, about their own money — which is not a
--   downgrade, it is a hostage situation. Downgrading has to be survivable, and the only
--   way to guarantee that is for the enforcement to live entirely in the application's
--   routing.
--
--   That is why there is no `auth_family_tier()` to match `auth_family_code()`. The
--   asymmetry is deliberate: the app has a resolver (`lib/auth/tier.ts`) because the app
--   is what enforces this, and the database has none because the database must not.
--
-- WHO MAY CHANGE IT
--   The service role, and nothing else. A tier is a billing fact, and the family cannot
--   be the authority on what it has paid for — `families` gained an UPDATE policy in
--   20260812000000 so that an administrator could rename their own family, and a policy
--   has no opinion about WHICH column changed, so without the guard below
--   `renameFamily({ tier: 'premium' })` would be a self-upgrade every policy in the
--   database is satisfied by. That is the identical shape as
--   `people_guard_permission_template` (20260807000000) and
--   `families_guard_family_code` (20260812000000), and it is the third time this schema
--   has needed it, which is why it is written the same way each time.
--
--   THERE IS NO PRODUCT SURFACE THAT SETS THIS, on purpose. Until billing exists a tier
--   is moved by whoever runs the business, through the service role. `/admin/family`
--   displays the plan and links to `/pricing`; it offers no control, because a button
--   that changes what you are billed without taking a payment is not a feature.
--
-- IDEMPOTENT. Column, constraint, trigger and function are all guarded or replaced.
--
-- HOW THIS REACHES A DATABASE
--   `supabase db push`, from CI on merge to master — never `psql -f` by hand. See
--   AGENTS.md, "How migrations reach the hosted project".
-- ============================================================================

BEGIN;

-- ── 1. The column ───────────────────────────────────────────────────────────
-- NOT NULL DEFAULT 'free': every family that exists today is on Free, which is true —
-- nothing has ever been sold — and it is the value a new family gets. The CHECK is what
-- keeps `lib/tiers.ts` and this column agreeing about the vocabulary; adding a fourth
-- plan means editing both, in the same commit, and the constraint is what will remind
-- whoever forgets.
ALTER TABLE public.families
  ADD COLUMN IF NOT EXISTS tier TEXT NOT NULL DEFAULT 'free';

DO $mig$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
     WHERE conrelid = 'public.families'::regclass AND conname = 'families_tier_check'
  ) THEN
    ALTER TABLE public.families
      ADD CONSTRAINT families_tier_check CHECK (tier IN ('free', 'plus', 'premium'));
  END IF;
END $mig$;

COMMENT ON COLUMN public.families.tier IS
  'Billing plan: free | plus | premium. Withholds SCREENS only — no RLS policy may '
  'consult it, so a downgraded family keeps every row it ever entered. Set by the '
  'service role; families_guard_tier refuses the authenticated role. See lib/tiers.ts.';

-- ── 2. The guard ────────────────────────────────────────────────────────────
-- Refuses a change made by `authenticated` and says nothing about the service role,
-- which is how the two other guards on this schema are written and for the same reason:
-- the boundary being drawn is around the ROLE the browser speaks as, not around the
-- column. `link-person.ts` and `tests/rls` both need service-role writes to guarded
-- columns, and forbidding those would mean forbidding the seeding the suite runs on.
--
-- `search_path = ''` and every reference schema-qualified — see AGENTS.md on
-- 20260806000012, which applied cleanly and threw for its first caller.
CREATE OR REPLACE FUNCTION public.families_guard_tier()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF NEW.tier IS DISTINCT FROM OLD.tier
     AND current_setting('request.jwt.claims', true) IS NOT NULL
     AND COALESCE(
           (NULLIF(current_setting('request.jwt.claims', true), '')::jsonb) ->> 'role',
           ''
         ) = 'authenticated'
  THEN
    RAISE EXCEPTION
      'families.tier is a billing fact and cannot be changed from the application'
      USING ERRCODE = 'insufficient_privilege';
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS families_guard_tier ON public.families;
CREATE TRIGGER families_guard_tier
  BEFORE UPDATE ON public.families
  FOR EACH ROW EXECUTE FUNCTION public.families_guard_tier();

-- No GRANT. A trigger function's EXECUTE is checked at CREATE TRIGGER time, not at fire
-- time (AGENTS.md §2b), so granting it would only make it callable directly — which for
-- a function that returns a trigger record is meaningless at best.

-- ── 3. Verify ───────────────────────────────────────────────────────────────
-- Fixture-free and unconditional, so it cannot skip silently. The trigger is exercised
-- for real rather than merely asserted to exist: plpgsql resolves nothing until the body
-- runs, so a bad reference in §2 would apply cleanly and throw for the first family whose
-- name somebody edited.
DO $mig$
DECLARE
  v_code text := 'TIERPROBE';
  v_tier text;
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
     WHERE table_schema='public' AND table_name='families' AND column_name='tier'
  ) THEN
    RAISE EXCEPTION 'ROLLBACK: families.tier was not created';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger
     WHERE tgrelid = 'public.families'::regclass AND tgname = 'families_guard_tier'
  ) THEN
    RAISE EXCEPTION 'ROLLBACK: families_guard_tier trigger is missing';
  END IF;

  -- A throwaway family, created and removed inside this transaction. The same shape
  -- 20260812000000's verify block uses, and for the same reason — the only honest way to
  -- check a trigger is to make it fire. `created_by` is left NULL deliberately: nothing
  -- here needs a founder, and requiring an `auth.users` row is what let 20260806000012's
  -- verify block skip itself into a false pass on an empty database.
  INSERT INTO public.families (family_code, family_name) VALUES (v_code, 'Tier probe');

  SELECT f.tier INTO v_tier FROM public.families f WHERE f.family_code = v_code;
  IF v_tier <> 'free' THEN
    RAISE EXCEPTION 'ROLLBACK: a new family defaulted to %, expected free', v_tier;
  END IF;

  -- The service role path must WORK. This block runs as the migration's owner with no
  -- `request.jwt.claims` set, which is the shape a service-role write has — so an
  -- over-eager guard would fail here rather than in production.
  UPDATE public.families SET tier = 'premium' WHERE family_code = v_code;
  SELECT f.tier INTO v_tier FROM public.families f WHERE f.family_code = v_code;
  IF v_tier <> 'premium' THEN
    RAISE EXCEPTION 'ROLLBACK: the guard refuses a service-role tier change';
  END IF;

  -- And the vocabulary is closed.
  BEGIN
    UPDATE public.families SET tier = 'platinum' WHERE family_code = v_code;
    RAISE EXCEPTION 'ROLLBACK: families_tier_check admitted an unknown tier';
  EXCEPTION WHEN check_violation THEN
    NULL;  -- expected
  END;

  -- ORDER IS LOAD-BEARING, and it is 20260812000000's order rather than a fresh guess:
  -- inserting a family fires families_seed_permission_templates and
  -- families_seed_system_funds, and funds_protect_system() releases a system fund for
  -- deletion on exactly one condition — that the `families` row is already gone. So the
  -- family goes FIRST and the rest follows it.
  DELETE FROM public.families             WHERE family_code = v_code;
  DELETE FROM public.funds                WHERE family_code = v_code;
  DELETE FROM public.template_permissions tp
   USING public.permission_templates t
   WHERE tp.template_id = t.id AND t.family_code = v_code;
  DELETE FROM public.permission_templates WHERE family_code = v_code;
  DELETE FROM public.resource_visibility  WHERE family_code = v_code;

  RAISE NOTICE 'families.tier: default free, vocabulary closed, guard fires';
END $mig$;

COMMIT;
