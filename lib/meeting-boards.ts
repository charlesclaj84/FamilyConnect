import { positionScopeLabel, type PositionScope } from '@/lib/board-positions'
import type { T } from '@/lib/i18n/t'

/**
 * Turning the family's own shape into the bodies a meeting's attendee list can be built from:
 * BOARDS, POSITIONS, CHAPTERS and the whole family.
 *
 * ── FOUR KINDS OF BODY, BECAUSE THE FORM ASKS WHICH KIND FIRST ─────────────────────────
 * Since 2026-08-22 the scheduling dialog's second step asks whether this is a board meeting, a
 * positions meeting, a chapter meeting or a general family meeting, and only then shows what
 * there is to pick. That is a UI narrowing over the same union — the wire still carries which
 * BODIES were named and nothing about the "kind" — and it is the reason the last two exist:
 * `buildChapters` answers "everybody in Austin", which no arrangement of offices can express,
 * and `MeetingBodies.everyoneIds` answers "the whole family", which nothing had to configure.
 *
 * ── WHAT A "BOARD" IS HERE, GIVEN THERE IS NO SUCH TABLE ───────────────────────────────
 * There is no `boards` table and this file does not invent one. A board is the set of people
 * holding an office at one SCOPE in one AREA — which is exactly what `user_roles` already
 * records, through `scope` plus `region_id` or `chapter_id` (`20260610008`, `20260820000000`).
 * So the National Board is everybody with a national assignment, the Texas Region Board is
 * everybody with a regional assignment naming Texas, and so on.
 *
 * That is the same three-word vocabulary an ELECTION scopes itself with (`lib/election-area.ts`)
 * and the same one a board position is created with, and reusing it is the point: a family that
 * has already told the product what shape it is in does not have to say it again in a different
 * vocabulary in order to schedule a meeting.
 *
 * ── A BOARD IS DERIVED FROM ASSIGNMENTS, NOT FROM POSITIONS ────────────────────────────
 * `buildBoards` lists a board only where somebody actually holds an office there. A family can
 * define a "Chapter Treasurer" position and fill it in two chapters out of nine; the other
 * seven have no board to invite, and offering seven empty boards would be offering seven
 * controls that select nobody. The count on each option is what keeps that honest in the
 * other direction — a board with one person in it says so before it is picked.
 *
 * ── A POSITION CUTS THE OTHER WAY, AND THAT IS WHY BOTH EXIST ──────────────────────────
 * "Every chapter's President" is not a board: it is one office taken across every area that
 * fills it. `buildPositions` answers that, keyed on the `family_roles` row — so a family with a
 * National President, a Regional President and a Chapter President row sees three options, and
 * picking the third invites the president of every chapter at once.
 *
 * The two overlap freely and are meant to: picking the National Board and the Chapter
 * President position is a perfectly ordinary way to describe who is coming, and
 * `resolveMeetingRoom` unions them.
 *
 * ── EVERY ID HERE IS A `people.id` ─────────────────────────────────────────────────────
 * `user_roles` keys its holder on `auth.users.id`, which is the `event_assignments` mistake
 * AGENTS.md names. The resolution to a `people.id` happens in the action that reads the table,
 * before anything reaches this module, because that is where the family scoping is and because
 * every consumer downstream — `meeting_attendees.person_id`, `PersonMultiSelect`,
 * `belongsToFamily` — speaks in `people.id`. Nothing in this file knows an auth id exists.
 *
 * ── PURE, PER §7b ──────────────────────────────────────────────────────────────────────
 * No database, no `new Date()`, no React. The adult test that goes with this feature is NOT
 * here: it is `isMinorOn` in `lib/age-utils.ts`, which is already the single definition and
 * already takes `today` as a parameter.
 */

/** One person's hold on one office, as the action hands it over. */
export interface BoardAssignment {
  personId: string
  personName: string
  roleId: string
  roleName: string
  scope: PositionScope
  regionId: string | null
  chapterId: string | null
}

/** A board somebody can be invited as a group: a scope, an area, and who is on it. */
export interface BoardOption {
  /** `national`, `regional:<region id>` or `chapter:<chapter id>` — see `boardKey`. */
  id: string
  label: string
  scope: PositionScope
  areaId: string | null
  personIds: string[]
}

/** One office, taken across every area that fills it. */
export interface PositionOption {
  /** The `family_roles.id`. */
  id: string
  label: string
  scope: PositionScope
  personIds: string[]
}

/**
 * One chapter, and the ADULTS in it — a body whose membership is where somebody lives rather
 * than an office they hold.
 *
 * ── IT IS NOT "THE CHAPTER BOARD", AND THE DIFFERENCE IS THE WHOLE REASON IT EXISTS ──
 * `buildBoards` already answers "the Austin Chapter Board": everybody holding an office
 * there. A CHAPTER MEETING is a different room — every adult in Austin, officer or not — and
 * that is the one a chapter actually calls most often. Neither can be expressed as the other:
 * a board is derived from `user_roles`, this is derived from `people.chapter_id`.
 *
 * ── ADULTS ONLY, AND THAT IS A DECISION RATHER THAN A COPY OF THE BOARD RULE ─────────
 * `scheduleMeeting`'s header explains why board members are NOT age-checked: somebody on a
 * board is somebody the family put in an office, and dropping them over a recorded birthday
 * would be the product overruling that appointment. **A chapter's membership is not an
 * appointment**, so the opposite reading applies and it is the same one the by-name picker
 * takes: a meeting is a room of adults, and a nine-year-old in the Austin chapter is not
 * being invited to it by somebody choosing "Austin".
 *
 * The filter is applied by the CALLER, which owns the roster and the birthdays — this module
 * is pure and takes whoever it is given. `getMeetingAttendeeOptions` passes adults only, and
 * `isMinorOn` in `lib/age-utils.ts` is the one definition of the test.
 */
export interface ChapterOption {
  /** The `chapters.id`. */
  id: string
  label: string
  personIds: string[]
}

/**
 * Every body a meeting's room can be named as, plus the whole-family fallback.
 *
 * ONE BAG RATHER THAN FOUR PARAMETERS, because `resolveMeetingRoom` is called twice — once
 * in the browser as a preview and once in `scheduleMeeting` as the authority — and the two
 * must be given the same thing. A bag is one argument to keep in step; four are four.
 */
export interface MeetingBodies {
  boards: readonly BoardOption[]
  positions: readonly PositionOption[]
  chapters: readonly ChapterOption[]
  /**
   * Every approved ADULT in the family — what "a general family meeting" resolves to.
   *
   * A LIST AND NOT A FLAG, so the same union handles it as handles a board: the caller asks
   * for "the whole family" and this is what the whole family turns out to be. It is also the
   * only body whose membership nothing in the family had to configure, which is why it is the
   * one a family with no chapters and no offices can still use.
   */
  everyoneIds: readonly string[]
}

/** What the client asked for. Every field optional: naming nothing is a room of nobody. */
export interface MeetingRoomSelection {
  boardIds?: readonly string[]
  positionIds?: readonly string[]
  chapterIds?: readonly string[]
  /** "Everybody" — resolved against `everyoneIds`, never against a list the client sent. */
  wholeFamily?: boolean
}

/**
 * The composite key a board is identified by.
 *
 * A composite rather than two fields because it is what a checkbox's `value` has to be and
 * what crosses the wire to the action. `national` has no area, so it is the bare word; the
 * other two are prefixed, which keeps a region id and a chapter id from ever colliding even
 * though both are uuids from different tables.
 */
export function boardKey(scope: PositionScope, areaId: string | null): string {
  if (scope === 'national') return 'national'
  return `${scope}:${areaId ?? 'none'}`
}

/**
 * Every board this family actually has somebody on, in a stable order.
 *
 * The order is National, then regions by name, then chapters by name — the same reading as
 * the board positions screen, largest scope first. Within a board the people are sorted by
 * name so two renders of the same data cannot disagree.
 *
 * A REGIONAL OR CHAPTER ASSIGNMENT WITH NO AREA is dropped, not filed under a "none" board.
 * `user_roles.region_id` and `chapter_id` are nullable and nothing enforces that a regional
 * assignment names a region, so the row can exist; a board captioned "Regional Board" with no
 * region is a control whose meaning nobody could state, and inviting it would be inviting a
 * set the organizer cannot see the shape of.
 */
export function buildBoards(
  assignments: readonly BoardAssignment[],
  names: {
    regionNames: ReadonlyMap<string, string>
    chapterNames: ReadonlyMap<string, string>
  },
): BoardOption[] {
  const byKey = new Map<string, { option: Omit<BoardOption, 'personIds'>; people: Map<string, string> }>()

  for (const a of assignments) {
    const areaId = a.scope === 'regional' ? a.regionId : a.scope === 'chapter' ? a.chapterId : null
    if (a.scope !== 'national' && !areaId) continue

    const key = boardKey(a.scope, areaId)
    let entry = byKey.get(key)
    if (!entry) {
      entry = {
        option: { id: key, label: boardLabel(a.scope, areaId, names), scope: a.scope, areaId },
        people: new Map(),
      }
      byKey.set(key, entry)
    }
    entry.people.set(a.personId, a.personName)
  }

  const rank: Record<PositionScope, number> = { national: 0, regional: 1, chapter: 2 }
  return [...byKey.values()]
    .map(({ option, people }) => ({
      ...option,
      personIds: [...people.entries()]
        .sort((x, y) => x[1].localeCompare(y[1]) || x[0].localeCompare(y[0]))
        .map(([id]) => id),
    }))
    .sort((a, b) => rank[a.scope] - rank[b.scope] || a.label.localeCompare(b.label))
}

/**
 * A board's caption. An unnamed area falls back to the scope word alone rather than printing
 * a uuid — the caller has already dropped those (see `buildBoards`), so this only fires for a
 * region or chapter the names map did not have, which is a read that partly failed.
 */
function boardLabel(
  scope: PositionScope,
  areaId: string | null,
  names: { regionNames: ReadonlyMap<string, string>; chapterNames: ReadonlyMap<string, string> },
): string {
  if (scope === 'national') return 'National Board'
  if (scope === 'regional') {
    const name = areaId ? names.regionNames.get(areaId) : null
    return name ? `${name} Region Board` : 'Regional Board'
  }
  const name = areaId ? names.chapterNames.get(areaId) : null
  return name ? `${name} Chapter Board` : 'Chapter Board'
}

/**
 * Every office somebody holds, with everybody who holds it — "all the chapter presidents" as
 * one selectable thing.
 *
 * Keyed on `family_roles.id`, so a family that defines President at more than one scope gets
 * one option per scope and the captions say which. Sorted by scope then caption, matching
 * `buildBoards`.
 */
export function buildPositions(
  assignments: readonly BoardAssignment[],
  t: T,
): PositionOption[] {
  const byRole = new Map<string, { scope: PositionScope; name: string; people: Map<string, string> }>()

  for (const a of assignments) {
    let entry = byRole.get(a.roleId)
    if (!entry) {
      entry = { scope: a.scope, name: a.roleName, people: new Map() }
      byRole.set(a.roleId, entry)
    }
    entry.people.set(a.personId, a.personName)
  }

  const rank: Record<PositionScope, number> = { national: 0, regional: 1, chapter: 2 }
  return [...byRole.entries()]
    .map(([id, { scope, name, people }]) => ({
      id,
      // "National President", "Chapter Treasurer". The scope word is not decoration: without
      // it a family holding President at two scopes gets two options captioned identically.
      // THE SCOPE WORD IS NOT DECORATION: without it a family holding President at two
      // scopes gets two options captioned identically. Its POSITION in the phrase is a
      // key, because Spanish and French both put it after the name.
      label: t('pos.scopedName', { scope: positionScopeLabel(t, scope), name }),
      scope,
      personIds: [...people.entries()]
        .sort((x, y) => x[1].localeCompare(y[1]) || x[0].localeCompare(y[0]))
        .map(([personId]) => personId),
    }))
    .sort((a, b) => rank[a.scope] - rank[b.scope] || a.label.localeCompare(b.label))
}

/**
 * Every chapter with an adult in it, and who those adults are.
 *
 * ── A CHAPTER WITH NOBODY IN IT IS NOT OFFERED, for `buildBoards`' reason ───────────
 * A family can define nine chapters and have people recorded in three; offering the other six
 * is offering controls that select nobody. The count on each option is the honest half in the
 * other direction — a chapter of one says so before it is picked.
 *
 * A PERSON IN NO CHAPTER IS IN NO CHAPTER OPTION, and that is correct rather than a gap: they
 * are reached by "the whole family" or by name. Filing them under a "no chapter" pseudo-body
 * would be inventing a body nobody in the family has ever heard of, which is the same
 * judgement `buildBoards` makes about an arealess regional assignment.
 *
 * A CHAPTER THE NAMES MAP DOES NOT HAVE IS DROPPED, not labelled with its uuid. Every read
 * feeding this is family-scoped, so an unknown chapter id means the chapters read partly
 * failed — and a body captioned with a uuid is one nobody can decide about.
 */
export function buildChapters(
  people: readonly { personId: string; personName: string; chapterId: string | null }[],
  chapterNames: ReadonlyMap<string, string>,
): ChapterOption[] {
  const byChapter = new Map<string, Map<string, string>>()

  for (const person of people) {
    if (!person.chapterId || !chapterNames.has(person.chapterId)) continue
    let members = byChapter.get(person.chapterId)
    if (!members) {
      members = new Map()
      byChapter.set(person.chapterId, members)
    }
    members.set(person.personId, person.personName)
  }

  return [...byChapter.entries()]
    .map(([id, members]) => ({
      id,
      // "Austin Chapter", matching `boardLabel`'s "Austin Chapter Board" so the two read as
      // the wider and narrower version of one place rather than as two unrelated things.
      label: `${chapterNames.get(id) as string} Chapter`,
      personIds: [...members.entries()]
        .sort((x, y) => x[1].localeCompare(y[1]) || x[0].localeCompare(y[0]))
        .map(([personId]) => personId),
    }))
    .sort((a, b) => a.label.localeCompare(b.label))
}

/**
 * Everybody the chosen bodies add up to, de-duplicated, in a stable order.
 *
 * A UNION, not an intersection. Choosing the National Board and the Chapter President
 * position invites both sets — picking a second thing can only ever widen the room. An
 * intersection would be a plausible reading of a filter and is the wrong reading of an
 * invitation list, and the copy on the screen says which one this is.
 *
 * ── FOUR SOURCES SINCE 2026-08-22, AND `wholeFamily` IS THE ONE THAT IS NOT A LIST ──
 * This was `resolveBoardAttendees` over boards and positions. The scheduling form now asks
 * what KIND of meeting this is first — a board, an office across areas, a chapter, or a
 * general family meeting — and the last two needed bodies of their own: a chapter's whole
 * adult membership, and the family's.
 *
 * `wholeFamily` is a boolean and every other input is a list of ids, deliberately. There is
 * no id for "everybody", so a client asking for it can only ask; what everybody turns out to
 * be comes from `bodies.everyoneIds`, which the server built. A client that could send the
 * list could send any list, which is the rule `scheduleMeeting`'s header states as "THE
 * CLIENT NAMES BODIES AND NEVER SENDS PEOPLE".
 *
 * AN ID THAT MATCHES NOTHING IS IGNORED rather than refused. These arrive from a client and
 * the options they name are derived from live assignments, so a board that emptied while the
 * dialog was open resolves to nobody — as does a chapter id from another family, since every
 * body here was built from a family-scoped read. The action still checks every resolved
 * person against `belongsToFamily` (§4): this function decides who was asked for, never who
 * is allowed.
 */
export function resolveMeetingRoom(
  selection: MeetingRoomSelection,
  bodies: MeetingBodies,
): string[] {
  const wanted = new Set<string>()
  const boardById = new Map(bodies.boards.map(b => [b.id, b]))
  const positionById = new Map(bodies.positions.map(p => [p.id, p]))
  const chapterById = new Map(bodies.chapters.map(c => [c.id, c]))

  for (const id of selection.boardIds ?? []) {
    for (const personId of boardById.get(id)?.personIds ?? []) wanted.add(personId)
  }
  for (const id of selection.positionIds ?? []) {
    for (const personId of positionById.get(id)?.personIds ?? []) wanted.add(personId)
  }
  for (const id of selection.chapterIds ?? []) {
    for (const personId of chapterById.get(id)?.personIds ?? []) wanted.add(personId)
  }
  if (selection.wholeFamily) {
    for (const personId of bodies.everyoneIds) wanted.add(personId)
  }
  return [...wanted]
}
