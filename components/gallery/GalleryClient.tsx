'use client'

import { useEffect, useState, useTransition } from 'react'
import { Images, Plus, Trash2 } from 'lucide-react'
import { CollectionCard } from '@/components/gallery/CollectionCard'
import { Button } from '@/components/ui/button'
import { Dialog } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useConfirm } from '@/components/ui/confirm'
import { FormError } from '@/components/ui/form-message'
import {
  createCollection, deleteCollection, getPhotoCollections,
  type GalleryRights, type PhotoCollection,
} from '@/app/actions/gallery'
import { useT } from '@/components/layout/LocaleProvider'

/**
 * The Gallery's index: every album the family keeps.
 *
 * ── DELETING AN ALBUM ASKS TWICE, AND THE SECOND ASK COUNTS THE PHOTOGRAPHS ────────
 * It cascades to every photograph in it and removes the image files as well, which is a thing
 * a family cannot undo and cannot partially undo. So the confirmation names the album AND says
 * how many pictures go with it — a count is what makes "are you sure" answerable, where "this
 * cannot be undone" alone is a sentence everybody clicks through.
 *
 * The control is only rendered for a caller who may actually do it (`rights.deleteAny`, or
 * being the album's creator), and that is the UI following the decision rather than the gate:
 * `deleteCollection` resolves `requireOwn('community/gallery', 'delete', created_by)` itself,
 * because a `'use server'` export has a URL whether or not a button exists (AGENTS.md §2).
 */
export function GalleryClient({ rights, myPersonId }: {
  rights: GalleryRights
  /** The caller's own `people.id`, for the creator half of the delete rule. */
  myPersonId: string | null
}) {
  const t = useT()
  const confirm = useConfirm()
  const [collections, setCollections] = useState<PhotoCollection[]>([])
  const [loading, setLoading] = useState(true)
  const [creating, setCreating] = useState(false)
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [isPending, startTransition] = useTransition()

  useEffect(() => {
    getPhotoCollections().then(data => { setCollections(data); setLoading(false) })
  }, [])

  function handleCreate() {
    if (!name.trim()) { setError(t('gal.needName')); return }
    setError('')
    startTransition(async () => {
      const result = await createCollection({
        name: name.trim(),
        description: description.trim() || undefined,
      })
      if (!result.success) { setError(result.message ?? t('gal.createFailed')); return }
      setCreating(false); setName(''); setDescription('')
      setCollections(await getPhotoCollections())
    })
  }

  const mayDelete = (c: PhotoCollection) =>
    rights.deleteAny || (myPersonId !== null && c.created_by === myPersonId)

  async function handleDelete(c: PhotoCollection) {
    const count = c.photo_count
    const ok = await confirm({
      title: `Delete “${c.name}”?`,
      // THE COUNT IS THE WHOLE WARNING. "This cannot be undone" is a sentence; "and its 214
      // photographs" is a fact somebody stops and reads.
      description: count > 0
        ? t(count === 1
            ? 'gal.deleteAlbumWithPhotosOne'
            : 'gal.deleteAlbumWithPhotosMany', { n: String(count) })
        : t('gal.deleteAlbumBody'),
      confirmLabel: count > 0
        ? t(count === 1 ? 'gal.deleteAlbumAndOne' : 'gal.deleteAlbumAndMany',
            { n: String(count) })
        : t('gal.deleteAlbum'),
      destructive: true,
    })
    if (!ok) return
    setError(''); setNotice('')
    startTransition(async () => {
      const result = await deleteCollection(c.id)
      if (!result.success) { setError(result.message ?? t('gal.deleteAlbumFailed')); return }
      // A PARTIAL SUCCESS IS SAID OUT LOUD. The rows always go; the FILES can fail to, and a
      // family told an album is gone must not be left with the pictures still served.
      if (result.message) setNotice(result.message)
      setCollections(await getPhotoCollections())
    })
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="mb-1 text-3xl font-bold">{t('gal.heading')}</h1>
          <p className="text-muted-foreground">{t('ui.familySPhotographsKept')}</p>
        </div>
        {rights.upload && (
          <Button onClick={() => { setCreating(true); setError('') }}>
            <Plus /> {t('gal.newAlbum')}
          </Button>
        )}
      </div>

      <FormError message={error} />
      {notice && (
        <p className="rounded-lg border border-dashed bg-muted/30 px-3 py-2 text-xs text-muted-foreground">
          {notice}
        </p>
      )}

      {loading ? (
        <p className="text-sm text-muted-foreground">{t('gal.looking')}</p>
      ) : collections.length === 0 ? (
        <div className="rounded-xl border bg-card px-4 py-16 text-center">
          <Images className="mx-auto mb-3 h-12 w-12 text-muted-foreground/30" />
          <p className="text-sm text-muted-foreground">{t('gal.noAlbums')}</p>
          <p className="mx-auto mt-2 max-w-md text-xs text-muted-foreground">
            {t('gal.albumIsASet')} {rights.upload
              ? t('gal.pressNew')
              : t('gal.somebodyCan')}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
          {collections.map(c => (
            <div key={c.id} className="group/tile relative">
              <CollectionCard collection={c} />
              {/* OUTSIDE THE CARD'S ANCHOR, and it has to be: an <a> may not contain a
                  <button>, and nesting one produces markup a screen reader cannot describe
                  and a browser may reparent. The same rule `RecentUpdates` follows. */}
              {mayDelete(c) && (
                <button
                  type="button"
                  onClick={() => handleDelete(c)}
                  disabled={isPending}
                  aria-label={t('gal.deleteNamedAlbumAria', { name: c.name })}
                  title={t('gal.deleteAlbum')}
                  /* IT WAS INVISIBLE UNTIL 2026-08-22, and both halves of why are worth
                     keeping. `group-hover:` needs an ANCESTOR carrying `group`, and the
                     only `group` on this tile is inside `CollectionCard`, on the `<a>` —
                     which is this button's SIBLING, because an anchor may not contain a
                     button. So the hover rule matched nothing and `opacity-0 sm:opacity-0`
                     was the whole of it: the control existed, was permissioned, and could
                     be reached by keyboard alone. The named `group/tile` on the wrapper is
                     what fixes it, and naming it rather than using a bare `group` keeps it
                     from colliding with the card's own.
                     AND IT IS VISIBLE BELOW `sm`, not hover-revealed: a phone has no hover
                     state at all, so a control that only appears on one is a control a
                     phone does not have. */
                  className="absolute end-1.5 top-1.5 rounded-md bg-background/85 p-1.5 text-destructive shadow-sm transition-opacity hover:bg-background focus-visible:opacity-100 disabled:opacity-50 sm:opacity-0 sm:group-hover/tile:opacity-100"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      {creating && (
        <Dialog
          open
          onClose={() => { setCreating(false); setError('') }}
          title={t('gal.newAlbum')}
          description={t('gal.albumIs')}
        >
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="album-name">{t('field.name')}</Label>
              <Input id="album-name" value={name} onChange={e => setName(e.target.value)}
                placeholder={t('gal.albumNamePh')} autoFocus />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="album-desc">{t('field.descriptionOptional')}</Label>
              <Input id="album-desc" value={description}
                onChange={e => setDescription(e.target.value)}
                placeholder={t('gal.albumDescPh')} />
            </div>
            <FormError message={error} />
            <div className="flex gap-2">
              <Button size="sm" variant="affirm" onClick={handleCreate} disabled={isPending}>
                {t('gal.createAlbum')}
              </Button>
              <Button size="sm" variant="ghost" disabled={isPending}
                onClick={() => { setCreating(false); setError('') }}>
                {t('action.cancel')}
              </Button>
            </div>
          </div>
        </Dialog>
      )}
    </div>
  )
}
