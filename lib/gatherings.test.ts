import { afterEach, describe, expect, it } from 'vitest'
import {
  GATHERING_STEP_KINDS,
  GATHERING_STEP_KIND_HINT,
  GATHERING_STEP_KIND_LABEL,
  GATHERING_TASK_KINDS,
  GATHERING_STATUSES,
  gatheringStatusLabel,
  GATHERING_TASK_STATUSES,
  gatheringTaskStatusLabel,
  describeAnswer,
  gatheringTiming,
  isCompleteAnswer,
  isGatheringStepKind,
  isGatheringTaskKind,
  parseAnswer,
  taskProgress,
  type GatheringStepKind,
  type GatheringTaskKind,
  type GatheringTaskStatus,
} from './gatherings'
import { tFor } from '@/lib/i18n/catalogues'
import { todayIn } from './tz'

/**
 * The Gatherings vocabulary, the answer shapes, and where a gathering sits on the calendar.
 *
 * WHY THESE TESTS EXIST: `parseAnswer` is the boundary between what a member typed and what
 * goes into a JSONB column that seven kinds of form read back out, and it is the SAME rule
 * the submit form uses to decide whether Submit does anything (`isCompleteAnswer` is one
 * call to it). Every one of its refusals is a case you verify by running it — an empty
 * string reaching a yes/no as `false`, a dollar figure reaching money as cents, 2026-02-30
 * reaching a date column — and none of them is visible by reading the switch.
 *
 * Nothing here reads a clock: `gatheringTiming` takes `today` as a parameter, which is the
 * whole reason the parameter exists (AGENTS.md §7b).
 *
 * ── THE TIMEZONE BLOCK REALLY CHANGES THE TIMEZONE ──────────────────────────────────
 * `describe('under a negative UTC offset')` reassigns `process.env.TZ`, which Node honours
 * from the next `Date` operation onward. That is safe here because vitest's default pool is
 * `forks` — every test FILE gets its own process — and because it is restored in
 * `afterEach` regardless. It is worth the awkwardness: a string-comparison implementation is
 * timezone-independent BY CONSTRUCTION, and the only way to hold it to that is to run it
 * somewhere the naive implementation gives a different answer.
 *
 * ── CHECKED BY MUTATION, per AGENTS.md §7b ──────────────────────────────────────────
 * A green run is not evidence until it has been seen to fail. Ten mutations of
 * `lib/gatherings.ts`, each run with `npx vitest run lib/gatherings.test.ts` on a machine
 * in America/Chicago; observed results, not expected:
 *
 *   `gatheringTiming`: `today > last` -> `today > startsOn`, i.e. the span ignored
 *      4 failed — "happening on its middle days", "on its first and last days", "crosses a
 *      month and a year boundary", "puts a gathering on its own day west of Greenwich".
 *   `gatheringTiming`: `today >= startsOn` -> `today === startsOn`
 *      4 failed — the same four, from the other side: the middle of a reunion came back
 *      'upcoming'.
 *   `gatheringTiming`: `today` parsed as a LOCAL date and the gathering's dates as ISO —
 *   `new Date(y, m-1, d)` against `new Date('2026-08-01')`
 *      4 failed here; under `TZ=UTC`, which is what CI runs, EXACTLY ONE fails: "puts a
 *      gathering on its own day west of Greenwich". That is the whole argument for the
 *      negative-offset block — without it this mutation ships green from any CI runner, and
 *      it is the shape the bug actually takes (an ISO string parsed at UTC midnight compared
 *      against a date built from local parts).
 *   `gatheringTiming`: BOTH sides through a local `new Date(y, m-1, d)`, consistently
 *      0 failed — recorded rather than left looking covered, per AGENTS.md §7. A uniformly
 *      local implementation gives the same answers as the strings do, so nothing here can
 *      distinguish it and nothing pretends to. What these tests catch is the MIX above,
 *      which is what a second author reaching for a Date actually writes.
 *   `parseAnswer` 'yes_no': the branch replaced by `{ yes: Boolean(raw) }`
 *      4 failed — including "refuses an unmade choice instead of recording it as No" and
 *      "reads a real No", which are the two halves of the same bug.
 *   `parseAnswer` 'money': `Number.isInteger(value)` dropped
 *      2 failed — "refuses a dollar figure rather than guessing which it is" and the
 *      describeAnswer case, where 12.34 came out as "<12.34c>".
 *   `parseAnswer` 'money': `value >= 0` dropped
 *      1 failed — "refuses a negative amount, as every *_cents column does".
 *   `parseAnswer` 'date': `isCalendarDate` reduced to the regex alone
 *      2 failed — 2026-02-30 and 2026-02-29 were both accepted.
 *   `parseAnswer` 'number': the `Number.isFinite` guard dropped
 *      1 failed — Infinity became an answer.
 *   `taskProgress`: `total > 0 &&` dropped from `complete`
 *      1 failed — "a gathering with no tasks is not complete", which is the assertion that
 *      stops an empty gathering reporting itself finished to an organizer.
 */

const ALL_KINDS: readonly GatheringStepKind[] = GATHERING_STEP_KINDS

/**
 * Every kind a TASK may carry — the step kinds minus `'template'`, which expands into the
 * child template's steps and never becomes a task at all.
 *
 * The two lists are separate here because the module keeps them separate, and the module
 * keeps them separate because `20260819000007` writes them into two CHECK constraints that
 * deliberately disagree. Every answer test below walks THIS list; walking `ALL_KINDS` would be
 * asking `parseAnswer` about a kind it has no branch for, which the compiler now refuses.
 */
const ANSWERABLE_KINDS: readonly GatheringTaskKind[] = GATHERING_TASK_KINDS

/** A money formatter that is obviously a stub, so a test cannot pass by coincidence. */
const money = (cents: number) => `<${cents}c>`

describe('the vocabulary', () => {
  it('offers exactly the nine step kinds, in the authored order', () => {
    expect(GATHERING_STEP_KINDS).toEqual([
      'text', 'long_text', 'date', 'location', 'list', 'yes_no', 'number', 'money', 'template',
    ])
  })

  it('keeps `template` out of the TASK kinds, and nothing else', () => {
    // The one asymmetry in this feature's vocabulary, and it is the whole of what a template
    // step IS: it expands into the child template's steps when a gathering is built, so a
    // task carrying that kind would be a row with no answerable field. `20260819000007`
    // writes the same disagreement into two CHECK constraints and asserts it there too.
    expect(GATHERING_TASK_KINDS).not.toContain('template')
    expect([...GATHERING_TASK_KINDS].sort())
      .toEqual([...GATHERING_STEP_KINDS].filter(k => k !== 'template').sort())
  })

  it('gives `location` its own kind rather than folding it into text', () => {
    // It shares `text`'s STORED SHAPE and not its identity: a screen that knows an answer is
    // a place can label it and one day map it, and the alternative — retyping steps between
    // the two later — would leave stored answers that no longer parse.
    expect(GATHERING_STEP_KINDS).toContain('location')
    expect(parseAnswer('location', ' Zilker Park ')).toEqual({ text: 'Zilker Park' })
    expect(parseAnswer('location', '   ')).toBeNull()
  })

  it('has no members kind — a step naming people is a list today', () => {
    // The existing event_blueprint_items `members` type stores DISPLAY NAMES, so a rename
    // orphans the answer and two Martha Allens are one answer. Adding a `people` kind is a
    // migration, not an improvisation, and this assertion is what makes that deliberate.
    expect(GATHERING_STEP_KINDS).not.toContain('members')
  })

  it('labels and hints every kind, with nothing left over', () => {
    // A missing entry renders as `undefined` in the step editor's picker rather than
    // failing, so the compiler's Record<> is backed up by a runtime count.
    expect(Object.keys(GATHERING_STEP_KIND_LABEL).sort()).toEqual([...ALL_KINDS].sort())
    expect(Object.keys(GATHERING_STEP_KIND_HINT).sort()).toEqual([...ALL_KINDS].sort())
    for (const kind of ALL_KINDS) {
      expect(GATHERING_STEP_KIND_LABEL[kind].length).toBeGreaterThan(0)
      expect(GATHERING_STEP_KIND_HINT[kind].length).toBeGreaterThan(0)
    }
  })

  it('checks a kind that arrived from a caller', () => {
    // The parameter's type is erased at runtime and a server action is a public HTTP
    // endpoint, so the only thing under an unchecked `kind` is the table's CHECK — a bare
    // 23514, which reads as a bug rather than as "that is not one of the seven".
    for (const kind of ALL_KINDS) expect(isGatheringStepKind(kind)).toBe(true)
    for (const kind of ANSWERABLE_KINDS) expect(isGatheringTaskKind(kind)).toBe(true)
    // The one that separates the two checks. `isGatheringTaskKind` is what the submit
    // action calls, and a `'template'` arriving there is an expansion bug rather than a
    // caller's typo — refused all the same, because the action is a public endpoint.
    expect(isGatheringStepKind('template')).toBe(true)
    expect(isGatheringTaskKind('template')).toBe(false)
    expect(isGatheringStepKind('members')).toBe(false)
    expect(isGatheringStepKind('TEXT')).toBe(false)
    expect(isGatheringStepKind('')).toBe(false)
    expect(isGatheringStepKind(null)).toBe(false)
    expect(isGatheringStepKind(undefined)).toBe(false)
    expect(isGatheringStepKind(0)).toBe(false)
  })

  it('labels every gathering and task status, in every language', () => {
    // ── THE ASSERTION MOVED FROM A TABLE TO THE CATALOGUES, AND GOT STRONGER ────────
    // These were `Record<K, string>` holding English, and this test compared their KEY SETS
    // to the id lists. The words are looked up now (`npm run i18n:onscreen` found them
    // rendering "Planning" and "Waiting for review" to every reader), so what is worth
    // asserting is that every id resolves in every language rather than that a table has the
    // right keys.
    //
    // A missing key falls through to the English, so the test is that no label is the KEY —
    // which is exactly what a fall-through looks like on screen.
    for (const locale of ['en', 'es', 'fr']) {
      const t = tFor(locale)
      for (const status of GATHERING_STATUSES) {
        const label = gatheringStatusLabel(status, t)
        expect(label).not.toBe(`gath.status.${status}`)
        expect(label.length).toBeGreaterThan(0)
      }
      for (const status of GATHERING_TASK_STATUSES) {
        const label = gatheringTaskStatusLabel(status, t)
        expect(label).not.toBe(`gath.taskStatus.${status}`)
        expect(label.length).toBeGreaterThan(0)
      }
    }
  })

  it('calls a denial "Needs another look" in every language, which is the product decision', () => {
    // The key-set assertion above would pass with "Denied" in it, which is what somebody will
    // reach for the first time this is edited. The whole feedback loop is that the member reads
    // the organizer's notes and submits again, and `StatusPill` renders this lookup rather than
    // its own words — so the wording IS the product behaviour and belongs in a test.
    expect(gatheringTaskStatusLabel('denied', tFor('en'))).toBe('Needs another look')
    expect(gatheringTaskStatusLabel('open', tFor('en'))).toBe('Not started')
    expect(gatheringTaskStatusLabel('submitted', tFor('en'))).toBe('Waiting for review')

    // AND THE TRANSLATIONS MUST NOT UNDO IT, which the English-only version could not check.
    // "Rechazado" and "Refusé" are the natural words for `denied` and both throw the decision
    // away in one word — a Spanish reader would be told their answer was rejected while the
    // organizer's note beside it asks them to try again.
    expect(gatheringTaskStatusLabel('denied', tFor('es')).toLowerCase())
      .not.toContain('rechaz')
    expect(gatheringTaskStatusLabel('denied', tFor('fr')).toLowerCase())
      .not.toContain('refus')
    expect(gatheringTaskStatusLabel('denied', tFor('es')).toLowerCase())
      .not.toContain('deneg')
  })
})

describe('parseAnswer: text and long text', () => {
  it('takes a bare string from the form and the canonical shape from the column', () => {
    expect(parseAnswer('text', 'Aunt Bea')).toEqual({ text: 'Aunt Bea' })
    expect(parseAnswer('text', { text: 'Aunt Bea' })).toEqual({ text: 'Aunt Bea' })
  })

  it('is idempotent on its own output, because stored answers are re-parsed', () => {
    const once = parseAnswer('text', '  Aunt Bea  ')
    expect(once).toEqual({ text: 'Aunt Bea' })
    expect(parseAnswer('text', once)).toEqual(once)
  })

  it('refuses blank and whitespace — a blank is not an answer', () => {
    expect(parseAnswer('text', '')).toBeNull()
    expect(parseAnswer('text', '   ')).toBeNull()
    expect(parseAnswer('text', { text: '\n\t ' })).toBeNull()
  })

  it('keeps a long answer’s own paragraph breaks and trims only the outside', () => {
    expect(parseAnswer('long_text', '  first\n\nsecond  ')).toEqual({ text: 'first\n\nsecond' })
  })

  it('refuses a value of the wrong sort entirely', () => {
    expect(parseAnswer('text', 42)).toBeNull()
    expect(parseAnswer('text', null)).toBeNull()
    expect(parseAnswer('text', ['a'])).toBeNull()
  })
})

describe('parseAnswer: a date', () => {
  it('takes a YYYY-MM-DD string', () => {
    expect(parseAnswer('date', '2026-08-19')).toEqual({ date: '2026-08-19' })
    expect(parseAnswer('date', { date: '2026-08-19' })).toEqual({ date: '2026-08-19' })
  })

  it('refuses a date the calendar does not have', () => {
    // The whole reason `isCalendarDate` round-trips through Date.UTC rather than stopping at
    // the regex: 2026-02-30 is well-formed and does not exist, and it would reach a DATE
    // column as 2 March.
    expect(parseAnswer('date', '2026-02-30')).toBeNull()
    expect(parseAnswer('date', '2026-04-31')).toBeNull()
    expect(parseAnswer('date', '2026-13-01')).toBeNull()
    expect(parseAnswer('date', '2026-00-10')).toBeNull()
  })

  it('knows which Februaries have a 29th', () => {
    expect(parseAnswer('date', '2028-02-29')).toEqual({ date: '2028-02-29' })
    expect(parseAnswer('date', '2026-02-29')).toBeNull()
  })

  it('refuses an unpadded or partial date rather than guessing', () => {
    expect(parseAnswer('date', '2026-8-19')).toBeNull()
    expect(parseAnswer('date', '2026-08')).toBeNull()
    expect(parseAnswer('date', 'next Friday')).toBeNull()
  })
})

describe('parseAnswer: a list', () => {
  it('takes an array, a textarea’s newlines, or the canonical shape', () => {
    expect(parseAnswer('list', ['plates', 'cups'])).toEqual({ items: ['plates', 'cups'] })
    expect(parseAnswer('list', 'plates\ncups')).toEqual({ items: ['plates', 'cups'] })
    expect(parseAnswer('list', { items: ['plates', 'cups'] })).toEqual({ items: ['plates', 'cups'] })
  })

  it('drops blank lines rather than refusing the submission', () => {
    // Every textarea ends in a newline. Refusing a blank line would refuse almost every
    // real answer to a list step.
    expect(parseAnswer('list', 'plates\n\n  \ncups\n')).toEqual({ items: ['plates', 'cups'] })
  })

  it('refuses a list with nothing left in it', () => {
    expect(parseAnswer('list', [])).toBeNull()
    expect(parseAnswer('list', '\n \n')).toBeNull()
    expect(parseAnswer('list', { items: [] })).toBeNull()
  })

  it('drops an item that is not a line of text', () => {
    expect(parseAnswer('list', ['plates', 7, null, 'cups'])).toEqual({ items: ['plates', 'cups'] })
  })
})

describe('parseAnswer: yes or no', () => {
  it('takes a boolean, the canonical shape, or what a radio group posts', () => {
    expect(parseAnswer('yes_no', true)).toEqual({ yes: true })
    expect(parseAnswer('yes_no', 'yes')).toEqual({ yes: true })
    expect(parseAnswer('yes_no', 'TRUE')).toEqual({ yes: true })
    expect(parseAnswer('yes_no', 'no')).toEqual({ yes: false })
  })

  it('reads a real No, which is an answer and not an absence', () => {
    expect(parseAnswer('yes_no', false)).toEqual({ yes: false })
    expect(parseAnswer('yes_no', { yes: false })).toEqual({ yes: false })
    expect(isCompleteAnswer('yes_no', { yes: false })).toBe(true)
  })

  it('refuses an unmade choice instead of recording it as No', () => {
    // `Boolean('')` is false, so a coercing implementation writes "No" for a member who
    // answered nothing — the one wrong answer that looks exactly like a real one afterwards.
    expect(parseAnswer('yes_no', '')).toBeNull()
    expect(parseAnswer('yes_no', null)).toBeNull()
    expect(parseAnswer('yes_no', undefined)).toBeNull()
    expect(parseAnswer('yes_no', 0)).toBeNull()
    expect(parseAnswer('yes_no', 'maybe')).toBeNull()
  })
})

describe('parseAnswer: a number', () => {
  it('takes a number or a numeric string', () => {
    expect(parseAnswer('number', 12)).toEqual({ number: 12 })
    expect(parseAnswer('number', '12')).toEqual({ number: 12 })
    expect(parseAnswer('number', { number: 12 })).toEqual({ number: 12 })
  })

  it('reads zero as an answer', () => {
    // "How many people are staying overnight? None." A falsy check would lose it.
    expect(parseAnswer('number', 0)).toEqual({ number: 0 })
    expect(parseAnswer('number', '0')).toEqual({ number: 0 })
    expect(isCompleteAnswer('number', 0)).toBe(true)
  })

  it('allows a fraction here, and only here', () => {
    // Twelve and a half pounds of brisket is a real answer to a real step. Money is the
    // `money` kind, in whole cents.
    expect(parseAnswer('number', 12.5)).toEqual({ number: 12.5 })
  })

  it('refuses what is not a number at all', () => {
    expect(parseAnswer('number', '')).toBeNull()
    expect(parseAnswer('number', '  ')).toBeNull()
    expect(parseAnswer('number', 'a dozen')).toBeNull()
    expect(parseAnswer('number', Number.NaN)).toBeNull()
    expect(parseAnswer('number', Number.POSITIVE_INFINITY)).toBeNull()
  })
})

describe('parseAnswer: money', () => {
  it('takes integer cents, and zero is an amount', () => {
    expect(parseAnswer('money', 1234)).toEqual({ cents: 1234 })
    expect(parseAnswer('money', '1234')).toEqual({ cents: 1234 })
    expect(parseAnswer('money', { cents: 0 })).toEqual({ cents: 0 })
  })

  it('refuses a dollar figure rather than guessing which it is', () => {
    // 12.34 is either $12.34 or 12.34 cents and the value does not say. Guessing is a
    // factor of a hundred either way, so the form converts with `dollarsToCents` and this
    // refuses anything fractional — loudly, rather than rounding it into the ledger.
    expect(parseAnswer('money', 12.34)).toBeNull()
    expect(parseAnswer('money', '12.34')).toBeNull()
  })

  it('refuses a negative amount, as every *_cents column does', () => {
    expect(parseAnswer('money', -100)).toBeNull()
    expect(parseAnswer('money', { cents: -1 })).toBeNull()
  })

  it('never returns a fractional amount for any accepted input', () => {
    for (const raw of [0, 1, 99, 100_000, '250']) {
      const parsed = parseAnswer('money', raw)
      expect(parsed).not.toBeNull()
      expect(Number.isInteger((parsed as { cents: number }).cents)).toBe(true)
    }
  })
})

describe('isCompleteAnswer', () => {
  it('is exactly parseAnswer’s verdict, for every kind', () => {
    // One rule, two questions. Written as two rules they drift, and the drift shows up as a
    // form that accepts what the server then refuses with nothing to point at.
    const samples: unknown[] = ['x', '', 0, false, null, { text: 'x' }, ['a'], 12.34, '2026-02-30']
    for (const kind of ANSWERABLE_KINDS) {
      for (const sample of samples) {
        expect(isCompleteAnswer(kind, sample)).toBe(parseAnswer(kind, sample) !== null)
      }
    }
  })

  it('says nothing about whether the step was required', () => {
    // `required` decides whether a task may be left alone; this decides whether what
    // arrived is an answer. A blank is not an answer either way.
    expect(isCompleteAnswer('text', '')).toBe(false)
    expect(isCompleteAnswer('text', 'anything')).toBe(true)
  })
})

describe('describeAnswer', () => {
  it('renders each kind as one line', () => {
    expect(describeAnswer('text', 'Aunt Bea', money)).toBe('Aunt Bea')
    expect(describeAnswer('long_text', { text: 'A paragraph.' }, money)).toBe('A paragraph.')
    expect(describeAnswer('list', ['plates', 'cups'], money)).toBe('plates, cups')
    expect(describeAnswer('yes_no', false, money)).toBe('No')
    expect(describeAnswer('yes_no', true, money)).toBe('Yes')
    expect(describeAnswer('number', 12.5, money)).toBe('12.5')
  })

  it('formats a date through the app’s one date formatter', () => {
    // `formatDate` is imported rather than restated: `lib/date-utils.ts` is the only place
    // in the app that turns a date into prose, and a second copy of "August 19, 2026" is
    // how two screens come to disagree about the same day.
    expect(describeAnswer('date', '2026-08-19', money)).toBe('August 19, 2026')
  })

  it('formats money with the formatter it was handed, and never its own', () => {
    // Passed in so this module never has to choose between `formatCurrency` and the
    // whole-dollar variant — the screen knows which reads right on it.
    expect(describeAnswer('money', 125_000, money)).toBe('<125000c>')
  })

  it('is empty for an answer that is not one, so the screen decides what absence looks like', () => {
    expect(describeAnswer('text', '', money)).toBe('')
    expect(describeAnswer('yes_no', '', money)).toBe('')
    expect(describeAnswer('money', 12.34, money)).toBe('')
    expect(describeAnswer('date', null, money)).toBe('')
  })
})

describe('gatheringTiming', () => {
  it('places a one-day gathering', () => {
    expect(gatheringTiming('2026-08-19', null, '2026-08-19')).toBe('today')
    expect(gatheringTiming('2026-08-20', null, '2026-08-19')).toBe('upcoming')
    expect(gatheringTiming('2026-08-18', null, '2026-08-19')).toBe('past')
  })

  it('says a multi-day gathering is happening on its middle days', () => {
    // 'today' means HAPPENING NOW. The second day of a three-day reunion is not past, and
    // that is the whole reason `ends_on` exists.
    expect(gatheringTiming('2026-08-15', '2026-08-18', '2026-08-16')).toBe('today')
    expect(gatheringTiming('2026-08-15', '2026-08-18', '2026-08-17')).toBe('today')
  })

  it('says so on its first and last days, and not the day after', () => {
    expect(gatheringTiming('2026-08-15', '2026-08-18', '2026-08-15')).toBe('today')
    expect(gatheringTiming('2026-08-15', '2026-08-18', '2026-08-18')).toBe('today')
    expect(gatheringTiming('2026-08-15', '2026-08-18', '2026-08-19')).toBe('past')
    expect(gatheringTiming('2026-08-15', '2026-08-18', '2026-08-14')).toBe('upcoming')
  })

  it('reads an end before the start as a one-day gathering', () => {
    // `gatherings_dates_ordered` refuses the row, so this is about one that arrived from
    // somewhere else. Taking the later of the two never hides a gathering from its own day.
    expect(gatheringTiming('2026-08-19', '2026-08-01', '2026-08-19')).toBe('today')
    expect(gatheringTiming('2026-08-19', '2026-08-01', '2026-08-20')).toBe('past')
  })

  it('crosses a month and a year boundary on the strings alone', () => {
    expect(gatheringTiming('2026-12-30', '2027-01-02', '2027-01-01')).toBe('today')
    expect(gatheringTiming('2026-12-30', '2027-01-02', '2027-01-03')).toBe('past')
  })
})

describe('under a negative UTC offset', () => {
  const original = process.env.TZ
  // `process.env.TZ = undefined` assigns the STRING "undefined", which is not a zone and
  // not a restore — so an absent original is deleted rather than assigned. Every test after
  // this block would otherwise run in whatever Node makes of that.
  afterEach(() => {
    if (original === undefined) delete process.env.TZ
    else process.env.TZ = original
  })

  it('puts a gathering on its own day west of Greenwich', () => {
    // THIS IS THE BUG THE STRING COMPARISON EXISTS TO PREVENT. `new Date('2026-08-01')` is
    // UTC midnight, which in Pacific time is the evening of 31 July — so an implementation
    // that compared Dates would call a gathering starting on the 1st "past" all day on the
    // 1st, for half the country, while passing every test run in UTC.
    process.env.TZ = 'America/Los_Angeles'
    expect(gatheringTiming('2026-08-01', null, '2026-08-01')).toBe('today')
    expect(gatheringTiming('2026-08-01', null, '2026-07-31')).toBe('upcoming')
    expect(gatheringTiming('2026-08-01', '2026-08-03', '2026-08-03')).toBe('today')
  })

  it('still formats an answer’s date as the day that was chosen', () => {
    process.env.TZ = 'America/Los_Angeles'
    expect(describeAnswer('date', '2026-08-01', money)).toBe('August 1, 2026')
  })
})

describe('taskProgress', () => {
  const tasks = (...statuses: GatheringTaskStatus[]) => statuses.map(status => ({ status }))

  it('counts each status and totals them', () => {
    expect(taskProgress(tasks('open', 'open', 'submitted', 'approved', 'denied'))).toEqual({
      total: 5, open: 2, submitted: 1, approved: 1, denied: 1, complete: false,
    })
  })

  it('is complete only when every task is approved', () => {
    expect(taskProgress(tasks('approved', 'approved')).complete).toBe(true)
    expect(taskProgress(tasks('approved', 'submitted')).complete).toBe(false)
    expect(taskProgress(tasks('approved', 'denied')).complete).toBe(false)
  })

  it('a gathering with no tasks is not complete', () => {
    // `0 === 0` would say it was. A template with no steps, or a gathering scheduled before
    // anybody added one, must not report itself finished to an organizer.
    expect(taskProgress([])).toEqual({
      total: 0, open: 0, submitted: 0, approved: 0, denied: 0, complete: false,
    })
  })

  it('counts a status this build does not know about toward the total only', () => {
    // So the gathering reads as unfinished rather than as complete — the safe direction for
    // an unknown value, and the same call `duesScope` makes about a scope it cannot place.
    const withStranger = [{ status: 'approved' }, { status: 'archived' }] as { status: GatheringTaskStatus }[]
    const progress = taskProgress(withStranger)
    expect(progress.total).toBe(2)
    expect(progress.approved).toBe(1)
    expect(progress.complete).toBe(false)
  })
})

/**
 * THE 7PM BOUNDARY — why the family's zone decides past from upcoming (Phase 2b).
 *
 * ── THE BUG THIS RECORDS ────────────────────────────────────────────────────────────
 * Every server-side caller of `gatheringTiming` passed `todayLocal()`, which reads whatever
 * zone the PROCESS is in — UTC on the server. UTC rolls over at 7pm Central, so for the last
 * five hours of every day the server judged the family's gatherings against tomorrow:
 *
 *     an evening picnic on 26 August, read at 19:30 on 26 August in Chicago
 *       UTC says today is the 27th   ->  'past'      the gathering is over
 *       Chicago says it is the 26th  ->  'today'     the family is at it
 *
 * So a gathering dropped off Upcoming, and off the Dashboard's premier band, exactly as it
 * started. `gatheringTiming` was never wrong — it compares `YYYY-MM-DD` strings and its own
 * comment says why that cannot be a day out. What was wrong was the date handed to it.
 *
 * ── AND WHY THE FAMILY'S ZONE RATHER THAN THE READER'S ──────────────────────────────
 * The reader's zone is the worst answer for the one person it matters to: a cousin in Tokyo
 * would be told an Austin reunion is over while it is still Sunday evening in Austin. For a
 * family in one place every candidate agrees; they differ exactly for the relative who moved
 * away. `resolveFamilyZone` in `lib/auth/zone.ts` carries the full argument.
 *
 * These assertions are the composition the callers now perform, by value, with no clock.
 */
describe('the past/upcoming boundary is the family zone, not the server', () => {
  /** 26 August 19:30 Chicago = 27 August 00:30 UTC. */
  const AT = new Date('2026-08-27T00:30:00Z')

  it('a gathering being held this evening is TODAY in the family zone and PAST in UTC', () => {
    // THE BUG AND THE FIX IN TWO LINES.
    expect(gatheringTiming('2026-08-26', null, todayIn('America/Chicago', AT))).toBe('today')
    expect(gatheringTiming('2026-08-26', null, todayIn('UTC', AT))).toBe('past')
  })

  it('the last day of a multi-day span behaves the same way', () => {
    // A three-day reunion ending on the 26th: still on for the family, over for the server.
    // This is the case the Dashboard's premier band reads, so the band emptied at 7pm on the
    // final evening — the one evening a family is most likely to be looking at it.
    expect(gatheringTiming('2026-08-24', '2026-08-26', todayIn('America/Chicago', AT)))
      .toBe('today')
    expect(gatheringTiming('2026-08-24', '2026-08-26', todayIn('UTC', AT))).toBe('past')
  })

  it('a family AHEAD of UTC is wrong in the other direction', () => {
    // Not only the Americas, and the instant is a DIFFERENT one — which is the point. The
    // Chicago case needs UTC to be a day AHEAD; this one needs it a day BEHIND, and no single
    // instant gives both. 26 August 16:00 UTC is 01:00 on the 27th in Tokyo and 11:00 on the
    // 26th in Chicago, hand-checked.
    //
    // The symptom inverts: a gathering the family is already at does not appear under Today at
    // all. The first draft of this test reused the Chicago instant and asserted 'upcoming'
    // here, which was simply false — at 00:30 UTC it is the 27th in UTC too.
    const AHEAD = new Date('2026-08-26T16:00:00Z')
    expect(todayIn('Asia/Tokyo', AHEAD)).toBe('2026-08-27')
    expect(todayIn('UTC', AHEAD)).toBe('2026-08-26')
    expect(gatheringTiming('2026-08-27', null, todayIn('Asia/Tokyo', AHEAD))).toBe('today')
    expect(gatheringTiming('2026-08-27', null, todayIn('UTC', AHEAD))).toBe('upcoming')
  })

  it('and away from the boundary every zone agrees, which is why this went unnoticed', () => {
    // Midday Chicago. Nothing about the old behaviour was visible for nineteen hours of every
    // day, which is the whole reason a bug like this survives: it is correct whenever anybody
    // is likely to be checking.
    const MIDDAY = new Date('2026-08-26T17:00:00Z')
    for (const zone of ['America/Chicago', 'UTC', 'Europe/London']) {
      expect(gatheringTiming('2026-08-26', null, todayIn(zone, MIDDAY))).toBe('today')
    }
  })
})
