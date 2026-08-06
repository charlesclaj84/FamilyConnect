-- ============================================================================
-- System groups for families created after 20260618000000.
--
-- WHY
--   20260618000000 seeds three groups per family — Administrators, Board Users,
--   General — with their policy, their membership, and a 'restricted' visibility
--   row for every admin resource. It does that in a one-shot DO block over the
--   families that existed when it ran. Nothing re-runs it, and nothing else in the
--   product writes any of those four things.
--
--   So a family created since is born with no groups, no group_permissions, no
--   group members and no resource_visibility rows. Both halves of the permission
--   model then fall to their defaults (auth_permission(), 20260618000000:226-239):
--
--     view              → no resource_visibility row means 'everyone', so 'any'.
--                         EVERY member can open admin/users, admin/groups,
--                         admin/account and admin/reports.
--     create/edit/delete → no group states a scope, so 'none'. For everybody,
--                         including the founder — and admin/groups:edit is what
--                         the Groups & Permissions page requires to grant anything.
--
--   A new family is therefore simultaneously wide open for reading its admin pages
--   and permanently unadministerable. 20260618000000's own safety net for the
--   second half ("a family with no administrator could never manage permissions
--   again", line 506) only ever ran for the families of that moment.
--
-- WHAT THIS DOES
--   1. Lifts the seeding out of that DO block into seed_family_system_groups(),
--      idempotent and callable.
--   2. Fires it from an AFTER INSERT trigger on `families`, so it cannot be
--      skipped by whichever path creates the next one. register.ts is the only
--      caller today; putting it in the database rather than in the action means a
--      second caller inherits it instead of re-introducing the bug.
--   3. Puts each user-linked person into General on insert, and the FOUNDER into
--      Administrators — recognised as `families.created_by = people.user_id`.
--   4. Backfills every family that has no groups today, and every admin resource
--      that has no visibility row for a family that does.
--
-- WHY THE FOUNDER, AND NOT "THE FIRST MEMBER"
--   20260618000000 promoted the oldest member because it ran long after the fact
--   and had nothing better to go on. At INSERT time we do: register.ts stamps
--   `families.created_by` with the creating user (register.ts:136). Testing for the
--   founder specifically — rather than "this family has no administrator yet" —
--   also keeps the trigger inert for any fixture that inserts a family without a
--   created_by, which is what tests/rls does. A "first member wins" rule would
--   silently promote that suite's plain member and take its whole ownership axis
--   with it (AGENTS.md §7).
--
-- GENERAL MEMBERSHIP IS BACKFILLED ONLY FOR PEOPLE IN NO GROUP AT ALL
--   Re-adding everyone would override an administrator who deliberately removed
--   someone from General. Someone in *zero* groups has never been seeded rather
--   than been stripped: stripping a member to nothing leaves them unable to chat or
--   touch their own records, which is not a thing anyone does on purpose.
--
-- SCOPE — what this does NOT fix
--   A new admin resource registered by a LATER migration still owes its own
--   per-family visibility backfill, exactly as 20260806000007 does. This guarantees
--   new *families*, not new *resources*. Phase 3's `admin/approvals` (TODO item 2)
--   needs both.
--
-- IDEMPOTENT. Safe to re-run; safe on an empty database, where every loop below
-- finds nothing and only the function and triggers are created.
-- ============================================================================

BEGIN;

-- ── 1. The seeding, as a function ───────────────────────────────────────────
-- SECURITY DEFINER because the trigger fires under whoever inserted the row.
-- user_group_members and group_permissions are writable only by a caller holding
-- admin/groups:edit (20260618000000:333-368) — which the founder of a brand new
-- family definitionally does not, since the grant lives in the group this creates.
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
BEGIN
  IF p_family_code IS NULL OR p_family_code = '' THEN
    RETURN;
  END IF;

  INSERT INTO public.user_groups (family_code, name, description, is_system) VALUES
    (p_family_code, 'Administrators', 'Full access to every page and action.', true),
    (p_family_code, 'Board Users',    'Officers and appointed positions.',     true),
    (p_family_code, 'General',        'All family members.',                   true)
  ON CONFLICT (family_code, name) DO NOTHING;

  SELECT id INTO v_admins  FROM public.user_groups WHERE family_code = p_family_code AND name = 'Administrators';
  SELECT id INTO v_board   FROM public.user_groups WHERE family_code = p_family_code AND name = 'Board Users';
  SELECT id INTO v_general FROM public.user_groups WHERE family_code = p_family_code AND name = 'General';

  -- Administrators: 'any' on every action each resource actually declares.
  -- unnest(pr.actions) rather than the full enum, for 20260806000007's reason —
  -- a section that cannot be created should not carry a create grant. The two
  -- differ only on admin/account/routing and admin/account/settings, and only in
  -- the direction of granting less.
  INSERT INTO public.group_permissions (group_id, resource_key, action, scope)
  SELECT v_admins, pr.key, a::public.permission_action, 'any'
    FROM public.permission_resources pr
   CROSS JOIN LATERAL unnest(pr.actions) AS a
  ON CONFLICT (group_id, resource_key, action) DO NOTHING;

  -- Board Users: view everything except the admin pages; author their own
  -- announcements, events and photos.
  INSERT INTO public.group_permissions (group_id, resource_key, action, scope)
  SELECT v_board, pr.key, 'view', 'any'
    FROM public.permission_resources pr
   WHERE pr.category <> 'admin'
  ON CONFLICT (group_id, resource_key, action) DO NOTHING;

  -- The EXISTS guard on both literal lists below is load-bearing:
  -- group_permissions.resource_key is a foreign key, so naming a key that a later
  -- migration renamed or dropped would abort the INSERT — and, through the trigger,
  -- the family creation that called it. 20260618000000 hit exactly this with
  -- 'personal-info' (its comment at line 465).
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

  -- General: view the member-facing pages, manage only their own records.
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

  -- Admin pages start restricted. Without this row view falls through to 'any'
  -- and every member of the new family can read every admin surface.
  INSERT INTO public.resource_visibility (family_code, resource_key, visibility)
  SELECT p_family_code, pr.key, 'restricted'
    FROM public.permission_resources pr
   WHERE pr.category = 'admin'
  ON CONFLICT (family_code, resource_key) DO NOTHING;
END $$;

REVOKE ALL ON FUNCTION public.seed_family_system_groups(text) FROM PUBLIC;

-- ── 2. Fire it when a family is created ─────────────────────────────────────
CREATE OR REPLACE FUNCTION public.tg_family_seed_system_groups()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  PERFORM public.seed_family_system_groups(NEW.family_code);
  RETURN NULL;
END $$;

DROP TRIGGER IF EXISTS families_seed_system_groups ON public.families;
CREATE TRIGGER families_seed_system_groups
  AFTER INSERT ON public.families
  FOR EACH ROW EXECUTE FUNCTION public.tg_family_seed_system_groups();

-- ── 3. Put each newly linked person in their groups ─────────────────────────
-- Everyone user-linked lands in General; the founder also lands in Administrators.
-- Rows with no user_id are relatives entered by someone else — a child, an
-- ancestor — and hold no permissions of their own, so the WHEN clauses skip them.
--
-- ON INSERT *AND* ON UPDATE OF user_id, because becoming a member is not always an
-- insert. Two live paths attach a user to a `people` row that already exists:
--   register.ts:164     join-mode claims an unlinked row matching the email
--   link-person.ts:168  moves user_id onto a pre-existing relative's row
-- An INSERT-only trigger would leave both of those members in no group at all —
-- which is the bug this migration exists to end, arriving by a different door.
-- Two triggers rather than one FOR INSERT OR UPDATE: OLD is not bound during an
-- INSERT, so a single WHEN clause cannot test the transition.
CREATE OR REPLACE FUNCTION public.tg_person_join_system_groups()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_group uuid;
BEGIN
  SELECT id INTO v_group
    FROM public.user_groups
   WHERE family_code = NEW.family_code AND name = 'General';
  IF v_group IS NOT NULL THEN
    INSERT INTO public.user_group_members (group_id, person_id)
    VALUES (v_group, NEW.id)
    ON CONFLICT DO NOTHING;
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.families f
     WHERE f.family_code = NEW.family_code
       AND f.created_by IS NOT NULL
       AND f.created_by = NEW.user_id
  ) THEN
    SELECT id INTO v_group
      FROM public.user_groups
     WHERE family_code = NEW.family_code AND name = 'Administrators';
    IF v_group IS NOT NULL THEN
      INSERT INTO public.user_group_members (group_id, person_id)
      VALUES (v_group, NEW.id)
      ON CONFLICT DO NOTHING;
    END IF;
  END IF;

  RETURN NULL;
END $$;

DROP TRIGGER IF EXISTS people_join_system_groups ON public.people;
CREATE TRIGGER people_join_system_groups
  AFTER INSERT ON public.people
  FOR EACH ROW WHEN (NEW.user_id IS NOT NULL)
  EXECUTE FUNCTION public.tg_person_join_system_groups();

DROP TRIGGER IF EXISTS people_link_join_system_groups ON public.people;
CREATE TRIGGER people_link_join_system_groups
  AFTER UPDATE OF user_id ON public.people
  FOR EACH ROW WHEN (NEW.user_id IS NOT NULL AND OLD.user_id IS DISTINCT FROM NEW.user_id)
  EXECUTE FUNCTION public.tg_person_join_system_groups();

-- ── 4. Backfill: families with no groups at all ─────────────────────────────
-- Sourced from people as well as families: 20260618000000 iterated people, so a
-- family_code carried only on people rows was seeded then and must not look new now.
DO $$
DECLARE
  v_family text;
  v_count  int := 0;
BEGIN
  FOR v_family IN
    SELECT code FROM (
      SELECT family_code AS code FROM public.families
      UNION
      SELECT DISTINCT family_code FROM public.people
       WHERE family_code IS NOT NULL AND family_code <> ''
    ) f
     WHERE NOT EXISTS (SELECT 1 FROM public.user_groups g WHERE g.family_code = f.code)
  LOOP
    PERFORM public.seed_family_system_groups(v_family);
    v_count := v_count + 1;
    RAISE NOTICE 'family %: seeded the three system groups', v_family;
  END LOOP;

  RAISE NOTICE 'system groups seeded for % families', v_count;
END $$;

-- ── 5. Backfill: admin resources with no visibility row ─────────────────────
-- Closes the same hole for families that DO have groups but were never given a
-- row for an admin resource registered after they were seeded.
INSERT INTO public.resource_visibility (family_code, resource_key, visibility)
SELECT DISTINCT p.family_code, pr.key, 'restricted'
  FROM public.people p
 CROSS JOIN public.permission_resources pr
 WHERE p.family_code IS NOT NULL AND p.family_code <> ''
   AND pr.category = 'admin'
ON CONFLICT (family_code, resource_key) DO NOTHING;

-- ── 6. Backfill: membership ─────────────────────────────────────────────────
-- General, for user-linked people who belong to no group whatsoever. See the
-- header for why that test and not "everyone not already in General".
INSERT INTO public.user_group_members (group_id, person_id)
SELECT g.id, p.id
  FROM public.people p
  JOIN public.user_groups g ON g.family_code = p.family_code AND g.name = 'General'
 WHERE p.user_id IS NOT NULL
   AND NOT EXISTS (
     SELECT 1
       FROM public.user_group_members m
       JOIN public.user_groups g2 ON g2.id = m.group_id
      WHERE m.person_id = p.id AND g2.family_code = p.family_code
   )
ON CONFLICT DO NOTHING;

-- An administrator for any family whose Administrators group is empty: the founder
-- if `families.created_by` names one, otherwise the oldest member — 20260618000000's
-- safety net, applied to the families it never reached.
DO $$
DECLARE
  r        record;
  v_person uuid;
BEGIN
  FOR r IN
    SELECT g.id AS group_id, g.family_code
      FROM public.user_groups g
     WHERE g.name = 'Administrators'
       AND NOT EXISTS (SELECT 1 FROM public.user_group_members m WHERE m.group_id = g.id)
  LOOP
    SELECT p.id INTO v_person
      FROM public.people p
      JOIN public.families f ON f.family_code = p.family_code
     WHERE p.family_code = r.family_code
       AND p.user_id IS NOT NULL
       AND p.user_id = f.created_by
     ORDER BY p.created_at ASC, p.id ASC
     LIMIT 1;

    IF v_person IS NULL THEN
      SELECT p.id INTO v_person
        FROM public.people p
       WHERE p.family_code = r.family_code AND p.user_id IS NOT NULL
       ORDER BY p.created_at ASC, p.id ASC
       LIMIT 1;
    END IF;

    IF v_person IS NULL THEN
      -- A family row with nobody linked to it yet. The people trigger promotes the
      -- founder when they arrive, so this is not a hole — just nothing to do.
      RAISE NOTICE 'family %: no user-linked member to promote yet', r.family_code;
    ELSE
      INSERT INTO public.user_group_members (group_id, person_id)
      VALUES (r.group_id, v_person)
      ON CONFLICT DO NOTHING;
      RAISE NOTICE 'family %: promoted person % to Administrators', r.family_code, v_person;
    END IF;
  END LOOP;
END $$;

-- ── 7. Verify ───────────────────────────────────────────────────────────────
-- Asserted over families that have a user-linked member, which is the population
-- any of this can matter for.
DO $$
DECLARE
  v_bad int;
BEGIN
  SELECT COUNT(*) INTO v_bad
    FROM (SELECT DISTINCT family_code AS code FROM public.people
           WHERE user_id IS NOT NULL AND family_code IS NOT NULL AND family_code <> '') f
   WHERE (SELECT COUNT(*) FROM public.user_groups g
           WHERE g.family_code = f.code
             AND g.name IN ('Administrators', 'Board Users', 'General')) < 3;
  IF v_bad > 0 THEN
    RAISE EXCEPTION 'ROLLBACK: % families are missing a system group', v_bad;
  END IF;

  SELECT COUNT(*) INTO v_bad
    FROM (SELECT DISTINCT family_code AS code FROM public.people
           WHERE user_id IS NOT NULL AND family_code IS NOT NULL AND family_code <> '') f
   WHERE NOT EXISTS (
     SELECT 1 FROM public.user_group_members m
       JOIN public.user_groups g ON g.id = m.group_id
      WHERE g.family_code = f.code AND g.name = 'Administrators');
  IF v_bad > 0 THEN
    RAISE EXCEPTION 'ROLLBACK: % families have no administrator', v_bad;
  END IF;

  -- The finding that motivated this: an admin resource with no visibility row is
  -- viewable by every member of that family.
  SELECT COUNT(*) INTO v_bad
    FROM (SELECT DISTINCT family_code AS code FROM public.people
           WHERE user_id IS NOT NULL AND family_code IS NOT NULL AND family_code <> '') f
   CROSS JOIN public.permission_resources pr
   WHERE pr.category = 'admin'
     AND NOT EXISTS (SELECT 1 FROM public.resource_visibility rv
                      WHERE rv.family_code = f.code AND rv.resource_key = pr.key);
  IF v_bad > 0 THEN
    RAISE EXCEPTION 'ROLLBACK: % (family, admin resource) pairs still default to view=any', v_bad;
  END IF;
END $$;

COMMIT;
