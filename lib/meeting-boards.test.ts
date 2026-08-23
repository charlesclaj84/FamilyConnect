import { describe, expect, it } from 'vitest'
import {
  boardKey, buildBoards, buildChapters, buildPositions, resolveMeetingRoom,
  type BoardAssignment, type MeetingBodies,
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
 *   * make `resolveMeetingRoom` intersect               → "unions rather than intersects"
 *   * drop the de-duplication (`Set`)                   → "somebody on two boards is invited once"
 *   * drop `buildChapters`' `chapterNames.has` guard    → "drops a chapter it has no name for"
 *   * make `wholeFamily` read a client-sent list        → n/a: there is no such list. See the
 *       `everyoneIds` note — that is the point of it being a boolean.
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

describe('buildChapters', () => {
  const person = (personId: string, personName: string, chapterId: string | null) =>
    ({ personId, personName, chapterId })

  it('groups the adults of each chapter, by name, chapters in caption order', () => {
    const out = buildChapters([
      person('p3', 'Cara', 'c-hou'),
      person('p1', 'Ben', 'c-atx'),
      person('p2', 'Ada', 'c-atx'),
    ], names.chapterNames)
    expect(out).toEqual([
      { id: 'c-atx', label: 'Austin Chapter', personIds: ['p2', 'p1'] },
      { id: 'c-hou', label: 'Houston Chapter', personIds: ['p3'] },
    ])
  })

  it('offers no chapter that nobody is in', () => {
    // Two chapters are named; only one has anybody recorded in it. Offering the other is
    // offering a control that selects nobody — `buildBoards`' rule, applied to a place.
    const out = buildChapters([person('p1', 'Ada', 'c-atx')], names.chapterNames)
    expect(out.map(c => c.id)).toEqual(['c-atx'])
  })

  it('leaves somebody in no chapter out of every chapter', () => {
    // Correct rather than a gap: they are reached by the whole family or by name. A "no
    // chapter" pseudo-body would be a body nobody in the family has heard of.
    expect(buildChapters([person('p1', 'Ada', null)], names.chapterNames)).toEqual([])
  })

  it('drops a chapter it has no name for rather than captioning a uuid', () => {
    // Every read feeding this is family-scoped, so an unknown id means the chapters read
    // partly failed — and a body captioned with a uuid is one nobody can decide about.
    const out = buildChapters([
      person('p1', 'Ada', 'c-atx'),
      person('p2', 'Ben', 'c-unknown'),
    ], names.chapterNames)
    expect(out.map(c => c.id)).toEqual(['c-atx'])
  })

  it('counts one person once, however many rows name them', () => {
    const out = buildChapters([
      person('p1', 'Ada', 'c-atx'),
      person('p1', 'Ada', 'c-atx'),
    ], names.chapterNames)
    expect(out[0].personIds).toEqual(['p1'])
  })

  it('reads an empty roster as no chapters', () => {
    expect(buildChapters([], names.chapterNames)).toEqual([])
  })
})

describe('resolveMeetingRoom', () => {
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

  const chapters = buildChapters([
    { personId: 'p2', personName: 'Ben', chapterId: 'c-atx' },
    { personId: 'p4', personName: 'Dele', chapterId: 'c-atx' },
  ], names.chapterNames)

  const bodies: MeetingBodies = {
    boards, positions, chapters,
    everyoneIds: ['p1', 'p2', 'p3', 'p4', 'p5'],
  }

  it('is empty when nothing is chosen', () => {
    expect(resolveMeetingRoom({}, bodies)).toEqual([])
    expect(resolveMeetingRoom({ boardIds: [], positionIds: [] }, bodies)).toEqual([])
  })

  it('unions rather than intersects', () => {
    // The National Board is Ada and Ben; the Chapter President position is Ben and Cara.
    // An intersection would be Ben alone, which is the wrong reading of an invitation list.
    const out = resolveMeetingRoom({ boardIds: ['national'], positionIds: ['role-pres-ch'] }, bodies)
    expect([...out].sort()).toEqual(['p1', 'p2', 'p3'])
  })

  it('invites somebody on two of the chosen things once', () => {
    const out = resolveMeetingRoom({ boardIds: ['national', 'chapter:c-atx'] }, bodies)
    expect([...out].sort()).toEqual(['p1', 'p2'])
  })

  it('resolves a chapter to its whole adult membership, not to its board', () => {
    // `chapter:c-atx` (the BOARD) is Ben alone, because he is the only officer there. The
    // CHAPTER is Ben and Dele. Two different rooms from one place, which is why both bodies
    // exist — and the ids cannot collide, since a board key is prefixed.
    expect([...resolveMeetingRoom({ boardIds: ['chapter:c-atx'] }, bodies)].sort()).toEqual(['p2'])
    expect([...resolveMeetingRoom({ chapterIds: ['c-atx'] }, bodies)].sort()).toEqual(['p2', 'p4'])
  })

  it('resolves the whole family from the server-built list, not from anything sent', () => {
    // `wholeFamily` is a boolean precisely so there is no list for a client to substitute —
    // "THE CLIENT NAMES BODIES AND NEVER SENDS PEOPLE".
    expect([...resolveMeetingRoom({ wholeFamily: true }, bodies)].sort())
      .toEqual(['p1', 'p2', 'p3', 'p4', 'p5'])
    expect(resolveMeetingRoom({ wholeFamily: false }, bodies)).toEqual([])
  })

  it('still de-duplicates when the whole family is chosen alongside a body', () => {
    const out = resolveMeetingRoom({ wholeFamily: true, boardIds: ['national'] }, bodies)
    expect(out).toHaveLength(5)
  })

  it('ignores an id that matches nothing rather than failing', () => {
    // These arrive from a client and the options are derived from live assignments, so a
    // board that emptied while the dialog was open names nobody — and a chapter id from
    // another family was never in `chapters` to begin with.
    const out = resolveMeetingRoom({
      boardIds: ['chapter:gone'], positionIds: ['role-gone'], chapterIds: ['c-other-family'],
    }, bodies)
    expect(out).toEqual([])
  })
})
