-- ============================================================================
-- `/admin/announcements` retires. One screen posts, pins and deletes family news.
--
-- WHY
--   Announcement Management and Community > Announcements were two pages answering
--   one question. Both listed the same rows through the same `getAnnouncements()`,
--   both composed with the same fields, and every control on the admin page —
--   post, pin, delete — is a control the member page can carry, gated by the grant
--   that already governs it:
--
--     announcements:create   post at all. 'any' on every system template.
--     announcements:edit     pin to everyone's Recent Updates. Administrators only.
--     announcements:delete   remove one. 'own' by default, 'any' for administrators.
--
--   So the admin route was not a permission boundary — the KEY it gated was
--   `admin/announcements`, which governed no table and appeared in no policy. It was
--   a second place to learn one job, and the pin control on it was the reason it
--   existed at all. That control has moved.
--
-- WHAT THIS DELETES, AND WHY IT IS SAFE TO
--   `admin/announcements` names no table in permission_table_map and is referenced by
--   no policy in the chain — verified before writing this file, and it is the check
--   that matters. 20260808000001 documents the trap this avoids: deleting a resource
--   does not rewrite the policies naming it, it changes what auth_permission()
--   RETURNS for the key, and for 'view' the default on an unregistered key is 'any'.
--   A resource whose key appeared in a USING clause would therefore turn that clause
--   into a tautology on the way out. This one appears in none, so the delete is the
--   whole job. Same shape as `admin/groups`, retired by 20260807000000.
--
--   The two dependent tables cascade — `template_permissions.resource_key` and
--   `resource_visibility.resource_key` are both
--   `REFERENCES permission_resources(key) ON DELETE CASCADE` (20260618000000 §155,
--   §190) — so a family's grid loses the row rather than keeping a switch wired to a
--   page that no longer exists.
--
-- THE SEED IS EDITED TOO, in 20260618000000. Required, not tidiness: that insert is
-- ON CONFLICT DO UPDATE and would re-add the row on every `db reset`, so a fresh
-- local database would carry a resource hosted does not. AGENTS.md §6 states the
-- rule in the other direction — a new resource needs the migration AND the seed —
-- and a retirement owes the same pair.
--
-- IDEMPOTENT. The delete is unfiltered by state and matches nothing on a second run.
--
-- HOW THIS REACHES A DATABASE
--   `supabase db push`, from CI on merge to master — never `psql -f` by hand. See
--   AGENTS.md, "How migrations reach the hosted project".
-- ============================================================================

BEGIN;

-- ── 1. Refuse to run if anything still depends on the key ───────────────────
-- Cheap, needs no fixture, and it is the assertion that would have caught the
-- 20260808000001 trap had that migration not reasoned it out by hand. A policy
-- naming this key would silently become `true` for view the moment the row goes.
DO $mig$
DECLARE
  v_policy text;
  v_table  text;
BEGIN
  SELECT p.tablename || '.' || p.policyname INTO v_policy
    FROM pg_policies p
   WHERE p.schemaname = 'public'
     AND COALESCE(p.qual, '') || COALESCE(p.with_check, '') LIKE '%admin/announcements%'
   LIMIT 1;

  IF v_policy IS NOT NULL THEN
    RAISE EXCEPTION
      'ROLLBACK: policy % still names admin/announcements. Rewrite it before deleting the resource — see 20260808000001.',
      v_policy;
  END IF;

  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname='public' AND tablename='permission_table_map') THEN
    SELECT m.table_name INTO v_table
      FROM public.permission_table_map m
     WHERE m.resource_key = 'admin/announcements'
     LIMIT 1;
    IF v_table IS NOT NULL THEN
      RAISE EXCEPTION
        'ROLLBACK: permission_table_map still maps % to admin/announcements.', v_table;
    END IF;
  END IF;
END $mig$;

-- ── 2. The resource goes, and its grants with it ────────────────────────────
DELETE FROM public.permission_resources WHERE key = 'admin/announcements';

-- ── 3. Verify ───────────────────────────────────────────────────────────────
-- Unconditional: no fixture is needed to ask whether a row is gone, so this cannot
-- be one of the verify blocks AGENTS.md warns about — the kind that skips quietly
-- and reports success over something that never ran.
DO $mig$
DECLARE v_n int;
BEGIN
  IF EXISTS (SELECT 1 FROM public.permission_resources WHERE key = 'admin/announcements') THEN
    RAISE EXCEPTION 'ROLLBACK: admin/announcements is still registered';
  END IF;

  SELECT count(*) INTO v_n FROM public.template_permissions WHERE resource_key = 'admin/announcements';
  IF v_n <> 0 THEN
    RAISE EXCEPTION 'ROLLBACK: % template_permissions rows survived the cascade', v_n;
  END IF;

  SELECT count(*) INTO v_n FROM public.resource_visibility WHERE resource_key = 'admin/announcements';
  IF v_n <> 0 THEN
    RAISE EXCEPTION 'ROLLBACK: % resource_visibility rows survived the cascade', v_n;
  END IF;

  -- The member-facing key must survive. Deleting the wrong one of the two would take
  -- the whole feature down, and the grid would simply stop offering it.
  IF NOT EXISTS (SELECT 1 FROM public.permission_resources WHERE key = 'announcements') THEN
    RAISE EXCEPTION 'ROLLBACK: the announcements resource is missing — the wrong key was deleted';
  END IF;
END $mig$;

COMMIT;
