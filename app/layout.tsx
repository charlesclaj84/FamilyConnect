import type { Metadata, Viewport } from 'next'
import { Inter, Cormorant_Garamond, Geist_Mono } from 'next/font/google'
import { Analytics } from '@vercel/analytics/next'
import { SpeedInsights } from '@vercel/speed-insights/next'
import { APP_NAME, APP_SEO_DESCRIPTION, APP_LEAD, BRAND_THEME_COLOR } from '@/lib/brand'
import { SITE_ORIGIN } from '@/lib/site'
import { THEME_BOOT_SCRIPT } from '@/lib/theme'
import './globals.css'

// The brand's two faces, per public/home/v1_0/README.txt: Cormorant Garamond for display,
// Inter for UI and body. Both are loaded as VARIABLE fonts — no `weight` option —
// which ships one file per family covering every weight the app uses, instead of
// one file per weight. Cormorant in particular needs 400 and 600 together.
const inter = Inter({
  variable: '--font-ui',
  subsets: ['latin'],
  display: 'swap',
})

const cormorant = Cormorant_Garamond({
  variable: '--font-display-serif',
  subsets: ['latin'],
  display: 'swap',
})

const geistMono = Geist_Mono({
  variable: '--font-geist-mono',
  subsets: ['latin'],
})

export const metadata: Metadata = {
  // `template` suffixes every child segment's title, so a page declares only its
  // own name: `title: 'Dashboard'` renders `Dashboard — GENORRA`. `default` is
  // required alongside a template, and covers routes that declare no title at all.
  // Note the template does NOT apply to this segment — hence `default` carrying
  // the bare name for `/`.
  title: {
    default: APP_NAME,
    template: `%s — ${APP_NAME}`,
  },
  // APP_SEO_DESCRIPTION, not APP_DESCRIPTION. A meta description is snippet copy
  // written to a ~155-character budget and to the words people actually search
  // for; the brand sentence is 170 and was being truncated mid-clause. The reason
  // they are two constants is spelled out beside them in lib/brand.ts.
  description: APP_SEO_DESCRIPTION,

  // ── What a result is allowed to show ────────────────────────────────────────
  // The defaults are conservative in exactly the two ways that cost this site
  // something, and both are opt-in:
  //
  //   * `max-image-preview: large` is what permits the full-width image thumbnail
  //     beside a result and in Discover. Without it Google may show a small square
  //     or none at all, and the opengraph artwork does nothing.
  //   * `max-snippet: -1` lifts the cap on snippet length, so Google can quote as
  //     much of the page as it judges useful rather than a truncated default.
  //
  // Both are permissions, not instructions — Google still decides. Declaring them
  // costs nothing and withholding them can only ever show less.
  //
  // This is inherited by every route, including the signed-in app. That is fine
  // and deliberate: `robots` is REPLACED wholesale by any segment that redeclares
  // it, and `app/(protected)/layout.tsx` does exactly that with `index: false`.
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      'max-image-preview': 'large',
      'max-snippet': -1,
      'max-video-preview': -1,
    },
  },

  // Every relative URL in this object — and the generated og:image — is resolved
  // against this. Open Graph has no notion of a relative path: a scraper that
  // receives one drops the tag and shows a bare link instead of a card. Without
  // metadataBase Next warns at build and falls back to localhost, which is the
  // version of this bug that looks fine locally and ships broken.
  metadataBase: SITE_ORIGIN,

  // The link preview. og:image itself is NOT listed here — `app/opengraph-image.tsx`
  // is a file convention that emits it along with its width, height and alt;
  // repeating it in this object would produce two og:image tags.
  openGraph: {
    type: 'website',
    siteName: APP_NAME,
    // Deliberately not the bare product name. A card titled "GENORRA" over a
    // logo that also says GENORRA says one thing twice and answers nothing —
    // the lead line is what tells someone what they have been sent.
    title: `${APP_NAME} — ${APP_LEAD}`,
    description: APP_SEO_DESCRIPTION,
    url: '/',
    locale: 'en_US',
  },

  twitter: {
    // Without this the card renders as a small square thumbnail beside the text
    // rather than the full-width image, which is the whole point of the artwork.
    card: 'summary_large_image',
    title: `${APP_NAME} — ${APP_LEAD}`,
    description: APP_SEO_DESCRIPTION,
  },

  // Icons are NOT declared here. `app/favicon.ico`, `app/icon.svg` and
  // `app/apple-icon.png` are file conventions Next discovers on its own and
  // emits the <link> tags for; listing them again here would produce duplicates.
}

export const viewport: Viewport = {
  // Paints the browser chrome (mobile address bar, PWA title bar) in Heritage
  // burgundy so the frame around the app belongs to the brand too. Split by
  // scheme: the light value is the burgundy bar, the dark value is the ground.
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: BRAND_THEME_COLOR.light },
    { media: '(prefers-color-scheme: dark)', color: BRAND_THEME_COLOR.dark },
  ],
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    // suppressHydrationWarning is required and narrow: the boot script below
    // mutates this element's className and style before React hydrates, so the
    // server's markup and the DOM genuinely differ here by design. It applies to
    // this element's own attributes only — it does not silence the tree beneath.
    <html
      lang="en"
      suppressHydrationWarning
      className={`${inter.variable} ${cormorant.variable} ${geistMono.variable} h-full antialiased`}
    >
      <head>
        {/* Must stay in <head> and stay inline. Moved to the body, or loaded as
            an external file, it would run after the first paint and reintroduce
            the white flash it exists to prevent. */}
        <script dangerouslySetInnerHTML={{ __html: THEME_BOOT_SCRIPT }} />
      </head>
      <body className="min-h-full flex flex-col bg-background text-foreground">
        {children}
        {/* Vercel Web Analytics and Speed Insights. Both render null and inject
            their scripts client-side, so they cost no markup and are safe to sit
            inside the flex column. Both live in the root layout so every route is
            covered; each no-ops off Vercel. */}
        <Analytics />
        <SpeedInsights />
      </body>
    </html>
  )
}
