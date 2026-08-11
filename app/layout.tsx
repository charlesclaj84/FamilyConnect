import type { Metadata, Viewport } from 'next'
import { Inter, Cormorant_Garamond, Geist_Mono } from 'next/font/google'
import { Analytics } from '@vercel/analytics/next'
import { SpeedInsights } from '@vercel/speed-insights/next'
import { APP_NAME, APP_DESCRIPTION, BRAND_THEME_COLOR } from '@/lib/brand'
import { THEME_BOOT_SCRIPT } from '@/lib/theme'
import './globals.css'

// The brand's two faces, per public/README.txt: Cormorant Garamond for display,
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
  description: APP_DESCRIPTION,
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
