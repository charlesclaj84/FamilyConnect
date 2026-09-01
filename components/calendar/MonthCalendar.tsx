import Link from 'next/link'
import { weekdayNames } from '@/lib/date-utils'
import { ChevronLeft, ChevronRight, Gavel, Star, Vote } from 'lucide-react'
import { cn } from '@/lib/utils'
import {
  monthLabel,
  type CalendarBar, type CalendarDay, type CalendarEntry, type CalendarMonth,
} from '@/lib/calendar'
import type { T } from '@/lib/i18n/t'

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
 *     walk the SAME `CalendarMonth`, built once by `buildCalendarMonth` and passed in.
 *     Nothing is fetched twice and nothing is computed twice; the difference is which of the
 *     two loops the media query lets you see.
 *
 * The spec says this in one line ("the mobile calendar is an explicit decision, not a
 * fallback") and this is the decision.
 *
 * ── THEY READ DIFFERENT FIELDS OF THE SAME DAY, SINCE 2026-08-22 ────────────────────
 * The grid reads `day.bars` and the list reads `day.entries`, and that is not the two
 * renderings drifting — it is each asking the question its axis can answer.
 *
 *   * The GRID has a horizontal axis, so a span is a BAR: one element crossing every day of
 *     its run in that week, with the title once at its left end. It was one chip per day
 *     until 2026-08-22, which drew a two-day election window as two separate things with the
 *     same name — reported exactly that way, and the reason `CalendarBar` exists.
 *   * The LIST has no horizontal axis at all, so a span is one titled row under each of its
 *     dates. That is what an agenda is; a bar would have nothing to stretch along.
 *
 * `lib/calendar.ts` computes both from one pass over one set of spans, so there is still
 * nothing here that could disagree with itself. `packWeek` is where the lanes are decided and
 * why they are decided per week rather than per cell.
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
  /**
   * The reader's language, bound, and its `Intl` tag.
   *
   * PROPS RATHER THAN `useT()`, because this is a Server Component: the month is built on the
   * server and this renderer holds no state, so there is nothing to hydrate and no context to
   * read. `lib/i18n/server.ts` carries the rule — a `T` crossing a server-to-server boundary is
   * passed by reference, and a missing prop is a type error.
   */
  t: T
  intl: string
}

/*
 * THE WEEKDAY NAMES COME FROM `Intl`, through `weekdayNames()` in lib/date-utils.ts — they were
 * a hand-written table here until Phase 5. Its header carries the argument; the short version is
 * that a weekday is not copy, every locale already has canonical forms, and Spanish and French
 * both lower-case them.
 *
 * Everything the old comment said still holds and is now the helper's contract: Sunday first,
 * matching `buildCalendarMonth`'s weeks; both forms, because the heading prints the short one and
 * a screen reader announces the long one; and taken by INDEX from the week rather than parsed out
 * of each day's date, since the grid is Sunday-first by construction.
 */

/**
 * What each kind of entry is called, for the `sr-only` prefix and the legend.
 *
 * A FUNCTION of `t`. The TONE keys are the contract — `ENTRY_TONE`'s declaration order is what
 * makes the legend read the same way every month — and only the words moved.
 */
function entryKindWord(t: T, tone: EntryTone): string {
  return t(`cal.kind.${tone}`)
}

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
  // ── THE NOMINATIONS CHIP WAS UNREADABLE, IN BOTH THEMES, AND THIS IS THE FIX ───────
  // It was `bg-transparent text-brand-on-warm`, which is the pairs rule broken in the one
  // way that is not merely unchecked but INVISIBLE: `--brand-on-warm` is the foreground for
  // the warm FILL, and it is cream in light mode and near-black ink in dark — so on the page
  // ground it was cream-on-cream one way and ink-on-near-black the other. The chip rendered,
  // took up space, was a link, and had no visible text at all. Reported as "you cannot see
  // the text for nominations".
  //
  // The outline treatment is worth keeping, because the two halves of an election have to
  // read as one hue with the fill saying which is the consequential one — so what changes is
  // the FOREGROUND, to `--brand-warm` itself, which is the same tone `--brand-withheld` is
  // measured as a foreground with in both themes (5.10 on the card in light, 5.78 in dark;
  // globals.css records it beside the token). The 10% tint is what the removal panel already
  // does with the withheld token, and it is what stops an outline-only chip disappearing into
  // a cell it shares with the day number.
  nominations: 'border border-brand-warm bg-brand-warm/10 text-brand-warm',
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

/** The icon that says in a glyph what the tone says in colour. */
function ToneIcon({ tone }: { tone: EntryTone }) {
  if (tone === 'premier') return <Star aria-hidden="true" className="h-3 w-3 shrink-0" />
  if (tone === 'meeting') return <Gavel aria-hidden="true" className="h-3 w-3 shrink-0" />
  if (tone === 'nominations' || tone === 'voting') {
    return <Vote aria-hidden="true" className="h-3 w-3 shrink-0" />
  }
  return null
}

/**
 * ── THE GRID'S CELL GEOMETRY, AS A NUMBER, BECAUSE A BAR HAS TO BRIDGE IT ───────────
 * Each `<td>` below is `p-1` (4px a side) with a 1px `border-r`, so between one cell's
 * content box and the next there are 9px of chrome. A bar spanning n days is therefore
 * `n * 100% + (n - 1) * 9px` wide, where `100%` is one cell's content box: n cells plus the
 * n-1 gutters it crosses.
 *
 * IT IS DERIVED FROM THE CELL CLASSES AND MUST MOVE WITH THEM. Change `p-1` or the border
 * on the cell and every multi-day bar ends a few pixels short of, or past, its last day —
 * which reads as a rendering bug rather than as a spacing change. There is no way to make
 * CSS tell us this: `table-fixed` column widths are resolved by the layout engine.
 */
const CELL_GUTTER_PX = 4 + 4 + 1

/**
 * ONE CONTINUOUS BAR, spanning every day of its run within one week.
 *
 * ── IT IS ONE ELEMENT, WHICH IS THE WHOLE POINT ────────────────────────────────────
 * The obvious implementation is a chip per covered day with the sides squared off, and it
 * fails on the label: a box one day wide truncates its title to one day's width however long
 * the run is, so "Voting — Texas Region" reads as "Voting…" four times over. This is a single
 * anchor living in the cell its run STARTS in, given a width that reaches the end of the run
 * and allowed to overflow the cell to the right. One element, one label with room for it, one
 * hover target, one tab stop.
 *
 * The continuation days render an empty slot in the same lane, which is what reserves the
 * vertical space the bar passes through. `packWeek` in `lib/calendar.ts` is what guarantees no
 * other bar is ever assigned that lane while this run is in progress.
 *
 * ── WHY IT PAINTS OVER THE CELLS IT CROSSES ────────────────────────────────────────
 * CSS paints ALL table cell backgrounds and borders before ANY cell content, so an overflowing
 * child of one cell is already above the next cell's `bg-muted/30` and its `border-r`.
 * `relative` is belt: a positioned element paints in a later layer than in-flow content, so
 * the bar cannot be clipped behind a neighbour's fill even if a browser ordered it otherwise.
 *
 * ── THE ENDS SAY WHETHER THE RUN IS FINISHED OR CUT ────────────────────────────────
 * A rounded end means the entry genuinely starts or finishes there; a square end means the
 * week ran out. Rounding both ends of both halves of a four-day reunion would draw two
 * complete things where there is one — which is exactly the misreading this whole change is
 * about, moved from days to weeks.
 */
function EntryBar({ bar, t }: { bar: CalendarBar; t: T }) {
  const tone = toneOf(bar.entry)
  const cut = bar.continuesBefore || bar.continuesAfter
  // Said in words, because the shape of the ends is not available to a screen reader. "n
  // days" only where it is the WHOLE run: a cut bar's span is days-in-this-week, and calling
  // that the length would be wrong on the screen it is read from.
  const runWords = cut ? ', continuing' : bar.span > 1 ? `, ${bar.span} days` : ''
  return (
    <Link
      href={bar.entry.href}
      style={{ width: `calc(${bar.span} * 100% + ${(bar.span - 1) * CELL_GUTTER_PX}px)` }}
      className={cn(
        'relative flex h-5 items-center gap-1 overflow-hidden px-1.5 text-xs hover:opacity-90',
        ENTRY_TONE[tone],
        bar.continuesBefore ? 'rounded-s-none' : 'rounded-s',
        bar.continuesAfter ? 'rounded-e-none' : 'rounded-e',
      )}
      title={bar.entry.timeLabel
        ? `${bar.entry.title} · ${bar.entry.timeLabel}`
        : bar.entry.title}
    >
      <ToneIcon tone={tone} />
      {/* THE TIME IS IN THE HOVER TITLE AND THE SCREEN-READER RUN, NOT ON THE BAR ITSELF.
          A bar is `h-5` and already truncates its title, so a time rendered inside it would be
          the first thing cut off — a half-shown "11:0" is worse than no time at all. The agenda
          below has room and prints it; this keeps the grid legible at its own size. */}
      <span className="sr-only">
        {entryKindWord(t, tone)}{runWords}
        {bar.entry.timeLabel ? `, ${bar.entry.timeLabel}` : ''}:{' '}
      </span>
      {/* `min-w-0` is what lets a flex child shrink below its content, and without it the
          title would push the bar wider than the width set above and out past the table. */}
      <span className="min-w-0 truncate">{bar.entry.title}</span>
    </Link>
  )
}

/**
 * One entry on a day-list row, below `sm`.
 *
 * THE GRID DOES NOT USE THIS ANY MORE — `EntryBar` does. The day list is an AGENDA: one
 * titled row per day is what somebody scrolling a phone wants, and a two-day reunion
 * legitimately appears under both dates with its name on both. There is no span to draw
 * because there is no horizontal axis to draw it along.
 *
 * `truncate` inside a `min-w-0` block is what keeps a long title from widening its grid
 * track: without the `min-w-0` a flex or grid child refuses to shrink below its content and
 * the whole table pushes the page sideways, which is the one thing this screen must not do.
 */
function EntryChip({ entry, t }: { entry: CalendarEntry; t: T }) {
  const tone = toneOf(entry)
  return (
    <Link
      href={entry.href}
      className={cn(
        'block min-w-0 truncate rounded px-1.5 py-0.5 text-xs hover:opacity-90',
        ENTRY_TONE[tone],
      )}
      title={entry.timeLabel ? `${entry.title} · ${entry.timeLabel}` : entry.title}
    >
      {/* Wrapped so it is not an empty margin for a plain gathering, which has no glyph. */}
      {tone !== 'gathering' && (
        <span className="me-1 inline-flex align-[-2px]"><ToneIcon tone={tone} /></span>
      )}
      {/* Says in words what the colour says in colour. */}
      <span className="sr-only">{entryKindWord(t, tone)}: </span>
      {entry.title}
      {/* THE TIME, on the agenda only — see `EntryBar` for why the grid's bars carry it in
          their hover title instead. `opacity-80` rather than a muted token: this sits ON a
          filled tone, so a foreground from another pair is not a checked combination
          (AGENTS.md, "the pairs are load-bearing") and dimming the one that IS checked is the
          way to make it secondary without leaving the pair. */}
      {entry.timeLabel && (
        <span className="ms-1 opacity-80">· {entry.timeLabel}</span>
      )}
    </Link>
  )
}

/** Which adjacent month a leading or trailing day belongs to — for the day list, where a
 *  cell has no column to place it. `YYYY-MM` compares lexicographically. */
function adjacentCaption(day: CalendarDay, month: string, t: T): string | null {
  if (day.inMonth) return null
  return day.iso.slice(0, 7) < month ? t('cal.prevMonth') : t('cal.nextMonth')
}

export function MonthCalendar({ month, className, t, intl }: MonthCalendarProps) {
  const weekdays = weekdayNames(intl)
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
            aria-label={t('cal.goToMonth', { month: monthLabel(month.prevMonth, intl) })}
            className="inline-flex h-8 items-center gap-1 rounded-lg border px-2.5 text-sm text-foreground hover:bg-muted"
          >
            <ChevronLeft aria-hidden="true" className="h-4 w-4 rtl:-scale-x-100" />
            <span className="hidden sm:inline">{monthLabel(month.prevMonth, intl)}</span>
          </Link>
          {/* No `month` at all, so the page falls back to the current month. That is one
              fewer place that has to agree about what today is. */}
          <Link
            href="/gatherings/calendar"
            className="inline-flex h-8 items-center rounded-lg border px-2.5 text-sm text-foreground hover:bg-muted"
          >
            {t('cal.thisMonth')}
          </Link>
          <Link
            href={`/gatherings/calendar?month=${month.nextMonth}`}
            aria-label={t('cal.goToMonth', { month: monthLabel(month.nextMonth, intl) })}
            className="inline-flex h-8 items-center gap-1 rounded-lg border px-2.5 text-sm text-foreground hover:bg-muted"
          >
            <span className="hidden sm:inline">{monthLabel(month.nextMonth, intl)}</span>
            <ChevronRight aria-hidden="true" className="h-4 w-4 rtl:-scale-x-100" />
          </Link>
        </div>
      </div>

      {!hasEntries && (
        <p className="rounded-xl border bg-muted/40 px-4 py-6 text-sm text-muted-foreground">
          {t('cal.nothingInMonth', { month: month.label })}
        </p>
      )}

      {/* ── The grid, from `sm` up ─────────────────────────────────────────────── */}
      <div className="hidden overflow-hidden rounded-xl border sm:block">
        <table className="w-full table-fixed border-collapse text-sm">
          <caption className="sr-only">
            {t('cal.whatIsOnCaption', { month: month.label })}
          </caption>
          <thead>
            <tr className="border-b bg-muted/40 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              {weekdays.map(weekday => (
                <th key={weekday.long} scope="col" className="px-2 py-2 text-start font-semibold">
                  <span aria-hidden="true">{weekday.short}</span>
                  <span className="sr-only">{weekday.long}</span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {month.weeks.map(week => {
              // ── HOW MANY LANES THIS WEEK NEEDS, DERIVED PER WEEK ────────────────────
              // Every cell in the week reserves the same number of slots, and that is the
              // only reason a bar starting on Monday lines up with the empty space it
              // passes through on Tuesday. `packWeek` has already assigned the lanes; this
              // is just how many of them there turned out to be.
              //
              // A week with nothing on it reserves none, so an empty month is a grid of
              // dates rather than a grid of dates over blank rows.
              const lanes = week.reduce(
                (most, day) => day.bars.reduce((m, bar) => Math.max(m, bar.lane + 1), most),
                0,
              )
              return (
                <tr key={week[0].iso} className="border-b last:border-0">
                  {week.map(day => (
                    <td
                      key={day.iso}
                      // `h-24` on a cell is a MINIMUM in CSS, so a week with five lanes
                      // grows its row instead of clipping them — which is why nothing here
                      // caps the stack at three with a "+2 more" that has nowhere to lead.
                      className={cn(
                        'h-24 border-e p-1 align-top last:border-e-0',
                        !day.inMonth && 'bg-muted/30',
                        day.isToday && 'bg-brand-soft/30',
                      )}
                    >
                      {/* `h-5` IS LOAD-BEARING, NOT SPACING. Today's date is a 20px filled
                          circle and every other date is a 16px line of text, so without a
                          fixed height this row is 4px taller in one cell of the week — which
                          pushes that cell's lanes down and puts a visible step in the middle
                          of any bar crossing today. It did not matter while each cell held its
                          own chips; it matters now that a bar spans them. */}
                      <div className="flex h-5 items-center gap-1">
                        {day.isToday ? (
                          <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-brand-primary text-xs font-semibold text-brand-on-primary">
                            {day.dayOfMonth}
                            <span className="sr-only">{t('cal.todaySrOnly')}</span>
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
                      {lanes > 0 && (
                        <div className="mt-1">
                          {Array.from({ length: lanes }, (_, lane) => {
                            // At most one bar per lane per day — `packWeek` guarantees it —
                            // and `undefined` is a run passing through, or nothing at all.
                            const bar = day.bars.find(b => b.lane === lane)
                            return (
                              <div
                                key={lane}
                                // FIXED HEIGHT, NOT `min-h`. The slot is what a bar from an
                                // earlier day is passing over, so a slot that shrank when
                                // empty would break the alignment that makes the bar look
                                // continuous. `h-5` matches `EntryBar`'s own height exactly.
                                className={cn('h-5', lane > 0 && 'mt-0.5')}
                              >
                                {bar && <EntryBar bar={bar} t={t} />}
                              </div>
                            )
                          })}
                        </div>
                      )}
                    </td>
                  ))}
                </tr>
              )
            })}
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
              const adjacent = adjacentCaption(day, month.month, t)
              return (
                <li key={day.iso} className="flex gap-3 px-3 py-2.5">
                  <div className="w-12 shrink-0">
                    <p className="text-xs uppercase tracking-wide text-muted-foreground">
                      {weekdays[weekdayIndex].short}
                      <span className="sr-only">{` ${weekdays[weekdayIndex].long}`}</span>
                    </p>
                    {day.isToday ? (
                      <p className="mt-0.5">
                        <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-brand-primary text-sm font-semibold text-brand-on-primary">
                          {day.dayOfMonth}
                          <span className="sr-only">{t('cal.todaySrOnly')}</span>
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
                      <p className="text-sm text-muted-foreground">{t('cal.nothingToday')}</p>
                    ) : day.entries.map(entry => (
                      <EntryChip key={`${day.iso}:${entry.id}`} entry={entry} t={t} />
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
              {entryKindWord(t, tone)}
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
