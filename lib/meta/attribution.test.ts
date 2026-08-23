import { describe, expect, it } from 'vitest'
import {
  captureTouch, fbcFromFbclid, forConsent, isMeaningfulTouch, isValidFbc, isValidFbp,
  mergeTouch, parseAttribution, resolveFbc, serializeAttribution,
} from '@/lib/meta/attribution'

/**
 * Mutation-checked: making `mergeTouch` overwrite `first` turns the first-touch cases red;
 * dropping the `isMeaningfulTouch` guard turns the "direct navigation" case red; changing
 * `fbcFromFbclid` to seconds turns the millisecond case red.
 */

const AD_CLICK =
  'https://genorra.com/?utm_source=facebook&utm_medium=paid_social'
  + '&utm_campaign=reunion_2027&utm_content=carousel_a&utm_term=family+reunion'
  + '&fbclid=IwAR2F4dbP0l7Mn1IawQQGCINEz7PYXQvwjNwB'

describe('reading an arrival', () => {
  it('captures every UTM parameter, the landing path and the click id', () => {
    const touch = captureTouch(AD_CLICK, 'https://www.facebook.com/', 1_700_000_000_000)
    expect(touch).toEqual({
      at: 1_700_000_000_000,
      utm_source: 'facebook',
      utm_medium: 'paid_social',
      utm_campaign: 'reunion_2027',
      utm_content: 'carousel_a',
      utm_term: 'family reunion',
      fbclid: 'IwAR2F4dbP0l7Mn1IawQQGCINEz7PYXQvwjNwB',
      landing_path: '/',
      referrer_host: 'www.facebook.com',
    })
  })

  it('keeps the referrer HOST and discards the rest of the referring URL', () => {
    // The path and query belong to somebody else's site and can hold anything at all.
    const touch = captureTouch('https://genorra.com/pricing', 'https://mail.example.com/inbox/thread/9?q=allen+family', 1)
    expect(touch.referrer_host).toBe('mail.example.com')
    expect(JSON.stringify(touch)).not.toContain('allen')
  })

  it('keeps the landing PATH and never the query string', () => {
    const touch = captureTouch('https://genorra.com/invite/SECRET-TOKEN?q=martha', null, 1)
    expect(touch.landing_path).toBe('/invite/SECRET-TOKEN')
    expect(JSON.stringify(touch)).not.toContain('q=martha')
  })

  it('caps every field, so a crafted URL cannot inflate the cookie', () => {
    const touch = captureTouch(`https://genorra.com/?utm_campaign=${'x'.repeat(5_000)}`, null, 1)
    expect(touch.utm_campaign!.length).toBe(200)
  })

  it('records a direct visit as an ordinary page load, not as "direct"', () => {
    const touch = captureTouch('https://genorra.com/', '', 1)
    expect(touch.referrer_host).toBeUndefined()
    expect(isMeaningfulTouch(touch)).toBe(false)
  })

  it('survives an unparseable URL and an unparseable referrer', () => {
    expect(captureTouch('not a url', 'also not a url', 5)).toEqual({ at: 5, landing_path: '/' })
  })
})

describe('first touch is immutable', () => {
  const first = captureTouch(AD_CLICK, 'https://www.facebook.com/', 1_000)
  const later = captureTouch('https://genorra.com/?utm_source=google&utm_medium=cpc', null, 2_000)

  it('keeps the arrival that FOUND this person', () => {
    // Rewriting it on every visit is the commonest attribution bug there is: every
    // conversion then reports as coming from a brand search, and the campaign that did the
    // work reports zero.
    const merged = mergeTouch({ first, last: first }, later)
    expect(merged.first.utm_source).toBe('facebook')
    expect(merged.last.utm_source).toBe('google')
  })

  it('takes the very first arrival as both when nothing is stored', () => {
    const merged = mergeTouch(null, first)
    expect(merged.first).toBe(first)
    expect(merged.last).toBe(first)
  })

  it('does NOT let an ordinary navigation overwrite the last touch', () => {
    // Opening the dashboard must not replace the campaign that brought somebody back with
    // an empty internal navigation.
    const dashboard = captureTouch('https://genorra.com/dashboard', null, 3_000)
    const merged = mergeTouch({ first, last: later }, dashboard)
    expect(merged.last.utm_source).toBe('google')
  })
})

describe('consent decides what is remembered', () => {
  const touch = captureTouch(AD_CLICK, null, 1_000)

  it('keeps our own UTM labelling when consent is refused', () => {
    const stripped = forConsent(touch, false)
    expect(stripped.utm_campaign).toBe('reunion_2027')
    expect(stripped.utm_source).toBe('facebook')
  })

  it('strips Meta’s click identifier when consent is refused', () => {
    // `fbclid` is minted by Meta to identify a person to Meta, which is a different kind of
    // thing from a label we put on our own link.
    expect(forConsent(touch, false).fbclid).toBeUndefined()
    expect(forConsent(touch, true).fbclid).toBe('IwAR2F4dbP0l7Mn1IawQQGCINEz7PYXQvwjNwB')
  })
})

describe('the cookie round-trips', () => {
  it('survives serialize → parse', () => {
    const record = mergeTouch(null, captureTouch(AD_CLICK, 'https://www.facebook.com/', 7))
    expect(parseAttribution(serializeAttribution(record))).toEqual(record)
  })

  it('refuses anything it cannot make a record out of', () => {
    // The cookie is client-writable, so every one of these is a value a visitor can set.
    expect(parseAttribution(null)).toBeNull()
    expect(parseAttribution('')).toBeNull()
    expect(parseAttribution('not json')).toBeNull()
    expect(parseAttribution(encodeURIComponent('{"first":{}}'))).toBeNull()
    expect(parseAttribution(encodeURIComponent('[1,2,3]'))).toBeNull()
    expect(parseAttribution(encodeURIComponent('{"first":{"at":"soon"},"last":{"at":1}}'))).toBeNull()
  })
})

describe('fbp and fbc', () => {
  it('accept Meta’s documented shape', () => {
    expect(isValidFbp('fb.1.1596403881668.1116446470')).toBe(true)
    expect(isValidFbc('fb.1.1554763741205.IwAR2F4dbP0l7Mn1IawQQGCINEz7PYXQvwjNwB')).toBe(true)
  })

  it('reject anything else — both cookies are client-writable', () => {
    for (const bad of ['', 'fb.1.1596403881668', 'x.1.1.1', '1596403881668.1116446470', 'fb..1.1']) {
      expect(isValidFbp(bad)).toBe(false)
      expect(isValidFbc(bad)).toBe(false)
    }
    expect(isValidFbp(`fb.1.1.${'x'.repeat(400)}`)).toBe(false)
  })

  it('build fbc from an fbclid in Meta’s exact format', () => {
    // `fb.<subdomainIndex>.<creationTimeMs>.<fbclid>`, subdomain index 1 for a value
    // generated without storing a cookie.
    expect(fbcFromFbclid('IwAR2F4', 1_554_763_741_205))
      .toBe('fb.1.1554763741205.IwAR2F4')
  })

  it('use MILLISECONDS — seconds would date the click to 1970', () => {
    const built = fbcFromFbclid('IwAR2F4', 1_554_763_741_205)!
    expect(built.split('.')[2]).toHaveLength(13)
  })

  it('NEVER invent a click id', () => {
    // Fabricating one would attach our conversions to somebody else's click.
    expect(fbcFromFbclid(null, Date.now())).toBeNull()
    expect(fbcFromFbclid('', Date.now())).toBeNull()
    expect(fbcFromFbclid('   ', Date.now())).toBeNull()
    expect(fbcFromFbclid('IwAR2F4', 0)).toBeNull()
    expect(fbcFromFbclid('IwAR2F4', Number.NaN)).toBeNull()
  })
})

describe('resolveFbc', () => {
  const cookie = 'fb.2.1554763741205.FROM_COOKIE'

  it('prefers the cookie the Pixel wrote', () => {
    // The Pixel wrote it with the subdomain index and creation time that actually applied.
    expect(resolveFbc(cookie, { fbclid: 'REMEMBERED', at: 1_700_000_000_000 })).toBe(cookie)
  })

  it('falls back to a remembered fbclid, dated when it was SEEN', () => {
    // Not "now" — or the click ages backwards to zero every time an event is sent, which
    // would keep it inside every attribution window forever.
    expect(resolveFbc(null, { fbclid: 'REMEMBERED', at: 1_700_000_000_000 }))
      .toBe('fb.1.1700000000000.REMEMBERED')
  })

  it('falls back past a malformed cookie', () => {
    expect(resolveFbc('garbage', { fbclid: 'REMEMBERED', at: 1_700_000_000_000 }))
      .toBe('fb.1.1700000000000.REMEMBERED')
  })

  it('answers null when there was no click at all', () => {
    expect(resolveFbc(null, null)).toBeNull()
    expect(resolveFbc(null, { at: 1_700_000_000_000 })).toBeNull()
  })
})
