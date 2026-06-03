'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import type { SupabaseClient } from '@supabase/supabase-js'
import { ANCESTOR_TYPES, type AncestorType } from '@/lib/family-constants'

export interface AncestorEntry {
  relationship_type: AncestorType
  relationship_id: string | null
  person_id: string | null
  is_step: boolean
  first_name: string | null
  last_name: string | null
  primary_email: string | null
  date_of_birth: string | null
}

export interface AncestorInput {
  relationship_type: AncestorType
  first_name: string
  last_name: string
  primary_email?: string
  date_of_birth?: string
  is_step: boolean
}

// ── Helper ─────────────────────────────────────────────────────────────────────

async function getMyPeopleId(
  supabase: SupabaseClient,
  userId: string
): Promise<string | null> {
  const { data } = await supabase
    .from('people')
    .select('id')
    .eq('user_id', userId)
    .maybeSingle()
  return data?.id ?? null
}

const emptyEntry = (type: AncestorType): AncestorEntry => ({
  relationship_type: type,
  relationship_id: null,
  person_id: null,
  is_step: false,
  first_name: null,
  last_name: null,
  primary_email: null,
  date_of_birth: null,
})

// ── Actions ────────────────────────────────────────────────────────────────────

export async function getMyAncestors(): Promise<AncestorEntry[]> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return ANCESTOR_TYPES.map(emptyEntry)

  const myPeopleId = await getMyPeopleId(supabase, user.id)
  if (!myPeopleId) return ANCESTOR_TYPES.map(emptyEntry)

  const { data: types } = await supabase
    .from('relationship_types')
    .select('id, name')
    .in('name', [...ANCESTOR_TYPES])

  if (!types?.length) return ANCESTOR_TYPES.map(emptyEntry)

  const typeIds       = types.map(t => t.id)
  const typeNameById  = Object.fromEntries(types.map(t => [t.id, t.name]))

  const { data: relationships } = await supabase
    .from('person_relationships')
    .select('id, related_person_id, relationship_type_id, is_step')
    .eq('person_id', myPeopleId)
    .in('relationship_type_id', typeIds)

  // Index first match per relationship type (one person per ancestor slot)
  const relByType: Record<string, NonNullable<typeof relationships>[number]> = {}
  for (const rel of relationships ?? []) {
    const name = typeNameById[rel.relationship_type_id]
    if (name && !relByType[name]) relByType[name] = rel
  }

  // Fetch person records
  const personIds = Object.values(relByType).map(r => r.related_person_id)
  const personById: Record<string, { id: string; first_name: string | null; last_name: string | null; primary_email: string | null; date_of_birth: string | null }> = {}
  if (personIds.length) {
    const { data: persons } = await supabase
      .from('people')
      .select('id, first_name, last_name, primary_email, date_of_birth')
      .in('id', personIds)
    for (const p of persons ?? []) personById[p.id] = p
  }

  return ANCESTOR_TYPES.map(type => {
    const rel = relByType[type]
    if (!rel) return emptyEntry(type)
    const person = personById[rel.related_person_id]
    return {
      relationship_type: type,
      relationship_id: rel.id,
      person_id: rel.related_person_id,
      is_step: rel.is_step,
      first_name: person?.first_name ?? null,
      last_name: person?.last_name ?? null,
      primary_email: person?.primary_email ?? null,
      date_of_birth: person?.date_of_birth ?? null,
    }
  })
}

export async function upsertAncestor(
  input: AncestorInput
): Promise<{ success: boolean; message?: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { success: false, message: 'Not authenticated' }

  const familyCode = user.user_metadata?.family_code ?? ''
  const myPeopleId = await getMyPeopleId(supabase, user.id)
  if (!myPeopleId) return { success: false, message: 'Could not find your profile' }

  const { data: relType } = await supabase
    .from('relationship_types')
    .select('id')
    .eq('name', input.relationship_type)
    .single()

  if (!relType) return { success: false, message: 'Invalid relationship type' }

  const personFields = {
    first_name: input.first_name.trim() || '',
    last_name: input.last_name.trim() || '',
    primary_email: input.primary_email?.trim() || null,
    date_of_birth: input.date_of_birth || null,
  }

  // Check for existing relationship of this type from this user
  const { data: existingRel } = await supabase
    .from('person_relationships')
    .select('id, related_person_id')
    .eq('person_id', myPeopleId)
    .eq('relationship_type_id', relType.id)
    .maybeSingle()

  if (existingRel) {
    const { error } = await supabase
      .from('people')
      .update(personFields)
      .eq('id', existingRel.related_person_id)

    if (error) return { success: false, message: error.message }

    await supabase
      .from('person_relationships')
      .update({ is_step: input.is_step })
      .eq('id', existingRel.id)
  } else {
    const { data: newPerson, error: personError } = await supabase
      .from('people')
      .insert({
        family_code: familyCode,
        is_minor: false,
        created_by: user.id,
        ...personFields,
      })
      .select('id')
      .single()

    if (personError || !newPerson) return { success: false, message: personError?.message ?? 'Failed to create record' }

    const { error: relError } = await supabase
      .from('person_relationships')
      .insert({
        person_id: myPeopleId,
        related_person_id: newPerson.id,
        relationship_type_id: relType.id,
        is_step: input.is_step,
        family_code: familyCode,
        created_by: user.id,
      })

    if (relError) {
      await supabase.from('people').delete().eq('id', newPerson.id)
      return { success: false, message: relError.message }
    }
  }

  revalidatePath('/family-tree')
  return { success: true }
}
