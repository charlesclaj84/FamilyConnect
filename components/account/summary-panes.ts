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
