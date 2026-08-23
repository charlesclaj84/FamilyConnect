import Stripe from 'stripe'

import { STRIPE_API_VERSION, liveKeyOnNonProduction, stripeSecretKey } from '@/lib/stripe/config'

/**
 * The one Stripe client, and the one place an account header is attached.
 *
 * ── A CLIENT INSTANCE, NEVER A GLOBAL KEY ───────────────────────────────────────────
 * `stripe.api_key = …` and its equivalents are deprecated in every current SDK, and the
 * reason matters more here than in a single-tenant app: a module-level key is process-wide
 * state, and this process serves requests for many families in parallel. Anything global
 * about "which account am I acting as" is a cross-family leak waiting for a race.
 *
 * ── AND THE ACCOUNT IS A PER-REQUEST OPTION, NEVER A SECOND CLIENT ──────────────────
 * A direct charge on a family's own Stripe account is our platform key plus a
 * `Stripe-Account` header. The SDK takes that as the `stripeAccount` REQUEST option — the
 * second argument to a method — rather than as client construction, which is what makes
 * `onAccount()` below the whole of the Connect plumbing.
 *
 * Building a second client per family would work and is the wrong shape twice over: a client
 * per family per request is a new HTTP agent and a new connection pool for a single call, and
 * — the real reason — a client that CARRIES an account cannot be told apart from one that
 * does not at the call site. `onAccount(acct)` in the argument list is visible in a diff.
 * `stripeFor(family)` five lines earlier is not, and AGENTS.md's §3 lesson is that the
 * dangerous version of this class of bug is always the one nobody was looking at.
 */

let cached: Stripe | null = null

/**
 * The platform client, or null when this deployment holds no usable key.
 *
 * NULL RATHER THAN THROWING, because "Stripe is not configured" is the ORDINARY state of
 * every developer laptop and of every preview deployment, and it must be reportable as a
 * sentence rather than as a 500. It is the same choice `smsConfigured()` makes and for the
 * same reason: a feature that is not switched on yet should say so, not crash.
 *
 * The instance is cached for the life of the process. It holds no per-request state — the
 * account header is passed per call — so sharing it is safe, and `liveKeyOnNonProduction`
 * cannot change under it because environment variables do not move at runtime.
 */
export function stripeClient(): Stripe | null {
  const key = stripeSecretKey()
  if (!key) return null
  if (!cached) {
    cached = new Stripe(key, {
      apiVersion: STRIPE_API_VERSION as Stripe.LatestApiVersion,
      // Named so a request in Stripe's own logs can be traced back to this app rather than
      // to "an unknown Node integration", which is the difference between a support
      // conversation lasting ten minutes and lasting a day.
      appInfo: { name: 'GENORRA', url: 'https://genorra.com' },
      // Two is enough. A webhook handler is the caller for most of these and it has its own
      // retry — Stripe redelivers a 500 — so retrying forever inside the request only makes
      // the endpoint time out, which reads to Stripe as a failure to be redelivered anyway.
      maxNetworkRetries: 2,
    })
  }
  return cached
}

/**
 * Why this deployment cannot transact, in one sentence, or null when it can.
 *
 * For an ACTION to return to a caller. Deliberately vague about which variable is missing:
 * this string reaches a browser, and enumerating the environment is the "never build an
 * endpoint that dumps environment variables" rule arriving through an error message.
 */
export function stripeUnavailableReason(): string | null {
  if (liveKeyOnNonProduction()) {
    return 'Online payments are switched off on this deployment.'
  }
  if (!stripeSecretKey()) {
    return 'Online payments are not set up yet.'
  }
  return null
}

/**
 * Request options that make a call act AS a connected account — a direct charge.
 *
 * Every Connect call in this product goes through this function, so a grep for `onAccount`
 * is the complete list of places GENORRA acts on a family's behalf. That is the property
 * worth preserving: the alternative is `{ stripeAccount: … }` written by hand at each site,
 * where the failure mode is omission and omission means the charge lands in OUR account.
 */
export function onAccount(stripeAccountId: string): Stripe.RequestOptions {
  return { stripeAccount: stripeAccountId }
}

/**
 * An idempotency key for a POST, scoped to what the call is FOR rather than to when it ran.
 *
 * Stripe replays the original response for a repeated key within 24 hours, which is what
 * stops a double-clicked button or a retried server action from creating two subscriptions.
 * The key therefore has to be derived from the INTENT — this family, this tier, this
 * shape — and never from a timestamp or a random value, since a fresh key defeats the whole
 * mechanism while looking like it is using it.
 *
 * NOT FOR WEBHOOK-SIDE WRITES. Those are made idempotent by the database instead
 * (`stripe_webhook_events` and the unique index on `dues_payments(source, processor_ref)`),
 * because a redelivery can arrive days later — long past Stripe's own 24-hour window.
 */
export function intentKey(parts: readonly (string | number)[]): string {
  return ['genorra', ...parts].join(':').slice(0, 255)
}
