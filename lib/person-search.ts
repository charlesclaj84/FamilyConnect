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
 *
 * ── THE CLASS IS `\p{L}\p{N}\p{M}`, AND IT USED TO BE `a-z0-9` ──────────────────────
 * That is a one-line change and the line it replaced was a total failure of search for
 * anybody outside the Latin alphabet. `[^a-z0-9]` deletes every character it does not
 * recognise, so a name written in Han, Cyrillic, Arabic, Hebrew, Devanagari or Thai
 * normalised to the EMPTY STRING — and an empty needle `.includes()`-matches every
 * haystack, so 李明 and Дмитрий were not merely unfindable: typing either one selected the
 * whole family. Silently, with no error anywhere, in every member picker in the product.
 *
 * The `u` flag is REQUIRED for `\p{…}` to mean anything — without it the pattern is a
 * literal `p` followed by braces, which is the failure mode to watch for if this line is
 * ever edited. The `i` flag is gone because it was only ever compensating for the class
 * being lower-case-only.
 *
 * ── `\p{M}` IS IN THE KEEP-SET, AND THE TWO MARK PASSES DO DIFFERENT JOBS ────────────
 * This is the part that is easy to get backwards, and the first draft of this fix did:
 *
 *   pass 2   strips `U+0300–U+036F` explicitly. This is the FOLDING pass — it is what makes
 *            "jose" find "José", and it is aimed at a specific block.
 *   pass 3   keeps letters, digits and **whatever marks pass 2 left behind**.
 *
 * Without `\p{M}` in pass 3, every mark outside that block is deleted too — because a mark
 * is neither a letter nor a number. Measured: `अमित` came back as `अमत`, missing its vowel.
 * A Devanagari matra is a VOWEL, not an accent, so dropping it merges words that are not
 * the same word. Arabic harakat and Thai vowel signs are the same case.
 *
 * ── WHAT THIS STILL FOLDS, STATED HONESTLY ──────────────────────────────────────────
 * `U+0300–U+036F` is the *Combining Diacritical Marks* block, and Latin is not its only
 * user. Measured consequences, both intended-enough to keep and neither obvious:
 *
 *   * **Cyrillic й folds to и.** `й` is `и` + `U+0306` (combining breve), so `Дмитрий`
 *     normalises to `дмитрии`. They are different letters in Russian, so this is lossier
 *     than the Latin case — but it is symmetric: both the query and the name fold, so
 *     search works in both directions and the only cost is that й and и collide.
 *   * **Greek accents fold**, so `Γεώργιος` → `γεωργιος`, which is what a Greek reader
 *     searching without accents wants.
 *
 * Fixing the Cyrillic collision would mean restricting the fold to marks following a Latin
 * base letter, which is a real complication for a real but small loss of precision. Left as
 * it is, deliberately, and recorded so the next person does not think it was unnoticed.
 *
 * Korean needs no special handling: NFD decomposes a Hangul syllable into jamo, jamo are
 * `\p{L}` (Lo), and both the needle and the haystack go through this same function.
 */
export function normalizePersonSearch(s: string): string {
  return s
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^\p{L}\p{N}\p{M}]+/gu, '')
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
