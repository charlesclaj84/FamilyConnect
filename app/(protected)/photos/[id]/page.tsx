import { notFound, redirect } from 'next/navigation'
import Link from 'next/link'
import { ChevronLeft, Camera } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { getMyPersonId } from '@/lib/auth/family'
import { can, requireView } from '@/lib/auth/permissions'
import { createAdminClient } from '@/lib/supabase/admin'
import { getCollectionDetail } from '@/app/actions/photos'
import { getMembers } from '@/app/actions/members'
import { PhotoCollectionGallery } from '@/components/photos/PhotoCollectionGallery'

export const metadata = { title: 'Photo Collection — Family Connect' }

export default async function PhotoCollectionPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  await requireView(user.id, 'photos')

  const admin = createAdminClient()
  const myPersonId = await getMyPersonId(user.id)

  const [{ collection, photos }, members] = await Promise.all([
    getCollectionDetail(id),
    getMembers(),
  ])

  if (!collection) notFound()

  const allMembers = members.map(m => ({
    id: m.id,
    first_name: m.first_name,
    last_name: m.last_name,
    nick_name: m.nick_name,
  }))

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 py-10 space-y-6">
      <div>
        <Link href="/photos" className="text-sm text-muted-foreground hover:text-foreground flex items-center gap-1 mb-4">
          <ChevronLeft className="h-3.5 w-3.5" /> All Collections
        </Link>
        <div className="flex items-center gap-3">
          <Camera className="h-6 w-6 text-primary shrink-0" />
          <div>
            <h1 className="text-2xl font-bold">{collection.name}</h1>
            {collection.event_name && (
              <p className="text-sm text-muted-foreground">{collection.event_name}</p>
            )}
          </div>
          <span className="ml-auto text-sm text-muted-foreground">{collection.photo_count} photo{collection.photo_count !== 1 ? 's' : ''}</span>
        </div>
        {collection.description && (
          <p className="text-muted-foreground mt-2 ml-9">{collection.description}</p>
        )}
      </div>

      <PhotoCollectionGallery
        collectionId={id}
        initialPhotos={photos}
        currentPersonId={myPersonId || null}
        isAdmin={await can(user.id, 'photos', 'delete')}
        allMembers={allMembers}
      />
    </div>
  )
}
