/**
 * How a filed document is classified.
 *
 * ── WHY THIS IS A MODULE OF ITS OWN AND NOT A CONST IN `app/actions/documents.ts` ───
 * The same reason `lib/board-positions.ts` exists, and it is a build failure rather than a
 * preference: **a `'use server'` file may only export async functions.** `next build` refuses
 * one with "A 'use server' file can only export async functions, found object", and it refuses
 * it at page-data collection rather than at compile — so it survives `tsc` and `eslint` and
 * fails the deploy. Types are fine there because they do not exist at runtime; an array is not.
 *
 * It is a better home anyway. Three surfaces read this list — the action that validates an
 * upload, the dialog that offers the options, and the filter above the table — and one
 * definition is what stops the third from drifting from the first.
 *
 * ── THREE, DOWN FROM FIVE, AND NEITHER REMOVAL WAS TIDYING ──────────────────────────
 *   photos    the Gallery is the screen for a photograph, and it does albums, tagging and a
 *             lightbox that a document list never will. A `photos` category here was an
 *             invitation to put family pictures somewhere they cannot be found.
 *   minutes   Meeting Minutes is a real screen since 2026-08-22, with a secretary, an attendee
 *             list and votes. A PDF of minutes from a meeting held outside the product is a
 *             record of something that happened elsewhere, which is what `other` is for.
 *
 * `bylaws` STAYS even though Bylaws is now its own screen: a family may well file a scanned
 * historical copy as a document, and that screen is for the text they want SEARCHED.
 *
 * ── NOTHING IS REWRITTEN, AND NOTHING IS HIDDEN ─────────────────────────────────────
 * `documents.category` is TEXT with no constraint, so rows filed under a retired value keep it.
 * `categoryLabel` in the list falls through to the raw string rather than dropping the row:
 * rewriting somebody's filing decision is not a thing a category change gets to do, and hiding
 * the row would be worse than showing an old word.
 */
export const DOCUMENT_CATEGORIES = [
  { value: 'bylaws', label: 'Bylaws' },
  { value: 'forms',  label: 'Forms' },
  { value: 'other',  label: 'Other' },
] as const

export type DocumentCategory = (typeof DOCUMENT_CATEGORIES)[number]['value']

/** True for a value this screen offers. Used to bound both a filter and a write. */
export function isDocumentCategory(value: unknown): value is DocumentCategory {
  return typeof value === 'string'
    && DOCUMENT_CATEGORIES.some(c => c.value === value)
}

/**
 * The word to print for a stored category, including one no longer offered.
 *
 * Capitalised rather than passed through raw, so a legacy `minutes` reads as "Minutes" and not
 * as a database value somebody left on the screen.
 */
export function documentCategoryLabel(value: string): string {
  return DOCUMENT_CATEGORIES.find(c => c.value === value)?.label
    ?? (value ? value.charAt(0).toUpperCase() + value.slice(1) : 'Other')
}
