'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  LayoutDashboard,
  UserCircle,
  Users,
  GitBranch,
  Wallet,
  MessageCircle,
} from 'lucide-react'
import { cn } from '@/lib/utils'

const navItems = [
  { href: '/dashboard',       label: 'Dashboard',    icon: LayoutDashboard },
  { href: '/personal-info',   label: 'My Profile',   icon: UserCircle },
  { href: '/direct-lineage',  label: 'My Children',  icon: Users },
  { href: '/family-tree',     label: 'Family Tree',  icon: GitBranch },
  { href: '/account-summary', label: 'Account',      icon: Wallet },
  { href: '/chat',            label: 'Chat',          icon: MessageCircle },
]

function NavLink({ href, label, icon: Icon, active }: (typeof navItems)[number] & { active: boolean }) {
  return (
    <Link
      href={href}
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

export function Sidebar() {
  const pathname = usePathname()

  return (
    <>
      {/* ── Desktop: sticky left panel ─────────────────────────────── */}
      <aside className="hidden md:flex w-56 shrink-0 flex-col border-r bg-background">
        <nav className="sticky top-0 flex flex-col gap-0.5 p-3 pt-6">
          {navItems.map(item => (
            <NavLink key={item.href} {...item} active={pathname === item.href} />
          ))}
        </nav>
      </aside>

      {/* ── Mobile: horizontal scrolling strip ─────────────────────── */}
      <div className="md:hidden border-b bg-background overflow-x-auto shrink-0">
        <nav className="flex gap-1 px-3 py-2 min-w-max">
          {navItems.map(({ href, label, icon: Icon }) => (
            <Link
              key={href}
              href={href}
              className={cn(
                'flex items-center gap-2 rounded-lg px-3 py-1.5 text-sm transition-colors whitespace-nowrap',
                pathname === href
                  ? 'bg-[#0f2540] text-[#e6ecf1] font-medium'
                  : 'bg-[#e6ecfa] text-[#0f2540] hover:opacity-90',
              )}
            >
              <Icon className="h-3.5 w-3.5 shrink-0" />
              {label}
            </Link>
          ))}
        </nav>
      </div>
    </>
  )
}
