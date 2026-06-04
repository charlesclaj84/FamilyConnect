'use server'

import { createClient } from '@/lib/supabase/server'
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
}

export interface MemberWithRoles {
  people_id: string
  user_id: string
  first_name: string | null
  last_name: string | null
  primary_email: string | null
  is_admin: boolean
  can_approve: boolean
  chapter_id: string | null
  chapter_name: string | null
  roles: AssignedRole[]
}

export type MyRoleSummary = import('@/lib/role-utils').RoleSummary

async function assertAdmin(supabase: Awaited<ReturnType<typeof createClient>>, userId: string): Promise<boolean> {
  const admin = createAdminClient()
  const { data } = await admin
    .from('people')
    .select('is_admin')
    .eq('user_id', userId)
    .maybeSingle()
  return data?.is_admin === true
}

export async function getFamilyMembersWithRoles(): Promise<MemberWithRoles[]> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return []

  const familyCode: string = user.user_metadata?.family_code ?? ''
  const admin = createAdminClient()

  const { data: people } = await admin
    .from('people')
    .select('id, user_id, first_name, last_name, primary_email, is_admin, can_approve, chapter_id, chapters(name)')
    .eq('family_code', familyCode)
    .not('user_id', 'is', null)
    .order('last_name')
    .order('first_name')

  if (!people?.length) return []

  const userIds = people.map(p => p.user_id as string)
  const { data: userRoles } = await admin
    .from('user_roles')
    .select('id, user_id, role_id, scope, chapter_id, family_roles(id, name, category, sort_order, scope, is_global), chapters(name)')
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
    })
  }

  return people.map(p => ({
    people_id:    p.id,
    user_id:      p.user_id as string,
    first_name:   p.first_name,
    last_name:    p.last_name,
    primary_email: p.primary_email,
    is_admin:     p.is_admin,
    can_approve:  p.can_approve,
    chapter_id:   p.chapter_id ?? null,
    chapter_name: (p.chapters as { name: string } | null)?.name ?? null,
    roles:        (rolesByUserId[p.user_id as string] ?? []).sort((a, b) => a.sort_order - b.sort_order),
  }))
}

export async function getAllRoles(): Promise<FamilyRole[]> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return []
  const familyCode: string = user.user_metadata?.family_code ?? ''
  const admin = createAdminClient()
  const { data } = await admin
    .from('family_roles')
    .select('*')
    .or(`family_code.is.null,family_code.eq.${familyCode}`)
    .order('sort_order')
  return (data ?? []) as FamilyRole[]
}

export async function getMyRoles(): Promise<MyRoleSummary[]> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return []
  const familyCode: string = user.user_metadata?.family_code ?? ''
  const admin = createAdminClient()
  const { data } = await admin
    .from('user_roles')
    .select('scope, family_roles(name), chapters(name)')
    .eq('user_id', user.id)
    .eq('family_code', familyCode)
  return (data ?? []).map(r => ({
    role_name:        (r.family_roles as { name: string } | null)?.name ?? '',
    assignment_scope: r.scope,
    chapter_name:     (r.chapters as { name: string } | null)?.name ?? null,
  }))
}

// Returns a map of { userId → formatted title strings } for the whole family.
// Used by Family Tree to show titles under each person node.
export async function getFamilyMemberRoles(): Promise<Record<string, string[]>> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return {}
  const familyCode: string = user.user_metadata?.family_code ?? ''
  const admin = createAdminClient()

  const { data } = await admin
    .from('user_roles')
    .select('user_id, scope, family_roles(name), chapters(name)')
    .eq('family_code', familyCode)

  const map: Record<string, string[]> = {}
  for (const r of data ?? []) {
    if (!r.user_id) continue
    const summary: MyRoleSummary = {
      role_name:        (r.family_roles as { name: string } | null)?.name ?? '',
      assignment_scope: r.scope,
      chapter_name:     (r.chapters as { name: string } | null)?.name ?? null,
    }
    const title = formatRoleTitle(summary)
    if (!map[r.user_id]) map[r.user_id] = []
    map[r.user_id].push(title)
  }
  return map
}

export async function setAdminFlag(
  targetUserId: string,
  isAdmin: boolean
): Promise<{ success: boolean; error?: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { success: false, error: 'Not authenticated' }
  if (!(await assertAdmin(supabase, user.id))) return { success: false, error: 'Not authorized' }

  const admin = createAdminClient()
  const { error } = await admin
    .from('people')
    .update({ is_admin: isAdmin })
    .eq('user_id', targetUserId)

  return error ? { success: false, error: error.message } : { success: true }
}

export async function setApproveFlag(
  targetUserId: string,
  canApprove: boolean
): Promise<{ success: boolean; error?: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { success: false, error: 'Not authenticated' }
  if (!(await assertAdmin(supabase, user.id))) return { success: false, error: 'Not authorized' }

  const admin = createAdminClient()
  const { error } = await admin
    .from('people')
    .update({ can_approve: canApprove })
    .eq('user_id', targetUserId)

  return error ? { success: false, error: error.message } : { success: true }
}

export async function assignRole(
  targetUserId: string,
  roleId: string,
  scope: 'national' | 'regional' | 'chapter' = 'national',
  chapterId?: string
): Promise<{ success: boolean; error?: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { success: false, error: 'Not authenticated' }
  if (!(await assertAdmin(supabase, user.id))) return { success: false, error: 'Not authorized' }

  const familyCode: string = user.user_metadata?.family_code ?? ''
  const admin = createAdminClient()
  const { error } = await admin
    .from('user_roles')
    .insert({
      user_id:     targetUserId,
      family_code: familyCode,
      role_id:     roleId,
      assigned_by: user.id,
      scope,
      chapter_id:  chapterId ?? null,
    })

  return error ? { success: false, error: error.message } : { success: true }
}

export async function revokeRoleByAssignmentId(
  assignmentId: string
): Promise<{ success: boolean; error?: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { success: false, error: 'Not authenticated' }
  if (!(await assertAdmin(supabase, user.id))) return { success: false, error: 'Not authorized' }

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
  if (!(await assertAdmin(supabase, user.id))) return { success: false, error: 'Not authorized' }

  const familyCode: string = user.user_metadata?.family_code ?? ''
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
  if (!(await assertAdmin(supabase, user.id))) return { success: false, error: 'Not authorized' }

  const admin = createAdminClient()
  const { error } = await admin.from('people').update(data).eq('id', peopleId)
  return error ? { success: false, error: error.message } : { success: true }
}
