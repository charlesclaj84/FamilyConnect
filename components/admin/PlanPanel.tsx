'use client'

import { useRef, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Check, CreditCard, Crown, Lock, X } from 'lucide-react'
import { Dialog } from '@/components/ui/dialog'
import { useConfirm } from '@/components/ui/confirm'
import { FormError } from '@/components/ui/form-message'
import { PasswordReauthField } from '@/components/ui/challenge-fields'
import { verifyCurrentPassword } from '@/lib/supabase/client'
import { useServerState } from '@/lib/use-server-state'
import { setFamilyTier } from '@/app/actions/admin/family'
import { changePlanTier, startPlanCheckout, type PlatformBilling } from '@/app/actions/billing'
import { BuyDialog, UpgradeDialog } from '@/components/admin/PlanCheckoutDialogs'
import { formatDate } from '@/lib/date-utils'
import { addDays } from '@/lib/platform-billing'
import {
  PLAN_ORDER, TIER_IS_SOLD, TIER_PRICE, formatPlanPrice,
  planAddsBetween, planChange,
  type PlanChange, type PlanHighlight,
} from '@/lib/plans'
import {
  TIER_LABEL, TIER_RANK, tierTagline, tierMeets, tiersIncludedIn, type FamilyTier,
} from '@/lib/tiers'
import { cn } from '@/lib/utils'
import { useIntlTag, useT } from '@/components/layout/LocaleProvider'
import type { T } from '@/lib/i18n/t'

/**
 * The family's plan, and what each one includes — the whole of Settings' **Plan** pane.
 *
 * ── IT REPLACED A LINK TO `/pricing`, WHICH IS THE WHOLE REASON IT EXISTS ───────────
 * "See what each plan includes" used to send a signed-in administrator out of the
 * Dashboard and onto the marketing site, where they met a hero, a testimonial carousel
 * and a "Create Your Free Account" button aimed at somebody who is not them. The question
 * is asked here and is now answered here. Copy comes from `lib/plans.ts`, which states at
 * length why it is kept in step with `/pricing` by hand rather than derived.
 *
 * ── THREE LINES, NOT THREE PRICE CARDS ─────────────────────────────────────────────
 * This panel used to render the whole offer at once: three columns, nineteen benefits
 * between them, each with a label and a sentence of mechanism. It was a fair rendering of
 * the data and the wrong shape for the page — it is the pane Settings LANDS on, the tier is
 * the one fact an administrator came for, and everything below it started a screen and a half
 * down.
 *
 * So the panel answers the question at the altitude it is asked. Each plan is one row: its
 * name, whether the family is on it, one line saying who it is for, and a "Features" link
 * that opens the full list in a dialog. The nineteen benefits are still all here, one
 * click away, and reading them is now something somebody chose rather than something they
 * scrolled past. `/pricing` — a page whose whole job is the long version, for somebody who
 * has not bought anything — is unaffected, and this deliberately did not become a second
 * copy of it.
 *
 * ── WHAT THE BUTTONS DO, AND WHAT THEY DELIBERATELY DO NOT ─────────────────────────
 * They move `families.tier`, which decides which PAGES this family can open —
 * `requireView` compares it against `lib/features.ts` and the sidebar drops what is not
 * included. Nothing here is billed and nothing here is charged; a button that took money
 * would not be a `<button>`.
 *
 * ── AND SINCE 2026-08-23 THEY ONLY GO DOWN ─────────────────────────────────────────
 * Standard and Plus are on sale, so `families.tier` is a thing families PAY for — and a
 * button on this panel that moved a family up was the whole product for the cost of a
 * click, because every gate in the app reads that column and nothing here takes a payment.
 * `setFamilyTier` refuses every upgrade now (its header carries the argument) and this
 * panel does not render a control it knows would be refused: an upgrade row points at the
 * Billing section below instead, which is where the money actually changes hands.
 *
 * The downgrade half is untouched, and the asymmetry is the point. Giving a plan up costs
 * the family nothing and takes nothing from us; acquiring one is a purchase.
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
 *
 * `detail` — which plan's dialog is open — is genuinely UI-local and needs none of that.
 */
/**
 * What the button on a plan row says, and the same words on the confirmation that follows.
 *
 * IT NAMES THE DIRECTION rather than the destination alone. "Move to Free" is accurate and
 * says nothing about which way the family is going — on a panel where the rows are three
 * identical buttons, the one that takes pages AWAY has to read differently from the two
 * that do not, before it is pressed rather than after. The confirmation's title, its
 * affirmative button and the row all take their wording from here, so the three cannot
 * describe the same move differently.
 */
function moveLabel(current: FamilyTier, to: FamilyTier, t: T): string {
  return tierMeets(to, current)
    ? t('plan.upgradeTo', { plan: TIER_LABEL[to] })
    : t('plan.downgradeTo', { plan: TIER_LABEL[to] })
}

export function PlanPanel({ tier, canEdit, billing }: {
  tier: FamilyTier
  canEdit: boolean
  /**
   * What this family pays GENORRA, or null when the read failed.
   *
   * ── THE PANEL NEEDS IT BECAUSE THE BUY BUTTON LIVES ON THE ROW NOW ────────────────
   * It used to need nothing: every upgrade row printed "Set up in Billing, below" and the
   * actual buttons were in `BillingPanel`. The row is the control now, so this component has
   * to know three things it did not before — whether the deployment can sell this tier
   * (`purchasable`), whether the family already has a subscription or a live prepaid term
   * (which decides WHICH of the three purchase routes a press takes), and what the term is,
   * so a downgrade can say when it takes effect rather than implying it is immediate.
   *
   * NULL IS A FAILED READ, not "never paid" (§8). The panel keeps working — the plan rows and
   * the downgrade path are unaffected — and the buy buttons are withheld rather than rendered
   * over an unknown billing state, because the one thing worse than not offering a purchase is
   * offering a second one to a family that already has a live subscription.
   */
  billing: PlatformBilling | null
}) {
  const intl = useIntlTag()
  const t = useT()
  const router = useRouter()
  const confirm = useConfirm()
  const [current, setCurrent] = useServerState(tier)
  const [detail, setDetail] = useState<FamilyTier | null>(null)
  const [buying, setBuying] = useState<FamilyTier | null>(null)
  const [upgrading, setUpgrading] = useState<FamilyTier | null>(null)
  const [error, setError] = useState('')
  const [isPending, startTransition] = useTransition()

  // ── WHAT THE BILLING RECORD SAYS, FOLDED INTO THE THREE QUESTIONS THE ROWS ASK ─────
  // Read once here rather than at four call sites, because every one of them is a `billing &&`
  // away from being a crash and the answers have to agree with each other.
  const term = billing?.paidEntitlement ?? null
  /** A term that has been paid for and has not run out. */
  const liveTerm = billing?.paidTier != null && term != null && !term.lapsed
  /** A monthly plan at Stripe. Changing tier goes THROUGH it rather than around it. */
  const liveSubscription = Boolean(billing?.subscriptionStatus)
  /**
   * A live term with no subscription behind it — the case `upgradeQuote` exists for.
   *
   * The three purchase routes are decided from this and `liveSubscription`, and which one a
   * press takes is deliberately NOT the family's choice: a subscription is changed at Stripe,
   * a live prepaid term is upgraded against its own unused value, and anything else is an
   * ordinary purchase.
   */
  const upgradingFromPrepaid = liveTerm && !liveSubscription
  /**
   * Whether MONEY is involved in leaving the current plan.
   *
   * `setFamilyTier` is scaffolding that moves `families.tier` with nothing charged, and it
   * REFUSES once a paid term is live (its own header argues why: the sweep would put the tier
   * straight back). So a downgrade has to pick its door, and this is the test — the same one
   * the action makes on the server, where it is the one that counts.
   */
  const billed = liveTerm || liveSubscription
  /**
   * The day a downgrade would actually land, for the confirmation to name.
   *
   * `paid_through` is INCLUSIVE, so it is the day AFTER — the same `+1` `scheduleDowngrade`
   * applies on the server, where it is mutation-tested precisely because a day early is a
   * refund in the one direction this system does not move in. Computed rather than read off
   * `scheduledTierOn`, which is null until the downgrade has been made.
   *
   * NULL WHEN THERE IS NO TERM, and the sentence drops the clause rather than inventing a
   * date. A family with a subscription but no `paid_through` on file is an ordinary state
   * between a checkout and its webhook.
   */
  const downgradeEffective = billing?.paidThrough
    ? formatDate(addDays(billing.paidThrough, 1), intl)
    : null

  // A REF, NOT STATE, and that is forced rather than chosen: the field lives inside the
  // confirmation's `body`, which is a node captured at the moment `confirm()` is called
  // and never re-rendered by this component again. A controlled input bound to state up
  // here would sit frozen at the empty string. So `DowngradeReauth` owns the value and
  // writes it out through this, and `verify` reads it at the moment it is asked.
  const passwordRef = useRef('')

  /**
   * Run a billing action: follow the hosted page when it hands one back, refresh when it does
   * not.
   *
   * ONE HELPER SO NO CALLER CAN FORGET THE `url` BRANCH. Exactly one path returns one — an
   * upgrade from a prepaid term whose credit does not cover the cost — and a caller that only
   * refreshed would leave the family looking at an unchanged screen having pressed a button
   * that did nothing visible. `PlanChangeResult`'s own comment makes the same point.
   */
  const run = (
    action: () => Promise<{ success: boolean; message?: string; url?: string }>,
  ) => startTransition(async () => {
    setError('')
    const result = await action()
    if (!result.success) {
      setError(result.message ?? t('meet.wentWrong'))
      return
    }
    if (result.url) {
      window.location.href = result.url
      return
    }
    // NOT `setCurrent` HERE, deliberately, and it is the difference between this and the
    // downgrade path below. A billed change is a PROMISE — a scheduled downgrade, or a tier
    // that moves when the webhook says the money moved — so the panel must not claim the new
    // tier on the strength of the button. `router.refresh()` re-reads what the server says.
    router.refresh()
  })

  /**
   * Buying a plan above the one this family is on. Three routes, and the family picks none.
   *
   * This is `BillingPanel`'s old button handler, moved to the row it belongs to. The routing
   * is unchanged and each branch is a different Stripe shape rather than a different product
   * decision: a subscription is re-priced in place, a live prepaid term is spent against the
   * new tier first, and everything else is an ordinary purchase.
   */
  function beginUpgrade(next: FamilyTier) {
    if (!billing) return
    // An EXISTING monthly plan changes tier through Stripe: `changePlanTier` prorates an
    // upgrade and schedules a downgrade with no page in between.
    if (billing.mode === 'recurring' && liveSubscription) {
      run(() => changePlanTier(next))
      return
    }
    // A live PREPAID term being upgraded goes through `upgradeQuote` — the unused term is
    // spent on the new tier and only the shortfall is charged, which is often nothing. Its
    // dialog asks the one question that has a real answer: settle next month now, or leave it.
    if (upgradingFromPrepaid && TIER_RANK[next] > TIER_RANK[billing.paidTier ?? 'free']) {
      setUpgrading(next)
      return
    }
    setBuying(next)
  }

  async function choose(next: FamilyTier) {
    if (next === current) return
    const change = planChange(t, current, next)
    const up = change.up
    // ── UPGRADES LEAVE HERE, AND THIS IS THE GUARD THAT KEEPS THEM OUT ────────────────
    // `setFamilyTier` refuses every move UP — `families.tier` is what every gate in the
    // product reads, so a button that moved it would be the whole product for the cost of a
    // click. The rows send an upgrade to `beginUpgrade` instead, and this stays as the second
    // statement of one rule: a future edit that pointed an upgrade row back here would
    // otherwise produce a confirmation promising something the action then refuses.
    if (up) {
      beginUpgrade(next)
      return
    }
    // Never carried between two confirmations — a downgrade cancelled and reopened must
    // ask again, and a password left in a ref is one a later action could spend.
    passwordRef.current = ''
    const ok = await confirm({
      title: `Downgrade this family to ${TIER_LABEL[next]}?`,
      // THE SENTENCE STILL STANDS ON ITS OWN, and it does not refer to anything's position —
      // no "the pages below". It is what `aria-describedby` names, it is all the native
      // fallback can show, and on a phone the columns stack so there is no "left" to point at.
      // It says what HAPPENS; the columns say to WHAT.
      //
      // ── AND SINCE 2026-08-25 IT SAYS *WHEN*, WHICH IT USED TO GET WRONG ─────────────
      // "Pages stop opening" is true of a family that has never paid and false of one with a
      // live term: nothing is revoked until the term runs out, which is the whole reason there
      // is no refund. This is also now the ONLY way to stop a monthly plan — **Stop renewing**
      // was removed, on the ground that ending a subscription and moving to Free are one
      // decision and were two controls — so the copy has to carry what that button's own
      // confirmation used to say.
      // TWO KEYS FOR THE BILLED CASE, not one with an optional clause spliced in: the date
      // sentence sits mid-paragraph, and where it goes is a decision each language makes.
      description: billed
        ? downgradeEffective
          ? t('plan.downgradeBilledWithDate', {
            current: TIER_LABEL[current], next: TIER_LABEL[next], date: downgradeEffective,
          })
          : t('plan.downgradeBilled', { current: TIER_LABEL[current] })
        : t('plan.downgradeUnbilled', { current: TIER_LABEL[current] }),
      body: (
        <>
          <PlanChangeColumns from={current} to={next} change={change} />
          <DowngradeReauth valueRef={passwordRef} />
        </>
      ),
      wide: true,
      confirmLabel: moveLabel(current, next, t),
      destructive: true,
      // ── THE PASSWORD STEP, ON THE WAY DOWN ONLY ────────────────────────────────────
      // An upgrade that was not meant costs nothing and is undone by pressing the row
      // above it; a downgrade closes pages for every member of the family at once, and
      // the button that does it sits on a row identical to the two that do not. So the
      // one that takes something away asks for a second, deliberate act.
      //
      // WHAT IT IS: protection against an accident, and against somebody at an unlocked
      // screen. WHAT IT IS NOT: a gate. `setFamilyTier` is a `'use server'` export with a
      // URL, and the person this could be aimed at already holds `admin/family:edit` at
      // scope 'any' — they are entitled to change the plan and can post to it directly.
      // The check also runs on the browser's side of the wire, which AGENTS.md is
      // emphatic about, and moving it into the action is expressly forbidden there: it
      // would put a plaintext password in a Next.js request and publish an endpoint that
      // accepts password guesses. The copy on screen promises exactly this much.
      verify: async () => {
        const result = await verifyCurrentPassword(passwordRef.current)
        return result.ok ? null : result.message
      },
    })
    if (!ok) return

    passwordRef.current = ''
    setError('')

    // ── TWO DOORS OUT OF A PLAN, AND THE RECORD DECIDES WHICH ─────────────────────────
    // `changePlanTier` for a family that has paid: it schedules the move for the day after
    // the term ends, and routes `free` to `cancelPlanRenewal`, which is what tells Stripe to
    // stop billing. `setFamilyTier` for a family that has not: it moves `families.tier` today
    // with nothing charged and nothing to cancel.
    //
    // Picking the wrong one is not a crash, which is why it is worth stating: `setFamilyTier`
    // REFUSES while a paid term is live and answers with a message pointing at Billing, so a
    // family that had paid would press Downgrade, pass the password step, and be told to go
    // somewhere else. Both checks exist — this one so the right thing happens, and the one on
    // the server because a `'use server'` export is a public endpoint either way.
    if (billed) {
      run(() => changePlanTier(next))
      return
    }

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
    // ── IT SUPPLIES NO CARD OF ITS OWN, SINCE 2026-08-22 ─────────────────────────────
    // This was `rounded-xl border bg-card p-5 sm:p-6` — a card, because Settings was a flat
    // stack of them. Settings is a rail of two panes now and this is the whole of the Plan
    // one; keeping the card would have put a border inside a border with four pixels of card
    // showing between them. So the container, the padding and the ground all belong to
    // `FamilySettingsClient`, and this renders content.
    //
    // `<div>`, not `<section>`: a section needs an accessible name to be worth announcing as
    // a landmark, and the rail item is what names this pane. Two nested landmarks with one
    // heading between them is worse than one.
    <div>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          {/* AN `h2`. It was an `h3` for the day Settings was two panels, because a panel
              header carrying **My Plan** sat directly above it; the rail replaced that
              header, so there is nothing between this and the page's `h1` any more and an
              `h3` would skip a rank. The caption stays as it was — the rail item answers
              "which section", so this answers what the pane is FOR rather than repeating
              the tab. Every pane on Members & Access reads the same way. */}
          {/* NO SUB-CAPTION. It read "Your family's subscription covers everything on its own
              row and on every row above it" until 2026-08-25 — which is what a ladder of plans
              with a Current badge on one of them already looks like, and each row's Features
              dialog states the inheritance for that plan in full. Part of the app-wide sweep
              of captions that describe the thing under them. */}
          <h2 className="text-lg font-semibold">{t('plan.whatIncludes')}</h2>
        </div>
        <span className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-brand-legacy px-3 py-1 text-sm font-semibold text-brand-on-legacy">
          <Crown className="h-3.5 w-3.5" aria-hidden="true" /> {TIER_LABEL[current]}
        </span>
      </div>

      <FormError message={error} />

      {/* ONE ROW PER PLAN, stacked. The three used to be a `sm:grid-cols-3` row of cards
          that had to be height-matched with `items-stretch`, and none of that survives a
          row: the summary is one line by construction, so the rows are already the same
          height and the plans read in order — Free, Plus, Premium — down the page rather
          than left to right at three different lengths. */}
      <ul className="mt-5 space-y-3">
        {PLAN_ORDER.map(plan => {
          const included = tierMeets(current, plan)
          const isCurrent = plan === current
          // Above what the family is on. `tierMeets` is inclusive, so `meets(plan, current)`
          // is true for the current tier too — hence the `!isCurrent` conjunct rather than a
          // rank comparison, which would be a second expression of the ordering rule.
          const isUpgrade = !isCurrent && tierMeets(plan, current)
          // `null` for Free, which has no price rather than a price of zero — see the
          // comment beside the figure below.
          const price = TIER_PRICE[plan]
          // WHETHER THIS DEPLOYMENT CAN SELL THIS TIER. `purchasable` is resolved on the
          // SERVER from the Stripe Price ids in the environment, per §5, so a build with no
          // `STRIPE_PRICE_PLUS_*` set never renders a Plus button rather than rendering one
          // that fails at the API call. False when `billing` is null, which is a failed read
          // and not a licence to guess.
          const buyable = billing?.purchasable[plan]
          const canBuy = Boolean(buyable && (buyable.recurring || buyable.prepaid))
          return (
            <li
              key={plan}
              className={cn(
                'rounded-2xl border p-4',
                isCurrent
                  ? 'border-2 border-brand-primary/40 bg-brand-soft/40'
                  // DASHED for a plan this family is not on — the same marker the tree's
                  // empty slots use, and the only thing on the row that distinguishes
                  // "included" from "not yet" at a glance.
                  : included ? 'bg-background' : 'border-dashed bg-background',
              )}
            >
              <div className="flex flex-wrap items-center gap-2">
                <h3 className="text-base font-semibold">{TIER_LABEL[plan]}</h3>
                {isCurrent && (
                  <span className="rounded-full bg-brand-primary px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-brand-on-primary">
                    {t('plan.current')}
                  </span>
                )}
                {/* COMING SOON is a fact about the OFFER, not about this family, and it is
                    stated because the panel can otherwise show a plan with a price and no way
                    to buy it — which reads as a purchase that failed.

                    IT SAID "NOT SOLD YET" UNTIL 2026-08-25. Same fact, and the wrong end of
                    it: "not sold" describes a decision GENORRA has taken and invites the
                    question *are you going to?*, where "Coming Soon" answers it. Premium is
                    the only plan this renders for (`TIER_IS_SOLD` is true for Free, Standard
                    and Plus), so this pill is a roadmap note rather than a refusal — which is
                    also the word the marketing site uses for a feature that is on its way. */}
                {!TIER_IS_SOLD[plan] && (
                  <span className="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                    <Lock className="h-2.5 w-2.5" aria-hidden="true" /> {t('plan.comingSoon')}
                  </span>
                )}
              </div>

              {/* THE ONE-LINE SUMMARY, and it is the same sentence `/pricing` leads that
                  plan's card with — `TIER_TAGLINE` exists so the two cannot drift. */}
              <p className="mt-1 text-sm text-muted-foreground">{tierTagline(t, plan)}</p>

              {/* THE PRICE, since 2026-08-17, and it is the same number `/pricing` shows —
                  `TIER_PRICE` in lib/plans.ts is the one place it is written down, for the
                  reason that file's header gives: two copies of a figure is how an
                  administrator comes to read $10 here and $12 on the marketing site.

                  Free renders nothing. It has no price rather than a price of zero, and
                  "$0/month" on the row a family is already on is a number where a word
                  belongs — the tagline above has already said what Free is.

                  THE FIGURE IS NOT THE OFFER, and the row says so separately: `TIER_IS_SOLD`
                  is what draws the "Coming Soon" pill above, and it is false for Premium
                  alone — Standard and Plus went on sale on 2026-08-23. This comment said "for
                  every priced tier, all three of them" until 2026-08-25, which was true on the
                  day it was written and stopped being so two days later. A figure and a
                  purchase are different facts. */}
              {price && (
                <p className="mt-1 text-sm">
                  <span className="font-semibold text-brand-ink">
                    {formatPlanPrice(price.monthlyCents)}
                  </span>
                  {/* ONE RATE. The annual figure and its "(two months free)" clause were
                      withdrawn on 2026-08-19 — see `TIER_PRICE`. "No annual plan" replaces them
                      rather than a bare "/month": a figure with no term beside it invites an
                      administrator to assume a commitment, and there is none to make. */}
                  <span className="text-muted-foreground"> /month · no annual plan</span>
                </p>
              )}

              <div className="mt-3 flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
                {/* A `<button>` STYLED AS A LINK, deliberately: it opens a dialog rather
                    than going anywhere, so there is no address for an `<a>` to carry and a
                    fake one would break cmd-click for whoever tried it. The colour is set
                    explicitly for the reason AGENTS.md gives — `globals.css` puts an
                    unscoped `a { color: var(--brand-accent) }` in its base layer, and this
                    control has to match the links around it without being one. */}
                <button
                  type="button"
                  onClick={() => setDetail(plan)}
                  className="text-sm font-medium text-brand-accent underline-offset-4 hover:underline"
                >
                  {t('plan.features')}
                  <span className="sr-only"> in {TIER_LABEL[plan]}</span>
                </button>

                {/* ── THE ACTION IS ON THE ROW, SINCE 2026-08-25 ─────────────────────
                    An upgrade row printed "Set up in Billing, below" and the button that did
                    the buying was in another panel. That was a defensible split when Billing
                    lived on the same scroll and is indefensible now that it is a different
                    pane — a row naming a plan and its price, and then pointing somewhere else,
                    is a control describing a control. Somebody reading this row has already
                    decided; the button goes where the decision is made.

                    THREE STATES, AND THE MIDDLE ONE IS THE ONLY NEW BEHAVIOUR:

                      current    disabled, says so. Unchanged.
                      upgrade    opens the purchase route `beginUpgrade` picks. It reaches
                                 `startPlanCheckout` or `changePlanTier`, never
                                 `setFamilyTier` — which still refuses every move up, so the
                                 tier is granted by a webhook and not by this button.
                      downgrade  the confirmation and the password step, exactly as before.

                    `--brand-affirm` for an upgrade and `--brand-primary` for a downgrade, so
                    the row that spends money does not look like the row that stops spending
                    it. Not `--destructive` on either: nothing here deletes anything, which is
                    the distinction AGENTS.md draws between an error and a capability being
                    given up. */}
                {canEdit && (isCurrent || !isUpgrade) && (
                  <button
                    type="button"
                    disabled={isCurrent || isPending}
                    onClick={() => choose(plan)}
                    className={cn(
                      'rounded-lg px-3 py-1.5 text-sm font-medium transition-opacity disabled:opacity-60',
                      isCurrent
                        ? 'border bg-muted text-muted-foreground'
                        : 'bg-brand-primary text-brand-on-primary hover:opacity-90',
                    )}
                  >
                    {isCurrent ? t('plan.currentPlan') : moveLabel(current, plan, t)}
                  </button>
                )}

                {/* AN UPGRADE ROW OFFERS THE BUTTON ONLY WHEN A PRESS COULD ACTUALLY WORK.
                    Three things have to be true and each withholds it for a different reason:
                    the plan is on sale at all (`TIER_IS_SOLD`), the billing record loaded (§8
                    — never offer a second purchase over an unknown billing state), and this
                    DEPLOYMENT has a Stripe Price for it (`purchasable`, resolved on the server
                    per §5). Without the last one the button renders, the member decides to
                    pay, and the checkout fails at the API call. */}
                {canEdit && isUpgrade && TIER_IS_SOLD[plan] && canBuy && (
                  <button
                    type="button"
                    disabled={isPending}
                    onClick={() => beginUpgrade(plan)}
                    className="inline-flex items-center gap-1.5 rounded-lg bg-brand-affirm px-3 py-1.5 text-sm font-medium text-brand-on-affirm transition-opacity hover:opacity-90 disabled:opacity-60"
                  >
                    <CreditCard className="h-3.5 w-3.5" aria-hidden="true" />
                    {moveLabel(current, plan, t)}
                  </button>
                )}

                {/* SOLD, ABOVE WHAT THEY ARE ON, AND NOT PURCHASABLE HERE. Says so rather than
                    rendering nothing, because a row with a price and no control reads as a
                    bug. Not shown for a tier that is not sold at all — the "Coming Soon" pill
                    above has already said everything true about that one. */}
                {canEdit && isUpgrade && TIER_IS_SOLD[plan] && !canBuy && (
                  <span className="text-sm text-muted-foreground">
                    {billing ? t('plan.notOnDeployment') : t('plan.billingFailed')}
                  </span>
                )}
              </div>
            </li>
          )
        })}
      </ul>

      {/* ── THE STANDING PARAGRAPH UNDER THE ROWS WENT ON 2026-08-25 ──────────────────
          It opened "A plan changes which pages this family can open, and nothing else — every
          record you have entered stays where it is", then named the date a downgrade would
          land. The first half is a reassurance nobody had asked for yet, printed on every
          visit; the second half was the third place the product states that date, and the
          other two are the ones a reader is actually looking at when the question occurs to
          them:

            * the CONFIRMATION, before it is committed — "Nothing changes today. Plus stays
              open until the end of the period you have already paid for, and Standard starts
              on 1 October." Same `downgradeEffective`, which is why that variable is still
              computed above.
            * the BILLING pane's scheduled-change band, after it is committed.

          "Nothing is deleted" survives in the confirmation too, which is where somebody is
          deciding whether to risk it.

          THE NON-EDITOR SENTENCE STAYS, and is not the same kind of thing. It explains why
          the buttons a caller can see are absent for them and what to do about it — a fact
          about THEM that no amount of looking at the screen will produce. */}
      {!canEdit && (
        <p className="mt-4 text-sm text-muted-foreground">
          You can see the plan but not change it. Ask an administrator for the Settings
          permission.
        </p>
      )}

      {detail && (
        <PlanDetailDialog plan={detail} current={current} onClose={() => setDetail(null)} />
      )}

      {/* ── THE TWO PURCHASE DIALOGS, OPENED BY THE ROWS ABOVE ────────────────────────
          Both moved here from `BillingPanel` with the buttons that open them; neither charges
          anything, and both hand a CHOICE back to an action. `billing` is non-null in both
          branches because `canBuy` is false without it, but it is narrowed explicitly rather
          than asserted — a `!` here would be the one place this component claimed to know
          something the type system does not. */}
      {buying && billing && (
        <BuyDialog
          tier={buying}
          purchasable={billing.purchasable[buying]}
          // A live term means the current month is already owned, so there is no part month to
          // sell and nothing is charged today. `startPlanCheckout` re-derives this from the
          // record rather than trusting it — this only shapes what the dialog says.
          extendingLiveTerm={liveTerm}
          today={billing.today}
          onClose={() => setBuying(null)}
          onBuy={(mode, months, firstPayment) => {
            setBuying(null)
            run(() => startPlanCheckout({ tier: buying, mode, months, firstPayment }))
          }}
        />
      )}

      {upgrading && billing && (
        <UpgradeDialog
          fromTier={billing.paidTier}
          toTier={upgrading}
          paidThrough={billing.paidThrough}
          today={billing.today}
          onClose={() => setUpgrading(null)}
          onUpgrade={includeNextMonth => {
            setUpgrading(null)
            run(() => changePlanTier(upgrading, includeNextMonth))
          }}
        />
      )}
    </div>
  )
}

/**
 * The two sides of a plan change, side by side, inside the confirmation.
 *
 * ── WHY TWO COLUMNS AND NOT A SENTENCE ─────────────────────────────────────────────
 * The confirmation used to say "everything on Plus opens up immediately" and name not one
 * thing that did. That is fine as a summary of an upgrade and actively misleading on a
 * downgrade, where the whole question an administrator is asking is *which pages stop
 * opening* — and the answer was a screen behind the scrim, on a row they had to cancel out
 * of the dialog to read.
 *
 * So the change is stated as a difference: what MOVES on the left, what does NOT on the
 * right, and the two are the same shape in both directions. Upgrading, the left column is
 * what opens up and the right is what the family already had. Downgrading, the left column
 * is what closes and the right is what survives it — which is not a footnote to a
 * downgrade, it is most of the answer, because "nothing is deleted" is easy to write and
 * hard to believe from a dialog that lists only losses.
 *
 * `planChange()` computes both, and computes them symmetrically — see `lib/plans.ts` for
 * why a downgrade must not get its own code path.
 *
 * ── ONE COLUMN CARRIES THE MECHANISM, THE OTHER DOES NOT ───────────────────────────
 * The moving column prints each benefit's `detail` and the unchanged one prints labels
 * only. That asymmetry is the point rather than an oversight: the moving column is what is
 * being decided and deserves the sentence, while the unchanged column is context, and
 * nineteen sentences in a confirmation is a wall nobody reads before clicking the button
 * they came for. The full text of every one of them is still a click away, under "Features".
 *
 * ── BELOW `sm` THEY STACK, and the moving column is first ──────────────────────────
 * Which is why no copy anywhere says "on the left". On a phone there is no left.
 */
function PlanChangeColumns({ from, to, change }: {
  from: FamilyTier
  to: FamilyTier
  change: PlanChange
}) {
  const t = useT()
  return (
    <div className="grid gap-3 sm:grid-cols-2 sm:gap-4">
      <PlanColumn
        heading={change.up ? `What you gain on ${TIER_LABEL[to]}` : t('plan.whatYouLose')}
        tone={change.up ? 'gain' : 'lose'}
        items={change.changing}
        detailed
      />
      <PlanColumn
        heading={change.up
          ? `What you have now on ${TIER_LABEL[from]}`
          : `What you keep on ${TIER_LABEL[to]}`}
        tone="muted"
        items={change.keeping}
      />
    </div>
  )
}

/**
 * The password field a downgrade asks for, inside the confirmation.
 *
 * ── IT OWNS ITS OWN VALUE, WHICH IS NOT A STYLE CHOICE ─────────────────────────────
 * `ConfirmOptions.body` is a React node captured when `confirm()` was called; `PlanPanel`
 * never re-renders it, so an input controlled from up there would take a keystroke, drop
 * it, and render empty forever. The state lives here, where it does re-render, and the
 * value leaves through `valueRef` — which `verify` reads at the moment it runs.
 *
 * ── THE COPY SAYS WHAT THE CHECK ACTUALLY BUYS ─────────────────────────────────────
 * "So a downgrade cannot happen by accident", and not a word about security. It is a
 * browser-side check on a screen whose visitor already holds the grant to change the
 * plan (see `choose`), so anything stronger would be a promise the mechanism does not
 * keep — the same correction AGENTS.md records against the Password panel, which
 * described a field of this exact kind as protection it was not.
 */
/**
 * THE FIELD ITSELF MOVED TO `components/ui/challenge-fields.tsx` ON 2026-08-25, when
 * disconnecting Stripe became the second act asking for a password. This is the thin wrapper
 * that keeps this panel's own wording — the shared component takes `hint` per caller precisely
 * so each act can say what is true of ITS act rather than a sentence that covers both badly.
 */
function DowngradeReauth({ valueRef }: { valueRef: { current: string } }) {
  const t = useT()
  return (
    <PasswordReauthField
      valueRef={valueRef}
      id="plan-downgrade-password"
      hint={t('plan.passwordHint')}
    />
  )
}

/**
 * ONE COLUMN OF BENEFITS, and the only one — both dialogs on this panel render through it.
 *
 * They ask different questions and deliberately answer them in the same shape: the
 * confirmation puts what moves beside what does not, and "Features" puts what a plan adds
 * beside what it builds on. Two boxes, an uppercase heading with a count, a tick per
 * benefit. Forking this into a second, nearly-identical list is how the panel would end up
 * with two visual languages for one subject — and the two dialogs open from the same row,
 * a click apart, so the drift would be visible.
 *
 * `tone` colours the box and its ticks: `gain` affirms, `lose` warns, `muted` is context.
 * It is per COLUMN and never per row, which both callers earn by cutting their lists where
 * every benefit on one side has the same answer — see `PlanDetailDialog` on why the cut is
 * the design. A column needing two colours is a column split in the wrong place.
 *
 * `detailed` prints each benefit's mechanism sentence. The confirmation turns it on for the
 * moving column only, because that is what is being decided and nineteen sentences is a
 * wall nobody reads before clicking the button they came for. "Features" turns it on
 * everywhere, because reading them is the entire reason somebody opened it.
 *
 * No empty state, deliberately: every list reaching this is non-empty by construction —
 * `choose()` returns early on an unchanged plan, `keeping` always holds Free at minimum,
 * and the detail dialog renders its second column only when there is a tier beneath.
 */
function PlanColumn({ heading, tone, items, detailed = false }: {
  heading: string
  tone: 'gain' | 'lose' | 'muted'
  items: readonly PlanHighlight[]
  detailed?: boolean
}) {
  const Icon = tone === 'lose' ? X : Check
  return (
    <section
      className={cn(
        'rounded-xl border p-4',
        tone === 'gain' ? 'border-brand-affirm/40 bg-brand-affirm/5'
          : tone === 'lose' ? 'border-brand-withheld/40 bg-brand-withheld/5'
            : 'bg-muted/40',
      )}
    >
      <h3 className="flex flex-wrap items-center gap-2 text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">
        {heading}
        {/* AN HONEST COUNT, the same rule `PersonMultiSelect` states: a list somebody is
            about to act on says how long it is, so "a few pages" is never the impression
            twelve of them leave. */}
        <span className="rounded-full bg-background px-1.5 py-0.5 text-[10px] tabular-nums">
          {items.length}
        </span>
      </h3>
      <ul className="mt-3 space-y-2 text-sm">
        {items.map(item => (
          <li key={item.label} className="flex gap-2">
            <Icon
              className={cn(
                'mt-0.5 h-3.5 w-3.5 shrink-0',
                tone === 'gain' ? 'text-brand-affirm'
                  : tone === 'lose' ? 'text-brand-withheld'
                    : 'text-muted-foreground',
              )}
              aria-hidden="true"
            />
            <span>
              <span className="block font-medium">{item.label}</span>
              {detailed && (
                <span className="block text-xs text-muted-foreground">{item.detail}</span>
              )}
            </span>
          </li>
        ))}
      </ul>
    </section>
  )
}

/**
 * Everything one plan gets you, in a dialog.
 *
 * ── IT SHOWS THE WHOLE OFFER, NOT JUST THE DIFFERENCE ──────────────────────────────
 * `PLAN_ADDS` holds what each tier ADDS on the one below it, which is the right shape to
 * store and the wrong answer to "what do I get on Premium?" — read literally it says five
 * things and omits the fourteen that make up most of the product. The panel's old cards
 * papered over that with an "Everything in Plus" row that named the tier and listed none
 * of it, which is fine as a column heading and useless as the answer.
 *
 * ── TWO COLUMNS, THE SAME TWO THE CONFIRMATION USES ────────────────────────────────
 * It used to walk `tiersIncludedIn(plan)` and print a stacked group per tier — correct, and
 * a third layout on a panel that now had two. Both dialogs open from the same row a click
 * apart, so the split is the same split and the parts are the same `PlanColumn`: what you
 * do not have yet on the left, what you already do on the right.
 *
 * ── WHERE IT CUTS IS THE WHOLE DESIGN, AND CUTTING AT THE WRONG RUNG IS A LIE ──────
 * The obvious cut is the tier directly beneath the plan — what it ADDS beside what it
 * BUILDS ON — and it is wrong for the case that matters most. A FREE family opening
 * Premium is buying Plus as well, and that cut filed Plus's seven benefits under "also
 * included", beside Free's, as though the family already had them: the most expensive
 * decision on the panel, answered with five of the twelve things it buys.
 *
 * So the cut is at what the family HAS, whenever the plan is above it. Free reading
 * Premium gets twelve on the left and its own seven on the right — the same two lists, in
 * the same order, as the confirmation that follows from pressing Upgrade, which is the
 * point: the dialog that answers "what would I get?" and the one that asks "are you sure?"
 * cannot disagree.
 *
 * A plan the family already holds has no such boundary — nothing on it is unbought — so
 * that one falls back to the structural cut, adds beside builds-on. Free has neither, and
 * renders one full-width column rather than a column and a gap.
 *
 * That cut is also what makes a per-benefit tick unnecessary: on either side of it every
 * benefit has the same answer to "is this switched on?", so the column can say it once.
 * Cutting anywhere else produces a column the family half-owns, and a half-owned column
 * has to be coloured row by row or it misstates one half.
 *
 * ── THE STATUS LINE IS NOT DECORATION ──────────────────────────────────────────────
 * The same list means two different things depending on the family reading it — a
 * description of what they have, or of what they would get — and the dialog is opened from
 * a row whose own badges scroll out of sight behind the scrim. One sentence at the top
 * says which, so nobody reads Premium's list as an inventory of their Free family.
 *
 * NO UPGRADE BUTTON HERE, on purpose. The rows behind this are three lines tall and the one
 * that was clicked is directly underneath the dialog; a second copy of the control would be
 * a second place for a plan change to be initiated, and a plan change is the one thing on
 * this panel with a confirmation step in front of it.
 */
function PlanDetailDialog({ plan, current, onClose }: {
  plan: FamilyTier
  current: FamilyTier
  onClose: () => void
}) {
  const t = useT()
  const intl = useIntlTag()
  const included = tierMeets(current, plan)

  // WHERE THE TWO COLUMNS MEET — see the note above, this line is the whole of it. A plan
  // above the family cuts at what they HAVE, so a two-rung jump puts both rungs on the left.
  // A plan they already hold has no such boundary and cuts structurally instead.
  //
  // ANNOTATED as optional because `noUncheckedIndexedAccess` is off: Free has nothing
  // beneath it, so the index runs off the front of `PLAN_ORDER` and TypeScript would
  // otherwise call the `undefined` a `FamilyTier` and let a `TIER_LABEL[splitAt]` past that
  // renders "undefined" on the one plan every family starts on.
  const splitAt: FamilyTier | undefined = included
    ? PLAN_ORDER[PLAN_ORDER.indexOf(plan) - 1]
    : current

  const gains = planAddsBetween(t, splitAt, plan)
  const held = splitAt ? planAddsBetween(t, undefined, splitAt) : []

  // Dearest first, so the heading reads down the way the plans do: "from Plus and Free".
  //
  // THE JOIN IS `Intl.ListFormat` NOW, not a hand-written " and ". Spanish needs *y* — and
  // *e* before a word beginning with an i sound — while French needs *et*, and neither
  // punctuates a three-item list the way English does. One platform call answers all three,
  // and it is the same argument `weekdayNames()` makes about not hand-writing a table the
  // browser already has.
  const heldNames = (splitAt ? tiersIncludedIn(splitAt) : []).reverse().map(x => TIER_LABEL[x])
  const heldFrom = new Intl.ListFormat(intl, { style: 'long', type: 'conjunction' })
    .format(heldNames)

  return (
    <Dialog
      open
      onClose={onClose}
      title={`${TIER_LABEL[plan]} — what you get`}
      description={tierTagline(t, plan)}
      // The same measure the confirmation takes, for the same reason: two columns of
      // benefits with a sentence of mechanism under each cannot be read at `lg`.
      className="sm:max-w-2xl"
    >
      <p className="text-sm text-muted-foreground">
        {plan === current
          ? t('plan.yoursToday')
          : included
            ? `Included in ${TIER_LABEL[current]}, which your family is on. Everything here is switched on.`
            // NOT "everything here would open up" — most of the right-hand column is
            // already open, and the cut is what makes that sentence sayable at all.
            : `Your family is on ${TIER_LABEL[current]}. Here is what ${TIER_LABEL[plan]} `
              + 'would add, beside what you already have.'}
        {(() => {
          // THE PRICE BELONGS IN THIS SENTENCE, not only on the row behind the dialog.
          // Whoever opened "Features" is deciding, and the panel's own row is now covered
          // by the dialog they opened to decide with. `TIER_PRICE` again — one figure,
          // three renderings.
          //
          // THE WHOLE BLOCK WAS BEHIND `!TIER_IS_SOLD[plan]` UNTIL 2026-08-23, which was
          // right while no plan was for sale and inverted the moment two of them were: the
          // price disappeared from exactly the plans somebody might buy, and survived only
          // on the one they cannot. The RATE is unconditional now; only the clause about
          // there being no way to pay is conditional, because only for Premium is it true.
          const price = TIER_PRICE[plan]
          if (!price) return ''
          const rate = ` ${TIER_LABEL[plan]} is ${formatPlanPrice(price.monthlyCents)} a month, month to month.`
          return TIER_IS_SOLD[plan]
            ? `${rate} It is set up in the Billing section of Settings.`
            : `${rate} There is no payment step yet — nothing here is billed.`
        })()}
      </p>

      <div className={cn('mt-5 grid gap-3', splitAt && 'sm:grid-cols-2 sm:gap-4')}>
        <PlanColumn
          heading={included
            ? splitAt
              ? `What ${TIER_LABEL[plan]} adds`
              : `What ${TIER_LABEL[plan]} includes`
            : `What you would gain on ${TIER_LABEL[plan]}`}
          tone="gain"
          items={gains}
          detailed
        />
        {splitAt && (
          <PlanColumn
            heading={included
              ? `Also included, from ${heldFrom}`
              // The same words the confirmation uses for the same list, deliberately.
              : `What you have now on ${TIER_LABEL[current]}`}
            tone="muted"
            items={held}
            detailed
          />
        )}
      </div>
    </Dialog>
  )
}
