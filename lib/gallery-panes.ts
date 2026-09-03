/**
 * The two panes of `/community/gallery` — the albums, and the search across all of them.
 *
 * ── WHY THIS IS A PURE MODULE AND NOT A `const` IN THE SHELL ─────────────────────────
 * `GalleryShell` is `'use client'`, and the PAGE is a Server Component that has to validate
 * `?pane=` before it decides what to render. A Server Component importing a runtime VALUE out
 * of a `'use client'` module does not get the value — the bundler hands it a client reference
 * — so `ANNOUNCEMENT_PANES.includes(...)` threw `.includes is not a function` on
 * `/community/announcements` and rendered the error boundary over the whole page. Type-only
 * imports across that boundary are erased and are fine; values never are.
 * `lib/gathering-panes.ts`, `lib/announcement-panes.ts` and
 * `components/admin/account-sections.ts` are the same shape for the same reason.
 *
 * No React, no lucide, no `server-only`. The ICONS stay in the shell, because a lucide import
 * is a client concern and dragging one in here would put it in the page's module graph.
 *
 * ── TWO PANES, ONE KEY, AND THAT IS THE DECISION RATHER THAN A SHORTCUT ─────────────
 * AGENTS.md' default is "one rail item, one permission resource", and this is the stated
 * exception — the `accounting/dues-and-donations` precedent, whose own note sets the test:
 *
 *   > **merge two ROUTES freely, and merge two KEYS only when no family could sensibly split
 *   > them.**
 *
 * No family could. The search returns only photographs the caller may already read: it runs on
 * the USER client, so `photos`' own SELECT policy narrows it, and `searchPhotos` resolves
 * `community/gallery:view` before it reads anything. Searching is a way of FINDING what you
 * are already entitled to see, so a grant that let somebody browse the albums and not search
 * them would withhold nothing — it would only make a relative scroll.
 *
 * SO THERE IS NO MIGRATION and no second `permission_resources` row. Neither pane is a ROUTE
 * either, unlike `/gatherings/my-tasks`, which exists as a redirect to keep its key honest —
 * there is no key here for a route to have to match.
 *
 * ── AND NO PANE MAY BE ADDED THAT COULD BE DELEGATED SEPARATELY ─────────────────────
 * A third pane that a family might sensibly withhold — a moderation queue, a trash — is a
 * second KEY and therefore a migration, and it must not be added here on the strength of this
 * file already existing.
 */

/** In rail order. The page validates `?pane=` against this; the shell draws it. */
export const GALLERY_PANES = ['albums', 'search'] as const

export type GalleryPane = typeof GALLERY_PANES[number]

/** A `?pane=` that arrived from a URL, checked. */
export function isGalleryPane(value: unknown): value is GalleryPane {
  return typeof value === 'string' && (GALLERY_PANES as readonly string[]).includes(value)
}
