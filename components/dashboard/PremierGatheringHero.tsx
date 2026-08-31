import Link from 'next/link'
import { CalendarDays, MapPin } from 'lucide-react'
import { HeroCurveCrest, HeroCurveFoot, TreeWatermark } from '@/components/dashboard/curves'
import { formatDateRange } from '@/lib/date-utils'
import type { PremierGathering } from '@/app/actions/gatherings'
import type { T } from '@/lib/i18n/t'

/**
 * The Golden Master's EVENT half of the welcome hero, finally on screen — as a second
 * Heritage band directly under the greeting, announcing the family's premier gathering.
 *
 * The kit (`design/dashboard/v1_0/03_VECTOR_ASSETS/components/Welcome_EventHero.svg`) draws one
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
 * 3. GOLD APPEARS ONCE, AS A SURFACE. The View details pill is
 *    `bg-brand-legacy text-brand-on-legacy`, which is the kit's gold pill honoured through
 *    the brand's signature measured pairing (6.14) rather than the mock's white on gold
 *    (1.65, forbidden).
 *
 *    IT APPEARED TWICE UNTIL 2026-08-22, the second being the kit's gold hairline stroked
 *    along the crest. That is WITHDRAWN by decision, not dropped by accident: on a real band
 *    it read as a stray curved line drawn around the hero rather than as an edge treatment,
 *    which is the one thing a 1.9px decoration must not do. The kit's geometry was honoured
 *    exactly and the result was still wrong, so this is a judgement about the composition
 *    rather than a tuning problem — do not re-add it from `Welcome_EventHero.svg` on the
 *    grounds that the kit draws it.
 *
 * 4. THE WATERMARK KEEPS THE REPO'S TREATMENT, NOT THE KIT'S. The kit places it 135x125 at
 *    34% opacity inside the band. `tree-watermark-path.ts` records that the path is a
 *    bitmap auto-trace whose edges are a one-unit staircase, invisible only when large and
 *    faint, and says "Do not promote it." At the kit's own size and opacity the staircase is
 *    closer to visible, so this uses `WelcomeHero`'s setting: a large bleed at ~7%.
 *
 * 5. THE BAND HAS BOTH OF THE KIT'S EDGES, WHICH IS A REVERSAL — see below.
 *
 * ── THE TWO CURVES, AND WHY THIS BAND STOPPED BORROWING THE GREETING'S ────────────
 * THIS SECTION ARGUED THE OPPOSITE UNTIL 2026-08-21, and it is kept because the half of it
 * that was right is still load-bearing. It said the swoop belonged at the FOOT and that both
 * bands should use the SAME curve in the SAME direction, "so they read as a stacked pair
 * speaking one curve language rather than as two competing waves". The premise was that the
 * kit draws ONE curve. It draws two:
 *
 *     eventHero = M0 278 C75 216 174 228 297 267 C420 307 561 320 790 231   <- top swoop
 *                 L790 505
 *                 C665 468 528 456 390 482 C249 509 105 512 0 471 Z          <- bottom edge
 *
 * `HeroCurve` carries that whole `d` and windows `0 200 790 130`, so the bottom edge — y
 * 456–512 — was in the bundle and on no screen. `08_QA/VISUAL_ACCEPTANCE.md` lists "Burgundy
 * hero has both top and bottom asymmetrical curves" as a must-match item, and
 * `08_QA/NO_OVERSIMPLIFICATION.md` says an asset the kit supplies must be consumed.
 *
 * So the band draws BOTH now, each where the kit puts it: `HeroCurveCrest` at the head and
 * `HeroCurveFoot` at the foot. Three things follow:
 *
 *   * **The two bands no longer share a silhouette**, which was the visible cost of the old
 *     arrangement rather than a fidelity nicety. `WelcomeHero` keeps `HeroCurve` at its foot;
 *     this one has a crest and a different foot. A member with a premier gathering was
 *     previously shown two Heritage bands cut identically — so the one thing the family has
 *     said matters more than the rest of the screen read as a second page header.
 *   * **"Two competing waves" does not arise**, because the crest and `WelcomeHero`'s foot are
 *     the SAME edge in the SAME direction — the old rule, kept. What meets across the page's
 *     `space-y-6` gap is one curve profile twice, not a mirror pair.
 *   * **The hairline moved WITH the crest, not away from it** — and was then withdrawn
 *     altogether on 2026-08-22. See point 3 above; the reasoning about which EDGE it belonged
 *     to is kept because it is the argument for where the crest goes, which is unchanged.
 */
export function PremierGatheringHero({ gathering, t }: {
  gathering: PremierGathering
  /**
   * The reader's language, bound. Threaded from the page rather than resolved here: a
   * Server Component cannot read `LocaleProvider` and has no `user` of its own. See
   * `lib/i18n/server.ts`.
   */
  t: T
}) {
  const dates = formatDateRange(gathering.startsOn, gathering.endsOn)
  const { total, approved } = gathering.taskCounts

  return (
    <section className="gn-hero-gradient relative isolate overflow-hidden rounded-3xl bg-brand-hero text-brand-on-hero">
      {/* Behind everything, bleeding off the right edge the way the kit's does, and at the
          opacity `tree-watermark-path.ts` requires rather than the kit's 34%. */}
      <TreeWatermark className="pointer-events-none absolute -right-8 -top-6 h-[125%] w-auto opacity-[0.07]" />

      {/* `pt-28` and `pb-20` are clearance for the two curves, not padding taste — the crest
          cuts `h-24` into the top of the band and the foot `h-16` into the bottom. Shorten
          either without shortening its curve and the eyebrow sits in the swoop or the pill
          sits in the dip.

          THE CREST IS `h-24` AND THE FOOT IS `h-16`, WHICH IS NOT AN INCONSISTENCY. The crest
          is the seam the photo crop is clipped by, and `EventPhotoPlaceholder` sizes itself as
          303/130 of whatever the crest is — so the crest's height is what decides how much
          room the crop has above the swoop. At `h-16` the crop came out 149px tall and could
          not reach the top of the greeting; at `h-24` it is 224px, which is the Golden Master's
          proportion (its swoop window is about a quarter of the hero's height). Change this and
          `WelcomeHero`'s `-bottom-24 h-56` has to change with it — the two are one ratio
          written in two places, and there is no third. */}
      <div className="relative flex flex-wrap items-end justify-between gap-x-8 gap-y-6 px-6 pb-20 pt-28 sm:px-10">
        <div className="min-w-0">
          {/* The eyebrow. Uppercase and letterspaced because that is what it has instead of
              the kit's gold — see (2) above. */}
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-brand-on-hero/80">
            {t('dash.premier.label')}
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
                {t(total === 1 ? 'dash.tasksApprovedOne' : 'dash.tasksApprovedMany', {
                  approved: String(approved), total: String(total),
                })}
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
          {t('dash.premier.view')}
        </Link>
      </div>

      {/* THE CREST. Its gold hairline was rendered here until 2026-08-22 and is WITHDRAWN —
          see the header. Do not re-add it from the kit: its absence is a decision, not an
          omission. */}
      <HeroCurveCrest className="pointer-events-none absolute inset-x-0 top-0 h-24 w-full text-background" />

      {/* THE KIT'S OWN BOTTOM EDGE, which shipped cropped out of every render until
          2026-08-21 — see the header.

          All three curves are `pointer-events-none`: they are painted after the content row,
          so without it the invisible corners of these full-width boxes would sit over the
          band and swallow a click aimed at the pill. Each is filled `text-background`, so
          what they paint is literally the page ground cutting into the band — which is why
          they are correct in dark mode with no token of their own. */}
      <HeroCurveFoot className="pointer-events-none absolute inset-x-0 bottom-0 h-16 w-full text-background" />
    </section>
  )
}
