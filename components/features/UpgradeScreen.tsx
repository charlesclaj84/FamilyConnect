import Link from 'next/link'
import { Lock, ArrowRight, Check, Crown } from 'lucide-react'
import { buttonVariants } from '@/components/ui/button'
import { FEATURES } from '@/lib/features'
import {
  planAdds, TIER_IS_SOLD, TIER_PRICE, formatPlanPrice,
} from '@/lib/plans'
import { TIER_LABEL, tierTagline, tierMeets, type FamilyTier } from '@/lib/tiers'
import type { T } from '@/lib/i18n/t'

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
 * discloses anything about this family.
 *
 * IT NOW NAMES THE PRICE TOO, since 2026-08-17, and the rule it used to state is unchanged
 * rather than relaxed: it must not name an INVENTED number. `TIER_PRICE` in `lib/plans.ts`
 * is the real figure and the same one `/pricing` renders, so this screen is quoting rather
 * than guessing — which is what makes it safe on a page a member reads as authoritative.
 *
 * And it says in the same breath whether the plan can be bought at all (`TIER_IS_SOLD`).
 * This is the screen where that matters most: it is the one place in the product where
 * somebody WANTED a feature and was refused, so it is the one place a price with no way to
 * pay would read as a broken checkout rather than as information.
 *
 * SINCE 2026-08-23 THAT CLAUSE IS USUALLY ABSENT, because Standard and Plus went on sale and
 * the sentence is derived rather than typed — which is the whole reason this needed no edit
 * when they did. It still appears for Premium, and it is what stops "Change your plan" below
 * reading as a checkout for a plan nothing can charge for.
 *
 * ── IT NO LONGER LINKS TO `/pricing`, since 2026-08-13 ──────────────────────────────
 * That link took a signed-in member out of the Dashboard and onto Home, where the answer
 * to "what is on this plan?" is wrapped in a hero, a testimonial carousel and a button
 * offering to create the account they are already using. The answer is now on this screen:
 * `planAdds` from `lib/plans.ts` says what the plan includes, in the product's own words.
 *
 * `settingsHref` is the one way OUT of here, and it is null for most people on purpose —
 * see the prop.
 *
 * ── THE FEATURE LIST IS DERIVED, NOT WRITTEN ────────────────────────────────────────
 * The "also on this plan" rows come from the registry, filtered to what is both live and
 * on the required tier — so a feature that ships, or one that moves between tiers, is
 * described correctly here without anybody remembering this file exists. That is a
 * different list from `planAdds` and both belong: one is the ROUTES this family would
 * gain today, the other is what the plan is sold as.
 */
export function UpgradeScreen({
  label, blurb, currentTier, requiredTier: required, settingsHref, t, intl,
}: {
  /** The reader's language, bound. A prop — this is a Server Component. */
  t: T
  /** The reader's `Intl` tag, for the price. Threaded beside `t` for the same reason. */
  intl: string
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

  // `null` only if this ever renders for Free, which `requireTier` cannot produce — Free is
  // the floor, so `tierMeets` is always true for it and no page redirects here. Read
  // defensively anyway rather than asserted: a screen is the wrong place to throw.
  const price = TIER_PRICE[required]

  return (
    <div className="mx-auto max-w-lg px-4 py-20 text-center sm:px-6">
      <div className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-full bg-brand-soft text-brand-on-soft">
        <Lock className="h-7 w-7" />
      </div>

      <div className="mb-4 inline-flex items-center gap-1.5 rounded-full bg-brand-legacy px-3 py-1 text-xs font-medium text-brand-on-legacy">
        <Crown className="h-3.5 w-3.5" />{' '}
        {t('upg.partOfPlan', { plan: TIER_LABEL[required] })}
      </div>

      <h1 className="mb-2 text-xl font-semibold sm:text-2xl">{label}</h1>
      <p className="mb-2 text-sm text-muted-foreground">{blurb}</p>
      <p className="mb-8 text-sm text-muted-foreground">
        {t('upg.familyIsOn')} <span className="font-medium text-foreground">{TIER_LABEL[currentTier]}</span>.
        {' '}
        {/* ── `.toLowerCase()` IS GONE, AND THAT IS THE POINT ────────────────────────
            The tagline was lowercased so it would read as a clause mid-sentence. That is an
            English typographic move and it does not travel: a Spanish or French tagline can
            open on a proper noun, and lowercasing it there produces *genorra* or a lowered
            place name in the middle of a sentence nobody can correct from here.

            So the whole sentence is one catalogue entry with the tagline interpolated, and
            each language writes the join it needs — including, if it wants, a colon and a
            capital. */}
        {t('upg.forFamilies', {
          tier: TIER_LABEL[required],
          tagline: tierTagline(t, required),
        })}
      </p>

      {alsoIncluded.length > 0 && (
        <div className="mb-6 rounded-2xl border bg-card px-4 py-5 text-start shadow-[var(--shadow-card)]">
          <p className="mb-3 text-xs font-medium uppercase tracking-wide text-muted-foreground">
            {t('upg.alsoOn', { tier: TIER_LABEL[required] })}
          </p>
          <ul className="flex flex-col gap-1">
            {alsoIncluded.map(feature => (
              // NOT LINKS. Every row here is a page this family cannot open, so an
              // anchor would take focus, invite a click and land back on this screen.
              // Same reasoning as the null `link` branch in Recent Updates.
              <li key={feature.href} className="flex items-start gap-2 px-2 py-1.5 text-sm">
                <ArrowRight className="mt-0.5 h-3.5 w-3.5 shrink-0 text-muted-foreground rtl:-scale-x-100" aria-hidden="true" />
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
      <div className="mb-8 rounded-2xl border bg-card px-4 py-5 text-start shadow-[var(--shadow-card)]">
        <p className="mb-3 text-xs font-medium uppercase tracking-wide text-muted-foreground">
          {t('upg.whatIncludes', { tier: TIER_LABEL[required] })}
        </p>
        <ul className="flex flex-col gap-2.5">
          {planAdds(t, required).map(item => (
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
          {t('upg.everythingOnComesWith', { plan: TIER_LABEL[currentTier] })}
        </p>

        {/* THE PRICE, LAST — after what the plan does, never before it. Somebody who
            reached this screen was refused a feature, so the question they arrived with is
            "what is this?" and the price is what they ask second. A figure above the
            benefit list would answer the second question first.

            ONE RATE, since 2026-08-19. There were two — month to month and the year paid in
            advance — with a derived "two months free" clause between them; the annual rate and
            its discount were both withdrawn. The "no annual plan" half is stated rather than
            left to a bare figure, because a price on an upgrade screen with no term beside it
            reads as a commitment, and there is none to make. */}
        {price && (
          <p className="mt-2 text-xs text-muted-foreground">
            <span className="font-medium text-foreground">
              {t('bill.perMonth', { amount: formatPlanPrice(price.monthlyCents, intl) })}
            </span>
            {t('upg.noAnnualNoContract')}
            {!TIER_IS_SOLD[required] && t('upg.notOnSaleYet')}
          </p>
        )}
      </div>

      <div className="flex flex-wrap justify-center gap-2">
        {settingsHref && (
          <Link href={settingsHref} className={buttonVariants() + ' justify-center'}>
            {t('upg.changePlan')}
          </Link>
        )}
        <Link
          href="/dashboard"
          className={buttonVariants({ variant: settingsHref ? 'outline' : 'default' }) + ' justify-center'}
        >
          {t('soon.back')}
        </Link>
      </div>

      {!settingsHref && (
        <p className="mt-4 text-sm text-muted-foreground">
          {t('upg.askAdmin')}
        </p>
      )}
    </div>
  )
}
