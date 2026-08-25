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
 *   1. NEXT_PUBLIC_SITE_URL — an explicit override, and the one to reach for when a
 *      preview must answer on a specific host. IT WINS EVERYWHERE, so on Vercel it
 *      has to be SCOPED to the environment it is meant for: set for all three, it
 *      points preview at production, which is the failure the whole of step 3 is a
 *      note about.
 *   2. VERCEL_ENV === 'production' → PRODUCTION_ORIGIN, the custom domain.
 *   3. VERCEL_BRANCH_URL — the branch's own preview host, stable for the life of the
 *      branch. THE PREVIEW ANSWER.
 *   4. VERCEL_URL — per-deployment, changes on every push. A last resort for a
 *      deployment with no branch host; never a share link worth keeping.
 *   5. localhost, for `npm run dev`.
 *
 * EVERY STEP BELOW PRODUCTION MUST YIELD A NON-PRODUCTION ORIGIN. That is the
 * invariant, and it is the one that was broken between the custom domain landing and
 * 2026-08-23 — see the block on `VERCEL_PROJECT_PRODUCTION_URL` in `resolveSiteUrl`.
 * A preview that resolves to production sends real Stripe redirects and real email
 * links into the live site, from a build nobody has reviewed.
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

  // ── PREVIEW: THE BRANCH'S OWN HOST ────────────────────────────────────────────────
  //
  // `VERCEL_BRANCH_URL` is `<project>-git-<branch>-<team>.vercel.app` — stable for as long as
  // the branch exists, so it does not change on every push the way `VERCEL_URL` does. That
  // stability is the property this file has always wanted; what it had until 2026-08-23 was a
  // variable that is stable for a different reason.
  //
  // ── WHAT WAS HERE, AND WHY IT WAS WRONG ──────────────────────────────────────────
  // `VERCEL_PROJECT_PRODUCTION_URL`, described in the comment above as "the project's stable
  // production host (genorra-kappa.vercel.app)". Vercel's own definition is the opposite of
  // the use it was put to:
  //
  //     "A production domain name of the project. We select the shortest production CUSTOM
  //      domain, or vercel.app domain if no custom domain is available. Note, that this is
  //      always set, even in preview deployments. This is useful to reliably generate links
  //      that point to PRODUCTION."
  //
  // It was the `.vercel.app` host — and therefore harmless — only while the project had no
  // custom domain. The moment `genorra.com` was attached it started answering `genorra.com`,
  // in every environment, and preview silently lost any origin of its own. Nothing failed
  // loudly, because a URL that resolves is a URL that resolves.
  //
  // WHAT IT COST, and all three are the same bug wearing different clothes: a Stripe checkout
  // begun on preview sent the payer back to PRODUCTION on return (found this way); an
  // invitation or confirmation email sent from preview linked into production, where the token
  // is for a different database; and `metadataBase` advertised production URLs from a build
  // that is `noindex` anyway.
  //
  // A CUSTOM DOMAIN IS THE ORDINARY END STATE OF ANY PROJECT, so this was never a latent trap
  // — it was one that arms itself on the day the product gets its name.
  const branch = process.env.VERCEL_BRANCH_URL?.trim()
  if (branch) return `https://${branch}`

  // A Vercel deployment with no branch host — a CLI deploy, or a preview built outside a git
  // branch. Per-deployment and therefore unstable, which is why it is the LAST resort rather
  // than the preview answer: a link built from it points at one frozen build forever. Still
  // strictly better than falling through to localhost, which is wrong on any deployment.
  const deployment = process.env.VERCEL_URL?.trim()
  if (deployment) return `https://${deployment}`

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
