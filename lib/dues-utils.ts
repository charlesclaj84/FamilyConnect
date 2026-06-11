// Single source of truth for dues cadence math, shared by the server action and
// the client so they always compute identical installment amounts / dates.
//
// Product rule = "annualize, then split": each schedule's native frequency +
// amount normalizes to an annual total; the member's chosen cadence divides it.

export type PayCadence = 'weekly' | 'monthly' | 'quarterly' | 'annual' | 'one-time'

export const PAY_CADENCES: readonly PayCadence[] = ['weekly', 'monthly', 'quarterly', 'annual', 'one-time']

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
