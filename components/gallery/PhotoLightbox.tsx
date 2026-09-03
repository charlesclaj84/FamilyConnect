'use client'

import { ChevronLeft, ChevronRight, Trash2, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { PhotoTagEditor, type TaggablePerson } from '@/components/gallery/PhotoTagEditor'
import { useT } from '@/components/layout/LocaleProvider'

/**
 * The narrowest thing the lightbox can draw.
 *
 * ── WHY IT IS NOT `Photo` ──────────────────────────────────────────────────────────
 * It was, while the album page was the only caller. Gallery Search opens a photograph too
 * now, and a search HIT is not a `Photo` — `searchPhotos` reads a deliberately narrow
 * projection and joins no uploader name, no `taken_at`, no `created_at`. Demanding the full
 * shape would have meant either widening that query for fields the lightbox never reads, or
 * a second lightbox.
 *
 * So the type states what is actually used, and `Photo` satisfies it structurally with
 * nothing to convert. That is the same move `PhotoTagEditor` made when it stopped taking a
 * `Photo` and started taking `{ id, tags }`: a component's prop type is a statement about
 * what it reads, and a wider one is a claim it cannot honour.
 */
export interface LightboxPhoto {
  id: string
  /** The FULL photograph, never `grid_url` — see the note at the `<img>`. */
  url: string
  caption: string | null
  tags: { person_id: string; person_name: string }[]
}

/** The full-size view. The one place the whole file is the point. */
export function PhotoLightbox({
  photo, index, total, onClose, onPrev, onNext,
  allMembers, mayEdit, mayDelete, onDelete, busy, onChanged, onError,
}: {
  photo: LightboxPhoto
  index: number
  total: number
  onClose: () => void
  onPrev: () => void
  onNext: () => void
  /** Every member this caller may tag — the same list the list view is given. */
  allMembers: TaggablePerson[]
  /** `community/gallery:edit` at scope 'any'. Withholds the ✕ and the picker, not the names. */
  mayEdit: boolean
  mayDelete: boolean
  onDelete: () => void
  busy: boolean
  onChanged: (message?: string) => void
  onError: (message: string) => void
}) {
  const t = useT()
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/90" onClick={onClose}>
      <div className="relative max-h-full w-full max-w-4xl p-4" onClick={e => e.stopPropagation()}>
        <button onClick={onClose} aria-label={t('gal.closePhoto')}
          className="absolute end-2 top-2 z-10 text-white hover:text-white/70">
          <X className="h-6 w-6" />
        </button>

        {/* THE ONE PLACE THE FULL-SIZE FILE IS THE POINT, which is why this is `url` and
            the two grids above are `grid_url`: somebody has clicked a photograph to look at
            it, and a 640px thumbnail blown up to 70vh is the failure this whole feature must
            not cause. Even if the grids ever move to next/image, this one should not.
            It also has no fixed box to fill — `max-h-[70vh] object-contain` with a free aspect
            ratio is exactly what `fill` cannot express without inventing dimensions. */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={photo.url} alt={photo.caption ?? ''}
          className="mx-auto max-h-[70vh] rounded-lg object-contain" />

        {photo.caption && <p className="mt-2 text-center text-sm text-white/80">{photo.caption}</p>}

        {/* ── WHO IS IN IT, AND WHO YOU CAN ADD (2026-09-03) ─────────────────────────
            This was a read-only row of names, under a comment saying tagging was
            deliberately elsewhere:

              > TAGGING AND CAPTIONING ARE NOT HERE, DELIBERATELY. They were, and it meant
              > opening a photograph full-screen to fix a typo — and then doing it again for
              > the next one.

            HALF OF THAT IS REVERSED AND HALF IS NOT, which is the whole of the change. The
            CAPTION stays in the list view: it is text somebody is correcting, and correcting
            several in a row is what that surface is for. The TAGS come here, because a tag
            answers "who is that?" and the only place that question can be answered is in
            front of a photograph big enough to recognise a face in. Tagging from a 96px tile
            is guessing.

            `tone="scrim"` rather than a `className`: the chips sit on near-black here and on
            a card there, and `--brand-on-soft` on this ground is the unreadable-`on-`-token
            failure AGENTS.md measured on the calendar. See `PhotoTagEditor`. */}
        <div className="mt-3">
          <PhotoTagEditor
            photo={photo}
            allMembers={allMembers}
            mayEdit={mayEdit}
            busy={busy}
            onChanged={onChanged}
            onError={onError}
            tone="scrim"
          />
        </div>

        <div className="mt-3 flex justify-center gap-2">
          {mayDelete && (
            <Button size="sm" variant="destructive" onClick={onDelete} disabled={busy}>
              <Trash2 /> {t('action.delete')}
            </Button>
          )}
        </div>
        {/* KEYED. It was `{index + 1} of {total}` — a mixed JSX text node with an English
            preposition in it, which is the shape AGENTS.md names as the biggest of the four
            the literal gate was blind to. */}
        <p className="mt-2 text-center text-xs text-white/50">
          {t('gal.nOfTotal', { n: String(index + 1), total: String(total) })}
        </p>

        {index > 0 && (
          <button onClick={onPrev} aria-label={t('gal.prevPhoto')}
            className="absolute start-2 top-1/2 -translate-y-1/2 text-white/70 hover:text-white">
            <ChevronLeft className="h-8 w-8 rtl:-scale-x-100" />
          </button>
        )}
        {index < total - 1 && (
          <button onClick={onNext} aria-label={t('gal.nextPhoto')}
            className="absolute end-2 top-1/2 -translate-y-1/2 text-white/70 hover:text-white">
            <ChevronRight className="h-8 w-8 rtl:-scale-x-100" />
          </button>
        )}
      </div>
    </div>
  )
}
