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
 *
 * ── THE SCOPE BLOCK WAS CHECKED BY MUTATION, per AGENTS.md §7b ──────────────────────
 * Three mutations of `lib/dues-projection.ts`; observed results, not expected:
 *
 *   dropping `|| outOfScope` from `expectedCents`      6 failed
 *   `excluded` tested before `outOfScope`              1 failed — the precedence case
 *   dropping `duesScope(schedule) !== 'national'`
 *     from `scopeEmpty`                               229 PASSED — see below
 *
 * THE THIRD ONE IS NOT EVIDENCE AND IS LABELLED RATHER THAN LEFT LOOKING LIKE IT IS, which
 * is what AGENTS.md §7 asks for when a mutation does not trip. That conjunct is provably
 * redundant today: `duesScopeMatch` answers 'owed' for every member of a national due, so
 * `counts['out-of-scope']` is zero and can never equal a non-zero member count. It is kept
 * as a statement of intent — `scopeEmpty` is a fact about a SCOPED due — and because the
 * emergent property it leans on is one line of `duesScopeMatch` away from changing. No test
 * here can distinguish the two versions, and none pretends to.
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
  bloodline?: ReadonlySet<string> | null
  chapterRegions?: ReadonlyMap<string, string | null>
}) => projectDues({
  schedules: over.schedules ?? [ANNUAL],
  members: over.members ?? ADULTS,
  payments: over.payments ?? [],
  plans: over.plans ?? [],
  recordsExcluded: over.recordsExcluded,
  // Passed straight through, `undefined` included: "not supplied" has to stay
  // distinguishable from `null`, because one of the cases below is precisely that a caller
  // who never loaded the tree must not accidentally bill the whole family.
  bloodline: over.bloodline,
  // Also passed straight through. Omitted is the same as a family with no chapters, which
  // is a case below rather than a default worth hiding.
  chapterRegions: over.chapterRegions,
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

describe('a due the bloodline alone owes', () => {
  const BLOOD: ProjectionSchedule = { ...ANNUAL, bloodline_only: true }

  it('bills the bloodline and nobody else', () => {
    const p = run({ schedules: [BLOOD], bloodline: new Set(['ada']) })

    expect(p.expectedCents).toBe(12_000)     // Ada's, not Ada's and Ben's
    expect(p.payingMembers).toBe(1)
    expect(p.schedules[0].counts).toMatchObject({ unpaid: 1, excluded: 1 })
    expect(p.schedules[0].bloodlineOnly).toBe(true)
    expect(p.schedules[0].bloodlineUnknown).toBe(false)
  })

  it('reports the excluded member as "not theirs", never as settled or exempt', () => {
    // Both would be answers to a question nobody asked. Settled says they paid; exempt
    // says they will pay later. Neither is true of somebody who married in.
    const p = run({ schedules: [BLOOD], bloodline: new Set(['ada']) })
    const ben = p.members.find(m => m.personId === 'ben')!

    expect(ben.standing).toBe('excluded')
    expect(ben.expectedCents).toBe(0)
    expect(ben.liableSchedules).toBe(0)
  })

  it('takes precedence over the age rule', () => {
    // A child who married in is not "not yet due" on a due they will never owe. The
    // ordering in projectDues is what makes this true, and it is the reason the two are
    // separate standings rather than one.
    const p = run({
      schedules: [{ ...BLOOD, start_age: 18 }],
      members: [{ personId: 'kid', dateOfBirth: `${YEAR - 8}-04-01` }],
      bloodline: new Set(['someone-else']),
    })

    expect(p.schedules[0].counts).toMatchObject({ excluded: 1, exempt: 0 })
  })

  it('BILLS NOBODY when the family has no bloodline, and says so', () => {
    // The direction that matters. Billing everybody would charge the step-children the
    // family ticked this box to exclude, silently. Billing nobody is visible — and
    // `bloodlineUnknown` is what makes it explicable rather than an unexplained zero.
    const p = run({ schedules: [BLOOD], bloodline: null })

    expect(p.expectedCents).toBe(0)
    expect(p.payingMembers).toBe(0)
    expect(p.schedules[0].bloodlineUnknown).toBe(true)
    expect(p.schedules[0].counts.excluded).toBe(2)
  })

  it('treats an omitted bloodline as not knowing, not as an empty set', () => {
    // A caller that never loaded the tree must not accidentally bill the whole family.
    const p = run({ schedules: [BLOOD] })
    expect(p.expectedCents).toBe(0)
    expect(p.schedules[0].bloodlineUnknown).toBe(true)
  })

  it('says nothing about the bloodline on a due open to everybody', () => {
    // The flag is off, so an unset anchor is irrelevant and a warning here would be a
    // warning about nothing.
    const p = run({ schedules: [ANNUAL], bloodline: null })

    expect(p.schedules[0].bloodlineOnly).toBe(false)
    expect(p.schedules[0].bloodlineUnknown).toBe(false)
    expect(p.expectedCents).toBe(24_000)
  })

  it('leaves a member owing a second, unrestricted due', () => {
    // Ben is outside the line, so he owes nothing on the restricted due and everything on
    // the open one. His row reports the least settled standing he holds, which is the
    // levy's — not 'excluded', which would read as owing nothing at all.
    const p = run({ schedules: [BLOOD, LEVY], bloodline: new Set(['ada']) })
    const ben = p.members.find(m => m.personId === 'ben')!

    expect(ben.expectedCents).toBe(6_000)
    expect(ben.liableSchedules).toBe(1)
    expect(ben.standing).toBe('unpaid')
  })
})

describe('a due one region or chapter owes', () => {
  // Ada is in the Houston chapter, which is in the Texas region. Ben is in Atlanta, which
  // is under National — a real state, and the one that makes 'other-region' distinguishable
  // from 'no-chapter'.
  const CHAPTER_REGIONS = new Map<string, string | null>([
    ['houston', 'texas'],
    ['atlanta', null],
  ])
  const PLACED: ProjectionMember[] = [
    { personId: 'ada', dateOfBirth: null, chapterId: 'houston' },
    { personId: 'ben', dateOfBirth: null, chapterId: 'atlanta' },
  ]
  const CHAPTER_DUE: ProjectionSchedule = {
    ...ANNUAL, scope: 'chapter', chapter_id: 'houston', region_id: null,
  }
  const REGION_DUE: ProjectionSchedule = {
    ...ANNUAL, scope: 'regional', region_id: 'texas', chapter_id: null,
  }

  it('bills only the members in that chapter', () => {
    const p = run({ schedules: [CHAPTER_DUE], members: PLACED, chapterRegions: CHAPTER_REGIONS })

    expect(p.expectedCents).toBe(12_000)     // Ada's, not Ada's and Ben's
    expect(p.payingMembers).toBe(1)
    expect(p.schedules[0].counts).toMatchObject({ unpaid: 1, 'out-of-scope': 1 })
    expect(p.schedules[0].scope).toBe('chapter')
    expect(p.schedules[0].chapterId).toBe('houston')
  })

  it('bills only the members whose CHAPTER is in that region', () => {
    // The derivation is the whole point: nothing on the member says "texas", and nothing
    // may. Ada is in it through Houston; Ben is not, because Atlanta is under National.
    const p = run({ schedules: [REGION_DUE], members: PLACED, chapterRegions: CHAPTER_REGIONS })

    expect(p.expectedCents).toBe(12_000)
    expect(p.schedules[0].counts).toMatchObject({ unpaid: 1, 'out-of-scope': 1 })
    expect(p.schedules[0].regionId).toBe('texas')
  })

  it('bills a member with NO chapter nothing scoped, and everything national', () => {
    // The rule that has to be stated somewhere a reader will find it: an unplaced member is
    // under National. They owe the national due in full and neither scoped one.
    const p = run({
      schedules: [ANNUAL, CHAPTER_DUE, REGION_DUE],
      members: [{ personId: 'nomad', dateOfBirth: null, chapterId: null }],
      chapterRegions: CHAPTER_REGIONS,
    })

    expect(p.expectedCents).toBe(12_000)
    const [national, chapter, region] = p.schedules
    expect(national.counts).toMatchObject({ unpaid: 1 })
    expect(chapter.counts).toMatchObject({ 'out-of-scope': 1 })
    expect(region.counts).toMatchObject({ 'out-of-scope': 1 })
  })

  it('reports out-of-scope AHEAD of the bloodline, not as a kind of it', () => {
    // A Georgia member is not "not blood" on a Texas due — the due was never addressed to
    // them, so the bloodline question does not arise. The ordering in projectDues is what
    // makes this true, and it is why the two are separate standings.
    const p = run({
      schedules: [{ ...CHAPTER_DUE, bloodline_only: true }],
      members: PLACED,
      chapterRegions: CHAPTER_REGIONS,
      bloodline: new Set(['ada']),
    })

    expect(p.schedules[0].counts).toMatchObject({ 'out-of-scope': 1, excluded: 0, unpaid: 1 })
  })

  it('reports a scoped due that bills NOBODY, rather than an unexplained zero', () => {
    // The commonest mistake with this feature: a chapter created before anybody has joined
    // it. Expected reads $0.00 and there is nothing in the figures to say why.
    const p = run({
      schedules: [{ ...CHAPTER_DUE, chapter_id: 'dallas' }],
      members: PLACED,
      chapterRegions: CHAPTER_REGIONS,
    })

    expect(p.expectedCents).toBe(0)
    expect(p.schedules[0].scopeEmpty).toBe(true)
  })

  it('says nothing about scope on a national due', () => {
    // A warning about nothing. Every family with no chapters is in this state, so a
    // `scopeEmpty` here would fire for all of them.
    const p = run({ schedules: [ANNUAL], members: PLACED, chapterRegions: CHAPTER_REGIONS })

    expect(p.schedules[0].scope).toBe('national')
    expect(p.schedules[0].scopeEmpty).toBe(false)
    expect(p.expectedCents).toBe(24_000)
  })

  it('bills nobody when the chapter map is missing, rather than everybody', () => {
    // A caller that did not load chapters — or whose read was refused — must not
    // accidentally bill the whole family for one region's levy. Under-collecting is
    // visible; over-billing the wrong half of the family is not.
    const p = run({ schedules: [REGION_DUE], members: PLACED })

    expect(p.expectedCents).toBe(0)
    expect(p.schedules[0].counts['out-of-scope']).toBe(2)
  })

  it('leaves a member owing the national due beside a chapter due that is not theirs', () => {
    const p = run({
      schedules: [CHAPTER_DUE, ANNUAL], members: PLACED, chapterRegions: CHAPTER_REGIONS,
    })
    const ben = p.members.find(m => m.personId === 'ben')!

    expect(ben.expectedCents).toBe(12_000)
    expect(ben.liableSchedules).toBe(1)
    expect(ben.standing).toBe('unpaid')
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
