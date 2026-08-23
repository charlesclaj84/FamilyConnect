'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { Check, Crown, Sparkles, Zap } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { ComingSoonBadge } from '@/components/marketing/sections'
import { ACCENTS, type AccentKey } from '@/components/marketing/tier-accent'
import { cn } from '@/lib/utils'

/**
 * ── THE PAID TIERS, AS A LADDER RATHER THAN A LIST ──────────────────────────
 *
 * WHAT WENT WRONG WHEN THE FOURTH TIER ARRIVED. Standard was inserted between Free
 * and Plus and every card kept the treatment it already had: an outlined box on the
 * cream page. Three of them were outlined boxes on the cream page. So the eye had
 * nothing to climb — four offers of visibly equal weight, differing only in the
 * words inside them, on ONE background. A pricing page's whole job is to make the
 * shape of the offer legible in about four seconds, and that one did not.
 *
 * Three things fix it and they are three because no one of them is enough:
 *
 *  1. FREE AND PAID ARE ON DIFFERENT GROUNDS. Free stays a white band on the cream
 *     page — it is the floor. The three paid tiers sit on the Heritage band, the
 *     same ground the hero and the closing ask use, so the page reads as
 *     cream / burgundy / cream rather than as one continuous field. This is the
 *     change that answers "they all share the same background": the boundary
 *     between what costs nothing and what costs something is now visible from
 *     across the room, and every paid card is a white object with a shadow rather
 *     than an outline drawn on the page.
 *  2. EVERY TIER OWNS A HUE, AND IT ESCALATES. Growth for Free, Heritage for
 *     Standard, Warmth for Plus, Legacy gold for Premium — the brand's own ramp,
 *     walked upward. It lands on the icon chip and the rail, which are SURFACES;
 *     the bullet glyphs stay `--brand-accent` in every card, because that is the
 *     one Warmth token that is a foreground and the only one measured as such. See
 *     AGENTS.md, "Colours live in one place": `--brand-warm` and `--brand-accent`
 *     are both Warmth and they are not interchangeable.
 *  3. THE CARDS LIFT. A hover raise and a real shadow, and the featured tier is
 *     raised at rest under a gold crown that catches the light once every five
 *     seconds.
 *
 * WHAT DID NOT CHANGE, and must not: `PLANS[]` still lives in the pricing page,
 * because that table is the copy and the copy is what gets edited. This component
 * takes it as data. The only concession is `icon` and `accent`, which are STRING
 * KEYS rather than a `LucideIcon` and a class name — a server component cannot hand
 * a client component a function, and a class name typed into the data table would
 * put a colour decision somewhere nobody would look for one.
 */

const TIER_ICONS = { check: Check, sparkles: Sparkles, zap: Zap, crown: Crown } as const
export type PlanIconKey = keyof typeof TIER_ICONS

/**
 * The rungs live in `tier-accent.ts` now (2026-08-22), shared with the tier bands on
 * `/features`. They were declared here first and copied there second, which is two
 * tables describing one ramp — the shape this codebase spends a lot of comments
 * warning about. Every pair is a FILLED surface with its measured `on-` partner; that
 * file argues why, and it is not a style preference.
 *
 * There is deliberately no per-tier FOREGROUND: the bullet glyphs are `--brand-accent`
 * in all four cards, so nothing in this table can put an unmeasured pairing on screen.
 */
export type PlanAccentKey = AccentKey

export interface PlanFeature {
  /**
   * WHICH CLAIM THIS IS, as a stable `<tier>/<slug>` id. Never rendered.
   *
   * ── IT EXISTS BECAUSE TWO HAND-WRITTEN LISTS DRIFTED TWICE ────────────────
   * `PLANS[]` on `/pricing` is what a BUYER reads; `PLAN_ADDS` in `lib/plans.ts` is what a
   * MEMBER reads on `/admin/settings` and `/upgrade`. Neither may be derived from the other
   * — one marketing bullet spans several routes, several routes are sold in no bullet at
   * all, and the words a buyer needs are not the words a member needs. Both files argue that
   * at length and the argument is sound.
   *
   * What it does NOT license is the two lists disagreeing about WHICH THINGS ARE SOLD, and
   * they have twice: a Premium bullet went missing in-product, so a family on Premium was
   * never told inside the product that the address comes with the website; and a false
   * detail survived on both after `/features` had corrected it.
   *
   * So the WORDING stays independent and the SET of claims per tier must match, which is a
   * thing a script can check — `npm run marketing:check`. The id is required rather than
   * optional so `npm run typecheck` refuses a new bullet that declares none: an optional
   * field would be omitted by exactly the edit this is meant to catch.
   *
   * TIER-PREFIXED, and that is not decoration. It is what makes a bullet MOVED between cards
   * in one file and not the other a finding rather than a silent re-pricing, and it lets the
   * checker read the pricing page as flat text (see `marketing-coverage.mjs`, which cannot
   * import a React page).
   */
  claim: string
  /** The benefit, in the fewest words that land it. This is what gets scanned. */
  label: string
  /** The proof, for the reader who slowed down. Optional. */
  detail?: string
}

export interface MarketingPlan {
  name: string
  tagline: string
  /**
   * The headline figure and its period.
   *
   * `null` while a price is not announced — a supported state; see
   * `PRICING_IS_ANNOUNCED` in the pricing page. Free carries a hand-written
   * `$0 / forever` rather than coming from `TIER_PRICE`, because Free has no price
   * rather than a price of zero and `$0` is a marketing statement rather than an
   * amount anybody is charged. It is also what the page identifies Free BY, which is
   * why that `period` string is load-bearing.
   *
   * THERE WAS AN `annual` FIELD HERE and it is gone with the annual rate itself
   * (2026-08-19). One figure per plan now, month to month.
   */
  price: { amount: string; period: string } | null
  /** Name of the tier this one contains, or null for the base tier. */
  inheritsFrom: string | null
  /** What THIS tier adds on top of the one it inherits. */
  adds: readonly PlanFeature[]
  available: boolean
  /** The one tier the eye should land on. Exactly one should be true. */
  featured: boolean
  /**
   * The bullet glyph, one per tier rather than one per state.
   *
   * Free and Plus both used to draw `Sparkles`, which made two different offers look
   * like the same offer at a glance — and on a pricing page the glance is most of the
   * decision. A tick for what you already have, `Sparkles` for the tier that turns a
   * place to be into a family being run, a lift for the one that adds the
   * organizational machinery, a crown for the one that reaches every relative and puts
   * the family on the public internet.
   *
   * A KEY RATHER THAN THE COMPONENT, since 2026-08-22: the plan table lives in a
   * SERVER component and a function cannot cross that boundary. Resolved against
   * `TIER_ICONS` above, so an unknown key is a type error rather than a blank card.
   */
  icon: PlanIconKey
  /**
   * Which rung of the brand ramp this tier owns — chip and rail, nothing else.
   *
   * A key rather than a class name for the same reason the colour tokens exist at
   * all: a `bg-…` string typed into the plan table would put a colour decision in the
   * file that holds the COPY, where nobody would look for one and nothing would stop
   * it drifting off the ramp. Resolved against `ACCENTS` in `tier-accent.ts`, which is the one
   * place a tier's hue is chosen.
   */
  accent: PlanAccentKey
}

/**
 * ── ONE RENDERING, TWO LAYOUTS ──────────────────────────────────────────────
 *
 * Below `lg` the track is a snap carousel; at `lg` the same elements become a
 * three-column grid. ONE set of cards, switched by CSS — a second stacked rendering
 * is how a bullet added to one copy and not the other stays invisible until somebody
 * opens a phone, which is the argument the table-collapse pattern already makes
 * about columns.
 *
 * THE GESTURE IS NEVER THE ONLY WAY IN. The switcher above the track is a row of
 * NAMED buttons, so a tier is reachable by tap, by keyboard and by screen reader,
 * and the pane you are on is announced by its name rather than as "2 of 3". The
 * scroll listener runs the other way — pan the track and the switcher follows — so
 * the two controls can never disagree about which card is showing.
 *
 * It is NOT a `role="tablist"`, deliberately, and a variant must not claim one
 * either: that role promises roving arrow-key focus and `aria-controls` wiring, and
 * a screen reader changes its key handling to match. Same reasoning as `MainRail`
 * and `PersonMultiSelect`. What it is, is a group of buttons that scroll a region.
 */
export function PlanLadder({ plans }: { plans: readonly MarketingPlan[] }) {
  const track = useRef<HTMLDivElement>(null)
  const [active, setActive] = useState(() => {
    const featured = plans.findIndex(p => p.featured)
    return featured === -1 ? 0 : featured
  })

  // Pan the track, and the switcher follows. Measured against the track's own scroll
  // width rather than against a stored card width, so it stays right when the cards
  // change size at `sm` — a width captured once would be stale after a rotate, which
  // is the ordinary way to resize a phone.
  const syncFromScroll = useCallback(() => {
    const el = track.current
    if (!el || el.scrollWidth <= el.clientWidth || plans.length < 2) return
    const ratio = el.scrollLeft / (el.scrollWidth - el.clientWidth)
    setActive(Math.round(ratio * (plans.length - 1)))
  }, [plans.length])

  // The featured tier is the one the eye should land on, so it is the one the track
  // opens on — but ONLY while the track is a carousel. At `lg` every card is already
  // on screen and scrolling one into view would jump the page for no reason.
  //
  // `scrollLeft` rather than `scrollIntoView`, which scrolls every scrollable
  // ancestor including the document: on a phone this element is below the fold on
  // mount, so asking to centre it would drag the reader past the hero before they
  // had read it.
  useEffect(() => {
    const el = track.current
    if (!el || el.scrollWidth <= el.clientWidth) return
    const card = el.children[active] as HTMLElement | undefined
    if (card) el.scrollLeft = card.offsetLeft - (el.clientWidth - card.clientWidth) / 2
    // Mount only: this centres the opening card. Every later move is driven by
    // `show()` or by the reader's own thumb, and re-running here would fight both.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  function show(i: number) {
    setActive(i)
    const el = track.current
    const card = el?.children[i] as HTMLElement | undefined
    if (!el || !card) return
    el.scrollTo({
      left: card.offsetLeft - (el.clientWidth - card.clientWidth) / 2,
      behavior: 'smooth',
    })
  }

  return (
    <div>
      {/* ── The tier switcher ────────────────────────────────────────────
          `lg:hidden`, because above that every card is visible and a control that
          selects what is already on screen is furniture.

          The marker is ONE element that slides, not a background on the active
          button: sliding says the tiers are RUNGS and that you are moving between
          them, which is the whole point of the ladder. Gold, because this is the
          burgundy band and gold is what the brand puts on burgundy. */}
      <div className="lg:hidden">
        <div
          role="group"
          aria-label="Choose a plan to read"
          className="relative mx-auto flex max-w-md rounded-full border border-brand-on-primary/20 bg-brand-on-primary/10 p-1"
        >
          <span
            aria-hidden="true"
            className="absolute inset-y-1 left-1 rounded-full bg-brand-legacy transition-transform duration-300 ease-out motion-reduce:transition-none"
            style={{
              width: `calc((100% - 0.5rem) / ${plans.length})`,
              transform: `translateX(${active * 100}%)`,
            }}
          />
          {plans.map((plan, i) => (
            <button
              key={plan.name}
              type="button"
              onClick={() => show(i)}
              aria-current={i === active ? 'true' : undefined}
              className={cn(
                'relative flex-1 rounded-full px-3 py-2 text-sm font-semibold transition-colors duration-300 motion-reduce:transition-none',
                i === active
                  ? 'text-brand-on-legacy'
                  : 'text-brand-on-primary/75 hover:text-brand-on-primary',
              )}
            >
              {plan.name}
            </button>
          ))}
        </div>
      </div>

      {/* The track. `items-stretch` at `lg` so three lists of different lengths share
          a height — left to themselves they float at different heights and the row
          reads as broken rather than as three options. */}
      <div
        ref={track}
        onScroll={syncFromScroll}
        className={cn(
          // `items-start` while it is a carousel and `items-stretch` once it is a
          // row, which is the same decision taken twice with opposite answers. In a
          // ROW, three lists of different lengths left to themselves float at
          // different heights and read as broken rather than as three options. In a
          // CAROUSEL only one card is on screen at a time, so there is no row to keep
          // level — stretching there just pads the shortest tier with a screenful of
          // nothing under its last bullet, which on a phone is most of what you see.
          'gn-scroll-x mt-6 flex snap-x snap-mandatory items-start gap-6 overflow-x-auto pb-2',
          'lg:mt-0 lg:grid lg:grid-cols-3 lg:items-stretch lg:overflow-visible lg:pb-0',
        )}
      >
        {plans.map(plan => (
          <PlanCard key={plan.name} plan={plan} />
        ))}
      </div>
    </div>
  )
}

function PlanCard({ plan }: { plan: MarketingPlan }) {
  const Icon = TIER_ICONS[plan.icon]
  const accent = ACCENTS[plan.accent]

  return (
    <div className="w-[86%] shrink-0 snap-center sm:w-[62%] lg:w-auto lg:shrink">
      <div
        className={cn(
          'relative flex h-full flex-col overflow-hidden rounded-2xl bg-card',
          'transition-[transform,box-shadow] duration-300 ease-out',
          'motion-reduce:transition-none motion-reduce:transform-none',
          plan.featured
            ? // Raised at rest and ringed in gold. On the burgundy band this is the
              // brightest, nearest object on the page, which is where the tier meant
              // to be read first belongs. NOT an affirmative fill — that would read
              // as buyable, and nothing here can be bought yet.
              'shadow-[var(--shadow-card-hover)] ring-2 ring-brand-legacy lg:-translate-y-3 lg:hover:-translate-y-4'
            : 'shadow-[var(--shadow-card)] ring-1 ring-border hover:-translate-y-1 hover:shadow-[var(--shadow-card-hover)]',
        )}
      >
        {plan.featured ? (
          // THE CROWN. A gold cap rather than a floating ribbon: a ribbon has to be
          // positioned outside the card, which means the card can no longer clip its
          // own corners and the whole row needs padding for one badge. This is part
          // of the card, and the sweep runs inside it.
          <div className="relative overflow-hidden bg-brand-legacy px-6 py-1.5 text-center">
            <span className="relative z-10 text-[10px] font-semibold uppercase tracking-[0.16em] text-brand-on-legacy">
              Best first step
            </span>
            <span
              aria-hidden="true"
              className="gn-sheen absolute inset-y-0 -left-1/3 w-1/3 bg-brand-on-legacy/20 blur-md"
            />
          </div>
        ) : (
          <div aria-hidden="true" className={cn('h-1.5 w-full', accent.rail)} />
        )}

        <div className="flex flex-1 flex-col p-6 sm:p-7">
          {/* THE BADGE IS PUSHED TO THE FAR EDGE RATHER THAN TRAILING THE NAME.
              Inline after the heading it wrapped on whichever tier had the longest
              name — Standard did, so one of three cards carried its badge on a second
              line and the row of headings no longer lined up. Pushed right it cannot
              wrap: the group on the left is the identity, the badge on the right is
              the status, and both are the same shape on all three cards however long
              a future tier's name is. */}
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <span className={cn('inline-flex rounded-xl p-2', accent.chip)}>
                <Icon className="h-4 w-4" aria-hidden="true" />
              </span>
              <h3 className="text-2xl">{plan.name}</h3>
            </div>
            <ComingSoonBadge className="mt-2" />
          </div>
          <p className="mt-2 min-h-10 text-sm text-muted-foreground">{plan.tagline}</p>

          {/* NOTHING RENDERS HERE FOR AN UNPRICED TIER — no figure, and no "price to
              be announced" standing in for one. The card already says Coming soon
              beside its name and Not yet available on its button, so a third line
              saying the same thing is the over-explaining this site was asked to
              stop.

              The rule the absence protects is unchanged: no placeholder FIGURE. A
              number here is a commercial representation people budget against and
              crawlers cache, and the cached result outlives the edit that was going
              to fix it. Set a price back to `null` and the slot empties.

              `min-h-14` is a floor so a priced and an unpriced card share a baseline
              for the button below; it tracks the tallest price block, which has been
              one line since the annual rate was withdrawn on 2026-08-19. */}
          <div className="mt-5 min-h-14">
            {plan.price && (
              <p className="flex items-baseline gap-2">
                <span className="text-5xl font-semibold text-brand-ink">{plan.price.amount}</span>
                <span className="text-muted-foreground">{plan.price.period}</span>
              </p>
            )}
          </div>

          {/* ── THE INHERITED TIER IS THE FIRST LIST ITEM ──────────────
              It used to be a sentence above the list reading "Everything in Plus,
              plus:", which says "plus" twice and reads as a stutter — made worse by
              one of the tiers being NAMED Plus. As a checked row at the top of the
              list it needs no connecting words at all: the list is what you get, and
              the first thing you get is everything below. */}
          <div className="mt-7 flex-1 border-t pt-6">
            <ul className="space-y-3.5 text-sm">
              {plan.inheritsFrom && (
                <li className="flex gap-3 border-b pb-3.5">
                  <Check className="mt-0.5 h-4 w-4 shrink-0 text-brand-affirm" aria-hidden="true" />
                  <span className="font-semibold">Everything in {plan.inheritsFrom}</span>
                </li>
              )}

              {plan.adds.map(item => (
                <li key={item.label} className="flex gap-3">
                  <Icon className="mt-0.5 h-4 w-4 shrink-0 text-brand-accent" aria-hidden="true" />
                  <span className="leading-relaxed">
                    {/* The benefit is the scannable line and carries the weight; the
                        mechanism sits under it in muted text for whoever slowed
                        down. A single run of body text makes the reader find the
                        point themselves. */}
                    <span className="block font-medium text-foreground">{item.label}</span>
                    {item.detail && (
                      <span className="mt-0.5 block text-muted-foreground">{item.detail}</span>
                    )}
                  </span>
                </li>
              ))}

              {plan.adds.length === 0 && (
                // Renders instead of an empty list, so the card reads as "not
                // specified yet" — which is true — rather than inventing
                // capabilities to pad it out to match its neighbours.
                <li className="text-muted-foreground">
                  What this tier adds is still being decided.
                </li>
              )}
            </ul>
          </div>

          {/* ── THE BUTTON IS THE CARD'S LAST LINE, NOT ITS FOURTH ────────────
              The price stays at the top where it is scanned; the action moved to the
              bottom on 2026-08-22, and it is the equal-height row that makes it the
              right place. These three lists are six, nine and six bullets long, so
              the shortest tier used to end its content halfway up a card that
              stretched to match the longest — a third of a metre of white with
              nothing under it, and the eye reads that as an unfinished card rather
              than as air.

              Anchored to the bottom, that space lands ABOVE the action instead of
              after it, which is how every well-set page treats a call to action, and
              the three buttons come to rest on one line across the row. Which is
              worth having on its own: a price row's whole job is comparison, and
              three actions at three heights is three separate offers. */}
          <div className="mt-8">
            <Button size="lg" disabled className="w-full text-base">
              Not yet available
            </Button>
            <p className="mt-3 text-center text-xs text-muted-foreground">
              Create a free account and you will hear about it first.
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
