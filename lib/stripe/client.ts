import { createHash } from 'node:crypto'

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
 * Why this deployment cannot transact, as a CATALOGUE KEY, or null when it can.
 *
 * For an ACTION to hand to `t`. Deliberately vague about which variable is missing: the
 * sentence reaches a browser, and enumerating the environment is the "never build an endpoint
 * that dumps environment variables" rule arriving through an error message.
 *
 * ── IT RETURNED THE SENTENCE UNTIL 2026-09-01, AND THAT WAS UNTRANSLATED ──────────
 * Ten actions returned it straight to the caller, so "Online payments are not set up yet."
 * reached every reader in English. Neither static gate could see it: `lib/` is outside
 * `i18n:literals`' sweep on purpose — the catalogues live there and their English IS the
 * source — and `i18n:check` only asks whether keys exist. `npm run i18n:onscreen` found it on
 * `/admin/settings`.
 *
 * ── AND IT WAS RENAMED, WHICH IS THE POINT ───────────────────────────────────────
 * `stripeUnavailableKey` → `stripeUnavailableKey`. Changing the return value without
 * changing the name would have left ten call sites compiling perfectly and rendering
 * `act.onlinePaymentsNotSetUp2` on screen — a worse failure than the one being fixed, and one
 * no gate would catch either. The rename makes `npm run typecheck` the thing that finds them.
 */
export function stripeUnavailableKey(): string | null {
  if (liveKeyOnNonProduction()) {
    return 'act.onlinePaymentsOffDeployment'
  }
  if (!stripeSecretKey()) {
    return 'act.onlinePaymentsNotSetUp2'
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
 *
 * ── `body` — FINGERPRINT THE REQUEST WHEN ITS SHAPE CAN CHANGE ──────────────────────
 * Stripe replays a key only for the SAME parameters, and refuses outright when they differ:
 *
 *     Keys for idempotent requests can only be used with the same parameters they were
 *     first used with. Try using a key other than 'genorra:plan:4BEZ2S:standard:recurring:1'
 *
 * That is a real one, 2026-08-25, and it is what a purely-intent key costs when the request
 * it stands for is edited: every family that had attempted a checkout in the previous 24
 * hours met it, on a deploy whose whole purpose was to make that checkout work. The naming
 * parts said "this family, this tier, monthly, one month", which was still true — and the
 * body they had been recorded against was not.
 *
 * Passing the params appends a short digest of them, so a changed request is a changed key
 * with nobody having to remember a version number. It does NOT weaken the guarantee: a
 * double-clicked button sends identical parameters and still gets one session back. The
 * naming parts are kept in front of the digest because an opaque key in the Dashboard is
 * one nobody can trace back to a family.
 *
 * REACH FOR IT WHEN THE REQUEST CARRIES A FIGURE OR A CONDITIONAL SHAPE. A fixed-shape call
 * whose only variable is already in the parts — `ensureCustomer`, `cancelPlanRenewal` —
 * gains nothing from it.
 *
 * AND THE WARNING ABOVE APPLIES TO THE BODY TOO: a params object holding a clock reading
 * rather than a date makes every call a fresh key, which defeats the whole mechanism while
 * looking like it is using it. `trial_end` is safe because it is midnight on a day; a
 * `Math.floor(Date.now() / 1000)` in there would not be.
 */
export function intentKey(parts: readonly (string | number)[], body?: unknown): string {
  const named = ['genorra', ...parts].join(':')
  if (body === undefined) return named.slice(0, 255)
  const digest = createHash('sha256').update(JSON.stringify(body)).digest('hex').slice(0, 12)
  return `${named}:${digest}`.slice(0, 255)
}
