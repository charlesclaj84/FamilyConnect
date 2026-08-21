-- ============================================================================
-- The member's ballot moves to Community: `review/elections` -> `community/elections`.
--
-- ── THE RULE THIS IMPLEMENTS ────────────────────────────────────────────────
-- A screen lives at `/<its rail section>/<its rail caption>`, and a resource key IS the
-- route without its leading slash (AGENTS.md §1, "The route tree IS the nav rail"). The
-- member's election screen is a Community screen — it is the family participating in its own
-- governance, next to the roster, the tree and the notice board — so the route becomes
-- `/community/elections` and the key moves with it.
--
-- `admin/elections` DOES NOT MOVE. The organizer's console is an Admin screen and stays one.
-- 20260821000000 argued the two keys apart ("running an election is not voting in one") and
-- that argument is untouched here: this file moves the MEMBER half only, and after it the two
-- rail items reading "Elections" sit under Community and Admin rather than Review and Admin.
--
-- ── THE REVIEW SECTION LOSES ITS THIRD ITEM, WHICH IS THE POINT ─────────────
-- `review/*` was never a product area. It was a WORKLIST: the six screens that came off
-- `status: 'future'` in lib/features.ts and had not yet been walked end to end, parked under
-- one heading until somebody had read them. 20260821000001 was that walk for elections, and
-- 20260821000000 already moved the organizer half out. This moves the member half to where a
-- reader would look for it, and what stays behind under Review — Photos and Documents — are
-- the two nobody has walked yet.
--
-- ── WHAT REFERENCES A KEY: 20260820000004 ENUMERATED SEVEN, AND FIVE APPLY ──
--   1. permission_resources.key                — the row itself                        §1
--   2. template_permissions.resource_key       — every grant on every template         §2
--   3. resource_visibility.resource_key        — the per-family show/hide               §3
--   4. permission_table_map.resource_key       — FOUR ROWS. The election tables.        §4
--   5. THE COMPOSED POLICY EXPRESSIONS         — SIXTEEN of them.                       §5
--   6. seed_family_permission_templates()      — EMPTY. Asserted in §6.
--   7. Any other function gating on the key    — EMPTY. Asserted in §6.
--
-- 4 and 5 are what make this file long where 20260821000000 was short, and the difference is
-- the one that section states: **this key gates TABLES and not merely a screen.** The four
-- election tables map to it, so 20260618000001's `_perm_predicate()` has interpolated
-- `auth_permission('review/elections'::text, …)` into sixteen policies as literal TEXT.
-- Updating the map does not rewrite them — the map is only read when the sweep runs — and a
-- policy left asking about a key that no longer exists falls through to `auth_permission`'s
-- default: **world-readable for view, closed for every write.** On `election_votes` that is
-- the secret ballot published to the whole family.
--
-- ── THE CATEGORY MOVES TOO, AND IT IS NOT DECORATION ───────────────────────
-- `resources` -> `community`, so the permission grid files the switch under the heading the
-- rail files the screen under. AGENTS.md: "Captions come from the screen … an administrator
-- matching a switch to the thing it switches off should not have to translate." Leaving the
-- category behind would put Elections under Resources on Members & Access while the rail says
-- Community, which is exactly the translation that rule forbids.
--
-- IT IS NOT A CHANGE OF POSTURE, and that is worth stating because the last category move was.
-- 20260817000004 makes `view` fail CLOSED only for `category = 'admin'` (and for an
-- unregistered key shaped `admin/…`); `resources` and `community` are both non-admin, so the
-- default resolves to 'everyone' before this file and after it. 20260820000004 §8 had to write
-- a restriction down explicitly because its moved key was LEAVING `admin/`. This one is not,
-- so there is nothing to preserve — and §9 asserts the invariant that licenses the prefix test
-- still holds in both directions.
--
-- `sort_order` 150 -> 80, which is where the rail puts it: after Family Tree (75) and before
-- nothing. §9 asserts no two rows in a category share one, which is the check a copied
-- sort_order would break.
--
-- ── NONE OF THE FOREIGN KEYS IS `ON UPDATE CASCADE` ────────────────────────
-- So the key cannot be UPDATEd in place. Dependents are COPIED to the new key and the old
-- rows dropped, in that order. `permission_table_map` is the exception and moves in place: it
-- is keyed on `table_name`, not on the resource.
--
-- IDEMPOTENT. Every insert is ON CONFLICT, the delete is guarded by the copies above it, and
-- §5 matches on the OLD literal — which is absent after pass one, so a replay rewrites
-- nothing and asserts everything.
--
-- ── CHECKED BY MUTATION, per AGENTS.md §7 ──────────────────────────────────
-- Five copies of this file, one line changed in each, replayed against a reset database.
-- Every one aborted; the clean file prints its NOTICEs. Observed:
--
--   m1  §2's grant copy is skipped
--         ERROR: community/elections carries 0 template grants where review/elections had 16
--   m2  §4's map UPDATE is skipped
--         ERROR: community/elections gates 0 table(s) where review/elections gated 4
--   m3  §5's policy rewrite is skipped
--         ERROR: 0 policy expression(s) evaluate community/elections where 16 evaluated
--                review/elections
--   m4  §7 deletes the old resource row before §2 copies its grants
--         ERROR: community/elections carries 0 template grants where review/elections had 16
--   m5  §1 writes category 'resources' instead of 'community'
--         ERROR: community/elections must carry category community, not resources
--
-- EVERY ONE OF THE FIVE IS CAUGHT BY §8 OR §9's FIRST BRANCH, which is worth reading as a
-- result rather than a coincidence: §8 compares the new key's counts against the OLD key's,
-- measured before anything moved, so it fires on a half-done copy where a bare absence check
-- would not. m3 is the one that matters — a skipped policy rewrite leaves sixteen expressions
-- asking about a key that no longer exists, which publishes `election_votes` for view while
-- refusing every write.
--
-- AND `supabase db reset` EXITED 0 ON ALL FIVE. The CLI reports a migration failure as a JSON
-- line on stdout and a zero status, so a mutation check that trusts `$?` reports five passes
-- over five aborts. Read the output.
--
-- HOW THIS REACHES A DATABASE
--   `supabase db push`, from CI on merge to master — never `psql -f` by hand, which
--   records nothing and can replay this file out of order. See AGENTS.md, "How
--   migrations reach the hosted project".
-- ============================================================================

BEGIN;

-- ── 0. What the old key had, so §8 can compare against it ───────────────────
-- Counted BEFORE anything moves, for 20260821000000's reason: a verify block that counts the
-- NEW rows and nothing else passes happily over a copy that moved zero of them.
CREATE TEMP TABLE election_member_key_before ON COMMIT DROP AS
SELECT
  (SELECT count(*) FROM public.template_permissions
    WHERE resource_key = 'review/elections')                  AS grants,
  (SELECT count(*) FROM public.resource_visibility
    WHERE resource_key = 'review/elections')                  AS visibility,
  (SELECT count(*) FROM public.permission_table_map
    WHERE resource_key = 'review/elections')                  AS maps,
  (SELECT count(*) FROM pg_policies
    WHERE schemaname = 'public'
      AND (COALESCE(qual, '') || COALESCE(with_check, ''))
          LIKE '%' || quote_literal('review/elections') || '::text%') AS policies;

-- ── 1. The new resource row ─────────────────────────────────────────────────
-- Label and actions copied; category and sort_order are the two fields that CHANGE, and both
-- are stated as literals rather than copied so a replay corrects a row that drifted.
INSERT INTO public.permission_resources (key, label, category, subsection, sort_order, actions)
SELECT 'community/elections', pr.label, 'community', pr.subsection, 80, pr.actions
  FROM public.permission_resources pr
 WHERE pr.key = 'review/elections'
ON CONFLICT (key) DO UPDATE
  SET label      = EXCLUDED.label,
      category   = EXCLUDED.category,
      sort_order = EXCLUDED.sort_order,
      actions    = EXCLUDED.actions;

-- A database that has already run this file has no old row to copy from, so the statement
-- above wrote nothing. State it unconditionally for that case — the same label this key has
-- carried since 20260618000000, and the four actions it declares.
INSERT INTO public.permission_resources (key, label, category, subsection, sort_order, actions)
VALUES ('community/elections', 'Elections', 'community', NULL, 80,
        ARRAY['view', 'create', 'edit', 'delete']::public.permission_action[])
ON CONFLICT (key) DO NOTHING;

-- ── 2. Every family's grants, carried across ────────────────────────────────
-- Nothing here is a judgement about who should hold what: template, action and scope are
-- copied verbatim. A member who could vote before this file can vote after it.
INSERT INTO public.template_permissions (template_id, resource_key, action, scope)
SELECT tp.template_id, 'community/elections', tp.action, tp.scope
  FROM public.template_permissions tp
 WHERE tp.resource_key = 'review/elections'
ON CONFLICT (template_id, resource_key, action) DO UPDATE
  SET scope = EXCLUDED.scope;

-- ── 3. Every family's visibility row, carried across ────────────────────────
-- The posture does not change (see the header) — this is what makes the SWITCH render in the
-- grid under the new key, which AGENTS.md §6 is about: a resource with no visibility row is a
-- screen an administrator cannot restrict, which is a silent default nobody can fix from the UI.
INSERT INTO public.resource_visibility (family_code, resource_key, visibility)
SELECT rv.family_code, 'community/elections', rv.visibility
  FROM public.resource_visibility rv
 WHERE rv.resource_key = 'review/elections'
ON CONFLICT (family_code, resource_key) DO UPDATE
  SET visibility = EXCLUDED.visibility;

-- ── 4. Which tables the key gates ───────────────────────────────────────────
-- `permission_table_map` is keyed on `table_name`, so these four move in place. This is what
-- the NEXT policy sweep would read; §5 is what fixes the policies that already exist.
UPDATE public.permission_table_map
   SET resource_key = 'community/elections'
 WHERE resource_key = 'review/elections';

-- ── 5. Rewrite the sixteen policies that carry the key as a literal ─────────
-- The half updating the map does NOT do, and the half whose absence would publish the ballot.
-- 20260820000004 §5's machinery, narrowed to one pair:
--
--   * the WHOLE literal including its quotes and cast is replaced, so no prefix can bleed;
--   * each policy is dropped and recreated under the same name, command and roles;
--   * and it is rebuilt from the clauses it ACTUALLY HAD. A NULL `qual` or `with_check` is
--     meaningful — the clause is simply absent — and `format(' USING (%s)', NULL)` renders
--     the string ' USING ()' rather than NULL, so this is a CASE and never a COALESCE.
--     `FOR ALL` is a real command and is preserved by reading `cmd` back rather than
--     branching over four.
DO $mig$
DECLARE
  p       record;
  v_roles text;
  v_qual  text;
  v_check text;
  v_count int := 0;
BEGIN
  FOR p IN
    SELECT tablename, policyname, cmd, qual, with_check, roles
      FROM pg_policies
     WHERE schemaname = 'public'
       AND (COALESCE(qual, '')       LIKE '%''review/elections''%'
         OR COALESCE(with_check, '') LIKE '%''review/elections''%')
  LOOP
    v_qual  := replace(p.qual,       '''review/elections''::text', '''community/elections''::text');
    v_check := replace(p.with_check, '''review/elections''::text', '''community/elections''::text');
    v_roles := array_to_string(p.roles, ', ');

    EXECUTE format('DROP POLICY %I ON public.%I', p.policyname, p.tablename);
    EXECUTE format('CREATE POLICY %I ON public.%I FOR %s TO %s', p.policyname, p.tablename,
                   p.cmd, v_roles)
            || CASE WHEN v_qual  IS NOT NULL THEN format(' USING (%s)', v_qual)       ELSE '' END
            || CASE WHEN v_check IS NOT NULL THEN format(' WITH CHECK (%s)', v_check) ELSE '' END;

    v_count := v_count + 1;
  END LOOP;
  RAISE NOTICE 'rewrote % election policy/policies onto community/elections', v_count;
END $mig$;

-- ── 6. The two places that must be empty, asserted rather than assumed ──────
-- No function gates itself on this key today — measured against the catalogue rather than
-- grepped over the tree, because the database's copy is the one that decides. If either of
-- these ever finds something, §5's shape is not enough: a function body is rewritten with
-- `pg_get_functiondef()` and re-executed, which is 20260820000004 §7b.
DO $mig$
DECLARE
  v_funcs text;
BEGIN
  SELECT string_agg(p.proname, ', ' ORDER BY p.proname) INTO v_funcs
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
   WHERE n.nspname = 'public'
     -- `prokind` MATTERS: pg_get_functiondef() raises 42809 on an aggregate and `public`
     -- holds several, so without this the block aborts with a message about array_agg —
     -- which reads as a finding and is not one. 20260821000000 §4 learned this.
     AND p.prokind IN ('f', 'p')
     AND pg_get_functiondef(p.oid) LIKE '%''review/elections''%';
  IF v_funcs IS NOT NULL THEN
    RAISE EXCEPTION 'function(s) still name review/elections: % — see 20260820000004 7b',
      v_funcs;
  END IF;
END $mig$;

-- ── 7. The old rows go ──────────────────────────────────────────────────────
-- `template_permissions` and `resource_visibility` both reference `permission_resources.key`
-- ON DELETE CASCADE, so this one delete takes all three. Safe only because §2 and §3 have
-- copied them and §8 checks that they arrived.
DELETE FROM public.permission_resources WHERE key = 'review/elections';

-- ── 8. Nothing was lost on the way across ───────────────────────────────────
DO $mig$
DECLARE
  v_before record;
  v_now    int;
BEGIN
  SELECT * INTO v_before FROM election_member_key_before;

  SELECT count(*) INTO v_now FROM public.template_permissions
   WHERE resource_key = 'community/elections';
  IF v_before.grants > 0 AND v_now < v_before.grants THEN
    RAISE EXCEPTION 'community/elections carries % template grants where review/elections had %',
      v_now, v_before.grants;
  END IF;

  SELECT count(*) INTO v_now FROM public.resource_visibility
   WHERE resource_key = 'community/elections';
  IF v_before.visibility > 0 AND v_now < v_before.visibility THEN
    RAISE EXCEPTION 'community/elections carries % visibility rows where review/elections had %',
      v_now, v_before.visibility;
  END IF;

  SELECT count(*) INTO v_now FROM public.permission_table_map
   WHERE resource_key = 'community/elections';
  IF v_before.maps > 0 AND v_now < v_before.maps THEN
    RAISE EXCEPTION 'community/elections gates % table(s) where review/elections gated %',
      v_now, v_before.maps;
  END IF;

  -- The policies. Counted rather than merely absence-checked, because "no policy names the
  -- old key" is also true of a rewrite that dropped every one of them and put none back.
  SELECT count(*) INTO v_now FROM pg_policies
   WHERE schemaname = 'public'
     AND (COALESCE(qual, '') || COALESCE(with_check, ''))
         LIKE '%' || quote_literal('community/elections') || '::text%';
  IF v_before.policies > 0 AND v_now < v_before.policies THEN
    RAISE EXCEPTION
      '% policy expression(s) evaluate community/elections where % evaluated review/elections',
      v_now, v_before.policies;
  END IF;

  RAISE NOTICE 'community/elections: % grants, % visibility rows, % tables, % policies',
    (SELECT count(*) FROM public.template_permissions WHERE resource_key = 'community/elections'),
    (SELECT count(*) FROM public.resource_visibility  WHERE resource_key = 'community/elections'),
    (SELECT count(*) FROM public.permission_table_map WHERE resource_key = 'community/elections'),
    v_now;
END $mig$;

-- ── 9. And nothing anywhere still names the old key ─────────────────────────
-- Every check runs unconditionally against the catalogue — no fixture, so this block cannot
-- report success by skipping (AGENTS.md, "A verify block that can skip must not be the only
-- check").
DO $mig$
DECLARE
  v_bad text;
  v_n   int;
BEGIN
  IF EXISTS (SELECT 1 FROM public.permission_resources WHERE key = 'review/elections') THEN
    RAISE EXCEPTION 'the review/elections resource row survived';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.permission_resources WHERE key = 'community/elections') THEN
    RAISE EXCEPTION 'the community/elections resource row is missing';
  END IF;

  SELECT category INTO v_bad FROM public.permission_resources WHERE key = 'community/elections';
  IF v_bad <> 'community' THEN
    RAISE EXCEPTION 'community/elections must carry category community, not %', v_bad;
  END IF;

  -- A grant, a visibility row or a map row left behind points at a resource nothing can
  -- render a switch for.
  IF EXISTS (SELECT 1 FROM public.template_permissions WHERE resource_key = 'review/elections')
  THEN RAISE EXCEPTION 'template grants still name review/elections'; END IF;
  IF EXISTS (SELECT 1 FROM public.resource_visibility  WHERE resource_key = 'review/elections')
  THEN RAISE EXCEPTION 'visibility rows still name review/elections'; END IF;

  SELECT count(*) INTO v_n FROM public.permission_table_map
   WHERE resource_key = 'review/elections';
  IF v_n > 0 THEN
    RAISE EXCEPTION 'permission_table_map still points % table(s) at review/elections', v_n;
  END IF;

  -- THE ONE THAT MATTERS. A policy left behind asks `auth_permission()` about a key that does
  -- not exist, which falls through to 'any' for view and closed for every write — the ballot
  -- published and the vote refused, in one.
  SELECT count(*) INTO v_n FROM pg_policies
   WHERE schemaname = 'public'
     AND (COALESCE(qual, '') || COALESCE(with_check, ''))
         LIKE '%' || quote_literal('review/elections') || '::text%';
  IF v_n > 0 THEN
    RAISE EXCEPTION '% composed policy expression(s) still evaluate review/elections', v_n;
  END IF;

  -- All four election tables are accounted for, by name. §4 is an UPDATE over a predicate, so
  -- it cannot leave three of four behind — but a table added to this feature later and mapped
  -- to the OLD key would sail past every check above, and this is what catches that.
  SELECT string_agg(t, ', ' ORDER BY t) INTO v_bad
    FROM unnest(ARRAY['elections', 'election_positions',
                      'election_nominations', 'election_votes']) AS t
   WHERE NOT EXISTS (
     SELECT 1 FROM public.permission_table_map m
      WHERE m.table_name = t AND m.resource_key = 'community/elections');
  IF v_bad IS NOT NULL THEN
    RAISE EXCEPTION 'election table(s) not mapped to community/elections: %', v_bad;
  END IF;

  -- THE INVARIANT 20260817000004 RESTS ON: an `admin` category exactly where the key is
  -- shaped `admin/…`, in both directions. This file moves a category, so it re-asserts it.
  SELECT string_agg(format('%s (category=%s)', key, category), ', ' ORDER BY key) INTO v_bad
    FROM public.permission_resources
   WHERE (category = 'admin') IS DISTINCT FROM (key LIKE 'admin/%');
  IF v_bad IS NOT NULL THEN
    RAISE EXCEPTION 'category and key shape disagree for: % — see 20260817000004', v_bad;
  END IF;

  -- One row per sort_order within a category, which is what §1's new 80 could have broken.
  SELECT string_agg(DISTINCT category, ', ') INTO v_bad
    FROM (SELECT category, sort_order FROM public.permission_resources
           GROUP BY category, sort_order HAVING count(*) > 1) d;
  IF v_bad IS NOT NULL THEN
    RAISE EXCEPTION 'two resources share a sort_order in: %', v_bad;
  END IF;

  -- And the organizer key is untouched, which is the thing this file is NOT doing.
  IF NOT EXISTS (
    SELECT 1 FROM public.permission_resources
     WHERE key = 'admin/elections' AND category = 'admin')
  THEN
    RAISE EXCEPTION 'admin/elections must still exist at category admin — this file moves the MEMBER key only';
  END IF;
END $mig$;

COMMIT;
