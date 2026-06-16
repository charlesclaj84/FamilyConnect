import { createAdminClient } from '@/lib/supabase/admin'

/**
 * Returns the authenticated caller's family_code from their people row — the
 * authoritative, non-spoofable source of family membership.
 *
 * Do NOT read family_code from `user.user_metadata` for access control or to
 * scope queries: user_metadata is editable by end users
 * (supabase.auth.updateUser({ data })), so a member could rewrite it to point
 * at another family. The people row is written with the service-role client at
 * registration (see app/actions/register.ts) and a user cannot change their own.
 *
 * Returns '' when the user has no people row yet (e.g. a registration whose
 * profile-seed step failed); callers should treat '' as "no family / deny".
 */
export async function getMyFamilyCode(userId: string): Promise<string> {
  const admin = createAdminClient()
  const { data } = await admin
    .from('people')
    .select('family_code')
    .eq('user_id', userId)
    .maybeSingle()
  return data?.family_code ?? ''
}
