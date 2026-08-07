-- ============================================================================
-- Groups become TEMPLATES, and User Management absorbs Groups & Permissions.
--
-- WHAT CHANGES, IN ONE LINE
--   A member no longer belongs to N groups whose policies are unioned and then
--   layered over per-person overrides. A member is assigned exactly ONE template,
--   and that template IS their permissions.
--
-- WHY THE OLD MODEL WAS TWO SCREENS
--   It had four moving parts — group policy, group membership, per-person override,
--   and the group-beats-person precedence rule — and no single screen could show a
--   member's actual access, because the answer depended on all four. So it was split
--   across /admin/users and /admin/groups, each showing half of it, and the
--   precedence rule was explained in a blue box on one of them.
--
--   One template per member collapses all of that: a member's access is the grid on
--   their template, and nothing else contributes. Two screens become one, and the
--   per-person override grid (30 rows x 4 actions, per member) disappears entirely.
--
-- THE SHAPE OF THE MIGRATION
--    1. user_groups        -> permission_templates
--       group_permissions  -> template_permissions   (group_id -> template_id)
--    2. people.permission_template_id, backfilled from the old memberships
--    3. Board Users deleted; its members land on General
--    4. resource key admin/groups MERGED INTO admin/users, then deleted
--    5. every RLS policy naming admin/groups rewritten to name admin/users
--    6. RLS on the two renamed tables rebuilt under their new names
--    7. every template's grid MATERIALIZED, so the grid is the whole truth
--    8. auth_permission() loses its group layer and its override layer
--    9. membership_status gains 'disabled', with a guard trigger on the new column
--   10. two RPCs: apply_permission_template(), set_member_enabled()
--   11. seeding rewritten: a new family gets Administrators and General
--   12. user_group_members and person_permissions dropped
--
-- FAIL-CLOSED CHOICES, BOTH DELIBERATE AND BOTH LOGGED
--   * The admin/groups -> admin/users merge takes the LEAST permissive of the two
--     grants, not the most. The merged page can do everything BOTH pages could, so a
--     template holding only admin/users:edit would otherwise silently gain the power
--     to rewrite every permission in the family. Narrowing is visible and an
--     administrator can re-grant; escalation is neither. Every narrowed template is
--     named in a RAISE NOTICE.
--   * person_permissions rows are DISCARDED, not folded into a template. Folding
--     them would mean inventing a per-person template for anyone who had one, which
--     is the model this migration exists to remove. Every affected person is named
--     in a RAISE NOTICE so the loss is in the deploy log rather than only here.
--
-- IDEMPOTENT. Every rename is guarded by to_regclass, every insert is ON CONFLICT,
-- every function is CREATE OR REPLACE, and the policy sweep skips what it has already
-- rewritten. Safe on an empty database, where the loops find nothing and only the
-- schema, functions and triggers are created.
-- ============================================================================

BEGIN;

-- ── 1. Rename the tables ────────────────────────────────────────────────────
-- ALTER TABLE ... RENAME rewrites nothing: policies, indexes and foreign keys are
-- stored against the relation OID, so they follow the table and pg_policies renders
-- them under the new name from here on. Only the SQL text in this repo has to change.
DO $mig$
BEGIN
  IF to_regclass('public.user_groups') IS NOT NULL
     AND to_regclass('public.permission_templates') IS NULL THEN
    ALTER TABLE public.user_groups RENAME TO permission_templates;
  END IF;

  IF to_regclass('public.group_permissions') IS NOT NULL
     AND to_regclass('public.template_permissions') IS NULL THEN
    ALTER TABLE public.group_permissions RENAME TO template_permissions;
  END IF;

  IF to_regclass('public.template_permissions') IS NOT NULL
     AND EXISTS (
       SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'template_permissions'
          AND column_name = 'group_id'
     ) THEN
    ALTER TABLE public.template_permissions RENAME COLUMN group_id TO template_id;
  END IF;
END $mig$;

COMMENT ON TABLE public.permission_templates IS
  'A named permission set inside one family. A person is assigned at most one, and '
  'it is the whole of their access — see auth_permission().';
COMMENT ON TABLE public.template_permissions IS
  'One template''s grid: per resource, per action, a scope.';

-- ── 2. The assignment lives on the person ───────────────────────────────────
-- ON DELETE RESTRICT, not SET NULL: a template with members must not be deletable
-- out from under them. SET NULL would drop those members to the bare defaults
-- silently, which is a permission change disguised as a tidy-up. The action layer
-- refuses first with a countable message; this is the half that does not depend on
-- remembering to.
ALTER TABLE public.people
  ADD COLUMN IF NOT EXISTS permission_template_id UUID;

DO $mig$ BEGIN
  ALTER TABLE public.people
    ADD CONSTRAINT people_permission_template_fk
    FOREIGN KEY (permission_template_id)
    REFERENCES public.permission_templates(id) ON DELETE RESTRICT;
EXCEPTION WHEN duplicate_object THEN NULL; END $mig$;

CREATE INDEX IF NOT EXISTS people_permission_template_idx
  ON public.people (permission_template_id)
  WHERE permission_template_id IS NOT NULL;

COMMENT ON COLUMN public.people.permission_template_id IS
  'The single template deciding this person''s access. Set by the default-template '
  'trigger on insert and thereafter only by apply_permission_template().';

-- ── 2b. Backfill from the old memberships ───────────────────────────────────
-- Somebody who was in several groups held the UNION of their policies — most
-- permissive wins, per group. No single existing template reproduces that, so for
-- those people the migration MAKES one rather than choosing a winner.
--
-- WHY NOT JUST PICK THE BEST GROUP, which is what the first draft of this did
--   Every member is in General, so every "member of a custom group" is really a
--   member of {General, that group}. Picking the group with the most grants picks
--   General every time — General grants view on a dozen pages and a Photo Team
--   grants two — so every custom group a family had ever made would have been
--   silently emptied of effect. Picking the custom group instead has the opposite
--   failure: the member loses the baseline and can no longer chat or open the
--   directory. Both are silent permission changes, which is the one outcome this
--   file must not produce. So: merge, and name the result after its parts.
--
-- THE ORDER, per person:
--   1. Administrators, if they were in it. Its grid is 'any' on every declared
--      action, so the union with anything else IS Administrators — this is a
--      shortcut, not an exception, and it keeps a family's admins off a pile of
--      "Administrators + General" templates.
--   2. Exactly one group → that group's template, untouched.
--   3. Several → find-or-create "A + B + C", granting their union. Named for its
--      parts so an administrator can see what it is and collapse it later.
--   4. None → left NULL here and swept onto General by §12.
--
-- BOARD USERS IS EXCLUDED from all of it: it is being retired, so its members are
-- treated as though they were only in their other groups. Someone who was in Board
-- Users and General alone therefore comes out on plain General rather than on a
-- combined template naming a group that no longer exists.
--
-- Only user-linked rows are considered. A child or an ancestor holds no permissions
-- of their own and gets no template.
DO $mig$
DECLARE
  r         record;
  v_choice  uuid;
  v_name    text;
  v_count   int := 0;
  v_created int := 0;
BEGIN
  IF to_regclass('public.user_group_members') IS NULL THEN
    RAISE NOTICE 'no user_group_members table — nothing to backfill';
    RETURN;
  END IF;

  FOR r IN
    SELECT p.id AS person_id, p.family_code,
           array_agg(t.id   ORDER BY t.name) AS template_ids,
           array_agg(t.name ORDER BY t.name) AS template_names
      FROM public.people p
      JOIN public.user_group_members m    ON m.person_id = p.id
      JOIN public.permission_templates t  ON t.id = m.group_id
                                         AND t.family_code = p.family_code
     WHERE p.user_id IS NOT NULL
       AND p.permission_template_id IS NULL
       AND t.name <> 'Board Users'
     GROUP BY p.id, p.family_code
  LOOP
    v_choice := NULL;

    IF 'Administrators' = ANY (r.template_names) THEN
      SELECT id INTO v_choice FROM public.permission_templates
       WHERE family_code = r.family_code AND name = 'Administrators';

    ELSIF array_length(r.template_ids, 1) = 1 THEN
      v_choice := r.template_ids[1];

    ELSE
      -- UNIQUE (family_code, name) makes this find-or-create: the second person with
      -- the same combination lands on the template the first one caused to exist.
      v_name := left(array_to_string(r.template_names, ' + '), 200);

      INSERT INTO public.permission_templates (family_code, name, description, is_system)
      VALUES (r.family_code, v_name,
              'Created when groups became templates, to preserve the combined access of '
              || array_to_string(r.template_names, ', ') || '.', false)
      ON CONFLICT (family_code, name) DO NOTHING
      RETURNING id INTO v_choice;

      IF v_choice IS NULL THEN
        SELECT id INTO v_choice FROM public.permission_templates
         WHERE family_code = r.family_code AND name = v_name;
      ELSE
        -- The union, resolved exactly as the old group layer resolved it: any > own
        -- > none. An explicit CASE and not MAX(), because the enum's text ordering is
        -- alphabetical ('any' < 'none' < 'own') and would invert the answer.
        INSERT INTO public.template_permissions (template_id, resource_key, action, scope)
        SELECT v_choice, tp.resource_key, tp.action,
               CASE WHEN bool_or(tp.scope = 'any') THEN 'any'
                    WHEN bool_or(tp.scope = 'own') THEN 'own'
                    ELSE 'none' END::public.permission_scope
          FROM public.template_permissions tp
         WHERE tp.template_id = ANY (r.template_ids)
         GROUP BY tp.resource_key, tp.action
        ON CONFLICT (template_id, resource_key, action) DO NOTHING;

        v_created := v_created + 1;
        RAISE NOTICE 'family %: created combined template "%"', r.family_code, v_name;
      END IF;
    END IF;

    IF v_choice IS NOT NULL THEN
      UPDATE public.people SET permission_template_id = v_choice WHERE id = r.person_id;
      v_count := v_count + 1;
    END IF;
  END LOOP;

  RAISE NOTICE 'assigned a template to % people (% combined template(s) created)',
               v_count, v_created;
END $mig$;

-- Name everyone whose individual overrides are about to be discarded. Not a
-- failure — see the header — but it must not be silent.
DO $mig$
DECLARE r record; v_count int := 0;
BEGIN
  IF to_regclass('public.person_permissions') IS NULL THEN RETURN; END IF;

  FOR r IN
    SELECT p.family_code, p.first_name, p.last_name, COUNT(*) AS n
      FROM public.person_permissions pp
      JOIN public.people p ON p.id = pp.person_id
     GROUP BY p.family_code, p.first_name, p.last_name
  LOOP
    RAISE NOTICE 'family %: discarding % individual override(s) for % %',
                 r.family_code, r.n, r.first_name, r.last_name;
    v_count := v_count + 1;
  END LOOP;

  IF v_count > 0 THEN
    RAISE NOTICE 'the % person(s) above now hold exactly what their template grants', v_count;
  END IF;
END $mig$;

-- ── 3. Board Users is retired ───────────────────────────────────────────────
-- Its members were moved to whatever §2b chose for them, which for anyone in Board
-- Users and General is decided by the grant count; re-point the ones still on Board
-- Users at General before the row goes, or the RESTRICT foreign key refuses.
DO $mig$
DECLARE v_moved int; v_gone int;
BEGIN
  UPDATE public.people p
     SET permission_template_id = gen.id
    FROM public.permission_templates board
    JOIN public.permission_templates gen
      ON gen.family_code = board.family_code AND gen.name = 'General'
   WHERE board.name = 'Board Users'
     AND p.permission_template_id = board.id;
  GET DIAGNOSTICS v_moved = ROW_COUNT;

  DELETE FROM public.template_permissions tp
   USING public.permission_templates t
   WHERE tp.template_id = t.id AND t.name = 'Board Users';

  DELETE FROM public.permission_templates WHERE name = 'Board Users';
  GET DIAGNOSTICS v_gone = ROW_COUNT;

  RAISE NOTICE 'Board Users: % template(s) removed, % member(s) moved to General', v_gone, v_moved;
END $mig$;

-- ── 4. admin/groups merges into admin/users ─────────────────────────────────
-- Least-permissive wins. See the header for why that direction.
DO $mig$
DECLARE r record; v_narrowed int := 0;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.permission_resources WHERE key = 'admin/groups') THEN
    RAISE NOTICE 'admin/groups already merged';
    RETURN;
  END IF;

  FOR r IN
    WITH rank AS (
      SELECT unnest(ARRAY['none','own','any']::public.permission_scope[]) AS scope,
             generate_series(0, 2) AS n
    ),
    pairs AS (
      SELECT t.id AS template_id, t.family_code, t.name,
             a.action,
             COALESCE(u.scope, 'none') AS users_scope,
             COALESCE(g.scope, 'none') AS groups_scope
        FROM public.permission_templates t
       CROSS JOIN (SELECT unnest(ARRAY['view','create','edit','delete']::public.permission_action[]) AS action) a
        LEFT JOIN public.template_permissions u
               ON u.template_id = t.id AND u.resource_key = 'admin/users'  AND u.action = a.action
        LEFT JOIN public.template_permissions g
               ON g.template_id = t.id AND g.resource_key = 'admin/groups' AND g.action = a.action
    )
    SELECT p.*,
           CASE WHEN ru.n <= rg.n THEN p.users_scope ELSE p.groups_scope END AS merged
      FROM pairs p
      JOIN rank ru ON ru.scope = p.users_scope
      JOIN rank rg ON rg.scope = p.groups_scope
     WHERE CASE WHEN ru.n <= rg.n THEN p.users_scope ELSE p.groups_scope END
           IS DISTINCT FROM p.users_scope
  LOOP
    INSERT INTO public.template_permissions (template_id, resource_key, action, scope, updated_at)
    VALUES (r.template_id, 'admin/users', r.action, r.merged, NOW())
    ON CONFLICT (template_id, resource_key, action)
      DO UPDATE SET scope = EXCLUDED.scope, updated_at = NOW();

    RAISE NOTICE 'family % template "%": admin/users:% narrowed from % to % (it could not % admin/groups)',
                 r.family_code, r.name, r.action, r.users_scope, r.merged, r.action;
    v_narrowed := v_narrowed + 1;
  END LOOP;

  RAISE NOTICE 'admin/groups merged into admin/users; % grant(s) narrowed', v_narrowed;
END $mig$;

-- ── 5. Every policy naming admin/groups now names admin/users ───────────────
-- Text surgery over pg_policies, the pattern of 20260805000006 §4, and for the same
-- reason: the policies here were COMPOSED at migration time out of pg_policies, so
-- what actually protects these tables is a string that exists in no file. Rewriting
-- what is live is the only way to be sure the rename reached all of it.
--
-- Runs BEFORE the resource row is deleted. A policy calling auth_can() on a key that
-- no longer exists does not error — it falls through to the default, which for 'edit'
-- is 'none', so every permission table in the app would lock at once.
DO $mig$
DECLARE
  p       record;
  v_roles text;
  v_qual  text;
  v_check text;
  v_count int := 0;
BEGIN
  FOR p IN
    SELECT tablename, policyname, cmd, qual, with_check, roles
      FROM pg_policies
     WHERE schemaname = 'public'
       AND (COALESCE(qual, '') LIKE '%admin/groups%'
         OR COALESCE(with_check, '') LIKE '%admin/groups%')
  LOOP
    v_roles := array_to_string(p.roles, ', ');
    v_qual  := CASE WHEN p.qual IS NULL THEN NULL
                    ELSE replace(p.qual, 'admin/groups', 'admin/users') END;
    v_check := CASE WHEN p.with_check IS NULL THEN NULL
                    ELSE replace(p.with_check, 'admin/groups', 'admin/users') END;

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

    v_count := v_count + 1;
  END LOOP;

  RAISE NOTICE 'repointed % policy(ies) from admin/groups to admin/users', v_count;
END $mig$;

-- The resource itself. Deleting it cascades template_permissions.resource_key and
-- resource_visibility.resource_key, which is the point: those grants now decide
-- nothing and a row nobody can reach is a row somebody will later misread.
DELETE FROM public.permission_resources WHERE key = 'admin/groups';

UPDATE public.permission_resources
   SET label = 'Members & Access'
 WHERE key = 'admin/users';

-- ── 6. RLS on the renamed tables, under their new names ─────────────────────
-- Rebuilt longhand rather than left to §5's surgery, because the POLICY NAMES still
-- say "group" and the tables they guard no longer exist under that word. The
-- `auth_membership_approved()` conjunct is reproduced deliberately: 20260806000011 §6
-- swept it onto both of these tables, and dropping the policies here would quietly
-- undo that sweep and re-admit a pending applicant to the family's permission map.
DO $mig$
DECLARE p record;
BEGIN
  FOR p IN
    SELECT tablename, policyname FROM pg_policies
     WHERE schemaname = 'public'
       AND tablename IN ('permission_templates', 'template_permissions')
  LOOP
    EXECUTE format('DROP POLICY %I ON public.%I', p.policyname, p.tablename);
  END LOOP;
END $mig$;

CREATE POLICY "templates readable in family"
  ON public.permission_templates FOR SELECT TO authenticated
  USING (family_code = public.auth_family_code() AND public.auth_membership_approved());

CREATE POLICY "templates managed by admins"
  ON public.permission_templates FOR ALL TO authenticated
  USING      (family_code = public.auth_family_code()
              AND public.auth_can('admin/users', 'edit')
              AND public.auth_membership_approved())
  WITH CHECK (family_code = public.auth_family_code()
              AND public.auth_can('admin/users', 'edit')
              AND public.auth_membership_approved());

CREATE POLICY "template permissions readable in family"
  ON public.template_permissions FOR SELECT TO authenticated
  USING (EXISTS (
           SELECT 1 FROM public.permission_templates t
            WHERE t.id = template_id AND t.family_code = public.auth_family_code())
         AND public.auth_membership_approved());

CREATE POLICY "template permissions managed by admins"
  ON public.template_permissions FOR ALL TO authenticated
  USING (
    public.auth_can('admin/users', 'edit')
    AND EXISTS (SELECT 1 FROM public.permission_templates t
                 WHERE t.id = template_id AND t.family_code = public.auth_family_code())
    AND public.auth_membership_approved()
  )
  WITH CHECK (
    public.auth_can('admin/users', 'edit')
    AND EXISTS (SELECT 1 FROM public.permission_templates t
                 WHERE t.id = template_id AND t.family_code = public.auth_family_code())
    AND public.auth_membership_approved()
  );

-- ── 7. Materialize every grid ───────────────────────────────────────────────
-- The grid on a template is now the complete answer to "what may these people do",
-- and it can only be that if it has a row for every resource and action. Where a
-- template says nothing today, the effective answer comes from resource_visibility
-- for 'view' and from "fails closed" for the rest; this writes that answer down.
--
-- ON CONFLICT DO NOTHING, so a grant a family actually configured always wins over
-- the computed default. Behaviour is therefore identical the moment this commits —
-- what changes is that the screen can now show the whole truth without explaining a
-- fall-through rule to the reader.
--
-- resource_visibility survives as the default for a person with NO template (an
-- unseeded family, a relative who was later linked to an account) and for a resource
-- registered by a future migration, which existing templates will have no row for.
INSERT INTO public.template_permissions (template_id, resource_key, action, scope)
SELECT t.id, pr.key, a::public.permission_action,
       CASE
         WHEN a = 'view' THEN
           CASE WHEN COALESCE(
                      (SELECT rv.visibility FROM public.resource_visibility rv
                        WHERE rv.family_code = t.family_code AND rv.resource_key = pr.key),
                      'everyone') = 'everyone'
                THEN 'any'::public.permission_scope
                ELSE 'none'::public.permission_scope
           END
         ELSE 'none'::public.permission_scope
       END
  FROM public.permission_templates t
 CROSS JOIN public.permission_resources pr
 CROSS JOIN LATERAL unnest(pr.actions) AS a
ON CONFLICT (template_id, resource_key, action) DO NOTHING;

-- ── 8. The resolver loses two of its three layers ───────────────────────────
-- One template, read through the person. `t.family_code = v_family` is load-bearing
-- and not defensive noise: permission_template_id is a bare uuid, and a row carrying
-- another family's template must resolve to nothing rather than to that family's
-- grants.
CREATE OR REPLACE FUNCTION public.auth_permission(
  p_resource text,
  p_action   public.permission_action
)
RETURNS public.permission_scope
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_person uuid := public.auth_person_id();
  v_family text := public.auth_family_code();
  v_scope  public.permission_scope;
BEGIN
  -- No approved membership in any family → deny everything. auth_person_id() gates
  -- on membership_status, so a pending, rejected or disabled caller stops here.
  IF v_person IS NULL OR v_family IS NULL THEN
    RETURN 'none';
  END IF;

  SELECT tp.scope INTO v_scope
    FROM public.people p
    JOIN public.permission_templates t
      ON t.id = p.permission_template_id AND t.family_code = v_family
    JOIN public.template_permissions tp
      ON tp.template_id = t.id
   WHERE p.id = v_person
     AND tp.resource_key = p_resource
     AND tp.action = p_action;

  IF v_scope IS NOT NULL THEN
    RETURN v_scope;
  END IF;

  -- Default, for a person with no template and for a resource no template mentions.
  -- Viewing follows the family's page visibility; everything else fails closed.
  IF p_action = 'view' THEN
    RETURN CASE
      WHEN COALESCE(
             (SELECT rv.visibility FROM public.resource_visibility rv
               WHERE rv.family_code = v_family AND rv.resource_key = p_resource),
             'everyone') = 'everyone'
      THEN 'any'::public.permission_scope
      ELSE 'none'::public.permission_scope
    END;
  END IF;

  RETURN 'none';
END $$;

-- ── 9. 'disabled', and the guard on the new column ──────────────────────────
-- A fourth membership_status rather than a separate boolean, because everything that
-- gates on membership already tests POSITIVELY for 'approved' — auth_person_id(),
-- auth_membership_approved(), isApproved() in TypeScript. Adding a value they do not
-- recognise denies by construction, across every policy at once, with no sweep.
DO $mig$ BEGIN
  ALTER TABLE public.people DROP CONSTRAINT IF EXISTS people_membership_status_valid;
  ALTER TABLE public.people
    ADD CONSTRAINT people_membership_status_valid
    CHECK (membership_status IN ('pending', 'approved', 'rejected', 'disabled'));
END $mig$;

COMMENT ON COLUMN public.people.membership_status IS
  'approved | pending | rejected | disabled. Gates auth_person_id(), so anything but '
  '''approved'' holds no permissions anywhere in the app. Set by the stamp trigger on '
  'insert and thereafter only by set_membership_status() or set_member_enabled().';

-- Exactly the argument of 20260806000011 §2b, applied to the column that has just
-- become the most valuable one on the row. The `people` UPDATE policy admits a
-- member's write to their OWN row — it must, or nobody could edit their profile — and
-- a policy is a predicate over the row with no opinion about which column changed. So
--
--     saveProfileSection({ permission_template_id: <the Administrators id> })
--
-- would be a self-promotion that every policy in the database is satisfied by, because
-- the row really is theirs. lib/profile-columns.ts allow-lists what a profile write may
-- touch and does not list this column; this is the half that does not depend on that
-- list staying right.
--
-- SECURITY INVOKER deliberately, for 20260806000011's reason: inside a DEFINER body
-- current_user is the owner for every caller alike, and this trigger's whole job is to
-- tell 'authenticated' apart from apply_permission_template() (which runs as the
-- function owner) and from the service role.
CREATE OR REPLACE FUNCTION public.tg_person_guard_permission_template()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
BEGIN
  IF NEW.permission_template_id IS DISTINCT FROM OLD.permission_template_id
     AND current_user = 'authenticated' THEN
    RAISE EXCEPTION
      'permission_template_id may only be changed through apply_permission_template()'
      USING ERRCODE = 'insufficient_privilege';
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS people_guard_permission_template ON public.people;
CREATE TRIGGER people_guard_permission_template
  BEFORE UPDATE OF permission_template_id ON public.people
  FOR EACH ROW EXECUTE FUNCTION public.tg_person_guard_permission_template();

-- ── 10. The two person-level RPCs ───────────────────────────────────────────
-- Both are SECURITY DEFINER and both are CALLED ON THE USER CLIENT — createClient(),
-- never createAdminClient(). Their authorization is derived from auth.uid(), which the
-- service role does not have, so an admin-client call would evaluate every check
-- against NULL. Each therefore refuses a NULL auth.uid() outright, so that mistake
-- fails loudly instead of sailing through.

-- "Does the family still have somebody who can administer it?" — the one invariant
-- both RPCs and the template screens have to preserve. A family that loses its last
-- administrator cannot get one back from any UI it can still reach.
--
-- Counts only APPROVED, user-linked people whose template grants admin/users:edit.
-- p_excluding_person is the row the caller is about to change, considered separately.
CREATE OR REPLACE FUNCTION public.family_has_other_admin(
  p_family_code      text,
  p_excluding_person uuid
)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT EXISTS (
    SELECT 1
      FROM public.people p
      JOIN public.permission_templates t  ON t.id = p.permission_template_id
                                         AND t.family_code = p.family_code
      JOIN public.template_permissions tp ON tp.template_id = t.id
     WHERE p.family_code = p_family_code
       AND p.user_id IS NOT NULL
       AND p.membership_status = 'approved'
       AND p.id IS DISTINCT FROM p_excluding_person
       AND tp.resource_key = 'admin/users'
       AND tp.action = 'edit'
       AND tp.scope <> 'none'
  );
$$;

-- 10a. Put one member on one template.
CREATE OR REPLACE FUNCTION public.apply_permission_template(
  p_person_id   uuid,
  p_template_id uuid
)
RETURNS TABLE (ok boolean, message text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_user     uuid := (SELECT auth.uid());
  v_family   text;
  v_target   public.people;
  v_template public.permission_templates;
  v_grants   boolean;
BEGIN
  IF v_user IS NULL THEN
    RETURN QUERY SELECT false, 'Not authenticated'; RETURN;
  END IF;

  -- canAny, not can: assigning permissions has no coherent "own" version. The row a
  -- member would own is their own access, and raising it is the abuse case.
  IF public.auth_permission('admin/users', 'edit') <> 'any' THEN
    RETURN QUERY SELECT false, 'Not authorized'; RETURN;
  END IF;

  v_family := public.auth_family_code();
  IF v_family IS NULL THEN
    RETURN QUERY SELECT false, 'Not authorized'; RETURN;
  END IF;

  -- Both ids arrive from the client and are used against a definer function, so both
  -- are checked into the CALLER's family — never the family implied by the id.
  SELECT * INTO v_target FROM public.people WHERE id = p_person_id;
  IF NOT FOUND OR v_target.family_code IS DISTINCT FROM v_family THEN
    RETURN QUERY SELECT false, 'Member not found'; RETURN;
  END IF;
  IF v_target.user_id IS NULL THEN
    RETURN QUERY SELECT false, 'That person has no account, so there is nothing to grant'; RETURN;
  END IF;

  SELECT * INTO v_template FROM public.permission_templates WHERE id = p_template_id;
  IF NOT FOUND OR v_template.family_code IS DISTINCT FROM v_family THEN
    RETURN QUERY SELECT false, 'Template not found'; RETURN;
  END IF;

  IF v_target.permission_template_id IS NOT DISTINCT FROM p_template_id THEN
    RETURN QUERY SELECT true, NULL::text; RETURN;
  END IF;

  -- Would this be the move that leaves nobody able to administer the family? Asked
  -- about the incoming template, so re-assigning the last administrator to another
  -- administrative template is allowed and demoting them is not.
  SELECT EXISTS (
    SELECT 1 FROM public.template_permissions tp
     WHERE tp.template_id = p_template_id
       AND tp.resource_key = 'admin/users' AND tp.action = 'edit' AND tp.scope <> 'none'
  ) INTO v_grants;

  IF NOT v_grants
     AND v_target.membership_status = 'approved'
     AND NOT public.family_has_other_admin(v_family, p_person_id) THEN
    RETURN QUERY SELECT false,
      'That would leave the family with nobody who can manage access. '
      'Put someone else on an administrator template first.';
    RETURN;
  END IF;

  UPDATE public.people
     SET permission_template_id = p_template_id
   WHERE id = p_person_id;

  RETURN QUERY SELECT true, NULL::text;
END $$;

-- 10b. Disable or re-enable a member.
--
-- A SEPARATE RPC from set_membership_status(), not a fourth value passed to it, and
-- the reason is the grant rather than tidiness: admitting a stranger to the family is
-- governed by admin/approvals and revoking a member's access by admin/users. One
-- function taking both would have to hold both grants or accept the weaker, and a
-- family that has split those two jobs between two templates would find it had split
-- nothing.
--
-- Moves only between 'approved' and 'disabled'. A pending or rejected applicant is
-- Member Approvals' business; letting this endpoint touch them would be a second,
-- ungated route to admission.
CREATE OR REPLACE FUNCTION public.set_member_enabled(
  p_person_id uuid,
  p_enabled   boolean
)
RETURNS TABLE (ok boolean, message text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_user   uuid := (SELECT auth.uid());
  v_family text;
  v_target public.people;
  v_want   text := CASE WHEN p_enabled THEN 'approved' ELSE 'disabled' END;
BEGIN
  IF v_user IS NULL THEN
    RETURN QUERY SELECT false, 'Not authenticated'; RETURN;
  END IF;

  IF public.auth_permission('admin/users', 'edit') <> 'any' THEN
    RETURN QUERY SELECT false, 'Not authorized'; RETURN;
  END IF;

  v_family := public.auth_family_code();
  IF v_family IS NULL THEN
    RETURN QUERY SELECT false, 'Not authorized'; RETURN;
  END IF;

  SELECT * INTO v_target FROM public.people WHERE id = p_person_id;
  IF NOT FOUND OR v_target.family_code IS DISTINCT FROM v_family THEN
    RETURN QUERY SELECT false, 'Member not found'; RETURN;
  END IF;

  IF v_target.user_id = v_user THEN
    RETURN QUERY SELECT false, 'You cannot disable your own access'; RETURN;
  END IF;

  IF v_target.membership_status NOT IN ('approved', 'disabled') THEN
    RETURN QUERY SELECT false,
      'That request is still awaiting a decision. Use Member Approvals.'; RETURN;
  END IF;

  IF v_target.membership_status = v_want THEN
    RETURN QUERY SELECT true, NULL::text; RETURN;
  END IF;

  IF NOT p_enabled AND NOT public.family_has_other_admin(v_family, p_person_id) THEN
    RETURN QUERY SELECT false,
      'That would leave the family with nobody who can manage access. '
      'Put someone else on an administrator template first.';
    RETURN;
  END IF;

  UPDATE public.people
     SET membership_status     = v_want,
         membership_decided_at = NOW(),
         membership_decided_by = v_user
   WHERE id = p_person_id;

  RETURN QUERY SELECT true, NULL::text;
END $$;

-- Grants. Default privileges since 20260806000015 revoke EXECUTE from anon and
-- authenticated, so a new function is unreachable from the browser until a migration
-- grants it — and these three are all called with the user client.
-- family_has_other_admin() is granted because both RPCs above call it, and a call from
-- inside a definer body runs as THAT function's owner rather than the caller, so
-- strictly it needs nothing; it is granted anyway because the actions read it directly
-- to render the UI honestly.
REVOKE ALL ON FUNCTION public.family_has_other_admin(text, uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.apply_permission_template(uuid, uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.set_member_enabled(uuid, boolean) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.family_has_other_admin(text, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.apply_permission_template(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.set_member_enabled(uuid, boolean) TO authenticated;

-- ── 11. Seeding: a new family gets two templates ────────────────────────────
-- Replaces seed_family_system_groups(), which is dropped in §12. Both of its gates
-- are reproduced verbatim from 20260806000016, and must be: that function was
-- callable with the ANON key, and its ON CONFLICT DO NOTHING inserts made an
-- unauthenticated call a way to RESTORE an administrative grant somebody had
-- deliberately deleted. A rename is not a reason to re-open that.
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

  -- Admin pages start restricted. This is what makes the General grid below deny
  -- them, and it stays the default for any resource a later migration adds.
  INSERT INTO public.resource_visibility (family_code, resource_key, visibility)
  SELECT p_family_code, pr.key, 'restricted'
    FROM public.permission_resources pr
   WHERE pr.category = 'admin'
  ON CONFLICT (family_code, resource_key) DO NOTHING;

  -- Administrators: 'any' on every action each resource actually declares.
  -- unnest(pr.actions) rather than the full enum, so a section that cannot be created
  -- does not carry a create grant nobody can use.
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
      ('account-summary', 'view'::public.permission_action, 'own'::public.permission_scope),
      ('chat',            'create', 'any'),
      ('chat',            'edit',   'own'),
      ('chat',            'delete', 'own'),
      ('photos',          'create', 'any'),
      ('photos',          'edit',   'own')
    ) AS t(k, act, sc)
   WHERE EXISTS (SELECT 1 FROM public.permission_resources pr WHERE pr.key = t.k)
  ON CONFLICT (template_id, resource_key, action) DO NOTHING;

  INSERT INTO public.template_permissions (template_id, resource_key, action, scope)
  SELECT v_general, pr.key, a::public.permission_action,
         CASE
           WHEN a = 'view' AND pr.category <> 'admin' THEN 'any'::public.permission_scope
           ELSE 'none'::public.permission_scope
         END
    FROM public.permission_resources pr
   CROSS JOIN LATERAL unnest(pr.actions) AS a
  ON CONFLICT (template_id, resource_key, action) DO NOTHING;
END $$;

REVOKE ALL ON FUNCTION public.seed_family_permission_templates(text) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.tg_family_seed_permission_templates()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  PERFORM public.seed_family_permission_templates(NEW.family_code);
  RETURN NULL;
END $$;

DROP TRIGGER IF EXISTS families_seed_system_groups ON public.families;
DROP TRIGGER IF EXISTS families_seed_permission_templates ON public.families;
CREATE TRIGGER families_seed_permission_templates
  AFTER INSERT ON public.families
  FOR EACH ROW EXECUTE FUNCTION public.tg_family_seed_permission_templates();

-- Give each newly linked person their default template. BEFORE rather than AFTER,
-- because the assignment is now a column on the row being written rather than a row
-- in another table — so it costs no second statement and cannot race the insert.
--
-- ON INSERT *AND* ON UPDATE OF user_id, for 20260806000008's reason: becoming a member
-- is not always an insert. register.ts join-mode claims an unlinked row matching the
-- email, and link-person.ts moves user_id onto a pre-existing relative's row. An
-- INSERT-only trigger would leave both of those members with no template at all.
--
-- The guard trigger of §9 does not fire on either path: `BEFORE UPDATE OF col` fires
-- only when the column is named in the statement's SET list, and neither of those
-- writes names permission_template_id.
CREATE OR REPLACE FUNCTION public.tg_person_default_permission_template()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_name text := 'General';
BEGIN
  IF NEW.permission_template_id IS NOT NULL THEN
    RETURN NEW;
  END IF;

  -- The founder, recognised as families.created_by. Testing for the founder rather
  -- than "this family has no administrator yet" keeps the trigger inert for a fixture
  -- that inserts a family without a created_by — which is what tests/rls does, and a
  -- "first member wins" rule would silently promote its plain member.
  IF EXISTS (
    SELECT 1 FROM public.families f
     WHERE f.family_code = NEW.family_code
       AND f.created_by IS NOT NULL
       AND f.created_by = NEW.user_id
  ) THEN
    v_name := 'Administrators';
  END IF;

  SELECT id INTO NEW.permission_template_id
    FROM public.permission_templates
   WHERE family_code = NEW.family_code AND name = v_name;

  -- Still NULL means the family was never seeded. Leaving it NULL is the honest
  -- answer: auth_permission() then falls to resource_visibility, which is exactly
  -- what an unseeded family did before any of this existed.
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS people_join_system_groups ON public.people;
DROP TRIGGER IF EXISTS people_link_join_system_groups ON public.people;
DROP TRIGGER IF EXISTS people_default_permission_template ON public.people;
DROP TRIGGER IF EXISTS people_link_default_permission_template ON public.people;

CREATE TRIGGER people_default_permission_template
  BEFORE INSERT ON public.people
  FOR EACH ROW WHEN (NEW.user_id IS NOT NULL)
  EXECUTE FUNCTION public.tg_person_default_permission_template();

CREATE TRIGGER people_link_default_permission_template
  BEFORE UPDATE OF user_id ON public.people
  FOR EACH ROW WHEN (NEW.user_id IS NOT NULL AND OLD.user_id IS DISTINCT FROM NEW.user_id)
  EXECUTE FUNCTION public.tg_person_default_permission_template();

-- set_membership_status() put an approved applicant into the General GROUP. Same
-- belt-and-braces, expressed as a template: normally a no-op, because the trigger
-- above assigned one when the row was inserted. Reproduced from 20260806000011 §7c
-- with only that tail changed.
CREATE OR REPLACE FUNCTION public.set_membership_status(
  p_person_id uuid,
  p_status    text,
  p_note      text DEFAULT NULL
)
RETURNS TABLE (ok boolean, message text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_user   uuid := (SELECT auth.uid());
  v_family text;
  v_target public.people;
BEGIN
  IF v_user IS NULL THEN
    RETURN QUERY SELECT false, 'Not authenticated'; RETURN;
  END IF;

  IF p_status IS NULL OR p_status NOT IN ('approved', 'rejected') THEN
    RETURN QUERY SELECT false, 'Unknown membership status'; RETURN;
  END IF;

  IF public.auth_permission('admin/approvals', 'edit') <> 'any' THEN
    RETURN QUERY SELECT false, 'Not authorized'; RETURN;
  END IF;

  v_family := public.auth_family_code();
  IF v_family IS NULL THEN
    RETURN QUERY SELECT false, 'Not authorized'; RETURN;
  END IF;

  SELECT * INTO v_target FROM public.people WHERE id = p_person_id;
  IF NOT FOUND OR v_target.family_code IS DISTINCT FROM v_family THEN
    RETURN QUERY SELECT false, 'Applicant not found'; RETURN;
  END IF;

  IF v_target.user_id = v_user THEN
    RETURN QUERY SELECT false, 'You cannot decide your own membership'; RETURN;
  END IF;

  -- A disabled member is not an applicant. Re-admitting them is set_member_enabled()'s
  -- job, under admin/users rather than admin/approvals.
  IF v_target.membership_status = 'disabled' THEN
    RETURN QUERY SELECT false,
      'That member''s access was switched off. Turn it back on from Members & Access.'; RETURN;
  END IF;

  IF v_target.membership_status = p_status THEN
    RETURN QUERY SELECT true, NULL::text; RETURN;
  END IF;

  UPDATE public.people
     SET membership_status     = p_status,
         membership_decided_at = NOW(),
         membership_decided_by = v_user,
         membership_note       = p_note
   WHERE id = p_person_id;

  IF p_status = 'approved' AND v_target.permission_template_id IS NULL THEN
    UPDATE public.people
       SET permission_template_id = (
             SELECT t.id FROM public.permission_templates t
              WHERE t.family_code = v_family AND t.name = 'General')
     WHERE id = p_person_id;
  END IF;

  RETURN QUERY SELECT true, NULL::text;
END $$;

-- ── 12. Backfill the families the trigger never ran for, then drop the old ──
DO $mig$
DECLARE v_family text; v_count int := 0;
BEGIN
  FOR v_family IN
    SELECT code FROM (
      SELECT family_code AS code FROM public.families
      UNION
      SELECT DISTINCT family_code FROM public.people
       WHERE family_code IS NOT NULL AND family_code <> ''
    ) f
     WHERE NOT EXISTS (
       SELECT 1 FROM public.permission_templates t
        WHERE t.family_code = f.code AND t.name IN ('Administrators', 'General'))
  LOOP
    PERFORM public.seed_family_permission_templates(v_family);
    v_count := v_count + 1;
  END LOOP;
  RAISE NOTICE 'seeded templates for % previously unseeded families', v_count;
END $mig$;

-- Anyone still without a template — a family seeded only just now, or a person the
-- §2b backfill found no group for.
UPDATE public.people p
   SET permission_template_id = t.id
  FROM public.permission_templates t
 WHERE t.family_code = p.family_code
   AND t.name = 'General'
   AND p.user_id IS NOT NULL
   AND p.permission_template_id IS NULL;

DROP FUNCTION IF EXISTS public.seed_family_system_groups(text);
DROP FUNCTION IF EXISTS public.tg_family_seed_system_groups();
DROP FUNCTION IF EXISTS public.tg_person_join_system_groups();

-- No CASCADE, deliberately: if something still depends on either of these the DROP
-- must abort the migration rather than quietly take that something with it.
DROP TABLE IF EXISTS public.user_group_members;
DROP TABLE IF EXISTS public.person_permissions;

-- ── 13. Verify ──────────────────────────────────────────────────────────────
-- Reading a migration is not the same as running it, and most of what is above was
-- assembled at migration time out of pg_policies and pg_proc. These assertions are
-- the only thing that can tell "the sweep ran" from "the sweep matched nothing".
DO $mig$
DECLARE
  v_bad  int;
  v_text text;
BEGIN
  -- The renames.
  IF to_regclass('public.permission_templates') IS NULL
     OR to_regclass('public.template_permissions') IS NULL THEN
    RAISE EXCEPTION 'ROLLBACK: the permission tables were not renamed';
  END IF;
  IF to_regclass('public.user_group_members') IS NOT NULL
     OR to_regclass('public.person_permissions') IS NOT NULL THEN
    RAISE EXCEPTION 'ROLLBACK: the old membership/override tables are still present';
  END IF;

  -- The merge. A surviving admin/groups reference anywhere is a policy that now
  -- consults a key with no row, which silently resolves to "denied" for edit.
  IF EXISTS (SELECT 1 FROM public.permission_resources WHERE key = 'admin/groups') THEN
    RAISE EXCEPTION 'ROLLBACK: admin/groups is still registered';
  END IF;

  SELECT string_agg(tablename || '.' || policyname, ', ') INTO v_text
    FROM pg_policies
   WHERE schemaname = 'public'
     AND (COALESCE(qual, '') LIKE '%admin/groups%'
       OR COALESCE(with_check, '') LIKE '%admin/groups%');
  IF v_text IS NOT NULL THEN
    RAISE EXCEPTION 'ROLLBACK: these policies still name admin/groups: %', v_text;
  END IF;

  -- The resolver. Both old layers gone, the template layer present.
  SELECT prosrc INTO v_text FROM pg_proc
   WHERE proname = 'auth_permission' AND pronamespace = 'public'::regnamespace;
  IF v_text LIKE '%user_group_members%' OR v_text LIKE '%person_permissions%' THEN
    RAISE EXCEPTION 'ROLLBACK: auth_permission() still reads the group or override layer';
  END IF;
  IF v_text NOT LIKE '%template_permissions%' THEN
    RAISE EXCEPTION 'ROLLBACK: auth_permission() does not read template_permissions';
  END IF;

  -- The guard of §9. Without it a member can promote themselves through the profile
  -- endpoint, which is not a lesser failure than a missing policy.
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger
     WHERE tgrelid = 'public.people'::regclass
       AND tgname = 'people_guard_permission_template' AND NOT tgisinternal
  ) THEN
    RAISE EXCEPTION 'ROLLBACK: people_guard_permission_template is missing';
  END IF;
  IF (SELECT prosecdef FROM pg_proc
       WHERE proname = 'tg_person_guard_permission_template'
         AND pronamespace = 'public'::regnamespace) THEN
    RAISE EXCEPTION
      'ROLLBACK: tg_person_guard_permission_template is SECURITY DEFINER — it cannot then '
      'tell an authenticated caller from apply_permission_template(), and admits both';
  END IF;

  -- 'disabled' is accepted by the CHECK constraint. Asserted rather than assumed:
  -- set_member_enabled() writes it, and a constraint that refuses it would turn every
  -- disable into a 500 at the first real use.
  BEGIN
    PERFORM 1 WHERE 'disabled' IN ('pending', 'approved', 'rejected', 'disabled');
    SELECT COUNT(*) INTO v_bad
      FROM pg_constraint
     WHERE conrelid = 'public.people'::regclass
       AND conname = 'people_membership_status_valid'
       AND pg_get_constraintdef(oid) LIKE '%disabled%';
    IF v_bad <> 1 THEN
      RAISE EXCEPTION 'ROLLBACK: people_membership_status_valid does not admit ''disabled''';
    END IF;
  END;

  -- The RPCs exist and are reachable by the role that calls them. A function the
  -- browser cannot execute is the failure mode 20260806000015 exists to catch, and it
  -- presents as a permission-denied at the first click rather than at deploy.
  FOREACH v_text IN ARRAY ARRAY['apply_permission_template', 'set_member_enabled',
                                'family_has_other_admin', 'seed_family_permission_templates'] LOOP
    IF NOT EXISTS (SELECT 1 FROM pg_proc
                    WHERE proname = v_text AND pronamespace = 'public'::regnamespace) THEN
      RAISE EXCEPTION 'ROLLBACK: %() was not created', v_text;
    END IF;
  END LOOP;

  SELECT COUNT(*) INTO v_bad FROM pg_proc p
   WHERE p.pronamespace = 'public'::regnamespace
     AND p.proname IN ('apply_permission_template', 'set_member_enabled', 'family_has_other_admin')
     AND NOT has_function_privilege('authenticated', p.oid, 'EXECUTE');
  IF v_bad > 0 THEN
    RAISE EXCEPTION 'ROLLBACK: % of the new RPCs are not executable by authenticated', v_bad;
  END IF;

  -- The seeding function must NOT be. It was anon-callable once and that was the
  -- unauthenticated re-grant of 20260806000015.
  IF has_function_privilege('anon', 'public.seed_family_permission_templates(text)', 'EXECUTE')
     OR has_function_privilege('authenticated', 'public.seed_family_permission_templates(text)', 'EXECUTE') THEN
    RAISE EXCEPTION 'ROLLBACK: seed_family_permission_templates() is callable from the browser';
  END IF;

  -- Nobody was stranded. Every user-linked, approved person has a template, and every
  -- family with such a person still has somebody who can administer it.
  SELECT COUNT(*) INTO v_bad
    FROM public.people p
   WHERE p.user_id IS NOT NULL
     AND p.membership_status = 'approved'
     AND p.family_code IS NOT NULL AND p.family_code <> ''
     AND p.permission_template_id IS NULL;
  IF v_bad > 0 THEN
    RAISE EXCEPTION 'ROLLBACK: % approved member(s) have no permission template', v_bad;
  END IF;

  SELECT COUNT(*) INTO v_bad
    FROM (SELECT DISTINCT family_code AS code FROM public.people
           WHERE user_id IS NOT NULL AND membership_status = 'approved'
             AND family_code IS NOT NULL AND family_code <> '') f
   WHERE NOT public.family_has_other_admin(f.code, NULL);
  IF v_bad > 0 THEN
    RAISE EXCEPTION 'ROLLBACK: % family(ies) came out of this with no administrator', v_bad;
  END IF;

  -- Board Users is gone everywhere.
  SELECT COUNT(*) INTO v_bad FROM public.permission_templates WHERE name = 'Board Users';
  IF v_bad > 0 THEN
    RAISE EXCEPTION 'ROLLBACK: % Board Users template(s) survived', v_bad;
  END IF;

  -- The founder path, asserted in the two halves it splits into. 20260806000012's
  -- verify block used to exercise this end to end by inserting a throwaway family;
  -- it could, because the outcome it checked was a user_group_members row. The
  -- outcome now lives on `people`, whose user_id is a foreign key into auth.users —
  -- and a migration has no account to fabricate. So:
  --
  --   asserted here, unconditionally   the mechanism exists and keys on created_by
  --   asserted in tests/rls            the outcome, against real accounts, in the
  --                                    case named "founder lands on Administrators"
  --
  -- What is NOT done is wrap the whole thing in `IF EXISTS (SELECT 1 FROM auth.users)`
  -- and call the skip a pass. That is the exact shape 20260806000012 shipped and
  -- AGENTS.md records: a fresh database reported success over a path nothing ran.
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger
     WHERE tgrelid = 'public.people'::regclass
       AND tgname IN ('people_default_permission_template',
                      'people_link_default_permission_template')
       AND NOT tgisinternal
     HAVING COUNT(*) = 2
  ) THEN
    RAISE EXCEPTION
      'ROLLBACK: the default-template triggers are missing — a new member would join '
      'with no template at all';
  END IF;

  SELECT prosrc INTO v_text FROM pg_proc
   WHERE proname = 'tg_person_default_permission_template'
     AND pronamespace = 'public'::regnamespace;
  IF v_text NOT LIKE '%created_by%' OR v_text NOT LIKE '%Administrators%' THEN
    RAISE EXCEPTION
      'ROLLBACK: the default-template trigger no longer recognises the founder, so a '
      'new family would be created with nobody able to administer it';
  END IF;

  -- The trigger seeds from these two names, so a rename in one place and not the
  -- other produces exactly that same unadministerable family, silently.
  SELECT prosrc INTO v_text FROM pg_proc
   WHERE proname = 'seed_family_permission_templates'
     AND pronamespace = 'public'::regnamespace;
  IF v_text NOT LIKE '%''Administrators''%' OR v_text NOT LIKE '%''General''%' THEN
    RAISE EXCEPTION 'ROLLBACK: the seeding function no longer creates both templates';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM auth.users LIMIT 1) THEN
    RAISE NOTICE
      'SKIPPED (no accounts in this database): the founder-becomes-administrator path '
      'was checked structurally above but not exercised. tests/rls covers it — run '
      '`npm run test:rls` before trusting this deploy.';
  END IF;
END $mig$;

COMMIT;
