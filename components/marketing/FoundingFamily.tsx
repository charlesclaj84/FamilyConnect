import { Reveal } from '@/components/marketing/Reveal'
import { APP_NAME } from '@/lib/brand'

/**
 * The founders' own family, as three figures — restored from `/about`, where it ran until
 * `9a9e437`, and moved to the landing page with a lead-in above it.
 *
 * ── THE LABEL IS DOING REAL WORK HERE ────────────────────────────────────────
 * Carried over verbatim from the original, because it is the whole reason this section is
 * safe to publish. These numbers describe the founders' own family, NOT the customer base,
 * and a bare "400+ members" on a marketing page reads as a platform total to every visitor.
 * The lede says whose family it is, the heading above the figures says it again, and the
 * caption below says it a third time. A figure that invites the wrong reading is a false
 * claim whether or not the number is true.
 *
 * **Do not restyle this into an unlabelled stat strip.** That is the one change that would
 * turn an honest section into a dishonest one without altering a single digit.
 *
 * ── WHY THE LEAD-IN IS PHRASED AS A DECLINE RATHER THAN A BOAST ──────────────
 * The brief was the familiar pivot: *we could tell you how many families trust us, but we
 * would rather show you how it works for yours.* The pivot is here and the second half is
 * literal — the three screenshots immediately above are the showing.
 *
 * What is deliberately absent is the first half's number. A sentence that declines to print
 * a customer count still ASSERTS one — "we could tell you about the thousands of families"
 * is a claim about thousands of families, and a deniable one, which is worse than printing
 * it plainly. Nothing in this repo can substantiate a platform total: `lib/testimonials.ts`
 * holds the quotes the owner has actually collected and its rules exist because fabricated
 * testimonials are separately regulated. So the copy makes the same rhetorical move against
 * the IDEA of a counter rather than against a figure we would be inventing.
 *
 * If the owner can stand behind a specific number, it belongs in the lede as a plain
 * statement of fact — not smuggled in through a sentence pretending not to say it.
 *
 * ── PLACEMENT AND GROUND ─────────────────────────────────────────────────────
 * `bg-brand-hero`, the same ground it had on `/about`, sitting between the product band and
 * the roadmap. That keeps the landing page's light/dark alternation intact — hero(dark) →
 * showcase(muted) → this(dark) → roadmap(soft) → quotes → CtaBand(dark).
 *
 * No atmospheric float pools, unlike `PageHero` and `CtaBand`. This is the third dark band
 * on the page and the two that bookend it already carry them; a quieter middle is what
 * makes them read as bookends rather than as three of the same thing.
 */
export function FoundingFamily() {
  return (
    <section
      aria-labelledby="founding-family-heading"
      className="bg-brand-hero px-4 py-14 sm:px-6 sm:py-16"
    >
      <div className="mx-auto max-w-3xl text-center">
        <Reveal>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-brand-legacy">
            Instead of a counter
          </p>
          {/* Explicit colour: the base layer paints h1/h2 with --brand-ink, which is
              burgundy in light mode and invisible on this ground. */}
          <h2
            id="founding-family-heading"
            className="mt-3 text-3xl text-brand-on-primary sm:text-4xl"
          >
            We would rather show you how it works
          </h2>
          <p className="mx-auto mt-5 max-w-2xl text-lg leading-relaxed text-brand-on-primary/80">
            Plenty of products open with a number — families served, members onboarded, a
            figure ticking up in the corner. It is the easiest thing to print on a marketing
            page and the least useful thing on it to read, because none of it tells you
            whether the product will hold <em>your</em> family. Everything above is what{' '}
            {APP_NAME} actually does. Below is the only count that shaped it.
          </p>
        </Reveal>
      </div>

      <div className="mx-auto mt-12 max-w-4xl text-center">
        <Reveal delay={160}>
          {/* The gold diamond on a hairline rule — the same divider the hero uses between
              the lockup and the message, reused here to separate the argument from the
              figures. Decorative, so it is hidden from assistive tech. */}
          <div
            aria-hidden="true"
            className="mx-auto flex w-full max-w-sm items-center gap-3"
          >
            <span className="h-px flex-1 bg-brand-legacy/30" />
            <span className="size-1.5 rotate-45 bg-brand-legacy/80" />
            <span className="h-px flex-1 bg-brand-legacy/30" />
          </div>

          <h3 className="mt-8 text-xs font-semibold uppercase tracking-[0.18em] text-brand-legacy">
            The family we built it for
          </h3>

          <dl className="mt-6 grid gap-8 sm:grid-cols-3">
            {[
              { figure: '6', label: 'living generations' },
              { figure: '400+', label: 'family members' },
              { figure: '1', label: 'place it all lives now' },
            ].map(stat => (
              <div key={stat.label}>
                {/* The visible caption under each figure IS the term, so the real `dt` is
                    hidden rather than duplicated — otherwise a screen reader reads every
                    label twice. */}
                <dt className="sr-only">{stat.label}</dt>
                <dd>
                  <span className="block font-heading text-5xl font-semibold text-brand-on-primary">
                    {stat.figure}
                  </span>
                  <span className="mt-1 block text-sm text-brand-on-primary/70">
                    {stat.label}
                  </span>
                </dd>
              </div>
            ))}
          </dl>

          <p className="mx-auto mt-8 max-w-xl text-sm text-brand-on-primary/70">
            Our own family — not a customer count. {APP_NAME} was built to hold it, and then
            opened up to other families who had the same problem.
          </p>
        </Reveal>
      </div>
    </section>
  )
}
