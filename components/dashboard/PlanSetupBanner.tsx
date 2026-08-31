'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { CreditCard, Sparkles } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { FormError } from '@/components/ui/form-message'
import { dismissSignupPlan, startPlanCheckout } from '@/app/actions/billing'
import { TIER_PRICE, formatPlanPrice } from '@/lib/plans'
import { TIER_LABEL, type FamilyTier } from '@/lib/tiers'
import { useIntlTag, useT } from '@/components/layout/LocaleProvider'
import { InlineText } from '@/components/ui/inline-text'

/**
 * "You chose Standard when you signed up, and nobody has paid for it yet."
 *
 * ── WHY THE PRODUCT NEEDS THIS AT ALL ───────────────────────────────────────────────
 * `/pricing` sells Standard and Plus, and pressing either button cannot take a payment:
 * there is no family yet to be the Stripe customer, and registration ends without a session
 * because `enable_confirmations` is on. So the choice is recorded against the family and
 * offered again HERE, at the first moment there is somebody signed in with the grant to act
 * on it. Without this banner the plan somebody asked for on the marketing site is a row in a
 * table nobody ever sees, and the family is silently on Free.
 *
 * ── IT WAS A LINK UNTIL 2026-08-26, AND NOW IT IS A CHECKOUT ────────────────────────
 * **Pay Now** starts a real Stripe session from here. That reverses the previous decision, and
 * the previous reasoning is worth keeping because it names what this has to be careful about:
 * the plan panel on Family Settings offers monthly OR months-in-advance, and shows the
 * part-month arithmetic, so a button that skipped it was a second door into `startPlanCheckout`
 * with no way to choose either.
 *
 * What resolves that is picking the DEFAULT rather than removing the choice: **Pay Now** is
 * monthly, paying the rest of this month, which is the option the panel itself defaults to and
 * the one almost everybody wants. Buying months in advance is a deliberate thing somebody goes
 * looking for, so it keeps its own way through — the quiet link under the buttons, which lands
 * on the pane that can explain it.
 *
 * A family created three minutes ago, being asked to complete the one thing they already chose,
 * should not have to find a settings screen to do it.
 *
 * ── AND IT STILL SAYS THE FAMILY IS ON FREE, IN THOSE WORDS ─────────────────────────
 * The one thing this must never imply is that the plan is active or that money has been
 * taken. `families.tier` is Free until Stripe says otherwise — the webhook is the only writer,
 * and `app/actions/billing.ts` argues at length that the button press is not the payment — so
 * the copy leads with what is true today rather than with what was chosen.
 *
 * ── IT SITS ABOVE "FINISH YOUR PROFILE", SINCE 2026-08-26 ───────────────────────────
 * The page used to put it last, on the argument that the two banners above it are things the
 * MEMBER has not finished while this is a thing the FAMILY has not finished — and that the
 * product's first word to a new administrator should not be a request for money.
 *
 * That was the right instinct about the wrong reader. This banner only ever renders for
 * somebody who holds `admin/family:edit` AND whose family recorded a paid plan at signup: they
 * chose it, they are expecting to be charged, and the thing they are most likely to be looking
 * for on their first visit is where to finish it. Reported as: "when I finally logged in I
 * didn't get reminded or directed to complete the payment". A prompt nobody sees is not
 * restraint.
 */
export function PlanSetupBanner({ tier }: { tier: FamilyTier }) {
  const router = useRouter()
  const [dismissed, setDismissed] = useState(false)
  const t = useT()
  const intl = useIntlTag()
  const [error, setError] = useState('')
  const [isPending, startTransition] = useTransition()

  if (dismissed) return null

  const price = TIER_PRICE[tier]

  /**
   * Pay now — monthly, the rest of this month.
   *
   * `mode: 'recurring'` and `firstPayment: 'remainder'` are named EXPLICITLY rather than left
   * to the action's defaults. `startPlanCheckout` narrows both and would refuse an
   * unrecognised value, but a caller that relies on a default is a caller that changes
   * behaviour when the default does — and this one charges somebody money.
   */
  function handlePay() {
    setError('')
    startTransition(async () => {
      const result = await startPlanCheckout({
        tier,
        mode: 'recurring',
        firstPayment: 'remainder',
      })
      if (!result.success) {
        setError(result.message)
        return
      }
      // Stripe's hosted page, in this tab. A Checkout Session is single-use and expires, so a
      // tab left open holds a link that may already be spent — and they have to come back here
      // afterwards anyway, which `success_url` handles.
      window.location.href = result.url
    })
  }

  /**
   * Cancel — drop the plan the family asked for at signup.
   *
   * NO CONFIRMATION DIALOG, unlike the chapter banner next to it. That one writes a fact about
   * a person and moves other people's rows with it. This clears a prompt: nothing is bought,
   * nothing is cancelled at Stripe, the family stays exactly where it already is, and the plan
   * is still on sale two clicks away on the screen this links to. A dialog in front of a
   * reversible dismissal is the over-asking that teaches people to click through dialogs.
   *
   * OPTIMISTIC, and it re-checks: the row is hidden at once, and a refusal puts it back with
   * the reason. `router.refresh()` re-reads the server's answer so the banner does not
   * reappear on the next navigation.
   */
  function handleCancel() {
    setError('')
    setDismissed(true)
    startTransition(async () => {
      const result = await dismissSignupPlan()
      if (result.success) {
        router.refresh()
      } else {
        setDismissed(false)
        setError(result.message)
      }
    })
  }

  return (
    // `--brand-legacy` as the border and `bg-brand-soft` under `text-brand-on-soft`, the same
    // checked pair every other banner on this page uses. Gold is a SURFACE-or-accent role and
    // never carries text (2.30 against white), which is why it is only the rule here.
    <div className="flex gap-3 rounded-xl border border-brand-legacy/40 bg-brand-soft p-4">
      <div className="mt-0.5 shrink-0 self-start rounded-lg bg-brand-primary p-1.5 text-brand-on-primary">
        <Sparkles className="h-4 w-4" />
      </div>

      <div className="min-w-0 flex-1 space-y-3">
        <div>
          <p className="text-sm font-medium text-brand-on-soft">
            {t('dash.finishPayingFor', { plan: TIER_LABEL[tier] })}
          </p>
          <p className="mt-0.5 text-xs text-brand-on-soft/80">
            You chose {TIER_LABEL[tier]} when you created this family, and nothing has been
            charged — your family is on Free until the first payment goes through
            {price ? ' ' + t('bill.perMonthParen', { amount: formatPlanPrice(price.monthlyCents, intl) }) : ''}.
          </p>
        </div>

        <div className="flex flex-col gap-2 sm:flex-row">
          <Button size="sm" onClick={handlePay} disabled={isPending} className="shrink-0">
            <CreditCard className="h-4 w-4" />
            {isPending ? t('dash.plan.opening') : t('dash.plan.pay')}
          </Button>
          {/* "Cancel" is the word the ask used and it is the right one HERE, where the thing
              being cancelled is the signup choice rather than a payment or a subscription —
              there is nothing else on this banner it could be mistaken for. The sentence
              underneath says what it actually does, because "Cancel" alone would leave
              somebody wondering whether they had just cancelled their family. */}
          <Button
            size="sm"
            variant="outline"
            onClick={handleCancel}
            disabled={isPending}
            className="shrink-0"
          >
            {t('action.cancel')}
          </Button>
        </div>

        <p className="text-xs text-brand-on-soft/80">
          <InlineText text={t('dash.plan.explain', {
            pay: t('dash.plan.pay'), cancel: t('action.cancel'),
          })} />
          {/* NAMES THE PANE EXPLICITLY even though `plan` is `DEFAULT_SETTINGS_PANE`. The
              default is a decision that screen is free to change, and a link that relies on it
              lands somebody sent here to pay on the family-name form instead. */}
          <Link href="/admin/settings?pane=plan" className="underline">
            {t('dash.plan.advance')}
          </Link>.
        </p>

        <FormError message={error} />
      </div>
    </div>
  )
}
