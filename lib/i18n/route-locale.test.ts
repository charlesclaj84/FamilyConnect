import { describe, expect, it } from 'vitest'
import { readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { LOCALES } from '@/lib/i18n/locales'
import {
  LOCALIZED_ROOTS,
  absoluteLocaleAlternates,
  isLocalizablePath,
  localeAlternates,
  localePrefixRedirect,
  localizedHref,
  localizedAlternates,
  splitLocalePath,
} from '@/lib/i18n/route-locale'

/**
 * The public site's URL structure, asserted.
 *
 * ── WHY THIS IS UNDER `npm test` AND NOT `tests/rls` ────────────────────────────────
 * AGENTS.md §7b draws the line: `tests/rls` calls actions against real policies because family
 * isolation is enforced by SQL nobody reviewed, and `vitest` covers the pure modules under
 * `lib/`. Nothing here touches a database or a session — it is string arithmetic over a path,
 * which is exactly what the second runner is for.
 *
 * ── AND A GREEN RUN IS NOT EVIDENCE UNTIL IT HAS FAILED ─────────────────────────────
 * Mutation-checked, per §7b. Each of these turns a different set of cases red:
 *
 *   * `localizedHref` prefixing English as well                   → 4 cases
 *   * `splitLocalePath` treating an unknown segment as a locale    → 3
 *   * `localePrefixRedirect` never firing                          → 1
 *   * removing `/login` from `LOCALIZED_ROOTS`                     → 1
 *
 * The last one is the one that matters most and is the least obvious: without it a reader on
 * Spanish Home gets an English registration form, and nothing else in the tree notices. It is
 * also the thinnest — ONE case, because the three assertions about the sign-up flow are in one
 * `it`. That is deliberate rather than an oversight: they are three halves of one claim, and
 * splitting them would report a single mistake three times.
 *
 * `localizedAlternates` is checked in `lib/marketing/locale.test.ts` rather than here, because
 * it is the only thing in this feature that builds a `Metadata` object and belongs beside the
 * rest of that module's behaviour.
 */
describe('splitLocalePath', () => {
  it('takes a supported locale off the front', () => {
    expect(splitLocalePath('/es/pricing')).toEqual({ locale: 'es', path: '/pricing', prefixed: true })
    expect(splitLocalePath('/fr/how-it-works'))
      .toEqual({ locale: 'fr', path: '/how-it-works', prefixed: true })
  })

  it('reads a bare segment as Home rather than as an empty path', () => {
    // `/es` is Home in Spanish. An empty remainder normalised here rather than at four call
    // sites, each of which would have to remember.
    expect(splitLocalePath('/es')).toEqual({ locale: 'es', path: '/', prefixed: true })
  })

  it('leaves an unprefixed path alone, and says it was not prefixed', () => {
    expect(splitLocalePath('/pricing')).toEqual({ locale: 'en', path: '/pricing', prefixed: false })
    expect(splitLocalePath('/')).toEqual({ locale: 'en', path: '/', prefixed: false })
  })

  it('does not treat an unsupported segment as a locale', () => {
    // The load-bearing case. `/de/pricing` must 404 as the unknown route it is — reading `de`
    // as a locale would serve English Home at an address the product does not have.
    expect(splitLocalePath('/de/pricing'))
      .toEqual({ locale: 'en', path: '/de/pricing', prefixed: false })
    // And a path segment that merely LOOKS like one. `/esther` is not Spanish.
    expect(splitLocalePath('/esther')).toEqual({ locale: 'en', path: '/esther', prefixed: false })
  })

  it('is unfazed by a Dashboard path', () => {
    // Not localizable, so nothing should come off it. `proxy.ts` relies on this to leave
    // `/dashboard` exactly as it arrived.
    expect(splitLocalePath('/dashboard/nothing'))
      .toEqual({ locale: 'en', path: '/dashboard/nothing', prefixed: false })
  })
})

describe('localizedHref', () => {
  it('prefixes for a non-base locale and never for English', () => {
    expect(localizedHref('/pricing', 'es')).toBe('/es/pricing')
    expect(localizedHref('/pricing', 'fr')).toBe('/fr/pricing')
    // English is served at one address only — see the module header on duplicate content.
    expect(localizedHref('/pricing', 'en')).toBe('/pricing')
  })

  it('builds Home without a trailing slash', () => {
    expect(localizedHref('/', 'es')).toBe('/es')
    expect(localizedHref('/', 'en')).toBe('/')
  })

  it('leaves a path that is not public unchanged in every language', () => {
    // The marketing footer links to `/help`; prefixing it would build an address that 404s.
    for (const code of ['en', 'es', 'fr']) {
      expect(localizedHref('/help', code)).toBe('/help')
      expect(localizedHref('/dashboard', code)).toBe('/dashboard')
    }
  })

  it('refuses an unsupported locale rather than inventing a prefix', () => {
    expect(localizedHref('/pricing', 'de')).toBe('/pricing')
    expect(localizedHref('/pricing', '')).toBe('/pricing')
  })
})

describe('localePrefixRedirect', () => {
  it('sends every /en/… address to its unprefixed one', () => {
    expect(localePrefixRedirect('/en/pricing')).toBe('/pricing')
    expect(localePrefixRedirect('/en')).toBe('/')
  })

  it('answers null for anything that is not English-prefixed', () => {
    expect(localePrefixRedirect('/es/pricing')).toBeNull()
    expect(localePrefixRedirect('/pricing')).toBeNull()
    // `/english` is not `/en`.
    expect(localePrefixRedirect('/english')).toBeNull()
  })
})

describe('localeAlternates', () => {
  it('names every language, English at its unprefixed address', () => {
    expect(localeAlternates('/pricing')).toEqual({
      en: '/pricing',
      es: '/es/pricing',
      fr: '/fr/pricing',
    })
  })

  it('covers Home', () => {
    expect(localeAlternates('/')).toEqual({ en: '/', es: '/es', fr: '/fr' })
  })
})

describe('localizedAlternates', () => {
  it('names this language as the canonical address, not the English one', () => {
    // The load-bearing case. `/es/pricing` is the canonical address OF THE SPANISH PAGE — a
    // canonical of `/pricing` here would tell a crawler the Spanish page is a duplicate of the
    // English one and should not be indexed at all.
    expect(localizedAlternates('/pricing', 'es')?.canonical).toBe('/es/pricing')
    expect(localizedAlternates('/pricing', 'fr')?.canonical).toBe('/fr/pricing')
    expect(localizedAlternates('/pricing', 'en')?.canonical).toBe('/pricing')
  })

  it('lists every language plus x-default', () => {
    // `x-default` is what a crawler serves a reader whose language matches none of the three.
    // The same URL as `en` deliberately: two different claims about one address, and omitting
    // it leaves the fallback to be guessed.
    expect(localizedAlternates('/features', 'es')?.languages).toEqual({
      en: '/features',
      es: '/es/features',
      fr: '/fr/features',
      'x-default': '/features',
    })
  })

  it('covers Home', () => {
    const alt = localizedAlternates('/', 'fr')
    expect(alt?.canonical).toBe('/fr')
    expect(alt?.languages).toEqual({ en: '/', es: '/es', fr: '/fr', 'x-default': '/' })
  })

  it('falls back to the path for a locale it does not know', () => {
    // Never undefined: a page that somehow resolved a locale outside the registry still gets a
    // canonical, because a metadata block with a missing canonical is worse than a plain one.
    expect(localizedAlternates('/about', 'de')?.canonical).toBe('/about')
  })
})

describe('LOCALIZED_ROOTS', () => {
  it('covers every marketing route that exists', () => {
    // DERIVED rather than listed, which is the point: a new page under `(marketing)` fails this
    // until it is on the list, and the failure names it. Without this the cost of forgetting is
    // a page whose Spanish URL 404s — invisible in English, and invisible in a build.
    const dir = join(process.cwd(), 'app', '(marketing)')
    const routes = readdirSync(dir).filter(name => statSync(join(dir, name)).isDirectory())
    expect(routes.length).toBeGreaterThan(0)
    for (const route of routes) {
      expect(isLocalizablePath(`/${route}`), `/${route} is not in LOCALIZED_ROOTS`).toBe(true)
    }
  })

  it('covers Home and the sign-up flow', () => {
    expect(isLocalizablePath('/')).toBe(true)
    // The hole this list was widened to close: a reader four Spanish pages deep pressing
    // *Create your free account* must not land on an English form.
    expect(isLocalizablePath('/register')).toBe(true)
    expect(isLocalizablePath('/login')).toBe(true)
  })

  it('covers a child path of a listed root', () => {
    expect(isLocalizablePath('/features/anything')).toBe(true)
  })

  it('does not cover the Dashboard, the Staff console or the manual', () => {
    // The Dashboard's language is a column on `people`, not a path segment. The manual is
    // inside it. `/api` carries webhooks and must never gain a second address.
    for (const path of ['/dashboard', '/help', '/admin/members', '/staff', '/api/stripe/connect']) {
      expect(isLocalizablePath(path), `${path} must not be localizable`).toBe(false)
    }
  })

  it('does not accidentally match a path that merely starts with the same letters', () => {
    // `/aboutus` is not `/about`. The `startsWith(root + '/')` conjunct is what stops it.
    expect(isLocalizablePath('/aboutus')).toBe(false)
    expect(LOCALIZED_ROOTS).toContain('/about')
  })
})

/**
 * The sitemap's absolute form of the alternates, added 2026-09-01 when `app/sitemap.ts`
 * stopped listing one URL per route.
 *
 * The root is the case worth pinning: `localizedHref('/', 'en')` is `'/'`, so a naive
 * `origin + path` gives `https://genorra.com/` while every other reference to the home page
 * in that file is the bare origin — two spellings of one URL inside one sitemap, which is the
 * exact duplicate a sitemap exists to prevent.
 */
describe('absoluteLocaleAlternates', () => {
  const ORIGIN = 'https://genorra.com'

  it('joins the root without a trailing slash, so it matches the sitemap’s own entry', () => {
    const alt = absoluteLocaleAlternates('/', ORIGIN)
    expect(alt.en).toBe('https://genorra.com')
    expect(alt.es).toBe('https://genorra.com/es')
    expect(alt.fr).toBe('https://genorra.com/fr')
  })

  it('prefixes an ordinary page and leaves English unprefixed', () => {
    const alt = absoluteLocaleAlternates('/pricing', ORIGIN)
    expect(alt.en).toBe('https://genorra.com/pricing')
    expect(alt.es).toBe('https://genorra.com/es/pricing')
    expect(alt.fr).toBe('https://genorra.com/fr/pricing')
  })

  it('points x-default at the unprefixed English URL', () => {
    // Not a fourth language: x-default is what a crawler serves a reader whose own
    // language is none of the three, and pointing it at a prefixed URL would make the
    // Spanish page the default for a German reader.
    expect(absoluteLocaleAlternates('/about', ORIGIN)['x-default'])
      .toBe('https://genorra.com/about')
    expect(absoluteLocaleAlternates('/', ORIGIN)['x-default']).toBe('https://genorra.com')
  })

  it('tolerates an origin with a trailing slash rather than doubling it', () => {
    // `SITE_URL` is normalised, but it is resolved from an environment variable at module
    // scope and `lib/site.ts` records a real incident where that value was not what anybody
    // expected. A sitemap full of `https://genorra.com//pricing` is not worth risking on it.
    expect(absoluteLocaleAlternates('/pricing', 'https://genorra.com/').es)
      .toBe('https://genorra.com/es/pricing')
  })

  it('covers every locale the product offers, so a fourth needs no edit here', () => {
    const alt = absoluteLocaleAlternates('/features', ORIGIN)
    for (const { code } of LOCALES) expect(alt[code]).toBeTruthy()
    // The languages plus x-default, and nothing else.
    expect(Object.keys(alt).sort()).toEqual([...LOCALES.map(l => l.code), 'x-default'].sort())
  })
})
