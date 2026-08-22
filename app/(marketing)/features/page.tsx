import type { Metadata } from 'next'
import Link from 'next/link'
import Image from 'next/image'
import {
  Vote, Megaphone, MessagesSquare, Images, FileText, MapPinned,
  BarChart3, ShieldCheck, Users,
  Bell, ReceiptText, TrendingUp, ArrowLeftRight, Award, ClipboardList,
  NotebookPen, Gavel, Scale, CalendarDays, ListChecks, PieChart, Users2,
  Landmark, LifeBuoy, UsersRound, UserCog, UserRound,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Reveal } from '@/components/marketing/Reveal'
import { StructuredData } from '@/components/marketing/StructuredData'
import { LivingSitePreview } from '@/components/marketing/LivingSitePreview'
import {
  PageHero, SectionHeading, CtaBand, MoreLink, ComingSoonBadge,
} from '@/components/marketing/sections'
import { PILLARS } from '@/components/marketing/pillars'
import { marketingPageGraph } from '@/lib/structured-data'
import { ACCOUNT_ROUTES } from '@/lib/marketing-nav'
import { isFeatureFuture, getFeature } from '@/lib/features'
import { DEFAULT_TIER, TIERS, TIER_LABEL, TIER_TAGLINE } from '@/lib/tiers'
import { TIER_PRICE, formatPlanPrice } from '@/lib/plans'
import { APP_NAME } from '@/lib/brand'
import { cn } from '@/lib/utils'

const PAGE_TITLE = 'Everything Your Family Organization Runs On'
const PAGE_DESCRIPTION =
  `Reunion planning, dues and treasury, family tree, photos, elections and chat — every tool a family organization needs, in one private ${APP_NAME} portal.`

export const metadata: Metadata = {
  title: PAGE_TITLE,
  description: PAGE_DESCRIPTION,
  alternates: { canonical: '/features' },
}

/**
 * THIS IS THE CATALOGUE. The landing page argues; this page enumerates.
 *
 * The two used to describe the same eleven capabilities in two sets of words, with the
 * LANDING page carrying the longer version — eighteen spotlight bullets and an eight-card
 * grid, plus the only three product screenshots on the site. All of that detail belongs
 * here, where somebody has already decided to evaluate the product, so it moved: the three
 * pillars now render `bullets` and the screenshots, and the landing page renders one
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
const ALSO: readonly {
  icon: LucideIcon
  title: string
  blurb: string
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
  { icon: MessagesSquare, route: '/community/chat', title: 'Family chat', blurb: 'Group threads and private messages, so the family keeps talking between gatherings.' },
  { icon: Megaphone, route: '/community/announcements', title: 'Announcements', blurb: 'Anyone can share news; administrators pin what matters to the top of everyone’s dashboard.' },
  // ── THE FAMILY TREE CARD WENT ON 2026-08-22, and it is the one removal on this grid ──
  // It duplicated the family-record PILLAR, on the same page, about 400px above it — six
  // bullets about the tree, then a card repeating one of them. This grid's heading is
  // "Everything else it does", and "else" means other than the three pillars, so the card
  // contradicted the section it was in. `npm run marketing:check` is what says so now: it
  // refuses any route claimed by two cards, PILLARS included.
  //
  // Removing it withholds nothing. The pillar's `route` IS `/community/family-tree`, so the
  // tree is still on the catalogue, still tier-tagged from the registry, and still the
  // fullest thing on the page about itself.
  // TRIMMED 2026-08-21, when Election Management became its own card below. This one is the
  // MEMBER's half — being nominated, accepting, voting — and the sentence about positions
  // pulling from the board roster moved with the administrator's half, where the person
  // reading it is the one who would act on it.
    // "family-wide" WENT ON 2026-08-21, and it is a correction rather than a trim: an election
  // now belongs to the whole family, one region or one chapter, so the old blurb was false
  // for two of the three. The window sentence is the other half of what changed.
  { icon: Vote, route: '/community/elections', title: 'Officer elections', blurb: 'Nominate somebody, accept or decline your own nomination, then vote — inside the nomination and voting windows your family set, with results tallied when the poll closes.' },
  { icon: Images, route: '/community/gallery', title: 'Gallery', blurb: 'Albums for every gathering, uploaded in a batch, with tagging that finds the right cousin out of a hundred.' },
  { icon: FileText, route: '/library/documents', title: 'Documents', blurb: 'Forms, filings and records in one shared place that does not live in an inbox.' },
  // TRIMMED 2026-08-21 for the same reason: board positions have their own card now, and this
  // one is about the family's GEOGRAPHY. The two share a screen (Organization is one pane over
  // two grants — see AGENTS.md) and they are two different jobs, which is exactly why they are
  // two keys and now two cards.
  { icon: MapPinned, route: '/admin/members/organization', title: 'Regions and chapters', blurb: 'Split a large family into regions and chapters, each with its own membership and its own leadership.' },
  // REPOINTED 2026-08-20: `/admin/reports` is deleted, and a `route` naming a path this
  // registry no longer has does not fail — `getFeature()` longest-prefix-matches, so it
  // would have resolved to the `/admin` catch-all and printed a Coming Soon pill and a Free
  // tag over a Plus screen that ships. The blurb was rewritten with it: the old one sold
  // "membership over time", and nothing in this product has ever recorded a membership
  // figure over time.
  { icon: BarChart3, route: '/reporting/membership', title: 'Leadership reports', blurb: 'Members by region and chapter, how many have finished joining, and adults against minors.' },
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
  { icon: Bell, route: '/community/updates', title: 'The updates archive', blurb: 'Everything the family has ever announced, and everything sent to you, searchable long after it scrolled off the dashboard.' },
  { icon: ReceiptText, route: '/reporting/payment-history', title: 'Your own payment history', blurb: 'Every payment recorded against you, with its date, amount, method and status — so nobody has to take the treasurer’s word for it.' },
  { icon: TrendingUp, route: '/reporting/dues-projections', title: 'Dues projections', blurb: 'What the family should collect this year, what has come in, and who still owes — counting relatives who never finished registering.' },
  { icon: ArrowLeftRight, route: '/accounting/transactions/fund-transfers', title: 'Transfers between funds', blurb: 'Move money from one fund to another and keep both sides of it on the record.' },
  // MOVED HERE 2026-08-21 from the privacy card below, which had sold it untagged under a
  // heading about family isolation. Isolation is universal and enforced by the database on
  // every query; this is Standard. Conflating the two promised a Free family a screen they
  // cannot open — and putting it here is what makes the promise carry its price, because this
  // grid derives every tag from `lib/features.ts` and cannot disagree with it.
  { icon: ShieldCheck, route: '/admin/members/templates', title: 'Who may do what', blurb: 'A grid of per-feature permissions, so recording dues is not the same as paying money out — and administrators decide who sees the treasury.' },
  // ── BROKEN OUT 2026-08-21 ────────────────────────────────────────────────────────
  // Both were sold obliquely, inside a neighbouring card's blurb, and both are a screen with
  // their own rail item and their own grant at the same tier as the card that was carrying
  // them — so nothing was MISPRICED, it was just unfindable. Somebody scanning this grid for
  // "can it keep our officer roster" or "can it run our election" found neither.
  //
  // Each of the two host blurbs was trimmed in the same edit rather than left to overlap: two
  // cards saying the same sentence is how a catalogue stops being readable, and the sentence
  // belongs with whichever card's reader would act on it.
  { icon: Award, route: '/admin/members/board-positions', title: 'The offices your family keeps', blurb: 'Define the positions your family actually has — national, regional or per chapter — and record who holds each one. It starts empty on purpose: no two families keep the same board.' },
  // Rewritten 2026-08-21 with the feature. The old blurb sold "take it through to a result",
  // which was a description of the three buttons an organizer had to press; the dates run it
  // now. The LEVEL is the other half and is new — see lib/features.ts.
  { icon: ClipboardList, route: '/admin/elections', title: 'Running the election', blurb: 'Set when nominations and voting open and close, and they run themselves. Choose whether the whole family votes or just one region or chapter. Positions pull from your board roster at the matching level.' },
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
  { icon: NotebookPen, route: '/library/officer-notes', title: 'The office keeps its own notebook', blurb: 'Working notes that stay with the ROLE, not the person: three treasurers from now, whoever holds it opens the same notebook. Only the officers who hold that office can read it — not even an administrator.' },
  { icon: Gavel, route: '/library/meeting-minutes', title: 'Minutes, and how the room voted', blurb: 'Schedule a meeting, name its secretary, and pick who is coming by BODY — the national board, one chapter’s board — rather than by ticking eleven names. Topics get put to a vote, and a recorded vote can never be edited by anybody.' },
  { icon: Scale, route: '/library/bylaws', title: 'Your bylaws, searchable', blurb: 'The rules the family agreed to live by, kept by article with the amendments that changed them. Plain-text uploads are searchable word by word; a PDF is searchable by title, article and summary, and every entry says which it is.' },

  // The reports. "Leadership reports" above is the MEMBERSHIP one; these four are the rest,
  // and none of them is about money — which is what made them invisible to a page whose
  // reporting story was the treasury pillar.
  { icon: ListChecks, route: '/reporting/gatherings', title: 'Is the reunion work actually done', blurb: 'Every gathering with how much of its work has come back, what is overdue, who is helping, and what the tasks have claimed against the budget.' },
  { icon: PieChart, route: '/reporting/elections', title: 'Turnout worth calling a mandate', blurb: 'How many voted in each election, how many stood, and which offices nobody put a name forward for.' },
  { icon: Users2, route: '/reporting/meetings', title: 'How often you actually meet', blurb: 'Meetings held, how big each room was, how many decisions were put to a vote, and who answers when one is called. It counts who was asked and who voted, and refuses to call either attendance — nothing in the product records who walked in.' },
  { icon: Landmark, route: '/reporting/board', title: 'Which offices are standing empty', blurb: 'Every office your family has defined, who holds it, and the vacancies — which is the one thing a roster of what exists cannot tell you.' },

  // Free, and all three were unsold.
  { icon: CalendarDays, route: '/gatherings/calendar', title: 'One calendar, not three', blurb: 'A real month grid carrying every gathering on the days it runs, the meetings you are down for, and the days nominations and voting are open. A three-day reunion fills three days.' },
  { icon: LifeBuoy, route: '/help', title: 'A manual, written for your relatives', blurb: 'Every screen explained by name — the buttons, the columns, what each control does and where to look when something is missing. A question mark in the top bar opens the page for wherever you are standing.' },
  { icon: UsersRound, route: '/my-families', title: 'One login, more than one family', blurb: 'Married into a second family, or keeping your father’s and your mother’s side both? One account belongs to as many as you like, and switching between them changes everything on screen at once.' },
  { icon: UserCog, route: '/admin/members', title: 'Look after the roster', blurb: 'Fix a relative’s record, send somebody a password reset, or switch a member off without deleting a thing they ever did.' },
  // ADDED 2026-08-22 with the sub-key that carries its tier. Profile pictures had been sold on
  // the Standard card and shipped free to every family since the tiers were set — the oldest
  // open item in FutureFeature.md — and `lib/features.ts` could not express it because the
  // upload lives on `/personal-info`, which is Free. It has its own registry row now, so this
  // card's tier tag is derived like every other and the claim finally carries its price.
  { icon: UserRound, route: '/personal-info/photo', title: 'A face against every name', blurb: 'A photograph beside each relative — in the directory, on the family tree, in the top bar and on every screen they are listed. Without one they get their initials.' },
]

/**
 * Derived from the registry, and only from the registry.
 *
 * It took `soon?: boolean` as well until 2026-08-20, for the one item that had no route. With
 * that item gone there is one shape and one source, which is what makes the pill on this grid
 * trustworthy rather than merely present.
 */
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
 * The grid, cut into one band per tier — **derived, not authored.**
 *
 * ── WHY GROUPED, 2026-08-22 ──────────────────────────────────────────────────────────
 * It was one 28-card grid with a tier pill on each card, which asks a reader to hold the whole
 * grid in their head and sort it themselves: the question somebody brings to a pricing decision
 * is "what do I get for $5" and the answer was scattered across four rows. Grouping answers it
 * by position, and the band heading can then carry the price and the tagline that a 10px pill
 * never could.
 *
 * ── THE GROUPING IS THE SAME DERIVATION THE PILL WAS, WHICH IS THE WHOLE POINT ────────
 * Nothing here assigns a card to a band. `TIERS` gives the order (that array IS the tier
 * semantics — `TIER_RANK`, `tierMeets` and `tiersIncludedIn` all read it), and `tierOf()` reads
 * `lib/features.ts`. So moving a route between tiers moves its card between bands with no edit
 * to this file, exactly as it used to change the pill — and the per-card pill is therefore
 * REMOVED rather than kept beside a heading that says the same word twice.
 *
 * That is the one thing to preserve if this is ever rearranged again: the reason a hand-typed
 * `'Free' | 'Plus'` was taken off this grid in 2026-08-20 applies with equal force to a
 * hand-assigned group.
 *
 * `.filter()` drops an empty band, which is not cosmetic: Premium's six capabilities are all
 * unbuilt, so it has no live route and no card. A "Premium" heading over an empty grid would
 * be the page implying a catalogue it cannot show — and `PLANS[]` on /pricing is where an
 * unbuilt tier is sold, behind a Coming soon badge, which is the honest place for it.
 */
const ALSO_BY_TIER = TIERS
  .map(tier => ({ tier, items: ALSO.filter(item => tierOf(item) === tier) }))
  .filter(band => band.items.length > 0)

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

export default function FeaturesPage() {
  return (
    <>
      <StructuredData
        graph={marketingPageGraph({
          path: '/features',
          name: PAGE_TITLE,
          description: PAGE_DESCRIPTION,
        })}
      />

      <PageHero
        eyebrow="Features"
        title={<>Everything your family organization runs on</>}
        lede={
          <>
            Most families are running a reunion out of a group text, a treasury out of a
            spreadsheet and a family tree out of one relative&apos;s memory. {APP_NAME}{' '}
            replaces all three — and keeps them in the same private place.
          </>
        }
      >
        <Link href={ACCOUNT_ROUTES.register}>
          <Button size="lg" className="w-full bg-brand-legacy px-8 text-base text-brand-on-legacy hover:opacity-90 sm:w-auto">
            Start Free
          </Button>
        </Link>
        <Link href="/pricing">
          <Button size="lg" className="w-full border-brand-on-primary/40 bg-transparent px-8 text-base text-brand-on-primary hover:bg-brand-on-primary/10 sm:w-auto">
            See pricing
          </Button>
        </Link>
      </PageHero>

      {/* ── The three pillars ─────────────────────────────────────────────── */}
      <section aria-labelledby="pillars-heading" className="bg-background px-4 py-16 sm:px-6 sm:py-20">
        <div className="mx-auto max-w-6xl">
          <SectionHeading
            id="pillars-heading"
            eyebrow="The core"
            title="Three jobs, done properly"
            lede="Not thirty half-features. The three things a family organization actually lives or dies on."
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
                        {isFeatureFuture(pillar.route) && <ComingSoonBadge />}
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

                    {/* `h-auto w-full` with the intrinsic size from the static import, so
                        the frame takes the image's own ratio — nothing cropped, nothing
                        letterboxed. `sizes` matters: this column is half of a 6xl grid at
                        lg (~34rem) and the full width below it, and without saying so
                        Next serves the whole-viewport candidate to every phone. */}
                    <div className={cn(reversed ? 'lg:order-1' : 'lg:order-2')}>
                      <div className="overflow-hidden rounded-3xl border shadow-[var(--shadow-card)]">
                        <Image
                          src={pillar.image}
                          alt={pillar.imageAlt}
                          placeholder="blur"
                          sizes="(min-width: 1024px) 34rem, 100vw"
                          className="h-auto w-full"
                        />
                      </div>
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
          <SectionHeading
            id="also-heading"
            eyebrow="And the rest"
            title="Everything else it does"
            lede="Cut by plan, so you can read one band and stop. Every card here is a screen that ships today — what is still on the way says so on the card, and the tier a card sits under is read from the same registry the product gates itself with."
          />

          {/* ONE BAND PER TIER, in `TIERS` order and derived — see the note on
              `ALSO_BY_TIER`. Not `space-y-*` on a wrapper: each band needs its own
              landmark and heading, so they are siblings with their own top margin. */}
          <div className="mt-12 space-y-14 sm:space-y-16">
            {ALSO_BY_TIER.map(({ tier, items }) => {
              const price = TIER_PRICE[tier]
              const headingId = `also-${tier}-heading`
              return (
                <section key={tier} aria-labelledby={headingId}>
                  <Reveal>
                    {/* THE BAND HEADING CARRIES WHAT THE PILL COULD NOT: the tier's own
                        one-line pitch and its price. `TIER_TAGLINE` and `TIER_PRICE` are both
                        read rather than typed — a price in prose is still a price, and
                        `lib/plans.ts` is the one place any of them is written down.

                        `h3`, because `SectionHeading` above already owns the `h2` for this
                        section and a band is a level below it. h3–h6 stay in Inter and take
                        `--brand-accent` from the base layer, which is why no colour is set
                        here. */}
                    <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 border-b pb-3">
                      <h3 id={headingId} className="text-xl font-semibold">
                        {TIER_LABEL[tier]}
                        <span className="ml-3 text-sm font-normal text-muted-foreground">
                          {items.length} {items.length === 1 ? 'screen' : 'screens'}
                        </span>
                      </h3>
                      {/* A LINK, not a label. Somebody reading a price wants to know what
                          else is on that plan, and the answer is one tap away rather than a
                          scroll back to the nav. Free says "no charge" rather than "$0" —
                          `TIER_PRICE.free` is `null` on purpose, because Free has no price
                          rather than a price of zero and "$0.00" is a figure nobody should
                          render. */}
                      <Link
                        href="/pricing"
                        className="text-sm font-semibold text-brand-accent hover:text-brand-ink"
                      >
                        {price ? `${formatPlanPrice(price.monthlyCents)} a month` : 'No charge'}
                        <span className="sr-only"> — see what is in the {TIER_LABEL[tier]} plan</span>
                      </Link>
                    </div>
                    <p className="mt-3 max-w-2xl text-sm text-muted-foreground">
                      {TIER_TAGLINE[tier]}
                    </p>
                  </Reveal>

                  <div className="mt-6 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
                    {items.map((item, i) => (
                      <Reveal key={item.title} delay={(i % 4) * 120} className="h-full">
                        <div className="group flex h-full flex-col rounded-2xl border bg-card p-5 shadow-[var(--shadow-card)] transition-shadow duration-300 hover:shadow-[var(--shadow-card-hover)]">
                          {/* NO TIER PILL ANY MORE — the band heading above says it, and a
                              "Free" pill on every card in a section headed Free is the same
                              word twice. See the note on `ALSO_BY_TIER`: what mattered about
                              the pill was that it was DERIVED, and the grouping is the same
                              derivation. */}
                          <div className="mb-3 inline-flex w-fit rounded-lg bg-brand-soft p-2 transition-transform duration-300 group-hover:scale-110 motion-reduce:transition-none motion-reduce:group-hover:scale-100">
                            <item.icon className="h-5 w-5 text-brand-on-soft" aria-hidden="true" />
                          </div>
                          <h4 className="text-base font-semibold">{item.title}</h4>
                          {/* Its own line, under the title, rather than crowded into the
                              header row: at lg these cards are four across a 6xl grid and
                              there is not room beside the chip. */}
                          {isComingSoon(item) && <ComingSoonBadge className="mt-2" />}
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
                    One family cannot see another. Ever.
                  </h2>
                  <p className="mt-3 text-base leading-relaxed text-muted-foreground">
                    Family separation is not a setting — it is enforced by the database on
                    every single query, and every action that reads or writes family data
                    has a test that tries to break in from another family and must fail.
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
                      'New members reviewed before they see anything',
                      'Email-verified accounts',
                      'Never shared, never sold, no advertising',
                    ].map(item => (
                      <li key={item} className="flex gap-2.5">
                        <Users className="mt-0.5 h-4 w-4 shrink-0 text-brand-accent" aria-hidden="true" />
                        <span>{item}</span>
                      </li>
                    ))}
                  </ul>
                  <div className="mt-5">
                    <MoreLink href="/why-us">Why families choose us over the alternatives</MoreLink>
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
