-- ============================================================================
-- Authorization rebuild, pass 4 of 4: retire the legacy admin flags.
--
-- people.is_admin and people.can_approve are gone. Authority comes from group
-- membership resolved by public.auth_permission() — see 20260618000000.
--
-- RUN THIS LAST. It must come after:
--   1. 20260618000000_permissions_foundation.sql   (seeds groups from is_admin)
--   2. 20260618000001_permissions_rls_sweep.sql    (policies stop needing the flags)
--   3. the application deploy that removes every read of these columns
--
-- Running it early is not silently harmful — Postgres will refuse to drop a
-- column that a policy still depends on, and any application query naming the
-- column starts erroring loudly rather than quietly returning the wrong answer.
-- But there is no reason to run it before the deploy.
--
-- SAFETY: the seeded Administrators group already carries whoever had
-- is_admin = true, so dropping the column loses no authority. Verify before
-- running:
--
--   SELECT p.family_code, p.first_name, p.last_name, p.is_admin,
--          EXISTS (SELECT 1 FROM user_group_members m
--                  JOIN user_groups g ON g.id = m.group_id
--                  WHERE m.person_id = p.id AND g.name = 'Administrators') AS in_admin_group
--   FROM people p
--   WHERE p.is_admin = true;
--
--   -- every row should show in_admin_group = true
--
-- IDEMPOTENT: safe to run more than once.
--
-- USAGE
--   psql "$DATABASE_URL" -f 20260618000002_drop_legacy_admin_flags.sql
-- ============================================================================

BEGIN;

-- Refuse to proceed if any is_admin holder is missing from an administrator
-- group — that would silently strip their access.
DO $$
DECLARE
  v_orphans int;
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'people' AND column_name = 'is_admin'
  ) THEN
    SELECT COUNT(*) INTO v_orphans
    FROM public.people p
    WHERE p.is_admin = true
      AND NOT EXISTS (
        SELECT 1
        FROM public.user_group_members m
        JOIN public.user_groups g ON g.id = m.group_id
        JOIN public.group_permissions gp ON gp.group_id = g.id
        WHERE m.person_id = p.id
          AND gp.resource_key = 'admin/groups'
          AND gp.action = 'edit'
          AND gp.scope <> 'none'
      );

    IF v_orphans > 0 THEN
      RAISE EXCEPTION
        'aborting: % person(s) have is_admin = true but are not in any group that can manage permissions. Run 20260618000000 first, or add them to Administrators.',
        v_orphans;
    END IF;
  END IF;
END $$;

ALTER TABLE public.people DROP COLUMN IF EXISTS is_admin;
ALTER TABLE public.people DROP COLUMN IF EXISTS can_approve;

COMMIT;
