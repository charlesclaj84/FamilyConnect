import { cache } from 'react'
import { headers } from 'next/headers'
import { createAdminClient } from '@/lib/supabase/admin'
import { BASE_LOCALE, isSupportedLocale, negotiateLocale, storedLocale } from '@/lib/i18n/locales'

/**
 * Which language is this caller reading in?
 *
 * The impure counterpart to `lib/i18n/locales.ts`, and the exact shape of `lib/auth/zone.ts`
 * one concern over — three sources, in order, with a last one that can always answer:
 *
 *   1. `people.locale`     what the member CHOSE, on My Profile. Authoritative.
 *   2. `Accept-Language`   what their BROWSER asks for. A member who has never opened the
 *                          control still gets Spanish if their browser asks for Spanish.
 *   3. `BASE_LOCALE`       English, which the catalogue is written in.
 *
 * Because the third always answers, no call site branches on "we do not know".
 *
 * ── WHY A HEADER AND NOT A COOKIE, WHICH IS THE OPPOSITE OF THE ZONE ────────────────
 * `resolveZone` reads a cookie, because a browser's ZONE is not in any request header and has
 * to be written by client-side JavaScript. A browser's LANGUAGE is in every request already —
 * `Accept-Language` — so a cookie would be a second, weaker copy of something the platform
 * hands over for free, and one more thing to keep in step.
 *
 * The consequence worth knowing: this is available on the FIRST request, before any JavaScript
 * has run, which is why Home can serve the right language to a first-time visitor and the
 * zone cannot.
 *
 * ── §3, DISCHARGED BY HAND ──────────────────────────────────────────────────────────
 * The read is on the admin client with no `family_code` — the SELF verdict in
 * `scripts/family-scope.mjs`, filtering on `user_id`, which is narrower than a family.
 * `locale` is one of the columns `people_sync_shared_profile` propagates across every family a
 * user belongs to (`20260826000002`), so any of the caller's own rows holds the same answer.
 *
 * ── WHAT THIS DOES NOT DO ───────────────────────────────────────────────────────────
 * It is not a permission check and decides nothing about access. It also does not touch Home's
 * URL structure: a marketing page takes its locale from its `/es` or `/fr` path segment, which
 * is a routing fact rather than a caller fact. This resolver is for the Dashboard, for the
 * Staff console's English fallback, and for the recipient of a piece of mail.
 */
export const resolveLocale = cache(async (userId: string | null | undefined): Promise<string> => {
  const asked = await browserLocale()

  if (!userId) return asked ?? BASE_LOCALE

  const db = createAdminClient()
  // SELF — `.eq('user_id', userId)`, narrower than a family. See the header.
  const { data, error } = await db
    .from('people')
    .select('locale')
    .eq('user_id', userId)
    .not('locale', 'is', null)
    .limit(1)
    .maybeSingle()

  // §8: `const { data }` discards the error, and a refused read is indistinguishable from "the
  // member has not chosen". Both fall through to the browser's request, which is the same
  // answer either way — but the error is logged, because a whole family silently reading
  // English would otherwise look like a preference nobody set.
  if (error) console.error('resolveLocale: could not read locale', error)

  const chosen = data?.locale
  if (isSupportedLocale(chosen)) return chosen as string
  return asked ?? BASE_LOCALE
})

/**
 * The language each of several relatives reads in, by `people.id`.
 *
 * ── FOR MAIL, AND DELIBERATELY NOT `resolveLocale` ─────────────────────────────────
 * `resolveLocale` above answers for the CALLER and falls through to `Accept-Language`. That
 * header is the sender's browser, so using it here would mail a Spanish-speaking relative in
 * whatever language the administrator's laptop asks for. `storedLocale` is the whole fallback:
 * what the reader chose, else English. See its header in `lib/i18n/locales.ts`.
 *
 * ── ONE READ FOR THE WHOLE BATCH ───────────────────────────────────────────────────
 * `sendCheckInAsks` composes a message per relative, so a per-person round trip would be one
 * query per email inside a loop that is already paced against a provider rate limit. This is
 * asked once, before the loop.
 *
 * ── §3, BY HAND, AND THE `family_code` IS NOT OPTIONAL ─────────────────────────────
 * The admin client has no RLS. `personIds` arrive from a claim function that is itself
 * family-scoped, so the filter is belt and braces — and it is exactly the shape §3 asks for:
 * a caller-supplied id list is never the whole predicate.
 *
 * A person missing from the returned map has not chosen, or could not be read. Callers use
 * `storedLocale(map.get(id))` so both answer English, which is what `??` would do anyway —
 * stated because a refused read looking like a preference is §8's trap and is logged below.
 */
export async function localesOfPeople(
  familyCode: string,
  personIds: readonly string[],
): Promise<Map<string, string>> {
  const out = new Map<string, string>()
  if (personIds.length === 0) return out

  const db = createAdminClient()
  const { data, error } = await db
    .from('people')
    .select('id, locale')
    .eq('family_code', familyCode)                 // §3 by hand. Never the id list alone.
    .in('id', [...personIds])

  // §8: a refused read is indistinguishable from nobody having chosen. Both send English, so
  // the mail still goes — but it is logged, because a whole family reading English would
  // otherwise look like a preference nobody set.
  if (error) {
    console.error(`localesOfPeople: could not read locales for ${familyCode}`, error)
    return out
  }

  for (const row of (data ?? []) as { id: string; locale: string | null }[]) {
    out.set(row.id, storedLocale(row.locale))
  }
  return out
}

/** The best supported locale the browser asked for, or null. */
async function browserLocale(): Promise<string | null> {
  try {
    const h = await headers()
    return negotiateLocale(h.get('accept-language'))
  } catch {
    // `headers()` throws outside a request scope. Answering null rather than exploding keeps
    // this callable from anywhere, which is what makes it safe to fold into a shared layout.
    return null
  }
}
