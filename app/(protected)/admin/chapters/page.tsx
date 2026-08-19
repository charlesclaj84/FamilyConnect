import { redirect } from 'next/navigation'

/**
 * Regions & Chapters moved into Members & Access as its "Organization" pane.
 *
 * ── WHY THE ROUTE STAYS ─────────────────────────────────────────────────────────────
 * Three reasons, and each is load-bearing on its own:
 *
 *   * Old links keep working. `/features` links here (`app/(marketing)/features/page.tsx`),
 *     the manual's Regions & Chapters chapter links here twice, and whatever an
 *     administrator bookmarked while the rail item existed points here. A 404 strands all
 *     of them.
 *   * `viewableResources()` walks `FEATURES` to build the set of keys a caller may view,
 *     so the `/admin/chapters` entry in `lib/features.ts` is what keeps the key
 *     `admin/chapters` in that answer — and a member whose ONLY admin grant is this one
 *     still needs a nav answer, which is now the Members row.
 *   * `npm run help:check` asserts every chapter's `route` is an exact `FEATURES` href.
 *     The chapter that documents this screen carries `route: '/admin/chapters'`, so
 *     deleting the entry breaks the manual rather than tidying up after the move.
 *
 * ── THE KEY DID NOT MOVE, AND MUST NOT ──────────────────────────────────────────────
 * `permission_table_map` maps BOTH `regions` and `chapters` onto `admin/chapters`, and
 * 20260618000001 COMPOSED live RLS policies that evaluate
 * `auth_permission('admin/chapters', …)`. Re-keying a pane is a nice tidy-up in TypeScript
 * and text surgery on `pg_policies` in the database — and a policy naming an unregistered
 * non-admin key falls through to `'any'` for view, so getting it half-right opens two
 * tables. The `label` changed to "Organization" and the grid caption changed with it; the
 * key is the same string it has been since 20260618000000.
 *
 * ── §1 AND WHY THERE IS NO GUARD HERE ───────────────────────────────────────────────
 * AGENTS.md §1 says every page gates at load, immediately after resolving the user. This
 * page does not, and the reason is the one `/admin/approvals` already records: it reads
 * nothing, renders nothing and holds no data — it rewrites a URL. `/admin/users` gates
 * itself on the four keys its four panes need, `admin/chapters` among them, and the
 * Organization pane fetches nothing without that grant. A `requireView` here would check
 * the same grant twice and return the WORSE error of the two: a 404 from this route says
 * the page does not exist, when what is true is that the page moved.
 *
 * The tab parameter is `?tab=organization` because that is the convention `/admin/users`
 * actually reads — `searchParams.tab`, matched against its pane ids. Do not invent a
 * second one here.
 */
export default async function AdminChaptersPage() {
  redirect('/admin/users?tab=organization')
}
