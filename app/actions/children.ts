'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { getMyFamilyCode } from '@/lib/auth/family'
import type { SupabaseClient, User } from '@supabase/supabase-js'
import { CHILD_RELATIONSHIP_TYPES, SPOUSE_TYPES, type ChildRelationshipType } from '@/lib/family-constants'
import { computeIsMinor } from '@/lib/age-utils'

export interface ChildRecord {
  relationship_id: string
  person_id: string
  first_name: string
  middle_name: string | null
  last_name: string
  date_of_birth: string | null
  tshirt_category: string | null
  tshirt_size: string | null
  relationship_type: ChildRelationshipType
  is_step: boolean
  is_minor: boolean
  has_account: boolean
}

export interface SpouseChildRecord {
  person_id: string
  first_name: string
  last_name: string
  date_of_birth: string | null
  spouse_relationship_type: ChildRelationshipType
  spouse_is_step: boolean
}

export interface ChildInput {
  first_name: string
  middle_name?: string
  last_name: string
  date_of_birth?: string
  tshirt_category?: string
  tshirt_size?: string
  relationship_type: ChildRelationshipType
  is_step: boolean
}

// ── Helpers ────────────────────────────────────────────────────────────────────

const normalize = (v?: string | null) => v?.trim() || null

async function getOrCreateMyPeopleId(
  supabase: SupabaseClient,
  user: User
): Promise<string | null> {
  const { data: existing } = await supabase
    .from('people')
    .select('id')
    .eq('user_id', user.id)
    .maybeSingle()

  if (existing) return existing.id

  const { data: created } = await supabase
    .from('people')
    .insert({
      user_id: user.id,
      family_code: user.app_metadata?.family_code ?? '',
      first_name: user.user_metadata?.first_name ?? '',
      last_name: user.user_metadata?.last_name ?? '',
      primary_email: user.email ?? null,
      is_minor: false,
      created_by: user.id,
    })
    .select('id')
    .single()

  return created?.id ?? null
}

// ── Actions ────────────────────────────────────────────────────────────────────

export async function getMyChildren(): Promise<ChildRecord[]> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return []

  const myPeopleId = await getOrCreateMyPeopleId(supabase, user)
  if (!myPeopleId) return []

  const { data: childTypes } = await supabase
    .from('relationship_types')
    .select('id, name')
    .in('name', [...CHILD_RELATIONSHIP_TYPES])

  if (!childTypes?.length) return []

  const childTypeIds = childTypes.map(t => t.id)
  const typeNameById = Object.fromEntries(childTypes.map(t => [t.id, t.name]))

  const { data: relationships } = await supabase
    .from('person_relationships')
    .select('id, related_person_id, relationship_type_id, is_step')
    .eq('person_id', myPeopleId)
    .in('relationship_type_id', childTypeIds)

  if (!relationships?.length) return []

  const personIds = relationships.map(r => r.related_person_id)
  const { data: persons } = await supabase
    .from('people')
    .select('id, first_name, middle_name, last_name, date_of_birth, tshirt_category, tshirt_size, is_minor, user_id')
    .in('id', personIds)

  if (!persons?.length) return []

  const personById = Object.fromEntries(persons.map(p => [p.id, p]))

  const records: ChildRecord[] = relationships
    .filter(rel => personById[rel.related_person_id])
    .map(rel => {
      const p = personById[rel.related_person_id]
      return {
        relationship_id: rel.id,
        person_id: rel.related_person_id,
        first_name: p.first_name ?? '',
        middle_name: p.middle_name ?? null,
        last_name: p.last_name ?? '',
        date_of_birth: p.date_of_birth ?? null,
        tshirt_category: p.tshirt_category ?? null,
        tshirt_size: p.tshirt_size ?? null,
        relationship_type: (typeNameById[rel.relationship_type_id] ?? 'Son') as ChildRelationshipType,
        is_step: rel.is_step,
        is_minor: computeIsMinor(p.date_of_birth),
        has_account: Boolean(p.user_id),
      }
    })

  return records.sort((a, b) => {
    if (!a.date_of_birth) return 1
    if (!b.date_of_birth) return -1
    return new Date(a.date_of_birth).getTime() - new Date(b.date_of_birth).getTime()
  })
}

export async function addChild(
  input: ChildInput
): Promise<{ success: boolean; message?: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { success: false, message: 'Not authenticated' }

  const familyCode = await getMyFamilyCode(user.id)
  const myPeopleId = await getOrCreateMyPeopleId(supabase, user)
  if (!myPeopleId) return { success: false, message: 'Could not find your profile' }

  const { data: child, error: childError } = await supabase
    .from('people')
    .insert({
      family_code: familyCode,
      is_minor: true,
      first_name: input.first_name.trim(),
      middle_name: normalize(input.middle_name),
      last_name: input.last_name.trim(),
      date_of_birth: input.date_of_birth || null,
      tshirt_category: normalize(input.tshirt_category),
      tshirt_size: normalize(input.tshirt_size),
      created_by: user.id,
    })
    .select('id')
    .single()

  if (childError || !child) return { success: false, message: childError?.message ?? 'Failed to create record' }

  const { data: relType } = await supabase
    .from('relationship_types')
    .select('id')
    .eq('name', input.relationship_type)
    .single()

  if (!relType) {
    await supabase.from('people').delete().eq('id', child.id)
    return { success: false, message: 'Invalid relationship type' }
  }

  const { error: relError } = await supabase
    .from('person_relationships')
    .insert({
      person_id: myPeopleId,
      related_person_id: child.id,
      relationship_type_id: relType.id,
      is_step: input.is_step,
      family_code: familyCode,
      created_by: user.id,
    })

  if (relError) {
    await supabase.from('people').delete().eq('id', child.id)
    return { success: false, message: relError.message }
  }

  revalidatePath('/direct-lineage')
  revalidatePath('/family-tree')
  return { success: true }
}

export async function updateChild(
  personId: string,
  relationshipId: string,
  input: ChildInput
): Promise<{ success: boolean; message?: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { success: false, message: 'Not authenticated' }

  // Once the child has joined Family Connect (claimed their own account),
  // they manage their own profile — the parent can no longer edit them.
  const { data: target } = await supabase
    .from('people')
    .select('user_id')
    .eq('id', personId)
    .maybeSingle()

  if (target?.user_id) {
    return {
      success: false,
      message: 'This person has joined Family Connect and now manages their own profile.',
    }
  }

  const { error: personError } = await supabase
    .from('people')
    .update({
      first_name: input.first_name.trim(),
      middle_name: normalize(input.middle_name),
      last_name: input.last_name.trim(),
      date_of_birth: input.date_of_birth || null,
      tshirt_category: normalize(input.tshirt_category),
      tshirt_size: normalize(input.tshirt_size),
    })
    .eq('id', personId)
    .eq('created_by', user.id)

  if (personError) return { success: false, message: personError.message }

  const { data: relType } = await supabase
    .from('relationship_types')
    .select('id')
    .eq('name', input.relationship_type)
    .single()

  if (relType) {
    await supabase
      .from('person_relationships')
      .update({ relationship_type_id: relType.id, is_step: input.is_step })
      .eq('id', relationshipId)
      .eq('created_by', user.id)
  }

  revalidatePath('/direct-lineage')
  revalidatePath('/family-tree')
  return { success: true }
}

export async function deleteChild(
  personId: string,
  relationshipId: string
): Promise<{ success: boolean; message?: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { success: false, message: 'Not authenticated' }

  const { error: relError } = await supabase
    .from('person_relationships')
    .delete()
    .eq('id', relationshipId)
    .eq('created_by', user.id)

  if (relError) return { success: false, message: relError.message }

  // Clean up orphaned people record (no other relationships + no account)
  const { count } = await supabase
    .from('person_relationships')
    .select('id', { count: 'exact', head: true })
    .eq('related_person_id', personId)

  if ((count ?? 0) === 0) {
    await supabase
      .from('people')
      .delete()
      .eq('id', personId)
      .is('user_id', null)
      .eq('created_by', user.id)
  }

  revalidatePath('/direct-lineage')
  revalidatePath('/family-tree')
  return { success: true }
}

export async function getSpouseChildren(): Promise<SpouseChildRecord[]> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return []

  const myPeopleId = await getOrCreateMyPeopleId(supabase, user)
  if (!myPeopleId) return []

  // Resolve relationship type IDs
  const { data: allTypes } = await supabase
    .from('relationship_types')
    .select('id, name')
    .in('name', [...CHILD_RELATIONSHIP_TYPES, ...SPOUSE_TYPES])
  if (!allTypes?.length) return []

  const childTypeIds  = allTypes.filter(t => (CHILD_RELATIONSHIP_TYPES as readonly string[]).includes(t.name)).map(t => t.id)
  const spouseTypeIds = allTypes.filter(t => (SPOUSE_TYPES as readonly string[]).includes(t.name)).map(t => t.id)
  const typeNameById  = Object.fromEntries(allTypes.map(t => [t.id, t.name]))

  // Find my spouse's people ID
  const { data: spouseRel } = await supabase
    .from('person_relationships')
    .select('related_person_id')
    .eq('person_id', myPeopleId)
    .in('relationship_type_id', spouseTypeIds)
    .maybeSingle()
  if (!spouseRel) return []

  const spousePeopleId = spouseRel.related_person_id

  // Get all children of my spouse
  const { data: spouseChildRels } = await supabase
    .from('person_relationships')
    .select('related_person_id, relationship_type_id, is_step')
    .eq('person_id', spousePeopleId)
    .in('relationship_type_id', childTypeIds)
  if (!spouseChildRels?.length) return []

  // Get my existing children IDs to exclude already-accepted ones
  const { data: myChildRels } = await supabase
    .from('person_relationships')
    .select('related_person_id')
    .eq('person_id', myPeopleId)
    .in('relationship_type_id', childTypeIds)

  const myChildIds = new Set((myChildRels ?? []).map(r => r.related_person_id))
  const pendingRels = spouseChildRels.filter(r => !myChildIds.has(r.related_person_id))
  if (!pendingRels.length) return []

  const { data: persons } = await supabase
    .from('people')
    .select('id, first_name, last_name, date_of_birth')
    .in('id', pendingRels.map(r => r.related_person_id))
  if (!persons?.length) return []

  const personById = Object.fromEntries(persons.map(p => [p.id, p]))

  return pendingRels
    .filter(r => personById[r.related_person_id])
    .map(r => {
      const p = personById[r.related_person_id]
      return {
        person_id:               r.related_person_id,
        first_name:              p.first_name ?? '',
        last_name:               p.last_name  ?? '',
        date_of_birth:           p.date_of_birth ?? null,
        spouse_relationship_type: (typeNameById[r.relationship_type_id] ?? 'Son') as ChildRelationshipType,
        spouse_is_step:          r.is_step,
      }
    })
}

export async function acceptSpouseChild(
  childPersonId: string,
  relationshipType: ChildRelationshipType,
  isStep: boolean
): Promise<{ success: boolean; message?: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { success: false, message: 'Not authenticated' }

  const familyCode = await getMyFamilyCode(user.id)
  const myPeopleId = await getOrCreateMyPeopleId(supabase, user)
  if (!myPeopleId) return { success: false, message: 'Could not find your profile' }

  const { data: relType } = await supabase
    .from('relationship_types')
    .select('id')
    .eq('name', relationshipType)
    .single()
  if (!relType) return { success: false, message: 'Invalid relationship type' }

  const { data: existing } = await supabase
    .from('person_relationships')
    .select('id')
    .eq('person_id', myPeopleId)
    .eq('related_person_id', childPersonId)
    .eq('relationship_type_id', relType.id)
    .maybeSingle()
  if (existing) return { success: true }

  const { error } = await supabase.from('person_relationships').insert({
    person_id:            myPeopleId,
    related_person_id:    childPersonId,
    relationship_type_id: relType.id,
    is_step:              isStep,
    family_code:          familyCode,
    created_by:           user.id,
  })
  if (error) return { success: false, message: error.message }

  revalidatePath('/direct-lineage')
  revalidatePath('/family-tree')
  return { success: true }
}

export async function convertChildToAdult(
  personId: string,
  email: string
): Promise<{ success: boolean; message?: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { success: false, message: 'Not authenticated' }

  const { error } = await supabase
    .from('people')
    .update({ is_minor: false, primary_email: email.trim().toLowerCase() })
    .eq('id', personId)
    .eq('created_by', user.id)

  if (error) return { success: false, message: error.message }

  revalidatePath('/direct-lineage')
  revalidatePath('/family-tree')
  return { success: true }
}
