import {
  APP_NAME, APP_LEAD, APP_SEO_DESCRIPTION, APP_PUBLISHER,
  APP_VALUES, BRAND_APP_ICON_SRC, BRAND_SOCIAL_PROFILES,
} from '@/lib/brand'
import { SITE_URL } from '@/lib/site'
import { TIER_PRICE, TIER_IS_SOLD } from '@/lib/plans'
import { TIERS, TIER_LABEL, type FamilyTier } from '@/lib/tiers'

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
    // ONE OFFER HERE, DELIBERATELY, and it is the free one.
    //
    // The paid figures are real since 2026-08-17, and they belong on `/pricing`'s graph
    // rather than on this node — because THE LANDING PAGE SHOWS NO PRICES. This file's
    // one rule is that markup must not claim anything the page does not show, and a
    // landing page advertising $10 and $25 in JSON-LD while displaying neither is exactly
    // the mismatch that gets rich results removed wholesale.
    //
    // It still comes from `tierOffer('free')` rather than being typed out, so the free
    // claim on this page and the free column on `/pricing` cannot drift apart.
    offers: tierOffer('free'),
  }
}

/**
 * One tier as an `Offer`, derived from `TIER_PRICE` and `TIER_IS_SOLD` in `lib/plans.ts`.
 *
 * ── WHY `priceSpecification` AND NOT `price` FOR THE PAID TIERS ──────────────
 * This said "because each has TWO rates — month to month, or the year paid in advance" and
 * emitted an array of two `UnitPriceSpecification`s. There is ONE rate since 2026-08-19: the
 * annual price and its discount were both withdrawn, so the second entry is gone.
 *
 * The specification is KEPT for the one rate rather than collapsed to a bare `price`, and the
 * reason is `billingDuration`. A `price: '15.00'` on a subscription says fifteen dollars and
 * says nothing about per what — a consumer is free to render it as the cost of the product,
 * which for a monthly plan is the one number it is not. `unitCode: 'MON'` with a duration of 1
 * says what is true and is what a rich result needs to quote us correctly.
 *
 * ── `availability` IS THE HONEST HALF ───────────────────────────────────────
 * Prices are announced and no paid tier can be bought — `TIER_IS_SOLD` is false for all three,
 * there is no billing, and `/pricing` says Coming soon on every paid card with a disabled
 * button. `PreOrder` is the vocabulary for exactly that. Marking them `InStock` because a
 * figure exists would be a claim the page contradicts on the same screen.
 *
 * Free is `InStock` because it genuinely is, and `price: '0'` rather than a specification:
 * there is nothing to bill and no cycle to state.
 */
function tierOffer(tier: FamilyTier) {
  const price = TIER_PRICE[tier]
  const availability = TIER_IS_SOLD[tier]
    ? 'https://schema.org/InStock'
    : 'https://schema.org/PreOrder'

  if (!price) {
    return {
      '@type': 'Offer',
      name: TIER_LABEL[tier],
      price: '0',
      priceCurrency: 'USD',
      availability,
      // Mirrors the closing call to action. If the product ever stops having a
      // free account, this comes out in the same commit as that button.
      description: 'Free account',
    }
  }

  return {
    '@type': 'Offer',
    name: TIER_LABEL[tier],
    priceCurrency: 'USD',
    availability,
    priceSpecification: [
      {
        '@type': 'UnitPriceSpecification',
        price: (price.monthlyCents / 100).toFixed(2),
        priceCurrency: 'USD',
        billingDuration: 1,
        billingIncrement: 1,
        unitCode: 'MON',
      },
    ],
  }
}

/**
 * The `WebApplication` node as `/pricing` may state it: the same `@id` as the landing
 * page's, so the two are ONE entity rather than two products with one name, carrying every
 * tier's offer because that page shows every tier. `TIERS.map` rather than a list, so a plan
 * inserted in the middle is emitted without an edit here — which is what happened when Standard
 * arrived, and nothing in this file changed.
 *
 * Everything except `offers` is spread from `webApplication()` rather than restated, which
 * is the point — the feature list, the description and the publisher pointer have exactly
 * one definition, and this node differs from the landing page's in the one field the two
 * pages genuinely differ about.
 */
function pricedApplication() {
  return { ...webApplication(), offers: TIERS.map(tierOffer) }
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
 * DELIBERATELY WITHOUT `webApplication()` BY DEFAULT. That node carries the feature list
 * and an `Offer`, both traceable to specific things the LANDING page shows. Repeating it on
 * five more pages would be five more places for the claim to drift out of step with the page
 * under it — see this file's header.
 *
 * `/pricing` is the one exception, and `plans: true` is how it says so — the ONE page that
 * displays all three tiers and both rates for each, which is precisely what makes it the one
 * page entitled to state them in markup. It emits the node under the SAME `@id` as the
 * landing page's, so the two are one entity differing in one field.
 *
 * `faq` is optional and, when present, MUST be questions genuinely answered in the visible
 * copy of that page. An FAQPage node whose answers are not on the page is the exact
 * mismatch that gets rich results removed wholesale rather than ignored. That applies to the
 * price the FAQ quotes as much as to anything else: both come from `TIER_PRICE`, so the
 * answer, the card and the markup are three renderings of one number.
 */
export function marketingPageGraph(opts: {
  path: string
  name: string
  description: string
  faq?: readonly { question: string; answer: string }[]
  /** `/pricing` only — see above. Emits the application node with all three tier offers. */
  plans?: boolean
}) {
  const url = `${SITE_URL}${opts.path}`
  const nodes: object[] = [organization(), website(), webPage(opts)]

  if (opts.plans) nodes.push(pricedApplication())

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
