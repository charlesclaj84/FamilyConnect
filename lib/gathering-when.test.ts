import { describe, expect, it } from 'vitest'

import {
  formatWhen, normaliseDate, normaliseTime, normaliseWhen, timeLabelFor,
  whenEnvelope, whenProblems, whenToCalendarSpans,
  type GatheringOccurrence, type GatheringWhen,
} from './gathering-when'

/**
 * ── MUTATION-CHECKED, per AGENTS.md §7b: "a green run is not evidence until you have seen it
 * fail". Each of these trips a distinct set:
 *
 *   drop the `sameDay` guard on the time check     -> the across-days cases go red
 *   compare times with `<` instead of `<=`         -> the equal-times case
 *   make `whenToCalendarSpans` always emit one     -> every separate-occasion case
 *   give separate spans the bare gathering id      -> the distinct-ids case
 *   let `formatWhen` range over the envelope       -> the three-Saturdays case
 *   read absence of `isContinuous` as false        -> the default case
 */

const occ = (
  startsOn: string,
  startTime: string | null = null,
  endsOn: string | null = null,
  endTime: string | null = null,
): GatheringOccurrence => ({ startsOn, startTime, endsOn, endTime })

/**
 * A `when` with a zone already stated.
 *
 * DEFAULTED SO THAT EVERY TEST BELOW STAYS ABOUT WHAT IT WAS ABOUT. `20260826000003` made a
 * zone mandatory wherever a time is given, so without a default every timed case in this file
 * would report `time-needs-zone` alongside the rule it is actually testing — six of them did,
 * which is how this line came to exist. The zone rule has its own block at the bottom.
 */
const when = (isContinuous: boolean, ...occurrences: GatheringOccurrence[]): GatheringWhen =>
  ({ isContinuous, occurrences, timeZone: 'America/Chicago' })

/** The same, with no zone — for the rule that a time requires one. */
const whenNoZone = (isContinuous: boolean, ...occurrences: GatheringOccurrence[]): GatheringWhen =>
  ({ isContinuous, occurrences, timeZone: null })

const codes = (w: GatheringWhen) => whenProblems(w).map(p => p.code)

describe('normalisers', () => {
  it('takes HH:MM and HH:MM:SS to HH:MM', () => {
    // Postgres hands back the second form and an <input type="time"> gives the first, so a
    // round trip through the form must not change the value it is holding.
    expect(normaliseTime('11:00')).toBe('11:00')
    expect(normaliseTime('11:00:00')).toBe('11:00')
    expect(normaliseTime('23:59')).toBe('23:59')
  })

  it('refuses a time that is not one', () => {
    expect(normaliseTime('24:00')).toBeNull()
    expect(normaliseTime('11:60')).toBeNull()
    expect(normaliseTime('11')).toBeNull()
    expect(normaliseTime('elevenish')).toBeNull()
    expect(normaliseTime('')).toBeNull()
    expect(normaliseTime(null)).toBeNull()
  })

  it('checks a date\'s SHAPE and not whether the day exists', () => {
    expect(normaliseDate('2026-07-04')).toBe('2026-07-04')
    expect(normaliseDate('04/07/2026')).toBeNull()
    // Stated rather than left to be discovered: the database's DATE type is what refuses this,
    // and this function is about the wire format.
    expect(normaliseDate('2026-02-31')).toBe('2026-02-31')
  })
})

describe('whenProblems', () => {
  it('demands at least one occasion', () => {
    expect(codes(when(true))).toEqual(['no-occurrence'])
  })

  it('passes an ordinary single day with no times', () => {
    expect(codes(when(true, occ('2026-07-04')))).toEqual([])
  })

  it('passes a three-day continuous span with times at both ends', () => {
    expect(codes(when(true, occ('2026-07-03', '18:00', '2026-07-05', '11:00')))).toEqual([])
  })

  it('refuses an end date before the start', () => {
    expect(codes(when(true, occ('2026-07-04', null, '2026-07-01')))).toEqual(['end-before-start'])
  })

  it('refuses an end time before the start time ON ONE DAY', () => {
    expect(codes(when(true, occ('2026-07-04', '14:00', null, '09:00'))))
      .toEqual(['end-time-before-start'])
    // …and with the end date spelled out as the same day, which normalises to null later but
    // must still be checked as entered.
    expect(codes(when(true, occ('2026-07-04', '14:00', '2026-07-04', '09:00'))))
      .toEqual(['end-time-before-start'])
  })

  it('ALLOWS an end time before the start time ACROSS days', () => {
    // Friday 18:00 to Sunday 11:00 is an ordinary reunion. This is the case a naive
    // `endTime > startTime` check breaks, and breaking it would refuse most real weekends.
    expect(codes(when(true, occ('2026-07-03', '18:00', '2026-07-05', '11:00')))).toEqual([])
  })

  it('refuses equal times on one day — a gathering of no length', () => {
    expect(codes(when(true, occ('2026-07-04', '11:00', null, '11:00'))))
      .toEqual(['end-time-before-start'])
  })

  it('refuses an end time with no start time', () => {
    expect(codes(when(true, occ('2026-07-04', null, null, '16:00'))))
      .toEqual(['end-time-without-start'])
  })

  it('refuses a continuous gathering with more than one occasion', () => {
    expect(codes(when(true, occ('2026-07-04'), occ('2026-07-11'))))
      .toContain('continuous-needs-one')
  })

  it('allows several occasions when it is NOT continuous', () => {
    expect(codes(when(false, occ('2026-07-04'), occ('2026-07-11'), occ('2026-07-18'))))
      .toEqual([])
  })

  it('reports EVERY bad occasion, with its index', () => {
    // A first-failure validator would report one of these and then the next as each is fixed.
    const problems = whenProblems(when(false,
      occ('2026-07-04'),
      occ('2026-07-11', null, '2026-07-01'),
      occ('2026-07-18', '14:00', null, '09:00'),
    ))
    expect(problems).toEqual([
      { code: 'end-before-start', index: 1 },
      { code: 'end-time-before-start', index: 2 },
    ])
  })

  it('refuses an unreadable date and stops looking at that occasion', () => {
    expect(codes(when(true, occ('nonsense', '14:00', null, '09:00')))).toEqual(['bad-date'])
  })
})

describe('normaliseWhen', () => {
  it('stores an end date equal to the start as null — one spelling of one day', () => {
    const n = normaliseWhen(when(true, occ('2026-07-04', null, '2026-07-04')))
    expect(n.occurrences[0].endsOn).toBeNull()
  })

  it('keeps a real end date', () => {
    const n = normaliseWhen(when(true, occ('2026-07-03', null, '2026-07-05')))
    expect(n.occurrences[0].endsOn).toBe('2026-07-05')
  })

  it('drops an end time that has no start time', () => {
    const n = normaliseWhen(when(true, occ('2026-07-04', null, null, '16:00')))
    expect(n.occurrences[0].endTime).toBeNull()
  })

  it('takes an ABSENT isContinuous as true, never false', () => {
    // Reading absence as false would turn every gathering created by a caller that omits the
    // field into a series of one, which draws as a chip rather than a bar.
    const n = normaliseWhen({ occurrences: [occ('2026-07-04')] } as unknown as GatheringWhen)
    expect(n.isContinuous).toBe(true)
  })

  it('normalises HH:MM:SS from the database', () => {
    const n = normaliseWhen(when(true, occ('2026-07-04', '11:00:00', null, '16:30:00')))
    expect(n.occurrences[0].startTime).toBe('11:00')
    expect(n.occurrences[0].endTime).toBe('16:30')
  })
})

describe('whenEnvelope', () => {
  it('is the day itself for one day', () => {
    expect(whenEnvelope(when(true, occ('2026-07-04'))))
      .toEqual({ startsOn: '2026-07-04', endsOn: null })
  })

  it('spans a continuous range', () => {
    expect(whenEnvelope(when(true, occ('2026-07-03', null, '2026-07-05'))))
      .toEqual({ startsOn: '2026-07-03', endsOn: '2026-07-05' })
  })

  it('spans from the earliest occasion to the latest, whatever order they were entered', () => {
    expect(whenEnvelope(when(false, occ('2026-07-18'), occ('2026-07-04'), occ('2026-07-11'))))
      .toEqual({ startsOn: '2026-07-04', endsOn: '2026-07-18' })
  })

  it('takes the far end from an occasion\'s OWN end date', () => {
    expect(whenEnvelope(when(false, occ('2026-07-04'), occ('2026-07-11', null, '2026-07-13'))))
      .toEqual({ startsOn: '2026-07-04', endsOn: '2026-07-13' })
  })
})

describe('whenToCalendarSpans', () => {
  it('draws a continuous gathering as ONE span over the envelope', () => {
    expect(whenToCalendarSpans('g1', when(true, occ('2026-07-03', '18:00', '2026-07-05', '11:00'))))
      .toEqual([{
        id: 'g1',
        startsOn: '2026-07-03',
        endsOn: '2026-07-05',
        timeLabel: '6:00 PM – 11:00 AM',
      }])
  })

  it('keeps the BARE gathering id for a continuous span', () => {
    // So nothing about the existing single-span case changes — including hrefs and keys.
    expect(whenToCalendarSpans('g1', when(true, occ('2026-07-04')))[0].id).toBe('g1')
  })

  it('draws separate occasions as one span EACH', () => {
    const spans = whenToCalendarSpans('g1',
      when(false, occ('2026-07-04'), occ('2026-07-11'), occ('2026-07-18')))
    expect(spans.map(s => s.startsOn)).toEqual(['2026-07-04', '2026-07-11', '2026-07-18'])
    expect(spans.every(s => s.endsOn === null)).toBe(true)
  })

  it('gives every separate span a DISTINCT id', () => {
    // `buildCalendarMonth` keys a chip on `${day}:${entry.id}`, so equal ids are a duplicate
    // React key and a chip that vanishes.
    const spans = whenToCalendarSpans('g1', when(false, occ('2026-07-04'), occ('2026-07-11')))
    expect(new Set(spans.map(s => s.id)).size).toBe(2)
  })

  it('carries each occasion\'s OWN time label', () => {
    const spans = whenToCalendarSpans('g1',
      when(false, occ('2026-07-04', '09:00'), occ('2026-07-11', '14:00', null, '16:00')))
    expect(spans[0].timeLabel).toBe('from 9:00 AM')
    expect(spans[1].timeLabel).toBe('2:00 PM – 4:00 PM')
  })

  it('answers nothing at all for a gathering with no readable date', () => {
    expect(whenToCalendarSpans('g1', when(true))).toEqual([])
  })
})

describe('timeLabelFor', () => {
  it('is null where no time was given', () => {
    expect(timeLabelFor(occ('2026-07-04'))).toBeNull()
    expect(timeLabelFor(null)).toBeNull()
  })

  it('says "from" where only a start is known', () => {
    expect(timeLabelFor(occ('2026-07-04', '11:00'))).toBe('from 11:00 AM')
  })

  it('is a range where both are known', () => {
    expect(timeLabelFor(occ('2026-07-04', '11:00', null, '16:00'))).toBe('11:00 AM – 4:00 PM')
  })
})

describe('formatWhen', () => {
  it('is a plain date for one day with no time', () => {
    expect(formatWhen(when(true, occ('2026-07-04')))).toBe('July 4, 2026')
  })

  it('appends the time where there is one', () => {
    expect(formatWhen(when(true, occ('2026-07-04', '11:00', null, '16:00'))))
      .toBe('July 4, 2026 · 11:00 AM – 4:00 PM CDT')
  })

  it('is a range for a continuous span', () => {
    expect(formatWhen(when(true, occ('2026-07-03', null, '2026-07-05'))))
      .toBe('July 3\u2009\u2013\u20095, 2026')
  })

  it('NAMES the occasions for a series rather than ranging over them', () => {
    // "July 4th – July 18th, 2026" would claim a fortnight the family is not gathering for,
    // which is the exact misreading this whole feature exists to fix.
    expect(formatWhen(when(false, occ('2026-07-04'), occ('2026-07-11'), occ('2026-07-18'))))
      .toBe('July 4, July 11 and 1 more')
  })

  it('names two and counts the rest', () => {
    expect(formatWhen(when(false,
      occ('2026-07-04'), occ('2026-07-11'), occ('2026-07-18'), occ('2026-07-25'))))
      .toBe('July 4, July 11 and 2 more')
  })

  it('summarises a series CHRONOLOGICALLY whatever order it was entered in', () => {
    expect(formatWhen(when(false, occ('2026-07-18'), occ('2026-07-04'))))
      .toBe('July 4, July 18')
  })

  it('is null with nothing to say', () => {
    expect(formatWhen(when(true))).toBeNull()
  })
})

/**
 * A TIME REQUIRES A ZONE (20260826000003).
 *
 * The rule is one-directional and both halves are asserted, because the reverse conjunct is the
 * thing somebody would add for symmetry and it would be wrong: a zone with no time is permitted
 * in the database on purpose, so that a family deleting their last timed occasion does not meet
 * a refusal on a column they never touched.
 *
 * These duplicate what `gatherings_time_needs_zone` states in SQL, deliberately. That
 * constraint is the only thing underneath these actions — they write on the service role — and
 * a member who reached it would get "could not save" with no field named. This layer is what
 * tells them which box to fill in.
 */
describe('the zone a time is stated in', () => {
  it('refuses a time with no zone', () => {
    expect(codes(whenNoZone(true, occ('2026-07-04', '11:00')))).toContain('time-needs-zone')
  })

  it('accepts a DATE with no zone, which is a complete answer', () => {
    // "The reunion is on 4 July" needs no zone, and demanding one would be demanding a fact
    // about a gathering that has no time for it to qualify.
    expect(codes(whenNoZone(true, occ('2026-07-04')))).toEqual([])
  })

  it('accepts a zone with no time, because the constraint is one-directional', () => {
    // Permitted and inert. See 20260826000003's header for why the reverse conjunct would fail
    // on a row nobody edited.
    expect(codes(when(true, occ('2026-07-04')))).toEqual([])
  })

  it('refuses a zone the runtime does not know', () => {
    expect(codes({
      isContinuous: true,
      occurrences: [occ('2026-07-04', '11:00')],
      timeZone: 'Mars/Olympus_Mons',
    })).toContain('bad-zone')
  })

  it('accepts a real zone', () => {
    expect(codes(when(true, occ('2026-07-04', '11:00')))).toEqual([])
  })

  it('normaliseWhen DROPS a zone when nothing is timed', () => {
    // Permitted by the constraint is not a reason to write it: a stored value nothing reads is
    // the `dues_member_plans.start_date` trap. So the normaliser clears it rather than carrying
    // a zone that qualifies nothing.
    expect(normaliseWhen(when(true, occ('2026-07-04'))).timeZone).toBeNull()
    expect(normaliseWhen(when(true, occ('2026-07-04', '11:00'))).timeZone)
      .toBe('America/Chicago')
  })
})

describe('formatWhen names the stated zone', () => {
  it('appends the abbreviation beside a time', () => {
    // The PRIMARY half of the display rule: what the family said, with the zone that makes it
    // unambiguous. July, so Central is on daylight time and reads CDT.
    expect(formatWhen(when(true, occ('2026-07-04', '11:00'))))
      .toBe('July 4, 2026 · from 11:00 AM CDT')
  })

  it('follows daylight saving from the GATHERING day, not from today', () => {
    // A January gathering reads CST whenever the page is loaded. Reading the clock instead
    // would print CDT on a winter reunion opened in summer — the kind of detail a reader checks
    // and the reason `withZone` takes the occasion's own date.
    expect(formatWhen(when(true, occ('2026-01-10', '11:00'))))
      .toBe('January 10, 2026 · from 11:00 AM CST')
  })

  it('says nothing where there is no zone', () => {
    // A row written before 20260826000003 may legitimately have none. Guessing Central or
    // printing "undefined" would both be worse than silence.
    expect(formatWhen(whenNoZone(true, occ('2026-07-04', '11:00'))))
      .toBe('July 4, 2026 · from 11:00 AM')
  })

  it('adds no suffix to a date with no time', () => {
    expect(formatWhen(when(true, occ('2026-07-04')))).toBe('July 4, 2026')
  })
})
