/**
 * The three panes on My Summary, below the stat cards.
 *
 * Free of React and lucide imports on purpose, for the same reason
 * components/transactions/ledgers.ts is: the page is a server component, it resolves
 * the initial pane from `await searchParams`, and it must import this without pulling a
 * client boundary or an icon set into its module graph.
 */

export const SUMMARY_PANES = ['dues', 'donations', 'history'] as const

export type SummaryPane = (typeof SUMMARY_PANES)[number]

export const SUMMARY_PANE_LABELS: Record<SummaryPane, string> = {
  dues: 'Upcoming Dues',
  donations: 'Donations',
  history: 'Payment History',
}

/** Landing pane when `?pane=` is absent or unreadable. */
export const DEFAULT_SUMMARY_PANE: SummaryPane = 'dues'

/**
 * The permission resource governing each pane.
 *
 * One grant per pane rather than one for the whole page, registered by
 * 20260808000000 under the Accounting category, subsection 'My Summary'. All three
 * used to ride on `account-summary:view`, so "this member has nothing to do with the
 * donation drive" and "this member pays in a lump sum and has no schedule to look at"
 * were not expressible — the same argument 20260806000007 made for Accounting's
 * sections and 20260806000000 made for the Transactions ledgers.
 *
 * VIEW IS THE ONLY ACTION any of them declares. The one control inside these panes is
 * the cadence picker and the opt-out on the member's own dues row, which goes through
 * setMyDuesPlan() — self-service by definition, since create and edit default to
 * scope 'none' and demanding a grant would mean a family could not choose how to pay
 * (AGENTS.md §2). An edit column here would be a switch wired to nothing.
 *
 * The `account-summary/` prefix is load-bearing: getResources() drops any row where
 * isFeatureFuture('/' + key) is true, and getFeature() longest-prefix-matches, so
 * these resolve to the live /account-summary entry. A key under a 'future' prefix
 * disappears from the Members & Access grid with no error at all.
 */
export const PANE_RESOURCE: Record<SummaryPane, string> = {
  dues:      'account-summary/dues',
  donations: 'account-summary/donations',
  history:   'account-summary/history',
}

/** Forgiving forms for hand-typed and shared URLs. */
const ALIASES: Record<string, SummaryPane> = {
  due: 'dues',
  'upcoming-dues': 'dues',
  upcoming: 'dues',
  donation: 'donations',
  gift: 'donations',
  gifts: 'donations',
  payments: 'history',
  'payment-history': 'history',
  payment: 'history',
}

export function isSummaryPane(value: string): value is SummaryPane {
  return (SUMMARY_PANES as readonly string[]).includes(value)
}

export function resolveSummaryPane(raw: string | string[] | undefined | null): SummaryPane {
  const value = Array.isArray(raw) ? raw[0] : raw
  if (!value) return DEFAULT_SUMMARY_PANE
  const key = value.trim().toLowerCase().replace(/^#/, '')
  if (isSummaryPane(key)) return key
  return ALIASES[key] ?? DEFAULT_SUMMARY_PANE
}
