import type { UpcomingBirthday } from '@/lib/birthdays'

/**
 * The arithmetic behind the birthday prompt and the dashboard band. PURE.
 *
 * ── IT TAKES `today` AS A PARAMETER, WHICH IS §7b's RULE AND THE REASON THIS FILE EXISTS ──
 * `npm test` has no clock, no database and no React, and everything here has real edge cases —
 * a leap-day birthday, a year boundary between the prompt and the day, a birthday recorded
 * with a year nobody can trust. So the whole of it is checkable by value, and
 * `app/actions/birthdays.ts` passes `todayLocal()` in.
 *
 * `lib/birthdays.ts` already owns the horizon WALK (`upcomingBirthdays`) and is not duplicated
 * here. What this adds is the three questions that walk cannot answer: which YEAR a greeting
 * belongs to, whether today is the day, and how far ahead to prompt.
 */

/**
 * How far ahead the composer is offered, in days, INCLUSIVE.
 *
 * ── FOURTEEN AND NOT SIXTY, AND THE DIFFERENCE IS WHAT THE TWO SURFACES ARE FOR ────
 * `BIRTHDAY_HORIZON_DAYS` is 60 and belongs to the Birthdays PANE, which is a list an
 * organizer browses and works through. This is a PROMPT about something imminent: two weeks is
 * enough time to write something and think about it, and not so much that the same four names
 * sit there for two months and become furniture.
 *
 * One constant, because the number appears in the arithmetic, in the prompt's own lede and in
 * the manual — the reason `BIRTHDAY_HORIZON_DAYS` is a constant, applied to the second number.
 */
export const BIRTHDAY_COMPOSE_LEAD_DAYS = 14

/** One relative the family has not greeted yet, with everything the prompt renders. */
export interface BirthdayPrompt extends UpcomingBirthday {
  /**
   * Always false in the list the action returns — it FILTERS the greeted out.
   *
   * Carried anyway, so a future surface that wants to show what has already been done does
   * not have to change the shape, and so a reader of the type does not have to infer the
   * filter from the action.
   */
  greeted: boolean
}

/** The band on the birthday member's own dashboard. */
export interface MyBirthdayBanner {
  firstName: string
  /**
   * The announcement the family posted, when a member composed one — for the way through.
   *
   * NULL means nobody has posted, and it means the same thing when the prompt was DISMISSED:
   * the band still appears (the product greets the person to their face) and simply offers no
   * link. A link to a greeting that does not exist is the one thing this band must not do.
   */
  greetedAnnouncementId: string | null
}

/**
 * Which calendar year a greeting belongs to.
 *
 * ── THE YEAR OF `today`, AND THAT IS WHY THE PROMPT WINDOW IS SHORT ────────────────
 * `birthday_greetings` is keyed on (person, year), and this is the function that decides the
 * year — so it has to agree with itself between the day somebody composes and the day the
 * birthday falls. With a fourteen-day lead that is only ever a problem across New Year: a
 * greeting composed on 27 December for a 3 January birthday records the OLD year.
 *
 * That is the correct answer and is worth stating rather than fixing. The row means *"this
 * family greeted Ada, and it was around this time"*, and the alternative — deriving the year
 * from the BIRTHDAY rather than from today — would make a greeting composed in December
 * disappear from next year's prompt list on 1 January, re-prompting a family that had already
 * acted. Re-prompting is the failure this table exists to prevent.
 *
 * The cost is bounded and one-directional: a family that greets Ada in late December may be
 * prompted once more in the new year. Nobody is greeted twice by the product, and nothing is
 * lost.
 */
export function greetingYearFor(today: string): number {
  const year = Number(today.slice(0, 4))
  // NEVER `NaN` INTO A UNIQUE KEY. A malformed `today` would otherwise write a row nothing
  // could ever match, so the prompt would reappear forever with no visible cause.
  return Number.isFinite(year) && year > 1900 ? year : new Date().getUTCFullYear()
}

/**
 * Is today this person's birthday?
 *
 * ── MONTH AND DAY ONLY, COMPARED AS STRINGS, AND NEVER THROUGH `Date` ─────────────
 * `date_of_birth` is a bare `DATE` and so is `today`. `new Date('1954-03-11')` is UTC
 * midnight and renders as 10 March in any negative offset — which is exactly how a calendar
 * comes to put a birthday on the wrong day for half the country, and why AGENTS.md's calendar
 * section insists on `YYYY-MM-DD` string arithmetic. Slicing the two five-character month-day
 * substrings and comparing them cannot be wrong in any timezone.
 *
 * ── 29 FEBRUARY IS GREETED ON THE 29th, AND ON NO OTHER DAY ───────────────────────
 * Stated because the alternative looks kinder and is worse. Moving a leap-day birthday to the
 * 28th or the 1st in a common year means the product decides which day somebody's birthday is
 * on, and the two halves of a family that disagree about it would both be told they were
 * right. `upcomingBirthdays` in `lib/birthdays.ts` makes the same call for the horizon list, so
 * the prompt and the band agree.
 */
export function isBirthdayToday(dateOfBirth: string | null, today: string): boolean {
  if (!dateOfBirth || dateOfBirth.length < 10 || today.length < 10) return false
  return dateOfBirth.slice(5, 10) === today.slice(5, 10)
}
