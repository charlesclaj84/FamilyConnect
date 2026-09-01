'use client'

import { useState, useTransition } from 'react'
import { CalendarClock, CreditCard, ExternalLink, Receipt } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { FormError } from '@/components/ui/form-message'
import { formatPlatformMoney } from '@/lib/currency-utils'
import { formatDate } from '@/lib/date-utils'
import { addDays } from '@/lib/platform-billing'
import { TIER_LABEL } from '@/lib/tiers'
import { openBillingPortal, type PlatformBilling } from '@/app/actions/billing'
import { COLLAPSING_CELL, MetaDot, RowMeta } from '@/components/ui/table-collapse'
import { cn } from '@/lib/utils'
import { useIntlTag, useT } from '@/components/layout/LocaleProvider'

/**
 * Settings → **Billing**: what this family has paid GENORRA, until when, and every receipt.
 *
 * ── IT IS THE RECORD. IT STARTS NO PURCHASE ────────────────────────────────────────
 * Until 2026-08-25 this was a second band inside the Plan pane and it owned every buy button
 * in the product. Those moved onto the plan rows they buy (`PlanPanel`), and the two dialogs
 * went with them (`PlanCheckoutDialogs.tsx`) — a dialog belongs to whatever opens it.
 * `components/admin/family-settings.ts` argues the split; the short version is that a
 * CATALOGUE and a LEDGER were sharing one scroll, and the catalogue's rows had been reduced to
 * pointing downwards at the controls that did the work.
 *
 * What is left here is everything with a date on it. That is a coherent pane rather than a
 * leftover: *what are we paying, until when, what happens next, and what have we been
 * charged* is one question asked in four parts, and none of its answers is a decision.
 *
 * The one control that survived is **Cards and receipts**, and it is not a purchase either —
 * it opens Stripe's own portal, where the card on file lives. It deliberately does NOT control
 * the tier: the no-refund rule and the scheduled-downgrade rule are ours, and the portal's own
 * plan switcher knows nothing about them.
 *
 * ── "STOP RENEWING" IS GONE, ON PURPOSE ────────────────────────────────────────────
 * It ended a monthly plan at the end of the paid period, which is the same decision as moving
 * to Free — the same effective date, the same absence of a refund, the same records kept — and
 * having both meant a family could stop paying without ever choosing what they were stopping
 * at, then meet a second control for the plan itself. **Downgrade to Free** on the Plan pane
 * is now the single door, and it reaches the same `cancelPlanRenewal`: `changePlanTier`
 * routes `free` straight to it. Nothing was removed from the product except a second name for
 * one act.
 *
 * ── AND NOTHING HERE APPEARS IN THE FAMILY'S OWN BOOKS ─────────────────────────────
 * `platform_payments` is in no fund balance, no P&L and no dues projection — 20260823000004's
 * header argues it at length. The pane's lede says so out loud, because an administrator who
 * has just opened something called "Billing" inside their family's admin area is exactly the
 * person about to assume otherwise.
 */
export function BillingPanel({ billing }: { billing: PlatformBilling | null }) {
  const intl = useIntlTag()
  const t = useT()
  // NO `useRouter` HERE ANY MORE, which is the tell that this pane changed nothing. It held
  // one so it could `router.refresh()` after a purchase; the only action left opens Stripe's
  // portal in the same tab, so there is no local state to re-read and nothing to revalidate.
  const [pending, startTransition] = useTransition()
  const [error, setError] = useState('')

  // §8: null is a refused or failed read, not "this family has never paid". Saying so beats
  // rendering an empty billing panel over a live subscription.
  if (!billing) {
    return (
      <p className="text-sm text-muted-foreground">{t('adm.billingCouldNotLoaded')}</p>
    )
  }

  const openPortal = () => startTransition(async () => {
    setError('')
    const result = await openBillingPortal()
    if (!result.success) {
      setError(result.message ?? t('meet.wentWrong'))
      return
    }
    window.location.href = result.url
  })

  const term = billing.paidEntitlement
  const paidThrough = formatDate(billing.paidThrough, intl)
  // INCLUSIVE, so the next payment is the day after — the same `+1` `scheduleDowngrade`
  // applies on the server. Only meaningful while a term is live; a lapsed one is already past.
  const nextDue = billing.paidThrough && !term.lapsed
    ? formatDate(addDays(billing.paidThrough, 1), intl)
    : null

  // A PREPAID TERM RENEWS NOTHING, which makes "next payment" two different facts. On a
  // subscription it is when the card is charged; on a prepaid term it is the day the pages
  // close unless somebody buys again. The grid says which, because a family reading "next
  // payment" and assuming it is automatic is the one that loses its pages.
  const renews = billing.mode === 'recurring' && Boolean(billing.subscriptionStatus)

  return (
    <div className="space-y-5">
      {/* ── WHAT IS PAID FOR, AND WHAT HAPPENS NEXT ─────────────────────────────────
          Four facts, and each is a column rather than a sentence because an administrator
          scans this rather than reading it. The fourth — the date — used to be buried in a
          clause of the third, which is how it came to be the thing people asked about.

          DATES ARE FORMATTED, since 2026-08-25. Every one of these rendered as a raw
          `YYYY-MM-DD` off the record, which is the only place in the signed-in product that
          did; `formatDate` is what the rest of the app reads. */}
      <dl className="grid gap-4 rounded-lg border bg-muted/30 p-4 text-sm sm:grid-cols-2 lg:grid-cols-4">
        <div>
          <dt className="text-xs uppercase tracking-wide text-muted-foreground">{t('bill.paidPlan')}</dt>
          <dd className="font-medium">
            {billing.paidTier ? TIER_LABEL[billing.paidTier] : t('bill.onFree')}
          </dd>
        </div>
        <div>
          <dt className="text-xs uppercase tracking-wide text-muted-foreground">{t('bill.paidThrough')}</dt>
          <dd className="font-medium">{paidThrough ?? '—'}</dd>
          {/* LAPSED IS ITS OWN SENTENCE, and `--brand-withheld` rather than `--destructive`:
              a term running out is not an error and nothing has been deleted. It is the same
              reading the dues ladder takes of a missed installment. */}
          {term.lapsed && (
            <dd className="text-xs text-brand-withheld">{t('adm.termEndedPayAgain')}</dd>
          )}
        </div>
        <div>
          <dt className="text-xs uppercase tracking-wide text-muted-foreground">
            {renews ? t('bill.nextPayment') : t('bill.nextPaymentDue')}
          </dt>
          <dd className="font-medium">{nextDue ?? '—'}</dd>
        </div>
        <div>
          <dt className="text-xs uppercase tracking-wide text-muted-foreground">{t('bill.howRenews')}</dt>
          <dd className="font-medium">
            {billing.mode === 'recurring'
              ? billing.cancelAtPeriodEnd ? t('bill.stopping') : t('bill.monthlyAuto')
              : billing.mode === 'prepaid' ? t('bill.inAdvance') : '—'}
          </dd>
        </div>
      </dl>

      {/* A SCHEDULED CHANGE IS THE THING SOMEBODY CAME HERE TO CHECK, so it gets its own
          band rather than a line in the grid. It also states the no-refund rule at the one
          moment it is relevant. */}
      {billing.scheduledTier && billing.scheduledTierOn && (
        <div className="flex items-start gap-2 rounded-lg border border-brand-warm bg-brand-warm/10 p-3 text-sm text-brand-warm">
          <CalendarClock className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
          <p>
            {t('bill.movingTo')} <strong>{TIER_LABEL[billing.scheduledTier]}</strong> on{' '}
            <strong>{formatDate(billing.scheduledTierOn, intl) ?? billing.scheduledTierOn}</strong>.
            Nothing changes before then, and there is no refund for the rest of this period —
            that is what keeps the pages open until it ends.
          </p>
        </div>
      )}

      {/* ── A FAILED CARD IS REPORTED AND NOTHING ELSE HAPPENS ──────────────────────
          `invoice.payment_failed` stamps the date and the product does not act on it: Stripe
          retries a failed card for days, so a family whose payment fails on Tuesday and
          succeeds on Thursday must not lose their pages in between. What the product SHOULD do
          about a family two weeks past due is a decision nobody has taken — TODO.md carries it
          — so this band says what is true and asks the family to fix the card.

          `--brand-warm` rather than `--destructive`, deliberately: nothing has failed on the
          family's side of the screen, nothing is deleted, and the pages are still open. */}
      {billing.delinquentSince && (
        <div className="flex items-start gap-2 rounded-lg border border-brand-warm bg-brand-warm/10 p-3 text-sm text-brand-warm">
          <CreditCard className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
          <p>
            {t('bill.cardFailingSince', {
              date: formatDate(billing.delinquentSince, intl) ?? billing.delinquentSince,
              where: t('bill.cardsReceipts'),
            })}
          </p>
        </div>
      )}

      {billing.canManage ? (
        <div className="space-y-2">
          <div className="flex flex-wrap items-center gap-3">
            <Button variant="outline" size="sm" disabled={pending} onClick={openPortal}>
              <ExternalLink className="h-4 w-4" />
              {t('bill.cardsReceipts')}
            </Button>
            <p className="text-sm text-muted-foreground">{t('adm.stripeSOwnPortal')}</p>
          </div>
          <FormError message={error} />
        </div>
      ) : (
        <p className="text-xs text-muted-foreground">{t('adm.canSeeWhatFamily')}</p>
      )}

      {/* ── WHAT WE HAVE CHARGED ────────────────────────────────────────────────────
          GENORRA's receipts to the family, and deliberately not in any of the family's own
          money screens.

          IT WAS A `<details>` UNTIL 2026-08-25 and is a list now. Collapsing it was right when
          it was the fourth band inside a pane about something else; on a pane whose whole
          subject is what has been paid, a summary somebody has to open in order to find the
          payments is the pane hiding its own content. */}
      <div className="space-y-2">
        <h2 className="text-lg font-semibold">
          <Receipt className="me-2 inline h-4 w-4" aria-hidden="true" />
          {t('bill.whatCharged')}
        </h2>

        {billing.payments.length === 0 ? (
          // AN EMPTY LEDGER IS A FACT, and a different one from a failed read at the top of
          // this file. It says which.
          <p className="text-sm text-muted-foreground">
            {t('bill.neverCharged')}
          </p>
        ) : (
          <div className="overflow-hidden rounded-lg border">
            <table className="w-full text-start text-sm">
              <thead className="bg-muted/50 text-xs uppercase tracking-wide text-muted-foreground">
                <tr>
                  <th scope="col" className="px-4 py-2">{t('set.pane.plan')}</th>
                  {/* THE FOLDING COLUMNS. A phone keeps the plan and the amount — what was
                      bought and what it cost — and the two dates move into the `RowMeta`
                      under the plan name, which is the pattern AGENTS.md sets for every table
                      in the app. No `min-w-*` floor and no sideways scroll. */}
                  <th scope="col" className={cn('px-4 py-2', COLLAPSING_CELL)}>{t('money.paid')}</th>
                  <th scope="col" className={cn('px-4 py-2', COLLAPSING_CELL)}>{t('bill.covers')}</th>
                  <th scope="col" className="px-4 py-2 text-end">{t('common.amount')}</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {billing.payments.map(p => {
                  const paid = formatDate(p.paidAt, intl)
                  const covers = p.coversThrough
                    ? `${p.coversFrom ? `${formatDate(p.coversFrom, intl)} – ` : 'through '}${formatDate(p.coversThrough, intl)}`
                    : null
                  return (
                    <tr key={p.id} className="align-top sm:align-middle">
                      <td className="px-4 py-2">
                        {TIER_LABEL[p.tier]}
                        {p.months > 1
                          ? t('bill.monthsSuffix', { n: String(p.months) })
                          : ''}
                        <RowMeta>
                          {paid && <span>Paid {paid}</span>}
                          {paid && covers && <MetaDot />}
                          {covers && <span>{covers}</span>}
                        </RowMeta>
                      </td>
                      <td className={cn('px-4 py-2', COLLAPSING_CELL)}>{paid ?? '—'}</td>
                      <td className={cn('px-4 py-2', COLLAPSING_CELL)}>{covers ?? '—'}</td>
                      <td className="px-4 py-2 text-end font-medium">
                        {formatPlatformMoney(p.amountCents, intl)}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* THE DEPLOYMENT CANNOT SELL ANYTHING. Not an error and not worth a red box: a
            developer laptop and every preview build is in this state by design. It sits here
            rather than replacing the pane, because what a family HAS paid is still worth
            showing on a deployment that cannot take a new payment. */}
        {/* A KEY since 2026-09-01 — see `stripeUnavailableKey`. It printed as English to
            every reader until then. */}
        {billing.unavailable && (
          <p className="text-xs text-muted-foreground">{t(billing.unavailable)}</p>
        )}
      </div>
    </div>
  )
}
