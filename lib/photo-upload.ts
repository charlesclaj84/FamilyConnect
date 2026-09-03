/**
 * The shape of a Gallery upload — the size cap, the batch size, and the object path.
 *
 * PURE, for the reason `lib/upload-types.ts` is (AGENTS.md §7b): the same three facts are
 * needed on both sides of the wire, and the bytes no longer travel through a server action,
 * so the two sides have to agree about them without one being able to ask the other.
 *
 * ── WHY THE BYTES BYPASS THE SERVER ACTION AT ALL ──────────────────────────────────
 * `uploadPhotos` took a `FormData` of files and 500'd on anything a phone produces. Two
 * ceilings, and raising the first does not clear the second:
 *
 *   Next.js  `serverActions.bodySizeLimit` defaults to **1 MB**, and the refusal happens in
 *            the framework before the action runs — so it is a 500 with no message rather
 *            than the per-file verdict the dialog is built to print.
 *   Vercel   a serverless function's request body is capped at **4.5 MB**, platform-side.
 *            Nothing in `next.config.ts` moves it.
 *
 * A single modern photograph is 3–5 MB, so the action's own "up to 10 MB each" was never
 * reachable and a batch of them could not be sent at all. The fix is that the bytes go
 * BROWSER → SUPABASE STORAGE directly, against a signed token this product's server minted;
 * only the ticket request and the row write cross a server action, and both are a few hundred
 * bytes. See `createPhotoUploadTickets` in [app/actions/gallery.ts](../app/actions/gallery.ts).
 */

/** 10 MB, matching `gal.formatsAndSize` and `gal.fileTooLarge`. */
export const PHOTO_MAX_BYTES = 10 * 1024 * 1024

/**
 * How many photographs one round of ticket → upload → record handles.
 *
 * The client chunks a picked batch into these and runs the rounds in order, so a reunion's
 * two hundred pictures are two hundred direct uploads and seventeen small action calls rather
 * than one request nothing will carry. Bounded for three reasons and each is a real one: a
 * ticket call mints one signed URL per file and a function has a wall-clock ceiling; a round
 * that fails loses at most this many files' worth of progress; and the dialog can report
 * progress at all, which a single opaque call cannot.
 */
export const PHOTO_UPLOAD_CHUNK = 12

/**
 * Where a photograph's object lives: `<family code>/<collection id>/<photo id><ext>`.
 *
 * ONE DEFINITION, because it is read three times and a disagreement between any two of them
 * is silent. The `photos` bucket's INSERT policy (`20260820000006`) tests the FIRST SEGMENT
 * against `auth_family_code()`, `recordUploadedPhotos` re-derives this prefix to refuse a path
 * the client altered (§4 — the row would carry the caller's own `family_code` while pointing
 * at another family's object), and the ticket minting builds it.
 */
export function photoObjectPath(
  familyCode: string,
  collectionId: string,
  photoId: string,
  ext: string,
): string {
  return `${familyCode}/${collectionId}/${photoId}${ext}`
}

/**
 * The longest edge of a generated thumbnail, in CSS pixels of source image.
 *
 * 640 rather than the ~300 a grid cell actually draws, because the grid is responsive and a
 * retina phone asks for two device pixels per CSS pixel — a 320px thumbnail is visibly soft
 * on the screen most of these are read on. At quality 0.72 a 640px JPEG is 30–60 KB against
 * a 3–5 MB original, so the ratio that matters is unchanged by the headroom.
 */
export const PHOTO_THUMB_MAX_EDGE = 640

/** JPEG quality for the generated thumbnail. See `PHOTO_THUMB_MAX_EDGE`. */
export const PHOTO_THUMB_QUALITY = 0.72

/**
 * The thumbnail's object path: `<family code>/<collection id>/<photo id>_thumb.jpg`.
 *
 * ── THE SAME FOLDER AS THE ORIGINAL, DELIBERATELY ─────────────────────────────────
 * The `photos` bucket's INSERT policy (`20260820000006`) tests the FIRST SEGMENT against
 * `auth_family_code()`, and `recordUploadedPhotos` re-derives `photoObjectPrefix` to refuse a
 * path the client altered (§4). Putting thumbnails under a `thumbs/` prefix would move the
 * family code to the second segment and break the policy for every one of them — silently,
 * because a refused upload is skipped rather than fatal. Same folder, different suffix.
 *
 * ALWAYS `.jpg`, whatever the original was: the canvas encodes JPEG and the extension has to
 * describe the bytes, or the object is served with a content type it is not.
 *
 * DERIVED FROM THE ORIGINAL'S PATH rather than taking the ids again, so the two can never
 * name different photographs. Returns null for a path this module did not build — which is
 * the only honest answer, and the caller then uploads no thumbnail rather than inventing a
 * location for one.
 */
export function photoThumbPath(originalPath: string): string | null {
  const dot = originalPath.lastIndexOf('.')
  const slash = originalPath.lastIndexOf('/')
  if (slash < 0) return null
  const stem = dot > slash ? originalPath.slice(0, dot) : originalPath
  return `${stem}_thumb.jpg`
}

/**
 * Is this path one of ours, and is it a thumbnail?
 *
 * The storage reaper deletes any object no surviving row points at, so it has to be able to
 * tell a thumbnail from an original — see `20260902000003`'s header, which names a reaper
 * that does not know about thumbnails as the one thing this column makes dangerous.
 */
export function isPhotoThumbPath(path: string): boolean {
  return path.endsWith('_thumb.jpg')
}

/** The folder every object of one album must sit directly inside, with its trailing slash. */
export function photoObjectPrefix(familyCode: string, collectionId: string): string {
  return `${familyCode}/${collectionId}/`
}
