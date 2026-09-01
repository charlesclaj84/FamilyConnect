'use client'

import { useState, useTransition } from 'react'
import { AlertTriangle, Trash2 } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { FormError } from '@/components/ui/form-message'
import { useT } from '@/components/layout/LocaleProvider'
import { formatPlatformMoney } from '@/lib/currency-utils'
import { useIntlTag } from '@/components/layout/LocaleProvider'
import { requestStartFreshCode, startFresh, type RetentionView } from '@/app/actions/admin/retention'

/**
 * The sixty days after a downgrade, on the Billing pane.
 *
 * ── IT RENDERS ONLY WHILE A WINDOW IS OPEN ─────────────────────────────────────────
 * `getRetentionView()` answers `null` for the overwhelming majority of families, and this
 * returns `null` for that — a permanent band explaining a thing that is not happening is noise
 * on the one screen where noise costs the most attention.
 *
 * ── IT STATES THE TWO OPTIONS, AND ONLY ONE OF THEM IS A BUTTON HERE ──────────────
 * Decided 2026-08-23: keep it by moving back to the tier and paying for the months away, or
 * let it go and pay nothing. The first is a PURCHASE and belongs on the plan rows one pane
 * over, where every other purchase in the product starts — so this names the figure and sends
 * the reader there rather than growing a second checkout.
 *
 * The second is here because it is not a purchase, and because it is the one act in the window
 * that brings an irreversible deletion forward.
 *
 * ── THE PASSWORD IS NOT ASKED FOR, AND THAT IS A DELIBERATE DIFFERENCE ────────────
 * `PlanPanel` and `ProcessingPanel` both take a password before their emailed code, and both
 * say in as many words that it is not the second factor — it stops an accident and somebody at
 * an unlocked screen. That argument is weaker here than there: this deletes data the family
 * has ALREADY been told four times is going, on a date they can see, and the code is the
 * factor either way. What is asked for instead is the thing a password cannot give — the code,
 * from the mailbox they sign in with.
 *
 * ── AND IT NAMES WHAT WILL GO, ROW BY ROW ────────────────────────────────────────
 * From `delete_family_data_above_tier`'s own DRY RUN, so the list and the deletion cannot
 * disagree. "Your data" is not a confirmation anybody can act on; "412 relationships, 96
 * payments" is.
 */
export function RetentionPanel({ view }: { view: RetentionView | null }) {
  const t = useT()
  const intl = useIntlTag()
  const [pending, start] = useTransition()
  const [error, setError] = useState('')
  const [code, setCode] = useState('')
  const [sent, setSent] = useState<{ email: string; minutes: number; counts: Record<string, number> } | null>(null)
  const [done, setDone] = useState(false)

  if (!view) return null

  const ask = () => {
    setError('')
    start(async () => {
      const result = await requestStartFreshCode()
      if (!result.success) { setError(result.message); return }
      setSent({ email: result.sentTo, minutes: result.minutes, counts: result.counts })
    })
  }

  const confirm = () => {
    setError('')
    start(async () => {
      const result = await startFresh(code)
      if (!result.success) { setError(result.message); return }
      setSent(null)
      setCode('')
      setDone(true)
    })
  }

  if (done) {
    return (
      <div className="rounded-xl border bg-card p-5 text-sm text-muted-foreground sm:p-6">
        {t('ret.done')}
      </div>
    )
  }

  // NEGATIVE DAYS ARE A REAL STATE AND ARE SAID OUT LOUD. `daysUntilDataDeleted` deliberately
  // does not clamp: past zero, the deletion is waiting on a reminder that never sent, and
  // "0 days" would tell an administrator it happens today when it has not happened at all.
  const overdue = view.daysLeft < 0

  return (
    <div className="space-y-4 rounded-xl border bg-card p-5 sm:p-6">
      <h3 className="flex items-center gap-2 text-base text-brand-ink">
        <AlertTriangle className="h-4 w-4 text-brand-withheld" aria-hidden="true" />
        {t('ret.heading')}
      </h3>

      <p className="text-sm text-muted-foreground">
        {overdue
          ? t('ret.overdue', { days: String(Math.abs(view.daysLeft)) })
          : t(view.daysLeft === 0 ? 'ret.p1Today' : view.daysLeft === 1 ? 'ret.p1One' : 'ret.p1',
            { tier: view.tierLabel, days: String(view.daysLeft) })}
      </p>

      {/* THE FIGURE, AND THE ROUTE TO PAYING IT. Priced at the RETURNING tier's rate, which is
          what `catchUpQuote` was given `withheld_from_tier` for. `formatPlatformMoney` and not
          the family's own currency: this is what they owe GENORRA. */}
      <p className="text-sm text-muted-foreground">
        {t('ret.keep', {
          tier: view.tierLabel,
          months: String(view.monthsAway),
          amount: formatPlatformMoney(view.catchUpCents, intl),
        })}
      </p>

      <div className="space-y-2 border-t pt-4">
        <h4 className="text-sm font-medium text-foreground">{t('ret.freshHeading')}</h4>
        <p className="text-sm text-muted-foreground">{t('ret.fresh')}</p>
        {/* THE IRREVERSIBILITY, ON THE SCREEN AS WELL AS IN BOTH EMAILS. The brief asks for it
            in those words and asks twice, which is how a requirement survives a summary. */}
        <p className="text-sm text-brand-withheld">{t('ret.irreversible')}</p>

        {!sent ? (
          <Button variant="outline" onClick={ask} disabled={pending} className="gap-2">
            <Trash2 className="h-4 w-4" aria-hidden="true" />
            {t('ret.freshButton')}
          </Button>
        ) : (
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">
              {t('ret.codeSent', { email: sent.email, minutes: String(sent.minutes) })}
            </p>

            {/* WHAT WILL GO, counted by the function that will do it. */}
            {Object.keys(sent.counts).length > 0 && (
              <div className="space-y-1">
                <p className="text-sm font-medium text-foreground">{t('ret.willDelete')}</p>
                <ul className="text-sm text-muted-foreground">
                  {Object.entries(sent.counts).map(([table, n]) => (
                    <li key={table}>{t('ret.rows', { n: String(n), table })}</li>
                  ))}
                </ul>
              </div>
            )}

            <div className="max-w-xs space-y-1.5">
              <Label htmlFor="fresh-code" required>{t('ret.codeLabel')}</Label>
              <Input
                id="fresh-code"
                inputMode="numeric"
                autoComplete="one-time-code"
                maxLength={6}
                value={code}
                onChange={e => setCode(e.target.value.replace(/\D/g, ''))}
              />
            </div>

            <Button
              variant="destructive"
              onClick={confirm}
              disabled={pending || code.length !== 6}
              className="gap-2"
            >
              <Trash2 className="h-4 w-4" aria-hidden="true" />
              {t('ret.confirmButton')}
            </Button>
          </div>
        )}

        <FormError message={error} />
      </div>
    </div>
  )
}
