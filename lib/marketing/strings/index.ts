import { translator, type Catalogue, type T } from '@/lib/i18n/t'
import { LOCALES, type Locale } from '@/lib/i18n/locales'
import { marketingEn } from '@/lib/marketing/strings/en'
import { marketingEs } from '@/lib/marketing/strings/es'
import { marketingFr } from '@/lib/marketing/strings/fr'

/**
 * The marketing bundle — the fourth of the product's translation bundles.
 *
 * ── IT IS NOT `server-only`, AND IT IS NOT IN `catalogues.ts` EITHER ────────────────
 * The other three each had an easy answer to reachability and this one does not, so the reason
 * is worth stating rather than inferring from the absence of an import:
 *
 *   `lib/i18n/catalogues.ts`      a static import client components reach with no provider. The
 *                                 shell needs that — `ThemeToggle` renders on four layouts.
 *   `lib/email/strings`           `server-only`. Nothing in a browser composes mail.
 *   `lib/help/strings`            `server-only`. 35,000 words, rendered on the server.
 *   here                          neither, because marketing is BOTH.
 *
 * Home's copy is read by server components (`app/page.tsx`, the five `(marketing)` pages) AND by
 * client ones (`PlanLadder`, `Testimonials`, `FamilySizeSlider`, `MarketingHeader`) — so
 * `server-only` would break the build, and there is genuinely no way to keep this out of a
 * browser bundle.
 *
 * What keeps it out of the DASHBOARD's bundle is the import graph rather than a marker. Nothing
 * under `app/(protected)` imports this module, so Next's per-route splitting never puts it in
 * the chunk a signed-in member downloads. That is a weaker guarantee than `server-only` and it
 * is the honest one: it holds as long as nobody imports marketing copy into the product, and
 * `i18n:check`'s CLIENT-BUNDLE check is what would notice if the shell catalogue grew this
 * instead — which is the mistake this bundle exists to make impossible.
 *
 * ── SO WHY NOT JUST PUT IT IN THE SHELL CATALOGUE ───────────────────────────────────
 * Because the shell catalogue is the one module every signed-in page loads. Marketing is a few
 * hundred keys of prose that no Dashboard screen reads, three times over, and putting it there
 * would charge every member of every family for the sales copy on every page load — forever,
 * and invisibly, since a bundle does not report what it is carrying.
 *
 * ── ONE MECHANISM, FOUR BUNDLES ─────────────────────────────────────────────────────
 * Same `Catalogue`, same `translator`, same fingerprint file, same gate. `BUNDLES` in
 * `scripts/i18n-coverage.mjs` gets a fourth entry and every check applies here unchanged,
 * including the STALE detection that is the reason to key marketing copy at all: `/pricing` and
 * `/features` are reviewed prose that `marketing:check` already walks against the plan registry,
 * and a translated bullet that has since been re-priced in English needs to be findable by name.
 */
const MARKETING_CATALOGUES: Record<string, Catalogue> = {
  en: marketingEn,
  es: marketingEs,
  fr: marketingFr,
}

/**
 * A `t` for the public site, bound to one language.
 *
 * Falls back to the English per key, which for marketing is the direction that costs least: an
 * untranslated bullet reads as an English line in a Spanish page, where a key name would read as
 * a broken page — and this is the surface where a broken page is somebody deciding not to sign
 * up.
 */
export function marketingT(locale: string): T {
  return translator(MARKETING_CATALOGUES, locale)
}

/**
 * The languages the PUBLIC SITE can be read in, in registry order.
 *
 * Deliberately its own answer rather than `availableLocales()` from `catalogues.ts`. That one
 * reports what the SHELL speaks and is what the Dashboard's picker offers; this reports what
 * Home speaks and is what the marketing header's picker offers. They are equal today and the
 * split is what lets them not be — a language could reach Home before the Dashboard or the other
 * way round, and each picker should then offer what its own side can actually read.
 */
export function marketingLocales(): readonly Locale[] {
  return LOCALES.filter(l => l.code in MARKETING_CATALOGUES)
}

/** Is there more than one language to offer a visitor? The picker's whole render condition. */
export function hasMarketingLanguageChoice(): boolean {
  return marketingLocales().length > 1
}

/** Exposed for `i18n:check`. Not for the app — use `marketingT`. */
export const MARKETING_BUNDLE = MARKETING_CATALOGUES
