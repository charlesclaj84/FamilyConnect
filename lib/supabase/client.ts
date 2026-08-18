import { createBrowserClient } from '@supabase/ssr'
import { createClient as createSupabaseClient } from '@supabase/supabase-js'
import { isInvalidCredentials } from '@/lib/auth/auth-errors'

export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
}

/**
 * A client for checking a password WITHOUT disturbing the session the app is running on.
 * One caller: the current-password field in `SignInSecurity`. It stores nothing, so the
 * sign-in it performs is thrown away the moment the promise resolves.
 *
 * WHY IT EXISTS RATHER THAN REUSING `createClient()`. `signInWithPassword` on the app's
 * own client would replace the live session — and a new session carries a new
 * `created_at`, which resets the 24-hour clock GoTrue uses to decide whether
 * `secure_password_change` needs the emailed code. Verifying the password on that client
 * would therefore switch the reauthentication gate off for everybody, permanently and
 * invisibly, in the middle of the one screen built to strengthen it. The cookie rotation
 * mid-form is the lesser half of the problem.
 *
 * NEVER CALL `signOut()` ON THIS CLIENT. `signOut()` defaults to `scope: 'global'`, which
 * revokes every session the *account* has, including the real one the user is sitting on.
 * There is no client-side way to revoke only this throwaway session, so we do not try; see
 * the sweep note below.
 *
 * IT IS DELIBERATELY BROWSER-SIDE. The password goes straight to GoTrue over TLS, exactly
 * as it does at sign-in (`LoginForm`), and never reaches our own server. Doing this in a
 * server action would put a plaintext password in a Next.js request *and* publish a new
 * HTTP endpoint that accepts password guesses — see AGENTS.md on `'use server'` exports.
 *
 * Two costs, both accepted:
 *   * Each check spends a `sign_in_sign_ups` slot (30 per 5 minutes per IP, config.toml).
 *   * A check that SUCCEEDS leaves an unused session row in GoTrue. The
 *     `signOut({ scope: 'others' })` that follows a successful password change sweeps it
 *     along with the user's other devices; a check that succeeds and is then abandoned
 *     leaves one to age out on its own.
 */
export function createPasswordCheckClient() {
  return createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
        detectSessionInUrl: false,
      },
    }
  )
}

export type PasswordCheck =
  | { ok: true }
  /** `wrong` is the password itself; `unavailable` is a rate limit or an outage. */
  | { ok: false; reason: 'wrong' | 'unavailable'; message: string }

/**
 * Is this the password of whoever is signed in right now?
 *
 * ── ONE COPY, BECAUSE THE INTERESTING PART IS THE ERROR HANDLING ────────────────────
 * The probe itself is three lines; what is worth not rewriting is the branch below it.
 * `signInWithPassword` fails for two quite different reasons, and treating them alike
 * tells somebody their password is wrong when what actually happened is that they spent
 * the last of 30 `sign_in_sign_ups` slots in five minutes — which sends a person who
 * typed their password correctly off to the recovery flow. Callers get `reason` so they
 * can word "wrong" for their own screen, and are expected to pass `unavailable` through
 * rather than flattening the two.
 *
 * ── WHAT IT PROVES, WHICH IS LESS THAN IT LOOKS ─────────────────────────────────────
 * It runs on the browser's side of the wire, so it is never a gate against somebody who
 * can post to an endpoint directly — see AGENTS.md on the Password panel, which states
 * this at length and applies verbatim here. What it stops is the realistic case: a
 * mis-click, and somebody who sits down at an unlocked screen and uses the product. Do
 * not let a caller's copy promise more than that.
 *
 * THE EMAIL IS RESOLVED HERE rather than taken as an argument, so a caller cannot check
 * the password of an account other than the live one — the question this answers is
 * about the current session, and `getUser()` is what the current session actually is.
 */
export async function verifyCurrentPassword(password: string): Promise<PasswordCheck> {
  if (!password) {
    return { ok: false, reason: 'wrong', message: 'Enter your password.' }
  }

  const { data: { user }, error: userError } = await createClient().auth.getUser()
  if (userError || !user?.email) {
    return {
      ok: false,
      reason: 'unavailable',
      message: 'We could not confirm who you are signed in as. Reload the page and try again.',
    }
  }

  // `createPasswordCheckClient()` and NOT `createClient()`. Signing in on the app's own
  // client replaces the live session, and a new session's `created_at` resets the
  // 24-hour clock GoTrue uses to decide whether `secure_password_change` demands the
  // emailed code — so checking a password on the wrong client switches that gate off for
  // good, from wherever the check happened to be called. Its doc comment has the rest.
  const { error } = await createPasswordCheckClient().auth.signInWithPassword({
    email: user.email,
    password,
  })
  if (!error) return { ok: true }

  // `isInvalidCredentials` rather than the `code || message` pair that used to sit here.
  // The sign-in form needs the identical shape for `email_not_confirmed`, and two hand-typed
  // copies of "read the typed code, fall back to the prose" are two chances to get the order
  // — or the fallback's existence — wrong. lib/auth/auth-errors.ts holds the reasoning and is
  // the thing under test.
  return isInvalidCredentials(error)
    ? { ok: false, reason: 'wrong', message: 'That is not your password.' }
    : {
        ok: false,
        reason: 'unavailable',
        message: `We could not check your password just now: ${error.message}`,
      }
}
