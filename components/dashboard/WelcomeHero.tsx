import { MapPin } from 'lucide-react'
import { Avatar } from '@/components/ui/Avatar'
import { HeroCurve, TreeWatermark } from '@/components/dashboard/curves'

interface Props {
  firstName: string
  initials: string
  avatarUrl?: string | null
  /** Board positions this member holds, already formatted. Empty for most people. */
  roles: string[]
  chapterName?: string | null
}

/**
 * The Heritage band that opens the Dashboard — the Golden Master's welcome panel.
 *
 * WHAT IS HERE AND WHAT IS NOT. The kit composes this band with an upcoming event
 * (name, dates, location, "View Details") and a photograph of a family clipped by
 * `eventPhotoMask`. Neither ships:
 *
 *   * **The event** is real data with a working action behind it, blocked only by
 *     `/events` being `status: 'future'` in `lib/features.ts`. When that flips, the
 *     event belongs in this band, under the greeting, exactly as the kit draws it.
 *   * **The photograph** has no home in the schema at all — `families` has no image
 *     column and there is no bucket for one. The kit's own `family_hero_source.jpg` is
 *     stock photography of an invented family with the design's cream field and burgundy
 *     band already burnt into the pixels, so it is not a placeholder either.
 *
 * The band therefore carries the traced tree watermark where the photograph would have
 * gone. That is the kit's own artwork doing the kit's own job — it is what fills the
 * right of the band in the Golden Master — and it means the hero reads as finished
 * rather than as a hole waiting for a feature.
 *
 * THE CURVE IS THE PAGE, NOT A COLOUR. `HeroCurve` fills with `currentColor` and this
 * sets `text-background`, so the swoop is literally the page ground cutting up into the
 * band. That is why the redesign needed no "curve colour" token and why it is correct in
 * dark mode for free.
 *
 * `pb-20` is not padding taste — it is clearance for the curve, which is `h-16`
 * absolutely positioned at the bottom. Reduce one and the greeting sits in the swoop.
 */
export function WelcomeHero({ firstName, initials, avatarUrl, roles, chapterName }: Props) {
  return (
    <section className="relative isolate overflow-hidden rounded-3xl bg-brand-hero text-brand-on-hero">
      {/* Behind everything, bleeding off the right edge the way the kit's does. Low
          opacity is required, not stylistic — see tree-watermark-path.ts on why this
          artwork must never be shown large and crisp. */}
      <TreeWatermark className="pointer-events-none absolute -right-8 -top-6 h-[125%] w-auto opacity-[0.07]" />

      <div className="relative flex flex-wrap items-center gap-5 px-6 pb-20 pt-8 sm:px-10 sm:pt-10">
        {/* `ring-brand-legacy/40` rather than the Avatar's default foreground ring: on a
            burgundy ground that default is a dark halo on a dark field, i.e. nothing. */}
        <Avatar url={avatarUrl} initials={initials} size="lg" className="ring-2 ring-brand-legacy/40" />
        <div className="min-w-0">
          {/* `text-brand-on-hero` is not optional. The base layer paints every h1/h2
              `--brand-ink`, which is burgundy in light mode — burgundy on burgundy. */}
          <p className="text-sm text-brand-on-hero/80">Welcome back,</p>
          <h1 className="truncate text-3xl leading-tight text-brand-on-hero sm:text-4xl">
            {firstName}!
          </h1>

          {roles.length > 0 && (
            <div className="mt-3 flex flex-wrap gap-2">
              {roles.map(role => (
                <span
                  key={role}
                  className="inline-flex items-center rounded-full bg-brand-legacy px-3 py-1 text-xs font-semibold text-brand-on-legacy"
                >
                  {role}
                </span>
              ))}
            </div>
          )}

          {chapterName && (
            <p className="mt-2 flex items-center gap-1 text-sm text-brand-on-hero/80">
              <MapPin className="h-3.5 w-3.5 shrink-0" />
              {chapterName} Chapter
            </p>
          )}
        </div>
      </div>

      <HeroCurve className="absolute inset-x-0 bottom-0 h-16 w-full text-background" />
    </section>
  )
}
