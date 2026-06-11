'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Plus, Trash2, Pencil, X, DollarSign } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select } from '@/components/ui/select'
import { disambiguatedName } from '@/lib/name-utils'
import { formatCurrency as formatDollars } from '@/lib/currency-utils'
import { formatDate } from '@/lib/date-utils'
import {
  createDuesSchedule, updateDuesSchedule, recordPayment, deleteDuesSchedule,
  type DuesSchedule, type DuesPayment,
} from '@/app/actions/dues'

interface Person { id: string; first_name: string; last_name: string; nick_name?: string | null; date_of_birth?: string | null }

interface Props {
  initialSchedules: DuesSchedule[]
  initialPayments: DuesPayment[]
  members: Person[]
}

const FREQ_OPTIONS = ['annual', 'semi-annual', 'quarterly', 'monthly', 'one-time']

export function AdminDuesClient({ initialSchedules, initialPayments, members }: Props) {
  const router = useRouter()
  const [schedules, setSchedules] = useState(initialSchedules)
  const [payments, setPayments] = useState(initialPayments)
  const [tab, setTab] = useState<'schedules' | 'payments' | 'record'>('schedules')
  const [error, setError] = useState('')
  const [isPending, startTransition] = useTransition()

  // ── New schedule form ──
  const [nsLabel, setNsLabel] = useState('')
  const [nsAmount, setNsAmount] = useState('')
  const [nsFreq, setNsFreq] = useState('annual')
  const [nsStartDate, setNsStartDate] = useState('')
  const [nsEndDate, setNsEndDate] = useState('')
  const [nsDescription, setNsDescription] = useState('')

  // ── Edit schedule ──
  const [editId, setEditId] = useState<string | null>(null)
  const [editLabel, setEditLabel] = useState('')
  const [editAmount, setEditAmount] = useState('')
  const [editFreq, setEditFreq] = useState('annual')
  const [editStartDate, setEditStartDate] = useState('')
  const [editEndDate, setEditEndDate] = useState('')
  const [editDescription, setEditDescription] = useState('')

  // ── Record payment form ──
  const [rpPersonId, setRpPersonId] = useState('')
  const [rpScheduleId, setRpScheduleId] = useState('')
  const [rpAmount, setRpAmount] = useState('')
  const [rpDate, setRpDate] = useState(new Date().toISOString().split('T')[0])
  const [rpMethod, setRpMethod] = useState('')
  const [rpStatus, setRpStatus] = useState<'paid' | 'pending' | 'waived'>('paid')
  const [rpNotes, setRpNotes] = useState('')

  function startEdit(s: DuesSchedule) {
    setEditId(s.id)
    setEditLabel(s.label)
    setEditAmount((s.amount_cents / 100).toFixed(2))
    setEditFreq(s.frequency)
    setEditStartDate(s.start_date ?? '')
    setEditEndDate(s.end_date ?? '')
    setEditDescription(s.description ?? '')
    setError('')
  }

  function cancelEdit() { setEditId(null); setError('') }

  function handleSaveEdit() {
    if (!editId || !editLabel || !editAmount) { setError('Label and amount required'); return }
    setError('')
    startTransition(async () => {
      const result = await updateDuesSchedule(editId, {
        label: editLabel,
        amount_cents: Math.round(parseFloat(editAmount) * 100),
        frequency: editFreq,
        start_date: editStartDate || null,
        end_date: editEndDate || null,
        description: editDescription.trim() || null,
      })
      if (!result.success) { setError(result.message ?? 'Failed'); return }
      setSchedules(prev => prev.map(s => s.id === editId
        ? { ...s, label: editLabel, amount_cents: Math.round(parseFloat(editAmount) * 100), frequency: editFreq, start_date: editStartDate || null, end_date: editEndDate || null, description: editDescription || null }
        : s
      ))
      setEditId(null)
    })
  }

  function handleCreateSchedule() {
    if (!nsLabel || !nsAmount) { setError('Label and amount required'); return }
    setError('')
    startTransition(async () => {
      const result = await createDuesSchedule({
        label: nsLabel,
        amount_cents: Math.round(parseFloat(nsAmount) * 100),
        frequency: nsFreq,
        due_month: null,
        due_day: null,
        start_date: nsStartDate || null,
        end_date: nsEndDate || null,
        description: nsDescription.trim() || null,
      })
      if (!result.success) { setError(result.message ?? 'Failed'); return }
      setNsLabel(''); setNsAmount(''); setNsStartDate(''); setNsEndDate(''); setNsDescription('')
    })
  }

  function handleDeleteSchedule(id: string) {
    startTransition(async () => { await deleteDuesSchedule(id); setSchedules(prev => prev.filter(s => s.id !== id)) })
  }

  function handleRecordPayment() {
    if (!rpPersonId || !rpAmount) { setError('Member and amount required'); return }
    setError('')
    startTransition(async () => {
      const result = await recordPayment({
        person_id: rpPersonId,
        schedule_id: rpScheduleId || null,
        amount_cents: Math.round(parseFloat(rpAmount) * 100),
        status: rpStatus,
        payment_date: rpDate,
        payment_method: rpMethod || null,
        notes: rpNotes || null,
      })
      if (!result.success) { setError(result.message ?? 'Failed'); return }
      // Optimistically add to the payment history list.
      const cents = Math.round(parseFloat(rpAmount) * 100)
      const member = members.find(m => m.id === rpPersonId)
      const schedule = schedules.find(s => s.id === rpScheduleId)
      setPayments(prev => [{
        id: `temp-${Date.now()}`,
        person_id: rpPersonId,
        person_name: member ? `${member.first_name} ${member.last_name}` : null,
        schedule_id: rpScheduleId || null,
        schedule_label: schedule?.label ?? null,
        amount_cents: cents,
        status: rpStatus,
        payment_date: rpDate,
        payment_method: rpMethod || null,
        notes: rpNotes || null,
        created_at: new Date().toISOString(),
      }, ...prev])
      setRpPersonId(''); setRpAmount(''); setRpScheduleId(''); setRpNotes('')
      setTab('payments')
      // Refresh server data so fund balances (routed dues) update too.
      router.refresh()
    })
  }

  const tabs = [
    { id: 'schedules' as const, label: 'Schedules' },
    { id: 'payments' as const, label: 'Payment History' },
    { id: 'record' as const, label: 'Record Payment' },
  ]

  return (
    <div className="space-y-6">
      <div className="flex gap-2 border-b">
        {tabs.map(t => (
          <button
            key={t.id}
            onClick={() => { setTab(t.id); setError('') }}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors -mb-px ${tab === t.id ? 'border-primary text-primary' : 'border-transparent text-muted-foreground hover:text-foreground'}`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'schedules' && (
        <div className="space-y-4">
          {/* Add schedule form */}
          <div className="rounded-xl border bg-card p-4 space-y-3">
            <h3 className="text-sm font-semibold">Add Schedule</h3>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="space-y-1.5">
                <Label>Label</Label>
                <Input value={nsLabel} onChange={e => setNsLabel(e.target.value)} placeholder="Annual Dues" />
              </div>
              <div className="space-y-1.5">
                <Label>Amount ($)</Label>
                <Input type="number" min="0" step="0.01" value={nsAmount} onChange={e => setNsAmount(e.target.value)} placeholder="25.00" />
              </div>
              <div className="space-y-1.5">
                <Label>Frequency</Label>
                <Select value={nsFreq} onChange={e => setNsFreq(e.target.value)}>
                  {FREQ_OPTIONS.map(f => <option key={f} value={f}>{f.charAt(0).toUpperCase() + f.slice(1)}</option>)}
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Start Date (optional)</Label>
                <Input type="date" value={nsStartDate} onChange={e => setNsStartDate(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label>End Date (optional)</Label>
                <Input type="date" value={nsEndDate} onChange={e => setNsEndDate(e.target.value)} />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Description (optional)</Label>
              <Input value={nsDescription} onChange={e => setNsDescription(e.target.value)} placeholder="Details about this schedule…" />
            </div>
            {error && <p className="text-sm text-destructive">{error}</p>}
            <Button size="sm" onClick={handleCreateSchedule} disabled={isPending}>
              <Plus className="h-3.5 w-3.5 mr-1" /> Add Schedule
            </Button>
          </div>

          {/* Schedule list */}
          {schedules.length === 0 ? (
            <p className="text-sm text-muted-foreground">No schedules yet.</p>
          ) : (
            <ul className="divide-y rounded-xl border overflow-hidden">
              {schedules.map(s => (
                <li key={s.id}>
                  {editId === s.id ? (
                    <div className="px-4 py-3 space-y-3 bg-muted/30">
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                        <div className="space-y-1.5">
                          <Label>Label</Label>
                          <Input value={editLabel} onChange={e => setEditLabel(e.target.value)} />
                        </div>
                        <div className="space-y-1.5">
                          <Label>Amount ($)</Label>
                          <Input type="number" min="0" step="0.01" value={editAmount} onChange={e => setEditAmount(e.target.value)} />
                        </div>
                        <div className="space-y-1.5">
                          <Label>Frequency</Label>
                          <Select value={editFreq} onChange={e => setEditFreq(e.target.value)}>
                            {FREQ_OPTIONS.map(f => <option key={f} value={f}>{f.charAt(0).toUpperCase() + f.slice(1)}</option>)}
                          </Select>
                        </div>
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div className="space-y-1.5">
                          <Label>Start Date</Label>
                          <Input type="date" value={editStartDate} onChange={e => setEditStartDate(e.target.value)} />
                        </div>
                        <div className="space-y-1.5">
                          <Label>End Date</Label>
                          <Input type="date" value={editEndDate} onChange={e => setEditEndDate(e.target.value)} />
                        </div>
                      </div>
                      <div className="space-y-1.5">
                        <Label>Description</Label>
                        <Input value={editDescription} onChange={e => setEditDescription(e.target.value)} />
                      </div>
                      {error && <p className="text-sm text-destructive">{error}</p>}
                      <div className="flex gap-2">
                        <Button size="sm" onClick={handleSaveEdit} disabled={isPending}>Save</Button>
                        <Button size="sm" variant="ghost" onClick={cancelEdit}><X className="h-3.5 w-3.5" /></Button>
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-center gap-3 px-4 py-3">
                      <DollarSign className="h-4 w-4 text-muted-foreground shrink-0" />
                      <div className="flex-1">
                        <p className="text-sm font-medium">{s.label}</p>
                        <p className="text-xs text-muted-foreground">
                          {formatDollars(s.amount_cents)} — {s.frequency}
                          {s.start_date && ` · from ${formatDate(s.start_date)}`}
                          {s.end_date && ` to ${formatDate(s.end_date)}`}
                        </p>
                        {s.description && <p className="text-xs text-muted-foreground mt-0.5">{s.description}</p>}
                      </div>
                      <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={() => startEdit(s)}>
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                      <Button size="sm" variant="ghost" className="text-destructive hover:text-destructive h-7 w-7 p-0" onClick={() => handleDeleteSchedule(s.id)}>
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {tab === 'payments' && (
        <div>
          {payments.length === 0 ? (
            <p className="text-sm text-muted-foreground">No payments recorded yet.</p>
          ) : (
            <ul className="divide-y rounded-xl border overflow-hidden">
              {payments.map(p => (
                <li key={p.id} className="flex items-center gap-3 px-4 py-3">
                  <div className="flex-1">
                    <p className="text-sm font-medium">{p.person_name ?? 'Unknown'}</p>
                    <p className="text-xs text-muted-foreground">
                      {p.schedule_label ?? 'No schedule'} · {formatDate(p.payment_date)}
                      {p.payment_method && ` · ${p.payment_method}`}
                    </p>
                  </div>
                  <span className={`text-sm font-medium ${p.status === 'paid' ? 'text-green-600' : p.status === 'waived' ? 'text-muted-foreground' : 'text-amber-600'}`}>
                    {p.status === 'waived' ? 'Waived' : formatDollars(p.amount_cents)}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {tab === 'record' && (
        <div className="rounded-xl border bg-card p-4 space-y-4 max-w-md">
          <div className="space-y-1.5">
            <Label>Member</Label>
            <Select value={rpPersonId} onChange={e => setRpPersonId(e.target.value)}>
              <option value="">— Select member —</option>
              {members.map(m => (
                <option key={m.id} value={m.id}>
                  {disambiguatedName(m, members)}
                </option>
              ))}
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Schedule (optional)</Label>
            <Select value={rpScheduleId} onChange={e => setRpScheduleId(e.target.value)}>
              <option value="">— None —</option>
              {schedules.map(s => <option key={s.id} value={s.id}>{s.label}</option>)}
            </Select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Amount ($)</Label>
              <Input type="number" min="0" step="0.01" value={rpAmount} onChange={e => setRpAmount(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>Status</Label>
              <Select value={rpStatus} onChange={e => setRpStatus(e.target.value as typeof rpStatus)}>
                <option value="paid">Paid</option>
                <option value="pending">Pending</option>
                <option value="waived">Waived</option>
              </Select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Date</Label>
              <Input type="date" value={rpDate} onChange={e => setRpDate(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>Method</Label>
              <Input value={rpMethod} onChange={e => setRpMethod(e.target.value)} placeholder="Check, Venmo…" />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>Notes</Label>
            <Input value={rpNotes} onChange={e => setRpNotes(e.target.value)} placeholder="Optional notes" />
          </div>
          {error && <p className="text-sm text-destructive">{error}</p>}
          <Button size="sm" onClick={handleRecordPayment} disabled={isPending}>
            {isPending ? 'Recording…' : 'Record Payment'}
          </Button>
        </div>
      )}
    </div>
  )
}
