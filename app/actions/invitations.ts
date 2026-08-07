'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { requireRead } from '@/lib/auth/guard'

/**
 * Invitations to join a family.
 *
 * NO EMAIL IS SENT, AND THAT IS A STATED LIMITATION RATHER THAN AN OVERSIGHT.
 * This codebase has no mail layer of its own, and `[auth.email.smtp]` is unconfigured
 * on both the local stack and the hosted project (it is a GO LIVE item in TODO.md). So
 * `inviteMember` returns the invitation TOKEN and the dialog turns it into a link for
 * the inviter to send however they like. A button that claimed to send an email which
 * silently never arrived would be worse than one that hands you something that works.
 *
 * THE TOKEN IS THE CREDENTIAL. `create_family_invitation()` returns it exactly once
 * and stores only its SHA-256, so it exists in this process, in the response, and
 * nowhere else. Treat it like a password reset link: it must not be logged, and it
 * must not be put anywhere a third party can read it back.
 *
 * WHY NOT JUST MATCH ON EMAIL. Because Phase 3 removed a feature that did exactly that
 * and it was an account-takeover vector — with confirmation off, an address is a claim,
 * not an identity. Confirmations are on locally and still off on hosted, so today, on
 * the deployed project, an email address proves nothing whatsoever. The full argument
 * is at the top of 20260806000013.
 */

export interface FamilyInvitation {
  id: string
  email: string
  preApproved: boolean
  createdAt: string
  expiresAt: string
  acceptedAt: string | null
  revokedAt: string | null
  invitedBy: string | null
}

export type InviteResult =
  | { success: true; token: string; email: string; preApproved: boolean }
  | { success: false; message: string }

export type InvitationActionResult =
  | { success: true }
  | { success: false; message: string }

/**
 * Invite someone to the family the caller is viewing.
 *
 * `preApproved` is a REQUEST, not an instruction. The RPC honours it only for a caller
 * holding admin/approvals:edit at scope 'any' and silently downgrades it otherwise, so
 * the Member Approvals version of this button skips the queue and the My Families
 * version does not — without either caller being trusted to say which they are. The
 * returned `preApproved` is what actually happened, and the dialog reports that rather
 * than what it asked for.
 *
 * The USER client, for the reason every other Phase 3 RPC gets it: the authorization is
 * derived from auth.uid(), and the service role has none.
 */
export async function inviteMember(
  email: string,
  preApproved = false,
  familyCode?: string,
): Promise<InviteResult> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { success: false, message: 'Not authenticated' }

  const normalized = (email ?? '').trim().toLowerCase()
  if (!normalized) return { success: false, message: 'Enter an email address' }

  // `familyCode` targets a family other than the one being viewed — /my-families offers
  // the button on every row. It is NOT validated here: the RPC looks for the caller's
  // own approved people row in that family and refuses when there is none, which is both
  // the membership check and the family-isolation check. Validating it here as well
  // would be a second implementation of the same rule, free to disagree with the first.
  //
  // Passing one also forfeits pre-approval unless it happens to BE the active family —
  // see 20260806000014 for why that restriction exists rather than being an oversight.
  const { data, error } = await supabase
    .rpc('create_family_invitation', {
      p_email: normalized,
      p_pre_approved: preApproved,
      p_family_code: familyCode?.trim().toUpperCase() || null,
    })
    .maybeSingle<{
      ok: boolean; token: string | null; email: string | null
      pre_approved: boolean; message: string | null
    }>()

  if (error) return { success: false, message: 'Could not create that invitation. Please try again.' }
  if (!data?.ok || !data.token) {
    return { success: false, message: data?.message ?? 'Could not create that invitation.' }
  }

  // Invitations are listed on the Pending Approval tab of Members & Access.
  revalidatePath('/admin/users')
  revalidatePath('/my-families')
  return {
    success: true,
    token: data.token,
    email: data.email ?? normalized,
    preApproved: data.pre_approved,
  }
}

/**
 * Outstanding and recent invitations for the caller's family, for Member Approvals.
 *
 * Read through the USER client on purpose — the opposite choice from getApplicants(),
 * and for a reason. Here RLS says exactly the right thing already: the policy on
 * family_invitations shows a row to whoever can view admin/approvals, or to the person
 * who sent it. Reaching for the service role would mean re-deriving that by hand for no
 * gain (AGENTS.md §3: prefer the user's client where RLS can do the work).
 */
export async function getInvitations(): Promise<FamilyInvitation[]> {
  const g = await requireRead('admin/approvals')
  if (!g.ok) return []

  const supabase = await createClient()
  const { data, error } = await supabase
    .from('family_invitations')
    .select('id, email, pre_approved, created_at, expires_at, accepted_at, revoked_at, people!family_invitations_invited_by_fkey(first_name, last_name)')
    .order('created_at', { ascending: false })
    .limit(50)

  // An empty list and a refused query mean different things and `data` cannot tell
  // them apart — AGENTS.md §8. The embed names its constraint because `people` is
  // reachable from this table by two foreign keys (invited_by and accepted_by), and an
  // ambiguous embed is PGRST201: the whole query fails and the page renders "none".
  if (error) return []

  return (data ?? []).map(row => {
    const inviter = row.people as unknown as { first_name: string; last_name: string } | null
    return {
      id: row.id as string,
      email: row.email as string,
      preApproved: row.pre_approved as boolean,
      createdAt: row.created_at as string,
      expiresAt: row.expires_at as string,
      acceptedAt: (row.accepted_at as string) ?? null,
      revokedAt: (row.revoked_at as string) ?? null,
      invitedBy: inviter ? `${inviter.first_name} ${inviter.last_name}`.trim() : null,
    }
  })
}

/** Cancel an invitation that has not been used. The sender or an approver may. */
export async function revokeInvitation(invitationId: string): Promise<InvitationActionResult> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { success: false, message: 'Not authenticated' }

  const { data, error } = await supabase
    .rpc('revoke_family_invitation', { p_id: invitationId })
    .maybeSingle<{ ok: boolean; message: string | null }>()

  if (error) return { success: false, message: 'Could not cancel that invitation.' }
  if (!data?.ok) return { success: false, message: data?.message ?? 'Not authorized' }

  revalidatePath('/admin/users')
  return { success: true }
}

/**
 * What an invitation is for, without spending it — so /invite/<token> can name the
 * family before the visitor has an account.
 *
 * Uses the ANON client deliberately: the caller may have no session, and the token is
 * the credential. The RPC returns only the family name and the address it was sent to,
 * both of which whoever holds the link already knows.
 */
export async function peekInvitation(token: string): Promise<
  { valid: true; email: string; familyName: string; preApproved: boolean } | { valid: false }
> {
  const supabase = await createClient()
  const { data } = await supabase
    .rpc('peek_family_invitation', { p_token: token })
    .maybeSingle<{ valid: boolean; email: string; family_name: string; pre_approved: boolean }>()

  if (!data?.valid) return { valid: false }
  return {
    valid: true,
    email: data.email,
    familyName: data.family_name,
    preApproved: data.pre_approved,
  }
}

export type RedeemResult =
  | { success: true; familyCode: string; familyName: string; preApproved: boolean }
  | { success: false; message: string }

/**
 * Accept an invitation as the signed-in user.
 *
 * The RPC takes no user id — it reads auth.uid() — so this cannot be aimed at another
 * account, and the invitation's address must match the caller's own.
 */
export async function redeemInvitation(token: string): Promise<RedeemResult> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { success: false, message: 'Sign in to accept this invitation.' }

  const { data, error } = await supabase
    .rpc('redeem_family_invitation', { p_token: token })
    .maybeSingle<{
      ok: boolean; family_code: string | null; family_name: string | null
      pre_approved: boolean; message: string | null
    }>()

  if (error) return { success: false, message: 'Could not accept that invitation. Please try again.' }
  if (!data?.ok || !data.family_code) {
    return { success: false, message: data?.message ?? 'That invitation is no longer valid.' }
  }

  revalidatePath('/', 'layout')
  return {
    success: true,
    familyCode: data.family_code,
    familyName: data.family_name ?? data.family_code,
    preApproved: data.pre_approved,
  }
}

// Redemption during REGISTRATION lives in lib/invitations.ts, NOT here. It has to take
// a user id (there is no session yet), and everything exported from a `'use server'`
// file is a public HTTP endpoint — so as an export of this module it would let anyone
// redeem any invitation onto any account. A plain module has no URL. Same reasoning,
// and the same shape, as lib/notifications.ts.
