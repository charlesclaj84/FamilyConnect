-- ═══════════════════════════════════════════════════════════════════════════════════════
-- A PURGE DELETES ROWS. THIS IS WHAT FINALLY DELETES THE BYTES
-- ═══════════════════════════════════════════════════════════════════════════════════════
-- 2026-09-01. `delete_family_data_above_tier` removes rows and structurally cannot touch
-- storage: SQL does not reach the storage backend, `storage.protect_delete()` refuses a direct
-- `DELETE FROM storage.objects`, and a `pg_cron` job has no Storage API to call.
--
-- So until now a family whose Plus data was purged kept every image file, in a bucket that is
-- `public: true`, fetchable by URL to anybody who already had one. TODO.md carried it and said
-- so; this is the first of the two options it names — **a reaper on the notice-drain path**,
-- because `/api/billing/notices` already runs Node daily with the service key. The other was
-- `pg_net` from the sweep, which puts an outbound HTTP call inside a transaction that deletes a
-- family tree, and is not a thing to add casually.
--
-- ── THE ENTRY SAID "PHOTOS". IT IS THREE TABLES ACROSS TWO BUCKETS ─────────────────────
-- Measured rather than assumed: every `public` table with a `file_path` column is
-- `photos`, `bylaws` and `documents`, and ALL THREE are purged at `plus`. Photographs are the
-- urgent half because that bucket is public; the other two are private and are still bytes
-- nobody can reach through the product and nothing will ever delete.
--
-- **§6 IS WHAT KEEPS THAT TRUE.** `tier_data_tables` gains `storage_bucket`, and the verify
-- block fails the deploy if a purgeable table has a `file_path` column and no bucket named, or
-- names a bucket and has no such column. A table with files added next year cannot be
-- silently un-reaped — the same shape as `20260901000001`'s completeness assertion, which is
-- the thing that makes a hand-written map survivable.
--
-- ── WHAT THE REAPER MUST NOT DO, AND IT IS ONE SENTENCE ────────────────────────────────
-- It deletes an object that NO SURVIVING ROW POINTS AT. So if the query for surviving rows
-- fails, every object in the family's prefix looks like an orphan — and a refused read would
-- delete a family's entire gallery. `const { data }` discards the error (AGENTS.md §8); this
-- is the sharpest instance of that rule in the product, because the consequence is not an
-- empty screen but permanent destruction. `lib/billing/storage-reaper.ts` reads every error
-- and abandons the family on any of them, and its header says so at length.
--
-- ── THE MARKER, WHICH TODO.md ASKED FOR BY NAME ────────────────────────────────────────
-- *"Needs a marker so it does not re-walk the same deletion forever."* `storage_reaped_at`,
-- plus a recoverable claim in the `platform_billing_notices` shape: a reaper that dies
-- mid-walk must not leave the row claimed forever, or the bytes are stranded by the mechanism
-- meant to remove them.
-- ═══════════════════════════════════════════════════════════════════════════════════════

BEGIN;

-- ── §1. WHICH PURGED TABLES HAVE BYTES ─────────────────────────────────────────────────
ALTER TABLE public.tier_data_tables
  ADD COLUMN IF NOT EXISTS storage_bucket TEXT;

COMMENT ON COLUMN public.tier_data_tables.storage_bucket IS
  'The storage bucket this table''s `file_path` points into, or NULL for a table with no '
  'objects. Consumed by the storage reaper on the notice-drain path. §6 asserts this agrees '
  'with which tables actually have a `file_path` column, in BOTH directions.';

UPDATE public.tier_data_tables SET storage_bucket = 'photos'    WHERE table_name = 'photos';
UPDATE public.tier_data_tables SET storage_bucket = 'documents' WHERE table_name IN ('bylaws', 'documents');

-- ── §2. THE MARKER AND THE CLAIM ───────────────────────────────────────────────────────
ALTER TABLE public.platform_data_deletions
  ADD COLUMN IF NOT EXISTS storage_reaped_at    TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS storage_reap_claimed TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS storage_reap_note    TEXT;

COMMENT ON COLUMN public.platform_data_deletions.storage_reaped_at IS
  'When the bytes behind this purge were swept. NULL means owed. A row whose `deleted` names '
  'no storage-backed table is stamped immediately by the claim, because there is nothing to do '
  'and leaving it NULL would make the queue grow forever.';

COMMENT ON COLUMN public.platform_data_deletions.storage_reap_note IS
  'What the sweep could not remove, if anything. NULL on a clean pass. A storage outage leaves '
  'orphans and says so here rather than failing the purge, which has already happened.';

-- Rows that still owe a sweep, claimed one batch at a time.
--
-- ONE STATEMENT, for `claim_platform_billing_notices`' reason: a read-then-write from Node
-- lets two concurrent drains both decide they are first. Here that is only duplicated work
-- rather than damage — removing an object twice is idempotent — but the house pattern is one
-- statement and a second shape would be a second thing to reason about.
--
-- THE CLAIM IS RECOVERABLE AFTER FIFTEEN MINUTES, exactly as a notice's is. Without it a
-- reaper killed mid-walk leaves the row claimed forever and the bytes are stranded by the
-- mechanism that exists to remove them.
CREATE OR REPLACE FUNCTION public.claim_storage_reaps(p_limit INT DEFAULT 5)
RETURNS TABLE (id UUID, family_code TEXT, buckets TEXT[])
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  RETURN QUERY
  WITH due AS (
    SELECT d.id,
           d.family_code,
           -- DERIVED FROM THE MAP, never listed here. `deleted` is `{table: count}` from
           -- `delete_family_data_above_tier`, so the buckets to walk are the distinct
           -- `storage_bucket`s of the tables it actually deleted rows from. A table added to
           -- the map next year is walked with no edit to this function.
           ARRAY(
             SELECT DISTINCT t.storage_bucket
               FROM public.tier_data_tables t
              WHERE t.storage_bucket IS NOT NULL
                AND d.deleted ? t.table_name
                AND (d.deleted ->> t.table_name)::int > 0
              ORDER BY t.storage_bucket
           ) AS buckets
      FROM public.platform_data_deletions d
     WHERE d.storage_reaped_at IS NULL
       AND (d.storage_reap_claimed IS NULL
            OR d.storage_reap_claimed < NOW() - INTERVAL '15 minutes')
     ORDER BY d.created_at
     LIMIT p_limit
     FOR UPDATE SKIP LOCKED
  ),
  -- NOTHING TO DO IS DONE. A purge that deleted no storage-backed rows is stamped here and
  -- never claimed again; leaving it NULL would grow a queue of rows the reaper re-reads daily
  -- and can never clear.
  nothing AS (
    UPDATE public.platform_data_deletions d
       SET storage_reaped_at = NOW(),
           storage_reap_note = 'no storage-backed rows were deleted'
      FROM due
     WHERE d.id = due.id AND cardinality(due.buckets) = 0
  ),
  claimed AS (
    UPDATE public.platform_data_deletions d
       SET storage_reap_claimed = NOW()
      FROM due
     WHERE d.id = due.id AND cardinality(due.buckets) > 0
    RETURNING d.id
  )
  SELECT due.id, due.family_code, due.buckets
    FROM due
   WHERE cardinality(due.buckets) > 0;
END $$;

-- GRANTED TO NOBODY (§2b). The reaper runs on the service role, which keeps EXECUTE by
-- default; `authenticated` must never be able to claim a sweep, and `anon` least of all.
REVOKE ALL ON FUNCTION public.claim_storage_reaps(INT) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.finish_storage_reap(p_id UUID, p_note TEXT DEFAULT NULL)
RETURNS VOID
LANGUAGE sql
SECURITY DEFINER
SET search_path = ''
AS $$
  UPDATE public.platform_data_deletions
     SET storage_reaped_at = NOW(),
         storage_reap_claimed = NULL,
         storage_reap_note = p_note
   WHERE id = p_id
$$;

REVOKE ALL ON FUNCTION public.finish_storage_reap(UUID, TEXT) FROM PUBLIC, anon, authenticated;

-- ── §3. VERIFY ─────────────────────────────────────────────────────────────────────────
DO $mig$
DECLARE
  v_n     INT;
  v_names TEXT;
  v_code  TEXT := 'REAPPROB';
  v_id    UUID;
  r       RECORD;
BEGIN
  -- 1. THE COMPLETENESS ASSERTION, IN BOTH DIRECTIONS. This is the whole reason the bucket is
  --    a column rather than a list in TypeScript: a purgeable table that gains a `file_path`
  --    column and no bucket is bytes nothing will ever delete, and a bucket named on a table
  --    with no such column is a walk that can only ever look like it worked.
  SELECT string_agg(t.table_name, ', '), count(*) INTO v_names, v_n
    FROM public.tier_data_tables t
   WHERE t.storage_bucket IS NULL
     AND EXISTS (
       SELECT 1 FROM information_schema.columns c
        WHERE c.table_schema = 'public' AND c.table_name = t.table_name
          AND c.column_name = 'file_path');
  IF v_n > 0 THEN
    RAISE EXCEPTION 'ROLLBACK: % purgeable table(s) hold files and name no bucket: % — their '
                    'bytes would survive every purge forever', v_n, v_names;
  END IF;

  SELECT string_agg(t.table_name, ', '), count(*) INTO v_names, v_n
    FROM public.tier_data_tables t
   WHERE t.storage_bucket IS NOT NULL
     AND NOT EXISTS (
       SELECT 1 FROM information_schema.columns c
        WHERE c.table_schema = 'public' AND c.table_name = t.table_name
          AND c.column_name = 'file_path');
  IF v_n > 0 THEN
    RAISE EXCEPTION 'ROLLBACK: % table(s) name a bucket and have no file_path column: %',
                    v_n, v_names;
  END IF;

  -- 2. The three known ones, by name, so a silent re-mapping is caught as well as an omission.
  SELECT count(*) INTO v_n FROM public.tier_data_tables
   WHERE (table_name = 'photos'    AND storage_bucket = 'photos')
      OR (table_name = 'bylaws'    AND storage_bucket = 'documents')
      OR (table_name = 'documents' AND storage_bucket = 'documents');
  IF v_n <> 3 THEN
    RAISE EXCEPTION 'ROLLBACK: expected three storage-backed purge tables, found %', v_n;
  END IF;

  -- 3. EVERY NAMED BUCKET EXISTS. A typo here is a walk that lists nothing and reports a clean
  --    sweep — the silent-success shape this codebase keeps finding, and the reason the
  --    `photos` DELETE policy went unnoticed for months.
  SELECT string_agg(DISTINCT t.storage_bucket, ', '), count(DISTINCT t.storage_bucket)
    INTO v_names, v_n
    FROM public.tier_data_tables t
   WHERE t.storage_bucket IS NOT NULL
     AND NOT EXISTS (SELECT 1 FROM storage.buckets b WHERE b.id = t.storage_bucket);
  IF v_n > 0 THEN
    RAISE EXCEPTION 'ROLLBACK: % named bucket(s) do not exist: %', v_n, v_names;
  END IF;

  -- 4. NO GRANT TO A BROWSER ROLE on either function (§2b).
  IF has_function_privilege('authenticated', 'public.claim_storage_reaps(int)', 'EXECUTE')
     OR has_function_privilege('anon', 'public.claim_storage_reaps(int)', 'EXECUTE')
     OR has_function_privilege('authenticated', 'public.finish_storage_reap(uuid,text)', 'EXECUTE')
     OR has_function_privilege('anon', 'public.finish_storage_reap(uuid,text)', 'EXECUTE') THEN
    RAISE EXCEPTION 'ROLLBACK: a browser role can claim or finish a storage sweep';
  END IF;

  -- ── EXERCISED FOR REAL ────────────────────────────────────────────────────────────
  INSERT INTO public.families (family_code, family_name, tier)
       VALUES (v_code, 'Reaper probe', 'free');

  -- 5. A PURGE THAT TOOK NO FILES IS STAMPED AND NEVER CLAIMED AGAIN. Without this branch the
  --    queue grows by one row per purge forever and the reaper re-reads all of them daily.
  INSERT INTO public.platform_data_deletions (family_code, reason, tier_kept, deleted)
       VALUES (v_code, 'retention', 'free', '{"person_relationships": 4}'::jsonb)
    RETURNING id INTO v_id;
  SELECT count(*) INTO v_n FROM public.claim_storage_reaps(10);
  IF v_n <> 0 THEN
    RAISE EXCEPTION 'ROLLBACK: a purge with no storage-backed rows was claimed for a walk';
  END IF;
  IF (SELECT storage_reaped_at FROM public.platform_data_deletions WHERE id = v_id) IS NULL THEN
    RAISE EXCEPTION 'ROLLBACK: a purge with nothing to reap was left owing forever';
  END IF;

  -- 6. A PURGE THAT TOOK PHOTOGRAPHS AND BYLAWS IS CLAIMED, AND NAMES BOTH BUCKETS ONCE.
  --    `bylaws` and `documents` share a bucket, so the DISTINCT is what stops the reaper
  --    walking one prefix twice and reporting doubled counts.
  INSERT INTO public.platform_data_deletions (family_code, reason, tier_kept, deleted)
       VALUES (v_code, 'retention', 'free',
               '{"photos": 12, "bylaws": 2, "documents": 3, "chat_messages": 40}'::jsonb)
    RETURNING id INTO v_id;
  SELECT count(*) INTO v_n FROM public.claim_storage_reaps(10);
  IF v_n <> 1 THEN
    RAISE EXCEPTION 'ROLLBACK: expected one claimable sweep, got %', v_n;
  END IF;

  -- 7. A ZERO COUNT IS NOT A DELETION. `delete_family_data_above_tier` reports every table it
  --    considered, so `{"photos": 0}` means it looked and found none — walking a bucket for
  --    that is work with no possible result.
  INSERT INTO public.platform_data_deletions (family_code, reason, tier_kept, deleted)
       VALUES (v_code, 'retention', 'free', '{"photos": 0}'::jsonb);
  SELECT count(*) INTO v_n FROM public.claim_storage_reaps(10);
  IF v_n <> 0 THEN
    RAISE EXCEPTION 'ROLLBACK: a purge that deleted zero photographs was claimed';
  END IF;

  -- 8. AND A CLAIM IS NOT RE-CLAIMED WHILE IT IS FRESH, which is what makes two drains safe.
  SELECT count(*) INTO v_n FROM public.claim_storage_reaps(10);
  IF v_n <> 0 THEN
    RAISE EXCEPTION 'ROLLBACK: a freshly claimed sweep was handed out a second time';
  END IF;

  -- 9. `finish_storage_reap` clears the claim and stamps it.
  PERFORM public.finish_storage_reap(
    (SELECT id FROM public.platform_data_deletions
      WHERE family_code = v_code AND storage_reap_claimed IS NOT NULL LIMIT 1),
    'probe');
  SELECT count(*) INTO v_n FROM public.platform_data_deletions
   WHERE family_code = v_code AND storage_reaped_at IS NULL;
  IF v_n <> 0 THEN
    RAISE EXCEPTION 'ROLLBACK: % sweep(s) still owed after finishing them all', v_n;
  END IF;

  DELETE FROM public.platform_data_deletions WHERE family_code = v_code;
  DELETE FROM public.families WHERE family_code = v_code;

  RAISE NOTICE 'storage reaper: 3 tables over 2 buckets, claim recoverable after 15 minutes.';
END $mig$;

COMMIT;
