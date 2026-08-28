import { describe, expect, it } from 'vitest'
import { BASE_LOCALE, LOCALES, isSupportedLocale, negotiateLocale, preferredLocale, storedLocale } from '@/lib/i18n/locales'

/**
 * The pure half of "which language is this reader in".
 *
 * ── WHY THIS FILE EXISTS, AND WHAT IT IS EVIDENCE FOR ─────────────────────────────
 * `resolveLocale` in `lib/auth/locale.ts` is the answer the app actually uses, and nothing
 * under `npm test` can call it: it reads `next/headers` and queries Supabase through the
 * admin client, which is the boundary AGENTS.md §7b draws around `lib/**\/*.test.ts` on
 * purpose. So the ORDER of the four sources lives here and the resolver is three reads and
 * one call to `preferredLocale`.
 *
 * What that buys is exactly the edit that prompted it. On 2026-08-27 a FOURTH source was
 * inserted into the MIDDLE of a three-rung `??` chain — the `/es` or `/fr` path segment,
 * between the member's stored choice and their browser's `Accept-Language` — because
 * `/es/login` was serving a Spanish `<html lang>` over an entirely English form. An
 * inserted rung is the shape of change most likely to be subtly wrong, and until this file
 * there was nowhere to assert it.
 *
 * ── WHAT IT IS NOT EVIDENCE FOR ───────────────────────────────────────────────────
 * That the resolver READS the right three things, or that `proxy.ts` sets the header it
 * reads. Neither is checkable here. Both were measured against a real `next start`:
 *
 *     GET /es/login   Accept-Language: en-US   →   `¿Es nuevo aquí o no puede entrar?`
 *     GET /login      Accept-Language: en-US   →   `New here, or cannot get in?`
 *
 * ── CHECKED BY MUTATION, as §7b requires ─────────────────────────────────────────
 * Four, all tripped. The figures are `it` blocks rather than assertions — the cases below
 * group several `expect`s each, so a mutation that breaks one rung shows up as one or two
 * red lines rather than as a wall:
 *
 *   * `addressed` moved above `chosen`                                  1 failed
 *   * `addressed` moved below `asked` (the pre-2026-08-27 order)         2 failed
 *   * `addressed` dropped from the chain entirely                       3 failed
 *   * `isSupportedLocale` guard removed (an unknown value wins)         1 failed
 */

describe('preferredLocale', () => {
  it('lets a stored choice beat everything', () => {
    // A member who set Spanish on My Profile and then opened an English-addressed link has
    // not changed their mind. This is the one rung that is a statement about the READER.
    expect(preferredLocale({ chosen: 'es', addressed: 'fr', asked: 'en' })).toBe('es')
    expect(preferredLocale({ chosen: 'es', addressed: null, asked: 'en' })).toBe('es')
  })

  it('lets the address bar beat the browser', () => {
    // THE RUNG THAT WAS MISSING. A reader who has been on Spanish Home for four pages and
    // clicks *Iniciar sesión* must not be handed an English form, whatever their browser
    // was configured with years ago.
    expect(preferredLocale({ addressed: 'es', asked: 'en' })).toBe('es')
    expect(preferredLocale({ addressed: 'fr', asked: 'es' })).toBe('fr')
  })

  it('falls through to the browser where the address says nothing', () => {
    // Which is every page of the Dashboard: `proxy.ts` sets the header only when it
    // rewrites a prefixed path, and no signed-in route has one.
    expect(preferredLocale({ addressed: null, asked: 'fr' })).toBe('fr')
    expect(preferredLocale({ asked: 'es' })).toBe('es')
  })

  it('answers English when nothing does', () => {
    // The rung that always answers, so no call site branches on "we do not know".
    expect(preferredLocale({})).toBe(BASE_LOCALE)
    expect(preferredLocale({ chosen: null, addressed: null, asked: null })).toBe(BASE_LOCALE)
    expect(preferredLocale({ chosen: undefined })).toBe(BASE_LOCALE)
  })

  it('treats an unsupported value as absent, at every rung', () => {
    // Each of the three arrives from something outside this codebase's control — a column,
    // a URL segment, a request header — so `'de'`, `'en-GB'` and `'; DROP TABLE'` are all
    // ordinary inputs. Falling THROUGH one is the whole point: an unknown `chosen` must not
    // shadow a perfectly good `addressed`.
    expect(preferredLocale({ chosen: 'de', addressed: 'es', asked: 'en' })).toBe('es')
    expect(preferredLocale({ chosen: 'de', addressed: 'nl', asked: 'fr' })).toBe('fr')
    expect(preferredLocale({ chosen: 'de', addressed: 'nl', asked: 'ja' })).toBe(BASE_LOCALE)
    // A REGION SUBTAG IS NOT A CODE. `'es-MX'` is an `Intl` tag; the catalogue is keyed on
    // `'es'`. `intlTagFor` turns one into the other and this function must not guess.
    expect(preferredLocale({ addressed: 'es-MX', asked: 'fr' })).toBe('fr')
  })

  it('accepts every code the product actually ships', () => {
    // Derived rather than listed, so a fourth language is covered by existing.
    for (const { code } of LOCALES) {
      expect(preferredLocale({ addressed: code })).toBe(code)
      expect(isSupportedLocale(code)).toBe(true)
    }
  })
})

describe('storedLocale', () => {
  it('is the mail fallback and never consults a browser', () => {
    // `lib/auth/locale.ts` argues this at length: `Accept-Language` on a send is the
    // SENDER's browser, so using it would mail a Spanish-speaking relative in whatever
    // language the administrator's laptop asks for.
    expect(storedLocale('es')).toBe('es')
    expect(storedLocale(null)).toBe(BASE_LOCALE)
    expect(storedLocale('de')).toBe(BASE_LOCALE)
  })
})

describe('negotiateLocale', () => {
  it('reads a real Accept-Language header', () => {
    expect(negotiateLocale('es-MX,es;q=0.9,en;q=0.8')).toBe('es')
    expect(negotiateLocale('fr-CA,fr;q=0.9')).toBe('fr')
  })

  it('honours q-values rather than document order', () => {
    // A header is a RANKED list, not a list. Reading the first tag would serve German
    // readers English and Spanish readers German.
    expect(negotiateLocale('de;q=0.9,es;q=1.0')).toBe('es')
  })

  it('answers null rather than English for a header it cannot serve', () => {
    // The distinction matters to `proxy.ts`, which REDIRECTS on a negotiated answer: a
    // `null` means leave the address alone, and an `'en'` would mean redirect to `/en/…`
    // and straight back again.
    expect(negotiateLocale('de-DE,de;q=0.9')).toBeNull()
    expect(negotiateLocale(null)).toBeNull()
    expect(negotiateLocale('')).toBeNull()
  })
})
