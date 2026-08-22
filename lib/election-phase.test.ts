import { describe, expect, it } from 'vitest'
import {
  electionPhase,
  electionIsClosed,
  electionIsCurrent,
  electionWindowBounds,
  nominationsOpen,
  votingOpen,
  windowProblem,
} from './election-phase'

/**
 * The phase arithmetic, and the window rules the organizer's form and `createElection` share.
 *
 * A GREEN RUN IS NOT EVIDENCE UNTIL YOU HAVE SEEN IT FAIL (AGENTS.md §7b), and this suite was
 * checked by mutation. Each of these was applied to `lib/election-phase.ts` on its own and the
 * failures are what is listed:
 *
 *   `today < nomOpen` -> `today <= nomOpen`
 *       trips "the day nominations open, they are open"
 *   `today <= nomClose` -> `today < nomClose`
 *       trips "the closing day is still open" for both windows — which is the INCLUSIVE
 *       close rule, and the one thing in this file a future change is most likely to flip
 *   the `today >= voteOpen` branch moved back below the `nomClose` one
 *       trips "voting takes the day the two windows share" — the same-day handover, which
 *       is otherwise invisible: every other arrangement gives the same answer either way round
 *   the `!nomOpen || !nomClose || …` guard deleted
 *       trips "a published election missing a date opens nothing"
 *   `status !== 'published'` -> `status === 'draft'`
 *       trips "an unrecognized status is not published"
 *   `nomClose <= nomOpen` -> `nomClose < nomOpen` in windowProblem
 *       trips "a one-day nominations window is refused"
 *   the voting-not-before-nominations clause deleted
 *       trips "refuses voting that opens before nominations close"
 *   that clause put back to `<=`
 *       trips "accepts voting that opens on the day nominations close"
 *   `dayAfter` -> the neighbour's own date (i.e. `shiftDays(iso, 0)`)
 *       trips "each bound mirrors its own comparison" — the mutation that matters
 *       most, because it greys out one day too few and leaves the picker offering exactly
 *       the date `windowProblem` then refuses
 *   the two MIDDLE bounds shifted a day (back to `dayAfter`/`dayBefore`)
 *       trips the same test from the other side: those two touch since 2026-08-22, and a day
 *       of daylight there greys out the handover the change exists to allow
 *   `dayBefore` -> `dayAfter`
 *       trips the same test from the other side
 *   `shiftDays`'s regex loosened to accept a blank
 *       trips "an unset neighbour is no bound at all"
 *
 * The dates are deliberately spelled out rather than computed from an offset: this module
 * compares `YYYY-MM-DD` strings and never constructs a `Date`, so a test that built its
 * fixtures with `Date` arithmetic would be testing a different thing from the code.
 */

/** A published election whose windows are the four days 1–2 and 4–5 January. */
const PUBLISHED = {
  status: 'published',
  nominations_open_on: '2027-01-01',
  nominations_close_on: '2027-01-02',
  voting_open_on: '2027-01-04',
  voting_close_on: '2027-01-05',
}

describe('electionPhase', () => {
  it('calls a draft a draft whatever its dates say', () => {
    expect(electionPhase({ ...PUBLISHED, status: 'draft' }, '2027-01-01')).toBe('draft')
    expect(electionPhase({ ...PUBLISHED, status: 'draft' }, '2027-01-04')).toBe('draft')
  })

  it('treats an unrecognized status as not published', () => {
    // The retired four-state words are the case that matters: a database mid-migration, or a
    // projection that carried one through. Nothing may be open on the strength of them.
    expect(electionPhase({ ...PUBLISHED, status: 'nominations' }, '2027-01-01')).toBe('draft')
    expect(electionPhase({ ...PUBLISHED, status: 'voting' }, '2027-01-04')).toBe('draft')
    expect(electionPhase({ ...PUBLISHED, status: null }, '2027-01-04')).toBe('draft')
  })

  it('is scheduled before nominations open', () => {
    expect(electionPhase(PUBLISHED, '2026-12-31')).toBe('scheduled')
  })

  it('opens nominations on the opening day', () => {
    expect(electionPhase(PUBLISHED, '2027-01-01')).toBe('nominations')
  })

  it('keeps nominations open on the closing day', () => {
    // THE INCLUSIVE CLOSE. The SQL twin uses BETWEEN, which is inclusive at both ends, and
    // /help states it in words. All three move together or the screen lies by a day.
    expect(electionPhase(PUBLISHED, '2027-01-02')).toBe('nominations')
  })

  it('sits between the windows once nominations have closed', () => {
    expect(electionPhase(PUBLISHED, '2027-01-03')).toBe('between')
  })

  it('opens voting on the opening day and keeps it open on the closing day', () => {
    expect(electionPhase(PUBLISHED, '2027-01-04')).toBe('voting')
    expect(electionPhase(PUBLISHED, '2027-01-05')).toBe('voting')
  })

  it('is closed the day after voting closes', () => {
    expect(electionPhase(PUBLISHED, '2027-01-06')).toBe('closed')
    expect(electionPhase(PUBLISHED, '2030-01-01')).toBe('closed')
  })

  it('opens nothing for a published election missing a date', () => {
    // `elections_published_has_windows` makes this impossible in the database, so the case
    // is a projection that did not select all four columns — and the answer has to be the
    // closed one, because the cost of the other is a vote accepted after the poll shut.
    expect(electionPhase({ ...PUBLISHED, voting_close_on: null }, '2027-01-04')).toBe('draft')
    expect(electionPhase({ ...PUBLISHED, nominations_open_on: undefined }, '2027-01-01'))
      .toBe('draft')
  })

  it('handles a window with no gap between nominations closing and voting opening', () => {
    // Voting opens the day after nominations close, so there is no `between` day at all. The
    // phase must step straight across.
    const tight = { ...PUBLISHED, voting_open_on: '2027-01-03', voting_close_on: '2027-01-04' }
    expect(electionPhase(tight, '2027-01-02')).toBe('nominations')
    expect(electionPhase(tight, '2027-01-03')).toBe('voting')
  })

  it('gives voting the day the two windows share', () => {
    // THE SAME-DAY HANDOVER, 2026-08-22. `voting_open_on === nominations_close_on` is legal
    // now, and on that day both `today <= nomClose` and `today >= voteOpen` are true. Voting
    // wins, which is what keeps a ballot from being open while the slate can still change —
    // the invariant the old strictly-after constraint bought.
    const sameDay = { ...PUBLISHED, voting_open_on: '2027-01-02', voting_close_on: '2027-01-04' }
    expect(electionPhase(sameDay, '2027-01-01')).toBe('nominations')
    expect(electionPhase(sameDay, '2027-01-02')).toBe('voting')
    expect(electionPhase(sameDay, '2027-01-04')).toBe('voting')
    expect(electionPhase(sameDay, '2027-01-05')).toBe('closed')
  })

  it('never reports between when the two windows touch', () => {
    // There is no day left for it to be, and a `between` that could never happen would be a
    // phase the detail page renders a heading for and nothing else.
    const sameDay = { ...PUBLISHED, voting_open_on: '2027-01-02', voting_close_on: '2027-01-04' }
    for (const d of ['2026-12-31', '2027-01-01', '2027-01-02', '2027-01-03', '2027-01-04', '2027-01-05']) {
      expect(electionPhase(sameDay, d)).not.toBe('between')
    }
  })

  it('is a one-day election when every window is one day and they share it', () => {
    // The shortest thing this product can now describe: nominations on the 1st, voting on the
    // 2nd, done. Four days was the floor before.
    const shortest = {
      status: 'published',
      nominations_open_on: '2027-01-01',
      nominations_close_on: '2027-01-02',
      voting_open_on: '2027-01-02',
      voting_close_on: '2027-01-03',
    }
    expect(electionPhase(shortest, '2027-01-01')).toBe('nominations')
    expect(electionPhase(shortest, '2027-01-02')).toBe('voting')
    expect(electionPhase(shortest, '2027-01-03')).toBe('voting')
    expect(electionPhase(shortest, '2027-01-04')).toBe('closed')
  })
})

describe('the phase predicates', () => {
  it('opens nominations and voting only in their own phase', () => {
    expect(nominationsOpen('nominations')).toBe(true)
    expect(votingOpen('voting')).toBe(true)
    for (const p of ['draft', 'scheduled', 'between', 'closed'] as const) {
      expect(nominationsOpen(p)).toBe(false)
      expect(votingOpen(p)).toBe(false)
    }
    expect(nominationsOpen('voting')).toBe(false)
    expect(votingOpen('nominations')).toBe(false)
  })

  it('counts scheduled and between as current, and draft and closed as not', () => {
    // `scheduled` and `between` are current on purpose: an election that vanished from the
    // list for the days between its two windows and came back would read as a bug.
    expect(electionIsCurrent('scheduled')).toBe(true)
    expect(electionIsCurrent('between')).toBe(true)
    expect(electionIsCurrent('nominations')).toBe(true)
    expect(electionIsCurrent('voting')).toBe(true)
    expect(electionIsCurrent('draft')).toBe(false)
    expect(electionIsCurrent('closed')).toBe(false)
  })

  it('reports closed only when closed', () => {
    expect(electionIsClosed('closed')).toBe(true)
    expect(electionIsClosed('voting')).toBe(false)
    expect(electionIsClosed('draft')).toBe(false)
  })
})

const WINDOWS = {
  nominations_open_on: '2027-01-01',
  nominations_close_on: '2027-01-02',
  voting_open_on: '2027-01-04',
  voting_close_on: '2027-01-05',
}
const EMPTY = {
  nominations_open_on: '',
  nominations_close_on: '',
  voting_open_on: '',
  voting_close_on: '',
}

describe('windowProblem', () => {
  it('accepts an ordered set of four dates', () => {
    expect(windowProblem(WINDOWS, { requireAll: true })).toBeNull()
    expect(windowProblem(WINDOWS, { requireAll: false })).toBeNull()
  })

  it('lets a draft be empty and refuses to publish one', () => {
    expect(windowProblem(EMPTY, { requireAll: false })).toBeNull()
    expect(windowProblem(EMPTY, { requireAll: true })).toMatch(/all four dates/)
  })

  it('lets a draft be half-written', () => {
    // The whole use of a draft. Only the dates that ARE present are checked against each
    // other, so an organizer can fill the form in the order the form asks for it.
    expect(windowProblem({ ...EMPTY, nominations_open_on: '2027-01-01' }, { requireAll: false }))
      .toBeNull()
  })

  it('refuses a zero-length window in either half', () => {
    expect(windowProblem(
      { ...WINDOWS, nominations_close_on: '2027-01-01' }, { requireAll: true },
    )).toMatch(/Nominations must close after they open/)
    expect(windowProblem(
      { ...WINDOWS, voting_close_on: '2027-01-04' }, { requireAll: true },
    )).toMatch(/Voting must close after it opens/)
  })

  it('refuses a backwards window', () => {
    expect(windowProblem(
      { ...WINDOWS, nominations_open_on: '2027-01-09' }, { requireAll: true },
    )).toMatch(/Nominations must close after they open/)
  })

  it('refuses voting that opens before nominations close', () => {
    expect(windowProblem(
      { ...WINDOWS, voting_open_on: '2027-01-01', voting_close_on: '2027-01-10' },
      { requireAll: true },
    )).toMatch(/Voting cannot open before nominations close/)
  })

  it('accepts voting that opens on the day nominations close', () => {
    // 2026-08-22. The handover is allowed and the overlap is resolved by `electionPhase`,
    // which gives the shared day to voting — so the ballot is never live while the slate
    // can still change, which is what the strictly-after rule was actually protecting.
    expect(windowProblem(
      { ...WINDOWS, voting_open_on: '2027-01-02' }, { requireAll: true },
    )).toBeNull()
  })

  it('accepts the tightest legal arrangement — one day per window, sharing the handover', () => {
    expect(windowProblem({
      nominations_open_on: '2027-01-01',
      nominations_close_on: '2027-01-02',
      voting_open_on: '2027-01-02',
      voting_close_on: '2027-01-03',
    }, { requireAll: true })).toBeNull()
  })

  it('reports the earliest thing wrong when several are', () => {
    // The order of the checks is the order the form is filled in, so an organizer is told
    // about the field they are looking at rather than the last test that happened to fail.
    expect(windowProblem({
      nominations_open_on: '2027-01-05',
      nominations_close_on: '2027-01-01',
      voting_open_on: '2026-12-01',
      voting_close_on: '2026-11-01',
    }, { requireAll: true })).toMatch(/Nominations must close after they open/)
    // ...and the second thing wrong really is wrong, or the assertion above proves only that
    // the first test fires rather than that it fires FIRST.
    expect(windowProblem({
      nominations_open_on: '2027-01-05',
      nominations_close_on: '2027-01-06',
      voting_open_on: '2026-12-01',
      voting_close_on: '2026-11-01',
    }, { requireAll: true })).toMatch(/Voting cannot open before nominations close/)
  })
})

/**
 * The picker bounds, which are `windowProblem`'s chain read forwards.
 *
 * ── WHY THESE ARE WORTH TESTING SEPARATELY FROM `windowProblem` ─────────────────────
 * They are the same rule, and that is exactly the risk: the two can agree in prose and
 * disagree by a day. `windowProblem` refuses `nomClose <= nomOpen`, so the earliest legal
 * close is the day AFTER — and a bounds function that returned `nomOpen` itself would grey
 * out one day too few, leave the picker offering a date the action refuses, and be invisible
 * to every test of `windowProblem`. The last assertion in this block is the two functions
 * checked against each other rather than each against a literal.
 */
describe('electionWindowBounds', () => {
  const EMPTY = {
    nominations_open_on: '', nominations_close_on: '', voting_open_on: '', voting_close_on: '',
  }

  it('offers no bounds at all on an empty form', () => {
    expect(electionWindowBounds(EMPTY)).toEqual({
      nominations_open_on: { max: undefined },
      nominations_close_on: { min: undefined, max: undefined },
      voting_open_on: { min: undefined, max: undefined },
      voting_close_on: { min: undefined },
    })
  })

  it('each bound mirrors its own comparison', () => {
    // A WINDOW AGAINST ITSELF IS A DAY AWAY; THE TWO WINDOWS AGAINST EACH OTHER TOUCH. Those
    // are two different rules in `windowProblem` (`<=` within a window, `<` between them) and
    // this is where they are checked against each other rather than against prose.
    const b = electionWindowBounds({
      nominations_open_on: '2027-03-01',
      nominations_close_on: '2027-03-10',
      voting_open_on: '2027-03-20',
      voting_close_on: '2027-03-31',
    })
    expect(b.nominations_open_on.max).toBe('2027-03-09')
    expect(b.nominations_close_on.min).toBe('2027-03-02')
    expect(b.nominations_close_on.max).toBe('2027-03-20')
    expect(b.voting_open_on.min).toBe('2027-03-10')
    expect(b.voting_open_on.max).toBe('2027-03-30')
    expect(b.voting_close_on.min).toBe('2027-03-21')
  })


  it('an unset neighbour is no bound at all, and never an empty string', () => {
    // `min=""` on a date input is not "no minimum" in every engine, and React renders an
    // empty string where it drops an `undefined`. So the absent case has to be absent.
    const b = electionWindowBounds({ ...EMPTY, nominations_close_on: '2027-05-05' })
    expect(b.nominations_close_on.min).toBeUndefined()
    expect(b.nominations_close_on.max).toBeUndefined()
    expect(b.nominations_open_on.max).toBe('2027-05-04')
    expect(b.voting_open_on.min).toBe('2027-05-05')
  })

  it('crosses a month end, a year end and a leap day', () => {
    // `Date.UTC` with a day of 0 or 32 resolves into the neighbouring month, which is what
    // makes day arithmetic safe here where `setUTCMonth` would overflow.
    expect(electionWindowBounds({ ...EMPTY, nominations_open_on: '2027-01-31' })
      .nominations_close_on.min).toBe('2027-02-01')
    expect(electionWindowBounds({ ...EMPTY, nominations_open_on: '2027-12-31' })
      .nominations_close_on.min).toBe('2028-01-01')
    expect(electionWindowBounds({ ...EMPTY, nominations_close_on: '2028-03-01' })
      .nominations_open_on.max).toBe('2028-02-29')
    expect(electionWindowBounds({ ...EMPTY, nominations_close_on: '2027-03-01' })
      .nominations_open_on.max).toBe('2027-02-28')
  })

  it('ignores a malformed date rather than inventing a bound', () => {
    expect(electionWindowBounds({ ...EMPTY, nominations_open_on: '2027-3-1' })
      .nominations_close_on.min).toBeUndefined()
    expect(electionWindowBounds({ ...EMPTY, nominations_open_on: 'tomorrow' })
      .nominations_close_on.min).toBeUndefined()
  })

  it('looks at the immediate neighbour only, never further down the chain', () => {
    // A partly-filled form is the normal state of this one. Flooring `voting_close_on` on
    // `nominations_open_on + 3` would grey out days that become legal the moment the
    // organizer fills the gap, in an order they did not choose to type in.
    const b = electionWindowBounds({ ...EMPTY, nominations_open_on: '2027-06-01' })
    expect(b.nominations_close_on.min).toBe('2027-06-02')
    expect(b.voting_open_on.min).toBeUndefined()
    expect(b.voting_close_on.min).toBeUndefined()
  })

  it('agrees with windowProblem about the tightest legal arrangement', () => {
    // THE TWO FUNCTIONS CHECKED AGAINST EACH OTHER, which is the assertion neither can make
    // alone: every date the bounds permit at the floor is one windowProblem accepts, and the
    // day below each floor is one it refuses.
    let dates = {
      nominations_open_on: '2027-01-01', nominations_close_on: '', voting_open_on: '',
      voting_close_on: '',
    }
    dates = { ...dates, nominations_close_on: electionWindowBounds(dates).nominations_close_on.min! }
    dates = { ...dates, voting_open_on: electionWindowBounds(dates).voting_open_on.min! }
    dates = { ...dates, voting_close_on: electionWindowBounds(dates).voting_close_on.min! }

    // THREE DAYS, NOT FOUR, SINCE 2026-08-22: voting opens on the day nominations close, so the
    // walk lands on the same date twice. That is the shortest election this product can
    // describe, and this is the assertion that would go red if either middle bound drifted
    // back to a day of daylight.
    expect(dates).toEqual({
      nominations_open_on: '2027-01-01',
      nominations_close_on: '2027-01-02',
      voting_open_on: '2027-01-02',
      voting_close_on: '2027-01-03',
    })
    expect(windowProblem(dates, { requireAll: true })).toBeNull()

    // And one day earlier at each step is refused, so the floor is exactly the floor.
    expect(windowProblem({ ...dates, nominations_close_on: '2027-01-01' }, { requireAll: true }))
      .not.toBeNull()
    expect(windowProblem({ ...dates, voting_open_on: '2027-01-01' }, { requireAll: true }))
      .not.toBeNull()
    expect(windowProblem({ ...dates, voting_close_on: '2027-01-02' }, { requireAll: true }))
      .not.toBeNull()
  })
})
