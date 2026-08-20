/**
 * The rails of the two Gatherings screens — the member-facing one at `/gatherings` and the
 * organizer one at `/admin/gatherings`.
 *
 * ── WHY THIS IS A PURE MODULE AND NOT A `const` IN THE SHELL ─────────────────────────
 * Both shells are `'use client'`, and both PAGES are Server Components that have to validate
 * `?pane=` before deciding what to fetch. A Server Component importing a runtime VALUE out of
 * a `'use client'` module does not get the value — the bundler hands it a client reference —
 * so `ANNOUNCEMENT_PANES.includes(...)` threw `.includes is not a function` on `/community/announcements`
 * and rendered the error boundary over the whole page. Type-only imports across that boundary
 * are erased and are fine; values never are. `lib/announcement-panes.ts` and
 * `components/admin/account-sections.ts` are the same shape for the same reason.
 *
 * No React, no lucide, no `server-only`. The ICONS stay in the shells, because a lucide import
 * is a client concern and dragging one in here would put it in the page's module graph.
 *
 * ── ONE RAIL ITEM, ONE PERMISSION RESOURCE ──────────────────────────────────────────
 * AGENTS.md, and every id below is a key that already existed as a route:
 *
 *   /gatherings          `gatherings`                   the family's gatherings
 *                        `gatherings/my-tasks`          the caller's own tasks
 *   /admin/gatherings    `admin/gatherings`             scheduling and ruling on answers
 *                        `admin/gathering-templates`    the step-list library
 *
 * None of the four keys moved when the panes were merged, and none may. `/gatherings/my-tasks`
 * and `/admin/gatherings/templates` still exist as ROUTES — each redirects to its pane — which
 * is what keeps the key honest: AGENTS.md is explicit that a resource key is the route without
 * its leading slash, and it is what keeps `viewableResources()` able to find them at all,
 * since that walks `FEATURES` by href.
 */

// ── /gatherings ─────────────────────────────────────────────────────────────────────

/** In rail order. The page validates `?pane=` against this; the shell draws it. */
export const GATHERING_PANES = ['gatherings', 'my-tasks'] as const

export type GatheringPane = typeof GATHERING_PANES[number]

/** The resource key each pane is gated on — the whole of "one rail item, one resource". */
export const GATHERING_PANE_RESOURCE: Record<GatheringPane, string> = {
  gatherings: 'gatherings',
  'my-tasks': 'gatherings/my-tasks',
}

/** A `?pane=` that arrived from a URL, checked. */
export function isGatheringPane(value: unknown): value is GatheringPane {
  return typeof value === 'string' && (GATHERING_PANES as readonly string[]).includes(value)
}

/**
 * The sentence under the rail, per pane.
 *
 * It is per-pane rather than per-page for the reason `/community/announcements` learned the hard way: a
 * lede describing the board over a birthday list is worse than no lede. These two are further
 * apart than that pair — one is the family's plans, the other is the reader's own to-do list.
 */
export const GATHERING_PANE_LEDE: Record<GatheringPane, string> = {
  gatherings:
    'Everything the family is planning together, built from a template so nothing is '
    + 'forgotten and every job has a name against it.',
  'my-tasks':
    'Everything the family has asked you to do for a gathering, soonest deadline first. '
    + 'Send an answer back and an organizer reviews it — if they need something changed, '
    + 'their notes appear here with the task.',
}

// ── /admin/gatherings ───────────────────────────────────────────────────────────────

/**
 * THREE PANES, NOT TWO, and the third is the one that used to be a route.
 *
 * `gatherings` and `queue` were already a rail on `/admin/gatherings`. `templates` was
 * `/admin/gatherings/templates`, a second row in the Admin rail; it is a pane here now and that
 * route redirects. Flat rather than nested — Management containing Gatherings and Review queue,
 * with Templates beside it — because the review queue is a sibling JOB rather than a sub-part
 * of the list, and because nesting two `MainRail`s would be a second rail treatment this
 * codebase does not have (Accounting's second level is a filled-pill column, deliberately not
 * another rail).
 */
export const ADMIN_GATHERING_PANES = ['gatherings', 'queue', 'templates'] as const

export type AdminGatheringPane = typeof ADMIN_GATHERING_PANES[number]

/**
 * The key each pane is gated on. The first two share one — `admin/gatherings:view` is what the
 * console IS, and there is no sub-key dividing the list from the queue — while the library keeps
 * the key it had as a route. An organizer who is not a template author is an ordinary split for
 * a family to make, which is exactly why the two keys did not merge when the screens did.
 */
export const ADMIN_GATHERING_PANE_RESOURCE: Record<AdminGatheringPane, string> = {
  gatherings: 'admin/gatherings',
  queue: 'admin/gatherings',
  templates: 'admin/gatherings/templates',
}

export function isAdminGatheringPane(value: unknown): value is AdminGatheringPane {
  return typeof value === 'string' && (ADMIN_GATHERING_PANES as readonly string[]).includes(value)
}
