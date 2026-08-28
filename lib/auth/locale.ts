import { cache } from 'react'
import { headers } from 'next/headers'
import { createAdminClient } from '@/lib/supabase/admin'
import { isSupportedLocale, negotiateLocale, preferredLocale, storedLocale } from '@/lib/i18n/locales'
import { LOCALE_HEADER } from '@/lib/i18n/route-locale'

/**
 * Which language is this caller reading in?
 *
 * The impure counterpart to `lib/i18n/locales.ts`, and the exact shape of `lib/auth/zone.ts`
 * one concern over — four sources, in order, with a last one that can always answer:
 *
 *   1. `people.locale`     what the member CHOSE, on My Profile. Authoritative.
 *   2. the `/es` or `/fr`   what the ADDRESS BAR says this page is. See below — it is only ever
 *      path segment       set on the handful of routes that have localized addresses.
 *   3. `Accept-Language`   what their BROWSER asks for. A member who has never opened the
 *                          control still gets Spanish if their browser asks for Spanish.
 *   4. `BASE_LOCALE`       English, which the catalogue is written in.
 *
 * Because the last always answers, no call site branches on "we do not know".
 *
 * ── THE ORDER ITSELF IS `preferredLocale`, IN THE PURE MODULE ─────────────────────
 * This function READS the four sources; `lib/i18n/locales.ts` decides which wins, and
 * `lib/i18n/locales.test.ts` pins it. §7b's boundary is why: this file imports
 * `next/headers` and the admin client, so nothing under `npm test` can call it, and a
 * four-rung precedence that a fifth source might join is worth being able to assert.
 *
 * ── THE PATH SEGMENT WAS MISSING AND THE SIGN-IN FORM WAS THE COST ─────────────────
 * This had three sources until 2026-08-27, and its own header said the URL structure was none
 * of its business: *"a marketing page takes its locale from its `/es` or `/fr` path segment,
 * which is a routing fact rather than a caller fact"*. True of a marketing page, which resolves
 * through `marketingLocale()` and never comes here — and false of the four AUTH routes, which
 * are in `LOCALIZED_ROOTS` for a reason stated there: *a reader who has been on Spanish Home
 * for four pages must not be handed an English form by the one click that matters.*
 *
 * They were handed one. Measured against a real server, with `Accept-Language: en-US`:
 *
 *     GET /es/login   →   `<html lang="es">`   and every word of the form in English
 *
 * The `lang` was right because `app/layout.tsx` reads the header directly; the CONTENT was
 * wrong because `LocaleProvider` in `app/(auth)/layout.tsx` is seeded from `callerI18n(null)`,
 * which came here and got the browser's answer. So a Spanish reader who clicked *Iniciar
 * sesión* landed on a page whose `lang` told their screen reader Spanish and whose labels were
 * English — worse than either being wrong on its own.
 *
 * ── WHERE IT SITS IN THE ORDER, AND WHY THAT IS THE ONLY DEFENSIBLE PLACE ──────────
 * BELOW the stored choice, because an explicit preference is about the READER and a URL is
 * about a PAGE; a member who set Spanish on My Profile and then opened an English-addressed
 * link has not changed their mind. ABOVE `Accept-Language`, because a path segment is
 * something somebody navigated to and a request header is something their browser was
 * configured with years ago — and because `proxy.ts` only ever produces a prefixed path for a
 * reader who was ALREADY reading that language, or who negotiated into it once and had the
 * choice recorded in `LOCALE_PICK_COOKIE`.
 *
 * ── IT CHANGES NOTHING ON THE DASHBOARD, STRUCTURALLY ─────────────────────────────
 * The header is set by `proxy.ts` only when it rewrites a prefixed path, and it only rewrites
 * paths `isLocalizablePath()` admits — Home, the five marketing pages and the four auth ones.
 * `/es/dashboard` is not one: it matches no route and 404s, which is the design. So on every
 * signed-in page the header is absent and this resolver behaves exactly as it did.
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
  // Both request-scoped sources, read once. `addressed` is the `/es` or `/fr` the reader is
  // actually at; `asked` is what their browser would like. See the header for the order.
  const addressed = await addressedLocale()
  const asked = await browserLocale()

  if (!userId) return preferredLocale({ addressed, asked })

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

  return preferredLocale({ chosen: data?.locale, addressed, asked })
})

/**
 * The language this page's own ADDRESS says it is, or null.
 *
 * `proxy.ts` sets `LOCALE_HEADER` when it rewrites `/es/login` onto `/login`, so this is the
 * one place the routing decision is visible to a Server Component that is not a marketing
 * page. `marketingLocale()` reads the same header and differs in its FALLBACK: it answers
 * English, because an unprefixed marketing path is English's one canonical address and
 * negotiating there would serve Spanish prose at it. This answers `null` instead, because the
 * caller has two further sources to try and "no prefix" is not a statement about the reader.
 *
 * `headers()` throws outside a request scope, so a missing scope is `null` rather than an
 * exception — the same reasoning as `browserLocale()` below.
 */
async function addressedLocale(): Promise<string | null> {
  try {
    const named = (await headers()).get(LOCALE_HEADER)
    return isSupportedLocale(named) ? (named as string) : null
  } catch {
    return null
  }
}

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

/**
 * The language for one of the FIVE AUTH EMAILS, which is a different question from every other
 * resolver in this file.
 *
 * ── WHY IT CANNOT BE `resolveLocale` OR `localesOfPeople` ──────────────────────────
 * `resolveLocale` answers for the CALLER of a request, from `next/headers` and the session.
 * There is no caller here: `app/api/auth/send-email/route.ts` is a webhook and the request
 * belongs to a Go process. Its headers are GoTrue's, so `Accept-Language` would be nothing and
 * the path segment would be `/api/auth/send-email`.
 *
 * `localesOfPeople` is closer — it is the mail resolver — and it takes a `family_code` this
 * path does not have and cannot get: a CONFIRMATION is sent before the member belongs to a
 * family, and a RECOVERY does not know which of several the reader is thinking about.
 *
 * ── TWO SOURCES, AND THE SECOND IS THE ONE THAT MATTERS ───────────────────────────
 *
 *   1. `people.locale`            what the member SET, on My Profile. Authoritative wherever
 *                                 there is a row — recovery, reauthentication, email change.
 *   2. `user_metadata.locale`     what `registerUser` wrote at signup, from the language the
 *                                 REGISTRATION PAGE was in.
 *   3. English.
 *
 * THE SECOND RUNG IS THE WHOLE REASON THIS FUNCTION EXISTS. A signup confirmation is sent
 * before `redeem_family_invitation` or `registerUser` has written a `people` row, so rung 1
 * answers nothing for precisely the message that most needs to be right — the first thing a
 * new member ever receives from this product, and the one that decides whether they get in.
 * `/es/register` is a real route (`LOCALIZED_ROOTS`), so the language IS known at that moment,
 * and carrying it into the signup metadata is what makes it readable here.
 *
 * ── THE METADATA IS USER-WRITABLE, AND THAT IS FINE FOR A SELECTOR ────────────────
 * `supabase.auth.updateUser({ data })` lets any signed-in member write their own
 * `raw_user_meta_data`. So this value is not trustworthy — and it does not need to be: it is
 * only ever COMPARED against the three languages the product speaks, by `storedLocale`, and
 * anything else falls through to English. Nothing from it is ever RENDERED. That distinction is
 * the same one `consume_family_action_challenge` makes about a hash: only compared, never used
 * to find the row.
 *
 * A member who writes `locale: "fr"` into their own metadata gets French mail, which is what
 * the control is for.
 *
 * ── `people.locale` STAYS THE SOURCE OF TRUTH, AND THE METADATA IS NOT KEPT IN STEP ─
 * Deliberately. `setMyLocale` writes the column and nothing else, so a member who changes
 * their language on My Profile has a stale `locale` in their metadata — and it does not matter,
 * because rung 1 shadows it for every message sent after that row exists. The metadata is a
 * one-shot hint for the window before there IS a row, not a copy to maintain.
 *
 * Which is the point worth being explicit about: writing both would be two facts that can
 * disagree, the `is_minor` trap (§4b). One is authoritative and the other is a hint with a
 * shorter life than the thing it hints at.
 *
 * ── §3, DISCHARGED THE SAME WAY `resolveLocale` DOES ─────────────────────────────
 * The admin client with `.eq('user_id', …)` and no `family_code` — the SELF verdict in
 * `scripts/family-scope.mjs`, filtering on something narrower than a family. `locale` is one of
 * the columns `people_sync_shared_profile` propagates across every family a user belongs to
 * (`20260826000002`), so any of their rows holds the same answer.
 */
export async function authMailLocale(o: {
  userId: string | null | undefined
  metadata: Record<string, unknown> | null | undefined
}): Promise<string> {
  const hinted = typeof o.metadata?.locale === 'string' ? o.metadata.locale : null

  if (!o.userId) return storedLocale(hinted)

  const db = createAdminClient()
  // SELF — narrower than a family. See the header.
  const { data, error } = await db
    .from('people')
    .select('locale')
    .eq('user_id', o.userId)
    .not('locale', 'is', null)
    .limit(1)
    .maybeSingle()

  // §8: `const { data }` discards the error, and a refused read is indistinguishable from a
  // member who has not chosen. Both fall through to the metadata hint, which is the same answer
  // either way — but the error is LOGGED, because a whole family silently receiving English
  // auth mail would otherwise look like a preference nobody set. And this is the one mail path
  // where nobody is watching: there is no screen and no administrator to notice.
  if (error) console.error('authMailLocale: could not read locale', error)

  return storedLocale(isSupportedLocale(data?.locale) ? data?.locale : hinted)
}
