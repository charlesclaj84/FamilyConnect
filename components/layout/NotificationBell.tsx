'use client'

import { useState, useEffect, useTransition } from 'react'
import { Bell, UserCheck } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { markNotificationRead, markAllNotificationsRead, type Notification } from '@/app/actions/notifications'
import { HEADER_PANEL_CLASS, HEADER_PANEL_SCRIM_CLASS } from '@/components/layout/header-panel'
import { formatDate } from '@/lib/date-utils'
import { cn } from '@/lib/utils'

interface Props {
  initialNotifications: Notification[]
  personId: string
  /**
   * How many people are waiting on a membership decision. Already 0 for a caller who
   * cannot work the approvals queue — the navbar resolves the grant server-side and
   * never computes it for anyone else, so this component does not re-check it.
   */
  pendingApprovals?: number
}

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return 'Just now'
  if (mins < 60) return `${mins}m ago`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `${hours}h ago`
  return formatDate(iso) ?? ''
}

export function NotificationBell({ initialNotifications, personId, pendingApprovals = 0 }: Props) {
  const [notifications, setNotifications] = useState(initialNotifications)
  const [open, setOpen] = useState(false)
  const [isPending, startTransition] = useTransition()

  // A STANDING ITEM, not a notification, and the difference is load-bearing in three
  // places below. It has no row in `notifications`, so it cannot be marked read, is not
  // cleared by "Mark all read", and does not arrive over the real-time subscription. It
  // is a live count of the queue: it disappears when the queue is empty, which is the
  // only way a derived item can be "dismissed".
  const showApprovals = pendingApprovals > 0

  // Two numbers, deliberately. `unreadNotifications` is what "Mark all read" can
  // actually clear; the badge also counts the standing item, which that button cannot
  // touch. Driving both from one number would put a "Mark all read" link above a panel
  // whose only entry is the approvals row, where pressing it changes nothing.
  const unreadNotifications = notifications.filter(n => !n.read_at).length

  // Counted as ONE, not as `pendingApprovals`. The badge says how many rows in the panel
  // want looking at, and this is one row — the count it carries is in its own caption.
  // Adding 3 to the badge for a single line reading "… - 3" would make the badge
  // disagree with what opening it shows.
  const badgeCount = unreadNotifications + (showApprovals ? 1 : 0)

  // Real-time subscription
  useEffect(() => {
    const supabase = createClient()
    const channel = supabase
      .channel(`notifications:${personId}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'notifications', filter: `recipient_id=eq.${personId}` },
        payload => {
          const n = payload.new as Notification
          setNotifications(prev => [n, ...prev].slice(0, 30))
        }
      )
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [personId])

  function handleMarkRead(id: string) {
    setNotifications(prev => prev.map(n => n.id === id ? { ...n, read_at: new Date().toISOString() } : n))
    startTransition(async () => { await markNotificationRead(id) })
  }

  function handleMarkAllRead() {
    setNotifications(prev => prev.map(n => ({ ...n, read_at: n.read_at ?? new Date().toISOString() })))
    startTransition(async () => { await markAllNotificationsRead() })
  }

  return (
    <div className="relative">
      <button
        onClick={() => setOpen(o => !o)}
        // Sits on the Heritage band — see the note at the top of Navbar. `hover:bg-
        // foreground/10` was a generic-ramp wash that read as grey smudge on burgundy;
        // --brand-primary is the band's own lighter sibling, so the well reads as a lift.
        className="relative rounded-lg p-1.5 text-brand-on-hero transition-colors hover:bg-brand-primary"
        aria-label="Notifications"
      >
        <Bell className="h-5 w-5" />
        {badgeCount > 0 && (
          <span className="absolute -top-0.5 -right-0.5 h-4 w-4 rounded-full bg-destructive text-white text-[10px] font-bold flex items-center justify-center">
            {badgeCount > 9 ? '9+' : badgeCount}
          </span>
        )}
      </button>

      {open && (
        <>
          <div className={HEADER_PANEL_SCRIM_CLASS} onClick={() => setOpen(false)} aria-hidden="true" />
          {/* Was a flat `w-80` anchored `right-0` to the bell. The bell sits ~110px in
              from the right edge, so on a 375px screen those 320px started 55px off the
              left of the display and the first half of every notification was gone. It
              is a full-width sheet under the header below sm now; see header-panel.ts. */}
          <div className={cn(HEADER_PANEL_CLASS, 'sm:w-80')}>
            <div className="flex shrink-0 items-center justify-between px-4 py-3 border-b">
              <span className="font-semibold text-sm">Notifications</span>
              {unreadNotifications > 0 && (
                <button
                  onClick={handleMarkAllRead}
                  disabled={isPending}
                  className="text-xs text-primary hover:underline"
                >
                  Mark all read
                </button>
              )}
            </div>

            {notifications.length === 0 && !showApprovals ? (
              <div className="px-4 py-8 text-center text-sm text-muted-foreground">
                No notifications yet.
              </div>
            ) : (
              /* The panel owns the height cap now (header-panel.ts), so the list takes
                 whatever is left rather than carrying its own max-h — a fixed max-h-96
                 inside a shorter panel would have scrolled the sticky header out of
                 reach on a small screen. */
              <ul className="min-h-0 flex-1 divide-y overflow-y-auto overscroll-contain">
                {/* Pinned above the feed rather than sorted into it: it has no
                    timestamp to sort by, and it is the one row here that is a job
                    rather than a record of something that happened. A real <a> so
                    cmd-click and copy-link-address work — the rest of the list has no
                    href to give, which is why it is still a click handler. */}
                {showApprovals && (
                  <li>
                    <a
                      href="/admin/approvals"
                      onClick={() => setOpen(false)}
                      className="flex items-start gap-2 px-4 py-3 hover:bg-muted/50 transition-colors bg-amber-50/60"
                    >
                      <UserCheck className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-700" />
                      <div>
                        <p className="text-xs font-medium leading-snug text-amber-900">
                          Members Pending Approval - {pendingApprovals}
                        </p>
                        <p className="text-[10px] text-amber-900/70 mt-1">
                          Review {pendingApprovals === 1 ? 'the request' : 'the requests'}
                        </p>
                      </div>
                    </a>
                  </li>
                )}
                {notifications.map(n => (
                  <li
                    key={n.id}
                    className={`px-4 py-3 cursor-pointer hover:bg-muted/50 transition-colors ${!n.read_at ? 'bg-primary/5' : ''}`}
                    onClick={() => {
                      handleMarkRead(n.id)
                      if (n.link) { window.location.href = n.link; setOpen(false) }
                    }}
                  >
                    <div className="flex items-start gap-2">
                      {!n.read_at && <span className="mt-1.5 shrink-0 h-1.5 w-1.5 rounded-full bg-primary" />}
                      <div className={!n.read_at ? '' : 'pl-3.5'}>
                        <p className="text-xs font-medium leading-snug">{n.title}</p>
                        {n.body && <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{n.body}</p>}
                        <p className="text-[10px] text-muted-foreground/60 mt-1">{timeAgo(n.created_at)}</p>
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </>
      )}
    </div>
  )
}
