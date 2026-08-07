-- ============================================================================
-- A permanent Donations fund, a required/optional flag on dues, and a member's
-- right to opt out of the optional ones.
--
-- ─────────────────────────────────────────────────────────────────────────────
-- 1. EVERY FAMILY HAS A DONATIONS FUND, AND IT CANNOT BE REMOVED
--
-- Donation money had nowhere of its own to land. A paid donation went through
-- routePaidPayment like any other payment, which splits it across the family's funds by
-- the dues allocation percentages — so a gift to the Scholarship Drive was silently
-- divided between the Reunion fund and whatever else happened to be configured, and
-- "how much have we been given?" could only be answered by summing dues_payments and
-- hoping nobody had since spent it.
--
-- `funds.system_key` marks a fund the application depends on by name rather than by id.
-- 'donations' is the only one today. Three things follow, and all three are enforced
-- here rather than in the actions, because every accounting write in this app goes
-- through the service role and RLS cannot bind it:
--
--   * It is created for every family — backfilled for the ones that exist, and by an
--     AFTER INSERT trigger on `families` for the ones that do not yet. Same shape as
--     20260806000008's system groups, and for the same reason: a one-off backfill only
--     ever covers the families of that moment.
--   * It cannot be DELETED, and it cannot be DEACTIVATED. Deactivating is the same
--     removal by a different name — an inactive fund drops out of every read — so
--     refusing the delete alone would be a lock on the front door with the window open.
--   * `system_key` itself cannot be changed, which is what stops the fund being
--     demoted to an ordinary one and then deleted.
--
-- RENAMING IS ALLOWED, deliberately. A family that calls them Gifts should be able to
-- say so; nothing looks the fund up by name.
--
-- IT IS NOT IN THE DUES WATERFALL. That is enforced in code (getActiveFundsForRouting
-- and getFundAllocations both exclude it) rather than here, because "which funds share
-- out dues" is a routing question with no representation in this schema. Worth stating
-- plainly because the default is the dangerous one: effectiveAllocations() hands 100%
-- to the highest-priority fund when nothing is configured, so a system fund left in the
-- pool could quietly collect every dues payment the family makes. It is seeded at
-- priority 1000 so that even if it did leak into the pool it would be filled last.
--
-- ─────────────────────────────────────────────────────────────────────────────
-- 2. DUES ARE REQUIRED OR OPTIONAL
--
-- `dues_schedules.required`, default TRUE — which is what every existing row means: the
-- table has only ever described obligations. Donations are forced FALSE and held there
-- by a CHECK: a donation nobody may decline is not a donation.
--
-- ─────────────────────────────────────────────────────────────────────────────
-- 3. A MEMBER MAY OPT OUT OF AN OPTIONAL DUE
--
-- `dues_member_plans.opted_out`. That table already holds the member's per-schedule
-- choice (which cadence they pay on), so the choice not to pay at all belongs beside it
-- rather than in a table of its own.
--
-- A trigger refuses opting out of a REQUIRED due. This is the one rule here that a
-- member can reach directly — setMyDuesOptOut is self-service, so it takes no grant and
-- its arguments come from the browser — which makes the database the right place for it
-- rather than the only-checked-in-TypeScript place. The action checks too, so the member
-- gets a sentence instead of a raised exception.
--
-- IDEMPOTENT. Safe to re-run.
-- ============================================================================

BEGIN;

-- ── 1a. The column and its uniqueness ───────────────────────────────────────
ALTER TABLE funds
  ADD COLUMN IF NOT EXISTS system_key TEXT;

COMMENT ON COLUMN funds.system_key IS
  'Marks a fund the application depends on by name. ''donations'' receives every donation payment. Undeletable and cannot be deactivated (funds_protect_system).';

-- One system fund of each kind per family. Partial, so ordinary funds are unaffected.
CREATE UNIQUE INDEX IF NOT EXISTS funds_system_key_per_family_idx
  ON funds(family_code, system_key)
  WHERE system_key IS NOT NULL;

-- ── 1b. Seeder, shared by the backfill and the trigger ──────────────────────
CREATE OR REPLACE FUNCTION public.seed_family_system_funds(p_family_code TEXT)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  INSERT INTO public.funds (
    family_code, name, description, system_key,
    active, priority, minimum_cents, open_contributions
  )
  VALUES (
    p_family_code,
    'Donations',
    'Every donation the family receives lands here. Created automatically and cannot be removed.',
    'donations',
    TRUE,
    -- Last in priority order. It is excluded from dues routing in code; this is the
    -- belt-and-braces position in case it ever is not.
    1000,
    0,
    FALSE
  )
  ON CONFLICT DO NOTHING;
END $$;

-- Called only from the trigger below and from this migration, both of which run as the
-- owner, so it needs no grant to anyone.
REVOKE ALL ON FUNCTION public.seed_family_system_funds(TEXT) FROM PUBLIC;

-- ── 1c. Backfill every existing family ──────────────────────────────────────
DO $$
DECLARE
  v_code text;
  v_count int := 0;
BEGIN
  -- Sourced from `people` as well as `families`, matching 20260806000008: a family_code
  -- with members but no families row would otherwise be skipped, and those exist.
  FOR v_code IN
    SELECT family_code FROM public.families
    UNION
    SELECT DISTINCT family_code FROM public.people WHERE family_code IS NOT NULL
  LOOP
    PERFORM public.seed_family_system_funds(v_code);
    v_count := v_count + 1;
  END LOOP;
  RAISE NOTICE 'system funds seeded for % family code(s)', v_count;
END $$;

-- ── 1d. And for every family created from now on ────────────────────────────
CREATE OR REPLACE FUNCTION public.families_seed_system_funds()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  PERFORM public.seed_family_system_funds(NEW.family_code);
  RETURN NEW;
END $$;

REVOKE ALL ON FUNCTION public.families_seed_system_funds() FROM PUBLIC;

DROP TRIGGER IF EXISTS families_seed_system_funds ON public.families;
CREATE TRIGGER families_seed_system_funds
  AFTER INSERT ON public.families
  FOR EACH ROW EXECUTE FUNCTION public.families_seed_system_funds();

-- ── 1e. The fund cannot be removed ──────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.funds_protect_system()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    IF OLD.system_key IS NOT NULL THEN
      -- The one exception: the family itself is going. funds.family_code has no foreign
      -- key to families, so this is not an RI cascade — it is the family_code no longer
      -- existing, which is the only circumstance in which the fund should not.
      IF NOT EXISTS (SELECT 1 FROM public.families WHERE family_code = OLD.family_code) THEN
        RETURN OLD;
      END IF;
      RAISE EXCEPTION 'The % fund is built in and cannot be deleted', OLD.name
        USING ERRCODE = '42501';
    END IF;
    RETURN OLD;
  END IF;

  -- UPDATE. Only applies to a row that IS or WAS a system fund.
  IF OLD.system_key IS NULL AND NEW.system_key IS NULL THEN
    RETURN NEW;
  END IF;

  IF NEW.system_key IS DISTINCT FROM OLD.system_key THEN
    RAISE EXCEPTION 'funds.system_key cannot be changed (fund %)', OLD.id
      USING ERRCODE = '42501';
  END IF;

  -- Deactivating is removal by another name: an inactive fund disappears from every
  -- read in the application, so allowing it would make the delete guard above decorative.
  IF OLD.active AND NOT NEW.active THEN
    RAISE EXCEPTION 'The % fund is built in and cannot be deactivated', OLD.name
      USING ERRCODE = '42501';
  END IF;

  RETURN NEW;
END $$;

REVOKE ALL ON FUNCTION public.funds_protect_system() FROM PUBLIC;

DROP TRIGGER IF EXISTS funds_protect_system ON public.funds;
CREATE TRIGGER funds_protect_system
  BEFORE UPDATE OR DELETE ON public.funds
  FOR EACH ROW EXECUTE FUNCTION public.funds_protect_system();

-- ── 2. Required vs optional dues ────────────────────────────────────────────
ALTER TABLE dues_schedules
  ADD COLUMN IF NOT EXISTS required BOOLEAN NOT NULL DEFAULT TRUE;

COMMENT ON COLUMN dues_schedules.required IS
  'TRUE: every member owes this and cannot decline it. FALSE: optional — a member may opt out (dues_member_plans.opted_out). Always FALSE for kind = ''donation''.';

-- Backfill before the constraint, or an existing donation row fails it.
UPDATE dues_schedules SET required = FALSE WHERE kind = 'donation' AND required;

/*
 * COERCED, not just constrained — and this is the difference between a migration that
 * can be deployed on its own and one that cannot.
 *
 * `required` defaults TRUE, so ANY insert that does not mention the column creates a
 * required row. Every caller that predates this migration does exactly that, including
 * createDuesSchedule building a donation. With only the CHECK below, pushing this
 * migration ahead of the application code would make "New Donation" fail outright with a
 * constraint violation until the deploy caught up.
 *
 * Forcing the value here means the old code keeps working and the new code agrees with
 * it. The CHECK stays as the statement of the invariant, but nothing can now reach it.
 */
CREATE OR REPLACE FUNCTION public.dues_schedules_force_donation_optional()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF NEW.kind = 'donation' THEN
    NEW.required := FALSE;
  END IF;
  RETURN NEW;
END $$;

REVOKE ALL ON FUNCTION public.dues_schedules_force_donation_optional() FROM PUBLIC;

DROP TRIGGER IF EXISTS dues_schedules_force_donation_optional ON public.dues_schedules;
CREATE TRIGGER dues_schedules_force_donation_optional
  BEFORE INSERT OR UPDATE ON public.dues_schedules
  FOR EACH ROW EXECUTE FUNCTION public.dues_schedules_force_donation_optional();

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
     WHERE conname = 'dues_schedules_donation_not_required'
       AND conrelid = 'public.dues_schedules'::regclass
  ) THEN
    ALTER TABLE dues_schedules
      ADD CONSTRAINT dues_schedules_donation_not_required
      CHECK (kind IS DISTINCT FROM 'donation' OR required = FALSE);
  END IF;
END $$;

-- ── 3. Opting out of an optional due ────────────────────────────────────────
ALTER TABLE dues_member_plans
  ADD COLUMN IF NOT EXISTS opted_out BOOLEAN NOT NULL DEFAULT FALSE;

COMMENT ON COLUMN dues_member_plans.opted_out IS
  'The member has declined this OPTIONAL due. Refused for a required one by dues_member_plans_optout_allowed.';

CREATE OR REPLACE FUNCTION public.dues_member_plans_optout_allowed()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_required boolean;
  v_label text;
BEGIN
  IF NOT NEW.opted_out THEN
    RETURN NEW;
  END IF;

  SELECT required, label INTO v_required, v_label
    FROM public.dues_schedules WHERE id = NEW.schedule_id;

  -- A schedule that is gone cannot be opted out of either, but that is the referential
  -- integrity layer's answer to give, not this trigger's.
  IF v_required THEN
    RAISE EXCEPTION '% is a required due and cannot be opted out of', COALESCE(v_label, 'This due')
      USING ERRCODE = '42501';
  END IF;

  RETURN NEW;
END $$;

REVOKE ALL ON FUNCTION public.dues_member_plans_optout_allowed() FROM PUBLIC;

DROP TRIGGER IF EXISTS dues_member_plans_optout_allowed ON public.dues_member_plans;
CREATE TRIGGER dues_member_plans_optout_allowed
  BEFORE INSERT OR UPDATE ON public.dues_member_plans
  FOR EACH ROW EXECUTE FUNCTION public.dues_member_plans_optout_allowed();

-- ── Verify ──────────────────────────────────────────────────────────────────
-- Everything asserted here is schema or a seeded row, so none of it needs a fixture and
-- none of it can be skipped into a false pass.
DO $$
DECLARE
  bad text[] := '{}';
  v_missing int;
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
     WHERE table_schema = 'public' AND table_name = 'funds' AND column_name = 'system_key'
  ) THEN bad := bad || 'funds.system_key missing'; END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
     WHERE table_schema = 'public' AND table_name = 'dues_schedules' AND column_name = 'required'
  ) THEN bad := bad || 'dues_schedules.required missing'; END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
     WHERE table_schema = 'public' AND table_name = 'dues_member_plans' AND column_name = 'opted_out'
  ) THEN bad := bad || 'dues_member_plans.opted_out missing'; END IF;

  FOR v_missing IN
    SELECT 1 FROM pg_trigger
     WHERE tgname IN ('families_seed_system_funds', 'funds_protect_system',
                      'dues_member_plans_optout_allowed')
       AND NOT tgisinternal
    HAVING count(*) <> 3
  LOOP
    bad := bad || 'one or more triggers were not installed';
  END LOOP;

  -- Every family that has a families row has the fund. Asserted rather than assumed
  -- because the backfill iterates and a silent zero-row loop is the failure mode.
  SELECT count(*) INTO v_missing
    FROM public.families f
   WHERE NOT EXISTS (
     SELECT 1 FROM public.funds
      WHERE family_code = f.family_code AND system_key = 'donations'
   );
  IF v_missing > 0 THEN
    bad := bad || (v_missing || ' family(ies) have no Donations fund');
  END IF;

  IF array_length(bad, 1) IS NOT NULL THEN
    RAISE EXCEPTION 'ROLLBACK: donation fund / required dues assertion failed:%',
      E'\n  ' || array_to_string(bad, E'\n  ');
  END IF;

  RAISE NOTICE 'donation fund + required dues + opt-out: OK';
END $$;

COMMIT;
