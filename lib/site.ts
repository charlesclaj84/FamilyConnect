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

/*
 * `LEGACY_VERCEL_HOST` USED TO LIVE HERE, and its removal on 2026-08-12 is worth a note
 * because the problem it solved is still real and the solution moved rather than lapsed.
 *
 * The production deployment answered on two public hostnames — `genorra.com` and the
 * `.vercel.app` alias Vercel assigns every project — and both SERVED the app. That was two
 * bugs in one costume: cookies are per-origin, so a confirmation link built from one host
 * and opened on the other left the user signed out with nothing explaining why; and two
 * hosts serving identical bytes are two competing copies of the site in search. A 308 in
 * `next.config.ts` collapsed them.
 *
 * WHAT REPLACED IT. The redirect now happens ONE LAYER DOWN, in Vercel: `www.genorra.com`
 * 308s to `genorra.com` at the edge, so the app never sees the duplicate at all. And
 * `genorra-kappa.vercel.app` is no longer a second face of production — it is the DEV
 * BRANCH's preview site. Redirecting it would have made that preview untestable, which is
 * precisely why the rule had to go rather than be repointed.
 *
 * WHAT STILL COVERS THE SEARCH HALF: `IS_INDEXABLE_DEPLOYMENT` below is false for any
 * non-production build, so the dev site publishes `Disallow: /` and offers no sitemap. The
 * absolute canonical tags on the public pages cover anything already indexed under the old
 * alias while Google works through it.
 *
 * WHAT IS NO LONGER COVERED, honestly: a URL indexed under `genorra-kappa.vercel.app`
 * before today no longer 308s to production — it now serves the dev branch, which
 * disallows crawling. That is a weaker answer than a redirect and an acceptable one,
 * because the alias was never advertised anywhere; no email, sitemap or canonical has ever
 * named it.
 *
 * DO NOT reintroduce a host-based redirect in `next.config.ts` without dealing with this:
 * the config ships INSIDE the build, so a rule naming the alias applies to the dev
 * deployment served on it and 308s every request away from the thing you are trying to
 * test. Host redirects for a host that serves a real deployment belong in Vercel, not here.
 */

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
 * THIS NOW COVERS THE WHOLE PROBLEM, which it did not until 2026-08-12. The
 * production deployment used to answer on BOTH `genorra.com` and the `.vercel.app`
 * alias — the same build serving the same bytes, so robots.txt, being part of that
 * build, could not say "allow" on one host and "disallow" on the other. That gap is
 * closed by the arrangement, not by this flag: `www` is 308'd at the edge, and the
 * alias serves the DEV branch, which reports `VERCEL_ENV=preview` and therefore
 * disallows everything through this constant.
 *
 * The absolute canonical tags on the public pages stay regardless — they are what
 * covers anything already indexed under the old alias while Google works through it.
 * See the note in `app/page.tsx`.
 */
export const IS_INDEXABLE_DEPLOYMENT = process.env.VERCEL_ENV === 'production'
