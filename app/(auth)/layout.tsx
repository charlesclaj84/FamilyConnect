import Image from 'next/image'
import Link from 'next/link'
import { AuthNavButtons } from '@/components/auth/AuthNavButtons'
import { ThemeToggle } from '@/components/layout/ThemeToggle'
import {
  APP_NAME, APP_LOGO_ALT, APP_BANNER_ALT,
  BRAND_MARK_SRC, BRAND_LOCKUP_DARK_SRC,
} from '@/lib/brand'

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen flex flex-col bg-background">
      <header className="border-b bg-brand-bar sticky top-0 z-10">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-2">
          <Link href="/" className="flex min-w-0 items-center gap-2.5">
            <Image src={BRAND_MARK_SRC} alt={APP_LOGO_ALT} width={40} height={40} className="h-9 w-9 shrink-0" priority />
            <span className="gn-wordmark truncate text-xl text-brand-ink">{APP_NAME}</span>
          </Link>
          <div className="flex shrink-0 items-center gap-1.5 sm:gap-2">
            <ThemeToggle />
            <AuthNavButtons />
          </div>
        </div>
      </header>

      {/* Banner hero — the gold lockup on Heritage, the same band the landing page
          uses, so signing in does not feel like a different product.

          The lockup steps up exactly as the landing hero does: it is a 3.27:1
          horizontal lockup, so a width that looks generous as a number still
          renders short, and at max-w-xl it sat small enough to read as a header
          ornament rather than the brand.

          The VERTICAL padding stays tighter than the landing page's on purpose.
          This band has a sign-in form under it, not a headline — matching the
          landing hero's py-16/py-20 as well would push the form off a laptop
          screen, and the point of this page is the form. */}
      <div className="w-full flex justify-center bg-brand-hero px-4 py-8 sm:py-10">
        <Image
          src={BRAND_LOCKUP_DARK_SRC}
          alt={APP_BANNER_ALT}
          width={1700}
          height={520}
          className="h-auto w-full max-w-xl sm:max-w-2xl lg:max-w-3xl"
          priority
        />
      </div>

      <main className="flex-1 flex items-center justify-center px-4 py-8">
        {children}
      </main>
    </div>
  )
}
