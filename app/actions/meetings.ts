'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { requireMember } from '@/lib/auth/guard'
import { canAny } from '@/lib/auth/permissions'
import { belongsToFamily } from '@/lib/auth/family'
import { normaliseTime } from '@/lib/gathering-when'
import { isValidZone, todayIn } from '@/lib/tz'
import { resolveFamilyZone } from '@/lib/auth/zone'
import { embedOne, type PersonNameRow } from '@/lib/supabase/embed'
import { notifyMeetingScheduled } from '@/lib/notifications'
import { isIsoDate } from '@/lib/calendar'
import { isMinorOn } from '@/lib/age-utils'
import type { PositionScope } from '@/lib/board-positions'
import {
  buildBoards, buildChapters, buildPositions, resolveMeetingRoom,
  type BoardAssignment, type BoardOption, type ChapterOption, type PositionOption,
} from '@/lib/meeting-boards'

/**
 * Meeting Minutes — `/library/meeting-minutes`.
 *
 * ── THE WRITE BOUNDARY IS THIS FILE, AND THAT IS THE DESIGN ────────────────────────
 * The five `meeting_*` tables have a SELECT policy each and NO write policy at all, so per
 * AGENTS.md §2c the browser cannot write them. Every mutation below goes through
 * `createAdminClient()` and re-applies family scoping by hand (§3); five guard triggers refuse
 * a cross-family id underneath (§4), because the service role ignores RLS and does not ignore
 * triggers. `20260822000019` argues why: the rules that decide these writes — "the SECRETARY
 * of this session", "an ATTENDEE of this session" — are not things a permission key can say.
 *
 * So each action here does the same three things in the same order, and the order matters:
 *
 *   1. resolve the caller (`requireMember`, which demands an APPROVED membership)
 *   2. read the row it is about, FAMILY-SCOPED, on the admin client
 *   3. decide from THAT ROW whether this caller may act
 *
 * Reading the row first is what makes "is this caller the secretary" a question about the
 * database rather than about something the client sent.
 *
 * ── WHO MAY DO WHAT ────────────────────────────────────────────────────────────────
 *
 *   schedule a meeting        `library/meeting-minutes:create`
 *   change / close / reopen   `:edit` at 'any', OR being its secretary
 *   delete a meeting          `:delete` at 'any'
 *   topics and notes          THE SECRETARY of that meeting, and only while it is open
 *   vote                      AN ATTENDEE of that meeting, and only while the vote is open
 *
 * `canAny` and never `can`: scope 'own' on this key would mean "a meeting I created", which is
 * not a distinction the feature draws — the secretary is the owner of the minutes and that is
 * a column, not a scope.
 *
 * ── ONLY THE SECRETARY WRITES, AND ONLY WHILE THE MEETING IS OPEN ──────────────────
 * Both halves are checked on every note-shaped write. The second is what makes minutes a
 * RECORD: once the meeting is closed nothing about it changes again, which is the property a
 * family needs from the thing it will cite next year. A secretary who closed too early
 * reopens it — that is a deliberate, visible act rather than an edit nobody can see.
 *
 * ── A VOTE IS CAST ONCE AND CANNOT BE CHANGED ──────────────────────────────────────
 * There is no `updateVote` and there will not be one: `meeting_votes_are_final` refuses UPDATE
 * and DELETE in the database for every role including the service role, so an action that
 * tried would fail rather than quietly succeed. `castMeetingVote` INSERTs, and a second
 * attempt trips the unique constraint and is reported as "you have already voted" rather than
 * as a raw 23505.
 */

export interface MeetingVote {
  voterId: string
  voterName: string
  choice: 'for' | 'against' | 'abstain'
  castAt: string
}

export interface MeetingNote {
  id: string
  body: string
  authorName: string | null
  createdAt: string
  updatedAt: string
}

export interface MeetingTopic {
  id: string
  title: string
  sortOrder: number
  /** Null until a vote is called; set again when it closes. */
  votingOpenedAt: string | null
  votingClosedAt: string | null
  notes: MeetingNote[]
  votes: MeetingVote[]
}

export interface MeetingSession {
  id: string
  title: string
  meetsOn: string
  /** `HH:MM` or null — a wall-clock label, never converted. */
  startTime: string | null
  endTime: string | null
  /** The zone the times were STATED in, for printing beside them. */
  timeZone: string | null
  secretaryId: string | null
  secretaryName: string | null
  createdBy: string | null
  closedAt: string | null
  attendees: { personId: string; name: string }[]
  topicCount: number
  createdAt: string
}

export interface MeetingDetail extends MeetingSession {
  topics: MeetingTopic[]
  /** True when the CALLER is this meeting's secretary — what every write control hangs off. */
  iAmSecretary: boolean
  /** True when the CALLER is on the attendee list — what the ballot hangs off. */
  iAmAttendee: boolean
  /** The caller's own `people.id`, so the client can mark their own vote. */
  myPersonId: string | null
  /** `:edit` at 'any' — may change or close a meeting they are not the secretary of. */
  mayManage: boolean
  /** `:delete` at 'any'. */
  mayDelete: boolean
}

const CHOICES = ['for', 'against', 'abstain'] as const
type Choice = (typeof CHOICES)[number]

/**
 * A PostgREST row, before this module gives it a shape.
 *
 * ── WHY THE CAST, AND WHY IT IS ONE HELPER ────────────────────────────────────────
 * supabase-js infers a result type by PARSING the `.select()` string against the generated
 * `Database` types, and these five tables are newer than the generated types in this repo. The
 * parser cannot resolve `meeting_attendees(...)`, so it answers `GenericStringError` and every
 * field access below fails to compile — which looks like a type error and is really a
 * codegen gap.
 *
 * `rows()` and `row()` are the one place that cast lives, so it can be DELETED IN ONE PLACE the
 * day the types are regenerated, rather than being hunted through eleven call sites. That is
 * the whole reason it is a helper rather than an inline `as unknown as` at each read — the
 * same argument `lib/supabase/embed.ts` makes about `embedOne`.
 *
 * IT IS A CAST AND NOT A VALIDATION, and nothing here pretends otherwise: what actually
 * guarantees these fields is the schema, which the migration wrote and asserts.
 */
type Row = Record<string, unknown>
const rows = (data: unknown): Row[] => (data ?? []) as Row[]
const row = (data: unknown): Row | null => (data ?? null) as Row | null

function personName(row: unknown): string | null {
  const p = embedOne<PersonNameRow>(row)
  return p ? `${p.first_name} ${p.last_name}`.trim() || null : null
}

// -------------------------------------------------------
// Reads
// -------------------------------------------------------

/**
 * Every meeting the family has held or scheduled, newest first.
 *
 * THE USER CLIENT, because the SELECT policy is exactly the narrowing wanted: family plus
 * approval. There is nothing to re-apply by hand, which is §3's preference and not merely a
 * shortcut — a hand-written filter here would be a second copy of the policy.
 */
export async function getMeetings(): Promise<MeetingSession[]> {
  const g = await requireMember()
  if (!g.ok) return []

  const supabase = await createClient()
  const { data, error } = await supabase
    .from('meeting_sessions')
    // THE SECRETARY EMBED NAMES ITS CONSTRAINT. `meeting_sessions` has TWO foreign keys to
    // `people` — `secretary_id` and `created_by` — so a bare `people(...)` is PGRST201, which
    // PostgREST answers by refusing the WHOLE query (§8). That is the one embed mistake this
    // feature could make on day one, so it is made impossible on day one.
    .select(
      '*, people!meeting_sessions_secretary_id_fkey(first_name, last_name), '
      + 'meeting_attendees(person_id, people(first_name, last_name)), '
      + 'meeting_topics(id)',
    )
    .order('meets_on', { ascending: false })

  if (error) {
    console.error(`[meetings] list read failed for ${g.familyCode}: ${error.message}`)
    return []
  }

  return rows(data).map(r => ({
    id: r.id as string,
    title: r.title as string,
    meetsOn: r.meets_on as string,
    startTime: r.start_time ? String(r.start_time).slice(0, 5) : null,
    endTime: r.end_time ? String(r.end_time).slice(0, 5) : null,
    timeZone: (r.time_zone as string | null) ?? null,
    secretaryId: (r.secretary_id as string | null) ?? null,
    secretaryName: personName(r.people),
    createdBy: (r.created_by as string | null) ?? null,
    closedAt: (r.closed_at as string | null) ?? null,
    attendees: ((r.meeting_attendees ?? []) as { person_id: string; people: unknown }[])
      .map(a => ({ personId: a.person_id, name: personName(a.people) ?? 'Unknown' }))
      .sort((a, b) => a.name.localeCompare(b.name)),
    topicCount: ((r.meeting_topics ?? []) as unknown[]).length,
    createdAt: r.created_at as string,
  }))
}

/** One meeting, with its topics, their notes and their ballots. */
export async function getMeetingDetail(id: string): Promise<MeetingDetail | null> {
  const g = await requireMember()
  if (!g.ok) return null

  const supabase = await createClient()
  const [sessionRes, topicsRes, mayManage, mayDelete] = await Promise.all([
    supabase
      .from('meeting_sessions')
      .select(
        '*, people!meeting_sessions_secretary_id_fkey(first_name, last_name), '
        + 'meeting_attendees(person_id, people(first_name, last_name))',
      )
      .eq('id', id)
      .maybeSingle(),
    supabase
      .from('meeting_topics')
      .select(
        '*, meeting_topic_notes(id, body, created_at, updated_at, people(first_name, last_name)), '
        + 'meeting_votes(voter_id, choice, cast_at, people(first_name, last_name))',
      )
      .eq('session_id', id)
      .order('sort_order')
      .order('created_at'),
    canAny(g.userId, 'library/meeting-minutes', 'edit'),
    canAny(g.userId, 'library/meeting-minutes', 'delete'),
  ])

  if (sessionRes.error) {
    console.error(`[meetings] detail read failed for ${id}: ${sessionRes.error.message}`)
    return null
  }
  if (!sessionRes.data) return null
  if (topicsRes.error) {
    console.error(`[meetings] topics read failed for ${id}: ${topicsRes.error.message}`)
  }

  const r = row(sessionRes.data) as Row
  const attendees = ((r.meeting_attendees ?? []) as { person_id: string; people: unknown }[])
    .map(a => ({ personId: a.person_id, name: personName(a.people) ?? 'Unknown' }))
    .sort((a, b) => a.name.localeCompare(b.name))

  const topics: MeetingTopic[] = rows(topicsRes.data).map(t => ({
    id: t.id as string,
    title: t.title as string,
    sortOrder: t.sort_order as number,
    votingOpenedAt: (t.voting_opened_at as string | null) ?? null,
    votingClosedAt: (t.voting_closed_at as string | null) ?? null,
    notes: ((t.meeting_topic_notes ?? []) as Row[])
      .map(n => ({
        id: n.id as string,
        body: n.body as string,
        authorName: personName(n.people),
        createdAt: n.created_at as string,
        updatedAt: n.updated_at as string,
      }))
      // OLDEST FIRST: minutes are read down the page in the order the room said them.
      .sort((a, b) => a.createdAt.localeCompare(b.createdAt)),
    votes: ((t.meeting_votes ?? []) as Row[])
      .map(v => ({
        voterId: v.voter_id as string,
        voterName: personName(v.people) ?? 'Unknown',
        choice: v.choice as Choice,
        castAt: v.cast_at as string,
      }))
      .sort((a, b) => a.voterName.localeCompare(b.voterName)),
  }))

  return {
    id: r.id as string,
    title: r.title as string,
    meetsOn: r.meets_on as string,
    startTime: r.start_time ? String(r.start_time).slice(0, 5) : null,
    endTime: r.end_time ? String(r.end_time).slice(0, 5) : null,
    timeZone: (r.time_zone as string | null) ?? null,
    secretaryId: (r.secretary_id as string | null) ?? null,
    secretaryName: personName(r.people),
    createdBy: (r.created_by as string | null) ?? null,
    closedAt: (r.closed_at as string | null) ?? null,
    attendees,
    topicCount: topics.length,
    createdAt: r.created_at as string,
    topics,
    iAmSecretary: Boolean(g.personId) && r.secretary_id === g.personId,
    iAmAttendee: attendees.some(a => a.personId === g.personId),
    myPersonId: g.personId || null,
    mayManage,
    mayDelete,
  }
}

/** May the caller schedule a meeting? For the button, never for the gate. */
export async function mayScheduleMeeting(): Promise<boolean> {
  const g = await requireMember()
  if (!g.ok) return false
  return canAny(g.userId, 'library/meeting-minutes', 'create')
}

/**
 * ADULTS ONLY, AND `isMinorOn` IS THE ONE DEFINITION.
 *
 * AGENTS.md §4b: there is no `is_minor` column and there must not be — a stored boolean about
 * age is wrong the moment it is written, because the row does not change when the person has
 * a birthday. `minorCutoff` in `lib/age-utils.ts` is the single rule and this reads it.
 *
 * A MEMBER WITH NO RECORDED BIRTHDAY IS AN ADULT HERE, which is `isMinorOn`'s own answer for
 * a null and is the right default rather than a gap. "Under eighteen" is something a family
 * has RECORDED about somebody; assuming it of a blank field would silently refuse to let a
 * grandmother whose birthday nobody entered take the minutes, and there would be nothing on
 * the screen to explain why. It is the same reading `propagateChapterToChildren` takes, for
 * the same reason.
 */
async function adultCheck(
  personIds: readonly string[],
  familyCode: string,
): Promise<{ ok: true; minorNames: Map<string, string> } | { ok: false; message: string }> {
  if (personIds.length === 0) return { ok: true, minorNames: new Map() }
  const { data, error } = await createAdminClient()
    .from('people')
    .select('id, first_name, last_name, date_of_birth')
    .eq('family_code', familyCode)
    .in('id', [...new Set(personIds)])
  // §8: an empty result is not the same as no rows. Reporting "everybody is an adult" over a
  // refused read is the failure direction that matters, so a refusal is a refusal.
  if (error) {
    console.error(`[meetings] could not check ages for ${familyCode}: ${error.message}`)
    return { ok: false, message: 'Could not check who is an adult just now. Nothing was saved.' }
  }
  // THE FAMILY'S ZONE. "Is this person eighteen?" changes at midnight in SOME zone, and
  // two members must not disagree about whether a relative may take the minutes. The old
  // `todayLocal()` read UTC, so somebody counted as an adult five hours early.
  const today = todayIn(await resolveFamilyZone(familyCode))
  const minorNames = new Map<string, string>()
  for (const r of rows(data)) {
    if (!isMinorOn(r.date_of_birth as string | null, today)) continue
    minorNames.set(
      r.id as string,
      `${r.first_name as string} ${r.last_name as string}`.trim() || 'Somebody',
    )
  }
  // RETURNS A MAP, not a list of names, so one read answers both rules: the caller has to
  // tell "the secretary is a minor" from "one of the people you added is", and the two have
  // different remedies. A list of names would need a second query to say which was which.
  return { ok: true, minorNames }
}

/**
 * The bodies and the adults a meeting's attendee list can be built from.
 *
 * ── WHY A BODY AT ALL, RATHER THAN A LIST OF NAMES ─────────────────────────────────
 * A family meeting is almost always a BODY meeting — the national board, one chapter's board,
 * every chapter president, one chapter, the whole family — and ticking eleven names out of a
 * hundred and forty to describe one of those is both tedious and wrong the following month,
 * when somebody has been replaced. Picking the body says what the organizer means, and it
 * resolves against whoever is in it on the day the meeting is scheduled.
 *
 * FOUR KINDS SINCE 2026-08-22, because the scheduling form now asks which kind of meeting this
 * is before it shows anything to pick. `chapters` and `everyoneIds` are the two that arrived
 * with it, and they are the ones a family with no offices set up can still use — which is most
 * families on their first day.
 *
 * The shaping is `lib/meeting-boards.ts`, which is pure and tested; this function is the read
 * that feeds it. Five family-scoped queries and a TypeScript join, for the reason
 * `getBoardPositionHolders` states at length: `user_roles` has no foreign key to `people` at
 * all — it points at `auth.users` — so a `people(...)` embed under it is PGRST200, which
 * answers `[]` in silence (§8).
 *
 * ── THE ADMIN CLIENT, SO §3 IS DISCHARGED BY HAND ──────────────────────────────────
 * Every one of the five reads states `.eq('family_code', …)`. It has to be the admin client
 * rather than the caller's: `family_roles` and `user_roles` are gated on
 * `admin/members/board-positions`, and somebody scheduling a meeting is not thereby an
 * administrator of the family's offices. Reading through their own client would hand most
 * organizers an empty board list with nothing to say why.
 *
 * ── GATED ON THE SAME GRANT AS SCHEDULING (§5) ─────────────────────────────────────
 * `library/meeting-minutes:create` at `canAny` — what this returns is the roster plus who
 * holds which office, which is not a thing to serialize into the RSC payload of somebody who
 * cannot open the dialog it fills. `canAny` and not `can`, because there is no "own" version
 * of the family's board.
 */
export interface MeetingAttendeeOptions {
  boards: BoardOption[]
  positions: PositionOption[]
  /**
   * EVERY CHAPTER WITH AN ADULT IN IT, since 2026-08-22 — the room a chapter meeting is
   * actually held in, which is the whole chapter rather than its board. `buildChapters`
   * argues why that is a different body from `chapter:<id>` in `boards`, and why this one is
   * adult-filtered while a board is not.
   */
  chapters: ChapterOption[]
  /**
   * Every approved ADULT's `people.id` — what "a general family meeting" resolves to.
   *
   * IT IS THE SAME SET `adults` LISTS, as ids rather than as pickable people. Two shapes
   * because they answer different questions: `adults` feeds a picker that has to tell two
   * Martha Allens apart, and this feeds `resolveMeetingRoom`, which only unions ids. Derived
   * from one filter so they cannot disagree about who is an adult.
   */
  everyoneIds: string[]
  /**
   * Everybody who may be added BY NAME on top of the boards — approved ADULTS, whether or not
   * they have an account. `SelectablePerson`-shaped so `PersonMultiSelect` can tell two
   * Martha Allens apart against the whole roster.
   */
  adults: { id: string; first_name: string; last_name: string; nick_name: string | null }[]
  /** Who each resolved id is, so the dialog can say what ticking a board just added. */
  names: Record<string, string>
  /**
   * THE CALLER'S OWN `people.id`, so the form can offer them as the secretary by default.
   *
   * A DEFAULT AND NOT A DECISION: whoever schedules a meeting is usually the one who will
   * write it down, and making them find their own name in a picker of a hundred and forty is
   * the sort of friction that gets a field left blank. The control is a normal picker and they
   * can change it, and `scheduleMeeting` takes whatever it is sent — this field decides
   * nothing on the server.
   *
   * `null` for a caller with no `people` row in the active family, which `requireMember`
   * already refuses; the type is honest about the guard's own return rather than asserting.
   */
  myPersonId: string | null
}

const NO_OPTIONS: MeetingAttendeeOptions = {
  boards: [], positions: [], chapters: [], everyoneIds: [], adults: [], names: {},
  myPersonId: null,
}

export async function getMeetingAttendeeOptions(): Promise<MeetingAttendeeOptions> {
  const g = await requireMember()
  if (!g.ok) return NO_OPTIONS
  if (!(await canAny(g.userId, 'library/meeting-minutes', 'create'))) return NO_OPTIONS

  const admin = createAdminClient()
  const [assignmentsRes, positionsRes, peopleRes, chaptersRes, regionsRes] = await Promise.all([
    admin.from('user_roles')
      .select('user_id, role_id, scope, chapter_id, region_id')
      .eq('family_code', g.familyCode),
    admin.from('family_roles').select('id, name').eq('family_code', g.familyCode),
    admin.from('people')
      // `chapter_id` since 2026-08-22, for the chapter bodies — see `buildChapters`. It is
      // the one column here that is about WHERE somebody is rather than who they are.
      .select('id, user_id, first_name, last_name, nick_name, date_of_birth, chapter_id')
      .eq('family_code', g.familyCode)
      .eq('membership_status', 'approved'),
    admin.from('chapters').select('id, name').eq('family_code', g.familyCode),
    admin.from('regions').select('id, name').eq('family_code', g.familyCode),
  ])

  // §8 on all five. A refused read renders "this family has no boards" over a family with
  // four, and the organizer has no way to tell that from the truth.
  const failed = assignmentsRes.error ?? positionsRes.error ?? peopleRes.error
    ?? chaptersRes.error ?? regionsRes.error
  if (failed) {
    console.error(`[meetings] attendee options read failed for ${g.familyCode}: ${failed.message}`)
    return NO_OPTIONS
  }

  const positionName = new Map(rows(positionsRes.data).map(p => [p.id as string, p.name as string]))
  const regionNames = new Map(rows(regionsRes.data).map(r => [r.id as string, r.name as string]))
  const chapterNames = new Map(rows(chaptersRes.data).map(c => [c.id as string, c.name as string]))

  const people = rows(peopleRes.data)
  const displayName = (r: Row) =>
    `${r.first_name as string} ${r.last_name as string}`.trim() || 'Unnamed member'
  const byUserId = new Map(people.filter(r => r.user_id).map(r => [r.user_id as string, r]))

  const assignments: BoardAssignment[] = rows(assignmentsRes.data)
    // A position from another family cannot appear — every read above is family-scoped — so
    // an assignment naming one is a row 20260819000004 should have repointed. Dropping it is
    // the safe direction; the alternative is an unlabelled board nobody can explain.
    .filter(a => positionName.has(a.role_id as string))
    .flatMap(a => {
      const person = byUserId.get(a.user_id as string)
      // An assignment whose account is no longer one of this family's people. There is
      // nobody to invite, so there is nothing to put on a board.
      if (!person) return []
      return [{
        personId:   person.id as string,
        personName: displayName(person),
        roleId:     a.role_id as string,
        roleName:   positionName.get(a.role_id as string) as string,
        scope:      (a.scope as PositionScope | null) ?? 'national',
        regionId:   (a.region_id as string | null) ?? null,
        chapterId:  (a.chapter_id as string | null) ?? null,
      }]
    })

  // THE FAMILY'S ZONE. "Is this person eighteen?" changes at midnight in SOME zone, and
  // two members must not disagree about whether a relative may take the minutes. The old
  // `todayLocal()` read UTC, so somebody counted as an adult five hours early.
  const today = todayIn(await resolveFamilyZone(g.familyCode))
  // ── ONE ADULT FILTER, THREE CONSUMERS ─────────────────────────────────────────────
  // `adults` (the pickers), `everyoneIds` (a general family meeting) and `chapters` (a
  // chapter meeting) are all derived from this array, so nothing here can disagree about who
  // is an adult. `isMinorOn` in `lib/age-utils.ts` is the one definition, and a member with
  // no recorded birthday is an adult — "under eighteen" is something a family has recorded,
  // not something to assume about a blank field.
  //
  // BOARDS ARE DELIBERATELY NOT FILTERED, which is why `buildBoards` above is fed the raw
  // assignments: somebody in an office is somebody the family appointed, and dropping them
  // over a recorded birthday would be the product overruling that appointment.
  // `scheduleMeeting`'s header argues it, and `buildChapters` argues why a chapter — which is
  // a place rather than an appointment — goes the other way.
  const adultRows = people.filter(r => !isMinorOn(r.date_of_birth as string | null, today))
  return {
    boards:    buildBoards(assignments, { regionNames, chapterNames }),
    positions: buildPositions(assignments),
    chapters:  buildChapters(
      adultRows.map(r => ({
        personId:   r.id as string,
        personName: displayName(r),
        chapterId:  (r.chapter_id as string | null) ?? null,
      })),
      chapterNames,
    ),
    everyoneIds: adultRows.map(r => r.id as string),
    // `scheduleMeeting` RE-APPLIES the filter for the by-name half. Withholding a minor from
    // the picker is §5; refusing one in the action is the gate, because a server
    // action is a public HTTP endpoint and the page in front of it is a convenience.
    adults: adultRows.map(r => ({
      id:         r.id as string,
      first_name: r.first_name as string,
      last_name:  r.last_name as string,
      nick_name:  (r.nick_name as string | null) ?? null,
    })),
    names: Object.fromEntries(people.map(r => [r.id as string, displayName(r)])),
    // The default secretary, and nothing more — see the field.
    myPersonId: g.personId || null,
  }
}

// -------------------------------------------------------
// The session
// -------------------------------------------------------

/**
 * Schedule a meeting: a title, a date, who is coming, and who is writing it down.
 *
 * ── EVERY ID IS VERIFIED BEFORE IT IS WRITTEN (§4) ─────────────────────────────────
 * `secretaryId` and every `attendeeIds` entry arrive from the client and are written onto rows
 * carrying the CALLER's family code — so every policy would be satisfied while the row pointed
 * into somebody else's family. The guard triggers refuse it underneath, and these checks are
 * what turn a 23514 into a sentence.
 *
 * ── THE SECRETARY IS AN ATTENDEE, WHETHER OR NOT THEY WERE TICKED ──────────────────
 * Somebody writing the minutes was in the room. Adding them here rather than making the form
 * enforce it means the rule holds for a caller who posts to this endpoint directly, and it
 * means the attendee list — which is what decides who may VOTE — cannot be missing the one
 * person who is definitely present.
 *
 * ── AND EVERY ATTENDEE IS TOLD ─────────────────────────────────────────────────────
 * A notification each, with the date, and a link to the meeting. It fails soft and is wrapped:
 * a bell entry must never undo the thing it announces (`lib/notifications.ts`'s rule), and
 * supabase-js RETURNS errors rather than throwing them, so the writers there read `error`
 * themselves. The meeting is already scheduled by the time this runs.
 *
 * ── WHO IS COMING IS FIVE INPUTS SINCE 2026-08-22, AND THEY UNION ──────────────────
 * `boardIds` (whole boards — the national board, a chapter's board), `positionIds` (one office
 * taken across every area that fills it — "every chapter president"), `chapterIds` (a whole
 * chapter's adult membership, which is NOT its board), `wholeFamily` (every approved adult),
 * and `additionalIds` (individual adults on top). All but the last are resolved HERE, against
 * `getMeetingAttendeeOptions()`, rather than being trusted as a list of people the client
 * worked out: a client that sends `boardIds: ['national']` is asking for whoever holds a
 * national office right now, and letting it send the resolved names instead would let it send
 * any names at all. `resolveMeetingRoom` unions them, and `lib/meeting-boards.ts` is where
 * that is argued and tested.
 *
 * `wholeFamily` IS A BOOLEAN FOR EXACTLY THAT REASON. There is no id for "everybody", so a
 * client can only ASK — what everybody turns out to be comes from the roster this action
 * reads. A `everyoneIds: string[]` parameter would be the same endpoint with the rule removed.
 *
 * ── THE FORM ASKS WHICH KIND OF MEETING FIRST, AND THE WIRE DOES NOT CARE ───────────
 * The dialog's second step asks whether this is a board, positions, chapter or general family
 * meeting, and shows only that kind's options. That is a UI NARROWING and nothing more: this
 * action takes the four body fields and unions whatever is present, so a caller who sends
 * boards AND chapters gets both, which is harmless and is one fewer rule to keep in two
 * places. There is deliberately no `audience` parameter to validate against the selection —
 * it would be a second, weaker copy of what the fields already say.
 *
 * ── THE ADULT RULE, AND EXACTLY WHAT IT COVERS ─────────────────────────────────────
 * The SECRETARY must be an adult, and so must every `additionalIds` entry. Those are the two
 * the ask names and the two a person chooses freely.
 *
 * BOARD MEMBERS ARE NOT AGE-CHECKED, deliberately. A board is resolved from `user_roles`, so
 * everybody on it is somebody the family put in an office — and silently dropping an officer
 * from the room because their recorded birthday makes them seventeen would be this function
 * overruling a decision the family already made, invisibly, in a list nobody reads back. If a
 * family should not be able to appoint a minor to an office, that belongs on
 * `assignBoardPosition`, where it can be said out loud.
 *
 * A CHAPTER AND THE WHOLE FAMILY ARE ADULT-FILTERED, AND NOT BY A CHECK HERE. Both are built
 * from `adultRows` inside `getMeetingAttendeeOptions`, so a minor is never in the body to
 * begin with — there is nothing for this function to refuse. That is the right place for it:
 * a chapter's membership is a fact about where somebody lives rather than an appointment the
 * family made, so the picker's rule applies rather than the board's, and `buildChapters`
 * carries the argument. It also means the two checks below stay about the two things a person
 * chose by name, which is what their error messages say.
 *
 * The check is re-applied here and not left to the picker, because a server action is a public
 * HTTP endpoint and the dialog in front of it is a convenience (§2).
 */
export async function scheduleMeeting(input: {
  title: string
  meetsOn: string
  /**
   * `HH:MM`, or absent. A WALL-CLOCK LABEL — two o'clock where the meeting is — never an
   * instant, and never converted for anybody (20260826000004).
   *
   * OPTIONAL, which is a product decision rather than a schema convenience: a family fixing
   * the date first and the hour later is ordinary, and requiring it would block scheduling
   * with nothing useful to say about why.
   */
  startTime?: string | null
  /** `HH:MM`, or absent. Only meaningful with a start, and must be after it. */
  endTime?: string | null
  /** The zone the two above were STATED in. Required as soon as there is a start time. */
  timeZone?: string | null
  secretaryId: string
  boardIds?: string[]
  positionIds?: string[]
  /** Whole chapters — every ADULT in them, not their boards. See `buildChapters`. */
  chapterIds?: string[]
  /** "The whole family": every approved adult, resolved here from the roster. */
  wholeFamily?: boolean
  additionalIds?: string[]
}): Promise<{ success: boolean; id?: string; message?: string }> {
  const g = await requireMember()
  if (!g.ok) return { success: false, message: g.message }
  if (!(await canAny(g.userId, 'library/meeting-minutes', 'create'))) {
    return { success: false, message: 'Not authorized' }
  }

  const title = input.title.trim()
  if (!title) return { success: false, message: 'Give the meeting a title' }
  if (!isIsoDate(input.meetsOn)) return { success: false, message: 'Choose a date for the meeting' }
  if (!input.secretaryId) return { success: false, message: 'Choose who is taking the minutes' }

  // ── THE TIMES, AND THE ZONE THEY ARE STATED IN ────────────────────────────────────
  // Three CHECK constraints on `meeting_sessions` say the same three things
  // (`20260826000004`), and they are the only thing underneath this action — every write here
  // is on the service role. Checked in TypeScript as well so the member is told WHICH field is
  // wrong; a 23514 would only ever surface as "could not schedule that meeting".
  const startTime = normaliseTime(input.startTime)
  const endTime = normaliseTime(input.endTime)
  if (input.startTime && !startTime) {
    return { success: false, message: 'That is not a time we can read' }
  }
  if (input.endTime && !endTime) {
    return { success: false, message: 'That is not a time we can read' }
  }
  if (endTime && !startTime) {
    return { success: false, message: 'Give a start time as well, or leave the end time empty' }
  }
  // ONE DAY, so no cross-day exemption — unlike a gathering, which may legitimately run
  // overnight. `meets_on` is a single date and an end before its start is always a mistake.
  if (startTime && endTime && endTime <= startTime) {
    return { success: false, message: 'The end time has to be after the start time' }
  }
  // A time REQUIRES a zone; a zone with no time is dropped rather than refused, matching the
  // one-directional constraint. See 20260826000003's header for why that asymmetry is right.
  const timeZone = startTime ? (input.timeZone ?? null) : null
  if (startTime && !timeZone) {
    return {
      success: false,
      message: 'Say which timezone the time is in, so relatives elsewhere can read it',
    }
  }
  if (timeZone && !isValidZone(timeZone)) {
    return { success: false, message: 'That is not a timezone we recognise' }
  }

  if (!(await belongsToFamily('people', input.secretaryId, g.familyCode))) {
    return { success: false, message: 'That secretary is not in this family' }
  }

  // ── THE TWO AGE CHECKS, IN ONE READ, BEFORE ANYTHING IS WRITTEN ───────────────────
  // Reported separately and BY NAME, because "somebody you picked is under eighteen" over a
  // list of nine leaves the organizer to work out which — and the two rules have different
  // remedies: a different secretary, or a name taken off the list.
  const additionalIds = [...new Set((input.additionalIds ?? []).filter(Boolean))]
  const ages = await adultCheck([input.secretaryId, ...additionalIds], g.familyCode)
  if (!ages.ok) return { success: false, message: ages.message }

  const minorSecretary = ages.minorNames.get(input.secretaryId)
  if (minorSecretary) {
    return {
      success: false,
      message: `${minorSecretary} is under eighteen. Minutes have to be taken by an adult.`,
    }
  }
  const minorGuests = additionalIds
    .map(id => ages.minorNames.get(id))
    .filter((name): name is string => Boolean(name))
  if (minorGuests.length > 0) {
    return {
      success: false,
      message: minorGuests.length === 1
        ? `${minorGuests[0]} is under eighteen. Only adults can be added to a meeting by name.`
        : `${minorGuests.join(', ')} are under eighteen. Only adults can be added to a meeting by name.`,
    }
  }

  // ── THE BOARDS AND OFFICES, RESOLVED SERVER-SIDE ──────────────────────────────────
  // See the header: the client names bodies, and this decides who is in them. The read is
  // gated on the same grant this action already checked, so it costs nothing extra in
  // authority and everything it returns is family-scoped by hand (§3).
  const selection = {
    boardIds:    input.boardIds ?? [],
    positionIds: input.positionIds ?? [],
    chapterIds:  input.chapterIds ?? [],
    wholeFamily: input.wholeFamily === true,
  }
  const namedABody = selection.wholeFamily
    || selection.boardIds.length > 0
    || selection.positionIds.length > 0
    || selection.chapterIds.length > 0
  let fromBodies: string[] = []
  if (namedABody) {
    const options = await getMeetingAttendeeOptions()
    fromBodies = resolveMeetingRoom(selection, options)
  }

  // DE-DUPLICATED AND WITH THE SECRETARY FOLDED IN, before anything is checked, so the checks
  // below run once per distinct person and the insert cannot trip its own primary key.
  const attendeeIds = [...new Set([...fromBodies, ...additionalIds, input.secretaryId])]
    .filter(Boolean)
  for (const personId of attendeeIds) {
    if (!(await belongsToFamily('people', personId, g.familyCode))) {
      return { success: false, message: 'One of those attendees is not in this family' }
    }
  }

  const admin = createAdminClient()
  const { data: created, error } = await admin
    .from('meeting_sessions')
    .insert({
      family_code: g.familyCode,
      title,
      meets_on: input.meetsOn,
      start_time: startTime,
      end_time: endTime,
      time_zone: timeZone,
      secretary_id: input.secretaryId,
      created_by: g.personId || null,
    })
    .select('id')
    .single()
  const session = row(created)
  if (error || !session) {
    return { success: false, message: error?.message ?? 'Could not schedule that meeting.' }
  }
  const sessionId = session.id as string

  const { error: attendeeError } = await admin.from('meeting_attendees').insert(
    attendeeIds.map(personId => ({
      session_id: sessionId,
      person_id: personId,
      family_code: g.familyCode,
    })),
  )
  if (attendeeError) {
    // THE SESSION GOES BACK. A meeting with no attendee list is one nobody may vote in and
    // nobody was told about, which is worse than no meeting: it looks scheduled.
    //
    // §3 BY HAND, EVEN THOUGH THE ID IS TRANSITIVELY SAFE. `sessionId` came out of the insert
    // eight lines above, which stamped `g.familyCode` — so `.eq('id', …)` alone genuinely
    // cannot reach another family here. The conjunct is added anyway because `.eq('id', id)`
    // as a whole predicate on the admin client is the exact shape that has been a real hole in
    // this codebase four times (`deleteRegion`, `deleteChapter`, `revokeRoleByAssignmentId`,
    // `addGroupMember`), and the safety of this one is a property of the surrounding function
    // rather than of the statement. Found by `npm run audit:family-scope` on 2026-08-22, once
    // its hand-maintained SCOPED_TABLES list was refreshed and could see this table at all.
    await admin.from('meeting_sessions').delete()
      .eq('id', sessionId).eq('family_code', g.familyCode)
    return { success: false, message: attendeeError.message }
  }

  try {
    await notifyMeetingScheduled({
      familyCode: g.familyCode,
      attendeePersonIds: attendeeIds,
      excludePersonId: g.personId || undefined,
      title,
      meetsOn: input.meetsOn,
      link: `/library/meeting-minutes/${sessionId}`,
    })
  } catch (e) {
    console.error(`[meetings] could not announce ${sessionId}: ${(e as Error).message}`)
  }

  revalidatePath('/library/meeting-minutes')
  revalidatePath('/gatherings/calendar')
  return { success: true, id: sessionId }
}

/**
 * The row, plus whether this caller may act on it. Every write below starts here.
 *
 * READ ON THE ADMIN CLIENT AND SCOPED BY HAND, deliberately: the user client would answer
 * through the SELECT policy, which admits every approved member — so it would tell us the row
 * exists but not narrow anything, and the family conjunct would be implicit rather than
 * written down. §3's obligation, discharged where it can be read.
 */
async function loadSession(sessionId: string) {
  const g = await requireMember()
  if (!g.ok) return { ok: false as const, message: g.message }

  const admin = createAdminClient()
  const { data } = await admin
    .from('meeting_sessions')
    .select('id, family_code, secretary_id, closed_at, title')
    .eq('id', sessionId)
    .eq('family_code', g.familyCode)
    .maybeSingle()
  const found = row(data)
  if (!found) return { ok: false as const, message: 'Meeting not found' }

  return {
    ok: true as const,
    g,
    admin,
    row: found,
    isSecretary: Boolean(g.personId) && found.secretary_id === g.personId,
    isOpen: found.closed_at === null,
  }
}

export async function updateMeeting(
  id: string,
  input: { title?: string; meetsOn?: string },
): Promise<{ success: boolean; message?: string }> {
  const s = await loadSession(id)
  if (!s.ok) return { success: false, message: s.message }

  const mayManage = await canAny(s.g.userId, 'library/meeting-minutes', 'edit')
  if (!mayManage && !s.isSecretary) return { success: false, message: 'Not authorized' }

  const patch: Record<string, string> = {}
  if (input.title !== undefined) {
    const title = input.title.trim()
    if (!title) return { success: false, message: 'Give the meeting a title' }
    patch.title = title
  }
  if (input.meetsOn !== undefined) {
    if (!isIsoDate(input.meetsOn)) return { success: false, message: 'That is not a date' }
    patch.meets_on = input.meetsOn
  }
  if (Object.keys(patch).length === 0) return { success: true }

  const { error } = await s.admin
    .from('meeting_sessions').update(patch).eq('id', id).eq('family_code', s.g.familyCode)
  if (error) return { success: false, message: error.message }

  revalidatePath(`/library/meeting-minutes/${id}`)
  revalidatePath('/gatherings/calendar')
  return { success: true }
}

/**
 * Close a meeting, or reopen one.
 *
 * CLOSING IS WHAT MAKES MINUTES A RECORD: nothing about the session changes afterwards. It is
 * REVERSIBLE, and by the secretary as well as by an editor, because closing too early is an
 * ordinary mistake and the alternative is a family with a permanently wrong record. Reopening
 * undoes nothing that was decided — the votes are immutable in the database whatever this
 * column says.
 */
export async function setMeetingClosed(
  id: string,
  closed: boolean,
): Promise<{ success: boolean; message?: string }> {
  const s = await loadSession(id)
  if (!s.ok) return { success: false, message: s.message }

  const mayManage = await canAny(s.g.userId, 'library/meeting-minutes', 'edit')
  if (!mayManage && !s.isSecretary) return { success: false, message: 'Not authorized' }

  const { error } = await s.admin
    .from('meeting_sessions')
    .update({ closed_at: closed ? new Date().toISOString() : null })
    .eq('id', id).eq('family_code', s.g.familyCode)
  if (error) return { success: false, message: error.message }

  revalidatePath(`/library/meeting-minutes/${id}`)
  return { success: true }
}

export async function deleteMeeting(id: string): Promise<{ success: boolean; message?: string }> {
  const s = await loadSession(id)
  if (!s.ok) return { success: false, message: s.message }
  if (!(await canAny(s.g.userId, 'library/meeting-minutes', 'delete'))) {
    return { success: false, message: 'Not authorized' }
  }

  const { error } = await s.admin
    .from('meeting_sessions').delete().eq('id', id).eq('family_code', s.g.familyCode)
  if (error) return { success: false, message: error.message }

  revalidatePath('/library/meeting-minutes')
  revalidatePath('/gatherings/calendar')
  return { success: true }
}

/** Add somebody to the room, or take them off the list. Both are the secretary's or an editor's. */
/**
 * Replace a meeting's attendee list wholesale.
 *
 * ── IT DOES NOT APPLY THE ADULTS-ONLY RULE, AND THAT IS DELIBERATE ─────────────────
 * `scheduleMeeting` refuses a minor as secretary or as somebody added BY NAME. This takes a
 * flat list of ids with no idea which of them came from a board, so applying the same rule
 * here would refuse to re-save a room that legitimately contains an officer the family
 * appointed who is under eighteen — see that function's header for why board members are not
 * age-checked. The rule belongs where the distinction between "you chose this person" and
 * "this person holds an office" still exists, which is at scheduling time.
 *
 * NOTHING CALLS THIS FROM THE UI TODAY. It is still a public HTTP endpoint and is gated as
 * one: the edit grant, or being this meeting's secretary, and the meeting still open.
 */
export async function setMeetingAttendees(
  id: string,
  personIds: string[],
): Promise<{ success: boolean; message?: string }> {
  const s = await loadSession(id)
  if (!s.ok) return { success: false, message: s.message }

  const mayManage = await canAny(s.g.userId, 'library/meeting-minutes', 'edit')
  if (!mayManage && !s.isSecretary) return { success: false, message: 'Not authorized' }
  if (!s.isOpen) return { success: false, message: 'This meeting is closed.' }

  const wanted = [...new Set(
    [...personIds, s.row.secretary_id as string | null].filter(Boolean) as string[],
  )]
  for (const personId of wanted) {
    if (!(await belongsToFamily('people', personId, s.g.familyCode))) {
      return { success: false, message: 'One of those people is not in this family' }
    }
  }

  // ── SOMEBODY WHO HAS VOTED CANNOT BE REMOVED ─────────────────────────────────────
  // Their ballot is in the record and immutable, so taking them off the attendee list would
  // leave a vote cast by somebody the minutes say was not there. Reported rather than
  // silently kept, because an organizer trying to do it needs to know why it did not happen.
  const { data: voters } = await s.admin
    .from('meeting_votes')
    .select('voter_id, meeting_topics!inner(session_id)')
    .eq('family_code', s.g.familyCode)
    .eq('meeting_topics.session_id', id)
  const voted = new Set(rows(voters).map(v => v.voter_id as string))
  const removingAVoter = [...voted].some(v => !wanted.includes(v))
  if (removingAVoter) {
    return {
      success: false,
      message: 'Somebody you are removing has already voted. A vote cannot be withdrawn, so '
        + 'they have to stay on the list.',
    }
  }

  const { error: delError } = await s.admin
    .from('meeting_attendees').delete().eq('session_id', id).eq('family_code', s.g.familyCode)
  if (delError) return { success: false, message: delError.message }

  if (wanted.length > 0) {
    const { error } = await s.admin.from('meeting_attendees').insert(
      wanted.map(personId => ({ session_id: id, person_id: personId, family_code: s.g.familyCode })),
    )
    if (error) return { success: false, message: error.message }
  }

  revalidatePath(`/library/meeting-minutes/${id}`)
  return { success: true }
}

// -------------------------------------------------------
// Topics and notes — the secretary's, and only while it is open
// -------------------------------------------------------

/** The one check every note-shaped write makes. See the module header. */
async function requireSecretaryOfOpenMeeting(sessionId: string) {
  const s = await loadSession(sessionId)
  if (!s.ok) return s
  if (!s.isSecretary) {
    return { ok: false as const, message: 'Only the secretary of this meeting can write its minutes.' }
  }
  if (!s.isOpen) {
    return { ok: false as const, message: 'This meeting is closed. Reopen it to change the minutes.' }
  }
  return s
}

export async function addMeetingTopic(
  sessionId: string,
  title: string,
): Promise<{ success: boolean; id?: string; message?: string }> {
  const s = await requireSecretaryOfOpenMeeting(sessionId)
  if (!s.ok) return { success: false, message: s.message }

  const trimmed = title.trim()
  if (!trimmed) return { success: false, message: 'Give the topic a title' }

  // NEXT IN THE ROOM'S OWN ORDER. Read family-scoped and per session, so two meetings cannot
  // interleave — the same reason `createCustomRole`'s unscoped `MAX(sort_order)` was a bug.
  const { data: lastRow } = await s.admin
    .from('meeting_topics')
    .select('sort_order')
    .eq('session_id', sessionId).eq('family_code', s.g.familyCode)
    .order('sort_order', { ascending: false })
    .limit(1)
    .maybeSingle()
  const last = row(lastRow)

  const { data, error } = await s.admin
    .from('meeting_topics')
    .insert({
      family_code: s.g.familyCode,
      session_id: sessionId,
      title: trimmed,
      sort_order: ((last?.sort_order as number | undefined) ?? 0) + 1,
      created_by: s.g.personId || null,
    })
    .select('id')
    .single()
  const created = row(data)
  if (error || !created) {
    return { success: false, message: error?.message ?? 'Could not add that topic.' }
  }

  revalidatePath(`/library/meeting-minutes/${sessionId}`)
  return { success: true, id: created.id as string }
}

/** The topic's session, so a topic-shaped write can make the same three checks. */
async function loadTopic(topicId: string) {
  const g = await requireMember()
  if (!g.ok) return { ok: false as const, message: g.message }

  const admin = createAdminClient()
  const { data } = await admin
    .from('meeting_topics')
    .select('id, session_id, family_code, voting_opened_at, voting_closed_at, title')
    .eq('id', topicId)
    .eq('family_code', g.familyCode)
    .maybeSingle()
  const topic = row(data)
  if (!topic) return { ok: false as const, message: 'Topic not found' }

  return { ok: true as const, topic, sessionId: topic.session_id as string }
}

export async function updateMeetingTopic(
  topicId: string,
  title: string,
): Promise<{ success: boolean; message?: string }> {
  const t = await loadTopic(topicId)
  if (!t.ok) return { success: false, message: t.message }
  const s = await requireSecretaryOfOpenMeeting(t.sessionId)
  if (!s.ok) return { success: false, message: s.message }

  const trimmed = title.trim()
  if (!trimmed) return { success: false, message: 'Give the topic a title' }

  const { error } = await s.admin
    .from('meeting_topics').update({ title: trimmed })
    .eq('id', topicId).eq('family_code', s.g.familyCode)
  if (error) return { success: false, message: error.message }

  revalidatePath(`/library/meeting-minutes/${t.sessionId}`)
  return { success: true }
}

/**
 * Remove a topic — and, with it, every note and every vote on it.
 *
 * THIS IS THE ONE WAY A VOTE EVER GOES, and the confirmation on screen says so. It is deleting
 * the QUESTION rather than editing an answer, which is the distinction
 * `meeting_votes_are_final` is built around: the trigger allows the cascade (measured through
 * `pg_trigger_depth()`) and refuses everything else.
 */
export async function deleteMeetingTopic(
  topicId: string,
): Promise<{ success: boolean; message?: string }> {
  const t = await loadTopic(topicId)
  if (!t.ok) return { success: false, message: t.message }
  const s = await requireSecretaryOfOpenMeeting(t.sessionId)
  if (!s.ok) return { success: false, message: s.message }

  const { error } = await s.admin
    .from('meeting_topics').delete().eq('id', topicId).eq('family_code', s.g.familyCode)
  if (error) return { success: false, message: error.message }

  revalidatePath(`/library/meeting-minutes/${t.sessionId}`)
  return { success: true }
}

export async function addMeetingNote(
  topicId: string,
  body: string,
): Promise<{ success: boolean; message?: string }> {
  const t = await loadTopic(topicId)
  if (!t.ok) return { success: false, message: t.message }
  const s = await requireSecretaryOfOpenMeeting(t.sessionId)
  if (!s.ok) return { success: false, message: s.message }

  const trimmed = body.trim()
  if (!trimmed) return { success: false, message: 'Write something first' }

  const { error } = await s.admin.from('meeting_topic_notes').insert({
    family_code: s.g.familyCode,
    topic_id: topicId,
    body: trimmed,
    // THE BYLINE IS THE CALLER'S OWN, from the guard and never from an argument — the same
    // rule `addJournalNote` follows, and the reason its INSERT policy's author conjunct is
    // satisfied by construction.
    author_id: s.g.personId || null,
  })
  if (error) return { success: false, message: error.message }

  revalidatePath(`/library/meeting-minutes/${t.sessionId}`)
  return { success: true }
}

export async function updateMeetingNote(
  noteId: string,
  body: string,
): Promise<{ success: boolean; message?: string }> {
  const g = await requireMember()
  if (!g.ok) return { success: false, message: g.message }

  const admin = createAdminClient()
  const { data: noteRow } = await admin
    .from('meeting_topic_notes')
    .select('id, topic_id, family_code, meeting_topics!inner(session_id)')
    .eq('id', noteId).eq('family_code', g.familyCode)
    .maybeSingle()
  const note = row(noteRow)
  if (!note) return { success: false, message: 'Note not found' }

  const sessionId = (note.meeting_topics as { session_id: string }).session_id
  const s = await requireSecretaryOfOpenMeeting(sessionId)
  if (!s.ok) return { success: false, message: s.message }

  const trimmed = body.trim()
  if (!trimmed) return { success: false, message: 'Write something first' }

  const { error } = await s.admin
    .from('meeting_topic_notes').update({ body: trimmed })
    .eq('id', noteId).eq('family_code', s.g.familyCode)
  if (error) return { success: false, message: error.message }

  revalidatePath(`/library/meeting-minutes/${sessionId}`)
  return { success: true }
}

export async function deleteMeetingNote(
  noteId: string,
): Promise<{ success: boolean; message?: string }> {
  const g = await requireMember()
  if (!g.ok) return { success: false, message: g.message }

  const admin = createAdminClient()
  const { data: noteRow } = await admin
    .from('meeting_topic_notes')
    .select('id, family_code, meeting_topics!inner(session_id)')
    .eq('id', noteId).eq('family_code', g.familyCode)
    .maybeSingle()
  const note = row(noteRow)
  if (!note) return { success: false, message: 'Note not found' }

  const sessionId = (note.meeting_topics as { session_id: string }).session_id
  const s = await requireSecretaryOfOpenMeeting(sessionId)
  if (!s.ok) return { success: false, message: s.message }

  const { error } = await s.admin
    .from('meeting_topic_notes').delete().eq('id', noteId).eq('family_code', s.g.familyCode)
  if (error) return { success: false, message: error.message }

  revalidatePath(`/library/meeting-minutes/${sessionId}`)
  return { success: true }
}

// -------------------------------------------------------
// The ballot
// -------------------------------------------------------

/**
 * Call a vote on a topic, or close one.
 *
 * THE SECRETARY CALLS IT, because they are chairing the record — and only while the meeting is
 * open, so a vote cannot be called on a meeting that has already been minuted.
 *
 * REOPENING A CLOSED VOTE IS NOT OFFERED. `voting_closed_at` goes from null to a timestamp and
 * not back: a ballot that can be reopened after the count is a ballot whose result depends on
 * when you looked, and the votes already cast cannot be withdrawn to make a second round fair.
 * A secretary who closed too early deletes the topic and asks again, which is visible.
 */
export async function setTopicVoting(
  topicId: string,
  open: boolean,
): Promise<{ success: boolean; message?: string }> {
  const t = await loadTopic(topicId)
  if (!t.ok) return { success: false, message: t.message }
  const s = await requireSecretaryOfOpenMeeting(t.sessionId)
  if (!s.ok) return { success: false, message: s.message }

  const openedAt = t.topic.voting_opened_at as string | null
  const closedAt = t.topic.voting_closed_at as string | null

  if (open) {
    if (closedAt) {
      return {
        success: false,
        message: 'That vote has already closed. Delete the topic and ask again if it needs a second round.',
      }
    }
    if (openedAt) return { success: true }
  } else if (!openedAt) {
    return { success: false, message: 'No vote has been called on that topic.' }
  } else if (closedAt) {
    return { success: true }
  }

  const patch = open
    ? { voting_opened_at: new Date().toISOString() }
    : { voting_closed_at: new Date().toISOString() }

  const { error } = await s.admin
    .from('meeting_topics').update(patch).eq('id', topicId).eq('family_code', s.g.familyCode)
  if (error) return { success: false, message: error.message }

  revalidatePath(`/library/meeting-minutes/${t.sessionId}`)
  return { success: true }
}

/**
 * Cast a vote. Attendees only, once, and it cannot be taken back.
 *
 * ── THREE CONDITIONS, AND THE FIRST IS THE ONE THE FEATURE IS ABOUT ────────────────
 *   an ATTENDEE of this meeting   — read from `meeting_attendees`, never from a prop
 *   the vote is OPEN              — called and not yet closed
 *   the meeting is OPEN           — a closed meeting is a record
 *
 * ── AND THERE IS NO `updateVote` ───────────────────────────────────────────────────
 * `meeting_votes_are_final` refuses UPDATE and DELETE in the database, for every role
 * including the service role, so an action that tried to change one would fail rather than
 * quietly succeed. A second attempt by the same voter trips
 * `meeting_votes_one_per_voter` and is reported in words — 23505 is the honest refusal here
 * and is turned into a sentence rather than swallowed.
 */
export async function castMeetingVote(
  topicId: string,
  choice: string,
): Promise<{ success: boolean; message?: string }> {
  const g = await requireMember()
  if (!g.ok) return { success: false, message: g.message }
  if (!g.personId) return { success: false, message: 'You have no member record in this family.' }
  if (!(CHOICES as readonly string[]).includes(choice)) {
    return { success: false, message: 'That is not a vote.' }
  }

  const t = await loadTopic(topicId)
  if (!t.ok) return { success: false, message: t.message }

  const s = await loadSession(t.sessionId)
  if (!s.ok) return { success: false, message: s.message }
  if (!s.isOpen) return { success: false, message: 'This meeting is closed.' }

  if (!t.topic.voting_opened_at) {
    return { success: false, message: 'No vote has been called on this topic yet.' }
  }
  if (t.topic.voting_closed_at) {
    return { success: false, message: 'That vote has closed.' }
  }

  const { data: attendingRow } = await s.admin
    .from('meeting_attendees')
    .select('person_id')
    .eq('session_id', t.sessionId).eq('person_id', g.personId).eq('family_code', g.familyCode)
    .maybeSingle()
  if (!row(attendingRow)) {
    return { success: false, message: 'Only people on the attendee list can vote in this meeting.' }
  }

  const { error } = await s.admin.from('meeting_votes').insert({
    family_code: g.familyCode,
    topic_id: topicId,
    voter_id: g.personId,
    choice,
  })
  if (error) {
    return {
      success: false,
      message: error.code === '23505'
        ? 'You have already voted on this. A vote cannot be changed.'
        : error.message,
    }
  }

  revalidatePath(`/library/meeting-minutes/${t.sessionId}`)
  return { success: true }
}
