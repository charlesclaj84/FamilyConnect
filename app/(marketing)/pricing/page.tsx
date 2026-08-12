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
import { cn } from '@/lib/utils'

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

/**
 * ── THE PLAN TABLE — THIS IS WHAT YOU EDIT ──────────────────────────────────
 *
 * Three tiers, and each one INHERITS the tier below it rather than restating it. That is
 * what `inheritsFrom` does: Plus renders "Everything in Free, plus:" and lists only what
 * it adds; Premium does the same for Plus. Two reasons it is modelled rather than typed:
 *
 *  * A restated list drifts. Add a feature to Free and you have to remember to add it to
 *    two other cards, and the day you forget, the expensive tier appears to offer LESS
 *    than the free one. The inheritance line cannot go stale.
 *  * It is also the honest shape of the offer. A customer reading Premium needs to know
 *    they keep everything below it, and "Everything in Plus" says that in three words.
 *
 * `price: null` renders "Price to be announced" and disables the button. Set `PLUS_PRICE`
 * / `PREMIUM_PRICE` and flip `PRICING_IS_ANNOUNCED` when the numbers are real — see the
 * note above it for why there is no placeholder figure.
 *
 * `adds` is deliberately short on the two paid tiers, because those lists are yours to
 * write. What is there now is only what has actually been discussed: the family website
 * that `LivingSitePreview` describes. Add to them freely — the card grows.
 */
interface Plan {
  name: string
  tagline: string
  /** null while the price is not announced. */
  price: { amount: string; period: string } | null
  /** Name of the tier this one contains, or null for the base tier. */
  inheritsFrom: string | null
  /** What THIS tier adds on top of the one it inherits. */
  adds: readonly string[]
  available: boolean
  /** The one tier the eye should land on. Exactly one should be true. */
  featured: boolean
}

const PLUS_PRICE: Plan['price'] = null
const PREMIUM_PRICE: Plan['price'] = null

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

const PLANS: readonly Plan[] = [
  {
    name: 'Free',
    tagline: 'For every family, of any size.',
    price: { amount: '$0', period: 'forever' },
    inheritsFrom: null,
    adds: FREE_INCLUDES,
    available: true,
    featured: false,
  },
  {
    name: 'Plus',
    tagline: 'For families who want the world to see them.',
    price: PLUS_PRICE,
    inheritsFrom: 'Free',
    // ONLY WHAT HAS ACTUALLY BEEN DECIDED. The family website is real — it is the feature
    // LivingSitePreview describes and the one item on the roadmap discussed publicly.
    // Everything else on this tier is yours to add.
    adds: [
      'Your family’s own public website, building itself from your events and photographs',
      'A custom address for it',
    ],
    available: false,
    featured: true,
  },
  {
    name: 'Premium',
    tagline: 'For large families running a real organization.',
    price: PREMIUM_PRICE,
    inheritsFrom: 'Plus',
    // Intentionally empty until you fill it in. An empty list renders the inheritance
    // line and nothing else, which reads as "not specified yet" — the correct impression
    // — rather than inventing capabilities to pad the card out.
    adds: [],
    available: false,
    featured: false,
  },
]

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
            title="Three tiers. The free one is not a trial"
            lede="Everything a family organization runs on is in the free account. Each tier above it adds to the one below rather than unlocking it."
          />

          {/* Three tiers, each inheriting the one below it. `items-stretch` rather than
              `items-start` so all three cards share a height — with different-length
              lists, `items-start` left the two paid cards floating at different heights
              and the row read as broken rather than as three options. */}
          <div className="mt-12 grid items-stretch gap-6 lg:grid-cols-3">
            {PLANS.map((plan, i) => {
              const priced = Boolean(plan.price) && (plan.available || PRICING_IS_ANNOUNCED)
              return (
                <Reveal key={plan.name} delay={i * 150} className="h-full">
                  <div
                    className={cn(
                      'relative flex h-full flex-col overflow-hidden rounded-2xl p-6 sm:p-7',
                      plan.available
                        ? 'border-2 border-brand-primary/30 bg-card shadow-[var(--shadow-card-hover)]'
                        : plan.featured
                          // The featured roadmap tier gets a solid border and the card
                          // surface, so the eye lands on it — but NOT the affirmative
                          // fill, which would read as buyable.
                          ? 'border-2 border-brand-legacy/50 bg-card shadow-[var(--shadow-card)]'
                          : 'border border-dashed bg-brand-soft/30',
                    )}
                  >
                    {plan.available && (
                      <span className="absolute right-0 top-0 rounded-bl-xl bg-brand-affirm px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-brand-on-affirm">
                        Available now
                      </span>
                    )}

                    <div className="flex flex-wrap items-center gap-2.5">
                      <h3 className="text-2xl">{plan.name}</h3>
                      {!plan.available && <ComingSoonBadge />}
                    </div>
                    <p className="mt-1 text-sm text-muted-foreground">{plan.tagline}</p>

                    <div className="mt-6">
                      {priced && plan.price ? (
                        <p className="flex items-baseline gap-2">
                          <span className="text-5xl font-semibold text-brand-ink">
                            {plan.price.amount}
                          </span>
                          <span className="text-muted-foreground">{plan.price.period}</span>
                        </p>
                      ) : (
                        <>
                          <p className="text-xl font-semibold text-brand-ink">
                            Price to be announced
                          </p>
                          <p className="mt-1.5 text-sm text-muted-foreground">
                            We would rather show you nothing than a number you might
                            budget against and we might change.
                          </p>
                        </>
                      )}
                    </div>

                    {plan.available ? (
                      <>
                        <Link href={ACCOUNT_ROUTES.register} className="mt-6 block">
                          <Button size="lg" className="w-full text-base">
                            Get Started Free
                          </Button>
                        </Link>
                        <p className="mt-3 text-center text-xs text-muted-foreground">
                          No card. No trial period.
                        </p>
                      </>
                    ) : (
                      <>
                        <Button size="lg" disabled className="mt-6 w-full text-base">
                          Not yet available
                        </Button>
                        <p className="mt-3 text-center text-xs text-muted-foreground">
                          Create a free account and you will hear about it first.
                        </p>
                      </>
                    )}

                    {/* THE INHERITANCE LINE. Three words that stop this card from having
                        to restate the tier below it — and that cannot fall out of step
                        with it the way a copied list would. */}
                    <div className="mt-7 flex-1 border-t pt-6">
                      {plan.inheritsFrom && (
                        <p className="mb-3 text-sm font-semibold">
                          Everything in {plan.inheritsFrom}, plus:
                        </p>
                      )}
                      {plan.adds.length > 0 ? (
                        <ul className="space-y-2.5 text-sm">
                          {plan.adds.map(item => (
                            <li key={item} className="flex gap-3">
                              {plan.available ? (
                                <Check className="mt-0.5 h-4 w-4 shrink-0 text-brand-affirm" aria-hidden="true" />
                              ) : (
                                <Sparkles className="mt-0.5 h-4 w-4 shrink-0 text-brand-accent" aria-hidden="true" />
                              )}
                              <span className="leading-relaxed">{item}</span>
                            </li>
                          ))}
                        </ul>
                      ) : (
                        // Empty `adds` renders this rather than an empty list. It reads as
                        // "not specified yet", which is true, instead of inventing
                        // capabilities to pad the card out to match its neighbours.
                        <p className="text-sm text-muted-foreground">
                          What this tier adds is still being decided. Everything in{' '}
                          {plan.inheritsFrom} is included.
                        </p>
                      )}
                    </div>
                  </div>
                </Reveal>
              )
            })}
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
