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
 * ── EACH TABLE IS A CARD, AND NEITHER HAS A LEDE ──────────────────────────────────
 * `rounded-xl border bg-card`, the panel every other section of this product sits in. Two
 * bare tables stacked on a page have nothing marking where one ends: the rule under the last
 * required row and the rule between two rows are the same rule. The heading goes inside the
 * border with it.
 *
 * There is no sentence under either heading. "Required dues" and "Optional dues" already say
 * what a lede was saying, and a paragraph on each card pushed the first row of the first
 * table below the fold on a phone.
 *
 * ── EVERY SCHEDULE IS LISTED, INCLUDING SETTLED ONES ──────────────────────────────
 * A due paid in full used to vanish from the screen. These tables are the member's ROSTER —
 * what they are on and where they stand — so a settled due stays, says **Paid**, and shows a
 * zero balance. What is OWED is the **Due now** card underneath, which is the one place a
 * total belongs and the only place it can be acted on.
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

  // ── EVERY SCHEDULE IS LISTED, SETTLED ONES INCLUDED (2026-08-26) ────────────────
  // A due paid in full for the period dropped off the screen entirely, and that was wrong in
  // a way that is easy to miss: the member's question is "what am I on and where do I stand",
  // and a schedule vanishing the moment it is settled answers neither. It reads as the due
  // having been removed, or as the payment having lost it — and it made the two tables
  // disagree with the roster an administrator sees on Accounting.
  //
  // So the table is the ROSTER now, and standing is a state on the row: a settled due says
  // **Paid** and shows a zero balance rather than leaving. What is owed is the **Due now**
  // card underneath, which is where a total belongs and where it can be acted on.
  const requiredRows = rows.filter(r => r.required)
  const optionalRows = rows.filter(r => !r.required)

  // ── What the member can actually pay by card ───────────────────────────────────
  // `isOutstanding` is the whole predicate: it is false for a declined due, false for a
  // settled one, and false for an age-exempt one (whose remaining balance is zero, so
  // `paid` is already true of it). The `kind` test is belt and braces — this summary holds
  // dues only — and it is kept because `startDuesCheckout` refuses a donation and a
  // screen offering something the action refuses is worse than one that does not offer it.
  const payable = rows.filter(r => isOutstanding(r) && r.schedule.kind === 'dues')
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

      {/* A DIFFERENT SENTENCE SINCE SETTLED DUES STAY LISTED. This branch used to mean
          "nothing outstanding" and now means "on no schedules at all", which is a fact about
          the family rather than about the member — so "you're all caught up" would be
          congratulating somebody on having paid nothing. Being caught up is what the **Paid**
          rows and the zero total say now. */}
      {rows.length === 0 ? (
        <div className="flex flex-col items-center py-10 gap-2">
          <CheckCircle2 className="h-10 w-10 text-muted-foreground/20" />
          <p className="text-sm text-muted-foreground">
            You are not on any dues schedules — your family has not set any up for you.
          </p>
        </div>
      ) : (
        <div className="space-y-8">
          {/* ONLY THE TABLES THE MEMBER HAS A SCHEDULE FOR. A heading over an empty table
              is a worse answer than no heading at all — it says the family runs optional
              dues and this member is on none of them, which is a different fact and usually
              not the true one. */}
          {requiredRows.length > 0 && (
            <DuesTable title="Required dues" rows={requiredRows} {...rowProps} />
          )}

          {optionalRows.length > 0 && (
            <DuesTable title="Optional dues" rows={optionalRows} {...rowProps} />
          )}

          <DuesTotals
            lines={payable}
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
function DuesTable({ title, rows, ...handlers }: {
  title: string
  rows: DuesSummary[]
} & RowHandlers) {
  const [sort, setSort] = useState<{ col: DuesCol; dir: SortDir }>({ col: 'due_date', dir: 'asc' })
  function sortBy(col: DuesCol) {
    setSort(s => s.col === col ? { col, dir: s.dir === 'asc' ? 'desc' : 'asc' } : { col, dir: 'asc' })
  }

  // ── FOUR BANDS, MOST ACTIONABLE FIRST ──────────────────────────────────────────
  // Still owed, then settled, then declined, then not owed yet — and each band is sorted
  // among itself by whichever column the reader chose. Everything below the first band is
  // something the member cannot act on, so none of it may sit above something they still
  // have to pay; and within that, a due they PAID is worth more of their attention than
  // one they declined, which in turn beats one that has not started.
  //
  // NOT a useMemo, deliberately, and removing it made this component FASTER rather than
  // slower. React Compiler could not preserve the manual memoization — it cannot prove
  // the array is never mutated, because `.sort` mutates its receiver. Faced with a
  // `useMemo` whose dependency it cannot vouch for, the compiler bails out of optimizing
  // the WHOLE component — "Compilation Skipped" — so the one hand-written memo was costing
  // every other value in the file its automatic memoization.
  //
  // The spread is what makes it safe to sort: this is a fresh array, so no prop is
  // touched.
  //
  // ORDER OF THE TESTS MATTERS. `paid` is true of an age-exempt row as well — its remaining
  // balance is zero — so age has to be asked about first, or a due nobody owes yet would be
  // reported as one they had settled.
  const rank = (s: DuesSummary) =>
    s.ageExempt ? 3 : s.optedOut ? 2 : s.paid ? 1 : 0
  const sorted = [...rows].sort((a, b) => {
    if (rank(a) !== rank(b)) return rank(a) - rank(b)
    let cmp = 0
    if (sort.col === 'amount') cmp = a.nextInstallmentCents - b.nextInstallmentCents
    else if (sort.col === 'due_date') cmp = (a.nextInstallmentDate ?? '').localeCompare(b.nextInstallmentDate ?? '')
    else cmp = a.schedule.label.localeCompare(b.schedule.label)
    return sort.dir === 'asc' ? cmp : -cmp
  })

  return (
    // ── A CARD, NOT A FLAT BLOCK ────────────────────────────────────────────────
    // Two tables in a row on one page need something saying where one ends and the next
    // begins, and a heading alone does not do it — the rules between rows read exactly
    // like the rule between tables. `rounded-xl border bg-card` is the panel every other
    // section of this product sits in, so this is the house style rather than a new one.
    //
    // The heading is INSIDE the border, and there is no lede under it. "Required dues"
    // and "Optional dues" say the whole of what a sentence underneath was saying, and a
    // paragraph of explanation on every card pushes the first row down the screen — on a
    // phone, below the fold. What genuinely needs explaining is on the row that needs it.
    <section className="rounded-xl border bg-card">
      <h2 className="px-4 pt-4 text-lg font-semibold text-brand-ink sm:px-5 sm:pt-5">{title}</h2>
      <div className="px-4 pb-2 sm:px-5">
        <table className="w-full text-sm">
          {/* ── THE SCHEDULE COLUMN TAKES WHAT IS LEFT ──────────────────────────
              Widths on the four narrow headings and none on the first, which is what auto
              layout needs to hear: with nothing stated the browser shares the table
              proportionally by content, and the schedule name — the only thing here that
              wraps — ends up in a column narrower than the fixed-width figures beside it,
              breaking "Building Maintenance Fund" over three lines next to acres of white
              space. Naming the other four lets the name absorb the remainder.

              ON THE HEADINGS, NOT IN A `<colgroup>`. Only a handful of properties apply to
              a `<col>` and `display` is not reliably one of them, so a hidden column there
              would be a browser-by-browser question. These four headings already fold with
              their cells through `COLLAPSING_CELL`, and a `sm:` width on an element that is
              `display: none` below `sm` contributes exactly nothing — which is the
              behaviour wanted, stated in one place. */}
          <thead>
            <tr className="border-b">
              <SortTh label="Schedule" active={sort.col === 'schedule'} dir={sort.dir} onClick={() => sortBy('schedule')} />
              <SortTh label="Next Payment" active={sort.col === 'amount'} dir={sort.dir} onClick={() => sortBy('amount')} align="right" className="w-28 sm:w-36" />
              <SortTh label="Next Due" active={sort.col === 'due_date'} dir={sort.dir} onClick={() => sortBy('due_date')} className={cn(COLLAPSING_CELL, 'sm:w-28')} />
              <th className={cn('py-2 pr-3 text-xs font-medium text-muted-foreground text-right', COLLAPSING_CELL, 'sm:w-28')}>Remaining</th>
              {/* `sr-only` like every other action column here: the cell holds controls that
                  name themselves, and a visible "Actions" heading over two icons is noise. */}
              <th className="w-20 py-2 text-xs font-medium text-muted-foreground text-right sm:w-24">
                <span className="sr-only">Actions</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {sorted.map(s => <DuesRow key={s.schedule.id} row={s} {...handlers} />)}
          </tbody>
        </table>
      </div>
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
  /**
   * Settled in full for this period.
   *
   * A FOURTH STATE, and a positive one — which is why it does NOT join `quiet` below. A
   * declined due and one that has not started are greyed because nothing is happening on
   * them; a paid one is the good outcome and greying it would file success under the same
   * heading as absence.
   *
   * `row.paid` is `remainingBalanceCents <= 0`, which is true of an age-exempt row too, so
   * both other states are excluded explicitly rather than by ordering luck.
   */
  const settled = row.paid && !declined && !notYetOwed
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
  ) : settled ? (
    // AFFIRM, the token for a good outcome — the same treatment "Goal met" gets on a
    // donation drive. A settled due stays listed rather than dropping off the screen (see
    // the section header), so it needs to say WHY it has no figures beside it, and it must
    // not look like the muted rows below it.
    <span className="inline-block whitespace-nowrap rounded-full bg-brand-affirm px-2 py-0.5 text-[11px] font-medium text-brand-on-affirm">
      Paid
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
              {/* A SETTLED ROW STILL SHOWS ITS BALANCE, and it is zero. That is the whole
                  point of keeping it listed — "you are on this and you owe nothing on it"
                  is a different sentence from the row not being there. */}
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
        {/* An em dash for a due with no next payment — one nobody owes yet, and one already
            settled. A "$0.00" here is a figure somebody would try to reconcile; a dash is
            the honest answer to "what is your next installment" when there is not going to
            be one. The BALANCE column is where the zero belongs, and it says it there. */}
        <span className={cn((quiet || settled) && 'text-muted-foreground', declined && 'line-through')}>
          {notYetOwed || settled ? '—' : formatCurrency(declined ? row.installmentCents : row.nextInstallmentCents)}
        </span>
        {!quiet && !settled && (
          <span className="block text-[11px] font-normal capitalize text-muted-foreground">
            {row.cadence}
          </span>
        )}
        {!quiet && !settled && !row.onSchedule && row.followingInstallmentDate && (
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

      {/* A dash for a due with no balance to speak of — declined, or not started — and the
          real zero for a settled one. `--brand-accent` is reserved for money still to find:
          a settled row printing "$0.00" in the owing colour would draw the eye to the one
          line on the screen that needs nothing. */}
      <td className={cn('py-2.5 pr-3 text-right font-semibold whitespace-nowrap',
        quiet || settled ? 'text-muted-foreground' : 'text-brand-accent', COLLAPSING_CELL)}>
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
                  // A SETTLED ROW KEEPS THE WHOLE MENU. Nothing is owed now and the period
                  // turns over, so changing the cadence or starting automatic payments is
                  // exactly the thing somebody who has just cleared a due wants to do.
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
 * ── IT ITEMIZES, since 2026-08-26 ─────────────────────────────────────────────────
 * It showed two subtotals — "Required dues", "Optional dues" — and a total, which is a
 * receipt that names none of the things on it. A member reading a $525 total had to work out
 * which of six schedules it covered by scanning back up two tables and adding the amounts
 * themselves, which is the arithmetic this card exists to do for them.
 *
 * So one line per due, then the total. It is the same list the payment dialog will show and
 * the same list Stripe's hosted page will show, in the same order — three renderings of one
 * basket, which is what makes the figure on the button trustworthy.
 *
 * The optional ones are tagged rather than grouped. Grouping would rebuild the two tables
 * above in miniature; the tag carries the one fact that the flat list would otherwise lose,
 * which is that part of this total is a thing the member chose to take on and could decline.
 *
 * ── THE BUTTON SITS RIGHT, WITH THE FIGURES ───────────────────────────────────────
 * Every amount on this card is right-aligned and the total is the last of them, so a button
 * whose label is that same figure belongs on the same edge. Left-aligned it started a third
 * column of its own under a card that has two.
 */
function DuesTotals({ lines, chargesReady, isPending, onPayAll }: {
  /** Every due with something to pay, in the order the tables list them. */
  lines: DuesSummary[]
  chargesReady: boolean
  isPending: boolean
  onPayAll: () => void
}) {
  // REQUIRED FIRST, then optional, then by name — the reading order of the two tables above,
  // so a member checking the receipt against the list they just read finds the rows in the
  // same sequence. Sorted from a fresh array; `lines` is a prop.
  const ordered = [...lines].sort((a, b) =>
    Number(b.required) - Number(a.required) || a.schedule.label.localeCompare(b.schedule.label))
  const totalCents = ordered.reduce((t, r) => t + r.nextInstallmentCents, 0)

  return (
    <section className="rounded-xl border bg-card p-4 sm:p-5">
      <h2 className="text-lg font-semibold text-brand-ink">Due now</h2>
      <p className="text-sm text-muted-foreground">
        {ordered.length === 0
          ? 'Nothing is waiting on you — every due is settled or declined.'
          : 'What the calendar has asked for, including anything still to catch up on.'}
      </p>

      {ordered.length > 0 && (
        <dl className="mt-4 space-y-1.5 text-sm">
          {ordered.map(r => (
            <div key={r.schedule.id} className="flex items-baseline justify-between gap-4">
              <dt className="min-w-0 text-muted-foreground">
                <span className="text-foreground">{r.schedule.label}</span>
                {!r.required && (
                  <span className="ml-1.5 text-xs text-muted-foreground">optional</span>
                )}
                {/* THE CATCH-UP, NAMED ON ITS OWN LINE. A member reading "$450" beside a due
                    whose installment is $50 has to be told why here as well as in the table,
                    because this is the card the payment is made from — an unexplained figure
                    on a receipt is the one somebody abandons the checkout over. */}
                {!r.onSchedule && r.periodsElapsed > 0 && (
                  <span className="block text-xs text-brand-withheld">
                    covers {r.periodsElapsed} earlier installment{r.periodsElapsed === 1 ? '' : 's'}
                  </span>
                )}
              </dt>
              <dd className="font-semibold whitespace-nowrap">
                {formatCurrency(r.nextInstallmentCents)}
              </dd>
            </div>
          ))}
        </dl>
      )}

      <dl className="mt-3 border-t pt-2 text-sm">
        <div className="flex items-baseline justify-between gap-4">
          <dt className="font-medium">Total</dt>
          <dd className="text-lg font-bold text-brand-accent whitespace-nowrap">
            {formatCurrency(totalCents)}
          </dd>
        </div>
      </dl>

      {totalCents > 0 && (
        chargesReady ? (
          // The small print LEFT and the button RIGHT, wrapping to two rows on a narrow
          // screen with the button underneath. `items-end` so the two baselines meet when
          // they do share a row.
          <div className="mt-4 flex flex-wrap items-end justify-between gap-3">
            <p className="max-w-md text-xs text-muted-foreground">
              One payment, itemized by due. It posts to the family&rsquo;s books the moment it
              clears — there is nothing for anyone to key in afterwards.
            </p>
            <Button variant="affirm" disabled={isPending} onClick={onPayAll} className="ml-auto">
              <CreditCard className="h-4 w-4" />
              Pay {formatCurrency(totalCents)} by card
            </Button>
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
