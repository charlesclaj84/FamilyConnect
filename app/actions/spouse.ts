'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { SPOUSE_TYPES, type SpouseRelType } from '@/lib/family-constants'

export interface SpouseEntry {
  relationship_id: string
  person_id: string
  relationship_type: SpouseRelType
  is_step: boolean
  first_name: string | null
  last_name: string | null
  primary_email: string | null
  date_of_birth: string | null
  user_id: string | null
}

export interface SpouseInput {
  // What this person is to me
  my_relationship_type: SpouseRelType
  is_step: boolean
  // New person fields
  first_name?: string
  last_name?: string
  primary_email?: string
  date_of_birth?: string
  // Existing person
  existing_person_id?: string
  // What I am to them (for reverse relationship when linking existing)
  reverse_relationship_type?: SpouseRelType
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function getMyPeopleId(supabase: any, userId: string): Promise<string | null> {
  const { data } = await supabase
    .from('people')
    .select('id')
    .eq('user_id', userId)
    .maybeSingle()
  return data?.id ?? null
}

export async function getMySpouse(): Promise<SpouseEntry | null> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const myPeopleId = await getMyPeopleId(supabase, user.id)
  if (!myPeopleId) return null

  const { data: types } = await supabase
    .from('relationship_types')
    .select('id, name')
    .in('name', SPOUSE_TYPES)
  if (!types?.length) return null

  const typeIds = types.map(t => t.id)
  const typeNameById = Object.fromEntries(types.map(t => [t.id, t.name]))

  const { data: rel } = await supabase
    .from('person_relationships')
    .select('id, related_person_id, relationship_type_id, is_step')
    .eq('person_id', myPeopleId)
    .in('relationship_type_id', typeIds)
    .maybeSingle()

  if (!rel) return null

  const { data: person } = await supabase
    .from('people')
    .select('id, user_id, first_name, last_name, primary_email, date_of_birth')
    .eq('id', rel.related_person_id)
    .single()

  return {
    relationship_id: rel.id,
    person_id: rel.related_person_id,
    relationship_type: typeNameById[rel.relationship_type_id] as SpouseRelType,
    is_step: rel.is_step,
    user_id: person?.user_id ?? null,
    first_name: person?.first_name ?? null,
    last_name: person?.last_name ?? null,
    primary_email: person?.primary_email ?? null,
    date_of_birth: person?.date_of_birth ?? null,
  }
}

export async function upsertSpouse(
  input: SpouseInput
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
    .eq('name', input.my_relationship_type)
    .single()
  if (!relType) return { success: false, message: 'Invalid relationship type' }

  // Check for existing spouse relationship
  const { data: types } = await supabase
    .from('relationship_types')
    .select('id')
    .in('name', SPOUSE_TYPES)
  const spouseTypeIds = types?.map(t => t.id) ?? []

  const { data: existingRel } = await supabase
    .from('person_relationships')
    .select('id, related_person_id')
    .eq('person_id', myPeopleId)
    .in('relationship_type_id', spouseTypeIds)
    .maybeSingle()

  let personId: string

  if (input.existing_person_id) {
    // ── Path A: link existing person ──────────────────────────────────────
    personId = input.existing_person_id

    if (existingRel) {
      await supabase
        .from('person_relationships')
        .update({ related_person_id: personId, relationship_type_id: relType.id, is_step: input.is_step })
        .eq('id', existingRel.id)
    } else {
      const { error } = await supabase.from('person_relationships').insert({
        person_id: myPeopleId,
        related_person_id: personId,
        relationship_type_id: relType.id,
        is_step: input.is_step,
        family_code: familyCode,
        created_by: user.id,
      })
      if (error) return { success: false, message: error.message }
    }

    // Create reverse relationship
    if (input.reverse_relationship_type) {
      const { data: reverseRelType } = await supabase
        .from('relationship_types')
        .select('id')
        .eq('name', input.reverse_relationship_type)
        .single()

      if (reverseRelType) {
        const { data: reverseExists } = await supabase
          .from('person_relationships')
          .select('id')
          .eq('person_id', personId)
          .eq('related_person_id', myPeopleId)
          .in('relationship_type_id', spouseTypeIds)
          .maybeSingle()

        if (reverseExists) {
          await supabase
            .from('person_relationships')
            .update({ related_person_id: myPeopleId, relationship_type_id: reverseRelType.id, is_step: input.is_step })
            .eq('id', reverseExists.id)
        } else {
          await supabase.from('person_relationships').insert({
            person_id: personId,
            related_person_id: myPeopleId,
            relationship_type_id: reverseRelType.id,
            is_step: input.is_step,
            family_code: familyCode,
            created_by: user.id,
          })
        }
      }
    }
  } else {
    // ── Path B: create new person ─────────────────────────────────────────
    const personFields = {
      first_name: input.first_name?.trim() || '',
      last_name: input.last_name?.trim() || '',
      primary_email: input.primary_email?.trim() || null,
      date_of_birth: input.date_of_birth || null,
    }

    if (existingRel) {
      await supabase.from('people').update(personFields).eq('id', existingRel.related_person_id)
      await supabase
        .from('person_relationships')
        .update({ relationship_type_id: relType.id, is_step: input.is_step })
        .eq('id', existingRel.id)
    } else {
      const { data: newPerson, error: personError } = await supabase
        .from('people')
        .insert({ family_code: familyCode, is_minor: false, created_by: user.id, ...personFields })
        .select('id')
        .single()
      if (personError || !newPerson) return { success: false, message: personError?.message ?? 'Failed to create record' }

      const { error: relError } = await supabase.from('person_relationships').insert({
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
  }

  revalidatePath('/family-tree')
  return { success: true }
}
