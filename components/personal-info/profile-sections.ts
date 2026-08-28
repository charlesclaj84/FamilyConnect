import type { T } from '@/lib/i18n/t'

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
  ['general', 'address', 'additional', 'notifications', 'security'] as const

export type ProfileSection = (typeof PROFILE_SECTIONS)[number]

/**
 * THE LABELS LIVE IN THE CATALOGUE, NOT HERE — `profile.section.<id>`.
 *
 * This module stayed pure (no React, no icons) so the page could resolve `?section=` before
 * rendering; Phase 5 keeps that and takes the captions out, exactly as `Sidebar`'s section
 * registry went from `{ label, icon }` to `{ id, icon }`. The ID is the contract — it is in
 * URLs, in `ALIASES` below and in help links — and the caption is copy.
 *
 * The reasoning that used to sit on the two renamed entries is worth keeping:
 *
 *   `notifications` WAS `texts`/"Text Messages" until 2026-08-26. The old note argued against
 *   the broader name on the grounds that only one channel existed, so it would promise four
 *   controls and offer one. That was right when written, and the fix was the product rather
 *   than the label: there is a GRID now. `texts` stays in `ALIASES` so a bookmark still lands.
 *
 *   It is a SECTION rather than a band inside Sign-in & Security because an address we may send
 *   to is not an account credential. Confusing the two is how a member comes to believe that
 *   removing their mobile number changes how they log in.
 *
 *   `security` carries no `permission_resources` row and needs no migration: My Profile is one
 *   of the pages `20260806000006` deliberately put outside the permission grid.
 */

/**
 * One section's caption, in the reader's language.
 *
 * A FUNCTION TAKING `t` rather than a map, so this module can stay pure: the `T` import is
 * type-only and erased at build time, so no React and no catalogue is dragged into the module
 * graph of the server page that resolves `?section=`.
 */
export function profileSectionLabel(t: T, section: ProfileSection): string {
  return t(`profile.section.${section}`)
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
  // The old section id and everything anybody would type for it. `texts` itself is on the
  // list because it WAS the id: a bookmark or a help link carrying it must not silently land
  // on General.
  texts: 'notifications',
  text: 'notifications',
  'text-messages': 'notifications',
  sms: 'notifications',
  mobile: 'notifications',
  phone: 'notifications',
  notification: 'notifications',
  alerts: 'notifications',
  email: 'notifications',
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
