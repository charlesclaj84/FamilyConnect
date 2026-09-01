'use client'

import { createContext, useContext, useMemo, type ReactNode } from 'react'
import { DEFAULT_CURRENCY, moneyFor, type Money } from '@/lib/currency-utils'
import { useIntlTag } from '@/components/layout/LocaleProvider'

/**
 * The currency the FAMILY keeps its books in, for CLIENT components — `useMoney()`.
 *
 * The deliberate sibling of `LocaleProvider`, and read that file's header first: the argument
 * for a context over a prop is identical and is not repeated here. What follows is only what
 * differs, and the first item is why these are two providers rather than one.
 *
 * ── A LANGUAGE AND A CURRENCY ARE FACTS ABOUT DIFFERENT THINGS ──────────────────────
 * `lib/currency-utils.ts` opens with the distinction and it is the whole reason this file
 * exists separately: the LOCALE is a fact about the reader, the CURRENCY is a fact about the
 * money. A Spanish-reading member looking at a US family's books must see the amount grouped
 * the way they read numbers AND see that it is dollars. Folding the currency into
 * `LocaleProvider` would put those two in one value, and the next person resolving a locale
 * would have to know a family to do it.
 *
 * It also matters for WHERE each is mounted. `LocaleProvider` wraps the auth, staff and
 * marketing layouts as well as the Dashboard, and none of those has a family — so a combined
 * provider would be handed a currency it could not resolve on three of four surfaces.
 *
 * ── NO PROVIDER MEANS DOLLARS, AND THAT IS NOT "SAFE" ───────────────────────────────
 * `LocaleProvider` degrades to English, which is a wrong LANGUAGE — visible, and recoverable by
 * the reader. This degrades to a wrong CURRENCY SYMBOL on a right number, which is not visible
 * at all: `$40` about forty pesos looks exactly like forty dollars.
 *
 * What makes it acceptable is the same thing that makes it acceptable there — there is one
 * provider to forget, mounted in one layout — plus two things that are stronger here:
 *
 *   * **The only surfaces without a family are the ones with no family money on them.** Home,
 *     the auth pages and the staff console print GENORRA's own figures, and those go through
 *     `formatPlatformMoney`, which states USD rather than asking anybody.
 *   * **The one place a wrong currency would MOVE money does not use this.**
 *     `app/actions/pay-dues.ts` resolves the currency itself through `familyCurrencyOrFail` and
 *     REFUSES rather than falling back. A figure on a screen may degrade; a charge may not.
 *
 * ── IT DOES NOT RE-RENDER ON NAVIGATION, WHICH IS CORRECT AND HAS ONE CONSEQUENCE ───
 * App Router does not re-render a shared layout on a client-side navigation, so this value is
 * fixed for as long as the tab lives — exactly like `viewable` and the locale. **Switching
 * family is the case that matters**, and it is already handled: `FamilySwitcher` lands its
 * change with `router.refresh()`, which re-runs the layout, and `<main key={familyCode}>`
 * remounts everything beneath it (AGENTS.md, "Switching family remounts the page"). A member of
 * a US family and a Mexican one therefore cannot be shown one family's figures under the
 * other's symbol.
 */
const CurrencyContext = createContext<string>(DEFAULT_CURRENCY.toLowerCase())

export function CurrencyProvider({ currency, children }: {
  currency: string
  children: ReactNode
}) {
  return (
    <CurrencyContext.Provider value={(currency || DEFAULT_CURRENCY).toLowerCase()}>
      {children}
    </CurrencyContext.Provider>
  )
}

/**
 * The family's currency code — `'usd'`, `'cad'`, `'mxn'`. Lowercase ISO 4217.
 *
 * For FORMATTING, use `useMoney()`. This is for the handful of places that need the code
 * itself — a currency label beside a money input (`dollarsToCents` is deliberately not
 * locale-aware, so the field states which currency it expects), and Stripe's per-currency
 * minimum.
 */
export function useCurrency(): string {
  return useContext(CurrencyContext)
}

/**
 * `money(cents)`, bound to the family's currency and the reader's conventions.
 *
 * Memoised on both, so a component re-rendering for its own reasons does not rebuild the
 * binder and the identity stays stable in a dependency array.
 */
export function useMoney(): Money {
  const currency = useContext(CurrencyContext)
  const intl = useIntlTag()
  return useMemo(() => moneyFor(currency, intl), [currency, intl])
}
