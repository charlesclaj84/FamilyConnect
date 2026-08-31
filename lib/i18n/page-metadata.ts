import 'server-only'

import type { Metadata } from 'next'
import { currentUser } from '@/lib/auth/current-user'
import { callerI18n } from '@/lib/i18n/server'
import type { Vars } from '@/lib/i18n/t'

/**
 * The document title, in the reader's language.
 *
 * ── THE COST THIS WAS DEFERRED OVER TURNED OUT NOT TO EXIST ────────────────────────
 * `lib/i18n/en.ts` carried this note above `page.*.title` for a fortnight:
 *
 *   > THE DOCUMENT TITLE IS NOT HERE YET, deliberately. `export const metadata` is static, so
 *   > translating a tab title means `generateMetadata`, which has no `user` and would have to
 *   > make its own GoTrue `getUser()` call — doubling the auth round trips on every page load
 *   > to translate a browser tab.
 *
 * **Measured 2026-08-31 against the local stack, and it is false.** `currentUser()` and
 * `callerI18n()` are both wrapped in React's `cache()`, which Next scopes to one request through
 * AsyncLocalStorage — and `generateMetadata` runs inside that same request. A throwaway route
 * calling one `cache()`d function from both halves, with the dev server's own log as the
 * evidence:
 *
 *   two calls in one request (metadata + page)   1 miss
 *   the same route on a SECOND request           1 more, never shared with the first
 *
 * The second line is the half worth re-checking if this ever changes, and it is the same
 * property `lib/auth/current-user.ts` measured for its own sake: two requests must never see
 * each other's caller. So this is a map lookup on every page that renders anything at all, and
 * the second half of the old argument — that the alternative was an `Accept-Language` fallback
 * printing a Spanish tab over an English page — dissolves with it. There is no fallback: this
 * resolves the SAME `people.locale` the page's own `t` came from, because it is the same call.
 *
 * ── THE KEY IS PASSED AS A LITERAL, AND THAT IS LOAD-BEARING ───────────────────────
 * `i18n:check` finds a key's uses by scanning for `t('…')`-shaped literals in the source. A
 * helper that COMPOSED the key from a route — `doc.${route}.title` — would make all 46 of them
 * report UNUSED, and the gate's UNUSED finding is what catches a key left behind by a deleted
 * screen. So the page names its own key, which is what every other call site in the tree does.
 *
 * ── WHICH KEY, AND WHY IT IS USUALLY THE `<h1>`'s ──────────────────────────────────
 * Where the tab says the same words as the heading, the page passes the SAME key
 * (`page.<route>.title`) rather than a parallel one. That is not laziness about the namespace:
 * `/library/officer-notes` is the proof. Its heading key had been corrected to "Officer Notes"
 * when the section was renamed and its static tab title still read "Officer" — two copies of one
 * word, already drifted, in the direction nobody would notice. One key cannot do that.
 *
 * Thirteen titles genuinely differ, because a browser tab has no rail above it to say where it
 * is: `/reporting/elections` is "Elections" under a Reporting heading and needs to be "Elections
 * Report" in a tab beside `/community/elections`. Those carry their own `doc.<route>.title`, and
 * the divergence is then a fact in the catalogue rather than a coincidence of two files.
 *
 * ── IT NEVER WRITES THE PRODUCT NAME ──────────────────────────────────────────────
 * `title.template` in `app/layout.tsx` appends it. See AGENTS.md, "Page titles are composed":
 * `title: 'Dashboard — GENORRA'` renders `Dashboard — GENORRA — GENORRA`.
 *
 *     export async function generateMetadata() { return docTitle('page./community/directory.title') }
 *
 * `robots` and anything else a page needs is merged in through `extra`, which is how the two
 * `noindex` auth screens keep their own headers. `vars` interpolates, which today is one title:
 * the staff console's, whose `{app}` comes from `lib/brand.ts` rather than being typed into
 * three catalogues — the product name lives in one place (AGENTS.md).
 */
export async function docTitle(
  key: string,
  opts?: { vars?: Vars; extra?: Metadata },
): Promise<Metadata> {
  const { user } = await currentUser()
  const { t } = await callerI18n(user?.id)
  return { title: t(key, opts?.vars), ...opts?.extra }
}
