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
 *   * OWNERSHIP  — which client component renders a section. `milestones` is
 *     rendered by AdminFundsClient (it needs that component's fund list, since a
 *     milestone is paid out of one), and the *_SECTIONS tuples below drive the guards
 *     each component uses to decide whether to render at all.
 *
 *   * PRESENTATION — how the nav groups sections for the reader. `milestones` is its
 *     own top-level group rather than a page inside Expenses, because an admin
 *     setting up what a graduation is worth is not thinking about fund plumbing.
 *     That axis lives entirely in SECTION_GROUPS in the shell, deliberately kept out
 *     of here so grouping has exactly one home.
 *
 * Conflating the two is what makes tab-style layouts calcify around whichever
 * component happens to hold the state.
 *
 * WHAT IS NOT HERE: the ledgers. Payments, contributions and disbursements — and the
 * three forms that append to them — are not administration, they are the day's work,
 * and they live on /transactions in the main nav. What is left is configuration: what
 * members owe, what they can give to, the pots money lands in, how it splits, and
 * what a milestone is worth.
 */

/** Sections rendered by AdminIncomeClient. */
export const INCOME_SECTIONS = ['dues', 'donations'] as const

/** Sections rendered by AdminFundsClient. */
export const FUNDS_SECTIONS = ['funds', 'routing', 'milestones'] as const

/** Sections rendered by the shell itself. Both are inert placeholders for now. */
export const SETTINGS_SECTIONS = ['processing', 'bank'] as const

export type IncomeSection = (typeof INCOME_SECTIONS)[number]
export type FundsSection = (typeof FUNDS_SECTIONS)[number]
export type SettingsSection = (typeof SETTINGS_SECTIONS)[number]
export type AccountSection = IncomeSection | FundsSection | SettingsSection

/**
 * Landing section when no `?section=` is given, or when it is unreadable. Dues is
 * the page's reason for existing, so an admin who follows a truncated link still
 * arrives somewhere useful.
 */
export const DEFAULT_SECTION: AccountSection = 'dues'

/**
 * Nav label and pane title for each section.
 *
 * These name the PAGE, not its domain — the group pill above it already says
 * "Income" or "Expenses", so repeating that here would label both levels the same and
 * tell the reader nothing about where they actually are. Every page name below is
 * therefore distinct from its group: `funds` is "Funds" under "Expenses", `dues` and
 * `donations` sit under "Income".
 *
 * The three under Transactions dropped their "History" suffix: the group says what
 * they are, and "Payment History" under "Transactions" said history twice.
 */
export const SECTION_LABELS: Record<AccountSection, string> = {
  dues: 'Dues',
  donations: 'Donations',
  funds: 'Funds',
  routing: 'Routing',
  milestones: 'Milestones',
  processing: 'Processing',
  bank: 'Bank Information',
}

/**
 * Forgiving forms for hand-typed and legacy URLs. `schedules` matters most: it was
 * the canonical id for the Dues page until the Income redesign, so it is in every
 * link anyone has shared.
 *
 * The ledger ids (`payments`, `contributions`, `disbursements`) and the `record-*`
 * ids are NOT aliased here, deliberately: those pages moved to /transactions, and
 * silently landing someone on Dues configuration when they asked for the payment
 * ledger would be worse than the default. matchSection returns null for them, and
 * resolveSection falls through to Dues — the same as any other unreadable value.
 */
const SECTION_ALIASES: Record<string, AccountSection> = {
  schedules: 'dues',
  schedule: 'dues',
  'dues-schedules': 'dues',
  donation: 'donations',
  gift: 'donations',
  gifts: 'donations',
  fund: 'funds',
  'all-funds': 'funds',
  balance: 'funds',
  balances: 'funds',
  allocation: 'routing',
  allocations: 'routing',
  milestone: 'milestones',
  settings: 'processing',
  processor: 'processing',
  payments_processing: 'processing',
  banking: 'bank',
  'bank-info': 'bank',
  'bank-information': 'bank',
  'bank-account': 'bank',
}

/**
 * The permission resource governing each section.
 *
 * One grant per section rather than one for the whole page: maintaining the dues
 * schedule, redrawing the routing split, creating funds and pricing a milestone are
 * four different jobs, and `admin/account:edit` used to be a single switch for all of
 * them. Registered by 20260806000007 under the Admin category, subsection 'Accounting'.
 *
 * Both Settings panes share one key — they are two views of the same "how money is
 * processed" question, and neither is implemented yet.
 *
 * The `admin/account/` prefix is load-bearing: getFeature() longest-prefix-matches, so
 * these resolve to the live /admin/account entry rather than the 'future' /admin one.
 * A key under a future-status prefix disappears from both admin grids silently.
 */
export const SECTION_RESOURCE: Record<AccountSection, string> = {
  dues:       'admin/account/dues',
  donations:  'admin/account/donations',
  funds:      'admin/account/funds',
  routing:    'admin/account/routing',
  milestones: 'admin/account/milestones',
  processing: 'admin/account/settings',
  bank:       'admin/account/settings',
}

/** What the caller may do in one section. Resolved server-side, passed down as props. */
export interface SectionRights {
  view: boolean
  create: boolean
  edit: boolean
  delete: boolean
}

export type AccountRights = Record<AccountSection, SectionRights>

/** Every section denied — the shape a page uses before it resolves anything. */
export const NO_RIGHTS: SectionRights = { view: false, create: false, edit: false, delete: false }

export function isIncomeSection(value: string): value is IncomeSection {
  return (INCOME_SECTIONS as readonly string[]).includes(value)
}

export function isFundsSection(value: string): value is FundsSection {
  return (FUNDS_SECTIONS as readonly string[]).includes(value)
}

export function isSettingsSection(value: string): value is SettingsSection {
  return (SETTINGS_SECTIONS as readonly string[]).includes(value)
}

export function isAccountSection(value: string): value is AccountSection {
  return isIncomeSection(value) || isFundsSection(value) || isSettingsSection(value)
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
