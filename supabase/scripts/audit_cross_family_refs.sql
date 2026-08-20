-- ============================================================================
-- Does any row reference a row in a DIFFERENT family?
--
--     supabase db query --local -f supabase/scripts/audit_cross_family_refs.sql
--     supabase db query --linked -f supabase/scripts/audit_cross_family_refs.sql
--
-- Hand-run, and in `supabase/scripts/` rather than `supabase/migrations/` for the reason
-- AGENTS.md gives about that directory: this asks a question about DATA and answers it
-- differently on every database, so it is not a thing to apply.
--
-- ── WHAT THIS IS FOR, AND WHY A CODE AUDIT CANNOT ANSWER IT ─────────────────
-- `npm run audit:family-scope` sweeps the CODE for a service-role query with no family
-- conjunct. It says nothing about rows already written by a version of the code that had
-- one of those holes — and the holes were real and lived for months:
-- `deleteRegion`/`deleteChapter` with `.eq('id', id)` as their whole predicate,
-- `assignRole` writing four client-supplied ids onto a `user_roles` row, `upsertSpouse`,
-- `upsertAncestor`, `acceptSpouseChild` and `setMyDuesPlan` each missing a
-- `belongsToFamily` check, `addGroupMember` gated on `created_by` alone.
--
-- Every one of those wrote a row whose OWN `family_code` was correct — that is the whole
-- shape of AGENTS.md §4 — carrying a foreign key into somebody else's family. Fixing the
-- code does not repair the row, and nothing in the product will ever surface it: the
-- reading side scopes by family, so the reference simply resolves to nothing and the
-- screen renders a blank where a chapter name should be. Which is exactly how this class
-- of damage gets reported: "chapters from Test Family 1 are showing in Test Family 2".
--
-- ── IT DERIVES THE CHECKS RATHER THAN LISTING THEM ──────────────────────────
-- Every foreign key where BOTH tables carry a `family_code` is a pair that must agree, and
-- `pg_constraint` knows all of them. So this walks the catalogue and builds one query per
-- pair, which means a table added next year is checked with no edit here — the opposite of
-- `truncate_entire_database.sql`'s hand-written keep-list, and the same lesson
-- `audit_global_lookups.sql` learned from it.
--
-- Composite keys are skipped and REPORTED rather than silently dropped, because a skip
-- nobody can see is the failure mode AGENTS.md names about verify blocks. There are none
-- today; the notice is what makes that a fact rather than an assumption.
--
-- ── READ-ONLY. IT REPAIRS NOTHING, DELIBERATELY ─────────────────────────────
-- There is no correct automatic repair and it is worth being explicit about why. A
-- `people.chapter_id` pointing into another family could be nulled — losing which chapter
-- somebody said they were in — or repointed at a same-named chapter in the right family,
-- which invents a fact. A `user_roles` row could be deleted, removing an officer nobody
-- decided to remove. Each of these is a judgement about one family's records, so this
-- prints them and stops. `NOTICE` rather than `EXCEPTION` for the same reason: it must be
-- safe to run against production at any time.
-- ============================================================================

DO $audit$
DECLARE
  r          record;
  v_count    bigint;
  v_total    bigint := 0;
  v_pairs    int    := 0;
  v_skipped  int    := 0;
BEGIN
  RAISE NOTICE '';
  RAISE NOTICE '── Cross-family reference audit ─────────────────────────────';

  FOR r IN
    SELECT
      con.conname                        AS constraint_name,
      child.relname                      AS child_table,
      parent.relname                     AS parent_table,
      con.conkey                         AS child_cols,
      con.confkey                        AS parent_cols,
      array_length(con.conkey, 1)        AS col_count
    FROM pg_constraint con
    JOIN pg_class child  ON child.oid  = con.conrelid
    JOIN pg_class parent ON parent.oid = con.confrelid
    WHERE con.contype = 'f'
      AND con.connamespace = 'public'::regnamespace
      -- Both sides must carry a family_code, or there is nothing to compare.
      AND EXISTS (SELECT 1 FROM information_schema.columns c
                   WHERE c.table_schema = 'public' AND c.table_name = child.relname
                     AND c.column_name = 'family_code')
      AND EXISTS (SELECT 1 FROM information_schema.columns c
                   WHERE c.table_schema = 'public' AND c.table_name = parent.relname
                     AND c.column_name = 'family_code')
      -- A self-reference on one table is still worth checking (a task's parent gathering,
      -- a payment's reversal), so it is deliberately NOT excluded.
    ORDER BY child.relname, con.conname
  LOOP
    IF r.col_count <> 1 THEN
      v_skipped := v_skipped + 1;
      RAISE NOTICE '  SKIP  % (% -> %): composite key, not checked',
        r.constraint_name, r.child_table, r.parent_table;
      CONTINUE;
    END IF;

    v_pairs := v_pairs + 1;

    EXECUTE format(
      'SELECT count(*) FROM public.%I c JOIN public.%I p ON p.%I = c.%I '
      'WHERE c.family_code IS DISTINCT FROM p.family_code',
      r.child_table, r.parent_table,
      (SELECT attname FROM pg_attribute
        WHERE attrelid = format('public.%I', r.parent_table)::regclass
          AND attnum = r.parent_cols[1]),
      (SELECT attname FROM pg_attribute
        WHERE attrelid = format('public.%I', r.child_table)::regclass
          AND attnum = r.child_cols[1])
    ) INTO v_count;

    IF v_count > 0 THEN
      v_total := v_total + v_count;
      RAISE NOTICE '  FOUND % row(s)  %.% -> %.%  (constraint %)',
        v_count, r.child_table,
        (SELECT attname FROM pg_attribute
          WHERE attrelid = format('public.%I', r.child_table)::regclass
            AND attnum = r.child_cols[1]),
        r.parent_table,
        (SELECT attname FROM pg_attribute
          WHERE attrelid = format('public.%I', r.parent_table)::regclass
            AND attnum = r.parent_cols[1]),
        r.constraint_name;
    END IF;
  END LOOP;

  RAISE NOTICE '';
  RAISE NOTICE '  % foreign key(s) checked, % skipped, % offending row(s) found.',
    v_pairs, v_skipped, v_total;

  IF v_total = 0 THEN
    RAISE NOTICE '  Clean: every reference between two family-scoped tables agrees.';
  ELSE
    RAISE NOTICE '';
    RAISE NOTICE '  NOT REPAIRED — see this file''s header for why there is no safe';
    RAISE NOTICE '  automatic repair. Each row is a judgement about one family''s records.';
    RAISE NOTICE '  To see the rows for a pair, run the SELECT the loop builds, e.g.';
    RAISE NOTICE '    SELECT c.* FROM public.people c JOIN public.chapters p';
    RAISE NOTICE '      ON p.id = c.chapter_id';
    RAISE NOTICE '     WHERE c.family_code IS DISTINCT FROM p.family_code;';
  END IF;
  RAISE NOTICE '';
END $audit$;
