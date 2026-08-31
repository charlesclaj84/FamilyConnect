'use server'

import { revalidatePath } from 'next/cache'

import { createAdminClient } from '@/lib/supabase/admin'
// The USER client, and only to read the caller's own session address off GoTrue — never to
// read family data, which every query here does through the admin client with §3 by hand.
import { requireEdit, requireRead } from '@/lib/auth/guard'
import { SECTION_RESOURCE } from '@/components/admin/account-sections'
import { intentKey, onAccount, stripeClient, stripeUnavailableReason } from '@/lib/stripe/client'
import { connectConfigured } from '@/lib/stripe/config'
import {
  DEFAULT_CONNECT_COUNTRY, isEnabledConnectCountry,
} from '@/lib/stripe/connect-countries'
// PLAIN MODULES, imported and never re-exported. Everything exported from a `'use server'`
// file gets a URL, so a `sendEmail` re-export would be an open relay carrying GENORRA's SPF
// and DKIM — see the header of lib/email/send.ts.
import { sendEmail, emailOrigin, deliveryNote } from '@/lib/email/send'
import { processorDisconnectCodeEmail } from '@/lib/email/templates'
import { resolveLocale } from '@/lib/auth/locale'
import { hashChallengeCode, mintChallenge } from '@/lib/action-challenge'
import { SITE_URL } from '@/lib/site'
import { currentUser } from '@/lib/auth/current-user'

/**
 * Connecting a family's OWN Stripe account, so its members can pay dues with a card.
 *
 * ── THE PANEL THIS FILLS IN WAS DELIBERATELY INERT FOR MONTHS ───────────────────────
 * `ProcessingPanel` in `AdminAccountShell` said *"Stripe support is planned for a future
 * release"*, and the note beside `BankInfoPanel` explains the instinct both shared: *"a form
 * that looked functional would invite someone to type real Stripe keys into a field that
 * discards them."* That instinct was right, and the answer is not a better form — it is that
 * **there is no field for a key at all.**
 *
 * A family connects its own account through Stripe's own hosted onboarding, and what we keep
 * is an `acct_…` id. `payment_info.md` §4 is the argument; 20260823000005's verify block
 * asserts that no column on either table so much as LOOKS like a credential, so a future
 * migration cannot add one without failing the deploy.
 *
 * ── ACCOUNTS v2, `dashboard: 'full'`, DIRECT CHARGES ────────────────────────────────
 * Not the legacy `type: 'standard' | 'express' | 'custom'` parameter, which Stripe's current
 * guidance says never to use. The three v2 dimensions are set explicitly and each one is a
 * decision `payment_info.md` §3 argues:
 *
 *   dashboard: 'full'                  the family gets a real Stripe Dashboard. They own the
 *                                      account, they set their own payout schedule, and they
 *                                      handle their own refunds and disputes.
 *   fees_collector: 'stripe'           the FAMILY pays Stripe's processing fees, not GENORRA.
 *   losses_collector: 'stripe'         Stripe bears negative-balance liability, not GENORRA.
 *                                      This is what keeps a chargeback on a $40 due from
 *                                      being our problem.
 *   configuration.merchant             requested with `card_payments`, because the family is
 *                                      the merchant of record on a direct charge.
 *
 * There is no `configuration.recipient` and there must not be: requesting it would drag a
 * family through extra onboarding for a capability (`stripe_transfers`) that a direct-charge
 * flow never uses. Stripe's guidance names that as a trap in the opposite direction, and it is
 * the same mistake from either side.
 *
 * ── `card_payments.status`, NEVER `charges_enabled` ─────────────────────────────────
 * The go-live check is `configuration.merchant.capabilities.card_payments.status === 'active'`.
 * `charges_enabled` is a deprecated v1 field and the two DISAGREE during review — which is
 * the window in which offering members a Pay Online button produces a checkout that fails at
 * the till, after somebody has decided to pay.
 */

type AdminClient = ReturnType<typeof createAdminClient>

const PROCESSING = SECTION_RESOURCE.processing

export interface ProcessorStatus {
  /** Whether this deployment can do Connect at all. False on every laptop by default. */
  available: boolean
  /** Why not, for a sentence on screen. Null when it is available. */
  unavailable: string | null
  /** A row exists and has not been disconnected. */
  connected: boolean
  /** The `acct_…`. Shown to the family because it is theirs and support asks for it. */
  accountId: string | null
  /**
   * Stripe's own word: `active`, `pending`, `unverified`, `restricted`, … Free text on
   * purpose — it is their vocabulary and it has grown before.
   */
  cardPaymentsStatus: string | null
  /** True when members can actually be charged. The ONLY thing that gates Pay Online. */
  chargesReady: boolean
  /** Stripe is still waiting on the family for something. */
  awaitingFamily: boolean
  connectedAt: string | null
  disconnectedAt: string | null
  /** How many members have a live recurring arrangement. Disconnecting cancels them. */
  liveAutopayCount: number
  canManage: boolean
  /**
   * Who bears Stripe's processing fee — `'family'` (absorbed) or `'member'` (charge grossed up).
   *
   * DEFAULTS TO `'family'`, which is what the product did before the setting existed. A family
   * that has never opened this control is absorbing the fee, and must go on doing so until
   * somebody decides otherwise: a default of `'member'` would have started surcharging every
   * relative in the product on the day this deployed.
   */
  feePayer: 'family' | 'member'
  /** The family's STATED percentage rate, in basis points. Quotes a gross-up; never a fee. */
  feePercentBps: number
  /** The family's STATED flat rate, in cents. */
  feeFixedCents: number
  /**
   * What the family has actually paid in card fees, in cents — the sum of every recorded
   * `stripe_charge_fees` row. Zero for a family that has taken no card payments.
   *
   * MEASURED, NEVER ESTIMATED, which is the distinction `lib/stripe-fees.ts` is built on: the
   * three fields above quote a charge, this one reports what Stripe took. Shown beside them so
   * a treasurer can see whether their stated rate resembles reality — which is the only way
   * anybody would ever notice that the rate they typed is wrong for the cards their family
   * actually uses.
   */
  feesPaidCents: number
}

export async function getProcessorStatus(): Promise<ProcessorStatus | null> {
  const g = await requireRead(PROCESSING)
  if (!g.ok || !g.familyCode) return null

  const admin = createAdminClient()
  const [accountRes, autopayRes, feesRes, editable] = await Promise.all([
    admin.from('family_stripe_accounts')
      .select('stripe_account_id, card_payments_status, details_submitted, connected_at, disconnected_at, fee_payer, fee_percent_bps, fee_fixed_cents')
      .eq('family_code', g.familyCode)
      .maybeSingle(),
    admin.from('dues_autopay')
      .select('id', { count: 'exact', head: true })
      .eq('family_code', g.familyCode)
      .is('cancelled_at', null),
    // §3 by hand, on the admin client, for the reason every report in this product uses it: a
    // fee total narrowed to what the READER may see is a wrong number rather than a withheld
    // one, and `stripe_charge_fees` has no policy for the user client to satisfy anyway.
    admin.from('stripe_charge_fees')
      .select('fee_cents')
      .eq('family_code', g.familyCode),
    requireEdit(PROCESSING).then(r => r.ok),
  ])

  // §8: a refused read must not render as "no processor connected" — that sentence invites a
  // treasurer to connect a second account on top of a working one.
  if (accountRes.error) {
    console.error(`[processing] could not read the processor for ${g.familyCode}: ${accountRes.error.message}`)
    return null
  }

  const row = accountRes.data
  const unavailable = stripeUnavailableReason()
    ?? (connectConfigured() ? null : 'Online payments are not set up on this deployment yet.')

  return {
    available: unavailable == null,
    unavailable,
    connected: row != null && row.disconnected_at == null,
    accountId: (row?.stripe_account_id as string | null) ?? null,
    cardPaymentsStatus: (row?.card_payments_status as string | null) ?? null,
    chargesReady: row?.disconnected_at == null && row?.card_payments_status === 'active',
    awaitingFamily: row != null && row.details_submitted !== true,
    connectedAt: (row?.connected_at as string | null) ?? null,
    disconnectedAt: (row?.disconnected_at as string | null) ?? null,
    liveAutopayCount: autopayRes.count ?? 0,
    canManage: editable,
    // The same fall-back-to-absorbing rule `readyProcessor` applies, and for the same reason:
    // if the vocabulary ever grows a third value, the failure mode should be a family paying
    // its own fees rather than a member being silently surcharged.
    feePayer: row?.fee_payer === 'member' ? 'member' : 'family',
    feePercentBps: Number(row?.fee_percent_bps ?? 290),
    feeFixedCents: Number(row?.fee_fixed_cents ?? 30),
    // §8: a refused read here would report $0.00 of fees over a family that has paid plenty,
    // which is the wrong-number-rather-than-a-missing-one failure this product keeps returning
    // to. `feesRes.error` is checked rather than `?? []` swallowing it.
    feesPaidCents: feesRes.error
      ? 0
      : (feesRes.data ?? []).reduce((sum, r) => sum + (Number(r.fee_cents) || 0), 0),
  }
}

export type ProcessorLinkResult =
  | { success: true; url: string }
  | { success: false; message: string }

/**
 * Start — or resume — Stripe's hosted onboarding, and hand back the URL.
 *
 * ── HOSTED ONBOARDING, NOT AN API ONE ───────────────────────────────────────────────
 * Stripe's guidance is explicit that a platform should not collect this itself, and the reason
 * is not convenience: onboarding a merchant means collecting a legal name, a date of birth, a
 * tax id and often a photograph of a passport. Every one of those in our database is a
 * regulatory obligation we would be taking on for no benefit, on a product whose whole
 * database is already family PII. Stripe collects it; we get a capability status.
 *
 * ── THE SAME CALL BOTH TIMES, AND THAT IS ON PURPOSE ────────────────────────────────
 * A link is single-use and expires. `refresh_url` points straight back at this action, so an
 * expired link resolves itself: the family lands here, a new link is minted, and they carry
 * on. Writing a second "resume onboarding" action would be two paths to one screen, and the
 * one that got the `use_case` wrong would be whichever nobody tested.
 */
export async function startProcessorOnboarding(
  /**
   * Which country the connected account is created in. ISO 3166-1 alpha-2, lowercase.
   *
   * ── IT IS ASKED, AND IT IS VALIDATED HERE RATHER THAN TRUSTED ────────────────────
   * `identity.country` decides the payout currency, which identity documents Stripe demands
   * and which regulations apply, and **it cannot be changed after the account is created.**
   * So this is the one parameter in this module where getting it wrong is permanent, and a
   * `<select>` in front of a server action is a convenience rather than a gate (AGENTS.md
   * §2).
   *
   * `isEnabledConnectCountry` is the check, and an unrecognised value is REFUSED rather than
   * defaulted to the US. Silently creating an American account for a family that asked for a
   * Canadian one is the exact failure the picker exists to remove, and doing it in the name
   * of robustness would hide it better than the old constant did.
   *
   * OPTIONAL, because a family RECONNECTING has a country already — `ensureConnectedAccount`
   * returns the existing row's account id and creates nothing, so there is nothing to decide
   * and nothing to ask. Absent means `DEFAULT_CONNECT_COUNTRY`, which is what every account
   * created before the picker holds.
   */
  country?: string,
): Promise<ProcessorLinkResult> {
  const g = await requireEdit(PROCESSING)
  if (!g.ok) return { success: false, message: g.message }
  const { t } = g
  if (!g.familyCode) return { success: false, message: t('act.youDoNotBelongFamily') }

  const wanted = country ?? DEFAULT_CONNECT_COUNTRY
  if (!isEnabledConnectCountry(wanted)) {
    return { success: false, message: t('act.countryNotAvailableForDues') }
  }

  const unavailable = stripeUnavailableReason()
  if (unavailable) return { success: false, message: unavailable }
  if (!connectConfigured()) {
    return { success: false, message: t('act.onlinePaymentsNotSetUp') }
  }
  const stripe = stripeClient()
  if (!stripe) return { success: false, message: t('act.onlinePaymentsNotSetUp2') }

  const admin = createAdminClient()
  const accountId = await ensureConnectedAccount(admin, stripe, {
    familyCode: g.familyCode,
    personId: g.personId,
    country: wanted,
  })
  if (!accountId) {
    return { success: false, message: t('act.couldNotStartSettingUp') }
  }

  try {
    const link = await stripe.v2.core.accountLinks.create({
      account: accountId,
      use_case: {
        type: 'account_onboarding',
        account_onboarding: {
          // ONLY the merchant configuration. Asking for more is asking the family for more.
          configurations: ['merchant'],
          // ── BOTH LAND ON THE PROCESSING PANE, AND THE MARKER IS WHAT IT READS ───────
          // `ProcessingPanel` acts on `?connect=` on mount: it calls
          // `refreshProcessorStatus()` for either value, and says which happened. Until
          // 2026-08-25 nothing read them at all — see that component for what the silence
          // cost, which was a family that could disconnect and never reconnect.
          //
          // `refresh` deliberately does NOT mint a new link here and bounce them onward,
          // although that is what Stripe designs the address for: a link that keeps expiring
          // would then loop between Stripe and this screen with no way out. The panel syncs,
          // explains, and lets the family press the button.
          refresh_url: `${SITE_URL}/admin/accounting?section=processing&connect=refresh`,
          return_url: `${SITE_URL}/admin/accounting?section=processing&connect=return`,
        },
      },
    })
    return { success: true, url: link.url }
  } catch (e) {
    console.error(`[processing] account link failed for ${g.familyCode}: ${describe(e)}`)
    return { success: false, message: t('act.couldNotOpenStripeOnboarding') }
  }
}

export type ProcessorActionResult =
  | { success: true; message: string }
  | { success: false; message: string }

/**
 * Ask Stripe what the account's state is now, and record it.
 *
 * ── THE RELIABLE HALF OF STATUS TRACKING, AND THE WEBHOOK IS THE OTHER ──────────────
 * `account.updated` on the Connect endpoint keeps this current in the background, and it is
 * the v1 event: accounts here are created through the v2 API, whose own capability events
 * (`v2.core.account[configuration.merchant].capability_status_updated`) travel through EVENT
 * DESTINATIONS, a different subscription mechanism that is not wired up. TODO.md carries that.
 *
 * So this exists, and the return page from onboarding calls it — which is exactly when the
 * answer has just changed and exactly when somebody is looking at the screen. It is not a
 * fallback for a broken webhook; it is the one path that does not depend on one.
 *
 * ── THAT SENTENCE WAS AN ASPIRATION UNTIL 2026-08-25 ───────────────────────────────
 * `startProcessorOnboarding` had always sent Stripe a `return_url` carrying `?connect=return`,
 * and nothing anywhere read it. `ProcessingPanel` does now, on mount, which is what makes the
 * paragraph above true — and the same effect is the only thing that clears `disconnected_at`
 * for a family reconnecting, because `ensureConnectedAccount` returns an existing row's
 * account id without writing to it. A reconnection that never refreshed was a family stuck
 * behind a Connect button that could not do anything.
 */
export async function refreshProcessorStatus(): Promise<ProcessorActionResult> {
  const g = await requireEdit(PROCESSING)
  if (!g.ok) return { success: false, message: g.message }
  const { t } = g
  if (!g.familyCode) return { success: false, message: t('act.youDoNotBelongFamily') }

  const stripe = stripeClient()
  if (!stripe) return { success: false, message: t('act.onlinePaymentsNotSetUp2') }

  const admin = createAdminClient()
  const { data: row } = await admin
    .from('family_stripe_accounts')
    .select('stripe_account_id')
    .eq('family_code', g.familyCode)
    .maybeSingle()
  const accountId = row?.stripe_account_id as string | undefined
  if (!accountId) return { success: false, message: t('act.familyNotConnectedAccountYet') }

  try {
    const account = await stripe.v2.core.accounts.retrieve(accountId, {
      // `identity` was missing here until 2026-08-25, and its absence was silent: the update
      // below reads `account.identity?.country`, `include` is what decides whether a field is
      // on the response at all, so the column was written `null` on every single refresh over
      // a value Stripe held all along. Nothing failed and nothing logged — the same shape as
      // an embed nobody qualified. Add a field to that list before reading it.
      include: ['configuration.merchant', 'requirements', 'identity'],
    })

    const status = account.configuration?.merchant?.capabilities?.card_payments?.status ?? null

    // ── `details_submitted` IS DERIVED, BECAUSE v2 HAS NO SUCH FIELD ─────────────────
    // A v2 account reports REQUIREMENTS, each of which is `awaiting_action_from: 'stripe' |
    // 'user'`. "The family has finished their part" is therefore "nothing is waiting on the
    // user" — which is the fact the screen needs and is strictly more useful than the v1
    // boolean, because it distinguishes *we are waiting on you* from *Stripe is reviewing*.
    // Those two want different sentences and the old field could not tell them apart.
    const awaitingUser = (account.requirements?.entries ?? [])
      .some(entry => entry.awaiting_action_from === 'user')

    const { error } = await admin.from('family_stripe_accounts').update({
      card_payments_status: status,
      details_submitted: !awaitingUser,
      country: account.identity?.country ?? null,
      // Connecting again after a disconnection revives the row rather than inserting beside
      // it — `family_code` is UNIQUE, and the history of charges points at this account id.
      //
      // `connected_at` is deliberately NOT written here. This runs on every refresh, and
      // stamping it each time would move the date the family connected forward to today — a
      // column that answers 'when did this start' quietly answering 'a moment ago', forever.
      disconnected_at: null,
    }).eq('family_code', g.familyCode).eq('stripe_account_id', accountId)
    if (error) {
      console.error(`[processing] could not record the account state for ${g.familyCode}: ${error.message}`)
      return { success: false, message: t('act.couldNotSaveWhatStripe') }
    }

    revalidatePath('/admin/accounting')
    revalidatePath('/accounting/dues-and-donations')
    return {
      success: true,
      message: status === 'active'
        ? 'Card payments are switched on. Members can pay their dues online.'
        : awaitingUser
          ? 'Stripe still needs something from this family. Open Stripe to finish.'
          : 'Stripe is reviewing this account. Nothing more is needed from the family.',
    }
  } catch (e) {
    console.error(`[processing] refresh failed for ${g.familyCode}: ${describe(e)}`)
    return { success: false, message: t('act.couldNotReachStripePlease') }
  }
}

export type DisconnectCodeResult =
  | {
      success: true
      /** Where it went, so the screen can say so. The caller's OWN address. */
      sentTo: string
      /** False when the mail did not go. The UI owes the truth about that. */
      emailed: boolean
      /** `deliveryNote()`'s sentence, or null. */
      note: string | null
      minutes: number
      /** Members who would be cancelled, so the confirmation can name the number. */
      autopayCount: number
    }
  | { success: false; message: string }

/**
 * Email the acting treasurer a code that confirms disconnecting Stripe.
 *
 * ── IT TAKES NO ARGUMENTS, AND THAT IS THE SECURITY DESIGN ─────────────────────────
 * The same two rules `requestFamilyRemovalCode` is built on, and both are ones this codebase
 * has already paid for. NO ADDRESS: this is a `'use server'` export and therefore a public
 * HTTP endpoint, so an address parameter would make it a mail cannon aimed by whoever calls
 * it. And NO FAMILY: the family is resolved from the session, not sent, so a caller cannot
 * mint a challenge against somebody else's.
 *
 * ── IT DOES NOT HAND THE CODE BACK ─────────────────────────────────────────────────
 * The recipient IS the caller, so returning the digits would give one person both factors and
 * make the gate a formality. If the mail fails they are told, and can ask again. That is
 * deliberately unlike `inviteMember`, whose token is for somebody ELSE and must be
 * recoverable.
 *
 * ── WHY DISCONNECTING EARNS A CODE AT ALL ──────────────────────────────────────────
 * Because half of it cannot be undone. Reconnecting is one press and brings the same Stripe
 * account back — but every member's recurring payment is cancelled AT STRIPE on the way out,
 * and a cancelled subscription cannot be un-cancelled. So the screen offers something that
 * looks reversible and is only half so, which is the same shape as removing a family and gets
 * the same two deliberate acts: a password, then a code from a mailbox.
 *
 * ── THE COUNT IS READ HERE AND CARRIED ─────────────────────────────────────────────
 * Both the email and the confirmation name how many relatives would be cancelled, because "4
 * relatives" is a different decision from "nobody". It is read once, at the moment the code is
 * asked for, rather than trusted from the client — and `disconnectProcessor` re-reads it when
 * it actually cancels, so a number that has moved in between costs an out-of-date sentence
 * rather than a missed subscription.
 */
export async function requestProcessorDisconnectCode(): Promise<DisconnectCodeResult> {
  const g = await requireEdit(PROCESSING)
  if (!g.ok) return { success: false, message: g.message }
  const { t } = g
  if (!g.familyCode) return { success: false, message: t('act.youDoNotBelongFamily') }
  if (!g.personId) return { success: false, message: t('act.youDoNotBelongFamily') }

  // The session's own address — read from GoTrue rather than from `people.primary_email`,
  // because a `people` row may legitimately hold a GENERATED placeholder address (§4b) and
  // mailing one is mailing nobody.
  const { user } = await currentUser()
  const to = user?.email?.trim() ?? ''
  if (!to) {
    return { success: false, message: t('act.accountNoEmailAddressSend') }
  }

  const admin = createAdminClient()

  // §3 by hand on both reads: the service role has no RLS, so the `.eq('family_code', …)`
  // from the caller's own membership IS the scoping.
  const { data: family, error: familyError } = await admin
    .from('families')
    .select('family_name')
    .eq('family_code', g.familyCode)
    .maybeSingle()
  if (familyError) {
    console.error(`[processing] could not read families for ${g.familyCode}: ${familyError.message}`)
    return { success: false, message: t('act.couldNotSendCodeJust2') }
  }

  const { count, error: countError } = await admin
    .from('dues_autopay')
    .select('id', { count: 'exact', head: true })
    .eq('family_code', g.familyCode)
    .is('cancelled_at', null)
  // READ, not discarded (§8). A failed count rendered as zero would tell a treasurer nobody
  // is paying automatically at the exact moment they are deciding whether to cancel them all.
  if (countError) {
    console.error(`[processing] could not count autopays for ${g.familyCode}: ${countError.message}`)
    return { success: false, message: t('act.couldNotCheckRecurringPayments') }
  }
  const autopayCount = count ?? 0

  const minted = await mintChallenge(admin, {
    familyCode: g.familyCode,
    personId: g.personId,
    purpose: 'processor_disconnect',
    logTag: '[processing]',
  })
  if (!minted.ok) {
    return { success: false, message: t('act.couldNotSendCodeJust2') }
  }

  const mail = processorDisconnectCodeEmail({
    origin: emailOrigin(),
    familyName: (family?.family_name as string) ?? g.familyCode,
    code: minted.code,
    expiresInMinutes: minted.minutes,
    autopayCount,
    // The caller is the reader — same as the removal code. See that action.
    locale: await resolveLocale(g.userId),
  })
  const sent = await sendEmail({ to, subject: mail.subject, html: mail.html, tag: mail.tag })

  return {
    success: true,
    sentTo: to,
    emailed: sent.sent,
    note: deliveryNote(sent),
    minutes: minted.minutes,
    autopayCount,
  }
}

/**
 * Stop using a family's connected account, and stop charging its members first.
 *
 * ── BEHIND A PASSWORD AND AN EMAILED CODE SINCE 2026-08-25 ─────────────────────────
 * The password is checked in the browser, against a throwaway Supabase client, and is not a
 * gate — this is a public endpoint and the caller already holds the grant. What it buys is
 * protection against an accident and against somebody at an unlocked screen, which is exactly
 * what `PlanPanel` claims for the same step and no more. The CODE is the real second factor:
 * proof that whoever holds this session also holds the mailbox, verified in SQL by
 * `consume_family_action_challenge` under `FOR UPDATE`.
 *
 * ── THE AUTOPAYS ARE CANCELLED, AND THAT ORDER IS THE WHOLE POINT ───────────────────
 * A recurring dues arrangement is a Stripe subscription on the FAMILY's account. Marking the
 * connection as gone without cancelling them would leave relatives being charged every month
 * for a processor the family had removed, with no screen in this product able to show it and
 * — because we would have stopped acting on that account — nothing here able to stop it. The
 * treasurer would be told to go and cancel a dozen subscriptions in a Stripe Dashboard they
 * may never have opened.
 *
 * So the subscriptions go first, one at a time, and the row is marked only if they all did.
 * A partial failure REFUSES the disconnection rather than reporting it: leaving a member
 * charged is worse than leaving a connection in place.
 *
 * ── AND IT DOES NOT CLOSE THEIR STRIPE ACCOUNT ──────────────────────────────────────
 * It cannot and must not. The account belongs to the family; every payout, refund and dispute
 * on it is theirs. This severs OUR use of it. Nothing is deleted — `disconnected_at` is a
 * stamp — because `dues_payments.processor_ref` points at charges on that account forever, and
 * a treasurer asking "what was this payment?" a year later needs the id to still be here.
 */
export async function disconnectProcessor(code: string): Promise<ProcessorActionResult> {
  const g = await requireEdit(PROCESSING)
  if (!g.ok) return { success: false, message: g.message }
  const { t } = g
  if (!g.familyCode) return { success: false, message: t('act.youDoNotBelongFamily') }
  // The challenge is resolved from (family_code, requested_by, purpose), so a caller with no
  // `people` row in this family has nothing to resolve against.
  if (!g.personId) return { success: false, message: t('act.youDoNotBelongFamily') }

  const stripe = stripeClient()
  if (!stripe) return { success: false, message: t('act.onlinePaymentsNotSetUp2') }

  const admin = createAdminClient()

  // ── THE CODE IS SPENT BEFORE ANYTHING IS CANCELLED ────────────────────────────────
  // Order matters and this is the safe direction. Verifying first means a refused code
  // cancels nothing; cancelling first would mean a wrong code leaves the family's members
  // unsubscribed at Stripe with the account still connected — half a disconnection, and the
  // half that cannot be undone.
  //
  // NO CHALLENGE ID CROSSES FROM THE CLIENT. The only argument is the six digits somebody
  // typed; the row is resolved from three values all derived from the session. A guessed code
  // therefore cannot reach another family's challenge, and a code minted to remove the family
  // cannot be spent here — `purpose` is part of the key.
  const typed = (code ?? '').trim()
  const { data: challenge, error: challengeError } = await admin
    .rpc('consume_family_action_challenge', {
      p_family_code: g.familyCode,
      p_person_id: g.personId,
      p_purpose: 'processor_disconnect',
      p_code_hash: hashChallengeCode(typed),
    })
    .maybeSingle<{ ok: boolean; message: string | null; attempts_left: number }>()

  // The error is READ (§8): a refused RPC and a refused CODE are opposite facts and `data`
  // cannot tell them apart — `null` from maybeSingle() is what both look like.
  if (challengeError) {
    console.error(`[processing] could not verify the disconnect code for ${g.familyCode}: ${challengeError.message}`)
    return { success: false, message: t('act.couldNotCheckCodePlease') }
  }
  if (!challenge?.ok) {
    const left = challenge?.attempts_left ?? 0
    return {
      success: false,
      message: (challenge?.message ?? 'That code is not right.')
        + (left > 0 ? ` ${left} ${left === 1 ? 'try' : 'tries'} left.` : ''),
    }
  }

  const { data: row } = await admin
    .from('family_stripe_accounts')
    .select('stripe_account_id')
    .eq('family_code', g.familyCode)
    .maybeSingle()
  const accountId = row?.stripe_account_id as string | undefined
  if (!accountId) return { success: false, message: t('act.familyNotConnectedAccount') }

  const { data: autopays, error: readError } = await admin
    .from('dues_autopay')
    .select('id, stripe_subscription_id')
    .eq('family_code', g.familyCode)
    .is('cancelled_at', null)
  if (readError) {
    return { success: false, message: t('act.couldNotCheckRecurringPayments') }
  }

  let cancelled = 0
  for (const row of autopays ?? []) {
    const subscriptionId = row.stripe_subscription_id as string
    try {
      await stripe.subscriptions.cancel(subscriptionId, undefined, onAccount(accountId))
    } catch (e) {
      // A subscription Stripe no longer has is already cancelled, which is the outcome we
      // wanted — anything else stops the whole disconnection.
      const message = describe(e)
      if (!/No such subscription|resource_missing/i.test(message)) {
        console.error(`[processing] could not cancel ${subscriptionId} for ${g.familyCode}: ${message}`)
        return {
          success: false,
          message: t('act.someMembersStillBeingCharged'),
        }
      }
    }
    await admin.from('dues_autopay')
      .update({ cancelled_at: new Date().toISOString(), status: 'canceled' })
      .eq('id', row.id)
      .eq('family_code', g.familyCode)
    cancelled += 1
  }

  const { error } = await admin.from('family_stripe_accounts')
    .update({ disconnected_at: new Date().toISOString() })
    .eq('family_code', g.familyCode)
    .eq('stripe_account_id', accountId)
  if (error) {
    return { success: false, message: t('act.couldNotDisconnectPleaseTry') }
  }

  revalidatePath('/admin/accounting')
  revalidatePath('/accounting/dues-and-donations')
  return {
    success: true,
    message: cancelled > 0
      ? t(cancelled === 1
          ? 'proc.disconnectedStoppedOne'
          : 'proc.disconnectedStoppedMany', { n: String(cancelled) })
      : 'Disconnected. Every payment already recorded is kept.',
  }
}

// ── Internals ───────────────────────────────────────────────────────────────────────

/**
 * The family's connected account, created once and revived rather than duplicated.
 *
 * ONE ACCOUNT PER FAMILY, and `family_code` is UNIQUE so the database agrees. A second one
 * would split a family's dues across two bank accounts with no screen able to say which
 * payments went where — and `dues_payments.processor_ref` would point at charges on an account
 * nothing in the product still names.
 */
async function ensureConnectedAccount(
  admin: AdminClient,
  stripe: NonNullable<ReturnType<typeof stripeClient>>,
  input: { familyCode: string; personId: string | null; country: string },
): Promise<string | null> {
  const { data: existing } = await admin
    .from('family_stripe_accounts')
    .select('stripe_account_id')
    .eq('family_code', input.familyCode)
    .maybeSingle()
  if (typeof existing?.stripe_account_id === 'string') return existing.stripe_account_id

  const { data: family } = await admin
    .from('families').select('family_name').eq('family_code', input.familyCode).maybeSingle()

  try {
    const account = await stripe.v2.core.accounts.create({
      // Shown in the family's own Dashboard and on invoices Stripe sends them.
      display_name: (family?.family_name as string | undefined) ?? input.familyCode,
      dashboard: 'full',
      // ── REQUIRED, NOT OPTIONAL, AND THE ACCOUNT CANNOT BE CREATED WITHOUT IT ──────
      // Stripe answers `identity_country_required` for any account requesting the merchant
      // configuration — which this one does, on the line below.
      //
      // THE FAMILY'S ANSWER, since 2026-08-31, validated by the caller against
      // `isEnabledConnectCountry`. It was the constant `'us'` for every family, including the
      // Canadian ones `lib/regions.ts` already admits — and it cannot be changed afterwards,
      // so that was permanent rather than merely wrong.
      //
      // `entity_type` is deliberately absent: Stripe asks the family during onboarding, and
      // it decides how the whole account is validated, so a guess here is worse than a
      // question there.
      identity: { country: input.country },
      defaults: {
        responsibilities: { fees_collector: 'stripe', losses_collector: 'stripe' },
      },
      configuration: {
        merchant: { capabilities: { card_payments: { requested: true } } },
      },
      metadata: { genorra_family_code: input.familyCode },
      // `identity` as well as the merchant configuration, so `account.identity.country` comes
      // back and the row below can record it. `include` is what decides whether a field is on
      // the response at all — omit it and the field is silently `undefined`, which is how the
      // `country` column came to be written as null on every refresh. See the same list in
      // `refreshProcessorStatus`.
      include: ['configuration.merchant', 'identity'],
    }, { idempotencyKey: intentKey(['connect-account', input.familyCode]) })

    // ── THE ROW IS WRITTEN BEFORE THE FAMILY SEES THE LINK ──────────────────────────
    // If this fails, the account exists in Stripe and we know nothing about it — so the next
    // attempt would create a second one. Refusing here leaves an orphan account nobody
    // onboarded (harmless, and visible in our own Dashboard) rather than a family with two.
    const { error } = await admin.from('family_stripe_accounts').upsert({
      family_code: input.familyCode,
      stripe_account_id: account.id,
      connected_by: input.personId,
      connected_at: new Date().toISOString(),
      disconnected_at: null,
      card_payments_status:
        account.configuration?.merchant?.capabilities?.card_payments?.status ?? null,
      // Recorded at creation rather than waiting for the first refresh. It is the value the
      // family CHOSE, echoed back by Stripe — so this column is how a family created before
      // the picker (always `us`) stays distinguishable from one that answered, which is
      // exactly the thing somebody will need to be able to see. Stripe's echo rather than
      // `input.country`, because if the two ever differ Stripe's is the account's truth.
      country: account.identity?.country ?? null,
    }, { onConflict: 'family_code' })
    if (error) {
      console.error(`[processing] could not record account ${account.id} for ${input.familyCode}: ${error.message}`)
      return null
    }
    return account.id
  } catch (e) {
    console.error(`[processing] account creation failed for ${input.familyCode}: ${describe(e)}`)
    return null
  }
}

function describe(e: unknown): string {
  return e instanceof Error ? e.message : String(e)
}

/**
 * Say who bears Stripe's processing fee, and at what stated rate.
 *
 * ── IT CHANGES WHAT A MEMBER IS CHARGED, SO IT IS `requireEdit` AND NOTHING LESS ────
 * Switching to `'member'` makes every subsequent card payment cost the payer more than the
 * due says. That is a decision about the family's money and about its relatives' money, and it
 * sits behind the same grant as connecting and disconnecting the account itself.
 *
 * ── IT IS NOT RETROSPECTIVE, AND CANNOT BE ─────────────────────────────────────────
 * The surcharge is decided when the Checkout Session is CREATED, so this only affects payments
 * started after it is saved. A member sitting on Stripe's hosted page when a treasurer flips
 * the switch pays what they were quoted — which is the only defensible answer, and the reason
 * `readyProcessor` reads the policy in the same query as the account id rather than in a
 * second one.
 *
 * ── THE RATE IS A QUOTE, NEVER A RECORD ────────────────────────────────────────────
 * `lib/stripe-fees.ts` states it at length: what is typed here decides what to CHARGE, and
 * what lands in the ledger is `balance_transaction.fee`, measured. They differ for an
 * international card, an Amex or a negotiated rate, and the family absorbs the difference —
 * so a rate typed too low is not an error, it is the family quietly paying a few cents per
 * payment. The panel shows what has actually been paid beside the box for that reason.
 *
 * ── AND THE SERVICE ROLE, WITH §3 BY HAND ──────────────────────────────────────────
 * `family_stripe_accounts` has RLS enabled and ZERO policies (`20260823000005`), so there is
 * no policy underneath this and the `.eq('family_code', …)` IS the family boundary — the
 * `editPersonRecord` situation, one table along.
 */
export async function setProcessingFeePolicy(input: {
  feePayer: 'family' | 'member'
  feePercentBps: number
  feeFixedCents: number
}): Promise<ProcessorActionResult> {
  const g = await requireEdit(PROCESSING)
  if (!g.ok) return { success: false, message: g.message }
  const { t } = g
  if (!g.familyCode) return { success: false, message: t('act.youDoNotBelongFamily') }

  // A `'use server'` export is a public HTTP endpoint, so the union in the signature is a type
  // and not a check. Anything but the one value is read as the absorbing case rather than
  // refused: the caller is a two-option control, and the safe direction is unambiguous.
  const feePayer = input.feePayer === 'member' ? 'member' : 'family'

  // ── THE SAME BOUNDS THE CHECK CONSTRAINT STATES, CHECKED HERE FOR THE MESSAGE ─────
  // The database refuses these anyway (`family_stripe_accounts_fee_rate_sane`), which is what
  // makes them safe. Repeating them is so a slipped decimal produces a sentence naming the
  // field rather than a raw 23514 the treasurer has to interpret — the same reason
  // `assignBoardPosition` re-checks what its trigger enforces.
  const percentBps = Math.round(Number(input.feePercentBps))
  const fixedCents = Math.round(Number(input.feeFixedCents))
  if (!Number.isFinite(percentBps) || percentBps < 0 || percentBps > 5000) {
    return { success: false, message: t('act.feePercentOutOfRange') }
  }
  if (!Number.isFinite(fixedCents) || fixedCents < 0 || fixedCents > 1000) {
    return { success: false, message: t('act.feeFixedOutOfRange') }
  }

  const { data, error } = await createAdminClient()
    .from('family_stripe_accounts')
    .update({ fee_payer: feePayer, fee_percent_bps: percentBps, fee_fixed_cents: fixedCents })
    .eq('family_code', g.familyCode)
    // §8b: the row exists only once a family has connected an account, so a caller who has not
    // matches zero rows — and `{ error: null }` over nothing would report success for a
    // setting that was never stored. `.select()` is what tells the two apart.
    .select('id')

  if (error) {
    console.error(`[processing] fee policy update failed for ${g.familyCode}: ${error.message}`)
    return { success: false, message: t('act.couldNotSaveFeePolicy') }
  }
  if (!data || data.length === 0) {
    return { success: false, message: t('act.familyNotConnectedAccountYet') }
  }

  revalidatePath('/admin/accounting')
  revalidatePath('/accounting/dues-and-donations')
  return { success: true, message: t('act.feePolicySaved') }
}
