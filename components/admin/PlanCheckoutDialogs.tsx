'use client'

import { useState } from 'react'
import { CalendarClock, CreditCard } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Dialog } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { formatCurrency } from '@/lib/currency-utils'
import { formatDate } from '@/lib/date-utils'
import {
  MAX_PREPAY_MONTHS, PREPAY_PRESET_MONTHS, addDays, initialChargeOptions, isPrepayMonths,
  prepaidChargeCents, prepayQuoteCents, upgradeQuote, type UpgradeQuote,
} from '@/lib/platform-billing'
import { TIER_LABEL, type FamilyTier } from '@/lib/tiers'
import { cn } from '@/lib/utils'
import { useIntlTag, useT } from '@/components/layout/LocaleProvider'

/**
 * The two dialogs that start a payment: buying a plan, and upgrading one already paid for.
 *
 * ── WHY THEY LEFT `BillingPanel.tsx` ON 2026-08-25 ─────────────────────────────────
 * Both were defined inside that file while it owned the buy buttons. The buttons moved onto
 * the plan rows they buy (`PlanPanel`), so the dialogs moved with them — a dialog belongs to
 * whatever opens it, and leaving them behind would have made the Billing pane import a
 * component only the Plan pane renders. `BillingPanel` is now the RECORD and starts no
 * purchase at all; `components/admin/family-settings.ts` argues the split.
 *
 * ── NEITHER OF THEM CHARGES ANYTHING ───────────────────────────────────────────────
 * They collect a CHOICE and hand it back. The caller passes it to `startPlanCheckout` or
 * `changePlanTier`, which either opens a hosted Stripe page or — when there is genuinely
 * nothing to pay — writes the record directly. Nothing here takes a card number, and the tier
 * still moves only when a webhook says the money moved.
 *
 * ── EVERY FIGURE COMES FROM THE PURE MODULE, NEVER FROM ARITHMETIC HERE ────────────
 * `prepayQuoteCents`, `prepaidChargeCents`, `initialChargeOptions` and `upgradeQuote` are the
 * same functions the server actions and the webhook call. A price computed independently in
 * the browser is how a checkout comes to ask for something the button did not promise.
 */

/**
 * The day the family next has to pay, given a term ending on `paidThrough`.
 *
 * ── IT IS THE DAY AFTER THE TERM, AND THAT OFF-BY-ONE IS THE WHOLE FUNCTION ────────
 * `paid_through` is INCLUSIVE — the family owns that day — so the next payment is `+1`, not
 * the date itself. The same one-day shift is what `scheduleDowngrade` gets right on the
 * server, and TODO.md records that it is mutation-tested there precisely because getting it
 * wrong is a refund in the one direction this system does not move in.
 *
 * Null in, null out: a family with no term has no next payment date to name, and inventing
 * one would be worse than the em-dash.
 */
function nextPaymentDate(paidThrough: string | null | undefined, intl: string): string | null {
  return paidThrough ? formatDate(addDays(paidThrough, 1), intl) : null
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
export function BuyDialog({
  tier, purchasable, extendingLiveTerm, today, onClose, onBuy,
}: {
  tier: FamilyTier
  purchasable: { recurring: boolean; prepaid: boolean }
  /** A live paid term is being extended, so the current month is already owned. */
  extendingLiveTerm: boolean
  /** Resolved on the SERVER. See the note on the prop in `BillingPanel`. */
  today: string
  onClose: () => void
  onBuy: (
    mode: 'recurring' | 'prepaid',
    months: number,
    firstPayment: 'remainder' | 'remainder-plus-next',
  ) => void
}) {
  const intl = useIntlTag()
  const t = useT()
  const [months, setMonths] = useState(6)
  const monthly = prepayQuoteCents(tier, 1)
  const options = initialChargeOptions(tier, today)
  const prepaid = prepaidChargeCents({
    tier, months: isPrepayMonths(months) ? months : 1, today, extendingLiveTerm,
  })

  // THE DATE, NOT "the 1st". Both are true and only one of them can be checked against a
  // calendar without doing arithmetic — which is the whole complaint this screen collected.
  // `nextBillingDate` is computed by the same function that quotes the part month, so the day
  // named here is the day the proration was measured to.
  const firstRenewal = formatDate(options.nextBillingDate, intl)
  const combinedThrough = formatDate(options.remainderPlusNextThrough, intl)
  const afterCombined = nextPaymentDate(options.remainderPlusNextThrough, intl)

  return (
    <Dialog open onClose={onClose} title={`Pay for ${TIER_LABEL[tier]}`}>
      <div className="space-y-5">
        {purchasable.recurring && (
          <section className="space-y-3">
            <h4 className="text-sm font-semibold">{t('chk.monthly')}</h4>
            <p className="text-sm text-muted-foreground">
              {monthly != null ? formatCurrency(monthly, intl) : '—'} a month, taken on the 1st, until
              you stop it. Change or stop it whenever — what you have already paid for stays
              open.
            </p>

            {/* ── THE FIRST PAYMENT IS NOT A FULL MONTH, AND IT SAYS SO ────────────────
                Every family bills on the 1st, so the first charge is the rest of THIS month
                prorated by the day. That is the one thing about this model somebody has to be
                told before they press the button, or the amount on their card statement is a
                number they did not expect. Both options name their figure and their date. */}
            {extendingLiveTerm
              ? (
                <p className="text-sm text-muted-foreground">{t('adm.billingStartsWhenTerm')}</p>
              )
              : (
                <div className="space-y-2">
                  {options.remainderOnly != null && (
                    <Button
                      variant="affirm"
                      className="w-full justify-start"
                      onClick={() => onBuy('recurring', 1, 'remainder')}
                    >
                      <CreditCard className="h-4 w-4" />
                      Pay {formatCurrency(options.remainderOnly, intl)} for the{' '}
                      {options.daysLeft} day{options.daysLeft === 1 ? '' : 's'} left this month
                    </Button>
                  )}
                  <Button
                    variant={options.remainderOnly == null ? 'affirm' : 'outline'}
                    className="w-full justify-start"
                    onClick={() => onBuy('recurring', 1, 'remainder-plus-next')}
                  >
                    <CreditCard className="h-4 w-4" />
                    Pay{' '}
                    {options.remainderPlusNext != null
                      ? formatCurrency(options.remainderPlusNext, intl)
                      : ''}{' '}
                    for the rest of this month and next
                  </Button>
                  <p className="text-xs text-muted-foreground">
                    {options.remainderOnly == null
                      // NOT "invalid amount". The remainder alone is below the smallest charge
                      // a card network will take, which is an ordinary state at the end of a
                      // month on the cheaper plans — so it is explained rather than hidden.
                      ? `Only ${options.daysLeft} day${options.daysLeft === 1 ? '' : 's'} are left this month, which is too small a charge to take on its own — so the first payment covers ${combinedThrough ? `through ${combinedThrough}` : 'next month too'}. The next payment is then ${afterCombined ?? 'on the 1st'}.`
                      : `Either way, every payment after the first is on the 1st — the next one ${firstRenewal ? `is ${firstRenewal}` : 'is the 1st of next month'}.`}
                  </p>
                </div>
              )}
          </section>
        )}

        {purchasable.prepaid && (
          <section className={cn('space-y-2', purchasable.recurring && 'border-t pt-5')}>
            <h4 className="text-sm font-semibold">{t('chk.inAdvance')}</h4>
            <p className="text-sm text-muted-foreground">
              One payment covering the rest of this month plus whole months after it, up to{' '}
              {MAX_PREPAY_MONTHS}. Nothing renews it, so nothing is charged again until you
              choose to.
            </p>
            <div className="flex flex-wrap gap-1.5">
              {PREPAY_PRESET_MONTHS.map(n => (
                <Button
                  key={n}
                  variant={months === n ? 'secondary' : 'ghost'}
                  size="sm"
                  onClick={() => setMonths(n)}
                >
                  {n === 6 ? '6 months' : `${n} mo`}
                </Button>
              ))}
            </div>
            <div className="flex flex-wrap items-end gap-2">
              <div className="w-28">
                <Label htmlFor="prepay-months">{t('chk.months')}</Label>
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
                onClick={() => onBuy('prepaid', months, 'remainder')}
              >
                <CreditCard className="h-4 w-4" />
                Pay {prepaid ? formatCurrency(prepaid.totalCents, intl) : ''} now
              </Button>
            </div>
            {/* BOTH HALVES OF THE FIGURE. "Why is it not six times five?" has one answer and
                it is a part month nobody mentioned — so it is mentioned. */}
            {prepaid && prepaid.prorationCents > 0 && (
              <p className="text-xs text-muted-foreground">
                {formatCurrency(prepaid.prorationCents, intl)} for the {options.daysLeft} day
                {options.daysLeft === 1 ? '' : 's'} left this month, plus{' '}
                {formatCurrency(prepaid.monthsCents, intl)} for {prepaid.months} whole month
                {prepaid.months === 1 ? '' : 's'}.
              </p>
            )}
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

/**
 * Upgrading a family that paid in advance: what the unused term is worth, and the one choice.
 *
 * ── REBUILT 2026-08-25, BECAUSE TWO BUTTONS WITH TWO PRICES IS NOT A CHOICE ────────
 * It used to render both outcomes as two full-width buttons, each carrying its own figure,
 * with a paragraph underneath explaining that they cost the same. That is the layout arguing
 * with its own copy: two buttons showing different amounts read as two PRICES, so the note
 * saying "either way costs the same overall" is a correction to an impression the screen has
 * already made, and a family that takes the cheaper-looking one and is billed again a
 * fortnight later has been misled by a layout rather than by a sentence.
 *
 * It is a SELECTION now — pick the option, read what it does, then press one button. The
 * commitment is the same either way, so there is one commit control, and the difference
 * between the options is stated where the difference actually lives: the date the family next
 * has to pay.
 *
 * ── THE NEXT PAYMENT DATE IS THE ANSWER TO THE QUESTION THIS DIALOG IS ASKED ───────
 * "Upgrade to Premium: $0.00" is a sentence nobody believes, and the credit alone does not
 * fix it — what somebody is really asking is *when does the bill come*. Both options now name
 * that day, computed by `nextPaymentDate` from the quote's own `paidThrough`.
 *
 * ── AND IT NO LONGER PROMISES AN INVOICE ON THE 1ST, BECAUSE THERE IS NOT ONE ──────
 * The previous copy said the leftover credit would draw against "your invoice on the 1st" and
 * that "after that it is $X a month, on the 1st". Both describe a SUBSCRIPTION, and this path
 * does not create one: `upgradeFromPrepaid` writes `mode: 'prepaid'`, and a prepaid term
 * renews nothing — it simply ends. So the term end is named as a term end, and the credit is
 * described as what the server actually does with it (a customer credit balance at Stripe,
 * `recordStripeCredit`) rather than as a discount on a bill that never arrives.
 *
 * ── ONE SELECTOR IN BOTH DIRECTIONS, NOT A SECOND LAYOUT FOR THE ZERO CASE ────────
 * The interesting case is a credit that covers the rest of the month, where the first option
 * genuinely costs nothing. The same two options exist when it does not stretch that far —
 * settle now, or settle now and next month too — so the shape is the same and only the label
 * changes, from "Pay nothing now" to the figure. A second layout for the zero case would be
 * two renderings of one choice, which is how they come to disagree.
 *
 * ── NATIVE RADIOS, NOT `role="tab"` ────────────────────────────────────────────────
 * `MainRail` refuses `role="tablist"` for the reason that applies here too: the role promises
 * arrow-key roving focus and `aria-controls` wiring, and a screen reader changes its key
 * handling to match. These are real `<input type="radio">` in a `<fieldset>`, so arrow keys,
 * grouping and the accessible name come from the platform and nothing is claimed that is not
 * implemented. Same reasoning as the checkboxes in `PersonMultiSelect`.
 */
export function UpgradeDialog({
  fromTier, toTier, paidThrough, today, onClose, onUpgrade,
}: {
  fromTier: FamilyTier | null
  toTier: FamilyTier
  paidThrough: string | null
  today: string
  onClose: () => void
  onUpgrade: (includeNextMonth: boolean) => void
}) {
  const intl = useIntlTag()
  const t = useT()
  // `upgradeQuote` is called twice — once per shape — and it is the SAME pure function the
  // action and the webhook use. That is what makes the figure on the button the figure Stripe
  // asks for.
  const leave = upgradeQuote({ fromTier, toTier, paidThrough, today, includeNextMonth: false })
  const take = upgradeQuote({ fromTier, toTier, paidThrough, today, includeNextMonth: true })

  // DEFAULTS TO THE CHEAPER-TODAY OPTION, which is also the one that changes least: the family
  // keeps its money and its credit, and can buy the next month whenever it likes. Defaulting
  // to the larger charge would be the product choosing to take more today than it has to.
  const [includeNext, setIncludeNext] = useState(false)

  // Hooks first: `upgradeQuote` returns null for a tier with no price, and bailing before
  // `useState` would make the hook order depend on the props.
  if (!leave || !take) return null

  const chosen = includeNext ? take : leave
  const fromLabel = fromTier ? TIER_LABEL[fromTier] : 'current'

  return (
    <Dialog open onClose={onClose} title={`Upgrade to ${TIER_LABEL[toTier]}`}>
      <div className="space-y-5">
        {/* ── THE CHOICE ──────────────────────────────────────────────────────────────
            A `<fieldset>` so the two options are announced as one group with the legend as
            its name, and real radios so arrow keys work without this file implementing them.

            THE LEGEND IS `sr-only`, NOT DELETED. It read "How far ahead to pay" on screen and
            was removed on 2026-08-25 with the intro paragraph above it — two options with a
            price and a date on each are self-evidently a choice, and a heading saying so is
            the furniture the app-wide lede sweep was clearing. But a `<fieldset>` with no
            `<legend>` has no accessible name, so the grouping stops being announced and the
            two radios read as loose controls. Hiding it visually keeps the semantics and
            costs the screen nothing.

            WHAT THE DELETED PARAGRAPH SAID, and where it went: that the unused term is worth
            `creditCents` and is spent on the new tier first. The `<dl>` below states the same
            figure as a line item — "Your Standard term, unused  −$12.90" — against the two
            numbers it is subtracted from, which is where somebody checking the arithmetic
            wants it. Nothing was lost; a summary of a table sitting above the table went. */}
        <fieldset className="space-y-2">
          <legend className="sr-only">{t('chk.howFar')}</legend>
          <UpgradeOption
            id="upgrade-leave"
            selected={!includeNext}
            onSelect={() => setIncludeNext(false)}
            title={leave.dueNowCents === 0 ? t('chk.payNothing') : `Pay ${formatCurrency(leave.dueNowCents, intl)} now`}
            summary={`${TIER_LABEL[toTier]} through the end of this month.`}
            quote={leave}
          />
          <UpgradeOption
            id="upgrade-take"
            selected={includeNext}
            onSelect={() => setIncludeNext(true)}
            title={take.dueNowCents === 0
              ? t('chk.coverNext')
              : `Cover next month too — ${formatCurrency(take.dueNowCents, intl)}`}
            summary={`${TIER_LABEL[toTier]} through the end of next month.`}
            quote={take}
          />
        </fieldset>

        {/* THE WORKINGS FOR WHATEVER IS SELECTED, as three lines rather than one total. An
            administrator about to explain this to a treasurer needs the three figures, not the
            conclusion — and they have to follow the selection, or the panel would be showing
            the arithmetic of an option nobody picked. */}
        <dl className="space-y-1 rounded-lg border bg-muted/30 p-3 text-sm">
          <div className="flex justify-between gap-4">
            <dt className="text-muted-foreground">
              {includeNext ? t('chk.thisAndNext') : t('chk.restOfMonth')} at {TIER_LABEL[toTier]}
            </dt>
            <dd>{formatCurrency(chosen.neededCents, intl)}</dd>
          </div>
          <div className="flex justify-between gap-4">
            <dt className="text-muted-foreground">Your {fromLabel} term, unused</dt>
            <dd>&minus;{formatCurrency(chosen.creditCents, intl)}</dd>
          </div>
          <div className="flex justify-between gap-4 border-t pt-1 font-medium">
            <dt>{t('chk.dueNow')}</dt>
            <dd>{formatCurrency(chosen.dueNowCents, intl)}</dd>
          </div>
          {chosen.creditLeftCents > 0 && (
            <div className="flex justify-between gap-4 text-muted-foreground">
              <dt>{t('chk.leftOver')}</dt>
              <dd>{formatCurrency(chosen.creditLeftCents, intl)}</dd>
            </div>
          )}
        </dl>

        <Button
          variant="affirm"
          className="w-full justify-center"
          onClick={() => onUpgrade(includeNext)}
        >
          <CreditCard className="h-4 w-4" />
          {chosen.dueNowCents === 0
            ? `Upgrade to ${TIER_LABEL[toTier]} — nothing to pay`
            : `Upgrade to ${TIER_LABEL[toTier]} — pay ${formatCurrency(chosen.dueNowCents, intl)}`}
        </Button>

        {/* THE SAME MONEY, SAID OUT LOUD — and one sentence, since 2026-08-25. It carried two
            more clauses (that nothing renews a prepaid term, and that every record is kept
            either way); both are true, neither is about the choice being made here, and each
            is already on the Billing pane and in `family-settings#billing`. The one thing a
            reader needs at the moment of choosing is that neither option is cheaper. */}
        <p className="text-xs text-muted-foreground">
          {t('chk.sameOverall')}
        </p>
      </div>
    </Dialog>
  )
}

/**
 * One selectable outcome, stating the two dates that distinguish it from the other.
 *
 * THE WHOLE `<label>` IS THE TARGET, which is what makes this usable on a phone: a 16px radio
 * beside three lines of text is the wrong hit area for a control that decides a payment. The
 * radio is a real one and is kept in the DOM rather than hidden with `display: none`, because
 * a hidden input is not focusable and the keyboard selection would go with it.
 */
function UpgradeOption({ id, selected, onSelect, title, summary, quote }: {
  id: string
  selected: boolean
  onSelect: () => void
  title: string
  summary: string
  quote: UpgradeQuote
}) {
  const intl = useIntlTag()
  const through = formatDate(quote.paidThrough, intl)
  const next = nextPaymentDate(quote.paidThrough, intl)

  return (
    <label
      htmlFor={id}
      className={cn(
        'flex cursor-pointer gap-3 rounded-xl border p-3 transition-colors',
        selected
          ? 'border-2 border-brand-primary/40 bg-brand-soft/40'
          : 'border-dashed hover:bg-muted/40',
      )}
    >
      <input
        id={id}
        type="radio"
        name="upgrade-span"
        className="mt-1 h-4 w-4 shrink-0 accent-[var(--brand-primary)]"
        checked={selected}
        onChange={onSelect}
      />
      <span className="min-w-0 space-y-1">
        <span className="block text-sm font-medium">{title}</span>
        <span className="block text-sm text-muted-foreground">{summary}</span>
        {/* THE TWO DATES. `through` is what has been bought; `next` is when the family has to
            act again, and it is the one people came for — so it is the one that gets the
            calendar glyph and the emphasis. */}
        <span className="flex flex-wrap items-center gap-x-3 gap-y-1 pt-0.5 text-xs text-muted-foreground">
          {through && <span>Paid through {through}</span>}
          {next && (
            <span className="inline-flex items-center gap-1 font-medium text-brand-ink">
              <CalendarClock className="h-3 w-3" aria-hidden="true" />
              Next payment {next}
            </span>
          )}
        </span>
      </span>
    </label>
  )
}
