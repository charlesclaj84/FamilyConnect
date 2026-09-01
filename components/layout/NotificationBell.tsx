'use client'

import { useState, useEffect, useRef, useTransition } from 'react'
import { formatTimeAgo } from '@/lib/i18n/catalogues'
import { useLocale, useT } from '@/components/layout/LocaleProvider'
import { useRouter } from 'next/navigation'
import { Bell, UserCheck } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { markNotificationRead, markAllNotificationsRead, type Notification } from '@/app/actions/notifications'
import type { PendingQueue } from '@/app/actions/admin/approvals'
import { switchActiveFamily } from '@/app/actions/family'
import {
  HEADER_PANEL_CLASS, HEADER_PANEL_SCRIM_CLASS, useCloseOnNavigate,
} from '@/components/layout/header-panel'
import { useDismissWhenIdle } from '@/lib/use-dismiss-when-idle'
import { timeAgo } from '@/lib/date-utils'
import { cn } from '@/lib/utils'

interface Props {
  initialNotifications: Notification[]
  /**
   * The caller's people row in the ACTIVE family — their notification feed, and the
   * filter the real-time subscription runs on.
   *
   * EMPTY IS A REAL VALUE, not a bug: the bell also renders for somebody who is pending
   * in the family they are viewing but holds an approvals queue in another (see
   * `showBell` in TopBar). They have no feed here and no subscription is opened.
   */
  personId: string
  /**
   * Every family with somebody waiting on a decision the caller can make — one entry per
   * family, and the ones they are NOT currently viewing included, which is the whole
   * point of the shape.
   *
   * Already empty for a caller who cannot work any queue: TopBar resolves the grant per
   * family, server-side, and never computes a count for a family they cannot work — so
   * this component does not re-check it and could not, holding only counts and names.
   */
  pendingQueues?: PendingQueue[]
}

export function NotificationBell({ initialNotifications, personId, pendingQueues = [] }: Props) {
  const t = useT()
  const locale = useLocale()
  const router = useRouter()
  const [notifications, setNotifications] = useState(initialNotifications)
  const [open, setOpen] = useState(false)
  const [isPending, startTransition] = useTransition()
  const [switchError, setSwitchError] = useState('')
  const trigger = useRef<HTMLButtonElement>(null)
  const panel = useRef<HTMLDivElement>(null)

  // Same reason as the account menu: this panel outlives the page it was opened over,
  // because TopBar is rendered by the layout and never unmounts. See the hook.
  useCloseOnNavigate(open, () => setOpen(false))

  // And closes itself a few seconds after being walked away from. This is the panel that
  // earns it most: left open it is a list of who has asked to join which family, sitting
  // over whatever page the member went on to read.
  useDismissWhenIdle({
    open,
    close: () => setOpen(false),
    parts: () => [trigger.current, panel.current],
  })

  // STANDING ITEMS, not notifications, and the difference is load-bearing in three
  // places below. They have no row in `notifications`, so they cannot be marked read, are
  // not cleared by "Mark all read", and do not arrive over the real-time subscription.
  // Each is a live count of one family's queue: a row disappears when that queue is
  // empty, which is the only way a derived item can be "dismissed".
  //
  // ONE ROW PER FAMILY, since 2026-08-14. It was a single number for the family being
  // viewed, which is what made a queue in a SECOND family unreachable — the notification
  // was written and the badge counted somewhere else. An administrator of two families
  // now sees both without having to suspect there is something to look for.
  const queues = pendingQueues.filter(q => q.count > 0)

  // Two numbers, deliberately. `unreadNotifications` is what "Mark all read" can
  // actually clear; the badge also counts the standing items, which that button cannot
  // touch. Driving both from one number would put a "Mark all read" link above a panel
  // whose only entries are approvals rows, where pressing it changes nothing.
  const unreadNotifications = notifications.filter(n => !n.read_at).length

  // ONE PER FAMILY, not the sum of the counts. The badge says how many rows in the panel
  // want looking at, and each family is one row — the number of people in it is in that
  // row's own caption. Adding 3 to the badge for a single line reading "… — 3" would make
  // the badge disagree with what opening it shows.
  const badgeCount = unreadNotifications + queues.length

  // Real-time subscription. Skipped entirely without a feed to subscribe to — see
  // `personId` above; a `recipient_id=eq.` filter with nothing after it would be a
  // subscription to somebody else's inserts or to none.
  //
  // ── IT ONLY STARTED RECEIVING ANYTHING ON 2026-08-21 ──────────────────────────────
  // `postgres_changes` reads the WAL through the `supabase_realtime` PUBLICATION, and that
  // publication held ZERO tables. So this subscribed successfully and was fed nothing, from
  // the day it shipped. `20260821000002` is what publishes the table, and `npm run
  // realtime:check` is what proves an event arrives — a migration can only assert membership.
  //
  // The reason nobody noticed is worth knowing before trusting this hook: `getNotifications`
  // is server-rendered by `TopBar` on EVERY page load, so the bell refreshes on navigation
  // whether or not this fires. The feature degraded to something that looks slow rather than
  // to something visibly broken, which is what a fallback buys you and what it hides.
  //
  // THE `filter` IS NOT THE BOUNDARY. Realtime evaluates this table's SELECT policy as the
  // subscribing role, and that is what keeps another member's notification off this socket —
  // measured with an UNFILTERED subscription by the check script above. The filter is a
  // bandwidth decision.
  useEffect(() => {
    if (!personId) return
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

  /**
   * Open a queue that belongs to a family the caller is not currently in.
   *
   * The switch has to land BEFORE the navigation, and it has to land server-side: every
   * page under /admin resolves its family from the caller's active membership, so
   * navigating first would render the queue of the family they were already in. Hence
   * `switchActiveFamily` — the same membership-checking RPC FamilySwitcher uses, which
   * cannot be pointed at a family the caller does not belong to — and only then the push.
   *
   * `router.push`, not `router.refresh`: this is a destination, not a state change to
   * re-read in place.
   */
  function openQueue(queue: PendingQueue) {
    if (queue.isActive) return
    setSwitchError('')
    startTransition(async () => {
      const result = await switchActiveFamily(queue.familyCode)
      if (!result.success) {
        setSwitchError(result.message)
        return
      }
      setOpen(false)
      router.push(APPROVALS_HREF)
    })
  }

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
        ref={trigger}
        onClick={() => setOpen(o => !o)}
        // ON CREAM NOW, not on the Heritage band. The bar this sits in stopped being a
        // burgundy header when the Golden Master's shell landed — the brand moved into
        // the rail — so `text-brand-on-hero` here would be sand on cream, i.e. gone.
        // `--brand-ink` is the strong brand text role and the sand well is the same
        // resting surface the account menu beside it hovers to.
        className="relative rounded-lg p-1.5 text-brand-ink transition-colors hover:bg-brand-soft/60"
        aria-label={t('bell.label')}
      >
        <Bell className="h-5 w-5" />
        {badgeCount > 0 && (
          <span className="absolute -top-0.5 -end-0.5 h-4 w-4 rounded-full bg-destructive text-destructive-foreground text-[10px] font-bold flex items-center justify-center">
            {badgeCount > 9 ? '9+' : badgeCount}
          </span>
        )}
      </button>

      {open && (
        <>
          <div className={HEADER_PANEL_SCRIM_CLASS} onClick={() => setOpen(false)} aria-hidden="true" />
          {/* Was a flat `w-80` anchored `end-0` to the bell. The bell sits ~110px in
              from the right edge, so on a 375px screen those 320px started 55px off the
              left of the display and the first half of every notification was gone. It
              is a full-width sheet under the header below sm now; see header-panel.ts. */}
          <div ref={panel} className={cn(HEADER_PANEL_CLASS, 'sm:w-80')}>
            <div className="flex shrink-0 items-center justify-between px-4 py-3 border-b">
              <span className="font-semibold text-sm">{t('bell.heading')}</span>
              {unreadNotifications > 0 && (
                <button
                  onClick={handleMarkAllRead}
                  disabled={isPending}
                  className="text-xs text-primary hover:underline"
                >
                  {t('bell.markAll')}
                </button>
              )}
            </div>

            {notifications.length === 0 && queues.length === 0 ? (
              <div className="px-4 py-8 text-center text-sm text-muted-foreground">
                {t('bell.empty')}
              </div>
            ) : (
              /* The panel owns the height cap now (header-panel.ts), so the list takes
                 whatever is left rather than carrying its own max-h — a fixed max-h-96
                 inside a shorter panel would have scrolled the sticky header out of
                 reach on a small screen. */
              <ul className="min-h-0 flex-1 divide-y overflow-y-auto overscroll-contain">
                {/* Pinned above the feed rather than sorted into it: these have no
                    timestamp to sort by, and they are the only rows here that are a job
                    rather than a record of something that happened.

                    THE ACTIVE FAMILY'S ROW IS A REAL <a> and the others are buttons, and
                    that split is not cosmetic. Every page under /admin resolves its family
                    from the caller's ACTIVE membership, so a link straight to the queue
                    would render the family they are already in whatever row they clicked.
                    The others have to switch first, server-side, and only then navigate —
                    see openQueue. The one that needs no switch keeps its href, so
                    cmd-click and copy-link-address still work where they can. */}
                {queues.map(queue => {
                  const caption = t(queue.count === 1
                    ? 'notify.waitingApprovalOne'
                    : 'notify.waitingApprovalMany', { n: String(queue.count) })
                  const body = (
                    <>
                      <UserCheck className="mt-0.5 h-3.5 w-3.5 shrink-0 text-brand-accent" />
                      <div className="min-w-0">
                        <p className="truncate text-xs font-medium leading-snug text-brand-on-soft">
                          {queue.familyName}
                        </p>
                        <p className="mt-1 text-[10px] text-brand-on-soft/80">
                          {caption}
                          {/* Said out loud, because taking this row will move the whole
                              app to another family — which is a bigger thing than opening
                              a page and should never happen unannounced. */}
                          {!queue.isActive && ' · switches family'}
                        </p>
                      </div>
                    </>
                  )
                  return (
                    <li key={queue.familyCode}>
                      {queue.isActive ? (
                        <a
                          href={APPROVALS_HREF}
                          onClick={() => setOpen(false)}
                          className="flex items-start gap-2 bg-brand-soft px-4 py-3 transition-colors hover:bg-muted/50"
                        >
                          {body}
                        </a>
                      ) : (
                        <button
                          type="button"
                          onClick={() => openQueue(queue)}
                          disabled={isPending}
                          className="flex w-full items-start gap-2 bg-brand-soft px-4 py-3 text-start transition-colors hover:bg-muted/50 disabled:opacity-60"
                        >
                          {body}
                        </button>
                      )}
                    </li>
                  )
                })}
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
                      <div className={!n.read_at ? '' : 'ps-3.5'}>
                        <p className="text-xs font-medium leading-snug">{n.title}</p>
                        {n.body && <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{n.body}</p>}
                        <p className="text-[10px] text-muted-foreground/60 mt-1">{formatTimeAgo(timeAgo(n.created_at), locale)}</p>
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            )}
            {/* NOT `FormError`, for the reason FamilySwitcher gives at the identical
                position: this is the panel's own footer — full-bleed, ruled off the list
                above it and `shrink-0` inside the panel's flex column — while the shared
                component is an inset alert with its own radius and border, which inside a
                bordered dropdown reads as a box in a box. The only failure that can appear
                here is a refused family switch. */}
            {switchError && (
              <p role="alert" className="shrink-0 border-t bg-destructive/10 px-4 py-2 text-xs text-destructive">
                {switchError}
              </p>
            )}
          </div>
        </>
      )}
    </div>
  )
}

/**
 * Where an approvals row goes. `/admin/members?tab=approvals` and not `/admin/members/approvals`,
 * which is now only a redirect — the queue is a tab on Members & Access. One copy, shared
 * by the link and the switch-then-push branch, and matching the `link` that
 * lib/notifications.ts writes onto the notification rows for the same queue.
 */
const APPROVALS_HREF = '/admin/members?tab=approvals'
