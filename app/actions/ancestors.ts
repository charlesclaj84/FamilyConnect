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
  user_id: string | null
}

export interface AncestorInput {
  relationship_type: AncestorType
  // Required when NOT using existing_person_id
  first_name?: string
  last_name?: string
  primary_email?: string
  date_of_birth?: string
  is_step: boolean
  // For linking an existing people record
  existing_person_id?: string
  // Reverse relationship (what the current user is to the ancestor) — used when linking existing
  child_relationship_type?: 'Son' | 'Daughter'
  child_is_step?: boolean
}

export interface FamilyMember {
  id: string
  first_name: string | null
  last_name: string | null
  date_of_birth: string | null
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
  user_id: null,
  first_name: null,
  last_name: null,
  primary_email: null,
  date_of_birth: null,
})

// ── Actions ────────────────────────────────────────────────────────────────────

export async function getFamilyMembers(): Promise<FamilyMember[]> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return []

  const familyCode = user.user_metadata?.family_code ?? ''
  const myPeopleId = await getMyPeopleId(supabase, user.id)

  let query = supabase
    .from('people')
    .select('id, first_name, last_name, date_of_birth')
    .eq('family_code', familyCode)
    .order('last_name')
    .order('first_name')

  if (myPeopleId) query = query.neq('id', myPeopleId)

  const { data } = await query
  return (data ?? []) as FamilyMember[]
}

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
  const personById: Record<string, { id: string; user_id: string | null; first_name: string | null; last_name: string | null; primary_email: string | null; date_of_birth: string | null }> = {}
  if (personIds.length) {
    const { data: persons } = await supabase
      .from('people')
      .select('id, user_id, first_name, last_name, primary_email, date_of_birth')
      .in('id', personIds)
    for (const p of persons ?? []) personById[p.id] = p
  }

  // ── Reverse lookup: populate missing Father/Mother slots ────────────────────
  // A parent may have added the current user as their Son/Daughter without a
  // corresponding row from the current user's side. Detect those rows and infer
  // whether the parent is Father or Mother via their spouse type or established role.
  if (!relByType['Father'] || !relByType['Mother']) {
    const { data: extraTypes } = await supabase
      .from('relationship_types')
      .select('id, name')
      .in('name', ['Son', 'Daughter', 'Husband', 'Wife', 'Partner'])

    const extraIdByName = Object.fromEntries((extraTypes ?? []).map(t => [t.name, t.id]))
    const extraNameById = Object.fromEntries((extraTypes ?? []).map(t => [t.id, t.name]))
    const childTypeIds2 = (['Son', 'Daughter'] as const).map(n => extraIdByName[n]).filter((id): id is string => !!id)
    const spouseTypeIds2 = (['Husband', 'Wife', 'Partner'] as const).map(n => extraIdByName[n]).filter((id): id is string => !!id)

    if (childTypeIds2.length) {
      const { data: reverseRels } = await supabase
        .from('person_relationships')
        .select('id, person_id, is_step')
        .eq('related_person_id', myPeopleId)
        .in('relationship_type_id', childTypeIds2)

      const parentIds = (reverseRels ?? []).map(r => r.person_id)

      if (parentIds.length) {
        const [parentPeopleRes, spouseRelsRes, establishedRolesRes] = await Promise.all([
          supabase.from('people')
            .select('id, user_id, first_name, last_name, primary_email, date_of_birth')
            .in('id', parentIds),
          spouseTypeIds2.length
            ? supabase.from('person_relationships')
                .select('person_id, relationship_type_id')
                .in('person_id', parentIds)
                .in('relationship_type_id', spouseTypeIds2)
            : Promise.resolve({ data: null }),
          // typeIds already contains Father + Mother IDs from the main query above
          supabase.from('person_relationships')
            .select('related_person_id, relationship_type_id')
            .in('related_person_id', parentIds)
            .in('relationship_type_id', typeIds),
        ])

        const parentPeopleById: typeof personById = Object.fromEntries(
          (parentPeopleRes.data ?? []).map(p => [p.id, p])
        )
        const parentSpouseType: Record<string, string> = {}
        for (const r of spouseRelsRes.data ?? []) {
          parentSpouseType[(r as { person_id: string; relationship_type_id: string }).person_id] =
            extraNameById[(r as { person_id: string; relationship_type_id: string }).relationship_type_id] ?? ''
        }
        const parentEstRole: Record<string, string> = {}
        for (const r of establishedRolesRes.data ?? []) {
          parentEstRole[r.related_person_id] = typeNameById[r.relationship_type_id] ?? ''
        }

        for (const rel of reverseRels ?? []) {
          if (relByType['Father'] && relByType['Mother']) break

          const parent = parentPeopleById[rel.person_id]
          if (!parent) continue
          if (Object.values(relByType).some(r => r.related_person_id === rel.person_id)) continue

          // Infer Father or Mother from spouse type, then established role, then available slot
          let role: 'Father' | 'Mother' | null = null
          const st = parentSpouseType[rel.person_id]
          if (st === 'Wife') role = 'Father'
          else if (st === 'Husband') role = 'Mother'
          else {
            const et = parentEstRole[rel.person_id]
            if (et === 'Father') role = 'Father'
            else if (et === 'Mother') role = 'Mother'
          }
          if (!role) role = !relByType['Father'] ? 'Father' : 'Mother'

          if (!relByType[role]) {
            const roleTypeId = types?.find(t => t.name === role)?.id
            if (!roleTypeId) continue
            relByType[role] = {
              id: rel.id,
              related_person_id: rel.person_id,
              relationship_type_id: roleTypeId,
              is_step: rel.is_step,
            }
            personById[rel.person_id] = parent
          }
        }
      }
    }
  }

  // ── Derive ancestors by traversing the tree upward ──────────────────────────
  // Each entry means: "slot = (via person)'s (as) ancestor".
  // Process in a while-loop so future levels (great-grandparents, etc.) are
  // handled automatically — just add entries to derivationMap and extend
  // ANCESTOR_TYPES; the traversal logic here never needs to change.
  const derivationMap: Array<{ slot: AncestorType; via: AncestorType; as: 'Father' | 'Mother' }> = [
    { slot: 'Paternal Grandfather', via: 'Father', as: 'Father' },
    { slot: 'Paternal Grandmother', via: 'Father', as: 'Mother' },
    { slot: 'Maternal Grandfather', via: 'Mother', as: 'Father' },
    { slot: 'Maternal Grandmother', via: 'Mother', as: 'Mother' },
    // Future: extend ANCESTOR_TYPES and uncomment / add entries below:
    // { slot: 'Paternal Great-Grandfather', via: 'Paternal Grandfather', as: 'Father' },
    // { slot: 'Paternal Great-Grandmother', via: 'Paternal Grandfather', as: 'Mother' },
    // { slot: 'Maternal Great-Grandfather', via: 'Maternal Grandfather', as: 'Father' },
    // { slot: 'Maternal Great-Grandmother', via: 'Maternal Grandfather', as: 'Mother' },
  ]

  // typeIds / types already contains Father, Mother, and all grandparent IDs
  // (they are all in ANCESTOR_TYPES and were fetched at the top of this function)
  const parentRelTypeIds = (['Father', 'Mother'] as const)
    .map(n => types.find(t => t.name === n)?.id)
    .filter((id): id is string => !!id)

  let pending = derivationMap.filter(d => !relByType[d.slot])

  while (pending.length > 0) {
    // Only process entries whose prerequisite slot is already resolved this round
    const actionable = pending.filter(d => !!relByType[d.via]?.related_person_id)
    if (!actionable.length) break

    const sourceIds = [...new Set(actionable.map(d => relByType[d.via]!.related_person_id))]

    const { data: derivedRels } = await supabase
      .from('person_relationships')
      .select('id, person_id, related_person_id, relationship_type_id, is_step')
      .in('person_id', sourceIds)
      .in('relationship_type_id', parentRelTypeIds)

    // Fetch any person records not already loaded
    const newPersonIds = [...new Set(
      (derivedRels ?? []).map(r => r.related_person_id).filter(id => !personById[id])
    )]
    if (newPersonIds.length) {
      const { data: newPersons } = await supabase
        .from('people')
        .select('id, user_id, first_name, last_name, primary_email, date_of_birth')
        .in('id', newPersonIds)
      for (const p of newPersons ?? []) personById[p.id] = p
    }

    let anyResolved = false
    for (const d of actionable) {
      if (relByType[d.slot]) continue
      const srcId = relByType[d.via]!.related_person_id
      const asTypeId = types.find(t => t.name === d.as)?.id
      if (!asTypeId) continue
      const match = (derivedRels ?? []).find(r => r.person_id === srcId && r.relationship_type_id === asTypeId)
      if (match) {
        const slotTypeId = types.find(t => t.name === d.slot)?.id
        if (!slotTypeId) continue
        relByType[d.slot] = {
          id: match.id,
          related_person_id: match.related_person_id,
          relationship_type_id: slotTypeId,
          is_step: match.is_step,
        }
        anyResolved = true
      }
    }

    if (!anyResolved) break
    pending = pending.filter(d => !relByType[d.slot])
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
      user_id: person?.user_id ?? null,
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

  // Check for existing relationship of this type from this user
  const { data: existingRel } = await supabase
    .from('person_relationships')
    .select('id, related_person_id')
    .eq('person_id', myPeopleId)
    .eq('relationship_type_id', relType.id)
    .maybeSingle()

  let personId: string

  if (input.existing_person_id) {
    // ── Path A: link an existing people record ──────────────────────────────
    personId = input.existing_person_id

    if (existingRel) {
      await supabase
        .from('person_relationships')
        .update({ related_person_id: personId, is_step: input.is_step })
        .eq('id', existingRel.id)
    } else {
      const { error: relError } = await supabase
        .from('person_relationships')
        .insert({
          person_id: myPeopleId,
          related_person_id: personId,
          relationship_type_id: relType.id,
          is_step: input.is_step,
          family_code: familyCode,
          created_by: user.id,
        })
      if (relError) return { success: false, message: relError.message }
    }

    // Create reverse relationship (only for Father/Mother, not grandparents)
    if (
      input.child_relationship_type &&
      (input.relationship_type === 'Father' || input.relationship_type === 'Mother')
    ) {
      const { data: childRelType } = await supabase
        .from('relationship_types')
        .select('id')
        .eq('name', input.child_relationship_type)
        .single()

      if (childRelType) {
        const { data: reverseExists } = await supabase
          .from('person_relationships')
          .select('id')
          .eq('person_id', personId)
          .eq('related_person_id', myPeopleId)
          .eq('relationship_type_id', childRelType.id)
          .maybeSingle()

        if (!reverseExists) {
          await supabase.from('person_relationships').insert({
            person_id: personId,
            related_person_id: myPeopleId,
            relationship_type_id: childRelType.id,
            is_step: input.child_is_step ?? false,
            family_code: familyCode,
            created_by: user.id,
          })
        }
      }
    }
  } else {
    // ── Path B: create a new people record ─────────────────────────────────
    const personFields = {
      first_name: input.first_name?.trim() || '',
      last_name: input.last_name?.trim() || '',
      primary_email: input.primary_email?.trim() || null,
      date_of_birth: input.date_of_birth || null,
    }

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
        .insert({ family_code: familyCode, is_minor: false, created_by: user.id, ...personFields })
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
  }

  revalidatePath('/family-tree')
  return { success: true }
}
