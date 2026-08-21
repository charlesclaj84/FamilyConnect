import { describe, expect, it } from 'vitest'
import {
  electionPhase,
  electionIsClosed,
  electionIsCurrent,
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
 *   the `!nomOpen || !nomClose || …` guard deleted
 *       trips "a published election missing a date opens nothing"
 *   `status !== 'published'` -> `status === 'draft'`
 *       trips "an unrecognized status is not published"
 *   `nomClose <= nomOpen` -> `nomClose < nomOpen` in windowProblem
 *       trips "a one-day nominations window is refused"
 *   the voting-after-nominations clause deleted
 *       trips "voting may not open on the day nominations close"
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
    // The minimum the constraint allows: voting opens the day after nominations close, so
    // there is no `between` day at all. The phase must step straight across.
    const tight = { ...PUBLISHED, voting_open_on: '2027-01-03', voting_close_on: '2027-01-04' }
    expect(electionPhase(tight, '2027-01-02')).toBe('nominations')
    expect(electionPhase(tight, '2027-01-03')).toBe('voting')
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

  it('refuses voting that opens on or before the day nominations close', () => {
    expect(windowProblem(
      { ...WINDOWS, voting_open_on: '2027-01-02' }, { requireAll: true },
    )).toMatch(/Voting must open after nominations close/)
    expect(windowProblem(
      { ...WINDOWS, voting_open_on: '2027-01-01', voting_close_on: '2027-01-10' },
      { requireAll: true },
    )).toMatch(/Voting must open after nominations close/)
  })

  it('accepts the tightest legal arrangement — a day at every step', () => {
    expect(windowProblem({
      nominations_open_on: '2027-01-01',
      nominations_close_on: '2027-01-02',
      voting_open_on: '2027-01-03',
      voting_close_on: '2027-01-04',
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
  })
})
