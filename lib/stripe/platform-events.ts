import type Stripe from 'stripe'

import { createAdminClient } from '@/lib/supabase/admin'
import { TIER_RANK, isFamilyTier, type FamilyTier } from '@/lib/tiers'
import {
  addDays, isPrepayMonths, prepaidPurchase, subscriptionIsCurrent, tierFromMetadata,
  type BillingMode, type PlatformBillingRecord,
} from '@/lib/platform-billing'
import { stripeClient } from '@/lib/stripe/client'
import { tierForPriceId } from '@/lib/stripe/config'
import { trackSubscriptionPayment } from '@/lib/meta/billing'

/**
 * Deciding that a family has paid GENORRA — the only place in the product that may.
 *
 * ── EVERYTHING HERE IS A FACT FROM STRIPE. NOTHING IS A CLAIM FROM A BROWSER ────────
 * `app/actions/billing.ts` creates sessions and writes promises; it never writes
 * `families.tier` and never writes `paid_through`. This does, and it is reached only through a
 * signature-verified delivery. That split is the whole design, and its one-line justification
 * is `lib/meta/billing.ts`': *"the button press is not the payment."*
 *
 * ── WHICH EVENTS, AND WHY EACH ONE ──────────────────────────────────────────────────
 *
 *   checkout.session.completed              a PREPAID term was bought. The money event for
 *   checkout.session.async_payment_succeeded `mode: 'payment'`. Both are handled and both are
 *                                           gated on `payment_status !== 'unpaid'`, because a
 *                                           delayed-notification method completes the session
 *                                           while it is still unpaid: fulfilling on
 *                                           `completed` alone grants a tier for a payment that
 *                                           may later fail, AND never fulfils the ones that
 *                                           succeed days afterwards.
 *   invoice.paid                            the money event for a SUBSCRIPTION — every period,
 *                                           including the first. This is what extends the term.
 *   invoice.payment_failed                  the card failed. Records the fact and changes
 *                                           nothing else; see the delinquency note below.
 *   customer.subscription.created|updated   status, cancellation flag and period end. Records
 *                                           Stripe's view; grants nothing on its own.
 *   customer.subscription.deleted           the plan has ended. Free takes effect.
 *
 * ── WHY A SUBSCRIPTION EVENT DOES NOT GRANT A TIER ──────────────────────────────────
 * `customer.subscription.updated` fires when the item price changes, and `changePlanTier`
 * changes it for a DOWNGRADE with `proration_behavior: 'none'` — so at that moment Stripe's
 * subscription says Standard while the family has paid for Premium through the end of the
 * period and must keep it. Reading the tier off the subscription there would take away pages
 * somebody had paid for, on the day they chose to move DOWN, which is the sharpest possible
 * version of breaking rule 3. Money is what grants; `invoice.paid` is money.
 *
 * ── AND A TIER IS ONLY EVER PROMOTED HERE, NEVER DEMOTED ────────────────────────────
 * `promoteTier` refuses to move `families.tier` downwards. Every downgrade in this product
 * goes through `scheduled_tier` and the sweep, so a webhook that could lower a tier would be a
 * second, unscheduled path to the one thing the no-refund rule protects.
 *
 * ── DELINQUENCY IS RECORDED AND NOT ACTED ON ────────────────────────────────────────
 * `invoice.payment_failed` stamps `delinquent_since` and stops. It does not drop the tier, does
 * not email anybody and does not schedule anything, because none of that has been decided —
 * Stripe keeps retrying a failed card for days, so a family whose payment fails on Tuesday and
 * succeeds on Thursday must not lose their pages in between. TODO.md carries the policy
 * question as its own item; this side of it is deliberately just data.
 */

type AdminClient = ReturnType<typeof createAdminClient>

/** What a handler did, for the log line and for `finish_stripe_event`. */
export interface HandledEvent {
  handled: boolean
  detail: string
}

const IGNORED: HandledEvent = { handled: true, detail: 'ignored' }

export async function handlePlatformEvent(event: Stripe.Event): Promise<HandledEvent> {
  const admin = createAdminClient()

  switch (event.type) {
    case 'checkout.session.completed':
    case 'checkout.session.async_payment_succeeded':
      return onCheckoutSession(admin, event.data.object as Stripe.Checkout.Session)

    case 'checkout.session.async_payment_failed': {
      const session = event.data.object as Stripe.Checkout.Session
      // Nothing to undo — no tier was granted, because the paid branch above never ran. Worth
      // a log line rather than silence: a family who thinks they paid and did not is a support
      // conversation, and this is the only trace of it on our side.
      return { handled: true, detail: `async payment failed for session ${session.id}` }
    }

    case 'invoice.paid':
      return onInvoicePaid(admin, event.data.object as Stripe.Invoice)

    case 'invoice.payment_failed':
      return onInvoiceFailed(admin, event.data.object as Stripe.Invoice)

    case 'customer.subscription.created':
    case 'customer.subscription.updated':
    case 'customer.subscription.deleted':
      return onSubscription(admin, event.type, event.data.object as Stripe.Subscription)

    default:
      // Stripe delivers whatever the endpoint is subscribed to, and an endpoint is often
      // subscribed to more than a handler needs. Answering "handled" for an event we do not
      // act on is correct — a 500 here would have Stripe redeliver it forever.
      return IGNORED
  }
}

// ── Prepaid: a term bought outright ─────────────────────────────────────────────────

async function onCheckoutSession(
  admin: AdminClient,
  session: Stripe.Checkout.Session,
): Promise<HandledEvent> {
  // THE GATE Stripe's guidance names first. `completed` arrives for a delayed-notification
  // method while the session is still unpaid, and `no_payment_required` is a zero-amount
  // session, which is not something this flow creates.
  if (session.payment_status === 'unpaid') {
    return { handled: true, detail: `session ${session.id} is still unpaid` }
  }

  const familyCode = familyOf(session.metadata, session.client_reference_id)
  if (!familyCode) {
    return { handled: false, detail: `session ${session.id} carries no family code` }
  }

  // A SUBSCRIPTION CHECKOUT IS NOT THE MONEY EVENT. `invoice.paid` follows it and is what
  // extends the term; all this does is record the ids so the panel can find the subscription
  // and so `openBillingPortal` works before the first invoice has settled.
  if (session.mode === 'subscription') {
    const subscriptionId = idOf(session.subscription)
    const { error } = await admin.from('platform_billing_accounts').upsert({
      family_code: familyCode,
      stripe_customer_id: idOf(session.customer),
      stripe_subscription_id: subscriptionId,
      mode: 'recurring' satisfies BillingMode,
    }, { onConflict: 'family_code' })
    if (error) return { handled: false, detail: `could not record subscription: ${error.message}` }
    return { handled: true, detail: `subscription ${subscriptionId ?? '?'} recorded for ${familyCode}` }
  }

  if (session.mode !== 'payment') return IGNORED

  // ── AN UPGRADE FROM A PREPAID TERM, WHOSE SHORTFALL HAS JUST BEEN PAID ─────────────
  // A different shape from a months purchase: there is no catalogue price and no quantity, and
  // the term end was computed by `upgradeQuote` when the session was created. `changePlanTier`
  // carries the outcome in metadata rather than having it recomputed, because `today` can move
  // between creating the session and the payment settling — a recomputed quote would then not
  // be the one the family was charged for.
  //
  // EVERY FIELD IS NARROWED, not cast. Metadata is ours, but it round-trips through an external
  // system and survives a Dashboard edit by anybody with access to our account.
  if (session.metadata?.genorra_mode === 'upgrade') {
    return onUpgradePaid(admin, session, familyCode)
  }

  // ── THE MONTHS COME OFF THE SESSION, NEVER OFF OUR METADATA ────────────────────────
  // The line item carries `adjustable_quantity`, so the family can change the term on
  // Stripe's own page — that is the "pay as far ahead as you like" half of the feature. Our
  // `genorra_mode` metadata says which shape was intended; the QUANTITY is what was bought,
  // and reading it from metadata would credit twelve months for a payment of three.
  const stripe = stripeClient()
  if (!stripe) return { handled: false, detail: 'Stripe is not configured' }

  // ── FIND THE PREPAID LINE, DO NOT TAKE THE FIRST ONE ───────────────────────────────
  // A prepaid session carries TWO line items since 2026-08-23: the whole months on the
  // catalogue price, and the current month's remainder as an ad-hoc `price_data` line (every
  // family bills on the 1st, so the first payment includes the part month). `limit: 1` would
  // return whichever Stripe happens to order first — and if that were the proration line,
  // `tierForPriceId` would answer null and a real payment would be refused as "not a price we
  // sell". Both figures are on the row that gets written; only the months line carries the
  // quantity, so the months line is the one to identify.
  let lines: Stripe.LineItem[] = []
  try {
    const page = await stripe.checkout.sessions.listLineItems(session.id, { limit: 10 })
    lines = page.data
  } catch (e) {
    return { handled: false, detail: `could not read line items: ${describe(e)}` }
  }

  const monthsLine = lines.find(l => {
    const p = tierForPriceId(idOf(l.price))
    return p != null && p.shape === 'prepaid'
  })
  const priced = tierForPriceId(idOf(monthsLine?.price))
  if (!priced || priced.shape !== 'prepaid') {
    return { handled: false, detail: `session ${session.id} is not on a prepaid price we sell` }
  }
  const months = monthsLine?.quantity
  if (!isPrepayMonths(months)) {
    return { handled: false, detail: `session ${session.id} has an unusable quantity` }
  }

  const record = await loadRecord(admin, familyCode)
  const today = todayISO()
  const purchase = prepaidPurchase({ record, tier: priced.tier, months, today })

  // THE LEDGER ROW FIRST, and its unique `stripe_ref` is what makes this whole handler
  // idempotent beyond `stripe_webhook_events` — that table's claim can be recovered after a
  // crash, so the term extension below has to be safe to reach twice. A conflict here means
  // this payment has already been applied, and the right answer is to stop rather than to
  // extend the term a second time.
  const ref = idOf(session.payment_intent) ?? session.id
  const inserted = await recordPayment(admin, {
    familyCode,
    kind: 'prepaid',
    tier: priced.tier,
    months,
    amountCents: session.amount_total ?? 0,
    currency: session.currency ?? 'usd',
    stripeRef: ref,
    sessionId: session.id,
    invoiceId: idOf(session.invoice),
    subscriptionId: null,
    coversFrom: purchase.anchor,
    coversThrough: purchase.paidThrough,
    firstPayment: record.paidTier == null,
  })
  if (inserted === 'duplicate') {
    return { handled: true, detail: `payment ${ref} was already applied` }
  }
  if (inserted !== 'ok') {
    return { handled: false, detail: `could not record payment ${ref}: ${inserted}` }
  }

  const { error } = await admin.from('platform_billing_accounts').upsert({
    family_code: familyCode,
    stripe_customer_id: idOf(session.customer),
    mode: 'prepaid' satisfies BillingMode,
    paid_tier: priced.tier,
    paid_through: purchase.paidThrough,
    // A prepaid purchase settles any delinquency and cancels any scheduled downgrade: the
    // family has just paid for a term at this tier, which is a louder statement than a promise
    // they made last month.
    delinquent_since: null,
    last_payment_failure: null,
    scheduled_tier: null,
    scheduled_tier_on: null,
  }, { onConflict: 'family_code' })
  if (error) return { handled: false, detail: `could not extend the term: ${error.message}` }

  await promoteTier(admin, familyCode, priced.tier)
  await announceToMeta(admin, {
    familyCode, tier: priced.tier,
    transactionId: ref,
    subscriptionId: session.id,
    amountCents: session.amount_total ?? 0,
    currency: session.currency ?? 'usd',
    firstPayment: record.paidTier == null,
    occurredAtMs: (session.created ?? 0) * 1000 || undefined,
  })

  return {
    handled: true,
    detail: `${familyCode} prepaid ${months} month(s) of ${priced.tier} through ${purchase.paidThrough}`,
  }
}


/**
 * A prepaid family's upgrade shortfall has been paid: grant the tier and hold the credit.
 *
 * ── THE TERM END AND THE CREDIT ARE CARRIED, NOT RECOMPUTED ─────────────────────────
 * `upgradeQuote` decided both when `changePlanTier` created the session, and re-deriving them
 * here would use a `today` that may have moved — so the family would be granted a term they
 * were not charged for. What IS re-derived is the family and the tier, both of which are
 * checked rather than trusted.
 *
 * ── AND IT IS AN UPGRADE, SO THE TIER IS ONLY EVER PROMOTED ─────────────────────────
 * `promoteTier` refuses a downward move. That matters here because this path writes
 * `paid_tier` unconditionally: if a redelivery of an old upgrade arrived after the family had
 * moved on, the ledger claim below stops it first, and `promoteTier` stops the tier moving
 * backwards even if it did not.
 */
async function onUpgradePaid(
  admin: AdminClient,
  session: Stripe.Checkout.Session,
  familyCode: string,
): Promise<HandledEvent> {
  const meta = session.metadata ?? {}
  const tier = tierFromMetadata(meta.genorra_tier)
  if (!tier || tier === 'free') {
    return { handled: false, detail: `upgrade session ${session.id} names no sellable tier` }
  }

  const paidThrough = meta.genorra_paid_through
  // `YYYY-MM-DD` and nothing else. A malformed value here would be written straight into a DATE
  // column, and a term end is the one figure that decides how long a family keeps what it paid
  // for — so it is validated by shape rather than left to Postgres to reject after the ledger
  // row has already been written.
  if (typeof paidThrough !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(paidThrough)) {
    return { handled: false, detail: `upgrade session ${session.id} carries no usable term end` }
  }

  const creditRaw = Number(meta.genorra_credit_left)
  const creditLeft = Number.isInteger(creditRaw) && creditRaw >= 0 ? creditRaw : 0

  const amount = session.amount_total ?? 0
  if (amount <= 0) {
    // A zero-amount upgrade session should not exist — `changePlanTier` applies that case
    // itself rather than sending anybody to a payment page for nothing. Reported rather than
    // quietly granted: it means the two halves disagree about the arithmetic.
    return { handled: false, detail: `upgrade session ${session.id} carried no money` }
  }

  const record = await loadRecord(admin, familyCode)
  const ref = idOf(session.payment_intent) ?? session.id
  const inserted = await recordPayment(admin, {
    familyCode,
    kind: 'prepaid',
    tier,
    months: 1,
    amountCents: amount,
    currency: session.currency ?? 'usd',
    stripeRef: ref,
    sessionId: session.id,
    invoiceId: idOf(session.invoice),
    subscriptionId: null,
    coversFrom: todayISO(),
    coversThrough: paidThrough,
    firstPayment: record.paidTier == null,
  })
  if (inserted === 'duplicate') {
    return { handled: true, detail: `upgrade ${ref} was already applied` }
  }
  if (inserted !== 'ok') {
    return { handled: false, detail: `could not record upgrade ${ref}: ${inserted}` }
  }

  const { error } = await admin.from('platform_billing_accounts').upsert({
    family_code: familyCode,
    stripe_customer_id: idOf(session.customer),
    mode: 'prepaid' satisfies BillingMode,
    paid_tier: tier,
    paid_through: paidThrough,
    credit_cents: creditLeft,
    // The upgrade supersedes any promise to move down: a family that asked for Standard next
    // month and has just paid for Premium is not moving to Standard.
    scheduled_tier: null,
    scheduled_tier_on: null,
    delinquent_since: null,
    last_payment_failure: null,
  }, { onConflict: 'family_code' })
  if (error) return { handled: false, detail: `could not apply the upgrade: ${error.message}` }

  await promoteTier(admin, familyCode, tier)
  await announceToMeta(admin, {
    familyCode, tier,
    transactionId: ref,
    subscriptionId: session.id,
    amountCents: amount,
    currency: session.currency ?? 'usd',
    firstPayment: record.paidTier == null,
    occurredAtMs: (session.created ?? 0) * 1000 || undefined,
  })

  return {
    handled: true,
    detail: `${familyCode} upgraded to ${tier} through ${paidThrough}, ${creditLeft}c credit carried`,
  }
}

// ── Recurring: one settled period ───────────────────────────────────────────────────

async function onInvoicePaid(admin: AdminClient, invoice: Stripe.Invoice): Promise<HandledEvent> {
  const subscriptionId = idOf(invoice.parent?.subscription_details?.subscription)
  if (!subscriptionId) {
    // A one-off invoice on our own account — `invoice_creation` on a prepaid session produces
    // one, and the checkout handler has already applied that payment. Nothing to do.
    return { handled: true, detail: `invoice ${invoice.id} has no subscription` }
  }

  const familyCode = await familyForSubscription(admin, subscriptionId, invoice)
  if (!familyCode) {
    return { handled: false, detail: `no family for subscription ${subscriptionId}` }
  }

  // The tier comes off the PRICE that was charged, not off metadata — see `tierForPriceId`.
  //
  // ── FIND THE RECURRING LINE, DO NOT TAKE THE FIRST PRICED ONE ─────────────────────
  // The same lesson `onCheckoutSession` learned on the prepaid path, arriving here because a
  // subscription's FIRST invoice carries two kinds of line: the subscription itself, and the
  // current month's remainder as an ad-hoc `price_data` line (every family bills on the 1st,
  // so the first payment includes the part month). Stripe decides the order, and if the part
  // month came first `tierForPriceId` would answer null for its throwaway price and a real
  // payment would be refused as "not a price we sell" — which is a 500, which is Stripe
  // redelivering it forever while the family sits on the tier they just paid for.
  //
  // A proration line on a later invoice carries the SAME price as the subscription line, so
  // taking the first recurring match is still right for every renewal and every plan change.
  const line = invoice.lines?.data?.find(l => {
    const p = tierForPriceId(idOf(l.pricing?.price_details?.price))
    return p != null && p.shape === 'recurring'
  })

  // ── AND IF THERE IS NO SUCH LINE, ASK THE SUBSCRIPTION ────────────────────────────
  // The first invoice of a subscription that starts in a trial is the case: the days before
  // the 1st are paid for by the ad-hoc line above, so the only thing on this invoice may be
  // that line. Whether Stripe also renders a zero-amount line for the trial period is its
  // decision and not one to depend on — and the consequence of guessing wrong is not a
  // cosmetic one. A refusal here is a 500, Stripe redelivers forever, and a family that has
  // paid sits on the tier they just left until the 1st.
  //
  // STILL A PRICE, not metadata: the subscription's own item is what it will be billed on,
  // which is the same fact `tierForPriceId`'s header calls the only trustworthy one. And
  // still the PERIOD Stripe is serving — during a trial that ends on the 1st, which is
  // exactly what the part month bought.
  const fallback = line ? null : await subscriptionPeriod(subscriptionId)
  const priced = tierForPriceId(idOf(line?.pricing?.price_details?.price) ?? fallback?.priceId)
  if (!priced || priced.shape !== 'recurring') {
    return { handled: false, detail: `invoice ${invoice.id} is not on a recurring price we sell` }
  }

  // The period the money actually covered. `paid_through` is INCLUSIVE and a Stripe period
  // end is EXCLUSIVE — the instant the next one begins — so the last day paid for is the day
  // before it. Off by one here is a family losing or gaining a day on every renewal,
  // compounding.
  const start = line?.period?.start ?? fallback?.start
  const end = line?.period?.end ?? fallback?.end
  const periodStart = start ? isoFromUnix(start) : null
  const periodEnd = end ? isoFromUnix(end) : null
  const paidThrough = periodEnd ? addDays(periodEnd, -1) : null

  const record = await loadRecord(admin, familyCode)
  const firstPayment = invoice.billing_reason === 'subscription_create'

  const ref = idOf(invoice.id) ?? `inv_${subscriptionId}_${invoice.period_end ?? 0}`
  const inserted = await recordPayment(admin, {
    familyCode,
    kind: 'subscription',
    tier: priced.tier,
    months: 1,
    amountCents: invoice.amount_paid ?? 0,
    currency: invoice.currency ?? 'usd',
    stripeRef: ref,
    sessionId: null,
    invoiceId: invoice.id ?? null,
    subscriptionId,
    coversFrom: periodStart,
    coversThrough: paidThrough,
    firstPayment,
  })
  if (inserted === 'duplicate') {
    return { handled: true, detail: `invoice ${ref} was already applied` }
  }
  if (inserted !== 'ok') {
    return { handled: false, detail: `could not record invoice ${ref}: ${inserted}` }
  }

  const { error } = await admin.from('platform_billing_accounts').upsert({
    family_code: familyCode,
    stripe_customer_id: idOf(invoice.customer),
    stripe_subscription_id: subscriptionId,
    mode: 'recurring' satisfies BillingMode,
    paid_tier: priced.tier,
    // NEVER MOVED BACKWARDS. A proration invoice for an UPGRADE covers the remainder of the
    // current period, so its line period ends where the current one does — but a late
    // redelivery of an older invoice would otherwise shorten a term that has since been
    // renewed.
    ...(paidThrough && laterOf(record.paidThrough, paidThrough) === paidThrough
      ? { paid_through: paidThrough }
      : {}),
    delinquent_since: null,
    last_payment_failure: null,
  }, { onConflict: 'family_code' })
  if (error) return { handled: false, detail: `could not record the paid period: ${error.message}` }

  await promoteTier(admin, familyCode, priced.tier)
  await announceToMeta(admin, {
    familyCode, tier: priced.tier,
    transactionId: ref,
    subscriptionId,
    amountCents: invoice.amount_paid ?? 0,
    currency: invoice.currency ?? 'usd',
    firstPayment,
    occurredAtMs: (invoice.created ?? 0) * 1000 || undefined,
  })

  return {
    handled: true,
    detail: `${familyCode} paid ${priced.tier} through ${paidThrough ?? 'unknown'}`,
  }
}

async function onInvoiceFailed(admin: AdminClient, invoice: Stripe.Invoice): Promise<HandledEvent> {
  const subscriptionId = idOf(invoice.parent?.subscription_details?.subscription)
  if (!subscriptionId) return IGNORED
  const familyCode = await familyForSubscription(admin, subscriptionId, invoice)
  if (!familyCode) return { handled: false, detail: `no family for subscription ${subscriptionId}` }

  // FIRST failure only. `delinquent_since` answers "how long has this been going on", and
  // Stripe retries a failed card several times over several days — so writing today's date on
  // every retry would reset the clock and make the column always report one day, which is exactly
  // the number a future grace period would be measured against.
  //
  // Read separately rather than through `loadRecord`: this is the one column no other handler
  // needs, and widening that shape to carry it would put a field on `PlatformBillingRecord`
  // that the pure module has no rule about.
  const { data: existing } = await admin
    .from('platform_billing_accounts')
    .select('delinquent_since')
    .eq('family_code', familyCode)
    .maybeSingle()
  const since = typeof existing?.delinquent_since === 'string' ? existing.delinquent_since : todayISO()

  const { error } = await admin.from('platform_billing_accounts').update({
    delinquent_since: since,
    last_payment_failure: `invoice ${invoice.id ?? '?'} failed`,
  }).eq('family_code', familyCode)
  if (error) return { handled: false, detail: `could not record the failure: ${error.message}` }

  // NOTHING ELSE. No tier change, no email, no schedule. See the header.
  return { handled: true, detail: `${familyCode} payment failed; recorded only` }
}

async function onSubscription(
  admin: AdminClient,
  type: string,
  subscription: Stripe.Subscription,
): Promise<HandledEvent> {
  const familyCode = await familyForSubscription(admin, subscription.id, subscription)
  if (!familyCode) return { handled: false, detail: `no family for subscription ${subscription.id}` }

  // `current_period_end` lives on the ITEM in this API version, not on the subscription — it
  // moved there when Stripe allowed items to bill on different cadences. Reading the old
  // subscription-level field would be `undefined`, which would silently null the period end.
  const periodEnd = subscription.items?.data?.[0]?.current_period_end
  const deleted = type === 'customer.subscription.deleted'

  const patch: Record<string, unknown> = {
    family_code: familyCode,
    stripe_subscription_id: subscription.id,
    subscription_status: deleted ? 'canceled' : subscription.status,
    cancel_at_period_end: subscription.cancel_at_period_end === true,
  }

  if (deleted) {
    // The plan has ENDED — the period Stripe was serving is over, so there is nothing left to
    // protect and Free takes effect from today. This is the one place a tier comes DOWN
    // without waiting, and it is not an exception to rule 4: the term it was protecting has
    // already run out.
    patch.scheduled_tier = 'free'
    patch.scheduled_tier_on = todayISO()
  } else if (subscriptionIsCurrent(subscription.status) && periodEnd) {
    // ── A TERM IS A TIER **AND** A DATE, AND THIS WROTE ONLY THE DATE ────────────────
    // `platform_billing_term_pair` is `(paid_tier IS NULL) = (paid_through IS NULL)`, and its
    // own comment says why: *"either alone describes nothing, and `entitlementOn()` would
    // report Free over a family that had paid."* So writing `paid_through` onto an account
    // with no `paid_tier` is refused by the database, the handler returns `handled: false`,
    // the route answers 500, and Stripe retries the event until it gives up.
    //
    // THAT IS THE ORDINARY PATH HERE, NOT A CORNER. Every recurring checkout this product
    // creates carries a `trial_end` — that is how "everybody bills on the 1st" is expressed
    // (see `startPlanCheckout`) — so `customer.subscription.created` arrives with status
    // `trialing`, which `subscriptionIsCurrent` counts, BEFORE any `invoice.paid` has set a
    // tier. Found in the hosted event log on 2026-08-29, against a real subscription:
    //
    //     customer.subscription.created   processed_at NULL
    //     could not record the subscription: new row for relation
    //     "platform_billing_accounts" violates check constraint "platform_billing_term_pair"
    //
    // The repair is NOT to write a tier alongside it. This handler must not grant one — the
    // header argues that at length, and `customer.subscription.updated` firing on a downgrade
    // is the case that makes it a rule rather than a preference. So the date is recorded only
    // where there is already a term for it to belong to, and a family whose first invoice has
    // not landed simply has no term yet, which is the truth.
    const { data: account, error: readError } = await admin
      .from('platform_billing_accounts')
      .select('paid_tier')
      .eq('family_code', familyCode)
      .maybeSingle()
    // §8: a refused read is not "no tier". Reported rather than assumed, so Stripe retries a
    // transient failure instead of this silently declining to record a real period end.
    if (readError) {
      return { handled: false, detail: `could not read the term for ${familyCode}: ${readError.message}` }
    }
    // Recorded, not granted. `invoice.paid` is what moves the tier — and what establishes the
    // term this date extends.
    if (account?.paid_tier) patch.paid_through = addDays(isoFromUnix(periodEnd), -1)
  }

  const { error } = await admin
    .from('platform_billing_accounts')
    .upsert(patch as never, { onConflict: 'family_code' })
  if (error) return { handled: false, detail: `could not record the subscription: ${error.message}` }

  return { handled: true, detail: `${familyCode} subscription ${subscription.status}` }
}

// ── Shared ──────────────────────────────────────────────────────────────────────────

/**
 * Move `families.tier` UP to what has been paid for. Never down.
 *
 * Reads the current value and compares RANKS, so a renewal at the same tier is a no-op and a
 * paid downgrade — which arrives as a cheaper `invoice.paid` after the sweep has already
 * applied the schedule — cannot undo anything. Every downward move in this product goes
 * through `scheduled_tier` and `apply_due_platform_tier_changes()`; this is deliberately not a
 * second route to one.
 */
async function promoteTier(admin: AdminClient, familyCode: string, tier: FamilyTier): Promise<void> {
  const { data, error } = await admin
    .from('families').select('tier').eq('family_code', familyCode).maybeSingle()
  if (error || !data) {
    console.error(`[stripe/platform] could not read the tier for ${familyCode}: ${error?.message ?? 'no row'}`)
    return
  }
  const current = isFamilyTier(data.tier) ? data.tier : 'free'
  if (TIER_RANK[tier] <= TIER_RANK[current]) return

  const { error: writeError } = await admin
    .from('families').update({ tier }).eq('family_code', familyCode)
  if (writeError) {
    // Loud, because the family has PAID and cannot reach what they paid for. `families.tier`
    // is guarded against the `authenticated` role only (20260813000003), so the service role
    // is not what refused this — something else did, and somebody has to look.
    console.error(`[stripe/platform] PAID BUT NOT GRANTED: ${familyCode} -> ${tier}: ${writeError.message}`)
  }
}

type InsertOutcome = 'ok' | 'duplicate' | string

async function recordPayment(admin: AdminClient, input: {
  familyCode: string
  kind: 'subscription' | 'prepaid'
  tier: FamilyTier
  months: number
  amountCents: number
  currency: string
  stripeRef: string
  sessionId: string | null
  invoiceId: string | null
  subscriptionId: string | null
  coversFrom: string | null
  coversThrough: string | null
  firstPayment: boolean
}): Promise<InsertOutcome> {
  // `amount_cents > 0` is a CHECK on the table, so a zero-amount invoice — a fully discounted
  // period, or a trial converting — must not be pushed at it. There is no money to record and
  // the term extension above has already happened.
  if (input.amountCents <= 0) return 'ok'

  const { error } = await admin.from('platform_payments').insert({
    family_code: input.familyCode,
    kind: input.kind,
    tier: input.tier,
    months: input.months,
    amount_cents: input.amountCents,
    currency: input.currency,
    stripe_ref: input.stripeRef,
    stripe_session_id: input.sessionId,
    stripe_invoice_id: input.invoiceId,
    stripe_subscription_id: input.subscriptionId,
    covers_from: input.coversFrom,
    covers_through: input.coversThrough,
    first_payment: input.firstPayment,
  })
  if (!error) return 'ok'
  // 23505 on the unique `stripe_ref` — a redelivery, days or years later, past every other
  // idempotency mechanism. This is the one that always holds.
  if (error.code === '23505') return 'duplicate'
  return error.message
}

async function loadRecord(admin: AdminClient, familyCode: string): Promise<PlatformBillingRecord> {
  const { data } = await admin
    .from('platform_billing_accounts')
    .select('mode, paid_tier, paid_through, subscription_status, cancel_at_period_end, scheduled_tier, scheduled_tier_on, delinquent_since')
    .eq('family_code', familyCode)
    .maybeSingle()
  const row = (data ?? {}) as Record<string, unknown>
  return {
    paidTier: isFamilyTier(row.paid_tier) ? row.paid_tier : null,
    paidThrough: typeof row.paid_through === 'string' ? row.paid_through : null,
    mode: row.mode === 'recurring' || row.mode === 'prepaid' ? row.mode : null,
    scheduledTier: isFamilyTier(row.scheduled_tier) ? row.scheduled_tier : null,
    scheduledTierOn: typeof row.scheduled_tier_on === 'string' ? row.scheduled_tier_on : null,
    subscriptionStatus: typeof row.subscription_status === 'string' ? row.subscription_status : null,
    cancelAtPeriodEnd: row.cancel_at_period_end === true,
  }
}

/**
 * Which family a subscription belongs to.
 *
 * OUR TABLE FIRST, metadata second. The table is a fact we wrote and can re-verify; metadata
 * is a copy that travelled through Stripe. The fallback exists for exactly one real case — the
 * first `invoice.paid` can arrive before `checkout.session.completed` has recorded the
 * subscription id, because Stripe does not order deliveries — and it is why a family code goes
 * into `subscription_data.metadata` at all.
 */
async function familyForSubscription(
  admin: AdminClient,
  subscriptionId: string,
  fallback: { metadata?: Stripe.Metadata | null; parent?: Stripe.Invoice.Parent | null },
): Promise<string | null> {
  const { data } = await admin
    .from('platform_billing_accounts')
    .select('family_code')
    .eq('stripe_subscription_id', subscriptionId)
    .maybeSingle()
  if (typeof data?.family_code === 'string') return data.family_code

  return familyOf(fallback.metadata, null)
    ?? familyOf(fallback.parent?.subscription_details?.metadata ?? null, null)
}

/** A family code out of metadata. Narrowed, never cast — it round-tripped through Stripe. */
function familyOf(metadata: Stripe.Metadata | null | undefined, clientRef: string | null): string | null {
  const fromMeta = metadata?.genorra_family_code
  if (typeof fromMeta === 'string' && fromMeta.length > 0) return fromMeta
  return clientRef && clientRef.length > 0 ? clientRef : null
}

/** An id out of a field the SDK types as `string | Object | null`. */
function idOf(value: unknown): string | null {
  if (typeof value === 'string') return value
  if (value && typeof value === 'object' && 'id' in value) {
    const id = (value as { id?: unknown }).id
    return typeof id === 'string' ? id : null
  }
  return null
}

/** A Stripe UNIX second as `YYYY-MM-DD`, UTC. */
function isoFromUnix(seconds: number): string {
  return new Date(seconds * 1000).toISOString().slice(0, 10)
}

/**
 * What a subscription is priced at and which period it is serving, straight from Stripe.
 *
 * The fallback `onInvoicePaid` uses when an invoice carries no line on a price we sell — see
 * the comment there. Null on any failure, INCLUDING Stripe being unconfigured, because the
 * caller's next move is the refusal it would have made anyway: this widens what can be
 * recognised and must never be what decides that something is not ours.
 *
 * `current_period_end` lives on the ITEM in this API version, the same place `onSubscription`
 * reads it from — the subscription-level field is `undefined` and would silently null the
 * period.
 */
async function subscriptionPeriod(
  subscriptionId: string,
): Promise<{ priceId: string | null; start: number | null; end: number | null } | null> {
  const stripe = stripeClient()
  if (!stripe) return null
  try {
    const sub = await stripe.subscriptions.retrieve(subscriptionId)
    const item = sub.items?.data?.[0]
    return {
      priceId: idOf(item?.price),
      start: item?.current_period_start ?? null,
      end: item?.current_period_end ?? null,
    }
  } catch (e) {
    console.error(`[billing] could not read subscription ${subscriptionId}: ${describe(e)}`)
    return null
  }
}

function laterOf(a: string | null, b: string): string {
  return a && a > b ? a : b
}

function todayISO(): string {
  return new Date().toISOString().slice(0, 10)
}

function describe(e: unknown): string {
  return e instanceof Error ? e.message : String(e)
}

/**
 * Tell Meta a charge settled — the caller `lib/meta/billing.ts` has been waiting for.
 *
 * TODO.md carried this as *"the money half is built and has no caller"* with the exact call
 * shape and four rules; all four are honoured here. `transactionId` is the CHARGE (an invoice
 * or payment-intent id) and never the subscription, `firstPayment` comes from Stripe's own
 * `billing_reason`, `amountCents` is what was charged rather than the catalogue price, and a
 * renewal is deliberately not a `Purchase`.
 *
 * ── AND IT NEVER THROWS INTO THE WEBHOOK ────────────────────────────────────────────
 * A Meta outage must not make this endpoint answer 500, because Stripe would then redeliver an
 * event whose money has already been applied. The tier is granted; the analytics are best
 * effort, in that order and not the other way round.
 *
 * The holder fields come from the ADMINISTRATOR who set the family up, resolved from the
 * family's own rows — never from the browser, which is not present on this path at all.
 */
async function announceToMeta(admin: AdminClient, input: {
  familyCode: string
  tier: FamilyTier
  transactionId: string
  subscriptionId: string
  amountCents: number
  currency: string
  firstPayment: boolean
  occurredAtMs?: number
}): Promise<void> {
  try {
    const { data: family } = await admin
      .from('families').select('created_by').eq('family_code', input.familyCode).maybeSingle()
    const createdBy = typeof family?.created_by === 'string' ? family.created_by : null

    let holder: { userId?: string | null; email?: string | null; firstName?: string | null; lastName?: string | null } = {}
    if (createdBy) {
      // ONLY THE NINE PERMITTED FIELDS reach `MetaAccountHolder`, and only three are read
      // here. `lib/meta/identity.ts` carries a tripwire for the columns an honest mistake
      // would pass through — a whole `people` row — which is why this names its columns.
      const { data: person } = await admin
        .from('people')
        .select('user_id, first_name, last_name, primary_email, email_is_placeholder')
        .eq('id', createdBy)
        .eq('family_code', input.familyCode)
        .maybeSingle()
      holder = {
        userId: (person?.user_id as string | null) ?? null,
        // A GENERATED placeholder address is not an email and must never be hashed as one:
        // it would be a match key that matches nothing and pollutes Event Match Quality.
        email: person?.email_is_placeholder ? null : (person?.primary_email as string | null) ?? null,
        firstName: (person?.first_name as string | null) ?? null,
        lastName: (person?.last_name as string | null) ?? null,
      }
    }

    await trackSubscriptionPayment({
      transactionId: input.transactionId,
      subscriptionId: input.subscriptionId,
      amountCents: input.amountCents,
      currency: input.currency,
      planId: input.tier,
      billingInterval: 'monthly',
      firstPayment: input.firstPayment,
      holder,
      occurredAtMs: input.occurredAtMs,
      sourcePath: '/admin/settings',
    })
  } catch (e) {
    console.error(`[stripe/platform] Meta tracking failed for ${input.transactionId}: ${describe(e)}`)
  }
}
