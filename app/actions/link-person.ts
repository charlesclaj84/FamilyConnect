'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { getMyFamilyCode, isApprovedMember } from '@/lib/auth/family'
import { createAdminClient } from '@/lib/supabase/admin'
import { scoreMatch, type MatchReason } from '@/lib/match-utils'
import { LINK_EXISTING_PERSON_ENABLED } from '@/lib/feature-flags'

export interface UnlinkedPerson {
  id: string
  first_name: string
  last_name: string
  date_of_birth: string | null
  is_minor: boolean
  /** Match score against the registrant; higher is more likely to be them. */
  score: number
  /** Why this record matched (badges shown to the user). No raw PII. */
  reasons: MatchReason[]
  /** True when this is a confident match (exact identity signal or close name). */
  isStrong: boolean
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
  // Turned off at the ENDPOINT, not only in the dashboard that renders it. This
  // function returns the first name, last name and birth date of every unlinked person
  // in the caller's family; leaving it live behind a hidden banner would keep that
  // roster one POST away for anyone signed in. See lib/feature-flags.ts.
  if (!LINK_EXISTING_PERSON_ENABLED) return { showBanner: false, unlinkedPeople: [] }

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { showBanner: false, unlinkedPeople: [] }

  const familyCode = await getMyFamilyCode(user.id)
  if (!familyCode) return { showBanner: false, unlinkedPeople: [] }

  // Find the current user's own person record in this family (plus the fields we
  // match on). A multi-family user has one row per family; only the one in the
  // family being viewed can be linked to that family's unlinked records.
  const { data: myPerson } = await supabase
    .from('people')
    .select('id, created_by, first_name, last_name, nick_name, primary_email, primary_phone, date_of_birth')
    .eq('user_id', user.id)
    .eq('family_code', familyCode)
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

  // Fetch unlinked people in the family. Email/phone/nick_name are pulled only
  // to compute the match server-side — they are NOT returned to the client.
  const { data: unlinked } = await supabase
    .from('people')
    .select('id, first_name, last_name, nick_name, primary_email, primary_phone, date_of_birth, is_minor')
    .eq('family_code', familyCode)
    .is('user_id', null)

  if (!unlinked || unlinked.length === 0) return { showBanner: false, unlinkedPeople: [] }

  // The stub's email may be empty if registration didn't copy it — fall back to
  // the auth email, which is the strongest signal a brand-new user has.
  const registrant = {
    first_name: myPerson.first_name,
    last_name: myPerson.last_name,
    nick_name: myPerson.nick_name,
    primary_email: myPerson.primary_email || user.email,
    primary_phone: myPerson.primary_phone,
    date_of_birth: myPerson.date_of_birth,
  }

  const ranked: UnlinkedPerson[] = unlinked
    .map(p => {
      const { score, reasons, isStrong } = scoreMatch(registrant, p)
      // Strip contact PII — only name, birth year, and match reasons reach the browser.
      return {
        id: p.id,
        first_name: p.first_name,
        last_name: p.last_name,
        date_of_birth: p.date_of_birth,
        is_minor: p.is_minor,
        score,
        reasons,
        isStrong,
      }
    })
    .sort((a, b) =>
      b.score - a.score ||
      a.last_name.localeCompare(b.last_name) ||
      a.first_name.localeCompare(b.first_name),
    )

  return { showBanner: true, unlinkedPeople: ranked }
}

/**
 * Links the current user's auth account to an existing unlinked person record,
 * then deletes the stub record that was created during registration.
 *
 * Runs entirely on the service-role client, so it owes by hand everything RLS would
 * have done (AGENTS.md §3) — including the membership test below. An applicant
 * awaiting approval must not be able to reach this at all: the row it moves them onto
 * is one an existing member entered, and picking one is not a way to be admitted.
 * The status carry-across further down is the second layer, not the only one.
 */
export async function linkPersonToCurrentUser(
  targetPersonId: string,
): Promise<LinkPersonResult> {
  // The half that actually matters. This action moves an existing `people` row — with
  // whatever dues history, payments, relationships and photo tags it carries — onto the
  // caller's account, on nothing more than their say-so that it is them. Hiding the
  // banner leaves that a live POST away. Refused here first, before anything is read.
  if (!LINK_EXISTING_PERSON_ENABLED) {
    return { success: false, message: 'This feature is not currently available.' }
  }

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { success: false, message: 'Not authenticated.' }

  if (!(await isApprovedMember(user.id))) {
    return { success: false, message: 'Your membership is awaiting approval.' }
  }

  const familyCode = await getMyFamilyCode(user.id)
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

  // Find the current stub record (created at registration) for THIS family.
  // membership_status comes along because it has to be carried onto the target — see
  // the comment on the update below.
  const { data: stub } = await admin
    .from('people')
    .select('id, membership_status')
    .eq('user_id', user.id)
    .eq('family_code', familyCode)
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

  // Clear user_id from the stub first — UNIQUE(user_id, family_code) means we
  // can't set it on the target while the stub still holds it for this family.
  const { error: clearError } = await admin
    .from('people')
    .update({ user_id: null })
    .eq('id', stub.id)

  if (clearError) return { success: false, message: 'Failed to prepare account link. Please try again.' }

  // Link the existing record to this user.
  //
  // membership_status MOVES WITH THE USER, and this is the whole reason the column is
  // written here rather than left alone. The target is a relative someone entered by
  // hand, so it is 'approved' — correctly, since the column default is what makes a
  // child or an ancestor visible in the directory. But approval attaches to a
  // MEMBERSHIP, not to a row, and this action's entire job is to move a membership
  // from one row to another. Left implicit, an applicant awaiting approval could
  // launder themselves into the family by picking any pre-entered relative from the
  // banner: their pending stub is deleted below and the row they land on says
  // 'approved'.
  //
  // The stamp trigger cannot cover this. It fires BEFORE INSERT, and this is an
  // UPDATE; and by the time it runs the stub's user_id has already been cleared just
  // above (UNIQUE(user_id, family_code) forces that order), so a trigger on
  // UPDATE OF user_id could not find the row whose status it was supposed to inherit.
  // Hence explicitly, here, plus the caller check at the top of the action.
  const { error: updateError } = await admin
    .from('people')
    .update({
      user_id: user.id,
      membership_status: stub.membership_status ?? 'pending',
    })
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
  return { success: true }
}
