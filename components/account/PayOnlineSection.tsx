'use client'

import { useMemo, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { CreditCard, Repeat } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useConfirm } from '@/components/ui/confirm'
import { FieldError, FormError } from '@/components/ui/form-message'
import { formatCurrency } from '@/lib/currency-utils'
import {
  cancelDuesAutopay, startDuesAutopay, startDuesCheckout, type DuesOnlineStatus,
} from '@/app/actions/pay-dues'
import type { DuesSummary } from '@/app/actions/dues'

/**
 * Paying a due with a card — the member's half of the family's Stripe connection.
 *
 * ── A SECTION BELOW THE TABLE, NOT A SEVENTH COLUMN ─────────────────────────────────
 * `DuesPlanSection`'s table already carries six columns and folds four of them below `sm`
 * (AGENTS.md, "On a phone a table narrows"). A control column would have to fold by MOVING its
 * control into the first cell's meta line, and a Pay button plus an amount field plus an
 * autopay toggle is not a thing that fits in a meta line — it is a form. So the table keeps
 * answering *what do I owe* and this answers *pay it*, which is also the order somebody reads
 * them in.
 *
 * ── IT RENDERS NOTHING UNLESS THE FAMILY CAN ACTUALLY TAKE A CARD ───────────────────
 * `online.chargesReady` comes from `card_payments.status === 'active'` on the family's own
 * connected account. A member of a family that has not connected one, or whose account is still
 * under review, sees no section at all rather than a button that fails at the till — which is
 * the whole reason that flag is a capability status and not `charges_enabled`.
 *
 * ── THE AMOUNT IS PREFILLED AND EDITABLE, AND BOUNDED ON THE SERVER ────────────────
 * Prefilled with what the schedule says is due NOW (`nextInstallmentCents`, which is larger
 * than an installment when the member is behind — `lib/dues-utils.ts` §7c) and editable,
 * because a member paying a due off entirely is an ordinary thing to want. The ceiling shown
 * here is a courtesy; `startDuesCheckout` recomputes it from `duesPlanMath` and refuses
 * anything above it, because this field is a browser input and the action is a public endpoint.
 */
export function PayOnlineSection({
  summary, online,
}: {
  summary: DuesSummary[]
  online: DuesOnlineStatus
}) {
  const payable = useMemo(
    // Dues only, still owed, and not declined. A donation is given from the Donations pane and
    // has no balance to settle; an opted-out due is one the member has said they will not pay,
    // so offering a card form for it would be arguing with them.
    () => summary.filter(s =>
      s.schedule.kind === 'dues'
      && !s.optedOut
      && !s.ageExempt
      && s.remainingBalanceCents > 0),
    [summary],
  )

  if (!online.chargesReady) return null
  if (payable.length === 0) return null

  return (
    <section className="space-y-3">
      <div>
        <h2 className="text-lg font-semibold text-brand-ink">Pay online</h2>
        <p className="text-sm text-muted-foreground">
          Paid by card straight to your family. It posts to the family&rsquo;s books the moment
          it clears — there is nothing for anyone to key in afterwards.
        </p>
      </div>

      <div className="space-y-3">
        {payable.map(row => (
          <PayRow
            key={row.schedule.id}
            row={row}
            autopay={online.autopay.find(a => a.scheduleId === row.schedule.id) ?? null}
          />
        ))}
      </div>
    </section>
  )
}

function PayRow({
  row, autopay,
}: {
  row: DuesSummary
  autopay: DuesOnlineStatus['autopay'][number] | null
}) {
  const router = useRouter()
  const confirm = useConfirm()
  const [pending, startTransition] = useTransition()
  const [error, setError] = useState('')
  const [amountError, setAmountError] = useState('')

  // Prefilled from what is due now and NOT re-clamped here. `nextInstallmentCents` is already
  // clamped to the remaining balance by `duesPlanMath`, and clamping a second time is how two
  // figures on one screen come to disagree — the rule that field's own doc comment states.
  const [amount, setAmount] = useState(() => (row.nextInstallmentCents / 100).toFixed(2))

  const owed = row.remainingBalanceCents
  const cadence = row.cadence

  const pay = () => {
    setError('')
    setAmountError('')
    // Parsed rather than trusted, and the SAME refusal the server gives, so somebody who has
    // typed something impossible finds out before a redirect rather than after.
    const cents = Math.round(Number(amount) * 100)
    if (!Number.isFinite(cents) || cents <= 0) {
      setAmountError('Enter an amount to pay.')
      return
    }
    if (cents > owed) {
      setAmountError(`The most that can be paid on this due is ${formatCurrency(owed)}.`)
      return
    }
    startTransition(async () => {
      const result = await startDuesCheckout({ scheduleId: row.schedule.id, amountCents: cents })
      if (!result.success) {
        setError(result.message)
        return
      }
      // Stripe's hosted page, in this tab. A Checkout Session is single-use and expires, so a
      // tab left open holds a link that may already be spent — and the member has to come back
      // here afterwards anyway, which `success_url` handles.
      window.location.href = result.url
    })
  }

  const setUpAutopay = () => {
    setError('')
    startTransition(async () => {
      const result = await startDuesAutopay({ scheduleId: row.schedule.id })
      if (!result.success) {
        setError(result.message)
        return
      }
      window.location.href = result.url
    })
  }

  const stopAutopay = async () => {
    const ok = await confirm({
      title: 'Stop automatic payments?',
      description: `No further card payments will be taken for ${row.schedule.label}. Everything you have already paid stays on your record.`,
      confirmLabel: 'Stop payments',
    })
    if (!ok) return
    startTransition(async () => {
      const result = await cancelDuesAutopay({ scheduleId: row.schedule.id })
      if (!result.success) {
        setError(result.message)
        return
      }
      router.refresh()
    })
  }

  return (
    <div className="rounded-xl border bg-card p-4 space-y-3">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <p className="font-medium">{row.schedule.label}</p>
        <p className="text-sm text-muted-foreground">
          {formatCurrency(owed)} outstanding
        </p>
      </div>

      {/* ── ONE-OFF ─────────────────────────────────────────────────────────────── */}
      <div className="flex flex-wrap items-end gap-2">
        <div className="w-32">
          <Label htmlFor={`pay-${row.schedule.id}`}>Amount</Label>
          <Input
            id={`pay-${row.schedule.id}`}
            type="number"
            min="0.01"
            step="0.01"
            max={(owed / 100).toFixed(2)}
            value={amount}
            onChange={e => setAmount(e.target.value)}
            disabled={pending}
          />
        </div>
        <Button variant="affirm" onClick={pay} disabled={pending}>
          <CreditCard className="h-4 w-4" />
          {pending ? 'Opening…' : 'Pay by card'}
        </Button>
      </div>
      {/* Under the field it is about, per form-message.tsx: this is ONE INPUT being wrong. */}
      <FieldError message={amountError} />

      {/* ── RECURRING ───────────────────────────────────────────────────────────── */}
      {autopay
        ? (
          <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-brand-soft/50 px-3 py-2">
            <p className="text-sm text-brand-on-soft">
              Paying {formatCurrency(autopay.amountCents)} {autopay.cadence} by card
              {autopay.currentPeriodEnd ? `, next on ${autopay.currentPeriodEnd}` : ''}.
            </p>
            <Button variant="outline" size="sm" onClick={stopAutopay} disabled={pending}>
              Stop
            </Button>
          </div>
        )
        : cadence === 'one-time'
          ? (
            // NOT A DISABLED BUTTON WITH NO EXPLANATION. Autopay follows the cadence the member
            // already chose for this due (`setMyDuesPlan`), and there is nothing to renew on a
            // one-off — so this names the control that fixes it rather than offering one that
            // would be refused.
            <p className="text-xs text-muted-foreground">
              Pick how often you want to pay this due, above, to set up automatic payments.
            </p>
          )
          : (
            <Button variant="outline" size="sm" onClick={setUpAutopay} disabled={pending}>
              <Repeat className="h-4 w-4" />
              Pay {formatCurrency(row.installmentCents)} {cadence} automatically
            </Button>
          )}

      {/* The refused OPERATION, beside the button that caused it. */}
      <FormError message={error} />
    </div>
  )
}
