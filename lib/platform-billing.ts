/**
 * What a family has PAID GENORRA, and what that entitles them to — the arithmetic half.
 *
 * ── THE ONE SENTENCE THIS MODULE EXISTS TO ENFORCE ──────────────────────────────────
 * GENORRA's money and a family's money are two different ledgers and must never meet.
 * `dues_payments`, `fund_contributions` and `fund_disbursements` are the FAMILY's books —
 * what its relatives paid it and what it spent. What a family pays GENORRA for its plan is
 * OUR revenue, it belongs in `platform_payments`, and it appears in no fund balance, no P&L
 * and no dues projection. A subscription charge landing in `dues_payments` would inflate the
 * family's collected figure with money it never received and route a slice of our invoice
 * into its Reunion fund.
 *
 * That is why this file is `lib/platform-billing.ts` and not a second half of
 * `lib/dues-utils.ts`, and why nothing here imports anything from the accounting layer.
 *
 * ── PURE, AND FOR THE REASON AGENTS.md §7b GIVES ────────────────────────────────────
 * Data and pure functions: no React, no `server-only`, no database, no Stripe. Every
 * function that needs to know the date TAKES IT AS A PARAMETER, because the whole value of
 * this module is that `npm test` can check the boundaries — a term ending today, a term
 * ending yesterday, an upgrade on the 31st of January — and `new Date()` read internally is
 * exactly what made every other date helper in this codebase untestable until somebody went
 * back and changed the signature.
 *
 * `lib/stripe/*` is the impure half: it holds the credentials and talks to the API. It
 * imports this; this imports nothing of it.
 *
 * ── THE BILLING MODEL, IN FIVE RULES ────────────────────────────────────────────────
 *
 *   1. **ONE RATE PER TIER, MONTHLY.** `TIER_PRICE[tier].monthlyCents` is the only figure,
 *      and there is deliberately no annual rate — `lib/plans.ts` records why one was
 *      withdrawn, and "do not put a yearly figure back by multiplying" is a rule this module
 *      obeys rather than reopens. A year in advance is twelve months at the monthly rate.
 *
 *   2. **PAY IN ADVANCE, AS FAR AHEAD AS YOU LIKE.** Either a monthly subscription that
 *      renews, or one payment covering N months. `MAX_PREPAY_MONTHS` is the only ceiling and
 *      it is a practical one, not a pricing one.
 *
 *   3. **NO REFUNDS, EVER.** Moving down a tier takes nothing back. The family keeps what it
 *      paid for until the term it paid for ends, and the tier changes then —
 *      `scheduled_tier` / `scheduled_tier_on` is that promise written down.
 *
 *   4. **MOVING UP TAKES EFFECT AT ONCE, AND THE UNUSED TERM IS KEPT AS VALUE.** See
 *      `upgradeCreditDays` — the days left on the cheaper term are converted at the dearer
 *      tier's rate rather than refunded or forfeited.
 *
 *   5. **`families.tier` IS MOVED BY ONE THING.** `apply_due_platform_tier_changes()` in
 *      SQL. Nothing here writes anything, and `entitlementOn` DESCRIBES rather than decides —
 *      see its header for why that distinction is load-bearing rather than pedantic.
 */

import { TIER_PRICE } from '@/lib/plans'
import { DEFAULT_TIER, TIER_RANK, isFamilyTier, type FamilyTier } from '@/lib/tiers'

/**
 * How a family is paying.
 *
 *   'recurring'  a Stripe subscription renewing monthly. Stripe owns the calendar, and
 *                `paid_through` is a copy of the subscription's `current_period_end`.
 *   'prepaid'    one payment covering N months. NOTHING renews it and nothing will remind
 *                anybody — which is why `entitlementOn` reports `lapsed` and why the
 *                delinquency question in TODO.md is about this mode as much as the other.
 */
export type BillingMode = 'recurring' | 'prepaid'

export function isBillingMode(value: unknown): value is BillingMode {
  return value === 'recurring' || value === 'prepaid'
}

/**
 * The furthest ahead a family may pay in one go.
 *
 * THREE YEARS IS A PRACTICAL CEILING RATHER THAN A PRICING ONE, and it is worth saying what
 * it is protecting: a hosted Checkout page with an adjustable quantity is a number field a
 * stranger can type into, and `999999` months is a real charge for a real amount of money
 * that we would then owe someone a service for until the 84th century. Stripe enforces the
 * maximum on the page and `startPlanCheckout` enforces it again in the action, because the
 * page in front of an endpoint is a convenience and not a gate (AGENTS.md §2).
 */
export const MAX_PREPAY_MONTHS = 36

/**
 * The options a screen offers, in months.
 *
 * PRESETS ARE NOT A LIMIT. The hosted page carries `adjustable_quantity`, so a family that
 * wants seven months types seven. These are the ones worth a button, and the labels are the
 * caller's business — 12 is "a year" to a reader and "12" to this module.
 */
export const PREPAY_PRESET_MONTHS: readonly number[] = [1, 3, 6, 12, 24, 36]

/** A month count this product will accept. Integral, at least one, at most the ceiling. */
export function isPrepayMonths(value: unknown): value is number {
  return typeof value === 'number'
    && Number.isInteger(value)
    && value >= 1
    && value <= MAX_PREPAY_MONTHS
}

/**
 * What N months of a tier costs, or null where there is nothing to sell.
 *
 * NULL FOR FREE, deliberately, and callers must not read it as zero. Free has no price
 * because it is not bought — a `0` here would let a checkout session be created for it, and
 * Stripe would either refuse the line item or, worse, accept it and give us a paid-through
 * date for a tier nobody paid for.
 */
export function prepayQuoteCents(tier: FamilyTier, months: number): number | null {
  const price = TIER_PRICE[tier]
  if (!price || !isPrepayMonths(months)) return null
  return price.monthlyCents * months
}

// ── Dates ───────────────────────────────────────────────────────────────────────────
//
// `YYYY-MM-DD` in, `YYYY-MM-DD` out, UTC throughout — the rule `lib/calendar.ts` states at
// length. A term boundary is a DATE and never an instant: nothing in this product records a
// family timezone, so a `TIMESTAMPTZ` here would be a moment in no particular zone and would
// end somebody's plan on the wrong day for half the country.

function parseISO(iso: string): Date {
  const [y, m, d] = iso.split('-').map(Number)
  return new Date(Date.UTC(y, (m ?? 1) - 1, d ?? 1))
}

function toISO(date: Date): string {
  return date.toISOString().slice(0, 10)
}

function lastDayOfMonth(year: number, monthIndex: number): number {
  return new Date(Date.UTC(year, monthIndex + 1, 0)).getUTCDate()
}

/** `iso` moved by whole days. Negative counts go backwards. */
export function addDays(iso: string, days: number): string {
  const d = parseISO(iso)
  d.setUTCDate(d.getUTCDate() + days)
  return toISO(d)
}

/**
 * `iso` moved by whole months, CLAMPED to the end of the target month.
 *
 * The `setUTCMonth` overflow, for the third time in this codebase — `lib/dues-utils.ts`
 * carries the long version and `lib/calendar.ts` the third. From 31 January, +1 month is
 * "31 February", which resolves to 3 March. Here that is not a missing ladder rung, it is a
 * family whose year in advance ends three days late every time, compounding at every
 * renewal; and a term bought on the 31st is ordinary, not exotic.
 *
 * The day comes from the ANCHOR rather than being carried forward, so a February clamped to
 * the 28th does not drag the following month back with it.
 */
export function addMonthsClamped(iso: string, months: number): string {
  const anchor = parseISO(iso)
  const day = anchor.getUTCDate()
  const absolute = anchor.getUTCFullYear() * 12 + anchor.getUTCMonth() + months
  const year = Math.floor(absolute / 12)
  const monthIndex = absolute - year * 12
  return toISO(new Date(Date.UTC(year, monthIndex, Math.min(day, lastDayOfMonth(year, monthIndex)))))
}

/**
 * Whole days from `from` to `to`. Negative when `to` is earlier.
 *
 * `daysBetween(d, d)` is 0 — the count is of days CROSSED, not of days covered. Both callers
 * want it that way and the distinction is where an off-by-one in somebody's paid term would
 * come from, so it is stated rather than left to be inferred.
 */
export function daysBetween(from: string, to: string): number {
  return Math.round((parseISO(to).getTime() - parseISO(from).getTime()) / 86_400_000)
}

// ── The record, and what it entitles a family to ────────────────────────────────────

/**
 * One family's billing standing — the readable shape of a `platform_billing_accounts` row.
 *
 * EVERY FIELD IS A COLUMN, and there is nothing derived in here on purpose. A derived tier
 * stored beside a paid-through date is the `is_minor` trap (AGENTS.md §4b): two facts about
 * one thing, agreeing on the day they are written and diverging the first time a term ends
 * with nobody watching.
 */
export interface PlatformBillingRecord {
  /** The tier the family's current term was bought at. Null before they ever paid. */
  paidTier: FamilyTier | null
  /** INCLUSIVE last day of the paid term, `YYYY-MM-DD`. Null before they ever paid. */
  paidThrough: string | null
  mode: BillingMode | null
  /** The tier a scheduled downgrade will land on, and the day it lands. */
  scheduledTier: FamilyTier | null
  scheduledTierOn: string | null
  /** Stripe's own word for the subscription: `active`, `past_due`, `canceled`, … */
  subscriptionStatus: string | null
  /** True once a recurring plan has been told to stop at the end of the current period. */
  cancelAtPeriodEnd: boolean
}

/** A record for a family that has never paid us anything. */
export const NO_PLATFORM_BILLING: PlatformBillingRecord = {
  paidTier: null,
  paidThrough: null,
  mode: null,
  scheduledTier: null,
  scheduledTierOn: null,
  subscriptionStatus: null,
  cancelAtPeriodEnd: false,
}

export interface Entitlement {
  /** The tier the family has PAID for as at `today`. Free when nothing is paid up. */
  tier: FamilyTier
  /** A term that has run out. False for a family that never had one — see below. */
  lapsed: boolean
  /**
   * Days left in the paid term, 0 once it has run out and null when there is no term.
   *
   * NULL AND ZERO ARE DIFFERENT ANSWERS and a screen must not fold them: null is "this
   * family is on the free plan and always has been", zero is "the thing they paid for
   * finished today", and only the second is worth putting in front of anybody.
   */
  daysRemaining: number | null
}

/**
 * What the family has paid for, as at `today`.
 *
 * ── IT DESCRIBES. IT DOES NOT DECIDE ────────────────────────────────────────────────
 * `families.tier` is what every gate in the product actually reads (`requireView` →
 * `tierAllows`), and it is moved by exactly one thing: `apply_due_platform_tier_changes()`
 * in SQL. This function does not move it, is not consulted by any gate, and must never
 * become the answer to "may this member open this page".
 *
 * That separation is deliberate and it is the reason there are two expressions of one
 * comparison rather than one. The alternative — resolving the tier from the billing record
 * at every gate — would put a billing read on the hot path of every page load, and would
 * make a family's access flicker with a webhook. So the column stays authoritative and this
 * answers a different question: what does the billing screen SAY, and is anything overdue.
 *
 * What keeps the two in step is that they compare the same two values, `paid_through`
 * against the current date, and that the SQL side is the only writer. If a third expression
 * of this rule ever appears, one of them is wrong.
 *
 * A LAPSED TERM REPORTS FREE, not the tier that was paid for. That is the honest answer and
 * it is also the safe direction: the screen says "your Plus term ended on the 3rd" while the
 * column may still say `plus` until the sweep runs, and the discrepancy is visible rather
 * than silent.
 */
export function entitlementOn(record: PlatformBillingRecord, today: string): Entitlement {
  const { paidTier, paidThrough } = record
  if (!paidThrough || !paidTier) {
    return { tier: DEFAULT_TIER, lapsed: false, daysRemaining: null }
  }
  const remaining = daysBetween(today, paidThrough)
  if (remaining < 0) {
    return { tier: DEFAULT_TIER, lapsed: true, daysRemaining: 0 }
  }
  return { tier: paidTier, lapsed: false, daysRemaining: remaining }
}

/** True when a scheduled tier change has come due — the sweep's own test, in TypeScript. */
export function scheduledChangeDue(record: PlatformBillingRecord, today: string): boolean {
  if (!record.scheduledTier || !record.scheduledTierOn) return false
  return daysBetween(record.scheduledTierOn, today) >= 0
}

// ── Moving between tiers ────────────────────────────────────────────────────────────

export type TierMove = 'upgrade' | 'downgrade' | 'same'

/**
 * Which direction a family is going.
 *
 * `from` is nullable because a family that has never paid is coming from Free rather than
 * from nowhere — and `TIER_RANK` is what does the comparing, so inserting a tier in the
 * middle (as Standard was, 2026-08-19) re-ranks this with no edit.
 */
export function tierMove(from: FamilyTier | null, to: FamilyTier): TierMove {
  const rank = TIER_RANK[from ?? DEFAULT_TIER]
  if (TIER_RANK[to] > rank) return 'upgrade'
  if (TIER_RANK[to] < rank) return 'downgrade'
  return 'same'
}

/**
 * Days of the DEARER tier that the unused remainder of the cheaper term is worth.
 *
 * ── THE PROBLEM THIS SOLVES, WHICH IS AN EXPLOIT RATHER THAN AN UNFAIRNESS ──────────
 * A family with ten months of Standard left buys one month of Premium. Stacking the new
 * month on the end of the old term — which is the right answer when the tier is unchanged,
 * and is what "pay in advance" means — would give them eleven months of Premium for ten
 * months of Standard plus one of Premium, because the tier in force is a single value and
 * the whole remaining term would be served at the new one. At a 5:1 price ratio that is a
 * standing invitation.
 *
 * The two obvious alternatives are both worse. Starting the new term today and FORFEITING
 * the remainder takes money the family paid and gives nothing for it, which is a refund
 * policy nobody agreed to. Prorating it as a REFUND is money moving out of a Stripe account,
 * which the no-refunds rule exists to avoid entirely.
 *
 * So the remainder is kept as VALUE and converted at the new rate. Ten months of Standard at
 * $5 is $50, which is twenty days of Premium at $25 a month. Nothing is refunded, nothing is
 * lost, and the arithmetic is one line:
 *
 *     creditDays = floor(remainingDays × oldMonthlyCents ÷ newMonthlyCents)
 *
 * The daily rates cancel, which is why no assumption about the length of a month appears
 * here and why this needs no calendar at all.
 *
 * FLOOR RATHER THAN ROUND, and the direction is deliberate: the credit is a courtesy the
 * family did not pay for at this tier, and rounding UP would hand out a free day on every
 * upgrade for no reason anybody could state.
 *
 * ZERO IN THREE CASES, all of which mean "there is nothing to carry": no term, a term that
 * has already run out, and a term at a tier with no price (Free — nothing was paid, so there
 * is nothing to convert).
 */
export function upgradeCreditDays(input: {
  fromTier: FamilyTier | null
  toTier: FamilyTier
  paidThrough: string | null
  today: string
}): number {
  const { fromTier, toTier, paidThrough, today } = input
  if (!fromTier || !paidThrough) return 0

  const from = TIER_PRICE[fromTier]
  const to = TIER_PRICE[toTier]
  if (!from || !to || to.monthlyCents <= 0) return 0

  const remaining = daysBetween(today, paidThrough)
  if (remaining <= 0) return 0

  return Math.floor((remaining * from.monthlyCents) / to.monthlyCents)
}

export interface PrepaidPurchase {
  /** The new INCLUSIVE last day of the paid term. */
  paidThrough: string
  /** Days carried over from a cheaper term — 0 unless this is an upgrade. */
  creditedDays: number
  /** Where the purchased months were counted from, for a screen that wants to explain it. */
  anchor: string
}

/**
 * Where a prepaid purchase of `months` at `tier` leaves the family's term.
 *
 * THREE ANCHORS, ONE PER SITUATION, and which one applies is the whole of the decision:
 *
 *   same tier, live term    the END of the current term. This is what paying in advance
 *                           MEANS — a second year bought in March starts when the first
 *                           one finishes, not in March.
 *   upgrade, live term      TODAY plus the converted remainder (`upgradeCreditDays`). The
 *                           better tier starts now, which is what somebody who just paid
 *                           more expects, and the days they had already bought come with
 *                           them at the new rate.
 *   no term, or lapsed      TODAY. There is nothing to stack on and nothing to convert.
 *
 * A DOWNGRADE IS NOT A PURCHASE and this function refuses to model one — it returns the
 * upgrade/lapsed shapes only, because moving down costs nothing, refunds nothing and changes
 * no date. It is `scheduleDowngrade` below, and keeping the two apart is what stops a
 * "downgrade" from ever being able to shorten a term somebody paid for.
 */
export function prepaidPurchase(input: {
  record: PlatformBillingRecord
  tier: FamilyTier
  months: number
  today: string
}): PrepaidPurchase {
  const { record, tier, months, today } = input
  const live = record.paidThrough != null && daysBetween(today, record.paidThrough) >= 0

  if (!live) {
    return { paidThrough: addMonthsClamped(today, months), creditedDays: 0, anchor: today }
  }

  if (tierMove(record.paidTier, tier) === 'upgrade') {
    const creditedDays = upgradeCreditDays({
      fromTier: record.paidTier, toTier: tier, paidThrough: record.paidThrough, today,
    })
    const anchor = addDays(today, creditedDays)
    return { paidThrough: addMonthsClamped(anchor, months), creditedDays, anchor }
  }

  // Same tier — or, unreachably, a downgrade that got here anyway, which stacks rather than
  // shortening. The safe direction for a bug: the family keeps what it paid for.
  const anchor = record.paidThrough as string
  return { paidThrough: addMonthsClamped(anchor, months), creditedDays: 0, anchor }
}

export interface ScheduledDowngrade {
  tier: FamilyTier
  /** The day the new tier starts — the day AFTER the paid term ends. */
  on: string
}

/**
 * When a downgrade takes effect: the day after the term the family already paid for.
 *
 * `paid_through` is INCLUSIVE, so a term ending on the 30th is served through the 30th and
 * the new tier starts on the 31st. Scheduling it ON `paid_through` would take a day the
 * family paid for, which is a refund in the only direction this system does not do.
 *
 * NULL WHERE THERE IS NOTHING TO SCHEDULE — no paid term, or a term already lapsed. The
 * caller then applies the change at once, because nothing is being taken away.
 */
export function scheduleDowngrade(input: {
  record: PlatformBillingRecord
  toTier: FamilyTier
  today: string
}): ScheduledDowngrade | null {
  const { record, toTier, today } = input
  if (!record.paidThrough) return null
  if (daysBetween(today, record.paidThrough) < 0) return null
  return { tier: toTier, on: addDays(record.paidThrough, 1) }
}

// ── Reading Stripe's own words back ─────────────────────────────────────────────────

/**
 * A Stripe subscription status that means the family is paid up.
 *
 * `trialing` counts and `past_due` does not, which is the one judgement in here. A trial is
 * something we granted; `past_due` is a charge that failed, and Stripe keeps retrying it for
 * days — so treating it as paid would serve a tier nobody has paid for, and treating it as
 * lapsed would drop a family's pages over a card that is about to succeed on the second
 * attempt. It resolves to NOT paid-up here, and what the product should DO about that window
 * is the delinquency question TODO.md carries: this function decides what the flag means,
 * not what happens next.
 */
export function subscriptionIsCurrent(status: string | null | undefined): boolean {
  return status === 'active' || status === 'trialing'
}

/**
 * A tier out of Stripe metadata, or null.
 *
 * METADATA IS OURS AND IS STILL NOT TRUSTED. We set it when the session is created, so it is
 * not attacker-supplied in the way a form field is — but it round-trips through an external
 * system, survives a Dashboard edit by anybody with access to our Stripe account, and comes
 * back as `string | undefined`. Narrowing it here means a webhook handler cannot cast, and
 * `isFamilyTier` is the same guard `setFamilyTier` uses on the way in.
 */
export function tierFromMetadata(value: unknown): FamilyTier | null {
  return isFamilyTier(value) ? value : null
}

/** A month count out of Stripe metadata or a line-item quantity. Null when unusable. */
export function monthsFromQuantity(value: unknown): number | null {
  const n = typeof value === 'string' ? Number(value) : value
  return isPrepayMonths(n) ? n : null
}
