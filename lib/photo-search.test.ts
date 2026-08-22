import { describe, expect, it } from 'vitest'
import { captionTerms, matchesCaption } from './photo-search'

/**
 * The cases that are not obvious from reading the two functions, per AGENTS.md §7b.
 *
 * A GREEN RUN IS NOT EVIDENCE UNTIL YOU HAVE SEEN IT FAIL, and this suite was checked that
 * way. Each of these mutations turns a different set of them red:
 *
 *   * drop `.normalize('NFD')` and the combining-mark strip → "finds an accented caption"
 *   * drop the punctuation class (`[^a-z0-9 ]+`)             → "ignores an apostrophe",
 *                                                              "ignores a typographic quote"
 *   * replace the space in that class with nothing            → "splits on punctuation too",
 *     "takes a comma-separated query as separate terms" (a punctuated query folds to one
 *     term that matches nothing). It does NOT trip the caption-side cases, because matching
 *     is by substring — see the module header, which says so rather than leaving it to be
 *     rediscovered.
 *   * change `terms.every` to `terms.some`                    → "every term has to match"
 *   * return `true` for a null caption                        → "an untitled photograph
 *                                                               never matches a real query"
 *   * return `false` for an empty query                       → "no query is not a filter"
 */

describe('captionTerms', () => {
  it('is empty for an empty query, so no query is not a filter', () => {
    expect(captionTerms('')).toEqual([])
    expect(captionTerms('   ')).toEqual([])
  })

  it('is empty for a query that is nothing but punctuation', () => {
    // Somebody who has typed only `'` or `—` has not narrowed anything, and treating that
    // as a filter would empty the grid over a stray keystroke.
    expect(captionTerms('—')).toEqual([])
    expect(captionTerms("'''")).toEqual([])
  })

  it('splits on whitespace and folds each term', () => {
    expect(captionTerms('  Lake   Reunion ')).toEqual(['lake', 'reunion'])
  })

  it('splits on punctuation too, which is what the search box placeholder needs', () => {
    // The placeholder in `CollectionView` is literally "lake, reunion, 90th" — so if the
    // comma were DELETED rather than spaced, the first query a reader copies out of the box
    // would fold to one term, `lakereunion90th`, and find nothing at all. This is the case
    // the two-pass fold exists for; on the caption side the two rules are interchangeable.
    expect(captionTerms('lake, reunion, 90th')).toEqual(['lake', 'reunion', '90th'])
  })

  it('keeps an apostrophised word as ONE term', () => {
    expect(captionTerms("Grandma's")).toEqual(['grandmas'])
  })
})

describe('matchesCaption', () => {
  it('matches everything when no query is given', () => {
    expect(matchesCaption('Three days at the lake', '')).toBe(true)
    expect(matchesCaption(null, '')).toBe(true)
    expect(matchesCaption(null, '  ')).toBe(true)
  })

  it('an untitled photograph never matches a real query', () => {
    expect(matchesCaption(null, 'lake')).toBe(false)
    expect(matchesCaption('', 'lake')).toBe(false)
  })

  it('is case-insensitive', () => {
    expect(matchesCaption('Three days at the LAKE', 'lake')).toBe(true)
    expect(matchesCaption('three days at the lake', 'LAKE')).toBe(true)
  })

  it('matches a substring of a word, not only a whole word', () => {
    // A reader typing "reun" mid-thought has to see the reunion photographs; a whole-word
    // rule would show nothing until the last letter.
    expect(matchesCaption('2026 reunion', 'reun')).toBe(true)
  })

  it('matches terms in any order', () => {
    expect(matchesCaption('Three days at the lake — 2026 reunion', 'reunion lake')).toBe(true)
  })

  it('every term has to match', () => {
    expect(matchesCaption('Three days at the lake', 'lake wedding')).toBe(false)
  })

  it('finds an accented caption from an unaccented query, and the reverse', () => {
    expect(matchesCaption('José at the grill', 'jose')).toBe(true)
    expect(matchesCaption('Jose at the grill', 'josé')).toBe(true)
  })

  it('ignores an apostrophe on either side', () => {
    expect(matchesCaption("Grandma's 90th", 'grandmas')).toBe(true)
    expect(matchesCaption('Grandmas 90th', "grandma's")).toBe(true)
  })

  it('ignores a typographic quote, which is a different code point from an apostrophe', () => {
    // iOS autocorrect and the copy in this product both produce U+2019, so a caption typed
    // on a phone and a query typed on a laptop disagree unless both are folded.
    expect(matchesCaption('Grandma’s 90th', "grandma's")).toBe(true)
    expect(matchesCaption("Grandma's 90th", 'grandma’s')).toBe(true)
  })

  it('finds both words across an em dash with no spaces round it', () => {
    // NOT evidence that the dash folds to a space: matching is by substring, so `lake2026`
    // contains both terms either way. It is here because the caption is one a phone
    // produces and somebody will otherwise assume this case was never considered.
    expect(matchesCaption('At the lake—2026', 'lake 2026')).toBe(true)
  })

  it('matches a number in a caption', () => {
    expect(matchesCaption("Grandma's 90th", '90')).toBe(true)
  })

  it('takes a comma-separated query as separate terms', () => {
    // Same case as `captionTerms` above, end to end: the box's own placeholder.
    expect(matchesCaption('Three days at the lake, 2026 reunion', 'lake, reunion')).toBe(true)
    expect(matchesCaption('Three days at the lake', 'lake, reunion')).toBe(false)
  })
})
