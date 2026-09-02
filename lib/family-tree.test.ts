import { describe, expect, it } from 'vitest'
import { generationLabel, generationsFrom, type TreeLink } from './family-tree'

/**
 * ── WHAT USED TO BE HERE, AND WHY IT IS NOT ─────────────────────────────────────────
 * Two thirds of this file tested a derivation `20260902000000` deleted: `bloodlineIds()`,
 * which walked `person_relationships.link_kind` out from `families.bloodline_anchor_id` to
 * work out who was in the family's bloodline, and `auditBloodlineAnchor()`, which existed
 * only to explain on screen why that walk kept answering wrong.
 *
 * The bloodline is `people.is_bloodline` now — one column, stated by the family — so there
 * is no graph property left to check. What those suites were EVIDENCE FOR is worth knowing
 * before anybody reintroduces a walk, and all of it is preserved in that migration's
 * header rather than dropped: the connected-component walk that put a member's own wife in
 * his bloodline, the shared-ancestor rule that replaced it, why a sibling edge must not
 * conduct, and the monotonicity argument that killed the tempting narrow fix.
 *
 * ── WHAT IS LEFT IS THE CANVAS'S OWN GEOMETRY, AND IT NEVER ASKED ABOUT BLOOD ───────
 * `generationsFrom` and `generationLabel` are what draw the bands. They walked `parent`
 * and `child` edges and ignored the kind on them before, deliberately — a step-child is
 * still a child and belongs on the canvas — so removing the kind changed nothing here
 * except that `TreeLink` is one field smaller.
 */

/**
 * An edge in the direction `getFamilyTree` normalizes to.
 *
 *   `relation: 'parent'` reads "`to` is `from`'s parent", so `up` points UPWARD.
 *
 * Both helpers used to take a third argument — the link's `kind` — which every caller
 * defaulted to 'blood'. `20260902000000` removed the column; an edge is now two people and
 * a direction.
 */
const up = (from: string, to: string): TreeLink => ({ from, to, relation: 'parent' })
const down = (from: string, to: string): TreeLink => ({ from, to, relation: 'child' })

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
      { from: 'charles', to: 'sandra', relation: 'spouse' },
      { from: 'charles', to: 'ada', relation: 'sibling' },
    ]
    expect(generationsFrom(DEEP_PEOPLE, edges, 'charles', 'parent', 3)).toEqual([])
    expect(generationsFrom(DEEP_PEOPLE, edges, 'charles', 'child', 3)).toEqual([])
  })

  it('follows EVERY child edge, whatever the family calls the relationship', () => {
    // This used to read "DOES follow a step link", and the edge carried `kind: 'step'` to
    // prove the walk ignored it. `20260902000000` took the kind off the edge, so the claim
    // is structural now — but the assertion it was really making is kept: the Children band
    // holds every child, and which relatives are on screen at all is the Bloodline filter's
    // job, applied by the caller handing this function an already-filtered PEOPLE list.
    expect(generationsFrom(DEEP_PEOPLE, [down('charles', 'ada')], 'charles', 'child', 2))
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
