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
} from 'lucide-react'
import { cn } from '@/lib/utils'

const navItems = [
  { href: '/dashboard',       label: 'Dashboard',    icon: LayoutDashboard },
  { href: '/personal-info',   label: 'My Profile',   icon: UserCircle },
  { href: '/direct-lineage',  label: 'My Children',  icon: Users },
  { href: '/family-tree',     label: 'Family Tree',  icon: GitBranch },
  { href: '/events',          label: 'Upcoming Events', icon: Calendar },
  { href: '/account-summary', label: 'Account',      icon: Wallet },
  { href: '/chat',            label: 'Chat',          icon: MessageCircle },
]

const managementItems = [
  { href: '/admin/events', label: 'Events', icon: CalendarClock },
]

const adminItems = [
  { href: '/admin/users',        label: 'Users',                icon: UsersRound },
  { href: '/admin/user-roles',   label: 'User Roles',           icon: ShieldCheck },
  { href: '/admin/chapters',     label: 'Regions & Chapters',   icon: ShieldCheck },
  { href: '/admin/event-types',  label: 'Event Templates',      icon: ListChecks },
]

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

function SectionDivider({ label, icon: Icon }: { label: string; icon: React.ComponentType<{ className?: string }> }) {
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

function ManagementSection({ pathname, onNavClick }: { pathname: string; onNavClick?: () => void }) {
  return (
    <div>
      <SectionDivider label="Management" icon={CalendarClock} />
      <div className="flex flex-col gap-0.5">
        {managementItems.map(item => (
          <NavLink key={item.href} {...item} active={pathname.startsWith(item.href)} onClick={onNavClick} />
        ))}
      </div>
    </div>
  )
}

function AdminSection({ pathname, onNavClick }: { pathname: string; onNavClick?: () => void }) {
  return (
    <div>
      <SectionDivider label="Admin" icon={ShieldCheck} />
      <div className="flex flex-col gap-0.5">
        {adminItems.map(item => (
          <NavLink key={item.href} {...item} active={pathname.startsWith(item.href)} onClick={onNavClick} />
        ))}
      </div>
    </div>
  )
}

export function Sidebar({ isAdmin = false, hasAssignments = false }: { isAdmin?: boolean; hasAssignments?: boolean }) {
  const pathname = usePathname()
  const [mobileOpen, setMobileOpen] = useState(false)

  useEffect(() => {
    setMobileOpen(false)
  }, [pathname])

  return (
    <>
      {/* ── Desktop: sticky left panel ─────────────────────────────── */}
      <aside className="hidden md:flex w-56 shrink-0 flex-col border-r bg-background">
        <nav className="sticky top-0 flex flex-col gap-0.5 p-3 pt-6">
          {navItems.map(item => (
            <NavLink key={item.href} {...item} active={pathname === item.href} />
          ))}
          {hasAssignments && (
            <NavLink href="/event-planning" label="Event Planning" icon={ClipboardList} active={pathname === '/event-planning'} />
          )}
          {isAdmin && <ManagementSection pathname={pathname} />}
          {isAdmin && <AdminSection pathname={pathname} />}
        </nav>
      </aside>

      {/* ── Mobile: hamburger button ────────────────────────────────── */}
      <div className="md:hidden border-b bg-background shrink-0 flex items-center px-3 py-2">
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
            <nav className="flex flex-col gap-0.5 p-3 overflow-y-auto">
              {navItems.map(item => (
                <NavLink
                  key={item.href}
                  {...item}
                  active={pathname === item.href}
                  onClick={() => setMobileOpen(false)}
                />
              ))}
              {hasAssignments && (
                <NavLink href="/event-planning" label="Event Planning" icon={ClipboardList} active={pathname === '/event-planning'} onClick={() => setMobileOpen(false)} />
              )}
              {isAdmin && <ManagementSection pathname={pathname} onNavClick={() => setMobileOpen(false)} />}
              {isAdmin && <AdminSection pathname={pathname} onNavClick={() => setMobileOpen(false)} />}
            </nav>
          </div>
        </>
      )}
    </>
  )
}
