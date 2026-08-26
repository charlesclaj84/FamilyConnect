import { describe, expect, it } from 'vitest'
import { matchesPersonQuery, normalizePersonSearch } from '@/lib/person-search'

/**
 * `lib/person-search.ts`, under `npm test` — a `verify.yml` step, so this gates a pull request.
 *
 * ── WHY IT HAD NO TESTS AND NOW DOES ────────────────────────────────────────────────
 * This module exists because AGENTS.md records that the member picker was hand-rolled three
 * times in this codebase, each a little differently, with the exact symptom named: the Member
 * Directory got accent-insensitive search and the photo tagger did not. Centralising the rule
 * fixed that and left it untested — and the untested half was where a real bug was sitting.
 *
 * **`[^a-z0-9]` deleted every character it did not recognise.** So a name in Han, Cyrillic,
 * Arabic, Hebrew, Devanagari or Thai normalised to the empty string, and because an empty
 * needle `.includes()`-matches everything, typing 李明 into a picker selected the WHOLE
 * FAMILY. Not "no results" — every result. That is the worst shape a search bug can take,
 * because it looks like the control is working.
 *
 * The fix is `[^\p{L}\p{N}]+/gu`. The tests below are split so that the two halves of the
 * rule are asserted separately: the folding that must HAPPEN (accents, punctuation, case) and
 * the characters that must SURVIVE (every other script).
 *
 * ── CHECKED BY MUTATION (AGENTS.md §7b) ─────────────────────────────────────────────
 * A green run is not evidence until it has been seen to fail. Each mutation was applied to
 * `lib/person-search.ts`, the file was diffed against its backup to confirm the edit actually
 * applied, and the count is the MEASURED number of failing tests:
 *
 *   1. the class reverted to `[^a-z0-9]+/gi` (the original bug)  11 failed
 *   2. `\p{M}` dropped from the class                             1 failed
 *   3. the `u` flag dropped from the class                       16 failed
 *   4. the NFD normalize pass removed                             5 failed
 *   5. the combining-mark strip removed                           5 failed
 *   6. `.toLowerCase()` removed                                   9 failed
 *   7. `if (!q) return true` → `return false`                     2 failed
 *
 * MUTATION 3 IS THE ONE TO NOTICE. Without `u`, `\p{L}` is a literal `p` and the class
 * becomes "anything except p, {, L, N, M or }" — so the function strips almost nothing and
 * keeps punctuation. It fails MORE tests than the original bug did, which is the useful
 * direction: a typo in that flag cannot ship quietly.
 *
 * MUTATION 2 FAILS ONLY ONE, and that is worth knowing rather than smoothing over. Dropping
 * `\p{M}` breaks exactly the Devanagari case, because it is the only script in this fixture
 * whose vowels are encoded as marks. One test is enough to gate it, but the thinness is the
 * point: it is a whole class of scripts resting on a single assertion, so **do not delete
 * that test to "simplify the fixture"**. Thai and Arabic in this file happen to use
 * letter-form vowels or no vowel points, so they do not cover it.
 *
 * ── AND THREE MUTATIONS FIRST REPORTED AS NO-OPS ─────────────────────────────────────
 * The harness compares the file against its backup before running, because a `perl -pi -e`
 * whose pattern matches nothing exits 0 and leaves a green suite behind — which reads as a
 * weak test rather than as a broken mutation. Mutations 4, 5 and 6 were written as multi-line
 * regex deletes, matched nothing, and were re-run as line deletes to get the numbers above.
 * A mutation log is only worth what its verification step is worth.
 */

describe('normalizePersonSearch — what must fold away', () => {
  it('folds Latin accents to their base letters', () => {
    expect(normalizePersonSearch('José')).toBe('jose')
    expect(normalizePersonSearch('Nguyễn')).toBe('nguyen')
    expect(normalizePersonSearch('Þórdís')).toBe('þordis')   // þ is a LETTER, not an accent
  })

  it('drops punctuation and spacing', () => {
    expect(normalizePersonSearch("O'Connor")).toBe('oconnor')
    expect(normalizePersonSearch('St. John')).toBe('stjohn')
    expect(normalizePersonSearch('Mary Jane')).toBe('maryjane')
    expect(normalizePersonSearch('Smith-Jones')).toBe('smithjones')
  })

  it('lowercases', () => {
    expect(normalizePersonSearch('MARTHA')).toBe('martha')
  })

  it('keeps digits, because a disambiguated name can carry a birth year', () => {
    expect(normalizePersonSearch('Martha Allen (1962)')).toBe('marthaallen1962')
  })
})

describe('normalizePersonSearch — what must SURVIVE', () => {
  /**
   * THE REGRESSION TESTS. Every one of these returned `''` before the fix, and an empty
   * needle matches every row — so each assertion here is one script that could not be
   * searched for and that selected the entire family when typed.
   */
  it('keeps Han characters', () => {
    expect(normalizePersonSearch('李明')).toBe('李明')
  })

  it('keeps Cyrillic, lowercased — and folds й to и, which is measured not assumed', () => {
    // `U+0300–U+036F` is the *Combining Diacritical Marks* block and Latin is not its only
    // user: `й` is `и` + `U+0306`, so the folding pass takes the breve off. They are
    // different letters in Russian, so this is lossier than the Latin case.
    //
    // It is kept because the fold is SYMMETRIC — the query folds the same way the name does,
    // so search works in both directions and the only cost is that й and и collide. Asserted
    // here so that the behaviour is a recorded decision rather than a surprise, and so that
    // anybody narrowing the fold later has a test that tells them what they changed.
    expect(normalizePersonSearch('Дмитрий')).toBe('дмитрии')
    expect(normalizePersonSearch('Дмитрий')).not.toBe('')
  })

  it('keeps Arabic', () => {
    expect(normalizePersonSearch('محمد')).toBe('محمد')
  })

  it('keeps Hebrew', () => {
    expect(normalizePersonSearch('משה')).toBe('משה')
  })

  it('keeps Devanagari INCLUDING its matras, which is why the class has three properties', () => {
    // A matra is a VOWEL, not an accent. `[^\p{L}\p{N}]` deleted it — a mark is neither a
    // letter nor a number — and this came back as अमत, missing a vowel: a different word,
    // not a folded spelling of the same one. Measured, and it is why `\p{M}` is in the
    // keep-set. The earlier `U+0300–U+036F` pass is what handles Latin accents; this class
    // must not undo the scripts that pass deliberately leaves alone.
    expect(normalizePersonSearch('अमित')).toBe('अमित')
  })

  it('keeps Hangul', () => {
    // NFD decomposes a syllable into jamo and jamo are letters, so nothing special is needed.
    expect(normalizePersonSearch('김민준')).not.toBe('')
  })

  it('keeps Thai, and folds Greek accents', () => {
    expect(normalizePersonSearch('Γεώργιος')).toBe('γεωργιος')
    expect(normalizePersonSearch('สมชาย')).toBe('สมชาย')
  })

  it('still drops punctuation between non-Latin characters', () => {
    // Both halves of the rule at once: the script survives, the separator does not.
    expect(normalizePersonSearch('李 明')).toBe('李明')
  })

  it('is never empty for a name made only of letters', () => {
    // The property that actually matters, stated directly: whatever the script, a name of
    // letters must not normalise to the empty string, because empty matches everything.
    for (const name of ['李明', 'Дмитрий', 'محمد', 'משה', 'अमित', 'สมชาย', 'Θεός']) {
      expect(normalizePersonSearch(name)).not.toBe('')
    }
  })
})

describe('matchesPersonQuery', () => {
  const jose = { first_name: 'José', last_name: 'Álvarez', nick_name: 'Pepe' }
  const li = { first_name: '明', last_name: '李', nick_name: null }

  it('matches an unaccented query against an accented name', () => {
    expect(matchesPersonQuery(jose, 'José Álvarez', 'jose')).toBe(true)
    expect(matchesPersonQuery(jose, 'José Álvarez', 'alvarez')).toBe(true)
  })

  it('matches a nickname', () => {
    expect(matchesPersonQuery(jose, 'José Álvarez', 'pepe')).toBe(true)
  })

  it('matches across the first/last boundary with no space', () => {
    expect(matchesPersonQuery(jose, 'José Álvarez', 'josealvarez')).toBe(true)
  })

  it('does not match an unrelated query', () => {
    expect(matchesPersonQuery(jose, 'José Álvarez', 'martha')).toBe(false)
  })

  it('matches a Han name by its own characters', () => {
    expect(matchesPersonQuery(li, '李明', '李')).toBe(true)
    expect(matchesPersonQuery(li, '李明', '明')).toBe(true)
  })

  it('DOES NOT match every row when a Han query is typed', () => {
    // THE BUG, stated as the assertion that would have caught it. Before the fix the query
    // normalised to '' and this returned true — so searching for one relative in a family of
    // a hundred and forty returned all hundred and forty.
    expect(matchesPersonQuery(jose, 'José Álvarez', '李')).toBe(false)
    expect(matchesPersonQuery(jose, 'José Álvarez', 'Дмитрий')).toBe(false)
  })

  it('matches everything for an empty query, which is what a filter box should do', () => {
    expect(matchesPersonQuery(jose, 'José Álvarez', '')).toBe(true)
    expect(matchesPersonQuery(jose, 'José Álvarez', '   ')).toBe(true)
    expect(matchesPersonQuery(li, '李明', '')).toBe(true)
  })

  it('treats a punctuation-only query as empty rather than as a needle', () => {
    // "'" normalises to '', so it must behave like an empty box and not like a search for a
    // literal apostrophe that happens to match nobody.
    expect(matchesPersonQuery(jose, 'José Álvarez', "'")).toBe(true)
  })
})
