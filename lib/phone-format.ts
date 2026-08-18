/**
 * Phone numbers: one stored form, one displayed form.
 *
 * A directory holding `512-555-0134`, `(512) 555 0134`, `5125550134` and `+1 512 555 0134`
 * holds four renderings of one number, and nothing can tell that they match — which matters
 * the moment anything wants to dial, text, deduplicate or compare them.
 *
 * ── ONE CANONICAL STORED FORM: E.164 ────────────────────────────────────────────────
 * `+15125550134`. No spaces, no punctuation, country code always present. It is what every
 * telephony API expects, it sorts and compares as a string, and it is unambiguous about
 * which country the number is in — which a bare `5125550134` is not.
 *
 * Display formatting is DERIVED from it (`formatPhone`), so the stored value is the fact and
 * the pretty version is a rendering. The reverse arrangement — store what was typed, parse it
 * on the way out — is what produces four renderings of one number.
 *
 * ── US ONLY, FOR NOW, AND IT REFUSES TO GUESS ───────────────────────────────────────
 * The country code is assumed to be +1 for a bare 10-digit number, which is the ask. Two
 * things follow, and the second is the important one:
 *
 *   * An input that ALREADY starts with `+` is trusted and kept. Somebody who typed
 *     `+44 20 7946 0958` has told us the country, and re-deciding it would be wrong.
 *   * An input this module does not recognise is returned UNCHANGED, never mangled and never
 *     rejected. A number with an extension, a partial number somebody is still typing, an
 *     international number typed without its `+` — all of these are values a real person
 *     really enters, and the failure mode of guessing is a stored number that cannot be
 *     dialled while looking perfectly fine.
 *
 * IT IS FORMATTING, NOT VALIDATION, and that is deliberate. It does not check that the area
 * code is assignable or that the exchange is real, because refusing a number is a decision
 * about whether somebody can save their profile, and a directory that will not accept a
 * relative's number is worse than one holding a number with a typo in it. If validation is
 * ever wanted it belongs beside the field, as a warning, not here.
 *
 * ── WHERE IT IS APPLIED ─────────────────────────────────────────────────────────────
 * `pickProfileColumns` in `lib/profile-columns.ts` — the one chokepoint every profile write
 * passes through. Same argument as `lib/name-case.ts`: at three call sites it would be
 * remembered, here it is enforced.
 *
 * Existing rows hold whatever was typed before this existed, and there is no backfill — so
 * `formatPhone` must handle an un-normalised value, and it does, by passing it through. A
 * migration that rewrote every stored number would be a data change made on a guess about
 * values nobody has looked at.
 *
 * PURE — no imports, no environment. Tested under `npm test` (AGENTS.md §7b).
 */

/** The default country code for a number typed without one. US/Canada. */
export const DEFAULT_COUNTRY_CODE = '1'

/**
 * The value to STORE for what somebody typed.
 *
 * Returns E.164 when the input is recognisable, and the trimmed input unchanged when it is
 * not. Null and undefined pass through, so a caller can hand it a whole patch.
 */
export function normalizePhone(value: string | null | undefined): string | null | undefined {
  if (value === null || value === undefined) return value

  const trimmed = value.trim()
  if (!trimmed) return trimmed

  // A leading `+` means the country has already been stated. Keep it, strip the separators,
  // and do not second-guess which country it is.
  if (trimmed.startsWith('+')) {
    const digits = trimmed.slice(1).replace(/\D/g, '')
    return digits ? `+${digits}` : trimmed
  }

  const digits = trimmed.replace(/\D/g, '')

  // 10 digits — a US number typed the way Americans write them.
  if (digits.length === 10) return `+${DEFAULT_COUNTRY_CODE}${digits}`

  // 11 digits starting with 1 — the same number with the country code and no `+`.
  if (digits.length === 11 && digits.startsWith(DEFAULT_COUNTRY_CODE)) return `+${digits}`

  // ANYTHING ELSE IS LEFT ALONE. A 7-digit local number, a number with an extension, an
  // international number with no `+`, a half-typed one. Guessing here is how a stored number
  // becomes undiallable while looking correct.
  return trimmed
}

/**
 * What to SHOW for a stored value.
 *
 * `+15125550134` → `(512) 555-0134`. Any other `+` number is grouped lightly rather than
 * guessed at, and anything that is not E.164 at all — every row written before this module
 * existed — is returned exactly as stored.
 */
export function formatPhone(value: string | null | undefined): string {
  if (!value) return ''
  const trimmed = value.trim()

  if (trimmed.startsWith(`+${DEFAULT_COUNTRY_CODE}`)) {
    const d = trimmed.slice(1 + DEFAULT_COUNTRY_CODE.length)
    if (d.length === 10 && /^\d{10}$/.test(d)) {
      return `(${d.slice(0, 3)}) ${d.slice(3, 6)}-${d.slice(6)}`
    }
  }

  // Another country: keep the `+` and the digits, and do not impose a US grouping on a
  // number that is not US. Somebody reading it knows their own format better than this does.
  return trimmed
}

/**
 * The `people` columns this applies to.
 *
 * One today. It is a list rather than a constant so that adding a second phone column is an
 * edit here rather than a second call site to remember — the same reason
 * `NAME_CASE_COLUMNS` is a list.
 */
export const PHONE_COLUMNS: readonly string[] = ['primary_phone']
