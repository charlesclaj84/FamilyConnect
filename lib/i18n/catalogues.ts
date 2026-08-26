import { LOCALES, type Locale } from '@/lib/i18n/locales'
import { translator, type Catalogue, type T } from '@/lib/i18n/t'
import { en } from '@/lib/i18n/en'

/**
 * Which languages the product can actually SPEAK, as opposed to which it intends to.
 *
 * ── TWO LISTS, AND THE DIFFERENCE IS THE HONEST PART ────────────────────────────────
 *
 *   `LOCALES` in `locales.ts`   what the product INTENDS to speak — en, es, fr. It is what
 *                               `people_locale_check` constrains, what the plan commits to, and
 *                               what a stored preference is allowed to be.
 *
 *   `CATALOGUES` here           what EXISTS. A locale is in here when its file is.
 *
 * Today that is English alone. `es` and `fr` are declared in `LOCALES` and have no catalogue
 * yet, which is a state worth being able to represent rather than one to hide: the column
 * accepts `'es'`, a member could already have it stored, and `translate` falls back to English
 * for every key. Nothing breaks and nothing lies.
 *
 * ── WHY THE SWITCHER READS THIS ONE ─────────────────────────────────────────────────
 * **A control that offers a language the product cannot speak is a control that lies.** A member
 * choosing Español and getting an English screen has been told something false by the product,
 * not by a translator's backlog. So `availableLocales()` is what the switcher lists, and until
 * a second catalogue lands it returns one entry — at which point the switcher renders NOTHING,
 * because a picker with one option is furniture.
 *
 * That is also the whole of Phase 3's proof: the plumbing is built, tested and wired, and
 * adding `es.ts` to this record is what makes it appear. No other edit.
 */
export const CATALOGUES: Record<string, Catalogue> = {
  en,
}

/**
 * The locales a member may actually choose — declared AND translated, in registry order.
 *
 * Ordered by `LOCALES` rather than by the keys of `CATALOGUES`, so the switcher's order is a
 * decision in one place and does not depend on which file happened to be imported first.
 */
export function availableLocales(): readonly Locale[] {
  return LOCALES.filter(l => l.code in CATALOGUES)
}

/**
 * Is there more than one language to choose between?
 *
 * The switcher's whole render condition, as a named function so the reason is stated once
 * rather than as a `.length > 1` in a component.
 */
export function hasLanguageChoice(): boolean {
  return availableLocales().length > 1
}

/**
 * A `t` bound to one language, with the registry already resolved.
 *
 * ── WHY A COMPONENT TAKES A `locale` STRING AND NOT A `t` FUNCTION ──────────────────
 * A function cannot cross the RSC boundary — props are serialized, so passing `t` from a
 * server component to a client one is not available even in principle. So the boundary carries
 * the LOCALE, which is a string, and each side builds its own `t` from the same registry.
 *
 * That is why `CATALOGUES` is a static import rather than something loaded per request: a
 * client component has to be able to reach it with no provider, no context and no loading
 * state. `lib/i18n/t.ts` records the bundle cost of that and the size at which it stops being
 * the right trade.
 */
export function tFor(locale: string): T {
  return translator(CATALOGUES, locale)
}
