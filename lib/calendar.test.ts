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

/** The bars STARTING on a day, as `[id, lane, span]` — the three things a bar decides. */
const barsOn = (m: CalendarMonth, iso: string) =>
  dayOf(m, iso)?.bars.map(b => [b.entry.id, b.lane, b.span]) ?? null

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

  it('keeps entries in a total, stable order whatever order they arrive in', () => {
    // Earliest start first, then title, then id — so two renders of the same data cannot
    // disagree, which matters for React keys and for a family comparing two screens.
    // `isPremier` deliberately does not sort: it is a badge, and hoisting it would move the
    // entry up and down the day as others came and went.
    const m = buildCalendarMonth(AUGUST, '2026-08-19', [
      entry({ id: 'z', startsOn: '2026-08-19', title: 'Zebra picnic', href: '/gatherings/z' }),
      entry({ id: 'p', startsOn: '2026-08-19', title: 'Anniversary', isPremier: true }),
      entry({ id: 'r', startsOn: '2026-08-15', endsOn: '2026-08-20', title: 'Reunion' }),
    ])
    expect(idsOn(m, '2026-08-19')).toEqual(['r', 'p', 'z'])
    const reversed = buildCalendarMonth(AUGUST, '2026-08-19', [
      entry({ id: 'p', startsOn: '2026-08-19', title: 'Anniversary', isPremier: true }),
      entry({ id: 'r', startsOn: '2026-08-15', endsOn: '2026-08-20', title: 'Reunion' }),
      entry({ id: 'z', startsOn: '2026-08-19', title: 'Zebra picnic', href: '/gatherings/z' }),
    ])
    expect(idsOn(reversed, '2026-08-19')).toEqual(['r', 'p', 'z'])
  })

  it('hands back the entry it was given, untouched', () => {
    // The grid decides which days an entry appears on and nothing else — `href`, `kind` and
    // `isPremier` are the page's to render.
    const original = entry({ id: 'a', startsOn: '2026-08-19', href: '/gatherings/a', isPremier: true })
    const m = buildCalendarMonth(AUGUST, '2026-08-19', [original])
    expect(dayOf(m, '2026-08-19')?.entries[0]).toBe(original)
  })

  it('reads no entries as an empty month rather than a missing one', () => {
    const m = buildCalendarMonth(AUGUST, '2026-08-19', [])
    expect(days(m).every(d => d.entries.length === 0)).toBe(true)
    expect(m.weeks).toHaveLength(6)
  })
})

/**
 * The bars — one continuous run per week rather than one chip per day.
 *
 * ── WHY THESE ARE WORTH RUNNING ─────────────────────────────────────────────────────
 * `entries` is a filter and is obviously right. `packWeek` is a greedy interval
 * partitioning whose output is a LAYOUT, and every way of getting it wrong looks fine in
 * isolation and broken on screen: a lane that moves mid-run draws one bar as two chips at
 * different heights, an unstable tie-break makes two renders of one month disagree, and a
 * run clipped at the wrong end either loses its last day or overflows the grid.
 *
 * The pre-2026-08-22 code had exactly the first of those, because there was no lane at all:
 * each day filtered and sorted independently, so a two-day bar sat in row 0 on Monday and
 * row 1 on Tuesday the moment something else started on Tuesday.
 *
 * August 2026 starts on a SATURDAY, so its weeks are Sun 26 Jul–Sat 1 Aug, then Sun 2–Sat 8,
 * 9–15, 16–22, 23–29, and Sun 30 Aug–Sat 5 Sep. Every index below is hand-counted from that.
 *
 * ── CHECKED BY MUTATION, per AGENTS.md §7b ──────────────────────────────────────────
 * Six mutations of `packWeek`, each run with `npx vitest run lib/calendar.test.ts`; observed
 * results, not expected.
 *
 *   `lane` pinned to 0 — i.e. no packing at all, everything in one row
 *      3 failed — "holds a lane for the whole of a run", the longer-first case and the
 *      full-tie case. Two bars on top of each other in row 0, which is what a stack looks
 *      like when nothing decides the rows.
 *   the longer-first tie-break deleted
 *      1 failed — "puts the longer run above a shorter one starting the same day". Only one,
 *      because the remaining order is still total: this mutation is a worse LAYOUT rather
 *      than an unstable one, and one assertion is the honest amount of cover for that.
 *   `span` reduced by one — the run clipped exclusively at its end
 *      11 failed. Every one-day bar became span 0 and every multi-day bar lost its last day.
 *      The same shape as this file's two existing exclusive-bound mutations.
 *   `continuesBefore`/`continuesAfter` pinned to false
 *      2 failed — the week-boundary case and the month-long case. Both halves of a cut run
 *      would have rendered with rounded ends, reading as two things that each finished.
 *   a bar hung on EVERY covered day instead of the run's first
 *      5 failed, including "covers exactly the days `entries` covers", which is the one that
 *      catches it as arithmetic rather than as a position: total span went to n² for a run
 *      of n days.
 *   the per-week overlap filter widened to `() => true`
 *      0 failed — recorded rather than left looking covered. It really is only a narrowing:
 *      the `fromIndex >= 0` guard after the map is what refuses a span from another week, and
 *      that guard is load-bearing where this filter is an optimisation. No test here
 *      distinguishes the two and none pretends to.
 */
describe('buildCalendarMonth — bars', () => {
  it('draws a two-day span as ONE bar on its first day', () => {
    // THE REPORTED CASE: "Voting — Texas is on the 24th and 25th, make it span both days."
    // 24 August is a Monday, so both days are inside one week and there is one bar.
    const m = buildCalendarMonth(AUGUST, '2026-08-19', [
      entry({ id: 'v', startsOn: '2026-08-24', endsOn: '2026-08-25', title: 'Voting' }),
    ])
    expect(barsOn(m, '2026-08-24')).toEqual([['v', 0, 2]])
    expect(barsOn(m, '2026-08-25')).toEqual([])
    // ...and `entries` still covers both days, because the agenda below `sm` is a per-day
    // list and reads that instead. The two shapes are not alternatives.
    expect(idsOn(m, '2026-08-24')).toEqual(['v'])
    expect(idsOn(m, '2026-08-25')).toEqual(['v'])
  })

  it('gives a one-day entry a bar of span 1', () => {
    const m = buildCalendarMonth(AUGUST, '2026-08-19', [entry({ id: 'a', startsOn: '2026-08-19' })])
    expect(barsOn(m, '2026-08-19')).toEqual([['a', 0, 1]])
    const bar = dayOf(m, '2026-08-19')?.bars[0]
    expect(bar?.continuesBefore).toBe(false)
    expect(bar?.continuesAfter).toBe(false)
  })

  it('cuts a run at the week boundary and flags both halves', () => {
    // 21 August is a Friday, so this reunion is Fri–Sat in one week and Sun–Mon in the next.
    // A single bar cannot cross a row of a table, so it is two — and each says it is cut, so
    // the renderer squares off the edge instead of rounding it into a false ending.
    const m = buildCalendarMonth(AUGUST, '2026-08-19', [
      entry({ id: 'r', startsOn: '2026-08-21', endsOn: '2026-08-24', title: 'Reunion' }),
    ])
    expect(barsOn(m, '2026-08-21')).toEqual([['r', 0, 2]])
    expect(dayOf(m, '2026-08-21')?.bars[0].continuesBefore).toBe(false)
    expect(dayOf(m, '2026-08-21')?.bars[0].continuesAfter).toBe(true)

    expect(barsOn(m, '2026-08-23')).toEqual([['r', 0, 2]])
    expect(dayOf(m, '2026-08-23')?.bars[0].continuesBefore).toBe(true)
    expect(dayOf(m, '2026-08-23')?.bars[0].continuesAfter).toBe(false)

    // And nowhere else: 22 and 24 are covered days, not starting days.
    expect(barsOn(m, '2026-08-22')).toEqual([])
    expect(barsOn(m, '2026-08-24')).toEqual([])
  })

  it('reuses lane 0 for two runs that do not overlap in the same week', () => {
    // The whole reason to pack rather than to stack: every cell of the week has to reserve
    // every lane, so a wasted one is empty space across seven cells.
    const m = buildCalendarMonth(AUGUST, '2026-08-19', [
      entry({ id: 'a', startsOn: '2026-08-24' }),
      entry({ id: 'b', startsOn: '2026-08-26' }),
    ])
    expect(barsOn(m, '2026-08-24')).toEqual([['a', 0, 1]])
    expect(barsOn(m, '2026-08-26')).toEqual([['b', 0, 1]])
  })

  it('holds a lane for the whole of a run, pushing later starts down', () => {
    // THE REGRESSION THIS REPLACED. `r` runs Mon–Wed and must stay in row 0 for all three
    // days; `x` on the Tuesday and `y` on the Wednesday go underneath it. With the lane
    // decided per day, `r` would move down as each of them appeared.
    const m = buildCalendarMonth(AUGUST, '2026-08-19', [
      entry({ id: 'r', startsOn: '2026-08-24', endsOn: '2026-08-26', title: 'Reunion' }),
      entry({ id: 'x', startsOn: '2026-08-25', title: 'Committee' }),
      entry({ id: 'y', startsOn: '2026-08-26', title: 'Deadline' }),
    ])
    expect(barsOn(m, '2026-08-24')).toEqual([['r', 0, 3]])
    expect(barsOn(m, '2026-08-25')).toEqual([['x', 1, 1]])
    // `y` starts after `x` has finished, so lane 1 is free again — lane 0 is not.
    expect(barsOn(m, '2026-08-26')).toEqual([['y', 1, 1]])
  })

  it('puts the longer run above a shorter one starting the same day', () => {
    // The one tie-break that is about appearance: a week-long bar above a one-day chip reads
    // as a background for it, and the reverse reads as an interruption.
    const m = buildCalendarMonth(AUGUST, '2026-08-19', [
      entry({ id: 'short', startsOn: '2026-08-24', title: 'Aaa' }),
      entry({ id: 'long', startsOn: '2026-08-24', endsOn: '2026-08-27', title: 'Zzz' }),
    ])
    expect(barsOn(m, '2026-08-24')).toEqual([['long', 0, 4], ['short', 1, 1]])
  })

  it('breaks a full tie by title and then by id, so two renders agree', () => {
    // A greedy assignment is only stable if its input order is total. Same day, same length:
    // the title decides, and the id is the last resort.
    const m = buildCalendarMonth(AUGUST, '2026-08-19', [
      entry({ id: 'z', startsOn: '2026-08-24', title: 'Bravo' }),
      entry({ id: 'a', startsOn: '2026-08-24', title: 'Alpha' }),
    ])
    expect(barsOn(m, '2026-08-24')).toEqual([['a', 0, 1], ['z', 1, 1]])

    const sameTitle = buildCalendarMonth(AUGUST, '2026-08-19', [
      entry({ id: 'b', startsOn: '2026-08-24', title: 'Same' }),
      entry({ id: 'a', startsOn: '2026-08-24', title: 'Same' }),
    ])
    expect(barsOn(sameTitle, '2026-08-24')).toEqual([['a', 0, 1], ['b', 1, 1]])
  })

  it('spans a whole week as one bar of seven', () => {
    const m = buildCalendarMonth(AUGUST, '2026-08-19', [
      entry({ id: 'w', startsOn: '2026-08-23', endsOn: '2026-08-29', title: 'Voting' }),
    ])
    expect(barsOn(m, '2026-08-23')).toEqual([['w', 0, 7]])
    const bar = dayOf(m, '2026-08-23')?.bars[0]
    expect(bar?.continuesBefore).toBe(false)
    expect(bar?.continuesAfter).toBe(false)
  })

  it('gives a month-long entry one bar per week, clipped to the grid', () => {
    // Six weeks, six bars. The first and last are cut by the GRID rather than by the month,
    // which is why the leading and trailing days carry bars at all.
    const m = buildCalendarMonth(AUGUST, '2026-08-19', [
      entry({ id: 'all', startsOn: '2026-08-01', endsOn: '2026-08-31', title: 'Drive' }),
    ])
    const starts = days(m).filter(d => d.bars.length > 0).map(d => [d.iso, d.bars[0].span])
    expect(starts).toEqual([
      ['2026-08-01', 1],   // week 1: Saturday only
      ['2026-08-02', 7],
      ['2026-08-09', 7],
      ['2026-08-16', 7],
      ['2026-08-23', 7],
      ['2026-08-30', 2],   // week 6: Sun 30 and Mon 31, then September
    ])
    // Cut at the far end of week 1 and the near end of week 6, and nowhere else.
    expect(dayOf(m, '2026-08-01')?.bars[0].continuesAfter).toBe(true)
    expect(dayOf(m, '2026-08-30')?.bars[0].continuesBefore).toBe(true)
    expect(dayOf(m, '2026-08-30')?.bars[0].continuesAfter).toBe(false)
  })

  it('bars the trailing days of the adjacent month too', () => {
    // Same rule as `entries`: the last row of August is on screen, so a reunion starting on
    // 1 September has to be drawn in it. 1 September 2026 is a Tuesday.
    const m = buildCalendarMonth(AUGUST, '2026-08-19', [
      entry({ id: 's', startsOn: '2026-09-01', endsOn: '2026-09-02' }),
    ])
    expect(barsOn(m, '2026-09-01')).toEqual([['s', 0, 2]])
  })

  it('covers exactly the days `entries` covers', () => {
    // The invariant tying the two shapes together: total bar span per entry equals the number
    // of grid days that entry is on. A clipping error at either end breaks this and nothing
    // else in this file would notice.
    const m = buildCalendarMonth(AUGUST, '2026-08-19', [
      entry({ id: 'r', startsOn: '2026-07-28', endsOn: '2026-08-04' }),
      entry({ id: 'v', startsOn: '2026-08-24', endsOn: '2026-08-25' }),
      entry({ id: 'o', startsOn: '2026-08-31' }),
    ])
    for (const id of ['r', 'v', 'o']) {
      const covered = days(m).filter(d => d.entries.some(e => e.id === id)).length
      const barred = days(m)
        .flatMap(d => d.bars)
        .filter(b => b.entry.id === id)
        .reduce((sum, b) => sum + b.span, 0)
      expect(barred).toBe(covered)
    }
  })

  it('hands back the entry it was given, untouched', () => {
    const original = entry({ id: 'a', startsOn: '2026-08-19', isPremier: true })
    const m = buildCalendarMonth(AUGUST, '2026-08-19', [original])
    expect(dayOf(m, '2026-08-19')?.bars[0].entry).toBe(original)
  })

  it('bars nothing in an empty month', () => {
    const m = buildCalendarMonth(AUGUST, '2026-08-19', [])
    expect(days(m).every(d => d.bars.length === 0)).toBe(true)
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

describe('buildCalendarMonth — the week starts where the reader starts it', () => {
  // ── THE GRID AND THE HEADER MUST AGREE, AND ONLY ONE OF THEM MOVING IS THE HAZARD ──
  // `weekdayNames` rotates and so does this. Either one alone produces a calendar whose column
  // NAMES do not describe its column CONTENTS — every date one place out, with nothing on
  // screen looking broken. Asserted here on the grid, and in `lib/date-utils.test.ts` on the
  // header, because a single test of either would pass with the other reverted.

  it('starts an American month on Sunday', () => {
    // 2026-09-01 is a Tuesday, so a Sunday-first September opens on 30 August.
    const month = buildCalendarMonth('2026-09', '2026-09-01', [], 'en-US')
    expect(month.weeks[0][0].iso).toBe('2026-08-30')
    expect(month.weeks[0][2].iso).toBe('2026-09-01')
  })

  it('starts a French month on Monday', () => {
    // The same September, one column across: it opens on 31 August, and the 1st is second.
    const month = buildCalendarMonth('2026-09', '2026-09-01', [], 'fr-FR')
    expect(month.weeks[0][0].iso).toBe('2026-08-31')
    expect(month.weeks[0][1].iso).toBe('2026-09-01')
  })

  it('never builds a grid that starts AFTER the month does', () => {
    // THE OFF-BY-SEVEN THIS FIXES. `weekday - firstWeekday` goes NEGATIVE whenever the 1st
    // falls before the week's first day — a Monday-first month opening on a Sunday needs SIX
    // leading cells, not minus one — so the `+ 7) % 7` is load-bearing rather than defensive.
    // 2026-11-01 is a Sunday, which is exactly that case.
    const month = buildCalendarMonth('2026-11', '2026-11-01', [], 'fr-FR')
    expect(month.weeks[0][0].iso).toBe('2026-10-26')
    expect(month.weeks[0][6].iso).toBe('2026-11-01')
    // And the 1st is genuinely inside the grid rather than before it.
    const all = month.weeks.flat().map(d => d.iso)
    expect(all[0] <= '2026-11-01').toBe(true)
    expect(all).toContain('2026-11-01')
  })

  it('is whole weeks and covers the whole month, in either convention', () => {
    for (const intl of ['en-US', 'fr-FR', 'es-MX']) {
      const month = buildCalendarMonth('2026-11', '2026-11-15', [], intl)
      expect(month.weeks.every(w => w.length === 7)).toBe(true)
      const days = month.weeks.flat().map(d => d.iso)
      expect(days).toContain('2026-11-01')
      expect(days).toContain('2026-11-30')
      // No gaps: consecutive days, start to finish.
      for (let i = 1; i < days.length; i++) {
        const prev = new Date(`${days[i - 1]}T00:00:00Z`).getTime()
        const here = new Date(`${days[i]}T00:00:00Z`).getTime()
        expect(here - prev).toBe(86_400_000)
      }
    }
  })
})
