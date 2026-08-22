import type { Metadata } from 'next'
import Link from 'next/link'
import Image from 'next/image'
import {
  Vote, Megaphone, MessagesSquare, Images, FileText, MapPinned,
  BarChart3, ShieldCheck, Users, Network,
  Bell, ReceiptText, TrendingUp, ArrowLeftRight, Award, ClipboardList,
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
import { DEFAULT_TIER, TIER_LABEL } from '@/lib/tiers'
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
 * signed-in member today", and that no badge was therefore needed. It was not true —
 * `FutureFeature.md` records that seventeen of the twenty-seven routes in
 * `lib/features.ts` are still gated, including all three pillars and seven of the eight
 * cards below. `FeatureShowcase` had always derived a badge from the registry; this page
 * had no mechanism at all, which made it the surface that would silently misrepresent
 * every flip.
 *
 * So `isFeatureFuture(route)` decides the badge here too, from the same registry the
 * `/coming-soon` gate reads. Flip a status in `lib/features.ts` and this page corrects
 * itself with no edit. Do not replace a derived badge with a hand-set boolean — the one
 * hand-set flag below (`soon`) exists only for a capability that has no route to derive
 * from, and it is commented as such.
 *
 * None of these routes is LINKED from here. `ACCOUNT_ROUTES` is deliberately just login
 * and register, so a visitor can never walk from a promise into a wall.
 */

/**
 * THE TIER TAG IS NOT DECORATION. This grid used to sit under a heading reading
 * "Included, not upsold — every one of these ships in the same account", which was true
 * when it was written and stopped being true the moment the tiers were set.
 *
 * A features page that implies a paid capability is free is the most expensive kind of
 * marketing error — the customer discovers it at the exact moment they were ready to
 * commit, and what they learn is that we were not straight with them. So each card says
 * which tier it belongs to, and the tags link to /pricing.
 *
 * ── AND IT IS DERIVED NOW, WHICH IT WAS NOT UNTIL 2026-08-19 ────────────────────────
 * Every item with a `route` takes its tier from `lib/features.ts` through `getFeature()`, and
 * its NAME from `TIER_LABEL`. It used to be a hand-typed `'Free' | 'Plus'` sitting beside a
 * route that already knew the answer — a second copy of the tier table, on the one page whose
 * entire argument is that it does not misrepresent what a plan includes.
 *
 * Inserting Standard made that cost concrete rather than theoretical: five of these items kept
 * their routes and changed nothing, and this list would have gone on printing whatever was
 * typed here, silently, with nothing in the tree able to notice. The `status` badge beside it
 * has been derived from the same registry since it was written, for exactly this reason; the
 * tier was the half that was not.
 *
 * `tier` WAS THEREFORE ONLY SETTABLE ON A ROUTE-LESS ITEM, and as of 2026-08-20 there are
 * none: Trusted Vendors was the last one and has been removed from the roadmap. Both hand-set
 * escape hatches went with it, so **every badge on this grid is now derived** and there is no
 * way to type a tier or a Coming Soon pill into this file at all.
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
  { icon: Network, route: '/community/family-tree', title: 'The family tree', blurb: 'Four generations around whoever you click, with blood and marriage told apart.' },
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
 * The tier tag's text, read from the registry. There is no other source since 2026-08-20 —
 * the hand-set branch went with the one route-less item on this grid.
 *
 * `getFeature()` longest-prefix-matches, so a typo in a `route` above degrades to whatever the
 * nearest registered parent says rather than to no tag at all. That is the same behaviour the
 * `status` badge has always had here, and it is why the routes in this list are exact hrefs
 * from `lib/features.ts` rather than approximations of them.
 */
function tierTag(item: { route: string }): string {
  return TIER_LABEL[getFeature(item.route)?.tier ?? DEFAULT_TIER]
}

/**
 * The one FIGURE this page states, read from `TIER_PRICE` rather than typed.
 *
 * A price in prose is still a price: `lib/plans.ts` is the single place any of them is written
 * down precisely so that a change cannot leave one page saying $5 and another $7. The empty
 * string is the honest fallback for an unpriced tier — the sentence around it names Standard
 * either way, and a "$0" or a "TBA" would both be claims nobody made.
 */
const STANDARD_RATE = TIER_PRICE.standard
  ? formatPlanPrice(TIER_PRICE.standard.monthlyCents)
  : ''

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

          {/* `mt-16` to match the rhythm the rows set. At the `mt-8` this had when the
              pillars were three stacked cards it now reads as a caption on the last
              pillar rather than as a note about all three. */}
          <Reveal delay={200}>
            <p className="mx-auto mt-16 max-w-2xl text-center text-sm text-muted-foreground sm:mt-20">
              Free covers the directory, chat, announcements and putting the gathering on a
              shared calendar. The family tree, the dues ledger and handing out the work are
              Standard, at {STANDARD_RATE} a month. Card and digital payments, the dues
              projections and the treasury reports are Plus.{' '}
              <Link href="/pricing" className="font-semibold text-brand-accent hover:text-brand-ink">
                See what is in each tier
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
            lede="Chat and announcements come with the free account; running the family is Standard and the organizational machinery is Plus. Every card says which tier it belongs to, and which are still on the way — finding either out at checkout is not a nice surprise."
          />

          <div className="mt-12 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {ALSO.map((item, i) => (
              <Reveal key={item.title} delay={(i % 4) * 120} className="h-full">
                <div className="group flex h-full flex-col rounded-2xl border bg-card p-5 shadow-[var(--shadow-card)] transition-shadow duration-300 hover:shadow-[var(--shadow-card-hover)]">
                  <div className="mb-3 flex items-start justify-between gap-2">
                    <div className="inline-flex rounded-lg bg-brand-soft p-2 transition-transform duration-300 group-hover:scale-110 motion-reduce:transition-none motion-reduce:group-hover:scale-100">
                      <item.icon className="h-5 w-5 text-brand-on-soft" aria-hidden="true" />
                    </div>
                    {/* A LINK, not a label. Somebody reading "Plus" wants to know what
                        that costs, and the answer is one tap away rather than a scroll
                        back up to the nav. `tier: null` renders nothing — see the note
                        on ALSO about not guessing an unassigned feature into a tier. */}
                    {(() => {
                      // Resolved once here rather than read off the item, because it is
                      // DERIVED from `lib/features.ts` for anything with a route — see the note
                      // on `ALSO`. Free stays affirm-green and every paid tier is gold: the tag
                      // answers "is this in the free account?", and giving Standard, Plus and
                      // Premium a colour each would ask the reader to learn a key on a page
                      // that does not print one.
                      const tier = tierTag(item)
                      if (!tier) return null
                      return (
                        <Link
                          href="/pricing"
                          aria-label={`${item.title} is included in the ${tier} plan — see pricing`}
                          className={cn(
                            'shrink-0 rounded-full px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-[0.12em] transition-opacity hover:opacity-80',
                            tier === 'Free'
                              ? 'bg-brand-affirm/15 text-brand-affirm'
                              : 'bg-brand-legacy/20 text-brand-ink',
                          )}
                        >
                          {tier}
                        </Link>
                      )
                    })()}
                  </div>
                  <h3 className="text-base font-semibold">{item.title}</h3>
                  {/* Its own line, under the title, rather than crowded into the header
                      row beside the tier tag: at lg these cards are four across a 6xl
                      grid, and an icon chip plus "Coming soon" plus "Plus" leaves the
                      badges about 20px of slack. A wrap there would push the tier tag
                      under the chip and break the row alignment across the grid. */}
                  {isComingSoon(item) && <ComingSoonBadge className="mt-2" />}
                  <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">
                    {item.blurb}
                  </p>
                </div>
              </Reveal>
            ))}
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
