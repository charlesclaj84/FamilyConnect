'use client'

import { useState, useMemo, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { CheckCircle2, Clock, DollarSign, CalendarClock, History, Search, ArrowUpDown, ChevronUp, ChevronDown } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Select } from '@/components/ui/select'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { formatCurrency } from '@/lib/currency-utils'
import { formatDate } from '@/lib/date-utils'
import { installmentCents, PAY_CADENCES, type PayCadence } from '@/lib/dues-utils'
import { useConfirm } from '@/components/ui/confirm'
import { useServerState } from '@/lib/use-server-state'
import { setMyDuesPlan, type DuesSummary, type DuesPayment } from '@/app/actions/dues'

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
  /** Rendered between Upcoming Dues and Payment History. See the call site. */
  donationsSlot?: React.ReactNode
}

export function DuesDetailSection({ summary, history, donationsSlot }: Props) {
  const router = useRouter()
  const confirm = useConfirm()
  const [isPending, startTransition] = useTransition()

  // Local mirror of summary so cadence changes recompute installments instantly.
  // `useServerState` re-syncs it whenever the server re-fetches — after recording a
  // payment, and after an admin adds a dues schedule, which revalidates this page.
  const [rows, setRows] = useServerState<DuesSummary[]>(summary)
  const [error, setError] = useState('')

  const unpaid = rows.filter(s => !s.paid)
  const paidPayments = history.filter(p => p.status === 'paid')
  const totalPaidCents = paidPayments.reduce((sum, p) => sum + p.amount_cents, 0)
  const totalRemainingCents = unpaid.reduce((sum, s) => sum + s.remainingBalanceCents, 0)
  const nextDue = unpaid
    .filter(s => s.nextInstallmentDate)
    .sort((a, b) => (a.nextInstallmentDate ?? '').localeCompare(b.nextInstallmentDate ?? ''))[0] ?? null

  async function changeCadence(scheduleId: string, cadence: PayCadence) {
    const row = rows.find(r => r.schedule.id === scheduleId)
    const ok = await confirm({
      title: 'Change payment plan',
      description: row
        ? `Pay "${row.schedule.label}" ${cadence} — ${formatCurrency(installmentCents(row.annualTotalCents, cadence))} per instalment?`
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
  const sortedDues = useMemo(() => {
    return [...unpaid].sort((a, b) => {
      let cmp = 0
      if (duesSort.col === 'amount') cmp = a.installmentCents - b.installmentCents
      else if (duesSort.col === 'due_date') cmp = (a.nextInstallmentDate ?? '').localeCompare(b.nextInstallmentDate ?? '')
      else cmp = a.schedule.label.localeCompare(b.schedule.label)
      return duesSort.dir === 'asc' ? cmp : -cmp
    })
  }, [unpaid, duesSort])

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
            <div className={`p-1.5 rounded-full ${totalRemainingCents > 0 ? 'bg-amber-100' : 'bg-green-100'}`}>
              <Clock className={`h-4 w-4 ${totalRemainingCents > 0 ? 'text-amber-600' : 'text-green-600'}`} />
            </div>
            <span className="text-sm text-muted-foreground font-medium">Remaining Balance</span>
          </div>
          <p className="text-3xl font-bold">{formatCurrency(totalRemainingCents)}</p>
          <p className="text-xs text-muted-foreground">
            {totalRemainingCents === 0 ? 'All dues settled' : `${unpaid.length} schedule${unpaid.length !== 1 ? 's' : ''} outstanding`}
          </p>
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

      {error && <p className="text-sm text-destructive">{error}</p>}

      {/* ── Upcoming Dues ──
          Titled for what is coming rather than what is owed: "Outstanding Dues"
          under a warning icon read as a debt notice, and this card is really the
          member's payment plan. */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-base">
            <CalendarClock className="h-4 w-4 text-primary" /> Upcoming Dues
          </CardTitle>
        </CardHeader>
        <CardContent>
          {unpaid.length === 0 ? (
            <div className="flex flex-col items-center py-10 gap-2">
              <CheckCircle2 className="h-10 w-10 text-muted-foreground/20" />
              <p className="text-sm text-muted-foreground">You&apos;re all caught up — nothing due right now.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm min-w-[640px]">
                <thead>
                  <tr className="border-b">
                    <SortTh label="Schedule" active={duesSort.col === 'schedule'} dir={duesSort.dir} onClick={() => sortDues('schedule')} />
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
                    />
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Donations sit between what you owe and what you have paid: closer to the
          dues they sit alongside than to the ledger. Passed in as a slot because
          DonationsSection is a server component and this file is a client one — the
          page renders it and hands the result down. */}
      {donationsSlot}

      {/* ── Payment History ── */}
      <Card>
        <CardHeader className="pb-2">
          <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-2">
            <div>
              <CardTitle className="flex items-center gap-2 text-base">
                <History className="h-4 w-4 text-primary" /> Payment History
              </CardTitle>
              <p className="text-xs text-muted-foreground mt-0.5">
                {history.length === 0 ? 'No payments on record' : `${history.length} transaction${history.length !== 1 ? 's' : ''}`}
              </p>
            </div>
            {history.length > 0 && (
              <div className="relative w-full sm:w-44">
                <Search className="absolute left-2.5 top-1.5 h-3.5 w-3.5 text-muted-foreground" />
                <Input placeholder="Filter..." value={histSearch} onChange={e => setHistSearch(e.target.value)} className="pl-7 h-8 text-xs" />
              </div>
            )}
          </div>
        </CardHeader>
        <CardContent>
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
        </CardContent>
      </Card>
    </div>
  )
}

// ── A single outstanding-dues row, with cadence picker ──

function DuesRow({ row, isPending, onCadence }: {
  row: DuesSummary
  isPending: boolean
  onCadence: (cadence: PayCadence) => void
}) {
  return (
    <tr className="border-b last:border-0 hover:bg-muted/30">
      <td className="py-2.5 pr-3">
        {/* The description is a tooltip on the title rather than its own line: it is
            reference text, and a paragraph of it under every row pushed the amounts
            apart. The dotted underline is the only hint that there is more to read,
            so it appears exactly when there is. */}
        <p
          className={cn('font-medium', row.schedule.description && 'w-fit cursor-help underline decoration-dotted decoration-muted-foreground/50 underline-offset-2')}
          title={row.schedule.description ?? undefined}
        >
          {row.schedule.label}
        </p>
        <p className="text-xs text-muted-foreground">{formatCurrency(row.annualTotalCents)}/yr · {row.schedule.frequency}</p>
      </td>
      <td className="py-2.5 pr-3">
        <Select
          value={row.cadence}
          disabled={isPending}
          onChange={e => onCadence(e.target.value as PayCadence)}
          className="h-7 text-xs capitalize w-32"
        >
          {PAY_CADENCES.map(c => <option key={c} value={c}>{c}</option>)}
        </Select>
      </td>
      <td className="py-2.5 pr-3 text-right font-semibold whitespace-nowrap">{formatCurrency(row.installmentCents)}</td>
      <td className="py-2.5 pr-3 text-xs text-muted-foreground whitespace-nowrap">
        {row.nextInstallmentDate ? fmtDate(row.nextInstallmentDate) : '—'}
      </td>
      <td className="py-2.5 pr-3 text-right font-semibold text-amber-600 whitespace-nowrap">{formatCurrency(row.remainingBalanceCents)}</td>
      <td className="py-2.5 text-right">
        <Button size="sm" variant="outline" disabled title="Online payments are coming soon">
          Pay Online (coming soon)
        </Button>
      </td>
    </tr>
  )
}
