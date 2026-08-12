import { createBrowserClient } from '@supabase/ssr'
import { createClient as createSupabaseClient } from '@supabase/supabase-js'

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
