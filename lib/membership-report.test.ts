import { describe, expect, it } from 'vitest'
import { isMinorOn } from '@/lib/age-utils'
import {
  buildMembershipReport, foldForChart, sharePercent,
  NATIONAL_KEY, NO_CHAPTER_KEY,
  type ReportPerson, type ReportChapter, type ReportRegion,
} from '@/lib/membership-report'

/**
 * AGENTS.md §7b: this is the arithmetic half, and it runs under `npm test` rather than
 * `npm run test:rls`. The RLS suite calls `getMembershipReport` for real against real
 * policies and asserts what the FAMILY SCOPING selected; it cannot check a figure, because
 * its fixture seeds six people and no dates worth arguing about.
 *
 * ── SEEN TO FAIL, which §7b says is the only thing that makes a green run evidence ──
 * Each of these was checked by mutating lib/membership-report.ts and re-running:
 *
 *   drop the `regionCounts.has(regionId)` guard         'a chapter in a foreign region' goes red
 *   count a null birthday as an adult                   'a birthday nobody recorded' goes red
 *   sort byInvitation by size                           'the progression is never re-sorted'
 *   seed chapterCounts from people instead of chapters  'a chapter nobody is in' goes red
 *   `age < 18` -> `age <= 18` in isMinorOn              'the eighteenth birthday' goes red
 *   drop the `.filter(s => s.count > 0)` in foldForChart 'an empty slice is not drawn'
 */

const person = (over: Partial<ReportPerson> & { id: string }): ReportPerson => ({
  chapterId: null, dateOfBirth: null, hasAccount: true, ...over,
})
const NOW = '2026-08-20'
const build = (
  people: ReportPerson[],
  chapters: ReportChapter[] = [],
  regions: ReportRegion[] = [],
  invitedIds: Set<string> = new Set(),
) => buildMembershipReport({ people, chapters, regions, invitedIds, today: NOW })

describe('sharePercent', () => {
  it('is zero against an empty family rather than NaN', () => {
    // The division that a family with no approved members would otherwise do. NaN renders
    // as the literal string "NaN%" on a card, which is the shape of bug that ships.
    expect(sharePercent(0, 0)).toBe(0)
  })

  it('rounds, and the rounded shares are not expected to sum to 100', () => {
    expect(sharePercent(1, 3)).toBe(33)
    expect([1, 1, 1].map(n => sharePercent(n, 3)).reduce((a, b) => a + b)).toBe(99)
  })
})

describe('buildMembershipReport — geography', () => {
  const regions: ReportRegion[] = [{ id: 'r-east', name: 'East' }, { id: 'r-west', name: 'West' }]
  const chapters: ReportChapter[] = [
    { id: 'c-atl', name: 'Atlanta', regionId: 'r-east' },
    { id: 'c-sfo', name: 'San Francisco', regionId: 'r-west' },
    { id: 'c-loose', name: 'Unassigned chapter', regionId: null },
  ]

  it('counts a member into their chapter and the region above it', () => {
    const r = build([person({ id: 'a', chapterId: 'c-atl' })], chapters, regions)
    expect(r.byChapter.find(s => s.key === 'c-atl')?.count).toBe(1)
    expect(r.byRegion.find(s => s.key === 'r-east')?.count).toBe(1)
    expect(r.byRegion.find(s => s.key === 'r-west')?.count).toBe(0)
  })

  it('puts a member with no chapter under National', () => {
    const r = build([person({ id: 'a' })], chapters, regions)
    expect(r.byRegion.find(s => s.key === NATIONAL_KEY)?.count).toBe(1)
    expect(r.byChapter.find(s => s.key === NO_CHAPTER_KEY)?.count).toBe(1)
  })

  it('puts a member whose CHAPTER has no region under National too — one fact, two causes', () => {
    const r = build([person({ id: 'a', chapterId: 'c-loose' })], chapters, regions)
    expect(r.byRegion.find(s => s.key === NATIONAL_KEY)?.count).toBe(1)
    // ...and they are still counted in their chapter, which they do have.
    expect(r.byChapter.find(s => s.key === 'c-loose')?.count).toBe(1)
  })

  it('a chapter in a foreign region falls to National rather than inventing a row', () => {
    // §4's shape arriving as data: a chapter whose `region_id` points at a region this
    // family does not have. Nothing may appear in the breakdown under an id the family
    // cannot name, and the person must still be counted somewhere.
    const foreign: ReportChapter[] = [{ id: 'c-x', name: 'Elsewhere', regionId: 'r-other-family' }]
    const r = build([person({ id: 'a', chapterId: 'c-x' })], foreign, regions)
    expect(r.byRegion.map(s => s.key)).not.toContain('r-other-family')
    expect(r.byRegion.find(s => s.key === NATIONAL_KEY)?.count).toBe(1)
    expect(r.total).toBe(1)
  })

  it('a chapter_id the family does not have is National and No chapter', () => {
    const r = build([person({ id: 'a', chapterId: 'deleted-or-foreign' })], chapters, regions)
    expect(r.byChapter.find(s => s.key === NO_CHAPTER_KEY)?.count).toBe(1)
    expect(r.byRegion.find(s => s.key === NATIONAL_KEY)?.count).toBe(1)
  })

  it('lists a chapter nobody is in, and a region with no chapters', () => {
    // The fact an organizer opens this screen for. The retired /admin/reports derived its
    // chapter list from the people, so an empty chapter did not exist as far as it knew.
    const r = build([person({ id: 'a', chapterId: 'c-atl' })], chapters, regions)
    expect(r.byChapter.find(s => s.key === 'c-sfo')).toMatchObject({ count: 0 })
    expect(r.byRegion.find(s => s.key === 'r-west')).toMatchObject({ count: 0 })
    expect(r.chapterCount).toBe(3)
    expect(r.regionCount).toBe(2)
  })

  it('orders biggest first, breaks a tie by name, and keeps the leftover last', () => {
    const people = [
      person({ id: '1', chapterId: 'c-sfo' }), person({ id: '2', chapterId: 'c-sfo' }),
      person({ id: '3', chapterId: 'c-atl' }), person({ id: '4', chapterId: 'c-loose' }),
      person({ id: '5' }), person({ id: '6' }), person({ id: '7' }),
    ]
    const r = build(people, chapters, regions)
    expect(r.byChapter.map(s => s.label)).toEqual([
      'San Francisco',        // 2
      'Atlanta',              // 1, ties with Unassigned chapter and wins on the name
      'Unassigned chapter',   // 1
      'No chapter',           // 3 — LAST despite being the biggest, being a leftover
    ])
    expect(r.byChapter.at(-1)).toMatchObject({ key: NO_CHAPTER_KEY, count: 3 })
    expect(r.byRegion.at(-1)).toMatchObject({ key: NATIONAL_KEY, count: 4 })
  })
})

describe('buildMembershipReport — invitations', () => {
  it('splits Active, Invited and Pending invite off the one shared rule', () => {
    const r = build([
      person({ id: 'has-account', hasAccount: true }),
      person({ id: 'asked', hasAccount: false }),
      person({ id: 'unasked', hasAccount: false }),
    ], [], [], new Set(['asked']))
    expect(r.byInvitation.map(s => [s.label, s.count])).toEqual([
      ['Active', 1], ['Invited', 1], ['Pending invite', 1],
    ])
  })

  it('an account beats a stale open invitation', () => {
    // `invitedPersonIds` already drops these, and `memberStatus` ignores the flag for
    // anybody with an account. Asserted here so the two cannot drift apart in this
    // direction either: somebody who joined by another door is Active, never Invited.
    const r = build([person({ id: 'a', hasAccount: true })], [], [], new Set(['a']))
    expect(r.byInvitation.find(s => s.label === 'Invited')?.count).toBe(0)
    expect(r.byInvitation.find(s => s.label === 'Active')?.count).toBe(1)
  })

  it('the progression is never re-sorted by size', () => {
    const r = build([
      person({ id: 'u1', hasAccount: false }), person({ id: 'u2', hasAccount: false }),
      person({ id: 'u3', hasAccount: false }), person({ id: 'a', hasAccount: true }),
    ])
    // Pending invite is three of the four and still prints last.
    expect(r.byInvitation.map(s => s.label)).toEqual(['Active', 'Invited', 'Pending invite'])
  })
})

describe('buildMembershipReport — adults and minors', () => {
  it('a birthday nobody recorded is its own bucket, not an adult', () => {
    const r = build([person({ id: 'a', dateOfBirth: null })])
    expect(r.byAge.find(s => s.label === 'Birthday not recorded')?.count).toBe(1)
    expect(r.byAge.find(s => s.label === 'Adults')?.count).toBe(0)
  })

  it('counts a child as a minor and a grandparent as an adult', () => {
    const r = build([
      person({ id: 'kid', dateOfBirth: '2015-06-01' }),
      person({ id: 'gran', dateOfBirth: '1948-03-12' }),
    ])
    expect(r.byAge.find(s => s.label === 'Minors')?.count).toBe(1)
    expect(r.byAge.find(s => s.label === 'Adults')?.count).toBe(1)
  })

  it('the eighteenth birthday itself is an adult, and the day before is not', () => {
    // The edge the whole `today`-as-a-parameter split exists for. Against NOW =
    // 2026-08-20, somebody born 2008-08-20 turns 18 today.
    expect(isMinorOn('2008-08-20', NOW)).toBe(false)
    expect(isMinorOn('2008-08-21', NOW)).toBe(true)
  })

  it('a leap-day birthday resolves on 1 March in a common year', () => {
    // 2009-02-29 has no anniversary in 2027, so the cutoff falls on the 28th and the
    // person stays a minor for that one extra day. Treating 28 February as the
    // anniversary instead would make somebody an adult on a date that is not their
    // birthday.
    expect(isMinorOn('2008-02-29', NOW)).toBe(false)
    expect(isMinorOn('2009-02-29', '2027-02-28')).toBe(true)
  })
})

describe('buildMembershipReport — an empty family', () => {
  it('answers zeroes rather than dividing by nothing', () => {
    const r = build([])
    expect(r.total).toBe(0)
    expect(r.byRegion).toEqual([{ key: NATIONAL_KEY, label: 'National', count: 0, percent: 0 }])
    expect(r.byAge.every(s => s.count === 0 && s.percent === 0)).toBe(true)
  })
})

describe('foldForChart', () => {
  const slice = (label: string, count: number) => ({ key: label, label, count, percent: 0 })

  it('draws every slice while they still fit', () => {
    const slices = [slice('a', 5), slice('b', 4), slice('c', 3)]
    expect(foldForChart(slices).map(s => s.label)).toEqual(['a', 'b', 'c'])
  })

  it('keeps the sixth rather than folding one slice into an Other of one', () => {
    const slices = [1, 2, 3, 4, 5, 6].map(n => slice(`c${n}`, 10 - n))
    expect(foldForChart(slices)).toHaveLength(6)
    expect(foldForChart(slices).map(s => s.label)).not.toContain('Other (1)')
  })

  it('folds the tail, says how many it stands for, and keeps the total honest', () => {
    const slices = [1, 2, 3, 4, 5, 6, 7, 8].map(n => slice(`c${n}`, 10))
    const folded = foldForChart(slices)
    expect(folded).toHaveLength(6)
    expect(folded.at(-1)).toMatchObject({ label: 'Other (3)', count: 30 })
    expect(folded.reduce((sum, s) => sum + s.count, 0)).toBe(80)
  })

  it('an empty slice is not drawn, but is still counted in the whole', () => {
    // A zero-degree segment is a legend entry pointing at nothing. The chapter with nobody
    // in it belongs in the table beside the chart, which is where the screen puts it.
    const slices = [slice('a', 6), slice('empty', 0), slice('b', 4)]
    expect(foldForChart(slices).map(s => s.label)).toEqual(['a', 'b'])
  })

  it('percentages on the folded slice are a share of everything, not of what is drawn', () => {
    const slices = [1, 2, 3, 4, 5, 6, 7].map(n => slice(`c${n}`, n === 7 ? 50 : 10))
    // 5 kept (10 each), tail is c6 + c7 = 60 of a 110 total.
    expect(foldForChart(slices).at(-1)).toMatchObject({ label: 'Other (2)', count: 60, percent: 55 })
  })
})
