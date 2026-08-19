import Link from 'next/link'
import { ChevronLeft, ChevronRight, Star } from 'lucide-react'
import { cn } from '@/lib/utils'
import { monthLabel, type CalendarDay, type CalendarEntry, type CalendarMonth } from '@/lib/calendar'

/**
 * One month of the family calendar: a real seven-column grid on a screen that can hold one,
 * and a day list on a screen that cannot.
 *
 * ── TWO RENDERINGS, AND THIS IS THE SANCTIONED EXCEPTION ────────────────────────────
 * `components/ui/table-collapse.tsx` argues at length against a second, stacked rendering of
 * a table below `sm` — two renderings of one row drift, and a column added to one and not the
 * other is invisible until somebody opens a phone. That argument holds for a DATA table and
 * does not transfer here, for a reason worth stating rather than assuming:
 *
 *   * In a data table a cell's meaning is its COLUMN, so folding a column away and restating
 *     it on the row loses nothing. In a month grid a cell's meaning is its POSITION — the
 *     column is a weekday and the row is a week — and there is nothing to fold: seven columns
 *     is the whole content. At 390px a seven-column grid is 48px per day, which cannot hold a
 *     date and an entry, and squeezing it produces a grid that is technically present and
 *     unreadable.
 *   * The two renderings here cannot drift, because neither holds any data of its own. Both
 *     walk the SAME `CalendarMonth` — the same `CalendarDay` objects, with the same
 *     `entries` arrays — which is built once by `buildCalendarMonth` and passed in. Nothing is
 *     fetched twice and nothing is computed twice; the difference is which of the two loops
 *     the media query lets you see.
 *
 * The spec says this in one line ("the mobile calendar is an explicit decision, not a
 * fallback") and this is the decision.
 *
 * ── IT IS A `<table>`, DELIBERATELY ─────────────────────────────────────────────────
 * A month is tabular: weeks are rows and weekdays are columns, and `<th scope="col">Sunday`
 * is what makes a screen reader announce a cell with the weekday it belongs to. A grid of
 * `<div>`s would have to claim `role="grid"` to say the same thing and would then owe the key
 * handling that role promises — the same argument `MainRail` makes for refusing
 * `role="tablist"`. `table-fixed` gives every weekday one seventh of the measure, so a long
 * title cannot widen a column, and there is NO `min-w-*` floor and no `overflow-x-auto`
 * anywhere in this file: the page must never scroll sideways.
 *
 * ── EVERY LINK SETS ITS OWN COLOUR ──────────────────────────────────────────────────
 * `app/globals.css` carries an unscoped `a { color: var(--brand-accent) }` in its base layer,
 * so an anchor with no colour of its own comes out terracotta in light mode and GOLD in dark.
 * Every chip and every navigation link below states its foreground explicitly, and each pair
 * is a measured pair from that file. Removing one of them recolours the calendar.
 *
 * ── THE THREE TREATMENTS, AND WHY GOLD IS THE PREMIER ONE ───────────────────────────
 * A premier gathering is the one the family is being told to look at, so it takes the gold
 * SURFACE with its measured dark partner (`bg-brand-legacy text-brand-on-legacy`, 6.14) — the
 * same pairing `GATHERING_STATUS_PILL` uses for a state that is waiting on somebody. Gold can
 * never be a foreground on a pale ground (2.30 on white, 1.65 on sand), which is why it is a
 * fill here and never text. An ordinary gathering is Heritage soft, and an event is the
 * neutral surface: gatherings are this feature's own, events are the neighbouring product.
 *
 * Colour is never the only signal. Each chip carries an `sr-only` word naming what it is, and
 * the premier one carries a star as well, so the distinction survives both a screen reader and
 * a reader who cannot separate the two hues.
 */

export interface MonthCalendarProps {
  /** Built by `buildCalendarMonth` on the server — see the header on why it is built once. */
  month: CalendarMonth
  className?: string
}

/**
 * Sunday first, matching `buildCalendarMonth`'s weeks exactly.
 *
 * The short form is what the column heading prints and the full form is what a screen reader
 * announces, which is the whole reason both are here: "Sun" read out is a word, not a day.
 * Taken by INDEX from the week rather than parsed out of each day's date — the grid is
 * Sunday-first by construction, so index 0 is Sunday and no `Date` has to be built to find out.
 */
const WEEKDAYS = [
  { short: 'Sun', long: 'Sunday' },
  { short: 'Mon', long: 'Monday' },
  { short: 'Tue', long: 'Tuesday' },
  { short: 'Wed', long: 'Wednesday' },
  { short: 'Thu', long: 'Thursday' },
  { short: 'Fri', long: 'Friday' },
  { short: 'Sat', long: 'Saturday' },
] as const

/** What each kind of entry is called, for the `sr-only` prefix and the legend. */
const ENTRY_KIND_WORD = {
  premier:   'Premier gathering',
  gathering: 'Gathering',
  event:     'Event',
} as const

/**
 * The measured surface pairs. Never crossed — a foreground from one pair on another's fill is
 * an unchecked combination in both themes.
 *
 * ── THE EVENT TONE CARRIES A BORDER, AND THAT IS NOT DECORATION ──────────────────────
 * `--muted` is `#f2ece3` and the page ground is `#faf7f2`: **1.13:1**. Its `text-foreground` is
 * perfectly readable, so an event chip in the grid was legible — but it had no perceptible
 * SURFACE, which turned the three-treatment system below into two treatments and an absence.
 * The legend was the worse half: that swatch is a bare 12×24 block with no text of its own, so
 * at 1.13 it taught the reader nothing at all about which chips are events.
 *
 * `border-border` rather than a new hue, because being the QUIETEST of the three is the intent
 * (gatherings are this feature's own, events are the neighbouring product) and it is the same
 * token every card edge in the app already draws with. All three tones carry the same border
 * WIDTH, transparent on two, so an event chip is not 2px taller than the gathering above it —
 * the rule `table-collapse.tsx` and `MainRail` both keep for the same reason.
 */
const ENTRY_TONE = {
  premier:   'border border-transparent bg-brand-legacy text-brand-on-legacy font-medium',
  gathering: 'border border-transparent bg-brand-soft text-brand-on-soft',
  event:     'border border-border bg-muted text-foreground',
} as const

type EntryTone = keyof typeof ENTRY_TONE

function toneOf(entry: CalendarEntry): EntryTone {
  if (entry.kind === 'gathering') return entry.isPremier ? 'premier' : 'gathering'
  return 'event'
}

/**
 * One entry, in a cell or on a day-list row.
 *
 * `truncate` inside a `min-w-0` block is what keeps a long title from widening its grid
 * track: without the `min-w-0` a flex or grid child refuses to shrink below its content and
 * the whole table pushes the page sideways, which is the one thing this screen must not do.
 */
function EntryChip({ entry }: { entry: CalendarEntry }) {
  const tone = toneOf(entry)
  return (
    <Link
      href={entry.href}
      className={cn(
        'block min-w-0 truncate rounded px-1.5 py-0.5 text-xs hover:opacity-90',
        ENTRY_TONE[tone],
      )}
      title={entry.title}
    >
      {tone === 'premier' && <Star aria-hidden="true" className="mr-1 inline h-3 w-3" />}
      {/* Says in words what the colour says in colour. */}
      <span className="sr-only">{ENTRY_KIND_WORD[tone]}: </span>
      {entry.title}
    </Link>
  )
}

/** Which adjacent month a leading or trailing day belongs to — for the day list, where a
 *  cell has no column to place it. `YYYY-MM` compares lexicographically. */
function adjacentCaption(day: CalendarDay, month: string): string | null {
  if (day.inMonth) return null
  return day.iso.slice(0, 7) < month ? 'Previous month' : 'Next month'
}

export function MonthCalendar({ month, className }: MonthCalendarProps) {
  const days = month.weeks.flat()
  const hasEntries = days.some(day => day.entries.length > 0)

  return (
    <section className={cn('space-y-4', className)} aria-label={`${month.label} calendar`}>
      {/* ── The month, and the two ways out of it ──────────────────────────────────
          REAL ANCHORS, not buttons that push state. The month is in the query string on
          purpose, so it is addressable, cmd-clickable and bookmarkable — a family emails
          each other "look at August" — and an `<a href>` is the only thing that gives all
          three. Both targets come from `shiftMonth`, which works on (year, month) integers
          and so cannot skip February the way a day-of-month `setMonth` does. */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-lg">{month.label}</h2>
        <div className="flex items-center gap-1">
          <Link
            href={`/calendar?month=${month.prevMonth}`}
            aria-label={`Go to ${monthLabel(month.prevMonth)}`}
            className="inline-flex h-8 items-center gap-1 rounded-lg border px-2.5 text-sm text-foreground hover:bg-muted"
          >
            <ChevronLeft aria-hidden="true" className="h-4 w-4" />
            <span className="hidden sm:inline">{monthLabel(month.prevMonth)}</span>
          </Link>
          {/* No `month` at all, so the page falls back to the current month. That is one
              fewer place that has to agree about what today is. */}
          <Link
            href="/calendar"
            className="inline-flex h-8 items-center rounded-lg border px-2.5 text-sm text-foreground hover:bg-muted"
          >
            This month
          </Link>
          <Link
            href={`/calendar?month=${month.nextMonth}`}
            aria-label={`Go to ${monthLabel(month.nextMonth)}`}
            className="inline-flex h-8 items-center gap-1 rounded-lg border px-2.5 text-sm text-foreground hover:bg-muted"
          >
            <span className="hidden sm:inline">{monthLabel(month.nextMonth)}</span>
            <ChevronRight aria-hidden="true" className="h-4 w-4" />
          </Link>
        </div>
      </div>

      {!hasEntries && (
        <p className="rounded-xl border bg-muted/40 px-4 py-6 text-sm text-muted-foreground">
          Nothing is on the calendar in {month.label}.
        </p>
      )}

      {/* ── The grid, from `sm` up ─────────────────────────────────────────────── */}
      <div className="hidden overflow-hidden rounded-xl border sm:block">
        <table className="w-full table-fixed border-collapse text-sm">
          <caption className="sr-only">
            {`Gatherings and events in ${month.label}, one column per weekday.`}
          </caption>
          <thead>
            <tr className="border-b bg-muted/40 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              {WEEKDAYS.map(weekday => (
                <th key={weekday.long} scope="col" className="px-2 py-2 text-left font-semibold">
                  <span aria-hidden="true">{weekday.short}</span>
                  <span className="sr-only">{weekday.long}</span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {month.weeks.map(week => (
              <tr key={week[0].iso} className="border-b last:border-0">
                {week.map(day => (
                  <td
                    key={day.iso}
                    // `h-24` on a cell is a MINIMUM in CSS, so a day with five entries grows
                    // its row instead of clipping them — which is why nothing here caps the
                    // list at three with a "+2 more" that has nowhere to lead.
                    className={cn(
                      'h-24 border-r p-1 align-top last:border-r-0',
                      !day.inMonth && 'bg-muted/30',
                      day.isToday && 'bg-brand-soft/30',
                    )}
                  >
                    <div className="flex items-center gap-1">
                      {day.isToday ? (
                        <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-brand-primary text-xs font-semibold text-brand-on-primary">
                          {day.dayOfMonth}
                          <span className="sr-only"> — today</span>
                        </span>
                      ) : (
                        <span className={cn(
                          'text-xs tabular-nums',
                          day.inMonth ? 'text-muted-foreground' : 'text-muted-foreground/60',
                        )}>
                          {day.dayOfMonth}
                        </span>
                      )}
                    </div>
                    {day.entries.length > 0 && (
                      <div className="mt-1 space-y-0.5">
                        {day.entries.map(entry => (
                          // The key is the pair, not the id: a multi-day entry is on every
                          // day it covers, so the id alone repeats across cells.
                          <EntryChip key={`${day.iso}:${entry.id}`} entry={entry} />
                        ))}
                      </div>
                    )}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* ── The day list, below `sm` ───────────────────────────────────────────────
          Only the days that have something on them, in order — PLUS today, always. A
          phone-sized list of 31 mostly-empty days is a list of nothing, and the question this
          screen answers on a phone is "what is coming up", not "how long is August".

          But today is the reader's only anchor in the month, and the grid that marks it
          unconditionally is `display: none` here — so filtering it out along with the other
          empty days left a `<sm` reader looking at three dated rows with no way to tell which
          of them had already passed. That happens in most months, because most families do not
          have something on the calendar on the day they happen to look. The filter stays and
          today is exempt from it; the row says so rather than rendering an empty column. */}
      <div className="sm:hidden">
        {hasEntries && (
          <ul className="divide-y rounded-xl border">
            {month.weeks.map(week => week.map((day, weekdayIndex) => {
              if (day.entries.length === 0 && !day.isToday) return null
              const adjacent = adjacentCaption(day, month.month)
              return (
                <li key={day.iso} className="flex gap-3 px-3 py-2.5">
                  <div className="w-12 shrink-0">
                    <p className="text-xs uppercase tracking-wide text-muted-foreground">
                      {WEEKDAYS[weekdayIndex].short}
                      <span className="sr-only">{` ${WEEKDAYS[weekdayIndex].long}`}</span>
                    </p>
                    {day.isToday ? (
                      <p className="mt-0.5">
                        <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-brand-primary text-sm font-semibold text-brand-on-primary">
                          {day.dayOfMonth}
                          <span className="sr-only"> — today</span>
                        </span>
                      </p>
                    ) : (
                      <p className="text-lg font-semibold tabular-nums leading-tight">{day.dayOfMonth}</p>
                    )}
                    {adjacent && <p className="text-xs leading-tight text-muted-foreground">{adjacent}</p>}
                  </div>
                  <div className="min-w-0 flex-1 space-y-1">
                    {day.entries.length === 0 ? (
                      // Reachable only for today, by the exemption above. A sentence rather than
                      // an empty column: a row with a marked date and nothing beside it reads as
                      // something that failed to load.
                      <p className="text-sm text-muted-foreground">Nothing on today.</p>
                    ) : day.entries.map(entry => (
                      <EntryChip key={`${day.iso}:${entry.id}`} entry={entry} />
                    ))}
                  </div>
                </li>
              )
            }))}
          </ul>
        )}
      </div>

      <ul className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs text-muted-foreground">
        {(['premier', 'gathering', 'event'] as const).map(tone => (
          <li key={tone} className="flex items-center gap-1.5">
            <span aria-hidden="true" className={cn('h-3 w-6 rounded', ENTRY_TONE[tone])} />
            {ENTRY_KIND_WORD[tone]}
          </li>
        ))}
      </ul>
    </section>
  )
}
