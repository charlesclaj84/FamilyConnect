import Link from 'next/link'
import { buttonVariants } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { ACCENT_CHIP, TILE_META, type ResolvedTile } from '@/components/dashboard/tiles'
import type { T } from '@/lib/i18n/t'

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
 * THE WHOLE PANEL DISAPPEARS WHEN NOTHING SURVIVES — no tiles AND no `children` — rather
 * than rendering an empty bordered box. An empty card is a worse answer than no card.
 *
 * ── `children`, AND WHY THE BALANCE AND THE DRIVES ARE INSIDE THIS CARD ────────────
 * Since 2026-08-19 the dues balance and the open donation drives render HERE, under the tile
 * grid, rather than in the narrow column beside it. They are the two things on this screen
 * that are about the reader's own standing with the family — what they owe, and what the
 * family is currently asking them to give to — which is precisely what "at a glance" is
 * asking. In the narrow column they sat under Quick Actions, competing with a strip of
 * buttons for the same attention.
 *
 * They arrive as `children` rather than as props, because this component's whole contract is
 * that it renders what it is given and decides nothing: typing them as `summary` and
 * `donations` would put two more shapes in here and two more chances to filter something the
 * page already decided. The page composes; this draws.
 *
 * THE TILE GRID IS STILL FIRST. A figure is scanned and a card is read, and a member looking
 * for "how big is my family" should not have to pass their own balance to get to it.
 *
 * THE TILES ARE DELIBERATELY SHORT. The chip sits beside the figure rather than above it —
 * see the note at the grid — so each tile is three bands and not four. If a fifth thing ever
 * needs to go on a tile, it belongs in the label or nowhere: the panel's job is to be scanned.
 *
 * EVERY TILE IS A LINK AND EVERY LINK SETS ITS OWN TEXT COLOUR. `globals.css` carries an
 * unscoped `a { color: var(--brand-accent) }`, so an anchor that says nothing comes out
 * terracotta in light mode and gold in dark. `text-card-foreground` on the tile is what
 * keeps it reading as a card rather than a link; the button at the foot of each tile
 * gets its own `text-brand-ink` from `buttonVariants`, which is the same trap answered
 * the same way.
 */
export function AtAGlance({
  tiles, children, t,
}: {
  tiles: ResolvedTile[]
  /**
   * The reader's language, bound. Threaded from the page rather than resolved here: a
   * Server Component cannot read `LocaleProvider` and has no `user` of its own. See
   * `lib/i18n/server.ts`.
   */
  t: T
  /**
   * Rendered under the tile grid, inside the same card — the dues balance and the open
   * donation drives. Both are already gated and already fetched (or not) by the page.
   *
   * IT IS TESTED FOR PRESENCE, NOT FOR CONTENT, and the difference is worth knowing. Passing
   * JSX makes `children` truthy whether or not what is inside it renders anything, so a caller
   * that hands this the balance always gets the card. That is the right outcome rather than a
   * loophole — `DuesBalanceKpi` renders for every member, so the panel genuinely is never
   * empty on the Dashboard — and the `tiles.length === 0 && !children` guard is what still
   * answers a caller who passes neither.
   */
  children?: React.ReactNode
}) {
  if (tiles.length === 0 && !children) return null

  return (
    <section className="rounded-3xl border bg-card p-5 shadow-[var(--shadow-card)]">
      <h2 className="mb-4 text-lg">{t('dash.atAGlance')}</h2>
      {/* `auto-fit` rather than a fixed column count, because the number of tiles is not
          known until the caller's grants are resolved — it is anywhere from one to four
          today (the fourth is the kit's own calendar tile, added with Gatherings on
          2026-08-19) and grows as Photos ship. A fixed `sm:grid-cols-2` left a
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
              className="group flex flex-col gap-2.5 rounded-2xl border bg-background p-3.5 text-card-foreground transition-shadow hover:shadow-[var(--shadow-card)]"
            >
              {/* ── SLIMMER SINCE 2026-08-20: THE CHIP AND THE FIGURE SHARE A ROW ──────
                  The tile was four stacked bands — chip, figure, label, button — which made
                  it about 40% taller than it needed to be and pushed everything under the
                  panel below the fold on a laptop. The chip and the figure are now one row,
                  which removes a whole band without removing anything from the tile.

                  IT ALSO READS BETTER, which is the reason to prefer this to shrinking the
                  type. A glyph on its own line is decoration the eye passes over; beside the
                  number it labels the number, so the row says "12 members" as one gesture
                  instead of three. `justify-between` pushes them apart so the figure lands on
                  the same left edge as the caption under it and the chip anchors the corner.

                  The chip is 2.5rem rather than 2.75, and the icon 1rem rather than 1.25 — as
                  small as it goes while still reading as a filled accent circle rather than a
                  dot. Padding and gap came down one step each. `text-2xl` on the figure is
                  UNCHANGED and deliberately so: it is the thing the tile exists to show, and
                  a slimmer card that made its one number harder to read would have traded the
                  wrong way. */}
              <span className="flex items-center justify-between gap-2">
                {/* `tabular-nums` so a count that ticks up does not shift the caption
                    under it, and `text-2xl` rather than an h-tag: this is a figure, not a
                    heading, and the panel's h2 above already names the region. */}
                <span className="text-2xl font-semibold leading-none tabular-nums">{value}</span>
                <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full ${ACCENT_CHIP[meta.accent]}`}>
                  <Icon className="h-4 w-4" />
                </span>
              </span>
              <span className="text-sm text-muted-foreground">{meta.label}</span>
              {/* THE WAY THROUGH IS A BUTTON, NOT A LINE OF TEXT — the same outline
                  button DuesBalanceKpi ends with ("View Account"), so the four cards a
                  member sees on this screen offer their one action the same way. It read
                  as a caption before: small accent text under two other lines of small
                  text, underlining only on hover, which is a discovery cost paid on the
                  one control the tile exists to offer.

                  A <span>, NOT a nested <Link>. The whole tile is already an anchor and
                  an <a> inside an <a> is invalid HTML that browsers silently unnest — so
                  this is a button-SHAPED element inside the one real link, which is also
                  why the hover state hangs off `group-hover` rather than its own
                  `hover:`: the target is the tile, and the button has to light up when
                  the pointer is anywhere on it.

                  `mt-auto` pins it to the bottom edge. Grid items stretch to the tallest
                  in the row, and a "Pending Approval" label wraps to two lines at narrow
                  widths where "Dues Collected" does not — without this the three buttons
                  sit at three different heights. */}
              <span
                className={cn(
                  buttonVariants({ size: 'sm', variant: 'secondary' }),
                  'mt-auto w-full justify-center group-hover:bg-brand-soft/60',
                )}
              >
                {meta.linkLabel}
              </span>
            </Link>
          )
        })}
      </div>

      {/* `mt-4` only when there is a grid above to be separated from — a caller with no tiles
          at all gets the balance flush under the heading rather than with a gap where a row of
          tiles is not.

          ── SIDE BY SIDE, NOT STACKED, SINCE 2026-08-22 ────────────────────────────────
          The balance and the drives sat one above the other in a `space-y-4`, which on a laptop
          pushed everything below the panel off the fold for the sake of two cards that are each
          about half the width they were given. They are the same KIND of thing — what the
          reader owes, and what the family is asking them to give to — so they read as a pair,
          the way Family Members and Upcoming Gatherings do in the tile grid above.

          THE SAME `auto-fit` AS THE TILES, AND FOR THE SAME REASON: the drives card renders
          NOTHING when no drive is open, which is most families most of the time, and a fixed
          `sm:grid-cols-2` would then leave the balance at half width beside a hole. `auto-fit`
          lets the one surviving child fill the row. `18rem` is the floor at which the balance's
          plan lines and a drive's goal bar both still read; below it they stack.

          `items-start` is deliberate. Grid children stretch by default, which would pull a
          two-line drives card down to the height of a balance listing four schedules and leave
          it with a lake of white under its button. */}
      {children && (
        <div className={cn(
          'grid grid-cols-[repeat(auto-fit,minmax(18rem,1fr))] items-start gap-4',
          tiles.length > 0 && 'mt-4',
        )}>{children}</div>
      )}
    </section>
  )
}
