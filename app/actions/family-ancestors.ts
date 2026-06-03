'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'

export const ANCESTOR_RELATIONSHIPS = [
  'paternal_grandfather',
  'paternal_grandmother',
  'maternal_grandfather',
  'maternal_grandmother',
  'father',
  'mother',
] as const

export type AncestorRelationship = (typeof ANCESTOR_RELATIONSHIPS)[number]

export const RELATIONSHIP_LABELS: Record<AncestorRelationship, string> = {
  paternal_grandfather: 'Paternal Grandfather',
  paternal_grandmother: 'Paternal Grandmother',
  maternal_grandfather: 'Maternal Grandfather',
  maternal_grandmother: 'Maternal Grandmother',
  father: 'Father',
  mother: 'Mother',
}

export interface AncestorRecord {
  id: string
  user_id: string
  family_code: string
  relationship: AncestorRelationship
  first_name: string | null
  last_name: string | null
  primary_email: string | null
  date_of_birth: string | null
}

export interface AncestorInput {
  relationship: AncestorRelationship
  first_name: string
  last_name: string
  primary_email?: string
  date_of_birth?: string
}

export async function getAncestors(): Promise<AncestorRecord[]> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return []

  const { data } = await supabase
    .from('family_ancestors')
    .select('*')
    .eq('user_id', user.id)

  return (data ?? []) as AncestorRecord[]
}

export async function upsertAncestor(
  input: AncestorInput
): Promise<{ success: boolean; message?: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { success: false, message: 'Not authenticated' }

  const { error } = await supabase.from('family_ancestors').upsert(
    {
      user_id: user.id,
      family_code: user.user_metadata?.family_code ?? '',
      relationship: input.relationship,
      first_name: input.first_name.trim() || null,
      last_name: input.last_name.trim() || null,
      primary_email: input.primary_email?.trim() || null,
      date_of_birth: input.date_of_birth || null,
    },
    { onConflict: 'user_id,relationship' }
  )

  if (error) return { success: false, message: error.message }

  revalidatePath('/family-tree')
  return { success: true }
}
