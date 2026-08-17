import { describe, expect, it } from 'vitest'
import { auditBloodlineAnchor, bloodlineIds, type TreeLink } from './family-tree'

/**
 * The bloodline anchor audit.
 *
 * WHY THESE TESTS EXIST: the reported case is a family created by a SON. Anchored on him,
 * the walk goes up through both his parents, so his mother — who married in and has since
 * divorced — comes back as a blood relative of the family's line. That is not a bug in
 * `bloodlineIds`: a mother and son ARE blood relatives, which is the question it answers.
 * It is the anchor standing one generation too low, and nothing on screen said so.
 *
 * `auditBloodlineAnchor` is what says so, and every case below is a property of a graph
 * with no dates and no clock in it — which is what makes it checkable at all.
 */

/**
 * The reported family, in the direction `getFamilyTree` normalizes to.
 *
 *   `relation: 'parent'` reads "`to` is `from`'s parent", so an edge points UPWARD.
 *
 *   samuel ──┐
 *            ├── charles ── (married, then divorced) ── sandra
 *   sandra ──┘      │
 *                   └── ada
 *
 * Charles registered the family, so he is the default anchor. Samuel is the blood line;
 * Sandra married into it.
 */
const up = (from: string, to: string, kind: TreeLink['kind'] = 'blood'): TreeLink =>
  ({ from, to, relation: 'parent', kind })
const down = (from: string, to: string, kind: TreeLink['kind'] = 'blood'): TreeLink =>
  ({ from, to, relation: 'child', kind })

const PEOPLE = [
  { id: 'samuel' }, { id: 'sandra' }, { id: 'charles' }, { id: 'ada' }, { id: 'nia' },
]

/** Both directions of every stored row, exactly as the reader hands them over. */
const EDGES: TreeLink[] = [
  up('charles', 'samuel'), down('samuel', 'charles'),
  up('charles', 'sandra'), down('sandra', 'charles'),
  up('ada', 'charles'), down('charles', 'ada'),
  // Charles's current wife. A marriage is never blood and is not walked at all.
  { from: 'charles', to: 'nia', relation: 'spouse', kind: 'step' },
  { from: 'nia', to: 'charles', relation: 'spouse', kind: 'step' },
]

describe('the reported case: the anchor is one generation too low', () => {
  it('reports the anchor’s own parents, which is what makes it too low', () => {
    const audit = auditBloodlineAnchor(PEOPLE, EDGES, 'charles')

    expect(audit).not.toBeNull()
    expect(audit!.parentIds.sort()).toEqual(['samuel', 'sandra'])
  })

  it('offers the top of each line the anchor descends from', () => {
    // Two, and choosing between them is the fact only the family knows — which is why
    // nothing picks one and both are offered.
    expect(auditBloodlineAnchor(PEOPLE, EDGES, 'charles')!.rootIds.sort())
      .toEqual(['samuel', 'sandra'])
  })

  it('confirms the symptom: anchored on the son, the ex-wife is blood', () => {
    const blood = bloodlineIds(PEOPLE, EDGES, 'charles')!
    expect(blood.has('sandra')).toBe(true)
    expect(blood.has('samuel')).toBe(true)
  })

  it('and the cure: anchored on the father, she is not — and nobody else is lost', () => {
    const blood = bloodlineIds(PEOPLE, EDGES, 'samuel')!

    expect(blood.has('sandra')).toBe(false)
    // The son, his daughter and the father himself all keep it: their ancestors still run
    // up through Samuel.
    expect(blood.has('charles')).toBe(true)
    expect(blood.has('ada')).toBe(true)
    expect(blood.has('samuel')).toBe(true)
    // The current wife was never in it, from either anchor.
    expect(blood.has('nia')).toBe(false)
  })
})

describe('when the anchor is standing in the right place', () => {
  it('reports no parents, so the caller says nothing', () => {
    const audit = auditBloodlineAnchor(PEOPLE, EDGES, 'samuel')

    expect(audit!.parentIds).toEqual([])
    // The anchor is its own root. Callers test `parentIds` rather than this, which is why
    // returning the anchor here is safe.
    expect(audit!.rootIds).toEqual(['samuel'])
  })
})

describe('which links count as a route upward', () => {
  it('ignores a step or adoptive parent — blood does not travel down it', () => {
    // Charles was adopted by Samuel. He is still Sandra's son by blood, so the audit sees
    // one parent rather than two, and Sandra alone tops the line.
    const edges: TreeLink[] = [
      up('charles', 'samuel', 'adopted'), down('samuel', 'charles', 'adopted'),
      up('charles', 'sandra'), down('sandra', 'charles'),
    ]
    const audit = auditBloodlineAnchor(PEOPLE, edges, 'charles')

    expect(audit!.parentIds).toEqual(['sandra'])
    expect(audit!.rootIds).toEqual(['sandra'])
  })

  it('ignores a marriage, so a spouse is never a route to a line', () => {
    const edges: TreeLink[] = [
      { from: 'charles', to: 'nia', relation: 'spouse', kind: 'blood' },
      { from: 'nia', to: 'charles', relation: 'spouse', kind: 'blood' },
    ]
    // 'blood' on a spouse edge is impossible in the database
    // (person_relationships_marriage_is_not_blood rewrites it) and is used here on purpose:
    // the walk must refuse it on the RELATION, not on the kind, or the one row that slipped
    // past the trigger would redraw the family's line.
    expect(auditBloodlineAnchor(PEOPLE, edges, 'charles')!.parentIds).toEqual([])
  })
})

describe('the answers that are not answers', () => {
  it('is null with no anchor, matching bloodlineIds', () => {
    expect(auditBloodlineAnchor(PEOPLE, EDGES, null)).toBeNull()
    expect(auditBloodlineAnchor(PEOPLE, EDGES, undefined)).toBeNull()
  })

  it('is null for an anchor who is not in this roster', () => {
    // The column is ON DELETE SET NULL and guarded to the family, so this should not
    // happen — and an audit reported against a person the walk cannot start from would be
    // a warning nobody could act on.
    expect(auditBloodlineAnchor(PEOPLE, EDGES, 'stranger')).toBeNull()
  })

  it('ignores an edge pointing at somebody outside the roster', () => {
    const edges: TreeLink[] = [...EDGES, up('charles', 'ghost')]
    expect(auditBloodlineAnchor(PEOPLE, edges, 'charles')!.parentIds.sort())
      .toEqual(['samuel', 'sandra'])
  })
})

describe('a graph that should not exist', () => {
  it('terminates on a cycle rather than walking forever', () => {
    // `person_relationships` has no constraint stopping somebody being recorded as their
    // own grandfather. An unguarded upward walk on this does not return a wrong answer —
    // it never returns, which is a hung render rather than a bad one.
    const edges: TreeLink[] = [
      up('charles', 'samuel'),
      up('samuel', 'ada'),
      up('ada', 'charles'),
    ]
    const audit = auditBloodlineAnchor(PEOPLE, edges, 'charles')

    expect(audit).not.toBeNull()
    expect(audit!.parentIds).toEqual(['samuel'])
    // Every step of the loop has a parent, so no line has a top. An empty list is the
    // honest reading, and the caller offers no suggestion rather than a wrong one.
    expect(audit!.rootIds).toEqual([])
  })

  it('walks three generations up and reports only the top', () => {
    const edges: TreeLink[] = [
      up('ada', 'charles'),
      up('charles', 'samuel'),
      up('samuel', 'nia'),
    ]
    const audit = auditBloodlineAnchor(PEOPLE, edges, 'ada')

    expect(audit!.parentIds).toEqual(['charles'])
    // Not Charles, and not Samuel — the top of the line, which is what the suggestion
    // button offers.
    expect(audit!.rootIds).toEqual(['nia'])
  })
})
