'use client'

import { useState, useRef, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { X, Upload, Tag, Trash2, ChevronLeft, ChevronRight, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { formatPersonName } from '@/lib/name-utils'
import { useConfirm } from '@/components/ui/confirm'
import { useServerState } from '@/lib/use-server-state'
import { uploadPhoto, deletePhoto, tagPersonInPhoto, untagPersonFromPhoto } from '@/app/actions/photos'
import type { Photo } from '@/app/actions/photos'

interface Person { id: string; first_name: string; last_name: string; nick_name?: string | null }

interface Props {
  collectionId: string
  initialPhotos: Photo[]
  currentPersonId: string | null
  isAdmin: boolean
  allMembers: Person[]
}

export function PhotoCollectionGallery({
  collectionId, initialPhotos, currentPersonId, isAdmin, allMembers
}: Props) {
  const router = useRouter()
  const confirm = useConfirm()
  // `useServerState`: an uploaded photo used to stay invisible until the page was left
  // and re-entered. The row is not built client-side because its storage image URL
  // only exists once the server has read the row back, so the handler refreshes.
  const [photos, setPhotos] = useServerState(initialPhotos)
  const [lightbox, setLightbox] = useState<number | null>(null)
  const [tagTarget, setTagTarget] = useState<string | null>(null)
  const [tagSearch, setTagSearch] = useState('')
  const [caption, setCaption] = useState('')
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState('')
  const [isPending, startTransition] = useTransition()
  const fileRef = useRef<HTMLInputElement>(null)

  const currentPhoto = lightbox !== null ? photos[lightbox] : null

  function openLightbox(idx: number) { setLightbox(idx) }
  function closeLightbox() { setLightbox(null) }
  function prevPhoto() { setLightbox(i => i !== null && i > 0 ? i - 1 : i) }
  function nextPhoto() { setLightbox(i => i !== null && i < photos.length - 1 ? i + 1 : i) }

  async function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setUploading(true); setError('')
    const fd = new FormData()
    fd.append('file', file)
    fd.append('caption', caption)
    const result = await uploadPhoto(collectionId, fd)
    setUploading(false)
    if (!result.success) { setError(result.message ?? 'Upload failed'); return }
    setCaption('')
    if (fileRef.current) fileRef.current.value = ''
    // Explicit, rather than leaning on the action's `revalidatePath`, so the new
    // photo lands whatever path this gallery is mounted under.
    router.refresh()
  }

  async function handleDelete(photo: Photo) {
    const ok = await confirm({
      title: 'Delete photo',
      description: photo.caption
        ? `Delete "${photo.caption}"? The photo and its tags are removed for everyone. This cannot be undone.`
        : 'Delete this photo? It is removed for everyone, along with its tags. This cannot be undone.',
      confirmLabel: 'Delete photo',
      destructive: true,
    })
    if (!ok) return
    startTransition(async () => {
      await deletePhoto(photo.id, photo.file_path, collectionId)
      setPhotos(prev => prev.filter(p => p.id !== photo.id))
      if (lightbox !== null) setLightbox(null)
    })
  }

  function handleTag(photoId: string, personId: string) {
    startTransition(async () => {
      await tagPersonInPhoto(photoId, personId, collectionId)
      setTagTarget(null); setTagSearch('')
    })
  }

  async function handleUntag(photoId: string, personId: string) {
    const person = allMembers.find(m => m.id === personId)
    const ok = await confirm({
      title: 'Remove tag',
      description: person
        ? `Remove the tag for ${formatPersonName(person)} from this photo?`
        : 'Remove this tag from the photo?',
      confirmLabel: 'Remove tag',
      destructive: true,
    })
    if (!ok) return
    startTransition(async () => {
      await untagPersonFromPhoto(photoId, personId, collectionId)
    })
  }

  const canDelete = (photo: Photo) => isAdmin || photo.uploader_id === currentPersonId

  const filteredMembers = allMembers.filter(m => {
    const name = formatPersonName(m).toLowerCase()
    return name.includes(tagSearch.toLowerCase())
  })

  if (photos.length === 0 && !currentPersonId) {
    return <p className="text-sm text-muted-foreground">No photos yet.</p>
  }

  return (
    <div className="space-y-4">
      {/* Upload */}
      {currentPersonId && (
        <div className="flex flex-col sm:flex-row items-start gap-3 rounded-lg border bg-muted/30 p-3">
          <div className="flex-1 space-y-1.5">
            <Label>Caption (optional)</Label>
            <Input value={caption} onChange={e => setCaption(e.target.value)} placeholder="Add a caption…" />
          </div>
          <div className="flex items-end gap-2">
            <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={handleUpload} />
            <Button size="sm" variant="outline" onClick={() => fileRef.current?.click()} disabled={uploading}>
              {uploading ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" /> : <Upload className="h-3.5 w-3.5 mr-1" />}
              Upload Photo
            </Button>
          </div>
          {error && <p className="text-sm text-destructive w-full">{error}</p>}
        </div>
      )}

      {/* Grid */}
      {photos.length === 0 ? (
        <p className="text-sm text-muted-foreground">No photos yet. Upload the first one!</p>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2">
          {photos.map((photo, idx) => (
            <div key={photo.id} className="group relative aspect-square rounded-lg overflow-hidden bg-muted cursor-pointer" onClick={() => openLightbox(idx)}>
              <img src={photo.url} alt={photo.caption ?? ''} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" />
              {photo.tags.length > 0 && (
                <div className="absolute bottom-1 left-1 flex flex-wrap gap-0.5">
                  {photo.tags.slice(0, 3).map(t => (
                    <span key={t.person_id} className="bg-black/60 text-white text-[10px] px-1 py-0.5 rounded">
                      {t.person_name.split(' ')[0]}
                    </span>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Lightbox */}
      {lightbox !== null && currentPhoto && (
        <div className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center" onClick={closeLightbox}>
          <div className="relative max-w-4xl max-h-full p-4 w-full" onClick={e => e.stopPropagation()}>
            <button onClick={closeLightbox} aria-label="Close photo" className="absolute top-2 right-2 text-white hover:text-gray-300 z-10">
              <X className="h-6 w-6" />
            </button>
            <img src={currentPhoto.url} alt={currentPhoto.caption ?? ''} className="max-h-[70vh] mx-auto rounded-lg object-contain" />

            {/* Caption */}
            {currentPhoto.caption && (
              <p className="text-center text-white/80 text-sm mt-2">{currentPhoto.caption}</p>
            )}

            {/* Tags */}
            <div className="mt-3 flex flex-wrap justify-center gap-2">
              {currentPhoto.tags.map(t => (
                <span key={t.person_id} className="bg-white/20 text-white text-xs px-2 py-1 rounded-full flex items-center gap-1">
                  {t.person_name}
                  {currentPersonId && (
                    <button onClick={() => handleUntag(currentPhoto.id, t.person_id)} aria-label={`Remove tag ${t.person_name}`} className="hover:text-red-400 ml-0.5">
                      <X className="h-3 w-3" />
                    </button>
                  )}
                </span>
              ))}
            </div>

            {/* Action buttons */}
            <div className="mt-3 flex justify-center gap-2">
              {currentPersonId && (
                <>
                  <Button size="sm" variant="secondary" onClick={() => { setTagTarget(currentPhoto.id); setTagSearch('') }}>
                    <Tag className="h-3.5 w-3.5 mr-1" /> Tag
                  </Button>
                </>
              )}
              {canDelete(currentPhoto) && (
                <Button size="sm" variant="destructive" onClick={() => handleDelete(currentPhoto)} disabled={isPending}>
                  <Trash2 className="h-3.5 w-3.5 mr-1" /> Delete
                </Button>
              )}
            </div>

            {/* Tag search dropdown */}
            {tagTarget === currentPhoto.id && (
              <div className="mt-2 mx-auto max-w-xs bg-background border rounded-lg p-2 space-y-1">
                <Input
                  placeholder="Search member…"
                  value={tagSearch}
                  onChange={e => setTagSearch(e.target.value)}
                  className="h-7 text-sm"
                  autoFocus
                />
                <ul className="max-h-40 overflow-y-auto space-y-0.5">
                  {filteredMembers.filter(m => !currentPhoto.tags.some(t => t.person_id === m.id)).map(m => (
                    <li key={m.id}>
                      <button
                        onClick={() => handleTag(currentPhoto.id, m.id)}
                        className="w-full text-left text-sm px-2 py-1 rounded hover:bg-muted"
                      >
                        {formatPersonName(m)}
                      </button>
                    </li>
                  ))}
                </ul>
                <button onClick={() => setTagTarget(null)} className="text-xs text-muted-foreground">Cancel</button>
              </div>
            )}

            {/* Nav arrows */}
            {lightbox > 0 && (
              <button onClick={prevPhoto} aria-label="Previous photo" className="absolute left-2 top-1/2 -translate-y-1/2 text-white/70 hover:text-white">
                <ChevronLeft className="h-8 w-8" />
              </button>
            )}
            {lightbox < photos.length - 1 && (
              <button onClick={nextPhoto} aria-label="Next photo" className="absolute right-2 top-1/2 -translate-y-1/2 text-white/70 hover:text-white">
                <ChevronRight className="h-8 w-8" />
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
