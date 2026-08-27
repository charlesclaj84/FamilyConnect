'use server'

import { createHash, randomInt } from 'node:crypto'
import { revalidatePath } from 'next/cache'
import { createAdminClient } from '@/lib/supabase/admin'
import { requireMember } from '@/lib/auth/guard'
import { sendSms, smsConfigured } from '@/lib/sms/send'
import {
  consentStatus, lastFour, smsBlockReason, toE164,
  type ConsentRecord, type SmsBlockReason, type SmsConsentStatus,
} from '@/lib/sms/consent'
import type { T } from '@/lib/i18n/t'

/**
 * A member's own text-message settings — their number, and whether we may use it.
 *
 * ── EVERY ACTION HERE IS SELF-SERVICE, AND THERE IS NO GRANT ANYWHERE IN THIS FILE ─
 * AGENTS.md §2's "Self-service actions check ownership, not a grant". `requireMember()` and the
 * caller's own `people.id`, on every one of them — and unlike most self-service actions there is
 * not even a row-ownership question to get wrong, because **no action here takes a `personId`.**
 * The subject is always the caller, resolved from the guard.
 *
 * That is deliberate and it is the security design rather than a simplification. Consent is the
 * one thing in this product that must not be delegable: an administrator who could grant SMS
 * consent on somebody's behalf would be manufacturing the exact record that would be produced
 * in answer to a TCPA complaint. `20260823000002` makes the same decision in SQL — no
 * `permission_resources` row, no `permission_table_map` row, and self-scoped SELECT policies —
 * and its header argues it.
 *
 * ── WHY THIS IS BUILT BEFORE ANY PROVIDER ─────────────────────────────────────────
 * `/community/safety-check-ins` is Premium because the ask is meant to arrive as a text. Nothing
 * sends yet: `lib/sms/send.ts` has no provider, and FutureFeature.md §5 records why that is not
 * a config value — **US carriers will not deliver application-to-person SMS until a brand and
 * campaign are registered**, which is an onboarding process rather than a credential.
 *
 * So this half is built first, because it is what the other half will ask, and because it is the
 * half that is fully testable today. What it does NOT do is pretend: `smsConfigured()` is read
 * and reported, so a member is told text messages are not switched on rather than being offered
 * a code that cannot arrive.
 *
 * ── AND NOTHING HERE IS TIER-GATED ────────────────────────────────────────────────
 * Managing your own consent is not a paid capability, and a family that lapses from Premium must
 * not lose the ability to withdraw it — which would be the product holding somebody's consent
 * hostage to a billing state. The tier gates the CHECK-IN SCREEN, not this.
 */

// ── The challenge's contract, in one place ────────────────────────────────────────────

/**
 * Ten minutes and five attempts.
 *
 * SHORTER THAN `family_action_challenges`' fifteen, deliberately: that code is emailed and read
 * in a mail client, which is a slower loop than a text arriving on the phone in your hand. The
 * attempt cap matches, because `consume_phone_verification` holds the same constant and the two
 * must not disagree about the countdown it returns.
 */
const CODE_TTL_MINUTES = 10

/**
 * A six-digit code, from `randomInt` rather than `Math.random`.
 *
 * `randomInt` is CSPRNG-backed and range-unbiased. `Math.random()` is neither, and a predictable
 * verification code is a way to confirm a number you do not own — which would put a stranger's
 * phone into a family's textable list with a consent record attached to it.
 */
function mintCode(): string {
  return String(randomInt(0, 1_000_000)).padStart(6, '0')
}

/** SHA-256 hex. The plaintext is never stored — `family_invitations.token_hash`'s rule. */
function hashCode(code: string): string {
  return createHash('sha256').update(code).digest('hex')
}

// ── Shapes ────────────────────────────────────────────────────────────────────────────

export interface MySmsSettings {
  /** Is there a provider at all? The screen says so rather than offering a dead control. */
  smsAvailable: boolean
  /** Last four digits only — never the whole number back to the browser. See below. */
  numberEnding: string | null
  /** True where a number is on file. Distinct from `verified`. */
  hasNumber: boolean
  verified: boolean
  status: SmsConsentStatus
  /** Why we would not text them, or null. `SMS_BLOCK_TEXT` has the wording. */
  blockedBecause: SmsBlockReason | null
  /** True while an unspent, unexpired code is outstanding for the number on file. */
  codeOutstanding: boolean
  /** When consent was last granted, for the record the screen shows back. */
  grantedAt: string | null
}

export interface ActionResult {
  success: boolean
  message?: string
}

// ── Reading ───────────────────────────────────────────────────────────────────────────

/**
 * The caller's own settings.
 *
 * ── THE NUMBER DOES NOT COME BACK, ONLY ITS LAST FOUR DIGITS ───────────────────────
 * §5 in spirit: the browser gets what the screen needs and no more. A confirmed mobile number is
 * the kind of thing a screenshot leaks and a shared laptop shows, and "ending 0134" is enough
 * for somebody to recognise their own. The member typed it; they do not need it read back.
 *
 * THE READ IS THE ADMIN CLIENT even though the policies would allow the user client, and the
 * reason is `codeOutstanding`: `phone_verifications` has NO SELECT POLICY AT ALL (a table of
 * code hashes should be unreadable from the browser), so that one fact is only reachable this
 * way. Rather than split one screen's state across two clients, all three reads are here with
 * `.eq('family_code', …)` and `.eq('person_id', …)` by hand (§3).
 */
export async function getMySmsSettings(): Promise<MySmsSettings> {
  const available = smsConfigured()
  const empty: MySmsSettings = {
    smsAvailable: available,
    numberEnding: null,
    hasNumber: false,
    verified: false,
    status: 'none',
    blockedBecause: 'no_number',
    codeOutstanding: false,
    grantedAt: null,
  }

  const g = await requireMember()
  if (!g.ok || !g.personId) return empty

  const admin = createAdminClient()
  const [smsRes, eventsRes, pendingRes] = await Promise.all([
    admin.from('person_sms').select('phone_e164, verified_at')
      .eq('family_code', g.familyCode).eq('person_id', g.personId).maybeSingle(),
    admin.from('sms_consent_events').select('id, event, occurred_at')
      .eq('family_code', g.familyCode).eq('person_id', g.personId),
    admin.from('phone_verifications').select('id, expires_at')
      .eq('family_code', g.familyCode).eq('person_id', g.personId)
      .is('consumed_at', null).gt('expires_at', new Date().toISOString()),
  ])

  // §8. A REFUSED READ MUST NOT LOOK LIKE "NO CONSENT ON FILE". On this screen that would be a
  // member being told they have not agreed to something they have — so nothing is guessed and
  // the conservative shape is returned, which withholds sending rather than permitting it.
  if (smsRes.error || eventsRes.error) {
    console.error(
      `[sms-consent] settings read failed for ${g.personId}: `
      + `${smsRes.error?.message ?? eventsRes.error?.message}`,
    )
    return empty
  }

  const row = smsRes.data as { phone_e164: string | null; verified_at: string | null } | null
  const records = ((eventsRes.data ?? []) as {
    id: string; event: string; occurred_at: string
  }[]).map(r => ({
    id: r.id,
    event: r.event as ConsentRecord['event'],
    occurredAt: r.occurred_at,
  }))

  const status = consentStatus(records)
  const phoneE164 = row?.phone_e164 ?? null
  const verifiedAt = row?.verified_at ?? null

  const granted = records
    .filter(r => r.event === 'granted')
    .sort((a, b) => b.occurredAt.localeCompare(a.occurredAt))[0]

  return {
    smsAvailable: available,
    numberEnding: lastFour(phoneE164),
    hasNumber: Boolean(phoneE164),
    verified: Boolean(verifiedAt),
    status,
    blockedBecause: smsBlockReason({ status, phoneE164, phoneVerifiedAt: verifiedAt }),
    // `pendingRes.error` is folded into "no code outstanding" rather than refusing the whole
    // read: the worst it costs is an offered "resend", which is harmless, where refusing the
    // screen over it would hide the member's consent state too.
    codeOutstanding: !pendingRes.error && (pendingRes.data ?? []).length > 0,
    grantedAt: status === 'granted' ? (granted?.occurredAt ?? null) : null,
  }
}

// ── The number ────────────────────────────────────────────────────────────────────────

/**
 * Record a mobile number and send a code to it.
 *
 * ── SETTING A NUMBER ALWAYS CLEARS THE CONFIRMATION ────────────────────────────────
 * Explicitly, in the same statement, rather than relying on the table's CHECK. A member who
 * changes their number has changed which handset we would text, and carrying `verified_at` across
 * would mean a number nobody ever proved inherits a confirmation that belonged to a different
 * one. That is the single most likely way this feature would text a stranger.
 *
 * ── `toE164` REFUSES, AND SO DOES THIS ─────────────────────────────────────────────
 * `normalizePhone` in `lib/profile-columns.ts` deliberately passes through what it cannot parse,
 * and its header explains why that is right for a directory. This is the other case, argued in
 * `lib/sms/consent.ts`: a sending number that is not quite a number is a text message to
 * somebody else, so an unparseable one is refused at the field.
 *
 * ── IT DOES NOT GRANT CONSENT ──────────────────────────────────────────────────────
 * Confirming a number and agreeing to be texted are two acts and stay two. A flow that took a
 * number and inferred permission from the fact somebody typed it is the shape a TCPA complaint
 * is about — and a member may legitimately want their number confirmed for an account-recovery
 * purpose later while wanting no check-in texts.
 */
export async function setMyMobileNumber(input: { phone: string }): Promise<ActionResult> {
  const g = await requireMember()
  if (!g.ok) return { success: false, message: g.message }
  const { t } = g
  if (!g.personId) return { success: false, message: t('act.profileNotFound') }

  const e164 = toE164(input?.phone ?? '')
  if (!e164) {
    return {
      success: false,
      message: t('act.doesNotLookLikeMobile'),
    }
  }

  const admin = createAdminClient()

  // A STOPPED PERSON GETS NO CODE. They have told the carrier to stop, and a verification text
  // is still a text — this is the one refusal in the file that is about the LAW rather than
  // about the data being wrong.
  const status = await currentStatus(admin, g.familyCode, g.personId)
  if (status === 'stopped') {
    return { success: false, message: STOPPED_MESSAGE }
  }

  const { error: upsertError } = await admin
    .from('person_sms')
    .upsert(
      {
        family_code: g.familyCode,
        person_id: g.personId,
        phone_e164: e164,
        // CLEARED, ALWAYS. See the header.
        verified_at: null,
      },
      { onConflict: 'person_id' },
    )
  if (upsertError) {
    console.error(`[sms-consent] number write failed for ${g.personId}: ${upsertError.message}`)
    return { success: false, message: t('act.couldNotSaveNumber') }
  }

  const sent = await issueCode(admin, g.familyCode, g.personId, e164, t)
  revalidatePath('/personal-info')
  return sent
}

/** Send (or re-send) a code to the number already on file. */
export async function resendMyPhoneCode(): Promise<ActionResult> {
  const g = await requireMember()
  if (!g.ok) return { success: false, message: g.message }
  const { t } = g
  if (!g.personId) return { success: false, message: t('act.profileNotFound') }

  const admin = createAdminClient()
  const { data, error } = await admin.from('person_sms')
    .select('phone_e164, verified_at')
    .eq('family_code', g.familyCode).eq('person_id', g.personId).maybeSingle()
  if (error) {
    console.error(`[sms-consent] resend read failed for ${g.personId}: ${error.message}`)
    return { success: false, message: t('act.couldNotSendCodeJust') }
  }
  const row = data as { phone_e164: string | null; verified_at: string | null } | null
  if (!row?.phone_e164) return { success: false, message: t('act.addMobileNumberFirst') }
  if (row.verified_at) return { success: false, message: t('act.numberAlreadyConfirmed') }

  if (await currentStatus(admin, g.familyCode, g.personId) === 'stopped') {
    return { success: false, message: STOPPED_MESSAGE }
  }

  const result = await issueCode(admin, g.familyCode, g.personId, row.phone_e164, t)
  revalidatePath('/personal-info')
  return result
}

const STOPPED_MESSAGE =
  'You replied STOP to one of our text messages, so we cannot text this number again — '
  + 'including to send a code. Text START to the number that messaged you if you want them back. '
  + 'We cannot switch it back on from here.'

/** The caller's current consent status, folded from the log. */
async function currentStatus(
  admin: ReturnType<typeof createAdminClient>,
  familyCode: string,
  personId: string,
): Promise<SmsConsentStatus> {
  const { data, error } = await admin.from('sms_consent_events')
    .select('id, event, occurred_at')
    .eq('family_code', familyCode).eq('person_id', personId)
  if (error) {
    // §8, AND THE CONSERVATIVE DIRECTION IS `stopped`. A read that failed must not be reported as
    // "no objection on file" — this answer is consulted before sending, so the safe fallback is
    // the one that refuses. It costs a member one retry; the other way round costs a text to
    // somebody who said no.
    console.error(`[sms-consent] status read failed for ${personId}: ${error.message}`)
    return 'stopped'
  }
  return consentStatus(((data ?? []) as { id: string; event: string; occurred_at: string }[])
    .map(r => ({
      id: r.id,
      event: r.event as ConsentRecord['event'],
      occurredAt: r.occurred_at,
    })))
}

/**
 * Mint a challenge and try to deliver it.
 *
 * THE ROW IS WRITTEN BEFORE THE SEND, and the order matters: a code that went out with no row
 * behind it can never be confirmed, whereas a row whose send failed is a wasted row and nothing
 * worse. `submitGatheringTask` makes the same argument about which of two writes goes first.
 *
 * AND THE FAILURE IS REPORTED HONESTLY. `sendSms` fails soft — today it always fails, because
 * there is no provider — so this must not return success. The member is told text messages are
 * not switched on yet, which is true, rather than being left waiting for a code.
 */
async function issueCode(
  admin: ReturnType<typeof createAdminClient>,
  familyCode: string,
  personId: string,
  phoneE164: string,
  /** The caller's language, for the one refusal below. `t` last, per the other helpers. */
  t: T,
): Promise<ActionResult> {
  const code = mintCode()
  const expiresAt = new Date(Date.now() + CODE_TTL_MINUTES * 60_000).toISOString()

  const { error } = await admin.from('phone_verifications').insert({
    family_code: familyCode,
    person_id: personId,
    phone_e164: phoneE164,
    code_hash: hashCode(code),
    expires_at: expiresAt,
  })
  if (error) {
    console.error(`[sms-consent] challenge insert failed for ${personId}: ${error.message}`)
    return { success: false, message: t('act.couldNotSendCodeJust') }
  }

  const result = await sendSms({
    to: phoneE164,
    body: `Your GENORRA confirmation code is ${code}. It expires in ${CODE_TTL_MINUTES} minutes.`,
    tag: 'phone-verification',
  })

  if (!result.sent) {
    // NOT A LIE, AND NOT AN APOLOGY FOR A BUG EITHER. Text messages genuinely are not switched on
    // yet, and the member's NUMBER has been saved — so the sentence says both, and does not
    // invite them to keep pressing a button that cannot work.
    return {
      success: false,
      message: smsConfigured()
        ? 'We could not send the code just now. Try again in a moment.'
        : 'Your number is saved. Text messages are not switched on yet, so there is no code to '
          + 'send — we will confirm the number as soon as they are.',
    }
  }

  return { success: true, message: `Code sent to the number ending ${lastFour(phoneE164)}.` }
}

/**
 * Confirm the number with the code.
 *
 * THE JUDGEMENT IS IN SQL. `consume_phone_verification` does the whole five-branch
 * read-modify-write under `FOR UPDATE`, for `consume_family_action_challenge`'s reason: from the
 * app it races itself, and what a race produces here is an attempt counter that under-counts —
 * which is the cap that makes six digits safe at all.
 *
 * IT MATCHES ON THE NUMBER TOO, so a member who edits the box while a code is in flight cannot
 * confirm the new number with the old code.
 */
export async function confirmMyMobileNumber(input: { code: string }): Promise<ActionResult> {
  const g = await requireMember()
  if (!g.ok) return { success: false, message: g.message }
  const { t } = g
  if (!g.personId) return { success: false, message: t('act.profileNotFound') }

  const code = (input?.code ?? '').replace(/\D/g, '')
  if (code.length !== 6) {
    return { success: false, message: t('act.enterSixDigitsFromText') }
  }

  const admin = createAdminClient()
  const { data: smsRow, error: readError } = await admin.from('person_sms')
    .select('phone_e164')
    .eq('family_code', g.familyCode).eq('person_id', g.personId).maybeSingle()
  if (readError) {
    console.error(`[sms-consent] confirm read failed for ${g.personId}: ${readError.message}`)
    return { success: false, message: t('act.couldNotConfirmNumber') }
  }
  const phoneE164 = (smsRow as { phone_e164: string | null } | null)?.phone_e164
  if (!phoneE164) return { success: false, message: t('act.addMobileNumberFirst') }

  const { data, error } = await admin.rpc('consume_phone_verification', {
    p_family_code: g.familyCode,
    p_person_id: g.personId,
    p_phone_e164: phoneE164,
    p_code_hash: hashCode(code),
  })
  if (error) {
    console.error(`[sms-consent] consume failed for ${g.personId}: ${error.message}`)
    return { success: false, message: t('act.couldNotConfirmNumber') }
  }

  const verdict = ((data ?? []) as {
    ok: boolean; message: string; attempts_left: number
  }[])[0]
  if (!verdict?.ok) {
    // THE FUNCTION'S OWN WORDING IS PASSED THROUGH, because it is the thing that knows which of
    // the five refusals happened and how many attempts are left. Rewriting it here would be a
    // second copy of a five-branch message.
    return { success: false, message: verdict?.message ?? 'That code is not right' }
  }

  const { data: written, error: writeError } = await admin.from('person_sms')
    .update({ verified_at: new Date().toISOString() })
    .eq('family_code', g.familyCode)
    .eq('person_id', g.personId)
    .eq('phone_e164', phoneE164)         // The number that was actually confirmed, not whatever is there now.
    .select('id')
  if (writeError) {
    console.error(`[sms-consent] verify write failed for ${g.personId}: ${writeError.message}`)
    return { success: false, message: t('act.couldNotConfirmNumber') }
  }
  // §8b: a write that matched nothing is a FAILED write. The code has been spent by now, so
  // saying "confirmed" over an unchanged row would leave a member believing a number is usable
  // and needing a fresh code to find out otherwise.
  if ((written ?? []).length === 0) {
    return {
      success: false,
      message: t('act.numberChangedWhileCodeFlight'),
    }
  }

  revalidatePath('/personal-info')
  return { success: true, message: t('act.numberConfirmed') }
}

/** Remove the number entirely. Consent history is untouched — it is a record, not a setting. */
export async function removeMyMobileNumber(): Promise<ActionResult> {
  const g = await requireMember()
  if (!g.ok) return { success: false, message: g.message }
  const { t } = g
  if (!g.personId) return { success: false, message: t('act.profileNotFound') }

  const { error } = await createAdminClient().from('person_sms')
    .update({ phone_e164: null, verified_at: null })
    .eq('family_code', g.familyCode)
    .eq('person_id', g.personId)
  if (error) {
    console.error(`[sms-consent] number removal failed for ${g.personId}: ${error.message}`)
    return { success: false, message: t('act.couldNotRemoveNumber') }
  }

  // NO `confirmWrite` AND NO ZERO-ROW REFUSAL HERE, deliberately: a member with no row at all is
  // asking for a state they are already in, and telling them it failed would be wrong. Removal is
  // idempotent by nature, which is the one shape §8b's rule does not apply to.
  revalidatePath('/personal-info')
  return { success: true, message: t('act.mobileNumberRemoved') }
}

// ── Consent ───────────────────────────────────────────────────────────────────────────

/**
 * Agree to be texted.
 *
 * ── IT REFUSES A STOPPED PERSON, AND THAT IS THE MOST IMPORTANT LINE IN THIS FILE ──
 * A carrier-level opt-out is revoked by the handset, never by a checkbox on a website. So a
 * member who has texted STOP cannot grant consent here, and the message tells them the only
 * thing that will work.
 *
 * TWO LAYERS, because the writer is the thing most likely to be wrong: this refuses, AND
 * `consentStatus()` ignores a `granted` event that lands after a `stop_received` one. If a future
 * admin tool, bulk import or migration writes such a row, the fold still answers `stopped`.
 *
 * ── THE ROW IS AN EVENT, NOT A SETTING ─────────────────────────────────────────────
 * An INSERT into an append-only log, never an UPDATE of a flag — `20260823000002` has a trigger
 * refusing UPDATE for every role including `service_role`. What is being recorded is that this
 * person agreed, at this time, from this screen; a boolean could not answer any of that.
 */
export async function grantSmsConsent(): Promise<ActionResult> {
  const g = await requireMember()
  if (!g.ok) return { success: false, message: g.message }
  const { t } = g
  if (!g.personId) return { success: false, message: t('act.profileNotFound') }

  const admin = createAdminClient()
  if (await currentStatus(admin, g.familyCode, g.personId) === 'stopped') {
    return { success: false, message: STOPPED_MESSAGE }
  }

  const { error } = await admin.from('sms_consent_events').insert({
    family_code: g.familyCode,
    person_id: g.personId,
    event: 'granted',
    source: 'profile',
    note: 'My Profile, text message settings',
  })
  if (error) {
    console.error(`[sms-consent] grant failed for ${g.personId}: ${error.message}`)
    return { success: false, message: t('act.couldNotSave') }
  }

  revalidatePath('/personal-info')
  return { success: true, message: t('act.savedYourFamilyMaySend') }
}

/**
 * Turn it off.
 *
 * ALWAYS PERMITTED, WITH NO PRECONDITION AND NO CONFIRM STEP. Withdrawing consent is the one
 * action in this product that must never be harder than granting it — a dialog between somebody
 * and the "stop texting me" button is the shape a regulator reads as an obstacle. It is
 * idempotent for the same reason: recording a second withdrawal is harmless, and refusing one
 * because the state "is already off" invites a member to conclude it is not.
 */
export async function withdrawSmsConsent(): Promise<ActionResult> {
  const g = await requireMember()
  if (!g.ok) return { success: false, message: g.message }
  const { t } = g
  if (!g.personId) return { success: false, message: t('act.profileNotFound') }

  const { error } = await createAdminClient().from('sms_consent_events').insert({
    family_code: g.familyCode,
    person_id: g.personId,
    event: 'withdrawn',
    source: 'profile',
    note: 'My Profile, text message settings',
  })
  if (error) {
    console.error(`[sms-consent] withdrawal failed for ${g.personId}: ${error.message}`)
    return { success: false, message: t('act.couldNotSave') }
  }

  revalidatePath('/personal-info')
  return { success: true, message: t('act.turnedOffYourFamilyWill') }
}
