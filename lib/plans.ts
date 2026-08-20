/**
 * What each plan includes, in the words a member reads INSIDE the product.
 *
 * ── WHY THIS EXISTS RATHER THAN A LINK TO `/pricing` ────────────────────────────────
 * `/pricing` is Home — the marketing site, for somebody who is not signed in. Sending a
 * member there to find out what their family is on takes them out of the Dashboard and
 * into an advertisement, complete with a hero, testimonials and a "Create Your Free
 * Account" button aimed at somebody who already has one. Two surfaces inside the product
 * were doing exactly that, and both now answer the question where it was asked:
 * `/admin/family` (the plan panel) and `/upgrade` (the tier wall).
 *
 * ── IT IS NOT DERIVED FROM `/pricing`, AND MUST NOT BE ──────────────────────────────
 * The same rule `lib/features.ts` states about `PLANS[]`: that table is prose about
 * BENEFITS aimed at a buyer, and it does not correspond one to one with anything. This is
 * the shorter, flatter version a member needs — no prices, no calls to action, no
 * inheritance rendering — keyed by `FamilyTier` so a lookup cannot miss.
 *
 * The two are kept in step BY HAND, deliberately, and the cost of that is real: an edit
 * to `PLANS[]` on `/pricing` should be reflected here in the same commit. Generating
 * either from the other would mean inventing a correspondence that does not exist — one
 * marketing bullet frequently spans several routes, and several routes are sold in no
 * bullet at all.
 *
 * ── THE PRICE LIVES HERE, AND IT IS THE ONE THING `/pricing` DOES SHARE ─────────────
 * This section used to say a price MAY NOT appear here, on the grounds that none had been
 * decided. Two have been (2026-08-17), so `TIER_PRICE` below is the figure and both the
 * marketing page and the two in-product surfaces read it from here.
 *
 * That is not a contradiction of the paragraph above, and the distinction is worth being
 * precise about, because it is the whole reason one is shared and the other is not:
 *
 *   * A BENEFIT LIST does not correspond one to one with anything. One marketing bullet
 *     spans several routes, several routes are sold in no bullet at all, and the words a
 *     buyer needs are not the words a member needs. Deriving either list from the other
 *     would mean inventing a correspondence that does not exist — so `PLAN_ADDS` and
 *     `PLANS[]` stay separate and are kept in step by hand.
 *   * A PRICE is one number per tier. There is no correspondence to invent, and two copies
 *     of a number is exactly how a member comes to be shown $10 on one screen and $12 on
 *     the next. It goes in one place, and this is the pure module both halves can import.
 *
 * PURE — data only, no React, no database, no `server-only`. Imported by a server page, a
 * client panel, the upgrade screen and the marketing pricing page; the rule that keeps that
 * safe is the one `lib/tiers.ts` and `lib/features.ts` both state.
 */

import { TIER_RANK, TIERS, tierMeets, type FamilyTier } from '@/lib/tiers'
import { formatCurrency } from '@/lib/currency-utils'

export interface PlanHighlight {
  /** The benefit, in the fewest words that land it. */
  label: string
  /** The mechanism, for whoever slowed down. */
  detail: string
}

/**
 * What each tier ADDS on top of the one below it — never a restatement of the whole
 * offer.
 *
 * Same shape as `/pricing`'s `adds`, and for the same two reasons: a restated list drifts,
 * so that adding something to Free eventually leaves the expensive tier appearing to offer
 * less than the free one; and "everything in Free, and…" is the honest shape of the offer.
 * `tiersIncludedIn()` is what a caller uses to render the inheritance.
 */
export const PLAN_ADDS: Record<FamilyTier, readonly PlanHighlight[]> = {
  free: [
    {
      label: 'Every relative, at no charge',
      detail: 'Unlimited members, with no per-person fee.',
    },
    {
      label: 'The family tree and the directory',
      detail: 'Who is who, how they are related, and how to reach them.',
    },
    {
      label: 'The reunion on the calendar',
      detail: 'The date, the place and the details in one shared page.',
    },
    {
      label: 'Announcements the whole family sees',
      detail: 'Family news on everyone’s dashboard instead of buried in a group text.',
    },
    {
      label: 'A real ledger for the money you collect',
      detail: 'Dues plans and a contribution ledger for cash, recorded instead of remembered.',
    },
    {
      label: 'Separation of duties',
      detail: 'Per-feature permissions, so recording dues is not the same as paying money out.',
    },
    {
      label: 'Chat, family-wide and private',
      detail: 'Keep talking between gatherings.',
    },
  ],
  plus: [
    {
      label: 'Take payment the way your family pays',
      detail: 'Card, debit, PayPal, Apple Pay, Google Pay and Cash App, with funds behind them.',
    },
    // THIS BULLET SOLD RSVPs, MEAL TOTALS AND DAY-OF CHECK-IN until 2026-08-19, and all three
    // went with the Events product. What replaced it is what the family actually gets:
    // Dues Projections, which IS a Plus route (`lib/features.ts`) and is the one figure
    // leadership asks for that this tier really delivers today.
    {
      label: 'Know what is still owed, before you have to ask',
      detail: 'Every relative who owes this year, what has come in, and who has still to pay.',
    },
    {
      label: 'A profit and loss for your treasurer',
      detail: 'The statement the board asks for, straight from the ledger.',
    },
    {
      label: 'The numbers leadership asks for',
      detail: 'Dues collected against outstanding, and the family’s size over time.',
    },
    {
      label: 'Elect your officers properly',
      detail: 'Nominate, accept or decline, then vote family-wide.',
    },
    {
      label: 'The paperwork, and the structure to match',
      detail: 'Bylaws and minutes, plus regions and chapters with their own leadership.',
    },
    {
      label: 'Photographs, findable',
      detail: 'Collections per gathering with tagging, and a face against every name.',
    },
  ],
  premium: [
    {
      label: 'Stop chasing relatives for their dues',
      detail: 'Reminders go out as each installment falls due, and stop when it is paid.',
    },
    {
      label: 'News that arrives rather than waiting to be found',
      detail: 'Notifications on the phone and in the browser.',
    },
    {
      label: 'The family in everybody’s pocket',
      detail: 'Apps for iPhone and Android, on the same family account.',
    },
    {
      label: 'Email the whole family without building a list',
      detail: 'Distributions drawn straight from your membership.',
    },
    {
      label: 'Your family’s own website, keeping itself current',
      detail: 'It builds itself from your next gathering, newest photographs and latest announcement.',
    },
  ],
}

/**
 * What a tier costs. `null` for Free, which has no price rather than a price of zero — the
 * difference matters to every caller, because "Free" is the word and "$0.00" is a figure
 * nobody should render.
 *
 * CENTS, INTEGER, like every other money value in this codebase (`installmentCents`,
 * `remainingBalanceCents`, `formatCurrency`). Floating-point dollars are how a total comes
 * out at $99.99999999.
 *
 * `yearly` is the whole twelve months paid in advance, NOT a discounted monthly rate — so it
 * is compared against twelve times `monthly` rather than being derived from it. Both figures
 * today work out to ten months for twelve, which is a real argument and therefore worth
 * stating on the page; `annualSavingCents()` and `monthsFreeOnAnnual()` derive it so the
 * sentence cannot drift from the numbers above it.
 */
export interface TierPrice {
  /** Per month, month to month. */
  monthlyCents: number
  /** Charged once, covering twelve months. */
  yearlyCents: number
}

export const TIER_PRICE: Record<FamilyTier, TierPrice | null> = {
  free: null,
  plus: { monthlyCents: 1_000, yearlyCents: 10_000 },
  premium: { monthlyCents: 2_500, yearlyCents: 25_000 },
}

/** What paying for the year up front saves against twelve monthly payments. */
export function annualSavingCents(price: TierPrice): number {
  return price.monthlyCents * 12 - price.yearlyCents
}

/**
 * The saving expressed as months, when it divides evenly — "two months free" lands where
 * "$20 a year" does not.
 *
 * `null` when it does not divide, which is the honest answer rather than a rounded one: a
 * price change that made the saving 1.6 months would otherwise be advertised as "1 month
 * free" or "2 months free", and both are wrong. Callers fall back to the currency figure.
 */
export function monthsFreeOnAnnual(price: TierPrice): number | null {
  const saving = annualSavingCents(price)
  if (saving <= 0 || saving % price.monthlyCents !== 0) return null
  return saving / price.monthlyCents
}

/**
 * "$10" rather than "$10.00" for a whole number of dollars.
 *
 * A price is scanned, not audited, and the two trailing zeroes are noise at 48px. Anything
 * with cents in it keeps them, so a future $12.50 renders correctly without a second helper —
 * which is the reason this wraps `formatCurrency` instead of replacing it.
 *
 * NO `cents % 100 === 0` GUARD, and its absence is deliberate rather than an omission. The
 * first version had one, and mutation-testing this file found it to be dead code: `$12.50`
 * and `$12.05` do not end in `.00`, so the anchored regex already declines to touch them and
 * the guard could not change an answer. Two expressions of one condition, one of which never
 * decides anything, is a thing a later reader has to work out from scratch — so the regex is
 * left to do the whole job. `lib/plans.test.ts` pins both branches by value.
 */
export function formatPlanPrice(cents: number): string {
  return formatCurrency(cents).replace(/\.00$/, '')
}

/**
 * Whether a tier can be BOUGHT today, as opposed to merely existing.
 *
 * Mirrors `PLANS[].available` on `/pricing`, which says "Available now" on Free and "Not
 * yet available" on the other two — because nothing has been sold and there is no billing.
 * Read it before writing any copy that implies a purchase: the plan panel is scaffolding
 * for a decision, not a checkout, and it says so.
 *
 * A PRICE AND A PURCHASE ARE NOW SEPARATE FACTS, since 2026-08-17. `TIER_PRICE` says what
 * Plus and Premium cost; this says neither can be bought yet. Both are true, and collapsing
 * them was the temptation to resist: a figure on the card with no way to pay is honest —
 * "here is what it will cost" — whereas a button that takes a decision nothing can charge
 * for is not. Every surface that shows a price must still read this before it shows a
 * control.
 */
export const TIER_IS_SOLD: Record<FamilyTier, boolean> = {
  free: true,
  plus: false,
  premium: false,
}

/** The three tiers, cheapest first — re-exported so a UI need not import two modules. */
export const PLAN_ORDER: readonly FamilyTier[] = TIERS

/** What moving from one plan to another does, in both directions. See `planChange()`. */
export interface PlanChange {
  /** True when the destination is above the origin — pages open up rather than close. */
  up: boolean
  /**
   * The benefits that MOVE: gained on the way up, withheld on the way down. Every tier
   * strictly between the two, inclusive of the higher one, flattened in plan order.
   */
  changing: readonly PlanHighlight[]
  /**
   * The benefits that do NOT move — everything the LOWER of the two tiers carries. On the
   * way up that is what the family already has; on the way down it is what survives, and
   * that is the reassuring half of a downgrade rather than a footnote to it.
   */
  keeping: readonly PlanHighlight[]
}

/**
 * Everything added by the tiers ABOVE `after`, up to and including `through`.
 *
 * The one range operation the panel needs, and both dialogs cut somewhere different with
 * it: a plan change cuts at the tier the family is leaving, and the feature dialog cuts at
 * whichever of "what you have" or "the rung below this plan" is the honest boundary. Doing
 * that arithmetic at a call site is how Free-to-Premium came to be answered with Premium's
 * five benefits and no mention of the seven on Plus that arrive with them.
 *
 * `after` is `undefined` for "from the bottom", which is not an edge case — it is how the
 * whole of a plan's stack is asked for, and Free has nothing beneath it.
 */
export function planAddsBetween(
  after: FamilyTier | undefined,
  through: FamilyTier,
): readonly PlanHighlight[] {
  const floor = after ? TIER_RANK[after] : -1
  return TIERS
    .filter(t => TIER_RANK[t] > floor && TIER_RANK[t] <= TIER_RANK[through])
    .flatMap(t => PLAN_ADDS[t])
}

/**
 * The difference between two plans, as two lists.
 *
 * ── WHY A DIFF, WHEN `PLAN_ADDS` IS ALREADY A DIFF ─────────────────────────────────
 * `PLAN_ADDS` is a diff against the tier immediately BELOW, which is the right thing to
 * store and the wrong answer to "what changes if I do this?" — Free to Premium skips a
 * rung, so reading `PLAN_ADDS.premium` alone names five things and silently omits the
 * seven on Plus that come with them. This walks the rungs, so a two-step move states
 * both.
 *
 * It is symmetric on purpose: the same call answers an upgrade and a downgrade, and the
 * caller reads `up` to decide whether `changing` is a list of gains or of losses. A
 * separate downgrade path would be a second place for the ordering to be got wrong, and
 * a downgrade shown as "nothing happens" is exactly the screen this exists to prevent.
 *
 * `from === to` is not an error — it yields an empty `changing`, since nothing moves.
 *
 * PURE, like everything else here: no React, no database. `tests` need no fixture.
 */
export function planChange(from: FamilyTier, to: FamilyTier): PlanChange {
  const up = tierMeets(to, from)
  const lower = up ? from : to
  const higher = up ? to : from

  return {
    up,
    changing: planAddsBetween(lower, higher),
    keeping: planAddsBetween(undefined, lower),
  }
}
