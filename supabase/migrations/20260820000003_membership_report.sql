-- ============================================================================
-- The Membership report registers as a screen, `/admin/reports` is deleted, and
-- `family-finances` is recaptioned "P&L Summary".
--
-- Three changes, one commit, because they are one decision: the Reporting rail was asked
-- for a breakdown of the family's membership, and the screen that had claimed to be the
-- family's report could not give one.
--
-- ── 1. WHY `/admin/reports` GOES RATHER THAN GROWS ──────────────────────────
-- It sold four things — "membership, dues collected vs. outstanding, RSVP turnout,
-- t-shirt counts" (20260817000000's header quotes the card) — and delivered a mixture of
-- five: a member count, a gathering count, dues collected, t-shirt sizes off the profile,
-- and the last twenty money entries with who keyed each one in.
--
-- Every money figure on it now duplicates a screen that OWNS one. `/family-finances` is the
-- statement, `/transactions` is the ledger, `/dues-projections` is what is outstanding —
-- and all three are in the same rail group, so a reader had four places to get one number
-- and no way to tell which was authoritative. One of the four things it sold has had no
-- source since Events was retired (RSVP turnout read `event_rsvp_attendees`, a dropped
-- table, and nothing in this product records who is coming to anything).
--
-- What it did NOT answer is the question an organizer actually brings to a report: where
-- are our people, and how many of them can we reach. `membership-report` answers that and
-- nothing else.
--
-- DELETED RATHER THAN FROZEN, which is the rule this repo settled on when Events was
-- retired: when there is nothing to lose, drop it; when there is, say whose records they
-- are and why they survive. There are no records here at all — the resource gated a SCREEN
-- and has no `permission_table_map` row, so nothing but grants is being removed, and §4
-- asserts the grants went with it.
--
-- ── 2. WHY THE NEW KEY IS `community` AND NOT `admin` ───────────────────────
-- Two reasons, and the second is structural rather than a preference.
--
-- What crosses the boundary is COUNTS AND PLACE NAMES. No name, no address, no birthday
-- and no id reaches the browser — `buildMembershipReport` reduces the roster to numbers on
-- the server. That is a deliberately smaller surface than Dues Projections, which names
-- every member and states what each owes, and it is why this can be a member-facing
-- resource at all. It is about the family's PEOPLE, and the grid groups by what a resource
-- is about (`members`, the Directory, is `community` at 70); the RAIL groups by what a
-- member came to do, which is why it sits under Reporting beside the money. AGENTS.md
-- argues that divergence at length for `payment-history` and `transactions`.
--
-- AND THE CATEGORY `admin` IS NOT AVAILABLE TO A KEY THAT IS NOT SHAPED `admin/…`.
-- 20260817000004 asserts `(category = 'admin') IS DISTINCT FROM (key LIKE 'admin/%')` finds
-- nothing, in BOTH directions, and that assertion is what licenses its prefix test for
-- failing closed. A `community` key called `membership-report` keeps that invariant; an
-- `admin` one would break a migration already applied on the next fresh database.
--
-- ── 3. RESTRICTED FOR EVERY EXISTING FAMILY, AND FOR THE NEXT ONE ───────────
-- §6: a resource registered later has no row in the templates that already exist, so it
-- falls back to `resource_visibility` — and the default there is 'everyone' for view. That
-- is wrong here, and it is wrong for a narrower reason than Dues Projections' was. This
-- publishes no personal figure at all, so the case for restricting it is not
-- confidentiality; it is that this replaces a screen only administrators could open, and
-- silently widening who may read a family's organizational shape is not a decision a
-- migration should make on a family's behalf. A family that wants it open moves one switch.
--
-- So §2 backfills 'restricted' for every family, §3 carries the grant across from whoever
-- held `admin/reports` BEFORE §5 deletes it, and §3b adds the key to `v_restricted` in
-- `seed_family_permission_templates()` so the family created tomorrow gets the same answer.
-- Without §3b the restriction would hold for today's families and silently fail for every
-- family created after — the worst shape a permission default can have, because the first
-- family affected is the one nobody is watching.
--
-- ── 4. THE RECAPTION ────────────────────────────────────────────────────────
-- `family-finances` keeps its key and its route and becomes "P&L Summary" everywhere. The
-- label in this table is the caption the permission grid prints and the caption the rail
-- prints (AGENTS.md, "One rail item, one permission resource" — "an administrator matching
-- a switch to the thing it switches off should not have to translate"), so the row and
-- `lib/features.ts` move together or they disagree.
--
-- Renaming the KEY was the alternative and is refused for `admin/family`'s reason: the
-- string is in `permission_table_map`, in the composed `funds` policies, and in every grant
-- already issued, so renaming it would orphan all of them to retitle a heading.
--
-- IDEMPOTENT. Every write is ON CONFLICT or a guarded DELETE; safe on an empty database,
-- where the backfills find no families and no templates.
--
-- HOW THIS REACHES A DATABASE
--   `supabase db push`, from CI on merge to master — never `psql -f` by hand, which
--   records nothing and can replay this file out of order. See AGENTS.md, "How
--   migrations reach the hosted project".
-- ============================================================================

BEGIN;

-- ── 1. The resource ────────────────────────────────────────────────────────
-- sort_order 72, the gap between `members` (Directory, 70) and `family-tree` (75). That is
-- where it belongs in a list grouped by subject: the Directory names the family's people one
-- by one, this counts them, and the tree draws how they are related.
--
-- 75 WAS THE FIRST ANSWER AND IS WRONG, exactly as 116 was for `dues-projections`:
-- `family-tree` took it in 20260819000008. The duplicate assertion below is what caught it,
-- on the first `db reset` — which is the whole reason a "one row per sort_order" check is
-- worth having rather than a comment claiming the numbers are unique.
--
-- VIEW IS THE ONLY ACTION. Nothing on this screen writes: a member's chapter is set on
-- their profile, a chapter or region is created on Members & Access, and an invitation is
-- sent from there or from the family tree. A create or edit switch here would be a control
-- nothing consults — the thing AGENTS.md says to check for by naming the policy, the map
-- row or the `can*()` call that will read it. There is none.
INSERT INTO public.permission_resources (key, label, category, subsection, sort_order, actions) VALUES
  ('membership-report', 'Membership', 'community', NULL, 72, ARRAY['view']::TEXT[])
ON CONFLICT (key) DO UPDATE
  SET label      = EXCLUDED.label,
      category   = EXCLUDED.category,
      subsection = EXCLUDED.subsection,
      sort_order = EXCLUDED.sort_order,
      actions    = EXCLUDED.actions;

-- The recaption. Only the label moves — key, category and sort_order are restated so a
-- replay lands on exactly the row 20260806000005 last set, and the WHERE guard keeps this
-- a no-op on a database where somebody has already run it.
UPDATE public.permission_resources
   SET label = 'P&L Summary'
 WHERE key = 'family-finances'
   AND label IS DISTINCT FROM 'P&L Summary';

-- ── 2. Restricted for every existing family ────────────────────────────────
-- Keyed off `people.family_code` rather than `families.family_code`, matching
-- 20260806000007 and 20260817000000: it is the column every other backfill in this chain
-- walks, and a family with no people has nobody to withhold a screen from.
INSERT INTO public.resource_visibility (family_code, resource_key, visibility)
SELECT DISTINCT p.family_code, 'membership-report', 'restricted'
  FROM public.people p
 WHERE p.family_code IS NOT NULL AND p.family_code <> ''
ON CONFLICT (family_code, resource_key) DO NOTHING;

-- ── 3. Whoever could open Reports can open this ────────────────────────────
-- The honest carry-over, and it MUST run before §5 — `template_permissions.resource_key`
-- is `REFERENCES permission_resources(key) ON DELETE CASCADE`, so deleting the old resource
-- takes every grant of it with it and there would be nothing left to read.
--
-- Restricted with nobody granted is a screen that exists and cannot be opened, which is the
-- failure mode 20260817000000's §3 was corrected for. `admin/reports` is an ADMIN key, so
-- unlike that migration's first attempt it genuinely distinguishes an administrator rather
-- than matching every member of every family.
--
-- SCOPE 'any' ONLY, on both sides. An own-scoped grant on a family-wide count means nothing
-- — `membership-report` is in `NO_OWNER_KEYS` and `getMembershipReport` resolves with
-- `canAny` — so writing 'any' here rather than copying `tp.scope` is what keeps that true.
--
-- DO NOTHING, so a re-run never stamps over a grant an administrator has since adjusted.
INSERT INTO public.template_permissions (template_id, resource_key, action, scope, updated_at)
SELECT DISTINCT tp.template_id, 'membership-report', 'view'::public.permission_action,
       'any'::public.permission_scope, NOW()
  FROM public.template_permissions tp
 WHERE tp.resource_key = 'admin/reports'
   AND tp.action = 'view'
   AND tp.scope = 'any'
ON CONFLICT (template_id, resource_key, action) DO NOTHING;

-- ── 3b. The same default for a family created tomorrow ─────────────────────
-- `seed_family_permission_templates()` (20260807000000, rewritten by 20260817000000 §3b)
-- materializes both templates for a new family, and its General grid asks what the family
-- has RESTRICTED rather than re-deriving it from the category:
--
--     WHEN a = 'view' AND NOT EXISTS (… resource_visibility … 'restricted') THEN 'any'
--
-- and the restricted seed immediately above it is `pr.category = 'admin' OR pr.key = ANY(v_restricted)`.
-- `membership-report` is `community`, so without adding it to `v_restricted` the General
-- template of every new family would be handed view 'any' on it as an EXPLICIT row — which
-- §6 says beats the visibility fallback §2 just wrote.
--
-- ONE LINE CHANGES: `v_restricted` gains the key. Everything else in this body is verbatim
-- from 20260819000008, including both gates, and must stay so — this function was callable
-- with the ANON key before 20260806000015, and its ON CONFLICT DO NOTHING inserts made an
-- unauthenticated call a way to RESTORE an administrative grant somebody had deleted. A
-- change to the default list is not a reason to re-open that.
--
-- ── COPY THE NEWEST BODY, AND CHECK WHICH ONE THAT IS ───────────────────────
-- The first draft of this section copied 20260817000000's body, which was two migrations
-- stale, and silently reverted BOTH of the things added since: `gatherings/budget` fell out
-- of `v_restricted` (20260819000000) and `('family-tree', 'edit', 'any')` fell out of the
-- General grid (20260819000008). Every new family would have been handed the gathering money
-- band it should not have and refused the family tree it should.
--
-- IT WAS THE RLS SUITE THAT CAUGHT IT, and through the POSITIVE CONTROL — six family-tree
-- cases where ALPHA's own member, entitled to the call, could no longer edit a record. That
-- is AGENTS.md §7's argument for the control half in one line: every attack half still
-- passed, because an action nobody can perform is perfectly isolated.
--
-- `CREATE OR REPLACE` TAKES A WHOLE BODY, so a stale copy is a silent revert of everything
-- added between. Four migrations define this function; find the newest with
-- `grep -l 'FUNCTION public.seed_family_permission_templates' supabase/migrations/*.sql`
-- and diff against it before editing, every time.
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
  -- Non-admin resources that still start restricted. Everything family-wide about other
  -- members' money belongs here; a page of the family's own records does not — which is
  -- exactly why `family-tree` is NOT on this list, however family-wide the canvas is.
  --
  -- `membership-report` ADDED 20260820000003. It publishes no personal figure at all —
  -- counts and place names only — so the reason is narrower than the money ones above: it
  -- replaces `/admin/reports`, which only administrators could open, and a migration must
  -- not silently widen who may read a family's organizational shape.
  v_restricted text[] := ARRAY['dues-projections', 'gatherings/budget', 'membership-report'];
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

  -- Admin pages start restricted, and so does anything in v_restricted. This is what
  -- makes the General grid below deny them, and it stays the default for any resource a
  -- later migration adds.
  INSERT INTO public.resource_visibility (family_code, resource_key, visibility)
  SELECT p_family_code, pr.key, 'restricted'
    FROM public.permission_resources pr
   WHERE pr.category = 'admin' OR pr.key = ANY(v_restricted)
  ON CONFLICT (family_code, resource_key) DO NOTHING;

  -- Administrators: 'any' on every action each resource actually declares.
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
  --
  -- `family-tree` / `edit` IS THE ROW 20260819000008 ADDED, and it is the only
  -- difference between this body and the 20260819000000 one. It is `'any'` and not
  -- `'own'` because there is no own version of a tree edit — the rows the canvas may
  -- change are precisely the ones nobody has claimed — and because a tree is built
  -- collaboratively, which is the whole argument `editPersonRecord` is written on. A
  -- family that disagrees now has a switch; before this migration it had none.
  INSERT INTO public.template_permissions (template_id, resource_key, action, scope)
  SELECT v_general, t.k, t.act, t.sc
    FROM (VALUES
      ('account-summary', 'view'::public.permission_action, 'own'::public.permission_scope),
      ('chat',            'create', 'any'),
      ('chat',            'edit',   'own'),
      ('chat',            'delete', 'own'),
      ('family-tree',     'edit',   'any'),
      ('photos',          'create', 'any'),
      ('photos',          'edit',   'own')
    ) AS t(k, act, sc)
   WHERE EXISTS (SELECT 1 FROM public.permission_resources pr WHERE pr.key = t.k)
  ON CONFLICT (template_id, resource_key, action) DO NOTHING;

  -- The view default asks what the family has restricted rather than re-deriving it from the
  -- category (20260817000000 §3b). Same answer for every key that existed before, and 'none'
  -- for the ones named in v_restricted.
  INSERT INTO public.template_permissions (template_id, resource_key, action, scope)
  SELECT v_general, pr.key, a::public.permission_action,
         CASE
           WHEN a = 'view' AND NOT EXISTS (
                  SELECT 1 FROM public.resource_visibility rv
                   WHERE rv.family_code = p_family_code
                     AND rv.resource_key = pr.key
                     AND rv.visibility = 'restricted')
             THEN 'any'::public.permission_scope
           ELSE 'none'::public.permission_scope
         END
    FROM public.permission_resources pr
   CROSS JOIN LATERAL unnest(pr.actions) AS a
  ON CONFLICT (template_id, resource_key, action) DO NOTHING;
END $$;

-- The grant is restated because CREATE OR REPLACE does not change privileges and this must
-- stay unreachable from a browser — 20260806000015 made grants the primary control, and
-- `service_role` keeps EXECUTE by default.

-- Restated because CREATE OR REPLACE does not change privileges and this must stay
-- unreachable from a browser — 20260806000015 made grants the primary control, and
-- `service_role` keeps EXECUTE by default.
REVOKE ALL ON FUNCTION public.seed_family_permission_templates(text) FROM PUBLIC, anon, authenticated;

-- ── 4. Retire `admin/reports` ──────────────────────────────────────────────
-- AFTER §3, which is the only ordering that works: `template_permissions.resource_key` and
-- `resource_visibility.resource_key` are both `REFERENCES permission_resources(key) ON
-- DELETE CASCADE` (20260618000000), so this one statement takes every grant and every
-- visibility row for the key with it. That is the whole cleanup and it is why there is no
-- second DELETE here — the same shape 20260813000000 relied on when it retired
-- `admin/announcements`.
DELETE FROM public.permission_resources WHERE key = 'admin/reports';

-- ── 5. The assertions ──────────────────────────────────────────────────────
-- Every one runs unconditionally against the catalogue — no fixture, so this block cannot
-- report success by skipping (AGENTS.md, "A verify block that can skip must not be the only
-- check").
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.permission_resources WHERE key = 'membership-report') THEN
    RAISE EXCEPTION 'membership-report was not registered';
  END IF;

  IF EXISTS (SELECT 1 FROM public.permission_resources WHERE key = 'admin/reports') THEN
    RAISE EXCEPTION 'admin/reports survived the delete';
  END IF;

  -- The cascade did its job. Left behind, these would be grants and visibility rows for a
  -- resource nothing can render a switch for — invisible on the grid and still in the table.
  IF EXISTS (SELECT 1 FROM public.template_permissions WHERE resource_key = 'admin/reports')
     OR EXISTS (SELECT 1 FROM public.resource_visibility WHERE resource_key = 'admin/reports')
  THEN
    RAISE EXCEPTION 'grants for admin/reports outlived the resource';
  END IF;

  -- The recaption took. Checked because §1's UPDATE is guarded on the current value, and a
  -- guard that silently matched nothing is exactly the failure a guard invites.
  IF NOT EXISTS (
    SELECT 1 FROM public.permission_resources
     WHERE key = 'family-finances' AND label = 'P&L Summary'
  ) THEN
    RAISE EXCEPTION 'family-finances was not recaptioned';
  END IF;

  -- It gates a SCREEN, never a table. A map row here would put the key into a composed RLS
  -- policy, which is the shape 20260808000001 dismantled for the old `dues` key.
  IF EXISTS (SELECT 1 FROM public.permission_table_map WHERE resource_key = 'membership-report') THEN
    RAISE EXCEPTION 'membership-report must not map to a table — it gates a screen';
  END IF;

  -- And no policy may consult it. Checked against pg_policies rather than trusted, because
  -- the policies in this chain are COMPOSED at migration time and hosted has drifted before.
  IF EXISTS (
    SELECT 1 FROM pg_policies
     WHERE schemaname = 'public'
       AND (COALESCE(qual, '') || COALESCE(with_check, '')) LIKE '%membership-report%'
  ) THEN
    RAISE EXCEPTION 'a policy evaluates membership-report — it gates a screen, not rows';
  END IF;

  -- The invariant 20260817000004 asserts and relies on: an `admin` category exactly where
  -- the key is shaped `admin/…`, in both directions. Re-asserted here because this migration
  -- both ADDS a non-admin key and DELETES an admin one, which is the pair of moves that
  -- could break it.
  IF EXISTS (
    SELECT 1 FROM public.permission_resources
     WHERE (category = 'admin') IS DISTINCT FROM (key LIKE 'admin/%')
  ) THEN
    RAISE EXCEPTION 'category and key shape disagree — see 20260817000004';
  END IF;

  -- One row per sort_order within the category, which is the invariant 20260806000005
  -- established and the thing a mis-typed number breaks silently.
  IF EXISTS (
    SELECT sort_order FROM public.permission_resources
     WHERE category = 'community'
     GROUP BY sort_order HAVING COUNT(*) > 1
  ) THEN
    RAISE EXCEPTION 'two community resources share a sort_order';
  END IF;

  -- 3b actually took. Reading the function's own source is the only check available: the
  -- alternative is creating a family to see what it seeds, and a migration must not.
  IF NOT EXISTS (
    SELECT 1 FROM pg_proc p
     JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.proname = 'seed_family_permission_templates'
      AND pg_get_functiondef(p.oid) LIKE '%membership-report%'
  ) THEN
    RAISE EXCEPTION 'seed_family_permission_templates() would grant a new family membership-report';
  END IF;

  -- AND THAT IT LOST NOTHING ON THE WAY IN. This is the assertion the first draft of this
  -- file needed and did not have: `CREATE OR REPLACE` takes a whole body, so replacing it
  -- with a stale copy silently reverts everything added since — which is exactly what
  -- happened here, dropping `gatherings/budget` from the restricted list and the family
  -- tree's edit grant from the General template.
  --
  -- Two named strings rather than a checksum, deliberately. A checksum would fail on every
  -- legitimate edit including this one, so it would be turned off; these are the two things
  -- the previous two migrations added, and a THIRD migration adding a third owes a third
  -- line here. That is the cost of a function four migrations have redefined.
  IF NOT EXISTS (
    SELECT 1 FROM pg_proc p
     JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.proname = 'seed_family_permission_templates'
      AND pg_get_functiondef(p.oid) LIKE '%gatherings/budget%'
      AND pg_get_functiondef(p.oid) LIKE '%family-tree%'
  ) THEN
    RAISE EXCEPTION
      'seed_family_permission_templates() lost a grant an earlier migration added — this body is stale';
  END IF;

  -- And that no browser role can call it. 20260806000015 made grants the primary control,
  -- and a CREATE OR REPLACE that silently widened this would be the second time this
  -- function was reachable with the anon key.
  IF has_function_privilege('anon', 'public.seed_family_permission_templates(text)', 'EXECUTE')
     OR has_function_privilege('authenticated', 'public.seed_family_permission_templates(text)', 'EXECUTE')
  THEN
    RAISE EXCEPTION 'seed_family_permission_templates() is executable by a browser role';
  END IF;
END $$;

COMMIT;
