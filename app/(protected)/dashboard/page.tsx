import { redirect } from 'next/navigation'
import Link from 'next/link'
import {
  Calendar, MapPin, ChevronRight,
} from 'lucide-react'
import { Avatar } from '@/components/ui/Avatar'
import { createClient } from '@/lib/supabase/server'
import { requireViewOrPending } from '@/lib/auth/permissions'
import { PendingApproval } from '@/components/membership/PendingApproval'
import { createAdminClient } from '@/lib/supabase/admin'
import { getMyFamilyCode } from '@/lib/auth/family'
import { getUpcomingEvents } from '@/app/actions/events'
import { getMyRoles } from '@/app/actions/admin/users'
import { getLinkPersonBannerData } from '@/app/actions/link-person'
import { getPinnedAnnouncements, getChapters } from '@/app/actions/announcements'
import { getMyDuesSummary } from '@/app/actions/dues'
import { getUnreadCount } from '@/app/actions/notifications'
import { formatRoleTitle } from '@/lib/role-utils'
import { formatDate } from '@/lib/date-utils'
import { LinkPersonBanner } from '@/components/dashboard/LinkPersonBanner'
import { LINK_EXISTING_PERSON_ENABLED } from '@/lib/feature-flags'
import { ChapterReminderBanner } from '@/components/dashboard/ChapterReminderBanner'
import { PinnedAnnouncementsBanner } from '@/components/dashboard/PinnedAnnouncementsBanner'
import { DuesBalanceKpi } from '@/components/dues/DuesBalanceKpi'
import { DashboardStats } from '@/components/dashboard/DashboardStats'
import { isFeatureLive } from '@/lib/features'


export const metadata = { title: 'Dashboard — Family Connect' }

export default async function DashboardPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  // requireViewOrPending, not requireView: a pending member must be able to LAND
  // somewhere that tells them what is happening. The early return is above every fetch
  // below, and has to stay there — the Promise.all is nine calls' worth of family data,
  // and props reach the browser in the RSC payload whether or not a component renders
  // them, so returning after it would publish everything this screen exists to withhold.
  const gate = await requireViewOrPending(user.id, 'dashboard')
  if (gate.pending) return <PendingApproval membership={gate.membership} />

  const firstName = user.user_metadata?.first_name || user.email?.split('@')[0] || 'Member'
  const lastName  = user.user_metadata?.last_name ?? ''
  const initials  = [firstName[0], lastName[0]].filter(Boolean).join('').toUpperCase()

  const familyCode = await getMyFamilyCode(user.id)
  const admin = createAdminClient()

  // The dashboard has shipped but several of the features it surfaces have not.
  // Skip those queries entirely and render the roadmap state instead of links
  // that would only hit the gate — see lib/features.ts.
  const eventsLive = isFeatureLive('/events')
  const announcementsLive = isFeatureLive('/announcements')

  const [upcomingEvents, myRoles, linkBannerData, pinnedAnnouncements, duesSummary, unreadCount, memberCountResult, myPersonResult, chapters] = await Promise.all([
    eventsLive ? getUpcomingEvents().then(e => e.slice(0, 3)) : [],
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
    getUnreadCount(),
    admin.from('people').select('id', { count: 'exact', head: true }).eq('family_code', familyCode).eq('is_minor', false).not('user_id', 'is', null),
    // chapter_id is per-family — scope to the family being viewed.
    supabase.from('people').select('chapter_id, chapters(name)').eq('user_id', user.id).eq('family_code', familyCode).maybeSingle(),
    getChapters(),
  ])

  const memberCount = memberCountResult.count ?? 0
  const myPersonData = myPersonResult.data as { chapter_id: string | null; chapters?: { name: string } | null } | null
  const myChapterId = myPersonData?.chapter_id ?? null
  const myChapterName = (myPersonData?.chapters as { name: string } | null)?.name ?? null
  const needsChapter = !myChapterId && chapters.length > 0
  const nextEvent = upcomingEvents[0]
  const daysToNextEvent = nextEvent
    ? Math.max(0, Math.round((new Date(nextEvent.start_date ?? nextEvent.event_date ?? '').getTime() - Date.now()) / 86400000))
    : null

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 py-10 space-y-10">

      {/* ── Profile summary + selfie ──────────────────────────────── */}
      <div className="flex items-center gap-5">
        <Avatar initials={initials} size="lg" />
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold leading-tight">
            Welcome back, {firstName}!
          </h1>
          {myRoles.length > 0 && (
            <div className="flex flex-wrap gap-2 mt-2">
              {myRoles.map((r, i) => (
                <span key={i} className="inline-flex items-center text-sm font-medium bg-[#0f2540] text-[#e6ecfa] px-3 py-1 rounded-full">
                  {formatRoleTitle(r)}
                </span>
              ))}
            </div>
          )}
          {myChapterName && (
            <p className="text-sm text-muted-foreground mt-1.5 flex items-center gap-1">
              <MapPin className="h-3.5 w-3.5 shrink-0" />
              {myChapterName} Chapter
            </p>
          )}
        </div>
      </div>

      {/* ── Quick stats ───────────────────────────────────────────── */}
      <DashboardStats memberCount={memberCount} daysToNextEvent={daysToNextEvent} nextEventId={nextEvent?.id ?? null} unreadCount={unreadCount} eventsLive={eventsLive} />

      {/* ── Link existing person banner ───────────────────────────── */}
      {linkBannerData.showBanner && (
        <LinkPersonBanner unlinkedPeople={linkBannerData.unlinkedPeople} />
      )}

      {/* ── Chapter reminder ─────────────────────────────────────── */}
      {needsChapter && (
        <ChapterReminderBanner chapters={chapters} />
      )}

      {/* ── Pinned Announcements ──────────────────────────────────── */}
      {pinnedAnnouncements.length > 0 && (
        <>
          <PinnedAnnouncementsBanner announcements={pinnedAnnouncements} />
          <Link href="/announcements" className="text-xs text-primary hover:underline">View all announcements</Link>
        </>
      )}

      {/* ── Account widget ────────────────────────────────────────── */}
      <section>
        <h2 className="text-lg font-semibold mb-4">Account</h2>
        {/* The same component My Summary renders in its stat row — see DuesBalanceKpi on
            why there is only one of these. `max-w-sm` is the width the card had here; on
            My Summary a grid cell decides instead. */}
        <DuesBalanceKpi summary={duesSummary} showViewLink className="max-w-sm" />
      </section>

      {/* ── Upcoming Events ───────────────────────────────────────── */}
      {/* Omitted entirely until Events ships — no placeholder, no badge. */}
      {eventsLive && (
      <section>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold">Upcoming Events</h2>
          <Link href="/events" className="text-xs text-primary hover:underline">View all</Link>
        </div>
        {upcomingEvents.length === 0 ? (
          <p className="text-sm text-muted-foreground py-4">No upcoming events yet.</p>
        ) : (
          <div className="space-y-3">
            {upcomingEvents.map(event => (
              <Link key={event.id} href={`/events/${event.id}`}>
                <div className="flex items-center gap-4 rounded-xl border bg-card px-4 py-4 hover:shadow-sm transition-shadow cursor-pointer">
                  <div className="shrink-0 p-2.5 rounded-lg bg-primary/10 text-primary">
                    <Calendar className="h-5 w-5" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-sm truncate">{event.name}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {event.event_date ? formatDate(event.event_date) : 'Date TBD'}
                    </p>
                    {event.location && (
                      <div className="flex items-center gap-1 mt-0.5 text-xs text-muted-foreground">
                        <MapPin className="h-3 w-3 shrink-0" />
                        <span className="truncate">{event.location}</span>
                      </div>
                    )}
                  </div>
                  <ChevronRight className="h-4 w-4 text-muted-foreground/40 shrink-0" />
                </div>
              </Link>
            ))}
          </div>
        )}
      </section>
      )}

    </div>
  )
}
