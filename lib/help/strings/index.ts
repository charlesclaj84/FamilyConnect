import 'server-only'

import { translator, type Catalogue, type T } from '@/lib/i18n/t'
import { deriveHelpEnglish } from '@/lib/help/keys'
import { helpEs } from '@/lib/help/strings/es'
import { helpFr } from '@/lib/help/strings/fr'

/**
 * The manual bundle — the third of the product's translation bundles.
 *
 * ── `server-only`, FOR THE SAME REASON THE EMAIL BUNDLE IS ──────────────────────────
 * 43 chapters and 35,000 words. `lib/i18n/catalogues.ts` is a static import reachable from
 * client components by design, so putting the manual there would ship the whole thing — three
 * times over — to every reader of every page. The manual is rendered on the server and read
 * nowhere else, so nothing needs it in a browser.
 *
 * `lib/help/content.ts` itself stays PURE and must: three surfaces read a chapter (the contents
 * page, the chapter page, and `generateMetadata`, which needs the summary before anything
 * renders), and the page resolves a slug and 404s on a bad one before deciding to render at all.
 * Marking that file `server-only` would be harmless today and would take away the property that
 * makes it usable as data.
 *
 * ── THE ENGLISH IS DERIVED ──────────────────────────────────────────────────────────
 * `deriveHelpEnglish()` reads it out of the content tree, so there is one English manual rather
 * than two. `lib/help/keys.ts` carries that argument at length; the short version is that
 * AGENTS.md requires a screen change to edit its chapter in the same commit, and a second
 * hand-written English would mean that edit had to land twice.
 *
 * ── ONE MECHANISM, THREE BUNDLES ────────────────────────────────────────────────────
 * Same `Catalogue`, same `translate`, same fingerprint file, same gate — only the module and its
 * reachability differ. `scripts/i18n-coverage.mjs`'s `BUNDLES` array gets a third entry and every
 * check it makes applies here with no further edit, including the STALE detection that is the
 * whole reason to key the manual rather than keep a parallel document per language.
 */
const HELP_CATALOGUES: Record<string, Catalogue> = {
  en: deriveHelpEnglish(),
  es: helpEs,
  fr: helpFr,
}

/**
 * A `t` for the manual, bound to one language.
 *
 * Falls back to the English per key, so a chapter nobody has translated yet renders in English
 * rather than as a page of key names — and a chapter translated except for one paragraph reads
 * as a Spanish chapter with an English paragraph in it. For a manual that is the right
 * direction: a reader who can see the words can act on them.
 */
export function helpT(locale: string): T {
  return translator(HELP_CATALOGUES, locale)
}

/** Exposed for `i18n:check`. Not for the app — use `helpT`. */
export const HELP_BUNDLE = HELP_CATALOGUES
