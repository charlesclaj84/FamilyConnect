'use client'

import { useMemo, useRef, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import {
  Check, ChevronLeft, ChevronRight, LayoutGrid, List, Loader2, Pencil, Tag, Trash2, Upload, X,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Dialog } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select } from '@/components/ui/select'
import { useConfirm } from '@/components/ui/confirm'
import { FormError } from '@/components/ui/form-message'
import { useServerState } from '@/lib/use-server-state'
import { formatPersonName } from '@/lib/name-utils'
import { matchesPersonQuery } from '@/lib/person-search'
import { IMAGE_FORMATS, acceptAttribute, formatList, isAllowedUpload } from '@/lib/upload-types'
import {
  deletePhoto, tagPersonInPhoto, untagPersonFromPhoto, updatePhotoCaption, uploadPhotos,
  type GalleryRights, type Photo,
} from '@/app/actions/gallery'

interface Person { id: string; first_name: string; last_name: string; nick_name?: string | null }

/**
 * One album: its photographs, and everything a member may do to them.
 *
 * ── FOUR THINGS ARRIVED ON 2026-08-22 AND EACH ANSWERS A REPORTED GAP ──────────────
 *
 *   MANY AT ONCE      the picker is `multiple` and the action takes a batch. A reunion is
 *                     forty photographs and the old control took one, with a caption box
 *                     above it, forty times.
 *   FILTER BY TAG     a hundred and forty photographs is a scroll; "show me the ones with
 *                     Martha in" is the question people actually bring to a family album.
 *   A LIST VIEW       smaller pictures, one per row, with the caption and the tags EDITABLE
 *                     in place. The grid is for looking; the list is for tidying up, and
 *                     doing both in a lightbox meant opening every photograph to fix a
 *                     caption.
 *   AN OWNER RULE     only the uploader — or somebody holding the unrestricted grant — may
 *                     change a caption or delete. It used to be that only DELETE was bounded,
 *                     and only by the policy underneath rather than by anything on screen.
 *
 * ── THE RIGHTS ARE PROPS AND ARE NOT THE GATE ──────────────────────────────────────
 * `rights` is resolved by the page and every action re-resolves its own grant, because a
 * `'use server'` export has a URL whether or not a control exists (AGENTS.md §2). What these
 * buy is not showing somebody a button that will refuse them.
 *
 * ── `useServerState`, NOT `useState` ───────────────────────────────────────────────
 * A plain initializer reads the prop once and ignores every later server render, including the
 * `router.refresh()` this component fires after an upload — and an uploaded photograph's URL
 * only exists once the server has read the row back, so the refresh is how it appears at all.
 */
export function CollectionView({
  collectionId, initialPhotos, currentPersonId, rights, allMembers,
}: {
  collectionId: string
  initialPhotos: Photo[]
  currentPersonId: string | null
  rights: GalleryRights
  allMembers: Person[]
}) {
  const router = useRouter()
  const confirm = useConfirm()
  const [photos, setPhotos] = useServerState(initialPhotos)
  const [view, setView] = useState<'grid' | 'list'>('grid')
  const [tagFilter, setTagFilter] = useState('')
  const [lightbox, setLightbox] = useState<number | null>(null)
  const [uploadOpen, setUploadOpen] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [isPending, startTransition] = useTransition()

  const mine = (p: Photo) => currentPersonId !== null && p.uploader_id === currentPersonId
  const mayEdit = (p: Photo) => rights.editAny || (rights.editOwn && mine(p))
  const mayDelete = (p: Photo) => rights.deleteAny || mine(p)

  /**
   * EVERY PERSON TAGGED ANYWHERE IN THIS ALBUM, for the filter.
   *
   * Built from the photographs rather than from the roster, and that is the decision: a
   * hundred and forty names in a dropdown of which four appear in this album is a control
   * nobody can use. Sorted by name so the list does not reorder as photographs are added.
   */
  const taggedPeople = useMemo(() => {
    const byId = new Map<string, string>()
    for (const p of photos) for (const t of p.tags) byId.set(t.person_id, t.person_name)
    return [...byId.entries()]
      .map(([id, name]) => ({ id, name }))
      .sort((a, b) => a.name.localeCompare(b.name))
  }, [photos])

  const shown = useMemo(
    () => (tagFilter ? photos.filter(p => p.tags.some(t => t.person_id === tagFilter)) : photos),
    [photos, tagFilter],
  )

  // THE LIGHTBOX INDEXES INTO THE FILTERED LIST, not the full one, so the arrows walk what the
  // reader is actually looking at. Filtering while it is open would otherwise show a
  // photograph the filter excludes.
  const currentPhoto = lightbox !== null ? shown[lightbox] ?? null : null

  function afterChange(message?: string) {
    setNotice(message ?? '')
    startTransition(() => router.refresh())
  }

  async function handleDelete(photo: Photo) {
    const ok = await confirm({
      title: 'Delete photograph',
      description: photo.caption
        ? `Delete “${photo.caption}”? It is removed for everyone, along with its tags, and the image file goes too. This cannot be undone.`
        : 'Delete this photograph? It is removed for everyone, along with its tags, and the image file goes too. This cannot be undone.',
      confirmLabel: 'Delete photograph',
      destructive: true,
    })
    if (!ok) return
    setError('')
    startTransition(async () => {
      const result = await deletePhoto(photo.id)
      if (!result.success) { setError(result.message ?? 'Could not delete that.'); return }
      setPhotos(prev => prev.filter(p => p.id !== photo.id))
      setLightbox(null)
      router.refresh()
    })
  }

  return (
    <div className="space-y-4">
      {/* ── The bar: how to look, what to look at, and how to add ──────────────────── */}
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="flex flex-wrap items-end gap-3">
          {/* TWO REAL BUTTONS AND NOT A `role="tablist"`, for `MainRail`'s reason: that role
              promises arrow-key roving focus and `aria-controls` wiring, and claiming it
              without implementing it strands the users it is aimed at. `aria-pressed` is what
              is actually true here — two toggles, one of which is on. */}
          <div className="flex rounded-lg border p-0.5" role="group" aria-label="How to show the photographs">
            <button type="button" onClick={() => setView('grid')} aria-pressed={view === 'grid'}
              className={`flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-medium transition-colors ${
                view === 'grid' ? 'bg-brand-soft text-brand-on-soft' : 'text-muted-foreground hover:text-foreground'}`}>
              <LayoutGrid className="h-3.5 w-3.5" /> Grid
            </button>
            <button type="button" onClick={() => setView('list')} aria-pressed={view === 'list'}
              className={`flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-medium transition-colors ${
                view === 'list' ? 'bg-brand-soft text-brand-on-soft' : 'text-muted-foreground hover:text-foreground'}`}>
              <List className="h-3.5 w-3.5" /> List
            </button>
          </div>

          {/* ONLY WHEN SOMEBODY IS TAGGED. A filter over an empty set is a control that cannot
              do anything, which is the same argument the single-office journal makes about a
              one-item rail. */}
          {taggedPeople.length > 0 && (
            <div className="space-y-1">
              <Label htmlFor="tag-filter" className="text-xs">Who is in it</Label>
              <Select id="tag-filter" value={tagFilter}
                onChange={e => { setTagFilter(e.target.value); setLightbox(null) }}
                className="w-52">
                <option value="">Everybody</option>
                {taggedPeople.map(p => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
              </Select>
            </div>
          )}
        </div>

        {rights.upload && (
          <Button onClick={() => { setUploadOpen(true); setError(''); setNotice('') }}>
            <Upload /> Add photographs
          </Button>
        )}
      </div>

      <FormError message={error} />
      {notice && (
        <p className="rounded-lg border border-dashed bg-muted/30 px-3 py-2 text-xs text-muted-foreground">
          {notice}
        </p>
      )}

      {tagFilter && (
        <p className="text-xs text-muted-foreground">
          {shown.length} of {photos.length} photograph{photos.length === 1 ? '' : 's'} show{' '}
          {taggedPeople.find(p => p.id === tagFilter)?.name}.{' '}
          <button type="button" className="underline underline-offset-4"
            onClick={() => setTagFilter('')}>Show everybody</button>
        </p>
      )}

      {photos.length === 0 ? (
        <p className="py-8 text-center text-sm text-muted-foreground">
          No photographs in this album yet.
        </p>
      ) : shown.length === 0 ? (
        <p className="py-8 text-center text-sm text-muted-foreground">
          Nobody is tagged in a photograph here.
        </p>
      ) : view === 'grid' ? (
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
          {shown.map((photo, idx) => (
            <button
              key={photo.id}
              type="button"
              onClick={() => setLightbox(idx)}
              aria-label={photo.caption ? `Open “${photo.caption}”` : 'Open this photograph'}
              className="group relative aspect-square overflow-hidden rounded-lg bg-muted"
            >
              {/* Plain <img> — see CollectionCard for the whole argument. This is the grid
                  that would benefit most from resizing and the one TODO.md's entry is really
                  about: N uploads of up to 10 MB each, rendered at a quarter width. */}
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={photo.url} alt={photo.caption ?? ''}
                className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105" />
              {photo.tags.length > 0 && (
                <span className="absolute bottom-1 left-1 flex flex-wrap gap-0.5">
                  {photo.tags.slice(0, 3).map(t => (
                    <span key={t.person_id} className="rounded bg-black/60 px-1 py-0.5 text-[10px] text-white">
                      {t.person_name.split(' ')[0]}
                    </span>
                  ))}
                </span>
              )}
            </button>
          ))}
        </div>
      ) : (
        <ul className="divide-y rounded-xl border">
          {shown.map(photo => (
            <PhotoRow
              key={photo.id}
              photo={photo}
              allMembers={allMembers}
              mayEdit={mayEdit(photo)}
              mayDelete={mayDelete(photo)}
              busy={isPending}
              onChanged={afterChange}
              onError={setError}
              onDelete={() => handleDelete(photo)}
            />
          ))}
        </ul>
      )}

      {uploadOpen && (
        <UploadDialog
          collectionId={collectionId}
          onClose={() => setUploadOpen(false)}
          onDone={(count, failures) => {
            setUploadOpen(false)
            setNotice(
              failures.length === 0
                ? `${count} photograph${count === 1 ? '' : 's'} added.`
                : `${count} added. ${failures.length} did not: ${failures.join(' ')}`,
            )
            router.refresh()
          }}
        />
      )}

      {currentPhoto && (
        <Lightbox
          photo={currentPhoto}
          index={lightbox as number}
          total={shown.length}
          onClose={() => setLightbox(null)}
          onPrev={() => setLightbox(i => (i !== null && i > 0 ? i - 1 : i))}
          onNext={() => setLightbox(i => (i !== null && i < shown.length - 1 ? i + 1 : i))}
          mayDelete={mayDelete(currentPhoto)}
          onDelete={() => handleDelete(currentPhoto)}
          busy={isPending}
        />
      )}
    </div>
  )
}

/**
 * The upload dialog: many files, one caption, and a per-file verdict.
 *
 * THE FILES ARE CHECKED HERE AS WELL AS ON THE SERVER, and the point of the client copy is
 * SPEED of feedback rather than safety: a member who drags in a folder with a `.heic` in it
 * learns which one before waiting for forty uploads. `lib/upload-types.ts` is the one list, so
 * the two answers cannot differ. The server's copy is the gate.
 */
function UploadDialog({ collectionId, onClose, onDone }: {
  collectionId: string
  onClose: () => void
  onDone: (uploaded: number, failed: string[]) => void
}) {
  const [files, setFiles] = useState<File[]>([])
  const [caption, setCaption] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  const rejected = files.filter(f => !isAllowedUpload(f.name, f.type, IMAGE_FORMATS))
  const accepted = files.filter(f => isAllowedUpload(f.name, f.type, IMAGE_FORMATS))

  async function submit() {
    if (accepted.length === 0) { setError('Choose at least one image.'); return }
    setError(''); setBusy(true)
    const fd = new FormData()
    for (const f of accepted) fd.append('files', f)
    fd.append('caption', caption)
    const result = await uploadPhotos(collectionId, fd)
    setBusy(false)
    if (!result.success && result.uploaded === 0) {
      setError(result.failed.join(' ') || result.message || 'Nothing was uploaded.')
      return
    }
    onDone(result.uploaded, result.failed)
  }

  return (
    <Dialog open onClose={busy ? () => {} : onClose} title="Add photographs"
      description={`${formatList(IMAGE_FORMATS)}, up to 10 MB each.`}>
      <div className="space-y-3">
        <input
          ref={inputRef}
          type="file"
          multiple
          accept={acceptAttribute(IMAGE_FORMATS)}
          className="hidden"
          onChange={e => { setFiles(Array.from(e.target.files ?? [])); setError('') }}
        />
        <Button size="sm" variant="outline" onClick={() => inputRef.current?.click()} disabled={busy}>
          <Upload /> Choose files
        </Button>

        {files.length > 0 && (
          <div className="rounded-lg border bg-muted/30 p-2.5 text-xs">
            <p className="font-medium">
              {accepted.length} image{accepted.length === 1 ? '' : 's'} ready
            </p>
            {/* THE REFUSALS ARE LISTED BY NAME, never as a count. "3 files were skipped" makes
                somebody open the picker again to work out which. */}
            {rejected.length > 0 && (
              <ul className="mt-1.5 space-y-0.5 text-brand-withheld">
                {rejected.map(f => (
                  <li key={f.name}>{f.name} is not {formatList(IMAGE_FORMATS)} — it will be skipped.</li>
                ))}
              </ul>
            )}
          </div>
        )}

        <div className="space-y-1.5">
          <Label htmlFor="batch-caption">Caption for all of them (optional)</Label>
          <Input id="batch-caption" value={caption} onChange={e => setCaption(e.target.value)}
            placeholder="Saturday, at the lake" />
          <p className="text-xs text-muted-foreground">
            One caption for the batch. Change an individual one afterwards in the list view.
          </p>
        </div>

        <FormError message={error} />

        <div className="flex gap-2">
          <Button size="sm" variant="affirm" onClick={submit} disabled={busy || accepted.length === 0}>
            {busy && <Loader2 className="animate-spin" />}
            {busy
              ? `Uploading ${accepted.length}…`
              : `Upload ${accepted.length || ''} photograph${accepted.length === 1 ? '' : 's'}`}
          </Button>
          <Button size="sm" variant="ghost" onClick={onClose} disabled={busy}>Cancel</Button>
        </div>
      </div>
    </Dialog>
  )
}

/**
 * One photograph in the list view: a thumbnail, an editable caption, and its tags.
 *
 * THIS IS WHERE TIDYING UP HAPPENS, which is why the caption is an input rather than a line of
 * text with a pencil beside it: somebody in here is fixing several in a row.
 */
function PhotoRow({ photo, allMembers, mayEdit, mayDelete, busy, onChanged, onError, onDelete }: {
  photo: Photo
  allMembers: Person[]
  mayEdit: boolean
  mayDelete: boolean
  busy: boolean
  onChanged: (message?: string) => void
  onError: (message: string) => void
  onDelete: () => void
}) {
  const confirm = useConfirm()
  const [caption, setCaption] = useState(photo.caption ?? '')
  const [editing, setEditing] = useState(false)
  const [tagging, setTagging] = useState(false)
  const [query, setQuery] = useState('')
  const [isPending, startTransition] = useTransition()

  const untagged = allMembers.filter(m =>
    !photo.tags.some(t => t.person_id === m.id)
    && matchesPersonQuery(m, formatPersonName(m), query))

  function saveCaption() {
    startTransition(async () => {
      const result = await updatePhotoCaption(photo.id, caption)
      if (!result.success) { onError(result.message ?? 'Could not save that caption.'); return }
      setEditing(false)
      onChanged()
    })
  }

  function addTag(personId: string) {
    startTransition(async () => {
      const result = await tagPersonInPhoto(photo.id, personId)
      if (!result.success) { onError(result.message ?? 'Could not add that tag.'); return }
      setTagging(false); setQuery('')
      onChanged()
    })
  }

  async function removeTag(personId: string, name: string) {
    const ok = await confirm({
      title: 'Remove tag',
      description: `Remove the tag for ${name} from this photograph?`,
      confirmLabel: 'Remove tag',
      destructive: true,
    })
    if (!ok) return
    startTransition(async () => {
      const result = await untagPersonFromPhoto(photo.id, personId)
      if (!result.success) { onError(result.message ?? 'Could not remove that tag.'); return }
      onChanged()
    })
  }

  return (
    <li className="flex flex-col gap-3 p-3 sm:flex-row">
      {/* SMALLER IMAGES, which is what the list view is for. `h-20 w-20` is big enough to know
          which photograph it is and small enough that thirty fit on a screen. */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={photo.url} alt={photo.caption ?? ''}
        className="h-20 w-20 shrink-0 rounded-lg object-cover" />

      <div className="min-w-0 flex-1 space-y-2">
        {editing ? (
          <div className="flex flex-wrap items-center gap-2">
            <Input value={caption} onChange={e => setCaption(e.target.value)}
              placeholder="No caption" className="max-w-sm" autoFocus
              aria-label="Caption" />
            <Button size="sm" variant="affirm" onClick={saveCaption} disabled={isPending || busy}>
              <Check /> Save
            </Button>
            <Button size="sm" variant="ghost" disabled={isPending || busy}
              onClick={() => { setCaption(photo.caption ?? ''); setEditing(false) }}>
              Cancel
            </Button>
          </div>
        ) : (
          <div className="flex flex-wrap items-center gap-2">
            <p className={`text-sm ${photo.caption ? '' : 'italic text-muted-foreground'}`}>
              {photo.caption || 'No caption'}
            </p>
            {mayEdit && (
              <button type="button" onClick={() => setEditing(true)}
                aria-label="Change this caption"
                className="text-muted-foreground hover:text-foreground">
                <Pencil className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
        )}

        <p className="text-xs text-muted-foreground">
          {photo.uploader_name ? `Added by ${photo.uploader_name}` : 'Added by somebody no longer in this family'}
        </p>

        <div className="flex flex-wrap items-center gap-1.5">
          {photo.tags.map(t => (
            <span key={t.person_id}
              className="inline-flex items-center gap-1 rounded-full bg-brand-soft px-2 py-0.5 text-xs text-brand-on-soft">
              {t.person_name}
              {mayEdit && (
                <button type="button" onClick={() => removeTag(t.person_id, t.person_name)}
                  aria-label={`Remove the tag for ${t.person_name}`}
                  disabled={isPending || busy}
                  className="hover:text-destructive">
                  <X className="h-3 w-3" />
                </button>
              )}
            </span>
          ))}
          {mayEdit && !tagging && (
            <button type="button" onClick={() => { setTagging(true); setQuery('') }}
              className="inline-flex items-center gap-1 rounded-full border border-dashed px-2 py-0.5 text-xs text-muted-foreground hover:text-foreground">
              <Tag className="h-3 w-3" /> Tag somebody
            </button>
          )}
        </div>

        {tagging && (
          <div className="max-w-xs space-y-1 rounded-lg border bg-muted/30 p-2">
            {/* `matchesPersonQuery` — the SHARED matcher, so this searches accents and
                punctuation the same way both person pickers do. This component was named in
                AGENTS.md's "Known gaps" as the third hand-rolled `.includes()` copy; it is
                the shared one now. */}
            <Input value={query} onChange={e => setQuery(e.target.value)}
              placeholder="Search the family…" className="h-7 text-sm" autoFocus
              aria-label="Search for somebody to tag" />
            <ul className="max-h-40 space-y-0.5 overflow-y-auto">
              {untagged.length === 0 ? (
                <li className="px-2 py-1 text-xs text-muted-foreground">Nobody matches.</li>
              ) : untagged.slice(0, 40).map(m => (
                <li key={m.id}>
                  <button type="button" onClick={() => addTag(m.id)} disabled={isPending}
                    className="w-full rounded px-2 py-1 text-left text-sm hover:bg-brand-soft">
                    {formatPersonName(m)}
                  </button>
                </li>
              ))}
            </ul>
            {untagged.length > 40 && (
              <p className="px-2 text-xs text-muted-foreground">
                {untagged.length - 40} more — keep typing to narrow it.
              </p>
            )}
            <button type="button" onClick={() => setTagging(false)}
              className="px-2 text-xs text-muted-foreground">Cancel</button>
          </div>
        )}
      </div>

      {mayDelete && (
        <Button size="sm" variant="ghost" onClick={onDelete} disabled={isPending || busy}
          className="self-start text-destructive hover:text-destructive">
          <Trash2 /> Delete
        </Button>
      )}
    </li>
  )
}

/** The full-size view. The one place the whole file is the point. */
function Lightbox({ photo, index, total, onClose, onPrev, onNext, mayDelete, onDelete, busy }: {
  photo: Photo
  index: number
  total: number
  onClose: () => void
  onPrev: () => void
  onNext: () => void
  mayDelete: boolean
  onDelete: () => void
  busy: boolean
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/90" onClick={onClose}>
      <div className="relative max-h-full w-full max-w-4xl p-4" onClick={e => e.stopPropagation()}>
        <button onClick={onClose} aria-label="Close photograph"
          className="absolute right-2 top-2 z-10 text-white hover:text-white/70">
          <X className="h-6 w-6" />
        </button>

        {/* THE ONE PLACE THE FULL-SIZE FILE IS THE POINT, so even if the grids ever move to
            next/image, this one should not: somebody has clicked a photograph to look at it.
            It also has no fixed box to fill — `max-h-[70vh] object-contain` with a free aspect
            ratio is exactly what `fill` cannot express without inventing dimensions. */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={photo.url} alt={photo.caption ?? ''}
          className="mx-auto max-h-[70vh] rounded-lg object-contain" />

        {photo.caption && <p className="mt-2 text-center text-sm text-white/80">{photo.caption}</p>}

        {photo.tags.length > 0 && (
          <p className="mt-3 flex flex-wrap justify-center gap-2">
            {photo.tags.map(t => (
              <span key={t.person_id} className="rounded-full bg-white/20 px-2 py-1 text-xs text-white">
                {t.person_name}
              </span>
            ))}
          </p>
        )}

        {/* TAGGING AND CAPTIONING ARE NOT HERE, DELIBERATELY. They were, and it meant opening a
            photograph full-screen to fix a typo — and then doing it again for the next one.
            They live in the list view, which is the surface for that job. */}
        <div className="mt-3 flex justify-center gap-2">
          {mayDelete && (
            <Button size="sm" variant="destructive" onClick={onDelete} disabled={busy}>
              <Trash2 /> Delete
            </Button>
          )}
        </div>
        <p className="mt-2 text-center text-xs text-white/50">{index + 1} of {total}</p>

        {index > 0 && (
          <button onClick={onPrev} aria-label="Previous photograph"
            className="absolute left-2 top-1/2 -translate-y-1/2 text-white/70 hover:text-white">
            <ChevronLeft className="h-8 w-8" />
          </button>
        )}
        {index < total - 1 && (
          <button onClick={onNext} aria-label="Next photograph"
            className="absolute right-2 top-1/2 -translate-y-1/2 text-white/70 hover:text-white">
            <ChevronRight className="h-8 w-8" />
          </button>
        )}
      </div>
    </div>
  )
}
