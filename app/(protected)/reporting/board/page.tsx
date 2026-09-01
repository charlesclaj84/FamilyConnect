import { notFound, redirect } from 'next/navigation'
import { ShieldCheck } from 'lucide-react'
import { canAny, requireView } from '@/lib/auth/permissions'
import { getBoardReport } from '@/app/actions/activity-reports'
import { cn } from '@/lib/utils'
import { positionCategoryLabel } from '@/lib/board-positions'
import { PageShell } from '@/components/layout/PageShell'
import { ReportEmpty, ReportStats } from '@/components/reports/ReportStats'
import { COLLAPSING_CELL, MetaDot, RowMeta } from '@/components/ui/table-collapse'
import { callerI18n } from '@/lib/i18n/server'
import { currentUser } from '@/lib/auth/current-user'
import { docTitle } from '@/lib/i18n/page-metadata'

export async function generateMetadata() {
  return docTitle('doc./reporting/board.title')
}

/**
 * Who holds which office, and — the question nothing else in the product answers — which
 * offices nobody holds.
 *
 * ── IT IS NOT `/admin/members/organization` WITH A DIFFERENT LAYOUT ─────────────────
 * That pane is where a family DEFINES its positions and hands them out, gated on
 * `admin/members/board-positions`, which is an administrator's grant. This is a READING, on
 * its own key, so a chair or a nominations committee can see where the gaps are without being
 * given the power to change the roster. AGENTS.md's test for whether two things are one key —
 * "could a family sensibly hold one and not the other" — answers plainly yes here.
 *
 * ── TWO CHECKS, FOR `/reporting/gatherings`' REASON ─────────────────────────────────
 * `requireView` resolves with `can()`, true for scope 'own'; `canAny` follows it so the page
 * and the action agree.
 *
 * ── A VACANCY IS THE FINDING, SO EVERY POSITION IS A ROW ────────────────────────────
 * Including the empty ones, and `vacant` is a headline figure. A report that listed only
 * filled offices would be a report that cannot state its most useful fact.
 */
export default async function BoardReportPage() {
  const { user } = await currentUser()
  if (!user) redirect('/login')

  await requireView(user.id, 'reporting/board')

  const { t } = await callerI18n(user.id)
  if (!(await canAny(user.id, 'reporting/board', 'view'))) notFound()

  const report = await getBoardReport()
  if (!report) notFound()

  const { totals, rows, multiHolders } = report

  return (
    <PageShell className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold">{t('page./reporting/board.title')}</h1>
      </div>

      <ReportStats stats={[
        {
          label: t('rep.offices'),
          value: totals.positions,
          hint: t(totals.assignments === 1
            ? 'rep.heldInTotalOne'
            : 'rep.heldInTotalMany', { n: String(totals.assignments) }),
        },
        {
          label: t('rep.filled'),
          value: totals.filled,
          hint: `${totals.officers} relative${totals.officers === 1 ? '' : 's'} in office`,
          tone: 'affirm',
        },
        {
          label: 'Vacant',
          value: totals.vacant,
          hint: 'nobody holds this office',
          tone: totals.vacant > 0 ? 'withheld' : 'plain',
        },
        {
          label: t('rep.wearingTwoHats'),
          value: multiHolders.length,
          hint: 'holding more than one office',
          tone: multiHolders.length > 0 ? 'withheld' : 'plain',
        },
      ]} />

      {rows.length === 0 ? (
        <ReportEmpty
          icon={ShieldCheck}
          message="This family has not set up any board positions."
          hint={t('rep.boardEmptyHint')}
        />
      ) : (
        <>
          <section className="space-y-2">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">{t('rep.everyOffice')}</h2>
            {/* THE ORDER IS THE FAMILY'S OWN `sort_order`, not vacancies first. An
                administrator reading this is matching it against the board list they already
                know; re-ordering by finding would make the two impossible to read side by
                side. The COLOUR is what makes a vacancy findable. */}
            <div className="overflow-hidden rounded-xl border">
              <table className="w-full border-collapse text-sm">
                <caption className="sr-only">{t('rep.everyBoardPositionFamily')}</caption>
                <thead>
                  <tr className="border-b bg-muted/40 text-start text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    <th scope="col" className="px-3 py-2">Office</th>
                    <th scope="col" className={cn('px-3 py-2', COLLAPSING_CELL)}>Level</th>
                    <th scope="col" className={cn('px-3 py-2', COLLAPSING_CELL)}>Kind</th>
                    <th scope="col" className="px-3 py-2">{t('rep.held')}</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map(row => (
                    <tr key={row.positionId}
                      className="border-b align-top last:border-0 sm:align-middle">
                      <td className="px-3 py-2 font-medium">
                        {row.name}
                        <RowMeta>
                          <span>{row.scopeLabel}</span>
                          <MetaDot />
                          <span>{positionCategoryLabel(t, row.category)}</span>
                        </RowMeta>
                      </td>
                      <td className={cn('px-3 py-2', COLLAPSING_CELL)}>{row.scopeLabel}</td>
                      <td className={cn('px-3 py-2', COLLAPSING_CELL)}>
                        {positionCategoryLabel(t, row.category)}
                      </td>
                      <td className="px-3 py-2">
                        {row.holders.length === 0 ? (
                          <span className="text-brand-withheld">Vacant</span>
                        ) : (
                          <ul className="space-y-0.5">
                            {row.holders.map(holder => (
                              <li key={`${holder.personId}:${holder.areaName ?? ''}`}>
                                {holder.name}
                                {holder.areaName && (
                                  <span className="text-muted-foreground"> · {holder.areaName}</span>
                                )}
                              </li>
                            ))}
                          </ul>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          {/* ONLY WHEN THERE IS ONE. A heading over an empty list reads as a control that is
              broken rather than as a finding the family does not have. */}
          {multiHolders.length > 0 && (
            <section className="space-y-2">
              <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">{t('rep.holdingMoreThanOne')}</h2>
              <ul className="divide-y rounded-xl border">
                {multiHolders.map(person => (
                  <li key={person.personId} className="px-3 py-2">
                    <span className="font-medium">{person.name}</span>
                    <span className="ms-2 text-sm text-muted-foreground">
                      {person.offices.join(' · ')}
                    </span>
                  </li>
                ))}
              </ul>
              <p className="text-xs text-muted-foreground">{t('rep.notProblemItselfSmall')}</p>
            </section>
          )}
        </>
      )}
    </PageShell>
  )
}
