import 'server-only'

import { cache } from 'react'
import { resolveLocale } from '@/lib/auth/locale'
import { intlTagFor } from '@/lib/i18n/locales'
import { tFor } from '@/lib/i18n/catalogues'
import type { T } from '@/lib/i18n/t'

/**
 * The reader's language, for SERVER components — the counterpart to `useT()`.
 *
 * ── WHY A SEPARATE ENTRY POINT AND NOT THE CONTEXT ──────────────────────────────────
 * React context does not cross the server/client boundary, so a page — which is a Server
 * Component — cannot read `LocaleProvider`. It resolves the locale itself instead, which costs
 * nothing it was not already paying: `resolveLocale` is `cache()`d per request and the protected
 * layout has already called it by the time any page runs, so this is a map lookup rather than a
 * second query.
 *
 * ── ONE CALL RETURNS BOTH, DELIBERATELY ─────────────────────────────────────────────
 * A page almost always needs `t` for its own captions AND the `Intl` tag for the dates and money
 * it hands to formatters. Returning them separately would mean two calls and two imports, and
 * the second one is the one that gets forgotten — which is precisely the failure `i18n:check`'s
 * PINNED-FORMATTER ceiling exists to count. They are handed over together so that forgetting is
 * a decision rather than an omission.
 *
 * `intl` is NOT the same string as `locale`: `'es'` formats to Spain's conventions and `'es-MX'`
 * to Mexico's, and both produce a plausible number. See `lib/i18n/locales.ts`.
 *
 * ── USE IT AFTER THE GUARD, NOT BEFORE ──────────────────────────────────────────────
 * §1's preamble resolves the user and checks the grant first. This is a display concern and
 * decides nothing about access — putting it above `requireView` would read as though the
 * language mattered to authorization, and it does not.
 *
 *     const { data: { user } } = await supabase.auth.getUser()
 *     if (!user) redirect('/login')
 *     await requireView(user.id, 'community/directory')
 *     const { t, intl } = await callerI18n(user.id)
 *
 * ── A NESTED SERVER COMPONENT TAKES `t` AS A PROP ───────────────────────────────────
 * Two thirds of the Dashboard's cards are Server Components rendered by a page. They cannot read
 * `LocaleProvider` — context does not reach them — and they have no `user` of their own, so this
 * is the one place a `t` is threaded rather than resolved.
 *
 * That is safe here and is NOT the prop-threading the client mechanism exists to avoid. A
 * function crossing a SERVER-to-SERVER boundary is passed by reference and never serialized, the
 * depth is one hop from the page that already resolved it, and a missing prop is a TYPE ERROR
 * rather than a silent fall back to English.
 *
 *     <WelcomeHero t={t} name={name} />          // server child of a server page
 *
 * Passing `t` to a CLIENT component would fail at the RSC boundary — props are serialized and a
 * function is not. Those call `useT()` and need nothing passed at all.
 *
 * ── A NULL USER IS FINE ─────────────────────────────────────────────────────────────
 * `resolveLocale(null)` falls through to `Accept-Language` and then to English, so the auth
 * screens and Home can use this before anybody has an account. That is the one path where the
 * header is the right source: it is the reader's own browser making the request.
 */
export const callerI18n = cache(async (
  userId: string | null | undefined,
): Promise<{ locale: string; t: T; intl: string }> => {
  const locale = await resolveLocale(userId)
  return { locale, t: tFor(locale), intl: intlTagFor(locale) }
})
