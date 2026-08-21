/**
 * Where an election is in its own calendar, and whether a set of windows is sayable.
 *
 * ── THE PHASE IS DERIVED. NOTHING STORES IT ────────────────────────────────────────
 * `elections.status` holds `draft | published` and nothing else. Until 20260821000001 it was
 * a four-state machine — draft -> nominations -> voting -> closed — that an administrator
 * stepped through by hand, with four TIMESTAMPTZ columns beside it that governed nothing at
 * all: a family that set a closing date and went away came back to a ballot still open, and
 * the two RLS policies gating writes tested `status`, which is to say they tested whether
 * anybody had remembered.
 *
 * So the phase is a function of the four dates and today, computed here and stored nowhere.
 * Same argument as `lib/age-utils.ts` replacing `people.is_minor` (20260813000006) and as
 * `people.is_blood` never existing (AGENTS.md §4c): a stored copy of a derived fact is wrong
 * from the first day nobody re-ran it, and an election is the worst place for that — the
 * wrong answer means a ballot open when the family said it was shut.
 *
 * ── `today` IS A PARAMETER, per AGENTS.md §7b ──────────────────────────────────────
 * Every function here takes the date it needs rather than reading `new Date()`, which is what
 * makes the whole of the phase arithmetic checkable under `npm test` with no clock, no jsdom
 * and no Supabase. Callers pass `todayLocal()` from `lib/date-utils.ts`.
 *
 * ── THERE IS A SQL TWIN, AND THE TWO MOVE TOGETHER ─────────────────────────────────
 * `public.election_window_open(election_id, window)` (20260821000001) is the same rule in the
 * database, and it is what the two INSERT policies on `election_nominations` and
 * `election_votes` test. Two expressions of one rule is normally forbidden here; the
 * exception is the one AGENTS.md already makes for `resolveScope` / `auth_permission` /
 * `scopeInFamilies` and for `addressedTo` / `announcementAudienceFilter` — one rule on two
 * sides of a boundary no single definition can cross.
 *
 * THIS HALF IS THE AUTHORITY FOR WHAT RENDERS; the SQL half is the boundary for what can be
 * WRITTEN. If they ever disagree, this one showing a closed ballot as open is caught by the
 * policy refusing the write; the SQL half being the looser of the two is the direction that
 * matters, and it is why both are written as the same inclusive comparison and nothing more.
 *
 * ── DATES ARE `YYYY-MM-DD` STRINGS, COMPARED AS STRINGS ────────────────────────────
 * Never `new Date(...)`. `new Date('2026-08-01')` is UTC midnight and reads as 31 July in any
 * negative offset, which is how a ballot comes to open a day early for half the country —
 * the trap `lib/calendar.ts` and `formatDate` are both written around. ISO dates sort
 * lexicographically, so `<=` on the strings IS the calendar comparison.
 */

/** The two states the database stores. Everything else about "where is it" is derived. */
export type ElectionStatus = 'draft' | 'published'

/**
 * Where a published election is in its calendar.
 *
 * `between` is a real state and not a gap: nominations have closed and voting has not opened,
 * which is when an organizer checks the slate. The screens say so rather than showing
 * "Nominations" over a form nobody can submit.
 */
export type ElectionPhase =
  | 'draft'
  | 'scheduled'
  | 'nominations'
  | 'between'
  | 'voting'
  | 'closed'

/** The columns the phase is computed from. Anything with these can be asked. */
export interface ElectionWindows {
  status: string | null | undefined
  nominations_open_on: string | null | undefined
  nominations_close_on: string | null | undefined
  voting_open_on: string | null | undefined
  voting_close_on: string | null | undefined
}

/**
 * What each phase is called on screen. One table, because the member list, the detail page
 * and the organizer screen all print it and three copies had already begun to differ under
 * the old four-state machine.
 */
export const ELECTION_PHASE_LABEL: Record<ElectionPhase, string> = {
  draft: 'Draft',
  scheduled: 'Scheduled',
  nominations: 'Nominations Open',
  between: 'Nominations Closed',
  voting: 'Voting Open',
  closed: 'Closed',
}

/**
 * The phase, as of `today`.
 *
 * ── THE CLOSE DATE IS INCLUSIVE ────────────────────────────────────────────────────
 * Nominations are open THROUGH `nominations_close_on` and the last day anybody may vote is
 * `voting_close_on`, so a window shown as "January 1st – January 5th" is five days. That is
 * how a reader reads a range, and it is the same reading `election_window_open()` uses in SQL
 * (`BETWEEN`, which is inclusive at both ends). The alternative — an exclusive close, where
 * "closes January 5th" means the 4th was the last day — makes every displayed range lie by a
 * day. Change this and change the SQL function and `/help` in the same commit.
 *
 * ── AN INCOMPLETE PUBLISHED ROW FAILS CLOSED ───────────────────────────────────────
 * `elections_published_has_windows` makes a published row with a missing date impossible in
 * the database, so this branch exists for one case only: a row read through a projection that
 * did not select all four columns. It answers `draft`, which opens nothing. That is the right
 * direction for a ballot — the cost of being wrong is a control that does not appear, against
 * a vote accepted after the family said the poll had shut.
 */
export function electionPhase(e: ElectionWindows, today: string): ElectionPhase {
  if (e.status !== 'published') return 'draft'

  const nomOpen = e.nominations_open_on ?? null
  const nomClose = e.nominations_close_on ?? null
  const voteOpen = e.voting_open_on ?? null
  const voteClose = e.voting_close_on ?? null
  if (!nomOpen || !nomClose || !voteOpen || !voteClose) return 'draft'

  if (today < nomOpen) return 'scheduled'
  if (today <= nomClose) return 'nominations'
  if (today < voteOpen) return 'between'
  if (today <= voteClose) return 'voting'
  return 'closed'
}

/** True while nominations may be submitted. The one test any nomination control should make. */
export function nominationsOpen(phase: ElectionPhase): boolean {
  return phase === 'nominations'
}

/** True while a vote may be cast. */
export function votingOpen(phase: ElectionPhase): boolean {
  return phase === 'voting'
}

/**
 * True when the election is on the family's calendar and not finished — the two phases plus
 * the two either side of them. What the member list files under "Active".
 *
 * `scheduled` and `between` count deliberately: an election opening next week is something a
 * member wants to see coming, and one whose nominations have closed is one they are waiting
 * on. A list that showed only the two acted-in phases would make an election disappear for
 * the days in between and come back, which reads as a bug.
 */
export function electionIsCurrent(phase: ElectionPhase): boolean {
  return phase === 'scheduled' || phase === 'nominations'
    || phase === 'between' || phase === 'voting'
}

/** True once the last vote has been counted — results are worth showing from here. */
export function electionIsClosed(phase: ElectionPhase): boolean {
  return phase === 'closed'
}

/** The four windows as they arrive from a form: empty string for "not set". */
export interface WindowInput {
  nominations_open_on: string
  nominations_close_on: string
  voting_open_on: string
  voting_close_on: string
}

/**
 * What is wrong with a set of windows, as a sentence, or null when nothing is.
 *
 * ── ONE COPY, READ BY THE FORM AND BY THE ACTION ───────────────────────────────────
 * The organizer's form calls this before it submits, so the message appears beside the field
 * rather than after a round trip; `createElection` and `updateElection` call it again, because
 * a server action is a public HTTP endpoint and the form is not in its request path
 * (AGENTS.md §2). Same rule, one definition — and the database holds it a third time in
 * `elections_windows_ordered`, which is the layer that decides. The constraint's message
 * names a constraint; this one names the field, which is what an organizer needs.
 *
 * `requireAll` is what separates saving a DRAFT from PUBLISHING one. A draft may be
 * half-written — that is the whole use of a draft — while a published election with a missing
 * date is one that can never open, which is what `elections_published_has_windows` refuses.
 *
 * THE ORDER OF THE CHECKS IS THE ORDER AN ORGANIZER FILLS THE FORM IN, so the first thing
 * reported is the earliest thing wrong rather than whichever test happened to be written
 * first.
 */
export function windowProblem(
  input: WindowInput,
  opts: { requireAll: boolean },
): string | null {
  const nomOpen = input.nominations_open_on || ''
  const nomClose = input.nominations_close_on || ''
  const voteOpen = input.voting_open_on || ''
  const voteClose = input.voting_close_on || ''

  if (opts.requireAll && (!nomOpen || !nomClose || !voteOpen || !voteClose)) {
    return 'A published election needs all four dates — nominations open and close, then voting open and close.'
  }

  // "At least a day" is what `close > open` buys, and it is stated in those words because
  // that is the rule a family was given rather than the comparison that implements it.
  if (nomOpen && nomClose && nomClose <= nomOpen) {
    return 'Nominations must close after they open — leave them open at least a day.'
  }
  if (nomClose && voteOpen && voteOpen <= nomClose) {
    return 'Voting must open after nominations close, so nobody votes on a slate that is still changing.'
  }
  if (voteOpen && voteClose && voteClose <= voteOpen) {
    return 'Voting must close after it opens — leave it open at least a day.'
  }
  return null
}
