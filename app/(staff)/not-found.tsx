import { SearchX } from 'lucide-react'
import { PageShell } from '@/components/layout/PageShell'

/**
 * The 404 for everything under `app/(staff)`.
 *
 * ── WHAT THIS FILE IS ACTUALLY FOR, WHICH IS NARROWER THAN IT LOOKS ────────────────
 * The staff console 404s rather than refusing — `requireStaff()` and
 * `requireStaffOwner()` both call `notFound()`, because a screen that says "you are not
 * GENORRA staff" tells any signed-in customer that a cross-family console exists and that
 * the way in is an account flag. Before this file, every one of those 404s rendered Next's
 * built-in fallback, which is correct and says nothing. This exists so that the ONE
 * audience that can actually reach it gets a page in the product's own type instead.
 *
 * WHO THAT AUDIENCE IS, VERIFIED AGAINST NEXT 16.2.7 RATHER THAN ASSUMED. A segment's
 * `not-found` element is handed to the LayoutRouter that renders that segment's CHILDREN
 * (`create-component-tree.tsx`: `notFound: notFoundComponent` on the `children` parallel
 * route), which is also what the file-convention doc means by "renders between loading.js
 * and page.js". So the boundary sits INSIDE `app/(staff)/layout.tsx`, and two cases fall
 * out of that:
 *
 *   * **A caller who is not staff at all** is refused by the LAYOUT's own
 *     `requireStaff()`. A `notFound()` thrown by a layout is not caught by the boundary
 *     inside it — it bubbles past to the parent segment, which is the root, and there is
 *     no `app/not-found.tsx`, so Next's built-in fallback renders inside the root layout.
 *     Nothing of the console is composed at all: no band, no nav, and the tab reads the
 *     ROOT layout's `title.default`. That is the case this file must not weaken, and it
 *     never renders for it.
 *   * **A caller who IS staff** — a mistyped URL under `/staff`, or a `support` staffer
 *     who reached `/staff/access` — gets this, composed inside the console's header band,
 *     because the layout rendered successfully before the page threw. They already know
 *     the console exists; they are standing in it.
 *
 * ── SO IT NAMES NOTHING AND LINKS NOWHERE, AND THE LINK IS THE DELIBERATE ABSENCE ──
 * `app/(protected)/not-found.tsx` ends in a "Back to dashboard" button, which is right
 * there: it keeps a member inside the app with an obvious way on. The equivalent here
 * would be "Back to the console", and it is refused on a single argument that holds in
 * both directions of the case analysis above. Whoever can see this page already has the
 * console's whole navigation in the band above it, so a link buys them nothing; and if the
 * composition above ever changes so that somebody who is NOT staff can see this render,
 * the link is the only thing on the page that would tell them where they had arrived.
 * A page with nothing to disclose cannot be made to disclose anything.
 *
 * It also carries no `metadata`. A route-segment `not-found` cannot set its own — only
 * `global-not-found` can — so the tab reads the group layout's `title.default`, and there
 * is nothing to write here that would change it.
 *
 * ── `PageShell`, NOT THE CENTRED `max-w-md` MESSAGE THE MEMBER PRODUCT USES ────────
 * The other difference from `app/(protected)/not-found.tsx`, and it is a rule rather than
 * a preference. `components/layout/PageShell.tsx` enumerates exactly three centred
 * `max-w-*` containers left in the tree — /chat's empty state, `error.tsx` and
 * `not-found.tsx` — and states that they are the whole exception list, and that a fourth
 * belongs in the component or in a named option. Adding a fourth in a new directory is how
 * an exception list stops describing the tree.
 *
 * `reading` because the content genuinely is one short column of prose, and it starts at
 * the same left edge as every other page in the console — which is what `PageShell`'s
 * "both measures start at the same left edge" is for: the heading lines up with the band's
 * lockup above it instead of floating in the middle of an otherwise empty page.
 */
export default function StaffNotFound() {
  return (
    <PageShell width="reading" className="space-y-3">
      <div className="flex h-11 w-11 items-center justify-center rounded-full bg-muted text-muted-foreground">
        <SearchX className="h-5 w-5" aria-hidden="true" />
      </div>
      <h1 className="text-xl font-semibold">Page not found</h1>
      <p className="text-sm text-muted-foreground">
        There is nothing at this address.
      </p>
    </PageShell>
  )
}
