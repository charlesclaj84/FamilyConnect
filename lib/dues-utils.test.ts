import { describe, expect, it } from 'vitest'
import {
  ageShareOfPeriod,
  duesEligibility,
  duesScope,
  duesScopeMatch,
  annualTotalCents,
  currentPeriodStart,
  duesPlanMath,
  installmentCents,
  proratedAnnualCents,
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
 *
 * ── THE SCOPE BLOCK WAS CHECKED BY MUTATION, per AGENTS.md §7b ──────────────────────
 * A green run is not evidence until it has been seen to fail. Four mutations of
 * `lib/dues-utils.ts`, each run against the whole suite; observed results, not expected:
 *
 *   `if (!chapterId) return 'no-chapter'` -> `'owed'`
 *      2 failed — this file's "NO chapter" case and dues-projection's
 *   dropping `memberRegion !== null &&` from the regional comparison
 *      1 failed — "never matches a regional due whose own region is missing", which is the
 *      one shape that would otherwise bill a member under National for a region's levy
 *   the chapter comparison replaced by `return 'owed'`
 *      6 failed across both files
 *   `duesScope` returning the raw column instead of normalizing it
 *      1 failed — "reads everything else as national"
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

// ── The age rule ────────────────────────────────────────────────────────────────────
//
// "an annual due is $120, if the child turns 18 in July they are responsible for 5
// months of that 120. then the full due each year after that."
//
// Every case below is a property of a BIRTHDAY and a PERIOD and nothing else — no
// `today` — which is the point of the shape: the answer must not move halfway through a
// period, or a member's balance would change on their birthday.

/** $120 a year, billed annually, opening on New Year's Day. The worked example. */
const ONE_TWENTY: DuesScheduleLike = {
  amount_cents: 12_000,
  frequency: 'annual',
  start_date: '2026-01-01',
  end_date: null,
  start_age: 18,
}

const share = (dateOfBirth: string | null, over: {
  startAge?: number | null
  periodStart?: string
} = {}) => ageShareOfPeriod({
  startAge: over.startAge === undefined ? 18 : over.startAge,
  dateOfBirth,
  periodStart: over.periodStart ?? '2026-01-01',
})

describe('the reported case: a child who turns 18 part-way through the year', () => {
  it('charges the months AFTER the birthday month — five twelfths for July', () => {
    const s = share('2008-07-04')

    expect(s.responsibleFrom).toBe('2026-07-04')
    expect(s.monthsOwed).toBe(5)
    expect(s.prorated).toBe(true)
    expect(s.exempt).toBe(false)
    expect(proratedAnnualCents(annualTotalCents(ONE_TWENTY), s)).toBe(5_000)
  })

  it('charges the full year every year after', () => {
    const next = share('2008-07-04', { periodStart: '2027-01-01' })

    expect(next.monthsOwed).toBe(12)
    expect(next.prorated).toBe(false)
    expect(proratedAnnualCents(annualTotalCents(ONE_TWENTY), next)).toBe(12_000)
  })

  it('charges nothing in the years before', () => {
    const before = share('2008-07-04', { periodStart: '2025-01-01' })

    expect(before.monthsOwed).toBe(0)
    expect(before.exempt).toBe(true)
    expect(proratedAnnualCents(annualTotalCents(ONE_TWENTY), before)).toBe(0)
  })

  // The rung the member is billed on is still `duesPlanMath`'s business, and it has to
  // build its ladder out of the PRORATED figure or the two disagree: monthly on $50 is
  // not monthly on $120 divided twelve ways.
  it('feeds the prorated figure through the installment ladder', () => {
    const s = share('2008-07-04')
    const annual = proratedAnnualCents(annualTotalCents(ONE_TWENTY), s)

    const p = duesPlanMath({
      schedule: ONE_TWENTY,
      cadence: 'annual',
      periodStart: '2026-01-01',
      today: '2026-08-14',
      settledCents: 0,
      annualCents: annual,
    })

    expect(p.installmentCents).toBe(5_000)
    expect(p.nextInstallmentCents).toBe(5_000)
  })
})

describe('the boundaries of a period', () => {
  it('is exempt when the birthday falls in the last month — there is no month after it', () => {
    const s = share('2008-12-20')

    expect(s.monthsOwed).toBe(0)
    // Exempt AND inside this period, which is the pair a reader needs to tell apart from
    // a child who does not reach the age until next year.
    expect(s.exempt).toBe(true)
    expect(s.responsibleFrom).toBe('2026-12-20')
  })

  it('charges eleven twelfths for a January birthday', () => {
    expect(share('2008-01-15').monthsOwed).toBe(11)
  })

  it('charges the whole period when the birthday is its first day', () => {
    // `responsibleFrom <= periodStart` — already liable when the period opened, which is
    // the ordinary case for every adult and every year after the first.
    expect(share('2008-01-01').monthsOwed).toBe(12)
  })

  it('charges nothing when the age is reached on the day the NEXT period opens', () => {
    const s = share('2009-01-01')
    expect(s.responsibleFrom).toBe('2027-01-01')
    expect(s.monthsOwed).toBe(0)
    expect(s.exempt).toBe(true)
  })

  it('follows a period that does not start in January', () => {
    // A schedule anchored on 1 July. A birthday in September is the third month of the
    // period, so nine of its twelve months remain.
    const s = share('2008-09-10', { periodStart: '2026-07-01' })
    expect(s.responsibleFrom).toBe('2026-09-10')
    expect(s.monthsOwed).toBe(9)
  })

  it('clamps a leap-day birthday rather than overflowing into March', () => {
    // 2008-02-29 + 18 years is "2026-02-29", which the Date constructor resolves to
    // 1 March — a month later, and a whole installment cheaper. addCadenceSteps clamps.
    const s = share('2008-02-29')
    expect(s.responsibleFrom).toBe('2026-02-28')
    expect(s.monthsOwed).toBe(10)
  })
})

describe('when the rule does not apply at all', () => {
  it('charges everybody in full when the schedule names no age', () => {
    const s = share('2020-01-01', { startAge: null })
    expect(s.monthsOwed).toBe(12)
    expect(s.responsibleFrom).toBeNull()
    expect(s.prorated).toBe(false)
  })

  it('charges in full when no birthday is recorded — it never guesses at an age', () => {
    // The same call computeIsMinor makes, and the reason addRelative demands a birthday
    // when a CHILD is recorded with no email: this default is right everywhere except
    // there, where it would bill a five-year-old as an adult.
    const s = share(null)
    expect(s.monthsOwed).toBe(12)
    expect(s.responsibleFrom).toBeNull()
  })

  it('honours an age of zero, which is not the same as no rule', () => {
    // "From birth". Someone born inside the period still owes only the months after the
    // month they were born, which is what a family means by charging from birth.
    const s = share('2026-04-09', { startAge: 0 })
    expect(s.responsibleFrom).toBe('2026-04-09')
    expect(s.monthsOwed).toBe(8)
  })
})

// ── Who owes a due at all ───────────────────────────────────────────────────────────
//
// A separate question from how much, and the reason it is separate is that `start_age` is
// on a timer and `bloodline_only` is not: a child grows into a due, somebody who married
// in never does. The one case that decides the design is the third — what an UNKNOWN
// bloodline means.
//
// IT IS A TWO-STATE ANSWER SINCE `20260902000000`. The third, 'bloodline-unknown', existed
// because the bloodline was DERIVED and the derivation could fail to have an answer at all.
// It is a column now, and the direction that state protected — bill nobody rather than bill
// the relatives a family ticked the box to exclude — is carried by `NOT NULL DEFAULT false`
// instead. The last test below is what pins that.

describe('duesEligibility', () => {
  const eligible = (over: {
    bloodlineOnly?: boolean | null
    isBloodline?: boolean | null
  }) => duesEligibility({
    bloodlineOnly: over.bloodlineOnly ?? false,
    isBloodline: over.isBloodline ?? false,
  })

  it('is owed by everybody when the due is not restricted', () => {
    // And the flag is not even consulted — whether somebody is in the bloodline is
    // irrelevant to a due open to the whole family, so this must not depend on it.
    expect(eligible({ bloodlineOnly: false, isBloodline: false })).toBe('owed')
    expect(eligible({ bloodlineOnly: null, isBloodline: false })).toBe('owed')
    expect(eligible({ bloodlineOnly: undefined, isBloodline: false })).toBe('owed')
  })

  it('is owed by somebody in the bloodline', () => {
    expect(eligible({ bloodlineOnly: true, isBloodline: true })).toBe('owed')
  })

  it('is not owed by somebody outside it', () => {
    expect(eligible({ bloodlineOnly: true, isBloodline: false })).toBe('not-in-bloodline')
  })

  it('BILLS NOBODY for a member nobody has marked, which is the old caution kept', () => {
    // ── THE TEST THIS REPLACED, AND WHY THE ANSWER IS THE SAME ─────────────────────
    // There was a third outcome, 'bloodline-unknown', for the case `bloodlineIds()`
    // answered NULL: the family had set no anchor, so there was no bloodline to apply and
    // the safe direction was to bill nobody. `20260902000000` removed the anchor and the
    // walk; `people.is_bloodline` is NOT NULL DEFAULT false, so the state that used to be
    // "we cannot tell" is now "nobody has said yes", and it still bills nobody.
    //
    // What is asserted here is that the DEFAULT is doing that work. A nullish flag — which
    // is what a caller reading an unreadable row hands over — must not read as eligible.
    expect(eligible({ bloodlineOnly: true, isBloodline: null })).toBe('not-in-bloodline')
    expect(eligible({ bloodlineOnly: true, isBloodline: undefined })).toBe('not-in-bloodline')
  })
})

// ── WHICH PART OF THE FAMILY OWES A DUE ─────────────────────────────────────────────
//
// The third reduction, and a different KIND from the other two: `start_age` is on a timer
// and `bloodline_only` never moves, while this one changes the day somebody switches chapter
// or a chapter switches region. The two cases that decide the design are the member with NO
// chapter (under National, owes nothing scoped) and the region, which is DERIVED through the
// chapter and is never stored on the person.

describe('duesScope, which normalizes what the column holds', () => {
  const of = (scope: unknown): string =>
    duesScope({ amount_cents: 0, frequency: 'annual', scope: scope as string | null })

  it('reads the two targeted values', () => {
    expect(of('regional')).toBe('regional')
    expect(of('chapter')).toBe('chapter')
  })

  it('reads everything else as national', () => {
    // The column being absent (a database that has not run 20260817000008), NULL, and a
    // word nothing recognizes. All three mean the schedule names no part of the family, and
    // the only schedule that names no part of the family is a national one.
    expect(of(undefined)).toBe('national')
    expect(of(null)).toBe('national')
    expect(of('national')).toBe('national')
    expect(of('planetary')).toBe('national')
    expect(of('')).toBe('national')
  })
})

describe('duesScopeMatch', () => {
  // Ada is in Houston, which is in Texas. Atlanta is a real chapter under National — the
  // state that makes "another region" distinguishable from "no chapter at all".
  const CHAPTERS = new Map<string, string | null>([['houston', 'texas'], ['atlanta', null]])
  const match = (over: {
    scope?: string | null
    region_id?: string | null
    chapter_id?: string | null
    memberChapterId?: string | null
    chapterRegions?: ReadonlyMap<string, string | null>
  }) => duesScopeMatch({
    schedule: {
      amount_cents: 12_000, frequency: 'annual',
      scope: over.scope ?? 'national',
      region_id: over.region_id ?? null,
      chapter_id: over.chapter_id ?? null,
    },
    memberChapterId: over.memberChapterId === undefined ? 'houston' : over.memberChapterId,
    chapterRegions: over.chapterRegions ?? CHAPTERS,
  })

  it('is owed by everybody when the due is national', () => {
    // And the chapter is not consulted at all, which is what makes National free of every
    // setup step: a family with no chapters, and a member in none, still owes it.
    expect(match({ scope: 'national' })).toBe('owed')
    expect(match({ scope: null, memberChapterId: null })).toBe('owed')
    expect(match({ scope: undefined, memberChapterId: null, chapterRegions: new Map() }))
      .toBe('owed')
  })

  it('is owed by a member IN the chapter', () => {
    expect(match({ scope: 'chapter', chapter_id: 'houston' })).toBe('owed')
  })

  it('is not owed by a member in a different chapter', () => {
    expect(match({ scope: 'chapter', chapter_id: 'dallas' })).toBe('other-chapter')
  })

  it('is owed by a member whose CHAPTER is in the region', () => {
    // Derived, not stored: nothing on the member says "texas". Houston is what puts them
    // in it, which is why moving a chapter between regions changes who owes this.
    expect(match({ scope: 'regional', region_id: 'texas' })).toBe('owed')
  })

  it('is not owed by a member whose chapter is in another region', () => {
    expect(match({ scope: 'regional', region_id: 'eastern' })).toBe('other-region')
  })

  it('is not owed by a member whose chapter is under National', () => {
    // Atlanta maps to null. A chapter with no region is not in every region — it is in
    // none, which is what National means one level down.
    expect(match({ scope: 'regional', region_id: 'texas', memberChapterId: 'atlanta' }))
      .toBe('other-region')
  })

  it('is not owed by a member with NO chapter, and says which case that is', () => {
    // The rule the help chapter states: an unplaced member is under National. Reported
    // distinctly from 'other-chapter' because the fix differs — they need a chapter, not a
    // different one.
    expect(match({ scope: 'chapter', chapter_id: 'houston', memberChapterId: null }))
      .toBe('no-chapter')
    expect(match({ scope: 'regional', region_id: 'texas', memberChapterId: null }))
      .toBe('no-chapter')
  })

  it('does not owe a regional due when the chapter map is empty', () => {
    // A caller that did not load chapters, or whose read was refused. Under-billing is
    // visible on Dues Projections; over-billing the wrong half of the family is not.
    expect(match({ scope: 'regional', region_id: 'texas', chapterRegions: new Map() }))
      .toBe('other-region')
  })

  it('never matches a regional due whose own region is missing', () => {
    // A row the CHECK from 20260817000008 refuses, and the one shape that would otherwise
    // bill everybody: a member under National (region null) matching a schedule with a null
    // region. `?? null` on both sides is what closes it.
    expect(match({ scope: 'regional', region_id: null, memberChapterId: 'atlanta' }))
      .toBe('other-region')
  })

  it('never matches a chapter due whose own chapter is missing', () => {
    expect(match({ scope: 'chapter', chapter_id: null, memberChapterId: 'houston' }))
      .toBe('other-chapter')
  })
})

describe('proratedAnnualCents rounds to whole cents', () => {
  it('lands on the figure a family would write down', () => {
    expect(proratedAnnualCents(12_000, share('2008-07-04'))).toBe(5_000)
  })

  it('passes the annual total straight through when nothing is withheld', () => {
    expect(proratedAnnualCents(12_345, share(null))).toBe(12_345)
  })

  it('rounds rather than truncating', () => {
    // $100 over 5 of 12 months is 4166.66…, so round and floor differ by a cent — which
    // is the only way this assertion is evidence of anything. A 7/12 share was the first
    // case written here and both operations give 5833 for it, so it passed under a
    // deliberately floored implementation and proved nothing.
    expect(proratedAnnualCents(10_000, share('2008-07-04'))).toBe(4_167)
  })
})
