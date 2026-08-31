import { notFound, redirect } from 'next/navigation'
import Link from 'next/link'
import { Vote } from 'lucide-react'
import { canAny, requireView } from '@/lib/auth/permissions'
import { getElectionsReport } from '@/app/actions/activity-reports'
import { cn } from '@/lib/utils'
import { PageShell } from '@/components/layout/PageShell'
import { ReportEmpty, ReportStats } from '@/components/reports/ReportStats'
import { COLLAPSING_CELL, MetaDot, RowMeta } from '@/components/ui/table-collapse'
import { callerI18n } from '@/lib/i18n/server'
import { currentUser } from '@/lib/auth/current-user'
import { docTitle } from '@/lib/i18n/page-metadata'

export async function generateMetadata() {
  return docTitle('doc./reporting/elections.title')
}

/**
 * Did anybody stand, and did anybody vote.
 *
 * ── TWO CHECKS, FOR `/reporting/gatherings`' REASON ─────────────────────────────────
 * `requireView` resolves with `can()`, which is true for scope 'own', and there is no own
 * version of a family-wide turnout. `canAny` follows it so the page and the action agree; see
 * that page's header for the whole argument, and `NO_OWNER_KEYS` for the list.
 *
 * ── ONLY PUBLISHED ELECTIONS ────────────────────────────────────────────────────────
 * The action filters them; the copy says so. A draft has no dates, no ballot and no
 * electorate, so a 0% turnout row for one would be a report about an election nobody has been
 * told about.
 */
export default async function ElectionsReportPage() {
  const { user } = await currentUser()
  if (!user) redirect('/login')

  await requireView(user.id, 'reporting/elections')

  const { t } = await callerI18n(user.id)
  if (!(await canAny(user.id, 'reporting/elections', 'view'))) notFound()

  const report = await getElectionsReport()
  if (!report) notFound()

  const { totals, rows } = report
  const uncontested = rows.reduce((sum, r) => sum + r.uncontested, 0)

  return (
    <PageShell className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">{t('page./reporting/elections.title')}</h1>
      </div>

      {/* THE EXCLUSION RIDES ON THE FIGURE IT QUALIFIES. It was the second sentence of a lede
          above the heading until 2026-08-25; a reader who does not know that drafts are left
          out reads this count as "every election we have", and the place that misreading
          happens is at the number rather than four lines above it. The full argument — an
          election nobody has been told about has no electorate — is in `elections-report`. */}
      <ReportStats stats={[
        {
          label: 'Elections',
          value: totals.elections,
          hint: t('rep.elecOpenNow', { n: String(totals.open) }),
        },
        {
          label: t('rep.elecNominations'),
          value: totals.nominations,
          hint: t('rep.elecAcrossEvery'),
        },
        {
          label: t('rep.officesNobodyStood'),
          value: uncontested,
          hint: 'nothing on the ballot',
          tone: uncontested > 0 ? 'withheld' : 'plain',
        },
        {
          label: t('rep.membersWhoVoted'),
          value: totals.voters,
          hint: 'distinct people, not ballots',
          tone: 'affirm',
        },
      ]} />

      {rows.length === 0 ? (
        <ReportEmpty
          icon={Vote}
          message={t('rep.elecEmptyMessage')}
          hint={t('rep.elecEmptyHint')}
        />
      ) : (
        <div className="overflow-hidden rounded-xl border">
          <table className="w-full border-collapse text-sm">
            <caption className="sr-only">{t('rep.everyPublishedElectionIts')}</caption>
            <thead>
              <tr className="border-b bg-muted/40 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                <th scope="col" className="px-3 py-2">Election</th>
                <th scope="col" className={cn('px-3 py-2', COLLAPSING_CELL)}>Area</th>
                <th scope="col" className={cn('px-3 py-2', COLLAPSING_CELL)}>Phase</th>
                <th scope="col" className={cn('px-3 py-2 text-right', COLLAPSING_CELL)}>
                  Nominations
                </th>
                <th scope="col" className="px-3 py-2 text-right">Turnout</th>
              </tr>
            </thead>
            <tbody>
              {rows.map(row => (
                <tr key={row.id} className="border-b align-top last:border-0 sm:align-middle">
                  <td className="px-3 py-2">
                    <Link href={`/community/elections/${row.id}`}
                      className="font-medium text-foreground hover:underline">
                      {row.title}
                    </Link>
                    <RowMeta>
                      <span>{row.scopeLabel}</span>
                      <MetaDot />
                      <span>{row.phase}</span>
                      <MetaDot />
                      <span>
                        {t('rep.elecAcceptedOf', {
                          accepted: String(row.accepted),
                          total: String(row.nominations),
                        })}
                      </span>
                      {row.uncontested > 0 && (
                        <>
                          <MetaDot />
                          <span className="text-brand-withheld">
                            {t('rep.elecNobodyStanding', {
                              n: String(row.uncontested),
                            })}
                          </span>
                        </>
                      )}
                    </RowMeta>
                  </td>
                  <td className={cn('px-3 py-2', COLLAPSING_CELL)}>{row.scopeLabel}</td>
                  <td className={cn('px-3 py-2', COLLAPSING_CELL)}>{row.phase}</td>
                  <td className={cn('px-3 py-2 text-right tabular-nums', COLLAPSING_CELL)}>
                    {row.accepted} / {row.nominations}
                    {row.uncontested > 0 && (
                      <span className="block text-xs text-brand-withheld">
                        {t(row.uncontested === 1
                          ? 'rep.elecUnopposedOne'
                          : 'rep.elecUnopposedMany', { n: String(row.uncontested) })}
                      </span>
                    )}
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums">
                    {/* NULL IS NOT ZERO. `turnout` answers null when nobody is eligible — a
                        chapter election in a chapter with no approved members has no turnout,
                        and "0%" would read as an election everybody ignored. */}
                    {row.turnoutPct === null ? (
                      <span className="text-muted-foreground">n/a</span>
                    ) : (
                      <>
                        {row.turnoutPct}%
                        <span className="block text-xs text-muted-foreground">
                          {row.voted} of {row.eligible}
                        </span>
                      </>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <p className="text-xs text-muted-foreground">
        {t('rep.turnoutCountsPeopleNot')}<strong>n/a</strong>
        {t('rep.elecNotApplicableNote')}
      </p>
    </PageShell>
  )
}
