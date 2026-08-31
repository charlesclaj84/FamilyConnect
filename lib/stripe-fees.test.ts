import { describe, expect, it } from 'vitest'

import {
  DEFAULT_FEE_RATE, apportionCents, feeOnCents, grossUpCents, type FeeRate,
} from '@/lib/stripe-fees'

/**
 * MUTATION-CHECKED, which AGENTS.md §7b requires before a green run counts as evidence.
 * Each mutation below was actually applied and the run actually watched:
 *
 *   • truncate instead of rounding in `feeOnCents` ............ 1 red
 *   • drop the DOWN correction in `grossUpCents` .............. 1 red  (see below)
 *   • `if (grossCents < 0)`, so a nil charge costs the flat 30c  1 red
 *   • break the apportion tie by index DESC ................... 2 red
 *   • `exact.map(Math.round)` instead of `Math.floor` ......... 1 red  (see below)
 *
 * TWO OF THOSE FIVE ARE HERE BECAUSE THEY FAILED TO GO RED FIRST, which is the whole reason
 * the rule says to run the mutation rather than reason about it:
 *
 *   • The minimality case was written expecting to confirm the closed form and instead FOUND
 *     A BUG — `grossUpCents(4000)` returned 4151 when 4150 clears exactly. The down-correction
 *     loop exists because of that failure.
 *   • The round-per-part mutation was CLAIMED in this header and then measured green: none of
 *     the original cases distinguished rounding from largest-remainder, because rounding only
 *     misbehaves when the parts round UP and overshoot. `does not OVERSHOOT` is that case, and
 *     it was added after the mutation passed rather than before.
 */

const US = DEFAULT_FEE_RATE                                  // 2.9% + 30c
const INTL: FeeRate = { percentBps: 390, fixedCents: 30 }    // a dearer card
const FLAT: FeeRate = { percentBps: 0, fixedCents: 25 }      // fixed-only
const FREE: FeeRate = { percentBps: 0, fixedCents: 0 }

describe('feeOnCents', () => {
  it('is the worked example from the product conversation', () => {
    // $40.00 at 2.9% + 30c = $1.46, netting $38.54.
    expect(feeOnCents(4000, US)).toBe(146)
    expect(4000 - feeOnCents(4000, US)).toBe(3854)
  })

  it('rounds the percentage rather than truncating it', () => {
    // 2.9% of 4050 is 117.45 -> 117. Truncating agrees here...
    expect(feeOnCents(4050, US)).toBe(147)
    // ...and 2.9% of 1950 is 56.55 -> 57, where it does not.
    expect(feeOnCents(1950, US)).toBe(87)
  })

  it('answers zero for a nil or negative charge, not the flat part', () => {
    expect(feeOnCents(0, US)).toBe(0)
    expect(feeOnCents(-100, US)).toBe(0)
  })

  it('handles a rate with no percentage and one with no fee at all', () => {
    expect(feeOnCents(10_000, FLAT)).toBe(25)
    expect(feeOnCents(10_000, FREE)).toBe(0)
  })
})

describe('grossUpCents', () => {
  it('charges $41.50 so that exactly $40.00 arrives', () => {
    // The naive "add the fee on the owed amount" answer is $41.46 and is wrong: the fee
    // applies to the grossed-up charge, not to what was owed. The closed form then says
    // $41.51, and THAT is a cent high — 4150 clears exactly, which is what the minimality
    // test below is for and how the overshoot was found.
    const gross = grossUpCents(4000, US)
    expect(gross).toBe(4150)
    expect(feeOnCents(4150, US)).toBe(150)
    expect(4150 - feeOnCents(4150, US)).toBe(4000)
  })

  it('never lands the family short, across a wide sweep', () => {
    // THE POSTCONDITION IS THE WHOLE POINT. A single cent short leaves a residue the member
    // cannot clear, because Stripe refuses a charge below its own minimum.
    for (const rate of [US, INTL, FLAT]) {
      for (let owed = 1; owed <= 5000; owed++) {
        const gross = grossUpCents(owed, rate)!
        expect(gross - feeOnCents(gross, rate)).toBeGreaterThanOrEqual(owed)
      }
    }
  })

  it('is the CHEAPEST charge that clears the balance', () => {
    // Not merely sufficient — minimal. A gross-up that overshoots is money taken from a
    // member for no stated reason.
    for (const rate of [US, INTL]) {
      for (const owed of [1, 99, 100, 999, 4000, 12_345]) {
        const gross = grossUpCents(owed, rate)!
        expect(gross - 1 - feeOnCents(gross - 1, rate)).toBeLessThan(owed)
      }
    }
  })

  it('adds nothing when the rate is nil', () => {
    expect(grossUpCents(4000, FREE)).toBe(4000)
  })

  it('refuses a nil balance and a rate with no fixed point', () => {
    expect(grossUpCents(0, US)).toBeNull()
    expect(grossUpCents(-1, US)).toBeNull()
    // 100% and above: every extra cent charged is entirely consumed.
    expect(grossUpCents(4000, { percentBps: 10_000, fixedCents: 0 })).toBeNull()
    expect(grossUpCents(4000, { percentBps: 12_000, fixedCents: 0 })).toBeNull()
  })
})

describe('apportionCents', () => {
  it('sums to the total exactly, whatever the split', () => {
    expect(apportionCents(100, [1, 1, 1]).reduce((a, b) => a + b, 0)).toBe(100)
    expect(apportionCents(146, [4000, 2500, 1000]).reduce((a, b) => a + b, 0)).toBe(146)
    expect(apportionCents(7, [1, 1, 1, 1, 1, 1]).reduce((a, b) => a + b, 0)).toBe(7)
  })

  it('does not OVERSHOOT when every part would round up', () => {
    // The case that distinguishes largest-remainder from rounding each part on its own, and
    // the reason this test exists: 5 cents over three equal parts is 1.667 each, which ROUNDS
    // to 2 and sums to 6 — a sixth cent invented out of a rounding mode. Floors plus the
    // leftover is 2/2/1. Without this case the round-per-part mutation is green, which is how
    // it was found: the mutation was claimed in the header before it had been run.
    expect(apportionCents(5, [1, 1, 1])).toEqual([2, 2, 1])
    expect(apportionCents(5, [1, 1, 1]).reduce((a, b) => a + b, 0)).toBe(5)
    expect(apportionCents(11, [1, 1, 1, 1, 1, 1]).reduce((a, b) => a + b, 0)).toBe(11)
  })

  it('gives the leftover cents to the largest remainders', () => {
    // 100 over three equal parts: 33.33 each. Floors are 33/33/33, one cent over, and every
    // remainder ties — so it goes to the first by the index tiebreak.
    expect(apportionCents(100, [1, 1, 1])).toEqual([34, 33, 33])
  })

  it('is proportional to the weights', () => {
    // A $1.46 fee over a $40 due and a $10 due.
    expect(apportionCents(146, [4000, 1000])).toEqual([117, 29])
  })

  it('breaks ties by index, so a redelivery apportions identically', () => {
    const once = apportionCents(5, [10, 10, 10, 10])
    const again = apportionCents(5, [10, 10, 10, 10])
    expect(once).toEqual(again)
    expect(once).toEqual([2, 1, 1, 1])
  })

  it('handles the degenerate inputs rather than dropping cents', () => {
    expect(apportionCents(146, [])).toEqual([])
    expect(apportionCents(146, [4000])).toEqual([146])
    // Weights that sum to zero: the whole total lands on the first part rather than vanishing.
    expect(apportionCents(146, [0, 0])).toEqual([146, 0])
    expect(apportionCents(0, [1, 2, 3])).toEqual([0, 0, 0])
  })

  it('never gives a part more than one cent above its floor', () => {
    const weights = [1234, 5678, 91, 4321]
    const parts = apportionCents(999, weights)
    const sum = weights.reduce((a, b) => a + b, 0)
    parts.forEach((part, i) => {
      const exact = (999 * weights[i]) / sum
      expect(part).toBeGreaterThanOrEqual(Math.floor(exact))
      expect(part).toBeLessThanOrEqual(Math.floor(exact) + 1)
    })
  })
})
