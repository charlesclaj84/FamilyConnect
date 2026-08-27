import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { describeFeature, LIVE_FEATURES } from '@/lib/features'
import { viewableResources } from '@/lib/auth/permissions'
import { getViewingMembership, isActiveFamily, REMOVED_FAMILY_RESOURCES } from '@/lib/auth/family'
import { ComingSoonScreen } from '@/components/features/ComingSoon'
import { currentUser } from '@/lib/auth/current-user'
import { callerI18n } from '@/lib/i18n/server'

/**
 * Destination for the roadmap gate in `proxy.ts`. The gate rewrites (rather than
 * redirects) unshipped routes here, so the browser keeps showing the original
 * URL and `from` tells us which feature to name.
 *
 * ── IT RESOLVES THE CALLER'S OWN SET, since 2026-08-22 ─────────────────────────────
 * The "Available now" list used to be `LIVE_FEATURES`, unfiltered, rendered inside the
 * component — so every member reaching a gated URL was handed every live route in the
 * product, administrator screens and paid ones included. `viewableResources()` is the
 * answer, and it is the SAME call the sidebar builds the rail from, which is the property
 * worth keeping: this screen cannot offer a destination the rail would have hidden.
 *
 * That function already applies both narrowings — the permission grid AND the family's
 * plan — and answers `PENDING_RESOURCES` for somebody awaiting a decision. So there is no
 * second tier check to remember here, and an applicant gets the two or three pages they
 * can actually open rather than a menu of forty.
 *
 * NO `requireView` ON THIS PAGE, deliberately. AGENTS.md names `/coming-soon` as the one
 * exempt route, and the reason is structural: it must render precisely when the caller
 * CANNOT reach a feature. Gating it on the feature it is apologising for would answer 404.
 */

interface Props {
  searchParams: Promise<{ from?: string }>
}

export async function generateMetadata({ searchParams }: Props): Promise<Metadata> {
  const { from } = await searchParams
  const { label } = describeFeature(from ?? '')
  return { title: `${label} — Coming Soon` }
}

export default async function ComingSoonPage({ searchParams }: Props) {
  const { from } = await searchParams
  const { label, blurb } = describeFeature(from ?? '')

  const { user } = await currentUser()
  // Signed out, there is no set to resolve and nothing to offer. `/login` rather than an
  // empty list: the gate that sent them here sits inside the protected shell.
  if (!user) redirect('/login')

  const { t } = await callerI18n(user?.id)

  const [viewable, membership] = await Promise.all([
    viewableResources(user.id),
    // Free: `cache()`d and already resolved for this request by the layout.
    getViewingMembership(user.id),
  ])

  // A REMOVED FAMILY IS NARROWED THE WAY THE RAIL IS. Without this the screen offers twenty
  // destinations that all redirect to `/dashboard`'s removal notice — navigation, not
  // authorization, and the same list `app/(protected)/layout.tsx` filters against for the
  // same reason.
  const familyRemoved = Boolean(membership) && !isActiveFamily(membership?.familyStatus)

  const available = LIVE_FEATURES
    // PANES ARE NOT DESTINATIONS. Four registry entries are sub-keys carrying a tier and a
    // permission key with no page behind them (`pane: true` in `lib/features.ts`), and three
    // of them were offered here as links that 404 — this list is the one thing in the product
    // that turns the registry into a set of PLACES, which is why it is the one that has to
    // know the difference.
    .filter(f => !f.pane)
    .filter(f => viewable.has(f.href.replace(/^\//, '')))
    .filter(f => !familyRemoved || REMOVED_FAMILY_RESOURCES.includes(f.href.replace(/^\//, '')))
    .map(f => ({ href: f.href, label: f.label }))

  return <ComingSoonScreen label={label} blurb={blurb} available={available} t={t} />
}
