import type { Metadata } from 'next'
import Link from 'next/link'
import {
  CalendarCheck, Wallet, Network, Vote, Megaphone, MessagesSquare,
  Images, FileText, MapPinned, BarChart3, Store, ShieldCheck, Users,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Reveal } from '@/components/marketing/Reveal'
import { StructuredData } from '@/components/marketing/StructuredData'
import { LivingSitePreview } from '@/components/marketing/LivingSitePreview'
import { Testimonials } from '@/components/marketing/Testimonials'
import { PageHero, SectionHeading, CtaBand, MoreLink } from '@/components/marketing/sections'
import { marketingPageGraph } from '@/lib/structured-data'
import { ACCOUNT_ROUTES } from '@/lib/marketing-nav'
import { APP_NAME } from '@/lib/brand'

const PAGE_TITLE = 'Everything Your Family Organization Runs On'
const PAGE_DESCRIPTION =
  `Reunion planning, dues and treasury, family tree, photos, elections and chat — every tool a family organization needs, in one private ${APP_NAME} portal.`

export const metadata: Metadata = {
  title: PAGE_TITLE,
  description: PAGE_DESCRIPTION,
  alternates: { canonical: '/features' },
}

/**
 * THE COPY HERE IS THE PRODUCT'S, NOT THE MARKETING TEAM'S.
 *
 * Every capability below exists and is reachable by a signed-in member today. That is not
 * a stylistic preference — `lib/structured-data.ts` binds this codebase to a rule about
 * not claiming what the page cannot show, and a features page is where that rule is
 * easiest to break and most expensive to have broken. The one item still in development
 * is in its own section, badged, further down.
 *
 * Anything added here should be traceable to a route in `lib/features.ts` with
 * `status: 'live'`.
 */
interface Pillar {
  icon: LucideIcon
  title: string
  blurb: string
  bullets: readonly string[]
  tone: string
  chip: string
}

const PILLARS: readonly Pillar[] = [
  {
    icon: CalendarCheck,
    title: 'Reunions that run themselves',
    blurb:
      'From the first save-the-date to day-of check-in, the whole gathering lives in one place — and nobody is chasing a spreadsheet the week before.',
    bullets: [
      'RSVPs with a head count per household, not per email thread',
      'T-shirt sizes and meal counts totalled for you',
      'Day-of check-in, so you know who actually walked in',
      'Event pages with the agenda, the venue and the details attached',
    ],
    tone: 'text-brand-affirm',
    chip: 'bg-brand-affirm/15',
  },
  {
    icon: Wallet,
    title: 'A real treasury, not a shoebox',
    blurb:
      'Collect dues your members can actually afford, route every dollar to the right fund automatically, and answer "where did the money go" with a report instead of an argument.',
    bullets: [
      'Dues plans members can pay in installments',
      'Funds, contributions and disbursements with a full ledger',
      'Automatic routing rules, so money lands in the right place',
      'Profit and loss your treasurer can hand to the board',
    ],
    tone: 'text-brand-accent',
    chip: 'bg-brand-accent/12',
  },
  {
    icon: Network,
    title: 'The family record, kept properly',
    blurb:
      'Who is related to whom, how to reach them, and the lineage that ties every branch together — maintained by the family rather than by one exhausted historian.',
    bullets: [
      'A living family tree with spouses, children and ancestors',
      'Direct lineage view for tracing a single line back',
      'A member directory with search that handles real names',
      'Profiles the family maintains themselves',
    ],
    tone: 'text-brand-ink',
    chip: 'bg-brand-legacy/20',
  },
]

const ALSO: readonly { icon: LucideIcon; title: string; blurb: string }[] = [
  { icon: Vote, title: 'Officer elections', blurb: 'Nominate, accept or decline, then vote family-wide. Positions pull from your board roster and results tally live.' },
  { icon: Megaphone, title: 'Announcements', blurb: 'Anyone can share news; administrators pin what matters to the top of everyone’s dashboard.' },
  { icon: MessagesSquare, title: 'Family chat', blurb: 'Group threads and private messages, so the family keeps talking between gatherings.' },
  { icon: Images, title: 'Photo collections', blurb: 'A gallery per event, captions, and tagging that finds the right cousin out of a hundred.' },
  { icon: FileText, title: 'Documents', blurb: 'Bylaws, minutes, forms and records in one shared place that does not live in an inbox.' },
  { icon: MapPinned, title: 'Regions and chapters', blurb: 'Split a large family into chapters with their own leadership and board positions.' },
  { icon: BarChart3, title: 'Leadership reports', blurb: 'Membership, dues collected against outstanding, RSVP turnout and t-shirt counts at a glance.' },
  { icon: Store, title: 'Trusted vendors', blurb: 'Family-owned businesses offering members-only products and services.' },
]

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

          <div className="mt-12 space-y-6">
            {PILLARS.map((pillar, i) => (
              <Reveal key={pillar.title} delay={i * 120}>
                <div className="grid gap-6 rounded-2xl border bg-card p-6 shadow-[var(--shadow-card)] transition-shadow duration-300 hover:shadow-[var(--shadow-card-hover)] sm:p-8 lg:grid-cols-[1fr_1fr]">
                  <div>
                    <div className={`mb-4 inline-flex rounded-xl p-2.5 ${pillar.chip}`}>
                      <pillar.icon className={`h-6 w-6 ${pillar.tone}`} aria-hidden="true" />
                    </div>
                    <h3 className="text-2xl">{pillar.title}</h3>
                    <p className="mt-3 text-base leading-relaxed text-muted-foreground">
                      {pillar.blurb}
                    </p>
                  </div>
                  <ul className="space-y-2.5 lg:pt-14">
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
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ── Everything else ──────────────────────────────────────────────── */}
      <section aria-labelledby="also-heading" className="bg-brand-soft/40 px-4 py-16 sm:px-6 sm:py-20">
        <div className="mx-auto max-w-6xl">
          <SectionHeading
            id="also-heading"
            eyebrow="And the rest"
            title="Included, not upsold"
            lede="Every one of these ships in the same account. There is no tier where chat is extra."
          />

          <div className="mt-12 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {ALSO.map((item, i) => (
              <Reveal key={item.title} delay={(i % 4) * 120} className="h-full">
                <div className="group h-full rounded-2xl border bg-card p-5 shadow-[var(--shadow-card)] transition-shadow duration-300 hover:shadow-[var(--shadow-card-hover)]">
                  <div className="mb-3 inline-flex rounded-lg bg-brand-soft p-2 transition-transform duration-300 group-hover:scale-110 motion-reduce:transition-none motion-reduce:group-hover:scale-100">
                    <item.icon className="h-5 w-5 text-brand-on-soft" aria-hidden="true" />
                  </div>
                  <h3 className="text-base font-semibold">{item.title}</h3>
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

      <LivingSitePreview />

      <Testimonials lede="Real quotes from real families, as soon as they have given us permission to print them." />

      <CtaBand />
    </>
  )
}
