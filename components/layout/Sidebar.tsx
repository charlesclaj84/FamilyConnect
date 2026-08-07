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
   * Members & Access is the exception: it hosts two independently granted surfaces —
   * its own screens under `admin/users`, and the Pending Approval tab under
   * `admin/approvals` — so someone holding only the second still needs the link.
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
    viewKeys: ['admin/users', 'admin/approvals'],
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
      className={cn(
        'flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors',
        active
          ? 'bg-[#0f2540] text-[#e6ecf1] font-medium'
          : 'bg-[#e6ecfa] text-[#0f2540] hover:opacity-90',
      )}
    >
      <Icon className="h-4 w-4 shrink-0" />
      {label}
    </Link>
  )
}

function SectionDivider({ label, icon: Icon }: {
  label: string
  icon: React.ComponentType<{ className?: string }>
}) {
  return (
    <div className="flex items-center gap-1.5 px-3 py-1.5 mt-3">
      <div className="h-px flex-1 bg-border" />
      <span className="flex items-center gap-1 text-xs font-medium text-muted-foreground uppercase tracking-wide">
        <Icon className="h-3 w-3" /> {label}
      </span>
      <div className="h-px flex-1 bg-border" />
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
        className="w-full flex items-center gap-1.5 px-3 py-1.5 mt-3 group"
      >
        <span className="flex items-center gap-1 text-xs font-medium text-muted-foreground uppercase tracking-wide">
          <Icon className="h-3 w-3" /> {section.label}
        </span>
        <div className="h-px flex-1 bg-border" />
        <ChevronDown
          className={cn('h-3.5 w-3.5 text-muted-foreground transition-transform', open ? '' : '-rotate-90')}
        />
      </button>
      {open && <div className="flex flex-col gap-0.5 mt-0.5">{links}</div>}
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
      <aside className="hidden md:flex w-56 shrink-0 flex-col border-r bg-background">
        <nav className="sticky top-[calc(4rem_+_1px)] max-h-[calc(100vh_-_4rem_-_1px)] flex flex-col p-3 pt-6 overflow-y-auto overscroll-contain">
          <NavTree groups={navGroups} pathname={pathname} />
        </nav>
      </aside>

      {/* ── Mobile: hamburger button ────────────────────────────────── */}
      {/* Pinned directly under the navbar for the same reason as the desktop
          panel — the nav should stay reachable however far the page has scrolled. */}
      <div className="md:hidden sticky top-[calc(4rem_+_1px)] z-10 border-b bg-background shrink-0 flex items-center px-3 py-2">
        <button
          onClick={() => setMobileOpen(true)}
          className="flex items-center gap-2 rounded-lg px-3 py-1.5 text-sm bg-[#e6ecfa] text-[#0f2540] hover:opacity-90 transition-colors"
          aria-label="Open navigation menu"
        >
          <Menu className="h-4 w-4" />
          Menu
        </button>
      </div>

      {/* ── Mobile: slide-out drawer ────────────────────────────────── */}
      {mobileOpen && (
        <>
          <div
            className="md:hidden fixed inset-0 bg-black/50 z-20"
            onClick={() => setMobileOpen(false)}
            aria-hidden="true"
          />
          <div className="md:hidden fixed inset-y-0 left-0 w-64 bg-background border-r z-30 flex flex-col">
            <div className="flex items-center justify-between px-4 py-3 border-b">
              <span className="font-semibold text-[#0f2540]">Menu</span>
              <button
                onClick={() => setMobileOpen(false)}
                className="rounded-lg p-1.5 hover:bg-[#e6ecfa] transition-colors"
                aria-label="Close navigation menu"
              >
                <X className="h-4 w-4 text-[#0f2540]" />
              </button>
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
