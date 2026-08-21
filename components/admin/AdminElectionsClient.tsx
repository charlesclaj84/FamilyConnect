'use client'

import { useMemo, useState, useTransition } from 'react'
import Link from 'next/link'
import { Plus, Trash2, ChevronRight, Send, Undo2, Calendar, Pencil, MapPin } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { useConfirm } from '@/components/ui/confirm'
import { FormError, FieldError } from '@/components/ui/form-message'
import {
  createElection, updateElection, publishElection, unpublishElection, deleteElection,
  type OrganizerElection,
} from '@/app/actions/elections'
import { formatDate, formatDateRange } from '@/lib/date-utils'
import { useServerState } from '@/lib/use-server-state'
import { ELECTION_PHASE_PILL, ELECTION_WINDOW } from '@/components/elections/status'
import { ELECTION_PHASE_LABEL, windowProblem } from '@/lib/election-phase'
import { rolesForScope, type ElectionScope } from '@/lib/election-area'

/**
 * Running an election, after 20260821000001.
 *
 * ── THE THREE "ADVANCE" BUTTONS ARE GONE, AND THAT IS THE FEATURE ──────────────────
 * This screen used to carry Open Nominations, Start Voting and Close Election — a state
 * machine an organizer stepped through by hand, with four dates printed beside it that
 * governed nothing. The dates govern now: an election is a DRAFT or it is PUBLISHED, and once
 * published its phase is a function of its four windows and today. So the only lifecycle
 * controls left are the two that are genuinely decisions — publish it, or take it back — and
 * an organizer who sets a closing date can go away.
 *
 * ── EDITING IS DRAFTS ONLY, AND THE SCREEN SAYS SO RATHER THAN DISCOVERING IT ──────
 * `updateElection` refuses a published election, because its windows are what the family was
 * told; `unpublishElection` refuses one anybody has acted on. Both refusals are stated in the
 * row — the counts are on `OrganizerElection` precisely so the controls can be absent instead
 * of failing when pressed.
 *
 * ── THE LEVEL DRIVES THE POSITION PICKER ───────────────────────────────────────────
 * `rolesForScope` is the same function `createElection` validates with, imported rather than
 * reimplemented: a chapter election may only fill chapter-scoped offices, and offering an
 * office the action will refuse is the worst version of that rule. Changing the level clears
 * any position that is no longer sayable, and says that it did — silently emptying a field
 * somebody filled in reads as a bug.
 */

const SCOPES: { value: ElectionScope; label: string }[] = [
  { value: 'national', label: 'The whole family (National)' },
  { value: 'regional', label: 'One region' },
  { value: 'chapter', label: 'One chapter' },
]

interface Props {
  initialElections: OrganizerElection[]
  regions: { id: string; name: string }[]
  chapters: { id: string; name: string; region_id: string | null }[]
  roles: { name: string; scope: string | null }[]
}

interface FormState {
  title: string
  description: string
  scope: ElectionScope
  regionId: string
  chapterId: string
  nomOpen: string
  nomClose: string
  voteOpen: string
  voteClose: string
  positions: { title: string; max_winners: number }[]
}

const BLANK: FormState = {
  title: '', description: '', scope: 'national', regionId: '', chapterId: '',
  nomOpen: '', nomClose: '', voteOpen: '', voteClose: '',
  positions: [{ title: '', max_winners: 1 }],
}

export function AdminElectionsClient({ initialElections, regions, chapters, roles }: Props) {
  const confirm = useConfirm()
  // `useServerState`: a plain initializer reads props once and would then ignore every later
  // server render, including the one carrying a newly created election.
  const [elections, setElections] = useServerState(initialElections)
  // null = the form is closed. '' = creating. An id = editing that draft.
  const [editing, setEditing] = useState<string | null>(null)
  const [form, setForm] = useState<FormState>(BLANK)
  const [scopeNote, setScopeNote] = useState('')
  const [error, setError] = useState('')
  const [announce, setAnnounce] = useState<Record<string, boolean>>({})
  const [isPending, startTransition] = useTransition()

  const availableRoles = useMemo(
    () => rolesForScope(roles, form.scope).map(r => r.name),
    [roles, form.scope],
  )

  // Checked as the organizer types, with the SAME function the action uses. `requireAll` is
  // false here because this form saves a draft; `publishElection` is what demands all four.
  const dateProblem = windowProblem({
    nominations_open_on: form.nomOpen,
    nominations_close_on: form.nomClose,
    voting_open_on: form.voteOpen,
    voting_close_on: form.voteClose,
  }, { requireAll: false })

  function openCreate() {
    setForm(BLANK); setEditing(''); setError(''); setScopeNote('')
  }

  function openEdit(e: OrganizerElection) {
    setForm({
      title: e.title,
      description: e.description ?? '',
      scope: e.scope,
      regionId: e.region_id ?? '',
      chapterId: e.chapter_id ?? '',
      nomOpen: e.nominations_open_on ?? '',
      nomClose: e.nominations_close_on ?? '',
      voteOpen: e.voting_open_on ?? '',
      voteClose: e.voting_close_on ?? '',
      positions: e.positions.length ? e.positions.map(p => ({ ...p })) : [{ title: '', max_winners: 1 }],
    })
    setEditing(e.id); setError(''); setScopeNote('')
  }

  function closeForm() {
    setEditing(null); setError(''); setScopeNote('')
  }

  /**
   * Changing the level re-decides which offices are sayable, so any position that is no longer
   * one is cleared — and SAID, because a field emptying itself under somebody's cursor is
   * indistinguishable from a bug.
   */
  function changeScope(next: ElectionScope) {
    const allowed = new Set(rolesForScope(roles, next).map(r => r.name))
    const dropped = form.positions.filter(p => p.title && !allowed.has(p.title)).map(p => p.title)
    setForm(f => ({
      ...f,
      scope: next,
      regionId: next === 'regional' ? f.regionId : '',
      chapterId: next === 'chapter' ? f.chapterId : '',
      positions: f.positions.map(p => (p.title && !allowed.has(p.title) ? { ...p, title: '' } : p)),
    }))
    setScopeNote(dropped.length
      ? `${dropped.join(', ')} ${dropped.length === 1 ? 'is' : 'are'} not a `
        + `${next === 'national' ? 'national' : next} office, so ${dropped.length === 1 ? 'it has' : 'they have'} been cleared.`
      : '')
  }

  function setPosition(i: number, field: 'title' | 'max_winners', value: string | number) {
    setForm(f => ({
      ...f,
      positions: f.positions.map((pos, idx) => (idx === i ? { ...pos, [field]: value } : pos)),
    }))
  }

  function handleSave() {
    if (!form.title.trim()) { setError('Give the election a title.'); return }
    if (dateProblem) { setError(dateProblem); return }
    if (form.scope === 'regional' && !form.regionId) { setError('Choose which region.'); return }
    if (form.scope === 'chapter' && !form.chapterId) { setError('Choose which chapter.'); return }
    setError('')

    const payload = {
      title: form.title,
      description: form.description,
      scope: form.scope,
      region_id: form.scope === 'regional' ? form.regionId : null,
      chapter_id: form.scope === 'chapter' ? form.chapterId : null,
      nominations_open_on: form.nomOpen,
      nominations_close_on: form.nomClose,
      voting_open_on: form.voteOpen,
      voting_close_on: form.voteClose,
      positions: form.positions.filter(p => p.title.trim()),
    }

    startTransition(async () => {
      const result = editing
        ? await updateElection(editing, payload)
        : await createElection(payload)
      if (!result.success) { setError(result.message ?? 'Could not save the election.'); return }
      // No optimistic row. `revalidatePath` in the action re-renders the server component and
      // `useServerState` picks the new list up — which is what keeps the scope LABEL and the
      // derived phase honest, since both are resolved on the server and cannot be guessed here.
      closeForm()
    })
  }

  async function handlePublish(e: OrganizerElection) {
    const problem = windowProblem({
      nominations_open_on: e.nominations_open_on ?? '',
      nominations_close_on: e.nominations_close_on ?? '',
      voting_open_on: e.voting_open_on ?? '',
      voting_close_on: e.voting_close_on ?? '',
    }, { requireAll: true })
    if (problem) { setError(problem); return }
    if (!e.positions.length) {
      setError('Add at least one position before publishing — a ballot with no offices on it has nothing to vote for.')
      return
    }
    const willAnnounce = announce[e.id] ?? true
    const ok = await confirm({
      title: 'Publish this election',
      description: `"${e.title}" goes on the calendar for ${e.scope_label}. Nominations open `
        + `${formatDate(e.nominations_open_on)} and voting closes ${formatDate(e.voting_close_on)}; `
        + 'both windows open and close on their own from then on.'
        + (willAnnounce ? ' An announcement will be posted.' : ''),
      confirmLabel: 'Publish',
    })
    if (!ok) return
    setError('')
    startTransition(async () => {
      const result = await publishElection(e.id, { announce: willAnnounce })
      if (!result.success) setError(result.message ?? 'Could not publish.')
    })
  }

  async function handleUnpublish(e: OrganizerElection) {
    const ok = await confirm({
      title: 'Return to draft',
      description: `Take "${e.title}" off the family's calendar and back to a draft? Nobody has `
        + 'been nominated and nothing has been voted on, so nothing is lost.',
      confirmLabel: 'Return to draft',
    })
    if (!ok) return
    setError('')
    startTransition(async () => {
      const result = await unpublishElection(e.id)
      if (!result.success) setError(result.message ?? 'Could not return it to draft.')
    })
  }

  async function handleDelete(e: OrganizerElection) {
    const ok = await confirm({
      title: 'Delete election',
      description: e.nomination_count || e.vote_count
        ? `Delete "${e.title}", its ${e.nomination_count} nomination(s) and its `
          + `${e.vote_count} vote(s)? This cannot be undone.`
        : `Delete "${e.title}" and all of its positions? This cannot be undone.`,
      confirmLabel: 'Delete election',
      destructive: true,
    })
    if (!ok) return
    startTransition(async () => {
      const result = await deleteElection(e.id)
      if (!result.success) { setError(result.message ?? 'Could not delete.'); return }
      setElections(prev => prev.filter(x => x.id !== e.id))
    })
  }

  return (
    <div className="space-y-6">
      {editing === null ? (
        <Button size="sm" onClick={openCreate}>
          <Plus className="h-4 w-4 mr-1" /> New Election
        </Button>
      ) : (
        <div className="rounded-xl border bg-card p-5 space-y-5 max-w-xl">
          <h2 className="font-semibold text-sm uppercase tracking-wide text-muted-foreground">
            {editing ? 'Edit draft' : 'New election'}
          </h2>

          <div className="space-y-1.5">
            <Label required>Title</Label>
            <Input
              value={form.title}
              onChange={ev => setForm(f => ({ ...f, title: ev.target.value }))}
              placeholder="2027 Officer Elections"
            />
          </div>
          <div className="space-y-1.5">
            <Label>Description</Label>
            <Textarea
              rows={2}
              value={form.description}
              onChange={ev => setForm(f => ({ ...f, description: ev.target.value }))}
            />
          </div>

          {/* ── The level ──────────────────────────────────────────────────── */}
          <div className="space-y-2 rounded-lg border p-3">
            <p className="text-xs font-semibold uppercase tracking-wide flex items-center gap-1.5 text-brand-on-soft">
              <MapPin className="h-3.5 w-3.5" /> Who votes
            </p>
            <Select
              value={form.scope}
              onChange={ev => changeScope(ev.target.value as ElectionScope)}
              aria-label="Which part of the family this election is for"
            >
              {SCOPES.map(s => (
                <option
                  key={s.value}
                  value={s.value}
                  // A family with no regions or chapters gets National alone rather than a
                  // disabled tease for something it cannot create from this screen.
                  disabled={(s.value === 'regional' && regions.length === 0)
                    || (s.value === 'chapter' && chapters.length === 0)}
                >{s.label}</option>
              ))}
            </Select>

            {form.scope === 'regional' && (
              <Select
                value={form.regionId}
                onChange={ev => setForm(f => ({ ...f, regionId: ev.target.value }))}
                aria-label="Region"
              >
                <option value="">— Select region —</option>
                {regions.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
              </Select>
            )}
            {form.scope === 'chapter' && (
              <Select
                value={form.chapterId}
                onChange={ev => setForm(f => ({ ...f, chapterId: ev.target.value }))}
                aria-label="Chapter"
              >
                <option value="">— Select chapter —</option>
                {chapters.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </Select>
            )}
            <p className="text-xs text-muted-foreground">
              Only this part of the family can see the election, be nominated, or vote — and it
              can only fill offices recorded at the same level.
            </p>
            {regions.length === 0 && chapters.length === 0 && (
              <p className="text-xs text-muted-foreground">
                This family has no regions or chapters yet, so every election is National.
              </p>
            )}
          </div>

          {/* ── Nominations window ─────────────────────────────────────────── */}
          <div className={`space-y-2 rounded-lg border p-3 ${ELECTION_WINDOW.nominations.well}`}>
            <p className={`text-xs font-semibold uppercase tracking-wide flex items-center gap-1.5 ${ELECTION_WINDOW.nominations.label}`}>
              <Calendar className="h-3.5 w-3.5" /> Nominations
            </p>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div className="space-y-1">
                <Label className="text-xs">Opens</Label>
                <Input type="date" value={form.nomOpen}
                  onChange={ev => setForm(f => ({ ...f, nomOpen: ev.target.value }))} />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Closes after</Label>
                <Input type="date" value={form.nomClose}
                  onChange={ev => setForm(f => ({ ...f, nomClose: ev.target.value }))} />
              </div>
            </div>
            <p className="text-xs text-muted-foreground">
              Both days count — nominations are open from the first through the last.
            </p>
          </div>

          {/* ── Voting window ──────────────────────────────────────────────── */}
          <div className={`space-y-2 rounded-lg border p-3 ${ELECTION_WINDOW.voting.well}`}>
            <p className={`text-xs font-semibold uppercase tracking-wide flex items-center gap-1.5 ${ELECTION_WINDOW.voting.label}`}>
              <Calendar className="h-3.5 w-3.5" /> Voting
            </p>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div className="space-y-1">
                <Label className="text-xs">Opens</Label>
                <Input type="date" value={form.voteOpen}
                  onChange={ev => setForm(f => ({ ...f, voteOpen: ev.target.value }))} />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Closes after</Label>
                <Input type="date" value={form.voteClose}
                  onChange={ev => setForm(f => ({ ...f, voteClose: ev.target.value }))} />
              </div>
            </div>
            {/* Beside the fields it is about, because this is one input being wrong rather
                than the save being refused — FieldError, not FormError. */}
            <FieldError message={dateProblem} />
          </div>

          {/* ── Positions ──────────────────────────────────────────────────── */}
          <div className="space-y-3">
            <p className="text-sm font-medium">Positions</p>
            {form.positions.map((pos, i) => (
              <div key={i} className="flex gap-2 items-end">
                <div className="flex-1 space-y-1">
                  <Label className="text-xs">Position {i + 1}</Label>
                  <Select value={pos.title}
                    onChange={ev => setPosition(i, 'title', ev.target.value)}>
                    <option value="">— Select position —</option>
                    {availableRoles.map(r => <option key={r} value={r}>{r}</option>)}
                  </Select>
                </div>
                <div className="w-20 space-y-1">
                  <Label className="text-xs">Winners</Label>
                  <Input type="number" min="1" value={pos.max_winners}
                    onChange={ev => setPosition(i, 'max_winners', parseInt(ev.target.value) || 1)} />
                </div>
                {form.positions.length > 1 && (
                  <Button size="sm" variant="ghost"
                    aria-label={`Remove position ${i + 1}`}
                    className="text-destructive hover:text-destructive h-8 w-8 p-0"
                    onClick={() => setForm(f => ({
                      ...f, positions: f.positions.filter((_, idx) => idx !== i),
                    }))}>×</Button>
                )}
              </div>
            ))}
            {availableRoles.length === 0 && (
              <p className="text-xs text-muted-foreground">
                No {form.scope === 'national' ? 'national' : form.scope} offices recorded yet.
                Add them under Members › Organization first.
              </p>
            )}
            <FieldError message={scopeNote} />
            <Button size="sm" variant="outline"
              onClick={() => setForm(f => ({
                ...f, positions: [...f.positions, { title: '', max_winners: 1 }],
              }))}>+ Add Position</Button>
          </div>

          <FormError message={error} />
          <div className="flex gap-2">
            <Button size="sm" onClick={handleSave} disabled={isPending}>
              {isPending ? 'Saving…' : editing ? 'Save draft' : 'Create draft'}
            </Button>
            <Button size="sm" variant="ghost" onClick={closeForm}>Cancel</Button>
          </div>
          <p className="text-xs text-muted-foreground">
            Saved as a draft. Nobody sees it until you publish it.
          </p>
        </div>
      )}

      {editing === null && <FormError message={error} />}

      {elections.length === 0 ? (
        <p className="text-sm text-muted-foreground">No elections yet.</p>
      ) : (
        <ul className="divide-y rounded-xl border overflow-hidden">
          {elections.map(e => (
            <li key={e.id} className="px-4 py-3 space-y-1.5">
              <div className="flex flex-wrap items-center gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="text-sm font-medium truncate">{e.title}</p>
                    <span className={`text-xs px-2 py-0.5 rounded-full shrink-0 ${ELECTION_PHASE_PILL[e.phase]}`}>
                      {ELECTION_PHASE_LABEL[e.phase]}
                    </span>
                    <span className="text-xs px-2 py-0.5 rounded-full shrink-0 bg-brand-soft text-brand-on-soft">
                      {e.scope_label}
                    </span>
                  </div>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  {e.status === 'draft' && (
                    <>
                      <label className="flex items-center gap-1 text-xs text-muted-foreground cursor-pointer select-none mr-1">
                        <input
                          type="checkbox"
                          checked={announce[e.id] ?? true}
                          onChange={ev => setAnnounce(a => ({ ...a, [e.id]: ev.target.checked }))}
                          className="h-3.5 w-3.5 rounded border-input accent-primary"
                        />
                        Announce
                      </label>
                      <Button size="sm" variant="outline" className="h-7 text-xs"
                        onClick={() => handlePublish(e)} disabled={isPending}>
                        <Send className="h-3 w-3 mr-1" /> Publish
                      </Button>
                      <Button size="sm" variant="ghost" className="h-7 w-7 p-0"
                        aria-label={`Edit ${e.title}`} onClick={() => openEdit(e)}>
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                    </>
                  )}
                  {/* Offered only while nothing has happened on it — see the header. */}
                  {e.status === 'published' && e.nomination_count === 0 && e.vote_count === 0 && (
                    <Button size="sm" variant="outline" className="h-7 text-xs"
                      onClick={() => handleUnpublish(e)} disabled={isPending}>
                      <Undo2 className="h-3 w-3 mr-1" /> Return to draft
                    </Button>
                  )}
                  <Link href={`/community/elections/${e.id}`}
                    aria-label={`Open ${e.title}`}>
                    <Button size="sm" variant="ghost" className="h-7 w-7 p-0">
                      <ChevronRight className="h-3.5 w-3.5" />
                    </Button>
                  </Link>
                  <Button size="sm" variant="ghost"
                    aria-label={`Delete ${e.title}`}
                    className="h-7 w-7 p-0 text-destructive hover:text-destructive"
                    onClick={() => handleDelete(e)} disabled={isPending}>
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>

              <div className="flex flex-wrap gap-x-6 gap-y-0.5 pl-0.5">
                {e.nominations_open_on && (
                  <p className="text-xs text-muted-foreground">
                    Nominations: {formatDateRange(e.nominations_open_on, e.nominations_close_on)}
                  </p>
                )}
                {e.voting_open_on && (
                  <p className="text-xs text-muted-foreground">
                    Voting: {formatDateRange(e.voting_open_on, e.voting_close_on)}
                  </p>
                )}
                <p className="text-xs text-muted-foreground">
                  {e.positions.length} position{e.positions.length === 1 ? '' : 's'}
                  {e.nomination_count > 0 && ` · ${e.nomination_count} nomination${e.nomination_count === 1 ? '' : 's'}`}
                  {e.vote_count > 0 && ` · ${e.vote_count} vote${e.vote_count === 1 ? '' : 's'}`}
                </p>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
