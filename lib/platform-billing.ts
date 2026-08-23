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
 * ── THE BILLING MODEL, IN SIX RULES ─────────────────────────────────────────────────
 *
 *   1. **ONE RATE PER TIER, MONTHLY.** `TIER_PRICE[tier].monthlyCents` is the only figure,
 *      and there is deliberately no annual rate — `lib/plans.ts` records why one was
 *      withdrawn, and "do not put a yearly figure back by multiplying" is a rule this module
 *      obeys rather than reopens. A year in advance is twelve months at the monthly rate.
 *
 *   2. **EVERY FAMILY BILLS ON THE 1st.** Not on the anniversary of the day they signed up.
 *      The first payment is the REMAINDER OF THE CURRENT MONTH, prorated by the day and
 *      rounded up; every payment after it lands on the 1st. `prorateRemainderCents` and
 *      `nextFirstOfMonth` are the whole of it, and the consequence worth knowing is that
 *      **`paid_through` is always the last day of a month** — which is what makes rules 3
 *      and 4 one expression rather than two.
 *
 *   3. **PAY IN ADVANCE, UP TO SIXTY MONTHS.** Either a monthly subscription that renews on
 *      the 1st, or one payment covering the rest of this month plus N whole months.
 *      `MAX_PREPAY_MONTHS` is the ceiling and it is a practical one, not a pricing one — and
 *      it doubles as the longest a downgrade can be deferred, which its own note explains.
 *
 *   4. **NO REFUNDS, EVER, AND A DOWNGRADE WAITS FOR THE BILLING CYCLE.** Moving down takes
 *      nothing back and changes nothing today: it lands on the next 1st for a family paying
 *      monthly, and on the 1st AFTER a prepaid term is exhausted for a family that paid
 *      ahead. Six months of Plus, downgraded in month two, is Plus for months two to six and
 *      Standard from month seven. `downgradeEffectiveOn` is one line because of rule 2.
 *
 *   5. **MOVING UP TAKES EFFECT AT ONCE**, and what is charged is the shortfall between what
 *      the new tier costs to the next 1st and what the unused old term is WORTH at the rate it
 *      was bought at — often nothing. Never the difference across the whole prepaid term. See
 *      `upgradeQuote`, and `prepaidPurchase` for the buying-months case it is not.
 *
 *   6. **`families.tier` IS MOVED BY ONE THING.** `apply_due_platform_tier_changes()` in
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
 * SIXTY MONTHS. It went 36 -> 6 -> 60 on 2026-08-23, and the middle step was a
 * misunderstanding worth recording: 36 was never a DEFAULT anybody would be charged, it was the
 * CEILING on an optional field, and it was briefly cut to 6 on the belief that a family
 * pressing "pay in advance" would be asked for three years. They are not — the presets and the
 * Months field decide what is BOUGHT, and this only decides what is REFUSED.
 *
 * What it is protecting: a hosted Checkout page with an
 * adjustable quantity is a number field a stranger can type into, and `999999` months is a
 * real charge for a real amount of money that we would then owe somebody a service for until
 * the 84th century. Stripe enforces the maximum on the page and `startPlanCheckout` enforces
 * it again in the action, because the page in front of an endpoint is a convenience and not a
 * gate (AGENTS.md §2).
 *
 * ── AND IT BOUNDS HOW FAR A DOWNGRADE CAN BE PUSHED OUT, WHICH IS NOW FIVE YEARS ────
 * Under rule 4 a family keeps its tier until a prepaid term is exhausted, so this ceiling IS
 * the longest a downgrade can be deferred. A family that prepays sixty months of Plus and asks
 * to move to Standard in month two stays on Plus for fifty-eight more months — correct by the
 * no-refunds rule, and a long time to owe somebody a plan they asked to leave. A consequence
 * of the ceiling rather than a separate decision, and the one worth knowing before raising it.
 */
export const MAX_PREPAY_MONTHS = 60

/**
 * The options a screen offers, in whole months ON TOP of the current month's remainder.
 *
 * PRESETS ARE NOT A LIMIT. The hosted page carries `adjustable_quantity`, so a family that
 * wants seven months types seven. These are the ones worth a button, and the labels are the
 * caller's business — 12 is "a year" to a reader and "12" to this module.
 */
export const PREPAY_PRESET_MONTHS: readonly number[] = [1, 3, 6, 12, 24, 60]

/**
 * The smallest FIRST payment this product will take on its own, in cents.
 *
 * ── A PRODUCT RULE, NOT A PROCESSOR LIMIT, AND THE DIFFERENCE IS THE POINT ──────────
 * $5.00, decided 2026-08-23: *"if the prorated is under $5 then the initial payment will be the
 * prorated + the following month."* Below it the rest of the month is not offered on its own,
 * and the first payment covers this month AND next. `initialChargeOptions` decides that.
 *
 * It was 50¢ for a few hours — Stripe's own floor — and the two are different KINDS of number.
 * 50¢ is what a card network will physically accept. $5 is what is worth putting on a family's
 * statement, and it is a much bigger threshold: at Standard's $10 a month it is roughly half a
 * month, so on any signup after about the 16th the combined option is the only one. That is a
 * lot of families, and it is the intended behaviour rather than an edge case.
 *
 * **IT MUST NEVER GO BELOW `STRIPE_MINIMUM_CHARGE_CENTS`**, which is the hard floor: under
 * that, Stripe refuses the charge and the family meets a hosted page that fails at the till
 * after they have chosen it. `initialChargeOptions` takes the HIGHER of the two rather than
 * this one, so lowering this constant can never reintroduce that failure — which is why both
 * live here and why the comparison is not written inline at the call site.
 */
export const MINIMUM_FIRST_CHARGE_CENTS = 500

/**
 * The smallest amount Stripe will accept as a charge, in cents.
 *
 * ── WHY A PAYMENT-PROCESSOR CONSTANT IS IN THE PURE MODULE ──────────────────────────
 * Because it changes an ARITHMETIC answer, not just an API call, and because the product rule
 * above has to stay above it — a bound is only checkable if both numbers are in one place.
 *
 * 50¢ is Stripe's USD minimum, and it is genuinely reachable rather than theoretical: one day
 * of Standard in a 31-day month is `ceil(1000 / 31)` = 33¢. A family billing in another
 * currency would need its own figure, which is one of several reasons nothing in this product
 * is multi-currency yet.
 */
export const STRIPE_MINIMUM_CHARGE_CENTS = 50

/** A month count this product will accept. Integral, at least one, at most the ceiling. */
export function isPrepayMonths(value: unknown): value is number {
  return typeof value === 'number'
    && Number.isInteger(value)
    && value >= 1
    && value <= MAX_PREPAY_MONTHS
}

/**
 * What N WHOLE MONTHS of a tier costs, or null where there is nothing to sell.
 *
 * THE WHOLE MONTHS ONLY. Under rule 2 a prepaid purchase is also the current month's
 * remainder, and `prepaidChargeCents` is the figure a family is actually asked for. This one
 * is the half that goes on the recurring price line, which is why the two exist separately
 * rather than one taking a flag.
 *
 * NULL FOR FREE, deliberately, and callers must not read it as zero. Free has no price because
 * it is not bought — a `0` here would let a checkout session be created for it, and Stripe
 * would either refuse the line item or, worse, accept it and give us a paid-through date for a
 * tier nobody paid for.
 */
export function prepayQuoteCents(tier: FamilyTier, months: number): number | null {
  const price = TIER_PRICE[tier]
  if (!price || !isPrepayMonths(months)) return null
  return price.monthlyCents * months
}

/**
 * What a prepaid purchase actually costs TODAY: the rest of this month plus N whole months.
 *
 * The figure on the button, and the figure Stripe is asked for. Both halves are returned as
 * well as the total, because a screen that shows one number for two things invites the
 * question "why is it not six times five?" — and the answer is a stub month somebody should
 * have been told about before they paid.
 *
 * `extendingLiveTerm` SKIPS THE PRORATION, and it is the case that would otherwise
 * double-charge: a family whose term runs to 28 February buying six more months owes six
 * months, not six months plus the rest of whatever month it happens to be. They already own
 * the rest of this month.
 */
export interface PrepaidCharge {
  /** The current month's remainder, or 0 when the family already owns it. */
  prorationCents: number
  /** `months × monthlyCents`. */
  monthsCents: number
  totalCents: number
  months: number
}

export function prepaidChargeCents(input: {
  tier: FamilyTier
  months: number
  today: string
  /** True when a paid term is already live, so the current month needs no proration. */
  extendingLiveTerm?: boolean
}): PrepaidCharge | null {
  const monthsCents = prepayQuoteCents(input.tier, input.months)
  if (monthsCents == null) return null
  const prorationCents = input.extendingLiveTerm
    ? 0
    : (prorateRemainderCents(input.tier, input.today) ?? 0)
  return {
    prorationCents,
    monthsCents,
    totalCents: prorationCents + monthsCents,
    months: input.months,
  }
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

// ── The billing cycle: everybody on the 1st ─────────────────────────────────────────
//
// ── WHY A COMMON CYCLE RATHER THAN AN ANNIVERSARY ───────────────────────────────────
// The obvious model is that a family's month runs from the day they signed up, which is what
// Stripe does by default and what this module did until 2026-08-23. A common cycle is better
// here for reasons that are about the PRODUCT rather than about billing:
//
//   * a downgrade has an obvious effective date, and it is the same date for everybody. Rule
//     4 stops being a policy anybody has to remember and becomes "the next 1st".
//   * `paid_through` is always a month end, which makes "the day after the term ends" and
//     "the next billing date" the SAME EXPRESSION. Two rules collapse into one.
//   * a family reading a statement sees calendar months, which is how a treasurer thinks
//     about a budget. "Paid through 14 November" invites the question this avoids.
//
// The cost is the stub period at the start, and that is what `prorateRemainderCents` is for.

/** The 1st of the month `iso` falls in. */
export function firstOfMonth(iso: string): string {
  return `${iso.slice(0, 7)}-01`
}

/** The 1st of the month AFTER the one `iso` falls in — the next billing date. */
export function nextFirstOfMonth(iso: string): string {
  const d = parseISO(iso)
  return toISO(new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 1)))
}

/** The last day of the month `iso` falls in, as `YYYY-MM-DD`. */
export function lastDayOfMonthISO(iso: string): string {
  return addDays(nextFirstOfMonth(iso), -1)
}

/** How many days the month `iso` falls in has. 28, 29, 30 or 31. */
export function daysInMonth(iso: string): number {
  const d = parseISO(iso)
  return lastDayOfMonth(d.getUTCFullYear(), d.getUTCMonth())
}

/**
 * Days left in the month INCLUDING today.
 *
 * INCLUSIVE OF TODAY, because a family that pays on the 23rd is paying for the 23rd. The 1st
 * of a 31-day month is 31 days and the 31st is 1 day; there is no zero.
 */
export function daysLeftInMonth(iso: string): number {
  return daysBetween(iso, nextFirstOfMonth(iso))
}

/**
 * What the rest of this month costs at a tier's monthly rate. Null for a tier with no price.
 *
 * ── ROUNDED UP, AND THE DENOMINATOR IS THE ACTUAL MONTH ─────────────────────────────
 * `ceil(monthlyCents × daysLeft ÷ daysInMonth)`. Two decisions in one line:
 *
 *   ROUNDED UP to the cent, which is what was asked for. It also removes the case that would
 *   otherwise need its own branch: a rate that divides to a fraction of a cent can never
 *   produce a zero charge for a day somebody is being given service for.
 *
 *   THE DENOMINATOR IS THE DAYS IN THAT MONTH, not a flat 30. Ten days of Premium is $8.93 in
 *   February and $8.07 in July, and that is the correct answer to "a tenth of this month":
 *   a flat 30 would charge for 30 days in a 31-day month and give a day away every long month,
 *   or charge February a day it does not have. It is also what Stripe's own proration does, so
 *   our figure and any figure on their side agree.
 */
export function prorateRemainderCents(tier: FamilyTier, today: string): number | null {
  const price = TIER_PRICE[tier]
  if (!price) return null
  return Math.ceil((price.monthlyCents * daysLeftInMonth(today)) / daysInMonth(today))
}

/**
 * What a family can be offered as a FIRST payment, on a given day.
 *
 * ── TWO OPTIONS, AND SOMETIMES ONLY ONE ─────────────────────────────────────────────
 *   `remainderOnly`   the rest of this month, prorated. Recurring billing starts on the 1st.
 *   `remainderPlusNext`  the same plus the whole of next month, so the first invoice on the
 *                        1st is a month away rather than days away.
 *
 * `remainderOnly` IS NULL BELOW THE FLOOR, which is not a defensive check — it is the ordinary
 * case for half of every month. The floor is `max(MINIMUM_FIRST_CHARGE_CENTS,
 * STRIPE_MINIMUM_CHARGE_CENTS)`: the first is the product rule ($5, decided), the second is
 * what a card network will physically accept (50¢), and taking the HIGHER means lowering the
 * product rule can never reintroduce a charge Stripe refuses. At Standard's $10 a month, $5 is
 * about sixteen days — so a family signing up on the 20th is offered the combined option alone,
 * and the screen says why rather than leaving them to wonder.
 *
 * `daysLeft` is returned so a screen can say "10 days" rather than making the reader work it
 * out from two dates, which is the difference between a sentence somebody trusts and a figure
 * they check.
 */
export interface InitialChargeOptions {
  daysLeft: number
  daysInMonth: number
  /** The next billing date — the 1st. Every family's, whichever option is taken. */
  nextBillingDate: string
  /** The rest of this month, or null when it is below Stripe's minimum charge. */
  remainderOnly: number | null
  /** The rest of this month plus one whole month. Always available. */
  remainderPlusNext: number | null
  /** The last day the combined option covers, so a screen can name it. */
  remainderPlusNextThrough: string
}

export function initialChargeOptions(tier: FamilyTier, today: string): InitialChargeOptions {
  const remainder = prorateRemainderCents(tier, today)
  const monthly = TIER_PRICE[tier]?.monthlyCents ?? null
  const next = nextFirstOfMonth(today)
  // THE HIGHER OF THE TWO, so lowering the product rule can never drop below what Stripe will
  // accept. See both constants.
  const floor = Math.max(MINIMUM_FIRST_CHARGE_CENTS, STRIPE_MINIMUM_CHARGE_CENTS)
  return {
    daysLeft: daysLeftInMonth(today),
    daysInMonth: daysInMonth(today),
    nextBillingDate: next,
    remainderOnly: remainder != null && remainder >= floor ? remainder : null,
    remainderPlusNext: remainder != null && monthly != null ? remainder + monthly : null,
    remainderPlusNextThrough: lastDayOfMonthISO(next),
  }
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

// ── Moving UP from a term that was paid in advance ──────────────────────────────────
//
// ── THE MODEL, AND IT IS NOT PRORATION-BY-DIFFERENCE ────────────────────────────────
// The obvious approach is to bill the difference between the two rates across whatever is left
// of the prepaid term. That is wrong and was ruled out explicitly: six prepaid months of
// Standard lifted to Premium would be six months of the $20 difference — $120 — which is a bill
// nobody asked for on the day they chose to spend more.
//
// What happens instead: the unused part of the old term is valued AT THE OLD RATE, and that
// value is spent on the new tier. Nothing is refunded, nothing is forfeited, and the family is
// never asked for more than the shortfall.
//
//     6 months of Standard bought 1 Jan, upgrading to Premium on 15 Feb
//
//     unused at the OLD rate    rest of Feb $2.50 + Mar..Jun $20.00   =  $22.50
//     rest of Feb at the NEW rate                 $25 x 14/28         =  $12.50
//     ------------------------------------------------------------------------
//     due now                                                            $0.00
//     credit carried                                                     $10.00
//
// and then a choice, because a family that has just upgraded mid-month is about to meet a
// full invoice on the 1st and may rather settle it now:
//
//     take March as well        needed $12.50 + $25.00 = $37.50, less $22.50  =  $15.00 now
//     leave it                  $0.00 now, and the $10.00 credit draws against
//                               the 1 March invoice, making it $15.00 then
//
// Both come to the same $15; the only question is when. `upgradeQuote` answers both.
//
// ── THE CREDIT IS REAL MONEY AND STRIPE HOLDS IT ────────────────────────────────────
// A customer credit balance, drawn down automatically against future invoices. It is mirrored
// in `platform_billing_accounts.credit_cents` for display only — Stripe is the ledger of
// record, exactly as it is for every other figure in this feature.

/**
 * Whole calendar months from the month of `fromDay` through the month of `throughDay`.
 *
 * INCLUSIVE OF BOTH ENDS, because that is what a term is: 1 March through 30 June is four
 * months, not three. Off by one here is a month of somebody's money.
 */
export function wholeMonthsInclusive(fromDay: string, throughDay: string): number {
  const a = parseISO(fromDay)
  const b = parseISO(throughDay)
  const months = (b.getUTCFullYear() * 12 + b.getUTCMonth())
    - (a.getUTCFullYear() * 12 + a.getUTCMonth()) + 1
  return Math.max(0, months)
}

/**
 * What the unused part of a paid term is WORTH, at the rate it was bought at.
 *
 * Two parts, and both are needed: the rest of the current month prorated by the day, plus every
 * whole month from the next 1st through the end of the term. Valued at the OLD tier's rate
 * because that is what the family paid — valuing it at the new rate would be inventing money.
 *
 * ZERO for a lapsed term, a term that never existed, or a tier with no price (Free was never
 * paid for, so there is nothing to carry).
 */
export function unusedTermValueCents(input: {
  tier: FamilyTier | null
  paidThrough: string | null
  today: string
}): number {
  const { tier, paidThrough, today } = input
  if (!tier || !paidThrough) return 0
  const price = TIER_PRICE[tier]
  if (!price) return 0
  if (daysBetween(today, paidThrough) < 0) return 0

  const thisMonth = prorateRemainderCents(tier, today) ?? 0
  const nextFirst = nextFirstOfMonth(today)
  // A term ending this month has no whole months left, and `wholeMonthsInclusive` floors at 0
  // rather than going negative — which is what would otherwise SUBTRACT from the value.
  const wholeMonths = daysBetween(nextFirst, paidThrough) >= 0
    ? wholeMonthsInclusive(nextFirst, paidThrough)
    : 0
  return thisMonth + wholeMonths * price.monthlyCents
}

export interface UpgradeQuote {
  /** The unused old term, valued at the old rate. */
  creditCents: number
  /** What the new tier costs for the period being bought now. */
  neededCents: number
  /** What the family is actually asked for. Never negative. */
  dueNowCents: number
  /** What is left over, to be held as a credit against future invoices. */
  creditLeftCents: number
  /** The new INCLUSIVE end of the paid term. Always a month end. */
  paidThrough: string
  /** True when this quote includes the whole of next month as well. */
  includesNextMonth: boolean
}

/**
 * What an upgrade costs today, in both shapes.
 *
 * ── WIRED 2026-08-23, IN THREE PLACES THAT MUST AGREE ───────────────────────────────
 *   `changePlanTier` -> `upgradeFromPrepaid`   creates the session, or applies it outright
 *                                              when `dueNowCents` is zero — which is what the
 *                                              worked example produces at the 10/20/30 prices,
 *                                              and the branch a first draft forgets: routing it
 *                                              through Checkout would show a family a payment
 *                                              page for $0.00.
 *   `onUpgradePaid` in lib/stripe/platform-events.ts   applies it once the shortfall is paid.
 *   `UpgradeDialog` in components/admin/BillingPanel.tsx   shows the three figures.
 *
 * All three call THIS function rather than repeating the arithmetic, which is what makes the
 * number on the button the number Stripe asks for. The leftover is held as a Stripe customer
 * credit balance (a NEGATIVE balance transaction — the sign is the one thing to get right) and
 * mirrored in `platform_billing_accounts.credit_cents` for display only.
 *
 * `includeNextMonth` is the family's choice, not ours: settle the coming invoice now, or leave
 * it and let the credit draw against it on the 1st. Both end at the same place — this returns
 * the numbers so a screen can put them side by side rather than asking somebody to work out
 * which is cheaper. (Neither is. They are the same money at different times.)
 *
 * ── IT NEVER RETURNS A NEGATIVE `dueNowCents` ───────────────────────────────────────
 * `max(0, …)` on both halves, and the two are not redundant: a family whose credit exceeds
 * what they need owes nothing AND keeps the difference. Letting `dueNowCents` go negative would
 * be a refund — the one direction this system does not move in — and letting `creditLeftCents`
 * go negative would silently cancel out a real debt.
 */
export function upgradeQuote(input: {
  fromTier: FamilyTier | null
  toTier: FamilyTier
  paidThrough: string | null
  today: string
  includeNextMonth: boolean
}): UpgradeQuote | null {
  const { fromTier, toTier, paidThrough, today, includeNextMonth } = input
  const newPrice = TIER_PRICE[toTier]
  if (!newPrice) return null

  const creditCents = unusedTermValueCents({ tier: fromTier, paidThrough, today })
  const thisMonth = prorateRemainderCents(toTier, today) ?? 0
  const neededCents = thisMonth + (includeNextMonth ? newPrice.monthlyCents : 0)

  return {
    creditCents,
    neededCents,
    dueNowCents: Math.max(0, neededCents - creditCents),
    creditLeftCents: Math.max(0, creditCents - neededCents),
    paidThrough: includeNextMonth
      ? lastDayOfMonthISO(nextFirstOfMonth(today))
      : lastDayOfMonthISO(today),
    includesNextMonth: includeNextMonth,
  }
}

export interface PrepaidPurchase {
  /** The new INCLUSIVE last day of the paid term. Always the last day of a month. */
  paidThrough: string
  /** Days carried over from a cheaper term — 0 unless this is an upgrade. */
  creditedDays: number
  /** Where the purchased months were counted from, for a screen that wants to explain it. */
  anchor: string
}

/**
 * Where N whole months from a starting 1st ends — always a month end.
 *
 * `prepaidTermEnd('2026-09-01', 6)` is `2027-02-28`: September through February inclusive.
 * The month-end clamp lives in `lastDayOfMonthISO`, so nothing here can produce a 31 February.
 */
export function prepaidTermEnd(firstDay: string, months: number): string {
  const d = parseISO(firstDay)
  return lastDayOfMonthISO(
    toISO(new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + months - 1, 1))),
  )
}

/**
 * Where a prepaid purchase of `months` at `tier` leaves the family's term.
 *
 * ── EVERY ANSWER IS A MONTH END, WHICH IS THE CHANGE OF 2026-08-23 ──────────────────
 * This used to count month ANNIVERSARIES from the day of purchase, so a six-month term bought
 * on the 23rd ended on the 23rd. Under rule 2 a term runs to a month END, and `months` counts
 * WHOLE CALENDAR MONTHS on top of the current month's remainder:
 *
 *     bought 23 Aug, months = 6   ->   the rest of August (prorated) + Sep..Feb
 *                                      paid_through = 28 Feb
 *
 * So the AMOUNT charged is `prorateRemainderCents(tier, today) + months × monthlyCents`, and
 * the caller states both halves on screen rather than quoting one number for two things.
 *
 * TWO ANCHORS, ONE PER SITUATION:
 *
 *   no live term      the 1st of NEXT month. The current month's remainder is the prorated
 *                     stub, and the whole months begin after it.
 *   live term, same   the 1st after the current term ends. This is what paying in advance
 *   tier              MEANS: a second six months bought in March starts when the first
 *                     finishes, not in March. No proration — the family is not buying any
 *                     part of a month they already own.
 *
 * ── AN UPGRADE DOES NOT COME THROUGH HERE, AND THAT IS NOT AN OPEN QUESTION ─────────
 * It was one until 2026-08-23 and is now settled: `upgradeQuote` above is the rule — value the
 * unused old term at the OLD rate, spend it on the new tier, carry the remainder as a credit.
 * This function is for BUYING MONTHS, which an upgrade is not: an upgrade buys the rest of this
 * month (and optionally next) and changes the tier at once.
 *
 * A caller that reaches this with an upgrade anyway gets the SAME-TIER answer — the term is
 * extended and nothing is lost. That is the safe direction for a call that should not have
 * happened: the family keeps what it paid for and is never overcharged.
 */
export function prepaidPurchase(input: {
  record: PlatformBillingRecord
  tier: FamilyTier
  months: number
  today: string
}): PrepaidPurchase {
  const { record, months, today } = input
  const live = record.paidThrough != null && daysBetween(today, record.paidThrough) >= 0

  // The 1st the whole months start on: after the current term for a live one, otherwise after
  // the stub month the proration covers.
  const anchor = live ? addDays(record.paidThrough as string, 1) : nextFirstOfMonth(today)

  return { paidThrough: prepaidTermEnd(anchor, months), creditedDays: 0, anchor }
}

export interface ScheduledDowngrade {
  tier: FamilyTier
  /** The day the new tier starts. Always a 1st. */
  on: string
}

/**
 * When a downgrade takes effect. **Always a 1st, and never today.**
 *
 * ── ONE EXPRESSION FOR BOTH CASES, WHICH IS WHAT RULE 2 BOUGHT ──────────────────────
 * A family paying monthly moves on the next 1st. A family that paid six months ahead keeps
 * its tier until that term is exhausted and moves on the 1st after it. Those look like two
 * rules and are one, because under 1st-of-month billing `paid_through` is ALWAYS the last day
 * of a month — so `paid_through + 1` is a 1st in both cases, and the only difference is which
 * month it lands in.
 *
 * `paid_through` is INCLUSIVE, so a term ending on 31 December is served through the 31st and
 * the new tier starts on 1 January. Scheduling it ON `paid_through` would take a day the
 * family paid for, which is a refund in the only direction this system does not do.
 *
 * ── IT NEVER RETURNS NULL ANY MORE, AND THAT IS THE POINT OF THE CHANGE ─────────────
 * It used to answer null for a family with no live term, meaning "apply it now". That was the
 * anniversary model's answer and it is wrong under a billing cycle: a family on Free-by-lapse
 * that presses downgrade on the 14th still moves on the 1st, because the 1st is when anything
 * about a plan changes. A caller that wants "now" is asking for something this product does
 * not do.
 */
export function scheduleDowngrade(input: {
  record: PlatformBillingRecord
  toTier: FamilyTier
  today: string
}): ScheduledDowngrade {
  const { record, toTier, today } = input
  const live = record.paidThrough != null && daysBetween(today, record.paidThrough) >= 0
  // `nextFirstOfMonth` RATHER THAN `+1 day`, and the difference only shows on a row that
  // should not exist. Under rule 2 `paid_through` is always a month end, so the two agree —
  // but a row left over from the anniversary model, or written by hand, could hold a mid-month
  // date, and `+1` would then land a downgrade on the 24th of a month. This form is a 1st
  // unconditionally, and where the two differ it errs by giving the family the rest of that
  // month, which is the safe direction for a bad row.
  return { tier: toTier, on: nextFirstOfMonth(live ? (record.paidThrough as string) : today) }
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
