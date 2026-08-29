import { CheckCircle2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import { formatCurrency } from '@/lib/currency-utils'
import type { DuesPayment } from '@/app/actions/dues'
import { type T } from '@/lib/i18n/t'

/**
 * The payment history in one figure, with what it is the sum of.
 *
 * NO `'use client'` — same reasoning as `NextInstallmentsCard`, which it sits beside on
 * [Summary](/account-summary): a component with no hooks renders from a server
 * component and from a client one, and this is drawn from both
 * ([Payment History](/payment-history) is the other).
 *
 * REVERSALS NET OUT, in the headline and in the breakdown alike: a reversal is a `paid`
 * row with a negative amount, so a payment that was corrected leaves its schedule
 * showing what is actually left of it, including `$0.00` if the whole thing was taken
 * back. That is the honest line to draw, and it is what explains a total that would
 * otherwise look short.
 *
 * Dues and donations are counted together, because both are rows of the same table and
 * the member asked one question: where did my money go. The schedule name separates
 * them on its own — a schedule is one kind or the other — so the lines need no
 * Dues/Donation tag to be readable.
 */
export function PaidThisYearCard({ history, className, intl, t }: {
  /** The reader's `Intl` tag. A prop — this is a Server Component. */
  intl: string
  /**
   * The reader's translator. A PROP for the same reason `intl` beside it is one, and this
   * component SHIPPED with `useT()` in its body instead — a client hook in a module with no
   * `'use client'`, which throws *"Attempted to call useT() from the server"* and renders the
   * error boundary over the whole page. `npm run audit:client-hooks` is the gate.
   */
  t: T
  history: DuesPayment[]
  className?: string
}) {
  const paidPayments = history.filter(p => p.status === 'paid')
  const totalPaidCents = paidPayments.reduce((sum, p) => sum + p.amount_cents, 0)

  const byName = new Map<string, number>()
  for (const p of paidPayments) {
    // The same fallback the Payment History table uses, so one payment cannot be called
    // two different things on one page.
    const name = p.schedule_label ?? t('cards.generalPayment')
    byName.set(name, (byName.get(name) ?? 0) + p.amount_cents)
  }
  const paidBySchedule = [...byName]
    .map(([name, cents]) => ({ name, cents }))
    .sort((a, b) => b.cents - a.cents || a.name.localeCompare(b.name))

  return (
    <div className={cn('rounded-2xl border bg-card p-5 space-y-2', className)}>
      <div className="flex items-center gap-2.5">
        <div className="p-1.5 rounded-full bg-brand-affirm"><CheckCircle2 className="h-4 w-4 text-brand-on-affirm" /></div>
        <span className="text-sm text-muted-foreground font-medium">{t('cards.paidThisYear')}</span>
      </div>
      <p className="text-3xl font-bold">{formatCurrency(totalPaidCents, intl)}</p>
      <p className="text-xs text-muted-foreground">
        {paidPayments.length === 0 ? t('cards.noPayments') : `${paidPayments.length} payment${paidPayments.length !== 1 ? 's' : ''} recorded`}
      </p>
      {/* The breakdown, under the count. Name on the left, figure on the right rather
          than run together with a dash: these are a column of amounts to be compared
          with each other, and a right edge is what makes that possible. Long names
          truncate instead of wrapping, so the figures stay on their own lines. */}
      {paidBySchedule.length > 0 && (
        <ul className="space-y-0.5 pt-0.5">
          {paidBySchedule.map(g => (
            <li key={g.name} className="flex items-baseline justify-between gap-2 text-xs text-muted-foreground">
              <span className="min-w-0 truncate" title={g.name}>{g.name}</span>
              <span className="shrink-0 font-medium text-foreground">{formatCurrency(g.cents, intl)}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
