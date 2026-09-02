'use client'

import { useMemo, useRef, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import {
  Check, ChevronLeft, ChevronRight, LayoutGrid, List, Loader2, Pencil, Search, SlidersHorizontal,
  Tag, Trash2, Upload, X,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Dialog } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { PersonMultiSelect } from '@/components/ui/person-multi-select'
import { useConfirm } from '@/components/ui/confirm'
import { FormError } from '@/components/ui/form-message'
import { useServerState } from '@/lib/use-server-state'
import { formatPersonName } from '@/lib/name-utils'
import { matchesPersonQuery } from '@/lib/person-search'
import { matchesCaption } from '@/lib/photo-search'
import { cn } from '@/lib/utils'
import { IMAGE_FORMATS, acceptAttribute, formatList, isAllowedUpload } from '@/lib/upload-types'
import {
  createPhotoUploadTickets, deletePhoto, recordUploadedPhotos, tagPersonInPhoto,
  untagPersonFromPhoto, updatePhotoCaption,
  type GalleryRights, type Photo,
} from '@/app/actions/gallery'
import { PHOTO_UPLOAD_CHUNK } from '@/lib/photo-upload'
import { createClient } from '@/lib/supabase/client'
import { useT } from '@/components/layout/LocaleProvider'

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
  const t = useT()
  const router = useRouter()
  const confirm = useConfirm()
  const [photos, setPhotos] = useServerState(initialPhotos)
  const [view, setView] = useState<'grid' | 'list'>('grid')
  // TWO FILTERS SINCE 2026-08-22, AND `tagFilter` IS A LIST NOW. It was one person, chosen
  // from a `<Select>`, which answers "show me the ones with Ada in" and cannot answer "show
  // me the ones with any of these three". A photograph matches when it carries ANY of the
  // chosen people — the union, not the intersection: the control is captioned "who you want
  // to see" and narrowing to photographs holding ALL of them is a different question, one a
  // reader would have to be told the control was asking.
  const [tagFilter, setTagFilter] = useState<string[]>([])
  const [captionQuery, setCaptionQuery] = useState('')
  const [filtersOpen, setFiltersOpen] = useState(false)
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

  // The tagged people as `SelectablePerson`s, so the shared control can disambiguate two
  // Martha Allens and search accents and punctuation the way it does everywhere else. Taken
  // from the roster where the roster has them and synthesized from the embedded tag name
  // where it does not — a tag can outlive a change to who this caller may read.
  const taggablePeople = useMemo(() => {
    const roster = new Map(allMembers.map(m => [m.id, m]))
    return taggedPeople.map(t => roster.get(t.id) ?? {
      id: t.id,
      first_name: t.name.split(' ')[0] ?? t.name,
      last_name: t.name.split(' ').slice(1).join(' '),
    })
  }, [taggedPeople, allMembers])

  const shown = useMemo(() => {
    const wanted = new Set(tagFilter)
    return photos.filter(p =>
      (wanted.size === 0 || p.tags.some(t => wanted.has(t.person_id)))
      && matchesCaption(p.caption, captionQuery))
  }, [photos, tagFilter, captionQuery])

  const filterCount = tagFilter.length + (captionQuery.trim() ? 1 : 0)
  function clearFilters() {
    setTagFilter([])
    setCaptionQuery('')
    setLightbox(null)
  }

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
      title: t('gal.deletePhoto'),
      description: photo.caption
        ? t('gal.deletePhotoNamedConfirm', { caption: photo.caption })
        : t('gal.deletePhotoBody'),
      confirmLabel: t('gal.deletePhoto'),
      destructive: true,
    })
    if (!ok) return
    setError('')
    startTransition(async () => {
      const result = await deletePhoto(photo.id)
      if (!result.success) { setError(result.message ?? t('gal.deletePhotoFailed')); return }
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
          <div className="flex rounded-lg border p-0.5" role="group" aria-label={t('gal.howToShow')}>
            <button type="button" onClick={() => setView('grid')} aria-pressed={view === 'grid'}
              className={`flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-medium transition-colors ${
                view === 'grid' ? 'bg-brand-soft text-brand-on-soft' : 'text-muted-foreground hover:text-foreground'}`}>
              <LayoutGrid className="h-3.5 w-3.5" /> {t('gal.grid')}
            </button>
            <button type="button" onClick={() => setView('list')} aria-pressed={view === 'list'}
              className={`flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-medium transition-colors ${
                view === 'list' ? 'bg-brand-soft text-brand-on-soft' : 'text-muted-foreground hover:text-foreground'}`}>
              <List className="h-3.5 w-3.5" /> {t('gal.list')}
            </button>
          </div>

          {/* ── SEARCH THE CAPTIONS ──────────────────────────────────────────────────
              Added 2026-08-22. It is in the bar rather than behind the disclosure below
              because it is the filter somebody arrives WANTING — "the one of the boat" —
              whereas narrowing by who is in a photograph is a second thought. The matching
              rule is `lib/photo-search.ts` and not a `.includes()` here, for the reason
              `lib/person-search.ts` exists: a rule inside a component can only be shared by
              copying it, and copying it is how the Directory came to search accents while
              the tagger did not. */}
          <div className="space-y-1">
            <Label htmlFor="caption-search" className="text-xs">{t('gal.searchCaptions')}</Label>
            <div className="relative">
              <Search className="pointer-events-none absolute start-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
              <Input
                id="caption-search"
                type="search"
                value={captionQuery}
                onChange={e => { setCaptionQuery(e.target.value); setLightbox(null) }}
                placeholder={t('gal.searchCaptionsPh')}
                className="w-56 ps-8"
              />
            </div>
          </div>

          {/* ── WHO IS IN IT, BEHIND A DISCLOSURE ────────────────────────────────────
              ONLY WHEN SOMEBODY IS TAGGED. A filter over an empty set is a control that
              cannot do anything, which is the same argument the single-office journal makes
              about a one-item rail.

              IT IS `PersonMultiSelect` NOW, not a `<Select>`: the ask is to choose the tags
              you want to SEE, plural, and a single-select cannot express it. That control is
              the codebase's standard answer to "choose several members" — it searches
              accents and punctuation, disambiguates two Martha Allens against the whole set,
              keeps the choice on screen as chips when a search would otherwise hide it, and
              bounds its own height so the size of the family cannot push the grid off the
              page. Hand-rolling a fourth copy of that is the gap AGENTS.md records about
              this very screen.

              BEHIND A TOGGLE because it is a block rather than a field, and a block sitting
              open above the photographs costs a screenful whether or not anybody is using
              it. The count on the trigger is what stops a collapsed filter from being a
              silently applied one. */}
          {taggedPeople.length > 0 && (
            <button
              type="button"
              onClick={() => setFiltersOpen(o => !o)}
              aria-expanded={filtersOpen}
              aria-controls="who-is-in-it"
              className={cn(
                'flex items-center gap-1.5 rounded-lg border px-2.5 py-2 text-xs font-medium transition-colors',
                tagFilter.length > 0
                  ? 'border-brand-primary/40 bg-brand-soft text-brand-on-soft'
                  : 'text-muted-foreground hover:text-foreground',
              )}
            >
              <SlidersHorizontal className="h-3.5 w-3.5" aria-hidden="true" />
              Who is in it
              {tagFilter.length > 0 && (
                <span className="rounded-full bg-brand-primary px-1.5 text-[10px] font-semibold text-brand-on-primary">
                  {tagFilter.length}
                </span>
              )}
            </button>
          )}
        </div>

        {rights.upload && (
          <Button onClick={() => { setUploadOpen(true); setError(''); setNotice('') }}>
            <Upload /> {t('gal.addPhotos')}
          </Button>
        )}
      </div>

      <FormError message={error} />
      {notice && (
        <p className="rounded-lg border border-dashed bg-muted/30 px-3 py-2 text-xs text-muted-foreground">
          {notice}
        </p>
      )}

      {/* THE PANEL THE TRIGGER OPENS. It is rendered rather than hidden with CSS so the
          control is out of the tab order when it is closed. */}
      {filtersOpen && taggedPeople.length > 0 && (
        <div id="who-is-in-it" className="rounded-xl border bg-card p-4">
          <PersonMultiSelect
            people={taggablePeople}
            selected={tagFilter}
            onChange={next => { setTagFilter(next); setLightbox(null) }}
            label={t('gal.whoIsInIt')}
            hint={t('gal.whoHint')}
            emptyMessage={t('gal.nobodyTagged')}
          />
        </div>
      )}

      {/* ── WHAT THE FILTERS ARE DOING, IN ONE LINE ─────────────────────────────────
          Both filters report through here, so the reader is never looking at a narrowed
          grid with nothing on screen saying it has been narrowed. It counts against
          `photos.length`, which is the whole album — a fraction of a filtered set would be
          a figure that means nothing. */}
      {filterCount > 0 && (
        <p className="text-xs text-muted-foreground">
          Showing {shown.length} of {photos.length} photograph{photos.length === 1 ? '' : 's'}
          {captionQuery.trim() && <> whose caption matches <strong className="font-medium">{captionQuery.trim()}</strong></>}
          {captionQuery.trim() && tagFilter.length > 0 && ' and'}
          {tagFilter.length > 0 && (
            <> with {tagFilter
              .map(id => taggedPeople.find(t => t.id === id)?.name ?? 'somebody')
              .join(', ')} in {tagFilter.length === 1 ? 'it' : 'one of them'}</>
          )}.{' '}
          <button type="button" className="underline underline-offset-4" onClick={clearFilters}>
            {t('gal.clearFilters')}
          </button>
        </p>
      )}

      {photos.length === 0 ? (
        <p className="py-8 text-center text-sm text-muted-foreground">
          {t('gal.noneInAlbum')}
        </p>
      ) : shown.length === 0 ? (
        // TWO FILTERS NOW, SO THE EMPTY STATE HAS TO SAY WHICH ONE EMPTIED IT. It read
        // "Nobody is tagged in a photograph here", which was already only half true with one
        // filter and is a plain lie with a caption search applied — the album HAS
        // photographs, and the reader has hidden them.
        <div className="py-8 text-center">
          <p className="text-sm text-muted-foreground">
            {t('gal.noneMatch')}
          </p>
          <button type="button" onClick={clearFilters}
            className="mt-2 text-xs text-muted-foreground underline underline-offset-4">
            {t('gal.clearFilters')}
          </button>
        </div>
      ) : view === 'grid' ? (
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
          {shown.map((photo, idx) => (
            <button
              key={photo.id}
              type="button"
              onClick={() => setLightbox(idx)}
              aria-label={photo.caption ? `Open “${photo.caption}”` : t('gal.openPhoto')}
              className="group relative aspect-square overflow-hidden rounded-lg bg-muted"
            >
              {/* Plain <img> — see CollectionCard for the whole argument. This is the grid
                  that would benefit most from resizing and the one TODO.md's entry is really
                  about: N uploads of up to 10 MB each, rendered at a quarter width. */}
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={photo.url} alt={photo.caption ?? ''}
                className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105" />
              {photo.tags.length > 0 && (
                <span className="absolute bottom-1 start-1 flex flex-wrap gap-0.5">
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
                ? t(count === 1 ? 'gal.photographsAddedOne' : 'gal.photographsAddedMany',
                    { n: String(count) })
                : t('gal.addedSomeFailed', {
                    added: String(count),
                    failed: String(failures.length),
                    reasons: failures.join(' '),
                  }),
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
 *
 * ── THE BYTES GO STRAIGHT TO STORAGE, IN ROUNDS OF `PHOTO_UPLOAD_CHUNK` ────────────
 * Reported 2026-09-01 as a 500 on adding several at once. This used to put every file in one
 * `FormData` and hand it to a server action, which is a request body Next.js caps at 1 MB and
 * Vercel caps at 4.5 MB — so a batch never arrived, and the refusal came from the framework
 * with nothing to print. `app/actions/gallery.ts`' header argues it at length.
 *
 * Each round is: ask for tickets, PUT each file at its signed URL, record the rows. Three
 * things about that are load-bearing:
 *
 *   THE ROUNDS ARE SEQUENTIAL and the files inside one are concurrent. A phone on a slow
 *   connection uploading two hundred files at once is two hundred stalled sockets; twelve is
 *   a batch a browser schedules sensibly.
 *
 *   A ROUND'S FAILURES DO NOT STOP THE NEXT ROUND, for the same reason one bad file never
 *   stopped a batch: forty photographs with one refusal in them should leave thirty-nine in
 *   the album. Everything that did not land is collected and named.
 *
 *   PROGRESS IS COUNTED IN FILES, not rounds. "Uploading 27 of 200" is the only thing worth
 *   showing while a reunion goes up, and the old single call could not show anything at all.
 */
function UploadDialog({ collectionId, onClose, onDone }: {
  collectionId: string
  onClose: () => void
  onDone: (uploaded: number, failed: string[]) => void
}) {
  const t = useT()
  const [files, setFiles] = useState<File[]>([])
  const [caption, setCaption] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [done, setDone] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)

  const rejected = files.filter(f => !isAllowedUpload(f.name, f.type, IMAGE_FORMATS))
  const accepted = files.filter(f => isAllowedUpload(f.name, f.type, IMAGE_FORMATS))

  async function submit() {
    if (accepted.length === 0) { setError(t('gal.chooseImage')); return }
    setError(''); setBusy(true); setDone(0)

    const storage = createClient().storage.from('photos')
    const failed: string[] = []
    let uploaded = 0

    for (let i = 0; i < accepted.length; i += PHOTO_UPLOAD_CHUNK) {
      const round = accepted.slice(i, i + PHOTO_UPLOAD_CHUNK)
      const ticketed = await createPhotoUploadTickets(
        collectionId,
        round.map(f => ({ name: f.name, type: f.type, size: f.size })),
      )
      failed.push(...ticketed.failed)
      if (ticketed.tickets.length === 0) {
        // A REFUSAL OF THE WHOLE ROUND STOPS EVERYTHING, where a per-file one does not: it is
        // the grant, the album or the session, and none of those gets better on round four.
        if (ticketed.message) { failed.push(ticketed.message); break }
        continue
      }

      // THE FILE IS FOUND BY NAME, not by position: `createPhotoUploadTickets` drops the ones
      // it refuses, so the two lists are different lengths the moment anything is rejected.
      const byName = new Map(round.map(f => [f.name, f]))
      const landed = await Promise.all(ticketed.tickets.map(async ticket => {
        const file = byName.get(ticket.name)
        if (!file) return null
        const { error: putError } = await storage.uploadToSignedUrl(
          ticket.path, ticket.token, file, { contentType: file.type || undefined },
        )
        if (putError) {
          failed.push(`${file.name}: ${putError.message}`)
          return null
        }
        setDone(n => n + 1)
        return { name: ticket.name, path: ticket.path }
      }))

      const entries = landed.filter((e): e is { name: string; path: string } => e !== null)
      if (entries.length === 0) continue

      const recorded = await recordUploadedPhotos(collectionId, entries, caption)
      failed.push(...recorded.failed)
      uploaded += recorded.uploaded
      if (recorded.uploaded === 0 && recorded.message) failed.push(recorded.message)
    }

    setBusy(false)
    if (uploaded === 0) {
      setError(failed.join(' ') || t('gal.nothingUploaded'))
      return
    }
    onDone(uploaded, failed)
  }

  return (
    <Dialog open onClose={busy ? () => {} : onClose} title={t('gal.addPhotos')}
      description={t('gal.formatsAndSize', { formats: formatList(IMAGE_FORMATS) })}>
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
          <Upload /> {t('gal.chooseFiles')}
        </Button>

        {files.length > 0 && (
          <div className="rounded-lg border bg-muted/30 p-2.5 text-xs">
            <p className="font-medium">
              {t(accepted.length === 1 ? 'gal.imagesReadyOne' : 'gal.imagesReadyMany',
                { n: String(accepted.length) })}
            </p>
            {/* THE REFUSALS ARE LISTED BY NAME, never as a count. "3 files were skipped" makes
                somebody open the picker again to work out which. */}
            {rejected.length > 0 && (
              <ul className="mt-1.5 space-y-0.5 text-brand-withheld">
                {rejected.map(f => (
                  <li key={f.name}>
                    {t('gal.notAnImageFormat', {
                      name: f.name, formats: formatList(IMAGE_FORMATS),
                    })}
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}

        <div className="space-y-1.5">
          <Label htmlFor="batch-caption">{t('gal.batchCaption')}</Label>
          <Input id="batch-caption" value={caption} onChange={e => setCaption(e.target.value)}
            placeholder={t('gal.captionPh')} />
          <p className="text-xs text-muted-foreground">
            {t('gal.batchCaptionHint')}
          </p>
        </div>

        <FormError message={error} />

        <div className="flex gap-2">
          <Button size="sm" variant="affirm" onClick={submit} disabled={busy || accepted.length === 0}>
            {busy && <Loader2 className="animate-spin" />}
            {busy
              ? t('gal.uploadingProgress', { done: String(done), n: String(accepted.length) })
              : accepted.length === 1
                ? t('gal.uploadOne')
                : t('gal.uploadMany', { n: String(accepted.length) })}
          </Button>
          <Button size="sm" variant="ghost" onClick={onClose} disabled={busy}>{t('action.cancel')}</Button>
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
  const t = useT()
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
      if (!result.success) { onError(result.message ?? t('gal.captionFailed')); return }
      setEditing(false)
      onChanged()
    })
  }

  function addTag(personId: string) {
    startTransition(async () => {
      const result = await tagPersonInPhoto(photo.id, personId)
      if (!result.success) { onError(result.message ?? t('gal.tagFailed')); return }
      setTagging(false); setQuery('')
      onChanged()
    })
  }

  async function removeTag(personId: string, name: string) {
    const ok = await confirm({
      title: t('gal.removeTag'),
      description: t('gal.removeTagForConfirm', { name }),
      confirmLabel: t('gal.removeTag'),
      destructive: true,
    })
    if (!ok) return
    startTransition(async () => {
      const result = await untagPersonFromPhoto(photo.id, personId)
      if (!result.success) { onError(result.message ?? t('gal.removeTagFailed')); return }
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
              placeholder={t('gal.noCaption')} className="max-w-sm" autoFocus
              aria-label={t('gal.caption')} />
            <Button size="sm" variant="affirm" onClick={saveCaption} disabled={isPending || busy}>
              <Check /> {t('action.save')}
            </Button>
            <Button size="sm" variant="ghost" disabled={isPending || busy}
              onClick={() => { setCaption(photo.caption ?? ''); setEditing(false) }}>
              {t('action.cancel')}
            </Button>
          </div>
        ) : (
          <div className="flex flex-wrap items-center gap-2">
            <p className={`text-sm ${photo.caption ? '' : 'italic text-muted-foreground'}`}>
              {photo.caption || t('gal.noCaption')}
            </p>
            {mayEdit && (
              <button type="button" onClick={() => setEditing(true)}
                aria-label={t('gal.changeCaption')}
                className="text-muted-foreground hover:text-foreground">
                <Pencil className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
        )}

        <p className="text-xs text-muted-foreground">
          {photo.uploader_name
            ? t('gal.addedByName', { name: photo.uploader_name })
            : t('gal.addedByGone')}
        </p>

        <div className="flex flex-wrap items-center gap-1.5">
          {/* `tag`, not `t` — the translator is `t` in every file in this tree, and a map
              callback called `t` shadows it. See AGENTS.md's i18n section. */}
          {photo.tags.map(tag => (
            <span key={tag.person_id}
              className="inline-flex items-center gap-1 rounded-full bg-brand-soft px-2 py-0.5 text-xs text-brand-on-soft">
              {tag.person_name}
              {mayEdit && (
                <button type="button" onClick={() => removeTag(tag.person_id, tag.person_name)}
                  aria-label={t('gal.removeTagForAria', { name: tag.person_name })}
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
              <Tag className="h-3 w-3" /> {t('gal.tagSomebody')}
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
              placeholder={t('gal.searchFamily')} className="h-7 text-sm" autoFocus
              aria-label={t('gal.searchToTag')} />
            <ul className="max-h-40 space-y-0.5 overflow-y-auto">
              {untagged.length === 0 ? (
                <li className="px-2 py-1 text-xs text-muted-foreground">{t('gal.nobodyMatches')}</li>
              ) : untagged.slice(0, 40).map(m => (
                <li key={m.id}>
                  <button type="button" onClick={() => addTag(m.id)} disabled={isPending}
                    className="w-full rounded px-2 py-1 text-start text-sm hover:bg-brand-soft">
                    {formatPersonName(m)}
                  </button>
                </li>
              ))}
            </ul>
            {untagged.length > 40 && (
              <p className="px-2 text-xs text-muted-foreground">
                {t('gal.moreKeepTyping', { n: String(untagged.length - 40) })}
              </p>
            )}
            <button type="button" onClick={() => setTagging(false)}
              className="px-2 text-xs text-muted-foreground">{t('action.cancel')}</button>
          </div>
        )}
      </div>

      {mayDelete && (
        <Button size="sm" variant="ghost" onClick={onDelete} disabled={isPending || busy}
          className="self-start text-destructive hover:text-destructive">
          <Trash2 /> {t('action.delete')}
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
  const t = useT()
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/90" onClick={onClose}>
      <div className="relative max-h-full w-full max-w-4xl p-4" onClick={e => e.stopPropagation()}>
        <button onClick={onClose} aria-label={t('gal.closePhoto')}
          className="absolute end-2 top-2 z-10 text-white hover:text-white/70">
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
              <Trash2 /> {t('action.delete')}
            </Button>
          )}
        </div>
        <p className="mt-2 text-center text-xs text-white/50">{index + 1} of {total}</p>

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
