'use server'

import { revalidatePath } from 'next/cache'
import { confirmWrite } from '@/lib/confirmed-write'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getMyFamilyCode, getMyPersonId, belongsToFamily } from '@/lib/auth/family'
import { can } from '@/lib/auth/permissions'
import { requireScope, requireMember, type GuardOk } from '@/lib/auth/guard'
import { formatDate, todayLocal } from '@/lib/date-utils'
import { embedOne, type PersonNameRow } from '@/lib/supabase/embed'
import {
  electionPhase, windowProblem,
  type ElectionPhase, type ElectionStatus, type WindowInput,
} from '@/lib/election-phase'
import {
  electionAreaMatch, electionScope, electionScopeLabel, rolesForScope,
  type ElectionScope,
} from '@/lib/election-area'

/**
 * ── WHAT AN ELECTION IS, AFTER 20260821000000 AND 20260821000001 ───────────────────
 * Three things changed under this module and every function here is shaped by them:
 *
 *   1. **The dates are the mechanism.** `status` is `draft | published` and the PHASE is
 *      derived from four DATE windows by `lib/election-phase.ts`. There is no "Open
 *      Nominations" button any more, and there is nothing to forget to press. The two INSERT
 *      policies on `election_nominations` and `election_votes` test
 *      `election_window_open()` in SQL, which is the same rule.
 *   2. **An election belongs to a level** — national, regional or chapter — and the levels do
 *      not cross-pollinate: a chapter election fills chapter-scoped offices and admits only
 *      that chapter's members.
 *   3. **The organizer's key is `admin/elections` again.** `community/elections` is the member's
 *      own ballot and is what the four TABLES are mapped to; `admin/elections` is the screen
 *      that runs one, and it fails closed for a family that has not granted it.
 *
 * ── WHICH CLIENT, AND WHY IT IS NOT ONE ANSWER ─────────────────────────────────────
 * The reads a MEMBER makes go through `createClient()`, because RLS is genuinely doing the
 * work: the composed SELECT policies on all four tables now AND `auth_may_see_election()`, so
 * PostgREST itself will not release another chapter's election. The area rule is applied in
 * TypeScript as well — that is not redundancy, it is §5: the app decides which rows a page
 * asks for, and it is the only layer that exists at all for the two reads that must see past
 * RLS.
 *
 * The reads and writes an ORGANIZER makes go through `createAdminClient()`, and every one of
 * them re-applies `.eq('family_code', …)` by hand (§3). Two reasons, not one:
 *
 *   * `/admin/elections` lists every level, and `elections` is now narrowed by area for
 *     anybody the override does not cover. Reading it on the user client would work for a
 *     grant-holder and answer `[]` for a screen state nobody predicted — and PostgREST
 *     answers a policy that releases nothing with `[]` rather than an error (§8).
 *   * `createElection` is the ONLY enforcement of the position-level rule (see
 *     `rolesForScope`), and an action that is the only enforcement of a rule must not be one
 *     of two paths to the table. `elections_guard_scope_family` is what the service role
 *     cannot ignore.
 *
 * ── THE PHASE IS RESOLVED ON THE SERVER, NEVER IN A COMPONENT ──────────────────────
 * Every `Election` this module returns carries a `phase`. Computing it in a client component
 * would mean reading the clock during render, which `react-hooks/purity` is right to flag and
 * which `lib/date-utils.ts` already argues about at length. The cost is that a tab left open
 * across a window boundary shows a stale phase until it revalidates — which is why the phase
 * is a rendering decision and `election_window_open()` in SQL is the boundary: a stale screen
 * can offer a control, and the write behind it is still refused.
 */

/**
 * Deliberately NOT `formatPersonName` from lib/name-utils: that appends a nickname, and
 * a ballot showing "Martha Allen (Mim)" where it used to show "Martha Allen" is a product
 * change, not a lint fix. The nominee PICKER does disambiguate now — it is `PersonPicker`,
 * which scores a name against the whole roster — and that is the right place for it: the
 * picker is where two Martha Allens have to be told apart, while a nomination already made
 * names one person.
 */
const nameOf = (p: PersonNameRow | null) => (p ? `${p.first_name} ${p.last_name}` : 'Unknown')

export interface Election {
  id: string
  title: string
  description: string | null
  status: ElectionStatus
  nominations_open_on: string | null
  nominations_close_on: string | null
  voting_open_on: string | null
  voting_close_on: string | null
  scope: ElectionScope
  region_id: string | null
  chapter_id: string | null
  /** "National", or the region or chapter by name. Resolved server-side; never empty. */
  scope_label: string
  /** Derived from the four windows and today. See the note on the server above. */
  phase: ElectionPhase
  created_at: string
}

export interface ElectionPosition {
  id: string
  election_id: string
  title: string
  max_winners: number
  sort_order: number
}

/**
 * One CANDIDACY: a person standing for one office on one ballot.
 *
 * ── THE THREE FIELDS THAT ARRIVED WITH `election_nomination_supporters` ────────────
 * `20260821000004` split "who is standing" from "who asked them to", because
 * `election_nominations` could not say *"if more than myself nominated them they remain in
 * the list"* — it is UNIQUE per (election, position, nominee) with one `nominated_by`, so
 * retracting could only mean deleting the candidacy out from under everybody else.
 *
 * WHAT IS PUBLISHED IS A COUNT AND TWO BOOLEANS, NEVER THE LIST OF NOMINATORS (§5). The
 * SELECT policy would allow the names — `nominated_by` has been readable by every member
 * since 20260609000007 and the supporters table keeps that posture — but the screen needs
 * "you and two others", not who the two are, and a family reading off who nominated whom is
 * more than was asked for and more than the feature needs. Send the answer, not the rows.
 */
export interface ElectionNomination {
  id: string
  position_id: string
  nominee_id: string
  nominee_name: string
  accepted: boolean | null
  /** How many members put this person forward. 1 for anything a member created. */
  nominator_count: number
  /** Whether the CALLER is one of them. */
  i_nominated: boolean
  /**
   * Whether the caller may take their own name off this nomination RIGHT NOW.
   *
   * Resolved here and not in the component, for the reason `phase` is: it depends on the
   * nominations window, which depends on the clock, and reading the clock during render
   * makes a component's output depend on when it happened to render. It is also the same
   * rule as `perm:family can retract a nomination` in SQL, and one copy of a rule is the
   * whole argument — a second one in TSX drifts the first time either changes.
   *
   * The policy is still the boundary. A tab left open across the close of nominations shows
   * a control whose write is refused, which is why `retractNomination` reports rather than
   * assumes (§8b).
   */
  retractable: boolean
}

export interface ElectionVoteCount {
  position_id: string
  nominee_id: string
  nominee_name: string
  vote_count: number
}

/** A member who may stand in one election — the shape `PersonPicker` needs. */
export interface ElectionNominee {
  id: string
  first_name: string
  last_name: string
  nick_name: string | null
}

/** The columns every projection of an election needs. One literal, for the reason §8 gives. */
const ELECTION_COLUMNS =
  'id, title, description, status, scope, region_id, chapter_id, created_at, '
  + 'nominations_open_on, nominations_close_on, voting_open_on, voting_close_on'

/** The raw row, before the phase and the scope label are resolved onto it. */
interface RawElection {
  id: string
  title: string
  description: string | null
  status: string | null
  scope: string | null
  region_id: string | null
  chapter_id: string | null
  created_at: string
  nominations_open_on: string | null
  nominations_close_on: string | null
  voting_open_on: string | null
  voting_close_on: string | null
}

/**
 * The region and chapter names in one family, and chapter -> region.
 *
 * ── THE ADMIN CLIENT, WHICH IS A CORRECTION RATHER THAN A CHOICE ───────────────────
 * The composed SELECT policy on `regions` and `chapters` demands
 * `admin/members/organization:view = 'any'`, so through the user client an ordinary member
 * reads NO chapter at all — and PostgREST answers that with `[]` rather than an error. The
 * consequence would not be cosmetic: every scoped election would print with no level beside
 * it, and `electionAreaMatch` would put every member under National and hide every scoped
 * election from the people it was written for.
 *
 * `getDuesScopeOptions`, `familyChapterRegions` and `readChapters` in
 * `app/actions/announcements.ts` all argued this out first and the conclusion carries: NAMES
 * OF CHAPTERS ARE FAMILY STRUCTURE RATHER THAN PII. What `admin/members/organization` protects
 * is EDITING the family's shape, and every write in `app/actions/admin/chapters.ts` still
 * demands it.
 *
 * §3 by hand: `.eq('family_code', …)`, with the code from the caller's own membership.
 * §8: the error is read. A refused read here silently disenfranchises every member of every
 * chapter, so it is logged and reported as empty rather than discarded.
 */
async function familyPlaces(familyCode: string): Promise<{
  chapterRegions: ReadonlyMap<string, string | null>
  regionNames: ReadonlyMap<string, string>
  chapterNames: ReadonlyMap<string, string>
}> {
  const empty = {
    chapterRegions: new Map<string, string | null>(),
    regionNames: new Map<string, string>(),
    chapterNames: new Map<string, string>(),
  }
  if (!familyCode) return empty

  const admin = createAdminClient()
  const [regionsRes, chaptersRes] = await Promise.all([
    admin.from('regions').select('id, name').eq('family_code', familyCode),
    admin.from('chapters').select('id, name, region_id').eq('family_code', familyCode),
  ])
  if (regionsRes.error || chaptersRes.error) {
    console.error(
      `[elections] could not read regions/chapters for ${familyCode}: `
      + (regionsRes.error?.message ?? chaptersRes.error?.message)
      + ' — every scoped election will be hidden from its own members until this is fixed.',
    )
    return empty
  }

  const chapterRegions = new Map<string, string | null>()
  const chapterNames = new Map<string, string>()
  for (const c of (chaptersRes.data ?? []) as { id: string; name: string; region_id: string | null }[]) {
    chapterRegions.set(c.id, c.region_id)
    chapterNames.set(c.id, c.name)
  }
  const regionNames = new Map<string, string>()
  for (const r of (regionsRes.data ?? []) as { id: string; name: string }[]) {
    regionNames.set(r.id, r.name)
  }
  return { chapterRegions, regionNames, chapterNames }
}

/** The caller's chapter IN THE FAMILY BEING VIEWED. `chapter_id` is per-family. */
async function myChapterId(userId: string, familyCode: string): Promise<string | null> {
  const { data, error } = await createAdminClient()
    .from('people').select('chapter_id')
    .eq('user_id', userId).eq('family_code', familyCode).maybeSingle()
  // §8, and here it is not a courtesy: null means "belongs to no chapter", which
  // `electionAreaMatch` reads as "in no scoped election" — so a refused read does not narrow
  // the list, it hides every scoped election from the one member it was written for.
  if (error) {
    console.error(`[elections] could not read the caller's chapter: ${error.message}`
      + ' — scoped elections will be hidden from them until this is fixed.')
    return null
  }
  return (data as { chapter_id: string | null } | null)?.chapter_id ?? null
}

/** The raw row plus the two derived fields every screen prints. */
function mapElection(
  row: RawElection,
  today: string,
  names: { regionNames: ReadonlyMap<string, string>; chapterNames: ReadonlyMap<string, string> },
): Election {
  return {
    id: row.id,
    title: row.title,
    description: row.description,
    status: row.status === 'published' ? 'published' : 'draft',
    nominations_open_on: row.nominations_open_on,
    nominations_close_on: row.nominations_close_on,
    voting_open_on: row.voting_open_on,
    voting_close_on: row.voting_close_on,
    scope: electionScope(row),
    region_id: row.region_id,
    chapter_id: row.chapter_id,
    scope_label: electionScopeLabel(row, {
      region: row.region_id ? names.regionNames.get(row.region_id) : null,
      chapter: row.chapter_id ? names.chapterNames.get(row.chapter_id) : null,
    }),
    phase: electionPhase({ ...row, status: row.status ?? null }, today),
    created_at: row.created_at,
  }
}

/**
 * The elections one MEMBER may see — published, and addressed to their part of the family.
 *
 * Two layers, and both are deliberate. The query runs on the USER client, so the composed
 * policies have already dropped every election outside the caller's area; the
 * `electionAreaMatch` filter afterwards is the app-layer authority (§5) and the only layer
 * that exists for an organizer, whose RLS override lets the whole family's rows through.
 *
 * DRAFTS ARE EXCLUDED HERE RATHER THAN BY A POLICY, and that is a real decision. A draft is
 * an election an organizer is still writing, so a member seeing one would be reading a
 * half-made claim about a ballot — but it is not CONFIDENTIAL, and giving it its own policy
 * conjunct would mean the organizer's own screen could not list its drafts either. So the
 * filter is here, where the two screens differ, and `/admin/elections` is the one that asks
 * for them. (The old member list filed drafts under "Past & Draft" and showed them to
 * everybody, which is what this corrects.)
 */
export async function getElectionsForMember(): Promise<Election[]> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return []
  const familyCode = await getMyFamilyCode(user.id)

  const [{ data, error }, places, chapterId] = await Promise.all([
    supabase.from('elections').select(ELECTION_COLUMNS)
      .eq('status', 'published')
      .order('created_at', { ascending: false }),
    familyPlaces(familyCode),
    myChapterId(user.id, familyCode),
  ])
  // §8. `[]` from a refused query and `[]` from a family with no elections look identical and
  // are very different facts — the first is a member told their family holds no ballot.
  if (error) {
    console.error(`[elections] member list failed for ${familyCode}: ${error.message}`)
    return []
  }

  const today = todayLocal()
  return ((data ?? []) as unknown as RawElection[])
    .filter(row => electionAreaMatch({
      election: row, memberChapterId: chapterId, chapterRegions: places.chapterRegions,
    }) === 'in')
    .map(row => mapElection(row, today, places))
}

/**
 * The one election on the Dashboard's Quick Actions strip, or null.
 *
 * ── IT IS A PROMPT, SO IT ONLY EXISTS WHEN THERE IS SOMETHING TO DO ────────────────
 * Phase `nominations` or `voting`, and nothing else. An election that has not opened and one
 * sitting between its two windows are both visible on `/community/elections` and neither is a
 * job — Quick Actions is "what should I do now", which is the argument
 * `my-gathering-tasks` is written on and the reason a chip reading "Vote" eleven days before
 * the poll opens would be a control that does nothing.
 *
 * ── THE MOST URGENT ONE, WHICH IS THE ONE CLOSING SOONEST ──────────────────────────
 * A family can legitimately be running several at once — a national ballot and a chapter's —
 * and the strip has room for one. Ordering by the CURRENT window's closing date rather than by
 * phase is what makes that choice defensible: it is the one the member runs out of time on
 * first, whichever kind of thing it is asking for. Ties break on the title so the answer is
 * stable across renders rather than depending on row order.
 *
 * ── IT REUSES `getElectionsForMember`, DELIBERATELY ────────────────────────────────
 * That function is where the area rule, the draft exclusion and the phase derivation all live,
 * and re-deriving any of them here would be a second answer to "which elections are this
 * member's" — the failure `lib/election-area.ts` exists to prevent. The cost is reading the
 * whole list to return one row, which for a family running single digits of elections is not a
 * cost.
 *
 * ── AND IT CHECKS THE GRANT ITSELF ────────────────────────────────────────────────
 * `getElectionsForMember` does not — it is called by a page that has already resolved
 * `requireView`, and RLS narrows what it returns. This one is called by the DASHBOARD, which
 * gates nothing about elections, so the check belongs here (AGENTS.md §2: an action that
 * trusts the page protecting it is unprotected). The Dashboard ALSO resolves the same grant
 * before calling, which is §5 rather than duplication — the point there is not to run the
 * query at all.
 */
export interface ActionableElection {
  id: string
  title: string
  scope_label: string
  /** Only ever the two phases a member can act in. Narrower than `ElectionPhase` on purpose. */
  phase: 'nominations' | 'voting'
  /** The last day to act, which is what the caption underneath can say. */
  closes_on: string | null
}

export async function getMyActionableElection(): Promise<ActionableElection | null> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null
  if (!(await can(user.id, 'community/elections', 'view'))) return null

  const open = (await getElectionsForMember())
    .filter((e): e is Election & { phase: 'nominations' | 'voting' } =>
      e.phase === 'nominations' || e.phase === 'voting')
    .map(e => ({
      id: e.id,
      title: e.title,
      scope_label: e.scope_label,
      phase: e.phase,
      closes_on: e.phase === 'nominations' ? e.nominations_close_on : e.voting_close_on,
    }))

  if (!open.length) return null

  // A null closing date sorts LAST rather than first. It should not be reachable — a published
  // election has all four dates (`elections_published_has_windows`) and an unpublished one is
  // not in this list at all — but `''` sorts before every real date, so getting it backwards
  // would put an impossible row ahead of a real deadline.
  return open.sort((a, b) =>
    (a.closes_on ?? '9999-12-31').localeCompare(b.closes_on ?? '9999-12-31')
    || a.title.localeCompare(b.title))[0]
}

/**
 * One election as the organizer's screen needs it: its ballot, and what has happened on it.
 *
 * ── THE TWO COUNTS ARE NOT DECORATION ──────────────────────────────────────────────
 * They are what makes "Return to draft" honest. `unpublishElection` refuses once anybody has
 * been nominated or has voted, and a button that reports that only after being pressed is a
 * button that reads as broken. So the row says how many there are and the control is not
 * offered — which is the same rule the Accounting screen follows for a dues schedule the
 * ledger has been posted against.
 */
export interface OrganizerElection extends Election {
  positions: { title: string; max_winners: number }[]
  nomination_count: number
  vote_count: number
}

/**
 * Every election in the family, at every level, drafts included — the organizer's list.
 *
 * The admin client, family-scoped by hand (§3), and gated on the ORGANIZER key. See the
 * module header for why this is not the user client.
 *
 * ── THE CHILD ROWS ARE READ IN THREE QUERIES, NOT THREE PER ELECTION ───────────────
 * `.in('election_id', ids)` once each, grouped in TypeScript. A family runs single digits of
 * elections, so this is not about speed; it is about the shape not degrading if one ever runs
 * forty. `positions` is also what prefills the edit form, which is why the titles come back
 * rather than a count.
 */
export async function getElectionsForOrganizer(): Promise<OrganizerElection[]> {
  const g = await requireScope('admin/elections', 'view')
  if (!g.ok) return []

  const admin = createAdminClient()
  const [{ data, error }, places] = await Promise.all([
    admin.from('elections').select(ELECTION_COLUMNS)
      .eq('family_code', g.familyCode)
      .order('created_at', { ascending: false }),
    familyPlaces(g.familyCode),
  ])
  if (error) {
    console.error(`[elections] organizer list failed for ${g.familyCode}: ${error.message}`)
    return []
  }

  const rows = (data ?? []) as unknown as RawElection[]
  const ids = rows.map(r => r.id)
  if (!ids.length) return []

  const [posRes, nomRes, voteRes] = await Promise.all([
    admin.from('election_positions').select('election_id, title, max_winners, sort_order')
      .in('election_id', ids).order('sort_order'),
    admin.from('election_nominations').select('election_id').in('election_id', ids),
    admin.from('election_votes').select('election_id').in('election_id', ids),
  ])
  // §8 on all three. A refused positions read renders every election as having no ballot, and
  // a refused count read offers "Return to draft" on an election people have already voted in.
  if (posRes.error || nomRes.error || voteRes.error) {
    console.error('[elections] organizer child reads failed for ' + g.familyCode + ': '
      + (posRes.error?.message ?? nomRes.error?.message ?? voteRes.error?.message))
  }

  const positions = new Map<string, { title: string; max_winners: number }[]>()
  for (const p of (posRes.data ?? []) as
    { election_id: string; title: string; max_winners: number }[]) {
    const list = positions.get(p.election_id) ?? []
    list.push({ title: p.title, max_winners: p.max_winners })
    positions.set(p.election_id, list)
  }
  const tally = (list: { election_id: string }[] | null) => {
    const m = new Map<string, number>()
    for (const r of list ?? []) m.set(r.election_id, (m.get(r.election_id) ?? 0) + 1)
    return m
  }
  const noms = tally(nomRes.data as { election_id: string }[] | null)
  const votes = tally(voteRes.data as { election_id: string }[] | null)

  const today = todayLocal()
  return rows.map(row => ({
    ...mapElection(row, today, places),
    positions: positions.get(row.id) ?? [],
    nomination_count: noms.get(row.id) ?? 0,
    vote_count: votes.get(row.id) ?? 0,
  }))
}

export async function getElectionDetail(id: string): Promise<{
  election: Election | null
  positions: ElectionPosition[]
  nominations: ElectionNomination[]
  myVotes: Record<string, string>
}> {
  const empty = { election: null, positions: [], nominations: [], myVotes: {} }
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return empty
  const familyCode = await getMyFamilyCode(user.id)

  const [electionRes, positionsRes, nominationsRes, supportersRes, places, chapterId, myPerson] =
    await Promise.all([
      supabase.from('elections').select(ELECTION_COLUMNS).eq('id', id).maybeSingle(),
      supabase.from('election_positions').select('*').eq('election_id', id).order('sort_order'),
      supabase
        .from('election_nominations')
        // people!…_nominee_id_fkey: the table also has nominated_by, and a bare
        // `people(...)` is refused with PGRST201 — silently, since the error is
        // dropped, leaving every nominee showing as "Unknown".
        .select('id, position_id, nominee_id, accepted, people!election_nominations_nominee_id_fkey(first_name, last_name)')
        .eq('election_id', id),
      // WHO PUT EACH CANDIDATE FORWARD — read as a flat list on the ELECTION and grouped in
      // TypeScript, not as an embed. `election_nomination_supporters` is a junction table
      // with foreign keys to `election_nominations` AND `people`, which is precisely the
      // shape AGENTS.md §8 warns about: it gives PostgREST a second, many-to-many path
      // between that pair, so a bare `people(...)` embed anywhere on `election_nominations`
      // would now answer PGRST201 — that is, `[]` — on a query nobody had edited. Reading
      // this table on its own `election_id` sidesteps the question entirely, and the two
      // columns wanted here are ids rather than names.
      supabase.from('election_nomination_supporters')
        .select('nomination_id, person_id').eq('election_id', id),
      familyPlaces(familyCode),
      myChapterId(user.id, familyCode),
      getMyPersonId(user.id),
    ])

  const row = electionRes.data as unknown as RawElection | null
  if (!row) return empty

  // The RLS policies have already refused an election outside the caller's area, so this is
  // the app-layer half of the same answer (§5) — and the layer that would still be here if a
  // later change moved this read to the admin client.
  if (electionAreaMatch({
    election: row, memberChapterId: chapterId, chapterRegions: places.chapterRegions,
  }) !== 'in') return empty

  // A draft is not a member-facing election. `getElectionsForMember` drops them from the list;
  // dropping them here too is what stops a URL being the way around that.
  if (row.status !== 'published'
      && !(await can(user.id, 'admin/elections', 'view'))) return empty

  const myVotes: Record<string, string> = {}
  if (myPerson) {
    const { data: votes } = await supabase
      .from('election_votes')
      .select('position_id, nominee_id')
      .eq('election_id', id)
      .eq('voter_id', myPerson)
    for (const v of votes ?? []) myVotes[v.position_id] = v.nominee_id
  }

  const election = mapElection(row, todayLocal(), places)

  // §8: an empty supporter list and a refused read look identical and are very different
  // facts. The first means nobody has been nominated; the second would silently strip every
  // retract control off the screen and report "nominated by 0" beside people who are plainly
  // standing, which reads as the feature being broken rather than as a read having failed.
  if (supportersRes.error) {
    console.error(`[elections] supporter read failed for election ${id}: `
      + supportersRes.error.message
      + ' — nomination counts and retract controls will be wrong until this is fixed.')
  }

  // nomination_id -> the people.id of everybody who put that candidate forward.
  const supporters = new Map<string, Set<string>>()
  for (const s of (supportersRes.data ?? []) as
    { nomination_id: string; person_id: string }[]) {
    const set = supporters.get(s.nomination_id) ?? new Set<string>()
    set.add(s.person_id)
    supporters.set(s.nomination_id, set)
  }

  const nominationsAreOpen = election.phase === 'nominations'

  return {
    election,
    positions: (positionsRes.data ?? []) as ElectionPosition[],
    nominations: (nominationsRes.data ?? []).map(n => {
      const mine = Boolean(myPerson && supporters.get(n.id)?.has(myPerson))
      return {
        id: n.id,
        position_id: n.position_id,
        nominee_id: n.nominee_id,
        nominee_name: nameOf(embedOne<PersonNameRow>(n.people)),
        accepted: n.accepted,
        nominator_count: supporters.get(n.id)?.size ?? 0,
        i_nominated: mine,
        // The same three conjuncts `perm:family can retract a nomination` carries, in the
        // same order. The nominee carve-out is what "withdraw my own nomination" means: a
        // self-nomination is auto-accepted, so without it the one person guaranteed to be
        // able to stand could never stand down.
        retractable: mine && nominationsAreOpen
          && (n.accepted !== true || n.nominee_id === myPerson),
      }
    }),
    myVotes,
  }
}

/**
 * The members who may stand in one election — the nominee picker's list.
 *
 * ── GATE THE FETCH, NOT THE PICKER (§5) ────────────────────────────────────────────
 * This used to be `getMembers()`, the whole family roster, handed to a `<select>` that the
 * nomination policy would then refuse for anybody outside the area. Two things were wrong
 * with that: a member of the Austin chapter was offered every relative in the family and told
 * "no" only after choosing one, and the roster reached the browser in the RSC payload whether
 * the control rendered it or not. So the area rule runs here, and the picker offers exactly
 * the people who can be nominated.
 *
 * ACCOUNTS AND RECORDS BOTH. A recorded grandmother with no login can hold an office — that is
 * what `people` rows without a `user_id` are (AGENTS.md §4b) — and nothing about a nomination
 * needs her to sign in. This is a nominee list, not a voter list; the vote is keyed on the
 * caller's own person row and needs no picker at all.
 */
export async function getElectionNomineeOptions(electionId: string): Promise<ElectionNominee[]> {
  const g = await requireMember()
  if (!g.ok) return []
  if (!(await can(g.userId, 'community/elections', 'view'))) return []
  if (!(await belongsToFamily('elections', electionId, g.familyCode))) return []

  const admin = createAdminClient()
  const [electionRes, places] = await Promise.all([
    admin.from('elections').select('scope, region_id, chapter_id')
      .eq('id', electionId).eq('family_code', g.familyCode).maybeSingle(),
    familyPlaces(g.familyCode),
  ])
  const election = electionRes.data as
    { scope: string | null; region_id: string | null; chapter_id: string | null } | null
  if (!election) return []

  const { data, error } = await admin
    .from('people')
    .select('id, first_name, last_name, nick_name, chapter_id')
    .eq('family_code', g.familyCode)
    .eq('membership_status', 'approved')
    .order('last_name')
  if (error) {
    console.error(`[elections] nominee list failed for ${g.familyCode}: ${error.message}`)
    return []
  }

  type Row = ElectionNominee & { chapter_id: string | null }
  return ((data ?? []) as Row[])
    .filter(p => electionAreaMatch({
      election, memberChapterId: p.chapter_id, chapterRegions: places.chapterRegions,
    }) === 'in')
    .map(({ id, first_name, last_name, nick_name }) => ({ id, first_name, last_name, nick_name }))
}

/**
 * Vote tallies for one election.
 *
 * Reads through the SERVICE-ROLE client, because a tally has to count every vote including
 * those the reader cannot see individually — which is now every vote but their own, since
 * 20260821000001 put `election_votes`' cross-member SELECT behind `admin/elections:view`.
 * That bypasses RLS entirely, so the family scoping RLS would have done is done here by hand:
 * `election_votes` carries no `family_code` of its own, so the check belongs on the election
 * the id names. Without it, `id` is the only thing standing between any signed-in user and
 * another family's results — and this returns nominee names, not just numbers.
 *
 * AND THE AREA CHECK IS HERE FOR THE SAME REASON. No policy applies on this client, so the
 * one thing that keeps a Georgia member out of the Austin chapter's results is this function.
 */
export async function getElectionResults(id: string): Promise<ElectionVoteCount[]> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return []

  const familyCode = await getMyFamilyCode(user.id)
  if (!(await belongsToFamily('elections', id, familyCode))) return []
  if (!(await can(user.id, 'community/elections', 'view'))) return []

  const admin = createAdminClient()
  const [electionRes, places, chapterId] = await Promise.all([
    admin.from('elections').select('scope, region_id, chapter_id')
      .eq('id', id).eq('family_code', familyCode).maybeSingle(),
    familyPlaces(familyCode),
    myChapterId(user.id, familyCode),
  ])
  const election = electionRes.data as
    { scope: string | null; region_id: string | null; chapter_id: string | null } | null
  if (!election) return []

  const inArea = electionAreaMatch({
    election, memberChapterId: chapterId, chapterRegions: places.chapterRegions,
  }) === 'in'
  if (!inArea && !(await can(user.id, 'admin/elections', 'view'))) return []

  const { data: votes } = await admin
    .from('election_votes')
    // Disambiguated to the nominee; voter_id is the other foreign key to people.
    .select('position_id, nominee_id, people!election_votes_nominee_id_fkey(first_name, last_name)')
    .eq('election_id', id)

  const counts = new Map<string, { nominee_name: string; count: number }>()
  for (const v of votes ?? []) {
    const key = `${v.position_id}::${v.nominee_id}`
    const name = nameOf(embedOne<PersonNameRow>(v.people))
    const existing = counts.get(key)
    counts.set(key, { nominee_name: name, count: (existing?.count ?? 0) + 1 })
  }

  return [...counts.entries()].map(([key, val]) => {
    const [position_id, nominee_id] = key.split('::')
    return { position_id, nominee_id, nominee_name: val.nominee_name, vote_count: val.count }
  })
}

/**
 * Everything an organizer needs to watch a published election run.
 *
 * ── WHAT IT ANSWERS, AND WHY EACH FIGURE IS HERE ───────────────────────────────────
 * Four questions, and none of them is answerable from the list screen:
 *
 *   how many nominations, and how many accepted   whether there is a ballot at all
 *   how many members may vote                     the denominator for everything below
 *   how many have                                 whether to chase anybody, and how hard
 *   who is ahead, per office                      the thing an organizer is actually asked
 *
 * ── THE LIVE TALLY IS NOT A NEW DISCLOSURE, WHICH IS WHY IT IS ALLOWED ─────────────
 * A running count while the poll is open looks like a change to the secret ballot and is not.
 * `20260821000001` put `election_votes`' cross-member SELECT behind `admin/elections:view`
 * precisely so an organizer can see the votes — before it, `perm:admins can view all votes`
 * was satisfied by the member view grant and every relative in the family could read who voted
 * for whom. So the holder of this key can already read every row off PostgREST; this screen
 * shows them the aggregate instead of making them do it by hand.
 *
 * WHAT IS STILL NOT PUBLISHED, and must not become so: WHICH WAY ANY NAMED PERSON VOTED.
 * `notVoted` is a COUNT and not a list, and that is deliberate — a roster of who has not voted
 * yet is the beginning of a roster of who voted for whom, and an organizer who wants to chase
 * people has the Directory. The tallies are per CANDIDATE, never per voter.
 *
 * ── THE ELECTORATE IS ACCOUNTS ONLY ────────────────────────────────────────────────
 * `castVote` resolves the voter from `requireMember()`, so voting needs an approved membership
 * AND an account to sign in with. A recorded grandmother can be NOMINATED and cannot vote
 * (AGENTS.md §4b: a picker is accounts-only, a projection is not — and a denominator for
 * turnout is a picker's question, since counting people who cannot vote would report a family
 * as half-hearted when it is not).
 *
 * ── ADMIN CLIENT, FAMILY-SCOPED BY HAND (§3) ───────────────────────────────────────
 * Four reads, every one carrying the family or an id that came out of a family-scoped read.
 * The user client is wrong here for the reason `getElectionsForOrganizer` states: this screen
 * shows an organizer every level, and `elections` is narrowed by AREA for anybody the override
 * does not cover — so a chapter election would answer `[]` for an organizer in another chapter
 * and the screen would render "not found" over a ballot they are running.
 */
export interface ElectionNominationTotals {
  total: number
  accepted: number
  /** Asked, and has not answered. These are not on the ballot yet. */
  pending: number
  declined: number
}

export interface ElectionElectorate {
  /** Approved members of the election's area WITH an account. See above. */
  eligible: number
  voted: number
  /** `eligible - voted`, floored at zero. A count, never a list. */
  notVoted: number
}

export interface ElectionCandidateTally {
  nominee_id: string
  nominee_name: string
  accepted: boolean | null
  vote_count: number
}

export interface ElectionPositionTally {
  position_id: string
  title: string
  max_winners: number
  /** Accepted candidates first, then by votes, then by name. See the note on the sort. */
  candidates: ElectionCandidateTally[]
  /** Votes cast FOR THIS OFFICE. Not every voter votes in every one. */
  votes_cast: number
}

export interface ElectionSummary {
  election: Election
  nominations: ElectionNominationTotals
  electorate: ElectionElectorate
  positions: ElectionPositionTally[]
}

export async function getElectionSummary(id: string): Promise<ElectionSummary | null> {
  const g = await requireScope('admin/elections', 'view')
  if (!g.ok) return null

  const admin = createAdminClient()
  const { data: row } = await admin.from('elections')
    .select(ELECTION_COLUMNS).eq('id', id).eq('family_code', g.familyCode).maybeSingle()
  const raw = row as unknown as RawElection | null
  if (!raw) return null

  const [places, positionsRes, nominationsRes, votesRes, peopleRes] = await Promise.all([
    familyPlaces(g.familyCode),
    admin.from('election_positions').select('id, title, max_winners, sort_order')
      .eq('election_id', id).order('sort_order'),
    // Disambiguated to the nominee: `election_nominations` also has `nominated_by`, and a bare
    // `people(...)` is PGRST201 — which is `[]` with the error discarded (§8), leaving every
    // candidate showing as "Unknown".
    admin.from('election_nominations')
      .select('position_id, nominee_id, accepted, people!election_nominations_nominee_id_fkey(first_name, last_name)')
      .eq('election_id', id),
    admin.from('election_votes').select('position_id, voter_id, nominee_id').eq('election_id', id),
    // The electorate. `user_id` comes back rather than being filtered in SQL because the count
    // of ACCOUNTS is one of the answers — filtering it away in the query would leave the
    // eligible figure indistinguishable from "everybody, including people who cannot sign in".
    admin.from('people').select('id, user_id, chapter_id')
      .eq('family_code', g.familyCode).eq('membership_status', 'approved'),
  ])

  // §8 on all four. Every one of these is a NUMBER on a screen an organizer makes decisions
  // from, and a refused read reports as zero — "nobody has voted" over a poll that is running
  // is the worst wrong answer this screen can give.
  if (positionsRes.error || nominationsRes.error || votesRes.error || peopleRes.error) {
    console.error(`[elections] summary reads failed for ${id}: `
      + (positionsRes.error?.message ?? nominationsRes.error?.message
        ?? votesRes.error?.message ?? peopleRes.error?.message))
    return null
  }

  const election = mapElection(raw, todayLocal(), places)

  // ── The electorate ───────────────────────────────────────────────────────────────
  const eligibleIds = new Set(
    ((peopleRes.data ?? []) as { id: string; user_id: string | null; chapter_id: string | null }[])
      .filter(p => p.user_id != null)
      .filter(p => electionAreaMatch({
        election: raw, memberChapterId: p.chapter_id, chapterRegions: places.chapterRegions,
      }) === 'in')
      .map(p => p.id),
  )

  const votes = (votesRes.data ?? []) as
    { position_id: string; voter_id: string; nominee_id: string }[]

  // VOTERS ARE NARROWED TO THE ELIGIBLE SET, which is not paranoia about the ballot box. A
  // member who voted and has since MOVED CHAPTER is no longer in the area, so counting their
  // vote in `voted` while they are absent from `eligible` would report a turnout above 100%.
  // Their vote still stands and still counts in the tallies below — what it stops being is
  // part of the denominator's numerator.
  const voted = new Set(votes.map(v => v.voter_id).filter(vid => eligibleIds.has(vid)))

  const electorate: ElectionElectorate = {
    eligible: eligibleIds.size,
    voted: voted.size,
    notVoted: Math.max(0, eligibleIds.size - voted.size),
  }

  // ── Nominations ──────────────────────────────────────────────────────────────────
  interface NomRow {
    position_id: string
    nominee_id: string
    accepted: boolean | null
    people: unknown
  }
  const noms = (nominationsRes.data ?? []) as unknown as NomRow[]
  const nominations: ElectionNominationTotals = {
    total: noms.length,
    accepted: noms.filter(n => n.accepted === true).length,
    pending: noms.filter(n => n.accepted === null).length,
    declined: noms.filter(n => n.accepted === false).length,
  }

  // ── Per office ───────────────────────────────────────────────────────────────────
  const tally = new Map<string, number>()
  for (const v of votes) tally.set(`${v.position_id}::${v.nominee_id}`,
    (tally.get(`${v.position_id}::${v.nominee_id}`) ?? 0) + 1)

  const positions = ((positionsRes.data ?? []) as
    { id: string; title: string; max_winners: number; sort_order: number }[])
    .map(pos => {
      const candidates = noms
        // A DECLINED NOMINATION IS NOT A CANDIDATE and is dropped, matching the member's own
        // ballot. Its count is still in `nominations.declined` above, which is where an
        // organizer looks to see that somebody was asked and said no.
        .filter(n => n.position_id === pos.id && n.accepted !== false)
        .map(n => ({
          nominee_id: n.nominee_id,
          nominee_name: nameOf(embedOne<PersonNameRow>(n.people)),
          accepted: n.accepted,
          vote_count: tally.get(`${pos.id}::${n.nominee_id}`) ?? 0,
        }))
        // ACCEPTED FIRST, then votes, then name. Votes alone would put a candidate who has
        // not answered above one who has and is losing — and only accepted candidates can be
        // voted for at all (`castVote` refuses the rest), so a pending nominee with zero votes
        // is not "last", they are not yet running.
        .sort((a, b) =>
          Number(b.accepted === true) - Number(a.accepted === true)
          || b.vote_count - a.vote_count
          || a.nominee_name.localeCompare(b.nominee_name))

      return {
        position_id: pos.id,
        title: pos.title,
        max_winners: pos.max_winners,
        candidates,
        votes_cast: votes.filter(v => v.position_id === pos.id).length,
      }
    })

  return { election, nominations, electorate, positions }
}

/**
 * The regions and chapters an election can be scoped to, and the offices at each level.
 *
 * Gated on the section that renders it and on nothing else — `admin/elections:view` — for the
 * reason `getDuesScopeOptions` gives: names of regions and chapters are family structure
 * rather than PII, and an organizer setting up a chapter election has to be able to see which
 * chapters exist.
 *
 * IT OFFERS ONLY WHAT EXISTS. Empty arrays for a family with no regions and no chapters —
 * which is every family below Plus, since `/admin/members/organization` is `tier: 'plus'` — so
 * the form offers National alone rather than a disabled tease for something they cannot
 * create. National is not in either list because it is not a row: it is the absence of a
 * region, and the form's own default.
 *
 * THE OFFICES COME BACK WITH THEIR LEVEL, unsplit, and the form filters them with
 * `rolesForScope` as the organizer changes the level. Splitting them into three arrays here
 * would put the level rule in two places — this function and `createElection` — and the whole
 * point of `rolesForScope` is that there is one.
 */
export async function getElectionScopeOptions(): Promise<{
  regions: { id: string; name: string }[]
  chapters: { id: string; name: string; region_id: string | null }[]
  roles: { name: string; scope: string | null }[]
}> {
  const empty = { regions: [], chapters: [], roles: [] }
  const g = await requireScope('admin/elections', 'view')
  if (!g.ok) return empty

  const admin = createAdminClient()
  const [regionsRes, chaptersRes, rolesRes] = await Promise.all([
    admin.from('regions').select('id, name').eq('family_code', g.familyCode).order('name'),
    admin.from('chapters').select('id, name, region_id').eq('family_code', g.familyCode).order('name'),
    admin.from('family_roles').select('name, scope').eq('family_code', g.familyCode).order('sort_order'),
  ])
  // §8: an empty picker and a refused query are the same shape and very different facts.
  if (regionsRes.error || chaptersRes.error || rolesRes.error) {
    console.error('[elections] could not read scope options for ' + g.familyCode + ': '
      + (regionsRes.error?.message ?? chaptersRes.error?.message ?? rolesRes.error?.message))
    return empty
  }
  return {
    regions: (regionsRes.data ?? []) as { id: string; name: string }[],
    chapters: (chaptersRes.data ?? []) as { id: string; name: string; region_id: string | null }[],
    roles: (rolesRes.data ?? []) as { name: string; scope: string | null }[],
  }
}

/**
 * `scope`, `region_id` and `chapter_id` as they are safe to write.
 *
 * Both write actions spread client-supplied values, and both are `'use server'` exports with
 * URLs of their own — so the form is not in their request path and `scope: 'chapter'` with no
 * chapter can arrive. `elections_scope_targets` would refuse that with a constraint violation
 * for a message; this turns it into the one thing it can honestly mean, which is National.
 *
 * FAILING TOWARD NATIONAL IS VISIBLE — the row reads "National" on the organizer's list and on
 * every member's screen — where failing the other way would silently hand a ballot to one
 * chapter. Same call, and the same argument, as `normalizeScope` in app/actions/dues.ts.
 *
 * IT DOES NOT CHECK THE FAMILY. That is §4 and it is the caller's job, because the answer
 * needs a database round trip: `belongsToFamily` on each id, before it is written onto a row
 * whose own `family_code` satisfies every policy.
 */
function normalizeScope(input: {
  scope?: string | null
  region_id?: string | null
  chapter_id?: string | null
}): { scope: ElectionScope; region_id: string | null; chapter_id: string | null } {
  const scope = electionScope(input)
  if (scope === 'regional' && input.region_id) {
    return { scope, region_id: input.region_id, chapter_id: null }
  }
  if (scope === 'chapter' && input.chapter_id) {
    return { scope, region_id: null, chapter_id: input.chapter_id }
  }
  return { scope: 'national', region_id: null, chapter_id: null }
}

/**
 * That every id written onto the row belongs to this family (§4).
 *
 * The guard trigger `elections_guard_scope_family` refuses the same thing underneath, because
 * these actions write through the service-role client and a trigger is the half it cannot
 * ignore. This is what supplies a sentence instead of a 42501.
 */
async function scopeBelongs(
  scope: { region_id: string | null; chapter_id: string | null },
  familyCode: string,
): Promise<string | null> {
  if (scope.region_id && !(await belongsToFamily('regions', scope.region_id, familyCode))) {
    return 'That region is not in this family.'
  }
  if (scope.chapter_id && !(await belongsToFamily('chapters', scope.chapter_id, familyCode))) {
    return 'That chapter is not in this family.'
  }
  return null
}

/**
 * That every position named belongs to a family office AT THIS LEVEL.
 *
 * ── THE LEVELS DO NOT CROSS-POLLINATE, AND THIS IS WHERE IT IS ENFORCED ────────────
 * A chapter election fills chapter-scoped offices and no other, because a result at the wrong
 * level is one nobody can act on: a chapter cannot seat the family's national treasurer.
 * `family_roles.scope` already records which level each office belongs to, so this is a check
 * against a fact the family has stated rather than a new one.
 *
 * NOT A CONSTRAINT, AND NOT A TRIGGER — see `rolesForScope` in lib/election-area.ts for the
 * argument. `election_positions.title` is a COPY of the office name, kept for provenance, and
 * a trigger validating it against the roster would refuse every later write to an election
 * whose office has since been renamed or retired.
 *
 * SO THIS ACTION IS THE BOUNDARY, which is why it reads the roster on the admin client and why
 * `createElection` writes through the service role rather than sharing the table with a policy
 * that cannot express this.
 */
async function positionsAtLevel(
  titles: string[],
  scope: ElectionScope,
  familyCode: string,
): Promise<string | null> {
  if (!titles.length) return null

  const { data, error } = await createAdminClient()
    .from('family_roles').select('name, scope').eq('family_code', familyCode)
  if (error) {
    console.error(`[elections] roster read failed for ${familyCode}: ${error.message}`)
    return 'Could not read this family’s board positions. Try again.'
  }

  const allowed = new Set(
    rolesForScope((data ?? []) as { name: string; scope: string | null }[], scope)
      .map(r => r.name),
  )
  const wrong = titles.filter(t => !allowed.has(t))
  if (!wrong.length) return null

  const LEVEL = { national: 'national', regional: 'regional', chapter: 'chapter' } as const
  return `${wrong.join(', ')} ${wrong.length === 1 ? 'is not a' : 'are not'} `
    + `${LEVEL[scope]} board position. A ${LEVEL[scope]} election can only fill `
    + `${LEVEL[scope]} offices — add or re-scope the position under Members › Organization first.`
}

export interface ElectionInput extends WindowInput {
  title: string
  description: string
  scope: string
  region_id: string | null
  chapter_id: string | null
  positions: { title: string; max_winners: number }[]
}

/**
 * Create an election, as a DRAFT.
 *
 * ── IT IS ALWAYS A DRAFT, WHATEVER THE FORM SENT ───────────────────────────────────
 * Publishing is `publishElection`, a second act with its own confirmation, because publishing
 * is what puts a ballot in front of the family. An organizer who has just typed four dates
 * and a list of offices is exactly the person who should look at it once before it goes out.
 *
 * ── THE SERVICE-ROLE CLIENT, AND WHY (§3) ──────────────────────────────────────────
 * See the module header. In short: this action is the only enforcement of the position-level
 * rule, so it must be the only path to the table. Every statement carries `family_code`, every
 * client-supplied id is checked with `belongsToFamily` first (§4), and
 * `elections_guard_scope_family` is the backstop underneath.
 *
 * `requireScope` and not `can()`: that guard demands the UNRESTRICTED grant, which is right
 * because creating an election is family-wide configuration and the row an organizer would
 * "own" is the abuse case (AGENTS.md §2, `canAny`).
 */
export async function createElection(
  input: ElectionInput,
): Promise<{ success: boolean; id?: string; message?: string }> {
  const g = await requireScope('admin/elections', 'create')
  if (!g.ok) return { success: false, message: g.message }

  const title = input.title?.trim() ?? ''
  if (!title) return { success: false, message: 'Give the election a title.' }

  // A draft may be half-written, so the windows are only checked against each other.
  const problem = windowProblem(input, { requireAll: false })
  if (problem) return { success: false, message: problem }

  const scope = normalizeScope(input)
  const badScope = await scopeBelongs(scope, g.familyCode)
  if (badScope) return { success: false, message: badScope }

  const positions = (input.positions ?? [])
    .map(p => ({ title: (p.title ?? '').trim(), max_winners: normalizeWinners(p.max_winners) }))
    .filter(p => p.title)
  const badLevel = await positionsAtLevel(positions.map(p => p.title), scope.scope, g.familyCode)
  if (badLevel) return { success: false, message: badLevel }

  const admin = createAdminClient()
  const { data: election, error } = await admin.from('elections').insert({
    family_code: g.familyCode,
    title,
    description: input.description?.trim() || null,
    status: 'draft',
    nominations_open_on: input.nominations_open_on || null,
    nominations_close_on: input.nominations_close_on || null,
    voting_open_on: input.voting_open_on || null,
    voting_close_on: input.voting_close_on || null,
    ...scope,
    created_by: g.personId,
  }).select('id').single()
  if (error) return { success: false, message: error.message }

  if (positions.length) {
    const { error: posError } = await admin.from('election_positions').insert(
      positions.map((p, i) => ({
        election_id: election.id, title: p.title, max_winners: p.max_winners, sort_order: i,
      })),
    )
    // §8b's shape, one layer up: the election exists and its ballot does not, which would
    // render as an election with no offices and nothing anywhere saying why.
    if (posError) {
      return {
        success: false, id: election.id,
        message: `The election was created but its positions were not: ${posError.message}`,
      }
    }
  }

  revalidatePath('/admin/elections')
  return { success: true, id: election.id }
}

/**
 * `election_positions.max_winners`, as it is safe to write.
 *
 * The number input is not in this action's request path. 0 and a negative are a position
 * nobody can win, and the CHECK-free column would take either. 1 is what the form defaults to
 * and what an office means.
 */
function normalizeWinners(value: unknown): number {
  const n = Math.round(Number(value))
  if (!Number.isFinite(n) || n < 1) return 1
  return Math.min(n, 50)
}

/**
 * Edit a DRAFT — its title, its dates, its level.
 *
 * ── ONLY WHILE IT IS A DRAFT, AND THAT IS THE PRODUCT DECISION ─────────────────────
 * Once an election is published, its windows are what the family was told. Moving them
 * afterwards does not correct a typo, it changes what a ballot WAS: a nomination submitted
 * inside a window that has since been redrawn was made under terms nobody can now read off
 * the row, and a voting window pushed later re-opens a poll the family watched close.
 *
 * The same reasoning `dues_schedules_freeze_used_terms` applies to a due once the ledger has
 * been posted against it, and the same escape hatch: `unpublishElection` pulls a published
 * election back to draft — and refuses once anybody has acted, which is where the analogy
 * lands. So an organizer can fix a mistake right up until it has consequences, and never
 * after.
 */
export async function updateElection(
  id: string,
  input: ElectionInput,
): Promise<{ success: boolean; message?: string }> {
  const g = await requireScope('admin/elections', 'edit')
  if (!g.ok) return { success: false, message: g.message }

  const admin = createAdminClient()
  const { data: existing } = await admin.from('elections')
    .select('status').eq('id', id).eq('family_code', g.familyCode).maybeSingle()
  if (!existing) return { success: false, message: 'Election not found' }
  if ((existing as { status: string }).status !== 'draft') {
    return {
      success: false,
      message: 'A published election cannot be edited. Return it to draft first — which is only '
        + 'possible while nobody has been nominated and no vote has been cast.',
    }
  }

  const title = input.title?.trim() ?? ''
  if (!title) return { success: false, message: 'Give the election a title.' }
  const problem = windowProblem(input, { requireAll: false })
  if (problem) return { success: false, message: problem }

  const scope = normalizeScope(input)
  const badScope = await scopeBelongs(scope, g.familyCode)
  if (badScope) return { success: false, message: badScope }

  // The incoming ballot, checked against the incoming LEVEL. Both may have moved in one
  // submission — changing a national election to a chapter one changes which offices are
  // sayable — so neither is checked against the stored version of the other.
  const positions = (input.positions ?? [])
    .map(p => ({ title: (p.title ?? '').trim(), max_winners: normalizeWinners(p.max_winners) }))
    .filter(p => p.title)
  const badLevel = await positionsAtLevel(positions.map(p => p.title), scope.scope, g.familyCode)
  if (badLevel) return { success: false, message: badLevel }

  const outcome = await confirmWrite(() => admin.from('elections').update({
    title,
    description: input.description?.trim() || null,
    nominations_open_on: input.nominations_open_on || null,
    nominations_close_on: input.nominations_close_on || null,
    voting_open_on: input.voting_open_on || null,
    voting_close_on: input.voting_close_on || null,
    ...scope,
  }).eq('id', id).eq('family_code', g.familyCode).select('id'))
  if (!outcome.ok) return { success: false, message: outcome.message }

  // ── THE BALLOT IS REPLACED WHOLESALE, WHICH IS ONLY SAFE BECAUSE THIS IS A DRAFT ──
  // A draft can hold no nominations and no votes — both INSERT policies test
  // `election_window_open()`, which is false for anything not published — so there is nothing
  // pointing at these rows for a cascade to take, and `election_positions.id` is not an
  // identity anybody outside this election has seen. On a PUBLISHED election the same two
  // statements would silently delete every nomination and vote attached to a position, by
  // cascade, with a success message on top; that is why `updateElection` refuses one.
  const { error: clearError } = await admin.from('election_positions')
    .delete().eq('election_id', id)
  if (clearError) return { success: false, message: clearError.message }
  if (positions.length) {
    const { error: posError } = await admin.from('election_positions').insert(
      positions.map((p, i) => ({
        election_id: id, title: p.title, max_winners: p.max_winners, sort_order: i,
      })),
    )
    if (posError) {
      return {
        success: false,
        message: `The election was saved but its positions were not: ${posError.message}`,
      }
    }
  }

  revalidatePath('/admin/elections')
  revalidatePath(`/community/elections/${id}`)
  return { success: true }
}

/**
 * Publish a draft — put it on the family's calendar.
 *
 * All four dates, and at least one position: an election with no offices is a ballot with
 * nothing on it, and the database cannot say so (`election_positions` has no minimum). The
 * date rule IS in the database — `elections_published_has_windows` — and is checked here too,
 * so an organizer gets a sentence rather than a constraint name.
 *
 * THERE IS NOTHING TO PRESS AFTER THIS. Nominations open on their date, close on theirs,
 * voting opens and closes on its own, and the election is over. That is the whole of what
 * "the dates work like start and end dates" means.
 */
export async function publishElection(
  id: string,
  opts?: { announce?: boolean },
): Promise<{ success: boolean; message?: string }> {
  const g = await requireScope('admin/elections', 'edit')
  if (!g.ok) return { success: false, message: g.message }

  const admin = createAdminClient()
  const { data: row } = await admin.from('elections')
    .select(ELECTION_COLUMNS).eq('id', id).eq('family_code', g.familyCode).maybeSingle()
  const existing = row as unknown as RawElection | null
  if (!existing) return { success: false, message: 'Election not found' }
  if (existing.status === 'published') return { success: true }

  const problem = windowProblem({
    nominations_open_on: existing.nominations_open_on ?? '',
    nominations_close_on: existing.nominations_close_on ?? '',
    voting_open_on: existing.voting_open_on ?? '',
    voting_close_on: existing.voting_close_on ?? '',
  }, { requireAll: true })
  if (problem) return { success: false, message: problem }

  const { count } = await admin.from('election_positions')
    .select('id', { count: 'exact', head: true }).eq('election_id', id)
  if (!count) {
    return {
      success: false,
      message: 'Add at least one position before publishing — a ballot with no offices on it '
        + 'has nothing to vote for.',
    }
  }

  const outcome = await confirmWrite(() => admin.from('elections')
    .update({ status: 'published' })
    .eq('id', id).eq('family_code', g.familyCode).select('id'))
  if (!outcome.ok) return { success: false, message: outcome.message }

  if (opts?.announce) await announceElection(g, existing)

  revalidatePath('/admin/elections')
  revalidatePath('/community/elections')
  return { success: true }
}

/**
 * Post a family announcement about a newly published election.
 *
 * ── THE ANNOUNCEMENT IS ADDRESSED THE SAME WAY THE ELECTION IS ─────────────────────
 * `announcements` has carried `scope` and `chapter_id` since 20260609000001 and
 * `lib/announcement-audience.ts` is what reads them, so a chapter election's announcement goes
 * to that chapter and nowhere else. The old code posted `scope: 'national'` unconditionally,
 * which for a scoped election would have told the whole family about a ballot most of them
 * cannot see — which is the exact failure this whole change is about, arriving through the
 * notice board instead.
 *
 * `announcements` HAS NO `region_id`, only `chapter_id`, so a REGIONAL election's announcement
 * is posted family-wide and names its region in the body. That is a real limitation stated
 * rather than papered over: the alternative is one post per chapter in the region, which is
 * several rows nobody can edit as one.
 *
 * It fails soft. A notice board entry must never undo the publication it announces — the same
 * rule `lib/notifications.ts` and every `sendEmail` call site follow — so the error is read
 * (§8) and logged, and publishing has already succeeded by the time this runs.
 */
async function announceElection(g: GuardOk, election: RawElection) {
  const scope = electionScope(election)
  const opensOn = formatDate(election.nominations_open_on)
  const places = await familyPlaces(g.familyCode)
  const where = electionScopeLabel(election, {
    region: election.region_id ? places.regionNames.get(election.region_id) : null,
    chapter: election.chapter_id ? places.chapterNames.get(election.chapter_id) : null,
  })

  const parts = [
    scope === 'national'
      ? `A new election, "${election.title}", is open to the whole family.`
      : `A new election, "${election.title}", is for ${where}.`,
    election.description || null,
    opensOn ? `Nominations open ${opensOn}.` : null,
  ].filter(Boolean)

  const { error } = await createAdminClient().from('announcements').insert({
    family_code: g.familyCode,
    title: `New Election: ${election.title}`,
    body: parts.join(' '),
    // Chapter-scoped elections address their chapter; regional ones go family-wide and say
    // which region in the body, because `announcements` has no region column.
    scope: scope === 'chapter' ? 'chapter' : 'national',
    chapter_id: scope === 'chapter' ? election.chapter_id : null,
    pinned: false,
    author_id: g.personId,
  })
  if (error) {
    console.error(`[elections] announcement for ${election.id} failed: ${error.message}`)
    return
  }
  revalidatePath('/community/announcements')
  revalidatePath('/dashboard')
}

/**
 * Pull a published election back to a draft — but only while nobody has acted on it.
 *
 * The escape hatch `updateElection` refers to, and it is deliberately narrow. Once a
 * nomination has been submitted or a vote cast, the election is a record of something the
 * family did and there is nothing here that may quietly undo it: the honest options at that
 * point are to let it run or to DELETE it, which says out loud that the nominations and votes
 * go too.
 */
export async function unpublishElection(
  id: string,
): Promise<{ success: boolean; message?: string }> {
  const g = await requireScope('admin/elections', 'edit')
  if (!g.ok) return { success: false, message: g.message }

  const admin = createAdminClient()
  const { data: existing } = await admin.from('elections')
    .select('id').eq('id', id).eq('family_code', g.familyCode).maybeSingle()
  if (!existing) return { success: false, message: 'Election not found' }

  const [noms, votes] = await Promise.all([
    admin.from('election_nominations').select('id', { count: 'exact', head: true })
      .eq('election_id', id),
    admin.from('election_votes').select('id', { count: 'exact', head: true })
      .eq('election_id', id),
  ])
  if ((noms.count ?? 0) > 0 || (votes.count ?? 0) > 0) {
    return {
      success: false,
      message: `This election already has ${noms.count ?? 0} nomination(s) and `
        + `${votes.count ?? 0} vote(s), so it cannot be taken back to draft. Let it run, or `
        + 'delete it — which removes every nomination and vote with it.',
    }
  }

  const outcome = await confirmWrite(() => admin.from('elections')
    .update({ status: 'draft' })
    .eq('id', id).eq('family_code', g.familyCode).select('id'))
  if (!outcome.ok) return { success: false, message: outcome.message }

  revalidatePath('/admin/elections')
  revalidatePath('/community/elections')
  return { success: true }
}

export async function deleteElection(id: string): Promise<{ success: boolean; message?: string }> {
  // Deleting takes every nomination and vote with it, so it is gated on the delete
  // grant rather than edit.
  const g = await requireScope('admin/elections', 'delete')
  if (!g.ok) return { success: false, message: g.message }

  const admin = createAdminClient()
  const { error } = await admin
    .from('elections').delete().eq('id', id).eq('family_code', g.familyCode)
  if (error) return { success: false, message: error.message }
  revalidatePath('/admin/elections')
  revalidatePath('/community/elections')
  return { success: true }
}

/**
 * Nominate somebody, or yourself.
 *
 * ── A SELF-SERVICE ACTION, SO `requireMember()` AND THREE CHECKS OF ITS OWN ────────
 * Any approved member may nominate — `create` defaults to scope 'none', so demanding a grant
 * would leave nobody able to stand for anything. "No permission needed" never means "no check
 * needed" (AGENTS.md §2), and the three here are what the grant would otherwise have covered:
 *
 *   * the election is in the caller's family (§4 — `electionId` arrives from the client),
 *   * NOMINATIONS ARE ACTUALLY OPEN, by the dates rather than by a stored word,
 *   * and the nominee is in the election's AREA, which is the rule the levels turn on.
 *
 * All three are held underneath by the INSERT policy — `election_window_open()` and
 * `election_area_includes_person()` — which is what makes this endpoint safe rather than
 * merely polite. These exist so a member reads a sentence instead of watching a write vanish.
 */
export async function submitNomination(
  electionId: string,
  positionId: string,
  nomineeId: string,
): Promise<{ success: boolean; message?: string }> {
  const g = await requireMember()
  if (!g.ok) return { success: false, message: g.message }

  if (!(await belongsToFamily('elections', electionId, g.familyCode))) {
    return { success: false, message: 'Election not found' }
  }
  if (!(await belongsToFamily('people', nomineeId, g.familyCode))) {
    return { success: false, message: 'That person is not in this family.' }
  }

  const admin = createAdminClient()
  const { data: row } = await admin.from('elections')
    .select(ELECTION_COLUMNS).eq('id', electionId).eq('family_code', g.familyCode).maybeSingle()
  const election = row as unknown as RawElection | null
  if (!election) return { success: false, message: 'Election not found' }

  const phase = electionPhase({ ...election, status: election.status }, todayLocal())
  if (phase !== 'nominations') {
    return { success: false, message: nominationsClosedMessage(election, phase) }
  }

  // The position has to be ON this election. `positionId` is a client parameter and
  // `election_positions` carries no `family_code` of its own, so the election is what scopes
  // it — the same shape as `getElectionResults`' check on `election_votes`.
  const { data: position } = await admin.from('election_positions')
    .select('id').eq('id', positionId).eq('election_id', electionId).maybeSingle()
  if (!position) return { success: false, message: 'That position is not on this ballot.' }

  const places = await familyPlaces(g.familyCode)
  const { data: nominee } = await admin.from('people')
    .select('chapter_id, membership_status')
    .eq('id', nomineeId).eq('family_code', g.familyCode).maybeSingle()
  const nomineeRow = nominee as
    { chapter_id: string | null; membership_status: string | null } | null
  if (!nomineeRow) return { success: false, message: 'That person is not in this family.' }
  if (nomineeRow.membership_status !== 'approved') {
    return { success: false, message: 'That person has not finished joining the family yet.' }
  }
  if (electionAreaMatch({
    election, memberChapterId: nomineeRow.chapter_id, chapterRegions: places.chapterRegions,
  }) !== 'in') {
    return {
      success: false,
      message: 'That person is not in the part of the family this election is for.',
    }
  }

  // Through the USER client, so the INSERT policy is what finally decides — the guard above
  // is the message, not the boundary.
  const supabase = await createClient()
  const { error } = await supabase.from('election_nominations').insert({
    election_id: electionId,
    position_id: positionId,
    nominee_id: nomineeId,
    nominated_by: g.personId,
    // Self-nominations are accepted automatically; nominations of others await acceptance.
    accepted: g.personId === nomineeId ? true : null,
  })

  // ── A COLLISION IS A SECOND NOMINATOR, NOT A FAILURE ─────────────────────────────
  // 23505 is UNIQUE (election_id, position_id, nominee_id): somebody has already put this
  // person forward for this office. Before `20260821000004` that was the end of the road and
  // the caller was told "they have already been nominated" — which is true and is not what
  // they asked for. They asked to nominate them, and a candidacy is one row with MANY
  // nominators now, so the answer is to add their name to it.
  //
  // The candidacy is read by its natural key rather than returned by the failed insert,
  // because the insert returned nothing: PostgREST answers a conflict with an error, not with
  // the conflicting row, and `ON CONFLICT` is not reachable through supabase-js's `insert`.
  //
  // ADMIN CLIENT FOR THE READ, family-scoped through the election, because the caller may
  // hold `view` at 'own' — in which case the composed SELECT policy shows them only
  // candidacies they nominated, and the one they have just collided with would come back
  // empty. §3 by hand: the election is already verified as this family's above.
  if (error?.code === '23505') {
    const { data: existing } = await admin.from('election_nominations')
      .select('id')
      .eq('election_id', electionId).eq('position_id', positionId).eq('nominee_id', nomineeId)
      .maybeSingle()
    if (!existing) {
      // The row collided and then could not be found, which means it went away between the
      // two statements — somebody retracted the last nomination of them. Reported rather
      // than retried, because a retry loop against a moving row is how a button comes to do
      // something twice.
      return {
        success: false,
        message: 'That nomination was withdrawn while you were looking at it. Try again.',
      }
    }
    return addNominationSupport(electionId, (existing as { id: string }).id, g.personId)
  }
  if (error) return { success: false, message: error.message }

  revalidatePath(`/community/elections/${electionId}`)
  return { success: true }
}

/**
 * Add the caller's name to a candidacy somebody else has already created.
 *
 * ── THE USER CLIENT, AND THE POLICY IS THE WHOLE BOUNDARY ──────────────────────────
 * `perm:family can support a nomination` pins `person_id` to `auth_person_id()`, so a caller
 * cannot put another member's name on a nomination whatever they send — which is why this
 * takes no person parameter (§2b: never take an identity as a parameter). It also tests the
 * nominations window, the caller's own area, and the same create-grant expression the
 * candidacy's own INSERT policy tests, so there is nothing left for this function to check
 * that the policy does not.
 *
 * NOT EXPORTED. It is reached only through `submitNomination`, which has already established
 * that the election is this family's and that the caller may act in it. Exporting it would
 * publish a second endpoint whose only argument is a nomination id — and a `'use server'`
 * export is a public URL (AGENTS.md §2).
 *
 * `personId` IS PASSED IN, from the caller's own `requireMember()` guard, and is never a
 * client parameter — this function has no URL, so there is nothing for one to arrive through.
 * The policy pins the column to `auth_person_id()` regardless, so a wrong value here is a
 * refused write rather than a nomination filed under somebody else's name.
 */
async function addNominationSupport(
  electionId: string,
  nominationId: string,
  personId: string | null,
): Promise<{ success: boolean; message?: string }> {
  // `election_nomination_supporters.person_id` is NOT NULL, and `requireMember()` types
  // `personId` as nullable because a caller can in principle hold a membership with no
  // person row. Checked rather than asserted, the way `castVote` does it: the alternative is
  // a 23502 for a message.
  if (!personId) return { success: false, message: 'Profile not found' }

  const supabase = await createClient()
  const { error } = await supabase.from('election_nomination_supporters').insert({
    nomination_id: nominationId,
    election_id: electionId,
    person_id: personId,
  })
  if (error) {
    // 23505 here is the supporters PRIMARY KEY (nomination_id, person_id) — the caller has
    // already nominated this person for this office. An ordinary collision, and the one
    // message in this function that is not about a refusal.
    if (error.code === '23505') {
      return { success: false, message: 'You have already nominated them for that position.' }
    }
    // 42501 is the INSERT policy refusing. The most likely reasons, in order: nominations
    // closed since the page rendered, or the caller is not in this election's part of the
    // family. Neither is worth guessing at from an error code, so the sentence says what is
    // certain and the phase banner on the screen says the rest.
    if (error.code === '42501') {
      return {
        success: false,
        message: 'That nomination was refused — nominations may have closed, or this election '
          + 'may not be for your part of the family. Reload the page to see where it stands.',
      }
    }
    return { success: false, message: error.message }
  }
  revalidatePath(`/community/elections/${electionId}`)
  return { success: true }
}

/**
 * Take the caller's own name off a nomination.
 *
 * ── ONE RULE, AND THE POLICY IS WHERE IT LIVES ─────────────────────────────────────
 * *You may retract a nomination you made. Not one somebody else made, and not one the nominee
 * has already accepted — unless the nominee is you.* All three conjuncts are in
 * `perm:family can retract a nomination` (`20260821000004` §4c), which is why this function
 * checks none of them: it would be a second copy of a rule that is already enforced, and the
 * copy is what drifts.
 *
 * WHAT IT DOES OWE IS §4 AND §8b. `nominationId` arrives from the client and
 * `election_nomination_supporters` carries no `family_code` of its own, so the election is
 * what scopes it — the same shape as `getElectionResults`' check on `election_votes`. And a
 * DELETE that matches zero rows is `{ error: null }` (AGENTS.md §8b), which on this control is
 * the worst possible lie: the member is told their name is off a nomination that still carries
 * it, and the ballot goes to a vote saying they asked for this candidate. `confirmWrite` is
 * exactly the mechanism for that — an UPDATE-or-DELETE relying on RLS to narrow.
 *
 * THE CANDIDACY MAY GO WITH IT, and that is a trigger rather than a second statement here.
 * `election_nomination_supporters_drop_orphan` deletes the nomination when its last supporter
 * leaves, so "if more than myself nominated them they remain in the list" and its converse are
 * one invariant in the database instead of a branch in this function that two members
 * retracting at once could race.
 */
export async function retractNomination(
  nominationId: string,
  electionId: string,
): Promise<{ success: boolean; message?: string }> {
  const g = await requireMember()
  if (!g.ok) return { success: false, message: g.message }

  if (!(await belongsToFamily('elections', electionId, g.familyCode))) {
    return { success: false, message: 'Election not found' }
  }

  // The nomination has to be ON that election. Without this, `nominationId` is any id in the
  // product and `electionId` is only a family the caller belongs to — so the pair would pass
  // §4 while naming a nomination in somebody else's family. The policy would still refuse the
  // delete (`person_id = auth_person_id()` cannot match a stranger's supporter row), so this
  // is the message rather than the boundary — and it is also what stops a successful-looking
  // no-op being reported as a refusal the caller cannot act on.
  const { data: nomination } = await createAdminClient()
    .from('election_nominations').select('id')
    .eq('id', nominationId).eq('election_id', electionId).maybeSingle()
  if (!nomination) return { success: false, message: 'That nomination is not on this ballot.' }

  const supabase = await createClient()
  const outcome = await confirmWrite(() => supabase
    .from('election_nomination_supporters')
    .delete()
    .eq('nomination_id', nominationId)
    // `person_id` is stated as well, though the DELETE policy pins it: without it the
    // statement ASKS to delete every supporter of this nomination and is narrowed to one row
    // only by the policy — so a future widening of that policy would silently turn this
    // control into "remove everybody's nomination".
    .eq('person_id', g.personId ?? '')
    .select('nomination_id'))
  if (!outcome.ok) {
    return {
      success: false,
      message: 'That could not be withdrawn. Nominations may have closed, or the person may '
        + 'have accepted since this page loaded — an accepted nomination stays on the ballot, '
        + 'and the way off it is for them to decline.',
    }
  }

  revalidatePath(`/community/elections/${electionId}`)
  return { success: true }
}

/** Why a nomination was refused, in terms of the calendar rather than of a state machine. */
function nominationsClosedMessage(election: RawElection, phase: ElectionPhase): string {
  if (phase === 'scheduled') {
    const opens = formatDate(election.nominations_open_on)
    return opens ? `Nominations open ${opens}.` : 'Nominations have not opened yet.'
  }
  if (phase === 'draft') return 'This election has not been published yet.'
  const closed = formatDate(election.nominations_close_on)
  return closed ? `Nominations closed on ${closed}.` : 'Nominations are closed.'
}

export async function respondToNomination(
  nominationId: string,
  accepted: boolean,
  electionId: string,
): Promise<{ success: boolean; message?: string }> {
  const supabase = await createClient()

  // `election_nominations`' composed policy carries `nominee_id = auth_person_id()` as its
  // `self_expr`, so a nominee always reaches their own row — and anybody ELSE matches zero
  // rows unless the family granted them `community/elections:edit`. Zero rows is not an error
  // (lib/confirmed-write.ts), so this used to tell somebody their answer was recorded when
  // no row had changed, which on a nomination is the worst place for it: the election goes
  // ahead reading an `accepted` the nominee believes they set.
  //
  // SINCE 20260821000001 THE POLICY ALSO NARROWS BY AREA, and the self-expression survives
  // it for the reason worth knowing: a nominee is in the election's area by construction —
  // `submitNomination` and the INSERT policy both refuse otherwise — so the conjunct is a
  // no-op for them. A member who has since MOVED CHAPTER is the one case it bites, and the
  // honest reading is that they have left the election, not that they lost a control.
  const outcome = await confirmWrite(() =>
    supabase
      .from('election_nominations')
      .update({ accepted })
      .eq('id', nominationId)
      .select('id'))
  if (!outcome.ok) return { success: false, message: outcome.message }

  revalidatePath(`/community/elections/${electionId}`)
  return { success: true }
}

/**
 * Cast a vote, or change one while the poll is open.
 *
 * Self-service, so `requireMember()` and the checks that come with it — see
 * `submitNomination`. The voter is never a parameter: it is resolved from the caller's own
 * person row, which is what makes the area check about the CALLER rather than about somebody
 * they named.
 */
export async function castVote(
  electionId: string,
  positionId: string,
  nomineeId: string,
): Promise<{ success: boolean; message?: string }> {
  const g = await requireMember()
  if (!g.ok) return { success: false, message: g.message }
  // `election_votes.voter_id` is NOT NULL, and `requireMember()` types `personId` as nullable
  // because a caller can in principle hold a membership with no person row. Checked rather
  // than asserted: the alternative is a 23502 for a message.
  if (!g.personId) return { success: false, message: 'Profile not found' }

  if (!(await belongsToFamily('elections', electionId, g.familyCode))) {
    return { success: false, message: 'Election not found' }
  }

  const admin = createAdminClient()
  const { data: row } = await admin.from('elections')
    .select(ELECTION_COLUMNS).eq('id', electionId).eq('family_code', g.familyCode).maybeSingle()
  const election = row as unknown as RawElection | null
  if (!election) return { success: false, message: 'Election not found' }

  const phase = electionPhase({ ...election, status: election.status }, todayLocal())
  if (phase !== 'voting') {
    const opens = formatDate(election.voting_open_on)
    const closed = formatDate(election.voting_close_on)
    return {
      success: false,
      message: phase === 'closed' && closed ? `Voting closed on ${closed}.`
        : opens ? `Voting opens ${opens}.`
          : 'Voting is not open.',
    }
  }

  const [places, chapterId] = await Promise.all([
    familyPlaces(g.familyCode),
    myChapterId(g.userId, g.familyCode),
  ])
  if (electionAreaMatch({
    election, memberChapterId: chapterId, chapterRegions: places.chapterRegions,
  }) !== 'in') {
    return { success: false, message: 'This election is not for your part of the family.' }
  }

  // The nominee has to be a candidate FOR THIS POSITION on THIS election, and one who
  // accepted. Without this, `nomineeId` is any people.id in the family and a vote can be cast
  // for somebody who is not standing — which the policies permit, since the row is otherwise
  // perfectly well-formed.
  const { data: nomination } = await admin.from('election_nominations')
    .select('id').eq('election_id', electionId).eq('position_id', positionId)
    .eq('nominee_id', nomineeId).eq('accepted', true).maybeSingle()
  if (!nomination) {
    return { success: false, message: 'That person is not a candidate for that position.' }
  }

  const supabase = await createClient()
  const { error } = await supabase.from('election_votes').upsert(
    { election_id: electionId, position_id: positionId, voter_id: g.personId, nominee_id: nomineeId },
    { onConflict: 'election_id,position_id,voter_id' },
  )
  if (error) return { success: false, message: error.message }
  revalidatePath(`/community/elections/${electionId}`)
  return { success: true }
}
