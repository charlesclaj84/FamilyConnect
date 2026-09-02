'use client'

import { useState, useTransition } from 'react'
import { Images, Pencil } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Dialog } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { FormError } from '@/components/ui/form-message'
import { useServerState } from '@/lib/use-server-state'
import { updateCollection } from '@/app/actions/gallery'
import { useT } from '@/components/layout/LocaleProvider'

/**
 * An album's name, its description, its count — and the control that changes the first two.
 *
 * ── WHY THE HEADING IS A CLIENT COMPONENT AT ALL ───────────────────────────────────
 * Asked for on 2026-09-01: an album could be created and deleted and never renamed, so a
 * typo in "Summer Reuinon 2026" was permanent unless you deleted the album — which takes
 * every photograph in it. Renaming is an edit rather than a deletion and belongs at the
 * quieter rung; `updateCollection` resolves `requireOwn('community/gallery', 'edit',
 * created_by)`, one step below the `delete` the bin on the index asks for.
 *
 * The heading was three lines of the page's own JSX. It is here because the rename dialog
 * needs state, and a Server Component cannot hold any — and because the name has to change on
 * screen the moment it is saved rather than only on the next full load.
 *
 * ── `useServerState`, NOT `useState`, AND ONE CALL PER FIELD ───────────────────────
 * The action `revalidatePath`s both the index and this page, so the server sends a fresh name
 * down; a plain initializer would read the prop once and go on printing the old one until a
 * hard reload. Same reason `CollectionView` uses it for the photographs.
 *
 * TWO CALLS ON THE TWO STRINGS, never one on `{ name, description }`. That hook compares the
 * server value BY IDENTITY — its own comment says so, because a server render produces fresh
 * arrays and objects and that is exactly the signal it reads. An object literal built in the
 * component body is a fresh identity on EVERY render, so it would re-seed the state every
 * time: the optimistic rename would be clobbered before it painted, and the set-during-render
 * would never converge. Primitives compare by value and are stable.
 *
 * ── THE CONTROL IS AN AFFORDANCE AND NEVER THE GATE ────────────────────────────────
 * `mayRename` decides whether the pencil is drawn. `updateCollection` re-resolves the grant
 * itself, because a `'use server'` export has a URL whether or not a button exists (§2).
 */
export function AlbumHeading({ id, name, description, photoCount, mayRename }: {
  id: string
  name: string
  description: string | null
  photoCount: number
  /** `community/gallery:edit` at scope 'any', or being this album's creator. */
  mayRename: boolean
}) {
  const t = useT()
  const [currentName, setCurrentName] = useServerState(name)
  const [currentDescription, setCurrentDescription] = useServerState(description)
  const [open, setOpen] = useState(false)
  const [draftName, setDraftName] = useState(name)
  const [draftDescription, setDraftDescription] = useState(description ?? '')
  const [error, setError] = useState('')
  const [isPending, startTransition] = useTransition()

  function start() {
    // THE DRAFT IS SEEDED WHEN THE DIALOG OPENS, not when the component mounts: a rename that
    // is saved and then re-opened must offer the new name, and a rename that is cancelled must
    // not leave the abandoned text sitting there next time.
    setDraftName(currentName)
    setDraftDescription(currentDescription ?? '')
    setError('')
    setOpen(true)
  }

  function save() {
    if (!draftName.trim()) { setError(t('gal.needName')); return }
    setError('')
    startTransition(async () => {
      const result = await updateCollection(id, {
        name: draftName.trim(),
        description: draftDescription.trim() || undefined,
      })
      if (!result.success) { setError(result.message ?? t('gal.renameFailed')); return }
      setCurrentName(draftName.trim())
      setCurrentDescription(draftDescription.trim() || null)
      setOpen(false)
    })
  }

  return (
    <div>
      <div className="flex items-center gap-3">
        <Images className="h-6 w-6 shrink-0 text-brand-accent" aria-hidden="true" />
        <h1 className="text-2xl font-bold">{currentName}</h1>
        {mayRename && (
          <button
            type="button"
            onClick={start}
            aria-label={t('gal.renameNamedAlbumAria', { name: currentName })}
            title={t('gal.renameAlbum')}
            className="rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          >
            <Pencil className="h-4 w-4" />
          </button>
        )}
        <span className="ms-auto shrink-0 text-sm text-muted-foreground">
          {t(photoCount === 1 ? 'gal.photoCountOne' : 'gal.photoCountMany',
            { n: String(photoCount) })}
        </span>
      </div>
      {currentDescription && (
        <p className="ms-9 mt-2 text-muted-foreground">{currentDescription}</p>
      )}

      {open && (
        <Dialog
          open
          onClose={() => { if (!isPending) { setOpen(false); setError('') } }}
          title={t('gal.renameAlbum')}
          description={t('gal.renameAlbumBody')}
        >
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="album-rename">{t('field.name')}</Label>
              <Input id="album-rename" value={draftName} autoFocus
                onChange={e => setDraftName(e.target.value)}
                placeholder={t('gal.albumNamePh')} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="album-redescribe">{t('field.descriptionOptional')}</Label>
              <Input id="album-redescribe" value={draftDescription}
                onChange={e => setDraftDescription(e.target.value)}
                placeholder={t('gal.albumDescPh')} />
            </div>
            <FormError message={error} />
            <div className="flex gap-2">
              <Button size="sm" variant="affirm" onClick={save} disabled={isPending}>
                {t('action.saveChanges')}
              </Button>
              <Button size="sm" variant="ghost" disabled={isPending}
                onClick={() => { setOpen(false); setError('') }}>
                {t('action.cancel')}
              </Button>
            </div>
          </div>
        </Dialog>
      )}
    </div>
  )
}
