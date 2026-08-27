import { redirect } from 'next/navigation'
import Link from 'next/link'
import { requireView } from '@/lib/auth/permissions'
import { getElectionsForMember } from '@/app/actions/elections'
import { ChevronRight, Vote } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { ELECTION_PHASE_PILL } from '@/components/elections/status'
import { ELECTION_PHASE_LABEL, electionIsCurrent } from '@/lib/election-phase'
import { formatDateRange } from '@/lib/date-utils'
import { PageShell } from '@/components/layout/PageShell'
import { callerI18n } from '@/lib/i18n/server'
import { currentUser } from '@/lib/auth/current-user'

export const metadata = { title: 'Elections' }

/**
 * The member's own list.
 *
 * ── THIS IS A COMMUNITY SCREEN, AND THE KEY SAYS SO ────────────────────────────────
 * It was `/review/elections` for one day. The route and the key moved together on
 * 2026-08-21 (`20260821000003`), because a resource key IS the route without its leading
 * slash (AGENTS.md §1) — so a rail item changing section is a migration, not a rename. The
 * organizer's half went the other way, to `/admin/elections`; running an election and voting
 * in one are two jobs a family delegates separately and they stay two keys.
 *
 * ── TWO THINGS CHANGED HERE ON 2026-08-21 ──────────────────────────────────────────
 * The list is `getElectionsForMember()` rather than `getAllElections()`, which is two
 * narrowings in one: it drops elections addressed to a different part of the family, and it
 * drops DRAFTS. The old page filed drafts under a heading called "Past & Draft" and showed
 * every one of them to every member — an organizer's half-written ballot, published by a
 * heading that admitted it.
 *
 * And the sections split on the derived PHASE rather than on a stored status word. "Active"
 * is `electionIsCurrent`, which includes an election that has not opened yet and one sitting
 * between its two windows: a member wants to see a ballot coming, and one that vanished for
 * the days between nominations and voting and came back would read as a bug.
 */
export default async function ElectionsPage() {
  const { user } = await currentUser()
  if (!user) redirect('/login')

  await requireView(user.id, 'community/elections')

  const { t } = await callerI18n(user.id)

  const elections = await getElectionsForMember()
  const active = elections.filter(e => electionIsCurrent(e.phase))
  const past = elections.filter(e => !electionIsCurrent(e.phase))

  return (
    <PageShell>
      <div className="mb-8">
        <h1 className="text-3xl font-bold">{t('page./community/elections.title')}</h1>
      </div>

      {elections.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <Vote className="mx-auto h-10 w-10 text-muted-foreground/30 mb-3" />
            <p className="text-sm text-muted-foreground">{t('comm.noElectionsPartFamily')}</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-6">
          {active.length > 0 && (
            <section>
              <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground mb-3">Active</h2>
              <div className="space-y-3">
                {active.map(e => (
                  <Link key={e.id} href={`/community/elections/${e.id}`}>
                    <div className="flex items-center gap-4 rounded-xl border bg-card px-4 py-4 hover:shadow-sm transition-shadow cursor-pointer">
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-sm">{e.title}</p>
                        {/* The level, always. A member of a family with chapters needs to know
                            whether a ballot is theirs or the whole family's, and "National"
                            is as much of an answer as a chapter name. */}
                        <p className="text-xs text-muted-foreground mt-0.5">
                          {e.scope_label}
                          {e.phase === 'nominations' && e.nominations_close_on
                            && ` · nominations ${formatDateRange(e.nominations_open_on, e.nominations_close_on)}`}
                          {e.phase === 'voting' && e.voting_close_on
                            && ` · voting ${formatDateRange(e.voting_open_on, e.voting_close_on)}`}
                        </p>
                        {e.description && <p className="text-xs text-muted-foreground mt-0.5 truncate">{e.description}</p>}
                      </div>
                      <span className={`text-xs px-2.5 py-1 rounded-full shrink-0 ${ELECTION_PHASE_PILL[e.phase]}`}>
                        {ELECTION_PHASE_LABEL[e.phase]}
                      </span>
                      <ChevronRight className="h-4 w-4 text-muted-foreground/40 shrink-0" />
                    </div>
                  </Link>
                ))}
              </div>
            </section>
          )}

          {past.length > 0 && (
            <section>
              <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground mb-3">Past</h2>
              <div className="space-y-3">
                {past.map(e => (
                  <Link key={e.id} href={`/community/elections/${e.id}`}>
                    <div className="flex items-center gap-4 rounded-xl border bg-card px-4 py-3 hover:shadow-sm transition-shadow cursor-pointer opacity-70">
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-sm">{e.title}</p>
                        <p className="text-xs text-muted-foreground mt-0.5">{e.scope_label}</p>
                      </div>
                      <span className={`text-xs px-2.5 py-1 rounded-full shrink-0 ${ELECTION_PHASE_PILL[e.phase]}`}>
                        {ELECTION_PHASE_LABEL[e.phase]}
                      </span>
                      <ChevronRight className="h-4 w-4 text-muted-foreground/40 shrink-0" />
                    </div>
                  </Link>
                ))}
              </div>
            </section>
          )}
        </div>
      )}
    </PageShell>
  )
}
