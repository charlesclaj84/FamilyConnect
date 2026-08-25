'use server'

import { revalidatePath } from 'next/cache'

import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { requireEdit, requireRead } from '@/lib/auth/guard'
import { FAMILY_RESOURCE } from '@/components/admin/family-settings'
import { TIER_IS_SOLD, TIER_PRICE } from '@/lib/plans'
import { formatCurrency } from '@/lib/currency-utils'
import { TIER_LABEL, TIER_RANK, isFamilyTier, type FamilyTier } from '@/lib/tiers'
import {
  MAX_PREPAY_MONTHS, NO_PLATFORM_BILLING, addDays, daysBetween, entitlementOn,
  initialChargeOptions, isPrepayMonths, nextFirstOfMonth, prepayQuoteCents,
  prorateRemainderCents, scheduleDowngrade, stripeTrialEnd, tierMove, upgradeQuote,
  type BillingMode, type PlatformBillingRecord,
} from '@/lib/platform-billing'
import { signupPlanPrompt, type SignupPlanPrompt } from '@/lib/signup-plan'
import { intentKey, stripeClient, stripeUnavailableReason } from '@/lib/stripe/client'
import {
  INTEGRATION_IDS, checkoutReturnUrls, platformBillingConfigured,
  platformPriceId,
} from '@/lib/stripe/config'
// A PLAIN MODULE, imported and never re-exported — everything exported from a `'use server'`
// file gets a URL, and `trackCheckoutStarted` takes an email and a name (lib/email/send.ts'
// open-relay rule, applied to the analytics transport).
import { trackCheckoutStarted } from '@/lib/meta/billing'

/**
 * A family paying GENORRA for its plan — the hosted-checkout half.
 *
 * ── WHAT THIS FILE MAY AND MAY NOT DO ───────────────────────────────────────────────
 * It may create a Stripe Checkout Session, update a subscription, and WRITE A PROMISE
 * (`scheduled_tier`). It may NOT decide that a family has paid.
 *
 * Nothing here writes `families.tier`, and nothing here writes `paid_through`. Those move in
 * exactly two places — the webhook, after Stripe says the money moved, and
 * `apply_due_platform_tier_changes()`, when a term ends. That is not fastidiousness: the
 * failure it prevents is the one Stripe's own guidance names first, and
 * `lib/meta/billing.ts` already carries the sharpest statement of it —
 *
 *     *"the button press is not the payment."*
 *
 * A member can press Pay, be redirected, abandon the hosted page, and come back. They can pay
 * and lose the connection before the return page loads. A delayed payment method can complete
 * the session while it is still unpaid and fail three days later. In every one of those the
 * action has run and no money has arrived, so an action that granted the tier would be giving
 * the product away to anybody who could reach the endpoint — which is everybody signed in,
 * because a server action is a public HTTP endpoint.
 *
 * ── TWO GATES, AND BOTH ARE DELIBERATE ──────────────────────────────────────────────
 *   `admin/settings:edit`   the permission. Choosing and paying for a plan is the same
 *                           decision as `setFamilyTier`, and it rides the same key rather
 *                           than inventing one — see `getPlatformBilling` for why.
 *   `TIER_IS_SOLD[tier]`    the PRODUCT decision, and it is still consulted after Standard
 *                           and Plus went on sale on 2026-08-23 — because Premium has not.
 *                           A checkout that took money while `/pricing` said "Not yet
 *                           available" would be a sale nobody made, so this flag and
 *                           `PLANS[].available` move in one commit, in both directions.
 *
 *                           IT IS NOT THE CAPABILITY. A tier can be sold here and have no
 *                           Stripe Price on this deployment, which is the ordinary state of
 *                           a laptop — hence `platformBillingConfigured` two lines below
 *                           every one of these checks, answering with a sentence about the
 *                           deployment rather than a claim about the plan.
 *
 * ── AND `setFamilyTier` IS STILL THERE, WHICH IS A COLLISION WORTH KNOWING ABOUT ────
 * That action has been scaffolding since 2026-08-13: pick a plan, nothing is charged. It now
 * refuses while a family has a live paid term, because otherwise an administrator could move
 * themselves down to Free by hand on Tuesday, keep every page (nothing revokes anything until
 * the term ends), and have the sweep put them back up on Wednesday. Its own header carries
 * that; the point here is that these two are two doors into one column and only one of them
 * has money behind it.
 */

type AdminClient = ReturnType<typeof createAdminClient>

/** How much of the plan panel is real on this deployment, per tier. */
export interface TierPurchasability {
  /** A monthly subscription can be started. */
  recurring: boolean
  /** N months can be bought outright. */
  prepaid: boolean
}

export interface PlatformBilling extends PlatformBillingRecord {
  familyCode: string
  /** The tier `families.tier` currently says — what every gate in the product reads. */
  activeTier: FamilyTier
  /** What the billing record says has been PAID for, which can differ. See below. */
  paidEntitlement: ReturnType<typeof entitlementOn>
  canManage: boolean
  /** Per tier, whether a checkout can actually be started. */
  purchasable: Record<FamilyTier, TierPurchasability>
  /**
   * The plan chosen at signup, if the family is still owed that checkout.
   *
   * NOT AN ENTITLEMENT, and it must never be read as one — `activeTier` is what the product
   * enforces and this is a note about a button somebody pressed on `/pricing` before there
   * was a family to charge. See 20260823000008's header and `lib/signup-plan.ts`.
   */
  signupPlan: SignupPlanPrompt
  /** Set when the deployment cannot transact at all, for a sentence on screen. */
  unavailable: string | null
  /**
   * The day a card payment started failing, or null.
   *
   * REPORTED AND NOT ACTED ON. Stripe retries for days, so nothing in the product changes on
   * the strength of this — see `lib/stripe/platform-events.ts` and the delinquency item in
   * TODO.md. It is on this shape so the panel can say so out loud rather than leaving a family
   * to find out from their bank.
   */
  delinquentSince: string | null
  /** The most recent payments, newest first. Our receipts, never the family's ledger. */
  payments: PlatformPaymentRow[]
  /**
   * Today, `YYYY-MM-DD`, RESOLVED ON THE SERVER.
   *
   * The panel needs it to quote a part month — how many days are left, and what they cost —
   * and a browser's own clock is the wrong one to ask. A family in Auckland on the 1st is
   * still on the 31st in UTC, so a client-side `new Date()` would quote a whole month while
   * `startPlanCheckout` charged one day, or the reverse. One clock, and it is the one that
   * takes the money.
   */
  today: string
}

export interface PlatformPaymentRow {
  id: string
  kind: 'subscription' | 'prepaid'
  tier: FamilyTier
  months: number
  amountCents: number
  currency: string
  coversFrom: string | null
  coversThrough: string | null
  paidAt: string
}

/**
 * Everything the plan panel shows.
 *
 * ── NO NEW PERMISSION KEY, AND THAT IS A DECISION ───────────────────────────────────
 * This rides `admin/settings`, the key that already gates Family Settings and its Plan pane.
 * AGENTS.md's test for whether two things want two keys is whether a family could sensibly
 * hold one and withhold the other, and here they could not: choosing the plan and paying for
 * the plan are one job, done by one person, on one screen. A second key would be a switch an
 * administrator had to set to make the pane they were already looking at work.
 *
 * What that costs is that the payment HISTORY is visible to anybody holding the Family
 * Settings view grant. That is the right audience — these are GENORRA's invoices to the
 * family, not a member's own money and not anything about another member — and there is
 * nothing in a row here that a family's own administrator should be kept from.
 *
 * ── THE ADMIN CLIENT, AND §3 DISCHARGED BY HAND ─────────────────────────────────────
 * `platform_billing_accounts` and `platform_payments` have RLS enabled and ZERO policies
 * (§2c), so the user client can read neither. Both reads therefore go through the service
 * role with `.eq('family_code', …)` written out — the obligation §3 puts on every
 * service-role query, and the only thing scoping these at all.
 *
 * ── `activeTier` AND `paidEntitlement` CAN DISAGREE, ON PURPOSE ─────────────────────
 * `families.tier` is what the product ENFORCES; the billing record is what was PAID. They
 * diverge for a few minutes after a webhook, and for longer when a prepaid term has lapsed
 * and nothing has swept yet (there is no scheduler — see the sweep's own header). Both are
 * returned rather than reconciled here, because a screen that showed one number would be
 * hiding exactly the discrepancy somebody needs to see.
 */
export async function getPlatformBilling(): Promise<PlatformBilling | null> {
  const g = await requireRead(FAMILY_RESOURCE)
  if (!g.ok || !g.familyCode) return null

  const admin = createAdminClient()
  const [accountRes, paymentsRes, familyRes, editable] = await Promise.all([
    admin.from('platform_billing_accounts')
      .select('*')
      .eq('family_code', g.familyCode)
      .maybeSingle(),
    admin.from('platform_payments')
      .select('id, kind, tier, months, amount_cents, currency, covers_from, covers_through, paid_at')
      .eq('family_code', g.familyCode)
      .order('paid_at', { ascending: false })
      .limit(24),
    admin.from('families').select('tier').eq('family_code', g.familyCode).maybeSingle(),
    // Read the write grant here so the panel is not FETCHED differently from how it renders
    // (§5). `requireEdit` re-checks it at every write; this only shapes the UI.
    requireEdit(FAMILY_RESOURCE).then(r => r.ok),
  ])

  // §8: `const { data }` discards the error, and a refused read then renders as "this family
  // has never paid" over a family that has. The account read is the one that matters — a null
  // here is indistinguishable from a family with no billing row — so it is reported rather
  // than folded into the empty case.
  if (accountRes.error) {
    console.error(`[billing] could not read the billing record for ${g.familyCode}: ${accountRes.error.message}`)
    return null
  }

  const record = readRecord(accountRes.data)
  const today = todayISO()
  const activeTier = isFamilyTier(familyRes.data?.tier) ? familyRes.data.tier : 'free'
  const row = accountRes.data as SignupIntentRow | null

  return {
    ...record,
    familyCode: g.familyCode,
    activeTier,
    paidEntitlement: entitlementOn(record, today),
    canManage: editable,
    purchasable: purchasability(),
    // The plan they chose on `/register` and have not paid for yet, or a skip reason.
    // ONE DEFINITION, in `lib/signup-plan.ts`, shared with the dashboard banner — so the
    // panel and the banner can never disagree about whether a family is still being asked.
    signupPlan: signupPlanPrompt({
      signupTier: row?.signup_tier,
      signupTierAt: row?.signup_tier_at,
      dismissedAt: row?.signup_tier_dismissed_at,
      activeTier,
      today,
    }),
    today,
    unavailable: stripeUnavailableReason(),
    delinquentSince: typeof (accountRes.data as { delinquent_since?: unknown } | null)?.delinquent_since === 'string'
      ? (accountRes.data as { delinquent_since: string }).delinquent_since
      : null,
    payments: (paymentsRes.data ?? []).flatMap(row =>
      isFamilyTier(row.tier)
        ? [{
            id: row.id as string,
            kind: row.kind === 'prepaid' ? 'prepaid' as const : 'subscription' as const,
            tier: row.tier,
            months: row.months as number,
            amountCents: row.amount_cents as number,
            currency: row.currency as string,
            coversFrom: row.covers_from as string | null,
            coversThrough: row.covers_through as string | null,
            paidAt: row.paid_at as string,
          }]
        : []),
  }
}

export type CheckoutResult =
  | { success: true; url: string }
  | { success: false; message: string }

/**
 * Start a hosted checkout for a plan, and hand back the URL to send the browser to.
 *
 * ── HOSTED, NOT EMBEDDED, AND THE REASON IS NOT LAZINESS ────────────────────────────
 * Stripe's own preference order puts hosted Checkout above the Payment Element for most web
 * apps, and for this product it is the clear answer: there is no publishable key to ship, no
 * Stripe.js in the client bundle, no `frame-src`/`script-src` CSP work in `next.config.ts`,
 * and no card data anywhere near a page that also renders family trees. The entire client
 * side of this feature is `window.location.href = url`.
 *
 * ── `payment_method_types` IS NOT PASSED. THAT IS DELIBERATE ────────────────────────
 * Omitting it is what enables dynamic payment methods — Stripe picks what to show from the
 * Dashboard settings and the buyer's own context. Hardcoding `['card']` is the trap Stripe's
 * guidance names explicitly, and it would lock out every method that improves conversion for
 * no benefit at all.
 *
 * ── TWO SHAPES, ONE ENTRY POINT ─────────────────────────────────────────────────────
 *   'recurring'  `mode: 'subscription'`, quantity 1, renews monthly.
 *   'prepaid'    `mode: 'payment'` on a ONE-TIME price whose unit is one month, bought
 *                `months` times — with `adjustable_quantity` so the family can change their
 *                mind on Stripe's own page. Which is why the webhook reads the quantity BACK
 *                off the completed session and never trusts the number sent here.
 */
export async function startPlanCheckout(input: {
  tier: string
  mode: string
  months?: number
  /** Monthly path only: `'remainder'` or `'remainder-plus-next'`. See below. */
  firstPayment?: string
}): Promise<CheckoutResult> {
  const g = await requireEdit(FAMILY_RESOURCE)
  if (!g.ok) return { success: false, message: g.message }
  if (!g.familyCode) return { success: false, message: 'You do not belong to a family yet.' }

  // NARROWED, NEVER CAST. This is a `'use server'` export, so every argument arrives from an
  // HTTP request and the panel in front of it is a convenience (§2).
  if (!isFamilyTier(input.tier) || input.tier === 'free') {
    return { success: false, message: 'That is not a plan that can be bought.' }
  }
  const tier = input.tier
  if (input.mode !== 'recurring' && input.mode !== 'prepaid') {
    return { success: false, message: 'Choose whether to pay monthly or in advance.' }
  }
  const mode: BillingMode = input.mode
  const months = mode === 'prepaid' ? (input.months ?? 6) : 1
  if (mode === 'prepaid' && !isPrepayMonths(months)) {
    return {
      success: false,
      message: `Choose between 1 and ${MAX_PREPAY_MONTHS} months.`,
    }
  }
  // ── WHICH FIRST PAYMENT, ON THE MONTHLY PATH ──────────────────────────────────────
  // 'remainder' pays the rest of this month and bills on the 1st. 'remainder-plus-next'
  // pays the rest of this month AND the whole of next, and bills on the 1st after that —
  // which is the option that matters at the end of a month, when the remainder alone is a
  // few days. Narrowed rather than defaulted silently: an unrecognised value is a caller
  // bug, and picking one for them would charge a family something they did not choose.
  if (input.firstPayment != null
      && input.firstPayment !== 'remainder'
      && input.firstPayment !== 'remainder-plus-next') {
    return { success: false, message: 'Choose which first payment to make.' }
  }
  const firstPayment = input.firstPayment ?? 'remainder'

  if (!TIER_IS_SOLD[tier]) {
    return { success: false, message: `${TIER_LABEL[tier]} is not on sale yet.` }
  }
  const unavailable = stripeUnavailableReason()
  if (unavailable) return { success: false, message: unavailable }
  if (!platformBillingConfigured(tier, mode)) {
    return { success: false, message: `${TIER_LABEL[tier]} cannot be bought this way yet.` }
  }

  const stripe = stripeClient()
  const priceId = platformPriceId(tier, mode)
  if (!stripe || !priceId) return { success: false, message: 'Online payments are not set up yet.' }

  // ── IS THE PRICE THE RIGHT SHAPE? ASKED BEFORE THE SESSION, NOT AFTER ─────────────
  //
  // Added 2026-08-23, after the first real checkout against a Stripe sandbox answered "Could
  // not start the payment. Please try again." — which is the catch at the end of this
  // function reporting a PERMANENT misconfiguration as a transient failure. Retrying was
  // never going to work, and Stripe's own message (the useful one) is deliberately withheld
  // because it names a price id and an account.
  //
  // So the shape is checked here instead, where the failure can be described without naming
  // anything: which plan, which way of paying, and that nothing was charged.
  const shapeError = await priceShapeError(stripe, priceId, tier, mode)
  if (shapeError) {
    // The DETAIL, with the id, goes to the log — the same split the catch below makes.
    console.error(`[billing] price ${priceId} unusable for ${tier}/${mode}: ${shapeError.detail}`)
    return { success: false, message: shapeError.message }
  }

  const admin = createAdminClient()
  const record = await loadRecord(admin, g.familyCode)

  // ── REFUSALS THAT PROTECT THE FAMILY FROM BEING BILLED TWICE ──────────────────────
  // A live subscription plus a prepaid purchase is two overlapping terms for one family, and
  // `paid_through` can only describe one of them. The subscription is the thing to change, so
  // say so rather than taking the money and leaving somebody to notice.
  if (mode === 'prepaid' && record.stripe_subscription_id && record.mode === 'recurring') {
    return {
      success: false,
      message: 'This family pays monthly. Cancel the monthly plan first, then pay in advance from the next period.',
    }
  }
  if (mode === 'recurring' && record.stripe_subscription_id && record.mode === 'recurring') {
    return {
      success: false,
      message: 'This family already pays monthly. Use Change plan instead of starting a second subscription.',
    }
  }
  if (mode === 'prepaid' && tierMove(toRecord(record).paidTier, tier) === 'downgrade') {
    return {
      success: false,
      message: `Moving down to ${TIER_LABEL[tier]} costs nothing — use Change plan. It takes effect when the term you have paid for ends.`,
    }
  }

  const customerId = await ensureCustomer(admin, stripe, {
    familyCode: g.familyCode,
    existing: record.stripe_customer_id,
  })
  if (!customerId) return { success: false, message: 'Could not start the payment. Please try again.' }

  // Metadata carried on everything the webhook might see it on. It is OURS — set here, never
  // client-supplied — and it is still re-verified on the way back in: it round-trips through
  // an external system and survives a Dashboard edit by anybody with access to our account.
  const metadata = {
    genorra_flow: 'platform',
    genorra_family_code: g.familyCode,
    genorra_tier: tier,
    genorra_mode: mode,
  }

  // ── THE PART MONTH, AND WHEN THE CYCLE STARTS ─────────────────────────────────────
  //
  // A family with a LIVE paid term already owns the rest of this month, so there is no part
  // month to sell them — that is the case which would otherwise be charged twice, once by the
  // term they already bought and once by this session.
  const today = todayISO()
  const extendingLiveTerm =
    record.paid_through != null && daysBetween(today, record.paid_through) >= 0

  let prorationCents: number | null = null
  if (!extendingLiveTerm) {
    if (mode === 'prepaid') {
      // THE RAW PRORATION, not the floored one. Stripe's minimum applies to the SESSION
      // total, and a prepaid session also carries whole months — so a 33c part month is
      // perfectly chargeable here even though it could not stand alone.
      prorationCents = prorateRemainderCents(tier, today)
    } else {
      const options = initialChargeOptions(tier, today)
      prorationCents = firstPayment === 'remainder-plus-next'
        ? options.remainderPlusNext
        : options.remainderOnly
      if (prorationCents == null) {
        // Only reachable for 'remainder' below Stripe's minimum, which is the ordinary state
        // in the last days of a month on the cheaper tiers. Named rather than described: the
        // family is being told which control to press, not that something failed.
        return {
          success: false,
          message: `Only ${options.daysLeft} day${options.daysLeft === 1 ? '' : 's'} are left this month, which is too small a charge to take on its own. Choose the option that covers this month and next.`,
        }
      }
    }
  }

  const prorationLine = prorationCents != null && prorationCents > 0
    ? {
        quantity: 1,
        price_data: {
          currency: 'usd',
          unit_amount: prorationCents,
          product_data: {
            name: firstPayment === 'remainder-plus-next' && mode === 'recurring'
              ? `${TIER_LABEL[tier]} — rest of this month and next`
              : `${TIER_LABEL[tier]} — rest of this month`,
          },
        },
      }
    : null

  // ── WHEN THE SUBSCRIPTION STARTS BILLING, EXPRESSED AS A TRIAL ────────────────────
  //
  // The days above are already paid for by the line item, so the subscription itself has
  // nothing to charge until the 1st — and `trial_end` is the only way to say that in a
  // Checkout Session carrying a one-time price. See `STRIPE_MINIMUM_TRIAL_DAYS`, which
  // records what the alternative was and why Stripe refuses it.
  //
  //   extendingLiveTerm      the day after the prepaid term ends, which under rule 2 is
  //                          itself a 1st.
  //   'remainder-plus-next'  the 1st AFTER next, because next month is paid for in this
  //                          session and the cycle has to skip it.
  //   otherwise              the next 1st.
  //
  // The cycle then anchors to the trial end, so every invoice after it lands on the 1st with
  // no `billing_cycle_anchor` of our own.
  //
  // NULL FOR A PREPAID SESSION, which has no subscription and therefore nothing to defer: the
  // whole term is the one payment, and `subscription_data` is never sent.
  const billingStartsOn = mode !== 'recurring'
    ? null
    : extendingLiveTerm
      ? (record.paid_through ? addDays(record.paid_through, 1) : null)
      : firstPayment === 'remainder-plus-next'
        ? nextFirstOfMonth(nextFirstOfMonth(today))
        : nextFirstOfMonth(today)
  const trialEnd = billingStartsOn ? stripeTrialEnd(billingStartsOn, today) : null

  // A part month charged HERE while the subscription starts billing TODAY is the double-bill
  // this whole arrangement exists to prevent, so it is refused rather than started.
  //
  // Unreachable at today's figures, and stated rather than assumed for that reason:
  // `MINIMUM_FIRST_CHARGE_CENTS` withholds the remainder option long before the 1st is close
  // enough for Stripe to refuse the trial (six days out at Premium, sixteen at Standard), and
  // the combined option is a whole month further. Lowering that constant, or pricing a tier
  // high enough that a couple of days clears $5, would otherwise reintroduce a silent double
  // charge — `stripeTrialEnd`'s own test asserts the coupling across every tier and month.
  if (mode === 'recurring' && prorationLine && trialEnd == null) {
    return {
      success: false,
      message: 'Too few days are left this month to start a monthly plan today. Choose the option that covers this month and next.',
    }
  }

  try {
    const session = await stripe.checkout.sessions.create({
      mode: mode === 'recurring' ? 'subscription' : 'payment',
      customer: customerId,
      // Shown in the Dashboard beside the payment, so a support question does not start with
      // "which family is this?".
      client_reference_id: g.familyCode,
      line_items: [
        mode === 'recurring'
          ? { price: priceId, quantity: 1 }
          : {
              price: priceId,
              quantity: months,
              // PAY AS FAR AHEAD AS YOU LIKE, on Stripe's own page. The presets on our screen
              // are buttons; this is the field that makes five months possible without us
              // building a stepper. Capped at `MAX_PREPAY_MONTHS`, which also caps how long a
              // downgrade can be deferred — see that constant.
              adjustable_quantity: { enabled: true, minimum: 1, maximum: MAX_PREPAY_MONTHS },
            },
        // ── THE PART MONTH, AS OUR OWN LINE, AND ONLY WHEN IT IS OWED ─────────────────
        // Every family bills on the 1st, so the first payment includes the rest of the
        // current month. It is a line item OF OURS rather than a Stripe proration, because
        // the rounding rule is ours: `ceil(monthly × daysLeft ÷ daysInMonth)`, computed by
        // `prorateRemainderCents` and quoted on the button before the family presses it. If
        // Stripe prorated it instead the two figures would differ by a few cents and the
        // hosted page would ask for a number the button did not promise.
        //
        // ABSENT ENTIRELY when the family already owns this month — a live prepaid term being
        // extended — which is the case that would otherwise double-charge for it.
        ...(prorationLine ? [prorationLine] : []),
      ],
      ...(mode === 'recurring'
        ? {
            subscription_data: {
              metadata,
              // ── EVERYBODY BILLS ON THE 1st, AND A TRIAL IS HOW IT IS SAID ─────────
              // Stripe models "do not charge until this date" as a trial, and the card is
              // still collected now — so the session charges the part month above, the
              // subscription's first invoice lands on the day named here, and the cycle
              // anchors to it. That covers all three cases at once: a family paying for the
              // rest of this month, one paying for this month and next, and one whose
              // prepaid term is still running and must not be billed twice for it.
              //
              // NOT `billing_cycle_anchor` PLUS `proration_behavior: 'none'`, which is what
              // this was until it met a real Checkout Session: that pair is refused outright
              // when a one-time price is present, and the default in its place bills Stripe's
              // own part month on top of ours. `STRIPE_MINIMUM_TRIAL_DAYS` carries the whole
              // argument, and `billingStartsOn` above is where the day is decided.
              //
              // The floor is Stripe's, not ours — a trial ending too soon is refused — so a
              // prepaid term with a day left simply starts billing now, which is correct to
              // within one day and errs in the family's favour. A part month on the same
              // session is refused above instead, because there the same day would be paid
              // for twice.
              ...(trialEnd != null ? { trial_end: trialEnd } : {}),
            },
          }
        : {
            payment_intent_data: { metadata },
            // A one-time payment of this size wants a receipt the family can file. Without
            // this, `mode: 'payment'` produces a charge and no invoice.
            invoice_creation: { enabled: true },
          }),
      metadata,
      // Groups sessions in the Dashboard so the two shapes can be compared. Needs API
      // version 2026-03-25.dahlia or later, which lib/stripe/config.ts pins past.
      integration_identifier: mode === 'recurring'
        ? INTEGRATION_IDS.platformRecurring
        : INTEGRATION_IDS.platformPrepaid,
      allow_promotion_codes: true,
      ...checkoutReturnUrls('/admin/settings'),
    }, {
      // Derived from the INTENT, never from a clock: a double-clicked button inside 24 hours
      // gets the same session back instead of a second one. `months` is in the key because
      // twelve months and one month are different intents.
      idempotencyKey: intentKey(['plan', g.familyCode, tier, mode, months]),
    })

    if (!session.url) {
      return { success: false, message: 'Could not start the payment. Please try again.' }
    }

    // InitiateCheckout — the customer has genuinely entered the checkout, which is what that
    // event means and why `lib/meta/billing.ts` would not let it be fired from anywhere else.
    // Deliberately not awaited into the result: a Meta outage must not stop somebody paying.
    void trackMetaCheckoutStart({
      sessionId: session.id,
      tier,
      mode,
      months,
      userId: g.userId,
    })

    return { success: true, url: session.url }
  } catch (e) {
    // Stripe's own message can name a price id and an account. Logged, never returned.
    console.error(`[billing] checkout failed for ${g.familyCode} (${tier}/${mode}): ${describe(e)}`)
    return { success: false, message: 'Could not start the payment. Please try again.' }
  }
}

export type PlanChangeResult =
  | {
      success: true
      message: string
      /**
       * A hosted Stripe page to send the browser to, when the change needs paying for.
       *
       * PRESENT ON EXACTLY ONE PATH — an upgrade from a prepaid term whose credit does not
       * cover the whole cost. Every other plan change either charges nothing (a downgrade, or
       * an upgrade the credit covers) or is settled by Stripe against a subscription already on
       * file, and neither needs a page. The panel redirects when it is here and refreshes when
       * it is not, so a caller cannot get that wrong by forgetting to check.
       */
      url?: string
    }
  | { success: false; message: string }

/**
 * Move an EXISTING monthly plan to another tier. No new checkout, no second subscription.
 *
 * ── THE TWO DIRECTIONS ARE NOT SYMMETRICAL, AND THE ASYMMETRY IS THE PRODUCT RULE ──
 *
 *   UP    `proration_behavior: 'always_invoice'`. Stripe works out what the rest of this
 *         period costs at the new rate, invoices it now, and the `invoice.paid` webhook is
 *         what actually grants the tier. The family paid more, so they get it at once.
 *
 *   DOWN  `proration_behavior: 'none'`, and a PROMISE written down. Nothing is refunded and
 *         nothing is credited — the current period was paid for at the old rate and is served
 *         at the old tier — and `scheduled_tier_on` is the day after it ends. The next
 *         invoice is at the cheaper rate.
 *
 * `'none'` is the whole of rule 3 in one parameter. The Stripe default is
 * `'create_prorations'`, which would issue a CREDIT for the unused remainder of the dearer
 * tier — and a credit balance is a refund that has not been paid out yet. Leaving the default
 * in place would mean a family could move down mid-period and have the difference sitting on
 * their next invoice, which is precisely what "downgrades do not give refunds" forbids.
 */
export async function changePlanTier(
  nextTier: string,
  /**
   * Upgrade-from-prepaid only: also buy the whole of next month now.
   *
   * The family's choice rather than ours, and both answers cost the same money — the credit
   * either settles the coming invoice today or draws against it on the 1st. `upgradeQuote`
   * returns both figures so a screen can put them side by side.
   */
  includeNextMonth = false,
): Promise<PlanChangeResult> {
  const g = await requireEdit(FAMILY_RESOURCE)
  if (!g.ok) return { success: false, message: g.message }
  if (!g.familyCode) return { success: false, message: 'You do not belong to a family yet.' }
  if (!isFamilyTier(nextTier)) return { success: false, message: 'That is not a plan.' }

  const unavailable = stripeUnavailableReason()
  if (unavailable) return { success: false, message: unavailable }
  const stripe = stripeClient()
  if (!stripe) return { success: false, message: 'Online payments are not set up yet.' }

  const admin = createAdminClient()
  const record = await loadRecord(admin, g.familyCode)
  const move = tierMove(toRecord(record).paidTier, nextTier)
  if (move === 'same') return { success: false, message: `This family is already on ${TIER_LABEL[nextTier]}.` }

  // Moving DOWN TO FREE on a monthly plan is a cancellation, which is its own function
  // because Stripe models it differently — there is no cheaper price to move the item to.
  if (nextTier === 'free') return cancelPlanRenewal()

  if (!TIER_IS_SOLD[nextTier]) {
    return { success: false, message: `${TIER_LABEL[nextTier]} is not on sale yet.` }
  }

  // ── NO SUBSCRIPTION: A PREPAID TERM, OR NONE AT ALL ───────────────────────────────
  if (!record.stripe_subscription_id) {
    // MOVING DOWN NEEDS NO STRIPE CALL AT ALL. There is no subscription price to change and
    // nothing to refund — it is a promise, written down, applied by the sweep on the 1st after
    // the paid term ends. `cancelPlanRenewal` above handles the same move to Free, which is
    // where a family with no subscription and no term will already have gone.
    if (move === 'downgrade') {
      return scheduleDowngradeOnly({ admin, familyCode: g.familyCode, record, nextTier })
    }
    // An UPGRADE, and `upgradeQuote` is its rule: value the unused old term at the OLD rate,
    // spend it on the new tier, carry the remainder as a credit. `lib/platform-billing.ts`
    // holds the arithmetic and the worked example.
    return upgradeFromPrepaid({
      admin, stripe, familyCode: g.familyCode, userId: g.userId,
      record, nextTier, includeNextMonth,
    })
  }
  const priceId = platformPriceId(nextTier, 'recurring')
  if (!priceId) return { success: false, message: `${TIER_LABEL[nextTier]} cannot be bought monthly yet.` }

  try {
    const subscription = await stripe.subscriptions.retrieve(record.stripe_subscription_id)
    const itemId = subscription.items.data[0]?.id
    if (!itemId) {
      return { success: false, message: 'Could not read the current plan from Stripe. Please try again.' }
    }

    await stripe.subscriptions.update(record.stripe_subscription_id, {
      items: [{ id: itemId, price: priceId, quantity: 1 }],
      proration_behavior: move === 'upgrade' ? 'always_invoice' : 'none',
      metadata: {
        genorra_flow: 'platform',
        genorra_family_code: g.familyCode,
        genorra_tier: nextTier,
        genorra_mode: 'recurring',
      },
    }, { idempotencyKey: intentKey(['plan-change', g.familyCode, nextTier, record.paid_through ?? 'none']) })

    if (move === 'downgrade') {
      // THE PROMISE, and the only tier write this file makes. It moves no tier today: the
      // sweep applies it on the day, and until then every gate in the product still reads the
      // dearer tier the family paid for.
      const scheduled = scheduleDowngrade({
        record: toRecord(record), toTier: nextTier, today: todayISO(),
      })
      const { error } = await admin.from('platform_billing_accounts')
        .update({
          scheduled_tier: scheduled.tier,
          scheduled_tier_on: scheduled.on,
        })
        .eq('family_code', g.familyCode)
      if (error) {
        // The Stripe side already moved. Reporting success would hide a family whose next
        // invoice is cheaper and whose tier will never come down.
        console.error(`[billing] could not record the scheduled downgrade for ${g.familyCode}: ${error.message}`)
        return {
          success: false,
          message: 'Stripe was updated but we could not record the change. Please contact support before trying again.',
        }
      }
      revalidateBilling()
      return {
        success: true,
        message: `${TIER_LABEL[nextTier]} starts on ${scheduled.on} — the next billing date. Nothing changes before then, and there is no refund for the days already paid for.`,
      }
    }

    revalidateBilling()
    return {
      success: true,
      message: `${TIER_LABEL[nextTier]} takes effect as soon as the extra amount is paid. Stripe is charging the difference for the rest of this period now.`,
    }
  } catch (e) {
    console.error(`[billing] plan change failed for ${g.familyCode} -> ${nextTier}: ${describe(e)}`)
    return { success: false, message: 'Could not change the plan. Please try again.' }
  }
}

/**
 * Stop a monthly plan at the end of the period it has already been paid for.
 *
 * `cancel_at_period_end`, never `cancel()`. An immediate cancellation is a refund decision
 * dressed as a button: Stripe would end the subscription now, the family would lose pages
 * they had paid for that month, and rule 3 says nothing is given back — so they would have
 * paid for a month and had it taken away.
 */
export async function cancelPlanRenewal(): Promise<PlanChangeResult> {
  const g = await requireEdit(FAMILY_RESOURCE)
  if (!g.ok) return { success: false, message: g.message }
  if (!g.familyCode) return { success: false, message: 'You do not belong to a family yet.' }

  const stripe = stripeClient()
  if (!stripe) return { success: false, message: 'Online payments are not set up yet.' }

  const admin = createAdminClient()
  const record = await loadRecord(admin, g.familyCode)
  if (!record.stripe_subscription_id) {
    return { success: false, message: 'This family has no monthly plan to stop.' }
  }

  try {
    await stripe.subscriptions.update(record.stripe_subscription_id, {
      cancel_at_period_end: true,
    }, { idempotencyKey: intentKey(['plan-cancel', g.familyCode, record.stripe_subscription_id]) })
  } catch (e) {
    console.error(`[billing] cancel failed for ${g.familyCode}: ${describe(e)}`)
    return { success: false, message: 'Could not stop the plan. Please try again.' }
  }

  const scheduled = scheduleDowngrade({ record: toRecord(record), toTier: 'free', today: todayISO() })
  const { error } = await admin.from('platform_billing_accounts')
    .update({
      cancel_at_period_end: true,
      scheduled_tier: 'free',
      scheduled_tier_on: scheduled.on,
    })
    .eq('family_code', g.familyCode)
  if (error) {
    console.error(`[billing] could not record the cancellation for ${g.familyCode}: ${error.message}`)
    return {
      success: false,
      message: 'Stripe was updated but we could not record it. Please contact support before trying again.',
    }
  }

  revalidateBilling()
  return {
    success: true,
    message: `The plan stops on ${scheduled.on}. Every page stays open until then, and every record is kept afterwards.`,
  }
}

/**
 * Just the plan the family is still owed a checkout for, for the dashboard prompt.
 *
 * ── A SECOND, NARROWER READ RATHER THAN REUSING `getPlatformBilling` ────────────────
 * §5, and it is the whole reason this exists. That function returns two years of payment
 * history, the Stripe customer id and the delinquency date; the dashboard needs one word.
 * Props are serialized into the RSC payload whether a component renders them or not, so
 * calling it from the dashboard would publish the family's invoices to every page load of
 * the screen every member lands on.
 *
 * ── GATED ON `requireEdit`, WHICH IS STRICTER THAN THE SCREEN IT LINKS TO ───────────
 * Deliberately. A prompt is an invitation to act, and offering one to somebody who would be
 * refused at the till is worse than showing them nothing — it sends them to a screen to
 * press a button that answers "Not authorized". `getPlatformBilling` reads with
 * `requireRead` because a viewer may legitimately READ what the family has paid; nobody
 * needs to be ASKED to pay unless they can.
 *
 * NULL FOR EVERY "NO", with no reason attached. The skip reasons in `lib/signup-plan.ts`
 * are for tests and support, not for a banner — and a dashboard that said "we are not
 * asking you about Plus because you already have it" would be noise on the one screen
 * every member sees.
 */
export async function getSignupPlanPrompt(): Promise<{ tier: FamilyTier } | null> {
  const g = await requireEdit(FAMILY_RESOURCE)
  if (!g.ok || !g.familyCode) return null

  // ── THE "CAN THIS DEPLOYMENT SELL ANYTHING" CHECK IS THE CALLER'S, NOT THIS ONE'S ──
  //
  // It belongs here by instinct and belongs at the page in fact, and the reason is the one
  // AGENTS.md states for tier checks: where the withheld thing IS the whole answer, a check
  // inside the action turns it into a function that answers null to everybody, and every
  // assertion about it becomes evidence for the credential check instead of for family
  // isolation. `tests/rls` has no `STRIPE_SECRET_KEY`, so putting
  // `anyPlatformBillingConfigured()` here makes the two cases covering this action vacuous —
  // measured, on the first run, through the positive control.
  //
  // So the dashboard skips the CALL when the deployment cannot take a payment (a laptop and
  // every preview build), and this stays a database question with a testable answer.
  const admin = createAdminClient()
  // §3 by hand. Two reads because the prompt is a comparison between what was asked for and
  // what the family actually holds — `families.tier` is the second half, and reading only the
  // billing row would keep asking a family that has since paid.
  const [intentRes, familyRes] = await Promise.all([
    admin.from('platform_billing_accounts')
      .select('signup_tier, signup_tier_at, signup_tier_dismissed_at')
      .eq('family_code', g.familyCode)
      .maybeSingle(),
    admin.from('families').select('tier').eq('family_code', g.familyCode).maybeSingle(),
  ])
  // §8: a refused or failed read must not render as "nothing to set up" — but here the
  // honest answer to a failure IS silence, because the alternative is a banner asking a
  // family to pay for a plan we cannot confirm they chose. Logged so it is not invisible.
  if (intentRes.error || familyRes.error) {
    console.error(`[billing] could not read the signup plan for ${g.familyCode}`)
    return null
  }

  const prompt = signupPlanPrompt({
    signupTier: intentRes.data?.signup_tier,
    signupTierAt: intentRes.data?.signup_tier_at,
    dismissedAt: intentRes.data?.signup_tier_dismissed_at,
    activeTier: isFamilyTier(familyRes.data?.tier) ? familyRes.data.tier : 'free',
    today: todayISO(),
  })
  return prompt.prompt ? { tier: prompt.tier } : null
}

/**
 * "We will stay on our current plan" — stop asking about the plan chosen at signup.
 *
 * ── IT CANCELS A PROMPT AND NOTHING ELSE ────────────────────────────────────────────
 * No money is involved in either direction. No subscription is touched, no tier moves, and
 * `families.tier` is not read or written — the family is on whatever plan it was already on,
 * and every paid plan is still on sale to them on this very screen one section further down.
 * What stops is US ASKING, which is why there is no confirmation dialog in front of it: the
 * action is reversible by pressing the plan they wanted, which is the thing the prompt was
 * offering anyway.
 *
 * ── `requireEdit`, THE SAME GRANT AS THE CHECKOUT ───────────────────────────────────
 * Deliberately not a lower bar. Deciding the family will not buy Plus is the same decision as
 * deciding it will, taken by the same person — and a read-only viewer being able to silence
 * the prompt would let somebody without the grant quietly cancel a choice the administrator
 * made on the pricing page.
 *
 * ── AND IT IS AN UPDATE THAT CAN MATCH NOTHING (§8b) ────────────────────────────────
 * The row exists only if a plan was recorded at signup, so a family with no intent has no row
 * to update and PostgREST reports `{ error: null }` over zero rows. `confirmWrite` is not the
 * tool here — this write goes through the service role with no policy underneath it, so there
 * is no silent RLS refusal to catch — but the caller is still told the truth: the update is
 * predicated on there BEING an unresolved intent, and a no-op reports that there was nothing
 * to dismiss rather than reporting success.
 */
export async function dismissSignupPlan(): Promise<PlanChangeResult> {
  const g = await requireEdit(FAMILY_RESOURCE)
  if (!g.ok) return { success: false, message: g.message }
  if (!g.familyCode) return { success: false, message: 'You do not belong to a family yet.' }

  const admin = createAdminClient()
  // §3 by hand: the service role sees past RLS, so the family conjunct is the only thing
  // scoping this. `.is('signup_tier_dismissed_at', null)` makes a second press a no-op rather
  // than re-stamping the date, and `.not(...)` keeps the CHECK constraint satisfiable — a
  // dismissal with no intent is refused by the database (20260823000008).
  const { data, error } = await admin.from('platform_billing_accounts')
    .update({ signup_tier_dismissed_at: new Date().toISOString() })
    .eq('family_code', g.familyCode)
    .not('signup_tier', 'is', null)
    .is('signup_tier_dismissed_at', null)
    .select('family_code')

  if (error) {
    console.error(`[billing] could not dismiss the signup plan for ${g.familyCode}: ${error.message}`)
    return { success: false, message: 'Could not update that. Please try again.' }
  }
  if (!data?.length) {
    return { success: false, message: 'There was no plan waiting to be set up.' }
  }

  revalidateBilling()
  // REVALIDATES THE SHELL TOO, because the prompt this clears lives on the dashboard and
  // `revalidateBilling()` only covers the settings screen.
  revalidatePath('/dashboard')
  return {
    success: true,
    message: 'We will stop asking. You can move to a paid plan whenever you like.',
  }
}

/**
 * A link into Stripe's own Customer Portal — cards, receipts, and the family's own copy of
 * every invoice.
 *
 * WHY NOT BUILD THIS. It is somebody's card details, their billing address and their VAT
 * number, and Stripe's hosted portal is the answer for the same reason hosted Checkout is:
 * nothing of it comes near this app. What it deliberately does NOT control is the tier —
 * `changePlanTier` above owns that, because the no-refund and scheduled-downgrade rules are
 * ours and the portal's own plan-switching UI knows nothing about them.
 */
export async function openBillingPortal(): Promise<CheckoutResult> {
  const g = await requireEdit(FAMILY_RESOURCE)
  if (!g.ok) return { success: false, message: g.message }
  if (!g.familyCode) return { success: false, message: 'You do not belong to a family yet.' }

  const stripe = stripeClient()
  if (!stripe) return { success: false, message: 'Online payments are not set up yet.' }

  const admin = createAdminClient()
  const record = await loadRecord(admin, g.familyCode)
  if (!record.stripe_customer_id) {
    return { success: false, message: 'This family has no payment history yet.' }
  }

  try {
    const session = await stripe.billingPortal.sessions.create({
      customer: record.stripe_customer_id,
      return_url: checkoutReturnUrls('/admin/settings').cancel_url.replace('checkout=cancelled', 'checkout=portal'),
    })
    return { success: true, url: session.url }
  } catch (e) {
    console.error(`[billing] portal failed for ${g.familyCode}: ${describe(e)}`)
    return { success: false, message: 'Could not open the billing portal. Please try again.' }
  }
}

/**
 * Moving DOWN with no subscription: a promise, and nothing else.
 *
 * No Stripe call, no charge, no refund. `scheduleDowngrade` lands it on the 1st after the paid
 * term ends — the next 1st for a family with no term — and the sweep applies it on the day.
 * Every page stays open until then, which is the whole of what the no-refunds rule buys the
 * family in exchange for not getting their money back.
 */
async function scheduleDowngradeOnly(input: {
  admin: AdminClient
  familyCode: string
  record: BillingRow
  nextTier: FamilyTier
}): Promise<PlanChangeResult> {
  const { admin, familyCode, record, nextTier } = input
  const scheduled = scheduleDowngrade({
    record: toRecord(record), toTier: nextTier, today: todayISO(),
  })

  const { error } = await admin.from('platform_billing_accounts')
    .upsert({
      family_code: familyCode,
      scheduled_tier: scheduled.tier,
      scheduled_tier_on: scheduled.on,
    }, { onConflict: 'family_code' })
  if (error) {
    console.error(`[billing] could not record the scheduled downgrade for ${familyCode}: ${error.message}`)
    return { success: false, message: 'Could not record the change. Please try again.' }
  }

  revalidateBilling()
  return {
    success: true,
    message: `${TIER_LABEL[nextTier]} starts on ${scheduled.on}. Nothing changes before then, and there is no refund for the term already paid for.`,
  }
}

/**
 * Moving UP from a prepaid term — or from nothing at all.
 *
 * ── TWO OUTCOMES, AND ONLY ONE OF THEM INVOLVES STRIPE ──────────────────────────────
 * `upgradeQuote` decides. When the unused old term is worth more than the new tier costs for
 * the period being bought, `dueNowCents` is zero and there is nothing to charge — so the tier
 * moves HERE, immediately, and the leftover is recorded as a credit. That is the case the
 * worked example produces at the 10/20/30 prices, and it is the one a first draft forgets:
 * routing it through a Checkout Session would show a family a payment page for $0.00.
 *
 * When there IS a shortfall it goes through hosted Checkout like every other charge, and the
 * webhook applies the tier — because the button press is not the payment (this file's header).
 *
 * ── THE IMMEDIATE PATH WRITES `families.tier`, WHICH ALMOST NOTHING ELSE HERE DOES ──
 * Stated because it looks like a violation of this file's own rule and is not. The rule is that
 * an action may not decide a family has PAID; this path decides nothing of the kind — the
 * family already paid, for a term this product is holding as credit, and `upgradeQuote` has
 * established that the credit covers the whole cost. No money changes hands, so there is no
 * payment to confirm and nothing for a webhook to tell us. `promoteFamilyTier` refuses to move
 * a tier DOWN, so the worst a bug here can do is fail to open a page.
 */
async function upgradeFromPrepaid(input: {
  admin: AdminClient
  stripe: NonNullable<ReturnType<typeof stripeClient>>
  familyCode: string
  userId: string
  record: BillingRow
  nextTier: FamilyTier
  includeNextMonth: boolean
}): Promise<PlanChangeResult> {
  const { admin, stripe, familyCode, userId, record, nextTier, includeNextMonth } = input
  const today = todayISO()
  const from = toRecord(record)

  const quote = upgradeQuote({
    fromTier: from.paidTier,
    toTier: nextTier,
    paidThrough: from.paidThrough,
    today,
    includeNextMonth,
  })
  if (!quote) return { success: false, message: `${TIER_LABEL[nextTier]} cannot be bought yet.` }

  // ── NOTHING TO CHARGE: APPLY IT NOW ────────────────────────────────────────────────
  if (quote.dueNowCents === 0) {
    const { error } = await admin.from('platform_billing_accounts').upsert({
      family_code: familyCode,
      mode: 'prepaid' satisfies BillingMode,
      paid_tier: nextTier,
      paid_through: quote.paidThrough,
      credit_cents: quote.creditLeftCents,
      // The upgrade supersedes any promise to move down: a family that asked for Standard next
      // month and has just bought Premium is not moving to Standard.
      scheduled_tier: null,
      scheduled_tier_on: null,
    }, { onConflict: 'family_code' })
    if (error) {
      console.error(`[billing] could not apply the upgrade for ${familyCode}: ${error.message}`)
      return { success: false, message: 'Could not change the plan. Please try again.' }
    }

    await promoteFamilyTier(admin, familyCode, nextTier)
    // The credit at Stripe, so it draws against whatever the family is invoiced next. Best
    // effort and AFTER the tier: a family that has been upgraded and whose credit did not
    // register is over-charged by at most the credit, which is recoverable; the reverse leaves
    // them paying for a tier they cannot reach.
    if (quote.creditLeftCents > 0 && record.stripe_customer_id) {
      await recordStripeCredit(stripe, record.stripe_customer_id, quote.creditLeftCents, familyCode)
    }

    revalidateBilling()
    return {
      success: true,
      message: quote.creditLeftCents > 0
        ? `${TIER_LABEL[nextTier]} is active now, paid through ${quote.paidThrough}. What was left of the old term — ${formatCurrency(quote.creditLeftCents)} — is held as credit against your next invoice.`
        : `${TIER_LABEL[nextTier]} is active now, paid through ${quote.paidThrough}. The term you had already paid for covered it exactly.`,
    }
  }

  // ── A SHORTFALL: HOSTED CHECKOUT, AND THE WEBHOOK APPLIES IT ───────────────────────
  const customerId = await ensureCustomer(admin, stripe, {
    familyCode, existing: record.stripe_customer_id,
  })
  if (!customerId) return { success: false, message: 'Could not start the payment. Please try again.' }

  // THE OUTCOME TRAVELS IN METADATA, and the webhook narrows every field of it rather than
  // casting. It is carried rather than recomputed because `today` can differ by a day between
  // creating this session and the payment settling, and a recomputed quote would then not be
  // the one the family was charged for.
  const metadata = {
    genorra_flow: 'platform',
    genorra_family_code: familyCode,
    genorra_tier: nextTier,
    genorra_mode: 'upgrade',
    genorra_paid_through: quote.paidThrough,
    genorra_credit_left: String(quote.creditLeftCents),
  }

  try {
    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      customer: customerId,
      client_reference_id: familyCode,
      line_items: [{
        quantity: 1,
        price_data: {
          currency: 'usd',
          unit_amount: quote.dueNowCents,
          product_data: {
            name: `${TIER_LABEL[nextTier]} — upgrade`,
            description: quote.includesNextMonth
              ? 'The rest of this month and next, less what your current term is worth'
              : 'The rest of this month, less what your current term is worth',
          },
        },
      }],
      payment_intent_data: { metadata },
      invoice_creation: { enabled: true },
      metadata,
      integration_identifier: INTEGRATION_IDS.platformPrepaid,
      ...checkoutReturnUrls('/admin/settings'),
    }, {
      // The intent, not the clock: the family, the tier, the shape and the amount. A
      // double-clicked button inside 24 hours gets the same session back.
      idempotencyKey: intentKey(['upgrade', familyCode, nextTier, quote.dueNowCents, String(includeNextMonth)]),
    })

    if (!session.url) return { success: false, message: 'Could not start the payment. Please try again.' }

    void trackMetaCheckoutStart({
      sessionId: session.id, tier: nextTier, mode: 'prepaid', months: 1, userId,
    })

    return {
      success: true,
      url: session.url,
      message: `Opening Stripe to collect ${formatCurrency(quote.dueNowCents)}.`,
    }
  } catch (e) {
    console.error(`[billing] upgrade checkout failed for ${familyCode} -> ${nextTier}: ${describe(e)}`)
    return { success: false, message: 'Could not start the payment. Please try again.' }
  }
}

/**
 * Put a credit on the family's Stripe customer, so it draws against future invoices.
 *
 * ── A NEGATIVE AMOUNT IS A CREDIT, WHICH IS THE ONE THING TO GET RIGHT ──────────────
 * Stripe's customer balance is signed the way a ledger is: negative means the customer is owed,
 * and Stripe applies it automatically to the next invoice. A POSITIVE amount here would be a
 * DEBT added to their next bill — the exact opposite, with no error and no warning, on a family
 * that had just been told they had credit.
 *
 * Never throws. The tier has already moved by the time this runs, and a Stripe hiccup must not
 * turn a completed upgrade into a failure message — it is logged loudly instead, because a
 * credit that did not register is money the family is owed.
 */
async function recordStripeCredit(
  stripe: NonNullable<ReturnType<typeof stripeClient>>,
  customerId: string,
  creditCents: number,
  familyCode: string,
): Promise<void> {
  try {
    await stripe.customers.createBalanceTransaction(customerId, {
      amount: -creditCents,
      currency: 'usd',
      description: `Unused term carried forward (${familyCode})`,
    }, { idempotencyKey: intentKey(['credit', familyCode, creditCents]) })
  } catch (e) {
    console.error(`[billing] CREDIT NOT REGISTERED at Stripe for ${familyCode} (${creditCents}c): ${describe(e)}`)
  }
}

/**
 * Move `families.tier` UP to what has been paid for. Never down.
 *
 * The same rule and the same reasoning as `promoteTier` in `lib/stripe/platform-events.ts`, and
 * it is duplicated rather than shared for one reason worth stating: that module is imported by
 * the webhook route and this one by a `'use server'` file, and exporting a tier-mover from
 * either would give it a URL. Both refuse to move a tier downwards, because every downward move
 * in this product goes through `scheduled_tier` and the sweep.
 */
async function promoteFamilyTier(
  admin: AdminClient,
  familyCode: string,
  tier: FamilyTier,
): Promise<void> {
  const { data, error } = await admin
    .from('families').select('tier').eq('family_code', familyCode).maybeSingle()
  if (error || !data) {
    console.error(`[billing] could not read the tier for ${familyCode}: ${error?.message ?? 'no row'}`)
    return
  }
  const current = isFamilyTier(data.tier) ? data.tier : 'free'
  if (TIER_RANK[tier] <= TIER_RANK[current]) return

  const { error: writeError } = await admin
    .from('families').update({ tier }).eq('family_code', familyCode)
  if (writeError) {
    console.error(`[billing] PAID BUT NOT GRANTED: ${familyCode} -> ${tier}: ${writeError.message}`)
  }
}

// ── Shared internals ────────────────────────────────────────────────────────────────

/** The database row, loosely typed the way supabase-js hands it back. */
interface BillingRow {
  stripe_customer_id: string | null
  stripe_subscription_id: string | null
  mode: string | null
  paid_tier: string | null
  paid_through: string | null
  subscription_status: string | null
  cancel_at_period_end: boolean | null
  scheduled_tier: string | null
  scheduled_tier_on: string | null
}

const EMPTY_ROW: BillingRow = {
  stripe_customer_id: null, stripe_subscription_id: null, mode: null,
  paid_tier: null, paid_through: null, subscription_status: null,
  cancel_at_period_end: false, scheduled_tier: null, scheduled_tier_on: null,
}

/**
 * The signup-intent columns, read off the same `select('*')` `getPlatformBilling` already does.
 *
 * SEPARATE FROM `BillingRow` on purpose. That one is the shape `loadRecord` projects for the
 * money path, and every field on it feeds `entitlementOn()` — putting a signup intent in it
 * would put it one careless spread away from being read as a paid term, which is the single
 * thing 20260823000008's header asks a future change not to do.
 */
interface SignupIntentRow {
  signup_tier: string | null
  signup_tier_at: string | null
  signup_tier_dismissed_at: string | null
}

async function loadRecord(admin: AdminClient, familyCode: string): Promise<BillingRow> {
  const { data } = await admin
    .from('platform_billing_accounts')
    .select('stripe_customer_id, stripe_subscription_id, mode, paid_tier, paid_through, subscription_status, cancel_at_period_end, scheduled_tier, scheduled_tier_on')
    .eq('family_code', familyCode)
    .maybeSingle()
  return (data as BillingRow | null) ?? EMPTY_ROW
}

/** The row, narrowed into the pure module's shape. Every unrecognised value becomes null. */
function toRecord(row: BillingRow): PlatformBillingRecord {
  return {
    paidTier: isFamilyTier(row.paid_tier) ? row.paid_tier : null,
    paidThrough: row.paid_through,
    mode: row.mode === 'recurring' || row.mode === 'prepaid' ? row.mode : null,
    scheduledTier: isFamilyTier(row.scheduled_tier) ? row.scheduled_tier : null,
    scheduledTierOn: row.scheduled_tier_on,
    subscriptionStatus: row.subscription_status,
    cancelAtPeriodEnd: row.cancel_at_period_end === true,
  }
}

function readRecord(row: unknown): PlatformBillingRecord {
  return row ? toRecord(row as BillingRow) : NO_PLATFORM_BILLING
}

/**
 * The family's Stripe customer, created once and reused forever.
 *
 * ONE CUSTOMER PER FAMILY, keyed on `family_code` in both directions — our column and their
 * metadata. Creating a second one is how a family ends up with its card saved against a
 * customer nobody reads and its invoices split across two records in the Dashboard.
 *
 * NO EMAIL IS SENT UP. That is not an omission: a Stripe customer's email is where Stripe
 * mails receipts, and the obvious value — whoever happened to press the button — is wrong the
 * moment that administrator leaves the family. The family's own billing email is a thing
 * somebody should choose, TODO.md carries it, and until then Stripe collects an email on the
 * hosted page and attaches it to the customer itself.
 */
async function ensureCustomer(
  admin: AdminClient,
  stripe: NonNullable<ReturnType<typeof stripeClient>>,
  input: { familyCode: string; existing: string | null },
): Promise<string | null> {
  if (input.existing) return input.existing

  const { data: family } = await admin
    .from('families').select('family_name').eq('family_code', input.familyCode).maybeSingle()

  try {
    const customer = await stripe.customers.create({
      name: (family?.family_name as string | undefined) ?? input.familyCode,
      metadata: { genorra_family_code: input.familyCode },
    }, { idempotencyKey: intentKey(['customer', input.familyCode]) })

    // UPSERT on `family_code`, which is UNIQUE. Two administrators pressing Pay at the same
    // moment both reach here; the idempotency key above means Stripe hands them the SAME
    // customer, and the upsert means the second write is not a duplicate-key failure that
    // would surface as "could not start the payment" on a perfectly good customer.
    const { error } = await admin
      .from('platform_billing_accounts')
      .upsert({ family_code: input.familyCode, stripe_customer_id: customer.id }, { onConflict: 'family_code' })
    if (error) {
      // The customer exists in Stripe and we could not record it. Refusing is right: carrying
      // on would create a second customer on the next attempt, and the family would have two.
      console.error(`[billing] could not record customer ${customer.id} for ${input.familyCode}: ${error.message}`)
      return null
    }
    return customer.id
  } catch (e) {
    console.error(`[billing] customer creation failed for ${input.familyCode}: ${describe(e)}`)
    return null
  }
}

/**
 * Whether the Stripe Price behind a tier is actually usable for the way somebody is paying.
 *
 * ── WHY THIS EXISTS: A CONFIG ERROR WAS REPORTED AS "PLEASE TRY AGAIN" ──────────────
 * `platformBillingConfigured` answers whether the variable is SET. It cannot answer whether
 * the id in it names a price of the right shape, because that lives in Stripe — and until
 * this function existed the answer arrived as a 400 from `checkout.sessions.create`, caught
 * by a handler whose message asks the family to retry something that will fail forever.
 *
 * ── THE FOUR THINGS THAT GO WRONG, AND THE FIRST TWO ARE THE SAME MISTAKE ───────────
 *
 *   RECURRING/ONE-TIME SWAPPED  `mode: 'subscription'` needs a price with a `recurring`, and
 *                               `mode: 'payment'` needs one without. The two variables per
 *                               tier differ by one word (`_RECURRING` / `_PREPAID`) and are
 *                               set in the same UI on the same afternoon, so this is the
 *                               likeliest single misconfiguration in the whole integration.
 *   ARCHIVED                    a price can be deactivated in the Dashboard long after it
 *                               was wired up here, and an inactive price cannot be sold.
 *   WRONG INTERVAL              a yearly price in the `_RECURRING` slot would bill twelve
 *                               months at the monthly figure. There is one rate per tier and
 *                               it is monthly (`lib/plans.ts`); anything else is not ours.
 *   WRONG AMOUNT               `TIER_PRICE[tier].monthlyCents` is what every screen QUOTES
 *                               and Stripe is what CHARGES. TODO.md's GO LIVE list said
 *                               "nothing in this repo can check that" — this is that check,
 *                               made at the one moment it matters and can be acted on.
 *
 * ── IT REFUSES RATHER THAN WARNS, AND THE AMOUNT IS WHY ─────────────────────────────
 * The first three would fail at Stripe anyway, so refusing here only improves the message.
 * The amount would NOT fail: the hosted page would open and ask for a different number from
 * the one the button promised, and somebody would pay it. That is the one case where this
 * function is the only thing standing between a family and being charged the wrong price.
 *
 * ── ONE EXTRA API CALL PER CHECKOUT START, WHICH IS THE RIGHT TRADE ─────────────────
 * A `prices.retrieve` on a path a member reaches by pressing Pay — rare, deliberate, and
 * already about to make a heavier call. It is NOT on any render path, so no screen gets
 * slower and no page depends on Stripe being reachable to draw itself.
 *
 * A FAILED RETRIEVE IS NOT A FINDING. If Stripe cannot be reached the answer is null and the
 * session call decides — that path already reports a transient failure honestly, and refusing
 * a checkout because a preflight timed out would turn an outage into a misconfiguration.
 */
async function priceShapeError(
  stripe: NonNullable<ReturnType<typeof stripeClient>>,
  priceId: string,
  tier: FamilyTier,
  mode: BillingMode,
): Promise<{ message: string; detail: string } | null> {
  const way = mode === 'recurring' ? 'monthly' : 'paying in advance'
  const bad = (detail: string) => ({
    // NAMES NO ID AND NO ACCOUNT, per the same rule as the catch below — and says the thing
    // the family most needs to know, which is that no money moved.
    message: `${TIER_LABEL[tier]} is not set up correctly for ${way} on this deployment. `
      + 'Nothing has been charged. Please report this rather than retrying.',
    detail,
  })

  // ── A PRODUCT ID IN A PRICE SLOT, CAUGHT WITHOUT AN API CALL ──────────────────────
  //
  // Measured on the first real sandbox checkout (2026-08-23): `STRIPE_PRICE_STANDARD_RECURRING`
  // held `prod_…` and Stripe answered `resource_missing`, "No such price: 'prod_…'". It is the
  // easiest mistake in the whole setup to make and the hardest to see, because the id is
  // REAL — the Dashboard shows a healthy Product under it, so the natural conclusion from the
  // error is that Stripe is wrong. A Product is the thing being sold; a Price is the amount
  // charged for it, and `line_items[].price` takes the second.
  //
  // Checked by PREFIX rather than by asking Stripe, so it costs nothing and names the mistake
  // exactly instead of reporting the 404 it would otherwise become. `price_` is the only form
  // this parameter accepts.
  if (!priceId.startsWith('price_')) {
    return bad(priceId.startsWith('prod_')
      ? 'a PRODUCT id (prod_…) is in the price variable; it needs the Price id (price_…) '
        + 'from that product\'s Pricing section'
      : `the id does not look like a Stripe Price (expected price_…, got ${priceId.slice(0, 6)}…)`)
  }

  let price
  try {
    price = await stripe.prices.retrieve(priceId)
  } catch (e) {
    // A price id that does not exist on THIS account lands here, not below — and it is
    // reported, because it is a configuration error rather than an outage. The commonest
    // cause is a live-mode id against a sandbox key, or an id from another sandbox.
    return bad(`could not be retrieved: ${describe(e)}`)
  }

  if (price.active === false) return bad('the price is archived')
  if (mode === 'recurring' && !price.recurring) {
    return bad('a ONE-TIME price is in the _RECURRING slot')
  }
  if (mode === 'prepaid' && price.recurring) {
    return bad('a RECURRING price is in the _PREPAID slot')
  }
  if (mode === 'recurring'
      && (price.recurring?.interval !== 'month' || (price.recurring?.interval_count ?? 1) !== 1)) {
    return bad(`the recurring interval is ${price.recurring?.interval_count ?? 1} `
      + `${price.recurring?.interval}, and there is one monthly rate per tier`)
  }
  if (price.currency !== 'usd') return bad(`the currency is ${price.currency}, not usd`)

  // `unit_amount` is null for tiered pricing, which this product does not sell and cannot
  // quote. Refused rather than skipped: a null here means the figure on the button came from
  // somewhere the charge does not.
  const expected = TIER_PRICE[tier]?.monthlyCents
  if (expected != null && price.unit_amount !== expected) {
    return bad(`Stripe charges ${price.unit_amount} and every screen quotes ${expected}`)
  }

  return null
}

/** Which tiers can actually be bought here, in each shape. Read by the panel (§5). */
function purchasability(): Record<FamilyTier, TierPurchasability> {
  const out = {} as Record<FamilyTier, TierPurchasability>
  for (const tier of ['free', 'standard', 'plus', 'premium'] as const) {
    const sold = TIER_IS_SOLD[tier] && TIER_PRICE[tier] != null
    out[tier] = {
      recurring: sold && platformBillingConfigured(tier, 'recurring'),
      prepaid: sold && platformBillingConfigured(tier, 'prepaid'),
    }
  }
  return out
}

async function trackMetaCheckoutStart(input: {
  sessionId: string
  tier: FamilyTier
  mode: BillingMode
  months: number
  userId: string
}): Promise<void> {
  const quote = prepayQuoteCents(input.tier, input.mode === 'prepaid' ? input.months : 1)
  if (quote == null) return
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  await trackCheckoutStarted({
    checkoutId: input.sessionId,
    amountCents: quote,
    currency: 'USD',
    planId: input.tier,
    // `lib/meta/billing.ts` only knows 'monthly' | 'annual'. A prepaid term is neither, and
    // reporting it as 'annual' would be a claim about a renewal that will never happen — so
    // it reports the RATE, which is monthly whatever the term.
    billingInterval: 'monthly',
    holder: { userId: input.userId, email: user?.email ?? null },
    sourcePath: '/admin/settings',
  })
}

/** Today as `YYYY-MM-DD`, UTC — the one clock this file reads. */
function todayISO(): string {
  return new Date().toISOString().slice(0, 10)
}

/** An error's message, without letting a Stripe object reach a caller. */
function describe(e: unknown): string {
  return e instanceof Error ? e.message : String(e)
}

function revalidateBilling(): void {
  revalidatePath('/admin/settings')
  // The plan decides what the rail shows, so the shell has to be rebuilt as well —
  // `setFamilyTier` does the same, and `ShellWatcher` catches anyone whose tab was already
  // open when it changed.
  revalidatePath('/', 'layout')
}
