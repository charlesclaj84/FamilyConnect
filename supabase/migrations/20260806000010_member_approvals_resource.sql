-- ============================================================================
-- Register the Member Approvals admin surface: `admin/approvals`.
--
-- WHY THIS IS ITS OWN MIGRATION, AHEAD OF THE ENFORCEMENT
--   20260806000011 rewrites the `people` SELECT policy so that a row whose
--   membership_status is not 'approved' is visible only to a caller who can view
--   Member Approvals. That policy names this key as a LITERAL. An UNREGISTERED key
--   resolves to view 'any' — auth_permission()'s default for a resource with no
--   resource_visibility row (20260618000000:226-239) — so applying the two in one
--   file, or in the other order, would publish every applicant's PII (name, email,
--   phone, address, date of birth) to every member of the family. Registering first
--   and restricting first is the whole point of the split.
--
-- ACTIONS: view + edit ONLY
--   Approving and rejecting are both edits of an existing `people` row. Nothing here
--   creates a person — the applicant creates their own row by joining — and nothing
--   deletes one: a rejection sets membership_status = 'rejected' rather than deleting,
--   because people(id) is referenced ON DELETE CASCADE from four tables and a delete
--   would also strand the auth account with app_metadata.family_code still naming the
--   family. Declaring only the two actions the surface has means Groups & Permissions
--   renders two switches instead of four, two of which would be wired to nothing.
--
-- THE TWO BACKFILLS, AND WHY EACH IS SEPARATELY NECESSARY
--   20260806000008 guarantees that a new *family* gets a 'restricted' visibility row
--   for every admin resource and an Administrators group holding 'any' on all of them.
--   It does that per family, at family-creation time. A resource registered afterwards
--   — this one — reaches none of the families that already exist, which is exactly the
--   gap that migration's own SCOPE note flags for this key. So both halves are redone
--   here, per existing family:
--
--     §2  a 'restricted' row, or view falls through to 'any' and the surface is born
--         world-readable to that family. This is the hole recorded as blocker 4 of
--         TODO item 1, and it is not hypothetical — every family created since
--         20260618000000 had no resource_visibility rows at all.
--     §3  view+edit 'any' for the family's Administrators group, or nobody can reach
--         the page: create/edit/delete fail closed with no group stating a scope, so
--         an unbackfilled family would have applicants it could never admit.
--
-- ALSO EDITED: 20260618000000's seed gained this key, so a replay of that file cannot
-- revert the row (its insert is ON CONFLICT DO UPDATE). It is added there WITHOUT the
-- `actions` column on purpose — that column does not exist until 20260806000007, and
-- naming it in the earlier file would abort the chain on an empty database. Fresh
-- databases therefore register the key with the default four actions and are narrowed
-- to two by §1 below; the ON CONFLICT DO UPDATE there does not touch `actions`, so the
-- narrowing survives a replay.
--
-- IDEMPOTENT. Safe to re-run; safe on an empty database, where §2 and §3 find no
-- families and only the resource row is written.
-- ============================================================================

BEGIN;

-- ── 1. The resource ─────────────────────────────────────────────────────────
-- sort_order 165 sits it between User Management (160) and Groups & Permissions
-- (170) in the Groups & Permissions grid: admitting a member belongs next to
-- managing one, not off at the end of the Admin section.
-- Labelled 'Pending Approval' since 20260808000000 — the caption on its own tab in
-- Members & Access, which is where the queue has lived since 20260807000000 moved it
-- off this route. Updated here as well as there because this insert is ON CONFLICT DO
-- UPDATE on label.
--
-- `subsection` is deliberately NOT set here: the column exists by this point, but the
-- sub-heading it joins ('Members & Access') only makes sense once admin/users/templates
-- is beside it, which is 20260808000000's business. Naming it early would render a
-- sub-heading over a single row.
INSERT INTO public.permission_resources (key, label, category, sort_order, actions)
VALUES ('admin/approvals', 'Pending Approval', 'admin', 165, ARRAY['view','edit']::TEXT[])
ON CONFLICT (key) DO UPDATE
  SET label      = EXCLUDED.label,
      category   = EXCLUDED.category,
      sort_order = EXCLUDED.sort_order,
      actions    = EXCLUDED.actions;

-- ── 2. Restricted for every existing family ─────────────────────────────────
-- Sourced from BOTH tables for 20260806000008 §4's reason: a family_code carried
-- only on people rows (which is what tests/rls seeds, and what any family predating
-- the `families` table has) is a real family and must not be missed.
INSERT INTO public.resource_visibility (family_code, resource_key, visibility)
SELECT f.code, 'admin/approvals', 'restricted'
  FROM (
    SELECT family_code AS code FROM public.families
    UNION
    SELECT DISTINCT family_code FROM public.people
     WHERE family_code IS NOT NULL AND family_code <> ''
  ) f
 WHERE f.code IS NOT NULL AND f.code <> ''
ON CONFLICT (family_code, resource_key) DO NOTHING;

-- ── 3. Administrators may work the queue ────────────────────────────────────
-- The system Administrators group is seeded 'any' on every resource for every
-- family (20260618000000, and seed_family_system_groups() since 20260806000008);
-- this extends that standing rule to the key those loops ran too early to see.
--
-- Deliberately ONLY the system group, and not "every group that can edit
-- admin/users". Admitting a stranger into the family is a different decision from
-- editing an existing member's groups, and silently handing it to whoever holds
-- the latter would widen access on deploy. An administrator can grant it to any
-- other group from Groups & Permissions.
INSERT INTO public.group_permissions (group_id, resource_key, action, scope, updated_at)
SELECT g.id, 'admin/approvals', a::public.permission_action, 'any', NOW()
  FROM public.user_groups g
 CROSS JOIN (VALUES ('view'), ('edit')) AS t(a)
 WHERE g.name = 'Administrators' AND g.is_system = true
ON CONFLICT (group_id, resource_key, action) DO NOTHING;

-- ── 4. Verify ───────────────────────────────────────────────────────────────
DO $$
DECLARE v_bad int;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.permission_resources WHERE key = 'admin/approvals') THEN
    RAISE EXCEPTION 'ROLLBACK: admin/approvals was not registered';
  END IF;

  -- The failure this migration exists to prevent: a family for which the key has no
  -- visibility row, and so defaults to being readable by every member.
  SELECT COUNT(*) INTO v_bad
    FROM (SELECT DISTINCT family_code AS code FROM public.people
           WHERE family_code IS NOT NULL AND family_code <> '') f
   WHERE NOT EXISTS (SELECT 1 FROM public.resource_visibility rv
                      WHERE rv.family_code = f.code AND rv.resource_key = 'admin/approvals');
  IF v_bad > 0 THEN
    RAISE EXCEPTION 'ROLLBACK: % families would default admin/approvals to view=any', v_bad;
  END IF;

  -- And the mirror failure: a family whose administrators cannot reach it.
  SELECT COUNT(*) INTO v_bad
    FROM public.user_groups g
   WHERE g.name = 'Administrators' AND g.is_system = true
     AND NOT EXISTS (SELECT 1 FROM public.group_permissions gp
                      WHERE gp.group_id = g.id
                        AND gp.resource_key = 'admin/approvals'
                        AND gp.action = 'edit' AND gp.scope = 'any');
  IF v_bad > 0 THEN
    RAISE EXCEPTION 'ROLLBACK: % Administrators groups cannot edit admin/approvals', v_bad;
  END IF;
END $$;

COMMIT;
