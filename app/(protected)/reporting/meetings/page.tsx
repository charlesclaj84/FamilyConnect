import { notFound, redirect } from 'next/navigation'
import Link from 'next/link'
import { Gavel } from 'lucide-react'
import { canAny, requireView } from '@/lib/auth/permissions'
import { getMeetingsReport } from '@/app/actions/activity-reports'
import { cn } from '@/lib/utils'
import { formatDate } from '@/lib/date-utils'
import { PageShell } from '@/components/layout/PageShell'
import { ReportEmpty, ReportStats } from '@/components/reports/ReportStats'
import { COLLAPSING_CELL, MetaDot, RowMeta } from '@/components/ui/table-collapse'
import { callerI18n } from '@/lib/i18n/server'
import { currentUser } from '@/lib/auth/current-user'

export const metadata = { title: 'Meetings Report' }

/**
 * How often the family meets, how big the room is, and how much of it votes.
 *
 * ── TWO CHECKS, FOR `/reporting/gatherings`' REASON ─────────────────────────────────
 * `requireView` resolves with `can()`, true for scope 'own'; `canAny` follows it so the page
 * and the action agree about who may read a family-wide count.
 *
 * ── IT NEVER SAYS "ATTENDANCE", AND THE PAGE HAS TO KEEP SAYING WHY ─────────────────
 * There is no check-in anywhere in GENORRA. The attendee list is who was ASKED, and a vote is
 * the only positive evidence anybody was in the room. Both figures are on the screen and the
 * caption under the table states the difference — because a column headed "attendance" over
 * the invitation list is a report asserting something no row in the database says, and it is
 * the kind of number that gets quoted in a meeting a year later.
 */
export default async function MeetingsReportPage() {
  const { user } = await currentUser()
  if (!user) redirect('/login')

  await requireView(user.id, 'reporting/meetings')

  const { t, intl } = await callerI18n(user.id)
  if (!(await canAny(user.id, 'reporting/meetings', 'view'))) notFound()

  const report = await getMeetingsReport()
  if (!report) notFound()

  const { totals, rows, participants } = report

  return (
    <PageShell className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold">{t('page./reporting/meetings.title')}</h1>
      </div>

      <ReportStats stats={[
        { label: 'Meetings', value: totals.meetings, hint: `${totals.people} relatives asked to one` },
        {
          label: 'Minuted',
          value: `${totals.minuted} / ${totals.meetings}`,
          hint: 'closed, so the record is final',
          tone: 'affirm',
        },
        {
          label: 'Topics',
          value: totals.topics,
          hint: `${totals.votedTopics} reached a vote`,
        },
        { label: t('rep.votesCast'), value: totals.ballots, hint: 'one per topic answered' },
      ]} />

      {rows.length === 0 ? (
        <ReportEmpty
          icon={Gavel}
          message="The family has not held a meeting yet."
          hint="Once one is scheduled, this reports who was in the room, what was taken up, and how the votes went."
        />
      ) : (
        <>
          <section className="space-y-2">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">{t('rep.everyMeeting')}</h2>
            <div className="overflow-hidden rounded-xl border">
              <table className="w-full border-collapse text-sm">
                <caption className="sr-only">{t('rep.everyMeetingMostRecent')}</caption>
                <thead>
                  <tr className="border-b bg-muted/40 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    <th scope="col" className="px-3 py-2">Meeting</th>
                    <th scope="col" className={cn('px-3 py-2', COLLAPSING_CELL)}>Date</th>
                    <th scope="col" className={cn('px-3 py-2', COLLAPSING_CELL)}>{t('rep.minutes')}</th>
                    <th scope="col" className="px-3 py-2 text-right">{t('rep.room')}</th>
                    <th scope="col" className={cn('px-3 py-2 text-right', COLLAPSING_CELL)}>
                      Topics
                    </th>
                    <th scope="col" className={cn('px-3 py-2 text-right', COLLAPSING_CELL)}>
                      Votes
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map(row => (
                    <tr key={row.id} className="border-b align-top last:border-0 sm:align-middle">
                      <td className="px-3 py-2">
                        <Link href={`/library/meeting-minutes/${row.id}`}
                          className="font-medium text-foreground hover:underline">
                          {row.title}
                        </Link>
                        {row.minuted && (
                          <span className="ml-2 rounded-full bg-brand-soft px-2 py-0.5 text-[11px] font-medium text-brand-on-soft">
                            Minuted
                          </span>
                        )}
                        <RowMeta>
                          <span>{formatDate(row.meetsOn, intl)}</span>
                          {row.secretaryName && (
                            <>
                              <MetaDot />
                              <span>Minutes by {row.secretaryName}</span>
                            </>
                          )}
                          <MetaDot />
                          <span>{row.topics} topic{row.topics === 1 ? '' : 's'}</span>
                          <MetaDot />
                          <span>{row.ballots} vote{row.ballots === 1 ? '' : 's'}</span>
                        </RowMeta>
                      </td>
                      <td className={cn('px-3 py-2 tabular-nums', COLLAPSING_CELL)}>
                        {formatDate(row.meetsOn, intl)}
                      </td>
                      <td className={cn('px-3 py-2', COLLAPSING_CELL)}>
                        {row.secretaryName ?? <span className="text-muted-foreground">—</span>}
                      </td>
                      <td className="px-3 py-2 text-right tabular-nums">{row.inTheRoom}</td>
                      <td className={cn('px-3 py-2 text-right tabular-nums', COLLAPSING_CELL)}>
                        {row.topics}
                        {row.voted > 0 && (
                          <span className="block text-xs text-muted-foreground">
                            {row.voted} voted on
                          </span>
                        )}
                      </td>
                      <td className={cn('px-3 py-2 text-right tabular-nums', COLLAPSING_CELL)}>
                        {row.ballots}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          <section className="space-y-2">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">{t('rep.whoTakesPart')}</h2>
            {/* TWO COLUMNS, NEVER ONE CALLED "ATTENDANCE" — see the header. `Asked` is the
                attendee list and `Voted in` is the only positive evidence anybody was there. */}
            <div className="overflow-hidden rounded-xl border">
              <table className="w-full border-collapse text-sm">
                <caption className="sr-only">{t('rep.everyRelativeWhoBeen')}</caption>
                <thead>
                  <tr className="border-b bg-muted/40 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    <th scope="col" className="px-3 py-2">Relative</th>
                    <th scope="col" className="px-3 py-2 text-right">{t('rep.asked')}</th>
                    <th scope="col" className="px-3 py-2 text-right">{t('rep.voted')}</th>
                    <th scope="col" className={cn('px-3 py-2 text-right', COLLAPSING_CELL)}>
                      Minuted
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {participants.map(person => (
                    <tr key={person.personId} className="border-b last:border-0">
                      <td className="px-3 py-2">
                        {person.name}
                        <RowMeta>
                          <span>{person.minuted} minuted</span>
                        </RowMeta>
                      </td>
                      <td className="px-3 py-2 text-right tabular-nums">{person.invited}</td>
                      <td className={cn('px-3 py-2 text-right tabular-nums',
                        person.invited > 0 && person.votedIn === 0 && 'text-brand-withheld')}>
                        {person.votedIn}
                      </td>
                      <td className={cn('px-3 py-2 text-right tabular-nums', COLLAPSING_CELL)}>
                        {person.minuted}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        </>
      )}

      <p className="text-xs text-muted-foreground">
        <strong>{t('rep.asked')}</strong> is the attendee list, and <strong>voted in</strong> is how
        many of those meetings the person answered a vote in. Neither is attendance — nothing in
        GENORRA records who actually turned up, so this reports what it can count rather than
        estimating what it cannot.
      </p>
    </PageShell>
  )
}
