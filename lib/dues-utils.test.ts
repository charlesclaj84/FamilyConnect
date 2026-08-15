import { describe, expect, it } from 'vitest'
import {
  annualTotalCents,
  currentPeriodStart,
  duesPlanMath,
  installmentCents,
  type DuesScheduleLike,
  type PayCadence,
} from './dues-utils'

/**
 * The dues plan arithmetic.
 *
 * WHY THESE TESTS EXIST AT ALL: every figure a member sees about what they owe and when
 * comes out of `duesPlanMath`, and it had been wrong in three independent ways at once —
 * an amount that never looked at the calendar, a date derived from a COUNT OF LEDGER ROWS
 * rather than from money, and a ladder anchored to a schedule's original start date rather
 * than to the period whose payments were being counted against it. None of that is
 * visible by reading; all of it is obvious the moment you run a date through it.
 *
 * `today` is a parameter of the function under test, so nothing here depends on when it is
 * run. That is the whole reason the parameter exists.
 */

/** $600 a year, billed annually, opening on New Year's Day. The worked example. */
const SIX_HUNDRED: DuesScheduleLike = {
  amount_cents: 60_000,
  frequency: 'annual',
  start_date: '2026-01-01',
  end_date: null,
}

const plan = (over: {
  schedule?: DuesScheduleLike
  cadence?: PayCadence
  periodStart?: string
  today: string
  settledCents?: number
}) => duesPlanMath({
  schedule: over.schedule ?? SIX_HUNDRED,
  cadence: over.cadence ?? 'monthly',
  periodStart: over.periodStart ?? '2026-01-01',
  today: over.today,
  settledCents: over.settledCents ?? 0,
})

describe('the reported case: switching cadence part-way through the year', () => {
  // "when changing your pay cadence it should calculate when the dues started vs what
  // you've paid. the next installment should cover everything in the past so the
  // following month gets you back on schedule."
  it('bills the year to date in one installment, then the ordinary amount', () => {
    const p = plan({ today: '2026-08-14' })

    // Jan 1 through Aug 1 have all gone by: eight rungs.
    expect(p.periodsElapsed).toBe(8)
    expect(p.arrearsCents).toBe(40_000)
    expect(p.onSchedule).toBe(false)

    // September's installment carries the eight that passed plus its own.
    expect(p.nextInstallmentDate).toBe('2026-09-01')
    expect(p.nextInstallmentCents).toBe(45_000)

    // ...and from October the member is level, which is the half the report asked for.
    expect(p.followingInstallmentDate).toBe('2026-10-01')
    expect(p.followingInstallmentCents).toBe(5_000)
    expect(p.installmentCents).toBe(5_000)

    // Paying the catch-up lands them exactly on the ladder: nine rungs paid at the ninth.
    const after = plan({ today: '2026-09-01', settledCents: 45_000 })
    expect(after.onSchedule).toBe(true)
    expect(after.nextInstallmentCents).toBe(5_000)
  })

  it('nets off what has already been paid rather than re-billing it', () => {
    const p = plan({ today: '2026-08-14', settledCents: 10_000 })
    expect(p.arrearsCents).toBe(30_000)          // eight expected, two paid
    expect(p.nextInstallmentCents).toBe(35_000)  // ...plus September's
    expect(p.overdueSinceDate).toBe('2026-03-01') // the third rung is the first unmet one
  })

  it('does not move the next date on the SIZE of a payment alone', () => {
    // The bug this replaced counted ledger ROWS, so two $1 payments advanced the date by
    // two months while one $500 payment advanced it by one. Money decides now.
    const tiny = plan({ today: '2026-02-14', settledCents: 200 })
    expect(tiny.nextInstallmentDate).toBe('2026-03-01')
    expect(tiny.periodsElapsed).toBe(2)
  })

  it('is not advanced by a reversal, which is a paid row with a negative amount', () => {
    // A payment and its reversal net to zero in `settledCents`, so the plan is exactly
    // what it was before either row existed. Under the old row count, the correction
    // pushed the next due date FORWARD while the money went backward.
    const before = plan({ today: '2026-08-14', settledCents: 0 })
    const afterReversal = plan({ today: '2026-08-14', settledCents: 5_000 - 5_000 })
    expect(afterReversal).toEqual(before)
  })
})

describe('a member who is level or ahead', () => {
  it('asks for the ordinary installment when payments have kept up', () => {
    const p = plan({ today: '2026-08-14', settledCents: 40_000 })
    expect(p.onSchedule).toBe(true)
    expect(p.arrearsCents).toBe(0)
    expect(p.overdueSinceDate).toBeNull()
    expect(p.nextInstallmentCents).toBe(5_000)
    expect(p.nextInstallmentDate).toBe('2026-09-01')
  })

  it('moves the date FORWARD for someone paid up in advance', () => {
    // Five installments paid by March. The old ladder would have left the next date in
    // the past; the plan puts it at the sixth rung.
    const p = plan({ today: '2026-03-20', settledCents: 25_000 })
    expect(p.onSchedule).toBe(true)
    expect(p.nextInstallmentDate).toBe('2026-06-01')
    expect(p.nextInstallmentCents).toBe(5_000)
  })

  it('never asks for a negative amount from someone who overpaid the year', () => {
    const p = plan({ today: '2026-03-20', settledCents: 90_000 })
    expect(p.nextInstallmentCents).toBe(0)
    expect(p.nextInstallmentDate).toBeNull()
    expect(p.onSchedule).toBe(true)
  })

  it('never asks for more than the balance on the last installment', () => {
    const p = plan({ today: '2026-11-20', settledCents: 58_000 })
    expect(p.nextInstallmentCents).toBe(2_000)
  })

  it('treats a waiver exactly as money, because it settles the same obligation', () => {
    const paid = plan({ today: '2026-08-14', settledCents: 40_000 })
    const waived = plan({ today: '2026-08-14', settledCents: 40_000 })
    expect(waived).toEqual(paid)
  })
})

describe('month-end anchors', () => {
  // `setUTCMonth` overflows: from Jan 31, +1 month resolves to March 3rd. That produced a
  // ladder with no February rung and two in March, and therefore an elapsed count one
  // short — under-billing the member by a whole installment. The Accounting form prefills
  // the start date with today, so a schedule created on the 31st is ordinary.
  const MONTH_END: DuesScheduleLike = {
    amount_cents: 60_000, frequency: 'annual', start_date: '2026-01-31', end_date: null,
  }

  it('clamps to the last day of a short month instead of overflowing into the next', () => {
    const p = plan({ schedule: MONTH_END, periodStart: '2026-01-31', today: '2026-08-14' })
    expect(p.periodsElapsed).toBe(7)             // Jan 31 … Jul 31
    expect(p.nextInstallmentDate).toBe('2026-08-31')
    expect(p.arrearsCents).toBe(35_000)
  })

  it('puts the February rung ON February, not in early March', () => {
    // THE DISCRIMINATING CASE. Overflowing, the rungs are Jan 31 → "Feb 31" → Mar 3, so
    // on March 2nd only ONE rung has passed and the member is billed a month short.
    // Clamped, February's rung is the 28th and two have passed. Both the count and the
    // date differ, which is what makes this the assertion that catches a regression here.
    const p = plan({ schedule: MONTH_END, periodStart: '2026-01-31', today: '2026-03-02' })
    expect(p.periodsElapsed).toBe(2)
    expect(p.arrearsCents).toBe(10_000)
    expect(p.nextInstallmentDate).toBe('2026-03-31')
  })

  it('takes the day from the anchor each time, so February does not drag March back', () => {
    // Paid two installments, so the next rung is the third: the 31st again, not the 28th
    // February was clamped to. Carrying the clamped day forward would walk the whole
    // ladder back to the 28th for the rest of the year.
    const p = plan({
      schedule: MONTH_END, periodStart: '2026-01-31', today: '2026-03-15', settledCents: 10_000,
    })
    expect(p.onSchedule).toBe(true)
    expect(p.nextInstallmentDate).toBe('2026-03-31')
  })

  it('gives a month-end anchor the same twelve rungs as any other', () => {
    // The overflow silently produced a ladder with one fewer rung in the year, which is
    // how the under-billing happened. Walk to the end and count.
    const dates = new Set<string>()
    let settled = 0
    let date = '2026-01-31'
    for (let i = 0; i < 20 && settled < 60_000; i++) {
      const p = plan({ schedule: MONTH_END, periodStart: '2026-01-31', today: date, settledCents: settled })
      if (!p.nextInstallmentDate || p.nextInstallmentCents === 0) break
      dates.add(p.nextInstallmentDate)
      settled += p.nextInstallmentCents
      date = p.nextInstallmentDate
    }
    expect(dates.size).toBe(12)
    expect([...dates].every(d => /-(28|29|30|31)$/.test(d))).toBe(true)
  })

  it('handles a leap February', () => {
    const p = plan({
      schedule: { ...MONTH_END, start_date: '2028-01-31' },
      periodStart: '2028-01-31',
      today: '2028-02-29',
    })
    // The February rung is the 29th, and today IS that day — so it is due, not late.
    expect(p.periodsElapsed).toBe(1)
    expect(p.nextInstallmentDate).toBe('2028-02-29')
  })
})

describe('the edges that must not become phantom arrears', () => {
  it('leaves a schedule with no anchor exactly as it was: no date, no catch-up', () => {
    // `currentPeriodStart` defaults to January 1st, so building a ladder on it
    // unconditionally would give every anchorless schedule a year of arrears overnight.
    // The Accounting form writes `due_month: null, due_day: null` on every create and
    // does not require a start date, so these are real rows.
    const anchorless: DuesScheduleLike = {
      amount_cents: 5_000, frequency: 'monthly', start_date: null, end_date: null,
      due_month: null, due_day: null,
    }
    const p = duesPlanMath({
      schedule: anchorless, cadence: 'monthly',
      periodStart: currentPeriodStart(anchorless), today: '2026-08-14', settledCents: 0,
    })
    expect(p.nextInstallmentDate).toBeNull()
    expect(p.arrearsCents).toBe(0)
    expect(p.periodsElapsed).toBe(0)
    expect(p.onSchedule).toBe(true)
  })

  it('owes nothing on a schedule that has not started', () => {
    // currentPeriodStart back-steps a year for a future anniversary, so without the guard
    // this would report a full year of arrears on something nobody owes yet.
    const future: DuesScheduleLike = {
      amount_cents: 60_000, frequency: 'annual', start_date: '2026-12-01', end_date: null,
    }
    const p = duesPlanMath({
      schedule: future, cadence: 'monthly',
      periodStart: '2025-12-01', today: '2026-08-14', settledCents: 0,
    })
    expect(p.arrearsCents).toBe(0)
    expect(p.periodsElapsed).toBe(0)
    expect(p.nextInstallmentDate).toBe('2026-12-01')
  })

  it('is not late on the day an installment falls due', () => {
    const p = plan({ today: '2026-01-01' })
    expect(p.periodsElapsed).toBe(0)
    expect(p.onSchedule).toBe(true)
    expect(p.nextInstallmentDate).toBe('2026-01-01')
    expect(p.nextInstallmentCents).toBe(5_000)
  })

  it('does not declare an annual payer overdue for the whole year on day one', () => {
    const p = plan({ cadence: 'annual', today: '2026-01-01' })
    expect(p.onSchedule).toBe(true)
    expect(p.nextInstallmentCents).toBe(60_000)
    expect(p.nextInstallmentDate).toBe('2026-01-01')
  })

  it('asks for the balance today once the period’s last rung has gone by', () => {
    // No future rung is left to name, and naming a past one is the bug this replaced —
    // four consumers read `nextInstallmentDate` as a date that has not arrived.
    const p = plan({ today: '2026-12-20' })
    expect(p.periodsElapsed).toBe(12)
    expect(p.nextInstallmentDate).toBe('2026-12-20')
    expect(p.nextInstallmentCents).toBe(60_000)
    expect(p.followingInstallmentDate).toBeNull()
    expect(p.onSchedule).toBe(false)
  })

  it('never names a date past the schedule’s end', () => {
    const ending: DuesScheduleLike = {
      amount_cents: 60_000, frequency: 'annual',
      start_date: '2026-01-01', end_date: '2026-06-30',
    }
    const p = plan({ schedule: ending, today: '2026-08-14' })
    expect(p.nextInstallmentDate).toBe('2026-06-30')
  })

  it('survives a zero-amount schedule without dividing by it', () => {
    // The donation invariants force amount_cents to 0, and a mis-set dues row can be 0 too.
    const free: DuesScheduleLike = {
      amount_cents: 0, frequency: 'monthly', start_date: '2026-01-01', end_date: null,
    }
    const p = plan({ schedule: free, today: '2026-08-14' })
    expect(p.nextInstallmentCents).toBe(0)
    expect(p.arrearsCents).toBe(0)
  })
})

describe('every cadence produces a whole year of rungs', () => {
  const cases: [PayCadence, number][] = [
    ['weekly', 52], ['monthly', 12], ['quarterly', 4], ['annual', 1], ['one-time', 1],
  ]

  it.each(cases)('%s: the installments sum to at least the annual total', (cadence, n) => {
    const annual = annualTotalCents(SIX_HUNDRED)
    expect(installmentCents(annual, cadence) * n).toBeGreaterThanOrEqual(annual)
  })

  it.each(cases)('%s: a member who pays every rung finishes the year settled', (cadence) => {
    // Walked forward one rung at a time, paying exactly what is asked, to the day after
    // the period ends. Rounding UP means the final installment must clamp to the balance,
    // and this is what proves it never overshoots the annual total.
    let settled = 0
    let guard = 0
    let date = '2026-01-01'
    while (settled < 60_000 && guard++ < 60) {
      const p = plan({ cadence, today: date, settledCents: settled })
      if (!p.nextInstallmentDate || p.nextInstallmentCents === 0) break
      settled += p.nextInstallmentCents
      date = p.nextInstallmentDate
    }
    expect(settled).toBe(60_000)
    expect(plan({ cadence, today: '2027-01-01', settledCents: settled }).nextInstallmentCents).toBe(0)
  })
})

describe('currentPeriodStart, which is what the ladder is anchored to', () => {
  it('is the schedule’s own anniversary, not January 1st', () => {
    expect(currentPeriodStart({
      amount_cents: 100, frequency: 'annual', start_date: '2020-03-15',
    })).toMatch(/-03-15$/)
  })

  it('falls back to January 1st only when there is no date at all', () => {
    expect(currentPeriodStart({ amount_cents: 100, frequency: 'annual' })).toMatch(/-01-01$/)
  })
})
