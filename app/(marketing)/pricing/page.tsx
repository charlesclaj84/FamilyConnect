import type { Metadata } from 'next'
import Link from 'next/link'
import { Check, Sparkles, HeartHandshake } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Reveal } from '@/components/marketing/Reveal'
import { StructuredData } from '@/components/marketing/StructuredData'
import { Testimonials } from '@/components/marketing/Testimonials'
import { PageHero, SectionHeading, CtaBand, ComingSoonBadge, MoreLink } from '@/components/marketing/sections'
import { marketingPageGraph } from '@/lib/structured-data'
import { ACCOUNT_ROUTES } from '@/lib/marketing-nav'
import { APP_NAME } from '@/lib/brand'

const PAGE_TITLE = 'Pricing — Free to Start, No Card Required'
const PAGE_DESCRIPTION =
  `Create your family, invite your relatives and run your first reunion on ${APP_NAME} for free. No credit card, no trial clock, no per-member fee.`

export const metadata: Metadata = {
  title: PAGE_TITLE,
  description: PAGE_DESCRIPTION,
  alternates: { canonical: '/pricing' },
}

/**
 * ── THE ONE THING TO EDIT ON THIS PAGE ──────────────────────────────────────
 *
 * `false` while paid pricing has not been decided. It keeps the premium tier on the page
 * as a roadmap card with NO NUMBER ON IT, which is the only honest way to show a plan
 * whose price nobody has set.
 *
 * WHY THERE IS NO PLACEHOLDER PRICE. A figure on a pricing page is a commercial
 * representation: people budget against it, boards approve against it, and in several
 * jurisdictions advertising a price you do not honour is actionable rather than
 * embarrassing. "$9/mo" typed in as a stand-in is indistinguishable from a real offer to
 * every visitor and every crawler that indexes it — and the cached search result outlives
 * the edit that was going to fix it. So the number is absent until it is real.
 *
 * TO SWITCH IT ON: set this to true and fill in `PLUS_PRICE`. Then add a `Product` with an
 * `Offer` to `lib/structured-data.ts` — page first, markup second, which is the order that
 * file's header insists on.
 */
const PRICING_IS_ANNOUNCED = false
const PLUS_PRICE: { amount: string; period: string } | null = null

/** Everything in the free account. All of it exists and is reachable today. */
const FREE_INCLUDES = [
  'Unlimited family members',
  'Reunion and event planning, with RSVPs and head counts',
  'T-shirt and meal totals collected automatically',
  'Day-of check-in',
  'Dues plans, funds and a full contribution ledger',
  'Profit and loss for your treasurer',
  'Family tree, direct lineage and member directory',
  'Photo collections with tagging',
  'Family chat and direct messages',
  'Announcements pinned to everyone’s dashboard',
  'Officer elections',
  'Documents, regions and chapters',
  'Leadership reports',
  'Per-feature permissions for every member',
] as const

/** The roadmap tier. Names only what is genuinely planned, and promises no date. */
const PLUS_INCLUDES = [
  'Your family’s own public website, building itself from your events and photographs',
  'A custom address for it',
  'Everything in Free, unchanged',
] as const

const FAQ = [
  {
    question: `Is ${APP_NAME} really free?`,
    answer:
      'Yes. Creating your family, inviting every relative, running reunions and using the treasury costs nothing today, and no credit card is required to start.',
  },
  {
    question: 'Is there a limit on how many family members we can add?',
    answer:
      'No. The product is built for a family with a hundred or more adults in it — that is the ordinary case rather than the exception — and there is no per-member charge.',
  },
  {
    question: 'Will the free features I use today start costing money?',
    answer:
      'The features listed under Free on this page are what a family gets for nothing. When a paid tier is announced it will be for additional capability, such as the public family website that is currently in development.',
  },
  {
    question: 'What will the paid tier cost?',
    answer:
      'It has not been announced. Rather than print a placeholder figure that people might budget against, this page shows the premium tier without a price until there is a real one.',
  },
  {
    question: 'Do you sell our family’s data?',
    answer:
      'No. There is no advertising in the product and family data is never shared or sold. One family cannot see another’s data at all — that separation is enforced by the database on every query.',
  },
] as const

export default function PricingPage() {
  return (
    <>
      <StructuredData
        graph={marketingPageGraph({
          path: '/pricing',
          name: PAGE_TITLE,
          description: PAGE_DESCRIPTION,
          faq: FAQ,
        })}
      />

      <PageHero
        eyebrow="Pricing"
        title={<>Free. Not free-for-thirty-days.</>}
        lede={
          <>
            No trial clock, no credit card, and no charge per relative. Bring the whole
            family — that is the point of the product.
          </>
        }
      >
        <Link href={ACCOUNT_ROUTES.register}>
          <Button size="lg" className="w-full bg-brand-legacy px-8 text-base text-brand-on-legacy hover:opacity-90 sm:w-auto">
            Create Your Free Account
          </Button>
        </Link>
      </PageHero>

      {/* ── The plans ────────────────────────────────────────────────────── */}
      <section aria-labelledby="plans-heading" className="bg-background px-4 py-16 sm:px-6 sm:py-20">
        <div className="mx-auto max-w-5xl">
          <SectionHeading
            id="plans-heading"
            eyebrow="Plans"
            title="One free plan that does the job"
            lede="Everything a family organization runs on is in the free account. The tier below it is additive, and not out yet."
          />

          <div className="mt-12 grid items-start gap-6 lg:grid-cols-2">
            {/* FREE — the real one, and given the visual weight to match */}
            <Reveal>
              <div className="relative overflow-hidden rounded-2xl border-2 border-brand-primary/30 bg-card p-6 shadow-[var(--shadow-card-hover)] sm:p-8">
                <span className="absolute right-0 top-0 rounded-bl-xl bg-brand-affirm px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-brand-on-affirm">
                  Available now
                </span>
                <h3 className="text-2xl">Free</h3>
                <p className="mt-1 text-sm text-muted-foreground">
                  For every family, of any size.
                </p>
                <p className="mt-6 flex items-baseline gap-2">
                  <span className="text-5xl font-semibold text-brand-ink">$0</span>
                  <span className="text-muted-foreground">forever</span>
                </p>
                <Link href={ACCOUNT_ROUTES.register} className="mt-6 block">
                  <Button size="lg" className="w-full text-base">
                    Get Started Free
                  </Button>
                </Link>
                <p className="mt-3 text-center text-xs text-muted-foreground">
                  No card. No trial period.
                </p>

                <ul className="mt-7 space-y-2.5 border-t pt-6 text-sm">
                  {FREE_INCLUDES.map(item => (
                    <li key={item} className="flex gap-3">
                      <Check className="mt-0.5 h-4 w-4 shrink-0 text-brand-affirm" aria-hidden="true" />
                      <span className="leading-relaxed">{item}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </Reveal>

            {/* PLUS — the roadmap tier. Muted on purpose: it is not for sale, and a card
                that looks purchasable but has no price reads as a broken page. */}
            <Reveal delay={160}>
              <div className="rounded-2xl border border-dashed bg-brand-soft/30 p-6 sm:p-8">
                <div className="flex items-center gap-3">
                  <h3 className="text-2xl">Family Plus</h3>
                  <ComingSoonBadge />
                </div>
                <p className="mt-1 text-sm text-muted-foreground">
                  For families who want the world to see them.
                </p>

                <div className="mt-6">
                  {PRICING_IS_ANNOUNCED && PLUS_PRICE ? (
                    <p className="flex items-baseline gap-2">
                      <span className="text-5xl font-semibold text-brand-ink">{PLUS_PRICE.amount}</span>
                      <span className="text-muted-foreground">{PLUS_PRICE.period}</span>
                    </p>
                  ) : (
                    <>
                      <p className="text-2xl font-semibold text-brand-ink">
                        Price to be announced
                      </p>
                      <p className="mt-2 text-sm text-muted-foreground">
                        We would rather show you nothing than a number you might budget
                        against and we might change.
                      </p>
                    </>
                  )}
                </div>

                <Button size="lg" disabled className="mt-6 w-full text-base">
                  Not yet available
                </Button>
                <p className="mt-3 text-center text-xs text-muted-foreground">
                  Create a free account and you will hear about it first.
                </p>

                <ul className="mt-7 space-y-2.5 border-t pt-6 text-sm">
                  {PLUS_INCLUDES.map(item => (
                    <li key={item} className="flex gap-3">
                      <Sparkles className="mt-0.5 h-4 w-4 shrink-0 text-brand-accent" aria-hidden="true" />
                      <span className="leading-relaxed">{item}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </Reveal>
          </div>

          <Reveal delay={240}>
            <div className="mt-10 flex flex-col items-center gap-3 rounded-2xl border bg-card p-6 text-center shadow-[var(--shadow-card)]">
              <div className="inline-flex rounded-xl bg-brand-soft p-2.5">
                <HeartHandshake className="h-6 w-6 text-brand-on-soft" aria-hidden="true" />
              </div>
              <h3 className="text-xl">Why give the whole product away?</h3>
              <p className="max-w-2xl text-muted-foreground">
                Because a family portal with half the family in it is worth nothing, and a
                per-member price guarantees half the family stays out. We would rather have
                your whole family using it and earn money later from the things that are
                genuinely extra.
              </p>
              <MoreLink href="/why-us">See how that compares to the alternatives</MoreLink>
            </div>
          </Reveal>
        </div>
      </section>

      {/* ── FAQ ─────────────────────────────────────────────────────────── */}
      <section aria-labelledby="pricing-faq-heading" className="bg-brand-soft/40 px-4 py-16 sm:px-6 sm:py-20">
        <div className="mx-auto max-w-3xl">
          <SectionHeading id="pricing-faq-heading" eyebrow="Questions" title="Straight answers about money" />
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

      <Testimonials heading="Families who stopped paying for three tools" />

      <CtaBand
        title="It costs nothing to find out"
        lede="Create your family, share the code, and see whether it replaces the spreadsheet."
      />
    </>
  )
}
