/**
 * The languages this product speaks.
 *
 * ── PURE, AND ON THE CLIENT SIDE OF THE LINE ────────────────────────────────────────
 * No imports, no `server-only`, no database. `LocaleSwitcher` is a client component and needs
 * this registry, so anything server-shaped in here would end up in the browser bundle — which
 * is the mistake `lib/meta/no-client-secrets.test.ts` caught when `ZONE_HINT_COOKIE` briefly
 * lived beside `resolveZone` and dragged the service-role client across with it. Keep it clean.
 *
 * ── TWO CODES PER LOCALE, AND CONFLATING THEM IS A REAL BUG ─────────────────────────
 * This is the part that is easy to get wrong, because a two-character code LOOKS like enough:
 *
 *   `code`   IDENTITY. The URL segment on Home (`/es/pricing`), the `<html lang>` attribute,
 *            the catalogue filename, and the value stored in `people.locale`. Two characters,
 *            which is the decision — and it is what `people_locale_check` constrains.
 *
 *   `intl`   FORMATTING, and nothing else. A full BCP-47 tag, handed to `Intl.NumberFormat`
 *            and `Intl.DateTimeFormat`. **A bare `'es'` resolves to SPAIN's conventions** —
 *            different date order and separators from Mexico's — so a family in Monterrey
 *            reading Spanish would get figures grouped the Peninsular way. It fails silently,
 *            because the output is a plausible number either way.
 *
 * So `code` is never passed to a formatter and `intl` is never put in a URL.
 *
 * ── NO FLAGS, AND THAT IS DELIBERATE ────────────────────────────────────────────────
 * There is no `flag` field and one must not be added. A flag is a COUNTRY and a language is
 * not: Spanish is not Spain to a family in Monterrey, English is not the United States to one
 * in Lagos, and Portuguese-as-Brazil is an argument rather than an icon. The switcher shows
 * the code beside the endonym — `ES · Español` — which is what the reader recognises.
 *
 * ── THE ENDONYM IS IN ITS OWN LANGUAGE, ALWAYS ──────────────────────────────────────
 * "Español", not "Spanish". A member looking for their own language scans for the word they
 * would use for it, and that word does not change with the interface they are currently
 * reading. This is the one string in the product that is never translated.
 *
 * ── VARIETY AND REGISTER, RECORDED HERE BECAUSE NOTHING ELSE CAN HOLD THEM ──────────
 * Latin American Spanish and international French. **Formal address throughout** — *usted* and
 * *vous* — across Home, the Dashboard and mail alike. That is a decision about voice rather
 * than a value any code reads, and it reaches every string that addresses the reader: verb
 * conjugations, pronouns and possessives all move with it, so it is not a find-and-replace
 * later. It is written down here so a future contributor does not warm it up one screen at a
 * time. The reasoning: this product speaks as the family's institution — it records minutes,
 * collects dues and runs elections — and its readers include grandparents on the family tree.
 */

export interface Locale {
  /** Two characters. The URL segment, the `lang` attribute, the stored preference. */
  code: string
  /** The language's name in itself. Never translated. */
  endonym: string
  /** The BCP-47 tag for `Intl` — the ONLY thing ever handed to a formatter. */
  intl: string
}

/**
 * Every locale, in the order the switcher lists them.
 *
 * English first because it is the source language and the fallback; the rest alphabetical by
 * code, which is stable and needs no decision when a fourth arrives.
 */
export const LOCALES: readonly Locale[] = [
  { code: 'en', endonym: 'English',  intl: 'en-US' },
  { code: 'es', endonym: 'Español',  intl: 'es-MX' },
  { code: 'fr', endonym: 'Français', intl: 'fr-FR' },
] as const

/**
 * The source language, and the fallback for everything untranslated.
 *
 * Not "the default for a member with no preference" — that is negotiated (see
 * `lib/auth/locale.ts`). This is the language the catalogue is WRITTEN in, which is a different
 * fact and does not change when the negotiation does.
 */
export const BASE_LOCALE = 'en'

/** Is this a locale the product speaks? */
export function isSupportedLocale(code: string | null | undefined): boolean {
  return typeof code === 'string' && LOCALES.some(l => l.code === code)
}

/** The locale for a code, or the base locale. Never null, so no caller branches on absence. */
export function localeFor(code: string | null | undefined): Locale {
  return LOCALES.find(l => l.code === code) ?? LOCALES[0]
}

/**
 * The BCP-47 tag to hand a formatter, for a stored two-character code.
 *
 * The one function that closes the gap this file's header is about. Every `Intl` call in the
 * product goes through it rather than passing a `code` straight through.
 */
export function intlTagFor(code: string | null | undefined): string {
  return localeFor(code).intl
}

/**
 * The best supported locale for an `Accept-Language` header, or null.
 *
 * ── WHY IT IS PARSED BY HAND AND KEPT SO SIMPLE ─────────────────────────────────────
 * The header is a q-weighted list (`es-MX,es;q=0.9,en;q=0.8`) and a full implementation is a
 * dependency for something this product needs one answer from. So: split, drop the weights,
 * take the first entry whose PRIMARY SUBTAG the product speaks.
 *
 * Matching on the primary subtag rather than the whole tag is the load-bearing part —
 * `es-MX`, `es-419` and `es` must all find Spanish, and a family in Monterrey sends the first.
 * Comparing whole tags would send them English.
 *
 * `null` for "nothing matched", which the caller distinguishes from a stated preference. A
 * header is a hint about a browser, and a member who has chosen a language must always beat it.
 */
export function negotiateLocale(header: string | null | undefined): string | null {
  if (!header) return null
  for (const part of header.split(',')) {
    const tag = part.split(';')[0]?.trim().toLowerCase()
    if (!tag) continue
    const primary = tag.split('-')[0]
    if (isSupportedLocale(primary)) return primary
  }
  return null
}
