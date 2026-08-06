/**
 * The four ledgers on the Transactions page.
 *
 * Same split as the money itself: two ways it comes in from members (dues and
 * donations, both rows of dues_payments), one way it reaches a fund
 * (fund_contributions — routed automatically or recorded by hand), and one way it
 * leaves (fund_disbursements).
 *
 * Deliberately free of React and lucide imports, for the same reason
 * components/admin/account-sections.ts is: the server component resolves the initial
 * ledger from `await searchParams` and must import this without dragging a client
 * boundary or an icon set into its module graph.
 */

export const LEDGERS = ['dues', 'donations', 'contributions', 'disbursements'] as const

export type Ledger = (typeof LEDGERS)[number]

export const LEDGER_LABELS: Record<Ledger, string> = {
  dues: 'Dues',
  donations: 'Donations',
  contributions: 'Contributions',
  disbursements: 'Disbursements',
}

/** Landing ledger when `?ledger=` is absent or unreadable. */
export const DEFAULT_LEDGER: Ledger = 'dues'

/**
 * Forgiving forms for hand-typed URLs, and for the ids these ledgers had while they
 * lived on the Accounting admin page — `?section=payments` was the combined dues +
 * donations list, so it lands on Dues.
 */
const LEDGER_ALIASES: Record<string, Ledger> = {
  payment: 'dues',
  payments: 'dues',
  'payment-history': 'dues',
  due: 'dues',
  donation: 'donations',
  gift: 'donations',
  gifts: 'donations',
  contribution: 'contributions',
  disbursement: 'disbursements',
  'disbursements-history': 'disbursements',
  // Retired record-form ids from the Manual Recording era.
  record: 'dues',
  'record-payment': 'dues',
  'record-dues': 'dues',
  'record-donation': 'donations',
  'record-contribution': 'contributions',
  'record-disbursement': 'disbursements',
}

export function isLedger(value: string): value is Ledger {
  return (LEDGERS as readonly string[]).includes(value)
}

/** Parse a ledger from URL input, falling back to DEFAULT_LEDGER. */
export function resolveLedger(raw: string | string[] | undefined | null): Ledger {
  const value = Array.isArray(raw) ? raw[0] : raw
  if (!value) return DEFAULT_LEDGER
  const key = value.trim().toLowerCase().replace(/^#/, '')
  if (isLedger(key)) return key
  return LEDGER_ALIASES[key] ?? DEFAULT_LEDGER
}
