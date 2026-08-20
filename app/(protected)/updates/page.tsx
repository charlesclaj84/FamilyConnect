import { redirect } from 'next/navigation'

/**
 * `/updates` IS A REDIRECT NOW, and the screen it used to be is the Updates pane of
 * `/announcements`.
 *
 * ── WHY THE ROUTE STAYS AT ALL ──────────────────────────────────────────────────────
 * Three reasons, and the third is the one that makes deleting it a real cost:
 *
 *   * Links are already out. The dashboard's Recent Updates card offers "View all updates"
 *     and a member may have bookmarked or shared the page; a 404 for those is a worse
 *     answer than one hop.
 *   * The KEY has to survive. `viewableResources()` builds the sidebar by walking
 *     `FEATURES`, so `updates` is only ever in a caller's answer because there is an entry
 *     for this href. Delete the route and the pane's own grant becomes unresolvable —
 *     which is exactly the shape `/admin/chapters` kept its entry for when Regions &
 *     Chapters became the Organization pane of Members & Access.
 *   * The key is `updates` and not `announcements/updates` BECAUSE the route exists. AGENTS.md
 *     is explicit that the resource key is the route without its leading slash, so keeping
 *     the route is what keeps the key honest — and it avoids a migration that would have to
 *     copy every family's grant onto a renamed key, which is what 20260815000000 cost when
 *     My Summary's panes became screens.
 *
 * ── NO GUARD HERE, DELIBERATELY ─────────────────────────────────────────────────────
 * This page reads nothing and renders nothing, so there is nothing to gate: the redirect
 * lands on `/announcements`, which resolves `requireFamilyActive`, `requireTier` and all
 * three pane grants itself and 404s a caller holding none of them. Adding a `requireView`
 * here would be a second, weaker copy of that check whose only effect would be to answer
 * 404 where the real page answers /upgrade or the removed-family notice.
 *
 * `?q=` and `?pages=` are NOT carried across. They are the archive's own state and it
 * rebuilds them from the pane it now lives on; carrying them would mean parsing and
 * re-encoding caller input on a route whose whole job is to point somewhere else.
 */
export default function UpdatesPage() {
  redirect('/announcements?pane=updates')
}
