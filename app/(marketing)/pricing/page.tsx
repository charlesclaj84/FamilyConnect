import type { Metadata } from 'next'
import Link from 'next/link'
import { Check, HeartHandshake, Zap, Crown } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
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
 * `adds` carries only what has actually been decided. Add to them freely — the card grows.
 * Premium is the one to watch: it began as the family website `LivingSitePreview`
 * describes and has since taken on the reach features too — the apps, notifications,
 * email distributions and automatic dues reminders — so its tagline names both halves
 * rather than the website alone.
 */
interface PlanFeature {
  /** The benefit, in the fewest words that land it. This is what gets scanned. */
  label: string
  /** The proof, for the reader who slowed down. Optional. */
  detail?: string
}

interface Plan {
  name: string
  tagline: string
  /** null while the price is not announced. */
  price: { amount: string; period: string } | null
  /** Name of the tier this one contains, or null for the base tier. */
  inheritsFrom: string | null
  /** What THIS tier adds on top of the one it inherits. */
  adds: readonly PlanFeature[]
  available: boolean
  /** The one tier the eye should land on. Exactly one should be true. */
  featured: boolean
  /**
   * The bullet glyph, one per tier rather than one per state.
   *
   * Free and Plus both used to draw `Sparkles`, which made two different offers look like
   * the same offer at a glance — and on a pricing page the glance is most of the decision.
   * A tick for what you already have, a lift for the tier that adds the machinery, a crown
   * for the one that reaches every relative and puts the family on the public internet.
   */
  icon: LucideIcon
}

const PLUS_PRICE: Plan['price'] = null
const PREMIUM_PRICE: Plan['price'] = null

/**
 * ── HOW THIS COPY IS WRITTEN, so the next edit keeps doing it ────────────────
 * Every `label` names the OUTCOME and every `detail` names the mechanism. "Stop guessing
 * the head count" then "RSVPs, t-shirt sizes and meal counts totalled for you" — not
 * "RSVP module". A feature list that reads like a changelog makes the buyer do the
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
 *  * PLUS opens on taking a payment that is not cash, which is the limit Free names out
 *    loud, then the head count. It ends on the photographs and the profile pictures: loved,
 *    opened daily, and not the machinery this tier is sold as.
 *  * PREMIUM opens on chasing relatives for money they already agreed to pay. Notifications
 *    outrank the apps deliberately — nobody has ever complained about the absence of an app,
 *    whereas "half the family says they never saw it" is a sentence every organizer has
 *    said — and the website, the tier's signature, does not lead at all.
 *
 * WHAT IS NOT CLAIMED. Free's ledger is cash only, and that is stated rather than
 * softened — a family that signs up expecting to take card payments and finds they
 * cannot has been misled, and that is a refund and a review. Naming the limit is also
 * what makes Plus obviously worth paying for.
 */
const PLANS: readonly Plan[] = [
  {
    name: 'Free',
    tagline: 'Get your whole family in one place. All of them.',
    price: { amount: '$0', period: 'forever' },
    inheritsFrom: null,
    icon: Check,
    adds: [
      {
        label: 'Every single relative, at no charge',
        detail: 'Unlimited members. No per-person fee, so nobody gets left out to keep a bill down.',
      },
      {
        label: 'Never lose track of who is who again',
        detail: 'The family tree, direct lineage back through the generations, and a directory you can search.',
      },
      {
        label: 'Put the reunion on the calendar',
        detail: 'The date, the place and the details in one shared page.',
      },
      {
        label: 'News that reaches the whole family',
        detail: 'Announcements pinned to everyone’s dashboard instead of buried in a group text.',
      },
      {
        label: 'A real ledger for the money you collect',
        detail: 'Dues plans and a contribution ledger for cash, recorded instead of remembered.',
      },
      {
        label: 'Separation of duties',
        detail: 'Per-feature permissions, so recording dues is not the same as paying money out.',
      },
      {
        label: 'Keep talking between gatherings',
        detail: 'Family-wide chat and private messages.',
      },
    ],
    available: true,
    featured: false,
  },
  {
    name: 'Plus',
    tagline: 'For families with dues to collect and a reunion to run.',
    price: PLUS_PRICE,
    inheritsFrom: 'Free',
    icon: Zap,
    // ── DETAILS DELIBERATELY SHORT ────────────────────────────────────────────
    // Eight items with two-line explanations each made this the tallest card by a wide
    // margin, and height is not persuasion — a reader skims a pricing card, they do not
    // study it. The benefit line does the selling and the detail names the mechanism in as
    // few words as will carry it. The full story lives on /features, which is the page for it.
    adds: [
      {
        label: 'Get paid the way your family actually pays',
        detail: 'Card, debit, PayPal, Apple Pay, Google Pay and Cash App, with funds and a full ledger behind them.',
      },
      {
        label: 'Stop guessing the head count',
        detail: 'RSVPs, t-shirt and meal totals, and check-in on the day.',
      },
      {
        label: 'A profit and loss for your treasurer',
        detail: 'The statement the board asks for, straight from the ledger.',
      },
      {
        label: 'The numbers leadership keeps asking for',
        detail: 'Dues collected against outstanding, turnout, and t-shirt counts.',
      },
      {
        label: 'Elect your officers properly',
        detail: 'Nominate, accept or decline, then vote family-wide.',
      },
      {
        label: 'The paperwork, and the structure to match',
        detail: 'Bylaws and minutes, plus regions and chapters with their own leadership.',
      },
      {
        label: 'Every photograph, findable',
        detail: 'Collections per event, with tagging.',
      },
      {
        label: 'A face against every name',
        detail: 'Profile pictures, on the directory, the tree and everywhere a member is listed.',
      },
    ],
    available: false,
    featured: true,
  },
  {
    name: 'Premium',
    tagline: 'In every relative’s pocket, and out in the world.',
    price: PREMIUM_PRICE,
    inheritsFrom: 'Plus',
    icon: Crown,
    adds: [
      {
        label: 'Stop chasing relatives for their dues',
        detail: 'Reminders go out as each installment falls due, and stop the moment it is paid.',
      },
      {
        label: 'News that arrives, instead of waiting to be found',
        detail: 'Notifications on the phone and in the browser for events, announcements and messages.',
      },
      {
        label: 'The family in everybody’s pocket',
        detail: 'Apps for iPhone and Android, signed in to the same family account.',
      },
      {
        label: 'Email the whole family without building a list',
        detail: 'Distributions that draw straight from your membership, so nobody is missed and nobody is on it twice.',
      },
      {
        label: 'Your family’s own website, keeping itself current',
        detail: 'It builds itself from your next gathering, your newest photographs and your latest announcement. Every other family site is abandoned by March because somebody has to update it. This one nobody has to.',
      },
      {
        label: 'A proper address for it, ready to go',
        detail: 'No hosting bill, no plugins, and no relative who "knows computers" maintaining it.',
      },
    ],
    available: false,
    featured: false,
  },
]

const FAQ = [
  {
    question: `Is ${APP_NAME} really free?`,
    answer:
      'Yes, and not as a trial. Unlimited family members, the family tree and lineage, the member directory, family chat, announcements, event planning and a dues ledger for cash contributions cost nothing, with no card required and no expiry date.',
  },
  {
    question: 'Is there a limit on how many family members we can add?',
    answer:
      'No, on any tier including Free. The product is built for a family with a hundred or more adults in it — that is the ordinary case rather than the exception — and there is never a per-member charge. A price that grows with your family is a price that keeps relatives out, which defeats the point.',
  },
  {
    question: 'What is the difference between Free and Plus?',
    answer:
      'Free gets your whole family in one place, with per-feature permissions so nobody has more authority than their job needs. Plus is for running it as an organization: taking card, PayPal, Apple Pay, Google Pay and Cash App payments instead of cash only, collecting RSVPs and head counts with t-shirt and meal totals, day-of check-in, officer elections, photo collections with tagging, profile pictures, documents, regions and chapters, a profit and loss statement and leadership reports.',
  },
  {
    question: 'Can we only take cash payments on the free plan?',
    answer:
      'Yes. Free includes dues plans and a contribution ledger, and you record cash payments into it. Accepting card, debit, PayPal, Apple Pay, Google Pay and Cash App payments — with funds and automatic routing behind them — is part of Plus.',
  },
  {
    question: 'Will the free features we use today start costing money?',
    answer:
      'No. What is listed under Free on this page stays free. Paid tiers are for capability added on top, not for taking away what your family already relies on.',
  },
  {
    question: 'What will Plus and Premium cost?',
    // Trimmed to the answer. The previous version explained WHY there is no figure — that
    // we would rather show nothing than a number families might budget against — which is
    // sound reasoning and none of the reader's business. They asked a price question; the
    // honest answer is that there is not one yet and how to find out when there is.
    answer:
      'Neither has been announced yet. Create a free account and you will hear first.',
  },
  {
    question: 'Do you sell our family’s data?',
    answer:
      'No. There is no advertising in the product and family data is never shared or sold, on any tier. One family cannot see another’s data at all — that separation is enforced by the database on every query rather than by a setting.',
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
            lede="Get every relative in, keep the family tree and talk to each other — free, forever. Pay only when you start running it like an organization."
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
                    <p className="mt-1 min-h-10 text-sm text-muted-foreground">{plan.tagline}</p>

                    {/* NOTHING RENDERS HERE FOR AN UNPRICED TIER — no figure, and no
                        "price to be announced" standing in for one. The card already says
                        Coming soon beside its name and Not yet available on its button, so
                        a third line saying the same thing was the over-explaining this site
                        was asked to stop.

                        The rule the absence protects is unchanged: no placeholder FIGURE.
                        A number here is a commercial representation people budget against
                        and crawlers cache, and the cached result outlives the edit that was
                        going to fix it. Set `PRICING_IS_ANNOUNCED` and the price constants
                        and the real figure appears in this slot. */}
                    <div className="mt-6 min-h-14">
                    {priced && plan.price && (
                      <p className="flex items-baseline gap-2">
                        <span className="text-5xl font-semibold text-brand-ink">
                          {plan.price.amount}
                        </span>
                        <span className="text-muted-foreground">{plan.price.period}</span>
                      </p>
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

                    {/* ── THE INHERITED TIER IS THE FIRST LIST ITEM ──────────────
                        It used to be a sentence above the list reading "Everything in
                        Plus, plus:", which says "plus" twice and reads as a stutter —
                        made worse by one of the tiers being NAMED Plus. As a checked
                        row at the top of the list it needs no connecting words at all:
                        the list is what you get, and the first thing you get is
                        everything below. It also stops the two paid cards drifting out
                        of step with Free the way a copied list would. */}
                    <div className="mt-7 flex-1 border-t pt-6">
                      <ul className="space-y-3.5 text-sm">
                        {plan.inheritsFrom && (
                          <li className="flex gap-3 border-b pb-3.5">
                            <Check
                              className="mt-0.5 h-4 w-4 shrink-0 text-brand-affirm"
                              aria-hidden="true"
                            />
                            <span className="font-semibold">
                              Everything in {plan.inheritsFrom}
                            </span>
                          </li>
                        )}

                        {plan.adds.map(item => (
                          <li key={item.label} className="flex gap-3">
                            <plan.icon
                              className={cn(
                                'mt-0.5 h-4 w-4 shrink-0',
                                plan.available ? 'text-brand-affirm' : 'text-brand-accent',
                              )}
                              aria-hidden="true"
                            />
                            <span className="leading-relaxed">
                              {/* The benefit is the scannable line and carries the
                                  weight; the mechanism sits under it in muted text for
                                  whoever slowed down. A single run of body text makes
                                  the reader find the point themselves. */}
                              <span className="block font-medium text-foreground">
                                {item.label}
                              </span>
                              {item.detail && (
                                <span className="mt-0.5 block text-muted-foreground">
                                  {item.detail}
                                </span>
                              )}
                            </span>
                          </li>
                        ))}

                        {plan.adds.length === 0 && (
                          // Renders instead of an empty list, so the card reads as "not
                          // specified yet" — which is true — rather than inventing
                          // capabilities to pad it out to match its neighbours.
                          <li className="text-muted-foreground">
                            What this tier adds is still being decided.
                          </li>
                        )}
                      </ul>
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
                per-member price guarantees half the family stays out. So getting everyone
                in is free and always will be — the tree, the directory, the chat, the
                announcements and your first reunion. We charge when a family starts
                needing the machinery of an organization: taking card payments, tallying a
                head count, electing officers, answering to a board.
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
