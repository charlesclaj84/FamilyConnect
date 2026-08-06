/**
 * Single source of truth for which features have shipped and which are still on
 * the roadmap.
 *
 * Everything reads from this one registry — the route gate in `proxy.ts`, the
 * "Soon" badges in the sidebar, the dashboard widgets, and the marketing
 * showcase. Launching a feature is a one-line change: flip its `status` to
 * `'live'` and every one of those surfaces updates with it.
 *
 * Two rules keep this file safe to import from anywhere:
 *   1. Keep it pure — data and pure functions only. No React, no `server-only`,
 *      no environment access. `proxy.ts` is bundled separately from the render
 *      path and cannot rely on shared modules that carry state or globals.
 *   2. Register every new feature route here. Only paths that resolve to a
 *      `'future'` entry are gated, so an unlisted route stays reachable and an
 *      unknown URL still falls through to the normal 404.
 */

export type FeatureStatus = 'live' | 'future'

export interface Feature {
  /** Canonical route. Nested paths (`/events/abc`) inherit this feature's status. */
  href: string
  label: string
  status: FeatureStatus
  /** One-liner shown on the Coming Soon screen and in inline placeholders. */
  blurb: string
}

export const FEATURES: readonly Feature[] = [
  // ── Live today ──────────────────────────────────────────────────────────────
  {
    href: '/dashboard',
    label: 'Dashboard',
    status: 'live',
    blurb: 'Your family at a glance — roles, account standing, and what needs attention.',
  },
  {
    href: '/personal-info',
    label: 'My Profile',
    status: 'live',
    blurb: 'Your contact details, address, birthday, and t-shirt size.',
  },
  {
    href: '/chat',
    label: 'Chat',
    status: 'live',
    blurb: 'Real-time group threads and private direct messages with the family.',
  },
  {
    href: '/members',
    label: 'Member Directory',
    status: 'live',
    blurb: 'Search and browse everyone in the family, with roles and contact info.',
  },
  {
    href: '/account-summary',
    label: 'My Summary',
    status: 'live',
    blurb: 'What you owe, what you have paid, and your full payment history.',
  },

  // ── On the roadmap: personal ────────────────────────────────────────────────
  {
    href: '/direct-lineage',
    label: 'My Children',
    status: 'future',
    blurb: 'Add and manage your kids, then convert them to full members as they grow up.',
  },
  {
    href: '/family-tree',
    label: 'Family Tree',
    status: 'future',
    blurb: 'A multi-generation tree of parents, grandparents, children, and spouses.',
  },

  // ── On the roadmap: community ───────────────────────────────────────────────
  {
    href: '/announcements',
    label: 'Announcements',
    status: 'future',
    blurb: 'Family-wide news, with the important updates pinned to the top.',
  },

  // ── On the roadmap: events ──────────────────────────────────────────────────
  {
    href: '/events',
    label: 'Events',
    status: 'future',
    blurb: 'Reunion itineraries, hotel room blocks, and RSVPs for your whole household.',
  },
  {
    href: '/event-planning',
    label: 'Event Planning',
    status: 'future',
    blurb: 'Your assigned planning tasks, with deadlines and completion tracking.',
  },

  // ── On the roadmap: accounting ──────────────────────────────────────────────
  // Dues are LIVE. The `/dues` route itself only redirects to My Summary,
  // but this entry also un-hides the `dues` resource row in Groups & Permissions
  // so a treasurer can be granted `dues:edit` without being made an administrator.
  {
    href: '/dues',
    label: 'Dues',
    status: 'live',
    blurb: 'Dues schedules at any cadence, with a payment plan that fits your budget.',
  },
  {
    href: '/family-finances',
    label: 'Family Finances',
    status: 'future',
    blurb: 'Fund balances, contributions, and a clean profit-and-loss ledger.',
  },

  // ── On the roadmap: resources ───────────────────────────────────────────────
  {
    href: '/photos',
    label: 'Photos',
    status: 'future',
    blurb: 'A shared gallery for every gathering — upload, caption, and relive it.',
  },
  {
    href: '/documents',
    label: 'Documents',
    status: 'future',
    blurb: 'Bylaws, forms, meeting minutes, and family records in one shared place.',
  },
  {
    href: '/elections',
    label: 'Elections',
    status: 'future',
    blurb: 'Nominate, accept, and vote family-wide, with results tallied live.',
  },

  // ── Admin ───────────────────────────────────────────────────────────────────
  // The `/admin` entry covers every nested admin route by prefix; the specific
  // entries below exist so the Coming Soon screen can name the right tool.
  //
  // User Management and Groups & Permissions are LIVE — they were rebuilt on the
  // permission model, and gating them would leave a family unable to administer
  // itself. Who actually sees them is decided by the permission model, not here:
  // both pages start 'restricted' so only administrators reach them.
  {
    href: '/admin',
    label: 'Admin Tools',
    status: 'future',
    blurb: 'The leadership toolkit for running your family organization.',
  },
  {
    href: '/admin/users',
    label: 'User Management',
    status: 'live',
    blurb: 'Group membership and per-person access exceptions.',
  },
  {
    href: '/admin/groups',
    label: 'Groups & Permissions',
    status: 'live',
    blurb: 'Create groups, set what each can do, and choose who may see each page.',
  },
  {
    href: '/admin/chapters',
    label: 'Regions & Chapters',
    status: 'future',
    blurb: 'Organize a large family into regional chapters with scoped leadership.',
  },
  {
    href: '/admin/user-roles',
    label: 'Board Positions',
    status: 'future',
    blurb: 'Assign officer roles and track who holds each seat.',
  },
  {
    href: '/admin/elections',
    label: 'Election Management',
    status: 'future',
    blurb: 'Open nominations, launch the ballot, and publish the results.',
  },
  {
    href: '/admin/announcements',
    label: 'Announcement Management',
    status: 'future',
    blurb: 'Post family-wide news and pin the updates that matter most.',
  },
  {
    href: '/admin/reports',
    label: 'Reports',
    status: 'future',
    blurb: 'Membership, dues collected vs. outstanding, RSVP turnout, and t-shirt counts.',
  },
  {
    href: '/admin/events',
    label: 'Event Management',
    status: 'future',
    blurb: 'Build events, assign the to-do list, and run day-of check-in.',
  },
  {
    href: '/admin/event-types',
    label: 'Event Templates',
    status: 'future',
    blurb: 'Reusable event blueprints that auto-assign the planning checklist.',
  },
  // Accounting is LIVE — it is where dues get set up: schedules, recorded
  // payments, and the funds those payments route into. `/admin/dues` is the legacy
  // URL for the same tool and only redirects here, so it ships alongside it.
  // The route stays `/admin/account` because that string is also the permission
  // resource key, wired into RLS via permission_table_map. Only the name changed.
  {
    href: '/admin/account',
    label: 'Accounting',
    status: 'live',
    blurb: 'Dues schedules, funds, and payment routing for the whole family.',
  },
  {
    href: '/admin/dues',
    label: 'Dues Management',
    status: 'live',
    blurb: 'Dues schedules, funds, and payment routing for the whole family.',
  },
]

/** True when `pathname` is `href` itself or nested beneath it. */
function covers(pathname: string, href: string): boolean {
  return pathname === href || pathname.startsWith(href + '/')
}

/**
 * Resolve the feature owning `pathname`, preferring the most specific match so
 * `/admin/reports` reports Reports rather than the catch-all Admin Tools entry.
 */
export function getFeature(pathname: string): Feature | undefined {
  let match: Feature | undefined
  for (const feature of FEATURES) {
    if (covers(pathname, feature.href) && (!match || feature.href.length > match.href.length)) {
      match = feature
    }
  }
  return match
}

/** Explicitly registered as still on the roadmap. Unknown paths are not future. */
export function isFeatureFuture(pathname: string): boolean {
  return getFeature(pathname)?.status === 'future'
}

/** Explicitly registered as shipped. Unknown paths are not live. */
export function isFeatureLive(pathname: string): boolean {
  return getFeature(pathname)?.status === 'live'
}

/**
 * The gate used by `proxy.ts`. Only known future features are intercepted, so a
 * mistyped URL still renders the real 404 instead of claiming to be a feature
 * that is on the way.
 */
export function isGatedPath(pathname: string): boolean {
  return isFeatureFuture(pathname)
}

const UNKNOWN_FEATURE = {
  label: 'This feature',
  blurb: 'We are still building this part of Family Connect. It will show up here once it ships.',
}

/**
 * Copy for the roadmap surfaces. Always resolves to something printable so call
 * sites don't each need to handle an unregistered path.
 */
export function describeFeature(pathname: string): { label: string; blurb: string } {
  return getFeature(pathname) ?? UNKNOWN_FEATURE
}

/** Shipped features, in registry order — the "available now" list. */
export const LIVE_FEATURES: readonly Feature[] = FEATURES.filter(f => f.status === 'live')
