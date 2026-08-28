'use client'

import { useState } from 'react'
import { Users } from 'lucide-react'
import { useMarketingIntl, useMarketingT } from '@/components/marketing/MarketingLocale'
import { formatCurrency } from '@/lib/currency-utils'
import { type T } from '@/lib/i18n/t'
import { cn } from '@/lib/utils'

/**
 * ── THE PAGE'S CENTRAL CLAIM, MADE INTERACTIVE ──────────────────────────────
 *
 * "No charge per relative" is the most valuable sentence on this page and it was
 * being made in prose, three times, in three different places — the hero, a bullet
 * and an FAQ answer. A visitor who has been quoted per-seat pricing by every other
 * tool they looked at does not really believe a sentence; they believe a number
 * they moved themselves.
 *
 * So: drag the family from ten relatives to two hundred and fifty, and watch the
 * bill not move. The per-relative figure falls away to nothing on its own, which is
 * an argument the copy cannot make as fast as the thumb can.
 *
 * TWO RULES ABOUT THE ARITHMETIC, and both matter more than the animation:
 *
 *  * EVERY FIGURE IS DERIVED FROM `TIER_PRICE`, through the props. Nothing here
 *    knows what a plan costs and nothing here may learn — a price typed into a
 *    widget is the fourth copy of a number the product is careful to keep to one,
 *    and it is the copy nobody would think to check when a rate moves.
 *  * NO COMPETITOR IS QUOTED, and none may be. The obvious version of this control
 *    puts "what others charge" beside our figure, and the moment it does, the page
 *    is making a factual claim about somebody else's price list that nothing in
 *    this repo can keep current. The comparison the reader makes for themselves is
 *    the whole point, and it is stronger for being theirs.
 */

/** The band the control spans, and where it starts. */
const MIN_MEMBERS = 10
const MAX_MEMBERS = 250
const STEP = 5

/**
 * ONE HUNDRED AND TWENTY, because that is the ordinary customer rather than a
 * flattering one — AGENTS.md sets a hundred-and-twenty-adult family as the size
 * every member list in this product is built for. Opening on ten would make the
 * control a toy and the saving invisible; opening on the maximum would look like a
 * boast. The number the visitor lands on should be their own family.
 */
const DEFAULT_MEMBERS = 120

export interface SizedPlan {
  name: string
  /** `null` for Free — which has no price rather than a price of zero. */
  monthlyCents: number | null
  /** The headline figure exactly as the cards render it, so the two cannot disagree. */
  amount: string
}

/**
 * What one relative costs a month, in the smallest unit that reads cleanly.
 *
 * Cents under a dollar, because "$0.04" makes the eye stop and parse where "4¢"
 * lands immediately — and landing immediately is the entire job of this figure. It
 * bottoms out at "under 1¢" rather than at "0¢": a rounded zero would be a claim
 * that the plan is free at that size, which is a different offer from the one on
 * the cards above.
 *
 * ── THE CENT SIGN IS A US CONVENTION, SO THE SUB-DOLLAR CASE OFFERS BOTH FORMS ──────
 * "nothing" and "under 1¢" are words and are keyed. The interesting one is "4¢": the sign
 * itself does not travel — Spanish and French write a fraction of a currency unit as a decimal
 * with the symbol after the number — and neither does the CHOICE to use it, which is the whole
 * argument of the paragraph above.
 *
 * So `mkt.slider.cents` is handed BOTH a whole number of cents and a properly formatted
 * currency string, and each language uses the one it wants: English takes `{n}¢`, Spanish and
 * French take `{amount}`. That is why the key has two placeholders where one would have done —
 * a single `{n}` forced every language into the cent-sign shape, and a single `{amount}` would
 * have taken the fast-reading form away from the language the argument was written for.
 *
 * The DOLLAR branch is `formatCurrency` too, and that is a fix rather than a tidy-up: it was
 * ``$${(each / 100).toFixed(2)}`` — a hard-coded dollar sign in front of an English decimal
 * point, which is the shape `i18n:check`'s PINNED-FORMATTER count exists to drive to zero.
 */
function perRelative(
  t: T,
  intl: string,
  monthlyCents: number | null,
  members: number,
): string {
  if (monthlyCents === null) return t('mkt.slider.nothing')
  const each = monthlyCents / members
  if (each < 1) return t('mkt.slider.underCent')
  const amount = formatCurrency(Math.round(each), intl) ?? ''
  if (each < 100) return t('mkt.slider.cents', { n: Math.round(each), amount })
  return amount
}

export function FamilySizeSlider({ plans }: { plans: readonly SizedPlan[] }) {
  const t = useMarketingT()
  const intl = useMarketingIntl()
  const [members, setMembers] = useState(DEFAULT_MEMBERS)
  const fill = ((members - MIN_MEMBERS) / (MAX_MEMBERS - MIN_MEMBERS)) * 100

  return (
    <div className="overflow-hidden rounded-2xl border bg-card shadow-[var(--shadow-card)]">
      <div className="grid gap-8 p-6 sm:p-8 lg:grid-cols-[1fr_minmax(0,20rem)] lg:gap-12">
        {/* ── The control, and the crowd it describes ─────────────────────
            `lg:self-center`, because the two halves are never the same height and
            never can be: this one grows a row of dots every twenty-four relatives
            while the one beside it is a fixed list of four figures. Left stretched,
            the control sat at the top with the whole difference dumped underneath it.
            Centred, the difference is split above and below and the two columns read
            as one panel. */}
        <div className="lg:self-center">
          <div className="flex items-baseline gap-3">
            <span className="text-5xl font-semibold text-brand-ink sm:text-6xl">{members}</span>
            {/* ONE KEY PER CASE, not a word plus an appended clause. "relatives or more" is
                English word order; Spanish and French both put the qualifier elsewhere, and a
                language could need a different noun form for the capped case. */}
            <span className="text-lg text-muted-foreground">
              {members === MAX_MEMBERS
                ? t('mkt.slider.relativesOrMore')
                : t('mkt.slider.relatives')}
            </span>
          </div>

          <label htmlFor="family-size" className="mt-6 block text-sm font-medium">
            {t('mkt.slider.dragLabel')}
          </label>
          <input
            id="family-size"
            type="range"
            min={MIN_MEMBERS}
            max={MAX_MEMBERS}
            step={STEP}
            value={members}
            onChange={e => setMembers(Number(e.target.value))}
            aria-valuetext={t('mkt.slider.valueText', { n: members })}
            // A percentage, never a colour — the fill's two tones are in globals.css
            // with the rest of the ramp. See `.gn-range` there.
            style={{ '--gn-range-fill': `${fill}%` } as React.CSSProperties}
            className="gn-range mt-3 focus:outline-none"
          />
          <div className="mt-1 flex justify-between text-xs text-muted-foreground">
            <span>{MIN_MEMBERS}</span>
            <span>{MAX_MEMBERS}+</span>
          </div>

          {/* THE CROWD. One dot per relative, so the number above has a size as well
              as a value — a hundred and twenty is an abstraction and a field of a
              hundred and twenty dots is a reunion hall.

              `aria-hidden`, because it says nothing the figure beside it has not
              already said, and a screen reader reading out a hundred and twenty
              empty spans would be actively hostile.

              Every third dot takes the accent, which stops the field reading as a
              texture and keeps it reading as people. */}
          {/* THE FIELD IS CAPPED AT `max-w-md` AND THE DOTS ARE 10px, which is a
              layout decision doing a rhetorical job. Left to the full column width
              the crowd came out three rows deep and read as a progress bar; capped,
              a hundred and twenty relatives is five rows and two hundred and fifty is
              eleven, so dragging the thumb builds a block that visibly gets HEAVIER.
              It also fills the column the figures beside it occupy, instead of
              leaving a screenful of nothing under a ribbon of dots. */}
          <div aria-hidden="true" className="mt-6 flex max-w-md flex-wrap gap-2">
            {Array.from({ length: members }, (_, i) => (
              <span
                key={i}
                className={cn(
                  'h-2.5 w-2.5 rounded-full transition-colors duration-500 motion-reduce:transition-none',
                  i % 3 === 0 ? 'bg-brand-accent/70' : 'bg-brand-primary/30',
                )}
              />
            ))}
          </div>
        </div>

        {/* ── What each of them costs ───────────────────────────────────────
            The totals are fixed and the per-relative figures are not, which is the
            whole demonstration: the left column never moves however far the thumb
            travels, and the right column falls away to nothing. */}
        <div className="lg:border-l lg:pl-10">
          <p className="flex items-center gap-2 text-sm font-semibold">
            <Users className="h-4 w-4 text-brand-accent" aria-hidden="true" />
            {t('mkt.slider.yourBill', { n: members })}
          </p>

          <dl className="mt-5 space-y-3">
            {plans.map(plan => (
              <div
                key={plan.name}
                className="flex items-baseline justify-between gap-4 rounded-xl bg-brand-soft/50 px-4 py-3"
              >
                <dt className="text-sm font-medium">{plan.name}</dt>
                <dd className="text-right">
                  <span className="block font-semibold text-brand-ink">{plan.amount}</span>
                  <span className="block text-xs text-muted-foreground">
                    {t('mkt.slider.each', {
                      amount: perRelative(t, intl, plan.monthlyCents, members),
                    })}
                  </span>
                </dd>
              </div>
            ))}
          </dl>

          <p className="mt-5 text-sm leading-relaxed text-muted-foreground">
            {t('mkt.slider.foot')}
          </p>
        </div>
      </div>
    </div>
  )
}
