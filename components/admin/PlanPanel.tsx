'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Check, Crown, Lock } from 'lucide-react'
import { useConfirm } from '@/components/ui/confirm'
import { FormError } from '@/components/ui/form-message'
import { useServerState } from '@/lib/use-server-state'
import { setFamilyTier } from '@/app/actions/admin/family'
import { PLAN_ADDS, PLAN_ORDER, TIER_IS_SOLD } from '@/lib/plans'
import { TIER_LABEL, TIER_TAGLINE, tierMeets, type FamilyTier } from '@/lib/tiers'
import { cn } from '@/lib/utils'

/**
 * The family's plan, and what each one includes — on Settings, at the top of the page.
 *
 * ── IT REPLACED A LINK TO `/pricing`, WHICH IS THE WHOLE REASON IT EXISTS ───────────
 * "See what each plan includes" used to send a signed-in administrator out of the
 * Dashboard and onto the marketing site, where they met a hero, a testimonial carousel
 * and a "Create Your Free Account" button aimed at somebody who is not them. The question
 * is asked here and is now answered here. Copy comes from `lib/plans.ts`, which states at
 * length why it is kept in step with `/pricing` by hand rather than derived.
 *
 * ── WHAT THE BUTTONS DO, AND WHAT THEY DELIBERATELY DO NOT ─────────────────────────
 * They move `families.tier`, which decides which PAGES this family can open —
 * `requireView` compares it against `lib/features.ts` and the sidebar drops what is not
 * included. Nothing is billed, nothing is charged, and the panel says so rather than
 * dressing itself as a checkout: there is no billing, and a button that took money would
 * not be a `<button>`.
 *
 * It withholds SCREENS, never rows. A family that moves down to Free keeps every record
 * it has ever entered — no RLS policy consults the tier and none may start to
 * (20260813000003) — so moving back up restores the pages with their data intact. That is
 * what makes this safe to offer as scaffolding, and it is the property to preserve if
 * billing ever lands on top of it.
 *
 * ── STATE ───────────────────────────────────────────────────────────────────────────
 * `current` is `useServerState`, so it ADOPTS what `revalidatePath` sends back rather
 * than reading its prop once. That matters more here than on the name field beside it:
 * changing the plan revalidates the whole layout, and a panel still claiming the old tier
 * beside a sidebar that has already dropped four items reads as the change having failed.
 * Switching family remounts the page (the `key={familyCode}` on `<main>`), so there is no
 * cross-family staleness to guard against separately.
 */
export function PlanPanel({ tier, canEdit }: { tier: FamilyTier; canEdit: boolean }) {
  const router = useRouter()
  const confirm = useConfirm()
  const [current, setCurrent] = useServerState(tier)
  const [error, setError] = useState('')
  const [isPending, startTransition] = useTransition()

  async function choose(next: FamilyTier) {
    if (next === current) return
    const up = tierMeets(next, current)
    const ok = await confirm({
      title: `Move this family to ${TIER_LABEL[next]}?`,
      description: up
        ? `Everything on ${TIER_LABEL[next]} opens up immediately. Nothing is billed — `
          + 'there is no payment step yet.'
        : `Pages that are part of ${TIER_LABEL[current]} will stop opening. Nothing is `
          + 'deleted: every record stays exactly where it is, and moving back up brings '
          + 'the pages back with their data intact.',
      confirmLabel: `Move to ${TIER_LABEL[next]}`,
      destructive: !up,
    })
    if (!ok) return

    setError('')
    startTransition(async () => {
      const result = await setFamilyTier(next)
      if (result.success) {
        setCurrent(result.tier)
        // The sidebar and every page guard read the tier, so the whole layout has to
        // re-render — the action revalidates it and this is what asks for the new payload.
        router.refresh()
      } else {
        setError(result.message)
      }
    })
  }

  return (
    <section className="rounded-xl border bg-card p-5 sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="text-lg font-semibold">Your plan</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            What this family&rsquo;s subscription includes, and everything on the plans
            above it.
          </p>
        </div>
        <span className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-brand-legacy px-3 py-1 text-sm font-semibold text-brand-on-legacy">
          <Crown className="h-3.5 w-3.5" aria-hidden="true" /> {TIER_LABEL[current]}
        </span>
      </div>

      <p className="mt-3 text-sm text-muted-foreground">{TIER_TAGLINE[current]}</p>

      <FormError message={error} />

      {/* THREE CARDS, ONE COLUMN EACH AT `sm`. `items-stretch` is what keeps them a
          matching height when one plan's list is longer than another's — with
          `items-start` the shorter cards float and the row reads as broken rather than as
          three options. Same treatment, and the same reason, as `/pricing`. */}
      <div className="mt-5 grid items-stretch gap-4 sm:grid-cols-3">
        {PLAN_ORDER.map(plan => {
          const included = tierMeets(current, plan)
          const isCurrent = plan === current
          return (
            <div
              key={plan}
              className={cn(
                'flex h-full flex-col rounded-2xl border p-4',
                isCurrent
                  ? 'border-2 border-brand-primary/40 bg-brand-soft/40'
                  : included
                    ? 'bg-background'
                    : 'border-dashed bg-background',
              )}
            >
              <div className="flex flex-wrap items-center gap-2">
                <h3 className="text-base font-semibold">{TIER_LABEL[plan]}</h3>
                {isCurrent && (
                  <span className="rounded-full bg-brand-primary px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-brand-on-primary">
                    Current
                  </span>
                )}
                {/* NOT SOLD YET is a fact about the OFFER, not about this family, and it
                    is stated because the panel can put them on a plan nobody can buy.
                    Leaving it out would make this read as a purchase that went through. */}
                {!TIER_IS_SOLD[plan] && (
                  <span className="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                    <Lock className="h-2.5 w-2.5" aria-hidden="true" /> Not sold yet
                  </span>
                )}
              </div>

              <p className="mt-1 text-xs text-muted-foreground">{TIER_TAGLINE[plan]}</p>

              {/* NO PRICE, ON ANY CARD. Pricing has not been announced, and a figure
                  invented for an in-product screen is a commercial representation people
                  budget against exactly as one on /pricing would be. See lib/plans.ts. */}

              <ul className="mt-4 flex-1 space-y-2.5 text-sm">
                {/* The inherited tier as the first row rather than a sentence above the
                    list — "Everything in Plus, plus:" says plus twice, and one of the
                    tiers is called Plus. Same shape as /pricing. */}
                {PLAN_ORDER.indexOf(plan) > 0 && (
                  <li className="flex gap-2 border-b pb-2.5 font-medium">
                    <Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-brand-affirm" aria-hidden="true" />
                    Everything in {TIER_LABEL[PLAN_ORDER[PLAN_ORDER.indexOf(plan) - 1]]}
                  </li>
                )}
                {PLAN_ADDS[plan].map(item => (
                  <li key={item.label} className="flex gap-2">
                    <Check
                      className={cn(
                        'mt-0.5 h-3.5 w-3.5 shrink-0',
                        included ? 'text-brand-affirm' : 'text-muted-foreground',
                      )}
                      aria-hidden="true"
                    />
                    <span>
                      <span className="block font-medium">{item.label}</span>
                      <span className="block text-xs text-muted-foreground">{item.detail}</span>
                    </span>
                  </li>
                ))}
              </ul>

              {canEdit && (
                <button
                  type="button"
                  disabled={isCurrent || isPending}
                  onClick={() => choose(plan)}
                  className={cn(
                    'mt-4 w-full rounded-lg px-3 py-1.5 text-sm font-medium transition-opacity disabled:opacity-60',
                    isCurrent
                      ? 'border bg-muted text-muted-foreground'
                      : 'bg-brand-primary text-brand-on-primary hover:opacity-90',
                  )}
                >
                  {isCurrent ? 'Current plan' : `Move to ${TIER_LABEL[plan]}`}
                </button>
              )}
            </div>
          )
        })}
      </div>

      {canEdit ? (
        <p className="mt-4 text-sm text-muted-foreground">
          Nothing is billed. Choosing a plan changes which pages this family can open, and
          nothing else &mdash; every record you have entered stays where it is, whichever
          plan you are on.
        </p>
      ) : (
        <p className="mt-4 text-sm text-muted-foreground">
          You can see the plan but not change it. Ask an administrator for the Settings
          permission.
        </p>
      )}
    </section>
  )
}
