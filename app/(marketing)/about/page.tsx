import type { Metadata } from 'next'
import Image from 'next/image'
import Link from 'next/link'
import { ShieldCheck, EyeOff, Users, Sparkles } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Reveal } from '@/components/marketing/Reveal'
import { StructuredData } from '@/components/marketing/StructuredData'
import { PageHero, SectionHeading, CtaBand, MoreLink } from '@/components/marketing/sections'
import { marketingPageGraph } from '@/lib/structured-data'
import { ACCOUNT_ROUTES } from '@/lib/marketing-nav'
import {
  APP_NAME, APP_TAGLINE, APP_LEAD, APP_VALUES, APP_DESCRIPTION, APP_PUBLISHER,
  BRAND_MARK_SRC, APP_LOGO_ALT,
} from '@/lib/brand'

const PAGE_TITLE = `About ${APP_NAME} — Built for Whole Families`
// 139 characters. The draft opened with APP_TAGLINE, which is 67 on its own and pushed the
// whole thing to 166 — past the ~155 desktop budget, so the part that says what the page
// is about was the part being cut. The tagline still leads the page itself, where there is
// room for it.
const PAGE_DESCRIPTION =
  `Why ${APP_NAME} exists, what it refuses to do with your family's data, and who is behind it. Built for whole families, never sold to advertisers.`

export const metadata: Metadata = {
  title: `About Us — Why ${APP_NAME} Exists`,
  description: PAGE_DESCRIPTION,
  alternates: { canonical: '/about' },
}

/**
 * ── WHAT IS DELIBERATELY NOT ON THIS PAGE ───────────────────────────────────
 * No founder biography, no founding date, no team photographs, no headcount, no "trusted
 * by N families". Every one of those is a checkable fact about real people and this file
 * has no source for any of them, and an About page is the single worst place to be caught
 * inventing one — it is the page a cautious customer reads specifically to decide whether
 * to trust the company with their family's private records.
 *
 * The page is instead built entirely from things that ARE true and verifiable: the brand's
 * own stated mission and values (`lib/brand.ts`), the publisher named in the footer and in
 * the `Organization` structured data, and the product commitments that are enforced in the
 * code rather than asserted in copy.
 *
 * TO ADD THE HUMAN HALF: send the founder's story, the year, and whatever the team is
 * comfortable publishing, and it belongs in the section marked below. It will make this
 * page considerably better — an About page with no people on it is a real weakness, just a
 * smaller one than an About page with invented people on it.
 */

const PRINCIPLES: readonly {
  icon: LucideIcon
  title: string
  detail: string
  tone: string
  chip: string
}[] = [
  {
    icon: EyeOff,
    title: 'We do not sell your family',
    detail:
      'No advertising, no data brokerage, no "anonymised insights" sold on. The product makes money from families choosing to pay for extra capability, and from nothing else. Your relatives’ addresses and your children’s names are not inventory.',
    tone: 'text-brand-accent',
    chip: 'bg-brand-accent/12',
  },
  {
    icon: ShieldCheck,
    title: 'Separation is enforced, not promised',
    detail:
      'One family cannot see another’s data, and that is applied by the database on every query rather than by application code remembering to ask. Every action that reads or writes family data carries a test that attacks it from another family and must fail.',
    tone: 'text-brand-ink',
    chip: 'bg-brand-legacy/20',
  },
  {
    icon: Users,
    title: 'Built for the size families actually are',
    detail:
      'A hundred and twenty adults in one extended family is an ordinary customer here, not an edge case. Every screen that lists members is designed for that — because holding a whole extended family is the entire premise, and a tool that degrades at forty people has missed it.',
    tone: 'text-brand-affirm',
    chip: 'bg-brand-affirm/15',
  },
  {
    icon: Sparkles,
    title: 'We say when something is not ready',
    detail:
      'Features still in development are labelled as such, here and inside the product. A roadmap item presented as shipped is the fastest way to lose a family’s trust, and we would rather be slower than be caught.',
    tone: 'text-brand-accent',
    chip: 'bg-brand-accent/12',
  },
]

const VALUE_COPY: Record<(typeof APP_VALUES)[number], string> = {
  Connect: 'Every branch in one private place — the directory, the chat, and the tree that ties them together.',
  Plan: 'The gathering, from the first save-the-date to the day-of check-in.',
  Celebrate: 'Photographs, milestones and stories, kept for the generations who come after.',
}

export default function AboutPage() {
  return (
    <>
      <StructuredData
        graph={marketingPageGraph({
          path: '/about',
          name: PAGE_TITLE,
          description: PAGE_DESCRIPTION,
        })}
      />

      <PageHero
        eyebrow="About us"
        title={<>{APP_LEAD}</>}
        lede={<>{APP_TAGLINE}</>}
      />

      {/* ── The mission ──────────────────────────────────────────────────── */}
      <section aria-labelledby="mission-heading" className="bg-background px-4 py-16 sm:px-6 sm:py-20">
        <div className="mx-auto max-w-3xl">
          <Reveal>
            <div className="flex flex-col items-center text-center">
              <Image
                src={BRAND_MARK_SRC}
                alt={APP_LOGO_ALT}
                width={72}
                height={72}
                className="h-16 w-16"
              />
              {/* The gold diamond on a hairline rule — the same divider the landing hero
                  uses, reused here so the pages read as one site. Decorative. */}
              <div aria-hidden="true" className="mt-6 flex w-full max-w-xs items-center gap-3">
                <span className="h-px flex-1 bg-brand-legacy/30" />
                <span className="size-1.5 rotate-45 bg-brand-legacy/80" />
                <span className="h-px flex-1 bg-brand-legacy/30" />
              </div>
              <h2 id="mission-heading" className="mt-6 text-3xl sm:text-4xl">
                Why we built it
              </h2>
              <p className="mt-5 text-lg leading-relaxed text-muted-foreground">
                {APP_DESCRIPTION}
              </p>
              <p className="mt-4 text-lg leading-relaxed text-muted-foreground">
                Somewhere in most families there is one person holding the whole thing
                together — the reunion, the dues, the addresses, the photographs, the
                question of who is related to whom. They are doing it in a group text, a
                spreadsheet and their own memory, and when they stop, most of it is lost.
                {' '}{APP_NAME} exists so that the work survives the person doing it.
              </p>
            </div>
          </Reveal>
        </div>
      </section>

      {/* ── The three values ─────────────────────────────────────────────── */}
      <section aria-labelledby="values-heading" className="bg-brand-soft/40 px-4 py-16 sm:px-6 sm:py-20">
        <div className="mx-auto max-w-6xl">
          <SectionHeading
            id="values-heading"
            eyebrow="What the name stands for"
            title="Connect, plan, celebrate"
            lede="Three words, and the product is only allowed to do things that serve one of them."
          />
          <div className="mt-12 grid gap-6 sm:grid-cols-3">
            {APP_VALUES.map((value, i) => (
              <Reveal key={value} delay={i * 170} className="h-full">
                <div className="h-full rounded-2xl border bg-card p-6 text-center shadow-[var(--shadow-card)]">
                  <h3 className="text-lg uppercase tracking-[0.14em]">{value}</h3>
                  <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
                    {VALUE_COPY[value]}
                  </p>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ── Principles ───────────────────────────────────────────────────── */}
      <section aria-labelledby="principles-heading" className="bg-background px-4 py-16 sm:px-6 sm:py-20">
        <div className="mx-auto max-w-5xl">
          <SectionHeading
            id="principles-heading"
            eyebrow="What we will and will not do"
            title="Four commitments, kept in code"
            lede="Not a values statement. Each of these is something you can check."
          />
          <div className="mt-12 grid gap-6 sm:grid-cols-2">
            {PRINCIPLES.map((principle, i) => (
              <Reveal key={principle.title} delay={(i % 2) * 150} className="h-full">
                <div className="h-full rounded-2xl border bg-card p-6 shadow-[var(--shadow-card)]">
                  <div className={`mb-4 inline-flex rounded-xl p-2.5 ${principle.chip}`}>
                    <principle.icon className={`h-6 w-6 ${principle.tone}`} aria-hidden="true" />
                  </div>
                  <h3 className="text-lg font-semibold">{principle.title}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                    {principle.detail}
                  </p>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ── Who is behind it ─────────────────────────────────────────────────
          ADD THE FOUNDER STORY AND TEAM HERE. See the header of this file for why
          there is no biography, date or headcount in it yet: they are checkable facts
          about real people and inventing them on the one page a cautious customer reads
          to decide whether to trust us would be the worst possible trade. The publisher
          below is real — it is the entity in the footer and in the Organization
          structured data. */}
      <section aria-labelledby="publisher-heading" className="bg-brand-soft/40 px-4 py-16 sm:px-6 sm:py-20">
        <div className="mx-auto max-w-3xl">
          <Reveal>
            <div className="rounded-2xl border bg-card p-6 text-center shadow-[var(--shadow-card)] sm:p-8">
              <h2 id="publisher-heading" className="text-2xl">Who is behind {APP_NAME}</h2>
              <p className="mt-3 leading-relaxed text-muted-foreground">
                {APP_NAME} is built and published by {APP_PUBLISHER}. It is a product with a
                single purpose rather than a side feature of something larger — which is why
                every screen assumes relatives, generations and branches instead of
                customers, teams and accounts.
              </p>
              <div className="mt-5 flex flex-wrap justify-center gap-x-6 gap-y-3">
                <MoreLink href="/features">What it does</MoreLink>
                <MoreLink href="/why-us">Why families switch</MoreLink>
              </div>
            </div>
          </Reveal>
        </div>
      </section>

      <section className="bg-background px-4 py-16 sm:px-6">
        <div className="mx-auto max-w-2xl text-center">
          <Reveal>
            <h2 className="text-2xl">Come and see</h2>
            <p className="mt-3 text-muted-foreground">
              The fastest way to judge whether this is right for your family is to create
              the family and look. It is free, and nothing is published to anyone until you
              approve them.
            </p>
            <div className="mt-6 flex justify-center">
              <Link href={ACCOUNT_ROUTES.register}>
                <Button size="lg" className="px-8 text-base">Create Your Family</Button>
              </Link>
            </div>
          </Reveal>
        </div>
      </section>

      <CtaBand
        title="One place, for every generation"
        lede="Create your free account and bring the whole family in."
      />
    </>
  )
}
