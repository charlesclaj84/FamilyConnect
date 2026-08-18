/**
 * What GoTrue just refused, asked as a question instead of matched by hand.
 *
 * ── WHY THIS IS A MODULE AND NOT TWO LINES AT EACH CALL SITE ────────────────────────
 * There were two call sites reading the same shape before this existed —
 * `verifyCurrentPassword` in lib/supabase/client.ts, asking "was that the wrong
 * password?", and the sign-in form, asking "is this account unconfirmed?" — and both are
 * one `||` away from being subtly wrong in the same way. The interesting part is not the
 * comparison, it is the ORDER of the two halves and the reason the second one exists at
 * all, which is exactly the kind of reasoning that does not survive being retyped.
 *
 * ── CODE FIRST, MESSAGE SECOND, MESSAGE NEVER ALONE ─────────────────────────────────
 * `error.code` is a typed member of auth-js's `ErrorCode` union — a contract, versioned
 * with the SDK, and the thing to branch on. `error.message` is English prose emitted by
 * somebody else's service: "Email not confirmed" is a sentence GoTrue is free to reword or
 * localise, and a copy edit there would silently switch off whatever the app does about it.
 * So the message is a FALLBACK, present because `error_code` is a comparatively recent
 * addition to GoTrue's error bodies and the hosted project need not be running the same
 * build as the local stack. Matching on it alone would be building on prose.
 *
 * ── AND NOT `error.status`, WHICH DISCRIMINATES NOTHING ─────────────────────────────
 * Measured against the local stack on 2026-08-17, signing in as an account that registered
 * and never opened its confirmation link:
 *
 *   correct password  ->  400  email_not_confirmed   "Email not confirmed"
 *   wrong password    ->  400  invalid_credentials   "Invalid login credentials"
 *
 * One status, two entirely different pieces of advice to give somebody. (The password is
 * checked first, which is why the offer to resend can only ever appear for someone who
 * typed theirs correctly.)
 *
 * ── PURE, AND DELIBERATELY UNLIKE ITS NEIGHBOURS ────────────────────────────────────
 * Everything else in lib/auth/ reaches a database or a session and belongs on the server.
 * This file imports nothing at all, so it is safe in a `'use client'` component — which is
 * the point, since the sign-in form runs in the browser. Keep it that way: no `server-only`,
 * no Supabase client, and in particular NEVER an import of lib/auth/account-state.ts, whose
 * own header explains why an address-in, account-state-out function must not travel any
 * closer to the browser than a gated server action.
 */

/**
 * The part of an auth-js `AuthError` these predicates read.
 *
 * Structural rather than an import of `AuthError`, for two reasons. It lets a caller pass
 * the union supabase-js actually hands back — `AuthError | null` — with no narrowing at the
 * call site, which is the whole ergonomic point; and it keeps this module free of any
 * dependency, which is what lets a test state a case as a two-key object literal instead of
 * constructing an SDK error to assert on a string comparison.
 */
export interface AuthErrorLike {
  /** GoTrue's `error_code`, surfaced by auth-js as a member of its `ErrorCode` union. */
  code?: string | null
  /** The human sentence. Read only as a fallback — see the header. */
  message?: string | null
}

/**
 * `null` and `undefined` answer false rather than throwing, because that is the shape of
 * the value every caller has: supabase-js RETURNS `{ error }` and leaves it null on
 * success, so `isEmailNotConfirmed(error)` reads correctly on the happy path and a caller
 * is never pushed into a `!error ? … :` wrapper that would invite reordering the checks.
 */
function matches(
  error: AuthErrorLike | null | undefined,
  code: string,
  sentence: RegExp,
): boolean {
  if (!error) return false
  if (error.code === code) return true
  return sentence.test(error.message ?? '')
}

/**
 * Did the sign-in fail because the account has never opened its confirmation link?
 *
 * This is a dead end unless something offers a way out of it: `enable_confirmations = true`
 * in supabase/config.toml, so the account exists, the password was right, and GoTrue will
 * refuse it forever until the emailed link is used. `components/auth/LoginForm.tsx` is what
 * turns a true answer here into an offer to send that link again.
 */
export function isEmailNotConfirmed(error: AuthErrorLike | null | undefined): boolean {
  return matches(error, 'email_not_confirmed', /email not confirmed/i)
}

/**
 * Did it fail because the password (or the address) is simply wrong?
 *
 * Kept distinct from every other reason a sign-in can fail, which is the point of the
 * original call site: a rate limit spent by somebody else on the same IP also comes back as
 * an error, and telling a person their password is wrong when it is not sends them off to
 * the recovery flow for nothing. See `verifyCurrentPassword`.
 */
export function isInvalidCredentials(error: AuthErrorLike | null | undefined): boolean {
  return matches(error, 'invalid_credentials', /invalid login credentials/i)
}
