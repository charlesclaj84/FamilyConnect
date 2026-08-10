'use client'

import { useState, useTransition } from 'react'
import { Trash2, Pencil, X, ChevronUp, ChevronDown } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Dialog } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select } from '@/components/ui/select'
import { useConfirm } from '@/components/ui/confirm'
import { cn } from '@/lib/utils'
import { formatCurrency as fmt, dollarsToCents } from '@/lib/currency-utils'
import { useServerState } from '@/lib/use-server-state'
import {
  createFund, updateFund, deleteFund,
  createMilestone, deleteMilestone,
  saveFundAllocations,
  type FundWithStats, type FundMilestone, type FundAllocationRow,
} from '@/app/actions/funds'
import {
  isFundsSection, type AccountSection, type AccountRights,
} from '@/components/admin/account-sections'

// Member "open contributions" feature is hidden for now; flip to re-enable.
const SHOW_OPEN_CONTRIBUTIONS = false

interface Props {
  /** Which section the shell is showing. This component renders only its own. */
  section: AccountSection
  /**
   * Which section's create dialog the shell has open, or null for none. Passed raw
   * rather than as a boolean per dialog: this panel owns two of them (new fund, new
   * milestone) and already reads `section` the same way. The forms themselves stay
   * here with the data they write.
   */
  creating: AccountSection | null
  onCloseCreate: () => void
  initialFunds: FundWithStats[]
  allMilestones: FundMilestone[]
  /** Per-section grants: Funds, Routing and Milestones are three separate resources. */
  rights: AccountRights
  initialAllocations: FundAllocationRow[]
}

export function AdminFundsClient({
  section,
  creating, onCloseCreate,
  initialFunds, allMilestones, initialAllocations,
  rights,
}: Props) {
  // This one component renders three sections that are now three separate resources,
  // so the grants are read per section rather than once for the panel.
  const mayEditFunds       = rights.funds.edit
  const mayDeleteFunds     = rights.funds.delete
  const mayEditRouting     = rights.routing.edit
  const mayDeleteMilestone = rights.milestones.delete
  const confirm = useConfirm()
  // Section lives in AdminAccountShell now. Aliased to `tab` so every panel guard
  // below stays identical to the tab-strip version.
  const tab: AccountSection = section
  const creatingFund = creating === 'funds'
  const creatingMilestone = creating === 'milestones'
  // `useServerState` keeps these in sync when the page re-fetches (e.g. after a dues
  // payment routes into funds) — the shell never unmounts this panel, so a plain
  // `useState` initializer would go stale for the rest of the visit.
  const [funds, setFunds] = useServerState(initialFunds)
  const [milestones, setMilestones] = useServerState(allMilestones)
  const [error, setError] = useState('')
  const [isPending, startTransition] = useTransition()

  // ── New fund form ──
  // Both "new" forms live in dialogs opened from the sub-nav. Their fields stay on
  // the component so closing one keeps what was typed, exactly as the inline cards
  // did; only a successful create clears them.
  const [nfName, setNfName] = useState('')
  const [nfDesc, setNfDesc] = useState('')
  const [nfGoal, setNfGoal] = useState('')
  const [nfOpen, setNfOpen] = useState(false)

  // ── New milestone form ──
  const [nmFundId, setNmFundId] = useState('')
  const [nmName, setNmName] = useState('')
  const [nmDesc, setNmDesc] = useState('')
  const [nmAmount, setNmAmount] = useState('')

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

  // Same trick for the create dialogs: their triggers belong to the shell, so this
  // component never sees the click that opens one and cannot clear a stale message
  // there.
  const [prevCreating, setPrevCreating] = useState(creating)
  if (prevCreating !== creating) {
    setPrevCreating(creating)
    setError('')
  }

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
        // A fund created from this form is never a system fund; only the migration and
        // the families trigger make those.
        system_key: null,
        total_disbursed_cents: 0,
        total_contributed_cents: 0,
        balance_cents: 0,
        milestone_count: 0,
        allocation_bps: funds.length === 0 ? 10000 : 0,
      }
      setFunds(prev => [...prev, newFund])
      setAlloc(prev => [...prev, { fund_id: newFund.id, fund_name: newFund.name, percent: funds.length === 0 ? '100' : '0', minimum: '0.00' }])
      setNfName(''); setNfDesc(''); setNfGoal(''); setNfOpen(false)
      onCloseCreate()
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
      onCloseCreate()
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

  if (!isFundsSection(section)) return null

  return (
    <div className="space-y-6">
      {tab === 'funds' && (
        <div className="space-y-4">
          {funds.length === 0 && (
            <p className="text-sm text-muted-foreground">No funds yet.</p>
          )}

          <Dialog
            open={creatingFund}
            onClose={onCloseCreate}
            title="New Fund"
            description="A pot that dues route into and disbursements come out of."
            className="max-h-[90vh] overflow-y-auto"
          >
            <div className="space-y-3 mt-2">
              <div className="space-y-1.5">
                <Label>Name <span className="text-destructive">*</span></Label>
                <Input value={nfName} onChange={e => setNfName(e.target.value)} placeholder="College Fund" autoFocus />
              </div>
              <div className="space-y-1.5">
                <Label>Goal Amount ($, optional)</Label>
                <Input type="number" min="0" step="0.01" value={nfGoal} onChange={e => setNfGoal(e.target.value)} placeholder="5000.00" />
              </div>
              <div className="space-y-1.5">
                <Label>Description</Label>
                <Input value={nfDesc} onChange={e => setNfDesc(e.target.value)} placeholder="For graduates…" />
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
              <div className="flex gap-2 pt-1">
                <Button className="flex-1" onClick={handleCreateFund} disabled={isPending}>
                  {isPending ? 'Adding…' : 'Add Fund'}
                </Button>
                <Button variant="outline" onClick={onCloseCreate} disabled={isPending}>
                  Cancel
                </Button>
              </div>
            </div>
          </Dialog>

          {/* A table, matching Member Directory: these are seven parallel figures per
              fund, and reading "Balance: X · Collected Y · Disbursed Z" as prose meant
              re-finding the same word on every row to compare two funds. */}
          {funds.length > 0 && (
            <div className="overflow-x-auto rounded-xl border">
              <table className="w-full min-w-[52rem] border-collapse text-sm">
                <thead>
                  <tr className="border-b bg-muted/40 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    <th scope="col" className="px-3 py-2 font-semibold">Fund</th>
                    <th scope="col" className="px-3 py-2 text-right font-semibold">% of dues</th>
                    <th scope="col" className="px-3 py-2 text-right font-semibold">Balance</th>
                    <th scope="col" className="px-3 py-2 text-right font-semibold">Collected</th>
                    <th scope="col" className="px-3 py-2 text-right font-semibold">Disbursed</th>
                    <th scope="col" className="px-3 py-2 text-right font-semibold">Minimum</th>
                    <th scope="col" className="px-3 py-2 font-semibold"><span className="sr-only">Actions</span></th>
                  </tr>
                </thead>
                <tbody>
                  {funds.map(f => (
                    <tr key={f.id} className="border-b last:border-0 align-middle">
                      <td className="px-3 py-2.5">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-medium">{f.name}</span>
                          {/* Says WHY there is no delete control on this row. A greyed-out
                              or absent button with no explanation reads as a bug. */}
                          {f.system_key && (
                            <span className="shrink-0 rounded-full bg-brand-tint px-2 py-0.5 text-[11px] font-medium text-brand-navy"
                              title="Created automatically. Holds every donation the family receives, and cannot be deleted or switched off.">
                              Built in
                            </span>
                          )}
                          {SHOW_OPEN_CONTRIBUTIONS && f.open_contributions && (
                            <span className="shrink-0 rounded-full bg-emerald-100 px-2 py-0.5 text-[11px] font-medium text-emerald-700">Open</span>
                          )}
                        </div>
                        {f.description && <p className="text-xs text-muted-foreground">{f.description}</p>}
                      </td>
                      <td className="px-3 py-2.5 text-right whitespace-nowrap text-muted-foreground">
                        {/* The Donations fund takes no share of dues — it takes donations,
                            whole — so a percentage here would be a number nothing reads. */}
                        {f.system_key
                          ? '—'
                          : `${(f.allocation_bps / 100).toFixed(f.allocation_bps % 100 === 0 ? 0 : 2)}%`}
                      </td>
                      <td className={cn('px-3 py-2.5 text-right font-medium whitespace-nowrap',
                        f.balance_cents >= 0 ? 'text-green-600' : 'text-destructive')}>
                        {fmt(f.balance_cents)}
                      </td>
                      <td className="px-3 py-2.5 text-right whitespace-nowrap text-muted-foreground">{fmt(f.total_contributed_cents)}</td>
                      <td className="px-3 py-2.5 text-right whitespace-nowrap text-muted-foreground">{fmt(f.total_disbursed_cents)}</td>
                      <td className="px-3 py-2.5 text-right whitespace-nowrap text-muted-foreground">
                        {f.minimum_cents > 0 ? fmt(f.minimum_cents) : '—'}
                      </td>
                      <td className="w-px px-3 py-2.5">
                        <div className="flex items-center justify-end gap-1">
                          {SHOW_OPEN_CONTRIBUTIONS && mayEditFunds && (
                            <Button size="sm" variant={f.open_contributions ? 'outline' : 'ghost'} disabled={isPending} onClick={() => handleToggleOpen(f)}>
                              {f.open_contributions ? 'Open to members' : 'Make open'}
                            </Button>
                          )}
                          {/* No delete for a system fund, and not merely disabled: the
                              action refuses it and 20260807000003's trigger refuses it
                              again, so a button here could only ever fail. */}
                          {mayDeleteFunds && !f.system_key && (
                            <Button size="sm" variant="ghost" className="h-7 w-7 p-0 text-destructive hover:text-destructive" onClick={() => handleDeleteFund(f.id)}>
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Failures from the list itself (delete, open/close) have nowhere else to
              land now that the create form is a dialog. Suppressed while the dialog
              is up, which renders the same message inline. */}
          {!creatingFund && error && <p className="text-sm text-destructive">{error}</p>}
        </div>
      )}

      {tab === 'milestones' && (
        <div className="space-y-4">
          {funds.length === 0 && (
            <p className="text-sm text-muted-foreground">Create a fund first — a milestone is awarded out of one.</p>
          )}
          {funds.length > 0 && milestones.length === 0 && (
            <p className="text-sm text-muted-foreground">No milestones yet.</p>
          )}

          <Dialog
            open={creatingMilestone}
            onClose={onCloseCreate}
            title="New Milestone"
            description="An award a member can be paid out of a fund when they reach it."
            className="max-h-[90vh] overflow-y-auto"
          >
            {/* The rail's trigger is always live, so the "no fund yet" case has to be
                answered in here — where the live fund list is — rather than by a
                disabled button the admin cannot interrogate. */}
            {funds.length === 0 ? (
              <div className="space-y-3 mt-2">
                <p className="text-sm text-muted-foreground">
                  A milestone is awarded out of a fund, and there are none yet. Add a fund
                  under Funds → Balances first.
                </p>
                <Button variant="outline" onClick={onCloseCreate}>Close</Button>
              </div>
            ) : (
              <div className="space-y-3 mt-2">
                <div className="space-y-1.5">
                  <Label>Fund <span className="text-destructive">*</span></Label>
                  <Select value={nmFundId} onChange={e => setNmFundId(e.target.value)}>
                    <option value="">— Select fund —</option>
                    {funds.map(f => <option key={f.id} value={f.id}>{f.name}</option>)}
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label>Milestone Name <span className="text-destructive">*</span></Label>
                  <Input value={nmName} onChange={e => setNmName(e.target.value)} placeholder="Graduate high school" autoFocus />
                </div>
                <div className="space-y-1.5">
                  <Label>Award Amount ($) <span className="text-destructive">*</span></Label>
                  <Input type="number" min="0" step="0.01" value={nmAmount} onChange={e => setNmAmount(e.target.value)} placeholder="250.00" />
                </div>
                <div className="space-y-1.5">
                  <Label>Description</Label>
                  <Input value={nmDesc} onChange={e => setNmDesc(e.target.value)} placeholder="High school diploma or GED" />
                </div>
                {error && <p className="text-sm text-destructive">{error}</p>}
                <div className="flex gap-2 pt-1">
                  <Button className="flex-1" onClick={handleCreateMilestone} disabled={isPending}>
                    {isPending ? 'Adding…' : 'Add Milestone'}
                  </Button>
                  <Button variant="outline" onClick={onCloseCreate} disabled={isPending}>
                    Cancel
                  </Button>
                </div>
              </div>
            )}
          </Dialog>

          {milestones.length > 0 && (
            <div className="overflow-x-auto rounded-xl border">
              <table className="w-full min-w-[36rem] border-collapse text-sm">
                <thead>
                  <tr className="border-b bg-muted/40 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    <th scope="col" className="px-3 py-2 font-semibold">Milestone</th>
                    <th scope="col" className="px-3 py-2 font-semibold">Fund</th>
                    <th scope="col" className="px-3 py-2 text-right font-semibold">Award</th>
                    <th scope="col" className="px-3 py-2 font-semibold"><span className="sr-only">Actions</span></th>
                  </tr>
                </thead>
                <tbody>
                  {milestones.map(m => {
                    const fund = funds.find(f => f.id === m.fund_id)
                    return (
                      <tr key={m.id} className="border-b last:border-0 align-middle">
                        <td className="px-3 py-2.5">
                          <span className="font-medium">{m.name}</span>
                          {m.description && <p className="text-xs text-muted-foreground">{m.description}</p>}
                        </td>
                        <td className="px-3 py-2.5 text-muted-foreground">{fund?.name ?? '—'}</td>
                        <td className="px-3 py-2.5 text-right font-medium whitespace-nowrap">{fmt(m.amount_cents)}</td>
                        <td className="w-px px-3 py-2.5 text-right">
                          {mayDeleteMilestone && (
                            <Button size="sm" variant="ghost" className="h-7 w-7 p-0 text-destructive hover:text-destructive" onClick={() => handleDeleteMilestone(m.id)}>
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          )}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}

          {/* Delete failures, for the same reason as the funds list above. */}
          {!creatingMilestone && error && <p className="text-sm text-destructive">{error}</p>}
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
              {alloc.length > 0 && !editingRouting && mayEditRouting && (
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

    </div>
  )
}
