-- ============================================================================
-- The grid says what the screens say: one resource per rail item, one caption
-- per rail item.
--
-- WHY
--   Members & Access renders permission_resources verbatim, so the grid is only a
--   truthful map of the app if every switchable surface has a row, every row names
--   itself the way the surface does, and every ACTION column is wired to something.
--   A review found four ways it had drifted.
--
--   1. RAIL ITEMS WITH NO GRANT OF THEIR OWN
--      Transactions' four ledgers all rendered off `transactions:view`, and My
--      Summary's three panes off `account-summary:view`. So "let the treasurer see
--      dues but not what the family paid out" was not expressible, and neither was
--      "this member has nothing to do with donations". 20260806000007 had already
--      solved this for the Accounting admin page's sections; this brings the other
--      two rails in line and finishes Accounting, where Processing and Bank
--      Information still shared one key between two rail items.
--
--   2. TWO TABS BEHIND ONE GRANT
--      Members & Access has three tabs. Pending Approval has held its own key since
--      20260806000010; Members and Permission Templates shared `admin/users`, so
--      maintaining the roster and rewriting the family's permission grid were the
--      same switch. They are not the same job, and the second one can grant itself
--      everything — it is the screen that decides what every other screen may do.
--
--   3. CAPTIONS THAT NAMED THE TABLE RATHER THAN THE SCREEN
--      The grid said "Dues Schedules" where Accounting's rail says "Dues", "Fund
--      Disbursements" where the Transactions rail says "Disbursements", "Member
--      Approvals" where the tab says "Pending Approval". An administrator matching a
--      switch to the thing it switches off should not have to translate.
--
--   4. ACTION COLUMNS WIRED TO NOTHING
--      `transactions` and `account-summary` each declared all four actions while
--      nothing in the app, in permission_table_map or in any policy consulted
--      anything but their view. Six switches that looked like privacy controls and
--      were read by no one. The `actions` column exists to prevent exactly that —
--      see 20260806000000, which added it.
--
-- WHAT IS DELIBERATELY *NOT* HERE, AND MUST NOT BE ADDED
--   Dashboard and the four Personal pages — My Profile, My Families, My Children,
--   Family Tree. 20260806000006 deleted them on the argument that they are a
--   member's own things rather than something a family administers, and this review
--   reconsidered that decision and KEPT it. They stay unregistered, which is what
--   makes them permanently viewable: auth_permission() and resolveScope() both
--   default 'view' to 'any' for a key with no resource_visibility row.
--
--   Registering Dashboard in particular would let a family 404 a member's own
--   post-login destination, and a new template — which starts as a complete grid of
--   denials — would do it by default. The empty `personal` heading in
--   components/admin/resource-groups.ts is the visible trace of this; it is not a
--   bug to fix by adding rows.
--
-- ORDERING NOTE
--   §5 relabels rows that §1-§4 create or copy from, so it runs last. §3 and §4 each
--   backfill BEFORE deleting or re-pointing, so no grant is dropped between states.
--
-- IDEMPOTENT. Every insert is ON CONFLICT, every backfill is DO NOTHING, every
-- policy is dropped and recreated, and every update is guarded on the value it sets.
-- Safe on an empty database, where the backfill loops find no templates.
--
-- USAGE
--   psql "$DATABASE_URL" -f 20260808000000_permission_surface_audit.sql
-- ============================================================================

BEGIN;

-- ── 1. My Summary: one grant per pane ───────────────────────────────────────
-- The rail on /account-summary is Upcoming Dues | Donations | Payment History, and
-- until now all three rode on `account-summary:view`.
--
-- VIEW ONLY, on purpose. The one control inside these panes is the cadence picker
-- and the opt-out on a member's own dues row, which goes through setMyDuesPlan() —
-- self-service by definition (AGENTS.md §2: "create and edit default to scope
-- 'none', so demanding a grant for these would lock the whole family out"). A member
-- choosing how to pay their own dues is not something a template grants, so an edit
-- column here would be a switch wired to nothing.
--
-- KEY PREFIX MATTERS, exactly as it does for `transactions/` and `admin/account/`:
-- getResources() drops any row where isFeatureFuture('/' || key) is true, and
-- getFeature() longest-prefix-matches — '/account-summary/dues' matches only
-- '/account-summary', which is live. A key under a 'future' prefix vanishes from the
-- grid with no error at all.
--
-- sort_order 101-103 sits them between My Summary (100) and Dues Records (110).
-- 20260806000005 asserts the accounting category has no duplicate sort_order; these
-- three values are free.
INSERT INTO public.permission_resources (key, label, category, subsection, sort_order, actions) VALUES
  ('account-summary/dues',      'Upcoming Dues',   'accounting', 'My Summary', 101, ARRAY['view']::TEXT[]),
  ('account-summary/donations', 'Donations',       'accounting', 'My Summary', 102, ARRAY['view']::TEXT[]),
  ('account-summary/history',   'Payment History', 'accounting', 'My Summary', 103, ARRAY['view']::TEXT[])
ON CONFLICT (key) DO UPDATE
  SET label      = EXCLUDED.label,
      category   = EXCLUDED.category,
      subsection = EXCLUDED.subsection,
      sort_order = EXCLUDED.sort_order,
      actions    = EXCLUDED.actions;

-- Every pane inherits the template's existing grant on the page, so nobody's My
-- Summary changes on deploy. Same shape as 20260806000007 §3, and DO NOTHING so a
-- re-run never stamps over a grant an administrator has since adjusted.
INSERT INTO public.template_permissions (template_id, resource_key, action, scope, updated_at)
SELECT tp.template_id, pr.key, 'view'::public.permission_action, tp.scope, NOW()
  FROM public.template_permissions tp
 CROSS JOIN public.permission_resources pr
 WHERE tp.resource_key = 'account-summary' AND tp.action = 'view'
   AND pr.key LIKE 'account-summary/%'
ON CONFLICT (template_id, resource_key, action) DO NOTHING;

-- ── 2. Transactions: the two payment ledgers gain a view ────────────────────
-- 20260806000000 gave the four ledgers a `create` each so the add buttons could be
-- granted separately. It did not give the two payment ledgers a `view`, because at
-- the time nothing consulted one — the page showed all four tabs to anyone holding
-- `transactions:view`.
--
-- WHAT THIS GRANT DECIDES, precisely, because it is not the same answer for all four:
--
--   transactions/fund-contributions   permission_table_map points fund_contributions
--   transactions/fund-disbursements   and fund_disbursements at these keys, so their
--                                     view is already the RLS SELECT predicate. It now
--                                     ALSO decides whether the tab is offered and
--                                     whether the page fetches at all.
--
--   transactions/dues-payments        dues_payments is mapped to `dues`, and stays
--   transactions/donation-payments    mapped to it — a member's own history behind My
--                                     Summary must not depend on a ledger grant. So
--                                     these two views are an APP-LAYER gate on the
--                                     ledger tab and its fetch, and `dues:view` still
--                                     decides which rows come back inside it.
--
--   Both halves are real. A caller with the ledger grant and `dues:view` = 'own' sees
--   the tab and their own payments in it, which is what they see today.
--
-- The gate lives in app/(protected)/transactions/page.tsx, which skips the fetch
-- rather than hiding a rendered tab — props reach the browser in the RSC payload
-- whether a component renders them or not (AGENTS.md §5).
UPDATE public.permission_resources
   SET actions = ARRAY['view','create']::TEXT[]
 WHERE key IN ('transactions/dues-payments', 'transactions/donation-payments')
   AND actions <> ARRAY['view','create']::TEXT[];

-- Every ledger inherits the template's grant on the page. `'view' = ANY(pr.actions)`
-- excludes transactions/reversals, which declares create only — reversing is a row
-- action on the dues ledger, not a tab of its own, and a view column on it would be
-- the dead switch this migration is removing elsewhere.
INSERT INTO public.template_permissions (template_id, resource_key, action, scope, updated_at)
SELECT tp.template_id, pr.key, 'view'::public.permission_action, tp.scope, NOW()
  FROM public.template_permissions tp
 CROSS JOIN public.permission_resources pr
 WHERE tp.resource_key = 'transactions' AND tp.action = 'view'
   AND pr.key LIKE 'transactions/%'
   AND 'view' = ANY(pr.actions)
ON CONFLICT (template_id, resource_key, action) DO NOTHING;

-- ── 3. Accounting Settings: one key for two rail items becomes two ──────────
-- The Settings group holds Processing and Bank Information, two separate items on
-- the second-level rail, sharing `admin/account/settings`. 20260806000007 justified
-- that by "neither is implemented yet" — but the rule this migration is applying is
-- one grant per rail item, and a placeholder is still a rail item. Bank Information
-- is also the pane with the strongest case for its own grant the moment it holds
-- anything: an account and routing number want a narrower audience than dues
-- configuration, which its own placeholder text already says.
INSERT INTO public.permission_resources (key, label, category, subsection, sort_order, actions) VALUES
  ('admin/account/processing', 'Processing',       'admin', 'Accounting', 246, ARRAY['view','edit']::TEXT[]),
  ('admin/account/bank',       'Bank Information', 'admin', 'Accounting', 247, ARRAY['view','edit']::TEXT[])
ON CONFLICT (key) DO UPDATE
  SET label      = EXCLUDED.label,
      category   = EXCLUDED.category,
      subsection = EXCLUDED.subsection,
      sort_order = EXCLUDED.sort_order,
      actions    = EXCLUDED.actions;

-- Restricted per family, like every other admin row. 20260618000000 restricts the
-- admin category precisely so a new admin surface is not born world-readable, and
-- that has to be repeated per existing family or view falls through to 'any'.
--
-- Sourced from BOTH tables for 20260806000010 §2's reason: a family_code carried only
-- on people rows — which is what tests/rls seeds, and what any family predating the
-- `families` table has — is a real family and must not be missed.
INSERT INTO public.resource_visibility (family_code, resource_key, visibility)
SELECT f.code, pr.key, 'restricted'
  FROM (
    SELECT family_code AS code FROM public.families
    UNION
    SELECT DISTINCT family_code FROM public.people
     WHERE family_code IS NOT NULL AND family_code <> ''
  ) f
 CROSS JOIN public.permission_resources pr
 WHERE f.code IS NOT NULL AND f.code <> ''
   AND pr.key IN ('admin/account/processing', 'admin/account/bank')
ON CONFLICT (family_code, resource_key) DO NOTHING;

-- Carry the old shared grant onto both halves BEFORE dropping it, at every action
-- the new rows declare, so no administrator loses an affordance on deploy.
INSERT INTO public.template_permissions (template_id, resource_key, action, scope, updated_at)
SELECT tp.template_id, pr.key, tp.action, tp.scope, NOW()
  FROM public.template_permissions tp
 CROSS JOIN public.permission_resources pr
 WHERE tp.resource_key = 'admin/account/settings'
   AND pr.key IN ('admin/account/processing', 'admin/account/bank')
   AND tp.action::text = ANY(pr.actions)
ON CONFLICT (template_id, resource_key, action) DO NOTHING;

-- Safe to drop only because nothing else names it: it has no permission_table_map
-- row (the Settings panes are inert and write nothing) and no policy carries it as a
-- literal. Asserted rather than assumed — the same check 20260805000006 §3 owed.
DO $$
DECLARE v_refs int;
BEGIN
  SELECT COUNT(*) INTO v_refs FROM public.permission_table_map
   WHERE resource_key = 'admin/account/settings';
  IF v_refs > 0 THEN
    RAISE EXCEPTION 'ROLLBACK: % table(s) still mapped to admin/account/settings', v_refs;
  END IF;

  SELECT COUNT(*) INTO v_refs FROM pg_policies
   WHERE schemaname = 'public'
     AND (COALESCE(qual, '') LIKE '%admin/account/settings%'
       OR COALESCE(with_check, '') LIKE '%admin/account/settings%');
  IF v_refs > 0 THEN
    RAISE EXCEPTION 'ROLLBACK: % policy(ies) still name admin/account/settings', v_refs;
  END IF;
END $$;

-- ON DELETE CASCADE sweeps its template_permissions and resource_visibility rows.
-- They decide nothing now that both halves carry their own, and a row nobody can
-- reach is a row somebody will later misread.
DELETE FROM public.permission_resources WHERE key = 'admin/account/settings';

-- ── 4. Permission Templates leaves admin/users ──────────────────────────────
-- Members & Access renders three tabs. Two of them were one grant:
--
--   Members              who is in the family, what template each is on, and the
--                        switch that turns a member off        -> admin/users
--   Pending Approval     the join queue                        -> admin/approvals
--   Permission Templates the grids THIS row is on              -> admin/users, until now
--
-- Splitting the third out is the reverse of a merge 20260807000000 performed, so it
-- owes an argument rather than a symmetry. What that migration merged was
-- /admin/groups — a whole second SCREEN, existing because a member's access was the
-- union of N group policies over a per-person override grid and no single view could
-- state it. One template per member made the answer statable in one place, and the
-- second screen had nothing left to show.
--
-- That is not this. This is one screen with three tabs, and the question is which of
-- them a single grant should cover. "Add a member, put them on the Treasurer
-- template" and "decide what Treasurer means" are different jobs with different blast
-- radii: the first can only hand out authority that already exists, and the second
-- can invent it — including its own. A family wanting a roster administrator who
-- cannot quietly promote themselves could not express that, and now can.
--
-- ACTIONS: all four. Templates are created, renamed and deleted, and their cells are
-- edited; app/actions/admin/permissions.ts already checks a different one of the four
-- per mutation (requireAccessAdmin('create'|'edit'|'delete')).
--
-- sort_order 166 puts it after Pending Approval (165), matching the rail's own order:
-- Members -> Pending Approval -> Permission Templates.
INSERT INTO public.permission_resources (key, label, category, subsection, sort_order, actions)
VALUES ('admin/users/templates', 'Permission Templates', 'admin', 'Members & Access', 166,
        ARRAY['view','create','edit','delete']::TEXT[])
ON CONFLICT (key) DO UPDATE
  SET label      = EXCLUDED.label,
      category   = EXCLUDED.category,
      subsection = EXCLUDED.subsection,
      sort_order = EXCLUDED.sort_order,
      actions    = EXCLUDED.actions;

-- Pending Approval joins it under the same sub-heading. It is a tab of this page and
-- has been since 20260807000000 moved the queue here; leaving it at the top level put
-- one of the three tabs in a different part of the grid from the other two.
UPDATE public.permission_resources
   SET subsection = 'Members & Access'
 WHERE key = 'admin/approvals'
   AND subsection IS DISTINCT FROM 'Members & Access';

INSERT INTO public.resource_visibility (family_code, resource_key, visibility)
SELECT f.code, 'admin/users/templates', 'restricted'
  FROM (
    SELECT family_code AS code FROM public.families
    UNION
    SELECT DISTINCT family_code FROM public.people
     WHERE family_code IS NOT NULL AND family_code <> ''
  ) f
 WHERE f.code IS NOT NULL AND f.code <> ''
ON CONFLICT (family_code, resource_key) DO NOTHING;

-- Whoever can administer access today keeps being able to, at every action they hold.
-- A COPY, not a move: `admin/users` keeps its own grants because it still governs the
-- Members tab, the page gate, and the two RPCs that write to `people`.
--
-- This is the half that must not be skipped. Without it every existing template loses
-- the ability to edit a grid the moment §4b re-points the policies, and the screen
-- that could grant it back is the screen that just locked.
INSERT INTO public.template_permissions (template_id, resource_key, action, scope, updated_at)
SELECT tp.template_id, 'admin/users/templates', tp.action, tp.scope, NOW()
  FROM public.template_permissions tp
 WHERE tp.resource_key = 'admin/users'
ON CONFLICT (template_id, resource_key, action) DO NOTHING;

-- ── 4b. The policies on the two template tables follow the key ──────────────
-- Rebuilt longhand rather than text-patched, because these four are short and
-- reproducing them in full is what makes the `auth_membership_approved()` conjunct
-- visible. 20260806000011 §6 swept that onto both tables and 20260807000000 §6
-- reproduced it deliberately for the same reason: dropping and recreating without it
-- would quietly re-admit a pending applicant to the family's permission map.
--
-- Only the resource literal changes. SELECT stays open to the family — reading which
-- templates exist is what the Members tab's row menu needs to list them.
DROP POLICY IF EXISTS "templates managed by admins" ON public.permission_templates;
CREATE POLICY "templates managed by admins"
  ON public.permission_templates FOR ALL TO authenticated
  USING      (family_code = public.auth_family_code()
              AND public.auth_can('admin/users/templates', 'edit')
              AND public.auth_membership_approved())
  WITH CHECK (family_code = public.auth_family_code()
              AND public.auth_can('admin/users/templates', 'edit')
              AND public.auth_membership_approved());

DROP POLICY IF EXISTS "template permissions managed by admins" ON public.template_permissions;
CREATE POLICY "template permissions managed by admins"
  ON public.template_permissions FOR ALL TO authenticated
  USING (
    public.auth_can('admin/users/templates', 'edit')
    AND EXISTS (SELECT 1 FROM public.permission_templates t
                 WHERE t.id = template_id AND t.family_code = public.auth_family_code())
    AND public.auth_membership_approved()
  )
  WITH CHECK (
    public.auth_can('admin/users/templates', 'edit')
    AND EXISTS (SELECT 1 FROM public.permission_templates t
                 WHERE t.id = template_id AND t.family_code = public.auth_family_code())
    AND public.auth_membership_approved()
  );

-- resource_visibility is NOT re-pointed, deliberately. It is the per-family default
-- behind every resource including this one, so the grant that edits it is the grant
-- that administers access generally — `admin/users`. Moving it under the templates
-- key would let a roster administrator's own page-visibility switches stop working.

-- family_has_other_admin() is NOT re-pointed either. It answers "can anyone still
-- administer this family", and it is consulted by apply_permission_template() and
-- set_member_enabled() — both Members-tab operations gated on `admin/users:edit`.
-- The mirror invariant for the templates key has no database caller (every template
-- mutation runs on the service role) and lives in wouldLoseLastAdmin() in
-- app/actions/admin/permissions.ts, which now guards both keys.

-- ── 5. Captions, and the columns nothing reads ──────────────────────────────
-- Every label below is copied from the constant that renders the caption on screen,
-- named here so the two can be checked against each other:
--
--   components/transactions/ledgers.ts        LEDGER_LABELS
--   components/admin/account-sections.ts      SECTION_LABELS
--   components/admin/AdminAccessClient.tsx    the MainRail items
--
-- What is NOT renamed, and why:
--   dues                      'Dues Records'. It has no page and no rail item — it
--                             governs whose dues RECORDS a caller may see and
--                             administer (dues_payments SELECT, dues_member_plans).
--                             There is no caption to match, and "Dues" would collide
--                             with two rows that do have one.
--   transactions/reversals    'Payment Reversals'. Also not a rail item: reversing is
--                             a row action inside the dues ledger. Its confirmation
--                             reads "Reverse this payment", which does not make a
--                             resource name.
--   admin/users               'Members & Access'. It is the page AND the Members tab,
--                             and the page is what a family switches off.
UPDATE public.permission_resources AS pr
   SET label = v.label
  FROM (VALUES
    -- Transactions main rail
    ('transactions/dues-payments',      'Dues'),
    ('transactions/donation-payments',  'Donations'),
    ('transactions/fund-contributions', 'Contributions'),
    ('transactions/fund-disbursements', 'Disbursements'),
    -- Accounting second-level rail
    ('admin/account/dues',              'Dues'),
    ('admin/account/donations',         'Donations'),
    ('admin/account/routing',           'Routing'),
    -- Members & Access main rail
    ('admin/approvals',                 'Pending Approval')
  ) AS v(key, label)
 WHERE pr.key = v.key AND pr.label <> v.label;

-- The dead columns. Nothing in the app, in permission_table_map or in any policy
-- reads create, edit or delete on either of these — both pages are read-only surfaces
-- over records owned by other resources, and their write grants live on those
-- (transactions/* for the ledgers, dues for a member's own history). Six switches
-- that looked like controls and were consulted by nobody.
--
-- The stale template_permissions rows go with them: the grid on a template is the
-- whole answer to "what may these people do", so a row for an action the resource no
-- longer declares is a grant nothing reads — the same tidy-up 20260807000002 did when
-- fund_disbursements lost its delete.
UPDATE public.permission_resources
   SET actions = ARRAY['view']::TEXT[]
 WHERE key IN ('transactions', 'account-summary')
   AND actions <> ARRAY['view']::TEXT[];

DELETE FROM public.template_permissions tp
 USING public.permission_resources pr
 WHERE tp.resource_key = pr.key
   AND NOT (tp.action::text = ANY(pr.actions));

-- ── 6. Verify ───────────────────────────────────────────────────────────────
-- Unconditional. Everything asserted is schema or configuration, so none of it needs
-- a fixture and none of it can be skipped into a false pass — the failure mode
-- 20260806000012 shipped and AGENTS.md now warns about.
DO $$
DECLARE
  v_missing int;
  v_bad     int;
  v_label   text;
BEGIN
  -- 6a. Every resource this migration creates exists.
  SELECT COUNT(*) INTO v_missing
    FROM (VALUES
      ('account-summary/dues'), ('account-summary/donations'), ('account-summary/history'),
      ('admin/account/processing'), ('admin/account/bank'), ('admin/users/templates')
    ) AS k(key)
   WHERE NOT EXISTS (SELECT 1 FROM public.permission_resources r WHERE r.key = k.key);
  IF v_missing > 0 THEN
    RAISE EXCEPTION 'ROLLBACK: % new resource(s) missing', v_missing;
  END IF;

  IF EXISTS (SELECT 1 FROM public.permission_resources WHERE key = 'admin/account/settings') THEN
    RAISE EXCEPTION 'ROLLBACK: admin/account/settings survived the split';
  END IF;

  -- 6b. Every sub-resource has its PARENT registered.
  --
  -- This is the DB-checkable half of the prefix rule §1 describes. The other half —
  -- that the parent's feature is 'live' rather than 'future', or getResources() drops
  -- the child with no error — cannot be asserted here without copying lib/features.ts
  -- into SQL, where it would drift. What this does catch is the structural version:
  -- a sub-resource whose parent row is absent renders a sub-heading under nothing,
  -- and its key cannot resolve to a live prefix if the parent does not exist at all.
  --
  -- Parent = the key up to the last '/'. Top-level keys have no '/' and are skipped;
  -- `admin/users` is a top-level key whose parent would be the bare `admin`, so the
  -- depth test counts separators rather than looking for one.
  SELECT COUNT(*) INTO v_bad
    FROM public.permission_resources pr
   WHERE length(pr.key) - length(replace(pr.key, '/', '')) >= CASE WHEN pr.key LIKE 'admin/%' THEN 2 ELSE 1 END
     AND NOT EXISTS (
       SELECT 1 FROM public.permission_resources parent
        WHERE parent.key = left(pr.key, length(pr.key) - position('/' in reverse(pr.key)))
     );
  IF v_bad > 0 THEN
    RAISE EXCEPTION 'ROLLBACK: % sub-resource(s) have no parent resource row', v_bad;
  END IF;

  -- 6c. No resource carries a grant for an action it does not declare.
  SELECT COUNT(*) INTO v_bad
    FROM public.template_permissions tp
    JOIN public.permission_resources pr ON pr.key = tp.resource_key
   WHERE NOT (tp.action::text = ANY(pr.actions));
  IF v_bad > 0 THEN
    RAISE EXCEPTION 'ROLLBACK: % template grant(s) name an action their resource does not declare', v_bad;
  END IF;

  -- 6d. THE BACKFILL, which is the failure this migration could ship silently. A
  -- template that can edit access must have come out of §4 able to edit templates;
  -- otherwise the policies rewritten in §4b have locked every grid in the family.
  --
  -- EXISTENCE, not scope equality. On a re-run the row is already there and an
  -- administrator may since have narrowed it on purpose — setTemplatePermission()
  -- upserts a scope and never deletes a row, so the row surviving is the invariant
  -- and its value is the family's business.
  IF EXISTS (
    SELECT 1 FROM public.template_permissions tp
     WHERE tp.resource_key = 'admin/users' AND tp.action = 'edit' AND tp.scope <> 'none'
       AND NOT EXISTS (
         SELECT 1 FROM public.template_permissions n
          WHERE n.template_id = tp.template_id
            AND n.resource_key = 'admin/users/templates'
            AND n.action = 'edit')
  ) THEN
    RAISE EXCEPTION 'ROLLBACK: admin/users edit grants were not carried to admin/users/templates';
  END IF;

  -- And the same for the Accounting Settings split, whose source row is now deleted —
  -- so this can only be checked by its absence of a hole.
  IF EXISTS (
    SELECT 1 FROM public.permission_templates t
     WHERE EXISTS (SELECT 1 FROM public.template_permissions tp
                    WHERE tp.template_id = t.id AND tp.resource_key = 'admin/account/dues'
                      AND tp.action = 'edit' AND tp.scope = 'any')
       AND NOT EXISTS (SELECT 1 FROM public.template_permissions tp
                        WHERE tp.template_id = t.id AND tp.resource_key = 'admin/account/processing')
  ) THEN
    RAISE EXCEPTION 'ROLLBACK: an Accounting administrator has no Processing grant after the split';
  END IF;

  -- 6e. The captions. Asserted individually so a failure names the row.
  FOR v_label IN
    SELECT pr.key || ' = ' || pr.label
      FROM public.permission_resources pr
      JOIN (VALUES
        ('transactions/dues-payments',      'Dues'),
        ('transactions/donation-payments',  'Donations'),
        ('transactions/fund-contributions', 'Contributions'),
        ('transactions/fund-disbursements', 'Disbursements'),
        ('admin/account/dues',              'Dues'),
        ('admin/account/donations',         'Donations'),
        ('admin/account/routing',           'Routing'),
        ('admin/approvals',                 'Pending Approval')
      ) AS want(key, label) ON want.key = pr.key
     WHERE pr.label <> want.label
  LOOP
    RAISE EXCEPTION 'ROLLBACK: caption not applied — %', v_label;
  END LOOP;

  -- 6f. The two policies really do name the new key. A DROP that silently matched
  -- nothing, or a CREATE against a stale definition, would leave the split half-done
  -- and the Permission Templates grant deciding nothing.
  SELECT COUNT(*) INTO v_bad
    FROM pg_policies
   WHERE schemaname = 'public'
     AND tablename IN ('permission_templates', 'template_permissions')
     AND policyname IN ('templates managed by admins', 'template permissions managed by admins')
     AND COALESCE(qual, '') LIKE '%admin/users/templates%';
  IF v_bad <> 2 THEN
    RAISE EXCEPTION 'ROLLBACK: expected 2 policies naming admin/users/templates, found %', v_bad;
  END IF;
END $$;

COMMIT;
