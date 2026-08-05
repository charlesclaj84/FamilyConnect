'use client'

import { useState, useTransition } from 'react'
import { Plus, Trash2, Pencil, X, ChevronUp, ChevronDown } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select } from '@/components/ui/select'
import { useConfirm } from '@/components/ui/confirm'
import { disambiguatedName } from '@/lib/name-utils'
import { formatCurrency as fmt, dollarsToCents } from '@/lib/currency-utils'
import { formatDate } from '@/lib/date-utils'
import { useServerState } from '@/lib/use-server-state'
import {
  createFund, updateFund, deleteFund,
  createMilestone, deleteMilestone,
  recordDisbursement, deleteDisbursement,
  saveFundAllocations, recordFundContribution,
  type FundWithStats, type FundMilestone, type FundDisbursement, type FundAllocationRow,
} from '@/app/actions/funds'
import { isFundsSection, type AccountSection } from '@/components/admin/account-sections'

// Member "open contributions" feature is hidden for now; flip to re-enable.
const SHOW_OPEN_CONTRIBUTIONS = false

interface Person { id: string; first_name: string; last_name: string; nick_name?: string | null; date_of_birth?: string | null }

interface Props {
  /** Which section the shell is showing. This component renders only its own. */
  section: AccountSection
  initialFunds: FundWithStats[]
  allMilestones: FundMilestone[]
  allDisbursements: FundDisbursement[]
  initialAllocations: FundAllocationRow[]
  members: Person[]
}

export function AdminFundsClient({ section, initialFunds, allMilestones, allDisbursements, initialAllocations, members }: Props) {
  const confirm = useConfirm()
  // Section lives in AdminAccountShell now. Aliased to `tab` so every panel guard
  // below stays identical to the tab-strip version.
  const tab: AccountSection = section
  // `useServerState` keeps these in sync when the page re-fetches (e.g. after a dues
  // payment routes into funds) — the shell never unmounts this panel, so a plain
  // `useState` initializer would go stale for the rest of the visit.
  const [funds, setFunds] = useServerState(initialFunds)
  const [disbursements, setDisbursements] = useServerState(allDisbursements)
  const [milestones, setMilestones] = useServerState(allMilestones)
  const [error, setError] = useState('')
  const [isPending, startTransition] = useTransition()

  // ── New fund form ──
  const [nfName, setNfName] = useState('')
  const [nfDesc, setNfDesc] = useState('')
  const [nfGoal, setNfGoal] = useState('')
  const [nfOpen, setNfOpen] = useState(false)

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

  // ── Routing config (rows ordered by priority; order = priority) ──
  const [alloc, setAlloc] = useState(() => initialAllocations.map(a => ({
    fund_id: a.fund_id,
    fund_name: a.fund_name,
    percent: (a.basis_points / 100).toString(),
    minimum: (a.minimum_cents / 100).toFixed(2),
  })))
  const [routingMsg, setRoutingMsg] = useState('')
  const [editingRouting, setEditingRouting] = useState(false)
  const [routingSnapshot, setRoutingSnapshot] = useState<typeof alloc>([])
  const totalPct = alloc.reduce((s, a) => s + (parseFloat(a.percent || '0') || 0), 0)
  const pctValid = Math.abs(totalPct - 100) < 0.001 || totalPct === 0

  function startEditRouting() { setRoutingSnapshot(alloc); setEditingRouting(true); setRoutingMsg(''); setError('') }
  function cancelEditRouting() { setAlloc(routingSnapshot); setEditingRouting(false) }

  function setAllocField(fundId: string, field: 'percent' | 'minimum', value: string) {
    setAlloc(prev => prev.map(a => a.fund_id === fundId ? { ...a, [field]: value } : a))
  }

  function moveAlloc(index: number, dir: -1 | 1) {
    const target = index + dir
    if (target < 0 || target >= alloc.length) return
    setAlloc(prev => {
      const next = [...prev]
      ;[next[index], next[target]] = [next[target], next[index]]
      return next
    })
  }

  async function handleSaveAllocations() {
    const ok = await confirm({
      title: 'Save routing',
      description: 'Save this routing configuration? Future dues payments will be split across funds using these percentages and priorities.',
      confirmLabel: 'Save routing',
    })
    if (!ok) return
    setRoutingMsg(''); setError('')
    startTransition(async () => {
      // Priority is derived from row order (top row = priority 0).
      const rows = alloc.map((a, i) => ({
        fund_id: a.fund_id,
        basis_points: Math.round((parseFloat(a.percent || '0') || 0) * 100),
        priority: i,
        minimum_cents: dollarsToCents(a.minimum),
      }))
      const res = await saveFundAllocations(rows)
      if (res.success) setEditingRouting(false)
      setRoutingMsg(res.success ? 'Routing saved.' : (res.message ?? 'Failed to save'))
    })
  }

  // ── Manual contribution form ──
  const [fcFundId, setFcFundId] = useState('')
  const [fcAmount, setFcAmount] = useState('')
  const [fcDate, setFcDate] = useState(new Date().toISOString().split('T')[0])
  const [fcNotes, setFcNotes] = useState('')

  // The deleted tab strip cleared `error` on every tab click; this preserves that.
  // Adjusted during render, not in an effect, so a stale validation message never
  // paints for a frame in the wrong panel. `routingMsg` is deliberately NOT cleared:
  // the old strip cleared only `error`, so "Routing saved." survived a tab switch
  // and must keep surviving a section switch.
  const [prevSection, setPrevSection] = useState(section)
  if (prevSection !== section) {
    setPrevSection(section)
    setError('')
  }

  function handleRecordContribution() {
    if (!fcFundId || !fcAmount) { setError('Fund and amount required'); return }
    setError('')
    const cents = dollarsToCents(fcAmount)
    const fundId = fcFundId
    startTransition(async () => {
      const res = await recordFundContribution({
        fund_id: fundId,
        amount_cents: cents,
        contributed_date: fcDate,
        notes: fcNotes || null,
      })
      if (!res.success) { setError(res.message ?? 'Failed'); return }
      setFunds(prev => prev.map(f => f.id === fundId
        ? { ...f, total_contributed_cents: f.total_contributed_cents + cents, balance_cents: f.balance_cents + cents }
        : f))
      setFcAmount(''); setFcNotes(''); setRoutingMsg('Contribution recorded.')
    })
  }

  const filteredMilestones = rdFundId ? milestones.filter(m => m.fund_id === rdFundId) : []

  function handleCreateFund() {
    if (!nfName) { setError('Name required'); return }
    setError('')
    startTransition(async () => {
      const result = await createFund({
        name: nfName,
        description: nfDesc,
        goal_cents: nfGoal ? Math.round(parseFloat(nfGoal) * 100) : null,
        open_contributions: nfOpen,
      })
      if (!result.success || !result.id) { setError(result.message ?? 'Failed'); return }
      // Optimistically show the new fund without a page refresh.
      const maxPriority = funds.reduce((m, f) => Math.max(m, f.priority), 0)
      const newFund: FundWithStats = {
        id: result.id,
        name: nfName.trim(),
        description: nfDesc.trim() || null,
        goal_cents: nfGoal ? Math.round(parseFloat(nfGoal) * 100) : null,
        active: true,
        created_at: new Date().toISOString(),
        priority: maxPriority + 1,
        minimum_cents: 0,
        event_id: null,
        open_contributions: nfOpen,
        total_disbursed_cents: 0,
        total_contributed_cents: 0,
        balance_cents: 0,
        milestone_count: 0,
        allocation_bps: funds.length === 0 ? 10000 : 0,
      }
      setFunds(prev => [...prev, newFund])
      setAlloc(prev => [...prev, { fund_id: newFund.id, fund_name: newFund.name, percent: funds.length === 0 ? '100' : '0', minimum: '0.00' }])
      setNfName(''); setNfDesc(''); setNfGoal(''); setNfOpen(false)
    })
  }

  async function handleDeleteFund(id: string) {
    const fund = funds.find(f => f.id === id)
    const ok = await confirm({
      title: 'Delete fund',
      description: fund
        ? `Delete the fund "${fund.name}"? Its balance of ${fmt(fund.balance_cents)} and its milestones go with it. This cannot be undone.`
        : 'Delete this fund and its milestones? This cannot be undone.',
      confirmLabel: 'Delete fund',
      destructive: true,
    })
    if (!ok) return
    startTransition(async () => {
      await deleteFund(id)
      setFunds(prev => prev.filter(f => f.id !== id))
    })
  }

  async function handleToggleOpen(fund: FundWithStats) {
    const next = !fund.open_contributions
    const ok = await confirm({
      title: next ? 'Open fund to contributions' : 'Close fund to contributions',
      description: next
        ? `Let members contribute to "${fund.name}" directly?`
        : `Stop members from contributing to "${fund.name}" directly?`,
      confirmLabel: next ? 'Open fund' : 'Close fund',
      destructive: !next,
    })
    if (!ok) return
    setFunds(prev => prev.map(f => f.id === fund.id ? { ...f, open_contributions: next } : f))
    startTransition(async () => {
      const res = await updateFund(fund.id, { open_contributions: next })
      if (!res.success) {
        setError(res.message ?? 'Failed')
        setFunds(prev => prev.map(f => f.id === fund.id ? { ...f, open_contributions: !next } : f))
      }
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
      if (!result.success || !result.milestone) { setError(result.message ?? 'Failed'); return }
      // Also puts it in the disbursement form's milestone dropdown right away.
      const created = result.milestone
      setMilestones(prev => [...prev, created])
      setFunds(prev => prev.map(f => f.id === created.fund_id
        ? { ...f, milestone_count: f.milestone_count + 1 }
        : f))
      setNmName(''); setNmDesc(''); setNmAmount('')
    })
  }

  async function handleDeleteMilestone(id: string) {
    const milestone = milestones.find(m => m.id === id)
    const ok = await confirm({
      title: 'Delete milestone',
      description: milestone
        ? `Delete the milestone "${milestone.name}" (${fmt(milestone.amount_cents)})? This cannot be undone.`
        : 'Delete this milestone? This cannot be undone.',
      confirmLabel: 'Delete milestone',
      destructive: true,
    })
    if (!ok) return
    startTransition(async () => {
      const result = await deleteMilestone(id)
      if (!result.success) { setError(result.message ?? 'Failed'); return }
      setMilestones(prev => prev.filter(m => m.id !== id))
      if (milestone) {
        setFunds(prev => prev.map(f => f.id === milestone.fund_id
          ? { ...f, milestone_count: Math.max(0, f.milestone_count - 1) }
          : f))
      }
    })
  }

  function handleRecordDisbursement() {
    if (!rdFundId || !rdPersonId || !rdAmount) { setError('Fund, member, and amount required'); return }
    setError('')
    const cents = Math.round(parseFloat(rdAmount) * 100)
    const fundId = rdFundId, personId = rdPersonId, milestoneId = rdMilestoneId || null, date = rdDate, notes = rdNotes || null
    startTransition(async () => {
      const result = await recordDisbursement({
        fund_id: fundId,
        milestone_id: milestoneId,
        person_id: personId,
        amount_cents: cents,
        disbursed_date: date,
        notes,
      })
      if (!result.success) { setError(result.message ?? 'Failed'); return }
      // Reflect the payout in the balance and the disbursements list immediately.
      setFunds(prev => prev.map(f => f.id === fundId
        ? { ...f, total_disbursed_cents: f.total_disbursed_cents + cents, balance_cents: f.balance_cents - cents }
        : f))
      const fund = funds.find(f => f.id === fundId)
      const person = members.find(m => m.id === personId)
      const milestone = milestones.find(m => m.id === milestoneId)
      setDisbursements(prev => [{
        id: `temp-${Date.now()}`,
        fund_id: fundId,
        fund_name: fund?.name ?? null,
        milestone_id: milestoneId,
        milestone_name: milestone?.name ?? null,
        person_id: personId,
        person_name: person ? `${person.first_name} ${person.last_name}` : null,
        amount_cents: cents,
        disbursed_date: date,
        notes,
        created_at: new Date().toISOString(),
      }, ...prev])
      setRdPersonId(''); setRdAmount(''); setRdMilestoneId(''); setRdNotes('')
    })
  }

  async function handleDeleteDisbursement(id: string) {
    const disbursement = disbursements.find(d => d.id === id)
    const ok = await confirm({
      title: 'Delete disbursement',
      description: disbursement
        ? `Delete the ${fmt(disbursement.amount_cents)} disbursement to ${disbursement.person_name ?? 'this member'} from ${disbursement.fund_name ?? 'the fund'}? The amount returns to the fund balance. This cannot be undone.`
        : 'Delete this disbursement? The amount returns to the fund balance. This cannot be undone.',
      confirmLabel: 'Delete disbursement',
      destructive: true,
    })
    if (!ok) return
    startTransition(async () => {
      await deleteDisbursement(id)
      setDisbursements(prev => prev.filter(d => d.id !== id))
    })
  }

  if (!isFundsSection(section)) return null

  return (
    <div className="space-y-6">
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
            {SHOW_OPEN_CONTRIBUTIONS && (
              <label className="flex items-center gap-2 text-sm cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={nfOpen}
                  onChange={e => setNfOpen(e.target.checked)}
                  className="h-4 w-4 rounded border-input accent-primary"
                />
                Open to member contributions
                <span className="text-xs text-muted-foreground">(any family member can contribute any amount)</span>
              </label>
            )}
            {error && <p className="text-sm text-destructive">{error}</p>}
            <Button size="sm" onClick={handleCreateFund} disabled={isPending}><Plus className="h-3.5 w-3.5 mr-1" /> Add Fund</Button>
          </div>
          {funds.length === 0 ? (
            <p className="text-sm text-muted-foreground">No funds yet.</p>
          ) : (
            <ul className="divide-y rounded-xl border overflow-hidden">
              {funds.map((f, i) => (
                <li key={f.id} className="flex items-center gap-3 px-4 py-3">
                  <span className="text-xs text-muted-foreground w-4 text-center shrink-0">{i + 1}</span>
                  <div className="flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="text-sm font-medium">{f.name}</p>
                      <span className="text-xs bg-primary/10 text-primary px-1.5 py-0.5 rounded-full">{(f.allocation_bps / 100).toFixed(f.allocation_bps % 100 === 0 ? 0 : 2)}% of dues</span>
                      {SHOW_OPEN_CONTRIBUTIONS && f.open_contributions && <span className="text-xs bg-emerald-100 text-emerald-700 px-1.5 py-0.5 rounded-full">Open</span>}
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Balance: <span className={f.balance_cents >= 0 ? 'text-green-600 font-medium' : 'text-destructive font-medium'}>{fmt(f.balance_cents)}</span>
                      {` · Collected ${fmt(f.total_contributed_cents)} · Disbursed ${fmt(f.total_disbursed_cents)}`}
                      {f.minimum_cents > 0 ? ` · Minimum Balance ${fmt(f.minimum_cents)}` : ''}
                    </p>
                  </div>
                  {SHOW_OPEN_CONTRIBUTIONS && (
                    <Button size="sm" variant={f.open_contributions ? 'outline' : 'ghost'} disabled={isPending} onClick={() => handleToggleOpen(f)}>
                      {f.open_contributions ? 'Open to members' : 'Make open'}
                    </Button>
                  )}
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
                      {d.fund_name} {d.milestone_name ? `· ${d.milestone_name}` : ''} · {formatDate(d.disbursed_date)}
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

      {tab === 'record-disbursement' && (
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

      {tab === 'routing' && (
        <div className="space-y-6">
          <div className="rounded-xl border bg-card p-4 space-y-3">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h3 className="text-sm font-semibold">Dues Routing</h3>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Set the share of each dues payment that flows to each fund. Funds higher in the list fill first;
                  a fund below its minimum is topped up before lower ones receive anything.
                </p>
              </div>
              {alloc.length > 0 && !editingRouting && (
                <Button size="sm" variant="outline" onClick={startEditRouting}>
                  <Pencil className="h-3.5 w-3.5" /> Edit
                </Button>
              )}
            </div>
            {alloc.length === 0 ? (
              <p className="text-sm text-muted-foreground">Create a fund first to configure routing.</p>
            ) : !editingRouting ? (
              // ── View mode ──
              <div className="overflow-x-auto">
                <table className="w-full text-sm min-w-[480px]">
                  <thead>
                    <tr className="border-b">
                      <th className="py-2 pr-3 text-left text-xs font-medium text-muted-foreground">#</th>
                      <th className="py-2 pr-3 text-left text-xs font-medium text-muted-foreground">Fund</th>
                      <th className="py-2 pr-3 text-right text-xs font-medium text-muted-foreground">Allocation</th>
                      <th className="py-2 text-right text-xs font-medium text-muted-foreground">Minimum</th>
                    </tr>
                  </thead>
                  <tbody>
                    {alloc.map((a, i) => (
                      <tr key={a.fund_id} className="border-b last:border-0">
                        <td className="py-2 pr-3 text-xs text-muted-foreground">{i + 1}</td>
                        <td className="py-2 pr-3 font-medium">{a.fund_name}</td>
                        <td className="py-2 pr-3 text-right">{(parseFloat(a.percent || '0') || 0).toFixed(2)}%</td>
                        <td className="py-2 text-right">{fmt(dollarsToCents(a.minimum))}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              // ── Edit mode ──
              <>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm min-w-[560px]">
                    <thead>
                      <tr className="border-b">
                        <th className="py-2 pr-3 text-left text-xs font-medium text-muted-foreground">Priority</th>
                        <th className="py-2 pr-3 text-left text-xs font-medium text-muted-foreground">Fund</th>
                        <th className="py-2 pr-3 text-left text-xs font-medium text-muted-foreground">Allocation&nbsp;%</th>
                        <th className="py-2 text-left text-xs font-medium text-muted-foreground">Minimum&nbsp;$</th>
                      </tr>
                    </thead>
                    <tbody>
                      {alloc.map((a, i) => (
                        <tr key={a.fund_id} className="border-b last:border-0">
                          <td className="py-2 pr-3">
                            <div className="flex items-center gap-1">
                              <span className="text-xs text-muted-foreground w-4 text-center">{i + 1}</span>
                              <button
                                type="button"
                                aria-label="Move up"
                                disabled={i === 0 || isPending}
                                onClick={() => moveAlloc(i, -1)}
                                className="rounded p-0.5 text-muted-foreground hover:text-foreground disabled:opacity-30 disabled:pointer-events-none"
                              >
                                <ChevronUp className="h-4 w-4" />
                              </button>
                              <button
                                type="button"
                                aria-label="Move down"
                                disabled={i === alloc.length - 1 || isPending}
                                onClick={() => moveAlloc(i, 1)}
                                className="rounded p-0.5 text-muted-foreground hover:text-foreground disabled:opacity-30 disabled:pointer-events-none"
                              >
                                <ChevronDown className="h-4 w-4" />
                              </button>
                            </div>
                          </td>
                          <td className="py-2 pr-3 font-medium">{a.fund_name}</td>
                          <td className="py-2 pr-3">
                            <Input type="number" min="0" max="100" step="0.01" value={a.percent}
                              onChange={e => setAllocField(a.fund_id, 'percent', e.target.value)} className="h-8 w-24" />
                          </td>
                          <td className="py-2">
                            <Input type="number" min="0" step="0.01" value={a.minimum}
                              onChange={e => setAllocField(a.fund_id, 'minimum', e.target.value)} className="h-8 w-28" />
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <div className="flex items-center gap-3 flex-wrap">
                  <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                    pctValid ? 'bg-green-100 text-green-700' : 'bg-destructive/10 text-destructive'
                  }`}>
                    Total: {totalPct.toFixed(2)}%
                  </span>
                  {!pctValid && <span className="text-xs text-muted-foreground">Allocations must total 100% (or 0% to disable routing).</span>}
                  <Button size="sm" onClick={handleSaveAllocations} disabled={isPending || !pctValid}>
                    {isPending ? 'Saving…' : 'Save Routing'}
                  </Button>
                  <Button size="sm" variant="ghost" onClick={cancelEditRouting} disabled={isPending}>
                    <X className="h-3.5 w-3.5" /> Cancel
                  </Button>
                </div>
              </>
            )}
          </div>

          {error && <p className="text-sm text-destructive">{error}</p>}
          {routingMsg && <p className="text-sm text-muted-foreground">{routingMsg}</p>}
        </div>
      )}

      {/* Moved out of Routing: recording a contribution is manual money entry, not
          routing configuration. The form state lives on the component, not in this
          block, so it survives switching away and back. */}
      {tab === 'record-contribution' && (
        <div className="space-y-6">
          <div className="rounded-xl border bg-card p-4 space-y-3 max-w-md">
            <p className="text-xs text-muted-foreground">Record money added to a fund directly by an admin (outside of dues routing).</p>
            <div className="space-y-1.5">
              <Label>Fund</Label>
              <Select value={fcFundId} onChange={e => setFcFundId(e.target.value)}>
                <option value="">— Select fund —</option>
                {funds.map(f => <option key={f.id} value={f.id}>{f.name}</option>)}
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Amount ($)</Label>
                <Input type="number" min="0" step="0.01" value={fcAmount} onChange={e => setFcAmount(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label>Date</Label>
                <Input type="date" value={fcDate} onChange={e => setFcDate(e.target.value)} />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Notes</Label>
              <Input value={fcNotes} onChange={e => setFcNotes(e.target.value)} placeholder="Optional notes" />
            </div>
            <Button size="sm" onClick={handleRecordContribution} disabled={isPending}>
              <Plus className="h-3.5 w-3.5 mr-1" /> Add Contribution
            </Button>
          </div>

          {error && <p className="text-sm text-destructive">{error}</p>}
          {routingMsg && <p className="text-sm text-muted-foreground">{routingMsg}</p>}
        </div>
      )}
    </div>
  )
}
