import type { MetadataRoute } from 'next'
import { SITE_URL } from '@/lib/site'

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
  const lastModified = new Date('2026-08-11')

  return [
    {
      url: SITE_URL,
      lastModified,
      changeFrequency: 'weekly',
      priority: 1,
    },
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
