import { describe, expect, it } from 'vitest'
import { compareValues, sortRows } from '@/lib/sort-rows'

/**
 * `compareValues` and `sortRows`, under `npm test` — a `verify.yml` step, so this gates a PR.
 *
 * WHY IT IS TESTED: it is about to be the comparator behind every sortable table in the
 * product, and a sort that is subtly wrong is the definition of a silent bug — the table
 * renders, the rows are all there, and nobody can tell that "10" came before "9" or that the
 * ninety people with no board position are sitting on top of the list. There is no error to
 * notice and no screen that reports it.
 *
 * The blanks-last cases carry the most weight, because that is the rule a hand-written
 * comparator gets wrong by default: `null` compares as 0 against everything, so blanks land
 * wherever the sort's stability leaves them, and negating an ascending comparator to get
 * descending drags them all to the top.
 *
 * CHECKED BY MUTATION, as AGENTS.md §7b requires — measured 2026-08-21:
 *
 *   * `if (aBlank) return 1` → `return -1`                 4 failed
 *   * `''` dropped from `isBlank`                          3 failed
 *   * numeric branch removed (numbers go via String)       1 failed — the fraction case
 *   * boolean branch removed                               2 failed
 *   * `sensitivity: 'base'` dropped                        1 failed — the accent TIE
 *   * `numeric: true` dropped                              1 failed — "Chapter 10"
 *   * `[...rows]` → `rows` (sort in place)                 1 failed — the no-mutation case
 *   * the `cmp === 0 ? 0 :` guard removed                  1 failed — the `-0` case
 *
 * TWO OF THOSE SURVIVED THE FIRST PASS and the tests that pin them were written afterwards,
 * which is the process working rather than a footnote: the numeric branch looked load-bearing
 * and is not for integers (numeric collation already orders "9" before "10"), and
 * `sensitivity: 'base'` looked load-bearing and is not for ORDERING (the default already puts
 * Á beside A) — only for EQUALITY. The fraction case and the tie case are what make each of
 * them matter, and neither would have been written without the mutation coming back green.
 */
describe('compareValues', () => {
  describe('blanks sort last, in BOTH directions', () => {
    it('puts null after a value ascending and descending', () => {
      expect(compareValues(null, 'Allen', 'asc')).toBeGreaterThan(0)
      expect(compareValues(null, 'Allen', 'desc')).toBeGreaterThan(0)
      expect(compareValues('Allen', null, 'desc')).toBeLessThan(0)
    })

    it('treats undefined and the empty string as blank too', () => {
      expect(compareValues(undefined, 'Allen', 'desc')).toBeGreaterThan(0)
      expect(compareValues('', 'Allen', 'desc')).toBeGreaterThan(0)
      expect(compareValues('   ', 'Allen', 'desc')).toBeGreaterThan(0)
    })

    it('ties two blanks, so stability decides and they do not shuffle', () => {
      expect(compareValues(null, '', 'asc')).toBe(0)
      expect(compareValues(null, undefined, 'desc')).toBe(0)
    })

    it('does NOT treat 0 or false as blank — those are facts', () => {
      expect(compareValues(0, 5, 'asc')).toBeLessThan(0)
      expect(compareValues(false, true, 'asc')).toBeGreaterThan(0)
    })
  })

  describe('numbers compare numerically', () => {
    it('orders 9 before 10, which a string sort does not', () => {
      expect(compareValues(9, 10, 'asc')).toBeLessThan(0)
      expect(compareValues(9, 10, 'desc')).toBeGreaterThan(0)
    })

    it('handles negatives, which a reversal is written as in this product', () => {
      // A reversal is a `paid` row with a negative amount — see AGENTS.md §7c.
      expect(compareValues(-500, 100, 'asc')).toBeLessThan(0)
    })

    it('orders FRACTIONS correctly, which is what the numeric branch is actually for', () => {
      // The pin for that branch, and it took a surviving mutation to find. Deleting it and
      // letting numbers fall through to `localeCompare(..., { numeric: true })` passes every
      // integer case above — numeric collation reads digit runs, so "9" before "10" is right
      // either way. It breaks on a decimal point: as strings, "1.5" and "1.25" compare their
      // runs as 1 vs 1 then 5 vs 25, so 1.5 sorts BELOW 1.25. Routing percentages are the
      // column that would show it (`AdminFundsClient` accepts `step="0.01"`).
      expect(compareValues(1.5, 1.25, 'asc')).toBeGreaterThan(0)
    })
  })

  describe('strings are locale-aware and accent-insensitive', () => {
    it('sorts an accented name beside its unaccented neighbour, not after Z', () => {
      expect(compareValues('Ángel', 'Angela', 'asc')).toBeLessThan(0)
      expect(compareValues('Ángel', 'Zeb', 'asc')).toBeLessThan(0)
    })

    it('TIES an accented name with its unaccented spelling', () => {
      // The pin for `sensitivity: 'base'`, and also a surviving mutation before it was written.
      // The default sensitivity ('variant') already puts Á next to A, so the neighbour test
      // above passes without the option — what it cannot do is treat them as the SAME letter.
      // Tying matters because stability then keeps "Angel" and "Ángel" in their incoming order
      // instead of always separating them by accent, which is a distinction no reader of a
      // family directory is scanning for.
      expect(compareValues('Ángel', 'Angel', 'asc')).toBe(0)
      expect(compareValues('ángela', 'Angela', 'desc')).toBe(0)
    })

    it('sorts embedded numbers numerically', () => {
      expect(compareValues('Chapter 2', 'Chapter 10', 'asc')).toBeLessThan(0)
    })

    it('compares YYYY-MM-DD chronologically with no Date constructed', () => {
      expect(compareValues('2026-08-01', '2026-08-31', 'asc')).toBeLessThan(0)
      expect(compareValues('2025-12-31', '2026-01-01', 'asc')).toBeLessThan(0)
    })
  })

  it('puts true first ascending, because a flagged row is what you clicked for', () => {
    expect(compareValues(true, false, 'asc')).toBeLessThan(0)
    expect(compareValues(true, false, 'desc')).toBeGreaterThan(0)
  })
})

describe('sortRows', () => {
  const rows = [
    { name: 'Marcus', chapter: 'Austin', due: 300 },
    { name: 'ángela', chapter: null, due: 1000 },
    { name: 'Beth', chapter: 'Dallas', due: 20 },
    { name: 'Ethan', chapter: '', due: 20 },
  ]

  it('orders by a string column with blanks last', () => {
    expect(sortRows(rows, r => r.chapter, 'asc').map(r => r.name))
      .toEqual(['Marcus', 'Beth', 'ángela', 'Ethan'])
  })

  it('keeps blanks last when reversed, and reverses only the values', () => {
    expect(sortRows(rows, r => r.chapter, 'desc').map(r => r.name))
      .toEqual(['Beth', 'Marcus', 'ángela', 'Ethan'])
  })

  it('orders by a numeric column', () => {
    expect(sortRows(rows, r => r.due, 'asc').map(r => r.due)).toEqual([20, 20, 300, 1000])
  })

  it('is stable, so a tie keeps the incoming order', () => {
    // Beth and Ethan both owe 20 and Beth arrives first.
    expect(sortRows(rows, r => r.due, 'asc').slice(0, 2).map(r => r.name))
      .toEqual(['Beth', 'Ethan'])
  })

  it('does not mutate the array it was given', () => {
    const before = rows.map(r => r.name)
    sortRows(rows, r => r.name, 'desc')
    expect(rows.map(r => r.name)).toEqual(before)
  })

  it('handles an empty list', () => {
    expect(sortRows([], (r: { a: number }) => r.a, 'asc')).toEqual([])
  })
})

describe('the collation is the reader, not the host', () => {
  // ── WHY THIS BLOCK EXISTS, AND WHY IT IS ONE LETTER ─────────────────────────────
  // `localeCompare(x, undefined, …)` asks the RUNTIME for its default collation, which is
  // `en-US` on a laptop and whatever the container's ICU build says in production. That is
  // invisible until it is not — and the one place it is visible in the three languages this
  // product ships is `ñ`, which is a LETTER OF ITS OWN in Spanish and files after `n`.
  //
  // Measured before the change: the whole rest of the Latin surface sorts identically under
  // `en`, `es` and `fr` — Loeb/Lœb, Strasse/Straße, digits, mixed case, and every accented
  // vowel. Modern CLDR dropped Spanish's `ch`/`ll` digraph rules in 1994. So this really is
  // one letter, and the reason to thread a locale anyway is that the letter is real and the
  // determinism is free.
  //
  // ── MUTATION-CHECKED, per §7b. Four, all tripping ────────────────────────────────
  //   * the locale ignored — `localeCompare(…, undefined, …)` again          2 failed
  //   * `sortRows` drops it on the way through to `compareValues`            2 failed
  //   * `DEFAULT_COLLATION` changed from `'en'`                              1 failed
  //   * `sensitivity: 'base'` dropped                                       1 failed
  //
  // The third is the one worth having: it is the only assertion that can see a default that
  // is a DECISION rather than the host's, and it works by comparing the no-locale call with
  // the explicit English one rather than by naming a constant this module does not export.
  const spanishSurnames = ['Nu', 'Ñato', 'Nz', 'Núñez']

  it('files ñ after n for a Spanish reader', () => {
    // The Spanish alphabet's order. A family with a Ñato in it wants the name here.
    expect(sortRows(spanishSurnames, s => s, 'asc', 'es-MX'))
      .toEqual(['Nu', 'Núñez', 'Nz', 'Ñato'])
  })

  it('files ñ with n for an English or French reader', () => {
    // NOT a bug in those languages — `ñ` is `n` with a mark on it there, and this is what a
    // reader of either expects. Both are asserted, because a change that made them agree
    // with Spanish would be wrong in a way only this line would catch.
    // FIRST, not merely mixed in — `sensitivity: 'base'` folds `Ñ` to `n` in these two, so
    // `Ñato` compares as `nato` and beats `Nu` on the second letter. That is the accent-folding
    // decision 2 already made, working; the Spanish case above is a different letter rather
    // than a different accent, which is the whole distinction this block is about.
    expect(sortRows(spanishSurnames, s => s, 'asc', 'en'))
      .toEqual(['Ñato', 'Nu', 'Núñez', 'Nz'])
    expect(sortRows(spanishSurnames, s => s, 'asc', 'fr'))
      .toEqual(['Ñato', 'Nu', 'Núñez', 'Nz'])
  })

  it('defaults to English rather than to whatever the host is set to', () => {
    // `DEFAULT_COLLATION` is `'en'` and is not exported, so this pins it by BEHAVIOUR: the
    // no-locale call must equal the explicit English one. Passing `undefined` through to
    // `localeCompare` would make this pass on a US laptop and fail on a Spanish container,
    // which is the failure this default exists to remove.
    expect(sortRows(spanishSurnames, s => s, 'asc'))
      .toEqual(sortRows(spanishSurnames, s => s, 'asc', 'en'))
  })

  it('still folds accents and still sorts digits numerically, in every language', () => {
    // The two decisions the locale must not have disturbed. `sensitivity: 'base'` is what
    // keeps `Ángel` beside `Angel` — and it is measurably NOT what decides `ñ`, which is why
    // the block above is a separate concern rather than a wider sensitivity.
    for (const intl of ['en', 'es-MX', 'fr']) {
      expect(sortRows(['Zeb', 'Ángel', 'Angus'], s => s, 'asc', intl))
        .toEqual(['Ángel', 'Angus', 'Zeb'])
      expect(sortRows(['Chapter 10', 'Chapter 2'], s => s, 'asc', intl))
        .toEqual(['Chapter 2', 'Chapter 10'])
    }
  })

  it('keeps the blanks-last rule whatever the collation', () => {
    // Decision 1 is checked before the direction and before the locale, so a locale cannot
    // reach it — asserted because "cannot" is the kind of claim that stops being true.
    expect(sortRows(['Ñato', '', 'Nu'], s => s, 'desc', 'es-MX'))
      .toEqual(['Ñato', 'Nu', ''])
  })
})
