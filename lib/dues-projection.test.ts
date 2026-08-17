import { describe, expect, it } from 'vitest'
import {
  projectDues, collectedPercent,
  type ProjectionMember, type ProjectionPayment, type ProjectionPlan, type ProjectionSchedule,
} from './dues-projection'

/**
 * The dues projection.
 *
 * WHY THESE EXIST: this is the screen a treasurer takes to a board meeting, and every
 * figure on it is a sum over three reductions that each pull the number down — the age
 * rule, opting out, and waivers. Get any of them wrong and the projection is a bigger
 * number than anybody will ever pay, which is worse than no projection at all.
 *
 * Nothing here reads a clock. `currentPeriodStart` does, inside the module, which is why
 * every schedule below states an explicit `start_date` and the payments are dated inside
 * its period — see the note on ANNUAL. That is the one impurity and it is the reason the
 * period-boundary case is written the way it is.
 */

/**
 * $120 a year, billed annually, opening on 1 January.
 *
 * `start_date` is in the PAST and its anniversary is 1 January, so `currentPeriodStart`
 * returns 1 January of the current year whenever the tests run. The payment dates below are
 * therefore given as "1 July of the current year" rather than a literal, which is what keeps
 * these tests from expiring on 1 January.
 */
const YEAR = new Date().getUTCFullYear()
const inPeriod = (monthDay: string) => `${YEAR}-${monthDay}`
const beforePeriod = (monthDay: string) => `${YEAR - 1}-${monthDay}`

const ANNUAL: ProjectionSchedule = {
  id: 'annual', label: 'Annual Dues', required: true,
  amount_cents: 12_000, frequency: 'annual', start_date: '2020-01-01', end_date: null,
}

/** An optional levy, so opting out is expressible. $60. */
const LEVY: ProjectionSchedule = {
  id: 'levy', label: 'Building Levy', required: false,
  amount_cents: 6_000, frequency: 'annual', start_date: '2020-01-01', end_date: null,
}

/** Two adults with no birthday recorded, so the age rule does not touch them. */
const ADULTS: ProjectionMember[] = [
  { personId: 'ada', dateOfBirth: null },
  { personId: 'ben', dateOfBirth: null },
]

const run = (over: {
  schedules?: readonly ProjectionSchedule[]
  members?: readonly ProjectionMember[]
  payments?: readonly ProjectionPayment[]
  plans?: readonly ProjectionPlan[]
  recordsExcluded?: number
}) => projectDues({
  schedules: over.schedules ?? [ANNUAL],
  members: over.members ?? ADULTS,
  payments: over.payments ?? [],
  plans: over.plans ?? [],
  recordsExcluded: over.recordsExcluded,
})

const pay = (
  personId: string, scheduleId: string, amountCents: number,
  status = 'paid', paymentDate = inPeriod('07-01'),
): ProjectionPayment => ({ personId, scheduleId, amountCents, status, paymentDate })

describe('what the family is owed', () => {
  it('bills every member the schedule’s annual figure', () => {
    const p = run({})

    expect(p.membersCounted).toBe(2)
    expect(p.payingMembers).toBe(2)
    expect(p.expectedCents).toBe(24_000)
    expect(p.collectedCents).toBe(0)
    expect(p.outstandingCents).toBe(24_000)
  })

  it('sums across schedules, each against its own period', () => {
    const p = run({ schedules: [ANNUAL, LEVY] })

    expect(p.expectedCents).toBe(36_000)   // 2 × ($120 + $60)
    expect(p.schedules.map(s => s.label)).toEqual(['Annual Dues', 'Building Levy'])
    expect(p.schedules[0].periodStart).toMatch(/-01-01$/)
  })

  it('takes money off what is still to collect', () => {
    const p = run({ payments: [pay('ada', 'annual', 12_000), pay('ben', 'annual', 5_000)] })

    expect(p.collectedCents).toBe(17_000)
    expect(p.outstandingCents).toBe(7_000)
    expect(p.schedules[0].counts).toMatchObject({ settled: 1, partial: 1, unpaid: 0 })
  })

  it('reports a member with nothing in as unpaid rather than partial', () => {
    const p = run({ payments: [pay('ada', 'annual', 12_000)] })
    expect(p.schedules[0].counts).toMatchObject({ settled: 1, unpaid: 1, partial: 0 })
  })
})

describe('a waiver settles without being money', () => {
  it('comes off what is outstanding and never off what was collected', () => {
    const p = run({ payments: [pay('ada', 'annual', 12_000, 'waived')] })

    expect(p.waivedCents).toBe(12_000)
    // The one thing that must never happen: a forgiven due appearing as income.
    expect(p.collectedCents).toBe(0)
    expect(p.outstandingCents).toBe(12_000)   // Ben's, and Ben's alone
    expect(p.schedules[0].counts.settled).toBe(1)
  })
})

describe('pending money is its own figure', () => {
  it('is neither collected nor deducted from what is owed', () => {
    // Nothing writes this state today — recordPayment refuses it — so the assertion is
    // about the shape being ready rather than about a number a family will see. It must
    // not be counted as collected: the money has not arrived.
    const p = run({ payments: [pay('ada', 'annual', 12_000, 'pending')] })

    expect(p.pendingCents).toBe(12_000)
    expect(p.collectedCents).toBe(0)
    expect(p.outstandingCents).toBe(24_000)
  })
})

describe('opting out', () => {
  it('removes an optional due from the expected total entirely', () => {
    const p = run({
      schedules: [LEVY],
      plans: [{ personId: 'ada', scheduleId: 'levy', optedOut: true }],
    })

    // Ada owes nothing, so the family is not owed it either. Leaving it in would be a
    // debt nobody is going to pay sitting in the projection forever.
    expect(p.expectedCents).toBe(6_000)
    expect(p.payingMembers).toBe(1)
    expect(p.schedules[0].counts).toMatchObject({ declined: 1, unpaid: 1 })
  })

  it('is ignored on a REQUIRED due, whatever the plan row says', () => {
    // A row that predates the database guard, or a schedule made required after somebody
    // opted out. Either way they owe it.
    const p = run({ plans: [{ personId: 'ada', scheduleId: 'annual', optedOut: true }] })

    expect(p.expectedCents).toBe(24_000)
    expect(p.schedules[0].counts.declined).toBe(0)
  })
})

describe('the age rule', () => {
  const FROM_18: ProjectionSchedule = { ...ANNUAL, start_age: 18 }

  it('bills nothing to a member below the age', () => {
    const p = run({
      schedules: [FROM_18],
      members: [{ personId: 'kid', dateOfBirth: `${YEAR - 8}-04-01` }],
    })

    expect(p.expectedCents).toBe(0)
    expect(p.payingMembers).toBe(0)
    expect(p.schedules[0].counts.exempt).toBe(1)
    // Exempt is NOT settled. A treasurer reading "1 settled" would think a child had paid.
    expect(p.schedules[0].counts.settled).toBe(0)
  })

  it('bills the prorated share in the year they reach it', () => {
    // Eighteen this July: the months after their birthday month, five twelfths of $120.
    const p = run({
      schedules: [FROM_18],
      members: [{ personId: 'kid', dateOfBirth: `${YEAR - 18}-07-04` }],
    })

    expect(p.expectedCents).toBe(5_000)
    expect(p.payingMembers).toBe(1)
    expect(p.schedules[0].counts.unpaid).toBe(1)
  })

  it('bills a member with no birthday recorded in full', () => {
    // The product never guesses at an age, so an unrecorded birthday is an adult. This is
    // the figure a treasurer must be able to explain, which is why the screen says it.
    const p = run({ schedules: [FROM_18], members: [{ personId: 'ada', dateOfBirth: null }] })
    expect(p.expectedCents).toBe(12_000)
  })
})

describe('which money counts', () => {
  it('ignores a payment from before this period', () => {
    // Last year's money settled last year's due. Counting it here would report the family
    // as paid up on a year nobody has paid for.
    const p = run({ payments: [pay('ada', 'annual', 12_000, 'paid', beforePeriod('07-01'))] })

    expect(p.collectedCents).toBe(0)
    expect(p.outstandingCents).toBe(24_000)
  })

  it('ignores a payment against a schedule the projection does not cover', () => {
    // A donation, or an inactive due. The caller filters the schedule list; a stray payment
    // row must not land on a schedule that is not being reported.
    const p = run({ payments: [pay('ada', 'ghost-schedule', 50_000)] })
    expect(p.collectedCents).toBe(0)
  })

  it('nets a reversal out, because a reversal is a negative paid row', () => {
    const p = run({
      payments: [pay('ada', 'annual', 12_000), pay('ada', 'annual', -12_000)],
    })

    expect(p.collectedCents).toBe(0)
    expect(p.outstandingCents).toBe(24_000)
  })
})

describe('one member’s overpayment does not pay somebody else’s dues', () => {
  it('floors outstanding per member per schedule rather than family-wide', () => {
    // Ada pays double. Ben has paid nothing. The family is still owed Ben's $120 — and a
    // family total derived from expected-less-collected would report $0 and lose him.
    const p = run({ payments: [pay('ada', 'annual', 24_000)] })

    expect(p.collectedCents).toBe(24_000)
    expect(p.expectedCents).toBe(24_000)
    expect(p.outstandingCents).toBe(12_000)
  })
})

describe('the member rows', () => {
  it('carry one row per member with their own totals', () => {
    const p = run({
      schedules: [ANNUAL, LEVY],
      payments: [pay('ada', 'annual', 12_000)],
    })
    const ada = p.members.find(m => m.personId === 'ada')!

    expect(ada.expectedCents).toBe(18_000)
    expect(ada.collectedCents).toBe(12_000)
    expect(ada.outstandingCents).toBe(6_000)
    expect(ada.liableSchedules).toBe(2)
  })

  it('report the LEAST settled standing held on any schedule', () => {
    // Paid up on the dues, owing the levy. A member who owes is a member who owes, and a
    // row reporting "settled" because one of two schedules is clear would hide them.
    const p = run({ schedules: [ANNUAL, LEVY], payments: [pay('ada', 'annual', 12_000)] })
    expect(p.members.find(m => m.personId === 'ada')!.standing).toBe('unpaid')
  })

  it('are present for a member who owes nothing at all', () => {
    const p = run({ schedules: [], members: ADULTS })

    expect(p.members.length).toBe(2)
    expect(p.payingMembers).toBe(0)
    expect(p.members[0].standing).toBe('settled')
  })
})

describe('the answers about who was counted', () => {
  it('echoes the roster size and the records left out of it', () => {
    // Accounts only — a recorded grandmother is family and is not somebody a cheque is
    // expected from. The count is surfaced so this screen's member total can be reconciled
    // against the Directory rather than quietly disagreeing with it.
    const p = run({ recordsExcluded: 12 })

    expect(p.membersCounted).toBe(2)
    expect(p.recordsExcluded).toBe(12)
  })

  it('reports an empty family without inventing a total', () => {
    const p = run({ members: [] })

    expect(p.membersCounted).toBe(0)
    expect(p.expectedCents).toBe(0)
    expect(p.schedules[0].payingMembers).toBe(0)
  })
})

describe('collectedPercent', () => {
  it('counts a waiver as settled, because it settles the obligation', () => {
    expect(collectedPercent({
      expectedCents: 100, collectedCents: 25, waivedCents: 25,
      pendingCents: 0, outstandingCents: 50,
    })).toBe(50)
  })

  it('is 0 for a family that has billed nothing, not 100', () => {
    expect(collectedPercent({
      expectedCents: 0, collectedCents: 0, waivedCents: 0,
      pendingCents: 0, outstandingCents: 0,
    })).toBe(0)
  })

  it('goes past 100 rather than hiding an over-collection', () => {
    // A duplicate entry, or a payment posted against the wrong period. A treasurer needs
    // to see it; clamping would hide the discrepancy this screen exists to surface.
    expect(collectedPercent({
      expectedCents: 100, collectedCents: 150, waivedCents: 0,
      pendingCents: 0, outstandingCents: 0,
    })).toBe(150)
  })
})
