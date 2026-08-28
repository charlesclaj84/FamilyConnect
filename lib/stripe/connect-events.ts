import type Stripe from 'stripe'

import { createAdminClient } from '@/lib/supabase/admin'
import { routePaidPayment } from '@/lib/dues-routing'
import type { ScheduleKind } from '@/lib/dues-utils'

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
  // ── WHICH LEDGER THIS CHARGE BELONGS IN, DECIDED BEFORE ANYTHING IS READ ──────────
  // `'dues'` is money a member OWED; `'donation'` is money they CHOSE to give. They post to
  // the same table and route completely differently — a due goes through the family's fund
  // waterfall, a gift goes whole into the Donations fund — so the kind cannot be inferred
  // afterwards from whatever the schedule row happens to say. It is declared by the action
  // that created the session and ASSERTED against the schedule below.
  const kind: ScheduleKind | null =
    meta.genorra_flow === 'dues' ? 'dues'
      : meta.genorra_flow === 'donation' ? 'donation'
        : null
  if (!kind) return IGNORED

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
  if (!personId) {
    return { handled: false, detail: `session ${session.id} names no member` }
  }
  // ── THE SCHEDULE IS NOT ALWAYS ON THE SESSION, AND THAT IS THE BATCH ──────────────
  // A combined one-off payment names its dues in `genorra_alloc_*` and carries no single
  // `genorra_schedule_id`, so demanding one here would refuse every combined payment before
  // the allocation was ever read. Autopay still requires it — one arrangement is one schedule
  // by construction — and the one-off path treats it as the fallback for a session created
  // before the allocation keys existed.
  const scheduleId = typeof meta.genorra_schedule_id === 'string' ? meta.genorra_schedule_id : null

  if (session.mode === 'subscription') {
    if (!scheduleId) {
      return { handled: false, detail: `subscription session ${session.id} names no schedule` }
    }
    // NOTHING RECURS ON A DRIVE. `startDonationCheckout` creates no subscription, and a gift
    // that renewed itself would be this product deciding that agreeing to give once was
    // agreeing to give every month. Refused rather than recorded, so a subscription created
    // outside the product cannot quietly acquire a standing arrangement here.
    if (kind !== 'dues') {
      return { handled: false, detail: `session ${session.id} is a recurring ${kind}, which does not exist` }
    }
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

  // The CHARGE, so a redelivery years later still collides on the unique index. Falling back
  // to the session id keeps the row postable rather than dropping a real payment.
  const charge = idOf(session.payment_intent) ?? session.id

  // ── HOW THIS CHARGE SPLITS ACROSS THE MEMBER'S DUES ───────────────────────────────
  // One line per due since 2026-08-25, because "pay everything due now" is one card payment
  // over several schedules. `readAllocations` answers the single-due shape too, from the same
  // keys, so there is one path here rather than a batch path beside a legacy one — and it
  // falls back to `genorra_schedule_id` for a session that was created before the allocation
  // keys existed and was still sitting on Stripe's hosted page at deploy time.
  const allocations = readAllocations(meta, scheduleId, amount)
  if (!allocations) {
    return { handled: false, detail: `session ${session.id} carries an allocation that cannot be read` }
  }

  // ── THE SPLIT MUST ADD UP TO WHAT STRIPE ACTUALLY TOOK ────────────────────────────
  // Nothing in this flow adds tax, shipping or a discount, so `amount_total` IS the sum of the
  // line items this product created. A disagreement therefore means the metadata was edited
  // after the session was made — the same thing the family-code check above refuses, and
  // refused the same way rather than reconciled. Scaling the allocation to fit would be this
  // code inventing which due somebody paid.
  const allocated = allocations.reduce((sum, a) => sum + a.amountCents, 0)
  if (allocated !== amount) {
    return {
      handled: false,
      detail: `session ${session.id} allocates ${allocated}c of a ${amount}c charge`,
    }
  }

  // Sequentially, not in parallel: `postDuesPayment` routes each payment through the family's
  // fund waterfall, which reads a fund balance and writes against it. Two of those racing over
  // one fund is the shape `claim_distribution_recipients` is one statement to avoid.
  const posted: string[] = []
  for (const alloc of allocations) {
    const result = await postDuesPayment(admin, {
      familyCode,
      personId,
      scheduleId: alloc.scheduleId,
      amountCents: alloc.amountCents,
      // ONE REF PER ROW, because `(source, processor_ref)` is unique and a combined payment
      // posts several rows from one charge. Derived from the charge and the schedule rather
      // than from a counter, so a redelivery of the same event produces the same refs and
      // collides row for row — which is the whole idempotency guarantee, kept intact.
      //
      // A single-due payment keeps the BARE charge id, which is what every row posted before
      // 2026-08-25 carries. Suffixing those too would make a redelivery of an old event look
      // like a new payment.
      processorRef: allocations.length === 1 ? charge : `${charge}#${alloc.scheduleId}`,
      paidAtSeconds: session.created ?? null,
      planId: null,
      expectKind: kind,
      note: kind === 'donation'
        ? 'Card donation'
        : allocations.length === 1
          ? 'One-off card payment'
          : 'One-off card payment (part of a combined payment)',
    })
    // A PARTIAL FAILURE IS A FAILURE (§8b's rule, on the webhook path). Answering `handled`
    // over a charge that credited two of four dues would lose the other two permanently, so
    // this reports and lets Stripe redeliver — the rows that DID post collide on their refs
    // second time round and are skipped, which is what makes the retry safe.
    if (!result.handled) return result
    posted.push(result.detail ?? alloc.scheduleId)
  }

  return {
    handled: true,
    detail: allocations.length === 1
      ? posted[0]
      : `${familyCode}: ${amount}c posted across ${allocations.length} dues — ${posted.join('; ')}`,
  }
}

/**
 * The `genorra_alloc_*` metadata, as a list of dues and cents.
 *
 * Returns null rather than a partial list: a count that names more keys than are present, an
 * unparseable pair, or an amount that is not a positive integer all mean the split cannot be
 * trusted, and a partial answer here posts a charge against the wrong dues. The caller refuses
 * the event, which is what `postDuesPayment` already does for every other id it cannot verify.
 *
 * THE SCHEDULE IDS ARE NOT VALIDATED HERE, deliberately — `postDuesPayment` re-reads each one
 * with `.eq('family_code', …)` beside it (§4), which is the check that matters and the one
 * place it should live.
 */
function readAllocations(
  meta: Stripe.Metadata,
  fallbackScheduleId: string | null,
  fallbackAmountCents: number,
): { scheduleId: string; amountCents: number }[] | null {
  const raw = meta.genorra_alloc_count
  // A session from before the allocation keys existed. One due, the whole charge — and null
  // where there is no `genorra_schedule_id` either, because then the session names no due at
  // all and the caller refuses it rather than posting the money against nothing.
  if (typeof raw !== 'string') {
    return fallbackScheduleId
      ? [{ scheduleId: fallbackScheduleId, amountCents: fallbackAmountCents }]
      : null
  }

  const count = Number(raw)
  if (!Number.isInteger(count) || count < 1 || count > 50) return null

  const out: { scheduleId: string; amountCents: number }[] = []
  for (let i = 0; i < count; i++) {
    const value = meta[`genorra_alloc_${i}`]
    if (typeof value !== 'string') return null
    // The schedule id is a uuid and carries no colon, so the LAST colon separates the two
    // halves either way — split on the last rather than the first, and a label creeping into
    // this field one day cannot silently truncate an id.
    const cut = value.lastIndexOf(':')
    if (cut <= 0) return null
    const scheduleId = value.slice(0, cut)
    const amountCents = Number(value.slice(cut + 1))
    if (!scheduleId) return null
    if (!Number.isInteger(amountCents) || amountCents <= 0) return null
    // A repeated schedule would post two rows, and the second's ref would collide with the
    // first's and be discarded as a duplicate — money taken and credited once.
    if (out.some(a => a.scheduleId === scheduleId)) return null
    out.push({ scheduleId, amountCents })
  }
  return out
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
    // DUES BY CONSTRUCTION. `startDuesAutopay` refuses a donation schedule and the guard
    // trigger on `dues_autopay` refuses one underneath it, so a row reaching this line names
    // a due. Stated rather than inferred, because that is the whole point of the parameter.
    expectKind: 'dues',
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
 * ── AND THE SCHEDULE MUST BE THE KIND THE SESSION DECLARED ────────────────────────
 * `dues_schedules` holds donation drives as well as dues, and both are payable by card since
 * 2026-08-26 — so this is no longer "refuse anything that is not dues". It is stricter than
 * that sounds: `expectKind` comes from `genorra_flow`, which the ACTION stamped, and a
 * mismatch means the session was created for one kind of thing and is being posted against
 * the other. That is refused rather than reconciled.
 *
 * Getting it wrong in either direction is silent and expensive. A due posted as a gift routes
 * whole into the Donations fund instead of down the family's waterfall; a gift posted as a due
 * appears in somebody's dues history as a due they settled and is split across funds nobody
 * gave it to. Neither shows up as an error anywhere.
 *
 * `routePaidPayment` is then given the SAME value, so the ledger row and the fund it lands in
 * cannot disagree about what kind of money it was.
 */
async function postDuesPayment(admin: AdminClient, input: {
  familyCode: string
  personId: string
  scheduleId: string
  amountCents: number
  processorRef: string
  paidAtSeconds: number | null
  planId: string | null
  /** What the session said this was. The schedule is refused if it says otherwise. */
  expectKind: ScheduleKind
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
  if (scheduleRes.data.kind !== input.expectKind) {
    return {
      handled: false,
      detail: `schedule ${input.scheduleId} is a ${scheduleRes.data.kind}, not a ${input.expectKind}`,
    }
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
  //
  // THE KIND IS THE ONE ASSERTED ABOVE, not a literal. `routePaidPayment` sends a donation
  // whole into the family's Donations fund and a due down the priority waterfall, so passing
  // `'dues'` unconditionally — which this did while dues were the only thing payable by card —
  // would split every gift across funds nobody gave it to.
  await routePaidPayment(admin, input.familyCode, payment, null, input.expectKind)

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
