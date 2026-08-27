import { describe, expect, it } from 'vitest'
import { marketingAlternates } from '@/lib/marketing/locale'

/**
 * The `hreflang` block every public page owes.
 *
 * ── WHY THIS IS WORTH A TEST WHEN IT IS FOUR LINES ──────────────────────────────────
 * Because it is the one part of the public site's localization whose failure is invisible from
 * inside the product. A wrong `canonical` or a missing `x-default` renders identically, breaks
 * no page, fails no build, and costs search traffic months later — there is nothing to notice.
 *
 * Everything else about `lib/marketing/locale.ts` reads a request header and is therefore not
 * this runner's business (§7b): `marketingLocale` and `marketingRoute` are asserted by the
 * routing itself, in `proxy.ts`, against a real server.
 *
 * Mutation-checked: dropping `x-default` turns one case red, and returning the unprefixed path
 * as the canonical for every language turns another.
 */
describe('marketingAlternates', () => {
  it('names this language as the canonical address, not the English one', () => {
    // The load-bearing case. `/es/pricing` is the canonical address OF THE SPANISH PAGE — a
    // canonical of `/pricing` here would tell a crawler the Spanish page is a duplicate of the
    // English one and should not be indexed at all.
    expect(marketingAlternates('/pricing', 'es')?.canonical).toBe('/es/pricing')
    expect(marketingAlternates('/pricing', 'fr')?.canonical).toBe('/fr/pricing')
    expect(marketingAlternates('/pricing', 'en')?.canonical).toBe('/pricing')
  })

  it('lists every language plus x-default', () => {
    // `x-default` is what a crawler serves a reader whose language matches none of the three.
    // The same URL as `en` deliberately: two different claims about one address, and omitting
    // it leaves the fallback to be guessed.
    expect(marketingAlternates('/features', 'es')?.languages).toEqual({
      en: '/features',
      es: '/es/features',
      fr: '/fr/features',
      'x-default': '/features',
    })
  })

  it('covers Home', () => {
    const alt = marketingAlternates('/', 'fr')
    expect(alt?.canonical).toBe('/fr')
    expect(alt?.languages).toEqual({ en: '/', es: '/es', fr: '/fr', 'x-default': '/' })
  })

  it('falls back to the path for a locale it does not know', () => {
    // Never undefined: a page that somehow resolved a locale outside the registry still gets a
    // canonical, because a metadata block with a missing canonical is worse than a plain one.
    expect(marketingAlternates('/about', 'de')?.canonical).toBe('/about')
  })
})
