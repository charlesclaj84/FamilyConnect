import { describe, expect, it } from 'vitest'
import {
  planAdds, PLAN_ORDER, TIER_IS_SOLD, TIER_PRICE,
  formatPlanPrice, planAddsBetween, planChange,
} from '@/lib/plans'
import { TIERS, type FamilyTier } from '@/lib/tiers'
import { formatCurrency } from '@/lib/currency-utils'
import { tFor } from '@/lib/i18n/catalogues'

/**
 * ── THE PLAN LIST TAKES A TRANSLATOR NOW, AND THAT KEPT THESE TESTS PURE ────────────
 * `PLAN_ADDS` was a `Record` of English; it is `planAdds(t, tier)`. A translator is a function
 * of a locale over two plain objects — no request, no session, no database — so every assertion
 * below still runs with no fixture, which is what keeps them in `npm test` rather than in
 * `tests/rls` (AGENTS.md §7b).
 *
 * `tFor('en')` rather than a stub, deliberately: it exercises the real catalogue, so a claim
 * whose `plan.adds.<claim>.label` key is missing shows up as a key name in a length assertion
 * rather than passing over a stub that answers anything.
 */
const t = tFor('en')

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
 * ── HALF OF THIS FILE WAS DELETED ON 2026-08-19, AND THAT IS THE POINT OF IT ────────
 * The annual rate and its discount were withdrawn, so `annualSavingCents` and
 * `monthsFreeOnAnnual` are gone from `lib/plans.ts` and their four `describe` blocks are gone
 * from here. Nothing else needed touching: the "two months free" sentences on three surfaces
 * were DERIVED from the two figures, so they stopped being rendered without a single edit to
 * any of them. That is what these tests were protecting — not the claim, the derivation.
 *
 * IF AN ANNUAL RATE COMES BACK, both helpers and both blocks come back with it. `git log` on
 * this file is the fastest way to recover them; the mutation list below records what they were
 * worth, which is why it is kept rather than trimmed to the surviving cases.
 *
 * CHECKED BY MUTATION, as §7b requires — a green run is not evidence until it has been seen
 * to fail. Seven mutations, all tripped (2026-08-17), four of them against code that no longer
 * exists:
 *
 *   * `monthlyCents * 12 - yearlyCents` → `yearlyCents - monthlyCents * 12`   6 failed
 *   * the `saving % monthlyCents !== 0` guard removed                         1 failed
 *   * the `saving <= 0` guard removed                                         1 failed
 *   * `TIER_PRICE.plus.yearlyCents` → 12_000 (no longer two months free)      3 failed
 *   * Premium priced below Plus                                               2 failed
 *   * `TIER_IS_SOLD.plus` → true                                              1 failed
 *   * the `.00` strip removed from `formatPlanPrice`                          2 failed
 *
 * AND RE-CHECKED AFTER THE FOUR-TIER RESTRUCTURE (2026-08-19), because a suite that has just
 * had half of itself removed is exactly the suite most likely to be passing vacuously. Four
 * mutations, all tripped:
 *
 *   * `TIER_PRICE.standard` → `{ monthlyCents: 2_000 }` (dearer than Plus)     2 failed
 *   * `TIER_PRICE.standard` → null                                            2 failed
 *   * `planAdds(t, 'standard')` → `[]`                                             1 failed
 *   * `yearlyCents: 18_000` put back on Plus                                  2 failed
 *
 * The last one is the one to keep in mind: it is not a hypothetical mutation, it is the edit
 * somebody makes next year when an annual plan comes back, and the suite's job is to make that
 * a decision taken here rather than a field that appeared.
 *
 * AND ONE THAT SURVIVED, kept here because it is the useful half. Removing the `$` anchor
 * from `formatPlanPrice`'s regex changed no answer — with two-decimal USD output, `.00` can
 * only ever BE the trailing cents, so no input distinguishes the two. Rather than write a
 * test that pretends otherwise, the last case in that block pins the invariant the anchor's
 * redundancy rests on. The same mutation pass found a genuine `cents % 100 === 0` guard in
 * that function that could not decide anything either, and it was deleted.
 */

describe('TIER_PRICE', () => {
  it('prices the three paid tiers and leaves Free without one', () => {
    // Free has NO price rather than a price of zero, and every surface branches on that:
    // `$0/month` is a figure where the word "Free" belongs.
    expect(TIER_PRICE.free).toBeNull()
    // RE-PRICED 2026-08-23 (5/15/25 -> 10/20/30). These literals are the ONE place in the test
    // suite that pins the figures, deliberately: this is the assertion whose job is to make a
    // price change deliberate rather than accidental, so it is meant to go red on one. Every
    // other test that touches money derives from `TIER_PRICE` instead.
    expect(TIER_PRICE.standard).toEqual({ monthlyCents: 1_000 })
    expect(TIER_PRICE.plus).toEqual({ monthlyCents: 2_000 })
    expect(TIER_PRICE.premium).toEqual({ monthlyCents: 3_000 })
  })

  it('states every tier, so a fifth cannot be added without a price decision', () => {
    for (const tier of TIERS) {
      expect(Object.prototype.hasOwnProperty.call(TIER_PRICE, tier)).toBe(true)
    }
  })

  it('carries one rate per tier and no annual figure', () => {
    // THE ASSERTION IS THE ABSENCE. An annual price was withdrawn on 2026-08-19 along with the
    // discount that justified it, and the risk now is somebody reinstating `yearlyCents` as a
    // convenience — twelve times the monthly rate, "since it is obvious" — which commits the
    // product to an annual plan that has no billing, no terms and no answer for a family that
    // downgrades in March. If an annual rate is a real decision, this test is where it is
    // taken, deliberately, rather than arrived at.
    for (const tier of TIERS) {
      const price = TIER_PRICE[tier]
      if (!price) continue
      expect(Object.keys(price)).toEqual(['monthlyCents'])
    }
  })

  it('is integer cents throughout — floating dollars are how a total becomes $99.99999999', () => {
    for (const price of Object.values(TIER_PRICE)) {
      if (!price) continue
      expect(Number.isInteger(price.monthlyCents)).toBe(true)
    }
  })

  it('never prices a tier above the one beneath it', () => {
    // Not a formatting concern: a Premium cheaper than Plus would render as a working pricing
    // page selling the wrong thing, and nothing else in the tree would object. It is also what
    // catches a tier inserted in the MIDDLE at the wrong price, which is how Standard arrived:
    // `PLAN_ORDER` is derived from `TIERS`, so this walks the real ladder rather than a list.
    const priced = PLAN_ORDER.map(t => TIER_PRICE[t]).filter(Boolean)
    expect(priced.length).toBeGreaterThan(1)
    for (let i = 1; i < priced.length; i += 1) {
      expect(priced[i]!.monthlyCents).toBeGreaterThan(priced[i - 1]!.monthlyCents)
    }
  })

  it('prices every tier above Free, so no paid plan is silently free', () => {
    // The mirror of the test above, and it is the one that catches a tier added to `TIERS`
    // with no `TIER_PRICE` entry decided: `hasOwnProperty` passes for an explicit `null`, and
    // a `null` on anything but Free renders a card with no figure and a Coming soon badge that
    // nobody notices is missing a price.
    for (const tier of TIERS) {
      if (tier === 'free') continue
      expect(TIER_PRICE[tier], `${tier} has no price`).not.toBeNull()
    }
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
    // The 2026-08-17 split, and it is STILL the point after two of the three went on sale on
    // 2026-08-23: Premium carries a real figure and cannot be bought. Every surface that
    // renders a price has to read this before it renders a control.
    expect(TIER_IS_SOLD.premium).toBe(false)
    expect(TIER_PRICE.premium).not.toBeNull()
  })

  it('sells what the checkout can actually charge for', () => {
    // ── THE DIRECTION THAT MATTERS NOW ────────────────────────────────────────────────
    // Flipped 2026-08-23 with the Stripe integration. This used to assert the opposite and
    // reversing it was the whole of the change here — which is worth knowing, because an
    // assertion that a plan is NOT for sale is one somebody deletes to make a test pass.
    // It is written as the positive claim instead: these two are sold, and Free is free.
    expect(TIER_IS_SOLD.free).toBe(true)
    expect(TIER_IS_SOLD.standard).toBe(true)
    expect(TIER_IS_SOLD.plus).toBe(true)
  })

  it('never sells a tier with no price', () => {
    // The invariant underneath both blocks above, and the one that survives a fifth tier
    // arriving: a sold tier is one somebody can be quoted a figure for. `TIER_PRICE[tier]`
    // is what every screen quotes and `platformPriceId` is what Stripe charges, so a tier
    // sold with a null price is a button whose next screen has no number on it.
    for (const tier of TIERS) {
      if (tier === 'free') continue
      if (TIER_IS_SOLD[tier]) expect(TIER_PRICE[tier]).not.toBeNull()
    }
  })
})

describe('planAddsBetween', () => {
  it('walks the rungs rather than reading one tier', () => {
    // Free → Premium skips TWO rungs since Standard was inserted, which is what makes this
    // worth asserting: reading `planAdds(t, 'premium')` alone names Premium's benefits and silently
    // omits everything on Standard and Plus that arrives with them.
    //
    // SUMMED FROM `TIERS` RATHER THAN FROM THE THREE TIERS BY NAME, and that is the whole
    // repair this test needed on 2026-08-19: the hand-written sum said `free + plus + premium`
    // and went on passing as a statement about three tiers while the function correctly walked
    // four. A test that names the rungs cannot notice a new rung — it just gets the wrong
    // total and reports the FUNCTION as broken, which is the most expensive kind of failure.
    // `tier` rather than `t`: the translator is `t` in this file now, and a shadowing
    // parameter here would have quietly passed the tier as the translator.
    const total = TIERS.reduce((n, tier) => n + planAdds(t, tier).length, 0)
    expect(planAddsBetween(t, undefined, 'premium')).toHaveLength(total)
    expect(planAddsBetween(t, 'free', 'premium')).toHaveLength(total - planAdds(t, 'free').length)
    // And one rung really is skipped over: Free → Plus must include Standard's list.
    expect(planAddsBetween(t, 'free', 'plus')).toHaveLength(
      planAdds(t, 'standard').length + planAdds(t, 'plus').length,
    )
  })

  it('gives every tier something to add, so no card renders as empty', () => {
    // `PLANS[]` on /pricing renders "What this tier adds is still being decided" for an empty
    // list, which is honest and is not something any tier should be shipping. It is also what
    // catches a tier added to `TIERS` with no `PLAN_ADDS` entry written for it: the Record
    // type demands the key, and `[]` satisfies it.
    for (const tier of TIERS) {
      expect(planAdds(t, tier).length, `${tier} adds nothing`).toBeGreaterThan(0)
    }
  })

  it('is empty when there is nothing above the floor', () => {
    expect(planAddsBetween(t, 'premium', 'premium')).toEqual([])
    expect(planAddsBetween(t, 'premium', 'free')).toEqual([])
  })

  it('takes undefined as "from the bottom", which is how Free asks for its own stack', () => {
    expect(planAddsBetween(t, undefined, 'free')).toEqual(planAdds(t, 'free'))
  })
})

describe('planChange', () => {
  it('answers an upgrade and a downgrade with the same two lists', () => {
    const up = planChange(t, 'free', 'premium')
    const down = planChange(t, 'premium', 'free')
    expect(up.up).toBe(true)
    expect(down.up).toBe(false)
    // Symmetric on purpose: the caller reads `up` to decide whether `changing` is gains or
    // losses. A separate downgrade path would be a second place to get the ordering wrong.
    expect(up.changing).toEqual(down.changing)
    expect(up.keeping).toEqual(down.keeping)
  })

  it('moves nothing when the plan does not change', () => {
    for (const tier of TIERS as FamilyTier[]) {
      expect(planChange(t, tier, tier).changing).toEqual([])
    }
  })

  it('keeps everything the LOWER tier carries, on the way down as well as up', () => {
    // The reassuring half of a downgrade rather than a footnote to it.
    expect(planChange(t, 'premium', 'plus').keeping).toEqual(planAddsBetween(t, undefined, 'plus'))
  })
})
