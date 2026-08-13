import Image from 'next/image'
import Link from 'next/link'
import { AuthNavButtons } from '@/components/auth/AuthNavButtons'
import { ThemeToggle } from '@/components/layout/ThemeToggle'
import {
  APP_NAME, APP_LOGO_ALT, APP_BANNER_ALT,
  BRAND_MARK_SRC, BRAND_LOCKUP_DARK_SRC, BRAND_LOCKUP_STACKED_DARK_SRC,
} from '@/lib/brand'

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen flex flex-col bg-background">
      {/* z-30 is the app-wide header level — see the stacking note in
          components/layout/TopBar.tsx. */}
      <header className="border-b bg-brand-bar sticky top-0 z-30">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-2">
          <Link href="/" className="flex min-w-0 items-center gap-2.5">
            <Image src={BRAND_MARK_SRC} alt={APP_LOGO_ALT} width={40} height={40} className="h-9 w-9 shrink-0" priority />
            {/* Hidden below sm, as on the landing page —
                the wordmark does not fit beside the toggle and the two auth buttons on
                a phone, and the lockup in the band below says it at full size. */}
            <span className="gn-wordmark hidden truncate text-xl text-brand-ink sm:block">{APP_NAME}</span>
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
      {/* ART DIRECTION, NOT RESIZING. Below sm the STACKED lockup (1.27:1) is used;
          from sm up, the horizontal one (3.27:1). The wide lockup on a 390px phone
          renders about 109px tall however much width it is given, which is why the band
          read as an ornament rather than a hero — no max-width change could have fixed
          it, because the aspect ratio was the constraint and not the size.

          A plain <picture> rather than two <Image>s: `hidden` does not stop a browser
          fetching an image, so the CSS approach ships both ~50KB lockups to every phone
          to show one. <source media> picks one before the fetch. next/image was buying
          nothing here anyway — these are SVGs, so there is no format conversion or
          resizing for it to do — and fetchPriority="high" preserves what `priority` was
          for, this being the LCP element. */}
      <div className="w-full flex justify-center bg-brand-hero px-4 py-8 sm:py-10">
        {/* `block` is load-bearing: <picture> is inline by default, so the <img>'s
            w-full would resolve against a shrink-wrapped box. */}
        <picture className="block w-full">
          <source media="(min-width: 640px)" srcSet={BRAND_LOCKUP_DARK_SRC} />
          <img
            src={BRAND_LOCKUP_STACKED_DARK_SRC}
            alt={APP_BANNER_ALT}
            width={1400}
            height={1100}
            fetchPriority="high"
            className="mx-auto h-auto w-full max-w-xs sm:max-w-2xl lg:max-w-3xl"
          />
        </picture>
      </div>

      <main className="flex-1 flex items-center justify-center px-4 py-8">
        {children}
      </main>
    </div>
  )
}
