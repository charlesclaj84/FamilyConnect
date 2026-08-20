import { redirect } from 'next/navigation'

/**
 * `/admin/gathering-templates` IS A REDIRECT NOW, and the library it used to be is the
 * Templates pane of `/admin/gatherings`.
 *
 * ── WHY THE ROUTE STAYS AT ALL ──────────────────────────────────────────────────────
 * The KEY has to survive, and this is the only thing that keeps it resolvable.
 * `viewableResources()` builds the sidebar by walking `FEATURES`, so
 * `admin/gathering-templates` is only ever in a caller's answer because there is an entry for
 * this href — and that key is not decoration: `gathering_templates` and
 * `gathering_template_steps` both name it in their RLS policy, so it decides who can read the
 * library at all, not merely who sees a tab. It is also the key the resource row is registered
 * under, and AGENTS.md is explicit that a resource key is the route without its leading slash;
 * renaming it into a sub-key would be a migration copying every family's grant across, which is
 * what 20260815000000 cost when My Summary's panes became screens.
 *
 * Links are already out too — two sentences in the Gatherings feature point here, and the help
 * manual's chapter carries this route.
 *
 * ── NO GUARD HERE, DELIBERATELY ─────────────────────────────────────────────────────
 * This page reads nothing and renders nothing. The redirect lands on `/admin/gatherings`, which
 * resolves `requireFamilyActive`, `requireTier` and both pane grants itself and 404s a caller
 * holding neither. A `requireView` here would be a second, weaker copy of that check whose only
 * effect would be to answer 404 where the real page answers /upgrade or the removed-family
 * notice.
 *
 * The same arrangement `/admin/chapters` has had since the Organization pane absorbed it — and
 * since 2026-08-19 the parallel is exact rather than merely similar: this key is
 * `tier: 'standard'` on a page that is Free, exactly as `admin/chapters` is `tier: 'plus'` on a
 * page that is Free. Both target pages and `tierAllows()` into the pane's grant by hand and
 * redirect a caller who holds ONLY that pane to `/upgrade` with this route in `?from=`. A guard
 * here would answer 404 instead, which is the true answer to a different question.
 */
export default function AdminGatheringTemplatesPage() {
  redirect('/admin/gatherings?pane=templates')
}
