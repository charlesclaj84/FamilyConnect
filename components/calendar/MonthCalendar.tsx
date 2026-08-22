import Link from 'next/link'
import { ChevronLeft, ChevronRight, Gavel, Star, Vote } from 'lucide-react'
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
 * ── TWO TREATMENTS, AND WHY GOLD IS THE PREMIER ONE ─────────────────────────────────
 * A premier gathering is the one the family is being told to look at, so it takes the gold
 * SURFACE with its measured dark partner (`bg-brand-legacy text-brand-on-legacy`, 6.14) — the
 * same pairing `GATHERING_STATUS_PILL` uses for a state that is waiting on somebody. Gold can
 * never be a foreground on a pale ground (2.30 on white, 1.65 on sand), which is why it is a
 * fill here and never text. An ordinary gathering is Heritage soft.
 *
 * THERE WERE THREE UNTIL 2026-08-19, the third being a neutral `--muted` surface for an EVENT.
 * Events is retired, `CalendarEntry.kind` has one member, and the tone went with it — along
 * with the paragraph that used to sit here explaining why that surface needed a border to be
 * perceptible at all (`--muted` is 1.13:1 against the page ground, so a bare legend swatch
 * taught the reader nothing). The border is kept on both surviving tones, transparent on
 * neither being needed now, purely so a future third tone cannot make one chip 2px taller than
 * the one above it — the rule `table-collapse.tsx` and `MainRail` both keep.
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
  premier:    'Premier gathering',
  gathering:  'Gathering',
  meeting:    'Meeting',
  nominations: 'Nominations open',
  voting:     'Voting open',
} as const

/**
 * The measured surface pairs. Never crossed — a foreground from one pair on another's fill is
 * an unchecked combination in both themes.
 *
 * Both carry the same border WIDTH, transparent, so adding a third tone with a visible edge
 * cannot make one chip 2px taller than the one above it — the rule `table-collapse.tsx` and
 * `MainRail` both keep for the same reason.
 */
// ── ONE TONE PER KIND, AND EVERY ONE IS A DOCUMENTED PAIR ────────────────────────────
// AGENTS.md: "every surface role has an `on-` partner guaranteed to meet WCAG AA against it
// in BOTH themes", and a foreground from one pair on the surface of another is not a checked
// combination. So each row below takes a surface and its own partner, and none is invented.
//
// `--brand-legacy` is the exception the token list already states: it has no `on-` partner,
// because gold is 2.30 against white and can never carry text in light mode — `text-brand-on-
// legacy` is dark ink on it, which is 6.14 and is what the premier chip has always used.
//
// THE MEETING TONE IS NEW, AND IT IS A REPAIR RATHER THAN AN ADDITION. `calendar.ts` has
// emitted `kind: 'meeting'` since 2026-08-22 and `toneOf` looked only at `isPremier`, so
// every meeting rendered in the gathering colour AND announced itself to a screen reader as
// "Gathering:". The legend said there were two kinds when there were three.
const ENTRY_TONE = {
  premier:     'border border-transparent bg-brand-legacy text-brand-on-legacy font-medium',
  gathering:   'border border-transparent bg-brand-soft text-brand-on-soft',
  meeting:     'border border-transparent bg-brand-primary text-brand-on-primary',
  nominations: 'border border-brand-warm bg-transparent text-brand-on-warm',
  voting:      'border border-transparent bg-brand-warm text-brand-on-warm',
} as const

type EntryTone = keyof typeof ENTRY_TONE

/**
 * The chip's tone, which is its KIND plus the one modifier a kind carries.
 *
 * An election contributes two entries and they are the same kind, so the two are told apart
 * by `phase` — outline for nominations, filled for voting. Both are Warmth, because they are
 * halves of one thing; the fill is what says the vote is the consequential half.
 */
function toneOf(entry: CalendarEntry): EntryTone {
  if (entry.kind === 'meeting') return 'meeting'
  if (entry.kind === 'election') return entry.phase === 'voting' ? 'voting' : 'nominations'
  return entry.isPremier ? 'premier' : 'gathering'
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
      {tone === 'meeting' && <Gavel aria-hidden="true" className="mr-1 inline h-3 w-3" />}
      {(tone === 'nominations' || tone === 'voting') && (
        <Vote aria-hidden="true" className="mr-1 inline h-3 w-3" />
      )}
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
  // In `ENTRY_TONE`'s declaration order, so the legend reads the same way every month
  // rather than in whatever order the first entry of the month happened to be.
  const onGrid = new Set(days.flatMap(day => day.entries.map(toneOf)))
  const legend = (Object.keys(ENTRY_TONE) as EntryTone[]).filter(tone => onGrid.has(tone))

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
            href={`/gatherings/calendar?month=${month.prevMonth}`}
            aria-label={`Go to ${monthLabel(month.prevMonth)}`}
            className="inline-flex h-8 items-center gap-1 rounded-lg border px-2.5 text-sm text-foreground hover:bg-muted"
          >
            <ChevronLeft aria-hidden="true" className="h-4 w-4" />
            <span className="hidden sm:inline">{monthLabel(month.prevMonth)}</span>
          </Link>
          {/* No `month` at all, so the page falls back to the current month. That is one
              fewer place that has to agree about what today is. */}
          <Link
            href="/gatherings/calendar"
            className="inline-flex h-8 items-center rounded-lg border px-2.5 text-sm text-foreground hover:bg-muted"
          >
            This month
          </Link>
          <Link
            href={`/gatherings/calendar?month=${month.nextMonth}`}
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
            {`What is on in ${month.label}, one column per weekday.`}
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

      {/* ── THE LEGEND NAMES ONLY WHAT IS ON THIS GRID ─────────────────────────────
          It was a hand-written list of two, which was a second place that had to be kept in
          step with `ENTRY_TONE` and was not: meetings had been on the calendar for a day
          with no legend row. Deriving it from the entries fixes that AND fixes the §5-shaped
          problem underneath — a legend row for Voting, shown to a member whose family has
          restricted Elections, advertises a kind of thing they will never see a chip for.
          A grid with nothing on it renders no legend at all, which is right: there is
          nothing to explain. */}
      {legend.length > 0 && (
        <ul className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs text-muted-foreground">
          {legend.map(tone => (
            <li key={tone} className="flex items-center gap-1.5">
              <span aria-hidden="true" className={cn('h-3 w-6 rounded', ENTRY_TONE[tone])} />
              {ENTRY_KIND_WORD[tone]}
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
