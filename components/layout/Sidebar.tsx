'use client'

import Image from 'next/image'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useState } from 'react'
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
  Settings,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { isFeatureFuture } from '@/lib/features'
import { APP_NAME, BRAND_MARK_SRC } from '@/lib/brand'
import { RailFootDecor, RailMotto } from '@/components/layout/ShellDecor'

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
  // Members leads, having absorbed Member Approvals as its Pending Approval tab. The
  // queue is the reason for the position: it is the only admin surface with PEOPLE
  // waiting behind it, who can see nothing until somebody acts, so it is the one an
  // administrator should be prompted to look at rather than scroll to.
  //
  // Captioned "Members" since 20260812000001, where it was "Members & Access". Note it
  // is NOT the same thing as Community > Directory, which is now captioned with the one
  // word too: that one is the roster every member may read, this one is who is in the
  // family and what each of them may do. They sit under different section headings,
  // which is what tells them apart — the same rule that lets "Dues" appear under both
  // Accounting and Transactions in the permission grid.
  {
    href: '/admin/users',
    label: 'Members',
    icon: UsersRound,
    viewKeys: ['admin/users', 'admin/approvals', 'admin/users/templates'],
  },
  { href: '/admin/boardpositions', label: 'Board Positions',      icon: ShieldCheck },
  { href: '/admin/chapters',       label: 'Regions & Chapters',   icon: ShieldCheck },
  { href: '/admin/account',        label: 'Accounting',           icon: Wallet },
  { href: '/admin/elections',      label: 'Election Management',  icon: Vote },
  { href: '/admin/reports',        label: 'Reports',              icon: BarChart3 },
  // SETTINGS IS LAST, and the permission grid agrees with it — 20260812000001 moved its
  // sort_order from 155 (top of the Administration block) to 260 (bottom) in the same
  // commit that shortened its label. The two lists used to disagree here on the argument
  // that "which family is this" reads first in a CATALOGUE of switches; the simpler rule
  // won. Settings is the thing you set up once and then leave alone, so it belongs where
  // a reader stops looking rather than where they start, and one order is easier to hold
  // in the head than two.
  { href: '/admin/family',         label: 'Settings',             icon: Settings },
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
      // MY PROFILE AND MY FAMILIES ARE NOT HERE — they moved to the account menu in the
      // top bar, and a destination in two places at once is a destination people learn
      // twice. The menu is the better home for both: they are things about YOU rather
      // than about the family being viewed, which is the same distinction that put the
      // family switcher in the bar and left it out of the menu.
      //
      // THE SECTION SURVIVES ANYWAY, and deleting it would have been the mistake. Its
      // other two items are both `status: 'future'`, so the filter at the bottom of this
      // function drops them, the group empties, and no Personal heading renders today —
      // which is the outcome asked for. When My Children or Family Tree ships, the
      // section comes back on its own with the items that are NOT in the account menu.
      // Removing the group instead would have left those two with nowhere to appear and
      // nothing to say so.
      section: { label: 'Personal', icon: UserCircle },
      items: [
        { href: '/direct-lineage',  label: 'My Children',  icon: Users },
        { href: '/family-tree',     label: 'Family Tree',  icon: GitBranch },
      ],
    },
    {
      section: { label: 'Community', icon: UsersRound },
      items: [
        { href: '/chat',          label: 'Chat',             icon: MessageCircle },
        { href: '/announcements', label: 'Announcements',    icon: Megaphone },
        { href: '/members',       label: 'Directory',        icon: UsersRound },
      ],
    },
  ]

  groups.push({ section: { label: 'Events', icon: CalendarClock }, items: eventItems })

  groups.push({
    section: { label: 'Accounting', icon: Wallet },
    items: [
      { href: '/account-summary', label: 'Summary',           icon: Wallet },
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
 * So rows are plain text with a hover well, and only the active row is filled.
 *
 * THE ACTIVE FILL IS `--brand-legacy`, and it is gold because the rail is now Heritage.
 * It has been burgundy twice before, and both times for a rail that was a PALE surface:
 * `--brand-soft` while the rail was page-coloured (1.19 against the sand one — sand on
 * sand, gone), then `--brand-primary` when the rail became recessed muted sand (8.67,
 * correct at the time). Burgundy on burgundy is that same mistake a third time, so the
 * selected row takes the brand's signature pairing instead: `bg-brand-legacy` under
 * `text-brand-on-legacy`, which is Ink in BOTH themes and the one `on-` token that does
 * not flip. It is also exactly what the Golden Master draws.
 *
 * Worth being precise about what the original mistake was: not the hue, but that the
 * INACTIVE rows were filled too. One filled row among plain ones is a selection;
 * fourteen filled rows are wallpaper.
 *
 * THE PILL BLEEDS OFF THE LEFT EDGE — `-ml-3` cancels the nav's `p-3`, and the left
 * corners are square while the right ones are a full radius. That is the kit's own
 * treatment (`Sidebar.svg` draws it `x="0" width="218" rx="24"`, running off the
 * canvas), and it does a job beyond decoration: a pill that touches the rail's edge
 * reads as attached to the rail rather than floating on it, which is what separates a
 * selected destination from a button someone might press.
 *
 * BOTH BRANCHES SET AN EXPLICIT TEXT COLOUR, and neither may be dropped. `globals.css`
 * carries an unscoped `a { color: var(--brand-accent) }` in its base layer, so a nav link
 * without one comes out terracotta in light and GOLD in dark — the second of which would
 * be indistinguishable from the active pill. This is the trap documented in AGENTS.md and
 * commented at every other rail in the codebase.
 *
 * BOTH BRANCHES ALSO CARRY IDENTICAL BOX METRICS — same padding, same radii, same
 * negative margin — so selecting a row changes colours and never a size. Same reasoning
 * as MainRail's stacked variant, and the reason the old `transparent` left marker is
 * gone rather than merely recoloured: the gold fill IS the marker now.
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
        'group relative -ml-3 flex items-center gap-3 rounded-l-none rounded-r-full py-2 pl-7 pr-3 text-sm transition-colors',
        active
          ? 'bg-brand-legacy font-semibold text-brand-on-legacy shadow-sm'
          : 'text-brand-on-hero/75 hover:bg-brand-primary hover:text-brand-on-primary',
      )}
    >
      <Icon className={cn('h-4 w-4 shrink-0 transition-opacity', active ? 'opacity-100' : 'opacity-70 group-hover:opacity-100')} />
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
      <span className="flex shrink-0 items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.14em] text-brand-on-hero/70">
        <Icon className="h-3.5 w-3.5" /> {label}
      </span>
      {/* Legacy gold as a rule — a non-text accent, the one thing it may always be. */}
      <span aria-hidden="true" className="h-px flex-1 bg-gradient-to-r from-brand-legacy/60 to-transparent" />
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
        className="group mt-4 flex w-full items-center gap-2 rounded-lg px-3 py-1.5 transition-colors hover:bg-brand-primary/50"
      >
        <SectionLabel label={section.label} icon={Icon} />
        <ChevronDown
          className={cn(
            'h-3.5 w-3.5 shrink-0 text-brand-on-hero/50 transition-transform group-hover:text-brand-on-hero',
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
  //
  // Adjusted during render, not in an effect. React's documented pattern for "reset some
  // state when a prop changes": compare against the value the state was computed for and
  // set during render, which React handles by re-rendering before it commits anything. An
  // effect instead paints one frame with the previous route's sections still open and then
  // re-renders — the cascading render `react-hooks/set-state-in-effect` exists to stop.
  const [seenPathname, setSeenPathname] = useState(pathname)
  if (seenPathname !== pathname) {
    setSeenPathname(pathname)
    // Deliberately only /dashboard, matching the effect this replaced. Resetting on every
    // navigation would also be defensible — arguably more so, since a section that does not
    // contain the active route stays open today — but that is a behaviour change and does
    // not belong in a lint fix.
    if (AUTO_COLLAPSE_SECTIONS && pathname === '/dashboard') setOpenSections(new Set())
  }

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

/**
 * The brand block at the top of the rail — the multicolour mark over the wordmark.
 *
 * IT MOVED HERE FROM THE HEADER, and that is the Golden Master's whole top-left
 * composition: the kit places the mark at x=83..168, y=50..135 and the wordmark centred
 * beneath it at y=158, inside the burgundy. There is no header band in the master to put
 * it in.
 *
 * `BRAND_MARK_SRC`, not `BRAND_MARK_GOLD_SRC`. The gold mark exists for the Heritage
 * header bar that this change deletes; the master draws the full-colour mark here, and it
 * survives burgundy for the reason `lib/brand.ts` gives — it is stroked with the heart cut
 * out, so the ground shows through, and its gold, terracotta and olive strokes carry
 * against Heritage on their own.
 *
 * The wordmark is SET, not placed: `.gn-wordmark` reproduces the brand board's
 * letterspaced Cormorant caps in CSS, so it stays crisp at any size, recolours per theme
 * and is selectable. The kit draws it at 18px with 8 units of tracking; `text-lg` and the
 * class's own `0.18em` are that.
 *
 * A link to /dashboard, because a logo in the top-left corner of an app is one, and
 * removing the header removed the only other thing that was.
 */
function RailBrand() {
  return (
    <Link
      href="/dashboard"
      className="flex flex-col items-center gap-2 rounded-2xl px-3 pb-2 pt-4 transition-opacity hover:opacity-90"
    >
      <Image src={BRAND_MARK_SRC} alt="" aria-hidden="true" width={96} height={96} className="h-16 w-16" />
      <span className="gn-wordmark text-lg text-brand-on-hero">{APP_NAME}</span>
    </Link>
  )
}

/**
 * The desktop rail: brand, nav, motto, on Heritage.
 *
 * THE STICKY BLOCK NOW STARTS AT `top-0`. It used to be `top-[calc(4rem + 2px)]`, pinned
 * under a header that no longer exists — the rail runs to the top of the shell now and
 * carries the logo itself. Its cap moved with it, from `calc(100vh - 4rem - 2px)` to the
 * full viewport, for the same reason. That cap is what makes `overflow-y-auto` mean
 * anything: without a max-height the nav grows to its content and scrolls away with the
 * page instead of scrolling within itself.
 *
 * `relative` is SAFE for the two things that would otherwise break here: it does not
 * create a containing block for `fixed` (only transform/filter/will-change do — see
 * components/layout/header-panel.ts, which depends on that), and it does not disturb the
 * `sticky` block inside it.
 *
 * NO `overflow-hidden` ON THE ASIDE, ever. It would compute the sticky block's
 * `overflow-y` to `auto` and kill its stickiness.
 *
 * THE LOWER DECORATION IS NOT RENDERED HERE, and that is the substance of the kit's
 * PATCH 01. The olive hill runs from x=132 to x=664 in kit coordinates while the rail ends
 * at 258, so more than half of it belongs to the workspace — it is drawn from `<main>` in
 * app/(protected)/layout.tsx, where it can cross the boundary. Putting it back in this
 * element clips it, which is the bug the patch was issued to correct.
 *
 * The `border-r` is gone: burgundy against the page is a 6.6:1 edge on its own, and a sand
 * hairline over it read as a seam.
 */
export function Sidebar({ hasAssignments = false, viewable }: { hasAssignments?: boolean; viewable: string[] }) {
  const pathname = usePathname()
  const navGroups = buildNavGroups(hasAssignments, new Set(viewable))

  return (
    <aside className="relative hidden md:flex w-56 shrink-0 flex-col bg-brand-hero">
      {/* THE PADDING IS ASYMMETRIC, AND THE RIGHT NUMBER IS FROM THE KIT.
          `Sidebar.svg` draws the active pill as `x=0 width=218` on a canvas whose rail
          spans x=12..258 — so it covers 83.7% of the rail and leaves 16.3% clear on the
          right. At `w-56` that is a right edge at 188px with 36px of rail beside it.

          This was `p-3`, which put the right edge at 212px and left 12px. Three things
          were wrong with that at once: the pill read as almost-full-bleed rather than as
          a shape sitting on a rail, the row had no breathing room for the chevron on a
          collapsible section, and — the visible one — the inward swoosh at the top of the
          rail runs through the rightmost ~13px, so a 212px pill overlapped the bite and
          cut it off just where it is deepest.

          `pr-9` is 36px. The kit's motto card arrives at the same answer independently
          (`x=30..217`, a 37px right inset), which is the check that this is the rail's
          real margin and not one shape's quirk. `pl-3` stays, because NavLink cancels it
          with `-ml-3` to bleed the pill off the left edge exactly as the kit does. */}
      <div className="sticky top-0 z-10 flex max-h-screen flex-col overflow-y-auto overscroll-contain py-3 pl-3 pr-9">
        <RailBrand />
        <nav className="mt-4 flex flex-col">
          <NavTree groups={navGroups} pathname={pathname} />
        </nav>
        <RailMotto />
      </div>
    </aside>
  )
}

/**
 * The same nav as a drawer, plus the trigger that opens it — rendered by `TopBar` into
 * the left of the bar below `md`.
 *
 * WHY IT IS ITS OWN EXPORT. The trigger used to be a second sticky strip of its own,
 * pinned under the header at `z-20`, which meant a phone showed two horizontal bands
 * before any content. With the header gone there is one bar, and the trigger belongs in
 * it — so the component that owns `mobileOpen` has to be the one the bar renders. Lifting
 * the state into a context to keep the old split would have been more machinery for a
 * worse result.
 *
 * `Sidebar` above is now desktop-only and holds no state at all.
 */
export function MobileNav({ hasAssignments = false, viewable }: { hasAssignments?: boolean; viewable: string[] }) {
  const pathname = usePathname()
  const [mobileOpen, setMobileOpen] = useState(false)
  const navGroups = buildNavGroups(hasAssignments, new Set(viewable))

  // Close the drawer on navigation, during render rather than in an effect — same
  // reasoning as NavTree above. Every link in the drawer already calls setMobileOpen(false)
  // on click, so this is the backstop for a navigation the drawer did not initiate: a
  // redirect, a browser Back, or the idle timeout sending the member to /login.
  const [seenPathname, setSeenPathname] = useState(pathname)
  if (seenPathname !== pathname) {
    setSeenPathname(pathname)
    setMobileOpen(false)
  }

  return (
    <>
      <button
        onClick={() => setMobileOpen(true)}
        className="md:hidden flex items-center gap-2 rounded-full bg-brand-primary px-3 py-1.5 text-sm font-medium text-brand-on-primary transition-opacity hover:opacity-90"
        aria-label="Open navigation menu"
        aria-expanded={mobileOpen ? 'true' : 'false'}
      >
        <Menu className="h-4 w-4" />
        Menu
      </button>

      {mobileOpen && (
        <>
          {/* Above the bar (z-30), not below it: this is a modal drawer, and a backdrop
              that leaves the bar live lets someone sign out through the scrim they just
              tapped to dismiss. */}
          <div
            className="md:hidden fixed inset-0 bg-black/50 z-40"
            onClick={() => setMobileOpen(false)}
            aria-hidden="true"
          />
          {/* No `relative` needed and none wanted — `fixed` is already a positioned
              element, so RailFootDecor resolves against this box. Adding `relative` beside
              it would be two `position` declarations fighting over one element.
              `overflow-hidden` is forbidden here for the same reason as the desktop rail:
              the nav below scrolls. */}
          <div className="md:hidden fixed inset-y-0 left-0 w-64 bg-brand-hero z-50 flex flex-col">
            {/* The drawer leads with the same brand block the desktop rail does, so
                opening the menu on a phone lands somewhere that is recognisably the same
                rail rather than a plain strip that belongs to no product. */}
            <div className="shrink-0 flex items-start justify-between gap-2 pr-2">
              <RailBrand />
              <button
                onClick={() => setMobileOpen(false)}
                className="mt-4 rounded-lg p-1.5 text-brand-on-hero transition-colors hover:bg-brand-primary"
                aria-label="Close navigation menu"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            {/* Same asymmetric inset as the desktop rail, and for the first of the same
                three reasons — a pill that stops short of the edge reads as sitting on
                the rail. The drawer has no swoosh to protect, so this is proportion
                alone. */}
            <nav className="relative z-10 flex flex-col overflow-y-auto py-3 pl-3 pr-9">
              <NavTree groups={navGroups} pathname={pathname} onNavClick={() => setMobileOpen(false)} />
              <RailMotto />
            </nav>
            {/* The rail-windowed variant, not the shell one: a drawer is a 16rem panel
                with nothing beside it, so a hill drawn to run 400 units past the rail
                would simply be cut off at the panel's edge. */}
            <RailFootDecor />
          </div>
        </>
      )}
    </>
  )
}
