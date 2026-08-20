'use server'

import { requireScope } from '@/lib/auth/guard'
import { createAdminClient } from '@/lib/supabase/admin'
import { todayLocal } from '@/lib/date-utils'
import { invitedPersonIds, type OpenInvitation } from '@/lib/dues-projection'
import {
  buildMembershipReport,
  type MembershipReport, type ReportChapter, type ReportPerson, type ReportRegion,
} from '@/lib/membership-report'

/**
 * The family's membership, counted — nationally, by region, by chapter, by whether each
 * person has finished joining, and by adult against minor.
 *
 * ── `null` FOR ANYONE WITHOUT THE GRANT, WHICH IS THE SHAPE RATHER THAN AN EDGE CASE ─
 * The same answer `getDuesProjection` gives, for the same reason: every figure here is
 * family-wide, so a caller who may not ask must get nothing back to render rather than a
 * zeroed skeleton that reads as "your family has no members".
 *
 * `requireScope(…, 'view')` goes through `canAny`, NOT `can`. `can()` is true for scope
 * 'own', and there is no own version of a family-wide count — the member's own answer to
 * "where am I" is their profile. An own-scoped grant on this key would otherwise hand
 * somebody the whole family's shape, so `membership-report` is in `NO_OWNER_KEYS` and
 * Members & Access never offers the switch; this is the half that enforces it.
 *
 * ── THE ADMIN CLIENT, AND WHY IT HAS TO BE ──────────────────────────────────────────
 * Two of the four reads are refused outright on the user client. The composed SELECT
 * policies on `chapters` and `regions` both demand `admin/chapters:view = 'any'` —
 * `permission_table_map` gives each an `own_expr` of the literal 'false' — so an ordinary
 * member reads NO chapter and NO region through RLS, and this report would draw National
 * over a family with four regions. That is not hypothetical: it is exactly what the Member
 * Directory's Chapter column did for a year (see lib/chapter-places.ts, which argues the
 * same call on the same two tables). `family_invitations` is the same story a third time.
 *
 * So §3's obligation is discharged by hand: `.eq('family_code', familyCode)` on ALL FOUR
 * reads, from the caller's own membership and never from an argument. This function takes
 * no parameters at all, so there is no client-supplied id to verify (§4).
 *
 * ── WHY IT DOES NOT USE `chapterPlaces` ─────────────────────────────────────────────
 * That helper answers "what are THESE chapter ids called", which is right for a member
 * table listing the people it already read. This report has to list a chapter with NOBODY
 * in it — the single most actionable row on the screen — so it reads the family's whole
 * geography rather than the ids its people happen to carry. The retired `/admin/reports`
 * derived its chapter breakdown from `people.chapters(name)` and so could not tell an
 * empty chapter from one that did not exist.
 *
 * ── WHAT CROSSES THE BOUNDARY ───────────────────────────────────────────────────────
 * COUNTS AND PLACE NAMES. No person's name, no address, no birthday, no id reaches the
 * browser: `buildMembershipReport` reduces the roster to numbers on the server and the rows
 * are dropped. That is a deliberately smaller surface than Dues Projections, which names
 * every member — and it is what lets this key be a `community` resource rather than an
 * admin one. `primary_email` is read for the invitation join and never leaves this file.
 *
 * ── THE ARITHMETIC IS NOT HERE ──────────────────────────────────────────────────────
 * `buildMembershipReport` in lib/membership-report.ts, pure and tested (§7b). This function
 * decides who may ask and reads four tables; the bucketing, the National rule and the age
 * split are all checkable without a database because of that split.
 */
export async function getMembershipReport(): Promise<MembershipReport | null> {
  const g = await requireScope('membership-report', 'view')
  if (!g.ok) return null
  const familyCode = g.familyCode
  if (!familyCode) return null

  const admin = createAdminClient()
  // ONE CLOCK for the invitation window, read once so two rows a microsecond apart cannot
  // be judged against two different "now"s. Matches `getDuesProjection`.
  const now = new Date().toISOString()

  const [peopleRes, chaptersRes, regionsRes, invitesRes] = await Promise.all([
    // THE SAME ROSTER `getDuesProjection` BUILDS, and it has to be: two reports on one rail
    // disagreeing about how many members a family has is the drift AGENTS.md's "A table is a
    // table" exists to stop. Approved (an applicant has not joined), alive (`sunset_date` is
    // the column that records somebody has died, and the birthdays and dues screens both
    // already exclude them), and with no `user_id` filter — a recorded grandmother is
    // somebody the family has.
    //
    // `user_id` and `primary_email` are selected to DERIVE the invitation split, never to
    // return: the reduction below turns this roster into counts and nothing else.
    admin.from('people')
      .select('id, chapter_id, date_of_birth, user_id, primary_email')
      .eq('family_code', familyCode)
      .eq('membership_status', 'approved')
      .is('sunset_date', null),
    // THE CONSTRAINT IS NAMED on the region embed, following `chapterPlaces` and
    // `getChapters`. `chapters.region_id` is the only direct path today and a bare embed
    // still resolves — but §8's whole lesson is that a foreign key added to an unrelated
    // table turns a correct bare embed into PGRST201, which arrives as `[]` and would draw
    // this report's entire geography as National with no error anywhere.
    admin.from('chapters')
      .select('id, name, region_id')
      .eq('family_code', familyCode),
    admin.from('regions')
      .select('id, name')
      .eq('family_code', familyCode),
    // OPEN INVITATIONS: not accepted, not revoked, not expired — the same three conditions
    // `peek_family_invitation` applies, so this screen and the link agree about what an open
    // invitation is. No embed: `family_invitations` has THREE foreign keys to `people`
    // (`invited_by`, `accepted_by`, `invited_person_id`), so a bare `people(...)` is PGRST201
    // and would file every invited relative under "nobody has asked them" (§8).
    admin.from('family_invitations')
      .select('email, invited_person_id')
      .eq('family_code', familyCode)
      .is('accepted_at', null).is('revoked_at', null).gt('expires_at', now),
  ])

  // §8: `data` alone cannot tell a refused query from an empty table, and here the two
  // deserve very different answers. An empty `chapters` really is "this family has no
  // chapters"; a REFUSED one is an outage wearing that sentence, and every member would be
  // reported as National — a wrong answer rather than a missing one, which is the harder
  // kind to notice. The three structural reads fail the whole report.
  if (peopleRes.error || chaptersRes.error || regionsRes.error) {
    console.error('[membership-report] could not read the report for ' + familyCode + ': '
      + (peopleRes.error?.message ?? chaptersRes.error?.message ?? regionsRes.error?.message))
    return null
  }

  // §8 AGAIN, AND A DIFFERENT ANSWER, exactly as `getDuesProjection` reasons it: a refused
  // invitations read costs one LABEL and no structure — every accountless person then counts
  // as 'Pending invite', which says "ask them". Recoverable and visible. Failing the whole
  // page instead would withhold three correct breakdowns because a fourth caption is
  // unavailable, and failing toward 'Invited' would report work as already done.
  if (invitesRes.error) {
    console.error('[membership-report] could not read open invitations for ' + familyCode + ': '
      + invitesRes.error.message)
  }

  type PersonRow = {
    id: string; chapter_id: string | null; date_of_birth: string | null
    user_id: string | null; primary_email: string | null
  }
  const roster = (peopleRes.data ?? []) as PersonRow[]

  const invitedIds = invitedPersonIds(
    roster.map(p => ({
      personId: p.id, hasAccount: Boolean(p.user_id), email: p.primary_email,
    })),
    ((invitesRes.data ?? []) as { email: string; invited_person_id: string | null }[])
      .map((r): OpenInvitation => ({ personId: r.invited_person_id, email: r.email })),
  )

  const people: ReportPerson[] = roster.map(p => ({
    id: p.id,
    chapterId: p.chapter_id,
    dateOfBirth: p.date_of_birth,
    hasAccount: Boolean(p.user_id),
  }))
  const chapters: ReportChapter[] = ((chaptersRes.data ?? []) as
    { id: string; name: string; region_id: string | null }[])
    .map(c => ({ id: c.id, name: c.name, regionId: c.region_id }))
  const regions: ReportRegion[] = ((regionsRes.data ?? []) as
    { id: string; name: string }[])
    .map(r => ({ id: r.id, name: r.name }))

  // `todayLocal()` and never `new Date()`: `date_of_birth` is a bare DATE and the age rule
  // compares YYYY-MM-DD strings, so handing it a Date would put the timezone back into a
  // question that has none. See lib/age-utils.ts.
  return buildMembershipReport({ people, chapters, regions, invitedIds, today: todayLocal() })
}
