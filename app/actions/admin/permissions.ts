'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getMyActiveMembership, belongsToFamily } from '@/lib/auth/family'
import { isFeatureFuture } from '@/lib/features'
import { MEMBER_PAGE_SIZE } from '@/lib/pagination'
import {
  can,
  getMyPermissionSet,
  type PermissionAction,
  type PermissionScope,
} from '@/lib/auth/permissions'

/**
 * Group and permission administration.
 *
 * Every mutation is gated on edit rights over the 'admin/groups' resource, and
 * every write is additionally scoped to the caller's active family. The RLS
 * policies from 20260618000000 enforce the same thing at the database level —
 * these checks give a clean error message rather than a policy violation, and
 * cover the paths that use the service-role client.
 */

const RESOURCE = 'admin/groups'

export type AdminResult = { success: true } | { success: false; message: string }

export interface GroupSummary {
  id: string
  name: string
  description: string | null
  isSystem: boolean
  memberCount: number
}

export interface MemberSummary {
  personId: string
  name: string
  email: string | null
  groupIds: string[]
}

export interface MemberPage {
  rows: MemberSummary[]
  /** Total matching the query, for paging controls. */
  total: number
}

export interface ResourceSummary {
  key: string
  label: string
  category: string
  /**
   * Third display level inside a category, e.g. Accounting > Transactions. Null for
   * an ordinary row, which renders directly under its category heading.
   */
  subsection: string | null
  /** Ordering within the category. Sub-section rows are contiguous by construction. */
  sortOrder: number
  /**
   * Which actions are MEANINGFUL for this resource. A capability row like
   * "Dues Payments" only has `create`; rendering the other three would be four
   * switches wired to nothing, and `view` in particular would read as a privacy
   * control being honoured when nothing consults it.
   */
  actions: PermissionAction[]
  /** 'everyone' or 'restricted' for the caller's family. */
  visibility: 'everyone' | 'restricted'
}

/** Group policy rows keyed `${resource}:${action}`. */
export type PolicyMap = Record<string, PermissionScope>

async function requireGroupAdmin(
  action: PermissionAction = 'edit',
): Promise<{ ok: true; userId: string; familyCode: string } | { ok: false; message: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { ok: false, message: 'Not authenticated.' }

  const { familyCode } = await getMyActiveMembership(user.id)
  if (!familyCode) return { ok: false, message: 'No family associated with your account.' }

  if (!(await can(user.id, RESOURCE, action))) {
    return {
      ok: false,
      message: action === 'delete'
        ? 'You do not have permission to remove members from groups.'
        : 'You do not have permission to manage groups.',
    }
  }
  return { ok: true, userId: user.id, familyCode }
}

/** What the caller may do on the Groups & Permissions page. */
export async function canManageGroups(): Promise<{
  view: boolean
  create: boolean
  edit: boolean
  remove: boolean
}> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { view: false, create: false, edit: false, remove: false }
  const [view, create, edit, remove] = await Promise.all([
    can(user.id, RESOURCE, 'view'),
    can(user.id, RESOURCE, 'create'),
    can(user.id, RESOURCE, 'edit'),
    can(user.id, RESOURCE, 'delete'),
  ])
  return { view, create, edit, remove }
}

// ── Reads ───────────────────────────────────────────────────────────────────

export async function getGroups(): Promise<GroupSummary[]> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return []
  const { familyCode } = await getMyActiveMembership(user.id)
  if (!familyCode) return []

  const admin = createAdminClient()
  const { data: groups } = await admin
    .from('user_groups')
    .select('id, name, description, is_system')
    .eq('family_code', familyCode)
    .order('is_system', { ascending: false })
    .order('name')

  const rows = (groups ?? []) as { id: string; name: string; description: string | null; is_system: boolean }[]
  if (rows.length === 0) return []

  const { data: members } = await admin
    .from('user_group_members')
    .select('group_id')
    .in('group_id', rows.map(g => g.id))

  const counts = new Map<string, number>()
  for (const m of (members ?? []) as { group_id: string }[]) {
    counts.set(m.group_id, (counts.get(m.group_id) ?? 0) + 1)
  }

  return rows.map(g => ({
    id: g.id,
    name: g.name,
    description: g.description,
    isSystem: g.is_system,
    memberCount: counts.get(g.id) ?? 0,
  }))
}

interface PersonRow {
  id: string
  first_name: string
  last_name: string
  primary_email: string | null
}

const displayName = (p: PersonRow) =>
  [p.first_name, p.last_name].filter(Boolean).join(' ') || '(no name)'

/**
 * PostgREST's `or` filter is a comma/parenthesis-delimited mini-language, so a
 * raw query string could break the filter or smuggle in extra conditions. Keep
 * only characters that are meaningful in a name or email.
 */
function safeQuery(query: string): string {
  return query.trim().replace(/[^\p{L}\p{N}\s@._'-]/gu, '').slice(0, 60)
}

/** Attach each person's group ids — only for the rows on the current page. */
async function withGroups(rows: PersonRow[]): Promise<MemberSummary[]> {
  if (rows.length === 0) return []
  const admin = createAdminClient()
  const { data } = await admin
    .from('user_group_members')
    .select('group_id, person_id')
    .in('person_id', rows.map(p => p.id))

  const byPerson = new Map<string, string[]>()
  for (const m of (data ?? []) as { group_id: string; person_id: string }[]) {
    byPerson.set(m.person_id, [...(byPerson.get(m.person_id) ?? []), m.group_id])
  }

  return rows.map(p => ({
    personId: p.id,
    name: displayName(p),
    email: p.primary_email,
    groupIds: byPerson.get(p.id) ?? [],
  }))
}

/**
 * One page of family members, optionally filtered by name or email.
 *
 * Paged and searched in the database on purpose: a family can run to several
 * hundred people, and shipping them all to the browser to filter client-side
 * does not scale.
 */
export async function searchMembers(opts: {
  query?: string
  offset?: number
  limit?: number
} = {}): Promise<MemberPage> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { rows: [], total: 0 }
  const { familyCode } = await getMyActiveMembership(user.id)
  if (!familyCode) return { rows: [], total: 0 }

  // This returns every member's name AND primary_email, and it runs on the service
  // role, so RLS on people never narrows it. Family scoping alone is not the whole
  // answer: a family that has restricted its Member Directory has said this roster
  // is not for everyone, and without this check the endpoint hands it over anyway.
  // Gated on 'members' rather than 'admin/groups' — the group screens are just one
  // caller, but the roster itself is the directory's to govern.
  if (!(await can(user.id, 'members', 'view'))) return { rows: [], total: 0 }

  const limit = opts.limit ?? MEMBER_PAGE_SIZE
  const offset = opts.offset ?? 0
  const q = safeQuery(opts.query ?? '')

  const admin = createAdminClient()
  let builder = admin
    .from('people')
    .select('id, first_name, last_name, primary_email', { count: 'exact' })
    .eq('family_code', familyCode)
    .not('user_id', 'is', null)

  if (q) {
    builder = builder.or(
      `first_name.ilike.%${q}%,last_name.ilike.%${q}%,primary_email.ilike.%${q}%`,
    )
  }

  const { data, count } = await builder
    .order('last_name')
    .order('first_name')
    .range(offset, offset + limit - 1)

  return { rows: await withGroups((data ?? []) as PersonRow[]), total: count ?? 0 }
}

/** One page of the people actually in a group. */
export async function getGroupMembers(groupId: string, opts: {
  query?: string
  offset?: number
  limit?: number
} = {}): Promise<MemberPage> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { rows: [], total: 0 }
  const { familyCode } = await getMyActiveMembership(user.id)
  if (!familyCode) return { rows: [], total: 0 }

  const limit = opts.limit ?? MEMBER_PAGE_SIZE
  const offset = opts.offset ?? 0
  const q = safeQuery(opts.query ?? '')

  const admin = createAdminClient()
  // Inner join so the filter and the count both apply to real memberships.
  let builder = admin
    .from('user_group_members')
    .select('person_id, people!inner(id, first_name, last_name, primary_email, family_code)', { count: 'exact' })
    .eq('group_id', groupId)
    .eq('people.family_code', familyCode)

  if (q) {
    builder = builder.or(
      `first_name.ilike.%${q}%,last_name.ilike.%${q}%,primary_email.ilike.%${q}%`,
      { referencedTable: 'people' },
    )
  }

  const { data, count } = await builder
    .order('last_name', { referencedTable: 'people' })
    .range(offset, offset + limit - 1)

  const rows = ((data ?? []) as { people: unknown }[])
    .map(r => (Array.isArray(r.people) ? r.people[0] : r.people) as PersonRow)
    .filter(Boolean)

  return { rows: await withGroups(rows), total: count ?? 0 }
}

/**
 * Candidates to add to a group: family members matching the query who are not
 * already in it. Bounded to a short list — this backs a type-ahead, not a table.
 */
export async function searchCandidatesForGroup(
  groupId: string,
  query: string,
  limit = 10,
): Promise<MemberSummary[]> {
  const q = safeQuery(query)
  if (!q) return []

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return []
  const { familyCode } = await getMyActiveMembership(user.id)
  if (!familyCode) return []

  const admin = createAdminClient()
  // Over-fetch a little, then drop those already in the group. Cheaper than
  // sending a 500-element NOT IN list to PostgREST.
  const { data } = await admin
    .from('people')
    .select('id, first_name, last_name, primary_email')
    .eq('family_code', familyCode)
    .not('user_id', 'is', null)
    .or(`first_name.ilike.%${q}%,last_name.ilike.%${q}%,primary_email.ilike.%${q}%`)
    .order('last_name')
    .limit(limit * 3)

  const found = (data ?? []) as PersonRow[]
  if (found.length === 0) return []

  const { data: existing } = await admin
    .from('user_group_members')
    .select('person_id')
    .eq('group_id', groupId)
    .in('person_id', found.map(p => p.id))

  const already = new Set(((existing ?? []) as { person_id: string }[]).map(m => m.person_id))

  return found
    .filter(p => !already.has(p.id))
    .slice(0, limit)
    .map(p => ({ personId: p.id, name: displayName(p), email: p.primary_email, groupIds: [] }))
}

export async function getResources(): Promise<ResourceSummary[]> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return []
  const { familyCode } = await getMyActiveMembership(user.id)
  if (!familyCode) return []

  const admin = createAdminClient()
  const [{ data: resources }, { data: visibility }] = await Promise.all([
    admin.from('permission_resources')
      .select('key, label, category, subsection, sort_order, actions')
      .order('sort_order'),
    admin.from('resource_visibility').select('resource_key, visibility').eq('family_code', familyCode),
  ])

  const restricted = new Set(
    ((visibility ?? []) as { resource_key: string; visibility: string }[])
      .filter(v => v.visibility === 'restricted')
      .map(v => v.resource_key),
  )

  type Row = {
    key: string; label: string; category: string
    subsection: string | null; sort_order: number; actions: string[] | null
  }

  return ((resources ?? []) as Row[])
    // A page that hasn't shipped has nothing to permission yet — showing its row
    // would invite configuring access to something nobody can reach. Flip the
    // feature to 'live' in lib/features.ts and it appears here automatically.
    // Keys with no feature entry are not roadmap-gated: that covers the capability
    // rows under Accounting > Transactions, which have no route of their own. Their
    // `transactions/` prefix matters — getFeature() longest-prefix-matches, so
    // `transactions/*` resolves to the live /transactions entry. A key prefixed
    // `family-finances/` or `admin/` would inherit a 'future' entry and vanish from
    // both grids with no error.
    .filter(r => !isFeatureFuture(`/${r.key}`))
    .map(r => ({
      key: r.key,
      label: r.label,
      category: r.category,
      subsection: r.subsection,
      sortOrder: r.sort_order,
      // Older rows predate the column; treat a missing value as "all four".
      actions: (r.actions?.length ? r.actions : ['view', 'create', 'edit', 'delete']) as PermissionAction[],
      visibility: restricted.has(r.key) ? 'restricted' : 'everyone',
    }))
}

/**
 * One group's policy. Reading a family's permission configuration is itself
 * privileged — it is the map of who may do what — so this gates on view over
 * 'admin/groups' rather than being treated as harmless lookup data.
 *
 * `groupId` arrives from the client and the read runs on the service role, so the
 * group is confirmed to belong to the caller's family before anything is returned.
 * Without that, `.eq('group_id', id)` alone hands any signed-in user any family's
 * policy — the query is keyed on a column that carries no family of its own.
 */
export async function getGroupPolicy(groupId: string): Promise<PolicyMap> {
  const g = await requireGroupAdmin('view')
  if (!g.ok) return {}

  const admin = createAdminClient()
  const { data: group } = await admin
    .from('user_groups')
    .select('id')
    .eq('id', groupId)
    .eq('family_code', g.familyCode)
    .maybeSingle()
  if (!group) return {}

  const { data } = await admin
    .from('group_permissions')
    .select('resource_key, action, scope')
    .eq('group_id', groupId)

  const out: PolicyMap = {}
  for (const row of (data ?? []) as { resource_key: string; action: PermissionAction; scope: PermissionScope }[]) {
    out[`${row.resource_key}:${row.action}`] = row.scope
  }
  return out
}

/**
 * One member's individual overrides. Same reasoning as getGroupPolicy above:
 * privileged to read, and `personId` is a client-supplied id used against the
 * service role, so it is checked into the caller's family first.
 */
export async function getPersonPolicy(personId: string): Promise<PolicyMap> {
  const g = await requireGroupAdmin('view')
  if (!g.ok) return {}

  if (!(await belongsToFamily('people', personId, g.familyCode))) return {}

  const admin = createAdminClient()
  const { data } = await admin
    .from('person_permissions')
    .select('resource_key, action, scope')
    .eq('person_id', personId)

  const out: PolicyMap = {}
  for (const row of (data ?? []) as { resource_key: string; action: PermissionAction; scope: PermissionScope }[]) {
    out[`${row.resource_key}:${row.action}`] = row.scope
  }
  return out
}

/**
 * Everything the individual-override grid needs for one member: their own
 * overrides, plus which cells their groups already decide (group policy wins, so
 * those cells must render as not editable rather than pretending otherwise).
 *
 * Returns found: false when the id is not a member of the caller's family, so the
 * page can ignore a stale or hand-typed `?person=` without leaking anything.
 */
export async function getPersonOverrideContext(personId: string): Promise<{
  found: boolean
  personPolicy: PolicyMap
  groupCoveredKeys: string[]
}> {
  const empty = { found: false, personPolicy: {}, groupCoveredKeys: [] }

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return empty
  const { familyCode } = await getMyActiveMembership(user.id)
  if (!familyCode) return empty
  if (!(await can(user.id, RESOURCE, 'view'))) return empty

  const admin = createAdminClient()
  const { data: person } = await admin
    .from('people').select('id').eq('id', personId).eq('family_code', familyCode).maybeSingle()
  if (!person) return empty

  const { data: memberships } = await admin
    .from('user_group_members').select('group_id').eq('person_id', personId)
  const groupIds = ((memberships ?? []) as { group_id: string }[]).map(m => m.group_id)

  const [personPolicy, covered] = await Promise.all([
    getPersonPolicy(personId),
    groupIds.length
      ? admin.from('group_permissions').select('resource_key, action').in('group_id', groupIds)
          .then(r => ((r.data ?? []) as { resource_key: string; action: string }[])
            .map(x => `${x.resource_key}:${x.action}`))
      : Promise.resolve([] as string[]),
  ])

  return { found: true, personPolicy, groupCoveredKeys: [...new Set(covered)] }
}

/** The caller's own effective permissions — used to render the UI honestly. */
export async function getMyEffectivePermissions(): Promise<{ legacy: boolean }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { legacy: false }
  const perms = await getMyPermissionSet(user.id)
  return { legacy: perms.legacy }
}

// ── Groups ──────────────────────────────────────────────────────────────────

export async function createGroup(name: string, description: string): Promise<AdminResult> {
  const auth = await requireGroupAdmin('create')
  if (!auth.ok) return { success: false, message: auth.message }

  const trimmed = name.trim()
  if (!trimmed) return { success: false, message: 'Group name is required.' }

  const admin = createAdminClient()
  const { error } = await admin.from('user_groups').insert({
    family_code: auth.familyCode,
    name: trimmed,
    description: description.trim() || null,
    created_by: auth.userId,
  })

  if (error) {
    if (error.code === '23505') return { success: false, message: 'A group with that name already exists.' }
    return { success: false, message: 'Could not create the group.' }
  }

  revalidatePath('/admin/groups')
  return { success: true }
}

export async function renameGroup(groupId: string, name: string, description: string): Promise<AdminResult> {
  const auth = await requireGroupAdmin()
  if (!auth.ok) return { success: false, message: auth.message }

  const trimmed = name.trim()
  if (!trimmed) return { success: false, message: 'Group name is required.' }

  const admin = createAdminClient()
  const { error } = await admin
    .from('user_groups')
    .update({ name: trimmed, description: description.trim() || null })
    .eq('id', groupId)
    .eq('family_code', auth.familyCode)

  if (error) return { success: false, message: 'Could not rename the group.' }
  revalidatePath('/admin/groups')
  return { success: true }
}

export async function deleteGroup(groupId: string): Promise<AdminResult> {
  const auth = await requireGroupAdmin('delete')
  if (!auth.ok) return { success: false, message: auth.message }

  const admin = createAdminClient()
  const { data: group } = await admin
    .from('user_groups')
    .select('is_system')
    .eq('id', groupId)
    .eq('family_code', auth.familyCode)
    .maybeSingle()

  if (!group) return { success: false, message: 'Group not found.' }
  if ((group as { is_system: boolean }).is_system) {
    return { success: false, message: 'Built-in groups cannot be deleted. Remove its members or clear its policy instead.' }
  }

  const { error } = await admin.from('user_groups').delete().eq('id', groupId).eq('family_code', auth.familyCode)
  if (error) return { success: false, message: 'Could not delete the group.' }

  revalidatePath('/admin/groups')
  revalidatePath('/', 'layout')
  return { success: true }
}

// ── Membership ──────────────────────────────────────────────────────────────

export async function setGroupMembership(
  groupId: string,
  personId: string,
  isMember: boolean,
): Promise<AdminResult> {
  // Adding someone changes the group; removing them destroys a membership, so it
  // is governed by the delete permission rather than edit.
  const auth = await requireGroupAdmin(isMember ? 'edit' : 'delete')
  if (!auth.ok) return { success: false, message: auth.message }

  const admin = createAdminClient()

  // Both the group and the person must belong to the caller's family.
  const [{ data: group }, { data: person }] = await Promise.all([
    admin.from('user_groups').select('id, name').eq('id', groupId).eq('family_code', auth.familyCode).maybeSingle(),
    admin.from('people').select('id').eq('id', personId).eq('family_code', auth.familyCode).maybeSingle(),
  ])
  if (!group) return { success: false, message: 'Group not found in your family.' }
  if (!person) return { success: false, message: 'Member not found in your family.' }

  if (isMember) {
    const { error } = await admin
      .from('user_group_members')
      .upsert({ group_id: groupId, person_id: personId, added_by: auth.userId }, { onConflict: 'group_id,person_id' })
    if (error) return { success: false, message: 'Could not add the member.' }
  } else {
    // Never let the last administrator be removed — the family would lose the
    // ability to manage its own permissions with no way back in.
    const lockout = await wouldLoseLastAdmin(groupId, personId, auth.familyCode)
    if (lockout) return { success: false, message: lockout }

    const { error } = await admin
      .from('user_group_members')
      .delete()
      .eq('group_id', groupId)
      .eq('person_id', personId)
    if (error) return { success: false, message: 'Could not remove the member.' }
  }

  revalidatePath('/admin/groups')
  revalidatePath('/admin/users')
  revalidatePath('/', 'layout')
  return { success: true }
}

/**
 * Normalize a `group_permissions` row joined to `user_groups`. PostgREST types an
 * embedded relation as an array even for a to-one join, so flatten rather than
 * asserting a shape the generated types disagree with.
 */
function asGroupRows(rows: unknown): { groupId: string; familyCode: string }[] {
  return ((rows ?? []) as { group_id: string; user_groups: unknown }[]).map(r => {
    const rel = Array.isArray(r.user_groups) ? r.user_groups[0] : r.user_groups
    return {
      groupId: r.group_id,
      familyCode: (rel as { family_code?: string } | null)?.family_code ?? '',
    }
  })
}

/**
 * Returns an error message when removing `personId` from `groupId` would leave the
 * family with nobody who can edit admin/groups.
 */
async function wouldLoseLastAdmin(
  groupId: string,
  personId: string,
  familyCode: string,
): Promise<string | null> {
  const admin = createAdminClient()

  // Which groups in this family can still edit admin/groups?
  const { data: capable } = await admin
    .from('group_permissions')
    .select('group_id, user_groups!inner(family_code)')
    .eq('resource_key', RESOURCE)
    .eq('action', 'edit')
    .neq('scope', 'none')

  const capableIds = asGroupRows(capable)
    .filter(r => r.familyCode === familyCode)
    .map(r => r.groupId)

  if (!capableIds.includes(groupId)) return null

  const { data: holders } = await admin
    .from('user_group_members')
    .select('person_id, group_id')
    .in('group_id', capableIds)

  const remaining = new Set(
    ((holders ?? []) as { person_id: string; group_id: string }[])
      .filter(h => !(h.group_id === groupId && h.person_id === personId))
      .map(h => h.person_id),
  )

  return remaining.size === 0
    ? 'That would remove the last member who can manage permissions. Add someone else to an administrator group first.'
    : null
}

// ── Policy ──────────────────────────────────────────────────────────────────

export async function setGroupPermission(
  groupId: string,
  resourceKey: string,
  action: PermissionAction,
  scope: PermissionScope,
): Promise<AdminResult> {
  const auth = await requireGroupAdmin()
  if (!auth.ok) return { success: false, message: auth.message }

  const admin = createAdminClient()
  const { data: group } = await admin
    .from('user_groups').select('id').eq('id', groupId).eq('family_code', auth.familyCode).maybeSingle()
  if (!group) return { success: false, message: 'Group not found in your family.' }

  // Guard the same lockout as membership: don't let an admin revoke the last
  // group that can edit permissions.
  if (resourceKey === RESOURCE && action === 'edit' && scope === 'none') {
    const lockout = await wouldLoseLastAdminPolicy(groupId, auth.familyCode)
    if (lockout) return { success: false, message: lockout }
  }

  const { error } = await admin.from('group_permissions').upsert(
    { group_id: groupId, resource_key: resourceKey, action, scope, updated_at: new Date().toISOString() },
    { onConflict: 'group_id,resource_key,action' },
  )
  if (error) return { success: false, message: 'Could not save the permission.' }

  revalidatePath('/admin/groups')
  revalidatePath('/', 'layout')
  return { success: true }
}

async function wouldLoseLastAdminPolicy(groupId: string, familyCode: string): Promise<string | null> {
  const admin = createAdminClient()
  const { data: capable } = await admin
    .from('group_permissions')
    .select('group_id, user_groups!inner(family_code)')
    .eq('resource_key', RESOURCE)
    .eq('action', 'edit')
    .neq('scope', 'none')

  const ids = asGroupRows(capable)
    .filter(r => r.familyCode === familyCode)
    .map(r => r.groupId)
    .filter(id => id !== groupId)

  if (ids.length === 0) {
    return 'This is the only group that can manage permissions. Grant it to another group first.'
  }

  const { data: holders } = await admin
    .from('user_group_members').select('person_id').in('group_id', ids)
  return (holders ?? []).length === 0
    ? 'No other group with permission-management rights has any members. Add someone there first.'
    : null
}

export async function setPersonPermission(
  personId: string,
  resourceKey: string,
  action: PermissionAction,
  scope: PermissionScope | null,
): Promise<AdminResult> {
  const auth = await requireGroupAdmin()
  if (!auth.ok) return { success: false, message: auth.message }

  const admin = createAdminClient()
  const { data: person } = await admin
    .from('people').select('id').eq('id', personId).eq('family_code', auth.familyCode).maybeSingle()
  if (!person) return { success: false, message: 'Member not found in your family.' }

  // null clears the override so the person falls back to their groups.
  if (scope === null) {
    const { error } = await admin
      .from('person_permissions')
      .delete()
      .eq('person_id', personId)
      .eq('resource_key', resourceKey)
      .eq('action', action)
    if (error) return { success: false, message: 'Could not clear the override.' }
  } else {
    const { error } = await admin.from('person_permissions').upsert(
      { person_id: personId, resource_key: resourceKey, action, scope, updated_at: new Date().toISOString() },
      { onConflict: 'person_id,resource_key,action' },
    )
    if (error) return { success: false, message: 'Could not save the override.' }
  }

  revalidatePath('/admin/users')
  revalidatePath('/', 'layout')
  return { success: true }
}

// ── Page visibility ─────────────────────────────────────────────────────────

export async function setResourceVisibility(
  resourceKey: string,
  visibility: 'everyone' | 'restricted',
): Promise<AdminResult> {
  const auth = await requireGroupAdmin()
  if (!auth.ok) return { success: false, message: auth.message }

  const admin = createAdminClient()
  const { error } = await admin.from('resource_visibility').upsert(
    {
      family_code: auth.familyCode,
      resource_key: resourceKey,
      visibility,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'family_code,resource_key' },
  )
  if (error) return { success: false, message: 'Could not update page visibility.' }

  revalidatePath('/admin/groups')
  revalidatePath('/', 'layout')
  return { success: true }
}
