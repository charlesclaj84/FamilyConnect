import { cn } from '@/lib/utils'

/**
 * The pill that marks a shipped-but-unfinished surface.
 *
 * NOT THE SAME THING AS `ComingSoonBadge`, and the difference is which side of the gate
 * the thing is on. Coming Soon marks a `status: 'future'` feature — `proxy.ts` rewrites
 * the route, nobody can reach it, and the badge lives on the MARKETING site telling a
 * visitor about a product they have not bought yet. Beta marks a route that is `'live'`:
 * the member can open it right now, and the pill is a warning about what they will find
 * rather than an advertisement. Nothing derives this from `lib/features.ts`, because the
 * registry has two states and this is a property of a live one.
 *
 * TWO VARIANTS, and the split is about how many grounds the badge has to survive.
 *
 *   `solid`   — on a page: a filled Warmth chip, `--brand-warm` under `--brand-on-warm`.
 *               A checked pair in both themes (4.78 light, 4.83 dark). Warmth rather than
 *               Legacy gold because gold can never carry text in light mode, and rather
 *               than affirm green because "beta" is not an affirmative action.
 *
 *   `outline` — drawn entirely in `currentColor`, for a caller whose own ground varies.
 *               The sidebar is why it exists: a rail row sits on Heritage when inactive
 *               and on Legacy gold when active, and those two grounds have different `on-`
 *               partners (sand and Ink). Naming either one here would be wrong half the
 *               time, and AGENTS.md forbids borrowing a foreground across pairs. Inheriting
 *               is what makes the badge correct on both by construction — the caller has
 *               already set the row's text colour to the right partner, and this reuses it.
 *
 * `outline` is also not filled for a second reason particular to the rail: the active row
 * already spends a fill on the selection marker, and a second filled pill on the same row
 * competes with it for the same glance. See NavLink on why fourteen filled rows are
 * wallpaper.
 */
export function BetaBadge({
  variant = 'solid',
  className,
}: {
  variant?: 'solid' | 'outline'
  className?: string
}) {
  return (
    <span
      className={cn(
        'inline-flex shrink-0 items-center rounded-full font-semibold uppercase',
        variant === 'solid'
          ? 'bg-brand-warm px-2.5 py-0.5 text-[10px] tracking-[0.12em] text-brand-on-warm'
          : 'border border-current px-1.5 py-0.5 text-[9px] tracking-[0.1em] opacity-80',
        className,
      )}
    >
      Beta
    </span>
  )
}
