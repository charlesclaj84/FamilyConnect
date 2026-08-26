'use client'

import { useState, useMemo } from 'react'
import { DollarSign, Search } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Dialog } from '@/components/ui/dialog'
import { cn } from '@/lib/utils'
import { formatCurrency } from '@/lib/currency-utils'
import { formatDate } from '@/lib/date-utils'
import { formatInstantDate } from '@/lib/tz'
import { PAYMENT_STATUS_LABELS } from '@/lib/dues-utils'
import { COLLAPSING_CELL, RowMeta, MetaDot, MetaIf } from '@/components/ui/table-collapse'
import type { DuesPayment } from '@/app/actions/dues'
import { PaidThisYearCard } from '@/components/account/PaidThisYearCard'
import { SortTh, type SortDir } from '@/components/ui/sortable-header'

type HistCol = 'schedule' | 'date' | 'amount'

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
function viewOfMyPayment(p: DuesPayment, zone: string): {
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
      // `created_at` is an INSTANT, so it has no calendar date of its own — see lib/tz.ts.
      // `payment_date` above is a DATE column and stays on `formatDate`.
      { label: 'Recorded', value: formatInstantDate(p.created_at, zone) },
      ...(p.reversed_by_id
        ? [{ label: 'Reversed', value: 'Yes — a correcting entry cancels this payment' }]
        : []),
      ...(isReversal
        ? [{ label: 'Corrects', value: 'An earlier payment in this history' }]
        : []),
    ],
  }
}

/**
 * Everything the family has recorded against this member.
 *
 * THE OTHER HALF OF THE OLD `DuesDetailSection` — see `DuesPlanSection` for the split.
 * Its headline card is `PaidThisYearCard`, which [Summary](/account-summary) renders
 * too; unlike the dues cards there is no optimistic state to feed it, because nothing
 * on this screen writes.
 */
export function PaymentHistorySection({ history, zone }: { history: DuesPayment[]; zone: string }) {
  // Which payment's detail dialog is open. Held as an ID rather than as the row itself,
  // for the reason TransactionsClient holds one: the dialog then re-derives from live
  // props, so a reversal posted while it is open updates the entry being read instead of
  // showing a stale snapshot of it.
  const [viewingId, setViewingId] = useState<string | null>(null)
  const viewedPayment = viewingId ? history.find(p => p.id === viewingId) ?? null : null
  const viewed = viewedPayment ? viewOfMyPayment(viewedPayment, zone) : null

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

  return (
    <div className="space-y-5">
      {/* `sm:max-w-sm` rather than a half-width grid cell: it is the only card on this
          screen, and a single stat card stretched across a 6xl measure reads as a banner
          rather than as a figure. */}
      <PaidThisYearCard history={history} className="sm:max-w-sm" />

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

      {/* ── One payment, in full ──
          The same shape and the same `<dl>` the Transactions ledgers use, so one
          transaction reads the same way whichever screen it was opened from. */}
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
