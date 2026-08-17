import {
  annualTotalCents, ageShareOfPeriod, proratedAnnualCents, currentPeriodStart,
  duesEligibility,
  type DuesScheduleLike,
} from '@/lib/dues-utils'

/**
 * What the family should collect in dues this year, what it has, and from whom.
 *
 * ── WHY THIS IS A PURE MODULE AND NOT A QUERY ───────────────────────────────────────
 * Because it is arithmetic, and §7b is explicit about where arithmetic gets checked: the
 * RLS suite calls actions for real against real policies and cannot check a figure — its
 * fixtures seed dues schedules with no `start_date` at all, so an assertion about a
 * projection there would exercise one null branch and pass while testing nothing.
 *
 * Every input arrives as an argument, `today` included, so the whole roll-up is runnable.
 * The server action above it does exactly two things this cannot: it decides who is
 * allowed to ask, and it reads the four tables.
 *
 * ── EACH SCHEDULE IS MEASURED AGAINST ITS OWN YEAR ──────────────────────────────────
 * There is no single family-wide "year" to report against, and inventing one would be the
 * worst kind of wrong. `currentPeriodStart` is a property of the SCHEDULE — anchored on its
 * `start_date`, or its `due_month`, or January 1st as a last resort — so a family running
 * dues from 1 April and a building levy from 1 January genuinely have two years in progress.
 *
 * Measuring both against a calendar year instead would make this screen disagree with every
 * member's own balance on /dues, which is computed per schedule by `getMyDuesSummary`. Two
 * screens reporting different debts for the same member is the one outcome a treasurer
 * cannot work with, so the family total is the SUM of each schedule's own current period and
 * every row carries the period it was measured over.
 *
 * ── EXPECTED IS NOT "AMOUNT × MEMBERS" ──────────────────────────────────────────────
 * Three things reduce what a member owes below the schedule's headline figure, and all three
 * have to be honoured here or the projection is a bigger number than anybody will ever pay:
 *
 *   the age rule     `dues_schedules.start_age` (20260814000000). A member reaching the age
 *                    in July owes the months after their birthday month — five twelfths —
 *                    and nothing at all in the years before. `ageShareOfPeriod` decides it.
 *   opting out       an OPTIONAL due a member has declined is owed by nobody, so it leaves
 *                    the expected total rather than sitting in it as a debt nobody will pay.
 *   a waiver         settles the obligation without money arriving. It comes off what is
 *                    still to collect and must never reach a collected total — see
 *                    `waivedCents`, which is its own field for exactly that reason.
 *
 * ── ACCOUNTS ONLY, AND THE CALLER DECIDES THAT ──────────────────────────────────────
 * `members` is whatever roster it is handed, and the action hands it approved people WITH an
 * account — §4b's line, "a record cannot pay or be paid". A grandmother recorded on the tree
 * is a member of the family and is not somebody the treasurer is expecting a cheque from.
 * `membersCounted` is echoed back so the screen can say how many that was, because a member
 * count here that quietly disagrees with the Directory next door is a number nobody trusts.
 */

/** The four money figures, at every level of the roll-up. */
export interface ProjectionTotals {
  /** What the people counted here owe for their schedules' current periods. */
  expectedCents: number
  /** Money that actually arrived — `status = 'paid'`, reversals netted out. */
  collectedCents: number
  /** Forgiven. Settles the obligation; never counted as money. */
  waivedCents: number
  /**
   * Started and not settled — `status = 'pending'`.
   *
   * Zero for every family today, and it is carried rather than dropped because the state
   * is real: 20260806000002 leaves the pending→paid settlement open because that is the
   * shape an online-payment webhook needs, and `recordPayment` refuses 'pending' precisely
   * so nothing else can write one. The screen renders this only when it is non-zero, so a
   * treasurer never reads a permanent $0.00 as a broken figure.
   */
  pendingCents: number
  /** Expected, less what has been settled. Never negative. */
  outstandingCents: number
}

/** Where one member stands on one schedule. */
export type DuesStanding =
  /** Below the schedule's `start_age` for this whole period. Owes nothing yet. */
  | 'exempt'
  /**
   * Bloodline-only, and this member is not in it — or the family has not named the line.
   *
   * ITS OWN STANDING RATHER THAN A KIND OF 'exempt', because the two are different
   * promises. A child who is exempt becomes a payer; a member who married in never does,
   * so folding them together would report somebody's wife as "not yet due" on a due she
   * will never owe.
   */
  | 'excluded'
  /** Declined an optional due. Owes nothing. */
  | 'declined'
  /** Settled in full, by money or by waiver. */
  | 'settled'
  /** Something in, not all of it. */
  | 'partial'
  /** Owes the whole thing. */
  | 'unpaid'

export interface ScheduleProjection extends ProjectionTotals {
  scheduleId: string
  label: string
  required: boolean
  /** The period these figures cover — this schedule's own current year. */
  periodStart: string
  /** The schedule's full annual figure, before any member's age or opt-out. */
  annualCents: number
  /** Only the bloodline owes it. */
  bloodlineOnly: boolean
  /**
   * Bloodline-only, and the family has no anchor to work the bloodline out from — so
   * NOBODY owes it. Surfaced rather than left as a suspiciously low expected figure: it is
   * the one state on this screen a treasurer cannot diagnose from the numbers.
   */
  bloodlineUnknown: boolean
  /** Members who owe something on it this period. */
  payingMembers: number
  counts: Record<DuesStanding, number>
}

export interface MemberProjection extends ProjectionTotals {
  personId: string
  /** How many schedules this member owes something on this period. */
  liableSchedules: number
  /** The least settled standing they hold on any schedule — what the row is sorted by. */
  standing: DuesStanding
}

export interface DuesProjection extends ProjectionTotals {
  /** Members the projection was computed over — accounts only. See the header. */
  membersCounted: number
  /** How many of them owe something on at least one schedule. */
  payingMembers: number
  /** Approved people with no account, so no cheque is expected from them. */
  recordsExcluded: number
  schedules: ScheduleProjection[]
  members: MemberProjection[]
}

/** A schedule as the projection needs it — the pure shape plus what it is called. */
export interface ProjectionSchedule extends DuesScheduleLike {
  id: string
  label: string
  required: boolean
}

export interface ProjectionMember {
  personId: string
  /** `people.date_of_birth`. Null means not recorded, which the age rule reads as adult. */
  dateOfBirth: string | null
}

export interface ProjectionPayment {
  personId: string
  scheduleId: string
  amountCents: number
  /** `paid` | `waived` | `pending`. Anything else is ignored. */
  status: string
  paymentDate: string
}

export interface ProjectionPlan {
  personId: string
  scheduleId: string
  optedOut: boolean
}

const ZERO: ProjectionTotals = {
  expectedCents: 0, collectedCents: 0, waivedCents: 0, pendingCents: 0, outstandingCents: 0,
}

/**
 * Sum two sets of totals. `outstandingCents` is added rather than re-derived, because it is
 * floored at zero PER MEMBER PER SCHEDULE: a member who overpaid one due does not reduce
 * what the family is still owed on another, and re-deriving the family figure from the
 * family's expected-less-settled would let one overpayment cancel somebody else's arrears.
 */
function add(a: ProjectionTotals, b: ProjectionTotals): ProjectionTotals {
  return {
    expectedCents: a.expectedCents + b.expectedCents,
    collectedCents: a.collectedCents + b.collectedCents,
    waivedCents: a.waivedCents + b.waivedCents,
    pendingCents: a.pendingCents + b.pendingCents,
    outstandingCents: a.outstandingCents + b.outstandingCents,
  }
}

/** Least settled first — the order the member table sorts by, and `standing` picks. */
const STANDING_RANK: Record<DuesStanding, number> = {
  unpaid: 0, partial: 1, settled: 2, declined: 3, exempt: 4, excluded: 5,
}

export function projectDues(input: {
  /** Active dues schedules. Donations must not be here — nobody owes a gift. */
  schedules: readonly ProjectionSchedule[]
  members: readonly ProjectionMember[]
  payments: readonly ProjectionPayment[]
  plans: readonly ProjectionPlan[]
  /** Approved people with no account. Reported, never billed. */
  recordsExcluded?: number
  /**
   * Who is in the family's bloodline — `bloodlineIds(...)`, or NULL for "do not know".
   *
   * Only consulted for a schedule with `bloodline_only`. NULL is not an empty set and
   * `duesEligibility` is what draws that distinction: it answers 'bloodline-unknown', the
   * schedule bills nobody, and `bloodlineUnknown` on the row is what lets the screen say
   * so rather than showing an unexplained zero. Omitting it entirely is the same as not
   * knowing, which is the safe default for a caller that has not loaded the tree.
   */
  bloodline?: ReadonlySet<string> | null
}): DuesProjection {
  const { schedules, members, payments, plans } = input
  const bloodline = input.bloodline ?? null

  const declined = new Set(
    plans.filter(p => p.optedOut).map(p => `${p.personId}:${p.scheduleId}`),
  )

  // Settled money, bucketed by (member, schedule) and by status. Bucketed ONCE rather than
  // filtered per member per schedule: a family of 150 on four schedules is 600 cells, and
  // scanning the whole ledger for each of them is the shape that makes a page time out.
  const paid = new Map<string, number>()
  const waived = new Map<string, number>()
  const pending = new Map<string, number>()
  const bucket = (m: Map<string, number>, key: string, cents: number) =>
    m.set(key, (m.get(key) ?? 0) + cents)

  // A schedule's period is its own, so a payment counts only if it falls inside the period
  // of the schedule it was made against.
  const periodStartOf = new Map<string, string>(
    schedules.map(s => [s.id, currentPeriodStart(s)]),
  )

  for (const payment of payments) {
    const periodStart = periodStartOf.get(payment.scheduleId)
    if (periodStart === undefined) continue          // a schedule we are not reporting on
    if (payment.paymentDate < periodStart) continue  // last year's money, last year's due
    const key = `${payment.personId}:${payment.scheduleId}`
    if (payment.status === 'paid') bucket(paid, key, payment.amountCents)
    else if (payment.status === 'waived') bucket(waived, key, payment.amountCents)
    else if (payment.status === 'pending') bucket(pending, key, payment.amountCents)
  }

  const memberTotals = new Map<string, ProjectionTotals>()
  const memberLiable = new Map<string, number>()
  const memberStanding = new Map<string, DuesStanding>()

  const scheduleRows: ScheduleProjection[] = schedules.map(schedule => {
    const periodStart = periodStartOf.get(schedule.id) as string
    const annualCents = annualTotalCents(schedule)
    let totals = ZERO
    let payingMembers = 0
    const counts: Record<DuesStanding, number> = {
      exempt: 0, excluded: 0, declined: 0, settled: 0, partial: 0, unpaid: 0,
    }

    for (const member of members) {
      const key = `${member.personId}:${schedule.id}`
      const share = ageShareOfPeriod({
        startAge: schedule.start_age,
        dateOfBirth: member.dateOfBirth,
        periodStart,
      })
      // A REQUIRED due cannot be declined, and the check is here as well as in the
      // database: a plan row that predates 20260807000003's guard, or one whose schedule
      // was made required after the member opted out, must read as owed.
      const optedOut = !schedule.required && declined.has(key)
      // WHETHER THEY OWE IT AT ALL, before any question of how much. A bloodline-only due
      // is owed by nobody when the family has not named its line — see `duesEligibility`,
      // which is where the reasoning for that direction lives.
      const eligibility = duesEligibility({
        bloodlineOnly: schedule.bloodline_only,
        bloodline,
        personId: member.personId,
      })
      const excluded = eligibility !== 'owed'

      const collectedCents = paid.get(key) ?? 0
      const waivedCents = waived.get(key) ?? 0
      const pendingCents = pending.get(key) ?? 0
      const expectedCents = optedOut || excluded
        ? 0
        : proratedAnnualCents(annualCents, share)
      const outstandingCents = Math.max(0, expectedCents - collectedCents - waivedCents)

      // ORDER MATTERS, and 'excluded' comes FIRST. A member outside the bloodline will
      // never owe this due, so reporting them as 'exempt' because they are also a child —
      // or as 'settled' because they owe nothing — would both be answers to a question
      // nobody asked. What is true of them is that the due is not theirs.
      const standing: DuesStanding =
        excluded ? 'excluded'
          : share.exempt ? 'exempt'
            : optedOut ? 'declined'
              : outstandingCents <= 0 ? 'settled'
                : collectedCents + waivedCents > 0 ? 'partial'
                  : 'unpaid'

      counts[standing]++
      if (expectedCents > 0) payingMembers++

      const cell: ProjectionTotals = {
        expectedCents, collectedCents, waivedCents, pendingCents, outstandingCents,
      }
      totals = add(totals, cell)
      memberTotals.set(member.personId, add(memberTotals.get(member.personId) ?? ZERO, cell))
      if (expectedCents > 0) {
        memberLiable.set(member.personId, (memberLiable.get(member.personId) ?? 0) + 1)
      }
      // The least settled standing a member holds anywhere is what their row reports:
      // somebody paid up on three dues and owing a fourth is a member who owes.
      const held = memberStanding.get(member.personId)
      if (held === undefined || STANDING_RANK[standing] < STANDING_RANK[held]) {
        memberStanding.set(member.personId, standing)
      }
    }

    return {
      scheduleId: schedule.id,
      label: schedule.label,
      required: schedule.required,
      periodStart,
      annualCents,
      bloodlineOnly: Boolean(schedule.bloodline_only),
      // Only true where the flag is set AND there is no bloodline to apply it with. A
      // schedule open to everybody does not care that the anchor is unset, so saying so on
      // its row would be a warning about nothing.
      bloodlineUnknown: Boolean(schedule.bloodline_only) && bloodline === null,
      payingMembers,
      counts,
      ...totals,
    }
  })

  const memberRows: MemberProjection[] = members.map(member => ({
    personId: member.personId,
    liableSchedules: memberLiable.get(member.personId) ?? 0,
    // 'settled' for a family with no dues at all: they owe nothing and nothing is
    // outstanding, which is what that word means here.
    standing: memberStanding.get(member.personId) ?? 'settled',
    ...(memberTotals.get(member.personId) ?? ZERO),
  }))

  return {
    membersCounted: members.length,
    payingMembers: memberRows.filter(m => m.liableSchedules > 0).length,
    recordsExcluded: input.recordsExcluded ?? 0,
    schedules: scheduleRows,
    members: memberRows,
    ...scheduleRows.reduce(add, ZERO),
  }
}

/**
 * What share of the expected total has been settled, 0–100, rounded.
 *
 * NOT CLAMPED ABOVE 100, deliberately, and the reason is the reverse of the donation bar's:
 * a family collecting more than it billed is not a triumph, it is a figure a treasurer needs
 * to see and reconcile — an overpayment, a duplicate entry, or a payment posted against the
 * wrong period. Hiding it at 100% would hide the discrepancy.
 *
 * Zero expected gives 0 rather than 100. A family that has billed nothing has not collected
 * all of it; it has nothing to collect, and the screen says that in words instead.
 */
export function collectedPercent(totals: ProjectionTotals): number {
  if (totals.expectedCents <= 0) return 0
  const settled = totals.collectedCents + totals.waivedCents
  return Math.round((settled / totals.expectedCents) * 100)
}
