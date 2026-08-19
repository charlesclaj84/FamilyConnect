/**
 * A gathering's money: what it budgeted, what its tasks have claimed of that, and whether
 * either exceeds the fund it draws on.
 *
 * ── WHY THERE IS NO DATABASE CONSTRAINT DOING THIS ──────────────────────────────────
 * Because an over-budget gathering is a state the product must be able to HOLD and SHOW.
 * The requirement is explicit: "the budget amount can exceed the amount of money in the
 * fund and will show as a red line". A trigger refusing it would make the feature
 * impossible — a family plans a $12,000 reunion in January and raises the money by June,
 * and the months in between are exactly when they need the screen to say so. So the
 * database holds `budget_cents >= 0` and `budget_cents IS NULL OR fund_id IS NOT NULL` and
 * nothing else about size, and the comparison lives here where it can be rendered.
 *
 * ── WHY IT IS A PURE MODULE ─────────────────────────────────────────────────────────
 * AGENTS.md §7b. Every figure here is arithmetic over integers and every one of them is a
 * figure a family will argue about, so it is checked by running it rather than by reading
 * it — `lib/gathering-budget.test.ts`. Nothing is fetched, nothing is a clock, and the
 * server action above does the two things this cannot: decide who may ask, and read the
 * four numbers.
 *
 * ── THE MARKER IS `--destructive`, NOT `--brand-withheld` ───────────────────────────
 * Stated here because this module is what decides when the marker appears. An overrun is an
 * error state the family has to act on; `--brand-withheld` is for a capability being
 * withheld from somebody, which is a different thing that merely looks similar (AGENTS.md,
 * "Colours live in one place"). A withheld BALANCE is the `null` case below, and the whole
 * point of that case is that it draws no marker at all.
 */

export interface GatheringBudgetInput {
  /** The gathering's own budget. null = none set. */
  budgetCents: number | null
  /** Every task's budget line on this gathering. A null line is "no budget on that task". */
  lineCents: readonly (number | null)[]
  /** The backing fund's balance, or null when there is no fund or the caller may not see it. */
  fundBalanceCents: number | null
  /** Budgets OTHER live gatherings already draw on the same fund. 0 when unknown. */
  otherCommittedCents: number
}

export interface GatheringBudgetMath {
  budgetCents: number | null
  linesTotalCents: number
  /** budget - lines. Negative means the lines exceed the budget. null when no budget. */
  unallocatedCents: number | null
  /** The task lines together claim more than the gathering budgeted. */
  overAllocated: boolean
  /** How much more, or 0 when it is not over. */
  overAllocatedByCents: number
  fundBalanceCents: number | null
  /** budget + otherCommitted, the whole claim on the fund. null when no budget. */
  totalCommittedCents: number | null
  /** This gathering's budget ALONE exceeds the fund balance. */
  overFund: boolean
  overFundByCents: number
  /** This budget plus what other gatherings already claim exceeds the balance. */
  overFundWithOthers: boolean
  overFundWithOthersByCents: number
}

/**
 * Integer cents, or null.
 *
 * ── WHY EVERY INPUT GOES THROUGH THIS ───────────────────────────────────────────────
 * Two invariants this module promises, and one guard that keeps both:
 *
 *   * NOTHING IT RETURNS IS A FLOAT. Every figure here is added to another and then
 *     rendered as money; one fractional cent arriving from anywhere turns
 *     `formatCurrency` into "$1,204.9950000000001" on the screen a treasurer is reading.
 *     `Math.round` is applied on the way IN, once, rather than at each of the eleven
 *     places a figure leaves.
 *   * A NONSENSE NUMBER CARRIES NO MONEY. `NaN` is the dangerous one: it is not caught by
 *     `> balance`, it propagates silently through every sum, and it renders as "$NaN".
 *     Reading it as "no figure" is the only answer that cannot put a wrong number on a
 *     screen.
 *
 * The `*_cents` columns already CHECK `>= 0`, so a negative arriving here is a value from
 * somewhere other than the column. It is clamped rather than trusted, and only the CLAIMS
 * are: see `fundBalanceCents` below, which is deliberately not.
 */
function claimCents(value: number | null | undefined): number | null {
  if (value == null || !Number.isFinite(value)) return null
  return Math.max(0, Math.round(value))
}

export function gatheringBudgetMath(input: GatheringBudgetInput): GatheringBudgetMath {
  const budget = claimCents(input.budgetCents)

  // A null line is a task with no budget on it, which contributes nothing — NOT a task
  // whose budget is unknown. There is no such state: `budget_cents` is either set or the
  // task costs the family nothing, and a fetch that withheld the lines would withhold the
  // whole band (`gatherings/budget:view`, gated before the fetch per AGENTS.md §5).
  const linesTotalCents = input.lineCents.reduce<number>(
    (sum, line) => sum + (claimCents(line) ?? 0),
    0,
  )

  const otherCommitted = claimCents(input.otherCommittedCents) ?? 0

  // The balance is NOT clamped at zero and NOT rounded away, and it is the one figure here
  // that is allowed to be negative: a fund really can be overdrawn — `fund_balance_cents`
  // subtracts disbursements and transfers out — and a negative balance means every budget
  // drawn on it is over the fund, which is precisely the thing this module exists to say.
  // Clamping it to 0 would report the overrun as smaller than it is.
  const fundBalanceCents = input.fundBalanceCents == null || !Number.isFinite(input.fundBalanceCents)
    ? null
    : Math.round(input.fundBalanceCents)

  // ── The two comparisons, and the two guards that decide whether they happen at all ──
  //
  // A NULL BUDGET IS NEVER OVER ANYTHING. "No budget set" is the state every gathering
  // starts in, and comparing an unset budget against a balance would paint a red line on
  // every gathering in the family from the moment it was scheduled.
  //
  // A NULL BALANCE IS NEVER OVER EITHER, AND THAT IS THE IMPORTANT ONE. Null here means
  // "there is no fund" or "the caller may not see the balance" — and NOT ENTITLED TO SEE
  // IT IS NOT OVERSPENT. Treating an unknown balance as 0 would draw the alarm line for
  // every member who lacks `family-finances:view`, on a fund that is perfectly healthy,
  // and there would be nothing on their screen able to explain it.
  const knowFund = budget !== null && fundBalanceCents !== null

  const overFundByCents = knowFund ? Math.max(0, budget - fundBalanceCents) : 0
  const withOthersByCents = knowFund
    ? Math.max(0, budget + otherCommitted - fundBalanceCents)
    : 0

  return {
    budgetCents: budget,
    linesTotalCents,
    // The ONE field allowed to be negative, because its sign is its meaning: a caller
    // renders "$450 unallocated" or "$450 over the budget" from the same number. Every
    // `*ByCents` beside it is a magnitude and floors at 0, so a screen can print it
    // straight after the word "over" without ever printing "over -$450".
    unallocatedCents: budget === null ? null : budget - linesTotalCents,
    overAllocated: budget !== null && linesTotalCents > budget,
    overAllocatedByCents: budget === null ? 0 : Math.max(0, linesTotalCents - budget),
    fundBalanceCents,
    totalCommittedCents: budget === null ? null : budget + otherCommitted,
    overFund: overFundByCents > 0,
    overFundByCents,
    // Reported separately from `overFund` rather than replacing it, because they are two
    // different sentences to the family: "this gathering costs more than the fund holds"
    // is an overrun of its own, while "this and the others together cost more than the
    // fund holds" is a question about which one goes first. A screen showing only the
    // second would tell an organizer their own reunion was fine when it is not.
    overFundWithOthers: withOthersByCents > 0,
    overFundWithOthersByCents: withOthersByCents,
  }
}
