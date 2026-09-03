import Link from 'next/link'
import { HandCoins } from 'lucide-react'
import { buttonVariants } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import type { T } from '@/lib/i18n/t'
import type { Money } from '@/lib/currency-utils'

/**
 * What the family has collected in dues and donations — a widget in the Dashboard's narrow
 * column.
 *
 * ── IT WAS A TILE IN At a Glance UNTIL 2026-08-19 ──────────────────────────────────
 * `TILE_META.dues`, captioned "Dues Collected", beside Family Members and Upcoming
 * Gatherings. The move is a decision about what At a Glance is FOR: the tiles there answer
 * questions about the reader and their family's shape, and are read by everybody. This is a
 * treasurer's figure — the organisation's income to date — and it is read deliberately rather
 * than glanced at.
 *
 * It also behaved badly as a tile. A five-figure sum with a currency symbol is the widest
 * thing in an `auto-fit` grid, so it set the column width for every tile beside it; here it
 * has a card of its own and the amount can be as large as the family's year has been.
 *
 * NOTHING ABOUT WHO SEES IT CHANGED. `DUES_COLLECTED_RESOURCE` in `components/dashboard/
 * tiles.ts` is the same pair of ledger keys the tile used, `getFamilyDuesCollected()` gates
 * itself on them, and the page skips the query entirely for a caller who holds neither.
 *
 * ── `null` MEANS "NOT ENTITLED" AND `0` MEANS ZERO ─────────────────────────────────
 * The page passes `null` when the figure was not fetched, and the card renders NOTHING for it
 * rather than a dash — an absent card is honest, a card saying "—" invites a member to wonder
 * what they are missing. A real zero renders: a family that has collected nothing this year
 * has a fact worth seeing, and `getFamilyDuesCollected` returns `null` rather than `0`
 * precisely so the two can be told apart.
 *
 * ── EVERY LINK SETS ITS OWN COLOUR ────────────────────────────────────────────────
 * `globals.css` carries an unscoped `a { color: var(--brand-accent) }`, so an anchor that says
 * nothing comes out terracotta in light and gold in dark. `text-card-foreground` on the card
 * is what keeps it reading as a card rather than a link, and the button at the foot takes its
 * own colour from `buttonVariants` — the same trap answered the same way as in `AtAGlance`.
 */
export function FamilyDuesCollectedCard({ collectedCents, t, money }: {
  /** The reader's `Intl` tag. A prop — this is a Server Component. */
  money: Money
  collectedCents: number | null
  /**
   * The reader's language, bound. Threaded from the page rather than resolved here: a
   * Server Component cannot read `LocaleProvider` and has no `user` of its own. See
   * `lib/i18n/server.ts`.
   */
  t: T
}) {
  if (collectedCents === null) return null

  return (
    <Link
      href="/reporting/transactions?ledger=dues-payments"
      className="group flex flex-col gap-3 rounded-3xl border bg-card p-5 text-card-foreground shadow-[var(--shadow-card)] transition-shadow hover:shadow-[var(--shadow-card-hover,var(--shadow-card))]"
    >
      <span className="flex h-11 w-11 items-center justify-center rounded-full bg-brand-legacy text-brand-on-legacy">
        <HandCoins className="h-5 w-5" />
      </span>
      {/* `tabular-nums` so a figure that grows does not shift the caption under it, and a
          `<span>` rather than a heading: this is a number, and the card's own caption names
          it. */}
      <span className="text-2xl font-semibold leading-none tabular-nums">
        {money(collectedCents)}
      </span>
      <span className="text-sm text-muted-foreground">{t('dash.collected.title')}</span>
      {/* A button-SHAPED span, not a nested <Link>: the whole card is already an anchor and an
          <a> inside an <a> is invalid HTML that browsers silently unnest. `group-hover` rather
          than its own `hover:` for the same reason — the target is the card. */}
      <span
        className={cn(
          buttonVariants({ size: 'sm', variant: 'secondary' }),
          'mt-auto w-full justify-center group-hover:bg-brand-soft/60',
        )}
      >
        {t('dash.collected.view')}
      </span>
    </Link>
  )
}
