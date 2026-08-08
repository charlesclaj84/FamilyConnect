-- ============================================================================
-- Accounting > Transactions: one permission per "add" button.
--
-- WHY
--   Four add affordances on /transactions — new dues payment, new donation payment,
--   new fund contribution, new disbursement — were governed by exactly TWO grants:
--     dues:edit            -> dues AND donations (one switch for two ledgers)
--     family-finances:edit -> contributions AND disbursements
--   So a treasurer who may record dues could also record donations, and there was no
--   way to let someone log a contribution without also letting them pay money out.
--
--   This gives each ledger its own key, grouped under a "Transactions" sub-section
--   inside the existing Accounting category, so Groups & Permissions reads as
--   Accounting > Transactions > <the four buttons>.
--
-- TWO NEW COLUMNS ON permission_resources
--   subsection TEXT  — the third display level. The table had only
--                      (key, label, category, sort_order) and both admin grids render
--                      a strict two-level loop, so a third level needs either a fake
--                      category or one nullable column. A fake category would ALSO
--                      change seeded behaviour: 20260618000000 grants Board Users view
--                      'any' on every non-'admin' category and auto-restricts only
--                      'admin' rows, so keeping category='accounting' keeps those
--                      defaults known. Hence the column.
--
--   actions TEXT[]   — which of view/create/edit/delete are MEANINGFUL for a row.
--                      Without it each new row renders three dead switches. That is
--                      the defect 20260805000007 deleted the 'notifications' resource
--                      for, and it is worse here: 'view' defaults to 'any', so a
--                      "Dues Payments — view: All" cell reads as a privacy control
--                      being honoured when nothing consults it.
--                      Defaults to all four so every EXISTING row is unchanged.
--
--   CRITICAL, and the reason the two fund keys below declare 'view': after this
--   migration re-points fund_contributions and fund_disbursements, those keys govern
--   their tables' SELECT policies. Declaring only 'create' would hide a LIVE read
--   control from both grids — a live wire with no switch, the exact inverse of the
--   notifications defect. Any key that owns a table must declare every action its
--   policies consult.
--
-- WHAT IS DELIBERATELY *NOT* NARROWED
--   'dues' keeps all four actions. permission_table_map maps dues_member_plans to it,
--   and the sweep split that table's FOR ALL policy into four, so dues:create and
--   dues:delete are consulted by live INSERT/DELETE policies. Narrowing the array
--   would hide grants that still authorize PostgREST writes — unrevocable from the UI.
--   Only its LABEL changes, to say what it now means: whose dues records you may see.
--
-- RE-POINTING, AND WHY IT NEEDS POLICY SURGERY
--   fund_contributions and fund_disbursements move from 'family-finances' to their new
--   keys. _perm_predicate() in 20260618000001 bakes the resource key into each policy
--   as a %L LITERAL, so updating permission_table_map alone changes NOTHING live — the
--   map is read only when the sweep runs. Section 6 rewrites the literals, following
--   20260805000006, which is the worked example in this repo.
--
--   funds, fund_allocations and fund_milestones stay on 'family-finances': they are
--   fund CONFIGURATION, not transactions.
--
-- IDEMPOTENT throughout. Safe to re-run.
--
-- USAGE
--   psql "$DATABASE_URL" -f 20260806000000_transactions_recording_permissions.sql
-- ============================================================================

BEGIN;

-- ── 1. The two new columns ──────────────────────────────────────────────────
ALTER TABLE public.permission_resources
  ADD COLUMN IF NOT EXISTS subsection TEXT,
  ADD COLUMN IF NOT EXISTS actions    TEXT[] NOT NULL
    DEFAULT ARRAY['view','create','edit','delete']::TEXT[];

-- Every element must be a real action, so a typo cannot silently hide a column.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'permission_resources_actions_valid'
  ) THEN
    ALTER TABLE public.permission_resources
      ADD CONSTRAINT permission_resources_actions_valid
      CHECK (
        array_length(actions, 1) >= 1
        AND actions <@ ARRAY['view','create','edit','delete']::TEXT[]
      );
  END IF;
END $$;

-- ── 2. The four recording resources ─────────────────────────────────────────
-- sort_order 116-119 slots them between Transactions (115) and Family Finances (120).
--
-- THE LABELS ARE THE LEDGER TABS' OWN, since 20260808000000: LEDGER_LABELS in
-- components/transactions/ledgers.ts is what the rail on /transactions prints, and the
-- grid on Members & Access said "Fund Disbursements" where the tab says
-- "Disbursements". Updated HERE as well as there for the same reason the actions
-- below are — this insert is ON CONFLICT DO UPDATE ... SET label = EXCLUDED.label.
-- They read unambiguously despite `admin/account/*` now carrying "Dues" and
-- "Donations" too, because each set renders under its own sub-heading.
INSERT INTO public.permission_resources (key, label, category, subsection, sort_order, actions) VALUES
  -- Both payment ledgers gained 'view' in 20260808000000: it decides whether the tab
  -- is offered on /transactions and whether the page fetches the ledger at all. The
  -- ROWS inside it stay governed by `dues`, which is where dues_payments is mapped —
  -- a member's own history behind My Summary must not depend on a ledger grant.
  ('transactions/dues-payments',      'Dues',           'accounting', 'Transactions', 116, ARRAY['view','create']::TEXT[]),
  ('transactions/donation-payments',  'Donations',      'accounting', 'Transactions', 117, ARRAY['view','create']::TEXT[]),
  -- These two own their tables after section 5, so they must declare every action
  -- their policies consult — see the header note.
  --
  -- fund-disbursements listed 'delete' until 20260807000002 made the table append-only.
  -- Narrowed HERE as well as there because this insert is ON CONFLICT DO UPDATE ... SET
  -- actions = EXCLUDED.actions, so leaving it would put a dead Delete column back on the
  -- Members & Access grid the next time this migration replays (AGENTS.md §6).
  ('transactions/fund-contributions', 'Contributions',  'accounting', 'Transactions', 118, ARRAY['view','create']::TEXT[]),
  ('transactions/fund-disbursements', 'Disbursements',  'accounting', 'Transactions', 119, ARRAY['view','create']::TEXT[])
ON CONFLICT (key) DO UPDATE
  SET label      = EXCLUDED.label,
      category   = EXCLUDED.category,
      subsection = EXCLUDED.subsection,
      sort_order = EXCLUDED.sort_order,
      actions    = EXCLUDED.actions;

-- ── 3. 'dues' says what it now means ────────────────────────────────────────
-- Label only. Recording moved to the keys above; this governs whose dues RECORDS a
-- caller may see and administer (dues_payments SELECT, dues_member_plans).
UPDATE public.permission_resources
   SET label = 'Dues Records'
 WHERE key = 'dues' AND label <> 'Dues Records';

-- ── 4. Carry existing authority forward ─────────────────────────────────────
-- Behaviour-preserving for everyone who can record today. Only scope 'any' is
-- carried: 'own' is deliberately NOT, because dues:edit='own' currently authorizes
-- recording for ANYONE through the && short-circuit in recordPayment (dues.ts:619),
-- which is the bug this release closes. Nobody should inherit that.
INSERT INTO public.group_permissions (group_id, resource_key, action, scope, updated_at)
SELECT gp.group_id, k.new_key, 'create'::public.permission_action, 'any'::public.permission_scope, NOW()
  FROM public.group_permissions gp
  JOIN (VALUES
        ('dues',            'transactions/dues-payments'),
        ('dues',            'transactions/donation-payments'),
        ('family-finances', 'transactions/fund-contributions'),
        ('family-finances', 'transactions/fund-disbursements')
       ) AS k(old_key, new_key) ON k.old_key = gp.resource_key
 WHERE gp.action = 'edit' AND gp.scope = 'any'
ON CONFLICT (group_id, resource_key, action) DO NOTHING;

INSERT INTO public.person_permissions (person_id, resource_key, action, scope, updated_at)
SELECT pp.person_id, k.new_key, 'create'::public.permission_action, 'any'::public.permission_scope, NOW()
  FROM public.person_permissions pp
  JOIN (VALUES
        ('dues',            'transactions/dues-payments'),
        ('dues',            'transactions/donation-payments'),
        ('family-finances', 'transactions/fund-contributions'),
        ('family-finances', 'transactions/fund-disbursements')
       ) AS k(old_key, new_key) ON k.old_key = pp.resource_key
 WHERE pp.action = 'edit' AND pp.scope = 'any'
ON CONFLICT (person_id, resource_key, action) DO NOTHING;

-- Deleting a disbursement was governed by family-finances:delete; keep that too.
INSERT INTO public.group_permissions (group_id, resource_key, action, scope, updated_at)
SELECT gp.group_id, 'transactions/fund-disbursements', 'delete'::public.permission_action, 'any'::public.permission_scope, NOW()
  FROM public.group_permissions gp
 WHERE gp.resource_key = 'family-finances' AND gp.action = 'delete' AND gp.scope = 'any'
ON CONFLICT (group_id, resource_key, action) DO NOTHING;

-- ── 5. Carry the VIEW configuration for the two re-pointed tables ───────────
-- Both resource_visibility AND any explicit grant. Copying only visibility would let
-- an explicit 'none'/'own' fall through to the resolver default of 'any' and silently
-- WIDEN reads: auth_permission returns an explicit grant before consulting visibility
-- (20260618000000) and setGroupPermission accepts an arbitrary resourceKey from the
-- client, so a family can hold a family-finances grant the admin grid never showed.
INSERT INTO public.resource_visibility (family_code, resource_key, visibility, updated_at)
SELECT rv.family_code, k.new_key, rv.visibility, NOW()
  FROM public.resource_visibility rv
  JOIN (VALUES ('transactions/fund-contributions'), ('transactions/fund-disbursements')) AS k(new_key) ON TRUE
 WHERE rv.resource_key = 'family-finances'
ON CONFLICT (family_code, resource_key) DO NOTHING;

INSERT INTO public.group_permissions (group_id, resource_key, action, scope, updated_at)
SELECT gp.group_id, k.new_key, gp.action, gp.scope, NOW()
  FROM public.group_permissions gp
  JOIN (VALUES ('transactions/fund-contributions'), ('transactions/fund-disbursements')) AS k(new_key) ON TRUE
 WHERE gp.resource_key = 'family-finances' AND gp.action = 'view'
ON CONFLICT (group_id, resource_key, action) DO NOTHING;

INSERT INTO public.person_permissions (person_id, resource_key, action, scope, updated_at)
SELECT pp.person_id, k.new_key, pp.action, pp.scope, NOW()
  FROM public.person_permissions pp
  JOIN (VALUES ('transactions/fund-contributions'), ('transactions/fund-disbursements')) AS k(new_key) ON TRUE
 WHERE pp.resource_key = 'family-finances' AND pp.action = 'view'
ON CONFLICT (person_id, resource_key, action) DO NOTHING;

-- ── 6. Re-point the table map ───────────────────────────────────────────────
UPDATE public.permission_table_map
   SET resource_key = 'transactions/fund-contributions'
 WHERE table_name = 'fund_contributions';

UPDATE public.permission_table_map
   SET resource_key = 'transactions/fund-disbursements',
       -- 'own' must never authorize a self-payout: the disbursement paying the caller
       -- is the abuse case, which is why the app uses canAny() here. Fail closed.
       own_expr     = 'false'
 WHERE table_name = 'fund_disbursements';

-- ── 7. Rewrite the policies carrying the OLD key as a baked literal ─────────
-- Same text-surgery shape as 20260805000006. Only the resource literal changes; the
-- family scoping and ownership clauses are reproduced verbatim from pg_policies.
DO $$
DECLARE
  p       record;
  v_roles text;
  v_qual  text;
  v_check text;
  v_n     int := 0;
BEGIN
  FOR p IN
    SELECT tablename, policyname, cmd, qual, with_check, roles
      FROM pg_policies
     WHERE schemaname = 'public'
       AND tablename IN ('fund_contributions', 'fund_disbursements')
       AND (COALESCE(qual, '') LIKE '%family-finances%'
         OR COALESCE(with_check, '') LIKE '%family-finances%')
  LOOP
    v_roles := array_to_string(p.roles, ', ');
    v_qual  := replace(p.qual, 'family-finances',
                 CASE WHEN p.tablename = 'fund_contributions'
                      THEN 'transactions/fund-contributions'
                      ELSE 'transactions/fund-disbursements' END);
    v_check := replace(p.with_check, 'family-finances',
                 CASE WHEN p.tablename = 'fund_contributions'
                      THEN 'transactions/fund-contributions'
                      ELSE 'transactions/fund-disbursements' END);

    EXECUTE format('DROP POLICY %I ON public.%I', p.policyname, p.tablename);

    IF p.cmd = 'SELECT' THEN
      EXECUTE format('CREATE POLICY %I ON public.%I FOR SELECT TO %s USING (%s)',
                     p.policyname, p.tablename, v_roles, v_qual);
    ELSIF p.cmd = 'INSERT' THEN
      EXECUTE format('CREATE POLICY %I ON public.%I FOR INSERT TO %s WITH CHECK (%s)',
                     p.policyname, p.tablename, v_roles, v_check);
    ELSIF p.cmd = 'UPDATE' THEN
      IF v_check IS NULL THEN
        EXECUTE format('CREATE POLICY %I ON public.%I FOR UPDATE TO %s USING (%s)',
                       p.policyname, p.tablename, v_roles, v_qual);
      ELSE
        EXECUTE format('CREATE POLICY %I ON public.%I FOR UPDATE TO %s USING (%s) WITH CHECK (%s)',
                       p.policyname, p.tablename, v_roles, v_qual, v_check);
      END IF;
    ELSIF p.cmd = 'DELETE' THEN
      EXECUTE format('CREATE POLICY %I ON public.%I FOR DELETE TO %s USING (%s)',
                     p.policyname, p.tablename, v_roles, v_qual);
    ELSE
      IF v_check IS NULL THEN
        EXECUTE format('CREATE POLICY %I ON public.%I FOR ALL TO %s USING (%s)',
                       p.policyname, p.tablename, v_roles, v_qual);
      ELSE
        EXECUTE format('CREATE POLICY %I ON public.%I FOR ALL TO %s USING (%s) WITH CHECK (%s)',
                       p.policyname, p.tablename, v_roles, v_qual, v_check);
      END IF;
    END IF;

    v_n := v_n + 1;
  END LOOP;

  RAISE NOTICE 'rekeyed % fund policies to transactions/*', v_n;
END $$;

-- ── 8. Verify ───────────────────────────────────────────────────────────────
DO $$
DECLARE v_left int; v_missing int;
BEGIN
  SELECT COUNT(*) INTO v_left
    FROM pg_policies
   WHERE schemaname = 'public'
     AND tablename IN ('fund_contributions', 'fund_disbursements')
     AND (COALESCE(qual, '') LIKE '%family-finances%'
       OR COALESCE(with_check, '') LIKE '%family-finances%');
  IF v_left > 0 THEN
    RAISE EXCEPTION 'ROLLBACK: % fund policies still reference family-finances', v_left;
  END IF;

  SELECT COUNT(*) INTO v_missing
    FROM (VALUES ('transactions/dues-payments'), ('transactions/donation-payments'),
                 ('transactions/fund-contributions'), ('transactions/fund-disbursements')) AS k(key)
   WHERE NOT EXISTS (SELECT 1 FROM public.permission_resources r WHERE r.key = k.key);
  IF v_missing > 0 THEN
    RAISE EXCEPTION 'ROLLBACK: % recording resources missing', v_missing;
  END IF;

  -- The backfill is the failure mode the test suite cannot see: tests/rls/seed.mjs
  -- grants its harness Administrators 'any' on every permission_resources row, so the
  -- suite stays green whether or not section 4 ran. This is the only guard.
  IF EXISTS (
    SELECT 1 FROM public.group_permissions gp
     WHERE gp.resource_key = 'dues' AND gp.action = 'edit' AND gp.scope = 'any'
       AND NOT EXISTS (
         SELECT 1 FROM public.group_permissions n
          WHERE n.group_id = gp.group_id
            AND n.resource_key = 'transactions/dues-payments'
            AND n.action = 'create')
  ) THEN
    RAISE EXCEPTION 'ROLLBACK: dues:edit=any grants were not carried to transactions/dues-payments';
  END IF;
END $$;

COMMIT;
