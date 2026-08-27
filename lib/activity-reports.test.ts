import { describe, expect, it } from 'vitest'
import { todayIn } from './tz'
import {
  buildBoardReport, buildElectionsReport, buildGatheringsReport, buildMeetingsReport,
  isOverdue, turnout,
} from './activity-reports'
import { tFor } from '@/lib/i18n/catalogues'

// AN ENGLISH `t` FOR THE FIXTURE. These modules build captions now, so their tests need
// one — and English is the right choice: what is asserted below is the SHAPE of the
// report, not a translation. `lib/i18n/t.test.ts` is where the words themselves are
// pinned, and pinning them twice would make this file fail on a wording change it has
// no opinion about.
const t = tFor('en')

/**
 * Per AGENTS.md §7b. A GREEN RUN IS NOT EVIDENCE UNTIL YOU HAVE SEEN IT FAIL, and each of the
 * mutations named beside a `describe` below turns exactly that block red.
 */

// ═══ GATHERINGS ══════════════════════════════════════════════════════════════════════
// Mutations checked: drop the `status !== 'cancelled'` filter; drop the `!task.due_on`
// guard; treat `'submitted'` as not overdue; sum the per-row `helpers` instead of counting
// distinct; make `money: false` produce 0 rather than null.

const gathering = (over: Partial<Parameters<typeof buildGatheringsReport>[0]['gatherings'][number]> = {}) => ({
  id: 'g1', title: 'Reunion', starts_on: '2026-09-01', ends_on: '2026-09-03',
  status: 'scheduled' as const, is_premier: false, budget_cents: 100_000, ...over,
})
const task = (over: Partial<Parameters<typeof buildGatheringsReport>[0]['tasks'][number]> = {}) => ({
  gathering_id: 'g1', status: 'open' as const, assignee_id: 'p1',
  due_on: '2026-09-01', budget_cents: 0, ...over,
})

describe('isOverdue', () => {
  it('is false for a task with no due date', () => {
    // Nothing was promised for a particular day, so there is no day it can be late relative to.
    expect(isOverdue({ status: 'open', due_on: null }, '2030-01-01')).toBe(false)
  })

  it('is false for an approved task, however late', () => {
    expect(isOverdue({ status: 'approved', due_on: '2020-01-01' }, '2026-08-22')).toBe(false)
  })

  it('is TRUE for a submitted task past its date', () => {
    // The work may well be done; nobody has ruled on it, so it is still outstanding from the
    // organizer's side — and this is the organizer's report.
    expect(isOverdue({ status: 'submitted', due_on: '2026-08-01' }, '2026-08-22')).toBe(true)
  })

  it('is true for a denied task past its date', () => {
    expect(isOverdue({ status: 'denied', due_on: '2026-08-01' }, '2026-08-22')).toBe(true)
  })

  it('is false on the due date itself', () => {
    expect(isOverdue({ status: 'open', due_on: '2026-08-22' }, '2026-08-22')).toBe(false)
  })
})

describe('buildGatheringsReport', () => {
  it('excludes a cancelled gathering from the rows AND the totals', () => {
    const report = buildGatheringsReport({
      gatherings: [gathering(), gathering({ id: 'g2', status: 'cancelled' })],
      tasks: [task(), task({ gathering_id: 'g2', due_on: '2020-01-01' })],
      today: '2026-08-22',
      money: true,
    })
    expect(report.rows.map(r => r.id)).toEqual(['g1'])
    expect(report.totals.gatherings).toBe(1)
    // The cancelled gathering's ancient task must not show up as work anybody is behind on.
    expect(report.totals.overdue).toBe(0)
    expect(report.totals.tasks.total).toBe(1)
  })

  it('counts distinct helpers across the report, not the sum of the rows', () => {
    const report = buildGatheringsReport({
      gatherings: [gathering(), gathering({ id: 'g2' })],
      tasks: [task({ assignee_id: 'p1' }), task({ gathering_id: 'g2', assignee_id: 'p1' })],
      today: '2026-08-22',
      money: true,
    })
    expect(report.rows.map(r => r.helpers)).toEqual([1, 1])
    // Summing would report two helpers in a family with one.
    expect(report.totals.helpers).toBe(1)
  })

  it('counts an unassigned task and does not count it as a helper', () => {
    const report = buildGatheringsReport({
      gatherings: [gathering()],
      tasks: [task({ assignee_id: null })],
      today: '2026-08-22',
      money: true,
    })
    expect(report.rows[0].unassigned).toBe(1)
    expect(report.rows[0].helpers).toBe(0)
  })

  it('nulls both money figures when the money band is withheld, never zeroes them', () => {
    // A zero would be a claim that the family budgeted nothing.
    const report = buildGatheringsReport({
      gatherings: [gathering()], tasks: [task({ budget_cents: 2500 })],
      today: '2026-08-22', money: false,
    })
    expect(report.rows[0].budgetCents).toBeNull()
    expect(report.rows[0].allocatedCents).toBeNull()
  })

  it('adds the task lines up against the gathering budget when the band is shown', () => {
    const report = buildGatheringsReport({
      gatherings: [gathering({ budget_cents: 100_000 })],
      tasks: [task({ budget_cents: 2500 }), task({ budget_cents: 1500 })],
      today: '2026-08-22', money: true,
    })
    expect(report.rows[0].budgetCents).toBe(100_000)
    expect(report.rows[0].allocatedCents).toBe(4000)
  })

  it('counts a multi-day gathering as upcoming on its middle day', () => {
    // The same span reading `spanEnd` takes on the calendar. Anchoring on `starts_on` alone
    // would file a reunion as past halfway through it.
    const report = buildGatheringsReport({
      gatherings: [gathering({ starts_on: '2026-09-01', ends_on: '2026-09-03' })],
      tasks: [], today: '2026-09-02', money: true,
    })
    expect(report.totals.upcoming).toBe(1)
  })

  it('counts a finished gathering as not upcoming', () => {
    const report = buildGatheringsReport({
      gatherings: [gathering({ starts_on: '2026-09-01', ends_on: '2026-09-03' })],
      tasks: [], today: '2026-09-04', money: true,
    })
    expect(report.totals.upcoming).toBe(0)
  })

  it('orders soonest first', () => {
    const report = buildGatheringsReport({
      gatherings: [
        gathering({ id: 'b', starts_on: '2026-10-01' }),
        gathering({ id: 'a', starts_on: '2026-09-01' }),
      ],
      tasks: [], today: '2026-08-22', money: true,
    })
    expect(report.rows.map(r => r.id)).toEqual(['a', 'b'])
  })
})

// ═══ ELECTIONS ═══════════════════════════════════════════════════════════════════════
// Mutations checked: return 0 from `turnout` when eligible is 0; count `voterIds.length`
// instead of the distinct set; drop the `Math.max(0, …)` on `uncontested`.

const election = (over: Partial<Parameters<typeof buildElectionsReport>[0][number]> = {}) => ({
  id: 'e1', title: 'Board Election', scopeLabel: 'National', phase: 'voting',
  open: true, offices: 2, eligible: 10,
  nominations: [{ positionId: 'o1', accepted: true }, { positionId: 'o2', accepted: false }],
  voterIds: ['p1', 'p1', 'p2'],
  ...over,
})

describe('turnout', () => {
  it('is null when nobody is eligible, never 0%', () => {
    // A chapter election in a chapter with no members has no turnout. "0%" would read as an
    // election everybody ignored rather than one nobody could vote in.
    expect(turnout(0, 0)).toBeNull()
    expect(turnout(0, -1)).toBeNull()
  })

  it('rounds to a whole percent', () => {
    expect(turnout(1, 3)).toBe(33)
    expect(turnout(2, 3)).toBe(67)
    expect(turnout(10, 10)).toBe(100)
  })
})

describe('buildElectionsReport', () => {
  it('counts distinct voters, not ballots', () => {
    // `election_votes` holds one row per office voted on. Counting rows would report 300%
    // turnout in a family where everybody voted once.
    const report = buildElectionsReport([election({ voterIds: ['p1', 'p1', 'p1', 'p2'] })])
    expect(report.rows[0].voted).toBe(2)
    expect(report.rows[0].turnoutPct).toBe(20)
  })

  it('counts an office with no ACCEPTED nominee as uncontested', () => {
    const report = buildElectionsReport([election()])
    expect(report.rows[0].nominations).toBe(2)
    expect(report.rows[0].accepted).toBe(1)
    expect(report.rows[0].uncontested).toBe(1)
  })

  it('never reports a negative number of uncontested offices', () => {
    // An election can carry an accepted nomination for an office that has since been removed,
    // which makes `accepted offices > offices`.
    const report = buildElectionsReport([election({
      offices: 1,
      nominations: [{ positionId: 'o1', accepted: true }, { positionId: 'o2', accepted: true }],
    })])
    expect(report.rows[0].uncontested).toBe(0)
  })

  it('counts distinct voters across the whole report', () => {
    const report = buildElectionsReport([
      election({ id: 'e1', voterIds: ['p1', 'p2'] }),
      election({ id: 'e2', voterIds: ['p2', 'p3'] }),
    ])
    expect(report.totals.voters).toBe(3)
  })

  it('counts only the elections a member can act on as open', () => {
    const report = buildElectionsReport([
      election({ id: 'e1', open: true }),
      election({ id: 'e2', open: false }),
    ])
    expect(report.totals.elections).toBe(2)
    expect(report.totals.open).toBe(1)
  })
})

// ═══ MEETINGS ════════════════════════════════════════════════════════════════════════
// Mutations checked: count a vote per topic rather than per meeting in `votedIn`; drop the
// `new Set` on `attendeeIds`; sort oldest-first.

const meeting = (over: Partial<Parameters<typeof buildMeetingsReport>[0]['meetings'][number]> = {}) => ({
  id: 'm1', title: 'Quarterly', meets_on: '2026-08-01', closed_at: null,
  secretary_id: 'p1', secretaryName: 'Ada Nwosu',
  attendeeIds: ['p1', 'p2'],
  topics: [{ id: 't1', votingOpened: true, voterIds: ['p1', 'p2'] }],
  ...over,
})
const names = new Map([['p1', 'Ada Nwosu'], ['p2', 'Ben Okafor'], ['p3', 'Cara Diallo']])

describe('buildMeetingsReport', () => {
  it('counts a member who answered four topics as having voted in ONE meeting', () => {
    const report = buildMeetingsReport({
      meetings: [meeting({
        topics: [
          { id: 't1', votingOpened: true, voterIds: ['p1'] },
          { id: 't2', votingOpened: true, voterIds: ['p1'] },
          { id: 't3', votingOpened: true, voterIds: ['p1'] },
        ],
      })],
      names,
    })
    expect(report.participants.find(p => p.personId === 'p1')?.votedIn).toBe(1)
    // The BALLOT count is the other figure and does count each one.
    expect(report.rows[0].ballots).toBe(3)
  })

  it('reports who was in the room and never calls it attendance', () => {
    const report = buildMeetingsReport({ meetings: [meeting()], names })
    expect(report.rows[0].inTheRoom).toBe(2)
    // There is no check-in anywhere in this product, so there is no `attended` field to read.
    expect('attended' in report.rows[0]).toBe(false)
  })

  it('counts a duplicated attendee once', () => {
    const report = buildMeetingsReport({
      meetings: [meeting({ attendeeIds: ['p1', 'p1', 'p2'] })], names,
    })
    expect(report.rows[0].inTheRoom).toBe(2)
    expect(report.participants.find(p => p.personId === 'p1')?.invited).toBe(1)
  })

  it('counts a minuted meeting separately from one nobody has closed', () => {
    const report = buildMeetingsReport({
      meetings: [meeting({ id: 'm1' }), meeting({ id: 'm2', closed_at: '2026-08-02T00:00:00Z' })],
      names,
    })
    expect(report.totals.meetings).toBe(2)
    expect(report.totals.minuted).toBe(1)
  })

  it('lists meetings most recent first', () => {
    const report = buildMeetingsReport({
      meetings: [
        meeting({ id: 'old', meets_on: '2026-01-01' }),
        meeting({ id: 'new', meets_on: '2026-08-01' }),
      ],
      names,
    })
    expect(report.rows.map(r => r.id)).toEqual(['new', 'old'])
  })

  it('names somebody who has left the family rather than dropping them', () => {
    // Their vote is in the record and cannot be withdrawn, so a report that omitted them
    // would not add up against the ballot count beside it.
    const report = buildMeetingsReport({
      meetings: [meeting({ attendeeIds: ['gone'] })], names,
    })
    expect(report.participants.find(p => p.personId === 'gone')?.name)
      .toBe('Somebody no longer in this family')
  })

  it('credits the secretary even when they are not on the attendee list', () => {
    const report = buildMeetingsReport({
      meetings: [meeting({ secretary_id: 'p3', attendeeIds: ['p1'] })], names,
    })
    expect(report.participants.find(p => p.personId === 'p3')?.minuted).toBe(1)
  })
})

// ═══ BOARD & OFFICES ═════════════════════════════════════════════════════════════════
// Mutations checked: filter the rows to filled positions; drop the `offices.length > 1`
// filter on multiHolders; sort the rows by vacancy instead of `sort_order`.

const position = (over: Partial<Parameters<typeof buildBoardReport>[0]['positions'][number]> = {}) => ({
  id: 'o1', name: 'President', scope: 'national' as const,
  category: 'executive_officer' as const, sort_order: 1, ...over,
})

describe('buildBoardReport', () => {
  it('lists a vacant position as a row, which is the whole point of the report', () => {
    const report = buildBoardReport({ t,
      positions: [position({ id: 'o1' }), position({ id: 'o2', name: 'Treasurer', sort_order: 2 })],
      assignments: [{ positionId: 'o1', personId: 'p1', personName: 'Ada', areaName: null }],
    })
    expect(report.rows.map(r => r.name)).toEqual(['President', 'Treasurer'])
    expect(report.rows[1].holders).toEqual([])
    expect(report.totals.vacant).toBe(1)
    expect(report.totals.filled).toBe(1)
  })

  it('keeps the family\'s own sort order rather than putting vacancies first', () => {
    const report = buildBoardReport({ t,
      positions: [
        position({ id: 'o1', name: 'President', sort_order: 1 }),
        position({ id: 'o2', name: 'Treasurer', sort_order: 2 }),
      ],
      assignments: [{ positionId: 'o2', personId: 'p1', personName: 'Ada', areaName: null }],
    })
    expect(report.rows.map(r => r.name)).toEqual(['President', 'Treasurer'])
  })

  it('lists every holder of one office, with the area each holds it for', () => {
    const report = buildBoardReport({ t,
      positions: [position({ scope: 'chapter' })],
      assignments: [
        { positionId: 'o1', personId: 'p2', personName: 'Ben', areaName: 'Houston' },
        { positionId: 'o1', personId: 'p1', personName: 'Ada', areaName: 'Austin' },
      ],
    })
    expect(report.rows[0].holders.map(h => h.areaName)).toEqual(['Austin', 'Houston'])
    expect(report.rows[0].scopeLabel).toBe('Chapter')
    expect(report.totals.filled).toBe(1)
    expect(report.totals.assignments).toBe(2)
    expect(report.totals.officers).toBe(2)
  })

  it('names somebody holding two offices and nobody holding one', () => {
    const report = buildBoardReport({ t,
      positions: [position({ id: 'o1' }), position({ id: 'o2', name: 'Treasurer', sort_order: 2 })],
      assignments: [
        { positionId: 'o1', personId: 'p1', personName: 'Ada', areaName: null },
        { positionId: 'o2', personId: 'p1', personName: 'Ada', areaName: null },
        { positionId: 'o2', personId: 'p2', personName: 'Ben', areaName: null },
      ],
    })
    expect(report.multiHolders.map(m => m.name)).toEqual(['Ada'])
    expect(report.multiHolders[0].offices).toEqual(['President', 'Treasurer'])
    expect(report.totals.officers).toBe(2)
    expect(report.totals.assignments).toBe(3)
  })

  it('ignores an assignment naming a position this family does not have', () => {
    // Every read behind this is family-scoped, so such a row is one 20260819000004 should have
    // repointed. Counting it would inflate `assignments` past what the rows add up to.
    const report = buildBoardReport({ t,
      positions: [position()],
      assignments: [
        { positionId: 'o1', personId: 'p1', personName: 'Ada', areaName: null },
        { positionId: 'gone', personId: 'p9', personName: 'Nobody', areaName: null },
      ],
    })
    expect(report.totals.assignments).toBe(1)
    expect(report.totals.officers).toBe(1)
  })

  it('reports an empty board honestly rather than as no positions', () => {
    const report = buildBoardReport({ t, positions: [position()], assignments: [] })
    expect(report.totals).toMatchObject({
      positions: 1, filled: 0, vacant: 1, officers: 0, assignments: 0,
    })
  })
})

/**
 * THE 7PM BOUNDARY ON A DEADLINE — the second bug Phase 2b fixed.
 *
 * `getActivityReports` passed `todayLocal()` into `isOverdue`, and on the server that is UTC,
 * which rolls over at 7pm Central. `isOverdue` is `due_on < today`, so a task due today became
 * overdue five hours before the member's own midnight — and the member had no way to tell,
 * because the screen showed the due date they were still inside.
 *
 * **This is `election_window_open`'s bug in a second costume**, and worth recognising as the
 * same shape: a DEADLINE enforced against the wrong clock. There the refusal came from an RLS
 * policy; here it comes from a figure on a report that an organizer chases people with.
 *
 * The family's zone rather than the reader's, for `resolveFamilyZone`'s reason: two members
 * reading "12 overdue" and "11 overdue" off the same report have no way to discover the
 * difference is their own profiles.
 */
describe('the overdue boundary is the family zone, not the server', () => {
  /** 26 August 19:30 Chicago = 27 August 00:30 UTC. */
  const AT = new Date('2026-08-27T00:30:00Z')
  const dueToday = { status: 'open' as const, due_on: '2026-08-26' }

  it('a task due today is NOT overdue in the family zone, and IS in UTC', () => {
    // THE BUG AND THE FIX. Five hours of a member's own deadline, taken away silently.
    expect(isOverdue(dueToday, todayIn('America/Chicago', AT))).toBe(false)
    expect(isOverdue(dueToday, todayIn('UTC', AT))).toBe(true)
  })

  it('a task genuinely past its date is overdue in both', () => {
    // The control. Without it the assertion above would pass for a function that never reports
    // anything as overdue, which is exactly the vacuous-control shape AGENTS.md §7 is about.
    const stale = { status: 'open' as const, due_on: '2026-08-20' }
    expect(isOverdue(stale, todayIn('America/Chicago', AT))).toBe(true)
    expect(isOverdue(stale, todayIn('UTC', AT))).toBe(true)
  })

  it('and away from the boundary the two agree, which is why it went unnoticed', () => {
    const MIDDAY = new Date('2026-08-26T17:00:00Z')
    expect(isOverdue(dueToday, todayIn('America/Chicago', MIDDAY))).toBe(false)
    expect(isOverdue(dueToday, todayIn('UTC', MIDDAY))).toBe(false)
  })
})
