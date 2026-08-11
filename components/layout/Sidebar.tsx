'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useState, useEffect } from 'react'
import {
  LayoutDashboard,
  UserCircle,
  Users,
  GitBranch,
  Wallet,
  MessageCircle,
  Calendar,
  ClipboardList,
  ShieldCheck,
  UsersRound,
  ListChecks,
  CalendarClock,
  Menu,
  X,
  BookOpen,
  Megaphone,
  FileText,
  Vote,
  BarChart3,
  Camera,
  ChevronDown,
  ArrowRightLeft,
  Home,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { isFeatureFuture } from '@/lib/features'
import { APP_NAME } from '@/lib/brand'

// Should a section close on its own when the user clicks away from it — either by
// opening a different section (accordion) or by landing on the Dashboard? When
// false, a section stays open until the user collapses it themselves and any
// number of sections may be open at once.
const AUTO_COLLAPSE_SECTIONS = true

interface NavItem {
  href: string
  label: string
  icon: React.ComponentType<{ className?: string }>
  /**
   * Resource keys, ANY of which makes this item visible. Defaults to the one derived
   * from `href`, which is right for every page whose route and permission key match.
   *
   * Members & Access is the exception: it hosts three independently granted tabs —
   * Members under `admin/users`, Pending Approval under `admin/approvals`, and
   * Permission Templates under `admin/users/templates` — and the page opens for any
   * one of them, so someone holding only one still needs the link.
   */
  viewKeys?: string[]
}

interface NavGroup {
  section?: { label: string; icon: React.ComponentType<{ className?: string }> }
  items: NavItem[]
}

// Hand-ordered, not alphabetical: structure first (who the family's officers are,
// then where its chapters are), then Accounting, then the people and their access.
// Elections and Reports are periodic tasks rather than setup, so they trail.
// This order is independent of the permission grid on Members & Access, which sorts
// by permission_resources.sort_order in the database.
const adminItems: NavItem[] = [
  // Members & Access leads, having absorbed Member Approvals as its Pending Approval
  // tab. The queue is the reason for the position: it is the only admin surface with
  // PEOPLE waiting behind it, who can see nothing until somebody acts, so it is the
  // one an administrator should be prompted to look at rather than scroll to.
  {
    href: '/admin/users',
    label: 'Members & Access',
    icon: UsersRound,
    viewKeys: ['admin/users', 'admin/approvals', 'admin/users/templates'],
  },
  { href: '/admin/boardpositions', label: 'Board Positions',      icon: ShieldCheck },
  { href: '/admin/chapters',       label: 'Regions & Chapters',   icon: ShieldCheck },
  { href: '/admin/account',        label: 'Accounting',           icon: Wallet },
  { href: '/admin/elections',      label: 'Election Management',  icon: Vote },
  { href: '/admin/reports',        label: 'Reports',              icon: BarChart3 },
]

// Build the nav groups for the current user. Every item is listed unconditionally
// and then filtered by what the member may actually view — the permission model is
// the single authority, so there is no separate isAdmin branch here any more.
function buildNavGroups(hasAssignments: boolean, viewable: Set<string>): NavGroup[] {
  const eventItems: NavItem[] = [
    { href: '/events', label: 'Upcoming Events', icon: Calendar },
    ...(hasAssignments ? [{ href: '/event-planning', label: 'Event Planning', icon: ClipboardList }] : []),
    { href: '/admin/events',      label: 'Event Management', icon: CalendarClock },
    { href: '/admin/event-types', label: 'Event Templates',  icon: ListChecks },
  ]

  const groups: NavGroup[] = [
    {
      items: [
        { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
      ],
    },
    {
      section: { label: 'Personal', icon: UserCircle },
      items: [
        { href: '/personal-info',   label: 'My Profile',   icon: UserCircle },
        // Always shown, including for single-family accounts: this is where you join
        // another family by code, so it has to be reachable before you have a second one.
        { href: '/my-families',     label: 'My Families',  icon: Home },
        { href: '/direct-lineage',  label: 'My Children',  icon: Users },
        { href: '/family-tree',     label: 'Family Tree',  icon: GitBranch },
      ],
    },
    {
      section: { label: 'Community', icon: UsersRound },
      items: [
        { href: '/chat',          label: 'Chat',             icon: MessageCircle },
        { href: '/announcements', label: 'Announcements',    icon: Megaphone },
        { href: '/members',       label: 'Member Directory', icon: UsersRound },
      ],
    },
  ]

  groups.push({ section: { label: 'Events', icon: CalendarClock }, items: eventItems })

  groups.push({
    section: { label: 'Accounting', icon: Wallet },
    items: [
      { href: '/account-summary', label: 'My Summary',        icon: Wallet },
      { href: '/transactions',    label: 'Transactions',      icon: ArrowRightLeft },
      { href: '/family-finances', label: 'Family Finances',   icon: BarChart3 },
    ],
  })

  groups.push({
    section: { label: 'Resources', icon: BookOpen },
    items: [
      { href: '/photos',    label: 'Photos',    icon: Camera },
      { href: '/documents', label: 'Documents', icon: FileText },
      { href: '/elections', label: 'Elections', icon: Vote },
    ],
  })

  groups.push({ section: { label: 'Admin', icon: ShieldCheck }, items: adminItems })

  // Two independent gates, both narrowing:
  //   * roadmap — has the feature shipped at all? (lib/features.ts)
  //   * permission — may THIS member view it? (viewable, from the permission model)
  // Then drop any section left with nothing in it. proxy.ts still gates the
  // roadmap routes and RLS still gates the data, so this is presentation only.
  return groups
    .map(group => ({
      ...group,
      items: group.items.filter(item =>
        !isFeatureFuture(item.href)
        && (item.viewKeys ?? [item.href.replace(/^\//, '')]).some(key => viewable.has(key)),
      ),
    }))
    .filter(group => group.items.length > 0)
}

function isActive(pathname: string, href: string) {
  return pathname === href || pathname.startsWith(href + '/')
}

/**
 * One row in the nav.
 *
 * WHY IT LOOKED FLAT, AND WHAT CHANGED. Every row used to carry a filled `bg-brand-soft`
 * chip and the active one swapped to `bg-brand-primary`. When everything is a chip
 * nothing is selected — the eye has fourteen equal sand blocks to sort through, and the
 * one that matters differs only in hue. A list of destinations should read as a list,
 * with exactly one thing standing out.
 *
 * So rows are now plain text with a hover well, and only the active row is filled — plus
 * a Legacy gold marker down its left edge, which is the same non-text-accent use the
 * header rule and the email dividers make of that colour.
 *
 * THE ACTIVE FILL IS `--brand-primary`, and it went back to burgundy when the rail became
 * a recessed surface. An intermediate version filled it with `--brand-soft`, which was
 * legible against the old page-coloured rail and is 1.19 against the sand one — sand on
 * sand, gone. Burgundy reads at 8.67 against the rail, and `--brand-primary`'s stated job
 * in AGENTS.md is literally "filled chips, buttons, active rail items".
 *
 * Worth being precise about what the original mistake was: not that the active row was
 * burgundy, but that the INACTIVE ones were filled too. One filled row among plain ones
 * is a selection; fourteen filled rows are wallpaper.
 *
 * BOTH BRANCHES SET AN EXPLICIT TEXT COLOUR, and neither may be dropped. `globals.css`
 * carries an unscoped `a { color: var(--brand-accent) }` in its base layer, so a nav link
 * without one comes out terracotta — the trap documented in AGENTS.md and commented at
 * every other rail in the codebase.
 *
 * The marker is rendered on both branches in `transparent` rather than only when active,
 * so selecting a row changes a colour and never a size. Same reasoning as MainRail's
 * stacked variant.
 */
function NavLink({ href, label, icon: Icon, active, onClick }: {
  href: string
  label: string
  icon: React.ComponentType<{ className?: string }>
  active: boolean
  onClick?: () => void
}) {
  return (
    <Link
      href={href}
      onClick={onClick}
      aria-current={active ? 'page' : undefined}
      className={cn(
        'group relative flex items-center gap-3 rounded-lg py-2 pl-4 pr-3 text-sm transition-colors',
        active
          ? 'bg-brand-primary font-semibold text-brand-on-primary shadow-sm'
          : 'text-sidebar-foreground/70 hover:bg-brand-soft/60 hover:text-brand-on-soft',
      )}
    >
      <span
        aria-hidden="true"
        className={cn(
          'absolute inset-y-1.5 left-0 w-[3px] rounded-full transition-colors',
          active ? 'bg-brand-legacy' : 'bg-transparent',
        )}
      />
      <Icon className={cn('h-4 w-4 shrink-0 transition-opacity', active ? 'opacity-100' : 'opacity-60 group-hover:opacity-100')} />
      {label}
    </Link>
  )
}

/**
 * The label on a section heading, shared by the static and collapsible forms so the two
 * cannot drift apart.
 *
 * The old heading centred a muted label between two grey rules, which put the least
 * important thing on the row — a divider — in the two most prominent positions and left
 * the label itself the faintest thing in the panel. It now reads left-to-right like a
 * heading: label first in brand ink, then a gold hairline running out to the edge. The
 * gold fades rather than stopping, so a stack of sections looks like a considered
 * structure instead of a run of horizontal bars.
 */
function SectionLabel({ label, icon: Icon }: {
  label: string
  icon: React.ComponentType<{ className?: string }>
}) {
  return (
    <>
      <span className="flex shrink-0 items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.14em] text-brand-ink/75">
        <Icon className="h-3.5 w-3.5" /> {label}
      </span>
      {/* Legacy gold as a rule — a non-text accent, the one thing it may always be. */}
      <span aria-hidden="true" className="h-px flex-1 bg-gradient-to-r from-brand-legacy/50 to-transparent" />
    </>
  )
}

function SectionDivider({ label, icon: Icon }: {
  label: string
  icon: React.ComponentType<{ className?: string }>
}) {
  return (
    <div className="mt-4 flex items-center gap-2 px-3 py-1.5">
      <SectionLabel label={label} icon={Icon} />
    </div>
  )
}

// A nav group. Sections with more than one item become collapsible sliders;
// single-item sections (and the top-level Dashboard group) render statically.
// `open`/`onToggle` are owned by NavTree, which decides how sections interact
// with one another (see AUTO_COLLAPSE_SECTIONS).
function NavSection({ group, pathname, open, onToggle, onNavClick }: {
  group: NavGroup
  pathname: string
  open: boolean
  onToggle: () => void
  onNavClick?: () => void
}) {
  const { section, items } = group

  const links = items.map(item => (
    <NavLink key={item.href} {...item} active={isActive(pathname, item.href)} onClick={onNavClick} />
  ))

  // No section header (e.g. Dashboard) — render the items plainly.
  if (!section) {
    return <div className="flex flex-col gap-0.5">{links}</div>
  }

  const Icon = section.icon

  // A single option doesn't need a slider — keep it as a static divider.
  if (items.length <= 1) {
    return (
      <div>
        <SectionDivider label={section.label} icon={Icon} />
        <div className="flex flex-col gap-0.5 mt-0.5">{links}</div>
      </div>
    )
  }

  // More than one option — collapsible slider.
  return (
    <div>
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={open}
        className="group mt-4 flex w-full items-center gap-2 rounded-lg px-3 py-1.5 transition-colors hover:bg-brand-soft/40"
      >
        <SectionLabel label={section.label} icon={Icon} />
        <ChevronDown
          className={cn(
            'h-3.5 w-3.5 shrink-0 text-brand-ink/50 transition-transform group-hover:text-brand-ink',
            open ? '' : '-rotate-90',
          )}
        />
      </button>
      {open && <div className="mt-1 flex flex-col gap-0.5">{links}</div>}
    </div>
  )
}

function NavTree({ groups, pathname, onNavClick }: {
  groups: NavGroup[]
  pathname: string
  onNavClick?: () => void
}) {
  // Default to the section that contains the active route so the current page
  // stays visible. With AUTO_COLLAPSE_SECTIONS on this behaves as an accordion —
  // only one section open at a time; with it off, sections open independently.
  const collapsible = (g: NavGroup) => Boolean(g.section) && g.items.length > 1
  const activeSection = groups.find(g => collapsible(g) && g.items.some(it => isActive(pathname, it.href)))
  const [openSections, setOpenSections] = useState<Set<string>>(
    () => new Set(activeSection?.section?.label ? [activeSection.section.label] : []),
  )

  const toggleSection = (label: string) =>
    setOpenSections(curr => {
      if (curr.has(label)) {
        const next = new Set(curr)
        next.delete(label)
        return next
      }
      return AUTO_COLLAPSE_SECTIONS ? new Set([label]) : new Set(curr).add(label)
    })

  // Collapse every section when the user lands on the Dashboard.
  useEffect(() => {
    if (AUTO_COLLAPSE_SECTIONS && pathname === '/dashboard') setOpenSections(new Set())
  }, [pathname])

  return (
    <>
      {groups.map((group, i) => {
        const label = group.section?.label ?? `group-${i}`
        return (
          <NavSection
            key={label}
            group={group}
            pathname={pathname}
            open={openSections.has(label)}
            onToggle={() => toggleSection(label)}
            onNavClick={onNavClick}
          />
        )
      })}
    </>
  )
}

export function Sidebar({ hasAssignments = false, viewable }: { hasAssignments?: boolean; viewable: string[] }) {
  const pathname = usePathname()
  const [mobileOpen, setMobileOpen] = useState(false)
  const navGroups = buildNavGroups(hasAssignments, new Set(viewable))

  useEffect(() => {
    setMobileOpen(false)
  }, [pathname])

  return (
    <>
      {/* ── Desktop: sticky left panel ─────────────────────────────── */}
      {/* The nav pins below the navbar (h-16 + its 1px border) and is capped to
          the space left underneath it. The cap is what makes overflow-y-auto
          mean anything: without a max-height the nav simply grows to its content
          and scrolls away with the page instead of scrolling within itself. */}
      {/* The offsets below are 4rem + 2px, not + 1px: the header is h-16 plus the 2px
          Legacy gold rule that replaced its 1px border. Miss this and the nav sits two
          pixels under the rule, which shows as a sliver of page scrolling through the
          gap. If the header's edge changes thickness, these three numbers change with it. */}
      <aside className="hidden md:flex w-56 shrink-0 flex-col border-r border-sidebar-border bg-sidebar">
        <nav className="sticky top-[calc(4rem_+_2px)] max-h-[calc(100vh_-_4rem_-_2px)] flex flex-col p-3 pt-6 overflow-y-auto overscroll-contain">
          <NavTree groups={navGroups} pathname={pathname} />
        </nav>
      </aside>

      {/* ── Mobile: hamburger button ────────────────────────────────── */}
      {/* Pinned directly under the navbar for the same reason as the desktop
          panel — the nav should stay reachable however far the page has scrolled. */}
      {/* z-20, which is BELOW the navbar's z-30 — see the stacking table in Navbar.
          This bar and the header used to share z-10, and because it is rendered after
          the header it won, swallowing the top of the family switcher and the
          notification panel where they hang past the header's edge. */}
      {/* Same rail surface as the desktop panel, so the mobile nav strip separates from
          the page for the same reason and by the same amount. */}
      <div className="md:hidden sticky top-[calc(4rem_+_2px)] z-20 border-b border-sidebar-border bg-sidebar shrink-0 flex items-center px-3 py-2">
        <button
          onClick={() => setMobileOpen(true)}
          className="flex items-center gap-2 rounded-lg bg-brand-soft px-3 py-1.5 text-sm font-medium text-brand-on-soft transition-opacity hover:opacity-90"
          aria-label="Open navigation menu"
        >
          <Menu className="h-4 w-4" />
          Menu
        </button>
      </div>

      {/* ── Mobile: slide-out drawer ────────────────────────────────── */}
      {mobileOpen && (
        <>
          {/* Above the header (z-30), not below it: this is a modal drawer, and a
              backdrop that leaves the navbar live lets someone sign out through the
              scrim they just tapped to dismiss. */}
          <div
            className="md:hidden fixed inset-0 bg-black/50 z-40"
            onClick={() => setMobileOpen(false)}
            aria-hidden="true"
          />
          <div className="md:hidden fixed inset-y-0 left-0 w-64 bg-sidebar border-r border-sidebar-border z-50 flex flex-col">
            {/* The drawer's own header takes the Heritage band and the gold rule, so
                opening the menu on a phone lands on the same surface the app header
                shows — rather than a plain white strip that belongs to no product. */}
            <div className="shrink-0 bg-brand-hero">
              <div className="flex items-center justify-between px-4 py-3">
                <span className="gn-wordmark text-lg text-brand-on-hero">{APP_NAME}</span>
                <button
                  onClick={() => setMobileOpen(false)}
                  className="rounded-lg p-1.5 text-brand-on-hero transition-colors hover:bg-brand-primary"
                  aria-label="Close navigation menu"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
              <div aria-hidden="true" className="h-0.5 w-full bg-brand-legacy" />
            </div>
            <nav className="flex flex-col p-3 overflow-y-auto">
              <NavTree groups={navGroups} pathname={pathname} onNavClick={() => setMobileOpen(false)} />
            </nav>
          </div>
        </>
      )}
    </>
  )
}
