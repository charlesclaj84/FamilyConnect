/**
 * What each plan includes, in the words a member reads INSIDE the product.
 *
 * ── WHY THIS EXISTS RATHER THAN A LINK TO `/pricing` ────────────────────────────────
 * `/pricing` is Home — the marketing site, for somebody who is not signed in. Sending a
 * member there to find out what their family is on takes them out of the Dashboard and
 * into an advertisement, complete with a hero, testimonials and a "Create Your Free
 * Account" button aimed at somebody who already has one. Two surfaces inside the product
 * were doing exactly that, and both now answer the question where it was asked:
 * `/admin/settings` (the plan panel) and `/upgrade` (the tier wall).
 *
 * ── IT IS NOT DERIVED FROM `/pricing`, AND MUST NOT BE ──────────────────────────────
 * The same rule `lib/features.ts` states about `PLANS[]`: that table is prose about
 * BENEFITS aimed at a buyer, and it does not correspond one to one with anything. This is
 * the shorter, flatter version a member needs — no prices, no calls to action, no
 * inheritance rendering — keyed by `FamilyTier` so a lookup cannot miss.
 *
 * The two are WORDED by hand, deliberately, and the cost of that is real: an edit to
 * `PLANS[]` on `/pricing` has to be reflected here in the same commit. Generating either from
 * the other would mean inventing a correspondence that does not exist — one marketing bullet
 * frequently spans several routes, and several routes are sold in no bullet at all.
 *
 * ── AND SINCE 2026-08-22 THE *SET* OF CLAIMS IS CHECKED, WHICH IS NOT THE SAME THING ─
 * This header used to end there, and both files said a gate was impossible. It was not: the
 * WORDS cannot be compared and WHICH THINGS ARE SOLD can, and the second is exactly what had
 * drifted twice. Every bullet in both lists carries a `claim` id and
 * `npm run marketing:check` holds the two sets equal per tier. See `PlanHighlight.claim`.
 *
 * ── THE PRICE LIVES HERE, AND IT IS THE ONE THING `/pricing` DOES SHARE ─────────────
 * This section used to say a price MAY NOT appear here, on the grounds that none had been
 * decided. Three have been now — two on 2026-08-17 and Standard on 2026-08-19 — so
 * `TIER_PRICE` below is the figure and both the marketing page and the two in-product
 * surfaces read it from here.
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
  /**
   * WHICH CLAIM THIS IS, as a stable `<tier>/<slug>` id shared with the bullet on `/pricing`
   * that sells the same thing. Never rendered.
   *
   * The two lists stay separately WORDED — that is the whole argument above and it does not
   * change — and the SET of ids per tier must match, which `npm run marketing:check` asserts.
   * `PlanFeature.claim` in `components/marketing/PlanLadder.tsx` carries the full reasoning,
   * including why it is required rather than optional and why it is tier-prefixed.
   *
   * A claim with no counterpart is the drift this closes: it has happened twice, and the
   * expensive direction is a benefit sold on `/pricing` that the member's own plan panel
   * never mentions — a family paying for something the product never tells them they have.
   */
  claim: string
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
  // ── FREE LOST THREE BULLETS TO STANDARD ON 2026-08-19 ─────────────────────────────
  // The tree, the ledger and separation of duties went up a rung, and the calendar bullet was
  // NARROWED rather than moved: Free still puts a gathering on a shared calendar with its
  // date, place and details, and everything that turns that date into assigned work is
  // Standard. What is left is the promise the product is built on — get every relative in, at
  // no charge, and be able to find them and talk to them.
  free: [
    {
      claim: 'free/every-relative-free',
      label: 'Every relative, at no charge',
      detail: 'Unlimited members, with no per-person fee.',
    },
    {
      claim: 'free/directory',
      label: 'A directory of the whole family',
      detail: 'Who is who, and how to reach them.',
    },
    {
      claim: 'free/shared-calendar',
      label: 'The gathering on a shared calendar',
      detail: 'The date, the place and the details, on one page everybody can see.',
    },
    {
      claim: 'free/announcements',
      label: 'Announcements the whole family sees',
      detail: 'Family news on everyone’s dashboard instead of buried in a group text.',
    },
    {
      claim: 'free/chat',
      label: 'Chat, family-wide and private',
      detail: 'Keep talking between gatherings.',
    },
    // ── THREE ADDED 2026-08-22, in step with `PLANS[]` on /pricing ────────────────────
    // `npm run marketing:check` found eleven live screens the feature catalogue named
    // nowhere, and three of them were Free. That checker deliberately cannot see this list
    // or `PLANS[]` — a bullet is prose about a benefit and corresponds to no route — so
    // both hand-written lists were edited in the same commit, which is the discipline the
    // header above asks for and the thing that had already drifted twice.
    {
      claim: 'free/one-account-many-families',
      label: 'One account, however many families',
      detail: 'Belong to both sides, and switch between them without a second login.',
    },
    {
      claim: 'free/nothing-scrolls-away',
      label: 'Nothing is lost when it scrolls away',
      detail: 'Every announcement, and everything sent to you, searchable long afterwards.',
    },
    {
      claim: 'free/manual',
      label: 'A manual your relatives will actually use',
      detail: 'Every screen explained by name, reachable from the corner of the screen they are on.',
    },
  ],
  // ── STANDARD, ADDED 2026-08-19 ────────────────────────────────────────────────────
  // Four bullets came UP from Free and one came DOWN from Plus, and the two directions carry
  // different risks. Coming UP off Free is a thing families would have kept if there were any
  // — no family is using this product yet, which is what makes the restructure admissible at
  // all and is stated in the migration rather than assumed here. Coming DOWN from Plus
  // (profile pictures) is a giveaway, and a giveaway is the safe direction: nobody was ever
  // charged for it.
  //
  // WHAT MAKES THIS ONE TIER RATHER THAN FIVE SEPARATE FLIPS: everything here is the work of
  // RUNNING the family rather than of having one. The tree records how it fits together, the
  // ledger records what it collects, the duties record who is doing what, and the permission
  // grid records who may do which. Free is the family in one place; Standard is the family
  // being run.
  standard: [
    {
      claim: 'standard/family-tree',
      label: 'The family tree, traced back',
      detail: 'How everyone is related, generation by generation, with blood and marriage told apart.',
    },
    {
      claim: 'standard/ledger',
      label: 'A real ledger for the money you collect',
      detail: 'Dues plans and a contribution ledger for cash, recorded instead of remembered.',
    },
    {
      claim: 'standard/gathering-budget',
      label: 'Plan the gathering, not just the date',
      detail: 'Checklists a gathering is built from, and a budget drawn on one of your funds.',
    },
    {
      claim: 'standard/duties',
      label: 'Everybody knows their duties',
      detail: 'Every step handed to a named relative, with what came back and whether it was accepted.',
    },
    {
      claim: 'standard/separation-of-duties',
      label: 'Separation of duties',
      detail: 'Per-feature permissions, so recording dues is not the same as paying money out.',
    },
    {
      claim: 'standard/profile-pictures',
      label: 'A face against every name',
      detail: 'Profile pictures, on the directory, the tree and everywhere a member is listed.',
    },
  ],
  plus: [
    {
      claim: 'plus/card-payments',
      label: 'Take payment the way your family pays',
      detail: 'Card, debit, PayPal, Apple Pay, Google Pay and Cash App, with funds behind them.',
    },
    // THIS BULLET SOLD RSVPs, MEAL TOTALS AND DAY-OF CHECK-IN until 2026-08-19, and all three
    // went with the Events product. What replaced it is what the family actually gets:
    // Dues Projections, which IS a Plus route (`lib/features.ts`) and is the one figure
    // leadership asks for that this tier really delivers today.
    {
      claim: 'plus/dues-projections',
      label: 'Know what is still owed, before you have to ask',
      detail: 'Every relative who owes this year, what has come in, and who has still to pay.',
    },
    {
      claim: 'plus/pnl',
      label: 'A profit and loss for your treasurer',
      detail: 'The statement the board asks for, plus transfers between your funds.',
    },
    // ── "THE FAMILY'S SIZE OVER TIME" WAS FALSE AND IS GONE, 2026-08-22 ───────────────
    // Nothing in this product records a membership figure over time; `/reporting/membership`
    // is a snapshot. `/features` corrected the same sentence on 2026-08-20 and both copies of
    // it survived here and on `/pricing` — which is the hand-maintained drift the header warns
    // about, in the direction that matters most, since a member can check this one.
    {
      claim: 'plus/membership-report',
      label: 'The numbers leadership asks for',
      detail: 'Dues collected against outstanding, and your membership by region and chapter.',
    },
    // ADDED 2026-08-22 with the four activity reports. This tier's reporting story was
    // entirely money, so nothing told a family it could also answer "did the reunion work get
    // done" or "which offices are empty".
    {
      claim: 'plus/activity-reports',
      label: 'Reports on more than the money',
      detail: 'Reunion work returned, election turnout, meetings held, and the offices nobody holds.',
    },
    {
      claim: 'plus/elections',
      label: 'Elect your officers properly',
      detail: 'Nominate, accept or decline, then vote — family-wide, or one region or chapter.',
    },
    {
      claim: 'plus/library',
      label: 'The paperwork, and the structure to match',
      detail: 'Searchable bylaws, minutes that record how the room voted, and regions and chapters with their own leadership.',
    },
    // ADDED 2026-08-22 — the Library's officer notebooks were sold on no surface at all.
    {
      claim: 'plus/officer-notes',
      label: 'Every office keeps its own notebook',
      detail: 'Notes that stay with the role rather than the person, read only by whoever holds it.',
    },
    // THE FACE HALF OF THIS BULLET MOVED TO STANDARD on 2026-08-19. Profile pictures are sold
    // a rung lower now, and leaving them named here would sell one capability twice — the
    // drift the note above `PLANS[]` on /pricing is about, in miniature.
    {
      claim: 'plus/gallery',
      label: 'Photographs, findable',
      detail: 'Collections per gathering, with tagging.',
    },
  ],
  premium: [
    {
      claim: 'premium/dues-reminders',
      label: 'Stop chasing relatives for their dues',
      detail: 'Reminders go out as each installment falls due, and stop when it is paid.',
    },
    {
      claim: 'premium/notifications',
      label: 'News that arrives rather than waiting to be found',
      detail: 'Notifications on the phone and in the browser, for announcements, messages and the tasks you have been given.',
    },
    {
      claim: 'premium/mobile-apps',
      label: 'The family in everybody’s pocket',
      detail: 'Apps for iPhone and Android, on the same family account.',
    },
    {
      claim: 'premium/email-distributions',
      label: 'Email the whole family without building a list',
      detail: 'Distributions drawn straight from your membership.',
    },
    // The member-facing half of `premium/safety-check-ins`, added 2026-08-23 in the same commit
    // as its `PLANS[]` counterpart — which is what `marketing:check`'s claim-set comparison
    // enforces, and what the two-bullet drift recorded below is the cost of forgetting.
    //
    // SHORTER AND FLATTER THAN THE PRICING COPY, as every entry here is: a member reading
    // /admin/settings already belongs to the family and does not need selling. Same claim, same
    // absence of any promise about text messages.
    {
      claim: 'premium/safety-check-ins',
      label: 'Check that everyone is safe, in one tap each',
      detail: 'Ask the relatives in one area whether they are safe, and see who has not answered.',
    },
    {
      claim: 'premium/family-website',
      label: 'Your family’s own website, keeping itself current',
      detail: 'It builds itself from your next gathering, newest photographs and latest announcement.',
    },
    // ── THE TWO-BULLET DRIFT AGAINST `PLANS[]` IS CLOSED, 2026-08-22 ──────────────────
    // This list was five where /pricing was six, and the missing one was not a merge: a family
    // put on Premium was never told, anywhere INSIDE the product, that the address comes with
    // the website. FutureFeature.md had carried that diff since 2026-08-19. The Plus row of
    // that same table is a genuine merge ("A face against every name" folded into
    // "Photographs, findable") and stays merged.
    {
      claim: 'premium/custom-domain',
      label: 'A proper address for it, ready to go',
      detail: 'No hosting bill, no plugins, and nobody in the family maintaining it.',
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
 * ── ONE RATE, MONTHLY. THERE IS NO ANNUAL PRICE AND NO DISCOUNT ────────────────────
 * There were both until 2026-08-19: a `yearlyCents` per tier, priced at ten months for twelve,
 * and three surfaces deriving a "two months free" sentence from the pair. The discount went
 * first (twelve times monthly), and then the annual rate itself, because a second figure that
 * saves nothing is a second figure nobody needs — it doubled the price block on every card and
 * in every sentence to say the same thing twice.
 *
 * `annualSavingCents()` and `monthsFreeOnAnnual()` went with it. THEY ARE NOT COMING BACK AS
 * HELPERS ON A SINGLE FIGURE: the reason they existed was that a claim about a saving must be
 * derived from the two numbers rather than typed beside them, so that a price change cannot
 * leave a sentence contradicting the figures above it. If an annual rate is reinstated, both
 * come back with it and the rule comes back with them — a saving is never written by hand.
 *
 * WHAT A CALLER MUST NOT DO IN THE MEANTIME is state a yearly figure by multiplying. Twelve
 * times the monthly rate is arithmetic anybody can do, and putting it on a card commits us to
 * an annual plan that does not exist — including to what happens when somebody who paid for a
 * year downgrades in March, which nothing in this product has an answer for.
 */export interface TierPrice {
  /** Per month, month to month. The only rate there is — see above. */
  monthlyCents: number
}

export const TIER_PRICE: Record<FamilyTier, TierPrice | null> = {
  free: null,
  // ── RE-PRICED 2026-08-23: 5/15/25 -> 10/20/30 ─────────────────────────────────────
  // One edit, and everything that shows a price follows it: the three `/pricing` cards, the
  // FAQ, the plan panel, `/upgrade`, the one sentence on `/features`, every proration and
  // every prepaid quote. That is the whole point of the paragraph above about a price living
  // in one place — the alternative was a figure typed into six surfaces, one of which would
  // still say $5 today.
  //
  // NOTHING IS GRANDFATHERED, because at the time of the re-pricing nothing had been sold.
  // THAT WINDOW CLOSED ON 2026-08-23, when `TIER_IS_SOLD` flipped for Standard and Plus: a
  // figure edited here now moves what a family with a live subscription is billed at their
  // next renewal, and it moves it WITHOUT their agreeing to it. Two things follow, and the
  // second is the one that bites.
  //
  // A change here has to be made in Stripe TOO, on the Price objects
  // `STRIPE_PRICE_*` name — this constant is what every screen quotes, and Stripe is what
  // actually charges. Edit one and the family is shown one number and billed another.
  //
  // And a genuine re-pricing is no longer an edit at all: Stripe Prices are immutable, so it
  // is a NEW Price per tier, existing subscriptions migrated or left on the old one
  // deliberately, and a decision about who is grandfathered. 20260819000009's header is the
  // precedent for what a restructure costs once there is somebody to grandfather.
  standard: { monthlyCents: 1_000 },
  plus: { monthlyCents: 2_000 },
  premium: { monthlyCents: 3_000 },
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
 * Mirrors `PLANS[].available` on `/pricing`, and the two must move together — that page's
 * card says "Available now" or "Not yet available" off its own field, so a tier flipped here
 * and not there is a checkout behind a card that says it cannot be bought.
 *
 * A PRICE AND A PURCHASE ARE SEPARATE FACTS, since 2026-08-17, and that is what let the
 * figures be announced a week before anything could be charged: a price on a card with no
 * way to pay is honest — "here is what it will cost" — whereas a button that takes a
 * decision nothing can charge for is not.
 *
 * ── STANDARD AND PLUS WENT ON SALE 2026-08-23; PREMIUM DID NOT ──────────────────────
 * This was `false` for all three until the Stripe integration landed. The two that flipped
 * are the two whose catalogue exists: each needs a real recurring Price and a real prepaid
 * Price in Stripe, named by `STRIPE_PRICE_<TIER>_{RECURRING,PREPAID}`, and
 * `platformBillingConfigured()` is what reports a tier that is sold here and unpriced there.
 *
 * SO THIS FLAG IS THE PRODUCT DECISION AND NEVER THE CAPABILITY. It says "we sell this",
 * not "this deployment can take the money" — a laptop with no Stripe key sells Standard by
 * this flag and refuses the checkout two lines later in `startPlanCheckout`. Keeping them
 * separate is what makes the refusal a sentence about the deployment rather than a claim
 * that the plan does not exist.
 *
 * PREMIUM STAYS FALSE deliberately rather than by omission: it is sold as the tier that
 * comes with a mailbox and a website, and neither is provisioned by anything yet. Charging
 * for it would be selling something nobody can deliver. Every surface that shows a price
 * must still read this before it shows a control.
 */
export const TIER_IS_SOLD: Record<FamilyTier, boolean> = {
  free: true,
  standard: true,
  plus: true,
  premium: false,
}

/** Every tier, cheapest first — re-exported so a UI need not import two modules. */
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
