-- ============================================================================
-- A gathering may carry ONE photograph, and it is the Dashboard band's picture.
-- ----------------------------------------------------------------------------
-- WHY THIS COLUMN EXISTS
--   The Golden Master's welcome hero is a greeting on cream, a burgundy event band, and a
--   family PHOTOGRAPH cropped through `eventPhotoMask` between them. Everything but the
--   photograph shipped: `components/dashboard/curves.tsx` holds the kit's crop and fills it
--   with the traced tree, because `gatherings` had no image column and there was nowhere to
--   put one. Its own comment said so — "no schema decision has been made" — and this is that
--   decision.
--
--   ONE photograph, on the GATHERING, not a gallery. The band draws a single crop and the
--   Dashboard shows a single gathering, so a second image would be a picture nothing displays.
--   A family that wants an album already has `photo_collections`.
--
-- ── NO NEW BUCKET, AND THAT IS THE WHOLE RISK CALCULATION ──────────────────────────
--   The file goes in the EXISTING `photos` bucket, at `{family_code}/gatherings/{id}.{ext}`.
--   A `gathering-photos` bucket was the first instinct and is the expensive answer: a bucket
--   is a separate access-control system that none of §2c, §3 or `audit:family-scope` looks at
--   (AGENTS.md, "A STORAGE BUCKET IS NOT COVERED BY ANY OF THE ABOVE"), so a new one owes four
--   hand-written policies, a `tests/rls/raw/storage.mjs` case per command, and a line in every
--   retirement list. Three of the four buckets this product created that way were measured
--   wide open on 2026-08-20, months after they shipped.
--
--   `photos` already has exactly the policies this needs, because `20260820000006` gave it
--   them: INSERT, UPDATE and DELETE are each
--
--       bucket_id = 'photos'
--         AND (storage.foldername(name))[1] = public.auth_family_code()
--         AND public.auth_membership_approved()
--
--   `storage.foldername(name)[1]` is the FIRST segment, so it does not care how many segments
--   follow — `ALPHATEST/gatherings/<uuid>.jpg` is scoped by the same predicate that scopes
--   `ALPHATEST/<collection>/<uuid>.jpg`, with no edit. The bucket is already image-only
--   (`image/jpeg,png,webp,gif`) and already capped at 10 MB, which is the ceiling this feature
--   wants anyway.
--
--   THE COST, STATED: the bucket is `public: true`, so a gathering photograph is readable by
--   anybody who has its URL, exactly like a family photograph. That is the same posture the
--   product already takes for `photos` and the reason AGENTS.md leaves that bucket's READ
--   deliberately unnarrowed — narrowing it is a signed-URL-per-render product decision, not a
--   migration. A family putting a photograph on their dashboard band is publishing it to
--   whoever holds the link, and `/help` says so.
--
--   THE `gatherings/` SEGMENT IS NOT DECORATION. It keeps gathering photographs out of the
--   prefix a photo COLLECTION uses, so `photo_collections` ids and gathering ids can never
--   collide in the same namespace, and a future sweep can enumerate one without the other.
--
-- ── WHY A PATH AND NOT A URL ───────────────────────────────────────────────────────
--   `photo_path` holds the object path, exactly as `photos.file_path` and
--   `documents.file_path` do, and the reading side calls `getPublicUrl`. A stored absolute URL
--   embeds the project ref and the bucket's public/private posture in every row — so moving
--   the project, or ever deciding to sign these, becomes a data migration instead of a change
--   to one function.
--
-- ── WHY NO FOREIGN KEY TO ANYTHING, AND NO TRIGGER ─────────────────────────────────
--   A storage object is not a row this schema can reference. The path is a string, and the
--   only thing that keeps it pointing inside the family is the ACTION that writes it —
--   `setGatheringPhoto` composes it from `auth_family_code()`'s own answer and never from a
--   caller's parameter, which is §2b's "never take an identity as a parameter" applied to a
--   file path. There is no client-supplied path anywhere in the feature.
--
--   The CHECK below is therefore the only structural guard, and it is deliberately narrow: it
--   refuses a blank string, because '' is a path that resolves to the bucket root and would
--   render as a broken image rather than as no image. It does NOT try to validate the shape of
--   the path — a regex here would be a second, weaker copy of the action's construction, and
--   the two would drift.
--
-- ── THE ORPHAN QUESTION, ANSWERED HONESTLY ─────────────────────────────────────────
--   Deleting a gathering does not delete its object: `storage.objects` refuses a direct DELETE
--   (a trigger answers "Use the Storage API instead", 42501), so a cascade is not available to
--   a migration or a trigger. `deleteGathering` removes the object first and the row second,
--   which is the same order `deletePhoto` and `deleteDocument` use. A crash between the two
--   leaves a file nothing references — 10 MB at worst, in a bucket the family already owns —
--   and that is the accepted failure, the same one those two already accept.
-- ============================================================================

BEGIN;

-- ── 1. The column ───────────────────────────────────────────────────────────
ALTER TABLE public.gatherings
  ADD COLUMN IF NOT EXISTS photo_path TEXT;

ALTER TABLE public.gatherings
  DROP CONSTRAINT IF EXISTS gatherings_photo_path_not_blank;
ALTER TABLE public.gatherings
  ADD CONSTRAINT gatherings_photo_path_not_blank
  CHECK (photo_path IS NULL OR length(btrim(photo_path)) > 0);

COMMENT ON COLUMN public.gatherings.photo_path IS
  'Object path in the public `photos` bucket, `{family_code}/gatherings/{id}.{ext}`. NULL means '
  'the Dashboard band draws the kit''s traced-tree placeholder instead. Written only by '
  'setGatheringPhoto, which composes the path from auth_family_code() and never from a caller.';

-- ── 2. No new grant, and no new policy ──────────────────────────────────────
-- `gatherings` has exactly one policy (`perm:gatherings:select`) and no INSERT/UPDATE/DELETE
-- policy at all, which per §2c denies those to the browser outright — every write goes through
-- `createAdminClient()` in an action that re-applies family scoping by hand. A new COLUMN
-- changes none of that: it is covered by the table's existing SELECT policy, and there is no
-- write policy for it to widen. Stated because the reflex on reading "adds a column" is to look
-- for the accompanying grant, and its absence here is correct rather than forgotten.
--
-- It DOES mean the column is readable by anyone holding `gatherings:view`, which is the right
-- answer — the band is for the whole family — and is why the money band needed its own key and
-- this does not.

-- ── 3. Verify ───────────────────────────────────────────────────────────────
DO $mig$
DECLARE
  v_count INT;
  v_ok    BOOLEAN;
BEGIN
  -- The column, and its constraint.
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
     WHERE table_schema = 'public' AND table_name = 'gatherings' AND column_name = 'photo_path'
  ) THEN
    RAISE EXCEPTION 'ROLLBACK: gatherings.photo_path was not created';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
     WHERE conname = 'gatherings_photo_path_not_blank'
       AND conrelid = 'public.gatherings'::regclass
  ) THEN
    RAISE EXCEPTION 'ROLLBACK: the not-blank CHECK is missing';
  END IF;

  -- The bucket this feature depends on, and the properties it depends ON. Asserted rather
  -- than assumed: if `photos` ever stopped accepting images or stopped being public, this
  -- feature would fail at upload time or render a broken image, and neither reports here.
  SELECT public INTO v_ok FROM storage.buckets WHERE id = 'photos';
  IF v_ok IS NULL THEN
    RAISE EXCEPTION 'ROLLBACK: the photos bucket does not exist';
  END IF;
  IF NOT v_ok THEN
    RAISE EXCEPTION 'ROLLBACK: the photos bucket is no longer public — getPublicUrl would 404';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM storage.buckets
     WHERE id = 'photos' AND 'image/jpeg' = ANY(allowed_mime_types)
  ) THEN
    RAISE EXCEPTION 'ROLLBACK: the photos bucket no longer accepts image/jpeg';
  END IF;

  -- The three family-folder write policies from `20260820000006`, which are what make
  -- `{family_code}/gatherings/...` safe with no policy of its own. If they were ever replaced
  -- by something keyed on `auth.uid()` again, this feature would silently stop being scoped —
  -- so it is asserted here as well as there.
  SELECT count(*) INTO v_count FROM pg_policies
   WHERE schemaname = 'storage' AND tablename = 'objects'
     AND policyname IN ('photos_family_insert', 'photos_family_update', 'photos_family_delete')
     AND coalesce(qual, '') || coalesce(with_check, '') LIKE '%auth_family_code%';
  IF v_count <> 3 THEN
    RAISE EXCEPTION
      'ROLLBACK: expected 3 family-scoped photos write policies naming auth_family_code(), found %',
      v_count;
  END IF;

  RAISE NOTICE 'gatherings.photo_path added; photos bucket reused at {family_code}/gatherings/';
END $mig$;

COMMIT;
