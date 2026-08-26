'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { CheckCircle2, CreditCard, Repeat, CalendarClock, XCircle, RotateCcw } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Dialog } from '@/components/ui/dialog'
import { cn } from '@/lib/utils'
import { formatCurrency } from '@/lib/currency-utils'
import { formatDate } from '@/lib/date-utils'
import {
  currentPeriodStart, duesPlanMath, isOutstanding,
  PAY_CADENCES, type PayCadence,
} from '@/lib/dues-utils'
import { useConfirm } from '@/components/ui/confirm'
import { COLLAPSING_CELL, MetaDot, MetaIf } from '@/components/ui/table-collapse'
import { FieldError, FormError } from '@/components/ui/form-message'
import { RowMenu, RowMenuItem, RowMenuLabel, RowMenuNote } from '@/components/ui/row-menu'
import { useServerState } from '@/lib/use-server-state'
import { setMyDuesPlan, setMyDuesOptOut, type DuesSummary } from '@/app/actions/dues'
import {
  cancelDuesAutopay, startDuesAutopay, startDuesCheckout,
  type DuesOnlineStatus,
} from '@/app/actions/pay-dues'
import { HelpLink } from '@/components/help/HelpLink'
import { DuesBalanceKpi } from '@/components/dues/DuesBalanceKpi'
import { NextInstallmentsCard } from '@/components/account/NextInstallmentsCard'
import { SortTh, type SortDir } from '@/components/ui/sortable-header'

type DuesCol = 'schedule' | 'amount' | 'due_date'

const fmtDate = (s: string) => formatDate(s) ?? ''

/**
 * The member's own dues: what they are on, what the next payment has to be, and everything
 * they may do about it — pay it, spread it, automate it, or decline it.
 *
 * ONE OF THE TWO HALVES OF THE OLD `DuesDetailSection`, which was a rail over three
 * panes on /account-summary until 20260815000000 gave each pane a screen. The other is
 * `PaymentHistorySection`. What was shared between them — the sortable heading, the two
 * stat cards — is shared as components rather than by living in one file, so the split
 * cost no duplication.
 *
 * ── TWO TABLES SINCE 2026-08-25, AND THE SPLIT IS WHAT REMOVED A COLUMN ────────────
 * Required dues and optional ones are two different questions — one is a bill, the other is
 * an invitation the member may decline — and they were interleaved in one list distinguished
 * by a pill in a column of its own. Splitting them on `required` makes that column say the
 * same thing on every row of each table, which is the definition of a column worth removing.
 * So **Payment** is gone, and the two states that column ALSO carried have moved rather than
 * vanished: `Declined` and `Not yet due` are pills beside the schedule name, because they are
 * facts about that one row rather than about the table it is in.
 *
 * Each table renders only if the member has a schedule in it. A family that runs no optional
 * dues sees one table and no empty heading — an empty table under a heading reads as something
 * that failed to load, which is the same argument the Donations pane makes about itself.
 *
 * ── PAST DUE IS A ROW TINT, AND A WORD ─────────────────────────────────────────────
 * A schedule whose calendar has asked for installments the money never covered tints its row
 * `--brand-withheld`, which is the token AGENTS.md reserves for exactly this: something that
 * looks like alarm and is not. It is NOT `--destructive` — an unpaid installment is neither an
 * error nor a deletion, and reporting a failure is `form-message.tsx`'s job.
 *
 * The tint is never the only cue. Colour alone is not information, so the row also says
 * **Past due** in words, with the date it fell behind from on the pill's title. A member who
 * cannot distinguish the tint reads the same fact.
 *
 * ── THE CADENCE PICKER LEFT THE TABLE, AND THE CADENCE DID NOT ─────────────────────
 * A `<select>` on every row was a control column charged to every width, and four fifths of
 * the time nobody touches it. It is a menu item now, opening a dialog that prices each choice
 * before it is made — which is strictly more than the old picker did, since the old one made
 * the change and THEN described it in a confirmation. What stays on the row is the cadence
 * itself, under the amount, because "$50" with no unit is a number rather than an amount.
 *
 * ── PAYING MOVED ONTO THE ROW, AND `PayOnlineSection` IS GONE ──────────────────────
 * It was a stack of cards under the table repeating every payable schedule's name and balance
 * — a second rendering of the same list, which is the shape this codebase treats as a bug
 * waiting for one of the two to be edited. The one-off payment is a button on the row it is
 * about; automatic payments are a menu item on the same row; and the combined total is the one
 * thing that genuinely belongs below both tables, because it is a fact about neither.
 */
export function DuesPlanSection({ summary, online }: {
  summary: DuesSummary[]
  /**
   * Whether this member can pay by card, and what they already pay automatically.
   *
   * ALWAYS PRESENT rather than nullable: `getDuesOnlineStatus` answers a shape with
   * `chargesReady: false` and no rows for every failure path, so nothing here needs a second
   * branch and a family with no processor simply renders no payment controls.
   */
  online: DuesOnlineStatus
}) {
  const router = useRouter()
  const confirm = useConfirm()
  const [isPending, startTransition] = useTransition()

  // Local mirror of summary so cadence changes recompute installments instantly.
  // `useServerState` re-syncs it whenever the server re-fetches — after recording a
  // payment, and after an admin adds a dues schedule, which revalidates this page.
  const [rows, setRows] = useServerState<DuesSummary[]>(summary)
  const [error, setError] = useState('')

  /** The due whose cadence is being changed, or null. */
  const [cadenceFor, setCadenceFor] = useState<DuesSummary | null>(null)
  /**
   * What the pay dialog is settling: one due, or everything due now.
   *
   * ONE DIALOG FOR BOTH, because they are one action over a list of length one or more —
   * `startDuesCheckout` takes the same shape either way, and two dialogs would be two
   * places for the amount rules to be stated.
   */
  const [payFor, setPayFor] = useState<DuesSummary[] | null>(null)

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

  /**
   * Commit a cadence the member chose in the dialog.
   *
   * NO CONFIRMATION, and that is not a loosening. The dialog priced every option before the
   * member picked one — including the catch-up, which is the whole consequence of the choice
   * — so a confirmation would restate what they had just read in order to ask them to read it
   * again. The old inline `<select>` needed one precisely because it had nowhere to say any
   * of that first.
   */
  function changeCadence(scheduleId: string, cadence: PayCadence) {
    setError('')
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

  /** Start automatic payments on one due — Stripe's hosted page collects the card. */
  function startAutopay(row: DuesSummary) {
    setError('')
    startTransition(async () => {
      const res = await startDuesAutopay({ scheduleId: row.schedule.id })
      if (!res.success) { setError(res.message); return }
      window.location.href = res.url
    })
  }

  async function stopAutopay(row: DuesSummary) {
    const ok = await confirm({
      title: 'Stop automatic payments?',
      description: `No further card payments will be taken for ${row.schedule.label}. Everything you have already paid stays on your record.`,
      confirmLabel: 'Stop payments',
    })
    if (!ok) return
    setError('')
    startTransition(async () => {
      const res = await cancelDuesAutopay({ scheduleId: row.schedule.id })
      if (!res.success) { setError(res.message); return }
      router.refresh()
    })
  }

  // ── What is listed at all ───────────────────────────────────────────────────────
  // Still owed, declined, or not owed yet. A due settled in full for this period drops out
  // of the list entirely, which is what the single table did before it was split — the
  // screen answers "what is being asked of you", and [payment history](/reporting/payment-history)
  // answers "what have you paid". Splitting the table was not a reason to change that.
  //
  // `isOutstanding` is false for an age-exempt row (its remaining balance is zero, so `paid`
  // is already true of it), which is why `notYetOwed` is a third term rather than covered by
  // the first: a due starting on somebody's eighteenth birthday has to be visible BEFORE it
  // arrives, or it appears out of nowhere on the day.
  const listed = rows.filter(r =>
    isOutstanding(r) || r.optedOut || (r.ageExempt && !r.optedOut))

  // ── What goes in which table ────────────────────────────────────────────────────
  // A clean partition on `required`, which is the schedule's own flag. Nothing has to be
  // decided about where a declined or a not-yet-due row goes: only an OPTIONAL due can be
  // declined, and an age-gated one keeps whichever kind it is.
  const requiredRows = listed.filter(r => r.required)
  const optionalRows = listed.filter(r => !r.required)

  // ── What the member can actually pay by card ───────────────────────────────────
  // `isOutstanding` is the whole predicate: it is false for a declined due, false for a
  // settled one, and false for an age-exempt one (whose remaining balance is zero, so
  // `paid` is already true of it). The `kind` test is belt and braces — this summary holds
  // dues only — and it is kept because `startDuesCheckout` refuses a donation and a
  // screen offering something the action refuses is worse than one that does not offer it.
  const payable = rows.filter(r => isOutstanding(r) && r.schedule.kind === 'dues')
  const payableRequired = payable.filter(r => r.required)
  const payableOptional = payable.filter(r => !r.required)
  const autopayFor = (r: DuesSummary) =>
    online.autopay.find(a => a.scheduleId === r.schedule.id) ?? null

  const rowProps = {
    isPending,
    online,
    onPay: (row: DuesSummary) => setPayFor([row]),
    onCadence: (row: DuesSummary) => setCadenceFor(row),
    onOptOut: changeOptOut,
    onStartAutopay: startAutopay,
    onStopAutopay: stopAutopay,
    autopayFor,
  }

  return (
    <div className="space-y-5">
      {/* The two cards Summary leads with, fed from `rows` so an opt-out or a cadence
          change updates the headline optimistically along with the tables below.
          DuesBalanceKpi is the dashboard's Account card, unchanged — see its header for
          why there is exactly one of it. */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <DuesBalanceKpi summary={rows} />
        <NextInstallmentsCard summary={rows} />
      </div>

      {/* THE ONE QUESTION THIS SCREEN RELIABLY RAISES, answered where it is raised.
          "Next Installment" on the card above and "Installment" in the tables below are two
          different figures — the next payment carries whatever the calendar has already
          asked for and the money has not covered — and a member seeing a larger number
          than their installment reads it as an error. `my-dues#next-payment` is the
          paragraph that separates them.

          It is also the one help link on this page: the top bar already points at the chapter
          as a whole, so a second and third icon on the row menu and the pay dialog would only
          make this one harder to see (see components/help/HelpLink.tsx). */}
      <HelpLink
        variant="inline"
        slug="my-dues"
        section="next-payment"
        label="Why the next payment can differ from the installment"
      />

      <FormError message={error} />

      {listed.length === 0 ? (
        <div className="flex flex-col items-center py-10 gap-2">
          <CheckCircle2 className="h-10 w-10 text-muted-foreground/20" />
          <p className="text-sm text-muted-foreground">You&apos;re all caught up — nothing due right now.</p>
        </div>
      ) : (
        <div className="space-y-8">
          {/* ONLY THE TABLES THE MEMBER HAS A SCHEDULE FOR. A heading over an empty table
              is a worse answer than no heading at all — it says the family runs optional
              dues and this member is on none of them, which is a different fact and usually
              not the true one. */}
          {requiredRows.length > 0 && (
            <DuesTable
              title="Required dues"
              lede="Everybody on these schedules owes them."
              rows={requiredRows}
              {...rowProps}
            />
          )}

          {optionalRows.length > 0 && (
            <DuesTable
              title="Optional dues"
              lede="Yours to take on or decline. Declining one is not the same as having paid it."
              rows={optionalRows}
              {...rowProps}
            />
          )}

          <DuesTotals
            required={payableRequired}
            optional={payableOptional}
            showRequiredLine={requiredRows.length > 0}
            showOptionalLine={optionalRows.length > 0}
            chargesReady={online.chargesReady}
            isPending={isPending}
            onPayAll={() => setPayFor(payable)}
          />
        </div>
      )}

      {cadenceFor && (
        <CadenceDialog
          row={cadenceFor}
          planFor={planFor}
          onClose={() => setCadenceFor(null)}
          onChoose={cadence => { changeCadence(cadenceFor.schedule.id, cadence); setCadenceFor(null) }}
        />
      )}

      {payFor && payFor.length > 0 && (
        <PayDialog rows={payFor} onClose={() => setPayFor(null)} />
      )}
    </div>
  )
}

// ── One table: required, or optional ────────────────────────────────────────────────

type RowHandlers = {
  isPending: boolean
  online: DuesOnlineStatus
  onPay: (row: DuesSummary) => void
  onCadence: (row: DuesSummary) => void
  onOptOut: (row: DuesSummary, optOut: boolean) => void
  onStartAutopay: (row: DuesSummary) => void
  onStopAutopay: (row: DuesSummary) => void
  autopayFor: (row: DuesSummary) => DuesOnlineStatus['autopay'][number] | null
}

/**
 * One of the two dues tables.
 *
 * ── ITS OWN SORT, NOT A SHARED ONE ─────────────────────────────────────────────────
 * Each table is its own list and sorts independently, so pressing **Next Due** on the
 * required table does not silently reorder the optional one below it. The columns are
 * identical in both, which is what makes them comparable; the ORDER is a thing the reader
 * chose about one list.
 *
 * Was `min-w-[760px]` in an `overflow-x-auto` box — the widest table in the app, on the
 * page a member is most likely to open on a phone. Below `sm` it is three columns: the
 * schedule, what the next payment is, and what you can do about it. The date and the
 * remaining balance fold into a meta line under the name.
 */
function DuesTable({ title, lede, rows, ...handlers }: {
  title: string
  lede: string
  rows: DuesSummary[]
} & RowHandlers) {
  const [sort, setSort] = useState<{ col: DuesCol; dir: SortDir }>({ col: 'due_date', dir: 'asc' })
  function sortBy(col: DuesCol) {
    setSort(s => s.col === col ? { col, dir: s.dir === 'asc' ? 'desc' : 'asc' } : { col, dir: 'asc' })
  }

  // Declined rows go at the END, after everything still owed, and are sorted among
  // themselves by the same column. They belong in this table — it is the only place a
  // member can opt back in — but never above something they still have to pay.
  //
  // NOT a useMemo, deliberately, and removing it made this component FASTER rather than
  // slower. React Compiler could not preserve the manual memoization — it cannot prove
  // the array is never mutated, because `.sort` mutates its receiver. Faced with a
  // `useMemo` whose dependency it cannot vouch for, the compiler bails out of optimizing
  // the WHOLE component — "Compilation Skipped" — so the one hand-written memo was costing
  // every other value in the file its automatic memoization.
  //
  // The spread is what makes it safe to sort: this is a fresh array, so no prop is
  // touched. Not-yet-owed rows sort to the very end, after the declined ones: they are
  // the least actionable thing in the table, being a due nobody can pay yet.
  const rank = (s: DuesSummary) => s.ageExempt ? 2 : s.optedOut ? 1 : 0
  const sorted = [...rows].sort((a, b) => {
    if (rank(a) !== rank(b)) return rank(a) - rank(b)
    let cmp = 0
    if (sort.col === 'amount') cmp = a.nextInstallmentCents - b.nextInstallmentCents
    else if (sort.col === 'due_date') cmp = (a.nextInstallmentDate ?? '').localeCompare(b.nextInstallmentDate ?? '')
    else cmp = a.schedule.label.localeCompare(b.schedule.label)
    return sort.dir === 'asc' ? cmp : -cmp
  })

  return (
    <section className="space-y-2">
      <div>
        <h2 className="text-lg font-semibold text-brand-ink">{title}</h2>
        <p className="text-sm text-muted-foreground">{lede}</p>
      </div>
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b">
            <SortTh label="Schedule" active={sort.col === 'schedule'} dir={sort.dir} onClick={() => sortBy('schedule')} />
            <SortTh label="Next Payment" active={sort.col === 'amount'} dir={sort.dir} onClick={() => sortBy('amount')} align="right" />
            <SortTh label="Next Due" active={sort.col === 'due_date'} dir={sort.dir} onClick={() => sortBy('due_date')} className={COLLAPSING_CELL} />
            <th className={cn('py-2 pr-3 text-xs font-medium text-muted-foreground text-right', COLLAPSING_CELL)}>Remaining</th>
            {/* `sr-only` like every other action column here: the cell holds controls that
                name themselves, and a visible "Actions" heading over two icons is noise. */}
            <th className="py-2 text-xs font-medium text-muted-foreground text-right">
              <span className="sr-only">Actions</span>
            </th>
          </tr>
        </thead>
        <tbody>
          {sorted.map(s => <DuesRow key={s.schedule.id} row={s} {...handlers} />)}
        </tbody>
      </table>
    </section>
  )
}

// ── A single dues row ───────────────────────────────────────────────────────────────

function DuesRow({
  row, isPending, online, onPay, onCadence, onOptOut, onStartAutopay, onStopAutopay, autopayFor,
}: { row: DuesSummary } & RowHandlers) {
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
  const quiet = declined || notYetOwed

  /**
   * The calendar has asked for installments the money never covered.
   *
   * `onSchedule` is false exactly when there are arrears, which is the definition — see
   * `duesPlanMath`. It is already forced true for a settled, declined or age-exempt due, so
   * none of those can tint.
   */
  const pastDue = !quiet && !row.onSchedule

  const autopay = autopayFor(row)
  const payable = isOutstanding(row) && row.schedule.kind === 'dues'

  /**
   * "Past due", when the calendar has passed an installment the money never reached.
   *
   * NOT `--destructive`, and not red. An unpaid installment is neither an error nor a
   * deletion — the two things that token owns — and reporting a failure is
   * `components/ui/form-message.tsx`'s job, not a row's. `--brand-withheld` is the role
   * for exactly this: something that looks like alarm and is not, in Warmth rather than
   * shadcn's alarm hue.
   *
   * IT IS THE ROW TINT'S CAPTION, not a decoration beside it. The tint says the same thing
   * and colour alone is not information, so this pill is what a member who cannot see the
   * difference reads instead.
   */
  const statePill = pastDue ? (
    <span
      className="inline-block whitespace-nowrap rounded-full bg-brand-withheld/15 px-2 py-0.5 text-[11px] font-medium text-brand-withheld"
      title={row.overdueSinceDate
        ? `Includes ${row.periodsElapsed} installment${row.periodsElapsed === 1 ? '' : 's'} due since ${fmtDate(row.overdueSinceDate)}`
        : undefined}
    >
      Past due
    </span>
  ) : quiet ? (
    // Declined and Not yet due were in the **Payment** column, which the required/optional
    // split removed. They are facts about ONE row rather than about the table it sits in,
    // so they moved here rather than going with the column.
    <span className="inline-block whitespace-nowrap rounded-full bg-muted px-2 py-0.5 text-[11px] font-medium text-muted-foreground">
      {declined ? 'Declined' : 'Not yet due'}
    </span>
  ) : null

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

  return (
    <tr className={cn(
      'border-b align-top last:border-0 sm:align-middle',
      // THE PAST-DUE TINT. `/10` is the same weight the pill's own well uses, which is what
      // keeps a tinted row legible against every foreground on it in both themes.
      pastDue ? 'bg-brand-withheld/10 hover:bg-brand-withheld/15'
        : quiet ? 'bg-muted/30 hover:bg-muted/40'
          : 'hover:bg-muted/30',
    )}>
      <td className="py-3 pr-3 sm:py-2.5">
        {/* The description is a tooltip on the title rather than its own line: it is
            reference text, and a paragraph of it under every row pushed the amounts
            apart. The dotted underline is the only hint that there is more to read,
            so it appears exactly when there is. */}
        <p
          className={cn('font-medium', quiet && 'text-muted-foreground',
            row.schedule.description && 'w-fit cursor-help underline decoration-dotted decoration-muted-foreground/50 underline-offset-2')}
          title={row.schedule.description ?? undefined}
        >
          {row.schedule.label}
        </p>
        <p className="text-xs text-muted-foreground">{termsLine}</p>

        {/* The state pill at every width — it is not in a column any more, so there is
            nothing for it to fold out of. */}
        {statePill && <span className="mt-1.5 block">{statePill}</span>}

        {/* Automatic payments are a property of the ROW rather than of the menu that sets
            them up, so a member scanning the list can see which dues take care of
            themselves without opening five menus. */}
        {autopay && (
          <span className="mt-1.5 inline-flex items-center gap-1 rounded-full bg-brand-soft px-2 py-0.5 text-[11px] font-medium text-brand-on-soft">
            <Repeat className="h-3 w-3" aria-hidden="true" />
            Automatic · {formatCurrency(autopay.amountCents)} {autopay.cadence}
          </span>
        )}

        {/* ── The two folded columns, below `sm` ────────────────────────────────
            Labelled, unlike most folded values: a bare date and a bare amount next to
            the payment figure are three numbers with no captions. */}
        <div className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground sm:hidden">
          <MetaIf value={row.nextInstallmentDate ? fmtDate(row.nextInstallmentDate) : null} prefix="Next due" />
          {!quiet && (
            <>
              {row.nextInstallmentDate && <MetaDot />}
              <MetaIf value={formatCurrency(row.remainingBalanceCents)} prefix="Remaining" />
            </>
          )}
        </div>
      </td>

      {/* THE FIGURE IS WHAT THEY PAY NEXT, not the steady installment, since 2026-08-14.
          A member who switched to monthly in August was shown "$50" while actually owing
          $450 at the next date beside it — the column was answering a question about the
          plan while the member was reading it as a question about the bill. The steady
          amount has not gone away; it is the second line, where it belongs, because it is
          what every installment AFTER this one costs.

          THE CADENCE IS ON THIS CELL AT EVERY WIDTH SINCE 2026-08-25. It had a column of
          its own holding a `<select>`; the control moved into the row menu and the FACT
          stayed here, under the figure it is the unit of. */}
      <td className="py-3 text-right font-semibold whitespace-nowrap align-top sm:py-2.5 sm:pr-3 sm:align-middle">
        {/* An em dash for a due nobody owes yet, not "$0.00". A zero here is a figure
            somebody would try to reconcile; a dash is the honest answer to "what is your
            next installment" when there is not going to be one this year. */}
        <span className={cn(quiet && 'text-muted-foreground', declined && 'line-through')}>
          {notYetOwed ? '—' : formatCurrency(declined ? row.installmentCents : row.nextInstallmentCents)}
        </span>
        {!quiet && (
          <span className="block text-[11px] font-normal capitalize text-muted-foreground">
            {row.cadence}
          </span>
        )}
        {!quiet && !row.onSchedule && row.followingInstallmentDate && (
          <span className="block text-[11px] font-normal text-muted-foreground">
            then {formatCurrency(row.followingInstallmentCents)}
          </span>
        )}
      </td>

      <td className={cn('py-2.5 pr-3 text-xs text-muted-foreground whitespace-nowrap', COLLAPSING_CELL)}>
        {/* The date the due STARTS, for a row nobody owes yet. It is the only date this
            row has, and it is the one thing the member wants from it. */}
        {notYetOwed && row.ageProration
          ? fmtDate(row.ageProration.responsibleFrom)
          : row.nextInstallmentDate ? fmtDate(row.nextInstallmentDate) : '—'}
      </td>

      <td className={cn('py-2.5 pr-3 text-right font-semibold whitespace-nowrap',
        quiet ? 'text-muted-foreground' : 'text-brand-accent', COLLAPSING_CELL)}>
        {quiet ? '—' : formatCurrency(row.remainingBalanceCents)}
      </td>

      <td className="py-2.5 align-top sm:align-middle">
        <div className="flex items-center justify-end gap-1">
          {/* ── THE ONE-OFF PAYMENT, ON THE RECORD ITSELF ─────────────────────────
              Only where the family can actually take a card. A disabled Pay button on every
              row is the thing the old "Pay online (coming soon)" column was, and folding it
              was never going to help: it is the widest control in the cell and it does
              nothing when pressed. A family with no processor gets no button and one
              sentence under the tables saying why. */}
          {payable && online.chargesReady && (
            <Button size="sm" variant="affirm" disabled={isPending}
              onClick={() => onPay(row)}>
              <CreditCard className="h-3.5 w-3.5" />
              Pay
            </Button>
          )}

          <RowMenu label={`Options for ${row.schedule.label}`} disabled={isPending}>
            {close => (
              <>
                {notYetOwed ? (
                  <RowMenuNote>
                    Nothing to set up yet — this due starts
                    {row.ageProration ? ` ${fmtDate(row.ageProration.responsibleFrom)}` : ' later'}.
                  </RowMenuNote>
                ) : declined ? (
                  <RowMenuItem icon={RotateCcw} onClick={() => { close(); onOptOut(row, false) }}>
                    Opt back in
                  </RowMenuItem>
                ) : (
                  <>
                    <RowMenuLabel>Payment plan</RowMenuLabel>
                    <RowMenuItem icon={CalendarClock} onClick={() => { close(); onCadence(row) }}>
                      Change pay cadence
                    </RowMenuItem>

                    {/* Automatic payments follow the cadence the member already chose, so
                        `one-time` has nothing to renew. The menu says which control fixes
                        that rather than offering one the action would refuse. */}
                    {!online.chargesReady ? null
                      : autopay ? (
                        <RowMenuItem icon={XCircle} destructive
                          onClick={() => { close(); onStopAutopay(row) }}>
                          Stop automatic payments
                        </RowMenuItem>
                      ) : row.cadence === 'one-time' ? (
                        <RowMenuNote>
                          Pick a pay cadence to set up automatic payments.
                        </RowMenuNote>
                      ) : (
                        <RowMenuItem icon={Repeat}
                          onClick={() => { close(); onStartAutopay(row) }}>
                          Set up automatic payments
                        </RowMenuItem>
                      )}

                    {/* Only an OPTIONAL due may be declined. A required one has no item
                        here rather than a disabled one — a control that can never be used
                        is a promise nobody can act on. */}
                    {!row.required && (
                      <>
                        <RowMenuLabel>This due</RowMenuLabel>
                        <RowMenuItem icon={XCircle} onClick={() => { close(); onOptOut(row, true) }}>
                          Opt out
                        </RowMenuItem>
                      </>
                    )}
                  </>
                )}
              </>
            )}
          </RowMenu>
        </div>
      </td>
    </tr>
  )
}

// ── What is due now, across both tables ─────────────────────────────────────────────

/**
 * The summary under the two tables, and the one place both can be paid together.
 *
 * ── IT BELONGS TO NEITHER TABLE, WHICH IS WHY IT IS BELOW BOTH ─────────────────────
 * A required subtotal inside the required table and an optional one inside the optional table
 * would be two figures a member then has to add up themselves — and the thing they want is
 * the sum, because it is what the card is about to be charged.
 *
 * ── THE LINES ARE SHOWN WHEN THE TABLE IS, NOT WHEN THE MONEY IS ───────────────────
 * A member with optional dues who has settled or declined all of them reads
 * "Optional dues — $0.00", which is a fact about them. Dropping the line instead would make
 * the total look like it was only ever about the required half. The line is absent only when
 * the table is, and then there is nothing it could describe.
 *
 * ── THE BUTTON IS THE SAME ACTION AS THE ROW'S, OVER A LONGER LIST ─────────────────
 * `startDuesCheckout` takes one list either way, and Stripe's hosted page itemizes it —
 * one line per due — so the last thing the member reads before committing names what each
 * part of the total is for.
 */
function DuesTotals({
  required, optional, showRequiredLine, showOptionalLine, chargesReady, isPending, onPayAll,
}: {
  required: DuesSummary[]
  optional: DuesSummary[]
  showRequiredLine: boolean
  showOptionalLine: boolean
  chargesReady: boolean
  isPending: boolean
  onPayAll: () => void
}) {
  const sum = (rows: DuesSummary[]) => rows.reduce((t, r) => t + r.nextInstallmentCents, 0)
  const requiredCents = sum(required)
  const optionalCents = sum(optional)
  const totalCents = requiredCents + optionalCents
  const count = required.length + optional.length

  return (
    <section className="rounded-xl border bg-card p-4 sm:p-5">
      <h2 className="text-lg font-semibold text-brand-ink">Due now</h2>
      <p className="text-sm text-muted-foreground">
        {count === 0
          ? 'Nothing is waiting on you across either table.'
          : `What the calendar has asked for across ${count === 1 ? 'one due' : `${count} dues`}, including anything still to catch up on.`}
      </p>

      <dl className="mt-4 space-y-1.5 text-sm">
        {showRequiredLine && (
          <div className="flex items-baseline justify-between gap-4">
            <dt className="text-muted-foreground">Required dues</dt>
            <dd className="font-semibold whitespace-nowrap">{formatCurrency(requiredCents)}</dd>
          </div>
        )}
        {showOptionalLine && (
          <div className="flex items-baseline justify-between gap-4">
            <dt className="text-muted-foreground">Optional dues</dt>
            <dd className="font-semibold whitespace-nowrap">{formatCurrency(optionalCents)}</dd>
          </div>
        )}
        <div className="flex items-baseline justify-between gap-4 border-t pt-1.5">
          <dt className="font-medium">Total</dt>
          <dd className="text-lg font-bold text-brand-accent whitespace-nowrap">
            {formatCurrency(totalCents)}
          </dd>
        </div>
      </dl>

      {totalCents > 0 && (
        chargesReady ? (
          <div className="mt-4">
            <Button variant="affirm" disabled={isPending} onClick={onPayAll}>
              <CreditCard className="h-4 w-4" />
              Pay {formatCurrency(totalCents)} by card
            </Button>
            <p className="mt-2 text-xs text-muted-foreground">
              One payment, itemized by due. It posts to the family&rsquo;s books the moment it
              clears — there is nothing for anyone to key in afterwards.
            </p>
          </div>
        ) : (
          // Said once, below both tables, where the old per-row "Pay online (coming soon)"
          // button said it N times. It answers the question that button raised and never
          // could — "so how DO I pay?" — which is the more useful half.
          <p className="mt-4 text-xs text-muted-foreground">
            Your family has not connected a card processor yet. Pay by whatever means your
            family already uses, and it appears here once an administrator records it.
          </p>
        )
      )}
    </section>
  )
}

// ── Choosing a cadence ──────────────────────────────────────────────────────────────

/**
 * The cadence picker, priced.
 *
 * ── IT REPLACED A `<select>` PLUS A CONFIRMATION, AND SAYS MORE THAN BOTH ──────────
 * The old control changed the plan and then described what had happened in a confirmation
 * dialog. This prices every option BEFORE one is chosen, which is the order somebody actually
 * decides in — and it is the only place the catch-up can be shown per option, because that
 * figure is different for each of the five.
 *
 * Radios rather than a `<select>`: five options, each needing a second line of its own, is
 * not something a native option list can render.
 */
function CadenceDialog({ row, planFor, onClose, onChoose }: {
  row: DuesSummary
  planFor: (r: DuesSummary, cadence: PayCadence) => {
    installmentCents: number
    nextInstallmentCents: number
    followingInstallmentCents: number
    followingInstallmentDate: string | null
    onSchedule: boolean
  }
  onClose: () => void
  onChoose: (cadence: PayCadence) => void
}) {
  const [choice, setChoice] = useState<PayCadence>(row.cadence)
  const preview = planFor(row, choice)

  return (
    <Dialog
      open
      onClose={onClose}
      title="Change pay cadence"
      description={`How often you pay ${row.schedule.label}. The annual total does not change — the cadence divides it.`}
    >
      <div className="space-y-4">
        <fieldset className="space-y-1">
          <legend className="sr-only">Pay cadence for {row.schedule.label}</legend>
          {PAY_CADENCES.map(c => {
            const p = planFor(row, c)
            return (
              <label
                key={c}
                className={cn(
                  'flex cursor-pointer items-start gap-3 rounded-lg border p-3 transition-colors',
                  choice === c ? 'border-brand-primary bg-brand-soft/50' : 'hover:bg-muted/40',
                )}
              >
                <input
                  type="radio"
                  name="cadence"
                  value={c}
                  checked={choice === c}
                  onChange={() => setChoice(c)}
                  className="mt-1 accent-[var(--brand-primary)]"
                />
                <span className="min-w-0 flex-1">
                  <span className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5">
                    <span className="font-medium capitalize">{c}</span>
                    <span className="text-sm font-semibold whitespace-nowrap">
                      {formatCurrency(p.installmentCents)}
                      <span className="font-normal text-muted-foreground"> per installment</span>
                    </span>
                  </span>
                  {/* THE CATCH-UP, NAMED PER OPTION. Switching to monthly in August does not
                      mean $50 a month — it means one payment covering the year to date and
                      $50 a month after that, and an option list showing only the steady
                      figure would be pricing a plan the member cannot actually be on. */}
                  {!p.onSchedule && (
                    <span className="mt-0.5 block text-xs text-brand-withheld">
                      Next payment {formatCurrency(p.nextInstallmentCents)}, covering what has come due so far
                      {p.followingInstallmentDate
                        ? `, then ${formatCurrency(p.followingInstallmentCents)} each time`
                        : ''}
                    </span>
                  )}
                  {c === row.cadence && (
                    <span className="mt-0.5 block text-xs text-muted-foreground">
                      What you pay now
                    </span>
                  )}
                </span>
              </label>
            )
          })}
        </fieldset>

        <div className="flex flex-wrap justify-end gap-2">
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button
            variant="affirm"
            disabled={choice === row.cadence}
            onClick={() => onChoose(choice)}
          >
            {/* Names the consequence rather than saying "Save", because the figure it
                commits to is the one thing that changed. */}
            Pay {formatCurrency(preview.nextInstallmentCents)} next
          </Button>
        </div>
      </div>
    </Dialog>
  )
}

// ── Paying, once ────────────────────────────────────────────────────────────────────

/**
 * The one-off card payment: one due, or every due at once.
 *
 * ── THE AMOUNTS ARE PREFILLED AND EDITABLE, AND BOUNDED ON THE SERVER ─────────────
 * Prefilled with what the schedule says is due NOW (`nextInstallmentCents`, which is larger
 * than an installment when the member is behind — `lib/dues-utils.ts` §7c) and editable,
 * because a member paying a due off entirely is an ordinary thing to want. The ceiling shown
 * here is a courtesy; `startDuesCheckout` recomputes each one from `duesPlanMath` and
 * refuses anything above it, because these fields are browser inputs and the action is a
 * public endpoint.
 *
 * ── A LINE MAY BE ZEROED, WHICH IS HOW A COMBINED PAYMENT IS TRIMMED ──────────────
 * Setting one due to nothing drops it from the payment rather than refusing the form. That is
 * the only way to say "pay these three but not the fourth" without a second control, and the
 * action refuses a zero, so an empty list is caught here with a sentence rather than there
 * with a redirect.
 */
function PayDialog({ rows, onClose }: { rows: DuesSummary[]; onClose: () => void }) {
  const [pending, startTransition] = useTransition()
  const [error, setError] = useState('')
  const [fieldError, setFieldError] = useState('')
  const [amounts, setAmounts] = useState<Record<string, string>>(() =>
    Object.fromEntries(rows.map(r => [r.schedule.id, (r.nextInstallmentCents / 100).toFixed(2)])),
  )

  const parsed = rows.map(r => ({
    row: r,
    cents: Math.round(Number(amounts[r.schedule.id]) * 100),
  }))
  const valid = parsed.filter(p => Number.isFinite(p.cents) && p.cents > 0)
  const totalCents = valid.reduce((t, p) => t + p.cents, 0)

  function pay() {
    setError('')
    setFieldError('')
    // Parsed rather than trusted, and the SAME refusals the server gives, so somebody who has
    // typed something impossible finds out before a redirect rather than after.
    for (const p of parsed) {
      if (!Number.isFinite(p.cents)) {
        setFieldError(`Enter an amount for ${p.row.schedule.label}, or zero to leave it out.`)
        return
      }
      if (p.cents > p.row.remainingBalanceCents) {
        setFieldError(`The most that can be paid on ${p.row.schedule.label} is ${formatCurrency(p.row.remainingBalanceCents)}.`)
        return
      }
    }
    if (valid.length === 0) {
      setFieldError('Enter an amount to pay.')
      return
    }
    startTransition(async () => {
      const result = await startDuesCheckout({
        items: valid.map(p => ({ scheduleId: p.row.schedule.id, amountCents: p.cents })),
      })
      if (!result.success) { setError(result.message); return }
      // Stripe's hosted page, in this tab. A Checkout Session is single-use and expires, so a
      // tab left open holds a link that may already be spent — and the member has to come back
      // here afterwards anyway, which `success_url` handles.
      window.location.href = result.url
    })
  }

  const many = rows.length > 1

  return (
    <Dialog
      open
      onClose={onClose}
      title={many ? 'Pay by card' : `Pay ${rows[0].schedule.label}`}
      description={many
        ? 'One payment across every due below. Set a due to zero to leave it out.'
        : 'Paid straight to your family. It posts to their books the moment it clears.'}
    >
      <div className="space-y-4">
        <div className="space-y-3">
          {rows.map(r => (
            <div key={r.schedule.id} className="flex flex-wrap items-end justify-between gap-2">
              <div className="min-w-0 flex-1">
                <Label htmlFor={`pay-${r.schedule.id}`}>{r.schedule.label}</Label>
                <p className="text-xs text-muted-foreground">
                  {formatCurrency(r.remainingBalanceCents)} outstanding
                </p>
              </div>
              <div className="w-28 shrink-0">
                <Input
                  id={`pay-${r.schedule.id}`}
                  type="number"
                  min="0"
                  step="0.01"
                  max={(r.remainingBalanceCents / 100).toFixed(2)}
                  value={amounts[r.schedule.id] ?? ''}
                  onChange={e => setAmounts(a => ({ ...a, [r.schedule.id]: e.target.value }))}
                  disabled={pending}
                />
              </div>
            </div>
          ))}
        </div>

        {many && (
          <div className="flex items-baseline justify-between gap-4 border-t pt-3">
            <span className="font-medium">Total</span>
            <span className="text-lg font-bold text-brand-accent whitespace-nowrap">
              {formatCurrency(totalCents)}
            </span>
          </div>
        )}

        {/* ONE INPUT being wrong, per form-message.tsx. It is rendered here rather than under
            each field because the body of a dialog scrolls and its buttons do not — a message
            beside the field it is about can be off-screen at the moment somebody presses the
            button again. */}
        <FieldError message={fieldError} />
        {/* The refused OPERATION, beside the button that caused it. */}
        <FormError message={error} />

        <div className="flex flex-wrap justify-end gap-2">
          <Button variant="ghost" onClick={onClose} disabled={pending}>Cancel</Button>
          {/* Disabled only while a redirect is being fetched, NOT when the total is zero.
              A dead button is an unexplained refusal — pressing it with every field empty
              answers "Enter an amount to pay", which is the sentence somebody in that state
              needs. Same reasoning as the autopay menu item naming the control that fixes it
              rather than being greyed out. */}
          <Button variant="affirm" onClick={pay} disabled={pending}>
            <CreditCard className="h-4 w-4" />
            {pending ? 'Opening…' : `Pay ${formatCurrency(totalCents)}`}
          </Button>
        </div>
      </div>
    </Dialog>
  )
}
