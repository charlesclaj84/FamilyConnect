-- ============================================================================
-- The Family Tree becomes a permission resource a family can actually restrict.
--
-- ── WHAT THIS CLOSES ────────────────────────────────────────────────────────
-- `20260806000006` deleted five keys from `permission_resources` — `dashboard`,
-- `personal-info`, `my-families`, `direct-lineage`, `family-tree` — on the
-- argument that "a member's own things are not something a family administers".
-- That was right for four of them and right for the fifth AT THE TIME, because
-- `family-tree` then meant a per-member pedigree view of the caller's own line.
--
-- It stopped being true on 2026-08-13. `/family-tree` is now a family-wide
-- canvas: it reads every `people` row in the family and every relationship
-- between them, and any approved member may WRITE those columns for anybody who
-- has no account (`editPersonRecord`). An unregistered non-admin key resolves to
-- view `'any'` for every approved member and cannot be switched off, so a family
-- that had restricted its Directory had not thereby restricted this. TODO.md has
-- carried the decision since; this is it, made.
--
-- ── WHY THE `20260618000000` SEED IS DELIBERATELY *NOT* EDITED ──────────────
-- AGENTS.md §6 says to add a new resource "in a new migration *and* in the seed",
-- and doing that here would BREAK the thing that rule exists to protect. This is
-- the one case in the chain where the two halves disagree, so it is argued at
-- length rather than left for the next reader to discover.
--
-- `20260618000001` seeds `permission_table_map` from a VALUES list that names
-- THREE tables against this key:
--
--     ('person_relationships', 'family-tree', 'person_id = auth_person_id()', 'false')
--     ('family_ancestors',     'family-tree', 'user_id = auth.uid()', 'user_id = auth.uid()')
--     ('relationship_types',   'family-tree', 'false', 'false')
--
-- `resource_key` is a FOREIGN KEY into `permission_resources`, and that insert is
-- written as a `SELECT … WHERE EXISTS`, so on every database built from this chain
-- those three rows are SKIPPED — the key does not exist at that point, because
-- 20260806000006 removed it from the seed as well as deleting it. The three tables
-- are therefore unmapped and keep their base policies, and that is the state
-- hosted is in today.
--
-- Put `family-tree` back in the `20260618000000` seed and that stops being true on
-- a FRESH database only:
--
--   20260618000000  seeds the key  ────────────────┐  (hosted: already applied,
--   20260618000001  the FK now resolves            │   never runs again, so the
--                   → three map rows INSERT        │   map stays empty and no
--                   → the sweep COMPOSES policies  │   policy is composed)
--                     on person_relationships and  │
--                     relationship_types           │
--   20260806000006  DELETEs the key → ON DELETE CASCADE takes the map rows away
--                   again — but the COMPOSED POLICIES REMAIN.
--
-- So a laptop would run the RLS suite against `perm:` policies that production
-- does not have, which is the exact failure §7 is most explicit about. And the
-- sharpest of the three is `relationship_types`: its `own_expr` is `'false'`, so a
-- composed policy demands `auth_permission('family-tree','view') = 'any'` — and a
-- family that used the switch this migration adds would get "That relationship
-- type is not set up" on every addition, which is the symptom AGENTS.md already
-- records from the weeks that table sat empty.
--
-- THIS MIGRATION THEREFORE RUNS AT THE END OF THE CHAIN AND NOWHERE ELSE, so a
-- fresh database and hosted end up identical — which is what §6's seed rule is
-- FOR. The two guards that make skipping the seed safe:
--
--   * `20260618000000`'s insert is `ON CONFLICT DO UPDATE`, but only over the keys
--     in its own VALUES list. `family-tree` is not one, so a replay cannot revert
--     the row this migration adds.
--   * `20260806000006`'s DELETE runs long BEFORE this file, so it cannot delete it
--     either.
--
-- §5 asserts the absence of the map rows, in both directions, so that a later
-- migration cannot quietly reintroduce the coupling this paragraph exists to
-- prevent.
--
-- ── WHAT THE KEY GOVERNS: A SCREEN AND ITS WRITES, NOT A TABLE ──────────────
-- No policy in the database evaluates `family-tree` and none may start to (see
-- above). Enforcement is app-layer, and both halves are real:
--
--   view  `requireView(user.id, 'family-tree')` on the page, and `requireRead`
--         inside `getFamilyTree()` — which was already written that way, so the
--         view grant becomes live the moment this row exists.
--   edit  the six write actions in `app/actions/family-tree.ts` now demand
--         `canAny(…, 'family-tree', 'edit')` on top of `requireMember()`.
--
-- `canAny` and not `can`, per AGENTS.md §2: there is no coherent "own" version of
-- a tree edit. `editPersonRecord` refuses any row that HAS a `user_id`, so the
-- rows this key governs are precisely the ones nobody owns, and the relationship
-- edges are facts about two people rather than about one. `family-tree` is added
-- to `NO_OWNER_KEYS` in `components/admin/resource-groups.ts` in the same commit,
-- so the grid stops offering an Own button the server would read as a denial.
--
-- TWO ACTIONS AND NOT FOUR. §6 says never declare an action nothing reads.
-- `create` and `delete` are deliberately absent: adding a relative and detaching
-- a connection are both offered by the canvas's one Edit mode and both gate on
-- `edit`, so a create or delete switch here would be a control nothing consults.
-- The day the canvas separates them, they are one `actions` narrowing away.
--
-- ── IT PRESERVES THE STATUS QUO EXACTLY, WHICH IS WHY EVERY TEMPLATE GETS
--    EDIT ────────────────────────────────────────────────────────────────────
-- Since 20260807000000 a template's grid is MATERIALIZED, and `edit` defaults to
-- `'none'`. Registering this key without a backfill would therefore make the tree
-- READ-ONLY for the entire family including its founder, with no error anywhere —
-- the page keeps working and only the writing stops. TODO.md names this as the
-- trap that costs most, and §3 below is the answer to it.
--
-- Every template gets view `'any'` and edit `'any'`, system and custom alike,
-- because that is what every approved member can do TODAY. This is the same
-- reasoning `20260819000002` §C used when it promoted every existing staff row to
-- `owner`: promoting looks generous and is actually conservative — while the key
-- governed nothing, everybody already had it, so granting it changes nothing about
-- what anyone can do and leaving it out would be a silent demotion of the whole
-- estate. What the family GAINS is a switch that now exists.
--
-- ── AND NEW FAMILIES, WHICH IS THE HALF A BACKFILL CANNOT REACH ─────────────
-- §4 redefines `seed_family_permission_templates()` to add one row to its General
-- VALUES list. Without it every family created after this migration would get
-- `family-tree` view `'any'` (the function derives that for any non-restricted,
-- non-admin key) and edit `'none'` — a brand-new family with a read-only tree and
-- nobody able to build it, which is the failure above with a longer fuse.
--
-- `tier` is not this file's business and there is nothing to do: `/family-tree` is
-- `tier: 'free'` in `lib/features.ts` and stays so. No policy consults
-- `families.tier` and none may start to.
-- ============================================================================

-- ── 1. The resource ─────────────────────────────────────────────────────────
-- `community`, beside Directory, because that is where the rail puts it and
-- because the grid's captions come from the screen (AGENTS.md). Directory is 70
-- and Events is 80, so 75 lands it directly beneath the roster it belongs with.
--
-- ON CONFLICT DO UPDATE so a re-run is a no-op rather than a 23505, and so the
-- label tracks the screen if it is ever recaptioned here.
INSERT INTO public.permission_resources (key, label, category, subsection, sort_order, actions)
VALUES ('family-tree', 'Family Tree', 'community', NULL, 75, ARRAY['view', 'edit'])
ON CONFLICT (key) DO UPDATE
  SET label      = EXCLUDED.label,
      category   = EXCLUDED.category,
      subsection = EXCLUDED.subsection,
      sort_order = EXCLUDED.sort_order,
      actions    = EXCLUDED.actions;

-- ── 2. NO `resource_visibility` ROW, and that is a decision ─────────────────
-- Absence means `'everyone'` for view on a non-admin key, which is what the tree
-- should default to: it is the family's own record of itself and every member has
-- always been able to open it. Writing `'restricted'` here would take a working
-- screen away from every family in the estate on the morning this deploys, and
-- §6's argument for backfilling `'restricted'` is about keys that withhold other
-- members' MONEY (`dues-projections`, `gatherings/budget`) rather than about every
-- new key.
--
-- The row an administrator moves is the TEMPLATE row, which §3 writes explicitly
-- for every template — so the grid shows the whole answer with no fall-through,
-- which is what 20260807000000 made the grid promise.

-- ── 3. Backfill every template that already exists ─────────────────────────
-- Both actions, `'any'`, every template in the estate. See the header: this is
-- status-quo preservation, not generosity.
INSERT INTO public.template_permissions (template_id, resource_key, action, scope)
SELECT t.id, 'family-tree', a::public.permission_action, 'any'::public.permission_scope
  FROM public.permission_templates t
 CROSS JOIN LATERAL unnest(ARRAY['view', 'edit']) AS a
ON CONFLICT (template_id, resource_key, action) DO NOTHING;

-- ── 4. New families get it too ─────────────────────────────────────────────
-- Redefined from the 20260819000000 version, with ONE row added to the General
-- VALUES list. Everything else is verbatim, deliberately: this function has been
-- replaced three times (20260807000000, 20260817000000, 20260819000000) and each
-- version restates the whole body, because `CREATE OR REPLACE` has no other shape.
-- Diff it against 20260819000000 before changing anything here.
--
-- Administrators needs no line: it already takes `'any'` on every action each
-- resource declares, derived from `permission_resources`, so §1 is enough for it.
CREATE OR REPLACE FUNCTION public.seed_family_permission_templates(p_family_code text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_admins  uuid;
  v_general uuid;
  v_claims  jsonb := NULLIF(current_setting('request.jwt.claims', true), '')::jsonb;
  v_jwt     text  := COALESCE(v_claims ->> 'role', '');
  v_guc     text  := COALESCE(NULLIF(current_setting('role', true), 'none'), '');
  -- Non-admin resources that still start restricted. Everything family-wide about other
  -- members' money belongs here; a page of the family's own records does not — which is
  -- exactly why `family-tree` is NOT on this list, however family-wide the canvas is.
  v_restricted text[] := ARRAY['dues-projections', 'gatherings/budget'];
BEGIN
  IF p_family_code IS NULL OR p_family_code = '' THEN
    RETURN;
  END IF;

  -- Gate 1: not callable from a browser, except by arriving through the trigger.
  IF pg_trigger_depth() = 0
     AND (v_jwt IN ('anon', 'authenticated') OR v_guc IN ('anon', 'authenticated'))
  THEN
    RAISE EXCEPTION
      'seed_family_permission_templates() is not callable by % — templates are seeded by the families trigger',
      COALESCE(NULLIF(v_jwt, ''), v_guc)
      USING ERRCODE = 'insufficient_privilege';
  END IF;

  -- Gate 2: the write amplification. permission_templates.family_code has no foreign
  -- key, so without this any string is a valid target for a few hundred rows.
  IF NOT EXISTS (SELECT 1 FROM public.families f WHERE f.family_code = p_family_code)
     AND NOT EXISTS (SELECT 1 FROM public.people p WHERE p.family_code = p_family_code)
  THEN
    RAISE EXCEPTION 'seed_family_permission_templates(): no such family %', p_family_code
      USING ERRCODE = 'foreign_key_violation';
  END IF;

  INSERT INTO public.permission_templates (family_code, name, description, is_system) VALUES
    (p_family_code, 'Administrators',
     'Full access to every page and action, including who else may do what.', true),
    (p_family_code, 'General',
     'Everyone else. Reads the family, manages only their own records.', true)
  ON CONFLICT (family_code, name) DO NOTHING;

  SELECT id INTO v_admins  FROM public.permission_templates
   WHERE family_code = p_family_code AND name = 'Administrators';
  SELECT id INTO v_general FROM public.permission_templates
   WHERE family_code = p_family_code AND name = 'General';

  -- Admin pages start restricted, and so does anything in v_restricted. This is what
  -- makes the General grid below deny them, and it stays the default for any resource a
  -- later migration adds.
  INSERT INTO public.resource_visibility (family_code, resource_key, visibility)
  SELECT p_family_code, pr.key, 'restricted'
    FROM public.permission_resources pr
   WHERE pr.category = 'admin' OR pr.key = ANY(v_restricted)
  ON CONFLICT (family_code, resource_key) DO NOTHING;

  -- Administrators: 'any' on every action each resource actually declares.
  INSERT INTO public.template_permissions (template_id, resource_key, action, scope)
  SELECT v_admins, pr.key, a::public.permission_action, 'any'
    FROM public.permission_resources pr
   CROSS JOIN LATERAL unnest(pr.actions) AS a
  ON CONFLICT (template_id, resource_key, action) DO NOTHING;

  -- General: the family-facing pages, and only their own records. Stated for every
  -- resource and action rather than left to fall through, because the grid on the
  -- screen is now the whole answer and a blank cell would be a lie.
  --
  -- The EXISTS guard on the literal list is load-bearing: resource_key is a foreign
  -- key, so naming one a later migration renamed would abort the INSERT and — through
  -- the trigger — the family creation that called it.
  --
  -- `family-tree` / `edit` IS THE ROW 20260819000008 ADDED, and it is the only
  -- difference between this body and the 20260819000000 one. It is `'any'` and not
  -- `'own'` because there is no own version of a tree edit — the rows the canvas may
  -- change are precisely the ones nobody has claimed — and because a tree is built
  -- collaboratively, which is the whole argument `editPersonRecord` is written on. A
  -- family that disagrees now has a switch; before this migration it had none.
  INSERT INTO public.template_permissions (template_id, resource_key, action, scope)
  SELECT v_general, t.k, t.act, t.sc
    FROM (VALUES
      ('account-summary', 'view'::public.permission_action, 'own'::public.permission_scope),
      ('chat',            'create', 'any'),
      ('chat',            'edit',   'own'),
      ('chat',            'delete', 'own'),
      ('family-tree',     'edit',   'any'),
      ('photos',          'create', 'any'),
      ('photos',          'edit',   'own')
    ) AS t(k, act, sc)
   WHERE EXISTS (SELECT 1 FROM public.permission_resources pr WHERE pr.key = t.k)
  ON CONFLICT (template_id, resource_key, action) DO NOTHING;

  -- The view default asks what the family has restricted rather than re-deriving it from the
  -- category (20260817000000 §3b). Same answer for every key that existed before, and 'none'
  -- for the ones named in v_restricted.
  INSERT INTO public.template_permissions (template_id, resource_key, action, scope)
  SELECT v_general, pr.key, a::public.permission_action,
         CASE
           WHEN a = 'view' AND NOT EXISTS (
                  SELECT 1 FROM public.resource_visibility rv
                   WHERE rv.family_code = p_family_code
                     AND rv.resource_key = pr.key
                     AND rv.visibility = 'restricted')
             THEN 'any'::public.permission_scope
           ELSE 'none'::public.permission_scope
         END
    FROM public.permission_resources pr
   CROSS JOIN LATERAL unnest(pr.actions) AS a
  ON CONFLICT (template_id, resource_key, action) DO NOTHING;
END $$;

-- The grant is restated because CREATE OR REPLACE does not change privileges and this must
-- stay unreachable from a browser — 20260806000015 made grants the primary control, and
-- `service_role` keeps EXECUTE by default.
REVOKE ALL ON FUNCTION public.seed_family_permission_templates(text) FROM PUBLIC, anon, authenticated;

-- ── 5. Verify, unconditionally ─────────────────────────────────────────────
-- Catalogue and grid reads only, so no fixture is needed and this cannot be one of
-- the verify blocks AGENTS.md warns about — the kind that skips quietly and reports
-- success over something that never ran.
DO $mig$
DECLARE
  v_actions text[];
  v_missing int;
  v_mapped  int;
  v_policies int;
BEGIN
  -- 5a. The resource is registered, with exactly the two actions something reads.
  SELECT actions INTO v_actions
    FROM public.permission_resources WHERE key = 'family-tree';
  IF v_actions IS NULL THEN
    RAISE EXCEPTION 'ROLLBACK: family-tree is not registered in permission_resources';
  END IF;
  IF NOT (v_actions @> ARRAY['view', 'edit'] AND v_actions <@ ARRAY['view', 'edit']) THEN
    RAISE EXCEPTION
      'ROLLBACK: family-tree declares %, expected exactly {view,edit}. §6: never declare '
      'an action nothing reads — and never withhold one the app resolves.', v_actions;
  END IF;

  -- 5b. NO TEMPLATE IS LEFT WITHOUT BOTH GRANTS. This is the assertion that stands
  -- between this migration and a whole estate of read-only family trees, which is the
  -- failure mode with no error message anywhere: the page keeps rendering and only the
  -- writing stops.
  SELECT count(*) INTO v_missing
    FROM public.permission_templates t
   CROSS JOIN LATERAL unnest(ARRAY['view', 'edit']) AS a
   WHERE NOT EXISTS (
     SELECT 1 FROM public.template_permissions tp
      WHERE tp.template_id = t.id
        AND tp.resource_key = 'family-tree'
        AND tp.action = a::public.permission_action);
  IF v_missing > 0 THEN
    RAISE EXCEPTION
      'ROLLBACK: % template/action pair(s) have no family-tree grant. Every existing '
      'template must carry both, or the tree goes read-only for families that could '
      'edit it yesterday.', v_missing;
  END IF;

  -- 5c. THE COUPLING THIS MIGRATION EXISTS TO AVOID, asserted so a later one cannot
  -- reintroduce it by accident. A `permission_table_map` row keyed `family-tree` would
  -- make the next composing sweep put an `auth_permission('family-tree', …)` factor on
  -- `person_relationships` and — worse — on `relationship_types`, whose `own_expr` is
  -- 'false'. See the header for why that diverges a laptop from production.
  SELECT count(*) INTO v_mapped
    FROM public.permission_table_map WHERE resource_key = 'family-tree';
  IF v_mapped > 0 THEN
    RAISE EXCEPTION
      'ROLLBACK: % permission_table_map row(s) name family-tree. This key gates a SCREEN '
      'and its writes, never a table — see this migration''s header. If a row is genuinely '
      'wanted, the composed policies and the app gate have to be decided together, and the '
      '20260618000000 seed question has to be answered first.', v_mapped;
  END IF;

  -- 5d. And no policy evaluates it today, which is the same fact from the other side.
  -- Read from pg_policies rather than inferred from 5c, because the two can disagree:
  -- 20260806000006 removed the map rows by CASCADE and would have left any composed
  -- policy standing.
  SELECT count(*) INTO v_policies
    FROM pg_policies
   WHERE schemaname = 'public'
     AND (COALESCE(qual, '') LIKE '%family-tree%' OR COALESCE(with_check, '') LIKE '%family-tree%');
  IF v_policies > 0 THEN
    RAISE EXCEPTION
      'ROLLBACK: % policy/policies evaluate family-tree. Enforcement for this key is '
      'app-layer by design; a composed policy here means this database has the map rows '
      'a fresh chain skips, and the RLS suite would be testing something production has '
      'not got.', v_policies;
  END IF;

  RAISE NOTICE
    'family-tree registered: view+edit, every template granted both, no table mapped, '
    'no policy evaluating it. The switch exists and nothing changed about who can do what.';
END $mig$;
