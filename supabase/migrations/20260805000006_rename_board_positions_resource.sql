-- ============================================================================
-- Rename the Board Positions permission resource:
--     admin/user-roles  →  admin/boardpositions
--
-- WHY THIS IS A KEY RENAME AND NOT A LABEL RENAME
--   The two prior renames (20260618000004 Account Management → Accounting, and
--   20260805000004 Account Summary → My Summary) deliberately touched only the
--   LABEL, because the key is the route. This one is the other case: the ROUTE is
--   what changed (/admin/user-roles → /admin/boardpositions), and
--   viewableResources() derives the resource key from the feature's href
--   (`feature.href.replace(/^\//, '')`), while every page gates with
--   requireView(user.id, '<route minus leading slash>'). Route and key are the
--   same string by construction, so moving one forces the other.
--
--   The `user_roles` TABLE keeps its name. Only the route and the resource key move.
--
-- WHAT REFERENCES THE OLD KEY
--   1. permission_resources.key                       — the row itself
--   2. group_permissions.resource_key                 — FK, every group grant
--   3. person_permissions.resource_key                — FK, every individual override
--   4. resource_visibility.resource_key               — FK, the per-family show/hide
--   5. permission_table_map.resource_key              — FK, for family_roles,
--                                                       family_role_exclusions, user_roles
--   6. The RLS POLICY EXPRESSIONS themselves. This is the one that is easy to miss:
--      20260618000001's _perm_predicate() interpolates the key as a LITERAL with %L,
--      so each wrapped policy carries a hard-coded
--          public.auth_permission('admin/user-roles'::text, ...)
--      inside its USING / WITH CHECK. Updating permission_table_map does NOT
--      retroactively change those policies — the map is only read when the sweep
--      runs. Left alone, the policies would keep asking about a resource key that
--      no longer exists, `auth_permission` would fall through to its default, and
--      family_roles / family_role_exclusions would silently become world-readable
--      (default for 'view' is 'any') while every write silently failed closed.
--
--   None of the FKs are ON UPDATE CASCADE, so the key cannot simply be UPDATEd in
--   place — dependents are copied to the new key and the old rows dropped.
--
-- IDEMPOTENT: every step is a no-op once the old key is gone. The copies use
-- ON CONFLICT DO NOTHING so a re-run cannot collide with rows already moved, and
-- the policy rewrite matches on the old literal, which is absent after pass one.
--
-- USAGE
--   psql "$DATABASE_URL" -f 20260805000006_rename_board_positions_resource.sql
-- ============================================================================

BEGIN;

-- ── 1. The new resource row ─────────────────────────────────────────────────
-- Same category and sort_order as the row it replaces, so Groups & Permissions
-- renders it in exactly the same place in the Admin section.
INSERT INTO public.permission_resources (key, label, category, sort_order)
VALUES ('admin/boardpositions', 'Board Positions', 'admin', 190)
ON CONFLICT (key) DO UPDATE
  SET label = EXCLUDED.label, category = EXCLUDED.category, sort_order = EXCLUDED.sort_order;

-- ── 2. Carry every existing grant across ────────────────────────────────────
-- Copy-then-delete rather than UPDATE: the FKs are ON DELETE CASCADE but not
-- ON UPDATE CASCADE, so an in-place key change would be rejected.
INSERT INTO public.group_permissions (group_id, resource_key, action, scope, updated_at)
SELECT group_id, 'admin/boardpositions', action, scope, updated_at
  FROM public.group_permissions
 WHERE resource_key = 'admin/user-roles'
ON CONFLICT (group_id, resource_key, action) DO NOTHING;

INSERT INTO public.person_permissions (person_id, resource_key, action, scope, updated_at)
SELECT person_id, 'admin/boardpositions', action, scope, updated_at
  FROM public.person_permissions
 WHERE resource_key = 'admin/user-roles'
ON CONFLICT (person_id, resource_key, action) DO NOTHING;

INSERT INTO public.resource_visibility (family_code, resource_key, visibility, updated_at)
SELECT family_code, 'admin/boardpositions', visibility, updated_at
  FROM public.resource_visibility
 WHERE resource_key = 'admin/user-roles'
ON CONFLICT (family_code, resource_key) DO NOTHING;

-- permission_table_map is keyed on table_name, so this one can move in place.
UPDATE public.permission_table_map
   SET resource_key = 'admin/boardpositions'
 WHERE resource_key = 'admin/user-roles';

-- ── 3. Drop the old resource ────────────────────────────────────────────────
-- Safe now: the copies above left nothing pointing at it. The ON DELETE CASCADE
-- on the three permission tables only sweeps up the old-key duplicates.
DELETE FROM public.permission_resources WHERE key = 'admin/user-roles';

-- ── 4. Rewrite the policies that carry the old key as a literal ─────────────
-- Textual substitution inside the stored expression, then recreate the policy
-- under the same name, same command, same roles. Only the resource literal
-- changes — the family scoping and ownership clauses are reproduced verbatim
-- from pg_policies, exactly as 20260618000001 did when it wrapped them.
DO $$
DECLARE
  p        record;
  v_roles  text;
  v_qual   text;
  v_check  text;
  v_count  int := 0;
BEGIN
  FOR p IN
    SELECT tablename, policyname, cmd, qual, with_check, roles
      FROM pg_policies
     WHERE schemaname = 'public'
       AND (COALESCE(qual, '') LIKE '%admin/user-roles%'
         OR COALESCE(with_check, '') LIKE '%admin/user-roles%')
  LOOP
    v_roles := array_to_string(p.roles, ', ');
    v_qual  := replace(p.qual,       'admin/user-roles', 'admin/boardpositions');
    v_check := replace(p.with_check, 'admin/user-roles', 'admin/boardpositions');

    EXECUTE format('DROP POLICY %I ON public.%I', p.policyname, p.tablename);

    -- NULL qual / with_check are meaningful (the clause is simply absent), so each
    -- command is rebuilt with only the clauses it actually had.
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

    ELSE  -- ALL
      IF v_check IS NULL THEN
        EXECUTE format('CREATE POLICY %I ON public.%I FOR ALL TO %s USING (%s)',
                       p.policyname, p.tablename, v_roles, v_qual);
      ELSE
        EXECUTE format('CREATE POLICY %I ON public.%I FOR ALL TO %s USING (%s) WITH CHECK (%s)',
                       p.policyname, p.tablename, v_roles, v_qual, v_check);
      END IF;
    END IF;

    v_count := v_count + 1;
  END LOOP;

  RAISE NOTICE 'rekeyed % policies to admin/boardpositions', v_count;
END $$;

-- ── 5. Fail loudly if anything still points at the old key ──────────────────
DO $$
DECLARE v_left int;
BEGIN
  SELECT COUNT(*) INTO v_left
    FROM pg_policies
   WHERE schemaname = 'public'
     AND (COALESCE(qual, '') LIKE '%admin/user-roles%'
       OR COALESCE(with_check, '') LIKE '%admin/user-roles%');
  IF v_left > 0 THEN
    RAISE EXCEPTION 'ROLLBACK: % policies still reference admin/user-roles', v_left;
  END IF;

  IF EXISTS (SELECT 1 FROM public.permission_table_map WHERE resource_key = 'admin/user-roles') THEN
    RAISE EXCEPTION 'ROLLBACK: permission_table_map still references admin/user-roles';
  END IF;
END $$;

COMMIT;
