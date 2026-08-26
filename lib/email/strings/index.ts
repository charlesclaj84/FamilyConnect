import 'server-only'

import { translator, type Catalogue, type T } from '@/lib/i18n/t'
import { emailEn } from '@/lib/email/strings/en'
import { emailEs } from '@/lib/email/strings/es'
import { emailFr } from '@/lib/email/strings/fr'

/**
 * The email bundle — the second of the product's translation bundles.
 *
 * ── `import 'server-only'` IS THE ENFORCEMENT, NOT A LABEL ──────────────────────────
 * Email prose is composed by server actions and read by nothing in a browser. Putting it in
 * `lib/i18n/catalogues.ts` would have shipped the text of six emails to every reader, because
 * that module is a static import reachable from client components by design.
 *
 * `server-only` makes an accidental import a BUILD failure rather than a silent bundle. That is
 * the layer that matters: `i18n:check` also greps for the import from `'use client'` files, but a
 * grep is a second opinion and this is the gate. Same reasoning as
 * `lib/meta/no-client-secrets.test.ts` — which caught `ZONE_HINT_COOKIE` dragging the
 * service-role client across the boundary, a failure that was invisible until something looked.
 *
 * ── ONE MECHANISM, TWO BUNDLES ──────────────────────────────────────────────────────
 * Deliberately the same `Catalogue`, the same `translate`, the same fingerprint file and the same
 * gate — only the module and its reachability differ. A second translation MECHANISM is what
 * would actually cost something: two ways to look a string up is two ways for a stale
 * translation to hide.
 *
 * Phase 5's manual is the third bundle and inherits all of it.
 */
const EMAIL_CATALOGUES: Record<string, Catalogue> = {
  en: emailEn,
  es: emailEs,
  fr: emailFr,
}

/**
 * A `t` for email prose, bound to one language.
 *
 * Falls back to English per key, exactly as the shell does — so a template using a key Spanish
 * has not translated sends that one sentence in English rather than failing to send. For mail
 * that is the right direction: a message that arrives partly in the wrong language is better
 * than one that does not arrive.
 */
export function emailT(locale: string): T {
  return translator(EMAIL_CATALOGUES, locale)
}

/** Exposed for `i18n:check`. Not for the app — use `emailT`. */
export const EMAIL_BUNDLE = EMAIL_CATALOGUES
