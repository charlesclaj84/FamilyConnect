import { DollarSign } from 'lucide-react'
import { cn } from '@/lib/utils'
import { formatCurrency } from '@/lib/currency-utils'
import { formatDate } from '@/lib/date-utils'
import { isOutstanding } from '@/lib/dues-utils'
import type { DuesSummary } from '@/app/actions/dues'
import { type T } from '@/lib/i18n/t'

/**
 * What the member pays next, across every schedule that has a date.
 *
 * NO `'use client'`, deliberately, and it is what lets this card appear on both
 * [Summary](/account-summary) — a server component, which renders it straight from the
 * fetch — and [Dues](/dues), where `DuesPlanSection` feeds it the local optimistic
 * `rows` so a cadence change moves the figure before the round trip lands. A component
 * with no hooks and no handlers is usable from either side of the boundary; adding one
 * would quietly cost it the server half.
 *
 * It is the same component in both places for the reason `DuesBalanceKpi`'s header
 * gives about itself: two hand-rolled renderings of one fact had already drifted into
 * two different readings of the same money, and matching them by hand only lasts until
 * the next edit to one of them. If this card ever needs to differ between the two
 * screens, that difference is a prop with a reason written next to it, or it does not
 * happen.
 *
 * The card used to name only the first schedule and call itself "Next Installment"
 * whether there was one or five — so a member paying three dues on three cadences saw
 * one date and had to infer that the other two existed. It lists each schedule's own
 * next date, and says "Installments" when it means more than one.
 */
export function NextInstallmentsCard({ summary, className, intl, t }: {
  /** The reader's `Intl` tag. A prop — this is a Server Component. */
  intl: string
  /**
   * The reader's translator. A PROP for the same reason `intl` beside it is one, and this
   * component SHIPPED with `useT()` in its body instead — a client hook in a module with no
   * `'use client'`, which throws *"Attempted to call useT() from the server"* and renders the
   * error boundary over the whole page. `npm run audit:client-hooks` is the gate.
   */
  t: T
  summary: DuesSummary[]
  /** Sizing from the parent — a grid cell in every current call site. */
  className?: string
}) {
  // `isOutstanding`, not `!paid`: a due the member has DECLINED is neither paid nor
  // owed, and counting it here would put a figure on the card against something they
  // have already said no to.
  //
  // NO CLIENT-SIDE CLAMP. `nextInstallmentCents` arrives already limited to the
  // remaining balance (see DuesSummary), and the `Math.min` that used to sit here was a
  // second answer to the same question — which is exactly how the figure in this card
  // and the figure in the table below it came to be computed two different ways.
  const upcoming = summary
    .filter(isOutstanding)
    .filter(s => s.nextInstallmentDate)
    .sort((a, b) => (a.nextInstallmentDate ?? '').localeCompare(b.nextInstallmentDate ?? ''))

  // The headline is what the member is about to pay across all of them — the catch-up
  // included, which is the whole point: a total that quietly showed the steady
  // installment while the row beside it asked for more is the disagreement this
  // replaced.
  const upcomingTotalCents = upcoming.reduce((sum, s) => sum + s.nextInstallmentCents, 0)
  const fmtDate = (s: string) => formatDate(s, intl) ?? ''

  return (
    <div className={cn('rounded-2xl border bg-card p-5 space-y-2', className)}>
      <div className="flex items-center gap-2.5">
        <div className="p-1.5 rounded-full bg-brand-affirm"><DollarSign className="h-4 w-4 text-brand-on-affirm" /></div>
        {/* Plural only when it is plural. One schedule and this card is about one
            payment; five and the figure below is a sum, which the title has to admit
            or the number reads as a single installment five times too large. */}
        <span className="text-sm text-muted-foreground font-medium">
          {upcoming.length > 1 ? t('cards.nextInstallmentsMany') : t('cards.nextInstallmentOne')}
        </span>
      </div>
      <p className="text-2xl font-bold leading-tight">
        {upcoming.length > 0 ? formatCurrency(upcomingTotalCents, intl) : '—'}
      </p>
      {upcoming.length === 0 ? (
        <p className="text-xs text-muted-foreground">{t('cards.noUpcoming')}</p>
      ) : (
        /* TWO LINES PER SCHEDULE: the name, then when it is due and for how much.
           One line held all three and the name was the part that lost — it truncated
           first, because the date and the amount are fixed-width and it was not, so a
           "Building Maintenance Fund" was read as "Building Mainten…" while a date
           nobody was looking for sat beside it in full. On its own line it fits.
           The amount shows even when there is only one schedule, where it repeats the
           headline. That repetition is worth less than a card whose rows change shape
           depending on how many of them there are. */
        <ul className="space-y-1.5">
          {upcoming.map(s => (
            <li key={s.schedule.id} className="text-xs">
              <p className="truncate font-medium" title={s.schedule.label}>{s.schedule.label}</p>
              <p className="text-muted-foreground">
                due {fmtDate(s.nextInstallmentDate!)}
                {' · '}
                <span className="font-medium text-foreground">{formatCurrency(s.nextInstallmentCents, intl)}</span>
              </p>
              {/* THE SECOND LINE IS THE ANSWER TO "why is this more than my
                  installment". A catch-up figure with nothing explaining it reads as an
                  error, and the thing that explains it is what comes after: one larger
                  payment, then the ordinary amount. Rendered only when there is one — a
                  member who is level has nothing to catch up and needs no sentence
                  about it. */}
              {!s.onSchedule && s.followingInstallmentDate && (
                <p className="text-muted-foreground/80">
                  {t(s.periodsElapsed === 1
                    ? 'plan.coversEarlierOne'
                    : 'plan.coversEarlierMany', { n: String(s.periodsElapsed) })}
                  {' · then '}
                  {formatCurrency(s.followingInstallmentCents, intl)} from {fmtDate(s.followingInstallmentDate)}
                </p>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
