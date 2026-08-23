import { describe, expect, it } from 'vitest'
import { EVENT_ID_PREFIX, metaEventId, renewalEventId } from '@/lib/meta/event-id'

/**
 * Deduplication and idempotency both rest entirely on this function, and both fail
 * silently: a mismatched id counts one conversion twice, and a repeated id for two genuine
 * events reports one and discards the other.
 *
 * Mutation-checked: removing the event name from the hash input turns the "two events, one
 * key" case red; making the id random turns every determinism case red; keying a renewal on
 * the subscription instead of the transaction turns the renewal case red.
 */

const ACCOUNT = '9f1c1c8e-0000-4000-8000-000000000001'
const TRANSACTION = 'ch_3PqR2sT1uV'

describe('the same business fact always yields the same id', () => {
  it('is deterministic across calls — a page refresh cannot produce a second conversion', () => {
    expect(metaEventId('CompleteRegistration', ACCOUNT)).toBe(metaEventId('CompleteRegistration', ACCOUNT))
  })

  it('is deterministic for a redelivered payment webhook', () => {
    // The provider's retry sends identical bytes. Five deliveries, one id, one conversion.
    const ids = Array.from({ length: 5 }, () => metaEventId('Purchase', TRANSACTION))
    expect(new Set(ids).size).toBe(1)
  })

  it('separates two events that share a key', () => {
    // A founder's account id keys both their registration and — were the key naive — their
    // family. Identical ids would make Meta discard the second event as a duplicate.
    expect(metaEventId('CompleteRegistration', ACCOUNT)).not.toBe(metaEventId('CreateFamily', ACCOUNT))
    expect(metaEventId('Purchase', TRANSACTION)).not.toBe(metaEventId('Subscribe', TRANSACTION))
  })

  it('separates two keys under one event', () => {
    expect(metaEventId('Purchase', 'ch_1')).not.toBe(metaEventId('Purchase', 'ch_2'))
  })
})

describe('what the id reveals', () => {
  it('carries a readable prefix and a digest, never the key', () => {
    const id = metaEventId('CreateFamily', 'ALPHA1')!
    expect(id).toMatch(/^family_[a-f0-9]{32}$/)
    // A family's join code must not appear in a third party's event log.
    expect(id).not.toContain('ALPHA1')
  })

  it('uses the documented prefix for every keyed event', () => {
    for (const [event, prefix] of Object.entries(EVENT_ID_PREFIX)) {
      expect(metaEventId(event as keyof typeof EVENT_ID_PREFIX, 'k')).toMatch(
        new RegExp(`^${prefix}_[a-f0-9]{32}$`),
      )
    }
  })

  it('never leaks an account id', () => {
    expect(metaEventId('CompleteRegistration', ACCOUNT)).not.toContain(ACCOUNT)
  })
})

describe('an absent key', () => {
  it('yields null rather than the digest of nothing', () => {
    // `<prefix>_e3b0c442…` would be one shared id that made every such event a duplicate
    // of the first one ever sent.
    expect(metaEventId('Purchase', '')).toBeNull()
    expect(metaEventId('Purchase', '   ')).toBeNull()
    expect(metaEventId('Purchase', null)).toBeNull()
    expect(metaEventId('Purchase', undefined)).toBeNull()
  })
})

describe('renewals', () => {
  it('key on the transaction, so month two is not a duplicate of month one', () => {
    const january = renewalEventId('ch_january')
    const february = renewalEventId('ch_february')
    expect(january).not.toBe(february)
    expect(january).toMatch(/^renewal_[a-f0-9]{32}$/)
  })

  it('are idempotent per charge', () => {
    expect(renewalEventId('ch_january')).toBe(renewalEventId('ch_january'))
  })

  it('are never confused with the acquisition events for the same charge', () => {
    expect(renewalEventId(TRANSACTION)).not.toBe(metaEventId('Purchase', TRANSACTION))
    expect(renewalEventId(TRANSACTION)).not.toBe(metaEventId('Subscribe', TRANSACTION))
  })
})

describe('the Pixel and the Conversions API agree', () => {
  it('because both read the same function for the same fact', () => {
    // This is the whole deduplication contract, stated as a test: the id the server sends
    // as `event_id` and the id the browser fires as `eventID` are one call apart.
    const serverSide = metaEventId('CompleteRegistration', ACCOUNT)
    const browserSide = metaEventId('CompleteRegistration', ACCOUNT)
    expect(browserSide).toBe(serverSide)
    expect(browserSide).not.toBeNull()
  })
})
