import type { Metadata } from 'next'
import Link from 'next/link'
import Image from 'next/image'
import {
  Vote, Megaphone, MessagesSquare, Images, FileText, MapPinned,
  BarChart3, Store, ShieldCheck, Users,
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
import { isFeatureFuture } from '@/lib/features'
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
 * when it was written and stopped being true the moment the tiers were set: photo
 * collections, elections, documents, chapters and reports are Plus. Per-feature
 * permissions were on that list and are now Free — the privacy section below says so
 * without a tier tag, and that omission is the current answer rather than an oversight.
 *
 * A features page that implies a paid capability is free is the most expensive kind of
 * marketing error — the customer discovers it at the exact moment they were ready to
 * commit, and what they learn is that we were not straight with them. So each card says
 * which tier it belongs to, and the tags link to /pricing.
 *
 * `tier: null` means NOT YET ASSIGNED and renders no tag at all. Trusted Vendors is the
 * only one, because it was not in the tier breakdown — do not guess it into a tier to make
 * the grid look tidy.
 */
const ALSO: readonly {
  icon: LucideIcon
  title: string
  blurb: string
  tier: 'Free' | 'Plus' | null
  /** Route in `lib/features.ts` whose status decides the badge. Never linked. */
  route?: string
  /**
   * Hand-set, and ONLY for a capability with no route to derive from. Trusted Vendors is
   * the only one — there is no code for it at all, which is also why it has no tier. An
   * item with a `route` must not set this: the registry is the answer, and a boolean that
   * disagrees with it is the drift the derived badge exists to prevent.
   */
  soon?: boolean
}[] = [
  { icon: MessagesSquare, tier: 'Free', route: '/chat', title: 'Family chat', blurb: 'Group threads and private messages, so the family keeps talking between gatherings.' },
  { icon: Megaphone, tier: 'Free', route: '/announcements', title: 'Announcements', blurb: 'Anyone can share news; administrators pin what matters to the top of everyone’s dashboard.' },
  { icon: Vote, tier: 'Plus', route: '/elections', title: 'Officer elections', blurb: 'Nominate, accept or decline, then vote family-wide. Positions pull from your board roster and results tally live.' },
  { icon: Images, tier: 'Plus', route: '/photos', title: 'Photo collections', blurb: 'A gallery per gathering, captions, and tagging that finds the right cousin out of a hundred.' },
  { icon: FileText, tier: 'Plus', route: '/documents', title: 'Documents', blurb: 'Bylaws, minutes, forms and records in one shared place that does not live in an inbox.' },
  { icon: MapPinned, tier: 'Plus', route: '/admin/chapters', title: 'Regions and chapters', blurb: 'Split a large family into chapters with their own leadership and board positions.' },
  { icon: BarChart3, tier: 'Plus', route: '/admin/reports', title: 'Leadership reports', blurb: 'Membership over time, and dues collected against what is still outstanding, at a glance.' },
  { icon: Store, tier: null, soon: true, title: 'Trusted vendors', blurb: 'Family-owned businesses offering members-only products and services.' },
]

/** One answer for both shapes: derived from the registry where there is a route to derive from. */
function isComingSoon(item: { route?: string; soon?: boolean }) {
  return item.soon === true || (item.route ? isFeatureFuture(item.route) : false)
}

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
              Free covers the family tree, the directory, chat, announcements and putting
              the gathering on the calendar with its work handed out. Card and digital
              payments, the dues projections and the treasury reports are Plus.{' '}
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
            lede="Chat and announcements come with the free account; the organizational machinery is Plus. Every card says which tier it belongs to, and which are still on the way — finding either out at checkout is not a nice surprise."
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
                    {item.tier && (
                      <Link
                        href="/pricing"
                        aria-label={`${item.title} is included in the ${item.tier} plan — see pricing`}
                        className={cn(
                          'shrink-0 rounded-full px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-[0.12em] transition-opacity hover:opacity-80',
                          item.tier === 'Free'
                            ? 'bg-brand-affirm/15 text-brand-affirm'
                            : 'bg-brand-legacy/20 text-brand-ink',
                        )}
                      >
                        {item.tier}
                      </Link>
                    )}
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
                    Inside your family, administrators decide who can see the treasury, who
                    can record a payment and who can approve a new member.
                  </p>
                  <ul className="mt-4 grid gap-2 text-sm sm:grid-cols-2">
                    {[
                      'Per-feature permissions, not one blunt admin switch',
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
