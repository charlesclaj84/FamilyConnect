'use client'

import { useState, useTransition } from 'react'
import { CheckCircle, Vote, UserPlus, Clock } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { castVote, submitNomination, respondToNomination, type Election, type ElectionPosition, type ElectionNomination } from '@/app/actions/elections'
import type { MemberRecord } from '@/app/actions/members'
import { formatDate } from '@/lib/date-utils'

interface Props {
  election: Election
  positions: ElectionPosition[]
  nominations: ElectionNomination[]
  myVotes: Record<string, string>
  members: MemberRecord[]
  myPersonId: string | null
  myNominations: ElectionNomination[]
}

const fmtDate = (s: string) => formatDate(s) ?? ''

export function BallotForm({ election, positions, nominations, myVotes, members, myPersonId, myNominations }: Props) {
  const [votes, setVotes] = useState<Record<string, string>>(myVotes)
  const [nomineeId, setNomineeId] = useState('')
  const [nominatingPositionId, setNominatingPositionId] = useState('')
  const [selfPositionId, setSelfPositionId] = useState('')
  const [error, setError] = useState('')
  const [isPending, startTransition] = useTransition()

  function handleVote(positionId: string, nomineePersonId: string) {
    if (election.status !== 'voting') return
    setVotes(prev => ({ ...prev, [positionId]: nomineePersonId }))
    startTransition(async () => {
      const result = await castVote(election.id, positionId, nomineePersonId)
      if (!result.success) setError(result.message ?? 'Vote failed')
    })
  }

  function handleNominate() {
    if (!nomineeId || !nominatingPositionId) { setError('Select a position and nominee'); return }
    setError('')
    startTransition(async () => {
      const result = await submitNomination(election.id, nominatingPositionId, nomineeId)
      if (!result.success) setError(result.message ?? 'Failed')
      else { setNomineeId(''); setNominatingPositionId('') }
    })
  }

  function handleSelfNominate() {
    if (!myPersonId || !selfPositionId) { setError('Select a position'); return }
    setError('')
    startTransition(async () => {
      const result = await submitNomination(election.id, selfPositionId, myPersonId)
      if (!result.success) setError(result.message ?? 'Failed')
      else setSelfPositionId('')
    })
  }

  function handleRespond(nominationId: string, accepted: boolean) {
    startTransition(async () => {
      await respondToNomination(nominationId, accepted, election.id)
    })
  }

  const pendingMyNominations = myNominations.filter(n => n.accepted === null)
  const myNominatedPositionIds = new Set(myNominations.map(n => n.position_id))
  const unNominatedPositions = positions.filter(p => !myNominatedPositionIds.has(p.id))

  return (
    <div className="space-y-8">
      {/* Pending nomination responses */}
      {pendingMyNominations.length > 0 && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 space-y-3">
          <p className="text-sm font-medium text-amber-900">You have been nominated!</p>
          {pendingMyNominations.map(nom => {
            const pos = positions.find(p => p.id === nom.position_id)
            return (
              <div key={nom.id} className="flex items-center gap-3">
                <p className="flex-1 text-sm">{pos?.title ?? 'Position'}</p>
                <Button size="sm" onClick={() => handleRespond(nom.id, true)}>Accept</Button>
                <Button size="sm" variant="outline" onClick={() => handleRespond(nom.id, false)}>Decline</Button>
              </div>
            )
          })}
        </div>
      )}

      {/* Nominations phase */}
      {election.status === 'nominations' && (
        <div className="space-y-6">
          {/* Self-nominate */}
          {myPersonId && unNominatedPositions.length > 0 && (
            <div className="rounded-xl border border-primary/20 bg-primary/5 p-4 space-y-3">
              <div className="flex items-center gap-2">
                <UserPlus className="h-4 w-4 text-primary" />
                <p className="text-sm font-semibold">Put Yourself on the Ballot</p>
              </div>
              <div className="flex flex-col sm:flex-row gap-2">
                <select
                  value={selfPositionId}
                  onChange={e => setSelfPositionId(e.target.value)}
                  className="h-9 rounded-lg border border-input bg-background px-2.5 py-1 text-sm flex-1"
                >
                  <option value="">— Select position —</option>
                  {unNominatedPositions.map(p => <option key={p.id} value={p.id}>{p.title}</option>)}
                </select>
                <Button size="sm" onClick={handleSelfNominate} disabled={isPending || !selfPositionId}>
                  Nominate Myself
                </Button>
              </div>
              {myNominations.length > 0 && (
                <p className="text-xs text-primary">
                  Already nominated for: {myNominations.map(n => positions.find(p => p.id === n.position_id)?.title).filter(Boolean).join(', ')}
                </p>
              )}
            </div>
          )}

          {/* Nominate someone else */}
          <div className="space-y-3">
            <h2 className="font-semibold text-sm">Nominate Someone Else</h2>
            <div className="flex flex-col sm:flex-row gap-3">
              <select
                value={nominatingPositionId}
                onChange={e => setNominatingPositionId(e.target.value)}
                className="h-9 rounded-lg border border-input bg-background px-2.5 py-1 text-sm flex-1"
              >
                <option value="">— Select position —</option>
                {positions.map(p => <option key={p.id} value={p.id}>{p.title}</option>)}
              </select>
              <select
                value={nomineeId}
                onChange={e => setNomineeId(e.target.value)}
                className="h-9 rounded-lg border border-input bg-background px-2.5 py-1 text-sm flex-1"
              >
                <option value="">— Select nominee —</option>
                {members.map(m => <option key={m.id} value={m.id}>{m.first_name} {m.last_name}</option>)}
              </select>
              <Button size="sm" onClick={handleNominate} disabled={isPending}>Submit</Button>
            </div>
          </div>

          {error && <p className="text-sm text-destructive">{error}</p>}

          {/* Current candidates per position (accepted + pending acceptance) */}
          <div className="space-y-4">
            <h3 className="text-sm font-medium text-muted-foreground">Current Candidates</h3>
            {positions.map(pos => {
              const posNoms = nominations.filter(n => n.position_id === pos.id && n.accepted !== false)
              return (
                <div key={pos.id} className="space-y-1.5">
                  <p className="text-sm font-medium">{pos.title}</p>
                  {posNoms.length === 0 ? (
                    <p className="text-xs text-muted-foreground pl-2">No nominations yet.</p>
                  ) : (
                    <ul className="space-y-1 pl-2">
                      {posNoms.map(n => (
                        <li key={n.id} className="text-sm text-muted-foreground flex items-center gap-1.5">
                          {n.accepted === true
                            ? <CheckCircle className="h-3.5 w-3.5 text-green-500 shrink-0" />
                            : <Clock className="h-3.5 w-3.5 text-amber-500 shrink-0" />}
                          {n.nominee_name}
                          {n.accepted === null && <span className="text-xs text-amber-600">(pending acceptance)</span>}
                          {n.accepted === false && <span className="text-xs text-muted-foreground">(declined)</span>}
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Voting phase */}
      {election.status === 'voting' && (
        <div className="space-y-6">
          <h2 className="font-semibold flex items-center gap-2">
            <Vote className="h-5 w-5 text-primary" /> Cast Your Vote
          </h2>
          {error && <p className="text-sm text-destructive">{error}</p>}
          {positions.map(pos => {
            const posNoms = nominations.filter(n => n.position_id === pos.id && n.accepted === true)
            const myVote = votes[pos.id]
            return (
              <div key={pos.id} className="space-y-3">
                <h3 className="font-medium">{pos.title}</h3>
                {posNoms.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No candidates for this position.</p>
                ) : (
                  <div className="space-y-2">
                    {posNoms.map(nom => (
                      <button
                        key={nom.id}
                        onClick={() => handleVote(pos.id, nom.nominee_id)}
                        disabled={isPending}
                        className={`w-full flex items-center gap-3 rounded-lg border px-4 py-3 text-left transition-colors ${myVote === nom.nominee_id ? 'border-primary bg-primary/5' : 'hover:bg-muted/50'}`}
                      >
                        <div className={`h-4 w-4 rounded-full border-2 flex items-center justify-center ${myVote === nom.nominee_id ? 'border-primary' : 'border-muted-foreground/40'}`}>
                          {myVote === nom.nominee_id && <div className="h-2 w-2 rounded-full bg-primary" />}
                        </div>
                        <span className="text-sm font-medium">{nom.nominee_name}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      {election.status === 'closed' && (
        <div className="rounded-xl border bg-muted/30 p-4 text-center">
          <p className="text-sm text-muted-foreground">This election is closed. Results are shown below.</p>
        </div>
      )}

      {election.status === 'draft' && (
        <div className="rounded-xl border bg-muted/30 p-4 text-center">
          <p className="text-sm text-muted-foreground">This election has not opened for nominations yet.</p>
          {election.nominations_open_at && (
            <p className="text-xs text-muted-foreground mt-1">
              Nominations open {fmtDate(election.nominations_open_at)}.
            </p>
          )}
        </div>
      )}
    </div>
  )
}
