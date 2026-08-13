import Link from 'next/link'
import { Lock, ArrowRight, Check, Crown } from 'lucide-react'
import { buttonVariants } from '@/components/ui/button'
import { FEATURES } from '@/lib/features'
import { PLAN_ADDS } from '@/lib/plans'
import { TIER_LABEL, TIER_TAGLINE, tierMeets, type FamilyTier } from '@/lib/tiers'

/**
 * Served in place of a page the family's PLAN does not include.
 *
 * ── IT IS NOT THE COMING SOON SCREEN, and the difference is the whole point ──────────
 * `ComingSoonScreen` says "nobody has this yet". This says "this works, and your family
 * has not bought it". Answering both with one screen was the obvious shortcut and is
 * wrong in both directions: telling a paying family that a shipped feature is coming soon
 * is a lie, and telling a free family to wait for something they could have this
 * afternoon is a sale nobody made.
 *
 * ── WHAT IT MAY AND MAY NOT SAY ─────────────────────────────────────────────────────
 * It names the feature, the plan that includes it, and the OTHER features on that plan —
 * all of which is published on `/pricing` and identical for every customer, so none of it
 * discloses anything about this family. What it must never do is name a NUMBER. Pricing
 * has not been announced (`PRICING_IS_ANNOUNCED` on `/pricing` is false and explains at
 * length why there is no placeholder figure), and a price invented here would be a
 * commercial representation on a page a member reads as authoritative.
 *
 * ── IT NO LONGER LINKS TO `/pricing`, since 2026-08-13 ──────────────────────────────
 * That link took a signed-in member out of the Dashboard and onto Home, where the answer
 * to "what is on this plan?" is wrapped in a hero, a testimonial carousel and a button
 * offering to create the account they are already using. The answer is now on this screen:
 * `PLAN_ADDS` from `lib/plans.ts` says what the plan includes, in the product's own words.
 *
 * `settingsHref` is the one way OUT of here, and it is null for most people on purpose —
 * see the prop.
 *
 * ── THE FEATURE LIST IS DERIVED, NOT WRITTEN ────────────────────────────────────────
 * The "also on this plan" rows come from the registry, filtered to what is both live and
 * on the required tier — so a feature that ships, or one that moves between tiers, is
 * described correctly here without anybody remembering this file exists. That is a
 * different list from `PLAN_ADDS` and both belong: one is the ROUTES this family would
 * gain today, the other is what the plan is sold as.
 */
export function UpgradeScreen({
  label, blurb, currentTier, requiredTier: required, settingsHref,
}: {
  label: string
  blurb: string
  currentTier: FamilyTier
  requiredTier: FamilyTier
  /**
   * Where to go to change the plan, or null when this caller cannot.
   *
   * Resolved by the page from `admin/family:view`, because Settings is registered
   * 'restricted' per family (20260812000000) and is administrators-only until a family
   * says otherwise. A link to a page that 404s is worse than no link — and for the member
   * who cannot open it, the useful next step is a person rather than a URL, which is what
   * the fallback sentence says.
   */
  settingsHref: string | null
}) {
  // Live, on the required tier, and not already included in what the family has. That
  // last conjunct is what stops the list padding itself with things they can already
  // open — "upgrade for the member directory" reads as a downgrade of the offer.
  const alsoIncluded = FEATURES.filter(f =>
    f.status === 'live'
    && f.tier === required
    && !tierMeets(currentTier, f.tier)
    && f.label !== label,
  )

  return (
    <div className="mx-auto max-w-lg px-4 py-20 text-center sm:px-6">
      <div className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-full bg-brand-soft text-brand-on-soft">
        <Lock className="h-7 w-7" />
      </div>

      <div className="mb-4 inline-flex items-center gap-1.5 rounded-full bg-brand-legacy px-3 py-1 text-xs font-medium text-brand-on-legacy">
        <Crown className="h-3.5 w-3.5" /> Part of {TIER_LABEL[required]}
      </div>

      <h1 className="mb-2 text-xl font-semibold sm:text-2xl">{label}</h1>
      <p className="mb-2 text-sm text-muted-foreground">{blurb}</p>
      <p className="mb-8 text-sm text-muted-foreground">
        Your family is on <span className="font-medium text-foreground">{TIER_LABEL[currentTier]}</span>.
        {' '}{TIER_LABEL[required]} is for families who need more: {TIER_TAGLINE[required].toLowerCase()}
      </p>

      {alsoIncluded.length > 0 && (
        <div className="mb-6 rounded-2xl border bg-card px-4 py-5 text-left shadow-[var(--shadow-card)]">
          <p className="mb-3 text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Also on {TIER_LABEL[required]}
          </p>
          <ul className="flex flex-col gap-1">
            {alsoIncluded.map(feature => (
              // NOT LINKS. Every row here is a page this family cannot open, so an
              // anchor would take focus, invite a click and land back on this screen.
              // Same reasoning as the null `link` branch in Recent Updates.
              <li key={feature.href} className="flex items-start gap-2 px-2 py-1.5 text-sm">
                <ArrowRight className="mt-0.5 h-3.5 w-3.5 shrink-0 text-muted-foreground" aria-hidden="true" />
                <span>
                  <span className="block">{feature.label}</span>
                  <span className="block text-xs text-muted-foreground">{feature.blurb}</span>
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* WHAT THE PLAN IS SOLD AS, which is a different question from which routes it
          unlocks and is the one somebody deciding actually asks. This is the content the
          /pricing link used to be standing in for; keeping it here means the member never
          leaves the product to read it. */}
      <div className="mb-8 rounded-2xl border bg-card px-4 py-5 text-left shadow-[var(--shadow-card)]">
        <p className="mb-3 text-xs font-medium uppercase tracking-wide text-muted-foreground">
          What {TIER_LABEL[required]} includes
        </p>
        <ul className="flex flex-col gap-2.5">
          {PLAN_ADDS[required].map(item => (
            <li key={item.label} className="flex items-start gap-2 text-sm">
              <Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-brand-affirm" aria-hidden="true" />
              <span>
                <span className="block font-medium">{item.label}</span>
                <span className="block text-xs text-muted-foreground">{item.detail}</span>
              </span>
            </li>
          ))}
        </ul>
        <p className="mt-3 border-t pt-3 text-xs text-muted-foreground">
          Everything on {TIER_LABEL[currentTier]} comes with it.
        </p>
      </div>

      <div className="flex flex-wrap justify-center gap-2">
        {settingsHref && (
          <Link href={settingsHref} className={buttonVariants() + ' justify-center'}>
            Change your plan
          </Link>
        )}
        <Link
          href="/dashboard"
          className={buttonVariants({ variant: settingsHref ? 'outline' : 'default' }) + ' justify-center'}
        >
          Back to dashboard
        </Link>
      </div>

      {!settingsHref && (
        <p className="mt-4 text-sm text-muted-foreground">
          Ask one of your family&rsquo;s administrators to change the plan.
        </p>
      )}
    </div>
  )
}
