import { POSITION_SCOPE_LABELS, type PositionScope } from '@/lib/board-positions'

/**
 * Turning the family's board assignments into the two things a meeting's attendee list can be
 * built from: BOARDS and POSITIONS.
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
 * `resolveBoardAttendees` unions them.
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
export function buildPositions(assignments: readonly BoardAssignment[]): PositionOption[] {
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
      label: `${POSITION_SCOPE_LABELS[scope]} ${name}`,
      scope,
      personIds: [...people.entries()]
        .sort((x, y) => x[1].localeCompare(y[1]) || x[0].localeCompare(y[0]))
        .map(([personId]) => personId),
    }))
    .sort((a, b) => rank[a.scope] - rank[b.scope] || a.label.localeCompare(b.label))
}

/**
 * Everybody the chosen boards and positions add up to, de-duplicated, in a stable order.
 *
 * A UNION, not an intersection. Choosing the National Board and the Chapter President
 * position invites both sets — picking a second thing can only ever widen the room. An
 * intersection would be a plausible reading of a filter and is the wrong reading of an
 * invitation list, and the copy on the screen says which one this is.
 *
 * AN ID THAT MATCHES NOTHING IS IGNORED rather than refused. These arrive from a client and
 * the options they name are derived from live assignments, so a board that emptied while the
 * dialog was open resolves to nobody. The action still checks every resolved person against
 * `belongsToFamily` (§4) — this function decides who was asked for, never who is allowed.
 */
export function resolveBoardAttendees(input: {
  boardIds: readonly string[]
  positionIds: readonly string[]
  boards: readonly BoardOption[]
  positions: readonly PositionOption[]
}): string[] {
  const wanted = new Set<string>()
  const boardById = new Map(input.boards.map(b => [b.id, b]))
  const positionById = new Map(input.positions.map(p => [p.id, p]))

  for (const id of input.boardIds) {
    for (const personId of boardById.get(id)?.personIds ?? []) wanted.add(personId)
  }
  for (const id of input.positionIds) {
    for (const personId of positionById.get(id)?.personIds ?? []) wanted.add(personId)
  }
  return [...wanted]
}
