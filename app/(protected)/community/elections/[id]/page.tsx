import { redirect, notFound } from 'next/navigation'
import Link from 'next/link'
import { ChevronLeft, MapPin, Trophy } from 'lucide-react'
import { getMyPersonId } from '@/lib/auth/family'
import { requireView } from '@/lib/auth/permissions'
import {
  getElectionDetail, getElectionNomineeOptions, getElectionResults,
} from '@/app/actions/elections'
import { formatDateRange } from '@/lib/date-utils'
import { electionIsClosed } from '@/lib/election-phase'
import { BallotForm } from '@/components/elections/BallotForm'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { ELECTION_PHASE_PILL, ELECTION_WINDOW } from '@/components/elections/status'
import { ELECTION_PHASE_LABEL } from '@/lib/election-phase'
import { PageShell } from '@/components/layout/PageShell'
import { currentUser } from '@/lib/auth/current-user'
import { callerI18n } from '@/lib/i18n/server'

export const metadata = { title: 'Election' }

/**
 * One election.
 *
 * ── `notFound()` COVERS THREE DIFFERENT REFUSALS, AND THAT IS DELIBERATE ───────────
 * `getElectionDetail` answers null for an election that does not exist, one in another
 * family, one addressed to a different part of THIS family, and one still in draft. All four
 * render as 404, which is right: telling a member of the Georgia chapter that the Austin
 * chapter is holding an election they may not see is an enumeration signal, and it is the same
 * reasoning the removed-family doors follow — a stranger is told nothing that distinguishes
 * "not yours" from "not there".
 *
 * ── THE NOMINEE LIST IS FETCHED, NOT FILTERED (§5) ─────────────────────────────────
 * This page used to call `getMembers()` — the whole family roster — and hand it to a `<select>`
 * that the nomination policy would then refuse for anybody outside the area. The roster reached
 * the browser in the RSC payload whether the control rendered it or not. It is
 * `getElectionNomineeOptions(id)` now, which returns exactly the people who can be nominated
 * in THIS election.
 */
export default async function ElectionDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const { user } = await currentUser()
  const { t } = await callerI18n(user?.id ?? null)
  if (!user) redirect('/login')

  await requireView(user.id, 'community/elections')

  // The caller's people.id in the family they are currently viewing. A user_id
  // lookup would match one row per membership and fail for multi-family members.
  const myPersonId = await getMyPersonId(user.id)

  const [{ election, positions, nominations, myVotes }, nominees, results] = await Promise.all([
    getElectionDetail(id),
    getElectionNomineeOptions(id),
    getElectionResults(id),
  ])

  if (!election) notFound()

  const myNominations = myPersonId
    ? nominations.filter(n => n.nominee_id === myPersonId)
    : []

  return (
    <PageShell width="reading" className="space-y-8">
      <div>
        <Link href="/community/elections" className="text-sm text-muted-foreground hover:text-foreground flex items-center gap-1 mb-4">
          <ChevronLeft className="h-3.5 w-3.5" />{t('comm.backElections')}</Link>
        <div className="flex items-start justify-between gap-4">
          <h1 className="text-3xl font-bold">{election.title}</h1>
          <span className={`text-xs px-2.5 py-1 rounded-full shrink-0 ${ELECTION_PHASE_PILL[election.phase]}`}>
            {ELECTION_PHASE_LABEL[election.phase]}
          </span>
        </div>
        <p className="text-sm text-muted-foreground mt-2 flex items-center gap-1.5">
          <MapPin className="h-3.5 w-3.5 shrink-0" /> {election.scope_label}
        </p>
        {election.description && <p className="text-muted-foreground mt-2">{election.description}</p>}

        {/* The two windows. Both dates count — the close date is the last day anybody may
            act, which is what `formatDateRange` reads as and what electionPhase computes. */}
        {(election.nominations_open_on || election.voting_open_on) && (
          <div className="flex flex-col sm:flex-row gap-3 mt-4">
            {election.nominations_open_on && (
              <div className={`flex-1 rounded-lg border px-3 py-2.5 ${ELECTION_WINDOW.nominations.well}`}>
                <p className={`text-xs font-semibold uppercase tracking-wide mb-0.5 ${ELECTION_WINDOW.nominations.label}`}>Nominations</p>
                <p className="text-sm">
                  {formatDateRange(election.nominations_open_on, election.nominations_close_on)}
                </p>
              </div>
            )}
            {election.voting_open_on && (
              <div className={`flex-1 rounded-lg border px-3 py-2.5 ${ELECTION_WINDOW.voting.well}`}>
                <p className={`text-xs font-semibold uppercase tracking-wide mb-0.5 ${ELECTION_WINDOW.voting.label}`}>Voting</p>
                <p className="text-sm">
                  {formatDateRange(election.voting_open_on, election.voting_close_on)}
                </p>
              </div>
            )}
          </div>
        )}
      </div>

      <BallotForm
        election={election}
        positions={positions}
        nominations={nominations}
        myVotes={myVotes}
        nominees={nominees}
        myPersonId={myPersonId || null}
        myNominations={myNominations}
      />

      {/* Results — shown once the voting window has closed. */}
      {electionIsClosed(election.phase) && results.length > 0 && (
        <div className="space-y-4">
          <h2 className="font-semibold flex items-center gap-2">
            <Trophy className="h-5 w-5 text-primary" /> Results
          </h2>
          {positions.map(pos => {
            const posResults = results
              .filter(r => r.position_id === pos.id)
              .sort((a, b) => b.vote_count - a.vote_count)
            return (
              <Card key={pos.id}>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm">{pos.title}</CardTitle>
                </CardHeader>
                <CardContent>
                  {posResults.length === 0 ? (
                    <p className="text-sm text-muted-foreground">{t('comm.noVotesCast')}</p>
                  ) : (
                    <ul className="space-y-2">
                      {posResults.slice(0, pos.max_winners).map((r, i) => (
                        <li key={r.nominee_id} className="flex items-center gap-2">
                          {i === 0 && <Trophy className="h-4 w-4 text-brand-accent shrink-0" />}
                          <span className={`text-sm ${i === 0 ? 'font-semibold' : ''}`}>{r.nominee_name}</span>
                          <span className="text-xs text-muted-foreground ml-auto">{r.vote_count} vote{r.vote_count !== 1 ? 's' : ''}</span>
                        </li>
                      ))}
                    </ul>
                  )}
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}
    </PageShell>
  )
}
