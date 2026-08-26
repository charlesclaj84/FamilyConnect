'use server'

import { requireScope } from '@/lib/auth/guard'
import { canAny } from '@/lib/auth/permissions'
import { createAdminClient } from '@/lib/supabase/admin'
import { resolveFamilyZone } from '@/lib/auth/zone'
import { todayIn } from '@/lib/tz'
import { isMinorOn } from '@/lib/age-utils'
import { invitedPersonIds, memberStatus, type OpenInvitation } from '@/lib/dues-projection'
import { disambiguatedName } from '@/lib/name-utils'
import {
  buildMembershipReport, NATIONAL_KEY, NO_CHAPTER_KEY,
  type MembershipReport, type ReportChapter, type ReportPerson, type ReportRegion,
} from '@/lib/membership-report'
import {
  MEMBERSHIP_SLICE_LIMIT, isMembershipBreakdown, type MembershipBreakdown,
} from '@/lib/membership-drill'

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
  const g = await requireScope('reporting/membership', 'view')
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
  // THE FAMILY'S ZONE. The report splits adults from minors, so "today" decides a COUNT —
  // and two members must not read different totals off the same report. `todayLocal()` here
  // was UTC, which moved the boundary by five hours every evening.
  return buildMembershipReport({
    people, chapters, regions, invitedIds,
    today: todayIn(await resolveFamilyZone(g.familyCode)),
  })
}


/**
 * One member of one slice of one breakdown, as the drill-down dialog needs them.
 *
 * ── WHAT IS AND IS NOT ON HERE ────────────────────────────────────────
 * A name, whether they can sign in, and where they are filed. NO email address, NO phone, NO
 * address, no birth DATE, and no `user_id`.
 *
 * **The address** is not needed: `invitePersonRecord` takes the address the caller TYPES,
 * because a person with no account holds a generated placeholder that can only hard-bounce
 * (AGENTS.md §4b) — so publishing what is on the row would be publishing a string nobody can
 * use. **The birth date** is not needed either: the only age slice that offers a repair is
 * "Birthday not recorded", and every person in it has a null birthday by construction.
 *
 * ONE NUANCE, STATED BECAUSE IT LOOKS LIKE A CONTRADICTION: a birth YEAR can appear inside
 * `name`, on a duplicated name with no nickname, because `disambiguatedName` falls through to it.
 * That is the product's settled answer to two Martha Allens — every `<option>` in every member
 * `<select>` and both person pickers already do it — and it matters more here than on a picker,
 * because this list carries a button that files somebody. Two identical rows above an action is
 * how the wrong person gets moved. The year is the narrowest thing that separates them.
 *
 * `person_id` IS published, and is the narrow one to publish: a `people.id` belongs to exactly
 * one family, so it tells a reader nothing they do not have — the argument
 * `BoardPositionHolder.person_id` already makes. A `user_id` is identical across every family
 * the account belongs to and is the one identifier that must not cross.
 */
export interface MembershipSliceMember {
  personId: string
  /**
   * "Martha Allen", or "Martha Allen (Marty)" where another member shares the name.
   *
   * `disambiguatedName` against the WHOLE roster and never against the slice, which is
   * `PersonMultiSelect`'s rule and matters more here than there: two Martha Allens are more
   * likely in a large family, and scoring the name inside a slice would make them read as
   * unambiguous at exactly the moment a breakdown had separated them.
   */
  name: string
  /**
   * The name in PARTS as well, and only so the dialog's filter box can use the shared matcher.
   *
   * `matchesPersonQuery` searches the display name, the concatenated first+last (so
   * "marthaallen" finds "Martha Allen") and the nickname, all accent- and
   * punctuation-insensitively. Handing it only the formatted string would silently drop two of
   * those three, which is precisely the drift `lib/person-search.ts` exists to stop — the
   * Member Directory got accent-insensitive search and the photo tagger did not.
   *
   * Nothing new crosses the boundary: `name` above is built from these three.
   */
  firstName: string
  lastName: string
  nickName: string | null
  /** `people.user_id IS NOT NULL` — they can sign in, so they cannot be invited. */
  hasAccount: boolean
  /** Where they are filed today. Null is the absence the chapter chart is reporting. */
  chapterId: string | null
  chapterName: string | null
  /** The region their chapter sits under, or null for National. Never a column on `people`. */
  regionName: string | null
  /** 'active' | 'invited' | 'pending-invite' — the same three words Dues Projections prints. */
  invitation: string
}

export interface MembershipSlice {
  members: MembershipSliceMember[]
  /**
   * How many the cap left out. Zero almost always; printed by the dialog when it is not.
   *
   * NEVER SILENT (AGENTS.md, "No silent caps"): a list that stops while LOOKING complete is
   * how somebody concludes a relative is not in the family.
   */
  truncated: number
  /** Every chapter the family has, so the repair can offer one. Names, never PII. */
  chapters: { id: string; name: string }[]
}

/**
 * Who is in one slice of one of the Membership report's four charts.
 *
 * ── IT PUBLISHES NAMES, WHICH THE REPORT ITSELF DELIBERATELY DOES NOT ──────
 * `getMembershipReport` reduces the roster to counts on the server and drops the rows, and its
 * header says so — that smaller surface is what lets `membership-report` be a `community`
 * resource rather than an admin one. This function is the deliberate exception, and it is
 * gated accordingly: **both** `membership-report:view` and `community/directory:view`, each at
 * `canAny`.
 *
 * The second grant is the one worth arguing. The Member Directory is the screen whose whole job
 * is publishing the family's names, and a family that has restricted it has said who may read
 * them; letting a pie chart answer the same question would route around that decision. It is
 * `canAny` rather than `can` because scope 'own' on the directory means "your own row", which is
 * not a slice of anything.
 *
 * A CALLER WITHOUT BOTH GETS `null`, not an empty slice, for `getMembershipReport`'s reason: a
 * zeroed shape reads as "nobody is in this chapter", which is a wrong answer rather than a
 * missing one.
 *
 * ── §4: THE SLICE KEY IS A CLIENT-SUPPLIED ID AND IS NEVER TRUSTED ─────────
 * `sliceKey` is a uuid for a region or a chapter, and it arrives from the browser. It is never
 * written anywhere — this function only reads — but it must not be able to name another
 * family's chapter and have the answer computed against it. It cannot: the geography is read
 * FIRST, family-scoped, and the key is matched against the ids that came back. A key that is
 * not among them is "no such slice" and answers an empty list, exactly as a chapter with nobody
 * in it does.
 *
 * ── THE ROSTER IS THE REPORT'S, TO THE ROW ───────────────────────────
 * The same four reads, the same three conditions (approved, alive, account or not) and the same
 * one clock. Two screens on one rail disagreeing about who is in a chapter is the drift
 * "A table is a table" is about, and here it would be worse than a mismatch: the count on the
 * chart and the list under it are the same figure, so a reader would see "4" and press it and
 * be given three names.
 *
 * ── THE ADMIN CLIENT, AND WHY IT HAS TO BE ─────────────────────────────
 * `getMembershipReport`'s argument, unchanged: the composed SELECT policies on `chapters` and
 * `regions` demand `admin/chapters:view` at 'any', so an ordinary member reads no chapter at all
 * through RLS and every one of these people would come back filed under National. §3 is
 * discharged by hand — `.eq('family_code', familyCode)` on all four reads, from the caller's own
 * membership and never from an argument.
 */
export async function getMembershipSlice(
  breakdown: string,
  sliceKey: string,
): Promise<MembershipSlice | null> {
  const g = await requireScope('reporting/membership', 'view')
  if (!g.ok) return null
  const familyCode = g.familyCode
  if (!familyCode) return null
  // THE SECOND GRANT. Resolved after the first so a caller with neither is refused by the
  // narrower of the two, which is the one whose absence means "not your report".
  if (!(await canAny(g.userId, 'community/directory', 'view'))) return null
  if (!isMembershipBreakdown(breakdown)) return null

  const admin = createAdminClient()
  const now = new Date().toISOString()

  const [peopleRes, chaptersRes, regionsRes, invitesRes] = await Promise.all([
    // `first_name, last_name, nick_name` on top of the report's own projection, because this
    // one names people. `primary_email` is still read for the invitation split and still never
    // returned — see `MembershipSliceMember`.
    admin.from('people')
      .select('id, chapter_id, date_of_birth, user_id, primary_email, first_name, last_name, nick_name')
      .eq('family_code', familyCode)
      .eq('membership_status', 'approved')
      .is('sunset_date', null),
    admin.from('chapters').select('id, name, region_id').eq('family_code', familyCode),
    admin.from('regions').select('id, name').eq('family_code', familyCode),
    admin.from('family_invitations')
      .select('email, invited_person_id')
      .eq('family_code', familyCode)
      .is('accepted_at', null).is('revoked_at', null).gt('expires_at', now),
  ])

  // §8, and the same split the report makes: the three structural reads fail the whole answer,
  // because a refused `chapters` read would file everybody under National and report a wrong
  // answer rather than a missing one. A refused invitations read costs one LABEL, so it is
  // logged and carried — every accountless person then reads as 'Pending invite', which says
  // "ask them" and is the safe direction.
  if (peopleRes.error || chaptersRes.error || regionsRes.error) {
    console.error('[membership-report] could not read the slice for ' + familyCode + ': '
      + (peopleRes.error?.message ?? chaptersRes.error?.message ?? regionsRes.error?.message))
    return null
  }
  if (invitesRes.error) {
    console.error('[membership-report] could not read open invitations for ' + familyCode + ': '
      + invitesRes.error.message)
  }

  type PersonRow = {
    id: string; chapter_id: string | null; date_of_birth: string | null
    user_id: string | null; primary_email: string | null
    first_name: string | null; last_name: string | null; nick_name: string | null
  }
  const roster = (peopleRes.data ?? []) as PersonRow[]
  const chapters = ((chaptersRes.data ?? []) as
    { id: string; name: string; region_id: string | null }[])
  const regionName = new Map(((regionsRes.data ?? []) as { id: string; name: string }[])
    .map(r => [r.id, r.name]))
  const chapterById = new Map(chapters.map(c => [c.id, c]))

  const invitedIds = invitedPersonIds(
    roster.map(p => ({
      personId: p.id, hasAccount: Boolean(p.user_id), email: p.primary_email,
    })),
    ((invitesRes.data ?? []) as { email: string; invited_person_id: string | null }[])
      .map((r): OpenInvitation => ({ personId: r.invited_person_id, email: r.email })),
  )

  // THE FAMILY'S ZONE, matching `buildMembershipReport` above — this is the DRILL-DOWN
  // behind the same report, so the two must bucket identically. A drill-down that put a
  // member in a different bucket from the total they clicked is the worst version of this
  // bug, because it looks like a data problem rather than a clock problem.
  const today = todayIn(await resolveFamilyZone(g.familyCode))

  // ONE PREDICATE PER BREAKDOWN, and each is the SAME bucketing rule `buildMembershipReport`
  // applies — restated here rather than shared, which is the one duplication in this feature and
  // the reason `lib/membership-drill.test.ts` checks the KEYS against a real report. Sharing it
  // would mean that function returning its per-person buckets, which is a wider return type for
  // every caller in order to serve one.
  //
  // A REGION COMES FROM THE CHAPTER. There is no `people.region_id`, so a member is in a region
  // exactly when their chapter is — and a chapter under no region puts them under National with
  // everybody who has no chapter at all, which is the bucket `buildMembershipReport` builds.
  const inSlice = (p: PersonRow): boolean => {
    const chapter = p.chapter_id ? chapterById.get(p.chapter_id) : undefined
    switch (breakdown as MembershipBreakdown) {
      case 'chapter':
        return sliceKey === NO_CHAPTER_KEY ? !chapter : chapter?.id === sliceKey
      case 'region': {
        const regionId = chapter?.region_id ?? null
        if (sliceKey === NATIONAL_KEY) return !regionId || !regionName.has(regionId)
        return regionId === sliceKey && regionName.has(regionId)
      }
      case 'invitation':
        return memberStatus({
          hasAccount: Boolean(p.user_id),
          invitationOpen: invitedIds.has(p.id),
        }) === sliceKey
      case 'age':
        if (!p.date_of_birth) return sliceKey === 'unknown'
        return isMinorOn(p.date_of_birth, today)
          ? sliceKey === 'minors'
          : sliceKey === 'adults'
    }
  }

  // DISAMBIGUATED AGAINST THE WHOLE ROSTER and then filtered, never the other way round. See
  // `MembershipSliceMember.name`.
  const named = roster.map(p => ({
    row: p,
    // `first_name`/`last_name` are nullable columns and the helper takes strings, so the
    // coalesce is here rather than in the helper: a blank name is a record somebody has not
    // finished, and 'Unnamed member' is what every other surface prints for it.
    name: disambiguatedName(
      {
        first_name: p.first_name ?? '',
        last_name: p.last_name ?? '',
        nick_name: p.nick_name,
        date_of_birth: p.date_of_birth,
      },
      roster.map(r => ({ first_name: r.first_name ?? '', last_name: r.last_name ?? '' })),
    ) || 'Unnamed member',
  }))

  const matched = named.filter(({ row }) => inSlice(row))
  const shown = matched.slice(0, MEMBERSHIP_SLICE_LIMIT)

  return {
    members: shown.map(({ row: p, name }) => {
      const chapter = p.chapter_id ? chapterById.get(p.chapter_id) : undefined
      const regionId = chapter?.region_id ?? null
      return {
        personId: p.id,
        name,
        firstName: p.first_name ?? '',
        lastName: p.last_name ?? '',
        nickName: p.nick_name,
        hasAccount: Boolean(p.user_id),
        chapterId: chapter?.id ?? null,
        chapterName: chapter?.name ?? null,
        regionName: regionId ? regionName.get(regionId) ?? null : null,
        invitation: memberStatus({
          hasAccount: Boolean(p.user_id),
          invitationOpen: invitedIds.has(p.id),
        }),
      }
    }),
    truncated: matched.length - shown.length,
    // SORTED BY NAME so the picker in the repair reads the same order the list does.
    chapters: chapters
      .map(c => ({ id: c.id, name: c.name }))
      .sort((a, b) => a.name.localeCompare(b.name)),
  }
}
