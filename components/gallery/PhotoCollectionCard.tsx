import Link from 'next/link'
import { Camera, Images } from 'lucide-react'
import type { PhotoCollection } from '@/app/actions/photos'

interface Props {
  collection: PhotoCollection
}

export function PhotoCollectionCard({ collection }: Props) {
  return (
    <Link
      href={`/review/photos/${collection.id}`}
      className="group rounded-xl border bg-card overflow-hidden hover:shadow-md transition-shadow"
    >
      <div className="aspect-video bg-muted flex items-center justify-center overflow-hidden">
        {collection.cover_photo_url ? (
          /* A PLAIN <img>, DELIBERATELY, AND NOT next/image.
             The URL is a member's uploaded photograph in a public Supabase bucket, so it is
             remote and its intrinsic size is unknown — `next/image` would need
             `images.remotePatterns` in next.config.ts (there are none today; every
             `next/image` in this tree is a STATIC import) and would put every family
             photograph through Vercel's metered optimizer. `components/ui/Avatar.tsx` made
             the same call for the same class of image.
             That is not the same as saying a 10 MB upload should be downloaded whole to fill
             a thumbnail — it should not, and TODO.md carries the three ways to fix it. It is
             an infrastructure decision rather than a lint one, and this comment is here so
             the next person meets the decision instead of the warning. */
          // eslint-disable-next-line @next/next/no-img-element
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
        <p className="text-xs text-muted-foreground mt-0.5 flex items-center gap-1">
          <Camera className="h-3 w-3" />
          {collection.photo_count} photo{collection.photo_count !== 1 ? 's' : ''}
        </p>
      </div>
    </Link>
  )
}
