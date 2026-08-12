import Link from 'next/link'
import { ACCENT_CHIP, TILE_META, type ResolvedTile } from '@/components/dashboard/tiles'

/**
 * The Golden Master's "At a Glance" panel — a card of inset metric tiles.
 *
 * IT RENDERS WHAT IT IS GIVEN AND DECIDES NOTHING. Every tile in `tiles` has already
 * passed two independent narrowings on the server: is the feature live, and may this
 * caller view it. More to the point, a tile the caller may not see was never FETCHED —
 * props are serialized into the RSC payload whether a component renders them or not, so
 * a component that filtered its own props would be publishing the numbers it hid
 * (AGENTS.md §5). If you are tempted to add a `canSee` prop here, the check belongs in
 * the page, above its `Promise.all`.
 *
 * THE WHOLE PANEL DISAPPEARS WHEN NOTHING SURVIVES, rather than rendering an empty
 * bordered box. A member of a family that restricts its directory and its ledgers still
 * has My Balance, so in practice this is never empty today — but "in practice" is not a
 * guarantee, and an empty card is a worse answer than no card.
 *
 * EVERY TILE IS A LINK AND EVERY LINK SETS ITS OWN TEXT COLOUR. `globals.css` carries an
 * unscoped `a { color: var(--brand-accent) }`, so an anchor that says nothing comes out
 * terracotta in light mode and gold in dark. `text-card-foreground` on the tile and an
 * explicit colour on the caption are what keep it reading as a card rather than a link.
 */
export function AtAGlance({ tiles }: { tiles: ResolvedTile[] }) {
  if (tiles.length === 0) return null

  return (
    <section className="rounded-3xl border bg-card p-5 shadow-[var(--shadow-card)]">
      <h2 className="mb-4 text-lg">At a Glance</h2>
      {/* `auto-fit` rather than a fixed column count, because the number of tiles is not
          known until the caller's grants are resolved — it is anywhere from one to three
          today, and grows as Events and Photos ship. A fixed `sm:grid-cols-2` left a
          single-tile family with one half-width tile beside a hole; auto-fit lets one
          tile fill the row and three sit across it, with no breakpoint per case.
          `11rem` is the floor at which a figure and its two captions still read. */}
      <div className="grid grid-cols-[repeat(auto-fit,minmax(11rem,1fr))] gap-3">
        {tiles.map(({ id, value }) => {
          const meta = TILE_META[id]
          const Icon = meta.icon
          return (
            <Link
              key={id}
              href={meta.href}
              className="group flex flex-col gap-3 rounded-2xl border bg-background p-4 text-card-foreground transition-shadow hover:shadow-[var(--shadow-card)]"
            >
              <span className={`flex h-11 w-11 items-center justify-center rounded-full ${ACCENT_CHIP[meta.accent]}`}>
                <Icon className="h-5 w-5" />
              </span>
              {/* `tabular-nums` so a count that ticks up does not shift the caption
                  under it, and `text-2xl` rather than an h-tag: this is a figure, not a
                  heading, and the panel's h2 above already names the region. */}
              <span className="text-2xl font-semibold leading-none tabular-nums">{value}</span>
              <span className="text-sm text-muted-foreground">{meta.label}</span>
              <span className="text-xs font-medium text-brand-accent group-hover:underline">
                {meta.linkLabel}
              </span>
            </Link>
          )
        })}
      </div>
    </section>
  )
}
