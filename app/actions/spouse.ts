'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { getMyFamilyCode, belongsToFamily } from '@/lib/auth/family'
import { requireRead } from '@/lib/auth/guard'
import { createAdminClient } from '@/lib/supabase/admin'
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
  relationship_id?: string        // set when editing existing; absent when adding new
  my_relationship_type: SpouseRelType
  is_step: boolean
  // New person fields (Path B)
  first_name?: string
  last_name?: string
  primary_email?: string
  date_of_birth?: string
  // Existing person (Path A)
  existing_person_id?: string
  // Reverse relationship (used when linking existing person)
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

type PersonRow = { user_id: string | null; first_name: string | null; last_name: string | null; primary_email: string | null; date_of_birth: string | null }
type RelRow = { id: string; related_person_id: string; relationship_type_id: string; is_step: boolean }

function buildSpouseEntries(
  rels: RelRow[],
  typeNameById: Record<string, string>,
  personById: Record<string, PersonRow>
): SpouseEntry[] {
  return rels.map(rel => {
    const person = personById[rel.related_person_id]
    return {
      relationship_id: rel.id,
      person_id: rel.related_person_id,
      relationship_type: (typeNameById[rel.relationship_type_id] ?? 'Partner') as SpouseRelType,
      is_step: rel.is_step,
      user_id: person?.user_id ?? null,
      first_name: person?.first_name ?? null,
      last_name: person?.last_name ?? null,
      primary_email: person?.primary_email ?? null,
      date_of_birth: person?.date_of_birth ?? null,
    }
  })
}

export async function getMyPartners(): Promise<SpouseEntry[]> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return []

  const myPeopleId = await getMyPeopleId(supabase, user.id)
  if (!myPeopleId) return []

  const { data: types } = await supabase
    .from('relationship_types')
    .select('id, name')
    .in('name', [...SPOUSE_TYPES])
  if (!types?.length) return []

  const typeIds = (types as { id: string }[]).map(t => t.id)
  const typeNameById = Object.fromEntries((types as { id: string; name: string }[]).map(t => [t.id, t.name]))

  const { data: rels } = await supabase
    .from('person_relationships')
    .select('id, related_person_id, relationship_type_id, is_step')
    .eq('person_id', myPeopleId)
    .in('relationship_type_id', typeIds)

  if (!rels?.length) return []

  const personIds = (rels as RelRow[]).map(r => r.related_person_id)
  const { data: persons } = await supabase
    .from('people')
    .select('id, user_id, first_name, last_name, primary_email, date_of_birth')
    .in('id', personIds)

  const personById = Object.fromEntries(((persons ?? []) as ({ id: string } & PersonRow)[]).map(p => [p.id, p]))
  return buildSpouseEntries(rels as RelRow[], typeNameById, personById)
}

export async function getPersonPartners(personId: string): Promise<SpouseEntry[]> {
  const g = await requireRead('family-tree')
  if (!g.ok) return []
  if (!(await belongsToFamily('people', personId, g.familyCode))) return []

  const admin = createAdminClient()

  const { data: types } = await admin
    .from('relationship_types')
    .select('id, name')
    .in('name', [...SPOUSE_TYPES])
  if (!types?.length) return []

  const typeIds = (types as { id: string }[]).map(t => t.id)
  const typeNameById = Object.fromEntries((types as { id: string; name: string }[]).map(t => [t.id, t.name]))

  const { data: rels } = await admin
    .from('person_relationships')
    .select('id, related_person_id, relationship_type_id, is_step')
    .eq('person_id', personId)
    .in('relationship_type_id', typeIds)

  if (!rels?.length) return []

  const personIds = (rels as RelRow[]).map(r => r.related_person_id)
  const { data: persons } = await admin
    .from('people')
    .select('id, user_id, first_name, last_name, primary_email, date_of_birth')
    .in('id', personIds)

  const personById = Object.fromEntries(((persons ?? []) as ({ id: string } & PersonRow)[]).map(p => [p.id, p]))
  return buildSpouseEntries(rels as RelRow[], typeNameById, personById)
}

export async function upsertSpouse(
  input: SpouseInput
): Promise<{ success: boolean; message?: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { success: false, message: 'Not authenticated' }

  const familyCode = await getMyFamilyCode(user.id)
  const myPeopleId = await getMyPeopleId(supabase, user.id)
  if (!myPeopleId) return { success: false, message: 'Could not find your profile' }

  const { data: relType } = await supabase
    .from('relationship_types')
    .select('id')
    .eq('name', input.my_relationship_type)
    .single()
  if (!relType) return { success: false, message: 'Invalid relationship type' }

  if (input.existing_person_id) {
    // ── Path A: link existing person ──────────────────────────────────────
    const personId = input.existing_person_id

    // The relationship rows written below are stamped with the caller's own
    // family_code, which satisfies RLS regardless of where personId actually
    // lives. Without this, naming another family's people.id links a stranger
    // into the caller's family tree — and, through the reverse relationship,
    // writes a row hanging off that stranger.
    if (!(await belongsToFamily('people', personId, familyCode))) {
      return { success: false, message: 'Person not found' }
    }

    if (input.relationship_id) {
      // Edit existing relationship row
      await supabase
        .from('person_relationships')
        .update({ related_person_id: personId, relationship_type_id: (relType as { id: string }).id, is_step: input.is_step })
        .eq('id', input.relationship_id)
        .eq('person_id', myPeopleId)
    } else {
      // Add new relationship
      const { error } = await supabase.from('person_relationships').insert({
        person_id: myPeopleId,
        related_person_id: personId,
        relationship_type_id: (relType as { id: string }).id,
        is_step: input.is_step,
        family_code: familyCode,
        created_by: user.id,
      })
      if (error) return { success: false, message: error.message }
    }

    // Create or update reverse relationship if provided
    if (input.reverse_relationship_type) {
      const { data: spouseTypeRows } = await supabase
        .from('relationship_types').select('id').in('name', [...SPOUSE_TYPES])
      const spouseIds = (spouseTypeRows as { id: string }[] | null)?.map(t => t.id) ?? []

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
          .in('relationship_type_id', spouseIds)
          .maybeSingle()

        if (reverseExists) {
          await supabase
            .from('person_relationships')
            .update({ relationship_type_id: (reverseRelType as { id: string }).id, is_step: input.is_step })
            .eq('id', (reverseExists as { id: string }).id)
        } else {
          await supabase.from('person_relationships').insert({
            person_id: personId,
            related_person_id: myPeopleId,
            relationship_type_id: (reverseRelType as { id: string }).id,
            is_step: input.is_step,
            family_code: familyCode,
            created_by: user.id,
          })
        }
      }
    }
  } else {
    // ── Path B: create or edit person record ─────────────────────────────
    const personFields = {
      first_name: input.first_name?.trim() || '',
      last_name: input.last_name?.trim() || '',
      primary_email: input.primary_email?.trim() || null,
      date_of_birth: input.date_of_birth || null,
    }

    if (input.relationship_id) {
      // Edit existing — find person from the relationship row
      const { data: existingRel } = await supabase
        .from('person_relationships')
        .select('related_person_id')
        .eq('id', input.relationship_id)
        .eq('person_id', myPeopleId)
        .single()

      if (!existingRel) return { success: false, message: 'Relationship not found' }

      const { error: personErr } = await supabase
        .from('people')
        .update(personFields)
        .eq('id', (existingRel as { related_person_id: string }).related_person_id)
      if (personErr) return { success: false, message: personErr.message }

      await supabase
        .from('person_relationships')
        .update({ relationship_type_id: (relType as { id: string }).id, is_step: input.is_step })
        .eq('id', input.relationship_id)
    } else {
      // Add new partner — always INSERT a fresh person + relationship
      const { data: newPerson, error: personError } = await supabase
        .from('people')
        .insert({ family_code: familyCode, is_minor: false, created_by: user.id, ...personFields })
        .select('id')
        .single()
      if (personError || !newPerson) return { success: false, message: personError?.message ?? 'Failed to create record' }

      const { error: relError } = await supabase.from('person_relationships').insert({
        person_id: myPeopleId,
        related_person_id: (newPerson as { id: string }).id,
        relationship_type_id: (relType as { id: string }).id,
        is_step: input.is_step,
        family_code: familyCode,
        created_by: user.id,
      })
      if (relError) {
        await supabase.from('people').delete().eq('id', (newPerson as { id: string }).id)
        return { success: false, message: relError.message }
      }
    }
  }

  revalidatePath('/members/family-tree')
  return { success: true }
}
