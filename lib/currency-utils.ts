/**
 * Money, and the two questions this module used to conflate.
 *
 * ── WHICH CURRENCY IT IS vs HOW THE READER SEES IT ──────────────────────────────────
 * These are different facts about different things, and one formatter holding both as
 * literals is how a product becomes accidentally un-localisable:
 *
 *   THE CURRENCY   a fact about the MONEY — the family's books, the fund it sits in, the
 *                  Stripe account that moved it. Nothing about the reader changes it.
 *
 *   THE LOCALE     a fact about the READER — how digits are grouped, where the separator
 *                  goes, where the symbol goes. Nothing about the money changes it.
 *
 * So `formatMoney` takes both, and **the locale must never be allowed to decide the
 * currency.** A Spanish-reading member looking at a US family's books should see the
 * amount grouped the way they read numbers and still see that it is US dollars; showing
 * them a euro symbol because their interface is in Spanish would be a lie about the
 * family's money. `en-US` + `USD` and `es-MX` + `USD` are both correct; `es-MX` + `MXN`
 * for a US family is not.
 *
 * ── THE PRODUCT IS SINGLE-CURRENCY AND THIS DOES NOT CHANGE THAT ────────────────────
 * `DEFAULT_CURRENCY` is USD and every call site passes it (or nothing). Stripe is scoped
 * to one country — `CONNECT_ACCOUNT_COUNTRY = 'us'` in `lib/stripe/config.ts`, `currency:
 * 'usd'` on every session, and `app/actions/billing.ts` refuses a price that is not USD.
 * That refusal is correct and stays.
 *
 * What this parameter buys is that the currency is now *stated* rather than assumed, so
 * the day a family's books are not USD, the change is a column and a resolver rather than
 * a hunt through every screen that prints a figure. Two things would have to be true
 * first, and both are migrations rather than display work:
 *
 *   * **`amount_cents` assumes two decimal places.** Yen has none and Bahraini dinar has
 *     three, so `cents / 100` is simply wrong for both — and that division is in
 *     `fund_balance_cents()` in SQL, in the routing waterfall, in the dues ladder and in
 *     every report. See `minorUnitsPerMajor` below, which is where that assumption is at
 *     least written down.
 *   * **A sum across currencies is meaningless without a dated rate from a source.**
 *     `lib/platform-billing.ts` already says so: *"each currency would need its own
 *     figure."*
 */

/** The one currency the product deals in today. A fact about the money, not a default UI. */
export const DEFAULT_CURRENCY = 'USD'

/**
 * The locale used when the reader's own is not known.
 *
 * Distinct from `DEFAULT_CURRENCY` on purpose: this one is expected to be replaced by the
 * caller's resolved locale in Phase 3, and the other one is not.
 */
export const DEFAULT_MONEY_LOCALE = 'en-US'

/**
 * How many minor units make one major unit of a currency.
 *
 * The whole product stores money as an integer number of **cents** and divides by 100 to
 * display it. That is right for USD and wrong for about a fifth of the world's currencies,
 * and the point of this function is that the assumption now has a NAME and one place to be
 * corrected, rather than being a literal `100` scattered across every formatter.
 *
 * It is not used to convert anything yet — `formatMoney` asks `Intl` to place the decimal
 * point, which already knows this per currency. It exists so that a reader of this module
 * meets the assumption instead of inheriting it, and so a future multi-currency change has
 * an obvious first call site.
 */
export function minorUnitsPerMajor(currency: string): number {
  // Deliberately short: the zero-decimal and three-decimal currencies most likely to turn
  // up, not an exhaustive ISO 4217 table that would go stale unnoticed. `Intl` is the
  // authority for formatting; this is the authority for arithmetic, and arithmetic in a
  // second currency is not a thing this product does yet.
  const ZERO_DECIMAL = new Set(['JPY', 'KRW', 'VND', 'CLP', 'ISK', 'XAF', 'XOF'])
  const THREE_DECIMAL = new Set(['BHD', 'JOD', 'KWD', 'OMR', 'TND'])
  const code = currency.toUpperCase()
  if (ZERO_DECIMAL.has(code)) return 1
  if (THREE_DECIMAL.has(code)) return 1000
  return 100
}

export interface MoneyFormat {
  /** The currency the money IS. Never derived from the locale. */
  currency?: string
  /** How the READER reads numbers — a BCP-47 tag, e.g. `es-MX`. Never decides the currency. */
  locale?: string
  /**
   * How many fraction digits to show. Defaults to the currency's own, which is what an
   * amount being AUDITED wants.
   *
   * ── IT EXISTS FOR ONE CALLER AND THE REASON IS WORTH STATING ─────────────────────
   * `formatPlanPrice` wants "$10" rather than "$10.00" on a price card, because a price is
   * scanned and two trailing zeroes are noise at 48px. That used to be a
   * `.replace(/\.00$/, '')` on the formatted string — which works for `en-US` and for
   * nothing else: `fr-FR` produces `10,00 $US`, so the regex matches nothing and the zeroes
   * survive in exactly the languages nobody on the team is reading.
   *
   * Asking `Intl` for zero fraction digits is the same intent expressed where the locale is
   * known. **Never use it on an amount somebody is reconciling** — a ledger figure with its
   * cents silently dropped is a wrong number, not a tidier one.
   */
  fractionDigits?: number
}

/**
 * Format an integer number of cents as money, e.g. `123456` → `"$1,234.56"`.
 *
 * Both options default, so every existing call site keeps working unchanged and reads
 * identically — this replaced a function with the locale and currency hard-coded, and Phase
 * 1 deliberately changes no output.
 *
 * `null` and `undefined` format as zero rather than as an em-dash, which is the behaviour
 * the previous implementation had and which several call sites rely on for a total.
 */
export function formatMoney(
  cents: number | null | undefined,
  {
    currency = DEFAULT_CURRENCY,
    locale = DEFAULT_MONEY_LOCALE,
    fractionDigits,
  }: MoneyFormat = {},
): string {
  return new Intl.NumberFormat(locale, {
    style: 'currency',
    currency,
    ...(fractionDigits === undefined ? {} : {
      minimumFractionDigits: fractionDigits,
      maximumFractionDigits: fractionDigits,
    }),
  }).format((cents ?? 0) / 100)
}

/**
 * A formatter with the currency and the reader already bound. `money(cents)`.
 *
 * ── THIS REPLACED `formatCurrency`, WHICH TOOK A LOCALE AND ASSUMED A CURRENCY ──────
 * That alias was half-localised in a way that read as finished: it threaded the reader's `Intl`
 * tag and hard-coded USD, so a French reader looking at a US family's books got `1 234,56 $` —
 * the reader's conventions around an unstated currency, which is the worst of both. It is
 * DELETED rather than deprecated, so that `npm run typecheck` is the gate and no script has to
 * be. TODO.md asked for the currency to "stop being optional"; a required parameter every call
 * site fills in with a default is not that, and a binder is.
 *
 * ── WHY A BOUND FUNCTION RATHER THAN A SECOND ARGUMENT ─────────────────────────────
 * Because the currency is a fact about the FAMILY and the locale is a fact about the READER,
 * and both are resolved once per request, far from the hundred and fifty places that print a
 * figure. Threading two strings to each of them is two chances to drop one; threading a
 * formatter is none, and a component that has one cannot format money wrongly with it.
 *
 * A client component gets one from `useMoney()` (`components/layout/MoneyProvider.tsx`); a
 * server component that renders from either side takes it as a PROP, exactly as it takes `t`;
 * a server action builds one from the guard with `moneyFor(g.currency, g.intl)`.
 *
 * ── IT IS THE FAMILY'S MONEY. GENORRA'S OWN PRICES USE `formatPlatformMoney` ────────
 * AGENTS.md's "MONEY HAS TWO DIRECTIONS", expressed as two functions so a call site says which
 * ledger it is printing. A plan price rendered with a family binder would read `MX$10.00` for a
 * Mexican family on a card that charges them ten dollars.
 */
export type Money = (
  cents: number | null | undefined,
  opts?: { fractionDigits?: number },
) => string

/** Bind a currency and a reader together. Cheap — it closes over two strings. */
export function moneyFor(
  currency: string | null | undefined,
  locale: string | null | undefined,
): Money {
  const c = (currency ?? DEFAULT_CURRENCY).toLowerCase()
  const l = locale || DEFAULT_MONEY_LOCALE
  return (cents, opts) => formatMoney(cents, {
    currency: c,
    locale: l,
    fractionDigits: opts?.fractionDigits,
  })
}

/**
 * Format one of GENORRA's OWN figures — a plan price, a platform payment, MRR.
 *
 * ALWAYS USD, and the literal is the statement rather than a default: `platform_payments`
 * defaults to `'usd'`, `app/actions/billing.ts` refuses a price that is not, and
 * `20260901000000` §D asserts the platform side did not follow the family side. A staff
 * console summing MRR across families depends on it — a sum across currencies is meaningless
 * without a dated rate from a source, which is a thing this product does not have.
 *
 * It takes the reader's `Intl` tag, because HOW a figure is grouped is still the reader's.
 */
export function formatPlatformMoney(
  cents: number | null | undefined,
  locale?: string,
  opts?: { fractionDigits?: number },
): string {
  return formatMoney(cents, {
    currency: DEFAULT_CURRENCY,
    locale: locale || DEFAULT_MONEY_LOCALE,
    fractionDigits: opts?.fractionDigits,
  })
}

/**
 * Parse a dollar string (e.g. `"12.34"`) into integer cents. Returns 0 on bad input.
 *
 * ── THIS IS DELIBERATELY NOT LOCALE-AWARE, AND MUST NOT BECOME SO ───────────────────
 * The obvious symmetry — if output is localised, localise the input — is a trap here, and
 * the reason is that the two directions have different failure modes.
 *
 * Formatting wrong is visible: a figure looks odd and somebody asks. PARSING wrong is
 * silent and lands in an append-only ledger. `"1.234"` is one and a bit in `en-US` and one
 * thousand two hundred and thirty-four in `es-ES`, and a member whose interface locale
 * differs from the keyboard habits they type with — which is most people who have moved
 * countries — would enter one and record the other. A thousandfold error in a dues payment,
 * with no way to correct it except a negative row that stays in the family's books forever.
 *
 * So the money INPUT stays ASCII-numeric with an explicit currency label beside the field,
 * and anything unparseable is refused with a message naming the expected format — which is
 * what `FieldError` is for. A member typing `1.234,56` gets told, rather than charged.
 */
export function dollarsToCents(input: string | number | null | undefined): number {
  const n = typeof input === 'number' ? input : parseFloat(String(input ?? ''))
  return Number.isFinite(n) ? Math.round(n * 100) : 0
}

/**
 * ═══════════════════════════════════════════════════════════════════════════════════
 * THE MINIMUM CHARGE, WHICH IS A FACT ABOUT THE SETTLEMENT CURRENCY
 * ═══════════════════════════════════════════════════════════════════════════════════
 *
 * Stripe refuses a charge below a per-currency floor so its own fee cannot exceed the
 * charge. Three things about it are easy to get wrong and all three are load-bearing:
 *
 * ── 1. IT IS THE SETTLEMENT CURRENCY, NOT THE PRESENTMENT CURRENCY ─────────────────
 * Measured against Stripe's own documentation (docs.stripe.com/currencies, read
 * 2026-09-01): *"The minimum amount you can charge depends on the payout bank account
 * settlement currency … Charges requiring conversion into your account's default
 * settlement currency must meet the equivalent minimum of the settlement currency."*
 *
 * So this function is asked about the currency the family's CONNECTED ACCOUNT settles in —
 * which is `families.connect_country`'s currency and, since `20260901000000` constrains the
 * pair to agree, the same value as `families.currency`. Those two being one number is
 * exactly why the currency is derived from the country rather than chosen independently: a
 * family presenting MXN into a USD-settling account would have to clear the USD minimum
 * AFTER conversion, which is a floor that moves with the exchange rate and which no
 * function here could answer.
 *
 * ── 2. THERE IS NO API FOR IT. IT IS A DOCS TABLE ──────────────────────────────────
 * Nothing on the Stripe API returns these figures, so they are transcribed, and a
 * transcribed table goes stale silently. Hence the date above and the deliberate NARROWNESS
 * below: only the currencies this product can actually collect in, which is the enabled
 * `CONNECT_COUNTRIES` set. An exhaustive ISO table would be thirty rows nobody checks
 * against thirty countries nobody has enabled — `minorUnitsPerMajor` above makes the same
 * argument for the same reason.
 *
 * ── 3. TWO CURRENCIES ON STRIPE'S OWN ROADMAP ARE NOT ON ITS OWN LIST ──────────────
 * **NGN and KES are absent from Stripe's minimum-charge table entirely**, and both are high
 * on TODO.md's country list. That is a finding rather than a gap here: a country whose
 * minimum Stripe does not publish cannot be enabled until somebody establishes it, because
 * the alternative is a member choosing a small payment and meeting a hosted page that fails
 * at the till. `UNKNOWN_MINIMUM_CENTS` is what this function answers for such a currency,
 * and it is deliberately high.
 */

/**
 * Stripe's published minimum, in the currency's MINOR UNIT, keyed by lowercase ISO 4217.
 *
 * Transcribed from docs.stripe.com/currencies#minimum-and-maximum-charge-amounts on
 * 2026-09-01. The three enabled currencies first, then the ones TODO.md's country list would
 * need next — recorded now so enabling a country is a flag rather than a research task, and
 * so the two gaps in the previous paragraph are visible on the row.
 *
 * ZERO-DECIMAL CURRENCIES ARE WRITTEN IN THEIR OWN UNIT. `jpy: 50` is fifty yen, not fifty
 * sen — Stripe's `amount` for JPY is whole yen, which is `minorUnitsPerMajor('JPY') === 1`.
 * Reading this table without that function is how a JPY minimum becomes a hundredfold error.
 */
const STRIPE_MINIMUM_BY_CURRENCY: Readonly<Record<string, number>> = {
  // ── The three enabled today ───────────────────────────────────────────────────────
  usd: 50,      // 0.50 USD
  cad: 50,      // 0.50 CAD
  mxn: 1000,    // 10 MXN — TWENTY TIMES the USD floor in minor units, and the reason this
                // function exists rather than a shared constant. `MINIMUM_FIRST_CHARGE_CENTS`
                // is $5 in cents and means nothing here.
  // ── Next on TODO.md's list, unenabled ────────────────────────────────────────────
  gbp: 30,      // 0.30 GBP — the one figure BELOW 0.50
  eur: 50,
  brl: 50,
  php: 50,
  inr: 50,
  aud: 50,
  zar: 50,
  aed: 200,     // 2.00 AED
  // ── NOT PUBLISHED BY STRIPE. See the header: these cannot be enabled on a guess ──
  // ngn: ?
  // kes: ?
}

/**
 * The smallest charge Stripe will accept, in the currency's minor unit — or `null` where
 * Stripe publishes no figure.
 *
 * ── `null` RATHER THAN A FALLBACK NUMBER, AND THAT WAS A CORRECTION ────────────────
 * The first version of this answered a "deliberately high" 500 for an unknown currency, and
 * the test written to assert that it WAS high failed on its first run. **There is no number
 * that is safely high in a currency you do not know.** 500 minor units is five units in a
 * two-decimal currency, half a unit in a three-decimal one and five hundred whole yen in a
 * zero-decimal one — and even knowing the scale does not help, because there is no exchange
 * rate here: five naira is about a third of a US cent, which is the opposite of cautious.
 *
 * So this refuses instead. A currency Stripe publishes no floor for is a currency this product
 * cannot quote one in, and the caller's job is to say so rather than charge against a guess —
 * the same shape as `familyCurrencyOrFail` refusing rather than defaulting on the one path
 * that moves money.
 *
 * IT IS UNREACHABLE TODAY, and asserted to be: `families_currency_check` admits three
 * currencies, all three are in the table above, and `lib/currency-utils.test.ts` checks that
 * COUPLING — widening the CHECK without widening the table is exactly what it catches.
 *
 * `currency` is the SETTLEMENT currency — the family's, from `families.currency`. See the
 * section header for why it is not the presentment currency and why there is no API to ask.
 */
export function stripeMinimumCents(currency: string | null | undefined): number | null {
  const code = (currency ?? DEFAULT_CURRENCY).toLowerCase()
  return STRIPE_MINIMUM_BY_CURRENCY[code] ?? null
}

/** Does Stripe publish a minimum for this currency? `stripeMinimumCents` answers `null` if not. */
export function hasPublishedStripeMinimum(currency: string | null | undefined): boolean {
  return ((currency ?? DEFAULT_CURRENCY).toLowerCase()) in STRIPE_MINIMUM_BY_CURRENCY
}
