/**
 * Whether a relative may be sent a text message, and what their answer to that question is.
 *
 * ── WHY THIS IS A PURE MODULE, AND WHY IT IS THE FIRST THING BUILT ─────────────────
 * `app/actions/sms-consent.ts` is `'use server'`, so nothing here could live there and be
 * shared — and this rule is consulted from more places than most: the profile band, the
 * eventual check-in fan-out, and anything else that ever wants to text a family.
 *
 * It is also the rule with the sharpest consequence of being wrong in this whole product.
 * FutureFeature.md §5 states it plainly: **US TCPA statutory damages are $500–$1,500 per
 * message**, and a hundred and forty relatives is not a number to be wrong about. So the
 * decision "may we text this person" is a pure function over stored facts, decidable from
 * arguments, and tested by value under `npm test` — rather than a condition assembled inline
 * at whichever call site is about to send.
 *
 * NOTHING HERE READS THE WORLD. No clock except the one passed in, no database, no provider.
 *
 * ── THE LOG IS THE TRUTH; THE STATUS IS DERIVED ────────────────────────────────────
 * `sms_consent_events` is append-only and `consentStatus()` folds it. That is the opposite of
 * this codebase's usual instinct — AGENTS.md §4b's `is_minor` trap is about a STORED value
 * where a derivation belongs — and it is the same rule pointing the other way: consent is an
 * EVENT that happened at a time, from a source, and a boolean column would answer "are they
 * opted in" while losing the only thing a challenge would ever ask, which is *when did they
 * agree, and how*. A single column cannot be a legal record.
 */

/**
 * What happened. Four events, and only these four change whether we may text somebody.
 *
 *   `granted`        they turned it on themselves, in the product.
 *   `withdrawn`      they turned it off themselves, in the product.
 *   `stop_received`  they texted STOP (or one of the carrier-mandated synonyms).
 *   `start_received` they texted START, after a STOP.
 *
 * **`HELP` IS NOT HERE, DELIBERATELY.** It is carrier-mandated and must be answered, but it
 * changes no consent — putting it in a consent log would make the log a message archive and
 * make `consentStatus()` fold events that mean nothing to it.
 */
export type SmsConsentEvent = 'granted' | 'withdrawn' | 'stop_received' | 'start_received'

/** Where the event came from. Part of the record, never inferred from the event. */
export type SmsConsentSource = 'profile' | 'sms_reply' | 'admin' | 'import'

/**
 * Where somebody stands.
 *
 * FOUR VALUES, AND `stopped` IS NOT THE SAME AS `withdrawn`. That distinction is the whole
 * reason this is an enum rather than a boolean, and it is a legal rule rather than a product
 * preference:
 *
 *   `none`       never granted. The default, and the only correct default.
 *   `granted`    they said yes and have not taken it back.
 *   `withdrawn`  they turned it off in the product. They can turn it back on in the product.
 *   `stopped`    **they texted STOP, and the app may NOT put that back.** A carrier-level
 *                opt-out is revoked by the handset, not by a checkbox on a website — so
 *                `grantSmsConsent` refuses a person in this state and the screen says why.
 *                Getting this backwards is the single most expensive mistake available here:
 *                it is texting somebody who has explicitly told the carrier to stop.
 */
export type SmsConsentStatus = 'none' | 'granted' | 'withdrawn' | 'stopped'

/** One row of the log, as the folder reads it. */
export interface ConsentRecord {
  event: SmsConsentEvent
  /** ISO 8601. Ordering is by this, then by `id` — see `consentStatus`. */
  occurredAt: string
  id: string
}

/**
 * Fold the log into where somebody stands now.
 *
 * ── THE ORDER IS TOTAL, AND IT HAS TO BE ───────────────────────────────────────────
 * Sorted by `occurredAt` then by `id`. Two events can share a timestamp — a STOP arriving in
 * the same second as somebody pressing the toggle is unlikely and not impossible — and a
 * partial order would let two reads of one log disagree about whether we may text a person.
 * The id tie-break is what makes the answer a function of the data rather than of the row
 * order the database happened to return.
 *
 * ── LAST EVENT WINS, WITH ONE ASYMMETRY ────────────────────────────────────────────
 * `granted` after `withdrawn` is `granted`, and `withdrawn` after `granted` is `withdrawn` —
 * ordinary. The asymmetry is STOP: after `stop_received`, only `start_received` can move it,
 * and a `granted` event arriving afterwards is IGNORED rather than honoured.
 *
 * That branch should be unreachable, because `grantSmsConsent` refuses a stopped person — so
 * it is defence in depth against exactly the bug that would matter. If a future admin tool, a
 * bulk import or a migration ever writes a `granted` row over a STOP, this is what refuses to
 * act on it. The alternative is that the folder trusts the writer, and the writer is the thing
 * most likely to be wrong.
 */
export function consentStatus(records: readonly ConsentRecord[]): SmsConsentStatus {
  const ordered = [...records].sort((a, b) => {
    const t = a.occurredAt.localeCompare(b.occurredAt)
    return t !== 0 ? t : a.id.localeCompare(b.id)
  })

  let status: SmsConsentStatus = 'none'
  for (const record of ordered) {
    switch (record.event) {
      case 'stop_received':
        status = 'stopped'
        break
      case 'start_received':
        // START is only meaningful as the undo of a STOP. Arriving from any other state it
        // says nothing new — somebody texting START having never opted in has not agreed to
        // anything, and treating it as consent would be inventing an opt-in out of a keyword.
        if (status === 'stopped') status = 'none'
        break
      case 'granted':
        if (status !== 'stopped') status = 'granted'
        break
      case 'withdrawn':
        if (status !== 'stopped') status = 'withdrawn'
        break
    }
  }
  return status
}

/** Everything the send decision reads about one person. */
export interface SmsTarget {
  status: SmsConsentStatus
  /** ISO 8601, or null where no number has been confirmed. */
  phoneVerifiedAt: string | null
  /** The E.164 number, or null. Present-but-unverified is the case that must not send. */
  phoneE164: string | null
}

/**
 * Why we are not texting somebody. `null` means we may.
 *
 * A REASON RATHER THAN A BOOLEAN, because the roster has to say which of these it is: "has not
 * given permission" and "has no mobile number confirmed" are different jobs for whoever is
 * chasing people, exactly as `skipped` and `failed` are on a check-in's email.
 */
export type SmsBlockReason = 'no_number' | 'unverified' | 'no_consent' | 'withdrawn' | 'stopped'

export const SMS_BLOCK_TEXT: Record<SmsBlockReason, string> = {
  no_number: 'No mobile number on file',
  unverified: 'Mobile number not confirmed yet',
  no_consent: 'Has not agreed to text messages',
  withdrawn: 'Turned text messages off',
  stopped: 'Replied STOP to a text message',
}

/**
 * May we text this person?
 *
 * ── BOTH HALVES ARE REQUIRED, AND NEITHER IMPLIES THE OTHER ────────────────────────
 * A CONFIRMED number and a GRANTED consent. The reason to insist on both is that each catches
 * a different real mistake:
 *
 *   * A verified number with no consent is a number we know is theirs and are not allowed to
 *     use. That is the TCPA case.
 *   * A consent with an unverified number is permission to text **a number we cannot show is
 *     theirs**. `people.phone` is free text — `normalizePhone` in `lib/profile-columns.ts`
 *     normalises a country code and, in its own words, *"returns anything it does not
 *     recognise unchanged rather than guessing"*, which is right for a directory and nowhere
 *     near enough to send to. A typo there is a stranger's phone, and the consent on file
 *     belongs to the relative rather than to the stranger.
 *
 * ORDER OF PRECEDENCE IS THE ORDER SOMEBODY WOULD FIX THEM IN: no number, then unverified,
 * then the consent states. A person with neither a number nor consent is reported as needing a
 * number, because that is the first step and reporting the second would be advice they cannot
 * act on yet.
 *
 * `stopped` IS CHECKED FIRST AMONG THE CONSENT STATES for the reason `consentStatus` gives: it
 * is the one state the product may not talk its way out of.
 */
export function smsBlockReason(target: SmsTarget): SmsBlockReason | null {
  if (target.status === 'stopped') return 'stopped'
  if (!target.phoneE164) return 'no_number'
  if (!target.phoneVerifiedAt) return 'unverified'
  if (target.status === 'withdrawn') return 'withdrawn'
  if (target.status !== 'granted') return 'no_consent'
  return null
}

/** True only where every condition to send is met. The one call site a sender should use. */
export function mayTextPerson(target: SmsTarget): boolean {
  return smsBlockReason(target) === null
}

// ── The number itself ─────────────────────────────────────────────────────────────────

/**
 * Normalise a typed number to E.164, or answer `null`.
 *
 * ── THIS ONE REFUSES, WHICH `normalizePhone` DELIBERATELY DOES NOT ─────────────────
 * `lib/profile-columns.ts` is explicit that its normaliser *"returns anything it does not
 * recognise unchanged rather than guessing"*, and that a normaliser which refuses a save is a
 * worse bug than the inconsistency it fixes. That is correct for the DIRECTORY number, which a
 * human reads and dials.
 *
 * It is the wrong rule for a SENDING number, and this is the one place in the codebase where
 * the two diverge. A directory number that is not quite a number is a mild inconvenience; a
 * sending number that is not quite a number is a text message to somebody else. So this
 * returns `null` and the caller refuses, rather than passing through what it could not parse.
 *
 * ── NORTH AMERICA ONLY, AND IT SAYS SO ─────────────────────────────────────────────
 * 10 digits, or 11 beginning with 1, mapped to `+1XXXXXXXXXX`. Anything already in `+…` form
 * with 8–15 digits is accepted as given, because that is what a member outside NANP would
 * type and refusing it would be worse than accepting it.
 *
 * WHAT IT IS NOT is a validity check. Only the verification code proves a number is real and
 * theirs; this only decides whether the string is shaped like something worth sending a code
 * to. Do not let a future caller treat a non-null answer as "verified".
 */
export function toE164(input: string): string | null {
  const raw = (input ?? '').trim()
  if (!raw) return null

  if (raw.startsWith('+')) {
    const digits = raw.slice(1).replace(/\D/g, '')
    return digits.length >= 8 && digits.length <= 15 ? `+${digits}` : null
  }

  const digits = raw.replace(/\D/g, '')
  if (digits.length === 10) return `+1${digits}`
  if (digits.length === 11 && digits.startsWith('1')) return `+${digits}`
  return null
}

/**
 * The last four digits, for showing a number back without printing it.
 *
 * A confirmed mobile number is the kind of thing a screenshot of a screen should not leak, and
 * "ending 4417" is enough for somebody to recognise their own. Returns `null` rather than a
 * masked empty string, so a caller cannot render "ending ••••".
 */
export function lastFour(phoneE164: string | null): string | null {
  const digits = (phoneE164 ?? '').replace(/\D/g, '')
  return digits.length >= 4 ? digits.slice(-4) : null
}

/**
 * Is this inbound message body one of the carrier-mandated keywords?
 *
 * ── IT IS A FIXED LIST AND IT IS NOT NEGOTIABLE ────────────────────────────────────
 * US carriers require STOP, and in practice the whole set below, to be honoured on any
 * application-to-person message. So this is here rather than in the eventual webhook: the
 * keyword rule is a fact about SMS, not about whichever route handler happens to receive one,
 * and it needs to be testable without a provider.
 *
 * MATCHED ON THE WHOLE TRIMMED BODY, case-insensitively, and never as a substring. *"Please
 * stop texting my mother about the reunion"* is a sentence a relative might genuinely send and
 * is not an opt-out keyword — treating it as one would silently unsubscribe somebody who was
 * asking a question. Carriers specify the exact-match rule for the same reason.
 */
const STOP_WORDS = ['stop', 'stopall', 'unsubscribe', 'cancel', 'end', 'quit', 'revoke', 'optout']
const START_WORDS = ['start', 'unstop', 'yes', 'optin']

export function keywordFor(body: string): SmsConsentEvent | 'help' | null {
  const word = (body ?? '').trim().toLowerCase().replace(/\s+/g, '')
  if (!word) return null
  if (STOP_WORDS.includes(word)) return 'stop_received'
  if (START_WORDS.includes(word)) return 'start_received'
  if (word === 'help' || word === 'info') return 'help'
  return null
}
