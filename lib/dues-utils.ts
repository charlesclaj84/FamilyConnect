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

/** Where the schedule's first installment lands: start_date, else the next due_month/day, else null. */
function anchorDate(s: DuesScheduleLike): Date | null {
  if (s.start_date) return parseISO(s.start_date)
  if (s.due_month != null && s.due_day != null) {
    const now = new Date()
    const y = now.getUTCFullYear()
    const m = now.getUTCMonth() + 1
    const d = now.getUTCDate()
    let year = y
    if (s.due_month < m || (s.due_month === m && s.due_day < d)) year = y + 1
    return new Date(Date.UTC(year, s.due_month - 1, s.due_day))
  }
  return null
}

function addCadenceSteps(anchor: Date, cadence: PayCadence, count: number): Date {
  const d = new Date(anchor.getTime())
  switch (cadence) {
    case 'weekly':    d.setUTCDate(d.getUTCDate() + 7 * count); break
    case 'monthly':   d.setUTCMonth(d.getUTCMonth() + count); break
    case 'quarterly': d.setUTCMonth(d.getUTCMonth() + 3 * count); break
    case 'annual':
    case 'one-time':  d.setUTCFullYear(d.getUTCFullYear() + count); break
  }
  return d
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
 * The date of the member's next installment: anchor + (paidCount × cadence step),
 * clamped to end_date. Returns null if the schedule has no determinable anchor.
 */
export function nextInstallmentDate(
  schedule: DuesScheduleLike,
  cadence: PayCadence,
  paidCount: number,
): string | null {
  const anchor = anchorDate(schedule)
  if (!anchor) return schedule.end_date ?? null
  const next = addCadenceSteps(anchor, cadence, Math.max(0, paidCount))
  if (schedule.end_date) {
    const end = parseISO(schedule.end_date)
    if (next.getTime() > end.getTime()) return schedule.end_date
  }
  return toISO(next)
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
