import { describe, expect, it } from 'vitest'
import {
  MAX_PREPAY_MONTHS,
  NO_PLATFORM_BILLING,
  addDays,
  addMonthsClamped,
  daysBetween,
  entitlementOn,
  isPrepayMonths,
  monthsFromQuantity,
  prepaidPurchase,
  prepayQuoteCents,
  scheduleDowngrade,
  scheduledChangeDue,
  subscriptionIsCurrent,
  tierFromMetadata,
  tierMove,
  upgradeCreditDays,
  type PlatformBillingRecord,
} from '@/lib/platform-billing'

/**
 * What a family has paid GENORRA, under `npm test` — a `verify.yml` step, so these gate a
 * pull request.
 *
 * ── WHY THIS FILE EXISTS ────────────────────────────────────────────────────────────
 * Every way of getting a paid term wrong is money, and none of the four is loud:
 *
 *   a month-end overflow            ends a year bought on 31 January on 3 February the
 *                                   following year — three free days, every renewal,
 *                                   compounding, on a date nobody looks at.
 *   an upgrade that stacks          gives eleven months of Premium for ten of Standard plus
 *                                   one of Premium. At a 5:1 price ratio that is not a
 *                                   rounding error, it is a way to buy the dearest tier at
 *                                   the cheapest tier's price.
 *   a downgrade scheduled a day early
 *                                   takes back a day the family paid for, which is the one
 *                                   direction a no-refunds system must never move in.
 *   `lapsed` folded into `never paid`
 *                                   reports a family whose term ran out yesterday as one
 *                                   that has always been on Free, so nothing ever chases it.
 *
 * And `tests/rls` cannot check any of them: every write here goes through a Stripe webhook,
 * its fixture has no billing rows at all, and an assertion about a term boundary there would
 * exercise one null branch and pass — the "green suite is not evidence" failure AGENTS.md §7
 * warns about, in the shape §7b exists to answer.
 *
 * ── CHECKED BY MUTATION, per §7b: "a green run is not evidence until you have seen it fail" ──
 * Measured 2026-08-23, 38 assertions green at baseline:
 *
 *   1. `addMonthsClamped`'s `Math.min(day, lastDayOfMonth(...))` -> `day`      4 fail
 *   2. `addMonthsClamped`'s `const day = anchor.getUTCDate()` -> `28`         9 fail
 *   3. `upgradeCreditDays` `Math.floor` -> `Math.ceil`                        2 fail
 *   4. `upgradeCreditDays` returning `remaining` (stacking, not converting)   5 fail
 *   5. `prepaidPurchase`'s upgrade branch anchored on `record.paidThrough`    2 fail
 *   6. `scheduleDowngrade`'s `addDays(paidThrough, 1)` -> `paidThrough`       3 fail
 *   7. `entitlementOn`'s lapsed branch returning `paidTier`                   1 fail
 *
 * ── AND TWO MUTATIONS SURVIVED, WHICH IS RECORDED RATHER THAN PAPERED OVER ──────────
 * Both are on the "a term ending TODAY" boundary, and both are provably EQUIVALENT rather
 * than uncovered — the arithmetic converges there, so no assertion could tell them apart:
 *
 *   `prepaidPurchase`'s `live` test `>= 0` -> `> 0`        0 fail
 *   `upgradeCreditDays`'s `remaining <= 0` -> `< 0`        0 fail
 *
 * When `paidThrough === today` every branch of `prepaidPurchase` anchors on today: the dead
 * branch anchors there by definition, the same-tier branch anchors on `paidThrough` which IS
 * today, and the upgrade branch anchors on `today + creditDays` where the credit is
 * `floor(0 × rate)` = 0. Likewise `floor(0 × a / b)` is 0 whichever guard admits it.
 *
 * So the two comparisons are written the way they are for what they SAY — a term is live
 * through its last day — and not because a test is holding them there. Anybody widening
 * either one past that boundary is on their own, which is the honest state and is why it is
 * written down instead of being reported as eight clean kills. The three cases named "TODAY"
 * below still earn their place: they pin the ANSWER at the boundary, which is what would
 * change if the anchor logic were restructured rather than nudged.
 *
 * `prepayQuoteCents` reads `TIER_PRICE`, so the figures below are asserted as MULTIPLES of
 * the rate rather than as dollar amounts — a price change is a product decision and must not
 * turn this file red.
 */

// Standard $5, Plus $15, Premium $25 a month as at 2026-08-23. Read from the module under
// test rather than restated, for the reason above.
import { TIER_PRICE } from '@/lib/plans'

const STANDARD = TIER_PRICE.standard!.monthlyCents
const PLUS = TIER_PRICE.plus!.monthlyCents
const PREMIUM = TIER_PRICE.premium!.monthlyCents

function record(over: Partial<PlatformBillingRecord> = {}): PlatformBillingRecord {
  return { ...NO_PLATFORM_BILLING, ...over }
}

describe('addMonthsClamped', () => {
  it('is the same day of the month where that day exists', () => {
    expect(addMonthsClamped('2026-03-15', 1)).toBe('2026-04-15')
    expect(addMonthsClamped('2026-03-15', 12)).toBe('2027-03-15')
  })

  it('clamps to the end of a shorter month rather than overflowing into the next', () => {
    // The bug this exists for: setUTCMonth resolves "31 February" to 3 March.
    expect(addMonthsClamped('2026-01-31', 1)).toBe('2026-02-28')
    expect(addMonthsClamped('2026-01-31', 3)).toBe('2026-04-30')
    expect(addMonthsClamped('2026-05-31', 1)).toBe('2026-06-30')
  })

  it('clamps February to 29 in a leap year', () => {
    expect(addMonthsClamped('2028-01-31', 1)).toBe('2028-02-29')
  })

  it('takes the day from the ANCHOR, so a clamped month does not drag the next one back', () => {
    // Two separate calls from one anchor, which is how a term is extended: +1 clamps to the
    // 28th and +2 must still be the 31st, not the 28th.
    expect(addMonthsClamped('2026-01-31', 1)).toBe('2026-02-28')
    expect(addMonthsClamped('2026-01-31', 2)).toBe('2026-03-31')
  })

  it('crosses a year boundary', () => {
    expect(addMonthsClamped('2026-12-15', 1)).toBe('2027-01-15')
    expect(addMonthsClamped('2026-11-30', 36)).toBe('2029-11-30')
  })
})

describe('addDays and daysBetween', () => {
  it('counts days crossed, not days covered', () => {
    expect(daysBetween('2026-08-23', '2026-08-23')).toBe(0)
    expect(daysBetween('2026-08-23', '2026-08-24')).toBe(1)
    expect(daysBetween('2026-08-24', '2026-08-23')).toBe(-1)
  })

  it('crosses months and a leap day', () => {
    expect(addDays('2026-08-31', 1)).toBe('2026-09-01')
    expect(daysBetween('2028-02-28', '2028-03-01')).toBe(2)
  })
})

describe('prepayQuoteCents', () => {
  it('is the monthly rate times the months', () => {
    expect(prepayQuoteCents('standard', 1)).toBe(STANDARD)
    expect(prepayQuoteCents('standard', 12)).toBe(STANDARD * 12)
    expect(prepayQuoteCents('premium', MAX_PREPAY_MONTHS)).toBe(PREMIUM * MAX_PREPAY_MONTHS)
  })

  it('is null for Free — nothing is bought, and 0 would let a session be created', () => {
    expect(prepayQuoteCents('free', 12)).toBeNull()
  })

  it('is null for a month count this product will not accept', () => {
    expect(prepayQuoteCents('plus', 0)).toBeNull()
    expect(prepayQuoteCents('plus', 1.5)).toBeNull()
    expect(prepayQuoteCents('plus', MAX_PREPAY_MONTHS + 1)).toBeNull()
  })
})

describe('isPrepayMonths', () => {
  it('takes whole months from one to the ceiling and nothing else', () => {
    expect(isPrepayMonths(1)).toBe(true)
    expect(isPrepayMonths(MAX_PREPAY_MONTHS)).toBe(true)
    expect(isPrepayMonths(0)).toBe(false)
    expect(isPrepayMonths(-3)).toBe(false)
    expect(isPrepayMonths(2.5)).toBe(false)
    expect(isPrepayMonths(MAX_PREPAY_MONTHS + 1)).toBe(false)
    expect(isPrepayMonths('12')).toBe(false)
    expect(isPrepayMonths(Number.NaN)).toBe(false)
    expect(isPrepayMonths(Number.POSITIVE_INFINITY)).toBe(false)
  })
})

describe('tierMove', () => {
  it('reads the rank, so a tier inserted in the middle re-ranks with no edit', () => {
    expect(tierMove('free', 'standard')).toBe('upgrade')
    expect(tierMove('standard', 'premium')).toBe('upgrade')
    expect(tierMove('premium', 'standard')).toBe('downgrade')
    expect(tierMove('plus', 'plus')).toBe('same')
  })

  it('treats a family that has never paid as coming from Free', () => {
    expect(tierMove(null, 'standard')).toBe('upgrade')
    expect(tierMove(null, 'free')).toBe('same')
  })
})

describe('upgradeCreditDays', () => {
  it('converts the remainder at the new tier’s rate', () => {
    // 100 days of Standard ($5) is $500/30... no: the daily rates cancel.
    // 100 × 500 / 2500 = 20 days of Premium.
    expect(upgradeCreditDays({
      fromTier: 'standard', toTier: 'premium', paidThrough: '2026-12-01', today: '2026-08-23',
    })).toBe(Math.floor(daysBetween('2026-08-23', '2026-12-01') * STANDARD / PREMIUM))
  })

  it('floors, so an upgrade never hands out a free day', () => {
    // 10 days of Standard against Plus is 10 × 500/1500 = 3.33 -> 3.
    expect(upgradeCreditDays({
      fromTier: 'standard', toTier: 'plus', paidThrough: '2026-09-02', today: '2026-08-23',
    })).toBe(3)
    // 1 day of Standard against Premium is 0.2 -> 0. Not a free day.
    expect(upgradeCreditDays({
      fromTier: 'standard', toTier: 'premium', paidThrough: '2026-08-24', today: '2026-08-23',
    })).toBe(0)
  })

  it('is never more than the days remaining when moving up', () => {
    const remaining = daysBetween('2026-08-23', '2027-08-23')
    const credit = upgradeCreditDays({
      fromTier: 'plus', toTier: 'premium', paidThrough: '2027-08-23', today: '2026-08-23',
    })
    expect(credit).toBeLessThan(remaining)
    expect(credit).toBe(Math.floor(remaining * PLUS / PREMIUM))
  })

  it('is zero when there is nothing to carry', () => {
    expect(upgradeCreditDays({ fromTier: null, toTier: 'plus', paidThrough: null, today: '2026-08-23' })).toBe(0)
    // Free was never paid for, so there is no value to convert.
    expect(upgradeCreditDays({ fromTier: 'free', toTier: 'plus', paidThrough: '2027-01-01', today: '2026-08-23' })).toBe(0)
    // A term that already ran out.
    expect(upgradeCreditDays({ fromTier: 'plus', toTier: 'premium', paidThrough: '2026-08-01', today: '2026-08-23' })).toBe(0)
    // A term ending TODAY has no days left to convert.
    expect(upgradeCreditDays({ fromTier: 'plus', toTier: 'premium', paidThrough: '2026-08-23', today: '2026-08-23' })).toBe(0)
  })
})

describe('prepaidPurchase', () => {
  it('counts from TODAY for a family with no term', () => {
    const r = prepaidPurchase({ record: record(), tier: 'standard', months: 12, today: '2026-08-23' })
    expect(r).toEqual({ paidThrough: '2027-08-23', creditedDays: 0, anchor: '2026-08-23' })
  })

  it('counts from TODAY for a term that has lapsed', () => {
    const r = prepaidPurchase({
      record: record({ paidTier: 'standard', paidThrough: '2026-07-31' }),
      tier: 'standard', months: 3, today: '2026-08-23',
    })
    expect(r.anchor).toBe('2026-08-23')
    expect(r.paidThrough).toBe('2026-11-23')
  })

  it('STACKS on the end of a live term at the same tier — that is what paying in advance means', () => {
    const r = prepaidPurchase({
      record: record({ paidTier: 'plus', paidThrough: '2027-01-31' }),
      tier: 'plus', months: 12, today: '2026-08-23',
    })
    expect(r.anchor).toBe('2027-01-31')
    expect(r.paidThrough).toBe('2028-01-31')
    expect(r.creditedDays).toBe(0)
  })

  it('stacks through a month-end clamp without losing the anchor day', () => {
    const r = prepaidPurchase({
      record: record({ paidTier: 'plus', paidThrough: '2026-12-31' }),
      tier: 'plus', months: 2, today: '2026-08-23',
    })
    expect(r.paidThrough).toBe('2027-02-28')
  })

  it('treats a term ending TODAY as live, so its last day is not thrown away', () => {
    const r = prepaidPurchase({
      record: record({ paidTier: 'plus', paidThrough: '2026-08-23' }),
      tier: 'plus', months: 1, today: '2026-08-23',
    })
    expect(r.anchor).toBe('2026-08-23')
    expect(r.paidThrough).toBe('2026-09-23')
  })

  it('an UPGRADE starts today and carries the remainder as converted days, never as months', () => {
    // 100 days of Standard left, moving to Premium: 100 × 500/2500 = 20 days credit.
    const today = '2026-08-23'
    const paidThrough = addDays(today, 100)
    const r = prepaidPurchase({
      record: record({ paidTier: 'standard', paidThrough }),
      tier: 'premium', months: 1, today,
    })
    expect(r.creditedDays).toBe(20)
    expect(r.anchor).toBe(addDays(today, 20))
    expect(r.paidThrough).toBe(addMonthsClamped(addDays(today, 20), 1))
  })

  it('an upgrade cannot buy the dearer tier at the cheaper tier’s price', () => {
    // The exploit: ten months of Standard plus one month of Premium must NOT yield eleven
    // months of Premium.
    const today = '2026-08-23'
    const paidThrough = addMonthsClamped(today, 10)
    const stacked = addMonthsClamped(paidThrough, 1)
    const r = prepaidPurchase({
      record: record({ paidTier: 'standard', paidThrough }),
      tier: 'premium', months: 1, today,
    })
    expect(daysBetween(today, r.paidThrough)).toBeLessThan(daysBetween(today, stacked))
    // And the value carried is the value paid: 10 months of Standard buys 2 of Premium.
    expect(r.creditedDays).toBe(Math.floor(daysBetween(today, paidThrough) * STANDARD / PREMIUM))
  })

  it('an upgrade from a lapsed term carries nothing', () => {
    const r = prepaidPurchase({
      record: record({ paidTier: 'standard', paidThrough: '2026-01-01' }),
      tier: 'premium', months: 6, today: '2026-08-23',
    })
    expect(r.creditedDays).toBe(0)
    expect(r.anchor).toBe('2026-08-23')
  })
})

describe('scheduleDowngrade', () => {
  it('lands the day AFTER the paid term ends, because paid_through is inclusive', () => {
    const r = scheduleDowngrade({
      record: record({ paidTier: 'premium', paidThrough: '2026-11-30' }),
      toTier: 'free', today: '2026-08-23',
    })
    expect(r).toEqual({ tier: 'free', on: '2026-12-01' })
  })

  it('crosses a year boundary', () => {
    const r = scheduleDowngrade({
      record: record({ paidTier: 'plus', paidThrough: '2026-12-31' }),
      toTier: 'standard', today: '2026-08-23',
    })
    expect(r?.on).toBe('2027-01-01')
  })

  it('schedules for tomorrow when the term ends today, never for today', () => {
    const r = scheduleDowngrade({
      record: record({ paidTier: 'plus', paidThrough: '2026-08-23' }),
      toTier: 'free', today: '2026-08-23',
    })
    expect(r?.on).toBe('2026-08-24')
  })

  it('is null when there is no term to protect, so the caller applies it at once', () => {
    expect(scheduleDowngrade({ record: record(), toTier: 'free', today: '2026-08-23' })).toBeNull()
    expect(scheduleDowngrade({
      record: record({ paidTier: 'plus', paidThrough: '2026-08-22' }),
      toTier: 'free', today: '2026-08-23',
    })).toBeNull()
  })
})

describe('entitlementOn', () => {
  it('reports Free and a null remainder for a family that never paid', () => {
    expect(entitlementOn(record(), '2026-08-23'))
      .toEqual({ tier: 'free', lapsed: false, daysRemaining: null })
  })

  it('reports the paid tier while the term runs, including its last day', () => {
    const r = record({ paidTier: 'plus', paidThrough: '2026-08-23' })
    expect(entitlementOn(r, '2026-08-23')).toEqual({ tier: 'plus', lapsed: false, daysRemaining: 0 })
    expect(entitlementOn(r, '2026-08-01').daysRemaining).toBe(22)
  })

  it('reports FREE and lapsed once the term has run out — not the tier that was paid for', () => {
    const r = record({ paidTier: 'premium', paidThrough: '2026-08-22' })
    expect(entitlementOn(r, '2026-08-23')).toEqual({ tier: 'free', lapsed: true, daysRemaining: 0 })
  })

  it('distinguishes lapsed from never-paid, which is the whole reason daysRemaining is nullable', () => {
    const never = entitlementOn(record(), '2026-08-23')
    const lapsed = entitlementOn(record({ paidTier: 'plus', paidThrough: '2026-01-01' }), '2026-08-23')
    expect(never.lapsed).toBe(false)
    expect(never.daysRemaining).toBeNull()
    expect(lapsed.lapsed).toBe(true)
    expect(lapsed.daysRemaining).toBe(0)
  })
})

describe('scheduledChangeDue', () => {
  it('is true on the day and after, false before', () => {
    const r = record({ scheduledTier: 'free', scheduledTierOn: '2026-09-01' })
    expect(scheduledChangeDue(r, '2026-08-31')).toBe(false)
    expect(scheduledChangeDue(r, '2026-09-01')).toBe(true)
    expect(scheduledChangeDue(r, '2026-09-02')).toBe(true)
  })

  it('is false when nothing is scheduled, and when only half of the pair is set', () => {
    expect(scheduledChangeDue(record(), '2026-09-01')).toBe(false)
    expect(scheduledChangeDue(record({ scheduledTier: 'free' }), '2026-09-01')).toBe(false)
    expect(scheduledChangeDue(record({ scheduledTierOn: '2026-09-01' }), '2026-09-01')).toBe(false)
  })
})

describe('subscriptionIsCurrent', () => {
  it('counts active and trialing, and nothing else', () => {
    expect(subscriptionIsCurrent('active')).toBe(true)
    expect(subscriptionIsCurrent('trialing')).toBe(true)
    // past_due is a charge that FAILED and is still being retried. Not paid up.
    expect(subscriptionIsCurrent('past_due')).toBe(false)
    expect(subscriptionIsCurrent('unpaid')).toBe(false)
    expect(subscriptionIsCurrent('canceled')).toBe(false)
    expect(subscriptionIsCurrent('incomplete')).toBe(false)
    expect(subscriptionIsCurrent(null)).toBe(false)
    expect(subscriptionIsCurrent(undefined)).toBe(false)
  })
})

describe('reading Stripe’s own strings back', () => {
  it('narrows a tier out of metadata and refuses anything else', () => {
    expect(tierFromMetadata('plus')).toBe('plus')
    expect(tierFromMetadata('PLUS')).toBeNull()
    expect(tierFromMetadata('enterprise')).toBeNull()
    expect(tierFromMetadata(undefined)).toBeNull()
    expect(tierFromMetadata(3)).toBeNull()
  })

  it('takes a quantity as a number or a numeric string, and refuses the rest', () => {
    expect(monthsFromQuantity(12)).toBe(12)
    expect(monthsFromQuantity('12')).toBe(12)
    expect(monthsFromQuantity('0')).toBeNull()
    expect(monthsFromQuantity(MAX_PREPAY_MONTHS + 1)).toBeNull()
    expect(monthsFromQuantity('twelve')).toBeNull()
    expect(monthsFromQuantity(null)).toBeNull()
  })
})
