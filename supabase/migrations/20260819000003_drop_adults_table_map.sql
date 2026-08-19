-- ============================================================================
-- The pre-redesign tables, and the catalogue row that still names one of them.
--
-- ── WHAT THIS WAS WRITTEN FOR ───────────────────────────────────────────────
-- `permission_table_map` carries a row for `adults`, keyed on `members`, with an
-- `auth.uid()`-based own/self expression. `20260602000003_schema_redesign.sql`
-- DROPPED that table — `adults`, `kids` and `family_ancestors` were replaced by the
-- unified `people` table — and `20260618000001` seeded the map afterwards with the
-- row still in its VALUES list. A catalogue that describes the schema and does not
-- is the thing this repo is least willing to keep, because every migration that
-- derives a sweep list from it inherits the lie: `20260806000011` §6 skips it with a
-- RAISE NOTICE that reads like a finding, and a raw probe written against the
-- computed list fails 42P01 rather than telling anybody anything.
--
-- ── AND THEN IT FOUND SOMETHING, WHICH IS WHY THIS FILE IS NOT ONE DELETE ───
-- The first version asserted `to_regclass('public.adults') IS NULL` and rolled back
-- if the table was there, on the argument that a LIVE table's map row is not stale —
-- it is what binds it to the `members` resource, and deleting the row would leave a
-- readable table with no permission clause for the next sweep to give it.
--
-- **THAT GUARD FIRED ON PRODUCTION, 2026-08-19.** Hosted has `public.adults`. Nothing
-- in the chain creates it after June, so the ledger cannot say how it came back, and
-- the honest answer is that it cannot be recovered from here — the same class of
-- divergence AGENTS.md records for `20260602000000_families.sql`, whose bare
-- `CREATE POLICY` was replayed by hand. `20260602000001_adults_kids.sql` is
-- `CREATE TABLE IF NOT EXISTS`, so one hand-replay of it is enough to resurrect the
-- table AND its original policies.
--
-- THE REASON THAT MATTERS MORE THAN THE CATALOGUE ROW: `adults` holds `first_name`,
-- `last_name`, `primary_email`, `primary_phone`, `street_address`, `city`, `state`,
-- `zip_code` and `date_of_birth`. It is a copy of member PII that the product has not
-- read or written since 2026-06-02, sitting behind whichever policies it happens to
-- have — its ORIGINAL ones test `auth.jwt() -> 'user_metadata' ->> 'family_code'`,
-- which is user-writable and therefore spoofable, and that is precisely the shape the
-- 2026-06-15 sweep existed to remove. Whether `20260618000001`'s sweep wrapped them
-- depends on whether the table existed at that moment, which nothing here can know.
-- Either way it is a table the product does not use and cannot see.
--
-- ── SO THIS FILE RECONCILES, AND IT WILL NOT DELETE DATA IT CANNOT SEE ──────
--   §1  Look for `adults`, `kids` and `family_ancestors`. Report what is there.
--   §2  DROP any of them that is EMPTY — finishing what 20260602000003 intended,
--       and taking its policies with it.
--   §3  Delete the `adults` map row IF the table is now gone.
--   §4  Verify, and WARN about anything left.
--
-- **EMPTY IS THE WHOLE CONDITION, and it is what makes this safe to run unattended.**
-- A migration that dropped a table holding rows would be destroying member records
-- nobody in this transaction can look at, on the authority of a comment. So it does
-- not: a surviving table is reported with its row count and left exactly as it is,
-- MAP ROW INCLUDED — because the original guard's argument still holds for a table
-- that is really there, and unmapping it would be the worse outcome. The release is
-- not held either way; a WARNING is the right shape for a question.
--
-- If a table does survive, the decision is a person's and it is not a hard one: read
-- the rows, satisfy yourself that `people` carries whatever matters, and drop it in a
-- migration of its own. `reset_families.sql` used to `DELETE FROM adults` and `kids`
-- unconditionally, which is why they may well be empty already.
--
-- ── WHY DELETING THE ROW CANNOT CHANGE WHO MAY DO WHAT ──────────────────────
-- The composed policies were built AT MIGRATION TIME: `20260618000001` read the map,
-- called `_perm_predicate()` and wrote the resulting SQL into each policy with
-- `CREATE POLICY`. A policy does not consult the map when it is evaluated. So no
-- existing policy anywhere changes when this row goes — and `members` in particular
-- is untouched, because `people` has its own row and keeps it. What changes is FUTURE
-- sweeps, from "skip this with a notice" to "there is nothing here to skip".
--
-- THE SEED IS EDITED TOO, in 20260618000001. Required rather than tidy: that insert
-- is `ON CONFLICT DO UPDATE`, so leaving the row in the VALUES list would re-add it
-- on every `db reset` and a fresh local database would carry a mapping hosted does
-- not. The DELETE below is the half that reaches hosted.
--
-- IDEMPOTENT. Every step is conditional on state it then removes; a second run finds
-- nothing to drop and nothing to delete. Safe on a database built from this chain
-- alone, where all three tables are already absent and this file is a no-op that
-- prints one NOTICE.
--
-- HOW THIS REACHES A DATABASE
--   `supabase db push`, from CI on merge to master — never `psql -f` by hand. See
--   AGENTS.md, "How migrations reach the hosted project".
-- ============================================================================

BEGIN;

-- ── 1-2. Report the legacy tables, and drop the empty ones ──────────────────
-- Dynamic SQL because these tables do not exist on a database built from this chain,
-- and a static `DROP TABLE public.adults` would be fine but a static `SELECT count(*)
-- FROM public.adults` would not: plpgsql resolves names when the statement RUNS, so
-- the count has to be built with `format` to survive the table being absent. That is
-- the same fact that made `reset_families.sql` unrunnable for two months.
DO $mig$
DECLARE
  v_legacy CONSTANT text[] := ARRAY['adults', 'kids', 'family_ancestors'];
  v_name   text;
  v_rows   bigint;
  v_dropped text[] := '{}';
  v_kept    text[] := '{}';
BEGIN
  FOREACH v_name IN ARRAY v_legacy LOOP
    IF to_regclass('public.' || quote_ident(v_name)) IS NULL THEN
      CONTINUE;
    END IF;

    EXECUTE format('SELECT count(*) FROM public.%I', v_name) INTO v_rows;

    IF v_rows = 0 THEN
      EXECUTE format('DROP TABLE public.%I CASCADE', v_name);
      v_dropped := v_dropped || v_name;
    ELSE
      v_kept := v_kept || format('%s (%s row(s))', v_name, v_rows);
    END IF;
  END LOOP;

  IF array_length(v_dropped, 1) IS NOT NULL THEN
    RAISE NOTICE
      'legacy tables dropped, finishing what 20260602000003 intended: %. They held no rows, '
      'and their policies went with them.', array_to_string(v_dropped, ', ');
  END IF;

  IF array_length(v_kept, 1) IS NOT NULL THEN
    RAISE WARNING
      'PRE-REDESIGN TABLE(S) STILL PRESENT AND NOT EMPTY: %. '
      '20260602000003 dropped these on 2026-06-02 and nothing in the chain recreates them, so '
      'this database has diverged from the ledger — most likely a hand-replay of '
      '20260602000001_adults_kids.sql, which is CREATE TABLE IF NOT EXISTS. They are NOT '
      'dropped here: a migration must not delete member records nobody in the transaction can '
      'read. `adults` carries names, addresses, phone numbers and birthdays, and whichever '
      'policies it has are policies nothing in the product exercises — its original ones test '
      'the spoofable user_metadata claim. Read the rows, satisfy yourself that `people` has '
      'what matters, and drop them in a migration of their own. The permission_table_map row '
      'for a surviving table is deliberately LEFT IN PLACE: it is what maps the table to a '
      'resource, and an unmapped readable table is the worse of the two states.',
      array_to_string(v_kept, ', ');
  END IF;

  IF array_length(v_dropped, 1) IS NULL AND array_length(v_kept, 1) IS NULL THEN
    RAISE NOTICE 'no pre-redesign tables present — this database matches the chain';
  END IF;
END $mig$;

-- ── 3. The catalogue row goes with the table, and only with the table ───────
-- Written as one declarative statement rather than inside the block above, because
-- the condition is exactly "the table is not there" and that reads better as SQL than
-- as a flag carried out of a loop. On a database where `adults` survived §2, this
-- matches nothing and the mapping stays.
--
-- `people` keeps the `members` mapping. Deleting the wrong one of the two would unmap
-- the member directory itself, and the next sweep would leave `people` with no
-- permission clause — which is why §4 asserts it is still there.
DELETE FROM public.permission_table_map
 WHERE table_name = 'adults'
   AND to_regclass('public.adults') IS NULL;

-- ── 4. Verify, unconditionally ──────────────────────────────────────────────
-- Catalogue reads only. No fixture is needed to ask whether a row is gone, so this
-- cannot be one of the verify blocks AGENTS.md warns about — the kind that skips
-- quietly and reports success over something that never ran.
DO $mig$
DECLARE
  v_missing text;
BEGIN
  -- 4a. The row and the table agree with each other, whichever way round they are.
  IF to_regclass('public.adults') IS NULL THEN
    IF EXISTS (SELECT 1 FROM public.permission_table_map WHERE table_name = 'adults') THEN
      RAISE EXCEPTION 'ROLLBACK: public.adults is gone and its permission_table_map row is not';
    END IF;
  ELSE
    IF NOT EXISTS (SELECT 1 FROM public.permission_table_map WHERE table_name = 'adults') THEN
      RAISE EXCEPTION
        'ROLLBACK: public.adults EXISTS and has no permission_table_map row, so the next sweep '
        'would give it no permission clause at all. That is the state this migration exists to '
        'avoid — see its header.';
    END IF;
  END IF;

  -- 4b. The row that must SURVIVE.
  IF NOT EXISTS (
    SELECT 1 FROM public.permission_table_map
     WHERE table_name = 'people' AND resource_key = 'members'
  ) THEN
    RAISE EXCEPTION 'ROLLBACK: the people→members mapping went missing — the wrong row was deleted';
  END IF;

  -- 4c. Whatever else the map names that this database does not have. A WARNING, not
  -- an exception: `20260618000001`'s sweep skips a missing table on purpose ("e.g.
  -- chat installed separately"), so refusing here would refuse a database that is
  -- legitimately arranged differently — and under migrate.yml refusing holds the
  -- Vercel alias. Measured against the local stack on 2026-08-19: of the 46 map rows,
  -- `adults` was the only one whose table was absent.
  SELECT string_agg(m.table_name, ', ' ORDER BY m.table_name) INTO v_missing
    FROM public.permission_table_map m
   WHERE to_regclass('public.' || quote_ident(m.table_name)) IS NULL;

  IF v_missing IS NOT NULL THEN
    RAISE WARNING
      'permission_table_map still names table(s) this database does not have: %. '
      'Every migration that computes a sweep list from this catalogue will skip them with a '
      'NOTICE that reads like a finding. Either the table belongs here and is missing, or the '
      'row is stale and wants a migration like this one.', v_missing;
  ELSE
    RAISE NOTICE 'permission_table_map: every mapped table exists';
  END IF;
END $mig$;

COMMIT;
