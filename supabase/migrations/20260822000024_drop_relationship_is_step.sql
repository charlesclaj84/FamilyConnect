-- ═══════════════════════════════════════════════════════════════════════════════════════
-- Drop `person_relationships.is_step`.
--
-- ── IT HAS BEEN DEAD SINCE 2026-08-13 ──────────────────────────────────────────────────
-- `20260602000003` created it to turn "Son" into "Step-Son" at render time. `20260813000007`
-- superseded it with `link_kind` — `blood | step | adopted | foster`, set when a relative is
-- added and changed afterwards through the manage dialog, and the column the Bloodline toggle
-- actually walks. That migration deliberately did NOT drop this one ("`is_step` IS SUPERSEDED,
-- NOT DROPPED"), which was the right call at the time and left the thing AGENTS.md §4c names
-- as the hazard: two columns describing one fact is how they come to disagree.
--
-- Nothing has read it since. What still WROTE it, up to today, was three explicit writes of
-- its own default — two `is_step: false` in `app/actions/family-tree.ts` and one copy in
-- `link-person.ts` — plus four in the RLS fixture. All seven went in the same commit as this
-- file, which is the ordering that matters: a write to a dropped column is 42703 and takes the
-- whole statement with it.
--
-- ── A DROP COLUMN INVERTS THE DEPLOYMENT ARGUMENT, AND THAT IS ADMISSIBLE HERE ─────────
-- `migrate.yml` applies migrations while the OLD code is still serving, because a migration
-- this repo ships is additive and the running code does not use it yet. A DROP is the one
-- shape where that is backwards: for one alias window the old code writes `is_step: false` to
-- a table that no longer has the column, PostgREST answers 42703, and `addRelative` fails.
--
-- Admissible for the reason `20260822000001` gives for the same trade: **no family is using
-- this product yet.** If that stops being true, the shape is two deploys — land the code that
-- stops writing it, then land the drop.
--
-- The cost here is narrower than that migration's anyway. This drops a column nothing READS,
-- so no screen renders wrong in the window; the only symptom is that adding a relative fails
-- for as long as it lasts.
--
-- ── WHAT `20260813000006` TEACHES ABOUT DROPPING A COLUMN ──────────────────────────────
-- That file dropped `people.is_minor` and is the model this follows: check what depends on the
-- column BEFORE dropping it rather than letting `CASCADE` decide, and assert afterwards that
-- nothing was taken that should not have been. A bare `DROP COLUMN ... CASCADE` would silently
-- remove a policy, an index or a view that happened to reference it — and on this table, a
-- policy is exactly the sort of thing a `CASCADE` must never be trusted with.
-- ═══════════════════════════════════════════════════════════════════════════════════════

BEGIN;

-- ── §1. WHAT DEPENDS ON IT ─────────────────────────────────────────────────────────────
-- Reported before anything is dropped, and REFUSED rather than cascaded. `20260813000007`
-- already read the column once (to migrate `is_step = true` rows onto `link_kind = 'step'`),
-- so a policy or an index naming it would be a surprise — which is exactly when a hand-run
-- `CASCADE` does the most damage.
DO $mig$
DECLARE
  v_policies text;
  v_indexes  text;
  v_rows     bigint;
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
     WHERE table_schema = 'public' AND table_name = 'person_relationships'
       AND column_name = 'is_step'
  ) THEN
    RAISE NOTICE 'is_step: already gone — nothing to do';
    RETURN;
  END IF;

  SELECT string_agg(policyname, ', ' ORDER BY policyname) INTO v_policies
    FROM pg_policies
   WHERE schemaname = 'public' AND tablename = 'person_relationships'
     AND (COALESCE(qual, '') || COALESCE(with_check, '')) LIKE '%is_step%';
  IF v_policies IS NOT NULL THEN
    RAISE EXCEPTION 'is_step is named by policy/policies: % — rewrite them first rather than '
      'letting CASCADE decide', v_policies;
  END IF;

  SELECT string_agg(indexname, ', ' ORDER BY indexname) INTO v_indexes
    FROM pg_indexes
   WHERE schemaname = 'public' AND tablename = 'person_relationships'
     AND indexdef LIKE '%is_step%';
  IF v_indexes IS NOT NULL THEN
    RAISE EXCEPTION 'is_step is named by index/indexes: %', v_indexes;
  END IF;

  -- INFORMATIONAL, and it is the fact that makes this a safe drop rather than a data loss:
  -- 20260813000007 migrated every `true` onto `link_kind = 'step'` and nothing has written
  -- one since, so this should be 0. It NOTICEs rather than raising — a row that is `true`
  -- has already been carried across, so it is a curiosity rather than a reason to stop.
  EXECUTE 'SELECT count(*) FROM public.person_relationships WHERE is_step IS TRUE'
     INTO v_rows;
  RAISE NOTICE 'is_step: % row(s) still true (each already carried onto link_kind by '
    '20260813000007)', v_rows;
END $mig$;

-- ── §2. THE DROP ───────────────────────────────────────────────────────────────────────
-- RESTRICT, not CASCADE, and explicitly rather than by omission: §1 has established there is
-- nothing to cascade, so if Postgres disagrees this must fail loudly rather than quietly take
-- whatever it found with it.
ALTER TABLE public.person_relationships DROP COLUMN IF EXISTS is_step RESTRICT;

-- ── §3. VERIFY ─────────────────────────────────────────────────────────────────────────
DO $mig$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
     WHERE table_schema = 'public' AND table_name = 'person_relationships'
       AND column_name = 'is_step'
  ) THEN
    RAISE EXCEPTION 'is_step survived the drop';
  END IF;

  -- THE COLUMN THAT REPLACED IT MUST STILL BE THERE. Asserted because this migration's whole
  -- justification is that `link_kind` carries the fact — dropping `is_step` from a table that
  -- had somehow lost `link_kind` would be dropping the fact itself.
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
     WHERE table_schema = 'public' AND table_name = 'person_relationships'
       AND column_name = 'link_kind'
  ) THEN
    RAISE EXCEPTION 'link_kind is missing — 20260813000007 has not been applied, so dropping '
      'is_step would drop the fact rather than a duplicate of it';
  END IF;

  -- AND THE TRIGGER THAT KEEPS A MARRIAGE OUT OF THE BLOODLINE. §4c: a spouse-type edge may
  -- never be 'blood', and `person_relationships_marriage_is_not_blood` is what enforces it.
  -- It reads `link_kind` and not `is_step`, so this drop cannot have touched it — asserted
  -- rather than assumed, because that is the one rule on this table a column drop could
  -- plausibly have cascaded away.
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger t
      JOIN pg_class c ON c.oid = t.tgrelid
      JOIN pg_namespace n ON n.oid = c.relnamespace
     WHERE n.nspname = 'public' AND c.relname = 'person_relationships'
       AND t.tgname = 'person_relationships_marriage_is_not_blood'
       AND NOT t.tgisinternal
  ) THEN
    RAISE EXCEPTION 'the marriage-is-not-blood trigger is gone — see AGENTS.md §4c';
  END IF;
END $mig$;

COMMENT ON COLUMN public.person_relationships.link_kind IS
  'blood | step | adopted | foster. THE one column recording whether an edge is by blood; '
  'is_step was dropped by 20260822000024 and must not come back. Set on both directions of a '
  'link, corrected to step on any spouse-type edge by '
  'person_relationships_marriage_is_not_blood. See AGENTS.md 4c.';

COMMIT;
