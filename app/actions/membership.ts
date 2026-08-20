'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { getMyFamilies, getMyNameInFamily } from '@/lib/auth/family'
import { getMyPermissionSet } from '@/lib/auth/permissions'
import { getMyFamilyTier } from '@/lib/auth/tier'
import { notifyMembershipAppeal } from '@/lib/notifications'

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

  // ── Tell the administrators, which nothing did until 2026-08-14 ────────────────
  // This is the worst of the five silent doors in lib/notifications.ts's list, because
  // it is the only one carrying a MESSAGE. 20260811000002 states the whole rationale for
  // the feature as "the whole value to the administrator is the sentence explaining why
  // they should reconsider" — and that sentence went into a column nobody was told about.
  // The row reappears in the queue, so a family that happens to look sees it; a family
  // that does not look never learns an appeal was made.
  //
  // WHY `familyCode` IS ESTABLISHED HERE DESPITE ARRIVING FROM THE CLIENT, which
  // lib/notifications.ts's precondition otherwise forbids: appeal_membership_decision()
  // resolves the row from auth.uid() and this code TOGETHER, takes no person id, and
  // refuses any row that is not the caller's own and not 'rejected'. So `ok: true` is
  // itself the proof that the caller has a membership in this family — a code they have
  // no row in matches nothing and returns ok: false, three lines above. The normalization
  // is the RPC's too, so what is passed on is what it matched.
  const mine = (await getMyFamilies(user.id)).find(f => f.familyCode === familyCode)
  try {
    await notifyMembershipAppeal({
      familyCode,
      familyName: mine?.familyName ?? familyCode,
      applicantName: await getMyNameInFamily(user.id, familyCode),
      applicantEmail: user.email ?? null,
      note,
    })
  } catch {
    // Swallowed, like every other notification call site: the appeal is recorded and the
    // row is back in the queue whether or not the bell rang.
  }

  // The dashboard renders the waiting screen from this status, and Members & Access shows
  // the row in its queue.
  revalidatePath('/dashboard')
  revalidatePath('/admin/members')
  revalidatePath('/my-families')
  return { success: true }
}

/**
 * A cheap fingerprint of everything the signed-in SHELL is built from.
 *
 * ── THE BUG THIS EXISTS FOR ─────────────────────────────────────────────────────────
 * The rail and the top bar are rendered by app/(protected)/layout.tsx from
 * `viewableResources()`, which collapses to the three PENDING_RESOURCES for anyone not
 * yet admitted. App Router does not re-render a shared layout on a client-side
 * navigation — only the segments below it — so an applicant approved while their tab is
 * open keeps a one-item rail indefinitely. `revalidatePath` in the approver's request
 * cannot reach them: it runs in a different session and touches that session's caches.
 *
 * Nothing else in their browser asks. The pending screen has no interval and no channel,
 * and the bell — which does hold a realtime subscription — is not even rendered for them.
 * So the shell needs something that asks, and this is what it asks.
 *
 * ── WHY A FINGERPRINT AND NOT A STATUS ──────────────────────────────────────────────
 * Because `membership_status` is the wrong column to watch on its own. Four other actions
 * change what the shell may show without touching it — `applyTemplate`,
 * `setTemplatePermission`, `deleteTemplate` and `setFamilyTier`, the last because
 * `viewableResources` narrows by tier — so a template edit or a downgrade would leave a
 * rail full of destinations that now 404 or bounce to /upgrade. Comparing a string built
 * from all four inputs catches every one of them without the watcher knowing what any of
 * them mean.
 *
 * `memberships` is the whole vector rather than the active membership, and that is
 * required rather than thorough: PendingApproval renders EVERY non-approved membership
 * plus the approved ones as "your other families", so an applicant pending in two
 * families who is approved by the second must see the screen change even though the
 * family they are viewing did not move.
 *
 * ── WHAT IT IS NOT ──────────────────────────────────────────────────────────────────
 * NOT an authorization surface. It answers only "has anything about me changed", and the
 * client's only response is `router.refresh()` — which re-runs every real guard on the
 * server. Nothing here decides anything.
 *
 * TAKES NO IDENTITY PARAMETER (AGENTS.md §2b). It is a `'use server'` export and
 * therefore a public endpoint; everything below derives from the session, and
 * `getMyFamilies` scopes on `.eq('user_id', userId)`, so the only state anybody can read
 * through it is their own.
 *
 * DELIBERATELY NO `requireMember()`. Its whole purpose is to serve a caller who is not an
 * approved member yet — the same reason `appealMembershipDecision` above has no grant
 * check. Demanding one would refuse precisely the person it exists for.
 */
export interface ShellState {
  /** '' when the caller belongs to no family at all. */
  fingerprint: string
}

export async function getMyShellState(): Promise<ShellState> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { fingerprint: '' }

  const families = await getMyFamilies(user.id)
  if (!families.length) return { fingerprint: '' }

  // Sorted, so the fingerprint depends on the facts and not on the order a query
  // happened to return them in — an unstable string here would refresh the page forever.
  //
  // `familyStatus` JOINED THE VECTOR with 20260817000006, and it had to: removal changes
  // what the shell may show — the rail collapses to the personal pages and the dashboard
  // renders a notice instead of itself — while `membership_status` does not move at all.
  // Without it, an administrator removing a family would leave every other member sitting
  // in front of a full rail into it until they happened to reload, and a RESTORE would
  // change nothing for anyone with a tab open. It is folded for EVERY family rather than
  // for the active one for the same reason the memberships are: an account viewing one
  // family whose other is removed still has a switcher and a My Families page to correct.
  const memberships = families
    .map(f => `${f.familyCode}:${f.status}:${f.familyStatus}${f.isActive ? ':active' : ''}`)
    .sort()
    .join(',')

  // The active family's template and tier, which is the granularity the shell is built
  // at: `viewableResources` resolves one template and one tier, both for the family being
  // viewed. A change in another family's grants cannot alter this rail, and a change in
  // which family is active is already in `memberships` above.
  const active = families.find(f => f.isActive) ?? families[0]
  const [perms, tier] = await Promise.all([
    getMyPermissionSet(user.id),
    getMyFamilyTier(user.id),
  ])

  // The template ID is not enough on its own — editing a template in place changes what
  // it grants without changing which one it is — so the resolved grid's size and its
  // sorted contents stand in for its version. It is a string comparison either way, and
  // `resolved` is already loaded for this request.
  const grid = [...perms.resolved.entries()].map(([k, v]) => `${k}=${v}`).sort().join('|')

  return {
    fingerprint: [active.familyCode, memberships, tier, grid].join('#'),
  }
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
