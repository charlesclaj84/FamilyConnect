import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { can } from '@/lib/auth/permissions'
import { describeFeature, requiredTier } from '@/lib/features'
import { getMyFamilyTier } from '@/lib/auth/tier'
import { TIER_LABEL } from '@/lib/tiers'
import { UpgradeScreen } from '@/components/features/UpgradeScreen'
import { currentUser } from '@/lib/auth/current-user'

/**
 * Where `requireTier()` sends a member reaching for a page their family's plan does not
 * include. The counterpart to `/coming-soon`, and deliberately a REDIRECT target rather
 * than a rewrite target like that one.
 *
 * WHY REDIRECT RATHER THAN REWRITE. `/coming-soon` is served by `proxy.ts`, which can
 * rewrite because it sits in front of the request and the decision needs no session —
 * so the browser keeps the original URL, which is right for a route that will one day
 * work there. This decision is made inside the page, after auth and a database read, at
 * which point the only instrument left is `redirect()`. The address bar changing is
 * fine here and arguably better: the member did not hit a broken page, they hit a
 * boundary, and the URL should say which one.
 *
 * ── THE ONE PAGE UNDER (protected) THAT DOES NOT CALL `requireView` ─────────────────
 * Along with `/coming-soon`, and for a sharper version of the same reason. §1's preamble
 * is not merely unnecessary here — calling it would be a LOOP: `requireView` is what
 * redirects to this page, so a tier-gated resource would bounce between the two forever.
 * There is nothing to gate anyway: this screen reads no family data, and every word on it
 * is published on `/pricing` to anyone at all.
 *
 * It still resolves the caller and refuses an anonymous one, because the layout above it
 * is the signed-in shell and rendering it for nobody would be a page with a rail and no
 * member behind it.
 *
 * It is deliberately NOT registered in `lib/features.ts`: an unregistered path is neither
 * roadmap-gated nor tier-gated (both default to reachable), which is exactly what a
 * screen about the gates needs to be.
 */

interface Props {
  searchParams: Promise<{ from?: string }>
}

export async function generateMetadata({ searchParams }: Props): Promise<Metadata> {
  const { from } = await searchParams
  const { label } = describeFeature(from ?? '')
  // `title.template` appends the product name — see AGENTS.md, "Page titles are
  // composed". `robots` is inherited from the (protected) layout, which sets
  // `index: false` for everything beneath it.
  return { title: `${label} — ${TIER_LABEL[requiredTier(from ?? '')]}` }
}

export default async function UpgradePage({ searchParams }: Props) {
  const { user } = await currentUser()
  if (!user) redirect('/login')

  const { from } = await searchParams
  const { label, blurb } = describeFeature(from ?? '')

  // `from` IS UNTRUSTED and needs no validation, which is worth stating because it looks
  // like it should. It is a query parameter, so a member can type any path they like into
  // it — and the worst they achieve is naming a different feature on a screen whose every
  // word is already public. `describeFeature` falls back to generic copy for a path it
  // does not know, and `requiredTier` falls back to Free. Nothing is read out of the
  // family's data on the strength of it.
  // `can`, not `requireView` — this page must not 404 somebody for lacking the Settings
  // grant, it must simply not offer them a link they cannot follow. Settings is
  // registered 'restricted' per family (20260812000000), so for most members this is
  // false and the screen says to ask an administrator instead.
  //
  // No tier check on it, deliberately: `/admin/settings` is Free, so it is reachable from
  // every plan — including the one that sent the member here. If it ever stopped being
  // Free, this link would need `tierAllows` too, or it would bounce them straight back.
  const [currentTier, canOpenSettings] = await Promise.all([
    getMyFamilyTier(user.id),
    can(user.id, 'admin/settings', 'view'),
  ])

  return (
    <UpgradeScreen
      label={label}
      blurb={blurb}
      currentTier={currentTier}
      requiredTier={requiredTier(from ?? '')}
      settingsHref={canOpenSettings ? '/admin/settings' : null}
    />
  )
}
