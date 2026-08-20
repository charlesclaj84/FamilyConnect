-- ============================================================================
-- The route tree is the nav rail: 42 permission keys move with their routes.
--
-- ── THE RULE THIS IMPLEMENTS ────────────────────────────────────────────────
-- A screen lives at `/<rail section>/<its rail caption>`, and because a resource key IS
-- the route without its leading slash (AGENTS.md §1), the key moves with it. So
-- Reporting > P&L Summary is `/reporting/pl-summary` and the key `reporting/pl-summary`;
-- Admin > Members is `/admin/members`. AGENTS.md, "The route tree is the nav rail", has
-- the whole rule and the four stated exceptions.
--
-- ── WHY 42 RENAMES ARE ADMISSIBLE AT ALL ────────────────────────────────────
-- Every previous key rename in this chain was argued against on the same ground, and the
-- argument was right at the time: "that string is in permission_table_map, in the composed
-- policies and in every grant already issued, so renaming it would orphan them all to
-- retitle a heading" (20260618000004, 20260805000004, and `admin/family` in
-- 20260812000001, which kept its key precisely to avoid this).
--
-- What has changed is not the cost of the rename but who pays it: NO FAMILY IS USING THIS
-- PRODUCT YET. There are no grants in production to carry, no bookmarks to break and no
-- administrator to re-teach. That is the same fact that licensed dropping thirteen
-- `event_*` tables (20260819000006) and re-cutting the tier boundary (20260819000009), and
-- it is a window that closes the day the first family signs up. Doing this afterwards would
-- mean a migration per key and a redirect per route, kept forever.
--
-- ── WHAT REFERENCES A KEY, AND ALL SIX ARE HANDLED HERE ─────────────────────
-- The list is 20260805000006's, which renamed exactly one key and is the template for this:
--
--   1. permission_resources.key                — the row itself                        §2
--   2. template_permissions.resource_key       — FK, every grant on every template      §3
--   3. resource_visibility.resource_key        — FK, the per-family show/hide           §3
--   4. permission_table_map.resource_key       — FK, which table each key gates         §4
--   5. THE POLICY EXPRESSIONS. The one that is easy to miss: 20260618000001's
--      `_perm_predicate()` interpolates the key as a LITERAL with %L, so 94 composed
--      policies each carry a hard-coded `auth_permission('admin/account'::text, …)` inside
--      their USING / WITH CHECK. Updating the map does NOT retroactively change them — the
--      map is only read when the sweep runs. Left alone, every one of them would ask about
--      a key that no longer exists, `auth_permission` would fall through to its default,
--      and the tables would go world-readable while every write failed closed.           §5
--   6. `seed_family_permission_templates()`, which names keys in its body.              §7
--   7. EVERY OTHER FUNCTION that gates itself with `auth_permission('<key>', …)` or
--      `auth_can('<key>', …)` — six of them, including `set_membership_status()`.     §7b
--
-- None of the FKs is ON UPDATE CASCADE, so a key cannot be UPDATEd in place: dependents are
-- copied to the new key and the old rows dropped.
--
-- ── ONE KEY CHANGES CATEGORY, AND IT IS THE ONLY INTERESTING CASE ───────────
-- `admin/elections` becomes `review/election-management`, so it LOSES THE `admin/` PREFIX —
-- and 20260817000004 asserts that `(category = 'admin') IS DISTINCT FROM (key LIKE
-- 'admin/%')` finds nothing, in both directions, because that equivalence is what licenses
-- its prefix test for failing closed. So the category moves to `resources` with the key.
--
-- THAT WOULD SILENTLY UNLOCK THE SCREEN, since an admin key resolves `view` to 'none' where
-- a family has no visibility row and a non-admin key resolves to 'everyone'. §7 therefore
-- writes the restriction down EXPLICITLY — a `resource_visibility` row per family, and the
-- key added to `v_restricted` in the seeder for families created later — so the posture is
-- preserved by a stated fact rather than by an accident of spelling. It goes back to
-- `admin/elections` with category `admin` the day it leaves the Review section.
--
-- IDEMPOTENT. Every insert is ON CONFLICT, every delete is guarded by the copy above it, and
-- the policy rewrite matches on the old literal, which is absent after pass one.
--
-- HOW THIS REACHES A DATABASE
--   `supabase db push`, from CI on merge to master — never `psql -f` by hand, which
--   records nothing and can replay this file out of order. See AGENTS.md, "How
--   migrations reach the hosted project".
-- ============================================================================

BEGIN;

-- ── 1. The mapping, once ────────────────────────────────────────────────────
-- Every section below reads this table and nothing else, so there is exactly one place a
-- pair can be wrong. Dropped at the end of the transaction.
CREATE TEMP TABLE key_moves (old_key text PRIMARY KEY, new_key text NOT NULL) ON COMMIT DROP;

INSERT INTO key_moves (old_key, new_key) VALUES
  -- Accounting
  ('account-summary',                 'accounting/summary'),
  ('account-summary/funds',           'accounting/summary/funds'),
  ('dues',                            'accounting/dues'),
  ('donations',                       'accounting/donations'),
  -- Reporting
  ('membership-report',               'reporting/membership'),
  ('payment-history',                 'reporting/payment-history'),
  ('transactions',                    'reporting/transactions'),
  ('transactions/dues-payments',      'reporting/transactions/dues-payments'),
  ('transactions/donation-payments',  'reporting/transactions/donation-payments'),
  ('transactions/fund-contributions', 'reporting/transactions/fund-contributions'),
  ('transactions/fund-disbursements', 'reporting/transactions/fund-disbursements'),
  ('transactions/fund-transfers',     'reporting/transactions/fund-transfers'),
  ('transactions/reversals',          'reporting/transactions/reversals'),
  ('dues-projections',                'reporting/dues-projections'),
  ('family-finances',                 'reporting/pl-summary'),
  -- Admin
  ('admin/users',                     'admin/members'),
  ('admin/users/templates',           'admin/members/templates'),
  ('admin/approvals',                 'admin/members/approvals'),
  ('admin/chapters',                  'admin/members/organization'),
  ('admin/boardpositions',            'admin/members/board-positions'),
  ('admin/account',                   'admin/accounting'),
  ('admin/account/dues',              'admin/accounting/dues'),
  ('admin/account/donations',         'admin/accounting/donations'),
  ('admin/account/funds',             'admin/accounting/funds'),
  ('admin/account/routing',           'admin/accounting/routing'),
  ('admin/account/milestones',        'admin/accounting/milestones'),
  ('admin/account/processing',        'admin/accounting/processing'),
  ('admin/account/bank',              'admin/accounting/bank'),
  ('admin/gathering-templates',       'admin/gatherings/templates'),
  ('admin/family',                    'admin/settings'),
  ('admin/family/remove',             'admin/settings/remove'),
  -- Community
  ('chat',                            'community/chat'),
  ('announcements',                   'community/announcements'),
  ('announcements/birthdays',         'community/announcements/birthdays'),
  ('updates',                         'community/updates'),
  ('members',                         'community/directory'),
  ('family-tree',                     'community/family-tree'),
  -- Gatherings
  ('calendar',                        'gatherings/calendar'),
  -- Review
  ('photos',                          'review/photos'),
  ('documents',                       'review/documents'),
  ('elections',                       'review/elections'),
  ('admin/elections',                 'review/election-management');

-- ── 2. The new resource rows ────────────────────────────────────────────────
-- Label, category, subsection, sort_order and actions all copied from the row being
-- replaced, so the permission grid renders each one in exactly the same place under exactly
-- the same caption. The ONE exception is the category of the key leaving `admin/` — see the
-- header, and §7, which is what stops that being a silent unlock.
INSERT INTO public.permission_resources (key, label, category, subsection, sort_order, actions)
SELECT m.new_key,
       pr.label,
       CASE WHEN m.new_key NOT LIKE 'admin/%' AND pr.category = 'admin'
            THEN 'resources' ELSE pr.category END,
       pr.subsection,
       pr.sort_order,
       pr.actions
  FROM key_moves m
  JOIN public.permission_resources pr ON pr.key = m.old_key
ON CONFLICT (key) DO UPDATE
  SET label      = EXCLUDED.label,
      category   = EXCLUDED.category,
      subsection = EXCLUDED.subsection,
      sort_order = EXCLUDED.sort_order,
      actions    = EXCLUDED.actions;

-- ── 3. Carry every grant and every visibility row across ────────────────────
-- Copy-then-delete rather than UPDATE: the FKs are ON DELETE CASCADE and not
-- ON UPDATE CASCADE, so an in-place key change is rejected.
INSERT INTO public.template_permissions (template_id, resource_key, action, scope, updated_at)
SELECT tp.template_id, m.new_key, tp.action, tp.scope, tp.updated_at
  FROM public.template_permissions tp
  JOIN key_moves m ON m.old_key = tp.resource_key
ON CONFLICT (template_id, resource_key, action) DO NOTHING;

INSERT INTO public.resource_visibility (family_code, resource_key, visibility, updated_at)
SELECT rv.family_code, m.new_key, rv.visibility, rv.updated_at
  FROM public.resource_visibility rv
  JOIN key_moves m ON m.old_key = rv.resource_key
ON CONFLICT (family_code, resource_key) DO NOTHING;

-- ── 4. Which table each key gates ───────────────────────────────────────────
-- `permission_table_map` is keyed on table_name, so these move in place.
UPDATE public.permission_table_map ptm
   SET resource_key = m.new_key
  FROM key_moves m
 WHERE ptm.resource_key = m.old_key;

-- ── 5. Rewrite the policies that carry a key as a literal ───────────────────
-- The half that updating the map does NOT do. `_perm_predicate()` renders the key with %L,
-- so each policy holds `auth_permission('old-key'::text, …)` as text; this replaces the
-- WHOLE literal including its quotes, which is what makes the pass immune to prefix bleed —
-- `'admin/account'::text` and `'admin/account/dues'::text` are different strings, so the
-- order the pairs are applied in cannot matter.
--
-- Each policy is dropped and recreated under the same name, command and roles, with only the
-- resource literal changed — exactly as 20260618000001 did when it wrapped them, and as
-- 20260805000006 did for the one key it moved. NULL qual / with_check are meaningful (the
-- clause is simply absent), so each command is rebuilt with only the clauses it had.
DO $$
DECLARE
  p       record;
  m       record;
  v_roles text;
  v_qual  text;
  v_check text;
  v_count int := 0;
BEGIN
  FOR p IN
    SELECT tablename, policyname, cmd, qual, with_check, roles
      FROM pg_policies
     WHERE schemaname = 'public'
       AND EXISTS (
             SELECT 1 FROM key_moves k
              WHERE COALESCE(pg_policies.qual, '') LIKE '%''' || k.old_key || '''%'
                 OR COALESCE(pg_policies.with_check, '') LIKE '%''' || k.old_key || '''%')
  LOOP
    v_qual  := p.qual;
    v_check := p.with_check;
    FOR m IN SELECT old_key, new_key FROM key_moves LOOP
      v_qual  := replace(v_qual,  '''' || m.old_key || '''::text', '''' || m.new_key || '''::text');
      v_check := replace(v_check, '''' || m.old_key || '''::text', '''' || m.new_key || '''::text');
    END LOOP;

    v_roles := array_to_string(p.roles, ', ');
    EXECUTE format('DROP POLICY %I ON public.%I', p.policyname, p.tablename);

    -- BUILT FROM THE CLAUSES THE POLICY ACTUALLY HAD, never from a fixed template. Two
    -- things make that necessary and both were found by this migration failing:
    --   * `FOR ALL` is a real command and `resource_visibility`'s admin policy uses it. A
    --     four-branch IF over SELECT/INSERT/UPDATE/DELETE raises on it, which is the right
    --     failure — silently skipping the policy would leave it asking about a dead key.
    --   * A NULL `qual` or `with_check` is MEANINGFUL: the clause is simply absent. An
    --     INSERT policy has no `qual` and a SELECT policy no `with_check`, so each clause is
    --     appended only when it exists. It is a CASE and NOT a COALESCE, because
    --     `format(' USING (%s)', NULL)` returns the STRING ' USING ()' rather than NULL —
    --     `%s` renders a NULL argument as empty — so a COALESCE would never fire and every
    --     policy of three of the five commands would be recreated with a syntax error.
    EXECUTE format('CREATE POLICY %I ON public.%I FOR %s TO %s', p.policyname, p.tablename,
                   p.cmd, v_roles)
            || CASE WHEN v_qual  IS NOT NULL THEN format(' USING (%s)', v_qual)      ELSE '' END
            || CASE WHEN v_check IS NOT NULL THEN format(' WITH CHECK (%s)', v_check) ELSE '' END;

    v_count := v_count + 1;
  END LOOP;
  RAISE NOTICE 'rewrote % policy/policies onto the new keys', v_count;
END $$;

-- ── 6. Drop the old resource rows ───────────────────────────────────────────
-- Safe now: §3 copied every dependent across, so the ON DELETE CASCADE only sweeps up the
-- old-key duplicates it left behind.
DELETE FROM public.permission_resources pr
 USING key_moves m
 WHERE pr.key = m.old_key;

-- ── 7. The seeder names keys in its body, so it is rewritten whole ──────────
-- `seed_family_permission_templates()` (20260807000000, redefined by 20260817000000,
-- 20260819000000, 20260819000008 and 20260820000003) hard-codes seven keys: the General
-- template's starting grants and the `v_restricted` list. All seven move here.
--
-- CREATE OR REPLACE TAKES A WHOLE BODY, so this is copied from 20260820000003 — the NEWEST
-- definition, found with `grep -l 'FUNCTION public.seed_family_permission_templates'
-- supabase/migrations/*.sql` — and not from an older one. That mistake was made the day
-- before this and cost the family tree's edit grant; §9 asserts against it happening again.
--
-- `review/election-management` JOINS `v_restricted`, and that is the whole of what stops §2's
-- category change from silently unlocking an admin screen. It was `admin/elections` with
-- category `admin`, which resolved `view` to 'none' by the prefix rule; it is a `resources`
-- key now, which resolves to 'everyone' unless the family has a restricted row. Naming it
-- here is what gives a family created tomorrow the row it needs; §8 backfills the families
-- that already exist.
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
  --
  -- `membership-report` ADDED 20260820000003. It publishes no personal figure at all —
  -- counts and place names only — so the reason is narrower than the money ones above: it
  -- replaces `/admin/reports`, which only administrators could open, and a migration must
  -- not silently widen who may read a family's organizational shape.
  v_restricted text[] := ARRAY['reporting/dues-projections', 'gatherings/budget',
                             'reporting/membership', 'review/election-management'];
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
      ('accounting/summary', 'view'::public.permission_action, 'own'::public.permission_scope),
      ('community/chat',   'create', 'any'),
      ('community/chat',   'edit',   'own'),
      ('community/chat',   'delete', 'own'),
      ('community/family-tree', 'edit', 'any'),
      ('review/photos',    'create', 'any'),
      ('review/photos',    'edit',   'own')
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
-- Restated because CREATE OR REPLACE does not change privileges and this must stay
-- unreachable from a browser — 20260806000015 made grants the primary control, and
-- `service_role` keeps EXECUTE by default.
REVOKE ALL ON FUNCTION public.seed_family_permission_templates(text) FROM PUBLIC, anon, authenticated;

-- ── 7b. Functions bake keys in too, and that is not only the seeder ─────────
-- §5 rewrote the POLICIES. This is the same problem one layer over: a SECURITY DEFINER
-- function that gates itself calls `auth_permission('<key>', '<action>')` with the key as a
-- literal in its own body, and `set_membership_status()` is the one that found this — the
-- RLS suite's positive control for `approveApplicant` went red because the function was
-- still asking about `admin/approvals`, which by then existed nowhere.
--
-- FOUR OTHERS DO THE SAME (announcements' pin guard, the board-position guards, the updates
-- archive, the family-tree record guard). They are found rather than listed: `pg_proc` is
-- asked which definitions contain the literal, so a function added later is covered without
-- an edit here.
--
-- THREE SHAPES ARE REWRITTEN — `auth_permission('…'`, `auth_can('…'` and
-- `resource_key = '…'` — and never a bare quoted word. The second was found the same way as the first: the assertion at the
-- foot of this file named `admin/users`, which `apply_permission_template()` and the
-- `permission_templates` policies reach through `auth_can()`. Both helpers are enumerated
-- from the sources with
-- `grep -rhoE "auth_[a-z_]+\('[a-z/-]+'" supabase/migrations/*.sql | sort -u`, and a fourth
-- shape would have to be added here.
--
-- THE THIRD IS NOT A CALL AT ALL: `apply_permission_template()` reads
-- `tp.resource_key = 'admin/users'` to decide whether the caller may hand somebody a
-- template, which is a key used as DATA rather than as an argument. It is still exact —
-- `resource_key` is the permission tables' own column, so nothing else can be on that side
-- of the comparison — and it is the shape that would have been missed by looking only for
-- function calls. That
-- precision is the whole safety of this pass: `'dues'` is also a `dues_schedules.kind` value
-- and `'photos'` is also a table, and a body-wide replace would silently rewrite a
-- comparison into nonsense. Matching the call means a false positive is impossible.
--
-- `pg_get_functiondef()` returns a complete CREATE OR REPLACE statement — dollar-quoted body,
-- SECURITY DEFINER, `SET search_path`, the lot — so re-executing it preserves everything but
-- the literal. CREATE OR REPLACE does not touch privileges, so no grant moves.
DO $$
DECLARE
  f       record;
  m       record;
  v_def   text;
  v_count int := 0;
BEGIN
  FOR f IN
    SELECT p.oid, p.proname, pg_get_functiondef(p.oid) AS def
      FROM pg_proc p
      JOIN pg_namespace n ON n.oid = p.pronamespace
     WHERE n.nspname = 'public'
       AND p.prokind = 'f'
       AND EXISTS (
             SELECT 1 FROM key_moves k
              WHERE pg_get_functiondef(p.oid)
                    LIKE '%auth_permission(' || quote_literal(k.old_key) || '%'
                 OR pg_get_functiondef(p.oid)
                    LIKE '%auth_can(' || quote_literal(k.old_key) || '%'
                 OR pg_get_functiondef(p.oid)
                    LIKE '%resource_key = ' || quote_literal(k.old_key) || '%')
  LOOP
    v_def := f.def;
    FOR m IN SELECT old_key, new_key FROM key_moves LOOP
      v_def := replace(v_def,
                       'auth_permission(' || quote_literal(m.old_key),
                       'auth_permission(' || quote_literal(m.new_key));
      v_def := replace(v_def,
                       'auth_can(' || quote_literal(m.old_key),
                       'auth_can(' || quote_literal(m.new_key));
      v_def := replace(v_def,
                       'resource_key = ' || quote_literal(m.old_key),
                       'resource_key = ' || quote_literal(m.new_key));
    END LOOP;
    EXECUTE v_def;
    v_count := v_count + 1;
    RAISE NOTICE 'rekeyed function %', f.proname;
  END LOOP;
  RAISE NOTICE 'rekeyed % function body/bodies', v_count;
END $$;

-- ── 8. Keep the screen that left `admin/` shut ──────────────────────────────
-- §7 covers the family created tomorrow. This covers the families that exist: without it,
-- `review/election-management` resolves `view` to 'everyone' for every one of them, because
-- it is no longer spelled like an admin key. Its own visibility row was copied across in §3
-- IF the family had one — the loop at the foot of 20260618000000 gives every admin key one —
-- so in practice this is a belt on that brace, and it is written out because "in practice"
-- is not a thing to leave a permission default resting on.
INSERT INTO public.resource_visibility (family_code, resource_key, visibility)
SELECT DISTINCT p.family_code, 'review/election-management', 'restricted'
  FROM public.people p
 WHERE p.family_code IS NOT NULL AND p.family_code <> ''
ON CONFLICT (family_code, resource_key) DO NOTHING;

-- ── 9. The assertions ───────────────────────────────────────────────────────
-- Every one runs unconditionally against the catalogue — no fixture, so this block cannot
-- report success by skipping (AGENTS.md, "A verify block that can skip must not be the only
-- check").
DO $$
DECLARE
  v_bad text;
BEGIN
  -- Every old key is gone and every new key is here.
  SELECT string_agg(m.old_key, ', ' ORDER BY m.old_key) INTO v_bad
    FROM key_moves m JOIN public.permission_resources pr ON pr.key = m.old_key;
  IF v_bad IS NOT NULL THEN
    RAISE EXCEPTION 'old resource key(s) survived: %', v_bad;
  END IF;

  SELECT string_agg(m.new_key, ', ' ORDER BY m.new_key) INTO v_bad
    FROM key_moves m WHERE NOT EXISTS (
      SELECT 1 FROM public.permission_resources pr WHERE pr.key = m.new_key);
  IF v_bad IS NOT NULL THEN
    RAISE EXCEPTION 'new resource key(s) missing: %', v_bad;
  END IF;

  -- NOTHING anywhere still names an old key. This is the check that matters: a grant, a
  -- visibility row or a map row left behind points at a resource nothing can render a switch
  -- for, and a POLICY left behind asks `auth_permission()` about a key that does not exist —
  -- which falls through to 'any' for view and would publish the table.
  SELECT string_agg(DISTINCT m.old_key, ', ') INTO v_bad
    FROM key_moves m
   WHERE EXISTS (SELECT 1 FROM public.template_permissions t WHERE t.resource_key = m.old_key)
      OR EXISTS (SELECT 1 FROM public.resource_visibility r WHERE r.resource_key = m.old_key)
      OR EXISTS (SELECT 1 FROM public.permission_table_map p WHERE p.resource_key = m.old_key);
  IF v_bad IS NOT NULL THEN
    RAISE EXCEPTION 'grants, visibility or map rows still name: %', v_bad;
  END IF;

  SELECT string_agg(DISTINCT m.old_key, ', ') INTO v_bad
    FROM key_moves m, pg_policies pol
   WHERE pol.schemaname = 'public'
     AND (COALESCE(pol.qual, '') || COALESCE(pol.with_check, ''))
         LIKE '%' || quote_literal(m.old_key) || '::text%';
  IF v_bad IS NOT NULL THEN
    RAISE EXCEPTION 'policies still evaluate: %', v_bad;
  END IF;

  -- NO FUNCTION STILL ASKS ABOUT AN OLD KEY — §7b's rewrite, checked rather than assumed.
  -- Matched on the CALL and not on a bare quoted word, for §7b's reason: `'dues'` is also a
  -- schedule kind and `'photos'` is also a table, so a body-wide match would report a false
  -- positive on a function that is perfectly correct.
  SELECT string_agg(DISTINCT m.old_key, ', ') INTO v_bad
    FROM key_moves m, pg_proc pp
    JOIN pg_namespace n ON n.oid = pp.pronamespace
   WHERE n.nspname = 'public'
     AND pg_get_functiondef(pp.oid) LIKE '%auth_permission(' || quote_literal(m.old_key) || '%';
  IF v_bad IS NOT NULL THEN
    RAISE EXCEPTION 'a function still evaluates auth_permission() on: %', v_bad;
  END IF;

  -- And the seeder, which names keys OUTSIDE an auth_permission() call, carries none either.
  -- A compound key (one with a '/' or a '-') cannot be anything but a key, so this can be
  -- matched on the bare literal where the check above could not.
  SELECT string_agg(DISTINCT m.old_key, ', ') INTO v_bad
    FROM key_moves m, pg_proc pp
    JOIN pg_namespace n ON n.oid = pp.pronamespace
   WHERE n.nspname = 'public'
     AND pp.proname IN ('seed_family_permission_templates', 'apply_permission_template')
     AND (m.old_key LIKE '%/%' OR m.old_key LIKE '%-%')
     AND pg_get_functiondef(pp.oid) LIKE '%' || quote_literal(m.old_key) || '%';
  IF v_bad IS NOT NULL THEN
    RAISE EXCEPTION 'a seeding function still names: %', v_bad;
  END IF;

  -- THE INVARIANT 20260817000004 RESTS ON, and the reason §2 moves one category: an `admin`
  -- category exactly where the key is shaped `admin/…`, in both directions.
  SELECT string_agg(format('%s (category=%s)', key, category), ', ' ORDER BY key) INTO v_bad
    FROM public.permission_resources
   WHERE (category = 'admin') IS DISTINCT FROM (key LIKE 'admin/%');
  IF v_bad IS NOT NULL THEN
    RAISE EXCEPTION 'category and key shape disagree for: % — see 20260817000004', v_bad;
  END IF;

  -- The screen that left `admin/` is still shut everywhere.
  IF EXISTS (
    SELECT 1 FROM public.people p
     WHERE p.family_code IS NOT NULL AND p.family_code <> ''
       AND NOT EXISTS (
             SELECT 1 FROM public.resource_visibility rv
              WHERE rv.family_code = p.family_code
                AND rv.resource_key = 'review/election-management'
                AND rv.visibility = 'restricted')
  ) THEN
    RAISE EXCEPTION 'review/election-management is not restricted for every family';
  END IF;

  -- One row per sort_order within a category, which is what a copied sort_order could break.
  SELECT string_agg(DISTINCT category, ', ') INTO v_bad
    FROM (SELECT category, sort_order FROM public.permission_resources
           GROUP BY category, sort_order HAVING COUNT(*) > 1) d;
  IF v_bad IS NOT NULL THEN
    RAISE EXCEPTION 'two resources share a sort_order in: %', v_bad;
  END IF;

  -- And §7 lost nothing on the way in — the staleness check 20260820000003 added, restated
  -- against the moved keys.
  IF NOT EXISTS (
    SELECT 1 FROM pg_proc pp JOIN pg_namespace n ON n.oid = pp.pronamespace
     WHERE n.nspname = 'public' AND pp.proname = 'seed_family_permission_templates'
       AND pg_get_functiondef(pp.oid) LIKE '%gatherings/budget%'
       AND pg_get_functiondef(pp.oid) LIKE '%community/family-tree%'
       AND pg_get_functiondef(pp.oid) LIKE '%reporting/membership%'
  ) THEN
    RAISE EXCEPTION 'seed_family_permission_templates() lost a grant an earlier migration added';
  END IF;

  IF has_function_privilege('anon', 'public.seed_family_permission_templates(text)', 'EXECUTE')
     OR has_function_privilege('authenticated', 'public.seed_family_permission_templates(text)', 'EXECUTE')
  THEN
    RAISE EXCEPTION 'seed_family_permission_templates() is executable by a browser role';
  END IF;
END $$;

COMMIT;
