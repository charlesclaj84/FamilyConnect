import { describe, expect, it } from 'vitest'
import {
  electionAreaMatch,
  electionScope,
  electionScopeLabel,
  inElectionArea,
  rolesForScope,
} from './election-area'

/**
 * The audience rule, and the level match that stops the three levels cross-pollinating.
 *
 * A GREEN RUN IS NOT EVIDENCE UNTIL YOU HAVE SEEN IT FAIL (AGENTS.md §7b). Applied one at a
 * time to `lib/election-area.ts`:
 *
 *   the `if (!chapterId) return 'no-chapter'` guard deleted
 *       trips "a member in no chapter is under National" for both scoped levels — the case
 *       that decides whether an unplaced relative is handed somebody else's ballot
 *   `memberRegion !== null &&` dropped from the regional branch
 *       trips "a chapter under National is not in every region"
 *   `electionScope` defaulting to 'chapter' instead of 'national'
 *       trips "an unrecognized scope reads as National"
 *   `rolesForScope`'s null-scope normalization deleted
 *       trips "an office with no scope recorded is National"
 *
 * The mirror of this rule lives in SQL — `election_area_includes()` in 20260821000001 — and
 * that migration's own verify block exercises the same four cases against a real person row.
 * Both were written from the same list on purpose.
 */

/** Two chapters in one region, one chapter under National, all in one family. */
const REGIONS = new Map<string, string | null>([
  ['chapter-austin', 'region-texas'],
  ['chapter-dallas', 'region-texas'],
  ['chapter-atlanta', 'region-south'],
  ['chapter-loose', null],
])

const NATIONAL = { scope: 'national', region_id: null, chapter_id: null }
const TEXAS = { scope: 'regional', region_id: 'region-texas', chapter_id: null }
const AUSTIN = { scope: 'chapter', region_id: null, chapter_id: 'chapter-austin' }

// `memberChapterId` is widened to include `undefined` on purpose: `people.chapter_id` arrives
// from a projection that may not have selected it, and "the column was not read" must land in
// the same branch as "they are in no chapter" rather than in a scoped election.
const match = (election: Parameters<typeof electionAreaMatch>[0]['election'],
  memberChapterId: string | null | undefined) =>
  electionAreaMatch({ election, memberChapterId, chapterRegions: REGIONS })

describe('electionScope', () => {
  it('reads the three levels', () => {
    expect(electionScope({ scope: 'national' })).toBe('national')
    expect(electionScope({ scope: 'regional' })).toBe('regional')
    expect(electionScope({ scope: 'chapter' })).toBe('chapter')
  })

  it('reads anything else as National', () => {
    // Failing toward National is the deliberate direction — the OPPOSITE of the direction
    // `electionPhase` fails in, and the comment on this function says why.
    expect(electionScope({ scope: null })).toBe('national')
    expect(electionScope({ scope: 'planetary' })).toBe('national')
    expect(electionScope({})).toBe('national')
  })
})

describe('electionAreaMatch', () => {
  it('admits everybody to a national election', () => {
    expect(match(NATIONAL, 'chapter-austin')).toBe('in')
    expect(match(NATIONAL, 'chapter-atlanta')).toBe('in')
    expect(match(NATIONAL, null)).toBe('in')
  })

  it('admits a chapter to its own election and nobody else', () => {
    expect(match(AUSTIN, 'chapter-austin')).toBe('in')
    expect(match(AUSTIN, 'chapter-dallas')).toBe('other-chapter')
    expect(match(AUSTIN, 'chapter-atlanta')).toBe('other-chapter')
  })

  it('admits a region through the member\'s chapter', () => {
    expect(match(TEXAS, 'chapter-austin')).toBe('in')
    expect(match(TEXAS, 'chapter-dallas')).toBe('in')
    expect(match(TEXAS, 'chapter-atlanta')).toBe('other-region')
  })

  it('puts a member in no chapter under National', () => {
    // The safe direction and the only coherent one: there is no region to compare against,
    // and an unplaced relative must never be handed a chapter's ballot.
    expect(match(AUSTIN, null)).toBe('no-chapter')
    expect(match(TEXAS, null)).toBe('no-chapter')
    expect(match(AUSTIN, undefined)).toBe('no-chapter')
  })

  it('does not put a chapter under National into every region', () => {
    // `chapter-loose` maps to null. Without the `memberRegion !== null` conjunct a regional
    // election with a null region_id — a row the CHECK refuses — would enfranchise them, and
    // so would every region whose id happened to be missing from the map.
    expect(match(TEXAS, 'chapter-loose')).toBe('other-region')
    expect(electionAreaMatch({
      election: { scope: 'regional', region_id: null, chapter_id: null },
      memberChapterId: 'chapter-loose',
      chapterRegions: REGIONS,
    })).toBe('other-region')
  })

  it('treats a chapter the family does not have as outside every region', () => {
    expect(match(TEXAS, 'chapter-nobody-has')).toBe('other-region')
    expect(match(AUSTIN, 'chapter-nobody-has')).toBe('other-chapter')
  })
})

describe('inElectionArea', () => {
  it('filters a list to the elections one member may see', () => {
    const all = [NATIONAL, TEXAS, AUSTIN]
    expect(all.filter(inElectionArea('chapter-austin', REGIONS))).toEqual([NATIONAL, TEXAS, AUSTIN])
    expect(all.filter(inElectionArea('chapter-dallas', REGIONS))).toEqual([NATIONAL, TEXAS])
    expect(all.filter(inElectionArea('chapter-atlanta', REGIONS))).toEqual([NATIONAL])
    expect(all.filter(inElectionArea(null, REGIONS))).toEqual([NATIONAL])
  })
})

describe('electionScopeLabel', () => {
  it('names the region or chapter rather than the level', () => {
    expect(electionScopeLabel(NATIONAL)).toBe('National')
    expect(electionScopeLabel(TEXAS, { region: 'Texas Region' })).toBe('Texas Region')
    expect(electionScopeLabel(AUSTIN, { chapter: 'Austin' })).toBe('Austin')
  })

  it('falls back to the level rather than to an empty string', () => {
    // A caller without `admin/members/organization:view` cannot resolve the name. A gap where
    // a fact belongs reads as a rendering failure; "One chapter" reads as what it is.
    expect(electionScopeLabel(AUSTIN)).toBe('One chapter')
    expect(electionScopeLabel(TEXAS, { region: null })).toBe('One region')
    expect(electionScopeLabel(AUSTIN, { chapter: '' })).toBe('One chapter')
  })
})

describe('rolesForScope', () => {
  const ROLES = [
    { name: 'President', scope: 'national' },
    { name: 'Treasurer', scope: null },
    { name: 'Regional Chair', scope: 'regional' },
    { name: 'Chapter Secretary', scope: 'chapter' },
  ]

  it('offers only the offices belonging to that level', () => {
    expect(rolesForScope(ROLES, 'chapter').map(r => r.name)).toEqual(['Chapter Secretary'])
    expect(rolesForScope(ROLES, 'regional').map(r => r.name)).toEqual(['Regional Chair'])
  })

  it('reads an office with no scope recorded as National', () => {
    // Matching `family_roles.scope`'s own NOT NULL DEFAULT 'national'. Dropping the
    // normalization loses Treasurer from every list, which is a silently shorter picker.
    expect(rolesForScope(ROLES, 'national').map(r => r.name)).toEqual(['President', 'Treasurer'])
  })

  it('answers an empty list rather than everything when nothing matches', () => {
    expect(rolesForScope([{ name: 'President', scope: 'national' }], 'chapter')).toEqual([])
  })
})
