import type { NextConfig } from "next";

/**
 * Deliberately empty of redirects.
 *
 * ONE ORIGIN IS STILL THE RULE. `genorra.com` is canonical: every email link, canonical
 * tag, Open Graph URL and sitemap entry names it, and `PRODUCTION_ORIGIN` in
 * [lib/site.ts](lib/site.ts) is the single place that says so. Cookies are per-origin, so a
 * confirmation link built from one host and opened on another leaves the user signed out on
 * a dashboard with nothing explaining why — that is the failure one-origin prevents, and it
 * has not stopped mattering.
 *
 * WHAT ENFORCES IT NOW, AND WHY NOT HERE. Both duplicate hosts are handled a layer below
 * this file:
 *
 *   www.genorra.com          308 → genorra.com, in Vercel's domain config. At the edge,
 *                            so the app never renders the duplicate at all.
 *   genorra-kappa.vercel.app the DEV BRANCH's preview site — no longer a second face of
 *                            production, so there is nothing to collapse.
 *
 * This file used to 308 the `.vercel.app` alias to production, and that rule was REMOVED on
 * 2026-08-12 rather than repointed, for a reason worth keeping in front of whoever is
 * tempted to add it back: **`next.config.ts` ships inside the build.** A host rule naming
 * the alias is therefore present in the DEV build that the alias now serves, so it would
 * 308 every request away from the deployment you were trying to test. A redirect can only
 * live here if its source host serves no deployment of its own; once it does, the rule
 * belongs in Vercel.
 *
 * Preview deployments on generated hosts (`genorra-git-<branch>-<team>.vercel.app`) were
 * never caught by the old rule either — `has.host` is an exact match — and are kept out of
 * the index by `app/robots.ts`, which reads `IS_INDEXABLE_DEPLOYMENT` and serves
 * `Disallow: /` for anything that is not the production deployment. That is what covers the
 * search half of the argument now.
 */
const nextConfig: NextConfig = {};

export default nextConfig;
