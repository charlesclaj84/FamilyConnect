-- ============================================================================
-- truncate_entire_database.sql — purge every family, every account, everything
-- a family ever entered. The global lookups survive.
-- ----------------------------------------------------------------------------
-- *** DESTRUCTIVE — NO RECOVERY. Take a dump first if the data matters. ***
--
-- Dynamically TRUNCATEs every base table in `public` (CASCADE, identity reset)
-- EXCEPT the three global lookups named in §1, then empties auth.users — which
-- cascades to the app tables
-- referencing it and to GoTrue's own auth.* children (identities, sessions,
-- refresh_tokens, mfa factors...). Finally it re-seeds what can be re-seeded and
-- asserts the end state BOTH ways.
--
-- It is dynamic on purpose in its DESTRUCTION: the target list comes from the
-- catalogue, so it stays correct as the schema evolves and no new table is
-- missed. What it never was, and what §5 and §6 now are, is anything at all
-- about RESTORATION.
--
-- USAGE
--   npx supabase db query --local  -f supabase/scripts/truncate_entire_database.sql
--   npx supabase db query --linked -f supabase/scripts/truncate_entire_database.sql
--
--   `psql "$DATABASE_URL" -f …` works too.
--
-- AFTERWARDS, IF YOU RAN IT LOCALLY: `npx supabase db reset` before
-- `npm run test:rls`. The suite builds its attacker administrator's grants from
-- `permission_resources`, and although this script now preserves that table, a
-- purged database has no families, no templates and no fixtures — so the suite
-- would seed into a state nothing has verified. `db reset` is the way back to a
-- known one.
--
-- ── WHY ONE DO BLOCK AND NOT BEGIN/COMMIT ───────────────────────────────────
-- It was `BEGIN; … COMMIT;` with a `psql -f` usage line until 2026-08-17, and
-- both halves of that were a problem.
--
-- MEASURED: `supabase db query -f` REFUSES a multi-statement file —
-- "cannot insert multiple commands into a prepared statement" — so the CLI that
-- runs every other script in this directory could not run this one, and the only
-- documented route in was a `psql` connection string. That is the same shape as
-- the `USAGE: psql …` headers AGENTS.md had swept out of eighteen migrations,
-- for the same reason: an instruction in a header is followed.
--
-- And a plpgsql block is atomic BY CONSTRUCTION, which is what a destructive
-- script actually wants. `reset_families.sql` reached this conclusion first and
-- its header says why: the Management API's transaction wrapping is not something
-- to take on trust when the failure mode is a half-purged database. Any exception
-- below — a refused TRUNCATE, a failed assertion — rolls back every statement
-- here, the DELETEs included.
--
-- The old "review, then COMMIT (or ROLLBACK)" affordance is gone with it. It was
-- never available through `db query` anyway, and §6 is a better version of the
-- same idea: the end state is asserted before anything commits, so a wrong answer
-- rolls the whole thing back instead of being noticed afterwards.
--
-- ── IT NO LONGER CLAIMS TO EMPTY EVERY TABLE, AND NEVER DID ─────────────────
-- Two things survive, one deliberately and one because it always did:
--
--   * The three global lookups. See §1.
--   * `storage.*`. The filter is `schemaname = 'public'`, so `storage.objects`
--     and `storage.buckets` are untouched — every avatar, document and
--     photo outlives the row that referenced it. Orphaned blobs are out of scope
--     here; the header used to claim a full purge and the claim was false.
--
-- ── WHY THE LOOKUPS ARE EXCLUDED RATHER THAN EMPTIED AND REFILLED ───────────
-- This is the substance of the 2026-08-17 change, made after the first purge cost
-- a production outage nobody noticed for weeks.
--
-- Four of the tables this used to empty are not family data. They are product
-- reference data, seeded ONLY by migrations — and a migration hosted has already
-- recorded as applied never runs again. So emptying them on hosted was a one-way
-- door, and it went through it: `relationship_types` sat empty until
-- 20260813000005 repaired it, during which /family-tree answered "That
-- relationship type is not set up" on every addition and drew a canvas of people
-- with no edges. `family_roles` was emptied by the same purge and nothing put it
-- back until 20260817000003. `permission_resources` and `permission_table_map`
-- survived by luck — their seeding migrations happened to still be pending and
-- applied afterwards.
--
-- Local never showed any of it, because `db reset` re-seeds from the original
-- migrations. Only production was ever wrong.
--
-- Exclusion rather than truncate-then-reinsert, for three separate reasons:
--
--   1. NO WINDOW. A truncate-then-reinsert that fails between its two halves
--      reproduces the exact incident. The DO block closes that, but not needing
--      the window at all is better than rolling it back.
--   2. IDS SURVIVE. `person_relationships.relationship_type_id` is ON DELETE
--      RESTRICT. A reinsert regenerates uuids, and `TRUNCATE … CASCADE` ignores
--      the RESTRICT and takes every relationship edge with it. Keeping the rows
--      sidesteps both.
--   3. TWO OF THE THREE CANNOT BE HONESTLY RESEEDED AT ALL. See §5.
--
-- Verified safe: none of the three has an outgoing FK into anything being
-- truncated (the only one among them is permission_table_map → permission_
-- resources, and both are excluded), so nothing CASCADEs them back in; their
-- children — person_relationships, resource_visibility, template_permissions,
-- user_roles — are all still truncated; none of the three has a trigger; and
-- `public` has no identity or serial column anywhere, so dropping three names
-- from the `RESTART IDENTITY` list changes nothing.
--
-- IT SAID FOUR UNTIL 2026-08-19, and the fourth was `family_roles` — a hybrid, kept
-- for its 25 built-in board positions while §3 deleted its per-family rows.
-- 20260819000004 retired the built-ins, so the table is ordinary family data that §2
-- truncates with everything else, and `family_role_exclusions` (a child of it) no
-- longer exists at all.
-- ============================================================================

DO $purge$
DECLARE
  -- ── 1. The global lookups, and what makes each one global ─────────────────
  -- Named here rather than derived, because no structural test finds this set:
  -- "has no family_code column" is what identifies them, and it is a property of
  -- the schema rather than of anything that can be asserted about the data.
  --
  --   relationship_types    the relationship vocabulary the family tree writes
  --   permission_resources  the set of pages the product has — the same everywhere
  --   permission_table_map  which resource key governs which table
  --
  -- `family_roles` WAS THE FOURTH AND IS NOT ANY MORE, and the reason it was here
  -- is worth keeping because it is the reason this list cannot be derived. That
  -- table was a HYBRID: 20260604000002 gave it a `family_code` so a family could
  -- define custom roles beside 25 built-in board positions, and the built-ins were
  -- the rows where the column was NULL — so it passed every "is this family data?"
  -- test while being mostly not, and a purge emptied its global half on hosted with
  -- nothing able to put it back. 20260819000004 retired the built-ins: board
  -- positions are per-family now, `family_code` is NOT NULL, and the table is
  -- ordinary family data that §2 below truncates with everything else. A future
  -- hybrid would need the same care, which is why the paragraph stays.
  --
  -- A NEW LOOKUP TABLE BELONGS IN THIS LIST, in the same commit that adds it, and
  -- in the keep-list in reset_families.sql §11.
  -- supabase/scripts/audit_global_lookups.sql is what notices when one is missed:
  -- it reports any public table that is empty and has no transitive FK path to a
  -- `family_code`, and it is a step in migrate.yml so it asks on every deploy.
  keep CONSTANT text[] := ARRAY[
    'relationship_types',
    'permission_resources',
    'permission_table_map'
  ];
  v_tables   text;
  v_leftover text;
  v_empty    text[] := '{}';
  v_name     text;
  v_count    bigint;
BEGIN
  -- ── 2. Empty every other base table in public ───────────────────────────────
  SELECT string_agg(format('%I.%I', t.schemaname, t.tablename), ', ')
    INTO v_tables
    FROM pg_tables t
   WHERE t.schemaname = 'public'
     AND NOT (t.tablename = ANY (keep));

  IF v_tables IS NULL THEN
    RAISE EXCEPTION 'ROLLBACK: no tables found in schema public — is this the right database?';
  END IF;

  EXECUTE format('TRUNCATE TABLE %s RESTART IDENTITY CASCADE', v_tables);
  RAISE NOTICE 'Truncated: %', v_tables;

  -- ── 3. `family_roles` NEEDS NOTHING HERE ANY MORE ───────────────────────────
  -- This used to be `DELETE FROM public.family_roles WHERE family_code IS NOT NULL`
  -- — the custom half of a hybrid table whose global half §2 had to skip. Since
  -- 20260819000004 the table is per-family throughout, so it is off the keep-list
  -- above and §2's dynamic TRUNCATE takes it like any other family table. Stated
  -- rather than silently removed, because the obvious reading of §2 is that it
  -- covers everything and the obvious reading of a partial DELETE is that it does
  -- not.

  -- ── 4. Empty all auth accounts ──────────────────────────────────────────────
  -- Cascades to any public table FK still referencing auth.users, plus GoTrue's
  -- internal child tables (identities, sessions, refresh tokens, mfa factors...).
  DELETE FROM auth.users;

  -- ── 5. Re-seed what can be stated honestly ──────────────────────────────────
  -- A no-op on a healthy database, since §1 preserved these rows — so this is
  -- purely the REPAIR path, for a database that arrived already emptied by an
  -- older version of this script.
  --
  -- ONE AUTHORITY, NOT A COPY. `seed_global_lookups()` is created by
  -- 20260817000003, redefined by 20260819000004, and holds the vocabulary for
  -- `relationship_types` — and for nothing else. It seeded `family_roles`' 25 global
  -- board positions until board positions became per-family; do not go looking for
  -- them here or there. Restating the list here would make this script a second
  -- authority, stale from the next migration that touches it —
  -- the trap AGENTS.md §6 records about the resource catalogue living in two
  -- places. Calling the function means a future vocabulary change edits one file
  -- and this script stays correct with no edit at all.
  --
  -- IT DELIBERATELY DOES NOT COVER `permission_resources` OR
  -- `permission_table_map`. Their 40 rows each are assembled by about twenty
  -- migrations of inserts, label and sort_order edits, `actions` narrowings and
  -- seven deletes, and the map carries `own_expr`/`self_expr` — SQL fragments the
  -- composed policies in 20260618000001 were BUILT from. A copy would be wrong on
  -- the next migration and wrong invisibly: a bad `actions` array renders grid
  -- switches nothing reads, and a bad `own_expr` would compose a policy from a
  -- wrong expression. §6 asserts them instead, so losing them is loud.
  PERFORM public.seed_global_lookups();

  -- ── 6. Assert the end state — BOTH DIRECTIONS ───────────────────────────────
  -- The second direction is the one that was missing everywhere, and it is why
  -- the first outage survived for weeks. reset_families.sql §11 checks that no
  -- table which should be empty holds rows; NOTHING checked that a table which
  -- should be full is not empty. A one-way assertion cannot see this class of
  -- damage at all.
  --
  -- FINDINGS GO IN THE EXCEPTION, NEVER IN A NOTICE. `supabase db query` swallows
  -- NOTICE and WARNING — measured, and recorded in audit_policy_shadowing.sql — so
  -- a finding reported that way is a finding nobody reads. Same rule as AGENTS.md's
  -- "a skip should be visible, never silent". The NOTICE above is progress, not a
  -- finding; losing it costs nothing.

  -- 6a. Everything that should be empty is empty. A table added by a migration
  -- since this script was last read is caught here rather than months later.
  SELECT string_agg(t.tablename || '(' ||
           (xpath('/row/c/text()', query_to_xml(
              format('select count(*) as c from public.%I', t.tablename),
              false, true, '')))[1]::text || ')', ', ' ORDER BY t.tablename)
    INTO v_leftover
    FROM pg_tables t
   WHERE t.schemaname = 'public'
     AND NOT (t.tablename = ANY (keep))
     AND (xpath('/row/c/text()', query_to_xml(
            format('select count(*) as c from public.%I', t.tablename),
            false, true, '')))[1]::text::bigint > 0;

  IF v_leftover IS NOT NULL THEN
    RAISE EXCEPTION
      'ROLLBACK: table(s) still hold rows after the purge: %. Either a TRUNCATE was refused, '
      'or something re-inserted afterwards.', v_leftover;
  END IF;

  -- 6b. Everything that should be FULL is full. The missing half.
  --
  -- A plain count per table since 20260819000004. It used to carry a CASE for
  -- `family_roles`, counting only `family_code IS NULL` because §3 had just deleted
  -- the other half — a special case that existed solely because that table was a
  -- hybrid, and the exact line that would have made this script roll itself back
  -- forever once the built-ins were retired. If a hybrid lookup ever returns, this
  -- is where its predicate goes.
  FOREACH v_name IN ARRAY keep LOOP
    EXECUTE format('SELECT count(*) FROM public.%I', v_name) INTO v_count;
    IF v_count = 0 THEN v_empty := v_empty || v_name; END IF;
  END LOOP;

  IF array_length(v_empty, 1) IS NOT NULL THEN
    RAISE EXCEPTION
      'ROLLBACK: global lookup(s) are EMPTY after the purge: %. These are product reference '
      'data, seeded only by migrations, and a migration the database has already recorded as '
      'applied never runs again — so this is not self-healing. relationship_types is restored '
      'by seed_global_lookups() in §5; if it is still empty that function is broken. '
      'permission_resources and permission_table_map need a migration '
      'replaying their seeds — see supabase/migrations/20260817000003_global_lookup_reseed.sql, '
      'which explains why they are not reseedable from here.',
      array_to_string(v_empty, ', ');
  END IF;

  RAISE NOTICE 'Purge complete. Global lookups intact; every other public table empty.';
END $purge$;
