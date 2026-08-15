// Single source of truth for dues cadence math, shared by the server action and
// the client so they always compute identical installment amounts / dates.
//
// Product rule = "annualize, then split": each schedule's native frequency +
// amount normalizes to an annual total; the member's chosen cadence divides it.

export type PayCadence = 'weekly' | 'monthly' | 'quarterly' | 'annual' | 'one-time'

export const PAY_CADENCES: readonly PayCadence[] = ['weekly', 'monthly', 'quarterly', 'annual', 'one-time']

/**
 * What a schedule obliges a member to do.
 *
 *   dues     — owed. Counts toward the member's remaining balance.
 *   donation — offered. Identical in every other respect; never owed, never overdue,
 *              never in anyone's balance.
 *
 * Lives here rather than beside DuesSchedule in app/actions/dues.ts because that file
 * is `'use server'`, and a server-action module may only export async functions — the
 * reason `PAY_CADENCES` above is here too, since a plain array export there fails the
 * build.
 */
export type ScheduleKind = 'dues' | 'donation'

/**
 * What a `dues_payments.status` is called on screen.
 *
 * Here rather than beside either of the two components that read it, for the reason
 * this module's other constants are here: a second copy is a second answer, and the two
 * places a payment is displayed — the Transactions ledgers and the member's own Payment
 * History — are exactly the pair a family would compare when a figure looks wrong.
 *
 * `pending` is not offered by any form: a treasurer typing an entry in is recording
 * something that already happened, and `recordPayment` refuses it. It is kept because
 * the TABLE still allows it — the pending -> paid settlement 20260806000002 leaves open
 * is how an online payment will land — and a row in that state must read as something
 * rather than as a raw column value.
 */
export const PAYMENT_STATUS_LABELS: Record<string, string> = {
  paid: 'Paid',
  waived: 'Waived',
  pending: 'Pending',
}

/** How many of the schedule's native period occur per year (for annualizing). */
const FREQ_PER_YEAR: Record<string, number> = {
  annual: 1,
  'semi-annual': 2,
  quarterly: 4,
  monthly: 12,
  'one-time': 1,
}

/** How many installments per year the member's chosen cadence produces. */
const INSTALLMENTS_PER_YEAR: Record<PayCadence, number> = {
  weekly: 52,
  monthly: 12,
  quarterly: 4,
  annual: 1,
  'one-time': 1,
}

export function installmentsPerYear(cadence: PayCadence): number {
  return INSTALLMENTS_PER_YEAR[cadence] ?? 1
}

/** Minimal shape needed from a dues schedule — avoids importing the action type. */
export interface DuesScheduleLike {
  amount_cents: number
  frequency: string
  start_date?: string | null
  end_date?: string | null
  due_month?: number | null
  due_day?: number | null
}

/** The schedule's total obligation for one year, in cents. */
export function annualTotalCents(schedule: DuesScheduleLike): number {
  return schedule.amount_cents * (FREQ_PER_YEAR[schedule.frequency] ?? 1)
}

/**
 * The standard per-installment amount for a chosen cadence. Rounded UP so the
 * member never underpays across the year; the final installment is naturally
 * smaller (callers clamp the last payment to the remaining balance).
 */
export function installmentCents(annualCents: number, cadence: PayCadence): number {
  const n = installmentsPerYear(cadence)
  if (n <= 1) return annualCents
  return Math.ceil(annualCents / n)
}

/** Default cadence shown when a member hasn't picked one — mirrors the native frequency. */
export function defaultCadence(frequency: string): PayCadence {
  switch (frequency) {
    case 'monthly':   return 'monthly'
    case 'quarterly': return 'quarterly'
    case 'one-time':  return 'one-time'
    // 'annual' and 'semi-annual' have no closer cadence option → annual
    default:          return 'annual'
  }
}

// ── Date helpers (UTC, matching the YYYY-MM-DD convention used elsewhere) ──

function parseISO(s: string): Date {
  const [y, m, d] = s.split('-').map(Number)
  return new Date(Date.UTC(y, m - 1, d))
}

function toISO(d: Date): string {
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}`
}

/** Days in a given UTC month — day 0 of the next month is the last day of this one. */
function lastDayOfMonth(year: number, monthIndex: number): number {
  return new Date(Date.UTC(year, monthIndex + 1, 0)).getUTCDate()
}

/**
 * The anchor advanced by `count` cadence steps.
 *
 * THE MONTH-END CLAMP IS NOT DEFENSIVE, it is the difference between a correct ladder and
 * one missing a month. `setUTCMonth` OVERFLOWS: from 2026-01-31, +1 month is "2026-02-31",
 * which the Date constructor resolves to March 3rd. So a schedule anchored on the 31st
 * used to produce Jan 31, Mar 3, Mar 31, May 1, May 31… — no February installment at all,
 * two in March, and one fewer rung in the year than the cadence promises. Counting how
 * many of those have passed then under-bills the member by a whole installment.
 *
 * That is an ordinary schedule, not an exotic one: the Accounting form prefills the start
 * date with today, so any schedule created on the 29th, 30th or 31st has this anchor.
 *
 * Clamping to the last day of the target month is what a person means by "the 31st of
 * every month": the 28th of February, the 30th of April. The day of the month is taken
 * from the ANCHOR each time rather than carried forward, so a clamped February does not
 * drag March back to the 28th.
 */
function addCadenceSteps(anchor: Date, cadence: PayCadence, count: number): Date {
  if (cadence === 'weekly') {
    const d = new Date(anchor.getTime())
    d.setUTCDate(d.getUTCDate() + 7 * count)
    return d
  }

  const monthsPerStep = cadence === 'monthly' ? 1 : cadence === 'quarterly' ? 3 : 12
  const day = anchor.getUTCDate()
  const absolute = anchor.getUTCFullYear() * 12 + anchor.getUTCMonth() + monthsPerStep * count
  const year = Math.floor(absolute / 12)
  const monthIndex = absolute - year * 12
  return new Date(Date.UTC(year, monthIndex, Math.min(day, lastDayOfMonth(year, monthIndex))))
}

/**
 * ISO date of the start of the schedule's CURRENT annual period, anchored on
 * its start_date / due-date (Jan 1 fallback). Payments on/after this date count
 * toward the current period's obligation.
 */
export function currentPeriodStart(schedule: DuesScheduleLike): string {
  let month = 1
  let day = 1
  if (schedule.start_date) {
    const [, m, d] = schedule.start_date.split('-').map(Number)
    month = m; day = d
  } else if (schedule.due_month != null && schedule.due_day != null) {
    month = schedule.due_month; day = schedule.due_day
  }
  const now = new Date()
  const y = now.getUTCFullYear()
  const anniversary = Date.UTC(y, month - 1, day)
  const startYear = now.getTime() < anniversary ? y - 1 : y
  return `${startYear}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`
}

/**
 * Everything a member's payment plan says: the steady installment, what the NEXT one has
 * to be to bring them level, when it falls, and how far behind they are.
 *
 * ── WHAT WAS WRONG, AND IT WAS TWO SEPARATE THINGS ──────────────────────────────────
 * This replaces `nextInstallmentDate()`, which took a COUNT OF PAYMENT ROWS and added
 * that many cadence steps to the schedule's original `start_date`. Neither half looked at
 * the calendar, and both were wrong in the same direction:
 *
 *   * **The amount never moved.** It was `annual / installments-per-year`, always. A
 *     member who chose monthly in August, having paid nothing since the schedule opened
 *     in January, was told "$50 a month" — a plan that finishes the year $400 short.
 *   * **The date pointed at the past, and at the wrong year.** Zero payments meant
 *     "anchor + 0", i.e. the schedule's own start date: a member switching cadence today
 *     was shown a next installment eight months ago. And because the anchor was the
 *     ORIGINAL start_date while the payments counted against it were this period's, every
 *     schedule in its second year was anchored a year or more before the period it was
 *     describing.
 *   * **A row count is not money.** Two $1 payments advanced the date by two months while
 *     one $500 payment advanced it by one. Worse, a REVERSAL is written as a `paid` row
 *     with a negative amount — so correcting a payment used to push the next due date
 *     FORWARD while the money went backward.
 *
 * So this counts rungs against the clock and money against the total, and the two are
 * never confused: `periodsElapsed` is calendar, `settledCents` is cash.
 *
 * ── THE RULE ────────────────────────────────────────────────────────────────────────
 * The next installment covers everything the calendar has already asked for plus the one
 * it is asking for now, so the installment AFTER it is the ordinary amount and the member
 * is back on schedule. A member switching to monthly on 14 August, having paid nothing on
 * a $600 schedule that opened on 1 January, is told: $450 on 1 September, then $50 on
 * 1 October. Eight elapsed rungs plus September's, and level thereafter.
 *
 * ── WHERE THE LADDER STARTS ─────────────────────────────────────────────────────────
 * At `periodStart` — the CURRENT annual period — not at the schedule's original start.
 * That is the anchor the rest of the obligation already uses: `remainingBalanceCents` is
 * the annual total less what has been settled THIS PERIOD, so arrears measured from
 * anywhere else would be describing a different debt from the balance beside it.
 *
 * It follows that a member admitted in August is shown a catch-up covering the whole year
 * to date. That is not this function inventing a charge — the balance already said they
 * owe the full annual amount, since nothing in the product prorates — it is that figure
 * finally being broken down. (`dues_member_plans.start_date` exists and is written by
 * nothing; flooring the ladder there is the change to make if prorating ever arrives, and
 * the balance would have to move with it.)
 *
 * ── PURE, AND `today` IS INJECTED ───────────────────────────────────────────────────
 * Every other helper in this file reads `new Date()` internally, which is why none of them
 * could ever be tested. This one takes the day as a string, so the whole of the arithmetic
 * above is checkable — see lib/dues-utils.test.ts.
 */
export interface DuesPlanMath {
  /** The steady-state installment: what every one AFTER the catch-up costs. */
  installmentCents: number
  /**
   * What the next installment actually has to be — the catch-up. Equal to
   * `installmentCents` for a member who is level, and never more than the balance.
   */
  nextInstallmentCents: number
  /**
   * When it falls. Never in the past: the next rung the calendar has not already passed,
   * or today when the period's last rung has gone by and money is still owed.
   */
  nextInstallmentDate: string | null
  /** The one after that, so the screen can say what "back on schedule" costs. */
  followingInstallmentDate: string | null
  followingInstallmentCents: number
  /** The oldest rung whose money never arrived. Null when the member is level. */
  overdueSinceDate: string | null
  /** How many rungs the calendar has already passed this period. */
  periodsElapsed: number
  /** Expected by now, less what has been settled. Never negative. */
  arrearsCents: number
  onSchedule: boolean
}

export function duesPlanMath(input: {
  schedule: DuesScheduleLike
  cadence: PayCadence
  /** Start of the schedule's current annual period — `currentPeriodStart(schedule)`. */
  periodStart: string
  /** Today, as YYYY-MM-DD. Injected so this function is pure and testable. */
  today: string
  /** Paid PLUS waived this period. A waiver settles the obligation as a payment does. */
  settledCents: number
}): DuesPlanMath {
  const { schedule, cadence, periodStart, today } = input
  const n = installmentsPerYear(cadence)
  const annual = annualTotalCents(schedule)
  const base = installmentCents(annual, cadence)
  const settled = Math.max(0, input.settledCents)
  const remaining = Math.max(0, annual - settled)

  const level = (over: Partial<DuesPlanMath> = {}): DuesPlanMath => ({
    installmentCents: base,
    nextInstallmentCents: Math.min(base, remaining),
    nextInstallmentDate: null,
    followingInstallmentDate: null,
    followingInstallmentCents: 0,
    overdueSinceDate: null,
    periodsElapsed: 0,
    arrearsCents: 0,
    onSchedule: true,
    ...over,
  })

  // ── Nothing left to pay ──
  // Matches what the caller already does with a settled due: no date, no ask. Reached by
  // an overpayment too, where `remaining` floors at zero rather than going negative.
  if (remaining <= 0) return level({ nextInstallmentCents: 0 })

  // ── No anchor at all ──
  // A schedule with neither a start date nor a due month has no ladder to build, and this
  // guard is what preserves that. `currentPeriodStart` would happily hand back January 1st
  // — it defaults to it — so without this every anchorless schedule would acquire a year's
  // worth of phantom arrears overnight. They exist: the Accounting form writes
  // `due_month: null, due_day: null` on every create and does not require a start date.
  if (!schedule.start_date && schedule.due_month == null) {
    return level({ nextInstallmentDate: schedule.end_date ?? null })
  }

  // ── Not started yet ──
  // `currentPeriodStart` finds the most recent ANNIVERSARY, so for a schedule beginning
  // next month it back-steps a year and returns a date before the schedule existed.
  // Building a ladder on that reports a full year of arrears on something nobody owes yet.
  const ladderStart = schedule.start_date && schedule.start_date > periodStart
    ? schedule.start_date
    : periodStart
  const anchor = parseISO(ladderStart)

  const clampToEnd = (iso: string): string =>
    schedule.end_date && iso > schedule.end_date ? schedule.end_date : iso
  const rung = (k: number): string => toISO(addCadenceSteps(anchor, cadence, k))

  if (ladderStart > today) {
    return level({
      nextInstallmentDate: clampToEnd(ladderStart),
      followingInstallmentDate: n > 1 ? clampToEnd(rung(1)) : null,
      followingInstallmentCents: n > 1 ? Math.min(base, Math.max(0, remaining - base)) : 0,
    })
  }

  // ── How many rungs the calendar has passed ──
  // STRICTLY before today, so an installment falling today is due rather than late — a
  // member who pays on the day is on time, and for an annual cadence the alternative would
  // mark the whole year's dues overdue on the anniversary itself.
  //
  // Counted by walking the rungs rather than by dividing elapsed days, so the number can
  // never disagree with the dates printed beside it — month lengths differ and
  // addCadenceSteps clamps month-ends.
  let periodsElapsed = 0
  while (periodsElapsed < n && rung(periodsElapsed) < today) periodsElapsed++

  // Expected by now, capped at the annual total because `base` rounds UP: twelve rounded
  // installments can exceed the year, and a member is never asked for more than the whole.
  const expectedToDate = Math.min(annual, periodsElapsed * base)
  const arrearsCents = Math.max(0, expectedToDate - settled)

  // How many rungs the MONEY covers. Floor, not ceil: a half-paid installment has not been
  // paid. The guard is for a zero-amount schedule, which the donation invariants force.
  const covered = base > 0 ? Math.min(n, Math.floor(settled / base)) : n

  // The rung the next payment lands on. `max` is what carries a member who is AHEAD: five
  // installments paid by March moves their next date to June rather than leaving it in the
  // past. Clamped to the last rung of the period, so the arithmetic below stays inside it.
  const target = Math.min(Math.max(periodsElapsed, covered), n - 1)

  // The period's whole ladder has gone by and money is still owed: there is no future rung
  // left to name, so the balance is due now. Naming a past date instead would be the bug
  // this function replaced, and every consumer of `nextInstallmentDate` — the card titled
  // "Next Installment", two ascending sorts, the mobile "Next due" line — reads it as a
  // date that has not arrived.
  const exhausted = periodsElapsed >= n

  // What the member will have settled once the next installment is paid: everything the
  // calendar has asked for up to and including that rung. The difference from what they
  // have already settled IS the catch-up, and it collapses to a plain installment for
  // somebody who is level.
  const targetAfterNext = exhausted ? annual : Math.min(annual, (target + 1) * base)
  const nextInstallmentCents = Math.min(remaining, Math.max(0, targetAfterNext - settled))

  const hasFollowing = !exhausted && target + 1 < n

  return {
    installmentCents: base,
    nextInstallmentCents,
    nextInstallmentDate: exhausted ? clampToEnd(today) : clampToEnd(rung(target)),
    followingInstallmentDate: hasFollowing ? clampToEnd(rung(target + 1)) : null,
    followingInstallmentCents: hasFollowing
      ? Math.min(base, Math.max(0, remaining - nextInstallmentCents))
      : 0,
    // The oldest rung the money never reached — and only when it has actually passed, so
    // a member who is merely mid-period is not accused of missing the rung they are on.
    overdueSinceDate: covered < periodsElapsed ? rung(covered) : null,
    periodsElapsed,
    arrearsCents,
    onSchedule: arrearsCents === 0,
  }
}

/**
 * Whether a dues schedule is money this member still has to find.
 *
 * One predicate, because three surfaces ask it — the dashboard KPI, My Summary's Upcoming
 * Dues, and its remaining-balance total — and "unpaid" stopped being the whole answer the
 * moment opting out existed (20260807000003). An opted-out due is not paid and never will
 * be; counting it as outstanding would show a member a balance they have already declined.
 *
 * IT LIVES HERE, not beside DuesSummary in app/actions/dues.ts, and the reason is a hard
 * constraint rather than taste: that file is `'use server'`, where every export has to be
 * an async server action. A synchronous helper exported from it fails the build.
 *
 * Typed structurally rather than as DuesSummary so this module needs no import from the
 * actions file at all — DuesSummary satisfies it by shape.
 */
export function isOutstanding(s: { optedOut: boolean; paid: boolean }): boolean {
  return !s.optedOut && !s.paid
}
