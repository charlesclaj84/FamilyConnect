import { describe, expect, it } from 'vitest'
import {
  DEFAULT_CURRENCY, dollarsToCents, formatMoney, formatPlatformMoney,
  hasPublishedStripeMinimum, minorUnitsPerMajor, moneyFor, stripeMinimumCents,
} from '@/lib/currency-utils'
/**
 * `lib/currency-utils.ts`, under `npm test` — a `verify.yml` step, so this gates a pull request.
 *
 * ── THE ONE PROPERTY WORTH GATING ───────────────────────────────────────────────────
 * **The locale must never decide the currency.** That is the whole reason this module took two
 * parameters instead of holding two literals, and it is the failure that would be hardest to
 * spot in review: a figure rendered in a Spanish-reading member's own grouping, carrying a euro
 * symbol, over a US family's books. It looks localised. It is a lie about their money.
 *
 * So the assertions below are paired — same amount, two locales, ONE currency — rather than
 * checking each formatter output on its own.
 *
 * ── PHASE 1 CHANGES NO OUTPUT, AND THAT IS ASSERTED ─────────────────────────────────
 * `formatCurrency` is what a hundred-odd call sites use and its output must be byte-identical
 * to the implementation it replaced. The `en-US`/USD cases below are that regression test.
 *
 * ── CHECKED BY MUTATION (AGENTS.md §7b) ─────────────────────────────────────────────
 * Measured, with the file diffed after each edit to confirm the mutation applied:
 *
 *   1. `formatMoney` ignores its `currency` and hard-codes USD      1 failed
 *   2. `formatMoney` derives currency from the locale               1 failed
 *   3. `cents ?? 0` → `cents as number`                             1 failed
 *   4. `Math.round` → `Math.floor` in `dollarsToCents`              1 failed
 *   5. `minorUnitsPerMajor` returns 100 unconditionally             2 failed
 */

describe('formatMoney', () => {
  it('formats USD in en-US exactly as the product always has', () => {
    expect(formatMoney(123456)).toBe('$1,234.56')
    expect(formatMoney(0)).toBe('$0.00')
    expect(formatMoney(5)).toBe('$0.05')
  })

  it('groups digits the way the READER reads them, keeping the money in its own currency', () => {
    // THE PROPERTY. Same amount, same currency, two readers. Asserted as a pair so that a
    // change making the locale decide the currency cannot pass by fixing one line.
    const enUS = formatMoney(123456, { currency: 'USD', locale: 'en-US' })
    const esMX = formatMoney(123456, { currency: 'USD', locale: 'es-MX' })
    const frFR = formatMoney(123456, { currency: 'USD', locale: 'fr-FR' })

    // Every one of them still says dollars — never a peso, never a euro.
    for (const out of [enUS, esMX, frFR]) {
      expect(out).toMatch(/\$|USD/)
      expect(out).not.toMatch(/€|MX\$/)
    }
    // And the grouping genuinely differs, or the parameter is doing nothing.
    expect(frFR).not.toBe(enUS)
  })

  it('honours a currency that is not the default', () => {
    // Nothing in the product passes this today. It is asserted so that the parameter is known
    // to work before a migration relies on it, rather than discovered not to at that point.
    expect(formatMoney(123456, { currency: 'EUR', locale: 'de-DE' })).toMatch(/€/)
  })

  it('treats a missing amount as zero, which several totals rely on', () => {
    expect(formatMoney(null)).toBe('$0.00')
    expect(formatMoney(undefined)).toBe('$0.00')
  })

  it('DEFAULT_CURRENCY is USD', () => {
    expect(DEFAULT_CURRENCY).toBe('USD')
  })
})

describe('moneyFor', () => {
  // `formatCurrency` was tested here — the alias that took a locale and ASSUMED a currency.
  // It is deleted (see `lib/currency-utils.ts`), and what replaced it is a binder, so what is
  // worth asserting changed with it: not that an alias agrees with its target, but that the
  // currency and the reader stay independent.

  it('binds a currency that the reader cannot change', () => {
    // The rule the module header opens with. A French reader looking at a US family's books
    // sees French grouping AND dollars — never euros.
    const usdForFrench = moneyFor('usd', 'fr-FR')
    expect(usdForFrench(123456)).toBe(formatMoney(123456, { currency: 'usd', locale: 'fr-FR' }))
    expect(usdForFrench(123456)).toContain('$')

    // And the same family's books read by an American are the same money, grouped differently.
    expect(moneyFor('usd', 'en-US')(123456)).toBe('$1,234.56')
  })

  it('is the FAMILY currency, so two families read differently for one reader', () => {
    // The whole point of `families.currency`: 4000 minor units is forty dollars for one family
    // and forty pesos for another, and a reader must be able to tell them apart.
    const us = moneyFor('usd', 'en-US')(4000)
    const mx = moneyFor('mxn', 'en-US')(4000)
    expect(us).not.toBe(mx)
  })

  it('defaults to dollars for a missing currency, and to en-US for a missing reader', () => {
    // Not "safe" — see `lib/auth/currency.ts`. It is what every family created before
    // 20260901000000 genuinely is, and the one path that MOVES money refuses instead.
    expect(moneyFor(null, null)(2500)).toBe('$25.00')
    expect(moneyFor(undefined, undefined)(-2500)).toBe('-$25.00')
  })
})

describe('formatPlatformMoney', () => {
  it('is always USD, whatever the reader reads', () => {
    // GENORRA's own prices do not follow a family's books — AGENTS.md, "MONEY HAS TWO
    // DIRECTIONS", and 20260901000000 §D asserts the same thing about the column.
    expect(formatPlatformMoney(1000)).toBe('$10.00')
    expect(formatPlatformMoney(1000, 'fr-FR')).toContain('$')
    expect(formatPlatformMoney(1000, 'es-MX')).toBe(
      formatMoney(1000, { currency: 'USD', locale: 'es-MX' }),
    )
  })

  it('drops the cents only when asked', () => {
    // `formatPlatformMoney(x, l, { fractionDigits: 0 })` is what a price card wants. NEVER on
    // a figure somebody is reconciling — see MoneyFormat.fractionDigits.
    expect(formatPlatformMoney(1000, 'en-US', { fractionDigits: 0 })).toBe('$10')
    expect(formatPlatformMoney(1000, 'en-US')).toBe('$10.00')
  })
})

describe('stripeMinimumCents', () => {
  it('is a per-currency floor and not one number', () => {
    // Transcribed from docs.stripe.com/currencies on 2026-09-01. MXN is TWENTY TIMES the USD
    // floor in minor units, which is the whole reason this is a function.
    expect(stripeMinimumCents('usd')).toBe(50)
    expect(stripeMinimumCents('cad')).toBe(50)
    expect(stripeMinimumCents('mxn')).toBe(1000)
    // The one figure BELOW half a unit.
    expect(stripeMinimumCents('gbp')).toBe(30)
  })

  it('is case-insensitive, because Stripe sends lower case', () => {
    expect(stripeMinimumCents('USD')).toBe(50)
    expect(stripeMinimumCents('MXN')).toBe(1000)
  })

  it('REFUSES rather than guessing for a currency Stripe does not publish', () => {
    // NGN and KES are absent from Stripe's own table and are both high on TODO.md's country
    // list. This assertion is the reason the function's shape changed: it was written to check
    // that a fallback of 500 was "deliberately high" and FAILED, because 500 minor units is
    // not high in MXN, let alone in NGN. There is no safely-high number in a currency you do
    // not know, so `null` is the answer and the caller has to say so.
    expect(stripeMinimumCents('ngn')).toBeNull()
    expect(stripeMinimumCents('kes')).toBeNull()
    expect(hasPublishedStripeMinimum('ngn')).toBe(false)
    expect(hasPublishedStripeMinimum('usd')).toBe(true)
  })

  it('covers every currency a family may actually be billed in', () => {
    // THE COUPLING WORTH ASSERTING. `families_currency_check` admits exactly these three, and
    // a fourth enabled without a published minimum would silently take the fallback. Widening
    // the CHECK without widening the table is what this catches.
    for (const c of ['usd', 'cad', 'mxn']) {
      expect(hasPublishedStripeMinimum(c)).toBe(true)
    }
  })
})

describe('minorUnitsPerMajor', () => {
  it('is 100 for the ordinary case', () => {
    expect(minorUnitsPerMajor('USD')).toBe(100)
    expect(minorUnitsPerMajor('EUR')).toBe(100)
  })

  it('knows the zero-decimal and three-decimal currencies', () => {
    // The assumption `cents / 100` bakes in, written down where it can be found. Nothing
    // divides by this yet; it exists so a multi-currency change has an obvious first stop.
    expect(minorUnitsPerMajor('JPY')).toBe(1)
    expect(minorUnitsPerMajor('KRW')).toBe(1)
    expect(minorUnitsPerMajor('BHD')).toBe(1000)
  })

  it('is case-insensitive, because Stripe sends lower case', () => {
    expect(minorUnitsPerMajor('jpy')).toBe(1)
    expect(minorUnitsPerMajor('usd')).toBe(100)
  })
})

describe('dollarsToCents', () => {
  it('parses an ordinary amount', () => {
    expect(dollarsToCents('12.34')).toBe(1234)
    expect(dollarsToCents(12.34)).toBe(1234)
    expect(dollarsToCents('0.05')).toBe(5)
  })

  it('rounds rather than truncating', () => {
    // Floor would lose a cent on a third of a dollar, which in a ledger reconciled against a
    // bank statement is a discrepancy somebody has to chase.
    expect(dollarsToCents('0.005')).toBe(1)
    expect(dollarsToCents('10.999')).toBe(1100)
  })

  it('answers 0 for anything unparseable', () => {
    expect(dollarsToCents('')).toBe(0)
    expect(dollarsToCents(null)).toBe(0)
    expect(dollarsToCents('abc')).toBe(0)
  })

  it('is NOT locale-aware, and that is the decision', () => {
    // `"1.234,56"` in a comma-decimal locale means 1234.56. `parseFloat` reads 1.234 and this
    // returns 123 cents — which is WRONG, and is the right kind of wrong: it is refused or
    // visibly tiny rather than silently thousandfold. A locale-aware parser would turn a
    // member's $1.23 into $1,234.56 in an append-only ledger, correctable only by a negative
    // row that stays in the family's books forever. The input stays ASCII-numeric and the form
    // refuses what it cannot read.
    expect(dollarsToCents('1.234,56')).toBe(123)
    // Non-ASCII digits are not money either — they must not be silently reinterpreted.
    expect(dollarsToCents('١٢٣')).toBe(0)
  })
})
