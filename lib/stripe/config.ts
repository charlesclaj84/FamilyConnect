/**
 * Which Stripe credentials this deployment holds, and what it is therefore allowed to do.
 *
 * ── TWO INTEGRATIONS, ONE ACCOUNT, AND THEY MUST NOT BE CONFUSED ────────────────────
 * There are two entirely separate money flows in this product and the whole of `lib/stripe`
 * is organised around keeping them apart:
 *
 *   PLATFORM   a family paying GENORRA for its plan. Charges land in OUR Stripe account,
 *              the customer is the family, and the money is our revenue. Recorded in
 *              `platform_payments`.
 *   CONNECT    a relative paying THEIR FAMILY its dues. Charges land in the FAMILY's own
 *              Stripe account (a direct charge, via `Stripe-Account`), the customer is the
 *              relative, and the money is the family's. Recorded in `dues_payments`.
 *
 * One API key serves both, because a Connect direct charge is our platform key plus an
 * account header — which is exactly why the two are easy to cross by accident and why every
 * function here says which side it belongs to. A platform subscription created with an
 * account header would bill the family's own account for our invoice; a dues charge created
 * without one would put a family's dues in GENORRA's bank.
 *
 * ── WE DO NOT HOLD ANY FAMILY'S KEY, AND WE MUST NOT START ──────────────────────────
 * `payment_info.md` §4 argues this at length and it is the single most important rule in the
 * feature. A family connects its own Stripe account and we store an `acct_…` id — an
 * identifier, not a secret. A family's `sk_live_…` in our database would mean that a breach
 * of GENORRA is a total compromise of every family's money, with no scoping and no
 * revocation, in violation of Stripe's own terms. There is no environment variable here for
 * one and no column in the schema for one.
 *
 * ── NOTHING IS A `NEXT_PUBLIC_` VARIABLE ────────────────────────────────────────────
 * Not the key, not the webhook secrets, not even the price ids — the browser never needs any
 * of them, because a hosted Checkout Session is created on the server and the browser is
 * handed one URL to visit. That is the main reason to prefer hosted Checkout here over an
 * embedded element: there is no publishable key to ship and no Stripe.js to load, so this
 * whole integration adds nothing to the client bundle and no CSP directive to `next.config`.
 * `lib/meta/no-client-secrets.test.ts` asserts that no client-reachable module names any of
 * these.
 *
 * ── PURE OVER THE ENVIRONMENT, so it can be tested ──────────────────────────────────
 * No `stripe` import in this file. It reads `process.env` and returns strings, which is what
 * lets `config.test.ts` check the one decision worth checking — that a live key cannot be
 * used from a preview deployment — without a network or an SDK.
 */

import { SITE_URL } from '@/lib/site'
import { TIERS, type FamilyTier } from '@/lib/tiers'

/**
 * The API version every request is pinned to.
 *
 * PIN IT rather than following whatever Stripe promotes to default. The account's default
 * version moves when somebody upgrades it in the Dashboard, and an unpinned SDK then starts
 * receiving a different event shape on a Tuesday with no deploy of ours in between — which
 * on the webhook path means a field we read silently becoming `undefined`, and a payment
 * recorded against nothing.
 *
 * `2026-07-29.dahlia` is current as of 2026-08-23. `STRIPE_API_VERSION` overrides it so a
 * version bump can be exercised on a preview deployment before it is written into this file
 * — the same device `META_GRAPH_API_VERSION` exists for.
 *
 * `integration_identifier` on a Checkout Session (below) needs `2026-03-25.dahlia` or later,
 * so a rollback past that date has to drop that parameter too.
 */
export const STRIPE_API_VERSION = process.env.STRIPE_API_VERSION?.trim() || '2026-07-29.dahlia'

/** Whether the key we hold is a test key, a live key, or absent. */
export type StripeKeyMode = 'off' | 'test' | 'live'

export function stripeKeyMode(): StripeKeyMode {
  const key = process.env.STRIPE_SECRET_KEY?.trim()
  if (!key) return 'off'
  if (/^(sk|rk)_live_/.test(key)) return 'live'
  if (/^(sk|rk)_test_/.test(key)) return 'test'
  // An unrecognised prefix is not a third mode. Refusing to guess is the safe direction:
  // treating it as live would let a typo transact, and treating it as test would let a real
  // key transact while reporting itself as a sandbox.
  return 'off'
}

/**
 * A live key on a deployment that is not production — refused rather than warned about.
 *
 * ── WHY THIS IS A HARD REFUSAL AND `metaMode()` IS A SOFT ONE ───────────────────────
 * `lib/meta/config.ts` has the same shape and settles for ignoring a test code in
 * production, because the cost of getting it wrong is bad ANALYTICS. Here both directions
 * cost money in a way nobody notices for a month:
 *
 *   a LIVE key on preview      QA walks the checkout and charges a real card. The family is
 *                              really billed, the webhook really grants the tier, and the
 *                              only trace is a Stripe payment nobody meant to take.
 *   a TEST key on production   every checkout succeeds, every webhook fires, every tier is
 *                              granted, and NO MONEY IS EVER COLLECTED. This is the
 *                              expensive one, and it is completely silent — the product
 *                              works perfectly.
 *
 * The second cannot be detected from inside the process (a test key is a valid key doing
 * exactly what it is asked), so it is a GO LIVE checklist item in TODO.md. The first can,
 * and is refused here.
 *
 * `VERCEL_ENV` is UNSET on a laptop, which is deliberately not a mismatch: a developer with
 * a live key in `.env.local` has made a choice this file cannot second-guess, and refusing
 * would mean the only way to exercise the real flow is to deploy.
 */
export function liveKeyOnNonProduction(): boolean {
  const env = process.env.VERCEL_ENV?.trim()
  return stripeKeyMode() === 'live' && env != null && env !== '' && env !== 'production'
}

/** The platform secret key, or null when this deployment must not transact. */
export function stripeSecretKey(): string | null {
  if (liveKeyOnNonProduction()) return null
  const key = process.env.STRIPE_SECRET_KEY?.trim()
  return key && stripeKeyMode() !== 'off' ? key : null
}

/**
 * Prices are looked up per tier and per billing shape, and BOTH are real Stripe Prices.
 *
 * ── WHY NOT `price_data` INLINE ─────────────────────────────────────────────────────
 * A Checkout Session can carry an ad-hoc amount, which would save six environment
 * variables and is the wrong trade. Stripe's own guidance is to model the catalogue: one
 * PRODUCT per plan (so an invoice line says "GENORRA Plus" rather than the same name for
 * every tier) and one PRICE per billing variant of it. That also puts the figure somewhere
 * a person can see it — a Dashboard price is auditable, a `unit_amount` computed in our
 * code is a number that only appears on a receipt after somebody has been charged.
 *
 *   'recurring'  a monthly recurring Price. Quantity is always 1.
 *   'prepaid'    a ONE-TIME Price whose unit IS ONE MONTH, bought `quantity: months` times.
 *
 * The prepaid price is per-month rather than per-term for the reason `lib/plans.ts` gives
 * about annual figures: there is one rate per tier, and a term is a multiple of it. A
 * separate "annual" price would be a second figure that could disagree with the first, and
 * `TIER_PRICE` would no longer be the one place a price lives.
 *
 * BOTH PRICES FOR A TIER MUST AGREE WITH `TIER_PRICE[tier].monthlyCents`. The figures live
 * in Stripe, so no gate that reads this repo can see them, and the screen a family sees
 * quotes `TIER_PRICE` — a mismatch shows up as a hosted page asking for a different number
 * than the button promised.
 *
 * `npm run stripe:check` IS THE THING THAT ASKS (2026-09-02). It reads the six ids out of
 * the environment, retrieves each price from whichever account the key points at, and
 * compares the amount, the interval, the currency, whether the price is still active and
 * the PRODUCT NAME a family reads at the till against what this repo believes. It is
 * hand-run rather than a `verify.yml` step — it needs a live secret key and asks a third
 * party — so it is a GO LIVE item still, just one with a command attached instead of an
 * instruction addressed to a person.
 *
 * THE NAME IS THE ONE IT WAS BUILT FOR. A real sandbox checkout rendered its line as
 * `STRIPE_PRICE_STANDARD_RECURRING`, because the Product had been named after the variable
 * that holds its Price id — a wrong SHAPE charges the wrong money and `priceShapeError`
 * refuses it, while a wrong NAME charges the right money and tells the family they are
 * buying a configuration key. That script also overrides the per-plan naming this paragraph
 * argues for above; see its header for why, and for the one edit that puts it back.
 */
export type BillingShape = 'recurring' | 'prepaid'

const PRICE_ENV: Record<BillingShape, (tier: FamilyTier) => string> = {
  recurring: tier => `STRIPE_PRICE_${tier.toUpperCase()}_RECURRING`,
  prepaid: tier => `STRIPE_PRICE_${tier.toUpperCase()}_PREPAID`,
}

/** The Stripe Price id for a tier and shape, or null when it is not configured. */
export function platformPriceId(tier: FamilyTier, shape: BillingShape): string | null {
  if (tier === 'free') return null
  return process.env[PRICE_ENV[shape](tier)]?.trim() || null
}

/**
 * Which tier and shape a Stripe Price id belongs to, or null for one we do not sell.
 *
 * ── THE PRICE IS WHAT THE WEBHOOK BELIEVES, NOT THE METADATA ────────────────────────
 * The reverse of `platformPriceId`, and the one the money path uses. An invoice carries the
 * price the family was actually CHARGED on, which makes it the only trustworthy statement of
 * what they bought — `genorra_tier` in metadata is a copy written when the session was
 * created, and it survives a proration, a plan change and a Dashboard edit without being
 * updated by any of them. After `changePlanTier` moves a subscription item to a different
 * price, the metadata says one tier and the invoice says another. The invoice is right.
 *
 * NULL FOR AN UNKNOWN PRICE, and a handler must read that as "not ours" rather than guessing.
 * This Stripe account may one day carry a price nobody wired up here, and crediting a family
 * for a tier because a charge happened to land is worse than not crediting them at all — the
 * second is a support ticket, the first is the product being given away.
 */
export function tierForPriceId(
  priceId: string | null | undefined,
): { tier: FamilyTier; shape: BillingShape } | null {
  if (!priceId) return null
  for (const tier of TIERS) {
    if (tier === 'free') continue
    for (const shape of ['recurring', 'prepaid'] as const) {
      if (platformPriceId(tier, shape) === priceId) return { tier, shape }
    }
  }
  return null
}

/**
 * Whether the platform side can take a payment for a given tier AT ALL.
 *
 * Per tier rather than globally, because the failure this prevents is partial: three tiers
 * are sold and somebody sets two price ids. Without this the third tier renders a working
 * button that fails at the API call, after the member has decided to pay.
 */
export function platformBillingConfigured(tier: FamilyTier, shape: BillingShape): boolean {
  return stripeSecretKey() != null && platformPriceId(tier, shape) != null
}

/** Whether the platform side is usable for anything at all — the panel's own gate. */
export function anyPlatformBillingConfigured(): boolean {
  return stripeSecretKey() != null
    && TIERS.some(t => platformPriceId(t, 'recurring') != null || platformPriceId(t, 'prepaid') != null)
}

/**
 * Whether a family may connect its own Stripe account.
 *
 * The same platform key does this, so there is no second credential — but a Connect
 * integration also needs the Connect webhook endpoint to exist, and without it an onboarding
 * that completes is an onboarding nothing hears about. A family would be left looking at
 * "connecting…" forever with a fully working Stripe account behind it, which is worse than
 * not offering the button.
 */
export function connectConfigured(): boolean {
  return stripeSecretKey() != null && connectWebhookSecret() != null
}

/**
 * The country a family's connected account is created in. ISO 3166-1 alpha-2, lowercase.
 *
 * ── STRIPE REFUSES THE ACCOUNT WITHOUT IT, WHICH IS HOW THIS ARRIVED ───────────────
 * `POST /v2/core/accounts` answers `identity_country_required` — "The field identity.country
 * is required before setting configuration.merchant" — for any account that asks for the
 * merchant configuration, which every family's does. It is not an optional refinement: with
 * no country there is no account.
 *
 * ── IT IS A CONSTANT BECAUSE THERE IS NOTHING TO DERIVE IT FROM ────────────────────
 * `families` has no country column, and inventing one from the connecting administrator's
 * `people.country` would be exactly the derived-fact-that-is-not-a-fact this codebase keeps
 * refusing elsewhere: that column is free text ("United States"), it describes where one
 * relative lives, and a family's merchant country is a legal question about the family, not
 * an address on one member's row.
 *
 * `'us'` is the honest default rather than a guess. Every price in the product is USD
 * (`formatCurrency`, and `currency: 'usd'` on every session), phone numbers assume +1, and
 * `lib/regions.ts` carries US states in full. A family somewhere else is not supported by the
 * rest of the product either, so this constant is not the thing narrowing them.
 *
 * ── IT IS NOT A CONSTANT ANY MORE, AS OF 2026-08-31. THE FAMILY IS ASKED ───────────
 * Everything above described why `'us'` was the honest default, and all of it was true except
 * the conclusion: `lib/regions.ts` admits Canada and Mexico for a MEMBER's address, so a
 * Canadian family could exist in this product and would be created here as an AMERICAN
 * merchant — and `identity.country` cannot be changed afterwards. The failure was not an error
 * message. Onboarding ran, asked for US paperwork, and left the family with an account they
 * could never complete.
 *
 * `lib/stripe/connect-countries.ts` is the registry now: every country Stripe permits a US
 * platform to create an account in, with an `enabled` flag per country, three of them true.
 * `DEFAULT_CONNECT_COUNTRY` is what the picker preselects and what every account created
 * before the picker existed already holds.
 *
 * ── AND `entity_type` IS DELIBERATELY NOT SET ──────────────────────────────────────
 * Optional, and Stripe collects it during hosted onboarding. Whether a family association is
 * a company, a non-profit or an individual is a question about that family's paperwork, and
 * the reference warns the value decides which identity fields apply and how the account is
 * validated — so guessing it would misvalidate the account rather than save anybody a step.
 */
export { DEFAULT_CONNECT_COUNTRY as CONNECT_ACCOUNT_COUNTRY } from '@/lib/stripe/connect-countries'

export function platformWebhookSecret(): string | null {
  return process.env.STRIPE_PLATFORM_WEBHOOK_SECRET?.trim() || null
}

export function connectWebhookSecret(): string | null {
  return process.env.STRIPE_CONNECT_WEBHOOK_SECRET?.trim() || null
}

/**
 * Where Stripe sends the buyer back to.
 *
 * ── THE RETURN PAGE IS NOT WHERE ANYTHING IS FULFILLED ──────────────────────────────
 * Stripe's guidance, and the reason it is worth restating here: nobody is guaranteed to
 * arrive. Somebody pays, the connection drops, the tab closes — and any logic that only runs
 * on this page silently drops the payment. So the webhook grants the tier and credits the
 * due, and this page only ever REPORTS. `session_id` is passed so it can tell "confirmed"
 * from "still confirming" by looking up whether the webhook has recorded that session yet,
 * which is a read and not a second fulfilment path.
 *
 * `SITE_URL` rather than a request header. `Host` and `X-Forwarded-Host` are
 * attacker-controlled, and here they would control the origin a payment redirect lands on —
 * the same rule `emailOrigin()` states about links inside an email.
 */
export function checkoutReturnUrls(path: string): { success_url: string; cancel_url: string } {
  const base = `${SITE_URL}${path}`
  const join = base.includes('?') ? '&' : '?'
  return {
    success_url: `${base}${join}checkout=success&session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${base}${join}checkout=cancelled`,
  }
}

/**
 * The label Stripe files a Checkout Session under, for comparing flows in the Dashboard.
 *
 * `integration_identifier` wants a stable prefix plus an eight-letter suffix. The suffix is
 * CONSTANT PER FLOW rather than per session — the point of the field is to group sessions so
 * two flows can be compared, and a fresh random suffix on every session would file every
 * payment under its own heading and answer nothing.
 */
export const INTEGRATION_IDS = {
  platformRecurring: 'genorra-plan-recurring-qwbtmxlz',
  platformPrepaid: 'genorra-plan-prepaid-hvkrdnps',
  familyDuesOnce: 'genorra-dues-once-tzmlqvbf',
  familyDuesAutopay: 'genorra-dues-autopay-jxnpwsdc',
  // Its OWN heading rather than sharing `familyDuesOnce`, because the whole purpose of this
  // field is to let two flows be compared in the Dashboard — and "what did our members owe"
  // and "what were we given" are exactly the two figures a treasurer wants separated.
  familyDonation: 'genorra-donation-once-rkvhpszd',
} as const
