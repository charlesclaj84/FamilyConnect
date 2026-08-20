import { redirect } from 'next/navigation'

/**
 * `/gatherings/my-tasks` IS A REDIRECT NOW, and the screen it used to be is the My Tasks pane
 * of `/gatherings`.
 *
 * ── WHY THE ROUTE STAYS AT ALL ──────────────────────────────────────────────────────
 * Three reasons, and the second is the one that makes deleting it a real cost:
 *
 *   * Links are already out — a task notification's `link` points here, and there are rows in
 *     `notifications` carrying it. A 404 for somebody following a notification about a job
 *     they have been given is the worst possible answer.
 *   * The KEY has to survive. `viewableResources()` builds the sidebar by walking `FEATURES`,
 *     so `gatherings/my-tasks` is only ever in a caller's answer because there is an entry for
 *     this href. Delete the route and the pane's own grant becomes unresolvable — the shape
 *     `/admin/chapters` kept its entry for when Regions & Chapters became a pane.
 *   * The key is `gatherings/my-tasks` BECAUSE the route exists. AGENTS.md is explicit that a
 *     resource key is the route without its leading slash, so keeping the route is what keeps
 *     the key honest — and it avoids a migration copying every family's grant onto a renamed
 *     key, which is what 20260815000000 cost when My Summary's panes became screens.
 *
 * ── NO GUARD HERE, DELIBERATELY ─────────────────────────────────────────────────────
 * This page reads nothing and renders nothing, so there is nothing to gate: the redirect lands
 * on `/gatherings`, which resolves `requireFamilyActive`, `requireTier` and both pane grants
 * itself and 404s a caller holding neither. Adding a `requireView` here would be a second,
 * weaker copy of that check whose only effect would be to answer 404 where the real page
 * answers /upgrade or the removed-family notice.
 */
export default function MyGatheringTasksPage() {
  redirect('/gatherings?pane=my-tasks')
}
