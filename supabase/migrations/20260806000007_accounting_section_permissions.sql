-- ============================================================================
-- Admin > Accounting: a permission per section, not one for the whole page.
--
-- WHY
--   Every rail, every section and every new/edit/delete on the Accounting admin page
--   sat behind a single grant, `admin/account:edit`. So letting someone maintain the
--   dues schedule also let them redraw the routing split, create funds and set what a
--   milestone is worth — four different jobs behind one switch. Anyone trusted with
--   the smallest of them had to be trusted with all of them.
--
--   The page has four rails over six sections:
--     Income      -> Dues, Donations
--     Expenses    -> Funds, Routing
--     Milestones  -> Milestones
--     Settings    -> Processing, Bank Information
--
--   Each section becomes its own resource with its own actions. A rail disappears
--   when the caller can view none of its sections, so the nav follows the grants
--   without a second list to keep in step.
--
-- KEY PREFIX MATTERS
--   `admin/account/…`, not `accounting/…`. getResources() drops any row where
--   isFeatureFuture('/' + key) is true, and getFeature() longest-prefix-matches:
--   '/admin/account/dues' matches both '/admin' (future) and '/admin/account' (live),
--   and the longer wins — so these resolve live. A key under a prefix whose feature is
--   'future' would vanish from both admin grids with no error at all.
--
-- ACTIONS PER SECTION
--   Routing, Processing and Bank Information get view+edit only: routing is a single
--   allocation table that is adjusted rather than added to, and the two Settings panes
--   are inert placeholders with nothing to create or delete. The rest get the full
--   four. This is the `actions` column doing its job — a section with no create
--   renders no create column, instead of a switch wired to nothing.
--
--   Processing and Bank Information shared ONE key ('admin/account/settings') until
--   20260808000000, on the argument that neither was implemented. That is the rule
--   this file states, broken: they are two rail items, so they are two grants. Bank
--   Information is also the pane most likely to want a narrower audience than the rest
--   of Accounting the moment it holds an account number, which its own placeholder
--   text already says.
--
-- VISIBILITY DEFAULTS TO RESTRICTED
--   These are category='admin', and 20260618000000 restricts every admin row per
--   family precisely so a new admin surface is not born world-readable. That has to be
--   repeated here for the same reason, per existing family — otherwise view falls
--   through to 'any' and every member sees the family's dues configuration.
--
-- BACKFILL
--   Anyone who can administer Accounting today keeps every section. `admin/account`
--   itself stays as the page-level gate (requireView) and its edit grant is what is
--   copied forward, so no administrator loses an affordance on deploy.
--
-- IDEMPOTENT. Safe to re-run.
-- ============================================================================

BEGIN;

-- ── 1. The six sections ─────────────────────────────────────────────────────
--
-- THE LABELS ARE THE RAIL'S OWN, since 20260808000000: SECTION_LABELS in
-- components/admin/account-sections.ts is what the second-level rail prints, and this
-- grid said "Dues Schedules" where that rail says "Dues". Updated HERE as well as
-- there because this insert is ON CONFLICT DO UPDATE ... SET label = EXCLUDED.label.
--
-- SETTINGS BECAME TWO ROWS in the same migration. It was one key behind two rail
-- items — Processing and Bank Information — which the one-grant-per-rail-item rule
-- this file established for the other five does not allow. Split here as well as
-- there so a fresh database never creates the shared row at all; 20260808000000
-- carries the grants across and deletes it for databases that already have it.
INSERT INTO public.permission_resources (key, label, category, subsection, sort_order, actions) VALUES
  ('admin/account/dues',       'Dues',             'admin', 'Accounting', 241, ARRAY['view','create','edit','delete']::TEXT[]),
  ('admin/account/donations',  'Donations',        'admin', 'Accounting', 242, ARRAY['view','create','edit','delete']::TEXT[]),
  ('admin/account/funds',      'Funds',            'admin', 'Accounting', 243, ARRAY['view','create','edit','delete']::TEXT[]),
  ('admin/account/routing',    'Routing',          'admin', 'Accounting', 244, ARRAY['view','edit']::TEXT[]),
  ('admin/account/milestones', 'Milestones',       'admin', 'Accounting', 245, ARRAY['view','create','edit','delete']::TEXT[]),
  ('admin/account/processing', 'Processing',       'admin', 'Accounting', 246, ARRAY['view','edit']::TEXT[]),
  ('admin/account/bank',       'Bank Information', 'admin', 'Accounting', 247, ARRAY['view','edit']::TEXT[])
ON CONFLICT (key) DO UPDATE
  SET label      = EXCLUDED.label,
      category   = EXCLUDED.category,
      subsection = EXCLUDED.subsection,
      sort_order = EXCLUDED.sort_order,
      actions    = EXCLUDED.actions;

-- ── 2. Restricted by default, like every other admin row ────────────────────
INSERT INTO public.resource_visibility (family_code, resource_key, visibility)
SELECT DISTINCT p.family_code, pr.key, 'restricted'
  FROM public.people p
 CROSS JOIN public.permission_resources pr
 WHERE p.family_code IS NOT NULL AND p.family_code <> ''
   AND pr.key LIKE 'admin/account/%'
ON CONFLICT (family_code, resource_key) DO NOTHING;

-- ── 3. Carry today's Accounting administrators across ───────────────────────
-- Whoever holds admin/account edit gets every section, at every action that section
-- declares. unnest(actions) means Routing does not receive a meaningless create.
INSERT INTO public.group_permissions (group_id, resource_key, action, scope, updated_at)
SELECT gp.group_id, pr.key, a::public.permission_action, 'any'::public.permission_scope, NOW()
  FROM public.group_permissions gp
 CROSS JOIN public.permission_resources pr
 CROSS JOIN LATERAL unnest(pr.actions) AS a
 WHERE gp.resource_key = 'admin/account' AND gp.action = 'edit' AND gp.scope = 'any'
   AND pr.key LIKE 'admin/account/%'
ON CONFLICT (group_id, resource_key, action) DO NOTHING;

INSERT INTO public.person_permissions (person_id, resource_key, action, scope, updated_at)
SELECT pp.person_id, pr.key, a::public.permission_action, 'any'::public.permission_scope, NOW()
  FROM public.person_permissions pp
 CROSS JOIN public.permission_resources pr
 CROSS JOIN LATERAL unnest(pr.actions) AS a
 WHERE pp.resource_key = 'admin/account' AND pp.action = 'edit' AND pp.scope = 'any'
   AND pr.key LIKE 'admin/account/%'
ON CONFLICT (person_id, resource_key, action) DO NOTHING;

-- A group that can VIEW Accounting keeps being able to view each section, or the page
-- would open onto an empty rail.
INSERT INTO public.group_permissions (group_id, resource_key, action, scope, updated_at)
SELECT gp.group_id, pr.key, 'view'::public.permission_action, gp.scope, NOW()
  FROM public.group_permissions gp
 CROSS JOIN public.permission_resources pr
 WHERE gp.resource_key = 'admin/account' AND gp.action = 'view' AND gp.scope <> 'none'
   AND pr.key LIKE 'admin/account/%'
ON CONFLICT (group_id, resource_key, action) DO NOTHING;

-- ── 4. Verify ───────────────────────────────────────────────────────────────
DO $$
DECLARE v_missing int;
BEGIN
  SELECT COUNT(*) INTO v_missing
    FROM (VALUES ('admin/account/dues'), ('admin/account/donations'), ('admin/account/funds'),
                 ('admin/account/routing'), ('admin/account/milestones'),
                 ('admin/account/processing'), ('admin/account/bank')) AS k(key)
   WHERE NOT EXISTS (SELECT 1 FROM public.permission_resources r WHERE r.key = k.key);
  IF v_missing > 0 THEN
    RAISE EXCEPTION 'ROLLBACK: % accounting section resources missing', v_missing;
  END IF;

  -- The backfill is the failure mode the tests cannot see, for the same reason noted
  -- in 20260806000000: the RLS harness grants its Administrators every resource row.
  IF EXISTS (
    SELECT 1 FROM public.group_permissions gp
     WHERE gp.resource_key = 'admin/account' AND gp.action = 'edit' AND gp.scope = 'any'
       AND NOT EXISTS (
         SELECT 1 FROM public.group_permissions n
          WHERE n.group_id = gp.group_id AND n.resource_key = 'admin/account/dues' AND n.action = 'edit')
  ) THEN
    RAISE EXCEPTION 'ROLLBACK: admin/account edit grants were not carried to the sections';
  END IF;
END $$;

COMMIT;
