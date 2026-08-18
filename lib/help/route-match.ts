/**
 * Which chapter of the manual documents the screen at a given pathname.
 *
 * ── THIS FILE HAS NO IMPORTS, AND THAT IS THE WHOLE REASON IT EXISTS ────────────────
 * `components/help/ContextHelpLink.tsx` is a `'use client'` component: everything it
 * imports is bundled for the browser, transitively. `lib/help/content.ts` is the manual
 * itself — every chapter, every section, every paragraph — and shipping it to resolve one
 * icon's href would put the entire prose of the product's documentation into the bundle of
 * every page a member opens. So the matching RULE lives here, with nothing behind it, and
 * the DATA arrives as a prop from the server (`lib/help/routes.ts`).
 *
 * ── IT IS A DELIBERATE COPY OF `covers()` AND `getFeature()`, NOT AN IMPORT ─────────
 * `lib/features.ts` already answers exactly this shape of question — equality or a path
 * prefix, longest match wins — and the honest thing to say is that this is that function
 * with a different payload. It is copied rather than shared because importing it would
 * drag `@/lib/brand` and `@/lib/tiers` in behind it and, more to the point, because
 * `FEATURES` is a different table with a different reason to change: a chapter route and a
 * feature href happen to look alike and are not the same fact. `scripts/help-check.mjs`
 * asserts that every chapter route IS a FEATURES href, which is where the two are tied
 * together — one assertion rather than one shared function that has to serve both.
 *
 * If the prefix rule in `lib/features.ts` ever changes, this changes with it. The two
 * belong to the same convention (a route covers everything nested beneath it) and a reader
 * of one should be told the other exists — hence this paragraph.
 */

/** One chapter that documents one screen, flattened for the client. */
export interface HelpRouteEntry {
  /** The screen's route, exactly as `HelpChapter.route` states it. */
  route: string
  /** The chapter's slug — `/help/<slug>` is where the affordance points. */
  slug: string
  /** The chapter's title, so the accessible name can NAME it rather than say "Help". */
  title: string
}

/** True when `pathname` is `route` itself or nested beneath it. */
function covers(pathname: string, route: string): boolean {
  return pathname === route || pathname.startsWith(route + '/')
}

/**
 * The entry documenting `pathname`, preferring the most specific route.
 *
 * LONGEST MATCH WINS, for the same reason `getFeature()` does it: `/admin/events/abc`
 * is covered by both `/admin/events` and — were there ever a chapter on it — `/admin`,
 * and the reader wants the chapter about the screen they are on rather than the one about
 * the section it sits in. A detail page (`/events/<id>`) has no chapter of its own and
 * correctly resolves to its list's.
 *
 * `null` rather than a fallback, deliberately. There is no "general help" chapter to
 * point at, and an affordance that lands somewhere unhelpful is worse than one that is
 * not drawn — see the header on `ContextHelpLink`.
 */
export function matchHelpRoute(
  pathname: string,
  entries: readonly HelpRouteEntry[],
): HelpRouteEntry | null {
  let match: HelpRouteEntry | null = null
  for (const entry of entries) {
    if (covers(pathname, entry.route) && (!match || entry.route.length > match.route.length)) {
      match = entry
    }
  }
  return match
}
