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
 */

export interface MarketingRoute {
  href: string
  /** Header and footer label. Short: this sits in a 16px nav on a phone. */
  label: string
  /** Sitemap priority. 1.0 is the landing page; nothing else outranks it. */
  priority: number
  changeFrequency: 'weekly' | 'monthly'
}

export const MARKETING_ROUTES: readonly MarketingRoute[] = [
  { href: '/features',     label: 'Features',     priority: 0.9, changeFrequency: 'monthly' },
  { href: '/how-it-works', label: 'How It Works', priority: 0.8, changeFrequency: 'monthly' },
  { href: '/why-us',       label: 'Why Us',       priority: 0.8, changeFrequency: 'monthly' },
  { href: '/pricing',      label: 'Pricing',      priority: 0.9, changeFrequency: 'monthly' },
  { href: '/about',        label: 'About',        priority: 0.6, changeFrequency: 'monthly' },
]

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
