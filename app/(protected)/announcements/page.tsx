import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { can, canAny, requireView, scopeFor } from '@/lib/auth/permissions'
import { getMyPersonId } from '@/lib/auth/family'
import { getAnnouncements, getChapters } from '@/app/actions/announcements'
import { AnnouncementBoard } from '@/components/announcements/AnnouncementBoard'
import { PageShell } from '@/components/layout/PageShell'

export const metadata = { title: 'Announcements' }

/**
 * The family's notice board — and, since 20260813000000, the ONLY announcements screen.
 *
 * `/admin/announcements` was a second page over the same rows with the same controls,
 * gated by a key (`admin/announcements`) that named no table and appeared in no policy.
 * Everything it did happens here, under the grant that actually governs each control:
 *
 *   announcements:create   post at all — every member, by default
 *   announcements:edit     pin family-wide, to the top of everyone's Recent Updates
 *   announcements:delete   remove one; 'own' lets an author retract their own
 *
 * THE THREE RIGHTS ARE RESOLVED HERE AND HANDED DOWN, rather than re-derived in the
 * client, so the buttons and the server actions cannot disagree about who may do what.
 * They are also only affordances: `togglePinAnnouncement` and `deleteAnnouncement` each
 * re-check independently, because a `'use server'` export is a public HTTP endpoint and
 * the page that renders the button is not in its request path.
 *
 * THE LIST IS NOT GATED PER ROW and does not need to be — `getAnnouncements()` runs on
 * the user's client, so the SELECT policy on `announcements` is what decides which rows
 * exist for this caller. What is decided here is only what may be DONE to them.
 *
 * `wide`, NOT `reading`. This was the reading measure on the argument that an announcement
 * is prose — which is true of one announcement and not of this screen. What is here is a
 * BOARD: a stack of cards, each with a chapter pill, a pin control and a delete control in
 * its corners, and the post composer above them. A narrower column bought nothing for that
 * and cost the one thing a page in a shell owes its neighbours, which is starting where
 * they start. See the note on `reading` in components/layout/PageShell.tsx.
 */
export default async function AnnouncementsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  await requireView(user.id, 'announcements')

  const [canPost, canPin, deleteScope, myPersonId, announcements, chapters] = await Promise.all([
    can(user.id, 'announcements', 'create'),
    // `canAny`, matching `requireEdit` in the action: pinning puts a post at the top of
    // every member's dashboard, so there is no coherent "own" version of it.
    canAny(user.id, 'announcements', 'edit'),
    // The SCOPE, not a boolean — 'own' is a real and common way to hold delete here, and
    // the board has to know which rows it applies to. `requireOwn` makes the same
    // decision server-side against the author id the database holds.
    scopeFor(user.id, 'announcements', 'delete'),
    getMyPersonId(user.id),
    getAnnouncements(),
    getChapters(),
  ])

  return (
    <PageShell className="space-y-6">
      <div>
        <h1 className="mb-1 text-3xl font-bold">Announcements</h1>
        <p className="text-muted-foreground">
          News from across your family. Pinned posts ride at the top of everyone&apos;s
          Recent Updates until each person dismisses them.
        </p>
      </div>

      <AnnouncementBoard
        initialAnnouncements={announcements}
        chapters={chapters}
        canPost={canPost}
        canPin={canPin}
        deleteScope={deleteScope}
        myPersonId={myPersonId}
      />
    </PageShell>
  )
}
