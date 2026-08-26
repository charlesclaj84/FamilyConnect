import { LOCALES, intlTagFor, type Locale } from '@/lib/i18n/locales'
import { translator, type Catalogue, type T } from '@/lib/i18n/t'
import { formatDate, type TimeAgo } from '@/lib/date-utils'
import { en } from '@/lib/i18n/en'
import { es } from '@/lib/i18n/es'

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
 * Today that is English and Spanish. `fr` is declared in `LOCALES` and has no catalogue yet,
 * which is a state worth being able to represent rather than one to hide: the column accepts
 * `'fr'`, a member could already have it stored, and `translate` falls back to English for every
 * key. Nothing breaks and nothing lies.
 *
 * ── WHY THE SWITCHER READS THIS ONE ─────────────────────────────────────────────────
 * **A control that offers a language the product cannot speak is a control that lies.** A member
 * choosing Español and getting an English screen has been told something false by the product,
 * not by a translator's backlog. So `availableLocales()` is what the switcher lists, and until
 * a second catalogue lands it returns one entry — at which point the switcher renders NOTHING,
 * because a picker with one option is furniture.
 *
 * Phase 3 built the plumbing and left this record holding one entry, so the switcher did not
 * render. Adding `es.ts` in Phase 4 is what made it appear — and that ONE LINE was the whole
 * edit, which is what the phase split was for.
 */
export const CATALOGUES: Record<string, Catalogue> = {
  en,
  es,
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

/**
 * `timeAgo`'s answer, as a sentence in the reader's language.
 *
 * ── ONE PLACE, BECAUSE THERE ARE THREE CALL SITES ───────────────────────────────────
 * The bell, the Dashboard's Recent Updates card and the Updates archive all print this. The
 * previous string-returning `timeAgo` was itself the fix for a worse version of that — a private
 * helper inside `NotificationBell.tsx` that the Dashboard then needed, and *"two copies of a
 * relative-time formatter is how a bell starts saying '2h ago' beside a card saying '2 hours
 * ago' about the same row."*
 *
 * Splitting the WORDS out of that module reopened the same risk one layer up, so the mapping
 * lives here rather than three times in JSX.
 *
 * ── PAST A DAY IT HANDS BACK TO `formatDate`, WITH THE LOCALE ───────────────────────
 * `timeAgo` deliberately returns the raw instant for that case rather than choosing a format,
 * so this is where the reader's locale is applied. `formatDate` reads the first ten characters,
 * which for an instant is its UTC calendar date — acceptable here and nowhere else: this is a
 * "when did that happen" caption where a day's imprecision at the boundary is invisible, and
 * `audit:time` would otherwise want `formatInstantDate` and a zone threaded three levels down
 * for a timestamp that says "3h ago" for the first day of its life.
 */
export function formatTimeAgo(value: TimeAgo, locale: string): string {
  const t = tFor(locale)
  switch (value.kind) {
    case 'now': return t('time.now')
    case 'minutes': return t('time.minutes', { n: value.n })
    case 'hours': return t('time.hours', { n: value.n })
    case 'date': return formatDate(value.iso, intlTagFor(locale)) ?? ''
  }
}
