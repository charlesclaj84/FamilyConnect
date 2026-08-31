import { redirect } from 'next/navigation'
import { requireView } from '@/lib/auth/permissions'
import { getMyPersonId } from '@/lib/auth/family'
import { getGalleryRights } from '@/app/actions/gallery'
import { GalleryClient } from '@/components/gallery/GalleryClient'
import { PageShell } from '@/components/layout/PageShell'
import { currentUser } from '@/lib/auth/current-user'
import { docTitle } from '@/lib/i18n/page-metadata'

export async function generateMetadata() {
  return docTitle('doc./community/gallery.title')
}

/**
 * The family's photographs, in albums.
 *
 * IT WAS `/review/photos` UNTIL 2026-08-22. The Review worklist was a place to stand while
 * six screens were walked, and its own comment set the exit condition: each row leaves for the
 * section it belongs to as its screen is reviewed. This one was walked, renamed **Gallery** and
 * moved to Community, because a shared album is the family being a family — which is what that
 * section holds — rather than a Resource, which it was filed as on the strength of both it and
 * Documents being uploads. `20260822000018` moved the key with the route.
 *
 * THE RIGHTS ARE RESOLVED HERE AND PASSED DOWN. They decide which controls the client draws and
 * nothing else: every action re-resolves its own grant, because a `'use server'` export has a
 * URL whether or not a button exists (AGENTS.md §2). The albums themselves are fetched by the
 * client on mount rather than here — an album list is not sensitive, but it IS long, and the
 * gallery is the one screen a member opens and leaves without acting.
 */
export default async function GalleryPage() {
  const { user } = await currentUser()
  if (!user) redirect('/login')

  await requireView(user.id, 'community/gallery')

  const [rights, myPersonId] = await Promise.all([
    getGalleryRights(),
    getMyPersonId(user.id),
  ])

  return (
    <PageShell className="space-y-6">
      <GalleryClient rights={rights} myPersonId={myPersonId || null} />
    </PageShell>
  )
}
