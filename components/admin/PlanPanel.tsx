'use client'

import { useRef, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Check, Crown, Lock, X } from 'lucide-react'
import { Dialog } from '@/components/ui/dialog'
import { useConfirm } from '@/components/ui/confirm'
import { FormError } from '@/components/ui/form-message'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { verifyCurrentPassword } from '@/lib/supabase/client'
import { useServerState } from '@/lib/use-server-state'
import { setFamilyTier } from '@/app/actions/admin/family'
import {
  PLAN_ORDER, TIER_IS_SOLD, TIER_PRICE, formatPlanPrice,
  planAddsBetween, planChange,
  type PlanChange, type PlanHighlight,
} from '@/lib/plans'
import {
  TIER_LABEL, TIER_TAGLINE, tierMeets, tiersIncludedIn, type FamilyTier,
} from '@/lib/tiers'
import { cn } from '@/lib/utils'

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
function moveLabel(current: FamilyTier, to: FamilyTier): string {
  return tierMeets(to, current)
    ? `Upgrade to ${TIER_LABEL[to]}`
    : `Downgrade to ${TIER_LABEL[to]}`
}

export function PlanPanel({ tier, canEdit }: { tier: FamilyTier; canEdit: boolean }) {
  const router = useRouter()
  const confirm = useConfirm()
  const [current, setCurrent] = useServerState(tier)
  const [detail, setDetail] = useState<FamilyTier | null>(null)
  const [error, setError] = useState('')
  const [isPending, startTransition] = useTransition()

  // A REF, NOT STATE, and that is forced rather than chosen: the field lives inside the
  // confirmation's `body`, which is a node captured at the moment `confirm()` is called
  // and never re-rendered by this component again. A controlled input bound to state up
  // here would sit frozen at the empty string. So `DowngradeReauth` owns the value and
  // writes it out through this, and `verify` reads it at the moment it is asked.
  const passwordRef = useRef('')

  async function choose(next: FamilyTier) {
    if (next === current) return
    const change = planChange(current, next)
    const up = change.up
    // Never carried between two confirmations — a downgrade cancelled and reopened must
    // ask again, and a password left in a ref is one a later action could spend.
    passwordRef.current = ''
    const ok = await confirm({
      title: up
        ? `Upgrade this family to ${TIER_LABEL[next]}?`
        : `Downgrade this family to ${TIER_LABEL[next]}?`,
      // THE SENTENCE STILL STANDS ON ITS OWN, and neither half refers to the other's
      // position — no "the pages below". It is what `aria-describedby` names, it is all
      // the native fallback can show, and on a phone the columns stack so there is no
      // "left" to point at. It says what HAPPENS; the columns say to WHAT.
      description: up
        ? `Everything on ${TIER_LABEL[next]} opens up immediately. Nothing is billed — `
          + 'there is no payment step yet.'
        : `Pages that are part of ${TIER_LABEL[current]} stop opening. Nothing is `
          + 'deleted: every record stays exactly where it is, and moving back up brings '
          + 'the pages back with their data intact.',
      body: (
        <>
          <PlanChangeColumns from={current} to={next} change={change} />
          {!up && <DowngradeReauth valueRef={passwordRef} />}
        </>
      ),
      wide: true,
      confirmLabel: moveLabel(current, next),
      destructive: !up,
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
      verify: up ? undefined : async () => {
        const result = await verifyCurrentPassword(passwordRef.current)
        return result.ok ? null : result.message
      },
    })
    if (!ok) return

    passwordRef.current = ''
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
          <h2 className="text-lg font-semibold">What each plan includes</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Your family&rsquo;s subscription covers everything on its own row and on every
            row above it.
          </p>
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
          // `null` for Free, which has no price rather than a price of zero — see the
          // comment beside the figure below.
          const price = TIER_PRICE[plan]
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

              {/* THE ONE-LINE SUMMARY, and it is the same sentence `/pricing` leads that
                  plan's card with — `TIER_TAGLINE` exists so the two cannot drift. */}
              <p className="mt-1 text-sm text-muted-foreground">{TIER_TAGLINE[plan]}</p>

              {/* THE PRICE, since 2026-08-17, and it is the same number `/pricing` shows —
                  `TIER_PRICE` in lib/plans.ts is the one place it is written down, for the
                  reason that file's header gives: two copies of a figure is how an
                  administrator comes to read $10 here and $12 on the marketing site.

                  Free renders nothing. It has no price rather than a price of zero, and
                  "$0/month" on the row a family is already on is a number where a word
                  belongs — the tagline above has already said what Free is.

                  NOT A CHECKOUT, and the row says so separately: `TIER_IS_SOLD` is what
                  draws the "Not sold yet" pill above, and it is false for every priced tier —
                  all three of them. A figure and a purchase are different facts. */}
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
                  Features
                  <span className="sr-only"> in {TIER_LABEL[plan]}</span>
                </button>

                {canEdit && (
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
                    {isCurrent ? 'Current plan' : moveLabel(current, plan)}
                  </button>
                )}
              </div>
            </li>
          )
        })}
      </ul>

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

      {detail && (
        <PlanDetailDialog plan={detail} current={current} onClose={() => setDetail(null)} />
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
  return (
    <div className="grid gap-3 sm:grid-cols-2 sm:gap-4">
      <PlanColumn
        heading={change.up ? `What you gain on ${TIER_LABEL[to]}` : 'What you lose'}
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
function DowngradeReauth({ valueRef }: { valueRef: { current: string } }) {
  const [value, setValue] = useState('')

  return (
    <div className="mt-4 rounded-xl border border-brand-withheld/40 bg-brand-withheld/5 p-4">
      <Label htmlFor="plan-downgrade-password">Confirm with your password</Label>
      <Input
        id="plan-downgrade-password"
        type="password"
        // `current-password`, so a password manager offers the right entry rather than
        // treating this as a new one to save over the account's real password.
        autoComplete="current-password"
        value={value}
        onChange={e => {
          setValue(e.target.value)
          valueRef.current = e.target.value
        }}
        className="mt-1.5 max-w-sm"
      />
      <p className="mt-2 text-xs text-muted-foreground">
        Your sign-in password, so a plan cannot be downgraded by accident.
      </p>
    </div>
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

  const gains = planAddsBetween(splitAt, plan)
  const held = splitAt ? planAddsBetween(undefined, splitAt) : []

  // Dearest first, so the heading reads down the way the plans do: "from Plus and Free".
  const heldNames = (splitAt ? tiersIncludedIn(splitAt) : []).reverse().map(t => TIER_LABEL[t])
  const heldFrom = heldNames.length > 1
    ? `${heldNames.slice(0, -1).join(', ')} and ${heldNames[heldNames.length - 1]}`
    : heldNames[0]

  return (
    <Dialog
      open
      onClose={onClose}
      title={`${TIER_LABEL[plan]} — what you get`}
      description={TIER_TAGLINE[plan]}
      // The same measure the confirmation takes, for the same reason: two columns of
      // benefits with a sentence of mechanism under each cannot be read at `lg`.
      className="sm:max-w-2xl"
    >
      <p className="text-sm text-muted-foreground">
        {plan === current
          ? 'This is your family’s plan today. Everything here is switched on.'
          : included
            ? `Included in ${TIER_LABEL[current]}, which your family is on. Everything here is switched on.`
            // NOT "everything here would open up" — most of the right-hand column is
            // already open, and the cut is what makes that sentence sayable at all.
            : `Your family is on ${TIER_LABEL[current]}. Here is what ${TIER_LABEL[plan]} `
              + 'would add, beside what you already have.'}
        {!TIER_IS_SOLD[plan] && (() => {
          // THE PRICE BELONGS IN THIS SENTENCE, not only on the row behind the dialog.
          // Whoever opened "Features" is deciding, and the panel's own row is now covered
          // by the dialog they opened to decide with. `TIER_PRICE` again — one figure,
          // three renderings.
          const price = TIER_PRICE[plan]
          const rate = price
            ? ` ${TIER_LABEL[plan]} is ${formatPlanPrice(price.monthlyCents)} a month, month to month.`
            : ''
          return `${rate} There is no payment step yet — nothing here is billed.`
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
