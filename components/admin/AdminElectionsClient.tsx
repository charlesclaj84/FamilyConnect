'use client'

import { useState, useTransition } from 'react'
import { Plus, Trash2, ChevronRight, PlayCircle, Calendar } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { useConfirm } from '@/components/ui/confirm'
import { createElection, updateElectionStatus, deleteElection, type Election } from '@/app/actions/elections'
import { formatDate } from '@/lib/date-utils'
import { useServerState } from '@/lib/use-server-state'
import { ELECTION_STATUS_PILL, ELECTION_WINDOW } from '@/components/elections/status'
import Link from 'next/link'

const STATUS_NEXT: Record<Election['status'], Election['status'] | null> = {
  draft: 'nominations',
  nominations: 'voting',
  voting: 'closed',
  closed: null,
}

const STATUS_LABEL: Record<Election['status'], string> = {
  draft: 'Draft',
  nominations: 'Nominations Open',
  voting: 'Voting Open',
  closed: 'Closed',
}

const STATUS_ACTION: Record<Election['status'], string> = {
  draft: 'Open Nominations',
  nominations: 'Start Voting',
  voting: 'Close Election',
  closed: '',
}

const fmtDate = (s: string) => formatDate(s) ?? ''

interface Props {
  initialElections: Election[]
  roles: string[]
}

export function AdminElectionsClient({ initialElections, roles }: Props) {
  const confirm = useConfirm()
  // `useServerState`: a plain initializer reads props once and would then ignore
  // every later server render, including the one carrying a newly created election.
  const [elections, setElections] = useServerState(initialElections)
  const [showForm, setShowForm] = useState(false)
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [positions, setPositions] = useState([{ title: '', max_winners: 1 }])
  const [nomOpenAt, setNomOpenAt] = useState('')
  const [nomCloseAt, setNomCloseAt] = useState('')
  const [voteOpenAt, setVoteOpenAt] = useState('')
  const [voteCloseAt, setVoteCloseAt] = useState('')
  const [announce, setAnnounce] = useState(false)
  const [error, setError] = useState('')
  const [isPending, startTransition] = useTransition()

  function addPosition() { setPositions(p => [...p, { title: '', max_winners: 1 }]) }
  function updatePosition(i: number, field: 'title' | 'max_winners', value: string | number) {
    setPositions(p => p.map((pos, idx) => idx === i ? { ...pos, [field]: value } : pos))
  }
  function removePosition(i: number) { setPositions(p => p.filter((_, idx) => idx !== i)) }

  function handleCreate() {
    if (!title.trim()) { setError('Title is required'); return }
    if (positions.some(p => !p.title.trim())) { setError('All positions need a title'); return }
    setError('')
    startTransition(async () => {
      const result = await createElection({
        title, description,
        nominations_open_at: nomOpenAt ? new Date(nomOpenAt).toISOString() : null,
        nominations_close_at: nomCloseAt ? new Date(nomCloseAt).toISOString() : null,
        voting_open_at: voteOpenAt ? new Date(voteOpenAt).toISOString() : null,
        voting_close_at: voteCloseAt ? new Date(voteCloseAt).toISOString() : null,
        positions,
        announce,
      })
      if (!result.success || !result.id) { setError(result.message ?? 'Failed'); return }
      // Prepend, matching `getAllElections`' created_at-descending order.
      setElections(prev => [{
        id: result.id!,
        title: title.trim(),
        description: description.trim() || null,
        status: 'draft',
        nominations_open_at: nomOpenAt ? new Date(nomOpenAt).toISOString() : null,
        nominations_close_at: nomCloseAt ? new Date(nomCloseAt).toISOString() : null,
        voting_open_at: voteOpenAt ? new Date(voteOpenAt).toISOString() : null,
        voting_close_at: voteCloseAt ? new Date(voteCloseAt).toISOString() : null,
        created_at: new Date().toISOString(),
      }, ...prev])
      setTitle(''); setDescription('')
      setPositions([{ title: '', max_winners: 1 }])
      setNomOpenAt(''); setNomCloseAt(''); setVoteOpenAt(''); setVoteCloseAt(''); setAnnounce(false)
      setShowForm(false)
    })
  }

  async function handleAdvanceStatus(election: Election) {
    const next = STATUS_NEXT[election.status]
    if (!next) return
    const ok = await confirm({
      title: STATUS_ACTION[election.status],
      description: `Move "${election.title}" from ${STATUS_LABEL[election.status]} to ${STATUS_LABEL[next]}? This cannot be stepped back.`,
      confirmLabel: STATUS_ACTION[election.status],
      destructive: next === 'closed',
    })
    if (!ok) return
    startTransition(async () => {
      await updateElectionStatus(election.id, next)
      setElections(prev => prev.map(e => e.id === election.id ? { ...e, status: next } : e))
    })
  }

  async function handleDelete(id: string) {
    const election = elections.find(e => e.id === id)
    const ok = await confirm({
      title: 'Delete election',
      description: election
        ? `Delete "${election.title}" and all of its nominations and votes? This cannot be undone.`
        : 'Delete this election and all its data? This cannot be undone.',
      confirmLabel: 'Delete election',
      destructive: true,
    })
    if (!ok) return
    startTransition(async () => {
      await deleteElection(id)
      setElections(prev => prev.filter(e => e.id !== id))
    })
  }

  return (
    <div className="space-y-6">
      {!showForm ? (
        <Button size="sm" onClick={() => setShowForm(true)}>
          <Plus className="h-4 w-4 mr-1" /> New Election
        </Button>
      ) : (
        <div className="rounded-xl border bg-card p-5 space-y-5 max-w-xl">
          <h2 className="font-semibold text-sm uppercase tracking-wide text-muted-foreground">New Election</h2>

          <div className="space-y-1.5">
            <Label>Title</Label>
            <Input value={title} onChange={e => setTitle(e.target.value)} placeholder="2026 Officer Elections" />
          </div>
          <div className="space-y-1.5">
            <Label>Description (optional)</Label>
            <Textarea rows={2} value={description} onChange={e => setDescription(e.target.value)} />
          </div>

          {/* Nomination window */}
          <div className={`space-y-2 rounded-lg border p-3 ${ELECTION_WINDOW.nominations.well}`}>
            <p className={`text-xs font-semibold uppercase tracking-wide flex items-center gap-1.5 ${ELECTION_WINDOW.nominations.label}`}>
              <Calendar className="h-3.5 w-3.5" /> Nominations Window
            </p>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div className="space-y-1">
                <Label className="text-xs">Opens</Label>
                <Input type="datetime-local" value={nomOpenAt} onChange={e => setNomOpenAt(e.target.value)} />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Closes</Label>
                <Input type="datetime-local" value={nomCloseAt} onChange={e => setNomCloseAt(e.target.value)} />
              </div>
            </div>
          </div>

          {/* Voting window */}
          <div className={`space-y-2 rounded-lg border p-3 ${ELECTION_WINDOW.voting.well}`}>
            <p className={`text-xs font-semibold uppercase tracking-wide flex items-center gap-1.5 ${ELECTION_WINDOW.voting.label}`}>
              <Calendar className="h-3.5 w-3.5" /> Voting Window
            </p>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div className="space-y-1">
                <Label className="text-xs">Opens</Label>
                <Input type="datetime-local" value={voteOpenAt} onChange={e => setVoteOpenAt(e.target.value)} />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Closes</Label>
                <Input type="datetime-local" value={voteCloseAt} onChange={e => setVoteCloseAt(e.target.value)} />
              </div>
            </div>
          </div>

          <div className="space-y-3">
            <p className="text-sm font-medium">Positions</p>
            {positions.map((pos, i) => (
              <div key={i} className="flex gap-2 items-end">
                <div className="flex-1 space-y-1">
                  <Label className="text-xs">Position {i + 1}</Label>
                  <Select value={pos.title} onChange={e => updatePosition(i, 'title', e.target.value)}>
                    <option value="">— Select position —</option>
                    {roles.map(r => <option key={r} value={r}>{r}</option>)}
                  </Select>
                </div>
                <div className="w-20 space-y-1">
                  <Label className="text-xs">Winners</Label>
                  <Input type="number" min="1" value={pos.max_winners} onChange={e => updatePosition(i, 'max_winners', parseInt(e.target.value) || 1)} />
                </div>
                {positions.length > 1 && (
                  <Button size="sm" variant="ghost" className="text-destructive hover:text-destructive h-8 w-8 p-0" onClick={() => removePosition(i)}>×</Button>
                )}
              </div>
            ))}
            {roles.length === 0 && (
              <p className="text-xs text-muted-foreground">No positions defined yet. Add roles under User Roles first.</p>
            )}
            <Button size="sm" variant="outline" onClick={addPosition}>+ Add Position</Button>
          </div>

          <label className="flex items-center gap-2 text-sm cursor-pointer select-none">
            <input
              type="checkbox"
              checked={announce}
              onChange={e => setAnnounce(e.target.checked)}
              className="h-4 w-4 rounded border-input accent-primary"
            />
            Post an announcement about this election
          </label>

          {error && <p className="text-sm text-destructive">{error}</p>}
          <div className="flex gap-2">
            <Button size="sm" onClick={handleCreate} disabled={isPending}>
              {isPending ? 'Creating…' : 'Create Election'}
            </Button>
            <Button size="sm" variant="ghost" onClick={() => { setShowForm(false); setError('') }}>Cancel</Button>
          </div>
        </div>
      )}

      {elections.length === 0 ? (
        <p className="text-sm text-muted-foreground">No elections yet.</p>
      ) : (
        <ul className="divide-y rounded-xl border overflow-hidden">
          {elections.map(e => {
            const next = STATUS_NEXT[e.status]
            return (
              <li key={e.id} className="px-4 py-3 space-y-1.5">
                <div className="flex items-center gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-medium truncate">{e.title}</p>
                      <span className={`text-xs px-2 py-0.5 rounded-full shrink-0 ${ELECTION_STATUS_PILL[e.status]}`}>
                        {STATUS_LABEL[e.status]}
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    {next && (
                      <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => handleAdvanceStatus(e)}>
                        <PlayCircle className="h-3 w-3 mr-1" /> {STATUS_ACTION[e.status]}
                      </Button>
                    )}
                    <Link href={`/elections/${e.id}`}>
                      <Button size="sm" variant="ghost" className="h-7 w-7 p-0">
                        <ChevronRight className="h-3.5 w-3.5" />
                      </Button>
                    </Link>
                    <Button size="sm" variant="ghost" className="h-7 w-7 p-0 text-destructive hover:text-destructive" onClick={() => handleDelete(e.id)}>
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>

                {/* Date windows */}
                {(e.nominations_open_at || e.voting_open_at) && (
                  <div className="flex flex-wrap gap-x-6 gap-y-0.5 pl-0.5">
                    {e.nominations_open_at && (
                      <p className="text-xs text-muted-foreground">
                        Nominations: {fmtDate(e.nominations_open_at)}
                        {e.nominations_close_at ? ` – ${fmtDate(e.nominations_close_at)}` : ''}
                      </p>
                    )}
                    {e.voting_open_at && (
                      <p className="text-xs text-muted-foreground">
                        Voting: {fmtDate(e.voting_open_at)}
                        {e.voting_close_at ? ` – ${fmtDate(e.voting_close_at)}` : ''}
                      </p>
                    )}
                  </div>
                )}
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
