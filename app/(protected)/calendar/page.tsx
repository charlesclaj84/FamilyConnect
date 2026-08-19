import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { requireView } from '@/lib/auth/permissions'
import { todayLocal } from '@/lib/date-utils'
import { buildCalendarMonth, isValidMonth } from '@/lib/calendar'
import { getCalendarMonth } from '@/app/actions/calendar'
import { PageShell } from '@/components/layout/PageShell'
import { MonthCalendar } from '@/components/calendar/MonthCalendar'

export const metadata = { title: 'Calendar' }

/**
 * `/calendar` — one month, with the family's gatherings and its events on the days they fall.
 *
 * ── THE MONTH IS NORMALISED BEFORE ANYTHING IN `lib/calendar.ts` IS CALLED ──────────
 * `monthLabel`, `shiftMonth` and `buildCalendarMonth` all THROW a `TypeError` on anything
 * that is not `YYYY-MM`, deliberately — a calendar that quietly shows August when the URL says
 * `2026-13` teaches a member that the URL is not read, and the previous-month link would then
 * point at "NaN-NaN". `month` arrives in the query string, so it is an arbitrary string, and
 * the one line below is what stands between it and four functions that refuse it:
 *
 *     const month = isValidMonth(requested) ? requested : todayLocal().slice(0, 7)
 *
 * `getCalendarMonth` validates it AGAIN before touching the database, which is not
 * belt-and-braces: it is a public HTTP endpoint like every other server action and cannot
 * trust this page to have called it.
 *
 * `today` needs no validation and gets none. `isToday` is an equality test against each day's
 * ISO string, so a garbled value would mark nothing rather than mark the wrong day — the one
 * thing on this screen that can degrade to absent without misinforming anybody.
 *
 * ── THE GRID IS BUILT ONCE, HERE, ON THE SERVER ─────────────────────────────────────
 * `buildCalendarMonth` is pure and takes `today` as a parameter, so the whole month walk is
 * done before anything reaches the browser and the two renderings inside `MonthCalendar` (the
 * seven-column grid, and the day list below `sm`) read the SAME `CalendarDay` objects. That is
 * what makes the mobile fallback a second view rather than a second implementation — the
 * component's header argues it out.
 *
 * ── ONE PAGE GRANT, TWO SOURCE GRANTS, AND `sources` IS WHY THE MONTH IS NOT A LIE ──
 * `requireView(user.id, 'calendar')` is §1's preamble for the page itself. What goes ON the
 * calendar is governed by the two keys that own the underlying screens, and
 * `getCalendarMonth` resolves `gatherings:view` and `events:view` independently, queries only
 * the sources the caller holds (§5 — not fetched rather than fetched-and-hidden) and reports
 * which halves actually made it onto the grid.
 *
 * A withheld source is stated in one line, because the alternative is the worst outcome
 * available on this screen: a member who cannot view events reads an empty August as a fact
 * about their family. `sources` also goes false when a query FAILED — an empty result and a
 * refused query are indistinguishable from here (§8) — so the sentence names both
 * possibilities rather than asserting a permission problem it cannot actually see.
 */
export default async function CalendarPage({
  searchParams,
}: {
  // A Promise in this version of Next — see `/transactions`, which reads its `?ledger=` the
  // same way.
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>
}) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  await requireView(user.id, 'calendar')

  const requested = (await searchParams).month
  // `?month=a&month=b` arrives as an array. Taking the first is the same recovery every other
  // page here makes for a hand-edited query string; an invalid one falls through to this month.
  const raw = Array.isArray(requested) ? requested[0] : requested
  const today = todayLocal()
  const month = isValidMonth(raw) ? raw : today.slice(0, 7)

  const { entries, sources } = await getCalendarMonth(month)
  const grid = buildCalendarMonth(month, today, entries)

  const withheld = [
    !sources.gatherings && 'gatherings',
    !sources.events && 'events',
  ].filter((label): label is string => typeof label === 'string')

  return (
    <PageShell className="space-y-8">
      <div>
        <h1 className="mb-1 text-3xl font-bold">Calendar</h1>
        <p className="text-muted-foreground">
          Every gathering and every event, a month at a time. A reunion that runs over several
          days shows on each of them, and the month is in the address bar — so a link to it is
          a link to that month.
        </p>
      </div>

      {withheld.length > 0 && (
        <div className="rounded-xl border bg-muted/40 px-4 py-3 text-sm text-muted-foreground">
          {withheld.length === 2
            ? 'Neither gatherings nor events are on this calendar, so what you see below is not the whole month: those screens have either not been shared with you, or could not be read just now.'
            : `This calendar does not include ${withheld[0]}, so what you see below is not the whole month: that screen has either not been shared with you, or could not be read just now.`}
        </div>
      )}

      <MonthCalendar month={grid} />
    </PageShell>
  )
}
