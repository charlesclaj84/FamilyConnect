import { redirect, notFound } from 'next/navigation'
import Link from 'next/link'
import { ChevronLeft, Trophy } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { getMyPersonId } from '@/lib/auth/family'
import { requireView } from '@/lib/auth/permissions'
import { getElectionDetail, getElectionResults } from '@/app/actions/elections'
import { getMembers } from '@/app/actions/members'
import { formatDate } from '@/lib/date-utils'
import { BallotForm } from '@/components/elections/BallotForm'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

export const metadata = { title: 'Election' }

export default async function ElectionDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  await requireView(user.id, 'elections')

  // The caller's people.id in the family they are currently viewing. A user_id
  // lookup would match one row per membership and fail for multi-family members.
  const myPersonId = await getMyPersonId(user.id)

  const [{ election, positions, nominations, myVotes }, members, results] = await Promise.all([
    getElectionDetail(id),
    getMembers(),
    getElectionResults(id),
  ])

  if (!election) notFound()

  const myNominations = myPersonId
    ? nominations.filter(n => n.nominee_id === myPersonId)
    : []

  const STATUS_LABEL: Record<string, string> = {
    draft: 'Draft', nominations: 'Nominations Open', voting: 'Voting Open', closed: 'Closed',
  }

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 py-10 space-y-8">
      <div>
        <Link href="/elections" className="text-sm text-muted-foreground hover:text-foreground flex items-center gap-1 mb-4">
          <ChevronLeft className="h-3.5 w-3.5" /> Back to Elections
        </Link>
        <div className="flex items-start justify-between gap-4">
          <h1 className="text-3xl font-bold">{election.title}</h1>
          <span className="text-xs bg-muted text-muted-foreground px-2.5 py-1 rounded-full shrink-0">
            {STATUS_LABEL[election.status]}
          </span>
        </div>
        {election.description && <p className="text-muted-foreground mt-2">{election.description}</p>}

        {/* Date windows */}
        {(election.nominations_open_at || election.voting_open_at) && (
          <div className="flex flex-col sm:flex-row gap-3 mt-4">
            {election.nominations_open_at && (
              <div className="flex-1 rounded-lg border bg-amber-50/50 px-3 py-2.5">
                <p className="text-xs font-semibold text-amber-700 uppercase tracking-wide mb-0.5">Nominations</p>
                <p className="text-sm">
                  {formatDate(election.nominations_open_at)}
                  {election.nominations_close_at && ` – ${formatDate(election.nominations_close_at)}`}
                </p>
              </div>
            )}
            {election.voting_open_at && (
              <div className="flex-1 rounded-lg border bg-green-50/50 px-3 py-2.5">
                <p className="text-xs font-semibold text-green-700 uppercase tracking-wide mb-0.5">Voting</p>
                <p className="text-sm">
                  {formatDate(election.voting_open_at)}
                  {election.voting_close_at && ` – ${formatDate(election.voting_close_at)}`}
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
        members={members}
        myPersonId={myPersonId || null}
        myNominations={myNominations}
      />

      {/* Results — shown when closed (admins see vote counts) */}
      {election.status === 'closed' && results.length > 0 && (
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
                    <p className="text-sm text-muted-foreground">No votes cast.</p>
                  ) : (
                    <ul className="space-y-2">
                      {posResults.slice(0, pos.max_winners).map((r, i) => (
                        <li key={r.nominee_id} className="flex items-center gap-2">
                          {i === 0 && <Trophy className="h-4 w-4 text-amber-500 shrink-0" />}
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
    </div>
  )
}
