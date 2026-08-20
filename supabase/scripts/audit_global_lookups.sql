-- ============================================================================
-- Are the global lookups populated, and has a new one appeared that nothing
-- knows about?
--
--   npx supabase db query --local  -f supabase/scripts/audit_global_lookups.sql
--   npx supabase db query --linked -f supabase/scripts/audit_global_lookups.sql
--
-- RAISEs on a finding, so it exits non-zero and reads as a test. It is a step in
-- migrate.yml, beside audit_policy_shadowing.sql, and it is the thing that would
-- have caught the incident below on the next merge rather than weeks later from a
-- bug report about the family tree.
--
-- ── WHAT IT IS LOOKING FOR, AND WHY NOTHING ELSE WAS ────────────────────────
-- THREE tables in `public` are product reference data rather than family data.
-- They are seeded ONLY by migrations, and a migration a database has already
-- recorded as applied never runs again — so if one is ever emptied, there is no
-- route back but a new migration. `truncate_entire_database.sql` emptied FOUR of
-- them on hosted, and the consequences were staggered:
--
--   relationship_types    empty for weeks. /family-tree answered "That
--                         relationship type is not set up" on every addition and
--                         drew a canvas of people with no edges. Repaired by
--                         20260813000005.
--   family_roles          emptied by the same purge, and nothing put it back until
--                         20260817000003 — during which /admin/boardpositions
--                         rendered nothing, with no error anywhere.
--   permission_resources  survived by LUCK — its seeding migration happened to
--                         still be pending and applied afterwards.
--   permission_table_map  same luck, same migration.
--
-- `family_roles` IS NO LONGER ONE OF THEM, and it is the reason this file exists at
-- all, so its departure needs stating rather than a quiet edit to an array.
-- 20260819000004 made board positions PER-FAMILY: the 25 built-ins are retired,
-- `family_code` is NOT NULL, and there is nothing global left in the table for a
-- purge to destroy or for a migration to restore. A family that has set up no
-- positions has none, which is correct rather than damaged — exactly the state this
-- check would have RAISEd on, and it is a step in migrate.yml, so leaving the name
-- in §1 would have held the Vercel alias on the next merge with the schema already
-- applied.
--
-- §2 does not pick it up either, and that is not luck: `family_roles` has a
-- `family_code` column, so §2's recursive base classifies it as family data and
-- excludes it from the unclassified-and-empty report. Checked, on the reasoning that
-- an edit to §1 which silently moved a table into §2's blast radius would trade one
-- deploy-blocking assertion for another.
--
-- LOCAL NEVER SHOWED ANY OF IT. `db reset` re-seeds from the original migrations,
-- so local was always right and only production was ever wrong. That asymmetry is
-- why this has to be asked of a database rather than of the repo, and why
-- `scripts/migrations.mjs` — which compares versions, not rows — is blind to it.
--
-- ── THE ASYMMETRY IN EVERY OTHER CHECK ──────────────────────────────────────
-- reset_families.sql §11 flags a table that should be EMPTY and holds rows. That
-- is the direction that catches a purge script going stale as the schema grows.
-- Nothing anywhere flagged a table that should be FULL and is empty, which is the
-- direction that catches this. Both scripts now assert both ways, and this file is
-- the standing version that runs whether or not anybody purges anything.
--
-- ── §2 IS THE PART THAT KEEPS §1 HONEST ─────────────────────────────────────
-- §1 is a hand-written list of three names, and a hand-written list of tables goes
-- stale the moment a migration adds one — reset_families.sql carries a comment
-- saying exactly that, about exactly this class of list, because it already
-- happened once. So §2 derives the candidates instead: any base table in `public`
-- with no `family_code` column and no foreign-key path to a table that has one is
-- either a global lookup or a junction row, and if it is not on §1's list and is
-- not reachable, somebody has to classify it.
--
-- IT IS A WARNING SHAPE, NOT A FAILURE SHAPE, for exactly one reason: a new
-- unclassified table is a question, and holding a production release on a question
-- is how a gate gets Force Promoted routinely. It RAISEs only when a table is
-- both unreachable and EMPTY — at which point it is indistinguishable from the
-- incident above.
-- ============================================================================

-- Findings go in the EXCEPTION message and never in RAISE NOTICE or WARNING.
-- `supabase db query` surfaces the error and swallows both — measured, and
-- recorded in audit_policy_shadowing.sql — so a run that put the count in the
-- exception and the culprits in a warning would say something is wrong and never
-- what. Same rule as AGENTS.md's "a skip should be visible, never silent".
DO $$
DECLARE
  -- ── 1. The lookups, and the predicate that identifies the global rows ─────
  -- All three are `true` today, which is what "no family data in here at all" looks
  -- like. The column exists for a HYBRID — a table holding both product rows and
  -- family rows — and `family_roles` was one until 20260819000004: it carried a
  -- `family_code` so a family could define custom roles beside 25 built-in board
  -- positions, so it HAD the column every "is this family data?" test looks for, and
  -- its product rows were the ones where the column was NULL. That is why this
  -- second array is here and why it should stay even while nothing needs it.
  --
  -- ADD A NEW LOOKUP HERE, in the same commit that adds it, and to the two
  -- keep-lists — truncate_entire_database.sql §1 and reset_families.sql §11.
  -- Names and predicates are kept as two parallel arrays rather than one 2-D
  -- array, because the names are needed on their own in §2 and slicing a
  -- text[][] to get them back is more code than the duplication saves. Keep them
  -- the same length and in the same order; the loop below asserts it.
  lookup_names CONSTANT text[] := ARRAY[
    'relationship_types',
    'permission_resources',
    'permission_table_map'
  ];
  lookup_where CONSTANT text[] := ARRAY[
    'true',
    'true',
    'true'
  ];
  -- ── Tables §2 must not report, and the reason for each ────────────────────
  -- §2 asks "is this table unreachable from a family_code AND empty?", which is
  -- what an emptied lookup looks like — and is also what some tables look like
  -- when everything is perfectly fine. Those need naming, with a stated reason,
  -- rather than being tolerated by luck.
  --
  -- `user_family_settings` is the whole list today, and it is a genuine false
  -- positive rather than a grudging exemption: it is per-USER state (which family
  -- opens on login, which one you are currently in), it is seeded by nothing, and
  -- the app rewrites it on demand — `loadSettings` in lib/auth/family.ts returns
  -- null when the row is absent and the resolver falls through to the oldest
  -- membership. A fresh database has none, and a database where nobody has ever
  -- switched family has none either. This check passed on a first run only because
  -- the RLS fixtures happened to have written one.
  --
  -- ADDING A NAME HERE IS A DECISION. The question to answer first is whether the
  -- table is empty by DESIGN — nothing seeds it and nothing needs to — or whether
  -- it is empty because something emptied it, which is the case this file exists
  -- to catch.
  --
  -- `genorra_staff` (20260817000005) is the second, and it earns the entry the same way. It
  -- is the list of GENORRA employees who may open the cross-family staff console: it has no
  -- `family_code`, and its only foreign key points into `auth`, so §2 cannot reach it from
  -- anywhere — and it is EMPTY BY DESIGN. Rows are inserted by hand with SQL, deliberately,
  -- so a laptop has none, a fresh hosted project has none, and a database where nobody has
  -- been granted staff access is correct rather than damaged. Nothing seeds it and nothing
  -- can: there is no set of "the right" staff for a migration to restore.
  --
  -- It is deliberately ABSENT from truncate_entire_database.sql's keep-list, and that belongs
  -- here too since this is where the classification lives: `genorra_staff.user_id` is
  -- ON DELETE CASCADE from `auth.users`, and that script empties `auth.users`, so a staff row
  -- goes with the account it names whether or not the table is truncated. A keep-list entry
  -- would read as a guarantee it does not make.
  allowed_empty CONSTANT text[] := ARRAY[
    'user_family_settings',
    'genorra_staff'
  ];
  i        int;
  v_count  bigint;
  empty    text[] := '{}';
  unknown  text[] := '{}';
  row_rec  record;
BEGIN
  IF array_length(lookup_names, 1) IS DISTINCT FROM array_length(lookup_where, 1) THEN
    RAISE EXCEPTION 'audit_global_lookups.sql: lookup_names and lookup_where are different lengths';
  END IF;

  FOR i IN 1 .. array_length(lookup_names, 1) LOOP
    EXECUTE format('SELECT count(*) FROM public.%I WHERE %s', lookup_names[i], lookup_where[i])
      INTO v_count;
    IF v_count = 0 THEN
      empty := empty || format('%s (WHERE %s)', lookup_names[i], lookup_where[i]);
    END IF;
  END LOOP;

  -- ── 2. A table nobody has classified, and it is empty ────────────────────
  -- Reachability is computed rather than listed, and it is RECURSIVE. A table
  -- with no `family_code` of its own is family data anyway if it has a foreign
  -- key to something that has one — and the chains are longer than one hop in
  -- this schema, which is the mistake the first version of this file made and
  -- which running it caught immediately: the retired `event_hotel_booking_details`
  -- and `event_hotel_price_estimates` reached `family_code` through
  -- `event_hotel_bookings` → `events`, two hops away, and a one-hop test
  -- reported both as unclassified global lookups.
  --
  -- So the transitive closure is the honest test. `UNION` rather than `UNION ALL`
  -- terminates it on a cyclic FK graph; nothing here is cyclic today, and a
  -- self-referencing table (`chat_rooms`, `people`) would loop forever on the
  -- other one.
  FOR row_rec IN
    WITH RECURSIVE scoped(relname) AS (
      -- Base: it carries the join key itself.
      SELECT c.relname
        FROM pg_class c
        JOIN pg_attribute a ON a.attrelid = c.oid
       WHERE c.relnamespace = 'public'::regnamespace
         AND c.relkind = 'r'
         AND a.attname = 'family_code'
         AND a.attnum > 0
         AND NOT a.attisdropped
      UNION
      -- Step: it points at something already scoped.
      SELECT child.relname
        FROM pg_constraint fk
        JOIN pg_class child  ON child.oid  = fk.conrelid
        JOIN pg_class parent ON parent.oid = fk.confrelid
        JOIN scoped s        ON s.relname  = parent.relname
       WHERE fk.contype = 'f'
         AND fk.connamespace = 'public'::regnamespace
         AND child.relname <> parent.relname
    )
    SELECT t.tablename
      FROM pg_tables t
     WHERE t.schemaname = 'public'
       AND NOT (t.tablename = ANY (lookup_names))
       AND NOT (t.tablename = ANY (allowed_empty))
       AND t.tablename NOT IN (SELECT s.relname FROM scoped s)
     ORDER BY t.tablename
  LOOP
    EXECUTE format('SELECT count(*) FROM public.%I', row_rec.tablename) INTO v_count;
    IF v_count = 0 THEN
      unknown := unknown || row_rec.tablename;
    END IF;
  END LOOP;

  IF array_length(empty, 1) IS NOT NULL THEN
    RAISE EXCEPTION E'GLOBAL LOOKUP(S) ARE EMPTY:\n  %\n\n'
      'These are product reference data, seeded only by migrations — and a migration this '
      'database has already recorded as applied never runs again, so this does not heal itself '
      'and no `db reset` on a laptop will show it. relationship_types is restored by '
      'SELECT public.seed_global_lookups() (20260817000003, redefined by 20260819000004). '
      'permission_resources and permission_table_map cannot be restored from a script: their '
      'rows are assembled by ~20 migrations, and permission_table_map carries the SQL '
      'expressions the composed policies were built from. Those two need a migration that '
      'replays 20260618000000''s and 20260618000001''s seeds and every later edit. '
      'An empty permission_resources fails OPEN — every resource resolves to view=any, admin '
      'pages included — and Members & Access cannot repair it because it renders from that '
      'table.',
      array_to_string(empty, E'\n  ');
  END IF;

  IF array_length(unknown, 1) IS NOT NULL THEN
    RAISE EXCEPTION E'UNCLASSIFIED EMPTY TABLE(S):\n  %\n\n'
      'Each has no family_code of its own and no foreign key to a table that has one, so it is '
      'not family data — and it is empty, which is what an emptied global lookup looks like. '
      'Either it is a lookup that has been purged (add it to the `lookups` list in this file, '
      'to truncate_entire_database.sql §1 and to reset_families.sql §11, and give it a seeder), '
      'or it is genuinely empty by design and belongs in the `lookups` list with a predicate '
      'that says so.',
      array_to_string(unknown, E'\n  ');
  END IF;
END $$;
