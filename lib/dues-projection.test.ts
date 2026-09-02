import { describe, expect, it } from 'vitest'
import {
  projectDues, collectedPercent, memberStatus, invitedPersonIds,
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
 *
 * ── THE THREE STATES WERE CHECKED BY MUTATION TOO ───────────────────────────────────
 * Nine mutations of `lib/dues-projection.ts`, run with
 * `npx vitest run lib/dues-projection.test.ts`; observed results, not expected:
 *
 *   `memberStatus` returns 'active' unconditionally               6 failed
 *   `memberStatus` drops the `invitationOpen` branch              2 failed
 *   `unregisteredOutstandingCents` loses its `!== 'active'`
 *     guard and sums every member                                2 failed
 *   `statusCounts[status]++` deleted                              3 failed
 *   `invitedPersonIds`: the `invited_person_id` branch deleted    2 failed
 *   `invitedPersonIds`: the address branch deleted                2 failed
 *   `invitedPersonIds`: `waiting.has(...)` dropped, so an id
 *     arriving on the invitation is trusted                       1 failed
 *   `invitedPersonIds`: `if (person.hasAccount) continue` gone    1 failed
 *   the invitation address compared case-sensitively              1 failed
 *
 * ONE MUTATION THAT MATTERS IS NOT AVAILABLE HERE, and it is named rather than left looking
 * covered: putting `.filter(p => p.user_id)` back on the roster in `getDuesProjection`. That is
 * the accounts-only behaviour this change reverses, it lives in a server action, and §7b is
 * explicit that an action is not tested here. `dues.getDuesProjection` in `tests/rls/cases.mjs`
 * is where it is caught — its positive control asserts a seeded record is in the roster.
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

/**
 * Two adults with no birthday recorded, so the age rule does not touch them.
 *
 * `hasAccount: true` on both, and it is stated rather than defaulted because the module gives
 * the field no default — see `ProjectionMember`. Everything in the blocks above is about the
 * arithmetic, which is identical for all three states; the three states have their own block
 * at the end of this file.
 */
// `isBloodline` STATED ON BOTH, for `hasAccount`'s reason: the module gives it no default.
// ADA IS IN THE BLOODLINE AND BEN IS NOT, which is what makes the blood-only block at the
// end of this file able to say anything — it used to be expressed by passing a `bloodline`
// SET to `projectDues`, and `20260902000000` moved it onto the member.
const ADULTS: ProjectionMember[] = [
  { personId: 'ada', dateOfBirth: null, hasAccount: true, isBloodline: true },
  { personId: 'ben', dateOfBirth: null, hasAccount: true, isBloodline: false },
]

const run = (over: {
  schedules?: readonly ProjectionSchedule[]
  members?: readonly ProjectionMember[]
  payments?: readonly ProjectionPayment[]
  plans?: readonly ProjectionPlan[]
  chapterRegions?: ReadonlyMap<string, string | null>
}) => projectDues({
  schedules: over.schedules ?? [ANNUAL],
  members: over.members ?? ADULTS,
  payments: over.payments ?? [],
  plans: over.plans ?? [],
  // Passed straight through. Omitted is the same as a family with no chapters, which
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
      members: [{ personId: 'kid', dateOfBirth: `${YEAR - 8}-04-01`, hasAccount: true, isBloodline: false }],
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
      members: [{ personId: 'kid', dateOfBirth: `${YEAR - 18}-07-04`, hasAccount: true, isBloodline: false }],
    })

    expect(p.expectedCents).toBe(5_000)
    expect(p.payingMembers).toBe(1)
    expect(p.schedules[0].counts.unpaid).toBe(1)
  })

  it('bills a member with no birthday recorded in full', () => {
    // The product never guesses at an age, so an unrecorded birthday is an adult. This is
    // the figure a treasurer must be able to explain, which is why the screen says it.
    const p = run({
      schedules: [FROM_18], members: [{ personId: 'ada', dateOfBirth: null, hasAccount: true, isBloodline: true }],
    })
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
  it('counts every approved person, whether or not they finished registering', () => {
    // THE REVERSAL of §4b's accounts-only rule for dues surfaces, and the reason this block
    // changed shape rather than gaining a case. A grandmother recorded on the tree owes her
    // dues; leaving her out never made the debt smaller, it made the projection report a
    // smaller one. `membersCounted` is now the Member Directory's own count.
    const p = run({
      members: [
        { personId: 'ada', dateOfBirth: null, hasAccount: true, isBloodline: true },
        { personId: 'gran', dateOfBirth: null, hasAccount: false, isBloodline: false },
      ],
    })

    expect(p.membersCounted).toBe(2)
    expect(p.expectedCents).toBe(24_000)          // both, not Ada's $120 alone
    expect(p.payingMembers).toBe(2)
    expect(p.statusCounts).toEqual({ active: 1, invited: 0, 'pending-invite': 1 })
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

  // ── IT WAS A SET PASSED IN; IT IS A COLUMN ON THE MEMBER ─────────────────────────
  // `projectDues` took `bloodline?: ReadonlySet<string> | null` and tested membership.
  // `20260902000000` replaced the whole derivation behind that set with
  // `people.is_bloodline`, so the fact now arrives on the member row — `ADULTS` above marks
  // Ada and not Ben.
  //
  // TWO TESTS WENT WITH IT and one arrived, and the swap is worth reading. The two asserted
  // that a NULL set and an OMITTED set both meant "do not know" and both billed nobody;
  // there is no third state to distinguish now. What replaced them asserts the same
  // OUTCOME — a blood-only due with nobody marked bills nobody — plus the thing that state
  // could never express: which schedule row says so.

  it('bills the bloodline and nobody else', () => {
    const p = run({ schedules: [BLOOD] })

    expect(p.expectedCents).toBe(12_000)     // Ada's, not Ada's and Ben's
    expect(p.payingMembers).toBe(1)
    expect(p.schedules[0].counts).toMatchObject({ unpaid: 1, excluded: 1 })
    expect(p.schedules[0].bloodlineOnly).toBe(true)
    // Somebody IS marked, so the row is not the empty case.
    expect(p.schedules[0].bloodlineEmpty).toBe(false)
  })

  it('reports the excluded member as "not theirs", never as settled or exempt', () => {
    // Both would be answers to a question nobody asked. Settled says they paid; exempt
    // says they will pay later. Neither is true of somebody who married in.
    const p = run({ schedules: [BLOOD] })
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
      members: [{
        personId: 'kid', dateOfBirth: `${YEAR - 8}-04-01`,
        hasAccount: true, isBloodline: false,
      }],
    })

    expect(p.schedules[0].counts).toMatchObject({ excluded: 1, exempt: 0 })
  })

  it('BILLS NOBODY when the family has marked nobody, and says so on the row', () => {
    // THE DIRECTION THAT MATTERS, and it is the one the deleted 'bloodline-unknown' state
    // existed to protect: billing everybody would charge the relatives the family ticked
    // this box to exclude, silently. Billing nobody is visible — and `bloodlineEmpty` is
    // what makes it explicable rather than an unexplained zero.
    //
    // The old version of this test passed `bloodline: null`. There is no null; a family
    // that has said nothing has an all-false column, which is what this roster is.
    const p = run({
      schedules: [BLOOD],
      members: [
        { personId: 'ada', dateOfBirth: null, hasAccount: true, isBloodline: false },
        { personId: 'ben', dateOfBirth: null, hasAccount: true, isBloodline: false },
      ],
    })

    expect(p.expectedCents).toBe(0)
    expect(p.payingMembers).toBe(0)
    expect(p.schedules[0].bloodlineEmpty).toBe(true)
    expect(p.schedules[0].counts.excluded).toBe(2)
  })

  it('says nothing about the bloodline on a due open to everybody', () => {
    // The flag is off, so nobody being marked is irrelevant and a warning here would be a
    // warning about nothing. The FIRST CONJUNCT of `bloodlineEmpty` is what this pins —
    // unlike `scopeEmpty`'s, it is not redundant: this roster would satisfy the other two.
    const p = run({
      schedules: [ANNUAL],
      members: [
        { personId: 'ada', dateOfBirth: null, hasAccount: true, isBloodline: false },
        { personId: 'ben', dateOfBirth: null, hasAccount: true, isBloodline: false },
      ],
    })

    expect(p.schedules[0].bloodlineOnly).toBe(false)
    expect(p.schedules[0].bloodlineEmpty).toBe(false)
    expect(p.expectedCents).toBe(24_000)
  })

  it('is not the empty case for a family with no members at all', () => {
    // The third conjunct. Nothing to report either way, which the zero member count
    // already says — the same judgement `scopeEmpty` makes, and the reason both carry it.
    const p = run({ schedules: [BLOOD], members: [] })

    expect(p.schedules[0].bloodlineEmpty).toBe(false)
  })

  it('leaves a member owing a second, unrestricted due', () => {
    // Ben is outside the line, so he owes nothing on the restricted due and everything on
    // the open one. His row reports the least settled standing he holds, which is the
    // levy's — not 'excluded', which would read as owing nothing at all.
    const p = run({ schedules: [BLOOD, LEVY] })
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
    { personId: 'ada', dateOfBirth: null, chapterId: 'houston', hasAccount: true, isBloodline: true },
    { personId: 'ben', dateOfBirth: null, chapterId: 'atlanta', hasAccount: true, isBloodline: false },
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
      members: [{ personId: 'nomad', dateOfBirth: null, chapterId: null, hasAccount: true, isBloodline: false }],
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

/**
 * ── ACTIVE / INVITED / PENDING INVITE ───────────────────────────────────────────────
 * The three states exist because the roster stopped being accounts-only: once somebody who
 * has never signed in is counted as owing money, the screen has to say whether there is
 * anybody to send the invoice to. Not one of these branches changes a figure, which is what
 * most of the cases below are about — a status that quietly reduced Expected would be the
 * accounts-only bug wearing a new name.
 */
describe('Active, Invited and Pending Invite', () => {
  it('is Active for anybody with an account, whatever an invitation says', () => {
    // An account wins. A stale open invitation addressed to somebody who joined by another
    // door must not report them as still being asked.
    expect(memberStatus({ hasAccount: true })).toBe('active')
    expect(memberStatus({ hasAccount: true, invitationOpen: true })).toBe('active')
  })

  it('is Invited for somebody with no account the family has asked', () => {
    expect(memberStatus({ hasAccount: false, invitationOpen: true })).toBe('invited')
  })

  it('is Pending Invite for a record nobody has asked, and for an unsupplied answer', () => {
    // The one state a treasurer can act on today, which is why it is not folded into "no
    // account". `undefined` reads as "not asked" deliberately: it names work to do, which is
    // recoverable, where a wrong 'invited' reports work as already done.
    expect(memberStatus({ hasAccount: false, invitationOpen: false })).toBe('pending-invite')
    expect(memberStatus({ hasAccount: false })).toBe('pending-invite')
  })

  it('puts the state on every member row and counts it once', () => {
    const p = run({
      members: [
        { personId: 'ada', dateOfBirth: null, hasAccount: true, isBloodline: true },
        { personId: 'asked', dateOfBirth: null, hasAccount: false, invitationOpen: true, isBloodline: false },
        { personId: 'gran', dateOfBirth: null, hasAccount: false, isBloodline: false },
      ],
    })

    expect(p.members.map(m => m.status)).toEqual(['active', 'invited', 'pending-invite'])
    expect(p.statusCounts).toEqual({ active: 1, invited: 1, 'pending-invite': 1 })
    // The counts account for everybody, so a caption built from them cannot leave a state off
    // and still add up to the member total.
    const counted = p.statusCounts.active + p.statusCounts.invited
      + p.statusCounts['pending-invite']
    expect(counted).toBe(p.membersCounted)
  })

  it('charges all three states the same, because all three owe it', () => {
    // The load-bearing case. Having no account is not a reduction — the five reductions are
    // the age rule, the bloodline, the scope, opting out and a waiver, and this is none of
    // them. A status that reduced Expected would report a debt smaller than the real one,
    // which is the bug the roster change exists to fix.
    const p = run({
      members: [
        { personId: 'ada', dateOfBirth: null, hasAccount: true, isBloodline: true },
        { personId: 'asked', dateOfBirth: null, hasAccount: false, invitationOpen: true, isBloodline: false },
        { personId: 'gran', dateOfBirth: null, hasAccount: false, isBloodline: false },
      ],
    })

    expect(p.expectedCents).toBe(36_000)
    expect(p.outstandingCents).toBe(36_000)
    for (const m of p.members) expect(m.expectedCents).toBe(12_000)
  })

  it('reports how much of the outstanding total nobody can be invoiced for', () => {
    // A SUBSET of `outstandingCents`, never a deduction from it. "Still to collect $360" reads
    // as a list of people to chase, and two thirds of this one belongs to relatives who cannot
    // see a due, let alone pay one.
    const p = run({
      members: [
        { personId: 'ada', dateOfBirth: null, hasAccount: true, isBloodline: true },
        { personId: 'asked', dateOfBirth: null, hasAccount: false, invitationOpen: true, isBloodline: false },
        { personId: 'gran', dateOfBirth: null, hasAccount: false, isBloodline: false },
      ],
    })

    expect(p.outstandingCents).toBe(36_000)
    expect(p.unregisteredOutstandingCents).toBe(24_000)   // asked + gran, not Ada
  })

  it('leaves a settled record out of that figure', () => {
    // A waiver settles the obligation, so there is nothing left that anybody cannot be
    // invoiced for. Built from the same per-member outstanding the rows show, so the sentence
    // and the table cannot disagree.
    const p = run({
      members: [
        { personId: 'ada', dateOfBirth: null, hasAccount: true, isBloodline: true },
        { personId: 'gran', dateOfBirth: null, hasAccount: false, isBloodline: false },
      ],
      payments: [pay('gran', 'annual', 12_000, 'waived')],
    })

    expect(p.outstandingCents).toBe(12_000)               // Ada's
    expect(p.unregisteredOutstandingCents).toBe(0)
  })

  it('is zero across the board for a family with nobody in it', () => {
    const p = run({ members: [] })

    expect(p.statusCounts).toEqual({ active: 0, invited: 0, 'pending-invite': 0 })
    expect(p.unregisteredOutstandingCents).toBe(0)
  })

  it('says nothing about the bloodline, and bills an excluded record nothing', () => {
    // The two rules are orthogonal and have to stay so. Gran is outside the line, so she owes
    // nothing on a bloodline-only due however reachable she is; the blood record owes it in
    // full however unreachable he is. Gating the ROSTER on descent would have billed one of
    // them and not the other on the levy, whose own flag says descent is irrelevant.
    const p = run({
      schedules: [{ ...ANNUAL, bloodline_only: true }, LEVY],
      members: [
        { personId: 'blood-record', dateOfBirth: null, hasAccount: false, isBloodline: true },
        { personId: 'gran', dateOfBirth: null, hasAccount: false, isBloodline: false },
      ],
    })

    const [blood, levy] = p.schedules
    expect(blood.expectedCents).toBe(12_000)
    expect(blood.counts).toMatchObject({ unpaid: 1, excluded: 1 })
    // And the open due is owed by both of them, neither having an account.
    expect(levy.expectedCents).toBe(12_000)
    expect(p.statusCounts['pending-invite']).toBe(2)
  })
})

describe('joining open invitations to the people they are about', () => {
  const gran = { personId: 'gran', hasAccount: false, email: 'GRAN@example.com' }
  const ada = { personId: 'ada', hasAccount: true, email: 'ada@example.com' }
  /** A record with no address at all — reachable only by the id an invitation names. */
  const nameless = { personId: 'nameless', hasAccount: false, email: null }

  it('matches the invitation that names the record', () => {
    const open = invitedPersonIds([gran, ada], [{ personId: 'gran', email: 'new@example.com' }])
    expect([...open]).toEqual(['gran'])
  })

  it('matches on the address when the invitation names no record', () => {
    // Two doors write no person id: the invite dialog on Members & Access, which takes an
    // address and nothing else, and `resendInvitation`, which re-mints without carrying the
    // link through. Matching on the id alone would file both under "nobody has asked them".
    const open = invitedPersonIds([gran, ada], [{ personId: null, email: 'gran@example.com' }])
    expect([...open]).toEqual(['gran'])
  })

  it('matches an address in any case, either side', () => {
    // The database lower-cases what it stores; `people.primary_email` is not guaranteed to be.
    const open = invitedPersonIds([gran], [{ personId: null, email: 'Gran@EXAMPLE.com' }])
    expect([...open]).toEqual(['gran'])
  })

  it('reaches a record with no address through the id', () => {
    const open = invitedPersonIds([nameless], [{ personId: 'nameless', email: 'x@example.com' }])
    expect([...open]).toEqual(['nameless'])
  })

  it('never marks somebody who already has an account', () => {
    // An account wins over an invitation — the same rule `memberStatus` applies, applied here
    // too so the two cannot drift apart. Both branches are covered: the id and the address.
    const open = invitedPersonIds([ada], [
      { personId: 'ada', email: 'other@example.com' },
      { personId: null, email: 'ada@example.com' },
    ])
    expect(open.size).toBe(0)
  })

  it('ignores an invitation about nobody on the roster', () => {
    // The ordinary case: a family invites a brand-new address. There is no `people` row to
    // mark and nothing is owed by them yet, so the projection has nothing to say about it.
    const open = invitedPersonIds([gran], [{ personId: null, email: 'stranger@example.com' }])
    expect(open.size).toBe(0)
  })

  it('is empty when there are no open invitations', () => {
    expect(invitedPersonIds([gran, ada], []).size).toBe(0)
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
