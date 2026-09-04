/**
 * Turning one Geoapify autocomplete suggestion into the columns `people` holds.
 *
 * ── A PURE MODULE, FOR THE REASON `zip-crosswalk-rows.ts` IS ONE ───────────────────
 * No `server-only`, no imports, no `fetch`. The fetching is a client component's job and the
 * writing is a server action's; this is the reshaping in between, which is the only part with
 * decisions in it and therefore the only part worth testing. `npm test` reaches `lib/**`
 * (§7b) and nothing here needs jsdom, React or Supabase.
 *
 * ── WORLDWIDE, WHICH IS WHAT MOST OF THIS FILE IS ABOUT ───────────────────────────
 * Autocomplete is unrestricted by country (decided 2026-09-04), so every US assumption this
 * codebase carries elsewhere is wrong here:
 *
 *   * A POSTCODE IS NOT FIVE DIGITS. `SW1A 1AA`, `75008`, `100-0001`. Passed through
 *     verbatim; nothing validates it and nothing may.
 *   * A STATE IS NOT TWO LETTERS. `state_code` is an ISO 3166-2 subdivision suffix where OSM
 *     has one and its own abbreviation where it does not.
 *   * A COUNTY IS A US/UK-SHAPED IDEA. Absent for most of the world, and an empty `county`
 *     for a member in Lyon is correct rather than a failed parse.
 *   * A STREET NUMBER GOES BEFORE THE STREET IN SOME COUNTRIES AND AFTER IT IN OTHERS.
 *     `12 Rue de Rivoli` against `Rivoliweg 12`. **So the street line is taken from
 *     Geoapify's own `address_line1` rather than assembled from `housenumber` + `street`** —
 *     it has already done that composition per country, and any joining this file did would
 *     be right for wherever the author lives and wrong elsewhere.
 *
 * ── EVERY FIELD IS OPTIONAL AND EVERY FIELD IS CHECKED ────────────────────────────
 * A type annotation is erased at runtime (§2's rule about `Partial<T>`) and this arrives from
 * a third party over the network into a form a member is about to save. Anything not a
 * non-empty string comes out as `null`, so a partial suggestion clears a field rather than
 * writing `"undefined"` into it.
 *
 * ── WHAT IT DELIBERATELY DOES NOT TOUCH ───────────────────────────────────────────
 * `apartment`. Postal autocomplete has no apartment or suite — those are below the
 * deliverable-address level and no geocoder returns them — so picking a suggestion must leave
 * whatever the member typed there alone. Geoapify's own `address_line2` is a FORMATTED line
 * ("Livingston, TX 77351"), not a second address line, and is deliberately unused: it is
 * derivable from the city, state and postcode beside it, and storing a derived string is the
 * `is_minor` trap (§4b).
 */

/** The fields of a Geoapify suggestion this reads. All optional; all verified. */
export interface GeoapifySuggestion {
  formatted?: unknown
  address_line1?: unknown
  street?: unknown
  housenumber?: unknown
  city?: unknown
  state?: unknown
  state_code?: unknown
  county?: unknown
  county_code?: unknown
  postcode?: unknown
  country?: unknown
  country_code?: unknown
  lat?: unknown
  lon?: unknown
  place_id?: unknown
  timezone?: unknown
}

/** The columns one suggestion fills. Exactly the `people` columns, named as they are there. */
export interface AddressFields {
  street_address: string | null
  city: string | null
  state: string | null
  state_code: string | null
  county: string | null
  county_code: string | null
  zip_code: string | null
  country: string | null
  country_code: string | null
  latitude: number | null
  longitude: number | null
  /**
   * The IANA zone for the address — `America/Chicago`.
   *
   * SEPARATE FROM THE ADDRESS FIELDS because it is written under a different rule: the
   * address replaces what was there, and the timezone OVERWRITES a value the member may have
   * chosen deliberately, so the surface has to say it moved. `null` when Geoapify did not
   * supply one, which must not be written over a good stored zone.
   */
  time_zone: string | null
}

/** A trimmed non-empty string, or null. The one coercion in this file. */
function str(v: unknown): string | null {
  if (typeof v !== 'string') return null
  const t = v.trim()
  return t === '' ? null : t
}

/** A finite number, from a number or a numeric string. */
function num(v: unknown): number | null {
  const n = typeof v === 'number' ? v : typeof v === 'string' && v.trim() ? Number(v) : Number.NaN
  return Number.isFinite(n) ? n : null
}

/**
 * The street line.
 *
 * ── `address_line1` FIRST, AND THE FALLBACK IS THE INTERESTING PART ───────────────
 * Geoapify composes `address_line1` per country, which is the whole reason to prefer it —
 * see the header on number order. The fallback is for a suggestion that has the parts and
 * not the composition (a `type=street` result, most often), and it joins them in the order
 * the ADDRESS's own country uses rather than the author's:
 *
 *   number-first  most of the anglosphere, France, Spain, China, Japan
 *   number-last   the German-speaking countries, the Nordics, the Low Countries, Italy,
 *                 Poland, Brazil, Portugal, Turkey, Greece
 *
 * A LIST OF THE SECOND, not of the first, because the first is the larger and less surprising
 * set — a country nobody has classified gets number-first, which is what a reader of English
 * expects to see and is right far more often than the reverse.
 */
const NUMBER_AFTER_STREET = new Set([
  'de', 'at', 'ch', 'li', 'nl', 'be', 'lu', 'dk', 'se', 'no', 'fi', 'is',
  'it', 'pl', 'cz', 'sk', 'hu', 'hr', 'si', 'ro', 'bg', 'ee', 'lv', 'lt',
  'pt', 'br', 'tr', 'gr', 'id',
])

function streetLine(s: GeoapifySuggestion): string | null {
  const line1 = str(s.address_line1)
  if (line1) return line1

  const street = str(s.street)
  const number = str(s.housenumber)
  if (!street) return null
  if (!number) return street

  const cc = (str(s.country_code) ?? '').toLowerCase()
  return NUMBER_AFTER_STREET.has(cc) ? `${street} ${number}` : `${number} ${street}`
}

/**
 * The IANA zone name out of Geoapify's `timezone` object.
 *
 * ── ONLY THE NAME, AND ONLY IF IT LOOKS LIKE ONE ──────────────────────────────────
 * The object also carries `offset_STD`, `offset_DST` and `abbreviation`. None of those is
 * stored and none may be: an offset is wrong for half the year and `CST` is ambiguous between
 * two continents, which is exactly why `people.time_zone` holds an IANA name and `lib/tz.ts`
 * takes one.
 *
 * THE `/` TEST IS THE WHOLE VALIDATION, deliberately. Every IANA zone but `UTC` has one
 * (`America/Chicago`, `Europe/Berlin`), and a real list belongs nowhere near a parser — the
 * authority is the runtime, which `isValidZone` already asks in `app/actions/admin/family.ts`.
 * This rejects an abbreviation that arrived in the wrong field; the caller does the rest.
 */
function zoneName(v: unknown): string | null {
  if (!v || typeof v !== 'object') return null
  const name = str((v as { name?: unknown }).name)
  if (!name) return null
  return name === 'UTC' || name.includes('/') ? name : null
}

/**
 * One suggestion, as the columns it fills.
 *
 * ── IT RETURNS `null` FOR AN EMPTY FIELD RATHER THAN OMITTING IT ──────────────────
 * Every key is always present, which is what lets the caller apply the whole object: picking
 * a new address must CLEAR a county the previous one had, and an object with the key missing
 * would leave the stale value in the form. That is the difference between replacing an
 * address and merging two of them.
 */
export function addressFrom(suggestion: GeoapifySuggestion): AddressFields {
  return {
    street_address: streetLine(suggestion),
    city: str(suggestion.city),
    state: str(suggestion.state),
    state_code: str(suggestion.state_code),
    county: str(suggestion.county),
    // Carried, and NOT a FIPS. `20260904000000` §2 says so on the column: Geoapify is
    // OpenStreetMap-derived and OSM holds no US FIPS codes, so joining this to
    // `zip_counties.county_fips` would match nothing and look like a family with no alerts.
    county_code: str(suggestion.county_code),
    zip_code: str(suggestion.postcode),
    country: str(suggestion.country),
    // LOWER-CASED, because the column's comment says it is stored as the geocoder returns it
    // and a caller comparing `'us'` must not have to wonder. ISO 3166-1 alpha-2 is
    // case-insensitive by definition, so this loses nothing.
    country_code: str(suggestion.country_code)?.toLowerCase() ?? null,
    latitude: num(suggestion.lat),
    longitude: num(suggestion.lon),
    time_zone: zoneName(suggestion.timezone),
  }
}

/**
 * The label a suggestion is shown as in the list.
 *
 * `formatted` is Geoapify's own one-line rendering and is what a reader recognises. The
 * fallback assembles the parts rather than showing nothing, because a suggestion with no
 * `formatted` is still a real place and a blank row in a list of ten is unpressable.
 */
export function suggestionLabel(suggestion: GeoapifySuggestion): string {
  const formatted = str(suggestion.formatted)
  if (formatted) return formatted
  return [
    streetLine(suggestion),
    str(suggestion.city),
    str(suggestion.state_code) ?? str(suggestion.state),
    str(suggestion.postcode),
    str(suggestion.country),
  ].filter(Boolean).join(', ')
}

/**
 * The fields a member never types, which is the half both surfaces hold separately.
 *
 * ── WHY THE SPLIT EXISTS ──────────────────────────────────────────────────────────
 * Five of `AddressFields` are boxes on a form — street, city, state, postcode, country — and
 * a member may edit any of them by hand. The rest arrive only from a pick, and `latitude` is
 * a NUMBER, which is what made the split unavoidable rather than tidy: both address forms in
 * this product hold their state as strings (`Required<Omit<PersonalInfoData, …>>` on one of
 * them), so a coordinate cannot live there without making every field on both forms
 * `string | number`.
 *
 * `time_zone` is deliberately NOT in here either. It is written under a different rule again
 * — it overwrites a value the member may have chosen deliberately, so the surface has to say
 * out loud that it moved — and folding it in would make that a silent side effect of picking
 * an address.
 */
export interface GeoExtras {
  state_code: string | null
  county: string | null
  county_code: string | null
  country_code: string | null
  latitude: number | null
  longitude: number | null
}

/**
 * What the extras are when nothing has been geocoded.
 *
 * ── IT IS SIX EXPLICIT NULLS, NOT `{}` ───────────────────────────────────────────
 * Both surfaces clear the extras the moment a member hand-edits an address field, because a
 * coordinate that describes the picked address while the boxes describe a different one is
 * two facts that disagree (§4b). An empty object would leave the stale values on the row,
 * which is exactly the state this is written to prevent — so every key is present and null.
 */
export const EMPTY_GEO: GeoExtras = {
  state_code: null,
  county: null,
  county_code: null,
  country_code: null,
  latitude: null,
  longitude: null,
}

/** The extras out of a full pick. */
export function geoExtras(fields: AddressFields): GeoExtras {
  return {
    state_code: fields.state_code,
    county: fields.county,
    county_code: fields.county_code,
    country_code: fields.country_code,
    latitude: fields.latitude,
    longitude: fields.longitude,
  }
}
