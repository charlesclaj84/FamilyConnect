import type Stripe from 'stripe'

import { createAdminClient } from '@/lib/supabase/admin'
import { TIER_RANK, isFamilyTier, type FamilyTier } from '@/lib/tiers'
import {
  addDays, isPrepayMonths, prepaidPurchase, subscriptionIsCurrent,
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

  // ── THE MONTHS COME OFF THE SESSION, NEVER OFF OUR METADATA ────────────────────────
  // The line item carries `adjustable_quantity`, so the family can change the term on
  // Stripe's own page — that is the "pay as far ahead as you like" half of the feature. Our
  // `genorra_mode` metadata says which shape was intended; the QUANTITY is what was bought,
  // and reading it from metadata would credit twelve months for a payment of three.
  const stripe = stripeClient()
  if (!stripe) return { handled: false, detail: 'Stripe is not configured' }

  let line: Stripe.LineItem | undefined
  try {
    const lines = await stripe.checkout.sessions.listLineItems(session.id, { limit: 1 })
    line = lines.data[0]
  } catch (e) {
    return { handled: false, detail: `could not read line items: ${describe(e)}` }
  }

  const priced = tierForPriceId(idOf(line?.price))
  if (!priced || priced.shape !== 'prepaid') {
    return { handled: false, detail: `session ${session.id} is not on a prepaid price we sell` }
  }
  const months = line?.quantity
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
  // A subscription line is what carries it; a proration line on the same invoice carries the
  // same price, so the first recurring line is the right one to read.
  const line = invoice.lines?.data?.find(l => idOf(l.pricing?.price_details?.price) != null)
  const priced = tierForPriceId(idOf(line?.pricing?.price_details?.price))
  if (!priced || priced.shape !== 'recurring') {
    return { handled: false, detail: `invoice ${invoice.id} is not on a recurring price we sell` }
  }

  // The period the money actually covered, from the invoice line. `paid_through` is INCLUSIVE
  // and a Stripe period end is EXCLUSIVE — the instant the next one begins — so the last day
  // paid for is the day before it. Off by one here is a family losing or gaining a day on
  // every renewal, compounding.
  const periodStart = line?.period?.start ? isoFromUnix(line.period.start) : null
  const periodEnd = line?.period?.end ? isoFromUnix(line.period.end) : null
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
    // Recorded, not granted. `invoice.paid` is what moves the tier.
    patch.paid_through = addDays(isoFromUnix(periodEnd), -1)
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
