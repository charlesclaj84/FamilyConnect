import { type EmailOtpType } from '@supabase/supabase-js'
import { type NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

/**
 * Where a confirmation email lands. The piece that did not exist while
 * `enable_confirmations` was false, and the reason it could not simply be flipped on.
 *
 * WHY token_hash AND NOT THE DEFAULT LINK
 *   GoTrue's default `{{ .ConfirmationURL }}` points at its own /auth/v1/verify, which
 *   confirms and then redirects to site_url with the session in the URL **fragment**.
 *   A fragment is never sent to the server, so a cookie-based app — which this is,
 *   via @supabase/ssr — gets a confirmed user and no session, and the browser lands on
 *   a signed-out page having apparently done nothing.
 *
 *   So the template (supabase/templates/confirmation.html) links here with a
 *   `token_hash` instead, and verifyOtp() below exchanges it server-side. The session
 *   cookies are written by the same cookie plumbing every other request uses, so the
 *   redirect at the end arrives signed in.
 *
 * WHAT IT ACCEPTS
 *   `type` covers signup and email-change confirmations, plus recovery and magiclink,
 *   so one route serves every email GoTrue can send. `next` is where to go afterwards
 *   and is validated below — it arrives in a URL, which makes it attacker-controlled.
 *
 * ONE-SHOT BY DESIGN. A token_hash is consumed by the first verifyOtp() that succeeds,
 * so a second click on the same link fails. That is correct, and it is why the error
 * copy says "expired or already used" rather than blaming the user.
 */

/** Types GoTrue can send here. Anything else is not a link we issued. */
const ALLOWED_TYPES: readonly EmailOtpType[] = [
  'signup', 'email_change', 'recovery', 'magiclink', 'invite', 'email',
]

/**
 * `next` comes off the query string, so an unvalidated redirect here is an open
 * redirect wearing our domain — the classic phishing primitive, and it would be sitting
 * on the one URL users are told to trust from an email. Only a same-origin ABSOLUTE
 * PATH is accepted: a value starting `//` or `/\` is a protocol-relative URL to
 * somewhere else and is rejected along with everything that names a host.
 */
function safeNext(raw: string | null): string {
  if (!raw) return '/dashboard'
  if (!raw.startsWith('/')) return '/dashboard'
  if (raw.startsWith('//') || raw.startsWith('/\\')) return '/dashboard'
  return raw
}

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl
  const tokenHash = searchParams.get('token_hash')
  const type = searchParams.get('type') as EmailOtpType | null
  const next = safeNext(searchParams.get('next'))

  const fail = (reason: string) =>
    NextResponse.redirect(new URL(`/login?error=${encodeURIComponent(reason)}`, request.url))

  if (!tokenHash || !type || !ALLOWED_TYPES.includes(type)) {
    return fail('That confirmation link is not valid. Try registering again.')
  }

  const supabase = await createClient()
  const { error } = await supabase.auth.verifyOtp({ type, token_hash: tokenHash })

  if (error) {
    return fail('That confirmation link has expired or has already been used. Sign in to request a new one.')
  }

  // Recovery lands on the password form rather than the dashboard — the user asked to
  // change their password, and a session alone does not do that for them.
  if (type === 'recovery') {
    return NextResponse.redirect(new URL('/forgot-password?stage=reset', request.url))
  }

  return NextResponse.redirect(new URL(next, request.url))
}
