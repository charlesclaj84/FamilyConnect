'use client'

import { createContext, useContext, useMemo, type ReactNode } from 'react'
import { BASE_LOCALE, intlTagFor } from '@/lib/i18n/locales'
import { marketingT } from '@/lib/marketing/strings'
import { type T } from '@/lib/i18n/t'

/**
 * How a marketing CLIENT component gets the reader's language.
 *
 * ── WHY THIS EXISTS BESIDE `LocaleProvider` INSTEAD OF REUSING IT ───────────────────
 * `components/layout/LocaleProvider.tsx` does the identical job for the Dashboard, and the two
 * are deliberately separate because they carry different BUNDLES. `useT()` there builds its
 * translator from `lib/i18n/catalogues.ts`; `useMarketingT()` here builds it from
 * `lib/marketing/strings`. A single provider would have to import both, which would put the
 * marketing copy in the Dashboard's chunk and the shell's in Home's — the exact cost the fourth
 * bundle was created to avoid, reintroduced by the thing that was supposed to consume it.
 *
 * The `locale` is the same string in both, which is what makes them cheap to keep apart: a
 * component that needs both (there is none today) would nest the providers and pick a hook.
 *
 * ── SAME THREE PROPERTIES AS THE DASHBOARD'S, AND FOR THE SAME REASONS ──────────────
 *   * The context carries the LOCALE, not the `t`. A function cannot cross the RSC boundary, so
 *     each side builds its own translator from the same registry.
 *   * No provider resolves to `BASE_LOCALE` rather than throwing. `MarketingHeader` renders on
 *     the marketing layout and on nothing else today, but a shared component that drifts onto
 *     an unwrapped page should render English, not an error boundary.
 *   * `useMemo` on the locale, because `marketingT` allocates a closure and this sits above
 *     every card on `/pricing`.
 */
const MarketingLocaleContext = createContext<string>(BASE_LOCALE)

export function MarketingLocaleProvider({ locale, children }: {
  locale: string
  children: ReactNode
}) {
  return (
    <MarketingLocaleContext.Provider value={locale || BASE_LOCALE}>
      {children}
    </MarketingLocaleContext.Provider>
  )
}

/** The reader's two-character code. For a link, for `lang`, for the picker's current value. */
export function useMarketingLocale(): string {
  return useContext(MarketingLocaleContext)
}

/** The translator for the public site's copy, bound to the reader's language. */
export function useMarketingT(): T {
  const locale = useContext(MarketingLocaleContext)
  return useMemo(() => marketingT(locale), [locale])
}

/**
 * The BCP-47 tag for a formatter. Never the `code` — see `lib/i18n/locales.ts`.
 *
 * `/pricing` prints money and `FamilySizeSlider` prints a count, so this is load-bearing on the
 * two most-read pages of the public site.
 */
export function useMarketingIntl(): string {
  const locale = useContext(MarketingLocaleContext)
  return useMemo(() => intlTagFor(locale), [locale])
}
