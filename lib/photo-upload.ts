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

/** The folder every object of one album must sit directly inside, with its trailing slash. */
export function photoObjectPrefix(familyCode: string, collectionId: string): string {
  return `${familyCode}/${collectionId}/`
}
