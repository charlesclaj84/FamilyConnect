import { describe, expect, it } from 'vitest'
import { PHONE_COLUMNS, formatPhone, normalizePhone } from '@/lib/phone-format'
import { pickProfileColumns } from '@/lib/profile-columns'

/**
 * Phone normalisation and display. Pure, so it belongs here (AGENTS.md §7b).
 *
 * As with `name-case`, the important assertions are the REFUSALS TO GUESS. A number this
 * module does not recognise must come back exactly as typed, because the failure mode of
 * guessing is a stored number that cannot be dialled and looks perfectly fine — and nobody
 * finds that until they try to phone a relative.
 *
 * CHECKED BY MUTATION (2026-08-17). Four, all tripped:
 *   * the `startsWith('+')` branch removed             2 failed — a +44 number becomes a US
 *                                                       one, which is the worst single
 *                                                       outcome available here
 *   * the 10-digit test widened to `>= 10`             3 failed
 *   * the 11-digit `startsWith('1')` check dropped     1 failed
 *   * `formatPhone`'s `d.length === 10` check dropped  1 failed
 */

describe('normalizePhone', () => {
  it('turns every US rendering of one number into the same E.164 string', () => {
    // THE WHOLE POINT: four inputs, one stored value, so they compare equal.
    for (const input of [
      '5125550134', '512-555-0134', '(512) 555-0134', '512.555.0134',
      '512 555 0134', ' 5125550134 ', '1-512-555-0134', '15125550134',
      '+1 (512) 555-0134', '+15125550134',
    ]) {
      expect(normalizePhone(input)).toBe('+15125550134')
    }
  })

  it('trusts a stated country code and does not re-decide it', () => {
    // A +44 number reinterpreted as US is the sharpest failure this module can produce.
    expect(normalizePhone('+44 20 7946 0958')).toBe('+442079460958')
    expect(normalizePhone('+234 802 123 4567')).toBe('+2348021234567')
  })

  it('leaves an unrecognised number exactly as typed', () => {
    // A 7-digit local number, an extension, a partial entry, an international number with
    // no `+`. Every one of these is a value a real person really enters.
    expect(normalizePhone('555-0134')).toBe('555-0134')
    expect(normalizePhone('512-555-0134 x27')).toBe('512-555-0134 x27')
    expect(normalizePhone('512555')).toBe('512555')
    expect(normalizePhone('44 20 7946 0958')).toBe('44 20 7946 0958')
  })

  it('does not treat an 11-digit non-US number as US', () => {
    // 11 digits only becomes E.164 when it starts with the country code it claims.
    expect(normalizePhone('25125550134')).toBe('25125550134')
  })

  it('accepts a number that is not validated, deliberately', () => {
    // FORMATTING, NOT VALIDATION. An unassignable area code still saves — refusing one is a
    // decision about whether somebody can save their profile at all.
    expect(normalizePhone('0005550134')).toBe('+10005550134')
    expect(normalizePhone('1115550134')).toBe('+11115550134')
  })

  it('passes null, undefined and empty through', () => {
    expect(normalizePhone(null)).toBeNull()
    expect(normalizePhone(undefined)).toBeUndefined()
    expect(normalizePhone('')).toBe('')
    expect(normalizePhone('   ')).toBe('')
  })

  it('is idempotent', () => {
    // It runs on every profile save, so a second save must not change a stored value.
    const once = normalizePhone('(512) 555-0134')!
    expect(normalizePhone(once)).toBe(once)
    expect(normalizePhone(normalizePhone('+44 20 7946 0958')!)).toBe('+442079460958')
    expect(normalizePhone(normalizePhone('555-0134')!)).toBe('555-0134')
  })
})

describe('formatPhone', () => {
  it('renders a stored US number the way Americans read one', () => {
    expect(formatPhone('+15125550134')).toBe('(512) 555-0134')
  })

  it('returns a non-US number with its country code intact', () => {
    // No US grouping imposed on a number that is not US.
    expect(formatPhone('+442079460958')).toBe('+442079460958')
  })

  it('passes through a value written before normalisation existed', () => {
    // There is no backfill, so this is the ordinary state of existing rows.
    expect(formatPhone('512-555-0134')).toBe('512-555-0134')
    expect(formatPhone('555-0134')).toBe('555-0134')
  })

  it('does not mis-group a +1 number of the wrong length', () => {
    expect(formatPhone('+1512555')).toBe('+1512555')
  })

  it('returns an empty string for nothing', () => {
    // An empty string rather than null, so a caller can render it directly.
    expect(formatPhone(null)).toBe('')
    expect(formatPhone(undefined)).toBe('')
    expect(formatPhone('')).toBe('')
  })
})

describe('pickProfileColumns applies it', () => {
  it('normalises every phone column it lets through', () => {
    // The wiring. Without this, `normalizePhone` could be perfect and never called.
    expect(pickProfileColumns({ primary_phone: '(512) 555-0134' }).primary_phone)
      .toBe('+15125550134')
    for (const col of PHONE_COLUMNS) {
      expect(pickProfileColumns({ [col]: '512-555-0134' })[col]).toBe('+15125550134')
    }
  })

  it('leaves a non-string phone value untouched', () => {
    expect(pickProfileColumns({ primary_phone: null }).primary_phone).toBeNull()
  })
})
