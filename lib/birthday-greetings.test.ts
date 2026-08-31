import { describe, expect, it } from 'vitest'
import {
  BIRTHDAY_COMPOSE_LEAD_DAYS, greetingYearFor, isBirthdayToday,
} from '@/lib/birthday-greetings'

/**
 * ── MUTATION-CHECKED, per §7b, and the mutations are listed so the next person can repeat them
 *
 *   `isBirthdayToday` compare `slice(0, 10)` instead of `slice(5, 10)`
 *       -> every "same day, different year" case goes red. That slice is the whole function.
 *   `isBirthdayToday` drop the length guard
 *       -> the two short-string cases throw rather than answering false.
 *   `greetingYearFor` return `new Date(today).getUTCFullYear()`
 *       -> the malformed-input case goes red, and so does the NaN guard's purpose.
 *   `greetingYearFor` drop the `> 1900` test
 *       -> '0000-01-01' is accepted as year 0 and the guard case goes red.
 */
describe('isBirthdayToday', () => {
  it('is true on the same month and day in a different year', () => {
    expect(isBirthdayToday('1954-03-11', '2026-03-11')).toBe(true)
  })

  it('is false the day before and the day after', () => {
    expect(isBirthdayToday('1954-03-11', '2026-03-10')).toBe(false)
    expect(isBirthdayToday('1954-03-11', '2026-03-12')).toBe(false)
  })

  it('is false for a blank birthday, because a null birthday is not a birthday', () => {
    // The reading `isMinorOn` takes and `propagateChapterToChildren` depends on: "under 18" and
    // "it is their birthday" are things a family has RECORDED, never things to assume about an
    // empty field. Most of an older generation on a real tree has no recorded birthday.
    expect(isBirthdayToday(null, '2026-03-11')).toBe(false)
    expect(isBirthdayToday('', '2026-03-11')).toBe(false)
  })

  it('answers false rather than throwing on a truncated date', () => {
    expect(isBirthdayToday('1954-03', '2026-03-11')).toBe(false)
    expect(isBirthdayToday('1954-03-11', '2026-03')).toBe(false)
  })

  it('greets a leap-day birthday on the 29th and on no other day', () => {
    // Deliberate: moving it to the 28th or the 1st would have the product decide which day
    // somebody's birthday is on. `lib/birthdays.ts` makes the same call for the horizon list.
    expect(isBirthdayToday('2000-02-29', '2028-02-29')).toBe(true)
    expect(isBirthdayToday('2000-02-29', '2026-02-28')).toBe(false)
    expect(isBirthdayToday('2000-02-29', '2026-03-01')).toBe(false)
  })

  it('does not confuse a transposed month and day', () => {
    // 11 March is not 3 November. A `Date`-based comparison in the wrong locale would.
    expect(isBirthdayToday('1954-03-11', '2026-11-03')).toBe(false)
  })
})

describe('greetingYearFor', () => {
  it('is the year of today, not of the birthday', () => {
    expect(greetingYearFor('2026-03-11')).toBe(2026)
    expect(greetingYearFor('2026-12-31')).toBe(2026)
  })

  it('records the OLD year for a greeting composed before New Year', () => {
    // The documented, accepted cost of keying on `today`: a greeting written on 27 December
    // for a 3 January birthday belongs to the old year, so the family may be prompted once
    // more in the new one. Deriving the year from the BIRTHDAY instead would make a December
    // greeting vanish from the list on 1 January and re-prompt a family that had acted —
    // which is the failure the table exists to prevent. Asserted so the trade-off is a
    // decision somebody can find rather than a surprise.
    expect(greetingYearFor('2026-12-27')).toBe(2026)
  })

  it('never puts NaN into the unique key', () => {
    // A row keyed on NaN could never be matched again, so the prompt would reappear forever
    // with no visible cause — the worst shape this bug could take.
    const thisYear = new Date().getUTCFullYear()
    expect(greetingYearFor('not-a-date')).toBe(thisYear)
    expect(greetingYearFor('')).toBe(thisYear)
    expect(greetingYearFor('0000-01-01')).toBe(thisYear)
  })
})

describe('BIRTHDAY_COMPOSE_LEAD_DAYS', () => {
  it('is shorter than the Birthdays pane horizon', async () => {
    // The two numbers answer different questions — a list to browse versus a prompt about
    // something imminent — and the prompt being the shorter of the two is the whole reason
    // there are two. Asserted rather than commented, because a later edit that raised this to
    // 60 would silently turn the prompt into the pane.
    const { BIRTHDAY_HORIZON_DAYS } = await import('@/lib/birthdays')
    expect(BIRTHDAY_COMPOSE_LEAD_DAYS).toBeLessThan(BIRTHDAY_HORIZON_DAYS)
    expect(BIRTHDAY_COMPOSE_LEAD_DAYS).toBeGreaterThan(0)
  })
})
