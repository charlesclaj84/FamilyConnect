'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { getMyFamilies } from '@/lib/auth/family'
import { switchActiveFamily } from '@/app/actions/family'
import { notifyApprovers } from '@/lib/notifications'

/**
 * Joining an existing family by its code, from /my-families.
 *
 * TWO STEPS WITH A CONFIRMATION BETWEEN THEM. `validateFamilyCode` turns a code into
 * a family NAME so the user can be asked "yes, join the Okonkwo Family?" before a
 * membership exists. A six-character code is dictated over the phone and typed from
 * memory; committing on the first keystroke would enrol people into the wrong family
 * and leave an administrator to clean it up.
 *
 * EVERY DATABASE OPERATION HERE GOES THROUGH A SECURITY DEFINER RPC ON THE USER
 * CLIENT, and both halves of that matter:
 *
 *   SECURITY DEFINER, because neither operation is one the caller's own policies can
 *   perform. Reading a family they are not yet in is outside `families`' SELECT
 *   policy, and the `people` INSERT policy requires family_code = auth_family_code(),
 *   which for anyone who already belongs to a family is their EXISTING family — so a
 *   second membership cannot be inserted through it at all.
 *
 *   The USER client, because that is where the authorization lives. Called with
 *   createAdminClient() there is no auth.uid(), and join_family_by_code() derives the
 *   member it is enrolling from exactly that. It refuses outright rather than
 *   enrolling nobody (20260806000011 §7b), so this is not a convention that can rot —
 *   but pass the user client anyway, and never the admin one.
 *
 * WHAT THIS ACTION DELIBERATELY DOES NOT DO
 *   It does not set membership_status. The BEFORE INSERT trigger decides founder vs
 *   applicant, so there is no argument here that could arrive pre-approved.
 */

export type ValidateCodeResult =
  | { success: true; familyCode: string; familyName: string }
  | { success: false; message: string }

export type JoinFamilyResult =
  | { success: true; familyName: string }
  | { success: false; message: string }

export type CreateFamilyResult =
  | { success: true; familyCode: string; familyName: string }
  | { success: false; message: string }

/**
 * Returning a family name for any valid code is an enumeration oracle by
 * construction, and it was accepted as one: the code is meant to be shared, and the
 * payoff for walking 30^6 codes is a list of family names. What is NOT accepted is
 * doing it quickly, so the lookup is rate-limited per user.
 *
 * In-process and per-instance, which is the honest description: it is a speed bump
 * against a script, not a distributed quota. A real limit belongs at the edge, and
 * this being here does not pretend otherwise.
 */
const RATE_WINDOW_MS = 60_000
const LOOKUP_LIMIT = 10
/** Creating a family writes rows; looking a code up does not. Hence the lower bar. */
const CREATE_LIMIT = 3

const buckets = new Map<string, number[]>()

function overLimit(bucket: string, userId: string, limit: number): boolean {
  const now = Date.now()
  const key = `${bucket}:${userId}`
  const recent = (buckets.get(key) ?? []).filter(t => now - t < RATE_WINDOW_MS)
  recent.push(now)
  buckets.set(key, recent)
  // Bound the map so a long-lived instance cannot accumulate one entry per user seen.
  if (buckets.size > 5_000) {
    for (const [k, times] of buckets) {
      if (times.every(t => now - t >= RATE_WINDOW_MS)) buckets.delete(k)
    }
  }
  return recent.length > limit
}

const overLookupLimit = (userId: string) => overLimit('lookup', userId, LOOKUP_LIMIT)
const overCreateLimit = (userId: string) => overLimit('create', userId, CREATE_LIMIT)

/** Step one: does this code name a family, and which one? */
export async function validateFamilyCode(code: string): Promise<ValidateCodeResult> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { success: false, message: 'Not authenticated' }

  const normalized = (code ?? '').trim().toUpperCase()
  if (!normalized) return { success: false, message: 'Enter a family code' }

  if (overLookupLimit(user.id)) {
    return { success: false, message: 'Too many attempts. Wait a minute and try again.' }
  }

  // Checked here as well as in the RPC because this is the friendly layer: the user
  // gets "you already belong to this family" instead of being walked through a
  // confirmation that would then be refused.
  const mine = await getMyFamilies(user.id)
  const existing = mine.find(f => f.familyCode === normalized)
  if (existing) {
    return {
      success: false,
      message: existing.status === 'approved'
        ? `You already belong to ${existing.familyName}.`
        : `Your request to join ${existing.familyName} is still awaiting approval.`,
    }
  }

  const { data, error } = await supabase
    .rpc('validate_family_code', { p_code: normalized })
    .maybeSingle<{ family_code: string; family_name: string }>()

  if (error) return { success: false, message: 'Could not look up that code. Please try again.' }
  if (!data) {
    return {
      success: false,
      message: 'Family code not found. Check with your family and try again.',
    }
  }

  return { success: true, familyCode: data.family_code, familyName: data.family_name }
}

/** Step two: the user has confirmed the name. Create the pending membership. */
export async function joinFamilyByCode(code: string): Promise<JoinFamilyResult> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { success: false, message: 'Not authenticated' }

  const normalized = (code ?? '').trim().toUpperCase()
  if (!normalized) return { success: false, message: 'Enter a family code' }

  const { data, error } = await supabase
    .rpc('join_family_by_code', { p_code: normalized })
    .maybeSingle<{ ok: boolean; family_code: string | null; family_name: string | null; message: string | null }>()

  if (error) return { success: false, message: 'Could not join that family. Please try again.' }
  if (!data?.ok) {
    return { success: false, message: data?.message ?? 'Could not join that family.' }
  }

  const familyName = data.family_name ?? normalized

  // Tell the people who can act on it. Failing to notify must not fail the join —
  // the application is already recorded and the approvals page lists it regardless.
  try {
    await notifyApprovers({
      familyCode: normalized,
      type: 'membership_request',
      title: 'A new member is waiting for approval',
      body: `${user.email ?? 'Someone'} has asked to join ${familyName}.`,
      link: '/admin/users?tab=approvals',
    })
  } catch {
    // Deliberately swallowed. See above.
  }

  revalidatePath('/my-families')
  revalidatePath('/dashboard')
  return { success: true, familyName }
}

/**
 * Start a brand new family, from an account that already has one.
 *
 * The counterpart to joining, and deliberately NOT its mirror in one respect: this one
 * does not pend. The founder of a family is its first administrator by definition —
 * there is nobody else who could approve them, and a family whose only member is
 * awaiting approval can never be administered by anyone. `create_family()` relies on
 * the same stamp trigger that pends a joiner to approve a founder, so the rule lives
 * in one place and this action states no status at all.
 *
 * WHAT "USES THAT USER'S PROFILE" MEANS, MECHANICALLY
 *   Nothing here copies it. `people_inherit_shared_profile` (20260617000001) fires
 *   BEFORE INSERT on the new row and fills name, contact details, address, birthday and
 *   avatar from the caller's oldest existing membership. So the new family opens with
 *   their profile already complete, and — because that trigger is also what keeps the
 *   memberships in sync — a later edit in either family propagates to both.
 *
 * The USER client, for join_family_by_code()'s reason: every check in the RPC keys on
 * auth.uid(), and it refuses outright when there is none rather than creating a family
 * owned by nobody.
 */
export async function createFamily(familyName: string): Promise<CreateFamilyResult> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { success: false, message: 'Not authenticated' }

  const name = (familyName ?? '').trim()
  if (!name) return { success: false, message: 'Enter a family name' }
  if (name.length > 100) {
    return { success: false, message: 'That family name is too long (100 characters maximum).' }
  }

  // Creating a family writes two rows and seeds two permission templates with their
  // whole grid,
  // so it is the most expensive thing an ordinary member can ask for. Rate-limited on
  // the same in-process limiter as the code lookup — a speed bump against a script, not
  // a quota; the honest description is in the comment on that limiter.
  //
  // NOT a hard cap on families per account: a genuine organiser may well run several,
  // and picking a number for them is a product decision nobody has made.
  if (overCreateLimit(user.id)) {
    return { success: false, message: 'Too many families created just now. Wait a minute and try again.' }
  }

  const { data, error } = await supabase
    .rpc('create_family', { p_family_name: name })
    .maybeSingle<{ ok: boolean; family_code: string | null; family_name: string | null; message: string | null }>()

  if (error) return { success: false, message: 'Could not create that family. Please try again.' }
  if (!data?.ok || !data.family_code) {
    return { success: false, message: data?.message ?? 'Could not create that family.' }
  }

  // Switch to it. Creating a family and then still looking at the old one reads as the
  // action having failed — and unlike joining, there is nothing to wait for. This goes
  // through the membership-checking RPC like every other switch, so it cannot be used
  // to point at a family the caller does not belong to.
  await switchActiveFamily(data.family_code)

  revalidatePath('/my-families')
  revalidatePath('/dashboard')
  return { success: true, familyCode: data.family_code, familyName: data.family_name ?? name }
}
