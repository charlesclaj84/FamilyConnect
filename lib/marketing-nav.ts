/**
 * The public, crawlable surface — declared once.
 *
 * Four consumers have to agree about this list and, before it existed, three of them
 * were hand-written: the header nav, the footer nav, and `app/sitemap.ts`. A page added
 * to two of the three is a page that either cannot be reached or cannot be found, and
 * neither failure shows up in a build. `app/robots.ts` is the fourth and reads nothing
 * from here on purpose — it lists what to KEEP OUT, which is the complement of this and
 * not derivable from it.
 *
 * ORDER IS THE NAV ORDER, and it is a sales order rather than an alphabetical one:
 * what it does, how it works, why it beats the alternative, what it costs, who we are.
 * That is the sequence a person evaluating software actually asks in, so it is the
 * sequence the header offers.
 *
 * `priority` and `changeFrequency` are sitemap hints and live here for the same reason
 * the paths do — so that adding a page is one edit rather than three.
 *
 * ── THE CAPTION IS A FUNCTION OF `t`, AND THE HREF IS ITS KEY ───────────────────────
 * `label: 'Features'` was a field here until the public site learned Spanish and French. It is
 * `marketingNavLabel(t, href)` now, keyed on the href — the same shape `nav.item./community/chat`
 * takes in the shell catalogue, and for the same reason: **the href is the identity.** It is in
 * the sitemap, in every internal link and in anybody's bookmarks, so it is the one thing about a
 * route that must not move when the words do.
 *
 * The module stays PURE. `T` is a type-only import, so nothing about the catalogue reaches
 * `app/sitemap.ts` — which needs the paths and has no use for a caption in any language.
 */
import { type T } from '@/lib/i18n/t'

export interface MarketingRoute {
  href: string
  /** Sitemap priority. 1.0 is the landing page; nothing else outranks it. */
  priority: number
  changeFrequency: 'weekly' | 'monthly'
}

export const MARKETING_ROUTES: readonly MarketingRoute[] = [
  { href: '/features',     priority: 0.9, changeFrequency: 'monthly' },
  { href: '/how-it-works', priority: 0.8, changeFrequency: 'monthly' },
  { href: '/why-us',       priority: 0.8, changeFrequency: 'monthly' },
  { href: '/pricing',      priority: 0.9, changeFrequency: 'monthly' },
  { href: '/about',        priority: 0.6, changeFrequency: 'monthly' },
]

/**
 * The nav caption for one marketing route, in the reader's language.
 *
 * Short on purpose — this sits in a 16px nav on a phone, and the constraint survives
 * translation: German would not fit and neither would a four-word Spanish gloss, so the
 * catalogue entries are held to roughly the English length rather than to a literal reading.
 */
export function marketingNavLabel(t: T, href: string): string {
  return t(`mkt.nav.${href}`)
}

/**
 * The two account routes, kept OUT of the array above.
 *
 * They are in the sitemap (see `app/sitemap.ts`) but they are not marketing pages: the
 * header renders them as buttons on the right, not as nav links on the left, and the
 * footer groups them separately. Folding them in would put "Sign In" in the middle of
 * the product story.
 */
export const ACCOUNT_ROUTES = {
  login: '/login',
  register: '/register',
} as const
