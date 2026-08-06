'use server'

import { createClient } from '@/lib/supabase/server'
import { getMyFamilyCode } from '@/lib/auth/family'
import { can } from '@/lib/auth/permissions'
import { createAdminClient } from '@/lib/supabase/admin'
import { formatRoleTitle } from '@/lib/role-utils'
import type { PersonalInfoData } from '@/app/actions/personal-info'

export interface FamilyRole {
  id: string
  name: string
  category: 'executive_officer' | 'appointed_position'
  scope: 'national' | 'regional' | 'chapter'
  sort_order: number
  is_global: boolean
}

export interface AssignedRole extends FamilyRole {
  assignment_id: string
  assignment_scope: 'national' | 'regional' | 'chapter'
  chapter_id: string | null
  chapter_name: string | null
  region_id: string | null
  region_name: string | null
}

export interface MemberWithRoles {
  people_id: string
  user_id: string
  first_name: string | null
  last_name: string | null
  primary_email: string | null
  chapter_id: string | null
  chapter_name: string | null
  roles: AssignedRole[]
}

export type MyRoleSummary = import('@/lib/role-utils').RoleSummary

/**
 * Board-position assignment is governed by edit rights on the Board Positions
 * page. Replaces the old is_admin lookup: authority now comes from group
 * membership, resolved per active family by lib/auth/permissions.ts.
 */
async function assertCanManageRoles(userId: string): Promise<boolean> {
  return can(userId, 'admin/boardpositions', 'edit')
}

export async function getFamilyMembersWithRoles(): Promise<MemberWithRoles[]> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return []

  const familyCode = await getMyFamilyCode(user.id)
  const admin = createAdminClient()

  const { data: people } = await admin
    .from('people')
    .select('id, user_id, first_name, last_name, primary_email, chapter_id, chapters(name)')
    .eq('family_code', familyCode)
    .not('user_id', 'is', null)
    .order('last_name')
    .order('first_name')

  if (!people?.length) return []

  const userIds = people.map(p => p.user_id as string)
  const { data: userRoles } = await admin
    .from('user_roles')
    .select('id, user_id, role_id, scope, chapter_id, region_id, family_roles(id, name, category, sort_order, scope, is_global), chapters(name), regions(name)')
    .eq('family_code', familyCode)
    .in('user_id', userIds)

  const rolesByUserId: Record<string, AssignedRole[]> = {}
  for (const ur of userRoles ?? []) {
    const role = ur.family_roles as unknown as FamilyRole
    if (!rolesByUserId[ur.user_id]) rolesByUserId[ur.user_id] = []
    if (role) rolesByUserId[ur.user_id].push({
      ...role,
      assignment_id:    ur.id,
      assignment_scope: ur.scope as 'national' | 'regional' | 'chapter',
      chapter_id:       ur.chapter_id ?? null,
      chapter_name:     (ur.chapters as unknown as { name: string } | null)?.name ?? null,
      region_id:        (ur as { region_id?: string | null }).region_id ?? null,
      region_name:      (ur.regions as unknown as { name: string } | null)?.name ?? null,
    })
  }

  return people.map(p => ({
    people_id:    p.id,
    user_id:      p.user_id as string,
    first_name:   p.first_name,
    last_name:    p.last_name,
    primary_email: p.primary_email,
    chapter_id:   p.chapter_id ?? null,
    chapter_name: (p.chapters as unknown as { name: string } | null)?.name ?? null,
    roles:        (rolesByUserId[p.user_id as string] ?? []).sort((a, b) => a.sort_order - b.sort_order),
  }))
}

export async function getAllRoles(): Promise<FamilyRole[]> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return []
  const familyCode = await getMyFamilyCode(user.id)
  const admin = createAdminClient()
  const [rolesRes, exclusionsRes] = await Promise.all([
    admin.from('family_roles').select('*').or(`family_code.is.null,family_code.eq.${familyCode}`).order('sort_order'),
    admin.from('family_role_exclusions').select('role_id').eq('family_code', familyCode),
  ])
  // Only positions the family actually uses (custom roles are always included).
  const excluded = new Set((exclusionsRes.data ?? []).map(e => e.role_id))
  return (rolesRes.data ?? []).filter(r => r.is_global ? !excluded.has(r.id) : true) as FamilyRole[]
}

export async function getMyRoles(): Promise<MyRoleSummary[]> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return []
  const familyCode = await getMyFamilyCode(user.id)
  const admin = createAdminClient()
  const { data } = await admin
    .from('user_roles')
    .select('scope, family_roles(name), chapters(name)')
    .eq('user_id', user.id)
    .eq('family_code', familyCode)
  return (data ?? []).map(r => ({
    role_name:        (r.family_roles as unknown as { name: string } | null)?.name ?? '',
    assignment_scope: r.scope,
    chapter_name:     (r.chapters as unknown as { name: string } | null)?.name ?? null,
  }))
}

// Returns a map of { userId → formatted title strings } for the whole family.
// Used by Family Tree to show titles under each person node.
export async function getFamilyMemberRoles(): Promise<Record<string, string[]>> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return {}
  const familyCode = await getMyFamilyCode(user.id)
  const admin = createAdminClient()

  const { data } = await admin
    .from('user_roles')
    .select('user_id, scope, family_roles(name), chapters(name)')
    .eq('family_code', familyCode)

  const map: Record<string, string[]> = {}
  for (const r of data ?? []) {
    if (!r.user_id) continue
    const summary: MyRoleSummary = {
      role_name:        (r.family_roles as unknown as { name: string } | null)?.name ?? '',
      assignment_scope: r.scope,
      chapter_name:     (r.chapters as unknown as { name: string } | null)?.name ?? null,
    }
    const title = formatRoleTitle(summary)
    if (!map[r.user_id]) map[r.user_id] = []
    map[r.user_id].push(title)
  }
  return map
}

// setAdminFlag / setApproveFlag were removed in the authorization rebuild.
// Authority now comes from group membership — see app/actions/admin/permissions.ts
// (setGroupMembership) and the Groups & Permissions page.

export async function assignRole(
  targetUserId: string,
  roleId: string,
  scope: 'national' | 'regional' | 'chapter' = 'national',
  chapterId?: string,
  regionId?: string,
): Promise<{ success: boolean; error?: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { success: false, error: 'Not authenticated' }
  if (!(await assertCanManageRoles(user.id))) return { success: false, error: 'Not authorized' }

  const familyCode = await getMyFamilyCode(user.id)
  const admin = createAdminClient()
  const { error } = await admin
    .from('user_roles')
    .insert({
      user_id:     targetUserId,
      family_code: familyCode,
      role_id:     roleId,
      assigned_by: user.id,
      scope,
      chapter_id:  scope === 'chapter' ? (chapterId ?? null) : null,
      region_id:   scope === 'regional' ? (regionId ?? null) : null,
    })

  return error ? { success: false, error: error.message } : { success: true }
}

export async function revokeRoleByAssignmentId(
  assignmentId: string
): Promise<{ success: boolean; error?: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { success: false, error: 'Not authenticated' }
  if (!(await assertCanManageRoles(user.id))) return { success: false, error: 'Not authorized' }

  const admin = createAdminClient()
  const { error } = await admin.from('user_roles').delete().eq('id', assignmentId)
  return error ? { success: false, error: error.message } : { success: true }
}

export async function revokeRole(
  targetUserId: string,
  roleId: string
): Promise<{ success: boolean; error?: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { success: false, error: 'Not authenticated' }
  if (!(await assertCanManageRoles(user.id))) return { success: false, error: 'Not authorized' }

  const familyCode = await getMyFamilyCode(user.id)
  const admin = createAdminClient()
  const { error } = await admin
    .from('user_roles')
    .delete()
    .eq('user_id', targetUserId)
    .eq('family_code', familyCode)
    .eq('role_id', roleId)

  return error ? { success: false, error: error.message } : { success: true }
}

export async function updateUserProfile(
  peopleId: string,
  data: Partial<PersonalInfoData>
): Promise<{ success: boolean; error?: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { success: false, error: 'Not authenticated' }
  if (!(await assertCanManageRoles(user.id))) return { success: false, error: 'Not authorized' }

  const admin = createAdminClient()
  const { error } = await admin.from('people').update(data).eq('id', peopleId)
  return error ? { success: false, error: error.message } : { success: true }
}
