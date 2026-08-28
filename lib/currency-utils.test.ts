import { describe, expect, it } from 'vitest'
import {
  DEFAULT_CURRENCY,
  dollarsToCents,
  formatCurrency,
  formatMoney,
  minorUnitsPerMajor,
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

describe('formatCurrency', () => {
  it('is byte-identical to formatMoney with no options', () => {
    // The alias every existing call site uses. Phase 1 must change no figure on any screen.
    for (const cents of [0, 5, 99, 100, 123456, 100000000, -2500]) {
      expect(formatCurrency(cents)).toBe(formatMoney(cents))
    }
    expect(formatCurrency(-2500)).toBe('-$25.00')
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
