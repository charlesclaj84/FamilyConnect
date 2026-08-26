import { cache } from 'react'
import { cookies } from 'next/headers'
import { createAdminClient } from '@/lib/supabase/admin'
import { DEFAULT_ZONE, ZONE_HINT_COOKIE, isValidZone } from '@/lib/tz'

/**
 * Which timezone is this caller reading in?
 *
 * The impure half of `lib/tz.ts`. That module does the arithmetic and takes its zone as an
 * argument; this one answers what the argument should be, and it is the only place in the app
 * that decides.
 *
 * ── THREE SOURCES, IN THIS ORDER, AND THE LAST ONE IS NEVER NULL ────────────────────
 *
 *   1. `people.time_zone`   what the member SAID, on My Profile. Authoritative.
 *   2. the hint cookie      what their BROWSER reports, written on first load by
 *                           `ZoneHint`. A member who has never opened My Profile still gets
 *                           their own zone rather than Chicago's.
 *   3. `DEFAULT_ZONE`       Central.
 *
 * Because the third can always answer, no call site ever branches on "we do not know" — which
 * is the property that keeps `dateIn(iso, zone)` a two-argument call at every one of them
 * instead of a three-line fallback repeated forty times.
 *
 * ── WHY THE COOKIE IS A HINT AND NEVER AN AUTHORITY ─────────────────────────────────
 * It is written by client-side JavaScript, so a member can set it to anything. That is fine
 * for exactly this purpose and for nothing else: the worst a forged value achieves is that
 * the forger sees their own dates in a zone of their choosing. It decides no permission, no
 * money and no deadline, and the stored preference beats it whenever there is one.
 *
 * **Do not extend this cookie to carry anything else.** The moment a value in it is read by
 * something that grants access, it stops being a hint.
 *
 * ── §3, DISCHARGED BY HAND ──────────────────────────────────────────────────────────
 * The read is on the admin client and carries no `family_code` — deliberately, and it is the
 * SELF verdict in `scripts/family-scope.mjs`: it filters on `user_id`, which is *narrower*
 * than a family. `time_zone` is one of the columns `people_sync_shared_profile` propagates
 * across every family a user belongs to, so any of the caller's own rows holds the same
 * answer and there is nothing for a family conjunct to disambiguate.
 *
 * The user client would also work and is not used, for one reason: this is called from
 * layouts and pages that have not yet resolved a family, and a resolver that can only answer
 * once RLS has a family to scope by is a resolver that cannot serve `/my-families`.
 */

/**
 * The caller's zone. Never null.
 *
 * `cache`d per request, the way `lib/auth/family.ts` caches its resolvers: a page can print
 * forty dates and several components can ask independently, and none of that should be forty
 * round trips. React's `cache` is per-request, so two members never share an answer.
 */
export const resolveZone = cache(async (userId: string | null | undefined): Promise<string> => {
  const hinted = await zoneHint()

  if (!userId) return hinted ?? DEFAULT_ZONE

  const db = createAdminClient()
  // SELF — `.eq('user_id', userId)`, narrower than a family. See the header.
  const { data, error } = await db
    .from('people')
    .select('time_zone')
    .eq('user_id', userId)
    .not('time_zone', 'is', null)
    .limit(1)
    .maybeSingle()

  // §8: `const { data }` discards the error, and a refused or failed read here is
  // indistinguishable from "the member has not set one". Both fall through to the hint, which
  // is the same answer either way — but the error is logged rather than swallowed, because a
  // whole family silently reading Central would otherwise look like a preference nobody set.
  if (error) console.error('resolveZone: could not read time_zone', error)

  const stated = data?.time_zone
  if (isValidZone(stated)) return stated as string
  return hinted ?? DEFAULT_ZONE
})

/**
 * The hint cookie's value, if it holds a zone this runtime knows.
 *
 * Validated here rather than trusted, because it is client-written: an unknown string would
 * otherwise reach `Intl` and be silently coerced by `lib/tz.ts`' own fallback, which would
 * work but would hide a broken writer.
 */
async function zoneHint(): Promise<string | null> {
  try {
    const jar = await cookies()
    const raw = jar.get(ZONE_HINT_COOKIE)?.value
    return isValidZone(raw) ? (raw as string) : null
  } catch {
    // `cookies()` throws outside a request scope. Answering null rather than exploding keeps
    // this callable from anywhere, which is what makes it safe to fold into a shared layout.
    return null
  }
}
