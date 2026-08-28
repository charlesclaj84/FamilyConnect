import { cache } from 'react'
import { headers } from 'next/headers'
import { BASE_LOCALE, intlTagFor, isSupportedLocale } from '@/lib/i18n/locales'
import {
  LOCALE_HEADER,
  LOCALE_PATH_HEADER,
  splitLocalePath,
} from '@/lib/i18n/route-locale'
import { marketingT } from '@/lib/marketing/strings'
import { type T } from '@/lib/i18n/t'

/**
 * Which language is this PUBLIC page being read in?
 *
 * ── THE THIRD RESOLVER, AND IT ANSWERS A DIFFERENT QUESTION FROM THE OTHER TWO ──────
 * `resolveLocale` (`lib/auth/locale.ts`) answers *what language is the CALLER reading in* and
 * needs a session to do it well. `storedLocale` answers *what language does the RECIPIENT of
 * this mail read in*. This one answers *what language is this URL*, and the difference is not a
 * shade of the same question:
 *
 *   * There is no caller. Home has no session, and `resolveLocale(null)` falls through to
 *     `Accept-Language` — which is the right FIRST answer and the wrong LASTING one, because a
 *     reader who has navigated to `/es/pricing` has said what they want in the address bar and a
 *     header from their browser must not overrule it.
 *
 *   * The answer is already decided by the time a page renders. `proxy.ts` took the segment off
 *     the path and put it in a request header; this reads that header. No database, no
 *     negotiation, no round trip — which is why a marketing page costs nothing extra to
 *     translate, and why this is safe to call from `generateMetadata` where `resolveLocale`
 *     would have wanted a GoTrue call per page load.
 *
 * ── `cache()` IS PER REQUEST, AND THAT IS ALL IT IS FOR ─────────────────────────────
 * Six call sites on one page — the layout, the header, the page, `generateMetadata` — asking one
 * header. Nothing here identifies anybody, so unlike `lib/auth/current-user.ts` there is no
 * security consequence to getting the memo wrong; it is purely so a page can ask freely.
 *
 * ── THE FALLBACK IS ENGLISH AND IT IS NEVER NEGOTIATED ──────────────────────────────
 * No header means the path carried no prefix, which means the reader is on `/pricing`, which is
 * English's one address. Reaching for `Accept-Language` here would serve Spanish prose at the
 * canonical English URL — the duplicate-content problem `route-locale.ts` is built to avoid,
 * arriving through the back door. The negotiation belongs in `proxy.ts`, where it produces a
 * REDIRECT to an address that says what it serves.
 */
export const marketingLocale = cache(async (): Promise<string> => {
  try {
    const h = await headers()
    const named = h.get(LOCALE_HEADER)
    return isSupportedLocale(named) ? (named as string) : BASE_LOCALE
  } catch {
    // `headers()` throws outside a request scope. English rather than an exception, so this is
    // callable from anywhere — the same reasoning as `browserLocale()` in lib/auth/locale.ts.
    return BASE_LOCALE
  }
})

/**
 * The unprefixed route this page is, whatever address it was reached at.
 *
 * `/es/pricing` answers `/pricing`. Needed for the canonical URL and the `hreflang` set, both of
 * which are statements about the PAGE rather than about the request — so they have to be built
 * from the route, in every language, and then have one of them named as this request's own.
 *
 * Falls back to splitting the original path if the header is absent, which is the unprefixed
 * case and therefore already the route.
 */
export const marketingRoute = cache(async (): Promise<string> => {
  try {
    const h = await headers()
    const original = h.get(LOCALE_PATH_HEADER)
    return original ? splitLocalePath(original).path : '/'
  } catch {
    return '/'
  }
})

/**
 * Everything a public page needs to render in the reader's language.
 *
 * The marketing counterpart to `callerI18n`, and deliberately the same shape so a contributor
 * moving between the two halves of the product finds the same three fields:
 *
 *   `locale`  the two-character code. For `<html lang>`, for a link, for the picker.
 *   `t`       the translator, bound. **Nested server components take this as a prop** — see
 *             `lib/i18n/server.ts` for why that is a rule rather than a preference.
 *   `intl`    the BCP-47 tag, and the ONLY thing ever handed to a formatter. `/pricing` prints
 *             money, so this is not decoration: a bare `'es'` would group figures the
 *             Peninsular way for a family in Monterrey.
 */
export const marketingI18n = cache(async (): Promise<{ locale: string; t: T; intl: string }> => {
  const locale = await marketingLocale()
  return { locale, t: marketingT(locale), intl: intlTagFor(locale) }
})

