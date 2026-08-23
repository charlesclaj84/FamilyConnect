import type { Metadata } from 'next'
import Link from 'next/link'
import {
  MessageSquareX, TableProperties, Share2, Ticket,
  ShieldCheck, Users, Wallet, Search, Layers, Heart,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Reveal } from '@/components/marketing/Reveal'
import { StructuredData } from '@/components/marketing/StructuredData'
import { Testimonials } from '@/components/marketing/Testimonials'
import { PageHero, SectionHeading, CtaBand, MoreLink } from '@/components/marketing/sections'
import { marketingPageGraph } from '@/lib/structured-data'
import { ACCOUNT_ROUTES } from '@/lib/marketing-nav'
import { APP_NAME } from '@/lib/brand'
import { MetaViewContent } from '@/components/meta/MetaViewContent'

const PAGE_TITLE = 'Why Families Choose Us Over Group Chats and Spreadsheets'
// 128 characters. The first draft ran to 171, past the ~155 Google shows on desktop and
// well past the ~120 a phone gives — so the sentence was being cut mid-clause and the
// last thing a searcher saw was an ellipsis. Load-bearing words first, per the note on
// APP_SEO_DESCRIPTION in lib/brand.ts.
const PAGE_DESCRIPTION =
  `A group text loses the plan, a spreadsheet loses the money, a social group loses the privacy. See why families switch to ${APP_NAME}.`

export const metadata: Metadata = {
  // 40 characters → 50 with the appended product name. The draft title rendered at 67
  // and would have been truncated.
  title: 'Why Families Choose Us Over Spreadsheets',
  description: PAGE_DESCRIPTION,
  alternates: { canonical: '/why-us' },
}

/**
 * ── WHY NO COMPETITOR IS NAMED ON THIS PAGE ─────────────────────────────────
 * The comparisons below are to CATEGORIES — a group chat, a spreadsheet, a social group,
 * a generic ticketing tool — and never to a named product. That is a deliberate limit,
 * not timidity:
 *
 *  * A claim about a named competitor's features or price is a factual assertion about
 *    somebody else's business, and it is wrong the moment they ship a release. Comparative
 *    advertising that turns out to be inaccurate is actionable in a way that "a spreadsheet
 *    cannot chase the person who said they would book the hall" simply is not.
 *  * Nobody can verify our claim about their roadmap, but every reader can verify the
 *    category claims here against their own last reunion. Arguments the reader can check
 *    themselves are the ones that persuade.
 *
 * Every statement about OUR side is checkable against the product. Keep it that way — see
 * the rule in `lib/structured-data.ts`, which governs the prose as much as the markup.
 */

const ALTERNATIVES: readonly {
  icon: LucideIcon
  what: string
  problem: string
  cost: string
}[] = [
  {
    icon: MessageSquareX,
    what: 'The family group text',
    problem:
      'Ninety messages deep, four people said yes, two said "maybe", and one asked what the date was again. Nothing is a record.',
    cost: 'Nobody can say who agreed to do what, so the same three people do all of it.',
  },
  {
    icon: TableProperties,
    what: 'A spreadsheet',
    problem:
      'One person owns it, one person understands it, and it lives on their laptop. Dues paid in cash get remembered rather than recorded.',
    cost: 'When that person steps down, the family’s financial history steps down with them.',
  },
  {
    icon: Share2,
    what: 'A social media group',
    problem:
      'Your family’s photographs, addresses and children’s names sit on a platform whose business is advertising, mixed in with everyone’s politics.',
    cost: 'You cannot restrict the treasury to the treasurer, because there is no treasury.',
  },
  {
    icon: Ticket,
    what: 'A generic event tool',
    problem:
      'Built for strangers buying tickets to one event. It has no idea who is related to whom, and it forgets your family the day after.',
    cost: 'Per-ticket fees on your own relatives, and nothing left behind afterwards.',
  },
]

const REASONS: readonly {
  icon: LucideIcon
  title: string
  detail: string
  tone: string
  chip: string
}[] = [
  {
    icon: Layers,
    title: 'It is one place, not five',
    detail:
      'The reunion, the dues, the directory, the photographs and the family tree are the same account, so the person you hand a job to is already on the tree and the payment already knows which fund it belongs to. Nothing is exported and re-imported.',
    tone: 'text-brand-accent',
    chip: 'bg-brand-accent/12',
  },
  {
    icon: Users,
    title: 'Built for a hundred and fifty relatives, not a team of eight',
    detail:
      'Every list that names family members is designed for a family that size: search that matches first name, last name and nickname, handles accents and apostrophes, and tells two Martha Allens apart. Most tools are built for a small team and quietly fall apart at scale.',
    tone: 'text-brand-affirm',
    chip: 'bg-brand-affirm/15',
  },
  {
    icon: ShieldCheck,
    title: 'One family cannot see another. Enforced, not configured',
    detail:
      'Family separation is applied by the database on every single query, and every action that touches family data carries a test that tries to break in from another family and must fail. It is not a checkbox somebody can leave unticked.',
    tone: 'text-brand-ink',
    chip: 'bg-brand-legacy/20',
  },
  {
    icon: Wallet,
    title: 'A treasury a treasurer will accept',
    detail:
      'Dues plans payable in installments, funds with real ledgers, automatic routing so each dollar lands where it belongs, and a profit and loss you can hand to the board. Not a payment button and a hope.',
    tone: 'text-brand-accent',
    chip: 'bg-brand-accent/12',
  },
  {
    icon: Search,
    title: 'Permissions per job, not one admin switch',
    detail:
      'Record dues without being able to pay money out. See the directory without seeing the accounts. Approve new members without touching the treasury. Basic separation of duties, which one blunt "admin" flag cannot express.',
    tone: 'text-brand-affirm',
    chip: 'bg-brand-affirm/15',
  },
  {
    icon: Heart,
    title: 'It is for families, and only families',
    detail:
      'Not a CRM with a family skin on it. Every screen assumes relatives, generations, branches and the person who has been organising this reunion for twenty years — because that is the only thing it is built to do.',
    tone: 'text-brand-ink',
    chip: 'bg-brand-legacy/20',
  },
]

export default function WhyUsPage() {
  return (
    <>
      <MetaViewContent content="whyUs" />
      <StructuredData
        graph={marketingPageGraph({
          path: '/why-us',
          name: PAGE_TITLE,
          description: PAGE_DESCRIPTION,
        })}
      />

      <PageHero
        eyebrow="Why choose us"
        title={<>Your family deserves better than a group text and a spreadsheet</>}
        lede={
          <>
            You are already doing all of this work. You are just doing it in four tools that
            do not talk to each other, and losing something in every gap.
          </>
        }
      >
        <Link href={ACCOUNT_ROUTES.register}>
          <Button size="lg" className="w-full bg-brand-legacy px-8 text-base text-brand-on-legacy hover:opacity-90 sm:w-auto">
            Switch Your Family Free
          </Button>
        </Link>
        <Link href="/features">
          <Button size="lg" className="w-full border-brand-on-primary/40 bg-transparent px-8 text-base text-brand-on-primary hover:bg-brand-on-primary/10 sm:w-auto">
            See what you get
          </Button>
        </Link>
      </PageHero>

      {/* ── What you're using now ────────────────────────────────────────── */}
      <section aria-labelledby="alternatives-heading" className="bg-background px-4 py-16 sm:px-6 sm:py-20">
        <div className="mx-auto max-w-6xl">
          <SectionHeading
            id="alternatives-heading"
            eyebrow="Be honest"
            title="What is running your family right now"
            lede="If one of these is doing the job, you already know where it breaks."
          />

          <div className="mt-12 grid gap-5 sm:grid-cols-2">
            {ALTERNATIVES.map((alt, i) => (
              <Reveal key={alt.what} delay={(i % 2) * 150} className="h-full">
                <div className="h-full rounded-2xl border bg-card p-6 shadow-[var(--shadow-card)]">
                  <div className="mb-4 inline-flex rounded-xl bg-muted p-2.5">
                    <alt.icon className="h-6 w-6 text-muted-foreground" aria-hidden="true" />
                  </div>
                  <h3 className="text-xl">{alt.what}</h3>
                  <p className="mt-3 leading-relaxed text-muted-foreground">{alt.problem}</p>
                  <p className="mt-4 border-l-2 border-destructive/40 pl-3 text-sm font-medium">
                    {alt.cost}
                  </p>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ── Six reasons ──────────────────────────────────────────────────── */}
      <section aria-labelledby="reasons-heading" className="bg-brand-soft/40 px-4 py-16 sm:px-6 sm:py-20">
        <div className="mx-auto max-w-6xl">
          <SectionHeading
            id="reasons-heading"
            eyebrow="The difference"
            title="Six reasons families move and stay"
            lede="Every one of these is checkable inside the product on the day you sign up."
          />

          <div className="mt-12 grid gap-6 lg:grid-cols-3">
            {REASONS.map((reason, i) => (
              <Reveal key={reason.title} delay={(i % 3) * 160} className="h-full">
                <div className="group h-full rounded-2xl border bg-card p-6 shadow-[var(--shadow-card)] transition-shadow duration-300 hover:shadow-[var(--shadow-card-hover)]">
                  <div className={`mb-4 inline-flex rounded-xl p-2.5 transition-transform duration-300 group-hover:scale-110 motion-reduce:transition-none motion-reduce:group-hover:scale-100 ${reason.chip}`}>
                    <reason.icon className={`h-6 w-6 ${reason.tone}`} aria-hidden="true" />
                  </div>
                  <h3 className="text-lg font-semibold">{reason.title}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                    {reason.detail}
                  </p>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ── The switch is cheap ──────────────────────────────────────────── */}
      <section aria-labelledby="switch-heading" className="bg-background px-4 py-16 sm:px-6 sm:py-20">
        <div className="mx-auto max-w-3xl">
          <Reveal>
            <div className="rounded-2xl border-2 border-brand-primary/25 bg-card p-6 shadow-[var(--shadow-card-hover)] sm:p-8">
              <h2 id="switch-heading" className="text-2xl">
                And switching costs you an evening
              </h2>
              <p className="mt-3 leading-relaxed text-muted-foreground">
                There is no migration project, because you are not migrating anything.
                You create the family, share one short code, and your relatives sign
                themselves up — which is the part that would otherwise take you a weekend of
                typing. You approve who belongs. The reunion goes up. That is it.
              </p>
              <div className="mt-5 flex flex-wrap items-center gap-x-6 gap-y-3">
                <MoreLink href="/how-it-works">See the five steps</MoreLink>
                <MoreLink href="/pricing">And what it costs</MoreLink>
              </div>
            </div>
          </Reveal>
        </div>
      </section>

      <Testimonials
        heading="Families who are not going back"
        lede={`Ask us for a reference before you move your family — we would rather you talked to one than took our word for it.`}
      />

      <CtaBand
        title="Give your family one place"
        lede="Free to start, no card, and your relatives do most of the setup themselves."
        primaryLabel="Move Your Family Free"
      />
    </>
  )
}
