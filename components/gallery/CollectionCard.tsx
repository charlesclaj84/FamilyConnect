import Link from 'next/link'
import { Camera, Images } from 'lucide-react'
import type { PhotoCollection } from '@/app/actions/gallery'

/**
 * One album on the Gallery's index.
 *
 * It was `PhotoCollectionCard` under `/review/photos` until 2026-08-22; the screen was walked,
 * renamed **Gallery** and moved to Community (20260822000018).
 */
export function CollectionCard({ collection }: { collection: PhotoCollection }) {
  return (
    <Link
      href={`/community/gallery/${collection.id}`}
      /* `block` IS LOAD-BEARING, and its absence drew two stray hairlines on the Gallery
         index until 2026-08-22. Tailwind's preflight does not set `display` on an anchor, so
         this was still `display: inline` while containing two block-level children — and an
         inline box with a border draws that border around its own empty inline fragments,
         one before the block content and one after. The visible result was a ~2px vertical
         stroke above the thumbnail and another below the caption, at the left edge of the
         column, on every tile.
         Any anchor here that wraps blocks and carries a border needs a display class. The
         other bordered inline anchor in the tree (`/invite/[token]`) wraps TEXT, which is
         what an inline pill is for and is correct as it stands. */
      className="group block overflow-hidden rounded-xl border bg-card transition-shadow hover:shadow-md"
    >
      <div className="flex aspect-video items-center justify-center overflow-hidden bg-muted">
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
            className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
          />
        ) : (
          <Images className="h-10 w-10 text-muted-foreground/30" />
        )}
      </div>
      <div className="px-3 py-2.5">
        <p className="truncate text-sm font-medium">{collection.name}</p>
        <p className="mt-0.5 flex items-center gap-1 text-xs text-muted-foreground">
          <Camera className="h-3 w-3" />
          {collection.photo_count} photo{collection.photo_count !== 1 ? 's' : ''}
        </p>
      </div>
    </Link>
  )
}
