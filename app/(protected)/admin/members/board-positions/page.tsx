import { redirect } from 'next/navigation'

/**
 * Board Positions moved into Members & Access, alongside Regions & Chapters in the
 * "Organization" pane.
 *
 * ── WHY IT BELONGS THERE ────────────────────────────────────────────────────────────
 * Organization is where the family says what shape it is. Regions and chapters are the
 * geography; board positions are the offices — and the two are already one feature in every
 * way that matters: they live in ONE action module (`app/actions/admin/chapters.ts`), they
 * share the same three scope words (`national | regional | chapter`), and a regional position
 * is meaningless without a region to hold it for. Two rail items for one answer to one
 * question was the arrangement, and a family setting itself up had to visit both.
 *
 * ── IT IS THE SECOND PANE TO ARRIVE, AND THE PANE NOW SPANS TWO KEYS ────────────────
 * `admin/chapters` governs the geography and `admin/boardpositions` governs the offices, and
 * neither implies the other. That is AGENTS.md's "one PANE may span two keys — the test is
 * whether they are two jobs", and these are: a family may well let somebody curate the board
 * roster without letting them redraw its regions, which is why the two keys did not merge when
 * the screens did. `/admin/members` resolves each one on its own and renders only what the
 * caller holds, so the pane can arrive with one half, the other, or both.
 *
 * ── WHY THE ROUTE STAYS ─────────────────────────────────────────────────────────────
 * The same three reasons `/admin/members/organization` records, and all three apply here unchanged:
 *
 *   * Old links keep working — the manual's Board Positions chapter links here, and so does
 *     whatever an administrator bookmarked while the rail item existed.
 *   * `viewableResources()` walks `FEATURES` to build the set of keys a caller may view, so
 *     the `/admin/members/board-positions` entry in `lib/features.ts` is what keeps the key
 *     `admin/boardpositions` in that answer — and a member whose ONLY admin grant is this one
 *     still needs a nav answer, which is now the Members row.
 *   * `npm run help:check` asserts every chapter's `route` is an exact `FEATURES` href, and
 *     the chapter documenting this screen carries `route: '/admin/members/board-positions'`.
 *
 * ── THE KEY DID NOT MOVE, AND MUST NOT ──────────────────────────────────────────────
 * `permission_table_map` maps `family_roles` onto `admin/boardpositions`, and 20260618000001
 * COMPOSED live RLS policies on `family_roles` and `user_roles` that evaluate
 * `auth_permission('admin/members/board-positions', …)`. Re-keying a pane is a tidy-up in TypeScript
 * and text surgery on `pg_policies` in the database — and `family_roles`' composed policy
 * tests `= 'any'` with an `own_expr` of the literal 'false', so a half-done rename opens or
 * closes that table completely. The key is the string it has been since 20260805000006.
 *
 * ── §1 AND WHY THERE IS NO GUARD HERE ───────────────────────────────────────────────
 * The reason `/admin/members/organization` and `/admin/members/approvals` already record: this reads nothing,
 * renders nothing and holds no data — it rewrites a URL. `/admin/members` gates itself on all
 * five keys its panes need, `admin/boardpositions` among them, and fetches nothing without
 * the grant. A `requireView` here would check the same grant twice and return the worse of
 * the two errors: a 404 says the page does not exist, when what is true is that it moved.
 *
 * WHAT THE OLD PAGE DID THAT SOMETHING ELSE NOW HAS TO: it ran `canAny` on top of
 * `requireView`, because `requireView` is `can()` and scope 'own' would open a page whose
 * every read is `requireScope`. That check moved WITH the pane rather than being dropped —
 * `/admin/members` resolves the pane on `canAny`, so an 'own' holder gets no pane rather than an
 * empty one. Read the note there before changing it; it is the one piece of this move that is
 * not a copy.
 */
export default async function AdminBoardPositionsPage() {
  redirect('/admin/members?tab=organization')
}
