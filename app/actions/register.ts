'use server'

import { randomInt } from 'node:crypto'
import { createClient } from '@supabase/supabase-js'
import { createAdminClient } from '@/lib/supabase/admin'
import { redeemInvitationForNewUser } from '@/lib/invitations'
import { notifyMembershipRequest } from '@/lib/notifications'

export type RegisterResult =
  | { success: true; familyCode?: string }
  | { success: false; field?: string; message: string }

export interface RegisterInput {
  firstName: string
  lastName: string
  email: string
  password: string
  mode: 'join' | 'create'
  familyCode?: string
  familyName?: string
  /**
   * Registering from an invitation link. Mutually exclusive with the other two modes:
   * the family comes from the invitation, so the registrant supplies no family code
   * (they were never told one) and no family name.
   */
  inviteToken?: string
}

/**
 * The family code is deliberately public — it is meant to be shared so relatives
 * can join — but it is still read aloud, written down and typed, and it is the
 * string a join request is keyed on. So it has to be unguessable enough not to be
 * walked, and unambiguous enough to be dictated over a phone.
 *
 * Both of which the previous generator failed:
 *   Math.random().toString(36).substring(2, 8).toUpperCase()
 * was not cryptographically random; not length-guaranteed (Math.random() can
 * produce a short base-36 expansion — 0.5 renders as "0.i" — so substring(2, 8)
 * silently yielded fewer than six characters); and base-36 uppercased contains
 * both 0/O and 1/I.
 *
 * This alphabet drops 0, 1, I, L, O and U — the digit/letter confusions, plus U so
 * the set cannot spell anything unfortunate. 30^6 ≈ 729 million codes.
 */
const CODE_ALPHABET = '23456789ABCDEFGHJKMNPQRSTVWXYZ'
const CODE_LENGTH = 6

function generateCode(): string {
  let out = ''
  for (let i = 0; i < CODE_LENGTH; i++) {
    out += CODE_ALPHABET[randomInt(CODE_ALPHABET.length)]
  }
  return out
}

/**
 * The read-then-insert check below is a courtesy that produces a clean error
 * instead of a constraint violation; it is not the uniqueness guarantee and does
 * not close the race between the SELECT and the INSERT. That guarantee is
 * `family_code TEXT UNIQUE NOT NULL` (20260602000000_families.sql:3).
 */
async function generateUniqueFamilyCode(): Promise<string | null> {
  const admin = createAdminClient()
  for (let i = 0; i < 5; i++) {
    const code = generateCode()
    const { data } = await admin.from('families').select('id').eq('family_code', code).maybeSingle()
    if (!data) return code
  }
  return null
}

export async function registerUser(input: RegisterInput): Promise<RegisterResult> {
  const admin = createAdminClient()
  const inviteToken = input.inviteToken?.trim() || null

  // ── Registering from an invitation ────────────────────────────────────────
  // The family, and whether they skip the approval queue, both come from the
  // invitation rather than from anything the registrant typed. Checked BEFORE the
  // account is created: an invitation that turns out to be expired after signUp would
  // leave an orphan auth account belonging to no family, which is a state the app has
  // no screen for.
  if (inviteToken) {
    const { data: peek } = await admin
      .rpc('peek_family_invitation', { p_token: inviteToken })
      .maybeSingle<{
        valid: boolean; email: string; family_name: string; has_account: boolean | null
      }>()

    if (!peek?.valid) {
      return {
        success: false,
        message: 'That invitation is no longer valid. Ask for a new one.',
      }
    }
    // The invitation names an address; registering under a different one would create
    // an account the redemption below would then refuse. Say so now, against the field
    // they can actually fix.
    if (peek.email !== input.email.trim().toLowerCase()) {
      return {
        success: false,
        field: 'email',
        message: `This invitation was sent to ${peek.email}. Register with that address.`,
      }
    }
    // Registration is the wrong door for an address that can already sign in, and the
    // signUp below cannot tell them so usefully: with confirmations off it answers "User
    // already registered", and with them on it answers with a FABRICATED user rather than
    // an error, which used to be redeemed against an id in no table. Refuse here, name
    // the door that works, and let the two pages in front of this render it as a link.
    //
    // 20260810000000 added `has_account`. `=== true` so a database that predates it —
    // where the column is absent and this reads undefined — keeps the old behaviour and
    // falls through to the signUp guard below rather than refusing every registration.
    if (peek.has_account === true) {
      return {
        success: false,
        field: 'email',
        message: 'You already have an account with this address. Sign in and this invitation will be waiting for you.',
      }
    }
  }

  // Held from the validation below so the approvers' notification at the bottom can name
  // the family without asking a second time — see notifyMembershipRequest.
  let joinFamilyName = ''

  if (!inviteToken && input.mode === 'join') {
    const code = input.familyCode?.trim().toUpperCase() ?? ''
    if (!code) {
      return { success: false, field: 'familyCode', message: 'Family code is required' }
    }
    const { data } = await admin
      .from('families')
      .select('id, family_name')
      .eq('family_code', code)
      .maybeSingle()
    if (data) joinFamilyName = (data.family_name as string) ?? ''
    if (!data) {
      return {
        success: false,
        field: 'familyCode',
        message: 'Family code not found. Check with your family and try again.',
      }
    }
  }

  // An invitation carries its own family, and the registrant is never told which code
  // until they are in it — so there is nothing to resolve here and nothing from the
  // client to trust. redeemInvitationForNewUser() below returns the real one.
  let familyCode = ''
  if (!inviteToken) {
    if (input.mode === 'create') {
      const generated = await generateUniqueFamilyCode()
      if (!generated) {
        return { success: false, message: 'Could not generate a unique family code. Please try again.' }
      }
      familyCode = generated
    } else {
      familyCode = input.familyCode!.trim().toUpperCase()
    }
  }

  // Use the anon key so signUp respects the project's email-confirmation settings.
  const anon = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } },
  )

  const { data: authData, error: authError } = await anon.auth.signUp({
    email: input.email,
    password: input.password,
    options: {
      data: {
        first_name: input.firstName,
        last_name: input.lastName,
        family_code: familyCode,
        // Guarded on inviteToken as well as mode: an invited registrant is never
        // creating a family, whatever `mode` the client happened to send, and
        // `input.familyName!` would throw for them.
        family_name: !inviteToken && input.mode === 'create' ? input.familyName!.trim() : null,
        family_role: !inviteToken && input.mode === 'create' ? 'owner' : 'member',
      },
    },
  })

  if (authError) {
    return { success: false, message: authError.message }
  }

  // AN EXISTING ADDRESS DOES NOT ALWAYS COME BACK AS AN ERROR. With email confirmation
  // on, GoTrue refuses to be an account-enumeration oracle: it returns 200 with a
  // FABRICATED user — a fresh random id, and `identities: []` — for an address that is
  // already registered. Everything below then runs against a user id that exists in no
  // table: the invitation branch redeemed against it and got "sent to a different email
  // address" (auth.users had no row to compare), then deleted a user that had never been
  // created; the ordinary branch wrote a family and a people row keyed to a phantom.
  //
  // The empty array is the signal, so test for it positively. `identities === undefined`
  // is NOT this case — it is an older GoTrue that omits the field — and treating it as
  // one would refuse every legitimate registration.
  if (authData.user?.identities?.length === 0) {
    return {
      success: false,
      field: 'email',
      message: inviteToken
        ? 'You already have an account with this address. Sign in and this invitation will be waiting for you.'
        : 'An account already exists for this address. Sign in instead, or reset your password.',
    }
  }

  // ── Invitation: redeem it, and stop ───────────────────────────────────────
  // The membership is created by redeem_family_invitation(), not below — it is the one
  // place that knows whether this invitation pre-approves, and pre-approval has to be
  // applied after the stamp trigger has had its say (20260806000013 §4). So the family
  // insert and the people insert are both skipped.
  //
  // This runs through the service-role client because there is no session yet: with
  // email confirmation on, signUp() returns a user and no token at all, so the new
  // account cannot speak for itself until it has confirmed and signed in. Waiting for
  // that would leave the invitation unspent and the new member in no family.
  if (inviteToken && authData.user) {
    const redemption = await redeemInvitationForNewUser(inviteToken, authData.user.id)
    if (!redemption?.ok || !redemption.family_code) {
      // The account exists but belongs to nowhere, which no screen in the app handles.
      // Roll it back rather than leave it — the invitation was checked before signUp,
      // so getting here means it was spent or revoked in the seconds since.
      await admin.auth.admin.deleteUser(authData.user.id)
      return {
        success: false,
        message: redemption?.message ?? 'That invitation is no longer valid. Ask for a new one.',
      }
    }
    await admin.auth.admin.updateUserById(authData.user.id, {
      app_metadata: { family_code: redemption.family_code },
    })

    // An invitation that does not PRE-APPROVE puts the new account straight into the
    // approvals queue, exactly as a family code does — the fourth of the five doors in
    // lib/notifications.ts's list, and silent for the same reason the first was: the
    // notification lived at one call site instead of at the event.
    //
    // `pre_approved` is the RPC's effective answer, so a re-opened row reads false here
    // even where the invitation itself said otherwise; and the family code is the RPC's,
    // resolved from the token rather than supplied by anyone.
    if (!redemption.pre_approved) {
      try {
        await notifyMembershipRequest({
          familyCode: redemption.family_code,
          familyName: redemption.family_name ?? redemption.family_code,
          applicantName: `${input.firstName.trim()} ${input.lastName.trim()}`.trim(),
          applicantEmail: input.email.trim().toLowerCase(),
        })
      } catch {
        // Swallowed: the account exists and the invitation is spent. See below.
      }
    }
    return { success: true }
  }

  // Stamp family_code into app_metadata. Unlike user_metadata (set via signUp's
  // `data` above), app_metadata is NOT editable by end users, so it is the only
  // JWT claim safe to trust for family membership — used by the people-insert
  // RLS bootstrap and by getOrCreate profile paths before a people row exists.
  if (authData.user) {
    await admin.auth.admin.updateUserById(authData.user.id, {
      app_metadata: { family_code: familyCode },
    })
  }

  if (input.mode === 'create' && authData.user) {
    const { error: familyError } = await admin.from('families').insert({
      family_code: familyCode,
      family_name: input.familyName!.trim(),
      created_by: authData.user.id,
    })
    if (familyError) {
      // Roll back to avoid an orphaned auth account.
      await admin.auth.admin.deleteUser(authData.user.id)
      return { success: false, message: 'Failed to create family record. Please try again.' }
    }
  }

  // Seed the people table so the profile page is pre-populated.
  //
  // ALWAYS A FRESH ROW — never a claim of an existing one.
  //
  // This used to match an unlinked `people` row on primary_email in join mode and
  // move the new user_id onto it, on the theory that a relative had entered them
  // ahead of time. That was removed in Phase 3, and it was not a style question:
  //
  //   * It proved nothing WHEN IT WAS REMOVED. Email confirmation was off then
  //     (`enable_confirmations = false`), so anyone could sign up as
  //     someone-else@example.com and be handed that person's record; the family code
  //     needed to reach the form is public by design, so there was no second secret
  //     anywhere in the flow. Confirmations are on now, which retires this particular
  //     reason — a claimant does have to control the address. It does not retire the
  //     two below, which is why the block stays deleted rather than coming back.
  //   * The record it handed over is not blank. A pre-entered relative may already
  //     carry dues history, payments, relationships and photo tags — so this was an
  //     account takeover onto a row with financial state, not a convenience.
  //   * It laundered approval. An unlinked row is 'approved' (the column default is
  //     right for it — a child is a family record, not a membership), so claiming one
  //     UPDATEs rather than INSERTs and the stamp trigger of 20260806000011, which
  //     fires BEFORE INSERT, never sees it. Joining by claim came out admitted while
  //     joining normally came out pending.
  //
  // The legitimate version of this is /personal-info's link-person banner: the user
  // registers as themselves, then picks their own pre-existing record from a list,
  // having proved they are in the family. That path carries the pending status across
  // deliberately — see app/actions/link-person.ts.
  //
  // Nothing here sets membership_status. Whether this insert is the family's founder
  // or its next applicant is decided by the trigger, so `?mode=join` cannot arrive
  // pre-approved by omitting a field.
  if (authData.user) {
    // `membership_status` is read BACK rather than assumed: the stamp trigger of
    // 20260806000011 is what decides founder vs applicant, and the notification below has
    // to follow that decision rather than infer it from `mode`. A family whose first
    // member arrives through `?mode=join` — a code for a family row created by some other
    // route — comes out approved, and telling its own approvers that they are waiting for
    // themselves would be the kind of thing nobody notices for a year.
    const { data: inserted } = await admin.from('people').insert({
      user_id: authData.user.id,
      family_code: familyCode,
      first_name: input.firstName.trim(),
      last_name: input.lastName.trim(),
      primary_email: input.email.trim().toLowerCase(),
      created_by: authData.user.id,
    })
      .select('membership_status')
      .maybeSingle()
    // Non-fatal: if this fails the user can fill in their profile manually.

    // ── Tell the family somebody is waiting ──────────────────────────────────
    // THIS IS THE SECOND DOOR, and it had no bell on it. `joinFamilyByCode` — the same
    // act performed by an account that already exists — has notified the approvers since
    // it was written; registering with a code created an identical pending row and told
    // nobody, so whether a family heard about an applicant depended on which page the
    // applicant happened to start from.
    //
    // REACHABLE WITHOUT A SESSION, unlike every other caller of this module, and that is
    // why nothing about the message is chosen here: the title, the shape of the body and
    // the link are literals inside notifyMembershipRequest, and the only variables are
    // this family and the registrant's own name and address. `familyCode` is the code
    // just validated against `families` and written onto the row the trigger pended, so
    // it is established rather than merely supplied.
    //
    // The worst an abuser gets out of it is one bell entry per registration against a
    // code they already know — which is the same row the approvals queue was going to
    // show them anyway, so this adds no surface that pending row did not.
    if (inserted?.membership_status === 'pending') {
      try {
        await notifyMembershipRequest({
          familyCode,
          familyName: joinFamilyName || familyCode,
          applicantName: `${input.firstName.trim()} ${input.lastName.trim()}`.trim(),
          applicantEmail: input.email.trim().toLowerCase(),
        })
      } catch {
        // Deliberately swallowed. The account exists and the application is recorded; a
        // failure to announce it must not fail a registration the user has completed.
      }
    }
  }

  return { success: true, familyCode: input.mode === 'create' ? familyCode : undefined }
}
