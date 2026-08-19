import { afterEach, describe, expect, it } from 'vitest'
import {
  buildCalendarMonth,
  isValidMonth,
  monthLabel,
  shiftMonth,
  type CalendarEntry,
  type CalendarMonth,
} from './calendar'

/**
 * The month grid.
 *
 * WHY THESE TESTS EXIST: a calendar is the screen where a timezone bug is both most likely
 * and least deniable — it does not corrupt a figure, it draws the family reunion on the wrong
 * day — and the natural implementation of the grid walk (`getDay()`, `.toISOString()` on a
 * locally-built date, `Intl` with no `timeZone`) is correct in UTC and off by a day west of
 * Greenwich. So the arithmetic is done on `YYYY-MM-DD` strings and with `Date.UTC`, and the
 * block at the bottom of this file RUNS IT under a negative offset — which the mutation log
 * below shows is the only thing that catches two of these mutations at all on a UTC runner.
 *
 * `month`, `today` and the entries are all parameters. Nothing here reads a clock
 * (AGENTS.md §7b).
 *
 * ── THE TIMEZONE BLOCK REALLY CHANGES THE TIMEZONE ──────────────────────────────────
 * It reassigns `process.env.TZ`, which Node honours from the next `Date` operation onward.
 * Safe here because vitest's default pool is `forks` — every test FILE gets its own process —
 * and because it is restored in `afterEach` either way.
 *
 * ── THE DATES ARE HAND-CHECKED, NOT DERIVED ─────────────────────────────────────────
 * 1 August 2026 is a SATURDAY and 1 February 2026 is a SUNDAY. Both were worked out from
 * 1 January 2026 being a Thursday, and they are stated here because a test that computes its
 * own expectation from the code under test asserts nothing. August is the interesting month
 * (a Saturday start needs six rows and both adjacent months) and February is the degenerate
 * one (a Sunday start on a 28-day month is four rows and no adjacent days at all).
 *
 * ── CHECKED BY MUTATION, per AGENTS.md §7b ──────────────────────────────────────────
 * A green run is not evidence until it has been seen to fail. Ten mutations of
 * `lib/calendar.ts`, each run with `npx vitest run lib/calendar.test.ts` on a machine in
 * America/Chicago; observed results, not expected:
 *
 *   `shiftMonth` rewritten as `setUTCMonth` on a real date (day 31)
 *      3 failed — "adds a month without touching a day of the month" (from 2026-01 it
 *      answered 2026-03: the 31 January + 1 month = 3 March overflow), "round-trips, so
 *      previous-then-next is where you started", and the neighbours case. This is the
 *      `lib/dues-utils.ts` lesson, reproduced in a month picker.
 *   the span end reduced to `entry.startsOn`, i.e. `ends_on` ignored
 *      5 failed — "puts a multi-day entry on every day it covers", the trailing-days case,
 *      the month-boundary case, the whole-month case and the ordering case.
 *   `span.from <= iso` -> `span.from < iso` (the leading bound made exclusive)
 *      9 failed — every one-day entry vanished from the calendar, which is most of them.
 *   `iso <= span.to` -> `iso < span.to` (the trailing bound made exclusive)
 *      9 failed — the same, from the other end: a one-day entry vanished and a four-day
 *      reunion covered three days.
 *   the leading/trailing cells emptied — `entries: inMonth ? … : []`
 *      4 failed — "the trailing days of the grid carry their entries", "the leading days
 *      carry theirs too", the month-boundary case and the whole-month case. A reunion
 *      starting on 1 September was invisible in the last row of August: the row on screen.
 *   `firstWeekday` read with `getDay()` instead of `getUTCDay()`
 *      6 failed here — but under `TZ=UTC`, which is what CI runs, EXACTLY TWO fail: "builds
 *      the same grid it builds in UTC" and "starts August on the Saturday, not the Friday",
 *      both inside the negative-offset block. Without that block this mutation ships green
 *      from any CI runner, with the entire grid shifted one column for everybody west of
 *      Greenwich.
 *   `isoOf` rewritten as `date.toISOString().slice(0, 10)`
 *      0 failed — recorded rather than left looking covered, per AGENTS.md §7. It really is
 *      equivalent, because the instant is UTC midnight by construction; it is not used
 *      because it says nothing about which zone it means and is one careless
 *      locally-constructed Date away from being wrong. No test here distinguishes the two
 *      and none pretends to.
 *   `cellCount` fixed at 42
 *      1 failed — "needs exactly four rows for February 2026"; the grid grew a blank week
 *      and a whole week of March.
 *   the `MONTH_PATTERN` month range relaxed to `\d{2}`
 *      4 failed — "refuses a month that does not exist" plus all three throw cases, where
 *      2026-13 was accepted and rendered as January 2027.
 *   `timeZone: 'UTC'` deleted from `monthLabel`'s formatter — run under `TZ=UTC`, i.e. CI
 *      2 failed — "labels the month the grid is actually showing" and "builds the same grid
 *      it builds in UTC", both inside the negative-offset block.
 *
 *      THIS IS THE MUTATION THAT WAS MISSING FROM THIS LOG, AND IT USED TO PASS. The
 *      formatter was a module-level `const`, so it resolved its zone at IMPORT time and kept
 *      it for life — measured: a formatter built under America/Chicago still reports
 *      America/Chicago after `process.env.TZ` is reassigned, and only a newly-built one picks
 *      up the new zone. The block below sets `TZ` inside the test, which is too late for a
 *      formatter that already exists, so on a UTC runner the mutant answered "August 2026"
 *      anyway and shipped green; it failed only on the author's laptop. `monthLabel` now
 *      builds its formatter per call, which is the whole reason this line can be written.
 *      Same asymmetry as the `getDay()` mutation two entries above, except that one was
 *      already honest about it and this one had no entry at all.
 */

/** 1 August 2026 is a Saturday, so the grid runs Sun 26 July → Sat 5 September. */
const AUGUST = '2026-08'

const entry = (over: Partial<CalendarEntry> & { id: string; startsOn: string }): CalendarEntry => ({
  title: 'Something',
  endsOn: null,
  kind: 'gathering',
  href: `/gatherings/${over.id}`,
  ...over,
})

/** Every day of the grid, flattened — the shape most assertions want. */
const days = (m: CalendarMonth) => m.weeks.flat()
const dayOf = (m: CalendarMonth, iso: string) => days(m).find(d => d.iso === iso)
const idsOn = (m: CalendarMonth, iso: string) => dayOf(m, iso)?.entries.map(e => e.id) ?? null

describe('isValidMonth', () => {
  it('accepts a padded YYYY-MM', () => {
    expect(isValidMonth('2026-08')).toBe(true)
    expect(isValidMonth('2026-01')).toBe(true)
    expect(isValidMonth('2026-12')).toBe(true)
  })

  it('refuses a month that does not exist', () => {
    // `Date.UTC(2026, 12, 1)` would answer January 2027 without complaint, so the URL would
    // say one thing and the grid would show another.
    expect(isValidMonth('2026-13')).toBe(false)
    expect(isValidMonth('2026-00')).toBe(false)
  })

  it('refuses anything else at all', () => {
    expect(isValidMonth('2026-8')).toBe(false)
    expect(isValidMonth('2026-08-01')).toBe(false)
    expect(isValidMonth('26-08')).toBe(false)
    expect(isValidMonth('')).toBe(false)
    expect(isValidMonth(null)).toBe(false)
    expect(isValidMonth(202608)).toBe(false)
    expect(isValidMonth(undefined)).toBe(false)
  })
})

describe('shiftMonth', () => {
  it('adds a month without touching a day of the month', () => {
    // THE OVERFLOW TRAP. On a real date, 31 January plus one month is "31 February", which
    // resolves to 3 March — so a Date-based implementation makes "next month" from January
    // skip February entirely. There is no day here for a short month to overflow.
    expect(shiftMonth('2026-01', 1)).toBe('2026-02')
    expect(shiftMonth('2026-01', 1)).not.toBe('2026-03')
    expect(shiftMonth('2026-03', -1)).toBe('2026-02')
    expect(shiftMonth('2026-08', 1)).toBe('2026-09')
    expect(shiftMonth('2026-08', 0)).toBe('2026-08')
  })

  it('carries the year in both directions', () => {
    expect(shiftMonth('2026-12', 1)).toBe('2027-01')
    expect(shiftMonth('2026-01', -1)).toBe('2025-12')
    expect(shiftMonth('2026-08', 12)).toBe('2027-08')
    expect(shiftMonth('2026-08', -12)).toBe('2025-08')
    expect(shiftMonth('2026-08', -20)).toBe('2024-12')
    expect(shiftMonth('2026-08', 29)).toBe('2029-01')
  })

  it('round-trips, so previous-then-next is where you started', () => {
    for (const month of ['2026-01', '2026-02', '2026-12', '2027-07']) {
      expect(shiftMonth(shiftMonth(month, -1), 1)).toBe(month)
      expect(shiftMonth(shiftMonth(month, 1), -1)).toBe(month)
    }
  })

  it('throws rather than answering something for a month it cannot read', () => {
    // Returning the input makes the previous-month link a link to the page you are on;
    // returning "NaN-NaN" renders an href that 404s. Every caller has either just built the
    // string or gated it with `isValidMonth`, so this is a bug and should be loud.
    expect(() => shiftMonth('2026-13', 1)).toThrow(TypeError)
    expect(() => shiftMonth('August', 1)).toThrow(TypeError)
    expect(() => shiftMonth('2026-08', 1.5)).toThrow(TypeError)
  })
})

describe('monthLabel', () => {
  it('names the month being shown', () => {
    expect(monthLabel('2026-08')).toBe('August 2026')
    expect(monthLabel('2026-01')).toBe('January 2026')
    expect(monthLabel('2026-12')).toBe('December 2026')
  })

  it('throws on a month it cannot read', () => {
    expect(() => monthLabel('2026-13')).toThrow(TypeError)
  })
})

describe('the grid', () => {
  const august = buildCalendarMonth(AUGUST, '2026-08-19', [])

  it('is whole weeks, Sunday first', () => {
    for (const week of august.weeks) expect(week).toHaveLength(7)
    expect(august.weeks[0][0].iso).toBe('2026-07-26')      // the Sunday before 1 August
    expect(days(august)).toHaveLength(august.weeks.length * 7)
  })

  it('runs from the Sunday before the 1st to the Saturday after the last day', () => {
    // 1 August 2026 is a Saturday and August has 31 days: six leading blanks plus 31 is 37
    // cells, which is six rows, so the grid trails five days into September.
    expect(august.weeks).toHaveLength(6)
    expect(days(august)[0].iso).toBe('2026-07-26')
    expect(days(august)[41].iso).toBe('2026-09-05')
  })

  it('marks the adjacent months’ days as out of month, and its own as in', () => {
    expect(dayOf(august, '2026-07-31')?.inMonth).toBe(false)
    expect(dayOf(august, '2026-08-01')?.inMonth).toBe(true)
    expect(dayOf(august, '2026-08-31')?.inMonth).toBe(true)
    expect(dayOf(august, '2026-09-01')?.inMonth).toBe(false)
    expect(days(august).filter(d => d.inMonth)).toHaveLength(31)
  })

  it('numbers each day as its own month numbers it', () => {
    expect(dayOf(august, '2026-07-26')?.dayOfMonth).toBe(26)
    expect(dayOf(august, '2026-08-01')?.dayOfMonth).toBe(1)
    expect(dayOf(august, '2026-09-05')?.dayOfMonth).toBe(5)
  })

  it('needs exactly four rows for February 2026, and no adjacent days', () => {
    // 1 February 2026 is a Sunday and February has 28 days. A grid hard-coded to six rows
    // would put a blank week and a whole week of March under it.
    const february = buildCalendarMonth('2026-02', '2026-02-14', [])
    expect(february.weeks).toHaveLength(4)
    expect(days(february)[0].iso).toBe('2026-02-01')
    expect(days(february)[27].iso).toBe('2026-02-28')
    expect(days(february).every(d => d.inMonth)).toBe(true)
  })

  it('has a 29th in a leap February', () => {
    const leap = buildCalendarMonth('2028-02', '2028-02-01', [])
    expect(dayOf(leap, '2028-02-29')?.inMonth).toBe(true)
    expect(days(leap).filter(d => d.inMonth)).toHaveLength(29)
  })

  it('names the month, its label and its neighbours', () => {
    expect(august.month).toBe('2026-08')
    expect(august.label).toBe('August 2026')
    expect(august.prevMonth).toBe('2026-07')
    expect(august.nextMonth).toBe('2026-09')
  })

  it('throws on a month it cannot read rather than rendering NaN', () => {
    expect(() => buildCalendarMonth('2026-13', '2026-08-19', [])).toThrow(TypeError)
  })
})

describe('today', () => {
  it('marks exactly one day when today is in the month', () => {
    const m = buildCalendarMonth(AUGUST, '2026-08-19', [])
    const marked = days(m).filter(d => d.isToday)
    expect(marked).toHaveLength(1)
    expect(marked[0].iso).toBe('2026-08-19')
  })

  it('marks a day of an adjacent month that the grid happens to show', () => {
    // The last row of August includes 1 September. If that is today, it is today.
    const m = buildCalendarMonth(AUGUST, '2026-09-01', [])
    expect(dayOf(m, '2026-09-01')?.isToday).toBe(true)
    expect(dayOf(m, '2026-09-01')?.inMonth).toBe(false)
  })

  it('marks nothing when today is elsewhere, or unreadable', () => {
    // A highlight is the one thing on this page that can degrade to absent without
    // misinforming anybody, which is why it needs no validation and throws nothing.
    expect(days(buildCalendarMonth(AUGUST, '2027-03-04', [])).some(d => d.isToday)).toBe(false)
    expect(days(buildCalendarMonth(AUGUST, 'today', [])).some(d => d.isToday)).toBe(false)
    expect(days(buildCalendarMonth(AUGUST, '', [])).some(d => d.isToday)).toBe(false)
  })
})

describe('entries', () => {
  it('puts a one-day entry on its own day and nowhere else', () => {
    const m = buildCalendarMonth(AUGUST, '2026-08-19', [entry({ id: 'a', startsOn: '2026-08-19' })])
    expect(idsOn(m, '2026-08-19')).toEqual(['a'])
    expect(idsOn(m, '2026-08-18')).toEqual([])
    expect(idsOn(m, '2026-08-20')).toEqual([])
    expect(days(m).filter(d => d.entries.length > 0)).toHaveLength(1)
  })

  it('puts a multi-day entry on every day it covers', () => {
    // The whole point of `ends_on`: a family looking at the 17th wants to see that the
    // reunion is ON, not to have to notice that something started on the 15th.
    const reunion = entry({ id: 'r', startsOn: '2026-08-15', endsOn: '2026-08-18', title: 'Reunion' })
    const m = buildCalendarMonth(AUGUST, '2026-08-19', [reunion])
    for (const iso of ['2026-08-15', '2026-08-16', '2026-08-17', '2026-08-18']) {
      expect(idsOn(m, iso)).toEqual(['r'])
    }
    expect(idsOn(m, '2026-08-14')).toEqual([])
    expect(idsOn(m, '2026-08-19')).toEqual([])
    expect(days(m).filter(d => d.entries.length > 0)).toHaveLength(4)
  })

  it('the trailing days of the grid carry their entries', () => {
    // A reunion starting on 1 September is visible in the last row of August, because that
    // row is on screen and the family is looking at it.
    const m = buildCalendarMonth(AUGUST, '2026-08-19', [
      entry({ id: 'sep', startsOn: '2026-09-01', endsOn: '2026-09-03' }),
    ])
    expect(dayOf(m, '2026-09-01')?.inMonth).toBe(false)
    expect(idsOn(m, '2026-09-01')).toEqual(['sep'])
    expect(idsOn(m, '2026-09-03')).toEqual(['sep'])
    // ...and 4 September is beyond it, though the cell exists.
    expect(idsOn(m, '2026-09-04')).toEqual([])
  })

  it('the leading days carry theirs too', () => {
    const m = buildCalendarMonth(AUGUST, '2026-08-19', [
      entry({ id: 'jul', startsOn: '2026-07-28' }),
    ])
    expect(dayOf(m, '2026-07-28')?.inMonth).toBe(false)
    expect(idsOn(m, '2026-07-28')).toEqual(['jul'])
  })

  it('carries an entry that spans the month boundary across both sides of it', () => {
    const m = buildCalendarMonth(AUGUST, '2026-08-19', [
      entry({ id: 'span', startsOn: '2026-07-30', endsOn: '2026-08-02' }),
    ])
    expect(days(m).filter(d => d.entries.length > 0).map(d => d.iso)).toEqual([
      '2026-07-30', '2026-07-31', '2026-08-01', '2026-08-02',
    ])
  })

  it('shows an entry that covers the whole month on every one of its days', () => {
    const m = buildCalendarMonth(AUGUST, '2026-08-19', [
      entry({ id: 'all', startsOn: '2026-07-01', endsOn: '2026-09-30' }),
    ])
    expect(days(m).every(d => d.entries.length === 1)).toBe(true)
  })

  it('reads an end before the start as a single day', () => {
    // `gatherings_dates_ordered` refuses the row, so this is about one from somewhere else.
    // Taking the later of the two never hides an entry from the day it is on.
    const m = buildCalendarMonth(AUGUST, '2026-08-19', [
      entry({ id: 'backwards', startsOn: '2026-08-19', endsOn: '2026-08-01' }),
    ])
    expect(idsOn(m, '2026-08-19')).toEqual(['backwards'])
    expect(idsOn(m, '2026-08-01')).toEqual([])
  })

  it('leaves an entry outside the grid off it entirely', () => {
    const m = buildCalendarMonth(AUGUST, '2026-08-19', [
      entry({ id: 'far', startsOn: '2027-01-01' }),
      entry({ id: 'old', startsOn: '2025-01-01', endsOn: '2025-01-02' }),
    ])
    expect(days(m).every(d => d.entries.length === 0)).toBe(true)
  })

  it('keeps gatherings and events side by side in a total, stable order', () => {
    // Earliest start first, then title, then id — so two renders of the same data cannot
    // disagree, which matters for React keys and for a family comparing two screens.
    // `isPremier` deliberately does not sort: it is a badge, and hoisting it would move the
    // entry up and down the day as others came and went.
    const m = buildCalendarMonth(AUGUST, '2026-08-19', [
      entry({ id: 'z', startsOn: '2026-08-19', title: 'Zebra picnic', kind: 'event', href: '/events/z' }),
      entry({ id: 'p', startsOn: '2026-08-19', title: 'Anniversary', isPremier: true }),
      entry({ id: 'r', startsOn: '2026-08-15', endsOn: '2026-08-20', title: 'Reunion' }),
    ])
    expect(idsOn(m, '2026-08-19')).toEqual(['r', 'p', 'z'])
    const reversed = buildCalendarMonth(AUGUST, '2026-08-19', [
      entry({ id: 'p', startsOn: '2026-08-19', title: 'Anniversary', isPremier: true }),
      entry({ id: 'r', startsOn: '2026-08-15', endsOn: '2026-08-20', title: 'Reunion' }),
      entry({ id: 'z', startsOn: '2026-08-19', title: 'Zebra picnic', kind: 'event', href: '/events/z' }),
    ])
    expect(idsOn(reversed, '2026-08-19')).toEqual(['r', 'p', 'z'])
  })

  it('hands back the entry it was given, untouched', () => {
    // The grid decides which days an entry appears on and nothing else — `href`, `kind` and
    // `isPremier` are the page's to render.
    const original = entry({ id: 'a', startsOn: '2026-08-19', kind: 'event', href: '/events/a', isPremier: true })
    const m = buildCalendarMonth(AUGUST, '2026-08-19', [original])
    expect(dayOf(m, '2026-08-19')?.entries[0]).toBe(original)
  })

  it('reads no entries as an empty month rather than a missing one', () => {
    const m = buildCalendarMonth(AUGUST, '2026-08-19', [])
    expect(days(m).every(d => d.entries.length === 0)).toBe(true)
    expect(m.weeks).toHaveLength(6)
  })
})

describe('under a negative UTC offset', () => {
  const original = process.env.TZ
  // `process.env.TZ = undefined` assigns the STRING "undefined", which is not a zone and not
  // a restore, so an absent original is deleted rather than assigned.
  afterEach(() => {
    if (original === undefined) delete process.env.TZ
    else process.env.TZ = original
  })

  it('builds the same grid it builds in UTC', () => {
    // THE BUG THIS FILE EXISTS TO PREVENT. `new Date('2026-08-01')` is UTC midnight, which in
    // Pacific time is the evening of 31 July — so `.getDay()` and `.getDate()` on it answer
    // for the wrong day and the entire grid slides by one column. Every function here is
    // either pure string comparison or `Date.UTC` + `getUTC*`, so the two runs are identical.
    process.env.TZ = 'UTC'
    const utc = buildCalendarMonth(AUGUST, '2026-08-01', [
      entry({ id: 'r', startsOn: '2026-08-01', endsOn: '2026-08-03', title: 'Reunion' }),
    ])
    process.env.TZ = 'America/Los_Angeles'
    const pacific = buildCalendarMonth(AUGUST, '2026-08-01', [
      entry({ id: 'r', startsOn: '2026-08-01', endsOn: '2026-08-03', title: 'Reunion' }),
    ])
    expect(pacific).toEqual(utc)
  })

  it('starts August on the Saturday, not the Friday', () => {
    process.env.TZ = 'America/Los_Angeles'
    const m = buildCalendarMonth(AUGUST, '2026-08-01', [])
    // Sun 26 July is the first cell and 1 August is the seventh — a Saturday.
    expect(days(m)[0].iso).toBe('2026-07-26')
    expect(days(m)[6].iso).toBe('2026-08-01')
    expect(dayOf(m, '2026-08-01')?.dayOfMonth).toBe(1)
    expect(dayOf(m, '2026-08-01')?.isToday).toBe(true)
  })

  it('labels the month the grid is actually showing', () => {
    // Without `timeZone: 'UTC'` on the formatter, the instant August begins formats as 31
    // July here and the heading over an August grid reads "July 2026".
    process.env.TZ = 'America/Los_Angeles'
    expect(monthLabel('2026-08')).toBe('August 2026')
    expect(monthLabel('2026-01')).toBe('January 2026')
  })

  it('puts an entry on the 1st on the 1st', () => {
    process.env.TZ = 'America/Los_Angeles'
    const m = buildCalendarMonth(AUGUST, '2026-08-15', [entry({ id: 'a', startsOn: '2026-08-01' })])
    expect(idsOn(m, '2026-08-01')).toEqual(['a'])
    expect(idsOn(m, '2026-07-31')).toEqual([])
  })
})
