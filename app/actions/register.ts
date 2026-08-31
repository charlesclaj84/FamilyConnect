'use server'

import { randomInt } from 'node:crypto'
import { createClient } from '@supabase/supabase-js'
import { createAdminClient } from '@/lib/supabase/admin'
import { getFamilyStatus, isActiveFamily } from '@/lib/auth/family'
import { redeemInvitationForNewUser } from '@/lib/invitations'
import { notifyMembershipRequest } from '@/lib/notifications'
import { trackFamilyCreated, trackRegistrationCompleted } from '@/lib/meta/conversions'
import { persistAttributionForUser } from '@/lib/meta/attribution-store'
import { sellablePlanParam } from '@/lib/signup-plan'
import type { FamilyTier } from '@/lib/tiers'
import { callerI18n } from '@/lib/i18n/server'

/**
 * The event ids the BROWSER must fire with, so the Pixel event and the Conversions API
 * event Meta already received deduplicate into one conversion.
 *
 * Null for anything that was not sent — tracking off for this deployment, consent refused,
 * or an id already spent. The form fires only what it is handed, so the browser cannot
 * report a conversion the server decided against; see lib/meta/dispatch.ts.
 *
 * NOTHING SENSITIVE IS IN HERE. Both values are `<prefix>_<32 hex characters>`, derived by
 * hashing the account id or the family code — see lib/meta/event-id.ts.
 */
export interface RegisterMetaEvents {
  completeRegistration: string | null
  createFamily: string | null
}

export type RegisterResult =
  | {
      success: true
      familyCode?: string
      meta?: RegisterMetaEvents
      /**
       * The paid plan that was recorded against the new family, or null.
       *
       * REPORTED RATHER THAN ASSUMED, because it is not always what was asked for: a plan
       * that is not on sale, or a plan sent in join mode, is dropped (see below) and the
       * form must not then promise a checkout nobody will be offered. Null covers "none
       * asked for" and "asked for and not recorded" alike, which is all the caller needs —
       * either way there is nothing to say about a plan.
       */
      plan?: FamilyTier | null
    }
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
  /**
   * The paid plan picked on `/pricing` or on the form, as a raw string.
   *
   * A HINT, NOT A COMMITMENT. Nothing is charged here and no tier is granted — see the
   * intent block further down for why registration cannot take a payment and must not
   * fail over this parameter.
   */
  plan?: string
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
  // ── THE LANGUAGE, FROM THE ADDRESS BAR ─────────────────────────────────────────────
  // `callerI18n(null)`, and this is the one action in the product where that is not a
  // fallback but the ONLY possible answer: nobody has an account yet, so there is no
  // `people.locale` to prefer. `resolveLocale` reads the `/es` or `/fr` this request was
  // rewritten from and then `Accept-Language` — which is exactly why `/register` is in
  // `LOCALIZED_ROOTS`. A reader who filled the Spanish form must not be refused in English.
  const { t, locale } = await callerI18n(null)
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
        message: t('act.invitationNoLongerValidAsk'),
      }
    }
    // The invitation names an address; registering under a different one would create
    // an account the redemption below would then refuse. Say so now, against the field
    // they can actually fix.
    if (peek.email !== input.email.trim().toLowerCase()) {
      return {
        success: false,
        field: 'email',
        message: t('reg.invitationSentToAddress', { email: peek.email }),
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
        message: t('act.youAlreadyAccountAddressSign'),
      }
    }
  }

  // Held from the validation below so the approvers' notification at the bottom can name
  // the family without asking a second time — see notifyMembershipRequest.
  let joinFamilyName = ''

  if (!inviteToken && input.mode === 'join') {
    const code = input.familyCode?.trim().toUpperCase() ?? ''
    if (!code) {
      return { success: false, field: 'familyCode', message: t('act.familyCodeRequired') }
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
        message: t('act.familyCodeNotFoundCheck'),
      }
    }

    // ── THE SIXTH DOOR INTO A FAMILY, AND THE ONLY ONE WITH NO SESSION ──────────────
    // 20260817000006 closed the other four in SQL — validate_family_code,
    // join_family_by_code, peek_family_invitation and redeem_family_invitation all refuse
    // a removed family now. This one is app-layer because it is app-layer already: the
    // lookup above is a plain service-role read, made before any account exists, and there
    // is no RPC underneath it to have carried the conjunct.
    //
    // THE MESSAGE IS THE ONE A STRANGER GETS FOR A CODE THAT NEVER EXISTED, character for
    // character. Distinguishing "this family was removed" from "no such family" turns this
    // form into an oracle a guesser can walk — a family code is six characters from a
    // 30-letter alphabet and "not found" is already the answer to 729 million of them, so
    // a removed family must not be the one that answers differently. That is the rule the
    // whole of §6 of that migration follows.
    //
    // READ SEPARATELY rather than added to the select above, and this is the same choice
    // `getMyFamilies` and `getFamilySettings` make: PostgREST answers 42703 for a column
    // that is not there and kills the WHOLE query, so a `status` in that select would take
    // registration down for everybody against a database that is behind on migrations —
    // and it would fail as "Family code not found", which is unfalsifiable from the
    // outside. `getFamilyStatus` owns that error and falls back to 'active', which is not
    // leniency but the truth: a database without the column has never removed a family.
    if (!isActiveFamily(await getFamilyStatus(code))) {
      return {
        success: false,
        field: 'familyCode',
        message: t('act.familyCodeNotFoundCheck'),
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
        return { success: false, message: t('act.couldNotGenerateUniqueFamily') }
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
        // ── THE LANGUAGE, FOR THE CONFIRMATION EMAIL AND FOR NOTHING ELSE ──────────
        // `authMailLocale` reads it, and this is the one moment it can be known: a signup
        // confirmation is sent before any `people` row exists, so `people.locale` answers
        // nothing for the FIRST mail a new member ever receives. `/es/register` is a real
        // route, so `resolveLocale` above already knows what language they filled the form
        // in — carrying it here is what makes that email readable.
        //
        // A HINT WITH A SHORTER LIFE THAN THE COLUMN, not a copy of it. Nothing keeps this in
        // step with `setMyLocale`, and nothing should: once a `people` row exists it shadows
        // this for every later message. Two facts that are both maintained is the `is_minor`
        // trap; one authoritative and one one-shot is not.
        locale,
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

    // Where this account came from, in GENORRA's own records, independently of Meta. Kept
    // whether or not consent was granted, because what survives in the cookie for an
    // objecting visitor is our own UTM labelling and nothing of Meta's — see
    // lib/meta/attribution-store.ts.
    await persistAttributionForUser(authData.user.id)

    // The account exists — that is what CompleteRegistration means. No CreateFamily: an
    // invited relative JOINS a family somebody else established, which is a different and
    // considerably less valuable signal, and conflating the two would make every invited
    // cousin look like a founder to the optimiser.
    const meta = await trackRegistrationCompleted({
      userId: authData.user.id,
      holder: metaHolder(authData.user.id, input),
      route: 'invite',
    })
    return { success: true, meta: { completeRegistration: meta.eventId, createFamily: null } }
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
      return { success: false, message: t('act.failedCreateFamilyRecordPlease') }
    }
  }

  // ── THE PLAN THEY PICKED BEFORE THERE WAS ANYTHING TO CHARGE ──────────────────────
  //
  // NO MONEY MOVES HERE AND NO TIER IS GRANTED. `families.tier` keeps its default of
  // 'free' and the only writers of that column are the Stripe webhook and the term sweep
  // — a payment is a thing Stripe tells us happened, never a thing an action decides. What
  // is recorded is that somebody asked for Plus, so the first authenticated moment can
  // offer them the checkout instead of making them find the plan again.
  //
  // It cannot be a checkout at this point for two structural reasons: the Stripe Customer
  // is the FAMILY and this row is seconds old, and `enable_confirmations` is on, so nobody
  // is signed in for `startPlanCheckout`'s `requireEdit('admin/settings')` to authorize.
  //
  // ── CREATE MODE ONLY, AND NEVER FROM AN INVITATION ────────────────────────────────
  // A plan is bought by the family, so somebody JOINING one cannot choose it — their
  // family already has a plan and a `?plan=plus` on a join link would be a relative
  // committing an existing family to a bill. Guarded on `inviteToken` as well as `mode`
  // for the reason the family_name line above is: an invited registrant is never creating
  // a family whatever `mode` the client happened to send.
  //
  // ── AND IT NEVER FAILS THE REGISTRATION ───────────────────────────────────────────
  // The account is the thing being created; the plan is a preference about it. A tier we
  // do not sell, or a write that errors, leaves `signupPlan` null and the caller is told
  // as much in the result — it must not delete an account somebody has just made and an
  // email has already been sent for. That is also why this sits AFTER the family insert
  // and has no rollback of its own.
  const signupPlan = !inviteToken && input.mode === 'create'
    ? sellablePlanParam(input.plan)
    : null
  let recordedPlan: FamilyTier | null = null
  if (signupPlan && authData.user) {
    const { error: planError } = await admin.from('platform_billing_accounts').upsert({
      family_code: familyCode,
      signup_tier: signupPlan,
      signup_tier_at: new Date().toISOString(),
    }, { onConflict: 'family_code' })
    // §8: supabase-js RETURNS errors rather than throwing, so this has to be read. A
    // discarded one here would report a checkout to come that nothing would ever offer.
    if (planError) {
      console.error('[register] failed to record signup plan intent', planError)
    } else {
      recordedPlan = signupPlan
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

  // ── Advertising measurement ───────────────────────────────────────────────
  // LAST, and after every write above has committed. Both events are statements that
  // something HAS HAPPENED — an account exists, a family exists — so they are made where
  // that is established rather than where it was requested. Neither can fail this
  // function: `trackServerEvent` schedules the network call with `after()` and never
  // throws, which is the same fail-soft contract lib/email/send.ts is built on and for
  // the same reason — a measurement outage must not roll back a registration.
  //
  // `familyCode` is safe to key CreateFamily on: it is hashed into the event id and never
  // sent (lib/meta/event-id.ts).
  if (authData.user) await persistAttributionForUser(authData.user.id)

  const registration = authData.user
    ? await trackRegistrationCompleted({
        userId: authData.user.id,
        holder: metaHolder(authData.user.id, input),
        route: input.mode,
      })
    : null

  const family = input.mode === 'create' && authData.user
    ? await trackFamilyCreated({
        familyCode,
        holder: metaHolder(authData.user.id, input),
        sourcePath: '/register',
      })
    : null

  return {
    success: true,
    familyCode: input.mode === 'create' ? familyCode : undefined,
    plan: recordedPlan,
    meta: {
      completeRegistration: registration?.eventId ?? null,
      createFamily: family?.eventId ?? null,
    },
  }
}

/**
 * The permitted matching fields for the person registering, named one by one.
 *
 * Deliberately NOT a spread of `input`: that object carries a password, a family code and
 * a family name, and `MetaAccountHolder` has no field for any of them — but building it
 * by hand is what makes that a decision rather than a happy accident of the allow-list in
 * lib/meta/identity.ts catching them. The password in particular must never be within one
 * refactor of a payload bound for an ad platform.
 */
function metaHolder(userId: string, input: RegisterInput) {
  return {
    userId,
    email: input.email,
    firstName: input.firstName,
    lastName: input.lastName,
  }
}
