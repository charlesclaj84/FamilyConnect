'use server'

import { createClient } from '@/lib/supabase/server'

export interface MemberRecord {
  id: string
  user_id: string | null
  prefix: string | null
  first_name: string
  last_name: string
  nick_name: string | null
  avatar_url: string | null
  primary_email: string | null
  primary_phone: string | null
  chapter_id: string | null
  chapter_name: string | null
  primary_role_title: string | null
  is_active: boolean
}

export async function getMembers(): Promise<MemberRecord[]> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return []

  // Fetch all non-minor adults in the family
  const { data: people } = await supabase
    .from('people')
    .select('id, user_id, prefix, first_name, last_name, nick_name, avatar_url, primary_email, primary_phone, chapter_id, chapters(name)')
    .eq('is_minor', false)
    .order('last_name')
    .order('first_name')

  if (!people) return []

  // Fetch all role assignments for this family (column is `name`, not `title`)
  const { data: roleAssignments } = await supabase
    .from('user_roles')
    .select('person_id, family_roles(name)')

  const primaryRoleByPersonId = new Map<string, string>()
  for (const ra of roleAssignments ?? []) {
    const personId = ra.person_id
    const name = (ra.family_roles as any)?.name as string | undefined
    if (name && !primaryRoleByPersonId.has(personId)) {
      primaryRoleByPersonId.set(personId, name)
    }
  }

  return people.map(p => ({
    id: p.id,
    user_id: p.user_id,
    prefix: (p as any).prefix ?? null,
    first_name: p.first_name,
    last_name: p.last_name,
    nick_name: p.nick_name ?? null,
    avatar_url: p.avatar_url ?? null,
    primary_email: p.primary_email ?? null,
    primary_phone: p.primary_phone ?? null,
    chapter_id: p.chapter_id ?? null,
    chapter_name: (p.chapters as any)?.name ?? null,
    primary_role_title: primaryRoleByPersonId.get(p.id) ?? null,
    is_active: !!p.user_id,
  }))
}
