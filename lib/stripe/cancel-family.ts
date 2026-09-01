import 'server-only'

import { createAdminClient } from '@/lib/supabase/admin'
import { intentKey, onAccount, stripeClient } from '@/lib/stripe/client'

/**
 * Stopping every recurring charge that exists at Stripe for one family.
 *
 * ══════════════════════════════════════════════════════════════════════════════════
 * ── MONEY HAS TWO DIRECTIONS, AND A FAMILY ENDING HAS TO STOP BOTH ────────────────
 * ══════════════════════════════════════════════════════════════════════════════════
 * AGENTS.md's rule is that the two ledgers must never meet, and every consequence of it so far
 * has been about not CONFLATING them. This module is the one place both are addressed in one
 * call, and it is still not a conflation: they are cancelled by two different code paths, on
 * two different Stripe accounts, and counted separately in the result.
 *
 *   `dues_autopay`                a RELATIVE paying THEIR FAMILY, on the family's own
 *                                 connected account. Cancelled with `Stripe-Account` set.
 *   `platform_billing_accounts`   the FAMILY paying GENORRA, on our account. Cancelled
 *                                 without it.
 *
 * ── WHY IT EXISTS: A DELETED FAMILY WAS STILL BEING CHARGED ───────────────────────
 * `staff_delete_family` deletes every table with a `family_code` column, which includes both
 * of the tables above — and a Stripe subscription is not a row in this database. So before
 * this module, a permanently deleted family left:
 *
 *   * every relative's standing dues arrangement live on the family's connected account,
 *     charging cards monthly, with no row anywhere in this product pointing at any of them;
 *   * the family's own GENORRA subscription live on OUR account, invoicing a card for a
 *     product that no longer has a single row — and `platform-events.ts` upserting
 *     `platform_billing_accounts` on every renewal, RE-CREATING a billing row for a family
 *     that does not exist (that table's `family_code` has no foreign key to `families`).
 *
 * The second one is the worse of the two, because it bills for nothing and looks like revenue.
 *
 * ── ORDER: THE RELATIVES FIRST, THEN OURSELVES ────────────────────────────────────
 * Somebody else's card comes before our own invoice. If only half of this can be made to work,
 * the half that must succeed is the one taking money from people who are not party to the
 * decision.
 *
 * ── AND IT MUST RUN BEFORE THE ROWS GO. THE STORAGE ARGUMENT, TRANSPOSED ──────────
 * `staff/destroy.ts` deletes the bytes first because afterwards nothing can enumerate which
 * objects belonged to which family. The same sentence is true of subscriptions and the stakes
 * are higher: once `dues_autopay` and `platform_billing_accounts` are deleted, the only record
 * of which Stripe subscriptions belonged to that family is at Stripe, and finding them means a
 * person reading a dashboard by hand. A charge cannot be un-charged; a deletion can be retried.
 *
 * ── WHAT IT DELIBERATELY DOES NOT DO ─────────────────────────────────────────────
 *   * **It does not close the family's connected account.** `disconnectProcessor`'s header
 *     argues it and nothing here changes: the account is theirs, and every payout, refund and
 *     dispute on it is theirs.
 *   * **It does not delete our Stripe CUSTOMER.** `platform_payments` is GENORRA's own revenue
 *     record and survives a family deletion by design (`tier_data_keep`); deleting the
 *     customer would orphan our own ledger's references to charges on it.
 *   * **It refunds nothing.** Rule 2 of "FOUR RULES ABOUT PLANS". `subscriptions.cancel` with
 *     neither `invoice_now` nor `prorate` issues no invoice and no proration credit — and a
 *     credit is a refund that has not been paid out yet, which is the hazard that rule names.
 */

/** What one half of the work reports. */
export interface HalfResult {
  ok: boolean
  cancelled: number
  /** One sentence, for the log and for the caller's own message. Set only when `ok` is false. */
  failure?: string
  /**
   * WHICH LAYER REFUSED, so a caller can say two different things about two different facts.
   *
   * `disconnectProcessor` distinguishes them and must keep being able to: "we could not check
   * your recurring payments" and "some members may still be being charged" are opposite
   * reassurances, and a merged message would give the wrong one half the time. Set only when
   * `ok` is false.
   */
  stage?: 'read' | 'stripe' | 'unconfigured'
}

export interface FamilySubscriptionCancellation {
  ok: boolean
  /** Standing dues arrangements stopped on the family's own connected account. */
  duesCancelled: number
  /** Whether the family's GENORRA plan was stopped (false also when there was none). */
  platformCancelled: boolean
  failure?: string
}

/**
 * A subscription Stripe no longer has, or already has as cancelled, is the outcome we wanted.
 *
 * EXPORTED, because `lib/billing/subscription-reaper.ts` has to make the same judgement about
 * the same errors — and two copies of "which Stripe errors mean it is already stopped" is two
 * places for one of them to be dropped, on a predicate whose false side is a live charge.
 *
 * Narrow on purpose. Anything outside this set is a real failure and stops the caller: a
 * catch-all here would report "stopped" over a live subscription, which is the one mistake this
 * module exists to prevent. `resource_missing` and "No such subscription" are the two shapes
 * `disconnectProcessor` already treats this way; the third is Stripe refusing to act on a
 * subscription that is already `canceled`.
 */
export function stripeAlreadyStopped(message: string): boolean {
  return /No such subscription|resource_missing|already canceled|is canceled|may not be (updated|canceled)/i
    .test(message)
}

function describe(e: unknown): string {
  if (e instanceof Error) return e.message
  return typeof e === 'string' ? e : 'unknown error'
}

/**
 * Cancel every LIVE standing dues arrangement for this family, at Stripe, and mark our rows.
 *
 * ── THE ACCOUNT COMES OFF EACH ROW, NOT OFF `family_stripe_accounts` ──────────────
 * `dues_autopay.stripe_account_id` is denormalised precisely so a subscription is always
 * addressed on the account it was created on, and `dues_autopay_guard_family` asserts the two
 * agree on every write — so reading it here is equivalent to reading the family's account row
 * and strictly narrower. It also means a family whose `family_stripe_accounts` row is missing
 * or already disconnected still has its members' subscriptions stopped, which is the case that
 * matters most: that is the state a half-finished disconnection leaves behind.
 *
 * ── A PARTIAL FAILURE IS A FAILURE, AND THE ROWS ALREADY DONE STAY DONE ───────────
 * It stops at the first subscription it could not cancel and reports how many it had already
 * stopped. Each cancelled subscription's row is stamped as it goes, so a retry does not try to
 * cancel it again — and the count is what the caller reports rather than a claim that everything
 * is stopped.
 */
export async function cancelFamilyDuesAutopay(
  admin: ReturnType<typeof createAdminClient>,
  familyCode: string,
): Promise<HalfResult> {
  // §3: the service role sees past RLS, so the family conjunct here IS the isolation.
  const { data: rows, error } = await admin
    .from('dues_autopay')
    .select('id, stripe_subscription_id, stripe_account_id')
    .eq('family_code', familyCode)
    .is('cancelled_at', null)

  // §8: `const { data }` discards the error and answers `[]` — and here an empty array means
  // "nobody is being charged", which is exactly the false reassurance this whole module is
  // about. A read that failed must never be reported as nothing to do.
  if (error) {
    return {
      ok: false,
      cancelled: 0,
      stage: 'read',
      failure: `could not read the standing dues arrangements: ${error.message}`,
    }
  }

  const live = rows ?? []
  if (live.length === 0) return { ok: true, cancelled: 0 }

  // Asked for only once there is something to cancel: a deployment with no Stripe key can have
  // no subscriptions, so refusing up front would block a deletion for a family that has none.
  // With rows in hand it is the opposite — no client means no way to stop a live charge, and
  // saying so is the only honest answer.
  const stripe = stripeClient()
  if (!stripe) {
    return {
      ok: false,
      cancelled: 0,
      stage: 'unconfigured',
      failure: `${live.length} standing dues arrangement(s) exist and Stripe is not configured on this deployment`,
    }
  }

  let cancelled = 0
  for (const row of live) {
    const subscriptionId = row.stripe_subscription_id as string
    const accountId = row.stripe_account_id as string
    try {
      await stripe.subscriptions.cancel(subscriptionId, undefined, onAccount(accountId))
    } catch (e) {
      const message = describe(e)
      if (!stripeAlreadyStopped(message)) {
        return {
          ok: false,
          cancelled,
          stage: 'stripe',
          failure: `could not cancel ${subscriptionId} on ${accountId}: ${message}`,
        }
      }
    }

    const { error: stampError } = await admin
      .from('dues_autopay')
      .update({ cancelled_at: new Date().toISOString(), status: 'canceled' })
      .eq('id', row.id)
      .eq('family_code', familyCode)
    // Reported, not fatal: the charge has stopped, which is the fact that matters, and a row
    // this call is about to delete anyway must not hold up the cancellation of the next
    // member's subscription. The log is what a person reconciles against.
    if (stampError) {
      console.error(`[stripe/cancel-family] ${familyCode}: cancelled ${subscriptionId} but could not stamp the row: ${stampError.message}`)
    }
    cancelled += 1
  }

  return { ok: true, cancelled }
}

/**
 * When the family's GENORRA plan should stop. The two acts that end a family want different
 * answers, and the difference is a decision rather than a detail — see below.
 */
export type PlanCancellation = 'now' | 'period-end'

/**
 * Stop the family's GENORRA plan at Stripe.
 *
 * ══════════════════════════════════════════════════════════════════════════════════
 * ── `now` FOR A DELETION, `period-end` FOR A REMOVAL, AND WHY IT IS NOT ONE ANSWER ─
 * ══════════════════════════════════════════════════════════════════════════════════
 * `cancelPlanRenewal` — a family choosing to stop renewing — is `cancel_at_period_end` because
 * ending a term early takes away pages they had paid for with nothing given back (rule 2 of
 * "FOUR RULES ABOUT PLANS", and rule 3's argument about `paid_through` being inclusive). Which
 * of those arguments survives depends entirely on whether the family still exists:
 *
 *   **`now`, for a permanent DELETION.** There is no family left to lose pages, and a
 *   period-end cancellation would leave the subscription ACTIVE for up to a month — still
 *   current at Stripe, still emitting `customer.subscription.updated` and `invoice.paid` for a
 *   `family_code` with not one row behind it, and still able to be reactivated by anything that
 *   touches it.
 *
 *   **`period-end`, for a REMOVAL.** Removal destroys nothing and a restore brings every row
 *   back, so rule 2 applies unchanged: the term is paid for, nothing is refunded, and ending it
 *   early would be taking away something bought. It also makes a restore inside that month cost
 *   the family nothing at all, because the subscription is still there to keep. Either way it
 *   does not renew, which is what "the billing stops" means.
 *
 * Neither branch passes `invoice_now` or `prorate`, so Stripe issues no final invoice and **no
 * proration credit** — a credit is a refund that has not been paid out yet, which is precisely
 * the hazard `changePlanTier` passes `proration_behavior: 'none'` to avoid.
 *
 * ── NO IDEMPOTENCY KEY ON THE `now` BRANCH, DELIBERATELY ─────────────────────────
 * Cancelling is a DELETE, and Stripe's idempotency keys apply to POSTs. The property is bought
 * instead by `stripeAlreadyStopped()`: a second run finds the subscription gone or already
 * cancelled and treats that as the outcome it wanted. The `period-end` branch is an UPDATE and
 * carries one, matching `cancelPlanRenewal`.
 */
export async function cancelFamilyPlan(
  admin: ReturnType<typeof createAdminClient>,
  familyCode: string,
  when: PlanCancellation,
): Promise<HalfResult> {
  const { data: row, error } = await admin
    .from('platform_billing_accounts')
    .select('stripe_subscription_id, subscription_status')
    .eq('family_code', familyCode)
    .maybeSingle()

  // §8 again, and the same stake: no row and a refused read look identical in `data`.
  if (error) {
    return { ok: false, cancelled: 0, stage: 'read', failure: `could not read the GENORRA plan: ${error.message}` }
  }

  const subscriptionId = (row?.stripe_subscription_id as string | null) ?? null
  // A family that never bought a monthly plan, or bought a prepaid term, has no subscription to
  // stop. That is a clean nothing-to-do rather than a failure — a prepaid term simply ends.
  if (!subscriptionId) return { ok: true, cancelled: 0 }

  // Already cancelled at Stripe, according to the last event we recorded. Skipped rather than
  // re-cancelled: `stripeAlreadyStopped()` would swallow the error anyway, and not making the
  // call is clearer than making one we expect to fail. True of both branches — Stripe refuses
  // to set `cancel_at_period_end` on a subscription it has already ended.
  if ((row?.subscription_status as string | null) === 'canceled') return { ok: true, cancelled: 0 }

  const stripe = stripeClient()
  if (!stripe) {
    return {
      ok: false,
      cancelled: 0,
      stage: 'unconfigured',
      failure: `the family has a live GENORRA subscription (${subscriptionId}) and Stripe is not configured on this deployment`,
    }
  }

  try {
    if (when === 'now') {
      await stripe.subscriptions.cancel(subscriptionId)
    } else {
      await stripe.subscriptions.update(subscriptionId, { cancel_at_period_end: true },
        { idempotencyKey: intentKey(['plan-cancel', familyCode, subscriptionId]) })
    }
  } catch (e) {
    const message = describe(e)
    if (!stripeAlreadyStopped(message)) {
      return { ok: false, cancelled: 0, stage: 'stripe', failure: `could not cancel ${subscriptionId}: ${message}` }
    }
  }

  // `subscription_status` is only moved on the `now` branch, because on the other one Stripe's
  // own status is still `active` until the term ends — writing 'canceled' there would put a word
  // in that column Stripe disagrees with, and the next `customer.subscription.updated` would
  // overwrite it anyway. `cancel_at_period_end` is true in both cases and is the fact that
  // matters: it will not renew.
  const patch: Record<string, unknown> = { cancel_at_period_end: true, scheduled_tier: 'free' }
  if (when === 'now') patch.subscription_status = 'canceled'
  const { error: stampError } = await admin
    .from('platform_billing_accounts')
    .update(patch)
    .eq('family_code', familyCode)
  // Reported, not fatal, for `cancelFamilyDuesAutopay`'s reason: the charge has stopped. On the
  // deletion path this row is about to be deleted; on any other caller it is what the screens
  // read, which is why it is written at all.
  if (stampError) {
    console.error(`[stripe/cancel-family] ${familyCode}: cancelled ${subscriptionId} but could not record it: ${stampError.message}`)
  }

  return { ok: true, cancelled: 1 }
}

/**
 * Both halves, for a family that is ending.
 *
 * Relatives first (see the module header), and it STOPS if that half fails — our own invoice
 * continuing for a few more minutes is the lesser harm, and the caller is going to refuse the
 * act anyway, so pressing on would leave a half-finished job with a misleading count.
 *
 * ── THE DUES HALF IS IMMEDIATE IN BOTH CASES, AND THAT IS NOT AN OVERSIGHT ────────
 * `opts.plan` chooses when OUR invoice stops; a relative's dues enrolment is always stopped at
 * once. The asymmetry is the right way round: the family bought their term and nothing is
 * refunded, whereas a member's next dues charge is money they have not yet paid into a treasury
 * nobody can open. Waiting a month to stop that would be charging somebody for a family that is
 * switched off.
 */
export async function cancelEveryFamilySubscription(
  admin: ReturnType<typeof createAdminClient>,
  familyCode: string,
  opts: { plan: PlanCancellation },
): Promise<FamilySubscriptionCancellation> {
  const dues = await cancelFamilyDuesAutopay(admin, familyCode)
  if (!dues.ok) {
    return { ok: false, duesCancelled: dues.cancelled, platformCancelled: false, failure: dues.failure }
  }

  const plan = await cancelFamilyPlan(admin, familyCode, opts.plan)
  if (!plan.ok) {
    return { ok: false, duesCancelled: dues.cancelled, platformCancelled: false, failure: plan.failure }
  }

  return { ok: true, duesCancelled: dues.cancelled, platformCancelled: plan.cancelled > 0 }
}
