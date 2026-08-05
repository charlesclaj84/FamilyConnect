/**
 * Section registry for the Accounting admin page.
 *
 * Deliberately free of React, JSX and lucide imports. The async server component
 * at app/(protected)/admin/account/page.tsx resolves the initial section from
 * `await searchParams` and must import this without dragging a client boundary or
 * an icon set into its module graph — so the icons live in AdminAccountShell and
 * only the plain data lives here.
 *
 * Two axes are tracked separately on purpose, because they do NOT line up:
 *
 *   * OWNERSHIP  — which client component renders a section. `record-payment` is
 *     rendered by AdminDuesClient (it needs that component's form state and its
 *     recordPayment handler), and the *_SECTIONS tuples below drive the guards
 *     each component uses to decide whether to render at all.
 *
 *   * PRESENTATION — how the nav groups sections for the reader. `record-payment`
 *     files under "Manual Recording" next to `record-disbursement`, which a
 *     different component owns. That axis lives entirely in SECTION_GROUPS in the
 *     shell, deliberately kept out of here so grouping has exactly one home.
 *
 * Conflating the two is what makes tab-style layouts calcify around whichever
 * component happens to hold the state.
 */

/** Sections rendered by AdminDuesClient. */
export const DUES_SECTIONS = ['schedules', 'payments', 'record-payment'] as const

/** Sections rendered by AdminFundsClient. */
export const FUNDS_SECTIONS = [
  'funds',
  'routing',
  'milestones',
  'disbursements',
  'record-disbursement',
  'record-contribution',
] as const

/** Sections rendered by the shell itself. */
export const SETTINGS_SECTIONS = ['processing'] as const

export type DuesSection = (typeof DUES_SECTIONS)[number]
export type FundsSection = (typeof FUNDS_SECTIONS)[number]
export type SettingsSection = (typeof SETTINGS_SECTIONS)[number]
export type AccountSection = DuesSection | FundsSection | SettingsSection

/**
 * Landing section when no `?section=` is given, or when it is unreadable. Dues is
 * the page's reason for existing, so an admin who follows a truncated link still
 * arrives somewhere useful.
 */
export const DEFAULT_SECTION: AccountSection = 'schedules'

/**
 * Nav label and pane title for each section.
 *
 * These name the PAGE, not its domain — the group pill above it already says
 * "Dues" or "Funds", so repeating that here would label both levels the same and
 * tell the reader nothing about where they actually are. Hence `schedules` is
 * "Schedules" rather than "Dues", and `funds` is "Balances" rather than "Funds".
 */
export const SECTION_LABELS: Record<AccountSection, string> = {
  schedules: 'Schedules',
  payments: 'Payment History',
  funds: 'Balances',
  routing: 'Routing',
  disbursements: 'Disbursements History',
  milestones: 'Milestones',
  'record-payment': 'Dues Payment',
  'record-disbursement': 'Fund Disbursement',
  'record-contribution': 'Fund Contribution',
  processing: 'Processing',
}

/**
 * Forgiving forms for hand-typed and legacy URLs. `dues` and `funds-*` matter most:
 * `dues` is what someone types when guessing, and the pre-redesign tab ids (`record`)
 * appear in anything anyone bookmarked while the tab strips were live.
 */
const SECTION_ALIASES: Record<string, AccountSection> = {
  dues: 'schedules',
  schedule: 'schedules',
  payment: 'payments',
  'payment-history': 'payments',
  history: 'payments',
  fund: 'funds',
  'all-funds': 'funds',
  balance: 'funds',
  balances: 'funds',
  allocation: 'routing',
  allocations: 'routing',
  milestone: 'milestones',
  disbursement: 'disbursements',
  'disbursements-history': 'disbursements',
  // Legacy tab ids: both clients used a bare `record` for their own record form.
  // Dues wins the ambiguity because it was the first strip on the page.
  record: 'record-payment',
  'record-dues': 'record-payment',
  contribution: 'record-contribution',
  contributions: 'record-contribution',
  settings: 'processing',
  processor: 'processing',
  payments_processing: 'processing',
}

export function isDuesSection(value: string): value is DuesSection {
  return (DUES_SECTIONS as readonly string[]).includes(value)
}

export function isFundsSection(value: string): value is FundsSection {
  return (FUNDS_SECTIONS as readonly string[]).includes(value)
}

export function isSettingsSection(value: string): value is SettingsSection {
  return (SETTINGS_SECTIONS as readonly string[]).includes(value)
}

export function isAccountSection(value: string): value is AccountSection {
  return isDuesSection(value) || isFundsSection(value) || isSettingsSection(value)
}

/**
 * Parse a section, or `null` when it is not one. Returns null rather than a default
 * so callers can tell "absent or junk" from "explicitly asked for Dues" — see
 * resolveSection for the defaulting variant.
 *
 * Accepts the string[] shape because Next's searchParams yields an array for a
 * repeated key (`?section=funds&section=routing`); first value wins.
 */
export function matchSection(raw: string | string[] | undefined | null): AccountSection | null {
  const value = Array.isArray(raw) ? raw[0] : raw
  if (!value) return null
  const key = value.trim().toLowerCase().replace(/^#/, '')
  if (isAccountSection(key)) return key
  return SECTION_ALIASES[key] ?? null
}

/** Parse a section, falling back to DEFAULT_SECTION. Use this for URL input. */
export function resolveSection(raw: string | string[] | undefined | null): AccountSection {
  return matchSection(raw) ?? DEFAULT_SECTION
}
