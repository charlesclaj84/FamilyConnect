-- ============================================================================
-- Ten indexes on hosted that this repo never wrote, and 73 foreign keys with none.
--
-- ---- SECTION 1: THE TEN, AND WHY THEY GO RATHER THAN GET ADOPTED ----------
-- `duplicate_index`, four WARN findings on hosted and NONE locally:
--
--     fund_allocations   {fund_allocations_fund_id_idx, fund_allocations_fund_id_idx1}
--     fund_disbursements {fund_disbursements_fund_id_idx, fund_disbursements_fund_id_idx1}
--     fund_milestones    {fund_milestones_fund_id_idx, fund_milestones_fund_id_idx1}
--     funds              {funds_priority_idx, funds_priority_idx1}
--
-- The `1` suffix is Postgres disambiguating a name it has already used, which is what you get
-- when the same `CREATE INDEX` runs twice against one database. Nothing in the migration chain
-- creates any of these eight -- a fresh `db reset` produces none of them -- so they are the
-- fingerprint of a file being replayed by hand, the same intervention "How migrations reach
-- the hosted project" is written about. Two more are in the same position:
-- `dues_payments_status_idx` and `notifications_recipient_id_idx`, hosted-only, and both
-- reported by `unused_index` with zero scans.
--
-- All ten are DROPPED rather than adopted into the chain, and the reason is convergence rather
-- than tidiness. An index that exists on hosted and cannot exist locally is a difference no
-- test can see and no `db reset` can reproduce -- the exact shape of the `event-photos` bucket
-- that had to be removed twice, once from storage and once from the chain. Coverage is not
-- lost by dropping them: `notifications(recipient_id)` keeps
-- `notifications_recipient_created_idx`, `funds(priority)` keeps `funds_family_priority_idx`
-- (which leads with `family_code`, so it is the one a per-family query can use), and the three
-- `fund_id` columns are re-created below as part of section 2, on BOTH databases, with a name
-- the chain owns. `dues_payments(status)` is left with none: nothing queries that column
-- alone, and if something starts to, it can arrive in a migration like everything else.
--
-- ---- SECTION 2: `unindexed_foreign_keys`, 69 hosted / 73 local -------------
-- Every one is real, and they matter for two reasons that have nothing to do with query
-- plans on a small table. Postgres does NOT index the referencing side of a foreign key --
-- so deleting one parent row scans the whole child table once per row deleted, for every FK
-- pointing at it. This product deletes chapters, regions, funds, gathering templates,
-- permission templates, photo collections and people, and several of those cascade. And the
-- family-scoped reads all join: `people -> chapters`, `photos -> photo_collections`,
-- `gathering_tasks -> gatherings`, `dues_payments -> dues_schedules`.
--
-- THE LIST IS DERIVED, NOT WRITTEN DOWN. `pg_constraint` is asked which foreign keys have no
-- index whose LEADING columns are the constraint's columns, and one index is created for each
-- answer -- so this file cannot be wrong about the schema it is applied to, and cannot go
-- stale between the two databases the way a hand-kept list of 73 names would. Every index it
-- creates is NOTICE-d by name, so the deploy log is the record of what was built. Same
-- argument as `audit_cross_family_refs.sql` deriving its 67 pairs from the catalogue instead
-- of listing them.
--
-- Names are `<table>_<columns>_fk_idx`. The `_fk_` is deliberate: it says where the index came
-- from, and it cannot collide with the hand-named indexes already in the chain.
--
-- ---- WHAT THIS DOES TO THE ADVISOR REPORT, SAID PLAINLY -------------------
-- `unindexed_foreign_keys` goes to zero and `unused_index` will grow, because an index on a
-- database with no traffic has by definition never been scanned. That is not a reason to skip
-- this: index usage counters on a product no family is using yet measure nothing, and the
-- honest reading of `unused_index` today is "no query has run", not "this index is useless".
-- The review that entry deserves is one taken AFTER there are families, against
-- `pg_stat_user_indexes` on hosted -- and it is a review, not a fix. TODO.md carries it.
-- ============================================================================

-- ---- 1  Drop the ten unmanaged indexes ------------------------------------
DROP INDEX IF EXISTS public.fund_allocations_fund_id_idx;
DROP INDEX IF EXISTS public.fund_allocations_fund_id_idx1;
DROP INDEX IF EXISTS public.fund_disbursements_fund_id_idx;
DROP INDEX IF EXISTS public.fund_disbursements_fund_id_idx1;
DROP INDEX IF EXISTS public.fund_milestones_fund_id_idx;
DROP INDEX IF EXISTS public.fund_milestones_fund_id_idx1;
DROP INDEX IF EXISTS public.funds_priority_idx;
DROP INDEX IF EXISTS public.funds_priority_idx1;
DROP INDEX IF EXISTS public.dues_payments_status_idx;
DROP INDEX IF EXISTS public.notifications_recipient_id_idx;

-- ---- 2  One index per uncovered foreign key -------------------------------
DO $fks$
DECLARE
  r        record;
  v_name   text;
  v_made   integer := 0;
BEGIN
  FOR r IN
    WITH fk AS (
      SELECT c.conrelid,
             c.conrelid::regclass::text AS tbl,
             c.conkey,
             (SELECT string_agg(a.attname, '_' ORDER BY k.ord)
                FROM unnest(c.conkey) WITH ORDINALITY k(attnum, ord)
                JOIN pg_attribute a
                  ON a.attrelid = c.conrelid AND a.attnum = k.attnum) AS colnames,
             (SELECT string_agg(quote_ident(a.attname), ', ' ORDER BY k.ord)
                FROM unnest(c.conkey) WITH ORDINALITY k(attnum, ord)
                JOIN pg_attribute a
                  ON a.attrelid = c.conrelid AND a.attnum = k.attnum) AS collist
        FROM pg_constraint c
       WHERE c.contype = 'f'
         AND c.connamespace = 'public'::regnamespace
    )
    SELECT fk.tbl, fk.colnames, fk.collist
      FROM fk
     WHERE NOT EXISTS (
       SELECT 1 FROM pg_index i
        WHERE i.indrelid = fk.conrelid
          AND (i.indkey::int2[])[0:array_length(fk.conkey, 1) - 1] = fk.conkey
     )
     ORDER BY fk.tbl, fk.colnames
  LOOP
    -- 63 bytes is the identifier limit; every name this produces today is well inside it, and
    -- a truncated one would still be unique because the table name leads.
    v_name := left(replace(r.tbl, 'public.', '') || '_' || r.colnames || '_fk_idx', 63);
    EXECUTE format('CREATE INDEX IF NOT EXISTS %I ON %s (%s)', v_name, r.tbl, r.collist);
    v_made := v_made + 1;
    RAISE NOTICE 'created % on % (%)', v_name, r.tbl, r.collist;
  END LOOP;

  RAISE NOTICE 'created % foreign-key index(es)', v_made;
END
$fks$;

-- ---- 3  Verify ------------------------------------------------------------
DO $verify$
DECLARE
  r     record;
  v_n   integer;
  v_bad text;
BEGIN
  -- (a) No foreign key in `public` is left without a covering index. This is the finding,
  --     asserted rather than assumed -- and it is what makes the derivation above safe to
  --     trust on a database whose schema this file cannot see.
  SELECT string_agg(x.tbl || '(' || x.colnames || ')', ', ' ORDER BY x.tbl) INTO v_bad
    FROM (
      WITH fk AS (
        SELECT c.conrelid, c.conrelid::regclass::text AS tbl, c.conkey,
               (SELECT string_agg(a.attname, ',' ORDER BY k.ord)
                  FROM unnest(c.conkey) WITH ORDINALITY k(attnum, ord)
                  JOIN pg_attribute a
                    ON a.attrelid = c.conrelid AND a.attnum = k.attnum) AS colnames
          FROM pg_constraint c
         WHERE c.contype = 'f' AND c.connamespace = 'public'::regnamespace
      )
      SELECT fk.tbl, fk.colnames FROM fk
       WHERE NOT EXISTS (
         SELECT 1 FROM pg_index i
          WHERE i.indrelid = fk.conrelid
            AND (i.indkey::int2[])[0:array_length(fk.conkey, 1) - 1] = fk.conkey
       )
    ) x;
  IF v_bad IS NOT NULL THEN
    RAISE EXCEPTION 'foreign key(s) still without a covering index: %', v_bad;
  END IF;

  -- (b) None of the ten survived, on either database.
  SELECT count(*) INTO v_n FROM pg_indexes
   WHERE schemaname = 'public'
     AND indexname IN ('fund_allocations_fund_id_idx','fund_allocations_fund_id_idx1',
                       'fund_disbursements_fund_id_idx','fund_disbursements_fund_id_idx1',
                       'fund_milestones_fund_id_idx','fund_milestones_fund_id_idx1',
                       'funds_priority_idx','funds_priority_idx1',
                       'dues_payments_status_idx','notifications_recipient_id_idx');
  IF v_n > 0 THEN
    RAISE EXCEPTION '% unmanaged index(es) still present', v_n;
  END IF;

  -- (c) And no table now carries two indexes on the same column list, which is the
  --     `duplicate_index` finding stated as a rule instead of as four instances.
  FOR r IN
    SELECT i.indrelid::regclass::text AS tbl, i.indkey::text AS cols, count(*) AS n
      FROM pg_index i
      JOIN pg_class c ON c.oid = i.indrelid
      JOIN pg_namespace n ON n.oid = c.relnamespace
     WHERE n.nspname = 'public' AND i.indpred IS NULL AND i.indexprs IS NULL
     GROUP BY 1, 2 HAVING count(*) > 1
  LOOP
    RAISE EXCEPTION 'table % has % identical indexes on columns (%)', r.tbl, r.n, r.cols;
  END LOOP;

  RAISE NOTICE 'every foreign key in public is indexed; no duplicates remain.';
END
$verify$;
