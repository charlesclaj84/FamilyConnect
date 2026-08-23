import type { Metadata } from 'next'
import Link from 'next/link'
import { UserPlus, KeyRound, Users, CalendarCheck, Wallet, Rocket } from 'lucide-react'
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

const PAGE_TITLE = 'How It Works — Set Up Your Family Portal in an Evening'
const PAGE_DESCRIPTION =
  `Create your family, share one code, and your relatives join themselves. See exactly how ${APP_NAME} goes from empty to running a reunion in five steps.`

export const metadata: Metadata = {
  // 39 characters, so 49 once `title.template` appends the product name — inside
  // Google's ~60-character display budget. The first draft read 'How It Works — Set Up
  // Your Family Portal in an Evening' and rendered at 64, which is truncated, and a cut
  // title is worse than a shorter one. Measured against the built HTML, not counted by eye.
  title: 'Set Up Your Family Portal in an Evening',
  description: PAGE_DESCRIPTION,
  alternates: { canonical: '/how-it-works' },
}

/**
 * THE STEPS DESCRIBE THE ACTUAL FLOW, in the actual order, using the actual words the
 * product uses on screen — "family code", "approve", "dues plan". A how-it-works page
 * that paraphrases is a page that stops matching the product at the next release, and the
 * first person to notice is somebody who followed it and got lost.
 */
const STEPS: readonly { icon: LucideIcon; title: string; detail: string; aside?: string }[] = [
  {
    icon: UserPlus,
    title: 'Create your family',
    detail:
      'One person signs up, names the family, and becomes its first administrator. It takes about a minute and costs nothing.',
    aside: 'You are the founder, so you hold every permission from the start.',
  },
  {
    icon: KeyRound,
    title: 'Share one family code',
    detail:
      'Your family gets a short code. Put it in the group text. Relatives sign up with it and land in your approval queue — you are not typing in a hundred people by hand.',
    aside: 'Prefer to invite directly? Email an invitation and they skip straight past the code.',
  },
  {
    icon: Users,
    title: 'Approve who belongs',
    detail:
      'Every applicant waits until an administrator recognises them. Nobody sees a single photograph, address or dollar figure before you say yes.',
    aside: 'Declined by mistake? They can ask you to look again, in writing.',
  },
  {
    icon: CalendarCheck,
    title: 'Put the reunion up',
    detail:
      'Write the checklist once, schedule the gathering from it, and every step becomes somebody’s job with a date against it. What comes back is accepted or sent back with notes.',
  },
  {
    icon: Wallet,
    title: 'Turn on the treasury',
    detail:
      'Set a dues plan members can pay in installments, create the funds the money belongs to, and let the routing rules put each payment where it goes.',
    aside: 'Your treasurer gets a real profit and loss out of the other end.',
  },
]

/**
 * ANSWERED IN THE VISIBLE COPY BELOW, which is what lets these become an `FAQPage` node.
 * Adding a question here that the page does not answer is the mismatch that costs rich
 * results — see the note on `marketingPageGraph`.
 */
const FAQ = [
  {
    question: 'How long does it take to set up a family portal?',
    answer:
      'Creating the family takes about a minute. Most families have relatives signing themselves up the same evening, because they join with a family code instead of being entered by hand.',
  },
  {
    question: 'Do I have to add every family member myself?',
    answer:
      'No. You share one short family code and relatives sign up with it, landing in an approval queue for an administrator to review. You can also email invitations directly, which lets someone skip the code entirely.',
  },
  {
    question: 'Can someone see our family’s information before we approve them?',
    answer:
      'No. An applicant sees nothing about the family until an administrator approves them — no directory, no photographs, no financial figures. Family separation is enforced by the database on every query, not by a setting.',
  },
  {
    question: 'What happens if we decline someone by mistake?',
    answer:
      'The decision is kept rather than deleted, so it can be reversed. An administrator can admit them after all, any member can send them a fresh invitation, and the person themselves can reply once in writing to ask the administrators to look again.',
  },
  {
    question: `Is ${APP_NAME} free to start?`,
    answer:
      'Yes. Creating your family, inviting your relatives and running your first reunion costs nothing, and no card is required to start.',
  },
] as const

export default function HowItWorksPage() {
  return (
    <>
      <MetaViewContent content="howItWorks" />
      <StructuredData
        graph={marketingPageGraph({
          path: '/how-it-works',
          name: PAGE_TITLE,
          description: PAGE_DESCRIPTION,
          faq: FAQ,
        })}
      />

      <PageHero
        eyebrow="How it works"
        title={<>From nothing to a running reunion, in an evening</>}
        lede={
          <>
            No migration project. No data entry weekend. One person starts it, and the
            family fills it in themselves.
          </>
        }
      >
        <Link href={ACCOUNT_ROUTES.register}>
          <Button size="lg" className="w-full bg-brand-legacy px-8 text-base text-brand-on-legacy hover:opacity-90 sm:w-auto">
            Start Step One
          </Button>
        </Link>
      </PageHero>

      {/* ── The steps ─────────────────────────────────────────────────────
          A numbered vertical timeline with a connecting rule. The rule is drawn on the
          list rather than per item so it does not overshoot the last marker — a border
          on each row leaves a stub hanging below the final step. */}
      <section aria-labelledby="steps-heading" className="bg-background px-4 py-16 sm:px-6 sm:py-20">
        <div className="mx-auto max-w-3xl">
          <SectionHeading
            id="steps-heading"
            eyebrow="Five steps"
            title="What you actually do"
            lede="In order. Steps four and five are optional on day one — plenty of families start with the directory alone."
          />

          <ol className="mt-12 space-y-8">
            {STEPS.map((step, i) => (
              <Reveal key={step.title} delay={i * 130}>
                <li className="relative flex gap-5">
                  {/* The connector, hidden on the last item. `after` rather than a
                      separate element so there is nothing to mis-position. */}
                  {i < STEPS.length - 1 && (
                    <span
                      aria-hidden="true"
                      className="absolute left-6 top-14 h-[calc(100%+1rem)] w-px bg-brand-primary/15"
                    />
                  )}
                  <div className="relative z-10 flex size-12 shrink-0 items-center justify-center rounded-2xl border bg-card shadow-[var(--shadow-card)]">
                    <step.icon className="h-5 w-5 text-brand-accent" aria-hidden="true" />
                  </div>
                  <div className="min-w-0 pb-2">
                    <div className="flex items-baseline gap-2">
                      <span className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                        Step {i + 1}
                      </span>
                    </div>
                    <h3 className="mt-1 text-xl">{step.title}</h3>
                    <p className="mt-2 leading-relaxed text-muted-foreground">{step.detail}</p>
                    {step.aside && (
                      <p className="mt-2 rounded-lg border-l-2 border-brand-legacy bg-brand-soft/50 px-3 py-2 text-sm">
                        {step.aside}
                      </p>
                    )}
                  </div>
                </li>
              </Reveal>
            ))}
          </ol>

          <Reveal delay={200}>
            <div className="mt-12 rounded-2xl border bg-card p-6 text-center shadow-[var(--shadow-card)]">
              <div className="mb-3 inline-flex rounded-xl bg-brand-affirm/15 p-2.5">
                <Rocket className="h-6 w-6 text-brand-affirm" aria-hidden="true" />
              </div>
              <h3 className="text-xl">That is the whole setup</h3>
              <p className="mx-auto mt-2 max-w-md text-muted-foreground">
                Everything else — chat, photos, documents, elections, chapters, reports —
                is already switched on inside the same account, waiting for whenever you
                want it.
              </p>
              <div className="mt-4 flex justify-center">
                <MoreLink href="/features">See everything included</MoreLink>
              </div>
            </div>
          </Reveal>
        </div>
      </section>

      {/* ── FAQ ──────────────────────────────────────────────────────────
          Real `<details>` elements. A hand-rolled accordion would need state, keyboard
          handling and `aria-expanded` wiring to match what the browser gives for free —
          and the content stays in the DOM either way, so a crawler and a screen reader
          both read every answer whether it is open or not. */}
      <section aria-labelledby="faq-heading" className="bg-brand-soft/40 px-4 py-16 sm:px-6 sm:py-20">
        <div className="mx-auto max-w-3xl">
          <SectionHeading id="faq-heading" eyebrow="Questions" title="The things families ask first" />
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

      <Testimonials heading="What families tell us afterwards" />

      <CtaBand
        title="Start with step one"
        lede="Create your family, share the code, and see how much of this fills itself in."
        primaryLabel="Create Your Family Free"
      />
    </>
  )
}
