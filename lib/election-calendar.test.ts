import { describe, expect, it } from 'vitest'
import { electionWindows } from './election-calendar'

/**
 * Per AGENTS.md §7b. A GREEN RUN IS NOT EVIDENCE UNTIL YOU HAVE SEEN IT FAIL, and each of
 * these mutations turns a different case red:
 *
 *   * drop either `&&` guard on a pair of dates → "skips a window whose … is missing"
 *   * emit one span from the first date to the last → "the gap between the two is real"
 *   * drop the `:nominations` / `:voting` suffix → "the two entries never share an id"
 *   * swap the two `phase` values → "labels which half is which"
 */

const full = {
  id: 'e1',
  title: 'Board Election',
  nominations_open_on: '2026-09-01',
  nominations_close_on: '2026-09-14',
  voting_open_on: '2026-09-21',
  voting_close_on: '2026-09-30',
}

describe('electionWindows', () => {
  it('makes two entries from a published election', () => {
    const out = electionWindows(full)
    expect(out).toHaveLength(2)
    expect(out.map(e => e.kind)).toEqual(['election', 'election'])
    expect(out.map(e => e.href)).toEqual(['/community/elections/e1', '/community/elections/e1'])
  })

  it('labels which half is which, in the title and in the phase', () => {
    const [nominations, voting] = electionWindows(full)
    expect(nominations.phase).toBe('nominations')
    expect(nominations.title).toContain('Nominations')
    expect(nominations.title).toContain('Board Election')
    expect(voting.phase).toBe('voting')
    expect(voting.title).toContain('Voting')
  })

  it('the two entries never share an id', () => {
    // `buildCalendarMonth` keys a chip on `${day}:${entry.id}`, so two windows landing on one
    // day with one id would be two React children with the same key. They cannot overlap
    // today — `voting_open_on > nominations_close_on` is a CHECK — which is exactly what
    // would make this wait for a schema change to show up.
    const [a, b] = electionWindows(full)
    expect(a.id).not.toBe(b.id)
  })

  it('spans each window end to end, inclusively', () => {
    const [nominations, voting] = electionWindows(full)
    expect(nominations.startsOn).toBe('2026-09-01')
    expect(nominations.endsOn).toBe('2026-09-14')
    expect(voting.startsOn).toBe('2026-09-21')
    expect(voting.endsOn).toBe('2026-09-30')
  })

  it('the gap between the two is real, not filled in', () => {
    // 15–20 September is a slate that has closed with no vote open yet. One span from the
    // first date to the last would put a chip on those days saying there is something to do.
    const [nominations, voting] = electionWindows(full)
    expect(nominations.endsOn! < voting.startsOn).toBe(true)
  })

  it('skips a window whose open date is missing', () => {
    const out = electionWindows({ ...full, nominations_open_on: null })
    expect(out.map(e => e.phase)).toEqual(['voting'])
  })

  it('skips a window whose close date is missing', () => {
    const out = electionWindows({ ...full, voting_close_on: null })
    expect(out.map(e => e.phase)).toEqual(['nominations'])
  })

  it('makes nothing at all from a draft with no dates', () => {
    expect(electionWindows({
      id: 'e2',
      title: 'Untitled',
      nominations_open_on: null,
      nominations_close_on: null,
      voting_open_on: null,
      voting_close_on: null,
    })).toEqual([])
  })
})
