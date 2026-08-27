'use client'

import { createContext, useContext, useMemo, type ReactNode } from 'react'
import { BASE_LOCALE, intlTagFor } from '@/lib/i18n/locales'
import { tFor } from '@/lib/i18n/catalogues'
import type { T } from '@/lib/i18n/t'

/**
 * The reader's language, for CLIENT components — `useT()`.
 *
 * ── WHY A CONTEXT WHEN THE SHELL USED PROPS ─────────────────────────────────────────
 * Phase 3 gave the six shell components a `locale` prop, which was right for them and only for
 * them: they are rendered by `app/(protected)/layout.tsx` itself, one level down, by the very
 * function that resolves the locale. Phase 5 is the page BODIES — a hundred and fifteen client
 * components at arbitrary depth — and threading a prop through every intermediate component
 * that does not use it is how a prop gets dropped in the middle and a pane silently reverts to
 * English.
 *
 * So this is the ONE way a client component gets `t`, and the shell was converted to it rather
 * than left on props. Two mechanisms for one job is what AGENTS.md keeps warning about, and the
 * shell would have been the smaller half of a permanent split.
 *
 * SERVER components do not use this — React context does not cross that boundary. They call
 * `callerT()` from `lib/i18n/server.ts`, which is one line in a preamble they already have.
 *
 * ── NO PROVIDER IS A LEGITIMATE STATE, AND MUST NOT THROW ───────────────────────────
 * `ThemeToggle` renders inside the account menu AND on the auth, staff and marketing layouts.
 * A hook that threw without a provider would make that component unusable in three of the four
 * places it appears — so the default is `BASE_LOCALE`, which is what those surfaces render
 * today anyway.
 *
 * That is a deliberate trade and it has a cost worth naming: a missing provider degrades to
 * English SILENTLY, which is the same failure mode as a dropped prop. What makes it acceptable
 * is that there is exactly one provider to forget, mounted in one layout, rather than one prop
 * per component — and Home's own provider arrives with its routing.
 *
 * ── IT DOES NOT RE-RENDER ON NAVIGATION, AND THAT IS CORRECT ────────────────────────
 * App Router does not re-render a shared layout on a client-side navigation, so this value is
 * fixed for as long as the tab lives — exactly like `viewable` and everything else the shell
 * derives. `LocaleSwitcher` lands its change with `router.refresh()`, which re-runs the layout
 * and updates it. See "The shell is built once" in AGENTS.md.
 */
const LocaleContext = createContext<string>(BASE_LOCALE)

export function LocaleProvider({ locale, children }: {
  locale: string
  children: ReactNode
}) {
  return <LocaleContext.Provider value={locale || BASE_LOCALE}>{children}</LocaleContext.Provider>
}

/** The reader's language code — `'en'`, `'es'`, `'fr'`. For a formatter, prefer `useIntlTag()`. */
export function useLocale(): string {
  return useContext(LocaleContext)
}

/**
 * `t('some.key')`, bound to the reader's language.
 *
 * Memoised on the locale so a component re-rendering for its own reasons does not rebuild the
 * binder. `tFor` is cheap — it closes over two static objects — but this is called from every
 * client component in the product and a stable identity keeps it out of dependency arrays.
 */
export function useT(): T {
  const locale = useContext(LocaleContext)
  return useMemo(() => tFor(locale), [locale])
}

/**
 * The BCP-47 tag for `Intl`, which is NOT the same string as the locale code.
 *
 * `lib/i18n/locales.ts` carries the whole argument: `'es'` resolves to SPAIN's conventions and
 * `'fr'` to France's, so a family in Monterrey formatting money with the bare code gets a
 * plausible, wrong answer — and it fails silently, because the output is a well-formed number
 * either way. `intlTagFor` is what turns `'es'` into `'es-MX'`.
 *
 * Every `formatDate`, `formatMoney` and `formatDateRange` call in a client component takes this,
 * never `useLocale()`. `npm run i18n:check` counts the ones that still take nothing.
 */
export function useIntlTag(): string {
  const locale = useContext(LocaleContext)
  return useMemo(() => intlTagFor(locale), [locale])
}
