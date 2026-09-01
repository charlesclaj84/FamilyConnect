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
  /**
   * Which way the language is READ. `'ltr'` or `'rtl'`, and it is the `dir` attribute verbatim.
   *
   * ── A THIRD CODE, AND IT IS NOT DERIVABLE FROM THE OTHER TWO ────────────────────
   * The header above says two codes per locale and that conflating them is a real bug. This is
   * a third fact about the same locale and it is neither of them: `code` is an identity,
   * `intl` decides how digits are grouped, and this decides which side of the page everything
   * starts on. `Intl.Locale.prototype.getTextInfo()` can answer it at runtime — and is not used
   * here, deliberately: it is stated rather than computed so that the whole registry can be read
   * as data, `proxy.ts` can consult it at the edge without constructing an `Intl.Locale`, and
   * `lib/i18n/direction.ts` stays a pure module `npm test` can exercise.
   *
   * ── IT IS REQUIRED RATHER THAN OPTIONAL, AND THAT IS THE POINT ──────────────────
   * An optional `dir` would default to `'ltr'` and the first right-to-left language somebody
   * added would be silently laid out backwards — which is precisely the failure mode
   * `FEATURES.tier` having no default exists to prevent, in a different costume. Adding a
   * locale is a decision about direction, so the type makes it one.
   *
   * ── AND IT IS NOT A FLAG, FOR THE SAME REASON THERE ARE NO FLAGS ────────────────
   * Direction belongs to a SCRIPT rather than to a language: Kurdish is written in both
   * directions depending on where it is spoken, and Azerbaijani has been written in three
   * alphabets in one century. A locale that ever needs to distinguish those is a locale that
   * needs its own row here, not a cleverer function.
   */
  dir: TextDirection
}

/** Which way a language is read. The `dir` attribute's two values, and nothing else. */
export type TextDirection = 'ltr' | 'rtl'

/**
 * Every locale, in the order the switcher lists them.
 *
 * English first because it is the source language and the fallback; the rest alphabetical by
 * code, which is stable and needs no decision when a fourth arrives.
 */
export const LOCALES: readonly Locale[] = [
  { code: 'en', endonym: 'English',  intl: 'en-US', dir: 'ltr' },
  { code: 'es', endonym: 'Español',  intl: 'es-MX', dir: 'ltr' },
  { code: 'fr', endonym: 'Français', intl: 'fr-FR', dir: 'ltr' },
  // ── NO RIGHT-TO-LEFT LOCALE IS SHIPPED, AND THE LAYOUT IS READY FOR ONE ─────────
  // Added 2026-09-01. TODO.md's language list puts Arabic seventh and says, in as many words,
  // that *"THE FIRST RTL LANGUAGE IS NOT A CATALOGUE, IT IS A LAYOUT PASS"* and *"do not let
  // Arabic be the language somebody adds on a Friday."* The layout pass is done and this row is
  // deliberately NOT here: a locale in this array is a locale the switcher offers, and offering
  // Arabic over 5,682 English keys would tell a reader their language counts and then not speak
  // it — which is the same failure the Haitian Creole entry in that list is about.
  //
  // WHAT ADDING ONE NOW COSTS: four catalogue files and one row. `dir: 'rtl'` is honoured by
  // `<html dir>`, by the boot script, by `LocaleSync`, and by every layout utility in `app/`
  // and `components/`, which `npm run i18n:rtl` holds at zero physical direction properties.
  // `npm run i18n:onscreen -- --force-rtl` renders every route mirrored today, with no such
  // locale existing, which is how any of this was checked at all.
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
/**
 * A stored `people.locale` narrowed to something a catalogue can be looked up with.
 *
 * ── THE RECIPIENT'S HALF OF THE RESOLUTION, AND IT MUST NOT BE `resolveLocale` ──────
 * `lib/auth/locale.ts` answers *what language is the CALLER reading in*, and its second source
 * is the `Accept-Language` header. For a piece of MAIL that header is the wrong browser
 * entirely: it belongs to the administrator pressing Send, not to the relative who will open
 * the message. Falling through to it would mail an English-speaking treasurer's whole family in
 * English however many of them had chosen Spanish — silently, and only ever visible to them.
 *
 * So a recipient path reads the stored column and narrows it with this. There is no second
 * source and there must not be: what the reader chose, or the language the catalogue is
 * written in. A `null` is genuine evidence — the member has not chosen — and English is the
 * honest answer to it.
 */
export function storedLocale(value: string | null | undefined): string {
  return isSupportedLocale(value) ? (value as string) : BASE_LOCALE
}

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


/**
 * Which of the reader's four possible answers wins.
 *
 * ── WHY THIS IS A FUNCTION AND NOT FOUR ¤??¤ IN `resolveLocale` ────────────────────
 * It was exactly that, and the fourth source arrived in 2026-08-27 by INSERTING a term in
 * the middle of the chain — which is the shape of edit that is easy to get subtly wrong and
 * impossible to test where it lived: ¤resolveLocale¤ reads ¤next/headers¤ and queries
 * Supabase, and AGENTS.md §7b draws ¤lib/**‍/*.test.ts¤ as a BOUNDARY around modules that do
 * neither. So the ORDER is here, where ¤npm test¤ can reach it, and the impure resolver is
 * three reads and one call.
 *
 * The order, and the argument for each rung:
 *
 *   1. ¤chosen¤     ¤people.locale¤ — what the member set on My Profile. An explicit
 *                   statement about the READER, so nothing outranks it.
 *   2. ¤addressed¤  the ¤/es¤ or ¤/fr¤ in the URL. A statement about this PAGE. Below a
 *                   stored choice, because a member who set Spanish and then opened an
 *                   English-addressed link has not changed their mind. Above the browser,
 *                   because a path segment is something somebody navigated to and
 *                   ¤Accept-Language¤ is something their browser was configured with.
 *   3. ¤asked¤      ¤Accept-Language¤.
 *   4. ¤BASE_LOCALE¤  English, which the catalogue is written in. Always answers, so no
 *                   caller branches on "we do not know".
 *
 * Every argument is optional and an unsupported value is treated as absent rather than as
 * an error — a locale arriving from a header, a URL or a column may be anything at all, and
 * the fallback is what this function is for.
 */
export function preferredLocale({ chosen, addressed, asked }: {
  chosen?: string | null
  addressed?: string | null
  asked?: string | null
}): string {
  for (const candidate of [chosen, addressed, asked]) {
    if (isSupportedLocale(candidate)) return candidate as string
  }
  return BASE_LOCALE
}
