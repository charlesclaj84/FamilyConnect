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
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
