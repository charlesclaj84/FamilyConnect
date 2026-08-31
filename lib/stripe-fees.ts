/**
 * The arithmetic of a card processing fee: what to charge, and how to divide what was taken.
 *
 * ── WHY THIS IS A PURE MODULE AND NOT PART OF THE WEBHOOK ───────────────────────────
 * AGENTS.md §7b: money and rounding are exactly the "real edge cases" `npm test` exists to
 * reach, and none of the three functions here can be exercised through `tests/rls` — that
 * suite calls actions against real policies and cannot check a figure. Everything below takes
 * its inputs as ARGUMENTS, including the rate, so there is nothing to read from the world and
 * nothing to stub.
 *
 * It sits at `lib/` rather than in `lib/stripe/` deliberately: every file in that directory
 * either imports the Stripe SDK or is about a webhook, and this one must stay importable from
 * a client component that is quoting a member a figure before they press Pay.
 *
 * ── THE ONE DISTINCTION THE WHOLE FILE RESTS ON ─────────────────────────────────────
 * There are TWO fee numbers in this feature and they are never the same thing:
 *
 *   ESTIMATED  what `feeOnCents` computes from the family's STATED rate. Used to decide what
 *              to charge before Stripe has seen the card. It is a forecast.
 *   ACTUAL     what Stripe's `balance_transaction.fee` says after the charge settled. It is a
 *              measured fact and it is what the ledger records.
 *
 * They differ whenever the card is not what the stated rate assumed — an international card,
 * an Amex, a currency conversion, or a rate the family has negotiated and not typed in. THE
 * DIFFERENCE IS ABSORBED BY THE FAMILY AND IS NEVER RECONCILED BACK TO THE MEMBER, because
 * the alternative is billing somebody a second time for a charge they have already completed,
 * for an amount nobody could have quoted them. That is a product decision and it is why
 * `grossUpCents` is documented as a quote rather than as a calculation of the fee.
 *
 * Never store an estimate in a column whose name says `fee`. `dues_payment_fees.fee_cents` is
 * the actual, and a row exists there only once Stripe has told us.
 */

/**
 * A processing rate, as a family states it.
 *
 * BASIS POINTS, not a float. `2.9%` is `290`, and the reason is the reason money is in cents
 * everywhere else in this product: `0.029` cannot be represented exactly, and a rate that is
 * a hair under what was intended silently under-charges every grossed-up payment forever.
 */
export interface FeeRate {
  /** The percentage part, in basis points. 290 = 2.9%. */
  percentBps: number
  /** The flat part, in cents. 30 = $0.30. */
  fixedCents: number
}

/**
 * Stripe's standard US card rate, and the DEFAULT a family starts on.
 *
 * A DEFAULT SOMEBODY CAN CHANGE, never a constant the code assumes. It is right for a US
 * family taking domestic cards and wrong for several ordinary cases — Stripe charges more for
 * an international card and for currency conversion — which is exactly why the rate is a
 * column on `family_stripe_accounts` rather than a literal here. A hardcoded rate would be a
 * figure describing nothing, which is the `is_minor` trap (AGENTS.md §4b) wearing a dollar
 * sign: plausible, unowned, and wrong the first time a family's circumstances differ.
 *
 * It is used for the QUOTE only. Nothing that reaches the ledger is derived from it.
 */
export const DEFAULT_FEE_RATE: FeeRate = { percentBps: 290, fixedCents: 30 }

/**
 * What the stated rate says a charge of `grossCents` will cost.
 *
 * `Math.round` on the percentage part because that is what Stripe does to a fractional cent,
 * and the two must agree or a grossed-up charge lands a cent under what was owed — which,
 * on a schedule the member is trying to clear, leaves a balance of one cent that they cannot
 * pay (Stripe refuses a charge below its own minimum) and that nothing will ever clear.
 *
 * ZERO AND BELOW ANSWER ZERO rather than the flat 30c. There is no charge, so there is no fee;
 * returning the fixed part for a nil charge would make `grossUpCents(0)` quote 31 cents for
 * settling nothing.
 */
export function feeOnCents(grossCents: number, rate: FeeRate): number {
  if (grossCents <= 0) return 0
  return Math.round((grossCents * rate.percentBps) / 10_000) + rate.fixedCents
}

/**
 * What to charge so that `owedCents` actually arrives, once the fee has come out.
 *
 * ── SOLVED, THEN CORRECTED IN BOTH DIRECTIONS ───────────────────────────────────────
 * Algebraically `gross = (owed + fixed) / (1 - p)`, and the ceiling of that is close. It is
 * not the answer, because `feeOnCents` ROUNDS the percentage and the algebra does not know it:
 *
 *   • Sometimes the rounded fee is a cent MORE than the algebra assumed, and the ceiling lands
 *     the family a cent short. A single cent short is not a rounding nicety — it leaves a
 *     residue the member cannot clear, because Stripe refuses a charge below its own minimum.
 *   • Sometimes it is a cent LESS, and the ceiling overshoots. $40.00 at 2.9% + 30c is the
 *     worked example and it was found by the minimality test rather than by reading: the
 *     closed form gives 4151, and 4150 also clears exactly ($1.50 fee, $40.00 net). Charging
 *     4151 would take a cent from a member for no reason anybody could state.
 *
 * So the closed form is a STARTING POINT: walk up until it clears, then down while one cent
 * less still clears. What is returned satisfies both halves — it clears, and nothing smaller
 * does.
 *
 * Both loops are bounded rather than `while (true)`, so no rate can hang a request. A rate at
 * or above 100% has no fixed point at all — every extra cent charged is entirely eaten — and
 * the honest answer is "cannot be grossed up", which the caller must treat as "the family
 * absorbs it" rather than as a number.
 *
 * Returns null when there is no solution, never a wrong figure.
 */
export function grossUpCents(owedCents: number, rate: FeeRate): number | null {
  if (owedCents <= 0) return null
  // A rate that eats every marginal cent has no fixed point. Refuse rather than iterate.
  if (rate.percentBps >= 10_000) return null

  const clears = (gross: number) => gross - feeOnCents(gross, rate) >= owedCents

  const denominator = 1 - rate.percentBps / 10_000
  let gross = Math.ceil((owedCents + rate.fixedCents) / denominator)

  // Up until it clears. Each cent added to the charge adds at most `percentBps/10000` of a
  // cent to the fee, so the shortfall strictly shrinks and this terminates.
  for (let i = 0; i < 8 && !clears(gross); i++) gross++
  if (!clears(gross)) return null

  // Then down while a cent less would have done. See the header — the ceiling overshoots
  // whenever the rounded fee comes in under what the algebra assumed.
  for (let i = 0; i < 8 && gross - 1 > 0 && clears(gross - 1); i++) gross--

  return gross
}

/**
 * Split `totalCents` across `weights` so the parts sum to EXACTLY `totalCents`.
 *
 * ── WHY LARGEST REMAINDER AND NOT `Math.round` PER PART ─────────────────────────────
 * One card charge can settle several dues — `readAllocations` in the Connect handler is built
 * for exactly that — so one FEE has to be divided over several `dues_payments` rows in order
 * to be reported per schedule. Rounding each share independently does not sum to the total:
 * three equal shares of 100 cents round to 33 each and lose a cent, and that cent then shows
 * up as a permanent disagreement between the fee on the charge and the fees on its rows.
 *
 * Largest remainder gives every part its floor and then hands the leftover cents, one each, to
 * the parts with the largest fractional remainders. The result sums exactly, by construction.
 *
 * ── TIES BREAK BY INDEX, WHICH MAKES IT DETERMINISTIC ───────────────────────────────
 * Two schedules of equal size splitting an odd fee is a tie, and an unstable sort would hand
 * the extra cent to a different one on a redelivery — so a replayed webhook would write
 * different rows from the first delivery. Sorting by remainder DESC then index ASC is a total
 * order, which is what makes this function idempotent for a given input.
 *
 * WEIGHTS THAT SUM TO ZERO get the whole total on the first part. That is a degenerate input
 * (a charge against nothing) and the alternative is dropping the fee silently.
 */
export function apportionCents(totalCents: number, weights: readonly number[]): number[] {
  if (weights.length === 0) return []
  if (weights.length === 1) return [totalCents]

  const safe = weights.map(w => (Number.isFinite(w) && w > 0 ? w : 0))
  const sum = safe.reduce((a, b) => a + b, 0)
  if (sum === 0) return weights.map((_, i) => (i === 0 ? totalCents : 0))

  const exact = safe.map(w => (totalCents * w) / sum)
  const floors = exact.map(Math.floor)
  let remaining = totalCents - floors.reduce((a, b) => a + b, 0)

  const order = exact
    .map((value, index) => ({ index, remainder: value - Math.floor(value) }))
    // Remainder descending, then index ascending — a total order, so a redelivery of the
    // same charge apportions identically. See the header.
    .sort((a, b) => b.remainder - a.remainder || a.index - b.index)

  const out = [...floors]
  for (const { index } of order) {
    if (remaining <= 0) break
    out[index] += 1
    remaining -= 1
  }
  return out
}
