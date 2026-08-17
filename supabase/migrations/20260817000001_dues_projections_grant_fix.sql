-- ============================================================================
-- Correcting 20260817000000 §3, which granted Dues Projections to everybody.
--
-- ── WHAT WENT WRONG ────────────────────────────────────────────────────────
-- §2 of that migration registers `dues-projections` as `restricted` for every existing
-- family, so the screen is withheld unless something grants it. §3 then set out to grant
-- it to "whoever already runs the family's money", and picked the wrong key to follow:
--
--     WHERE tp.resource_key = 'transactions/dues-payments' AND tp.scope = 'any'
--
-- `transactions/dues-payments` is in the `accounting` category, and
-- seed_family_permission_templates() gives the **General** template view 'any' on every
-- NON-ADMIN resource. So every member of every family already holds that grant at 'any',
-- and §3 handed all of them a screen that names every relative against what they still
-- owe. The restriction in §2 was defeated by the grant in §3, in the same file.
--
-- Measured on hosted immediately after deploy: 6 General templates and 1 committee
-- template at scope 'any'. Not a hypothesis.
--
-- ── WHY A LOCAL `db reset` COULD NOT HAVE CAUGHT IT ────────────────────────
-- Worth writing down, because it is the reason this shipped. §3 is a one-time backfill
-- over families that ALREADY EXIST. On a fresh database it runs before any family does,
-- touches nothing, and every family created afterwards is seeded by the function §3b
-- fixed — which correctly gives General 'none'. So the local run was green and correct,
-- and told nothing at all about the four families on hosted.
--
-- A backfill's blast radius is the data it finds, and an empty database has none. The
-- check that would have caught this is the one run after the push: ask hosted which
-- templates hold the new key. That is now a step rather than an afterthought.
--
-- ── THE RIGHT KEY TO FOLLOW ────────────────────────────────────────────────
-- `admin/account/dues` at scope 'any' — maintaining what members owe. It is an `admin`
-- category key, so the template seed gives General 'none' on it, which is precisely the
-- property `transactions/dues-payments` lacked. Confirmed on hosted before writing this:
-- Administrators 'any', General 'none', committee 'none'.
--
-- Not `transactions/*` anything: every one of those is non-admin and carries the same
-- defect. Not the template NAME either — 'Administrators' is a seeded default a family
-- may rename or replace, and matching on it would be a second, weaker definition of who
-- administers a family than the grid the family actually edits.
--
-- ── THE DELETE, AND WHY IT IS SAFE HERE AND WOULD NOT BE LATER ─────────────
-- It removes `dues-projections` rows from templates that do NOT hold
-- `admin/account/dues:view = any` — which is exactly the set §3 over-granted, because
-- nothing else has written this key. That is only true because the window is minutes
-- wide: the resource was registered and this correction was written in the same session,
-- so no administrator has had the chance to grant it deliberately.
--
-- A LATER MIGRATION MUST NOT DO THIS. Once a family has had time to adjust the grid,
-- deleting rows by inference is deleting somebody's decision. If this needs revisiting,
-- narrow the INSERT and leave what exists alone.
--
-- IDEMPOTENT. The delete is defined by state rather than by history, and the insert is
-- ON CONFLICT DO NOTHING; a re-run finds nothing to remove and nothing to add.
--
-- HOW THIS REACHES A DATABASE
--   `supabase db push`, from CI on merge to master — never `psql -f` by hand, which
--   records nothing and can replay this file out of order. See AGENTS.md, "How
--   migrations reach the hosted project".
-- ============================================================================

BEGIN;

-- ── 1. Take it back off everybody who was never meant to have it ───────────
-- `scope <> 'none'` IS LOAD-BEARING AND WAS NOT IN THE FIRST DRAFT. Without it this
-- deletes the explicit `none` rows too, and those are not the defect — they are the
-- materialized denial §6b describes: every template carries a row for every resource so
-- Members & Access can show the whole answer without a reader having to know about
-- fall-through. Removing them leaves the same ANSWER (the key is restricted, so an absent
-- row denies) and a worse GRID.
--
-- Measured on a reproduction of the hosted state: the wide delete removed 8 rows where
-- only 2 were wrong.
DELETE FROM public.template_permissions tp
 WHERE tp.resource_key = 'dues-projections'
   AND tp.scope <> 'none'
   AND NOT EXISTS (
     SELECT 1 FROM public.template_permissions admin_grant
      WHERE admin_grant.template_id  = tp.template_id
        AND admin_grant.resource_key = 'admin/account/dues'
        AND admin_grant.action       = 'view'
        AND admin_grant.scope        = 'any'
   );

-- ── 2. Grant it to whoever maintains the family's dues ─────────────────────
-- Administrators already hold it from §3 and this adds nothing for them; it is written
-- anyway so the file states the rule in one place rather than relying on the previous
-- migration having happened to get this half right.
INSERT INTO public.template_permissions (template_id, resource_key, action, scope, updated_at)
SELECT DISTINCT tp.template_id, 'dues-projections', 'view'::public.permission_action,
       'any'::public.permission_scope, NOW()
  FROM public.template_permissions tp
 WHERE tp.resource_key = 'admin/account/dues'
   AND tp.action = 'view'
   AND tp.scope = 'any'
ON CONFLICT (template_id, resource_key, action) DO NOTHING;

-- ── 3. Assert the shape, not the count ─────────────────────────────────────
-- A count would be wrong on an empty database and wrong again the first time a family
-- adjusts the grid. What must hold is the IMPLICATION: no template GRANTS
-- `dues-projections` without holding `admin/account/dues` at 'any'.
--
-- `scope <> 'none'` again, matching §1: a materialized denial is not a grant, and an
-- assertion that counted one would fail on exactly the rows §1 deliberately preserves.
--
-- Runs unconditionally over the catalogue and needs no fixture, so it cannot report
-- success by skipping.
DO $$
DECLARE
  v_bad int;
BEGIN
  SELECT COUNT(*) INTO v_bad
    FROM public.template_permissions tp
   WHERE tp.resource_key = 'dues-projections'
     AND tp.scope <> 'none'
     AND NOT EXISTS (
       SELECT 1 FROM public.template_permissions g
        WHERE g.template_id  = tp.template_id
          AND g.resource_key = 'admin/account/dues'
          AND g.action       = 'view'
          AND g.scope        = 'any'
     );
  IF v_bad > 0 THEN
    RAISE EXCEPTION
      '% template(s) hold dues-projections without administering the family''s dues', v_bad;
  END IF;

  -- And the screen is still restricted by default. If this ever came back 'everyone' the
  -- grant above would be decoration — the fallback would admit everybody regardless.
  IF EXISTS (
    SELECT 1 FROM public.resource_visibility
     WHERE resource_key = 'dues-projections' AND visibility <> 'restricted'
  ) THEN
    RAISE EXCEPTION 'dues-projections is not restricted for every family that has a row';
  END IF;
END $$;

COMMIT;
