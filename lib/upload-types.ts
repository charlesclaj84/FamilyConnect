/**
 * What may be uploaded, and to which screen.
 *
 * PURE, AND THAT IS THE WHOLE REASON IT EXISTS (AGENTS.md §7b). Four surfaces need the same
 * answer and two of them are on opposite sides of the wire:
 *
 *   the `accept` attribute on the file input   so the picker does not offer a `.exe`
 *   the client's own check before it uploads   so a drag-and-drop is refused instantly
 *   the SERVER ACTION                          because a `'use server'` export is a public
 *                                              HTTP endpoint and the input is not in its
 *                                              request path (§2)
 *   the copy that says what is allowed         so the sentence cannot drift from the rule
 *
 * The third is the only one that is a gate. The other three are affordances that must AGREE
 * with it, and the way to make them agree is one list, not four.
 *
 * ── WHY BOTH A MIME TYPE AND AN EXTENSION ARE CHECKED ───────────────────────────────
 * Neither alone is sound and they fail in opposite directions.
 *
 * `File.type` is the BROWSER's guess, taken from the OS's own file-type registry. It is
 * absent for a file the OS does not recognise (a `.csv` on a machine with no spreadsheet
 * installed arrives as `''`), and it is attacker-controlled at the endpoint, because a
 * `multipart/form-data` body carries whatever content type the client wrote in it.
 *
 * The extension is what the family will double-click, and it is what decides whether the
 * download opens in Excel or in Notepad. It is also trivially wrong on purpose.
 *
 * So: the extension must be on the list, AND the MIME type must either be on the list or be
 * absent. That accepts the honest `.csv` with no registered type and refuses the `.exe`
 * renamed to `.pdf` — because its extension is now `.pdf` and its type is
 * `application/x-msdownload`, which is not on the list.
 *
 * ── WHAT THIS IS NOT ────────────────────────────────────────────────────────────────
 * It is NOT content inspection. Nothing here opens the file, so a genuine executable renamed
 * to `.pdf` AND relabelled `application/pdf` passes. What bounds the damage is downstream and
 * is worth knowing rather than assuming: the buckets serve files rather than executing them,
 * `documents` is private and reached through a signed URL, and nothing in this product ever
 * runs an uploaded file. Magic-byte sniffing is the next rung and is not built.
 */

/** One allowed format: what the browser calls it, and what the family calls it. */
export interface UploadFormat {
  /** The MIME types a browser may report for this format. */
  mimeTypes: readonly string[]
  /** Lower-case, with the dot. */
  extensions: readonly string[]
  /** For the sentence under the control. */
  label: string
}

/**
 * IMAGES ONLY, for the Gallery.
 *
 * HEIC is deliberately absent. Every iPhone shoots it by default, so leaving it out is a real
 * cost — and including it would be worse: no browser but Safari can DISPLAY one, so the
 * gallery would accept an upload that renders as a broken image for most of the family. iOS
 * converts to JPEG on upload through a file input, which is why this is the right call rather
 * than merely the easy one. Accepting it needs server-side transcoding first.
 *
 * SVG is deliberately absent too, and this one is a security decision rather than a
 * compatibility one: an SVG is a document that can carry script, and the `photos` bucket is
 * PUBLIC — so an uploaded SVG is a same-origin-ish HTML payload at a URL on our domain.
 */
export const IMAGE_FORMATS: readonly UploadFormat[] = [
  { mimeTypes: ['image/jpeg', 'image/pjpeg'], extensions: ['.jpg', '.jpeg'], label: 'JPEG' },
  { mimeTypes: ['image/png'],                 extensions: ['.png'],         label: 'PNG' },
  { mimeTypes: ['image/webp'],                extensions: ['.webp'],        label: 'WebP' },
  { mimeTypes: ['image/gif'],                 extensions: ['.gif'],         label: 'GIF' },
]

/**
 * DOCUMENTS ONLY: Excel, Word, PDF and CSV.
 *
 * Both generations of each Office format, because a family's records are decades old: `.doc`
 * and `.xls` are what a document written in 2004 actually is, and refusing them would refuse
 * exactly the archive this screen exists to hold.
 *
 * `text/plain` is accepted for `.csv` alongside `text/csv`, because that is what Windows
 * reports for one on a machine with no spreadsheet installed — the absent-type case one step
 * along. It does NOT put `.txt` on the list: the extension check is what keeps them apart.
 */
export const DOCUMENT_FORMATS: readonly UploadFormat[] = [
  { mimeTypes: ['application/pdf'], extensions: ['.pdf'], label: 'PDF' },
  {
    mimeTypes: [
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    ],
    extensions: ['.doc', '.docx'],
    label: 'Word',
  },
  {
    mimeTypes: [
      'application/vnd.ms-excel',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    ],
    extensions: ['.xls', '.xlsx'],
    label: 'Excel',
  },
  { mimeTypes: ['text/csv', 'text/plain'], extensions: ['.csv'], label: 'CSV' },
]

/**
 * The `accept` attribute for a file input.
 *
 * Extensions AND MIME types, both, because browsers disagree about which they honour: Safari
 * has historically ignored a bare extension and Windows' picker has ignored some MIME types.
 * Listing both means the picker filters on whichever it understands. It is a HINT either way —
 * every picker offers an "All files" escape — which is why the same list is checked twice more.
 */
export function acceptAttribute(formats: readonly UploadFormat[]): string {
  return [
    ...formats.flatMap(f => f.extensions),
    ...formats.flatMap(f => f.mimeTypes),
  ].join(',')
}

/** "JPEG, PNG, WebP or GIF" — the sentence under the control, derived rather than typed. */
export function formatList(formats: readonly UploadFormat[]): string {
  const labels = formats.map(f => f.label)
  if (labels.length <= 1) return labels[0] ?? ''
  return `${labels.slice(0, -1).join(', ')} or ${labels[labels.length - 1]}`
}

/** The extension of a file name, lower-cased and with its dot. `''` when it has none. */
export function extensionOf(fileName: string): string {
  // The LAST dot, and only when something follows it and something precedes it. A leading-dot
  // name like `.htaccess` has no extension by this reading, which is the safe answer: it falls
  // through to "not on the list".
  const at = fileName.lastIndexOf('.')
  if (at <= 0 || at === fileName.length - 1) return ''
  return fileName.slice(at).toLowerCase()
}

/**
 * Is this file one of these formats? See the header for why both halves are asked.
 *
 * `mimeType` may be `''` or undefined, which is ACCEPTED when the extension is on the list —
 * that is the honest `.csv` on a machine with no spreadsheet. It is not a loophole: a file
 * whose extension is not on the list is refused whatever its type says.
 */
export function isAllowedUpload(
  fileName: string,
  mimeType: string | null | undefined,
  formats: readonly UploadFormat[],
): boolean {
  const ext = extensionOf(fileName)
  if (!ext) return false
  const match = formats.find(f => f.extensions.includes(ext))
  if (!match) return false
  const type = (mimeType ?? '').toLowerCase().split(';')[0].trim()
  if (!type) return true
  return match.mimeTypes.includes(type)
}

/** The refusal, in the words the reader needs: what they gave, and what is taken. */
export function uploadRejection(
  fileName: string,
  formats: readonly UploadFormat[],
): string {
  const ext = extensionOf(fileName)
  return ext
    ? `${fileName} is a ${ext} file. Only ${formatList(formats)} can go here.`
    : `${fileName} has no file extension, so it cannot be checked. Only ${formatList(formats)} can go here.`
}
