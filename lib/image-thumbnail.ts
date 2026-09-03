/**
 * Make a small JPEG out of an image file, in the browser, before it is uploaded.
 *
 * ── WHY THIS IS IN THE BROWSER AND NOT ON A SERVER ─────────────────────────────────
 * `20260902000003`'s header argues the whole choice; the short version is that the bytes are
 * deliberately no longer allowed to cross a server action (Next's 1 MB body cap and Vercel's
 * 4.5 MB one are what forced the signed-upload design in `lib/photo-upload.ts`), Supabase's
 * image transformation is a metered paid add-on, and an Edge Function is a second deployment
 * target that can be down while uploads look like they worked. The browser already holds the
 * file it is about to send.
 *
 * ── IT IS ALLOWED TO ANSWER `null`, AND CALLERS MUST TREAT THAT AS ORDINARY ────────
 * Three real cases, and none of them is a failure worth reporting to a member:
 *
 *   A FORMAT THE BROWSER CANNOT DECODE. HEIC is the live one — Safari renders it and Chrome
 *   does not, so the same photograph from the same phone thumbnails on one browser and not
 *   on another. `decode()` rejects and this answers null.
 *   AN IMAGE WITH NO PIXELS. A zero-dimension decode, which some malformed files produce.
 *   `toBlob` REFUSING. It answers null of its own accord under memory pressure, and a very
 *   large image can hit that on a phone.
 *
 * In every one of them the photograph still uploads and still renders, from the original —
 * which is exactly what every row written before thumbnails existed does. A thumbnail is an
 * optimisation, and an optimisation that can fail the thing it optimises is a bug.
 *
 * ── NO `useState`, NO HOOK, NO `'use client'` ──────────────────────────────────────
 * It touches `document` and `Image`, so it only ever RUNS in a browser — but it is a plain
 * async function, so a module that imports it is not forced across the client boundary by the
 * import alone. The one caller is already `'use client'`. If a Server Component ever imports
 * this, the crash is at call time rather than at render, and there is nothing to call.
 *
 * ── AND IT IS NOT UNDER `npm test` ────────────────────────────────────────────────
 * `vitest.config.mts`' `include` is `lib/**\/*.test.ts` and it has NO jsdom — that boundary is
 * stated in AGENTS.md §7b and this module is exactly what it excludes: canvas, `Image`,
 * `createObjectURL`. There is no pure arithmetic here worth extracting either; `fit` below is
 * four lines and is checked by the one thing that can check it, which is looking at a
 * thumbnail. Said out loud rather than left as an absence.
 */
import { PHOTO_THUMB_MAX_EDGE, PHOTO_THUMB_QUALITY } from '@/lib/photo-upload'

/**
 * The drawn size for a source of `w` x `h`, longest edge capped at `max`.
 *
 * NEVER ENLARGED. An image already smaller than the cap is drawn at its own size, so a 200px
 * avatar-sized upload produces a 200px thumbnail rather than a blurry 640px one — and the
 * thumbnail is then, correctly, about the same size as the original, which costs nothing.
 */
function fit(w: number, h: number, max: number): { w: number; h: number } {
  const longest = Math.max(w, h)
  if (longest <= max) return { w, h }
  const scale = max / longest
  return { w: Math.round(w * scale), h: Math.round(h * scale) }
}

/**
 * A JPEG blob of `file`, no longer than `PHOTO_THUMB_MAX_EDGE` on its longest edge, or null.
 *
 * The object URL is revoked in a `finally`, because an upload of two hundred photographs
 * leaks two hundred decoded images otherwise and a phone runs out of memory long before the
 * batch finishes.
 */
export async function makeThumbnail(file: File): Promise<Blob | null> {
  if (typeof document === 'undefined') return null

  const url = URL.createObjectURL(file)
  try {
    const img = new Image()
    img.src = url
    // `decode()` rather than an `onload` promise: it rejects on a format this browser cannot
    // read, where `onerror` and a never-firing `onload` are the same silence. It is the whole
    // of the HEIC handling.
    await img.decode()

    const { w, h } = fit(img.naturalWidth, img.naturalHeight, PHOTO_THUMB_MAX_EDGE)
    if (w < 1 || h < 1) return null

    const canvas = document.createElement('canvas')
    canvas.width = w
    canvas.height = h
    const ctx = canvas.getContext('2d')
    if (!ctx) return null
    ctx.drawImage(img, 0, 0, w, h)

    return await new Promise<Blob | null>(resolve => {
      // JPEG, ALWAYS. `photoThumbPath` writes a `.jpg` extension, so the bytes have to be
      // one — an object served with a content type it is not is the sort of thing that works
      // in every browser until it does not. PNG would also defeat the point: a photographic
      // PNG at 640px is several times the size of the JPEG.
      canvas.toBlob(blob => resolve(blob), 'image/jpeg', PHOTO_THUMB_QUALITY)
    })
  } catch {
    // Every failure lands here and every failure means the same thing: no thumbnail for this
    // one. Deliberately not reported to the member — see the header.
    return null
  } finally {
    URL.revokeObjectURL(url)
  }
}
