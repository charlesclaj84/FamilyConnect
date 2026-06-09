'use client'

import { useState, useTransition } from 'react'
import { Plus, Trash2, Pencil, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select } from '@/components/ui/select'
import { disambiguatedName } from '@/lib/name-utils'
import {
  createFund, updateFund, deleteFund,
  createMilestone, deleteMilestone,
  recordDisbursement, deleteDisbursement,
  type FundWithStats, type FundMilestone, type FundDisbursement,
} from '@/app/actions/funds'

interface Person { id: string; first_name: string; last_name: string; nick_name?: string | null; date_of_birth?: string | null }

interface Props {
  initialFunds: FundWithStats[]
  allMilestones: FundMilestone[]
  allDisbursements: FundDisbursement[]
  members: Person[]
}

function fmt(cents: number) { return `$${(cents / 100).toFixed(2)}` }

export function AdminFundsClient({ initialFunds, allMilestones, allDisbursements, members }: Props) {
  const [tab, setTab] = useState<'funds' | 'milestones' | 'disbursements' | 'record'>('funds')
  const [funds, setFunds] = useState(initialFunds)
  const [disbursements, setDisbursements] = useState(allDisbursements)
  const [error, setError] = useState('')
  const [isPending, startTransition] = useTransition()

  // ── New fund form ──
  const [nfName, setNfName] = useState('')
  const [nfDesc, setNfDesc] = useState('')
  const [nfGoal, setNfGoal] = useState('')

  // ── New milestone form ──
  const [nmFundId, setNmFundId] = useState('')
  const [nmName, setNmName] = useState('')
  const [nmDesc, setNmDesc] = useState('')
  const [nmAmount, setNmAmount] = useState('')

  // ── Record disbursement form ──
  const [rdFundId, setRdFundId] = useState('')
  const [rdMilestoneId, setRdMilestoneId] = useState('')
  const [rdPersonId, setRdPersonId] = useState('')
  const [rdAmount, setRdAmount] = useState('')
  const [rdDate, setRdDate] = useState(new Date().toISOString().split('T')[0])
  const [rdNotes, setRdNotes] = useState('')

  const milestones = allMilestones // server-fetched, not re-fetching on create for simplicity
  const filteredMilestones = rdFundId ? milestones.filter(m => m.fund_id === rdFundId) : []

  function handleCreateFund() {
    if (!nfName) { setError('Name required'); return }
    setError('')
    startTransition(async () => {
      const result = await createFund({
        name: nfName,
        description: nfDesc,
        goal_cents: nfGoal ? Math.round(parseFloat(nfGoal) * 100) : null,
      })
      if (!result.success) { setError(result.message ?? 'Failed'); return }
      setNfName(''); setNfDesc(''); setNfGoal('')
    })
  }

  function handleDeleteFund(id: string) {
    startTransition(async () => {
      await deleteFund(id)
      setFunds(prev => prev.filter(f => f.id !== id))
    })
  }

  function handleCreateMilestone() {
    if (!nmFundId || !nmName || !nmAmount) { setError('Fund, name and amount required'); return }
    setError('')
    startTransition(async () => {
      const result = await createMilestone(nmFundId, {
        name: nmName,
        description: nmDesc,
        amount_cents: Math.round(parseFloat(nmAmount) * 100),
      })
      if (!result.success) { setError(result.message ?? 'Failed'); return }
      setNmName(''); setNmDesc(''); setNmAmount('')
    })
  }

  function handleDeleteMilestone(id: string) {
    startTransition(async () => { await deleteMilestone(id) })
  }

  function handleRecordDisbursement() {
    if (!rdFundId || !rdPersonId || !rdAmount) { setError('Fund, member, and amount required'); return }
    setError('')
    startTransition(async () => {
      const result = await recordDisbursement({
        fund_id: rdFundId,
        milestone_id: rdMilestoneId || null,
        person_id: rdPersonId,
        amount_cents: Math.round(parseFloat(rdAmount) * 100),
        disbursed_date: rdDate,
        notes: rdNotes || null,
      })
      if (!result.success) { setError(result.message ?? 'Failed'); return }
      setRdPersonId(''); setRdAmount(''); setRdMilestoneId(''); setRdNotes('')
    })
  }

  function handleDeleteDisbursement(id: string) {
    startTransition(async () => {
      await deleteDisbursement(id)
      setDisbursements(prev => prev.filter(d => d.id !== id))
    })
  }

  const tabs = [
    { id: 'funds' as const, label: 'Funds' },
    { id: 'milestones' as const, label: 'Milestones' },
    { id: 'disbursements' as const, label: 'Disbursements' },
    { id: 'record' as const, label: 'Record Disbursement' },
  ]

  return (
    <div className="space-y-6">
      <h2 className="text-lg font-semibold">Family Funds</h2>
      <div className="flex gap-2 border-b flex-wrap">
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

      {tab === 'funds' && (
        <div className="space-y-4">
          <div className="rounded-xl border bg-card p-4 space-y-3">
            <h3 className="text-sm font-semibold">New Fund</h3>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="space-y-1.5">
                <Label>Name</Label>
                <Input value={nfName} onChange={e => setNfName(e.target.value)} placeholder="College Fund" />
              </div>
              <div className="space-y-1.5">
                <Label>Goal Amount ($, optional)</Label>
                <Input type="number" min="0" step="0.01" value={nfGoal} onChange={e => setNfGoal(e.target.value)} placeholder="5000.00" />
              </div>
              <div className="space-y-1.5">
                <Label>Description</Label>
                <Input value={nfDesc} onChange={e => setNfDesc(e.target.value)} placeholder="For graduates…" />
              </div>
            </div>
            {error && <p className="text-sm text-destructive">{error}</p>}
            <Button size="sm" onClick={handleCreateFund} disabled={isPending}><Plus className="h-3.5 w-3.5 mr-1" /> Add Fund</Button>
          </div>
          {funds.length === 0 ? (
            <p className="text-sm text-muted-foreground">No funds yet.</p>
          ) : (
            <ul className="divide-y rounded-xl border overflow-hidden">
              {funds.map(f => (
                <li key={f.id} className="flex items-center gap-3 px-4 py-3">
                  <div className="flex-1">
                    <p className="text-sm font-medium">{f.name}</p>
                    <p className="text-xs text-muted-foreground">
                      Disbursed: {fmt(f.total_disbursed_cents)}
                      {f.goal_cents ? ` / Goal: ${fmt(f.goal_cents)}` : ''}
                      {` · ${f.milestone_count} milestone${f.milestone_count !== 1 ? 's' : ''}`}
                    </p>
                  </div>
                  <Button size="sm" variant="ghost" className="text-destructive hover:text-destructive h-7 w-7 p-0" onClick={() => handleDeleteFund(f.id)}>
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {tab === 'milestones' && (
        <div className="space-y-4">
          <div className="rounded-xl border bg-card p-4 space-y-3">
            <h3 className="text-sm font-semibold">New Milestone</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
              <div className="space-y-1.5">
                <Label>Fund</Label>
                <Select value={nmFundId} onChange={e => setNmFundId(e.target.value)}>
                  <option value="">— Select fund —</option>
                  {funds.map(f => <option key={f.id} value={f.id}>{f.name}</option>)}
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Milestone Name</Label>
                <Input value={nmName} onChange={e => setNmName(e.target.value)} placeholder="Graduate high school" />
              </div>
              <div className="space-y-1.5">
                <Label>Award Amount ($)</Label>
                <Input type="number" min="0" step="0.01" value={nmAmount} onChange={e => setNmAmount(e.target.value)} placeholder="250.00" />
              </div>
              <div className="space-y-1.5">
                <Label>Description</Label>
                <Input value={nmDesc} onChange={e => setNmDesc(e.target.value)} placeholder="High school diploma or GED" />
              </div>
            </div>
            {error && <p className="text-sm text-destructive">{error}</p>}
            <Button size="sm" onClick={handleCreateMilestone} disabled={isPending}><Plus className="h-3.5 w-3.5 mr-1" /> Add Milestone</Button>
          </div>
          {milestones.length === 0 ? (
            <p className="text-sm text-muted-foreground">No milestones yet.</p>
          ) : (
            <ul className="divide-y rounded-xl border overflow-hidden">
              {milestones.map(m => {
                const fund = funds.find(f => f.id === m.fund_id)
                return (
                  <li key={m.id} className="flex items-center gap-3 px-4 py-3">
                    <div className="flex-1">
                      <p className="text-sm font-medium">{m.name}</p>
                      <p className="text-xs text-muted-foreground">{fund?.name} · {fmt(m.amount_cents)}</p>
                    </div>
                    <Button size="sm" variant="ghost" className="text-destructive hover:text-destructive h-7 w-7 p-0" onClick={() => handleDeleteMilestone(m.id)}>
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </li>
                )
              })}
            </ul>
          )}
        </div>
      )}

      {tab === 'disbursements' && (
        <div>
          {disbursements.length === 0 ? (
            <p className="text-sm text-muted-foreground">No disbursements recorded.</p>
          ) : (
            <ul className="divide-y rounded-xl border overflow-hidden">
              {disbursements.map(d => (
                <li key={d.id} className="flex items-center gap-3 px-4 py-3">
                  <div className="flex-1">
                    <p className="text-sm font-medium">{d.person_name ?? 'Unknown'}</p>
                    <p className="text-xs text-muted-foreground">
                      {d.fund_name} {d.milestone_name ? `· ${d.milestone_name}` : ''} · {d.disbursed_date}
                    </p>
                    {d.notes && <p className="text-xs text-muted-foreground">{d.notes}</p>}
                  </div>
                  <span className="text-sm font-medium text-green-600">{fmt(d.amount_cents)}</span>
                  <Button size="sm" variant="ghost" className="text-destructive hover:text-destructive h-7 w-7 p-0" onClick={() => handleDeleteDisbursement(d.id)}>
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {tab === 'record' && (
        <div className="rounded-xl border bg-card p-4 space-y-4 max-w-md">
          <div className="space-y-1.5">
            <Label>Fund</Label>
            <Select value={rdFundId} onChange={e => { setRdFundId(e.target.value); setRdMilestoneId('') }}>
              <option value="">— Select fund —</option>
              {funds.map(f => <option key={f.id} value={f.id}>{f.name}</option>)}
            </Select>
          </div>
          {filteredMilestones.length > 0 && (
            <div className="space-y-1.5">
              <Label>Milestone (optional)</Label>
              <Select value={rdMilestoneId} onChange={e => {
                setRdMilestoneId(e.target.value)
                if (e.target.value) {
                  const m = filteredMilestones.find(x => x.id === e.target.value)
                  if (m) setRdAmount((m.amount_cents / 100).toFixed(2))
                }
              }}>
                <option value="">— None —</option>
                {filteredMilestones.map(m => <option key={m.id} value={m.id}>{m.name} ({fmt(m.amount_cents)})</option>)}
              </Select>
            </div>
          )}
          <div className="space-y-1.5">
            <Label>Recipient</Label>
            <Select value={rdPersonId} onChange={e => setRdPersonId(e.target.value)}>
              <option value="">— Select member —</option>
              {members.map(m => <option key={m.id} value={m.id}>{disambiguatedName(m, members)}</option>)}
            </Select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Amount ($)</Label>
              <Input type="number" min="0" step="0.01" value={rdAmount} onChange={e => setRdAmount(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>Date</Label>
              <Input type="date" value={rdDate} onChange={e => setRdDate(e.target.value)} />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>Notes</Label>
            <Input value={rdNotes} onChange={e => setRdNotes(e.target.value)} placeholder="Optional notes" />
          </div>
          {error && <p className="text-sm text-destructive">{error}</p>}
          <Button size="sm" onClick={handleRecordDisbursement} disabled={isPending}>
            {isPending ? 'Recording…' : 'Record Disbursement'}
          </Button>
        </div>
      )}
    </div>
  )
}
