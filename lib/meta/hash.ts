/**
 * Turning what GENORRA knows about an ACCOUNT HOLDER into what Meta will accept.
 *
 * Every function here does one of two things and never both: normalise a value to the
 * exact form Meta's matching specification asks for, then SHA-256 it. Getting either half
 * wrong is silent — a wrongly normalised email hashes to a perfectly valid digest that
 * matches nobody, so the event is accepted, reported as delivered, and contributes nothing
 * to Event Match Quality. There is no error anywhere to notice. That is the whole reason
 * this is a separate module with its own tests rather than three lines inside the sender.
 *
 * ── THE RULES ARE META'S, NOT OURS ──────────────────────────────────────────────────
 * Taken from the Customer Information Parameters reference, read 2026-08-22:
 *
 *   em         trim, lowercase                                    → SHA-256
 *   ph         digits only, no leading zeros, country code present → SHA-256
 *   fn / ln    trim, lowercase, no punctuation                    → SHA-256
 *   ct         lowercase, no punctuation, no spaces               → SHA-256
 *   st         2-letter code, lowercase                           → SHA-256
 *   zp         lowercase, no spaces or dashes, US = first 5       → SHA-256
 *   country    ISO 3166-1 alpha-2, lowercase                      → SHA-256
 *   external_id  opaque, stable                                   → SHA-256 (recommended)
 *
 *   client_ip_address, client_user_agent, fbp, fbc  →  PLAIN TEXT, never hashed.
 *
 * That last line is the one a well-meaning change breaks. Hashing `fbp` does not fail: it
 * produces a syntactically fine string that matches no browser, and the diagnostic in
 * Events Manager reads as poor match quality rather than as a bug. Those four fields do
 * not pass through this module at all — `lib/meta/identity.ts` carries them across
 * untouched — precisely so there is no hashing function in scope where they are handled.
 *
 * ── AND NOTHING IS EVER HASHED TWICE ────────────────────────────────────────────────
 * `sha256` passes a value that is ALREADY a 64-character hex digest straight through.
 * Double-hashing is the other silent failure in this class, and it is the likely one here:
 * these helpers are exported, so a caller who hashes an email and then hands the result to
 * a builder that hashes again produces a digest of a digest, which matches nobody. The
 * guard costs a regex and removes the possibility.
 *
 * PURE, apart from `node:crypto`. No network, no environment, no request. Tested under
 * `npm test` (AGENTS.md §7b).
 */

import { createHash } from 'node:crypto'
import { DEFAULT_COUNTRY_CODE } from '@/lib/phone-format'

/** A value that has already been through SHA-256, in the form Meta expects it. */
const HEX_64 = /^[a-f0-9]{64}$/i

/**
 * SHA-256, lowercase hex — and a no-op for a value that is already one.
 *
 * Returns null for anything empty, so an absent field is OMITTED from `user_data` rather
 * than sent as the hash of an empty string. That distinction matters: `e3b0c442…` is the
 * digest of `''` and it is a real, valid-looking value that every empty field in every
 * event would share, which is a matching signal pointing at nobody.
 */
export function sha256(value: string | null | undefined): string | null {
  if (typeof value !== 'string') return null
  const trimmed = value.trim()
  if (!trimmed) return null
  if (HEX_64.test(trimmed)) return trimmed.toLowerCase()
  return createHash('sha256').update(trimmed, 'utf8').digest('hex')
}

/** `em` — trim and lowercase. */
export function normalizeEmail(value: string | null | undefined): string | null {
  if (typeof value !== 'string') return null
  const trimmed = value.trim().toLowerCase()
  // Not validation — see lib/phone-format.ts's argument for the same choice. The one
  // check is that it looks like an address at all, because hashing a name typed into an
  // email field produces a digest that quietly matches nobody.
  return trimmed.includes('@') && trimmed.length > 2 ? trimmed : null
}

/**
 * `ph` — digits only, country code included, no leading zeros.
 *
 * Profiles here store E.164 (`+15125550134`, see lib/phone-format.ts), so the ordinary
 * case is "drop the plus". The two other branches exist because rows written before that
 * module did hold whatever was typed:
 *
 *   * a bare 10-digit number gets `DEFAULT_COUNTRY_CODE`, the same +1 assumption the
 *     storage format already makes for this US product — reusing that constant rather
 *     than restating it, so the two cannot drift;
 *   * anything else is passed through as its digits, because inventing a country code for
 *     a number of unknown length would produce a confident match against a stranger.
 *
 * A number too short to be one is dropped rather than sent: it cannot match, and sending
 * it only lowers the proportion of parameters Meta reports as usable.
 */
export function normalizePhone(value: string | null | undefined): string | null {
  if (typeof value !== 'string') return null
  const explicitCountryCode = value.trim().startsWith('+')
  const digits = value.replace(/\D/g, '').replace(/^0+/, '')
  if (digits.length < 7) return null
  if (explicitCountryCode) return digits
  if (digits.length === 10) return `${DEFAULT_COUNTRY_CODE}${digits}`
  return digits
}

/**
 * `fn` / `ln` — lowercase, punctuation removed, spaces removed.
 *
 * Accents are KEPT rather than folded to ASCII, which is the opposite of what
 * `lib/person-search.ts` does and is right for the opposite reason: search is trying to
 * make "jose" find "José" for a human typing, whereas this is trying to hash the same
 * bytes Meta hashed on their side, and their rule is to normalise punctuation and case
 * while preserving the UTF-8 characters. Stripping the accent here would produce a
 * different digest from the one Meta's own client-side hasher produces for the same name.
 */
export function normalizeName(value: string | null | undefined): string | null {
  if (typeof value !== 'string') return null
  const cleaned = value
    .trim()
    .toLowerCase()
    // Punctuation and separators — apostrophes in O'Connor, hyphens in Smith-Jones,
    // periods in initials, and any internal whitespace.
    .replace(/['’`.\-\s]/g, '')
  return cleaned || null
}

/** `ct` — lowercase, no punctuation, no spaces. "San Antonio" → "sanantonio". */
export function normalizeCity(value: string | null | undefined): string | null {
  return normalizeName(value)
}

/**
 * `st` — a two-letter code, lowercase.
 *
 * Only a two-letter input is accepted. A full state name ("Texas") is NOT expanded,
 * because the mapping is a table of fifty entries that would then have to be right about
 * territories and about every non-US subdivision, and a wrong expansion hashes to a
 * confident match on the wrong place. An unmapped value is simply omitted, which costs a
 * little match quality and states nothing false.
 */
export function normalizeState(value: string | null | undefined): string | null {
  if (typeof value !== 'string') return null
  const cleaned = value.trim().toLowerCase().replace(/[^a-z]/g, '')
  return cleaned.length === 2 ? cleaned : null
}

/**
 * `zp` — lowercase, no spaces or dashes, US codes truncated to the first five digits.
 *
 * The truncation is Meta's rule and is also the privacy-preferable one: ZIP+4 narrows to
 * roughly a city block, and the extra four digits buy no matching at all because Meta
 * discards them on their side.
 */
export function normalizeZip(value: string | null | undefined): string | null {
  if (typeof value !== 'string') return null
  const cleaned = value.trim().toLowerCase().replace(/[\s-]/g, '')
  if (!cleaned) return null
  return /^\d+$/.test(cleaned) ? cleaned.slice(0, 5) : cleaned
}

/** `country` — ISO 3166-1 alpha-2, lowercase. Anything else is omitted. */
export function normalizeCountry(value: string | null | undefined): string | null {
  if (typeof value !== 'string') return null
  const cleaned = value.trim().toLowerCase().replace(/[^a-z]/g, '')
  return cleaned.length === 2 ? cleaned : null
}

/**
 * `external_id` — the opaque, stable identifier for the ACCOUNT HOLDER.
 *
 * It is the Supabase `auth.users` id, hashed. Two properties matter and both are
 * deliberate:
 *
 *   * IT IS THE ACCOUNT, NEVER A `people.id`. A person may hold rows in several families
 *     and a `people` row may belong to somebody with no account at all — a recorded
 *     grandmother, AGENTS.md §4b — so a people id is neither stable across the product
 *     nor necessarily a customer. Meta is being told "this is the same customer as last
 *     time", and the account is the only thing in this schema that means that.
 *   * IT IS HASHED, so what leaves the building is a digest rather than a key that appears
 *     in this product's own URLs and logs.
 *
 * Same value every time for the same account, which is what makes it useful — Meta matches
 * `external_id` across events, so a Purchase weeks after a registration still joins up.
 */
export function externalId(userId: string | null | undefined): string | null {
  return sha256(userId)
}
