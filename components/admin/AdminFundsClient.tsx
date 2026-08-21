'use client'

import { useState, useTransition } from 'react'
import { Trash2, Pencil, X, ChevronUp, ChevronDown } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Dialog } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select } from '@/components/ui/select'
import { useConfirm } from '@/components/ui/confirm'
import { COLLAPSING_CELL, RowMeta, MetaDot, MetaIf } from '@/components/ui/table-collapse'
import { FormError } from '@/components/ui/form-message'
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

/**
 * A transfer figure, with its direction on the front.
 *
 * Every other currency figure on this screen is a magnitude whose direction is the
 * column it sits in — Collected is in, Disbursed is out. Net transfers is the one that
 * can point either way for the same fund, so "$300" alone would be unreadable and
 * `formatCurrency(-30000)` renders "-$300.00", which reads as a negative amount of
 * money rather than money going the other way.
 */
function signedFmt(cents: number): string {
  return `${cents < 0 ? '−' : '+'}${fmt(Math.abs(cents))}`
}

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
  // THE MINIMUM, not a goal. A goal was a number nothing reads: routing fills funds toward
  // their MINIMUM in priority order, so the field that was asked for at creation had no
  // consequence and the one that did stayed at zero — and the Routing screen next door
  // then showed $0.00 for a fund somebody had just given a target. See `createFund`.
  const [nfMinimum, setNfMinimum] = useState('')
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

  // ── SAY WHAT IS LEFT, NOT WHAT THE RULE IS ──────────────────────────────────────
  // The footer used to read "Allocations must total 100% (or 0% to disable routing)" beside a
  // "Total: 65.00%" chip, which states the rule and leaves the treasurer to do the subtraction
  // — on a screen whose entire job is arithmetic. Worse, it is the same sentence at 65% and at
  // 165%, so it does not even say which direction they are out by.
  //
  // `routingGap` is the signed distance to 100, rounded to the two decimals the inputs accept.
  // Rounded BEFORE it is compared to zero, not after: `100 - 33.33 - 33.33 - 33.34` is
  // -1.4e-14 in floating point, and an unrounded gap would print "0.00% more to go" while
  // `pctValid` — which uses its own 0.001 tolerance — correctly says the form is fine. The two
  // have to agree about what "adds up" means or the screen contradicts itself.
  const routingGap = Math.round((100 - totalPct) * 100) / 100
  const routingHint =
    totalPct === 0
      ? 'Routing is off. Contributions stay in the fund they were given to until these add up to 100%.'
      : routingGap > 0
        ? `${routingGap.toFixed(2)}% more to go — add it to any fund below, or spread it across several.`
        : routingGap < 0
          ? `That is ${Math.abs(routingGap).toFixed(2)}% over. Take it off one of the funds below.`
          : null

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
    // One reading of the field, used for the write AND for both optimistic rows below.
    // Parsed once because the Routing pane is fed from `alloc` and the Balances table from
    // `funds`: computing it twice is how the same fund came to show two minimums.
    const minimumCents = dollarsToCents(nfMinimum)
    startTransition(async () => {
      const result = await createFund({
        name: nfName,
        description: nfDesc,
        minimum_cents: minimumCents,
        open_contributions: nfOpen,
      })
      if (!result.success || !result.id) { setError(result.message ?? 'Failed'); return }
      // Optimistically show the new fund without a page refresh.
      const maxPriority = funds.reduce((m, f) => Math.max(m, f.priority), 0)
      const newFund: FundWithStats = {
        id: result.id,
        name: nfName.trim(),
        description: nfDesc.trim() || null,
        // Not asked for on create any more — see `nfMinimum`. Null is what the row holds.
        goal_cents: null,
        active: true,
        created_at: new Date().toISOString(),
        priority: maxPriority + 1,
        minimum_cents: minimumCents,
        open_contributions: nfOpen,
        // A fund created from this form is never a system fund; only the migration and
        // the families trigger make those.
        system_key: null,
        total_disbursed_cents: 0,
        total_contributed_cents: 0,
        net_transfers_cents: 0,
        balance_cents: 0,
        milestone_count: 0,
        allocation_bps: funds.length === 0 ? 10000 : 0,
      }
      setFunds(prev => [...prev, newFund])
      // THE MINIMUM CARRIES INTO THE ROUTING ROW. It used to be hard-coded '0.00' here,
      // so even once the value was stored the Routing pane went on showing zero for the
      // rest of the visit — and pressing Save there wrote that zero back over it.
      setAlloc(prev => [...prev, {
        fund_id: newFund.id,
        fund_name: newFund.name,
        percent: funds.length === 0 ? '100' : '0',
        minimum: (minimumCents / 100).toFixed(2),
      }])
      setNfName(''); setNfDesc(''); setNfMinimum(''); setNfOpen(false)
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
          >
            <div className="space-y-3 mt-2">
              <div className="space-y-1.5">
                <Label required>Name</Label>
                <Input value={nfName} onChange={e => setNfName(e.target.value)} placeholder="College Fund" autoFocus />
              </div>
              <div className="space-y-1.5">
                <Label>Minimum Balance ($, optional)</Label>
                <Input type="number" min="0" step="0.01" value={nfMinimum} onChange={e => setNfMinimum(e.target.value)} placeholder="5000.00" />
                <p className="text-xs text-muted-foreground">
                  What this fund is topped up to before any fund below it receives
                  anything. You can change it, and the order funds fill in, under
                  Funds&nbsp;→&nbsp;Routing.
                </p>
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
              <FormError message={error} />
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

          {/* A table, matching Member Directory: these are eight parallel figures per
              fund, and reading "Balance: X · Collected Y · Disbursed Z" as prose meant
              re-finding the same word on every row to compare two funds. */}
          {funds.length > 0 && (
            /* Six of the eight columns fold below `sm`; see
               components/ui/table-collapse.tsx. BALANCE is the one figure that stays,
               because it is the answer this screen exists to give — Collected,
               Disbursed and Transferred are how it got there, and the share and the
               minimum are configuration rather than position. All six are on the meta
               line, and labelled: six currency amounts in a row with no captions is
               exactly the prose this table replaced. */
            <div className="overflow-visible rounded-xl border">
              <table className="w-full border-collapse text-sm">
                <thead>
                  <tr className="border-b bg-muted/40 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    <th scope="col" className="px-3 py-2 font-semibold">Fund</th>
                    <th scope="col" className={cn('px-3 py-2 text-right font-semibold', COLLAPSING_CELL)}>% of dues</th>
                    <th scope="col" className="px-3 py-2 text-right font-semibold">Balance</th>
                    <th scope="col" className={cn('px-3 py-2 text-right font-semibold', COLLAPSING_CELL)}>Collected</th>
                    <th scope="col" className={cn('px-3 py-2 text-right font-semibold', COLLAPSING_CELL)}>Disbursed</th>
                    <th scope="col" className={cn('px-3 py-2 text-right font-semibold', COLLAPSING_CELL)}>Transferred</th>
                    <th scope="col" className={cn('px-3 py-2 text-right font-semibold', COLLAPSING_CELL)}>Minimum</th>
                    <th scope="col" className="px-3 py-2 font-semibold"><span className="sr-only">Actions</span></th>
                  </tr>
                </thead>
                <tbody>
                  {funds.map(f => (
                    <tr key={f.id} className="border-b align-top last:border-0 sm:align-middle">
                      <td className="px-3 py-2.5">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-medium">{f.name}</span>
                          {/* Says WHY there is no delete control on this row. A greyed-out
                              or absent button with no explanation reads as a bug. */}
                          {f.system_key && (
                            <span className="shrink-0 rounded-full bg-brand-soft px-2 py-0.5 text-[11px] font-medium text-brand-on-soft"
                              title="Created automatically. Holds every donation the family receives, can be given a share of dues like any other fund, and cannot be deleted or switched off.">
                              Built in
                            </span>
                          )}
                          {SHOW_OPEN_CONTRIBUTIONS && f.open_contributions && (
                            <span className="shrink-0 rounded-full bg-brand-affirm px-2 py-0.5 text-[11px] font-medium text-brand-on-affirm">Open</span>
                          )}
                        </div>
                        {f.description && <p className="text-xs text-muted-foreground">{f.description}</p>}
                        <RowMeta className="gap-x-2">
                          <MetaIf value={fmt(f.total_contributed_cents)} prefix="Collected" />
                          <MetaDot />
                          <MetaIf value={fmt(f.total_disbursed_cents)} prefix="Disbursed" />
                          {/* Only when there is one. On a fund that has never taken part
                              in a transfer this line would be a zero explaining nothing;
                              on one that has, its absence is the reason Collected minus
                              Disbursed no longer reaches the Balance beside it. */}
                          {f.net_transfers_cents !== 0 && (
                            <>
                              <MetaDot />
                              <MetaIf value={signedFmt(f.net_transfers_cents)} prefix="Transferred" />
                            </>
                          )}
                          {/* EVERY FUND SHOWS ITS SHARE SINCE 2026-08-20, the Donations fund
                              included. It was skipped here on the ground that it took none —
                              true until the routing table started listing it, and a fund that
                              can hold a share while its own row declines to print one is the
                              worst of the three states available. */}
                          <MetaDot />
                          <MetaIf
                            value={`${(f.allocation_bps / 100).toFixed(f.allocation_bps % 100 === 0 ? 0 : 2)}%`}
                            prefix="Share of dues"
                          />
                          {f.minimum_cents > 0 && (
                            <>
                              <MetaDot />
                              <MetaIf value={fmt(f.minimum_cents)} prefix="Minimum" />
                            </>
                          )}
                        </RowMeta>
                      </td>
                      <td className={cn('px-3 py-2.5 text-right whitespace-nowrap text-muted-foreground', COLLAPSING_CELL)}>
                        {/* NO LONGER AN EM-DASH FOR THE BUILT-IN FUND. It printed one while
                            the Donations fund was excluded from dues routing; since 2026-08-20
                            it can be given a share like any other, so it prints the share it
                            has — which is 0% until somebody sets one, and 0% is a fact rather
                            than an absence. */}
                        {`${(f.allocation_bps / 100).toFixed(f.allocation_bps % 100 === 0 ? 0 : 2)}%`}
                      </td>
                      <td className={cn('px-3 py-2.5 text-right font-medium whitespace-nowrap',
                        f.balance_cents >= 0 ? 'text-brand-affirm' : 'text-destructive')}>
                        {fmt(f.balance_cents)}
                      </td>
                      <td className={cn('px-3 py-2.5 text-right whitespace-nowrap text-muted-foreground', COLLAPSING_CELL)}>{fmt(f.total_contributed_cents)}</td>
                      <td className={cn('px-3 py-2.5 text-right whitespace-nowrap text-muted-foreground', COLLAPSING_CELL)}>{fmt(f.total_disbursed_cents)}</td>
                      {/* An em-dash for zero rather than "+$0.00": a fund that has never
                          taken part in a transfer has nothing to say here, and a column
                          of signed zeroes would drown the two rows that do. */}
                      <td className={cn('px-3 py-2.5 text-right whitespace-nowrap text-muted-foreground', COLLAPSING_CELL)}>
                        {f.net_transfers_cents === 0 ? '—' : signedFmt(f.net_transfers_cents)}
                      </td>
                      <td className={cn('px-3 py-2.5 text-right whitespace-nowrap text-muted-foreground', COLLAPSING_CELL)}>
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
          {!creatingFund && <FormError message={error} />}
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
                  <Label required>Fund</Label>
                  <Select value={nmFundId} onChange={e => setNmFundId(e.target.value)}>
                    <option value="">— Select fund —</option>
                    {funds.map(f => <option key={f.id} value={f.id}>{f.name}</option>)}
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label required>Milestone Name</Label>
                  <Input value={nmName} onChange={e => setNmName(e.target.value)} placeholder="Graduate high school" autoFocus />
                </div>
                <div className="space-y-1.5">
                  <Label required>Award Amount ($)</Label>
                  <Input type="number" min="0" step="0.01" value={nmAmount} onChange={e => setNmAmount(e.target.value)} placeholder="250.00" />
                </div>
                <div className="space-y-1.5">
                  <Label>Description</Label>
                  <Input value={nmDesc} onChange={e => setNmDesc(e.target.value)} placeholder="High school diploma or GED" />
                </div>
                <FormError message={error} />
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
            <div className="overflow-visible rounded-xl border">
              <table className="w-full border-collapse text-sm">
                <thead>
                  <tr className="border-b bg-muted/40 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    <th scope="col" className="px-3 py-2 font-semibold">Milestone</th>
                    <th scope="col" className={cn('px-3 py-2 font-semibold', COLLAPSING_CELL)}>Fund</th>
                    <th scope="col" className="px-3 py-2 text-right font-semibold">Award</th>
                    <th scope="col" className="px-3 py-2 font-semibold"><span className="sr-only">Actions</span></th>
                  </tr>
                </thead>
                <tbody>
                  {milestones.map(m => {
                    const fund = funds.find(f => f.id === m.fund_id)
                    return (
                      <tr key={m.id} className="border-b align-top last:border-0 sm:align-middle">
                        <td className="px-3 py-2.5">
                          <span className="font-medium">{m.name}</span>
                          {m.description && <p className="text-xs text-muted-foreground">{m.description}</p>}
                          <RowMeta>
                            <MetaIf value={fund?.name} prefix="Paid from" />
                          </RowMeta>
                        </td>
                        <td className={cn('px-3 py-2.5 text-muted-foreground', COLLAPSING_CELL)}>{fund?.name ?? '—'}</td>
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
          {!creatingMilestone && <FormError message={error} />}
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
              // The routing table is the one AGENTS.md names as the reason MainRail
              // replaced the 16rem left column — at `min-w-[480px]` it had nothing to
              // spare below about 1024px. Only Minimum folds: the ordinal is what says
              // funds fill in order, and it costs 20px.
              <div>
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b">
                      <th className="py-2 pr-3 text-left text-xs font-medium text-muted-foreground">#</th>
                      <th className="py-2 pr-3 text-left text-xs font-medium text-muted-foreground">Fund</th>
                      <th className="py-2 pr-3 text-right text-xs font-medium text-muted-foreground">Allocation</th>
                      <th className={cn('py-2 text-right text-xs font-medium text-muted-foreground', COLLAPSING_CELL)}>Minimum</th>
                    </tr>
                  </thead>
                  <tbody>
                    {alloc.map((a, i) => (
                      <tr key={a.fund_id} className="border-b align-top last:border-0 sm:align-middle">
                        <td className="py-2 pr-3 text-xs text-muted-foreground">{i + 1}</td>
                        <td className="py-2 pr-3 font-medium">
                          {a.fund_name}
                          <RowMeta>
                            <MetaIf value={fmt(dollarsToCents(a.minimum))} prefix="Minimum" />
                          </RowMeta>
                        </td>
                        <td className="py-2 pr-3 text-right">{(parseFloat(a.percent || '0') || 0).toFixed(2)}%</td>
                        <td className={cn('py-2 text-right', COLLAPSING_CELL)}>{fmt(dollarsToCents(a.minimum))}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              // ── Edit mode ──
              <>
                {/* Two INPUT columns plus a reorder control is what made this the
                    widest thing on Accounting. Minimum $ folds and its input moves into
                    the meta line — the input itself, not a description of it, so the
                    field is still editable on a phone. It is labelled there, because a
                    second number box under a percentage box with no caption is a coin
                    toss. Allocation % stays: it is the field this screen is for, and it
                    is the one that has to total 100. */}
                <div>
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b">
                        <th className="py-2 pr-3 text-left text-xs font-medium text-muted-foreground">Priority</th>
                        <th className="py-2 pr-3 text-left text-xs font-medium text-muted-foreground">Fund</th>
                        <th className="py-2 pr-3 text-left text-xs font-medium text-muted-foreground">Allocation&nbsp;%</th>
                        <th className={cn('py-2 text-left text-xs font-medium text-muted-foreground', COLLAPSING_CELL)}>Minimum&nbsp;$</th>
                      </tr>
                    </thead>
                    <tbody>
                      {alloc.map((a, i) => {
                        const minimumInput = (
                          <Input type="number" min="0" step="0.01" value={a.minimum}
                            onChange={e => setAllocField(a.fund_id, 'minimum', e.target.value)}
                            aria-label={`Minimum balance for ${a.fund_name}`}
                            className="h-8 w-28" />
                        )
                        return (
                        <tr key={a.fund_id} className="border-b align-top last:border-0 sm:align-middle">
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
                          <td className="py-2 pr-3 font-medium">
                            {a.fund_name}
                            <RowMeta className="flex-col items-start">
                              <span>Minimum $</span>
                              {minimumInput}
                            </RowMeta>
                          </td>
                          <td className="py-2 pr-3">
                            <Input type="number" min="0" max="100" step="0.01" value={a.percent}
                              onChange={e => setAllocField(a.fund_id, 'percent', e.target.value)}
                              aria-label={`Allocation percent for ${a.fund_name}`}
                              className="h-8 w-24" />
                          </td>
                          <td className={cn('py-2', COLLAPSING_CELL)}>
                            {minimumInput}
                          </td>
                        </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
                <div className="flex items-center gap-3 flex-wrap">
                  <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                    pctValid ? 'bg-brand-affirm text-brand-on-affirm' : 'bg-destructive/10 text-destructive'
                  }`}>
                    Total: {totalPct.toFixed(2)}%
                  </span>
                  {/* `--brand-withheld` rather than `--destructive`: being part-way through
                      entering percentages is not an error, and reporting a failure is
                      `form-message.tsx`'s job. The 0% case is quieter still — routing off is a
                      legitimate configuration, not a half-finished one. */}
                  {routingHint && (
                    <span className={`text-xs ${totalPct === 0 ? 'text-muted-foreground' : 'text-brand-withheld'}`}>
                      {routingHint}
                    </span>
                  )}
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

          <FormError message={error} />
          {routingMsg && <p className="text-sm text-muted-foreground">{routingMsg}</p>}
        </div>
      )}

    </div>
  )
}
