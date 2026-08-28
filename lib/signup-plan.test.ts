import { describe, expect, it } from 'vitest'
import {
  SIGNUP_PLAN_PROMPT_DAYS, sellablePlanParam, signupPlanPrompt,
} from '@/lib/signup-plan'
import { TIER_IS_SOLD } from '@/lib/plans'

/**
 * The signup plan intent, under `npm test`.
 *
 * WHY IT IS TESTED HERE AND NOT IN `tests/rls`: §7b's boundary. Nothing in this module reads
 * the database or authorizes a caller — it is a date comparison and four precedence rules —
 * and the RLS suite cannot check a figure or an off-by-one. The ACTIONS that read it owe their
 * own cases over there.
 *
 * CHECKED BY MUTATION, as §7b requires. Six mutations, all tripped (2026-08-23):
 *
 *   * `dismissedAt` test removed                                          2 failed
 *   * `tierMeets(activeTier, …)` → `activeTier === signupTier`            1 failed
 *   * the `TIER_IS_SOLD` test removed                                     1 failed
 *   * `ageDays > DAYS` → `ageDays >= DAYS`                                1 failed
 *   * `Math.max(0, ageDays)` → `ageDays`                                  1 failed
 *   * `sellablePlanParam` returning the tier without the sold check       1 failed
 *
 * The fifth is the one worth keeping in mind: a negative age is clock skew between the
 * database's `NOW()` and the server's date, and it happens to the newest family rather than
 * to an old one.
 */

const AT = '2026-08-23T10:00:00Z'
const TODAY = '2026-08-23'

/** The ordinary case: chose Plus minutes ago, on Free, nothing dismissed. */
function fresh(over: Partial<Parameters<typeof signupPlanPrompt>[0]> = {}) {
  return signupPlanPrompt({
    signupTier: 'plus',
    signupTierAt: AT,
    dismissedAt: null,
    activeTier: 'free',
    today: TODAY,
    ...over,
  })
}

describe('signupPlanPrompt', () => {
  it('asks a family that chose a plan and has not paid for it', () => {
    const r = fresh()
    expect(r.prompt).toBe(true)
    if (r.prompt) {
      expect(r.tier).toBe('plus')
      expect(r.ageDays).toBe(0)
    }
  })

  it('says nothing when no plan was chosen', () => {
    expect(fresh({ signupTier: null })).toEqual({ prompt: false, skip: 'none-chosen' })
  })

  it('treats a tier with no timestamp as no choice at all', () => {
    // Both halves or neither — the CHECK in 20260823000008 enforces it and this refuses a row
    // written before it existed. Reading the tier alone would make the staleness test compare
    // against `undefined`, which is neither stale nor fresh.
    expect(fresh({ signupTierAt: null })).toEqual({ prompt: false, skip: 'none-chosen' })
  })

  it('refuses free as a choice, whatever the column says', () => {
    // 'free' is two spellings of "bought nothing". Offering a checkout for it would quote a
    // family a price for the plan they are already on.
    expect(fresh({ signupTier: 'free' })).toEqual({ prompt: false, skip: 'none-chosen' })
    expect(fresh({ signupTier: 'gold' })).toEqual({ prompt: false, skip: 'none-chosen' })
  })

  it('stops asking once the family has said no', () => {
    expect(fresh({ dismissedAt: '2026-08-23T11:00:00Z' }))
      .toEqual({ prompt: false, skip: 'dismissed' })
  })

  it('does not ask for a plan the family already holds', () => {
    expect(fresh({ activeTier: 'plus' })).toEqual({ prompt: false, skip: 'already-held' })
  })

  it('counts a HIGHER tier as already holding it', () => {
    // The inclusive-tier rule (`lib/tiers.ts`). A family that chose Standard and bought Plus
    // has Standard — an equality test here would sell it to them a second time, which is the
    // most expensive mistake available in this function.
    expect(fresh({ signupTier: 'standard', activeTier: 'plus' }))
      .toEqual({ prompt: false, skip: 'already-held' })
    expect(fresh({ signupTier: 'standard', activeTier: 'premium' }))
      .toEqual({ prompt: false, skip: 'already-held' })
  })

  it('still asks a Standard family that chose Plus', () => {
    // The control for the two above: holding the tier BELOW is not holding it.
    const r = fresh({ signupTier: 'plus', activeTier: 'standard' })
    expect(r.prompt).toBe(true)
  })

  it('does not offer a plan that is no longer sold', () => {
    // `TIER_IS_SOLD` is a product decision that can move after a choice was recorded.
    // Premium is that case today, so this asserts against the real constant rather than a
    // stub — if Premium goes on sale, this block is what says so.
    expect(TIER_IS_SOLD.premium).toBe(false)
    expect(fresh({ signupTier: 'premium' })).toEqual({ prompt: false, skip: 'not-sold' })
  })

  it('ages out on the day after the window, not on it', () => {
    // ── AN OFF-BY-ONE WITH A VISIBLE COST ─────────────────────────────────────────────
    // Exactly 90 days is inside the window. `>=` here would retire the prompt a day early,
    // and the day it retires is the day nobody notices.
    const at = '2026-01-01T10:00:00Z'
    const on90 = '2026-04-01'  // 1 Jan + 90 days
    const on91 = '2026-04-02'
    expect(SIGNUP_PLAN_PROMPT_DAYS).toBe(90)

    const still = signupPlanPrompt({
      signupTier: 'plus', signupTierAt: at, dismissedAt: null,
      activeTier: 'free', today: on90,
    })
    expect(still.prompt).toBe(true)
    if (still.prompt) expect(still.ageDays).toBe(90)

    expect(signupPlanPrompt({
      signupTier: 'plus', signupTierAt: at, dismissedAt: null,
      activeTier: 'free', today: on91,
    })).toEqual({ prompt: false, skip: 'stale' })
  })

  it('does not treat clock skew as an expiry', () => {
    // The database stamps `NOW()` and the server resolves `today` separately, so an intent
    // recorded seconds ago can be a few hours AHEAD of today's date. That is the newest
    // family in the product, and a negative age must never read as stale.
    const r = signupPlanPrompt({
      signupTier: 'plus', signupTierAt: '2026-08-24T01:00:00Z', dismissedAt: null,
      activeTier: 'free', today: TODAY,
    })
    expect(r.prompt).toBe(true)
    if (r.prompt) expect(r.ageDays).toBe(0)
  })

  it('puts a decision ahead of a plan being withdrawn or stale', () => {
    // Precedence, asserted rather than assumed. A family that pressed "stay on Free" is
    // reported as having decided, not as having a stale intent — which is the reason the
    // skip is a named value instead of a boolean.
    expect(fresh({
      signupTier: 'premium',
      dismissedAt: '2026-08-23T11:00:00Z',
    })).toEqual({ prompt: false, skip: 'dismissed' })
  })
})

describe('sellablePlanParam', () => {
  it('accepts the plans that are on sale', () => {
    expect(sellablePlanParam('standard')).toBe('standard')
    expect(sellablePlanParam('plus')).toBe('plus')
  })

  it('is case and whitespace insensitive, because it reads a URL', () => {
    // `?plan=Plus` is what somebody types by hand or a campaign link carries.
    expect(sellablePlanParam(' Plus ')).toBe('plus')
    expect(sellablePlanParam('STANDARD')).toBe('standard')
  })

  it('refuses free, a plan not on sale, and anything else', () => {
    expect(sellablePlanParam('free')).toBeNull()
    expect(sellablePlanParam('premium')).toBeNull()   // priced, not sold
    expect(sellablePlanParam('platinum')).toBeNull()
    expect(sellablePlanParam(null)).toBeNull()
    expect(sellablePlanParam(undefined)).toBeNull()
    expect(sellablePlanParam(42)).toBeNull()
    expect(sellablePlanParam(['plus'])).toBeNull()
  })
})
