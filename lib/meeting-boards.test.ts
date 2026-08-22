import { describe, expect, it } from 'vitest'
import {
  boardKey, buildBoards, buildPositions, resolveBoardAttendees, type BoardAssignment,
} from './meeting-boards'

/**
 * Per AGENTS.md §7b. A GREEN RUN IS NOT EVIDENCE UNTIL YOU HAVE SEEN IT FAIL; each of these
 * mutations turns a different case red:
 *
 *   * drop the `if (a.scope !== 'national' && !areaId) continue` guard
 *       → "drops a regional assignment that names no region"
 *   * key `boardKey` on the bare area id                → "a region and a chapter never collide"
 *   * key `buildBoards` on scope alone                  → "two chapters are two boards"
 *   * key `buildPositions` on the role NAME             → n/a today, but see that test's note
 *   * make `resolveBoardAttendees` intersect            → "unions rather than intersects"
 *   * drop the de-duplication (`Set`)                   → "somebody on two boards is invited once"
 */

const names = {
  regionNames: new Map([['r-tx', 'Texas'], ['r-ca', 'California']]),
  chapterNames: new Map([['c-atx', 'Austin'], ['c-hou', 'Houston']]),
}

function assignment(over: Partial<BoardAssignment>): BoardAssignment {
  return {
    personId: 'p1',
    personName: 'Ada Nwosu',
    roleId: 'role-pres-nat',
    roleName: 'President',
    scope: 'national',
    regionId: null,
    chapterId: null,
    ...over,
  }
}

describe('boardKey', () => {
  it('is the bare word for the national board, which has no area', () => {
    expect(boardKey('national', null)).toBe('national')
    // An area on a national assignment is meaningless and is not allowed to change the key.
    expect(boardKey('national', 'r-tx')).toBe('national')
  })

  it('a region and a chapter never collide, even on the same id', () => {
    // Both are uuids, from different tables, and nothing stops the same value appearing in
    // each in a fixture. Without the scope prefix the two boards would merge into one.
    expect(boardKey('regional', 'x')).not.toBe(boardKey('chapter', 'x'))
  })
})

describe('buildBoards', () => {
  it('names each board after its area', () => {
    const boards = buildBoards([
      assignment({}),
      assignment({ personId: 'p2', scope: 'regional', regionId: 'r-tx' }),
      assignment({ personId: 'p3', scope: 'chapter', chapterId: 'c-atx' }),
    ], names)
    expect(boards.map(b => b.label)).toEqual([
      'National Board', 'Texas Region Board', 'Austin Chapter Board',
    ])
  })

  it('two chapters are two boards', () => {
    const boards = buildBoards([
      assignment({ personId: 'p1', scope: 'chapter', chapterId: 'c-atx' }),
      assignment({ personId: 'p2', scope: 'chapter', chapterId: 'c-hou' }),
    ], names)
    expect(boards).toHaveLength(2)
    expect(boards.map(b => b.personIds)).toEqual([['p1'], ['p2']])
  })

  it('gathers everybody holding any office in the same area onto one board', () => {
    const boards = buildBoards([
      assignment({ personId: 'p1', personName: 'Ada', roleId: 'r1', scope: 'chapter', chapterId: 'c-atx' }),
      assignment({ personId: 'p2', personName: 'Ben', roleId: 'r2', scope: 'chapter', chapterId: 'c-atx' }),
    ], names)
    expect(boards).toHaveLength(1)
    expect(boards[0].personIds).toEqual(['p1', 'p2'])
  })

  it('counts somebody holding two offices on one board once', () => {
    const boards = buildBoards([
      assignment({ personId: 'p1', roleId: 'r1' }),
      assignment({ personId: 'p1', roleId: 'r2' }),
    ], names)
    expect(boards[0].personIds).toEqual(['p1'])
  })

  it('drops a regional assignment that names no region', () => {
    // `user_roles.region_id` is nullable, so the row can exist. A board captioned "Regional
    // Board" with no region is a control whose meaning nobody could state.
    const boards = buildBoards([assignment({ scope: 'regional', regionId: null })], names)
    expect(boards).toEqual([])
  })

  it('lists only boards somebody is actually on', () => {
    // Nine chapters with two filled is the ordinary case; seven empty boards would be seven
    // controls that select nobody.
    const boards = buildBoards([assignment({ scope: 'chapter', chapterId: 'c-atx' })], names)
    expect(boards.map(b => b.id)).toEqual(['chapter:c-atx'])
  })

  it('orders National, then regions, then chapters, each by name', () => {
    const boards = buildBoards([
      assignment({ personId: 'a', scope: 'chapter', chapterId: 'c-hou' }),
      assignment({ personId: 'b', scope: 'chapter', chapterId: 'c-atx' }),
      assignment({ personId: 'c', scope: 'regional', regionId: 'r-tx' }),
      assignment({ personId: 'd', scope: 'regional', regionId: 'r-ca' }),
      assignment({ personId: 'e' }),
    ], names)
    expect(boards.map(b => b.label)).toEqual([
      'National Board',
      'California Region Board',
      'Texas Region Board',
      'Austin Chapter Board',
      'Houston Chapter Board',
    ])
  })

  it('falls back to the scope word when the area has no name', () => {
    // Only reachable when the names read partly failed. Printing a uuid would be worse.
    const boards = buildBoards(
      [assignment({ scope: 'chapter', chapterId: 'c-unknown' })],
      { regionNames: new Map(), chapterNames: new Map() },
    )
    expect(boards[0].label).toBe('Chapter Board')
  })
})

describe('buildPositions', () => {
  it('takes one office across every area that fills it', () => {
    const positions = buildPositions([
      assignment({ personId: 'p1', roleId: 'role-pres-ch', scope: 'chapter', chapterId: 'c-atx' }),
      assignment({ personId: 'p2', roleId: 'role-pres-ch', scope: 'chapter', chapterId: 'c-hou' }),
    ])
    expect(positions).toHaveLength(1)
    expect(positions[0].personIds).toEqual(['p1', 'p2'])
  })

  it('says the scope in the caption, so two Presidents are told apart', () => {
    // A family may define President at more than one scope; `family_roles` is unique on
    // (family_code, name, scope), so the two are different rows with the same name. Without
    // the scope word the picker would show two identical options.
    const positions = buildPositions([
      assignment({ roleId: 'role-pres-nat', roleName: 'President', scope: 'national' }),
      assignment({
        personId: 'p2', roleId: 'role-pres-ch', roleName: 'President',
        scope: 'chapter', chapterId: 'c-atx',
      }),
    ])
    expect(positions.map(p => p.label)).toEqual(['National President', 'Chapter President'])
  })

  it('lists only offices somebody holds', () => {
    expect(buildPositions([])).toEqual([])
  })
})

describe('resolveBoardAttendees', () => {
  const boards = buildBoards([
    assignment({ personId: 'p1', personName: 'Ada' }),
    assignment({ personId: 'p2', personName: 'Ben', roleId: 'role-tre-nat', roleName: 'Treasurer' }),
    assignment({
      personId: 'p2', personName: 'Ben', roleId: 'role-pres-ch', roleName: 'President',
      scope: 'chapter', chapterId: 'c-atx',
    }),
    assignment({
      personId: 'p3', personName: 'Cara', roleId: 'role-pres-ch', roleName: 'President',
      scope: 'chapter', chapterId: 'c-hou',
    }),
  ], names)
  const positions = buildPositions([
    assignment({ personId: 'p1', personName: 'Ada' }),
    assignment({ personId: 'p2', personName: 'Ben', roleId: 'role-tre-nat', roleName: 'Treasurer' }),
    assignment({
      personId: 'p2', personName: 'Ben', roleId: 'role-pres-ch', roleName: 'President',
      scope: 'chapter', chapterId: 'c-atx',
    }),
    assignment({
      personId: 'p3', personName: 'Cara', roleId: 'role-pres-ch', roleName: 'President',
      scope: 'chapter', chapterId: 'c-hou',
    }),
  ])

  it('is empty when nothing is chosen', () => {
    expect(resolveBoardAttendees({ boardIds: [], positionIds: [], boards, positions })).toEqual([])
  })

  it('unions rather than intersects', () => {
    // The National Board is Ada and Ben; the Chapter President position is Ben and Cara.
    // An intersection would be Ben alone, which is the wrong reading of an invitation list.
    const out = resolveBoardAttendees({
      boardIds: ['national'], positionIds: ['role-pres-ch'], boards, positions,
    })
    expect([...out].sort()).toEqual(['p1', 'p2', 'p3'])
  })

  it('invites somebody on two of the chosen things once', () => {
    const out = resolveBoardAttendees({
      boardIds: ['national', 'chapter:c-atx'], positionIds: [], boards, positions,
    })
    expect([...out].sort()).toEqual(['p1', 'p2'])
  })

  it('ignores an id that matches nothing rather than failing', () => {
    // These arrive from a client and the options are derived from live assignments, so a
    // board that emptied while the dialog was open names nobody.
    const out = resolveBoardAttendees({
      boardIds: ['chapter:gone'], positionIds: ['role-gone'], boards, positions,
    })
    expect(out).toEqual([])
  })
})
