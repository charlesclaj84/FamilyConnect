'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Building2, LayoutGrid, UserSearch } from 'lucide-react'
import { cn } from '@/lib/utils'

/**
 * The staff console's own navigation — three real links, in its header band.
 *
 * ── WHY NOT `MainRail`, WHICH IS THE DOCUMENTED DEFAULT ────────────────────────────
 * AGENTS.md calls `MainRail` the default primary in-page navigation, and it would render
 * this perfectly well. It is deliberately not used, for two reasons that are about what
 * the component MEANS rather than about how it looks:
 *
 *   * **"One rail item, one permission resource."** That is not a note beside the
 *     component, it is the rule the rail is built on — every item owns a row in
 *     `permission_resources` and that row's label is the caption. None of these three has
 *     one, and none may (see `lib/auth/staff.ts`). Borrowing the rail here would put its
 *     central invariant in a place where it is false.
 *   * **It switches PANES, not pages.** Its `href` + `onSelect` pair exists to intercept
 *     a left click so a pane keeps its optimistic rows and half-filled forms. These are
 *     three separate routes with separate server reads; there is nothing to preserve, and
 *     the interception would only add a `router.push` between the click and the page.
 *
 * So this is a plain `<nav>` of `<Link>`s, which is what it is. It sits in the console's
 * header band rather than on the page, because the band is what says this is not the
 * member product and the navigation belongs with that statement.
 *
 * ── THE EXPLICIT TEXT COLOURS ARE LOAD-BEARING ─────────────────────────────────────
 * `app/globals.css` carries an unscoped `a { color: var(--brand-accent) }` in its base
 * layer, so every link here comes out terracotta (gold in dark) without a colour of its
 * own on BOTH branches of the active/inactive test. `MainRail`, `Sidebar`, `RoomListItem`
 * and `AdminAccountShell` all carry the same note for the same reason — removing one of
 * these classes recolours the nav rather than leaving it alone.
 */

const ITEMS = [
  { href: '/staff', label: 'Overview', icon: LayoutGrid },
  { href: '/staff/families', label: 'Families', icon: Building2 },
  { href: '/staff/accounts', label: 'Accounts', icon: UserSearch },
] as const

export function StaffNav() {
  const pathname = usePathname()

  return (
    <nav aria-label="Staff console" className="flex flex-wrap items-center gap-1">
      {ITEMS.map(item => {
        // Exact match, not a prefix: '/staff' is the parent of the other two, so a
        // `startsWith` test would light Overview up on every screen in the console.
        const isActive = pathname === item.href
        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={isActive ? 'page' : undefined}
            className={cn(
              'flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-sm transition-colors',
              isActive
                ? 'bg-brand-on-hero/15 font-medium text-brand-on-hero'
                : 'text-brand-on-hero/75 hover:bg-brand-on-hero/10 hover:text-brand-on-hero',
            )}
          >
            <item.icon className="h-4 w-4 shrink-0" aria-hidden="true" />
            {item.label}
          </Link>
        )
      })}
    </nav>
  )
}
