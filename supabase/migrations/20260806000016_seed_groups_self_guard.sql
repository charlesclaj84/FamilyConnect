-- ============================================================================
-- seed_family_system_groups(): guard the function, not just the grant.
--
-- A SEPARATE FILE FROM THE LOCKDOWN, deliberately: reverting the grants must not
-- revert the guard. 20260806000015 closed this from the outside; this closes it
-- from the inside, because the outside has been re-opened twice already —
-- supabase/seed.sql did it on every local reset, and the hosted project does it
-- for reasons that live in Supabase's bootstrap rather than in this repo.
--
-- WHAT IT WAS
--   SECURITY DEFINER, no caller check of any kind. With the ANON key:
--     * `seed_family_system_groups('ZZTOP9')` wrote 3 user_groups + 155
--       group_permissions + 17 resource_visibility rows for a family code that has
--       never existed. `user_groups.family_code` has no foreign key, so every
--       fresh random string wrote another 175 rows.
--     * Its inserts are ON CONFLICT DO NOTHING — idempotent against re-insertion,
--       and no defence whatever against a DELETE. So an anonymous call RESTORED an
--       Administrators / admin/groups / delete = 'any' grant that an administrator
--       had deliberately removed in Groups & Permissions. That is the one that
--       matters: unauthenticated re-grant of an administrative permission.
--
-- WHY current_user CANNOT BE USED
--   Inside a SECURITY DEFINER body current_user is the owner, so it says nothing
--   about who called. Two signals do survive: the JWT `role` claim, and the `role`
--   GUC that PostgREST's SET LOCAL ROLE leaves behind. Measured inside a definer
--   function called by a signed-in user: current_user=postgres, session_user=postgres,
--   role GUC=authenticated.
--
--   The test refuses only on a KNOWN browser-facing role. It fails closed against
--   the browser and open against anything it does not recognise — deliberately, so
--   an unfamiliar role name cannot take production down.
--
-- NEITHER LEGITIMATE CALLER IS AFFECTED
--   * the AFTER INSERT ON families trigger runs at pg_trigger_depth() = 1
--   * 20260806000008's backfill DO block runs as the migration role, role GUC unset
--
-- GATE 2 ACCEPTS A CODE PRESENT IN `people` AS WELL AS `families`, and that is not
-- laziness. 20260806000008's backfill iterates `families UNION people` precisely
-- because a family_code carried only on people rows is a real family — it says so
-- in its own comment. A gate that demanded a `families` row would abort that
-- backfill on replay for exactly the databases it was written to repair. Neither
-- the local nor the hosted database has such a row today (checked), which is what
-- makes this cheap insurance rather than a guess.
--
-- The body below is otherwise reproduced verbatim from 20260806000008 §1.
--
-- IDEMPOTENT.
-- ============================================================================

BEGIN;

CREATE OR REPLACE FUNCTION public.seed_family_system_groups(p_family_code text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_admins  uuid;
  v_board   uuid;
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
      'seed_family_system_groups() is not callable by % — system groups are seeded by the families trigger',
      COALESCE(NULLIF(v_jwt, ''), v_guc)
      USING ERRCODE = 'insufficient_privilege';
  END IF;

  -- Gate 2: the write amplification. Without a foreign key on
  -- user_groups.family_code, any string is otherwise a valid target for 175 rows.
  IF NOT EXISTS (SELECT 1 FROM public.families f WHERE f.family_code = p_family_code)
     AND NOT EXISTS (SELECT 1 FROM public.people p WHERE p.family_code = p_family_code)
  THEN
    RAISE EXCEPTION 'seed_family_system_groups(): no such family %', p_family_code
      USING ERRCODE = 'foreign_key_violation';
  END IF;

  INSERT INTO public.user_groups (family_code, name, description, is_system) VALUES
    (p_family_code, 'Administrators', 'Full access to every page and action.', true),
    (p_family_code, 'Board Users',    'Officers and appointed positions.',     true),
    (p_family_code, 'General',        'All family members.',                   true)
  ON CONFLICT (family_code, name) DO NOTHING;

  SELECT id INTO v_admins  FROM public.user_groups WHERE family_code = p_family_code AND name = 'Administrators';
  SELECT id INTO v_board   FROM public.user_groups WHERE family_code = p_family_code AND name = 'Board Users';
  SELECT id INTO v_general FROM public.user_groups WHERE family_code = p_family_code AND name = 'General';

  INSERT INTO public.group_permissions (group_id, resource_key, action, scope)
  SELECT v_admins, pr.key, a::public.permission_action, 'any'
    FROM public.permission_resources pr
   CROSS JOIN LATERAL unnest(pr.actions) AS a
  ON CONFLICT (group_id, resource_key, action) DO NOTHING;

  INSERT INTO public.group_permissions (group_id, resource_key, action, scope)
  SELECT v_board, pr.key, 'view', 'any'
    FROM public.permission_resources pr
   WHERE pr.category <> 'admin'
  ON CONFLICT (group_id, resource_key, action) DO NOTHING;

  INSERT INTO public.group_permissions (group_id, resource_key, action, scope)
  SELECT v_board, t.k, t.act, t.sc
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
   WHERE EXISTS (SELECT 1 FROM public.permission_resources pr WHERE pr.key = t.k)
  ON CONFLICT (group_id, resource_key, action) DO NOTHING;

  INSERT INTO public.group_permissions (group_id, resource_key, action, scope)
  SELECT v_general, pr.key, 'view', 'any'
    FROM public.permission_resources pr
   WHERE pr.category IN ('general', 'personal', 'community')
  ON CONFLICT (group_id, resource_key, action) DO NOTHING;

  INSERT INTO public.group_permissions (group_id, resource_key, action, scope)
  SELECT v_general, t.k, t.act, t.sc
    FROM (VALUES
      ('account-summary', 'view'::public.permission_action, 'own'::public.permission_scope),
      ('chat',            'create', 'any'),
      ('chat',            'edit',   'own'),
      ('chat',            'delete', 'own'),
      ('events',          'view',   'any'),
      ('photos',          'view',   'any'),
      ('photos',          'create', 'any'),
      ('photos',          'edit',   'own'),
      ('documents',       'view',   'any')
    ) AS t(k, act, sc)
   WHERE EXISTS (SELECT 1 FROM public.permission_resources pr WHERE pr.key = t.k)
  ON CONFLICT (group_id, resource_key, action) DO NOTHING;

  INSERT INTO public.resource_visibility (family_code, resource_key, visibility)
  SELECT p_family_code, pr.key, 'restricted'
    FROM public.permission_resources pr
   WHERE pr.category = 'admin'
  ON CONFLICT (family_code, resource_key) DO NOTHING;
END $$;

REVOKE ALL ON FUNCTION public.seed_family_system_groups(text) FROM PUBLIC, anon, authenticated;

-- ── Verify ──────────────────────────────────────────────────────────────────
DO $mig$
DECLARE v_src text;
BEGIN
  SELECT prosrc INTO v_src FROM pg_proc
   WHERE proname = 'seed_family_system_groups' AND pronamespace = 'public'::regnamespace;

  IF v_src NOT LIKE '%pg_trigger_depth()%' THEN
    RAISE EXCEPTION 'ROLLBACK: seed_family_system_groups() lost its caller gate';
  END IF;
  IF v_src NOT LIKE '%no such family%' THEN
    RAISE EXCEPTION 'ROLLBACK: seed_family_system_groups() lost its family-exists gate';
  END IF;

  -- The trigger path must still work, or creating a family produces one with no
  -- groups — the exact bug 20260806000008 exists to prevent. Exercised for real
  -- against a throwaway family, then removed.
  IF EXISTS (SELECT 1 FROM auth.users LIMIT 1) THEN
    DECLARE v_code text := 'ZZG' || substr(md5(random()::text), 1, 3);
    BEGIN
      INSERT INTO public.families (family_code, family_name) VALUES (v_code, 'Guard Probe');
      IF (SELECT COUNT(*) FROM public.user_groups WHERE family_code = v_code) <> 3 THEN
        RAISE EXCEPTION
          'ROLLBACK: the families trigger no longer seeds groups — the caller gate is '
          'refusing its own trigger path';
      END IF;
      DELETE FROM public.group_permissions gp USING public.user_groups g
       WHERE gp.group_id = g.id AND g.family_code = v_code;
      DELETE FROM public.user_groups WHERE family_code = v_code;
      DELETE FROM public.resource_visibility WHERE family_code = v_code;
      DELETE FROM public.families WHERE family_code = v_code;
    END;
  END IF;
END $mig$;

COMMIT;
