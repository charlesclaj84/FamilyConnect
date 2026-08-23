import { describe, expect, it } from 'vitest'
import {
  META_CUSTOM_EVENTS, META_STANDARD_EVENTS, buildCustomData, isMetaEventName,
  isStandardEvent, requiresValue, valueFromCents, VIEW_CONTENT,
} from '@/lib/meta/events'

/**
 * THE PRIVACY BOUNDARY'S OWN TEST.
 *
 * `buildCustomData` is the allow-list every Meta payload passes through, so the cases that
 * matter most here are not the happy ones — they are the ones where an application object
 * is handed over by mistake. Those are checked by CONSTRUCTING the mistake: a `people` row,
 * a family, a gathering, each with the fields this product really holds, asserted to
 * produce nothing.
 *
 * Mutation-checked, as AGENTS.md §7b requires. Deleting the `ALLOWED_CUSTOM_DATA_KEYS`
 * filter turns the four privacy cases red; deleting the value/currency pairing turns two
 * more red; changing `valueFromCents` to `cents` turns the money cases red.
 */

describe('the event list', () => {
  it('accepts every name the product may send and nothing else', () => {
    for (const name of [...META_STANDARD_EVENTS, ...META_CUSTOM_EVENTS]) {
      expect(isMetaEventName(name)).toBe(true)
    }
    // Plausible near-misses. Each of these would silently fail to deduplicate against its
    // server counterpart, which is the failure this closed union exists to prevent.
    for (const wrong of ['Registration', 'purchase', 'CompletedRegistration', 'AddToCart', '']) {
      expect(isMetaEventName(wrong)).toBe(false)
    }
  })

  it('routes custom events away from fbq("track")', () => {
    // `CreateFamily` sent through `track` is reported by Meta as an unrecognised standard
    // event rather than as the custom event it is.
    expect(isStandardEvent('CreateFamily')).toBe(false)
    expect(isStandardEvent('SubscriptionRenewal')).toBe(false)
    expect(isStandardEvent('Purchase')).toBe(true)
    expect(isStandardEvent('CompleteRegistration')).toBe(true)
  })

  it('demands a value for every money event', () => {
    expect(requiresValue('Purchase')).toBe(true)
    expect(requiresValue('Subscribe')).toBe(true)
    expect(requiresValue('SubscriptionRenewal')).toBe(true)
    expect(requiresValue('CompleteRegistration')).toBe(false)
    expect(requiresValue('CreateFamily')).toBe(false)
  })

  it('offers only commercial descriptors for ViewContent', () => {
    // Every catalogue entry must be safe to send about any visitor. The test that matters
    // is that nothing here is derived from family data, which is structural — but the
    // names are pinned so that adding a page title by hand is a visible diff.
    expect(Object.values(VIEW_CONTENT).map((v) => v.name).sort()).toEqual(
      ['About', 'Features', 'Home', 'How It Works', 'Pricing', 'Why Us'],
    )
  })
})

describe('custom_data is an allow-list', () => {
  it('copies the permitted keys', () => {
    expect(buildCustomData({
      content_name: 'GENORRA Subscription',
      content_category: 'Acquisition',
      value: 5,
      currency: 'usd',
      order_id: 'ch_123',
      plan_id: 'standard',
      billing_interval: 'monthly',
    })).toEqual({
      content_name: 'GENORRA Subscription',
      content_category: 'Acquisition',
      value: 5,
      currency: 'USD',
      order_id: 'ch_123',
      plan_id: 'standard',
      billing_interval: 'monthly',
    })
  })

  it('drops a whole people row', () => {
    // The mistake this design expects somebody to make eventually: spreading a profile.
    const person = {
      id: 'p1', user_id: 'u1', family_code: 'ALPHA1',
      first_name: 'Martha', last_name: 'Allen', date_of_birth: '1948-03-02',
      primary_email: 'martha@example.com', phone: '+15125550134',
      address_line1: '19 Cypress Way', chapter_id: 'c1', avatar_url: 'https://…/a.jpg',
      membership_status: 'approved', permission_template_id: 't1',
    }
    expect(buildCustomData(person as never)).toEqual({})
  })

  it('drops a family, a gathering and a relationship', () => {
    expect(buildCustomData({ family_name: 'Allen', family_code: 'ALPHA1' } as never)).toEqual({})
    expect(buildCustomData({ title: 'Reunion 2027', budget_cents: 1_200_000 } as never)).toEqual({})
    expect(buildCustomData({ related_person_id: 'p2', link_kind: 'blood' } as never)).toEqual({})
  })

  it('drops a nested object hiding under a permitted key', () => {
    // An allow-listed KEY carrying a family record is the shape that would otherwise be
    // JSON.stringify'd straight onto the wire.
    expect(buildCustomData({
      content_name: { first_name: 'Sydnee', date_of_birth: '2014-06-01' },
      content_category: ['Charles', 'Jazzmon'],
    } as never)).toEqual({})
  })

  it('never sends half of a value/currency pair', () => {
    expect(buildCustomData({ value: 5 })).toEqual({})
    expect(buildCustomData({ currency: 'USD' })).toEqual({})
    expect(buildCustomData({ value: 5, currency: 'USD' })).toEqual({ value: 5, currency: 'USD' })
  })

  it('refuses a malformed currency or a negative value rather than guessing', () => {
    expect(buildCustomData({ value: 5, currency: 'dollars' })).toEqual({})
    expect(buildCustomData({ value: -5, currency: 'USD' })).toEqual({})
    expect(buildCustomData({ value: Number.NaN, currency: 'USD' })).toEqual({})
    expect(buildCustomData({ value: Number.POSITIVE_INFINITY, currency: 'USD' })).toEqual({})
  })

  it('survives null, undefined and a primitive', () => {
    expect(buildCustomData(null)).toEqual({})
    expect(buildCustomData(undefined)).toEqual({})
    expect(buildCustomData('purchase' as never)).toEqual({})
  })
})

describe('money', () => {
  it('converts cents to the major units Meta expects', () => {
    // The failure this prevents is a $5.00 subscription reported as a $500 conversion,
    // after which every value-optimised campaign in the account is bidding on it.
    expect(valueFromCents(500)).toBe(5)
    expect(valueFromCents(2_500)).toBe(25)
    expect(valueFromCents(1_234_567)).toBe(12_345.67)
    expect(valueFromCents(0)).toBe(0)
  })

  it('refuses a non-finite amount', () => {
    expect(valueFromCents(Number.NaN)).toBeNull()
    expect(valueFromCents(Number.POSITIVE_INFINITY)).toBeNull()
  })
})
