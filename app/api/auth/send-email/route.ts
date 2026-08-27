import { NextResponse, type NextRequest } from 'next/server'

import { verifyHookSignature } from '@/lib/auth/hook-signature'
import { authMailLocale } from '@/lib/auth/locale'
import {
  authConfirmEmail,
  authEmailChangeEmail,
  authInviteEmail,
  authReauthEmail,
  authRecoveryEmail,
} from '@/lib/email/auth-mail'
import { emailOrigin, sendEmail } from '@/lib/email/send'

/**
 * GoTrue's Send Email hook — the five auth emails, composed by us, in the reader's language.
 *
 * Enable it with `[auth.hook.send_email]` in `supabase/config.toml` pointing here, and the
 * same secret in `SUPABASE_AUTH_HOOK_SECRET`. When it is on, GoTrue sends NOTHING itself:
 * measured, and it is the whole point — `supabase/templates/*.html` are never rendered, and
 * what a member receives is what `lib/email/auth-mail.ts` composed.
 *
 * ── THIS IS A PUBLIC ENDPOINT THAT SENDS EMAIL. READ `lib/auth/hook-signature.ts` ───
 * There is no cookie, no session and no permission in front of it, because the caller is a Go
 * process in another container. The signature is the entire gate, and it is checked before
 * anything else happens — before the body is parsed, before a locale is resolved, before a
 * single byte is composed.
 *
 * `request.text()` FIRST, and the parse from that same string. The HMAC is over the bytes
 * GoTrue sent, and `JSON.parse` then `JSON.stringify` does not round trip — a route that
 * verified a re-serialization would reject every real request.
 *
 * ── THE RECIPIENT COMES FROM THE SIGNED PAYLOAD AND FROM NOWHERE ELSE ─────────────
 * Not from a query string, not from a header, not from the body's unsigned parts — there are
 * none. `lib/email/README.md`'s rule about never exporting a sender is the same rule one layer
 * out: an endpoint that accepted a recipient would be an open relay on a domain carrying our
 * SPF and DKIM, and this one does not have a parameter to accept.
 *
 * ── A FAILURE MUST BE A NON-2xx, AND GoTrue TAKES IT SERIOUSLY ────────────────────
 * Measured against v2.195.0: a 500 from here made `POST /signup` answer
 * `unexpected_failure` AND **rolled the signup back entirely** — no `auth.users` row was
 * created.
 *
 * A 500 RESPONSE IS NOT RETRIED. An UNREACHABLE ENDPOINT IS — and the two are worth keeping
 * apart, because the second was measured by accident: with the hook enabled and the dev server
 * stopped, an action answered `Failed to reach hook after maximum retries`. So GoTrue
 * distinguishes "the hook said no" from "the hook was not there", retries only the latter, and
 * gives up with a message naming the retries. Which means a deliberate refusal from here is
 * final and a deployment gap is not — the right way round.
 *
 * That is the SAFE direction and it decides the error handling below. No account exists
 * without its confirmation email having been sent, so there is no half-state to reconcile;
 * the member simply tries again. Which means `sendEmail`'s soft failure — correct everywhere
 * else in `lib/email/`, because every other call site runs after a decision is committed — has
 * to be READ here and turned into a 500. Swallowing it into a 200 would create an account
 * nobody can confirm.
 *
 * ── AND AN UNKNOWN ACTION TYPE ANSWERS 200, WHICH IS THE COUNTERINTUITIVE HALF ────
 * `magiclink` is the case. Nothing in this product offers a sign-in link — `/login` is a
 * password form — but `POST /auth/v1/otp` is reachable with the anon key that ships in the
 * browser bundle, so somebody can ask for one. If this route refused, that endpoint would
 * answer 500 for an address that HAS an account and 200 for one that does not, because GoTrue
 * calls the hook only when there is something to send.
 *
 * **That is an account-enumeration oracle**, and it is exactly the leak `ForgotPasswordForm`
 * and `LoginForm` are written to avoid — see `lib/email/README.md`, where `over_email_send_rate_limit`
 * is refused for the same reason. So an action type with nothing to send answers 200 and sends
 * nothing, and the response is identical for every address.
 *
 * The cost is stated rather than hidden: a NEW auth flow added later is silently mailless until
 * this route learns it. `scripts/auth-email-check.mjs` walks every type GoTrue can produce and
 * is what catches that.
 */
export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/** What GoTrue sends. Only the fields this route reads are named. */
interface HookPayload {
  user?: {
    id?: string
    email?: string
    new_email?: string
    user_metadata?: Record<string, unknown> | null
  }
  email_data?: {
    token?: string
    token_hash?: string
    token_new?: string
    token_hash_new?: string
    email_action_type?: string
  }
}

/**
 * One place to answer, so a refusal cannot accidentally carry a reason.
 *
 * `verifyHookSignature`'s verdict has a `reason` for the SERVER LOG. It must not reach the
 * response: a caller told which header was wrong has an oracle for finding the right one, the
 * same argument `guard.notAuthorized` makes about naming a missing grant.
 */
function refuse(status: number, logReason: string): NextResponse {
  console.error(`[auth-hook] refused ${status}: ${logReason}`)
  return NextResponse.json({ error: { http_code: status, message: 'Not authorized' } },
    { status })
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  // ── 1. THE RAW BYTES, BEFORE ANYTHING ELSE ────────────────────────────────────────
  const raw = await request.text()

  const verdict = verifyHookSignature({
    headers: {
      id: request.headers.get('webhook-id'),
      timestamp: request.headers.get('webhook-timestamp'),
      signature: request.headers.get('webhook-signature'),
    },
    rawBody: raw,
    secret: process.env.SUPABASE_AUTH_HOOK_SECRET,
    nowSeconds: Math.floor(Date.now() / 1000),
  })
  if (!verdict.ok) return refuse(401, verdict.reason)

  // ── 2. ONLY NOW IS THE BODY WORTH LOOKING AT ─────────────────────────────────────
  let payload: HookPayload
  try {
    payload = JSON.parse(raw) as HookPayload
  } catch {
    // A signed body that is not JSON should be impossible. 400 rather than 500, because
    // there is nothing to retry: the same bytes will fail the same way.
    return refuse(400, 'signed body was not JSON')
  }

  const action = payload.email_data?.email_action_type
  const to = payload.user?.email
  if (!action) return refuse(400, 'no email_action_type')
  if (!to) return refuse(400, `no recipient on a ${action}`)

  // ── 3. THE READER'S LANGUAGE ─────────────────────────────────────────────────────
  // `people.locale` if there is a row, else the `locale` in the signup metadata, else
  // English. See `authMailLocale` — the second rung is what makes a CONFIRMATION readable,
  // because it is sent before any `people` row exists.
  const locale = await authMailLocale({
    userId: payload.user?.id,
    metadata: payload.user?.user_metadata,
  })

  // ── 4. COMPOSE ───────────────────────────────────────────────────────────────────
  const origin = emailOrigin()
  const hash = payload.email_data?.token_hash
  const token = payload.email_data?.token

  // Each branch states what it needs, and a missing token is a 400 rather than an email with
  // a broken link in it. GoTrue always sends one for these types; the check is what makes
  // "always" checkable.
  const messages: { to: string; subject: string; html: string; tag?: string }[] = []

  switch (action) {
    case 'signup': {
      if (!hash) return refuse(400, 'signup with no token_hash')
      messages.push({ to, ...authConfirmEmail({ origin, tokenHash: hash, locale }) })
      break
    }
    case 'recovery': {
      if (!hash) return refuse(400, 'recovery with no token_hash')
      messages.push({ to, ...authRecoveryEmail({ origin, tokenHash: hash, locale }) })
      break
    }
    case 'invite': {
      if (!hash) return refuse(400, 'invite with no token_hash')
      messages.push({ to, ...authInviteEmail({ origin, tokenHash: hash, email: to, locale }) })
      break
    }
    case 'reauthentication': {
      if (!token) return refuse(400, 'reauthentication with no token')
      messages.push({ to, ...authReauthEmail({ origin, token, locale }) })
      break
    }
    case 'email_change': {
      // TWO MESSAGES FROM ONE CALL. `token_hash` is for the address the account has now and
      // `token_hash_new` for the one it is moving to; `secure_email_change_enabled` needs
      // both confirmed, so sending one leaves a change that can never complete.
      const newEmail = payload.user?.new_email
      const hashNew = payload.email_data?.token_hash_new
      if (!newEmail || !hash || !hashNew) {
        return refuse(400, 'email_change missing an address or a token')
      }
      messages.push(
        { to, ...authEmailChangeEmail({
          origin, tokenHash: hash, email: to, newEmail, which: 'old', locale,
        }) },
        { to: newEmail, ...authEmailChangeEmail({
          origin, tokenHash: hashNew, email: to, newEmail, which: 'new', locale,
        }) },
      )
      break
    }
    default:
      // 200 AND NOTHING SENT. See the header: refusing would make this endpoint an
      // account-enumeration oracle for `POST /auth/v1/otp`.
      console.warn(`[auth-hook] nothing to send for action type '${action}'`)
      return NextResponse.json({})
  }

  // ── 5. SEND, AND REPORT HONESTLY ─────────────────────────────────────────────────
  // Sequential rather than `Promise.all`, and only for the two-message case: the second
  // message is only worth sending if the first went, because a member told to confirm from
  // an address that never heard about the change has half a flow.
  for (const m of messages) {
    const sent = await sendEmail(m)
    if (!sent.sent) {
      // 500, so GoTrue rolls the operation back. See the header — that is the safe direction:
      // better no account than an account with no way to confirm it.
      return refuse(500, `${action}: ${sent.error ?? 'send failed'}`)
    }
  }

  return NextResponse.json({})
}
