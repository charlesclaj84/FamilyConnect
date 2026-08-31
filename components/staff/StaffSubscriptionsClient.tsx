'use client'

import { AlertTriangle, TrendingUp } from 'lucide-react'
import { COLLAPSING_CELL, RowMeta, MetaDot } from '@/components/ui/table-collapse'
import { formatCurrency } from '@/lib/currency-utils'
import { formatDate } from '@/lib/date-utils'
import { TIER_LABEL } from '@/lib/tiers'
import { cn } from '@/lib/utils'
import { useIntlTag, useT } from '@/components/layout/LocaleProvider'
import type { StaffSubscriptionPage, StaffSubscriptionRow } from '@/app/actions/staff/subscriptions'

/**
 * The platform's paying customers, and the four figures above them.
 *
 * ── EVERY FIGURE HERE IS THE PLATFORM'S OWN REVENUE. NONE IS A FAMILY'S DUES ───────
 * AGENTS.md's first rule about money in this product: `platform_payments` is what a family
 * pays GENORRA and `dues_payments` is what a relative pays their family, and the two ledgers
 * must never meet. `listStaffSubscriptions` reads only the first. A figure on this screen that
 * had drifted into the second would report GENORRA's revenue as several times what it is, on
 * the one screen somebody would quote in a board meeting — so if a column is ever added here,
 * check which ledger it came from first.
 *
 * ── A REFUSED READ SAYS SO RATHER THAN RENDERING ZEROS ─────────────────────────────
 * §8, and it matters more here than almost anywhere: zeros on this screen read as a platform
 * with no customers, which is both alarming and false. `summary.failed` is what the action
 * sets when any of its three reads was refused, and the whole screen becomes one sentence.
 *
 * ── AND THE TWO TIER COLUMNS ARE NOT A DUPLICATE ───────────────────────────────────
 * `tier` is what is IN FORCE — the only thing any gate in the product reads. `paidTier` is
 * what the last payment bought. They differ in exactly the cases somebody opens this screen
 * for: a card that failed (tier still high, nothing being paid), and a downgrade already
 * promised (paid for more than they will have next month).
 */
export function StaffSubscriptionsClient({ data }: { data: StaffSubscriptionPage }) {
  const t = useT()
  const intl = useIntlTag()
  const { rows, summary } = data

  if (summary.failed) {
    return (
      <p className="rounded-lg border bg-muted/40 px-4 py-3 text-sm text-brand-withheld">
        {t('stf.subscriptionsReadFailed')}
      </p>
    )
  }

  return (
    <div className="space-y-5">
      {/* ── THE FOUR FIGURES ────────────────────────────────────────────────────
          `mrrCents` excludes prepaid terms and cancelling families, and the caption says
          so — a figure labelled "monthly" that folded in a twelfth of an annual prepayment
          would invent a subscription nobody has. `listStaffSubscriptions` argues it. */}
      <dl className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Figure label={t('stf.subPaying')} value={String(summary.paying)} tone="affirm" />
        <Figure
          label={t('stf.subMrr')}
          value={formatCurrency(summary.mrrCents, intl)}
          hint={t('stf.subMrrHint')}
          tone="affirm"
        />
        <Figure
          label={t('stf.subLifetime')}
          value={formatCurrency(summary.lifetimeCents, intl)}
          tone="plain"
        />
        {/* Withheld rather than destructive: a failed card is not an error in this product,
            it is a state a family is in and somebody has to act on. The dues ladder takes
            the same reading of an unpaid installment. */}
        <Figure
          label={t('stf.subAttention')}
          value={String(summary.delinquent + summary.leaving)}
          hint={t('stf.subAttentionHint', {
            delinquent: String(summary.delinquent),
            leaving: String(summary.leaving),
          })}
          tone={summary.delinquent + summary.leaving > 0 ? 'withheld' : 'plain'}
        />
      </dl>

      {rows.length === 0 ? (
        <p className="text-sm text-muted-foreground">{t('stf.subNoneYet')}</p>
      ) : (
        <div className="overflow-hidden rounded-lg border">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/40 text-left">
                <th scope="col" className="px-3 py-2 text-xs font-medium text-muted-foreground">
                  {t('stf.subFamily')}
                </th>
                <th scope="col" className={cn('px-3 py-2 text-xs font-medium text-muted-foreground', COLLAPSING_CELL)}>
                  {t('stf.subPlan')}
                </th>
                <th scope="col" className={cn('px-3 py-2 text-xs font-medium text-muted-foreground', COLLAPSING_CELL)}>
                  {t('stf.subPaidThrough')}
                </th>
                <th scope="col" className="px-3 py-2 text-xs font-medium text-muted-foreground">
                  {t('stf.subStanding')}
                </th>
                <th scope="col" className="px-3 py-2 text-right text-xs font-medium text-muted-foreground">
                  {t('stf.subLifetimeShort')}
                </th>
              </tr>
            </thead>
            <tbody>
              {rows.map(row => (
                <tr key={row.familyCode} className="border-b align-top last:border-0 sm:align-middle">
                  <td className="px-3 py-2.5">
                    <p className="font-medium">{row.familyName}</p>
                    {/* Below `sm` the two folded columns come and sit here — see LedgerTable
                        and AGENTS.md's "On a phone a table narrows". */}
                    <RowMeta>
                      <span className="font-mono text-xs">{row.familyCode}</span>
                      <MetaDot />
                      <span>{TIER_LABEL[row.tier]}</span>
                      {row.paidThrough && (
                        <>
                          <MetaDot />
                          <span>{formatDate(row.paidThrough, intl)}</span>
                        </>
                      )}
                    </RowMeta>
                  </td>
                  <td className={cn('px-3 py-2.5', COLLAPSING_CELL)}>
                    <p>{TIER_LABEL[row.tier]}</p>
                    {/* Only when the two DISAGREE. A second line repeating the first is
                        noise on every row, and the disagreement is the whole reason both
                        are here. */}
                    {row.paidTier && row.paidTier !== row.tier && (
                      <p className="text-xs text-brand-withheld">
                        {t('stf.subPaidFor', { tier: TIER_LABEL[row.paidTier] })}
                      </p>
                    )}
                    {row.mode && (
                      <p className="text-xs text-muted-foreground">{t(`stf.subMode.${row.mode}`)}</p>
                    )}
                  </td>
                  <td className={cn('px-3 py-2.5 whitespace-nowrap', COLLAPSING_CELL)}>
                    {row.paidThrough
                      ? formatDate(row.paidThrough, intl)
                      : <span className="text-muted-foreground">—</span>}
                    {row.scheduledTier && row.scheduledTierOn && (
                      <p className="text-xs text-brand-withheld">
                        {t('stf.subScheduled', {
                          tier: TIER_LABEL[row.scheduledTier],
                          on: formatDate(row.scheduledTierOn, intl) ?? row.scheduledTierOn,
                        })}
                      </p>
                    )}
                  </td>
                  <td className="px-3 py-2.5">
                    <Standing row={row} />
                  </td>
                  <td className="px-3 py-2.5 text-right whitespace-nowrap font-medium">
                    {formatCurrency(row.lifetimeCents, intl)}
                    {row.lastPaidAt && (
                      <p className="text-xs font-normal text-muted-foreground">
                        {formatDate(row.lastPaidAt.slice(0, 10), intl)}
                      </p>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

function Figure({ label, value, hint, tone }: {
  label: string
  value: string
  hint?: string
  tone: 'plain' | 'affirm' | 'withheld'
}) {
  return (
    <div className="rounded-lg border bg-card px-4 py-3">
      <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</dt>
      <dd className={cn(
        'mt-0.5 text-2xl font-bold leading-tight',
        tone === 'affirm' && 'text-brand-ink',
        tone === 'withheld' && 'text-brand-withheld',
      )}>
        {value}
      </dd>
      {hint && <p className="mt-0.5 text-xs text-muted-foreground">{hint}</p>}
    </div>
  )
}

/**
 * What state this customer is in, as one chip.
 *
 * ── ORDER IS PRECEDENCE, AND THE FIRST TWO ARE THE ONES SOMEBODY ACTS ON ───────────
 * A delinquent family that is also cancelling is delinquent: the failed payment is the thing
 * to ring them about, and the cancellation is what happens if nobody does. Reading the
 * branches top to bottom is reading the support queue.
 */
function Standing({ row }: { row: StaffSubscriptionRow }) {
  const t = useT()
  const intl = useIntlTag()

  if (row.delinquentSince) {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-brand-warm/15 px-2 py-0.5 text-xs font-medium text-brand-withheld">
        <AlertTriangle className="h-3 w-3" aria-hidden="true" />
        {t('stf.subDelinquentSince', { on: formatDate(row.delinquentSince.slice(0, 10), intl) ?? '' })}
      </span>
    )
  }
  if (row.cancelAtPeriodEnd) {
    return (
      <span className="rounded-full bg-muted px-2 py-0.5 text-xs font-medium text-brand-withheld">
        {t('stf.subLeaving')}
      </span>
    )
  }
  if (!row.paidThrough) {
    return <span className="text-xs text-muted-foreground">{t('stf.subNeverPaid')}</span>
  }
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-brand-affirm px-2 py-0.5 text-xs font-medium text-brand-on-affirm">
      <TrendingUp className="h-3 w-3" aria-hidden="true" />
      {/* Stripe's own word, verbatim, when there is one — `active`, `past_due`, `trialing`.
          Not translated and not prettified: it is what the Stripe Dashboard says, and a
          support engineer with both screens open must be able to match them. */}
      {row.subscriptionStatus ?? t('stf.subPaid')}
    </span>
  )
}
