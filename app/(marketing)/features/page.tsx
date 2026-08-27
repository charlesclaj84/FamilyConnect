import type { Metadata } from 'next'
import Link from 'next/link'
import {
  Vote, Megaphone, MessagesSquare, Images, FileText, MapPinned, Send,
  BarChart3, ShieldCheck, ShieldAlert, Users,
  Bell, ReceiptText, TrendingUp, ArrowLeftRight, Award, ClipboardList,
  NotebookPen, Gavel, Scale, CalendarDays, ListChecks, PieChart, Users2,
  Landmark, LifeBuoy, UsersRound, UserCog, UserRound,
  ArrowRight, Check, Sparkles, Zap, Crown,
  CreditCard, CalendarClock, BellRing, Smartphone,
  Network, HandCoins, ScrollText, SlidersHorizontal, ClipboardCheck, PiggyBank,
  FileStack, Wallet, LineChart, BookUser, IdCard, UserCheck, PartyPopper, CalendarPlus,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Reveal } from '@/components/marketing/Reveal'
import { StructuredData } from '@/components/marketing/StructuredData'
import { LivingSitePreview } from '@/components/marketing/LivingSitePreview'
import {
  PageHero, SectionHeading, MoreLink, ComingSoonBadge,
} from '@/components/marketing/sections'
import { CtaBand } from '@/components/marketing/CtaBand'
import { pillars } from '@/components/marketing/pillars'
import { PillarVignette } from '@/components/marketing/PillarVignette'
import { TIER_ACCENT } from '@/components/marketing/tier-accent'
import { marketingPageGraph } from '@/lib/structured-data'
import { ACCOUNT_ROUTES } from '@/lib/marketing-nav'
import { isFeatureFuture, getFeature } from '@/lib/features'
import { DEFAULT_TIER, TIERS, TIER_LABEL, tierTagline, type FamilyTier } from '@/lib/tiers'
import { TIER_PRICE, formatPlanPrice } from '@/lib/plans'
import { localizedHref } from '@/lib/i18n/route-locale'
import { marketingAlternates, marketingI18n } from '@/lib/marketing/locale'
// ── THE SHELL CATALOGUE, ON A MARKETING PAGE, AND ONLY FOR THE TIER TAGLINES ────────
// `tierTagline` reads `tier.tagline.<tier>`, which lives in the SHELL catalogue because the
// signed-in surfaces need it — `/admin/settings`, `/upgrade` and `/register` all print it, and a
// key can only live in one bundle (`i18n:check`'s DUPLICATE-KEY). So this page reads the shell
// `t` for that one lookup and the marketing `t` for everything else.
//
// IT COSTS THE BROWSER NOTHING, which is the whole reason it is allowed. This page is a server
// component, so `lib/i18n/catalogues` is resolved during the render and never shipped — the
// 1,763 keys it holds do not reach Home's bundle. The rule that would be broken is a CLIENT
// marketing component importing it; `i18n:check`'s CLIENT-BUNDLE check is what watches for that.
//
// The alternative was a second set of `mkt.tier.*.tagline` keys, which is a second wording of
// one sentence — and these four taglines were already hand-copied into `PLANS[]` on this site
// once, which is the drift `TIER_TAGLINE` was created to prevent.
import { tFor } from '@/lib/i18n/catalogues'
import { type T } from '@/lib/i18n/t'
import { cn } from '@/lib/utils'
import { MetaViewContent } from '@/components/meta/MetaViewContent'

/**
 * ── `generateMetadata`, FOR THE REASON /how-it-works CARRIES AT LENGTH ──────────────
 * Per-language title, description and `hreflang` set. It costs one request-cached header read.
 */
export async function generateMetadata(): Promise<Metadata> {
  const { t, locale } = await marketingI18n()
  return {
    title: t('mkt.feat.metaTitle'),
    description: t('mkt.feat.metaDescription'),
    alternates: marketingAlternates('/features', locale),
  }
}

/**
 * THIS IS THE CATALOGUE. The landing page argues; this page enumerates.
 *
 * The two used to describe the same eleven capabilities in two sets of words, with the
 * LANDING page carrying the longer version — eighteen spotlight bullets and an eight-card
 * grid, plus the only three product images on the site. All of that detail belongs
 * here, where somebody has already decided to evaluate the product, so it moved: the three
 * pillars now render `bullets` and a drawn vignette, and the landing page renders one
 * sentence each.
 *
 * The three pillars come from `components/marketing/pillars.ts` and are shared with the
 * landing page, so the two surfaces cannot drift back into two descriptions of one product.
 *
 * ── THE COMING SOON BADGES ARE NOT DECORATION EITHER ─────────────────────────
 * This header used to assert that every capability below "exists and is reachable by a
 * signed-in member today", and that no badge was therefore needed. It was not true at the
 * time — seventeen of twenty-seven routes were gated, including all three pillars.
 * `FeatureShowcase` had always derived a badge from the registry; this page had no mechanism
 * at all, which made it the surface that would silently misrepresent every flip.
 *
 * IT IS VERY NEARLY TRUE NOW, which is a different reason to keep the mechanism rather than a
 * reason to drop it: as of 2026-08-22 exactly one registry entry is `'future'`, and it is
 * `/admin`, the fail-closed catch-all that is not a page. So no badge renders here today. The
 * derivation stays because a page that would be silently wrong on the next gated route is
 * silently wrong whether or not one exists this week.
 *
 * So `isFeatureFuture(route)` decides the badge here, from the same registry the
 * `/coming-soon` gate reads. Flip a status in `lib/features.ts` and this page corrects
 * itself with no edit. Do not replace a derived badge with a hand-set boolean.
 *
 * None of these routes is LINKED from here. `ACCOUNT_ROUTES` is deliberately just login
 * and register, so a visitor can never walk from a promise into a wall.
 */

/**
 * WHICH TIER A CARD IS IN IS NOT DECORATION. This grid used to sit under a heading reading
 * "Included, not upsold — every one of these ships in the same account", which was true
 * when it was written and stopped being true the moment the tiers were set.
 *
 * A features page that implies a paid capability is free is the most expensive kind of
 * marketing error — the customer discovers it at the exact moment they were ready to
 * commit, and what they learn is that we were not straight with them.
 *
 * **Since 2026-08-22 the answer is the card's POSITION rather than a pill on it:** the grid is
 * cut into one band per tier, each headed with the tier's name, its price and its tagline.
 * `ALSO_BY_TIER` below is where that is derived and argued; the array here stays flat and in
 * authored order, because the band a card lands in is not this list's business.
 *
 * ── AND IT IS DERIVED, WHICH IT WAS NOT UNTIL 2026-08-19 ────────────────────────────
 * Every item takes its tier from `lib/features.ts` through `getFeature()`. It used to be a
 * hand-typed `'Free' | 'Plus'` sitting beside a route that already knew the answer — a second
 * copy of the tier table, on the one page whose entire argument is that it does not
 * misrepresent what a plan includes.
 *
 * Inserting Standard made that cost concrete rather than theoretical: five of these items kept
 * their routes and changed nothing, and this list would have gone on printing whatever was
 * typed here, silently, with nothing in the tree able to notice. The `status` badge beside it
 * has been derived from the same registry since it was written, for exactly this reason; the
 * tier was the half that was not.
 *
 * `tier` WAS THEREFORE ONLY SETTABLE ON A ROUTE-LESS ITEM, and as of 2026-08-20 there are
 * none: Trusted Vendors was the last one and has been removed from the roadmap. Both hand-set
 * escape hatches went with it, so **nothing about a card's plan or its availability can be
 * typed into this file at all** — a `route` and a blurb is the whole of what an entry decides.
 *
 * That is the stronger state and it is worth keeping. If a future capability genuinely has no
 * route — no page, no registry entry, nothing to derive from — it needs the hatch back, and
 * whoever adds it should read the paragraph above first: a hand-typed tier beside a real route
 * is exactly the drift that put a stale `'Free' | 'Plus'` tag on this grid for months.
 */
/**
 * ── THE COPY IS KEYED ON THE ROUTE, AND THE ROUTE WAS ALREADY THE IDENTITY ──────────
 * `title` and `blurb` left this array when the public site learned Spanish and French; the
 * catalogue holds them as `mkt.also.<route>.title` and `.blurb`. Keying on the route rather than
 * on an index is not a style choice — this file's own header says the route is what makes the
 * grid unable to disagree with `lib/features.ts`, and it is what decides which BAND a card lands
 * in. An index would renumber every card below any insertion, which in three catalogues at once
 * is how a Spanish blurb ends up under a French title.
 *
 * The forty-two comments below are kept exactly as they were. They are the argument for what is
 * and is not on this grid — including the fourteen that were missing until 2026-08-22 — and none
 * of it is affected by where the words live.
 */
const ALSO_SHAPES: readonly {
  icon: LucideIcon
  /**
   * Route in `lib/features.ts` whose status AND tier decide both badges. Never linked.
   *
   * REQUIRED, since 2026-08-20. It was optional while one item had no route to derive from,
   * and both hand-set fields beside it (`tier`, `soon`) existed only for that item. All three
   * went together — see the header: the point is that this grid can no longer disagree with
   * the registry, because there is nothing here to disagree WITH.
   */
  route: string
}[] = [
  // ── THE FOURTEEN THE PILLARS WERE COVERING FOR, 2026-08-22 ─────────────────────────
  // Asked of this page directly: "Family Tree is a Standard feature, why isn't it listed?"
  // It was not, and neither were thirteen others — the whole ledger, the planning half of
  // Gatherings, the directory, the P&L. Every one of them was live, and every one was
  // recorded in `marketing-coverage.mjs` as SOLD ELSEWHERE, which was true and had stopped
  // being sufficient.
  //
  // WHAT CHANGED UNDER THIS GRID WITHOUT ANYBODY MOVING IT. It was written as the complement
  // to the pillars — its heading was "Everything ELSE it does" — and a screen a pillar
  // narrated did not need a second card. That is a coherent rule for a flat list beside three
  // spotlight rows. It stopped being one when the grid was cut into tier bands: the bands are
  // now the answer to "what do I get for $5", the lede tells a reader to read one band and
  // stop, and stopping at Standard meant not learning that the product has a family tree.
  //
  // MEASURED RATHER THAN FEARED: the Standard band was three cards — payment history,
  // permission templates and profile pictures — while seven more Standard screens existed,
  // including the three the tier is actually sold on. The cheapest step out of Free was
  // presenting its weakest three capabilities as its whole offer.
  //
  // SO A PILLAR ROUTE MAY NOW ALSO HOLD A CARD, and that is a deliberate reversal of the
  // rule that removed the family-tree card in the first place. The two are not the same
  // claim: the pillar is the NARRATIVE and the card is the INDEX ENTRY, the way /pricing
  // carries both a Free band and a plan ladder. `npm run marketing:check`'s duplicate rule
  // was narrowed to match — two cards on ONE surface is still the drift it was written for.
  //
  // TWO ROUTES ARE STILL NOT HERE and both are in `SOLD_ELSEWHERE` with their reasons:
  // `/dashboard`, which is where the other capabilities render rather than a capability, and
  // `/admin/settings`, a card for which would be selling "rename your family" as a feature.

  // Standard — the tier this omission was costing, so it leads the band in the order it is
  // actually sold in: the record, then the money, then the work.
  { icon: Network, route: '/community/family-tree' },
  { icon: HandCoins, route: '/accounting/dues-and-donations' },
  { icon: ScrollText, route: '/accounting/transactions' },
  { icon: SlidersHorizontal, route: '/admin/accounting' },
  { icon: Wallet, route: '/accounting/summary' },
  { icon: FileStack, route: '/admin/gatherings/templates' },
  { icon: ClipboardCheck, route: '/gatherings/my-tasks' },
  { icon: PiggyBank, route: '/gatherings/budget' },

  // Free — the band that has to do the converting, and the directory is its first promise.
  { icon: BookUser, route: '/community/directory' },
  { icon: PartyPopper, route: '/gatherings' },
  { icon: CalendarPlus, route: '/admin/gatherings' },
  { icon: IdCard, route: '/personal-info' },
  { icon: UserCheck, route: '/admin/members/approvals' },

  // Plus.
  { icon: LineChart, route: '/reporting/pl-summary' },

  { icon: MessagesSquare, route: '/community/chat' },
  { icon: Megaphone, route: '/community/announcements' },
  // ── THE FIRST PREMIUM CARD ON THIS GRID, 2026-08-22 ──────────────────────────────────
  // It sits directly under Announcements because the two are the pair a buyer is comparing:
  // one waits on a dashboard to be found, the other arrives in an inbox. The tier tag beside
  // it is DERIVED, so this card says "Premium" only because `lib/features.ts` does — which is
  // the whole reason the hand-set `tier` escape hatch was removed from this grid.
  //
  // THE BLURB DOES NOT PROMISE AN UNSUBSCRIBE, A TEMPLATE OR AN OPEN RATE, and none of the
  // three is built. It names the one thing that is actually the feature — the audience being
  // the membership rather than a list somebody maintains — which is also the claim
  // `/pricing`'s Premium card has been making since it existed.
  { icon: Send, route: '/community/distributions' },
  // ── SAFETY CHECK-INS, AND THE BLURB IS THE MOST CAREFULLY BOUNDED ONE ON THIS GRID ───
  // It sits beside Distributions because they are the two ways the product reaches the whole
  // family at once, and its tier tag reads FREE because `lib/features.ts` says so — argued at
  // that entry, and the short version is that building it human-raised removed the push/SMS
  // dependency that was the only reason to price it higher.
  //
  // THREE THINGS THE BLURB DELIBERATELY DOES NOT CLAIM, because none of them is true:
  //   * that anything WATCHES for a disaster. There is no alert feed, no weather integration
  //     and no automatic raise — a person raises a check-in, in their own words. A card
  //     implying otherwise would be the RSVP screenshot mistake in text form.
  //   * that a message is GUARANTEED to arrive. It is email plus an in-app notification;
  //     `sendEmail` fails soft and there is no SMS anywhere in this product. So the copy sells
  //     the ROSTER — knowing who has answered — which is the half that is genuinely built.
  //   * that anybody is TRACKED. Nothing here records where a relative is; it records what they
  //     said when they were asked.
  { icon: ShieldAlert, route: '/community/safety-check-ins' },
  // ── THE FAMILY TREE CARD WAS REMOVED AND IS BACK, WITHIN THE SAME DAY ────────────────
  // It went on the argument that it duplicated the family-record PILLAR 400px above it, and
  // that "Everything ELSE it does" meant other than the three pillars. Both were true. What
  // the argument missed is that the pillars carry NO TIER — a pillar spans plans, which is
  // stated in the paragraph under them — so removing the card took the family tree out of
  // the only place on this page that answers which plan a thing is on. It is Standard, and
  // for one day the catalogue said so nowhere.
  //
  // It is at the top of this list now, with the other thirteen that were in the same
  // position. The reasoning is in the block above; the short version is that a narrative and
  // an index are not the same claim.
  // TRIMMED 2026-08-21, when Election Management became its own card below. This one is the
  // MEMBER's half — being nominated, accepting, voting — and the sentence about positions
  // pulling from the board roster moved with the administrator's half, where the person
  // reading it is the one who would act on it.
    // "family-wide" WENT ON 2026-08-21, and it is a correction rather than a trim: an election
  // now belongs to the whole family, one region or one chapter, so the old blurb was false
  // for two of the three. The window sentence is the other half of what changed.
  { icon: Vote, route: '/community/elections' },
  { icon: Images, route: '/community/gallery' },
  { icon: FileText, route: '/library/documents' },
  // TRIMMED 2026-08-21 for the same reason: board positions have their own card now, and this
  // one is about the family's GEOGRAPHY. The two share a screen (Organization is one pane over
  // two grants — see AGENTS.md) and they are two different jobs, which is exactly why they are
  // two keys and now two cards.
  { icon: MapPinned, route: '/admin/members/organization' },
  // REPOINTED 2026-08-20: `/admin/reports` is deleted, and a `route` naming a path this
  // registry no longer has does not fail — `getFeature()` longest-prefix-matches, so it
  // would have resolved to the `/admin` catch-all and printed a Coming Soon pill and a Free
  // tag over a Plus screen that ships. The blurb was rewritten with it: the old one sold
  // "membership over time", and nothing in this product has ever recorded a membership
  // figure over time.
  { icon: BarChart3, route: '/reporting/membership' },
  // ── FOUR ADDED 2026-08-21, after checking this grid against the registry rather than
  // against memory. `lib/features.ts` carries 34 live features; the three pillars and the seven
  // cards above named every one of them EXCEPT these four, and none of the four is a detail of
  // something already sold — each is a screen with its own rail item and its own grant:
  //
  //   Updates                the archive, which is not the announcement composer above it
  //   Payment history        what a MEMBER sees about themselves, not the family's ledger
  //   Dues projections       what is OWED, which the treasury pillar's bullets never mention
  //   Fund transfers         money moving BETWEEN funds — the pillar sells contributions and
  //                          disbursements and stops there, and this is a separate Plus grant
  //
  // Tier and Coming Soon are derived for all four, like every other row here. The check is one
  // script away from being mechanical and is not written; the header above says why a hand-typed
  // tier is the thing that rots, and the same is true of a hand-remembered inventory.
  { icon: Bell, route: '/community/updates' },
  { icon: ReceiptText, route: '/reporting/payment-history' },
  { icon: TrendingUp, route: '/reporting/dues-projections' },
  { icon: ArrowLeftRight, route: '/accounting/transactions/fund-transfers' },
  // MOVED HERE 2026-08-21 from the privacy card below, which had sold it untagged under a
  // heading about family isolation. Isolation is universal and enforced by the database on
  // every query; this is Standard. Conflating the two promised a Free family a screen they
  // cannot open — and putting it here is what makes the promise carry its price, because this
  // grid derives every tag from `lib/features.ts` and cannot disagree with it.
  { icon: ShieldCheck, route: '/admin/members/templates' },
  // ── BROKEN OUT 2026-08-21 ────────────────────────────────────────────────────────
  // Both were sold obliquely, inside a neighbouring card's blurb, and both are a screen with
  // their own rail item and their own grant at the same tier as the card that was carrying
  // them — so nothing was MISPRICED, it was just unfindable. Somebody scanning this grid for
  // "can it keep our officer roster" or "can it run our election" found neither.
  //
  // Each of the two host blurbs was trimmed in the same edit rather than left to overlap: two
  // cards saying the same sentence is how a catalogue stops being readable, and the sentence
  // belongs with whichever card's reader would act on it.
  { icon: Award, route: '/admin/members/board-positions' },
  // Rewritten 2026-08-21 with the feature. The old blurb sold "take it through to a result",
  // which was a description of the three buttons an organizer had to press; the dates run it
  // now. The LEVEL is the other half and is new — see lib/features.ts.
  { icon: ClipboardList, route: '/admin/elections' },
  // ── ELEVEN ADDED 2026-08-22, and this time by a SCRIPT rather than by reading ──────
  // `npm run marketing:check` walks the registry against this grid and the pillars and fails
  // on anything live that neither names. Its first run reported eleven, which is the whole
  // argument for having written it: the same check was done by hand fourteen months' worth of
  // features ago — 2026-08-21, four cards, against a 34-entry registry — and the registry
  // reached 42 two days later. A hand-remembered inventory rots exactly as fast as a
  // hand-typed tier tag, and this grid's header already said so about the tier.
  //
  // WHAT WAS MISSING IS THE SHAPE WORTH NOTICING: not details of things already sold, but
  // whole SECTIONS. The Library (four screens, three of them unnamed anywhere), four of the
  // five reports, the calendar, the manual, the roster screen and multi-family membership.
  // Every one has its own rail item, its own permission key and its own tier — and a buyer
  // reading this page would have concluded the product does none of it.
  //
  // Each tier tag below is derived, like every other row here. Nothing is hand-typed.

  // The Library — Documents is above, and had been the only one of the four on this page.
  { icon: NotebookPen, route: '/library/officer-notes' },
  { icon: Gavel, route: '/library/meeting-minutes' },
  { icon: Scale, route: '/library/bylaws' },

  // The reports. "Leadership reports" above is the MEMBERSHIP one; these four are the rest,
  // and none of them is about money — which is what made them invisible to a page whose
  // reporting story was the treasury pillar.
  { icon: ListChecks, route: '/reporting/gatherings' },
  { icon: PieChart, route: '/reporting/elections' },
  { icon: Users2, route: '/reporting/meetings' },
  { icon: Landmark, route: '/reporting/board' },

  // Free, and all three were unsold.
  { icon: CalendarDays, route: '/gatherings/calendar' },
  { icon: LifeBuoy, route: '/help' },
  { icon: UsersRound, route: '/my-families' },
  { icon: UserCog, route: '/admin/members' },
  // ADDED 2026-08-22 with the sub-key that carries its tier. Profile pictures had been sold on
  // the Standard card and shipped free to every family since the tiers were set — the oldest
  // open item in FutureFeature.md — and `lib/features.ts` could not express it because the
  // upload lives on `/personal-info`, which is Free. It has its own registry row now, so this
  // card's tier tag is derived like every other and the claim finally carries its price.
  { icon: UserRound, route: '/personal-info/photo' },
]

/**
 * Derived from the registry, and only from the registry.
 *
 * It took `soon?: boolean` as well until 2026-08-20, for the one item that had no route. With
 * that item gone there is one shape and one source, which is what makes the pill on this grid
 * trustworthy rather than merely present.
 */

/**
 * The grid's cards, in the reader's language.
 *
 * One `t` lookup per field per card. `marketing:check` still walks the ROUTES rather than the
 * words, so its coverage rule is untouched by this — it asks whether every live feature has a
 * card, and a card is a route.
 */
function also(t: T): readonly { icon: LucideIcon; route: string; title: string; blurb: string }[] {
  return ALSO_SHAPES.map(shape => ({
    ...shape,
    title: t(`mkt.also.${shape.route}.title`),
    blurb: t(`mkt.also.${shape.route}.blurb`),
  }))
}

function isComingSoon(item: { route: string }) {
  return isFeatureFuture(item.route)
}

/**
 * Which tier an item belongs to, read from the registry. There is no other source since
 * 2026-08-20 — the hand-set branch went with the one route-less item on this grid.
 *
 * `getFeature()` longest-prefix-matches, so a typo in a `route` above degrades to whatever the
 * nearest registered parent says rather than to no answer at all. That is the same behaviour
 * the `status` badge has always had here, and it is why the routes in this list are exact
 * hrefs from `lib/features.ts` rather than approximations of them. `npm run marketing:check`
 * is what catches such a typo, precisely because this function cannot.
 */
function tierOf(item: { route: string }) {
  return getFeature(item.route)?.tier ?? DEFAULT_TIER
}

/**
 * The glyph on each band heading — the SAME four `/pricing` puts on its plan cards.
 *
 * A tick for what you already have, `Sparkles` for the tier that turns a place to be
 * into a family being run, a lift for the one that adds the organizational machinery,
 * a crown for the one that reaches every relative. Repeating them here is the point:
 * a visitor arriving from the pricing page should recognise a band by its mark before
 * reading its name, and the two pages are describing one ladder.
 *
 * A `Record<FamilyTier, …>` for the reason `TIER_ACCENT` is one — a fifth tier is a
 * type error here rather than a band that silently draws whatever the default was.
 */
const TIER_GLYPH: Record<FamilyTier, LucideIcon> = {
  free: Check,
  standard: Sparkles,
  plus: Zap,
  premium: Crown,
}

/**
 * ── WHAT IS SOLD AND NOT YET BUILT ──────────────────────────────────────────────────
 *
 * The catalogue enumerated only what SHIPS, and that left it telling half a story: a
 * visitor reading the Premium band saw one card under a heading whose price is $25, and
 * nothing on the page connected that band to the capabilities the pricing page sells it
 * on. The plan was on `/pricing`; the shape of the plan was not on `/features`.
 *
 * These are those capabilities. Every one is on a paid card at `/pricing` today, none is
 * built, and each renders as a visibly different object — dashed, unshaded, badged Coming
 * soon — so nobody can mistake one for a screen they can open. That distinction matters
 * more than the cards do: this page's whole value is that it does not misrepresent what a
 * plan includes, and a roadmap item drawn like a shipped one would burn exactly that.
 *
 * ── `tier` IS HAND-SET HERE, AND ONLY HERE ──────────────────────────────────────────
 * Read the note above `ALSO` before copying this. That grid's `tier` is DERIVED from
 * `lib/features.ts`, and the hand-set field was removed from it in 2026-08-20 because a
 * typed tier beside a real route is a second copy of the tier table that goes stale in
 * silence — it had a wrong `'Free' | 'Plus'` tag on it for months.
 *
 * The reason the hatch is admissible here is precisely that these have NO ROUTE. There is
 * no registry entry, no permission key and no page, so there is nothing to derive from and
 * no second copy to disagree with. **The moment one of these ships it gets a `lib/features.ts`
 * entry, and it MOVES to `ALSO` with its `route` — it does not stay here with a tier typed
 * beside a route that knows better.** That is the one rule for this table.
 *
 * ── WHY THE WEBSITE IS NOT IN IT ────────────────────────────────────────────────────
 * Premium's family website and its address are sold on this page already, by
 * `LivingSitePreview`, which is a full band with its own heading and its own three Coming
 * Soon badges. A card repeating it 1500px above would be the duplication the family-tree
 * card was deleted for on 2026-08-22 — this section's heading is "Everything else it does",
 * and "else" means other than what the page already spells out at length.
 *
 * ── THE COPY IS HAND-KEPT AGAINST `/pricing` AND `lib/plans.ts` ─────────────────────
 * A third copy of the same promises, and deliberately so, for the reason the note above
 * `PLANS[]` gives: a bullet is prose about a benefit, these blurbs are a paragraph about a
 * screen, and neither derives from the other without inventing correspondences. Nothing
 * mechanical can check this one — `npm run marketing:check` reads `route:` and these have
 * none — so an edit to a paid card's promise is an edit here too.
 */
/**
 * The promised ones, per tier — the answer to "what does this plan buy me later".
 *
 * ── NO `route`, WHICH IS WHY THE TIER IS TYPED HERE AND NOWHERE ELSE ON THIS PAGE ───
 * Every other tier tag on this page is DERIVED from `lib/features.ts`, and this table is the one
 * exception because there is nothing to derive from: these have no registry entry, which is
 * exactly what makes them promises. `isComingSoon` must not be consulted for them (it asks the
 * registry); the badge is unconditional because the table is, by definition, the unshipped half.
 *
 * The copy is keyed on the INDEX here rather than on a route, because there is no route to key
 * on. That is the weaker scheme and it is bounded: four entries, and the day one ships it moves
 * into `ALSO` with a route and picks up the route-keyed scheme with everything else.
 */
const ROADMAP_SHAPES: readonly { icon: LucideIcon; tier: FamilyTier }[] = [
  { icon: CreditCard, tier: 'plus' },
  { icon: CalendarClock, tier: 'premium' },
  { icon: BellRing, tier: 'premium' },
  { icon: Smartphone, tier: 'premium' },
]

function roadmap(t: T): readonly {
  icon: LucideIcon
  tier: FamilyTier
  title: string
  blurb: string
}[] {
  return ROADMAP_SHAPES.map((shape, i) => ({
    ...shape,
    title: t(`mkt.feat.soon${i}.title`),
    blurb: t(`mkt.feat.soon${i}.blurb`),
  }))
}

function alsoByTier(t: T) {
  const ALSO = also(t)
  const ROADMAP = roadmap(t)
  return TIERS
    .map(tier => ({
      tier,
      items: ALSO.filter(item => tierOf(item) === tier),
      // The shipped cards first, then what the plan is still going to be. Sorting them the
      // other way round would put a promise above a fact on a page whose argument is that it
      // does not confuse the two.
      soon: ROADMAP.filter(item => item.tier === tier),
    }))
    .filter(band => band.items.length + band.soon.length > 0)
}

/*
 * `STANDARD_RATE` WAS HERE, and its removal is the point rather than a tidy-up.
 *
 * It existed for one sentence under the pillars naming what each tier covered and what Standard
 * cost — a hand-typed copy of the tier table that went stale twice. The tier BANDS below state
 * the price of every plan they render, each read from `TIER_PRICE` at the point of use, so a
 * figure no longer has to be hoisted to the top of the file to be shared by one caller.
 *
 * The rule it was written for is unchanged and still binds: a price in prose is still a price,
 * and `lib/plans.ts` is the only place any of them is written down.
 */

export default async function FeaturesPage() {
  const { t, locale, intl } = await marketingI18n()
  // The shell translator, for the tier taglines only. See the note on the import.
  const shellT = tFor(locale)
  const ALSO_BY_TIER = alsoByTier(t)
  const PILLARS = pillars(t)

  return (
    <>
      <MetaViewContent content="features" />
      <StructuredData
        graph={marketingPageGraph({
          path: '/features',
          name: t('mkt.feat.graphName'),
          description: t('mkt.feat.metaDescription'),
        })}
      />

      <PageHero
        eyebrow={t('mkt.feat.eyebrow')}
        title={t('mkt.feat.title')}
        lede={t('mkt.feat.lede')}
      >
        <Link href={localizedHref(ACCOUNT_ROUTES.register, locale)}>
          <Button size="lg" className="w-full bg-brand-legacy px-8 text-base text-brand-on-legacy hover:opacity-90 sm:w-auto">
            {t('mkt.feat.heroPrimary')}
          </Button>
        </Link>
        <Link href={localizedHref('/pricing', locale)}>
          <Button size="lg" className="w-full border-brand-on-primary/40 bg-transparent px-8 text-base text-brand-on-primary hover:bg-brand-on-primary/10 sm:w-auto">
            {t('mkt.feat.heroSecondary')}
          </Button>
        </Link>
      </PageHero>

      {/* ── The three pillars ─────────────────────────────────────────────── */}
      <section aria-labelledby="pillars-heading" className="bg-background px-4 py-16 sm:px-6 sm:py-20">
        <div className="mx-auto max-w-6xl">
          <SectionHeading
            id="pillars-heading"
            eyebrow={t('mkt.feat.coreEyebrow')}
            title={t('mkt.feat.coreTitle')}
            lede={t('mkt.feat.coreLede')}
          />

          {/* Alternating rows rather than the three stacked cards this was, because the
              screenshots moved here from the landing page and a 1200px-wide product shot
              inside a half-width card column is texture rather than evidence. The
              alternation is what stops three tall rows reading as one long column.

              `items-center` and not `items-start`: the copy column is six bullets tall
              and the image is roughly square, so aligning to the top leaves the shorter
              one hanging in the middle of a lot of nothing. */}
          <div className="mt-12 space-y-16 sm:space-y-20">
            {PILLARS.map((pillar, i) => {
              // Odd rows put the image on the LEFT at lg. Below lg the copy always
              // leads, because a screenshot with no words yet explains nothing.
              const reversed = i % 2 === 1
              return (
                <Reveal key={pillar.route}>
                  <div className="grid items-center gap-8 lg:grid-cols-2 lg:gap-14">
                    <div className={cn('space-y-4', reversed ? 'lg:order-2' : 'lg:order-1')}>
                      <div className="flex flex-wrap items-center gap-3">
                        <span className={`inline-flex rounded-xl p-2.5 ${pillar.chip}`}>
                          <pillar.icon className={`h-6 w-6 ${pillar.tone}`} aria-hidden="true" />
                        </span>
                        <span className="text-xs font-semibold uppercase tracking-[0.18em] text-brand-accent">
                          {pillar.eyebrow}
                        </span>
                        {isFeatureFuture(pillar.route) && <ComingSoonBadge label={t('mkt.comingSoon')} />}
                      </div>
                      <h3 className="text-2xl sm:text-3xl">{pillar.title}</h3>
                      <p className="text-base leading-relaxed text-muted-foreground">
                        {pillar.blurb}
                      </p>
                      <ul className="grid gap-x-6 gap-y-2.5 pt-1 sm:grid-cols-2 lg:grid-cols-1">
                        {pillar.bullets.map(bullet => (
                          <li key={bullet} className="flex gap-3 text-sm">
                            <span
                              aria-hidden="true"
                              className="mt-1.5 size-1.5 shrink-0 rotate-45 bg-brand-legacy"
                            />
                            <span className="leading-relaxed">{bullet}</span>
                          </li>
                        ))}
                      </ul>
                    </div>

                    {/* ── A DRAWN PANEL, NOT A SCREENSHOT ─────────────────────────
                        Until 2026-08-22 this was `next/image` over
                        `components/marketing/screenshots/*.png`, and the comment that
                        stood here explained how the frame took the image's intrinsic
                        ratio. What it did not know is that none of the three files was
                        a screenshot: each was a placeholder card carrying a title, the
                        lockup, a line of stock prose and the words COMING SOON in gold.

                        So the strongest band on the catalogue — the three jobs the
                        product is sold on — was three large boxes announcing that all
                        three were unbuilt, about four hundred pixels above a heading
                        that reads "Every card here is a screen that ships today". They
                        do ship. `PillarVignette` carries the rest of the account,
                        including the one rule for editing a vignette: it may only draw
                        what its pillar's bullets already claim. */}
                    <div className={cn(reversed ? 'lg:order-1' : 'lg:order-2')}>
                      <PillarVignette kind={pillar.vignette} />
                    </div>
                  </div>
                </Reveal>
              )
            })}
          </div>

          {/* ── A PILLAR SPANS TIERS, AND THIS PARAGRAPH USED TO SAY WHICH, BY HAND ────
              Each of the three narratives above crosses a plan boundary, and all three do — the
              treasury pillar's dues and routing bullets are Standard while its P&L is Plus, the
              family-record pillar's directory is Free while the tree is Standard, and the
              gatherings pillar puts a date on a shared calendar for Free and hands out the work
              for Standard. That is what a pillar IS: the job a family is trying to do, not a
              row in a price list.

              SO THE PILLARS CARRY NO TIER TAG, deliberately, and adding one would be worse than
              the silence — a single badge on a card whose six bullets sit at two different
              prices is a claim that is wrong either way it resolves.

              WHAT STOOD HERE INSTEAD WAS A HAND-TYPED SENTENCE naming what each tier covers:
              the fourth copy of the tier table in the tree, in the one form nothing could
              check. It went stale twice — it was still describing a three-tier product after
              Standard was inserted, and still omitting the Library and the reports two days
              after they shipped.

              IT IS NOT REPLACED WITH A DERIVED SENTENCE, because the grid immediately below is
              already that answer: one band per tier, each headed with its price and its screen
              count, every card's tier read from `lib/features.ts`. A prose summary of a table
              that is right there is a second thing to keep in step for no reader's benefit. So
              this is a pointer, and it names no tier and no figure at all. */}
          <Reveal delay={200}>
            <p className="mx-auto mt-16 max-w-2xl text-center text-sm text-muted-foreground sm:mt-20">
              Each of those three spans more than one plan. What follows is the exact
              answer, screen by screen, with the plan it belongs to over each group.{' '}
              <Link href="/pricing" className="font-semibold text-brand-accent hover:text-brand-ink">
                Or see what each tier costs
              </Link>
              .
            </p>
          </Reveal>
        </div>
      </section>

      {/* ── Everything else ──────────────────────────────────────────────── */}
      <section aria-labelledby="also-heading" className="bg-brand-soft/40 px-4 py-16 sm:px-6 sm:py-20">
        <div className="mx-auto max-w-6xl">
          {/* "AND THE REST" / "EVERYTHING ELSE IT DOES" UNTIL 2026-08-22, when the grid
              stopped being the pillars' complement and became the complete index — see the
              block at the top of `ALSO`. A heading saying "else" over a list that now
              includes the three pillars' own screens would be the page contradicting
              itself, and it is the heading that told a reader the tree was elsewhere. */}
          <SectionHeading
            id="also-heading"
            eyebrow={t('mkt.feat.gridEyebrow')}
            title={t('mkt.feat.gridTitle')}
            lede={t('mkt.feat.gridLede')}
          />

          {/* ONE BAND PER TIER, in `TIERS` order and derived — see the note on
              `ALSO_BY_TIER`. Not `space-y-*` on a wrapper: each band needs its own
              landmark and heading, so they are siblings with their own top margin. */}
          <div className="mt-12 space-y-14 sm:space-y-16">
            {ALSO_BY_TIER.map(({ tier, items, soon }) => {
              const price = TIER_PRICE[tier]
              const accent = TIER_ACCENT[tier]
              const TierGlyph = TIER_GLYPH[tier]
              const headingId = `also-${tier}-heading`
              return (
                <section key={tier} aria-labelledby={headingId}>
                  <Reveal>
                    {/* ── THE BAND HEADING IS AN OBJECT NOW, NOT A RULE ─────────
                        It was a heading over a hairline border, which is enough to
                        separate two paragraphs and not enough to separate four grids
                        of near-identical cards: the section read as one wall of
                        twenty-eight tiles with some text interleaved, and a reader
                        halfway down a band had nothing on screen telling them which
                        plan they were in.

                        As a filled panel in the tier's own hue it is a landmark you
                        can find by scrolling, and it has room for what a 10px pill
                        never could — the tier's one-line pitch and its price.
                        `tierTagline` and `TIER_PRICE` are both read rather than
                        typed; a price in prose is still a price, and `lib/plans.ts`
                        is the one place any of them is written down.

                        `h3`, because `SectionHeading` above already owns this
                        section's `h2` and a band is a level below it. */}
                    <div className="overflow-hidden rounded-2xl border bg-card shadow-[var(--shadow-card)]">
                      <div aria-hidden="true" className={cn('h-1.5 w-full', accent.rail)} />
                      <div className="flex flex-wrap items-center justify-between gap-x-5 gap-y-3 p-5">
                        <div className="flex items-center gap-3">
                          <span className={cn('inline-flex shrink-0 rounded-xl p-2.5', accent.chip)}>
                            <TierGlyph className="h-5 w-5" aria-hidden="true" />
                          </span>
                          <div>
                            <h3 id={headingId} className="text-xl font-semibold">
                              {TIER_LABEL[tier]}
                              <span className="ml-2.5 text-sm font-normal text-muted-foreground">
                                {/* BOTH HALVES, and the promised one only when there
                                    is one. "12 screens" over a grid holding fifteen
                                    cards is a heading contradicting the thing under it;
                                    "12 screens · 3 on the way" is the same sentence the
                                    cards themselves make. The word stays SCREENS for
                                    the live count and never covers the promises — a
                                    roadmap item is not a screen until it is one. */}
                                {/* One key per grammatical number rather than a
                                    ternary over two English words — see the catalogue.
                                    Spanish and French both agree with English here and
                                    a fourth language may not, which is the reason the
                                    plural is a key and not a suffix. */}
                                {items.length > 0 && (
                                  items.length === 1
                                    ? t('mkt.feat.screenOne')
                                    : t('mkt.feat.screenMany', { n: items.length })
                                )}
                                {items.length > 0 && soon.length > 0 && ' · '}
                                {soon.length > 0 && t('mkt.feat.onTheWay', { n: soon.length })}
                              </span>
                            </h3>
                            <p className="mt-0.5 max-w-xl text-sm text-muted-foreground">
                              {tierTagline(shellT, tier)}
                            </p>
                          </div>
                        </div>
                        {/* A LINK, not a label. Somebody reading a price wants to know
                            what else is on that plan, and the answer is one tap away
                            rather than a scroll back to the nav. Free says "No charge"
                            rather than "$0" — `TIER_PRICE.free` is `null` on purpose,
                            because Free has no price rather than a price of zero and
                            "$0.00" is a figure nobody should render. */}
                        <Link
                          href="/pricing"
                          className="group/price inline-flex items-center gap-1.5 text-sm font-semibold text-brand-accent hover:text-brand-ink"
                        >
                          {price
                            ? t('mkt.feat.perMonth', {
                                amount: formatPlanPrice(price.monthlyCents, intl),
                              })
                            : t('mkt.feat.noCharge')}
                          <ArrowRight
                            aria-hidden="true"
                            className="h-4 w-4 transition-transform duration-300 group-hover/price:translate-x-1 motion-reduce:transition-none motion-reduce:group-hover/price:translate-x-0"
                          />
                          <span className="sr-only">
                            {t('mkt.feat.seePlan', { plan: TIER_LABEL[tier] })}
                          </span>
                        </Link>
                      </div>
                    </div>
                  </Reveal>

                  {/* ── THREE ACROSS, NOT FOUR ────────────────────────────────────
                      Four in a 6xl measure gives each card about 250px, and these
                      blurbs are two and three sentences long — at that width the
                      longest of them ran fourteen lines and the grid read as a column
                      of fragments. Three is about 370px, which is a readable measure
                      for a paragraph, and it costs one extra row per band.

                      It also stops the Premium band, which has one live screen, being
                      a single tile marooned in a quarter of the page. */}
                  <div className="mt-6 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
                    {items.map((item, i) => (
                      <Reveal key={item.title} delay={(i % 3) * 110} className="h-full">
                        {/* ── THE CARD ──────────────────────────────────────────────
                            It was a white box with a sand chip, identical twenty-eight
                            times over. Three things give it a shape now, and each is
                            doing a different job:

                            THE CHIP TAKES THE TIER'S HUE, from the same ramp the
                            pricing ladder climbs (`tier-accent.ts`). This is not the
                            tier PILL coming back — that was removed because a word
                            repeating the heading above it is noise. A colour is not a
                            word: it is what tells you which band you are in when you
                            have scrolled past the heading, which is most of the time
                            you spend in a band this long.

                            THE RAIL APPEARS ON HOVER, so a card answers when you point
                            at it rather than shouting at rest. Twenty-eight permanent
                            rails would be the wall again in a second costume.

                            THE CARD LIFTS. A shadow change alone reads as nothing at
                            this size; the transform is what makes it feel like an
                            object. Pinned flat under reduced motion. */}
                        <div className="group relative flex h-full flex-col overflow-hidden rounded-2xl border bg-card p-5 shadow-[var(--shadow-card)] transition-[transform,box-shadow] duration-300 hover:-translate-y-1 hover:shadow-[var(--shadow-card-hover)] motion-reduce:transition-none motion-reduce:hover:translate-y-0">
                          <span
                            aria-hidden="true"
                            className={cn(
                              'absolute inset-x-0 top-0 h-1 opacity-0 transition-opacity duration-300 group-hover:opacity-100 motion-reduce:transition-none',
                              accent.rail,
                            )}
                          />
                          <div
                            className={cn(
                              'mb-3 inline-flex w-fit rounded-lg p-2 transition-transform duration-300 group-hover:scale-110 motion-reduce:transition-none motion-reduce:group-hover:scale-100',
                              accent.chip,
                            )}
                          >
                            <item.icon className="h-5 w-5" aria-hidden="true" />
                          </div>
                          <h4 className="text-base font-semibold">{item.title}</h4>
                          {/* Its own line, under the title, rather than crowded into
                              the header row: there is not room beside the chip. */}
                          {isComingSoon(item) && <ComingSoonBadge label={t('mkt.comingSoon')} className="mt-2" />}
                          <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">
                            {item.blurb}
                          </p>
                        </div>
                      </Reveal>
                    ))}

                    {/* ── THE PROMISED ONES ─────────────────────────────────────
                        Same grid, same order of reading, and deliberately NOT the same
                        object. Dashed rather than bordered, the page's ground rather
                        than the card surface, no shadow and no hover lift — so the
                        difference between "you can open this" and "this is what the
                        plan is going to be" is legible at a glance and from across the
                        room, before anybody has read a badge.

                        THE BADGE IS STILL THERE, because the visual difference is a
                        convention a first-time reader has not learned yet and because
                        it is the half a screen reader gets. Both, or neither is enough.

                        The chip keeps the tier's hue at reduced opacity: it belongs to
                        this band and is not yet a thing, which is exactly what a
                        washed-out version of the band's own colour says.

                        `isComingSoon` is NOT consulted here and must not be. That
                        function asks the registry, and these have no registry entry —
                        the badge is unconditional because the table is, by definition,
                        the things that have not shipped. The day one does, it moves to
                        `ALSO` with a route and the derivation takes over again. */}
                    {soon.map((item, i) => (
                      <Reveal
                        key={item.title}
                        delay={((items.length + i) % 3) * 110}
                        className="h-full"
                      >
                        <div className="flex h-full flex-col rounded-2xl border border-dashed bg-brand-soft/30 p-5">
                          <div
                            className={cn(
                              'mb-3 inline-flex w-fit rounded-lg p-2 opacity-60',
                              accent.chip,
                            )}
                          >
                            <item.icon className="h-5 w-5" aria-hidden="true" />
                          </div>
                          <h4 className="text-base font-semibold">{item.title}</h4>
                          <ComingSoonBadge label={t('mkt.comingSoon')} className="mt-2" />
                          <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">
                            {item.blurb}
                          </p>
                        </div>
                      </Reveal>
                    ))}
                  </div>
                </section>
              )
            })}
          </div>
        </div>
      </section>
      {/* ── Privacy, which is a feature ──────────────────────────────────── */}
      <section aria-labelledby="privacy-heading" className="bg-background px-4 py-16 sm:px-6 sm:py-20">
        <div className="mx-auto max-w-4xl">
          <Reveal>
            <div className="rounded-2xl border bg-card p-6 shadow-[var(--shadow-card)] sm:p-8">
              <div className="flex flex-col gap-6 sm:flex-row sm:items-start">
                <div className="inline-flex shrink-0 rounded-xl bg-brand-soft p-3">
                  <ShieldCheck className="h-7 w-7 text-brand-on-soft" aria-hidden="true" />
                </div>
                <div>
                  <h2 id="privacy-heading" className="text-2xl">
                    {t('mkt.feat.privacyTitle')}
                  </h2>
                  <p className="mt-3 text-base leading-relaxed text-muted-foreground">
                    {t('mkt.feat.privacyLede')}
                  </p>
                  <ul className="mt-4 grid gap-2 text-sm sm:grid-cols-2">
                    {[
                      // PER-FEATURE PERMISSIONS LEFT THIS LIST ON 2026-08-21, and it is now a
                      // card in the grid above pointing at `/admin/members/templates`. The
                      // three that remain are true on EVERY plan, which is what this card is
                      // for; permissions are Standard (`lib/plans.ts` puts "Separation of
                      // duties" there, and the registry agrees), so selling them in an untagged
                      // card headed "One family cannot see another. Ever." told a Free family
                      // they had something they do not. The grid derives its tier tags, so the
                      // claim now carries its own price wherever it is read.
                      t('mkt.feat.privacy0'),
                      t('mkt.feat.privacy1'),
                      t('mkt.feat.privacy2'),
                    ].map(item => (
                      <li key={item} className="flex gap-2.5">
                        <Users className="mt-0.5 h-4 w-4 shrink-0 text-brand-accent" aria-hidden="true" />
                        <span>{item}</span>
                      </li>
                    ))}
                  </ul>
                  <div className="mt-5">
                    <MoreLink href={localizedHref('/why-us', locale)}>
                      {t('mkt.feat.whyUsLink')}
                    </MoreLink>
                  </div>
                </div>
              </div>
            </div>
          </Reveal>
        </div>
      </section>

      {/* Kept on this page AND on the landing page, deliberately. It is the strongest
          thing on the roadmap and both audiences should meet it — a visitor forming a
          first impression, and one who came here to check whether the product does a
          specific thing. It is badged in three places inside the component, so repeating
          it repeats the caveat too.

          `Testimonials` is NOT here, and its absence is the point: it was on this page
          and on the landing page, pricing, why-us and how-it-works — the same carousel
          five times over. Somebody who has clicked through to read a feature list has
          already been sold; quotes here are the page's least useful band and the one
          most obviously repeated from the page they arrived from. */}
      <LivingSitePreview />

      <CtaBand />
    </>
  )
}
