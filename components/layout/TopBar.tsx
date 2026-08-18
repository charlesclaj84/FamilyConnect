import { createClient } from '@/lib/supabase/server'
import { NotificationBell } from '@/components/layout/NotificationBell'
import { FamilySwitcher } from '@/components/layout/FamilySwitcher'
import { AccountMenu } from '@/components/layout/AccountMenu'
import { MobileNav } from '@/components/layout/Sidebar'
import { ContextHelpLink } from '@/components/help/ContextHelpLink'
import { HELP_ROUTE_INDEX } from '@/lib/help/routes'
import { getNotifications } from '@/app/actions/notifications'
import { getPendingApprovalQueues } from '@/app/actions/admin/approvals'
import { getMyFamilies, getMyFamilyCode } from '@/lib/auth/family'
import { createAdminClient } from '@/lib/supabase/admin'
import { PAGE_MEASURE } from '@/components/layout/PageShell'
import { cn } from '@/lib/utils'

/**
 * The controls at the top of the workspace — and, as of the Golden Master, NOT a header
 * band.
 *
 * WHAT CHANGED AND WHY IT IS STRUCTURAL. This was `Navbar`: a full-width `bg-brand-hero`
 * bar across the top of the app carrying the mark and wordmark on the left and four
 * controls on the right. The Golden Master has no such bar. The brand lives in the RAIL —
 * mark and wordmark at its top, where a member's eye lands first — and the workspace
 * simply begins, with its controls floating at the top right of the cream.
 *
 * That is not a smaller header, it is one fewer horizontal band. The old arrangement
 * charged every page a 4rem burgundy strip to say the product's name a second time, on
 * the one screen where the name is least in doubt.
 *
 * THREE THINGS ABOUT HOW IT IS BUILT.
 *
 *   * **It lives INSIDE `<main>`, not above the row.** That is what lets the rail run to
 *     the top of the shell with the logo in it, and it is why the bar's container is
 *     `PAGE_MEASURE` — the same element `PageShell` builds its pages on, so the controls
 *     align with the right edge of the page's own content instead of the viewport's. That
 *     was three hand-matched copies of `max-w-6xl px-4 sm:px-6` until 2026-08-13; it is
 *     now imported, because the whole value of the number is that three files agree on it.
 *   * **It is `h-16`, and that number is load-bearing in three other files.**
 *     `ChatShell`'s `h-[calc(100vh-4rem)]` and `header-panel.ts`'s `top-[4.25rem]` both
 *     measure against it. Keeping 4rem is why removing an entire band cost no arithmetic
 *     anywhere else. If it ever changes, those two change with it — and the Sidebar's
 *     sticky offsets no longer do, because the rail now starts at the top of the viewport
 *     rather than underneath a header.
 *   * **`bg-background`, never a translucent blur.** A `backdrop-filter` would create a
 *     containing block for `position: fixed`, and both panels that hang off this bar
 *     resolve `fixed` against the viewport through it (see header-panel.ts). Frosted
 *     glass here would drop them behind the page on a phone.
 *
 * THERE IS NO SEARCH ICON, and the Golden Master draws one. Nothing in the app searches
 * across families, events and documents; the only search that exists is the filter box on
 * Member Directory, which is on that page. A magnifier in the permanent chrome that opens
 * nothing is the same dead affordance the dashboard refuses everywhere else — when a real
 * search ships, this is where it goes.
 */
export default async function TopBar({
  hasAssignments,
  viewable,
  isStaff = false,
}: {
  hasAssignments: boolean
  viewable: string[]
  /**
   * Whether this account may open the GENORRA staff console. Passed straight through to
   * `AccountMenu`, which renders the one link that leads there.
   *
   * RESOLVED IN THE LAYOUT, not here, although this component already reads the session.
   * The layout is where every other shell-wide fact about the caller is resolved, and
   * putting the staff read beside those keeps it inside the same `Promise.all` and the
   * same memoized request. This component only carries it the last hop.
   *
   * It defaults to false, so a caller that has not thought about it withholds the link
   * rather than publishing it — the fail-closed direction for a boolean whose true value
   * reveals that a cross-family console exists.
   */
  isStaff?: boolean
}) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  let notifications: Awaited<ReturnType<typeof getNotifications>> = []
  let personId = ''
  let families: Awaited<ReturnType<typeof getMyFamilies>> = []
  // The approvals queue depth, for the bell's standing "waiting for approval" rows —
  // one per family the caller can work, INCLUDING the ones they are not looking at.
  //
  // It was `getPendingApprovalCount()`, the active family only, and that is what made a
  // pending applicant in a second family invisible to the person who could admit them:
  // the notification existed and the badge counted a different family's queue. See the
  // header on getPendingApprovalQueues.
  //
  // Still gated, and gated per family: the action resolves admin/approvals:view in each
  // one and never computes a count for a family the caller cannot work, so this is a
  // fetch that is withheld rather than a row that is hidden (AGENTS.md §5). Counts and
  // family names only — nothing about any applicant crosses the boundary.
  let pendingQueues: Awaited<ReturnType<typeof getPendingApprovalQueues>> = []
  let name = ''
  let initials = ''
  let avatarUrl: string | null = null

  if (user) {
    const familyCode = await getMyFamilyCode(user.id)
    const [notifResult, familyResult, pendingResult, personResult] = await Promise.all([
      getNotifications(),
      getMyFamilies(user.id),
      getPendingApprovalQueues(),
      // The caller's own row in the ACTIVE family, for the portrait. Admin client because
      // a pending member has no `auth_person_id()` and would read nothing through RLS —
      // and they still have a face and a name. Scoped by family_code AND user_id, which
      // is the whole of §3's obligation here: it can only ever return the caller's own row.
      createAdminClient()
        .from('people')
        .select('first_name, last_name, avatar_url')
        .eq('user_id', user.id)
        .eq('family_code', familyCode)
        .maybeSingle(),
    ])
    notifications = notifResult
    families = familyResult
    pendingQueues = pendingResult

    const person = personResult.data as { first_name: string | null; last_name: string | null; avatar_url: string | null } | null
    const first = person?.first_name ?? user.user_metadata?.first_name ?? ''
    const last = person?.last_name ?? user.user_metadata?.last_name ?? ''
    avatarUrl = person?.avatar_url ?? null
    name = [first, last].filter(Boolean).join(' ') || (user.email?.split('@')[0] ?? 'Member')
    initials = [first[0], last[0]].filter(Boolean).join('').toUpperCase()
      || (user.email?.[0] ?? '?').toUpperCase()

    // `personId` is the caller's own feed in the ACTIVE family: it gates the notification
    // list and it is what NotificationBell subscribes to for real-time inserts, so leaving
    // it blank suppresses both the panel's feed and the subscription in one place. A
    // non-approved membership gets nothing — the database would refuse the reads anyway,
    // and the bell is deliberately not the one thing that reaches a pending member.
    //
    // FamilySwitcher is deliberately NOT suppressed: it is how a multi-family account gets
    // back out of the family it is waiting on, and hiding it would strand them on the
    // pending screen with no navigation at all.
    const active = families.find(f => f.isActive)
    personId = active?.status === 'approved' ? active.personId : ''
  }

  // WHETHER THE BELL RENDERS AT ALL is no longer just `personId`, and the case that
  // changed it is the same one this whole change is about: somebody PENDING in the family
  // they are viewing who is an approved administrator of another. Their feed is empty and
  // must stay empty, but a queue in the other family is genuinely theirs to work — and
  // gating the bell on the active membership alone hid it behind the one screen that
  // cannot show it.
  const showBell = Boolean(personId) || pendingQueues.length > 0

  // ── THE STACKING ORDER, in one place ─────────────────────────────────────
  // A positioned element with a z-index starts its OWN stacking context, and every
  // z-index inside it is then scoped to that context — it competes with this bar as a
  // whole, never with this bar's children individually.
  //
  //   30  THIS bar, the auth/landing headers, and everything inside them
  //   40  Sidebar drawer backdrop          (covers the bar — it is modal)
  //   50  Sidebar drawer, Dialog, RowMenu, lightbox
  //  100  ConfirmDialog                    (may open on top of a Dialog)
  //
  // The old level 20 is gone with the Sidebar's separate mobile strip: the drawer trigger
  // lives in this bar now, so there is no second sticky element under it to rank against.
  return (
    <header className="sticky top-0 z-30 bg-background">
      <div className={cn(PAGE_MEASURE, 'flex h-16 items-center gap-2')}>
        {/* Left: the drawer trigger, below md only. */}
        <MobileNav hasAssignments={hasAssignments} viewable={viewable} />

        {/* `ml-auto`, NOT `justify-between` on the parent. The trigger beside this is
            `md:hidden`, and a `display: none` flex child is removed from layout entirely —
            so on a wide screen `justify-between` had one item to distribute and parked it
            at the START. The controls sat top-LEFT of the workspace, which is the one
            place the Golden Master does not put them. Pushing from this element instead
            is correct whether or not the trigger is there.

            THE ORDER, right to left, is by how often a control is reached for. The account
            portrait keeps the corner — it is the anchor everything else is measured from,
            and moving it is the one change a member would notice on every page. The bell is
            next, because it is the control something happens IN. Help is leftmost of the
            three, being the rarest: it is the thing somebody goes looking for once, on the
            one screen they did not understand, and putting it on the corner would spend the
            most valuable position in the bar on the least-used destination. The family
            switcher sits outside all of that, first, because for most accounts it renders
            nothing at all. */}
        <div className="ml-auto flex min-w-0 shrink-0 items-center gap-1.5 sm:gap-2">
          {/* Renders NOTHING for a single-family account, which is most of them — and is
              why this bar matches the Golden Master's three controls for most people
              while still giving a multi-family member the one piece of state they cannot
              afford to have hidden. */}
          <FamilySwitcher families={families} />
          {/* The chapter about the screen the member is on, or nothing at all when no
              chapter covers it (see the component — it degrades to nothing, never to a
              broken link).

              NO `key`, unlike the bell below. It holds no family data and no state of any
              kind — `usePathname()` is all it reads, and the answer is the same for every
              member of every family — so neither the `key={familyCode}` rule nor
              `ShellWatcher` has anything to do with it.

              THE INDEX IS RESOLVED HERE, on the server, and handed down. It derives from
              `lib/help/content.ts`, which is the whole manual; importing it from the client
              component would ship ~79KB of prose to the browser on every page. */}
          <ContextHelpLink entries={HELP_ROUTE_INDEX} />
          {showBell && (
            // KEYED, for the reason the <main> in app/(protected)/layout.tsx is keyed: a
            // family switch is a `router.refresh()`, which merges new server props without
            // discarding client state, and this bell holds `initialNotifications` in plain
            // `useState`. It sits inside main now but OUTSIDE the keyed subtree, because
            // the key is on <main> itself and this is rendered by the layout, so it still
            // needs its own.
            //
            // `personId` rather than the family code because it is already the per-family
            // value here and it is what the bell's real-time subscription filters on. The
            // fallback covers the one case where the bell renders WITHOUT one — see
            // `showBell` — and is a constant rather than the family code on purpose: there
            // is no feed to remount, only the standing rows, which are props.
            <NotificationBell
              key={personId || 'no-feed'}
              initialNotifications={notifications}
              personId={personId}
              pendingQueues={pendingQueues}
            />
          )}
          <AccountMenu
            name={name}
            email={user?.email ?? ''}
            initials={initials}
            avatarUrl={avatarUrl}
            isStaff={isStaff}
          />
        </div>
      </div>
    </header>
  )
}
