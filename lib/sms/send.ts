/**
 * Sending a text message — the seam, with no provider behind it yet.
 *
 * ── WHAT THIS FILE IS FOR TODAY ────────────────────────────────────────────────────
 * Nothing sends. There is no Twilio account, no A2P 10DLC registration and no credentials, and
 * FutureFeature.md §5 records that the second of those is a real-world onboarding process
 * rather than a config value: **US carriers will not deliver application-to-person SMS to a
 * number at all until a brand and campaign are registered.**
 *
 * So this exists to be the ONE place that changes when they are, and to make every caller
 * written against it honest in the meantime. `sendSms` reports `{ sent: false }` with a reason,
 * which is exactly what a caller must already handle — see below.
 *
 * ── IT IS A PLAIN MODULE, AND THAT IS THE SAME RULE AS `lib/email/send.ts` ─────────
 * **Never export a sender from a `'use server'` file.** Everything exported from one gets a URL,
 * so a `sendSms` export would be an open relay — and the payload is worse than the email
 * version's: a text message reaches a phone on a nightstand, carries our registered sender id,
 * and costs money on every send. `lib/email/README.md`'s first rule, with higher stakes.
 *
 * ── IT FAILS SOFT, DELIBERATELY, AND THE CALLER OWES THE TRUTH ─────────────────────
 * `sendSms` never throws, for `sendEmail`'s reason: every call site runs after a decision is
 * committed, and a provider outage must not roll one back. The cost is the same too — a dropped
 * message is invisible unless somebody records it — so the rule that comes with it is the rule
 * that came with email:
 *
 *     A CALLER MUST NOT RENDER SUCCESS OVER A MESSAGE THAT DID NOT GO.
 *
 * On this channel that is not a nicety. The one caller this is being built for asks a relative
 * whether they are alive.
 *
 * ── AND IT DOES NOT DECIDE WHETHER IT MAY SEND ────────────────────────────────────
 * `mayTextPerson` in `lib/sms/consent.ts` is that decision and it is deliberately NOT called
 * from here. Two reasons: this module knows nothing about people, and folding consent into the
 * transport would make "did it go" and "were we allowed" one answer — so a caller that forgot
 * the consent check would get a plausible failure rather than a loud one. The consent check
 * belongs at the call site, above this, where the roster is.
 */

/** The same shape `SendResult` has in `lib/email/send.ts`, for the same reasons. */
export interface SmsResult {
  sent: boolean
  /** Present when `sent` is false. Server-side diagnostics; never shown to a member. */
  error?: string
}

/**
 * Is there a provider at all?
 *
 * Read by the profile band so it can say *"text messages are not switched on yet"* rather than
 * offering a verification code that cannot arrive. A capability the UI silently offers and
 * cannot deliver is the failure this whole codebase's marketing rules are about, one layer down.
 *
 * ENV-DRIVEN RATHER THAN A CONSTANT, so wiring a provider is a deployment change and not a code
 * change — and so a developer with credentials can exercise the flow without editing a file that
 * would then be committed.
 */
export function smsConfigured(): boolean {
  return Boolean(
    process.env.SMS_PROVIDER?.trim()
    && process.env.SMS_ACCOUNT_SID?.trim()
    && process.env.SMS_AUTH_TOKEN?.trim()
    && process.env.SMS_FROM_NUMBER?.trim(),
  )
}

/**
 * Deliver one message to one number.
 *
 * `to` IS ONE E.164 NUMBER, never an array — `sendEmail`'s rule, and here the reason is
 * different and stronger: a provider's bulk endpoint prices and rate-limits differently, and a
 * per-recipient call is the only shape that can record a per-recipient outcome. Fan-out is the
 * caller's job, through the same claimed-batch queue `distributions` and `safety-check-ins`
 * already use.
 *
 * ── THE BODY IS THE CALLER'S, AND THERE IS NO TEMPLATE LAYER ──────────────────────
 * Unlike email, which has `lib/email/layout.ts` and five composed templates. SMS has 160
 * characters and no chrome, so a template layer would be indirection over a string — and every
 * message this product will send has to carry the carrier-mandated opt-out line, which is a
 * property of the CHANNEL rather than of any one message. When a provider is wired, appending
 * that line belongs here, once, not at each call site.
 */
export async function sendSms(opts: {
  to: string
  body: string
  /** For the provider's dashboard, grouping sends. Not delivered to the recipient. */
  tag?: string
}): Promise<SmsResult> {
  if (!smsConfigured()) {
    // NOT AN ERROR CONDITION TO LOG LOUDLY. This is the expected state today, and a call
    // arriving here means a caller offered something the product cannot do yet — which is a bug
    // in the caller, reported to it plainly rather than buried in a server log.
    return { sent: false, error: 'no SMS provider configured' }
  }

  // ── WHEN A PROVIDER IS WIRED, IT GOES HERE, AND THE CHECKLIST IS §5's ────────────
  // FutureFeature.md carries the full list. The four that must not be skipped:
  //   * append the carrier-mandated opt-out line to `body` — once, here.
  //   * treat a 4xx as permanent and a 5xx/429 as retryable, and report which, so a caller's
  //     queue can requeue one and not the other (`retryCheckInAsks`' rule).
  //   * never log the message body: it is member-authored and goes to a phone.
  //   * `to` is already E.164 by `toE164`; do not re-normalise it here or the two rules drift.
  void opts
  return { sent: false, error: 'SMS provider configured but not implemented' }
}
