/**
 * What GoTrue knows about an account: whether an address has one, whether that address
 * has been confirmed, and whether anyone has ever signed in with it — for one address
 * (`accountStateForEmail`) or a page at a time (`listAccounts`).
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

/** One account as the admin list reports it. Everything here comes from `auth.users`. */
export interface AccountSummary {
  /** `auth.users.id` — the value `people.user_id` points at. */
  userId: string
  email: string
  /** When the account was created. Null only if GoTrue omitted it. */
  createdAt: string | null
  /** `email_confirmed_at`, or null for an address that has never been confirmed. */
  confirmedAt: string | null
  /** `last_sign_in_at`, or null for an account that has never been used. */
  lastSignInAt: string | null
}

export interface AccountListPage {
  accounts: AccountSummary[]
  /**
   * Whether there is another page after this one.
   *
   * DERIVED FROM THE PAGE BEING FULL, not from a total, because GoTrue's admin list does
   * not hand back a dependable count — the `x-total-count` header is present in some
   * versions and absent in others, and a pager built on a number that silently becomes
   * `undefined` would tell a support engineer there are no more accounts. "The page came
   * back full, so ask for the next one" is true in every version, and its one cost is a
   * Next button that occasionally leads to an empty page rather than being greyed out.
   * The screen says which page it is on instead of pretending to know how many there are.
   */
  hasMore: boolean
}

/**
 * One page of every account in the project, newest first as GoTrue orders them.
 *
 * ── SAME RULE AS EVERYTHING ELSE IN THIS FILE: NEVER EXPORT IT FROM `'use server'` ──
 * This is a plain module and must stay one. Everything exported from a `'use server'`
 * file gets a URL, and an endpoint that lists every account in the product — addresses,
 * confirmation state, last sign-in — is not merely an enumeration oracle, it is the
 * enumeration itself. The caller must be a server action that has already gated itself;
 * today that is `app/actions/staff/accounts.ts`, which calls `requireStaff()` first.
 *
 * ── WHY A RAW `fetch`, AGAIN ────────────────────────────────────────────────────────
 * `admin.auth.admin.listUsers({ page, perPage })` exists and would do this — but it
 * takes no `filter`, so a search box over it means paging the whole project into memory
 * and matching client-side, which is the O(users) shape `accountStateForEmail` above
 * refuses for the single-address case. The endpoint supports `?filter=`, so one request
 * answers a filtered page, and the mechanics are already here.
 *
 * `filter` IS A SUBSTRING MATCH, which is exactly right for a search box and exactly
 * wrong for an identity check — see the note on `accountStateForEmail`, which compares
 * addresses itself for that reason. Nothing here compares: this returns what matched.
 *
 * `null` means THE LOOKUP FAILED, distinct from "no accounts", for the same reason the
 * single-address form draws that distinction: rendering an empty table over an auth
 * service having a bad minute tells a support engineer the platform has no accounts.
 */
export async function listAccounts(opts: {
  /** 1-based, as GoTrue numbers pages. */
  page?: number
  perPage?: number
  /** Substring, matched by GoTrue against the address. Empty lists everything. */
  filter?: string
} = {}): Promise<AccountListPage | null> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) return null

  // Clamped rather than trusted. The caller is a server action, so these arrive over
  // HTTP; a `per_page` of 100000 would be one request that pulls the whole project into
  // this process, and a negative page is a 400 the console would render as "failed".
  const page = Math.max(1, Math.floor(opts.page ?? 1))
  const perPage = Math.min(100, Math.max(1, Math.floor(opts.perPage ?? 25)))
  const filter = (opts.filter ?? '').trim()

  const query = new URLSearchParams({ page: String(page), per_page: String(perPage) })
  if (filter) query.set('filter', filter)

  try {
    const res = await fetch(`${url}/auth/v1/admin/users?${query.toString()}`, {
      headers: { apikey: key, Authorization: `Bearer ${key}` },
      // Same reasoning as the two functions above: this sits inside a request a human is
      // waiting on, and an auth service having a bad day must not hold it open until the
      // platform kills it.
      signal: AbortSignal.timeout(10_000),
      cache: 'no-store',
    })
    if (!res.ok) return null

    const body = (await res.json()) as { users?: (GoTrueUser & {
      id?: string
      created_at?: string | null
    })[] }
    const users = body.users ?? []

    return {
      accounts: users
        // An account with no id is not addressable and nothing downstream could join a
        // membership to it. Dropping it is better than rendering a row that cannot be
        // acted on; GoTrue has never returned one, and this is here so a shape change
        // cannot put `undefined` into a React key.
        .filter(u => Boolean(u.id))
        .map(u => ({
          userId: u.id as string,
          email: (u.email ?? '').trim(),
          createdAt: u.created_at ?? null,
          confirmedAt: u.email_confirmed_at ?? null,
          lastSignInAt: u.last_sign_in_at ?? null,
        })),
      hasMore: users.length >= perPage,
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
