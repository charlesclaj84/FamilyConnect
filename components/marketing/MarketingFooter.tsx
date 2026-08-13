import Link from 'next/link'
import { MARKETING_ROUTES, ACCOUNT_ROUTES } from '@/lib/marketing-nav'
import { SocialProfiles } from '@/components/marketing/SocialProfiles'
import { APP_NAME, APP_LEAD, APP_PUBLISHER } from '@/lib/brand'

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
 */
export function MarketingFooter() {
  return (
    <footer className="border-t bg-background px-4 py-12 sm:px-6">
      <div className="mx-auto max-w-6xl">
        <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-4">
          <div className="lg:col-span-2">
            <span className="gn-wordmark text-lg text-brand-ink">{APP_NAME}</span>
            <p className="mt-2 max-w-sm text-sm text-muted-foreground">
              {APP_LEAD} One private place for your whole family — the reunion, the
              treasury, the photographs and the family tree.
            </p>
            <div className="mt-6">
              <SocialProfiles />
            </div>
          </div>

          <nav aria-label="Product">
            <h2 className="text-xs font-semibold uppercase tracking-[0.14em] text-foreground">
              Product
            </h2>
            <ul className="mt-3 space-y-2 text-sm">
              {MARKETING_ROUTES.map(route => (
                <li key={route.href}>
                  <Link
                    href={route.href}
                    className="text-muted-foreground transition-colors hover:text-foreground"
                  >
                    {route.label}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>

          <nav aria-label="Account">
            <h2 className="text-xs font-semibold uppercase tracking-[0.14em] text-foreground">
              Account
            </h2>
            <ul className="mt-3 space-y-2 text-sm">
              <li>
                <Link
                  href={ACCOUNT_ROUTES.register}
                  className="text-muted-foreground transition-colors hover:text-foreground"
                >
                  Create your free account
                </Link>
              </li>
              <li>
                <Link
                  href={ACCOUNT_ROUTES.login}
                  className="text-muted-foreground transition-colors hover:text-foreground"
                >
                  Sign in
                </Link>
              </li>
            </ul>
          </nav>
        </div>

        <div className="mt-10 border-t pt-6 text-center text-xs text-muted-foreground">
          &copy; {new Date().getFullYear()} {APP_PUBLISHER}. All rights reserved. Your
          family&apos;s data is never shared or sold.
        </div>
      </div>
    </footer>
  )
}
