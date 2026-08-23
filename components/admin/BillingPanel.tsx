'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { CalendarClock, CreditCard, ExternalLink, Receipt } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Dialog } from '@/components/ui/dialog'
import { useConfirm } from '@/components/ui/confirm'
import { FormError } from '@/components/ui/form-message'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { formatCurrency } from '@/lib/currency-utils'
import {
  MAX_PREPAY_MONTHS, PREPAY_PRESET_MONTHS, isPrepayMonths, prepayQuoteCents,
} from '@/lib/platform-billing'
import { TIER_LABEL, TIERS, type FamilyTier } from '@/lib/tiers'
import {
  cancelPlanRenewal, changePlanTier, openBillingPortal, startPlanCheckout,
  type PlatformBilling,
} from '@/app/actions/billing'
import { cn } from '@/lib/utils'

/**
 * Settings → Plan: what this family PAYS, beneath what the plans ARE.
 *
 * ── WHY IT IS A SECOND PANEL AND NOT A CHANGE TO `PlanPanel` ────────────────────────
 * `PlanPanel` answers *what do the four plans include* — it is a catalogue, it renders for
 * anybody who can open Settings, and its buttons move `families.tier` with nothing charged.
 * This answers *what have we paid, until when, and what happens next*, which is a different
 * question with a different audience and a different failure mode. Folding money into the
 * catalogue would have put a checkout inside a component whose job is to explain.
 *
 * They are stacked rather than merged, and the boundary is worth keeping: a plan row above
 * says what Plus is; a term below says the family has it until the 31st of December.
 *
 * ── THE SCAFFOLDING BUTTONS ABOVE STILL EXIST, AND NOW DEFER TO THIS ────────────────
 * `setFamilyTier` has moved the tier with nothing charged since 2026-08-13, and it still does
 * for a family that has never paid. Once a paid term is live it REFUSES and points here —
 * otherwise an administrator could move down by hand on Tuesday, keep every page (nothing
 * revokes anything until the term ends), and have the sweep put them back on Wednesday. Two
 * doors into one column, only one of which has money behind it.
 *
 * ── NOTHING ON THIS PANEL GRANTS ANYTHING ───────────────────────────────────────────
 * Every button either opens a hosted Stripe page or records a PROMISE. The tier moves when a
 * webhook says the money moved, and when a term ends — never when somebody presses a button
 * here. `lib/stripe/platform-events.ts` is where that happens and
 * `app/actions/billing.ts`'s header argues why it has to be there.
 */
export function BillingPanel({ billing }: { billing: PlatformBilling | null }) {
  const router = useRouter()
  const confirm = useConfirm()
  const [pending, startTransition] = useTransition()
  const [error, setError] = useState('')
  const [buying, setBuying] = useState<FamilyTier | null>(null)

  // §8: null is a refused or failed read, not "this family has never paid". Saying so beats
  // rendering an empty billing panel over a live subscription.
  if (!billing) {
    return (
      <p className="text-sm text-muted-foreground">
        Billing could not be loaded. Refresh the page — do not start a new payment until it
        appears, in case this family already has one.
      </p>
    )
  }

  // Nothing is purchasable on this deployment. Not an error and not worth a red box: a
  // developer laptop and every preview build is in this state by design.
  const anySold = TIERS.some(t => billing.purchasable[t].recurring || billing.purchasable[t].prepaid)
  if (!anySold) {
    return (
      <div className="space-y-2">
        <h3 className="text-sm font-semibold text-brand-ink">Billing</h3>
        <p className="text-sm text-muted-foreground">
          {billing.unavailable
            ?? 'Paid plans are not on sale yet. The plan above can still be changed and nothing is charged for it.'}
        </p>
      </div>
    )
  }

  const run = (
    action: () => Promise<{ success: boolean; message?: string; url?: string }>,
  ) => startTransition(async () => {
    setError('')
    const result = await action()
    if (!result.success) {
      setError(result.message ?? 'Something went wrong.')
      return
    }
    if (result.url) {
      window.location.href = result.url
      return
    }
    router.refresh()
  })

  const term = billing.paidEntitlement

  return (
    <div className="space-y-4">
      <h3 className="text-sm font-semibold text-brand-ink">Billing</h3>

      {/* ── WHAT IS PAID FOR, AND WHAT HAPPENS NEXT ─────────────────────────────────
          Three facts, and each is a column rather than a sentence because an
          administrator scans this rather than reading it. */}
      <div className="grid gap-3 rounded-lg border bg-muted/30 p-4 text-sm sm:grid-cols-3">
        <div>
          <p className="text-xs uppercase tracking-wide text-muted-foreground">Paid plan</p>
          <p className="font-medium">
            {billing.paidTier ? TIER_LABEL[billing.paidTier] : 'None — on the free plan'}
          </p>
        </div>
        <div>
          <p className="text-xs uppercase tracking-wide text-muted-foreground">Paid through</p>
          <p className="font-medium">{billing.paidThrough ?? '—'}</p>
          {/* LAPSED IS ITS OWN SENTENCE, and `--brand-withheld` rather than
              `--destructive`: a term running out is not an error and nothing has been
              deleted. It is the same reading the dues ladder takes of a missed
              installment. */}
          {term.lapsed && (
            <p className="text-xs text-brand-withheld">
              This term has ended. Pay again to reopen the pages it covered — every record is
              still here.
            </p>
          )}
        </div>
        <div>
          <p className="text-xs uppercase tracking-wide text-muted-foreground">How it renews</p>
          <p className="font-medium">
            {billing.mode === 'recurring'
              ? billing.cancelAtPeriodEnd ? 'Monthly — stopping at the end of this period' : 'Monthly'
              : billing.mode === 'prepaid' ? 'Paid in advance — nothing renews it' : '—'}
          </p>
        </div>
      </div>

      {/* A SCHEDULED CHANGE IS THE THING SOMEBODY CAME HERE TO CHECK, so it gets its own
          band rather than a line in the grid. It also states the no-refund rule at the one
          moment it is relevant. */}
      {billing.scheduledTier && billing.scheduledTierOn && (
        <div className="flex items-start gap-2 rounded-lg border border-brand-warm bg-brand-warm/10 p-3 text-sm text-brand-warm">
          <CalendarClock className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
          <p>
            Moving to <strong>{TIER_LABEL[billing.scheduledTier]}</strong> on{' '}
            <strong>{billing.scheduledTierOn}</strong>. Nothing changes before then, and there is
            no refund for the rest of this period — that is what keeps the pages open until it
            ends.
          </p>
        </div>
      )}

      {/* ── A FAILED CARD IS REPORTED AND NOTHING ELSE HAPPENS ──────────────────────
          `invoice.payment_failed` stamps the date and the product does not act on it: Stripe
          retries a failed card for days, so a family whose payment fails on Tuesday and
          succeeds on Thursday must not lose their pages in between. What the product SHOULD do
          about a family two weeks past due is a decision nobody has taken — TODO.md carries it
          — so this band says what is true and asks the family to fix the card.

          `--brand-withheld` rather than `--destructive`, deliberately: nothing has failed on
          the family's side of the screen, nothing is deleted, and the pages are still open. */}
      {billing.delinquentSince && (
        <div className="flex items-start gap-2 rounded-lg border border-brand-warm bg-brand-warm/10 p-3 text-sm text-brand-warm">
          <CreditCard className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
          <p>
            A card payment has been failing since <strong>{billing.delinquentSince}</strong>.
            Nothing has changed about what this family can reach. Update the card under{' '}
            <em>Cards and receipts</em> and Stripe will try again.
          </p>
        </div>
      )}

      {/* ── BUYING ──────────────────────────────────────────────────────────────────
          One button per tier the deployment can actually sell, per §5's shape: the page
          resolved which those are on the server and this renders only those. */}
      {billing.canManage && (
        <div className="space-y-2">
          <div className="flex flex-wrap gap-2">
            {TIERS.filter(t => t !== 'free').map(tier => {
              const buyable = billing.purchasable[tier]
              if (!buyable.recurring && !buyable.prepaid) return null
              const isCurrent = billing.paidTier === tier && !term.lapsed
              return (
                <Button
                  key={tier}
                  variant={isCurrent ? 'outline' : 'affirm'}
                  disabled={pending}
                  onClick={() => {
                    // An EXISTING monthly plan changes tier through Stripe rather than
                    // through a second checkout — `changePlanTier` prorates an upgrade and
                    // schedules a downgrade. A family with no subscription buys.
                    if (billing.mode === 'recurring' && billing.subscriptionStatus && !isCurrent) {
                      run(() => changePlanTier(tier))
                      return
                    }
                    setBuying(tier)
                  }}
                >
                  <CreditCard className="h-4 w-4" />
                  {isCurrent ? `Extend ${TIER_LABEL[tier]}` : `Pay for ${TIER_LABEL[tier]}`}
                </Button>
              )
            })}
          </div>

          <div className="flex flex-wrap gap-2">
            {billing.mode === 'recurring' && !billing.cancelAtPeriodEnd && (
              <Button
                variant="outline"
                size="sm"
                disabled={pending}
                onClick={async () => {
                  const ok = await confirm({
                    title: 'Stop the monthly plan?',
                    description:
                      'Every page stays open until the end of the period you have already paid for, and every record is kept afterwards. There is no refund for the rest of this period.',
                    confirmLabel: 'Stop renewing',
                  })
                  if (ok) run(cancelPlanRenewal)
                }}
              >
                Stop renewing
              </Button>
            )}
            {/* Stripe's own portal: cards, invoices, receipts. It deliberately does NOT
                control the tier — the no-refund and scheduled-downgrade rules are ours, and
                the portal's own plan switcher knows nothing about them. */}
            <Button variant="outline" size="sm" disabled={pending} onClick={() => run(openBillingPortal)}>
              <ExternalLink className="h-4 w-4" />
              Cards and receipts
            </Button>
          </div>

          <FormError message={error} />
        </div>
      )}

      {!billing.canManage && (
        <p className="text-xs text-muted-foreground">
          You can see what this family pays but not change it. Ask an administrator with
          Settings access.
        </p>
      )}

      {/* ── WHAT WE HAVE CHARGED ────────────────────────────────────────────────────
          GENORRA's receipts to the family, and deliberately not in any of the family's own
          money screens: `platform_payments` appears in no fund balance, no P&L and no dues
          projection, which 20260823000004's header argues at length. */}
      {billing.payments.length > 0 && (
        <details className="rounded-lg border bg-card">
          <summary className="cursor-pointer px-4 py-3 text-sm font-medium">
            <Receipt className="mr-2 inline h-4 w-4" aria-hidden="true" />
            What GENORRA has charged ({billing.payments.length})
          </summary>
          <ul className="divide-y border-t text-sm">
            {billing.payments.map(p => (
              <li key={p.id} className="flex flex-wrap items-baseline justify-between gap-2 px-4 py-2">
                <span>
                  {TIER_LABEL[p.tier]}
                  {p.months > 1 ? ` · ${p.months} months` : ''}
                  {p.coversThrough ? ` · through ${p.coversThrough}` : ''}
                </span>
                <span className="font-medium">{formatCurrency(p.amountCents)}</span>
              </li>
            ))}
          </ul>
        </details>
      )}

      {buying && (
        <BuyDialog
          tier={buying}
          purchasable={billing.purchasable[buying]}
          onClose={() => setBuying(null)}
          onBuy={(mode, months) => {
            setBuying(null)
            run(() => startPlanCheckout({ tier: buying, mode, months }))
          }}
        />
      )}
    </div>
  )
}

/**
 * Monthly, or N months in advance.
 *
 * ── "AS FAR AHEAD AS YOU LIKE" IS TWO MECHANISMS, NOT ONE ───────────────────────────
 * The presets here are buttons on a familiar set of terms. The hosted Stripe page then
 * carries `adjustable_quantity`, so a family that wants seven months types seven ON STRIPE'S
 * OWN PAGE — which is why the webhook reads the quantity back off the completed session and
 * never trusts the number this dialog sent. Building a stepper here would have been a second
 * place for that number to be decided.
 *
 * The quote is `prepayQuoteCents`, the same pure function the server uses, so the figure on the
 * button is the figure Stripe asks for. A price computed independently in the browser is how a
 * checkout comes to ask for something the button did not promise.
 */
function BuyDialog({
  tier, purchasable, onClose, onBuy,
}: {
  tier: FamilyTier
  purchasable: { recurring: boolean; prepaid: boolean }
  onClose: () => void
  onBuy: (mode: 'recurring' | 'prepaid', months: number) => void
}) {
  const [months, setMonths] = useState(12)
  const quote = prepayQuoteCents(tier, isPrepayMonths(months) ? months : 1)
  const monthly = prepayQuoteCents(tier, 1)

  return (
    <Dialog open onClose={onClose} title={`Pay for ${TIER_LABEL[tier]}`}>
      <div className="space-y-5">
        {purchasable.recurring && (
          <section className="space-y-2">
            <h4 className="text-sm font-semibold">Monthly</h4>
            <p className="text-sm text-muted-foreground">
              {monthly != null ? formatCurrency(monthly) : '—'} a month, renewing until you stop
              it. Change or stop it whenever — what you have already paid for stays open.
            </p>
            <Button variant="affirm" onClick={() => onBuy('recurring', 1)}>
              <CreditCard className="h-4 w-4" />
              Pay monthly
            </Button>
          </section>
        )}

        {purchasable.prepaid && (
          <section className={cn('space-y-2', purchasable.recurring && 'border-t pt-5')}>
            <h4 className="text-sm font-semibold">In advance</h4>
            <p className="text-sm text-muted-foreground">
              One payment covering however many months you like. Nothing renews it, so nothing
              is charged again until you choose to.
            </p>
            <div className="flex flex-wrap gap-1.5">
              {PREPAY_PRESET_MONTHS.map(n => (
                <Button
                  key={n}
                  variant={months === n ? 'secondary' : 'ghost'}
                  size="sm"
                  onClick={() => setMonths(n)}
                >
                  {n === 12 ? '1 year' : n === 24 ? '2 years' : n === 36 ? '3 years' : `${n} mo`}
                </Button>
              ))}
            </div>
            <div className="flex flex-wrap items-end gap-2">
              <div className="w-28">
                <Label htmlFor="prepay-months">Months</Label>
                <Input
                  id="prepay-months"
                  type="number"
                  min={1}
                  max={MAX_PREPAY_MONTHS}
                  value={months}
                  onChange={e => setMonths(Number(e.target.value))}
                />
              </div>
              <Button
                variant="affirm"
                disabled={!isPrepayMonths(months)}
                onClick={() => onBuy('prepaid', months)}
              >
                <CreditCard className="h-4 w-4" />
                Pay {quote != null ? formatCurrency(quote) : ''} now
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              You can change the number of months on Stripe&rsquo;s page too — up to{' '}
              {MAX_PREPAY_MONTHS}.
            </p>
          </section>
        )}
      </div>
    </Dialog>
  )
}
