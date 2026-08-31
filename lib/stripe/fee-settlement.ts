import type Stripe from 'stripe'

import { createAdminClient } from '@/lib/supabase/admin'
import { apportionCents } from '@/lib/stripe-fees'

/**
 * What Stripe actually took, recorded after the fact.
 *
 * ── A SEPARATE MODULE FROM `connect-events.ts`, DELIBERATELY ────────────────────────
 * That file posts MONEY: it decides that a member paid, writes the `dues_payments` rows and
 * sends them down the fund waterfall. This one posts a COST, against payments that already
 * exist, and it can fail without any of that being wrong. Keeping them apart means the money
 * path is not lengthened by a concern that arrives minutes later — and means a reader asking
 * "what credits a member?" does not have to scroll past fee arithmetic to find out.
 *
 * ── IT RUNS AFTER THE MONEY, NEVER INSTEAD OF IT ────────────────────────────────────
 * `onCheckoutSession` has already posted the payment and routed the GROSS, and that ordering
 * is a decision rather than a limitation: `balance_transaction` is not populated when
 * `checkout.session.completed` fires, so a handler that waited for the fee before posting
 * would leave a payment reaching no fund at all whenever a settlement event went missing. An
 * occasional overstatement that corrects itself beats a payment that silently never lands.
 *
 * ── ONLY CHARGES THIS PRODUCT POSTED, WHICH IS THE ONE JUDGEMENT HERE ───────────────
 * A family's connected account is THEIRS. They may take charges on it that have nothing to do
 * with GENORRA — an in-person reader, another integration — and Stripe delivers those here
 * too, because the endpoint is subscribed to the ACCOUNT rather than to our sessions.
 * Recording those fees would put an expense on the family's P&L for income this product never
 * counted, so the statement would show a cost against money it does not know arrived.
 *
 * So: **no matching `dues_payments` row, no fee row.** A charge we did not post is ignored,
 * said so in the detail, and answered `handled` — it is not an error and must not be
 * redelivered.
 *
 * ── IDEMPOTENT THREE TIMES OVER, BECAUSE IT HAS TO BE ───────────────────────────────
 * `charge.succeeded` and `charge.updated` BOTH land here on purpose — the balance transaction
 * can be absent on the first and present on the second — so running twice for one charge is
 * the ORDINARY case, not the exceptional one. Stripe's redelivery is on top of that.
 *
 *   1. `stripe_charge_fees.charge_id` is UNIQUE, so a second insert is 23505 and stops here.
 *   2. `dues_payment_fees.payment_id` is UNIQUE, so a share cannot be written twice.
 *   3. The fund corrections are written only on the run that WON the insert at (1).
 *
 * The claim at (1) therefore comes FIRST, before any apportionment. Writing the shares first
 * and claiming the charge afterwards would double the fund corrections on a redelivery, and a
 * duplicated correction takes real money out of a family's funds. Same reasoning as
 * `claim_stripe_event` and `claim_distribution_recipients`: claim, then act.
 */

type AdminClient = ReturnType<typeof createAdminClient>

export interface SettlementOutcome {
  handled: boolean
  detail: string
}

/**
 * Record a settled charge's real fee, apportion it across the dues it paid, and take it back
 * out of the funds those payments were routed into.
 */
export async function settleChargeFee(
  admin: AdminClient,
  familyCode: string,
  accountId: string,
  charge: Stripe.Charge,
): Promise<SettlementOutcome> {
  if (charge.status !== 'succeeded') {
    return { handled: true, detail: `charge ${charge.id} is ${charge.status}` }
  }

  // ── THE BALANCE TRANSACTION, THE ONLY PLACE THE REAL FEE LIVES ───────────────────
  // Expanded on the event sometimes and a bare id otherwise. A bare id is deliberately NOT
  // fetched: that would be an outbound Stripe call inside a webhook handler, and a failure
  // would force the whole event to be redelivered — for a figure the next `charge.updated`
  // carries expanded anyway. A handler that makes no outbound call cannot time out against
  // Stripe's own delivery deadline, which is the property worth keeping on this path.
  const txn = typeof charge.balance_transaction === 'object' ? charge.balance_transaction : null
  if (!txn) {
    return { handled: true, detail: `charge ${charge.id} has not settled yet` }
  }

  const feeCents = txn.fee ?? 0
  if (feeCents <= 0) {
    return { handled: true, detail: `charge ${charge.id} cost nothing to process` }
  }

  // ── THE ROWS THIS CHARGE PAID ────────────────────────────────────────────────────
  // `processor_ref` is the bare charge id for a single due and `<charge>#<scheduleId>` for
  // each row of a combined payment — see `postDuesPayment`. Both shapes are matched.
  //
  // §3 BY HAND, and stated even though `(source, processor_ref)` is unique: that uniqueness
  // spans the whole product, so without the conjunct this function could count another
  // family's row. The pattern is escaped because a charge id reaches this string — see below.
  const { data: paymentRows, error: paymentsError } = await admin
    .from('dues_payments')
    .select('id, amount_cents')
    .eq('family_code', familyCode)
    .eq('source', 'stripe')
    .or(`processor_ref.eq.${charge.id},processor_ref.like.${likePrefix(charge.id)}`)

  // §8: `data` alone cannot tell a refused query from no rows, and here that difference
  // decides whether a fee is recorded or dropped on the floor. A failure must be redelivered.
  if (paymentsError) {
    return { handled: false, detail: `could not read payments for ${charge.id}: ${paymentsError.message}` }
  }
  const payments = paymentRows ?? []
  if (payments.length === 0) {
    return { handled: true, detail: `charge ${charge.id} posted no dues in ${familyCode}` }
  }

  // ── 1. CLAIM THE CHARGE ──────────────────────────────────────────────────────────
  const { data: feeRow, error: feeError } = await admin
    .from('stripe_charge_fees')
    .insert({
      family_code: familyCode,
      stripe_account_id: accountId,
      charge_id: charge.id,
      balance_transaction_id: txn.id,
      gross_cents: txn.amount,
      fee_cents: feeCents,
      // WHAT THE BALANCE TRANSACTION SAID, never `amount - fee`. The identity holds for a card
      // charge and stops holding the moment a balance transaction nets anything else out; this
      // column records the fact rather than this file's assumption. See the migration.
      net_cents: txn.net,
      currency: txn.currency,
      available_on: txn.available_on ? isoDate(txn.available_on) : null,
    })
    .select('id')
    .single()

  if (feeError) {
    // 23505 on `charge_id`: already recorded. The ORDINARY path, not an error — both charge
    // events arrive for one charge.
    if (feeError.code === '23505') {
      return { handled: true, detail: `fee for ${charge.id} was already recorded` }
    }
    return { handled: false, detail: `could not record the fee for ${charge.id}: ${feeError.message}` }
  }

  // ── 2. EACH DUE'S SHARE ──────────────────────────────────────────────────────────
  // Largest remainder, so the shares sum to the fee EXACTLY. Sorted by id first because
  // PostgREST promises no row order, and an unordered input would hand the odd cent to a
  // different due on a replay — which `apportionCents` is explicitly written to make
  // deterministic and which this call site would otherwise undo.
  const ordered = [...payments].sort((a, b) => String(a.id).localeCompare(String(b.id)))
  const shares = apportionCents(feeCents, ordered.map(p => Number(p.amount_cents) || 0))

  const { error: sharesError } = await admin.from('dues_payment_fees').insert(
    ordered.map((p, i) => ({
      family_code: familyCode,
      payment_id: p.id as string,
      charge_fee_id: feeRow.id as string,
      fee_cents: shares[i],
    })),
  )
  // 23505 means a previous run got this far; the shares are already right and identical,
  // because the apportionment is deterministic for the same input.
  if (sharesError && sharesError.code !== '23505') {
    return { handled: false, detail: `could not apportion the fee for ${charge.id}: ${sharesError.message}` }
  }

  // ── 3. TAKE IT BACK OUT OF THE FUNDS ─────────────────────────────────────────────
  const corrected = await removeFeeFromFunds(admin, {
    familyCode,
    paymentIds: ordered.map(p => p.id as string),
    feeCents,
    chargeId: charge.id,
    onDate: charge.created ? isoDate(charge.created) : today(),
  })

  return {
    handled: true,
    detail: `${familyCode}: ${feeCents}c fee on ${charge.id} across ${ordered.length} due(s); ${corrected}`,
  }
}

/**
 * Remove a fee from the funds its payment was routed into, as negative `fund_contributions`.
 *
 * ── MIRROR ROWS, NOT A SMALLER ROUTING ──────────────────────────────────────────────
 * The routing already happened with the gross and `dues_payments.routed_at` is stamped, so
 * there is nothing left to route differently. What is left is moving the fee back out — which
 * is exactly the shape `20260806000003` built for a reversal: a negative row carrying its own
 * `source`, mirroring the positive one it corrects.
 *
 * Re-using that shape is what keeps this change small. `fund_balance_cents()` sums
 * contributions and needs no new term, so every fund screen, the routing table and the P&L's
 * fund section are correct with no edit — a negative contribution is already something they
 * know how to add up.
 *
 * ── APPORTIONED BY WHERE THE MONEY WENT, NOT BY FUND PRIORITY ───────────────────────
 * The waterfall may have filled one fund to its minimum and sent the remainder to the next, so
 * the split across funds is whatever `dues_routing` actually wrote. Reading those rows back
 * and apportioning against THEM is the only way the correction lands where the money did.
 *
 * ── A FAILURE HERE IS REPORTED, NOT RETRIED, AND THAT IS A DECISION ─────────────────
 * The fee is recorded by the time this runs, so the P&L is already right; only the fund
 * balances would be overstated. Answering `handled: false` would have Stripe redeliver — and
 * the redelivery would hit the 23505 on `stripe_charge_fees` and return early WITHOUT reaching
 * this, so the retry could never fix it and would replay the event forever. It says what
 * happened in the detail string instead, which is what the webhook log is for.
 */
async function removeFeeFromFunds(
  admin: AdminClient,
  input: {
    familyCode: string
    paymentIds: string[]
    feeCents: number
    chargeId: string
    onDate: string
  },
): Promise<string> {
  // TRANSITIVE scoping (§3): `paymentIds` came out of a read that stated `family_code`, and
  // this read states it again rather than relying on that.
  const { data: routed, error } = await admin
    .from('fund_contributions')
    .select('fund_id, amount_cents')
    .eq('family_code', input.familyCode)
    .eq('source', 'dues_routing')
    .in('dues_payment_id', input.paymentIds)

  if (error) return `funds not corrected: ${error.message}`
  if (!routed || routed.length === 0) return 'nothing was routed, so no fund correction'

  // Several dues can route into the same fund, so shares are SUMMED PER FUND before the fee is
  // divided. Apportioning row by row instead would give one fund several small negative rows
  // that each round on their own, and their total would drift from the fee by a cent or two.
  const byFund = new Map<string, number>()
  for (const row of routed) {
    const id = row.fund_id as string
    byFund.set(id, (byFund.get(id) ?? 0) + (Number(row.amount_cents) || 0))
  }

  const fundIds = [...byFund.keys()].sort()
  const shares = apportionCents(input.feeCents, fundIds.map(id => byFund.get(id) ?? 0))

  const rows = fundIds
    .map((fundId, i) => ({
      fund_id: fundId,
      family_code: input.familyCode,
      // NEGATIVE, which `fund_contributions_amount_sign` admits for exactly two sources.
      amount_cents: -shares[i],
      source: 'stripe_fee',
      contributed_date: input.onDate,
      // NO `dues_payment_id`. This row corrects a FUND for a CHARGE, and a charge can span
      // several payments — pointing it at one of them would attribute the whole fee to that
      // one due in every screen that groups contributions by payment.
      dues_payment_id: null,
      recorded_by: null,
      notes: `Stripe processing fee on ${input.chargeId}`,
    }))
    // A fund whose share rounded to nothing gets no row. A $0.00 contribution is a line in the
    // family's fund history saying that nothing happened.
    .filter(r => r.amount_cents !== 0)

  if (rows.length === 0) return 'the fee rounded to nothing in every fund'

  const { error: insertError } = await admin.from('fund_contributions').insert(rows)
  if (insertError) return `funds not corrected: ${insertError.message}`

  return `${rows.length} fund(s) corrected`
}

/**
 * The `like` pattern for a combined payment's refs, with PostgREST's wildcards escaped.
 *
 * A charge id is Stripe's (`ch_…`, `pi_…`) and contains none of these today — but this string
 * is interpolated into a filter, and `audit:family-scope`'s own header names an interpolated
 * query as one of the three things it cannot see. Escaping is what makes that irrelevant here
 * rather than something to re-check whenever Stripe changes an id format.
 */
function likePrefix(chargeId: string): string {
  return `${chargeId.replace(/([%_\\])/g, '\\$1')}#%`
}

function isoDate(seconds: number): string {
  return new Date(seconds * 1000).toISOString().slice(0, 10)
}

function today(): string {
  return new Date().toISOString().slice(0, 10)
}
