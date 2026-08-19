'use server'

import { requireRead } from '@/lib/auth/guard'
import { can } from '@/lib/auth/permissions'
import { isFeatureLive } from '@/lib/features'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { isValidMonth, type CalendarEntry } from '@/lib/calendar'

/**
 * One month of the family calendar — `/calendar`.
 *
 * The page draws the grid with `buildCalendarMonth` from `lib/calendar.ts`; this is the read
 * that fills it, and the only thing it does is turn two DIFFERENT products into one list of
 * `CalendarEntry`. Gatherings and Events are deliberately parallel features (see the spec and
 * `lib/gatherings.ts`), and this is the one place in the app that shows them together.
 *
 * ── THREE GRANTS, RESOLVED SEPARATELY, AND WHY `sources` IS IN THE RETURN ──────────
 * `calendar:view` is the page's own key: without it there is no calendar. What goes ON it is
 * governed by the two keys that own the underlying screens — `gatherings:view` and
 * `events:view` — and a family can restrict either. Folding those into one answer would mean
 * a member who may see gatherings but not events reads an August with three entries as the
 * whole of August. So each source is resolved independently, only the sources the caller
 * holds are QUERIED (§5 — gate the fetch, not the band), and `sources` reports which halves
 * are actually on the grid so the page can say one line about the one that is not.
 *
 * `sources` answers "is this source on the grid", NOT "why not". A source is false when the
 * caller lacks the grant, when the feature is not live, and — importantly — when the query
 * failed: a source that produced nothing because PostgREST refused it must never report
 * itself as shown, or the page renders an empty month as a fact about the family (§8).
 *
 * ── THE ONE ASYMMETRY A READER WILL THINK IS A MISTAKE ─────────────────────────────
 * Gatherings are read on the USER client and events on the ADMIN client, and both are
 * deliberate:
 *
 *   * `gatherings` has a composed SELECT policy whose `own_expr` is
 *     `created_by = auth_person_id()`, so RLS narrows a caller holding `gatherings:view` at
 *     scope 'own' to their own gatherings — exactly, and with no hand-written scoping to get
 *     wrong. That also means this can never put an entry on the calendar whose detail page
 *     would then answer 404, which is the worst thing a calendar can do.
 *   * `events` is read the way `/events` itself reads it: `getUpcomingEvents` and
 *     `getEventDetail` both use the admin client with a `family_code` conjunct, so a
 *     user-client read here would show an 'own'-scope caller FEWER events on the calendar
 *     than the Events screen shows them the same minute. Two screens disagreeing about which
 *     events exist is worse than matching the shipped behaviour, and widening or narrowing
 *     what `/events` shows is a decision for Events, not for its calendar view. Nothing under
 *     `events*` is touched by this feature. §3's obligation is discharged by hand on that
 *     query, and the grant was resolved above.
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
  events: boolean
}

export interface CalendarMonthData {
  entries: CalendarEntry[]
  sources: CalendarSources
}

/**
 * Nothing on the grid, and BOTH SOURCES REPORTED AS NOT SHOWN.
 *
 * This is returned for three different reasons — a caller who holds `calendar:view` and neither
 * source, a caller who holds nothing at all, and a `month` that is not `YYYY-MM` — and the
 * return type deliberately does not distinguish them. `sources` answers "is this source on the
 * grid", never "why not", so the page must not grow a sentence that claims a reason: for the
 * withheld-source case it is honest ("gatherings are not shown"), and for a malformed month it
 * would be a lie about the caller's permissions.
 *
 * That last case is not reachable from the page. `/calendar` normalises the query string before
 * it calls — `isValidMonth(raw) ? raw : today.slice(0, 7)` — because `buildCalendarMonth`
 * and `monthLabel` THROW on anything else, so only a direct POST to this action's URL can get
 * here with a bad month. A server action is a public HTTP endpoint, which is why the check below
 * exists at all; it is not a case the UI has to render. **If the page's normalisation is ever
 * dropped, this needs a third state before the page can say anything about a source being
 * missing.**
 */
const NOTHING: CalendarMonthData = { entries: [], sources: { gatherings: false, events: false } }

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
 * ONE SPAN RULE FOR BOTH SOURCES, which is why it is a function rather than two filters. The
 * last day of a span is `endsOn` when there is one and it is genuinely later, and the start
 * day otherwise — the same reading `spanEnd` in `lib/calendar.ts` and `gatheringTiming` in
 * `lib/gatherings.ts` both take, so a one-day entry is never dropped and a row whose end
 * somehow precedes its start still appears on the day it starts.
 */
function overlaps(startsOn: string, endsOn: string | null, from: string, to: string): boolean {
  const last = endsOn && endsOn > startsOn ? endsOn : startsOn
  return startsOn <= to && last >= from
}

/** The two row shapes below, declared rather than inferred — the client is untyped. */
interface GatheringRow {
  id: string
  title: string
  starts_on: string
  ends_on: string | null
  is_premier: boolean
}

interface EventRow {
  id: string
  name: string
  event_date: string | null
  start_date: string | null
  end_date: string | null
}

export async function getCalendarMonth(month: string): Promise<CalendarMonthData> {
  // BEFORE THE DATABASE IS TOUCHED. `month` arrives in the query string — `/calendar` is
  // addressable and bookmarkable on purpose — so it is an arbitrary string, and every date
  // bound below is derived from it. `isValidMonth` pins the month RANGE as well as the shape,
  // so "2026-13" is refused here rather than becoming January 2027 in a `Date.UTC` call.
  if (!isValidMonth(month)) return NOTHING

  const g = await requireRead('calendar')
  if (!g.ok) return NOTHING

  // INDEPENDENTLY, per the header. `can()` rather than `canAny()`: scope 'own' is a
  // legitimate way to hold view on both of these — both tables have an owner — and the
  // gathering query below honours it through RLS.
  //
  // `isFeatureLive` is asked as well as the grant, because a source whose route serves
  // Coming Soon must not be linked from here: a cell linking to `/events/<id>` when `/events`
  // is gated at the edge is a link to a screen the member cannot open. Both are live today,
  // so this costs nothing and is what keeps the calendar honest if one ever goes back.
  const [mayGatherings, mayEvents] = await Promise.all([
    isFeatureLive('/gatherings') ? can(g.userId, 'gatherings', 'view') : Promise.resolve(false),
    isFeatureLive('/events') ? can(g.userId, 'events', 'view') : Promise.resolve(false),
  ])

  const { from, to } = gridWindow(month)
  const entries: CalendarEntry[] = []
  const sources: CalendarSources = { gatherings: mayGatherings, events: mayEvents }

  const supabase = await createClient()

  const [gatheringRes, eventRes] = await Promise.all([
    // NOT FETCHED rather than fetched-and-filtered: props are serialized into the RSC
    // payload whether the grid renders them or not (§5).
    mayGatherings
      ? supabase
        .from('gatherings')
        .select('id, title, starts_on, ends_on, is_premier')
        // The far side of the overlap, in SQL, because it is a pure narrowing: a gathering
        // starting after the window ends cannot touch it. The near side needs the
        // `ends_on`-or-`starts_on` coalesce and is applied in TypeScript below, once, by the
        // same helper the events half uses — one span rule, not two.
        .lte('starts_on', to)
        // A CANCELLED gathering is not happening, and this grid answers "what is on". It is
        // not hidden from the family: `/gatherings` lists it with its status pill, which is
        // the screen that owns that question. Same call `/events` makes by publishing only
        // 'published' and 'approved'. 'planning' DOES appear — a reunion being planned has
        // real dates and the family needs to see them.
        .neq('status', 'cancelled')
      : Promise.resolve({ data: null, error: null }),

    mayEvents
      // §3: the admin client applies no RLS, so the family conjunct below is the whole of
      // the isolation on this query.
      ? createAdminClient()
        .from('events')
        .select('id, name, event_date, start_date, end_date')
        .eq('family_code', g.familyCode)
        // The same three filters `getUpcomingEvents` uses, so the calendar and `/events`
        // cannot disagree about which events a family has. Sub-events are excluded with it:
        // they hang off a parent that is already on the grid, and drawing both would put two
        // entries on one day for one thing.
        .in('status', ['published', 'approved'])
        .is('parent_event_id', null)
      : Promise.resolve({ data: null, error: null }),
  ])

  if (mayGatherings) {
    if (gatheringRes.error) {
      // §8: a refused query returns no rows, and reporting the source as shown would render
      // an empty month as a fact. Logged, and the source is marked withheld so the page says
      // something is missing.
      console.error(`[calendar] gatherings read failed for ${g.familyCode} ${month}: ${gatheringRes.error.message}`)
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

  if (mayEvents) {
    if (eventRes.error) {
      console.error(`[calendar] events read failed for ${g.familyCode} ${month}: ${eventRes.error.message}`)
      sources.events = false
    } else {
      for (const row of (eventRes.data ?? []) as unknown as EventRow[]) {
        // `start_date`/`end_date` SUPERSEDE the legacy `event_date`, which is why the
        // fallback runs in that order — `getUpcomingEvents` decides an event's end the same
        // way, and the two must not disagree about which day an event is on.
        //
        // An event with NO date at all is a real row ("Date TBD") and is SKIPPED here rather
        // than placed: a list can print "Date TBD", a grid has no cell for it. It stays on
        // `/events`, which is where a member finds it.
        const startsOn = row.start_date ?? row.event_date
        if (!startsOn) continue
        const endsOn = row.end_date ?? null
        // No SQL date bound on the events query, deliberately: the span is coalesced across
        // three nullable columns, which no PostgREST filter expresses without an `.or()` that
        // has to be right about NULLs in every branch — and a subtly wrong one silently drops
        // rows. One family's events, projected to five columns, is a small read, and this is
        // the same place `getUpcomingEvents` makes the same decision.
        if (!overlaps(startsOn, endsOn, from, to)) continue
        entries.push({
          id:       row.id,
          title:    row.name,
          startsOn,
          endsOn,
          kind:     'event',
          href:     `/events/${row.id}`,
        })
      }
    }
  }

  // Unsorted on purpose. `buildCalendarMonth` imposes a total order per day (earliest start,
  // then title, then id) so two renders of the same data cannot disagree; sorting here as
  // well would be a second ordering rule that only appears to matter.
  return { entries, sources }
}
