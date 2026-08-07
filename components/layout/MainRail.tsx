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
 * which the routing table (min-w-[560px]) could not spare below about 1280px.
 *
 * Deliberately NOT `role="tablist"`. That role is a promise about keyboard
 * behaviour — arrow keys move between tabs, Home/End jump to the ends, the panel is
 * wired by aria-controls — and a screen reader changes its own key handling to match.
 * None of that is implemented here, so claiming the role would strand those users
 * pressing arrow keys at something inert. As a nav landmark holding links, Tab works,
 * which is what is actually true. Same reasoning as RowMenu in AdminAccessClient.
 *
 * The explicit text colours on every branch are required, not stylistic: globals.css
 * carries an unscoped `a { color: #1aa88a }` (line 136) that would otherwise paint
 * every item in this rail teal.
 */
export function MainRail<T extends string>({ label, items, active, onSelect, action }: Props<T>) {
  return (
    // No margin of its own: the rail is spaced by whatever stacks it — a `space-y-*`
    // wrapper on Members & Access, an explicit `mt-*` on the pane elsewhere. Baking one
    // in here would double up against the first of those.
    <div className="flex flex-wrap items-end justify-between gap-x-4 gap-y-1 border-b">
      <nav aria-label={label} className="flex flex-wrap gap-1">
        {items.map(item => {
          const isActive = item.id === active
          const className = cn(
            'flex items-center gap-1.5 px-3 py-2 text-sm transition-colors',
            isActive
              ? 'border-b-2 border-[#0f2540] font-medium text-[#0f2540]'
              : 'text-muted-foreground hover:text-foreground',
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

      {action && <div className="pb-1.5">{action}</div>}
    </div>
  )
}
