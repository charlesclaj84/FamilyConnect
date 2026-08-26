'use server'

import { requireScope } from '@/lib/auth/guard'
import { canAny } from '@/lib/auth/permissions'
import { tierAllows } from '@/lib/auth/tier'
import { createAdminClient } from '@/lib/supabase/admin'
import { todayLocal } from '@/lib/date-utils'
import { DEFAULT_ZONE, todayIn } from '@/lib/tz'
import { electionPhase, ELECTION_PHASE_LABEL } from '@/lib/election-phase'
import { electionAreaMatch, electionScopeLabel } from '@/lib/election-area'
import type { PositionCategory, PositionScope } from '@/lib/board-positions'
import type { GatheringStatus, GatheringTaskStatus } from '@/lib/gatherings'
import {
  buildBoardReport, buildElectionsReport, buildGatheringsReport, buildMeetingsReport,
  type BoardReport, type ElectionReportInput, type ElectionsReport, type GatheringsReport,
  type MeetingReportInput, type MeetingsReport,
} from '@/lib/activity-reports'

/**
 * The four ACTIVITY reports: Gatherings, Elections, Meetings, and Board & Offices.
 *
 * ── WHY A SECOND REPORTS MODULE ────────────────────────────────────────────────────────
 * `app/actions/reports.ts` is the Membership report and its drill-down, and it is 430 lines
 * about one screen. These four are a different subject — what the family DOES rather than who
 * it is made of — and folding them in would make one file that four unrelated screens have to
 * be read through. The pure shaping they share is `lib/activity-reports.ts`; this file is the
 * four reads that feed it.
 *
 * ── EVERY ONE OF THEM IS THE ADMIN CLIENT, SO §3 IS DISCHARGED BY HAND ─────────────────
 * Sixteen queries across the four, and every one states `.eq('family_code', …)`. It has to be
 * the admin client rather than the caller's, and the reason is the same each time: a report
 * counts things the reader is not necessarily entitled to open one by one. A member who may
 * read the Gatherings report but holds no `admin/gatherings` grant would, through their own
 * client, receive a subset of the family's tasks and a total that silently described it —
 * which is worse than a refusal, because it is a wrong number rather than a missing one.
 *
 * ── EACH ONE IS ITS OWN KEY, AND `canAny` IS WHY ───────────────────────────────────────
 * `requireScope(key, 'view')` demands scope 'any'. There is no "own" version of a family-wide
 * count, so `can()` — which is true for scope 'own' — would let somebody through to a page
 * whose action then answers null, and they would read an empty screen rather than a 404. That
 * is the pattern `/reporting/dues-projections` set and `/reporting/membership` follows, and it
 * is why all four keys are in `NO_OWNER_KEYS`.
 *
 * ── A NULL IS A REFUSAL; AN EMPTY REPORT IS A FACT ─────────────────────────────────────
 * Every one of these returns `null` when the caller may not have it and a populated shape with
 * zero rows when the family simply has nothing yet. The pages render those differently, and
 * they must: "you were not granted this" and "your family has never held a meeting" are
 * different sentences and only one of them is about the reader.
 */

type Row = Record<string, unknown>
const rows = (data: unknown): Row[] => (data ?? []) as Row[]

/** `first last`, or a stated fallback. Repeated in four places and worth one function. */
function personName(r: Row): string {
  return `${(r.first_name as string) ?? ''} ${(r.last_name as string) ?? ''}`.trim()
    || 'Unnamed member'
}

// ═══════════════════════════════════════════════════════════════════════════════════════
// GATHERINGS
// ═══════════════════════════════════════════════════════════════════════════════════════

/**
 * THE MONEY BAND IS RESOLVED SEPARATELY, and it narrows rather than refuses.
 *
 * `gatherings/budget` is a Standard sub-key. AGENTS.md draws the line sharply: a read action
 * may narrow on the plan and may never refuse on one — the test is whether the tier changes
 * which COLUMNS come back or whether anything comes back at all. Here it changes two columns
 * to null and every row still returns, which is the same thing `getAdminGatherings` does.
 *
 * Both halves are asked. The TIER decides whether the family bought the band; the GRANT
 * decides whether this reader was given it. Either one absent withholds the figures.
 */
export async function getGatheringsReport(): Promise<GatheringsReport | null> {
  const g = await requireScope('reporting/gatherings', 'view')
  if (!g.ok) return null

  const [money, tierOk] = await Promise.all([
    canAny(g.userId, 'gatherings/budget', 'view'),
    tierAllows(g.familyCode, 'gatherings/budget'),
  ])
  const showMoney = money && tierOk

  const admin = createAdminClient()
  const [gatheringsRes, tasksRes] = await Promise.all([
    admin.from('gatherings')
      .select('id, title, starts_on, ends_on, status, is_premier, budget_cents')
      .eq('family_code', g.familyCode),
    admin.from('gathering_tasks')
      .select('gathering_id, status, assignee_id, due_on, budget_cents')
      .eq('family_code', g.familyCode),
  ])

  // §8 ON BOTH, AND THE TASKS HALF IS THE ONE THAT MATTERS. A refused `gatherings` read gives
  // an empty report, which reads as "no gatherings" and is at least visibly nothing. A refused
  // TASKS read gives a full list of gatherings with every task count at zero — a report
  // claiming the family is completely up to date on work it has not started. Neither is
  // acceptable, so either failure refuses the whole thing.
  if (gatheringsRes.error || tasksRes.error) {
    console.error(`[activity-reports] gatherings read failed for ${g.familyCode}: `
      + (gatheringsRes.error?.message ?? tasksRes.error?.message))
    return null
  }

  return buildGatheringsReport({
    gatherings: rows(gatheringsRes.data).map(r => ({
      id: r.id as string,
      title: r.title as string,
      starts_on: r.starts_on as string,
      ends_on: (r.ends_on as string | null) ?? null,
      status: r.status as GatheringStatus,
      is_premier: Boolean(r.is_premier),
      budget_cents: (r.budget_cents as number | null) ?? null,
    })),
    tasks: rows(tasksRes.data).map(r => ({
      gathering_id: r.gathering_id as string,
      status: r.status as GatheringTaskStatus,
      assignee_id: (r.assignee_id as string | null) ?? null,
      due_on: (r.due_on as string | null) ?? null,
      budget_cents: (r.budget_cents as number | null) ?? null,
    })),
    today: todayLocal(),
    money: showMoney,
  })
}

// ═══════════════════════════════════════════════════════════════════════════════════════
// ELECTIONS
// ═══════════════════════════════════════════════════════════════════════════════════════

/**
 * Turnout, nominations and uncontested offices, per election.
 *
 * ── ELIGIBILITY IS THE HARD PART, AND IT IS THE SAME RULE `/community/elections` USES ──
 * A national election's electorate is every approved member; a chapter election's is the
 * approved members of that chapter; a regional election's is the members of every chapter in
 * that region. `electionAreaMatch` in `lib/election-area.ts` is the one definition of that and
 * this evaluates it per person per election, exactly as `getElectionNomineeOptions` does. A
 * denominator computed any other way would make turnout a different number from the one the
 * election screen implies, which is the "two answers to one question" drift AGENTS.md's "A
 * table is a table" is about.
 *
 * ── DRAFTS ARE EXCLUDED ────────────────────────────────────────────────────────────────
 * A draft has no dates, no ballot and no electorate. Counting one would put a 0% turnout row
 * in the report for an election nobody has been told about.
 */
export async function getElectionsReport(): Promise<ElectionsReport | null> {
  const g = await requireScope('reporting/elections', 'view')
  if (!g.ok) return null

  const admin = createAdminClient()

  // ── TWO PHASES, AND THE REASON IS A MISSING COLUMN ─────────────────────────────────
  // `election_votes` and `election_nominations` have NO `family_code` — they are scoped
  // through `election_id` and nothing else, which the composed policies express with a
  // subquery. On the admin client there is no policy, so §3 has to be discharged some other
  // way: these two are filtered by `.in('election_id', <ids from a family-scoped read>)`,
  // which is the TRANSITIVE verdict `audit:family-scope` recognises. It is why this is not
  // one `Promise.all` — the ids have to exist before the second half can be asked.
  const electionsRes = await admin.from('elections')
    .select('id, title, status, scope, region_id, chapter_id, nominations_open_on, '
      + 'nominations_close_on, voting_open_on, voting_close_on, time_zone')
    .eq('family_code', g.familyCode)
    .eq('status', 'published')

  if (electionsRes.error) {
    console.error(`[activity-reports] elections read failed for ${g.familyCode}: `
      + electionsRes.error.message)
    return null
  }

  const electionRows = rows(electionsRes.data)
  const electionIds = electionRows.map(e => e.id as string)

  const [votesRes, nominationsRes, peopleRes, chaptersRes, regionsRes] = await Promise.all([
    // `.in()` WITH AN EMPTY LIST matches nothing, which is correct here and is not something
    // to guard against: a family with no published election has no votes to count.
    admin.from('election_votes').select('election_id, voter_id').in('election_id', electionIds),
    admin.from('election_nominations')
      .select('election_id, position_id, accepted').in('election_id', electionIds),
    admin.from('people')
      .select('id, chapter_id')
      .eq('family_code', g.familyCode)
      .eq('membership_status', 'approved')
      .is('sunset_date', null),
    admin.from('chapters').select('id, name, region_id').eq('family_code', g.familyCode),
    admin.from('regions').select('id, name').eq('family_code', g.familyCode),
  ])

  // §8 on all five. A refused `people` read makes every election read 0 eligible and therefore
  // NULL turnout, which is the honest-LOOKING failure — and it would be a wrong answer rather
  // than a missing one, so it refuses like the rest.
  const failed = votesRes.error ?? nominationsRes.error ?? peopleRes.error
    ?? chaptersRes.error ?? regionsRes.error
  if (failed) {
    console.error(`[activity-reports] elections read failed for ${g.familyCode}: ${failed.message}`)
    return null
  }

  const chapterRegions = new Map<string, string | null>()
  const chapterNames = new Map<string, string>()
  for (const c of rows(chaptersRes.data)) {
    chapterRegions.set(c.id as string, (c.region_id as string | null) ?? null)
    chapterNames.set(c.id as string, c.name as string)
  }
  const regionNames = new Map(rows(regionsRes.data).map(r => [r.id as string, r.name as string]))
  const people = rows(peopleRes.data)

  const input: ElectionReportInput[] = electionRows.map(e => {
    const area = {
      scope: e.scope as string | null,
      region_id: (e.region_id as string | null) ?? null,
      chapter_id: (e.chapter_id as string | null) ?? null,
    }
    const phase = electionPhase({
      status: 'published',
      nominations_open_on: (e.nominations_open_on as string | null) ?? null,
      nominations_close_on: (e.nominations_close_on as string | null) ?? null,
      voting_open_on: (e.voting_open_on as string | null) ?? null,
      voting_close_on: (e.voting_close_on as string | null) ?? null,
      // EACH ELECTION'S OWN ZONE, not one `today` shared across the report. A family running
      // a national ballot and a chapter's may legitimately have stated them in different
      // zones, and this figure has to match what the member's own screen says about the same
      // election — otherwise the report contradicts the ballot. See 20260826000005.
    }, todayIn((e.time_zone as string | null) ?? DEFAULT_ZONE))
    const nominations = rows(nominationsRes.data)
      .filter(n => n.election_id === e.id)
      .map(n => ({ positionId: n.position_id as string, accepted: Boolean(n.accepted) }))
    return {
      id: e.id as string,
      title: e.title as string,
      scopeLabel: electionScopeLabel(area, {
        region: area.region_id ? regionNames.get(area.region_id) : null,
        chapter: area.chapter_id ? chapterNames.get(area.chapter_id) : null,
      }),
      phase: ELECTION_PHASE_LABEL[phase] ?? phase,
      // OPEN means a member can act on it TODAY — nominate, or vote. The other four phases
      // are all things nobody can do anything about: `'draft'` and `'scheduled'` have not
      // started, `'between'` is the gap after the slate closes, `'closed'` is over.
      open: phase === 'nominations' || phase === 'voting',
      // Offices, counted as DISTINCT positions somebody has been nominated for. The schema
      // does not record which offices an election is filling — a nomination is what names a
      // position — so this is the only figure the data supports, and it is why `uncontested`
      // can never exceed the offices anybody stood for.
      offices: new Set(nominations.map(n => n.positionId)).size,
      eligible: people.filter(p => electionAreaMatch({
        election: area,
        memberChapterId: (p.chapter_id as string | null) ?? null,
        chapterRegions,
      }) === 'in').length,
      nominations,
      voterIds: rows(votesRes.data)
        .filter(v => v.election_id === e.id)
        .map(v => v.voter_id as string),
    }
  })

  return buildElectionsReport(input)
}

// ═══════════════════════════════════════════════════════════════════════════════════════
// MEETINGS
// ═══════════════════════════════════════════════════════════════════════════════════════

/**
 * How often the family meets, how big the room is, and how much of it votes.
 *
 * ── IT REPORTS WHO WAS INVITED AND WHO VOTED. IT NEVER REPORTS ATTENDANCE ──────────────
 * There is no check-in anywhere in this product — the attendee list is who was ASKED, and a
 * vote is the only positive evidence anybody was actually in the room. `lib/activity-reports.ts`
 * keeps the two figures separate and this keeps them separate on the way in; the page says so
 * in words. Averaging them into an "attendance rate" would be a report stating something no
 * row in the database says.
 *
 * ── THE NAMES ARE READ SEPARATELY, NOT EMBEDDED ────────────────────────────────────────
 * `meeting_sessions` has TWO foreign keys to `people` (`secretary_id`, `created_by`) and
 * `meeting_votes` has one to a table this already reads. A bare `people(...)` embed on the
 * first is PGRST201 — which answers `[]` and would empty the whole report (§8) — and naming
 * the constraint would still leave the voter names to fetch. One roster read serves all three.
 */
export async function getMeetingsReport(): Promise<MeetingsReport | null> {
  const g = await requireScope('reporting/meetings', 'view')
  if (!g.ok) return null

  const admin = createAdminClient()
  const [sessionsRes, attendeesRes, topicsRes, votesRes, peopleRes] = await Promise.all([
    admin.from('meeting_sessions')
      .select('id, title, meets_on, closed_at, secretary_id')
      .eq('family_code', g.familyCode),
    admin.from('meeting_attendees')
      .select('session_id, person_id')
      .eq('family_code', g.familyCode),
    admin.from('meeting_topics')
      .select('id, session_id, voting_opened_at')
      .eq('family_code', g.familyCode),
    admin.from('meeting_votes')
      .select('topic_id, voter_id')
      .eq('family_code', g.familyCode),
    admin.from('people')
      .select('id, first_name, last_name')
      .eq('family_code', g.familyCode),
  ])

  const failed = sessionsRes.error ?? attendeesRes.error ?? topicsRes.error
    ?? votesRes.error ?? peopleRes.error
  if (failed) {
    console.error(`[activity-reports] meetings read failed for ${g.familyCode}: ${failed.message}`)
    return null
  }

  const names = new Map(rows(peopleRes.data).map(p => [p.id as string, personName(p)]))

  const attendeesBySession = new Map<string, string[]>()
  for (const a of rows(attendeesRes.data)) {
    const key = a.session_id as string
    const list = attendeesBySession.get(key)
    if (list) list.push(a.person_id as string)
    else attendeesBySession.set(key, [a.person_id as string])
  }

  const votersByTopic = new Map<string, string[]>()
  for (const v of rows(votesRes.data)) {
    const key = v.topic_id as string
    const list = votersByTopic.get(key)
    if (list) list.push(v.voter_id as string)
    else votersByTopic.set(key, [v.voter_id as string])
  }

  const topicsBySession = new Map<string, { id: string; votingOpened: boolean; voterIds: string[] }[]>()
  for (const t of rows(topicsRes.data)) {
    const key = t.session_id as string
    const topic = {
      id: t.id as string,
      votingOpened: t.voting_opened_at !== null,
      voterIds: votersByTopic.get(t.id as string) ?? [],
    }
    const list = topicsBySession.get(key)
    if (list) list.push(topic)
    else topicsBySession.set(key, [topic])
  }

  const meetings: MeetingReportInput[] = rows(sessionsRes.data).map(s => ({
    id: s.id as string,
    title: s.title as string,
    meets_on: s.meets_on as string,
    closed_at: (s.closed_at as string | null) ?? null,
    secretary_id: (s.secretary_id as string | null) ?? null,
    secretaryName: s.secretary_id ? names.get(s.secretary_id as string) ?? null : null,
    attendeeIds: attendeesBySession.get(s.id as string) ?? [],
    topics: topicsBySession.get(s.id as string) ?? [],
  }))

  return buildMeetingsReport({ meetings, names })
}

// ═══════════════════════════════════════════════════════════════════════════════════════
// BOARD & OFFICES
// ═══════════════════════════════════════════════════════════════════════════════════════

/**
 * Who holds which office, and — the question nothing else in the product answers — which
 * offices nobody holds.
 *
 * ── IT IS NOT `/admin/members/organization` WITH A DIFFERENT LAYOUT ────────────────────
 * That screen is where a family DEFINES its positions and hands them out, and it is gated on
 * `admin/members/board-positions`, which is an administrator's grant. This is a reading, gated
 * on its own `reporting/board` key, so a family can let a chair or a nominations committee see
 * where the gaps are without giving them the power to change the roster. The two would be one
 * screen if the answer to "could a family sensibly hold one and not the other" were no; it is
 * plainly yes.
 *
 * ── FIVE READS AND A TYPESCRIPT JOIN, FOR `getBoardPositionHolders`' REASON ────────────
 * `user_roles` has no foreign key to `people` at all — it points at `auth.users` — so a
 * `people(...)` embed under it is PGRST200, which answers `[]` in silence (§8).
 */
export async function getBoardReport(): Promise<BoardReport | null> {
  const g = await requireScope('reporting/board', 'view')
  if (!g.ok) return null

  const admin = createAdminClient()
  const [positionsRes, assignmentsRes, peopleRes, chaptersRes, regionsRes] = await Promise.all([
    admin.from('family_roles')
      .select('id, name, category, scope, sort_order')
      .eq('family_code', g.familyCode),
    admin.from('user_roles')
      .select('user_id, role_id, scope, chapter_id, region_id')
      .eq('family_code', g.familyCode),
    admin.from('people')
      .select('id, user_id, first_name, last_name')
      .eq('family_code', g.familyCode)
      .not('user_id', 'is', null),
    admin.from('chapters').select('id, name').eq('family_code', g.familyCode),
    admin.from('regions').select('id, name').eq('family_code', g.familyCode),
  ])

  // §8 on all five. A refused `family_roles` read would report a family with twelve offices as
  // having none, and a refused `user_roles` read would report every one of them as VACANT —
  // which is this report's headline finding, invented out of an outage.
  const failed = positionsRes.error ?? assignmentsRes.error ?? peopleRes.error
    ?? chaptersRes.error ?? regionsRes.error
  if (failed) {
    console.error(`[activity-reports] board read failed for ${g.familyCode}: ${failed.message}`)
    return null
  }

  const chapterNames = new Map(rows(chaptersRes.data).map(c => [c.id as string, c.name as string]))
  const regionNames = new Map(rows(regionsRes.data).map(r => [r.id as string, r.name as string]))
  const byUserId = new Map(rows(peopleRes.data).map(p => [p.user_id as string, p]))

  return buildBoardReport({
    positions: rows(positionsRes.data).map(p => ({
      id: p.id as string,
      name: p.name as string,
      scope: ((p.scope as string | null) ?? 'national') as PositionScope,
      category: ((p.category as string | null) ?? 'appointed_position') as PositionCategory,
      sort_order: (p.sort_order as number | null) ?? 0,
    })),
    assignments: rows(assignmentsRes.data).flatMap(a => {
      const person = byUserId.get(a.user_id as string)
      // An assignment whose account is no longer one of this family's people. There is nobody
      // to name, and inventing a placeholder holder would make a vacant office read as filled
      // — which is the one figure this report exists to get right.
      if (!person) return []
      const scope = (a.scope as string | null) ?? 'national'
      const areaId = scope === 'regional'
        ? (a.region_id as string | null)
        : scope === 'chapter' ? (a.chapter_id as string | null) : null
      return [{
        positionId: a.role_id as string,
        personId: person.id as string,
        personName: personName(person),
        areaName: areaId
          ? (scope === 'regional' ? regionNames.get(areaId) : chapterNames.get(areaId)) ?? null
          : null,
      }]
    }),
  })
}
