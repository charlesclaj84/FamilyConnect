import { createAdminClient } from '@/lib/supabase/admin'

/**
 * Invitation redemption for server code to call — NOT a server action.
 *
 * This lives here, and not in app/actions/invitations.ts, for the same reason
 * lib/notifications.ts exists: everything exported from a `'use server'` file is a
 * public HTTP endpoint, and this function takes a USER ID. As an action, anyone signed
 * in could post someone else's user id with an invitation token and redeem it onto
 * their account. A plain module has no URL.
 *
 * The database draws the same boundary independently, and NOT with a GRANT — because
 * grants do not hold in this project. supabase/seed.sql re-issues
 * `GRANT ALL ON ALL FUNCTIONS IN SCHEMA public TO anon, authenticated, service_role`
 * after every migration, mirroring the hosted project, so every function here is
 * callable by an anonymous request whatever a migration revoked.
 *
 * `redeem_family_invitation()` therefore defends itself: it reads the role out of
 * PostgREST's verified JWT claims and honours `p_user_id` ONLY for `service_role`.
 * Every other caller redeems for `auth.uid()` and the argument is ignored. So the worst
 * case if this file were somehow reachable from a browser is that the extra argument
 * does nothing.
 */

export interface RegistrationRedemption {
  ok: boolean
  family_code: string | null
  family_name: string | null
  pre_approved: boolean
  message: string | null
}

/**
 * Accept an invitation on behalf of an account that has just been created.
 *
 * Registration is the one moment redemption cannot go through the session: with email
 * confirmation on, `signUp()` returns no session at all, so the new account cannot call
 * the authenticated RPC until it has confirmed its address and signed in. Waiting for
 * that would leave the invitation unspent and the new member in no family, staring at a
 * dashboard that tells them nothing.
 *
 * `userId` MUST be an id this process just created or otherwise established — never a
 * value from the client. registerUser is the only caller.
 */
export async function redeemInvitationForNewUser(
  token: string,
  userId: string,
): Promise<RegistrationRedemption | null> {
  const admin = createAdminClient()
  const { data } = await admin
    .rpc('redeem_family_invitation', { p_token: token, p_user_id: userId })
    .maybeSingle<RegistrationRedemption>()
  return data ?? null
}
