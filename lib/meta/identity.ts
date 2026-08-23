/**
 * Assembling `user_data` — the matching parameters — for ONE ADULT ACCOUNT HOLDER.
 *
 * ── THE INPUT TYPE IS THE CONTROL ───────────────────────────────────────────────────
 * `MetaAccountHolder` is a hand-written shape with nine fields. It is deliberately NOT a
 * `people` row, not a `Partial<Person>`, and not anything that can be produced by spreading
 * a database record: a caller has to name each value, which means somebody decided that
 * this particular field about this particular person may go to an advertising platform.
 *
 * That matters more here than anywhere else in the integration, because `user_data` is the
 * field whose whole purpose is to describe a human being, and because the pressure on it is
 * one-directional — every guide about Event Match Quality says to send more. The answer
 * this file gives is: more of the ACCOUNT HOLDER'S OWN nine fields, and nothing else, ever.
 *
 * ── WHAT IS STRUCTURALLY UNREACHABLE FROM HERE ──────────────────────────────────────
 * Dates of birth, ages, children, relationships, ancestry, photographs, family or member
 * names other than the account holder's own, addresses beyond city/state/postal/country,
 * dues balances, messages, documents, health or religion. None of them has a field on this
 * interface, so none of them has a route to `sendMetaEvents`. `buildUserData` copies named
 * properties out of its argument and ignores the rest, so handing it an entire `people`
 * row — the mistake this design expects somebody to make eventually — yields the safe
 * subset and drops everything else on the floor.
 *
 * `FORBIDDEN_INPUT_KEYS` below is a tripwire on top of that, not the mechanism. It cannot
 * fail closed any harder than the allow-list already does; what it adds is a LOG LINE, so
 * a mistake that the allow-list silently absorbs is still visible to whoever made it.
 *
 * ── external_id IS THE ACCOUNT, NEVER A FAMILY MEMBER ───────────────────────────────
 * See `externalId` in lib/meta/hash.ts. One person may hold `people` rows in several
 * families, and a `people` row may describe somebody with no account at all — so the
 * `auth.users` id is the only identifier in this schema that means "the same customer".
 */

import {
  externalId, normalizeCity, normalizeCountry, normalizeEmail, normalizeName,
  normalizePhone, normalizeState, normalizeZip, sha256,
} from '@/lib/meta/hash'
import { isValidFbc, isValidFbp } from '@/lib/meta/attribution'

/**
 * Everything GENORRA is permitted to tell Meta about a customer.
 *
 * Nine fields. Meta accepts more — date of birth and gender among them — and this product
 * will not send either: a birthday is the single most sensitive ordinary field in a family
 * record, it is collected here so that relatives can wish each other happy birthday, and
 * that is not a purpose that extends to advertising. Their absence is a decision, recorded
 * here so it is not read as an oversight and quietly filled in for match quality.
 */
export interface MetaAccountHolder {
  /** `auth.users.id`. Becomes a hashed `external_id`. */
  userId?: string | null
  email?: string | null
  phone?: string | null
  firstName?: string | null
  lastName?: string | null
  city?: string | null
  state?: string | null
  postalCode?: string | null
  /** ISO 3166-1 alpha-2. */
  country?: string | null
}

/** What the request itself contributes. Plain text, never hashed. */
export interface MetaRequestSignals {
  clientIpAddress?: string | null
  clientUserAgent?: string | null
  fbp?: string | null
  fbc?: string | null
}

/**
 * Field names that must never appear on a `MetaAccountHolder`. A tripwire, not the gate.
 *
 * Chosen as the ones an honest mistake would actually carry: they are the column names on
 * `people`, so they are what arrives if somebody passes a profile row straight through.
 */
const FORBIDDEN_INPUT_KEYS = [
  'date_of_birth', 'dateOfBirth', 'birthday', 'age',
  'relationships', 'children', 'spouse', 'parents',
  'family_code', 'familyCode', 'family_name', 'familyName',
  'gender', 'ethnicity', 'religion',
  'avatar_url', 'bio', 'notes',
  'address_line1', 'addressLine1', 'street',
  'password', 'user_id',
] as const

/**
 * Log — never throw — when a caller hands over something with private-looking keys on it.
 *
 * Not an exception, for the reason the whole integration is fail-soft: this runs behind a
 * committed registration or a settled payment. And the value is already safe by the time
 * this is called, because the allow-list below is what builds the payload.
 *
 * `user_id` is on the list even though `userId` is a legitimate field: the snake_case form
 * is what a database row carries, so seeing it is evidence a row was passed rather than a
 * value chosen.
 */
function warnOnForbiddenKeys(input: object): void {
  const present = FORBIDDEN_INPUT_KEYS.filter((key) => key in input)
  if (present.length > 0) {
    console.error(
      `[meta] a database row appears to have been passed as a MetaAccountHolder — `
      + `these keys were ignored: ${present.join(', ')}. Name the permitted fields explicitly.`,
    )
  }
}

/**
 * Build the `user_data` object.
 *
 * Absent fields are OMITTED rather than sent empty or null — Meta reports a null matching
 * parameter as a malformed one, and the digest of an empty string is a real-looking value
 * shared by every event that omits that field.
 *
 * The four plain-text fields (`client_ip_address`, `client_user_agent`, `fbp`, `fbc`) are
 * copied WITHOUT touching a hashing function. That is the single most important line in
 * this file: hashing them does not error, it produces a valid string that matches nothing,
 * and the only symptom is match quality quietly failing to improve.
 */
export function buildUserData(
  holder: MetaAccountHolder | null | undefined,
  signals: MetaRequestSignals | null | undefined,
): Record<string, string> {
  const out: Record<string, string> = {}

  if (holder && typeof holder === 'object') {
    warnOnForbiddenKeys(holder)

    const put = (key: string, value: string | null) => {
      if (value) out[key] = value
    }

    put('em', sha256(normalizeEmail(holder.email)))
    put('ph', sha256(normalizePhone(holder.phone)))
    put('fn', sha256(normalizeName(holder.firstName)))
    put('ln', sha256(normalizeName(holder.lastName)))
    put('ct', sha256(normalizeCity(holder.city)))
    put('st', sha256(normalizeState(holder.state)))
    put('zp', sha256(normalizeZip(holder.postalCode)))
    put('country', sha256(normalizeCountry(holder.country)))
    put('external_id', externalId(holder.userId))
  }

  if (signals && typeof signals === 'object') {
    // PLAIN TEXT. See above.
    if (signals.clientIpAddress) out.client_ip_address = signals.clientIpAddress
    if (signals.clientUserAgent) out.client_user_agent = signals.clientUserAgent.slice(0, 512)
    if (isValidFbp(signals.fbp)) out.fbp = signals.fbp as string
    if (isValidFbc(signals.fbc)) out.fbc = signals.fbc as string
  }

  return out
}

/**
 * Is there enough here for Meta to match anybody at all?
 *
 * An event whose `user_data` holds only a user agent cannot be attributed to a person or a
 * click, so it contributes nothing but a row in the diagnostics as an unmatched event.
 * `dispatch` uses this to decide whether a send is worth making — the alternative, sending
 * regardless, degrades the dataset's reported match rate with events that were never going
 * to match.
 *
 * An IP address alone does not count. It is a matching signal in combination and is far too
 * coarse on its own, and Meta's own guidance treats it as a supplement.
 */
export function hasMatchableIdentity(userData: Record<string, string>): boolean {
  return Boolean(userData.em || userData.ph || userData.external_id || userData.fbp || userData.fbc)
}

/**
 * The client IP, out of the proxy headers Vercel sets.
 *
 * `x-forwarded-for` is a comma-separated chain and the FIRST entry is the original client —
 * the rest are the proxies in between, and sending one of those would attribute every
 * conversion to a data centre. The value is validated loosely rather than parsed: Meta
 * accepts IPv4 and IPv6, and a malformed one is dropped rather than sent, since an invalid
 * `client_ip_address` is a named Events Manager diagnostic.
 */
export function clientIpFromHeaders(headers: Headers): string | null {
  const forwarded = headers.get('x-forwarded-for')
  const candidate = forwarded ? forwarded.split(',')[0].trim() : headers.get('x-real-ip')?.trim()
  if (!candidate) return null
  // Loopback and unspecified addresses are what a local dev server reports. They match
  // nobody, so they are dropped rather than sent as if they were a visitor's address.
  if (candidate === '::1' || candidate === '127.0.0.1' || candidate === '0.0.0.0') return null
  const looksLikeIp = /^[0-9a-f:.]+$/i.test(candidate) && candidate.length <= 45
  return looksLikeIp ? candidate : null
}
