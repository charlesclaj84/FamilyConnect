'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { BookText, Pencil, Plus, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Dialog } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { useConfirm } from '@/components/ui/confirm'
import { FormError } from '@/components/ui/form-message'
import { MainRail } from '@/components/layout/MainRail'
import { useServerState } from '@/lib/use-server-state'
import { formatDate } from '@/lib/date-utils'
import {
  addJournalEntry, deleteJournalEntry, getJournalEntries, updateJournalEntry,
  type JournalEntry, type JournalOffice,
} from '@/app/actions/journal'

/**
 * The Journal, for whoever holds the office.
 *
 * ── ONE RAIL, ONE OFFICE ────────────────────────────────────────────────────────────
 * A member may hold several — treasurer of the family and secretary of their chapter — and
 * each has its own notebook. `MainRail` is the standard control for that and this uses it
 * with no `href`: the panes have no address of their own, which is the one case that
 * component's header says to omit it for. There is no `?office=` on the URL because a journal
 * is not a thing to link somebody to; the person who can open it is the person holding the
 * office.
 *
 * ── ENTRIES ARE FETCHED PER OFFICE, NOT ALL AT ONCE ─────────────────────────────────
 * The page hands down the first office's entries and this refetches on a switch. That is §5
 * rather than laziness about payload size: an officeholder's journal is the sharpest personal
 * data in the product — half-finished reconciliations and notes about people — and shipping
 * every office's notes into the RSC payload so a rail can hide four of them is exactly what
 * "gate the fetch, not the button" forbids. The policy would allow it; the screen should not
 * ask.
 *
 * ── WHOSE ENTRY IT IS DECIDES THE CONTROLS, AND THE SERVER SAYS SO ──────────────────
 * `entry.mine` is resolved by `getJournalEntries` against the caller's own person id, and is
 * not recomputed here. Editing and deleting are the AUTHOR's — a successor reads everything
 * and rewrites nothing, which the migration's header argues at length — and the policies
 * refuse it underneath regardless, so these controls are an affordance and never the gate.
 */

interface Props {
  offices: JournalOffice[]
  initialOffice: string
  initialEntries: JournalEntry[]
}

interface Draft {
  /** The entry being edited, or null when composing a new one. */
  entry: JournalEntry | null
  title: string
  body: string
}

export function JournalClient({ offices, initialOffice, initialEntries }: Props) {
  const router = useRouter()
  const confirm = useConfirm()
  const [active, setActive] = useState(initialOffice)
  // `useServerState`, not `useState`: a plain initializer reads the prop once and then ignores
  // every later server render — including the `router.refresh()` this component fires after a
  // write. The rail's own switching is handled by `loadOffice` below, which sets state itself.
  const [entries, setEntries] = useServerState(initialEntries)
  const [draft, setDraft] = useState<Draft | null>(null)
  const [error, setError] = useState('')
  const [dialogError, setDialogError] = useState('')
  const [isPending, startTransition] = useTransition()

  function loadOffice(roleId: string) {
    setActive(roleId)
    setError('')
    startTransition(async () => {
      setEntries(await getJournalEntries(roleId))
    })
  }

  function openNew() {
    setDialogError('')
    setDraft({ entry: null, title: '', body: '' })
  }

  function openEdit(entry: JournalEntry) {
    setDialogError('')
    setDraft({ entry, title: entry.title, body: entry.body })
  }

  function save() {
    if (!draft) return
    if (!draft.title.trim()) { setDialogError('Give the entry a title.'); return }
    setDialogError('')
    startTransition(async () => {
      const result = draft.entry
        ? await updateJournalEntry(draft.entry.id, draft.title, draft.body)
        : await addJournalEntry(active, draft.title, draft.body)
      if (!result.success) {
        setDialogError(result.message ?? 'That entry could not be saved.')
        return
      }
      setDraft(null)
      // Refetched rather than patched optimistically. The server sets `created_at`,
      // `updated_at` and the author's name, and an optimistic row would have to invent all
      // three — `updated_at` in particular is what the list prints when an entry has been
      // changed, so guessing it is guessing about the record.
      setEntries(await getJournalEntries(active))
      router.refresh()
    })
  }

  async function remove(entry: JournalEntry) {
    const ok = await confirm({
      title: 'Delete this entry',
      description: `Delete “${entry.title}”? It goes for everybody who holds this office, `
        + 'now and later. This cannot be undone.',
      confirmLabel: 'Delete entry',
      destructive: true,
    })
    if (!ok) return
    setError('')
    startTransition(async () => {
      const result = await deleteJournalEntry(entry.id)
      if (!result.success) { setError(result.message ?? 'That entry could not be removed.'); return }
      setEntries(await getJournalEntries(active))
      router.refresh()
    })
  }

  const activeOffice = offices.find(o => o.role_id === active)

  return (
    <div className="space-y-6">
      {/* ONE OFFICE NEEDS NO RAIL. A single-item rail is a heading pretending to be a choice,
          and `MainRail`'s own argument about not claiming `role="tablist"` is the same
          instinct: do not offer a control that cannot do anything. */}
      {offices.length > 1 && (
        <MainRail
          label="Offices you hold"
          items={offices.map(o => ({ id: o.role_id, label: o.name }))}
          active={active}
          onSelect={loadOffice}
          action={
            <Button size="sm" variant="affirm" onClick={openNew} disabled={isPending}>
              <Plus /> New entry
            </Button>
          }
        />
      )}

      {offices.length === 1 && (
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm text-muted-foreground">
            The journal for <span className="font-medium text-foreground">{activeOffice?.name}</span>.
          </p>
          <Button size="sm" variant="affirm" onClick={openNew} disabled={isPending}>
            <Plus /> New entry
          </Button>
        </div>
      )}

      <FormError message={error} />

      {entries.length === 0 ? (
        <div className="rounded-xl border bg-card px-4 py-10 text-center">
          <BookText className="mx-auto mb-3 h-10 w-10 text-muted-foreground/30" />
          <p className="text-sm text-muted-foreground">
            Nothing recorded for {activeOffice?.name ?? 'this office'} yet.
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            Whatever you write here stays with the office. Whoever holds it next will read it.
          </p>
        </div>
      ) : (
        <ul className="space-y-3">
          {entries.map(entry => (
            <li key={entry.id} className="rounded-xl border bg-card p-4">
              <div className="flex flex-wrap items-start gap-x-3 gap-y-1">
                <h2 className="min-w-0 flex-1 font-medium">{entry.title}</h2>
                {entry.mine && (
                  <div className="flex shrink-0 gap-1">
                    <Button size="sm" variant="ghost" className="h-7 w-7 p-0"
                      onClick={() => openEdit(entry)} disabled={isPending}
                      aria-label={`Edit “${entry.title}”`} title="Edit">
                      <Pencil className="h-3.5 w-3.5" />
                    </Button>
                    <Button size="sm" variant="ghost"
                      className="h-7 w-7 p-0 text-destructive hover:text-destructive"
                      onClick={() => remove(entry)} disabled={isPending}
                      aria-label={`Delete “${entry.title}”`} title="Delete">
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                )}
              </div>

              {entry.body && (
                // `whitespace-pre-wrap`: the composer is a textarea and somebody writing a
                // handover note uses line breaks. Rendering it as one paragraph would silently
                // destroy the structure of every list anybody wrote.
                <p className="mt-2 whitespace-pre-wrap text-sm text-muted-foreground">
                  {entry.body}
                </p>
              )}

              <p className="mt-3 text-xs text-muted-foreground">
                {/* "A FORMER OFFICER" RATHER THAN "UNKNOWN". `author_id` is ON DELETE SET NULL
                    so the office keeps the note when its author leaves the family, and
                    "Unknown" would make that read like data loss rather than like a record
                    outliving the person who wrote it. */}
                {entry.author_name ?? 'A former officer'} · {formatDate(entry.created_at)}
                {entry.updated_at !== entry.created_at
                  && ` · edited ${formatDate(entry.updated_at)}`}
              </p>
            </li>
          ))}
        </ul>
      )}

      {/* ── The composer ──────────────────────────────────────────────────── */}
      <Dialog
        open={draft !== null}
        onClose={() => setDraft(null)}
        title={draft?.entry ? 'Edit entry' : `New entry${activeOffice ? ` — ${activeOffice.name}` : ''}`}
        description={draft?.entry
          ? 'Only you can change what you wrote, and only while you hold this office.'
          : 'This stays with the office. Whoever holds it next will read it.'}
        className="sm:max-w-xl"
      >
        {draft && (
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="journal-title" required>Title</Label>
              <Input
                id="journal-title"
                value={draft.title}
                onChange={e => setDraft({ ...draft, title: e.target.value })}
                placeholder="How the bank reconciliation works"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="journal-body">Notes</Label>
              <Textarea
                id="journal-body"
                rows={10}
                value={draft.body}
                onChange={e => setDraft({ ...draft, body: e.target.value })}
              />
            </div>

            {/* WITH THE BUTTONS, not beside the field. The dialog's body scrolls and its
                footer does not, so a message rendered next to an input can be off-screen at
                the moment somebody presses Save again. */}
            <FormError message={dialogError} />

            <div className="flex items-center justify-end gap-2">
              <Button variant="ghost" onClick={() => setDraft(null)} disabled={isPending}>
                Cancel
              </Button>
              <Button variant="affirm" onClick={save} disabled={isPending || !draft.title.trim()}>
                {isPending ? 'Saving…' : draft.entry ? 'Save changes' : 'Add entry'}
              </Button>
            </div>
          </div>
        )}
      </Dialog>
    </div>
  )
}
