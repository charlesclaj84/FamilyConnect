import type { Metadata } from 'next'
import Link from 'next/link'
import { Check, HeartHandshake } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Reveal } from '@/components/marketing/Reveal'
import { StructuredData } from '@/components/marketing/StructuredData'
import { Testimonials } from '@/components/marketing/Testimonials'
import { PlanLadder, type MarketingPlan } from '@/components/marketing/PlanLadder'
import { FamilySizeSlider, type SizedPlan } from '@/components/marketing/FamilySizeSlider'
import { PageHero, SectionHeading, MoreLink } from '@/components/marketing/sections'
import { CtaBand } from '@/components/marketing/CtaBand'
import { marketingPageGraph } from '@/lib/structured-data'
import { localizedHref } from '@/lib/i18n/route-locale'
import { marketingI18n } from '@/lib/marketing/locale'
import { localizedAlternates } from '@/lib/i18n/route-locale'
// The shell catalogue, for the tier taglines only. `/features` carries the full note.
import { tFor } from '@/lib/i18n/catalogues'
import { type T } from '@/lib/i18n/t'
import { ACCOUNT_ROUTES } from '@/lib/marketing-nav'
import { TIER_PRICE, formatPlanPrice } from '@/lib/plans'
import { TIERS, TIER_LABEL, tierTagline, type FamilyTier } from '@/lib/tiers'
import { MetaViewContent } from '@/components/meta/MetaViewContent'

/**
 * ── `generateMetadata`, AND THE PRICE FAQ IS BUILT FROM `t` TOO ─────────────────────
 * Per-language title, description and `hreflang` set, for the reason /how-it-works records at
 * length. The interesting half on this page is the `FAQPage` node: it quotes real figures, and
 * an English answer under a Spanish card would be the mismatch this file is most careful about.
 * So `faq(t)` builds it, and `paidPlanPriceAnswer(t)` still DERIVES its sentences from
 * `TIER_PRICE` rather than having them typed — that argument is unchanged and is the reason the
 * saving clause vanished on its own when the annual rate did.
 */
export async function generateMetadata(): Promise<Metadata> {
  const { t, locale } = await marketingI18n()
  return {
    title: t('mkt.price.metaTitle'),
    description: t('mkt.price.metaDescription'),
    alternates: localizedAlternates('/pricing', locale),
  }
}

/**
 * ── ANNOUNCED 2026-08-17 ────────────────────────────────────────────────────
 *
 * The figures are real: Standard is $5 a month, Plus $15 and Premium $25. ONE RATE EACH —
 * there was a second until 2026-08-19, the year paid in advance at ten months for twelve, and
 * both the discount and the annual rate itself were withdrawn. The "two months free" sentence
 * that stood beside every figure DISAPPEARED ON ITS OWN, because it was derived from the two
 * numbers rather than typed beside them; that is the whole argument for deriving a claim about
 * a price, made once and worth keeping.
 *
 * Do not put a yearly figure back on a card by multiplying by twelve. `lib/plans.ts` says why:
 * it commits us to an annual plan that does not exist, including to what happens when somebody
 * who paid for a year downgrades in March.
 *
 * They live in `TIER_PRICE` in `lib/plans.ts` rather than here, because the
 * in-product plan panel and the upgrade screen show the same numbers and two copies of a
 * price is how a member comes to read $10 on one screen and $12 on the next. See that
 * file's header for why the price is shared and the benefit LISTS deliberately are not.
 *
 * WHAT THIS FLAG STILL DOES, now that it is true: it is what allows a figure to render on a
 * tier whose `available` is false. Announcing a price and selling a plan are separate facts
 * and this page states both — the card carries the number AND says "Coming soon", because
 * there is no billing yet. Collapsing the two would give the page a price with a working
 * button behind it and nothing to charge with.
 *
 * WHY IT REMAINS A FLAG RATHER THAN BEING DELETED. Because the rule it protects is about
 * PLACEHOLDERS, and that rule has not changed: a figure on a pricing page is a commercial
 * representation people budget against and crawlers cache, and a cached search result
 * outlives the edit that was going to fix it. Setting a price back to `null` and this back
 * to `false` is the supported way to withdraw one; typing a stand-in figure into
 * `TIER_PRICE` is not.
 *
 * DONE WITH THE FLIP, as the note here used to require: `lib/structured-data.ts` now emits
 * an `Offer` per priced tier, with `availability: PreOrder` on the two that cannot be
 * bought. Page first, markup second, which is the order that file's header insists on.
 */
const PRICING_IS_ANNOUNCED = true

/**
 * ── THE SHAPE LIVES WITH THE COMPONENT THAT RENDERS IT ──────────────────────
 *
 * `MarketingPlan` and its per-field reasoning moved to
 * `components/marketing/PlanLadder.tsx` on 2026-08-22, when the paid tiers stopped
 * being three boxes in this file and became a component. TWO FIELDS CHANGED SHAPE
 * IN THE MOVE and both are worth knowing before editing the table below:
 *
 *  * `icon` is a KEY (`'check' | 'sparkles' | 'zap' | 'crown'`) rather than a Lucide
 *    component. The ladder is a client component and this file is a server one; a
 *    function cannot cross that boundary.
 *  * `accent` is NEW, and names which rung of the brand ramp the tier owns —
 *    Growth, Heritage, Warmth, Legacy, climbing. It is a key rather than a class
 *    name so the colour decision stays in one file with the rest of the ramp and
 *    cannot be typed into the copy by hand.
 *
 * WHAT DID NOT MOVE, and must not: the table itself. `PLANS[]` is the COPY, and the
 * copy belongs on the page it sells.
 */
type Plan = MarketingPlan

/**
 * ── THE PLAN TABLE — THIS IS WHAT YOU EDIT ──────────────────────────────────
 *
 * EVERY BULLET CARRIES A `claim` ID — `<tier>/<slug>`, never rendered. It is what holds this
 * table and `PLAN_ADDS` in `lib/plans.ts` (the member-facing list, on `/admin/settings` and
 * `/upgrade`) to the same SET of claims while leaving the two separately WORDED, which is the
 * distinction that made a gate possible after both files had said one was not. Adding a bullet
 * here means adding its counterpart there in the same commit; `npm run marketing:check` is what
 * refuses to let you forget. `PlanFeature.claim` in `PlanLadder.tsx` carries the full argument.
 *
 * THE PRODUCT NOW ENFORCES THESE, which it did not until 2026-08-13, and the two halves
 * are deliberately NOT derived from one another. `PLANS[]` below is prose about benefits;
 * `lib/features.ts` carries a `tier` per ROUTE and `lib/tiers.ts` compares it against
 * `families.tier`. They do not correspond one to one in either direction — one bullet
 * frequently spans several routes, and several routes are sold in no bullet at all — so
 * generating either from the other would mean inventing correspondences that do not
 * exist. FutureFeature.md is where the mismatches are tracked.
 *
 * WHAT THAT MEANS FOR AN EDIT HERE: moving a bullet between cards no longer changes only
 * a document. Check whether a ROUTE has to move with it — `grep "tier: '"
 * lib/features.ts` is the whole job — because a bullet that moves to Plus while its route
 * stays Free is a giveaway, and one that moves to Free while its route stays Plus is a
 * page a customer was promised and cannot open.
 *
 * FOUR TIERS SINCE 2026-08-19 — Standard was inserted between Free and Plus — and each one
 * INHERITS the tier below it rather than restating it. That is what `inheritsFrom` does:
 * Standard renders "Everything in Free", Plus "Everything in Standard", Premium "Everything in
 * Plus", and each lists only what it adds. Two reasons it is modelled rather than typed:
 *
 *  * A restated list drifts. Add a feature to Free and you have to remember to add it to
 *    three other cards, and the day you forget, the expensive tier appears to offer LESS
 *    than the free one. The inheritance line cannot go stale. Inserting a tier IN THE MIDDLE
 *    is the proof: it cost one `inheritsFrom` edit on the card above it, and no card had to
 *    have anything copied into it.
 *  * It is also the honest shape of the offer. A customer reading Premium needs to know
 *    they keep everything below it, and "Everything in Plus" says that in three words.
 *
 * `price: null` renders NOTHING in the price slot — no figure and no "to be announced" line,
 * since the card already says Coming soon beside its name. All three paid tiers carry real
 * figures, derived from `TIER_PRICE` in `lib/plans.ts`.
 *
 * `available` WENT TRUE FOR STANDARD AND PLUS ON 2026-08-23, and it has to stay in step with
 * `TIER_IS_SOLD` in `lib/plans.ts` — that constant is what the checkout actions and the plan
 * panel read, this field is what the card says. A card offering to sell what
 * `startPlanCheckout` refuses is the drift `npm run marketing:check` exists to catch on the
 * bullets and cannot catch here, because availability is one boolean rather than a claim id.
 *
 * PREMIUM STAYS FALSE, so it keeps the Coming soon badge and the disabled button: it is sold
 * on a mailbox and a website that nothing provisions yet. A price and a purchase are separate
 * facts and this page states both.
 *
 * FREE IS NOT RENDERED WITH THE OTHERS. It is pulled out into a full-width band above the
 * three paid cards — see `FREE_PLAN` below and the essay in the section itself. It stays in
 * this table rather than being declared separately, so the inheritance chain terminates
 * somewhere real and "Everything in Free" on the Standard card is a reference rather than a
 * string.
 *
 * `adds` carries only what has actually been decided. Add to them freely — the card grows.
 * Premium is the one to watch: it began as the family website `LivingSitePreview`
 * describes and has since taken on the reach features too — the apps, notifications,
 * email distributions and automatic dues reminders — so its tagline names both halves
 * rather than the website alone.
 */

/**
 * Every paid figure, derived from `TIER_PRICE` in `lib/plans.ts` — the one place the numbers
 * are written down, shared with the in-product plan panel and the upgrade screen.
 *
 * IT IS THREE LINES NOW because there is one rate. The annual line and the "two months free"
 * clause it carried are gone (see the note on `PRICING_IS_ANNOUNCED`), and with them the whole
 * of the arithmetic this function used to do. The rule that arithmetic existed to serve still
 * holds and is worth restating for whoever reinstates an annual price: no sentence about a
 * number is typed beside the number.
 */
function planPrice(tier: 'standard' | 'plus' | 'premium', t: T, intl: string): Plan['price'] {
  // THE FLAG IS READ HERE NOW, and this is the only place it is read — it used to be
  // tested at the render site, in a `priced` expression beside each card. Moving it
  // into the derivation is what survived the ladder becoming a component: a client
  // component takes DATA, so "this price is not announced" has to be a `null` in the
  // data rather than a branch in the markup. Which is the better shape anyway — one
  // test rather than one per surface, and `SIZED_PLANS` below inherits it for free
  // instead of having to remember the flag exists.
  if (!PRICING_IS_ANNOUNCED) return null
  const price = TIER_PRICE[tier]
  if (!price) return null
  return { amount: formatPlanPrice(price.monthlyCents, intl), period: t('mkt.price.perMonth') }
}

// ── THE THREE HOISTED PRICE CONSTANTS ARE GONE ─────────────────────────────────────
// They existed because `PLANS[]` was a module-level literal and each card needed a figure in
// it. The cards carry a `tier` now and `plans()` calls `planPrice(tier)` per card, so three
// constants that each wrapped one call have nothing left to save. `planPrice` above is where
// the derivation lives and is unchanged.

/**
 * The price FAQ's answer, built from the same figures the cards render.
 *
 * It says what no card can: that the prices are set and none of the paid plans can be bought
 * yet. A visitor reading a figure beside a Coming soon badge deserves that sentence somewhere,
 * and the FAQ is where a price question is actually asked.
 *
 * IT WALKS THE TIERS RATHER THAN NAMING TWO, since 2026-08-19. The hand-written version took
 * `TIER_PRICE.plus` and `TIER_PRICE.premium` by name, so inserting Standard would have left an
 * answer that quoted two of three prices and read as complete — which is the same class of
 * failure as a hand-copied figure, arriving through a hand-copied LIST instead.
 */
function paidPlanPriceAnswer(t: T, intl: string): string {
  // Every tier that HAS a price, in plan order, derived from `TIERS` so a tier added in the
  // middle is quoted here without an edit. Free drops out by having no price rather than by
  // being named — see `TIER_PRICE`, where `null` means "no price" and not "a price of zero".
  const paid = TIERS.flatMap(tier => {
    const price = TIER_PRICE[tier]
    return price ? [{ tier, price }] : []
  })

  if (paid.length === 0) return t('mkt.price.noneAnnounced')

  // ── THE SENTENCE PATTERN IS A KEY, NOT A TEMPLATE ────────────────────────────────
  // `${TIER_LABEL[tier]} is ${amount} a month.` is English word order with an English
  // preposition, and neither survives: Spanish wants *El plan Plus cuesta 5 $ al mes.* and
  // French *Le forfait Plus coûte 5 $ par mois.* So the whole sentence is one entry with two
  // placeholders, and the FIGURE still comes from `formatPlanPrice` — the derivation this
  // function exists for is untouched.
  const sentences = paid.map(({ tier, price }) => t('mkt.price.rateSentence', {
    tier: TIER_LABEL[tier],
    amount: formatPlanPrice(price.monthlyCents, intl),
  }))


  // ── ONE RATE, SO THERE IS NO SAVING SENTENCE ANY MORE ──────────────────────────────
  // This used to add "paying for the year up front is two months free on either plan", derived
  // from the annual figure and dropped automatically when it stopped being true. Both the
  // discount and the annual rate were withdrawn on 2026-08-19, so the clause has nothing to
  // derive from and is gone rather than commented out. The `month to month` phrase below is
  // what replaces it, and it is doing a job: a single figure with no period stated invites the
  // reader to assume a contract, which is the opposite of what is on offer.
  return `${sentences.join(' ')} ${t('mkt.price.rateFooter')}`
}

/**
 * ── HOW THIS COPY IS WRITTEN, so the next edit keeps doing it ────────────────
 * Every `label` names the OUTCOME and every `detail` names the mechanism. "Stop guessing
 * what is still owed" then "every relative who owes this year, and who has still to pay" —
 * not "dues projections module". A feature list that reads like a changelog makes the buyer do the
 * translation into their own problem, and most of them will not bother.
 *
 * The order inside each tier is a RANKING, not a grouping: the thing that hurts most goes
 * first and the weakest line goes last, so a reader who stops after two bullets has still
 * met the tier's best argument. Adding a feature means deciding where it ranks — appending
 * it is what turns a ranked list back into a changelog.
 *
 * Where the tie-breaker is needed it is GAIN OVER THE STATUS QUO, not usage. What each card
 * leads with, and why its tail is where it is:
 *
 *  * FREE opens on getting everybody in at all, because a per-member price is the objection
 *    that keeps half a family out, and closes on chat — the one thing here a family already
 *    has, in the group text they are probably reading this on. Heavily used, least gained.
 *  * STANDARD opens on the LEDGER rather than on the tree, and that ranking is the rule
 *    applied rather than an accident. A family that has lost track of who paid has a problem
 *    this afternoon; a family that cannot draw its tree has a project. The tree is second
 *    because it is what people come to a family product for, and the duties are third because
 *    they are the part nobody knew they wanted. Profile pictures go last: loved, opened daily,
 *    and not what anybody buys a tier for.
 *  * PLUS opens on taking a payment that is not cash, which is the limit Standard names out
 *    loud, then on knowing what is still owed. It ends on the photographs — loved, and not the
 *    machinery this tier is sold as.
 *  * PREMIUM opens on chasing relatives for money they already agreed to pay. Notifications
 *    outrank the apps deliberately — nobody has ever complained about the absence of an app,
 *    whereas "half the family says they never saw it" is a sentence every organizer has
 *    said — and the website, the tier's signature, does not lead at all.
 *
 * WHAT IS NOT CLAIMED, AND THE FLOOR MOVED ON 2026-08-19. Free no longer includes a ledger at
 * all — it is Standard's first bullet — so the sentence that used to matter most here ("Free's
 * ledger is cash only") now belongs to Standard, and it is still stated rather than softened:
 * a family that pays for Standard expecting to take card payments and finds they cannot has
 * been misled, and that is a refund and a review. Naming the limit on the card that has it is
 * also what makes the tier above obviously worth paying for.
 */
/**
 * ── WHAT A CARD STILL STATES, AND WHAT IT READS ────────────────────────────────────
 * `name`, `tagline` and `price` all LEFT this table when the public site learned Spanish and
 * French, and only the middle one was about language:
 *
 *   `tier`         replaces `name`. The label is `TIER_LABEL[tier]` and always was — the four
 *                  strings here were a hand-typed copy of it, and `PlanLadder`'s own
 *                  `planSignupHref` joins the two on that equality.
 *   `tagline`      is `tierTagline(shellT, tier)`. The four sentences here were VERBATIM copies
 *                  of `TIER_TAGLINE`, which `lib/tiers.ts` exists to prevent — so the drift that
 *                  file guards against had already happened, silently, in this array.
 *   `price`        is `planPrice(tier)`, which this file already had and called four times to
 *                  build three constants and one literal.
 *
 * So the card now carries only what is genuinely ITS decision: which tier, which glyph, which
 * accent, whether it is featured, and the ORDERED list of claim ids. That ranking is the thing
 * the long note above is about and is the one part no derivation can supply.
 */
const PLAN_SHAPES: readonly {
  tier: FamilyTier
  inheritsFrom: string | null
  icon: MarketingPlan['icon']
  accent: MarketingPlan['accent']
  /** The claim ids this tier adds, RANKED. See the note above — this order is a decision. */
  adds: readonly string[]
  available: boolean
  featured: boolean
}[] = [
  {
    tier: 'free',
    inheritsFrom: null,
    icon: 'check',
    accent: 'affirm',
    adds: [
      'free/every-relative-free',
              // "DIRECT LINEAGE" WAS HERE UNTIL 2026-08-19, THEN THE FAMILY TREE FOR ONE DAY, and now
        // neither: the tree moved to Standard when that plan was inserted. What Free keeps is
        // the DIRECTORY, and splitting them apart was the point — "never lose track of who is
        // who" was doing two jobs at once, and they are two different questions. Who is in this
        // family and how do I reach them is the directory; how are we related is the tree.
      'free/directory',
      'free/shared-calendar',
      'free/announcements',
      'free/chat',
      // ── THREE ADDED 2026-08-22 ────────────────────────────────────────────────────
      // `npm run marketing:check` found eleven live screens named nowhere on the feature
      // catalogue, and three of them were FREE — so this card was underselling the tier that
      // has to do the persuading. It cannot check this list (a bullet is prose about a
      // benefit and corresponds to no route; see the note above `PLANS[]`), which is exactly
      // why the omission survived here after the catalogue was fixed.
      'free/one-account-many-families',
      'free/nothing-scrolls-away',
      'free/manual',
    ],
    available: true,
    featured: false,
  },
  {
    tier: 'standard',
    inheritsFrom: 'Free',
    icon: 'sparkles',
    accent: 'primary',
    // ── WHERE THIS TIER CAME FROM, 2026-08-19 ─────────────────────────────────────────
    // Carved out of Free rather than invented: the tree, the dues-and-donations ledger,
    // per-feature permissions and the planning half of Gatherings were all on the Free card,
    // and profile pictures came DOWN from Plus. Nothing here is unbuilt — every bullet names a
    // route that works today, which makes it the one paid card that could be sold tomorrow.
    //
    // IT OPENS ON THE LEDGER RATHER THAN THE TREE, which is this page's ranking rule applied
    // rather than an accident: the thing that hurts most goes first. A family that has lost
    // track of who paid has a problem this afternoon; a family that cannot draw its tree has a
    // project. The tree is second because it is what people come to a family product FOR, and
    // the duties are third because they are the part nobody knew they wanted.
    adds: [
      'standard/ledger',
      'standard/family-tree',
      'standard/duties',
      'standard/gathering-budget',
      'standard/separation-of-duties',
      'standard/profile-pictures',
    ],
    available: true,
    // THE FEATURED CARD MOVED HERE FROM PLUS on 2026-08-19, and the rule is unchanged: exactly
    // one is true, and it marks where the eye should land. Standard is that card now because
    // it is the one whose every bullet is BUILT — Plus still sells card payments and reports
    // that do not exist yet — and because it is the cheapest step out of Free, which is the
    // decision most visitors are actually making.
    featured: true,
  },
  {
    tier: 'plus',
    inheritsFrom: 'Standard',
    icon: 'zap',
    accent: 'warm',
    // ── DETAILS DELIBERATELY SHORT ────────────────────────────────────────────
    // Eight items with two-line explanations each made this the tallest card by a wide
    // margin, and height is not persuasion — a reader skims a pricing card, they do not
    // study it. The benefit line does the selling and the detail names the mechanism in as
    // few words as will carry it. The full story lives on /features, which is the page for it.
    adds: [
      'plus/card-payments',
      // THIS BULLET SOLD RSVPs, MEAL TOTALS AND DAY-OF CHECK-IN until 2026-08-19, and all
      // three went with the Events product. It is replaced by Dues Projections, which is a
      // real Plus route (`lib/features.ts`) rather than a promise waiting on a build.
      //
      // `lib/plans.ts` carries the SAME change and is a separate copy on purpose — see the
      // note above `PLANS[]`: one bullet spans several routes and several routes are sold in
      // no bullet at all, so the two lists are kept in step by hand and neither is derived.
      'plus/dues-projections',
      'plus/pnl',
      // ── THE DETAIL HERE WAS FALSE UNTIL 2026-08-22 ────────────────────────────────
      // It sold "the family's size OVER TIME", and nothing in this product has ever recorded
      // a membership figure over time — `/reporting/membership` is a snapshot by region,
      // chapter and joining status. `/features` corrected the same sentence on 2026-08-20 and
      // this copy of it was left standing, which is the hand-maintained drift the note above
      // `PLANS[]` warns about, caught in the direction that matters most: a claim a buyer
      // could check.
      'plus/membership-report',
      // ADDED 2026-08-22. Four reports shipped that have nothing to do with money, and this
      // card's whole reporting story was the treasury — so a buyer could not tell that the
      // product answers "did the reunion work get done" or "which offices are empty" at all.
      'plus/activity-reports',
      'plus/elections',
      // BROADENED 2026-08-22. "Minutes" undersold what shipped: a meeting names one secretary,
      // its room is picked by BODY rather than by ticking names, and a recorded vote cannot be
      // edited by anybody afterwards. That last part is the reason a family would keep minutes
      // here rather than in a document, so it is the part worth saying.
      'plus/library',
      // ADDED 2026-08-22 — sold nowhere at all before, on any surface.
      'plus/officer-notes',
      // PROFILE PICTURES WERE THE EIGHTH BULLET HERE and moved to Standard on 2026-08-19.
      // `lib/plans.ts` carries the same move in the in-product copy, by hand and on purpose —
      // see the note above `PLANS[]`. A bullet left on two cards sells one capability twice.
      'plus/gallery',
    ],
    available: true,
    featured: false,
  },
  {
    tier: 'premium',
    inheritsFrom: 'Plus',
    icon: 'crown',
    accent: 'legacy',
    adds: [
      'premium/dues-reminders',
      // "FOR EVENTS, ANNOUNCEMENTS AND MESSAGES" UNTIL 2026-08-22, and one of those three had
      // not existed since the Events product was deleted on 2026-08-19. It is the subjects the
      // bell actually fires on now — which is also the honest scope for whoever builds push,
      // since a design that inherited the old list would be building for a table that is gone.
      'premium/notifications',
      'premium/mobile-apps',
      'premium/email-distributions',
      // ── ADDED 2026-08-23 WITH THE TIER MOVE, and the copy is bounded on purpose ────────
      // `/community/safety-check-ins` shipped Free and moved to Premium because the channel it is
      // meant to run on is SMS, which costs money on every send. So a bullet was owed: a PAID
      // capability nobody is told about is worse than an unsold free one, because the family is
      // paying for it.
      //
      // IT DOES NOT MENTION TEXT MESSAGES, and that is the whole discipline of this page. SMS is
      // not built. FutureFeature.md §1 is a register of claims with no code and this would be the
      // seventh — on the card whose five other bullets are already in it. What the detail line
      // claims is exactly what the screen does today: ask, one tap, and see who has not answered.
      //
      // WHEN SMS LANDS this bullet is where it gets said, and the `claim` id does not change —
      // the id is what `marketing:check` holds the two lists to, and re-pricing or re-wording is
      // not re-claiming.
      'premium/safety-check-ins',
      'premium/family-website',
      'premium/custom-domain',
    ],
    available: false,
    featured: false,
  },
]

/**
 * FREE IS RENDERED ON ITS OWN, ACROSS THE FULL WIDTH — the section below argues why at
 * length. Split here rather than at the call site so the two halves cannot disagree about
 * which plan is which, and derived from `PLANS[]` rather than declared twice: adding a paid
 * tier is still one entry in that table and nothing else.
 *
 * THE SPLIT IS ON THE PRICE, not on the name and not on the index. `TIER_PRICE` gives Free
 * `null` and every paid tier a figure (`lib/plans.ts`: "Free has no price rather than a price
 * of zero"), and `PLANS[0]` is Free only for as long as nobody reorders the array — which is
 * exactly the kind of thing a later edit does without noticing. A name test would be worse
 * still: it is one rename away from rendering nothing at the top of the page.
 */
/**
 * The four cards, in the reader's language.
 *
 * ── TWO TRANSLATORS, AND THE SPLIT IS THE BUNDLE BOUNDARY ──────────────────────────
 * `t` is the MARKETING one and supplies the bullets — `mkt.claim.<id>.label` and `.detail`,
 * this page's own separately-worded list. `shellT` supplies the tagline, because
 * `tier.tagline.<tier>` lives in the shell catalogue for the signed-in surfaces that print it
 * and a key can only live in one bundle. `/features` does exactly the same for the same reason,
 * and its import carries the full note.
 *
 * Neither reaches a browser: this page is a server component and `PlanLadder` receives the
 * finished strings as a prop.
 */
function plans(t: T, shellT: T, intl: string): readonly Plan[] {
  return PLAN_SHAPES.map(shape => ({
    ...shape,
    name: TIER_LABEL[shape.tier],
    tagline: tierTagline(shellT, shape.tier),
    price: shape.tier === 'free'
      // Free carries a hand-written `$0 / forever` rather than coming from `TIER_PRICE`, and
      // `MarketingPlan.price` explains why at length: Free has no price rather than a price of
      // zero. The PERIOD is load-bearing — it is what `FREE_PLAN` below identifies Free by — so
      // it is keyed rather than left in English.
      ? { amount: t('mkt.price.freeAmount'), period: t('mkt.price.freePeriod') }
      : planPrice(shape.tier, t, intl),
    adds: shape.adds.map(claim => ({
      claim,
      label: t(`mkt.claim.${claim}.label`),
      detail: t(`mkt.claim.${claim}.detail`),
    })),
  }))
}

/**
 * Free, found rather than named.
 *
 * ── IT IDENTIFIES FREE BY ITS `tier` NOW, NOT BY ITS PERIOD STRING ─────────────────
 * It used to match `p.price.period === 'forever'`, which is a comparison against a piece of
 * ENGLISH COPY — and that copy is now a catalogue entry, so the match would have failed on every
 * Spanish and French page and this page would have rendered with no Free plan at all. Nothing
 * would have thrown: `find` answers `undefined`, and the `!` was already telling TypeScript to
 * trust it.
 *
 * Matching on the tier is what it always meant. This is the general shape of the trap and it is
 * worth naming: **any comparison against a rendered string is a comparison that translation
 * breaks**, and it breaks silently, in the language nobody on the team is reading.
 */
const FREE_TIER: FamilyTier = 'free'
function freePlan(all: readonly Plan[]): Plan {
  return all.find(x => x.tier === FREE_TIER)!
}

function paidPlans(all: readonly Plan[]): readonly Plan[] {
  return all.filter(x => x.tier !== FREE_TIER)
}

/**
 * What the per-relative band divides.
 *
 * DERIVED FROM `PLANS[]` AND `TIER_PRICE`, never typed — the amount is the very
 * string the card renders, so the figure in the slider and the figure on the card
 * cannot come apart, and the cents come from the one place the product writes a
 * price down. A widget with its own copy of a rate is the fourth copy of a number
 * this file spends a page arguing should only ever have one, and it is the copy
 * nobody would think to check when a rate moves.
 *
 * THE JOIN ON THE LABEL IS GONE, AND IT WAS THE SECOND STRING COMPARISON ON THIS
 * PAGE THAT TRANSLATION WOULD HAVE BROKEN. It resolved the tier by matching
 * `TIER_LABEL[t] === plan.name` — a comparison against a rendered string — and the
 * old comment argued at length that it was admissible because a rename would have to
 * be a rename away from the tier's own label. That reasoning was sound and it did not
 * survive the plan carrying its own `tier`: the field is right there, so the join is
 * simply unnecessary, and an unnecessary comparison against copy is one nobody has to
 * defend. (The other one was `FREE_PLAN` matching `period === 'forever'` — see its
 * note, where the general shape of the trap is written down.)
 *
 * FREE IS IN IT, and that is the point rather than padding: the band's argument is
 * that the bill does not move with the family, and the row that never moves at all
 * is the one that makes the other three read as a ladder rather than as a bill.
 */
function sizedPlans(all: readonly Plan[]): readonly SizedPlan[] {
  return all.flatMap(plan => {
    if (!plan.price) return []
    return [{
      name: plan.name,
      monthlyCents: TIER_PRICE[plan.tier]?.monthlyCents ?? null,
      amount: plan.price.amount,
    }]
  })
}

/**
 * ── EIGHT QUESTIONS, AND THE SEVENTH IS STILL DERIVED ──────────────────────────────
 * ANSWERED FROM `TIER_PRICE`, not typed — and from `TIERS`, so the answer names every
 * paid plan rather than the two somebody happened to type. An FAQPage node whose answer
 * contradicts the card three inches above it is the mismatch this whole file is careful
 * about, and a hand-written "$10 a month" here is one price change away from being that.
 * The saving sentence was derived too, which is why it vanished on its own the day the
 * annual rate did instead of surviving as a claim about a price that no longer exists.
 *
 * The other seven are catalogue entries. The `FAQPage` node is built from the same `t` the
 * page renders from, so a crawler and a reader are never handed different documents — which
 * is the mismatch this file is most careful about, and English JSON-LD over Spanish prose is
 * its most literal form.
 */
const FAQ_COUNT = 8
const PRICE_ANSWER_INDEX = 6

function faq(t: T, intl: string): readonly { question: string; answer: string }[] {
  return Array.from({ length: FAQ_COUNT }, (_, i) => ({
    question: t(`mkt.price.faq${i}.q`),
    answer: i === PRICE_ANSWER_INDEX
      ? paidPlanPriceAnswer(t, intl)
      : t(`mkt.price.faq${i}.a`),
  }))
}

export default async function PricingPage() {
  const { t, locale, intl } = await marketingI18n()
  // The shell translator, for the tier taglines only — see `plans()` and `/features`.
  const shellT = tFor(locale)
  const PLANS = plans(t, shellT, intl)
  const FREE_PLAN = freePlan(PLANS)
  const PAID_PLANS = paidPlans(PLANS)
  const SIZED_PLANS = sizedPlans(PLANS)
  const FAQ = faq(t, intl)

  return (
    <>
      {/* The highest-intent page on the public site, and the one retargeting audience
          worth having: "viewed pricing, did not register". Renders null and fires nothing
          unless a Pixel is configured and consent granted. `content` is a key into the
          closed catalogue in lib/meta/events.ts — never a page title, which in this
          product can be a family's name. */}
      <MetaViewContent content="pricing" />
      <StructuredData
        graph={marketingPageGraph({
          path: '/pricing',
          name: t('mkt.price.graphName'),
          description: t('mkt.price.metaDescription'),
          faq: FAQ,
          // The one page entitled to state the tier offers in markup, because it is the one
          // page that displays all three of them. Both rates per tier, and `PreOrder` on the
          // two that cannot be bought yet — see `tierOffer` in lib/structured-data.ts.
          plans: true,
        })}
      />

      <PageHero
        eyebrow={t('mkt.price.eyebrow')}
        title={t('mkt.price.title')}
        lede={t('mkt.price.lede')}
      >
        <Link href={localizedHref(ACCOUNT_ROUTES.register, locale)}>
          <Button size="lg" className="w-full bg-brand-legacy px-8 text-base text-brand-on-legacy hover:opacity-90 sm:w-auto">
            {t('mkt.cta.primary')}
          </Button>
        </Link>
      </PageHero>

      {/* ── FREE, ON THE PAGE ────────────────────────────────────────────
          The floor the whole offer stands on, and the only plan anybody can have
          today. It keeps the cream page and a white band: this is ground level, and
          the three paid tiers are the shelf above it. */}
      <section aria-labelledby="plans-heading" className="bg-background px-4 py-16 sm:px-6 sm:py-20">
        <div className="mx-auto max-w-5xl">
          <SectionHeading
            id="plans-heading"
            eyebrow={t('mkt.price.plansEyebrow')}
            title={t('mkt.price.plansTitle')}
            lede={t('mkt.price.plansLede')}
          />

          {/* ── FREE RUNS THE FULL WIDTH ─────────────────────────────────────
              Four cards in a row was the obvious layout and is the wrong one at every
              width this page is read at: in a 5xl measure it gives each plan about
              240px, which wraps a price onto two lines and turns a six-bullet list
              into a column of fragments. Widening the measure to fit four only moves
              the problem — the cards get their pixels back and the row gets too wide
              to compare across, which is the one job a pricing table has.

              So Free is promoted out of the comparison, and the argument is commercial
              rather than typographic. FREE IS NOT ONE OF FOUR OPTIONS; IT IS THE FLOOR
              THE OTHER THREE STAND ON. Every paid card says "Everything in …" and that
              chain terminates here, so laying it across the top states the offer's
              actual shape: this is what you get for nothing, and the three below are
              what you add to it. It also lets Free's own bullets run in two columns
              instead of one narrow stack — the only place on this page where more
              width makes the copy read faster rather than just bigger.

              PROMOTING IT OUT OF THE ROW IS NOT ENOUGH ON ITS OWN, which is what the
              four-tier split proved: it still shared a background with everything
              else, so the page read as one cream field of outlined boxes. The
              separation that does the work now is the GROUND — see the band below. */}
          <Reveal>
            <div className="relative mt-12 overflow-hidden rounded-2xl border bg-card shadow-[var(--shadow-card)]">
              {/* Growth olive: the first rung of the ramp the ladder below climbs.
                  Every tier gets a rail in its own hue and Free is where the climb
                  starts, so the four bands read as one ascending set rather than as a
                  free thing and then some paid things. */}
              <div aria-hidden="true" className="h-1.5 w-full bg-brand-affirm" />

              <span className="absolute right-0 top-1.5 rounded-bl-xl bg-brand-affirm px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-brand-on-affirm">
                {t('mkt.price.availableNow')}
              </span>

              {/* `lg:` and not `md:`: the right-hand half carries two columns of
                  bullets, so splitting the band before there is room for four columns
                  of text leaves both halves too narrow. Below that it stacks, which is
                  the order the eye reads it in anyway — offer, price, button, then
                  what is in it. */}
              <div className="grid gap-6 p-6 sm:p-7 lg:grid-cols-[minmax(0,17rem)_1fr] lg:gap-10">
                <div className="lg:border-r lg:pr-10">
                  <div className="flex items-center gap-2.5">
                    <span className="inline-flex rounded-xl bg-brand-affirm p-2 text-brand-on-affirm">
                      <Check className="h-4 w-4" aria-hidden="true" />
                    </span>
                    <h3 className="text-2xl">{FREE_PLAN.name}</h3>
                  </div>
                  <p className="mt-2 text-sm text-muted-foreground">{FREE_PLAN.tagline}</p>

                  {FREE_PLAN.price && (
                    <p className="mt-5 flex items-baseline gap-2">
                      <span className="text-5xl font-semibold text-brand-ink">
                        {FREE_PLAN.price.amount}
                      </span>
                      <span className="text-muted-foreground">{FREE_PLAN.price.period}</span>
                    </p>
                  )}

                  <Link
                    href={localizedHref(ACCOUNT_ROUTES.register, locale)}
                    className="mt-5 block"
                  >
                    <Button size="lg" className="w-full text-base">
                      {t('mkt.getStarted')}
                    </Button>
                  </Link>
                  <p className="mt-3 text-center text-xs text-muted-foreground">
                    {t('mkt.price.noCard')}
                  </p>
                </div>

                {/* TWO COLUMNS OF BULLETS, and `sm:` rather than `lg:` deliberately: on
                    a tablet the band has already stacked, so this half has the whole
                    measure to itself and one column of bullets would run a long way
                    down the page for no reason. */}
                <ul className="grid gap-3.5 text-sm sm:grid-cols-2 sm:gap-x-8">
                  {FREE_PLAN.adds.map(item => (
                    // Keyed on the CLAIM, not the label: a translated label is a key that
                    // changes whenever the copy does, and the claim id is what this page
                    // treats as a bullet's identity everywhere else.
                    <li key={item.claim} className="flex gap-3">
                      <Check
                        className="mt-0.5 h-4 w-4 shrink-0 text-brand-affirm"
                        aria-hidden="true"
                      />
                      <span className="leading-relaxed">
                        <span className="block font-medium text-foreground">{item.label}</span>
                        {item.detail && (
                          <span className="mt-0.5 block text-muted-foreground">{item.detail}</span>
                        )}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </Reveal>
        </div>
      </section>

      {/* ── THE PAID LADDER, ON THE HERITAGE BAND ─────────────────────────
          THIS IS THE FIX FOR "THEY ALL SHARE THE SAME BACKGROUND". Splitting one
          offer into four left four outlined boxes on one cream field, which is a
          list rather than a ladder — the eye had nothing to climb and no way to tell
          in four seconds what the shape of the offer was.

          Moving the three paid tiers onto burgundy does three things at once that no
          amount of card styling could do on the page ground. It draws the commercial
          boundary — free below, paid above — as a boundary you can see from across
          the room. It turns every card from an outline drawn ON a surface into a
          white object sitting IN FRONT of one, which is what makes the shadows and
          the hover raise read at all. And it puts the featured tier's gold crown on
          burgundy, which is the brand's signature pairing and the highest-contrast
          thing on the page.

          FLAT `bg-brand-hero`, NOT `.gn-hero-gradient` — that class is specified for
          the dashboard hero, and every marketing band is flat with atmospheric pools
          over it. See the note above it in globals.css: widening it is one class per
          surface and a re-measure per surface. The pools are the same two the hero
          and the closing ask use, so the three burgundy bands on this page are
          recognisably one treatment rather than three. */}
      <section
        aria-labelledby="paid-plans-heading"
        className="relative overflow-hidden bg-brand-hero px-4 py-16 sm:px-6 sm:py-20"
      >
        <div aria-hidden="true" className="pointer-events-none absolute inset-0">
          <div className="gn-float absolute -right-16 -top-24 h-72 w-72 rounded-full bg-brand-legacy/12 blur-3xl" />
          <div className="gn-float-slow absolute -bottom-28 -left-20 h-80 w-80 rounded-full bg-brand-accent/12 blur-3xl" />
        </div>

        <div className="relative mx-auto max-w-5xl">
          <SectionHeading
            id="paid-plans-heading"
            eyebrow={t('mkt.price.paidEyebrow')}
            title={t('mkt.price.paidTitle')}
            lede={t('mkt.price.paidLede')}
            onDark
          />

          <div className="mt-12">
            <PlanLadder plans={PAID_PLANS} />
          </div>
        </div>
      </section>

      {/* ── THE PAGE'S CENTRAL CLAIM, MADE INTERACTIVE ────────────────────
          Back on the cream page, deliberately: the burgundy band above is the price
          list and this is the argument about it, and running them together would
          make the argument look like a fourth plan.

          It gets its own band rather than a line inside the ladder because "no charge
          per relative" is the objection that actually keeps families off products
          like this one, and an objection answered in a bullet has not been answered.
          See `FamilySizeSlider` for why no competitor's figure appears in it. */}
      <section aria-labelledby="per-member-heading" className="bg-background px-4 py-16 sm:px-6 sm:py-20">
        <div className="mx-auto max-w-5xl">
          <SectionHeading
            id="per-member-heading"
            eyebrow={t('mkt.price.sizeEyebrow')}
            title={t('mkt.price.sizeTitle')}
            lede={t('mkt.price.sizeLede')}
          />
          <Reveal>
            <div className="mt-10">
              <FamilySizeSlider plans={SIZED_PLANS} />
            </div>
          </Reveal>
        </div>
      </section>

      {/* ── Why it works this way ─────────────────────────────────────────── */}
      <section className="bg-background px-4 pb-16 sm:px-6 sm:pb-20">
        <div className="mx-auto max-w-5xl">
          <Reveal delay={120}>
            <div className="flex flex-col items-center gap-3 rounded-2xl border bg-card p-6 text-center shadow-[var(--shadow-card)]">
              <div className="inline-flex rounded-xl bg-brand-soft p-2.5">
                <HeartHandshake className="h-6 w-6 text-brand-on-soft" aria-hidden="true" />
              </div>
              <h3 className="text-xl">{t('mkt.price.whyFreeHeading')}</h3>
              <p className="max-w-2xl text-muted-foreground">{t('mkt.price.whyFreeBody')}</p>
              <MoreLink href={localizedHref('/why-us', locale)}>
                {t('mkt.price.compareLink')}
              </MoreLink>
            </div>
          </Reveal>
        </div>
      </section>

      {/* ── FAQ ─────────────────────────────────────────────────────────── */}
      <section aria-labelledby="pricing-faq-heading" className="bg-brand-soft/40 px-4 py-16 sm:px-6 sm:py-20">
        <div className="mx-auto max-w-3xl">
          <SectionHeading
            id="pricing-faq-heading"
            eyebrow={t('mkt.faqEyebrow')}
            title={t('mkt.price.faqTitle')}
          />
          <div className="mt-10 space-y-3">
            {FAQ.map((entry, i) => (
              <Reveal key={entry.question} delay={i * 90}>
                <details className="group rounded-xl border bg-card px-5 py-4 shadow-[var(--shadow-card)] [&_summary::-webkit-details-marker]:hidden">
                  <summary className="flex cursor-pointer items-center justify-between gap-4 text-base font-semibold">
                    {entry.question}
                    <span
                      aria-hidden="true"
                      className="shrink-0 text-xl leading-none text-brand-accent transition-transform duration-300 group-open:rotate-45 motion-reduce:transition-none"
                    >
                      +
                    </span>
                  </summary>
                  <p className="mt-3 leading-relaxed text-muted-foreground">{entry.answer}</p>
                </details>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      <Testimonials heading={t('mkt.price.testimonials')} />

      <CtaBand
        title={t('mkt.price.ctaTitle')}
        lede={t('mkt.price.ctaLede')}
      />
    </>
  )
}
