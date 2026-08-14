import type { MetadataRoute } from 'next'
import { IS_INDEXABLE_DEPLOYMENT, SITE_URL } from '@/lib/site'

/**
 * The companion to `app/sitemap.ts` — the same decision about what is public,
 * told to crawlers rather than offered to them. Change one and change the other.
 *
 * ── Why the signed-in pages are NOT listed here ──────────────────────────────
 * The obvious move is to `Disallow` every authenticated route. This file did
 * exactly that in its first version, listing eighteen of them, and it was
 * wrong on both halves of the trade.
 *
 * It buys nothing:
 *
 *   * **Disallow does not prevent indexing.** It prevents *crawling*. A URL that
 *     is disallowed can still be indexed — URL-only, no snippet — if anything
 *     out there links to it, and Google documents this explicitly. The tool for
 *     "keep it out of search" is `noindex`, which requires the page to be
 *     crawlable to be read. So a disallow-only rule aims at the wrong mechanism.
 *   * **The goal is already met.** Every one of those routes calls `requireView`
 *     and redirects an anonymous caller to /login (AGENTS.md §1). A crawler gets
 *     a 307 to a page already in the sitemap and indexes nothing.
 *   * **Crawl budget is not a real constraint here.** It starts to matter in the
 *     hundreds of thousands of URLs. The public surface is three pages.
 *
 * And it costs something: `/robots.txt` is world-readable and is the first
 * thing anyone probing a site fetches. Listing `/family-finances`,
 * `/transactions`, `/family-tree`, `/personal-info` and the rest hands over
 * a complete feature inventory of the product for free. That is not a
 * vulnerability — the auth in front of them is what protects them, and hiding
 * route names is not security — but it is a disclosure with no benefit on the
 * other side of the ledger, which makes it a bad trade rather than a neutral one.
 *
 * What remains below is the set where `Disallow` is aimed at the right thing:
 * routes whose URL is itself sensitive, where the goal is genuinely "do not
 * fetch this and do not surface it", and whose names disclose nothing.
 */
export default function robots(): MetadataRoute.Robots {
  // ── Previews are not the site ────────────────────────────────────────────────
  // A preview deployment is a byte-identical copy of the marketing pages on a
  // different public hostname, and it used to publish `Allow: /` plus a sitemap
  // exactly like production. That is a duplicate of the whole public surface
  // offered to crawlers on every push, and the one Google keeps is not
  // necessarily the one anybody deployed on purpose.
  //
  // No sitemap and no `host` on this branch either: both are invitations, and
  // there is nothing here worth pointing at.
  if (!IS_INDEXABLE_DEPLOYMENT) {
    return { rules: { userAgent: '*', disallow: '/' } }
  }

  return {
    rules: {
      userAgent: '*',
      allow: '/',
      disallow: [
        // Credential-bearing. An indexed invitation is a published one — anyone
        // who finds it can join that family. The token is not consumed by an
        // anonymous crawl (see sitemap.ts), so this guards disclosure, not
        // consumption. Worth noting the limit: link scanners in email and
        // messaging clients frequently ignore robots.txt, so this is the cheap
        // outer layer and expiry plus single-use redemption is the real one.
        '/invite/',
        '/update-password',

        // Auth callback. Carries one-time codes and renders nothing.
        '/auth/',
      ],
    },
    sitemap: `${SITE_URL}/sitemap.xml`,
    host: SITE_URL,
  }
}
