import { describe, expect, it } from 'vitest'
import {
  auditBloodlineAnchor, bloodlineIds, generationLabel, generationsFrom,
  type TreeLink,
} from './family-tree'

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

// ── The generation walk ─────────────────────────────────────────────────────────────
//
// The canvas used to hard-code four bands. It now generates them, which is what let View
// reach three generations up and five down while Edit stays at two and one. The depth being
// a parameter IS the change, so these check the walk at depth rather than at the one shape
// the old layout happened to have.

/**
 * Four generations, with a fork and a re-join.
 *
 *   nan ── pat            great-grandparents
 *      \  /
 *   samuel ── sandra      grandparents
 *        \   /
 *       charles           the focus
 *        /    \
 *      ada    ben         children
 *       |
 *      cy                 grandchild
 */
const DEEP_PEOPLE = [
  { id: 'nan' }, { id: 'pat' }, { id: 'samuel' }, { id: 'sandra' },
  { id: 'charles' }, { id: 'ada' }, { id: 'ben' }, { id: 'cy' },
]

/** Every stored row in both directions, as `getFamilyTree` hands them over. */
const DEEP_EDGES: TreeLink[] = [
  up('samuel', 'nan'), down('nan', 'samuel'),
  up('samuel', 'pat'), down('pat', 'samuel'),
  up('charles', 'samuel'), down('samuel', 'charles'),
  up('charles', 'sandra'), down('sandra', 'charles'),
  up('ada', 'charles'), down('charles', 'ada'),
  up('ben', 'charles'), down('charles', 'ben'),
  up('cy', 'ada'), down('ada', 'cy'),
]

describe('generationsFrom, walking up', () => {
  it('returns one band per generation, nearest first', () => {
    const bands = generationsFrom(DEEP_PEOPLE, DEEP_EDGES, 'charles', 'parent', 3)

    expect(bands.length).toBe(2)
    expect([...bands[0]].sort()).toEqual(['samuel', 'sandra'])
    // Sandra's own parents are not recorded, so the second band is Samuel's alone.
    expect([...bands[1]].sort()).toEqual(['nan', 'pat'])
  })

  it('honours the depth, which is what the two modes differ by', () => {
    // One band is Edit's own depth for the descendant side; here it proves the cut is real
    // rather than incidental — the great-grandparents exist and are not returned.
    expect(generationsFrom(DEEP_PEOPLE, DEEP_EDGES, 'charles', 'parent', 1).length).toBe(1)
    expect(generationsFrom(DEEP_PEOPLE, DEEP_EDGES, 'charles', 'parent', 2).length).toBe(2)
  })

  it('returns nothing at depth zero rather than the start person', () => {
    expect(generationsFrom(DEEP_PEOPLE, DEEP_EDGES, 'charles', 'parent', 0)).toEqual([])
  })
})

describe('generationsFrom, walking down', () => {
  it('reaches a grandchild, which the four-band canvas could not draw at all', () => {
    const bands = generationsFrom(DEEP_PEOPLE, DEEP_EDGES, 'charles', 'child', 5)

    expect(bands.length).toBe(2)
    expect([...bands[0]].sort()).toEqual(['ada', 'ben'])
    expect(bands[1]).toEqual(['cy'])
  })

  it('stops at the first empty band rather than padding to the depth', () => {
    // Five asked for, two exist. A caller handed five would render three empty headings
    // under a family that has none of those generations.
    expect(generationsFrom(DEEP_PEOPLE, DEEP_EDGES, 'charles', 'child', 5).length).toBe(2)
  })
})

describe('a person is drawn once, at their nearest generation', () => {
  it('does not repeat somebody reachable at two distances', () => {
    // Twice within ONE band is caught by any dedupe at all, so this reaches Nan at two
    // DIFFERENT distances, which only a walk-wide `seen` catches: she is Samuel's mother
    // (distance 2) and also Pat's mother, and Pat is Samuel's other parent — so the naive
    // walk finds her again at distance 3 and draws the same woman in two generations.
    const edges: TreeLink[] = [...DEEP_EDGES, up('pat', 'nan'), down('nan', 'pat')]
    const bands = generationsFrom(DEEP_PEOPLE, edges, 'charles', 'parent', 3)

    expect([...bands[1]].sort()).toEqual(['nan', 'pat'])
    // Nearest wins, so there is no third band: everything above distance 2 has been drawn
    // already, the level comes back empty, and the walk stops.
    expect(bands.length).toBe(2)
    expect(bands.flat().filter(id => id === 'nan').length).toBe(1)
  })

  it('terminates on a cycle instead of walking forever', () => {
    const edges: TreeLink[] = [
      up('charles', 'samuel'), up('samuel', 'ada'), up('ada', 'charles'),
    ]
    expect(generationsFrom(DEEP_PEOPLE, edges, 'charles', 'parent', 5))
      .toEqual([['samuel'], ['ada']])
  })
})

describe('what the walk refuses to follow', () => {
  it('ignores the other relations, so a spouse or a sibling is never a generation', () => {
    const edges: TreeLink[] = [
      { from: 'charles', to: 'sandra', relation: 'spouse', kind: 'step' },
      { from: 'charles', to: 'ada', relation: 'sibling', kind: 'blood' },
    ]
    expect(generationsFrom(DEEP_PEOPLE, edges, 'charles', 'parent', 3)).toEqual([])
    expect(generationsFrom(DEEP_PEOPLE, edges, 'charles', 'child', 3)).toEqual([])
  })

  it('DOES follow a step link — a step-child is still a child', () => {
    // Which relatives are on screen at all is the Bloodline filter's job, and the caller
    // applies it by handing this function an already-filtered edge list. Filtering on kind
    // here as well would drop a step-son out of the Children band in the full-family view.
    expect(generationsFrom(DEEP_PEOPLE, [down('charles', 'ada', 'step')], 'charles', 'child', 2))
      .toEqual([['ada']])
  })

  it('ignores an edge pointing outside the roster', () => {
    const edges: TreeLink[] = [...DEEP_EDGES, down('charles', 'ghost')]
    expect([...generationsFrom(DEEP_PEOPLE, edges, 'charles', 'child', 2)[0]].sort())
      .toEqual(['ada', 'ben'])
  })

  it('returns nothing for a start person who is not in the roster', () => {
    expect(generationsFrom(DEEP_PEOPLE, DEEP_EDGES, 'stranger', 'parent', 3)).toEqual([])
  })
})

describe('generationLabel', () => {
  it('uses the words English has for the first three', () => {
    expect(generationLabel(1, 'up')).toBe('Parents')
    expect(generationLabel(2, 'up')).toBe('Grandparents')
    expect(generationLabel(3, 'up')).toBe('Great-grandparents')
    expect(generationLabel(1, 'down')).toBe('Children')
    expect(generationLabel(2, 'down')).toBe('Grandchildren')
    expect(generationLabel(3, 'down')).toBe('Great-grandchildren')
  })

  it('counts past them rather than stacking "great"', () => {
    // The two bands View adds below the ones English names. "Great-great-great-" makes the
    // reader count, and at five generations down nobody does it correctly.
    expect(generationLabel(4, 'down')).toBe('2nd great-grandchildren')
    expect(generationLabel(5, 'down')).toBe('3rd great-grandchildren')
    expect(generationLabel(4, 'up')).toBe('2nd great-grandparents')
  })

  it('falls back to a plain word for a distance that is not a band', () => {
    expect(generationLabel(0, 'up')).toBe('Ancestors')
    expect(generationLabel(0, 'down')).toBe('Descendants')
  })
})

/**
 * A SIBLING EDGE ALONE DOES NOT PUT ANYBODY IN THE BLOODLINE, AND THAT IS THE DESIGN.
 *
 * Reported 2026-09-01, in these words: a sister added as the BLOOD sister of a brother got
 * no droplet and did not appear under Bloodline.
 *
 * Nothing is wrong with the walk, and these tests exist so that nobody "fixes" it. Only
 * `parent` edges conduct — see `bloodlineIds`, which argues it at length from the case that
 * caused it: chaining a sibling edge onto a child edge once put a step-daughter in her
 * step-father's bloodline, because half-siblings really are blood to each other and simply
 * are not blood to each other's other parent.
 *
 * ── WHY THE RULE CANNOT BE RELAXED "JUST WHEN NOBODY HAS PARENTS" ───────────────────
 * The tempting narrow fix is to let a sibling edge conduct when NEITHER person has a
 * recorded parent, since there is then no other-parent for the bloodline to leak through.
 * It is wrong, and the third test below is what says so: it would make the answer
 * NON-MONOTONIC. Record the brother's father afterwards — a true fact, correctly entered —
 * and the edge would stop conducting, silently ejecting the sister from the bloodline she
 * was already in. Adding information must never take somebody out.
 *
 * What was actually broken was the SILENCE, and the fix is in `AddRelativeDialog`: it asks
 * whose children they are, and now says so when it has nobody to offer.
 */
describe('a blood sibling with no shared parent recorded', () => {
  const PEOPLE = [{ id: 'leroy' }, { id: 'sarah' }]

  // Exactly what `addRelative` writes for "Sarah is Leroy's blood sister" when Leroy has no
  // parents on the tree: the sibling edge and its mirror, and nothing else.
  const EDGES: TreeLink[] = [
    { from: 'leroy', to: 'sarah', relation: 'sibling', kind: 'blood' },
    { from: 'sarah', to: 'leroy', relation: 'sibling', kind: 'blood' },
  ]

  it('leaves her out — this is the reported symptom, and it is correct', () => {
    const blood = bloodlineIds(PEOPLE, EDGES, 'leroy')!
    expect(blood.has('leroy')).toBe(true)
    expect(blood.has('sarah')).toBe(false)
  })

  it('and recording one shared parent is what puts her in', () => {
    const withFather: TreeLink[] = [
      ...EDGES,
      { from: 'leroy', to: 'father', relation: 'parent', kind: 'blood' },
      { from: 'sarah', to: 'father', relation: 'parent', kind: 'blood' },
    ]
    const blood = bloodlineIds([...PEOPLE, { id: 'father' }], withFather, 'leroy')!
    expect(blood.has('sarah')).toBe(true)
    expect(blood.has('father')).toBe(true)
  })

  it('so the answer only ever GROWS as parents are recorded, never shrinks', () => {
    // The monotonicity argument above, asserted. Give Leroy a father and Sarah none — the
    // half-recorded state somebody passes through while typing — and Sarah is still out,
    // exactly as she was before. No relaxed rule may let this line flip her out of a set
    // she was already in.
    const halfway: TreeLink[] = [
      ...EDGES,
      { from: 'leroy', to: 'father', relation: 'parent', kind: 'blood' },
    ]
    const blood = bloodlineIds([...PEOPLE, { id: 'father' }], halfway, 'leroy')!
    expect(blood.has('sarah')).toBe(false)
    expect(blood.has('father')).toBe(true)
  })

  it('and a STEP sister stays out however the parents are recorded', () => {
    // The case the rule exists to protect, kept beside it: marking the link 'step' must be
    // decisive, and a shared parent link written as 'step' must not smuggle her back in.
    const stepEdges: TreeLink[] = [
      { from: 'leroy', to: 'sarah', relation: 'sibling', kind: 'step' },
      { from: 'sarah', to: 'leroy', relation: 'sibling', kind: 'step' },
      { from: 'leroy', to: 'father', relation: 'parent', kind: 'blood' },
      { from: 'sarah', to: 'father', relation: 'parent', kind: 'step' },
    ]
    const blood = bloodlineIds([...PEOPLE, { id: 'father' }], stepEdges, 'leroy')!
    expect(blood.has('sarah')).toBe(false)
  })
})
