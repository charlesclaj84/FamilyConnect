import { notFound, redirect } from 'next/navigation'
import Link from 'next/link'
import { CalendarCheck, PartyPopper } from 'lucide-react'
import { canAny, requireView } from '@/lib/auth/permissions'
import { getGatheringsReport } from '@/app/actions/activity-reports'
import { cn } from '@/lib/utils'
import { formatDate } from '@/lib/date-utils'
import { GATHERING_STATUS_LABEL } from '@/lib/gatherings'
import { PageShell } from '@/components/layout/PageShell'
import { ReportEmpty, ReportStats } from '@/components/reports/ReportStats'
import { COLLAPSING_CELL, MetaDot, RowMeta } from '@/components/ui/table-collapse'
import { callerI18n } from '@/lib/i18n/server'
import { moneyFor } from '@/lib/currency-utils'
import { getMyFamilyCurrency } from '@/lib/auth/currency'
import { currentUser } from '@/lib/auth/current-user'
import { docTitle } from '@/lib/i18n/page-metadata'

export async function generateMetadata() {
  return docTitle('doc./reporting/gatherings.title')
}

/**
 * Is the work getting done, and is it inside the budget.
 *
 * ── TWO CHECKS, AND THE SECOND IS NOT BELT-AND-BRACES ───────────────────────────────
 * `requireView` is §1's preamble and does three jobs — the removed-family check, the tier gate
 * and the permission gate. But it resolves the permission with `can()`, which is TRUE FOR
 * SCOPE 'own', and there is no own version of a family-wide count. So `canAny` follows it,
 * matching `getGatheringsReport()` exactly. Without it the two disagree and the honest outcome
 * is the bad one: the page opens, the action returns null, and the reader gets an empty screen
 * instead of a 404 and cannot tell whether their family has no gatherings or whether they were
 * refused. `/reporting/dues-projections` set this pattern and it is why `reporting/gatherings`
 * is in `NO_OWNER_KEYS`.
 *
 * ── THE MONEY BAND IS THE ACTION'S DECISION, NOT THIS PAGE'S ────────────────────────
 * `gatherings/budget` is resolved inside `getGatheringsReport`, which nulls the two money
 * columns when the tier or the grant is absent. That is a NARROWING and not a refusal, which
 * is the line AGENTS.md draws for a read action: the rows all still come back. This page
 * renders the columns only when a figure is there to render, so a caller without the band sees
 * a table with two fewer columns rather than two columns of dashes.
 */
export default async function GatheringsReportPage() {
  const { user } = await currentUser()
  if (!user) redirect('/login')

  await requireView(user.id, 'reporting/gatherings')

  const { t, intl } = await callerI18n(user.id)
  // The family's own currency, bound with the reader's conventions. A REPORT prints the
  // family's money, so it must not use `formatPlatformMoney` — see `lib/currency-utils.ts`.
  const money = moneyFor(await getMyFamilyCurrency(user.id), intl)
  if (!(await canAny(user.id, 'reporting/gatherings', 'view'))) notFound()

  const report = await getGatheringsReport()
  // Only reachable if the action refused for a reason the two checks above did not — an
  // outage, in practice. A 404 is the honest answer: this page has nothing to show and saying
  // "no gatherings" would be a claim about the family.
  if (!report) notFound()

  const { totals, rows } = report
  const showMoney = rows.some(r => r.budgetCents !== null || r.allocatedCents !== null)

  return (
    <PageShell className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">{t('page./reporting/gatherings.title')}</h1>
      </div>

      {/* THE EXCLUSION RIDES ON THE FIGURE IT QUALIFIES — see the same note on
          /reporting/elections. Every figure on this screen leaves cancelled gatherings out,
          rows and totals alike, because their open tasks are not work anybody owes; without
          it a family that called one thing off reads as permanently behind. Argued in full in
          `gatherings-report`. */}
      <ReportStats stats={[
        {
          label: 'Gatherings',
          value: totals.gatherings,
          hint: t('rep.gathStillToCome', { n: String(totals.upcoming) }),
        },
        {
          label: t('rep.tasksApproved'),
          value: `${totals.tasks.approved} / ${totals.tasks.total}`,
          hint: t('rep.gathWaitingDecision', {
            n: String(totals.tasks.submitted),
          }),
          tone: 'affirm',
        },
        {
          label: 'Overdue',
          value: totals.overdue,
          hint: 'past its date and not yet approved',
          tone: totals.overdue > 0 ? 'withheld' : 'plain',
        },
        {
          label: t('rep.nobodyHolding'),
          value: totals.unassigned,
          hint: `${totals.helpers} relative${totals.helpers === 1 ? '' : 's'} helping`,
          tone: totals.unassigned > 0 ? 'withheld' : 'plain',
        },
      ]} />

      {rows.length === 0 ? (
        <ReportEmpty
          icon={PartyPopper}
          message="Nothing has been scheduled yet."
          hint={t('rep.gathEmptyHint')}
        />
      ) : (
        <div className="overflow-hidden rounded-xl border">
          <table className="w-full border-collapse text-sm">
            <caption className="sr-only">{t('rep.everyGatheringItsTask')}</caption>
            <thead>
              <tr className="border-b bg-muted/40 text-start text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                <th scope="col" className="px-3 py-2">Gathering</th>
                <th scope="col" className={cn('px-3 py-2', COLLAPSING_CELL)}>Starts</th>
                <th scope="col" className={cn('px-3 py-2', COLLAPSING_CELL)}>
                  {t('col.status')}
                </th>
                <th scope="col" className="px-3 py-2 text-end">Tasks</th>
                <th scope="col" className={cn('px-3 py-2 text-end', COLLAPSING_CELL)}>Overdue</th>
                {showMoney && (
                  <th scope="col" className={cn('px-3 py-2 text-end', COLLAPSING_CELL)}>
                    Allocated
                  </th>
                )}
              </tr>
            </thead>
            <tbody>
              {rows.map(row => (
                <tr key={row.id} className="border-b align-top last:border-0 sm:align-middle">
                  {/* THE SUBJECT CELL CARRIES THE FOLDED COLUMNS, per "On a phone a table
                      narrows". Same cells, hidden by a media query — never a second stacked
                      rendering, which drifts from the first the moment a column is added. */}
                  <td className="px-3 py-2">
                    <Link href={`/gatherings/${row.id}`} className="font-medium text-foreground hover:underline">
                      {row.title}
                    </Link>
                    <RowMeta>
                      <span>{formatDate(row.startsOn, intl)}</span>
                      <MetaDot />
                      <span>{GATHERING_STATUS_LABEL[row.status]}</span>
                      {row.overdue > 0 && (
                        <>
                          <MetaDot />
                          <span className="text-brand-withheld">{row.overdue} overdue</span>
                        </>
                      )}
                      {row.allocatedCents !== null && (
                        <>
                          <MetaDot />
                          <span>{money(row.allocatedCents)} allocated</span>
                        </>
                      )}
                    </RowMeta>
                  </td>
                  <td className={cn('px-3 py-2 tabular-nums', COLLAPSING_CELL)}>
                    {formatDate(row.startsOn, intl)}
                  </td>
                  <td className={cn('px-3 py-2', COLLAPSING_CELL)}>
                    {GATHERING_STATUS_LABEL[row.status]}
                  </td>
                  <td className="px-3 py-2 text-end tabular-nums">
                    {row.tasks.approved} / {row.tasks.total}
                    {row.unassigned > 0 && (
                      <span className="block text-xs text-brand-withheld">
                        {row.unassigned} unheld
                      </span>
                    )}
                  </td>
                  <td className={cn('px-3 py-2 text-end tabular-nums', COLLAPSING_CELL,
                    row.overdue > 0 && 'text-brand-withheld')}>
                    {row.overdue}
                  </td>
                  {showMoney && (
                    <td className={cn('px-3 py-2 text-end tabular-nums', COLLAPSING_CELL)}>
                      {/* BOTH FIGURES OR NEITHER — the action nulls them together. An
                          over-allocated gathering is marked `--brand-withheld` and not
                          `--destructive`: task lines claiming more than the gathering budgeted
                          is a plan to fix, not an error. That is the same reading
                          `lib/gathering-budget.ts` takes, and the DESTRUCTIVE case there is
                          over-FUND, which this report does not compute. */}
                      {row.allocatedCents === null ? '—' : (
                        <>
                          {money(row.allocatedCents)}
                          {row.budgetCents !== null && (
                            <span className={cn('block text-xs',
                              row.allocatedCents > row.budgetCents
                                ? 'text-brand-withheld'
                                : 'text-muted-foreground')}>
                              of {money(row.budgetCents)}
                            </span>
                          )}
                        </>
                      )}
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
        <CalendarCheck className="h-3.5 w-3.5" aria-hidden="true" />{t('rep.taskCountsOverdueWhen')}</p>
    </PageShell>
  )
}
