'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

export interface UnlinkedPerson {
  id: string
  first_name: string
  last_name: string
  date_of_birth: string | null
  is_minor: boolean
}

export type LinkPersonResult =
  | { success: true }
  | { success: false; message: string }

/**
 * Returns unlinked people (no user account) in the current user's family,
 * along with whether the current user's own record looks like a registration stub
 * (no family relationships yet). Used to decide whether to show the banner.
 */
export async function getLinkPersonBannerData(): Promise<{
  showBanner: boolean
  unlinkedPeople: UnlinkedPerson[]
}> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { showBanner: false, unlinkedPeople: [] }

  const familyCode: string = user.user_metadata?.family_code ?? ''
  if (!familyCode) return { showBanner: false, unlinkedPeople: [] }

  // Find the current user's own person record
  const { data: myPerson } = await supabase
    .from('people')
    .select('id, created_by')
    .eq('user_id', user.id)
    .maybeSingle()

  if (!myPerson) return { showBanner: false, unlinkedPeople: [] }

  // Only show banner if this record was self-created (registration stub)
  if (myPerson.created_by !== user.id) return { showBanner: false, unlinkedPeople: [] }

  // Check whether the stub has any family relationships yet
  const { count } = await supabase
    .from('person_relationships')
    .select('id', { count: 'exact', head: true })
    .or(`person_id.eq.${myPerson.id},related_person_id.eq.${myPerson.id}`)

  if ((count ?? 0) > 0) return { showBanner: false, unlinkedPeople: [] }

  // Fetch unlinked people in the family
  const { data: unlinked } = await supabase
    .from('people')
    .select('id, first_name, last_name, date_of_birth, is_minor')
    .eq('family_code', familyCode)
    .is('user_id', null)
    .order('last_name')
    .order('first_name')

  if (!unlinked || unlinked.length === 0) return { showBanner: false, unlinkedPeople: [] }

  return { showBanner: true, unlinkedPeople: unlinked }
}

/**
 * Links the current user's auth account to an existing unlinked person record,
 * then deletes the stub record that was created during registration.
 */
export async function linkPersonToCurrentUser(
  targetPersonId: string,
): Promise<LinkPersonResult> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { success: false, message: 'Not authenticated.' }

  const familyCode: string = user.user_metadata?.family_code ?? ''
  const admin = createAdminClient()

  // Validate the target exists in the same family and is unlinked
  const { data: target } = await admin
    .from('people')
    .select('id, family_code, user_id')
    .eq('id', targetPersonId)
    .maybeSingle()

  if (!target) return { success: false, message: 'Person not found.' }
  if (target.family_code !== familyCode) return { success: false, message: 'Person is not in your family.' }
  if (target.user_id) return { success: false, message: 'That person already has an account linked.' }

  // Find the current stub record (created at registration)
  const { data: stub } = await admin
    .from('people')
    .select('id')
    .eq('user_id', user.id)
    .maybeSingle()

  if (!stub) return { success: false, message: 'Could not find your current profile record.' }

  // Confirm stub has no relationships before deleting
  const { count: relCount } = await admin
    .from('person_relationships')
    .select('id', { count: 'exact', head: true })
    .or(`person_id.eq.${stub.id},related_person_id.eq.${stub.id}`)

  if ((relCount ?? 0) > 0) {
    return { success: false, message: 'Your current record already has family connections. Please contact an admin to merge.' }
  }

  // Clear user_id from the stub first — the UNIQUE constraint on user_id
  // means we can't set it on the target while the stub still holds it.
  const { error: clearError } = await admin
    .from('people')
    .update({ user_id: null })
    .eq('id', stub.id)

  if (clearError) return { success: false, message: 'Failed to prepare account link. Please try again.' }

  // Link the existing record to this user
  const { error: updateError } = await admin
    .from('people')
    .update({ user_id: user.id })
    .eq('id', targetPersonId)

  if (updateError) {
    // Restore the stub's user_id so the user isn't left unlinked
    await admin.from('people').update({ user_id: user.id }).eq('id', stub.id)
    return { success: false, message: 'Failed to link your account. Please try again.' }
  }

  // Remove the now-unlinked stub
  await admin.from('people').delete().eq('id', stub.id)

  // ── Create reverse parent relationships ─────────────────────────────────────
  // The parent may have added this person as their Son/Daughter before they had
  // an account. Now that they're linked, create the corresponding Father/Mother
  // row from the child's perspective so their Family Tree shows parents.
  const { data: relTypeRows } = await admin
    .from('relationship_types')
    .select('id, name')
    .in('name', ['Son', 'Daughter', 'Father', 'Mother', 'Husband', 'Wife', 'Partner'])

  const relTypeIdByName = Object.fromEntries((relTypeRows ?? []).map(t => [t.name, t.id]))
  const relTypeNameById = Object.fromEntries((relTypeRows ?? []).map(t => [t.id, t.name]))
  const childTypeIds = (['Son', 'Daughter'] as const).map(n => relTypeIdByName[n]).filter((id): id is string => !!id)
  const spouseTypeIds = (['Husband', 'Wife', 'Partner'] as const).map(n => relTypeIdByName[n]).filter((id): id is string => !!id)
  const parentTypeIds = (['Father', 'Mother'] as const).map(n => relTypeIdByName[n]).filter((id): id is string => !!id)

  if (childTypeIds.length) {
    const { data: parentRels } = await admin
      .from('person_relationships')
      .select('person_id, is_step')
      .eq('related_person_id', targetPersonId)
      .in('relationship_type_id', childTypeIds)

    const parentIds = (parentRels ?? []).map(r => r.person_id)
    if (parentIds.length) {
      const [spouseRelsRes, establishedRolesRes] = await Promise.all([
        spouseTypeIds.length
          ? admin.from('person_relationships').select('person_id, relationship_type_id').in('person_id', parentIds).in('relationship_type_id', spouseTypeIds)
          : Promise.resolve({ data: null }),
        parentTypeIds.length
          ? admin.from('person_relationships').select('related_person_id, relationship_type_id').in('related_person_id', parentIds).in('relationship_type_id', parentTypeIds)
          : Promise.resolve({ data: null }),
      ])

      const parentSpouseType: Record<string, string> = {}
      for (const r of spouseRelsRes.data ?? []) {
        parentSpouseType[(r as { person_id: string; relationship_type_id: string }).person_id] =
          relTypeNameById[(r as { person_id: string; relationship_type_id: string }).relationship_type_id] ?? ''
      }
      const parentEstRole: Record<string, string> = {}
      for (const r of establishedRolesRes.data ?? []) {
        parentEstRole[(r as { related_person_id: string; relationship_type_id: string }).related_person_id] =
          relTypeNameById[(r as { related_person_id: string; relationship_type_id: string }).relationship_type_id] ?? ''
      }

      for (const rel of parentRels ?? []) {
        // Skip if reverse already exists
        const { data: existing } = await admin
          .from('person_relationships')
          .select('id')
          .eq('person_id', targetPersonId)
          .eq('related_person_id', rel.person_id)
          .in('relationship_type_id', parentTypeIds.length ? parentTypeIds : ['00000000-0000-0000-0000-000000000000'])
          .maybeSingle()
        if (existing) continue

        // Infer Father or Mother
        let role: 'Father' | 'Mother' = 'Father'
        const st = parentSpouseType[rel.person_id]
        if (st === 'Wife') role = 'Father'
        else if (st === 'Husband') role = 'Mother'
        else {
          const et = parentEstRole[rel.person_id]
          if (et === 'Mother') role = 'Mother'
        }

        const roleTypeId = relTypeIdByName[role]
        if (!roleTypeId) continue

        await admin.from('person_relationships').insert({
          person_id: targetPersonId,
          related_person_id: rel.person_id,
          relationship_type_id: roleTypeId,
          is_step: rel.is_step,
          family_code: familyCode,
          created_by: user.id,
        })
      }
    }
  }

  revalidatePath('/dashboard')
  revalidatePath('/family-tree')
  return { success: true }
}
