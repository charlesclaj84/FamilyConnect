import { describe, expect, it } from 'vitest'
import { NATIONAL_KEY, NO_CHAPTER_KEY, buildMembershipReport } from './membership-report'
import {
  MEMBERSHIP_BREAKDOWNS, isMembershipBreakdown, mayRepair, sliceOffersRepair, sliceRepair,
  type MembershipBreakdown,
} from './membership-drill'

/**
 * Which slice of the Membership report offers a repair, and to whom.
 *
 * ── THE ONE ASSERTION THIS FILE EXISTS FOR ──────────────────────────────────────────
 * `lib/membership-drill.ts` names its actionable slices as STRING LITERALS, deliberately, and
 * says so — they are that module's answer to "which row offers a repair" rather than a copy of
 * `lib/membership-report.ts`'s answer to "which bucket did this person land in". Two lists that
 * happen to overlap is a fine arrangement right up until one of them is renamed, at which point
 * the drill-down silently stops offering the control on the one row that needed it. Nothing on
 * screen would say so: the dialog would open, list the right people, and show no button.
 *
 * So the keys are checked against the REAL report, built by the real function from a fixture,
 * rather than against a second list of literals. `buildMembershipReport` is what emits
 * `pending-invite`, `unknown` and the two sentinels; if it stops, this goes red.
 *
 * A GREEN RUN IS NOT EVIDENCE UNTIL YOU HAVE SEEN IT FAIL (AGENTS.md §7b). Mutations applied
 * one at a time, and what each trips:
 *
 *   `'__no_chapter__'` -> `'__nochapter__'` in MEMBERSHIP_BREAKDOWNS
 *       trips "every actionable slice key is a key the report really emits"
 *   `actionableSlices: ['pending-invite']` (dropping 'invited')
 *       trips "chasing an unanswered invitation is offered the same repair as an unsent one"
 *   `mayRepair` returning `rights.mayEditMembers` for 'send-invitation'
 *       trips "an invitation needs the family-tree grant and not the members grant"
 *   `sliceOffersRepair` losing its `rule.repair !== null` guard
 *       trips nothing today, and the last test in this file is why that is recorded rather
 *       than left to be discovered: every breakdown currently has a repair
 */

/** A roster wide enough that every slice of every breakdown is non-empty. */
const REPORT = buildMembershipReport({
  people: [
    // In a chapter, in a region, an adult with an account.
    { id: 'p1', chapterId: 'c-austin', dateOfBirth: '1980-05-05', hasAccount: true },
    // In no chapter at all, so: No chapter, and National.
    { id: 'p2', chapterId: null, dateOfBirth: '2015-05-05', hasAccount: false },
    // In a chapter that sits under no region, so: that chapter, and National.
    { id: 'p3', chapterId: 'c-loose', dateOfBirth: null, hasAccount: false },
  ],
  chapters: [
    { id: 'c-austin', name: 'Austin', regionId: 'r-texas' },
    { id: 'c-loose', name: 'Loose', regionId: null },
  ],
  regions: [{ id: 'r-texas', name: 'Texas' }],
  invitedIds: new Set(['p3']),
  today: '2026-08-22',
})

const KEYS: Record<MembershipBreakdown, readonly string[]> = {
  region: REPORT.byRegion.map(s => s.key),
  chapter: REPORT.byChapter.map(s => s.key),
  invitation: REPORT.byInvitation.map(s => s.key),
  age: REPORT.byAge.map(s => s.key),
}

describe('the actionable slice keys', () => {
  it('every actionable slice key is a key the report really emits', () => {
    for (const id of Object.keys(MEMBERSHIP_BREAKDOWNS) as MembershipBreakdown[]) {
      for (const key of MEMBERSHIP_BREAKDOWNS[id].actionableSlices) {
        expect(KEYS[id], `${id} does not emit ${key}`).toContain(key)
      }
    }
  })

  it('the two sentinels are the report module\'s own constants', () => {
    // Stated as an equality rather than as a `toContain`, so renaming either constant fails
    // here with the constant named rather than with a slice list dumped.
    expect(MEMBERSHIP_BREAKDOWNS.region.actionableSlices).toEqual([NATIONAL_KEY])
    expect(MEMBERSHIP_BREAKDOWNS.chapter.actionableSlices).toEqual([NO_CHAPTER_KEY])
  })

  it('offers the repair on the absence and nowhere else', () => {
    // A REAL CHAPTER OFFERS NOTHING, which is the half a "does the label mention an absence"
    // rule would get wrong: somebody already in Austin is not a problem the chart is reporting.
    expect(sliceOffersRepair('chapter', NO_CHAPTER_KEY)).toBe(true)
    expect(sliceOffersRepair('chapter', 'c-austin')).toBe(false)
    expect(sliceOffersRepair('region', NATIONAL_KEY)).toBe(true)
    expect(sliceOffersRepair('region', 'r-texas')).toBe(false)
    expect(sliceOffersRepair('age', 'unknown')).toBe(true)
    expect(sliceOffersRepair('age', 'adults')).toBe(false)
    expect(sliceOffersRepair('age', 'minors')).toBe(false)
  })

  it('chasing an unanswered invitation is offered the same repair as an unsent one', () => {
    // `invitePersonRecord` mints a fresh invitation, which is what somebody chasing a stale one
    // wants. `active` is the only slice left out, and it is left out because the action refuses
    // anybody who already has an account — a button that cannot work is worse than no button.
    expect(sliceOffersRepair('invitation', 'pending-invite')).toBe(true)
    expect(sliceOffersRepair('invitation', 'invited')).toBe(true)
    expect(sliceOffersRepair('invitation', 'active')).toBe(false)
  })

  it('names the repair, and nothing for a slice that offers none', () => {
    expect(sliceRepair('chapter', NO_CHAPTER_KEY)).toBe('assign-chapter')
    // THE REGION REPAIR IS THE CHAPTER REPAIR. `people` has no region column at all, so the
    // only way to move somebody between regions is to move their chapter.
    expect(sliceRepair('region', NATIONAL_KEY)).toBe('assign-chapter')
    expect(sliceRepair('invitation', 'pending-invite')).toBe('send-invitation')
    expect(sliceRepair('age', 'unknown')).toBe('record-birthday')
    expect(sliceRepair('age', 'adults')).toBeNull()
  })

  it('rejects a breakdown id that is not one', () => {
    expect(isMembershipBreakdown('chapter')).toBe(true)
    expect(isMembershipBreakdown('chapters')).toBe(false)
    expect(isMembershipBreakdown('')).toBe(false)
    // `hasOwnProperty` and not `in`, so a prototype member is not a breakdown.
    expect(isMembershipBreakdown('toString')).toBe(false)
    expect(isMembershipBreakdown('constructor')).toBe(false)
  })
})

describe('mayRepair', () => {
  const both = { mayEditMembers: true, mayInvite: true }

  it('an invitation needs the family-tree grant and not the members grant', () => {
    // The two are separate jobs a family may delegate separately, which is the whole reason
    // there are two flags. Getting this wrong offers a control that the action then refuses.
    expect(mayRepair('send-invitation', { mayEditMembers: true, mayInvite: false })).toBe(false)
    expect(mayRepair('send-invitation', { mayEditMembers: false, mayInvite: true })).toBe(true)
  })

  it('the chapter and the birthday both need the members grant', () => {
    // `setMemberChapter` and `updateUserProfile` are both `admin/members:edit` at `canAny`.
    for (const repair of ['assign-chapter', 'record-birthday'] as const) {
      expect(mayRepair(repair, { mayEditMembers: true, mayInvite: false })).toBe(true)
      expect(mayRepair(repair, { mayEditMembers: false, mayInvite: true })).toBe(false)
    }
  })

  it('offers nothing for a slice with no repair, however much the caller holds', () => {
    expect(mayRepair(null, both)).toBe(false)
    expect(mayRepair(sliceRepair('age', 'adults'), both)).toBe(false)
  })
})

describe('what this file cannot see', () => {
  it('records that every breakdown currently has a repair', () => {
    // STATED RATHER THAN ASSERTED AS A RULE. `sliceOffersRepair` guards on `repair !== null`
    // and nothing exercises that guard, because all four breakdowns have one — so a mutation
    // removing the guard trips no test. If a fifth chart arrives with no repair, this is the
    // line that says the guard is now load-bearing and wants a case of its own.
    const withNoRepair = (Object.keys(MEMBERSHIP_BREAKDOWNS) as MembershipBreakdown[])
      .filter(id => MEMBERSHIP_BREAKDOWNS[id].repair === null)
    expect(withNoRepair).toEqual([])
  })
})
