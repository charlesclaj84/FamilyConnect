import { NextResponse, type NextRequest } from 'next/server'
import type Stripe from 'stripe'

import { createAdminClient } from '@/lib/supabase/admin'
import {
  claimStripeEvent, finishStripeEvent, verifyStripeWebhook, type WebhookEndpoint,
} from '@/lib/stripe/webhook'
import type { HandledEvent } from '@/lib/stripe/platform-events'

/**
 * The plumbing both Stripe endpoints share: verify, claim, handle, record, answer.
 *
 * ── ONE MECHANISM, TWO ROUTES ───────────────────────────────────────────────────────
 * `app/api/stripe/platform/route.ts` and `app/api/stripe/connect/route.ts` are four lines
 * each. That is deliberate rather than terse: the ORDER of the steps below is the security
 * property, and two copies of it would be two places for somebody to move the claim above the
 * verification, or to answer 200 on a failure. It lives here once so a diff to it is visible.
 *
 * ── WHAT EACH STATUS CODE MEANS TO STRIPE, WHICH IS THE WHOLE CONTRACT ──────────────
 * Stripe reads the status and decides whether to redeliver, so these are not cosmetic:
 *
 *   200  understood. Never redelivered. Answered for an event we deliberately ignore, and for
 *        one already applied — both are "nothing more to do".
 *   400  not from you, or malformed. Stripe stops trying, which is right for a bad signature
 *        and would be catastrophic for anything else.
 *   500  we failed. Stripe redelivers with backoff for up to three days, which is the only
 *        thing that recovers a payment our database was briefly unable to record. So a handler
 *        that could not do its job MUST answer 500 — swallowing it into a 200 loses the event
 *        permanently, and the events lost that way are the ones that grant a tier somebody
 *        paid for or credit a due somebody settled.
 *   503  we are not configured. Also redelivered, which is what makes it safe to point a
 *        Stripe endpoint at a deployment before the secrets are set.
 *
 * ── AND WHY `processed_at` STAYS NULL ON A FAILURE ──────────────────────────────────
 * `finish_stripe_event` records the error and leaves the row unfinished on purpose, so the
 * claim goes stale and the redelivery above can pick it up. Marking a failed event as done is
 * the permanent-loss bug that the claim-recovery window in 20260823000004 §4 exists to
 * prevent, arriving from the other end.
 */
export async function handleStripeWebhookRequest(
  request: NextRequest,
  endpoint: WebhookEndpoint,
  handle: (event: Stripe.Event) => Promise<HandledEvent>,
): Promise<NextResponse> {
  // THE RAW BODY, BEFORE ANYTHING PARSES IT. The signature covers these exact bytes, so a
  // JSON round trip — or any framework body parser — invalidates it. `request.text()` is the
  // only read of the body on this path, and it happens before verification rather than after
  // because it is the input TO verification.
  const rawBody = await request.text()

  const verified = await verifyStripeWebhook({
    endpoint,
    rawBody,
    signature: request.headers.get('stripe-signature'),
  })
  if (!verified.ok) {
    // Nothing from the body is logged. An unverified payload is attacker-supplied text, and
    // this is the one place in the product that handles some.
    console.error(`[stripe/${endpoint}] rejected a delivery: ${verified.message}`)
    return NextResponse.json({ error: verified.message }, { status: verified.status })
  }

  const event = verified.event
  const admin = createAdminClient()

  const claimed = await claimStripeEvent(admin, { event, endpoint })
  if (!claimed) {
    // Already applied, being applied by a concurrent delivery, or unclaimable because the
    // claim itself failed. The first two are 200 — there is genuinely nothing to do — and the
    // third is indistinguishable from them here, which is why `claimStripeEvent` logs it. That
    // is a deliberate trade: refusing the claim and answering 200 delays an event by one
    // redelivery, whereas processing an event whose claim could not be recorded risks applying
    // it twice, and only one of those costs money.
    return NextResponse.json({ received: true, duplicate: true })
  }

  let outcome: HandledEvent
  try {
    outcome = await handle(event)
  } catch (e) {
    const detail = e instanceof Error ? e.message : String(e)
    console.error(`[stripe/${endpoint}] ${event.type} ${event.id} threw: ${detail}`)
    await finishStripeEvent(admin, { eventId: event.id, endpoint, error: detail })
    return NextResponse.json({ error: 'handler failed' }, { status: 500 })
  }

  if (!outcome.handled) {
    console.error(`[stripe/${endpoint}] ${event.type} ${event.id} not handled: ${outcome.detail}`)
    await finishStripeEvent(admin, { eventId: event.id, endpoint, error: outcome.detail })
    return NextResponse.json({ error: 'not handled' }, { status: 500 })
  }

  await finishStripeEvent(admin, { eventId: event.id, endpoint })
  console.log(`[stripe/${endpoint}] ${event.type}: ${outcome.detail}`)
  return NextResponse.json({ received: true })
}
