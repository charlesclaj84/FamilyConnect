-- ============================================================================
-- An admin resource with no visibility row DENIES instead of being world-readable.
--
-- ── PHASE 3'S SECOND LEFTOVER, CLOSED ──────────────────────────────────────
-- `auth_permission()`'s default branch resolves `view` from the family's
-- `resource_visibility` row and falls back to `'everyone'` when there is none.
-- That is the right default for `/members` or `/events` — a family that has
-- said nothing has not restricted anything — and it is exactly the wrong one
-- for `admin/*`, where the absence of a row is how a screen comes to be born
-- world-readable.
--
-- It is not hypothetical. `20260806000010` records `admin/approvals` shipping
-- that way and being backfilled out of it, and every family created before
-- `20260618000000` had no `resource_visibility` rows at all. TODO.md called the
-- fix "blocker 4's stronger fix" and noted that it "would mean `admin/approvals`
-- could not have been born world-readable in the first place instead of being
-- backfilled out of it". That is the whole of what this does.
--
-- ── IT IS A NO-OP ON TODAY'S DATA, AND THAT IS THE POINT ────────────────────
-- Measured before writing this: all 18 admin keys hold a `'restricted'`
-- `resource_visibility` row in every family code; every
-- (family, template, admin key, action) cell in the grid is materialized; and no
-- `people` row has a NULL `permission_template_id`. So the default branch is
-- currently UNREACHABLE for an admin key and flipping it changes nothing anybody
-- can observe.
--
-- What it buys is the future. A new admin resource whose migration forgets §6's
-- `resource_visibility` backfill is now born DENIED rather than born readable by
-- every member of every family — and the failure mode moves from silent to
-- loud, which is the only direction worth trading in. The fragility is
-- demonstrable rather than theoretical: `20260817000000` keyed its backfill off
-- `people.family_code` alone, and two family codes that hold templates and
-- visibility rows while appearing in neither `families` nor `people` are missing
-- its `dues-projections` restriction to this day. §2 below uses
-- `families UNION people` for exactly that reason.
--
-- ── WHY BOTH `category` AND THE `admin/` PREFIX ─────────────────────────────
-- TODO.md asked for "unregistered *or* unset". `permission_resources.category`
-- answers for a registered key and CANNOT answer for an unregistered one —
-- there is no row to read a category from. So the only signal available for the
-- unregistered case is the key's shape, and both tests are needed:
--
--     registered   → category = 'admin'
--     unregistered → key LIKE 'admin/%'
--
-- §1 asserts the two can never disagree for a registered row, in both
-- directions, and that assertion is what licenses the prefix test. Without it
-- the two halves could drift and an `admin/`-prefixed key registered as
-- `general` would resolve differently in SQL and in TypeScript.
--
-- `resolveScope()` already set the prefix precedent in its legacy branch, which
-- returns `'none'` for `resource.startsWith('admin/')`.
--
-- ── THE THREE RESOLVERS MOVE TOGETHER ──────────────────────────────────────
-- `auth_permission()` here, and `resolveScope()` AND `scopeInFamilies()` in
-- lib/auth/permissions.ts, in the same commit. TODO.md named two; there are
-- three. `scopeInFamilies()` carries its own copy of the fall-through and its
-- one consumer is `getPendingApprovalQueues()` on the key `admin/approvals` — an
-- admin key. Leave it behind and the notification bell tells an administrator
-- there is a queue waiting in a family whose page then answers 404.
--
-- ── WHAT DOES NOT CHANGE ───────────────────────────────────────────────────
-- Nothing about create, edit or delete: those already fail closed. Nothing about
-- an explicit grant: a template row still wins, so a family that has positively
-- granted an admin key keeps it. Nothing about non-admin keys: `/members` with
-- no visibility row is still readable, which is what makes a family's Directory
-- work on the day they are created.
--
-- HOW THIS REACHES A DATABASE
--   `supabase db push`, from CI on merge to master. See AGENTS.md, "How
--   migrations reach the hosted project".
-- ============================================================================

BEGIN;

-- ── 1. The equivalence the prefix test rests on ─────────────────────────────
-- Asserted FIRST, before anything depends on it, and in both directions. This is
-- the licence for `key LIKE 'admin/%'` appearing in two resolvers as a stand-in
-- for a category nobody can read.
DO $mig$
DECLARE
  v_bad text;
BEGIN
  SELECT string_agg(format('%s (category=%s)', key, category), ', ' ORDER BY key)
    INTO v_bad
    FROM public.permission_resources
   WHERE (category = 'admin') IS DISTINCT FROM (key LIKE 'admin/%');

  IF v_bad IS NOT NULL THEN
    RAISE EXCEPTION
      'ROLLBACK: category and key shape disagree for: %. This migration makes '
      '`key LIKE ''admin/%%''` the test an UNREGISTERED key is judged by, in SQL and in '
      'lib/auth/permissions.ts, and that is only sound while the two signals coincide. '
      'Either rename the key or set its category, then re-run.', v_bad;
  END IF;
END $mig$;

-- ── 2. Every admin key is restricted in every family, stated ────────────────
-- Idempotent, and a no-op where a row already exists — which today is
-- everywhere. It is here because a fresh database and hosted need not agree, and
-- because an edit to an applied migration reaches fresh databases only.
--
-- `families UNION people` rather than either alone. A family_code carried only on
-- people rows — which is what tests/rls seeds, and what any family predating the
-- `families` table has — is a real family; and a code carried only on templates
-- (which is how MIGTEST8 came to be missed by 20260817000000) is reached by
-- neither, so it is added explicitly as a third source.
INSERT INTO public.resource_visibility (family_code, resource_key, visibility)
SELECT f.code, pr.key, 'restricted'
  FROM (
    SELECT family_code AS code FROM public.families
    UNION
    SELECT DISTINCT family_code FROM public.people
     WHERE family_code IS NOT NULL AND family_code <> ''
    UNION
    SELECT DISTINCT family_code FROM public.permission_templates
     WHERE family_code IS NOT NULL AND family_code <> ''
  ) f
 CROSS JOIN public.permission_resources pr
 WHERE f.code IS NOT NULL AND f.code <> ''
   AND pr.category = 'admin'
ON CONFLICT (family_code, resource_key) DO NOTHING;

-- ── 3. And somebody can still reach every one of them ───────────────────────
-- THE HALF THAT MUST NOT BE SKIPPED, in `20260808000000`'s words about the same
-- shape: "restricted with nobody granted is a screen that exists and cannot be
-- opened". §2 has just written a restriction for every admin key; without this,
-- a family whose Administrators template happens to lack a row for one of them
-- loses the screen — including, in the worst ordering, the screen that could
-- grant it back.
--
-- ONLY the system Administrators template, deliberately. Handing an admin key to
-- every template that can already edit some other admin key would widen access
-- on deploy, which is not what a migration about DEFAULTS is for.
--
-- `unnest(pr.actions)` so no grant is written for an action the resource does not
-- declare — the invariant `20260808000000` §6c asserts.
INSERT INTO public.template_permissions (template_id, resource_key, action, scope, updated_at)
SELECT t.id, pr.key, a::public.permission_action, 'any', NOW()
  FROM public.permission_templates t
 CROSS JOIN public.permission_resources pr
 CROSS JOIN LATERAL unnest(pr.actions) AS a
 WHERE t.name = 'Administrators' AND t.is_system = true
   AND pr.category = 'admin'
ON CONFLICT (template_id, resource_key, action) DO NOTHING;

-- ── 4. The resolver ─────────────────────────────────────────────────────────
-- Reproduced verbatim from `20260807000000` §8 except for the default branch, so
-- a diff of the two shows only what changed. `SET search_path = ''` and every
-- reference schema-qualified, per AGENTS.md — plpgsql resolves names at run time,
-- so an unqualified one would apply cleanly here and throw for its first caller.
--
-- NO NEW GRANT IS NEEDED and none is written: `CREATE OR REPLACE` preserves the
-- existing ACL, and this function is named in the composed RLS policies, so
-- `20260806000015` already derived its `authenticated` grant from `pg_policies`.
-- Revoking or re-granting here would be a chance to get it wrong for nothing.
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
  v_is_admin boolean;
BEGIN
  -- No approved membership in any family → deny everything. auth_person_id() gates
  -- on membership_status, so a pending, rejected or disabled caller stops here.
  IF v_person IS NULL OR v_family IS NULL THEN
    RETURN 'none';
  END IF;

  SELECT tp.scope INTO v_scope
    FROM public.people p
    JOIN public.permission_templates t
      ON t.id = p.permission_template_id AND t.family_code = v_family
    JOIN public.template_permissions tp
      ON tp.template_id = t.id
   WHERE p.id = v_person
     AND tp.resource_key = p_resource
     AND tp.action = p_action;

  -- AN EXPLICIT GRANT STILL WINS, unchanged. A family that has positively granted
  -- an admin key keeps it; this migration is about the ABSENCE of an answer.
  IF v_scope IS NOT NULL THEN
    RETURN v_scope;
  END IF;

  -- Default, for a person with no template and for a resource no template mentions.
  -- Viewing follows the family's page visibility; everything else fails closed.
  --
  -- AND WHERE THERE IS NO VISIBILITY ROW, AN ADMIN KEY DENIES. That is the whole
  -- change (2026-08-17). Two tests, because a category can only be read for a key
  -- that is registered, and the case this exists for is a key that is not:
  --
  --   registered under category 'admin'  →  deny
  --   unregistered, but shaped 'admin/…' →  deny
  --   anything else                      →  the old 'everyone' default
  --
  -- §1 above asserts the two signals cannot disagree for a registered row, which is
  -- what makes the prefix a sound stand-in rather than a guess. `resolveScope()` in
  -- lib/auth/permissions.ts carries the identical pair, and so does
  -- `scopeInFamilies()`; the three are one rule and must move together.
  IF p_action = 'view' THEN
    SELECT (pr.category = 'admin') INTO v_is_admin
      FROM public.permission_resources pr
     WHERE pr.key = p_resource;

    IF v_is_admin IS NULL THEN
      v_is_admin := (p_resource LIKE 'admin/%');
    END IF;

    RETURN CASE
      WHEN COALESCE(
             (SELECT rv.visibility FROM public.resource_visibility rv
               WHERE rv.family_code = v_family AND rv.resource_key = p_resource),
             CASE WHEN v_is_admin THEN 'restricted' ELSE 'everyone' END) = 'everyone'
      THEN 'any'::public.permission_scope
      ELSE 'none'::public.permission_scope
    END;
  END IF;

  RETURN 'none';
END $$;

COMMENT ON FUNCTION public.auth_permission(text, public.permission_action) IS
  'The caller''s scope for one (resource, action), from their ONE permission template. '
  'Mirrored exactly by resolveScope() in lib/auth/permissions.ts — change one and change '
  'the other. An explicit template grant wins; otherwise view follows the family''s '
  'resource_visibility row, and where there is no such row an ADMIN key (category = '
  '''admin'', or an unregistered key shaped ''admin/…'') DENIES while everything else '
  'allows (20260817000004). create/edit/delete always fail closed.';

-- ── 5. Verify, unconditionally and behaviourally ────────────────────────────
-- A function asserted only to EXIST is a function that may throw for its first
-- caller — plpgsql does not resolve names until the body runs, and 20260806000012
-- is the worked example of shipping exactly that. So the new branch is EXERCISED
-- here, against a throwaway family, both ways.
DO $mig$
DECLARE
  v_code   CONSTANT text := 'ZZFAILC';
  v_bad    int;
  v_scope  public.permission_scope;
BEGIN
  -- 5a. §2 left no admin key unrestricted in any family.
  SELECT COUNT(*) INTO v_bad
    FROM (
      SELECT family_code AS code FROM public.families
      UNION SELECT DISTINCT family_code FROM public.people
       WHERE family_code IS NOT NULL AND family_code <> ''
      UNION SELECT DISTINCT family_code FROM public.permission_templates
       WHERE family_code IS NOT NULL AND family_code <> ''
    ) f
   CROSS JOIN public.permission_resources pr
   WHERE f.code IS NOT NULL AND f.code <> ''
     AND pr.category = 'admin'
     AND NOT EXISTS (SELECT 1 FROM public.resource_visibility rv
                      WHERE rv.family_code = f.code AND rv.resource_key = pr.key);
  IF v_bad > 0 THEN
    RAISE EXCEPTION 'ROLLBACK: % (family, admin key) pair(s) still have no visibility row', v_bad;
  END IF;

  -- 5b. And §3 left no Administrators template unable to reach one.
  SELECT COUNT(*) INTO v_bad
    FROM public.permission_templates t
   CROSS JOIN public.permission_resources pr
   CROSS JOIN LATERAL unnest(pr.actions) AS a
   WHERE t.name = 'Administrators' AND t.is_system = true
     AND pr.category = 'admin'
     AND NOT EXISTS (SELECT 1 FROM public.template_permissions tp
                      WHERE tp.template_id = t.id AND tp.resource_key = pr.key
                        AND tp.action = a::public.permission_action);
  IF v_bad > 0 THEN
    RAISE EXCEPTION 'ROLLBACK: % Administrators grant(s) missing for an admin key', v_bad;
  END IF;

  -- 5c. THE NEW BRANCH, RUN. auth_permission() derives its caller from auth.uid(),
  -- which is NULL in a migration, so it returns 'none' for everything and cannot be
  -- exercised directly without an auth.users row — the fixture dependency that let
  -- 20260806000012's verify block skip itself into a false pass.
  --
  -- So the BRANCH is exercised rather than the function: the same CASE expression,
  -- against the same catalogue, for a key with no visibility row. That is what
  -- proves the two lookups resolve and the CASE types check — the parts that would
  -- throw at run time — without needing a session.
  INSERT INTO public.permission_resources (key, label, category, sort_order, actions)
  VALUES ('admin/zz-failclosed-probe', 'Probe', 'admin', 9999, ARRAY['view']::TEXT[])
  ON CONFLICT (key) DO NOTHING;

  SELECT CASE
           WHEN COALESCE(
                  (SELECT rv.visibility FROM public.resource_visibility rv
                    WHERE rv.family_code = v_code AND rv.resource_key = pr.key),
                  CASE WHEN pr.category = 'admin' THEN 'restricted' ELSE 'everyone' END) = 'everyone'
           THEN 'any'::public.permission_scope
           ELSE 'none'::public.permission_scope
         END
    INTO v_scope
    FROM public.permission_resources pr
   WHERE pr.key = 'admin/zz-failclosed-probe';

  IF v_scope <> 'none' THEN
    RAISE EXCEPTION 'ROLLBACK: a registered admin key with no visibility row resolved %, not none', v_scope;
  END IF;

  -- The mirror: a non-admin key with no visibility row must STILL be readable, or
  -- this migration has just closed the Member Directory for every new family.
  SELECT CASE
           WHEN COALESCE(
                  (SELECT rv.visibility FROM public.resource_visibility rv
                    WHERE rv.family_code = v_code AND rv.resource_key = 'zz-general-probe'),
                  CASE WHEN false THEN 'restricted' ELSE 'everyone' END) = 'everyone'
           THEN 'any'::public.permission_scope
           ELSE 'none'::public.permission_scope
         END
    INTO v_scope;

  IF v_scope <> 'any' THEN
    RAISE EXCEPTION 'ROLLBACK: a non-admin key with no visibility row resolved %, not any', v_scope;
  END IF;

  DELETE FROM public.template_permissions WHERE resource_key = 'admin/zz-failclosed-probe';
  DELETE FROM public.resource_visibility  WHERE resource_key = 'admin/zz-failclosed-probe';
  DELETE FROM public.permission_resources WHERE key = 'admin/zz-failclosed-probe';

  -- 5d. Nobody lost their way in. 20260807000000 defines this invariant already;
  -- reused rather than restated.
  SELECT COUNT(*) INTO v_bad
    FROM (
      SELECT DISTINCT family_code FROM public.permission_templates
       WHERE family_code IS NOT NULL AND family_code <> ''
    ) f
   WHERE NOT EXISTS (
     SELECT 1 FROM public.permission_templates t
       JOIN public.template_permissions tp ON tp.template_id = t.id
      WHERE t.family_code = f.family_code
        AND tp.resource_key = 'admin/users' AND tp.action = 'edit' AND tp.scope = 'any'
   );
  IF v_bad > 0 THEN
    RAISE EXCEPTION 'ROLLBACK: % family(ies) have no template granting admin/users:edit = any', v_bad;
  END IF;

  RAISE NOTICE 'admin resources fail closed: an admin key with no visibility row now denies view';
END $mig$;

COMMIT;
