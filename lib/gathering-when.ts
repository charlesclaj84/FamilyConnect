import { formatDate, formatDateRange, formatMonthDay, formatTime } from '@/lib/date-utils'

/**
 * WHEN a gathering happens — the rules, in one pure module.
 *
 * ── WHY A MODULE, AND WHY PURE ─────────────────────────────────────────────────────
 * Four surfaces have to agree about this: the scheduling form (which validates before it
 * submits), the two actions (which validate again, because a server action is a public HTTP
 * endpoint), the calendar (which turns occurrences into chips and bars), and the detail pages
 * (which print it). A rule written at four call sites is four rules the moment one is edited —
 * so the rules are here, decidable from arguments, and tested by value under `npm test`.
 *
 * NOTHING HERE READS THE WORLD. No clock, no database, no locale beyond what `date-utils`
 * already pins.
 *
 * ── ONE OCCASION OR SEVERAL, AND THE DIFFERENCE IS NOT THE COUNT ───────────────────
 * A reunion running Friday to Sunday is ONE occasion spanning three days. A committee meeting
 * on three Saturdays is THREE occasions carrying one title. `isContinuous` is what tells them
 * apart, and it is a fact somebody stated rather than something derivable: a series with one
 * date entered so far still has one row.
 *
 * The calendar draws the first as a bar across its days and the second as separate chips — see
 * `whenToCalendarSpans`, which is the whole of that decision.
 *
 * ── A TIME IS A WALL-CLOCK LABEL, NEVER AN INSTANT ─────────────────────────────────
 * `20260826000001`'s header argues this at length and it is the one thing not to get clever
 * about here: `'11:00'` means eleven o'clock where the gathering is. It is never converted,
 * never compared across zones, never turned into a `Date`, and never used to decide whether
 * something has started — `lib/gatherings.ts` derives past/today/upcoming from the DATES and
 * must go on doing so. Every comparison below is a string comparison on `HH:MM`, which is
 * correct precisely because these are zero-padded 24-hour labels and nothing else.
 */

/** One occasion: a day, an optional day it runs to, and optional times. */
export interface GatheringOccurrence {
  /** `YYYY-MM-DD`. */
  startsOn: string
  /** `HH:MM`, or null where the family gave no time. */
  startTime: string | null
  /** `YYYY-MM-DD`, or null where it ends on the day it starts. */
  endsOn: string | null
  /** `HH:MM`, or null. Never set without a start time — the database refuses that pair. */
  endTime: string | null
}

/** A gathering's whole answer to "when". */
export interface GatheringWhen {
  /** One unbroken block, or several occasions with one name. */
  isContinuous: boolean
  /** At least one, in the order the family entered them. */
  occurrences: GatheringOccurrence[]
}

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/
/** `HH:MM` or `HH:MM:SS` — Postgres hands back the second form. */
const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d(:[0-5]\d)?$/

/**
 * A time as `HH:MM`, or null.
 *
 * Postgres returns `TIME` as `11:00:00` and an `<input type="time">` gives `11:00`, so one of
 * the two has to be normalised or a round trip changes the value the form is holding — and a
 * form whose field changes on save looks like the save did something else.
 */
export function normaliseTime(raw: string | null | undefined): string | null {
  if (!raw) return null
  const value = String(raw).trim()
  if (!TIME_RE.test(value)) return null
  return value.slice(0, 5)
}

/** A date as `YYYY-MM-DD`, or null. Shape only — it does not ask whether the day exists. */
export function normaliseDate(raw: string | null | undefined): string | null {
  if (!raw) return null
  const value = String(raw).trim()
  return DATE_RE.test(value) ? value : null
}

export type WhenProblem =
  | { code: 'no-occurrence' }
  | { code: 'bad-date'; index: number }
  | { code: 'bad-time'; index: number }
  | { code: 'end-before-start'; index: number }
  | { code: 'end-time-before-start'; index: number }
  | { code: 'end-time-without-start'; index: number }
  | { code: 'continuous-needs-one' }

/** What each problem says to somebody looking at the form. */
export const WHEN_PROBLEM_TEXT: Record<WhenProblem['code'], string> = {
  'no-occurrence': 'Give a date for this gathering.',
  'bad-date': 'That is not a date we can read.',
  'bad-time': 'That is not a time we can read.',
  // NAMES THE RULE, not the field. "Invalid" would leave somebody looking at two boxes with no
  // idea which of them is wrong, and the answer is that neither is — the ORDER is.
  'end-before-start': 'The end cannot be before the start.',
  'end-time-before-start': 'On a single day, the end time has to be after the start time.',
  'end-time-without-start': 'Give a start time as well, or leave the end time empty.',
  'continuous-needs-one': 'A continuous gathering is one span, so it has one set of dates.',
}

/**
 * Every problem with a proposed `when`, in the order a reader would meet them.
 *
 * ── IT RETURNS ALL OF THEM, NOT THE FIRST ──────────────────────────────────────────
 * A series of five dates with two bad ones should say so once rather than five times in a row,
 * which is what a first-failure validator produces as somebody fixes them one at a time. The
 * `index` on each problem is what lets the form mark the row it belongs to.
 *
 * ── AND IT IS THE SAME FUNCTION ON BOTH SIDES OF THE WIRE ──────────────────────────
 * The form calls it to refuse before submitting; the actions call it because the form in front
 * of them is a convenience (§2). The DATABASE checks the same three ordering rules a third
 * time, and that is not redundancy: the actions write on the service role, so the CHECK
 * constraints are the only thing underneath them.
 */
export function whenProblems(when: GatheringWhen): WhenProblem[] {
  const problems: WhenProblem[] = []
  const list = Array.isArray(when?.occurrences) ? when.occurrences : []

  if (list.length === 0) return [{ code: 'no-occurrence' }]
  // A continuous gathering is ONE span by definition. Several rows plus `isContinuous` is a
  // caller that has not decided which it means, and guessing either way loses information.
  if (when.isContinuous && list.length > 1) problems.push({ code: 'continuous-needs-one' })

  list.forEach((o, index) => {
    const startsOn = normaliseDate(o?.startsOn)
    if (!startsOn) { problems.push({ code: 'bad-date', index }); return }

    const endsOn = o?.endsOn == null || o.endsOn === '' ? null : normaliseDate(o.endsOn)
    if (o?.endsOn != null && o.endsOn !== '' && !endsOn) {
      problems.push({ code: 'bad-date', index })
      return
    }

    const startTime = o?.startTime == null || o.startTime === ''
      ? null : normaliseTime(o.startTime)
    if (o?.startTime != null && o.startTime !== '' && !startTime) {
      problems.push({ code: 'bad-time', index })
      return
    }

    const endTime = o?.endTime == null || o.endTime === '' ? null : normaliseTime(o.endTime)
    if (o?.endTime != null && o.endTime !== '' && !endTime) {
      problems.push({ code: 'bad-time', index })
      return
    }

    if (endsOn && endsOn < startsOn) problems.push({ code: 'end-before-start', index })
    if (endTime && !startTime) problems.push({ code: 'end-time-without-start', index })
    // ONLY WITHIN ONE DAY. Friday 18:00 to Sunday 11:00 is an ordinary reunion; 14:00 to 09:00
    // on one day is the same mistake as an end date before a start date, one unit smaller.
    // `!endsOn` counts as the same day, which is what a null `endsOn` means on this table.
    const sameDay = !endsOn || endsOn === startsOn
    if (sameDay && startTime && endTime && endTime <= startTime) {
      problems.push({ code: 'end-time-before-start', index })
    }
  })

  return problems
}

/**
 * The same `when`, normalised — dates and times in canonical form, blanks as nulls.
 *
 * Call it AFTER `whenProblems` has come back empty. It does not validate: an unreadable value
 * becomes null here, which for a date would silently drop an occasion, and that is exactly why
 * the two are separate functions rather than one that does both and has to decide what to
 * return on a failure.
 */
export function normaliseWhen(when: GatheringWhen): GatheringWhen {
  return {
    isContinuous: when.isContinuous !== false,
    occurrences: (when.occurrences ?? []).map(o => {
      const startsOn = normaliseDate(o?.startsOn)
      const endsOn = normaliseDate(o?.endsOn)
      const startTime = normaliseTime(o?.startTime)
      return {
        startsOn: startsOn ?? '',
        startTime,
        // AN END DATE EQUAL TO THE START IS STORED AS NULL, which is what `ends_on` has always
        // meant on this table ("NULL means a single day") and what `formatDateRange` and the
        // calendar's `overlaps` both read. Two spellings of one day is the kind of duplicate
        // that makes two screens disagree about whether something is a range.
        endsOn: endsOn && startsOn && endsOn > startsOn ? endsOn : null,
        // An end time with no start time cannot be stored — the database refuses the pair — so
        // it is dropped rather than carried to a failure the caller has already been warned
        // about by `whenProblems`.
        endTime: startTime ? normaliseTime(o?.endTime) : null,
      }
    }),
  }
}

/** The outer bounds, which is what `gatherings.starts_on`/`ends_on` hold. */
export function whenEnvelope(when: GatheringWhen): { startsOn: string; endsOn: string | null } {
  const list = when.occurrences.filter(o => o.startsOn)
  if (list.length === 0) return { startsOn: '', endsOn: null }
  let startsOn = list[0].startsOn
  let last = list[0].endsOn ?? list[0].startsOn
  for (const o of list) {
    if (o.startsOn < startsOn) startsOn = o.startsOn
    const end = o.endsOn ?? o.startsOn
    if (end > last) last = end
  }
  return { startsOn, endsOn: last > startsOn ? last : null }
}

/**
 * One span the calendar should draw, per occasion.
 *
 * ── THIS IS THE WHOLE OF THE CONTINUOUS/SEPARATE DECISION ──────────────────────────
 * Continuous: ONE span over the envelope, which `buildCalendarMonth` packs into a bar across
 * its days. Separate: ONE SPAN PER OCCASION, each drawn on its own days, all carrying the same
 * title — which is what a committee meeting on three Saturdays looks like and what the old
 * schema could not express.
 *
 * ── THE IDS MUST DIFFER, AND THAT IS NOT COSMETIC ──────────────────────────────────
 * `buildCalendarMonth` keys a chip on `${day}:${entry.id}`, so two occasions of one gathering
 * sharing an id would be a duplicate React key — and two spans of one thing is exactly the
 * shape an election already has on that grid, which is why the suffix convention exists. The
 * occurrence's own INDEX is the suffix rather than its row id: the id is a uuid nobody reading
 * a DOM tree could match to a row, and the index is stable for the render that produced it.
 *
 * A continuous gathering gets the BARE id, so nothing about the existing single-span case
 * changes — including any href or test that already expects it.
 */
export function whenToCalendarSpans(
  gatheringId: string,
  when: GatheringWhen,
): { id: string; startsOn: string; endsOn: string | null; timeLabel: string | null }[] {
  if (when.isContinuous) {
    const env = whenEnvelope(when)
    if (!env.startsOn) return []
    return [{
      id: gatheringId,
      startsOn: env.startsOn,
      endsOn: env.endsOn,
      // THE FIRST OCCASION'S TIMES, because a continuous gathering has exactly one occasion —
      // and where a legacy row somehow has more, the earliest is the one a reader means by
      // "what time does it start".
      timeLabel: timeLabelFor(when.occurrences[0] ?? null),
    }]
  }
  return when.occurrences
    .filter(o => o.startsOn)
    .map((o, i) => ({
      id: `${gatheringId}:${i}`,
      startsOn: o.startsOn,
      endsOn: o.endsOn,
      timeLabel: timeLabelFor(o),
    }))
}

/**
 * "11:00 AM – 4:00 PM", "from 11:00 AM", or null.
 *
 * NULL RATHER THAN AN EMPTY STRING, so a caller renders nothing at all instead of an empty
 * element with its own padding. "No time given" is a real answer — "the reunion is on 4 July"
 * — and it must not read as a time that failed to load.
 */
export function timeLabelFor(o: GatheringOccurrence | null): string | null {
  if (!o?.startTime) return null
  const start = formatTime(o.startTime)
  if (!start) return null
  const end = o.endTime ? formatTime(o.endTime) : null
  return end ? `${start} – ${end}` : `from ${start}`
}

/**
 * The whole "when" as one line, for a heading or a table cell.
 *
 * ── THREE SHAPES, AND THE THIRD IS THE ONE A DATE RANGE CANNOT SAY ─────────────────
 *   one occasion, no times    "June 12th, 2026"                    — `formatDateRange`
 *   one occasion, with times  "June 12th, 2026 · 11:00 AM – 4:00 PM"
 *   several occasions         "June 12th, June 19th and 2 more"
 *
 * The third exists because `formatDateRange` over the envelope would print "June 12th – June
 * 26th, 2026" for three Saturdays, which claims a fortnight the family is not gathering for.
 * That is the misreading this whole feature is about, so the one-line form must not reintroduce
 * it.
 *
 * CAPPED AT TWO NAMED DATES, then a count. `missingFieldsSentence` sets the precedent and the
 * reason is the same: a list of nine dates in a table cell is not a summary.
 */
export function formatWhen(when: GatheringWhen): string | null {
  const list = when.occurrences.filter(o => o.startsOn)
  if (list.length === 0) return null

  if (when.isContinuous || list.length === 1) {
    const first = list[0]
    const range = formatDateRange(first.startsOn, first.endsOn ?? undefined)
      ?? formatDate(first.startsOn)
    if (!range) return null
    const time = timeLabelFor(first)
    return time ? `${range} · ${time}` : range
  }

  // SORTED FOR THE SUMMARY ONLY. The stored order is the family's entry order (see
  // `position`), and a one-line summary reads chronologically or it reads as a mistake — but
  // the LIST on the form keeps the order they typed.
  const sorted = [...list].sort((a, b) => a.startsOn.localeCompare(b.startsOn))
  const named = sorted.slice(0, 2)
    .map(o => formatMonthDay(o.startsOn) ?? formatDate(o.startsOn))
    .filter((v): v is string => Boolean(v))
  if (named.length === 0) return null
  const rest = sorted.length - named.length
  const head = named.join(', ')
  return rest > 0 ? `${head} and ${rest} more` : head
}

/**
 * The one-line answer from the ENVELOPE alone — no occurrence list needed.
 *
 * ── WHY THIS EXISTS BESIDE `formatWhen` ────────────────────────────────────────────
 * `formatWhen` needs every occasion, and a LIST of gatherings does not have them: the
 * summary shapes carry the four materialised envelope columns plus a count, because fetching
 * every child row for every row of a list is a join nothing on that screen reads back.
 *
 * ── AND IT REFUSES TO PRINT A RANGE FOR A SERIES ───────────────────────────────────
 * That is the whole reason it takes `isContinuous` and `occurrenceCount`. The envelope of
 * three Saturdays is a fortnight, and "July 4th – July 18th, 2026" claims a fortnight the
 * family is not gathering for — which is the misreading this feature exists to fix, so the
 * abbreviated form must not reintroduce it. A series says how many days it is instead, and
 * the screen that has the list can name them.
 */
export function formatWhenBrief(row: {
  startsOn: string
  endsOn: string | null
  startTime: string | null
  endTime: string | null
  isContinuous: boolean
  occurrenceCount: number
}): string | null {
  if (!row.startsOn) return null

  if (!row.isContinuous && row.occurrenceCount > 1) {
    const first = formatDate(row.startsOn)
    if (!first) return null
    return `${row.occurrenceCount} days from ${first}`
  }

  const range = formatDateRange(row.startsOn, row.endsOn ?? undefined) ?? formatDate(row.startsOn)
  if (!range) return null
  const time = timeLabelFor({
    startsOn: row.startsOn,
    startTime: row.startTime,
    endsOn: row.endsOn,
    endTime: row.endTime,
  })
  return time ? `${range} · ${time}` : range
}
