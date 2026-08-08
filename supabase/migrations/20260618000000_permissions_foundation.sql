-- ============================================================================
-- Authorization rebuild, pass 1 of 4: the permission model.
--
-- REPLACES
--   people.is_admin / people.can_approve booleans and the ad-hoc assertAdmin()
--   checks scattered through the server actions. Those columns are NOT dropped
--   here — code still reads them until pass 2 switches over. Pass 4 drops them.
--
-- MODEL
--   resource            a permissionable page, keyed to lib/features.ts
--   user_groups         created dynamically per family by an administrator
--   user_group_members  which people are in a group
--   group_permissions   the group's policy: per resource, per action, a scope
--   person_permissions  an individual override for one person
--
-- PRECEDENCE (deliberate — a group policy supersedes an individual grant)
--   1. If ANY of the caller's groups states a scope for (resource, action),
--      the groups decide and the individual row is ignored entirely.
--      Across several groups the most permissive wins: any > own > none.
--   2. Otherwise the caller's person_permissions row, if present.
--   3. Otherwise the default: for 'view', whatever resource_visibility says for
--      the family ('everyone' => any, 'restricted' => none); for create / edit /
--      delete, none. Fails closed.
--
--   Scope meaning: 'none' denied · 'own' only rows the caller owns · 'any' all
--   rows in the family. 'create' treats own and any alike.
--
-- EVERYTHING IS FAMILY-SCOPED. A person is a (user, family) pair, so the same
-- login can be an administrator in one family and a general member in another.
--
-- IDEMPOTENT: safe to run more than once.
--
-- USAGE
--   psql "$DATABASE_URL" -f 20260618000000_permissions_foundation.sql
-- ============================================================================

BEGIN;

-- ── Enums ───────────────────────────────────────────────────────────────────
DO $$ BEGIN
  CREATE TYPE public.permission_action AS ENUM ('view', 'create', 'edit', 'delete');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.permission_scope AS ENUM ('none', 'own', 'any');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ── Resource catalog ────────────────────────────────────────────────────────
-- Keys mirror lib/features.ts hrefs without the leading slash, so a page and its
-- permissions share one identity. Global (not per-family): the set of pages the
-- product has is the same everywhere; what differs per family is who may use them.
CREATE TABLE IF NOT EXISTS public.permission_resources (
  key        TEXT PRIMARY KEY,
  label      TEXT NOT NULL,
  category   TEXT NOT NULL DEFAULT 'general',
  sort_order INT  NOT NULL DEFAULT 0
);

-- NOTE: Dashboard and the four Personal features (My Profile, My Families, My
-- Children, Family Tree) are deliberately ABSENT from this seed. 20260806000006
-- removed them: they are a member's own things, always viewable, and not something a
-- family administers. An unregistered resource defaults to view 'any' and cannot be
-- restricted, which is the intended behaviour here rather than the usual defect — see
-- that migration for the full argument and for the person_relationships write policies
-- it had to rebuild first. They are omitted here as well as deleted there because this
-- insert is ON CONFLICT DO UPDATE and would otherwise resurrect them on replay.
INSERT INTO public.permission_resources (key, label, category, sort_order) VALUES
  ('chat',                'Chat',                   'community',  50),
  ('announcements',       'Announcements',          'community',  60),
  ('members',             'Member Directory',       'community',  70),
  ('events',              'Events',                 'events',     80),
  ('event-planning',      'Event Planning',         'events',     90),
  ('account-summary',     'My Summary',             'accounting', 100),
  ('dues',                'Dues',                   'accounting', 110),
  ('transactions',        'Transactions',           'accounting', 115),
  ('family-finances',     'Family Finances',        'accounting', 120),
  ('photos',              'Photos',                 'resources',  130),
  ('documents',           'Documents',              'resources',  140),
  ('elections',           'Elections',              'resources',  150),
  -- Renamed by 20260807000000, which merged Groups & Permissions into this page:
  -- one template per member replaced group membership plus per-person overrides, so
  -- the two screens became one. The label is updated here as well as there because
  -- this insert is ON CONFLICT DO UPDATE and would otherwise revert it on replay.
  ('admin/users',         'Members & Access',       'admin',      160),
  -- Added by 20260806000010 (Phase 3, join-by-code). Listed here as well as there
  -- because this insert is ON CONFLICT DO UPDATE and a replay would otherwise leave
  -- the key registered only by the later file — harmless in itself, but the seeding
  -- and visibility loops at the foot of THIS file are what give a fresh database its
  -- 'restricted' row and its Administrators grant for the key.
  --
  -- Deliberately without the `actions` column: it does not exist until
  -- 20260806000007, so naming it here would abort the chain on an empty database.
  -- The row is created with the default four actions and narrowed to view+edit by
  -- 20260806000010 §1, which does not update `actions` on conflict.
  -- Labelled 'Pending Approval' since 20260808000000 — the caption on its own tab in
  -- Members & Access, which is where the queue has lived since 20260807000000 moved
  -- it off /admin/approvals. Updated here too because this insert is ON CONFLICT DO
  -- UPDATE on label. lib/features.ts still calls the FEATURE "Member Approvals"; that
  -- string names a route which is now a redirect and is rendered nowhere.
  ('admin/approvals',     'Pending Approval',       'admin',      165),
  -- DELETED by 20260807000000, which merges it into admin/users. Left in place here
  -- rather than removed: every policy between this file and that one names it, and
  -- auth_can() on an unregistered key falls through to the default — 'none' for edit —
  -- which would lock every permission table in the app for the length of the chain.
  -- The chain inserts it, uses it, and then deletes it; a replay does the same.
  ('admin/groups',        'Groups & Permissions',   'admin',      170),
  ('admin/chapters',      'Regions & Chapters',     'admin',      180),
  -- Key renamed from 'admin/user-roles' by 20260805000006, together with the route.
  -- The literal is updated here too because this insert is ON CONFLICT DO UPDATE and
  -- would otherwise re-add the old key on replay.
  ('admin/boardpositions','Board Positions',        'admin',      190),
  ('admin/elections',     'Election Management',    'admin',      200),
  ('admin/reports',       'Reports',                'admin',      210),
  ('admin/events',        'Event Management',       'admin',      220),
  ('admin/event-types',   'Event Templates',        'admin',      230),
  ('admin/account',       'Accounting',             'admin',      240),
  ('admin/announcements', 'Announcement Management','admin',      250)
ON CONFLICT (key) DO UPDATE
  SET label = EXCLUDED.label, category = EXCLUDED.category, sort_order = EXCLUDED.sort_order;

-- ── Per-family page visibility default ──────────────────────────────────────
-- 'everyone'   → every member of the family may view the page
-- 'restricted' → only those granted view via a group or individual permission
CREATE TABLE IF NOT EXISTS public.resource_visibility (
  family_code  TEXT NOT NULL,
  resource_key TEXT NOT NULL REFERENCES public.permission_resources(key) ON DELETE CASCADE,
  visibility   TEXT NOT NULL DEFAULT 'everyone' CHECK (visibility IN ('everyone', 'restricted')),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (family_code, resource_key)
);

-- ── Groups ──────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.user_groups (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  family_code TEXT NOT NULL,
  name        TEXT NOT NULL,
  description TEXT,
  -- System groups are seeded and cannot be deleted, but their policy is editable
  -- and members can be added or removed like any other group.
  is_system   BOOLEAN NOT NULL DEFAULT false,
  created_by  UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (family_code, name)
);

-- Membership keys on people.id, not user_id: a person IS a (user, family) pair,
-- so this is inherently scoped to the right family.
CREATE TABLE IF NOT EXISTS public.user_group_members (
  group_id  UUID NOT NULL REFERENCES public.user_groups(id) ON DELETE CASCADE,
  person_id UUID NOT NULL REFERENCES public.people(id)      ON DELETE CASCADE,
  added_by  UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  added_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (group_id, person_id)
);

CREATE INDEX IF NOT EXISTS user_group_members_person_idx ON public.user_group_members (person_id);

-- ── Policies ────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.group_permissions (
  group_id     UUID NOT NULL REFERENCES public.user_groups(id) ON DELETE CASCADE,
  resource_key TEXT NOT NULL REFERENCES public.permission_resources(key) ON DELETE CASCADE,
  action       public.permission_action NOT NULL,
  scope        public.permission_scope  NOT NULL DEFAULT 'none',
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (group_id, resource_key, action)
);

CREATE TABLE IF NOT EXISTS public.person_permissions (
  person_id    UUID NOT NULL REFERENCES public.people(id) ON DELETE CASCADE,
  resource_key TEXT NOT NULL REFERENCES public.permission_resources(key) ON DELETE CASCADE,
  action       public.permission_action NOT NULL,
  scope        public.permission_scope  NOT NULL DEFAULT 'none',
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (person_id, resource_key, action)
);

-- ── Caller identity in the active family ────────────────────────────────────
CREATE OR REPLACE FUNCTION public.auth_person_id()
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT p.id
  FROM public.people p
  WHERE p.user_id = (SELECT auth.uid())
    AND p.family_code = public.auth_family_code()
  LIMIT 1;
$$;

REVOKE ALL ON FUNCTION public.auth_person_id() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.auth_person_id() TO authenticated;

-- ── The resolver ────────────────────────────────────────────────────────────
-- Returns the effective scope for the caller on (resource, action). See the
-- PRECEDENCE note at the top of this file.
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
  -- No membership in any family → deny everything.
  IF v_person IS NULL OR v_family IS NULL THEN
    RETURN 'none';
  END IF;

  -- 1. Group layer. Most permissive across the caller's groups; if any group
  --    states a scope at all, it supersedes the individual row. Resolved with an
  --    explicit CASE rather than MAX(): the enum's text ordering would be
  --    alphabetical ('any' < 'none' < 'own'), which is not the precedence we want.
  SELECT CASE
           WHEN bool_or(gp.scope = 'any') THEN 'any'
           WHEN bool_or(gp.scope = 'own') THEN 'own'
           WHEN COUNT(*) > 0              THEN 'none'
           ELSE NULL
         END::public.permission_scope
    INTO v_scope
  FROM public.user_group_members m
  JOIN public.user_groups        g  ON g.id = m.group_id AND g.family_code = v_family
  JOIN public.group_permissions  gp ON gp.group_id = g.id
  WHERE m.person_id = v_person
    AND gp.resource_key = p_resource
    AND gp.action = p_action;

  IF v_scope IS NOT NULL THEN
    RETURN v_scope;
  END IF;

  -- 2. Individual override.
  SELECT pp.scope INTO v_scope
  FROM public.person_permissions pp
  WHERE pp.person_id = v_person
    AND pp.resource_key = p_resource
    AND pp.action = p_action;

  IF v_scope IS NOT NULL THEN
    RETURN v_scope;
  END IF;

  -- 3. Default. Viewing follows the family's page visibility; everything else
  --    fails closed.
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

REVOKE ALL ON FUNCTION public.auth_permission(text, public.permission_action) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.auth_permission(text, public.permission_action) TO authenticated;

-- ── RLS conveniences ────────────────────────────────────────────────────────
-- Any access at all (used for view/create and for page gating).
CREATE OR REPLACE FUNCTION public.auth_can(
  p_resource text,
  p_action   public.permission_action
)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT public.auth_permission(p_resource, p_action) <> 'none';
$$;

-- Row-level check honouring own-vs-any. p_owner_person_id is the people.id that
-- owns the row (author_id, recorded_by, person_id, …).
CREATE OR REPLACE FUNCTION public.auth_can_on(
  p_resource        text,
  p_action          public.permission_action,
  p_owner_person_id uuid
)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT CASE public.auth_permission(p_resource, p_action)
           WHEN 'any'  THEN true
           WHEN 'own'  THEN p_owner_person_id IS NOT NULL
                            AND p_owner_person_id = public.auth_person_id()
           ELSE false
         END;
$$;

REVOKE ALL ON FUNCTION public.auth_can(text, public.permission_action) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.auth_can_on(text, public.permission_action, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.auth_can(text, public.permission_action) TO authenticated;
GRANT EXECUTE ON FUNCTION public.auth_can_on(text, public.permission_action, uuid) TO authenticated;

-- ── RLS on the permission tables themselves ─────────────────────────────────
ALTER TABLE public.permission_resources ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.resource_visibility  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_groups          ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_group_members   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.group_permissions    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.person_permissions   ENABLE ROW LEVEL SECURITY;

-- The catalog is reference data: readable by anyone signed in, writable only by
-- the service role (it ships with the product, not with a family).
DROP POLICY IF EXISTS "resources readable" ON public.permission_resources;
CREATE POLICY "resources readable"
  ON public.permission_resources FOR SELECT TO authenticated USING (true);

-- Everything else: readable within your family, writable only by those with
-- edit rights on the admin/groups page. Note the bootstrap in the USING clause —
-- see the seeding section for why a family always has an administrator.
DROP POLICY IF EXISTS "visibility readable in family" ON public.resource_visibility;
CREATE POLICY "visibility readable in family"
  ON public.resource_visibility FOR SELECT TO authenticated
  USING (family_code = public.auth_family_code());

DROP POLICY IF EXISTS "visibility managed by admins" ON public.resource_visibility;
CREATE POLICY "visibility managed by admins"
  ON public.resource_visibility FOR ALL TO authenticated
  USING      (family_code = public.auth_family_code() AND public.auth_can('admin/groups', 'edit'))
  WITH CHECK (family_code = public.auth_family_code() AND public.auth_can('admin/groups', 'edit'));

DROP POLICY IF EXISTS "groups readable in family" ON public.user_groups;
CREATE POLICY "groups readable in family"
  ON public.user_groups FOR SELECT TO authenticated
  USING (family_code = public.auth_family_code());

DROP POLICY IF EXISTS "groups managed by admins" ON public.user_groups;
CREATE POLICY "groups managed by admins"
  ON public.user_groups FOR ALL TO authenticated
  USING      (family_code = public.auth_family_code() AND public.auth_can('admin/groups', 'edit'))
  WITH CHECK (family_code = public.auth_family_code() AND public.auth_can('admin/groups', 'edit'));

DROP POLICY IF EXISTS "group members readable in family" ON public.user_group_members;
CREATE POLICY "group members readable in family"
  ON public.user_group_members FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.user_groups g
    WHERE g.id = group_id AND g.family_code = public.auth_family_code()
  ));

DROP POLICY IF EXISTS "group members managed by admins" ON public.user_group_members;
CREATE POLICY "group members managed by admins"
  ON public.user_group_members FOR ALL TO authenticated
  USING (
    public.auth_can('admin/groups', 'edit')
    AND EXISTS (SELECT 1 FROM public.user_groups g WHERE g.id = group_id AND g.family_code = public.auth_family_code())
  )
  WITH CHECK (
    public.auth_can('admin/groups', 'edit')
    AND EXISTS (SELECT 1 FROM public.user_groups g WHERE g.id = group_id AND g.family_code = public.auth_family_code())
    -- The person must belong to the same family as the group.
    AND EXISTS (
      SELECT 1 FROM public.people p
      WHERE p.id = person_id AND p.family_code = public.auth_family_code()
    )
  );

DROP POLICY IF EXISTS "group permissions readable in family" ON public.group_permissions;
CREATE POLICY "group permissions readable in family"
  ON public.group_permissions FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.user_groups g
    WHERE g.id = group_id AND g.family_code = public.auth_family_code()
  ));

DROP POLICY IF EXISTS "group permissions managed by admins" ON public.group_permissions;
CREATE POLICY "group permissions managed by admins"
  ON public.group_permissions FOR ALL TO authenticated
  USING (
    public.auth_can('admin/groups', 'edit')
    AND EXISTS (SELECT 1 FROM public.user_groups g WHERE g.id = group_id AND g.family_code = public.auth_family_code())
  )
  WITH CHECK (
    public.auth_can('admin/groups', 'edit')
    AND EXISTS (SELECT 1 FROM public.user_groups g WHERE g.id = group_id AND g.family_code = public.auth_family_code())
  );

-- A person may read their own overrides; only admins may write any.
DROP POLICY IF EXISTS "person permissions readable" ON public.person_permissions;
CREATE POLICY "person permissions readable"
  ON public.person_permissions FOR SELECT TO authenticated
  USING (
    person_id = public.auth_person_id()
    OR (
      public.auth_can('admin/groups', 'view')
      AND EXISTS (SELECT 1 FROM public.people p WHERE p.id = person_id AND p.family_code = public.auth_family_code())
    )
  );

DROP POLICY IF EXISTS "person permissions managed by admins" ON public.person_permissions;
CREATE POLICY "person permissions managed by admins"
  ON public.person_permissions FOR ALL TO authenticated
  USING (
    public.auth_can('admin/groups', 'edit')
    AND EXISTS (SELECT 1 FROM public.people p WHERE p.id = person_id AND p.family_code = public.auth_family_code())
  )
  WITH CHECK (
    public.auth_can('admin/groups', 'edit')
    AND EXISTS (SELECT 1 FROM public.people p WHERE p.id = person_id AND p.family_code = public.auth_family_code())
  );

-- ── Seed each family: General / Board Users / Administrators ────────────────
-- Membership is seeded from today's authority (is_admin, held board positions)
-- but is plain data from here on — nothing keeps re-deriving it, so an admin can
-- add and remove freely, exactly as for a group they create themselves.
DO $$
DECLARE
  v_family   text;
  v_admins   uuid;
  v_board    uuid;
  v_general  uuid;
  r          record;
BEGIN
  FOR v_family IN
    SELECT DISTINCT family_code FROM public.people WHERE family_code IS NOT NULL AND family_code <> ''
  LOOP
    INSERT INTO public.user_groups (family_code, name, description, is_system)
    VALUES (v_family, 'Administrators', 'Full access to every page and action.', true)
    ON CONFLICT (family_code, name) DO NOTHING;
    INSERT INTO public.user_groups (family_code, name, description, is_system)
    VALUES (v_family, 'Board Users', 'Officers and appointed positions.', true)
    ON CONFLICT (family_code, name) DO NOTHING;
    INSERT INTO public.user_groups (family_code, name, description, is_system)
    VALUES (v_family, 'General', 'All family members.', true)
    ON CONFLICT (family_code, name) DO NOTHING;

    SELECT id INTO v_admins  FROM public.user_groups WHERE family_code = v_family AND name = 'Administrators';
    SELECT id INTO v_board   FROM public.user_groups WHERE family_code = v_family AND name = 'Board Users';
    SELECT id INTO v_general FROM public.user_groups WHERE family_code = v_family AND name = 'General';

    -- Administrators: 'any' on every resource and action.
    INSERT INTO public.group_permissions (group_id, resource_key, action, scope)
    SELECT v_admins, pr.key, a.action, 'any'
    FROM public.permission_resources pr
    CROSS JOIN (SELECT unnest(enum_range(NULL::public.permission_action)) AS action) a
    ON CONFLICT (group_id, resource_key, action) DO NOTHING;

    -- Board Users: view everything except the admin pages; author their own
    -- announcements, events and photos.
    INSERT INTO public.group_permissions (group_id, resource_key, action, scope)
    SELECT v_board, pr.key, 'view', 'any'
    FROM public.permission_resources pr
    WHERE pr.category <> 'admin'
    ON CONFLICT (group_id, resource_key, action) DO NOTHING;

    INSERT INTO public.group_permissions (group_id, resource_key, action, scope)
    SELECT v_board, k, act, sc
    FROM (VALUES
      ('announcements', 'create'::public.permission_action, 'any'::public.permission_scope),
      ('announcements', 'edit',   'own'),
      ('announcements', 'delete', 'own'),
      ('events',        'create', 'any'),
      ('events',        'edit',   'own'),
      ('photos',        'create', 'any'),
      ('photos',        'edit',   'own'),
      ('admin/reports', 'view',   'any')
    ) AS t(k, act, sc)
    ON CONFLICT (group_id, resource_key, action) DO NOTHING;

    -- General: view the member-facing pages, manage only their own records.
    -- 'general' and 'personal' are listed for completeness but hold no rows since
    -- 20260806000006 — Dashboard and the Personal features are viewable by every
    -- member without a grant, so there is nothing to grant.
    INSERT INTO public.group_permissions (group_id, resource_key, action, scope)
    SELECT v_general, pr.key, 'view', 'any'
    FROM public.permission_resources pr
    WHERE pr.category IN ('general', 'personal', 'community')
    ON CONFLICT (group_id, resource_key, action) DO NOTHING;

    INSERT INTO public.group_permissions (group_id, resource_key, action, scope)
    SELECT v_general, k, act, sc
    FROM (VALUES
      -- 'personal-info' used to carry edit/own here. Removed with the resource in
      -- 20260806000006: group_permissions.resource_key is a foreign key, so seeding a
      -- grant for a key that no longer exists would abort this migration on a fresh
      -- database. Editing your own profile needs no grant now — it never really did.
      ('account-summary', 'view'::public.permission_action,  'own'::public.permission_scope),
      ('chat',            'create', 'any'),
      ('chat',            'edit',   'own'),
      ('chat',            'delete', 'own'),
      ('events',          'view',   'any'),
      ('photos',          'view',   'any'),
      ('photos',          'create', 'any'),
      ('photos',          'edit',   'own'),
      ('documents',       'view',   'any')
    ) AS t(k, act, sc)
    ON CONFLICT (group_id, resource_key, action) DO NOTHING;

    -- Members: every linked person lands in General; admins and officers also
    -- land in their group.
    INSERT INTO public.user_group_members (group_id, person_id)
    SELECT v_general, p.id FROM public.people p
    WHERE p.family_code = v_family AND p.user_id IS NOT NULL
    ON CONFLICT DO NOTHING;

    FOR r IN
      SELECT p.id FROM public.people p
      WHERE p.family_code = v_family AND p.user_id IS NOT NULL AND p.is_admin = true
    LOOP
      INSERT INTO public.user_group_members (group_id, person_id) VALUES (v_admins, r.id)
      ON CONFLICT DO NOTHING;
    END LOOP;

    FOR r IN
      SELECT DISTINCT p.id
      FROM public.people p
      JOIN public.user_roles ur ON ur.user_id = p.user_id AND ur.family_code = p.family_code
      WHERE p.family_code = v_family
    LOOP
      INSERT INTO public.user_group_members (group_id, person_id) VALUES (v_board, r.id)
      ON CONFLICT DO NOTHING;
    END LOOP;

    -- A family with no administrator could never manage permissions again, so
    -- promote the oldest member if is_admin was never set for anyone.
    IF NOT EXISTS (SELECT 1 FROM public.user_group_members WHERE group_id = v_admins) THEN
      INSERT INTO public.user_group_members (group_id, person_id)
      SELECT v_admins, p.id FROM public.people p
      WHERE p.family_code = v_family AND p.user_id IS NOT NULL
      ORDER BY p.created_at ASC, p.id ASC
      LIMIT 1
      ON CONFLICT DO NOTHING;
      RAISE NOTICE 'family %: no is_admin found, promoted oldest member to Administrators', v_family;
    END IF;
  END LOOP;
END $$;

-- Admin pages start restricted; member-facing pages stay open unless an
-- administrator narrows them.
INSERT INTO public.resource_visibility (family_code, resource_key, visibility)
SELECT DISTINCT p.family_code, pr.key, 'restricted'
FROM public.people p
CROSS JOIN public.permission_resources pr
WHERE p.family_code IS NOT NULL AND p.family_code <> ''
  AND pr.category = 'admin'
ON CONFLICT (family_code, resource_key) DO NOTHING;

COMMIT;
