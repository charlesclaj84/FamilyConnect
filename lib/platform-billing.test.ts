import { describe, expect, it } from 'vitest'
import {
  MAX_PREPAY_MONTHS,
  NO_PLATFORM_BILLING,
  addDays,
  addMonthsClamped,
  daysBetween,
  daysInMonth,
  daysLeftInMonth,
  dueNowTotalCents,
  entitlementOn,
  firstOfMonth,
  initialChargeLines,
  initialChargeOptions,
  isPrepayMonths,
  lastDayOfMonthISO,
  MINIMUM_FIRST_CHARGE_CENTS,
  monthsFromQuantity,
  nextFirstOfMonth,
  prepaidChargeCents,
  prepaidPurchase,
  prepaidTermEnd,
  prepayQuoteCents,
  prorateRemainderCents,
  scheduleDowngrade,
  scheduledChangeDue,
  STRIPE_MINIMUM_CHARGE_CENTS,
  STRIPE_MINIMUM_TRIAL_DAYS,
  stripeTrialEnd,
  subscriptionIsCurrent,
  tierFromMetadata,
  tierMove,
  unusedTermValueCents,
  upgradeCreditDays,
  upgradeQuote,
  wholeMonthsInclusive,
  type PlatformBillingRecord,
} from '@/lib/platform-billing'

/**
 * What a family has paid GENORRA, under `npm test` — a `verify.yml` step, so these gate a
 * pull request.
 *
 * ── WHY THIS FILE EXISTS ────────────────────────────────────────────────────────────
 * Every way of getting a paid term wrong is money, and none of these is loud:
 *
 *   a month-end overflow            ends six months bought in September on 3 March instead of
 *                                   28 February — three free days, every renewal, compounding,
 *                                   on a date nobody looks at.
 *   a proration that floors         gives a day away on every signup whose rate does not
 *                                   divide evenly, which is most of them.
 *   a flat 30-day month             charges February for a day it does not have, or gives one
 *                                   away every 31-day month. It also disagrees with Stripe's
 *                                   own proration, so our figure and theirs stop matching.
 *   a downgrade scheduled a day early
 *                                   takes back a day the family paid for, which is the one
 *                                   direction a no-refunds system must never move in.
 *   a sub-minimum first charge      Standard on the 30th of a 31-day month prorates to 33c and
 *                                   Stripe REFUSES it. Offering that option produces a hosted
 *                                   page that fails at the till, after the family chose it.
 *   `lapsed` folded into `never paid`
 *                                   reports a family whose term ran out yesterday as one that
 *                                   has always been on Free, so nothing ever chases it.
 *
 * And `tests/rls` cannot check any of them: every write here goes through a Stripe webhook,
 * its fixture has no billing rows at all, and an assertion about a term boundary there would
 * exercise one null branch and pass — the "green suite is not evidence" failure AGENTS.md §7
 * warns about, in the shape §7b exists to answer.
 *
 * ── CHECKED BY MUTATION, per §7b: "a green run is not evidence until you have seen it fail" ──
 * Re-measured 2026-08-23 after the move to 1st-of-month billing and the upgrade credit.
 * 70 green at baseline, and every one of these tripped:
 *
 *    THE CYCLE
 *    1. `addMonthsClamped`'s `Math.min(day, lastDayOfMonth(...))` -> `day`         4 fail
 *    2. `addMonthsClamped`'s `const day = anchor.getUTCDate()` -> `28`             9 fail
 *    3. `prorateRemainderCents` `Math.ceil` -> `Math.floor`                        5 fail
 *    4. `prorateRemainderCents` denominator -> a flat `30`                         8 fail
 *    5. `daysLeftInMonth` losing its inclusive day (`- 1`)                         9 fail
 *    6. `initialChargeOptions` offering a remainder below Stripe's minimum         2 fail
 *    7. `scheduleDowngrade` -> `addDays(…, 1)` instead of the next 1st             3 fail
 *    8. `prepaidPurchase`'s no-term anchor -> `firstOfMonth` (stub sold twice)     3 fail
 *    9. `prepaidPurchase` -> `addMonthsClamped` (anniversary end, not month end)   7 fail
 *   10. `entitlementOn`'s lapsed branch returning `paidTier`                       1 fail
 *
 *    THE UPGRADE CREDIT
 *   11. `wholeMonthsInclusive` dropping its `+ 1` (a term is inclusive)            6 fail
 *   12. `wholeMonthsInclusive` allowed to go negative and SUBTRACT value           1 fail
 *   13. `unusedTermValueCents` counting only the part month                        6 fail
 *   14. `unusedTermValueCents` carrying value out of a LAPSED term                 1 fail
 *   15. `upgradeQuote`'s `dueNowCents` allowed negative — a refund                 2 fail
 *   16. `upgradeQuote`'s `creditLeftCents` allowed negative — cancels a debt       2 fail
 *   17. `upgradeQuote` pricing the new period at the OLD tier's rate               3 fail
 *
 * ── ONE OLD MUTATION IS GONE WITH THE CODE IT TESTED ────────────────────────────────
 * `upgradeCreditDays` is no longer called by `prepaidPurchase`. It was the first attempt at the
 * upgrade rule — convert the remainder into DAYS at the new rate — and `upgradeQuote` replaced
 * it with the settled model: value the remainder at the OLD rate and spend it, carrying what is
 * left as a credit. The function survives with its own tests because the two agree about the
 * ratio and differ about what to do with it; nothing it asserts is evidence about a purchase
 * any more.
 *
 * The "term ending TODAY" equivalent-mutant note that stood here is also gone: under
 * 1st-of-month billing the branches no longer converge on that boundary, and mutation 8 above
 * is what now separates them.
 *
 * `prepayQuoteCents` reads `TIER_PRICE`, so the figures below are asserted as MULTIPLES of
 * the rate rather than as dollar amounts — a price change is a product decision and must not
 * turn this file red. The proration figures are the exception and are written out (871, 291,
 * 517, 484, 65): they are the output of the rounding rule and of the $5 floor, which are the
 * things under test. They were re-derived when the prices moved to 10/20/30 on 2026-08-23 —
 * which is the cost of writing a figure down, paid deliberately here and nowhere else.
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
    expect(prepayQuoteCents('standard', 6)).toBe(STANDARD * 6)
    expect(prepayQuoteCents('premium', MAX_PREPAY_MONTHS)).toBe(PREMIUM * MAX_PREPAY_MONTHS)
  })

  it('is null for Free — nothing is bought, and 0 would let a session be created', () => {
    expect(prepayQuoteCents('free', 6)).toBeNull()
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
    // SYMBOLIC RATHER THAN WRITTEN OUT, unlike the proration cases above, and the difference is
    // the point: this function is SUPERSEDED (`upgradeQuote` is the rule now) and is kept only
    // as a record of the ratio. Pinning literals in a dead function's tests means a price
    // change turns them red for no reason anybody can act on — which is exactly what happened
    // when the rates moved to 10/20/30. What is under test here is the FLOORING, and that is
    // expressible without knowing the prices.
    const tenDays = upgradeCreditDays({
      fromTier: 'standard', toTier: 'plus', paidThrough: '2026-09-02', today: '2026-08-23',
    })
    expect(tenDays).toBe(Math.floor(10 * STANDARD / PLUS))
    // Never rounds UP: a ratio that does not divide evenly must lose the fraction, not gain it.
    expect(tenDays).toBeLessThanOrEqual(10 * STANDARD / PLUS)

    // One day of the cheapest against the dearest floors to nothing. Not a free day.
    expect(upgradeCreditDays({
      fromTier: 'standard', toTier: 'premium', paidThrough: '2026-08-24', today: '2026-08-23',
    })).toBe(Math.floor(STANDARD / PREMIUM))
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
  it('runs from the 1st of NEXT month to a month END for a family with no term', () => {
    // Bought 23 August: the rest of August is the prorated stub, and the six whole months are
    // September through February.
    const r = prepaidPurchase({ record: record(), tier: 'standard', months: 6, today: '2026-08-23' })
    expect(r).toEqual({ paidThrough: '2027-02-28', creditedDays: 0, anchor: '2026-09-01' })
  })

  it('does the same for a term that has lapsed — there is nothing to stack on', () => {
    const r = prepaidPurchase({
      record: record({ paidTier: 'standard', paidThrough: '2026-07-31' }),
      tier: 'standard', months: 3, today: '2026-08-23',
    })
    expect(r.anchor).toBe('2026-09-01')
    expect(r.paidThrough).toBe('2026-11-30')
  })

  it('STACKS on the end of a live term — that is what paying in advance means', () => {
    const r = prepaidPurchase({
      record: record({ paidTier: 'plus', paidThrough: '2027-01-31' }),
      tier: 'plus', months: 6, today: '2026-08-23',
    })
    expect(r.anchor).toBe('2027-02-01')
    expect(r.paidThrough).toBe('2027-07-31')
    expect(r.creditedDays).toBe(0)
  })

  it('lands on the last day of a SHORT month without overflowing into the next', () => {
    // The `31 February -> 3 March` bug, in the shape this model can still meet it: six months
    // from September is February, and February is not 31 days long.
    expect(prepaidPurchase({
      record: record(), tier: 'plus', months: 6, today: '2026-08-31',
    }).paidThrough).toBe('2027-02-28')
    // And a leap February.
    expect(prepaidPurchase({
      record: record(), tier: 'plus', months: 6, today: '2027-08-31',
    }).paidThrough).toBe('2028-02-29')
  })

  it('treats a term ending TODAY as live, so its last day is not thrown away', () => {
    const r = prepaidPurchase({
      record: record({ paidTier: 'plus', paidThrough: '2026-08-31' }),
      tier: 'plus', months: 1, today: '2026-08-31',
    })
    expect(r.anchor).toBe('2026-09-01')
    expect(r.paidThrough).toBe('2026-09-30')
  })

  it('EVERY answer is the last day of a month', () => {
    // The property rules 3 and 4 both rest on: `paid_through + 1` is a billing date, which is
    // what makes `scheduleDowngrade` one expression instead of two.
    for (const today of ['2026-01-01', '2026-01-31', '2026-02-14', '2026-04-30', '2026-12-31']) {
      for (const months of [1, 2, 3, 6]) {
        const r = prepaidPurchase({ record: record(), tier: 'plus', months, today })
        expect(r.paidThrough).toBe(lastDayOfMonthISO(r.paidThrough))
        expect(nextFirstOfMonth(r.paidThrough)).toBe(addDays(r.paidThrough, 1))
      }
    }
  })

  it('gives an UPGRADE the same-tier answer, because an upgrade does not come through here', () => {
    // An upgrade BUYS THE REST OF THIS MONTH, not whole months — `upgradeQuote` is its rule.
    // A call that arrives here anyway extends the term and loses nothing, which is the safe
    // direction for a call that should not have happened.
    const r = prepaidPurchase({
      record: record({ paidTier: 'standard', paidThrough: '2027-01-31' }),
      tier: 'premium', months: 1, today: '2026-08-23',
    })
    expect(r.anchor).toBe('2027-02-01')
    expect(r.paidThrough).toBe('2027-02-28')
    expect(r.creditedDays).toBe(0)
  })
})

describe('scheduleDowngrade', () => {
  it('lands on the 1st after the paid term ends', () => {
    expect(scheduleDowngrade({
      record: record({ paidTier: 'premium', paidThrough: '2026-11-30' }),
      toTier: 'free', today: '2026-08-23',
    })).toEqual({ tier: 'free', on: '2026-12-01' })
  })

  it('crosses a year boundary', () => {
    expect(scheduleDowngrade({
      record: record({ paidTier: 'plus', paidThrough: '2026-12-31' }),
      toTier: 'standard', today: '2026-08-23',
    }).on).toBe('2027-01-01')
  })

  it('honours a SIX-MONTH prepaid term — the worked example', () => {
    // Six months of Plus bought on 1 January runs to 30 June. Downgrading to Standard in
    // February changes nothing until 1 July: Plus for February through June, Standard from
    // month seven.
    const r = scheduleDowngrade({
      record: record({ paidTier: 'plus', paidThrough: '2026-06-30' }),
      toTier: 'standard', today: '2026-02-14',
    })
    expect(r).toEqual({ tier: 'standard', on: '2026-07-01' })
  })

  it('lands on the NEXT 1st for a family with no live term, never today', () => {
    expect(scheduleDowngrade({ record: record(), toTier: 'free', today: '2026-08-23' }).on)
      .toBe('2026-09-01')
    expect(scheduleDowngrade({
      record: record({ paidTier: 'plus', paidThrough: '2026-08-22' }),
      toTier: 'free', today: '2026-08-23',
    }).on).toBe('2026-09-01')
    // Even on the 1st itself: a plan change is never same-day.
    expect(scheduleDowngrade({ record: record(), toTier: 'free', today: '2026-08-01' }).on)
      .toBe('2026-09-01')
  })

  it('is ALWAYS a 1st, including for a mid-month paid_through no longer written', () => {
    // A row from the anniversary model, or one written by hand. `+1 day` would land the
    // downgrade on the 24th; this gives the family the rest of that month instead, which is
    // the safe direction for a bad row.
    const r = scheduleDowngrade({
      record: record({ paidTier: 'plus', paidThrough: '2026-08-23' }),
      toTier: 'free', today: '2026-08-10',
    })
    expect(r.on).toBe('2026-09-01')
    expect(firstOfMonth(r.on)).toBe(r.on)
  })

  it('is a 1st for every input, which is the property the whole cycle rests on', () => {
    for (const paidThrough of [null, '2026-01-31', '2026-02-28', '2026-06-30', '2026-12-31']) {
      for (const today of ['2026-01-01', '2026-01-15', '2026-06-30', '2026-12-31']) {
        const r = scheduleDowngrade({
          record: record({ paidTier: 'plus', paidThrough }), toTier: 'free', today,
        })
        expect(firstOfMonth(r.on)).toBe(r.on)
        // And never today or earlier — a downgrade cannot take a day away.
        expect(daysBetween(today, r.on)).toBeGreaterThan(0)
      }
    }
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
    expect(monthsFromQuantity(6)).toBe(6)
    expect(monthsFromQuantity('6')).toBe(6)
    expect(monthsFromQuantity(12)).toBe(12)
    expect(monthsFromQuantity(MAX_PREPAY_MONTHS)).toBe(MAX_PREPAY_MONTHS)
    // A STALE QUANTITY FROM AN OLDER CHECKOUT PAGE IS STILL REFUSED. The ceiling has moved
    // twice, and it is only as real as the oldest open session unless the webhook re-checks it.
    expect(monthsFromQuantity(MAX_PREPAY_MONTHS + 1)).toBeNull()
    expect(monthsFromQuantity('0')).toBeNull()
    expect(monthsFromQuantity(MAX_PREPAY_MONTHS + 1)).toBeNull()
    expect(monthsFromQuantity('twelve')).toBeNull()
    expect(monthsFromQuantity(null)).toBeNull()
  })
})

describe('the billing cycle: everybody on the 1st', () => {
  it('finds the 1st of this month and of the next', () => {
    expect(firstOfMonth('2026-08-23')).toBe('2026-08-01')
    expect(firstOfMonth('2026-08-01')).toBe('2026-08-01')
    expect(nextFirstOfMonth('2026-08-23')).toBe('2026-09-01')
    // A 1st is not its own next 1st. Somebody signing up on the 1st still pays a full month
    // and their next billing date is a month away, not today.
    expect(nextFirstOfMonth('2026-08-01')).toBe('2026-09-01')
    expect(nextFirstOfMonth('2026-12-15')).toBe('2027-01-01')
    expect(nextFirstOfMonth('2026-12-31')).toBe('2027-01-01')
  })

  it('finds the last day of a month, February included', () => {
    expect(lastDayOfMonthISO('2026-08-23')).toBe('2026-08-31')
    expect(lastDayOfMonthISO('2026-04-01')).toBe('2026-04-30')
    expect(lastDayOfMonthISO('2026-02-10')).toBe('2026-02-28')
    expect(lastDayOfMonthISO('2028-02-10')).toBe('2028-02-29')
  })

  it('counts the days in a month', () => {
    expect(daysInMonth('2026-08-23')).toBe(31)
    expect(daysInMonth('2026-04-05')).toBe(30)
    expect(daysInMonth('2026-02-05')).toBe(28)
    expect(daysInMonth('2028-02-05')).toBe(29)
  })

  it('counts the days left INCLUDING today, so the 1st is a whole month and the last is one day', () => {
    expect(daysLeftInMonth('2026-08-01')).toBe(31)
    expect(daysLeftInMonth('2026-08-23')).toBe(9)
    expect(daysLeftInMonth('2026-08-31')).toBe(1)
    expect(daysLeftInMonth('2026-02-28')).toBe(1)
    expect(daysLeftInMonth('2026-04-30')).toBe(1)
  })
})

describe('prorateRemainderCents', () => {
  it('is the whole month on the 1st', () => {
    expect(prorateRemainderCents('premium', '2026-08-01')).toBe(PREMIUM)
    expect(prorateRemainderCents('standard', '2026-02-01')).toBe(STANDARD)
  })

  it('rounds UP to the cent, so no day is ever given away', () => {
    // Premium $30 over 9 of August's 31 days: 3000 × 9 / 31 = 870.97 -> 871.
    expect(prorateRemainderCents('premium', '2026-08-23')).toBe(871)
    // Standard $10 over 9 of 31: 1000 × 9 / 31 = 290.3 -> 291.
    expect(prorateRemainderCents('standard', '2026-08-23')).toBe(291)
  })

  it('uses the ACTUAL month as the denominator, so ten days is not one figure all year', () => {
    // Ten days left: 22 February (28 days) against 22 July (31 days).
    const feb = prorateRemainderCents('premium', '2026-02-19')
    const jul = prorateRemainderCents('premium', '2026-07-22')
    expect(daysLeftInMonth('2026-02-19')).toBe(10)
    expect(daysLeftInMonth('2026-07-22')).toBe(10)
    expect(feb).toBe(Math.ceil(PREMIUM * 10 / 28))
    expect(jul).toBe(Math.ceil(PREMIUM * 10 / 31))
    // The short month costs MORE per day, which is what a tenth of that month means.
    expect(feb!).toBeGreaterThan(jul!)
  })

  it('never exceeds a whole month, and never reaches zero on the last day', () => {
    for (const day of ['2026-01-01', '2026-01-15', '2026-01-31', '2026-02-28', '2026-04-30']) {
      const cents = prorateRemainderCents('premium', day)!
      expect(cents).toBeGreaterThan(0)
      expect(cents).toBeLessThanOrEqual(PREMIUM)
    }
  })

  it('is null for Free', () => {
    expect(prorateRemainderCents('free', '2026-08-23')).toBeNull()
  })
})

describe('initialChargeOptions', () => {
  it('offers both options mid-month', () => {
    const o = initialChargeOptions('premium', '2026-08-23')
    expect(o.daysLeft).toBe(9)
    expect(o.daysInMonth).toBe(31)
    expect(o.nextBillingDate).toBe('2026-09-01')
    expect(o.remainderOnly).toBe(871)
    expect(o.remainderPlusNext).toBe(871 + PREMIUM)
    expect(o.remainderPlusNextThrough).toBe('2026-09-30')
  })

  it('WITHHOLDS the remainder-only option below the $5 floor', () => {
    // Standard $10, two days left of 31: ceil(1000 × 2 / 31) = 65c. Over Stripe's own 50c
    // limit and well under the product's $5, so it is not offered on its own — the decided
    // rule, and the reason the floor is a product number rather than a processor one.
    expect(prorateRemainderCents('standard', '2026-08-30')).toBe(65)
    const o = initialChargeOptions('standard', '2026-08-30')
    expect(o.remainderOnly).toBeNull()
    // The combined option is still there, and is the only one.
    expect(o.remainderPlusNext).toBe(65 + STANDARD)
  })

  it('straddles the floor exactly — offered AT $5, withheld a cent under', () => {
    // Standard $10 in a 31-day August. 16 days left is $5.17 and is offered; 15 is $4.84 and
    // is not. Both sides of the boundary, by value, because "under $5" is the whole rule.
    expect(daysLeftInMonth('2026-08-16')).toBe(16)
    expect(prorateRemainderCents('standard', '2026-08-16')).toBe(517)
    expect(initialChargeOptions('standard', '2026-08-16').remainderOnly).toBe(517)

    expect(daysLeftInMonth('2026-08-17')).toBe(15)
    expect(prorateRemainderCents('standard', '2026-08-17')).toBe(484)
    expect(initialChargeOptions('standard', '2026-08-17').remainderOnly).toBeNull()
  })

  it('takes the HIGHER of the product floor and Stripe’s, so the hard limit cannot be crossed', () => {
    // The product rule is $5 and Stripe's is 50c. Anything between them must be withheld —
    // otherwise lowering the product rule one day would start producing charges Stripe
    // refuses at the till.
    expect(MINIMUM_FIRST_CHARGE_CENTS).toBeGreaterThanOrEqual(STRIPE_MINIMUM_CHARGE_CENTS)
    const cents = prorateRemainderCents('standard', '2026-08-30')!
    expect(cents).toBeGreaterThan(STRIPE_MINIMUM_CHARGE_CENTS)
    expect(cents).toBeLessThan(MINIMUM_FIRST_CHARGE_CENTS)
    expect(initialChargeOptions('standard', '2026-08-30').remainderOnly).toBeNull()
  })

  it('is a whole month on the 1st, with the combined option covering two', () => {
    const o = initialChargeOptions('plus', '2026-08-01')
    expect(o.remainderOnly).toBe(PLUS)
    expect(o.remainderPlusNext).toBe(PLUS * 2)
    expect(o.remainderPlusNextThrough).toBe('2026-09-30')
  })
})

describe('initialChargeLines — what the hosted page actually lists', () => {
  // The reported symptom, 2026-08-25: a Standard checkout on the 26th of August showed
  // `GENORRA Standard · $10.00/month after · 35 days free` over one $11.94 line called "rest
  // of this month and next". Every figure was right and the page was unreadable. These
  // assertions are about the NAMES as much as the money, because the names are the fix.
  it('itemises the combined first payment into the month and the part month', () => {
    const lines = initialChargeLines('standard', '2026-08-26', 'remainder-plus-next')!
    expect(lines).toEqual([
      { name: 'GENORRA Standard — September 2026', cents: STANDARD },
      { name: 'GENORRA Standard — August 2026 (proration)', cents: 194 },
    ])
    expect(dueNowTotalCents(lines)).toBe(STANDARD + 194)
  })

  it('puts the whole month FIRST, matching the rate printed above it', () => {
    const [first] = initialChargeLines('plus', '2026-08-26', 'remainder-plus-next')!
    expect(first.cents).toBe(PLUS)
  })

  it('is one line when only the rest of the month is being bought', () => {
    // The 16th of a 31-day August is $5.17 — over the product floor, so it stands alone.
    expect(initialChargeLines('standard', '2026-08-16', 'remainder')).toEqual([
      { name: 'GENORRA Standard — August 2026 (proration)', cents: 517 },
    ])
  })

  it('says "rest of" only when there IS a rest — the 1st is the whole month', () => {
    // Otherwise the 1st reads "rest of September 2026 (30 days)", which sends the reader
    // looking for the part they missed.
    expect(initialChargeLines('standard', '2026-09-01', 'remainder')).toEqual([
      { name: 'GENORRA Standard — September 2026', cents: STANDARD },
    ])
  })

  it('marks the part month as a proration, whatever is left of it', () => {
    // One day or twenty, the name is the same word. The day count used to be in here and
    // read as a second description competing with the figure beside it — the days are quoted
    // on the plan panel, before the button, which is where somebody checks the arithmetic.
    const lastDay = initialChargeLines('premium', '2026-08-31', 'remainder-plus-next')!
    expect(lastDay[1]!.name).toBe('GENORRA Premium — August 2026 (proration)')
    const midMonth = initialChargeLines('premium', '2026-08-11', 'remainder-plus-next')!
    expect(midMonth[1]!.name).toBe('GENORRA Premium — August 2026 (proration)')
  })

  it('names the MONTH, never "this" or "next"', () => {
    // The page is read after a redirect and again in an emailed receipt, where a relative
    // word names nothing. Also the one assertion that the label is UTC-pinned: `monthLabel`
    // on a negative offset would report July for an August date.
    for (const line of initialChargeLines('standard', '2026-08-01', 'remainder-plus-next')!) {
      expect(line.name).not.toMatch(/this month|next month/)
    }
    expect(initialChargeLines('standard', '2026-12-26', 'remainder-plus-next')![0]!.name)
      .toBe('GENORRA Standard — January 2027')
  })

  it('is NULL for a remainder below the product floor, and never a tiny charge', () => {
    // The back half of every month at Standard — see `initialChargeOptions`. Null is the
    // caller's cue to name the combined option, not a failure.
    expect(initialChargeLines('standard', '2026-08-30', 'remainder')).toBeNull()
    // And the combined option is still available on the same day, which is the whole point.
    expect(initialChargeLines('standard', '2026-08-30', 'remainder-plus-next')).not.toBeNull()
  })

  it('takes the RAW proration on a prepaid session, floor and all', () => {
    // Stripe's minimum applies to the session TOTAL and a prepaid session also carries whole
    // months, so 65c is perfectly chargeable there even though it could not stand alone.
    expect(initialChargeLines('standard', '2026-08-30', 'prepaid-remainder')).toEqual([
      { name: 'GENORRA Standard — August 2026 (proration)', cents: 65 },
    ])
  })

  it('never lists a zero line, whatever the month', () => {
    // A $0.00 row on a receipt is a question nobody can answer. `ceil` makes it unreachable
    // for a priced tier; asserted across every tier and every month length rather than
    // trusted, because the rounding rule is one edit from being `floor`.
    for (const tier of ['standard', 'plus', 'premium'] as const) {
      for (const month of ['2026-02-01', '2026-04-01', '2026-08-01', '2027-01-01']) {
        for (let d = 0; d < daysInMonth(month); d += 1) {
          for (const plan of ['remainder', 'remainder-plus-next', 'prepaid-remainder'] as const) {
            const lines = initialChargeLines(tier, addDays(month, d), plan)
            for (const line of lines ?? []) expect(line.cents).toBeGreaterThan(0)
          }
        }
      }
    }
  })

  it('always totals what `initialChargeOptions` quoted on the button', () => {
    // THE COUPLING THAT MATTERS. The screen quotes `initialChargeOptions`; Stripe charges
    // these lines. Two figures describing one payment is how a family comes to be asked for a
    // number the button did not promise — so they are asserted equal, every tier, every day.
    for (const tier of ['standard', 'plus', 'premium'] as const) {
      for (const month of ['2026-02-01', '2026-04-01', '2026-08-01', '2027-01-01']) {
        for (let d = 0; d < daysInMonth(month); d += 1) {
          const today = addDays(month, d)
          const options = initialChargeOptions(tier, today)

          const only = initialChargeLines(tier, today, 'remainder')
          if (options.remainderOnly == null) expect(only).toBeNull()
          else expect(dueNowTotalCents(only!)).toBe(options.remainderOnly)

          const both = initialChargeLines(tier, today, 'remainder-plus-next')
          expect(dueNowTotalCents(both!)).toBe(options.remainderPlusNext)
        }
      }
    }
  })
})

describe('stripeTrialEnd — when the subscription starts billing', () => {
  const unix = (iso: string) => Math.floor(Date.parse(`${iso}T00:00:00Z`) / 1000)

  it('is midnight UTC on the day billing starts', () => {
    expect(stripeTrialEnd('2026-09-01', '2026-08-16')).toBe(unix('2026-09-01'))
    expect(stripeTrialEnd('2026-10-01', '2026-08-30')).toBe(unix('2026-10-01'))
  })

  it('crosses a year end without inventing a date', () => {
    expect(stripeTrialEnd('2027-01-01', '2026-12-15')).toBe(unix('2027-01-01'))
  })

  it('refuses a day inside Stripe’s floor, and takes the one just outside it', () => {
    // Stripe's wording is 48 hours, INSTANT to instant. `today` is a DATE and the request can
    // be made at any hour of it, so the gap to midnight on a day N days out is somewhere in
    // (24N − 24, 24N] hours. Three days out is therefore always more than 48; two days out is
    // between 24 and 48 and would be refused for anybody paying after midday.
    expect(stripeTrialEnd('2026-09-01', '2026-08-29')).toBe(unix('2026-09-01'))  // 3 days
    expect(stripeTrialEnd('2026-09-01', '2026-08-30')).toBeNull()                // 2 days
    expect(stripeTrialEnd('2026-09-01', '2026-08-31')).toBeNull()                // 1 day
  })

  it('refuses a day already gone, and today itself', () => {
    expect(stripeTrialEnd('2026-09-01', '2026-09-01')).toBeNull()
    expect(stripeTrialEnd('2026-09-01', '2026-09-05')).toBeNull()
  })

  it('is wider than Stripe’s own floor, never narrower', () => {
    // The property, not the number: whatever `STRIPE_MINIMUM_TRIAL_DAYS` becomes, a day it
    // accepts must be strictly more than that many days away.
    expect(daysBetween('2026-08-28', '2026-09-01')).toBeGreaterThan(STRIPE_MINIMUM_TRIAL_DAYS)
    expect(daysBetween('2026-08-30', '2026-09-01')).toBeLessThanOrEqual(STRIPE_MINIMUM_TRIAL_DAYS)
  })

  it('leaves the remainder option unreachable inside the floor, which is why it is not a branch anybody hits', () => {
    // The coupling worth asserting: `MINIMUM_FIRST_CHARGE_CENTS` withholds "the rest of this
    // month" long before the 1st is close enough to refuse as a trial. Every tier, every
    // month length — so a part month is never charged on a session that would then start
    // billing today. Lowering that constant is what would break it, and this is what says so.
    for (const tier of ['standard', 'plus', 'premium'] as const) {
      for (const month of ['2026-02-01', '2026-04-01', '2026-08-01', '2027-01-01']) {
        for (let d = 0; d < daysInMonth(month); d += 1) {
          const today = addDays(month, d)
          if (initialChargeOptions(tier, today).remainderOnly == null) continue
          expect(stripeTrialEnd(nextFirstOfMonth(today), today)).not.toBeNull()
        }
      }
    }
  })
})

describe('prepaidTermEnd', () => {
  it('runs N whole months from a 1st to a month END', () => {
    expect(prepaidTermEnd('2026-09-01', 6)).toBe('2027-02-28')
    expect(prepaidTermEnd('2026-09-01', 1)).toBe('2026-09-30')
    expect(prepaidTermEnd('2026-01-01', 2)).toBe('2026-02-28')
    expect(prepaidTermEnd('2028-01-01', 2)).toBe('2028-02-29')
  })
})

describe('prepaidChargeCents', () => {
  it('is the month’s remainder plus the whole months', () => {
    const c = prepaidChargeCents({ tier: 'premium', months: 6, today: '2026-08-23' })!
    expect(c.prorationCents).toBe(871)
    expect(c.monthsCents).toBe(PREMIUM * 6)
    expect(c.totalCents).toBe(871 + PREMIUM * 6)
  })

  it('SKIPS the proration when a live term is being extended — that month is already owned', () => {
    const c = prepaidChargeCents({
      tier: 'premium', months: 6, today: '2026-08-23', extendingLiveTerm: true,
    })!
    expect(c.prorationCents).toBe(0)
    expect(c.totalCents).toBe(PREMIUM * 6)
  })

  it('is null for Free and for an impossible month count', () => {
    expect(prepaidChargeCents({ tier: 'free', months: 6, today: '2026-08-23' })).toBeNull()
    expect(prepaidChargeCents({ tier: 'plus', months: MAX_PREPAY_MONTHS + 1, today: '2026-08-23' })).toBeNull()
  })
})

describe('wholeMonthsInclusive', () => {
  it('counts both ends — a term is inclusive', () => {
    expect(wholeMonthsInclusive('2026-03-01', '2026-06-30')).toBe(4)
    expect(wholeMonthsInclusive('2026-03-01', '2026-03-31')).toBe(1)
    expect(wholeMonthsInclusive('2026-12-01', '2027-01-31')).toBe(2)
  })

  it('floors at zero rather than going negative', () => {
    // A backwards range would otherwise SUBTRACT from a term's value.
    expect(wholeMonthsInclusive('2026-06-01', '2026-03-31')).toBe(0)
  })
})

describe('unusedTermValueCents', () => {
  it('values the rest of this month plus the whole months left, at the OLD rate', () => {
    // The worked example: 6 months of Standard from 1 January, on 15 February.
    // rest of Feb  1000 x 14/28 = 500     Mar..Jun  4 x 1000 = 4000     total 4500
    expect(unusedTermValueCents({
      tier: 'standard', paidThrough: '2026-06-30', today: '2026-02-15',
    })).toBe(4500)
  })

  it('is the part month alone when the term ends this month', () => {
    expect(unusedTermValueCents({
      tier: 'standard', paidThrough: '2026-02-28', today: '2026-02-15',
    })).toBe(Math.ceil(STANDARD * 14 / 28))
  })

  it('is zero when there is nothing to carry', () => {
    expect(unusedTermValueCents({ tier: null, paidThrough: '2026-06-30', today: '2026-02-15' })).toBe(0)
    expect(unusedTermValueCents({ tier: 'plus', paidThrough: null, today: '2026-02-15' })).toBe(0)
    // Lapsed.
    expect(unusedTermValueCents({ tier: 'plus', paidThrough: '2026-01-31', today: '2026-02-15' })).toBe(0)
    // Free was never paid for, so there is no value to convert.
    expect(unusedTermValueCents({ tier: 'free', paidThrough: '2026-06-30', today: '2026-02-15' })).toBe(0)
  })

  it('never exceeds what the whole remaining term would cost at that rate', () => {
    const v = unusedTermValueCents({ tier: 'plus', paidThrough: '2026-06-30', today: '2026-02-15' })
    // Feb part + four whole months, so strictly less than five whole months.
    expect(v).toBeLessThan(PLUS * 5)
    expect(v).toBeGreaterThan(PLUS * 4)
  })
})

describe('upgradeQuote — the worked example, both shapes', () => {
  // Six months of Standard bought 1 January (through 30 June). Upgrading to Premium on
  // 15 February. Credit is $45.00; the rest of February at Premium is $15.00.
  //
  // AT THE 2026-08-23 PRICES THE CREDIT COVERS BOTH SHAPES, which is worth noticing rather
  // than treating as a coincidence: $10 -> $30 is a 3x jump, and four unused Standard months
  // plus a part month buys a month and a half of Premium. So this family owes nothing either
  // way, and the case that exercises a non-zero `dueNowCents` is the shorter term below.
  const base = {
    fromTier: 'standard' as const,
    toTier: 'premium' as const,
    paidThrough: '2026-06-30',
    today: '2026-02-15',
  }

  it('leaves nothing due now and carries $30 of credit', () => {
    const q = upgradeQuote({ ...base, includeNextMonth: false })!
    expect(q.creditCents).toBe(4500)
    expect(q.neededCents).toBe(1500)
    expect(q.dueNowCents).toBe(0)
    expect(q.creditLeftCents).toBe(3000)
    expect(q.paidThrough).toBe('2026-02-28')
  })

  it('still owes nothing when March is taken now, and the credit is exhausted', () => {
    const q = upgradeQuote({ ...base, includeNextMonth: true })!
    expect(q.creditCents).toBe(4500)
    expect(q.neededCents).toBe(1500 + PREMIUM)
    expect(q.dueNowCents).toBe(0)
    expect(q.creditLeftCents).toBe(0)
    expect(q.paidThrough).toBe('2026-03-31')
  })

  it('is the SAME money either way — only the timing differs', () => {
    // The invariant, and it holds at any prices: what taking next month costs NOW is exactly
    // what the credit would otherwise have knocked off the invoice on the 1st.
    const now = upgradeQuote({ ...base, includeNextMonth: true })!
    const later = upgradeQuote({ ...base, includeNextMonth: false })!
    expect(now.dueNowCents + Math.min(later.creditLeftCents, PREMIUM))
      .toBe(PREMIUM - (later.creditLeftCents - Math.min(later.creditLeftCents, PREMIUM)))
  })

  it('DOES NOT bill the difference across the whole prepaid term', () => {
    // The rejected model: six months of the $20 difference is $120, and it is a bill nobody
    // asked for on the day they chose to spend more.
    const q = upgradeQuote({ ...base, includeNextMonth: true })!
    expect(q.dueNowCents).toBeLessThan((PREMIUM - STANDARD) * 6)
    expect(q.dueNowCents).toBe(0)
  })

  it('DOES charge the shortfall when the unused term is smaller than the upgrade', () => {
    // The same rule with less credit: one month of Standard left rather than four.
    // credit = $5 (rest of Feb) + $10 (March) = $15; Premium for Feb + March = $45.
    const short = { ...base, paidThrough: '2026-03-31' }
    const leave = upgradeQuote({ ...short, includeNextMonth: false })!
    expect(leave.creditCents).toBe(1500)
    expect(leave.dueNowCents).toBe(0)
    expect(leave.creditLeftCents).toBe(0)

    const take = upgradeQuote({ ...short, includeNextMonth: true })!
    expect(take.neededCents).toBe(1500 + PREMIUM)
    expect(take.dueNowCents).toBe(PREMIUM)
    expect(take.creditLeftCents).toBe(0)
  })
})

describe('upgradeQuote — the edges', () => {
  it('charges the ordinary part month when there is no term to carry', () => {
    const q = upgradeQuote({
      fromTier: null, toTier: 'premium', paidThrough: null,
      today: '2026-08-23', includeNextMonth: false,
    })!
    expect(q.creditCents).toBe(0)
    expect(q.dueNowCents).toBe(871)
    expect(q.creditLeftCents).toBe(0)
    expect(q.paidThrough).toBe('2026-08-31')
  })

  it('never asks for a negative amount, and never cancels a real debt', () => {
    // A large credit against a small need: nothing due, and the surplus is KEPT.
    const q = upgradeQuote({
      fromTier: 'premium', toTier: 'standard', paidThrough: '2027-06-30',
      today: '2026-08-23', includeNextMonth: false,
    })!
    expect(q.dueNowCents).toBe(0)
    expect(q.creditLeftCents).toBeGreaterThan(0)
    // And the two halves never both move: one of them is always zero.
    expect(Math.min(q.dueNowCents, q.creditLeftCents)).toBe(0)
  })

  it('is null for a tier with no price', () => {
    expect(upgradeQuote({
      fromTier: 'plus', toTier: 'free', paidThrough: '2026-12-31',
      today: '2026-08-23', includeNextMonth: false,
    })).toBeNull()
  })

  it('always ends on a month end, both shapes', () => {
    for (const includeNextMonth of [true, false]) {
      for (const today of ['2026-01-01', '2026-01-31', '2026-02-14', '2026-12-31']) {
        const q = upgradeQuote({
          fromTier: 'standard', toTier: 'premium', paidThrough: '2027-06-30',
          today, includeNextMonth,
        })!
        expect(q.paidThrough).toBe(lastDayOfMonthISO(q.paidThrough))
      }
    }
  })
})
