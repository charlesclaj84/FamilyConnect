'use client'

import { useState, useMemo, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import {
  CheckCircle2, DollarSign, CalendarClock, HeartHandshake, History,
  Search, ArrowUpDown, ChevronUp, ChevronDown,
} from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Select } from '@/components/ui/select'
import { Button } from '@/components/ui/button'
import { Dialog } from '@/components/ui/dialog'
import { cn } from '@/lib/utils'
import { formatCurrency } from '@/lib/currency-utils'
import { formatDate } from '@/lib/date-utils'
import {
  currentPeriodStart, duesPlanMath, isOutstanding,
  PAY_CADENCES, PAYMENT_STATUS_LABELS, type PayCadence,
} from '@/lib/dues-utils'
import { useConfirm } from '@/components/ui/confirm'
import { COLLAPSING_CELL, RowMeta, MetaDot, MetaIf } from '@/components/ui/table-collapse'
import { FormError } from '@/components/ui/form-message'
import { useServerState } from '@/lib/use-server-state'
import {
  setMyDuesPlan, setMyDuesOptOut,
  type DuesSummary, type DuesPayment,
} from '@/app/actions/dues'
import { DuesBalanceKpi } from '@/components/dues/DuesBalanceKpi'
import { MainRail, type MainRailItem } from '@/components/layout/MainRail'
import {
  SUMMARY_PANE_LABELS, type SummaryPane,
} from '@/components/account/summary-panes'

type SortDir = 'asc' | 'desc'
type HistCol = 'schedule' | 'date' | 'amount'
type DuesCol = 'schedule' | 'amount' | 'due_date'

const fmtDate = (s: string) => formatDate(s) ?? ''

/**
 * One of the member's own payments, as the detail dialog shows it.
 *
 * THE SAME DIALOG THE LEDGERS HAVE, minus the bookkeeping. Transactions has had a
 * per-row detail view since the four ledgers were built; Payment History looked
 * identical — a table of rows that reward a click — and did nothing when clicked, so a
 * member who wanted the cheque number for a payment had no way to reach it. Every field
 * below is already in the row's props; this is a rendering, not a fetch.
 *
 * WHAT IS DELIBERATELY ABSENT is "Recorded by", which `viewOfPayment` in
 * TransactionsClient leads with. `getMyPaymentHistory` does not embed the recorder at
 * all — "who keyed the payment in is treasurer bookkeeping the member has no use for",
 * and not fetching it is what keeps it out of the RSC payload (AGENTS.md §5). It would
 * render as "No longer in the family" for every row if it were listed here, which is the
 * one thing worse than omitting it. `person_name` is null for the same reason and would
 * be the member reading the page anyway, so the schedule is the title instead.
 *
 * Every value is pre-formatted to a string, exactly as the ledger dialog does it, so a
 * date or an amount cannot be shown one way in the table and another in the detail.
 */
function viewOfMyPayment(p: DuesPayment): {
  title: string
  subtitle: string
  fields: { label: string; value: string | null }[]
} {
  const isReversal = Boolean(p.reverses_id)
  const kindWord = p.schedule_kind === 'donation' ? 'Donation payment' : 'Dues payment'
  return {
    title: p.schedule_label ?? 'General Payment',
    subtitle: isReversal ? `${kindWord} — correcting entry` : kindWord,
    fields: [
      { label: 'Amount', value: formatCurrency(p.amount_cents) },
      { label: 'Status', value: PAYMENT_STATUS_LABELS[p.status] ?? p.status },
      { label: 'Date', value: formatDate(p.payment_date) },
      // Both null on a waived row by design — no money moved, so there was no method
      // and no cheque to number. The dialog renders a null as an em dash.
      { label: 'Payment method', value: p.payment_method },
      { label: 'Check # / Reference', value: p.payment_reference },
      { label: 'Notes', value: p.notes },
      // When the family recorded it, which is not the same as when it was paid — a
      // cheque handed over in March and keyed in in May has two different dates, and
      // this is the one that explains why it only just appeared here.
      { label: 'Recorded', value: formatDate(p.created_at) },
      ...(p.reversed_by_id
        ? [{ label: 'Reversed', value: 'Yes — a correcting entry cancels this payment' }]
        : []),
      ...(isReversal
        ? [{ label: 'Corrects', value: 'An earlier payment in this history' }]
        : []),
    ],
  }
}

function SortTh({
  label, active, dir, onClick, align = 'left', className,
}: {
  label: string; active: boolean; dir: SortDir; onClick: () => void
  align?: 'left' | 'right'
  /** Pass `COLLAPSING_CELL` when this heading's column folds below `sm`. */
  className?: string
}) {
  const Icon = active ? (dir === 'asc' ? ChevronUp : ChevronDown) : ArrowUpDown
  return (
    <th className={cn(
      'py-2 pr-3 text-xs font-medium text-muted-foreground',
      align === 'right' ? 'text-right' : 'text-left',
      className,
    )}>
      <button
        type="button"
        onClick={onClick}
        className={`inline-flex items-center gap-0.5 hover:text-foreground select-none ${align === 'right' ? 'flex-row-reverse' : ''}`}
      >
        {label}
        <Icon className="h-3 w-3 opacity-60" />
      </button>
    </th>
  )
}

interface Props {
  summary: DuesSummary[]
  history: DuesPayment[]
  /** The Donations pane. See the call site for why it arrives as a slot. */
  donationsSlot?: React.ReactNode
  /**
   * Whether the family HAS any donations — which the slot cannot tell us, because
   * DonationsSection renders null when there are none and a null child is
   * indistinguishable from a child that draws nothing.
   *
   * The rail needs to know: an item is a promise that there is something behind it, and
   * a Donations tab opening an empty panel is worse than no tab at all.
   */
  hasDonations: boolean
  /**
   * The panes this caller holds a view grant on, from PANE_RESOURCE — resolved on the
   * server, which also skips the fetch for every pane absent from this list.
   *
   * So a missing pane means missing DATA as well as a missing tab, and the stat card
   * that summarises it goes with it: "Paid This Year" is the payment history in one
   * figure, and rendering it over a `history` of `[]` would report $0.00 to a member
   * who has paid. In SUMMARY_PANES order, so the rail keeps its order without sorting.
   *
   * Separate from `hasDonations`, which answers a different question — that pane is
   * hidden when the family HAS no donations, this one when the member may not see
   * them. Both hide it; only one of them is about permission.
   */
  visiblePanes: SummaryPane[]
  /** Pane resolved from `?pane=` on the server, so the first paint is already right. */
  initialPane: SummaryPane
}

export function DuesDetailSection({
  summary, history, donationsSlot, hasDonations, visiblePanes, initialPane,
}: Props) {
  const router = useRouter()
  const confirm = useConfirm()
  const [isPending, startTransition] = useTransition()

  // Local mirror of summary so cadence changes recompute installments instantly.
  // `useServerState` re-syncs it whenever the server re-fetches — after recording a
  // payment, and after an admin adds a dues schedule, which revalidates this page.
  const [rows, setRows] = useServerState<DuesSummary[]>(summary)
  const [error, setError] = useState('')

  // Which pane the rail is showing. A family with no donations cannot land on that pane
  // even from a shared link — the item is not in the rail, so nothing would take them
  // back off it.
  //
  // The fallback is the first pane still in the rail rather than a hard-coded 'dues':
  // the server already redirected an unviewable `?pane=`, but Upcoming Dues is itself a
  // grant now, so naming it here would land a member without it on a pane the rail does
  // not contain.
  const [pane, setPane] = useState<SummaryPane>(() => {
    const usable = visiblePanes.filter(p => p !== 'donations' || hasDonations)
    return usable.includes(initialPane) ? initialPane : usable[0] ?? initialPane
  })

  function selectPane(next: SummaryPane) {
    setPane(next)
    // Rebuilt from the live search string so a pane switch never drops another param,
    // and replaceState rather than a router push: a real navigation refetches the RSC
    // payload and remounts this component, discarding the sort state and filter text
    // below. The URL stays shareable; only the round trip is skipped.
    const params = new URLSearchParams(window.location.search)
    params.set('pane', next)
    window.history.replaceState(null, '', `${window.location.pathname}?${params}`)
  }

  // `isOutstanding`, not `!paid`: a due the member has DECLINED is neither paid nor
  // owed, and counting it here would put a balance on the card they have already said no
  // to. Declined rows still appear in the table below, labelled, with the way back.
  const unpaid = rows.filter(isOutstanding)
  const declined = rows.filter(s => s.optedOut)
  const paidPayments = history.filter(p => p.status === 'paid')
  const totalPaidCents = paidPayments.reduce((sum, p) => sum + p.amount_cents, 0)
  // No required/optional totals here any more: DuesBalanceKpi derives its own from the
  // same rows, which is the point of it being one component rather than two.

  /**
   * What "Paid This Year" is the sum OF, per schedule, largest first.
   *
   * Dues and donations together, because both are rows of the same table and the member
   * asked one question: where did my money go. The schedule name separates them on its
   * own — a schedule is one kind or the other — so the lines need no Dues/Donation tag
   * to be readable.
   *
   * Reversals net out here exactly as they do in the headline: a reversal is a `paid` row
   * with a negative amount, so a payment that was corrected leaves its schedule showing
   * what is actually left of it, including `$0.00` if the whole thing was taken back.
   * That is the honest line to draw, and it is what explains a total that would otherwise
   * look short.
   *
   * Not memoized on purpose: `paidPayments` is a fresh array every render, so a useMemo
   * keyed on it would recompute anyway while costing a dependency the React Compiler then
   * has to reason about (see the bail-out it already reports on `sortedDues`).
   */
  const paidBySchedule = (() => {
    const byName = new Map<string, number>()
    for (const p of paidPayments) {
      // Same fallback the Payment History table uses, so one payment cannot be called two
      // different things on one page.
      const name = p.schedule_label ?? 'General Payment'
      byName.set(name, (byName.get(name) ?? 0) + p.amount_cents)
    }
    return [...byName]
      .map(([name, cents]) => ({ name, cents }))
      .sort((a, b) => b.cents - a.cents || a.name.localeCompare(b.name))
  })()

  /**
   * Every outstanding schedule that has a date to show, soonest first.
   *
   * The card used to name only the first of these and call itself "Next Installment"
   * whether there was one or five — so a member paying three dues on three cadences saw
   * one date and had to infer that the other two existed. It now lists each schedule's own
   * next date, and says "Installments" when it means more than one.
   */
  // NO CLIENT-SIDE CLAMP any more. `nextInstallmentCents` arrives already limited to the
  // remaining balance (see DuesSummary), and the `Math.min` that used to sit here was a
  // second answer to the same question — which is exactly how the figure in this card and
  // the figure in the table below came to be computed two different ways.
  const upcoming = unpaid
    .filter(s => s.nextInstallmentDate)
    .sort((a, b) => (a.nextInstallmentDate ?? '').localeCompare(b.nextInstallmentDate ?? ''))
  // The headline is what the member is about to pay across all of them — the catch-up
  // included, which is the whole point: a total that quietly showed the steady installment
  // while the row beside it asked for more is the disagreement this replaced.
  const upcomingTotalCents = upcoming.reduce((sum, s) => sum + s.nextInstallmentCents, 0)

  /**
   * Recompute a row's plan for a cadence the member has just picked, without waiting for
   * the server.
   *
   * The SAME function the server ran, from lib/dues-utils.ts — which is why that module
   * exists at all. Every input is already on the row: `currentPeriodStart` reads the
   * schedule's own dates (all serialized), and settled money is the two figures the
   * summary already carries. Nothing new crosses the wire for this.
   *
   * `new Date()` here is the browser's clock against a period start the server sent, so a
   * member sitting on the far side of a date boundary can see a figure one rung different
   * from what `router.refresh()` then returns. That is a one-day skew on an optimistic
   * preview which the refresh corrects a moment later, and it is the price of not making
   * the member wait for a round trip to see what a plan costs.
   */
  const planFor = (r: DuesSummary, cadence: PayCadence) => duesPlanMath({
    schedule: r.schedule,
    cadence,
    periodStart: currentPeriodStart(r.schedule),
    today: new Date().toISOString().slice(0, 10),
    settledCents: r.amountPaidThisPeriodCents + r.amountWaivedThisPeriodCents,
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
    // `useServerState`, which adopts the server's value on the next render — so a partial
    // patch left `arrearsCents`, `overdueSinceDate` and the date itself describing the OLD
    // cadence until the refresh landed, with the new installment figure beside them.
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
   * Confirmed in both directions, and worded to say what actually changes. Opting out is
   * not destructive — nothing is deleted and it can be undone from the same control — but
   * it does change what the family expects from this member, which is worth a deliberate
   * click rather than a stray one.
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

  // ── Sorting / filtering (history) ──
  // Which payment's detail dialog is open. Held as an ID rather than as the row itself,
  // for the reason TransactionsClient holds one: the dialog then re-derives from live
  // props, so a reversal posted while it is open updates the entry being read instead of
  // showing a stale snapshot of it.
  const [viewingId, setViewingId] = useState<string | null>(null)
  const viewedPayment = viewingId ? history.find(p => p.id === viewingId) ?? null : null
  const viewed = viewedPayment ? viewOfMyPayment(viewedPayment) : null

  const [histSearch, setHistSearch] = useState('')
  const [histSort, setHistSort] = useState<{ col: HistCol; dir: SortDir }>({ col: 'date', dir: 'desc' })
  function sortHist(col: HistCol) {
    setHistSort(s => s.col === col ? { col, dir: s.dir === 'asc' ? 'desc' : 'asc' } : { col, dir: 'asc' })
  }
  const filteredHistory = useMemo(() => {
    const q = histSearch.toLowerCase()
    const list = q
      ? history.filter(p =>
          (p.schedule_label ?? '').toLowerCase().includes(q) ||
          (p.payment_method ?? '').toLowerCase().includes(q) ||
          p.status.toLowerCase().includes(q))
      : [...history]
    return list.sort((a, b) => {
      let cmp = 0
      if (histSort.col === 'date') cmp = a.payment_date.localeCompare(b.payment_date)
      else if (histSort.col === 'amount') cmp = a.amount_cents - b.amount_cents
      else cmp = (a.schedule_label ?? '').localeCompare(b.schedule_label ?? '')
      return histSort.dir === 'asc' ? cmp : -cmp
    })
  }, [history, histSearch, histSort])

  // ── Sorting (outstanding dues) ──
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
  // `unpaid` is never mutated, because `upcoming` above reaches it through
  // `.filter(...).sort(...)` and `.sort` mutates its receiver (harmlessly here: the
  // receiver is the array `.filter` just created). Faced with a `useMemo` whose dependency
  // it cannot vouch for, the compiler bails out of optimizing the WHOLE component —
  // "Compilation Skipped" — so the one hand-written memo was costing every other value in
  // the file its automatic memoization. Computed plainly, the compiler memoizes this and
  // everything around it.
  //
  // The spread is what makes it safe to sort: `[...unpaid, ...declined]` is a fresh array,
  // so neither prop is touched.
  const sortedDues = [...unpaid, ...declined].sort((a, b) => {
    if (a.optedOut !== b.optedOut) return a.optedOut ? 1 : -1
    let cmp = 0
    if (duesSort.col === 'amount') cmp = a.installmentCents - b.installmentCents
    else if (duesSort.col === 'due_date') cmp = (a.nextInstallmentDate ?? '').localeCompare(b.nextInstallmentDate ?? '')
    else cmp = a.schedule.label.localeCompare(b.schedule.label)
    return duesSort.dir === 'asc' ? cmp : -cmp
  })

  // Reachable: `account-summary:view` opens the page, but each pane is its own grant
  // since 20260808000000, so a caller can hold the page and none of its contents.
  // Said out loud rather than rendered as three empty cards over an empty rail — the
  // same answer AdminAccountShell and TransactionsClient give.
  if (visiblePanes.length === 0) {
    return (
      <div className="rounded-xl border bg-muted/40 px-4 py-6 text-sm text-muted-foreground">
        None of the sections of Summary have been shared with you. Ask an
        administrator for access to the ones you need — your upcoming dues, the
        donation drives and your payment history are each granted separately.
      </div>
    )
  }

  // The cards are one per pane, so they appear and disappear with them. Donations has
  // no card of its own, which is why this counts two rather than three.
  const showDues = visiblePanes.includes('dues')
  const showHistory = visiblePanes.includes('history')
  // Column count follows the cards. A fixed `sm:grid-cols-3` would leave a hole where
  // a withheld card used to be, which reads as something that failed to load.
  const cardColumns = (showHistory ? 1 : 0) + (showDues ? 2 : 0)

  return (
    <div className="space-y-5">
      {/* ── Stat cards ── */}
      <div className={cn(
        'grid grid-cols-1 gap-4',
        cardColumns === 3 ? 'sm:grid-cols-3' : cardColumns === 2 ? 'sm:grid-cols-2' : '',
      )}>
        {showHistory && (
        <div className="rounded-2xl border bg-card p-5 space-y-2">
          <div className="flex items-center gap-2.5">
            <div className="p-1.5 rounded-full bg-brand-affirm"><CheckCircle2 className="h-4 w-4 text-brand-on-affirm" /></div>
            <span className="text-sm text-muted-foreground font-medium">Paid This Year</span>
          </div>
          <p className="text-3xl font-bold">{formatCurrency(totalPaidCents)}</p>
          <p className="text-xs text-muted-foreground">
            {paidPayments.length === 0 ? 'No payments on record' : `${paidPayments.length} payment${paidPayments.length !== 1 ? 's' : ''} recorded`}
          </p>
          {/* The breakdown, under the count. Name on the left, figure on the right rather
              than run together with a dash: these are a column of amounts to be compared
              with each other, and a right edge is what makes that possible. Long names
              truncate instead of wrapping, so the figures stay on their own lines. */}
          {paidBySchedule.length > 0 && (
            <ul className="space-y-0.5 pt-0.5">
              {paidBySchedule.map(g => (
                <li key={g.name} className="flex items-baseline justify-between gap-2 text-xs text-muted-foreground">
                  <span className="min-w-0 truncate" title={g.name}>{g.name}</span>
                  <span className="shrink-0 font-medium text-foreground">{formatCurrency(g.cents)}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
        )}

        {/* NOT A LOCAL CARD ANY MORE. This is the dashboard's Account card, the same
            component, unchanged — see DuesBalanceKpi. Two hand-rolled versions of one
            KPI had drifted into two different readings of the same money, and matching
            them by hand only lasts until the next edit to one of them.
            Fed from `rows` rather than the `summary` prop, so an opt-out or a cadence
            change updates the headline optimistically along with the table below. */}
        {showDues && <DuesBalanceKpi summary={rows} />}

        {showDues && (
        <div className="rounded-2xl border bg-card p-5 space-y-2">
          <div className="flex items-center gap-2.5">
            <div className="p-1.5 rounded-full bg-brand-affirm"><DollarSign className="h-4 w-4 text-brand-on-affirm" /></div>
            {/* Plural only when it is plural. One schedule and this card is about one
                payment; five and the figure below is a sum, which the title has to admit
                or the number reads as a single installment five times too large. */}
            <span className="text-sm text-muted-foreground font-medium">
              Next Installment{upcoming.length > 1 ? 's' : ''}
            </span>
          </div>
          <p className="text-2xl font-bold leading-tight">
            {upcoming.length > 0 ? formatCurrency(upcomingTotalCents) : '—'}
          </p>
          {upcoming.length === 0 ? (
            <p className="text-xs text-muted-foreground">No upcoming dues</p>
          ) : (
            /* TWO LINES PER SCHEDULE: the name, then when it is due and for how much.
               One line held all three and the name was the part that lost — it truncated
               first, because the date and the amount are fixed-width and it was not, so a
               "Building Maintenance Fund" was read as "Building Mainten…" while a date
               nobody was looking for sat beside it in full. On its own line it fits.
               The amount now shows even when there is only one schedule, where it repeats
               the headline. That repetition is worth less than a card whose rows change
               shape depending on how many of them there are. */
            <ul className="space-y-1.5">
              {upcoming.map(s => (
                <li key={s.schedule.id} className="text-xs">
                  <p className="truncate font-medium" title={s.schedule.label}>{s.schedule.label}</p>
                  <p className="text-muted-foreground">
                    due {fmtDate(s.nextInstallmentDate!)}
                    {' · '}
                    <span className="font-medium text-foreground">{formatCurrency(s.nextInstallmentCents)}</span>
                  </p>
                  {/* THE SECOND LINE IS THE ANSWER TO "why is this more than my
                      installment". A catch-up figure with nothing explaining it reads as
                      an error, and the thing that explains it is what comes after: one
                      larger payment, then the ordinary amount. Rendered only when there is
                      one — a member who is level has nothing to catch up and needs no
                      sentence about it. */}
                  {!s.onSchedule && s.followingInstallmentDate && (
                    <p className="text-muted-foreground/80">
                      covers {s.periodsElapsed} earlier installment{s.periodsElapsed === 1 ? '' : 's'}
                      {' · then '}
                      {formatCurrency(s.followingInstallmentCents)} from {fmtDate(s.followingInstallmentDate)}
                    </p>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>
        )}
      </div>

      {/* ── The rail, under the stat cards ──
          The cards are a summary of ALL THREE panes at once — paid to date, what is
          left, what is next — so they belong above the rail rather than inside any one
          pane. Switching pane does not change them, which is the point. */}
      {/* Two independent narrowings, both of which remove an item: the permission
          grant, and — for Donations alone — whether the family has any. */}
      <MainRail
        label="Summary sections"
        items={RAIL_ITEMS.filter(i =>
          visiblePanes.includes(i.id) && (i.id !== 'donations' || hasDonations),
        )}
        active={pane}
        onSelect={selectPane}
      />

      {/* ── Upcoming Dues ──
          Titled for what is coming rather than what is owed: "Outstanding Dues"
          under a warning icon read as a debt notice, and this pane is really the
          member's payment plan.

          No card header any more — the rail item above names it, and a second copy of
          the same three words was the first line of the pane. Same reasoning as the
          Accounting shell, which dropped its pane headings for the same duplication. */}
      {/* No card box on any of the three panes. The border made sense when all three
          stacked down the page and it was the only thing marking where one ended; the
          rail does that now, and a bordered panel holding the only thing on screen is a
          frame around the page. The per-ROW borders inside Donations stay — those
          separate list items from each other, which is a different job. */}
      {pane === 'dues' && (
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
                required row, and folding it was never going to help: at ~170px it was
                the widest thing on a 390px screen and it did nothing when tapped. A
                promise about a feature is a property of the PANE, not of each schedule.
                What is left in the Action column is the one real action — opting out of
                an optional due, and back in — which most rows do not have either, so the
                column heading is now `sr-only` like every other action column here. */
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
      )}

      {/* Passed in as a slot because DonationsSection is a server component and this
          file is a client one — the page renders it and hands the result down. */}
      {pane === 'donations' && donationsSlot}

      {/* ── Payment History ──
          The count and the filter stay: they are not the pane's name repeated, they are
          chrome the pane needs. Only the card box and the title line are gone. */}
      {pane === 'history' && (
        <div>
          <div className="mb-3 flex flex-col justify-between gap-2 sm:flex-row sm:items-center">
            <p className="text-xs text-muted-foreground">
              {history.length === 0 ? 'No payments on record' : `${history.length} transaction${history.length !== 1 ? 's' : ''}`}
            </p>
            {history.length > 0 && (
              <div className="relative w-full sm:w-44">
                <Search className="absolute left-2.5 top-1.5 h-3.5 w-3.5 text-muted-foreground" />
                <Input aria-label="Filter payment history" placeholder="Filter..." value={histSearch} onChange={e => setHistSearch(e.target.value)} className="pl-7 h-8 text-xs" />
              </div>
            )}
          </div>
          {history.length === 0 ? (
            <div className="flex flex-col items-center py-10 gap-2">
              <DollarSign className="h-10 w-10 text-muted-foreground/20" />
              <p className="text-sm text-muted-foreground">No payment history available yet.</p>
            </div>
          ) : (
            /* Method and Status already folded here before the pattern had a name —
                but nothing restated them, so a phone simply lost the fact that a
                payment was waived, and the `min-w-[420px]` floor kept the scroll
                anyway. Both are on the meta line now and the floor is gone. */
            <div>
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b">
                    <SortTh label="Schedule" active={histSort.col === 'schedule'} dir={histSort.dir} onClick={() => sortHist('schedule')} />
                    <SortTh label="Date" active={histSort.col === 'date'} dir={histSort.dir} onClick={() => sortHist('date')} className={COLLAPSING_CELL} />
                    <SortTh label="Amount" active={histSort.col === 'amount'} dir={histSort.dir} onClick={() => sortHist('amount')} align="right" />
                    <th className={cn('py-2 pr-3 text-xs font-medium text-muted-foreground text-left', COLLAPSING_CELL)}>Method</th>
                    <th className={cn('py-2 text-xs font-medium text-muted-foreground text-left', COLLAPSING_CELL)}>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredHistory.length === 0 ? (
                    <tr><td colSpan={5} className="text-center text-xs text-muted-foreground py-6">No matching payments.</td></tr>
                  ) : filteredHistory.map(p => {
                    const statusPill = (
                      <span className={`inline-flex items-center px-1.5 py-0.5 rounded-full text-xs font-medium ${
                        p.status === 'paid' ? 'bg-brand-affirm text-brand-on-affirm' : p.status === 'waived' ? 'bg-muted text-muted-foreground' : 'bg-brand-legacy text-brand-on-legacy'
                      }`}>{p.status}</span>
                    )
                    return (
                    /* TWO WAYS INTO THE DETAIL DIALOG, and both are deliberate — the
                       same split TransactionsClient's LedgerRow makes. The <tr> carries
                       the click, because a whole row is the target people aim at; the
                       schedule name in the first cell is a real <button>, because that
                       is the only part of this a keyboard reaches and a screen reader
                       announces. A <tr> cannot take the click alone: it is not focusable,
                       and role="button" on it would promise Enter and Space handling that
                       nothing here implements. */
                    <tr
                      key={p.id}
                      onClick={() => setViewingId(p.id)}
                      className="cursor-pointer border-b align-top transition-colors last:border-0 hover:bg-muted/30 sm:align-middle"
                    >
                      <td className="py-2.5 pr-3">
                        <p className="flex flex-wrap items-center gap-2 font-medium">
                          {/* stopPropagation, or this click opens the dialog twice on its
                              way up through the row. */}
                          <button
                            type="button"
                            onClick={e => { e.stopPropagation(); setViewingId(p.id) }}
                            className="text-left font-medium hover:underline focus-visible:underline focus-visible:outline-none"
                          >
                            {p.schedule_label ?? 'General Payment'}
                          </button>
                          {/* Dues and donations land in the same ledger, so each row
                              says which it was. Both are tagged, not just donations:
                              identifying dues by the ABSENCE of a tag only works if
                              you already know the rule. Muted on purpose — the
                              coloured pill in this row is the payment's status. */}
                          {p.schedule_kind && (
                            <span className="shrink-0 rounded-full bg-muted px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                              {p.schedule_kind === 'donation' ? 'Donation' : 'Dues'}
                            </span>
                          )}
                        </p>
                        {p.notes && <p className="text-xs text-muted-foreground italic">{p.notes}</p>}
                        {/* Date · method, then the pill. The pill is last and carries
                            its own colour, so it needs no separator in front of it —
                            a dot before a coloured chip reads as a bullet. */}
                        <RowMeta className="gap-x-2">
                          <span>{fmtDate(p.payment_date)}</span>
                          {p.payment_method && <MetaDot />}
                          <MetaIf value={p.payment_method} />
                          {statusPill}
                        </RowMeta>
                      </td>
                      <td className={cn('py-2.5 pr-3 whitespace-nowrap text-muted-foreground text-xs', COLLAPSING_CELL)}>{fmtDate(p.payment_date)}</td>
                      {/* TWO ARMS, NOT THREE. Waived used to be blue here and pending
                          muted; both are now muted, because neither is money that moved
                          and the figure's colour should say only that. The third arm
                          survived the sweep with both branches identical, which is a
                          thing a reader has to stop and diff — so it is gone, and what it
                          was trying to preserve is written down instead: waived and
                          pending are DIFFERENT statuses that deliberately share a colour,
                          and the pill beside the figure is what separates them (muted
                          there too, matching TransactionsClient). */}
                      <td className={`py-2.5 pr-3 text-right font-semibold whitespace-nowrap ${
                        p.status === 'paid' ? 'text-brand-affirm' : 'text-muted-foreground'
                      }`}>
                        {/* The figure, on a waived row too. It used to read "Waived"
                            here, which was honest while waiving changed nothing —
                            but it now comes off the remaining balance, and a balance
                            that drops by $50 with no $50 anywhere on the page is a
                            number the member cannot check. The status is not lost:
                            the pill says it, in this row's own Status column and on
                            the meta line below `sm`. */}
                        {formatCurrency(p.amount_cents)}
                      </td>
                      <td className={cn('py-2.5 pr-3 text-muted-foreground text-xs', COLLAPSING_CELL)}>{p.payment_method ?? '—'}</td>
                      <td className={cn('py-2.5', COLLAPSING_CELL)}>
                        {statusPill}
                      </td>
                    </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ── One payment, in full ──
          Rendered outside the pane condition on purpose. `Dialog` returns null when
          closed, and keeping it here means the panel is not unmounted mid-close by a
          pane switch happening behind it. The same shape and the same `<dl>` the
          Transactions ledgers use, so one transaction reads the same way whichever
          screen it was opened from. */}
      <Dialog
        open={viewed !== null}
        onClose={() => setViewingId(null)}
        title={viewed?.title ?? ''}
        description={viewed?.subtitle}
        className="max-w-lg"
      >
        {viewed && (
          <div className="mt-2">
            <dl className="divide-y text-sm">
              {viewed.fields.map(f => (
                <div key={f.label} className="flex gap-4 py-2">
                  <dt className="w-40 shrink-0 text-muted-foreground">{f.label}</dt>
                  <dd className="min-w-0 flex-1 break-words">{f.value ?? '—'}</dd>
                </div>
              ))}
            </dl>
            <div className="pt-4">
              <Button variant="outline" className="w-full" onClick={() => setViewingId(null)}>Close</Button>
            </div>
          </div>
        )}
      </Dialog>
    </div>
  )
}

/**
 * The rail's items. Built once at module scope rather than per render: the icons are the
 * same three the pane headings used to carry, which is what keeps the rail recognisable
 * as the thing that replaced them.
 *
 * No `href`. These panes have no server-rendered address of their own — `?pane=` is
 * written by replaceState and read on the next full load — so a real link would promise
 * a round trip that discards the sort and filter state the panes hold.
 */
const RAIL_ITEMS: MainRailItem<SummaryPane>[] = [
  { id: 'dues', label: SUMMARY_PANE_LABELS.dues, icon: CalendarClock },
  { id: 'donations', label: SUMMARY_PANE_LABELS.donations, icon: HeartHandshake },
  { id: 'history', label: SUMMARY_PANE_LABELS.history, icon: History },
]

// ── A single outstanding-dues row, with cadence picker ──

function DuesRow({ row, isPending, onCadence, onOptOut }: {
  row: DuesSummary
  isPending: boolean
  onCadence: (cadence: PayCadence) => void
  onOptOut: (optOut: boolean) => void
}) {
  const declined = row.optedOut

  /**
   * "Catching up", when the calendar has asked for installments the money never covered.
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
      declined ? 'bg-muted text-muted-foreground'
        : row.required ? 'bg-brand-soft text-brand-on-soft'
          // Warm, not the gold the status pills use: Optional is a CATEGORY of due, not
          // a state needing attention. Gold here would flag a row nobody is chasing.
          : 'bg-brand-warm text-brand-on-warm',
    )}>
      {declined ? 'Declined' : row.required ? 'Required' : 'Optional'}
    </span>
  )

  // No cadence to choose on a declined due — there is no installment to spread.
  //
  // `w-full sm:w-32`, because this element is rendered in two places: its own column at
  // `sm` and up, where 32 is right beside its neighbours, and the plan block below that,
  // where the cell is the width of the screen and a 128px control floating in it reads
  // as unfinished. The aria-label names the schedule as well as the field, which the
  // column heading alone never did — "Pay cadence" over five identical selects tells a
  // screen-reader user nothing about which schedule they are changing.
  const cadenceControl = declined ? null : (
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
    <tr className={cn('border-b align-top last:border-0 hover:bg-muted/30 sm:align-middle', declined && 'bg-muted/30')}>
      <td className="py-3 pr-3 sm:py-2.5">
        {/* The description is a tooltip on the title rather than its own line: it is
            reference text, and a paragraph of it under every row pushed the amounts
            apart. The dotted underline is the only hint that there is more to read,
            so it appears exactly when there is. */}
        <p
          className={cn('font-medium', declined && 'text-muted-foreground',
            row.schedule.description && 'w-fit cursor-help underline decoration-dotted decoration-muted-foreground/50 underline-offset-2')}
          title={row.schedule.description ?? undefined}
        >
          {row.schedule.label}
        </p>
        <p className="text-xs text-muted-foreground">{formatCurrency(row.annualTotalCents)}/yr · {row.schedule.frequency}</p>

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
            {!declined && (
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
        <span className={cn(declined && 'text-muted-foreground line-through')}>
          {formatCurrency(declined ? row.installmentCents : row.nextInstallmentCents)}
        </span>
        {!declined && !row.onSchedule && row.followingInstallmentDate && (
          <span className="block text-[11px] font-normal text-muted-foreground">
            then {formatCurrency(row.followingInstallmentCents)}
          </span>
        )}
        {!declined && (
          <span className="block text-[11px] font-normal capitalize text-muted-foreground sm:hidden">
            {row.cadence}
          </span>
        )}
        {optOutControl && <span className="mt-1.5 block sm:hidden">{optOutControl}</span>}
      </td>
      <td className={cn('py-2.5 pr-3 text-xs text-muted-foreground whitespace-nowrap', COLLAPSING_CELL)}>
        {row.nextInstallmentDate ? fmtDate(row.nextInstallmentDate) : '—'}
      </td>
      <td className={cn('py-2.5 pr-3 text-right font-semibold whitespace-nowrap',
        declined ? 'text-muted-foreground' : 'text-brand-accent', COLLAPSING_CELL)}>
        {declined ? '—' : formatCurrency(row.remainingBalanceCents)}
      </td>
      <td className={cn('py-2.5 text-right', COLLAPSING_CELL)}>
        {optOutControl}
      </td>
    </tr>
  )
}
