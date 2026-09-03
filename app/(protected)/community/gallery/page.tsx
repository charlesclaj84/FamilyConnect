import { redirect } from 'next/navigation'
import { requireView } from '@/lib/auth/permissions'
import { getMyPersonId } from '@/lib/auth/family'
import { getGalleryRights } from '@/app/actions/gallery'
import { getMembers } from '@/app/actions/members'
import { GalleryShell } from '@/components/gallery/GalleryShell'
import { GALLERY_PANES, isGalleryPane } from '@/lib/gallery-panes'
import { callerI18n } from '@/lib/i18n/server'
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
interface Props {
  searchParams: Promise<{ pane?: string | string[] }>
}

export default async function GalleryPage({ searchParams }: Props) {
  const { user } = await currentUser()
  if (!user) redirect('/login')

  // ── ONE KEY FOR BOTH PANES, SO THE ORDINARY PREAMBLE STILL APPLIES ──────────────
  // `requireView` folds `requireFamilyActive` and `requireTier` in, which is exactly why the
  // panes were not given a key each: a page that decomposes into a union of `can()` calls
  // owes both of those BY HAND, and that is a line three pages will not have.
  // `lib/gallery-panes.ts` carries the argument for one key.
  await requireView(user.id, 'community/gallery')

  // ── THE ROSTER IS FETCHED FOR THE SEARCH, AND THAT IS A §5 DECISION ─────────────
  // `GallerySearch` offers "who is in it", which needs names — and a roster reaches the
  // browser in the RSC payload whether or not a control renders it, so fetching it is the
  // publication rather than rendering it. It is admissible here for the reason the album
  // page's own picker is: `getMembers` resolves `community/directory` itself, so a family
  // that has restricted its roster narrows this list by the same rule, and the tag picker
  // on every album page already sends exactly this.
  const [rights, myPersonId, members] = await Promise.all([
    getGalleryRights(),
    getMyPersonId(user.id),
    getMembers(),
  ])

  const allMembers = members.map(m => ({
    id: m.id,
    first_name: m.first_name,
    last_name: m.last_name,
    nick_name: m.nick_name,
  }))

  // Resolved on the SERVER so the first paint already shows the right pane — a client-side
  // default would flash the albums on the way to a search, and would be a hydration mismatch.
  // A `?pane=` that is not one of the two falls back to the first in rail order, which is the
  // pane somebody arriving with no opinion wants.
  const params = await searchParams
  const requested = Array.isArray(params.pane) ? params.pane[0] : params.pane
  const pane = isGalleryPane(requested) ? requested : GALLERY_PANES[0]

  const { t } = await callerI18n(user.id)

  return (
    <PageShell className="space-y-6">
      {/* THE HEADING ONLY, and it belongs to the PAGE rather than to either pane — it names
          the screen, and the rail immediately under it names what you are looking at. The
          lede went with the split: "The family's photographs, kept in albums" restated the
          heading and then the first rail item. */}
      <h1 className="text-3xl font-bold">{t('gal.heading')}</h1>

      <GalleryShell
        initialPane={pane}
        rights={rights}
        myPersonId={myPersonId || null}
        allMembers={allMembers}
      />
    </PageShell>
  )
}
