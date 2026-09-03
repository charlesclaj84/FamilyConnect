import { type EmailOtpType } from '@supabase/supabase-js'
import { type NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { safeNext } from '@/lib/safe-next'

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

// `next` is validated by lib/safe-next.ts, which the sign-in form shares — see there for
// why an unvalidated value on this route in particular would be an open redirect sitting
// on the one URL users are told to trust from an email.

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
    // "Sign in to request a new one" until 2026-08-17, and by then it was false: there was
    // nothing to request. Signing in with an unconfirmed account is refused outright, which
    // is what made this the dead end TODO.md called it. `LoginForm` now offers **Send the
    // link again** on exactly that refusal, so the sentence names the thing that happens.
    return fail('That confirmation link has expired or has already been used. Try signing in below and we will offer to send you a fresh one.')
  }

  // Recovery lands on the password form rather than the dashboard — the user asked to
  // change their password, and a session alone does not do that for them.
  //
  // This pointed at `/forgot-password?stage=reset` until 2026-08-11, and that page ignores
  // the query: it renders the "enter your email" form, so clicking the link in a reset
  // email asked you to request a reset email. Meanwhile ForgotPasswordForm's redirectTo
  // named `/update-password`, which did not exist. Two destinations, both wrong, neither
  // reachable by the other. `/update-password` is now real and is the single answer.
  if (type === 'recovery') {
    return NextResponse.redirect(new URL('/update-password', request.url))
  }

  // OPEN THE FAMILY THEY CHOSE. `verifyOtp` above has just written session cookies, so this
  // is a sign-in like any other and inherits the stale-active-selection problem
  // `20260902000002` fixes — a member confirming an email change, or following a signup link
  // on a second device, would otherwise land in whichever family they last looked at.
  //
  // NOT ON THE RECOVERY BRANCH, deliberately: that lands on `/update-password`, which reads
  // no family data at all, and `UpdatePasswordForm` signs them in properly afterwards. A call
  // here would be a database write on the way to a page that cannot use it.
  //
  // Called with the same `supabase` client the verification used, so `auth.uid()` is the
  // session that was just created.
  //
  // WRAPPED, and the reason is the same one that broke sign-in: `supabase.rpc` REJECTS on a
  // dropped connection or a cold start rather than returning an `error`, and an unhandled
  // rejection in a route handler is a 500 — so a preference nobody would miss would turn a
  // confirmation link into a dead end, with the account already confirmed and no way to
  // notice from the URL. The redirect below is the thing the member clicked for.
  //
  // Not `openDefaultFamilySafely`: that wrapper exists to survive the ACTION CALL from a
  // browser, and this is server code holding the client that just verified the token — going
  // through a server action here would be a second request re-reading the same cookies.
  try {
    const { error } = await supabase.rpc('open_default_family')
    if (error) console.error(`[auth/confirm] open_default_family: ${error.message}`)
  } catch (e) {
    console.error(`[auth/confirm] open_default_family threw: ${e instanceof Error ? e.message : e}`)
  }

  return NextResponse.redirect(new URL(next, request.url))
}
