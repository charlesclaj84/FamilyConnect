'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Building2, KeyRound, LayoutGrid, UserSearch } from 'lucide-react'
import type { StaffRole } from '@/lib/auth/staff'
import { cn } from '@/lib/utils'

/**
 * The staff console's own navigation — real links, in its header band.
 *
 * ── WHY NOT `MainRail`, WHICH IS THE DOCUMENTED DEFAULT ────────────────────────────
 * AGENTS.md calls `MainRail` the default primary in-page navigation, and it would render
 * this perfectly well. It is deliberately not used, for two reasons that are about what
 * the component MEANS rather than about how it looks:
 *
 *   * **"One rail item, one permission resource."** That is not a note beside the
 *     component, it is the rule the rail is built on — every item owns a row in
 *     `permission_resources` and that row's label is the caption. None of these has one,
 *     and none may (see `lib/auth/staff.ts`). Borrowing the rail here would put its
 *     central invariant in a place where it is false.
 *   * **It switches PANES, not pages.** Its `href` + `onSelect` pair exists to intercept
 *     a left click so a pane keeps its optimistic rows and half-filled forms. These are
 *     separate routes with separate server reads; there is nothing to preserve, and the
 *     interception would only add a `router.push` between the click and the page.
 *
 * So this is a plain `<nav>` of `<Link>`s, which is what it is. It sits in the console's
 * header band rather than on the page, because the band is what says this is not the
 * member product and the navigation belongs with that statement.
 *
 * ── ONE ITEM IS OWNER-ONLY, AND THE ROLE ARRIVES AS A PROP ─────────────────────────
 * `/staff/access` is `requireStaffOwner()`, so a `support` staffer following a link to it
 * gets a 404 from their own console's navigation — which is worse than no link at all: it
 * looks like the console is broken, and the one thing it must not look like is a place
 * where some pages fail. So the item is withheld for anybody who is not an owner.
 *
 * THE DECISION IS NOT MADE HERE. This is a `'use client'` file, so anything it could
 * "check" would be a value that had already crossed the wire — and a value that has
 * crossed the wire is a value the browser can change. The role is resolved SERVER-SIDE
 * through `staffGrant()` (the service role, against a table with RLS enabled and zero
 * policies) and handed down; all this file does is decide what to render from it. That is
 * the same shape as `isGenorraStaff` being resolved in `app/(protected)/layout.tsx` and
 * passed to the account-menu launcher as a prop, and the same reason: there is no
 * client-side flag to spoof because there is no client-side check.
 *
 * A HIDDEN LINK IS NOT THE GATE, and nothing here pretends otherwise. `/staff/access` and
 * every action behind it call `requireStaffOwner()` themselves — AGENTS.md §5's rule about
 * hiding a control not protecting the data behind it, one product along. This only decides
 * whether somebody is invited to press something that would refuse them.
 *
 * ── THE PROP IS OPTIONAL, AND ABSENT MEANS "NOT AN OWNER" ──────────────────────────
 * Fail closed. A mount point that does not know the caller's role must not be able to
 * publish a link to the screen that hands out cross-family access, and "not stated"
 * therefore resolves to the least access rather than to the most — the same direction
 * `staffGrant()` takes when its own read fails, and the same direction `20260817000004`
 * made `admin/` keys take when a family has no visibility row. The cost of the safe
 * direction is a missing link, which is visible and repairable; the cost of the other one
 * is a 404 handed to somebody who was told the page was theirs.
 *
 * ── THE EXPLICIT TEXT COLOURS ARE LOAD-BEARING ─────────────────────────────────────
 * `app/globals.css` carries an unscoped `a { color: var(--brand-accent) }` in its base
 * layer, so every link here comes out terracotta (gold in dark) without a colour of its
 * own on BOTH branches of the active/inactive test. `MainRail`, `Sidebar`, `RoomListItem`
 * and `AdminAccountShell` all carry the same note for the same reason — removing one of
 * these classes recolours the nav rather than leaving it alone.
 */

const ITEMS = [
  { href: '/staff', label: 'Overview', icon: LayoutGrid, ownerOnly: false },
  { href: '/staff/families', label: 'Families', icon: Building2, ownerOnly: false },
  { href: '/staff/accounts', label: 'Accounts', icon: UserSearch, ownerOnly: false },
  // LAST, and not because it is least important. It is the only destination here that
  // changes who can open the console at all, and the three above it are the ones somebody
  // opens the console to do. A key rather than a shield: `ShieldCheck` is already the
  // band's glyph for "whose session this is", and two shields in one header band would be
  // two different things wearing the same mark.
  { href: '/staff/access', label: 'Access', icon: KeyRound, ownerOnly: true },
] as const

export function StaffNav({ role }: {
  /**
   * The acting staff member's role, resolved on the server. Omitted — or anything other
   * than `'owner'` — hides the owner-only item; see the header.
   */
  role?: StaffRole
}) {
  const pathname = usePathname()

  return (
    <nav aria-label="Staff console" className="flex flex-wrap items-center gap-1">
      {ITEMS.filter(item => !item.ownerOnly || role === 'owner').map(item => {
        // Exact match, not a prefix: '/staff' is the parent of every other route in the
        // console, so a `startsWith` test would light Overview up on every screen in it.
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
