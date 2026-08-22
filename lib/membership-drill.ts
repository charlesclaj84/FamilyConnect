/**
 * What you can DO from a slice of the Membership report, and which slice offers what.
 *
 * PURE, AND NO REACT (AGENTS.md §7b's boundary). Three surfaces read it and one of them is a
 * server component: the page resolves the rights, the report view labels the cards, and the
 * client dialog decides which control to draw. A rule that lived inside the dialog could only
 * be shared by copying it, which is how `lib/person-search.ts` came to exist.
 *
 * ── WHY EACH BREAKDOWN OFFERS ONE THING AND NOT A MENU ──────────────────────────────
 * The point of drilling into a count is to fix the thing the count is telling you about, and
 * each of these charts is telling you about exactly one thing:
 *
 *   Invitations         a relative nobody has asked yet — send them an invitation
 *   By chapter          somebody filed under no chapter — file them
 *   By region           the same fact one rung up: a region comes from a CHAPTER, so the only
 *                       way to move somebody between regions is to move their chapter
 *   Adults and minors   a birthday nobody recorded — record it
 *
 * Offering all four everywhere would make the dialog a second Members & Access reached through
 * a pie chart, which is a worse version of a screen that already exists and is properly gated.
 * What is here is the one repair the chart in front of you is pointing at.
 *
 * ── THE ACTIONABLE SLICE IS NAMED, NOT INFERRED ─────────────────────────────────────
 * `actionableSlices` is an explicit list per breakdown rather than "any slice whose label
 * mentions an absence", because the control has to be OFFERED on the slice a reader would press
 * to fix something and WITHHELD elsewhere. Offering "send an invitation" on the Active slice
 * would be a button that refuses every row under it (`invitePersonRecord` refuses a person who
 * already has an account), and a control that cannot work is worse than no control.
 *
 * Every OTHER slice still opens: reading who is in a chapter is useful on its own, and a
 * dialog that opened for three slices out of eight would read as broken.
 */

/** The four charts on the Membership report. A slice belongs to exactly one. */
export type MembershipBreakdown = 'region' | 'chapter' | 'invitation' | 'age'

/** The one repair a breakdown offers, or `null` where it offers none. */
export type MembershipRepair = 'assign-chapter' | 'send-invitation' | 'record-birthday'

interface BreakdownRule {
  /** Names the region for a screen reader, and heads the dialog. */
  noun: string
  repair: MembershipRepair | null
  /**
   * The slice keys on which the repair is offered. `CountSlice.key` values, which for region
   * and chapter are a uuid or one of the two sentinels in `lib/membership-report.ts`.
   *
   * A uuid can never be listed here, so a chapter's own slice offers nothing — which is right:
   * somebody already in the Austin chapter is not a problem the chart is reporting.
   */
  actionableSlices: readonly string[]
}

/**
 * `__national__` and `__no_chapter__` are NOT imported from `lib/membership-report.ts`, and
 * that is a decision rather than a shortcut. Those constants are that module's answer to "what
 * bucket did this person land in"; these are this module's answer to "which row offers a
 * repair", and importing would make the second read as derived from the first when they are two
 * lists that happen to overlap. `lib/membership-drill.test.ts` is what keeps them honest: it
 * asserts these two strings ARE those two constants, so a rename of either goes red under
 * `npm test`.
 */
export const MEMBERSHIP_BREAKDOWNS: Record<MembershipBreakdown, BreakdownRule> = {
  region: {
    noun: 'region',
    // A REGION IS NOT A COLUMN. `people` has no `region_id` at all: a member's region is their
    // chapter's region, so the repair here is the chapter repair and the dialog says so.
    repair: 'assign-chapter',
    actionableSlices: ['__national__'],
  },
  chapter: {
    noun: 'chapter',
    repair: 'assign-chapter',
    actionableSlices: ['__no_chapter__'],
  },
  invitation: {
    noun: 'invitation',
    repair: 'send-invitation',
    // BOTH THE UNASKED AND THE ASKED-AND-WAITING. `invitePersonRecord` mints a fresh
    // invitation, which is exactly what somebody chasing an unanswered one wants, and it
    // refuses anybody who already has an account — so `active` is the one slice left out.
    actionableSlices: ['pending-invite', 'invited'],
  },
  age: {
    noun: 'age',
    repair: 'record-birthday',
    actionableSlices: ['unknown'],
  },
}

/** True when this slice of this breakdown offers its repair. */
export function sliceOffersRepair(
  breakdown: MembershipBreakdown,
  sliceKey: string,
): boolean {
  const rule = MEMBERSHIP_BREAKDOWNS[breakdown]
  return rule.repair !== null && rule.actionableSlices.includes(sliceKey)
}

/** The repair a slice offers, or null. */
export function sliceRepair(
  breakdown: MembershipBreakdown,
  sliceKey: string,
): MembershipRepair | null {
  return sliceOffersRepair(breakdown, sliceKey)
    ? MEMBERSHIP_BREAKDOWNS[breakdown].repair
    : null
}

/** Every breakdown id, for a runtime check on a value off the wire. */
export function isMembershipBreakdown(value: string): value is MembershipBreakdown {
  return Object.prototype.hasOwnProperty.call(MEMBERSHIP_BREAKDOWNS, value)
}

/**
 * How many members one slice will name before it stops and says how many it left.
 *
 * A family of a hundred and forty is an ordinary customer of this product (AGENTS.md, "Build
 * every member list for a hundred-member family"), so a slice really can be the whole roster.
 * The cap is well above that and exists to bound the payload rather than to shape the screen:
 * what makes the list usable at that size is the filter box in the dialog, not the cap.
 *
 * NEVER SILENTLY. `MembershipSlice.truncated` carries what was dropped and the dialog prints
 * it, for the reason `PersonMultiSelect`'s overflow count exists: a list that stops while
 * LOOKING complete is how somebody concludes a relative is not in the family.
 */
export const MEMBERSHIP_SLICE_LIMIT = 300

/**
 * The grants a drill-down may act with, resolved on the server and passed down.
 *
 * ── THEY ARE TWO GRANTS AND NOT ONE, WHICH IS NOT AN ACCIDENT ───────────────────────
 * `setMemberChapter` and `updateUserProfile` are both `admin/members:edit` at `canAny` — one
 * flag covers both. `invitePersonRecord` is `community/family-tree:edit`, which is a different
 * job a family may well delegate to somebody else: recording who is related to whom, and
 * asking a relative to join, are the family tree's business. So the dialog can offer the
 * chapter repair and not the invitation, or the other way round, and it renders whichever the
 * caller actually holds.
 *
 * THE FLAGS ARE THE AFFORDANCE AND NOT THE GATE. Every one of the three actions resolves its
 * own grant, because a `'use server'` export has a URL whether or not a button exists
 * (AGENTS.md §2).
 */
export interface MembershipRepairRights {
  /** `admin/members:edit` at `canAny` — covers the chapter and the birthday. */
  mayEditMembers: boolean
  /** `community/family-tree:edit` at `canAny` — covers sending an invitation. */
  mayInvite: boolean
}

/** Nothing granted. The shape a page uses before it resolves anything. */
export const NO_REPAIR_RIGHTS: MembershipRepairRights = {
  mayEditMembers: false,
  mayInvite: false,
}

/** True when the caller holds the grant this repair needs. */
export function mayRepair(
  repair: MembershipRepair | null,
  rights: MembershipRepairRights,
): boolean {
  if (repair === null) return false
  if (repair === 'send-invitation') return rights.mayInvite
  return rights.mayEditMembers
}
