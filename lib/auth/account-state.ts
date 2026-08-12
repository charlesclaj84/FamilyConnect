/**
 * What GoTrue knows about one email address: whether it has an account, whether that
 * address has been confirmed, and whether anyone has ever signed in with it.
 *
 * NOT A SERVER ACTION, and it must never become one — the same rule as lib/email/send.ts
 * and lib/invitations.ts, for a sharper reason than either. Everything exported from a
 * `'use server'` file gets a URL, and this function TAKES AN EMAIL ADDRESS and answers
 * "does this have an account". As an endpoint that is an account-enumeration oracle for
 * the whole product, callable by anyone who can reach the origin. GoTrue works quite hard
 * not to be one — see below — and exporting this would hand it back. A plain module has no
 * URL; the caller must be an action that has already gated itself and that supplies an
 * address it read from a row the caller was entitled to see.
 *
 * WHY RAW fetch AND NOT THE ADMIN CLIENT. `admin.auth.admin.listUsers()` takes only
 * `{ page, perPage }` — there is no by-address lookup in supabase-js, so the SDK route is
 * "page through every user in the project and search", which is O(users) for a question
 * that has an O(1) answer. GoTrue's admin endpoint does support `?filter=`, so this is one
 * request. The service key never leaves the server; this module is imported only by server
 * actions.
 *
 * `filter` IS A SUBSTRING MATCH, NOT AN EQUALITY. `filter=a@b.com` also returns
 * `xa@b.com.au`, so the exact comparison below is load-bearing rather than defensive:
 * without it, "does this address have an account" would answer yes for an address that
 * merely contains it, and a resend would then be aimed at the wrong state.
 */

export interface AccountState {
  /** An auth.users row exists for exactly this address. */
  exists: boolean
  /** `email_confirmed_at` is set. False whenever `exists` is false. */
  confirmed: boolean
  /** `last_sign_in_at` is set — the account has been used at least once. */
  signedInBefore: boolean
}

interface GoTrueUser {
  email?: string | null
  email_confirmed_at?: string | null
  last_sign_in_at?: string | null
}

/**
 * `null` means THE LOOKUP FAILED, and it is a distinct answer from "no account".
 *
 * A caller must not collapse the two: reading a failed lookup as `exists: false` would
 * tell an administrator that their invitee has no account whenever GoTrue is having a bad
 * minute, and the advice that follows from that is wrong in a way they cannot check.
 */
export async function accountStateForEmail(email: string): Promise<AccountState | null> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) return null

  const wanted = email.trim().toLowerCase()
  if (!wanted) return null

  try {
    const res = await fetch(
      `${url}/auth/v1/admin/users?page=1&per_page=50&filter=${encodeURIComponent(wanted)}`,
      {
        headers: { apikey: key, Authorization: `Bearer ${key}` },
        // Same reasoning as sendEmail's timeout: this sits inside a server action a human
        // is waiting on, and an auth service having a bad day must not hold the request
        // open until the platform kills it.
        signal: AbortSignal.timeout(10_000),
        cache: 'no-store',
      },
    )
    if (!res.ok) return null

    const body = (await res.json()) as { users?: GoTrueUser[] }
    const match = (body.users ?? []).find(
      u => (u.email ?? '').trim().toLowerCase() === wanted,
    )

    if (!match) return { exists: false, confirmed: false, signedInBefore: false }
    return {
      exists: true,
      confirmed: Boolean(match.email_confirmed_at),
      signedInBefore: Boolean(match.last_sign_in_at),
    }
  } catch {
    return null
  }
}

/**
 * Ask GoTrue to send the sign-up confirmation again.
 *
 * IT ALWAYS ANSWERS 200 AND TELLS YOU NOTHING. Verified against the local stack: an
 * unconfirmed address, an already-confirmed address and an address with no account all
 * return `200 {}`. That is deliberate on GoTrue's part — a truthful answer here would be
 * the enumeration oracle the whole endpoint is shaped to avoid — and it means the return
 * value below is "the request was accepted", NOT "an email was sent".
 *
 * So a caller must decide whether a confirmation is WANTED before calling, by asking
 * accountStateForEmail() first, and must describe what it did in those terms. Reporting
 * "we resent the confirmation" off the back of this boolean alone would be a guess.
 */
export async function requestConfirmationResend(email: string): Promise<boolean> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if (!url || !anon) return false

  try {
    const res = await fetch(`${url}/auth/v1/resend`, {
      method: 'POST',
      headers: {
        apikey: anon,
        Authorization: `Bearer ${anon}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ type: 'signup', email: email.trim().toLowerCase() }),
      signal: AbortSignal.timeout(10_000),
    })
    return res.ok
  } catch {
    return false
  }
}
