import { describe, expect, it } from 'vitest'
import {
  PLAN_ADDS, PLAN_ORDER, TIER_IS_SOLD, TIER_PRICE,
  annualSavingCents, formatPlanPrice, monthsFreeOnAnnual,
  planAddsBetween, planChange,
} from '@/lib/plans'
import { TIERS, type FamilyTier } from '@/lib/tiers'
import { formatCurrency } from '@/lib/currency-utils'

/**
 * The plan arithmetic, under `npm test` — which has been a `verify.yml` step since
 * 2026-08-17, so these actually gate a pull request.
 *
 * WHY THIS FILE EXISTS AT ALL: `lib/plans.ts` stopped being pure copy on 2026-08-17, when
 * `TIER_PRICE` arrived and three surfaces started deriving sentences from it — the marketing
 * card, the in-product plan panel and the upgrade screen. AGENTS.md §7b's rule is about
 * exactly this shape of module: money, division, a claim in prose that has to agree with the
 * figures beside it. "Two months free" is a derived assertion about a price, and the failure
 * mode if the derivation is wrong is a commercial statement nobody typed.
 *
 * CHECKED BY MUTATION, as §7b requires — a green run is not evidence until it has been seen
 * to fail. Seven mutations, all tripped (2026-08-17):
 *
 *   * `monthlyCents * 12 - yearlyCents` → `yearlyCents - monthlyCents * 12`   6 failed
 *   * the `saving % monthlyCents !== 0` guard removed                         1 failed
 *   * the `saving <= 0` guard removed                                         1 failed
 *   * `TIER_PRICE.plus.yearlyCents` → 12_000 (no longer two months free)      3 failed
 *   * Premium priced below Plus                                               2 failed
 *   * `TIER_IS_SOLD.plus` → true                                              1 failed
 *   * the `.00` strip removed from `formatPlanPrice`                          2 failed
 *
 * AND ONE THAT SURVIVED, kept here because it is the useful half. Removing the `$` anchor
 * from `formatPlanPrice`'s regex changed no answer — with two-decimal USD output, `.00` can
 * only ever BE the trailing cents, so no input distinguishes the two. Rather than write a
 * test that pretends otherwise, the last case in that block pins the invariant the anchor's
 * redundancy rests on. The same mutation pass found a genuine `cents % 100 === 0` guard in
 * that function that could not decide anything either, and it was deleted.
 */

describe('TIER_PRICE', () => {
  it('prices the two paid tiers and leaves Free without one', () => {
    // Free has NO price rather than a price of zero, and every surface branches on that:
    // `$0/month` is a figure where the word "Free" belongs.
    expect(TIER_PRICE.free).toBeNull()
    expect(TIER_PRICE.plus).toEqual({ monthlyCents: 1_000, yearlyCents: 10_000 })
    expect(TIER_PRICE.premium).toEqual({ monthlyCents: 2_500, yearlyCents: 25_000 })
  })

  it('states every tier, so a fourth cannot be added without a price decision', () => {
    for (const tier of TIERS) {
      expect(Object.prototype.hasOwnProperty.call(TIER_PRICE, tier)).toBe(true)
    }
  })

  it('is integer cents throughout — floating dollars are how a total becomes $99.99999999', () => {
    for (const price of Object.values(TIER_PRICE)) {
      if (!price) continue
      expect(Number.isInteger(price.monthlyCents)).toBe(true)
      expect(Number.isInteger(price.yearlyCents)).toBe(true)
    }
  })

  it('never prices a tier above the one beneath it', () => {
    // Not a formatting concern: a Premium cheaper than Plus would render as a working
    // pricing page selling the wrong thing, and nothing else in the tree would object.
    const priced = PLAN_ORDER.map(t => TIER_PRICE[t]).filter(Boolean)
    for (let i = 1; i < priced.length; i += 1) {
      expect(priced[i]!.monthlyCents).toBeGreaterThan(priced[i - 1]!.monthlyCents)
      expect(priced[i]!.yearlyCents).toBeGreaterThan(priced[i - 1]!.yearlyCents)
    }
  })

  it('makes the annual rate cheaper than twelve months, on every priced tier', () => {
    for (const tier of TIERS) {
      const price = TIER_PRICE[tier]
      if (!price) continue
      expect(annualSavingCents(price)).toBeGreaterThan(0)
    }
  })
})

describe('annualSavingCents', () => {
  it('is twelve months less the annual rate', () => {
    expect(annualSavingCents({ monthlyCents: 1_000, yearlyCents: 10_000 })).toBe(2_000)
    expect(annualSavingCents({ monthlyCents: 2_500, yearlyCents: 25_000 })).toBe(5_000)
  })

  it('is zero when the annual rate is exactly twelve months', () => {
    expect(annualSavingCents({ monthlyCents: 1_000, yearlyCents: 12_000 })).toBe(0)
  })

  it('goes negative when the annual rate is the worse deal', () => {
    // The sign matters: `monthsFreeOnAnnual` refuses this case, and a caller that formatted
    // it anyway would advertise "save -$10".
    expect(annualSavingCents({ monthlyCents: 1_000, yearlyCents: 13_000 })).toBe(-1_000)
  })
})

describe('monthsFreeOnAnnual', () => {
  it('is two months on both current prices — which is why the page may say so', () => {
    expect(monthsFreeOnAnnual(TIER_PRICE.plus!)).toBe(2)
    expect(monthsFreeOnAnnual(TIER_PRICE.premium!)).toBe(2)
  })

  it('counts other whole-month savings', () => {
    expect(monthsFreeOnAnnual({ monthlyCents: 1_000, yearlyCents: 11_000 })).toBe(1)
    expect(monthsFreeOnAnnual({ monthlyCents: 1_000, yearlyCents: 9_000 })).toBe(3)
  })

  it('refuses a saving that is not whole months, rather than rounding it', () => {
    // $10/mo with $104 a year saves $16 — 1.6 months. Both "1 month free" and "2 months
    // free" would be false, so the honest answer is no claim and the caller falls back to
    // the currency figure.
    expect(monthsFreeOnAnnual({ monthlyCents: 1_000, yearlyCents: 10_400 })).toBeNull()
  })

  it('refuses a saving of nothing, and a negative one', () => {
    expect(monthsFreeOnAnnual({ monthlyCents: 1_000, yearlyCents: 12_000 })).toBeNull()
    expect(monthsFreeOnAnnual({ monthlyCents: 1_000, yearlyCents: 13_000 })).toBeNull()
  })
})

describe('formatPlanPrice', () => {
  it('drops the trailing zeroes on a whole number of dollars', () => {
    // A price is scanned, not audited: `.00` is noise at 48px.
    expect(formatPlanPrice(1_000)).toBe('$10')
    expect(formatPlanPrice(25_000)).toBe('$250')
  })

  it('keeps the cents when there are any', () => {
    // The reason this wraps `formatCurrency` rather than replacing it — a future $12.50
    // renders correctly with no second helper.
    expect(formatPlanPrice(1_250)).toBe('$12.50')
    expect(formatPlanPrice(1_205)).toBe('$12.05')
  })

  it('groups thousands', () => {
    expect(formatPlanPrice(120_000)).toBe('$1,200')
  })

  it('rests on formatCurrency always emitting exactly two decimals', () => {
    // THE ANCHOR IN `/\.00$/` IS NOT PINNED BY ANY TEST ABOVE, and mutation-testing found
    // that out: removing it changes no answer, because with two-decimal USD output the
    // substring `.00` can only ever BE the trailing cents. There is no input to this
    // function that distinguishes the two.
    //
    // So rather than pretend, this pins the invariant the anchor's redundancy depends on. If
    // a future formatter ever emitted more or fewer fraction digits, this fails here — at
    // the assumption — instead of silently turning `formatPlanPrice` into a function that
    // eats part of a number.
    for (const cents of [0, 5, 50, 99, 100, 1_000, 1_205, 1_250, 120_000, 123_456]) {
      expect(formatCurrency(cents)).toMatch(/^\$[\d,]+\.\d{2}$/)
    }
  })
})

describe('TIER_IS_SOLD', () => {
  it('keeps a price and a purchase as separate facts', () => {
    // The whole point of the 2026-08-17 split: Plus and Premium have real figures and
    // neither can be bought, because there is no billing. Every surface that renders a
    // price has to read this before it renders a control.
    expect(TIER_IS_SOLD.free).toBe(true)
    expect(TIER_IS_SOLD.plus).toBe(false)
    expect(TIER_IS_SOLD.premium).toBe(false)
    expect(TIER_PRICE.plus).not.toBeNull()
  })
})

describe('planAddsBetween', () => {
  it('walks the rungs rather than reading one tier', () => {
    // Free → Premium skips a rung. Reading PLAN_ADDS.premium alone names five benefits and
    // silently omits the seven on Plus that arrive with them.
    const all = planAddsBetween(undefined, 'premium')
    expect(all).toHaveLength(PLAN_ADDS.free.length + PLAN_ADDS.plus.length + PLAN_ADDS.premium.length)
    expect(planAddsBetween('free', 'premium')).toHaveLength(
      PLAN_ADDS.plus.length + PLAN_ADDS.premium.length,
    )
  })

  it('is empty when there is nothing above the floor', () => {
    expect(planAddsBetween('premium', 'premium')).toEqual([])
    expect(planAddsBetween('premium', 'free')).toEqual([])
  })

  it('takes undefined as "from the bottom", which is how Free asks for its own stack', () => {
    expect(planAddsBetween(undefined, 'free')).toEqual(PLAN_ADDS.free)
  })
})

describe('planChange', () => {
  it('answers an upgrade and a downgrade with the same two lists', () => {
    const up = planChange('free', 'premium')
    const down = planChange('premium', 'free')
    expect(up.up).toBe(true)
    expect(down.up).toBe(false)
    // Symmetric on purpose: the caller reads `up` to decide whether `changing` is gains or
    // losses. A separate downgrade path would be a second place to get the ordering wrong.
    expect(up.changing).toEqual(down.changing)
    expect(up.keeping).toEqual(down.keeping)
  })

  it('moves nothing when the plan does not change', () => {
    for (const tier of TIERS as FamilyTier[]) {
      expect(planChange(tier, tier).changing).toEqual([])
    }
  })

  it('keeps everything the LOWER tier carries, on the way down as well as up', () => {
    // The reassuring half of a downgrade rather than a footnote to it.
    expect(planChange('premium', 'plus').keeping).toEqual(planAddsBetween(undefined, 'plus'))
  })
})
