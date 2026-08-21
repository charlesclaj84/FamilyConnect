/**
 * Comparing two cells, for every sortable table in the app.
 *
 * ── WHY THIS IS A MODULE AND NOT A COMPARATOR AT EACH TABLE ────────────────────────
 * Two tables sorted before this existed and each wrote its own comparator inline:
 * `a.payment_date.localeCompare(b.payment_date)` for a date, `a.amount_cents - b.amount_cents`
 * for money, `.localeCompare` for a name. That works and does not scale — sorting is being
 * added to every table in the product, and twenty hand-written comparators are twenty chances
 * to get one of the three questions below wrong, silently, in a direction nobody checks.
 *
 * It is pure and it lives in `lib/` so it can be TESTED, which is AGENTS.md §7b's rule: dates,
 * money, nulls and accents are exactly the "real edge cases" that paragraph is about, and none
 * of them can be exercised through a component in the runner this repo has.
 *
 * ── THE THREE DECISIONS, WHICH ARE THE WHOLE CONTENT OF THIS FILE ─────────────────
 *
 * 1. BLANKS SORT LAST IN BOTH DIRECTIONS. Not "last ascending, first descending" — last, always.
 *    A member with no chapter, a gathering with no end date, a position nobody holds: those are
 *    ABSENCES, not values, and a column of em-dashes at the top of the table is the least useful
 *    thing the sort could put there. Somebody sorting descending by Position wants the highest
 *    position first, not the ninety people who hold none. This is the one rule a hand-written
 *    comparator gets wrong every time, because `null` compares as 0 against everything and
 *    lands wherever the sort's stability happens to leave it.
 *
 * 2. NUMBERS COMPARE NUMERICALLY, STRINGS LOCALE-AWARE AND ACCENT-INSENSITIVE. `10` before `9`
 *    is the classic string-sort bug and money is the column where it matters most. On the text
 *    side, `localeCompare` with `sensitivity: 'base'` puts "Ángel" beside "Angel" rather than
 *    after "Zeb" — the same normalisation `lib/person-search.ts` applies to searching, and for
 *    the same reason: a family with accented names must not have them exiled to the end of
 *    every list. `numeric: true` also makes "Chapter 2" sort before "Chapter 10".
 *
 * 3. A `YYYY-MM-DD` DATE IS COMPARED AS A STRING, DELIBERATELY. It is chronological in that
 *    form, which is the property `lib/date-utils.ts` relies on throughout, and it means no
 *    `Date` is ever constructed — `new Date('2026-08-01')` is UTC midnight and is the previous
 *    day in any negative offset, which is how a sort silently disagrees with the date printed
 *    in the cell beside it. There is no date BRANCH here at all: dates simply take the string
 *    path, and that is correct rather than lucky.
 *
 * WHAT IT DOES NOT DO is decide which column a table sorts by, or hold the state. That is
 * `useTableSort` in `components/ui/sortable-header.tsx`, which is a client hook and cannot live
 * here.
 */

export type SortDirection = 'asc' | 'desc'

/** What a cell can be reduced to for the purpose of ordering it. */
export type SortValue = string | number | boolean | null | undefined

/**
 * Is this value an absence? `''` counts, because a blank cell and a null cell look identical
 * to the reader and must therefore sort identically — a table where the empty strings cluster
 * separately from the nulls is one where the same visible state has two positions.
 *
 * `0` and `false` are NOT absences. A fund holding $0.00 is a fact.
 */
function isBlank(v: SortValue): boolean {
  return v === null || v === undefined || (typeof v === 'string' && v.trim() === '')
}

/**
 * Order two cells ascending, with blanks last.
 *
 * Returns a number in the `Array.prototype.sort` convention. `direction` is taken here rather
 * than applied by the caller because the blanks rule is NOT symmetric — negating the result of
 * an ascending compare would drag every blank to the top, which is precisely the behaviour
 * decision 1 above exists to prevent.
 */
export function compareValues(
  a: SortValue,
  b: SortValue,
  direction: SortDirection = 'asc',
): number {
  const aBlank = isBlank(a)
  const bBlank = isBlank(b)
  // Before the direction is consulted, so it cannot flip them.
  if (aBlank && bBlank) return 0
  if (aBlank) return 1
  if (bBlank) return -1

  const flip = direction === 'desc' ? -1 : 1

  // Compared ASCENDING first, then flipped once at the bottom. Three branches each doing their
  // own `* flip` is three places for the sign to be wrong, and it is also how the function came
  // to return `-0`: see below.
  let cmp: number

  if (typeof a === 'number' && typeof b === 'number') {
    cmp = a - b
  } else if (typeof a === 'boolean' && typeof b === 'boolean') {
    // True first when ascending. A boolean column is "is it flagged", and the flagged rows are
    // what somebody clicking that heading is looking for.
    cmp = a === b ? 0 : a ? -1 : 1
  } else {
    cmp = String(a).localeCompare(String(b), undefined, {
      sensitivity: 'base',
      numeric: true,
    })
  }

  // THE ZERO IS RETURNED UNFLIPPED, AND THAT IS NOT PEDANTRY. `0 * -1` is `-0`, which every
  // comparison in JavaScript agrees is zero (`-0 === 0`) and `Object.is` does not — so a tie
  // compared descending came back as a value that sorts correctly, prints as `0`, and fails
  // `expect(...).toBe(0)`. It was a test asserting an accent-insensitive tie that found it, and
  // the assertion was right: a comparator whose "equal" has two representations is one whose
  // callers cannot compare its result to anything.
  return cmp === 0 ? 0 : cmp * flip
}

/**
 * Sort a copy of `rows` by one extracted value.
 *
 * A COPY, always: `Array.prototype.sort` mutates, and these arrays are React props or state.
 * Sorting one in place is a mutation of something a parent still holds, which React is entitled
 * not to re-render for — the classic "the table did not change until I clicked something else"
 * bug.
 *
 * STABLE, which the spec has guaranteed since ES2019 and which this relies on rather than
 * works around: rows that tie on the sorted column keep the order they arrived in, so a table
 * already ordered by name and then sorted by chapter reads as chapter-then-name with no second
 * key needed.
 */
export function sortRows<T>(
  rows: readonly T[],
  getValue: (row: T) => SortValue,
  direction: SortDirection = 'asc',
): T[] {
  return [...rows].sort((a, b) => compareValues(getValue(a), getValue(b), direction))
}
