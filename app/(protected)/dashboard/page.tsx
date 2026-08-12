import { redirect } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { requireViewOrPending, can, canAny } from '@/lib/auth/permissions'
import { PendingApproval } from '@/components/membership/PendingApproval'
import { createAdminClient } from '@/lib/supabase/admin'
import { getMyFamilyCode } from '@/lib/auth/family'
import { getMyRoles } from '@/app/actions/admin/users'
import { getLinkPersonBannerData } from '@/app/actions/link-person'
import { getPinnedAnnouncements, getChapters } from '@/app/actions/announcements'
import { getMyDuesSummary, getFamilyDuesCollected } from '@/app/actions/dues'
import { getNotifications } from '@/app/actions/notifications'
import { getPendingApprovalCount } from '@/app/actions/admin/approvals'
import { formatRoleTitle } from '@/lib/role-utils'
import { formatCurrency } from '@/lib/currency-utils'
import { LinkPersonBanner } from '@/components/dashboard/LinkPersonBanner'
import { LINK_EXISTING_PERSON_ENABLED } from '@/lib/feature-flags'
import { ChapterReminderBanner } from '@/components/dashboard/ChapterReminderBanner'
import { PinnedAnnouncementsBanner } from '@/components/dashboard/PinnedAnnouncementsBanner'
import { DuesBalanceKpi } from '@/components/dues/DuesBalanceKpi'
import { PageShell } from '@/components/layout/PageShell'
import { WelcomeHero } from '@/components/dashboard/WelcomeHero'
import { AtAGlance } from '@/components/dashboard/AtAGlance'
import { QuickActions } from '@/components/dashboard/QuickActions'
import { RecentUpdates } from '@/components/dashboard/RecentUpdates'
import {
  TILE_RESOURCE, QUICK_ACTION_GRANT, ROUTE_FOR_GRANT,
  type ResolvedTile, type QuickActionId,
} from '@/components/dashboard/tiles'
import { isFeatureLive } from '@/lib/features'

export const metadata = { title: 'Dashboard' }

/** How many notification rows the Recent Updates card shows before the bell takes over. */
const RECENT_UPDATES_LIMIT = 5

/**
 * The member's landing screen, in the Golden Master's visual language.
 *
 * ── WHAT THIS PAGE IS NOT ────────────────────────────────────────────────────────────
 * The kit (`public/dashboard/`) composes nine panels. Four of them are omitted here and
 * every omission is a fact about the product rather than a shortcut:
 *
 *   Event hero + Upcoming Events   `/events` is `status: 'future'` in lib/features.ts.
 *                                  The data and the actions exist; flip the flag and the
 *                                  band under the greeting is where they go.
 *   Family Tree Highlights         `/family-tree` is 'future', and nothing computes a
 *                                  family-wide generation depth.
 *   Family hero photograph         No column, no bucket, no schema. The kit's own image
 *                                  is stock photography with the design burnt into it.
 *   Recent Activity (a feed)       No table records who did what. See RecentUpdates,
 *                                  which answers the question the data can answer.
 *
 * Nothing renders a placeholder for these. That is the policy this page already held —
 * "Omitted entirely until Events ships, no placeholder, no badge" — and the layout
 * narrows to what is real rather than advertising what is not.
 *
 * ── THE ORDER OF THIS FUNCTION IS THE SECURITY MODEL ─────────────────────────────────
 * Read top to bottom, it is: resolve the caller, refuse a pending one, resolve every
 * grant, and only then fetch. That sequence is the whole of AGENTS.md §5 on this screen
 * and it is easy to undo by accident, because the natural way to write a dashboard is one
 * big `Promise.all` followed by `{canSee && <Tile/>}`. That version leaks: props are
 * serialized into the RSC payload whether a component renders them or not, so a hidden
 * tile over a fetched number has already published the number.
 *
 * This page shipped a live instance of exactly that. The member count was fetched
 * unconditionally on the admin client and rendered inside `<Link href="/members">` — so a
 * family that restricted its Member Directory still handed every member the exact
 * approved-member count, under a link that 404s. `canViewMembers` below is that hole
 * closed, and it is the reason the grants are resolved in their own `Promise.all` above
 * the data one rather than inline.
 */
export default async function DashboardPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  // requireViewOrPending, not requireView: a pending member must be able to LAND
  // somewhere that tells them what is happening. The early return is above every fetch
  // below, and has to stay there — what follows is a family's roster count, its dues
  // total and its notification feed, and props reach the browser in the RSC payload
  // whether or not a component renders them. Returning after it would publish
  // everything this screen exists to withhold from somebody the family has not admitted.
  const gate = await requireViewOrPending(user.id, 'dashboard')
  if (gate.pending) return <PendingApproval membership={gate.membership} />

  const firstName = user.user_metadata?.first_name || user.email?.split('@')[0] || 'Member'
  const lastName  = user.user_metadata?.last_name ?? ''
  const initials  = [firstName[0], lastName[0]].filter(Boolean).join('').toUpperCase()

  const familyCode = await getMyFamilyCode(user.id)
  const admin = createAdminClient()

  // ── Every grant, resolved BEFORE anything is fetched ────────────────────────────────
  // Two independent narrowings on each, exactly as the sidebar applies them: has the
  // feature shipped at all (lib/features.ts), and may THIS member view it (the
  // permission model). Either one false and the query below is never issued.
  const announcementsLive = isFeatureLive('/announcements')
  const [canViewMembers, canAddMember, canRecordPayment, canSendMessage] = await Promise.all([
    isFeatureLive(ROUTE_FOR_GRANT[TILE_RESOURCE.members[0]])
      ? can(user.id, TILE_RESOURCE.members[0], 'view')
      : false,
    // `create`, not `view` — a button captioned with a verb promises the verb. See the
    // note on QUICK_ACTION_GRANT.
    isFeatureLive(ROUTE_FOR_GRANT[QUICK_ACTION_GRANT['add-member'].resource])
      ? can(user.id, QUICK_ACTION_GRANT['add-member'].resource, QUICK_ACTION_GRANT['add-member'].action)
      : false,
    // `canAny`, per AGENTS.md: recording money for somebody is not an "own" action, and
    // the row a member would own is the abuse case.
    isFeatureLive(ROUTE_FOR_GRANT[QUICK_ACTION_GRANT['record-payment'].resource])
      ? canAny(user.id, QUICK_ACTION_GRANT['record-payment'].resource, QUICK_ACTION_GRANT['record-payment'].action)
      : false,
    isFeatureLive(ROUTE_FOR_GRANT[QUICK_ACTION_GRANT['send-message'].resource])
      ? can(user.id, QUICK_ACTION_GRANT['send-message'].resource, QUICK_ACTION_GRANT['send-message'].action)
      : false,
  ])

  // ── Now fetch, and only what the answers above allow ────────────────────────────────
  const [
    myRoles, linkBannerData, pinnedAnnouncements, duesSummary,
    notifications, memberCountResult, myPersonResult, chapters,
    pendingApprovals, duesCollectedCents,
  ] = await Promise.all([
    getMyRoles(),
    // "Were you already added to the family?" — parked, see lib/feature-flags.ts.
    // Not fetched rather than fetched-and-hidden: the response is a roster of unlinked
    // people, and props are serialized into the RSC payload whether a component renders
    // them or not (AGENTS.md §5). The action refuses independently of this line.
    LINK_EXISTING_PERSON_ENABLED
      ? getLinkPersonBannerData()
      : Promise.resolve({ showBanner: false, unlinkedPeople: [] }),
    announcementsLive ? getPinnedAnnouncements() : [],
    getMyDuesSummary(),
    getNotifications(),
    // The "Family Members" tile. THREE conditions, and none is decoration:
    //
    //   canViewMembers        — resolved above. Without it there is no query and no
    //                           number in the payload, which is the fix described in the
    //                           header comment.
    //   membership_status     — this runs on the ADMIN client, so no policy is filtering
    //                           it. Without the conjunct an applicant was counted as a
    //                           member of the family on the dashboard of EVERY member,
    //                           not just of the administrators who can see the queue.
    //                           Someone who has asked to join has not joined.
    //   family_code           — §3. The admin client bypasses RLS, so family isolation is
    //                           this line and nothing else.
    canViewMembers
      ? admin.from('people').select('id', { count: 'exact', head: true }).eq('family_code', familyCode).eq('is_minor', false).not('user_id', 'is', null).eq('membership_status', 'approved')
      : Promise.resolve(null),
    // The caller's own people row — chapter for the hero's location line, avatar for its
    // portrait. Both are per-family (one `people` row PER family), so this is scoped to
    // the family being viewed and not to the account. No grant: it is their own row, on
    // their own client, and RLS says so.
    supabase.from('people').select('chapter_id, avatar_url, chapters(name)').eq('user_id', user.id).eq('family_code', familyCode).maybeSingle(),
    getChapters(),
    // The queue depth for the Pending Approval tile. Gated INSIDE the action on
    // admin/approvals:view, so a member who cannot work the queue gets 0 and the tile
    // never renders — the number is not fetched for them, not merely hidden.
    getPendingApprovalCount(),
    // Gated inside the action too, and it returns null rather than 0 for anyone without
    // a ledger grant — see getFamilyDuesCollected on why 0 would have been a lie.
    getFamilyDuesCollected(),
  ])

  const memberCount = memberCountResult?.count ?? 0
  const myPersonData = myPersonResult.data as {
    chapter_id: string | null
    avatar_url: string | null
    chapters?: { name: string } | null
  } | null
  const myChapterId = myPersonData?.chapter_id ?? null
  const myChapterName = (myPersonData?.chapters as { name: string } | null)?.name ?? null
  const needsChapter = !myChapterId && chapters.length > 0

  // ── Compose the tiles from what actually resolved ───────────────────────────────────
  // A tile appears only if its value was fetched. `duesCollectedCents === null` and
  // `memberCountResult === null` are the two "not entitled" signals, and they are null
  // rather than 0 precisely so that this list can tell them apart from a real zero — a
  // family that has collected nothing this year is not the same as a member who may not
  // ask, and the tile must not say "$0.00" for the second one.
  const tiles: ResolvedTile[] = [
    ...(memberCountResult ? [{ id: 'members' as const, value: String(memberCount) }] : []),
    ...(duesCollectedCents !== null ? [{ id: 'dues' as const, value: formatCurrency(duesCollectedCents) }] : []),
    // Only when somebody is actually waiting. A standing "0 pending" tile is a control
    // that never changes and a row of the grid spent on nothing.
    ...(pendingApprovals > 0 ? [{ id: 'approvals' as const, value: String(pendingApprovals) }] : []),
  ]

  const quickActions: QuickActionId[] = [
    ...(canAddMember ? ['add-member' as const] : []),
    ...(canRecordPayment ? ['record-payment' as const] : []),
    ...(canSendMessage ? ['send-message' as const] : []),
  ]

  return (
    <PageShell className="space-y-6">
      <WelcomeHero
        firstName={firstName}
        initials={initials}
        avatarUrl={myPersonData?.avatar_url}
        roles={myRoles.map(formatRoleTitle)}
        chapterName={myChapterName}
      />

      {/* Banners sit between the hero and the grid: each one is a thing this member has
          to do, and burying an action item under four metric tiles is how it gets
          missed. Each renders only when it applies, so the usual case is none. */}
      {linkBannerData.showBanner && (
        <LinkPersonBanner unlinkedPeople={linkBannerData.unlinkedPeople} />
      )}

      {needsChapter && <ChapterReminderBanner chapters={chapters} />}

      {pinnedAnnouncements.length > 0 && (
        <>
          <PinnedAnnouncementsBanner announcements={pinnedAnnouncements} />
          <Link href="/announcements" className="text-xs text-brand-accent hover:underline">
            View all announcements
          </Link>
        </>
      )}

      {/* THE COLUMN SPLIT IS 2:1, AND WHICH CARD GOES WHERE IS LOAD-BEARING.
          The Golden Master can afford a tall narrow column on the right because it has
          nine panels to distribute. This page has four, and two of them can vanish
          entirely — so the composition has to hold up when half of it is missing.

          The first arrangement put Recent Updates alone in the wide column and stacked
          the other three on the right. It measured fine and looked broken: a member with
          two notifications got one short card beside a 700px column of content, and the
          bottom-left two thirds of the screen were empty page.

          So the pairing is by WEIGHT rather than by the kit's positions. Each column
          gets two cards, and each column leads with the one that is always there:

            wide (2fr)    At a Glance — the figures, and the reason to open the page
                          Recent Updates — always renders, grows with the feed
            narrow (1fr)  Quick Actions — may be empty for a plain member
                          Remaining Balance — always renders, so this column never is

          Below `lg` it is one column in that same order, which puts the numbers first on
          a phone rather than a strip of buttons. */}
      {/* `min-w-0` ON BOTH COLUMNS IS NOT OPTIONAL — it is the fix for a real horizontal
          scroll, measured at 505px on a 390px screen before it was added.

          A grid item defaults to `min-width: auto`, which means it refuses to be narrower
          than its own min-content and stretches its track to fit. Recent Updates is full
          of `truncate` text, and `truncate` sets `white-space: nowrap` — so a notification
          body of "bravo.newcomer@rls.test has asked to join…" reported a min-content of
          ~489px and dragged the whole page sideways with it. The ellipsis never had a
          chance to appear, because the column simply grew instead.

          This is the same `min-w-0` on `<main>` in app/(protected)/layout.tsx, for the
          same reason. Any new column added here owes it too. */}
      <div className="grid gap-6 lg:grid-cols-3">
        <div className="flex min-w-0 flex-col gap-6 lg:col-span-2">
          <AtAGlance tiles={tiles} />
          <RecentUpdates notifications={notifications.slice(0, RECENT_UPDATES_LIMIT)} />
        </div>
        <div className="flex min-w-0 flex-col gap-6">
          <QuickActions actions={quickActions} />
          {/* THE dues balance KPI — the same component My Summary renders, unchanged.
              It anchors the narrow column and always renders, which is what stops that
              column being empty for a member with no quick actions at all.
              `showViewLink` is the one prop that may differ between the two pages. */}
          <DuesBalanceKpi summary={duesSummary} showViewLink />
        </div>
      </div>
    </PageShell>
  )
}
