import { MarketingHeader } from '@/components/marketing/MarketingHeader'
import { MarketingFooter } from '@/components/marketing/MarketingFooter'

/**
 * Chrome for the public pages.
 *
 * A ROUTE GROUP, so the parentheses do not appear in any URL — `/features`, `/pricing`
 * and the rest stay exactly where the sitemap says they are. The group exists only to
 * hang this layout on five pages at once.
 *
 * `app/page.tsx` is deliberately NOT in here. A route group cannot own `/` without
 * becoming the root layout's sibling, and the landing page has its own hero-length header
 * treatment and a footer that carries the brand lockup. It imports the same two
 * components, so the nav and the footer links stay in step through
 * `lib/marketing-nav.ts` rather than through file structure.
 *
 * No `metadata` here on purpose. `title.template` in the root layout appends the product
 * name, and each page below declares its own title, description and canonical — a
 * canonical in a shared layout is inherited, which would tell Google that five pages are
 * duplicates of one. That is the one metadata mistake worse than having none, and
 * `app/page.tsx` carries a comment saying so.
 */
export default function MarketingLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col">
      <MarketingHeader />
      {/* `flex-1` so a short page still pins the footer to the bottom of the viewport
          rather than leaving it floating mid-screen on a tall monitor. */}
      <main className="flex-1">{children}</main>
      <MarketingFooter />
    </div>
  )
}
