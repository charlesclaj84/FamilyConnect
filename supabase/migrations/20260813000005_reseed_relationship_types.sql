-- ============================================================================
-- Re-seed `relationship_types`, which is EMPTY on the hosted project.
-- ----------------------------------------------------------------------------
-- WHAT WAS BROKEN
--   `relationship_types` is the global, family-less lookup every relationship in
--   the product is named through. It is seeded by two migrations that were
--   applied long ago — 20260602000003 (the twenty original names) and
--   20260610000004 (the three Ex- names) — and by nothing else.
--
--   Hosted has none of them. `SELECT count(*) FROM relationship_types` is 0 there
--   while a freshly reset local database has 23, which is why every one of these
--   screens works on a laptop and fails in production:
--
--     * /family-tree      `addRelative` looks the name up before it writes the
--                         edge and answers "That relationship type is not set up"
--                         — the report that led here. `getFamilyTree` builds its
--                         id→name map from the same table, so with the table
--                         empty `relationFor` matches nothing and EVERY edge is
--                         skipped: the canvas draws people and no relationships.
--     * /my-children      five lookups in app/actions/children.ts
--     * link-person, personal-info, events   one each
--
--   The rows almost certainly went with a run of
--   supabase/scripts/truncate_entire_database.sql, which TRUNCATEs every base
--   table in `public` by catalogue — global lookups included. That is the correct
--   behaviour for a full purge; what is missing is any route back, because the
--   only statements that ever put these rows in are in migrations hosted has
--   already recorded as applied.
--
-- WHY A NEW FILE RATHER THAN AN EDIT TO 20260602000003
--   `db push` keys off the version, so an edit to an applied migration reaches
--   fresh databases and never reaches hosted — see AGENTS.md, "Editing an applied
--   migration changes fresh databases only". Repairing hosted therefore takes a
--   file hosted has not seen. This one is that file.
--
--   The original seeds are deliberately left alone. A fresh `db reset` still gets
--   these names from 20260602000003 and 20260610000004 exactly as before; this
--   migration is a no-op on any database that already has them, which is what
--   ON CONFLICT DO NOTHING buys and what makes it safe to replay.
--
-- WHY NOT supabase/scripts/
--   That directory is for SQL nobody needs a record of having run. This is the
--   opposite: the whole failure above is a database and a repo disagreeing about
--   what the database holds, and a hand-run repair leaves exactly that gap open a
--   second time. A versioned file is the thing that can be asked afterwards.
--
-- NOT A CURE FOR THE TRUNCATE SCRIPT
--   Every other global lookup it empties has the same one-way door.
--   `permission_resources` (38 rows) and `permission_table_map` (40) survived
--   here only because their seeding migrations happened to still be pending when
--   the purge ran and applied afterwards. That is luck, not a mechanism, and it
--   belongs in TODO.md rather than in a fix for one table.
-- ============================================================================

-- The twenty from 20260602000003, in its order.
INSERT INTO relationship_types (name) VALUES
  ('Father'),
  ('Mother'),
  ('Paternal Grandfather'),
  ('Paternal Grandmother'),
  ('Maternal Grandfather'),
  ('Maternal Grandmother'),
  ('Son'),
  ('Daughter'),
  ('Grandson'),
  ('Granddaughter'),
  ('Brother'),
  ('Sister'),
  ('Uncle'),
  ('Aunt'),
  ('Nephew'),
  ('Niece'),
  ('Cousin'),
  ('Husband'),
  ('Wife'),
  ('Partner')
ON CONFLICT (name) DO NOTHING;

-- The three from 20260610000004.
INSERT INTO relationship_types (name) VALUES
  ('Ex-Husband'),
  ('Ex-Wife'),
  ('Ex-Partner')
ON CONFLICT (name) DO NOTHING;

-- ── Assert it, unconditionally ───────────────────────────────────────────────
-- No fixture is needed to check a lookup table, so there is nothing here that can
-- skip — the failure mode AGENTS.md warns about in "A verify block that can skip
-- must not be the only check". The names are restated rather than counted so the
-- assertion fails on the one that matters: a caller passing 'Father' does not care
-- how many rows there are.
--
-- The nine in the first list are `TREE_RELATIONSHIPS` in lib/family-tree.ts, the
-- vocabulary the tree builder writes; the rest are what the other five call sites
-- and the retired lineage view use. If a name is added there, add it here too —
-- `isTreeRelationshipType` accepts it in the app and this table is what decides
-- whether it can actually be written.
DO $$
DECLARE
  v_missing text;
BEGIN
  SELECT string_agg(n, ', ' ORDER BY n) INTO v_missing
    FROM unnest(ARRAY[
      'Father', 'Mother', 'Husband', 'Wife', 'Partner',
      'Son', 'Daughter', 'Brother', 'Sister',
      'Paternal Grandfather', 'Paternal Grandmother',
      'Maternal Grandfather', 'Maternal Grandmother',
      'Grandson', 'Granddaughter',
      'Uncle', 'Aunt', 'Nephew', 'Niece', 'Cousin',
      'Ex-Husband', 'Ex-Wife', 'Ex-Partner'
    ]) AS n
   WHERE NOT EXISTS (SELECT 1 FROM relationship_types rt WHERE rt.name = n);

  IF v_missing IS NOT NULL THEN
    RAISE EXCEPTION
      'relationship_types is still missing: %. Every screen that names a '
      'relationship fails without these.', v_missing;
  END IF;

  RAISE NOTICE 'relationship_types: % rows', (SELECT count(*) FROM relationship_types);
END $$;
