import {
  APP_NAME, APP_LEAD, APP_SEO_DESCRIPTION, APP_PUBLISHER,
  APP_VALUES, BRAND_APP_ICON_SRC, BRAND_SOCIAL_PROFILES,
} from '@/lib/brand'
import { SITE_URL } from '@/lib/site'

/**
 * Schema.org structured data — what the pages say about themselves to a machine.
 *
 * `<meta>` tags describe a DOCUMENT: this page has this title, this picture. They
 * cannot say that GENORRA is a thing, that ClearPath Digital publishes it, or that
 * the two are related. Structured data is the only channel that carries that, and
 * it is what a search engine uses to decide whether a brand is an entity it knows
 * or three unconnected pages that happen to share a word.
 *
 * Two visible consequences, which is the whole reason this file exists:
 *
 *  * **`WebSite.name` is what Google prints as the site name** above the result —
 *    the line that otherwise reads `genorra.com`. It reads the `WebSite` node for
 *    it and nothing else.
 *  * **`Organization.logo` is the image beside a brand result** and the seed of a
 *    knowledge panel.
 *
 * ── The rule this file is written to ─────────────────────────────────────────
 * STRUCTURED DATA MUST NOT CLAIM ANYTHING THE PAGE DOES NOT SHOW. This is not a
 * style preference: mismatched markup is what Google issues manual actions for,
 * and a manual action removes a site from rich results wholesale rather than
 * ignoring the one bad field. So every value below is traceable to something a
 * visitor can read:
 *
 *  * the feature list is the landing page's own value cards,
 *  * the free offer is its closing "Create your free account" button,
 *  * `sameAs` is omitted entirely rather than guessed at, and
 *  * there is NO `aggregateRating`. A rating is the field that makes a software
 *    result look like a rich one, and it is therefore the field most often
 *    invented. There are no reviews, so there is no rating; when there are real
 *    ones, they belong here and on the page, in that order.
 *
 * ── Why `@id` on every node ──────────────────────────────────────────────────
 * The three nodes are one graph, not three opinions. `@id` gives each a stable
 * name so `WebSite.publisher` and `WebApplication.publisher` can POINT at the
 * organisation rather than restating it. Restated, the copies drift, and a
 * consumer reading two different descriptions of the same `Organization` has no
 * way to tell which is current — so it may trust neither.
 *
 * Fragment ids (`#organization`) are conventional here and deliberately not real
 * URLs: they identify a node in this graph, and nothing should try to fetch one.
 */

/** Stable node names, so the graph can reference itself instead of repeating itself. */
const ORGANIZATION_ID = `${SITE_URL}/#organization`
const WEBSITE_ID = `${SITE_URL}/#website`

/**
 * The brand as an entity.
 *
 * GENORRA is the `Organization` and ClearPath Digital is its `parentOrganization`,
 * which is the honest shape: the site, the product and the name people would search
 * for are all GENORRA, while the company in the copyright line is the publisher.
 * Modelling it the other way round — ClearPath Digital as the organisation — would
 * attach the logo and any future knowledge panel to a name that appears nowhere on
 * the site except one line of small print.
 */
function organization() {
  return {
    '@type': 'Organization',
    '@id': ORGANIZATION_ID,
    name: APP_NAME,
    url: `${SITE_URL}/`,
    // Absolute, because a consumer of this JSON has no base URL to resolve against
    // — unlike the metadata object, which Next resolves through `metadataBase`.
    logo: {
      '@type': 'ImageObject',
      url: `${SITE_URL}${BRAND_APP_ICON_SRC}`,
      width: 512,
      height: 512,
    },
    description: APP_SEO_DESCRIPTION,
    parentOrganization: { '@type': 'Organization', name: APP_PUBLISHER },
    // Omitted while empty rather than emitted as []. An empty array is a positive
    // claim that the brand has no profiles anywhere; absence says nothing, which
    // is the truth. See BRAND_SOCIAL_PROFILES.
    ...(BRAND_SOCIAL_PROFILES.length > 0 ? { sameAs: [...BRAND_SOCIAL_PROFILES] } : {}),
  }
}

/**
 * The site itself.
 *
 * Carries no `SearchAction`. The sitelinks search box that field existed to
 * request was retired by Google in 2023, and it would be a lie besides: there is
 * no public search on this site, because everything searchable is behind a login.
 */
function website() {
  return {
    '@type': 'WebSite',
    '@id': WEBSITE_ID,
    name: APP_NAME,
    alternateName: `${APP_NAME} — ${APP_LEAD}`,
    url: `${SITE_URL}/`,
    description: APP_SEO_DESCRIPTION,
    publisher: { '@id': ORGANIZATION_ID },
    inLanguage: 'en-US',
  }
}

/**
 * The product.
 *
 * `WebApplication` rather than `SoftwareApplication`: it is the narrower type and
 * it is accurate — there is nothing to install, which is what `browserRequirements`
 * then says out loud.
 *
 * `applicationCategory` is a controlled-ish vocabulary and 'BusinessApplication' is
 * the closest honest fit for a portal that runs an organisation's dues, elections
 * and events. 'LifestyleApplication' would read as more natural for "family" and is
 * the wrong shelf.
 */
function webApplication() {
  return {
    '@type': 'WebApplication',
    '@id': `${SITE_URL}/#app`,
    name: APP_NAME,
    url: `${SITE_URL}/`,
    applicationCategory: 'BusinessApplication',
    operatingSystem: 'Any',
    browserRequirements: 'Requires a modern web browser with JavaScript enabled.',
    description: APP_SEO_DESCRIPTION,
    publisher: { '@id': ORGANIZATION_ID },
    isPartOf: { '@id': WEBSITE_ID },
    // The landing page's own three value cards, in their own words. Keyed off
    // APP_VALUES so a fourth value cannot appear on the page and be missing here.
    featureList: [
      ...APP_VALUES,
      'Family reunion and event planning',
      'Membership dues and fund accounting',
      'Multi-generation family tree',
      'Officer elections',
      'Private family chat',
      'Photo collections',
      'Shared documents',
    ],
    offers: {
      '@type': 'Offer',
      price: '0',
      priceCurrency: 'USD',
      // Mirrors the closing call to action. If the product ever stops having a
      // free account, this comes out in the same commit as that button.
      description: 'Free account',
    },
  }
}

/**
 * The landing page's graph, as one `@graph` rather than three sibling scripts.
 *
 * One script means one parse and one place for the nodes to reference each other
 * by `@id`; three separate `<script>` blocks are valid too, but then a consumer
 * that reads only the first sees an organisation with no site attached.
 */
export function landingPageGraph() {
  return {
    '@context': 'https://schema.org',
    '@graph': [organization(), website(), webApplication()],
  }
}

/**
 * The graph for a page that is a DOOR rather than a description: `/login`, `/register`.
 *
 * WHY THESE GET ONE AT ALL. They are in the sitemap — `/register` is the conversion page
 * and deliberately the highest-priority URL after the landing page — so they are pages a
 * search engine will show. Without a graph they are two anonymous documents that happen
 * to share a word with the brand: nothing connects them to the `Organization`, and
 * nothing tells Google the site name to print above the result instead of `genorra.com`.
 * Attaching them to the SAME `@id`s the landing page uses is what makes three pages one
 * entity rather than three.
 *
 * WHY IT IS NOT THE LANDING PAGE'S GRAPH. `webApplication()` carries the feature list and
 * the free `Offer`, and both are traceable to things the LANDING page shows — its value
 * cards and its closing button. A sign-in form shows neither. Repeating them here would
 * break the one rule this file is written to (see the header): structured data must not
 * claim anything the page does not show. So an auth page gets the identity nodes, which
 * are true everywhere, plus a `WebPage` describing itself — and nothing else.
 *
 * `isPartOf` points at the website node rather than restating it, for the same reason the
 * other nodes reference `@id`s: two descriptions of one site can drift, and a consumer
 * reading both has no way to choose.
 */
/** The `WebPage` node shared by every secondary page. Not exported: reach it through one
 *  of the two wrappers below, so no caller can forget `isPartOf`. */
function webPage(opts: { path: string; name: string; description: string }) {
  const url = `${SITE_URL}${opts.path}`
  return {
    '@type': 'WebPage',
    '@id': `${url}#webpage`,
    url,
    name: opts.name,
    description: opts.description,
    isPartOf: { '@id': WEBSITE_ID },
    publisher: { '@id': ORGANIZATION_ID },
    inLanguage: 'en-US',
  }
}

/**
 * A marketing page's graph: the brand's identity nodes plus this page.
 *
 * SAME `@id`s AS THE LANDING PAGE, which is the entire point. Six pages each declaring
 * their own unrelated `Organization` is six organisations that happen to share a name;
 * pointing at one node makes them one entity, and it is the `WebSite` node Google reads
 * to decide what to print above a result instead of `genorra.com`.
 *
 * DELIBERATELY WITHOUT `webApplication()`. That node carries the feature list and the free
 * `Offer`, both traceable to specific things the LANDING page shows. Repeating it on five
 * more pages would be five more places for the claim to drift out of step with the page
 * under it — see this file's header. `/pricing` is the one exception and says so itself.
 *
 * `faq` is optional and, when present, MUST be questions genuinely answered in the visible
 * copy of that page. An FAQPage node whose answers are not on the page is the exact
 * mismatch that gets rich results removed wholesale rather than ignored.
 */
export function marketingPageGraph(opts: {
  path: string
  name: string
  description: string
  faq?: readonly { question: string; answer: string }[]
}) {
  const url = `${SITE_URL}${opts.path}`
  const nodes: object[] = [organization(), website(), webPage(opts)]

  if (opts.faq?.length) {
    nodes.push({
      '@type': 'FAQPage',
      '@id': `${url}#faq`,
      isPartOf: { '@id': `${url}#webpage` },
      mainEntity: opts.faq.map(entry => ({
        '@type': 'Question',
        name: entry.question,
        acceptedAnswer: { '@type': 'Answer', text: entry.answer },
      })),
    })
  }

  return { '@context': 'https://schema.org', '@graph': nodes }
}

export function authPageGraph(opts: {
  /** Absolute-from-root, with no query string — `/login`, `/register`. */
  path: string
  /** The page's own name. Match the visible `h1`, not the `<title>`. */
  name: string
  /** One sentence. Match the meta description. */
  description: string
}) {
  const url = `${SITE_URL}${opts.path}`
  return {
    '@context': 'https://schema.org',
    '@graph': [
      organization(),
      website(),
      {
        '@type': 'WebPage',
        '@id': `${url}#webpage`,
        url,
        name: opts.name,
        description: opts.description,
        isPartOf: { '@id': WEBSITE_ID },
        publisher: { '@id': ORGANIZATION_ID },
        inLanguage: 'en-US',
      },
    ],
  }
}
