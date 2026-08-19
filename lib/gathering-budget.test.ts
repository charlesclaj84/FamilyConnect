import { describe, expect, it } from 'vitest'
import { gatheringBudgetMath, type GatheringBudgetInput, type GatheringBudgetMath } from './gathering-budget'

/**
 * A gathering's budget against its task lines and against the fund behind it.
 *
 * WHY THESE TESTS EXIST: this module decides when a family sees a red line, and it has to be
 * wrong in neither direction. Missing a real overrun is a reunion that runs out of money;
 * drawing one that is not there is an alarm on a healthy fund — and the second is easier to
 * ship, because the state that causes it is "the caller may not see the balance", which
 * arrives as `null` and reads as zero to anything that does not say otherwise.
 *
 * Every input is a parameter and none of them is a clock, so all of it is runnable
 * (AGENTS.md §7b).
 *
 * ── CHECKED BY MUTATION, per AGENTS.md §7b ──────────────────────────────────────────
 * A green run is not evidence until it has been seen to fail. Nine mutations of
 * `lib/gathering-budget.ts`, each run with `npx vitest run lib/gathering-budget.test.ts`;
 * observed results, not expected. Every one of them tripped:
 *
 *   the null-balance guard removed — `fundBalanceCents ?? 0`, so an unseen balance is zero
 *      2 failed — "an UNSEEN balance is never an overrun" and "no fund at all is never an
 *      overrun either". This is the mutation that matters most: it is the version that paints
 *      `--destructive` across the band for every member who cannot see the family's money, on
 *      a fund that is perfectly healthy.
 *   the null-budget guard removed, so an unset budget compares as 0
 *      1 failed — "is over nothing at all".
 *   `Math.max(0, …)` dropped from `overFundByCents`
 *      3 failed — the whole-shape case, the two-gatherings case and "every reported overrun
 *      is a magnitude, never a negative". The figure came back negative, which a screen
 *      prints straight after the word "over".
 *   `Math.max(0, …)` dropped from `overAllocatedByCents`
 *      2 failed — the whole-shape case and the same magnitude assertion.
 *   `claimCents(line) ?? 0` -> `claimCents(line) ?? budget`, i.e. a null line reading as the
 *   whole budget
 *      3 failed — the whole-shape case, "a task with no budget line contributes nothing" and
 *      "an UNSEEN balance is never an overrun".
 *   `overFundWithOthers` computed without `otherCommitted`
 *      1 failed — "reports the joint claim separately from this gathering's own".
 *   `Math.round` dropped from `claimCents`
 *      1 failed — "every figure is whole cents", which is what stops
 *      "$1,204.9950000000001" reaching a treasurer's screen.
 *   `fundBalanceCents` clamped at 0 alongside the claims
 *      1 failed — "an overdrawn fund is over before the gathering costs a penny". The flag
 *      does not move (any positive budget is already over a zero balance); the SHORTFALL
 *      does, and it is what the family actually has to find.
 *   `unallocatedCents` clamped at 0 like the magnitudes
 *      1 failed — "reports a negative unallocated figure when the lines exceed the budget".
 *      That field's sign is its meaning, and this is the assertion that says so.
 */

/** A gathering with a $5,000 budget on a fund holding $8,000. The healthy baseline. */
const HEALTHY: GatheringBudgetInput = {
  budgetCents: 500_000,
  lineCents: [200_000, 100_000, null],
  fundBalanceCents: 800_000,
  otherCommittedCents: 0,
}

const math = (over: Partial<GatheringBudgetInput> = {}): GatheringBudgetMath =>
  gatheringBudgetMath({ ...HEALTHY, ...over })

describe('the healthy case', () => {
  it('reports the whole shape with nothing over', () => {
    expect(math()).toEqual({
      budgetCents: 500_000,
      linesTotalCents: 300_000,
      unallocatedCents: 200_000,
      overAllocated: false,
      overAllocatedByCents: 0,
      fundBalanceCents: 800_000,
      totalCommittedCents: 500_000,
      overFund: false,
      overFundByCents: 0,
      overFundWithOthers: false,
      overFundWithOthersByCents: 0,
    })
  })

  it('a task with no budget line contributes nothing', () => {
    // A null line is "no budget on that task", never "unknown". There is no unknown state:
    // the band is fetched or it is not (AGENTS.md §5), and a task either costs the family
    // something or it does not.
    expect(math({ lineCents: [200_000, null, null, null] }).linesTotalCents).toBe(200_000)
    expect(math({ lineCents: [null, null] }).linesTotalCents).toBe(0)
    expect(math({ lineCents: [] }).linesTotalCents).toBe(0)
  })
})

describe('a budget that is not set', () => {
  it('is over nothing at all', () => {
    // Every gathering starts here. Comparing an unset budget against a balance would paint a
    // red line on every gathering in the family from the moment it was scheduled.
    const m = math({ budgetCents: null, fundBalanceCents: 0, otherCommittedCents: 900_000 })
    expect(m.budgetCents).toBeNull()
    expect(m.unallocatedCents).toBeNull()
    expect(m.totalCommittedCents).toBeNull()
    expect(m.overAllocated).toBe(false)
    expect(m.overAllocatedByCents).toBe(0)
    expect(m.overFund).toBe(false)
    expect(m.overFundByCents).toBe(0)
    expect(m.overFundWithOthers).toBe(false)
    expect(m.overFundWithOthersByCents).toBe(0)
  })

  it('still totals the lines, because the tasks still cost money', () => {
    expect(math({ budgetCents: null }).linesTotalCents).toBe(300_000)
  })
})

describe('the task lines against the budget', () => {
  it('reports what is left to allocate', () => {
    expect(math({ lineCents: [100_000] }).unallocatedCents).toBe(400_000)
  })

  it('reports a negative unallocated figure when the lines exceed the budget', () => {
    // The ONE field whose sign is its meaning: a screen renders "$1,000 unallocated" or
    // "$1,000 over the budget" from the same number.
    const m = math({ lineCents: [400_000, 200_000] })
    expect(m.unallocatedCents).toBe(-100_000)
    expect(m.overAllocated).toBe(true)
    expect(m.overAllocatedByCents).toBe(100_000)
  })

  it('is not over when the lines exactly fill the budget', () => {
    const m = math({ lineCents: [500_000] })
    expect(m.unallocatedCents).toBe(0)
    expect(m.overAllocated).toBe(false)
    expect(m.overAllocatedByCents).toBe(0)
  })
})

describe('the budget against the fund', () => {
  it('is over the fund when the budget alone exceeds the balance', () => {
    const m = math({ budgetCents: 1_000_000 })
    expect(m.overFund).toBe(true)
    expect(m.overFundByCents).toBe(200_000)
    // The request in one sentence: "the budget amount can exceed the amount of money in the
    // fund and will show as a red line". Nothing refuses it — a family plans a reunion in
    // January and raises the money by June.
    expect(m.budgetCents).toBe(1_000_000)
  })

  it('is not over when the budget exactly equals the balance', () => {
    const m = math({ budgetCents: 800_000 })
    expect(m.overFund).toBe(false)
    expect(m.overFundByCents).toBe(0)
  })

  it('an UNSEEN balance is never an overrun', () => {
    // THE MOST IMPORTANT CASE IN THIS FILE. `null` means "there is no fund" or "the caller
    // may not see the balance", and NOT ENTITLED TO SEE IT IS NOT OVERSPENT. Reading null as
    // 0 would draw the alarm for every member without `family-finances:view`, on a fund that
    // is perfectly healthy, with nothing on their screen able to explain it.
    const m = math({ fundBalanceCents: null, budgetCents: 5_000_000 })
    expect(m.fundBalanceCents).toBeNull()
    expect(m.overFund).toBe(false)
    expect(m.overFundByCents).toBe(0)
    expect(m.overFundWithOthers).toBe(false)
    expect(m.overFundWithOthersByCents).toBe(0)
    // ...and the figures that do not depend on the fund are still reported.
    expect(m.linesTotalCents).toBe(300_000)
    expect(m.totalCommittedCents).toBe(5_000_000)
  })

  it('no fund at all is never an overrun either', () => {
    // `gatherings_budget_needs_fund` makes this unreachable through the form, and the same
    // null arrives whenever the balance is withheld — which is why one branch answers both.
    expect(math({ fundBalanceCents: null, otherCommittedCents: 0 }).overFund).toBe(false)
  })

  it('an overdrawn fund is over before the gathering costs a penny', () => {
    // The balance is the one figure NOT clamped at zero: `fund_balance_cents` subtracts
    // disbursements and transfers out, so a fund really can be negative, and clamping it
    // would report the shortfall as smaller than it is.
    const m = math({ fundBalanceCents: -50_000, budgetCents: 100_000 })
    expect(m.fundBalanceCents).toBe(-50_000)
    expect(m.overFund).toBe(true)
    expect(m.overFundByCents).toBe(150_000)
  })
})

describe('two gatherings on one fund', () => {
  it('reports the joint claim separately from this gathering’s own', () => {
    // `fund_id` has no unique index and that is deliberate: several gatherings legitimately
    // draw on one Family Reunion fund. So there are two sentences to say, and a screen
    // showing only the second would tell an organizer their own reunion was fine when the
    // fund cannot cover both.
    const m = math({ budgetCents: 500_000, fundBalanceCents: 800_000, otherCommittedCents: 400_000 })
    expect(m.overFund).toBe(false)
    expect(m.overFundByCents).toBe(0)
    expect(m.totalCommittedCents).toBe(900_000)
    expect(m.overFundWithOthers).toBe(true)
    expect(m.overFundWithOthersByCents).toBe(100_000)
  })

  it('counts nothing when the other commitments are unknown', () => {
    // `otherCommittedCents` is 0 for "unknown", so an unresolved figure never invents a
    // shortfall — the same direction as the null balance above.
    const m = math({ otherCommittedCents: 0 })
    expect(m.totalCommittedCents).toBe(500_000)
    expect(m.overFundWithOthers).toBe(false)
  })
})

describe('the invariants every figure keeps', () => {
  const CASES: GatheringBudgetInput[] = [
    HEALTHY,
    { budgetCents: null, lineCents: [null], fundBalanceCents: null, otherCommittedCents: 0 },
    { budgetCents: 1_000_000, lineCents: [900_000, 300_000], fundBalanceCents: 10, otherCommittedCents: 700_000 },
    { budgetCents: 0, lineCents: [], fundBalanceCents: 0, otherCommittedCents: 0 },
    { budgetCents: 999, lineCents: [1, 2, 3], fundBalanceCents: -1, otherCommittedCents: 1 },
  ]

  it('every reported overrun is a magnitude, never a negative', () => {
    // A screen prints these straight after the word "over", so "over -$450" is the failure
    // this pins. `unallocatedCents` is the deliberate exception and is asserted above.
    for (const input of CASES) {
      const m = gatheringBudgetMath(input)
      expect(m.overAllocatedByCents).toBeGreaterThanOrEqual(0)
      expect(m.overFundByCents).toBeGreaterThanOrEqual(0)
      expect(m.overFundWithOthersByCents).toBeGreaterThanOrEqual(0)
      expect(m.linesTotalCents).toBeGreaterThanOrEqual(0)
    }
  })

  it('a flag and its figure never disagree', () => {
    for (const input of CASES) {
      const m = gatheringBudgetMath(input)
      expect(m.overAllocated).toBe(m.overAllocatedByCents > 0)
      expect(m.overFund).toBe(m.overFundByCents > 0)
      expect(m.overFundWithOthers).toBe(m.overFundWithOthersByCents > 0)
    }
  })

  it('every figure is whole cents', () => {
    // One fractional cent turns `formatCurrency` into "$1,204.9950000000001" on the screen a
    // treasurer is reading, so rounding happens once on the way in rather than at each of the
    // eleven places a figure leaves.
    const m = gatheringBudgetMath({
      budgetCents: 500_000.4,
      lineCents: [100_000.5, 99.5, null],
      fundBalanceCents: 800_000.6,
      otherCommittedCents: 0.4,
    })
    for (const value of [
      m.budgetCents, m.linesTotalCents, m.unallocatedCents, m.overAllocatedByCents,
      m.fundBalanceCents, m.totalCommittedCents, m.overFundByCents, m.overFundWithOthersByCents,
    ]) {
      if (value !== null) expect(Number.isInteger(value)).toBe(true)
    }
  })

  it('reads a nonsense figure as no figure rather than propagating it', () => {
    // NaN is the dangerous one: it survives every `>` comparison as false, propagates
    // silently through every sum, and renders as "$NaN".
    const m = gatheringBudgetMath({
      budgetCents: Number.NaN,
      lineCents: [Number.NaN, 100, Number.POSITIVE_INFINITY],
      fundBalanceCents: Number.NaN,
      otherCommittedCents: Number.NaN,
    })
    expect(m.budgetCents).toBeNull()
    expect(m.fundBalanceCents).toBeNull()
    expect(m.linesTotalCents).toBe(100)
    expect(m.overFund).toBe(false)
  })

  it('reads a negative claim as zero, as the columns already CHECK', () => {
    const m = gatheringBudgetMath({
      budgetCents: -500_000,
      lineCents: [-100_000, 50_000],
      fundBalanceCents: 800_000,
      otherCommittedCents: -1,
    })
    expect(m.budgetCents).toBe(0)
    expect(m.linesTotalCents).toBe(50_000)
    expect(m.totalCommittedCents).toBe(0)
    expect(m.overAllocated).toBe(true)   // 50,000 of lines against a budget of nothing
  })
})
