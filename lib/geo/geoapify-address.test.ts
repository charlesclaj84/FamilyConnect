import { describe, expect, it } from 'vitest'
import { addressFrom, suggestionLabel } from '@/lib/geo/geoapify-address'

/**
 * The reshaping between Geoapify and `people`, which is the only part of the address
 * autocomplete with decisions in it.
 *
 * ── WHAT IS WORTH ASSERTING HERE ─────────────────────────────────────────────────
 * Autocomplete is WORLDWIDE, so most of these cases are about the US assumptions this
 * codebase carries elsewhere being wrong: a postcode that is not five digits, a state code
 * that is not two letters, a country with no counties, and a street number that goes after
 * the street rather than before it.
 *
 * The fetching, the debounce and the key are a client component's and cannot be reached from
 * here. What CAN be reached is every rule about which column gets what — including the two
 * that would be silent if wrong: a stale county surviving a new address, and an abbreviation
 * being written into `time_zone`.
 *
 * MUTATION-CHECKED. Each mutation below turns at least one case red and none turns the file
 * red:
 *
 *   `str` returns the raw value instead of trimming           (1)
 *   `str` keeps '' instead of answering null                  (1)
 *   `country_code` not lower-cased                            (1)
 *   `zoneName` accepts any string                             (1)
 *   `zoneName` reads `abbreviation` instead of `name`          (1)
 *   `NUMBER_AFTER_STREET` emptied                              (1)
 *   `streetLine` assembles instead of preferring address_line1 (1)
 *   `num` accepts a non-finite value                          (1)
 */

describe('addressFrom', () => {
  it('fills every column from a complete US suggestion', () => {
    const out = addressFrom({
      address_line1: '1600 Pennsylvania Avenue NW',
      city: 'Washington',
      state: 'District of Columbia',
      state_code: 'DC',
      county: 'District of Columbia',
      county_code: 'US-DC',
      postcode: '20500',
      country: 'United States',
      country_code: 'US',
      lat: 38.8977,
      lon: -77.0365,
      timezone: { name: 'America/New_York', offset_STD: '-05:00', abbreviation: 'EST' },
    })
    expect(out).toEqual({
      street_address: '1600 Pennsylvania Avenue NW',
      city: 'Washington',
      state: 'District of Columbia',
      state_code: 'DC',
      county: 'District of Columbia',
      county_code: 'US-DC',
      zip_code: '20500',
      country: 'United States',
      // LOWER-CASED. The column's comment says "as the geocoder returns it", and Geoapify
      // returns lower case — but it arrives upper here to prove the coercion, so a caller
      // comparing `'us'` never has to wonder.
      country_code: 'us',
      latitude: 38.8977,
      longitude: -77.0365,
      time_zone: 'America/New_York',
    })
  })

  // ── WORLDWIDE: the US assumptions, each wrong somewhere ────────────────────────

  it('keeps a postcode that is not five digits', () => {
    // `SW1A 1AA` has a space and letters; `100-0001` has a hyphen. Nothing validates a
    // postcode and nothing may — a five-digit rule would refuse most of the world.
    for (const postcode of ['SW1A 1AA', '75008', '100-0001', '1010', 'K1A 0B1']) {
      const out = addressFrom({ postcode })
      expect(out.zip_code, postcode).toBe(postcode)
    }
  })

  it('keeps a state code that is not two letters', () => {
    // ISO 3166-2 suffixes run to three characters and OSM's own abbreviations are worse.
    for (const code of ['NRW', 'BY', 'ENG', 'QC', '13']) {
      expect(addressFrom({ state_code: code }).state_code, code).toBe(code)
    }
  })

  it('leaves county NULL for a country that has none, which is not a failed parse', () => {
    const out = addressFrom({
      address_line1: '12 Rue de Rivoli',
      city: 'Paris',
      postcode: '75001',
      country: 'France',
      country_code: 'fr',
    })
    expect(out.county).toBeNull()
    expect(out.county_code).toBeNull()
    // And the rest still landed — an absent county must not cost the address.
    expect(out.city).toBe('Paris')
    expect(out.zip_code).toBe('75001')
  })

  it('puts the house number where the ADDRESS\'s country puts it, not where ours does', () => {
    // Only reachable when Geoapify gives the parts without `address_line1` — a `type=street`
    // result, most often. `address_line1` is preferred precisely because Geoapify has already
    // done this per country; this is the fallback.
    expect(addressFrom({ street: 'Rivoliweg', housenumber: '12', country_code: 'de' })
      .street_address).toBe('Rivoliweg 12')
    expect(addressFrom({ street: 'Main Street', housenumber: '12', country_code: 'us' })
      .street_address).toBe('12 Main Street')
    // An unclassified country gets number-first: the larger and less surprising set.
    expect(addressFrom({ street: 'Some Road', housenumber: '12', country_code: 'zz' })
      .street_address).toBe('12 Some Road')
    // No country at all, same answer, rather than dropping the number.
    expect(addressFrom({ street: 'Some Road', housenumber: '12' })
      .street_address).toBe('12 Some Road')
  })

  it('prefers `address_line1` over assembling the parts', () => {
    // The assertion that keeps the fallback a fallback. If this ever inverts, every German
    // address silently gains an anglophone number order.
    const out = addressFrom({
      address_line1: 'Rivoliweg 12',
      street: 'Rivoliweg',
      housenumber: '12',
      country_code: 'de',
    })
    expect(out.street_address).toBe('Rivoliweg 12')
  })

  it('falls back to the street alone when there is no number', () => {
    expect(addressFrom({ street: 'Main Street', country_code: 'us' }).street_address)
      .toBe('Main Street')
  })

  // ── THE TIMEZONE, WHICH IS THE ONE FIELD WRITTEN UNDER A DIFFERENT RULE ───────

  it('takes only the IANA name, never the abbreviation or the offset', () => {
    // `CST` is ambiguous between two continents and an offset is wrong for half the year,
    // which is why `people.time_zone` holds an IANA name and `lib/tz.ts` takes one.
    const out = addressFrom({
      timezone: { name: 'America/Chicago', offset_STD: '-06:00', abbreviation: 'CST' },
    })
    expect(out.time_zone).toBe('America/Chicago')
  })

  it('refuses a zone that is not an IANA name, so nothing writes CST into the column', () => {
    for (const timezone of [
      { name: 'CST' }, { name: '-06:00' }, { name: '' }, { abbreviation: 'CST' },
      {}, null, undefined, 'America/Chicago', { name: 42 },
    ]) {
      expect(addressFrom({ timezone }).time_zone, JSON.stringify(timezone)).toBeNull()
    }
  })

  it('accepts UTC, the one IANA name with no slash', () => {
    expect(addressFrom({ timezone: { name: 'UTC' } }).time_zone).toBe('UTC')
  })

  // ── EVERY KEY IS ALWAYS PRESENT, WHICH IS WHAT LETS A PICK REPLACE AN ADDRESS ──

  it('answers every key even for an empty suggestion, so a pick CLEARS stale fields', () => {
    // The important one. Picking a new address must clear a county the previous address had;
    // an object with the key missing would leave the stale value in the form, which is the
    // difference between REPLACING an address and merging two of them.
    const out = addressFrom({})
    expect(Object.keys(out).sort()).toEqual([
      'city', 'country', 'country_code', 'county', 'county_code', 'latitude', 'longitude',
      'state', 'state_code', 'street_address', 'time_zone', 'zip_code',
    ])
    expect(Object.values(out).every(v => v === null)).toBe(true)
  })

  it('trims, and treats a blank string as absent', () => {
    const out = addressFrom({ city: '  Austin  ', state: '   ', postcode: '' })
    expect(out.city).toBe('Austin')
    expect(out.state).toBeNull()
    expect(out.zip_code).toBeNull()
  })

  it('refuses coordinates that are not finite numbers', () => {
    for (const lat of ['', '  ', 'north', null, undefined, NaN, Infinity, {}]) {
      expect(addressFrom({ lat }).latitude, String(lat)).toBeNull()
    }
    // A numeric STRING is accepted: the API is documented to return numbers, and a string
    // would be a shape change that is still unambiguously a coordinate.
    expect(addressFrom({ lat: '38.8977' }).latitude).toBe(38.8977)
    // Zero is a real coordinate and must survive a truthiness test.
    expect(addressFrom({ lat: 0, lon: 0 }).latitude).toBe(0)
  })
})

describe('suggestionLabel', () => {
  it('uses the geocoder\'s own one-line rendering', () => {
    expect(suggestionLabel({ formatted: '1600 Pennsylvania Ave NW, Washington, DC 20500' }))
      .toBe('1600 Pennsylvania Ave NW, Washington, DC 20500')
  })

  it('assembles a label when there is no formatted line, rather than showing nothing', () => {
    // A blank row in a list of ten is unpressable, and a suggestion without `formatted` is
    // still a real place.
    expect(suggestionLabel({
      address_line1: '12 Main Street', city: 'Austin', state_code: 'TX',
      postcode: '78701', country: 'United States',
    })).toBe('12 Main Street, Austin, TX, 78701, United States')
  })

  it('prefers the state CODE in the label and falls back to the full name', () => {
    expect(suggestionLabel({ city: 'Paris', state: 'Île-de-France', country: 'France' }))
      .toBe('Paris, Île-de-France, France')
  })

  it('is an empty string for an empty suggestion rather than throwing', () => {
    expect(suggestionLabel({})).toBe('')
  })
})
