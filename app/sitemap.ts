import type { MetadataRoute } from 'next'
import { SITE_URL } from '@/lib/site'
import { MARKETING_ROUTES } from '@/lib/marketing-nav'

/**
 * The crawlable surface of the site — which is a much smaller thing than the
 * list of routes.
 *
 * A sitemap is an invitation to index. Everything under `app/(protected)` is
 * behind `requireView` and redirects an anonymous caller to /login, so listing
 * any of it would only invite crawlers to fetch pages that answer with a
 * redirect. Those routes are excluded here AND disallowed in `app/robots.ts`;
 * the two files are the same decision written for two audiences, so they have
 * to be changed together.
 *
 * Two exclusions that are not merely pointless but actively wrong:
 *
 *   * `/invite/[token]` — every URL under it contains a credential. An indexed
 *     invitation is a published one: anyone who finds it in a search result can
 *     join that family. Note the token is NOT burned by a crawler — the page
 *     redeems on GET only for a signed-in visitor, and an anonymous fetch gets
 *     the read-only `peekInvitation` path — so the risk is disclosure, not
 *     consumption. Disclosure is enough.
 *   * `/update-password` — only reachable holding a live recovery token, and
 *     indexing it advertises a route whose whole purpose is to be arrived at
 *     from an email, never from a search result.
 *
 * `/forgot-password` is left out for a duller reason: nobody searches for it,
 * and it is one click from /login for anyone who needs it.
 */
export default function sitemap(): MetadataRoute.Sitemap {
  // A fixed date, not `new Date()`. This route is statically generated, so
  // `new Date()` would stamp build time — every deploy would tell crawlers the
  // content changed when only the build did, and a lastModified that always
  // moves is one crawlers learn to ignore. Bump this when the copy actually
  // changes.
  //
  // ── WHAT TO WATCH, BECAUSE THIS HAS ALREADY GONE STALE ONCE ────────────────
  // It read 2026-08-12 until 2026-08-21, by which point thirteen files behind
  // these URLs had changed and four of the five marketing pages had been
  // rewritten — Events was retired on 2026-08-19, taking the RSVP, hotel-block
  // and check-in copy off `/pricing`, `/features`, `/how-it-works` and
  // `/why-us`; the Standard tier was inserted the same day, making four plan
  // cards out of three and withdrawing the annual-discount sentence; and
  // `/features` began deriving its tier tags on 2026-08-20. So the stamp
  // understated a substantial rewrite by nine days.
  //
  // NOBODY HAS TO RUN THAT CHECK ANY MORE — `npm run sitemap:check`
  // (scripts/sitemap-freshness.mjs) is it, and it is a step in verify.yml. It
  // compares this literal against the newest commit touching anything the public
  // pages render and fails when the content is newer than the claim, so the stamp
  // can no longer rot silently. What it cannot tell is a copy change from a
  // refactor; that judgement is still the bumper's, and this comment is where the
  // answer gets written down.
  //
  // ── 2026-08-22 -> 2026-08-23 ──────────────────────────────────────────────
  // Reader-visible, and on the page that matters most: Standard and Plus went
  // from `available: false` to true on `/pricing`, so two of the four cards
  // stopped saying "Coming soon" behind a disabled button and started offering
  // to sell something. A Premium bullet was added with them (safety check-ins),
  // and `PlanLadder` grew the signup plan intent. `/about`, `/features`,
  // `/how-it-works`, `/why-us` and the landing page were touched the same day
  // by the Meta view-content tags, which a reader does NOT see — but the
  // pricing change alone earns the bump.
  //
  // ── 2026-08-23 -> 2026-08-27 ──────────────────────────────────────────────
  // Reader-visible on every public page, and in a way no refactor could be: the
  // whole site reads in three languages now, and `/es/…` and `/fr/…` are real
  // addresses with their own hreflang rather than a client-side swap. Prices are
  // formatted in the reader's own conventions, the plan cards and the four tier
  // taglines are keyed, and the founder's letter on /about is translated.
  //
  // WHAT IS DELIBERATELY NOT HERE YET: the localized URLs themselves. Every page
  // carries its own `alternates.languages` through `localizedAlternates`, which is
  // enough for a crawler to find and consolidate all three, so this file still
  // lists one URL per route. Emitting the other two (Next supports
  // `alternates.languages` on a sitemap entry) is the stronger signal and is owed —
  // TODO.md carries it.
  //
  // ONE DATE FOR EVERY URL, and it is a deliberate simplification rather than
  // an oversight: `/about` has not changed since before the old stamp, so this
  // overstates its freshness by a few days. `lastModified` is a hint crawlers
  // weigh, not a claim they audit, and six per-route dates in
  // `lib/marketing-nav.ts` would be six things to forget instead of one.
  const lastModified = new Date('2026-09-01')

  return [
    {
      url: SITE_URL,
      lastModified,
      changeFrequency: 'weekly',
      priority: 1,
    },
    // The marketing pages, from the same list the header and footer render, so a page
    // added to the nav cannot be missing from the sitemap — see lib/marketing-nav.ts.
    // Mapped rather than restated for exactly that reason.
    ...MARKETING_ROUTES.map(route => ({
      url: `${SITE_URL}${route.href}`,
      lastModified,
      changeFrequency: route.changeFrequency,
      priority: route.priority,
    })),
    {
      // The page an interested visitor is actually looking for.
      url: `${SITE_URL}/register`,
      lastModified,
      changeFrequency: 'monthly',
      priority: 0.8,
    },
    {
      url: `${SITE_URL}/login`,
      lastModified,
      changeFrequency: 'monthly',
      priority: 0.5,
    },
  ]
}
