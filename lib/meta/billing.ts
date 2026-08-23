/**
 * The money end of the funnel: checkout entered, subscription won, subscription kept.
 *
 * NOT A SERVER ACTION. Plain module — see lib/meta/capi.ts's header for why that matters
 * more here than anywhere else: an exported `'use server'` function that reports a purchase
 * would be a public HTTP endpoint for fabricating revenue in the ad account.
 *
 * ── NOTHING IN THIS FILE HAS A CALLER YET, AND THAT IS THE HONEST STATE ─────────────
 * GENORRA HAS NO PAYMENT PROVIDER. `payment_info.md` is pre-implementation research,
 * `TIER_IS_SOLD` in lib/plans.ts is `false` for every paid tier, and `setFamilyTier` — the
 * only thing in the product that moves a family onto a paid plan — is scaffolding that
 * charges nothing and says so on screen. There is therefore no authoritative payment
 * confirmation anywhere to fire a `Purchase` from.
 *
 * The alternative was to fire one from `setFamilyTier`, and it is exactly the anti-pattern
 * that makes purchase tracking worthless: the button press is not the payment. It would
 * teach Meta's optimiser to find people who press a free scaffolding control, and it would
 * report revenue the business never received. So these functions are built, typed and
 * tested, and they are called by nothing until a provider confirms a real charge. Wiring
 * them up is then ONE import in the webhook handler — see lib/meta/README.md.
 *
 * ── THE AUTHORITY IS THE PROVIDER, NOT THE BROWSER ──────────────────────────────────
 * `SettledSubscriptionPayment` is deliberately shaped like a webhook payload and not like
 * anything a client could assemble. `transactionId`, `amountCents` and `firstPayment` are
 * facts the payment provider states; a success page that a customer refreshed is not a
 * source for any of them.
 *
 * ── AND THE VALUE COMES FROM THE TRANSACTION, NEVER FROM `TIER_PRICE` ───────────────
 * There is a table of prices in lib/plans.ts and it must not be read here. A conversion's
 * value is what was actually charged: after a proration, a coupon, a partial refund, a tax
 * line or a currency the plan table does not know about, the catalogue price and the charge
 * disagree — and the reported figure has to be the one the bank moved, or every
 * value-optimised campaign is bidding against a fiction.
 */

import { metaEventId, renewalEventId } from '@/lib/meta/event-id'
import { trackServerEvent, type TrackServerEventResult } from '@/lib/meta/dispatch'
import { valueFromCents } from '@/lib/meta/events'
import type { MetaAccountHolder } from '@/lib/meta/identity'

/** Safe subscription metadata. Product-wide strings, identical for every customer. */
export interface SubscriptionContext {
  /** The plan's internal id — `standard`, `plus`, `premium`. Never a family code. */
  planId: string
  billingInterval: 'monthly' | 'annual'
}

/**
 * A charge the payment provider has CONFIRMED. Every field is theirs, not the browser's.
 */
export interface SettledSubscriptionPayment extends SubscriptionContext {
  /**
   * The provider's own reference for this charge — a Stripe charge or invoice id, or the
   * equivalent. It is what makes a redelivered webhook idempotent, so it must identify the
   * CHARGE and not the subscription: every renewal of one subscription shares the
   * subscription id, and keying on that would make month two look like a duplicate of
   * month one and be discarded forever.
   */
  transactionId: string
  /** The subscription this charge belongs to. Carried as context, never as the key. */
  subscriptionId: string
  /** What was actually charged, in minor units. */
  amountCents: number
  /** ISO 4217. From the transaction. */
  currency: string
  /**
   * Is this the charge that WON the customer?
   *
   * Stated by the provider — for Stripe, `invoice.billing_reason === 'subscription_create'`
   * — and never inferred here. This one boolean is what keeps acquisition and retention
   * apart, and inferring it from our own records ("have we seen this family pay before?")
   * would be wrong the first time a family cancels and resubscribes, or the first time the
   * ledger is restored from a backup.
   */
  firstPayment: boolean
  holder: MetaAccountHolder
  /** When the provider settled it. Meta rejects a batch containing anything over 7 days old. */
  occurredAtMs?: number
  sourcePath?: string
}

export interface SubscriptionTrackingResult {
  purchase?: TrackServerEventResult
  subscribe?: TrackServerEventResult
  renewal?: TrackServerEventResult
}

/**
 * The customer has genuinely entered the subscription checkout.
 *
 * `checkoutId` is the provider's session id — not a plan name and not the family. It is
 * what stops a customer who abandons and restarts from being counted as two prospects.
 */
export async function trackCheckoutStarted(input: {
  checkoutId: string
  amountCents: number
  currency: string
  holder: MetaAccountHolder
  sourcePath?: string
} & SubscriptionContext): Promise<TrackServerEventResult> {
  return trackServerEvent({
    event: 'InitiateCheckout',
    eventId: metaEventId('InitiateCheckout', input.checkoutId),
    sourcePath: input.sourcePath ?? '/upgrade',
    holder: input.holder,
    customData: {
      value: valueFromCents(input.amountCents) ?? undefined,
      currency: input.currency,
      content_name: 'GENORRA Subscription',
      content_category: 'Checkout',
      content_type: 'subscription',
      plan_id: input.planId,
      billing_interval: input.billingInterval,
    },
  })
}

/**
 * A charge settled. THE ONE ENTRY POINT a payment webhook needs.
 *
 * ── WHAT IT SENDS, AND WHY THE SPLIT IS THE WHOLE POINT ─────────────────────────────
 *
 *   FIRST PAYMENT   `Purchase` AND `Subscribe`. Both are Meta standard events and they are
 *                   for different jobs: `Purchase` is what value-based optimisation and
 *                   ROAS reporting read, `Subscribe` is Meta's own event for a paid
 *                   subscription beginning. They carry DIFFERENT event ids — the event name
 *                   is folded into the hash — so they are two conversions rather than a
 *                   duplicate pair, which is correct and is what Meta's model expects.
 *
 *   RENEWAL         `SubscriptionRenewal` ONLY. A custom event, and deliberately neither of
 *                   the standard two.
 *
 * ── WHY A RENEWAL IS NOT A `Purchase` ───────────────────────────────────────────────
 * Because `Purchase` is the event campaigns are optimised on and reported against, and a
 * subscription business sends far more renewals than acquisitions. Folding them together
 * would make the new-customer count grow every month with no new customers in it, make cost
 * per acquisition fall as a pure artefact of the existing base, and train the optimiser on
 * a conversion it can never cause — nobody's ad click produces somebody else's month-nine
 * renewal.
 *
 * The revenue is not thrown away: `SubscriptionRenewal` carries the same value and currency
 * and can be turned into a custom conversion in Events Manager whenever lifetime revenue is
 * wanted. What it cannot do is silently contaminate acquisition reporting, which is the one
 * thing that must not happen by default.
 */
export async function trackSubscriptionPayment(
  payment: SettledSubscriptionPayment,
): Promise<SubscriptionTrackingResult> {
  const value = valueFromCents(payment.amountCents) ?? undefined
  const sourcePath = payment.sourcePath ?? '/upgrade'
  const common = {
    value,
    currency: payment.currency,
    order_id: payment.transactionId,
    plan_id: payment.planId,
    billing_interval: payment.billingInterval,
    content_type: 'subscription',
  }

  if (!payment.firstPayment) {
    return {
      renewal: await trackServerEvent({
        event: 'SubscriptionRenewal',
        eventId: renewalEventId(payment.transactionId),
        sourcePath,
        holder: payment.holder,
        occurredAtMs: payment.occurredAtMs,
        customData: {
          ...common,
          content_name: 'GENORRA Subscription Renewal',
          content_category: 'Retention',
        },
      }),
    }
  }

  // Sequential rather than `Promise.all`, so the two ledger claims cannot interleave and so
  // a failure of the first is visible in the log before the second is attempted. Two
  // round trips on a webhook that is already off the critical path is not a cost worth
  // optimising against clarity here.
  const purchase = await trackServerEvent({
    event: 'Purchase',
    eventId: metaEventId('Purchase', payment.transactionId),
    sourcePath,
    holder: payment.holder,
    occurredAtMs: payment.occurredAtMs,
    customData: { ...common, content_name: 'GENORRA Subscription', content_category: 'Acquisition' },
  })

  const subscribe = await trackServerEvent({
    event: 'Subscribe',
    eventId: metaEventId('Subscribe', payment.transactionId),
    sourcePath,
    holder: payment.holder,
    occurredAtMs: payment.occurredAtMs,
    customData: { ...common, content_name: 'GENORRA Subscription', content_category: 'Acquisition' },
  })

  return { purchase, subscribe }
}
