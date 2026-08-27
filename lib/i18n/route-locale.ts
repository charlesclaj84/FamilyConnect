import { BASE_LOCALE, isSupportedLocale, LOCALES } from '@/lib/i18n/locales'

/**
 * The public site's language lives in the URL. This is the parser and the builder for that.
 *
 * ── PURE, AND ON THE CLIENT SIDE OF THE LINE ────────────────────────────────────────
 * One import, of another pure module. `proxy.ts` runs this at the edge, the marketing pages run
 * it on the server, and the language picker in the marketing header is a client component that
 * builds its own hrefs with it — so anything server-shaped in here would reach all three and
 * break the first two. Keep it clean, the way `lib/i18n/locales.ts` is kept clean.
 *
 * ── WHY A PATH SEGMENT HERE AND A COLUMN ON THE DASHBOARD ───────────────────────────
 * Two mechanisms for one question, and the split is not an inconsistency — it follows from
 * AGENTS.md's first rule about the two halves of this product: **Home is indexed and the
 * Dashboard is not.**
 *
 *   * The Dashboard reads `people.locale`, because it knows who is asking and the answer should
 *     follow that member to every device. There is nothing to crawl and no URL to share.
 *
 *   * Home has no caller to ask. What it has is a crawler and a reader who forwards a link, and
 *     both of those need the language to be part of the ADDRESS: `Accept-Language` alone serves
 *     one URL three different ways, which a search engine cannot index as three pages and a
 *     reader cannot send to a Spanish-speaking cousin. `hreflang` needs distinct URLs to point
 *     at. So `/es/pricing` is a real page at a real address.
 *
 * `Accept-Language` is still the FIRST-VISIT answer — `proxy.ts` sends a visitor whose browser
 * asks for Spanish to `/es`, once, and the URL then says what they are reading. The header
 * chooses; the path records.
 *
 * ── ENGLISH IS UNPREFIXED, AND `/en/...` REDIRECTS RATHER THAN SERVING ──────────────
 * `/pricing`, never `/en/pricing`. Two reasons, and the second is the one that would cost real
 * traffic:
 *
 *   * Every link that exists today points at the unprefixed path — `app/sitemap.ts`, the
 *     manual's `[label](/route)` links, `lib/features.ts`, anything anybody has bookmarked.
 *     Prefixing English would 301 the entire public site to buy symmetry.
 *
 *   * Serving BOTH would be the duplicate-content problem `hreflang` exists to prevent: one
 *     page reachable at two addresses, with a crawler having to guess which is canonical. So
 *     `/en/pricing` is a redirect to `/pricing` and never a page — `localePrefixRedirect`
 *     below is what says so, and `proxy.ts` is where it is honoured.
 *
 * ── WHAT IS PREFIXABLE IS A LIST, AND IT IS A LIST ON PURPOSE ───────────────────────
 * `LOCALIZED_ROOTS`. Not "everything outside `(protected)`", which would be derived and
 * therefore better — except that the thing to derive from does not exist: there is no registry
 * of marketing routes the way `lib/features.ts` is a registry of Dashboard ones, and inventing
 * one to hold six paths would be a second place for them to drift.
 *
 * The cost of the list is that a NEW public page needs a line in it, and forgetting that is a
 * page whose Spanish URL 404s. `lib/i18n/route-locale.test.ts` asserts every marketing route
 * that exists is on it, walking `app/` — so the gate is a test rather than a promise.
 *
 * **The auth pages are on it, and that is the hole it was widened to close.** A visitor reading
 * `/es/pricing` who presses *Create your free account* lands on `/es/register`; without the
 * prefix they would land on `/register`, which resolves its language from `Accept-Language` and
 * would hand an English form to somebody who has been reading Spanish for four pages. The
 * language they chose has to survive the one click that matters.
 */

/** The one request header the rewrite carries. Read it with `pathLocale()`. */
export const LOCALE_HEADER = 'x-genorra-locale'

/** The original, prefixed pathname, so a page can name its own canonical URL. */
export const LOCALE_PATH_HEADER = 'x-genorra-locale-path'

/**
 * The cookie that records a visitor having CHOSEN, rather than been negotiated for.
 *
 * ── WHY IT HAS TO EXIST, AND WHY THE PICKER WRITES IT RATHER THAN THE SERVER ────────
 * `proxy.ts` sends a first-time visitor whose browser asks for Spanish from `/pricing` to
 * `/es/pricing`, which is the right first answer and the wrong second one: a reader on `/es` who
 * presses **EN · English** goes to `/pricing`, where the same negotiation would bounce them
 * straight back. Without this cookie the English option is a control that cannot be used.
 *
 * It is written in the BROWSER, by the picker, immediately before it navigates — not by a server
 * action and not by the response to the navigation. Two reasons:
 *
 *   * The picker's items are real `<a>` elements, so that cmd-click and copy-link-address work
 *     on them, which is the whole point of the language being in the URL. An `<a>` cannot carry
 *     a server round trip, and turning it into a button to buy one would take the addresses
 *     away again.
 *   * Setting it from the response would mean the redirect and the cookie race: the reader has
 *     already been bounced by the time anything could have recorded that they meant it.
 *
 * A year, `SameSite=Lax`, no `Secure` flag decision to make — it is a UI preference and holds no
 * identity, so it is not `httpOnly` and does not need to be: the value is one of three strings
 * the visitor just chose out loud.
 */
export const LOCALE_PICK_COOKIE = 'genorra-locale-pick'

/** One year. Long enough that a returning reader is not re-negotiated for. */
export const LOCALE_PICK_MAX_AGE = 60 * 60 * 24 * 365

/**
 * The public paths a `/es` or `/fr` prefix may sit in front of.
 *
 * `'/'` means Home itself. Everything else matches the path and anything under it, so one entry
 * covers a route and its children. Kept in the order they appear in the marketing header, which
 * is the order a reader meets them.
 */
export const LOCALIZED_ROOTS: readonly string[] = [
  '/',
  '/about',
  '/features',
  '/how-it-works',
  '/pricing',
  '/why-us',
  // The sign-in and sign-up flow. See the header: a reader who has been on Spanish Home for
  // four pages must not be handed an English form by the one click that matters.
  '/login',
  '/register',
  '/forgot-password',
  '/reset-password',
] as const

/** Is this unprefixed path one a locale segment may sit in front of? */
export function isLocalizablePath(path: string): boolean {
  if (path === '/') return true
  return LOCALIZED_ROOTS.some(root => root !== '/' && (path === root || path.startsWith(root + '/')))
}

export interface SplitPath {
  /** The locale the path names, or `BASE_LOCALE` where it names none. */
  locale: string
  /** The path with any locale segment removed. Always starts with `/`. */
  path: string
  /** Did the path actually carry a segment? Distinguishes `/es` from a defaulted `/`. */
  prefixed: boolean
}

/**
 * Split a request path into the locale it names and the route underneath.
 *
 * `/es/pricing` → `es`, `/pricing`, prefixed. `/pricing` → `en`, `/pricing`, not prefixed.
 * `/es` → `es`, `/`, prefixed — a bare segment is Home, which is why the empty remainder
 * becomes `/` rather than being left as `''` for a caller to normalise.
 *
 * An unsupported segment is not a locale: `/de/pricing` comes back as `en` and `/de/pricing`,
 * so it 404s as the unknown route it is rather than being quietly served as English Home.
 */
export function splitLocalePath(pathname: string): SplitPath {
  const [, first = '', ...rest] = pathname.split('/')
  if (!isSupportedLocale(first)) {
    return { locale: BASE_LOCALE, path: pathname || '/', prefixed: false }
  }
  const remainder = rest.join('/')
  return { locale: first, path: remainder ? `/${remainder}` : '/', prefixed: true }
}

/**
 * The address of one unprefixed path in one language.
 *
 * `localizedHref('/pricing', 'es')` → `/es/pricing`; the same in `en` → `/pricing`. Home is the
 * case worth stating: `'/'` in Spanish is `/es` and not `/es/`, because a trailing slash on a
 * bare segment is a second address for the same page and Next normalises it away anyway.
 *
 * A path that is not localizable comes back unchanged in every language. That is deliberate
 * rather than a refusal: the marketing footer links to `/help` and to Dashboard routes, and
 * prefixing those would build addresses that do not exist.
 */
export function localizedHref(path: string, locale: string): string {
  if (!isSupportedLocale(locale) || locale === BASE_LOCALE) return path
  if (!isLocalizablePath(path)) return path
  return path === '/' ? `/${locale}` : `/${locale}${path}`
}

/**
 * Where a `/en/...` request should be sent, or null if it is fine as it is.
 *
 * Separated from the rewrite so the rule is stated once and testable without a request. See the
 * header on why English is never served prefixed.
 */
export function localePrefixRedirect(pathname: string): string | null {
  const [, first = '', ...rest] = pathname.split('/')
  if (first !== BASE_LOCALE) return null
  const remainder = rest.join('/')
  return remainder ? `/${remainder}` : '/'
}

/**
 * Every language's address for one unprefixed path, for `alternates.languages`.
 *
 * Includes English at its unprefixed address, which is what makes the set complete — a
 * `hreflang` group that names two of three languages tells a crawler the third is unrelated.
 *
 * Derived from `LOCALES` rather than from `CATALOGUES`, and the difference is worth stating
 * because it is the one place the two registries could sensibly disagree. `CATALOGUES` holds the
 * languages that EXIST, which is what the picker must offer — a control listing a language the
 * product cannot speak is a control that lies. `hreflang` is a claim about ADDRESSES, and every
 * address in `LOCALES` resolves: an untranslated page at `/fr/pricing` serves English prose at a
 * French URL, which is a thin page rather than a broken one. They are equal today, so nothing
 * turns on it; importing `CATALOGUES` here would pull all three catalogues into the edge bundle
 * `proxy.ts` builds from this module, which is the reason not to.
 */
export function localeAlternates(path: string): Record<string, string> {
  const out: Record<string, string> = {}
  for (const { code } of LOCALES) out[code] = localizedHref(path, code)
  return out
}
