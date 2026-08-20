import { formatDate } from '@/lib/date-utils'

/**
 * The vocabulary of Gatherings, and the one place that decides what an ANSWER is.
 *
 * ── WHAT GATHERINGS IS, AND WHY IT IS NOT EVENTS ────────────────────────────────────
 * Events puts a date on the family calendar. A gathering is the WORK around that date: a
 * family authors a template (a named list of steps of mixed kinds), schedules a gathering
 * from one or more of them, hands each step to a named relative as a task, and the
 * assignee submits an answer that an organizer approves or denies with notes. Nothing
 * under `events*` / `event_*` is touched by any of it — see the spec and AGENTS.md on why
 * the two are deliberately parallel rather than unified.
 *
 * ── WHY THIS MODULE IS PURE, AND WHY EVERYTHING IS HERE RATHER THAN IN THE ACTION ────
 * AGENTS.md §7b: `lib/**` is where arithmetic and rules get checked, because the RLS suite
 * calls actions for real against real policies and cannot check a figure. Two harder
 * constraints push the same way:
 *
 *   * `app/actions/gatherings.ts` is `'use server'`, where every export must be an async
 *     server action. A `const GATHERING_STEP_KINDS = [...]` exported from there fails the
 *     build — the same reason `PAY_CADENCES` lives in `lib/dues-utils.ts`.
 *   * The submit FORM and the submit ACTION must agree, to the character, about what a
 *     well-formed answer is. Two copies of that rule is two answers, and the one that
 *     drifts is the server's — a member fills a field in, presses Submit, and is told the
 *     answer is unusable with no way to see why. So `parseAnswer` is the single rule and
 *     `isCompleteAnswer` is defined AS a call to it (see below).
 *
 * Nothing here reads a clock. `gatheringTiming` takes `today` as a parameter for the
 * reason `duesPlanMath` does: a function that reads `new Date()` internally is a function
 * that can never be tested, and every date bug in this product has been a timezone bug.
 */

// ── Step kinds ──────────────────────────────────────────────────────────────────────

/**
 * The eight things a template step can ASK somebody for, in the order the step editor offers
 * them — and `'template'`, which asks nobody anything.
 *
 * ── TWO VOCABULARIES, AND THEY ARE DELIBERATELY DIFFERENT ───────────────────────────
 * `GATHERING_STEP_KINDS` is what a step may be. `GATHERING_TASK_KINDS` is what a TASK may
 * be, and `'template'` is not on it: a template step expands into the child template's own
 * steps when a gathering is built, so it never becomes a task and there is no field that
 * would answer it. The database says the same thing in two CHECK constraints that
 * deliberately disagree (`20260819000007` asserts the disagreement), and `parseAnswer` below
 * takes a `GatheringTaskKind` for the same reason — a `'template'` reaching it would be an
 * expansion bug, and the type is what stops it being written rather than caught.
 *
 * `'location'` IS ITS OWN KIND RATHER THAN A `text`. It stores a string and renders one
 * line, so it buys nothing in the database — which is not what it is for. `kind` is what the
 * author picks and what the assignee's field is built from, and a screen that knows an answer
 * is a place can label it, autofill it, and one day map it. It replaced
 * `gathering_templates.default_location`, which had a template AUTHOR stating a venue that
 * belongs to one occasion; a step hands that job to a relative instead.
 *
 * THERE IS DELIBERATELY NO `members` KIND. The retired `event_blueprint_items` `members`
 * type stored DISPLAY NAMES into a JSON array, which means a rename orphans the answer and
 * two relatives called Martha Allen are one answer. If a step needs to name people it is a
 * `list` today; a `people` kind holding `people.id`s is a later change and needs a
 * migration, not an improvisation here.
 */
export const GATHERING_STEP_KINDS = [
  'text', 'long_text', 'date', 'location', 'list', 'yes_no', 'number', 'money', 'template',
] as const

export type GatheringStepKind = typeof GATHERING_STEP_KINDS[number]

/**
 * Every step kind that becomes an ANSWERABLE task. `GATHERING_STEP_KINDS` minus `'template'`
 * — derived rather than typed out, so adding a kind to one list cannot leave the other behind.
 */
export const GATHERING_TASK_KINDS = GATHERING_STEP_KINDS
  .filter((kind): kind is Exclude<GatheringStepKind, 'template'> => kind !== 'template')

export type GatheringTaskKind = Exclude<GatheringStepKind, 'template'>

/**
 * A `kind` that arrived from a caller, checked.
 *
 * NOT IN THE SPEC'S EXPORT LIST, and here because a server action is a public HTTP endpoint:
 * `kind` reaches `addTemplateStep` as an arbitrary string, a `GatheringStepKind` annotation
 * on the parameter is erased at runtime, and the only thing left underneath is the table's
 * own CHECK — which refuses the insert with a bare 23514 that reads as a bug rather than as
 * "that is not one of the nine". Same argument as `pickProfileColumns` being a runtime
 * allow-list rather than a `Partial<T>`.
 */
export function isGatheringStepKind(value: unknown): value is GatheringStepKind {
  return typeof value === 'string' && (GATHERING_STEP_KINDS as readonly string[]).includes(value)
}

/** The same check, narrowed to the kinds a TASK may carry. */
export function isGatheringTaskKind(value: unknown): value is GatheringTaskKind {
  return isGatheringStepKind(value) && value !== 'template'
}

/** What the step editor's kind picker prints. Captions come from the screen, not the column. */
export const GATHERING_STEP_KIND_LABEL: Record<GatheringStepKind, string> = {
  text:      'Short answer',
  long_text: 'Long answer',
  date:      'A date',
  location:  'A place',
  list:      'A list',
  yes_no:    'Yes or no',
  number:    'A number',
  money:     'An amount of money',
  template:  'Another template',
}

/**
 * One line of help for the person AUTHORING the template — not for the assignee, who reads
 * the step's own `help_text`. These say what the assignee will be given to fill in, because
 * that is the thing an author is choosing between and the labels above cannot say it.
 *
 * `template` is the exception and says the opposite, because it is the one kind where nobody
 * is given anything to fill in.
 */
export const GATHERING_STEP_KIND_HINT: Record<GatheringStepKind, string> = {
  text:      'One line — a name, a phone number, an answer in a few words.',
  long_text: 'A paragraph — notes, a description, an explanation.',
  date:      'A single calendar date, picked from a date field.',
  location:  'A place — a venue, an address, a room. One line.',
  list:      'Any number of lines — one item each, added and removed as they go.',
  yes_no:    'A decision. They must choose; leaving it blank is not an answer.',
  number:    'A count or a quantity. Use “An amount of money” for money.',
  money:     'An amount in dollars, recorded to the cent.',
  template:  'Nobody answers this one. Every step of the template you pick becomes a task of '
    + 'its own when a gathering is built from this one.',
}

// ── Statuses ────────────────────────────────────────────────────────────────────────

export const GATHERING_STATUSES = ['planning', 'scheduled', 'complete', 'cancelled'] as const
export const GATHERING_TASK_STATUSES = ['open', 'submitted', 'approved', 'denied'] as const
export const GATHERING_TEMPLATE_SCHEDULERS = ['admin', 'family'] as const

export type GatheringStatus = typeof GATHERING_STATUSES[number]
export type GatheringTaskStatus = typeof GATHERING_TASK_STATUSES[number]
export type GatheringTemplateScheduler = typeof GATHERING_TEMPLATE_SCHEDULERS[number]

/**
 * A gathering's status is STORED, not derived, and these are what it reads as.
 *
 * It is stored because none of the four is a fact about the calendar: a gathering can be
 * cancelled without its dates moving, and `complete` is an organizer's statement rather
 * than something the clock knows. Anything the calendar genuinely decides — past, today,
 * upcoming — is derived by `gatheringTiming` below, from the dates and nothing else.
 */
export const GATHERING_STATUS_LABEL: Record<GatheringStatus, string> = {
  planning:  'Planning',
  scheduled: 'Scheduled',
  complete:  'Complete',
  cancelled: 'Cancelled',
}

/**
 * What a task's status reads as on screen.
 *
 * `denied` is "Needs another look" rather than "Denied", and that is a product decision
 * rather than softening: a denial is not a rejection of the person, it is a request with
 * the organizer's notes attached, and the whole feedback loop is that the member reads
 * those notes and submits again. A pill saying "Denied" beside a note saying "the caterer
 * needs a phone number" tells the member the wrong thing about what to do next.
 */
export const GATHERING_TASK_STATUS_LABEL: Record<GatheringTaskStatus, string> = {
  open:      'Not started',
  submitted: 'Waiting for review',
  approved:  'Approved',
  denied:    'Needs another look',
}

// ── Answers ─────────────────────────────────────────────────────────────────────────

/**
 * The canonical shape of `gathering_tasks.answer` / `gathering_task_submissions.answer`,
 * one variant per kind. `text` and `long_text` share `{ text }` on purpose — they differ
 * in the control the form draws, never in what is stored, so a template author changing a
 * short answer to a long one does not orphan the answers already given.
 *
 * MONEY IS INTEGER CENTS. Never dollars, never a float — the same rule the `*_cents`
 * columns keep, and the reason `parseAnswer` refuses a fractional amount outright below.
 */
export type GatheringAnswer =
  | { text: string }
  | { date: string }
  | { items: string[] }
  | { yes: boolean }
  | { number: number }
  | { cents: number }

/** A plain object, narrowed so the property reads below do not need a cast each. */
function asRecord(value: unknown): Record<string, unknown> | null {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null
}

/**
 * Is this a real calendar date, written `YYYY-MM-DD`?
 *
 * THE ROUND TRIP IS THE POINT, and it is done with `Date.UTC` rather than `new Date(s)`.
 * `new Date('2026-02-30')` is not merely a bad date — it is a bad date interpreted at UTC
 * midnight, so in any negative offset it also prints as the day before. Building the date
 * from integers and comparing the parts back is the only check that answers the calendar
 * question without ever asking the local clock anything.
 */
function isCalendarDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false
  const [y, m, d] = value.split('-').map(Number)
  if (m < 1 || m > 12 || d < 1) return false
  const probe = new Date(Date.UTC(y, m - 1, d))
  return probe.getUTCFullYear() === y && probe.getUTCMonth() === m - 1 && probe.getUTCDate() === d
}

/**
 * Normalise whatever the form posted into the canonical shape, or null when it is not an
 * answer at all.
 *
 * ── IT IS ALSO THE VALIDATOR, and that is deliberate ────────────────────────────────
 * `isCompleteAnswer` below is one line: `parseAnswer(...) !== null`. Two functions, one
 * rule. Written as two rules they drift, and the drift is invisible until a member's
 * submission is refused by a server that disagrees with the form that accepted it.
 *
 * ── IT IS IDEMPOTENT ON ITS OWN OUTPUT ──────────────────────────────────────────────
 * A stored answer read back out of JSONB must parse to itself, because `isCompleteAnswer`
 * is asked about stored rows as well as about drafts. Every branch therefore accepts both
 * the loose form shape and the canonical one.
 *
 * ── WHAT "UNUSABLE" MEANS, AND WHY BLANK COUNTS ─────────────────────────────────────
 * An empty string, a list with nothing left in it, an unmade yes/no choice: all null. That
 * is NOT the same question as the step's `required` flag, which decides whether a task can
 * be left alone — this decides whether what arrived is an answer, and a blank one is not.
 * The action refuses on null and says so; `required` is checked separately by the caller.
 *
 * ── MONEY REFUSES DOLLARS, LOUDLY ───────────────────────────────────────────────────
 * `12.34` could be $12.34 or 12.34 cents and nothing in the value says which, so guessing
 * is a factor of a hundred either way. The form converts with `dollarsToCents` from
 * `lib/currency-utils.ts` and posts an integer; anything fractional arriving here is a bug
 * and is refused rather than rounded, because rounding it would ship the wrong number to
 * the ledger with nobody the wiser.
 */
export function parseAnswer(kind: GatheringTaskKind, raw: unknown): GatheringAnswer | null {
  const obj = asRecord(raw)

  switch (kind) {
    // `location` SHARES THE `text` BRANCH AND THE `{ text }` SHAPE, which is the whole of what
    // it costs to be its own kind. Storing it as `{ location }` would make every stored answer
    // unreadable if a step were ever retyped between the two, and would buy nothing: the
    // difference is what the FIELD looks like and what a screen may do with the value, not what
    // the value is.
    case 'text':
    case 'location':
    case 'long_text': {
      const value = typeof raw === 'string' ? raw : obj && typeof obj.text === 'string' ? obj.text : null
      if (value === null) return null
      // Outer whitespace only: a long answer's own paragraph breaks are content.
      const text = value.trim()
      return text.length > 0 ? { text } : null
    }

    case 'date': {
      const value = typeof raw === 'string' ? raw : obj && typeof obj.date === 'string' ? obj.date : null
      if (value === null) return null
      const date = value.trim()
      return isCalendarDate(date) ? { date } : null
    }

    case 'list': {
      // A textarea posts one string with newlines; a repeating field posts an array. Both
      // are ordinary, so both are accepted and normalised to the array.
      const source: unknown[] =
        Array.isArray(raw) ? raw
          : typeof raw === 'string' ? raw.split('\n')
            : obj && Array.isArray(obj.items) ? obj.items
              : []
      const items = source
        .filter((item): item is string => typeof item === 'string')
        .map(item => item.trim())
        // Dropping blanks rather than refusing them: every textarea ends in a newline, so
        // refusing a blank line would refuse almost every real submission.
        .filter(item => item.length > 0)
      return items.length > 0 ? { items } : null
    }

    case 'yes_no': {
      const value = typeof raw === 'boolean' ? raw
        : obj && typeof obj.yes === 'boolean' ? obj.yes
          : typeof raw === 'string' ? yesNoFromString(raw)
            : null
      // NEVER a truthiness test. `Boolean('')` is `false`, so a coercing version would
      // record "No" for a member who answered nothing at all — the one wrong answer that
      // looks exactly like a real one on every screen afterwards.
      return value === null ? null : { yes: value }
    }

    case 'number': {
      const value = typeof raw === 'number' ? raw
        : obj && typeof obj.number === 'number' ? obj.number
          : typeof raw === 'string' ? numberFromString(raw)
            : null
      // Fractions are allowed here and only here: "how many pounds of brisket" is a real
      // step and 12.5 is a real answer. Money is the `money` kind, in cents.
      return value !== null && Number.isFinite(value) ? { number: value } : null
    }

    case 'money': {
      const value = typeof raw === 'number' ? raw
        : obj && typeof obj.cents === 'number' ? obj.cents
          : typeof raw === 'string' ? numberFromString(raw)
            : null
      if (value === null || !Number.isFinite(value)) return null
      // Integer, and not negative — the same two things every `*_cents` column CHECKs. A
      // negative cost is not something any of these forms means.
      return Number.isInteger(value) && value >= 0 ? { cents: value } : null
    }
  }
}

/** The four strings a radio group or a select can post for a yes/no. Nothing else. */
function yesNoFromString(raw: string): boolean | null {
  const value = raw.trim().toLowerCase()
  if (value === 'yes' || value === 'true') return true
  if (value === 'no' || value === 'false') return false
  return null
}

/** A numeric string, refusing the empty string that `Number('')` reads as zero. */
function numberFromString(raw: string): number | null {
  const value = raw.trim()
  if (value.length === 0) return null
  const n = Number(value)
  return Number.isFinite(n) ? n : null
}

/**
 * Is this a well-formed answer for that kind? Asked by the submit form (to decide whether
 * Submit does anything) and by the action (before it writes). One rule — see `parseAnswer`.
 */
export function isCompleteAnswer(kind: GatheringTaskKind, answer: unknown): boolean {
  return parseAnswer(kind, answer) !== null
}

/**
 * One line of display text for an answer, or the empty string when there is nothing to
 * show. Empty rather than a dash or "None": what an absent answer looks like is the
 * screen's decision, and a caller that wants an em dash can write one.
 *
 * ── WHY MONEY IS A PARAMETER AND THE DATE IS NOT ────────────────────────────────────
 * `formatMoney` is passed in so this module never has to decide between `formatCurrency`
 * and the whole-dollar variant on `/pricing` — the caller knows which reads right on its
 * own screen. The DATE is imported from `lib/date-utils.ts` because that module is the
 * only place in the app that formats a date, it is pure, and a second copy of "June 12th,
 * 2026" here is exactly the drift AGENTS.md keeps one formatter to prevent.
 */
export function describeAnswer(
  kind: GatheringTaskKind,
  answer: unknown,
  formatMoney: (cents: number) => string,
): string {
  const parsed = parseAnswer(kind, answer)
  if (!parsed) return ''

  if ('text' in parsed) return parsed.text
  if ('date' in parsed) return formatDate(parsed.date) ?? parsed.date
  // Comma-separated rather than one line each: this is the one-line summary a table cell
  // and a status line want. A screen showing the whole list renders `items` itself.
  if ('items' in parsed) return parsed.items.join(', ')
  if ('yes' in parsed) return parsed.yes ? 'Yes' : 'No'
  if ('cents' in parsed) return formatMoney(parsed.cents)
  return String(parsed.number)
}

// ── Timing ──────────────────────────────────────────────────────────────────────────

/**
 * Where a gathering sits relative to `today`.
 *
 * `'today'` means HAPPENING NOW, which for a gathering with an `ends_on` is every day it
 * covers — the second day of a three-day reunion is not "past". That is the whole reason
 * `ends_on` exists, and it is the same span rule `lib/calendar.ts` puts an entry on every
 * day of.
 */
export type GatheringTiming = 'past' | 'today' | 'upcoming'

export function gatheringTiming(
  startsOn: string,
  endsOn: string | null,
  today: string,
): GatheringTiming {
  // `YYYY-MM-DD` sorts lexicographically, which is the only date comparison in this
  // codebase that cannot be wrong by a day: it never constructs a `Date`, so it never asks
  // the local clock what "2026-08-01T00:00:00Z" means. `new Date('2026-08-01') < new
  // Date()` is the version that puts a gathering in the past for half the country.
  //
  // `ends_on` before `starts_on` is refused by `gatherings_dates_ordered`, so taking the
  // later of the two is about a row that arrived from somewhere other than that column —
  // and reading the span as "at least its own start day" is the answer that never hides a
  // gathering from the day it is on.
  const last = endsOn && endsOn > startsOn ? endsOn : startsOn
  if (today > last) return 'past'
  if (today >= startsOn) return 'today'
  return 'upcoming'
}

// ── Task progress ───────────────────────────────────────────────────────────────────

/** The counts behind "6 of 9 approved" on a gathering card. */
export interface TaskProgress {
  total: number
  open: number
  submitted: number
  approved: number
  denied: number
  /** Every task on the gathering is approved — and there is at least one. */
  complete: boolean
}

/**
 * Roll a gathering's tasks up into one progress line.
 *
 * `complete` requires `total > 0`, so a gathering with no tasks yet is NOT complete. A
 * template with no steps, or a gathering scheduled before anybody added one, would
 * otherwise report itself finished the moment it was created — `0 === 0` — which is the
 * one thing an organizer must not be told.
 *
 * `total` is the number of tasks, not the sum of the four buckets. They are the same for
 * every row the CHECK constraint allows; where they are not — a status this build does not
 * know about — the difference lands on `total`, so the gathering reads as unfinished
 * rather than as complete. That is the safe direction for an unknown value, and the same
 * call `duesScope` makes about a scope it does not recognise.
 */
export function taskProgress(tasks: readonly { status: GatheringTaskStatus }[]): TaskProgress {
  const counts = { open: 0, submitted: 0, approved: 0, denied: 0 }
  for (const task of tasks) {
    if (task.status in counts) counts[task.status] += 1
  }
  const total = tasks.length
  return { total, ...counts, complete: total > 0 && counts.approved === total }
}
