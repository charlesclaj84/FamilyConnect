'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { CheckCircle2 } from 'lucide-react'
import { Select } from '@/components/ui/select'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { formatCurrency } from '@/lib/currency-utils'
import { formatDate } from '@/lib/date-utils'
import {
  currentPeriodStart, duesPlanMath, isOutstanding,
  PAY_CADENCES, type PayCadence,
} from '@/lib/dues-utils'
import { useConfirm } from '@/components/ui/confirm'
import { COLLAPSING_CELL, MetaDot, MetaIf } from '@/components/ui/table-collapse'
import { FormError } from '@/components/ui/form-message'
import { useServerState } from '@/lib/use-server-state'
import { setMyDuesPlan, setMyDuesOptOut, type DuesSummary } from '@/app/actions/dues'
import { HelpLink } from '@/components/help/HelpLink'
import { DuesBalanceKpi } from '@/components/dues/DuesBalanceKpi'
import { NextInstallmentsCard } from '@/components/account/NextInstallmentsCard'
import { SortTh, type SortDir } from '@/components/account/sortable-header'

type DuesCol = 'schedule' | 'amount' | 'due_date'

const fmtDate = (s: string) => formatDate(s) ?? ''

/**
 * The member's own dues: what they are on, what each installment costs, and the two
 * things they may change about it — the cadence, and declining an optional due.
 *
 * ONE OF THE TWO HALVES OF THE OLD `DuesDetailSection`, which was a rail over three
 * panes on /account-summary until 20260815000000 gave each pane a screen. The other is
 * `PaymentHistorySection`. What was shared between them — the sortable heading, the two
 * stat cards — is shared as components rather than by living in one file, so the split
 * cost no duplication.
 *
 * The cards ABOVE the table are the same two [Summary](/account-summary) leads with,
 * and they read from `rows` rather than the `summary` prop so a cadence change or an
 * opt-out moves them before the round trip lands.
 */
export function DuesPlanSection({ summary }: { summary: DuesSummary[] }) {
  const router = useRouter()
  const confirm = useConfirm()
  const [isPending, startTransition] = useTransition()

  // Local mirror of summary so cadence changes recompute installments instantly.
  // `useServerState` re-syncs it whenever the server re-fetches — after recording a
  // payment, and after an admin adds a dues schedule, which revalidates this page.
  const [rows, setRows] = useServerState<DuesSummary[]>(summary)
  const [error, setError] = useState('')

  const unpaid = rows.filter(isOutstanding)
  const declined = rows.filter(s => s.optedOut)
  // NOT YET OWED, which is not the same as settled and must not read as it. An
  // age-exempt due has a remaining balance of zero, so `isOutstanding` drops it and the
  // member would otherwise see nothing at all where a due they are about to inherit
  // ought to be. Listed at the end of the table with its own pill and the date it
  // starts — a schedule that appears out of nowhere on somebody's eighteenth birthday
  // is the surprise this avoids.
  const notYetOwed = rows.filter(s => s.ageExempt && !s.optedOut)

  /**
   * Recompute a row's plan for a cadence the member has just picked, without waiting
   * for the server.
   *
   * The SAME function the server ran, from lib/dues-utils.ts — which is why that module
   * exists at all. Every input is already on the row: `currentPeriodStart` reads the
   * schedule's own dates (all serialized), and settled money is the two figures the
   * summary already carries. Nothing new crosses the wire for this.
   *
   * `new Date()` here is the browser's clock against a period start the server sent, so
   * a member sitting on the far side of a date boundary can see a figure one rung
   * different from what `router.refresh()` then returns. That is a one-day skew on an
   * optimistic preview which the refresh corrects a moment later, and it is the price
   * of not making the member wait for a round trip to see what a plan costs.
   */
  const planFor = (r: DuesSummary, cadence: PayCadence) => duesPlanMath({
    schedule: r.schedule,
    cadence,
    periodStart: currentPeriodStart(r.schedule),
    today: new Date().toISOString().slice(0, 10),
    settledCents: r.amountPaidThisPeriodCents + r.amountWaivedThisPeriodCents,
    // THE MEMBER'S FIGURE, not the schedule's. `annualTotalCents` on the row is already
    // scaled by the age rule where one applies, and reading the schedule instead would
    // make this preview quietly disagree with the server about a prorated first year —
    // right up until `router.refresh()` corrected it, which is the worst kind of
    // disagreement because it looks like the change did something.
    annualCents: r.annualTotalCents,
  })

  async function changeCadence(scheduleId: string, cadence: PayCadence) {
    const row = rows.find(r => r.schedule.id === scheduleId)
    const preview = row ? planFor(row, cadence) : null
    const ok = await confirm({
      title: 'Change payment plan',
      description: row && preview
        // "installment", not "instalment". The single-l spelling is British and the rest
        // of this app is American — every other label says Installment, and the field it
        // describes is installmentCents.
        //
        // The catch-up is named HERE, before the change is made, because it is the whole
        // consequence of the choice: switching to monthly in August does not mean $50 a
        // month, it means one payment covering the year to date and $50 a month after
        // that. A dialog that showed only the steady figure would be describing a plan
        // the member cannot actually be on.
        ? preview.onSchedule
          ? `Pay "${row.schedule.label}" ${cadence} — ${formatCurrency(preview.installmentCents)} per installment?`
          : `Pay "${row.schedule.label}" ${cadence}. Your next installment is ${formatCurrency(preview.nextInstallmentCents)}, which covers what has come due so far${preview.followingInstallmentDate ? `, then ${formatCurrency(preview.followingInstallmentCents)} per installment` : ''}.`
        : `Change this payment plan to ${cadence}?`,
      confirmLabel: 'Change plan',
    })
    if (!ok) return
    // EVERY field of the result is spread, not the two that used to be. `rows` is
    // `useServerState`, which adopts the server's value on the next render — so a
    // partial patch left `arrearsCents`, `overdueSinceDate` and the date itself
    // describing the OLD cadence until the refresh landed, with the new installment
    // figure beside them.
    setRows(prev => prev.map(r =>
      r.schedule.id === scheduleId
        ? { ...r, cadence, hasExplicitPlan: true, ...planFor(r, cadence) }
        : r,
    ))
    startTransition(async () => {
      const res = await setMyDuesPlan(scheduleId, cadence)
      if (!res.success) setError(res.message ?? 'Could not update cadence')
      router.refresh()
    })
  }

  /**
   * Decline an optional due, or take it back on.
   *
   * Confirmed in both directions, and worded to say what actually changes. Opting out
   * is not destructive — nothing is deleted and it can be undone from the same control
   * — but it does change what the family expects from this member, which is worth a
   * deliberate click rather than a stray one.
   *
   * Optimistic, then refreshed: the row's own state flips at once so the table does not
   * appear to ignore the click, and router.refresh() then re-reads the totals above,
   * which the server recomputes.
   */
  async function changeOptOut(row: DuesSummary, optOut: boolean) {
    const ok = await confirm({
      title: optOut ? `Opt out of ${row.schedule.label}?` : `Opt back in to ${row.schedule.label}?`,
      description: optOut
        ? 'This is an optional due, so you can decline it. It will stop counting toward what you owe, and you can opt back in at any time.'
        : `${row.schedule.label} will count toward what you owe again, at ${formatCurrency(row.installmentCents)} per ${row.cadence} installment.`,
      confirmLabel: optOut ? 'Opt out' : 'Opt back in',
    })
    if (!ok) return
    setError('')
    setRows(prev => prev.map(r =>
      r.schedule.id === row.schedule.id
        ? { ...r, optedOut: optOut, remainingBalanceCents: optOut ? 0 : r.remainingBalanceCents }
        : r,
    ))
    startTransition(async () => {
      const res = await setMyDuesOptOut(row.schedule.id, optOut)
      if (!res.success) setError(res.message ?? 'Could not change that')
      router.refresh()
    })
  }

  // No search box here: a member has a handful of dues, and the column headers already
  // sort them. Payment History keeps its filter because that list grows without limit.
  const [duesSort, setDuesSort] = useState<{ col: DuesCol; dir: SortDir }>({ col: 'due_date', dir: 'asc' })
  function sortDues(col: DuesCol) {
    setDuesSort(s => s.col === col ? { col, dir: s.dir === 'asc' ? 'desc' : 'asc' } : { col, dir: 'asc' })
  }

  // Declined rows go at the END, after everything still owed, and are sorted among
  // themselves by the same column. They belong in this table — it is the only place a
  // member can opt back in — but never above something they still have to pay.
  //
  // NOT a useMemo, deliberately, and removing it made this component FASTER rather than
  // slower. React Compiler could not preserve the manual memoization — it cannot prove
  // `unpaid` is never mutated, because a `.filter(...).sort(...)` chain elsewhere in the
  // file reaches it and `.sort` mutates its receiver (harmlessly there: the receiver is
  // the array `.filter` just created). Faced with a `useMemo` whose dependency it cannot
  // vouch for, the compiler bails out of optimizing the WHOLE component — "Compilation
  // Skipped" — so the one hand-written memo was costing every other value in the file
  // its automatic memoization. Computed plainly, the compiler memoizes this and
  // everything around it.
  //
  // The spread is what makes it safe to sort: this is a fresh array, so no prop is
  // touched. Not-yet-owed rows sort to the very end, after the declined ones: they are
  // the least actionable thing in the table, being a due nobody can pay yet.
  const rank = (s: DuesSummary) => s.ageExempt ? 2 : s.optedOut ? 1 : 0
  const sortedDues = [...unpaid, ...declined, ...notYetOwed].sort((a, b) => {
    if (rank(a) !== rank(b)) return rank(a) - rank(b)
    let cmp = 0
    if (duesSort.col === 'amount') cmp = a.installmentCents - b.installmentCents
    else if (duesSort.col === 'due_date') cmp = (a.nextInstallmentDate ?? '').localeCompare(b.nextInstallmentDate ?? '')
    else cmp = a.schedule.label.localeCompare(b.schedule.label)
    return duesSort.dir === 'asc' ? cmp : -cmp
  })

  return (
    <div className="space-y-5">
      {/* The two cards Summary leads with, fed from `rows` so an opt-out or a cadence
          change updates the headline optimistically along with the table below.
          DuesBalanceKpi is the dashboard's Account card, unchanged — see its header for
          why there is exactly one of it. */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <DuesBalanceKpi summary={rows} />
        <NextInstallmentsCard summary={rows} />
      </div>

      {/* THE ONE QUESTION THIS SCREEN RELIABLY RAISES, answered where it is raised.
          "Next Installment" on the card above and "Installment" in the table below are two
          different figures — the next payment carries whatever the calendar has already
          asked for and the money has not covered — and a member seeing a larger number
          than their installment reads it as an error. `my-dues#next-payment` is the
          paragraph that separates them.

          Placed here rather than on the card, because the card is shared with
          [Summary](/account-summary) and this is the screen the question is asked on. It is
          also the one help link on this page: the top bar already points at the chapter as
          a whole, so a second, third and fourth icon on the cadence picker and the opt-out
          would only make this one harder to see (see components/help/HelpLink.tsx). */}
      <HelpLink
        variant="inline"
        slug="my-dues"
        section="next-payment"
        label="Why the next payment can differ from the installment"
      />

      <div>
        <FormError message={error} className="mb-3" />
        {sortedDues.length === 0 ? (
          <div className="flex flex-col items-center py-10 gap-2">
            <CheckCircle2 className="h-10 w-10 text-muted-foreground/20" />
            <p className="text-sm text-muted-foreground">You&apos;re all caught up — nothing due right now.</p>
          </div>
        ) : (
          /* Was `min-w-[760px]` in an `overflow-x-auto` box — the widest table in the
              app, on the page a member is most likely to open on a phone.
              Below `sm` it is two columns: the schedule, and what you pay each time.
              Everything else folds into a plan block under the name — see DuesRow.

              THE "PAY ONLINE (COMING SOON)" BUTTON IS GONE FROM THE ROWS and says the
              same thing once, below. It was a disabled control repeated on every
              required row, and folding it was never going to help: at ~170px it was the
              widest thing on a 390px screen and it did nothing when tapped. A promise
              about a feature is a property of the SCREEN, not of each schedule.
              What is left in the Action column is the one real action — opting out of an
              optional due, and back in — which most rows do not have either, so the
              column heading is `sr-only` like every other action column here. */
          <div>
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b">
                  <SortTh label="Schedule" active={duesSort.col === 'schedule'} dir={duesSort.dir} onClick={() => sortDues('schedule')} />
                  <th className={cn('py-2 pr-3 text-xs font-medium text-muted-foreground text-left', COLLAPSING_CELL)}>Payment</th>
                  <th className={cn('py-2 pr-3 text-xs font-medium text-muted-foreground text-left', COLLAPSING_CELL)}>Pay&nbsp;cadence</th>
                  <SortTh label="Installment" active={duesSort.col === 'amount'} dir={duesSort.dir} onClick={() => sortDues('amount')} align="right" />
                  <SortTh label="Next Due" active={duesSort.col === 'due_date'} dir={duesSort.dir} onClick={() => sortDues('due_date')} className={COLLAPSING_CELL} />
                  <th className={cn('py-2 pr-3 text-xs font-medium text-muted-foreground text-right', COLLAPSING_CELL)}>Remaining</th>
                  <th className={cn('py-2 text-xs font-medium text-muted-foreground text-right', COLLAPSING_CELL)}>
                    <span className="sr-only">Actions</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {sortedDues.map(s => (
                  <DuesRow
                    key={s.schedule.id}
                    row={s}
                    isPending={isPending}
                    onCadence={cadence => changeCadence(s.schedule.id, cadence)}
                    onOptOut={optOut => changeOptOut(s, optOut)}
                  />
                ))}
              </tbody>
            </table>
            {/* Said once, where the old per-row button used to say it N times. It
                answers the question that button raised and never could — "so how DO I
                pay?" — which is the more useful half and was missing entirely. */}
            <p className="mt-4 text-xs text-muted-foreground">
              Online payments are coming soon. Anything you pay in the meantime appears
              here once an administrator records it.
            </p>
          </div>
        )}
      </div>
    </div>
  )
}

// ── A single outstanding-dues row, with cadence picker ──

function DuesRow({ row, isPending, onCadence, onOptOut }: {
  row: DuesSummary
  isPending: boolean
  onCadence: (cadence: PayCadence) => void
  onOptOut: (optOut: boolean) => void
}) {
  const declined = row.optedOut
  /**
   * Below the age this due starts at, for the whole of this period.
   *
   * A THIRD STATE, not a variety of "paid". The remaining balance is zero either way,
   * and treating them the same would tell a twelve-year-old they were all caught up on
   * a due they have never owed — and would hide the one thing worth telling them, which
   * is the date it starts. `declined` wins where both somehow apply: opting out is a
   * choice the member made and the way back is on that row.
   */
  const notYetOwed = row.ageExempt && !declined

  /**
   * "Catching up", when the calendar has asked for installments the money never
   * covered.
   *
   * NOT `--destructive`, and not red. An unpaid installment is neither an error nor a
   * deletion — the two things that token owns — and reporting a failure is
   * `components/ui/form-message.tsx`'s job, not a row's. `--brand-withheld` is the role
   * for exactly this: something that looks like alarm and is not, in Warmth rather than
   * shadcn's alarm hue.
   *
   * Worded as a state of the plan rather than as a verdict on the member. They may have
   * joined in August, or simply chosen a cadence today — the schedule opened in January
   * either way, and the figure is the same arithmetic in both cases.
   */
  const catchUpPill = !declined && !row.onSchedule ? (
    <span
      className="inline-block whitespace-nowrap rounded-full bg-brand-withheld/10 px-2 py-0.5 text-[11px] font-medium text-brand-withheld"
      title={row.overdueSinceDate
        ? `Includes ${row.periodsElapsed} installment${row.periodsElapsed === 1 ? '' : 's'} due since ${fmtDate(row.overdueSinceDate)}`
        : undefined}
    >
      Catching up
    </span>
  ) : null

  // Required / Optional / Declined. Declined REPLACES Optional rather than sitting
  // beside it: a row cannot be both, and showing both would leave the member reading two
  // answers to one question. Lifted out of the cell because the meta line renders the
  // same pill below `sm`, where the column it lives in is gone.
  const statusPill = (
    <span className={cn(
      'inline-block whitespace-nowrap rounded-full px-2 py-0.5 text-[11px] font-medium',
      declined || notYetOwed ? 'bg-muted text-muted-foreground'
        : row.required ? 'bg-brand-soft text-brand-on-soft'
          // Warm, not the gold the status pills use: Optional is a CATEGORY of due, not
          // a state needing attention. Gold here would flag a row nobody is chasing.
          : 'bg-brand-warm text-brand-on-warm',
    )}>
      {declined ? 'Declined'
        : notYetOwed ? 'Not yet due'
          : row.required ? 'Required' : 'Optional'}
    </span>
  )

  /**
   * The sentence under the schedule name.
   *
   * Three readings of the same due, and the reduced one has to explain itself or the
   * figure beside it looks like an error. A member turning eighteen in July on a $120
   * due is shown "$50 this year · $120/yr from 1 Jan 2027", which is the whole rule
   * stated in the one place they will read it.
   */
  const termsLine = notYetOwed && row.ageProration
    ? `Starts ${fmtDate(row.ageProration.responsibleFrom)}, when you turn ${row.ageProration.startAge}`
    : row.ageProration
      ? `${formatCurrency(row.annualTotalCents)} this year · ${formatCurrency(row.ageProration.fullAnnualCents)}/yr after · ${row.schedule.frequency}`
      : `${formatCurrency(row.annualTotalCents)}/yr · ${row.schedule.frequency}`

  // No cadence to choose on a declined due — there is no installment to spread.
  //
  // `w-full sm:w-32`, because this element is rendered in two places: its own column at
  // `sm` and up, where 32 is right beside its neighbours, and the plan block below that,
  // where the cell is the width of the screen and a 128px control floating in it reads
  // as unfinished. The aria-label names the schedule as well as the field, which the
  // column heading alone never did — "Pay cadence" over five identical selects tells a
  // screen-reader user nothing about which schedule they are changing.
  const cadenceControl = declined || notYetOwed ? null : (
    <Select
      value={row.cadence}
      disabled={isPending}
      onChange={e => onCadence(e.target.value as PayCadence)}
      className="h-8 w-full text-xs capitalize sm:h-7 sm:w-32"
      aria-label={`Payment cadence for ${row.schedule.label}`}
    >
      {PAY_CADENCES.map(c => <option key={c} value={c}>{c}</option>)}
    </Select>
  )

  // Only an OPTIONAL due has an action — the choice to decline it, and the way back.
  // Both live in the same place, or opting out looks permanent.
  const optOutControl = row.required ? null : (
    <Button
      size="sm"
      variant={declined ? 'outline' : 'ghost'}
      disabled={isPending}
      onClick={() => onOptOut(!declined)}
      className={cn(!declined && 'text-muted-foreground hover:text-foreground')}
    >
      {declined ? 'Opt back in' : 'Opt out'}
    </Button>
  )

  return (
    <tr className={cn('border-b align-top last:border-0 hover:bg-muted/30 sm:align-middle',
      (declined || notYetOwed) && 'bg-muted/30')}>
      <td className="py-3 pr-3 sm:py-2.5">
        {/* The description is a tooltip on the title rather than its own line: it is
            reference text, and a paragraph of it under every row pushed the amounts
            apart. The dotted underline is the only hint that there is more to read,
            so it appears exactly when there is. */}
        <p
          className={cn('font-medium', (declined || notYetOwed) && 'text-muted-foreground',
            row.schedule.description && 'w-fit cursor-help underline decoration-dotted decoration-muted-foreground/50 underline-offset-2')}
          title={row.schedule.description ?? undefined}
        >
          {row.schedule.label}
        </p>
        <p className="text-xs text-muted-foreground">{termsLine}</p>

        {/* ── The plan block: this row's other five columns, below `sm` ──────────
            NOT a `RowMeta`. That renders one inline run of short values, and this is
            three different kinds of thing — a state, two figures, and two controls —
            which ran together into an unreadable smear when they shared a line. They
            are banded instead: what this due IS, then when and how much is left, then
            what you can change about it. Each band is a row of the same visual weight,
            so the eye has somewhere to stop.

            Note what is NOT here: the installment, and the opt-out. Both stay in the
            Installment column beside this block (see below) — the figure because it is
            what a member scans the list for, and the button because it belongs with the
            figure it switches off. */}
        <div className="mt-2.5 space-y-2 sm:hidden">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
            {statusPill}
            {catchUpPill}
            {/* Labelled, unlike most folded values. A bare date and a bare amount next
                to an installment figure are three numbers with no captions. */}
            <MetaIf value={row.nextInstallmentDate ? fmtDate(row.nextInstallmentDate) : null} prefix="Next due" />
            {!declined && !notYetOwed && (
              <>
                <MetaDot />
                <MetaIf value={formatCurrency(row.remainingBalanceCents)} prefix="Remaining" />
              </>
            )}
          </div>

          {cadenceControl && (
            <div>
              {/* A plain caption, not a <label>: the select already carries an
                  aria-label naming both the field and the schedule, and a <label> would
                  be overridden by it and read to nobody. This is here for the sighted
                  reader, who has lost the column heading. */}
              <span className="mb-1 block text-[11px] uppercase tracking-wide text-muted-foreground">
                Pay cadence
              </span>
              {cadenceControl}
            </div>
          )}
        </div>
      </td>
      <td className={cn('py-2.5 pr-3', COLLAPSING_CELL)}>
        {/* Both pills, stacked: Required/Optional says what KIND of due this is and
            Catching up says where this member stands on it. They answer different
            questions, so neither replaces the other. */}
        <span className="flex flex-col items-start gap-1">
          {statusPill}
          {catchUpPill}
        </span>
      </td>
      <td className={cn('py-2.5 pr-3', COLLAPSING_CELL)}>
        {cadenceControl ?? <span className="text-xs text-muted-foreground">—</span>}
      </td>
      {/* The one figure that keeps its column at every width, and below `sm` the column
          the opt-out lives in too.
          `align-top` on mobile so the amount sits level with the schedule name rather
          than floating beside the middle of the plan block. Under it: the cadence — an
          installment with no unit is a number, not an amount, and its own column is gone
          down there — and then the button, because what "Opt out" opts out OF is this
          amount, and putting it here means the decision and the figure it turns off are
          read together instead of at opposite ends of a card.
          `line-through` sits on the amount rather than on the cell, so a declined row
          cannot strike through its own way back in. */}
      {/* THE FIGURE IS WHAT THEY PAY NEXT, not the steady installment, since 2026-08-14.
          A member who switched to monthly in August was shown "$50" while actually owing
          $450 at the next date beside it — the column was answering a question about the
          plan while the member was reading it as a question about the bill. The steady
          amount has not gone away; it is the second line, where it belongs, because it is
          what every installment AFTER this one costs. */}
      <td className="py-3 text-right font-semibold whitespace-nowrap align-top sm:py-2.5 sm:pr-3 sm:align-middle">
        {/* An em dash for a due nobody owes yet, not "$0.00". A zero here is a figure
            somebody would try to reconcile; a dash is the honest answer to "what is your
            next installment" when there is not going to be one this year. */}
        <span className={cn((declined || notYetOwed) && 'text-muted-foreground', declined && 'line-through')}>
          {notYetOwed ? '—' : formatCurrency(declined ? row.installmentCents : row.nextInstallmentCents)}
        </span>
        {!declined && !notYetOwed && !row.onSchedule && row.followingInstallmentDate && (
          <span className="block text-[11px] font-normal text-muted-foreground">
            then {formatCurrency(row.followingInstallmentCents)}
          </span>
        )}
        {!declined && !notYetOwed && (
          <span className="block text-[11px] font-normal capitalize text-muted-foreground sm:hidden">
            {row.cadence}
          </span>
        )}
        {optOutControl && <span className="mt-1.5 block sm:hidden">{optOutControl}</span>}
      </td>
      <td className={cn('py-2.5 pr-3 text-xs text-muted-foreground whitespace-nowrap', COLLAPSING_CELL)}>
        {/* The date the due STARTS, for a row nobody owes yet. It is the only date this
            row has, and it is the one thing the member wants from it. */}
        {notYetOwed && row.ageProration
          ? fmtDate(row.ageProration.responsibleFrom)
          : row.nextInstallmentDate ? fmtDate(row.nextInstallmentDate) : '—'}
      </td>
      <td className={cn('py-2.5 pr-3 text-right font-semibold whitespace-nowrap',
        declined || notYetOwed ? 'text-muted-foreground' : 'text-brand-accent', COLLAPSING_CELL)}>
        {declined || notYetOwed ? '—' : formatCurrency(row.remainingBalanceCents)}
      </td>
      <td className={cn('py-2.5 text-right', COLLAPSING_CELL)}>
        {optOutControl}
      </td>
    </tr>
  )
}
