import { DEFAULT_MONEY_LOCALE } from '@/lib/currency-utils'
import { type T } from '@/lib/i18n/t'

/**
 * How a DATE or a TIME is worded.
 *
 * ── EVERY FORMATTER HERE TAKES A LOCALE, AND THAT IS NEW (2026-08-26) ───────────────
 * This module used to hold a `MONTHS` table, an `ordinal()` and a `'PM' : 'AM'`, and printed
 * "June 12th, 2026" site-wide. That was a deliberate house voice and it was English-only by
 * construction: month names, ordinal suffixes, AM/PM and month-first numeric order are all
 * conventions of one language.
 *
 * **The ordinal is gone, in English too**, and that was the decision rather than a side effect.
 * `Intl` cannot produce "12th", and the three alternatives were each worse:
 *
 *   per-locale voice modules   ordinals are not a table. Spanish uses none at all and French
 *                              uses one only for the 1st, so each language needs its own FORMAT
 *                              FUNCTION — three copies of one rule, which is exactly the drift
 *                              `lib/chapter-propagation.ts` exists to prevent.
 *   English keeps its voice    one product with two date conventions, chosen by who is reading.
 *                              A screenshot in a support thread would look like a different
 *                              application, and every future date decision gets made twice.
 *   leave it English           not localizing at all.
 *
 * What `Intl` buys beyond correctness in Spanish and French: French renders times as `14:30`,
 * which an AM/PM formatter can never do, and numeric dates stop being actively WRONG abroad —
 * `12/6/2026` means 12 June nearly everywhere except the United States.
 *
 * ── `timeZone: 'UTC'` ON EVERY FORMATTER IS LOAD-BEARING, NOT TIDINESS ─────────────
 * The values here are wall-clock LABELS — a bare `DATE` or `TIME` with no zone (AGENTS.md,
 * "DATES ARE `DATE`"). The old implementation split the `YYYY-MM-DD` string and never
 * constructed a `Date`, precisely so that no local clock could be consulted. `Intl` needs a
 * `Date`, so the label is rebuilt with `Date.UTC(...)` AND read back with `timeZone: 'UTC'`.
 *
 * Both halves are required. Measured with `TZ=America/Los_Angeles`:
 *
 *     2026-08-01, pinned UTC   ->  "August 1, 2026"
 *     2026-08-01, NOT pinned   ->  "July 31, 2026"
 *
 * That is the bug this whole module exists to prevent, and dropping the option reintroduces it
 * on every date in the product. `lib/calendar.ts` makes the same argument for its month heading.
 *
 * ── THE LOCALE DEFAULTS, WHICH IS HOW 250 CALL SITES KEPT WORKING ──────────────────
 * Every locale parameter is optional and falls back to `DEFAULT_MONEY_LOCALE` (`en-US`) — the
 * same constant the money formatter uses, so the two cannot drift into different defaults. A
 * call site that has not been given the reader's locale yet renders English, silently and
 * correctly.
 *
 * That is a deliberate BACKLOG rather than a finished job, and it is counted rather than
 * assumed: `npm run i18n:check` reports how many date and money call sites still default. The
 * threading happens surface by surface as each is translated, because a component showing a date
 * is a component showing text — it needs the locale anyway, and passing it twice would be waste.
 *
 * ── A FORMATTER IS CACHED ON ITS ARGUMENTS, WHICH IS SAFE HERE AND WAS NOT THERE ───
 * `lib/calendar.ts` records that a module-level `Intl.DateTimeFormat` made a mutation ship green
 * from CI: a formatter resolves its zone when CONSTRUCTED, so it never noticed `process.env.TZ`
 * changing and the test asserted nothing. That hazard is about a formatter whose inputs come from
 * the ENVIRONMENT.
 *
 * Here the locale is an argument and the zone is the literal `'UTC'`, so a cache keyed on the
 * locale cannot go stale — there is nothing ambient left for it to miss. Worth having: 129 date
 * call sites per render, and constructing an `Intl.DateTimeFormat` is not free.
 */

/** The long form, shared by `formatDate` and `formatDateRange` so the two cannot diverge. */
const LONG: Intl.DateTimeFormatOptions = { year: 'numeric', month: 'long', day: 'numeric' }

/** One formatter per (option-shape, locale). See the header for why caching is safe here. */
const formatters = new Map<string, Intl.DateTimeFormat>()

function dateFormatter(locale: string, options: Intl.DateTimeFormatOptions, tag: string) {
  const key = `${tag}|${locale}`
  let found = formatters.get(key)
  if (!found) {
    found = new Intl.DateTimeFormat(locale, { ...options, timeZone: 'UTC' })
    formatters.set(key, found)
  }
  return found
}

/**
 * A `YYYY-MM-DD` label as a `Date` at UTC midnight, or null.
 *
 * The label is REBUILT rather than parsed: `new Date('2026-08-01')` happens to be UTC midnight,
 * but `new Date('2026-8-1')` is LOCAL midnight and the difference is invisible in review.
 * Splitting the string and calling `Date.UTC` cannot be ambiguous.
 */
function utcDate(value: string | null | undefined): Date | null {
  if (!value) return null
  const [y, m, d] = value.slice(0, 10).split('-').map(Number)
  if (!y || !m || !d) return null
  const at = new Date(Date.UTC(y, m - 1, d))
  return Number.isNaN(at.getTime()) ? null : at
}

/**
 * Whole days from now until `date`, floored at 0, or null when there is no date.
 *
 * WHY THIS IS A FUNCTION HERE rather than a `Date.now()` inline where it is used. It was
 * inline in the Dashboard, and `react-hooks/purity` is right to flag that: reading the
 * clock during render makes a component's output depend on when it happened to render. It
 * is *safe* on the Dashboard specifically, which is a server component rendered once per
 * request — but "safe because of where it is" is exactly the kind of reasoning that stops
 * being true when somebody adds `'use client'`. Putting the impurity behind a named call
 * keeps the component readable as a pure function of its data, and makes the countdown
 * reusable — Events and My Summary both want the same sentence.
 *
 * Compared on absolute time, not calendar days, so this answers "how long until" and not
 * "how many dates away". Callers wanting the latter should compare YYYY-MM-DD strings, the
 * way `getUpcomingEvents` filters past events.
 */
export function daysUntil(date: string | null | undefined): number | null {
  if (!date) return null
  const target = new Date(date).getTime()
  if (Number.isNaN(target)) return null
  return Math.max(0, Math.round((target - Date.now()) / 86400000))
}

/**
 * How long ago an INSTANT was, as data rather than as a sentence.
 *
 * ── IT RETURNED A STRING UNTIL 2026-08-26, AND THAT MADE IT UNTRANSLATABLE ─────────
 * It produced `'Just now'`, `'5m ago'`, `'3h ago'` and fell back to `formatDate` past a day —
 * four English strings assembled inside a pure module. A locale parameter would not have been
 * enough either: the words belong in the catalogue with every other string, and a `lib/` module
 * has no business importing it.
 *
 * So this answers WHICH sentence and the component says it. Three call sites map the result
 * through `t` — the bell, the Dashboard's Recent Updates and the Updates archive — which is the
 * same division `lib/gathering-when.ts` keeps between `whenProblems` (the rule) and
 * `WHEN_PROBLEM_TEXT` (the words).
 *
 * ── WHY IT STILL READS THE CLOCK ──────────────────────────────────────────────────
 * `daysUntil` above states the argument and it is unchanged: reading the clock during render
 * makes a component's output depend on when it happened to render, which `react-hooks/purity`
 * is right to flag, so the impurity lives behind a named call.
 *
 * ── THE HANDOVER AT 24 HOURS IS DELIBERATE ────────────────────────────────────────
 * Past a day, "yesterday" and "3d ago" stop being more useful than the date itself, and a
 * member scanning a list wants something they can match against a calendar. The `date` variant
 * carries the raw value so the caller formats it with the reader's locale — this module must not
 * choose one for them.
 */
export type TimeAgo =
  | { kind: 'now' }
  | { kind: 'minutes'; n: number }
  | { kind: 'hours'; n: number }
  | { kind: 'date'; iso: string }

export function timeAgo(iso: string): TimeAgo {
  const mins = Math.floor((Date.now() - new Date(iso).getTime()) / 60000)
  if (mins < 1) return { kind: 'now' }
  if (mins < 60) return { kind: 'minutes', n: mins }
  const hours = Math.floor(mins / 60)
  if (hours < 24) return { kind: 'hours', n: hours }
  return { kind: 'date', iso }
}


/**
 * Today as YYYY-MM-DD, in the caller's OWN timezone — the value every `<input
 * type="date">` in the app wants as its default.
 *
 * Deliberately not `new Date().toISOString().slice(0, 10)`, which every form here used
 * to do. That string is UTC, and for anyone west of Greenwich it is TOMORROW's date
 * for the last hours of each day: a treasurer in Pacific time opening a payment form
 * at 6pm got a date the family had not reached yet, and dated the cheque accordingly.
 * A date input holds a local calendar date, so its default has to be one too.
 */
export function todayLocal(): string {
  const now = new Date()
  return [
    now.getFullYear(),
    String(now.getMonth() + 1).padStart(2, '0'),
    String(now.getDate()).padStart(2, '0'),
  ].join('-')
}

/**
 * The latest of several `YYYY-MM-DD` strings, for the `min` of an END-date input.
 *
 * ── WHY THIS EXISTS ────────────────────────────────────────────────────────────────
 * Wherever a form has a start date and an end date, the end date's picker should not offer a
 * day before the start — `<input type="date" min=…>` greys those out, so an impossible range
 * cannot be chosen in the first place and nobody meets a refusal for something the control
 * could have declined to offer. Several of those forms have a SECOND floor as well: an
 * existing dues schedule may not have its end date moved into the past (see `ScheduleFields`),
 * so the real `min` is whichever floor is later.
 *
 * ── STRING COMPARISON IS CORRECT HERE, AND ONLY HERE ───────────────────────────────
 * `YYYY-MM-DD` is fixed-width and big-endian, so lexicographic order IS chronological order —
 * which is why this takes strings and never touches `Date`. That is the same reason
 * `lib/calendar.ts` does its arithmetic on strings: `new Date('2026-08-01')` is UTC midnight
 * and reads as 31 July in any negative offset, and a `min` that is a day out is worse than no
 * `min` at all because it forbids a legal day.
 *
 * It holds ONLY for that format. A caller with a timestamp or a `MM/DD/YYYY` string has a
 * different problem and must not use this.
 *
 * `undefined` for "no floor", which is what an `<input min>` wants for absent — React omits
 * the attribute entirely, whereas `min=""` is a value some browsers have opinions about.
 * Empty strings among the inputs are treated as absent, so an unfilled start date imposes no
 * floor rather than a floor of "".
 */
export function latestDate(...dates: (string | null | undefined)[]): string | undefined {
  const present = dates.filter((d): d is string => typeof d === 'string' && d !== '')
  if (present.length === 0) return undefined
  return present.reduce((a, b) => (b > a ? b : a))
}

/**
 * Format a date — a date-only string (`YYYY-MM-DD`) or an ISO timestamp's date part — in the
 * reader's language. "June 12, 2026" / "12 de junio de 2026" / "12 juin 2026".
 *
 * NO WEEKDAY. It used to lead with one ("Monday June 12th, 2026"), which stretched every date in
 * the app to carry a fact almost none of them needed — a payment date, a schedule start, a
 * deadline are not read by day of the week. That decision survives the move to `Intl`.
 *
 * ── PASSING A TIMESTAMP HERE IS STILL A BUG, AND STILL CAUGHT ELSEWHERE ────────────
 * This reads the first ten characters, so an ISO instant is read as its UTC calendar date — the
 * defect `lib/tz.ts` was written for. `npm run audit:time` is what refuses it; the fix is
 * `formatInstantDate(iso, zone)`.
 */
export function formatDate(
  date: string | null | undefined,
  locale: string = DEFAULT_MONEY_LOCALE,
): string | null {
  const at = utcDate(date)
  if (!at) return null
  return dateFormatter(locale, LONG, 'long').format(at)
}

/**
 * Format a date as month and day with NO YEAR — "February 14" / "14 de febrero".
 *
 * For a date whose year the reader already knows or does not need. The Birthdays pane is the case
 * it was written for: every row is inside a 60-day horizon, so the year is either this one or the
 * next, and printing it added noise while inviting a misreading — the year shown is the year of
 * the NEXT occurrence, not the year the person was born, and those are the two numbers a reader
 * is most likely to confuse on a birthday list.
 */
/**
 * The seven weekday names, Sunday first, short and long, in one locale.
 *
 * ── WHY NOT A CATALOGUE ────────────────────────────────────────────────────────────
 * A weekday is not copy. `Intl` has the canonical short and long form for every locale, and a
 * hand-written table would be three translations of something the platform already knows — and
 * would be wrong in a way nobody notices: Spanish and French both lower-case weekday names, so
 * the first edit that "tidied" the capitals would silently be right in one language and wrong in
 * two.
 *
 * ── SUNDAY FIRST, BY CONSTRUCTION ──────────────────────────────────────────────────
 * `buildCalendarMonth` builds Sunday-first weeks, so index 0 must be Sunday. 2026-01-04 is a
 * Sunday, so the seven days from it are the seven weekdays in that order — which is why an
 * arbitrary anchor date is the right way to get them and `Intl` has no "list me the weekdays"
 * call. UTC throughout, like every other formatter here.
 *
 * SHORT AND LONG BOTH, because the column heading prints the short form and a screen reader
 * announces the long one: "Sun" read aloud is a word, not a day.
 */
export function weekdayNames(locale: string = DEFAULT_MONEY_LOCALE): {
  short: string
  long: string
}[] {
  const shortFmt = dateFormatter(locale, { weekday: 'short' }, 'wd-short')
  const longFmt = dateFormatter(locale, { weekday: 'long' }, 'wd-long')
  return Array.from({ length: 7 }, (_, i) => {
    // 2026-01-04 is a Sunday. Any Sunday would do; a constant keeps it out of the clock.
    const day = new Date(Date.UTC(2026, 0, 4 + i))
    return { short: shortFmt.format(day), long: longFmt.format(day) }
  })
}

export function formatMonthDay(
  date: string | null | undefined,
  locale: string = DEFAULT_MONEY_LOCALE,
): string | null {
  const at = utcDate(date)
  if (!at) return null
  return dateFormatter(locale, { month: 'long', day: 'numeric' }, 'monthDay').format(at)
}

/**
 * Format a date numerically — "06/12/2026" in the United States, "12/06/2026" almost everywhere
 * else. Used on reports.
 *
 * ── THIS ONE WAS NOT A STYLE CHOICE, IT WAS A WRONG DATE ──────────────────────────
 * It hard-coded `MM/DD/YYYY`. For a French or Mexican reader `12/06/2026` means 12 June, so the
 * old output did not merely read oddly to them — it read as a DIFFERENT DAY, silently, on a
 * report. The one formatter here whose localization is a correctness fix rather than a courtesy.
 *
 * Zero-padded deliberately (`2-digit` rather than `numeric`): a column of dates that changes
 * width row to row is harder to scan, and a report is a column of dates.
 */
export function formatDateNumeric(
  date: string | null | undefined,
  locale: string = DEFAULT_MONEY_LOCALE,
): string | null {
  const at = utcDate(date)
  if (!at) return null
  return dateFormatter(
    locale, { year: 'numeric', month: '2-digit', day: '2-digit' }, 'numeric',
  ).format(at)
}

/**
 * Format a `TIME` label (`HH:MM` or `HH:MM:SS`) — "2:30 PM", "2:30 p.m.", "14:30".
 *
 * ── FRENCH GETS A 24-HOUR CLOCK, WHICH IS THE POINT ───────────────────────────────
 * The old implementation computed `h >= 12 ? 'PM' : 'AM'`, so every language got a 12-hour clock
 * whether or not it uses one. `Intl` reads the convention from the locale, and this is the
 * single clearest argument for the move: no amount of care with an AM/PM formatter produces
 * `14:30`.
 *
 * The value is a wall-clock LABEL and is not converted — see `lib/tz.ts`. It is rebuilt on the
 * epoch at UTC purely so `Intl` has an instant to format, and read back with `timeZone: 'UTC'`
 * so the digits that come out are the digits that went in.
 */
export function formatTime(
  time: string | null | undefined,
  locale: string = DEFAULT_MONEY_LOCALE,
): string | null {
  if (!time) return null
  const [h, m] = String(time).split(':').map(Number)
  if (!Number.isFinite(h) || !Number.isFinite(m)) return null
  const at = new Date(Date.UTC(1970, 0, 1, h, m))
  if (Number.isNaN(at.getTime())) return null
  return dateFormatter(locale, { hour: 'numeric', minute: '2-digit' }, 'time').format(at)
}

/**
 * Format a date range, stating the year once — "June 12 – 14, 2026".
 *
 * ── `Intl.formatRange` DOES THE COLLAPSE, PER LANGUAGE ────────────────────────────
 * This used to be hand-rolled, and its own comment argued at length for stating the year once:
 * `${formatDate(start)} – ${formatDate(end)}` prints the month AND the year twice, which "reads
 * as two dates rather than as one span". That argument was right, and it could only ever be
 * implemented for English — collapsing "12 juin – 14 juin 2026" needs to know where the year
 * goes in French.
 *
 * `formatRange` knows, for every language:
 *
 *     en-US   June 12 – 14, 2026        December 30, 2026 – January 2, 2027
 *     es-MX   12–14 de junio de 2026    30 de diciembre de 2026 – 2 de enero de 2027
 *     fr-FR   12–14 juin 2026           30 décembre 2026 – 2 janvier 2027
 *
 * A range crossing a year keeps both years in full, which is exactly the case a reader needs to
 * be told about — and nobody had to write that rule.
 *
 * ── ONE DEVIATION FROM THE DESIGN KIT, STATED ─────────────────────────────────────
 * `design/dashboard/v1_0`'s Golden Master draws "June 12 – June 14, 2026", with the month
 * repeated. `Intl` gives "June 12 – 14, 2026". Tighter, still unambiguous, and the alternative is
 * the per-language hand-rolling this move rejected. Worth knowing before somebody reads the kit
 * and files it as a regression.
 */
export function formatDateRange(
  start: string | null | undefined,
  end: string | null | undefined,
  locale: string = DEFAULT_MONEY_LOCALE,
): string | null {
  const from = utcDate(start)
  if (!from) return null
  const to = utcDate(end)
  // A range whose end is absent, unreadable, or not after its start is ONE date. Kept from the
  // previous implementation: `ends_on` is NULL for a single-day gathering, which is most of them,
  // and rendering "June 12 – June 12" would read as a two-day span.
  if (!to || to.getTime() <= from.getTime()) return formatDate(start, locale)
  return dateFormatter(locale, LONG, 'long').formatRange(from, to)
}

export const TIMEZONES = [
  // US
  'America/New_York',
  'America/Chicago',
  'America/Denver',
  'America/Phoenix',
  'America/Los_Angeles',
  'America/Anchorage',
  'Pacific/Honolulu',
  // Canada
  'America/Toronto',
  'America/Vancouver',
  'America/Halifax',
  'America/St_Johns',
  // Common international
  'Europe/London',
  'Europe/Paris',
  'Europe/Berlin',
  'Africa/Lagos',
  'Africa/Johannesburg',
  'Asia/Dubai',
  'Asia/Kolkata',
  'Asia/Tokyo',
  'Asia/Shanghai',
  'Australia/Sydney',
  'Pacific/Auckland',
] as const

/**
 * A time zone's caption, in the reader's language.
 *
 * ── A FUNCTION OF `t`, NOT A MAP, SINCE 2026-08-29 ─────────────────────────────────
 * It was `TIMEZONE_LABELS: Record<string, string>` holding twenty-two English phrases, read
 * straight into six `<option>` lists — so every family in every language picked their time
 * zone from *"Mountain Time – Arizona (no DST)"*. The conversion AGENTS.md prescribes for a
 * module-level registry: **the IDS are the contract and the words are looked up.**
 *
 * The id is the IANA name, unchanged, because it is what `people.time_zone` stores and what
 * `Intl` is handed. Only the caption moved, to `tz.<IANA name>` — the slash is legal in a key
 * and `nav.item./community/directory` already uses one.
 *
 * ── AN UNKNOWN ZONE ANSWERS ITSELF, AND THAT IS WHY THE LIST IS CONSULTED ──────────
 * `t()` returns the KEY for a key it does not hold, so a stored zone outside `TIMEZONES` —
 * a row written before the list was trimmed, or by hand — would render as the string
 * `tz.Europe/Kyiv` rather than as anything a reader could act on. Falling back to the IANA
 * name is not pretty and is at least true.
 */
export function timezoneLabel(t: T, zone: string): string {
  return (TIMEZONES as readonly string[]).includes(zone) ? t(`tz.${zone}`) : zone
}
