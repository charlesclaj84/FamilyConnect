'use server'

import { revalidatePath } from 'next/cache'
import { requireMember, requireRead, requireScope } from '@/lib/auth/guard'
import { belongsToFamily } from '@/lib/auth/family'
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
 *     for a screen that is `/admin/boardpositions`.
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

export interface CustomRole {
  id: string
  name: string
  category: 'executive_officer' | 'appointed_position'
  scope: 'national' | 'regional' | 'chapter'
  is_global: boolean
  sort_order: number
  family_code: string | null
  enabled: boolean   // is this position used by the family? (custom roles always true)
}

/** What each region and chapter has attached, keyed by id — see `getScopeUsage`. */
export interface ScopeUsage {
  regions: Record<string, ScopeAttached>
  chapters: Record<string, ScopeAttached>
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
  const g = await requireScope('admin/chapters', 'view')
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
  const g = await requireScope('admin/chapters', 'create')
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
  revalidatePath('/admin/chapters')
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
  const g = await requireScope('admin/chapters', 'delete')
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
  revalidatePath('/admin/chapters')
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
  const g = await requireScope('admin/chapters', 'create')
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
  revalidatePath('/admin/chapters')
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
  const g = await requireScope('admin/chapters', 'edit')
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
  revalidatePath('/admin/chapters')
  // Who owes a regional due has just changed, so every screen that prices one is stale.
  revalidatePath('/dues')
  revalidatePath('/account-summary')
  revalidatePath('/dues-projections')
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
  const g = await requireScope('admin/chapters', 'delete')
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
  revalidatePath('/admin/chapters')
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
  const g = await requireScope('admin/chapters', 'view')
  if (!g.ok) return { regions: {}, chapters: {} }
  const [regions, chapters] = await Promise.all([
    scopeAttachmentsFor('region', g.familyCode),
    scopeAttachmentsFor('chapter', g.familyCode),
  ])
  return { regions, chapters }
}

// ── Board positions ────────────────────────────────────────────────────────────
//
// THESE FOUR SERVE `/admin/boardpositions`, AND THEY ARE KEYED ON IT SINCE 2026-08-18.
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

export async function getAllRolesWithGlobal(): Promise<CustomRole[]> {
  const g = await requireRead('admin/boardpositions')
  if (!g.ok) return []

  const admin = createAdminClient()
  const [rolesRes, exclusionsRes] = await Promise.all([
    // The GLOBAL rows (family_code IS NULL) are product data seeded by migrations — the 25
    // built-in board positions — and are the same for every family (AGENTS.md, "Four tables
    // in `public` are product data"). The family's own custom roles are the other half, and
    // the `.or()` is scoped to the caller's own family code rather than to an argument.
    admin.from('family_roles').select('*')
      .or(`family_code.is.null,family_code.eq.${g.familyCode}`).order('sort_order'),
    admin.from('family_role_exclusions').select('role_id').eq('family_code', g.familyCode),
  ])

  if (rolesRes.error || exclusionsRes.error) {
    console.error('[chapters] board positions read failed for ' + g.familyCode + ': '
      + (rolesRes.error?.message ?? exclusionsRes.error?.message))
    return []
  }

  const excluded = new Set((exclusionsRes.data ?? []).map(e => e.role_id))
  return (rolesRes.data ?? []).map(r => ({
    ...r,
    enabled: r.is_global ? !excluded.has(r.id) : true,   // custom roles are always used
  })) as CustomRole[]
}

/** Enable/disable a GLOBAL board position for the current family. */
export async function setRoleEnabled(
  roleId: string,
  enabled: boolean,
): Promise<{ success: boolean; error?: string }> {
  const g = await requireScope('admin/boardpositions', 'edit')
  if (!g.ok) return { success: false, error: g.message }
  const admin = createAdminClient()

  if (enabled) {
    const { error } = await admin.from('family_role_exclusions').delete()
      .eq('family_code', g.familyCode).eq('role_id', roleId)
    if (error) return { success: false, error: error.message }
  } else {
    // NOT §4-checked, and it is the one id here that does not need it: a global role has no
    // family, and a CUSTOM role belonging to another family would be excluded for THIS
    // family only — a row saying "we do not use a position we could never see", which
    // changes nothing anybody can observe. The exclusion carries the caller's own
    // family_code, which is what keeps it inert.
    const { error } = await admin.from('family_role_exclusions').upsert(
      { family_code: g.familyCode, role_id: roleId },
      { onConflict: 'family_code,role_id' },
    )
    if (error) return { success: false, error: error.message }
  }
  revalidatePath('/admin/boardpositions')
  revalidatePath('/admin/elections')
  revalidatePath('/admin/users')
  return { success: true }
}

export async function createCustomRole(input: {
  name: string
  category: 'executive_officer' | 'appointed_position'
  scope: 'national' | 'regional' | 'chapter'
}): Promise<{ success: boolean; error?: string }> {
  const g = await requireScope('admin/boardpositions', 'create')
  if (!g.ok) return { success: false, error: g.message }

  const admin = createAdminClient()
  // THE FAMILY'S OWN ROWS AND THE GLOBAL ONES, and no other family's. The unscoped version
  // of this read took the highest sort_order in the TABLE, which is every family's — so one
  // family's custom position decided where another family's next one sorted.
  const { data: maxRow } = await admin
    .from('family_roles')
    .select('sort_order')
    .or(`family_code.is.null,family_code.eq.${g.familyCode}`)
    .order('sort_order', { ascending: false })
    .limit(1)
    .maybeSingle()

  const nextOrder = (maxRow?.sort_order ?? 0) + 1

  const { error } = await admin
    .from('family_roles')
    .insert({
      name:        input.name.trim(),
      category:    input.category,
      scope:       input.scope,
      is_global:   false,
      family_code: g.familyCode,
      sort_order:  nextOrder,
    })

  if (error) return { success: false, error: error.message }
  revalidatePath('/admin/boardpositions')
  return { success: true }
}

export async function deleteCustomRole(id: string): Promise<{ success: boolean; error?: string }> {
  const g = await requireScope('admin/boardpositions', 'delete')
  if (!g.ok) return { success: false, error: g.message }

  const admin = createAdminClient()
  // §3. `family_roles` is the hybrid table AGENTS.md warns about — global rows carry a NULL
  // family_code and family rows carry one — so BOTH conjuncts matter here: the family scope
  // is what stops one family deleting another's custom position (the `is_global` test alone
  // let it through), and `is_global = false` is what stops anybody deleting the product's
  // own 25 seeded positions, which no migration would ever put back.
  const { data } = await admin.from('family_roles')
    .select('is_global').eq('id', id).eq('family_code', g.familyCode).maybeSingle()
  if (!data) return { success: false, error: 'Position not found' }
  if (data.is_global) return { success: false, error: 'Global roles cannot be deleted' }

  const { error } = await admin.from('family_roles').delete()
    .eq('id', id).eq('family_code', g.familyCode).eq('is_global', false)
  if (error) return { success: false, error: error.message }
  revalidatePath('/admin/boardpositions')
  return { success: true }
}
