-- ============================================================================
-- Authorization rebuild, pass 3 of 4: put every table's RLS behind the
-- permission model from 20260618000000.
--
-- APPROACH
--   Rather than hand-rewriting ~80 policies (and risking a mistake in one of the
--   family-scoping joins that 20260615000004 carefully got right), this migration
--   COMPOSES: it reads each existing policy's expression out of pg_policies and
--   recreates it as
--
--       (original expression) AND ( self-access OR permission check )
--
--   Two consequences worth being explicit about:
--     * AND can only ever NARROW access. No table can come out of this migration
--       more permissive than it went in, whatever the permission data says.
--     * The existing family scoping is preserved verbatim, so family isolation is
--       untouched — this only adds the per-resource, per-action layer on top.
--
--   FOR ALL policies are split into four (SELECT/INSERT/UPDATE/DELETE) so each
--   can carry the right action check; a single ALL policy cannot.
--
-- SELF ACCESS
--   A member must never lose access to their own identity row, or restricting the
--   Member Directory would lock them out of their own profile. `self_expr` is
--   OR-ed *outside* the permission check for exactly those cases.
--
-- OWNERSHIP
--   `own_expr` is the SQL that makes a row "mine". It differs per table because
--   ownership is sometimes a people.id and sometimes an auth.users id. Where a
--   table has no meaningful owner it is 'false', so a scope of 'own' denies
--   rather than silently behaving like 'any' — it fails closed.
--
-- RE-RUNNABLE: recreated policies are prefixed 'perm:' and skipped on a second
-- pass, so running this twice is a no-op rather than a double-wrap.
--
-- USAGE
--   psql "$DATABASE_URL" -f 20260618000001_permissions_rls_sweep.sql
-- ============================================================================

BEGIN;

-- NOTE: this migration used to register 'notifications' as a permission resource
-- (for the navbar bell) and map the notifications table onto it. Both were removed
-- by 20260805000007 — the resource could not affect access in either direction,
-- because the table's base RLS already restricts every row to its recipient and the
-- permission layer is only ever AND-ed on top. See that migration for the full
-- argument. The insert and the table-map row are deleted here rather than left in
-- place so replaying this migration cannot resurrect the resource.

-- ── Table → resource mapping ────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.permission_table_map (
  table_name   TEXT PRIMARY KEY,
  resource_key TEXT NOT NULL REFERENCES public.permission_resources(key) ON DELETE CASCADE,
  -- SQL boolean over the row: "this row is mine". 'false' = no ownership concept.
  own_expr     TEXT NOT NULL DEFAULT 'false',
  -- SQL boolean OR-ed outside the permission check, for rows a member must always
  -- be able to reach regardless of policy.
  self_expr    TEXT NOT NULL DEFAULT 'false'
);

INSERT INTO public.permission_table_map (table_name, resource_key, own_expr, self_expr) VALUES
  -- identity / directory
  ('people',                      'members',            'user_id = (SELECT auth.uid())',        'user_id = (SELECT auth.uid())'),
  ('adults',                      'members',            'user_id = (SELECT auth.uid())',        'user_id = (SELECT auth.uid())'),
  ('kids',                        'direct-lineage',     'parent_user_id = (SELECT auth.uid())', 'parent_user_id = (SELECT auth.uid())'),
  ('families',                    'dashboard',          'false',                                 'false'),
  ('person_relationships',        'family-tree',        'person_id = public.auth_person_id()',   'false'),
  ('family_ancestors',            'family-tree',        'user_id = (SELECT auth.uid())',         'user_id = (SELECT auth.uid())'),
  ('relationship_types',          'family-tree',        'false',                                 'false'),
  -- org structure
  ('chapters',                    'admin/chapters',     'false',                                 'false'),
  ('regions',                     'admin/chapters',     'false',                                 'false'),
  -- Resource key renamed from 'admin/user-roles' by 20260805000006, in step with the
  -- route move to /admin/boardpositions. The `user_roles` TABLE name is unchanged.
  ('family_roles',                'admin/boardpositions','false',                                'false'),
  ('family_role_exclusions',      'admin/boardpositions','false',                                'false'),
  ('user_roles',                  'admin/boardpositions','user_id = (SELECT auth.uid())',        'user_id = (SELECT auth.uid())'),
  -- chat
  ('chat_rooms',                  'chat',               'created_by = (SELECT auth.uid())',      'false'),
  ('chat_participants',           'chat',               'user_id = (SELECT auth.uid())',         'user_id = (SELECT auth.uid())'),
  ('chat_messages',               'chat',               'sender_id = (SELECT auth.uid())',       'false'),
  -- community
  ('announcements',               'announcements',      'author_id = public.auth_person_id()',   'false'),
  -- notifications is deliberately absent — see the note at the top of this file.
  -- Its base RLS restricts every row to its recipient on its own, so wrapping it in
  -- a permission check added a resource nobody could meaningfully grant or revoke.
  ('documents',                   'documents',          'uploaded_by = public.auth_person_id()', 'false'),
  -- photos
  ('photos',                      'photos',             'uploader_id = public.auth_person_id()', 'false'),
  ('photo_collections',           'photos',             'created_by = public.auth_person_id()',  'false'),
  ('photo_tags',                  'photos',             'tagged_by = public.auth_person_id()',   'false'),
  ('event_photos',                'photos',             'uploader_id = public.auth_person_id()', 'false'),
  -- events
  ('events',                      'events',             'created_by = (SELECT auth.uid())',      'false'),
  ('event_rsvp',                  'events',             'submitted_by = (SELECT auth.uid())',    'submitted_by = (SELECT auth.uid())'),
  ('event_rsvp_attendees',        'events',             'person_id = public.auth_person_id()',   'false'),
  ('event_hotel_bookings',        'events',             'created_by = (SELECT auth.uid())',      'false'),
  ('event_hotel_booking_details', 'events',             'false',                                 'false'),
  ('event_hotel_price_estimates', 'events',             'false',                                 'false'),
  ('event_assignments',           'event-planning',     'assigned_to = (SELECT auth.uid())',     'assigned_to = (SELECT auth.uid())'),
  ('event_types',                 'admin/event-types',  'created_by = (SELECT auth.uid())',      'false'),
  ('event_type_sub_templates',    'admin/event-types',  'false',                                 'false'),
  ('event_blueprint_items',       'admin/event-types',  'created_by = (SELECT auth.uid())',      'false'),
  ('event_budget_items',          'admin/events',       'created_by = public.auth_person_id()',  'false'),
  ('event_expenses',              'admin/events',       'recorded_by = public.auth_person_id()', 'false'),
  -- money
  ('dues_schedules',              'admin/account',      'false',                                 'false'),
  ('dues_member_plans',           'dues',               'person_id = public.auth_person_id()',   'person_id = public.auth_person_id()'),
  ('dues_payments',               'dues',               'person_id = public.auth_person_id()',   'person_id = public.auth_person_id()'),
  ('funds',                       'family-finances',    'created_by = public.auth_person_id()',  'false'),
  ('fund_allocations',            'family-finances',    'created_by = public.auth_person_id()',  'false'),
  ('fund_contributions',          'family-finances',    'recorded_by = public.auth_person_id()', 'false'),
  ('fund_disbursements',          'family-finances',    'person_id = public.auth_person_id()',   'person_id = public.auth_person_id()'),
  ('fund_milestones',             'family-finances',    'false',                                 'false'),
  -- elections
  ('elections',                   'elections',          'created_by = public.auth_person_id()',  'false'),
  ('election_positions',          'elections',          'false',                                 'false'),
  ('election_nominations',        'elections',          'nominated_by = public.auth_person_id()','nominee_id = public.auth_person_id()'),
  ('election_votes',              'elections',          'voter_id = public.auth_person_id()',    'voter_id = public.auth_person_id()')
ON CONFLICT (table_name) DO UPDATE
  SET resource_key = EXCLUDED.resource_key,
      own_expr     = EXCLUDED.own_expr,
      self_expr    = EXCLUDED.self_expr;

ALTER TABLE public.permission_table_map ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "table map readable" ON public.permission_table_map;
CREATE POLICY "table map readable"
  ON public.permission_table_map FOR SELECT TO authenticated USING (true);

-- ── Predicate builder ───────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public._perm_predicate(
  p_resource  text,
  p_action    text,
  p_own_expr  text,
  p_self_expr text
)
RETURNS text
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT format(
    '((%s) OR public.auth_permission(%L, %L::public.permission_action) = ''any''' ||
    ' OR (public.auth_permission(%L, %L::public.permission_action) = ''own'' AND (%s)))',
    p_self_expr, p_resource, p_action, p_resource, p_action, p_own_expr
  );
$$;

-- ── The sweep ───────────────────────────────────────────────────────────────
DO $$
DECLARE
  m           record;
  p           record;
  v_roles     text;
  v_qual      text;
  v_check     text;
  v_new       text;
  v_wrapped   int := 0;
BEGIN
  FOR m IN SELECT * FROM public.permission_table_map ORDER BY table_name LOOP
    -- Skip tables that don't exist in this database (e.g. chat installed separately).
    IF NOT EXISTS (
      SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = m.table_name
    ) THEN
      RAISE NOTICE 'skip %: table not present', m.table_name;
      CONTINUE;
    END IF;

    FOR p IN
      SELECT policyname, cmd, qual, with_check, roles
      FROM pg_policies
      WHERE schemaname = 'public'
        AND tablename = m.table_name
        AND policyname NOT LIKE 'perm:%'     -- already wrapped by a previous run
    LOOP
      v_roles := array_to_string(p.roles, ', ');
      v_qual  := COALESCE(p.qual, 'true');
      v_check := COALESCE(p.with_check, p.qual, 'true');

      IF p.cmd = 'SELECT' THEN
        v_new := format(
          'CREATE POLICY %I ON public.%I FOR SELECT TO %s USING ((%s) AND %s)',
          'perm:' || p.policyname, m.table_name, v_roles, v_qual,
          public._perm_predicate(m.resource_key, 'view', m.own_expr, m.self_expr));
        EXECUTE format('DROP POLICY %I ON public.%I', p.policyname, m.table_name);
        EXECUTE v_new;

      ELSIF p.cmd = 'INSERT' THEN
        v_new := format(
          'CREATE POLICY %I ON public.%I FOR INSERT TO %s WITH CHECK ((%s) AND %s)',
          'perm:' || p.policyname, m.table_name, v_roles, v_check,
          public._perm_predicate(m.resource_key, 'create', m.own_expr, m.self_expr));
        EXECUTE format('DROP POLICY %I ON public.%I', p.policyname, m.table_name);
        EXECUTE v_new;

      ELSIF p.cmd = 'UPDATE' THEN
        v_new := format(
          'CREATE POLICY %I ON public.%I FOR UPDATE TO %s USING ((%s) AND %s) WITH CHECK ((%s) AND %s)',
          'perm:' || p.policyname, m.table_name, v_roles,
          v_qual,  public._perm_predicate(m.resource_key, 'edit', m.own_expr, m.self_expr),
          v_check, public._perm_predicate(m.resource_key, 'edit', m.own_expr, m.self_expr));
        EXECUTE format('DROP POLICY %I ON public.%I', p.policyname, m.table_name);
        EXECUTE v_new;

      ELSIF p.cmd = 'DELETE' THEN
        v_new := format(
          'CREATE POLICY %I ON public.%I FOR DELETE TO %s USING ((%s) AND %s)',
          'perm:' || p.policyname, m.table_name, v_roles, v_qual,
          public._perm_predicate(m.resource_key, 'delete', m.own_expr, m.self_expr));
        EXECUTE format('DROP POLICY %I ON public.%I', p.policyname, m.table_name);
        EXECUTE v_new;

      ELSIF p.cmd = 'ALL' THEN
        -- One ALL policy cannot carry four different action checks; split it.
        EXECUTE format('DROP POLICY %I ON public.%I', p.policyname, m.table_name);
        EXECUTE format(
          'CREATE POLICY %I ON public.%I FOR SELECT TO %s USING ((%s) AND %s)',
          'perm:' || p.policyname || ':select', m.table_name, v_roles, v_qual,
          public._perm_predicate(m.resource_key, 'view', m.own_expr, m.self_expr));
        EXECUTE format(
          'CREATE POLICY %I ON public.%I FOR INSERT TO %s WITH CHECK ((%s) AND %s)',
          'perm:' || p.policyname || ':insert', m.table_name, v_roles, v_check,
          public._perm_predicate(m.resource_key, 'create', m.own_expr, m.self_expr));
        EXECUTE format(
          'CREATE POLICY %I ON public.%I FOR UPDATE TO %s USING ((%s) AND %s) WITH CHECK ((%s) AND %s)',
          'perm:' || p.policyname || ':update', m.table_name, v_roles,
          v_qual,  public._perm_predicate(m.resource_key, 'edit', m.own_expr, m.self_expr),
          v_check, public._perm_predicate(m.resource_key, 'edit', m.own_expr, m.self_expr));
        EXECUTE format(
          'CREATE POLICY %I ON public.%I FOR DELETE TO %s USING ((%s) AND %s)',
          'perm:' || p.policyname || ':delete', m.table_name, v_roles, v_qual,
          public._perm_predicate(m.resource_key, 'delete', m.own_expr, m.self_expr));

      ELSE
        RAISE NOTICE 'skip %.% : unhandled cmd %', m.table_name, p.policyname, p.cmd;
        CONTINUE;
      END IF;

      v_wrapped := v_wrapped + 1;
    END LOOP;
  END LOOP;

  RAISE NOTICE 'permission sweep wrapped % policies', v_wrapped;
END $$;

COMMIT;
