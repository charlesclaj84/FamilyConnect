import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'
import { isGatedPath } from '@/lib/features'

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

export async function proxy(request: NextRequest) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? ''
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? ''
  const { pathname } = request.nextUrl

  // Pass through if Supabase hasn't been configured yet — the roadmap gate is a
  // static decision, so it still applies without a session.
  if (!supabaseUrl.startsWith('http')) {
    return isGatedPath(pathname) ? comingSoon(request) : NextResponse.next({ request })
  }

  let supabaseResponse = NextResponse.next({ request })

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
          supabaseResponse = NextResponse.next({ request })
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
