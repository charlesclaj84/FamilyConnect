import Link from 'next/link'
import { CalendarDays, MapPin } from 'lucide-react'
import { HeroCurve, HeroCurveHairline, TreeWatermark } from '@/components/dashboard/curves'
import { formatDateRange } from '@/lib/date-utils'
import type { PremierGathering } from '@/app/actions/gatherings'

/**
 * The Golden Master's EVENT half of the welcome hero, finally on screen — as a second
 * Heritage band directly under the greeting, announcing the family's premier gathering.
 *
 * The kit (`public/dashboard/03_VECTOR_ASSETS/components/Welcome_EventHero.svg`) draws one
 * 790x515 composition holding TWO things: the greeting on cream at the top-left, and a
 * featured event on a burgundy band at the bottom, with one swoop between them. The repo
 * INVERTED that — `WelcomeHero` makes the whole band burgundy, puts the greeting inside it
 * and reuses the kit's top curve at the FOOT of the band as the page ground cutting upward.
 * That component is shipped and correct as it stands, and this one is deliberately NOT an
 * attempt to restore the kit's composition (which would mean splitting a shipped band and
 * moving the greeting onto cream). It is the second half of the mock, as its own band.
 *
 * ── FIVE THINGS HERE LOOK LIKE MISTAKES AGAINST THE SVG AND ARE NOT ──────────────────
 *
 * 1. NO PHOTOGRAPH. The kit clips a raster through `eventPhotoMask` and fills the right
 *    of the band with it. `gatherings` has no image column, there is no bucket for one and
 *    no schema decision has been made — and the kit's own JPEGs are unusable twice over:
 *    `04_MEDIA/family_hero_source.jpg` is stock photography with the design's cream field
 *    and burgundy band already burnt into the pixels, and TODO.md carries an open action to
 *    delete `04_MEDIA/` over its licensing. `app/(protected)/dashboard/page.tsx` says the
 *    same thing about the family hero. So the traced tree fills that space, which is the
 *    kit's own artwork doing the kit's own job — the same answer `WelcomeHero` gives.
 *
 * 2. NO GOLD TEXT. The kit's eyebrow is #D99714 on burgundy and its title, date and place
 *    are white. Gold as a FOREGROUND is sanctioned only where the ratio has been measured
 *    and recorded in `app/globals.css`, and gold-on-Heritage is not among those pairs — the
 *    file says in terms that `--brand-legacy` is a surface, never a foreground. So the
 *    eyebrow, title, date and place ALL use the measured `text-brand-on-hero` pair (sand on
 *    Heritage, 9.80 light / 16.30 dark) and are separated by WEIGHT, SIZE and
 *    LETTERSPACING instead of by hue. Adding a `--brand-on-hero-accent` role would be the
 *    honest way to have the kit's gold eyebrow, and it is a `globals.css` change with a
 *    measured ratio beside it — not a `text-brand-legacy` typed into a component here.
 *
 * 3. GOLD APPEARS TWICE, IN ITS TWO SANCTIONED FORMS. As a SURFACE — the View details pill
 *    is `bg-brand-legacy text-brand-on-legacy`, which is the kit's gold pill honoured
 *    through the brand's signature measured pairing (6.14) rather than the mock's white on
 *    gold (1.65, forbidden). And as a NON-TEXT STROKE — `HeroCurveHairline`, along the
 *    swoop at the foot.
 *
 * 4. THE WATERMARK KEEPS THE REPO'S TREATMENT, NOT THE KIT'S. The kit places it 135x125 at
 *    34% opacity inside the band. `tree-watermark-path.ts` records that the path is a
 *    bitmap auto-trace whose edges are a one-unit staircase, invisible only when large and
 *    faint, and says "Do not promote it." At the kit's own size and opacity the staircase is
 *    closer to visible, so this uses `WelcomeHero`'s setting: a large bleed at ~7%.
 *
 * 5. THE SWOOP IS AT THE FOOT, AND THE PAGE THEREFORE CARRIES TWO. The kit's
 *    `CLAUDE_START_HERE.md` asks for "ONE visual swoop", and that instruction was written
 *    about its single hero composition — one curve inside one 790x515 box, between the
 *    greeting and the event. Once the event is a SECOND band, either it has an edge of its
 *    own or it is a flat rectangle in a design whose whole language is that edge. Both
 *    bands therefore use the SAME curve in the SAME direction, so they read as a stacked
 *    pair speaking one curve language rather than as two competing waves — which is exactly
 *    what a curve at this band's TOP would have produced, two arcs facing each other across
 *    the page's `space-y-6` gap.
 *
 * ── WHY THE HAIRLINE REGISTERS WITH THE SWOOP ──────────────────────────────────────
 * `HeroCurve` and `HeroCurveHairline` are BOTH in `components/dashboard/curves.tsx`, and that is
 * not filing — they only line up because they share a coordinate space, a viewBox and an aspect
 * handling, all of which `curves.tsx` states beside them. What this file owes them is the third
 * thing: the SAME box. They are given identical `className`s below, and changing one without the
 * other is what would slide the gold line off the edge it is drawn along.
 */
export function PremierGatheringHero({ gathering }: { gathering: PremierGathering }) {
  const dates = formatDateRange(gathering.startsOn, gathering.endsOn)
  const { total, approved } = gathering.taskCounts

  return (
    <section className="relative isolate overflow-hidden rounded-3xl bg-brand-hero text-brand-on-hero">
      {/* Behind everything, bleeding off the right edge the way the kit's does, and at the
          opacity `tree-watermark-path.ts` requires rather than the kit's 34%. */}
      <TreeWatermark className="pointer-events-none absolute -right-8 -top-6 h-[125%] w-auto opacity-[0.07]" />

      {/* `pb-20` is clearance for the `h-16` curve at the foot, exactly as in WelcomeHero:
          reduce one without the other and the pill sits in the swoop. */}
      <div className="relative flex flex-wrap items-end justify-between gap-x-8 gap-y-6 px-6 pb-20 pt-8 sm:px-10 sm:pt-10">
        <div className="min-w-0">
          {/* The eyebrow. Uppercase and letterspaced because that is what it has instead of
              the kit's gold — see (2) above. */}
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-brand-on-hero/80">
            Premier gathering
          </p>

          {/* `text-brand-on-hero` is NOT optional and is not decoration: the base layer
              paints every h1/h2 `--brand-ink`, which is burgundy in light mode — this
              heading would be burgundy on burgundy. An h2 rather than an h3 for a second
              reason: h3–h6 deliberately do not take Cormorant from the base layer, and the
              kit sets this title in the display face. */}
          <h2 className="mt-2 text-2xl leading-tight text-brand-on-hero sm:text-3xl">
            {gathering.title}
          </h2>

          {/* The date and place lines, with the kit's two icons. `/80` on the icon and the
              text together, so the pair reads as one quieter line under the title rather
              than as a bright glyph beside grey text. */}
          <div className="mt-4 space-y-1.5 text-sm text-brand-on-hero/80">
            {dates && (
              <p className="flex items-center gap-2">
                <CalendarDays className="h-4 w-4 shrink-0" aria-hidden="true" />
                {dates}
              </p>
            )}
            {gathering.location && (
              <p className="flex items-center gap-2">
                <MapPin className="h-4 w-4 shrink-0" aria-hidden="true" />
                {gathering.location}
              </p>
            )}
            {/* THE ONE LINE THE KIT DOES NOT DRAW, and it is here because the data is
                already in the prop: `PremierGathering` carries `taskCounts`, so the choice
                is between saying how the preparation is going and dropping a fact the
                payload paid for. It is withheld at `total === 0`, because "0 of 0 tasks
                approved" of a gathering nobody has been asked to help with is noise.

                It is a sentence rather than a bar deliberately. A progress bar on the one
                band that opens the screen reads as a deadline, and a gathering in
                `'planning'` — which is exactly the state this band most often announces —
                has not got one. */}
            {total > 0 && (
              <p className="tabular-nums">
                {approved} of {total} {total === 1 ? 'task' : 'tasks'} approved
              </p>
            )}
          </div>
        </div>

        {/* The kit's gold CTA pill, through the measured pair. NOT `buttonVariants` —
            there is no gold variant and adding one would put a fifth filled button in the
            ramp for a single call site; this is the same `rounded-full bg-brand-legacy
            … text-brand-on-legacy` chip WelcomeHero already renders for a board position,
            one size up. `text-brand-on-legacy` is also what answers the base layer's
            unscoped `a { color: var(--brand-accent) }`, which would otherwise paint this
            anchor terracotta in light mode and gold-on-gold in dark. */}
        <Link
          href={`/gatherings/${gathering.id}`}
          className="inline-flex items-center rounded-full bg-brand-legacy px-5 py-2.5 text-sm font-semibold text-brand-on-legacy transition-opacity hover:opacity-90"
        >
          View details
        </Link>
      </div>

      {/* THE SWOOP, and the gold hairline along it. Both are `pointer-events-none`: they
          are painted after the content row, so without it the invisible corners of these
          two full-width boxes would sit over the band and swallow a click aimed at the
          pill. Identical `className` on the pair is what makes them register — see the
          header on why all three of the box, the viewBox and the aspect handling have to
          match. The curve is filled `text-background`, so the shape is literally the page
          ground cutting up into the band and is correct in dark mode for free. */}
      <HeroCurve className="pointer-events-none absolute inset-x-0 bottom-0 h-16 w-full text-background" />
      <HeroCurveHairline className="pointer-events-none absolute inset-x-0 bottom-0 h-16 w-full text-brand-legacy" />
    </section>
  )
}
