'use server'

import { requireRead } from '@/lib/auth/guard'
import { can } from '@/lib/auth/permissions'
import { isFeatureLive } from '@/lib/features'
import { createClient } from '@/lib/supabase/server'
import { isValidMonth, type CalendarEntry } from '@/lib/calendar'

/**
 * One month of the family calendar — `/calendar`.
 *
 * The page draws the grid with `buildCalendarMonth` from `lib/calendar.ts`; this is the read
 * that fills it, and all it does is turn the family's gatherings into a list of
 * `CalendarEntry`.
 *
 * ── IT READ TWO PRODUCTS UNTIL 2026-08-19 ──────────────────────────────────────────
 * Events was the other, and it is retired — routes, actions, components and permission rows
 * all deleted. What survives from that arrangement is the SHAPE, and it survives on purpose:
 * `sources` is still a record rather than a boolean, the grant is still resolved per source,
 * and the query is still skipped rather than filtered. A second source — a birthday, a dues
 * date — plugs into that with no re-plumbing, whereas dissolving it into `if (!can) return []`
 * would have to be undone the first time one arrives.
 *
 * ── TWO GRANTS, RESOLVED SEPARATELY, AND WHY `sources` IS IN THE RETURN ────────────
 * `calendar:view` is the page's own key: without it there is no calendar. What goes ON it is
 * governed by the key that owns the underlying screen — `gatherings:view` — and a family can
 * restrict that independently. Folding the two into one answer would mean a member who holds
 * the calendar and not gatherings reads an empty August as the whole of August. So the source
 * is resolved on its own, only QUERIED when held (§5 — gate the fetch, not the band), and
 * `sources` reports whether it is actually on the grid so the page can say one line when it
 * is not.
 *
 * `sources` answers "is this source on the grid", NOT "why not". A source is false when the
 * caller lacks the grant, when the feature is not live, and — importantly — when the query
 * failed: a source that produced nothing because PostgREST refused it must never report
 * itself as shown, or the page renders an empty month as a fact about the family (§8).
 *
 * ── THE USER CLIENT, NOT THE ADMIN ONE ─────────────────────────────────────────────
 * `gatherings` has a composed SELECT policy whose `own_expr` is `created_by =
 * auth_person_id()`, so RLS narrows a caller holding `gatherings:view` at scope 'own' to
 * their own gatherings — exactly, and with no hand-written scoping to get wrong. That also
 * means this can never put an entry on the calendar whose detail page would then answer 404,
 * which is the worst thing a calendar can do.
 *
 * ── QUERY BY OVERLAP, NOT BY EQUALITY, AND OVER THE GRID RATHER THAN THE MONTH ─────
 * A reunion that starts on 28 July and ends on 2 August belongs in both months, so the test
 * is span-overlap and never `starts_on LIKE '2026-08%'`. And the window is the GRID's, not
 * the month's: `buildCalendarMonth` renders whole weeks and puts entries on the leading and
 * trailing days of the adjacent months on purpose ("a reunion starting on the 1st of
 * September has to be visible in the last row of August"). A fetch bounded by the month
 * itself would leave those cells empty while the pure module promises otherwise — a calendar
 * hiding something it is already showing the day of. Six days either side is exactly the most
 * a Sunday-first month grid can reach.
 *
 * ── EVERY DATE COMPARISON IS ON `YYYY-MM-DD` STRINGS ───────────────────────────────
 * `lib/calendar.ts`'s header states the reason at length and it applies verbatim here:
 * `new Date('2026-08-01')` is UTC midnight and prints as 31 July in any negative offset. The
 * only `Date` in this file is a `Date.UTC` instant read back through `getUTC*` to compute the
 * window's two ends, which is the one arithmetic a Date is trustworthy for.
 */

/** Which halves of the calendar are actually on the grid — see the header. */
export interface CalendarSources {
  gatherings: boolean
}

export interface CalendarMonthData {
  entries: CalendarEntry[]
  sources: CalendarSources
}

/**
 * Nothing on the grid, and THE SOURCE REPORTED AS NOT SHOWN.
 *
 * This is returned for three different reasons — a caller who holds `calendar:view` and not
 * `gatherings:view`, a caller who holds nothing at all, and a `month` that is not `YYYY-MM` —
 * and the return type deliberately does not distinguish them. `sources` answers "is this
 * source on the grid", never "why not", so the page must not grow a sentence that claims a
 * reason: for the withheld-source case it is honest ("gatherings are not shown"), and for a
 * malformed month it would be a lie about the caller's permissions.
 *
 * That last case is not reachable from the page. `/calendar` normalises the query string before
 * it calls — `isValidMonth(raw) ? raw : today.slice(0, 7)` — because `buildCalendarMonth`
 * and `monthLabel` THROW on anything else, so only a direct POST to this action's URL can get
 * here with a bad month. A server action is a public HTTP endpoint, which is why the check below
 * exists at all; it is not a case the UI has to render. **If the page's normalisation is ever
 * dropped, this needs a third state before the page can say anything about a source being
 * missing.**
 */
const NOTHING: CalendarMonthData = { entries: [], sources: { gatherings: false } }

/** `YYYY-MM-DD` from a UTC instant, read through `getUTC*` for the reason in the header. */
function isoOf(date: Date): string {
  return [
    String(date.getUTCFullYear()).padStart(4, '0'),
    String(date.getUTCMonth() + 1).padStart(2, '0'),
    String(date.getUTCDate()).padStart(2, '0'),
  ].join('-')
}

/**
 * The first and last day the month's grid can show.
 *
 * Day `1 - 6` of the month is six days before the 1st, and day `6` of the NEXT month is six
 * days after this month's last (day 0 of the next month IS the last day of this one, by
 * definition). `Date.UTC` resolves both across the month boundary exactly, so there is no
 * month-length table here and February 2028 needs no special case. Adding DAYS this way is
 * safe; adding MONTHS is what overflows, which is why `shiftMonth` exists and works on
 * integers instead.
 */
function gridWindow(month: string): { from: string; to: string } {
  const [year, monthNumber] = month.split('-').map(Number)
  const monthIndex = monthNumber - 1
  return {
    from: isoOf(new Date(Date.UTC(year, monthIndex, 1 - 6))),
    to:   isoOf(new Date(Date.UTC(year, monthIndex + 1, 6))),
  }
}

/**
 * Does this span touch the window at all? Inclusive at both ends.
 *
 * ONE SPAN RULE, kept as a function rather than inlined for the reason `sources` is kept as a
 * record: a second source gets the same reading of a span for free. The last day of a span is
 * `endsOn` when there is one and it is genuinely later, and the start day otherwise — the same
 * reading `spanEnd` in `lib/calendar.ts` and `gatheringTiming` in `lib/gatherings.ts` both
 * take, so a one-day entry is never dropped and a row whose end somehow precedes its start
 * still appears on the day it starts.
 */
function overlaps(startsOn: string, endsOn: string | null, from: string, to: string): boolean {
  const last = endsOn && endsOn > startsOn ? endsOn : startsOn
  return startsOn <= to && last >= from
}

/** The row shape below, declared rather than inferred — the client is untyped. */
interface GatheringRow {
  id: string
  title: string
  starts_on: string
  ends_on: string | null
  is_premier: boolean
}

export async function getCalendarMonth(month: string): Promise<CalendarMonthData> {
  // BEFORE THE DATABASE IS TOUCHED. `month` arrives in the query string — `/calendar` is
  // addressable and bookmarkable on purpose — so it is an arbitrary string, and every date
  // bound below is derived from it. `isValidMonth` pins the month RANGE as well as the shape,
  // so "2026-13" is refused here rather than becoming January 2027 in a `Date.UTC` call.
  if (!isValidMonth(month)) return NOTHING

  const g = await requireRead('calendar')
  if (!g.ok) return NOTHING

  // `can()` rather than `canAny()`: scope 'own' is a legitimate way to hold view here — the
  // table has a real owner — and the query below honours it through RLS.
  //
  // `isFeatureLive` is asked as well as the grant, because a source whose route serves Coming
  // Soon must not be linked from here: a cell linking to `/gatherings/<id>` when `/gatherings`
  // is gated at the edge is a link to a screen the member cannot open. It is live today, so
  // this costs nothing and is what keeps the calendar honest if it ever goes back.
  const mayGatherings = isFeatureLive('/gatherings')
    ? await can(g.userId, 'gatherings', 'view')
    : false

  const { from, to } = gridWindow(month)
  const entries: CalendarEntry[] = []
  const sources: CalendarSources = { gatherings: mayGatherings }

  const supabase = await createClient()

  // NOT FETCHED rather than fetched-and-filtered: props are serialized into the RSC payload
  // whether the grid renders them or not (§5).
  const gatheringRes = mayGatherings
    ? await supabase
      .from('gatherings')
      .select('id, title, starts_on, ends_on, is_premier')
      // The far side of the overlap, in SQL, because it is a pure narrowing: a gathering
      // starting after the window ends cannot touch it. The near side needs the
      // `ends_on`-or-`starts_on` coalesce and is applied in TypeScript below by `overlaps` —
      // one span rule, not two.
      .lte('starts_on', to)
      // A CANCELLED gathering is not happening, and this grid answers "what is on". It is not
      // hidden from the family: `/gatherings` lists it with its status pill, which is the
      // screen that owns that question. 'planning' DOES appear — a reunion being planned has
      // real dates and the family needs to see them.
      .neq('status', 'cancelled')
    : { data: null, error: null }

  if (mayGatherings) {
    if (gatheringRes.error) {
      // §8: a refused query returns no rows, and reporting the source as shown would render
      // an empty month as a fact. Logged, and the source is marked withheld so the page says
      // something is missing.
      console.error(
        `[calendar] gatherings read failed for ${g.familyCode} ${month}: ${gatheringRes.error.message}`,
      )
      sources.gatherings = false
    } else {
      for (const row of (gatheringRes.data ?? []) as unknown as GatheringRow[]) {
        if (!row.starts_on || !overlaps(row.starts_on, row.ends_on ?? null, from, to)) continue
        entries.push({
          id:        row.id,
          title:     row.title,
          startsOn:  row.starts_on,
          endsOn:    row.ends_on ?? null,
          kind:      'gathering',
          href:      `/gatherings/${row.id}`,
          isPremier: row.is_premier,
        })
      }
    }
  }

  // Unsorted on purpose. `buildCalendarMonth` imposes a total order per day (earliest start,
  // then title, then id) so two renders of the same data cannot disagree; sorting here as
  // well would be a second ordering rule that only appears to matter.
  return { entries, sources }
}
