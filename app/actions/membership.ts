'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'

export type ResendResult =
  | { success: true }
  | { success: false; message: string }

/**
 * Re-send the sign-up confirmation email to the signed-in user's own address.
 *
 * Takes no arguments ON PURPOSE. This is a `'use server'` export, so it is a public
 * HTTP endpoint that any signed-in user can post to; an `email` parameter would make
 * it a mail cannon aimed at any address the caller chose. The address comes from the
 * session, so the only person anyone can mail is themselves.
 *
 * This is live: `enable_confirmations = true` in supabase/config.toml, and
 * app/auth/confirm/route.ts is where the link lands. The caller
 * (PendingApprovalScreen) offers the button only when email_confirmed_at is genuinely
 * absent, so it appears for exactly the people it can help.
 *
 * WHAT IS STILL NOT CONFIGURED: [auth.email.smtp] is commented out. Locally that means
 * Mailpit catches everything (http://127.0.0.1:54324) and nothing leaves the machine.
 * On the hosted project it means Supabase's built-in sender, whose per-hour limit is
 * low enough to look like a bug during testing — a resend that "does nothing" is worth
 * checking against `[auth.rate_limit] email_sent` before assuming this is broken.
 * Whatever GoTrue says is reported verbatim rather than dressed up as success.
 */
export type AppealResult =
  | { success: true }
  | { success: false; message: string }

/**
 * Ask a family to reconsider a declined request.
 *
 * NO PERMISSION CHECK, and that is correct rather than an omission — the same category as
 * editing your own profile or submitting an RSVP. `create` and `edit` default to scope
 * 'none', so demanding a grant would mean nobody could ever appeal; and the caller is by
 * definition NOT an approved member, so `requireMember()` would refuse every one of them.
 *
 * What replaces it is ownership, enforced in the database rather than here.
 * `appeal_membership_decision()` resolves the row from `auth.uid()` and takes no person or
 * user id (AGENTS.md §2b), so the only membership this endpoint can touch is the caller's
 * own — `familyCode` chooses WHICH of their own, and a code they have no row in matches
 * nothing. It also refuses any row that is not 'rejected', which is what makes a second
 * appeal impossible until a human has declined them again.
 *
 * The USER client, necessarily: the whole authorization is auth.uid(), and the service role
 * has none.
 */
export async function appealMembershipDecision(
  familyCode: string,
  note: string,
): Promise<AppealResult> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { success: false, message: 'Not authenticated' }

  const { data, error } = await supabase
    .rpc('appeal_membership_decision', {
      p_family_code: familyCode,
      p_note: note,
    })
    .maybeSingle<{ ok: boolean; message: string | null }>()

  if (error) return { success: false, message: 'Could not send that just now. Please try again.' }
  if (!data?.ok) return { success: false, message: data?.message ?? 'Could not send that.' }

  // The dashboard renders the waiting screen from this status, and Members & Access shows
  // the row in its queue.
  revalidatePath('/dashboard')
  revalidatePath('/admin/users')
  revalidatePath('/my-families')
  return { success: true }
}

export async function resendConfirmationEmail(): Promise<ResendResult> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user?.email) return { success: false, message: 'Not authenticated' }

  if (user.email_confirmed_at) {
    return { success: false, message: 'Your email address is already confirmed.' }
  }

  const { error } = await supabase.auth.resend({ type: 'signup', email: user.email })
  if (error) return { success: false, message: error.message }
  return { success: true }
}
