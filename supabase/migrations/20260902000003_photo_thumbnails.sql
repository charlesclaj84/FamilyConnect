-- ════════════════════════════════════════════════════════════════════════════
-- A GRID OF THUMBNAILS DOWNLOADED THE FULL PHOTOGRAPHS
--
-- `/community/gallery` and an album page draw every picture at a couple of hundred pixels
-- and fetch the ORIGINAL for each one. A phone's photograph is 3–5 MB, so an album of forty
-- is upwards of 150 MB over the wire to render a page of postage stamps — on a phone, on
-- mobile data, before anybody has opened anything. `next/image` cannot help: the `photos`
-- bucket is `public: true` and served straight from Supabase, so the browser is fetching the
-- object itself and the only thing that decides how many bytes move is which object.
--
-- ── WHAT THIS ADDS ──────────────────────────────────────────────────────────────────
-- `photos.thumb_path` — a second object beside the original, written by the uploader at the
-- same moment and from the same bytes. A grid reads it; the lightbox and the download read
-- `file_path`. That is the whole mechanism.
--
-- ── WHY THE BROWSER MAKES IT, AND NOT US ────────────────────────────────────────────
-- The three alternatives were weighed and each costs something this one does not:
--
--   A TRANSFORM URL      Supabase's image transformation is a paid, metered add-on and is
--                        billed per origin image. It would also make every thumbnail a
--                        request that can fail independently of the object existing.
--   `sharp` ON THE SERVER  the bytes deliberately no longer cross a server action — that is
--                        the whole of `lib/photo-upload.ts`' argument, and Next's 1 MB body
--                        cap plus Vercel's 4.5 MB one is what forced it. Resizing on the
--                        server means sending the original to the server again.
--   AN EDGE FUNCTION     a second deployment target, a second secret, and a second thing
--                        that can be down while uploads look like they worked.
--
-- The browser already holds the bytes it is about to upload. A `<canvas>` draw and a
-- `toBlob` produce a ~40 KB JPEG from a 4 MB original with no dependency, no metering and no
-- new service — and it works identically on every deployment, which is the property that
-- decided it.
--
-- ── IT IS NULLABLE, AND THAT IS PERMANENT ───────────────────────────────────────────
-- NULL means "no thumbnail for this one", and every reader falls back to `file_path`. Three
-- ways a row legitimately has none, so this can never become NOT NULL:
--
--   1. EVERY PHOTOGRAPH ALREADY UPLOADED. There is no backfill and there cannot be a cheap
--      one — the bytes are in a storage bucket, not in this database, so resizing them is a
--      script that downloads and re-uploads every object in the product. TODO.md carries it;
--      until it runs, an old album is exactly as fast as it is today and no slower.
--   2. A FORMAT THE CANVAS CANNOT DECODE. HEIC is the live case: Safari renders it, Chrome
--      does not, so the same file thumbnails on one phone and not on another.
--   3. THE THUMBNAIL UPLOAD FAILED while the original's succeeded. The original is what the
--      family cares about, so a failed thumbnail is skipped rather than failing the photo.
--
-- ── THE OBJECT LIVES IN THE SAME FOLDER, WHICH IS A SECURITY DECISION ───────────────
-- `<family code>/<collection id>/<photo id>_thumb.jpg`, so it sits under the SAME first
-- segment the `photos` bucket's INSERT policy tests against `auth_family_code()`
-- (`20260820000006`) and inside the same prefix `recordUploadedPhotos` re-derives (§4). A
-- separate `thumbs/` bucket would need its own four policies and its own copy of that
-- argument; a `thumbs/` prefix INSIDE the bucket would put the family code second and break
-- the policy silently for every thumbnail.
--
-- ── A SECOND OBJECT PER ROW IS THE DANGEROUS PART, AND IT IS TWO EDITS ──────────────
-- Every path in the product that removes a photograph's FILE has to remove both, and every
-- path that decides which files are still WANTED has to count both. They fail in opposite
-- directions and both are silent:
--
--   `deletePhoto` / `deleteCollection`   miss the thumbnail and it stays in a `public: true`
--                                        bucket, fetchable by URL, after the family deleted
--                                        the photograph. That is `20260820000006`'s finding
--                                        on the `photos` DELETE policy, in a new place.
--   THE STORAGE REAPER                   `lib/billing/storage-reaper.ts` deletes every object
--                                        under a purged family's prefix that no SURVIVING row
--                                        points at, and it built that set from `file_path`
--                                        alone — so it would have deleted the thumbnail of
--                                        every photograph the family KEPT, and nothing on any
--                                        screen would go wrong, because a missing thumbnail
--                                        renders as the original.
--
-- Both are edited in this commit, and the reaper's half is the one this migration carries a
-- column for — see `storage_thumb_column` below.
--
-- ── NO POLICY CHANGE ────────────────────────────────────────────────────────────────
-- A column is not a table. `photos` keeps its four composed policies and this column is
-- readable and writable exactly where the row is — which is right: a thumbnail is a smaller
-- copy of a photograph somebody may already see, and withholding it while publishing the
-- original would be a control that protects nothing.
--
-- HOW THIS REACHES A DATABASE
--   `supabase db push`, from CI on merge to master. See AGENTS.md, "How migrations reach the
--   hosted project".
-- ════════════════════════════════════════════════════════════════════════════

BEGIN;

ALTER TABLE public.photos
  ADD COLUMN IF NOT EXISTS thumb_path TEXT;

COMMENT ON COLUMN public.photos.thumb_path IS
  'A small JPEG beside the original, at <family>/<collection>/<photo id>_thumb.jpg, made by '
  'the uploading browser from the same bytes. Grids read it; the lightbox and the download '
  'read file_path. NULL is permanent and legitimate — every row written before 20260902000003 '
  'has none, a format the canvas cannot decode has none, and a failed thumbnail upload does '
  'not fail its photograph. Every reader falls back to file_path.';

-- ── AND THE REAPER'S MAP LEARNS ABOUT IT ────────────────────────────────────
--
-- `lib/billing/storage-reaper.ts` deletes every object under a purged family's prefix that no
-- SURVIVING ROW points at, and it builds the survivor set from one column: `file_path`. So on
-- the day this column shipped, a tier purge would have deleted the thumbnail of every
-- photograph the family KEPT — the objects are real, they are under the family's prefix, and
-- no `file_path` names them.
--
-- `storage_thumb_column` is the same device `storage_bucket` (20260901000006) and
-- `stripe_subscription_kind` (20260901000008) already are: the map is DERIVED and asserted in
-- BOTH DIRECTIONS, so a table that starts holding a second object per row cannot be silently
-- un-reaped, and a column named on a table that does not have it cannot be a survivor read
-- that only ever looks like it worked.
--
-- IT IS NOT DERIVED IN CODE FROM `file_path`. A reaper that computed `<stem>_thumb.jpg` would
-- be a SECOND definition of the naming scheme sitting beside `photoThumbPath`, and the day
-- they disagreed the reaper would delete live thumbnails — silently, because a deleted
-- thumbnail renders as the original and nothing on any screen goes wrong.
ALTER TABLE public.tier_data_tables
  ADD COLUMN IF NOT EXISTS storage_thumb_column TEXT;

COMMENT ON COLUMN public.tier_data_tables.storage_thumb_column IS
  'A SECOND column on this table holding a storage path, beside file_path — today only '
  'photos.thumb_path. The storage reaper unions both into its survivor set; a table that '
  'holds two objects per row and does not name the second here has its second object '
  'deleted on every tier purge. Asserted against the real columns in both directions by '
  '20260902000003.';

UPDATE public.tier_data_tables
   SET storage_thumb_column = 'thumb_path'
 WHERE table_name = 'photos';

-- ── Verify ──────────────────────────────────────────────────────────────────
DO $mig$
DECLARE
  v_n INT;
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
     WHERE table_schema = 'public' AND table_name = 'photos' AND column_name = 'thumb_path'
  ) THEN
    RAISE EXCEPTION 'photos.thumb_path was not created';
  END IF;

  -- NULLABLE, asserted rather than assumed. Every reason a row legitimately has no thumbnail
  -- is in the header, and the first of them is "every photograph that already exists" — a
  -- future NOT NULL would make the table unwritable for anything the canvas cannot decode.
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
     WHERE table_schema = 'public' AND table_name = 'photos' AND column_name = 'thumb_path'
       AND is_nullable = 'NO'
  ) THEN
    RAISE EXCEPTION 'photos.thumb_path must stay nullable — see this migration''s header';
  END IF;

  -- THE POLICIES ARE UNTOUCHED. Four on `photos` before this migration and four after; a
  -- column does not get its own, and a sweep that added one here would be composing an
  -- `auth_permission` factor onto a column rather than a row.
  SELECT count(*) INTO v_n FROM pg_policies
   WHERE schemaname = 'public' AND tablename = 'photos';
  IF v_n < 1 THEN
    RAISE EXCEPTION 'photos has no policies at all — something else has gone wrong';
  END IF;

  -- ── THE REAPER MAP, IN BOTH DIRECTIONS ────────────────────────────────────────
  --
  -- FORWARD: every column named here exists on the table that names it. A name that does not
  -- resolve makes the reaper's survivor read answer 42703, which PostgREST turns into a dead
  -- query — and `survivingPaths` abandons the family, so it fails safe rather than deleting.
  -- Still wrong, and still worth refusing the deploy over: a reaper that abandons every family
  -- is a reaper that never runs, which is indistinguishable from one that is working.
  SELECT count(*) INTO v_n
    FROM public.tier_data_tables t
   WHERE t.storage_thumb_column IS NOT NULL
     AND NOT EXISTS (
       SELECT 1 FROM information_schema.columns c
        WHERE c.table_schema = 'public'
          AND c.table_name = t.table_name
          AND c.column_name = t.storage_thumb_column
     );
  IF v_n > 0 THEN
    RAISE EXCEPTION
      '% tier_data_tables row(s) name a storage_thumb_column the table does not have', v_n;
  END IF;

  -- BACKWARD, AND THIS IS THE ONE THAT MATTERS. Any table in the purge map that carries a
  -- `thumb_path` column and does NOT name it here has every one of those objects deleted on
  -- the next tier purge — the exact failure this migration exists to prevent, arriving in a
  -- year on a table nobody was thinking about. Derived from the real columns rather than from
  -- a list, which is the whole reason 20260901000006 wrote its own assertion this way.
  SELECT count(*) INTO v_n
    FROM public.tier_data_tables t
    JOIN information_schema.columns c
      ON c.table_schema = 'public'
     AND c.table_name = t.table_name
     AND c.column_name = 'thumb_path'
   WHERE t.storage_thumb_column IS DISTINCT FROM 'thumb_path';
  IF v_n > 0 THEN
    RAISE EXCEPTION
      '% purgeable table(s) have a thumb_path column and do not name it in '
      'storage_thumb_column — the reaper would delete every one of those objects', v_n;
  END IF;

  -- AND A THUMB COLUMN ONLY MEANS ANYTHING ON A TABLE WITH A BUCKET. Without one the reaper
  -- never walks the table at all, so naming a second column there is a row that reads as a
  -- control and consults nothing.
  SELECT count(*) INTO v_n
    FROM public.tier_data_tables
   WHERE storage_thumb_column IS NOT NULL AND storage_bucket IS NULL;
  IF v_n > 0 THEN
    RAISE EXCEPTION
      '% row(s) name a storage_thumb_column with no storage_bucket — the reaper never '
      'walks that table', v_n;
  END IF;

  RAISE NOTICE 'photos.thumb_path added (nullable; % policies on photos, unchanged), '
    'and tier_data_tables.storage_thumb_column names it for the reaper', v_n;
END $mig$;

COMMIT;
