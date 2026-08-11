/**
 * Where this deployment lives.
 *
 * Deliberately NOT in `lib/brand.ts`. That file is the product's identity —
 * name, tagline, copy — and AGENTS.md is explicit that deployment hostnames are
 * not identity: they are addresses that either resolve or do not, and sweeping
 * them along with a rebrand is how sign-in gets broken. This is the one place
 * that knows the origin, and it is resolved rather than typed.
 *
 * Why it has to exist at all: Open Graph requires ABSOLUTE urls. A relative
 * `/opengraph-image.png` is silently dropped by every scraper — iMessage,
 * WhatsApp, Slack, Discord — so the card falls back to a bare link. Next builds
 * those absolute urls from `metadataBase`, and without one it warns at build
 * time and falls back to localhost, which produces a card that works on your
 * machine and nowhere else.
 *
 * Resolution order, most specific first:
 *
 *   1. NEXT_PUBLIC_SITE_URL — set this in Vercel once the real domain is live.
 *      It is the only thing that needs to change at domain cutover.
 *   2. VERCEL_PROJECT_PRODUCTION_URL — the project's stable production host
 *      (`genorra-kappa.vercel.app`), injected by Vercel. Note this is NOT
 *      VERCEL_URL, which is the per-deployment preview host and changes on
 *      every push — using that would make every share link point at a frozen
 *      preview build.
 *   3. localhost, for `npm run dev`.
 */
function resolveSiteUrl(): string {
  const explicit = process.env.NEXT_PUBLIC_SITE_URL
  if (explicit) return explicit.replace(/\/$/, '')

  const vercel = process.env.VERCEL_PROJECT_PRODUCTION_URL
  if (vercel) return `https://${vercel}`

  return 'http://localhost:3000'
}

export const SITE_URL = resolveSiteUrl()

/** `metadataBase` wants a URL instance, not a string. */
export const SITE_ORIGIN = new URL(SITE_URL)
