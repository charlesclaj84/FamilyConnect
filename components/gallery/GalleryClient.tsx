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
    if (!name.trim()) { setError('Give the album a name'); return }
    setError('')
    startTransition(async () => {
      const result = await createCollection({
        name: name.trim(),
        description: description.trim() || undefined,
      })
      if (!result.success) { setError(result.message ?? 'Could not create that album.'); return }
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
        ? `This deletes the album AND all ${count} photograph${count === 1 ? '' : 's'} in it, `
          + 'for everybody. The image files are removed as well. This cannot be undone.'
        : 'This deletes the album. It has no photographs in it.',
      confirmLabel: count > 0 ? `Delete album and ${count} photo${count === 1 ? '' : 's'}` : 'Delete album',
      destructive: true,
    })
    if (!ok) return
    setError(''); setNotice('')
    startTransition(async () => {
      const result = await deleteCollection(c.id)
      if (!result.success) { setError(result.message ?? 'Could not delete that album.'); return }
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
          <h1 className="mb-1 text-3xl font-bold">Gallery</h1>
          <p className="text-muted-foreground">
            The family&rsquo;s photographs, kept in albums. Tag who is in them so a cousin can
            find themselves.
          </p>
        </div>
        {rights.upload && (
          <Button onClick={() => { setCreating(true); setError('') }}>
            <Plus /> New album
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
        <p className="text-sm text-muted-foreground">Looking up the albums…</p>
      ) : collections.length === 0 ? (
        <div className="rounded-xl border bg-card px-4 py-16 text-center">
          <Images className="mx-auto mb-3 h-12 w-12 text-muted-foreground/30" />
          <p className="text-sm text-muted-foreground">No albums yet.</p>
          <p className="mx-auto mt-2 max-w-md text-xs text-muted-foreground">
            An album is a set of photographs the family keeps together — a reunion, a wedding,
            a year. {rights.upload
              ? 'Press New album to start one.'
              : 'Somebody with permission to add to the gallery can start one.'}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
          {collections.map(c => (
            <div key={c.id} className="relative">
              <CollectionCard collection={c} />
              {/* OUTSIDE THE CARD'S ANCHOR, and it has to be: an <a> may not contain a
                  <button>, and nesting one produces markup a screen reader cannot describe
                  and a browser may reparent. The same rule `RecentUpdates` follows. */}
              {mayDelete(c) && (
                <button
                  type="button"
                  onClick={() => handleDelete(c)}
                  disabled={isPending}
                  aria-label={`Delete the album “${c.name}”`}
                  title="Delete album"
                  className="absolute right-1.5 top-1.5 rounded-md bg-background/85 p-1.5 text-destructive opacity-0 shadow-sm transition-opacity hover:bg-background focus-visible:opacity-100 group-hover:opacity-100 disabled:opacity-50 sm:opacity-0"
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
          title="New album"
          description="A set of photographs the family keeps together."
        >
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="album-name">Name</Label>
              <Input id="album-name" value={name} onChange={e => setName(e.target.value)}
                placeholder="Summer Reunion 2026" autoFocus />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="album-desc">Description (optional)</Label>
              <Input id="album-desc" value={description}
                onChange={e => setDescription(e.target.value)}
                placeholder="Three days at the lake" />
            </div>
            <FormError message={error} />
            <div className="flex gap-2">
              <Button size="sm" variant="affirm" onClick={handleCreate} disabled={isPending}>
                Create album
              </Button>
              <Button size="sm" variant="ghost" disabled={isPending}
                onClick={() => { setCreating(false); setError('') }}>
                Cancel
              </Button>
            </div>
          </div>
        </Dialog>
      )}
    </div>
  )
}
