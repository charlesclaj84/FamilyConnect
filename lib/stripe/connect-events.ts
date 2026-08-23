import type Stripe from 'stripe'

import { createAdminClient } from '@/lib/supabase/admin'
import { routePaidPayment } from '@/lib/dues-routing'

/**
 * A relative paying their family's dues with a card — the only place a `source = 'stripe'`
 * row is written.
 *
 * ── WHY THIS LANDS IN `dues_payments` AND THE PLATFORM SIDE DOES NOT ────────────────
 * The mirror image of `lib/stripe/platform-events.ts`, and both are right. A dues payment IS
 * the family's money: it belongs in the family's ledger, it routes into the family's funds by
 * the same waterfall, it appears in the same P&L and the same member payment history as a
 * cheque a treasurer keyed in by hand. `dues_payments.source` has permitted `'stripe'` since
 * 20260610000005 and `(source, processor_ref)` has been unique since the same file, with a
 * comment saying it was for exactly this. Nothing about that table changed to make this work.
 *
 * What a family pays GENORRA is the opposite and goes to `platform_payments`. Crossing the two
 * is the single worst mistake available in this feature; 20260823000004's header enumerates
 * what it would do to a family's books.
 *
 * ── THE FAMILY IS RESOLVED FROM THE ACCOUNT, NOT FROM METADATA ──────────────────────
 * `event.account` is the `acct_…` the charge happened on, and `family_stripe_accounts` maps it
 * to one family — that column is UNIQUE precisely so this mapping is a fact rather than a
 * guess. Everything downstream is scoped by the family THAT read returns, which is how
 * AGENTS.md §3's obligation is discharged on a path with no session and no caller.
 *
 * Metadata is then CHECKED against it rather than trusted: `genorra_family_code` on the
 * session must equal the family the account belongs to, and the person and schedule must both
 * belong to that family (§4 — an id arriving from outside, written onto a row stamped with a
 * family code, is what RLS structurally cannot catch and what nothing here even has RLS for,
 * since every write is on the service role).
 *
 * ── NOBODY RECORDED IT, AND THAT IS THE POINT ───────────────────────────────────────
 * `recorded_by` is NULL on every row this file writes. `recordPayment` in
 * `app/actions/dues.ts` refuses to let the person who OWES a due attest that they paid it —
 * *"Recording a payment asserts that money changed hands. The person who owes it does not get
 * to make that assertion"* — and names this path as the answer: **a processor attests instead
 * of the member.** A `recorded_by` pointing at the payer would put the member's own name in
 * the evidence column of a row they did not get to write, which is the opposite of what that
 * rule protects.
 */

type AdminClient = ReturnType<typeof createAdminClient>

export interface HandledEvent {
  handled: boolean
  detail: string
}

const IGNORED: HandledEvent = { handled: true, detail: 'ignored' }

export async function handleConnectEvent(
  event: Stripe.Event,
  accountId: string,
): Promise<HandledEvent> {
  const admin = createAdminClient()

  // THE FAMILY, FIRST AND FROM THE ACCOUNT. Nothing below runs without it, including the
  // account-status branch: an event on an account we do not know is not ours to act on, and
  // answering `handled: true` for it is right — a 500 would have Stripe redeliver forever.
  const familyCode = await familyForAccount(admin, accountId)
  if (!familyCode) {
    return { handled: true, detail: `no family holds account ${accountId}` }
  }

  switch (event.type) {
    case 'checkout.session.completed':
    case 'checkout.session.async_payment_succeeded':
      return onCheckoutSession(admin, familyCode, accountId, event.data.object as Stripe.Checkout.Session)

    case 'checkout.session.async_payment_failed': {
      const session = event.data.object as Stripe.Checkout.Session
      // Nothing was posted, so there is nothing to reverse — `dues_payments` is append-only
      // and a row that was never written needs no correcting entry. The member is told by
      // Stripe; this is the family's only trace.
      return { handled: true, detail: `dues payment failed for session ${session.id}` }
    }

    case 'invoice.paid':
      return onInvoicePaid(admin, familyCode, accountId, event.data.object as Stripe.Invoice)

    case 'customer.subscription.updated':
    case 'customer.subscription.deleted':
      return onSubscription(admin, familyCode, event.type, event.data.object as Stripe.Subscription)

    case 'account.updated':
      return onAccountUpdated(admin, familyCode, event.data.object as Stripe.Account)

    default:
      return IGNORED
  }
}

// ── One-off card payment against a due ──────────────────────────────────────────────

async function onCheckoutSession(
  admin: AdminClient,
  familyCode: string,
  accountId: string,
  session: Stripe.Checkout.Session,
): Promise<HandledEvent> {
  // Stripe's rule, and the one that catches a delayed-notification method: `completed` can
  // arrive while the session is still unpaid, and a due credited then would be a payment the
  // family never received.
  if (session.payment_status === 'unpaid') {
    return { handled: true, detail: `session ${session.id} is still unpaid` }
  }

  const meta = session.metadata ?? {}
  if (meta.genorra_flow !== 'dues') return IGNORED

  // ── THE METADATA IS OURS AND IS STILL CHECKED AGAINST THE ACCOUNT ─────────────────
  // A mismatch cannot happen through the product — `startDuesCheckout` stamps the family it
  // resolved from the caller's own guard. It CAN happen if somebody with Dashboard access
  // edits it, and the consequence would be one family's card payment credited to another
  // family's member. Refused rather than reconciled.
  if (meta.genorra_family_code !== familyCode) {
    return {
      handled: false,
      detail: `session ${session.id} claims family ${meta.genorra_family_code ?? '?'} on ${accountId}, which belongs to ${familyCode}`,
    }
  }

  const personId = typeof meta.genorra_person_id === 'string' ? meta.genorra_person_id : null
  const scheduleId = typeof meta.genorra_schedule_id === 'string' ? meta.genorra_schedule_id : null
  if (!personId || !scheduleId) {
    return { handled: false, detail: `session ${session.id} names no member or schedule` }
  }

  if (session.mode === 'subscription') {
    // Autopay was set up. The first charge arrives as `invoice.paid`, which is what posts the
    // money; this only records the arrangement so the member's screen can show it and so
    // `cancelDuesAutopay` has something to cancel.
    return recordAutopay(admin, {
      familyCode, accountId, personId, scheduleId,
      subscriptionId: idOf(session.subscription),
      customerId: idOf(session.customer),
      cadence: typeof meta.genorra_cadence === 'string' ? meta.genorra_cadence : 'monthly',
      amountCents: session.amount_total ?? 0,
    })
  }

  if (session.mode !== 'payment') return IGNORED

  const amount = session.amount_total ?? 0
  if (amount <= 0) return { handled: true, detail: `session ${session.id} carried no money` }

  return postDuesPayment(admin, {
    familyCode,
    personId,
    scheduleId,
    amountCents: amount,
    // The CHARGE, so a redelivery years later still collides on the unique index. Falling back
    // to the session id keeps the row postable rather than dropping a real payment.
    processorRef: idOf(session.payment_intent) ?? session.id,
    paidAtSeconds: session.created ?? null,
    planId: null,
    note: 'One-off card payment',
  })
}

// ── Recurring dues: one settled period ──────────────────────────────────────────────

async function onInvoicePaid(
  admin: AdminClient,
  familyCode: string,
  accountId: string,
  invoice: Stripe.Invoice,
): Promise<HandledEvent> {
  const subscriptionId = idOf(invoice.parent?.subscription_details?.subscription)
  if (!subscriptionId) {
    // An invoice the family raised themselves in their own Dashboard. Not ours, and posting it
    // to a due would be inventing a credit against a member nobody named.
    return { handled: true, detail: `invoice ${invoice.id} is not from a subscription` }
  }

  // ── THE ARRANGEMENT IS READ FROM OUR TABLE, NOT FROM THE INVOICE'S METADATA ───────
  // `dues_autopay` is where the member and the schedule were recorded when the subscription
  // was created, and the guard trigger on that table has already refused any cross-family
  // combination (20260823000005 §3). Reading them back from here means the ids on the payment
  // row were validated once, by the database, rather than re-derived from a string that
  // travelled through Stripe. It is also what makes a cancelled-and-restarted autopay post
  // against the right schedule.
  const { data: autopay, error } = await admin
    .from('dues_autopay')
    .select('id, person_id, schedule_id, family_code, stripe_account_id, cadence')
    .eq('stripe_subscription_id', subscriptionId)
    .maybeSingle()
  if (error) return { handled: false, detail: `could not read the autopay: ${error.message}` }
  if (!autopay) {
    return { handled: false, detail: `no autopay for subscription ${subscriptionId}` }
  }
  // Belt and braces on the family the account resolved to. These cannot disagree unless a row
  // was written by something other than this feature, and a mismatch would credit the wrong
  // family's ledger with every renewal.
  if (autopay.family_code !== familyCode || autopay.stripe_account_id !== accountId) {
    return {
      handled: false,
      detail: `autopay ${autopay.id} is filed under ${autopay.family_code}/${autopay.stripe_account_id}, not ${familyCode}/${accountId}`,
    }
  }

  const amount = invoice.amount_paid ?? 0
  if (amount <= 0) return { handled: true, detail: `invoice ${invoice.id} carried no money` }

  const posted = await postDuesPayment(admin, {
    familyCode,
    personId: autopay.person_id as string,
    scheduleId: autopay.schedule_id as string,
    amountCents: amount,
    processorRef: invoice.id ?? `inv_${subscriptionId}_${invoice.period_end ?? 0}`,
    paidAtSeconds: invoice.created ?? null,
    planId: null,
    note: 'Automatic card payment',
  })

  // Record where the arrangement has got to, so a member's screen can say when the next one
  // is. Best effort: the money is already posted and a failure here must not make Stripe
  // redeliver an event whose payment has landed.
  const periodEnd = invoice.lines?.data?.[0]?.period?.end
  if (periodEnd) {
    await admin.from('dues_autopay')
      .update({ current_period_end: isoFromUnix(periodEnd), status: 'active' })
      .eq('id', autopay.id)
      .eq('family_code', familyCode)
  }

  return posted
}

async function onSubscription(
  admin: AdminClient,
  familyCode: string,
  type: string,
  subscription: Stripe.Subscription,
): Promise<HandledEvent> {
  const cancelled = type === 'customer.subscription.deleted'
  const patch: Record<string, unknown> = {
    status: cancelled ? 'canceled' : subscription.status,
  }
  // `cancelled_at` is what the partial unique index keys on, so stamping it is what frees the
  // member to set up a new arrangement against the same schedule. Only ever set, never
  // cleared: the old row is the record of what they had agreed to.
  if (cancelled) patch.cancelled_at = new Date().toISOString()

  const periodEnd = subscription.items?.data?.[0]?.current_period_end
  if (!cancelled && periodEnd) patch.current_period_end = isoFromUnix(periodEnd)

  const { error } = await admin.from('dues_autopay')
    .update(patch as never)
    .eq('stripe_subscription_id', subscription.id)
    // §3 by hand: the subscription id is unique, and the family conjunct is what stops an
    // `acct_` mix-up from writing across the boundary anyway.
    .eq('family_code', familyCode)
  if (error) return { handled: false, detail: `could not update the autopay: ${error.message}` }

  return { handled: true, detail: `autopay ${subscription.id} is ${patch.status}` }
}

/**
 * The family's own account changed — usually a capability going active after review.
 *
 * ── THIS IS THE v1 EVENT, AND IT IS NOT THE WHOLE STORY ─────────────────────────────
 * Accounts here are created through the v2 API (`/v2/core/accounts`), and v2 publishes its own
 * capability events — `v2.core.account[configuration.merchant].capability_status_updated` —
 * through EVENT DESTINATIONS, which are a different subscription mechanism from a v1 webhook
 * endpoint and are not wired up. `account.updated` still fires for a connected account and
 * carries enough to keep the flag current, so this is the reliable-enough half.
 *
 * The half that does not depend on any of it is `refreshProcessorStatus()`, which pulls the
 * account when the family returns from onboarding — which is exactly when the answer changes
 * and exactly when somebody is looking at the screen. TODO.md carries the event-destination
 * work; until it is done, this flag can be stale and the refresh button is what fixes it.
 */
async function onAccountUpdated(
  admin: AdminClient,
  familyCode: string,
  account: Stripe.Account,
): Promise<HandledEvent> {
  const { error } = await admin.from('family_stripe_accounts').update({
    // `capabilities.card_payments` on the v1 shape is the same fact v2 reports at
    // `configuration.merchant.capabilities.card_payments.status`. `charges_enabled` is
    // deliberately NOT read: Stripe's own guidance names it as the deprecated field, and it
    // disagrees with the capability during review — which is the window in which offering a
    // Pay Online button produces a checkout that fails at the till.
    card_payments_status: account.capabilities?.card_payments ?? null,
    details_submitted: account.details_submitted === true,
    country: account.country ?? null,
  }).eq('family_code', familyCode).eq('stripe_account_id', account.id)
  if (error) return { handled: false, detail: `could not update the account: ${error.message}` }
  return { handled: true, detail: `${familyCode} card_payments=${account.capabilities?.card_payments ?? 'null'}` }
}

// ── Writing the family's ledger ─────────────────────────────────────────────────────

/**
 * Post one paid dues row and route it into the family's funds.
 *
 * ── EVERY ID IS RE-VERIFIED AGAINST THE FAMILY (§4) ────────────────────────────────
 * `person_id` and `schedule_id` arrive from Stripe metadata or from `dues_autopay`, and both
 * are written onto a row stamped with `family_code`. That is precisely the shape RLS cannot
 * catch — and here there is no RLS at all, because the write is on the service role. So both
 * are read back with the family conjunct beside them, which is what `belongsToFamily` does in
 * an action and what has to be done by hand on a path with no caller.
 *
 * ── AND THE SCHEDULE MUST BE DUES ──────────────────────────────────────────────────
 * `dues_schedules` holds donation drives too. A card payment posted against a drive by this
 * path would route the whole amount into the Donations fund and appear in a member's dues
 * history as a due they settled. `startDuesCheckout` refuses one, and so does this: the
 * action in front of an endpoint is a convenience, and this is not even an endpoint a caller
 * reaches.
 */
async function postDuesPayment(admin: AdminClient, input: {
  familyCode: string
  personId: string
  scheduleId: string
  amountCents: number
  processorRef: string
  paidAtSeconds: number | null
  planId: string | null
  note: string
}): Promise<HandledEvent> {
  const [personRes, scheduleRes] = await Promise.all([
    admin.from('people').select('id')
      .eq('id', input.personId).eq('family_code', input.familyCode).maybeSingle(),
    admin.from('dues_schedules').select('id, kind, label')
      .eq('id', input.scheduleId).eq('family_code', input.familyCode).maybeSingle(),
  ])
  if (!personRes.data) {
    return { handled: false, detail: `member ${input.personId} is not in ${input.familyCode}` }
  }
  if (!scheduleRes.data) {
    return { handled: false, detail: `schedule ${input.scheduleId} is not in ${input.familyCode}` }
  }
  if (scheduleRes.data.kind !== 'dues') {
    return { handled: false, detail: `schedule ${input.scheduleId} is a ${scheduleRes.data.kind}, not dues` }
  }

  const paymentDate = input.paidAtSeconds
    ? isoFromUnix(input.paidAtSeconds)
    : new Date().toISOString().slice(0, 10)

  const { data: payment, error } = await admin.from('dues_payments').insert({
    family_code: input.familyCode,
    person_id: input.personId,
    schedule_id: input.scheduleId,
    amount_cents: input.amountCents,
    status: 'paid',
    payment_date: paymentDate,
    payment_method: 'Card',
    payment_reference: input.processorRef,
    source: 'stripe',
    processor_ref: input.processorRef,
    plan_id: input.planId,
    notes: input.note,
    // NULL. A processor attested this, not a person — see the header.
    recorded_by: null,
  }).select('id, amount_cents, payment_date, routed_at').single()

  if (error) {
    // 23505 on the unique `(source, processor_ref)` index: this charge has already been
    // posted. That index exists for exactly this, and it is the idempotency that survives a
    // redelivery arriving after `stripe_webhook_events` has been pruned or its claim
    // recovered.
    if (error.code === '23505') {
      return { handled: true, detail: `charge ${input.processorRef} was already posted` }
    }
    return { handled: false, detail: `could not post the payment: ${error.message}` }
  }

  // The same waterfall a hand-keyed payment goes through, from the same module — the whole
  // reason `lib/dues-routing.ts` exists. `recordedBy` is null for the reason above; the funds
  // do not care who keyed it, and `fund_contributions.recorded_by` is nullable.
  await routePaidPayment(admin, input.familyCode, payment, null, 'dues')

  return {
    handled: true,
    detail: `${input.familyCode}: ${input.amountCents}c posted against ${scheduleRes.data.label}`,
  }
}

async function recordAutopay(admin: AdminClient, input: {
  familyCode: string
  accountId: string
  personId: string
  scheduleId: string
  subscriptionId: string | null
  customerId: string | null
  cadence: string
  amountCents: number
}): Promise<HandledEvent> {
  if (!input.subscriptionId) {
    return { handled: false, detail: 'a subscription checkout completed with no subscription' }
  }
  if (input.amountCents <= 0) {
    return { handled: false, detail: `autopay for ${input.familyCode} carried no amount` }
  }

  // UPSERT on the subscription id, which is UNIQUE. A redelivery must not create a second row
  // — and cannot, because the partial index would refuse it and this would then report a
  // failure over an arrangement that already exists.
  const { error } = await admin.from('dues_autopay').upsert({
    family_code: input.familyCode,
    person_id: input.personId,
    schedule_id: input.scheduleId,
    stripe_account_id: input.accountId,
    stripe_subscription_id: input.subscriptionId,
    stripe_customer_id: input.customerId,
    cadence: normaliseCadence(input.cadence),
    amount_cents: input.amountCents,
    status: 'active',
  }, { onConflict: 'stripe_subscription_id' })

  if (error) {
    // 23514 is the guard trigger: a cross-family id, or a donation schedule. Loud, because it
    // means something created a subscription this product would not have.
    return { handled: false, detail: `could not record the autopay: ${error.message}` }
  }
  return { handled: true, detail: `autopay ${input.subscriptionId} recorded for ${input.familyCode}` }
}

// ── Small readers ───────────────────────────────────────────────────────────────────

async function familyForAccount(admin: AdminClient, accountId: string): Promise<string | null> {
  const { data, error } = await admin
    .from('family_stripe_accounts')
    .select('family_code')
    .eq('stripe_account_id', accountId)
    .maybeSingle()
  if (error) {
    console.error(`[stripe/connect] could not resolve account ${accountId}: ${error.message}`)
    return null
  }
  return typeof data?.family_code === 'string' ? data.family_code : null
}

/** A cadence the table's CHECK will accept. Anything unrecognised becomes monthly. */
function normaliseCadence(value: string): string {
  return ['weekly', 'monthly', 'quarterly', 'annual'].includes(value) ? value : 'monthly'
}

function idOf(value: unknown): string | null {
  if (typeof value === 'string') return value
  if (value && typeof value === 'object' && 'id' in value) {
    const id = (value as { id?: unknown }).id
    return typeof id === 'string' ? id : null
  }
  return null
}

function isoFromUnix(seconds: number): string {
  return new Date(seconds * 1000).toISOString().slice(0, 10)
}
