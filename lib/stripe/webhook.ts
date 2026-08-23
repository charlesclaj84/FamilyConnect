import type Stripe from 'stripe'

import { stripeClient } from '@/lib/stripe/client'
import { connectWebhookSecret, platformWebhookSecret } from '@/lib/stripe/config'
import type { createAdminClient } from '@/lib/supabase/admin'

/** Matching the local alias every other module that takes the service role declares. */
type AdminClient = ReturnType<typeof createAdminClient>

/**
 * Turning a POST from the internet into a Stripe event we are willing to act on.
 *
 * ── THE SIGNATURE IS THE WHOLE BOUNDARY ─────────────────────────────────────────────
 * A webhook endpoint is an unauthenticated public URL that grants tiers and credits dues
 * payments. There is no session, no cookie and no permission model on it — the ONLY thing
 * standing between "anybody on the internet" and "this family has paid for Premium" is that
 * the body carries a `Stripe-Signature` computed with a secret we hold. So:
 *
 *   * verify BEFORE parsing, and never `JSON.parse` the body first "to see what it is";
 *   * verify against the RAW body bytes, because the signature covers the exact payload and
 *     any reserialisation (a JSON round trip, a framework body parser) changes it;
 *   * treat a verification failure as a 400 and log NOTHING from the body — an unverified
 *     payload is attacker-supplied text.
 *
 * ── TWO ENDPOINTS, TWO SECRETS, AND THEY ARE NOT INTERCHANGEABLE ────────────────────
 * Stripe signs with the secret of the ENDPOINT it delivered to. The platform endpoint hears
 * about GENORRA's own account; the Connect endpoint hears about every connected family
 * account and its events carry an `account` field. Verifying a Connect delivery against the
 * platform secret fails, which is correct and is why the two are separate arguments rather
 * than one "webhook secret" — a single secret would make the two endpoints
 * indistinguishable, and a Connect event arriving at the platform handler would be processed
 * as though it described OUR account.
 *
 * ── IDEMPOTENCY IS THE DATABASE'S JOB, NOT THE HANDLER'S ────────────────────────────
 * Stripe redelivers. It redelivers on a 500, on a timeout, and it can deliver the same event
 * twice in the ordinary course of things — days apart, which is past every in-process cache
 * and past Stripe's own 24-hour idempotency window. So a handler must not be written as
 * though it runs once. `claimStripeEvent` is the gate, and it is one SQL statement under a
 * row lock for the same reason `claim_distribution_recipients` is: a read-then-write from
 * this process lets two concurrent deliveries both decide they are the first, and the
 * consequence here is a family credited for two months on one payment.
 */

export type WebhookEndpoint = 'platform' | 'connect'

export type VerifiedEvent =
  | { ok: true; event: Stripe.Event }
  | { ok: false; status: 400 | 503; message: string }

/**
 * Verify a delivery and hand back the event.
 *
 * `503` versus `400` is a real distinction and Stripe acts on it: a 400 says "this request
 * was not from you, do not bother retrying", and a 503 says "I could not process it, try
 * again". A deployment with no webhook secret configured must answer 503, or Stripe gives up
 * redelivering events that would have been perfectly processable once the secret was set —
 * and the events lost that way are the ones that grant a tier somebody paid for.
 */
export async function verifyStripeWebhook(input: {
  endpoint: WebhookEndpoint
  rawBody: string
  signature: string | null
}): Promise<VerifiedEvent> {
  const stripe = stripeClient()
  if (!stripe) {
    return { ok: false, status: 503, message: 'Stripe is not configured on this deployment.' }
  }

  const secret = input.endpoint === 'platform' ? platformWebhookSecret() : connectWebhookSecret()
  if (!secret) {
    return { ok: false, status: 503, message: 'No webhook signing secret for this endpoint.' }
  }

  if (!input.signature) {
    return { ok: false, status: 400, message: 'Missing signature.' }
  }

  try {
    // `constructEventAsync` rather than the synchronous form: it uses Web Crypto where it is
    // available, so this module keeps working if a route is ever moved off the Node runtime.
    // The Node runtime is what the handlers declare today, and this costs nothing either way.
    const event = await stripe.webhooks.constructEventAsync(input.rawBody, input.signature, secret)
    return { ok: true, event }
  } catch {
    // The message from the SDK is deliberately discarded. It can quote the payload, and an
    // unverified payload must not reach a log line.
    return { ok: false, status: 400, message: 'Signature verification failed.' }
  }
}

/**
 * Claim an event for processing. `false` means somebody else has it, or it is already done.
 *
 * The claim can be RECOVERED — see `claim_stripe_event` in the migration. A handler that
 * dies mid-event would otherwise leave the row claimed and unprocessed forever, and every
 * redelivery Stripe makes would be refused as a duplicate: the event would be permanently
 * lost by the very mechanism that exists to stop it being applied twice.
 */
export async function claimStripeEvent(admin: AdminClient, input: {
  event: Stripe.Event
  endpoint: WebhookEndpoint
}): Promise<boolean> {
  const { event, endpoint } = input
  const { data, error } = await admin.rpc('claim_stripe_event', {
    p_event_id: event.id,
    p_event_type: event.type,
    p_endpoint: endpoint,
    // Present on every Connect delivery and absent on every platform one. Stored so a
    // support question about one family's payments can be answered without replaying
    // anything, and asserted by the handlers: a Connect event with no account is one we
    // cannot attribute to a family and must not act on.
    p_account_id: 'account' in event && typeof event.account === 'string' ? event.account : null,
  })

  if (error) {
    // Fail CLOSED — refuse the claim, answer 500, and let Stripe redeliver. Processing an
    // event whose claim could not be recorded is the one outcome worse than delaying it:
    // there would then be nothing anywhere to stop it being processed again.
    console.error(`[stripe/${endpoint}] could not claim ${event.id}: ${error.message}`)
    return false
  }
  return data === true
}

/** Record the outcome. `error` null on success; a short reason otherwise. */
export async function finishStripeEvent(admin: AdminClient, input: {
  eventId: string
  endpoint: WebhookEndpoint
  error?: string | null
}): Promise<void> {
  const { error } = await admin.rpc('finish_stripe_event', {
    p_event_id: input.eventId,
    p_error: input.error ?? null,
  })
  if (error) {
    console.error(`[stripe/${input.endpoint}] could not finish ${input.eventId}: ${error.message}`)
  }
}

/**
 * The `account` on a Connect delivery, or null.
 *
 * Its own function because it is the family-scoping key for the whole Connect handler — the
 * `acct_…` is what `family_stripe_accounts` is looked up by, and everything downstream is
 * scoped by the family that read returns. AGENTS.md §3's obligation on a service-role write
 * is discharged from this one value, so it is worth being narrow about: a string or nothing.
 */
export function connectAccountOf(event: Stripe.Event): string | null {
  return 'account' in event && typeof event.account === 'string' && event.account.length > 0
    ? event.account
    : null
}
