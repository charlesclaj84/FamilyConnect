/**
 * The three sections of My Profile.
 *
 * Free of React and lucide imports on purpose, matching
 * components/transactions/ledgers.ts and components/account/summary-panes.ts: the page
 * is a server component that resolves the initial section from `await searchParams`, and
 * it must import this without dragging a client boundary or an icon set into its module
 * graph.
 */

export const PROFILE_SECTIONS = ['general', 'address', 'additional', 'security'] as const

export type ProfileSection = (typeof PROFILE_SECTIONS)[number]

export const PROFILE_SECTION_LABELS: Record<ProfileSection, string> = {
  general: 'General',
  address: 'Address',
  additional: 'Additional Information',
  // The account, not the profile: sign-in address and password. It carries no
  // permission_resources row and needs no migration, because My Profile is one of the
  // pages 20260806000006 deliberately put outside the permission grid — see the header
  // of components/personal-info/SignInSecurity.tsx.
  security: 'Sign-in & Security',
}

/** Landing section when `?section=` is absent or unreadable. */
export const DEFAULT_PROFILE_SECTION: ProfileSection = 'general'

/** Forgiving forms for hand-typed and shared URLs. */
const ALIASES: Record<string, ProfileSection> = {
  'general-information': 'general',
  info: 'general',
  name: 'general',
  contact: 'general',
  addresses: 'address',
  location: 'address',
  'additional-information': 'additional',
  other: 'additional',
  extra: 'additional',
  'sign-in': 'security',
  signin: 'security',
  account: 'security',
  password: 'security',
}

export function isProfileSection(value: string): value is ProfileSection {
  return (PROFILE_SECTIONS as readonly string[]).includes(value)
}

export function resolveProfileSection(raw: string | string[] | undefined | null): ProfileSection {
  const value = Array.isArray(raw) ? raw[0] : raw
  if (!value) return DEFAULT_PROFILE_SECTION
  const key = value.trim().toLowerCase().replace(/^#/, '')
  if (isProfileSection(key)) return key
  return ALIASES[key] ?? DEFAULT_PROFILE_SECTION
}
