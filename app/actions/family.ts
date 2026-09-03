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

/**
 * Point the active family at the login default. Called right after a sign-in.
 *
 * ── WHAT WAS BROKEN, AND IT WAS THE COLUMN NEXT DOOR ───────────────────────────────
 * `setDefaultFamily` below says "which family opens on login" and `user_family_settings`
 * says the same in a comment. Neither was true: `auth_family_code()` prefers
 * `active_family_code`, `set_active_family` writes it on every switch, and NOTHING ever
 * cleared it — so every session after the first opened on whichever family the member last
 * happened to be looking at, and the Default control changed nothing they could see.
 * `20260902000002` argues it in full.
 *
 * ── WHY IT IS CALLED FROM THE CLIENT, AT FOUR PLACES ───────────────────────────────
 * Next has no sign-in hook. The moment a new session exists is a moment only the browser
 * knows about — `signInWithPassword` in `LoginForm`, `verifyOtp` in `/auth/confirm`, and the
 * two flows in `RegisterForm` and `UpdatePasswordForm` — so the call goes at each of them
 * rather than being inferred somewhere central. There is no fifth today;
 * `grep -l signInWithPassword\|verifyOtp\|exchangeCodeForSession` is the list, and a fifth
 * owes a call.
 *
 * ── IT IS SAFE TO CALL WHEN IT IS NOT NEEDED, WHICH IS WHY THAT IS AFFORDABLE ──────
 * The RPC takes no parameter, writes only this user's own stated default, and returns early
 * when there is no usable one — so a duplicate call, a call for a member of one family, and
 * a call for somebody with no default set are all no-ops. That is what lets four call sites
 * be four one-liners rather than four conditions.
 *
 * ── IT NEVER REPORTS A FAILURE TO THE CALLER, DELIBERATELY ─────────────────────────
 * Every call site has just signed somebody in, and the sign-in is the thing they asked for.
 * A refused RPC must not turn a successful login into an error screen — the cost of failure
 * is opening on the wrong family, which is exactly the state this fixes and which the family
 * switcher can correct in one press. So it is logged and swallowed, the same shape
 * `lib/notifications.ts` keeps for a bell entry that must not undo the decision it announces.
 */
export async function openDefaultFamily(): Promise<void> {
  const supabase = await createClient()
  const { error } = await supabase.rpc('open_default_family')
  if (error) {
    // PGRST202 = the function is not there, i.e. 20260902000002 has not run against this
    // database. Worth distinguishing in the log, because it is the one cause that is a
    // deployment state rather than a fault.
    console.error(error.code === 'PGRST202'
      ? '[family] open_default_family() is missing — 20260902000002 has not been applied'
      : `[family] could not open the default family: ${error.message}`)
  }
}

/** Choose which family opens on login. Does not change the current view. */
export async function setDefaultFamily(familyCode: string): Promise<FamilyActionResult> {
  const result = await callFamilyRpc('set_default_family', familyCode)
  if (result.success) revalidatePath('/personal-info')
  return result
}
