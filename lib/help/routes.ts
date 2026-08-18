import { isFeatureFuture } from '@/lib/features'
import { HELP_CHAPTERS } from './content'
import type { HelpRouteEntry } from './route-match'

/**
 * The reverse index: screen route → the chapter that documents it.
 *
 * ── IT IS DERIVED, SO THERE IS NO SECOND TABLE TO KEEP IN STEP ──────────────────────
 * Every entry comes from a chapter that already names its own `route`. A hand-written map
 * from route to slug would be a copy of that field, and a copy of a field is a thing that
 * goes stale the first time a chapter is renamed — silently, because a stale slug still
 * resolves to *a* page until it does not. `scripts/help-check.mjs` already asserts that
 * every chapter route is a real FEATURES href and that no two chapters claim the same one,
 * so this index cannot contain a route that goes nowhere or a route that drops a chapter.
 *
 * ── NEVER IMPORT THIS FROM A `'use client'` FILE ────────────────────────────────────
 * It pulls in `lib/help/content.ts`, which is the whole manual — every chapter, every
 * paragraph, ~79KB of prose. A client component that imports this ships all of it to the
 * browser on every page. The affordances take the index as a PROP from a server component
 * (`components/layout/TopBar.tsx`), and the matching rule they run on it lives in
 * `lib/help/route-match.ts`, which has no imports at all for exactly this reason.
 *
 * ── WHY `'future'` ROUTES ARE DROPPED ──────────────────────────────────────────────
 * A chapter about an unshipped screen is legal — `lib/help/availability.ts` exists to
 * label one Coming soon — and pointing a help icon at it would be pointing at a screen
 * nobody can open on any plan. Today no chapter names a future route, so the filter
 * removes nothing; it is here because the failure it prevents is invisible. Note that
 * `proxy.ts` intercepts those paths and lands the member on `/coming-soon`, so such an
 * entry could not match a pathname anyway — this does not rely on that, because a gate
 * moving should not quietly change what an icon points at.
 *
 * A chapter above the family's PLAN is deliberately kept. The screen exists, the family
 * could have it this afternoon, and the chapter says so at the top of itself — which is
 * strictly more useful than an icon that is not there.
 */
export const HELP_ROUTE_INDEX: readonly HelpRouteEntry[] = HELP_CHAPTERS
  .filter(chapter => chapter.route && !isFeatureFuture(chapter.route))
  .map(chapter => ({
    // Non-null asserted because the filter above is what establishes it, and narrowing a
    // field off a `readonly` object through a `.filter()` predicate is not something
    // TypeScript carries into `.map()`.
    route: chapter.route!,
    slug: chapter.slug,
    title: chapter.title,
  }))
