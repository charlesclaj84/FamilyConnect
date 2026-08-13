/**
 * Matching a typed query against a person's names.
 *
 * ── WHY IT IS A MODULE ──────────────────────────────────────────────────────────────
 * AGENTS.md's known-gaps list records that this codebase has hand-rolled a member picker
 * three times, each a little differently, and names the exact symptom: the Member
 * Directory got accent-insensitive search and the photo tagger did not. That is not a
 * bug in either component — it is what happens when the RULE lives inside a component
 * instead of beside the data it is about.
 *
 * So the rule lives here, `PersonMultiSelect` imports it, and the family-tree picker
 * imports the same one. A fourth control that needs it has somewhere to look, and a fix
 * to the normalization reaches every control at once.
 *
 * Pure, with no React and no imports of its own, so it can be reasoned about — and one
 * day tested — without a browser.
 */

/**
 * Fold a string to what a search should actually compare.
 *
 * Three passes, and each earns its place against a real family:
 *
 *   NFD + strip combining marks   "jose" finds "José". A family that spells its own
 *                                 names properly must not be harder to search than one
 *                                 that does not.
 *   drop non-alphanumerics        "oconnor" finds "O'Connor", "maryjane" finds
 *                                 "Mary Jane", "stjohn" finds "St. John".
 *   lowercase                     the obvious one.
 *
 * The diacritic range is written as escapes rather than as literal combining marks,
 * which are invisible in an editor and get eaten by the first tool that touches the file.
 */
export function normalizePersonSearch(s: string): string {
  return s
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/gi, '')
    .toLowerCase()
}

/** The fields a person needs for `matchesPersonQuery` to find them. */
export interface SearchablePerson {
  first_name: string
  last_name: string
  nick_name?: string | null
}

/**
 * Does `person` match `query`?
 *
 * `displayName` is passed separately because it is the DISAMBIGUATED name — computed
 * against the whole roster, so it may carry a birth year or a middle initial that the
 * raw columns do not. Searching it as well as the columns means a query that includes
 * the disambiguator still finds the row it disambiguates.
 *
 * An empty query matches everything, which is what a filter box should do before anybody
 * has typed in it.
 */
export function matchesPersonQuery(
  person: SearchablePerson,
  displayName: string,
  query: string,
): boolean {
  const q = normalizePersonSearch(query)
  if (!q) return true
  return (
    normalizePersonSearch(displayName).includes(q)
    // Concatenated, not joined with a space: `normalizePersonSearch` drops separators
    // anyway, so this is what lets "marthaallen" find "Martha Allen".
    || normalizePersonSearch(`${person.first_name}${person.last_name}`).includes(q)
    || normalizePersonSearch(person.nick_name ?? '').includes(q)
  )
}
