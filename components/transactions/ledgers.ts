/**
 * The five ledgers on the Transactions page.
 *
 * Same split as the money itself: two ways it comes in from members (dues and
 * donations, both rows of dues_payments), one way it reaches a fund
 * (fund_contributions — routed automatically or recorded by hand), one way it leaves
 * (fund_disbursements), and one way it moves WITHIN the family (fund_transfers).
 *
 * Transfers is last, and not merely because it shipped last: the first four are the
 * family's boundary — money arriving and money leaving — while a transfer crosses no
 * boundary at all. It nets to zero family-wide and appears in no P&L; what it changes
 * is which pot holds what.
 *
 * Deliberately free of React and lucide imports, for the same reason
 * components/admin/account-sections.ts is: the server component resolves the initial
 * ledger from `await searchParams` and must import this without dragging a client
 * boundary or an icon set into its module graph.
 */

export const LEDGERS = ['dues', 'donations', 'contributions', 'disbursements', 'transfers'] as const

export type Ledger = (typeof LEDGERS)[number]

export const LEDGER_LABELS: Record<Ledger, string> = {
  dues: 'Dues',
  donations: 'Donations',
  contributions: 'Contributions',
  disbursements: 'Disbursements',
  transfers: 'Transfers',
}

/** Landing ledger when `?ledger=` is absent or unreadable. */
export const DEFAULT_LEDGER: Ledger = 'dues'

/**
 * Which permission resource governs each ledger — its TAB via `view`, and its "add"
 * button via `create`.
 *
 * The single binding that the page, the client and the server actions all read, so
 * the button and the action can never disagree about which grant they need. Before
 * this, four buttons were driven by two grants — dues:edit covered dues AND
 * donations, family-finances:edit covered contributions AND disbursements — so a
 * treasurer who could record dues could also record donations, and there was no way
 * to let someone log a contribution without also letting them pay money out.
 *
 * THE `view` HALF ARRIVED LATER (20260808000000) and does not mean quite the same
 * thing on all four, which is worth knowing before reading a grant off the grid:
 *
 *   contributions, disbursements   permission_table_map points fund_contributions and
 *                                  fund_disbursements at these keys, so the view IS the
 *                                  RLS SELECT predicate as well as the tab gate.
 *   transfers                      the same, and written by hand rather than composed:
 *                                  fund_transfers carries its own `perm:` policies from
 *                                  20260812000002, both naming this key.
 *   dues, donations                dues_payments is mapped to `dues` and stays there —
 *                                  a member's own history behind My Summary must not
 *                                  depend on a ledger grant. So the view gates the tab
 *                                  and the page's fetch, and `dues:view` still decides
 *                                  which rows come back inside it.
 *
 * Registered in permission_resources by 20260806000000, under the Accounting
 * category with subsection 'Transactions'.
 *
 * The `transactions/` prefix is load-bearing: getResources() drops any row where
 * isFeatureFuture('/' + key) is true, and getFeature() longest-prefix-matches, so
 * `transactions/*` resolves to the live /transactions entry. A key prefixed
 * `family-finances/` would inherit that feature's 'future' status and disappear from
 * both admin grids with no error.
 */
export const LEDGER_RESOURCE: Record<Ledger, string> = {
  dues:           'reporting/transactions/dues-payments',
  donations:      'reporting/transactions/donation-payments',
  contributions:  'reporting/transactions/fund-contributions',
  disbursements:  'reporting/transactions/fund-disbursements',
  // Its own key, deliberately not folded into disbursements. Paying a member what they
  // are owed and re-deciding what the family saved FOR are different judgements — and a
  // transfer can empty a fund whose minimum balance dues spent a year filling. Added by
  // 20260812000002, which also declines to carry the disbursement grant across.
  transfers:      'reporting/transactions/fund-transfers',
}

// DISBURSEMENT_RESOURCE was here, aliasing LEDGER_RESOURCE.disbursements for the delete
// grant. 20260807000002 made fund_disbursements append-only and narrowed the resource to
// {view,create}, so there is no second action to name separately any more — a caller that
// wants the create grant reads LEDGER_RESOURCE.disbursements like the other three.

/** Posting a correcting entry against an existing payment. */
export const REVERSAL_RESOURCE = 'reporting/transactions/reversals'

/**
 * Forgiving forms for hand-typed URLs, and for the ids these ledgers had while they
 * lived on the Accounting admin page — `?section=payments` was the combined dues +
 * donations list, so it lands on Dues.
 */
const LEDGER_ALIASES: Record<string, Ledger> = {
  payment: 'dues',
  payments: 'dues',
  'reporting/payment-history': 'dues',
  due: 'dues',
  donation: 'donations',
  gift: 'donations',
  gifts: 'donations',
  contribution: 'contributions',
  disbursement: 'disbursements',
  'disbursements-history': 'disbursements',
  transfer: 'transfers',
  'fund-transfer': 'transfers',
  'fund-transfers': 'transfers',
  // Retired record-form ids from the Manual Recording era.
  record: 'dues',
  'record-payment': 'dues',
  'record-dues': 'dues',
  'record-donation': 'donations',
  'record-contribution': 'contributions',
  'record-disbursement': 'disbursements',
  'record-transfer': 'transfers',
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
