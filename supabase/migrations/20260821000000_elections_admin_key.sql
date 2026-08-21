-- ============================================================================
-- Election Management becomes "Elections" and goes back under Admin.
--
-- This is the day 20260820000004's header named:
--
--     "So the category moves to `resources` with the key. […] It goes back to
--      `admin/elections` with category `admin` the day it leaves the Review section."
--
-- That file moved `admin/elections` -> `review/election-management` twenty-four hours ago,
-- because the route had joined the rail's Review section — the worklist of six screens that
-- came off `status: 'future'` and had not been walked end to end. This one has now been
-- walked (20260821000001 is what the walk found), so it leaves for Admin, which is where an
-- organizer's screen belongs, and it is captioned **Elections** because it sits under a rail
-- heading that already says Admin. Same argument that shortened "Family Settings" to
-- "Settings" (20260812000001) and "Membership Report" to "Membership" (20260820000003).
--
-- TWO RAIL ITEMS NOW READ "Elections" — Admin > Elections (this key) and Review > Elections
-- (`review/elections`, the member's own ballot). AGENTS.md sanctions exactly that: "Dues"
-- appears under both Accounting and Transactions, and the section heading is what tells them
-- apart. The two keys stay two keys because they are two jobs a family delegates separately —
-- running an election is not voting in one.
--
-- ── WHAT MOVING A KEY COSTS, AND WHICH HALVES APPLY HERE ────────────────────
-- 20260820000004 enumerated the seven places a key is referenced. This move touches THREE of
-- them, and the file asserts the other four are genuinely empty rather than assuming it:
--
--   1. permission_resources.key                  — the row itself                      §1
--   2. template_permissions.resource_key         — every grant on every template       §2
--   3. resource_visibility.resource_key          — the per-family show/hide            §3
--   4. permission_table_map.resource_key         — EMPTY. Asserted in §4.
--   5. The composed policy expressions           — NONE. Asserted in §4.
--   6. seed_family_permission_templates()        — names the key in `v_restricted`      §6
--   7. Any other function gating on the key      — NONE. Asserted in §4.
--
-- 4, 5 and 7 are empty for one reason worth stating: **this key gates a SCREEN and not a
-- TABLE.** The four election tables are mapped to `review/elections`, so the 94 composed
-- policies say `auth_permission('review/elections', …)` and none of them mentions this key at
-- all. That is what makes this migration short where 20260820000004 was long — and it is
-- exactly the assertion to make, because "no policy references it" is the claim whose being
-- wrong would leave a table world-readable for view while every write failed closed.
--
-- ── THE CATEGORY MOVES BACK TO `admin`, WHICH IS THE POINT AND NOT A DETAIL ──
-- 20260817000004 makes `view` resolve to 'none' where a family has no `resource_visibility`
-- row for a resource whose category is `admin` — and for an unregistered key merely SHAPED
-- `admin/…`. It licenses that prefix test by asserting `(category = 'admin') IS DISTINCT FROM
-- (key LIKE 'admin/%')` finds nothing, in both directions. So the category is not decoration:
-- carrying `admin/elections` at category `resources` would fail that assertion on the next
-- file that re-ran it, and carrying it at category `admin` is what makes the screen fail
-- CLOSED again.
--
-- §3 copies every family's `resource_visibility` row across ANYWAY, and that is deliberate
-- belt-and-braces rather than redundancy: the prefix rule is what protects a family with no
-- row, and an explicit row is what makes the grid render a switch an administrator can move
-- (AGENTS.md §6). Losing the row would not unlock the screen; it would leave a screen nobody
-- could grant, which is the other half of that section's warning.
--
-- ── NONE OF THE FOREIGN KEYS IS `ON UPDATE CASCADE` ────────────────────────
-- So the key cannot be UPDATEd in place. Dependents are COPIED to the new key and the old
-- rows dropped, in that order, exactly as 20260820000004 does it.
--
-- IDEMPOTENT. Every insert is ON CONFLICT and every delete is guarded by the copy above it,
-- so a second pass finds the new rows present and the old ones already gone.
--
-- ── CHECKED BY MUTATION, per AGENTS.md §7 ──────────────────────────────────
-- Four copies of this file, one line changed in each, replayed against a reset database;
-- every one aborted, and the clean file prints its NOTICE. Observed output:
--
--   m1  §1 writes category 'resources' instead of 'admin'
--         ERROR: admin/elections must carry category 'admin' (20260817000004's invariant)
--   m2  §2's grant copy is skipped
--         ERROR: admin/elections carries 0 template grants where review/election-management had 34
--   m3  §5 deletes the old resource before §2 copies its grants
--         ERROR: admin/elections carries 0 template grants where review/election-management had 34
--   m4  §6 leaves 'review/election-management' in v_restricted
--         ERROR: seed_family_permission_templates() still names review/election-management
--
-- HOW THIS REACHES A DATABASE
--   `supabase db push`, from CI on merge to master — never `psql -f` by hand, which
--   records nothing and can replay this file out of order. See AGENTS.md, "How
--   migrations reach the hosted project".
-- ============================================================================

BEGIN;

-- ── 0. What the old key had, so §7 can compare against it ───────────────────
-- Counted BEFORE anything moves. A verify block that counts the new rows and nothing else
-- passes happily over a copy that moved zero of them, which is m2 and m3 above.
CREATE TEMP TABLE election_key_before ON COMMIT DROP AS
SELECT
  (SELECT count(*) FROM public.template_permissions
    WHERE resource_key = 'review/election-management')            AS grants,
  (SELECT count(*) FROM public.resource_visibility
    WHERE resource_key = 'review/election-management')            AS visibility,
  (SELECT count(*) FROM public.permission_resources
    WHERE key = 'review/election-management')                     AS resource;

-- ── 1. The new resource row ─────────────────────────────────────────────────
-- Label CHANGES — "Election Management" -> "Elections" — and everything else is copied, so
-- the grid renders the row in the same place with the same four switches. `sort_order` 200
-- already sits between Board Positions (190) and Gathering Management (231) in the admin
-- category, which is where an organizer's screen belongs in that list.
--
-- ON CONFLICT DO UPDATE rather than DO NOTHING, so a replay corrects a row that exists with
-- the wrong category — which is the one field that must not be allowed to drift (see header).
INSERT INTO public.permission_resources (key, label, category, subsection, sort_order, actions)
SELECT 'admin/elections', 'Elections', 'admin', pr.subsection, pr.sort_order, pr.actions
  FROM public.permission_resources pr
 WHERE pr.key = 'review/election-management'
ON CONFLICT (key) DO UPDATE
  SET label      = EXCLUDED.label,
      category   = EXCLUDED.category,
      subsection = EXCLUDED.subsection,
      sort_order = EXCLUDED.sort_order,
      actions    = EXCLUDED.actions;

-- A database that has already run this file has no old row to copy from, so the row above
-- was not written. State it unconditionally for that case — same label, same category, and
-- the four actions this key has declared since 20260618000000.
INSERT INTO public.permission_resources (key, label, category, subsection, sort_order, actions)
VALUES ('admin/elections', 'Elections', 'admin', NULL, 200,
        ARRAY['view', 'create', 'edit', 'delete']::public.permission_action[])
ON CONFLICT (key) DO NOTHING;

-- ── 2. Every family's grants, carried across ────────────────────────────────
-- A member holding the organizer grant must still hold it after this file. Nothing here is a
-- judgement about who should have it: scope, action and template are copied verbatim.
INSERT INTO public.template_permissions (template_id, resource_key, action, scope)
SELECT tp.template_id, 'admin/elections', tp.action, tp.scope
  FROM public.template_permissions tp
 WHERE tp.resource_key = 'review/election-management'
ON CONFLICT (template_id, resource_key, action) DO UPDATE
  SET scope = EXCLUDED.scope;

-- ── 3. Every family's visibility row, carried across ────────────────────────
-- See the header: the `admin/` prefix is what makes this key fail closed now, and this row is
-- what makes the switch RENDER. Both, deliberately.
INSERT INTO public.resource_visibility (family_code, resource_key, visibility)
SELECT rv.family_code, 'admin/elections', rv.visibility
  FROM public.resource_visibility rv
 WHERE rv.resource_key = 'review/election-management'
ON CONFLICT (family_code, resource_key) DO UPDATE
  SET visibility = EXCLUDED.visibility;

-- Any family that somehow has no row — one created between 20260820000004 and this file
-- through a path that skipped the seeder — gets the restricted posture stated rather than
-- inherited. `admin/elections` resolving to 'none' by prefix is the same answer; a row is
-- what an administrator can then move.
INSERT INTO public.resource_visibility (family_code, resource_key, visibility)
SELECT DISTINCT p.family_code, 'admin/elections', 'restricted'
  FROM public.people p
 WHERE p.family_code IS NOT NULL AND p.family_code <> ''
ON CONFLICT (family_code, resource_key) DO NOTHING;

-- ── 4. The four places that must be empty, asserted rather than assumed ─────
-- This is the half of the migration that is actually load-bearing. If any of these finds
-- something, the copy above is incomplete and the DELETE below would strand it.
DO $mig$
DECLARE
  v_maps  int;
  v_pols  int;
  v_funcs text;
BEGIN
  SELECT count(*) INTO v_maps
    FROM public.permission_table_map
   WHERE resource_key IN ('review/election-management', 'admin/elections');
  IF v_maps > 0 THEN
    RAISE EXCEPTION
      'the election-management key gates % table(s) in permission_table_map — the composed policies must be rewritten before it can move',
      v_maps;
  END IF;

  -- The composed policies. 20260618000001's `_perm_predicate()` interpolates the key as a
  -- LITERAL with %L, so a policy asking about a key that no longer exists falls through to
  -- `auth_permission`'s default: world-readable for view, closed for every write. Nothing
  -- should mention this key, because it maps no table — measured, not reasoned about.
  SELECT count(*) INTO v_pols
    FROM pg_policies
   WHERE schemaname = 'public'
     AND (COALESCE(qual, '') LIKE '%review/election-management%'
       OR COALESCE(with_check, '') LIKE '%review/election-management%');
  IF v_pols > 0 THEN
    RAISE EXCEPTION
      '% composed policy expression(s) name review/election-management', v_pols;
  END IF;

  -- Function bodies. `grep -rhoE "auth_[a-z_]+\('[a-z/-]+'" supabase/migrations/*.sql` over
  -- the tree finds no election key at all; this asks the DATABASE, which is the copy that
  -- decides. `seed_family_permission_templates` is excluded because §6 is what rewrites it.
  SELECT string_agg(p.proname, ', ') INTO v_funcs
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
   WHERE n.nspname = 'public'
     -- `prokind` MATTERS: pg_get_functiondef() raises 42809 on an aggregate, and `public`
     -- holds several. Without this the assertion aborts the migration with a message about
     -- array_agg, which reads as a finding and is not one.
     AND p.prokind IN ('f', 'p')
     AND p.proname <> 'seed_family_permission_templates'
     AND pg_get_functiondef(p.oid) LIKE '%''review/election-management''%';
  IF v_funcs IS NOT NULL THEN
    RAISE EXCEPTION 'function(s) still name review/election-management: %', v_funcs;
  END IF;
END $mig$;

-- ── 5. The old rows go ──────────────────────────────────────────────────────
-- Dependents first would be tidier to read and is unnecessary: `template_permissions` and
-- `resource_visibility` both reference `permission_resources.key` ON DELETE CASCADE, so one
-- delete takes all three. It is safe only because §2 and §3 have already copied them and §7
-- checks that they arrived.
DELETE FROM public.permission_resources WHERE key = 'review/election-management';

-- ── 6. The seeder stops naming the old key ──────────────────────────────────
-- `v_restricted` is the list of NON-admin resources that still start restricted. This key is
-- an admin one again, so the seeder's `pr.category = 'admin'` branch covers it and the
-- literal is now a stale string naming a row that no longer exists. Harmless — the list is
-- only ever compared with `=` — and removed anyway, because AGENTS.md's whole argument about
-- hand-maintained lists is that the stale entry is what the next reader trusts.
--
-- CREATE OR REPLACE of the 20260820000007 body, with that one array element deleted and
-- nothing else touched. Re-issued in full rather than patched, because plpgsql does not
-- resolve names in a body until it runs: a hand-edited body is not something a migration can
-- verify by applying. `grep -l 'FUNCTION public.seed_family_permission_templates'
-- supabase/migrations/*.sql` finds every file that has defined it, and the newest wins.
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
  -- `review/election-management` LEFT THIS LIST IN 20260821000000, and did not need
  -- replacing: it is `admin/elections` now, so the `pr.category = 'admin'` branch below
  -- restricts it and no literal has to remember to.
  v_restricted text[] := ARRAY['reporting/dues-projections', 'gatherings/budget',
                             'reporting/membership'];
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
  INSERT INTO public.template_permissions (template_id, resource_key, action, scope)
  SELECT v_general, t.k, t.act, t.sc
    FROM (VALUES
      ('accounting/summary', 'view'::public.permission_action, 'own'::public.permission_scope),
      ('community/chat',   'create', 'any'),
      ('community/chat',   'edit',   'own'),
      ('community/chat',   'delete', 'own'),
      ('community/family-tree', 'edit', 'any'),
      ('review/photos',    'create', 'any'),
      ('review/photos',    'edit',   'own'),
      ('review/photos',    'delete', 'own')
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

-- The grants are restated rather than relied on. `CREATE OR REPLACE` preserves an existing
-- ACL, so this is documentation of who may execute it (AGENTS.md §2b) — and it is the same
-- pair 20260820000004 §7 asserts, so a drift here fails that file's checks too.
REVOKE ALL ON FUNCTION public.seed_family_permission_templates(text) FROM PUBLIC, anon, authenticated;

-- ── 7. Verify ───────────────────────────────────────────────────────────────
-- Every assertion runs unconditionally: there is no fixture to be missing, so this block
-- cannot report success by skipping (20260806000012's failure mode).
DO $mig$
DECLARE
  b        record;
  v_now    int;
  v_cat    text;
  v_stale  int;
BEGIN
  SELECT * INTO b FROM election_key_before;

  -- (a) The row exists, and carries the category the prefix test is licensed by.
  SELECT category INTO v_cat
    FROM public.permission_resources WHERE key = 'admin/elections';
  IF v_cat IS NULL THEN
    RAISE EXCEPTION 'admin/elections was not created';
  END IF;
  IF v_cat <> 'admin' THEN
    RAISE EXCEPTION
      'admin/elections must carry category ''admin'' (20260817000004''s invariant), not %', v_cat;
  END IF;

  -- (b) 20260817000004's invariant, in BOTH directions, over the whole table. Asserted here
  -- rather than trusted because this file is the one that moved a category.
  IF EXISTS (
    SELECT 1 FROM public.permission_resources
     WHERE (category = 'admin') IS DISTINCT FROM (key LIKE 'admin/%')
  ) THEN
    RAISE EXCEPTION
      'category ''admin'' and the admin/ key prefix disagree for at least one resource';
  END IF;

  -- (c) The grants arrived. Counted against what the old key HAD, so a copy that moved
  -- nothing fails instead of reporting a tidy zero.
  SELECT count(*) INTO v_now
    FROM public.template_permissions WHERE resource_key = 'admin/elections';
  IF b.resource > 0 AND v_now < b.grants THEN
    RAISE EXCEPTION
      'admin/elections carries % template grants where review/election-management had %',
      v_now, b.grants;
  END IF;

  -- (d) Every family that had a visibility row still has one.
  SELECT count(*) INTO v_now
    FROM public.resource_visibility WHERE resource_key = 'admin/elections';
  IF v_now < b.visibility THEN
    RAISE EXCEPTION
      'admin/elections has % visibility rows where review/election-management had %',
      v_now, b.visibility;
  END IF;

  -- (e) And no family is left able to READ the organizer screen by default. `view` for an
  -- admin key resolves to 'none' with no row at all, so this is the row-level half: a
  -- 'everyone' row would re-open what the prefix closes.
  IF EXISTS (
    SELECT 1 FROM public.resource_visibility
     WHERE resource_key = 'admin/elections' AND visibility <> 'restricted'
  ) THEN
    RAISE EXCEPTION 'admin/elections is not restricted for every family that has a row';
  END IF;

  -- (f) The old key is gone everywhere, including out of the seeder body.
  SELECT count(*) INTO v_stale
    FROM public.permission_resources WHERE key = 'review/election-management';
  IF v_stale > 0 THEN
    RAISE EXCEPTION 'review/election-management still exists';
  END IF;
  -- The QUOTED literal, not the bare string. §6's body carries a comment SAYING the key left
  -- `v_restricted`, which is documentation worth keeping and is not a reference — and the
  -- looser test failed on it, which is the assertion being right about the wrong thing.
  IF pg_get_functiondef('public.seed_family_permission_templates(text)'::regprocedure)
       LIKE '%''review/election-management''%' THEN
    RAISE EXCEPTION
      'seed_family_permission_templates() still names the retired key as a literal';
  END IF;

  RAISE NOTICE
    'admin/elections: category admin, % grants and % visibility rows carried across; review/election-management removed',
    (SELECT count(*) FROM public.template_permissions WHERE resource_key = 'admin/elections'),
    (SELECT count(*) FROM public.resource_visibility  WHERE resource_key = 'admin/elections');
END $mig$;

COMMIT;
