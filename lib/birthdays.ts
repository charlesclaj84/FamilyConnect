/**
 * Whose birthday is next, and when — the whole of the arithmetic behind the **Birthdays**
 * pane on `/community/announcements`.
 *
 * ── WHY THIS IS A PURE MODULE ───────────────────────────────────────────────────────
 * AGENTS.md §7b, and the sharper version of that rule which `lib/calendar.ts` states in
 * capitals: EVERY DATE BUG IN THIS PRODUCT HAS BEEN A TIMEZONE BUG. A birthday list is the
 * second-best screen for one after the calendar itself — it does not corrupt a figure, it
 * tells a family that their grandmother's birthday was yesterday — and the natural
 * implementation (`new Date(dob)`, `.getMonth()`, `.getDate()`) is right in UTC and a day
 * out for everybody west of Greenwich. So `today` is a PARAMETER, nothing here reads a
 * clock, and every case in `lib/birthdays.test.ts` is runnable.
 *
 * There is no `new Date(string)` in this file. Dates are `YYYY-MM-DD` strings, split into
 * integers once, and the only arithmetic a `Date` is asked for is a difference in DAYS
 * between two `Date.UTC` midnights — which `lib/calendar.ts` explains is the one thing a
 * Date is trustworthy for, because a day is always a day whereas a month is 28 to 31 of
 * them.
 *
 * ── WHAT THIS MODULE DELIBERATELY DOES NOT KNOW ─────────────────────────────────────
 * It takes a roster and answers a question about dates. It does not know who is approved,
 * who the caller may see, or **who is dead**, and it must not start guessing at any of the
 * three:
 *
 *   * Membership and permission are the ACTION's job. AGENTS.md §5 — the roster is only
 *     fetched when `announcements/birthdays:view` resolves, and a filter applied here would
 *     be a filter applied after the PII had already reached the browser in the RSC payload.
 *   * **`people.sunset_date` IS THE COLUMN THAT DECIDES WHETHER SOMEBODY STILL HAS
 *     BIRTHDAYS, AND IT IS NOT IN `BirthdayPerson`.** A great-uncle who died in 1998 is a
 *     perfectly ordinary row on the family tree (AGENTS.md §4b), with a `date_of_birth`
 *     this module would happily turn into "12 days away, turning 94". Whoever builds the
 *     roster owes `sunset_date IS NULL` in the query, for the §5 reason above: the right
 *     place to withhold a row is the fetch, not the arithmetic.
 *
 * ── AND WHAT IT DOES NOT RESTATE ────────────────────────────────────────────────────
 * `lib/age-utils.ts` derives exactly one thing — *is this person under 18 today* — and it
 * is not what this module needs: an age reached on some future date is a different figure
 * from an age held now, and `computeIsMinor` reads `new Date()` internally, so a pure
 * function could not call it even if the question matched. What IS shared is that file's
 * discipline, and it is the reason there is no `people.next_birthday` column and must never
 * be one: a stored answer about somebody's age is wrong from the morning of their birthday
 * until somebody notices. Derive it, every time, from the one column that can answer.
 *
 * Formatting is `lib/date-utils.ts`'s job and stays there. This module hands back
 * `YYYY-MM-DD` and integers; `formatDate` turns `onDate` into "February 28th, 2027".
 * `birthdayWeekday` at the bottom is the one exception, and it argues for itself.
 *
 * ── THE FIVE DECISIONS, EACH OF WHICH IS A REAL BUG IN THIS SHAPE ───────────────────
 *
 * 1. **29 FEBRUARY RESOLVES TO 28 FEBRUARY IN A COMMON YEAR.** Somebody born on a leap day
 *    has no birthday in three years out of four, and arithmetic left to itself does not give
 *    one wrong answer, it gives TWO THAT DISAGREE — measured, by deleting the clamp and
 *    running the tests. `Date.UTC(2027, 1, 29)` overflows into the next month, exactly the way
 *    `setUTCMonth` does on 31 January (the trap AGENTS.md §7c carries a paragraph about), so
 *    the day COUNT walks to 1 March; while `isoOf` assembles its string from the integers and
 *    prints "2027-02-29", a date that is on no calendar. The pane would show a day that never
 *    happened beside a countdown to the day after it. So the answer is CHOSEN here rather than
 *    fallen into, and it is the last day of the month the person was actually born in.
 *
 *    Three answers were available and two are worse. **Skipping them** — no birthday at all
 *    in a common year — is out first: a relative vanishing from the family's birthday list
 *    in three years out of four is precisely the failure this pane exists to prevent, and it
 *    fails silently, which is the shape nobody ever reports. Between **28 February** and
 *    **1 March**, the deciding argument is not sentiment about leaplings; it is that THIS
 *    CODEBASE HAS ALREADY ANSWERED THIS QUESTION ONCE. `addCadenceSteps` in
 *    `lib/dues-utils.ts` CLAMPS a 31st into a short month rather than letting it overflow,
 *    and AGENTS.md §7c states that clamp as the house answer to "this day does not exist in
 *    this month". Answering 1 March here would be a second answer to one question in one
 *    product, which is how two screens come to disagree — and it would move the birthday
 *    into a different month from the one every relative associates with it, three years out
 *    of four, while the fourth year snapped it back.
 *
 *    Note what the clamp does NOT touch: `turning` is the difference of the two YEARS, so
 *    somebody born on 29 February 2000 turns 27 on 28 February 2027 and 28 on 29 February
 *    2028. Clamping the day never invents or loses a year.
 *
 * 2. **THE HORIZON CROSSES NEW YEAR.** On 10 December a 60-day window reaches 8 February,
 *    so the next occurrence is not always in `today`'s year. That is one `if` and it is the
 *    one every naive version of this function is missing — with it removed, a family sees an
 *    empty list for the whole of December and January, which reads as "nobody has a
 *    birthday" rather than as a bug.
 *
 * 3. **TODAY COUNTS.** A birthday today is `daysAway: 0` and sorts first. The bound is
 *    `>= 0`, not `> 0`: the one day this pane most needs to be right about is the day it is
 *    read on, and an exclusive bound loses exactly that day.
 *
 * 4. **A DATE THAT IS NOT A DATE IS NOT A BIRTHDAY.** A null `date_of_birth` — which is
 *    most of a real family tree — is dropped, silently and deliberately, along with anything
 *    that does not parse as a real calendar date (`1990-13-01`, `1990-02-30`, and
 *    `2001-02-29`, which is not a day that existed). There is no placeholder to substitute
 *    and no reason to invent one: a fallback of 1 January would put half the Directory on
 *    the list every New Year's Day, wishing people a happy birthday the product has no
 *    evidence for. Silence is the only honest answer, and it is the same judgement
 *    `computeIsMinor` makes when it refuses to read "not recorded" as "a child".
 *
 * 5. **AN AGE IS WITHHELD RATHER THAN GUESSED.** `turning` is null when the stored year is
 *    one the arithmetic cannot trust, and the test for that is derived rather than invented:
 *    a year that has not happened yet. `1962` mistyped as `2062` gives "turning -36", and a
 *    date of birth in the future gives "turning 0" for somebody who has not been born. Both
 *    are data-entry errors rather than facts, and both are reported as *no age* while the
 *    DAY and MONTH still show — because a four-digit typo is a typo in the year, and there is
 *    no reason to withhold the two parts that are almost certainly right.
 *
 *    There is deliberately NO upper bound. "Turning 1976" is implausible, but any ceiling
 *    picked here would be a number nobody chose, quietly hiding an ancestor's real date,
 *    whereas a year in the future is untrustworthy by construction rather than by taste.
 */

/** One person, as much of them as this module needs. `dateOfBirth` is `people.date_of_birth`. */
export interface BirthdayPerson {
  id: string
  firstName: string
  lastName: string
  dateOfBirth: string | null
}

export interface UpcomingBirthday {
  id: string
  firstName: string
  lastName: string
  /** The next occurrence, ISO YYYY-MM-DD. */
  onDate: string
  /** 0 = today. */
  daysAway: number
  /** The age they turn, or null when the stored year cannot be trusted. */
  turning: number | null
}

/**
 * How far ahead the pane looks, in days, INCLUSIVE — 60 days from today includes day 60.
 *
 * Here rather than in the page for the reason every constant in `lib/dues-utils.ts` is
 * there: the number appears in the arithmetic, in the empty-state sentence ("no birthdays in
 * the next 60 days") and in the manual chapter, and a hand-typed copy in any of the three is
 * a sentence that eventually disagrees with the list underneath it. It is a default rather
 * than a hard-coded bound so the tests can walk a short horizon without seeding 60 days of
 * fixtures.
 */
export const BIRTHDAY_HORIZON_DAYS = 60

/**
 * The age range whose NUMBER is not printed. Inclusive at both ends: 30 and 60 are both in it.
 *
 * ── WHY A RANGE AND NOT A CUTOFF ────────────────────────────────────────────────────
 * A birthday list is a prompt to say something nice, and for most of a life the age is part of
 * that — a family wants to know a cousin is turning 8, and it wants to know a grandmother is
 * turning 80. The middle is where a published number stops being a celebration and starts
 * being a fact about somebody that they did not choose to put on a noticeboard. So the two
 * ends stay and the middle is replaced.
 *
 * THE ROW IS NEVER DROPPED AND THE DATE IS NEVER HIDDEN. What is withheld is one number; who
 * and when are the whole point of the pane. That is the same shape as the `turning === null`
 * case below, which withholds the age of somebody whose stored year cannot be trusted and
 * still prints their day and month.
 *
 * The bounds are here rather than in the component for the reason `BIRTHDAY_HORIZON_DAYS` is:
 * two call sites render the age (the table cell and the folded `RowMeta` beside the name), and
 * a copy in either is a pane that shows a number in one layout and an emoji in the other.
 */
export const DISCREET_AGE_MIN = 30
export const DISCREET_AGE_MAX = 60

/**
 * What stands in for a withheld age.
 *
 * A SMILING FACE, and it carries a real accessible name — see `DISCREET_AGE_LABEL`. A bare
 * emoji in a table cell is announced as "slightly smiling face", which tells a screen-reader
 * user that there is a decoration where their neighbours have a number and nothing about why.
 */
export const DISCREET_AGE_EMOJI = '\u{1F642}'
export const DISCREET_AGE_LABEL = 'Age not shown'

/** What the Turning column prints for one row. */
export type BirthdayAge =
  | { kind: 'age'; value: number }
  | { kind: 'discreet' }
  | { kind: 'unknown' }

/**
 * Decide how one person's age is rendered. Pure, total, and the only place that decides it.
 *
 * Three outcomes and they are genuinely three, which is why this returns a tagged union rather
 * than a string: the component styles them differently (a number, an emoji with a label, an
 * em-dash) and the footnote under the table has to say which of the two withholdings actually
 * happened. Collapsing them into one "not shown" would make that sentence a guess.
 */
export function birthdayAge(turning: number | null): BirthdayAge {
  if (turning === null) return { kind: 'unknown' }
  if (turning >= DISCREET_AGE_MIN && turning <= DISCREET_AGE_MAX) return { kind: 'discreet' }
  return { kind: 'age', value: turning }
}

/** A calendar date as integers, which is the only form any arithmetic here happens in. */
interface CalendarDate {
  year: number
  monthNumber: number         // 1–12, NOT a Date's 0-based month index
  day: number
}

const ISO_DATE = /^(\d{4})-(\d{2})-(\d{2})$/

const MILLIS_PER_DAY = 86_400_000

/**
 * How two names are ordered against each other, pinned so the answer cannot depend on where
 * the code happens to be running. The argument is at the `sort` in `upcomingBirthdays`,
 * which is the only caller.
 */
// PINNED, and it is the honest state rather than the right one. A collator has to be built
// once and shared — see the note below on why — and a per-locale one needs the reader's tag
// threaded into `upcomingBirthdays`, which is Phase 4's surface-by-surface work. Recorded
// here so the gap is visible: for a Spanish reader Ñ currently sorts after Z.
const NAME_ORDER = new Intl.Collator('en')

/**
 * Days in each month of a common year, and the leap rule beside it.
 *
 * NO `Date` IN EITHER, on purpose. The obvious version is `new Date(Date.UTC(year,
 * monthNumber, 0)).getUTCDate()` — day 0 of the next month, which `lib/calendar.ts` uses and
 * which is exact for every year that file ever sees. It is NOT exact here, because this one
 * is handed birth years: `Date.UTC` maps a year of 0–99 into the 1900s, so a year of `0050`
 * would have its February measured against 1950. Twelve integers and the four-hundred-year
 * rule are shorter than the paragraph explaining why the clever version is safe.
 */
const MONTH_LENGTHS = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31] as const

function isLeapYear(year: number): boolean {
  return year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0)
}

function daysInMonth(year: number, monthNumber: number): number {
  return monthNumber === 2 && isLeapYear(year) ? 29 : MONTH_LENGTHS[monthNumber - 1]
}

/**
 * A `YYYY-MM-DD` this module will work with, or null.
 *
 * It checks that the date EXISTED, not merely that it is shaped like one. `1990-02-30` and
 * `2001-02-29` both pass every `\d{2}` pattern and neither is a day anybody was born on; fed
 * to `Date.UTC` they silently become 2 March and 1 March, so a person entered with a
 * fat-fingered February would appear on the list under a date they would not recognise. A
 * date that never happened is not a birthday (decision 4 above), so it is dropped here.
 *
 * `.slice(0, 10)` because PostgREST hands a `DATE` column back as `YYYY-MM-DD` but an
 * upstream `TIMESTAMPTZ` — or a caller passing a value it read from somewhere else — arrives
 * as a full ISO instant. Taking the date part is what `lib/date-utils.ts` does with the same
 * ambiguity, and the alternative is refusing a value that says exactly what it means.
 */
function parseCalendarDate(value: string | null | undefined): CalendarDate | null {
  if (!value) return null
  const match = ISO_DATE.exec(value.slice(0, 10))
  if (!match) return null
  const year = Number(match[1])
  const monthNumber = Number(match[2])
  const day = Number(match[3])
  if (monthNumber < 1 || monthNumber > 12) return null
  if (day < 1 || day > daysInMonth(year, monthNumber)) return null
  return { year, monthNumber, day }
}

/**
 * The UTC midnight of a calendar date, as a number of milliseconds.
 *
 * ONLY EVER CALLED WITH `today` OR AN OCCURRENCE YEAR DERIVED FROM IT, never with a birth
 * date. That is what keeps the `Date.UTC` two-digit-year remap (see `MONTH_LENGTHS`) out of
 * this function's way: `upcomingBirthdays` refuses a `today` before year 100, and an
 * occurrence is `today.year` or `today.year + 1`. The other overflow — a day the month does
 * not have — cannot arrive either, because `occurrenceIn` clamps first.
 */
function utcMidnight(date: CalendarDate): number {
  return Date.UTC(date.year, date.monthNumber - 1, date.day)
}

function isoOf(date: CalendarDate): string {
  return [
    String(date.year).padStart(4, '0'),
    String(date.monthNumber).padStart(2, '0'),
    String(date.day).padStart(2, '0'),
  ].join('-')
}

/**
 * This birthday as it falls in one particular year — the leap-day clamp of decision 1.
 *
 * `Math.min` against the month's real length is the whole of it, and it is deliberately
 * written as a general clamp rather than as an `if (monthNumber === 2 && day === 29)`: the
 * general form states the RULE ("the last day of that month, if the day does not reach"),
 * which is the same rule `addCadenceSteps` applies to a dues schedule anchored on the 31st.
 * 29 February happens to be the only date it ever fires for — every other (month, day) pair
 * exists in every year — so the special case would be equivalent, and would read as a
 * quirk about February rather than as the house answer to a missing day.
 */
function occurrenceIn(year: number, birth: CalendarDate): CalendarDate {
  return {
    year,
    monthNumber: birth.monthNumber,
    day: Math.min(birth.day, daysInMonth(year, birth.monthNumber)),
  }
}

/**
 * The next time this birthday comes round, counting today as next.
 *
 * The `today.year + 1` branch is decision 2 — the whole of what makes a December horizon
 * reach into February. Comparing the two UTC midnights rather than the two ISO strings is
 * arbitrary between exact options; it keeps one notion of "before" in this file instead of
 * two, and the strings are built for display rather than for comparison.
 */
function nextOccurrence(birth: CalendarDate, today: CalendarDate): CalendarDate {
  const thisYear = occurrenceIn(today.year, birth)
  if (utcMidnight(thisYear) >= utcMidnight(today)) return thisYear
  return occurrenceIn(today.year + 1, birth)
}

/**
 * Everybody on `people` whose next birthday falls within `horizonDays` of `today`, soonest
 * first.
 *
 * ── IT THROWS ON A `today` IT CANNOT READ, AND `lib/calendar.ts` DOES NOT ───────────
 * That difference is deliberate rather than an inconsistency. In `buildCalendarMonth`,
 * `today` drives one thing — which cell is highlighted — so an unreadable one degrades to no
 * highlight, and a highlight is the one thing on that page that can be absent without
 * misinforming anybody. Here `today` is the entire basis of the answer: every date, every
 * count and every age is measured from it. A function that returned `[]` would render "no
 * birthdays in the next 60 days" over a family that has four, which is a false statement in
 * the product's own voice. Every caller has just built the string with `todayLocal()`, so an
 * unreadable one is a bug and belongs in a stack trace.
 *
 * `horizonDays` is refused on the same ground: it arrives from code, never from a query
 * string, and a negative or fractional one is a caller's mistake rather than a member's.
 */
export function upcomingBirthdays(
  people: readonly BirthdayPerson[],
  today: string,
  horizonDays: number = BIRTHDAY_HORIZON_DAYS,
): UpcomingBirthday[] {
  const now = parseCalendarDate(today)
  if (!now) {
    throw new TypeError(`upcomingBirthdays: not a YYYY-MM-DD date: ${String(today)}`)
  }
  // The `Date.UTC` remap again (see `MONTH_LENGTHS`): `Date.UTC(50, 0, 1)` is 1950, so a
  // two-digit `today` would answer questions about a year seventeen centuries from the one
  // it named. Unreachable from `todayLocal()` and one line to close.
  if (now.year < 100) {
    throw new TypeError(`upcomingBirthdays: a year below 100 is not a date this reads: ${String(today)}`)
  }
  if (!Number.isInteger(horizonDays) || horizonDays < 0) {
    throw new TypeError(`upcomingBirthdays: horizonDays must be a whole number of days, 0 or more: ${String(horizonDays)}`)
  }

  const todayMillis = utcMidnight(now)
  const found: UpcomingBirthday[] = []

  for (const person of people) {
    const birth = parseCalendarDate(person.dateOfBirth)
    if (!birth) continue                       // decision 4: not a date, so not a birthday

    const occurrence = nextOccurrence(birth, now)
    // Exact, with no rounding needed and none wanted: both operands are UTC midnights, so
    // the difference is a whole number of 86,400,000ms by construction. This is the one
    // arithmetic `lib/calendar.ts` calls a Date trustworthy for — no DST, no month lengths,
    // no local offset anywhere in it.
    const daysAway = (utcMidnight(occurrence) - todayMillis) / MILLIS_PER_DAY

    // `>= 0` is decision 3, and `<= horizonDays` is the horizon being inclusive.
    // `nextOccurrence` cannot answer earlier than today, so the lower bound is a statement
    // of that invariant rather than a filter — leave it: it is what a future edit to the
    // wrap would trip over.
    if (daysAway < 0 || daysAway > horizonDays) continue

    // Decision 5. The difference of the two YEARS, which the leap-day clamp never touches.
    const turning = occurrence.year - birth.year

    found.push({
      id: person.id,
      firstName: person.firstName,
      lastName: person.lastName,
      onDate: isoOf(occurrence),
      daysAway,
      turning: turning > 0 ? turning : null,
    })
  }

  // A TOTAL ORDER, so two renders of the same roster cannot disagree — which matters for
  // React keys and for two relatives comparing the same screen. Soonest first is the point
  // of the pane; after that, surname then given name, which is the order `getMembers` reads
  // the Directory in and which groups relatives who share a surname together instead of
  // scattering them. The id is the last resort, for two rows a family has genuinely entered
  // twice.
  //
  // ── THE COLLATOR IS PINNED, AND THAT IS WHAT MAKES THE CLAIM ABOVE TRUE ───────────
  // `localeCompare` with no second argument resolves against the RUNTIME's default locale,
  // which is a different thing on a Node server and in a member's browser — and this module
  // is deliberately client-safe, so both will run it over the same roster. Where the two
  // ICU collations disagree is exactly where a large family lives: accented surnames.
  // `['Ångström', 'Allen']` sorts one way under `en` and the other under `sv`, so an
  // unpinned comparator would hand two people looking at one pane two different orders and
  // would reorder the list under React on hydration, which is a key-stability bug rather
  // than a cosmetic one.
  //
  // So a single module-level `Intl.Collator` is built once and shared, pinned to `en` for
  // the reason `birthdayWeekday` pins `'en-US'` and `timeZone: 'UTC'`: every other date and
  // string decision in this file is locale- and zone-free by construction, and this was the
  // one line that was not. `sensitivity: 'base'` is deliberately NOT set — that would fold
  // "Ana" and "Ána" into one another and make the comparator non-deterministic between two
  // genuinely different surnames, which is the opposite of a total order. It is a
  // module-level constant rather than per-call because, unlike the weekday formatter, there
  // is no option here whose effect a test could only observe on a fresh instance.
  //
  // `lib/person-search.ts` is the neighbour that answers the OTHER half of this question —
  // accent-insensitive MATCHING, so "jose" finds "José" — and it is not reused here on
  // purpose: folding accents is right for deciding whether a name matches what somebody
  // typed and wrong for deciding which of two names comes first.
  //
  // The id tiebreak is a RAW comparison rather than a collated one, for the same reason from
  // the other end: a `people.id` is a uuid, so there is no locale that has an opinion about
  // it, and running it through a collator would be asking a question about human language of
  // a string that is not any.
  return found.sort((a, b) =>
    a.daysAway - b.daysAway
    || NAME_ORDER.compare(a.lastName, b.lastName)
    || NAME_ORDER.compare(a.firstName, b.firstName)
    || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0))
}

/**
 * "Tuesday" — the weekday `onDate` falls on.
 *
 * ── WHY THIS IS HERE AT ALL, AND WHY IT IS NOT IN `lib/date-utils.ts` ───────────────
 * The pane is specified to show the day of the week, and `formatDate` deliberately refuses
 * to carry one: it used to lead with a weekday and that made every date in the product pay
 * for a fact almost none of them needed. That refusal is right and stays. So the weekday has
 * to come from somewhere, and the somewhere must not be a `new Date(onDate).toLocaleDateString()`
 * in a component — that is UTC midnight read in the runtime's own zone, which is the previous
 * day in any negative offset, and the pane would print "Monday" over a date reading
 * "February 28th" on a Tuesday. One screen wants this today; when a second one does, it
 * belongs in `date-utils` beside `formatDate` and this becomes a re-export.
 *
 * ── `timeZone: 'UTC'`, AND A FORMATTER BUILT PER CALL ───────────────────────────────
 * Both are load-bearing and both are `lib/calendar.ts`'s `monthLabel` lesson verbatim. The
 * option is what makes the answer agree with the string it was derived from. Building the
 * formatter per call is what makes the option TESTABLE: an `Intl.DateTimeFormat` resolves its
 * zone when it is CONSTRUCTED and keeps it for life, so a module-level one never notices
 * `process.env.TZ` changing afterwards — and the negative-offset assertion in the test file
 * would have passed on a UTC runner with the option deleted. An assertion that cannot fail is
 * worse than no assertion, and one `Intl` construction per row is the right price for that.
 *
 * Intl rather than a seven-name table because there is already one of those in
 * `components/calendar/MonthCalendar.tsx` and it is a different thing — the fixed Sunday-first
 * COLUMN HEADINGS of a grid, positional rather than derived from a date. A second copy that
 * happens to hold the same strings for a different reason is how two of them come to drift.
 *
 * It throws on an unreadable date for `upcomingBirthdays`' reason: the only strings it is
 * ever handed are `onDate` values this module built.
 */
export function birthdayWeekday(onDate: string, locale: string = 'en-US'): string {
  const date = parseCalendarDate(onDate)
  if (!date) throw new TypeError(`birthdayWeekday: not a YYYY-MM-DD date: ${String(onDate)}`)
  if (date.year < 100) {
    throw new TypeError(`birthdayWeekday: a year below 100 is not a date this reads: ${String(onDate)}`)
  }
  // The reader's locale: a weekday NAME is read, not compared. `timeZone: 'UTC'` stays for
  // the reason this function's header gives — the value is a wall-clock label.
  const format = new Intl.DateTimeFormat(locale, { weekday: 'long', timeZone: 'UTC' })
  return format.format(new Date(utcMidnight(date)))
}
