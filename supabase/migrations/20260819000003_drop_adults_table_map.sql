-- ============================================================================
-- `permission_table_map` stops naming a table that does not exist.
--
-- WHAT IS WRONG
--   The map carries a row for `adults`, keyed on `members`, with an
--   `auth.uid()`-based own/self expression. `20260602000003_schema_redesign.sql`
--   DROPPED that table — `adults`, `kids` and `family_ancestors` were replaced by
--   the unified `people` table — and `20260618000001` seeded the map afterwards
--   with the row still in its VALUES list. So `to_regclass('public.adults')` has
--   been NULL for as long as the map has existed.
--
-- WHY IT MATTERS, GIVEN NOTHING IS BROKEN
--   Nothing reads this table at run time. Its readers are MIGRATIONS: they compute
--   a sweep list from it, precisely so a future map row is swept by re-running a
--   file rather than by somebody remembering it. `20260806000011` §6 is the worked
--   example, and it handles the absence correctly — it skips with a RAISE NOTICE.
--
--   The cost is a reader's time, twice over, and both halves were paid:
--
--     * A `NOTICE` in a migration log that reads like a finding, on a chain where
--       every other notice is one.
--     * A raw probe written against the computed list fails with 42P01 rather than
--       telling you anything. `tests/rls/raw/sweep.mjs` deliberately omits `adults`
--       and has carried a paragraph explaining why since 2026-08-17.
--
--   A catalogue that describes the schema and does not is the thing this repo is
--   least willing to keep, because every migration that derives a list from it
--   inherits the lie. TODO.md has carried the repair since 2026-08-17.
--
-- WHY DELETING THE ROW CANNOT CHANGE WHO MAY DO WHAT
--   This is the assertion worth being sure of, and it is different from the one
--   `20260813000000` had to make about `permission_resources`.
--
--   The composed policies were built AT MIGRATION TIME. `20260618000001` read the
--   map, called `_perm_predicate()` and wrote the resulting SQL string into each
--   policy with `CREATE POLICY`; a policy does not consult the map when it is
--   evaluated. So no existing policy anywhere changes when this row goes — and in
--   particular the `members` resource is untouched, because `people` has its own
--   row and keeps it.
--
--   What changes is FUTURE sweeps, and it changes them from "skip this with a
--   notice" to "there is nothing here to skip". That is the whole effect.
--
-- WHAT THIS DELIBERATELY DOES NOT DO
--   It does not assert that every OTHER mapped table exists. `20260618000001`'s
--   sweep skips a missing table on purpose ("e.g. chat installed separately"), so
--   an EXCEPTION on that condition would refuse a database that is legitimately
--   arranged differently from this one — and, under migrate.yml, refusing holds the
--   Vercel alias. Measured against the local stack on 2026-08-19: of the 46 map
--   rows, `adults` is the only one whose table is absent. Any other is reported
--   with a RAISE WARNING below, which keeps drift visible without holding a
--   release on a question. Same shape, and the same reasoning, as
--   `20260817000003` §4a's warning about a colliding role name.
--
-- THE SEED IS EDITED TOO, in 20260618000001. Required rather than tidy: that
-- insert is `ON CONFLICT DO UPDATE`, so leaving the row in the VALUES list would
-- re-add it on every `db reset` and a fresh local database would carry a mapping
-- hosted does not. AGENTS.md §6 states the rule for adding a resource — the
-- migration AND the seed — and a retirement owes the same pair. Editing an applied
-- file reaches fresh databases only, which is why the DELETE below is what reaches
-- hosted.
--
-- IDEMPOTENT. The delete is unfiltered by state and matches nothing on a second
-- run — and matches nothing at all on a fresh database, where the edited seed never
-- created the row.
--
-- HOW THIS REACHES A DATABASE
--   `supabase db push`, from CI on merge to master — never `psql -f` by hand. See
--   AGENTS.md, "How migrations reach the hosted project".
-- ============================================================================

BEGIN;

-- ── 1. Refuse if `adults` has come back ─────────────────────────────────────
-- Cheap, needs no fixture, and it is the one way this migration could do harm: if
-- some future migration recreated an `adults` table, its map row would be the thing
-- that binds it to the `members` resource, and deleting the row would leave the
-- table mapped to nothing — which the next sweep would read as "no permission
-- clause is owed here". Better to stop and be re-thought.
DO $mig$
BEGIN
  IF to_regclass('public.adults') IS NOT NULL THEN
    RAISE EXCEPTION
      'ROLLBACK: public.adults EXISTS. This migration assumes the table was dropped by '
      '20260602000003 and the map row is stale. If the table is back, the row is not '
      'stale — it is what maps the table to the `members` resource. Re-think before '
      'deleting it.';
  END IF;

  -- The row that must SURVIVE. Deleting the wrong one of the two `members` rows
  -- would unmap the member directory itself, and the next sweep would leave
  -- `people` with no permission clause. Same check, and the same reason, as
  -- 20260813000000's "the wrong key was deleted".
  IF NOT EXISTS (
    SELECT 1 FROM public.permission_table_map
     WHERE table_name = 'people' AND resource_key = 'members'
  ) THEN
    RAISE EXCEPTION
      'ROLLBACK: permission_table_map has no people→members row. Something has already '
      'gone wrong with this catalogue; do not delete anything from it until that is '
      'understood.';
  END IF;
END $mig$;

-- ── 2. The stale row goes ───────────────────────────────────────────────────
DELETE FROM public.permission_table_map WHERE table_name = 'adults';

-- ── 3. Verify, unconditionally ──────────────────────────────────────────────
-- No fixture is needed to ask whether a row is gone, so this cannot be one of the
-- verify blocks AGENTS.md warns about — the kind that skips quietly and reports
-- success over something that never ran.
DO $mig$
DECLARE
  v_missing text;
BEGIN
  IF EXISTS (SELECT 1 FROM public.permission_table_map WHERE table_name = 'adults') THEN
    RAISE EXCEPTION 'ROLLBACK: the adults row is still in permission_table_map';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.permission_table_map
     WHERE table_name = 'people' AND resource_key = 'members'
  ) THEN
    RAISE EXCEPTION 'ROLLBACK: the people→members mapping went with it — the wrong row was deleted';
  END IF;

  -- Whatever else the map names that this database does not have. A WARNING, for
  -- the reason in the header: a missing table is legitimate for a database
  -- assembled differently, and holding a production release on a question is how a
  -- gate comes to be Force Promoted routinely.
  SELECT string_agg(m.table_name, ', ' ORDER BY m.table_name) INTO v_missing
    FROM public.permission_table_map m
   WHERE to_regclass('public.' || m.table_name) IS NULL;

  IF v_missing IS NOT NULL THEN
    RAISE WARNING
      'permission_table_map still names table(s) this database does not have: %. '
      'Every migration that computes a sweep list from this catalogue will skip them '
      'with a NOTICE that reads like a finding. Either the table belongs here and is '
      'missing, or the row is stale and wants a migration like this one.', v_missing;
  ELSE
    RAISE NOTICE 'permission_table_map: every mapped table exists';
  END IF;
END $mig$;

COMMIT;
