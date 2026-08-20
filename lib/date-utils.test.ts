import { describe, expect, it } from 'vitest'
import { latestDate } from '@/lib/date-utils'

/**
 * `latestDate`, under `npm test` — which is a `verify.yml` step, so this gates a pull request.
 *
 * WHY IT IS TESTED AT ALL: it is the `min` of every end-date input in the app, and the failure
 * mode is silent in the direction that matters. A `min` that is a day too LATE forbids a legal
 * day — a treasurer who cannot set an end date of the start date itself, on a one-day due — and
 * nothing reports it, because a greyed-out day looks exactly like a day the product does not
 * allow. A `min` that is too early merely fails to help.
 *
 * That is also why the boundary case (start and end the SAME day) has its own test rather than
 * being folded into the ordering one: it is the case a naive `>` would break and the one a
 * one-day gathering actually uses.
 *
 * CHECKED BY MUTATION, as AGENTS.md §7b requires — a green run is not evidence until it has
 * been seen to fail. Five mutations, and the counts below are the MEASURED ones (2026-08-20)
 * rather than the ones first written down, which were optimistic on every line:
 *
 *   * `b > a` → `b < a` (returns the earliest)                    3 failed
 *   * the `d !== ''` filter removed                               1 failed
 *   * `undefined` for empty → `''`                                1 failed
 *   * `b > a` → `b >= a`                                          0 failed — survived
 *   * `typeof d === 'string'` dropped from the guard              0 failed — survived
 *
 * BOTH SURVIVORS ARE KEPT ON THE LIST, because they are the useful half and neither is a gap
 * worth writing a test for:
 *
 *   * `>` vs `>=` differ only in WHICH of two EQUAL strings a reducer returns, and two equal
 *     strings are indistinguishable to every caller. No input separates them. It would start
 *     to matter the moment this returned an index or an object, which is a reason not to change
 *     what it returns.
 *   * the `typeof` guard is a TYPE-level guarantee. The signature admits only strings, so a
 *     non-string can reach it solely from untyped JavaScript, and a test would have to cast
 *     past the very check it was testing. Keeping the guard is cheap insurance for a value
 *     arriving from a `FormData` or a JSON payload one day; proving it fires is not something
 *     this suite can honestly do.
 */
describe('latestDate', () => {
  it('returns the later of two dates, whichever order they arrive in', () => {
    expect(latestDate('2026-01-01', '2026-12-31')).toBe('2026-12-31')
    expect(latestDate('2026-12-31', '2026-01-01')).toBe('2026-12-31')
  })

  it('returns the day itself when both floors are the same', () => {
    // The one-day gathering, and the case a `>` on a wrong branch would break: the end date
    // must still be selectable ON the start date.
    expect(latestDate('2026-08-01', '2026-08-01')).toBe('2026-08-01')
  })

  it('compares as strings, which is chronological for YYYY-MM-DD', () => {
    // The point of the format, and the reason this function never touches `Date`: no timezone
    // can shift these by a day. Deliberately spanning a month and a year boundary, where a
    // numeric-ish comparison of the day part alone would answer the earlier date.
    expect(latestDate('2026-09-01', '2026-08-31')).toBe('2026-09-01')
    expect(latestDate('2027-01-01', '2026-12-31')).toBe('2027-01-01')
    expect(latestDate('2026-10-02', '2026-10-10')).toBe('2026-10-10')
  })

  it('ignores null, undefined and the empty string', () => {
    // An unfilled `<input type="date">` reads `''`, which is the ordinary case rather than an
    // edge one: the end-date picker is rendered before the start date has been chosen. Treating
    // it as a floor would make `''` the answer and forbid every day.
    expect(latestDate(null, '2026-05-05')).toBe('2026-05-05')
    expect(latestDate(undefined, '2026-05-05')).toBe('2026-05-05')
    expect(latestDate('', '2026-05-05')).toBe('2026-05-05')
    expect(latestDate('2026-05-05', '')).toBe('2026-05-05')
  })

  it('answers undefined when there is no floor at all', () => {
    // NOT `''`. React omits an attribute whose value is `undefined` and renders `min=""` for an
    // empty string, and browsers have opinions about the latter — so "no floor" has to be the
    // absent value rather than a blank one.
    expect(latestDate()).toBeUndefined()
    expect(latestDate(null, undefined, '')).toBeUndefined()
  })

  it('takes any number of floors', () => {
    // Two is what the dues schedule form passes (the start date, and the floor that stops an
    // existing due being retired behind its payments). Nothing depends on it being two.
    expect(latestDate('2026-01-01', '2026-06-01', '2026-03-01')).toBe('2026-06-01')
  })
})
