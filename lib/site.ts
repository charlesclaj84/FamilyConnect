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
 *   1. NEXT_PUBLIC_SITE_URL — an explicit override. Not required any more (see
 *      PRODUCTION_ORIGIN below), but it still wins where it is set, which is how
 *      `.env.local` points a dev server's emails at localhost.
 *   2. VERCEL_ENV === 'production' → PRODUCTION_ORIGIN, the custom domain.
 *   3. VERCEL_PROJECT_PRODUCTION_URL — the project's stable production host
 *      (`genorra-kappa.vercel.app`), injected by Vercel. Note this is NOT
 *      VERCEL_URL, which is the per-deployment preview host and changes on
 *      every push — using that would make every share link point at a frozen
 *      preview build. This is now the PREVIEW answer only.
 *   4. localhost, for `npm run dev`.
 */

/**
 * The canonical public origin. A DNS name, deliberately: AGENTS.md keeps deployment
 * hostnames out of `lib/brand.ts` because they are addresses that either resolve or
 * do not, and sweeping one along with a rename breaks sign-in and every link in every
 * confirmation email until the deployment is actually renamed to match.
 *
 * IT IS A CONSTANT RATHER THAN AN ENVIRONMENT VARIABLE because the environment cannot
 * currently be edited on the deployment, and the failure that caused was silent and
 * split: with NEXT_PUBLIC_SITE_URL unset, this file fell through to the .vercel.app
 * host while `emailOrigin()` in lib/email/send.ts fell through to a hardcoded
 * genorra.com — so Open Graph cards and the sitemap advertised one origin while
 * invitation emails linked to another, and nothing anywhere compared them. That
 * duplicated literal is gone; send.ts now reads this file.
 *
 * At a domain cutover, change this line, or set NEXT_PUBLIC_SITE_URL to override it
 * without a deploy.
 */
export const PRODUCTION_ORIGIN = 'https://genorra.com'

/**
 * The `.vercel.app` host this project was served from before the domain was bought,
 * and which Vercel keeps assigning to the production deployment forever.
 *
 * It is here to be REDIRECTED AWAY FROM, not to be used. `next.config.ts` turns every
 * request arriving on it into a 308 to `PRODUCTION_ORIGIN`, which is the fix
 * `supabase/config.toml` and TODO.md have both been asking for since 2026-08-10.
 *
 * WHY A REDIRECT AND NOT JUST A CANONICAL TAG. The search-engine half — two hosts
 * serving identical bytes, authority split between them — is the milder of the two
 * problems and a canonical does answer it. The other half is a session bug: the link
 * in a confirmation email is built from one origin, `/auth/confirm` writes the session
 * cookie on that origin, and a user who arrives on the other one is signed out on a
 * dashboard with nothing explaining why. Cookies are per-origin, and no amount of
 * markup fixes that. Only having one origin does.
 *
 * A STRING LITERAL, NOT `VERCEL_PROJECT_PRODUCTION_URL`, and this is the trap worth
 * knowing about: that variable is documented as "a production domain name of the
 * project", and once a custom domain is attached it can resolve to the custom domain
 * rather than the `.vercel.app` one. Deriving the redirect's SOURCE from it would then
 * match genorra.com and send genorra.com to genorra.com — an infinite loop taking the
 * whole site down, on a config change nobody made. A literal cannot do that, and
 * `next.config.ts` asserts the two are different anyway.
 *
 * Delete this and the redirect together if the alias is ever detached in Vercel.
 */
export const LEGACY_VERCEL_HOST = 'genorra-kappa.vercel.app'

function resolveSiteUrl(): string {
  const explicit = process.env.NEXT_PUBLIC_SITE_URL?.trim()
  if (explicit) return explicit.replace(/\/+$/, '')

  // VERCEL_ENV is 'production' only for a production deployment — a preview build of
  // the same commit reports 'preview'. It is not a NEXT_PUBLIC_ variable, so it is
  // absent in the browser bundle; every consumer of SITE_URL is server-side (layout's
  // metadataBase, robots.ts, sitemap.ts, emailOrigin) and a client import would simply
  // fall through to the preview host rather than misreport production.
  if (process.env.VERCEL_ENV === 'production') return PRODUCTION_ORIGIN

  const vercel = process.env.VERCEL_PROJECT_PRODUCTION_URL
  if (vercel) return `https://${vercel}`

  return 'http://localhost:3000'
}

export const SITE_URL = resolveSiteUrl()

/** `metadataBase` wants a URL instance, not a string. */
export const SITE_ORIGIN = new URL(SITE_URL)

/**
 * Whether this build is the one that belongs in a search index.
 *
 * Only the production deployment is. A preview build serves the SAME pages, the
 * SAME copy and the SAME sitemap from a different hostname, and Vercel preview
 * URLs are public — so without this, every push publishes a second crawlable
 * copy of the marketing site, and Google is left to decide which of the two is
 * the real one. It sometimes decides wrong, and the version it picks is a frozen
 * build of a branch.
 *
 * `app/robots.ts` reads this and serves `Disallow: /` everywhere but production.
 *
 * WHAT THIS DOES NOT COVER, because it cannot: the production deployment answers
 * on BOTH `genorra.com` and the `.vercel.app` alias Vercel assigns every project,
 * and those two hosts are the same build serving the same bytes. robots.txt is
 * part of that build, so it cannot say "allow" on one and "disallow" on the
 * other. That half is the job of the canonical tags on the public pages — an
 * absolute `<link rel="canonical" href="https://genorra.com/…">` is the same on
 * both hosts and names the winner. See the note in `app/page.tsx`.
 */
export const IS_INDEXABLE_DEPLOYMENT = process.env.VERCEL_ENV === 'production'
