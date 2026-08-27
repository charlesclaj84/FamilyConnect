'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { getMyFamilies, type FamilyMembership } from '@/lib/auth/family'
import { currentUser } from '@/lib/auth/current-user'
import { callerI18n } from '@/lib/i18n/server'

export type FamilyActionResult =
  | { success: true }
  | { success: false; message: string }

/** The caller's memberships, for the switcher and the profile page. */
export async function getMyFamilyMemberships(): Promise<FamilyMembership[]> {
  const { user } = await currentUser()
  if (!user) return []
  return getMyFamilies(user.id)
}

/**
 * Both writes go through SECURITY DEFINER RPCs called with the *authenticated*
 * client, so auth.uid() is the caller and the function re-checks that they
 * actually belong to the target family. We deliberately do not write
 * user_family_settings directly — that table has no insert/update policy.
 */
async function callFamilyRpc(
  fn: 'set_active_family' | 'set_default_family',
  familyCode: string,
): Promise<FamilyActionResult> {
  const supabase = await createClient()
  const { user } = await currentUser()
  const { t } = await callerI18n(user?.id ?? null)
  // AFTER the translator, not before it. This refusal is the first thing the function does
  // and needs no session — but it needs a sentence, and the sentence needs a language, so
  // the two cheap resolves above it come first. `currentUser()` is cached and this action
  // was going to call it on the next line regardless.
  if (!familyCode) return { success: false, message: t('act.noFamilySelected2') }
  if (!user) return { success: false, message: t('act.notAuthenticated2') }

  const { error } = await supabase.rpc(fn, { p_family_code: familyCode })

  if (error) {
    // PGRST202 = function not found, i.e. migration 20260617000000 has not run.
    if (error.code === 'PGRST202') {
      return {
        success: false,
        message: t('act.multiFamilySupportNotEnabled'),
      }
    }
    if (error.message?.includes('not a member of family')) {
      return { success: false, message: t('act.youNotMemberFamily') }
    }
    return { success: false, message: t('act.couldNotUpdateYourFamily') }
  }

  return { success: true }
}

/**
 * Switch which family the user is acting in. Every family-scoped query and RLS
 * policy reads from the same selection, so the whole app has to be revalidated.
 */
export async function switchActiveFamily(familyCode: string): Promise<FamilyActionResult> {
  const result = await callFamilyRpc('set_active_family', familyCode)
  if (result.success) revalidatePath('/', 'layout')
  return result
}

/** Choose which family opens on login. Does not change the current view. */
export async function setDefaultFamily(familyCode: string): Promise<FamilyActionResult> {
  const result = await callFamilyRpc('set_default_family', familyCode)
  if (result.success) revalidatePath('/personal-info')
  return result
}
