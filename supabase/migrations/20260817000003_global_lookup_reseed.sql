-- ============================================================================
-- The global lookups get ONE reseeder, and `family_roles` gets its 25 rows back.
--
-- ── THE FAILURE THIS CLOSES ─────────────────────────────────────────────────
-- `supabase/scripts/truncate_entire_database.sql` empties every base table in
-- `public` by catalogue, which is right for a full purge and wrong for four of
-- those tables. They are not family data at all — they are product reference
-- data, seeded ONLY by migrations, and a migration hosted has already recorded
-- as applied never runs again. So on hosted the purge is a one-way door:
--
--   relationship_types    23 rows   emptied by a purge; repaired by 20260813000005
--   permission_resources  40 rows   survived by LUCK — its seeding migration
--                                   happened to still be pending and applied after
--   permission_table_map  40 rows   same luck, same migration
--   family_roles          25 rows   emptied, and NOTHING has ever put them back
--
-- The fourth is why this file exists. It has gone unnoticed because every "is
-- this a global lookup?" test asks whether the table has a `family_code`
-- column, and `family_roles` HAS one — `20260604000002` added it so a family
-- could define custom roles beside the 25 built-in board positions. The global
-- rows are the ones where it is NULL. A hybrid table passes every structural
-- test for family data and is mostly not family data.
--
-- What an empty `family_roles` costs, all of it silent: /admin/boardpositions
-- renders no positions (getAllRolesWithGlobal, app/actions/admin/chapters.ts),
-- the board-position picker on Members & Access has nothing to offer
-- (app/actions/admin/users.ts), and the Member Directory's title column is
-- blank (app/actions/members.ts). No error anywhere. It is very likely the
-- state hosted is in right now.
--
-- ── WHY A FUNCTION AND NOT A COPY OF THE SEED IN THE SCRIPT ─────────────────
-- Because the script would then be a second authority for the same rows, and it
-- would be stale from the next migration that touches them. That is the trap
-- AGENTS.md §6 already records about the resource catalogue living in two
-- places; a purge script would be the third.
--
-- So `seed_global_lookups()` below is the ONE reseeder. This migration calls it
-- (which is what reaches hosted), and the truncate script calls it afterwards
-- (which is what makes a purge survivable). A future change to either
-- vocabulary edits this function in a NEW migration and both callers are correct
-- for free — the script never needs touching again.
--
-- IT SEEDS TWO OF THE FOUR, and refuses to pretend about the other two:
--
--   * `relationship_types` (23 names) and `family_roles`' 25 global rows are
--     small, stable, closed vocabularies. They can be stated honestly.
--   * `permission_resources` and `permission_table_map` CANNOT. Their 40 rows
--     each are assembled by about twenty migrations of inserts, label and
--     sort_order edits, `actions` narrowings and seven deletes, and the map
--     carries `own_expr`/`self_expr` — SQL fragments the composed policies in
--     20260618000001 were BUILT from. A hand-written copy would be wrong on the
--     next migration and wrong invisibly: a bad `actions` array renders grid
--     switches nothing reads, and a bad `own_expr` would compose a policy from a
--     wrong expression. Those two are ASSERTED non-empty instead, here and in
--     supabase/scripts/audit_global_lookups.sql, so the loss is loud.
--
-- ── §2b: THE GRANT DECISION ─────────────────────────────────────────────────
-- Nothing. `seed_global_lookups()` is called by migrations and by a script run
-- as the owner; the browser has no business in it. Default privileges since
-- 20260806000015 revoke EXECUTE from `anon` and `authenticated`, so a new
-- function is unreachable from PostgREST until a migration grants it, and this
-- one deliberately does not. `service_role` keeps EXECUTE by default, which is
-- what `db query` and `psql` need. No policy references it, so the derived
-- policy-helper grants that migration computes do not apply either.
--
-- SECURITY INVOKER, not DEFINER: it needs no privilege its callers do not
-- already have, and a DEFINER function that writes reference data would be a
-- privilege escalation looking for a grant. `search_path = ''`, every reference
-- schema-qualified — plpgsql does not resolve names until the body runs, so an
-- unqualified one would apply cleanly and throw for its first caller
-- (20260806000012 is the worked example).
--
-- IDEMPOTENT. Every insert is ON CONFLICT DO NOTHING, so calling it on a healthy
-- database changes nothing and calling it twice is the same as once. It does NOT
-- update existing rows: a family that renamed nothing here still has the seeded
-- names, and forcing values back would overwrite a `sort_order` an
-- administrator may since have had reason to change.
--
-- HOW THIS REACHES A DATABASE
--   `supabase db push`, from CI on merge to master — never `psql -f` by hand.
--   See AGENTS.md, "How migrations reach the hosted project".
-- ============================================================================

BEGIN;

-- ── 1. The one reseeder ─────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.seed_global_lookups()
RETURNS void
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $fn$
BEGIN
  -- ── relationship_types ────────────────────────────────────────────────────
  -- The twenty from 20260602000003 in its order, then the three from
  -- 20260610000004. The first nine are `TREE_RELATIONSHIPS` in
  -- lib/family-tree.ts — the vocabulary the tree builder writes — so a name
  -- added there is a name that belongs here.
  --
  -- `person_relationships.relationship_type_id` is ON DELETE RESTRICT, so these
  -- rows must never be deleted-and-reinserted while any edge exists: the ids
  -- would change and the delete would be refused. Inserting what is missing is
  -- the only safe shape, which is another reason the purge EXCLUDES this table
  -- rather than emptying and refilling it.
  INSERT INTO public.relationship_types (name) VALUES
    ('Father'), ('Mother'),
    ('Paternal Grandfather'), ('Paternal Grandmother'),
    ('Maternal Grandfather'), ('Maternal Grandmother'),
    ('Son'), ('Daughter'),
    ('Grandson'), ('Granddaughter'),
    ('Brother'), ('Sister'),
    ('Uncle'), ('Aunt'),
    ('Nephew'), ('Niece'),
    ('Cousin'),
    ('Husband'), ('Wife'), ('Partner'),
    ('Ex-Husband'), ('Ex-Wife'), ('Ex-Partner')
  ON CONFLICT (name) DO NOTHING;

  -- ── family_roles, the 25 global board positions ───────────────────────────
  -- `is_global` AND `scope` ARE STATED EXPLICITLY, and that is the trap in this
  -- table. The original seed (20260604000000) predates both columns;
  -- 20260604000002 added `is_global BOOLEAN NOT NULL DEFAULT false` and then
  -- back-filled it with an UPDATE. So a copy-paste of the original INSERT lands
  -- 25 rows with `is_global = false` — which `getAllRolesWithGlobal` reads as
  -- custom family roles that are always enabled and can never be disabled, and
  -- which `deleteCustomRole` (`.eq('is_global', false)`) will cheerfully delete.
  -- `scope` postdates the seed too; 'national' is right for all 25 and is
  -- written down rather than inherited from a default.
  --
  -- `family_code` stays NULL: that is what makes a row global, and it is the
  -- predicate every caller and every script filters on.
  --
  -- ON CONFLICT (name) — the unique constraint is on `name` ALONE, globally
  -- across every family. So a family that has created a custom role called
  -- 'President' already holds the only row that name can have, and this leaves
  -- it alone rather than fighting it. That collision is a real oddity in the
  -- schema and is not this file's to fix.
  INSERT INTO public.family_roles (name, category, sort_order, scope, is_global, family_code) VALUES
    ('President',                'executive_officer',   1, 'national', true, NULL),
    ('Vice President',           'executive_officer',   2, 'national', true, NULL),
    ('Secretary',                'executive_officer',   3, 'national', true, NULL),
    ('Treasurer',                'executive_officer',   4, 'national', true, NULL),
    ('Sergeant-at-Arms',         'executive_officer',   5, 'national', true, NULL),
    ('Assistant Secretary',      'appointed_position',  6, 'national', true, NULL),
    ('Assistant Treasurer',      'appointed_position',  7, 'national', true, NULL),
    ('Immediate Past President', 'appointed_position',  8, 'national', true, NULL),
    ('Parliamentarian',          'appointed_position',  9, 'national', true, NULL),
    ('Chaplain',                 'appointed_position', 10, 'national', true, NULL),
    ('Historian',                'appointed_position', 11, 'national', true, NULL),
    ('Public Relations Officer', 'appointed_position', 12, 'national', true, NULL),
    ('Communications Officer',   'appointed_position', 13, 'national', true, NULL),
    ('Membership Chair',         'appointed_position', 14, 'national', true, NULL),
    ('Fundraising Chair',        'appointed_position', 15, 'national', true, NULL),
    ('Events Chair',             'appointed_position', 16, 'national', true, NULL),
    ('Community Service Chair',  'appointed_position', 17, 'national', true, NULL),
    ('Youth Chair',              'appointed_position', 18, 'national', true, NULL),
    ('Scholarship Chair',        'appointed_position', 19, 'national', true, NULL),
    ('Technology Chair',         'appointed_position', 20, 'national', true, NULL),
    ('Safety & Security Chair',  'appointed_position', 21, 'national', true, NULL),
    ('Family Reunion Chair',     'appointed_position', 22, 'national', true, NULL),
    ('Hospitality Chair',        'appointed_position', 23, 'national', true, NULL),
    ('Sponsorship Chair',        'appointed_position', 24, 'national', true, NULL),
    ('Volunteer Coordinator',    'appointed_position', 25, 'national', true, NULL)
  ON CONFLICT (name) DO NOTHING;
END $fn$;

COMMENT ON FUNCTION public.seed_global_lookups() IS
  'Idempotently restores the two global lookups that can be stated as a closed '
  'vocabulary: relationship_types, and family_roles WHERE family_code IS NULL. '
  'The ONE authority for those rows — called by 20260817000003 (which is how it '
  'reaches hosted) and by supabase/scripts/truncate_entire_database.sql (which is '
  'what makes a full purge survivable). permission_resources and '
  'permission_table_map are deliberately NOT here: they are assembled by ~20 '
  'migrations and cannot be honestly copied. Grant nothing to anon or '
  'authenticated.';

-- ── 2. Run it, which is the repair ──────────────────────────────────────────
-- A no-op on any database whose lookups are intact — including every fresh
-- `db reset`, where the original seeds have already run. The 25 board positions
-- are what this actually restores on hosted.
SELECT public.seed_global_lookups();

-- ── 3. Delete no custom role ────────────────────────────────────────────────
-- Stated as a comment rather than as code, because the temptation is to "tidy"
-- family_roles here. Per-family custom rows (`family_code IS NOT NULL`) are
-- ordinary family data written by createCustomRole. They are not this file's
-- business and they are not global.

-- ── 4. Verify, unconditionally ──────────────────────────────────────────────
-- No fixture is needed to check a lookup table, so nothing here can skip itself
-- into a false pass — the failure AGENTS.md records against 20260806000012's
-- verify block. And the function is CALLED above rather than merely created, so
-- an unqualified reference in its body would have thrown already; plpgsql
-- resolves names at run time, not at CREATE time.
--
-- The names are restated rather than counted for the reason 20260813000005 gives:
-- a caller passing 'Treasurer' does not care how many rows there are.
DO $mig$
DECLARE
  v_missing text;
  v_taken   text;
  v_count   bigint;
BEGIN
  -- 4a. Every board position this function claims to seed is ACCOUNTED FOR.
  --
  -- ── THIS ASSERTION AND THE SEEDER USED TO CONTRADICT EACH OTHER ───────────
  -- The insert above is `ON CONFLICT (name) DO NOTHING` and its comment says, in as
  -- many words, that a family which has already created a custom role called
  -- 'President' holds the only row that name can have and is left alone —
  -- `family_roles_name_key` is UNIQUE on `name` ALONE, globally across every family.
  --
  -- This block then demanded all 25 exist with `family_code IS NULL AND is_global`.
  -- Those two cannot both be true, and the migration ABORTS on any database where a
  -- family ever named a custom role after a built-in position.
  --
  -- It passed every local run because no fixture family does that, and it is exactly
  -- the class of failure AGENTS.md warns about: a verify block that is right about an
  -- empty database and wrong about a real one. Reproduced deliberately before this fix
  -- — insert a custom 'President', run the seeder, and the old assertion raises.
  --
  -- HOSTED RAN THE PRE-FIX VERSION OF THIS BLOCK, on 2026-08-18, and passed: its
  -- `family_roles` was EMPTY (TODO.md's /admin/boardpositions entry records why), so the
  -- 25 inserts hit no conflict and every one of them landed global. The correction below
  -- therefore reaches fresh databases only, which is what editing an applied migration
  -- ever does — AGENTS.md is explicit about it. It is worth making anyway: the next
  -- `db reset` on a laptop whose family has renamed a role is the failure, and the
  -- assertion was wrong on its own terms regardless of which databases noticed.
  --
  -- SO THE TEST IS NOW "ACCOUNTED FOR" RATHER THAN "GLOBAL": present as a global row,
  -- OR the name is legitimately held by a family's custom role. A name in neither state
  -- is genuinely missing and still aborts.
  SELECT string_agg(want.name, ', ' ORDER BY want.name) INTO v_missing
    FROM (VALUES
      ('President'), ('Vice President'), ('Secretary'), ('Treasurer'),
      ('Sergeant-at-Arms'), ('Assistant Secretary'), ('Assistant Treasurer'),
      ('Immediate Past President'), ('Parliamentarian'), ('Chaplain'),
      ('Historian'), ('Public Relations Officer'), ('Communications Officer'),
      ('Membership Chair'), ('Fundraising Chair'), ('Events Chair'),
      ('Community Service Chair'), ('Youth Chair'), ('Scholarship Chair'),
      ('Technology Chair'), ('Safety & Security Chair'), ('Family Reunion Chair'),
      ('Hospitality Chair'), ('Sponsorship Chair'), ('Volunteer Coordinator')
    ) AS want(name)
   WHERE NOT EXISTS (
     SELECT 1 FROM public.family_roles fr WHERE fr.name = want.name
   );
  IF v_missing IS NOT NULL THEN
    RAISE EXCEPTION 'ROLLBACK: board position(s) absent from family_roles entirely: %', v_missing;
  END IF;

  -- AND THE COLLISION IS REPORTED, never swallowed. A family holding a built-in name as
  -- its own custom role means that position is missing from the GLOBAL list for every
  -- other family — /admin/boardpositions will not offer it to them. That is a real
  -- product oddity and the operator should hear about it; it is not, however, a reason to
  -- refuse a migration whose job is to restore the other 24.
  --
  -- The fix is a schema change rather than a data one — `UNIQUE (name)` is wrong for a
  -- hybrid table and should be `UNIQUE (name, family_code)` with a partial unique index
  -- for the globals. TODO.md carries it; doing it here would be a second, unrelated
  -- migration smuggled into this one.
  SELECT string_agg(format('%s (held by %s)', fr.name, fr.family_code), ', ' ORDER BY fr.name)
    INTO v_taken
    FROM public.family_roles fr
   WHERE fr.family_code IS NOT NULL
     AND fr.name IN (
       'President','Vice President','Secretary','Treasurer','Sergeant-at-Arms',
       'Assistant Secretary','Assistant Treasurer','Immediate Past President',
       'Parliamentarian','Chaplain','Historian','Public Relations Officer',
       'Communications Officer','Membership Chair','Fundraising Chair','Events Chair',
       'Community Service Chair','Youth Chair','Scholarship Chair','Technology Chair',
       'Safety & Security Chair','Family Reunion Chair','Hospitality Chair',
       'Sponsorship Chair','Volunteer Coordinator');
  IF v_taken IS NOT NULL THEN
    RAISE WARNING
      'family_roles: built-in board position name(s) held by a family custom role, so the '
      'GLOBAL row is absent and no other family is offered it: %. '
      'Cause: family_roles_name_key is UNIQUE (name) alone. See TODO.md.', v_taken;
  END IF;

  -- 4b. And relationship_types, the table the first purge actually cost us.
  SELECT string_agg(want.name, ', ' ORDER BY want.name) INTO v_missing
    FROM (VALUES
      ('Father'), ('Mother'), ('Son'), ('Daughter'), ('Brother'), ('Sister'),
      ('Husband'), ('Wife'), ('Partner')
    ) AS want(name)
   WHERE NOT EXISTS (SELECT 1 FROM public.relationship_types rt WHERE rt.name = want.name);
  IF v_missing IS NOT NULL THEN
    RAISE EXCEPTION 'ROLLBACK: relationship type(s) missing: %', v_missing;
  END IF;

  -- 4c. THE TWO THIS FUNCTION REFUSES TO RESEED, asked of THIS database.
  -- Free to check and this is the one deploy that can check hosted at all — the
  -- luck that saved them last time ("their seeding migrations happened to still
  -- be pending") is not available a second time, and an empty
  -- permission_resources fails OPEN: every resource resolves to view 'any',
  -- admin pages included, while every write fails closed. The repair is a
  -- migration, so the message says so.
  SELECT count(*) INTO v_count FROM public.permission_resources;
  IF v_count = 0 THEN
    RAISE EXCEPTION 'ROLLBACK: permission_resources is EMPTY. Every resource now resolves to '
      'view=any (admin pages included) and every write fails closed, and Members & Access '
      'cannot repair it because it renders from this table. This cannot be reseeded from a '
      'script — the catalogue is assembled by ~20 migrations. Restore it with a migration that '
      'replays 20260618000000''s seed and every later edit.';
  END IF;

  SELECT count(*) INTO v_count FROM public.permission_table_map;
  IF v_count = 0 THEN
    RAISE EXCEPTION 'ROLLBACK: permission_table_map is EMPTY. Nothing reads it at run time, so '
      'no screen is broken — but it is what migrations compute their RLS sweep lists from, so '
      'the next sweep would touch zero tables and report success. Restore it with a migration '
      'replaying 20260618000001''s seed and its two later additions.';
  END IF;

  RAISE NOTICE 'global lookups verified: relationship_types, family_roles(global), '
    'permission_resources, permission_table_map';
END $mig$;

COMMIT;
