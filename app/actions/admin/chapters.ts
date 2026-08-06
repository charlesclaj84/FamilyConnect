'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { can } from '@/lib/auth/permissions'
import { getMyFamilyCode } from '@/lib/auth/family'
import { createAdminClient } from '@/lib/supabase/admin'

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

async function getAuthenticatedAdmin() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { user: null, admin: null, familyCode: '' }

  const familyCode = await getMyFamilyCode(user.id)

  const adminClient = createAdminClient()
  // Authority comes from the caller's groups, resolved for the active family.
  return { user, admin: (await can(user.id, 'admin/chapters', 'edit')) ? adminClient : null, familyCode, adminClient }
}

// ── Regions ────────────────────────────────────────────────────────────────────

export async function getRegions(): Promise<Region[]> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return []

  const familyCode = await getMyFamilyCode(user.id)
  const admin = createAdminClient()

  const { data } = await admin
    .from('regions')
    .select('*')
    .eq('family_code', familyCode)
    .order('name')

  return (data ?? []) as Region[]
}

export async function createRegion(name: string): Promise<{ success: boolean; id?: string; error?: string }> {
  const { user, admin, familyCode } = await getAuthenticatedAdmin()
  if (!admin) return { success: false, error: 'Not authorized' }

  const trimmed = name.trim()
  if (trimmed.toLowerCase() === 'national') return { success: false, error: '"National" is a reserved name' }

  const { data, error } = await admin
    .from('regions')
    .insert({ name: trimmed, family_code: familyCode, created_by: user!.id })
    .select('id')
    .single()

  if (error) return { success: false, error: error.message }
  revalidatePath('/admin/chapters')
  return { success: true, id: data.id }
}

export async function deleteRegion(id: string): Promise<{ success: boolean; error?: string }> {
  const { admin } = await getAuthenticatedAdmin()
  if (!admin) return { success: false, error: 'Not authorized' }

  // Chapters in this region revert to National (ON DELETE SET NULL handles it in DB)
  const { error } = await admin.from('regions').delete().eq('id', id)
  if (error) return { success: false, error: error.message }
  revalidatePath('/admin/chapters')
  return { success: true }
}

// ── Chapters ───────────────────────────────────────────────────────────────────

export async function getChapters(): Promise<Chapter[]> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return []

  const familyCode = await getMyFamilyCode(user.id)
  const admin = createAdminClient()

  const { data } = await admin
    .from('chapters')
    .select('id, family_code, name, region_id, regions(name), created_at')
    .eq('family_code', familyCode)
    .order('name')

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
  regionId?: string | null
): Promise<{ success: boolean; id?: string; error?: string }> {
  const { user, admin, familyCode } = await getAuthenticatedAdmin()
  if (!admin) return { success: false, error: 'Not authorized' }

  const { data, error } = await admin
    .from('chapters')
    .insert({ name: name.trim(), family_code: familyCode, created_by: user!.id, region_id: regionId ?? null })
    .select('id')
    .single()

  if (error) return { success: false, error: error.message }
  revalidatePath('/admin/chapters')
  return { success: true, id: data.id }
}

export async function deleteChapter(id: string): Promise<{ success: boolean; error?: string }> {
  const { admin } = await getAuthenticatedAdmin()
  if (!admin) return { success: false, error: 'Not authorized' }

  const { error } = await admin.from('chapters').delete().eq('id', id)
  if (error) return { success: false, error: error.message }
  revalidatePath('/admin/chapters')
  return { success: true }
}

// ── Custom roles ───────────────────────────────────────────────────────────────

export async function getAllRolesWithGlobal(): Promise<CustomRole[]> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return []

  const familyCode = await getMyFamilyCode(user.id)
  const admin = createAdminClient()

  const [rolesRes, exclusionsRes] = await Promise.all([
    admin.from('family_roles').select('*').or(`family_code.is.null,family_code.eq.${familyCode}`).order('sort_order'),
    admin.from('family_role_exclusions').select('role_id').eq('family_code', familyCode),
  ])

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
  const { admin, familyCode } = await getAuthenticatedAdmin()
  if (!admin) return { success: false, error: 'Not authorized' }

  if (enabled) {
    const { error } = await admin.from('family_role_exclusions').delete().eq('family_code', familyCode).eq('role_id', roleId)
    if (error) return { success: false, error: error.message }
  } else {
    const { error } = await admin.from('family_role_exclusions').upsert(
      { family_code: familyCode, role_id: roleId },
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
  const { user, admin, familyCode } = await getAuthenticatedAdmin()
  if (!admin) return { success: false, error: 'Not authorized' }

  const adminClient = createAdminClient()
  const { data: maxRow } = await adminClient
    .from('family_roles')
    .select('sort_order')
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
      family_code: familyCode,
      sort_order:  nextOrder,
    })

  if (error) return { success: false, error: error.message }
  revalidatePath('/admin/boardpositions')
  return { success: true }
}

export async function deleteCustomRole(id: string): Promise<{ success: boolean; error?: string }> {
  const { admin } = await getAuthenticatedAdmin()
  if (!admin) return { success: false, error: 'Not authorized' }

  const adminClient = createAdminClient()
  const { data } = await adminClient.from('family_roles').select('is_global').eq('id', id).single()
  if (data?.is_global) return { success: false, error: 'Global roles cannot be deleted' }

  const { error } = await admin.from('family_roles').delete().eq('id', id).eq('is_global', false)
  if (error) return { success: false, error: error.message }
  revalidatePath('/admin/boardpositions')
  return { success: true }
}
