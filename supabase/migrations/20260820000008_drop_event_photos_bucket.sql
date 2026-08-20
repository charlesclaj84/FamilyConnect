-- ============================================================================
-- The `event-photos` bucket is gone.
-- ----------------------------------------------------------------------------
-- WHAT IS BEING REMOVED
--   `20260609000000` created three buckets, `event-photos` among them, for a feature that no
--   longer exists: `20260819000006` retired Events and dropped all thirteen `event_*` tables.
--   Nothing in the tree has read or written this bucket since. `20260820000006` dropped its
--   three write policies and put nothing back — so per AGENTS.md §2c it has taken no new
--   object since then — and left the bucket itself, its read policy, and whatever was already
--   in it.
--
--   That leftover state was the whole of the remaining problem: a `public: true` bucket, with
--   a `SELECT` policy admitting anybody, holding files nothing points at, listed in every
--   `\dt storage.*` and every dashboard, for a product surface that was deleted. AGENTS.md
--   has carried "dropping it is owed" since 2026-08-19.
--
-- ── WHY A MIGRATION AS WELL AS A SCRIPT, WHICH LOOKS LIKE DOING IT TWICE ────
--   It is two different removals and each tool can only do one of them.
--
--   `scripts/drop-retired-bucket.mjs` removes the BYTES, through the Storage API. That is the
--   only thing that can: the objects live in the storage backend (a Docker volume locally, S3
--   on hosted), and no amount of SQL reaches them.
--
--   THIS FILE removes the bucket from the SCHEMA, and it has to exist because
--   `20260609000000` is an applied migration that creates the bucket on every fresh
--   database. Without this, `npx supabase db reset` resurrects `event-photos` on every laptop
--   forever while hosted no longer has it — local and hosted disagreeing about what exists,
--   which is the divergence "How migrations reach the hosted project" is written about.
--
--   ORDER MATTERS ON HOSTED, and it is the one operational instruction in this file: run the
--   script FIRST. After this migration applies there are no `storage.objects` rows for the
--   bucket, so nothing can enumerate what to delete, and any bytes still in S3 become
--   unreachable orphans that only a manual sweep of the backend would ever find. Locally the
--   question does not arise — a `db reset` wipes the volume with the database.
--
-- ── HOW A MIGRATION DELETES A STORAGE ROW AT ALL ────────────────────────────
--   `storage.protect_delete()` is a BEFORE DELETE trigger on `storage.objects` that raises
--   42501 — "Direct deletion from storage tables is not allowed. Use the Storage API
--   instead." — and it is not something to fight. It reads its own escape hatch:
--
--       IF COALESCE(current_setting('storage.allow_delete_query', true), 'false') != 'true'
--
--   so `SET LOCAL storage.allow_delete_query = 'true'` is the supported way through, scoped
--   to this transaction and nothing else. No trigger is disabled, no ownership is needed
--   (`storage.objects` is owned by `supabase_storage_admin`, not by the migration role), and
--   `postgres` already holds DELETE on both tables — verified before writing this.
--
--   §1 deletes objects anyway, even though the script should have. Two reasons: the FK
--   `objects_bucketId_fkey` means the bucket row cannot go while any row remains, so a
--   half-run script would otherwise abort the deploy; and the count is reported, so a
--   non-zero one is a NOTICE in the migration log saying that many objects' bytes were left
--   in the backend.
--
-- ── WHAT IS NOT TOUCHED ─────────────────────────────────────────────────────
--   `avatars`, `documents` and `photos`, all three live and all three family- or user-folder
--   scoped since `20260820000002` and `20260820000006`. The assertions in §4 name them, so a
--   later edit that widened this file's `WHERE` clause fails here rather than deleting a
--   bucket the product is using.
-- ============================================================================

BEGIN;

-- ── 1. Any object rows left behind ──────────────────────────────────────────
DO $mig$
DECLARE
  v_objects int;
BEGIN
  SELECT count(*) INTO v_objects FROM storage.objects WHERE bucket_id = 'event-photos';

  IF v_objects > 0 THEN
    -- Said out loud rather than swallowed: these rows are going, and their BYTES are not.
    -- Whoever reads this line in a deploy log is the only person who can still reclaim them.
    RAISE NOTICE
      'event-photos held % object row(s): deleting the rows, but their bytes stay in the storage backend. scripts/drop-retired-bucket.mjs is what removes those, and it had to run BEFORE this.',
      v_objects;
  END IF;

  -- The documented escape hatch in storage.protect_delete(). LOCAL, so it cannot outlive
  -- this transaction and cannot make any other statement's delete succeed.
  PERFORM set_config('storage.allow_delete_query', 'true', true);
  DELETE FROM storage.objects WHERE bucket_id = 'event-photos';
END $mig$;

-- ── 2. The read policy ──────────────────────────────────────────────────────
-- The last policy naming this bucket. Dropped before the bucket row so that nothing is left
-- referring to an id that no longer exists — a policy on a vanished bucket is dead weight
-- that still shows up in every `pg_policies` sweep, including `db:audit`'s.
DROP POLICY IF EXISTS "event_photos_public_read" ON storage.objects;

-- ── 3. The bucket ───────────────────────────────────────────────────────────
DELETE FROM storage.buckets WHERE id = 'event-photos';

-- ── 4. Verify, in both directions ───────────────────────────────────────────
DO $mig$
DECLARE
  v_count int;
BEGIN
  IF EXISTS (SELECT 1 FROM storage.buckets WHERE id = 'event-photos') THEN
    RAISE EXCEPTION 'ROLLBACK: the event-photos bucket survived';
  END IF;

  IF EXISTS (SELECT 1 FROM storage.objects WHERE bucket_id = 'event-photos') THEN
    RAISE EXCEPTION 'ROLLBACK: event-photos object rows survived';
  END IF;

  SELECT count(*) INTO v_count FROM pg_policies
   WHERE schemaname = 'storage' AND tablename = 'objects'
     AND (coalesce(qual, '') LIKE '%event-photos%'
       OR coalesce(with_check, '') LIKE '%event-photos%');
  IF v_count <> 0 THEN
    RAISE EXCEPTION 'ROLLBACK: % policy/policies still name event-photos', v_count;
  END IF;

  -- THE OTHER DIRECTION, and the reason it is here: this file's whole mechanism is a DELETE
  -- with a WHERE clause and a GUC that switches off the guard trigger. A widened WHERE, or a
  -- copy-paste into the wrong bucket name, would be catastrophic and completely silent.
  SELECT count(*) INTO v_count FROM storage.buckets WHERE id IN ('avatars', 'documents', 'photos');
  IF v_count <> 3 THEN
    RAISE EXCEPTION 'ROLLBACK: expected the 3 live buckets to survive, found %', v_count;
  END IF;

  -- And their policies. `avatars` keeps 3 owner-scoped writes + 1 public read;
  -- `photos` keeps 3 family-scoped writes + 1 public read; `documents` keeps 4 family-scoped.
  SELECT count(*) INTO v_count FROM pg_policies
   WHERE schemaname = 'storage' AND tablename = 'objects';
  IF v_count <> 12 THEN
    RAISE EXCEPTION 'ROLLBACK: expected 12 surviving storage.objects policies, found %', v_count;
  END IF;

  RAISE NOTICE 'event-photos is gone: bucket, objects and policy';
END $mig$;

COMMIT;
