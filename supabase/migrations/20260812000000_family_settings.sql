-- ============================================================================
-- A family can be renamed. `admin/family` is the surface that lets it.
--
-- WHAT WAS MISSING
--   `families` was INSERTed by register.ts and create_family(), SELECTed in half a
--   dozen places, and updated by NOTHING in the tree. A family typed its name once,
--   at the moment it was created, by somebody who had not yet seen the product — and
--   then lived with it. There was no page for it because none of the eighteen
--   `admin/*` resources is the family's own identity: they cover accounting, members,
--   events, elections and reports, which is everything ABOUT running a family and
--   nothing about which family it is.
--
--   So this registers a nineteenth, `admin/family`, rendered at /admin/family.
--
-- WHY RENAMING IS SAFE, which is worth stating because it is the whole reason this
-- half could ship on its own: `family_code` is the join key, carried by 34 tables,
-- and `family_name` is carried by NONE of them. Nothing joins on the name, nothing
-- keys on it, and no policy reads it. Changing it cannot orphan a row.
--
--   Deleting a family is the other half and is NOT here. Nothing cascades from
--   `families` — no table has a foreign key to it — so a DELETE removes one row and
--   leaves every dues payment, fund, chat room and member behind, belonging to a
--   family that no longer exists. That needs a dependency-ordered sweep and two
--   product decisions (does it delete accounts; is there an archived state), and it
--   is recorded in TODO.md rather than half-built here.
--
-- ACTIONS: view + edit, and only those
--   `create` — families are created from /my-families, by any member, through
--              create_family(). It is not an administrative act and there is no
--              switch to offer.
--   `delete` — see above. A switch nothing reads is the thing 20260808000000 spent a
--              section removing; this resource is not born with two of them.
--
-- ── HOW THE WRITE REACHES THE DATABASE, AND THE THREE THINGS HOLDING IT ──────
--
-- 1. AN UPDATE POLICY, NOT AN RPC AND NOT THE SERVICE ROLE.
--    `families` carried exactly one policy — SELECT — so a rename could not go
--    through the user client at all. Everything else about it can: the row is
--    identified by auth_family_code(), the grant by auth_permission(), and both are
--    already the app's authorization. AGENTS.md §3 prefers the user client wherever
--    RLS can do the work, and §7 is the payoff — an RLS-path action gets a real case
--    in tests/rls, run against the real policy, which an admin-client write does not.
--
--    `= 'any'` rather than auth_can(), deliberately. auth_can() is `scope <> 'none'`,
--    so it admits 'own' — and a family has no owner. There is no personal copy of the
--    family's name to hold, so honouring 'own' would make a deliberately narrowed
--    grant mean exactly what the unrestricted one means. This is the reason canAny()
--    exists in lib/auth/permissions.ts, expressed in SQL; renameFamily() uses canAny()
--    for the same reason and scopesFor() stops offering the button.
--
-- 2. A GUARD ON `family_code`, because a policy has no opinion about which column
--    changed. The policy admits an administrator's write to their own family's row,
--    and PostgREST will happily PATCH any column on it:
--
--        PATCH /rest/v1/families?family_code=eq.MINE   {"family_code": "XXXXXX"}
--
--    Today the WITH CHECK refuses that — the new row's family_code would no longer
--    equal auth_family_code() — but only INCIDENTALLY. That conjunct is there to
--    scope the row to the caller's family, and a later migration that rephrases it
--    (to let someone rename any family they belong to, say) would make the column
--    writable without anyone noticing. What would follow is not a bug report: 34
--    tables carry family_code, none has a foreign key to `families`, so the family
--    would simply cease to contain any of its own data, irreversibly, with no error
--    anywhere. The trigger states the protection instead of inheriting it.
--
--    ABSOLUTE, not `current_user = 'authenticated'` as people_guard_permission_template
--    is. Nothing in the tree updates families.family_code by any route — not the app,
--    not the four scripts in supabase/scripts/ — so there is no legitimate caller to
--    keep working, and an absolute refusal is both stronger and testable without a
--    role switch. A future migration that genuinely needs to re-key a family drops
--    the trigger deliberately, which is the right amount of ceremony for that.
--
--    `created_by` is deliberately NOT guarded. delete_user.sql, delete_user_hard_purge
--    .sql and delete_all_users.sql all null it out, so an absolute guard would break
--    three working scripts; and reaching it through the policy needs admin/family:edit,
--    which is already an administrative grant. It decides one thing —
--    tg_person_default_permission_template() recognises the founder by it — and an
--    administrator who can set it can assign that template outright anyway.
--
--    A COLUMN-LEVEL GRANT would have been the tidier tool for all of this:
--    `REVOKE UPDATE ON families FROM authenticated; GRANT UPDATE (family_name) …`.
--    It is not used because it would not be ENFORCEMENT here. supabase/seed.sql runs
--    `GRANT ALL ON ALL TABLES IN SCHEMA public TO anon, authenticated, service_role`
--    on every local reset, which would restore the table-level UPDATE and silently
--    undo it — the same re-opening AGENTS.md §2b records for the function REVOKEs, in
--    a costume where nothing would ever fail to tell you. A trigger nothing re-creates
--    is the layer that survives.
--
-- 3. `auth_membership_approved()`, on both branches, as every write policy has
--    carried since 20260806000011. auth_permission() already denies a non-approved
--    caller through auth_person_id(), so this is belt and braces — and it is written
--    out rather than assumed for the reason 20260807000000 §6 gives: a policy dropped
--    and recreated without it quietly re-admits an applicant.
--
-- AND ONE THING DELIBERATELY NOT DONE: `families` gets NO permission_table_map row,
-- although AGENTS.md §2 says that table is where "which resource key governs which
-- table" is recorded. Nothing reads the map at runtime — it is consumed by
-- 20260618000001, which COMPOSES policies out of it, and by 20260806000011 §8, which
-- recomputes the swept table list from it and RAISEs if any policy on any of those
-- tables lacks the approval conjunct. So a row here would do nothing today and two
-- things on a replay: the sweep would compose its own policies over the hand-written
-- ones below, and §8 would fail the deploy on the SELECT policy, which correctly has
-- no approval conjunct (a pending member must be able to read the name of the family
-- they are waiting on). The map is for tables the sweep owns. This is not one.
--
-- ── THE TWO BACKFILLS, BOTH SEPARATELY NECESSARY (AGENTS.md §6) ──────────────
--   §2  a 'restricted' resource_visibility row per existing family. Without it view
--       falls through to 'any' and the page is born readable by every member of every
--       family that already exists — seed_family_permission_templates() restricts the
--       admin category per family at CREATION time, so it reaches none of them.
--   §3  view+edit 'any' for each family's system Administrators template. Without it
--       nobody can reach the page at all: a template's grid is the whole answer since
--       20260807000000, and a resource registered later has no row in the templates
--       that already exist.
--
-- ALSO EDITED: 20260618000000's seed gained this key, so a fresh database registers
-- it early enough for that file's own visibility loop and for every dynamic loop
-- between there and here. It is added there WITHOUT the `actions` column on purpose —
-- that column does not exist until 20260806000000 — so a fresh database registers it
-- with the default four actions and §1 below narrows it to two. §3c then removes the
-- create/delete grants the intervening materialization handed out, which is what
-- keeps 20260808000000 §6c ("no grant for an action its resource does not declare")
-- true on a replayed chain.
--
-- IDEMPOTENT. Every insert is ON CONFLICT, every backfill is DO NOTHING, the policy
-- and the trigger are dropped and recreated. Safe on an empty database, where §2 and
-- §3 find no families and only the resource row is written.
--
-- HOW THIS REACHES A DATABASE
--   `supabase db push`, from CI on merge to master — never `psql -f` by hand, which
--   records nothing and can replay this file out of order. See AGENTS.md, "How
--   migrations reach the hosted project".
-- ============================================================================

BEGIN;

-- ── 1. The resource ─────────────────────────────────────────────────────────
-- sort_order 155 puts Family Settings at the TOP of the Administration block, ahead
-- of Members & Access (160). Which family this is comes before who is in it, and the
-- slot was free — 150 is Elections in the resources category, 160 the next admin row.
--
-- No `subsection`: it is a page, not a tab of one, and a sub-heading over a single
-- row reads as a grouping that is not there (20260806000010 §1 declined it for the
-- same reason, until admin/users/templates arrived beside it).
INSERT INTO public.permission_resources (key, label, category, sort_order, actions)
VALUES ('admin/family', 'Family Settings', 'admin', 155, ARRAY['view','edit']::TEXT[])
ON CONFLICT (key) DO UPDATE
  SET label      = EXCLUDED.label,
      category   = EXCLUDED.category,
      sort_order = EXCLUDED.sort_order,
      actions    = EXCLUDED.actions;

-- ── 2. Restricted for every existing family ─────────────────────────────────
-- Sourced from BOTH tables for 20260806000010 §2's reason: a family_code carried only
-- on people rows — which is what tests/rls seeds, and what any family predating the
-- `families` table has — is a real family and must not be missed.
INSERT INTO public.resource_visibility (family_code, resource_key, visibility)
SELECT f.code, 'admin/family', 'restricted'
  FROM (
    SELECT family_code AS code FROM public.families
    UNION
    SELECT DISTINCT family_code FROM public.people
     WHERE family_code IS NOT NULL AND family_code <> ''
  ) f
 WHERE f.code IS NOT NULL AND f.code <> ''
ON CONFLICT (family_code, resource_key) DO NOTHING;

-- ── 3a. Administrators may rename ───────────────────────────────────────────
-- The system Administrators template is seeded 'any' on every resource for every
-- family (seed_family_permission_templates()); this extends that standing rule to the
-- key those loops ran too early to see.
--
-- Deliberately ONLY the system template, and not "every template that can edit
-- admin/users". Naming the family is a different decision from maintaining its roster,
-- and silently handing it to whoever holds the latter would widen access on deploy.
-- An administrator can grant it to any other template from Members & Access.
--
-- FIRST, before the generic default in §3b, because that one is ON CONFLICT DO
-- NOTHING and would otherwise leave Administrators sitting on the computed 'none'.
INSERT INTO public.template_permissions (template_id, resource_key, action, scope, updated_at)
SELECT t.id, 'admin/family', a::public.permission_action, 'any', NOW()
  FROM public.permission_templates t
 CROSS JOIN (VALUES ('view'), ('edit')) AS x(a)
 WHERE t.name = 'Administrators' AND t.is_system = true
ON CONFLICT (template_id, resource_key, action) DO NOTHING;

-- ── 3b. Every other template states the answer rather than falling through ──
-- 20260807000000 §7 materialized every grid so the screen can show the whole answer
-- without explaining a fall-through rule, and §7 itself notes that a resource
-- registered by a LATER migration is the one case that survives on the default. This
-- writes that default down for this key, computed exactly as auth_permission() would:
-- view follows the family's page visibility (which §2 has just set to 'restricted'),
-- and edit fails closed. Behaviour is therefore unchanged by this insert — what
-- changes is that the grid has a row to render.
INSERT INTO public.template_permissions (template_id, resource_key, action, scope)
SELECT t.id, 'admin/family', a::public.permission_action,
       CASE
         WHEN a = 'view' AND COALESCE(
                (SELECT rv.visibility FROM public.resource_visibility rv
                  WHERE rv.family_code = t.family_code AND rv.resource_key = 'admin/family'),
                'everyone') = 'everyone'
         THEN 'any'::public.permission_scope
         ELSE 'none'::public.permission_scope
       END
  FROM public.permission_templates t
 CROSS JOIN (VALUES ('view'), ('edit')) AS x(a)
ON CONFLICT (template_id, resource_key, action) DO NOTHING;

-- ── 3c. And nothing carries a grant this resource does not declare ──────────
-- Only reachable on a fresh database, where 20260618000000 registers the key with the
-- default four actions and 20260807000000 §7 materializes a row for each. A no-op
-- against a database meeting this key for the first time here. Same tidy-up, and the
-- same invariant, as 20260808000000 §5.
DELETE FROM public.template_permissions tp
 USING public.permission_resources pr
 WHERE tp.resource_key = 'admin/family'
   AND pr.key = tp.resource_key
   AND NOT (tp.action::text = ANY(pr.actions));

-- ── 4. The rename policy ────────────────────────────────────────────────────
-- The second policy `families` has ever carried, and the SELECT policy beside it is
-- untouched: reading which family you are in is not something a family administers.
--
-- THAT SELECT POLICY IS ALSO PART OF THIS WRITE, which is not obvious and was found by
-- mutation rather than by reading. PostgreSQL ANDs the SELECT policy into any UPDATE
-- carrying a RETURNING clause, and renameFamily() uses `.select()` on the mutation (to
-- turn a zero-row match into an honest failure). So the write is confined to rows the
-- caller may READ as well as to rows this policy admits. tests/rls could only make its
-- cross-family case fail after the SELECT policy was opened too — see the mutation log
-- in cases.mjs. Do not treat that `.select()` as decoration.
--
-- ITS NAME DIFFERS BETWEEN DATABASES, so do not key anything on it. A fresh chain
-- produces "members can view own family" (20260615000004): 20260618000001's `perm:`
-- rename only walks tables in permission_table_map, and `families` is not one. Hosted
-- carries "perm:members can view own family" — 20260806000009's audit found exactly one
-- offending row and it was on this table. Nothing here depends on either spelling.
DROP POLICY IF EXISTS "family renamed by settings admins" ON public.families;
CREATE POLICY "family renamed by settings admins"
  ON public.families FOR UPDATE TO authenticated
  USING      (family_code = public.auth_family_code()
              AND public.auth_permission('admin/family', 'edit') = 'any'
              AND public.auth_membership_approved())
  WITH CHECK (family_code = public.auth_family_code()
              AND public.auth_permission('admin/family', 'edit') = 'any'
              AND public.auth_membership_approved());

-- ── 5. family_code is not a column anybody edits ────────────────────────────
-- SECURITY INVOKER and unconditional. See the header for why this is absolute where
-- people_guard_permission_template() tests the role, and for why a column GRANT does
-- not do this job.
CREATE OR REPLACE FUNCTION public.tg_family_guard_family_code()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
BEGIN
  IF NEW.family_code IS DISTINCT FROM OLD.family_code THEN
    RAISE EXCEPTION
      'families.family_code is the join key for every family-scoped table and cannot be changed'
      USING ERRCODE = 'insufficient_privilege';
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS families_guard_family_code ON public.families;
CREATE TRIGGER families_guard_family_code
  BEFORE UPDATE OF family_code ON public.families
  FOR EACH ROW EXECUTE FUNCTION public.tg_family_guard_family_code();

COMMENT ON COLUMN public.families.family_code IS
  'The join key carried by every family-scoped table, none of which has a foreign key '
  'back to here. Immutable after insert: families_guard_family_code refuses any change, '
  'for every role. Generated by gen_family_code() (20260806000012).';

-- ── 6. Verify ───────────────────────────────────────────────────────────────
-- Unconditional, and BEHAVIOURAL where it can be. plpgsql does not resolve names in a
-- function body until the body runs, so a trigger asserted only to EXIST is a trigger
-- that may throw for its first real caller — which is exactly what 20260806000012
-- shipped. Both branches of the guard are therefore exercised for real, against a
-- throwaway family that is removed before this commits.
DO $mig$
DECLARE
  v_code    CONSTANT text := 'ZZGUARD';
  v_bad     int;
  v_refused boolean := false;
  v_name    text;
BEGIN
  -- 6a. The resource, with exactly the two actions something reads.
  IF NOT EXISTS (
    SELECT 1 FROM public.permission_resources
     WHERE key = 'admin/family' AND actions = ARRAY['view','edit']::TEXT[]
  ) THEN
    RAISE EXCEPTION 'ROLLBACK: admin/family is not registered with actions view+edit';
  END IF;

  -- 6b. The failure §2 exists to prevent: a family for which the key has no
  -- visibility row, and so defaults to being readable by every member.
  SELECT COUNT(*) INTO v_bad
    FROM (
      SELECT family_code AS code FROM public.families
      UNION
      SELECT DISTINCT family_code FROM public.people
       WHERE family_code IS NOT NULL AND family_code <> ''
    ) f
   WHERE f.code IS NOT NULL AND f.code <> ''
     AND NOT EXISTS (SELECT 1 FROM public.resource_visibility rv
                      WHERE rv.family_code = f.code AND rv.resource_key = 'admin/family');
  IF v_bad > 0 THEN
    RAISE EXCEPTION 'ROLLBACK: % families would default admin/family to view=any', v_bad;
  END IF;

  -- 6c. And the mirror failure: a family whose administrators cannot reach the page.
  SELECT COUNT(*) INTO v_bad
    FROM public.permission_templates t
   WHERE t.name = 'Administrators' AND t.is_system = true
     AND NOT EXISTS (SELECT 1 FROM public.template_permissions tp
                      WHERE tp.template_id = t.id
                        AND tp.resource_key = 'admin/family'
                        AND tp.action = 'edit' AND tp.scope = 'any');
  IF v_bad > 0 THEN
    RAISE EXCEPTION 'ROLLBACK: % Administrators templates cannot edit admin/family', v_bad;
  END IF;

  -- 6d. No grant names an action the resource does not declare.
  SELECT COUNT(*) INTO v_bad
    FROM public.template_permissions tp
   WHERE tp.resource_key = 'admin/family'
     AND tp.action::text NOT IN ('view', 'edit');
  IF v_bad > 0 THEN
    RAISE EXCEPTION 'ROLLBACK: % admin/family grant(s) name create or delete', v_bad;
  END IF;

  -- 6e. The policy exists and really does demand 'any'. A DROP that matched nothing,
  -- or a CREATE against a stale definition, would leave the grant deciding nothing.
  SELECT COUNT(*) INTO v_bad
    FROM pg_policies
   WHERE schemaname = 'public' AND tablename = 'families'
     AND policyname = 'family renamed by settings admins'
     AND cmd = 'UPDATE'
     AND COALESCE(qual, '') LIKE '%admin/family%'
     AND COALESCE(with_check, '') LIKE '%admin/family%';
  IF v_bad <> 1 THEN
    RAISE EXCEPTION 'ROLLBACK: expected 1 UPDATE policy on families naming admin/family, found %', v_bad;
  END IF;

  -- 6f. THE GUARD, both ways, for real.
  --
  -- The throwaway family fires families_seed_permission_templates and
  -- families_seed_system_funds, so it is cleaned up in the same order 20260806000012's
  -- smoke test uses. created_by is left NULL: nothing here needs a founder, and
  -- requiring an auth.users row is what let that migration's verify block skip itself
  -- into a false pass on an empty database.
  INSERT INTO public.families (family_code, family_name)
  VALUES (v_code, 'Guard Smoke Test');

  -- Permitted: family_code named in the SET list but not actually changed. This is
  -- what proves every name in the trigger body resolves.
  UPDATE public.families SET family_code = v_code, family_name = 'Guard Smoke Test 2'
   WHERE family_code = v_code;
  SELECT family_name INTO v_name FROM public.families WHERE family_code = v_code;
  IF v_name <> 'Guard Smoke Test 2' THEN
    RAISE EXCEPTION 'ROLLBACK: families_guard_family_code blocked a rename it should permit';
  END IF;

  -- Refused: an actual re-key, by the migration role, which holds every privilege
  -- there is. Nothing weaker than the trigger can be producing this.
  BEGIN
    UPDATE public.families SET family_code = 'ZZOTHR' WHERE family_code = v_code;
  EXCEPTION WHEN insufficient_privilege THEN
    -- Matched on the message, not merely on the SQLSTATE: 42501 is also what a
    -- missing table privilege raises, and a verify block that cannot tell those
    -- apart is one that passes for the wrong reason.
    v_refused := (SQLERRM LIKE '%join key%');
  END;
  IF NOT v_refused THEN
    RAISE EXCEPTION 'ROLLBACK: families_guard_family_code did not refuse a family_code change';
  END IF;

  -- ORDER IS LOAD-BEARING, and it is the order TODO.md records as the intended one:
  -- the family row goes FIRST. funds_protect_system() refuses to delete a system fund
  -- — families_seed_system_funds created a Donations fund for this throwaway family —
  -- and releases it on exactly one condition, that the `families` row is already gone.
  DELETE FROM public.families             WHERE family_code = v_code;
  DELETE FROM public.funds                WHERE family_code = v_code;
  DELETE FROM public.template_permissions tp
   USING public.permission_templates t
   WHERE tp.template_id = t.id AND t.family_code = v_code;
  DELETE FROM public.permission_templates WHERE family_code = v_code;
  DELETE FROM public.resource_visibility  WHERE family_code = v_code;

  RAISE NOTICE 'family_code guard verified (permits a rename, refuses a re-key), family % removed', v_code;
END $mig$;

COMMIT;
