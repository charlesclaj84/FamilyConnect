-- ============================================================================
-- Donation beneficiaries: the people a drive is FOR, who therefore cannot see it.
--
-- THE FEATURE
--   A family raising money for one of its own — a surprise gift, a hardship
--   collection, a milestone birthday — needs the drive hidden from the person it is
--   for. Everyone else sees "80th birthday gift — for Martha Allen"; Martha sees
--   nothing at all. A drive may name several beneficiaries (a couple, a household),
--   which is why this is a join table and not a column.
--
-- WHY THIS IS NOT A PERMISSION
--   Every other gate in this app is a grant on a permission template, and an
--   administrator holds scope 'any' on all of them AND can edit the grid on Members &
--   Access. A grant-shaped answer would therefore be un-hidable from exactly the
--   people most likely to be given a gift — the ones who run the family. The
--   requirement is "even administrators", so the mechanism has to be one that no
--   amount of permission confers past.
--
--   Postgres has precisely the right primitive. Permissive policies are OR-ed
--   together: every one of them is another way IN, which is why nothing built out of
--   them can subtract. RESTRICTIVE policies are AND-ed with the result: they are the
--   only way to express "and additionally, never this row". So the exclusion is three
--   restrictive policies, and an administrator's scope-'any' grant satisfies the
--   permissive side and is then refused by this one.
--
-- ⚠ THE SWEEP WOULD SILENTLY INVERT THESE
--   20260618000001 walks permission_table_map, and for every policy on a mapped table
--   whose name does NOT begin 'perm:' it drops the policy and recreates it as
--
--       CREATE POLICY … FOR SELECT TO … USING ((<old qual>) AND <permission predicate>)
--
--   with no AS RESTRICTIVE, because it never reads pg_policies.permissive. Run that
--   over an unprefixed restrictive policy and it comes back PERMISSIVE — which does
--   not weaken the exclusion, it REVERSES it: a policy that meant "and never this row"
--   now means "or else this row", i.e. an independent grant of the very rows it exists
--   to hide. No error, no warning, and the drive appears in the beneficiary's list.
--
--   Two things stop that, and both are needed:
--     1. Every policy here is named 'perm:…', which is the sweep's skip condition.
--     2. The verify block below asserts permissive = 'RESTRICTIVE' on each one, so if
--        a future sweep ever does flatten them the next migration push fails instead
--        of shipping. AGENTS.md's rule about assertions that pass for ten seconds
--        applies: this one is checked against pg_policies, which is the live answer.
--
--   MEASURED, not reasoned. Recreating two of these as PERMISSIVE against the local
--   stack and re-running `npm run test:rls` failed TEN assertions, only three of which
--   were the beneficiary cases. The other seven were pre-existing CROSS-FAMILY cases —
--   getDuesSchedules, getMyDuesSummary, getAllDuesPayments, getDonationProgress and
--   three pending-member probes — because `NOT auth_is_donation_beneficiary(id)` is
--   true of very nearly every row, so OR-ing it alongside the real policies grants
--   BRAVO's administrator ALPHA's entire dues ledger. Getting AS RESTRICTIVE wrong
--   here does not leak one drive; it unpicks family isolation on three tables.
--
-- WHAT IS DELIBERATELY *NOT* HIDDEN
--   The money, in family-wide aggregates. A beneficiary still sees the Donations fund
--   balance and the family P&L income total, both of which include the gift they
--   cannot see itemised. That is a decision, not an oversight: netting it out would
--   mean two members of one family being shown two different balances for the same
--   bank account, with neither told which. A treasurer reconciling against a statement
--   has to be able to trust the total. What a beneficiary loses is the LABEL and the
--   ROWS — the drive, its name, its goal, its progress and every contribution to it —
--   which is what would actually spoil a surprise. An unexplained balance is a much
--   weaker signal than "Gift for Martha — $450 of $2,000".
--
-- IDEMPOTENT.
-- ============================================================================

BEGIN;

-- ── The table ───────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.donation_beneficiaries (
  id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  schedule_id  UUID        NOT NULL REFERENCES public.dues_schedules(id) ON DELETE CASCADE,
  person_id    UUID        NOT NULL REFERENCES public.people(id)         ON DELETE CASCADE,
  -- Denormalized from the schedule so every policy and every service-role query can
  -- scope by family without a join. The trigger below is what keeps it honest.
  family_code  TEXT        NOT NULL,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  -- Also the index auth_is_donation_beneficiary() probes on every row of every read
  -- of dues_schedules and dues_payments. It is not merely a uniqueness constraint.
  UNIQUE (schedule_id, person_id)
);

-- The other direction: "is this caller a beneficiary of anything?" is asked per row,
-- so person_id needs its own index rather than relying on the composite's prefix.
CREATE INDEX IF NOT EXISTS donation_beneficiaries_person_idx
  ON public.donation_beneficiaries (person_id);

CREATE INDEX IF NOT EXISTS donation_beneficiaries_family_idx
  ON public.donation_beneficiaries (family_code);

-- ── The row guard ───────────────────────────────────────────────────────────
-- AGENTS.md §4 in the database: RLS is a predicate over the row being written, and a
-- row whose family_code is the caller's own satisfies every policy no matter which
-- family the ids it CARRIES point into. The action verifies these too
-- (belongsToFamily), and this is the half that cannot be forgotten at a call site.
--
-- Also pins the kind. Dues are owed by everybody by definition — a due nobody can see
-- is a bill that silently never gets paid — so beneficiaries are a donation-only idea
-- and the table refuses to express anything else.
CREATE OR REPLACE FUNCTION public.donation_beneficiaries_guard()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_kind          text;
  v_schedule_fam  text;
  v_person_fam    text;
BEGIN
  SELECT s.kind, s.family_code INTO v_kind, v_schedule_fam
    FROM public.dues_schedules s WHERE s.id = NEW.schedule_id;

  IF v_kind IS NULL THEN
    RAISE EXCEPTION 'donation_beneficiaries: schedule % does not exist', NEW.schedule_id;
  END IF;

  IF v_kind <> 'donation' THEN
    RAISE EXCEPTION
      'donation_beneficiaries: schedule % is a % schedule; only a donation drive can '
      'have beneficiaries', NEW.schedule_id, v_kind;
  END IF;

  SELECT p.family_code INTO v_person_fam
    FROM public.people p WHERE p.id = NEW.person_id;

  IF v_person_fam IS NULL THEN
    RAISE EXCEPTION 'donation_beneficiaries: person % does not exist', NEW.person_id;
  END IF;

  -- All three must agree. Checked as a three-way equality rather than against the
  -- caller's family: this trigger also fires for the service role, which has no
  -- family, and the invariant it is protecting is about the ROW being coherent.
  IF NEW.family_code IS DISTINCT FROM v_schedule_fam
     OR NEW.family_code IS DISTINCT FROM v_person_fam THEN
    RAISE EXCEPTION
      'donation_beneficiaries: family mismatch — row %, schedule %, person %',
      NEW.family_code, v_schedule_fam, v_person_fam;
  END IF;

  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS donation_beneficiaries_guard_trg ON public.donation_beneficiaries;
CREATE TRIGGER donation_beneficiaries_guard_trg
  BEFORE INSERT OR UPDATE ON public.donation_beneficiaries
  FOR EACH ROW EXECUTE FUNCTION public.donation_beneficiaries_guard();

-- ── The predicate ───────────────────────────────────────────────────────────
-- "Is the caller a beneficiary of this drive?"
--
-- SECURITY DEFINER IS LOAD-BEARING, not boilerplate. This function reads
-- donation_beneficiaries, and donation_beneficiaries has a restrictive policy below
-- that is written IN TERMS OF THIS FUNCTION. Called as the querying role the inner
-- SELECT would be filtered by that policy — the beneficiary cannot see the row naming
-- them — so it would return false for precisely the person it exists to catch, and
-- the exclusion would evaluate to "not hidden" for everyone. It must read the table
-- as its owner.
--
-- THE IDENTITY IS NOT A PARAMETER (AGENTS.md §2b). p_schedule_id names the ROW under
-- test; the caller is re-derived from auth_person_id(), which resolves only for an
-- APPROVED member of the family they are acting in. A NULL from that — anon, pending,
-- service role — makes the EXISTS false and this returns false, which is correct: the
-- permissive policies are what refuse those callers, and a restrictive policy must
-- never be the thing standing between a legitimate reader and an ordinary row.
CREATE OR REPLACE FUNCTION public.auth_is_donation_beneficiary(p_schedule_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.donation_beneficiaries b
    WHERE b.schedule_id = p_schedule_id
      AND b.person_id   = public.auth_person_id()
  );
$$;

-- The same question about a PAYMENT, resolved through its schedule.
--
-- Its own function rather than a subquery inside the policy, for the same reason as
-- above and one more: a subquery over dues_payments inside a policy ON another table
-- evaluates that table's own policies, which here would mean fund_contributions'
-- restrictive policy depending on dues_payments' restrictive policy depending on this
-- function. SECURITY DEFINER cuts the recursion by reading both as the owner.
CREATE OR REPLACE FUNCTION public.auth_is_hidden_donation_payment(p_payment_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.dues_payments dp
    JOIN public.donation_beneficiaries b ON b.schedule_id = dp.schedule_id
    WHERE dp.id = p_payment_id
      AND b.person_id = public.auth_person_id()
  );
$$;

-- Both are named in RLS policies, and a policy expression is evaluated as the QUERYING
-- role — so without these grants every authenticated read of dues_schedules,
-- dues_payments and fund_contributions dies with "permission denied for function"
-- (AGENTS.md §2b rule 2). Default privileges since 20260806000015 revoke EXECUTE from
-- authenticated, so a new function is unreachable until a migration says otherwise.
-- service_role keeps EXECUTE by default and is not granted here.
REVOKE ALL ON FUNCTION public.auth_is_donation_beneficiary(uuid)    FROM PUBLIC;
REVOKE ALL ON FUNCTION public.auth_is_hidden_donation_payment(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.auth_is_donation_beneficiary(uuid)    TO authenticated;
GRANT EXECUTE ON FUNCTION public.auth_is_hidden_donation_payment(uuid) TO authenticated;

-- donation_beneficiaries_guard is a TRIGGER function and needs no grant: EXECUTE is
-- checked at CREATE TRIGGER time, not at fire time.

-- ── The exclusion, as three restrictive policies ────────────────────────────
-- FOR ALL rather than FOR SELECT. Hiding the row is the point, but an excluded
-- administrator who has the id from somewhere else — an old page in a tab, a
-- revalidation race, a screenshot — must not be able to rename or delete the drive
-- either. On a FOR ALL policy with no WITH CHECK, Postgres uses USING for the check
-- as well, which is what we want: a schedule with no beneficiaries yet passes, so
-- creating a drive and then naming its beneficiaries works in that order.

ALTER TABLE public.donation_beneficiaries ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "perm:beneficiaries cannot see their own drive"
  ON public.dues_schedules;
CREATE POLICY "perm:beneficiaries cannot see their own drive"
  ON public.dues_schedules
  AS RESTRICTIVE FOR ALL TO authenticated
  USING (NOT public.auth_is_donation_beneficiary(id));

DROP POLICY IF EXISTS "perm:beneficiaries cannot see gifts to their own drive"
  ON public.dues_payments;
CREATE POLICY "perm:beneficiaries cannot see gifts to their own drive"
  ON public.dues_payments
  AS RESTRICTIVE FOR ALL TO authenticated
  -- schedule_id is nullable (legacy rows predate the requirement), and NULL through
  -- the function would make the whole predicate NULL, which a policy treats as false
  -- and would hide every unscheduled payment from everybody.
  USING (schedule_id IS NULL OR NOT public.auth_is_donation_beneficiary(schedule_id));

DROP POLICY IF EXISTS "perm:beneficiaries cannot see routing of their own drive"
  ON public.fund_contributions;
CREATE POLICY "perm:beneficiaries cannot see routing of their own drive"
  ON public.fund_contributions
  AS RESTRICTIVE FOR ALL TO authenticated
  -- Same NULL care. Most contributions are not routed from a payment at all — an
  -- admin top-up, a member contribution — and those must stay visible.
  USING (dues_payment_id IS NULL
         OR NOT public.auth_is_hidden_donation_payment(dues_payment_id));

-- And the table itself: a beneficiary must not read the list that names them, or they
-- would learn the drive exists from the very row that hides it.
DROP POLICY IF EXISTS "perm:beneficiaries cannot see their own beneficiary rows"
  ON public.donation_beneficiaries;
CREATE POLICY "perm:beneficiaries cannot see their own beneficiary rows"
  ON public.donation_beneficiaries
  AS RESTRICTIVE FOR ALL TO authenticated
  USING (NOT public.auth_is_donation_beneficiary(schedule_id));

-- ── Ordinary (permissive) access to the new table ───────────────────────────
-- Read: any approved member of the family, because the drive prints "for Martha and
-- George" to everyone who can see it, and that caption is these rows. The restrictive
-- policy above is what removes Martha's own.
--
-- Write: the donations key, scope 'any'. This is family-wide configuration with no
-- coherent "own" version — a member adding THEMSELVES as a beneficiary of a drive is
-- the abuse case, not the safe subset — which is exactly what canAny is for.
DROP POLICY IF EXISTS "perm:family reads donation beneficiaries"
  ON public.donation_beneficiaries;
CREATE POLICY "perm:family reads donation beneficiaries"
  ON public.donation_beneficiaries FOR SELECT TO authenticated
  USING (
    family_code = public.auth_family_code()
    AND public.auth_person_id() IS NOT NULL
  );

DROP POLICY IF EXISTS "perm:donation editors write beneficiaries"
  ON public.donation_beneficiaries;
CREATE POLICY "perm:donation editors write beneficiaries"
  ON public.donation_beneficiaries FOR INSERT TO authenticated
  WITH CHECK (
    family_code = public.auth_family_code()
    AND public.auth_permission('admin/account/donations',
                               'edit'::public.permission_action) = 'any'
  );

DROP POLICY IF EXISTS "perm:donation editors remove beneficiaries"
  ON public.donation_beneficiaries;
CREATE POLICY "perm:donation editors remove beneficiaries"
  ON public.donation_beneficiaries FOR DELETE TO authenticated
  USING (
    family_code = public.auth_family_code()
    AND public.auth_permission('admin/account/donations',
                               'edit'::public.permission_action) = 'any'
  );

-- No UPDATE policy, deliberately. A beneficiary row is (schedule, person) and nothing
-- else; changing either one is a different row. The app deletes and re-inserts.

GRANT SELECT, INSERT, DELETE ON public.donation_beneficiaries TO authenticated;
GRANT ALL                    ON public.donation_beneficiaries TO service_role;

-- Which resource key governs the table, so the code and the database cannot drift
-- about it (AGENTS.md §2). own_expr/self_expr are 'false': there is no version of
-- this row a member owns. The sweep will not touch the policies above — they are all
-- 'perm:'-prefixed and it skips those — so this row is the record, not the mechanism.
INSERT INTO public.permission_table_map (table_name, resource_key, own_expr, self_expr)
VALUES ('donation_beneficiaries', 'admin/account/donations', 'false', 'false')
ON CONFLICT (table_name) DO UPDATE
  SET resource_key = EXCLUDED.resource_key,
      own_expr     = EXCLUDED.own_expr,
      self_expr    = EXCLUDED.self_expr;

-- ── Verify ──────────────────────────────────────────────────────────────────
-- Unconditional: none of this needs an auth.users row, a family or any fixture, so it
-- cannot quietly skip the way 20260806000012's block did.
DO $$
DECLARE
  r            record;
  v_expected   text[] := ARRAY[
    'dues_schedules|perm:beneficiaries cannot see their own drive',
    'dues_payments|perm:beneficiaries cannot see gifts to their own drive',
    'fund_contributions|perm:beneficiaries cannot see routing of their own drive',
    'donation_beneficiaries|perm:beneficiaries cannot see their own beneficiary rows'
  ];
  v_key        text;
  v_permissive text;
BEGIN
  FOREACH v_key IN ARRAY v_expected LOOP
    SELECT p.permissive INTO v_permissive
      FROM pg_policies p
     WHERE p.schemaname = 'public'
       AND p.tablename  = split_part(v_key, '|', 1)
       AND p.policyname = split_part(v_key, '|', 2);

    IF v_permissive IS NULL THEN
      RAISE EXCEPTION 'exclusion policy missing: %', v_key;
    END IF;

    -- THE assertion. A permissive policy of this name does not merely fail to hide
    -- the drive — it is an extra OR branch granting exactly the rows it was written
    -- to withhold, which is strictly worse than having no policy at all. If the sweep
    -- is ever re-run over these, this is what stops the deploy.
    IF v_permissive <> 'RESTRICTIVE' THEN
      RAISE EXCEPTION
        'exclusion policy % is % — it must be RESTRICTIVE. A permissive policy with '
        'this expression GRANTS the hidden rows instead of withholding them; see the '
        'sweep note at the top of this migration.', v_key, v_permissive;
    END IF;
  END LOOP;

  -- The policies are useless if the role evaluating them cannot call the functions
  -- they are written in terms of: every authenticated read of these three tables
  -- would fail outright rather than filter.
  IF NOT has_function_privilege('authenticated',
        'public.auth_is_donation_beneficiary(uuid)', 'EXECUTE') THEN
    RAISE EXCEPTION 'authenticated cannot EXECUTE auth_is_donation_beneficiary';
  END IF;
  IF NOT has_function_privilege('authenticated',
        'public.auth_is_hidden_donation_payment(uuid)', 'EXECUTE') THEN
    RAISE EXCEPTION 'authenticated cannot EXECUTE auth_is_hidden_donation_payment';
  END IF;

  -- SECURITY DEFINER on the predicate is not a preference — see its header. Read as
  -- the querying role it would be filtered by the very policy it powers and return
  -- false for the one person it exists to catch.
  FOR r IN
    SELECT proname, prosecdef
      FROM pg_proc
     WHERE pronamespace = 'public'::regnamespace
       AND proname IN ('auth_is_donation_beneficiary', 'auth_is_hidden_donation_payment')
  LOOP
    IF NOT r.prosecdef THEN
      RAISE EXCEPTION '%() must be SECURITY DEFINER', r.proname;
    END IF;
  END LOOP;
END $$;

COMMIT;
