'use server'

import { createClient } from '@/lib/supabase/server'
import { computeIsMinor } from '@/lib/age-utils'

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
  is_minor: boolean
}

export async function getMembers(): Promise<MemberRecord[]> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return []

  // Fetch all people in the family (adults and minors)
  const { data: people } = await supabase
    .from('people')
    .select('id, user_id, prefix, first_name, last_name, nick_name, avatar_url, primary_email, primary_phone, chapter_id, date_of_birth, chapters(name)')
    .order('last_name')
    .order('first_name')

  if (!people) return []

  // user_roles links by user_id (not person_id) — build a user_id → role name map
  const { data: roleAssignments } = await supabase
    .from('user_roles')
    .select('user_id, family_roles(name)')

  const primaryRoleByUserId = new Map<string, string>()
  for (const ra of roleAssignments ?? []) {
    const userId = (ra as any).user_id as string | undefined
    const name = (ra.family_roles as any)?.name as string | undefined
    if (name && userId && !primaryRoleByUserId.has(userId)) {
      primaryRoleByUserId.set(userId, name)
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
    primary_role_title: p.user_id ? (primaryRoleByUserId.get(p.user_id) ?? null) : null,
    is_active: !!p.user_id,
    is_minor: computeIsMinor((p as any).date_of_birth),
  }))
}
