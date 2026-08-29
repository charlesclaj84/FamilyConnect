'use server'

import { revalidatePath } from 'next/cache'

import { createAdminClient } from '@/lib/supabase/admin'
import { requireMember } from '@/lib/auth/guard'
import { consentStatus, toE164, type SmsConsentStatus } from '@/lib/sms/consent'
import { smsConfigured } from '@/lib/sms/send'
import {
  CHANNELS, NOTIFICATIONS, channelDefault,
  type NotificationChannel, type NotificationPref,
} from '@/lib/notification-prefs'

/**
 * What a member wants to be told about — My Profile → Notifications.
 *
 * ── SELF-SERVICE, SO THE GATE IS `requireMember()` AND THE CHECK IS OWNERSHIP ───────
 * AGENTS.md §2: `create` and `edit` default to scope `'none'`, so demanding a grant for
 * something every member may do by definition would lock the whole family out. Choosing whether
 * your family may email you is squarely in that class.
 *
 * *"'No permission needed' never means 'no check needed'."* THE PERSON IS NEVER A PARAMETER —
 * it comes from the guard, so there is no way to ask this endpoint to change a relative's
 * preferences. That is the whole of the §4 exposure here and it is closed structurally rather
 * than by a conjunct somebody has to remember.
 *
 * ── AND IT IS DELIBERATELY NOT TIER-CHECKED ────────────────────────────────────────
 * `getMySmsSettings` carries the same note and the reason is the same: a family that lapses
 * from a paid plan must not lose the ability to turn a notification OFF. A preference screen
 * behind a paywall is a paywall in front of "stop contacting me".
 *
 * ── SMS IS TWO WRITES, AND THAT IS THE ONE THING NOT TO SIMPLIFY ───────────────────
 * `sms_consent_events` is the legal record of whether we may text somebody at all —
 * append-only, sourced, timed, and the thing a TCPA complaint would ask about.
 * `person_notification_prefs` is which of the things we may text them about they want. Today
 * there is exactly one SMS notification, so the two answer the same question and the member
 * presses one control; this writes BOTH, because the second SMS notification will be narrowed
 * by the pref row while consent stays the master switch.
 *
 * Merging them either way loses something real: one column cannot be a legal record, and an
 * event log full of per-notification preferences makes `consentStatus()` fold rows that mean
 * nothing to it.
 */

export interface NotificationContact {
  /** The address a notification would go to, or null where there is none on file. */
  email: string | null
  /** True where that address is a generated placeholder — see `lib/family-tree.ts`. */
  emailIsPlaceholder: boolean
  /**
   * The number we would text, in E.164, or null.
   *
   * ── IT WAS THE LAST FOUR DIGITS UNTIL 2026-08-29, AND THE REDACTION PROTECTED NOTHING ──
   * `phoneEnding` came back instead, on the argument that a mobile number is the kind of thing
   * a screenshot leaks. That is true of somebody ELSE's number. This is the caller's own, on
   * the caller's own profile, two rail items away from the **General** section that prints it
   * in full in an editable box — so the redaction hid it from exactly one person, the one it
   * belongs to, and hid nothing from anybody who could already read the screen.
   *
   * What it cost is the whole question this block exists to answer: *is the number you would
   * text the right one?* "Ending 2189" cannot answer that for anybody with an old handset in a
   * drawer, and this screen's own rule is that it never lets a switch marked On imply a
   * delivery it cannot make.
   */
  phone: string | null
}

export interface MyNotificationSettings {
  prefs: NotificationPref[]
  contact: NotificationContact
  /** Is a text provider wired at all? The screen says so rather than promising delivery. */
  smsAvailable: boolean
  /** Where the caller stands on being texted AT ALL. `stopped` is a dead end — see below. */
  smsConsent: SmsConsentStatus
  /** A number is on file and has been confirmed. Distinct from consent. */
  smsNumberVerified: boolean
}

export interface ActionResult {
  success: boolean
  message?: string
}

const EMPTY: MyNotificationSettings = {
  prefs: [],
  contact: { email: null, emailIsPlaceholder: false, phone: null },
  smsAvailable: false,
  smsConsent: 'none',
  smsNumberVerified: false,
}

/**
 * The caller's own grid, plus the two facts about how they would be reached.
 *
 * ── THE CONTACT DETAILS COME FROM THE PROFILE, NOT FROM A SECOND FORM ──────────────
 * This screen used to collect a mobile number of its own. It does not any more: the number and
 * the address the family already holds are what a notification would use, and asking for them
 * twice is how two columns describing one fact come to disagree (AGENTS.md §4b's `is_minor`
 * trap, in miniature). `people.primary_phone` and `people.primary_email` are the source, and the
 * screen links to General to change either.
 *
 * `person_sms.phone_e164` is still read, and only for `phone` and `smsNumberVerified` — it is
 * the SEND target and the confirmation record, which is a different thing from the number on
 * the profile. Where the two differ the send target wins on this screen, because it is what
 * would actually be texted.
 *
 * ── THE COLUMN IS `primary_phone`, AND ASKING FOR `phone` EMPTIED THE WHOLE READ ───
 * It said `.select('primary_email, email_is_placeholder, phone')` until 2026-08-29. There is no
 * `people.phone` — `lib/phone-format.ts`'s `PHONE_COLUMNS` is `['primary_phone']` and no
 * migration has ever created the other one — so PostgREST answered **42703 and killed the whole
 * query**, exactly as AGENTS.md's own "code ahead of schema" incident describes.
 *
 * The visible cost was not the phone number. It was the EMAIL ADDRESS beside it: `person` came
 * back null, so a member with a perfectly good address on file was shown *"None on file"* and a
 * withheld-tone note telling them nothing marked on for Email would arrive. Measured against
 * the live project — every account there has a real, non-placeholder address.
 *
 * That is §8 in one line: `const { data }` discards the error and an empty result reads as no
 * rows. `personRes.error` is checked below now, for the same reason `prefsRes.error` already
 * was.
 *
 * ── THE ADMIN CLIENT, §3 BY HAND, AND WHY ─────────────────────────────────────────
 * `person_notification_prefs` and `person_sms` both have own-row SELECT policies the user
 * client could satisfy, but `sms_consent_events` is folded rather than read raw and all four
 * reads belong to one screen — so they are here together, each with `.eq('family_code', …)` and
 * `.eq('person_id', …)` by hand. Splitting one screen's state across two clients is how half of
 * it comes back empty for a caller the other half admitted.
 */
export async function getMyNotificationSettings(): Promise<MyNotificationSettings> {
  const available = smsConfigured()
  const g = await requireMember()
  if (!g.ok || !g.familyCode || !g.personId) return { ...EMPTY, smsAvailable: available }

  const admin = createAdminClient()
  const [prefsRes, personRes, smsRes, eventsRes] = await Promise.all([
    admin.from('person_notification_prefs')
      .select('notification_key, channel, opted_in')
      .eq('family_code', g.familyCode).eq('person_id', g.personId),
    admin.from('people')
      .select('primary_email, email_is_placeholder, primary_phone')
      .eq('family_code', g.familyCode).eq('id', g.personId).maybeSingle(),
    admin.from('person_sms').select('phone_e164, verified_at')
      .eq('family_code', g.familyCode).eq('person_id', g.personId).maybeSingle(),
    admin.from('sms_consent_events').select('id, event, occurred_at')
      .eq('family_code', g.familyCode).eq('person_id', g.personId),
  ])

  // §8: `const { data }` discards the error, and a refused read here renders a grid of
  // defaults over answers the member has already given — which reads as the product having
  // forgotten their choice. Logged and reported as the conservative shape.
  if (prefsRes.error) {
    console.error(`[notification-prefs] could not read the grid for ${g.personId}: ${prefsRes.error.message}`)
    return { ...EMPTY, smsAvailable: available }
  }

  // §8, AND THE ONE THAT ACTUALLY BIT. A refused `people` read is indistinguishable from a
  // member with no contact details at all, and the screen renders the second: "None on file",
  // in the withheld tone, over an address that is right there in the row. Logged so the next
  // one is a line in a server log rather than a member concluding the product has lost their
  // email address. Reported as the conservative shape for the same reason the grid is.
  if (personRes.error) {
    console.error(`[notification-prefs] could not read the contact details for ${g.personId}: ${personRes.error.message}`)
    return { ...EMPTY, smsAvailable: available }
  }

  const prefs: NotificationPref[] = (prefsRes.data ?? [])
    .map(row => ({
      notificationKey: row.notification_key as string,
      channel: row.channel as NotificationChannel,
      optedIn: row.opted_in as boolean,
    }))
    // A channel the CHECK admits but this build does not know about. Dropped rather than
    // passed through, so `prefEnabled` never has to reason about a value outside its union.
    .filter(p => (CHANNELS as readonly string[]).includes(p.channel))

  const person = personRes.data
  const smsNumber = (smsRes.data?.phone_e164 as string | null) ?? null

  return {
    prefs,
    contact: {
      email: (person?.primary_email as string | null) ?? null,
      emailIsPlaceholder: Boolean(person?.email_is_placeholder),
      // THE SEND TARGET FIRST, then the profile number. `person_sms` is what a text would go
      // to; the profile number is what it would be adopted from if the member opts in and
      // there is nothing on file yet. Showing the profile's when a different one is confirmed
      // would tell somebody a text is going to a number it is not.
      //
      // BOTH SIDES GO THROUGH `normalise`, so the screen prints one shape whichever answered.
      // The profile column holds whatever a member typed — the live project has `9033481886`
      // beside `+14698912189` — and `toE164` refuses what it cannot parse, which is the right
      // answer for a number that is not quite a number (see its own header).
      phone: normalise(smsNumber) ?? normalise(person?.primary_phone as string | null),
    },
    smsAvailable: available,
    smsConsent: consentStatus((eventsRes.data ?? []).map(e => ({
      event: e.event as never,
      occurredAt: e.occurred_at as string,
      id: e.id as string,
    }))),
    smsNumberVerified: smsRes.data?.verified_at != null,
  }
}

/**
 * Turn one cell of the grid on or off.
 *
 * ── EVERY ARGUMENT IS VALIDATED AGAINST THE CATALOGUE, NOT TRUSTED ─────────────────
 * A server action is a public HTTP endpoint and both strings arrive from a browser. An
 * unrecognised notification key or channel is refused rather than stored: a row nothing reads
 * is a preference somebody believes they have set. And a cell the catalogue marks
 * `'unavailable'` is refused too — writing an opt-in for a channel that cannot send is a switch
 * wired to nothing, which is the shape AGENTS.md warns about for `permission_resources.actions`.
 *
 * ── UPSERT ON THE CELL, WHICH IS WHY THE UNIQUE INDEX EXISTS ───────────────────────
 * Two rows for one cell would make `prefEnabled` return whichever the database listed first — a
 * preference that changes between two reads of the same screen.
 *
 * ── AND THE SMS CELL WRITES THE CONSENT LEDGER TOO ─────────────────────────────────
 * See the module header. `stopped` is refused here rather than recorded: a carrier-level
 * opt-out is revoked by the handset, and this product may not put it back. That is the single
 * most expensive mistake available in this file.
 */
export async function setMyNotificationPref(input: {
  notificationKey: string
  channel: string
  optedIn: boolean
}): Promise<ActionResult> {
  const g = await requireMember()
  if (!g.ok) return { success: false, message: g.message }
  const { t } = g
  if (!g.familyCode || !g.personId) return { success: false, message: t('act.profileNotFound2') }

  const key = typeof input?.notificationKey === 'string' ? input.notificationKey : ''
  const channel = typeof input?.channel === 'string' ? input.channel : ''
  const optedIn = input?.optedIn === true

  if (!NOTIFICATIONS.some(n => n.key === key)) {
    return { success: false, message: t('act.notNotificationWeSend') }
  }
  if (!(CHANNELS as readonly string[]).includes(channel)) {
    return { success: false, message: t('act.notChannelWeSend') }
  }
  const fallback = channelDefault(key, channel as NotificationChannel)
  if (fallback === 'unavailable') {
    return { success: false, message: t('act.channelNotAvailableNotificationYet') }
  }

  const admin = createAdminClient()

  // ── THE SMS HALF, FIRST, BECAUSE IT CAN REFUSE ───────────────────────────────────
  // Written before the pref row so a refusal leaves nothing behind. The reverse order would
  // store an opt-in for somebody the ledger says we may not text — a screen saying "on" over a
  // channel that will never send.
  if (channel === 'sms') {
    const { data: events, error: readError } = await admin
      .from('sms_consent_events').select('id, event, occurred_at')
      .eq('family_code', g.familyCode).eq('person_id', g.personId)
    if (readError) {
      console.error(`[notification-prefs] could not read consent for ${g.personId}: ${readError.message}`)
      return { success: false, message: t('act.couldNotCheckYourText') }
    }
    const status = consentStatus((events ?? []).map(e => ({
      event: e.event as never,
      occurredAt: e.occurred_at as string,
      id: e.id as string,
    })))

    if (optedIn && status === 'stopped') {
      return {
        success: false,
        message: t('act.youRepliedStopTextFrom'),
      }
    }

    // Only where it CHANGES. `consentStatus` folds the log, so appending `granted` to a log
    // already reading `granted` records an event that did not happen — and this log is
    // evidence, so a spurious row in it is worse than a missing one.
    const wantGranted = optedIn
    const isGranted = status === 'granted'
    if (wantGranted !== isGranted) {
      const { error } = await admin.from('sms_consent_events').insert({
        family_code: g.familyCode,
        person_id: g.personId,
        event: wantGranted ? 'granted' : 'withdrawn',
        source: 'profile',
        note: `Notifications screen · ${key}`,
      })
      if (error) {
        console.error(`[notification-prefs] could not record consent for ${g.personId}: ${error.message}`)
        return { success: false, message: t('act.couldNotRecordYourChoice') }
      }
    }

    // ── ADOPT THE NUMBER ALREADY ON FILE ──────────────────────────────────────────
    // "Use the phone number already on file" is the whole point of this screen replacing the
    // one that asked for a second one. So opting in points `person_sms` at the profile's
    // number if there is nothing there yet.
    //
    // IT IS NOT MARKED VERIFIED, and that is not an oversight. `verified_at` means a code came
    // back from the handset, which is what makes the number provably the member's — so this
    // leaves it NULL, `smsBlockReason` still answers `unverified`, and the screen says the
    // number will be confirmed before anything is sent. Stamping it here would let a mistyped
    // digit on somebody's profile send a family's check-in to a stranger.
    if (wantGranted) {
      const { data: existing } = await admin.from('person_sms').select('id, phone_e164')
        .eq('family_code', g.familyCode).eq('person_id', g.personId).maybeSingle()
      if (!existing?.phone_e164) {
        // `primary_phone`, not `phone` — see `getMyNotificationSettings`. The second copy of
        // that mistake was quieter than the first: it made this adoption a no-op for every
        // member, so opting in never picked up the number already on their profile, which is
        // the one thing this block exists to do.
        const { data: person } = await admin.from('people').select('primary_phone')
          .eq('family_code', g.familyCode).eq('id', g.personId).maybeSingle()
        const e164 = normalise(person?.primary_phone as string | null)
        if (e164) {
          const { error } = await admin.from('person_sms').upsert({
            id: existing?.id,
            family_code: g.familyCode,
            person_id: g.personId,
            phone_e164: e164,
            verified_at: null,
          }, { onConflict: 'id' })
          // NOT FATAL. The consent is recorded and the preference is about to be; a number we
          // could not adopt leaves the screen saying "we still need to confirm a number",
          // which is true and is the honest failure. Rolling the consent back over it would
          // discard the one thing the member actually pressed.
          if (error) {
            console.error(`[notification-prefs] could not adopt the profile number for ${g.personId}: ${error.message}`)
          }
        }
      }
    }
  }

  // ── THE PREF ROW ─────────────────────────────────────────────────────────────────
  // `family_code` and `person_id` both from the guard (§3), never from the caller. The guard
  // trigger on the table refuses a mismatched pair underneath this anyway.
  const { error } = await admin.from('person_notification_prefs').upsert({
    family_code: g.familyCode,
    person_id: g.personId,
    notification_key: key,
    channel,
    opted_in: optedIn,
  }, { onConflict: 'person_id,notification_key,channel' })

  if (error) {
    console.error(`[notification-prefs] could not save ${key}/${channel} for ${g.personId}: ${error.message}`)
    return { success: false, message: t('act.couldNotSavePleaseTry') }
  }

  revalidatePath('/personal-info')
  return { success: true, message: optedIn ? 'Turned on' : 'Turned off' }
}

/**
 * A profile phone number as E.164, or null.
 *
 * `toE164` is the one normaliser in this codebase that REFUSES what it cannot parse, and this
 * wrapper exists so the two call sites above read the same way. A directory number that is not
 * quite a number must resolve to null rather than to something nearly right — a text to a
 * nearly-right number is a text to somebody else.
 */
function normalise(raw: string | null | undefined): string | null {
  if (!raw) return null
  return toE164(raw)
}
