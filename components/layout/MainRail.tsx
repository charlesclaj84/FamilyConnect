'use client'

import { cn } from '@/lib/utils'

type IconComponent = React.ComponentType<{ className?: string }>

export interface MainRailItem<T extends string> {
  id: T
  label: string
  icon?: IconComponent
  /**
   * The URL this item corresponds to. Supplying it renders a real `<a>`, so
   * cmd-click, middle-click and copy-link-address all work; a plain left click is
   * still intercepted and handled by `onSelect`. Omit it for a rail whose panes
   * have no addressable URL, and the item renders as a `<button>` instead.
   */
  href?: string
}

interface Props<T extends string> {
  /** Names the nav landmark — "Accounting areas", "Transaction ledgers". */
  label: string
  items: readonly MainRailItem<T>[]
  active: T
  onSelect: (id: T) => void
  /**
   * Right-aligned slot for the one action belonging to the active pane — the
   * "New …" trigger on Transactions and Accounting.
   *
   * Rendered OUTSIDE the `<nav>` on purpose: it does not navigate, and a nav
   * landmark listing a button reads as a broken link to a screen reader.
   */
  action?: React.ReactNode
}

/**
 * THE MAIN RAIL — the primary in-page nav, and the default for every page that has
 * one. See AGENTS.md, "The main rail is a standard component".
 *
 * A horizontal strip of underlined tabs, sitting on a rule that runs the width of
 * the pane. It replaced the filled-pill left rail that Transactions and Accounting
 * used to carry: that one claimed a 16rem column from every page it appeared on,
 * which the routing table — then floored at `min-w-[560px]` — could not spare below
 * about 1280px. That floor is gone (the table folds instead; see
 * components/ui/table-collapse.tsx), but the 16rem column is not coming back: the
 * space it took was charged to every page carrying it, wide table or not.
 *
 * BELOW `sm` IT IS A STACK, one item per line — because it was wrapping. Four ledgers
 * or six profile sections do not fit 390px, and `flex-wrap` broke them into ragged rows
 * where the second row's items sat under the middle of the first: nothing lined up, and
 * the active underline read as a rule under an arbitrary half of the rail. A vertical
 * list has one item per line by construction, so there is nothing left to wrap.
 *
 * THE ACTIVE MARKER MOVES WITH IT — a left bar on mobile, the underline from `sm` up.
 * A full-width `border-b-2` under a stacked item is indistinguishable from a divider
 * between two items, which would make the one piece of state this component holds
 * unreadable exactly where the stack applies. Inactive items carry the same border
 * width in `transparent` so the label does not shift by 2px when it becomes active.
 *
 * Deliberately NOT `role="tablist"`. That role is a promise about keyboard
 * behaviour — arrow keys move between tabs, Home/End jump to the ends, the panel is
 * wired by aria-controls — and a screen reader changes its own key handling to match.
 * None of that is implemented here, so claiming the role would strand those users
 * pressing arrow keys at something inert. As a nav landmark holding links, Tab works,
 * which is what is actually true. Same reasoning as RowMenu in AdminAccessClient.
 *
 * The explicit text colours on every branch are required, not stylistic: globals.css
 * carries an unscoped `a { color: var(--brand-accent) }` in its base layer that would
 * otherwise paint every item in this rail terracotta.
 */
export function MainRail<T extends string>({ label, items, active, onSelect, action }: Props<T>) {
  return (
    // No margin of its own: the rail is spaced by whatever stacks it — a `space-y-*`
    // wrapper on Members & Access, an explicit `mt-*` on the pane elsewhere. Baking one
    // in here would double up against the first of those.
    <div className="flex flex-col items-stretch gap-2 border-b sm:flex-row sm:flex-wrap sm:items-end sm:justify-between sm:gap-x-4 sm:gap-y-1">
      <nav aria-label={label} className="flex flex-col sm:flex-row sm:flex-wrap sm:gap-1">
        {items.map(item => {
          const isActive = item.id === active
          const className = cn(
            // Full width while stacked, so the whole line is the target and the left
            // bar has something to sit against; auto width once it is a row again.
            'flex w-full items-center gap-1.5 px-3 py-2 text-sm transition-colors sm:w-auto',
            // The marker: border-l while stacked, border-b from sm up. Both are declared
            // on every item — transparent when inactive — so becoming active changes a
            // colour and never a size.
            'border-l-2 border-b-0 sm:border-l-0 sm:border-b-2',
            isActive
              ? 'border-brand-primary bg-brand-primary/[0.04] font-medium text-brand-ink sm:bg-transparent'
              : 'border-transparent text-muted-foreground hover:text-foreground',
          )
          const inner = (
            <>
              {item.icon && <item.icon className="h-4 w-4 shrink-0" />}
              {item.label}
            </>
          )

          // A rail item that names a URL stays a link, so the browser's own
          // affordances keep working; only the plain left click is taken over, to
          // skip a round trip that would remount the pane and lose its state.
          return item.href ? (
            <a
              key={item.id}
              href={item.href}
              aria-current={isActive ? 'page' : undefined}
              onClick={e => {
                if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0) return
                e.preventDefault()
                onSelect(item.id)
              }}
              className={className}
            >
              {inner}
            </a>
          ) : (
            <button
              key={item.id}
              type="button"
              aria-current={isActive ? 'page' : undefined}
              onClick={() => onSelect(item.id)}
              className={className}
            >
              {inner}
            </button>
          )
        })}
      </nav>

      {/* Below sm the action sits under the stack rather than beside it, and stretches to
          the same width as the items — there is no room for a row of tabs and a "New …"
          button side by side, which is the crowding that made the rail wrap. */}
      {action && <div className="pb-2 [&>*]:w-full sm:pb-1.5 sm:[&>*]:w-auto">{action}</div>}
    </div>
  )
}
