import { createHash } from 'node:crypto'
import { describe, expect, it } from 'vitest'
import {
  externalId, normalizeCity, normalizeCountry, normalizeEmail, normalizeName,
  normalizePhone, normalizeState, normalizeZip, sha256,
} from '@/lib/meta/hash'

/**
 * Every failure this file guards against is SILENT: a wrongly normalised value hashes to a
 * perfectly valid digest that matches nobody, the event is accepted, and the only symptom
 * is match quality that never improves. So the assertions are against Meta's stated rules
 * rather than against "does it return a string".
 *
 * Mutation-checked: dropping `.toLowerCase()` from `normalizeEmail`, dropping the HEX_64
 * guard from `sha256`, or dropping the punctuation strip from `normalizeName` each turns a
 * different case red.
 */

const digestOf = (value: string) => createHash('sha256').update(value, 'utf8').digest('hex')

describe('sha256', () => {
  it('produces lowercase hex of the normalised value', () => {
    expect(sha256('martha@example.com')).toBe(digestOf('martha@example.com'))
    expect(sha256('martha@example.com')).toMatch(/^[a-f0-9]{64}$/)
  })

  it('NEVER hashes twice', () => {
    // Double-hashing is the other silent failure in this class: a digest of a digest is a
    // valid-looking value that matches nobody. These helpers are exported, so a caller
    // hashing before handing over is a real possibility.
    const once = sha256('martha@example.com')!
    expect(sha256(once)).toBe(once)
    expect(sha256(once.toUpperCase())).toBe(once)
  })

  it('omits an empty value rather than hashing the empty string', () => {
    // e3b0c442… is the digest of '' — a real-looking value that every event omitting that
    // field would share, which is a matching signal pointing at nobody.
    expect(sha256('')).toBeNull()
    expect(sha256('   ')).toBeNull()
    expect(sha256(null)).toBeNull()
    expect(sha256(undefined)).toBeNull()
  })
})

describe('normalisation follows Meta’s rules', () => {
  it('email: trims and lowercases', () => {
    expect(normalizeEmail('  Martha@Example.COM ')).toBe('martha@example.com')
  })

  it('email: refuses something that is not an address', () => {
    expect(normalizeEmail('Martha Allen')).toBeNull()
    expect(normalizeEmail('')).toBeNull()
  })

  it('phone: digits only, country code kept', () => {
    // Profiles store E.164 (lib/phone-format.ts), so this is the ordinary case.
    expect(normalizePhone('+15125550134')).toBe('15125550134')
    expect(normalizePhone('+44 20 7946 0958')).toBe('442079460958')
  })

  it('phone: a bare ten-digit US number gains its country code', () => {
    expect(normalizePhone('(512) 555-0134')).toBe('15125550134')
    expect(normalizePhone('512.555.0134')).toBe('15125550134')
  })

  it('phone: leading zeros are stripped and a too-short number is dropped', () => {
    expect(normalizePhone('0015125550134')).toBe('15125550134')
    expect(normalizePhone('555013')).toBeNull()
  })

  it('names: lowercase, punctuation and spaces removed, accents KEPT', () => {
    expect(normalizeName("O'Connor")).toBe('oconnor')
    expect(normalizeName('Smith-Jones')).toBe('smithjones')
    expect(normalizeName('  Martha  ')).toBe('martha')
    expect(normalizeName('J. R.')).toBe('jr')
    // Folding the accent would produce a different digest from the one Meta's own hasher
    // produces for the same name — the opposite of what lib/person-search.ts wants.
    expect(normalizeName('José')).toBe('josé')
  })

  it('city: lowercase, no spaces', () => {
    expect(normalizeCity('San Antonio')).toBe('sanantonio')
  })

  it('state: two letters only, never an expanded name', () => {
    expect(normalizeState('TX')).toBe('tx')
    expect(normalizeState(' tx ')).toBe('tx')
    // A fifty-entry expansion table would have to be right about territories and about
    // every non-US subdivision, and a wrong one matches confidently on the wrong place.
    expect(normalizeState('Texas')).toBeNull()
  })

  it('zip: US codes truncated to five, spaces and dashes removed', () => {
    expect(normalizeZip('78701-1234')).toBe('78701')
    expect(normalizeZip('78701')).toBe('78701')
    // Non-numeric postcodes are not truncated — 'sw1a1aa' is a whole UK postcode.
    expect(normalizeZip('SW1A 1AA')).toBe('sw1a1aa')
  })

  it('country: ISO alpha-2 only', () => {
    expect(normalizeCountry('US')).toBe('us')
    expect(normalizeCountry('United States')).toBeNull()
  })
})

describe('external_id', () => {
  it('is the hashed account id, stable across calls', () => {
    const id = '9f1c1c8e-0000-4000-8000-000000000001'
    expect(externalId(id)).toBe(digestOf(id))
    expect(externalId(id)).toBe(externalId(id))
  })

  it('is absent rather than empty when there is no account', () => {
    expect(externalId(null)).toBeNull()
    expect(externalId('')).toBeNull()
  })
})
