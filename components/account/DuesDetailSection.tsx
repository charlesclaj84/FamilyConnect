'use client'

import { useState, useMemo } from 'react'
import { CheckCircle2, Clock, DollarSign, AlertCircle, History, Search, ArrowUpDown, ChevronUp, ChevronDown } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import type { DuesSummary, DuesPayment, DuesSchedule } from '@/app/actions/dues'

type SortDir = 'asc' | 'desc'
type HistCol = 'schedule' | 'date' | 'amount'
type DuesCol = 'schedule' | 'amount' | 'due_date'

function fmt(cents: number) { return `$${(cents / 100).toFixed(2)}` }

function fmtDate(s: string) {
  return new Date(s).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' })
}

function scheduleNextDate(s: DuesSchedule): string | null {
  if (s.end_date) return s.end_date
  if (s.due_month != null && s.due_day != null) {
    const today = new Date()
    const y = today.getFullYear()
    const m = today.getMonth() + 1
    const d = today.getDate()
    let year = y
    if (s.due_month < m || (s.due_month === m && s.due_day < d)) year = y + 1
    return `${year}-${String(s.due_month).padStart(2, '0')}-${String(s.due_day).padStart(2, '0')}`
  }
  return s.start_date ?? null
}

function computeNextDue(unpaid: DuesSummary[]): { dateStr: string; label: string } | null {
  const candidates = unpaid
    .map(s => { const d = scheduleNextDate(s.schedule); return d ? { dateStr: d, label: s.schedule.label } : null })
    .filter((x): x is { dateStr: string; label: string } => x !== null)
    .sort((a, b) => a.dateStr.localeCompare(b.dateStr))
  return candidates[0] ?? null
}

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
}

export function DuesDetailSection({ summary, history }: Props) {
  const unpaid = summary.filter(s => !s.paid)
  const paidPayments = history.filter(p => p.status === 'paid')
  const totalPaidCents = paidPayments.reduce((sum, p) => sum + p.amount_cents, 0)
  const totalDueCents = unpaid.reduce((sum, s) => sum + s.schedule.amount_cents, 0)
  const nextDue = computeNextDue(unpaid)

  const [histSearch, setHistSearch] = useState('')
  const [histSort, setHistSort] = useState<{ col: HistCol; dir: SortDir }>({ col: 'date', dir: 'desc' })
  function sortHist(col: HistCol) {
    setHistSort(s => s.col === col ? { col, dir: s.dir === 'asc' ? 'desc' : 'asc' } : { col, dir: 'asc' })
  }

  const [duesSearch, setDuesSearch] = useState('')
  const [duesSort, setDuesSort] = useState<{ col: DuesCol; dir: SortDir }>({ col: 'due_date', dir: 'asc' })
  function sortDues(col: DuesCol) {
    setDuesSort(s => s.col === col ? { col, dir: s.dir === 'asc' ? 'desc' : 'asc' } : { col, dir: 'asc' })
  }

  const filteredHistory = useMemo(() => {
    const q = histSearch.toLowerCase()
    const rows = q
      ? history.filter(p =>
          (p.schedule_label ?? '').toLowerCase().includes(q) ||
          (p.payment_method ?? '').toLowerCase().includes(q) ||
          p.status.toLowerCase().includes(q)
        )
      : [...history]
    return rows.sort((a, b) => {
      let cmp = 0
      if (histSort.col === 'date') cmp = a.payment_date.localeCompare(b.payment_date)
      else if (histSort.col === 'amount') cmp = a.amount_cents - b.amount_cents
      else cmp = (a.schedule_label ?? '').localeCompare(b.schedule_label ?? '')
      return histSort.dir === 'asc' ? cmp : -cmp
    })
  }, [history, histSearch, histSort])

  const filteredDues = useMemo(() => {
    const q = duesSearch.toLowerCase()
    const rows = q
      ? unpaid.filter(s =>
          s.schedule.label.toLowerCase().includes(q) ||
          s.schedule.frequency.toLowerCase().includes(q)
        )
      : [...unpaid]
    return rows.sort((a, b) => {
      let cmp = 0
      if (duesSort.col === 'amount') cmp = a.schedule.amount_cents - b.schedule.amount_cents
      else if (duesSort.col === 'due_date') {
        const da = scheduleNextDate(a.schedule) ?? ''
        const db = scheduleNextDate(b.schedule) ?? ''
        cmp = da.localeCompare(db)
      } else cmp = a.schedule.label.localeCompare(b.schedule.label)
      return duesSort.dir === 'asc' ? cmp : -cmp
    })
  }, [unpaid, duesSearch, duesSort])

  return (
    <div className="space-y-5">
      {/* ── Stat cards ── */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="rounded-2xl border bg-card p-5 space-y-2">
          <div className="flex items-center gap-2.5">
            <div className="p-1.5 rounded-full bg-green-100">
              <CheckCircle2 className="h-4 w-4 text-green-600" />
            </div>
            <span className="text-sm text-muted-foreground font-medium">Total Paid</span>
          </div>
          <p className="text-3xl font-bold">{fmt(totalPaidCents)}</p>
          <p className="text-xs text-muted-foreground">
            {paidPayments.length === 0
              ? 'No payments on record'
              : `${paidPayments.length} payment${paidPayments.length !== 1 ? 's' : ''} recorded`}
          </p>
        </div>

        <div className="rounded-2xl border bg-card p-5 space-y-2">
          <div className="flex items-center gap-2.5">
            <div className={`p-1.5 rounded-full ${totalDueCents > 0 ? 'bg-amber-100' : 'bg-green-100'}`}>
              <Clock className={`h-4 w-4 ${totalDueCents > 0 ? 'text-amber-600' : 'text-green-600'}`} />
            </div>
            <span className="text-sm text-muted-foreground font-medium">Amount Due</span>
          </div>
          <p className="text-3xl font-bold">{fmt(totalDueCents)}</p>
          <p className="text-xs text-muted-foreground">
            {totalDueCents === 0
              ? 'No outstanding balance'
              : `${unpaid.length} schedule${unpaid.length !== 1 ? 's' : ''} outstanding`}
          </p>
        </div>

        <div className="rounded-2xl border bg-card p-5 space-y-2">
          <div className="flex items-center gap-2.5">
            <div className="p-1.5 rounded-full bg-green-100">
              <DollarSign className="h-4 w-4 text-green-600" />
            </div>
            <span className="text-sm text-muted-foreground font-medium">Next Due Date</span>
          </div>
          <p className="text-2xl font-bold leading-tight">{nextDue ? fmtDate(nextDue.dateStr) : '—'}</p>
          <p className="text-xs text-muted-foreground">{nextDue ? nextDue.label : 'No upcoming dues'}</p>
        </div>
      </div>

      {/* ── Payment History ── */}
      <Card>
        <CardHeader className="pb-2">
          <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-2">
            <div>
              <CardTitle className="flex items-center gap-2 text-base">
                <History className="h-4 w-4 text-primary" /> Payment History
              </CardTitle>
              <p className="text-xs text-muted-foreground mt-0.5">
                {history.length === 0
                  ? 'No payments on record'
                  : `${history.length} transaction${history.length !== 1 ? 's' : ''}`}
              </p>
            </div>
            {history.length > 0 && (
              <div className="relative w-full sm:w-44">
                <Search className="absolute left-2.5 top-1.5 h-3.5 w-3.5 text-muted-foreground" />
                <Input
                  placeholder="Filter..."
                  value={histSearch}
                  onChange={e => setHistSearch(e.target.value)}
                  className="pl-7 h-8 text-xs"
                />
              </div>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {history.length === 0 ? (
            <div className="flex flex-col items-center py-10 gap-2">
              <DollarSign className="h-10 w-10 text-muted-foreground/20" />
              <p className="text-sm text-muted-foreground">No payment history available yet.</p>
              <p className="text-xs text-muted-foreground text-center max-w-xs">
                Dues tracking will be enabled when your family administrator sets up dues.
              </p>
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
                    <tr>
                      <td colSpan={5} className="text-center text-xs text-muted-foreground py-6">No matching payments.</td>
                    </tr>
                  ) : filteredHistory.map(p => (
                    <tr key={p.id} className="border-b last:border-0 hover:bg-muted/30">
                      <td className="py-2.5 pr-3">
                        <p className="font-medium">{p.schedule_label ?? 'General Payment'}</p>
                        {p.notes && <p className="text-xs text-muted-foreground italic">{p.notes}</p>}
                      </td>
                      <td className="py-2.5 pr-3 whitespace-nowrap text-muted-foreground text-xs">{fmtDate(p.payment_date)}</td>
                      <td className={`py-2.5 pr-3 text-right font-semibold whitespace-nowrap ${
                        p.status === 'paid' ? 'text-green-600'
                        : p.status === 'waived' ? 'text-blue-600'
                        : 'text-muted-foreground'
                      }`}>
                        {p.status === 'waived' ? 'Waived' : fmt(p.amount_cents)}
                      </td>
                      <td className="py-2.5 pr-3 text-muted-foreground text-xs hidden sm:table-cell">
                        {p.payment_method ?? '—'}
                      </td>
                      <td className="py-2.5 hidden sm:table-cell">
                        <span className={`inline-flex items-center px-1.5 py-0.5 rounded-full text-xs font-medium ${
                          p.status === 'paid' ? 'bg-green-100 text-green-700'
                          : p.status === 'waived' ? 'bg-blue-100 text-blue-700'
                          : 'bg-amber-100 text-amber-700'
                        }`}>
                          {p.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* ── Outstanding Dues ── */}
      <Card>
        <CardHeader className="pb-2">
          <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-2">
            <div>
              <CardTitle className="flex items-center gap-2 text-base">
                <AlertCircle className="h-4 w-4 text-primary" /> Outstanding Dues
              </CardTitle>
              <p className="text-xs text-muted-foreground mt-0.5">Upcoming and overdue amounts</p>
            </div>
            {unpaid.length > 0 && (
              <div className="relative w-full sm:w-44">
                <Search className="absolute left-2.5 top-1.5 h-3.5 w-3.5 text-muted-foreground" />
                <Input
                  placeholder="Filter..."
                  value={duesSearch}
                  onChange={e => setDuesSearch(e.target.value)}
                  className="pl-7 h-8 text-xs"
                />
              </div>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {unpaid.length === 0 ? (
            <div className="flex flex-col items-center py-10 gap-2">
              <Clock className="h-10 w-10 text-muted-foreground/20" />
              <p className="text-sm text-muted-foreground">No outstanding dues.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm min-w-[360px]">
                <thead>
                  <tr className="border-b">
                    <SortTh label="Schedule" active={duesSort.col === 'schedule'} dir={duesSort.dir} onClick={() => sortDues('schedule')} />
                    <th className="py-2 pr-3 text-xs font-medium text-muted-foreground text-left hidden sm:table-cell">Frequency</th>
                    <SortTh label="Due Date" active={duesSort.col === 'due_date'} dir={duesSort.dir} onClick={() => sortDues('due_date')} />
                    <SortTh label="Amount" active={duesSort.col === 'amount'} dir={duesSort.dir} onClick={() => sortDues('amount')} align="right" />
                  </tr>
                </thead>
                <tbody>
                  {filteredDues.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="text-center text-xs text-muted-foreground py-6">No matching dues.</td>
                    </tr>
                  ) : filteredDues.map(s => {
                    const dDate = scheduleNextDate(s.schedule)
                    return (
                      <tr key={s.schedule.id} className="border-b last:border-0 hover:bg-muted/30">
                        <td className="py-2.5 pr-3">
                          <p className="font-medium">{s.schedule.label}</p>
                          {s.schedule.description && <p className="text-xs text-muted-foreground">{s.schedule.description}</p>}
                        </td>
                        <td className="py-2.5 pr-3 text-xs text-muted-foreground hidden sm:table-cell capitalize">
                          {s.schedule.frequency}
                        </td>
                        <td className="py-2.5 pr-3 text-xs text-muted-foreground whitespace-nowrap">
                          {dDate ? fmtDate(dDate) : '—'}
                        </td>
                        <td className="py-2.5 text-right font-semibold text-amber-600 whitespace-nowrap">
                          {fmt(s.schedule.amount_cents)}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
