import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import {
  consentDefault, metaClientConfig, metaEventSourceUrl, metaMode, metaPixelId,
  metaTestEventCode,
} from '@/lib/meta/config'

/**
 * "Development environments do not send production events", and "do not accidentally leave
 * test mode enabled in production", asserted rather than left to a deployment checklist.
 *
 * Both failures are silent and expensive in opposite directions: localhost events pollute a
 * dataset that campaigns are optimised against, and a release that kept `test_event_code`
 * sends every real conversion to the Test Events tab, where it feeds neither optimisation
 * nor reporting.
 *
 * `metaMode()` is deliberately resolved per call rather than captured at import, which is
 * what makes these cases possible at all — a module constant would freeze whichever
 * environment loaded the module first.
 *
 * Mutation-checked: making `metaTestEventCode()` return the raw variable turns the
 * production case red; removing the `VERCEL_ENV` test turns the laptop cases red.
 */

const KEYS = [
  'META_PIXEL_ID', 'META_CONVERSIONS_API_ACCESS_TOKEN', 'META_TEST_EVENT_CODE',
  'META_CONSENT_DEFAULT', 'VERCEL_ENV', 'NEXT_PUBLIC_SITE_URL',
] as const

let saved: Record<string, string | undefined>

beforeEach(() => {
  saved = Object.fromEntries(KEYS.map((k) => [k, process.env[k]]))
  for (const k of KEYS) delete process.env[k]
})

afterEach(() => {
  for (const [k, v] of Object.entries(saved)) {
    if (v === undefined) delete process.env[k]
    else process.env[k] = v
  }
})

describe('a developer laptop', () => {
  it('sends nothing, even with a Pixel id configured', () => {
    process.env.META_PIXEL_ID = '1234567890'
    expect(metaMode()).toBe('off')
    expect(metaClientConfig()).toBeNull()
  })

  it('sends nothing with no configuration at all', () => {
    expect(metaMode()).toBe('off')
    expect(metaPixelId()).toBeNull()
  })

  it('treats an empty string exactly as an unset variable', () => {
    // A blank value in a dashboard is the ordinary way a variable gets "removed", and
    // `''` is truthy enough to slip past a bare existence check.
    process.env.META_PIXEL_ID = '   '
    expect(metaPixelId()).toBeNull()
    expect(metaMode()).toBe('off')
  })
})

describe('a QA or preview deployment', () => {
  it('is off until a test event code is set — that is the deliberate opt-in', () => {
    process.env.META_PIXEL_ID = '1234567890'
    process.env.VERCEL_ENV = 'preview'
    expect(metaMode()).toBe('off')

    process.env.META_TEST_EVENT_CODE = 'TEST12345'
    expect(metaMode()).toBe('test')
    expect(metaTestEventCode()).toBe('TEST12345')
  })
})

describe('production', () => {
  beforeEach(() => {
    process.env.META_PIXEL_ID = '1234567890'
    process.env.VERCEL_ENV = 'production'
  })

  it('sends real events', () => {
    expect(metaMode()).toBe('production')
    expect(metaClientConfig()).toEqual({ pixelId: '1234567890', mode: 'production' })
  })

  it('IGNORES a test event code that was left set', () => {
    // The failure this prevents: a release ships with test mode still on, every conversion
    // lands in the Test Events tab, and nothing anywhere reports a problem.
    process.env.META_TEST_EVENT_CODE = 'TEST12345'
    expect(metaMode()).toBe('production')
    expect(metaTestEventCode()).toBeNull()
  })
})

describe('event_source_url', () => {
  beforeEach(() => {
    process.env.META_PIXEL_ID = '1234567890'
    process.env.VERCEL_ENV = 'production'
  })

  it('is absolute and built from configuration, never a request header', () => {
    // `Host` is attacker-controlled, and what it would control here is the hostname Meta
    // attributes our conversions to.
    expect(metaEventSourceUrl('/pricing')).toBe('https://genorra.com/pricing')
    expect(metaEventSourceUrl('pricing')).toBe('https://genorra.com/pricing')
    expect(metaEventSourceUrl('/')).toBe('https://genorra.com/')
    expect(metaEventSourceUrl('')).toBe('https://genorra.com/')
  })

  it('DROPS the query string and the fragment', () => {
    // A member can arrive at any screen with anything in the query — a search term, an
    // invitation token — and `event_source_url` is stored verbatim by Meta.
    expect(metaEventSourceUrl('/invite/TOKEN?q=martha+allen#top'))
      .toBe('https://genorra.com/invite/TOKEN')
  })
})

describe('the consent default', () => {
  it('is denied unless the deployment says otherwise', () => {
    expect(consentDefault()).toBe('denied')
    process.env.META_CONSENT_DEFAULT = 'yes'
    expect(consentDefault()).toBe('denied')
    process.env.META_CONSENT_DEFAULT = 'GRANTED'
    expect(consentDefault()).toBe('denied')
  })

  it('honours an explicit opt-out configuration', () => {
    process.env.META_CONSENT_DEFAULT = 'granted'
    expect(consentDefault()).toBe('granted')
  })
})
