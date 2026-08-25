import { afterEach, describe, expect, it, vi } from 'vitest'

/**
 * Which origin a deployment thinks it lives at.
 *
 * ── WHY THIS FILE EXISTS: THE RESOLUTION WAS WRONG FOR WEEKS AND NOTHING NOTICED ────
 * `resolveSiteUrl` fell through to `VERCEL_PROJECT_PRODUCTION_URL` on preview, which Vercel
 * documents as *"a production domain name of the project… useful to reliably generate links
 * that point to production."* While the project had no custom domain that variable held the
 * `.vercel.app` host and the bug was invisible. The day `genorra.com` was attached, every
 * preview build started announcing itself as production — and still nothing failed, because a
 * URL that resolves is a URL that resolves.
 *
 * It surfaced as a Stripe checkout on a preview deployment sending the payer back to
 * PRODUCTION on return (2026-08-23). The same value builds invitation links, confirmation
 * links and `metadataBase`.
 *
 * ── SO WHAT IS ASSERTED IS THE INVARIANT, NOT THE TABLE ─────────────────────────────
 * The individual steps are worth pinning, but the case that would have caught this is the
 * last one: **no non-production deployment may ever resolve to the production origin.** That
 * is a property of the whole function rather than of any branch of it, and it stays true if
 * somebody adds a sixth step.
 *
 * ── `vi.resetModules()` IS LOAD-BEARING ─────────────────────────────────────────────
 * `SITE_URL` is a module-level constant computed at import time, so the environment has to be
 * set BEFORE the import and the module registry cleared between cases. A plain top-level
 * `import` would evaluate once, with whatever the first case happened to set.
 *
 * CHECKED BY MUTATION (2026-08-23), all four tripped:
 *   * `VERCEL_BRANCH_URL` step restored to `VERCEL_PROJECT_PRODUCTION_URL`   3 failed
 *   * the `VERCEL_ENV === 'production'` test removed                        1 failed
 *   * production made to beat the explicit override                        1 failed
 *   * the trailing-slash strip removed                                      1 failed
 *
 * The first is the one that matters: it is the bug this file was written for, and it takes
 * the preview case, the never-production invariant and the indexability case down together.
 */

const VARS = [
  'NEXT_PUBLIC_SITE_URL', 'VERCEL_ENV', 'VERCEL_BRANCH_URL',
  'VERCEL_URL', 'VERCEL_PROJECT_PRODUCTION_URL',
] as const

/** Import `lib/site` fresh, with exactly this environment and nothing inherited. */
async function siteWith(env: Partial<Record<(typeof VARS)[number], string>>) {
  vi.resetModules()
  for (const key of VARS) vi.stubEnv(key, env[key] ?? '')
  return import('@/lib/site')
}

afterEach(() => { vi.unstubAllEnvs() })

describe('resolveSiteUrl', () => {
  it('uses the custom domain on production', async () => {
    const { SITE_URL, PRODUCTION_ORIGIN } = await siteWith({ VERCEL_ENV: 'production' })
    expect(SITE_URL).toBe(PRODUCTION_ORIGIN)
  })

  it('uses the BRANCH host on a preview deployment', async () => {
    // The regression, stated positively. `VERCEL_PROJECT_PRODUCTION_URL` is set here to the
    // custom domain — exactly as Vercel sets it on a preview build — so this case fails
    // against the old resolution and passes against the new one.
    const { SITE_URL } = await siteWith({
      VERCEL_ENV: 'preview',
      VERCEL_BRANCH_URL: 'genorra-git-dev-acme.vercel.app',
      VERCEL_URL: 'genorra-abc123-acme.vercel.app',
      VERCEL_PROJECT_PRODUCTION_URL: 'genorra.com',
    })
    expect(SITE_URL).toBe('https://genorra-git-dev-acme.vercel.app')
  })

  it('falls back to the per-deployment host when there is no branch host', async () => {
    const { SITE_URL } = await siteWith({
      VERCEL_ENV: 'preview',
      VERCEL_URL: 'genorra-abc123-acme.vercel.app',
      VERCEL_PROJECT_PRODUCTION_URL: 'genorra.com',
    })
    expect(SITE_URL).toBe('https://genorra-abc123-acme.vercel.app')
  })

  it('falls back to localhost off Vercel', async () => {
    const { SITE_URL } = await siteWith({})
    expect(SITE_URL).toBe('http://localhost:3000')
  })

  it('lets an explicit override win, including over production', async () => {
    // This is how a preview is pinned to a specific host, and how `.env.local` points a dev
    // server's emails at localhost. It wins everywhere, which is exactly why it has to be
    // SCOPED per environment on Vercel.
    const { SITE_URL } = await siteWith({
      NEXT_PUBLIC_SITE_URL: 'https://genorra-kappa.vercel.app',
      VERCEL_ENV: 'production',
      VERCEL_BRANCH_URL: 'genorra-git-dev-acme.vercel.app',
    })
    expect(SITE_URL).toBe('https://genorra-kappa.vercel.app')
  })

  it('strips a trailing slash so paths are not doubled', async () => {
    // `${SITE_URL}${path}` is how every consumer builds a URL — `checkoutReturnUrls`,
    // `emailOrigin`, the Connect return links. A stored trailing slash yields `//admin`.
    const { SITE_URL } = await siteWith({ NEXT_PUBLIC_SITE_URL: 'https://example.test/' })
    expect(SITE_URL).toBe('https://example.test')
  })

  it('NEVER resolves to production from a non-production deployment', async () => {
    // ── THE ONE THAT WOULD HAVE CAUGHT IT ────────────────────────────────────────────
    // A property of the whole function rather than of one branch, so a sixth step added
    // later is covered without anybody remembering to cover it. `VERCEL_PROJECT_PRODUCTION_URL`
    // is set in every case, because that is what Vercel does — the docs say it is "always
    // set, even in preview deployments".
    const environments = [
      { VERCEL_ENV: 'preview', VERCEL_BRANCH_URL: 'genorra-git-dev-acme.vercel.app' },
      { VERCEL_ENV: 'preview', VERCEL_URL: 'genorra-abc123-acme.vercel.app' },
      { VERCEL_ENV: 'preview' },
      { VERCEL_ENV: 'development' },
      {},
    ]
    for (const env of environments) {
      const { SITE_URL, PRODUCTION_ORIGIN } = await siteWith({
        ...env,
        VERCEL_PROJECT_PRODUCTION_URL: 'genorra.com',
      })
      expect(SITE_URL, `env ${JSON.stringify(env)} leaked production`).not.toBe(PRODUCTION_ORIGIN)
      expect(SITE_URL).not.toContain('//genorra.com')
    }
  })

  it('reports a preview build as not indexable', async () => {
    // Unchanged by this repair and asserted beside it: `robots.ts` reads this, and a preview
    // that both announced production URLs AND allowed crawling would publish a second
    // crawlable copy of the marketing site.
    const preview = await siteWith({ VERCEL_ENV: 'preview' })
    expect(preview.IS_INDEXABLE_DEPLOYMENT).toBe(false)
    const production = await siteWith({ VERCEL_ENV: 'production' })
    expect(production.IS_INDEXABLE_DEPLOYMENT).toBe(true)
  })
})
