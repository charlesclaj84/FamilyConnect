import { redirect, notFound } from 'next/navigation'
import Link from 'next/link'
import { ChevronLeft, MapPin } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { requireView } from '@/lib/auth/permissions'
import { getElectionSummary } from '@/app/actions/elections'
import { formatDateRange } from '@/lib/date-utils'
import { ElectionSummary } from '@/components/admin/ElectionSummary'
import { ELECTION_WINDOW } from '@/components/elections/status'
import { PageShell } from '@/components/layout/PageShell'

export const metadata = { title: 'Election' }

/**
 * One election, as the organizer running it needs to see it.
 *
 * ── IT NEEDS NO REGISTRY ROW AND NO MIGRATION ──────────────────────────────────────
 * A `[id]` detail route inherits its parent's key: `requireView('admin/elections')` is the
 * whole gate, and `viewableResources()` builds the rail from `/admin/elections`, which already
 * has a `FEATURES` entry. The same arrangement `/admin/gatherings/[id]` has, and
 * lib/features.ts says so at length beside the Gatherings block — a detail page is not a rail
 * item and must not become one.
 *
 * So this screen costs no `permission_resources` row, and that is right rather than merely
 * cheap: an organizer who may open the console may see what the elections in it are doing. A
 * second key would be a switch that could turn off half of one job.
 *
 * ── `notFound()` COVERS THREE REFUSALS, DELIBERATELY ───────────────────────────────
 * `getElectionSummary` answers null for an election that does not exist, one in another
 * family, and one this caller has no organizer grant for — that last through `requireScope`
 * inside the action, which is the boundary; `requireView` above is the page's own. All three
 * render as 404, which is the same reasoning the member's ballot page and the removed-family
 * doors follow: a stranger is told nothing that distinguishes "not yours" from "not there".
 *
 * ── A DRAFT HAS NO SUMMARY TO SHOW, AND IS NOT REFUSED ─────────────────────────────
 * The ask was for a screen an organizer sees "once an election is published", and a draft
 * genuinely has nothing on it — no nominations, no votes, and windows that govern nothing yet.
 * It still OPENS: the figures are all zero and the phase pill says Draft, which is a truthful
 * answer to "what is this election doing". Refusing would mean an organizer following a link
 * from the list and being told the election does not exist, which is the worse lie.
 */
export default async function AdminElectionDetailPage(
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  await requireView(user.id, 'admin/elections')

  const summary = await getElectionSummary(id)
  if (!summary) notFound()

  const { election } = summary

  return (
    <PageShell className="space-y-6">
      <div>
        <Link
          href="/admin/elections"
          className="mb-4 flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
        >
          <ChevronLeft className="h-3.5 w-3.5" /> Back to Elections
        </Link>
        <h1 className="text-3xl font-bold">{election.title}</h1>
        <p className="mt-2 flex items-center gap-1.5 text-sm text-muted-foreground">
          <MapPin className="h-3.5 w-3.5 shrink-0" /> {election.scope_label}
        </p>
        {election.description && (
          <p className="mt-2 text-muted-foreground">{election.description}</p>
        )}

        {/* The two windows, in the same wells the member's own screen uses — an organizer
            checking on a poll wants the dates in front of the figures, not a click away. */}
        {(election.nominations_open_on || election.voting_open_on) && (
          <div className="mt-4 flex flex-col gap-3 sm:flex-row">
            {election.nominations_open_on && (
              <div className={`flex-1 rounded-lg border px-3 py-2.5 ${ELECTION_WINDOW.nominations.well}`}>
                <p className={`mb-0.5 text-xs font-semibold uppercase tracking-wide ${ELECTION_WINDOW.nominations.label}`}>
                  Nominations
                </p>
                <p className="text-sm">
                  {formatDateRange(election.nominations_open_on, election.nominations_close_on)}
                </p>
              </div>
            )}
            {election.voting_open_on && (
              <div className={`flex-1 rounded-lg border px-3 py-2.5 ${ELECTION_WINDOW.voting.well}`}>
                <p className={`mb-0.5 text-xs font-semibold uppercase tracking-wide ${ELECTION_WINDOW.voting.label}`}>
                  Voting
                </p>
                <p className="text-sm">
                  {formatDateRange(election.voting_open_on, election.voting_close_on)}
                </p>
              </div>
            )}
          </div>
        )}
      </div>

      <ElectionSummary summary={summary} />
    </PageShell>
  )
}
