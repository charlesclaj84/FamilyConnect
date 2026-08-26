import type { Catalogue } from '@/lib/i18n/t'

/**
 * The SOURCE catalogue. Every other language is a translation of this one.
 *
 * ── THE KEYS ARE IDENTIFIERS THAT ALREADY EXISTED ───────────────────────────────────
 * `nav.item./admin/members`, not `nav.item.membersAndAccess`. The rail's captions are keyed on
 * the HREF, which is the same stable identifier the permission system uses — AGENTS.md's rule
 * is that a resource key IS the route without its leading slash, so a caption, a route, a
 * permission key and a catalogue key are all one string.
 *
 * That is the whole reason this retrofit is cheap. The hardest part of adding i18n to a mature
 * product is giving thousands of strings names that do not move; this codebase already did it
 * for its own reasons — plan bullets carry `claim: '<tier>/<slug>'`, help chapters carry a
 * `slug` that *"is not a route and moves with nothing"*, sections carry ids. Where a stable id
 * exists, it is the key.
 *
 * ── WHAT IS AND IS NOT IN HERE ──────────────────────────────────────────────────────
 * IN: the shell. The rail, its section headings, the top bar, the account menu, the family
 * switcher, the theme toggle, the notification bell. These are the strings on every screen, so
 * they are the ones worth having first and the ones that prove the mechanism.
 *
 * NOT IN, deliberately:
 *
 *   the MANUAL          `lib/help/content.ts` is ~79KB and gets per-locale MODULES loaded by
 *                       the server components that render it. AGENTS.md already records that
 *                       importing it from a client component is too much for the bundle, and
 *                       `lib/i18n/t.ts` explains why this registry is a static import.
 *   MARKETING copy      Home is path-prefixed (`/es/pricing`), so its copy is resolved per
 *                       route, and `PLANS[]`' bullets are gated by `marketing:check` on their
 *                       own `claim` ids rather than by this catalogue.
 *   database VALUES     a chapter's name, a fund's name, a gathering's title. Those are a
 *                       family's own words and are not ours to translate.
 *
 * ── HOW TO ADD A STRING ─────────────────────────────────────────────────────────────
 * Put it here, use `t('the.key')` at the call site, and run `npm run i18n:check`. That script
 * fails on a key used but not defined, a key defined but not used, a placeholder that appears
 * in a translation and not in the English, and a translation whose English source has changed
 * since it was made. It cannot check whether the words are any good.
 */
export const en: Catalogue = {
  // ── THE RAIL: SECTION HEADINGS ────────────────────────────────────────────────────
  // Keyed on the section id, which `Sidebar.tsx` already had. The first group has no heading
  // (it holds Dashboard) and so has no key.
  'nav.section.community': 'Community',
  'nav.section.gatherings': 'Gatherings',
  'nav.section.library': 'Library',
  'nav.section.accounting': 'Accounting',
  'nav.section.reporting': 'Reporting',
  'nav.section.admin': 'Admin',
  'nav.section.help': 'Help',

  // ── THE RAIL: ITEMS, KEYED ON HREF ────────────────────────────────────────────────
  // THREE CAPTIONS APPEAR TWICE AND MUST STAY SEPARATE KEYS. "Gatherings" is a rail item under
  // Gatherings, another under Admin and a third under Reporting; "Elections" likewise. They are
  // the same word in English and there is no reason to assume they are the same word in every
  // language — one may need an article, or a different noun for the report than for the screen.
  // Collapsing them would be a decision made in English on behalf of every translator.
  'nav.item./dashboard': 'Dashboard',

  'nav.item./community/announcements': 'Announcements',
  'nav.item./community/chat': 'Chat',
  'nav.item./community/directory': 'Directory',
  'nav.item./community/distributions': 'Distributions',
  'nav.item./community/elections': 'Elections',
  'nav.item./community/family-tree': 'Family Tree',
  'nav.item./community/gallery': 'Gallery',

  'nav.item./gatherings': 'Gatherings',
  'nav.item./gatherings/calendar': 'Calendar',

  'nav.item./library/bylaws': 'Bylaws',
  'nav.item./library/documents': 'Documents',
  'nav.item./library/meeting-minutes': 'Meeting Minutes',
  'nav.item./library/officer-notes': 'Officer Notes',

  'nav.item./accounting/summary': 'Summary',
  'nav.item./accounting/dues-and-donations': 'Dues & Donations',
  'nav.item./accounting/transactions': 'Transactions',

  'nav.item./reporting/membership': 'Membership',
  'nav.item./reporting/payment-history': 'Payment History',
  'nav.item./reporting/dues-projections': 'Dues Projections',
  'nav.item./reporting/pl-summary': 'P&L Summary',
  'nav.item./reporting/gatherings': 'Gatherings',
  'nav.item./reporting/elections': 'Elections',
  'nav.item./reporting/meetings': 'Meetings',
  'nav.item./reporting/board': 'Board & Offices',

  'nav.item./admin/members': 'Members',
  'nav.item./admin/gatherings': 'Gatherings',
  'nav.item./admin/accounting': 'Accounting',
  'nav.item./admin/elections': 'Elections',
  'nav.item./admin/settings': 'Settings',

  'nav.item./help': 'How-To Manual',

  // ── THE RAIL: ITS OWN CONTROLS ────────────────────────────────────────────────────
  // Two states of one button, so two keys — a single "Toggle navigation" would be worse copy in
  // every language, because a screen reader reads it at the moment the state matters.
  'nav.open': 'Open navigation menu',
  'nav.close': 'Close navigation menu',

  // ── THE FAMILY SWITCHER ───────────────────────────────────────────────────────────
  'switcher.heading': 'Your families',
  'switcher.switching': 'Switching…',
  'switcher.badge.pending': 'Waiting for approval',
  'switcher.badge.removed': 'This family has been removed',
  'switcher.badge.default': 'Opens when you log in',

  // ── THE ACCOUNT MENU ──────────────────────────────────────────────────────────────
  'account.profile': 'My Profile',
  'account.families': 'My Families',
  'account.appearance': 'Appearance',
  'account.staff': 'GENORRA staff console',
  'account.staffHint': 'Every family · opens in a new window',
  'account.signOut': 'Sign out',

  // ── THE THEME TOGGLE ──────────────────────────────────────────────────────────────
  'theme.light': 'Light',
  'theme.dark': 'Dark',
  'theme.system': 'System',
  // WHOLE SENTENCES, not fragments assembled in JSX. The toggle's accessible name has to name
  // the current state AND the destination, and a language that orders those differently — or
  // needs an article, or inflects the noun after a preposition — cannot be served by
  // concatenation. `{current}` and `{next}` are the mode captions above.
  'theme.switchLabel': 'Appearance: {current}. Switch to {next}.',
  'theme.currentLabel': 'Appearance: {current}',

  // ── THE NOTIFICATION BELL ─────────────────────────────────────────────────────────
  'bell.label': 'Notifications',
  'bell.heading': 'Notifications',
  'bell.markAll': 'Mark all read',
  'bell.empty': 'No notifications yet.',

  // ── HOW LONG AGO ─────────────────────────────────────────────────────────────────
  // `timeAgo` in `lib/date-utils.ts` answers WHICH of these applies and these are the words.
  // The pure module returns data and the component says the sentence — the same division
  // `whenProblems` and `WHEN_PROBLEM_TEXT` already keep.
  //
  // ABBREVIATED ON PURPOSE. These sit in a bell, on a dashboard card and in an archive row,
  // beside a title that is the thing being read — "5 minutes ago" would take more width than
  // the fact is worth. A language that cannot abbreviate this way should spell it out; that is
  // the translator's call, which is exactly why it is a string rather than a template.
  'time.now': 'Just now',
  'time.minutes': '{n}m ago',
  'time.hours': '{n}h ago',

  // ── THE LANGUAGE SWITCHER ─────────────────────────────────────────────────────────
  // The endonyms themselves are NOT here: they live in `lib/i18n/locales.ts` and are never
  // translated, because a member looking for their own language scans for the word they would
  // use for it and that word does not change with the interface they are reading.
  'language.label': 'Language',
  'language.choose': 'Choose a language',
}
