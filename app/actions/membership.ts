'use server'

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
