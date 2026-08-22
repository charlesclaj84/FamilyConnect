/**
 * Matching a photograph's caption against what somebody typed into the gallery's search box.
 *
 * ── WHY THIS IS A MODULE AND NOT THREE LINES IN `CollectionView` ───────────────────────
 * The same reason `lib/person-search.ts` is one. A matching rule written inside a component
 * can only be shared by copying it, and copying it is exactly how the Member Directory came
 * to search accents and punctuation while the photo tagger did not — the drift AGENTS.md
 * records under "Known gaps". A second surface that searches captions (a gallery-wide
 * search, an album picker, a report) imports this rather than writing `.includes()` again.
 *
 * ── IT NORMALISES THE SAME WAY `person-search` DOES, AND FOR THE SAME REASON ───────────
 * A caption is free text a relative typed on a phone, so it holds accents, curly quotes and
 * whatever punctuation the keyboard offered. Somebody searching for it is typing on a
 * different keyboard. "Jose" has to find "José"; "grandmas 90th" has to find "Grandma's
 * 90th". Unicode NFD then stripping the combining marks does the first, and folding the
 * punctuation does the second.
 *
 * ── THE PUNCTUATION FOLD IS TWO RULES, NOT ONE, AND THE QUERY IS WHY ───────────────────
 * `person-search` deletes every separator, because a person's name is matched as one run.
 * Here an APOSTROPHE is deleted and every OTHER mark becomes a SPACE, and the asymmetry is
 * about what the fold does to the QUERY rather than to the caption:
 *
 *   * "lake, reunion" is TWO terms. Deleting the comma folds it to one term, `lakereunion`,
 *     which matches nothing — and that is the placeholder this box actually shows, so the
 *     first thing a reader copies would find no photograph at all. The mark has to become a
 *     space so `captionTerms` can still split on it.
 *   * "Grandma's" is ONE term. Spacing the apostrophe folds it to two, `grandma` and `s`,
 *     and the `s` then has to be found somewhere in the caption as well.
 *
 * On the CAPTION side the two rules are nearly interchangeable, because matching is by
 * substring: "lake—2026" folded to `lake2026` still contains both `lake` and `2026`. Do not
 * take that as licence to simplify — the query side is what the rule is for.
 *
 * Four code points count as an apostrophe — the typewriter one, the typographic U+2019 that
 * iOS autocorrect and this product's own copy both produce, its opening partner U+2018, and
 * a backtick somebody used for one.
 *
 * ── EVERY TERM HAS TO MATCH, IN ANY ORDER ──────────────────────────────────────────────
 * "reunion lake" finds "Three days at the lake — 2026 reunion". A single-substring test
 * would not, and the failure is silent: the reader concludes the photograph is not there.
 * This is the one behaviour a `.includes()` on the raw string cannot be talked into.
 *
 * ── AN EMPTY QUERY MATCHES EVERYTHING; AN EMPTY CAPTION MATCHES NOTHING ────────────────
 * Both directions are deliberate and neither is symmetric with the other. No query is not a
 * filter, so every photograph passes. A photograph with NO caption cannot match a query the
 * reader actually typed — and reporting it as a match would put the untitled ones in every
 * result set, which is the same thing as having no filter at all.
 */

/** See the header for why the punctuation fold is two passes. Private; both callers below. */
function fold(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/['‘’`]/g, '')
    .replace(/[^a-z0-9 ]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

/** The query's terms, folded. Exported so a caller can report how many it is applying. */
export function captionTerms(query: string): string[] {
  const folded = fold(query)
  return folded ? folded.split(' ') : []
}

/**
 * Does this caption match? See the header: no terms is no filter, and a null caption never
 * matches a real query.
 */
export function matchesCaption(caption: string | null | undefined, query: string): boolean {
  const terms = captionTerms(query)
  if (terms.length === 0) return true
  if (!caption) return false
  const haystack = fold(caption)
  return terms.every(term => haystack.includes(term))
}
