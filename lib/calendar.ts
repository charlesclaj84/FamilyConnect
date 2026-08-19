/**
 * The month grid behind `/calendar`, and the month arithmetic every link on it depends on.
 *
 * ── WHY THIS IS A PURE MODULE ───────────────────────────────────────────────────────
 * AGENTS.md §7b, and one thing sharper than the general rule: EVERY DATE BUG IN THIS
 * PRODUCT HAS BEEN A TIMEZONE BUG, and a calendar is the screen where one is both most
 * likely and least deniable. `today` is a parameter, the month is a parameter, the entries
 * are a parameter; nothing here reads a clock, so every case below is runnable —
 * `lib/calendar.test.ts`.
 *
 * ── THE TWO TRAPS THIS MODULE IS BUILT AROUND ───────────────────────────────────────
 *
 * 1. `new Date('2026-08-01')` IS UTC MIDNIGHT. In any negative offset it is the evening of
 *    31 July, so `.getMonth()` says July, `.getDate()` says 31, and a reunion on the 1st is
 *    drawn on the last day of the previous month for half the country. There is no `new
 *    Date(string)` anywhere in this file: dates are `YYYY-MM-DD` STRINGS compared
 *    lexicographically (which is exact, and needs no Date at all), and where a real
 *    calendar walk is unavoidable it is `Date.UTC` with integer parts and `getUTC*` reads.
 *
 * 2. ADDING A MONTH OVERFLOWS. `setUTCMonth` on 31 January gives "31 February", which
 *    resolves to 3 March — the lesson `addCadenceSteps` in `lib/dues-utils.ts` carries a
 *    paragraph about. `shiftMonth` therefore works on (year, month) INTEGERS and never
 *    touches a day of the month at all, so there is no day for a short month to overflow.
 *    Adding DAYS through `Date.UTC` is a different matter and is safe: day 0 is the last day
 *    of the previous month and day 32 is the 1st of the next, both exactly and by
 *    definition, which is what the grid walk below relies on.
 */

/** One thing on the calendar: a gathering, or an event. */
export interface CalendarEntry {
  id: string
  title: string
  startsOn: string            // YYYY-MM-DD
  endsOn: string | null
  kind: 'gathering' | 'event'
  href: string
  isPremier?: boolean
}

export interface CalendarDay {
  iso: string                 // YYYY-MM-DD
  dayOfMonth: number
  /** false for the leading/trailing days of the adjacent months. */
  inMonth: boolean
  isToday: boolean
  /** Every entry whose span covers this day — see `buildCalendarMonth`. */
  entries: readonly CalendarEntry[]
}

export interface CalendarMonth {
  /** YYYY-MM of the month being shown. */
  month: string
  label: string               // "August 2026"
  /** Whole weeks, each length 7, Sunday first. */
  weeks: readonly (readonly CalendarDay[])[]
  prevMonth: string           // YYYY-MM
  nextMonth: string
}

const MONTH_PATTERN = /^\d{4}-(0[1-9]|1[0-2])$/

/**
 * A `YYYY-MM` this module will accept — checked before the database is touched, because
 * `month` arrives in the query string and the page's whole addressability rests on it.
 *
 * The pattern pins the MONTH RANGE as well as the shape (`0[1-9]|1[0-2]`), so "2026-13" and
 * "2026-00" are refused here rather than becoming a month index nobody meant. A plain
 * `\d{2}` would have let both through and `Date.UTC(2026, 12, 1)` would have quietly
 * answered January 2027 — a URL saying one thing and a grid showing another.
 */
export function isValidMonth(value: unknown): value is string {
  return typeof value === 'string' && MONTH_PATTERN.test(value)
}

/** (year, month-number) from a validated `YYYY-MM`. The only place this string is split. */
function monthParts(month: string): { year: number; monthNumber: number } {
  const [year, monthNumber] = month.split('-').map(Number)
  return { year, monthNumber }
}

function formatMonth(year: number, monthNumber: number): string {
  return `${String(year).padStart(4, '0')}-${String(monthNumber).padStart(2, '0')}`
}

/**
 * The month `delta` months away — on (year, month) integers, never on a day.
 *
 * THE ABSENCE OF A DAY-OF-MONTH IS THE WHOLE DESIGN. `new Date(2026, 0, 31)` plus one month
 * is 3 March, so a `shiftMonth` built on a Date would make "next month" from January skip
 * February in exactly the months a member is most likely to be looking at one. Working in
 * absolute months — `year * 12 + index` — there is no day present to overflow, and December
 * to January carries the year by division rather than by a special case.
 *
 * IT THROWS ON A MONTH IT CANNOT READ rather than returning something. Every caller has
 * either just built the string with `formatMonth` or gated it with `isValidMonth`, so an
 * unreadable one is a bug — and the alternatives are worse than loud: returning the input
 * makes the previous-month link a link to the page you are on, and returning "NaN-NaN"
 * renders an `<a href>` that 404s. A calendar that quietly shows the wrong month teaches a
 * member that the URL is not read.
 */
export function shiftMonth(month: string, delta: number): string {
  if (!isValidMonth(month)) throw new TypeError(`shiftMonth: not a YYYY-MM month: ${String(month)}`)
  if (!Number.isInteger(delta)) throw new TypeError(`shiftMonth: delta must be a whole number of months: ${String(delta)}`)

  const { year, monthNumber } = monthParts(month)
  const absolute = year * 12 + (monthNumber - 1) + delta
  // `Math.floor`, not a truncating divide: it is what carries a negative absolute month
  // (year 0 and earlier) into the previous year instead of toward zero. Unreachable from
  // any real family and one character to get right.
  const shiftedYear = Math.floor(absolute / 12)
  return formatMonth(shiftedYear, absolute - shiftedYear * 12 + 1)
}

/**
 * "August 2026", for the heading and for the previous/next links' accessible names.
 *
 * ── `timeZone: 'UTC'` IS LOAD-BEARING, NOT BOILERPLATE ──────────────────────────────
 * `Date.UTC(2026, 7, 1)` is the instant this month begins at UTC. Formatted in the RUNTIME's
 * zone — which is what `Intl` does by default — that instant is 31 July in any negative
 * offset, so the heading over an August grid would read "July 2026" for half the country.
 * Pinning the formatter to UTC is what makes the label agree with the grid it sits above.
 *
 * Intl rather than a month-name table because `lib/date-utils.ts` is the app's only date
 * formatter and does not export its own table; restating twelve month names here to avoid
 * one `Intl` call is the second copy that eventually disagrees with the first.
 *
 * ── AND IT IS BUILT PER CALL, WHICH IS THE ONLY WAY THE TEST CAN SEE IT ─────────────
 * This was a module-level `const`, and that made the claim above untestable: an
 * `Intl.DateTimeFormat` resolves its zone when it is CONSTRUCTED and keeps it for life, so a
 * formatter built at import time never notices `process.env.TZ` changing afterwards
 * (measured: a formatter built under America/Chicago still reports America/Chicago after the
 * reassignment; only a newly-built one picks up the new zone). The negative-offset block in
 * `calendar.test.ts` sets `TZ` inside the test, so with the option deleted the module-level
 * formatter would have resolved to the RUNNER's zone — UTC in CI — and every assertion would
 * still have passed. The mutation shipped green from CI and failed only on the author's
 * laptop, which is the one shape AGENTS.md §7b says is not evidence.
 *
 * The cost is one `Intl` construction per heading. That is the right trade for a claim this
 * file states in capitals: an assertion that cannot fail is worse than no assertion.
 */
export function monthLabel(month: string): string {
  if (!isValidMonth(month)) throw new TypeError(`monthLabel: not a YYYY-MM month: ${String(month)}`)
  const { year, monthNumber } = monthParts(month)
  const format = new Intl.DateTimeFormat('en-US', {
    month: 'long', year: 'numeric', timeZone: 'UTC',
  })
  return format.format(new Date(Date.UTC(year, monthNumber - 1, 1)))
}

/** The last day a span covers: `ends_on`, or the start day for a one-day entry. */
function spanEnd(entry: CalendarEntry): string {
  // `ends_on < starts_on` is refused by `gatherings_dates_ordered`, so this is about a row
  // that arrived from somewhere other than that column. Reading the span as "at least its
  // own start day" is the only answer that cannot hide an entry from the day it is on.
  return entry.endsOn && entry.endsOn > entry.startsOn ? entry.endsOn : entry.startsOn
}

/**
 * Build one month's grid.
 *
 * ── A MULTI-DAY ENTRY APPEARS ON EVERY DAY IT COVERS ────────────────────────────────
 * That is the whole point of `ends_on`: a family looking at the 17th wants to see that the
 * reunion is on, not to have to notice that something started on the 15th. So the test is
 * `startsOn <= day <= spanEnd`, per day, and a four-day reunion is in four cells.
 *
 * ── THE LEADING AND TRAILING DAYS CARRY THEIR ENTRIES TOO ───────────────────────────
 * The grid is always whole weeks, Sunday first, and the days of the adjacent months are
 * marked `inMonth: false` so the screen can grey them — but they are REAL DAYS and they get
 * their entries. A reunion starting on the 1st of September has to be visible in the last
 * row of August, because that row is on screen and the family is looking at it. Rendering
 * those cells empty would be a calendar that hides something it is already showing the day
 * of.
 *
 * ── WHY `today` DOES NOT HAVE TO BE IN THIS MONTH, OR EVEN VALID ────────────────────
 * `isToday` is an equality test against each day's ISO string, so browsing to next March
 * simply marks nothing, and a garbled `today` marks nothing either. A highlight is the one
 * thing on this page that can degrade to absent without misinforming anybody, which is why
 * it takes no validation and throws nothing.
 */
export function buildCalendarMonth(
  month: string,
  today: string,
  entries: readonly CalendarEntry[],
): CalendarMonth {
  if (!isValidMonth(month)) throw new TypeError(`buildCalendarMonth: not a YYYY-MM month: ${String(month)}`)
  const { year, monthNumber } = monthParts(month)
  const monthIndex = monthNumber - 1

  // Normalised once, not once per cell: the grid asks 35 or 42 questions of every entry and
  // recomputing the span inside that loop is the same work done forty times.
  const spans = entries
    .map(entry => ({ entry, from: entry.startsOn, to: spanEnd(entry) }))
    // A total order, so two renders of the same data cannot disagree — which matters for
    // React keys and for a family comparing two screens. Earliest start first (a reunion
    // already running sits above a one-day event that begins today), then the title, then
    // the id as the last resort. `isPremier` deliberately does NOT sort: it is a badge on
    // one entry, and hoisting it would move it up and down the day as other entries came
    // and went.
    .sort((a, b) =>
      a.from.localeCompare(b.from)
      || a.entry.title.localeCompare(b.entry.title)
      || a.entry.id.localeCompare(b.entry.id))

  // Day 1 of the month, and which weekday it falls on. `getUTCDay` against a `Date.UTC`
  // instant — the local `getDay()` is the same off-by-one-day trap as everything else here,
  // and here it would shift the ENTIRE grid by a column.
  const firstWeekday = new Date(Date.UTC(year, monthIndex, 1)).getUTCDay()  // 0 = Sunday
  // Day 0 of the next month is the last day of this one, by definition. No month-length
  // table, and February 2028 needs no special case.
  const daysInMonth = new Date(Date.UTC(year, monthIndex + 1, 0)).getUTCDate()
  // Whole weeks, always: enough rows to hold the leading blanks plus the month. 28 days
  // starting on a Sunday is 4 rows; 31 starting on a Saturday is 6.
  const cellCount = Math.ceil((firstWeekday + daysInMonth) / 7) * 7

  const weeks: CalendarDay[][] = []
  for (let cell = 0; cell < cellCount; cell++) {
    // Counting from `1 - firstWeekday`, so the first cell is that many days BEFORE the 1st.
    // `Date.UTC` resolves a zero or negative day into the previous month and a day past the
    // end into the next, exactly — this is the one arithmetic a Date is trustworthy for,
    // because a day is always a day, whereas a month is 28 to 31 of them.
    const date = new Date(Date.UTC(year, monthIndex, 1 - firstWeekday + cell))
    const iso = isoOf(date)
    const day: CalendarDay = {
      iso,
      dayOfMonth: date.getUTCDate(),
      inMonth: date.getUTCMonth() === monthIndex && date.getUTCFullYear() === year,
      isToday: iso === today,
      // Inclusive at BOTH ends: an entry is on its own first day and on its own last day.
      // Either bound made exclusive drops a one-day entry from the calendar entirely,
      // which is the majority of them.
      entries: spans.filter(span => span.from <= iso && iso <= span.to).map(span => span.entry),
    }
    if (cell % 7 === 0) weeks.push([])
    weeks[weeks.length - 1].push(day)
  }

  return {
    month,
    label: monthLabel(month),
    weeks,
    prevMonth: shiftMonth(month, -1),
    nextMonth: shiftMonth(month, 1),
  }
}

/** `YYYY-MM-DD` from a UTC instant, read through `getUTC*` for the reason above. */
function isoOf(date: Date): string {
  return [
    String(date.getUTCFullYear()).padStart(4, '0'),
    String(date.getUTCMonth() + 1).padStart(2, '0'),
    String(date.getUTCDate()).padStart(2, '0'),
  ].join('-')
}
