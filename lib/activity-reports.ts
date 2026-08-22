import { taskProgress, type GatheringStatus, type GatheringTaskStatus, type TaskProgress } from '@/lib/gatherings'
import { POSITION_SCOPE_LABELS, type PositionCategory, type PositionScope } from '@/lib/board-positions'

/**
 * The shaping behind the four ACTIVITY reports — Gatherings, Elections, Meetings, and Board &
 * Offices.
 *
 * ── WHY THESE FOUR, AND WHY IN ONE MODULE ──────────────────────────────────────────────
 * Reporting had five screens on 2026-08-22 and every one of them read the MONEY: Membership is
 * the roster, and Payment History, Transactions, Dues Projections and P&L Summary are four
 * views of the ledger. Nothing anywhere reported on what the family DOES — who is behind on a
 * reunion task, whether an election drew a turnout worth calling a mandate, how often the
 * board actually meets, or which offices are standing empty. These four answer that, and they
 * ship together because they are one absence rather than four.
 *
 * They are in one module because they are one shape repeated: take rows the action has already
 * read and family-scoped, roll them up, and hand back a total plus a table. Four modules would
 * be four copies of that with four test files. They do NOT share a type, deliberately — a
 * generic `ReportRow` would make every one of them worse at saying what it is about.
 *
 * ── PURE, PER §7b ──────────────────────────────────────────────────────────────────────
 * No database, no React, no `new Date()`. Every function that needs to know what day it is
 * takes `today` as a `YYYY-MM-DD` string, for the reason `duesPlanMath` does: a module that
 * reads the clock internally is a module nothing can test at a boundary. The comparisons are
 * string comparisons on `YYYY-MM-DD`, which is what the rest of this product does with a bare
 * DATE and is why there is no `Date` in this file at all — see `lib/calendar.ts`' header for
 * the timezone argument.
 *
 * ── EVERY FIGURE IS COUNTED, NONE IS ESTIMATED ─────────────────────────────────────────
 * Where the product does not record something, these reports say so rather than deriving a
 * plausible number. The sharpest case is meeting ATTENDANCE: there is no check-in anywhere in
 * GENORRA, so `MeetingsReport` reports who was IN THE ROOM (the attendee list) and who VOTED,
 * and never claims either is attendance. Inventing a third figure out of the two would be a
 * report stating something no row in the database says.
 */

// ═══════════════════════════════════════════════════════════════════════════════════════
// GATHERINGS — is the work getting done, and is it inside the budget
// ═══════════════════════════════════════════════════════════════════════════════════════

/** One gathering's row. Every count is over that gathering's own tasks. */
export interface GatheringReportRow {
  id: string
  title: string
  startsOn: string
  endsOn: string | null
  status: GatheringStatus
  isPremier: boolean
  /** open / submitted / approved / denied / total, from `taskProgress`. */
  tasks: TaskProgress
  /** Tasks past their due date and not yet approved. See `isOverdue`. */
  overdue: number
  /** Tasks with nobody holding them. A step nobody was given is work nobody is doing. */
  unassigned: number
  /** Distinct people holding at least one task here. */
  helpers: number
  /** What the gathering set aside, or null when the caller may not see the money band. */
  budgetCents: number | null
  /** What its task lines claim against that. Null for the same reason. */
  allocatedCents: number | null
}

export interface GatheringsReport {
  rows: GatheringReportRow[]
  totals: {
    gatherings: number
    /** Not counting cancelled ones — see `buildGatheringsReport`. */
    upcoming: number
    tasks: TaskProgress
    overdue: number
    unassigned: number
    /** Distinct people across the whole report, not the sum of the per-row figures. */
    helpers: number
  }
}

/** The rows this report is built from, as the action hands them over. */
export interface GatheringReportInput {
  id: string
  title: string
  starts_on: string
  ends_on: string | null
  status: GatheringStatus
  is_premier: boolean
  budget_cents: number | null
}

export interface GatheringTaskReportInput {
  gathering_id: string
  status: GatheringTaskStatus
  assignee_id: string | null
  due_on: string | null
  budget_cents: number | null
}

/**
 * A task is OVERDUE when its due date has passed and it has not been approved.
 *
 * `'submitted'` counts as overdue and that is the decision worth stating: the work may well be
 * done, but nobody has ruled on it, so it is still outstanding from the organizer's side —
 * which is exactly whose report this is. `'denied'` counts too, for the plainer reason that a
 * task sent back is a task still to do.
 *
 * A task with NO due date is never overdue. Nothing was promised for a particular day, so
 * there is no day it can be late relative to.
 */
export function isOverdue(
  task: { status: GatheringTaskStatus; due_on: string | null },
  today: string,
): boolean {
  if (!task.due_on) return false
  if (task.status === 'approved') return false
  return task.due_on < today
}

/**
 * Roll the family's gatherings up.
 *
 * CANCELLED GATHERINGS ARE EXCLUDED ENTIRELY, rows and totals alike. A cancelled reunion's
 * eleven open tasks are not work anybody is behind on, and leaving them in would put a family
 * that cancelled one thing permanently in the red on every figure here. `/gatherings` still
 * lists it with its status pill, which is the screen that owns that question.
 *
 * `budgetCents` AND `allocatedCents` ARE NULL TOGETHER OR NEITHER. The money band on a
 * gathering is `gatherings/budget`, a Standard sub-key the action resolves; when it is
 * withheld the action passes `money: false` and every money figure here is null rather than
 * zero. A zero would be a claim that the family budgeted nothing.
 */
export function buildGatheringsReport(input: {
  gatherings: readonly GatheringReportInput[]
  tasks: readonly GatheringTaskReportInput[]
  today: string
  money: boolean
}): GatheringsReport {
  const live = input.gatherings.filter(g => g.status !== 'cancelled')
  const liveIds = new Set(live.map(g => g.id))
  const tasks = input.tasks.filter(t => liveIds.has(t.gathering_id))

  const byGathering = new Map<string, GatheringTaskReportInput[]>()
  for (const task of tasks) {
    const list = byGathering.get(task.gathering_id)
    if (list) list.push(task)
    else byGathering.set(task.gathering_id, [task])
  }

  const rows: GatheringReportRow[] = live
    .map(g => {
      const mine = byGathering.get(g.id) ?? []
      const allocated = mine.reduce((sum, t) => sum + (t.budget_cents ?? 0), 0)
      return {
        id: g.id,
        title: g.title,
        startsOn: g.starts_on,
        endsOn: g.ends_on,
        status: g.status,
        isPremier: g.is_premier,
        tasks: taskProgress(mine),
        overdue: mine.filter(t => isOverdue(t, input.today)).length,
        unassigned: mine.filter(t => !t.assignee_id).length,
        helpers: new Set(mine.map(t => t.assignee_id).filter(Boolean)).size,
        budgetCents: input.money ? g.budget_cents : null,
        allocatedCents: input.money ? allocated : null,
      }
    })
    // Soonest first, and by title where two share a day, so two renders cannot disagree.
    .sort((a, b) => a.startsOn.localeCompare(b.startsOn) || a.title.localeCompare(b.title))

  return {
    rows,
    totals: {
      gatherings: rows.length,
      // A gathering is UPCOMING while its last day has not passed — the same span reading
      // `spanEnd` takes on the calendar, so a reunion is still upcoming on its middle day.
      upcoming: rows.filter(r => (r.endsOn && r.endsOn > r.startsOn ? r.endsOn : r.startsOn) >= input.today).length,
      tasks: taskProgress(tasks),
      overdue: tasks.filter(t => isOverdue(t, input.today)).length,
      unassigned: tasks.filter(t => !t.assignee_id).length,
      // DISTINCT ACROSS THE REPORT, not the sum of the rows: somebody helping with two
      // gatherings is one person, and summing would report the family as having more helpers
      // than it has members.
      helpers: new Set(tasks.map(t => t.assignee_id).filter(Boolean)).size,
    },
  }
}

// ═══════════════════════════════════════════════════════════════════════════════════════
// ELECTIONS — did anybody stand, and did anybody vote
// ═══════════════════════════════════════════════════════════════════════════════════════

export interface ElectionReportRow {
  id: string
  title: string
  /** "National", or the region or chapter name — resolved by the action. */
  scopeLabel: string
  /** From `lib/election-phase.ts`, resolved by the action against today. */
  phase: string
  /** Offices this election is filling. */
  offices: number
  nominations: number
  /** Nominations the nominee accepted. Only these appear on a ballot. */
  accepted: number
  /** Offices with no accepted nominee: nothing for anybody to vote for. */
  uncontested: number
  /** Approved members inside the election's area, as the action resolved it. */
  eligible: number
  /** Distinct people who cast at least one vote. */
  voted: number
  /** `voted / eligible`, 0–100, rounded. Null when nobody is eligible — see below. */
  turnoutPct: number | null
}

export interface ElectionsReport {
  rows: ElectionReportRow[]
  totals: {
    elections: number
    /** Those a member could act on today — the action resolves the phase. */
    open: number
    nominations: number
    /** Distinct people who have voted in ANY election here, not the sum of the rows. */
    voters: number
  }
}

export interface ElectionReportInput {
  id: string
  title: string
  scopeLabel: string
  phase: string
  /** Whether a member can act on it today. Resolved by the action from the phase. */
  open: boolean
  offices: number
  eligible: number
  /** One entry per nomination: whether it was accepted, and which office it is for. */
  nominations: readonly { positionId: string; accepted: boolean }[]
  /** One entry per vote cast, by voter. Duplicates are expected — one per office voted on. */
  voterIds: readonly string[]
}

/**
 * TURNOUT IS NULL WHEN NOBODY IS ELIGIBLE, never 0%.
 *
 * A chapter election in a chapter with no approved members has no turnout — zero out of zero
 * is not a percentage, and printing "0%" would read as an election everybody ignored rather
 * than an election nobody could vote in. The same distinction the calendar makes between "a
 * source is withheld" and "the month is empty".
 */
export function turnout(voted: number, eligible: number): number | null {
  if (eligible <= 0) return null
  return Math.round((voted / eligible) * 100)
}

export function buildElectionsReport(
  elections: readonly ElectionReportInput[],
): ElectionsReport {
  const rows: ElectionReportRow[] = elections.map(e => {
    // DISTINCT VOTERS, not ballots. `election_votes` holds one row per office voted on, so a
    // member voting in a three-office election is three rows and one voter — and turnout is a
    // fraction of PEOPLE. Counting rows would report 300% turnout in a family where everybody
    // voted, which is the sort of figure that gets a report ignored.
    const voted = new Set(e.voterIds).size
    const acceptedByOffice = new Set(
      e.nominations.filter(n => n.accepted).map(n => n.positionId),
    )
    return {
      id: e.id,
      title: e.title,
      scopeLabel: e.scopeLabel,
      phase: e.phase,
      offices: e.offices,
      nominations: e.nominations.length,
      accepted: e.nominations.filter(n => n.accepted).length,
      // An office with no ACCEPTED nominee, which is the one that matters: a nomination
      // nobody accepted puts nothing on the ballot. Never negative, because an election can
      // carry an accepted nomination for an office that has since been removed.
      uncontested: Math.max(0, e.offices - acceptedByOffice.size),
      eligible: e.eligible,
      voted,
      turnoutPct: turnout(voted, e.eligible),
    }
  })

  return {
    rows,
    totals: {
      elections: rows.length,
      open: elections.filter(e => e.open).length,
      nominations: rows.reduce((sum, r) => sum + r.nominations, 0),
      // DISTINCT ACROSS THE REPORT — see `helpers` above for the same argument.
      voters: new Set(elections.flatMap(e => [...e.voterIds])).size,
    },
  }
}

// ═══════════════════════════════════════════════════════════════════════════════════════
// MEETINGS — how often, how big, and what got decided
// ═══════════════════════════════════════════════════════════════════════════════════════

export interface MeetingReportRow {
  id: string
  title: string
  meetsOn: string
  /** Minuted — `closed_at` is set. An open meeting is one nobody has signed off. */
  minuted: boolean
  secretaryName: string | null
  /** People on the attendee list. NOT attendance — see the module header. */
  inTheRoom: number
  topics: number
  /** Topics somebody called a vote on. */
  voted: number
  /** Votes cast across every topic. */
  ballots: number
}

/** One member's participation. Both figures are counted, neither is attendance. */
export interface MeetingParticipantRow {
  personId: string
  name: string
  /** Meetings they were on the attendee list for. */
  invited: number
  /** Meetings they cast at least one vote in. */
  votedIn: number
  /** Meetings they took the minutes of. */
  minuted: number
}

export interface MeetingsReport {
  rows: MeetingReportRow[]
  participants: MeetingParticipantRow[]
  totals: {
    meetings: number
    minuted: number
    topics: number
    /** Topics that reached a vote, across every meeting. */
    votedTopics: number
    ballots: number
    /** Distinct people who were in the room at least once. */
    people: number
  }
}

export interface MeetingReportInput {
  id: string
  title: string
  meets_on: string
  closed_at: string | null
  secretary_id: string | null
  secretaryName: string | null
  attendeeIds: readonly string[]
  topics: readonly { id: string; votingOpened: boolean; voterIds: readonly string[] }[]
}

export function buildMeetingsReport(input: {
  meetings: readonly MeetingReportInput[]
  names: ReadonlyMap<string, string>
}): MeetingsReport {
  const rows: MeetingReportRow[] = input.meetings
    .map(m => ({
      id: m.id,
      title: m.title,
      meetsOn: m.meets_on,
      minuted: m.closed_at !== null,
      secretaryName: m.secretaryName,
      inTheRoom: new Set(m.attendeeIds).size,
      topics: m.topics.length,
      voted: m.topics.filter(t => t.votingOpened).length,
      ballots: m.topics.reduce((sum, t) => sum + t.voterIds.length, 0),
    }))
    // Most recent first: a report about meetings is nearly always read from the last one.
    .sort((a, b) => b.meetsOn.localeCompare(a.meetsOn) || a.title.localeCompare(b.title))

  const participants = new Map<string, MeetingParticipantRow>()
  const ensure = (personId: string): MeetingParticipantRow => {
    let row = participants.get(personId)
    if (!row) {
      row = {
        personId,
        name: input.names.get(personId) ?? 'Somebody no longer in this family',
        invited: 0,
        votedIn: 0,
        minuted: 0,
      }
      participants.set(personId, row)
    }
    return row
  }

  for (const meeting of input.meetings) {
    for (const personId of new Set(meeting.attendeeIds)) ensure(personId).invited += 1
    // ONE PER MEETING, not one per vote: somebody answering four topics attended one meeting.
    const votedHere = new Set(meeting.topics.flatMap(t => [...t.voterIds]))
    for (const personId of votedHere) ensure(personId).votedIn += 1
    if (meeting.secretary_id) ensure(meeting.secretary_id).minuted += 1
  }

  return {
    rows,
    participants: [...participants.values()].sort(
      (a, b) => b.invited - a.invited || a.name.localeCompare(b.name),
    ),
    totals: {
      meetings: rows.length,
      minuted: rows.filter(r => r.minuted).length,
      topics: rows.reduce((sum, r) => sum + r.topics, 0),
      votedTopics: rows.reduce((sum, r) => sum + r.voted, 0),
      ballots: rows.reduce((sum, r) => sum + r.ballots, 0),
      people: participants.size,
    },
  }
}

// ═══════════════════════════════════════════════════════════════════════════════════════
// BOARD & OFFICES — who holds what, and what nobody holds
// ═══════════════════════════════════════════════════════════════════════════════════════

export interface BoardReportHolder {
  personId: string
  name: string
  /** The region or chapter the office is held for, or null at national scope. */
  areaName: string | null
}

export interface BoardReportRow {
  positionId: string
  name: string
  scope: PositionScope
  scopeLabel: string
  category: PositionCategory
  holders: BoardReportHolder[]
}

/** Somebody wearing more than one hat. Worth naming: it is usually a gap, not a promotion. */
export interface BoardMultiHolder {
  personId: string
  name: string
  offices: string[]
}

export interface BoardReport {
  rows: BoardReportRow[]
  multiHolders: BoardMultiHolder[]
  totals: {
    positions: number
    /** Positions with at least one holder. */
    filled: number
    /** Positions with nobody in them at all. */
    vacant: number
    /** Distinct people holding any office. */
    officers: number
    /** Offices held, counting somebody with two as two. */
    assignments: number
  }
}

export interface BoardReportPositionInput {
  id: string
  name: string
  scope: PositionScope
  category: PositionCategory
  sort_order: number
}

export interface BoardReportAssignmentInput {
  positionId: string
  personId: string
  personName: string
  areaName: string | null
}

/**
 * Who holds what, and — the part nothing else in the product answers — what nobody holds.
 *
 * EVERY POSITION IS A ROW, INCLUDING THE EMPTY ONES. That is the whole point of this report
 * rather than of `/admin/members/organization`, which lists positions with a holder count
 * beside each: a vacancy is the finding, and a report that only listed filled offices would
 * be a report that cannot state its most useful fact. `vacant` is the headline figure.
 *
 * THE ORDER IS THE FAMILY'S OWN `sort_order`, not the vacancies first. An administrator
 * reading this is matching it against the board list they already know, and re-ordering by
 * finding would make the two impossible to read side by side.
 */
export function buildBoardReport(input: {
  positions: readonly BoardReportPositionInput[]
  assignments: readonly BoardReportAssignmentInput[]
}): BoardReport {
  const byPosition = new Map<string, BoardReportHolder[]>()
  for (const a of input.assignments) {
    const list = byPosition.get(a.positionId)
    const holder = { personId: a.personId, name: a.personName, areaName: a.areaName }
    if (list) list.push(holder)
    else byPosition.set(a.positionId, [holder])
  }

  const rows: BoardReportRow[] = [...input.positions]
    .sort((a, b) => a.sort_order - b.sort_order || a.name.localeCompare(b.name))
    .map(p => ({
      positionId: p.id,
      name: p.name,
      scope: p.scope,
      scopeLabel: POSITION_SCOPE_LABELS[p.scope],
      category: p.category,
      holders: (byPosition.get(p.id) ?? []).sort(
        (x, y) => (x.areaName ?? '').localeCompare(y.areaName ?? '')
          || x.name.localeCompare(y.name),
      ),
    }))

  // A position that exists in no `positions` row cannot be reported on — the action drops
  // those before they get here, for the reason `getBoardPositionHolders` does.
  const officeNames = new Map(input.positions.map(p => [p.id, p.name]))
  const byPerson = new Map<string, BoardMultiHolder>()
  for (const a of input.assignments) {
    if (!officeNames.has(a.positionId)) continue
    let entry = byPerson.get(a.personId)
    if (!entry) {
      entry = { personId: a.personId, name: a.personName, offices: [] }
      byPerson.set(a.personId, entry)
    }
    entry.offices.push(
      a.areaName
        ? `${officeNames.get(a.positionId) as string} (${a.areaName})`
        : (officeNames.get(a.positionId) as string),
    )
  }

  const known = input.assignments.filter(a => officeNames.has(a.positionId))
  return {
    rows,
    multiHolders: [...byPerson.values()]
      .filter(p => p.offices.length > 1)
      .map(p => ({ ...p, offices: [...p.offices].sort((a, b) => a.localeCompare(b)) }))
      .sort((a, b) => b.offices.length - a.offices.length || a.name.localeCompare(b.name)),
    totals: {
      positions: rows.length,
      filled: rows.filter(r => r.holders.length > 0).length,
      vacant: rows.filter(r => r.holders.length === 0).length,
      officers: byPerson.size,
      assignments: known.length,
    },
  }
}
