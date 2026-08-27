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
 * ── THE SURVIVING MUTATION WAS THE INTERESTING ONE, AND IT WAS A REAL BUG ─────────
 * This paragraph used to record a mutation that changed no answer: removing the `$` anchor
 * from `formatPlanPrice`'s `/\.00$/` regex. The argument was sound — with two-decimal USD
 * output, `.00` can only ever BE the trailing cents — and it named its own premise out loud:
 * *`formatCurrency` always emits exactly two decimals*. So rather than pretend, the last case
 * in that block PINNED the premise, as `/^\$[\d,]+\.\d{2}$/`. The same pass found a
 * `cents % 100 === 0` guard beside the regex that could not decide anything either, and it
 * was deleted as dead code.
 *
 * ALL OF THAT WAS TRUE OF `en-US` AND OF NOTHING ELSE. When the public site learned Spanish
 * and French (2026-08-27) the premise stopped holding — `fr-FR` formats a dollar as
 * `10,00 $US`, which the anchored regex does not match — so French price cards kept the zero
 * cents the whole mechanism existed to remove, and every assertion in this file passed.
 *
 * Two things to carry out of it, because neither is specific to money:
 *
 *   * **A test that pins a premise is only as good as the premise being the real one.** That
 *     `/^\$[\d,]+\.\d{2}$/` was a genuinely useful assertion and it was ALSO the bug: it
 *     wrote `en-US` into the suite as an invariant of the formatter. It would have gone red
 *     had `formatCurrency` changed its digits and stayed green for the change that actually
 *     came, which was a second locale.
 *   * **The dead guard was not dead, it was early.** `cents % 100 === 0` could not decide
 *     anything against a regex and is the whole decision against a formatter — it is what
 *     asks *is this a whole number of dollars*, which is the question the regex was
 *     approximating by looking at two characters of English output. Deleting it was correct
 *     on the evidence available and is worth remembering as the shape: a condition that
 *     duplicates a weaker mechanism looks redundant right up until the weak mechanism is
 *     replaced.
 *
 * Re-mutated on 2026-08-27, four, all tripped. The last one is in `lib/currency-utils.ts`
 * rather than here, because the plumbing is half the change and a test that only covers the
 * caller would go green on a `fractionDigits` that `formatMoney` quietly ignored:
 *
 *   * the `cents % 100 === 0` guard removed (always two digits)                 4 failed
 *   * `fractionDigits: 0` applied unconditionally (cents eaten)                 4 failed
 *   * `intl` ignored, `DEFAULT_MONEY_LOCALE` hard-coded                         4 failed
 *   * `formatMoney` drops the `fractionDigits` spread                           4 failed
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
    // Which is what the `cents % 100 === 0` guard is FOR — see the header. A future $12.50
    // renders correctly with no second helper.
    expect(formatPlanPrice(1_250)).toBe('$12.50')
    expect(formatPlanPrice(1_205)).toBe('$12.05')
  })

  it('groups thousands', () => {
    expect(formatPlanPrice(120_000)).toBe('$1,200')
  })

  it('defaults to US conventions with no locale passed', () => {
    // The default exists so a caller with no reader-locale in hand renders something rather
    // than throwing. Every call site in the tree passes one; this pins what happens if one
    // stops. It is also what makes the three cases above readable as English figures.
    expect(formatPlanPrice(1_000)).toBe(formatPlanPrice(1_000, 'en-US'))
  })

  // ── THE SAME TWO RULES, IN THREE LANGUAGES ──────────────────────────────────────
  // THIS IS THE BLOCK THAT WOULD HAVE CAUGHT THE BUG, and the reason it is written out per
  // locale rather than as a loop over `LOCALES`: the point is the SHAPE of each language's
  // output, and a loop that asserted "no `.00` anywhere" would pass for French while French
  // was rendering `10,00 $US` — that string contains no `.00` at all.
  //
  // The figures are hard-coded rather than derived from `Intl`, deliberately. A test that
  // asks the formatter what it produces and then checks the answer against the formatter is
  // a tautology; these are what the three cards actually SAY, measured, and a CLDR change
  // that moves one is a thing this suite should report rather than absorb.
  it('drops the zero cents in every language, not only in English', () => {
    // `$` before the number, no space.
    expect(formatPlanPrice(1_000, 'en-US')).toBe('$10')
    // `USD` then a NO-BREAK SPACE. The old regex matched this one by luck — the decimals
    // were still `.00` and still trailing.
    expect(formatPlanPrice(1_000, 'es-MX')).toBe('USD\u00a010')
    // A COMMA decimal separator and the symbol after the figure, so the old regex matched
    // nothing and the zeroes survived. This is the assertion that is new information.
    expect(formatPlanPrice(1_000, 'fr-FR')).toBe('10\u00a0$US')
  })

  it('keeps real cents in every language, with the right separator', () => {
    expect(formatPlanPrice(1_250, 'en-US')).toBe('$12.50')
    expect(formatPlanPrice(1_250, 'es-MX')).toBe('USD\u00a012.50')
    // A DECIMAL COMMA, which is the other half of why a `/\.00$/` strip could never work
    // here: French does not write a decimal point at all.
    expect(formatPlanPrice(1_250, 'fr-FR')).toBe('12,50\u00a0$US')
  })

  it('groups thousands the way each language groups them', () => {
    expect(formatPlanPrice(120_000, 'en-US')).toBe('$1,200')
    expect(formatPlanPrice(120_000, 'es-MX')).toBe('USD\u00a01,200')
    // A NARROW NO-BREAK SPACE as the group separator, U+202F — not the U+00A0 before the
    // symbol. Two different invisible characters in one nine-character string, which is
    // precisely why these are written as escapes rather than pasted in.
    expect(formatPlanPrice(120_000, 'fr-FR')).toBe('1\u202f200\u00a0$US')
  })

  it('never drops a cent that is there, in any language', () => {
    // THE ONE ASSERTION THAT IS ABOUT SAFETY RATHER THAN TIDINESS. `fractionDigits: 0` on
    // an amount with cents in it does not tidy the figure, it reports a different amount —
    // `$12.05` would render as `$12`. So every locale is asked, for every non-whole input,
    // whether the cents are still visible. Mutating the guard away trips this five times.
    for (const intl of ['en-US', 'es-MX', 'fr-FR']) {
      for (const cents of [5, 99, 1_205, 1_250, 123_456]) {
        const shown = formatPlanPrice(cents, intl)
        // COMPARED AS A NUMBER, not as a string. `$0.05` renders as `0.05`, whose digits are
        // `005` — the integer part is a real zero rather than padding, and stripping it by
        // hand would be a second formatting rule inside the assertion.
        const digits = Number(shown.replace(/\D/g, ''))
        expect(digits, `${shown} (${intl}) lost its cents`).toBe(cents)
      }
    }
  })

  it('is the same figure formatCurrency gives, minus the zero cents', () => {
    // WHAT THIS REPLACES, and why it is the honest version. The old last case pinned
    // `formatCurrency(cents)` against `/^\$[\d,]+\.\d{2}$/` — an assertion that read as
    // being about fraction digits and was in fact about `en-US`, which is how the premise
    // came to be wrong in the two languages nobody on the team reads.
    //
    // The relationship that actually holds in every locale is this one: the two functions
    // agree exactly wherever there are cents to show, and differ only in the digits. Asked
    // of all three languages, so a fourth added later inherits the check by being added to
    // the list rather than by somebody rewriting a regex.
    for (const intl of ['en-US', 'es-MX', 'fr-FR']) {
      expect(formatPlanPrice(1_250, intl)).toBe(formatCurrency(1_250, intl))
      expect(formatPlanPrice(1_205, intl)).toBe(formatCurrency(1_205, intl))
      // And a whole number of dollars is the SAME string with the separator and the two
      // zeroes gone — never a differently-punctuated figure.
      expect(formatCurrency(1_000, intl)).toContain(formatPlanPrice(1_000, intl).split(/[\s\u00a0\u202f]/)[0])
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
