import type { MetadataRoute } from 'next'
import { SITE_URL } from '@/lib/site'

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
 * `/transactions`, `/direct-lineage`, `/personal-info` and the rest hands over
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
