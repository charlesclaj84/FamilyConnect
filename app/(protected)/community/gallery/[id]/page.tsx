import { notFound, redirect } from 'next/navigation'
import Link from 'next/link'
import { ChevronLeft, Images } from 'lucide-react'
import { getMyPersonId } from '@/lib/auth/family'
import { requireView } from '@/lib/auth/permissions'
import { getCollectionDetail, getGalleryRights } from '@/app/actions/gallery'
import { getMembers } from '@/app/actions/members'
import { CollectionView } from '@/components/gallery/CollectionView'
import { PageShell } from '@/components/layout/PageShell'
import { currentUser } from '@/lib/auth/current-user'

export const metadata = { title: 'Album' }

/**
 * One album.
 *
 * THE ROSTER IS FETCHED BECAUSE TAGGING NEEDS IT, and it is fetched for everybody who can open
 * the page — which is the one thing here worth stating rather than assuming. `getMembers()`
 * resolves its own grant, so a caller who may not read the Directory gets a short list or none
 * and the tag control has nothing to offer; that is the correct narrowing and it happens
 * inside that action rather than here.
 */
export default async function AlbumPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params

  const { user } = await currentUser()
  if (!user) redirect('/login')

  await requireView(user.id, 'community/gallery')

  const [{ collection, photos }, members, rights, myPersonId] = await Promise.all([
    getCollectionDetail(id),
    getMembers(),
    getGalleryRights(),
    getMyPersonId(user.id),
  ])

  if (!collection) notFound()

  const allMembers = members.map(m => ({
    id: m.id,
    first_name: m.first_name,
    last_name: m.last_name,
    nick_name: m.nick_name,
  }))

  return (
    <PageShell className="space-y-6">
      <div>
        <Link href="/community/gallery"
          className="mb-4 flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
          <ChevronLeft className="h-3.5 w-3.5" /> All albums
        </Link>
        <div className="flex items-center gap-3">
          <Images className="h-6 w-6 shrink-0 text-brand-accent" />
          <h1 className="text-2xl font-bold">{collection.name}</h1>
          <span className="ml-auto text-sm text-muted-foreground">
            {collection.photo_count} photo{collection.photo_count !== 1 ? 's' : ''}
          </span>
        </div>
        {collection.description && (
          <p className="ml-9 mt-2 text-muted-foreground">{collection.description}</p>
        )}
      </div>

      <CollectionView
        collectionId={id}
        initialPhotos={photos}
        currentPersonId={myPersonId || null}
        rights={rights}
        allMembers={allMembers}
      />
    </PageShell>
  )
}
