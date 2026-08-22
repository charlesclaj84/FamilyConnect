'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { BookText, CalendarCheck, MessageSquarePlus, Pencil, Plus, Trash2, Users, Vote } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Dialog } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { PersonMultiSelect, type SelectablePerson } from '@/components/ui/person-multi-select'
import { useConfirm } from '@/components/ui/confirm'
import { FormError } from '@/components/ui/form-message'
import { MainRail } from '@/components/layout/MainRail'
import { useServerState } from '@/lib/use-server-state'
import { formatDate, todayLocal } from '@/lib/date-utils'
import {
  addJournalEntry, addJournalNote, deleteJournalEntry, deleteJournalNote, getJournalEntries,
  setMeetingAttendees, updateJournalEntry, updateJournalNote,
  type JournalEntry, type JournalNote, type JournalOffice,
} from '@/app/actions/journal'

/**
 * Journals, for whoever holds the office.
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
   * The family, for the attendee picker. EMPTY IS A REAL ANSWER — `getJournalAttendeeOptions`
   * returns `[]` for anybody with no office, and `PersonMultiSelect` says so itself rather
   * than rendering an empty box.
   */
  attendeeOptions: SelectablePerson[]
}

/** The composer, for a new topic or for retitling one that exists. */
interface EntryDraft {
  /** The topic being edited, or null when opening a new one. */
  entry: JournalEntry | null
  kind: 'note' | 'meeting'
  title: string
  /** `YYYY-MM-DD`. Only ever read for a meeting — the CHECK refuses one on a plain note. */
  metOn: string
  /** The opening paragraph. New topics only: an existing thread is added to, never rewritten. */
  firstNote: string
  attendeeIds: string[]
}

/** The note composer, for adding a paragraph or editing one of your own. */
interface NoteDraft {
  entryId: string
  /** The note being edited, or null when adding one. */
  note: JournalNote | null
  body: string
}

const KIND_LABEL: Record<string, string> = { note: 'Note', meeting: 'Meeting notes' }

export function JournalClient({
  offices, initialOffice, initialEntries, attendeeOptions,
}: Props) {
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

  function openNewEntry(kind: 'note' | 'meeting') {
    setDialogError('')
    setEntryDraft({
      entry: null,
      kind,
      // A MEETING'S TITLE IS PREFILLED and a note's is not. "Meeting" plus a date is what an
      // officer would type anyway, and the title is required — so the one field they cannot
      // skip starts filled in for the kind where its content is predictable.
      title: kind === 'meeting' ? `Meeting — ${formatDate(todayLocal()) ?? ''}` : '',
      metOn: todayLocal(),
      firstNote: '',
      attendeeIds: [],
    })
  }

  function openEditEntry(entry: JournalEntry) {
    setDialogError('')
    setEntryDraft({
      entry,
      kind: entry.kind === 'meeting' ? 'meeting' : 'note',
      title: entry.title,
      metOn: entry.met_on ?? todayLocal(),
      firstNote: '',
      attendeeIds: entry.attendees.map(a => a.person_id),
    })
  }

  function saveEntry() {
    if (!entryDraft) return
    const draft = entryDraft
    if (!draft.title.trim()) { setDialogError('Give the entry a title.'); return }
    if (draft.kind === 'meeting' && !draft.metOn) {
      setDialogError('Say which day the meeting was.'); return
    }
    setDialogError('')
    startTransition(async () => {
      if (!draft.entry) {
        const result = await addJournalEntry(active, {
          title: draft.title,
          kind: draft.kind,
          metOn: draft.kind === 'meeting' ? draft.metOn : null,
          firstNote: draft.firstNote,
          attendeeIds: draft.kind === 'meeting' ? draft.attendeeIds : [],
        })
        if (!result.success) {
          setDialogError(result.message ?? 'That entry could not be saved.')
          // REFETCHED EVEN ON FAILURE, because `addJournalEntry` reports a PARTIAL success:
          // the topic can exist while its first note or its attendee list did not save. Left
          // alone, the officer would read a refusal over a topic that is really there.
          setEntries(await getJournalEntries(active))
          return
        }
      } else {
        const result = await updateJournalEntry(
          draft.entry.id,
          draft.title,
          draft.kind === 'meeting' ? draft.metOn : null,
        )
        if (!result.success) {
          setDialogError(result.message ?? 'That entry could not be saved.')
          return
        }
        // THE ATTENDEE LIST IS ITS OWN ACTION, and its own refusal. Only sent when it has
        // actually changed: re-saving an unchanged list is a write nobody asked for, and its
        // refusal would then be reported on a dialog where nothing about attendance was
        // touched.
        if (draft.kind === 'meeting' && attendeesChanged(draft)) {
          const attendeeResult = await setMeetingAttendees(draft.entry.id, draft.attendeeIds)
          if (!attendeeResult.success) {
            setDialogError(attendeeResult.message ?? 'Who attended could not be saved.')
            setEntries(await getJournalEntries(active))
            return
          }
        }
      }
      setEntryDraft(null)
      reload()
    })
  }

  async function removeEntry(entry: JournalEntry) {
    const ok = await confirm({
      title: 'Delete this entry',
      description: `Delete “${entry.title}”? Every note under it goes too, for everybody who `
        + 'holds this office, now and later. This cannot be undone.',
      confirmLabel: 'Delete entry',
      destructive: true,
    })
    if (!ok) return
    setError('')
    startTransition(async () => {
      const result = await deleteJournalEntry(entry.id)
      if (!result.success) {
        setError(result.message ?? 'That entry could not be removed.')
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
    if (!draft.body.trim()) { setDialogError('Write something first.'); return }
    setDialogError('')
    startTransition(async () => {
      const result = draft.note
        ? await updateJournalNote(draft.note.id, draft.body)
        : await addJournalNote(draft.entryId, draft.body)
      if (!result.success) {
        setDialogError(result.message ?? 'That note could not be saved.')
        return
      }
      setNoteDraft(null)
      reload()
    })
  }

  async function removeNote(note: JournalNote) {
    const ok = await confirm({
      title: 'Delete this note',
      description: 'Delete this note? The rest of the entry stays. This cannot be undone.',
      confirmLabel: 'Delete note',
      destructive: true,
    })
    if (!ok) return
    setError('')
    startTransition(async () => {
      const result = await deleteJournalNote(note.id)
      if (!result.success) {
        setError(result.message ?? 'That note could not be removed.')
        return
      }
      reload()
    })
  }

  const activeOffice = offices.find(o => o.role_id === active)

  const newControls = (
    <div className="flex flex-wrap gap-2">
      <Button size="sm" variant="affirm" onClick={() => openNewEntry('note')} disabled={isPending}>
        <Plus /> New entry
      </Button>
      <Button size="sm" variant="outline" onClick={() => openNewEntry('meeting')} disabled={isPending}>
        <CalendarCheck /> Meeting notes
      </Button>
    </div>
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
          label="Offices you hold"
          items={offices.map(o => ({ id: o.role_id, label: o.title }))}
          active={active}
          onSelect={loadOffice}
          action={newControls}
        />
      )}

      {offices.length === 1 && (
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm text-muted-foreground">
            The journal for <span className="font-medium text-foreground">{activeOffice?.title}</span>.
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
          Everyone holding <span className="font-medium text-foreground">{activeOffice.name}</span>{' '}
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
            Whatever you write here stays with the office. Whoever holds it next will read it.
          </p>
        </div>
      ) : (
        <ul className="space-y-4">
          {entries.map(entry => (
            <EntryCard
              key={entry.id}
              entry={entry}
              busy={isPending}
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
          ? 'Edit entry'
          : `${entryDraft?.kind === 'meeting' ? 'Meeting notes' : 'New entry'}`
            + `${activeOffice ? ` — ${activeOffice.name}` : ''}`}
        description={entryDraft?.entry
          ? 'Only you can change what you recorded, and only while you hold this office.'
          : 'This stays with the office. Whoever holds it next will read it.'}
        className="sm:max-w-xl"
      >
        {entryDraft && (
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="journal-title" required>Title</Label>
              <Input
                id="journal-title"
                value={entryDraft.title}
                onChange={e => setEntryDraft({ ...entryDraft, title: e.target.value })}
                placeholder={entryDraft.kind === 'meeting'
                  ? 'Quarterly officers’ meeting'
                  : 'How the bank reconciliation works'}
              />
              <p className="text-xs text-muted-foreground">
                What the list shows. Everything else goes in notes underneath it.
              </p>
            </div>

            {entryDraft.kind === 'meeting' && (
              <>
                <div className="space-y-1.5">
                  <Label htmlFor="journal-met-on" required>Day of the meeting</Label>
                  <Input
                    id="journal-met-on"
                    type="date"
                    className="max-w-[12rem]"
                    value={entryDraft.metOn}
                    onChange={e => setEntryDraft({ ...entryDraft, metOn: e.target.value })}
                  />
                </div>

                {/* THE SHARED CONTROL, not a column of checkboxes. A hundred-member family is
                    an ordinary one for this product, and `PersonMultiSelect` is what survives
                    that size — search, chips that stay visible when a filter hides a ticked
                    name, and an honest count. AGENTS.md forbids a fourth hand-rolled copy. */}
                <PersonMultiSelect
                  people={attendeeOptions}
                  selected={entryDraft.attendeeIds}
                  onChange={next => setEntryDraft({ ...entryDraft, attendeeIds: next })}
                  label="Who attended"
                  hint="Recorded on the meeting, and only visible inside this office’s journal."
                  emptyMessage="No family members to choose from yet."
                  disabled={isPending}
                />
              </>
            )}

            {/* ONLY ON A NEW TOPIC. An existing thread is added to from its own card — there
                is no "edit the entry's text", because the text is the notes and each one
                belongs to whoever wrote it. */}
            {!entryDraft.entry && (
              <div className="space-y-1.5">
                <Label htmlFor="journal-first-note">
                  {entryDraft.kind === 'meeting' ? 'Notes from the meeting' : 'First note'}
                </Label>
                <Textarea
                  id="journal-first-note"
                  rows={8}
                  value={entryDraft.firstNote}
                  onChange={e => setEntryDraft({ ...entryDraft, firstNote: e.target.value })}
                  placeholder={entryDraft.kind === 'meeting'
                    ? 'What was discussed, and what was decided.'
                    : 'Optional — you can add notes to this entry later.'}
                />
                <p className="text-xs text-muted-foreground">
                  You can add more notes to this entry whenever there is something to add.
                </p>
              </div>
            )}

            {/* WITH THE BUTTONS, not beside the field. The dialog's body scrolls and its
                footer does not, so a message rendered next to an input can be off-screen at
                the moment somebody presses Save again. */}
            <FormError message={dialogError} />

            <div className="flex items-center justify-end gap-2">
              <Button variant="ghost" onClick={() => setEntryDraft(null)} disabled={isPending}>
                Cancel
              </Button>
              <Button
                variant="affirm"
                onClick={saveEntry}
                disabled={isPending || !entryDraft.title.trim()}
              >
                {isPending ? 'Saving…' : entryDraft.entry ? 'Save changes' : 'Add entry'}
              </Button>
            </div>
          </div>
        )}
      </Dialog>

      {/* ── The note composer ─────────────────────────────────────────────── */}
      <Dialog
        open={noteDraft !== null}
        onClose={() => setNoteDraft(null)}
        title={noteDraft?.note ? 'Edit note' : 'Add a note'}
        description={noteDraft?.note
          ? 'Only you can change what you wrote, and only while you hold this office.'
          : 'It goes at the end of this entry, under your name.'}
        className="sm:max-w-xl"
      >
        {noteDraft && (
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="journal-note" required>Note</Label>
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
                Cancel
              </Button>
              <Button
                variant="affirm"
                onClick={saveNote}
                disabled={isPending || !noteDraft.body.trim()}
              >
                {isPending ? 'Saving…' : noteDraft.note ? 'Save changes' : 'Add note'}
              </Button>
            </div>
          </div>
        )}
      </Dialog>
    </div>
  )
}

/**
 * Whether the attendee list in the draft differs from the one on the row.
 *
 * Compared as SETS, because `PersonMultiSelect` does not preserve order and says so — an
 * order-sensitive comparison would report a change every time somebody unticked a name and
 * ticked it again, and each false positive is a write, and every write can be refused.
 */
function attendeesChanged(draft: EntryDraft): boolean {
  const before = new Set((draft.entry?.attendees ?? []).map(a => a.person_id))
  const after = new Set(draft.attendeeIds)
  if (before.size !== after.size) return true
  for (const id of after) if (!before.has(id)) return true
  return false
}

/**
 * One topic: its heading, its thread, and the controls each of those two carries.
 *
 * A COMPONENT RATHER THAN A LOOP BODY because the two permission booleans are read at
 * different levels — `entry.mine` for the heading, `note.mine` per paragraph — and nesting
 * that inside the shell put four ternaries in one JSX expression that nobody could check.
 */
function EntryCard({
  entry, busy, onAddNote, onEdit, onDelete, onEditNote, onDeleteNote,
}: {
  entry: JournalEntry
  busy: boolean
  onAddNote: () => void
  onEdit: () => void
  onDelete: () => void
  onEditNote: (note: JournalNote) => void
  onDeleteNote: (note: JournalNote) => void
}) {
  const isMeeting = entry.kind === 'meeting'

  return (
    <li className="rounded-xl border bg-card p-4">
      <div className="flex flex-wrap items-start gap-x-3 gap-y-1">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="min-w-0 font-medium">{entry.title}</h2>
            {/* THE KIND IS PRINTED ONLY FOR A MEETING. A pill saying "Note" on every other
                card is a label on the default, which is furniture — and it would make the one
                distinction that matters harder to see rather than easier. */}
            {isMeeting && (
              <span className="shrink-0 whitespace-nowrap rounded-full bg-brand-soft px-2 py-0.5 text-[11px] font-medium text-brand-on-soft">
                {KIND_LABEL.meeting}
              </span>
            )}
          </div>
          <p className="mt-1 text-xs text-muted-foreground">
            {isMeeting && entry.met_on && <>Met {formatDate(entry.met_on)} · </>}
            {/* "A FORMER OFFICER" RATHER THAN "UNKNOWN". `author_id` is ON DELETE SET NULL so
                the office keeps the record when its author leaves the family, and "Unknown"
                would make that read like data loss rather than like a record outliving the
                person who wrote it. */}
            Started by {entry.author_name ?? 'a former officer'} · {formatDate(entry.created_at)}
          </p>
        </div>

        {entry.mine && (
          <div className="flex shrink-0 gap-1">
            <Button size="sm" variant="ghost" className="h-7 w-7 p-0"
              onClick={onEdit} disabled={busy}
              aria-label={`Edit “${entry.title}”`} title="Edit">
              <Pencil className="h-3.5 w-3.5" />
            </Button>
            <Button size="sm" variant="ghost"
              className="h-7 w-7 p-0 text-destructive hover:text-destructive"
              onClick={onDelete} disabled={busy}
              aria-label={`Delete “${entry.title}”`} title="Delete">
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          </div>
        )}
      </div>

      {isMeeting && (
        <div className="mt-3 flex flex-wrap items-baseline gap-x-2 gap-y-1 text-xs">
          <span className="inline-flex items-center gap-1 font-medium text-foreground">
            <Users className="h-3.5 w-3.5" aria-hidden="true" /> Attended
          </span>
          {entry.attendees.length ? (
            <span className="text-muted-foreground">
              {entry.attendees.map(a => a.name).join(', ')}
            </span>
          ) : (
            // NOT AN ERROR AND NOT A REFUSAL. Nobody listed is an ordinary state for a meeting
            // recorded in a hurry, and only the person who recorded it can fix it — so this
            // says what is missing without implying anything went wrong.
            <span className="text-muted-foreground">
              nobody listed yet{entry.mine ? ' — Edit to add names' : ''}
            </span>
          )}
        </div>
      )}

      {/* ── The thread ──────────────────────────────────────────────────────
          Oldest first, which is how a conversation is read. Each paragraph carries its own
          byline, because the whole point of a rolling topic is that two officers can both
          have written in it. */}
      {entry.notes.length > 0 && (
        <ul className="mt-4 space-y-3 border-t pt-3">
          {entry.notes.map(note => (
            <li key={note.id} className="flex flex-wrap items-start gap-x-3 gap-y-1">
              <div className="min-w-0 flex-1">
                {/* `whitespace-pre-wrap`: the composer is a textarea and somebody writing a
                    handover note uses line breaks. Rendering it as one paragraph would
                    silently destroy the structure of every list anybody wrote. */}
                <p className="whitespace-pre-wrap text-sm text-muted-foreground">{note.body}</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {note.author_name ?? 'A former officer'} · {formatDate(note.created_at)}
                  {note.updated_at !== note.created_at
                    && ` · edited ${formatDate(note.updated_at)}`}
                </p>
              </div>
              {note.mine && (
                <div className="flex shrink-0 gap-1">
                  <Button size="sm" variant="ghost" className="h-7 w-7 p-0"
                    onClick={() => onEditNote(note)} disabled={busy}
                    aria-label="Edit this note" title="Edit">
                    <Pencil className="h-3.5 w-3.5" />
                  </Button>
                  <Button size="sm" variant="ghost"
                    className="h-7 w-7 p-0 text-destructive hover:text-destructive"
                    onClick={() => onDeleteNote(note)} disabled={busy}
                    aria-label="Delete this note" title="Delete">
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}

      {/* ── Voting on tasks: A PLACEHOLDER, AND IT SAYS SO ──────────────────
          There is no schema behind this and there deliberately is not — see
          `20260822000001`'s header. A control that looked real and did nothing would be worse
          than a sentence: AGENTS.md's rule is that a switch nothing reads "reads as a control
          being honoured", and an officer who thought the family had voted would be wrong
          about a decision rather than about a feature.

          `bg-muted` and not `--destructive` or `--brand-withheld`: nothing has failed and no
          capability is being taken away. This is a part of the screen that is not built yet. */}
      {isMeeting && (
        <div className="mt-4 rounded-lg border border-dashed bg-muted/40 px-3 py-3">
          <p className="flex items-center gap-1.5 text-xs font-medium text-foreground">
            <Vote className="h-3.5 w-3.5" aria-hidden="true" /> Voting on tasks
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            Not here yet. When it is, this is where the meeting will turn what it decided into
            tasks and let the people who attended vote on them. For now, write what was agreed
            in a note.
          </p>
        </div>
      )}

      <div className="mt-4 border-t pt-3">
        {/* NOT BEHIND `entry.mine`. Any holder of the office may add to any topic, which is
            what makes it a conversation rather than a filing cabinet. */}
        <Button size="sm" variant="outline" onClick={onAddNote} disabled={busy}>
          <MessageSquarePlus /> Add a note
        </Button>
      </div>
    </li>
  )
}
