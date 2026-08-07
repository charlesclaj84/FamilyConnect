'use client'

import { useState, useMemo, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import {
  CheckCircle2, Clock, DollarSign, CalendarClock, HeartHandshake, History,
  Search, ArrowUpDown, ChevronUp, ChevronDown,
} from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Select } from '@/components/ui/select'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { formatCurrency } from '@/lib/currency-utils'
import { formatDate } from '@/lib/date-utils'
import { installmentCents, isOutstanding, PAY_CADENCES, type PayCadence } from '@/lib/dues-utils'
import { useConfirm } from '@/components/ui/confirm'
import { useServerState } from '@/lib/use-server-state'
import {
  setMyDuesPlan, setMyDuesOptOut,
  type DuesSummary, type DuesPayment,
} from '@/app/actions/dues'
import { MainRail, type MainRailItem } from '@/components/layout/MainRail'
import {
  SUMMARY_PANE_LABELS, type SummaryPane,
} from '@/components/account/summary-panes'

type SortDir = 'asc' | 'desc'
type HistCol = 'schedule' | 'date' | 'amount'
type DuesCol = 'schedule' | 'amount' | 'due_date'

const fmtDate = (s: string) => formatDate(s) ?? ''

function SortTh({
  label, active, dir, onClick, align = 'left',
}: { label: string; active: boolean; dir: SortDir; onClick: () => void; align?: 'left' | 'right' }) {
  const Icon = active ? (dir === 'asc' ? ChevronUp : ChevronDown) : ArrowUpDown
  return (
    <th className={`py-2 pr-3 text-xs font-medium text-muted-foreground ${align === 'right' ? 'text-right' : 'text-left'}`}>
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
  /** Pane resolved from `?pane=` on the server, so the first paint is already right. */
  initialPane: SummaryPane
}

export function DuesDetailSection({
  summary, history, donationsSlot, hasDonations, initialPane,
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
  const [pane, setPane] = useState<SummaryPane>(
    initialPane === 'donations' && !hasDonations ? 'dues' : initialPane,
  )

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
  // Split out rather than summed inline, because the Remaining Balance card needs the
  // COUNT of required schedules as well as their total — see the comment there for why
  // it counts only the required ones.
  const requiredUnpaid = unpaid.filter(s => s.required)
  const optionalUnpaid = unpaid.filter(s => !s.required)
  const totalRequiredCents = requiredUnpaid.reduce((sum, s) => sum + s.remainingBalanceCents, 0)
  const totalOptionalCents = optionalUnpaid.reduce((sum, s) => sum + s.remainingBalanceCents, 0)
  const totalRemainingCents = totalRequiredCents + totalOptionalCents
  const nextDue = unpaid
    .filter(s => s.nextInstallmentDate)
    .sort((a, b) => (a.nextInstallmentDate ?? '').localeCompare(b.nextInstallmentDate ?? ''))[0] ?? null

  async function changeCadence(scheduleId: string, cadence: PayCadence) {
    const row = rows.find(r => r.schedule.id === scheduleId)
    const ok = await confirm({
      title: 'Change payment plan',
      description: row
        // "installment", not "instalment". The single-l spelling is British and the rest
        // of this app is American — every other label says Installment, and the field it
        // describes is installmentCents.
        ? `Pay "${row.schedule.label}" ${cadence} — ${formatCurrency(installmentCents(row.annualTotalCents, cadence))} per installment?`
        : `Change this payment plan to ${cadence}?`,
      confirmLabel: 'Change plan',
    })
    if (!ok) return
    setRows(prev => prev.map(r =>
      r.schedule.id === scheduleId
        ? { ...r, cadence, hasExplicitPlan: true, installmentCents: installmentCents(r.annualTotalCents, cadence) }
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
  const sortedDues = useMemo(() => {
    return [...unpaid, ...declined].sort((a, b) => {
      if (a.optedOut !== b.optedOut) return a.optedOut ? 1 : -1
      let cmp = 0
      if (duesSort.col === 'amount') cmp = a.installmentCents - b.installmentCents
      else if (duesSort.col === 'due_date') cmp = (a.nextInstallmentDate ?? '').localeCompare(b.nextInstallmentDate ?? '')
      else cmp = a.schedule.label.localeCompare(b.schedule.label)
      return duesSort.dir === 'asc' ? cmp : -cmp
    })
  }, [unpaid, declined, duesSort])

  return (
    <div className="space-y-5">
      {/* ── Stat cards ── */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="rounded-2xl border bg-card p-5 space-y-2">
          <div className="flex items-center gap-2.5">
            <div className="p-1.5 rounded-full bg-green-100"><CheckCircle2 className="h-4 w-4 text-green-600" /></div>
            <span className="text-sm text-muted-foreground font-medium">Paid This Year</span>
          </div>
          <p className="text-3xl font-bold">{formatCurrency(totalPaidCents)}</p>
          <p className="text-xs text-muted-foreground">
            {paidPayments.length === 0 ? 'No payments on record' : `${paidPayments.length} payment${paidPayments.length !== 1 ? 's' : ''} recorded`}
          </p>
        </div>

        <div className="rounded-2xl border bg-card p-5 space-y-2">
          <div className="flex items-center gap-2.5">
            {/* Amber for REQUIRED money only — an optional due left unpaid is not a
                problem to flag. */}
            <div className={`p-1.5 rounded-full ${totalRequiredCents > 0 ? 'bg-amber-100' : 'bg-green-100'}`}>
              <Clock className={`h-4 w-4 ${totalRequiredCents > 0 ? 'text-amber-600' : 'text-green-600'}`} />
            </div>
            <span className="text-sm text-muted-foreground font-medium">Remaining Balance</span>
          </div>
          {/* THE SAME KPI AS THE DASHBOARD'S, said the same way — same headline, same
              qualifier, same optional line, same icon, same words. It used to differ in
              the one place that mattered: the figure was bare and "required" appeared
              only as the first word of the line beneath it, so with an optional due
              present the card read "$50.00 / required · $200.00 optional" — one sentence
              spanning two elements, in which the $50 and the $200 looked like the same
              kind of number and the qualifier could be read as belonging to either.
              `required` now sits ON the headline, and optional is its own line below. */}
          <div className="flex items-end gap-2">
            <p className="text-3xl font-bold">{formatCurrency(totalRequiredCents)}</p>
            <span className="mb-1 text-sm text-muted-foreground">required</span>
          </div>
          <p className="text-xs text-muted-foreground">
            {/* Counts REQUIRED schedules only, because that is what the figure above is.
                Counting all of them would have said "1 schedule outstanding" under a
                headline of $0.00 whenever the only thing left was optional. */}
            {totalRemainingCents === 0
              ? 'All dues settled'
              : totalRequiredCents === 0
                ? 'Required dues all paid'
                : `${requiredUnpaid.length} schedule${requiredUnpaid.length !== 1 ? 's' : ''} outstanding`}
          </p>
          {totalOptionalCents > 0 && (
            <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <HeartHandshake className="h-3 w-3 shrink-0" />
              <span><span className="font-medium text-foreground">{formatCurrency(totalOptionalCents)}</span> optional</span>
            </p>
          )}
        </div>

        <div className="rounded-2xl border bg-card p-5 space-y-2">
          <div className="flex items-center gap-2.5">
            <div className="p-1.5 rounded-full bg-green-100"><DollarSign className="h-4 w-4 text-green-600" /></div>
            <span className="text-sm text-muted-foreground font-medium">Next Installment</span>
          </div>
          <p className="text-2xl font-bold leading-tight">
            {nextDue ? formatCurrency(Math.min(nextDue.installmentCents, nextDue.remainingBalanceCents)) : '—'}
          </p>
          <p className="text-xs text-muted-foreground">
            {nextDue ? `${nextDue.schedule.label} · due ${fmtDate(nextDue.nextInstallmentDate!)}` : 'No upcoming dues'}
          </p>
        </div>
      </div>

      {/* ── The rail, under the stat cards ──
          The cards are a summary of ALL THREE panes at once — paid to date, what is
          left, what is next — so they belong above the rail rather than inside any one
          pane. Switching pane does not change them, which is the point. */}
      <MainRail
        label="My Summary sections"
        items={RAIL_ITEMS.filter(i => i.id !== 'donations' || hasDonations)}
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
          {error && <p className="mb-3 text-sm text-destructive">{error}</p>}
          {sortedDues.length === 0 ? (
            <div className="flex flex-col items-center py-10 gap-2">
              <CheckCircle2 className="h-10 w-10 text-muted-foreground/20" />
              <p className="text-sm text-muted-foreground">You&apos;re all caught up — nothing due right now.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm min-w-[760px]">
                <thead>
                  <tr className="border-b">
                    <SortTh label="Schedule" active={duesSort.col === 'schedule'} dir={duesSort.dir} onClick={() => sortDues('schedule')} />
                    <th className="py-2 pr-3 text-xs font-medium text-muted-foreground text-left">Payment</th>
                    <th className="py-2 pr-3 text-xs font-medium text-muted-foreground text-left">Pay&nbsp;cadence</th>
                    <SortTh label="Installment" active={duesSort.col === 'amount'} dir={duesSort.dir} onClick={() => sortDues('amount')} align="right" />
                    <SortTh label="Next Due" active={duesSort.col === 'due_date'} dir={duesSort.dir} onClick={() => sortDues('due_date')} />
                    <th className="py-2 pr-3 text-xs font-medium text-muted-foreground text-right">Remaining</th>
                    <th className="py-2 text-xs font-medium text-muted-foreground text-right">Action</th>
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
            <div className="overflow-x-auto">
              <table className="w-full text-sm min-w-[420px]">
                <thead>
                  <tr className="border-b">
                    <SortTh label="Schedule" active={histSort.col === 'schedule'} dir={histSort.dir} onClick={() => sortHist('schedule')} />
                    <SortTh label="Date" active={histSort.col === 'date'} dir={histSort.dir} onClick={() => sortHist('date')} />
                    <SortTh label="Amount" active={histSort.col === 'amount'} dir={histSort.dir} onClick={() => sortHist('amount')} align="right" />
                    <th className="py-2 pr-3 text-xs font-medium text-muted-foreground text-left hidden sm:table-cell">Method</th>
                    <th className="py-2 text-xs font-medium text-muted-foreground text-left hidden sm:table-cell">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredHistory.length === 0 ? (
                    <tr><td colSpan={5} className="text-center text-xs text-muted-foreground py-6">No matching payments.</td></tr>
                  ) : filteredHistory.map(p => (
                    <tr key={p.id} className="border-b last:border-0 hover:bg-muted/30">
                      <td className="py-2.5 pr-3">
                        <p className="flex flex-wrap items-center gap-2 font-medium">
                          {p.schedule_label ?? 'General Payment'}
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
                      </td>
                      <td className="py-2.5 pr-3 whitespace-nowrap text-muted-foreground text-xs">{fmtDate(p.payment_date)}</td>
                      <td className={`py-2.5 pr-3 text-right font-semibold whitespace-nowrap ${
                        p.status === 'paid' ? 'text-green-600' : p.status === 'waived' ? 'text-blue-600' : 'text-muted-foreground'
                      }`}>
                        {p.status === 'waived' ? 'Waived' : formatCurrency(p.amount_cents)}
                      </td>
                      <td className="py-2.5 pr-3 text-muted-foreground text-xs hidden sm:table-cell">{p.payment_method ?? '—'}</td>
                      <td className="py-2.5 hidden sm:table-cell">
                        <span className={`inline-flex items-center px-1.5 py-0.5 rounded-full text-xs font-medium ${
                          p.status === 'paid' ? 'bg-green-100 text-green-700' : p.status === 'waived' ? 'bg-blue-100 text-blue-700' : 'bg-amber-100 text-amber-700'
                        }`}>{p.status}</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
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
  return (
    <tr className={cn('border-b last:border-0 hover:bg-muted/30', declined && 'bg-muted/30')}>
      <td className="py-2.5 pr-3">
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
      </td>
      <td className="py-2.5 pr-3">
        {/* Required / Optional / Declined, in one column. Declined replaces Optional
            rather than sitting beside it: a row cannot be both, and showing both would
            leave the member reading two answers to one question. */}
        <span className={cn(
          'inline-block whitespace-nowrap rounded-full px-2 py-0.5 text-[11px] font-medium',
          declined ? 'bg-muted text-muted-foreground'
            : row.required ? 'bg-[#e6ecfa] text-[#0f2540]'
              : 'bg-amber-100 text-amber-800',
        )}>
          {declined ? 'Declined' : row.required ? 'Required' : 'Optional'}
        </span>
      </td>
      <td className="py-2.5 pr-3">
        {/* No cadence to choose on a declined due — there is no installment to spread. */}
        {declined ? (
          <span className="text-xs text-muted-foreground">—</span>
        ) : (
          <Select
            value={row.cadence}
            disabled={isPending}
            onChange={e => onCadence(e.target.value as PayCadence)}
            className="h-7 text-xs capitalize w-32"
            aria-label={`Payment cadence for ${row.schedule.label}`}
          >
            {PAY_CADENCES.map(c => <option key={c} value={c}>{c}</option>)}
          </Select>
        )}
      </td>
      <td className={cn('py-2.5 pr-3 text-right font-semibold whitespace-nowrap', declined && 'text-muted-foreground line-through')}>
        {formatCurrency(row.installmentCents)}
      </td>
      <td className="py-2.5 pr-3 text-xs text-muted-foreground whitespace-nowrap">
        {row.nextInstallmentDate ? fmtDate(row.nextInstallmentDate) : '—'}
      </td>
      <td className={cn('py-2.5 pr-3 text-right font-semibold whitespace-nowrap',
        declined ? 'text-muted-foreground' : 'text-amber-600')}>
        {declined ? '—' : formatCurrency(row.remainingBalanceCents)}
      </td>
      <td className="py-2.5 text-right">
        {/* A REQUIRED due offers nothing here but the (future) payment button. An optional
            one offers the choice, in both directions from the same cell — the way back has
            to be in the same place as the way out, or opting out looks permanent. */}
        {row.required ? (
          <Button size="sm" variant="outline" disabled title="Online payments are coming soon">
            Pay Online (coming soon)
          </Button>
        ) : (
          <Button
            size="sm"
            variant={declined ? 'outline' : 'ghost'}
            disabled={isPending}
            onClick={() => onOptOut(!declined)}
            className={cn(!declined && 'text-muted-foreground hover:text-foreground')}
          >
            {declined ? 'Opt back in' : 'Opt out'}
          </Button>
        )}
      </td>
    </tr>
  )
}
