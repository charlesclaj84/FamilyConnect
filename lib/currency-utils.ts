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
  { currency = DEFAULT_CURRENCY, locale = DEFAULT_MONEY_LOCALE }: MoneyFormat = {},
): string {
  return new Intl.NumberFormat(locale, {
    style: 'currency',
    currency,
  }).format((cents ?? 0) / 100)
}

/**
 * Format an integer number of cents as USD, e.g. `123456` → `"$1,234.56"`.
 *
 * KEPT AS THE NAME EVERY CALL SITE ALREADY USES. There are well over a hundred of them and
 * sweeping them all in the same commit that changes the implementation would make the diff
 * impossible to review for the thing that matters — whether any figure changed. It is a thin
 * alias, not a deprecated path: a caller with no reader-locale in hand is the ordinary case
 * on a server component today, and `formatMoney` is what a caller WITH one uses.
 */
export function formatCurrency(
  cents: number | null | undefined,
  /**
   * The reader's `Intl` tag. A SECOND POSITIONAL ARGUMENT rather than `formatMoney`'s
   * options object, so this alias reads exactly like `formatDate(value, intl)` and the
   * whole family of formatters is threaded the same way — which is what `i18n:check`'s
   * PINNED-FORMATTER count is counting.
   */
  locale?: string,
): string {
  return formatMoney(cents, locale ? { locale } : undefined)
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
