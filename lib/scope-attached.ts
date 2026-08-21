import { createAdminClient } from '@/lib/supabase/admin'
import { isUuid } from '@/lib/money-attached'

/**
 * What still points at this region or chapter — so deleting one cannot quietly change
 * what a member owes, who leads them, or what they were told.
 *
 * ── WHY THIS EXISTS ────────────────────────────────────────────────────────────────
 * `lib/money-attached.ts` is the house pattern for "one rule, in one place, consulted by
 * every delete action that can reach something irreversible", and this is the same shape
 * for the same reason: five tables reference a chapter or a region, and the schema does
 * THREE different things depending on which.
 *
 *   people.chapter_id            NO ACTION   refuses, with a bare 23503 for a message
 *   user_roles.chapter_id        NO ACTION   refuses, same
 *   dues_schedules.chapter_id    NO ACTION   refuses, same          (20260817000008)
 *   dues_schedules.region_id     NO ACTION   refuses, same          (20260817000008)
 *   announcements.chapter_id     SET NULL    SUCCEEDS, and re-addresses the post
 *   user_roles.region_id         SET NULL    SUCCEEDS, and un-scopes the officer
 *   chapters.region_id           SET NULL    SUCCEEDS — and is INTENDED. See below.
 *
 * The NO ACTION cases are safe and unreadable: the delete fails with "violates foreign key
 * constraint people_chapter_id_fkey", which tells an administrator nothing about the
 * fourteen relatives who are in that chapter. The SET NULL cases are the dangerous half —
 * they succeed, and the damage is silent:
 *
 *   * A chapter announcement whose `chapter_id` goes NULL is treated by `addressedTo` as
 *     family-wide, so a post written for one chapter is published to the whole family. That
 *     default is right where an author left the picker empty, and wrong here.
 *   * A regional officer whose `user_roles.region_id` goes NULL keeps the position and
 *     loses the region it was for. Nothing on any screen says the seat changed.
 *
 * ── ONE REFERENCE IS DELIBERATELY NOT A REFUSAL ───────────────────────────────────
 * `chapters.region_id` is ON DELETE SET NULL because that IS the product: deleting a region
 * moves its chapters to National, which the confirmation has always said out loud. So it is
 * reported as `chaptersMoving` and never counted in `any` — the screen warns, the delete
 * proceeds.
 *
 * That is safe only because a region carrying a REGIONAL DUE cannot be deleted at all
 * (`schedules` refuses it). Without that, one click would move the chapters to National and
 * thereby un-owe a due for every member in them, leaving the schedule pointing at a region
 * that no longer exists. The two rules hold each other up; do not relax either alone.
 *
 * ── WHY A GUARD AND NOT `ON DELETE RESTRICT` ──────────────────────────────────────
 * The same answer `lib/money-attached.ts` gives, plus one difference worth noting: the four
 * NO ACTION foreign keys above ALREADY refuse, so unlike the money case the database is not
 * the layer that was missing. What was missing is the sentence — and a refusal with no
 * reason reads as a bug and gets worked around in a database console. RESTRICT would also
 * entangle both destructive scripts in `supabase/scripts/`, which delete parents and let
 * cascades clear the children.
 *
 * ── NOT A SERVER ACTION, and it must not become one ───────────────────────────────
 * A plain module has no URL. It reads through the SERVICE ROLE deliberately: the question is
 * "does anything point at this row", and the answer must not depend on whether the caller
 * holds view permission on the Directory, the ledger or the notice board — a family that
 * restricts its Member Directory would otherwise be told an occupied chapter was empty.
 * Same reasoning, and the same client, as `belongsToFamily` and `moneyAttachedTo`.
 *
 * `isUuid` is IMPORTED from `lib/money-attached.ts` rather than restated. It is the rule
 * that keeps a client-supplied id out of a PostgREST filter expression, and a second copy of
 * it is a second thing to get wrong.
 *
 * NO `import 'server-only'`, matching `lib/money-attached.ts` and `lib/auth/family.ts`:
 * `createAdminClient()` reads its key at CALL time, so the module imports cleanly under
 * vitest and the pure export at the foot of this file is testable (AGENTS.md §7b).
 */

/** What is in the way, so a message can name it rather than say "something". */
export interface ScopeAttached {
  /** True when anything BLOCKING is non-zero. `chaptersMoving` is never one of them. */
  any: boolean
  /** Members whose `people.chapter_id` is this chapter. */
  members: number
  /** Dues schedules scoped to this region or chapter. */
  schedules: number
  /** Announcements addressed to this chapter. */
  announcements: number
  /** Board positions held at this region or chapter. */
  positions: number
  /**
   * Elections scoped to this region or chapter (20260821000001).
   *
   * The strongest case in the list after `members`. `elections.region_id` and
   * `elections.chapter_id` are NO ACTION, so the database already refuses — and what a
   * successful delete would have meant is worse than what it means for a due: an election is
   * the RECORD of who the family chose, and a row pointing at a region that no longer exists
   * is a result nobody can say the constituency of.
   */
  elections: number
  /**
   * Chapters that would MOVE TO NATIONAL if this region were deleted.
   *
   * Never counted in `any`: this is the documented behaviour of deleting a region, not an
   * obstacle to it. Reported so the confirmation can say how many, because "its chapters
   * will move to National" is a very different sentence when the number is eleven.
   */
  chaptersMoving: number
}

/** The two things this rule covers. A third means adding it here AND to its delete action. */
export type ScopeBearing = 'region' | 'chapter'

export const NO_SCOPE_ATTACHMENTS: ScopeAttached = {
  any: false, members: 0, schedules: 0, announcements: 0, positions: 0, elections: 0,
  chaptersMoving: 0,
}

type Countable = Exclude<keyof ScopeAttached, 'any'>

/**
 * EVERY REFERENCE, IN ONE LIST, because there are two readers of it below — the row-level
 * decision and the whole-family listing — and two copies of this table is how a sixth
 * reference comes to be honoured by one of them.
 *
 * Adding a table that references `regions` or `chapters` means adding a line here. Nothing
 * detects a miss automatically; the query in AGENTS.md §8 finds the foreign keys, and this
 * list is what has to be reconciled against it.
 */
const REFERENCES: Record<ScopeBearing, readonly { table: string; column: string; field: Countable }[]> = {
  chapter: [
    { table: 'people', column: 'chapter_id', field: 'members' },
    { table: 'dues_schedules', column: 'chapter_id', field: 'schedules' },
    { table: 'announcements', column: 'chapter_id', field: 'announcements' },
    { table: 'user_roles', column: 'chapter_id', field: 'positions' },
    { table: 'elections', column: 'chapter_id', field: 'elections' },
  ],
  region: [
    { table: 'dues_schedules', column: 'region_id', field: 'schedules' },
    { table: 'user_roles', column: 'region_id', field: 'positions' },
    { table: 'elections', column: 'region_id', field: 'elections' },
    { table: 'chapters', column: 'region_id', field: 'chaptersMoving' },
  ],
}

/** The fields that refuse a delete. `chaptersMoving` is the one that does not — see above. */
const BLOCKING: readonly Countable[] = [
  'members', 'schedules', 'announcements', 'positions', 'elections',
]

function summarize(counts: Record<Countable, number>): ScopeAttached {
  return { ...counts, any: BLOCKING.reduce((n, f) => n + counts[f], 0) > 0 }
}

const zero = (): Record<Countable, number> =>
  ({ members: 0, schedules: 0, announcements: 0, positions: 0, elections: 0, chaptersMoving: 0 })

/**
 * THE DECIDING READ: count-only queries, one per referencing table, `head: true` so no rows
 * come back. This is what a delete action consults, and it is asked about ONE row.
 *
 * `family_code` is on every one of these tables and is applied to every query. Not
 * decoration: the service role has no RLS, so without it an id from another family would
 * answer honestly about that family's members and this guard would report "nothing attached"
 * for a row it cannot see (AGENTS.md §3).
 *
 * Every count reads the error and treats a REFUSED query as something being attached. That
 * inverts §8's usual advice on purpose, for the reason `moneyAttachedTo` gives: the failure
 * modes are not symmetric. A false "nothing attached" deletes a chapter fourteen people are
 * in and re-publishes its announcements to the whole family; a false "something attached"
 * refuses a delete a retry will allow.
 */
export async function scopeAttachedTo(
  kind: ScopeBearing,
  id: string,
  familyCode: string,
): Promise<ScopeAttached> {
  // FAIL TOWARD REFUSING on every early exit, per the note above.
  if (!familyCode || !isUuid(id)) return { ...NO_SCOPE_ATTACHMENTS, any: true }

  const admin = createAdminClient()
  const counts = zero()

  await Promise.all(REFERENCES[kind].map(async ref => {
    const { count, error } = await admin
      .from(ref.table)
      .select('id', { count: 'exact', head: true })
      .eq('family_code', familyCode)
      .eq(ref.column, id)
    if (error) {
      console.error(`[scope-attached] ${ref.table}.${ref.column} refused for ${kind} ${id}: ${error.message}`)
      counts[ref.field] += 1
      return
    }
    counts[ref.field] += count ?? 0
  }))

  return summarize(counts)
}

/**
 * THE LISTING READ: the same five references, for every region or chapter in one family at
 * once, so the admin screen can say what each row has attached without a query per row.
 *
 * A family with forty chapters would be 160 round trips through `scopeAttachedTo`; this is
 * three or four, bucketed in memory. Both walk `REFERENCES`, which is the whole reason that
 * list is a constant — the screen and the refusal must not disagree about what counts.
 *
 * IT IS ADVISORY AND THE DELETE RE-DERIVES. `deleteChapter` and `deleteRegion` call
 * `scopeAttachedTo` themselves and never trust anything the client was handed, exactly as
 * `updateDuesSchedule` re-derives `getScheduleUsage()`. So a refused query here logs and
 * omits the row rather than failing toward refusal: the cost is a Delete button offered for
 * something that will decline, not a delete that should not have happened.
 */
export async function scopeAttachmentsFor(
  kind: ScopeBearing,
  familyCode: string,
): Promise<Record<string, ScopeAttached>> {
  if (!familyCode) return {}
  const admin = createAdminClient()
  const counts = new Map<string, Record<Countable, number>>()
  const bucket = (id: string | null, field: Countable) => {
    if (!id) return
    const row = counts.get(id) ?? zero()
    row[field] += 1
    counts.set(id, row)
  }

  await Promise.all(REFERENCES[kind].map(async ref => {
    const { data, error } = await admin
      .from(ref.table)
      .select(ref.column)
      .eq('family_code', familyCode)
      .not(ref.column, 'is', null)
    if (error) {
      console.error(`[scope-attached] ${ref.table}.${ref.column} listing refused for ${familyCode}: ${error.message}`)
      return
    }
    // `as unknown as`, and it is the same bargain lib/supabase/embed.ts documents: the
    // select string is a VARIABLE, so supabase-js cannot parse it at the type level and
    // resolves the row to `GenericStringError`. The shape is asserted from `REFERENCES`
    // three lines up, which is the only place that truth exists while the client is
    // untyped — one cast, not one per field.
    for (const row of (data ?? []) as unknown as Record<string, string | null>[]) {
      bucket(row[ref.column], ref.field)
    }
  }))

  const out: Record<string, ScopeAttached> = {}
  for (const [id, row] of counts) out[id] = summarize(row)
  return out
}

/**
 * The sentence an administrator reads, naming what is actually in the way.
 *
 * `noun` is what they pressed Delete on, in their words — "The Texas chapter", "The Eastern
 * region". The message says what points at it and what to do instead, because "cannot be
 * deleted" with no reason reads as a bug.
 *
 * THE WAY FORWARD IS NAMED because there always is one, and none of it is a dead end: move
 * the members, re-scope the due, delete the post, move the position. That is exactly why
 * refusing is the right call rather than proceeding and repairing afterwards.
 */
export function scopeAttachedMessage(noun: string, attached: ScopeAttached): string {
  const parts: string[] = []
  const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`

  if (attached.members) parts.push(plural(attached.members, 'member', 'members'))
  if (attached.schedules) parts.push(plural(attached.schedules, 'dues schedule', 'dues schedules'))
  if (attached.announcements) parts.push(plural(attached.announcements, 'announcement', 'announcements'))
  if (attached.positions) parts.push(plural(attached.positions, 'board position', 'board positions'))
  if (attached.elections) parts.push(plural(attached.elections, 'election', 'elections'))

  const what = parts.length > 1
    ? `${parts.slice(0, -1).join(', ')} and ${parts[parts.length - 1]}`
    : parts[0] ?? 'something'

  return `${noun} still has ${what} attached, so it cannot be deleted. Move the members to `
    + 'another chapter, re-scope any dues or elections to the whole family, and clear anything '
    + 'else pointing at it first — deleting it now would change what people owe, who was told '
    + 'what, and who was entitled to vote.'
}
