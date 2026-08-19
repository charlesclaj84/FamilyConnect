import { afterEach, describe, expect, it } from 'vitest'
import {
  BIRTHDAY_HORIZON_DAYS,
  birthdayWeekday,
  upcomingBirthdays,
  type BirthdayPerson,
} from './birthdays'

/**
 * Whose birthday is next.
 *
 * WHY THESE TESTS EXIST: four of the five decisions in `lib/birthdays.ts` are invisible by
 * reading and obvious the moment a date runs through them. A 60-day horizon that never
 * crosses New Year shows an empty pane for the whole of December and January. A leap-day
 * birthday left to arithmetic lands on 1 March. An exclusive lower bound loses the one day
 * this screen most needs to be right about, which is today. A helpful fallback for a missing
 * `date_of_birth` wishes half the Directory a happy birthday every New Year's Day. None of
 * those is a crash and none of them would be reported as a bug — they would be read as facts
 * about the family.
 *
 * `today` is a parameter of the function under test, so nothing here depends on when it is
 * run (AGENTS.md §7b). That is the whole reason the parameter exists.
 *
 * ── THE ARITHMETIC IS HAND-CHECKED, NOT DERIVED ─────────────────────────────────────
 * A test that computes its expectation from the code under test asserts nothing, so every
 * day count below was worked out by hand and the working is written beside it. The three
 * anchors everything else is built from:
 *
 *   * 19 August 2026 + 60 days is **18 October 2026** (Aug 19 → Sep 19 is 31, → Oct 19 is 61).
 *   * 10 December 2026 + 57 days is **5 February 2027** (Dec 10 → Jan 1 is 22, → Feb 1 is 53).
 *   * 1 January 2027 + 58 days is **28 February 2027**; 1 January 2028 + 59 days is
 *     **29 February 2028** — the same two months, one day apart, because 2028 is a leap year.
 *
 * And two weekdays, taken from 1 January 2026 being a Thursday, the same anchor
 * `lib/calendar.test.ts` uses: 1 August 2026 is a **Saturday** and 25 August 2026 is a
 * **Tuesday** (day 237 of the year; 236 mod 7 = 5; Thursday + 5).
 *
 * ── THE TIMEZONE BLOCK REALLY CHANGES THE TIMEZONE ──────────────────────────────────
 * It reassigns `process.env.TZ`, which Node honours from the next `Date` operation onward.
 * Safe here because vitest's default pool is `forks` — every test FILE gets its own process —
 * and because it is restored in `afterEach` either way. It is what catches the class of
 * mutation that is correct in UTC and a day out west of Greenwich, which is the class every
 * date bug in this product has belonged to.
 *
 * ── CHECKED BY MUTATION, per AGENTS.md §7b ──────────────────────────────────────────
 * A green run is not evidence until it has been seen to fail. Eleven mutations of
 * `lib/birthdays.ts`, each restored afterwards and each run with
 * `npx vitest run lib/birthdays.test.ts` on a machine in America/Chicago (UTC−5) unless a
 * `TZ` is named. OBSERVED results, not expected:
 *
 *   the horizon bound loosened — `daysAway > horizonDays` -> `> horizonDays + 1`
 *      3 failed — "stops at the horizon, and the horizon is inclusive" (18 AND 19 October
 *      came back, where only the 18th is inside 60 days), "a short horizon is the same rule
 *      with a smaller number", "a horizon of 0 is today only". The pane would run one day
 *      long, every day, on every horizon.
 *   the year-boundary wrap removed — `nextOccurrence` always answers `occurrenceIn(today.year, …)`
 *      7 failed — the whole December block ("reaches into the next year", "counts 26 days to
 *      a January birthday", "orders December and January together"), "yesterday is next year,
 *      not a negative number of days", "the age is the age on the NEXT birthday, not this
 *      year's", the leap case that crosses a year, and the negative-offset re-run. February
 *      2027 came back as February 2026 — 308 days in the past — so on 10 December the pane
 *      was empty for the whole of the following two months.
 *   today made exclusive — `daysAway < 0` -> `daysAway <= 0`
 *      5 failed — "a birthday today is 0 days away and sorts first", "a clamped 28 February
 *      counts on the day itself", "a horizon of 0 is today only", "a short horizon is the
 *      same rule with a smaller number", and the negative-offset "puts a birthday today on
 *      today". The family lost the one birthday they opened the pane for.
 *   the leap clamp dropped — `occurrenceIn` returns `birth.day` with no `Math.min`
 *      6 failed, and the OBSERVED answer is not the one the module first claimed: `onDate`
 *      came back as **"2027-02-29"** while `daysAway` counted to 1 March (0 became 1 on the
 *      "counts on the day itself" case). `isoOf` builds its string from the integers and
 *      `Date.UTC` overflows the month, so the two halves of one row described two different
 *      days, one of which is on no calendar. Decision 1 in the module was rewritten to say
 *      that, because it is worse than the 1 March it had predicted.
 *   an unparseable date given a fallback — `parseCalendarDate(…) ?? { year: 1900, monthNumber: 1, day: 1 }`
 *      **0 failed on the first attempt, which is the finding this whole exercise paid for.**
 *      The seven phantom people all resolved to 1 January 2027, 135 days from the fixture's
 *      19 August — so the HORIZON dropped them and the exclusion assertions passed without
 *      ever exercising the parse. The two cases were rewritten to run a 400-day horizon and
 *      four `today`s a quarter apart (see the comment on `A_WHOLE_YEAR`), after which the
 *      same mutation failed 2: "drops everybody whose date of birth is not a date, however
 *      far the horizon reaches" and "drops them wherever in the year today happens to be".
 *   the day-of-month check relaxed — `day > daysInMonth(year, monthNumber)` -> `day > 31`
 *      3 failed — both exclusion cases ("drops everybody whose date of birth is not a date,
 *      however far the horizon reaches" admitted `feb-29-common` and `feb-30` beside `real`,
 *      and "drops them wherever in the year today happens to be" the same three) and
 *      "refuses a day that never was as today", which stopped throwing.
 *      RE-MEASURED 2026-08-19 and the entry CORRECTED, because the first transcription of it
 *      recorded an observation this module cannot produce: it said `Date.UTC` turned the two
 *      into 2 March and 1 March. It does not. `occurrenceIn`'s `Math.min` clamp is still in
 *      place under this mutation, so both `1990-02-30` and `2001-02-29` resolve to
 *      **`onDate: "2027-02-28", daysAway: 193`** — printed from the mutated build, not
 *      predicted. The March overflow described in `parseCalendarDate`'s own doc comment is
 *      real and is what would happen if a raw `Date.UTC` were the only check; it takes the
 *      clamp being removed as well, which is a different mutation (the one above it). The
 *      assertions trip either way, so the test was always doing its job — the RECORD was the
 *      part that was not reproducible, and a mutation log whose entries cannot be reproduced
 *      stops being evidence and becomes a claim. Two dates that never existed being filed
 *      under one that did, four days from a birthday neither person has, is a worse outcome
 *      than the March one it replaced.
 *   the age guard removed — `turning > 0 ? turning : null` -> `turning`
 *      2 failed — "withholds the age when the stored year has not happened yet" (it reported
 *      turning −36 for a 1962-as-2062 typo) and "withholds it for a date of birth still to
 *      come" (turning 0 for somebody not yet born).
 *   soonest-first dropped from the comparator, leaving surname first
 *      4 failed — "a birthday today is 0 days away and sorts first", "orders December and
 *      January together, soonest first", "is soonest first, then surname, then given name,
 *      then id", "a short horizon is the same rule with a smaller number". Soonest first is
 *      the entire organising idea of the pane and it is one term of one comparator.
 *   `.slice(0, 10)` dropped from `parseCalendarDate`
 *      1 failed — "accepts a full ISO instant, because a DATE column is not the only source".
 *   `timeZone: 'UTC'` deleted from `birthdayWeekday`'s formatter, run under `TZ=UTC` — i.e. CI
 *      2 failed — "names the same weekday it names in UTC" and "names the weekday the date
 *      actually falls on", BOTH inside the negative-offset block; it answered "Monday" for a
 *      Tuesday. Nothing outside the block noticed, which is exactly what the block is for: on
 *      a UTC runner the mutant is correct, and it misnames the day for everybody west of
 *      Greenwich. Run in the local zone instead it failed 4, the extra two being the
 *      top-level weekday cases.
 *   the same deletion PLUS the formatter hoisted to a module-level `const`, under `TZ=UTC`
 *      0 failed — recorded rather than left looking covered. An `Intl.DateTimeFormat`
 *      resolves its zone when it is CONSTRUCTED and keeps it for life, so a formatter built
 *      at import time never notices the `TZ` reassignment inside a test. This is the escape
 *      `lib/calendar.test.ts` documents for `monthLabel`, reproduced here on purpose: it is
 *      the whole reason `birthdayWeekday` builds its formatter per call, and the reason that
 *      line must not be "optimised" into a constant.
 *
 *   the collator unpinned — `NAME_ORDER.compare(a, b)` -> `a.localeCompare(b)`
 *      0 failed, ON THIS RUNNER, and that is recorded rather than left looking covered — the
 *      same disclosure the hoisted-formatter entry above makes. Node resolved `en-US` here, so
 *      the mutant and the module agree; what the pin defends against is the OTHER runtime this
 *      module is written for, a member's browser, whose default locale is the reader's. The
 *      failure it prevents is not a wrong answer on any one machine but two machines
 *      disagreeing about one roster, which no single-process test can express. "Orders
 *      surnames by collation rather than by code point" is the assertion that does have teeth:
 *      it goes red for a `<`-based comparator, which is the mutation somebody removing an
 *      `Intl` dependency would actually write.
 *   the collator replaced by a code-point compare — `NAME_ORDER.compare(a, b)` ->
 *   `a < b ? -1 : a > b ? 1 : 0`
 *      1 failed — "orders surnames by collation rather than by code point", observed as
 *      `[ 'allen', 'z', 'accented' ]` where `[ 'allen', 'accented', 'z' ]` was wanted. Ángel
 *      filed after Zeta, because U+00C1 sorts above every ASCII letter. That is the entry with
 *      teeth for this line, and it is why the id tiebreak beside it — a uuid, which no locale
 *      has an opinion about — is the raw comparison and the two names are not.
 *
 * Two things no mutation here can reach, stated rather than left to look covered: this module
 * does not know who is dead (`people.sunset_date` is not in `BirthdayPerson` — the roster's
 * query owes that filter, see the module header), and it does not know who the caller may
 * see. Neither is testable from `lib/`; both belong to the action.
 */

/** A roster row. Named people, because two of the sort cases are about the names. */
const person = (
  id: string,
  dateOfBirth: string | null,
  names: { firstName?: string; lastName?: string } = {},
): BirthdayPerson => ({
  id,
  firstName: names.firstName ?? 'Ada',
  lastName: names.lastName ?? 'Allen',
  dateOfBirth,
})

const ids = (rows: readonly { id: string }[]) => rows.map(r => r.id)

describe('the horizon', () => {
  it('is 60 days, which is what the pane is specified to show', () => {
    expect(BIRTHDAY_HORIZON_DAYS).toBe(60)
  })

  it('stops at the horizon, and the horizon is inclusive', () => {
    // 19 August + 60 days is 18 October; the 19th is day 61 and outside.
    const rows = upcomingBirthdays([
      person('in', '1980-10-18'),
      person('out', '1980-10-19'),
    ], '2026-08-19')

    expect(ids(rows)).toEqual(['in'])
    expect(rows[0].daysAway).toBe(60)
  })

  it('a short horizon is the same rule with a smaller number', () => {
    const roster = [
      person('today', '1990-08-19'),
      person('tomorrow', '1990-08-20'),
      person('day-after', '1990-08-21'),
    ]

    expect(ids(upcomingBirthdays(roster, '2026-08-19', 1))).toEqual(['today', 'tomorrow'])
    expect(ids(upcomingBirthdays(roster, '2026-08-19', 2)))
      .toEqual(['today', 'tomorrow', 'day-after'])
  })

  it('a horizon of 0 is today only', () => {
    const rows = upcomingBirthdays([
      person('today', '1990-08-19'),
      person('tomorrow', '1990-08-20'),
    ], '2026-08-19', 0)

    expect(ids(rows)).toEqual(['today'])
    expect(rows[0].daysAway).toBe(0)
  })
})

describe('today counts', () => {
  it('a birthday today is 0 days away and sorts first', () => {
    const rows = upcomingBirthdays([
      person('later', '1990-09-02'),
      person('today', '1990-08-19'),
      person('tomorrow', '1990-08-20'),
    ], '2026-08-19')

    expect(ids(rows)).toEqual(['today', 'tomorrow', 'later'])
    expect(rows[0]).toEqual({
      id: 'today',
      firstName: 'Ada',
      lastName: 'Allen',
      onDate: '2026-08-19',
      daysAway: 0,
      turning: 36,
    })
  })

  it('yesterday is next year, not a negative number of days', () => {
    // Aug 18 2026 has gone, so the next one is Aug 18 2027: 364 days (2026-08-19 to
    // 2027-08-19 is 365, and the 18th is one day earlier). Needs a horizon that reaches it.
    const rows = upcomingBirthdays([person('yesterday', '1990-08-18')], '2026-08-19', 400)

    expect(rows[0].onDate).toBe('2027-08-18')
    expect(rows[0].daysAway).toBe(364)
    expect(rows.every(r => r.daysAway >= 0)).toBe(true)
  })
})

describe('the year boundary', () => {
  // The case the naive version gets wrong: on 10 December a 60-day window is mostly next
  // year, and a version that only ever looks in `today`'s year shows an empty pane for
  // December and January both.
  it('reaches into the next year', () => {
    const rows = upcomingBirthdays([person('feb', '1990-02-05')], '2026-12-10')

    expect(rows[0].onDate).toBe('2027-02-05')
    expect(rows[0].daysAway).toBe(57)
  })

  it('counts 26 days to a January birthday', () => {
    // Dec 10 → Jan 1 is 22 days, → Jan 5 is 26.
    const rows = upcomingBirthdays([person('jan', '1990-01-05')], '2026-12-10')

    expect(rows[0].onDate).toBe('2027-01-05')
    expect(rows[0].daysAway).toBe(26)
  })

  it('still refuses one past the horizon on the far side of New Year', () => {
    // Feb 10 is 62 days from Dec 10 — five past the 5 February case above.
    expect(upcomingBirthdays([person('feb-10', '1990-02-10')], '2026-12-10')).toEqual([])
  })

  it('orders December and January together, soonest first', () => {
    const rows = upcomingBirthdays([
      person('feb', '1990-02-05'),
      person('dec', '1990-12-25'),
      person('jan', '1990-01-05'),
    ], '2026-12-10')

    expect(ids(rows)).toEqual(['dec', 'jan', 'feb'])
    expect(rows.map(r => r.daysAway)).toEqual([15, 26, 57])
  })

  it('the age is the age on the NEXT birthday, not this year\'s', () => {
    // Born in 1990, next birthday February 2027: they turn 37, not 36.
    const rows = upcomingBirthdays([person('feb', '1990-02-05')], '2026-12-10')
    expect(rows[0].turning).toBe(37)
  })
})

describe('29 February', () => {
  // Decision 1 in the module: the last day of the month the person was born in, which is the
  // clamp `addCadenceSteps` already applies to a dues schedule anchored on the 31st.
  it('resolves 29 February to 28 February in a common year', () => {
    const rows = upcomingBirthdays([person('leapling', '2000-02-29')], '2027-01-01')

    expect(rows[0].onDate).toBe('2027-02-28')
    expect(rows[0].daysAway).toBe(58)
    // The clamp moves the day, never the year: 2027 − 2000.
    expect(rows[0].turning).toBe(27)
  })

  it('and not to 1 March, nor to a 29 February that never happened', () => {
    // The two answers an unclamped version gives, and they are not the same answer — which is
    // the thing worth pinning. `Date.UTC(2027, 1, 29)` is 1 March, so the DAY COUNT walks to
    // 1 March; the ISO string is assembled from the integers, so it prints "2027-02-29". A
    // family would read a date that is not on any calendar beside a countdown to the day
    // after it. The clamp is what keeps `onDate` and `daysAway` describing one day.
    const rows = upcomingBirthdays([person('leapling', '2000-02-29')], '2027-01-01')

    expect(rows[0].onDate).not.toBe('2027-03-01')
    expect(rows[0].onDate).not.toBe('2027-02-29')
    // And the two agree: 58 days from 1 January is the 28th, which is what `onDate` says.
    expect(rows[0].daysAway).toBe(58)
  })

  it('is the real 29th in a leap year', () => {
    const rows = upcomingBirthdays([person('leapling', '2000-02-29')], '2028-01-01')

    expect(rows[0].onDate).toBe('2028-02-29')
    expect(rows[0].daysAway).toBe(59)
    expect(rows[0].turning).toBe(28)
  })

  it('a clamped 28 February counts on the day itself', () => {
    const rows = upcomingBirthdays([person('leapling', '2000-02-29')], '2027-02-28')

    expect(rows[0].daysAway).toBe(0)
    expect(rows[0].onDate).toBe('2027-02-28')
  })

  it('once the clamped day has gone, the next one is the leap year\'s real 29th', () => {
    // 1 March 2027: February is behind us, so the next occurrence is 2028's, which needs no
    // clamp. 2027-03-01 → 2028-03-01 is 366 days because it spans 29 February; the 29th is
    // one day earlier.
    const rows = upcomingBirthdays([person('leapling', '2000-02-29')], '2027-03-01', 400)

    expect(rows[0].onDate).toBe('2028-02-29')
    expect(rows[0].daysAway).toBe(365)
    expect(rows[0].turning).toBe(28)
  })

  it('never skips a leapling — they are on the list in a common year too', () => {
    // The answer this module refused: no birthday at all in three years out of four.
    const roster = [person('leapling', '2000-02-29')]
    expect(upcomingBirthdays(roster, '2027-01-01')).toHaveLength(1)
    expect(upcomingBirthdays(roster, '2028-01-01')).toHaveLength(1)
  })

  it('does not confuse the 28th with the 29th for somebody born on the 28th', () => {
    // Two people, one day apart in a leap birth year, on a common-year horizon: they collapse
    // onto the same date, which is correct and is worth pinning so a future "fix" that shifts
    // the leapling to 1 March cannot claim it was disambiguating them.
    const rows = upcomingBirthdays([
      person('the-28th', '2000-02-28', { firstName: 'Bea' }),
      person('the-29th', '2000-02-29', { firstName: 'Ada' }),
    ], '2027-01-01')

    expect(rows.map(r => r.onDate)).toEqual(['2027-02-28', '2027-02-28'])
    expect(ids(rows)).toEqual(['the-29th', 'the-28th'])   // same day, so Ada before Bea
  })
})

describe('a date that is not a date is not a birthday', () => {
  const UNREADABLE = [
    person('null', null),
    person('empty', ''),
    person('prose', 'not a date'),
    person('month-13', '1990-13-01'),
    person('feb-30', '1990-02-30'),
    person('feb-29-common', '2001-02-29'),   // 2001 is not a leap year: that day never was
    person('unpadded', '1990-8-25'),
  ]

  /**
   * THE HORIZON IS 400 DAYS HERE ON PURPOSE, AND THAT IS THE WHOLE VALUE OF THIS CASE.
   *
   * Written with the ordinary 60-day horizon it passed for the wrong reason, which was
   * MEASURED rather than guessed — the "unparseable date given a fallback" mutation in the
   * header shipped green: a fallback of 1 January 1900 resolves to 1 January 2027, which is
   * 135 days from 19 August and so was dropped by the HORIZON rather than by the parse. The
   * exclusion was never being tested at all.
   *
   * A year-and-a-bit window is what closes that off, because every person has exactly one
   * next occurrence and it is at most 366 days out: no fallback date whatsoever — 1900, the
   * epoch, today, `start_date` — can hide outside this window. That is the difference between
   * an assertion about the parse and an assertion that happens to agree with it.
   */
  const A_WHOLE_YEAR = 400

  it('drops everybody whose date of birth is not a date, however far the horizon reaches', () => {
    const roster = [...UNREADABLE, person('real', '1990-08-25')]

    expect(ids(upcomingBirthdays(roster, '2026-08-19', A_WHOLE_YEAR))).toEqual(['real'])
    expect(ids(upcomingBirthdays(roster, '2026-08-19'))).toEqual(['real'])
  })

  it('drops them wherever in the year today happens to be', () => {
    // Four `today`s a quarter apart, each with a year of horizon: between them there is no
    // date in the calendar a fallback could occupy without one of these four seeing it.
    const roster = [...UNREADABLE, person('real', '1990-08-25')]

    for (const today of ['2026-01-01', '2026-04-01', '2026-08-19', '2026-12-10']) {
      expect(ids(upcomingBirthdays(roster, today, A_WHOLE_YEAR))).toEqual(['real'])
    }
  })

  it('keeps the one real birthday in the same roster', () => {
    // The positive control for the cases above: an implementation that returned `[]` for
    // everybody would satisfy an exclusion assertion trivially.
    const rows = upcomingBirthdays([
      person('null', null),
      person('real', '1990-08-25'),
    ], '2026-08-19')

    expect(rows).toHaveLength(1)
    expect(rows[0].onDate).toBe('2026-08-25')
    expect(rows[0].daysAway).toBe(6)
  })

  it('an empty roster is an empty list', () => {
    expect(upcomingBirthdays([], '2026-08-19')).toEqual([])
  })

  it('accepts a full ISO instant, because a DATE column is not the only source', () => {
    const rows = upcomingBirthdays(
      [person('stamped', '1990-08-25T00:00:00+00:00')], '2026-08-19')

    expect(rows[0].onDate).toBe('2026-08-25')
    expect(rows[0].turning).toBe(36)
  })
})

describe('the age is withheld rather than guessed', () => {
  it('withholds the age when the stored year has not happened yet', () => {
    // 1962 mistyped as 2062. The arithmetic would say "turning -36".
    const rows = upcomingBirthdays([person('typo', '2062-08-25')], '2026-08-19')

    expect(rows[0].turning).toBeNull()
    // The DAY and MONTH still show: a four-digit typo is a typo in the year, and there is no
    // reason to withhold the two parts that are almost certainly right.
    expect(rows[0].onDate).toBe('2026-08-25')
    expect(rows[0].daysAway).toBe(6)
  })

  it('withholds it for a date of birth still to come', () => {
    // Born later this year, i.e. not born: the arithmetic would say "turning 0".
    const rows = upcomingBirthdays([person('unborn', '2026-08-25')], '2026-08-19')

    expect(rows[0].turning).toBeNull()
    expect(rows[0].onDate).toBe('2026-08-25')
  })

  it('does not withhold a real one', () => {
    const rows = upcomingBirthdays([person('real', '1990-08-25')], '2026-08-19')
    expect(rows[0].turning).toBe(36)
  })

  it('puts no ceiling on an implausible age', () => {
    // Deliberate: any ceiling would be a number nobody chose, quietly hiding an ancestor's
    // real date. A year in the future is untrustworthy by construction; 1826 is merely old.
    const rows = upcomingBirthdays([person('ancestor', '1826-08-25')], '2026-08-19')
    expect(rows[0].turning).toBe(200)
  })
})

describe('the order', () => {
  it('is soonest first, then surname, then given name, then id', () => {
    const rows = upcomingBirthdays([
      person('c', '1990-08-25', { firstName: 'Bob', lastName: 'Allen' }),
      person('d', '1990-08-25', { firstName: 'Ada', lastName: 'Baker' }),
      person('b', '1990-08-25', { firstName: 'Ada', lastName: 'Allen' }),
      person('a', '1990-08-20', { firstName: 'Zoe', lastName: 'Zeta' }),
    ], '2026-08-19')

    expect(ids(rows)).toEqual(['a', 'b', 'c', 'd'])
  })

  it('breaks a genuine duplicate on the id', () => {
    const twice = [
      person('second', '1990-08-25'),
      person('first', '1990-08-25'),
    ]
    expect(ids(upcomingBirthdays(twice, '2026-08-19'))).toEqual(['first', 'second'])
  })

  // The surname order is COLLATED, not compared byte by byte, and a family this product is
  // built for has accented surnames in it. `'Ángel' < 'Allen'` is FALSE as a raw string
  // comparison — U+00C1 sorts above every ASCII letter — so a `<`-based comparator would file
  // every accented surname after Z. `Intl.Collator('en')` puts it where a person looking for
  // it would look.
  //
  // WHAT THIS CASE CANNOT DO IS CATCH AN UNPINNED `localeCompare`, and saying so is the point
  // of the note in the mutation log: on an `en` runner the unpinned form gives exactly this
  // answer. The pin is there for the browser, where this module also runs and where the
  // default locale is the reader's, not ours. See the argument at the `sort`.
  it('orders surnames by collation rather than by code point', () => {
    const rows = upcomingBirthdays([
      person('z', '1990-08-25', { lastName: 'Zeta' }),
      person('accented', '1990-08-25', { lastName: 'Ángel' }),
      person('allen', '1990-08-25', { lastName: 'Allen' }),
    ], '2026-08-19')

    expect(ids(rows)).toEqual(['allen', 'accented', 'z'])
  })

  it('does not mutate or reorder the roster it was given', () => {
    const roster = [person('b', '1990-09-01'), person('a', '1990-08-20')]
    upcomingBirthdays(roster, '2026-08-19')
    expect(ids(roster)).toEqual(['b', 'a'])
  })
})

describe('a `today` or a horizon it cannot read', () => {
  // It throws rather than answering `[]`, because `[]` renders "no birthdays in the next 60
  // days" over a family that has four — a false statement in the product's own voice. The
  // contrast with `buildCalendarMonth`, which degrades, is argued in the module.
  it.each([
    ['prose',        'nonsense'],
    ['unpadded',     '2026-8-19'],
    ['a day that never was', '2026-02-30'],
    ['empty',        ''],
    ['a two-digit year', '0099-08-19'],
  ])('refuses %s as today', (_label, today) => {
    expect(() => upcomingBirthdays([person('a', '1990-08-25')], today)).toThrow(TypeError)
  })

  it.each([-1, 1.5, Number.NaN, Number.POSITIVE_INFINITY])('refuses %s as a horizon', horizon => {
    expect(() => upcomingBirthdays([person('a', '1990-08-25')], '2026-08-19', horizon))
      .toThrow(TypeError)
  })
})

describe('the weekday', () => {
  it('names the weekday the date actually falls on', () => {
    // Hand-checked from 1 January 2026 being a Thursday — see the header.
    expect(birthdayWeekday('2026-08-01')).toBe('Saturday')
    expect(birthdayWeekday('2026-08-25')).toBe('Tuesday')
    expect(birthdayWeekday('2028-02-29')).toBe('Tuesday')
  })

  it('agrees with the date the pane prints beside it', () => {
    const rows = upcomingBirthdays([person('real', '1990-08-25')], '2026-08-19')
    expect(birthdayWeekday(rows[0].onDate)).toBe('Tuesday')
  })

  it('refuses a date it cannot read', () => {
    expect(() => birthdayWeekday('nonsense')).toThrow(TypeError)
    expect(() => birthdayWeekday('0099-08-25')).toThrow(TypeError)
  })
})

describe('under a negative UTC offset', () => {
  const original = process.env.TZ
  // `process.env.TZ = undefined` assigns the STRING "undefined", which is not a zone and not
  // a restore, so an absent original is deleted rather than assigned.
  afterEach(() => {
    if (original === undefined) delete process.env.TZ
    else process.env.TZ = original
  })

  const ROSTER = [
    person('today', '1990-08-19'),
    person('leapling', '2000-02-29'),
    person('feb', '1990-02-05'),
    person('null', null),
  ]

  it('answers exactly what it answers in UTC', () => {
    // THE BUG THIS FILE EXISTS TO PREVENT. `new Date('1990-08-19')` is UTC midnight, which in
    // Pacific time is the evening of 18 August — so `.getMonth()` and `.getDate()` on it
    // answer for the wrong day, and a birthday is reported one day early for half the
    // country. Everything here is integer arithmetic on the string parts plus `Date.UTC`, so
    // the two runs are identical.
    process.env.TZ = 'UTC'
    const utc = upcomingBirthdays(ROSTER, '2026-08-19', 400)
    process.env.TZ = 'America/Los_Angeles'
    const pacific = upcomingBirthdays(ROSTER, '2026-08-19', 400)

    expect(pacific).toEqual(utc)
  })

  it('puts a birthday today on today', () => {
    process.env.TZ = 'America/Los_Angeles'
    const rows = upcomingBirthdays([person('today', '1990-08-19')], '2026-08-19')

    expect(rows[0].daysAway).toBe(0)
    expect(rows[0].onDate).toBe('2026-08-19')
  })

  it('resolves 29 February the same way it does in UTC', () => {
    process.env.TZ = 'America/Los_Angeles'
    const rows = upcomingBirthdays([person('leapling', '2000-02-29')], '2027-01-01')

    expect(rows[0].onDate).toBe('2027-02-28')
    expect(rows[0].daysAway).toBe(58)
  })

  it('still crosses the year boundary', () => {
    process.env.TZ = 'America/Los_Angeles'
    const rows = upcomingBirthdays([person('feb', '1990-02-05')], '2026-12-10')

    expect(rows[0].onDate).toBe('2027-02-05')
    expect(rows[0].daysAway).toBe(57)
  })

  it('names the same weekday it names in UTC', () => {
    // Without `timeZone: 'UTC'` on the formatter, UTC midnight on the 25th formats as the
    // 24th here, and the pane prints "Monday" beside a date reading "August 25th".
    process.env.TZ = 'UTC'
    const utc = birthdayWeekday('2026-08-25')
    process.env.TZ = 'America/Los_Angeles'
    expect(birthdayWeekday('2026-08-25')).toBe(utc)
  })

  it('names the weekday the date actually falls on', () => {
    process.env.TZ = 'America/Los_Angeles'
    expect(birthdayWeekday('2026-08-25')).toBe('Tuesday')
    expect(birthdayWeekday('2026-08-01')).toBe('Saturday')
  })
})
