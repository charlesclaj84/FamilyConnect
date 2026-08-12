import type { NextConfig } from "next";
import { LEGACY_VERCEL_HOST, PRODUCTION_ORIGIN } from "./lib/site";

/**
 * One origin, enforced at the edge.
 *
 * The production deployment answers on two public hostnames — the purchased domain
 * and the `.vercel.app` alias Vercel assigns every project — and until this rule
 * existed both SERVED the app rather than one deferring to the other. That is two
 * bugs wearing one costume:
 *
 *   * **Sessions.** Cookies are scoped to an origin. A confirmation link is built
 *     from `{{ .SiteURL }}`, `/auth/confirm` writes the session cookie on whatever
 *     origin served it, and a user who crosses to the other host mid-flow is signed
 *     out on a dashboard with nothing on screen explaining why. This is the reason
 *     `supabase/config.toml` and TODO.md have both carried "the vercel.app host must
 *     REDIRECT here" since 2026-08-10.
 *   * **Search.** Two hosts serving identical bytes are two competing copies of the
 *     site, and the links each earns accrue to a different one.
 *
 * A 308 answers both at once, and answers them for every client rather than only for
 * the ones that read `<link rel="canonical">`. The canonical tags on the public pages
 * stay: they are what covers anything already indexed under the old host while Google
 * works through the redirects.
 *
 * WHY THIS DOES NOT CATCH PREVIEW DEPLOYMENTS. `has.host` is an exact match against
 * one hostname. Preview builds are served from generated hosts
 * (`genorra-git-<branch>-<team>.vercel.app`, `genorra-<hash>-<team>.vercel.app`) and
 * never equal this literal, so they keep working normally — which is what you want,
 * since a preview redirecting to production would make previews untestable. Previews
 * are kept out of the index by `app/robots.ts` instead.
 *
 * `permanent: true` is a 308, deliberately: it preserves the method and body, and it
 * is the status that tells a search engine to transfer authority and retire the old
 * URL rather than keep checking back. It is also cached hard by browsers, which is
 * the usual argument for starting with a 307 — it does not apply here, because the
 * alias is being retired rather than trialled.
 */

// A redirect whose source host equals its destination host is an infinite loop and a
// site outage. That cannot happen with the literal above, but it CAN if someone later
// rewrites either constant — so it fails the build instead of the site. Cheap, and the
// failure it prevents is total.
if (new URL(PRODUCTION_ORIGIN).host === LEGACY_VERCEL_HOST) {
  throw new Error(
    `next.config.ts: the legacy host redirect would loop — LEGACY_VERCEL_HOST ` +
    `(${LEGACY_VERCEL_HOST}) is the host of PRODUCTION_ORIGIN (${PRODUCTION_ORIGIN}). ` +
    `Delete the redirect rather than pointing it at itself.`,
  );
}

const nextConfig: NextConfig = {
  async redirects() {
    return [
      {
        // Every path, including `/` — `:path*` matches zero or more segments. The
        // query string is carried over by Next without being named here; naming it
        // would replace it instead.
        source: "/:path*",
        has: [{ type: "host", value: LEGACY_VERCEL_HOST }],
        destination: `${PRODUCTION_ORIGIN}/:path*`,
        permanent: true,
      },
    ];
  },
};

export default nextConfig;
