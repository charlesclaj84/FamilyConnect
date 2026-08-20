'use client'

import { useState } from 'react'
import { Cake, Search } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { COLLAPSING_CELL, RowMeta, MetaDot } from '@/components/ui/table-collapse'
import { cn } from '@/lib/utils'
import { formatDate } from '@/lib/date-utils'
import { matchesPersonQuery } from '@/lib/person-search'
import {
  BIRTHDAY_HORIZON_DAYS, birthdayWeekday, type UpcomingBirthday,
} from '@/lib/birthdays'

/**
 * THE BIRTHDAYS PANE — the second half of `/community/announcements`.
 *
 * ── WHAT IT PRINTS, AND WHY EVERY ONE OF THE FIVE FACTS IS THERE ────────────────────
 * A name, a date, the DAY OF THE WEEK, how many days away, and the age they turn. The
 * weekday is the one that looks like decoration and is not: a birthday is acted on by
 * ringing somebody or putting a card in the post, and both of those are planned against a
 * weekend rather than against the 14th. "Saturday" is what turns this list from a fact into
 * something an organizer can do — which is also why it is the fact this pane had to reach
 * outside `formatDate` for (see below).
 *
 * ── IT COMPUTES NOTHING ABOUT DATES, AND THAT IS THE POINT ──────────────────────────
 * Every date decision — the leap-day clamp, the year boundary, whether today counts, whether
 * a stored year can be trusted — is `lib/birthdays.ts`, which takes `today` as a parameter
 * and is tested by mutation (AGENTS.md §7b). This component is handed the answer already
 * sorted, soonest first, and its whole job is to draw it. Resist adding a `new Date()` here:
 * a component is the one place in this product where a date cannot be tested, and the two
 * halves of a date bug living in two files is how a product ends up with two answers.
 *
 * `birthdayWeekday` IS CALLED HERE, and that is sanctioned rather than a hole in the rule.
 * It exists precisely so this line is not
 * `new Date(onDate).toLocaleDateString(undefined, { weekday: 'long' })`, which reads a UTC
 * midnight in the browser's own zone and so prints "Monday" beside a date that says
 * "February 28th" for every reader west of Greenwich. The module pins `timeZone: 'UTC'`,
 * which is what makes the weekday agree with the string it came from.
 *
 * ── IT THROWS, AND NOTHING HERE CAN MAKE IT ─────────────────────────────────────────
 * `birthdayWeekday` refuses a date it cannot read, by design: the only strings it is ever
 * handed are `onDate` values `upcomingBirthdays` built with `isoOf`, from a year it has
 * already refused to let below 100. So the throw is unreachable from this file, and the
 * invariant that keeps it unreachable is worth stating because a future edit could break it
 * in one line: NOTHING TYPED BY A MEMBER MAY EVER REACH THAT FUNCTION. The filter box below
 * holds the only user-typed string in this component and it goes to `matchesPersonQuery` and
 * nowhere else.
 *
 * ── THERE IS A FILTER, AND THE FAMILY OF 150 IS WHY ─────────────────────────────────
 * AGENTS.md, "Build every member list for a hundred-member family": a table of members gets
 * a filter box, and the Member Directory is the worked example. The arithmetic that makes it
 * worth having here is that this pane's length is not the family's size, it is the family's
 * size times 60/365 — so twelve relatives produce two rows and a hundred and fifty produce
 * about twenty-five, in an order (soonest first) that is deliberately NOT alphabetical. That
 * is the shape a filter is for: the list answers "who is next" by scanning, and "is Aunt
 * Martha coming up?" only by searching, because her row is wherever her date put it.
 *
 * It is shown whenever there is a row and hidden only over the empty state, rather than
 * appearing above some chosen row count. A threshold would be a number nobody chose, and it
 * would make the control flicker in and out as birthdays rolled past the horizon — the same
 * argument `lib/birthdays.ts` makes for refusing an upper bound on a plausible age.
 *
 * `matchesPersonQuery` from `lib/person-search.ts`, never a `.includes()` of its own: that
 * module is where the accent and punctuation folding lives ("jose" finds the accented José,
 * "oconnor" finds O'Connor), and AGENTS.md's known-gaps list records what happens when the
 * rule is re-typed inside a component instead — the Directory got the folding and the photo
 * tagger did not.
 *
 * ── NO `disambiguatedName`, AND THAT IS A DECISION RATHER THAN AN OMISSION ───────────
 * Every other member list in this product prints the disambiguated name, and this one cannot
 * honestly: `UpcomingBirthday` carries neither a nickname nor the raw `date_of_birth`, and —
 * the deciding half — this pane holds a SIXTY-DAY SLICE rather than the roster, so a
 * disambiguation scored against it would be scored against the wrong population. That is the
 * exact mistake AGENTS.md names for `PersonMultiSelect` ("computed against the whole roster —
 * never the filtered subset"), which would make two Martha Allens read as unambiguous here
 * precisely because only one of them has a birthday this month.
 *
 * What saves it is that the ROW is already the disambiguator: two people with one name are
 * told apart by the date and the age printed beside it, which are the two facts
 * `disambiguatedName` would have reached for anyway. If it is ever wanted properly, the
 * nickname belongs in `BirthdayPerson` and the scoring belongs in the action that holds the
 * whole roster.
 *
 * ── NO `useServerState`, ON PURPOSE ─────────────────────────────────────────────────
 * Nothing here is written back and nothing here mutates: the list is a derived read, so there
 * is no local copy of a family-scoped prop to go stale (AGENTS.md, "Switching family remounts
 * the page"). The one piece of state is the filter string, which is the genuinely UI-local
 * kind that section explicitly exempts — the same standing as which nav section is expanded.
 */
export function BirthdaysPane({ birthdays }: { birthdays: UpcomingBirthday[] }) {
  const [query, setQuery] = useState('')

  const filtered = birthdays.filter(b => matchesPersonQuery(
    { first_name: b.firstName, last_name: b.lastName },
    `${b.firstName} ${b.lastName}`,
    query,
  ))

  // Whether the sentence under the table is worth printing at all — see it below. Measured
  // over the WHOLE list rather than the filtered one, so the explanation for an em-dash does
  // not vanish the moment a search hides the row that needed it.
  const someAgeWithheld = birthdays.some(b => b.turning === null)

  if (birthdays.length === 0) {
    // A SENTENCE, NEVER AN EMPTY TABLE. A heading row over nothing reads as a screen that
    // failed to load; this reads as an answer. The horizon is interpolated from
    // BIRTHDAY_HORIZON_DAYS rather than typed, because a hand-written "60" here is a
    // sentence that eventually disagrees with the list it sits over.
    return (
      <p className="rounded-xl border bg-muted/40 px-4 py-6 text-sm text-muted-foreground">
        Nobody in the family has a birthday in the next {BIRTHDAY_HORIZON_DAYS} days. Birthdays
        are read from each relative&apos;s date of birth on their profile, so a missing one is a
        profile to fill in rather than a date that is not coming.
      </p>
    )
  }

  return (
    <div className="space-y-4">
      <div className="relative sm:max-w-xs">
        <Search className="pointer-events-none absolute left-2.5 top-2 h-4 w-4 text-muted-foreground" />
        {/* `aria-label` rather than a visible label: the placeholder says what it is, and a
            label above a single filter box over a table is a line of chrome between the rail
            and the answer. Not the same case as a form field, which owes a real <Label>. */}
        <Input
          aria-label="Search birthdays by name"
          placeholder="Search by name…"
          value={query}
          onChange={e => setQuery(e.target.value)}
          className="pl-8"
        />
      </div>

      {filtered.length === 0 ? (
        <p className="rounded-xl border bg-muted/40 px-4 py-6 text-sm text-muted-foreground">
          No birthday in the next {BIRTHDAY_HORIZON_DAYS} days matches that name.
        </p>
      ) : (
        // `overflow-visible`, with no `overflow-x-auto` and no `min-w-*` floor: the table
        // NARROWS on a phone rather than scrolling sideways, which is what COLLAPSING_CELL
        // and the RowMeta below implement (AGENTS.md, "On a phone a table narrows").
        <div className="overflow-visible rounded-xl border">
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className="border-b bg-muted/40 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                <th scope="col" className="px-3 py-2 font-semibold">Name</th>
                <th scope="col" className="px-3 py-2 font-semibold">Date</th>
                {/* The two folded columns, and each `<th>` folds WITH its cells — hide two
                    cells behind five headings and every remaining cell is announced under the
                    wrong column. `display: none` takes both out of the accessibility tree,
                    which is what keeps the narrow table coherent. Name, Date and Countdown
                    stay because they are what the table answers: who, when, and how soon. */}
                <th scope="col" className={cn('px-3 py-2 font-semibold', COLLAPSING_CELL)}>Day</th>
                <th scope="col" className="px-3 py-2 font-semibold">Countdown</th>
                <th scope="col" className={cn('px-3 py-2 font-semibold', COLLAPSING_CELL)}>Turning</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(b => {
                const weekday = birthdayWeekday(b.onDate)
                return (
                  <tr key={b.id} className="border-b align-top last:border-0 sm:align-middle">
                    <td className="px-3 py-2.5">
                      <span className="font-medium">{b.firstName} {b.lastName}</span>
                      {/* What the two folded columns say once they are gone. "Turning" keeps
                          its label because the heading was doing the work — a bare "41" under
                          a date is not self-evident — while "Saturday" needs none. */}
                      <RowMeta className="gap-x-2">
                        <span>{weekday}</span>
                        {b.turning !== null && (
                          <>
                            <MetaDot />
                            <span>Turning {b.turning}</span>
                          </>
                        )}
                      </RowMeta>
                    </td>
                    <td className="px-3 py-2.5 text-muted-foreground">{formatDate(b.onDate)}</td>
                    <td className={cn('px-3 py-2.5 text-muted-foreground', COLLAPSING_CELL)}>
                      {weekday}
                    </td>
                    <td className="px-3 py-2.5">
                      {/* TODAY IS MARKED, because it is the one row the pane exists to catch
                          and it is indistinguishable from "in 2 days" as grey text. The gold
                          attention pill — `bg-brand-legacy text-brand-on-legacy`, the pair
                          globals.css measures at 6.14 in BOTH themes — is what "Pending" and
                          "Nominations open" already wear, so this reads as the same kind of
                          look-at-this rather than as a new colour. Deliberately not
                          `--brand-affirm` (that is create, record, pay) and emphatically not
                          `--destructive`: nothing failed here. */}
                      {b.daysAway === 0 ? (
                        <span className="inline-flex items-center gap-1 rounded-full bg-brand-legacy px-2 py-0.5 text-xs font-semibold text-brand-on-legacy">
                          <Cake className="h-3 w-3" aria-hidden="true" /> Today
                        </span>
                      ) : (
                        <span className="text-muted-foreground">
                          {b.daysAway === 1 ? 'Tomorrow' : `in ${b.daysAway} days`}
                        </span>
                      )}
                    </td>
                    <td className={cn('px-3 py-2.5 text-muted-foreground', COLLAPSING_CELL)}>
                      {/* An em-dash rather than a guess. `turning` is null when the stored
                          year is one the arithmetic will not trust — a 2062 typed for 1962, or
                          a date of birth in the future — and the module's decision is to
                          withhold the AGE while still printing the day and the month, because
                          a four-digit typo is a typo in the year. Never print a nonsense age,
                          and never drop the row. */}
                      {b.turning ?? '—'}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* AN HONEST COUNT, which is `PersonMultiSelect`'s rule applied to a table: a list
          showing eleven of twenty-five rows must say so, or somebody concludes a relative is
          not in the family. Nothing is truncated here — every matching row is rendered, so
          the only thing that ever hides one is the search box above. */}
      <p className="text-xs text-muted-foreground">
        {query
          ? `${filtered.length} of ${birthdays.length} shown`
          : `${birthdays.length} birthday${birthdays.length === 1 ? '' : 's'} in the next ${BIRTHDAY_HORIZON_DAYS} days`}
        {someAgeWithheld && ' · an age is left out where the year on file cannot be trusted'}
      </p>
    </div>
  )
}
