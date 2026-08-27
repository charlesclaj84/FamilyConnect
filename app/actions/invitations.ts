'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { requireRead } from '@/lib/auth/guard'
import { getMyFamilyCode, getMyNameInFamily } from '@/lib/auth/family'
import { sendEmail, emailOrigin } from '@/lib/email/send'
import { familyInvitationEmail } from '@/lib/email/templates'
import { storedLocale } from '@/lib/i18n/locales'
import { notifyMembershipRequest } from '@/lib/notifications'
// Plain modules, never re-exported from here: one takes an email address and answers
// whether it has an account, which as an endpoint is an enumeration oracle. See the
// header of lib/auth/account-state.ts.
import { accountStateForEmail, requestConfirmationResend } from '@/lib/auth/account-state'
import { currentUser } from '@/lib/auth/current-user'

/**
 * Invitations to join a family.
 *
 * THE INVITATION IS EMAILED, since 2026-08-11. It was not, for as long as this app had
 * no mail layer and `[auth.email.smtp]` was unconfigured — the dialog returned a link
 * for the inviter to send by hand, and said so, because a button that claims to send an
 * email which silently never arrives is worse than one that hands you something that
 * works. lib/email/ removed that constraint; the hand-send path survives as the FAILURE
 * case, which is the same reasoning pointed the other way.
 *
 * THE TOKEN IS THE CREDENTIAL. `create_family_invitation()` returns it exactly once
 * and stores only its SHA-256, so it exists in this process, in the email, and
 * nowhere else. Treat it like a password reset link: it must not be logged, and it
 * must not be put anywhere a third party can read it back. It is now withheld from the
 * response entirely when the email goes out — see InviteResult.
 *
 * THE EMAIL GOES TO THE INVITED ADDRESS AND NOWHERE ELSE. Not CC'd to the inviter, not
 * batched. The address narrows who may redeem ON TOP of the secret, so a copy sent
 * anywhere else discards that second factor.
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
  /** Who the inviter said this is. Required since 20260813000002; '' on older rows. */
  firstName: string
  lastName: string
  preApproved: boolean
  createdAt: string
  expiresAt: string
  acceptedAt: string | null
  revokedAt: string | null
  invitedBy: string | null
}

/** The invitee, as the inviter names them. Both halves required. */
export interface InviteeName {
  firstName: string
  lastName: string
}

export type InviteResult =
  | { success: false; message: string }
  | {
      success: true
      email: string
      preApproved: boolean
      /** Whether the invitation email actually reached the provider. */
      emailed: boolean
      /**
       * The raw token — present ONLY when `emailed` is false.
       *
       * Withheld on the happy path deliberately. It is the credential, and the browser
       * has no use for it once the email carrying it has gone: a value that never
       * reaches the RSC payload cannot be read out of it. When delivery fails it comes
       * back so the inviter can still send the link by hand, which is the old flow kept
       * as the failure path rather than as the normal one.
       */
      token?: string
    }

/**
 * Mirrors `expires_at DEFAULT NOW() + INTERVAL '14 days'` in 20260806000013.
 *
 * Duplicated into TypeScript only to write a sentence in an email. If the migration
 * changes, this is wrong and nothing will say so — which is why the email says "expires
 * in N days" rather than printing a date it would be confidently incorrect about.
 */
const INVITATION_EXPIRY_DAYS = 14

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
  name: InviteeName,
  preApproved = false,
  familyCode?: string,
  /**
   * An existing `people` row this invitation is ABOUT, so redemption attaches the account
   * to it instead of creating a second one (20260813000004).
   *
   * The family tree is what needs it: adding a relative by invitation has to put a card on
   * the canvas immediately, so the record exists before the invitation is accepted. Without
   * this the family ends up with Ada on the tree and Ada in the directory, unrelated.
   *
   * NOT VALIDATED HERE, deliberately, and this is the same reasoning `familyCode` above
   * carries: the RPC confirms the row is in the TARGET family and still unclaimed, and
   * silently drops it otherwise. A second implementation of that rule in TypeScript would
   * be free to disagree with the first.
   */
  personId?: string,
): Promise<InviteResult> {
  const supabase = await createClient()
  const { user } = await currentUser()
  if (!user) return { success: false, message: 'Not authenticated' }

  const normalized = (email ?? '').trim().toLowerCase()
  if (!normalized) return { success: false, message: 'Enter an email address' }

  // THE NAME IS REQUIRED, since 20260813000002. Checked here for the message and again
  // in the RPC because that is where it binds: this is a `'use server'` export, so the
  // dialog is not in its request path and a POST with `{}` for the name must be refused
  // by something that is.
  const firstName = (name?.firstName ?? '').trim()
  const lastName = (name?.lastName ?? '').trim()
  if (!firstName || !lastName) {
    return { success: false, message: 'Enter the first and last name of the person you are inviting' }
  }

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
      p_first_name: firstName,
      p_last_name: lastName,
      p_pre_approved: preApproved,
      p_family_code: familyCode?.trim().toUpperCase() || null,
      p_person_id: personId?.trim() || null,
    })
    .maybeSingle<{
      ok: boolean; token: string | null; email: string | null
      pre_approved: boolean; message: string | null
    }>()

  if (error) return { success: false, message: 'Could not create that invitation. Please try again.' }
  if (!data?.ok || !data.token) {
    return { success: false, message: data?.message ?? 'Could not create that invitation.' }
  }

  const invitedEmail = data.email ?? normalized

  // Send it. The RPC returns the token exactly once and stores only its SHA-256, so this
  // is the only moment it exists in readable form anywhere.
  //
  // The lookups below use the SERVICE ROLE for a specific reason: `familyCode` may name a
  // family other than the active one (/my-families offers this on every row), and
  // auth_family_code() resolves only to the ACTIVE family — so the user client would read
  // nothing for exactly the case this feature exists to serve. The RPC has already proved
  // the caller has an approved people row in the target family, which is what earns the
  // read; the .eq('family_code', …) on both queries is what applies it (AGENTS.md §3).
  const targetFamily = familyCode?.trim().toUpperCase() || await getMyFamilyCode(user.id)
  let emailed = false

  try {
    const admin = createAdminClient()

    const { data: family } = await admin
      .from('families')
      .select('family_name')
      .eq('family_code', targetFamily ?? '')
      .maybeSingle()

    const { data: inviter } = await admin
      .from('people')
      .select('first_name, last_name, locale')
      .eq('family_code', targetFamily ?? '')
      .eq('user_id', user.id)
      .maybeSingle()

    const inviterName = inviter
      ? `${inviter.first_name ?? ''} ${inviter.last_name ?? ''}`.trim()
      : null

    const mail = familyInvitationEmail({
      origin: emailOrigin(),
      familyName: (family?.family_name as string) ?? targetFamily ?? 'your family',
      inviterName,
      // The name the inviter typed, so the message opens with "Hi Ada" rather than with
      // the address. It is a LABEL, not a claim about who holds the mailbox — the token
      // is still the credential and the address is still what narrows it.
      inviteeFirstName: firstName,
      token: data.token,
      preApproved: data.pre_approved,
      expiresInDays: INVITATION_EXPIRY_DAYS,
      // THE INVITER'S LANGUAGE, which is the one email where the reader's own is unavailable
      // rather than unused: they have no account, so there is no `people.locale` and no
      // `Accept-Language` — nobody has made a request yet. The inviter is the only evidence
      // there is, and it is decent evidence: somebody writing to a relative in Spanish is
      // usually writing to a Spanish-speaking relative. See `familyInvitationEmail`'s header.
      //
      // It comes off the row read above rather than from a parameter, deliberately. A
      // caller-chosen locale on a public HTTP endpoint would let anybody pick which language
      // a stranger's invitation arrives in (§2).
      locale: storedLocale(inviter?.locale as string | null),
    })

    const result = await sendEmail({
      to: invitedEmail,
      subject: mail.subject,
      html: mail.html,
      tag: mail.tag,
    })
    emailed = result.sent
  } catch {
    // sendEmail() does not throw, so this is a failed lookup. The invitation is already
    // minted and valid; falling through with emailed=false hands the link back instead.
    emailed = false
  }

  // Invitations are listed on the Pending Approval tab of Members & Access.
  revalidatePath('/admin/members')
  revalidatePath('/my-families')
  return {
    success: true,
    email: invitedEmail,
    preApproved: data.pre_approved,
    emailed,
    // See the type: the credential goes to the browser only when the email did not.
    ...(emailed ? {} : { token: data.token }),
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
  const g = await requireRead('admin/members/approvals')
  if (!g.ok) return []

  const supabase = await createClient()
  // The invitation's OWN first_name/last_name are aliased, because the embed brings a
  // second pair with the same names — the INVITER's. Without the aliases the row would
  // carry whichever PostgREST serialized last, and the queue would print the sender's
  // name where the invitee's belongs.
  const { data, error } = await supabase
    .from('family_invitations')
    .select('id, email, invitee_first:first_name, invitee_last:last_name, pre_approved, created_at, expires_at, accepted_at, revoked_at, people!family_invitations_invited_by_fkey(first_name, last_name)')
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
      firstName: (row.invitee_first as string) ?? '',
      lastName: (row.invitee_last as string) ?? '',
      preApproved: row.pre_approved as boolean,
      createdAt: row.created_at as string,
      expiresAt: row.expires_at as string,
      acceptedAt: (row.accepted_at as string) ?? null,
      revokedAt: (row.revoked_at as string) ?? null,
      invitedBy: inviter ? `${inviter.first_name} ${inviter.last_name}`.trim() : null,
    }
  })
}

/** What resending decided to do, so the UI can say it rather than guess. */
export type ResendResult =
  | { success: false; message: string }
  | {
      success: true
      email: string
      /** The invitation email reached Resend. */
      emailed: boolean
      /** A sign-up confirmation was also requested, because the account needs one. */
      confirmationRequested: boolean
      /**
       * The recipient's account, as GoTrue reports it. 'unknown' means the lookup failed
       * and is NOT the same as 'none' — the UI must not advise on a guess.
       */
      account: 'none' | 'unconfirmed' | 'confirmed' | 'unknown'
      /** The raw token, present ONLY when the invitation email did not go. Same rule as InviteResult. */
      token?: string
    }

/**
 * Send an invitation again.
 *
 * A RESEND IS A NEW INVITATION, and it cannot be anything else: the token is returned by
 * `create_family_invitation` exactly once and stored only as a SHA-256, so there is no
 * "the same link" to send twice. This delegates to `inviteMember`, whose RPC revokes any
 * open invitation for that address before minting the next one — so the old link stops
 * working the moment a new one is sent. That is the right behaviour for a credential
 * anyway: resending rotates it.
 *
 * WHY IT ALSO LOOKS AT THE ACCOUNT. Resending the invitation is frequently NOT the thing
 * that unblocks the invitee, and the case that taught us is the ordinary one: they
 * registered, never clicked the confirmation email, and therefore cannot sign in at all.
 * The invitation link then correctly sends them to sign-in (peek reports `has_account`),
 * sign-in correctly refuses an unconfirmed address, and a fresh invitation changes nothing
 * — the administrator resends three times and the invitee stays stuck. So this reads the
 * account state and, for an unconfirmed one, asks GoTrue to resend the confirmation too.
 *
 * WHO MAY. There is no `can*()` call here on purpose: the invitation is READ THROUGH THE
 * USER CLIENT, and the policy on `family_invitations` shows a row to whoever can view
 * admin/approvals in that family or to the person who sent it. A caller who is entitled to
 * neither reads no row and therefore cannot name an address to mail — which is the check,
 * expressed once, in the same place `revokeInvitation` expresses it. `inviteMember` then
 * re-derives the caller's right to invite into that family independently.
 *
 * That ordering matters: the email address handed to the mail layer comes from a row RLS
 * released, never from the caller. Otherwise this would be the open relay AGENTS.md warns
 * about, wearing an invitation id as a disguise.
 */
export async function resendInvitation(invitationId: string): Promise<ResendResult> {
  const supabase = await createClient()
  const { user } = await currentUser()
  if (!user) return { success: false, message: 'Not authenticated' }

  const { data: invitation, error } = await supabase
    .from('family_invitations')
    .select('id, email, first_name, last_name, family_code, pre_approved, accepted_at, revoked_at, expires_at')
    .eq('id', invitationId)
    .maybeSingle()

  // A refused query and a missing row are different things and `data` cannot tell them
  // apart — AGENTS.md §8. Both end here, but the error must not be discarded silently.
  if (error) return { success: false, message: 'Could not resend that invitation.' }
  if (!invitation) return { success: false, message: 'Invitation not found' }

  // Deliberately specific, unlike the redemption messages. The person reading this is an
  // administrator looking at their own family's list, so "which of these three happened"
  // is information they already hold and can act on — the reticence that governs
  // redeem_family_invitation is about a stranger holding a token, not about this screen.
  if (invitation.accepted_at) {
    return { success: false, message: 'That invitation has already been accepted.' }
  }
  if (invitation.revoked_at) {
    return { success: false, message: 'That invitation was cancelled. Send a new one instead.' }
  }
  // EXPIRY IS NOT CHECKED, deliberately. Resending is precisely the remedy for a lapsed
  // invitation, and the replacement carries a fresh 14 days — refusing here would leave an
  // administrator with a dead row and no button that does anything to it. Accepted and
  // revoked are different: those rows are finished, and re-minting from them would quietly
  // resurrect a decision somebody made.
  const email = invitation.email as string

  // Before re-minting, so that a failure here cannot leave the caller told nothing about
  // an account that needs confirming.
  const state = await accountStateForEmail(email)

  // THE NAME COMES FROM THE ROW, never from the caller. A resend is a re-mint, so the new
  // invitation has to carry the name the old one did — and taking it as a parameter would
  // let anyone who can see an invitation rewrite the label an administrator reads in the
  // approvals queue.
  const firstName = ((invitation.first_name as string) ?? '').trim()
  const lastName = ((invitation.last_name as string) ?? '').trim()

  // A ROW FROM BEFORE 20260813000002 HAS NO NAME, and the RPC refuses to mint one without
  // it. Refusing is right — a nameless invitation is the thing that change exists to stop
  // — but the RPC's message is "Enter the first and last name…", and Resend is a button
  // with no fields. So the message is replaced with one that names an action the reader
  // can actually take. This population is transient: invitations expire in 14 days.
  if (!firstName || !lastName) {
    return {
      success: false,
      message: 'This invitation was created before we started recording names. '
        + 'Cancel it and send a new one instead.',
    }
  }

  const sent = await inviteMember(
    email,
    { firstName, lastName },
    Boolean(invitation.pre_approved),
    invitation.family_code as string,
  )
  if (!sent.success) return { success: false, message: sent.message }

  // ONLY for an account that exists and has not confirmed. Asking for any other state
  // would either do nothing (no account, or already confirmed) or send somebody a
  // confirmation they do not need, and in both cases the UI would be reporting a send
  // that GoTrue's uniform 200 cannot substantiate.
  const needsConfirmation = state?.exists === true && state.confirmed === false
  const confirmationRequested = needsConfirmation
    ? await requestConfirmationResend(email)
    : false

  revalidatePath('/admin/members')
  revalidatePath('/my-families')

  return {
    success: true,
    email: sent.email,
    emailed: sent.emailed,
    confirmationRequested,
    account: state === null
      ? 'unknown'
      : !state.exists ? 'none' : state.confirmed ? 'confirmed' : 'unconfirmed',
    ...(sent.token ? { token: sent.token } : {}),
  }
}

/** Cancel an invitation that has not been used. The sender or an approver may. */
export async function revokeInvitation(invitationId: string): Promise<InvitationActionResult> {
  const supabase = await createClient()
  const { user } = await currentUser()
  if (!user) return { success: false, message: 'Not authenticated' }

  const { data, error } = await supabase
    .rpc('revoke_family_invitation', { p_id: invitationId })
    .maybeSingle<{ ok: boolean; message: string | null }>()

  if (error) return { success: false, message: 'Could not cancel that invitation.' }
  if (!data?.ok) return { success: false, message: data?.message ?? 'Not authorized' }

  revalidatePath('/admin/members')
  return { success: true }
}

/**
 * What an invitation is for, without spending it — so /invite/<token> can name the
 * family before the visitor has an account.
 *
 * Uses the ANON client deliberately: the caller may have no session, and the token is
 * the credential. The RPC returns only the family name, the address it was sent to, and
 * whether that address can already sign in — the first two are already known to whoever
 * holds the link, and the third is what decides which of the two doors this page should
 * point at. See 20260810000000 for why that bit is safe behind a token and would not be
 * behind an email parameter.
 */
export async function peekInvitation(token: string): Promise<
  | {
      valid: true; email: string; familyName: string; preApproved: boolean
      hasAccount: boolean; firstName: string; lastName: string
    }
  | { valid: false }
> {
  const supabase = await createClient()
  const { data } = await supabase
    .rpc('peek_family_invitation', { p_token: token })
    .maybeSingle<{
      valid: boolean; email: string; family_name: string
      pre_approved: boolean; has_account: boolean | null
      first_name: string | null; last_name: string | null
    }>()

  if (!data?.valid) return { valid: false }
  return {
    valid: true,
    email: data.email,
    familyName: data.family_name,
    preApproved: data.pre_approved,
    // Defaults to '' against a database without 20260813000002, where these columns are
    // absent and read undefined — the same shape as `has_account` below. Registration
    // prefills from them and a blank prefill is simply an empty field, so there is
    // nothing to fail closed about.
    firstName: data.first_name ?? '',
    lastName: data.last_name ?? '',
    // Defaults to "no account" against a database that has not had 20260810000000
    // applied, where the column is absent and this reads undefined. That keeps the
    // pre-migration behaviour — offer registration — rather than sending everyone to a
    // sign-in page for an account they may not have.
    hasAccount: data.has_account === true,
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
  const { user } = await currentUser()
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

  // ── An invitation that does NOT pre-approve lands in the approvals queue ──────
  // ...and told nobody it had, until 2026-08-14. `pre_approved` comes back as the
  // EFFECTIVE value — 20260811000001 returns `v_inv.pre_approved AND NOT v_reopen`, so a
  // re-invited applicant whose row was re-opened reads false here even though the
  // invitation itself said otherwise — which makes `!data.pre_approved` exactly the test
  // for "this person is now waiting on somebody".
  //
  // The family code is the RPC's own answer, not the caller's: it resolved the invitation
  // from the token and returns the family it belongs to, so it is established rather than
  // supplied (lib/notifications.ts's precondition).
  if (!data.pre_approved) {
    try {
      await notifyMembershipRequest({
        familyCode: data.family_code,
        familyName: data.family_name ?? data.family_code,
        applicantName: await getMyNameInFamily(user.id, data.family_code),
        applicantEmail: user.email ?? null,
      })
    } catch {
      // Swallowed like every other call site: the membership is created either way, and
      // an unsent bell entry must not read back as a failed redemption.
    }
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
