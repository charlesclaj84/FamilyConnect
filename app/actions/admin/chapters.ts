'use server'

import { revalidatePath } from 'next/cache'
import { requireMember, requireScope } from '@/lib/auth/guard'
import { belongsToFamily } from '@/lib/auth/family'
import {
  POSITION_CATEGORIES, POSITION_SCOPES, POSITION_SCOPE_LABELS, POSITION_NAME_MAX,
  type PositionCategory, type PositionScope,
} from '@/lib/board-positions'
import { createAdminClient } from '@/lib/supabase/admin'
import {
  scopeAttachedTo, scopeAttachmentsFor, scopeAttachedMessage, type ScopeAttached,
} from '@/lib/scope-attached'

/**
 * Regions and chapters — how a large family divides itself up, and who leads each part.
 *
 * ── WHAT CHANGED WHEN THIS CAME BACK (2026-08-18) ───────────────────────────────────
 * The page and these actions were written before the permission model, before §3 and §4
 * were written down, and before anything scoped MONEY to a chapter. They were marked
 * `status: 'future'` in lib/features.ts and served Coming Soon, so none of the following
 * was reachable — and all of it was still exported from a `'use server'` file, which means
 * every one was a live HTTP endpoint the whole time:
 *
 *   * **`deleteRegion` and `deleteChapter` had no `family_code` conjunct at all.** Both
 *     write through the service-role client, so `.eq('id', id)` was the whole of the
 *     predicate: BRAVO's administrator could delete ALPHA's chapters by id. §3.
 *   * **`createChapter` wrote a client-supplied `region_id` unchecked.** The row carries the
 *     caller's own family_code and so satisfies every policy, while the region it points at
 *     is another family's. §4, and the same shape as the four actions that section names.
 *   * **`getRegions` and `getChapters` demanded nothing but a session.** Both read a
 *     family's structure through the admin client, which applies no RLS.
 *   * **`deleteCustomRole` had no `family_code` conjunct either**, and the board-position
 *     actions at the foot of this file were all gated on `admin/chapters` — the wrong key
 *     for a screen that is `/admin/members/board-positions`. Both are fixed, and that whole section
 *     was rewritten again on 2026-08-19 when board positions became per-family and the page
 *     went live; its own header records what changed and why.
 *   * **Deleting a chapter somebody was in raised a raw 23503 at the user**, and deleting a
 *     region silently blanked every regional officer's region. See `lib/scope-attached.ts`,
 *     which is now consulted before either delete.
 *
 * ── THE GRANT IS `admin/chapters`, AND IT HAS NO OWNER ──────────────────────────────
 * A region and a chapter are family-wide configuration; nobody owns one. So every write
 * here goes through `requireScope`/`requireEdit`, which is `canAny`, and `admin/chapters` is
 * on `NO_OWNER_KEYS` in components/admin/resource-groups.ts so the grid does not offer an
 * "Own" switch that the composed policy on both tables reads as a denial anyway —
 * `permission_table_map` gives each of them `own_expr = 'false'`.
 *
 * `getRegions` matches that with `requireScope(…, 'view')` rather than `requireRead`, for the
 * same reason: 'own' is not a legitimate way to hold view on a key with no owner, and the
 * policy on `regions` tests `auth_permission(…) = 'any'`. The code and the database must not
 * disagree about who may do what (AGENTS.md §2).
 *
 * `getChapters` is the one deliberate exception and it is documented on the function.
 */

export interface Region {
  id: string
  family_code: string
  name: string
  created_at: string
}

export interface Chapter {
  id: string
  family_code: string
  name: string
  region_id: string | null
  region_name: string | null   // null = "National"
  created_at: string
}

// THE VOCABULARY LIVES IN lib/board-positions.ts, and it has to. Those two arrays were here
// for an afternoon and `next build` refused the file: a `'use server'` module may export only
// async functions, and an exported `const` array is "found object". Types are fine — they do
// not exist at runtime — which is why `BoardPosition` and its siblings below stay.

/**
 * One board position, belonging to ONE family.
 *
 * `family_code` is NOT NULL and there is no `is_global`: 20260819000004 retired the 25
 * built-in positions and made this table per-family. `enabled` went with them — it meant
 * "this family uses that built-in", which is what `family_role_exclusions` recorded, and a
 * family now expresses the same thing by having the row or not having it.
 */
export interface BoardPosition {
  id: string
  name: string
  category: PositionCategory
  scope: PositionScope
  sort_order: number
  family_code: string
  /** How many people hold it. The delete refusal is built on this — see `deleteBoardPosition`. */
  holders: number
}

/** Who holds what, one row per assignment. */
export interface BoardPositionHolder {
  assignment_id: string
  position_id: string
  position_name: string
  person_name: string
  /**
   * `people.id`, ADDED 2026-08-20 — and still NO `user_id`, which is the half that mattered.
   *
   * This field said "NO `user_id` AND NO `person_id`, and their absence is §5 rather than an
   * oversight", and invited exactly this: "add one back only with a caller that needs it."
   * The caller is Members & Access, whose roster now prints each member's position in a column
   * and offers a dialog to change it — both of which have to match a holder to a row, and the
   * row is keyed on `people.id`.
   *
   * THE DISTINCTION THE OLD NOTE DREW IS THE REASON THIS IS SAFE. `user_roles` keys its holder
   * on an `auth.users.id`, which is the one identifier in this schema that is IDENTICAL across
   * every family the account belongs to — the whole reason `assignBoardPosition` takes a
   * `people.id` instead. A `people.id` belongs to exactly one family, so publishing it tells a
   * reader nothing they do not already have: every row of the roster they are looking at is
   * keyed on it.
   *
   * NULL for an assignment whose `user_id` matches nobody in this family — a row
   * `20260819000004` should have repointed. The screen prints "Somebody no longer in this
   * family" for those, and a null id is what keeps such a row from matching a real member.
   */
  person_id: string | null
  scope: PositionScope
  chapter_name: string | null
  region_name: string | null
}

/** What each region and chapter has attached, keyed by id — see `getScopeUsage`. */
export interface ScopeUsage {
  regions: Record<string, ScopeAttached>
  chapters: Record<string, ScopeAttached>
}

// ── Where the regions and chapters screen actually LIVES ───────────────────────

/**
 * Revalidate the screen that draws regions and chapters.
 *
 * THERE ARE TWO PATHS AND ONLY ONE OF THEM RENDERS ANYTHING. On 2026-08-19 the screen
 * became the **Organization** pane of Members & Access, and `/admin/members/organization` became a bare
 * `redirect('/admin/members?tab=organization')` — kept as a route (and as a FEATURES entry)
 * so old links, bookmarks and `viewableResources()` all keep working, which the note on that
 * entry explains at length.
 *
 * So `revalidatePath('/admin/members/organization')` alone, which is what all five writes below did
 * until this function existed, invalidates the cache of a page that renders nothing and
 * leaves the cache of the page that renders everything untouched. It is not user-visible
 * TODAY — `AdminRegionsChaptersClient` updates optimistically and never calls
 * `router.refresh()` — which is precisely what makes it worth a named function rather than a
 * second line copied five times: the day somebody adds a refresh, the bug appears in a file
 * nobody edited, and the fix has to be found five times.
 *
 * Both are revalidated rather than just the new one. A redirect is still a cached route
 * segment, and the cost of the extra call is nil.
 */
function revalidateOrganization() {
  revalidatePath('/admin/members')
  revalidatePath('/admin/members/organization')
}

// ── Regions ────────────────────────────────────────────────────────────────────

/**
 * Every region in the caller's family.
 *
 * THE ADMIN CLIENT, so §3's obligation is discharged by hand: `.eq('family_code', …)` from
 * the caller's own membership. The user client would work for a caller who holds
 * `admin/chapters:view` at 'any' — that is exactly what the composed SELECT policy admits —
 * and it is used here anyway so that this function and `getChapters` below, which genuinely
 * cannot use the user client, behave identically for the screen that reads both.
 */
export async function getRegions(): Promise<Region[]> {
  const g = await requireScope('admin/members/organization', 'view')
  if (!g.ok) return []

  const { data, error } = await createAdminClient()
    .from('regions')
    .select('*')
    .eq('family_code', g.familyCode)
    .order('name')

  // §8: `data` alone cannot tell a refused query from an empty table, and this screen would
  // render "no regions" over a family that has twelve.
  if (error) {
    console.error(`[chapters] regions read failed for ${g.familyCode}: ${error.message}`)
    return []
  }
  return (data ?? []) as Region[]
}

export async function createRegion(
  name: string,
): Promise<{ success: boolean; id?: string; error?: string }> {
  const g = await requireScope('admin/members/organization', 'create')
  if (!g.ok) return { success: false, error: g.message }

  const trimmed = name.trim()
  if (!trimmed) return { success: false, error: 'A region needs a name' }
  // NATIONAL IS THE ABSENCE OF A REGION, not a row — see 20260817000008's header. A region
  // called "National" would sit beside the built-in National group as a second thing with
  // the same name, and a due scoped to it would bill only the chapters inside it.
  if (trimmed.toLowerCase() === 'national') return { success: false, error: '"National" is a reserved name' }

  const { data, error } = await createAdminClient()
    .from('regions')
    .insert({ name: trimmed, family_code: g.familyCode, created_by: g.userId })
    .select('id')
    .single()

  if (error) return { success: false, error: error.message }
  revalidateOrganization()
  return { success: true, id: data.id }
}

/**
 * Delete a region. Its chapters move to National; anything else pointing at it refuses.
 *
 * WHAT POINTS AT A REGION AND WHAT HAPPENS TO IT is `lib/scope-attached.ts`, consulted
 * before the delete for the reason `deleteDuesSchedule` consults `moneyAttachedTo`: two of
 * the three references are ON DELETE SET NULL, so the delete SUCCEEDS and the damage is
 * silent — a regional officer keeps their seat and loses the region it was for, and a
 * regional due is left pointing at nothing (which the CHECK from 20260817000008 turns into a
 * refusal with a message about a column nobody touched).
 *
 * The chapters moving to National is the one reference that is intended rather than
 * obstructive, and the confirmation on the screen says how many.
 */
export async function deleteRegion(id: string): Promise<{ success: boolean; error?: string }> {
  const g = await requireScope('admin/members/organization', 'delete')
  if (!g.ok) return { success: false, error: g.message }

  // §3. Read the row inside the family before deciding anything about it: the service-role
  // client applies no RLS, so `.eq('id', id)` alone let one family delete another's regions.
  const admin = createAdminClient()
  const { data: existing } = await admin
    .from('regions').select('name').eq('id', id).eq('family_code', g.familyCode).maybeSingle()
  if (!existing) return { success: false, error: 'Region not found' }

  const attached = await scopeAttachedTo('region', id, g.familyCode)
  if (attached.any) {
    return { success: false, error: scopeAttachedMessage(`The ${existing.name} region`, attached) }
  }

  const { error } = await admin.from('regions').delete()
    .eq('id', id).eq('family_code', g.familyCode)
  if (error) return { success: false, error: error.message }
  revalidateOrganization()
  return { success: true }
}

// ── Chapters ───────────────────────────────────────────────────────────────────

/**
 * Every chapter in the caller's family, with the region each belongs to.
 *
 * ── ANY APPROVED MEMBER, DELIBERATELY, AND THIS IS THE EXCEPTION TO THE NOTE ABOVE ──
 * `requireMember()` rather than a grant on `admin/chapters`, because /personal-info offers
 * every member a chapter to belong to and cannot do that without the list. The composed
 * SELECT policy on `chapters` demands `admin/chapters:view = 'any'`, which is an
 * administrator-only key, so the user client returns nothing for an ordinary member — that
 * is why this reads through the admin client, and it has done since long before this file
 * was revisited.
 *
 * The divergence is a decision rather than an oversight, and it is the same one
 * `belongsToFamily` makes: a chapter's NAME is family structure, not PII, and a member who
 * cannot see the list cannot say which part of the family they are in. What the grant
 * actually protects is EDITING the structure, and every write below demands it.
 *
 * What this adds is the membership test the function never had. A `people` row can exist
 * without its owner having been admitted, and a pending applicant has no business reading
 * the family's structure — /personal-info already withholds this fetch for one, so nothing
 * loses a screen.
 */
export async function getChapters(): Promise<Chapter[]> {
  const g = await requireMember()
  if (!g.ok) return []

  const { data, error } = await createAdminClient()
    .from('chapters')
    // THE CONSTRAINT IS NAMED even though the bare embed still resolves today. `chapters`
    // and `regions` are joined by `chapters.region_id`, and since 20260817000008
    // `dues_schedules` holds foreign keys to both — the shape AGENTS.md §8 warns turns a
    // bare embed into PGRST201 and the whole query into `[]`. Measured after that migration:
    // it does not, because PostgREST infers a many-to-many only where the junction's two
    // foreign-key columns ARE its primary key, and `dues_schedules` has a surrogate `id`
    // (as does `user_roles`, which has pointed at both tables since 20260610000008).
    // Naming it costs nothing and the failure mode is a silent empty list.
    .select('id, family_code, name, region_id, regions!chapters_region_id_fkey(name), created_at')
    .eq('family_code', g.familyCode)
    .order('name')

  if (error) {
    console.error(`[chapters] chapters read failed for ${g.familyCode}: ${error.message}`)
    return []
  }

  return (data ?? []).map(c => ({
    id:          c.id,
    family_code: c.family_code,
    name:        c.name,
    region_id:   c.region_id ?? null,
    region_name: (c.regions as unknown as { name: string } | null)?.name ?? null,
    created_at:  c.created_at,
  }))
}

export async function createChapter(
  name: string,
  regionId?: string | null,
): Promise<{ success: boolean; id?: string; error?: string }> {
  const g = await requireScope('admin/members/organization', 'create')
  if (!g.ok) return { success: false, error: g.message }

  const trimmed = name.trim()
  if (!trimmed) return { success: false, error: 'A chapter needs a name' }

  // §4. The row being inserted carries the caller's own family_code and so satisfies every
  // policy on `chapters`; the region it names could be anybody's. Checked BEFORE it is
  // written, not validated afterwards.
  if (regionId && !(await belongsToFamily('regions', regionId, g.familyCode))) {
    return { success: false, error: 'Region not found' }
  }

  const { data, error } = await createAdminClient()
    .from('chapters')
    .insert({
      name: trimmed, family_code: g.familyCode, created_by: g.userId,
      region_id: regionId ?? null,
    })
    .select('id')
    .single()

  if (error) return { success: false, error: error.message }
  revalidateOrganization()
  return { success: true, id: data.id }
}

/**
 * Move a chapter into a region, or out to National.
 *
 * ── WHY THIS EXISTS AND DID NOT BEFORE ─────────────────────────────────────────────
 * A chapter's region was settled at creation and could never be corrected. That was a
 * shrug while a region was only a heading; since 20260817000008 it decides who owes a
 * REGIONAL DUE, so a chapter created under the wrong region — or a family that reorganizes,
 * which is the ordinary thing a family with regions does — had no way back.
 *
 * IT CHANGES WHO OWES A REGIONAL DUE, IMMEDIATELY AND BY DESIGN, and it is not frozen the
 * way the dues terms are. A chapter moving between regions is a real event in the family
 * rather than a restatement of the past: the members genuinely are in the Eastern region
 * now, so the Eastern region's due is genuinely theirs. That is the same call
 * `bloodline_only` makes about correcting a relationship, and the help chapter says so out
 * loud rather than leaving a treasurer to discover it.
 *
 * Two ids, two §4 checks: the chapter must be ours before we write to it, and the region
 * must be ours before we write it onto the row.
 */
export async function setChapterRegion(
  chapterId: string,
  regionId: string | null,
): Promise<{ success: boolean; error?: string }> {
  const g = await requireScope('admin/members/organization', 'edit')
  if (!g.ok) return { success: false, error: g.message }

  if (!(await belongsToFamily('chapters', chapterId, g.familyCode))) {
    return { success: false, error: 'Chapter not found' }
  }
  if (regionId && !(await belongsToFamily('regions', regionId, g.familyCode))) {
    return { success: false, error: 'Region not found' }
  }

  const { error } = await createAdminClient()
    .from('chapters')
    .update({ region_id: regionId })
    .eq('id', chapterId)
    .eq('family_code', g.familyCode)
  if (error) return { success: false, error: error.message }
  revalidateOrganization()
  // Who owes a regional due has just changed, so every screen that prices one is stale.
  revalidatePath('/accounting/dues-and-donations')
  revalidatePath('/accounting/summary')
  revalidatePath('/reporting/dues-projections')
  return { success: true }
}

/**
 * Delete a chapter. Refused while anything points at it — see `lib/scope-attached.ts`.
 *
 * REFUSE RATHER THAN REASSIGN, and that is the deliberate half. The alternative was to move
 * the chapter's members to National on the way past, and it is wrong for the same reason
 * `updateDuesSchedule` will not silently re-price a used due: somebody's chapter decides
 * what they owe and who leads them, and changing it for fourteen people as a side effect of
 * a delete is a decision the family has to make on purpose. `people.chapter_id` is NO ACTION
 * in the schema precisely so there is no version of this that happens quietly.
 */
export async function deleteChapter(id: string): Promise<{ success: boolean; error?: string }> {
  const g = await requireScope('admin/members/organization', 'delete')
  if (!g.ok) return { success: false, error: g.message }

  // §3, as in deleteRegion: the id alone must never be the whole predicate.
  const admin = createAdminClient()
  const { data: existing } = await admin
    .from('chapters').select('name').eq('id', id).eq('family_code', g.familyCode).maybeSingle()
  if (!existing) return { success: false, error: 'Chapter not found' }

  const attached = await scopeAttachedTo('chapter', id, g.familyCode)
  if (attached.any) {
    return { success: false, error: scopeAttachedMessage(`The ${existing.name} chapter`, attached) }
  }

  const { error } = await admin.from('chapters').delete()
    .eq('id', id).eq('family_code', g.familyCode)
  if (error) return { success: false, error: error.message }
  revalidateOrganization()
  return { success: true }
}

/**
 * What each region and chapter has attached, so the screen can say why a row cannot go.
 *
 * Its own action rather than fields on Region and Chapter, for the reason
 * `getScheduleUsage()` is: `getChapters()` is read on three screens and this costs extra
 * queries only the admin one needs. A row missing from either map has nothing attached.
 *
 * ADVISORY. Both delete actions call `scopeAttachedTo` themselves and never trust what the
 * client was handed — the same relationship `updateDuesSchedule` has with
 * `getScheduleUsage()`. Disabling a Delete button is about not offering a refusal, not about
 * being the thing that refuses.
 */
export async function getScopeUsage(): Promise<ScopeUsage> {
  const g = await requireScope('admin/members/organization', 'view')
  if (!g.ok) return { regions: {}, chapters: {} }
  const [regions, chapters] = await Promise.all([
    scopeAttachmentsFor('region', g.familyCode),
    scopeAttachmentsFor('chapter', g.familyCode),
  ])
  return { regions, chapters }
}

// ── Board positions ────────────────────────────────────────────────────────────
//
// THESE SERVE `/admin/members/board-positions`, AND THEY ARE KEYED ON IT SINCE 2026-08-18.
// They were gated on `admin/chapters` — the key of the screen they happen to share a file
// with — which was harmless only while both routes served Coming Soon. Bringing Regions &
// Chapters back would have handed the family's board-position catalogue to anybody granted
// the chapter screen, and `permission_table_map` points `family_roles` at
// `admin/boardpositions`, so the code and the database disagreed about who may do what
// (AGENTS.md §2).
//
// They stay in this file because `family_roles.scope` is the same three words a chapter is
// scoped by and the two screens were built as one feature; moving them is a rename with no
// reader, and TODO would carry it if it mattered.
//
// ── WHAT CHANGED WHEN THE PAGE WENT LIVE (2026-08-19) ───────────────────────────────
// `20260819000004` made board positions per-family, and this section was rewritten around
// it rather than adjusted. Four things went away and are not coming back:
//
//   * **The 25 built-in positions.** A family configures its own list, starting empty. So
//     there is no `.or('family_code.is.null,family_code.eq.…')` anywhere below — every read
//     is a plain `.eq('family_code', …)`, which is also the end of a real hazard: that
//     `.or()` interpolated a family code into PostgREST's comma-and-parenthesis filter
//     language, one careless character away from the shape `lib/money-attached.ts` guards.
//   * **`family_role_exclusions` and `setRoleEnabled`.** The table existed only to opt a
//     family OUT of a built-in. With no built-ins there is nothing to opt out of; a family
//     deletes a position it does not use. The migration drops the table.
//   * **`is_global`, and `deleteCustomRole`'s "Global roles cannot be deleted".** The column
//     could only ever be false once the built-ins were gone.
//   * **`getAllRolesWithGlobal`'s `requireRead`.** That helper is `can()`, which is
//     satisfied by scope 'own' — and then read the whole catalogue off the admin client,
//     past a composed policy whose `own_expr` for this table is the literal 'false'. Every
//     read and write below uses `requireScope`, which is `canAny`. A board position is
//     family-wide configuration and nobody owns one; that is the same argument
//     `admin/chapters` makes at the top of this file, and it is why `admin/boardpositions`
//     is on `NO_OWNER_KEYS`.
//
// ── ASSIGNING IS HERE TOO NOW, AND THE OLD ENDPOINTS ARE GONE ───────────────────────
// `assignRole`, `revokeRole` and `revokeRoleByAssignmentId` lived in
// app/actions/admin/users.ts with no call site anywhere in the product — and with holes:
// `revokeRoleByAssignmentId` was `.delete().eq('id', assignmentId)` on the service role
// with no family conjunct, byte-for-byte the `deleteRegion` hole this file's header
// records, and `assignRole` wrote four client-supplied ids (`targetUserId`, `roleId`,
// `chapterId`, `regionId`) onto a row carrying the caller's own family_code, which is §4
// exactly. They are replaced by `assignBoardPosition` and `revokeBoardPosition` below,
// beside the catalogue they operate on, and the three old exports are deleted rather than
// patched: an endpoint nobody calls is an endpoint nobody re-reads.
//
// ── `user_roles` KEYS ITS HOLDER ON `auth.users.id` ─────────────────────────────────
// Not `people.id`. That is the `event_assignments` mistake AGENTS.md names, and it is a
// schema fact rather than a decision made here: an account-less relative — a recorded
// grandmother — cannot hold a board position, and every query needs the `user_id`
// indirection. What saves it is that the table has always carried a `family_code`, so the
// family boundary is expressible; it is the actions that failed to express it.
//
// The consequence for the API below is deliberate and worth stating: `assignBoardPosition`
// takes a **people.id**, never a user id. The action resolves the account itself, which is
// both what the picker can supply and what makes the §4 check unavoidable — "is this row in
// my family, and does it have an account" is the same question in one read.
//
// ── EVERY JOIN IS DONE IN TYPESCRIPT, ON PURPOSE ────────────────────────────────────
// `getBoardPositionHolders` reads five tables and stitches them, rather than embedding.
// `user_roles` has no foreign key to `people` at all (it points at `auth.users`), so a
// `people(...)` embed under it is PGRST200 — silent, and answers `[]`. Keeping the joins in
// TypeScript also means every read states its own `.eq('family_code', …)`, so §3 is
// discharged where a reviewer can see it. AGENTS.md §8 is the long version.

/**
 * A member who could be given a position. `SelectablePerson`-shaped, so `PersonPicker` can
 * tell two Martha Allens apart.
 */
export interface AssignableMember {
  id: string
  first_name: string
  last_name: string
  nick_name: string | null
  date_of_birth: string | null
}

/**
 * Every board position this family has, with a live count of who holds each.
 *
 * THE ADMIN CLIENT, so §3 is discharged by hand. The user client would work for a caller
 * holding `admin/boardpositions:view` at 'any' — that is exactly what the SELECT policy
 * admits since 20260819000004 — and the admin client is used anyway so this behaves
 * identically to `getBoardPositionHolders`, which reads tables the caller may be restricted
 * from.
 */
export async function getBoardPositions(): Promise<BoardPosition[]> {
  const g = await requireScope('admin/members/board-positions', 'view')
  if (!g.ok) return []

  const admin = createAdminClient()
  const [positionsRes, assignmentsRes] = await Promise.all([
    admin.from('family_roles')
      .select('id, name, category, scope, sort_order, family_code')
      .eq('family_code', g.familyCode)
      .order('sort_order'),
    admin.from('user_roles')
      .select('role_id')
      .eq('family_code', g.familyCode),
  ])

  // §8 on both halves. A refused read renders "no positions yet" over a family that has
  // twelve, and a refused count renders every position as deletable when none is.
  if (positionsRes.error || assignmentsRes.error) {
    console.error('[chapters] board positions read failed for ' + g.familyCode + ': '
      + (positionsRes.error?.message ?? assignmentsRes.error?.message))
    return []
  }

  const holders = new Map<string, number>()
  for (const a of assignmentsRes.data ?? []) {
    holders.set(a.role_id, (holders.get(a.role_id) ?? 0) + 1)
  }

  return (positionsRes.data ?? []).map(r => ({
    ...r,
    holders: holders.get(r.id) ?? 0,
  })) as BoardPosition[]
}

/**
 * Add a position to the family's list.
 *
 * VALIDATION IS SERVER-SIDE BECAUSE THE CLIENT IS NOT IN THE REQUEST PATH. The old version
 * checked the name in the component only, so `createCustomRole({ name: '' })` created an
 * unreachable row: nothing on the screen could name it and deleting it needed its id.
 * `family_roles_name_not_blank` now refuses it in the database too — belt and braces, and
 * the CHECK is what makes the guarantee independent of this function.
 *
 * The `category` and `scope` unions are TypeScript, which is erased at runtime, so both are
 * checked against the literal sets the CHECK constraints hold.
 */
export async function createBoardPosition(input: {
  name: string
  category: PositionCategory
  scope: PositionScope
}): Promise<{ success: boolean; error?: string }> {
  const g = await requireScope('admin/members/board-positions', 'create')
  if (!g.ok) return { success: false, error: g.message }

  const name = input.name.trim()
  if (!name) return { success: false, error: 'A position needs a name' }
  if (name.length > POSITION_NAME_MAX) {
    return { success: false, error: `A position name is at most ${POSITION_NAME_MAX} characters` }
  }
  if (!POSITION_CATEGORIES.includes(input.category)) {
    return { success: false, error: 'Choose a category' }
  }
  if (!POSITION_SCOPES.includes(input.scope)) {
    return { success: false, error: 'Choose a scope' }
  }

  const admin = createAdminClient()

  // THE FAMILY'S OWN ROWS, and no other family's. The unscoped version of this read took the
  // highest sort_order in the TABLE, which is every family's — so one family's position
  // decided where another family's next one sorted.
  const { data: maxRow } = await admin
    .from('family_roles')
    .select('sort_order')
    .eq('family_code', g.familyCode)
    .order('sort_order', { ascending: false })
    .limit(1)
    .maybeSingle()

  const { error } = await admin
    .from('family_roles')
    .insert({
      name,
      category:    input.category,
      scope:       input.scope,
      family_code: g.familyCode,
      sort_order:  (maxRow?.sort_order ?? 0) + 1,
    })

  if (error) {
    // 23505 IS NOW A COLLISION WITHIN ONE SCOPE, since 20260820000000 widened the key to
    // `(family_code, name, scope)`. The message has to say so or it is actively misleading:
    // it used to read "your family already has a position called President" to somebody adding
    // a REGIONAL President beside a national one, which was true and made the refusal look
    // like a rule about titles rather than about titles at one level.
    //
    // It was a per-family collision before that (20260819000004 replaced a global
    // `UNIQUE (name)` that could collide with another family's row or with a built-in), and
    // the message was honest for exactly as long as that key was the one enforcing.
    if (error.code === '23505') {
      return {
        success: false,
        error: `Your family already has a ${POSITION_SCOPE_LABELS[input.scope].toLowerCase()} `
          + `position called "${name}". The same title can exist once at each scope.`,
      }
    }
    return { success: false, error: error.message }
  }
  revalidatePath('/admin/members/board-positions')
  revalidatePath('/review/election-management')
  return { success: true }
}

/**
 * Rename a position.
 *
 * ── WHY THIS EXISTS, GIVEN CREATE AND DELETE ────────────────────────────────────────
 * Because the delete REFUSES while anybody holds the position, so a typo noticed after the
 * officers are recorded could otherwise only be fixed by un-assigning everybody, deleting,
 * re-adding and re-assigning. That is a bad five minutes for a corrected spelling, and the
 * built-ins this list replaced could not be renamed at all — so shipping without it was not a
 * regression, and adding it is the whole of what TODO.md carried.
 *
 * ── IT RENAMES AND NOTHING ELSE, WHICH IS A DECISION ────────────────────────────────
 * Not the category, and above all NOT THE SCOPE. `user_roles` copies the position's scope onto
 * each assignment at the moment it is made, along with the `chapter_id` or `region_id` that
 * scope requires — `assignBoardPosition` derives all three from the position rather than from
 * the caller, which is what stopped a national office being assigned "for a chapter". So
 * changing a position's scope afterwards would leave every existing assignment describing a
 * scope the position no longer has, with a chapter attached to an office that is now national
 * or none attached to one that is now chapter-scoped. That is two facts disagreeing, which
 * AGENTS.md §4b forbids for exactly this reason.
 *
 * A family that has the scope wrong therefore deletes the position and adds it again, which is
 * right rather than merely simpler: the assignments genuinely are wrong and re-making them is
 * the act of correcting them. The screen offers rename on the NAME only, so the choice is not
 * one a caller can stumble into.
 *
 * §3, and the read-back is not decoration: the service-role client applies no RLS, so without
 * the family conjunct on BOTH statements this is `deleteRegion`'s hole with an UPDATE in it —
 * BRAVO's administrator renaming ALPHA's offices by id. `tests/rls/cases.mjs` carries the case.
 */
export async function renameBoardPosition(
  id: string,
  name: string,
): Promise<{ success: boolean; error?: string }> {
  const g = await requireScope('admin/members/board-positions', 'edit')
  if (!g.ok) return { success: false, error: g.message }

  const next = name.trim()
  if (!next) return { success: false, error: 'A position needs a name' }
  if (next.length > POSITION_NAME_MAX) {
    return { success: false, error: `A position name is at most ${POSITION_NAME_MAX} characters` }
  }

  const admin = createAdminClient()
  // `scope` IS SELECTED FOR THE REFUSAL MESSAGE, not for the update — a rename cannot change
  // scope. The alternative was a second read inside the error branch, which is a query on the
  // unhappy path to say a sentence, and this one is already being made.
  const { data: existing } = await admin.from('family_roles')
    .select('name, scope').eq('id', id).eq('family_code', g.familyCode).maybeSingle()
  if (!existing) return { success: false, error: 'Position not found' }
  // Nothing to do rather than a no-op UPDATE. Worth its own branch because the screen leaves
  // the field editable and Save is the obvious thing to press after changing one's mind.
  if (existing.name === next) return { success: true }

  const { error } = await admin.from('family_roles')
    .update({ name: next })
    .eq('id', id)
    .eq('family_code', g.familyCode)

  if (error) {
    // The same within-scope collision `createBoardPosition` reports, and the same reason the
    // message can be honest about it: the key is scoped to one family, so the row it collided
    // with is one the caller can see.
    //
    // A RENAME CANNOT CHANGE SCOPE, so the scope in this message is the position's own — read
    // back from the row rather than taken from an argument, because this action takes no scope
    // and inventing one to interpolate would be the first step towards letting it move.
    if (error.code === '23505') {
      return {
        success: false,
        error: `Your family already has a ${POSITION_SCOPE_LABELS[existing.scope as PositionScope].toLowerCase()} `
          + `position called "${next}". The same title can exist once at each scope.`,
      }
    }
    return { success: false, error: error.message }
  }
  revalidatePath('/admin/members/board-positions')
  revalidatePath('/review/election-management')
  // The name is printed under members' names in the Directory, on the dashboard and on My
  // Profile — through `formatRoleTitle`, which reads it live rather than storing a copy — so
  // those screens are stale until their next render.
  revalidatePath('/community/directory')
  return { success: true }
}

/**
 * Remove a position from the family's list.
 *
 * IT REFUSES WHILE ANYBODY HOLDS IT, and that is the point rather than caution.
 * `user_roles.role_id` is ON DELETE CASCADE, so the old version deleted the position AND
 * every assignment of it, silently — the confirmation dialog said so in words and the
 * action counted nothing. `deleteRegion` and `deleteChapter` above consult
 * `lib/scope-attached.ts` before deciding for the same reason; this is the same shape with
 * one reference instead of five, so the count is inline rather than through that module.
 */
export async function deleteBoardPosition(id: string): Promise<{ success: boolean; error?: string }> {
  const g = await requireScope('admin/members/board-positions', 'delete')
  if (!g.ok) return { success: false, error: g.message }

  const admin = createAdminClient()

  // §3. Read the row inside the family before deciding anything about it: the service-role
  // client applies no RLS, so `.eq('id', id)` alone let one family delete another's
  // positions — `tests/rls/cases.mjs` carries that case.
  // `scope` IS SELECTED FOR THE REFUSAL MESSAGE, not for the update — a rename cannot change
  // scope. The alternative was a second read inside the error branch, which is a query on the
  // unhappy path to say a sentence, and this one is already being made.
  const { data: existing } = await admin.from('family_roles')
    .select('name, scope').eq('id', id).eq('family_code', g.familyCode).maybeSingle()
  if (!existing) return { success: false, error: 'Position not found' }

  const { count, error: countError } = await admin.from('user_roles')
    .select('id', { count: 'exact', head: true })
    .eq('family_code', g.familyCode)
    .eq('role_id', id)
  if (countError) return { success: false, error: countError.message }
  if ((count ?? 0) > 0) {
    return {
      success: false,
      error: `${count} ${count === 1 ? 'person holds' : 'people hold'} "${existing.name}". `
        + 'Take it away from them first.',
    }
  }

  const { error } = await admin.from('family_roles').delete()
    .eq('id', id).eq('family_code', g.familyCode)
  if (error) return { success: false, error: error.message }
  revalidatePath('/admin/members/board-positions')
  revalidatePath('/review/election-management')
  return { success: true }
}

/**
 * Who holds which position, for the family. One row per assignment.
 *
 * Five reads and a TypeScript join, for the reason in the section header.
 */
export async function getBoardPositionHolders(): Promise<BoardPositionHolder[]> {
  const g = await requireScope('admin/members/board-positions', 'view')
  if (!g.ok) return []

  const admin = createAdminClient()
  const [assignments, positions, people, chapters, regions] = await Promise.all([
    admin.from('user_roles')
      .select('id, user_id, role_id, scope, chapter_id, region_id')
      .eq('family_code', g.familyCode),
    admin.from('family_roles').select('id, name').eq('family_code', g.familyCode),
    admin.from('people').select('id, user_id, first_name, last_name')
      .eq('family_code', g.familyCode).not('user_id', 'is', null),
    admin.from('chapters').select('id, name').eq('family_code', g.familyCode),
    admin.from('regions').select('id, name').eq('family_code', g.familyCode),
  ])

  const failed = assignments.error ?? positions.error ?? people.error
    ?? chapters.error ?? regions.error
  if (failed) {
    console.error(`[chapters] board position holders read failed for ${g.familyCode}: ${failed.message}`)
    return []
  }

  const positionName = new Map((positions.data ?? []).map(p => [p.id, p.name]))
  const chapterName  = new Map((chapters.data ?? []).map(c => [c.id, c.name]))
  const regionName   = new Map((regions.data ?? []).map(r => [r.id, r.name]))
  const person       = new Map((people.data ?? []).map(p => [p.user_id as string, p]))

  return (assignments.data ?? [])
    // A position from another family cannot appear — every read above is family-scoped, so
    // an assignment whose position is not in the map is a row 20260819000004 should have
    // repointed. Dropping it is the safe direction: the alternative is a blank line on the
    // screen that nothing can revoke.
    .filter(a => positionName.has(a.role_id))
    .map(a => {
      const p = person.get(a.user_id)
      return {
        assignment_id: a.id,
        position_id:   a.role_id,
        position_name: positionName.get(a.role_id) as string,
        person_name:   p
          ? (`${p.first_name ?? ''} ${p.last_name ?? ''}`.trim() || 'Unnamed member')
          : 'Somebody no longer in this family',
        // Already in hand — `person` is keyed by `user_id` and holds the whole row — so this
        // costs no query. Null when the assignment's account is not in this family's `people`,
        // which is the same condition `person_name` reports in words.
        person_id:     p?.id ?? null,
        scope:         a.scope as PositionScope,
        chapter_name:  a.chapter_id ? (chapterName.get(a.chapter_id) ?? null) : null,
        region_name:   a.region_id ? (regionName.get(a.region_id) ?? null) : null,
      }
    })
    .sort((x, y) => x.position_name.localeCompare(y.position_name)
      || x.person_name.localeCompare(y.person_name))
}

/**
 * The people who could be given a position: approved members of this family WITH an account.
 *
 * ACCOUNTS ONLY, and that is the schema rather than a policy — `user_roles.user_id`
 * references `auth.users`, so a recorded relative with no account has nothing to key an
 * assignment on. AGENTS.md §4b draws the line between a PICKER and a PROJECTION; this is a
 * picker, and "a record cannot pay or be paid" is the same argument as "a record cannot hold
 * an office".
 */
export async function getAssignableMembers(): Promise<AssignableMember[]> {
  const g = await requireScope('admin/members/board-positions', 'view')
  if (!g.ok) return []

  const { data, error } = await createAdminClient()
    .from('people')
    .select('id, first_name, last_name, nick_name, date_of_birth')
    .eq('family_code', g.familyCode)
    .eq('membership_status', 'approved')
    .not('user_id', 'is', null)
    .order('last_name')
    .order('first_name')

  if (error) {
    console.error(`[chapters] assignable members read failed for ${g.familyCode}: ${error.message}`)
    return []
  }
  return (data ?? []) as AssignableMember[]
}

/**
 * Give somebody a board position.
 *
 * §4 IS THE WHOLE OF THIS FUNCTION. It runs on the service-role client, `user_roles` has no
 * INSERT policy at all, and the row it writes carries the caller's own family_code — so
 * every id on it satisfies every policy while pointing wherever the client said. Its
 * predecessor checked none of them. Four checks, in the order they can refuse cheapest:
 *
 *   1. `personId` is a row in THIS family, approved, with an account. That one read answers
 *      §4's question and supplies the `user_id` the table actually stores, which is why this
 *      takes a people.id and never an identity.
 *   2. `positionId` is a position in THIS family. `belongsToFamily` is the right helper now
 *      that `family_roles.family_code` is NOT NULL — before 20260819000004 it answered
 *      false for all 25 built-ins, so a naive call would have refused every real assignment.
 *   3. The SCOPE IS THE POSITION'S, never the caller's claim. A national position could be
 *      assigned `scope: 'chapter'` before this, because nothing compared the two.
 *   4. A chapter or region, where the position's scope needs one, and it belongs to this
 *      family. Both are `belongsToFamily`, the same check `createChapter` makes on
 *      `region_id` above.
 */
export async function assignBoardPosition(input: {
  positionId: string
  personId: string
  chapterId?: string | null
  regionId?: string | null
}): Promise<{ success: boolean; error?: string }> {
  const g = await requireScope('admin/members/board-positions', 'edit')
  if (!g.ok) return { success: false, error: g.message }

  const admin = createAdminClient()

  const { data: person } = await admin.from('people')
    .select('user_id, membership_status')
    .eq('id', input.personId)
    .eq('family_code', g.familyCode)
    .maybeSingle()
  if (!person) return { success: false, error: 'Member not found' }
  if (person.membership_status !== 'approved') {
    return { success: false, error: 'That member has not been approved yet' }
  }
  if (!person.user_id) {
    return {
      success: false,
      error: 'That relative has no account yet, so there is nothing to attach a position to. '
        + 'Invite them from the family tree first.',
    }
  }

  const { data: position } = await admin.from('family_roles')
    .select('scope')
    .eq('id', input.positionId)
    .eq('family_code', g.familyCode)
    .maybeSingle()
  if (!position) return { success: false, error: 'Position not found' }

  const scope = position.scope as PositionScope
  let chapterId: string | null = null
  let regionId:  string | null = null

  if (scope === 'chapter') {
    if (!input.chapterId) return { success: false, error: 'Choose the chapter this position is for' }
    if (!(await belongsToFamily('chapters', input.chapterId, g.familyCode))) {
      return { success: false, error: 'Chapter not found' }
    }
    chapterId = input.chapterId
  }
  if (scope === 'regional') {
    if (!input.regionId) return { success: false, error: 'Choose the region this position is for' }
    if (!(await belongsToFamily('regions', input.regionId, g.familyCode))) {
      return { success: false, error: 'Region not found' }
    }
    regionId = input.regionId
  }

  const { error } = await admin.from('user_roles').insert({
    user_id:     person.user_id,
    family_code: g.familyCode,
    role_id:     input.positionId,
    assigned_by: g.userId,
    scope,
    chapter_id:  chapterId,
    region_id:   regionId,
  })

  if (error) {
    // `user_roles_user_id_family_code_role_id_key` — one person, one family, one position.
    if (error.code === '23505') {
      return { success: false, error: 'They already hold that position' }
    }
    return { success: false, error: error.message }
  }
  revalidatePath('/admin/members/board-positions')
  revalidatePath('/community/directory')
  return { success: true }
}

/**
 * Take a board position away from somebody.
 *
 * §3. The predecessor was `.delete().eq('id', assignmentId)` on the service-role client with
 * no family conjunct, so BRAVO's administrator could revoke ALPHA's officers by id. The
 * `.eq('family_code', …)` below is the fix and `tests/rls/cases.mjs` is what keeps it.
 */
export async function revokeBoardPosition(
  assignmentId: string,
): Promise<{ success: boolean; error?: string }> {
  const g = await requireScope('admin/members/board-positions', 'edit')
  if (!g.ok) return { success: false, error: g.message }

  const admin = createAdminClient()
  const { data: existing } = await admin.from('user_roles')
    .select('id').eq('id', assignmentId).eq('family_code', g.familyCode).maybeSingle()
  if (!existing) return { success: false, error: 'That assignment no longer exists' }

  const { error } = await admin.from('user_roles').delete()
    .eq('id', assignmentId).eq('family_code', g.familyCode)
  if (error) return { success: false, error: error.message }
  revalidatePath('/admin/members/board-positions')
  revalidatePath('/community/directory')
  return { success: true }
}

/**
 * The regions and chapters a scoped position can be assigned to.
 *
 * THE ADMIN CLIENT, gated on `admin/boardpositions` rather than `admin/chapters`, and
 * `getDuesScopeOptions` in app/actions/dues.ts is the precedent word for word: the composed
 * policies on `regions` and `chapters` both demand `admin/chapters:view = 'any'`, so somebody
 * who curates board positions without that key would see an empty picker and no explanation.
 * Names of regions and chapters are family STRUCTURE rather than PII, and every approved
 * member can already read the chapter list through `getChapters()`. Family-scoped by hand (§3).
 */
export async function getBoardPositionScopeOptions(): Promise<{
  regions: { id: string; name: string }[]
  chapters: { id: string; name: string }[]
}> {
  const g = await requireScope('admin/members/board-positions', 'view')
  if (!g.ok) return { regions: [], chapters: [] }

  const admin = createAdminClient()
  const [regionsRes, chaptersRes] = await Promise.all([
    admin.from('regions').select('id, name').eq('family_code', g.familyCode).order('name'),
    admin.from('chapters').select('id, name').eq('family_code', g.familyCode).order('name'),
  ])

  // §8: an empty picker and a refused query are the same shape and very different facts.
  if (regionsRes.error || chaptersRes.error) {
    console.error('[chapters] board position scope options failed for ' + g.familyCode + ': '
      + (regionsRes.error?.message ?? chaptersRes.error?.message))
    return { regions: [], chapters: [] }
  }
  return {
    regions:  (regionsRes.data ?? []) as { id: string; name: string }[],
    chapters: (chaptersRes.data ?? []) as { id: string; name: string }[],
  }
}
