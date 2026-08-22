import { describe, expect, it } from 'vitest'
import { isMinorOn, minorCutoff } from '@/lib/age-utils'

/**
 * AGENTS.md §7b: the arithmetic half, under `npm test`. `isMinorOn` has been exercised through
 * `buildMembershipReport` since it grew a `today` parameter (see lib/membership-report.test.ts,
 * "the eighteenth birthday itself is an adult"); what is new here is `minorCutoff`, and it is
 * tested directly because it has a SECOND consumer that no test could otherwise reach.
 *
 * ── WHY THE CUTOFF IS WORTH ITS OWN TESTS ───────────────────────────────────────────
 * `lib/chapter-propagation.ts` asks the DATABASE the same question — `.gt('date_of_birth',
 * minorCutoff(todayLocal()))` — so this string is a SQL predicate as well as a comparison in
 * TypeScript. Nothing in `npm run test:rls` can check the figure it produces: that fixture
 * seeds a handful of people and its birthdays are chosen to be months from any boundary, on
 * purpose. So the boundary is checked here, and the two expressions are checked against each
 * other rather than each being checked against a hand-written date.
 *
 * ── SEEN TO FAIL, which §7b says is the only thing that makes a green run evidence ──
 * Each of these was checked by mutating lib/age-utils.ts and re-running:
 *
 *   `- 18` -> `- 19` in minorCutoff              'the cutoff is the eighteenth birthday'
 *   `today.slice(4)` -> '-01-01'                 'a leap-day birthday' and 'month and day'
 *   `>` -> `>=` in isMinorOn                     'the eighteenth birthday itself'
 *   drop the `!dob` guard                        'an unrecorded birthday'
 */

describe('minorCutoff', () => {
  it('is the eighteenth birthday: today, eighteen years back', () => {
    expect(minorCutoff('2026-08-22')).toBe('2008-08-22')
  })

  it('keeps the month and day, so it is not a January approximation', () => {
    // The mutation that matters, because it is invisible in the common case: a cutoff of
    // `${year - 18}-01-01` is right on 1 January and wrong by up to a year on every other
    // day — and wrong in the direction of moving somebody who is already an adult.
    expect(minorCutoff('2026-01-31')).toBe('2008-01-31')
    expect(minorCutoff('2026-12-31')).toBe('2008-12-31')
  })

  it('spans a leap day without arithmetic on months', () => {
    // 2008 was a leap year and 2026 is not, so `setUTCMonth`-style arithmetic would have to
    // decide what "29 February eighteen years ago" is. Splicing the year cannot: the string
    // is a valid date because the day-of-month came from a real date in the first place.
    expect(minorCutoff('2026-02-28')).toBe('2008-02-28')
    expect(minorCutoff('2024-02-29')).toBe('2006-02-29')
  })
})

describe('minorCutoff and isMinorOn are one rule', () => {
  const TODAY = '2026-08-22'

  it('agree on the eighteenth birthday itself, which is an adult', () => {
    const cutoff = minorCutoff(TODAY)
    expect(cutoff).toBe('2008-08-22')
    // Born ON the cutoff: eighteen today, so not a minor — and `> cutoff` is false, which is
    // what the SQL filter in lib/chapter-propagation.ts evaluates for the same row.
    expect(isMinorOn(cutoff, TODAY)).toBe(false)
    expect(isMinorOn('2008-08-23', TODAY)).toBe(true)
    expect(isMinorOn('2008-08-21', TODAY)).toBe(false)
  })

  it('treats an unrecorded birthday as not a minor, in both expressions', () => {
    // The half that takes no code in SQL: `NULL > anything` is never true, exactly as this is
    // false. It is the honest direction — "under 18" is something a family has recorded about
    // a person, not something to assume about a blank field — and it is why the chapter
    // propagation leaves a child with no birthday on file where they are.
    expect(isMinorOn(null, TODAY)).toBe(false)
    expect(isMinorOn(undefined, TODAY)).toBe(false)
    expect(isMinorOn('', TODAY)).toBe(false)
  })

  it('reads a timestamp as its date, so a stored `date_of_birth` with time survives', () => {
    // `date_of_birth` is a bare DATE in this schema, but the column has been selected into
    // JSON and back by three layers by the time it reaches here. A value that arrives as
    // `2008-08-23T00:00:00Z` must not compare as though the `T` were part of the day.
    expect(isMinorOn('2008-08-23T00:00:00.000Z', TODAY)).toBe(true)
    expect(isMinorOn('2008-08-21T00:00:00.000Z', TODAY)).toBe(false)
  })
})
