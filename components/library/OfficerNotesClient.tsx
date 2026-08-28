'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import {
  BookText, ChevronDown, ChevronRight, Pencil, Plus, Trash2,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Dialog } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { useConfirm } from '@/components/ui/confirm'
import { FormError } from '@/components/ui/form-message'
import { MainRail } from '@/components/layout/MainRail'
import { useServerState } from '@/lib/use-server-state'
import { formatInstantDate } from '@/lib/tz'
import {
  addJournalEntry, addJournalNote, deleteJournalEntry, deleteJournalNote, getJournalEntries,
  updateJournalEntry, updateJournalNote,
  type JournalEntry, type JournalNote, type JournalOffice,
} from '@/app/actions/journal'
import { useT } from '@/components/layout/LocaleProvider'

/**
 * Officer Notes, for whoever holds the office.
 *
 * IT WAS `JournalClient` UNTIL 2026-08-22, under a rail section called Journals. The section is
 * **Library** now and holds four screens; this is the one that is actually a journal, and it is
 * named for whose it is (`20260822000021`).
 *
 * ── ONE RAIL, ONE OFFICE ────────────────────────────────────────────────────────────
 * A member may hold several — treasurer of the family and secretary of their chapter — and
 * each has its own notebook. `MainRail` is the standard control for that and this uses it
 * with no `href`: the panes have no address of their own, which is the one case that
 * component's header says to omit it for. There is no `?office=` on the URL because a journal
 * is not a thing to link somebody to; the person who can open it is the person holding the
 * office.
 *
 * ── AN ENTRY IS A ROLLING TOPIC, AND THE PAGE IS SHAPED AROUND THAT ─────────────────
 * A topic is a title and a thread of notes underneath it, oldest first, each with its own
 * byline. Adding to a topic is the ordinary interaction — **Add a note** on every card — and
 * the topic itself is rarely touched after it is opened. Who may do what is decided on the
 * SERVER and arrives as two booleans, which is the whole reason the controls are readable:
 *
 *   `entry.mine`  the caller RECORDED the topic  -> retitle, delete, and set who attended
 *   `note.mine`   the caller WROTE that note     -> edit or delete that one paragraph
 *
 * ANY HOLDER MAY ADD A NOTE TO ANY TOPIC, which is why **Add a note** is not behind
 * `entry.mine`. That is the conversation: a successor answers a predecessor underneath what
 * they wrote instead of beside it. The policies refuse everything else underneath regardless,
 * so these are affordances and never the gate.
 *
 * ── ENTRIES ARE FETCHED PER OFFICE, NOT ALL AT ONCE ─────────────────────────────────
 * The page hands down the first office's topics and this refetches on a switch. That is §5
 * rather than laziness about payload size: an officeholder's journal is the sharpest personal
 * data in the product — half-finished reconciliations and notes about people — and shipping
 * every office's notes into the RSC payload so a rail can hide four of them is exactly what
 * "gate the fetch, not the button" forbids. The policy would allow it; the screen should not
 * ask.
 */

interface Props {
  offices: JournalOffice[]
  initialOffice: string
  initialEntries: JournalEntry[]
  /**
   * The reader's timezone, resolved once by the page (`resolveZone`).
   *
   * Every `created_at` on this screen is an INSTANT and has no calendar date of its
   * own — `formatDate` on one printed the UTC day, so anything entered after 7pm
   * Central was filed a day late. The DATE columns beside them are wall-clock labels
   * and deliberately still go through `formatDate`. See lib/tz.ts.
   */
  zone: string
}

/** The composer, for a new topic or for retitling one that exists. */
interface EntryDraft {
  /** The topic being edited, or null when opening a new one. */
  entry: JournalEntry | null
  title: string
  /** The opening paragraph. New topics only: an existing thread is added to, never rewritten. */
  firstNote: string
}

/** The note composer, for adding a paragraph or editing one of your own. */
interface NoteDraft {
  entryId: string
  /** The note being edited, or null when adding one. */
  note: JournalNote | null
  body: string
}

export function OfficerNotesClient({
  offices, initialOffice, initialEntries, zone,
}: Props) {
  const t = useT()
  const router = useRouter()
  const confirm = useConfirm()
  const [active, setActive] = useState(initialOffice)
  // `useServerState`, not `useState`: a plain initializer reads the prop once and then ignores
  // every later server render — including the `router.refresh()` this component fires after a
  // write. The rail's own switching is handled by `loadOffice` below, which sets state itself.
  const [entries, setEntries] = useServerState(initialEntries)
  const [entryDraft, setEntryDraft] = useState<EntryDraft | null>(null)
  const [noteDraft, setNoteDraft] = useState<NoteDraft | null>(null)
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

  /**
   * Refetched rather than patched optimistically, after every write.
   *
   * The server sets `created_at`, `updated_at`, the author's name and — on an attendee list —
   * the names of everybody chosen, and an optimistic row would have to invent all of them.
   * `updated_at` in particular is what a note prints when it has been changed, so guessing it
   * is guessing about the record.
   */
  function reload() {
    startTransition(async () => {
      setEntries(await getJournalEntries(active))
    })
    router.refresh()
  }

  function openNewEntry() {
    setDialogError('')
    setEntryDraft({ entry: null, title: '', firstNote: '' })
  }

  function openEditEntry(entry: JournalEntry) {
    setDialogError('')
    setEntryDraft({ entry, title: entry.title, firstNote: '' })
  }

  function saveEntry() {
    if (!entryDraft) return
    const draft = entryDraft
    if (!draft.title.trim()) { setDialogError(t('notes.needTitle')); return }
    setDialogError('')
    startTransition(async () => {
      if (!draft.entry) {
        const result = await addJournalEntry(active, {
          title: draft.title,
          firstNote: draft.firstNote,
        })
        if (!result.success) {
          setDialogError(result.message ?? t('notes.saveFailed'))
          // REFETCHED EVEN ON FAILURE, because `addJournalEntry` reports a PARTIAL success:
          // the topic can exist while its first note did not save. Left alone, the officer
          // would read a refusal over a topic that is really there.
          setEntries(await getJournalEntries(active))
          return
        }
      } else {
        const result = await updateJournalEntry(draft.entry.id, draft.title)
        if (!result.success) {
          setDialogError(result.message ?? t('notes.saveFailed'))
          return
        }
      }
      setEntryDraft(null)
      reload()
    })
  }

  async function removeEntry(entry: JournalEntry) {
    const ok = await confirm({
      title: t('notes.deleteEntryTitle'),
      description: `Delete “${entry.title}”? Every note under it goes too, for everybody who `
        + 'holds this office, now and later. This cannot be undone.',
      confirmLabel: t('notes.deleteEntry'),
      destructive: true,
    })
    if (!ok) return
    setError('')
    startTransition(async () => {
      const result = await deleteJournalEntry(entry.id)
      if (!result.success) {
        setError(result.message ?? t('notes.deleteEntryFailed'))
        return
      }
      reload()
    })
  }

  function openNewNote(entryId: string) {
    setDialogError('')
    setNoteDraft({ entryId, note: null, body: '' })
  }

  function openEditNote(note: JournalNote) {
    setDialogError('')
    setNoteDraft({ entryId: note.entry_id, note, body: note.body })
  }

  function saveNote() {
    if (!noteDraft) return
    const draft = noteDraft
    if (!draft.body.trim()) { setDialogError(t('notes.writeFirst')); return }
    setDialogError('')
    startTransition(async () => {
      const result = draft.note
        ? await updateJournalNote(draft.note.id, draft.body)
        : await addJournalNote(draft.entryId, draft.body)
      if (!result.success) {
        setDialogError(result.message ?? t('notes.noteSaveFailed'))
        return
      }
      setNoteDraft(null)
      reload()
    })
  }

  async function removeNote(note: JournalNote) {
    const ok = await confirm({
      title: t('notes.deleteThisNote'),
      description: t('notes.deleteNoteBody'),
      confirmLabel: t('notes.deleteNote'),
      destructive: true,
    })
    if (!ok) return
    setError('')
    startTransition(async () => {
      const result = await deleteJournalNote(note.id)
      if (!result.success) {
        setError(result.message ?? t('notes.deleteNoteFailed'))
        return
      }
      reload()
    })
  }

  const activeOffice = offices.find(o => o.role_id === active)

  // ONE CONTROL, SINCE 2026-08-22. There were two — New entry and Meeting notes — and the
  // second has left for `/library/meeting-minutes`, where a meeting is a session with a
  // secretary, an attendee list and votes rather than a kind of journal entry.
  const newControls = (
    <Button size="sm" variant="affirm" onClick={openNewEntry} disabled={isPending}>
      <Plus /> {t('notes.new')}
    </Button>
  )

  return (
    <div className="space-y-6">
      {/* ONE OFFICE NEEDS NO RAIL. A single-item rail is a heading pretending to be a choice,
          and `MainRail`'s own argument about not claiming `role="tablist"` is the same
          instinct: do not offer a control that cannot do anything. */}
      {/* ── THE POSITION AND THE PLACE, SINCE 2026-08-22 ────────────────────────
          `o.title` and not `o.name`. The rail printed the bare position name, so a member who
          chairs Austin and a member who chairs Houston both saw "Chapter Chair" — and an
          officer holding the same position in two chapters saw two identical rail items with no
          way to tell which notebook they were about to open. `title` is `formatBoardTitle`,
          which is the same phrase Members & Access and the Member Directory print for the same
          assignment, so the three surfaces cannot word one office three ways. */}
      {offices.length > 1 && (
        <MainRail
          label={t('notes.officesRail')}
          items={offices.map(o => ({ id: o.role_id, label: o.title }))}
          active={active}
          onSelect={loadOffice}
          action={newControls}
        />
      )}

      {offices.length === 1 && (
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm text-muted-foreground">
            {t('notes.journalFor')} <span className="font-medium text-foreground">{activeOffice?.title}</span>.
          </p>
          {newControls}
        </div>
      )}

      {/* ── WHO ELSE READS THIS, SAID OUT LOUD ─────────────────────────────────
          The notebook hangs off the POSITION (`position_journal_entries.role_id`), and
          `auth_holds_family_role` tests the position alone — so every holder of "Chapter
          Chair" reads the same notes, whichever chapter they chair. Printing the chapter beside
          the position is what makes that worth saying: without this line, "Austin Chapter Chair"
          over a shared notebook reads as a promise that it is Austin's alone.

          Only for a SCOPED office, because a national one has nobody to share with in that
          sense — the page's own lede ("whoever holds it next will read them") already covers
          succession, which is the other half and is true of all of them. */}
      {activeOffice && activeOffice.scope !== 'national' && (
        <p className="rounded-lg border border-dashed bg-muted/30 px-3 py-2 text-xs text-muted-foreground">
          {t('notes.everyoneHolding')} <span className="font-medium text-foreground">{activeOffice.name}</span>{' '}
          reads this journal, whichever{' '}
          {activeOffice.scope === 'chapter' ? 'chapter' : 'region'} they hold it for.
        </p>
      )}

      <FormError message={error} />

      {entries.length === 0 ? (
        <div className="rounded-xl border bg-card px-4 py-10 text-center">
          <BookText className="mx-auto mb-3 h-10 w-10 text-muted-foreground/30" />
          <p className="text-sm text-muted-foreground">
            Nothing recorded for {activeOffice?.title ?? 'this office'} yet.
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            {t('notes.staysWithOffice')}
          </p>
        </div>
      ) : (
        <ul className="space-y-4">
          {entries.map(entry => (
            <EntryCard
              key={entry.id}
              entry={entry}
              busy={isPending}
              zone={zone}
              onAddNote={() => openNewNote(entry.id)}
              onEdit={() => openEditEntry(entry)}
              onDelete={() => removeEntry(entry)}
              onEditNote={openEditNote}
              onDeleteNote={removeNote}
            />
          ))}
        </ul>
      )}

      {/* ── The topic composer ────────────────────────────────────────────── */}
      <Dialog
        open={entryDraft !== null}
        onClose={() => setEntryDraft(null)}
        title={entryDraft?.entry
          ? t('notes.renameEntry')
          : `New entry${activeOffice ? ` — ${activeOffice.title}` : ''}`}
        description={entryDraft?.entry
          ? t('notes.onlyYouRecorded')
          : t('notes.staysWithOfficeShort')}
        className="sm:max-w-xl"
      >
        {entryDraft && (
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="journal-title" required>{t('field.title')}</Label>
              <Input
                id="journal-title"
                value={entryDraft.title}
                onChange={e => setEntryDraft({ ...entryDraft, title: e.target.value })}
                placeholder={t('notes.titlePh')}
              />
              <p className="text-xs text-muted-foreground">
                {t('notes.titleHint')}
              </p>
            </div>

            {/* ONLY ON A NEW TOPIC. An existing thread is added to from its own card — there
                is no "edit the entry's text", because the text is the notes and each one
                belongs to whoever wrote it. */}
            {!entryDraft.entry && (
              <div className="space-y-1.5">
                <Label htmlFor="journal-first-note">{t('notes.firstNote')}</Label>
                <Textarea
                  id="journal-first-note"
                  rows={8}
                  value={entryDraft.firstNote}
                  onChange={e => setEntryDraft({ ...entryDraft, firstNote: e.target.value })}
                  placeholder={t('notes.firstNotePh')}
                />
                <p className="text-xs text-muted-foreground">
                  {t('notes.moreLater')}
                </p>
              </div>
            )}

            {/* WITH THE BUTTONS, not beside the field. The dialog's body scrolls and its
                footer does not, so a message rendered next to an input can be off-screen at
                the moment somebody presses Save again. */}
            <FormError message={dialogError} />

            <div className="flex items-center justify-end gap-2">
              <Button variant="ghost" onClick={() => setEntryDraft(null)} disabled={isPending}>
                {t('action.cancel')}
              </Button>
              <Button
                variant="affirm"
                onClick={saveEntry}
                disabled={isPending || !entryDraft.title.trim()}
              >
                {isPending ? t('action.saving') : entryDraft.entry ? t('action.saveChanges') : t('notes.addEntry')}
              </Button>
            </div>
          </div>
        )}
      </Dialog>

      {/* ── The note composer ─────────────────────────────────────────────── */}
      <Dialog
        open={noteDraft !== null}
        onClose={() => setNoteDraft(null)}
        title={noteDraft?.note ? t('notes.editNote') : t('notes.addNote')}
        description={noteDraft?.note
          ? t('notes.onlyYouWrote')
          : t('notes.atTheEnd')}
        className="sm:max-w-xl"
      >
        {noteDraft && (
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="journal-note" required>{t('notes.note')}</Label>
              <Textarea
                id="journal-note"
                rows={10}
                value={noteDraft.body}
                onChange={e => setNoteDraft({ ...noteDraft, body: e.target.value })}
              />
            </div>

            <FormError message={dialogError} />

            <div className="flex items-center justify-end gap-2">
              <Button variant="ghost" onClick={() => setNoteDraft(null)} disabled={isPending}>
                {t('action.cancel')}
              </Button>
              <Button
                variant="affirm"
                onClick={saveNote}
                disabled={isPending || !noteDraft.body.trim()}
              >
                {isPending ? t('action.saving') : noteDraft.note ? t('action.saveChanges') : t('notes.addNoteAction')}
              </Button>
            </div>
          </div>
        )}
      </Dialog>
    </div>
  )
}

/**
 * One topic: its heading, its thread, and the controls each of those two carries.
 *
 * A COMPONENT RATHER THAN A LOOP BODY because the two permission booleans are read at
 * different levels — `entry.mine` for the heading, `note.mine` per paragraph — and nesting
 * that inside the shell put four ternaries in one JSX expression that nobody could check.
 *
 * ── THE THREAD IS COLLAPSED UNTIL SOMEBODY OPENS IT, SINCE 2026-08-22 ────
 * An office keeps its notebook for years and a topic accumulates: "How the bank
 * reconciliation works" is one heading with fourteen paragraphs under it, and a screen that
 * expands all of them is a screen an officer scrolls past rather than reads. Collapsed, the
 * page is a table of contents of everything the office knows, which is what somebody
 * arriving at it actually wants.
 *
 * THE COUNT IS ON THE HEADING, so a collapsed topic still says how much is in it " a
 * disclosure that hides an unknown quantity is one nobody presses.
 *
 * IT IS A `<button>` WITH `aria-expanded`, and the panel is plain markup underneath rather
 * than a `role="region"`: the button names what it opens through its own text, which is the
 * heading. Same instinct as `MainRail` refusing `role="tablist"` — claim only what is
 * implemented.
 */
function EntryCard({
  entry, busy, zone, onAddNote, onEdit, onDelete, onEditNote, onDeleteNote,
}: {
  entry: JournalEntry
  busy: boolean
  /** The reader's timezone — every timestamp on a note is an instant. See lib/tz.ts. */
  zone: string
  onAddNote: () => void
  onEdit: () => void
  onDelete: () => void
  onEditNote: (note: JournalNote) => void
  onDeleteNote: (note: JournalNote) => void
}) {
  const t = useT()
  // COLLAPSED BY DEFAULT, always " including for a topic somebody has just opened. The
  // alternative (expand the newest, or expand a topic with one note) is a rule the reader
  // has to infer from behaviour, and it makes the page a different shape every visit.
  const [open, setOpen] = useState(false)
  const noteCount = entry.notes.length

  return (
    <li className="rounded-xl border bg-card p-4">
      <div className="flex flex-wrap items-start gap-x-3 gap-y-1">
        <div className="min-w-0 flex-1">
          {/* THE HEADING IS THE DISCLOSURE. Its text is the accessible name of the control,
              which is exactly what a reader needs announced — "How the bank reconciliation
              works, collapsed" rather than "expand, button". */}
          <button
            type="button"
            onClick={() => setOpen(o => !o)}
            aria-expanded={open}
            className="flex w-full min-w-0 items-center gap-2 text-left"
          >
            {open
              ? <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
              : <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />}
            <span className="min-w-0 flex-1 font-medium">{entry.title}</span>
            <span className="shrink-0 text-xs text-muted-foreground">
              {noteCount} note{noteCount === 1 ? '' : 's'}
            </span>
          </button>
          <p className="mt-1 pl-6 text-xs text-muted-foreground">
            {/* "A FORMER OFFICER" RATHER THAN "UNKNOWN". `author_id` is ON DELETE SET NULL so
                the office keeps the record when its author leaves the family, and "Unknown"
                would make that read like data loss rather than like a record outliving the
                person who wrote it. */}
            Started by {entry.author_name ?? 'a former officer'} · {formatInstantDate(entry.created_at, zone)}
          </p>
        </div>

        {entry.mine && (
          <div className="flex shrink-0 gap-1">
            <Button size="sm" variant="ghost" className="h-7 w-7 p-0"
              onClick={onEdit} disabled={busy}
              aria-label={`Rename “${entry.title}”`} title={t('action.rename')}>
              <Pencil className="h-3.5 w-3.5" />
            </Button>
            <Button size="sm" variant="ghost"
              className="h-7 w-7 p-0 text-destructive hover:text-destructive"
              onClick={onDelete} disabled={busy}
              aria-label={`Delete “${entry.title}”`} title={t('action.delete')}>
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          </div>
        )}
      </div>

      {open && (
        <>
          {/* ── The thread ──────────────────
              Oldest first, which is how a conversation is read. Each paragraph carries its
              own byline, because the whole point of a rolling topic is that two officers can
              both have written in it. */}
          {noteCount === 0 ? (
            <p className="mt-4 border-t pt-3 text-sm text-muted-foreground">
              {t('notes.nothingUnder')}
            </p>
          ) : (
            <ul className="mt-4 space-y-3 border-t pt-3">
              {entry.notes.map(note => (
                <li key={note.id} className="flex flex-wrap items-start gap-x-3 gap-y-1">
                  <div className="min-w-0 flex-1">
                    {/* `whitespace-pre-wrap`: the composer is a textarea and somebody writing
                        a handover note uses line breaks. Rendering it as one paragraph would
                        silently destroy the structure of every list anybody wrote. */}
                    <p className="whitespace-pre-wrap text-sm text-muted-foreground">{note.body}</p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {note.author_name ?? 'A former officer'} · {formatInstantDate(note.created_at, zone)}
                      {note.updated_at !== note.created_at
                        && ` · edited ${formatInstantDate(note.updated_at, zone)}`}
                    </p>
                  </div>
                  {note.mine && (
                    <div className="flex shrink-0 gap-1">
                      <Button size="sm" variant="ghost" className="h-7 w-7 p-0"
                        onClick={() => onEditNote(note)} disabled={busy}
                        aria-label={t('notes.editThisNote')} title={t('action.edit')}>
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                      <Button size="sm" variant="ghost"
                        className="h-7 w-7 p-0 text-destructive hover:text-destructive"
                        onClick={() => onDeleteNote(note)} disabled={busy}
                        aria-label={t('notes.deleteThisNote')} title={t('action.delete')}>
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  )}
                </li>
              ))}
            </ul>
          )}

          {/* ANY HOLDER OF THE OFFICE MAY ADD ONE, including to a topic somebody else
              started — that is the feature. A successor answers a predecessor underneath
              what they wrote instead of opening a rival topic. */}
          <div className="mt-3">
            <Button size="sm" variant="outline" onClick={onAddNote} disabled={busy}>
              <Plus /> {t('notes.addNote')}
            </Button>
          </div>
        </>
      )}
    </li>
  )
}
