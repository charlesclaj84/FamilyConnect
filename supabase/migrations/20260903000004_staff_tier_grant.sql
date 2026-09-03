-- ============================================================================
-- GENORRA staff can put a family on a paid plan WITHOUT a subscription.
--
-- Asked for 2026-09-03: "provide a way to upgrade a family without them needing an active
-- subscription (I've already done it in the table for Test Family 1)" — which is the honest
-- description of the state of things, and the reason this exists: the only way to do it was
-- an UPDATE typed into the table by hand, so nothing recorded who did it, for which family,
-- or why.
--
-- ── WHAT IT IS FOR ──────────────────────────────────────────────────────────
-- A pilot family, a founding family, a support gesture after an outage, a demonstration
-- account. None of those has a card on file and all of them need the paid screens.
--
-- ── WHY IT IS SAFE FROM THE BILLING LADDER, AND THIS IS THE WHOLE ARGUMENT ──
-- The obvious fear is that a granted tier gets swept back — and at day 60 of the
-- delinquency ladder a sweep does not merely change a tier, it DELETES the data the tier
-- was carrying (`delete_family_data_above_tier`). That would be a staff gesture destroying
-- a family tree two months later.
--
-- IT CANNOT HAPPEN, STRUCTURALLY RATHER THAN BY CARE, and the reason is worth stating in
-- full because a future change could take it away. Both sweeps iterate
-- `platform_billing_accounts`:
--
--   `apply_due_platform_tier_changes()` — FROM platform_billing_accounts b
--                                         WHERE b.scheduled_tier IS NOT NULL …
--   the dunning/deletion ladder        — FROM platform_billing_accounts b
--                                         WHERE b.delinquent_since IS NOT NULL …
--
-- A family that has never paid has NO ROW in that table, so it has no `scheduled_tier` and
-- no `delinquent_since`, and neither sweep can see it at all. Nothing else writes
-- `families.tier`.
--
-- **SO THE ONE DANGEROUS CASE IS A FAMILY THAT DOES HAVE A BILLING ROW**, and this function
-- refuses it rather than papering over it. If `scheduled_tier` or `delinquent_since` is set,
-- a grant would be undone — or worse, followed by a deletion — on a schedule the granter
-- cannot see. Told to stop and use the billing screens is a better answer than a silent
-- reversal in six weeks. `p_force` exists for the deliberate case and says so in the log.
--
-- ── IT IS A FOURTH WRITER OF `families.tier`, AND THAT NEEDS SAYING ─────────
-- `20260823000004` calls `apply_due_platform_tier_changes()` "the only writer", which was
-- true when written and has not been since: `lib/stripe/platform-events.ts` writes it after a
-- signature-verified event, and `setFamilyTier` (`app/actions/admin/family.ts`) writes it as
-- SCAFFOLDING for a family's own administrator. This is the fourth, and unlike the third it
-- is not scaffolding — it is a commercial act by GENORRA staff, which is why it takes a
-- REASON and records it.
--
-- What has NOT changed is that no gate reads anything but `families.tier`: `entitlementOn()`
-- describes paid standing and the SQL sweeps are the billing writers. A granted family is
-- indistinguishable from a paying one everywhere it matters, which is the point.
--
-- ── THE SERVICE ROLE IS THE ONLY PATH, AND `families_guard_tier` IS WHY ─────
-- That trigger refuses any `families.tier` change made by the `authenticated` role, so a
-- browser cannot do this however the policies are configured — the same shape as
-- `families_guard_removal`. SECURITY DEFINER here, granted to nobody, called through
-- `createAdminClient()`.
--
-- ── AND IT NEVER TOUCHES STRIPE ────────────────────────────────────────────
-- No customer, no subscription, no invoice. "Without an active subscription" is the ask, and
-- a function that quietly created one would be spending somebody's card. If a granted family
-- later subscribes, `platform_billing_accounts` appears and the ordinary machinery takes
-- over from there — which is correct, and is why nothing here writes a sentinel into that
-- table to mark the grant.
-- ============================================================================

-- ── §1. THE AUDIT RECORD ────────────────────────────────────────────────────
-- A grant is a commercial decision and the console is a shared tool, so "who, which family,
-- from what to what, and why" is the whole row. The `note` is NOT NULL and not defaulted,
-- for `genorra_staff.note`'s reason: the column is an audit record and a bare uuid is not
-- one.
--
-- RLS ON, ZERO POLICIES — `genorra_staff`'s arrangement, and the same argument. `anon` and
-- `authenticated` can read no row of this at all: it names families and staff accounts, and
-- a family's own administrator learning that GENORRA staff exist and have been adjusting
-- their plan is the first thing this console is written to avoid.
CREATE TABLE IF NOT EXISTS public.staff_tier_grants (
  id            UUID PRIMARY KEY DEFAULT extensions.gen_random_uuid(),
  family_code   TEXT NOT NULL,
  -- Both ends, because "granted Premium" is only half a fact — a support engineer reading
  -- this a year later needs to know what it replaced.
  from_tier     TEXT NOT NULL,
  to_tier       TEXT NOT NULL,
  -- The staff account that did it. No foreign key to `auth.users`: this row must outlive the
  -- account, exactly as `platform_payments` outlives a family (see `staff_delete_account`).
  granted_by    UUID,
  note          TEXT NOT NULL,
  /* Whether the granter overrode the billing-state refusal. Recorded rather than inferred:
     the billing row it was overriding may have changed by the time anybody reads this. */
  forced        BOOLEAN NOT NULL DEFAULT false,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.staff_tier_grants ENABLE ROW LEVEL SECURITY;

COMMENT ON TABLE public.staff_tier_grants IS
  'Every staff plan grant: which family, from and to which tier, by whom, and why. RLS '
  'enabled with NO policies, so neither browser role can read it — see 20260903000004. '
  'Written only by staff_grant_family_tier().';

CREATE INDEX IF NOT EXISTS staff_tier_grants_family_idx
  ON public.staff_tier_grants (family_code, created_at DESC);

-- ── §2. THE FUNCTION ────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.staff_grant_family_tier(
  p_family_code text,
  p_tier        text,
  p_note        text,
  p_force       boolean DEFAULT false,
  p_user_id     uuid DEFAULT NULL
)
RETURNS TABLE (ok boolean, family_code text, tier text, message text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  -- `v_` on everything, because `family_code` and `tier` are RETURNS TABLE names and would
  -- otherwise be ambiguous against the columns of `families` — the same reason
  -- `staff_set_family_status` prefixes its own.
  v_claims  json  := NULLIF(current_setting('request.jwt.claims', true), '')::json;
  v_role    text  := COALESCE(v_claims ->> 'role', '');
  v_actor   uuid;
  v_code    text  := upper(btrim(COALESCE(p_family_code, '')));
  v_tier    text  := lower(btrim(COALESCE(p_tier, '')));
  v_note    text  := btrim(COALESCE(p_note, ''));
  v_from    text;
  v_sched   text;
  v_delinq  date;
  -- The tiers this will accept. `families_tier_check` is the authority and §4 exercises
  -- both directions against it, so the two cannot silently drift — the device
  -- `staff_set_family_status` uses for `families.status`.
  v_valid   CONSTANT text[] := ARRAY['free', 'standard', 'plus', 'premium'];
BEGIN
  IF v_role = 'service_role' THEN
    v_actor := p_user_id;
  ELSE
    -- Anyone else is acting for themselves, whatever they passed. §2b's rule about never
    -- taking an identity as a parameter, and the reason this one may: the caller is the
    -- service role only when the app has already resolved a staff session.
    v_actor := (SELECT auth.uid());
  END IF;

  -- THE GATE, AND IT IS FIRST. A non-staff caller learns nothing about the family code they
  -- named — not whether it exists, not what plan it is on.
  IF NOT public.is_genorra_staff(v_actor) THEN
    RETURN QUERY SELECT false, NULL::text, NULL::text, 'Not authorized'; RETURN;
  END IF;

  IF NOT (v_tier = ANY (v_valid)) THEN
    RETURN QUERY SELECT false, v_code, NULL::text,
      format('Unknown tier %L. Expected one of: %s',
             v_tier, array_to_string(v_valid, ', ')); RETURN;
  END IF;

  -- A REASON IS REQUIRED. Not a default and not nullable: this row is the only record that
  -- the grant was a decision rather than an accident.
  IF v_note = '' THEN
    RETURN QUERY SELECT false, v_code, NULL::text,
      'A reason is required. It is the audit record for giving away a paid plan.'; RETURN;
  END IF;

  SELECT f.tier INTO v_from FROM public.families f WHERE f.family_code = v_code;
  IF v_from IS NULL THEN
    RETURN QUERY SELECT false, v_code, NULL::text, 'No family with that code.'; RETURN;
  END IF;

  -- ── THE ONE REFUSAL THAT MATTERS. See the header. ────────────────────────
  -- A family with billing state pending would have this grant undone by a sweep the granter
  -- cannot see — and at day 60 of the ladder that sweep DELETES the data the tier carried.
  -- Refused by default and forceable deliberately.
  SELECT b.scheduled_tier, b.delinquent_since
    INTO v_sched, v_delinq
    FROM public.platform_billing_accounts b
   WHERE b.family_code = v_code;

  IF NOT p_force AND (v_sched IS NOT NULL OR v_delinq IS NOT NULL) THEN
    RETURN QUERY SELECT false, v_code, v_from,
      format('This family has billing state that would undo the grant: %s. '
             || 'Use the billing screens, or force it deliberately.',
             CASE
               WHEN v_sched IS NOT NULL AND v_delinq IS NOT NULL
                 THEN format('a scheduled change to %L and a delinquency from %s',
                             v_sched, v_delinq)
               WHEN v_sched IS NOT NULL THEN format('a scheduled change to %L', v_sched)
               ELSE format('a delinquency from %s', v_delinq)
             END); RETURN;
  END IF;

  -- NO-OP IS REPORTED AS ONE. Writing an audit row for a grant that changed nothing would
  -- fill the record with rows describing no decision.
  IF v_from = v_tier THEN
    RETURN QUERY SELECT true, v_code, v_from,
      format('Already on %L. Nothing changed.', v_tier); RETURN;
  END IF;

  UPDATE public.families AS f SET tier = v_tier WHERE f.family_code = v_code;

  INSERT INTO public.staff_tier_grants
              (family_code, from_tier, to_tier, granted_by, note, forced)
       VALUES (v_code, v_from, v_tier, v_actor, v_note,
               p_force AND (v_sched IS NOT NULL OR v_delinq IS NOT NULL));

  RETURN QUERY SELECT true, v_code, v_tier,
    format('Moved from %L to %L.', v_from, v_tier);
END $$;

-- ── §3. GRANTS ──────────────────────────────────────────────────────────────
-- Granted to NOBODY. §2b: default privileges already revoke EXECUTE from `anon` and
-- `authenticated`, and `service_role` keeps it — which is the only caller, through
-- `createAdminClient()` behind `requireStaff()`. A browser-reachable version of this would
-- be an unauthenticated endpoint that gives away the product.
REVOKE ALL ON FUNCTION
  public.staff_grant_family_tier(text, text, text, boolean, uuid) FROM PUBLIC;

-- ── §4. VERIFY ──────────────────────────────────────────────────────────────
DO $$
DECLARE
  v_n int;
  v_ok boolean;
  v_msg text;
BEGIN
  -- The table, its RLS, and the absence of policies.
  IF NOT EXISTS (
    SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'staff_tier_grants'
  ) THEN
    RAISE EXCEPTION 'staff_tier_grants was not created';
  END IF;

  SELECT relrowsecurity INTO v_ok
    FROM pg_class WHERE oid = 'public.staff_tier_grants'::regclass;
  IF NOT v_ok THEN
    RAISE EXCEPTION 'staff_tier_grants does not have RLS enabled';
  END IF;

  SELECT count(*) INTO v_n
    FROM pg_policies WHERE schemaname = 'public' AND tablename = 'staff_tier_grants';
  IF v_n <> 0 THEN
    RAISE EXCEPTION 'staff_tier_grants must have ZERO policies, found %', v_n;
  END IF;

  -- `note` is NOT NULL, which is the audit record's whole guarantee.
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
     WHERE table_schema = 'public' AND table_name = 'staff_tier_grants'
       AND column_name = 'note' AND is_nullable = 'YES'
  ) THEN
    RAISE EXCEPTION 'staff_tier_grants.note must be NOT NULL';
  END IF;

  -- ── THE TIER LIST AGREES WITH THE CONSTRAINT, IN BOTH DIRECTIONS ─────────
  -- The function validates against its own array and `families_tier_check` is the authority.
  -- Asserting only one direction would let a fifth tier be added to the CHECK and silently
  -- be unreachable through this function, or removed from the CHECK and accepted here until
  -- the UPDATE raised a raw constraint violation at a support engineer.
  FOR v_msg IN SELECT unnest(ARRAY['free', 'standard', 'plus', 'premium']) LOOP
    IF NOT EXISTS (
      SELECT 1 FROM pg_constraint
       WHERE conrelid = 'public.families'::regclass
         AND conname = 'families_tier_check'
         AND pg_get_constraintdef(oid) LIKE '%''' || v_msg || '''%'
    ) THEN
      RAISE EXCEPTION 'families_tier_check does not admit %, which this function accepts', v_msg;
    END IF;
  END LOOP;

  -- And nothing the CHECK admits is missing from the function's list. Derived from the
  -- constraint text rather than restated, so a fifth tier fails here by name.
  SELECT count(*) INTO v_n
    FROM regexp_matches(
           (SELECT pg_get_constraintdef(oid) FROM pg_constraint
             WHERE conrelid = 'public.families'::regclass AND conname = 'families_tier_check'),
           '''([a-z]+)''', 'g') AS m(x)
   WHERE NOT (m.x[1] = ANY (ARRAY['free', 'standard', 'plus', 'premium']));
  IF v_n <> 0 THEN
    RAISE EXCEPTION
      'families_tier_check admits % tier(s) staff_grant_family_tier would refuse', v_n;
  END IF;

  -- ── A NON-STAFF CALLER IS REFUSED, MEASURED ──────────────────────────────
  -- The service-role branch with a NULL actor: `is_genorra_staff(NULL)` is false, so this is
  -- the refusal path and not a fixture-dependent one.
  SELECT g.ok, g.message INTO v_ok, v_msg
    FROM public.staff_grant_family_tier('NOSUCH', 'plus', 'verify', false, NULL) AS g;
  IF v_ok OR v_msg <> 'Not authorized' THEN
    RAISE EXCEPTION 'a non-staff caller was not refused: ok=%, message=%', v_ok, v_msg;
  END IF;

  -- ── AND THE FUNCTION IS REACHABLE BY NEITHER BROWSER ROLE ────────────────
  IF has_function_privilege('authenticated',
       'public.staff_grant_family_tier(text, text, text, boolean, uuid)', 'EXECUTE')
     OR has_function_privilege('anon',
       'public.staff_grant_family_tier(text, text, text, boolean, uuid)', 'EXECUTE') THEN
    RAISE EXCEPTION 'staff_grant_family_tier is executable by a browser role';
  END IF;

  RAISE NOTICE 'staff_grant_family_tier ready; grants audited in staff_tier_grants.';
END $$;

-- ── §5. THE THREE REGISTRIES A FAMILY-SCOPED TABLE OWES ─────────────────────
-- `staff_tier_grants` carries a `family_code`, which is what every "is this family data?"
-- test in this repo keys on — and it is NOT family data, which is exactly the trap
-- `family_roles` was and `genorra_staff_deletions` is. So all three have to be answered by
-- name, and each gets a different answer.
--
-- **AND `20260901000001` §5's COMPLETENESS ASSERTION COULD NOT CATCH THIS.** That migration
-- fails by name if a family-scoped table is on neither `tier_data_tables` nor
-- `tier_data_keep` — but it is applied, so on a fresh database it runs BEFORE this table
-- exists and passes. A table added afterwards escapes it silently, which is the
-- "editing an applied migration changes fresh databases only" rule arriving inside out.
-- Verified by measurement rather than by reading: the table was on neither list.

-- (a) THE TIER PURGE KEEPS IT. `delete_family_data_above_tier` runs when a family drops to a
--     lower plan, and the family SURVIVES that — so deleting the record of why staff put
--     them on the plan they are losing would destroy the only explanation for it, at exactly
--     the moment somebody would go looking. `platform_payments`' argument ("our revenue, not
--     their data") and `sms_consent_events`' ("a CONSENT RECORD") in a third costume.
INSERT INTO public.tier_data_keep (table_name, note) VALUES (
  'staff_tier_grants',
  'GENORRA''s own record of a plan granted by staff. Carries a family_code and is not '
  'family data — see 20260903000004 §5. A tier purge leaves the family standing, so the '
  'explanation for their plan must outlive the plan.'
) ON CONFLICT (table_name) DO UPDATE SET note = EXCLUDED.note;

-- (b) A FAMILY RESET KEEPS IT TOO, and that is in `supabase/scripts/reset_families.sql`
--     §11's keep-list rather than here, beside `genorra_staff_deletions` and for the same
--     stated reason: a FAMILY reset is not a PLATFORM reset.
--
-- (c) A PERMANENT DELETION TAKES IT, DELIBERATELY. `staff_delete_family` derives its sweep
--     from every `public` table carrying a `family_code`, so this one is included with no
--     edit — and it should be. `genorra_staff_deletions` is excluded there because it is the
--     record OF the deletion and would otherwise be removed by the statement that writes it;
--     this is a record about a family that will no longer exist, keyed by a code that will
--     resolve to nothing, and an erasure that left it behind would be keeping a note about
--     somebody who asked to be forgotten. The deletion itself is still audited, by that
--     table.
--
--     SO DO NOT ADD AN EXCLUSION FOR IT. Doing so would mean redefining that function in a
--     new migration — copying it, never describing it — to preserve a row about nothing.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.tier_data_keep WHERE table_name = 'staff_tier_grants'
  ) THEN
    RAISE EXCEPTION 'staff_tier_grants is not on tier_data_keep';
  END IF;
  IF EXISTS (
    SELECT 1 FROM public.tier_data_tables WHERE table_name = 'staff_tier_grants'
  ) THEN
    RAISE EXCEPTION 'staff_tier_grants must be KEPT, not purged';
  END IF;
  RAISE NOTICE 'staff_tier_grants registered on tier_data_keep.';
END $$;
