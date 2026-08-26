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
 * `/gatherings/calendar` — one month, with the family's gatherings on the days they fall.
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
 * `requireView(user.id, 'gatherings/calendar')` is §1's preamble for the page itself. What goes ON the
 * calendar is governed by the two keys that own the underlying screens, and
 * `getCalendarMonth` resolves `gatherings:view` on its own, queries only
 * the sources the caller holds (§5 — not fetched rather than fetched-and-hidden) and reports
 * which halves actually made it onto the grid.
 *
 * A withheld source is stated in one line, because the alternative is the worst outcome
 * available on this screen: a member who cannot view gatherings reads an empty August as a fact
 * about their family. `sources` also goes false when a query FAILED — an empty result and a
 * refused query are indistinguishable from here (§8) — so the sentence names both
 * possibilities rather than asserting a permission problem it cannot actually see.
 */
export default async function CalendarPage({
  searchParams,
}: {
  // A Promise in this version of Next — see `/accounting/transactions`, which reads its `?ledger=` the
  // same way.
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>
}) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  await requireView(user.id, 'gatherings/calendar')

  const requested = (await searchParams).month
  // `?month=a&month=b` arrives as an array. Taking the first is the same recovery every other
  // page here makes for a hand-edited query string; an invalid one falls through to this month.
  const raw = Array.isArray(requested) ? requested[0] : requested
  const today = todayLocal()
  const month = isValidMonth(raw) ? raw : today.slice(0, 7)

  const { entries, sources } = await getCalendarMonth(month)
  const grid = buildCalendarMonth(month, today, entries)

  // A LIST OF ONE, kept as a list because `sources` is kept as a record — see the action's
  // header. A second source is a line here and nothing else.
  // ── WHAT IS NOT ON THE GRID, NAMED ─────────────────────────────────────────────────
  // Three sources now, and this listed one. Meetings had been a source for a day and
  // elections arrived on 2026-08-22; a member who cannot read either was shown a month with
  // nothing on it and a page that said nothing was missing, which is a calendar rendering an
  // empty August as a fact about the family.
  //
  // It says WHICH source is absent and never WHY. `sources` deliberately does not
  // distinguish "you were not granted this" from "the query failed" — see the action's
  // header — so a sentence claiming a reason would be a guess, and half the time a guess
  // about somebody's permissions.
  const withheld = [
    !sources.gatherings && 'gatherings',
    !sources.meetings && 'meetings',
    !sources.elections && 'elections',
  ].filter((label): label is string => typeof label === 'string')
  const withheldList = withheld.length === 1
    ? withheld[0]
    : `${withheld.slice(0, -1).join(', ')} or ${withheld[withheld.length - 1]}`

  return (
    <PageShell className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold">Calendar</h1>
      </div>

      {withheld.length > 0 && (
        <div className="rounded-xl border bg-muted/40 px-4 py-3 text-sm text-muted-foreground">
          {`This calendar does not include ${withheldList}, so what you see below is not the whole month: ${withheld.length === 1 ? 'that screen has' : 'those screens have'} either not been shared with you, or could not be read just now.`}
        </div>
      )}

      <MonthCalendar month={grid} />
    </PageShell>
  )
}
