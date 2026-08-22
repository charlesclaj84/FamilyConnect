import type { CalendarEntry } from '@/lib/calendar'

/**
 * Turning one election into the entries that go on the family calendar.
 *
 * ── WHY IT IS HERE AND NOT IN `app/actions/calendar.ts` ────────────────────────────────
 * AGENTS.md §7b: the RLS suite calls actions for real against real policies and cannot check
 * a figure, so arithmetic and date handling live in a pure module under `lib/` where `npm
 * test` can reach them. This function is entirely dates and null-handling — exactly the
 * "dates, money, rounding" case that rule names — and it has two invariants that are worth
 * pinning down rather than reasoning about: which windows are skipped, and that the two
 * entries of one election never share an id.
 *
 * It takes no `today` and reads nothing from the world, so there is nothing to inject.
 */

/**
 * ONE ELECTION, UP TO TWO ENTRIES: the nomination window and the voting window.
 *
 * They are two entries rather than one span from the first date to the last because the two
 * are different things a member DOES, they are always disjoint (`voting_open_on >
 * nominations_close_on` is a CHECK on the table), and the gap between them is real — a slate
 * closed and nothing to do yet. One chip stretched across the lot would say "election" on a
 * day when the answer to "what do I do today" is "nothing".
 *
 * BOTH ENDS ARE INCLUSIVE, which is the table's own reading: `20260821000001` states that
 * nominations are open THROUGH `nominations_close_on` and the last day anybody can vote is
 * `voting_close_on`. `overlaps` and `buildCalendarMonth` both treat a span's end inclusively,
 * so this needs no adjustment — but a future change that makes either exclusive has to change
 * both, or the last day of every window silently drops off the grid.
 *
 * A WINDOW WITH A MISSING DATE IS SKIPPED RATHER THAN GUESSED. Publishing requires all four
 * (the four-way CHECK in `20260821000001`), so this cannot happen for a published election
 * today; the guard is here because the columns are nullable and a draft is one schema change
 * away from reaching this code.
 *
 * THE ID IS SUFFIXED. `buildCalendarMonth` keys a chip on `${day}:${entry.id}` and the two
 * windows of one election share an election id, so without the suffix React would see two
 * children with the same key on any day both windows touched. They cannot overlap today —
 * see above — which is exactly the kind of invariant that makes a duplicate-key bug wait
 * years for the schema change that breaks it.
 */
export function electionWindows(election: {
  id: string
  title: string
  nominations_open_on: string | null
  nominations_close_on: string | null
  voting_open_on: string | null
  voting_close_on: string | null
}): CalendarEntry[] {
  const href = `/community/elections/${election.id}`
  const out: CalendarEntry[] = []
  if (election.nominations_open_on && election.nominations_close_on) {
    out.push({
      id:       `${election.id}:nominations`,
      title:    `Nominations — ${election.title}`,
      startsOn: election.nominations_open_on,
      endsOn:   election.nominations_close_on,
      kind:     'election',
      phase:    'nominations',
      href,
    })
  }
  if (election.voting_open_on && election.voting_close_on) {
    out.push({
      id:       `${election.id}:voting`,
      title:    `Voting — ${election.title}`,
      startsOn: election.voting_open_on,
      endsOn:   election.voting_close_on,
      kind:     'election',
      phase:    'voting',
      href,
    })
  }
  return out
}
