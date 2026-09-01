import 'server-only'

import { createAdminClient } from '@/lib/supabase/admin'
import { onAccount, stripeClient } from '@/lib/stripe/client'
import { stripeAlreadyStopped } from '@/lib/stripe/cancel-family'

/**
 * The charges behind a purge, which SQL structurally cannot stop.
 *
 * ── WHY IT IS NOT IN THE SWEEP ─────────────────────────────────────────────────────
 * `reapPurgedStorage`'s argument, one ledger over. `delete_family_data_above_tier` deletes
 * `dues_autopay` at `standard`, so a family dropped to Free on day 60 lost the only record it
 * had of every relative's standing card arrangement — **and every one of those went on charging
 * a card, monthly, with nothing left in the product able to say what the charge was for.**
 * `pg_cron` has no network and cannot call Stripe, so this rides the notice-drain path, which is
 * the one place in this product where Node runs on a clock with the service key.
 *
 * ── AND WHY IT IS A QUEUE RATHER THAN A SUBTRACTION ────────────────────────────────
 * This is the one real difference from the storage reaper and it is worth understanding before
 * changing anything. That one works out what to delete AFTER the purge, by listing the bucket
 * and subtracting the rows that survived. **There is no equivalent here.** Once `dues_autopay`
 * is gone, nothing in this database names those subscriptions and no question can be put to
 * Stripe that would recover which family they belonged to.
 *
 * So `20260901000008` has the purge CAPTURE the ids before it deletes them, into
 * `platform_subscription_cancellations`, and this drains that queue. Which means:
 *
 *   * **the dangerous shape is inverted.** The storage reaper's hazard is a failed READ making
 *     every object look like an orphan; its whole header is about that. Here the queue is an
 *     explicit list somebody's own purge wrote, so a failed read stops this function and costs
 *     nothing. There is no inference to get wrong.
 *   * **but a row that never drains is a charge that never stops.** So a failure must never be
 *     filed as done — `finish_subscription_cancellation` returns it to `pending` for five days
 *     and then marks it `failed`, which is a state a person has to look at.
 *
 * ── `gone` IS NOT `cancelled`, AND BOTH ARE SUCCESS ────────────────────────────────
 * Stripe no longer having the subscription, or already having it as cancelled, is the outcome
 * we wanted. It is recorded apart because "we stopped forty charges" and "thirty-eight were
 * already stopped" are different sentences, and a family asking what happened to their
 * relatives' payments deserves the true one. `stripeAlreadyStopped` is the single definition of
 * which errors mean that, shared with `lib/stripe/cancel-family.ts`.
 *
 * ── IT CLAIMS NOTHING WITHOUT A STRIPE CLIENT ──────────────────────────────────────
 * The claim increments `attempts`, so claiming on a deployment that cannot possibly cancel
 * anything would burn all five and mark live subscriptions `failed` — the queue defeating
 * itself. Checked before the claim, deliberately.
 */

/**
 * How many to drain per run. `claim_platform_billing_notices`' figure and its reasons: the
 * platform has a wall-clock ceiling on a request, and Stripe has a rate limit. Twenty-five
 * cancellations is well inside both, and a backlog drains over consecutive days — which is
 * acceptable here only because the queue is the thing that makes the work durable.
 */
const PER_RUN = 25

export interface SubscriptionReapResult {
  /** Rows claimed for an attempt. */
  claimed: number
  /** Subscriptions this run actually stopped. */
  cancelled: number
  /** Subscriptions Stripe had already stopped, or no longer has. Also success. */
  alreadyGone: number
  /** Attempts that failed. A row is only `failed` once five of them are spent. */
  failed: number
}

interface ClaimedCancellation {
  id: string
  family_code: string
  stripe_account_id: string
  stripe_subscription_id: string
  kind: string
  attempts: number
}

function describe(e: unknown): string {
  if (e instanceof Error) return e.message
  return typeof e === 'string' ? e : 'unknown error'
}

export async function reapPurgedSubscriptions(): Promise<SubscriptionReapResult> {
  const empty: SubscriptionReapResult = { claimed: 0, cancelled: 0, alreadyGone: 0, failed: 0 }

  const stripe = stripeClient()
  if (!stripe) {
    // Not an error and not silent. A deployment with no key cannot cancel anything, and the
    // queue must keep the work rather than spending its attempts on it — see the header.
    console.warn('[subscription-reaper] no Stripe key on this deployment; the queue was not claimed')
    return empty
  }

  const admin = createAdminClient()

  const { data: claimed, error } = await admin
    .rpc('claim_subscription_cancellations', { p_limit: PER_RUN })

  // §8: `const { data }` discards the error and answers `[]`, which here would mean "the queue
  // is empty" — indistinguishable from a drain that worked, on a queue whose backlog is live
  // charges. Reported, and the route's own log is what a person sees.
  if (error) {
    console.error(`[subscription-reaper] could not claim the queue: ${error.message}`)
    return empty
  }

  const rows = (claimed ?? []) as ClaimedCancellation[]
  if (rows.length === 0) return empty

  const result: SubscriptionReapResult = { claimed: rows.length, cancelled: 0, alreadyGone: 0, failed: 0 }

  for (const row of rows) {
    let state: 'cancelled' | 'gone' | 'failed' = 'cancelled'
    let note: string | null = null

    try {
      // `Stripe-Account`, because a dues subscription lives on the FAMILY's connected account
      // and never on ours — the distinction the `kind` column exists to carry, and the one
      // mistake in this feature that would look like a working integration. `onAccount` is the
      // only place that header is set anywhere in the product.
      await stripe.subscriptions.cancel(row.stripe_subscription_id, undefined,
        onAccount(row.stripe_account_id))
    } catch (e) {
      const message = describe(e)
      if (stripeAlreadyStopped(message)) {
        state = 'gone'
        note = message
      } else {
        state = 'failed'
        note = message
        console.error(
          `[subscription-reaper] ${row.family_code}: could not cancel `
          + `${row.stripe_subscription_id} on ${row.stripe_account_id} `
          + `(attempt ${row.attempts}): ${message}`,
        )
      }
    }

    const { error: finishError } = await admin.rpc('finish_subscription_cancellation', {
      p_id: row.id, p_state: state, p_note: note,
    })
    // A cancellation that landed and could not be recorded is the one case worth a loud line:
    // the charge HAS stopped, and the stale-claim window will hand the row to tomorrow's run,
    // which will find Stripe no longer has it and file it as `gone`. So it self-heals, and the
    // log is what explains a `gone` that should have been a `cancelled`.
    if (finishError) {
      console.error(
        `[subscription-reaper] ${row.family_code}: ${row.stripe_subscription_id} is ${state} `
        + `and could not be recorded: ${finishError.message}`,
      )
    }

    if (state === 'cancelled') result.cancelled += 1
    else if (state === 'gone') result.alreadyGone += 1
    else result.failed += 1
  }

  return result
}
