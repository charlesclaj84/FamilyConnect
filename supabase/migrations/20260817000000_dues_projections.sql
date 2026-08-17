-- ============================================================================
-- Dues Projections registers as a screen: what the family should collect, what it
-- has, and from whom.
--
-- ── WHY IT IS A ROUTE OF ITS OWN ────────────────────────────────────────────
-- Three places it could have gone, and two of them are wrong:
--
--   /admin/account   is CONFIGURATION — schedules, funds, routing, milestones. A
--                    projection is neither configuration nor a ledger, and the
--                    Accounting rail's own copy draws that line already.
--   /admin/reports   sells four things ("membership, dues collected vs. outstanding,
--                    RSVP turnout, t-shirt counts") and is `status: 'future'`.
--                    Flipping it live to deliver one of the four would put a screen
--                    behind a card that promises three things it does not do.
--   /dues            is the MEMBER's own screen, own-only by construction. Nothing
--                    family-wide belongs behind that key.
--
-- So: `dues-projections`, which is the route without its leading slash, per §1. A rail
-- item is a job a family delegates, and "tell me what we are owed" is a different job
-- from "tell me what I owe".
--
-- ── RESTRICTED BY DEFAULT, WHICH IS THE POINT OF THIS FILE ──────────────────
-- §6 is explicit that a resource registered later has no row in the templates that
-- already exist, so it falls back to `resource_visibility` — and the default there is
-- `everyone` for view. That default is right for a page of marketing copy and wrong
-- here: this screen names every member and states what each of them still owes. A
-- family would have shipped their whole dues ledger to every relative and nothing
-- would have said so.
--
-- Hence §2 below, which is the same backfill 20260806000007 and 20260806000010 do, and
-- the reason this migration exists at all rather than a line in the seed.
--
-- ── AND IT IS `plus`, WHICH IS NOT THIS FILE'S DECISION ─────────────────────
-- `lib/plans.ts` already sells "Dues collected against outstanding" on the Plus card,
-- under "The numbers leadership asks for". Shipping this Free would make an existing
-- paid bullet describe a free feature — the drift FutureFeature.md §4 tracks in the
-- other direction. The tier lives in `lib/features.ts` and no policy consults it: it
-- withholds the SCREEN and never a row, so nothing here mentions it.
--
-- ── VIEW IS THE ONLY ACTION ─────────────────────────────────────────────────
-- Nothing on this screen writes. Recording a payment is `transactions/dues-payments`,
-- waiving one is the same key, and changing what a due costs is
-- `admin/account/dues`. A create or edit switch here would be a control nothing reads
-- — the thing AGENTS.md says to check for by naming the policy, the map row or the
-- can*() call that would consult it. There is none.
--
-- NO permission_table_map ROW. This key gates a SCREEN, not a table. The tables behind
-- it — dues_schedules, people, dues_payments, dues_member_plans — keep the mapping
-- they have, and the action reads them on the service role with family scoping applied
-- by hand (§3). §4 asserts the absence rather than describing it, because a future RLS
-- sweep that re-composes policies from map rows is exactly what 20260808000001 removed
-- the old `dues` map rows to prevent.
--
-- IDEMPOTENT. Every write is ON CONFLICT; safe on an empty database, where the
-- backfills find no families and no templates.
--
-- HOW THIS REACHES A DATABASE
--   `supabase db push`, from CI on merge to master — never `psql -f` by hand, which
--   records nothing and can replay this file out of order. See AGENTS.md, "How
--   migrations reach the hosted project".
-- ============================================================================

BEGIN;

-- ── 1. The resource ────────────────────────────────────────────────────────
-- sort_order 125, which is the gap between the Transactions block and Family Finances
-- (130) — the position the rail gives it. Two lists of the same items in two different
-- orders is a thing an administrator has to reconcile by hand.
--
-- 116 WAS THE FIRST ANSWER AND IS WRONG: `transactions` is 115 and its six sub-keys run
-- 116-121, so 116 is `transactions/dues-payments`. §4's duplicate check is what caught
-- that, on the first `db reset` — which is the whole reason a "one row per sort_order"
-- assertion is worth having rather than a comment claiming the numbers are unique.
--
-- The caption is the one on the screen (AGENTS.md, "One rail item, one permission
-- resource"): the page's h1, the rail item and this row all say "Dues Projections".
--
-- NO SUBSECTION — a top-level rail item, beside Summary, Dues and Transactions rather
-- than indented under a heading.
INSERT INTO public.permission_resources (key, label, category, subsection, sort_order, actions) VALUES
  ('dues-projections', 'Dues Projections', 'accounting', NULL, 125, ARRAY['view']::TEXT[])
ON CONFLICT (key) DO UPDATE
  SET label      = EXCLUDED.label,
      category   = EXCLUDED.category,
      subsection = EXCLUDED.subsection,
      sort_order = EXCLUDED.sort_order,
      actions    = EXCLUDED.actions;

-- ── 2. Restricted for every existing family ────────────────────────────────
-- The whole reason this file is not a seed edit. Without it the key falls back to
-- 'everyone' for view and every member reads every other member's outstanding balance.
--
-- Keyed off `people.family_code` rather than `families.family_code`, matching
-- 20260806000007: it is the column every other backfill in this chain walks, and a
-- family with no people has nobody to withhold the screen from.
INSERT INTO public.resource_visibility (family_code, resource_key, visibility)
SELECT DISTINCT p.family_code, 'dues-projections', 'restricted'
  FROM public.people p
 WHERE p.family_code IS NOT NULL AND p.family_code <> ''
ON CONFLICT (family_code, resource_key) DO NOTHING;

-- ── 3. Whoever already runs the family's money gets it ─────────────────────
-- Restricted with nobody granted is a screen that exists and cannot be opened, so the
-- grant follows the one that already answers "may this person see what the family
-- collected": `transactions/dues-payments` at scope 'any' — the same key
-- getFamilyDuesCollected() checks for the Dashboard's Dues Collected tile, and the same
-- one the dues_payments SELECT policy tests. Anybody who can already read the whole
-- ledger can read a sum of it.
--
-- SCOPE 'any' ONLY, on both sides. An own-scoped ledger grant means "your own
-- payments", which is not a claim to the family's projection — and `dues-projections`
-- is in NO_OWNER_KEYS precisely so 'own' is never offered on it. Writing 'any' here
-- rather than copying tp.scope is what keeps that true.
--
-- DO NOTHING, so a re-run never stamps over a grant an administrator has since
-- adjusted, and a family that deliberately removed this keeps it removed.
INSERT INTO public.template_permissions (template_id, resource_key, action, scope, updated_at)
SELECT DISTINCT tp.template_id, 'dues-projections', 'view'::public.permission_action,
       'any'::public.permission_scope, NOW()
  FROM public.template_permissions tp
 WHERE tp.resource_key = 'transactions/dues-payments'
   AND tp.action = 'view'
   AND tp.scope = 'any'
ON CONFLICT (template_id, resource_key, action) DO NOTHING;

-- ── 3b. THE SAME DEFAULT FOR A FAMILY CREATED TOMORROW ─────────────────────
-- §2 covers every family that exists. It does NOT cover the next one, and without this
-- the restriction would hold for today's families and silently fail for every family
-- created after — the worst shape a permission default can have, because the first
-- family to be affected is the one nobody is watching.
--
-- `seed_family_permission_templates()` (20260807000000) materializes both templates for a
-- new family, and its General grid reads:
--
--     WHEN a = 'view' AND pr.category <> 'admin' THEN 'any' ELSE 'none'
--
-- `dues-projections` is `accounting`, so General would be handed view 'any' on it — an
-- EXPLICIT row, which §6 says beats the resource_visibility fallback. Every member of a
-- new family would open the screen and read every other member's outstanding balance.
--
-- THE FIX MAKES VISIBILITY THE SINGLE SOURCE OF THE DEFAULT rather than adding a second
-- list to keep in step. The function already seeds 'restricted' for every admin key
-- immediately above the General insert; this widens that seed by a named set and then has
-- the General grid ASK what was seeded instead of re-deriving it from the category. The
-- two now cannot disagree, because one reads the other.
--
-- Behaviour is unchanged for every existing key: an admin key gets a restricted row and
-- resolves to 'none' exactly as `category <> 'admin'` gave it; a non-admin key with no
-- restricted row still resolves to 'any'. The only new answer is for the keys named in
-- v_restricted, which is the point.
--
-- A NON-ADMIN RESOURCE THAT MUST NOT BE FAMILY-WIDE BY DEFAULT GOES IN `v_restricted`,
-- and that is the one thing to remember when adding one. Nothing enforces it; §4 below
-- asserts it for this key, which is as far as an assertion can reach.
--
-- Reproduced in full because CREATE OR REPLACE takes a whole body. Both gates are
-- verbatim from the original and must stay so: this function was callable with the ANON
-- key before 20260806000016, and its ON CONFLICT DO NOTHING inserts made an
-- unauthenticated call a way to RESTORE an administrative grant somebody had deleted. A
-- change to the General grid is not a reason to re-open that.
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
  -- members' money belongs here; a page of the family's own records does not.
  v_restricted text[] := ARRAY['dues-projections'];
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

  -- CHANGED HERE, and this is the whole of 3b: the view default now asks what the family
  -- has restricted rather than re-deriving it from the category. Same answer for every
  -- key that existed before, and 'none' for the ones named in v_restricted.
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

-- The grant is restated because CREATE OR REPLACE does not change privileges and this
-- must stay unreachable from a browser — 20260806000015 made grants the primary control,
-- and `service_role` keeps EXECUTE by default. Stated rather than assumed, because the
-- one thing this function must never become again is anon-callable.
REVOKE ALL ON FUNCTION public.seed_family_permission_templates(text) FROM PUBLIC, anon, authenticated;

-- ── 4. The two things that must stay absent ────────────────────────────────
-- Asserted rather than described, and both run unconditionally against the catalogue —
-- no fixture, so this cannot report success by skipping (AGENTS.md, "A verify block
-- that can skip must not be the only check").
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.permission_resources WHERE key = 'dues-projections'
  ) THEN
    RAISE EXCEPTION 'dues-projections was not registered';
  END IF;

  -- It gates a screen, never a table. A map row here would put the key into a composed
  -- RLS policy, which is the shape 20260808000001 dismantled for the old `dues` key.
  IF EXISTS (
    SELECT 1 FROM public.permission_table_map WHERE resource_key = 'dues-projections'
  ) THEN
    RAISE EXCEPTION 'dues-projections must not map to a table — it gates a screen';
  END IF;

  -- No policy may consult it. Checked against pg_policies rather than trusted, because
  -- the policies in this chain are COMPOSED at migration time and hosted has drifted
  -- from the chain before.
  IF EXISTS (
    SELECT 1 FROM pg_policies
     WHERE schemaname = 'public'
       AND (COALESCE(qual, '') || COALESCE(with_check, '')) LIKE '%dues-projections%'
  ) THEN
    RAISE EXCEPTION 'a policy evaluates dues-projections — it gates a screen, not rows';
  END IF;

  -- One row per key in the category, which is the invariant 20260806000005
  -- established and the thing a mis-typed sort_order breaks silently.
  IF EXISTS (
    SELECT sort_order FROM public.permission_resources
     WHERE category = 'accounting'
     GROUP BY sort_order HAVING COUNT(*) > 1
  ) THEN
    RAISE EXCEPTION 'two accounting resources share a sort_order';
  END IF;

  -- 3b actually took. Reading the function's own source is the only check available: the
  -- alternative is creating a family to see what it seeds, and a migration must not.
  IF NOT EXISTS (
    SELECT 1 FROM pg_proc p
     JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.proname = 'seed_family_permission_templates'
      AND pg_get_functiondef(p.oid) LIKE '%dues-projections%'
  ) THEN
    RAISE EXCEPTION 'seed_family_permission_templates() would grant a new family dues-projections';
  END IF;

  -- And that no browser role can call it. 20260806000015 made grants the primary
  -- control, and a CREATE OR REPLACE that silently widened this would be the second time
  -- this function was reachable with the anon key.
  IF has_function_privilege('anon', 'public.seed_family_permission_templates(text)', 'EXECUTE')
     OR has_function_privilege('authenticated', 'public.seed_family_permission_templates(text)', 'EXECUTE')
  THEN
    RAISE EXCEPTION 'seed_family_permission_templates() is executable by a browser role';
  END IF;
END $$;

COMMIT;
