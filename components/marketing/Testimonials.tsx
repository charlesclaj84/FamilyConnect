import { Quote } from 'lucide-react'
import { Reveal } from '@/components/marketing/Reveal'

/**
 * What families say — once families have said it.
 *
 * ── READ THIS BEFORE ADDING ANYTHING TO THE ARRAY ───────────────────────────
 * This section is finished, animated and ready. It renders NOTHING in production
 * while `TESTIMONIALS` is empty, and that is the design rather than an unfinished
 * state. Three reasons, in ascending order of consequence:
 *
 *  1. `lib/structured-data.ts` already commits this codebase to a rule — structured
 *     data must not claim anything the page does not show — and singles out
 *     `aggregateRating` as the field most often invented, because it is the one that
 *     makes a result look rich. The same rule governs the prose: a quote is a claim
 *     about a person, and it is a stronger claim than a rating.
 *  2. Invented testimonials attributed to customers are, in the United States,
 *     regulated advertising rather than copywriting — the FTC's endorsement rules
 *     cover fabricated reviews specifically, and the penalties are per-violation.
 *     A family-software brand whose entire proposition is "trust us with your
 *     family's private records" cannot afford to be caught doing it, and a
 *     screenshot lives forever.
 *  3. They do not work. Anyone evaluating software has read a hundred five-star
 *     cards attributed to "Sarah M., Happy Customer" and discounts them on sight.
 *     Two real quotes with a real family name outperform six invented ones, and
 *     the difference is not close.
 *
 * ── HOW TO SWITCH IT ON ─────────────────────────────────────────────────────
 * Paste real quotes into `TESTIMONIALS`. Two is enough — the grid is built for 2, 3
 * or 6 and reads deliberately rather than sparsely at any of them. Get permission in
 * writing, use the name the person agrees to (a first name and a family is plenty:
 * "Deborah, Allen Family Reunion"), and quote them verbatim. Once there are real
 * ones, add `Review` nodes and an honest `aggregateRating` to
 * `lib/structured-data.ts` — in that order, page first.
 *
 * In development the section renders a PREVIEW instead, so the design is visible and
 * reviewable without any of it reaching a visitor. `process.env.NODE_ENV` is inlined
 * at build time, so the preview branch is dead code eliminated from the production
 * bundle — it cannot ship by accident.
 */

export interface Testimonial {
  /** Verbatim. Do not tidy their grammar; it is what makes it read as a person. */
  quote: string
  /** The name they agreed to be quoted under. */
  name: string
  /** Their role or family, e.g. 'Reunion chair, Allen Family'. */
  attribution: string
}

/**
 * EMPTY ON PURPOSE. See the header. Adding an entry publishes it.
 */
export const TESTIMONIALS: readonly Testimonial[] = []

/** Shape of the preview, so the design can be reviewed before real quotes exist. */
const PREVIEW: readonly Testimonial[] = [
  {
    quote: 'PLACEHOLDER — this is what a real quote will look like in this slot. It runs to about three lines, which is the length that reads as a person talking rather than a slogan.',
    name: 'Not a real person',
    attribution: 'Development preview only — never rendered in production',
  },
  {
    quote: 'PLACEHOLDER — a second card, to show the grid and the stagger. Replace both with quotes from families who have actually used the product, with their permission.',
    name: 'Not a real person',
    attribution: 'Development preview only — never rendered in production',
  },
]

export function Testimonials({
  heading = 'Families do not go back',
  lede,
}: {
  heading?: string
  lede?: string
}) {
  const isPreview = TESTIMONIALS.length === 0
  const items = isPreview ? PREVIEW : TESTIMONIALS

  // Nothing real to show, and not a development build: render nothing at all. An empty
  // "What families say" heading over blank space is worse than the section's absence —
  // it advertises that nobody has said anything.
  if (isPreview && process.env.NODE_ENV === 'production') return null

  return (
    <section aria-labelledby="testimonials-heading" className="bg-background px-4 py-16 sm:px-6 sm:py-20">
      <div className="mx-auto max-w-6xl">
        {isPreview && (
          <p className="mb-6 rounded-xl border border-dashed border-destructive/40 bg-destructive/5 px-4 py-3 text-sm text-destructive">
            <strong>Development preview.</strong> These are not real testimonials and this
            block is stripped from the production build. Add real, permissioned quotes to{' '}
            <code>TESTIMONIALS</code> in <code>components/marketing/Testimonials.tsx</code> to
            publish this section.
          </p>
        )}

        <Reveal>
          <div className="mx-auto max-w-2xl text-center">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-brand-accent">
              In their words
            </p>
            <h2 id="testimonials-heading" className="mt-3 text-3xl sm:text-4xl">
              {heading}
            </h2>
            {lede && <p className="mt-4 text-lg text-muted-foreground">{lede}</p>}
          </div>
        </Reveal>

        <div className="mt-12 grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {items.map((t, i) => (
            <Reveal key={t.quote.slice(0, 40)} delay={i * 160} className="h-full">
              <figure className="relative flex h-full flex-col rounded-2xl border bg-card p-6 shadow-[var(--shadow-card)] transition-shadow duration-300 hover:shadow-[var(--shadow-card-hover)]">
                {/* Gold, as a wash behind a decorative glyph — never as a foreground
                    that carries meaning. Legacy is 2.30 on white and can only ever be
                    a surface or an accent in light mode (see globals.css). */}
                <Quote
                  aria-hidden="true"
                  className="absolute right-5 top-5 h-8 w-8 text-brand-legacy/25"
                />
                <blockquote className="flex-1 text-base leading-relaxed">
                  &ldquo;{t.quote}&rdquo;
                </blockquote>
                <figcaption className="mt-5 border-t pt-4">
                  <span className="block text-sm font-semibold">{t.name}</span>
                  <span className="block text-sm text-muted-foreground">{t.attribution}</span>
                </figcaption>
              </figure>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  )
}
