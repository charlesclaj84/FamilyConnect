'use server'

import { revalidatePath } from 'next/cache'

import { createAdminClient } from '@/lib/supabase/admin'
import { requireMember } from '@/lib/auth/guard'
import { getDonationProgress, getMyDuesSummary, type DuesSummary } from '@/app/actions/dues'
import { intentKey, onAccount, stripeClient, stripeUnavailableReason } from '@/lib/stripe/client'
import { INTEGRATION_IDS, checkoutReturnUrls } from '@/lib/stripe/config'
import { formatCurrency } from '@/lib/currency-utils'
import type { PayCadence } from '@/lib/dues-utils'
import { currentUser } from '@/lib/auth/current-user'
import { callerI18n } from '@/lib/i18n/server'

/**
 * A member paying their own dues with a card — the family's money, on the family's account.
 *
 * ── SELF-SERVICE, SO THE GATE IS `requireMember()` AND THE CHECKS ARE OWNERSHIP ─────
 * AGENTS.md §2's rule: `create` and `edit` default to scope `'none'`, so demanding a grant for
 * something every member may do by definition would lock the whole family out. Paying your own
 * dues is squarely in that class — nobody needs permission to settle what they owe.
 *
 * *"'No permission needed' never means 'no check needed'."* The checks here are that the row
 * being paid is genuinely the caller's, and that every id arriving from the client belongs to
 * their family:
 *
 *   the PERSON is never a parameter    it comes from the guard. There is no way to ask this
 *                                     endpoint to pay somebody else's dues, which is the whole
 *                                     reason `personId` is absent from every signature below.
 *   the SCHEDULE is re-resolved        through `getMyDuesSummary()`, which is already scoped to
 *                                     the caller. A schedule id that is not in their own
 *                                     summary is not payable, so a forged one resolves to
 *                                     nothing rather than to another family's due.
 *   the AMOUNT is bounded server-side  against `remainingBalanceCents` from that same summary.
 *
 * ── AND THE AMOUNT IS THE SHARPEST OF THE THREE ─────────────────────────────────────
 * `amountCents` arrives from a browser, and this action creates a real charge for it. Two
 * failures are available and both are silent: an amount ABOVE what is owed overpays a due and
 * leaves a credit this product has no concept of; an amount of zero or below is a charge Stripe
 * refuses after the member has committed to paying. So it is clamped to
 * `(0, remainingBalanceCents]` against a figure computed by `duesPlanMath` — the same
 * arithmetic the screen quoted, which is what makes the hosted page ask for the number the
 * button promised.
 *
 * ── NOTHING HERE POSTS A PAYMENT ────────────────────────────────────────────────────
 * No `dues_payments` row is written by this file. That happens in
 * `lib/stripe/connect-events.ts` after Stripe says the money moved, and the reason is the rule
 * `recordPayment` already enforces: **the person who owes a due does not get to attest that
 * they paid it.** A member-side write here would be exactly the self-attestation
 * `20260806000001` closed at the policy layer, reopened one level up.
 */

const CURRENCY = 'usd'

export interface DuesAutopayView {
  scheduleId: string
  cadence: string
  amountCents: number
  currentPeriodEnd: string | null
  status: string | null
}

export interface DuesOnlineStatus {
  /** The family has a connected account whose card payments are ACTIVE. */
  chargesReady: boolean
  /** Live recurring arrangements, keyed by schedule. */
  autopay: DuesAutopayView[]
}

/**
 * Whether this member can pay online at all, and what they have already set up.
 *
 * ── GATE THE FETCH, NOT THE BUTTON (§5) ─────────────────────────────────────────────
 * Called by `/accounting/dues-and-donations`, which is already behind one `requireView`. This
 * adds no grant of its own — it answers a question about the caller's own arrangements and
 * about a family-wide capability flag — and it returns a shape with `chargesReady: false` and
 * no rows rather than null, so a page can render the pane without a second branch.
 *
 * ── THE ADMIN CLIENT, §3 BY HAND, AND WHY IT IS NOT THE USER CLIENT ─────────────────
 * `family_stripe_accounts` and `dues_autopay` both have RLS enabled and ZERO policies
 * (20260823000005), so the user client can read neither. Both reads are scoped by
 * `.eq('family_code', …)` — and the autopay read is narrowed FURTHER to the caller's own
 * person, which is stricter than the family boundary and is what stops this from publishing
 * every relative's card arrangement to every relative.
 */
export async function getDuesOnlineStatus(): Promise<DuesOnlineStatus> {
  const empty: DuesOnlineStatus = { chargesReady: false, autopay: [] }
  const g = await requireMember()
  if (!g.ok || !g.familyCode || !g.personId) return empty
  if (stripeUnavailableReason()) return empty

  const admin = createAdminClient()
  const [accountRes, autopayRes] = await Promise.all([
    admin.from('family_stripe_accounts')
      .select('card_payments_status, disconnected_at')
      .eq('family_code', g.familyCode)
      .maybeSingle(),
    admin.from('dues_autopay')
      .select('schedule_id, cadence, amount_cents, current_period_end, status')
      .eq('family_code', g.familyCode)
      .eq('person_id', g.personId)
      .is('cancelled_at', null),
  ])

  // §8 again: a refused read here reports "you cannot pay online" over a family that can, and
  // sends the member looking for a cheque book. Logged, and reported as unavailable — which is
  // the safe direction, because the alternative is a button that fails at the till.
  if (accountRes.error) {
    console.error(`[pay-dues] could not read the processor for ${g.familyCode}: ${accountRes.error.message}`)
    return empty
  }

  return {
    chargesReady: accountRes.data?.disconnected_at == null
      && accountRes.data?.card_payments_status === 'active',
    autopay: (autopayRes.data ?? []).map(row => ({
      scheduleId: row.schedule_id as string,
      cadence: row.cadence as string,
      amountCents: row.amount_cents as number,
      currentPeriodEnd: row.current_period_end as string | null,
      status: row.status as string | null,
    })),
  }
}

export type PayDuesResult =
  | { success: true; url: string }
  | { success: false; message: string }

/** One due, and how much of it this checkout is settling. */
export interface DuesPayItem {
  scheduleId: string
  amountCents: number
}

/**
 * The most dues one Checkout Session may settle.
 *
 * NOT A STRIPE LIMIT — Checkout takes a hundred line items and metadata takes fifty keys, and
 * this is a family's dues list, which is a handful. It is a bound on the ALLOCATION metadata
 * below, whose whole job is to survive a round trip through Stripe intact. A cap that is
 * exceeded is REFUSED and named, never silently trimmed: a truncated allocation is a member
 * paying for six dues and being credited for four, with the difference sitting in the family's
 * account attributed to nothing.
 */
const MAX_PAY_ITEMS = 20

/**
 * The largest single card payment Stripe will take in USD, in cents.
 *
 * A PROCESSOR LIMIT, not a policy. It bounds giving, where this product sets no ceiling of its
 * own; dues are bounded by what is owed long before they could reach it.
 */
const MAX_CHARGE_CENTS = 99_999_999

/**
 * Pay some or all of one due — or of several — in one card payment.
 *
 * ── ONE ACTION, NOT A SINGLE-DUE ONE BESIDE A BATCH ONE ────────────────────────────
 * It took a bare `{ scheduleId, amountCents }` until 2026-08-25 and takes a LIST now, and
 * a one-item convenience wrapper was written and then deleted. Two exports would be two
 * public HTTP endpoints (§2) doing one thing, with the amount rules stated twice — and the
 * wrapper had no caller of its own the moment the screen started sending lists, which is
 * precisely the "live endpoint kept warm for nobody" AGENTS.md records as the cost of
 * leaving `/admin/boardpositions` behind a flag.
 *
 * ── WHY ONE SESSION RATHER THAN SEVERAL ─────────────────────────────────────────────
 * A member on three schedules pressing "pay everything due now" is doing one thing, and
 * Checkout redirects to ONE hosted page — so several sessions is not an implementation
 * choice, it is not available. One session, several line items, and the split back into the
 * family's ledger happens on the way back in.
 *
 * ── THE SPLIT TRAVELS AS METADATA, AND IS RE-VERIFIED ON THE WAY BACK ──────────────
 * `genorra_alloc_<n>` = `<schedule id>:<cents>`, one key per due, plus `genorra_alloc_count`.
 * `lib/stripe/connect-events.ts` reads them, checks they sum to what Stripe actually took, and
 * posts one `dues_payments` row per allocation — each through `postDuesPayment`, which
 * re-reads the schedule with `.eq('family_code', …)` beside it (§4). So a Dashboard-edited
 * allocation cannot reach another family's schedule, and one that does not add up is refused
 * rather than reconciled, exactly as a mismatched `genorra_family_code` already is.
 *
 * `dues_autopay`'s header argues for reading ids out of OUR table rather than out of Stripe
 * metadata, and that argument does not transfer: an autopay is a standing arrangement that
 * outlives the session and has a row of its own to be read back from. A one-off allocation
 * exists for the length of one redirect, and a table to hold it would be a row written before
 * the money moved — with nothing to clean up the ones that are abandoned at the card form.
 *
 * ── EVERY §2 CHECK IS THE SINGLE-DUE ONE, N TIMES ──────────────────────────────────
 * The person is the guard's and is never a parameter. Every schedule is re-resolved out of
 * the caller's OWN summary, so an id that is not theirs resolves to nothing. Every amount is
 * bounded against that row's `remainingBalanceCents`. And the summary is read ONCE — N reads
 * of the same thing could disagree with each other mid-request.
 */
export async function startDuesCheckout(input: {
  items: DuesPayItem[]
}): Promise<PayDuesResult> {
  const g = await requireMember()
  if (!g.ok) return { success: false, message: g.message }
  const { t } = g
  const { intl } = await callerI18n(g.userId)
  if (!g.familyCode || !g.personId) return { success: false, message: t('act.profileNotFound2') }

  // `input?.items`, not `input.items`. A server action is a public HTTP endpoint and its
  // argument is whatever was deserialised off the wire — the TypeScript signature is erased
  // at runtime, so a POST carrying `null` would throw here rather than be refused.
  const items = Array.isArray(input?.items) ? input.items : []
  if (items.length === 0) return { success: false, message: t('act.chooseLeastOneDuePay') }
  if (items.length > MAX_PAY_ITEMS) {
    return {
      success: false,
      message: `Up to ${MAX_PAY_ITEMS} dues can be paid in one go. Pay some of them separately.`,
    }
  }
  // A repeated schedule would post two rows against one due, and the second would collide on
  // `(source, processor_ref)` and be discarded as a duplicate — so the member would be charged
  // for it and credited once. Refused before any of that.
  const seen = new Set(items.map(i => i.scheduleId))
  if (seen.size !== items.length) {
    return { success: false, message: t('act.sameDueListedTwice') }
  }

  const unavailable = stripeUnavailableReason()
  if (unavailable) return { success: false, message: unavailable }
  const stripe = stripeClient()
  if (!stripe) return { success: false, message: t('act.onlinePaymentsNotSetUp2') }

  const account = await readyAccount(g.familyCode)
  if (!account) {
    return { success: false, message: t('act.familyNotSetUpTake') }
  }

  // THE SCHEDULES COME OUT OF THE CALLER'S OWN SUMMARY. An id that is not in it — another
  // family's, a donation drive's, a due they have opted out of — resolves to nothing, so the
  // §4 check is structural rather than a conjunct somebody has to remember.
  const summary = await getMyDuesSummary()

  const resolved: { row: DuesSummary; amount: number }[] = []
  for (const item of items) {
    const row = summary.find(s => s.schedule.id === item.scheduleId)
    if (!row) return { success: false, message: t('act.dueNotOneYours') }
    if (row.schedule.kind !== 'dues') {
      return { success: false, message: t('act.donationsGivenFromDonationsPane') }
    }

    const owed = row.remainingBalanceCents
    if (owed <= 0) {
      return { success: false, message: `There is nothing left to pay on ${row.schedule.label}.` }
    }

    const amount = Math.round(item.amountCents)
    if (!Number.isFinite(amount) || amount <= 0) {
      return { success: false, message: t('act.enterAmountPay') }
    }
    if (amount > owed) {
      // NAMES THE CEILING, AND THE DUE. "Invalid amount" would leave somebody guessing at a
      // figure the screen beside them is already showing, and this product has no concept of a
      // credit balance — so the refusal has to be useful rather than merely correct. Naming
      // the schedule matters more here than it did for one due: a combined payment refused
      // without saying which line was wrong is a refusal nobody can act on.
      return {
        success: false,
        message: `That is more than is owed. The most that can be paid on ${row.schedule.label} is ${formatCurrency(owed, intl)}.`,
      }
    }

    resolved.push({ row, amount })
  }

  const single = resolved.length === 1 ? resolved[0] : null
  const totalCents = resolved.reduce((sum, r) => sum + r.amount, 0)
  const allocation = resolved.map(({ row, amount }) => ({ scheduleId: row.schedule.id, amount }))

  try {
    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      // No `payment_method_types` — dynamic payment methods, per Stripe's guidance. A family
      // taking dues from relatives across a country benefits from that more than most.
      //
      // ONE LINE PER DUE, NAMED. The hosted page is the last thing the member reads before
      // they commit, so it has to itemize what they are about to pay rather than showing one
      // total they would have to take on trust.
      line_items: resolved.map(({ row, amount }) => ({
        quantity: 1,
        price_data: {
          currency: CURRENCY,
          unit_amount: amount,
          product_data: {
            name: row.schedule.label,
            description: `Dues payment · ${g.familyCode}`,
          },
        },
      })),
      customer_email: await payerEmail(),
      client_reference_id: g.personId,
      payment_intent_data: {
        metadata: allocationMetadata('dues', g.familyCode, g.personId, allocation),
        // ON THE FAMILY'S OWN STATEMENT, not ours. A relative who does not recognise a line on
        // their card statement disputes it, and a dispute on a direct charge is the family's
        // to answer — so the descriptor has to name the family, not the software.
        //
        // A combined payment names no single due, because it is not one: the suffix says what
        // the charge was FOR, and "Dues" is the honest answer where four schedules are being
        // settled at once.
        statement_descriptor_suffix: single
          ? statementSuffix(single.row.schedule.label)
          : statementSuffix('Dues'),
      },
      metadata: allocationMetadata('dues', g.familyCode, g.personId, allocation),
      integration_identifier: INTEGRATION_IDS.familyDuesOnce,
      ...checkoutReturnUrls('/accounting/dues-and-donations'),
    }, {
      // The account header AND the idempotency key. `onAccount` is the only place in the
      // product that sets the first, so a grep for it is the complete list of calls made on a
      // family's behalf.
      //
      // The BODY digest carries the allocation, because the naming parts cannot: a key naming
      // only the member and a total would hand a member paying $200 across two dues the
      // session they created a minute earlier paying $200 across two DIFFERENT dues. See
      // `intentKey` — a changed request has to be a changed key.
      ...onAccount(account),
      idempotencyKey: intentKey(
        ['dues-once', g.personId, resolved.length, totalCents],
        resolved.map(({ row, amount }) => [row.schedule.id, amount]),
      ),
    })

    if (!session.url) return { success: false, message: t('act.couldNotStartPaymentPlease') }
    return { success: true, url: session.url }
  } catch (e) {
    console.error(`[pay-dues] checkout failed for ${g.familyCode}/${g.personId}: ${describe(e)}`)
    return { success: false, message: t('act.couldNotStartPaymentPlease') }
  }
}

/**
 * Set up automatic payments against one due.
 *
 * ── THE CADENCE IS NOT A PARAMETER, AND THAT IS THE DESIGN ──────────────────────────
 * A member already chooses how often they pay each due — `dues_member_plans`, set through
 * `setMyDuesPlan`, and it is what `duesPlanMath` builds the whole installment ladder from.
 * Taking a cadence here as well would be a SECOND answer to one question, and the two would
 * disagree the first time somebody changed one of them: the screen would say "monthly" while
 * Stripe charged quarterly, and nothing anywhere would compare them.
 *
 * So autopay reads the plan. The amount is `installmentCents` from the same summary the screen
 * quotes — not `nextInstallmentCents`, which is deliberately larger when a member is behind. A
 * recurring charge has to be the STEADY-STATE figure; billing the catch-up amount every month
 * forever would overcharge somebody for being late once, and `lib/dues-utils.ts` §7c is where
 * the distinction between those two numbers is argued.
 *
 * A member on `'one-time'` has no cadence to renew, so this refuses and says which screen
 * fixes it.
 */
export async function startDuesAutopay(input: { scheduleId: string }): Promise<PayDuesResult> {
  const g = await requireMember()
  if (!g.ok) return { success: false, message: g.message }
  const { t } = g
  if (!g.familyCode || !g.personId) return { success: false, message: t('act.profileNotFound2') }

  const unavailable = stripeUnavailableReason()
  if (unavailable) return { success: false, message: unavailable }
  const stripe = stripeClient()
  if (!stripe) return { success: false, message: t('act.onlinePaymentsNotSetUp2') }

  const account = await readyAccount(g.familyCode)
  if (!account) {
    return { success: false, message: t('act.familyNotSetUpTake') }
  }

  const summary = (await getMyDuesSummary()).find(s => s.schedule.id === input.scheduleId)
  if (!summary) return { success: false, message: t('act.dueNotOneYours') }
  if (summary.schedule.kind !== 'dues') {
    // Belt and braces over the guard trigger on `dues_autopay`, which refuses a donation
    // schedule in the database. Saying so here means the member reads a sentence rather than
    // watching a Stripe subscription get created and then orphaned.
    return { success: false, message: t('act.recurringPaymentsDuesOnly') }
  }
  if (summary.optedOut) {
    return { success: false, message: t('act.youDeclinedDueOptBack') }
  }

  const recurring = stripeInterval(summary.cadence)
  if (!recurring) {
    return {
      success: false,
      message: t('act.pickHowOftenYouWant'),
    }
  }

  const amount = summary.installmentCents
  if (amount <= 0) return { success: false, message: t('act.thereNothingSetUpDue') }

  // One LIVE arrangement per member per schedule is a partial unique index, so a second one
  // would be refused by the database on the way back in from the webhook — after the member
  // had entered their card. Refusing here means they read a sentence instead.
  const admin = createAdminClient()
  const { data: existing } = await admin.from('dues_autopay')
    .select('id')
    .eq('family_code', g.familyCode)
    .eq('person_id', g.personId)
    .eq('schedule_id', input.scheduleId)
    .is('cancelled_at', null)
    .maybeSingle()
  if (existing) {
    return { success: false, message: t('act.automaticPaymentsAlreadySetUp') }
  }

  try {
    const session = await stripe.checkout.sessions.create({
      mode: 'subscription',
      line_items: [{
        quantity: 1,
        price_data: {
          currency: CURRENCY,
          unit_amount: amount,
          recurring,
          product_data: { name: `${summary.schedule.label} (automatic)` },
        },
      }],
      customer_email: await payerEmail(),
      client_reference_id: g.personId,
      subscription_data: {
        metadata: {
          ...duesMetadata(g.familyCode, g.personId, input.scheduleId),
          genorra_cadence: summary.cadence,
        },
      },
      metadata: {
        ...duesMetadata(g.familyCode, g.personId, input.scheduleId),
        genorra_cadence: summary.cadence,
      },
      integration_identifier: INTEGRATION_IDS.familyDuesAutopay,
      ...checkoutReturnUrls('/accounting/dues-and-donations'),
    }, {
      ...onAccount(account),
      idempotencyKey: intentKey(['dues-autopay', g.personId, input.scheduleId, amount, summary.cadence]),
    })

    if (!session.url) return { success: false, message: t('act.couldNotStartSetupPlease') }
    return { success: true, url: session.url }
  } catch (e) {
    console.error(`[pay-dues] autopay setup failed for ${g.familyCode}/${g.personId}: ${describe(e)}`)
    return { success: false, message: t('act.couldNotSetUpAutomatic') }
  }
}

export type CancelAutopayResult =
  | { success: true; message: string }
  | { success: false; message: string }

/**
 * Stop automatic payments on one due.
 *
 * ── CANCELLED IMMEDIATELY, WHICH IS THE OPPOSITE OF THE PLAN RULE, AND CORRECTLY SO ─
 * `cancelPlanRenewal` on the platform side sets `cancel_at_period_end`, because a family has
 * PAID for the period they are in and stopping now would take away something they bought. Here
 * there is nothing bought in advance: an autopay is a standing instruction to charge, and
 * somebody switching it off is asking not to be charged again. Deferring it to a period end
 * would take one more payment from a member who had just said stop.
 *
 * Every payment already made stays exactly where it is. `dues_payments` is append-only, and
 * cancelling an arrangement is not a reason to unwind a due somebody genuinely settled.
 */
export async function cancelDuesAutopay(input: { scheduleId: string }): Promise<CancelAutopayResult> {
  const g = await requireMember()
  if (!g.ok) return { success: false, message: g.message }
  const { t } = g
  if (!g.familyCode || !g.personId) return { success: false, message: t('act.profileNotFound2') }

  const stripe = stripeClient()
  if (!stripe) return { success: false, message: t('act.onlinePaymentsNotSetUp2') }

  const admin = createAdminClient()
  // THE CALLER'S OWN ROW, and all three conjuncts are load-bearing: the family, the person and
  // the schedule. `person_id` is the guard's, never a parameter, so there is no way to ask this
  // endpoint to cancel a relative's arrangement.
  const { data: row } = await admin.from('dues_autopay')
    .select('id, stripe_subscription_id, stripe_account_id')
    .eq('family_code', g.familyCode)
    .eq('person_id', g.personId)
    .eq('schedule_id', input.scheduleId)
    .is('cancelled_at', null)
    .maybeSingle()
  if (!row) return { success: false, message: t('act.thereNoAutomaticPaymentsSet') }

  try {
    await stripe.subscriptions.cancel(
      row.stripe_subscription_id as string,
      undefined,
      onAccount(row.stripe_account_id as string),
    )
  } catch (e) {
    const message = describe(e)
    // Already gone at Stripe is the outcome we wanted; anything else is reported, because
    // telling a member their payments have stopped while they have not is the worst answer
    // available here.
    if (!/No such subscription|resource_missing/i.test(message)) {
      console.error(`[pay-dues] could not cancel autopay ${row.id}: ${message}`)
      return { success: false, message: t('act.couldNotStopAutomaticPayments') }
    }
  }

  // `cancelled_at` is what the partial unique index keys on, so this is also what frees the
  // member to set a new arrangement up. The row itself is never deleted — it is the record of
  // what they had agreed to.
  const { error } = await admin.from('dues_autopay')
    .update({ cancelled_at: new Date().toISOString(), status: 'canceled' })
    .eq('id', row.id)
    .eq('family_code', g.familyCode)
    .eq('person_id', g.personId)
  if (error) {
    // Stripe has stopped charging and our record still says live. Reported rather than hidden:
    // the member's screen would otherwise keep offering to cancel something already cancelled.
    console.error(`[pay-dues] Stripe cancelled but the row did not update (${row.id}): ${error.message}`)
    return {
      success: false,
      message: t('act.paymentsBeenStoppedStripeBut'),
    }
  }

  revalidatePath('/accounting/dues-and-donations')
  return { success: true, message: t('act.automaticPaymentsBeenStoppedEvery') }
}

// ── Giving to a drive ───────────────────────────────────────────────────────────────

/**
 * Give to one donation drive, by card.
 *
 * ── A SEPARATE ACTION FROM `startDuesCheckout`, AND THE SEPARATION IS THE POINT ────
 * The obvious economy is one checkout that takes any schedule and routes by its `kind`. It is
 * refused here, because the two are different in every way that matters at this layer:
 *
 *   a DUE has a ceiling      `remainingBalanceCents`, and paying past it leaves a credit this
 *                            product has no concept of. A GIFT has none — the goal on a drive
 *                            is an advised target and explicitly not a cap.
 *   a DUE can be combined     "pay everything due now" is one action over a list. A GIFT is one
 *                            drive at a time, deliberately: giving to one says nothing about
 *                            the others, and a basket would invite a total nobody chose.
 *   a DUE can recur           autopay follows the cadence the member set. A drive has no
 *                            cadence, and agreeing to give once is not agreeing to give every
 *                            month. There is no recurring path here and must not be one.
 *
 * And the safety half: `postDuesPayment` refuses a schedule whose kind is not the one the flow
 * declared. One action taking either kind would have to relax that into "whatever the row says",
 * which is exactly the guard that stops a card payment being credited to a drive and appearing
 * in somebody's dues history as a due they settled.
 *
 * ── WHAT IS CHECKED, AND WHAT DELIBERATELY IS NOT ─────────────────────────────────
 * The person is the guard's and is never a parameter. The drive is re-resolved out of
 * `getDonationProgress()`, which is already scoped to the caller's family — so a forged id
 * resolves to nothing rather than to another family's drive (§4). A CLOSED drive is refused,
 * because a bar that cannot move any more is history and money arriving against it would
 * silently reopen it.
 *
 * The amount is NOT bounded by the goal. That is the one difference from the dues flow that a
 * future edit is most likely to get wrong: a drive that has met its goal keeps taking money,
 * and `DonationSummary.progressPercent` is unclamped precisely so the screen can say so.
 */
export async function startDonationCheckout(input: {
  scheduleId: string
  amountCents: number
}): Promise<PayDuesResult> {
  const g = await requireMember()
  if (!g.ok) return { success: false, message: g.message }
  const { t } = g
  const { intl } = await callerI18n(g.userId)
  if (!g.familyCode || !g.personId) return { success: false, message: t('act.profileNotFound2') }

  const unavailable = stripeUnavailableReason()
  if (unavailable) return { success: false, message: unavailable }
  const stripe = stripeClient()
  if (!stripe) return { success: false, message: t('act.onlinePaymentsNotSetUp2') }

  const account = await readyAccount(g.familyCode)
  if (!account) {
    return { success: false, message: t('act.familyNotSetUpTake') }
  }

  const drive = (await getDonationProgress()).find(d => d.schedule.id === input?.scheduleId)
  if (!drive) return { success: false, message: t('act.driveNotOneYourFamily') }
  if (drive.closed) {
    return { success: false, message: `${drive.schedule.label} has closed. Nothing more can be given to it.` }
  }

  const amount = Math.round(input.amountCents)
  if (!Number.isFinite(amount) || amount <= 0) {
    return { success: false, message: t('act.enterAmountGive') }
  }
  // STRIPE'S OWN CEILING, not one this product invented. There is no reason a family should
  // not be given a large gift, so the only honest limit is the one the processor enforces —
  // and hitting it after the member has committed to giving is the failure this avoids.
  if (amount > MAX_CHARGE_CENTS) {
    return {
      success: false,
      message: `A single card payment cannot be more than ${formatCurrency(MAX_CHARGE_CENTS, intl)}. Give it in two.`,
    }
  }

  try {
    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      line_items: [{
        quantity: 1,
        price_data: {
          currency: CURRENCY,
          unit_amount: amount,
          product_data: {
            name: drive.schedule.label,
            description: `Donation · ${g.familyCode}`,
          },
        },
      }],
      customer_email: await payerEmail(),
      client_reference_id: g.personId,
      payment_intent_data: {
        metadata: allocationMetadata('donation', g.familyCode, g.personId,
          [{ scheduleId: drive.schedule.id, amount }]),
        // ON THE FAMILY'S OWN STATEMENT, not ours — see `startDuesCheckout`. The drive's name
        // is what the giver will be looking for when they read their statement.
        statement_descriptor_suffix: statementSuffix(drive.schedule.label),
      },
      metadata: allocationMetadata('donation', g.familyCode, g.personId,
        [{ scheduleId: drive.schedule.id, amount }]),
      integration_identifier: INTEGRATION_IDS.familyDonation,
      ...checkoutReturnUrls('/accounting/dues-and-donations?pane=donations'),
    }, {
      ...onAccount(account),
      // The amount is IN the naming parts rather than in a body digest: a gift is one drive
      // and one figure, so there is no allocation shape for a digest to distinguish. Giving
      // twice on one day is what the parts have to separate, and a changed amount is a
      // changed key.
      idempotencyKey: intentKey(['donation', g.personId, drive.schedule.id, amount]),
    })

    if (!session.url) return { success: false, message: t('act.couldNotStartPaymentPlease') }
    return { success: true, url: session.url }
  } catch (e) {
    console.error(`[pay-dues] donation checkout failed for ${g.familyCode}/${g.personId}: ${describe(e)}`)
    return { success: false, message: t('act.couldNotStartPaymentPlease') }
  }
}

// ── Internals ───────────────────────────────────────────────────────────────────────

/**
 * The family's connected account id, but ONLY when it can actually take a card.
 *
 * `card_payments.status === 'active'` and not `charges_enabled`, for the reason
 * `app/actions/admin/processing.ts` gives at length: the two disagree during review, and the
 * window in which they disagree is the window in which a member is handed a checkout that
 * fails after they have decided to pay.
 */
async function readyAccount(familyCode: string): Promise<string | null> {
  const { data, error } = await createAdminClient()
    .from('family_stripe_accounts')
    .select('stripe_account_id, card_payments_status, disconnected_at')
    .eq('family_code', familyCode)
    .maybeSingle()
  if (error) {
    console.error(`[pay-dues] could not read the processor for ${familyCode}: ${error.message}`)
    return null
  }
  if (!data || data.disconnected_at != null) return null
  if (data.card_payments_status !== 'active') return null
  return data.stripe_account_id as string
}

function duesMetadata(familyCode: string, personId: string, scheduleId: string): Record<string, string> {
  return {
    genorra_flow: 'dues',
    genorra_family_code: familyCode,
    genorra_person_id: personId,
    genorra_schedule_id: scheduleId,
  }
}

/**
 * A one-off charge's metadata: which flow it is, who and where, and how it splits.
 *
 * ── `genorra_flow` IS WHAT THE WEBHOOK DISPATCHES ON ───────────────────────────────
 * `'dues'` or `'donation'`, and the two are never mixed in one session. It decides which
 * KIND of schedule `postDuesPayment` will accept, so a drive can never be credited by the
 * dues path and a due can never be credited by the giving one — see the header on
 * `startDonationCheckout` for why that separation is the whole point rather than tidiness.
 *
 * ── `genorra_schedule_id` SURVIVES FOR A SINGLE DUE, DELIBERATELY ──────────────────
 * It is what every session created before the batch existed carries, and what the webhook
 * falls back to when it finds no allocation keys. Dropping it would strand any session already
 * in flight at deploy time — a member sitting on Stripe's hosted page with their card out,
 * whose payment would then post against nothing.
 *
 * ── AND THE ALLOCATION IS WRITTEN EVEN FOR ONE ─────────────────────────────────────
 * So the webhook has ONE path rather than a batch path and a legacy path that could drift.
 * The fallback above is for old sessions, not for new single ones.
 */
function allocationMetadata(
  flow: 'dues' | 'donation',
  familyCode: string,
  personId: string,
  resolved: readonly { scheduleId: string; amount: number }[],
): Record<string, string> {
  const meta: Record<string, string> = {
    genorra_flow: flow,
    genorra_family_code: familyCode,
    genorra_person_id: personId,
    genorra_alloc_count: String(resolved.length),
  }
  if (resolved.length === 1) meta.genorra_schedule_id = resolved[0].scheduleId
  resolved.forEach(({ scheduleId, amount }, i) => {
    meta[`genorra_alloc_${i}`] = `${scheduleId}:${amount}`
  })
  return meta
}

/**
 * The payer's own email, for prefilling the hosted page — or undefined.
 *
 * THEIR OWN, from their own session, which is why this takes no argument. And undefined rather
 * than a placeholder: a member with no account of their own cannot reach this code, but a
 * generated `@genorra.com` address would prefill a receipt destination that hard-bounces, so
 * the guard is worth keeping even where it should be unreachable.
 */
async function payerEmail(): Promise<string | undefined> {
  const { user } = await currentUser()
  return user?.email ?? undefined
}

/**
 * A member's chosen cadence as a Stripe recurring interval, or null where there is none.
 *
 * QUARTERLY IS THREE MONTHS AND NOT A QUARTER, because Stripe has no quarterly interval —
 * `interval_count: 3` on months is the only way to say it, and getting that wrong bills
 * somebody every month for a due they meant to pay four times a year.
 */
function stripeInterval(cadence: PayCadence): { interval: 'week' | 'month' | 'year'; interval_count?: number } | null {
  switch (cadence) {
    case 'weekly': return { interval: 'week' }
    case 'monthly': return { interval: 'month' }
    case 'quarterly': return { interval: 'month', interval_count: 3 }
    case 'annual': return { interval: 'year' }
    // 'one-time' pays the whole due at once and has nothing to renew.
    default: return null
  }
}

/**
 * A card-statement suffix Stripe will accept.
 *
 * Stripe's rules: at most 22 characters, no `<>\\'"*`, and it is appended to the FAMILY's own
 * statement descriptor — so this names the due rather than the family, which the prefix
 * already does. Sanitised rather than trusted: the label is a treasurer's free text and an
 * apostrophe in "St Mary's Dues" would be refused by the API, which would fail the checkout
 * for a punctuation mark.
 */
function statementSuffix(label: string): string | undefined {
  const cleaned = label.replace(/[<>\\'"*]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 22)
  return cleaned.length > 0 ? cleaned : undefined
}

function describe(e: unknown): string {
  return e instanceof Error ? e.message : String(e)
}
