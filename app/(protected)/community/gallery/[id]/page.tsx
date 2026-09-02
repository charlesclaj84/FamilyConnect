import { notFound, redirect } from 'next/navigation'
import Link from 'next/link'
import { ChevronLeft } from 'lucide-react'
import { getMyPersonId } from '@/lib/auth/family'
import { requireView } from '@/lib/auth/permissions'
import { getCollectionDetail, getGalleryRights } from '@/app/actions/gallery'
import { getMembers } from '@/app/actions/members'
import { AlbumHeading } from '@/components/gallery/AlbumHeading'
import { CollectionView } from '@/components/gallery/CollectionView'
import { PageShell } from '@/components/layout/PageShell'
import { currentUser } from '@/lib/auth/current-user'
import { callerI18n } from '@/lib/i18n/server'
import { docTitle } from '@/lib/i18n/page-metadata'

export async function generateMetadata() {
  return docTitle('doc./community/gallery/[id].title')
}

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
  const { t } = await callerI18n(user?.id ?? null)
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
          <ChevronLeft className="h-3.5 w-3.5 rtl:-scale-x-100" />{t('comm.allAlbums')}</Link>
        <AlbumHeading
          id={id}
          name={collection.name}
          description={collection.description}
          photoCount={collection.photo_count}
          /* THE SAME PAIR `CollectionView`'s `mayEdit` uses, one level up: `editAny` reaches
             anybody's album, `editOwn` reaches your own — which is exactly what
             `requireOwn('community/gallery', 'edit', created_by)` resolves in the action. */
          mayRename={rights.editAny
            || (rights.editOwn && myPersonId !== '' && collection.created_by === myPersonId)}
        />
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
