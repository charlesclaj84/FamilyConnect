import { describe, expect, it, vi } from 'vitest'
import { buildUserData, clientIpFromHeaders, hasMatchableIdentity } from '@/lib/meta/identity'
import { externalId, normalizeEmail, sha256 } from '@/lib/meta/hash'

/**
 * `user_data` is the field whose whole purpose is to describe a human being, so this is
 * where the privacy boundary is under the most pressure — every guide about Event Match
 * Quality says to send more.
 *
 * Mutation-checked: hashing `fbp` turns the plain-text case red; widening the input type to
 * a spread turns the four privacy cases red; removing the `hasMatchableIdentity` check on
 * `em`/`external_id` turns the matchability cases red.
 */

const HOLDER = {
  userId: '9f1c1c8e-0000-4000-8000-000000000001',
  email: 'Martha@Example.com',
  phone: '+15125550134',
  firstName: 'Martha',
  lastName: "O'Connor",
  city: 'San Antonio',
  state: 'TX',
  postalCode: '78701-1234',
  country: 'US',
}

describe('the permitted nine fields', () => {
  it('are hashed and sent under Meta’s key names', () => {
    const data = buildUserData(HOLDER, null)
    expect(Object.keys(data).sort()).toEqual(
      ['country', 'ct', 'em', 'external_id', 'fn', 'ln', 'ph', 'st', 'zp'],
    )
    expect(data.em).toBe(sha256(normalizeEmail(HOLDER.email)))
    expect(data.external_id).toBe(externalId(HOLDER.userId))
    for (const value of Object.values(data)) expect(value).toMatch(/^[a-f0-9]{64}$/)
  })

  it('omit what is absent rather than sending an empty digest', () => {
    const data = buildUserData({ userId: HOLDER.userId, email: null, firstName: '' }, null)
    expect(Object.keys(data)).toEqual(['external_id'])
  })
})

describe('what can never reach Meta', () => {
  it('drops every private field on a whole people row', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {})
    const person = {
      // The three permitted values, so the assertion is about what is DROPPED rather
      // than about the call producing nothing at all.
      userId: HOLDER.userId,
      email: 'martha@example.com',
      firstName: 'Martha',
      // Everything a `people` row really carries.
      date_of_birth: '1948-03-02',
      family_code: 'ALPHA1',
      family_name: 'Allen',
      gender: 'female',
      avatar_url: 'https://example.com/martha.jpg',
      bio: 'Grandmother of eleven.',
      address_line1: '19 Cypress Way',
      children: [{ first_name: 'Sydnee', date_of_birth: '2014-06-01' }],
      relationships: [{ related_person_id: 'p2', link_kind: 'blood' }],
      password: 'hunter2',
    }

    const data = buildUserData(person as never, null)

    expect(Object.keys(data).sort()).toEqual(['em', 'external_id', 'fn'])
    // Nothing private survives in ANY value, under any key — the digests are of the
    // permitted three and of nothing else.
    const serialised = JSON.stringify(data)
    for (const secret of [
      '1948-03-02', 'ALPHA1', 'Allen', 'female', 'martha.jpg', 'Grandmother',
      'Cypress', 'Sydnee', '2014-06-01', 'blood', 'hunter2',
    ]) {
      expect(serialised).not.toContain(secret)
      expect(serialised).not.toContain(sha256(secret))
    }
    // And the mistake is reported rather than silently absorbed.
    expect(spy).toHaveBeenCalledOnce()
    spy.mockRestore()
  })

  it('has no field for a date of birth even when one is offered', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {})
    // Meta accepts `db` and `ge`. This product does not send them: a birthday is collected
    // so relatives can wish each other happy birthday, and that purpose does not extend to
    // advertising. Its absence is a decision, pinned here so it is not "fixed" for match
    // quality.
    const data = buildUserData({ userId: 'u1', dateOfBirth: '1948-03-02', gender: 'f' } as never, null)
    expect(data.db).toBeUndefined()
    expect(data.ge).toBeUndefined()
    spy.mockRestore()
  })

  it('drops a child’s record entirely', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {})
    const child = {
      first_name: 'Sydnee', last_name: 'Allen', date_of_birth: '2014-06-01',
      user_id: null, family_code: 'ALPHA1', age: 12,
    }
    // No `userId`, no `email` — nothing on this object is a permitted field, so nothing
    // survives. A minor has no account and is never a customer.
    expect(buildUserData(child as never, null)).toEqual({})
    spy.mockRestore()
  })

  it('survives null and a primitive without inventing fields', () => {
    expect(buildUserData(null, null)).toEqual({})
    expect(buildUserData(undefined, undefined)).toEqual({})
    expect(buildUserData('martha@example.com' as never, null)).toEqual({})
  })
})

describe('the four plain-text signals', () => {
  it('are NEVER hashed', () => {
    // Hashing these does not error. It produces a valid string that matches no browser and
    // no click, and the only symptom is match quality quietly failing to improve.
    const fbp = 'fb.1.1596403881668.1116446470'
    const fbc = 'fb.1.1554763741205.IwAR2F4dbP0l7Mn1IawQQGCINEz7PYXQvwjNwB'
    const data = buildUserData(null, {
      clientIpAddress: '203.0.113.9',
      clientUserAgent: 'Mozilla/5.0',
      fbp,
      fbc,
    })
    expect(data).toEqual({
      client_ip_address: '203.0.113.9',
      client_user_agent: 'Mozilla/5.0',
      fbp,
      fbc,
    })
  })

  it('drop a malformed fbp or fbc rather than sending a shape Meta reports as an error', () => {
    const data = buildUserData(null, {
      fbp: 'not-an-fbp',
      fbc: '1554763741205.IwAR2F4',
      clientIpAddress: '203.0.113.9',
    })
    expect(data.fbp).toBeUndefined()
    expect(data.fbc).toBeUndefined()
    expect(data.client_ip_address).toBe('203.0.113.9')
  })
})

describe('matchability', () => {
  it('is true for anything Meta can actually join on', () => {
    expect(hasMatchableIdentity({ em: 'x' })).toBe(true)
    expect(hasMatchableIdentity({ external_id: 'x' })).toBe(true)
    expect(hasMatchableIdentity({ fbp: 'fb.1.1.1' })).toBe(true)
    expect(hasMatchableIdentity({ fbc: 'fb.1.1.1' })).toBe(true)
  })

  it('is false for an IP and a user agent alone', () => {
    // Too coarse to identify anybody. Sending it files an unattributable event and lowers
    // the dataset's reported match rate for no gain.
    expect(hasMatchableIdentity({ client_ip_address: '203.0.113.9', client_user_agent: 'x' }))
      .toBe(false)
    expect(hasMatchableIdentity({})).toBe(false)
  })
})

describe('the client IP', () => {
  const withHeaders = (init: Record<string, string>) => clientIpFromHeaders(new Headers(init))

  it('takes the first entry of the forwarding chain', () => {
    // The rest are the proxies in between; sending one attributes every conversion to a
    // data centre.
    expect(withHeaders({ 'x-forwarded-for': '203.0.113.9, 70.41.3.18, 150.172.238.178' }))
      .toBe('203.0.113.9')
  })

  it('falls back to x-real-ip, and handles IPv6', () => {
    expect(withHeaders({ 'x-real-ip': '2001:db8::8a2e:370:7334' })).toBe('2001:db8::8a2e:370:7334')
  })

  it('drops loopback, which is what a development server reports', () => {
    expect(withHeaders({ 'x-forwarded-for': '::1' })).toBeNull()
    expect(withHeaders({ 'x-forwarded-for': '127.0.0.1' })).toBeNull()
  })

  it('drops a malformed value rather than sending it', () => {
    expect(withHeaders({ 'x-forwarded-for': 'unknown' })).toBeNull()
    expect(withHeaders({})).toBeNull()
  })
})
