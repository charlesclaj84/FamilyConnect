import { type T } from '@/lib/i18n/t'
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
import { DEFAULT_MONEY_LOCALE, formatMoney } from '@/lib/currency-utils'

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
/**
 * Which claims each tier adds, in order. The ids and nothing else.
 *
 * ── EXPORTED FOR `marketing:check`, WHICH NOW WANTS EXACTLY THIS AND NOTHING MORE ───
 * That gate asserts the SET of claim ids per tier matches `/pricing`'s, and it used to import
 * `PLAN_ADDS` and map `h => h.claim` off it — reading a whole list of English prose to get at a
 * list of ids. It imports this instead, which is both narrower and no longer language-dependent:
 * the gate is about ids, and a gate that pulls a catalogue in to reach them is one that breaks
 * the day the catalogue moves.
 */
export const PLAN_ADD_CLAIMS: Record<FamilyTier, readonly string[]> = {
  // ── FREE LOST THREE BULLETS TO STANDARD ON 2026-08-19 ─────────────────────────────
  // The tree, the ledger and separation of duties went up a rung, and the calendar bullet was
  // NARROWED rather than moved: Free still puts a gathering on a shared calendar with its
  // date, place and details, and everything that turns that date into assigned work is
  // Standard. What is left is the promise the product is built on — get every relative in, at
  // no charge, and be able to find them and talk to them.
  free: [
    'free/every-relative-free',
    'free/directory',
    'free/shared-calendar',
    'free/announcements',
    'free/chat',
    // ── THREE ADDED 2026-08-22, in step with `PLANS[]` on /pricing ────────────────────
    // `npm run marketing:check` found eleven live screens the feature catalogue named
    // nowhere, and three of them were Free. That checker deliberately cannot see this list
    // or `PLANS[]` — a bullet is prose about a benefit and corresponds to no route — so
    // both hand-written lists were edited in the same commit, which is the discipline the
    // header above asks for and the thing that had already drifted twice.
    'free/one-account-many-families',
    'free/nothing-scrolls-away',
    'free/manual',
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
    'standard/family-tree',
    'standard/ledger',
    'standard/gathering-budget',
    'standard/duties',
    'standard/separation-of-duties',
    'standard/profile-pictures',
  ],
  plus: [
    'plus/card-payments',
    // THIS BULLET SOLD RSVPs, MEAL TOTALS AND DAY-OF CHECK-IN until 2026-08-19, and all three
    // went with the Events product. What replaced it is what the family actually gets:
    // Dues Projections, which IS a Plus route (`lib/features.ts`) and is the one figure
    // leadership asks for that this tier really delivers today.
    'plus/dues-projections',
    'plus/pnl',
    // ── "THE FAMILY'S SIZE OVER TIME" WAS FALSE AND IS GONE, 2026-08-22 ───────────────
    // Nothing in this product records a membership figure over time; `/reporting/membership`
    // is a snapshot. `/features` corrected the same sentence on 2026-08-20 and both copies of
    // it survived here and on `/pricing` — which is the hand-maintained drift the header warns
    // about, in the direction that matters most, since a member can check this one.
    'plus/membership-report',
    // ADDED 2026-08-22 with the four activity reports. This tier's reporting story was
    // entirely money, so nothing told a family it could also answer "did the reunion work get
    // done" or "which offices are empty".
    'plus/activity-reports',
    'plus/elections',
    'plus/library',
    // ADDED 2026-08-22 — the Library's officer notebooks were sold on no surface at all.
    'plus/officer-notes',
    // THE FACE HALF OF THIS BULLET MOVED TO STANDARD on 2026-08-19. Profile pictures are sold
    // a rung lower now, and leaving them named here would sell one capability twice — the
    // drift the note above `PLANS[]` on /pricing is about, in miniature.
    'plus/gallery',
  ],
  premium: [
    'premium/dues-reminders',
    'premium/notifications',
    'premium/mobile-apps',
    'premium/email-distributions',
    // The member-facing half of `premium/safety-check-ins`, added 2026-08-23 in the same commit
    // as its `PLANS[]` counterpart — which is what `marketing:check`'s claim-set comparison
    // enforces, and what the two-bullet drift recorded below is the cost of forgetting.
    //
    // SHORTER AND FLATTER THAN THE PRICING COPY, as every entry here is: a member reading
    // /admin/settings already belongs to the family and does not need selling. Same claim, same
    // absence of any promise about text messages.
    'premium/safety-check-ins',
    'premium/family-website',
    // ── THE TWO-BULLET DRIFT AGAINST `PLANS[]` IS CLOSED, 2026-08-22 ──────────────────
    // This list was five where /pricing was six, and the missing one was not a merge: a family
    // put on Premium was never told, anywhere INSIDE the product, that the address comes with
    // the website. FutureFeature.md had carried that diff since 2026-08-19. The Plus row of
    // that same table is a genuine merge ("A face against every name" folded into
    // "Photographs, findable") and stays merged.
    'premium/custom-domain',
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
 * "$10" rather than "$10.00" for a whole number of dollars, in the reader's conventions.
 *
 * A price is scanned, not audited, and the two trailing zeroes are noise at 48px. Anything
 * with cents in it keeps them, so a future $12.50 renders correctly without a second helper.
 *
 * ── THE `.00` STRIP WAS A REGEX AND IT ONLY EVER WORKED IN ENGLISH ──────────────────
 * This used to be `formatCurrency(cents).replace(/\.00$/, '')`, with a long note arguing that
 * a `cents % 100 === 0` guard beside it would be dead code. That argument was correct and it
 * rested on a premise the note stated out loud: *`formatCurrency` always emits exactly two
 * decimals*, and `lib/plans.test.ts` pinned it as `/^\$[\d,]+\.\d{2}$/`.
 *
 * The premise was about `en-US`. Measured the day the public site learned Spanish and French:
 *
 *   en-US   $10.00      → the regex matches      → "$10"
 *   es-MX   USD 10.00   → matches                → "USD 10"
 *   fr-FR   10,00 $US   → does NOT match         → "10,00 $US"
 *
 * So French price cards were rendering the zero cents the whole mechanism existed to remove,
 * and nothing failed. The GUARD is what asks the real question — is this a whole number of
 * dollars — and `Intl` is what answers it in the reader's own punctuation, so the condition
 * that was dead code against a regex is load-bearing against a formatter.
 *
 * ── THE LOCALE IS A SECOND POSITIONAL ARGUMENT, DEFAULTED ──────────────────────────
 * Same shape as `formatCurrency(value, intl)` and `formatDate(value, intl)` — the whole family
 * of formatters is threaded identically, which is what `i18n:check`'s PINNED-FORMATTER count
 * counts. It defaults so a caller with no reader-locale in hand still renders US conventions
 * rather than throwing; every call site in the tree passes one.
 */
export function formatPlanPrice(cents: number, intl: string = DEFAULT_MONEY_LOCALE): string {
  return formatMoney(cents, {
    locale: intl,
    // Whole dollars lose the cents; anything else keeps the currency's own two.
    ...(cents % 100 === 0 ? { fractionDigits: 0 } : {}),
  })
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

/**
 * What each tier ADDS on top of the one below it, in the reader's language.
 *
 * ── THE CLAIM IDS STAYED EXACTLY WHERE THEY WERE ───────────────────────────────────
 * `PLAN_ADD_CLAIMS` above is the same list in the same order with the same ids; only the words
 * moved, into the SHELL catalogue as `plan.adds.<claim>.label` and `.detail`. That matters more
 * than it looks: `npm run marketing:check` asserts the SET of ids per tier matches `/pricing`'s,
 * and that gate is untouched by this because it walks ids and never words.
 *
 * ── AND THE SHELL CATALOGUE, NOT THE MARKETING ONE ─────────────────────────────────
 * This list is read by `/admin/settings` and `/upgrade` — both signed in, both behind the
 * Dashboard's own language resolution. `/pricing`'s list is read by a visitor with no session
 * and lives in `lib/marketing/strings`. Two bundles for two audiences, which is the same split
 * the two lists already had in prose: this file's header argues at length that they must stay
 * separately WORDED, and putting them in one catalogue would have been the first step toward
 * somebody consolidating them.
 */
export function planAdds(t: T, tier: FamilyTier): readonly PlanHighlight[] {
  return PLAN_ADD_CLAIMS[tier].map(claim => ({
    claim,
    label: t(`plan.adds.${claim}.label`),
    detail: t(`plan.adds.${claim}.detail`),
  }))
}

export function planAddsBetween(
  t: T,
  after: FamilyTier | undefined,
  through: FamilyTier,
): readonly PlanHighlight[] {
  const floor = after ? TIER_RANK[after] : -1
  return TIERS
    .filter(tier => TIER_RANK[tier] > floor && TIER_RANK[tier] <= TIER_RANK[through])
    .flatMap(tier => planAdds(t, tier))
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
 *
 * ── IT TAKES `t` NOW, AND THAT IS STILL PURE ───────────────────────────────────────
 * A translator is a function of a locale over two plain objects; it reads no request, no
 * session and no database, so `npm test` still calls this with `tFor('en')` and no fixture.
 * The parameter is FIRST rather than last, matching `planAdds` and `planAddsBetween`, so the
 * three read the same way at a call site.
 */
export function planChange(t: T, from: FamilyTier, to: FamilyTier): PlanChange {
  const up = tierMeets(to, from)
  const lower = up ? from : to
  const higher = up ? to : from

  return {
    up,
    changing: planAddsBetween(t, lower, higher),
    keeping: planAddsBetween(t, undefined, lower),
  }
}
