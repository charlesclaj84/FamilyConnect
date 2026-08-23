'use server'

import { revalidatePath } from 'next/cache'

import { createAdminClient } from '@/lib/supabase/admin'
import { requireEdit, requireRead } from '@/lib/auth/guard'
import { SECTION_RESOURCE } from '@/components/admin/account-sections'
import { intentKey, onAccount, stripeClient, stripeUnavailableReason } from '@/lib/stripe/client'
import { connectConfigured } from '@/lib/stripe/config'
import { SITE_URL } from '@/lib/site'

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
}

export async function getProcessorStatus(): Promise<ProcessorStatus | null> {
  const g = await requireRead(PROCESSING)
  if (!g.ok || !g.familyCode) return null

  const admin = createAdminClient()
  const [accountRes, autopayRes, editable] = await Promise.all([
    admin.from('family_stripe_accounts')
      .select('stripe_account_id, card_payments_status, details_submitted, connected_at, disconnected_at')
      .eq('family_code', g.familyCode)
      .maybeSingle(),
    admin.from('dues_autopay')
      .select('id', { count: 'exact', head: true })
      .eq('family_code', g.familyCode)
      .is('cancelled_at', null),
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
export async function startProcessorOnboarding(): Promise<ProcessorLinkResult> {
  const g = await requireEdit(PROCESSING)
  if (!g.ok) return { success: false, message: g.message }
  if (!g.familyCode) return { success: false, message: 'You do not belong to a family yet.' }

  const unavailable = stripeUnavailableReason()
  if (unavailable) return { success: false, message: unavailable }
  if (!connectConfigured()) {
    return { success: false, message: 'Online payments are not set up on this deployment yet.' }
  }
  const stripe = stripeClient()
  if (!stripe) return { success: false, message: 'Online payments are not set up yet.' }

  const admin = createAdminClient()
  const accountId = await ensureConnectedAccount(admin, stripe, {
    familyCode: g.familyCode,
    personId: g.personId,
  })
  if (!accountId) {
    return { success: false, message: 'Could not start setting up payments. Please try again.' }
  }

  try {
    const link = await stripe.v2.core.accountLinks.create({
      account: accountId,
      use_case: {
        type: 'account_onboarding',
        account_onboarding: {
          // ONLY the merchant configuration. Asking for more is asking the family for more.
          configurations: ['merchant'],
          // Back to this action, which mints a fresh link. See the header.
          refresh_url: `${SITE_URL}/admin/accounting?section=processing&connect=refresh`,
          return_url: `${SITE_URL}/admin/accounting?section=processing&connect=return`,
        },
      },
    })
    return { success: true, url: link.url }
  } catch (e) {
    console.error(`[processing] account link failed for ${g.familyCode}: ${describe(e)}`)
    return { success: false, message: 'Could not open Stripe onboarding. Please try again.' }
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
 */
export async function refreshProcessorStatus(): Promise<ProcessorActionResult> {
  const g = await requireEdit(PROCESSING)
  if (!g.ok) return { success: false, message: g.message }
  if (!g.familyCode) return { success: false, message: 'You do not belong to a family yet.' }

  const stripe = stripeClient()
  if (!stripe) return { success: false, message: 'Online payments are not set up yet.' }

  const admin = createAdminClient()
  const { data: row } = await admin
    .from('family_stripe_accounts')
    .select('stripe_account_id')
    .eq('family_code', g.familyCode)
    .maybeSingle()
  const accountId = row?.stripe_account_id as string | undefined
  if (!accountId) return { success: false, message: 'This family has not connected an account yet.' }

  try {
    const account = await stripe.v2.core.accounts.retrieve(accountId, {
      include: ['configuration.merchant', 'requirements'],
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
      return { success: false, message: 'Could not save what Stripe told us. Please try again.' }
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
    return { success: false, message: 'Could not reach Stripe. Please try again.' }
  }
}

/**
 * Stop using a family's connected account, and stop charging its members first.
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
export async function disconnectProcessor(): Promise<ProcessorActionResult> {
  const g = await requireEdit(PROCESSING)
  if (!g.ok) return { success: false, message: g.message }
  if (!g.familyCode) return { success: false, message: 'You do not belong to a family yet.' }

  const stripe = stripeClient()
  if (!stripe) return { success: false, message: 'Online payments are not set up yet.' }

  const admin = createAdminClient()
  const { data: row } = await admin
    .from('family_stripe_accounts')
    .select('stripe_account_id')
    .eq('family_code', g.familyCode)
    .maybeSingle()
  const accountId = row?.stripe_account_id as string | undefined
  if (!accountId) return { success: false, message: 'This family has not connected an account.' }

  const { data: autopays, error: readError } = await admin
    .from('dues_autopay')
    .select('id, stripe_subscription_id')
    .eq('family_code', g.familyCode)
    .is('cancelled_at', null)
  if (readError) {
    return { success: false, message: 'Could not check for recurring payments. Please try again.' }
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
          message: 'Some members are still being charged automatically and we could not stop it. Nothing has been disconnected — please try again.',
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
    return { success: false, message: 'Could not disconnect. Please try again.' }
  }

  revalidatePath('/admin/accounting')
  revalidatePath('/accounting/dues-and-donations')
  return {
    success: true,
    message: cancelled > 0
      ? `Disconnected, and ${cancelled} recurring payment${cancelled === 1 ? '' : 's'} stopped. Every payment already recorded is kept.`
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
  input: { familyCode: string; personId: string | null },
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
      defaults: {
        responsibilities: { fees_collector: 'stripe', losses_collector: 'stripe' },
      },
      configuration: {
        merchant: { capabilities: { card_payments: { requested: true } } },
      },
      metadata: { genorra_family_code: input.familyCode },
      include: ['configuration.merchant'],
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
