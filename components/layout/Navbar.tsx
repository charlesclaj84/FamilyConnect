import Image from 'next/image'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { SignOutButton } from '@/components/auth/SignOutButton'
import { NotificationBell } from '@/components/layout/NotificationBell'
import { FamilySwitcher } from '@/components/layout/FamilySwitcher'
import { getNotifications } from '@/app/actions/notifications'
import { getPendingApprovalCount } from '@/app/actions/admin/approvals'
import { getMyFamilies } from '@/lib/auth/family'
import { ThemeToggle } from '@/components/layout/ThemeToggle'
import { APP_NAME, APP_LOGO_ALT, BRAND_MARK_SRC } from '@/lib/brand'

export default async function Navbar() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  // Fetch notifications + memberships (non-fatal if user not fully set up).
  // personId must come from the ACTIVE family's people row — a multi-family user
  // has one row per family, and the real-time notification filter is per row.
  let notifications: Awaited<ReturnType<typeof getNotifications>> = []
  let personId = ''
  let families: Awaited<ReturnType<typeof getMyFamilies>> = []
  // The approvals queue depth, for the bell's standing "Members Pending Approval" row.
  // getPendingApprovalCount() runs requireRead('admin/approvals') itself and returns 0
  // without it, so a member who cannot work the queue never has the number computed and
  // never receives it — the count is a fetch that is gated, not a row that is hidden
  // (AGENTS.md §5). It is a COUNT, so nothing about any applicant crosses the boundary
  // even for someone who can see it.
  let pendingApprovals = 0
  if (user) {
    const [notifResult, familyResult, pendingResult] = await Promise.all([
      getNotifications(),
      getMyFamilies(user.id),
      getPendingApprovalCount(),
    ])
    notifications = notifResult
    families = familyResult
    pendingApprovals = pendingResult

    // The bell renders only for an APPROVED membership. `personId` is what gates it,
    // and it is also what NotificationBell subscribes to for real-time inserts, so
    // leaving it blank suppresses both the panel and the subscription in one place.
    //
    // Notifications a pending member DOES have — "you have been approved", "your
    // request was declined" — are still written and still there; they simply arrive
    // with the access that makes the rest of the bell's contents readable. What is
    // being avoided is a bell offering links into pages that 404, next to an
    // awaiting-approval screen.
    //
    // FamilySwitcher above is deliberately NOT suppressed: it is how a multi-family
    // account gets back out of the family it is waiting on, and hiding it would strand
    // them on the pending screen with no navigation at all.
    const active = families.find(f => f.isActive)
    personId = active?.status === 'approved' ? active.personId : ''
  }

  return (
    <header className="border-b bg-brand-bar sticky top-0 z-10">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-2">
        {/* The wordmark is hidden below sm. On a 375px screen it, the logo, the family
            switcher, the bell and Sign Out do not fit on one row, and what gave way was
            the switcher — squeezed to a few characters and an ellipsis. The wordmark is
            the cheapest thing to drop because the logo keeps the brand present and its
            alt text still carries the name; note the mark itself is wordless, so on a
            phone the name is announced but not seen. */}
        <Link href="/dashboard" className="flex min-w-0 shrink items-center gap-2.5">
          <Image src={BRAND_MARK_SRC} alt={APP_LOGO_ALT} width={40} height={40} className="h-9 w-9 shrink-0" />
          <span className="gn-wordmark hidden truncate text-xl text-brand-ink sm:block">{APP_NAME}</span>
        </Link>
        <div className="flex min-w-0 shrink-0 items-center gap-1.5 sm:gap-2.5">
          <FamilySwitcher families={families} />
          <ThemeToggle />
          {personId && (
            <NotificationBell
              initialNotifications={notifications}
              personId={personId}
              pendingApprovals={pendingApprovals}
            />
          )}
          <SignOutButton />
        </div>
      </div>
    </header>
  )
}
