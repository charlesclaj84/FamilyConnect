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
 * ── TWO DIFFERENT NUMBERS SHARE THIS BAND. KEEP THEM APART ───────────────────
 * The lede states a customer total; the figures below state the founders' household. They
 * are unrelated quantities sitting eight lines apart on one Heritage ground, which is the
 * single thing most likely to go wrong here — a later edit that tightens the copy, drops
 * the caption, or promotes "400+" into the lede turns the founders' family into a platform
 * metric, or the platform metric into a family. Every one of the three restatements above
 * exists to hold that line. None of them is padding.
 *
 * ── THE CUSTOMER FIGURE IS THE OWNER'S CLAIM, ON THE OWNER'S AUTHORITY ───────
 * *"Thousands of families run on GENORRA"* was asserted by the business owner on
 * 2026-08-12 and is published here at their direction. Nothing in this repository
 * substantiates it and nothing here could — it is a fact about the business, not about the
 * code, and the owner is the only person positioned to state it.
 *
 * It is written as a PLAIN CLAIM and not as the more usual "we could tell you about the
 * thousands of families who trust us…". That construction asserts the same number while
 * appearing not to, which is the worse of the two: deniable, and unfalsifiable by the
 * reader. If a figure is going to be published it should be published, so that it can be
 * held to and corrected.
 *
 * Two things follow for anyone editing it. **Do not inflate or round it up** to fit a
 * rhythm — the number is the owner's to change and nobody else's. And **do not repeat it
 * elsewhere on the site** without checking it is still current; one place to correct is the
 * reason `lib/brand.ts` and `lib/testimonials.ts` are shaped the way they are, and a
 * customer count restated on four pages is four things to remember on the day it moves.
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
            About that number
          </p>
          {/* Explicit colour: the base layer paints h1/h2 with --brand-ink, which is
              burgundy in light mode and invisible on this ground. */}
          <h2
            id="founding-family-heading"
            className="mt-3 text-3xl text-brand-on-primary sm:text-4xl"
          >
            We would rather show you how it works
          </h2>
          {/* The customer figure is the owner's claim — see the note at the top of this
              file before changing it. `<em>your</em>` is the hinge of the whole paragraph:
              it is what turns a boast into an offer, so keep the emphasis. */}
          <p className="mx-auto mt-5 max-w-2xl text-lg leading-relaxed text-brand-on-primary/80">
            Thousands of families run on {APP_NAME}. We could open with that figure and
            leave it there, but it tells you nothing about whether the product will hold{' '}
            <em>your</em> family. Everything above is what it actually does. Below is the
            only count that shaped it.
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

          {/* THE VISIBLE CAPTION IS THE `dt`. It reads as a caption under the figure and it
              is also, semantically, the term that figure defines — so it is one element,
              not two.

              The original had an `sr-only` <dt> above a <dd> that then rendered the label
              AGAIN as a plain <span>. `sr-only` hides from the eye and not from the
              accessibility tree, so every figure was announced as "living generations, 6,
              living generations". One element cannot drift from itself, and cannot be read
              twice.

              `order` rather than `flex-col-reverse`: a <dl> requires each <dt> to precede
              its <dd> in the DOM, and the design wants the figure on top — so the pair is
              swapped visually and left correct structurally. */}
          <dl className="mt-6 grid gap-8 sm:grid-cols-3">
            {[
              { figure: '6', label: 'living generations' },
              { figure: '400+', label: 'family members' },
              { figure: '1', label: 'place it all lives now' },
            ].map(stat => (
              <div key={stat.label} className="flex flex-col">
                <dt className="order-2 mt-1 text-sm text-brand-on-primary/70">
                  {stat.label}
                </dt>
                <dd className="order-1 font-heading text-5xl font-semibold text-brand-on-primary">
                  {stat.figure}
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
