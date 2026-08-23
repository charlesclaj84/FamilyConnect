import { describe, expect, it } from 'vitest'
import {
  CONSENT_COOKIE_MAX_AGE_SECONDS, MARKETING_CONSENT_COOKIE, consentCookieString, hasChosen,
  parseConsent, readConsentFromCookieHeader, resolveConsent,
} from '@/lib/consent'

/**
 * One decision, read by the Pixel and by every Conversions API call. The case that matters
 * most is the DEFAULT, because it is what a deployment does before anybody has chosen —
 * and getting it backwards means collecting from people who never agreed.
 *
 * Mutation-checked: flipping the fallback in `resolveConsent` to ignore its argument turns
 * the default cases red; treating an unknown value as granted turns the tamper case red.
 */

describe('what counts as a choice', () => {
  it('recognises the two values this product writes', () => {
    expect(parseConsent('granted')).toBe('granted')
    expect(parseConsent('denied')).toBe('denied')
  })

  it('treats anything else as no choice at all', () => {
    // The cookie is client-writable, so all of these are values a visitor can set. None of
    // them may resolve to 'granted'.
    for (const bad of ['GRANTED', 'yes', 'true', '1', '', null, undefined, 'granted; denied']) {
      expect(parseConsent(bad)).toBeNull()
      expect(resolveConsent(bad, 'denied')).toBe('denied')
    }
  })

  it('distinguishes "chose to decline" from "has not chosen"', () => {
    // The banner turns on this: a visitor who declined must not be asked again on the next
    // page, and a visitor who has not chosen must be.
    expect(hasChosen('denied')).toBe(true)
    expect(hasChosen('granted')).toBe(true)
    expect(hasChosen(null)).toBe(false)
    expect(hasChosen('maybe')).toBe(false)
  })
})

describe('the default applies only where nothing was stored', () => {
  it('never overrides a real choice', () => {
    expect(resolveConsent('denied', 'granted')).toBe('denied')
    expect(resolveConsent('granted', 'denied')).toBe('granted')
  })

  it('is what an unconfigured deployment falls back to', () => {
    expect(resolveConsent(null, 'denied')).toBe('denied')
    expect(resolveConsent(null, 'granted')).toBe('granted')
  })
})

describe('reading the cookie header', () => {
  it('finds the value among others', () => {
    expect(readConsentFromCookieHeader(
      `theme=dark; ${MARKETING_CONSENT_COOKIE}=granted; sb-access-token=abc`,
    )).toBe('granted')
  })

  it('is not fooled by a cookie whose name merely contains ours', () => {
    expect(readConsentFromCookieHeader(`not_${MARKETING_CONSENT_COOKIE}=granted`)).toBeNull()
    expect(readConsentFromCookieHeader(`${MARKETING_CONSENT_COOKIE}_old=granted`)).toBeNull()
  })

  it('answers null for an absent or empty header', () => {
    expect(readConsentFromCookieHeader('')).toBeNull()
    expect(readConsentFromCookieHeader(null)).toBeNull()
    expect(readConsentFromCookieHeader('theme=dark')).toBeNull()
  })
})

describe('the cookie written', () => {
  it('is Lax, path-wide, and expires', () => {
    const cookie = consentCookieString('granted', true)
    expect(cookie).toContain(`${MARKETING_CONSENT_COOKIE}=granted`)
    expect(cookie).toContain('path=/')
    // Lax rather than Strict: an ad click is a cross-site navigation, and Strict withholds
    // the cookie on exactly the request where the Pixel needs to know whether it may fire.
    expect(cookie).toContain('samesite=lax')
    expect(cookie).toContain(`max-age=${CONSENT_COOKIE_MAX_AGE_SECONDS}`)
    expect(cookie).toContain('secure')
  })

  it('omits Secure on plain HTTP, or the banner cannot be dismissed in development', () => {
    expect(consentCookieString('denied', false)).not.toContain('secure')
  })

  it('lasts six months rather than forever', () => {
    // A consent that never expires is one the visitor cannot practically revisit.
    expect(CONSENT_COOKIE_MAX_AGE_SECONDS).toBe(60 * 60 * 24 * 182)
  })
})
