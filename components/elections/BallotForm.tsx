'use client'

import { useState, useTransition } from 'react'
import { Vote } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useConfirm } from '@/components/ui/confirm'
import { FormError } from '@/components/ui/form-message'
import { NominationBoard } from '@/components/elections/NominationBoard'
import {
  castVote, respondToNomination,
  type Election, type ElectionPosition, type ElectionNomination, type ElectionNominee,
} from '@/app/actions/elections'
import { formatDate } from '@/lib/date-utils'
import { nominationsOpen, votingOpen } from '@/lib/election-phase'

/**
 * The member's ballot.
 *
 * ── IT BRANCHES ON THE DERIVED PHASE, NOT ON A STORED STATUS ────────────────────────
 * `election.phase` is computed on the SERVER from the four window dates
 * (`lib/election-phase.ts`) and passed down. It is not recomputed here, and must not be:
 * reading the clock during render makes a component's output depend on when it happened to
 * render, which `react-hooks/purity` is right to flag and which `lib/date-utils.ts` argues
 * about at length.
 *
 * The cost is a tab left open across a window boundary, which shows the phase it loaded with
 * until it revalidates. That is why the phase is a RENDERING decision and
 * `election_window_open()` in SQL is the boundary: a stale screen can offer a control, and the
 * write behind it is refused all the same.
 *
 * ── WHAT THIS FILE IS, AFTER THE 2026-08-21 REBUILD ────────────────────────────────
 * It is the SHELL: the three things a nominee or a voter is told, and the two panes they act
 * in. The nominations pane moved out to `NominationBoard`, which is organised by office; what
 * stays here is voting, the pending-nomination answers, and the phase banners.
 *
 * Splitting it was not tidying. The nominations half used to be three controls in a column —
 * a self-nomination form with its own position `<select>`, a nominate-somebody-else form with
 * a second one, and a read-only candidate list under both — so choosing an office happened
 * twice and the list of people standing could not be acted on at all. That is now one pane
 * with the office as the heading, and it needs a dialog, its own two error slots and a
 * per-row rule about who may retract what. In one file with the voting pane it read as two
 * screens sharing a `useState`.
 *
 * The NOMINEE PICKER went with it. It is `PersonPicker` — AGENTS.md listed this file by name
 * under "Known gaps" when it was a native `<select>` printing `{first_name} {last_name}`,
 * because two Martha Allens were indistinguishable on a ballot. There is no POSITION picker
 * anywhere any more: which office you are nominating for is which heading you pressed.
 */

interface Props {
  election: Election
  positions: ElectionPosition[]
  nominations: ElectionNomination[]
  myVotes: Record<string, string>
  /** Only the members who may stand in THIS election. See the note above. */
  nominees: ElectionNominee[]
  myPersonId: string | null
  myNominations: ElectionNomination[]
}

export function BallotForm({
  election, positions, nominations, myVotes, nominees, myPersonId, myNominations,
}: Props) {
  const confirm = useConfirm()
  const [votes, setVotes] = useState<Record<string, string>>(myVotes)
  const [error, setError] = useState('')
  const [isPending, startTransition] = useTransition()

  const canNominate = nominationsOpen(election.phase)
  const canVote = votingOpen(election.phase)

  async function handleVote(positionId: string, nomineePersonId: string) {
    if (!canVote) return
    const position = positions.find(p => p.id === positionId)
    const nominee = nominations.find(n => n.position_id === positionId && n.nominee_id === nomineePersonId)
    const alreadyVoted = !!votes[positionId]
    const ok = await confirm({
      title: alreadyVoted ? 'Change your vote' : 'Cast your vote',
      description: `${alreadyVoted ? 'Change your vote' : 'Vote'} for ${nominee?.nominee_name ?? 'this nominee'} as ${position?.title ?? 'this position'}?`,
      confirmLabel: alreadyVoted ? 'Change vote' : 'Cast vote',
    })
    if (!ok) return
    setVotes(prev => ({ ...prev, [positionId]: nomineePersonId }))
    startTransition(async () => {
      const result = await castVote(election.id, positionId, nomineePersonId)
      if (!result.success) {
        setError(result.message ?? 'Vote failed')
        // The optimistic marker is rolled back, because the refusal here is not always
        // transient: the window may have closed since this page was rendered, and leaving the
        // radio filled in would tell a member their vote stands when the database refused it.
        setVotes(prev => {
          const next = { ...prev }
          if (myVotes[positionId]) next[positionId] = myVotes[positionId]
          else delete next[positionId]
          return next
        })
      }
    })
  }

  async function handleRespond(nominationId: string, accepted: boolean) {
    const nomination = myNominations.find(n => n.id === nominationId)
    const position = positions.find(p => p.id === nomination?.position_id)
    const ok = await confirm({
      title: accepted ? 'Accept nomination' : 'Decline nomination',
      description: `${accepted ? 'Accept' : 'Decline'} the nomination for ${position?.title ?? 'this position'}? This cannot be changed.`,
      confirmLabel: accepted ? 'Accept' : 'Decline',
      destructive: !accepted,
    })
    if (!ok) return
    startTransition(async () => {
      const result = await respondToNomination(nominationId, accepted, election.id)
      if (!result.success) setError(result.message ?? 'Could not record your answer.')
    })
  }

  const pendingMyNominations = myNominations.filter(n => n.accepted === null)

  return (
    <div className="space-y-8">
      {/* Pending nomination responses. Shown in every phase: a nominee who was asked while
          nominations were open still has an answer to give after they close, and the policy's
          self-expression is what keeps their own row reachable. */}
      {pendingMyNominations.length > 0 && (
        <div className="rounded-xl border border-brand-legacy/50 bg-brand-soft p-4 space-y-3">
          <p className="text-sm font-medium text-brand-on-soft">You have been nominated!</p>
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

      {/* ── Nominations ───────────────────────────────────────────────────── */}
      {/* ONE PANE, ORGANISED BY OFFICE. What was here — a self-nomination form, a
          nominate-somebody form and a read-only candidate list, each with its own position
          `<select>` — is `NominationBoard`, and the replacement is not a re-skin: the list is
          now the thing you act on, and taking your own name off a nomination is a control on
          the row rather than something no screen offered at all. */}
      {canNominate && (
        <NominationBoard
          election={election}
          positions={positions}
          nominations={nominations}
          nominees={nominees}
          myPersonId={myPersonId}
        />
      )}

      {/* ── Voting ────────────────────────────────────────────────────────── */}
      {canVote && (
        <div className="space-y-6">
          <h2 className="font-semibold flex items-center gap-2">
            <Vote className="h-5 w-5 text-primary" /> Cast Your Vote
          </h2>
          <FormError message={error} />
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

      {/* ── The four phases with nothing to do ────────────────────────────── */}
      {/* Each says what the calendar says, rather than "not available". A member who arrives
          early wants the date, and one who arrives late wants to know they did. */}
      {election.phase === 'scheduled' && (
        <div className="rounded-xl border bg-muted/30 p-4 text-center">
          <p className="text-sm text-muted-foreground">Nominations have not opened yet.</p>
          <p className="text-xs text-muted-foreground mt-1">
            They open {formatDate(election.nominations_open_on)}.
          </p>
        </div>
      )}

      {election.phase === 'between' && (
        <div className="rounded-xl border bg-muted/30 p-4 text-center">
          <p className="text-sm text-muted-foreground">
            Nominations closed on {formatDate(election.nominations_close_on)}.
          </p>
          <p className="text-xs text-muted-foreground mt-1">
            Voting opens {formatDate(election.voting_open_on)}.
          </p>
        </div>
      )}

      {election.phase === 'closed' && (
        <div className="rounded-xl border bg-muted/30 p-4 text-center">
          <p className="text-sm text-muted-foreground">
            Voting closed on {formatDate(election.voting_close_on)}.
          </p>
        </div>
      )}

      {election.phase === 'draft' && (
        <div className="rounded-xl border bg-muted/30 p-4 text-center">
          <p className="text-sm text-muted-foreground">This election has not been published yet.</p>
        </div>
      )}
    </div>
  )
}
