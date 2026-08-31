/**
 * Where a family's connected account may be created, and which of those are offered today.
 *
 * ── ONE LIST, TWO QUESTIONS, AND KEEPING THEM APART IS THE WHOLE DESIGN ─────────────
 * `identity.country` on `v2.core.accounts.create` decides the payout currency, which identity
 * documents Stripe demands, which regulations apply — and **it cannot be changed after
 * creation.** So the question "which countries CAN we create an account in" and "which are we
 * offering a family right now" are different, and answering them with one constant is how this
 * shipped as `CONNECT_ACCOUNT_COUNTRY = 'us'` with a Canadian family quietly created as an
 * American merchant.
 *
 * The registry below holds every country Stripe permits a US platform to create a connected
 * account in. `enabled` is what a family is offered. Turning one on is one flag and no code —
 * which is the point: the next country is a product decision, not a refactor.
 *
 * ── AN `enabled` FLAG IS A CLAIM ABOUT GENORRA'S OWN STRIPE ACCOUNT ─────────────────
 * Not about the family's. `cross_border_connected_account_creation_not_allowed` is a real
 * refusal: the PLATFORM's country has to support the connected account's, and Stripe's
 * cross-border availability is per-country, changes, and in several places below is narrower
 * than the country simply "being supported". So an `enabled: true` here says *we have checked
 * that our platform account can create this* — and the honest failure if that is wrong is the
 * refusal above, surfaced to the family as "we could not set that up", which is why the list
 * starts at three rather than at forty-six.
 *
 * ── AND IT IS NOT THE ONLY LIST THAT HAS TO MOVE ───────────────────────────────────
 * Enabling a country here without the other three is a family with a merchant account and
 * nowhere to be:
 *
 *   `lib/regions.ts`        a member's ADDRESS picker admits US, Canada and Mexico only
 *   `formatCurrency`        every figure in the product is a dollar figure — TODO.md carries
 *                           "collect dues in the family's own currency"
 *   `lib/phone-format.ts`   `DEFAULT_COUNTRY_CODE` is +1, and `toE164` REFUSES what it cannot
 *                           parse, so a number outside North America is unreachable for SMS
 *
 * TODO.md's "WHERE THIS GOES NEXT" section is the ordered target list and says which language
 * each country needs.
 *
 * ── THE NAMES ARE COPY AND ARE NOT KEYED HERE ──────────────────────────────────────
 * `name` is the ENGLISH name, and the picker renders `t('country.<code>')` — the ids are the
 * contract, the words are looked up, exactly as `timezoneLabel` does. The English is kept
 * beside the code so this file is readable on its own and so a country with no catalogue entry
 * yet degrades to something a person can act on rather than to a key.
 */

export interface ConnectCountry {
  /** ISO 3166-1 alpha-2, LOWERCASE — the form `identity.country` takes. */
  code: string
  /** The English name. The picker looks the caption up; see the header. */
  name: string
  /**
   * ISO 4217, lowercase. The payout currency Stripe settles this account in.
   *
   * RECORDED HERE AND CONSUMED BY NOTHING YET, deliberately. Every figure in the product is
   * USD, so this column is what the currency work in TODO.md reads when it lands — and having
   * it here now is what makes the mismatch visible: a family enabled below with a currency
   * that is not `usd` is a family being charged in dollars and paid out in something else.
   */
  currency: string
  /**
   * Is this offered to a family today?
   *
   * A CLAIM ABOUT OUR PLATFORM ACCOUNT, not about Stripe's country list. See the header.
   */
  enabled: boolean
}

/**
 * Every country Stripe permits a US platform to create a connected account in, alphabetically
 * by English name so the picker reads in the order a person scans.
 *
 * ── WHY THE DISABLED FORTY-THREE ARE HERE AT ALL ───────────────────────────────────
 * Because the alternative is a three-entry list and a code change per country, and a code
 * change is where the four other lists above get forgotten. Having the whole set written down
 * makes "what would Nigeria cost" a question somebody can answer by reading — and the answer
 * is on the row: NGN, so the currency work first.
 *
 * **THIS TABLE WILL GO STALE.** Stripe's availability moves, particularly outside the EU and
 * particularly in the four African countries below. Confirm against Stripe before enabling
 * one, never against this file.
 */
export const CONNECT_COUNTRIES: readonly ConnectCountry[] = [
  { code: 'au', name: 'Australia',            currency: 'aud', enabled: false },
  { code: 'at', name: 'Austria',              currency: 'eur', enabled: false },
  { code: 'be', name: 'Belgium',              currency: 'eur', enabled: false },
  { code: 'br', name: 'Brazil',               currency: 'brl', enabled: false },
  { code: 'bg', name: 'Bulgaria',             currency: 'bgn', enabled: false },
  // ── ENABLED. English and French, and it is in `lib/regions.ts` already. ───────────
  { code: 'ca', name: 'Canada',               currency: 'cad', enabled: true  },
  { code: 'hr', name: 'Croatia',              currency: 'eur', enabled: false },
  { code: 'cy', name: 'Cyprus',               currency: 'eur', enabled: false },
  { code: 'cz', name: 'Czechia',              currency: 'czk', enabled: false },
  { code: 'dk', name: 'Denmark',              currency: 'dkk', enabled: false },
  { code: 'ee', name: 'Estonia',              currency: 'eur', enabled: false },
  { code: 'fi', name: 'Finland',              currency: 'eur', enabled: false },
  { code: 'fr', name: 'France',               currency: 'eur', enabled: false },
  { code: 'de', name: 'Germany',              currency: 'eur', enabled: false },
  { code: 'gh', name: 'Ghana',                currency: 'ghs', enabled: false },
  { code: 'gi', name: 'Gibraltar',            currency: 'gbp', enabled: false },
  { code: 'gr', name: 'Greece',               currency: 'eur', enabled: false },
  { code: 'hk', name: 'Hong Kong',            currency: 'hkd', enabled: false },
  { code: 'hu', name: 'Hungary',              currency: 'huf', enabled: false },
  { code: 'in', name: 'India',                currency: 'inr', enabled: false },
  { code: 'id', name: 'Indonesia',            currency: 'idr', enabled: false },
  { code: 'ie', name: 'Ireland',              currency: 'eur', enabled: false },
  { code: 'it', name: 'Italy',                currency: 'eur', enabled: false },
  { code: 'jp', name: 'Japan',                currency: 'jpy', enabled: false },
  { code: 'ke', name: 'Kenya',                currency: 'kes', enabled: false },
  { code: 'lv', name: 'Latvia',               currency: 'eur', enabled: false },
  { code: 'li', name: 'Liechtenstein',        currency: 'chf', enabled: false },
  { code: 'lt', name: 'Lithuania',            currency: 'eur', enabled: false },
  { code: 'lu', name: 'Luxembourg',           currency: 'eur', enabled: false },
  { code: 'my', name: 'Malaysia',             currency: 'myr', enabled: false },
  { code: 'mt', name: 'Malta',                currency: 'eur', enabled: false },
  // ── ENABLED. Spanish, and it is in `lib/regions.ts` already. ─────────────────────
  { code: 'mx', name: 'Mexico',               currency: 'mxn', enabled: true  },
  { code: 'nl', name: 'Netherlands',          currency: 'eur', enabled: false },
  { code: 'nz', name: 'New Zealand',          currency: 'nzd', enabled: false },
  { code: 'ng', name: 'Nigeria',              currency: 'ngn', enabled: false },
  { code: 'no', name: 'Norway',               currency: 'nok', enabled: false },
  { code: 'pl', name: 'Poland',               currency: 'pln', enabled: false },
  { code: 'pt', name: 'Portugal',             currency: 'eur', enabled: false },
  { code: 'ro', name: 'Romania',              currency: 'ron', enabled: false },
  { code: 'sg', name: 'Singapore',            currency: 'sgd', enabled: false },
  { code: 'sk', name: 'Slovakia',             currency: 'eur', enabled: false },
  { code: 'si', name: 'Slovenia',             currency: 'eur', enabled: false },
  { code: 'za', name: 'South Africa',         currency: 'zar', enabled: false },
  { code: 'es', name: 'Spain',                currency: 'eur', enabled: false },
  { code: 'se', name: 'Sweden',               currency: 'sek', enabled: false },
  { code: 'ch', name: 'Switzerland',          currency: 'chf', enabled: false },
  { code: 'th', name: 'Thailand',             currency: 'thb', enabled: false },
  { code: 'ae', name: 'United Arab Emirates', currency: 'aed', enabled: false },
  { code: 'gb', name: 'United Kingdom',       currency: 'gbp', enabled: false },
  // ── ENABLED, and the default. See `DEFAULT_CONNECT_COUNTRY`. ─────────────────────
  { code: 'us', name: 'United States',        currency: 'usd', enabled: true  },
] as const

/**
 * What the picker preselects, and what a family created before the picker existed has.
 *
 * ── IT IS THE US FOR A REASON THAT IS NOT LAZINESS ─────────────────────────────────
 * Every account created before 2026-08-31 was created with `identity.country: 'us'`, and
 * `family_stripe_accounts.country` records what Stripe echoed back — so an existing row says
 * `us` because that is what it IS, not because nobody asked. Defaulting the picker to anything
 * else would make the pre-picker families the odd ones.
 */
export const DEFAULT_CONNECT_COUNTRY = 'us'

/** The countries a family may actually choose today, in the order the picker lists them. */
export function enabledConnectCountries(): readonly ConnectCountry[] {
  return CONNECT_COUNTRIES.filter(c => c.enabled)
}

/**
 * Is this a country a family may be created in RIGHT NOW?
 *
 * ── THE ONE GUARD, AND IT IS ON THE SERVER SIDE OF THE WIRE ────────────────────────
 * `startProcessorOnboarding` is a public HTTP endpoint and the `<select>` in front of it is a
 * convenience (AGENTS.md §2). A caller sending `country: 'ng'` today would otherwise get an
 * account Stripe may well create and this product cannot serve — in a currency nothing formats,
 * with a phone number `toE164` refuses — and **it could never be changed afterwards.** So the
 * action asks this, and the answer for anything not enabled is a refusal rather than a fallback
 * to the US: silently creating an American account for a family that asked for a Nigerian one
 * is the failure this whole file exists to remove.
 */
export function isEnabledConnectCountry(code: unknown): boolean {
  return typeof code === 'string'
    && CONNECT_COUNTRIES.some(c => c.code === code && c.enabled)
}

/** A country's row, whatever its flag says. For rendering a row that already exists. */
export function connectCountry(code: string | null | undefined): ConnectCountry | null {
  return CONNECT_COUNTRIES.find(c => c.code === code) ?? null
}

/** Is there more than one country to choose between? The picker's whole render condition. */
export function hasConnectCountryChoice(): boolean {
  return enabledConnectCountries().length > 1
}
