import Link from 'next/link'
import { MARKETING_ROUTES, ACCOUNT_ROUTES, marketingNavLabel } from '@/lib/marketing-nav'
import { SocialProfiles } from '@/components/marketing/SocialProfiles'
import { localizedHref } from '@/lib/i18n/route-locale'
import { marketingI18n } from '@/lib/marketing/locale'
import { APP_NAME, APP_PUBLISHER } from '@/lib/brand'

/**
 * The public footer, extracted from `app/page.tsx` alongside the header.
 *
 * A server component, unlike the header: there is nothing interactive here, so there is
 * no reason to ship it. That asymmetry is deliberate rather than accidental — the header
 * pays for a disclosure menu and the footer should not pay for anything.
 *
 * THREE COLUMNS, NOT ONE ROW. The single row this replaced held two links; six do not
 * fit on a phone, and a footer is also the one place a crawler reliably follows every
 * internal link on a site, so grouping them by what they answer is worth more than
 * compactness. The year is computed at render — this is a static page, so it is stamped
 * at build, which is correct for a copyright line and wrong for a `lastModified` (see
 * the note in `app/sitemap.ts`).
 *
 * The social profiles sit UNDER THE BLURB, inside the brand cell, rather than as a
 * fourth column. Three glyphs do not fill a column, and the grid is `lg:grid-cols-4`
 * with the brand spanning two of them — a fifth child would wrap to a second row on
 * its own. They belong with the brand anyway: they are the same voice as the wordmark
 * and the lead line, not a third list of destinations.
 *
 * ── IT RESOLVES THE LANGUAGE ITSELF RATHER THAN TAKING A PROP ───────────────────────
 * `marketingI18n()` is request-cached, so the layout above and this both asking is one header
 * read. Taking a `t` prop instead would work and is worse in one specific way: this component
 * is rendered by the marketing layout AND by `app/page.tsx`, which is not in that route group —
 * so a prop would be a thing two callers have to remember, and forgetting it in one of them is
 * an English footer under a Spanish page.
 *
 * The blurb is one string rather than `APP_LEAD` plus a sentence. `APP_LEAD` is the brand's
 * tagline and `lib/brand.ts` is the one place the product's name and voice live — but a lead
 * line joined to a hand-written clause is a sentence in two halves, and a translator needs the
 * whole of it to get the join right. So the catalogue holds the finished sentence and the
 * English entry begins with the same words `APP_LEAD` does.
 */
export async function MarketingFooter() {
  const { t, locale } = await marketingI18n()

  return (
    <footer className="border-t bg-background px-4 py-12 sm:px-6">
      <div className="mx-auto max-w-6xl">
        <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-4">
          <div className="lg:col-span-2">
            <span className="gn-wordmark text-lg text-brand-ink">{APP_NAME}</span>
            <p className="mt-2 max-w-sm text-sm text-muted-foreground">
              {t('mkt.footer.blurb')}
            </p>
            <div className="mt-6">
              <SocialProfiles />
            </div>
          </div>

          <nav aria-label={t('mkt.footer.product')}>
            <h2 className="text-xs font-semibold uppercase tracking-[0.14em] text-foreground">
              {t('mkt.footer.product')}
            </h2>
            <ul className="mt-3 space-y-2 text-sm">
              {MARKETING_ROUTES.map(route => (
                <li key={route.href}>
                  <Link
                    href={localizedHref(route.href, locale)}
                    className="text-muted-foreground transition-colors hover:text-foreground"
                  >
                    {marketingNavLabel(t, route.href)}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>

          <nav aria-label={t('mkt.footer.account')}>
            <h2 className="text-xs font-semibold uppercase tracking-[0.14em] text-foreground">
              {t('mkt.footer.account')}
            </h2>
            <ul className="mt-3 space-y-2 text-sm">
              <li>
                <Link
                  href={localizedHref(ACCOUNT_ROUTES.register, locale)}
                  className="text-muted-foreground transition-colors hover:text-foreground"
                >
                  {t('mkt.footer.createAccount')}
                </Link>
              </li>
              <li>
                <Link
                  href={localizedHref(ACCOUNT_ROUTES.login, locale)}
                  className="text-muted-foreground transition-colors hover:text-foreground"
                >
                  {t('mkt.signIn')}
                </Link>
              </li>
            </ul>
          </nav>
        </div>

        <div className="mt-10 border-t pt-6 text-center text-xs text-muted-foreground">
          &copy; {new Date().getFullYear()} {APP_PUBLISHER}. {t('mkt.footer.rights')}
        </div>
      </div>
    </footer>
  )
}
