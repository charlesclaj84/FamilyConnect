import { firstWeekdayFor } from '@/lib/date-utils'

/**
 * The month grid behind `/gatherings/calendar`, and the month arithmetic every link on it depends on.
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

/**
 * One thing on the calendar.
 *
 * `kind` HAS ONE MEMBER SINCE 2026-08-19 and is kept rather than deleted. It was
 * `'gathering' | 'event'` while the Events product existed; retiring that left the union with
 * one member, and the field is still what `MonthCalendar` switches its chip treatment on. A
 * second source — a birthday, a dues date, whatever comes next — adds a member here and a tone
 * there, which is the whole reason the grid was written against a `kind` rather than against
 * "is this a gathering".
 */
export interface CalendarEntry {
  id: string
  title: string
  startsOn: string            // YYYY-MM-DD
  endsOn: string | null
  /**
   * WHICH PRODUCT PUT IT THERE. A second value arrived on 2026-08-22 with Meeting Minutes, and
   * the union is what the grid colours by — a reunion and a committee meeting are not the
   * same kind of thing and must not read as one.
   *
   * `sources` in `app/actions/calendar.ts` is the matching record: each kind is granted
   * separately, queried only when granted, and reported as shown or not shown. Its header
   * argues why that shape survived Events being retired, and this is the first thing to plug
   * into it since.
   */
  /**
   * WHAT KIND OF THING THIS IS, and it decides the chip's colour and the `sr-only` word
   * that says the same thing in words. `'election'` arrived 2026-08-22 and is the first
   * kind that is not one row of one table: an election puts TWO entries on the grid, one
   * spanning its nomination window and one spanning its voting window, because those are
   * two different things a member has to do and they never overlap.
   */
  kind: 'gathering' | 'meeting' | 'election'
  /**
   * WHICH HALF OF AN ELECTION this entry is, and undefined for every other kind. It is a
   * field rather than two `kind`s because the two halves link to the same screen and read as
   * one thing in the legend; `MonthCalendar` is the only consumer and uses it to pick the
   * outline against the fill.
   */
  phase?: 'nominations' | 'voting'
  /**
   * "11:00 AM – 4:00 PM", "from 11:00 AM", or undefined where no time was given.
   *
   * ── OPTIONAL, AND UNDEFINED IS A REAL ANSWER ──────────────────────────────────────
   * "The reunion is on 4 July" is complete, and most gatherings are entered that way — so a
   * chip renders nothing rather than an empty element with its own padding. `timeLabelFor` in
   * `lib/gathering-when.ts` builds it and returns null for exactly that case.
   *
   * ── IT IS A LABEL, NOT AN INSTANT, AND NOTHING HERE SORTS BY IT ────────────────────
   * `20260826000001`'s header argues it: a gathering's time is wall-clock, never converted,
   * never compared across zones. The grid's ordering is by DATE and by title, which is what it
   * has always been — adding a time to the sort would put a 9am chip above an all-day one and
   * make the same month read differently depending on whether anybody had entered a time.
   */
  timeLabel?: string
  href: string
  isPremier?: boolean
}

/**
 * ONE CONTINUOUS BAR ON THE GRID, rather than one chip per day.
 *
 * ── WHY THE GRID NEEDED A SECOND SHAPE ─────────────────────────────────────────────
 * `entries` says which entries cover a day, which is the right answer for a day LIST and
 * the wrong one for a month GRID. A week of voting rendered as seven identical chips, each
 * repeating the title, reads as seven separate things; it was reported exactly that way —
 * "Voting — Texas is on the 24th and 25th, can you make it span both days instead of one
 * per day". A calendar draws a span as a bar, and a bar has to know three things a per-day
 * list cannot express: which ROW of the week's stack it occupies (so it is continuous
 * rather than jumping up and down as neighbours come and go), how many days it covers in
 * THIS week, and whether it is cut off at either end of the week.
 *
 * ── A BAR BELONGS TO THE DAY IT STARTS ON, AND ONLY THAT DAY ────────────────────────
 * `bars` holds the runs that BEGIN on this day — clipped to this day's week, so a reunion
 * crossing a Saturday appears as one bar in each of the two weeks. The continuation days
 * carry nothing at all: the renderer reserves `lane` slots in every cell of the week and
 * lets the starting cell's bar overflow across them, which is what makes it one element
 * with one label and one hit target. Putting a segment on every covered day was the first
 * design and it is worse in the way that matters — a label inside a one-day-wide box
 * truncates to one day's width however long the bar is.
 *
 * ── AND `entries` IS UNCHANGED, DELIBERATELY ───────────────────────────────────────
 * Both live on the day and neither is derived from the other at render time. The day list
 * below `sm` genuinely wants one titled row per day (it is an agenda, not a grid), and the
 * legend wants the set of kinds present. Building either from `bars` would mean the two
 * renderings stopped reading the same data, which is the property `MonthCalendar`'s header
 * rests its whole two-renderings exception on.
 */
export interface CalendarBar {
  entry: CalendarEntry
  /**
   * 0-based row in this week's stack. THE SAME LANE FOR EVERY WEEK THE ENTRY TOUCHES is
   * not promised and is not wanted — lanes are packed per week, so a bar can sit in row 0
   * one week and row 1 the next. What IS promised is that the lane holds for the whole of
   * one week's run, which is what continuity across days needs.
   */
  lane: number
  /** Days it covers in this week, 1–7. The renderer's width is a multiple of this. */
  span: number
  /** The entry began before this week: draw the leading edge square, not rounded. */
  continuesBefore: boolean
  /** ...and it runs past the end of this week. */
  continuesAfter: boolean
}

export interface CalendarDay {
  iso: string                 // YYYY-MM-DD
  dayOfMonth: number
  /** false for the leading/trailing days of the adjacent months. */
  inMonth: boolean
  isToday: boolean
  /** Every entry whose span covers this day — see `buildCalendarMonth`. */
  entries: readonly CalendarEntry[]
  /** The bars that BEGIN on this day, within its week — see `CalendarBar`. */
  bars: readonly CalendarBar[]
}

/** A day under construction: `bars` is filled per week, after every day exists. */
type MutableDay = Omit<CalendarDay, 'bars'> & { bars: CalendarBar[] }

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

const DATE_PATTERN = /^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/

/**
 * A `YYYY-MM-DD` this product will accept, checked before the database is touched.
 *
 * ── IT PINS THE RANGES AND NOT ONLY THE SHAPE, for `isValidMonth`'s reason ─────────
 * `\d{2}` would let "2026-13-40" through, and Postgres would then refuse it with a raw
 * `date/time field value out of range` that surfaces to a member as a database error. The
 * ranges are pinned here so the refusal is ours and is a sentence.
 *
 * IT DOES NOT KNOW ABOUT FEBRUARY. "2027-02-30" passes this and is refused by the DATE column,
 * which is the right division of labour: a regex that knew about leap years would be a second,
 * worse copy of the calendar. What this buys is that everything ABSURD is refused in
 * TypeScript, so the only thing reaching the database is a date that is nearly right.
 *
 * NO `new Date()` ANYWHERE IN IT. `new Date('2026-08-01')` is UTC midnight and reads as 31 July
 * in any negative offset, which is the trap this whole module is written around.
 */
export function isIsoDate(value: unknown): value is string {
  return typeof value === 'string' && DATE_PATTERN.test(value)
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
export function monthLabel(month: string, locale: string = 'en-US'): string {
  if (!isValidMonth(month)) throw new TypeError(`monthLabel: not a YYYY-MM month: ${String(month)}`)
  const { year, monthNumber } = monthParts(month)
  // THE READER'S LOCALE. This is a heading somebody reads — "August 2026" / "agosto de 2026"
  // — so unlike the field reads in `lib/tz.ts` it follows the reader. The `timeZone: 'UTC'`
  // pin below is a different question entirely and stays; see the note above.
  const format = new Intl.DateTimeFormat(locale, {
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
 *
 * ── AND EVERY DAY CARRIES BOTH `entries` AND `bars` ─────────────────────────────────
 * Two shapes over the same spans, for two renderings that want different things: a per-day
 * list for the agenda below `sm`, and per-week stacked bars for the grid. `packWeek` does
 * the second, once per week, AFTER every day of that week exists — a lane is a property of
 * the week and cannot be decided one cell at a time. `CalendarBar` argues why the grid
 * needed it at all.
 */
export function buildCalendarMonth(
  month: string,
  today: string,
  entries: readonly CalendarEntry[],
  /**
   * The reader's BCP-47 tag, for the month heading.
   *
   * ── IT DEFAULTS TO ENGLISH, AND THAT DEFAULT WAS THE BUG ────────────────────────
   * `monthLabel` has taken a locale since it was written and says in its own comment that
   * *"this is a heading somebody reads — 'August 2026' / 'agosto de 2026' — so it follows the
   * reader"*. This function then called it with no locale at all, so every calendar in the
   * product printed an English month to every reader. Found by rendering the page in two
   * languages and diffing: the heading was the same string in both.
   *
   * OPTIONAL rather than required, because `lib/calendar.test.ts` builds ~40 months and the
   * month NAME is not what any of them asserts — a required parameter would be forty edits
   * to say nothing. The one real caller passes it.
   */
  intl: string = 'en-US',
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
  const weekday = new Date(Date.UTC(year, monthIndex, 1)).getUTCDay()  // 0 = Sunday
  // ── HOW MANY CELLS BEFORE THE 1st, WHICH IS NOT THE SAME AS ITS WEEKDAY ──────────
  // The grid starts on the reader's first weekday, which is Sunday in the United States and in
  // Mexico, Monday in France, and Saturday across most of the Arabic-speaking world. Before
  // 2026-09-01 this WAS the weekday, i.e. Sunday-first for everybody — so a French member read
  // a calendar whose columns were shifted by one day, plausibly and silently.
  //
  // `+ 7) % 7` because the subtraction goes negative whenever the 1st falls before the week's
  // first day: a Monday-first March beginning on a Sunday needs SIX leading cells, not minus
  // one, and a negative here would build a grid that starts after the month does.
  //
  // `firstWeekdayFor` is asked by `weekdayNames` too, so the header row and the grid cannot
  // disagree about which column is which — a mismatch there puts every date under the wrong
  // name and looks entirely plausible.
  const firstWeekday = (weekday - firstWeekdayFor(intl) + 7) % 7
  // Day 0 of the next month is the last day of this one, by definition. No month-length
  // table, and February 2028 needs no special case.
  const daysInMonth = new Date(Date.UTC(year, monthIndex + 1, 0)).getUTCDate()
  // Whole weeks, always: enough rows to hold the leading blanks plus the month. 28 days
  // starting on a Sunday is 4 rows; 31 starting on a Saturday is 6.
  const cellCount = Math.ceil((firstWeekday + daysInMonth) / 7) * 7

  const weeks: MutableDay[][] = []
  for (let cell = 0; cell < cellCount; cell++) {
    // Counting from `1 - firstWeekday`, so the first cell is that many days BEFORE the 1st.
    // `Date.UTC` resolves a zero or negative day into the previous month and a day past the
    // end into the next, exactly — this is the one arithmetic a Date is trustworthy for,
    // because a day is always a day, whereas a month is 28 to 31 of them.
    const date = new Date(Date.UTC(year, monthIndex, 1 - firstWeekday + cell))
    const iso = isoOf(date)
    const day = {
      iso,
      dayOfMonth: date.getUTCDate(),
      inMonth: date.getUTCMonth() === monthIndex && date.getUTCFullYear() === year,
      isToday: iso === today,
      // Inclusive at BOTH ends: an entry is on its own first day and on its own last day.
      // Either bound made exclusive drops a one-day entry from the calendar entirely,
      // which is the majority of them.
      entries: spans.filter(span => span.from <= iso && iso <= span.to).map(span => span.entry),
      // Filled per week, below — lanes are a property of the WEEK, not of the day.
      bars: [] as CalendarBar[],
    }
    if (cell % 7 === 0) weeks.push([])
    weeks[weeks.length - 1].push(day)
  }

  for (const week of weeks) packWeek(week, spans)

  return {
    month,
    label: monthLabel(month, intl),
    weeks,
    prevMonth: shiftMonth(month, -1),
    nextMonth: shiftMonth(month, 1),
  }
}

/**
 * Turn one week's overlapping spans into stacked bars, and hang each on the day it starts.
 *
 * ── IT IS INTERVAL PARTITIONING, AND THE GREEDY ANSWER IS THE RIGHT ONE ─────────────
 * Sort the week's runs by the day they start on and give each the LOWEST row whose previous
 * occupant has already finished. That uses the fewest rows possible, which matters because
 * every cell in the week has to reserve every row — one wasted lane is 24px of empty space
 * across seven cells — and it is what every calendar does, so the result looks like one.
 *
 * ── THE ORDER IS TOTAL, AND THAT IS THE POINT ──────────────────────────────────────
 * Start day, then the LONGER run first, then title, then id. Ties broken all the way down,
 * because a greedy assignment is only stable if its input order is: two renders of the same
 * month must not swap two bars between rows, or a family comparing two screens sees a
 * different calendar. Longer-first is the one tie-break that is about appearance rather than
 * determinism — a week-long bar above a one-day chip reads as a background for it, and the
 * reverse reads as an interruption.
 *
 * ── THE LANE IS FIXED FOR THE WHOLE RUN, WHICH IS THE WHOLE FEATURE ────────────────
 * `lastEnd[lane]` is the day index this lane is occupied until, so nothing is ever placed on
 * top of a run in progress. That is what a per-day sort could not do: with entries filtered
 * and sorted independently for each day, a two-day bar starting Monday sat in row 0 on Monday
 * and row 1 on Tuesday as soon as something else started on Tuesday, and the "bar" was two
 * chips at different heights.
 *
 * Days are compared as `YYYY-MM-DD` strings, and INDICES within the week are integers 0–6.
 * No `Date` at all: the week already holds its own days in order, so `findIndex` is the
 * conversion and there is nothing to get wrong about zones.
 */
function packWeek(
  week: MutableDay[],
  spans: readonly { entry: CalendarEntry; from: string; to: string }[],
): void {
  const weekStart = week[0].iso
  const weekEnd = week[week.length - 1].iso

  const runs = spans
    .filter(span => span.from <= weekEnd && span.to >= weekStart)
    .map(span => {
      // Clipped to this week. `Math.max` on strings is not a thing, so the comparison is
      // explicit — and the index is where that day sits in this week, which is what the
      // renderer counts in.
      const from = span.from > weekStart ? span.from : weekStart
      const to = span.to < weekEnd ? span.to : weekEnd
      return {
        entry: span.entry,
        fromIndex: week.findIndex(day => day.iso === from),
        toIndex: week.findIndex(day => day.iso === to),
        continuesBefore: span.from < weekStart,
        continuesAfter: span.to > weekEnd,
      }
    })
    // A run whose clipped ends are not in this week cannot happen — the filter above is
    // exactly the overlap test — but `findIndex` answers -1 rather than throwing, and a
    // bar at index -1 would render off the left edge of the grid.
    .filter(run => run.fromIndex >= 0 && run.toIndex >= run.fromIndex)
    .sort((a, b) =>
      a.fromIndex - b.fromIndex
      || (b.toIndex - b.fromIndex) - (a.toIndex - a.fromIndex)
      || a.entry.title.localeCompare(b.entry.title)
      || a.entry.id.localeCompare(b.entry.id))

  /** Day index each lane is occupied until, or -1 for a lane never used. */
  const lastEnd: number[] = []
  for (const run of runs) {
    let lane = lastEnd.findIndex(end => end < run.fromIndex)
    if (lane === -1) {
      lane = lastEnd.length
      lastEnd.push(run.toIndex)
    } else {
      lastEnd[lane] = run.toIndex
    }
    week[run.fromIndex].bars.push({
      entry: run.entry,
      lane,
      span: run.toIndex - run.fromIndex + 1,
      continuesBefore: run.continuesBefore,
      continuesAfter: run.continuesAfter,
    })
  }

  // By lane, so a cell's bars come out in the order its rows are drawn. The renderer indexes
  // by `lane` and does not depend on this, but a day whose bars are shuffled relative to its
  // own rows is a trap for anything reading `bars` later.
  for (const day of week) day.bars.sort((a, b) => a.lane - b.lane)
}

/** `YYYY-MM-DD` from a UTC instant, read through `getUTC*` for the reason above. */
function isoOf(date: Date): string {
  return [
    String(date.getUTCFullYear()).padStart(4, '0'),
    String(date.getUTCMonth() + 1).padStart(2, '0'),
    String(date.getUTCDate()).padStart(2, '0'),
  ].join('-')
}
