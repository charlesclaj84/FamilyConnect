/**
 * The five sections of My Profile.
 *
 * Free of React and lucide imports on purpose, matching
 * components/transactions/ledgers.ts: the page
 * is a server component that resolves the initial section from `await searchParams`, and
 * it must import this without dragging a client boundary or an icon set into its module
 * graph.
 */

export const PROFILE_SECTIONS =
  ['general', 'address', 'additional', 'texts', 'security'] as const

export type ProfileSection = (typeof PROFILE_SECTIONS)[number]

export const PROFILE_SECTION_LABELS: Record<ProfileSection, string> = {
  general: 'General',
  address: 'Address',
  additional: 'Additional Information',
  // ── `texts` IS NAMED FOR WHAT IT HOLDS, NOT FOR WHAT IT MIGHT ────────────────────
  // "Notifications" was the obvious label and is the wrong one: there is no email or bell
  // preference in this product, so a section called that would promise four controls and
  // offer one. It holds a mobile number, a confirmation, and consent to be texted — which is
  // exactly what "Text Messages" says.
  //
  // It is a SECTION rather than a band inside Sign-in & Security because a number we may send
  // to is not an account credential. Confusing the two is how a member ends up believing that
  // removing their mobile number affects how they log in.
  texts: 'Text Messages',
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
  text: 'texts',
  'text-messages': 'texts',
  sms: 'texts',
  mobile: 'texts',
  phone: 'texts',
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
