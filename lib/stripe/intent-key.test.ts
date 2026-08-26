import { describe, expect, it } from 'vitest'

import { intentKey } from '@/lib/stripe/client'

/**
 * The idempotency key, and the two ways it has been wrong.
 *
 * ── WHY THIS IS TESTED AT ALL ───────────────────────────────────────────────────────
 * A key that is too FRESH silently creates two subscriptions for one button press. A key that
 * is too STABLE either refuses the request outright or replays a stale one. Both failures are
 * about a string, both are invisible until Stripe is on the other end of it, and both have
 * now happened:
 *
 *   * 2026-08-25, LOUD. `startPlanCheckout`'s session parameters changed — the billing cycle
 *     anchor became a trial — and Stripe refused every family that had attempted a checkout in
 *     the previous 24 hours: *"Keys for idempotent requests can only be used with the same
 *     parameters they were first used with."* The key named the intent, which had not changed.
 *   * QUIETER, and found while fixing the first: the part month is prorated by the day, so a
 *     family that opened checkout on the 10th and came back on the 11th was replayed the 10th's
 *     session — quoting the 10th's figure, which is not what the button in front of them said.
 *
 * Both are one defect: the amount and the shape of the request were outside the key.
 *
 * CHECKED BY MUTATION, each tripping a different case:
 *   * `body` ignored (return the named parts always)          3 failed
 *   * the digest used as the WHOLE key, parts dropped         1 failed
 *   * the digest taken from `parts` rather than `body`        2 failed
 */
describe('intentKey', () => {
  it('is stable for the same intent, which is what stops a double click buying twice', () => {
    expect(intentKey(['plan', '4BEZ2S', 'standard', 'recurring', 1]))
      .toBe(intentKey(['plan', '4BEZ2S', 'standard', 'recurring', 1]))
    expect(intentKey(['plan', '4BEZ2S', 'standard', 'recurring', 1], { amount: 517 }))
      .toBe(intentKey(['plan', '4BEZ2S', 'standard', 'recurring', 1], { amount: 517 }))
  })

  it('names the intent in front, so a key in the Dashboard is traceable', () => {
    expect(intentKey(['plan', '4BEZ2S', 'standard', 'recurring', 1]))
      .toBe('genorra:plan:4BEZ2S:standard:recurring:1')
    expect(intentKey(['plan', '4BEZ2S', 'standard', 'recurring', 1], { amount: 517 }))
      .toMatch(/^genorra:plan:4BEZ2S:standard:recurring:1:[0-9a-f]{12}$/)
  })

  it('separates two families, two tiers and two term lengths', () => {
    const base = intentKey(['plan', '4BEZ2S', 'standard', 'recurring', 1])
    expect(intentKey(['plan', 'OTHER1', 'standard', 'recurring', 1])).not.toBe(base)
    expect(intentKey(['plan', '4BEZ2S', 'plus', 'recurring', 1])).not.toBe(base)
    expect(intentKey(['plan', '4BEZ2S', 'standard', 'prepaid', 1])).not.toBe(base)
    expect(intentKey(['plan', '4BEZ2S', 'standard', 'recurring', 12])).not.toBe(base)
  })

  it('MOVES when the request body changes, which is the refusal of 2026-08-25', () => {
    // The same family, tier, mode and months — the naming parts are identical, and were still
    // true. What changed underneath was the session: an anchor plus a proration flag became a
    // trial. Stripe compares the BODY, so the key has to as well.
    const parts = ['plan', '4BEZ2S', 'standard', 'recurring', 1] as const
    const anchored = intentKey(parts, {
      subscription_data: { billing_cycle_anchor_config: { day_of_month: 1 }, proration_behavior: 'none' },
    })
    const trialled = intentKey(parts, {
      subscription_data: { trial_end: 1_788_220_800 },
    })
    expect(trialled).not.toBe(anchored)
  })

  it('MOVES when the part month does, so yesterday’s quote is never replayed', () => {
    // The quieter half. `prorateRemainderCents` is by the day, so the figure on the button
    // differs between today and yesterday while every naming part stays the same.
    const parts = ['plan', '4BEZ2S', 'standard', 'recurring', 1] as const
    const tenth = intentKey(parts, { line_items: [{ price_data: { unit_amount: 710 } }] })
    const eleventh = intentKey(parts, { line_items: [{ price_data: { unit_amount: 678 } }] })
    expect(eleventh).not.toBe(tenth)
  })

  it('stays inside Stripe’s 255-character limit', () => {
    const long = intentKey([...Array(60).keys()].map(n => `part-number-${n}`), { a: 1 })
    expect(long.length).toBeLessThanOrEqual(255)
  })

  it('is not a clock or a random value, which would defeat the whole mechanism', () => {
    // The rule the doc comment states, asserted rather than trusted: two calls a moment apart
    // with identical inputs must agree. A `Date.now()` or a `randomUUID()` anywhere in here
    // would look like idempotency and provide none.
    const first = intentKey(['dues-once', 'p1', 's1', 2500], { amount: 2500 })
    const second = intentKey(['dues-once', 'p1', 's1', 2500], { amount: 2500 })
    expect(second).toBe(first)
  })
})
