'use client'

import { useState, useTransition } from 'react'
import { HeartHandshake } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Dialog } from '@/components/ui/dialog'
import { FieldError, FormError } from '@/components/ui/form-message'
import { formatCurrency } from '@/lib/currency-utils'
import { startDonationCheckout } from '@/app/actions/pay-dues'
import { useIntlTag, useT } from '@/components/layout/LocaleProvider'

/**
 * Giving to one drive, by card.
 *
 * ── A CLIENT LEAF SO `DonationsSection` STAYS HOOK-FREE ────────────────────────────
 * That component has two callers on opposite sides of the boundary — [Summary](/accounting/summary)
 * renders it from a server component, and the Dues & Donations shell renders it inside a
 * `'use client'` tree. A component with no hooks and no handlers is usable from either, which
 * is the same property `NextInstallmentsCard` is built around and the reason the interactivity
 * lives down here rather than up there.
 *
 * ── THERE IS NO CEILING ON A GIFT, AND THAT IS THE DIFFERENCE FROM A DUE ──────────
 * The dues dialog prefills what is owed and refuses anything above it, because overpaying a
 * due leaves a credit this product has no concept of. A drive's goal is an advised target and
 * explicitly not a cap — `DonationSummary.progressPercent` is unclamped for exactly that
 * reason — so this field starts EMPTY and is bounded only by what Stripe will take.
 *
 * Empty rather than prefilled with the amount left to the goal: that figure would read as a
 * suggestion the family had made, and no family made it. What is left to the goal is shown
 * beside the field as context instead, where it informs without proposing.
 */
export function GiveButton({ scheduleId, label, toGoalCents }: {
  scheduleId: string
  label: string
  /** What is left before the goal is met, or null when there is no goal or it is met. */
  toGoalCents: number | null
}) {
  const intl = useIntlTag()
  const t = useT()
  const [open, setOpen] = useState(false)
  const [amount, setAmount] = useState('')
  const [pending, startTransition] = useTransition()
  const [error, setError] = useState('')
  const [amountError, setAmountError] = useState('')

  function give() {
    setError('')
    setAmountError('')
    // Parsed rather than trusted, and the SAME refusal the server gives, so somebody who has
    // typed something impossible finds out before a redirect rather than after.
    const cents = Math.round(Number(amount) * 100)
    if (!Number.isFinite(cents) || cents <= 0) {
      setAmountError(t('drives.needAmount'))
      return
    }
    startTransition(async () => {
      const result = await startDonationCheckout({ scheduleId, amountCents: cents })
      if (!result.success) { setError(result.message); return }
      // Stripe's hosted page, in this tab. A Checkout Session is single-use and expires, so a
      // tab left open holds a link that may already be spent — and the giver has to come back
      // here afterwards anyway, which `success_url` handles.
      window.location.href = result.url
    })
  }

  return (
    <>
      <Button size="sm" variant="affirm" onClick={() => setOpen(true)}>
        <HeartHandshake className="h-3.5 w-3.5" />
        {t('drives.give')}
      </Button>

      {open && (
        <Dialog
          open
          onClose={() => setOpen(false)}
          title={t('drives.giveTo', { label })}
          description={t('drives.giveHint')}
        >
          <div className="space-y-4">
            <div>
              <Label htmlFor={`give-${scheduleId}`} required>{t('money.amount')}</Label>
              <Input
                id={`give-${scheduleId}`}
                type="number"
                min="0.01"
                step="0.01"
                inputMode="decimal"
                placeholder="0.00"
                value={amount}
                onChange={e => setAmount(e.target.value)}
                disabled={pending}
                autoFocus
              />
              <p className="mt-1.5 text-xs text-muted-foreground">
                {toGoalCents != null
                  ? t('drives.wouldMeetGoal', {
                      amount: formatCurrency(toGoalCents, intl),
                    })
                  : t('drives.giveAnything')}
              </p>
            </div>

            {/* Under the field it is about, per form-message.tsx: this is ONE INPUT being wrong. */}
            <FieldError message={amountError} />
            {/* The refused OPERATION, beside the button that caused it. */}
            <FormError message={error} />

            <div className="flex flex-wrap justify-end gap-2">
              <Button variant="ghost" onClick={() => setOpen(false)} disabled={pending}>{t('action.cancel')}</Button>
              <Button variant="affirm" onClick={give} disabled={pending}>
                <HeartHandshake className="h-4 w-4" />
                {pending ? t('money.opening') : t('drives.giveByCard')}
              </Button>
            </div>
          </div>
        </Dialog>
      )}
    </>
  )
}
