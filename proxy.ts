import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'
import { isGatedPath } from '@/lib/features'
import { BASE_LOCALE, negotiateLocale } from '@/lib/i18n/locales'
import {
  LOCALE_HEADER,
  LOCALE_PATH_HEADER,
  LOCALE_PICK_COOKIE,
  isLocalizablePath,
  localePrefixRedirect,
  localizedHref,
  splitLocalePath,
} from '@/lib/i18n/route-locale'

// Serve the Coming Soon screen in place of a feature that hasn't shipped.
// Rewriting rather than redirecting keeps the original URL in the address bar,
// and `from` tells that page which feature to name. Existing query params are
// preserved because client-side navigations carry Next's own `_rsc` marker.
function comingSoon(request: NextRequest) {
  const url = request.nextUrl.clone()
  url.pathname = '/coming-soon'
  url.searchParams.set('from', request.nextUrl.pathname)
  return NextResponse.rewrite(url, { request })
}

/**
 * The public site's language is a path segment, and this is where it comes off the path.
 *
 * ── THREE THINGS, IN THIS ORDER, AND THE ORDER IS THE WHOLE DESIGN ──────────────────
 * `lib/i18n/route-locale.ts` argues why Home's language is in its URL while the Dashboard's is
 * in a column. What happens here is the mechanism:
 *
 *   1. `/en/...` REDIRECTS to the unprefixed path. English is served at one address only, so
 *      there is never a second URL for a crawler to weigh against the canonical one.
 *   2. `/es/...` and `/fr/...` REWRITE to the unprefixed path, carrying the locale in a request
 *      header. The address bar keeps `/es/pricing` — which is the point — and there is exactly
 *      one copy of every marketing page rather than one per language.
 *   3. An unprefixed path whose visitor's browser asks for a language we speak REDIRECTS to that
 *      language's address, once, unless they have chosen. First visit is negotiated; after that
 *      the URL says what they are reading.
 *
 * ── AND IT RUNS BEFORE EVERY OTHER DECISION IN THIS FILE ────────────────────────────
 * That is load-bearing rather than tidy. `isGatedPath()` longest-prefix-matches the feature
 * registry and `authRoutes` compares whole paths, so both of them are asking about a ROUTE — and
 * `/es/pricing` is not a route. Left after the rewrite, a locale-prefixed path would miss the
 * roadmap gate entirely: `/es/admin/reports` would sail past a screen that has not shipped and
 * 404 instead of answering Coming Soon, and every future gated route would gain a Spanish
 * address that bypassed its own gate.
 *
 * So everything below works on `route`, the unprefixed path, and `request.nextUrl.pathname` is
 * not read again after this.
 */
function localeRoute(request: NextRequest): {
  route: string
  locale: string
  rewrite: URL | null
  redirect: URL | null
} {
  const { pathname } = request.nextUrl

  // 1. English is never served prefixed. See route-locale.ts.
  const enRedirect = localePrefixRedirect(pathname)
  if (enRedirect && isLocalizablePath(enRedirect)) {
    const url = request.nextUrl.clone()
    url.pathname = enRedirect
    return { route: enRedirect, locale: BASE_LOCALE, rewrite: null, redirect: url }
  }

  const { locale, path, prefixed } = splitLocalePath(pathname)

  // 2. A prefixed marketing path is served by the unprefixed page, in that language.
  if (prefixed && isLocalizablePath(path)) {
    const url = request.nextUrl.clone()
    url.pathname = path
    return { route: path, locale, rewrite: url, redirect: null }
  }

  // A prefix in front of something that is not public — `/es/dashboard` — is not a route and is
  // left exactly as it arrived, so it 404s rather than being quietly served as the Dashboard.
  if (prefixed) return { route: pathname, locale: BASE_LOCALE, rewrite: null, redirect: null }

  // 3. First visit, negotiated. `LOCALE_PICK_COOKIE` is what makes the English option usable —
  // without it, choosing English from `/es` bounces straight back here. Only a browser asking
  // for a language that is NOT the base one moves anybody: a redirect from `/pricing` to
  // `/pricing` would be a loop.
  if (isLocalizablePath(pathname) && !request.cookies.has(LOCALE_PICK_COOKIE)) {
    const asked = negotiateLocale(request.headers.get('accept-language'))
    if (asked && asked !== BASE_LOCALE) {
      const url = request.nextUrl.clone()
      url.pathname = localizedHref(pathname, asked)
      return { route: pathname, locale: asked, rewrite: null, redirect: url }
    }
  }

  return { route: pathname, locale: BASE_LOCALE, rewrite: null, redirect: null }
}

export async function proxy(request: NextRequest) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? ''
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? ''

  // The language comes off the path first. `pathname` below is the ROUTE — see localeRoute().
  const { route: pathname, locale, rewrite, redirect: localeRedirect } = localeRoute(request)
  if (localeRedirect) return NextResponse.redirect(localeRedirect, 307)
  if (rewrite) {
    request.headers.set(LOCALE_HEADER, locale)
    request.headers.set(LOCALE_PATH_HEADER, request.nextUrl.pathname)
  }

  // Pass through if Supabase hasn't been configured yet — the roadmap gate is a
  // static decision, so it still applies without a session.
  if (!supabaseUrl.startsWith('http')) {
    if (isGatedPath(pathname)) return comingSoon(request)
    return rewrite ? NextResponse.rewrite(rewrite, { request }) : NextResponse.next({ request })
  }

  let supabaseResponse = rewrite
    ? NextResponse.rewrite(rewrite, { request })
    : NextResponse.next({ request })

  const supabase = createServerClient(
    supabaseUrl,
    supabaseKey,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          )
          // Rebuilt, and the rewrite has to be rebuilt with it: a plain `next()` here would
          // drop the locale rewrite the moment a session refresh rotated a cookie, so
          // `/es/pricing` would 404 for exactly the visitors whose token had just expired.
          supabaseResponse = rewrite
            ? NextResponse.rewrite(rewrite, { request })
            : NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  const {
    data: { user },
  } = await supabase.auth.getUser()

  const authRoutes = ['/login', '/register', '/forgot-password']
  const protectedRoutes = ['/dashboard']

  if (user && authRoutes.includes(pathname)) {
    return NextResponse.redirect(new URL('/dashboard', request.url))
  }

  if (!user && protectedRoutes.some((r) => pathname.startsWith(r))) {
    return NextResponse.redirect(new URL('/login', request.url))
  }

  // Member Approvals moved into Members & Access as its Pending Approval tab. The
  // redirect lives HERE rather than in the page it vacated because this is the only
  // place it can be a real 307: `redirect()` thrown from a page inside the (protected)
  // layout arrives after the shell has already streamed, so Next falls back to a
  // one-second `<meta http-equiv="refresh">` — which is what a bookmark and the link
  // in a pending member's notification would both have landed on.
  //
  // The page keeps its own redirect() as the fallback for any path that does not run
  // through this matcher. Cookies are copied across for the same reason the roadmap
  // gate copies them: a response built from scratch drops any rotated by the session
  // refresh above.
  if (pathname === '/admin/members/approvals') {
    const moved = NextResponse.redirect(new URL('/admin/members?tab=approvals', request.url))
    supabaseResponse.cookies.getAll().forEach((cookie) => moved.cookies.set(cookie))
    return moved
  }

  // Roadmap gate — see lib/features.ts for what is shipped. Kept after the
  // session refresh above so the rewrite still carries any rotated auth cookies.
  if (isGatedPath(pathname)) {
    const gated = comingSoon(request)
    supabaseResponse.cookies.getAll().forEach((cookie) => gated.cookies.set(cookie))
    return gated
  }

  return supabaseResponse
}

export const config = {
  // ── `api/` IS EXCLUDED, ADDED 2026-08-23 WITH THE FIRST ROUTE HANDLERS ─────────────
  // `/api/stripe/platform` and `/api/stripe/connect` are Stripe webhooks. They carry no cookie
  // and have no session, so everything this file does for them is waste — a GoTrue
  // `getUser()` round trip on a request that is authenticated by an HMAC over its own body,
  // sitting between Stripe's three-day retry window and a payment being recorded.
  //
  // It is also the safe direction rather than merely the cheap one. `isGatedPath()`
  // longest-prefix-matches the feature registry, so a future `FEATURES` entry whose href began
  // `/api` would start REWRITING webhook deliveries to the Coming Soon page — which answers
  // 200, so Stripe would record every delivery as accepted and never retry one. A whole
  // family's payments would go missing with nothing anywhere reporting a failure.
  //
  // `/auth/confirm` is deliberately NOT excluded: that route needs the session cookies this
  // file rotates, which is the whole reason it works.
  matcher: [
    '/((?!api/|_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
