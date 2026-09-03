import { MailWarning } from 'lucide-react'
import { formatInstantDate } from '@/lib/tz'
import type { ReminderReport } from '@/app/actions/dues'
import { type T } from '@/lib/i18n/t'

/**
 * What the dues-reminder queue has actually done, as a band on Dues Projections.
 *
 * ── IT ANSWERS THREE QUESTIONS AND NOT A FOURTH ────────────────────────────────────
 * *Did anything go out*, *whose address does not work*, and *was anybody reminded twice*. The
 * entry that asked for this named those three, and the second is the one a treasurer asks
 * first — see `getReminderReport`, which carries the whole argument for the band living here
 * rather than being a route.
 *
 * WHAT IT DELIBERATELY DOES NOT DO is offer to re-send, cancel or requeue anything. A reminder
 * is not a dunning notice: it has no ladder, no lockout and no consequence, so there is nothing
 * for an organizer to intervene in — and a Retry button would need a write path this feature
 * does not have and an argument about what a second reminder means that nobody has made.
 * `distribution_recipients` earns its `requeueDistribution` because a killed batch strands rows
 * in `sending` and only that action can move them; this queue is drained by a daily job that
 * retries on its own.
 *
 * ── NO HOOKS AND NO HANDLERS, so it renders from either side of the client boundary ─
 * `t` and `zone` are PROPS rather than `useT()`/`useZone()`, which is the first row of
 * AGENTS.md' table: this is rendered by a Server Component today and a `useT()` here would be
 * the crash `npm run audit:client-hooks` exists to catch — *"a client reference, not the
 * function"*, thrown at render.
 *
 * ── AND `--brand-withheld` FOR AN UNREACHABLE ADDRESS, NEVER `--destructive` ────────
 * Nothing has failed and nothing has been deleted: a relative recorded without a real address
 * is the ORDINARY state of somebody on the family tree who has not been invited yet, and the
 * band is telling the family there is something they have not done. That is exactly the role
 * AGENTS.md reserves the token for, and the same reading the dues ladder takes of an unpaid
 * installment. `ReportStats`' own rule — *"there is no `destructive` and there must not be:
 * nothing on a report is an error"* — is the same rule one screen over.
 */
export function ReminderOutcomes({ report, zone, t }: {
  report: ReminderReport
  /** The family's time zone, for the one instant on the band. */
  zone: string
  t: T
}) {
  // ── NOTHING QUEUED IS NOT NOTHING SENT, AND THE BAND SAYS WHICH ──────────────────
  // A family on a plan that includes reminders but with nothing yet due has an empty queue;
  // a family whose queue has been failing silently for a month does not. Rendering the same
  // sentence for both is the thing this band exists to stop, so the empty case is stated
  // rather than the band being hidden.
  if (!report.everQueued) {
    return (
      <section className="rounded-xl border border-dashed bg-muted/20 px-4 py-3">
        <p className="text-xs text-muted-foreground">{t('rem.noneQueuedYet')}</p>
      </section>
    )
  }

  const sent = report.counts.find(c => c.state === 'sent')?.n ?? 0

  return (
    <section className="space-y-3 rounded-xl border bg-card p-4 sm:p-5">
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <h2 className="text-lg font-semibold">{t('rem.heading')}</h2>
        {/* WHEN, NOT HOW LONG AGO. `formatInstantDate` because `sent_at` is an INSTANT and has
            no calendar date of its own — the rule `lib/tz.ts` states and the payment history
            already follows for `created_at`. A relative measure ("3 days ago") would also be
            wrong the moment the tab is left open. */}
        <p className="text-xs text-muted-foreground">
          {report.lastSentAt
            ? t('rem.lastWentOut', { on: formatInstantDate(report.lastSentAt, zone) ?? '' })
            : t('rem.noneSentYet')}
        </p>
      </div>

      {/* THE COUNTS, AND `sent` IS NOT SINGLED OUT. Every state is a fact about the same
          queue and a headline figure would invite reading the rest as exceptions — where
          `unreachable` in particular is the row that most needs acting on. Only the states
          that HAVE rows are drawn: a `cancelled: 0` chip is a control that never changes. */}
      <dl className="flex flex-wrap gap-x-6 gap-y-2">
        {report.counts.map(c => (
          <div key={c.state}>
            <dt className="text-xs text-muted-foreground">{t(`rem.state.${c.state}`)}</dt>
            <dd className={`text-xl font-semibold tabular-nums${
              c.state === 'unreachable' || c.state === 'failed' ? ' text-brand-withheld' : ''
            }`}>
              {c.n}
            </dd>
          </div>
        ))}
      </dl>

      {/* WHAT EACH STATE MEANS, once, under the figures. Five of the six are not guessable —
          `unreachable` and `cancelled` in particular read as failures and are not one. */}
      <p className="text-xs text-muted-foreground">{t('rem.statesHint')}</p>

      {report.unreachable.length > 0 && (
        <div className="space-y-1.5 rounded-lg border border-dashed px-3 py-2.5">
          <p className="flex items-center gap-1.5 text-xs font-medium text-brand-withheld">
            <MailWarning className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
            {t('rem.cannotReach')}
          </p>
          {/* NAMED, which is the whole point of the state existing — see the field's own
              comment in `getReminderReport`. The count beside each name is how many
              installments have been given up on for them, which is what separates somebody
              who joined last week from somebody the family has been unable to reach all year. */}
          <ul className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
            {report.unreachable.map(m => (
              <li key={m.person_id}>
                <span className="text-foreground">{m.name}</span>
                {m.n > 1 && <span>{' '}{t('rem.timesN', { n: String(m.n) })}</span>}
              </li>
            ))}
          </ul>
          <p className="text-xs text-muted-foreground">{t('rem.cannotReachHint')}</p>
        </div>
      )}

      {/* THE ONE ARITHMETIC CLAIM, and it is only made when it can be checked. The unique
          index makes a second reminder for one installment impossible; this is how somebody
          satisfies themselves of that without reading a migration. Said only once anything
          has gone out, because "0 sent, none twice" is a sentence about nothing. */}
      {sent > 0 && (
        <p className="text-xs text-muted-foreground">{t('rem.neverTwice')}</p>
      )}
    </section>
  )
}
