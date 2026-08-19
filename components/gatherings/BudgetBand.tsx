import { cn } from '@/lib/utils'
import { formatCurrency } from '@/lib/currency-utils'
import { HelpLink } from '@/components/help/HelpLink'
import { gatheringBudgetMath } from '@/lib/gathering-budget'
import type { GatheringBudgetView, GatheringBudgetState } from '@/app/actions/gatherings'

/**
 * A gathering's money, and the red line.
 *
 * This is the band the whole feature was asked for: "the budget amount can exceed the amount
 * of money in the fund and will show as a red line". Everything here is presentation over
 * `gatheringBudgetMath`, which is the one place the comparisons are decided and the one place
 * they are tested (`lib/gathering-budget.test.ts`, checked by mutation).
 *
 * ── IT IS READ-ONLY, AND THAT IS THE API ────────────────────────────────────────────
 * No controls, no form, no action import. Two screens render it — `/gatherings/[id]`, where
 * there is nothing to edit, and `/admin/gatherings/[id]`, which renders its OWN fund and
 * budget form beside it. Putting the form inside would mean the member-facing copy shipped a
 * disabled version of an organizer's control, which is the "hide the button" failure AGENTS.md
 * §5 is about wearing a different hat: a member who cannot write the budget is refused by the
 * action, not by a band that declined to draw a button.
 *
 * ── WHICH GRANT ACTUALLY REFUSES THE WRITE, BECAUSE IT IS NOT THIS KEY ──────────────
 * `setGatheringBudget` gates on **`admin/gatherings:edit`**. It does NOT consult
 * `gatherings/budget` at all, and it cannot: `20260819000000` registers that key with
 * `actions = ARRAY['view']`, so there is no `edit` action on it for a family to grant or
 * withhold and no `canAny(…, 'gatherings/budget', 'edit')` that could ever answer true.
 *
 * So the two keys divide differently from how a reader expects: `admin/gatherings:edit` is the
 * WRITE authority over a gathering's money, and `gatherings/budget:view` withholds the FIGURES
 * — this band, the per-task budget column, and the fund balances in the organizer's picker.
 * They are orthogonal, which means a family can hand somebody the console's `edit` and still
 * keep the money off their screen; that member can set a budget they cannot then read back.
 * That is a real consequence and it is stated here rather than discovered.
 *
 * This comment previously asserted a `gatherings/budget:edit` gate at scope `'any'`. There has
 * never been one. A future reader auditing the money would have read that sentence and stopped
 * looking, which is the whole cost of a comment that describes a stronger model than the code.
 *
 * ── `budget === null` IS TWO DIFFERENT FACTS, AND `state` IS WHICH ──────────────────
 * A null budget used to mean one thing here and it never did mean one thing. `state` is what
 * tells them apart, and getting it wrong tells a member something false in both directions:
 *
 *   * **`'withheld'` RENDERS NOTHING AT ALL.** The caller does not hold `gatherings/budget:view`
 *     and `getGatheringDetail` did not run the query — not a figure fetched and hidden
 *     (AGENTS.md §5). So there is nothing to say and, importantly, no placeholder saying money
 *     exists: a band reading "Budget — hidden" tells every member of every family that this
 *     gathering has money attached, which is exactly the fact the restricted key withholds.
 *   * **`'unavailable'` SAYS SO, IN ONE LINE.** The caller IS entitled and the read failed —
 *     `readBudget` returned null, or `taskBudgetLines` was refused. Rendering nothing here would
 *     report a transient failure as a permission the family had taken away, and it is the worse
 *     of the two because it is silent: the member sees a screen that looks complete and simply
 *     has no money on it. Nothing is leaked by saying it, because the caller holds the key.
 *   * **`'shown'`** is the ordinary case and needs `budget` to be non-null; a `'shown'` with a
 *     null budget is a bug in the caller, and this component renders nothing rather than
 *     throwing over it.
 *
 * The sentence is a muted panel and NOT `FormError`. `form-message.tsx` owns reporting a refused
 * OPERATION and is an assertive live region — right for a save that came back no, wrong for a
 * page that failed to read something before anybody did anything, where an assertive
 * announcement interrupts a screen reader for a state the reader did not cause. It is not
 * `--brand-withheld` either: that token is for a capability being withheld, which is precisely
 * the case this one exists to be told apart from.
 *
 * ── FOUR STATES, AND THEY ARE DIFFERENT SENTENCES ───────────────────────────────────
 * The two failure modes look similar on a screen and are not the same thing, so they are
 * coloured and worded apart:
 *
 *   * **OVER THE FUND is `--destructive`.** The gathering budgeted more than the fund holds.
 *     That is an error the family has to act on — raise money, cut the plan, or move the
 *     gathering — and `lib/gathering-budget.ts`'s header says in terms that this is the case
 *     `--destructive` is for.
 *   * **OVER-ALLOCATED is `--brand-withheld`.** The task lines together claim more than the
 *     gathering budgeted. Nothing has failed and nothing has been overspent: a claim is not a
 *     payment, and the organizer fixes it by trimming a line or raising the budget. It reads
 *     as a warning rather than an alarm for the same reason a returned task does — Warmth,
 *     used as a foreground and as a tint under one, which is the only thing that token may be
 *     (it has no `on-` partner, deliberately).
 *   * **THE TWO OVER-FUND SENTENCES ARE BOTH RENDERED.** `overFund` is "this gathering alone
 *     costs more than the fund holds"; `overFundWithOthers` is "this one plus what the other
 *     live gatherings already claim". They are two different questions to a family — one is an
 *     overrun of its own, the other is a question about which gathering goes first — and a
 *     band showing only the second would tell an organizer their own reunion was fine when it
 *     is not.
 *   * **NO MARKER AT ALL WHEN THE BALANCE IS UNKNOWN.** `fundBalanceCents: null` is "no fund
 *     attached" or "the balance was not read", and `gatheringBudgetMath` returns both
 *     over-fund flags `false` for exactly that reason. NOT ENTITLED TO SEE IT IS NOT
 *     OVERSPENT — a red line drawn on an unseen balance is an alarm nothing on the screen
 *     could explain.
 *
 * ── EVERY FIGURE COMES FROM THE RETURNED MATH, NEVER FROM THE PROP ──────────────────
 * `math.budgetCents` is the NORMALISED figure — rounded, clamped at zero, with `NaN` and
 * `Infinity` read as absent — so rendering `budget.budgetCents` instead would print a value
 * the comparisons above were not made against. The one exception is `fundName`, which is not a
 * number and so is not the math module's business.
 */
export interface BudgetBandProps {
  /** From `getGatheringDetail` / `getAdminGatheringDetail`. Null for both null states below. */
  budget: GatheringBudgetView | null
  /**
   * Which null this is — see the header. REQUIRED, and deliberately not defaulted: a default of
   * `'withheld'` would make the silent case the one a new call site got for free, and that is the
   * bug this prop exists to close.
   */
  state: GatheringBudgetState
  /** Extra classes for placement only. */
  className?: string
}

export function BudgetBand({ budget, state, className }: BudgetBandProps) {
  // The caller is entitled and the figures did not come back. Say it, once, in the space the
  // band would have occupied — see the header on why this is neither nothing nor a FormError.
  if (state === 'unavailable') {
    return (
      <div
        className={cn(
          'rounded-2xl border bg-muted/40 px-4 py-3 text-sm text-muted-foreground',
          className,
        )}
      >
        The budget for this gathering could not be read just now. Nothing has changed — reload the
        page to try again.
      </div>
    )
  }

  // `'withheld'`, and the belt-and-braces case of a `'shown'` with no figures behind it.
  if (state !== 'shown' || !budget) return null

  const math = gatheringBudgetMath({
    budgetCents: budget.budgetCents,
    lineCents: budget.lineCents,
    fundBalanceCents: budget.fundBalanceCents,
    otherCommittedCents: budget.otherCommittedCents,
  })

  const lines = budget.lineCents.filter(cents => cents != null).length
  const hasBudget = math.budgetCents !== null
  const knowBalance = math.fundBalanceCents !== null

  // Which of the four figures gets a tone, decided once so the tiles cannot disagree with the
  // sentences underneath them. `unallocated` carries the withheld tone only when it is
  // genuinely over — money left over is not a warning.
  const unallocatedTone = math.overAllocated ? 'withheld' : undefined
  const balanceTone = math.overFund ? 'destructive' : undefined

  return (
    <section
      /* ONE OF THESE PER PAGE, so a constant id is safe — the same bargain `AuthAside` states
         for its own. Both callers render exactly one band: `/gatherings/[id]` has one gathering
         and `/admin/gatherings/[id]` puts its form beside a single band. A SECOND band on one
         page would be two elements carrying this id, and `aria-labelledby` resolves to the
         first match — so the second band would take the first one's name. If a screen ever
         needs two (a comparison view, a list of gatherings with their money inline), give this
         an `id` prop before adding the second, not after. */
      aria-labelledby="gathering-budget-heading"
      className={cn('rounded-2xl border bg-card p-4 sm:p-5', className)}
    >
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        {/* `h2` takes `--brand-ink` from the base layer and sits on the card's own ground, so
            it needs no colour class of its own.

            THE HELP LINK IS PLACED HERE ON PURPOSE, and it is one of three in the whole
            feature. `HelpLink`'s own test is whether there is a paragraph a member standing at
            this control needs and would not go looking for — and this band has four figures
            whose relationship is not on the screen: "Claimed by tasks" is what the task lines
            add up to and NOT what has been spent, over-allocated is a warning while over the
            fund is an error, and an unknown balance draws no line at all. `gatherings#budget`
            is that paragraph. `icon`, not `inline`: the words would compete with the heading
            they sit beside, and the label is what names the destination for a screen reader.

            It is inside the `<h2>`'s own flex row rather than after the fund sentence, so the
            question mark reads as being about the band and not about the fund. */}
        <div className="flex items-center gap-1">
          <h2 id="gathering-budget-heading" className="text-lg">Budget</h2>
          <HelpLink slug="gatherings" section="budget" label="How a gathering's budget works" />
        </div>
        <p className="text-xs text-muted-foreground">
          {budget.fundName
            ? <>Drawn on <span className="font-medium text-foreground">{budget.fundName}</span></>
            : 'No fund attached yet'}
        </p>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        <Figure
          label="Budgeted"
          value={hasBudget ? formatCurrency(math.budgetCents) : '—'}
          caption={hasBudget ? 'What this gathering plans to spend' : 'Nobody has set a budget'}
        />
        <Figure
          label="Claimed by tasks"
          value={formatCurrency(math.linesTotalCents)}
          caption={lines === 0
            ? 'No task carries a budget line'
            : `${lines} ${lines === 1 ? 'task line' : 'task lines'}`}
        />
        <Figure
          label={math.overAllocated ? 'Over the budget' : 'Unallocated'}
          /* `unallocatedCents` is the one signed field the math module returns, and its sign IS
             its meaning. The magnitude comes from `overAllocatedByCents`, which floors at zero,
             so this never prints "over -$450". */
          value={hasBudget
            ? formatCurrency(math.overAllocated ? math.overAllocatedByCents : math.unallocatedCents)
            : '—'}
          caption={!hasBudget
            ? 'Set a budget to see what is left'
            : math.overAllocated
              ? 'The task lines claim more than the budget'
              : 'Still to hand out to a task'}
          tone={unallocatedTone}
        />
        <Figure
          label="In the fund"
          value={knowBalance ? formatCurrency(math.fundBalanceCents) : '—'}
          caption={knowBalance
            ? (budget.otherCommittedCents > 0
                ? `${formatCurrency(budget.otherCommittedCents)} of it is claimed by other gatherings`
                : 'Nothing else is claiming it')
            : budget.fundName
              ? 'The balance was not available'
              : 'A budget needs a fund to draw on'}
          tone={balanceTone}
        />
      </div>

      {/* ── THE RED LINE ─────────────────────────────────────────────────────────────
          Both over-fund sentences, in this order: the gathering's own overrun first, because
          it is the one the organizer of THIS gathering can act on, then the collective claim,
          which is a conversation with whoever runs the fund. */}
      {math.overFund && (
        <p className="mt-4 rounded-xl border border-destructive/40 bg-destructive/5 px-4 py-3 text-sm text-destructive">
          This gathering&rsquo;s budget of{' '}
          <span className="font-semibold tabular-nums">{formatCurrency(math.budgetCents)}</span>{' '}
          is <span className="font-semibold tabular-nums">{formatCurrency(math.overFundByCents)}</span>{' '}
          more than {budget.fundName ?? 'the fund'} holds.
        </p>
      )}
      {/* THE SECOND SENTENCE IS SUPPRESSED WHEN NOTHING ELSE IS CLAIMING THE FUND, and that
          loses nothing: with `otherCommittedCents === 0` the two comparisons are arithmetically
          identical, so `overFundWithOthers` says exactly what the line above already said, in a
          sentence about other gatherings that do not exist. The case this line exists for —
          this gathering is inside the fund on its own and outside it once the others are counted
          — always has other claims by construction. */}
      {math.overFundWithOthers && budget.otherCommittedCents > 0 && (
        <p className={cn(
          'rounded-xl border border-destructive/40 bg-destructive/5 px-4 py-3 text-sm text-destructive',
          // Tucked under the first sentence when both are showing, so the two read as one block
          // about the same fund rather than as two unrelated alarms.
          math.overFund ? 'mt-2' : 'mt-4',
        )}>
          Other live gatherings already claim{' '}
          <span className="font-semibold tabular-nums">{formatCurrency(budget.otherCommittedCents)}</span>{' '}
          of the same fund, so {formatCurrency(math.totalCommittedCents)} is committed against{' '}
          {budget.fundName ?? 'the fund'} —{' '}
          <span className="font-semibold tabular-nums">{formatCurrency(math.overFundWithOthersByCents)}</span>{' '}
          more than it holds.
        </p>
      )}

      {/* A QUIETER LINE, AND A DELIBERATELY DIFFERENT ONE. Over-allocated is not an overrun of
          the family's money — it is the task lines outrunning the figure the organizer wrote
          down, which is fixed by editing one of them. */}
      {math.overAllocated && (
        <p className="mt-2 rounded-xl border border-brand-withheld/40 bg-brand-withheld/5 px-4 py-3 text-sm text-brand-withheld">
          The task budgets add up to{' '}
          <span className="font-semibold tabular-nums">{formatCurrency(math.linesTotalCents)}</span>,{' '}
          which is <span className="font-semibold tabular-nums">{formatCurrency(math.overAllocatedByCents)}</span>{' '}
          more than this gathering budgeted. Nothing has been spent — raise the budget or trim a
          task line.
        </p>
      )}
    </section>
  )
}

/**
 * One headline figure, the same shape `DuesProjectionsClient` uses for its four.
 *
 * It is a local copy rather than an import because that one is private to its own module, and
 * a third tone (`destructive`, for a fund the budget has outrun) would have to be added to it
 * for one caller. `tabular-nums` is load-bearing rather than tidy: a column of amounts that do
 * not line up reads as four unrelated numbers, and a figure that changes width shifts its own
 * caption.
 *
 * The tone names a brand ROLE and never a hue, and each is used as a FOREGROUND on the card's
 * own ground — which is the only thing `--brand-withheld` may ever be.
 */
function Figure({ label, value, caption, tone }: {
  label: string
  value: string
  caption: string
  tone?: 'withheld' | 'destructive'
}) {
  return (
    <div className="rounded-xl border bg-background p-3">
      <p className="text-xs font-medium text-muted-foreground">{label}</p>
      <p className={cn(
        'mt-1 text-xl font-semibold leading-none tabular-nums sm:text-2xl',
        tone === 'withheld' ? 'text-brand-withheld' : tone === 'destructive' ? 'text-destructive' : '',
      )}>
        {value}
      </p>
      <p className="mt-1.5 text-xs text-muted-foreground">{caption}</p>
    </div>
  )
}
