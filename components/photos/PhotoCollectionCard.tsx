import Link from 'next/link'
import { Camera, Images } from 'lucide-react'
import type { PhotoCollection } from '@/app/actions/photos'

interface Props {
  collection: PhotoCollection
}

export function PhotoCollectionCard({ collection }: Props) {
  return (
    <Link
      href={`/photos/${collection.id}`}
      className="group rounded-xl border bg-card overflow-hidden hover:shadow-md transition-shadow"
    >
      <div className="aspect-video bg-muted flex items-center justify-center overflow-hidden">
        {collection.cover_photo_url ? (
          <img
            src={collection.cover_photo_url}
            alt={collection.name}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
          />
        ) : (
          <Images className="h-10 w-10 text-muted-foreground/30" />
        )}
      </div>
      <div className="px-3 py-2.5">
        <p className="font-medium text-sm truncate">{collection.name}</p>
        {collection.event_name && (
          <p className="text-xs text-muted-foreground truncate">{collection.event_name}</p>
        )}
        <p className="text-xs text-muted-foreground mt-0.5 flex items-center gap-1">
          <Camera className="h-3 w-3" />
          {collection.photo_count} photo{collection.photo_count !== 1 ? 's' : ''}
        </p>
      </div>
    </Link>
  )
}
