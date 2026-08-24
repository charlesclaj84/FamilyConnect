'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Sparkles, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { FormError } from '@/components/ui/form-message'
import { dismissSignupPlan } from '@/app/actions/billing'
import { TIER_PRICE, formatPlanPrice } from '@/lib/plans'
import { TIER_LABEL, type FamilyTier } from '@/lib/tiers'

/**
 * "You chose Plus when you signed up — here is where you set it up."
 *
 * ── WHY THE PRODUCT NEEDS THIS AT ALL ───────────────────────────────────────────────
 * `/pricing` sells Standard and Plus, and pressing either button cannot take a payment:
 * there is no family yet to be the Stripe customer, and registration ends without a session
 * because `enable_confirmations` is on. So the choice is recorded against the family and
 * offered again HERE, at the first moment there is somebody signed in with the grant to act
 * on it. Without this banner the plan somebody asked for on the marketing site is a row in a
 * table nobody ever sees, and the family is silently on Free.
 *
 * ── IT IS A LINK, NOT A CHECKOUT ────────────────────────────────────────────────────
 * The button goes to Family Settings, where the plan panel already offers monthly and
 * prepaid, the part-month arithmetic and the price. Starting a Stripe session from the
 * dashboard would be a second door into `startPlanCheckout` with no way to choose either of
 * those — and the panel is the screen that has to be understood before somebody is charged.
 *
 * ── AND IT SAYS THE FAMILY IS ON FREE, IN THOSE WORDS ───────────────────────────────
 * The one thing this must never imply is that the plan is active or that money has been
 * taken. `families.tier` is Free until Stripe says otherwise (the webhook is the only
 * writer), so the copy leads with what is true today rather than with what was chosen.
 */
export function PlanSetupBanner({ tier }: { tier: FamilyTier }) {
  const router = useRouter()
  const [dismissed, setDismissed] = useState(false)
  const [error, setError] = useState('')
  const [isPending, startTransition] = useTransition()

  if (dismissed) return null

  const price = TIER_PRICE[tier]

  /**
   * NO CONFIRMATION DIALOG, unlike the chapter banner next to it.
   *
   * That one writes a fact about a person and moves other people's rows with it. This
   * cancels a prompt — nothing is bought, nothing is cancelled, and the plan is still on
   * sale two clicks away on the screen this banner links to. A dialog in front of a
   * reversible dismissal is the over-asking that teaches people to click through dialogs.
   *
   * OPTIMISTIC, and it re-checks: the row is hidden at once, and a refusal puts it back with
   * the reason. `router.refresh()` re-reads the server's answer so the banner does not
   * reappear on the next navigation.
   */
  function handleDismiss() {
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
            Finish setting up {TIER_LABEL[tier]}
          </p>
          <p className="mt-0.5 text-xs text-brand-on-soft/80">
            You chose {TIER_LABEL[tier]} when you created this family, and nothing has been
            charged — your family is on Free until the first payment goes through
            {price ? ` (${formatPlanPrice(price.monthlyCents)} a month)` : ''}. You can pay
            monthly or buy months in advance.
          </p>
        </div>

        <div className="flex flex-col gap-2 sm:flex-row">
          {/* NAMES THE PANE EXPLICITLY even though `plan` is `DEFAULT_SETTINGS_PANE`. The
              default is a decision that screen is free to change, and a link that relies on
              it lands somebody sent here to pay on the family-name form instead. */}
          <Link href="/admin/settings?pane=plan" className="shrink-0">
            <Button size="sm" className="w-full sm:w-auto">
              Set up {TIER_LABEL[tier]}
            </Button>
          </Link>
          <Button
            size="sm"
            variant="outline"
            onClick={handleDismiss}
            disabled={isPending}
            className="shrink-0"
          >
            {isPending ? 'Saving…' : 'Stay on Free'}
          </Button>
        </div>

        <FormError message={error} />
      </div>

      {/* The X and "Stay on Free" do the SAME thing, and both are here on purpose: the
          button is the honest label for the decision, and the X is what somebody reaches for
          to clear a banner. One handler, so they cannot come to mean different things. */}
      <button
        type="button"
        onClick={handleDismiss}
        disabled={isPending}
        aria-label="Stay on Free and stop showing this"
        className="shrink-0 self-start rounded-md p-1 text-brand-on-soft/60 transition-colors hover:bg-brand-primary/10 hover:text-brand-on-soft"
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  )
}
