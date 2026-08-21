/**
 * Which part of the family an election is for, and whether one member is in it.
 *
 * ── THE SAME THREE WORDS, ON PURPOSE ───────────────────────────────────────────────
 * `national | regional | chapter`, with `region_id` / `chapter_id` beside them — the
 * vocabulary `family_roles.scope` and `user_roles.scope` have used since 20260604000002 and
 * `dues_schedules.scope` since 20260817000008. A board position scoped to a chapter, a due
 * scoped to a chapter and an election scoped to a chapter all mean the same thing about the
 * same row in `chapters`. Two spellings of one idea is how two screens come to disagree.
 *
 * This file is the elections counterpart of `duesScope` / `duesScopeMatch` in
 * `lib/dues-utils.ts`, and it is deliberately a SEPARATE function rather than a reuse of
 * those: a due asks "does this member OWE it", which composes with a bloodline rule and an
 * age rule and answers about money, while this asks "may this member SEE it", which composes
 * with nothing and answers about a ballot. Folding them together would make one change to a
 * shared helper move both a bill and a franchise.
 *
 * ── IT IS ONE HALF OF A TWO-LAYER BOUNDARY, AND IT IS THE AUTHORITY FOR RENDERING ──
 * The other half is in the database: `auth_may_see_election()` and
 * `election_area_includes_person()` (20260821000001) narrow the composed RLS policies on all
 * four election tables, so a request issued from devtools cannot read another chapter's
 * election, nominations or votes. That is stronger than `announcements`, whose chapter scope
 * is app-layer only — warranted, because what is behind this key is a BALLOT rather than a
 * post somebody did not need.
 *
 * This half still has to exist for two reasons that are not redundancy. `getElectionResults`
 * reads TALLIES through the SERVICE-ROLE client, because a count must include votes the
 * reader may not see individually — no policy applies there and AGENTS.md §3 says the scoping
 * must be redone by hand. And the organizer's screens read on the admin client too, so the
 * app is what decides which rows a page even asks for (§5).
 *
 * ── PURE, AND `today`-FREE ─────────────────────────────────────────────────────────
 * No Supabase, no clock. An area has no time in it: the answer is a property of the election
 * and of where the member is filed, so it cannot change halfway through a window. When the
 * election is open is `lib/election-phase.ts`, and the two are asked separately because they
 * fail differently — "not yet" and "not yours" are different sentences.
 */

/** Which part of the family an election belongs to. */
export type ElectionScope = 'national' | 'regional' | 'chapter'

/** The three columns the area rule reads. Anything with these can be asked. */
export interface ElectionAreaLike {
  scope?: string | null
  region_id?: string | null
  chapter_id?: string | null
}

/**
 * An election's scope, defaulted.
 *
 * ANYTHING THAT IS NOT ONE OF THE OTHER TWO IS NATIONAL — which covers a NULL, a word nothing
 * recognizes, and the column being absent on a database that has not run 20260821000001. The
 * same call `duesScope` makes, and the same reason: a read must never lose an election to an
 * unapplied migration.
 *
 * FAILING TOWARD NATIONAL IS THE DELIBERATE DIRECTION, and it is the OPPOSITE of the
 * direction the phase fails in — which is worth being explicit about, because the two live
 * one import apart. A garbled scope is not a fact the family stated and could not compute; it
 * is a value the CHECK constraint cannot hold, so reading it as "this is for the whole
 * family" restores what the row meant before anybody typed a chapter into it. Widening an
 * AUDIENCE shows an election to people who were always entitled to elections; widening a
 * WINDOW accepts a vote after the poll shut, which is why `electionPhase` fails closed.
 * `election_area_includes()` in SQL makes the same choice, in the same words.
 */
export function electionScope(election: ElectionAreaLike): ElectionScope {
  return election.scope === 'regional' ? 'regional'
    : election.scope === 'chapter' ? 'chapter'
      : 'national'
}

/**
 * Whether an election is addressed to this member's part of the family.
 *
 * The four answers are four different sentences a screen may need, which is why this is not a
 * boolean — the same shape, and the same argument, as `DuesScopeMatch`.
 */
export type ElectionAreaMatch =
  /** Addressed to them — national, or their own region or chapter. */
  | 'in'
  /** Regional, and their chapter is in a different region. */
  | 'other-region'
  /** Chapter-scoped, and they are in a different chapter. */
  | 'other-chapter'
  /** Regional or chapter-scoped, and they are in no chapter at all — so under National. */
  | 'no-chapter'

/**
 * ── A MEMBER WITH NO CHAPTER IS UNDER NATIONAL ─────────────────────────────────────
 * They see national elections and no scoped one. It is the only coherent answer — there is no
 * region to compare a regional election against — and it is also the safe direction: an
 * unplaced member is never handed a ballot for a chapter they are not in. Every family starts
 * here, because a family with no chapters has no member in one. `election_area_includes()`
 * returns false for the same case, in SQL.
 *
 * ── THE REGION IS DERIVED, NOT STORED ──────────────────────────────────────────────
 * `chapterRegions` maps chapter id -> region id (or null for a chapter under National), which
 * is `chapters` read once. There is no `people.region_id` and none may be added: it would be
 * a second copy of a fact `chapters` holds, wrong from the first time a chapter moved between
 * regions — which `setChapterRegion` makes an ordinary act.
 *
 * PASSED IN RATHER THAN LOOKED UP, so this is checkable without a database and so the one read
 * that resolves it happens once per request rather than once per member per election.
 */
export function electionAreaMatch(input: {
  election: ElectionAreaLike
  /** `people.chapter_id` in this family. Null means they are under National. */
  memberChapterId: string | null | undefined
  /** `chapters` as id -> region id. A chapter under National maps to null. */
  chapterRegions: ReadonlyMap<string, string | null>
}): ElectionAreaMatch {
  const scope = electionScope(input.election)
  if (scope === 'national') return 'in'

  const chapterId = input.memberChapterId ?? null
  if (!chapterId) return 'no-chapter'

  if (scope === 'chapter') {
    return input.election.chapter_id === chapterId ? 'in' : 'other-chapter'
  }

  // A chapter this family does not have resolves to `undefined` rather than null, and both
  // mean "not in the election's region". Read through `?? null` so a chapter under National
  // cannot match an election whose `region_id` is somehow null — a row the CHECK constraint
  // refuses, and the one shape that would otherwise enfranchise everybody.
  const memberRegion = input.chapterRegions.get(chapterId) ?? null
  return memberRegion !== null && memberRegion === input.election.region_id
    ? 'in'
    : 'other-region'
}

/** The predicate form, for filtering a list. */
export function inElectionArea(
  memberChapterId: string | null | undefined,
  chapterRegions: ReadonlyMap<string, string | null>,
) {
  return (election: ElectionAreaLike) =>
    electionAreaMatch({ election, memberChapterId, chapterRegions }) === 'in'
}

/**
 * How an election's level reads on screen — "National", or the region or chapter by name.
 *
 * The NAME rather than the word "Regional", because "Regional election" tells a member
 * nothing they did not know while "Eastern Region election" tells them whether it is theirs.
 * Falls back to the bare level when the name could not be resolved, which is what a caller
 * without `admin/members/organization:view` gets — never an empty string, which would render
 * as a gap where a fact belongs.
 */
export function electionScopeLabel(
  election: ElectionAreaLike,
  names: { region?: string | null; chapter?: string | null } = {},
): string {
  const scope = electionScope(election)
  if (scope === 'national') return 'National'
  if (scope === 'chapter') return names.chapter || 'One chapter'
  return names.region || 'One region'
}

/**
 * The offices an election at this level may fill.
 *
 * ── THE LEVELS DO NOT CROSS-POLLINATE ──────────────────────────────────────────────
 * A chapter election fills chapter-scoped offices and no other, because an election that
 * fills an office belonging to a different level produces a result nobody can act on: a
 * chapter cannot seat the family's national treasurer, and the national body does not choose
 * one chapter's secretary.
 *
 * `family_roles.scope` already records which level each office belongs to
 * (20260604000002), so this is a filter over a fact the family has already stated rather
 * than a new one to record.
 *
 * WHERE THIS IS ENFORCED: in `createElection`, once, against the roster as it stands — NOT by
 * a database constraint. `election_positions.title` is free text COPIED from the roster, for
 * the reason a gathering task copies its step rather than referencing it (AGENTS.md): a family
 * that renames or retires a board position next year must not thereby make last year's
 * election unreadable, and a trigger validating the stored title against `family_roles` would
 * refuse every later write to a row whose office has since moved. So the level match is
 * checked where the position is CHOSEN, and the stored title is provenance from then on.
 */
export function rolesForScope<T extends { scope?: string | null }>(
  roles: readonly T[],
  scope: ElectionScope,
): T[] {
  // A role row with no scope is National, matching `family_roles.scope`'s own default.
  return roles.filter(r => (r.scope === 'regional' || r.scope === 'chapter'
    ? r.scope : 'national') === scope)
}
