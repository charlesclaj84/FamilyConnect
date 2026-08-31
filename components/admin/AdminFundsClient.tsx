'use client'

import { useMemo, useState, useTransition } from 'react'
import { Trash2, Pencil, X, ChevronUp, ChevronDown } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Dialog } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select } from '@/components/ui/select'
import { useConfirm } from '@/components/ui/confirm'
import { COLLAPSING_CELL, RowMeta, MetaDot, MetaIf } from '@/components/ui/table-collapse'
import { SortTh, useTableSort } from '@/components/ui/sortable-header'
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
import { useT } from '@/components/layout/LocaleProvider'

// Member "open contributions" feature is hidden for now; flip to re-enable.
const SHOW_OPEN_CONTRIBUTIONS = false

/**
 * A transfer figure, with its direction on the front.
 *
 * Every other currency figure on this screen is a magnitude whose direction is the
 * column it sits in — Collected is in, Disbursed is out. Net transfers is the one that
 * can point either way for the same fund, so "$300" alone would be unreadable and
 * `formatCurrency(-30000, intl)` renders "-$300.00", which reads as a negative amount of
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
  const t = useT()
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

  // ── TWO OF THIS SCREEN'S FOUR TABLES SORT, AND THE OTHER TWO MUST NOT ─────────────
  // The dues-routing tables below — the view one and the edit one — are the WATERFALL, and
  // their row order is the datum: funds fill in the order the rows are in, the first column is
  // that ordinal, and the edit table's whole purpose is to change it. A heading that reordered
  // either would leave "move up" acting on a sequence the reader can no longer see, which is
  // the same reason `AdminGatheringTemplatesClient`'s step table is not sortable. Funds and
  // Milestones are unordered lists of records and sort freely.
  //
  // BOTH DEFAULT TO NAME, which is what `getFunds` (`.order('priority').order('name')`) and
  // `getFundMilestones` (`.order('sort_order')`) put on screen closely enough to be the same
  // first paint for any family that has not reordered its funds — and unlike the waterfall,
  // priority is not printed on THIS table, so nothing visible is displaced.
  //
  // EVERY FIGURE SORTS ON CENTS, never on `fmt(...)`. That is the money half of the rule this
  // pass is built on: "$9.00" sorts after "$10.00" as text, and this table has five currency
  // columns to get it wrong in. `% of dues` sorts on `allocation_bps` for the same reason —
  // the cell prints a percentage rounded to two places, so two funds at 12.5% and 12.504% look
  // identical and must still order deterministically.
  //
  // A MILESTONE'S FUND IS COMPOSED IN THE BROWSER, which is AGENTS.md's third rule for a
  // conversion and the reason `milestoneRows` below exists: where a column is composed rather
  // than carried on the row, the ORDER has to be built from the same value the text is, or
  // the two disagree. A milestone whose fund is missing prints an em-dash and sorts as a
  // blank, which is the same absence stated twice.
  const fundSort = useTableSort(funds, {
    fund: f => f.name,
    share: f => f.allocation_bps,
    balance: f => f.balance_cents,
    collected: f => f.total_contributed_cents,
    disbursed: f => f.total_disbursed_cents,
    transferred: f => f.net_transfers_cents,
    minimum: f => f.minimum_cents,
  }, 'fund')

  // THE FUND NAME IS COMPOSED ONTO THE ROW, and it has to be. `FundMilestone` carries only
  // `fund_id`, so the Fund column resolves out of `funds` — and `useTableSort`'s memo depends
  // on the array it is given, not on the extractor map (its header has the argument). This
  // panel edits funds optimistically, so renaming one would change every name in that column
  // while leaving `milestones` untouched: the cells would re-render and the order would keep
  // the old names. A memo that lists `funds` is what keeps the two together.
  const milestoneRows = useMemo(
    () => milestones.map(m => ({
      ...m,
      fundName: funds.find(f => f.id === m.fund_id)?.name ?? null,
    })),
    [milestones, funds],
  )

  const milestoneSort = useTableSort(milestoneRows, {
    milestone: m => m.name,
    fund: m => m.fundName,
    award: m => m.amount_cents,
  }, 'milestone')
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
      ? t('fnd.routingOff')
      : routingGap > 0
        ? t('fnd.routingGapUnder', { percent: routingGap.toFixed(2) })
        : routingGap < 0
          ? t('fnd.routingGapOver', { percent: Math.abs(routingGap).toFixed(2) })
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
      title: t('fnd.saveRouting'),
      description: t('fnd.saveRoutingConfirm'),
      confirmLabel: t('fnd.saveRouting'),
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
      setRoutingMsg(res.success ? t('fnd.routingSaved') : (res.message ?? t('fnd.saveFailed')))
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
    if (!nfName) { setError(t('fnd.nameRequired')); return }
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
      if (!result.success || !result.id) { setError(result.message ?? t('action.failed')); return }
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
      title: t('fnd.delete'),
      description: fund
        ? t('fnd.deleteNamedBody', {
            name: fund.name, balance: fmt(fund.balance_cents),
          })
        : t('fnd.deleteBody'),
      confirmLabel: t('fnd.delete'),
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
      title: next ? t('fnd.openToContrib') : t('fnd.closeToContrib'),
      description: next
        ? t('fnd.openNamedBody', { name: fund.name })
        : t('fnd.closeNamedBody', { name: fund.name }),
      confirmLabel: next ? t('fnd.openFund') : t('fnd.closeFund'),
      destructive: !next,
    })
    if (!ok) return
    setFunds(prev => prev.map(f => f.id === fund.id ? { ...f, open_contributions: next } : f))
    startTransition(async () => {
      const res = await updateFund(fund.id, { open_contributions: next })
      if (!res.success) {
        setError(res.message ?? t('action.failed'))
        setFunds(prev => prev.map(f => f.id === fund.id ? { ...f, open_contributions: !next } : f))
      }
    })
  }

  function handleCreateMilestone() {
    if (!nmFundId || !nmName || !nmAmount) { setError(t('fnd.needAll')); return }
    setError('')
    startTransition(async () => {
      const result = await createMilestone(nmFundId, {
        name: nmName,
        description: nmDesc,
        amount_cents: Math.round(parseFloat(nmAmount) * 100),
      })
      if (!result.success || !result.milestone) { setError(result.message ?? t('action.failed')); return }
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
      title: t('fnd.deleteMilestone'),
      description: milestone
        ? t('fnd.deleteMilestoneNamedBody', {
            name: milestone.name, amount: fmt(milestone.amount_cents),
          })
        : t('fnd.deleteMilestoneBody'),
      confirmLabel: t('fnd.deleteMilestone'),
      destructive: true,
    })
    if (!ok) return
    startTransition(async () => {
      const result = await deleteMilestone(id)
      if (!result.success) { setError(result.message ?? t('action.failed')); return }
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
            <p className="text-sm text-muted-foreground">{t('fnd.none')}</p>
          )}

          <Dialog
            open={creatingFund}
            onClose={onCloseCreate}
            title={t('acct.newFund')}
            description={t('fnd.newFundHint')}
          >
            <div className="space-y-3 mt-2">
              <div className="space-y-1.5">
                <Label required>{t('field.name')}</Label>
                <Input value={nfName} onChange={e => setNfName(e.target.value)} placeholder={t('fnd.namePh')} autoFocus />
              </div>
              <div className="space-y-1.5">
                <Label>{t('fnd.minBalance')}</Label>
                <Input type="number" min="0" step="0.01" value={nfMinimum} onChange={e => setNfMinimum(e.target.value)} placeholder={t('fnd.minPh')} />
                <p className="text-xs text-muted-foreground">{t('adm.whatFundToppedUp')}</p>
              </div>
              <div className="space-y-1.5">
                <Label>{t('common.description')}</Label>
                <Input value={nfDesc} onChange={e => setNfDesc(e.target.value)} placeholder={t('fnd.descPh')} />
              </div>
              {SHOW_OPEN_CONTRIBUTIONS && (
                <label className="flex items-center gap-2 text-sm cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={nfOpen}
                    onChange={e => setNfOpen(e.target.checked)}
                    className="h-4 w-4 rounded border-input accent-primary"
                  />
                  {t('fnd.openToMembers')}
                  <span className="text-xs text-muted-foreground">(any family member can contribute any amount)</span>
                </label>
              )}
              <FormError message={error} />
              <div className="flex gap-2 pt-1">
                <Button className="flex-1" onClick={handleCreateFund} disabled={isPending}>
                  {isPending ? t('action.adding') : t('fnd.addFund')}
                </Button>
                <Button variant="outline" onClick={onCloseCreate} disabled={isPending}>
                  {t('action.cancel')}
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
                    <SortTh label={t('fnd.fund')} {...fundSort.sortProps('fund')} className="px-3 py-2 font-semibold" />
                    {/* WAS THE LITERAL "% of dues", which was English in all three languages —
                        the lone-heading class AGENTS.md says `i18n:literals` structurally
                        cannot see. `fnd.shareOfDuesPrefix` is the key the `RowMeta` line
                        already labels this same figure with, so the heading and its folded
                        copy now read identically instead of being two words for one fact. */}
                    <SortTh label={t('fnd.shareOfDuesPrefix')} align="right" {...fundSort.sortProps('share')} className={cn('px-3 py-2 font-semibold', COLLAPSING_CELL)} />
                    <SortTh label={t('fnd.balance')} align="right" {...fundSort.sortProps('balance')} className="px-3 py-2 font-semibold" />
                    <SortTh label={t('fnd.collected')} align="right" {...fundSort.sortProps('collected')} className={cn('px-3 py-2 font-semibold', COLLAPSING_CELL)} />
                    <SortTh label={t('fnd.disbursed')} align="right" {...fundSort.sortProps('disbursed')} className={cn('px-3 py-2 font-semibold', COLLAPSING_CELL)} />
                    <SortTh label={t('fnd.transferred')} align="right" {...fundSort.sortProps('transferred')} className={cn('px-3 py-2 font-semibold', COLLAPSING_CELL)} />
                    <SortTh label={t('fnd.minimum')} align="right" {...fundSort.sortProps('minimum')} className={cn('px-3 py-2 font-semibold', COLLAPSING_CELL)} />
                    <th scope="col" className="px-3 py-2 font-semibold"><span className="sr-only">{t('money.actions')}</span></th>
                  </tr>
                </thead>
                <tbody>
                  {fundSort.rows.map(f => (
                    <tr key={f.id} className="border-b align-top last:border-0 sm:align-middle">
                      <td className="px-3 py-2.5">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-medium">{f.name}</span>
                          {/* Says WHY there is no delete control on this row. A greyed-out
                              or absent button with no explanation reads as a bug. */}
                          {f.system_key && (
                            <span className="shrink-0 rounded-full bg-brand-soft px-2 py-0.5 text-[11px] font-medium text-brand-on-soft"
                              title={t('fnd.donationsFundHint')}>
                              {t('fnd.builtIn')}
                            </span>
                          )}
                          {SHOW_OPEN_CONTRIBUTIONS && f.open_contributions && (
                            <span className="shrink-0 rounded-full bg-brand-affirm px-2 py-0.5 text-[11px] font-medium text-brand-on-affirm">{t('fnd.open')}</span>
                          )}
                        </div>
                        {f.description && <p className="text-xs text-muted-foreground">{f.description}</p>}
                        <RowMeta className="gap-x-2">
                          <MetaIf value={fmt(f.total_contributed_cents)} prefix={t('fnd.collected')} />
                          <MetaDot />
                          <MetaIf value={fmt(f.total_disbursed_cents)} prefix={t('fnd.disbursed')} />
                          {/* Only when there is one. On a fund that has never taken part
                              in a transfer this line would be a zero explaining nothing;
                              on one that has, its absence is the reason Collected minus
                              Disbursed no longer reaches the Balance beside it. */}
                          {f.net_transfers_cents !== 0 && (
                            <>
                              <MetaDot />
                              <MetaIf value={signedFmt(f.net_transfers_cents)} prefix={t('fnd.transferred')} />
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
                            prefix={t('fnd.shareOfDuesPrefix')}
                          />
                          {f.minimum_cents > 0 && (
                            <>
                              <MetaDot />
                              <MetaIf value={fmt(f.minimum_cents)} prefix={t('fnd.minimum')} />
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
                              {f.open_contributions ? t('fnd.openToMembersShort') : t('fnd.makeOpen')}
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
            <p className="text-sm text-muted-foreground">{t('fnd.createFirst')}</p>
          )}
          {funds.length > 0 && milestones.length === 0 && (
            <p className="text-sm text-muted-foreground">{t('fnd.noMilestones')}</p>
          )}

          <Dialog
            open={creatingMilestone}
            onClose={onCloseCreate}
            title={t('acct.newMilestone')}
            description={t('fnd.newMilestoneHint')}
          >
            {/* The rail's trigger is always live, so the "no fund yet" case has to be
                answered in here — where the live fund list is — rather than by a
                disabled button the admin cannot interrogate. */}
            {funds.length === 0 ? (
              <div className="space-y-3 mt-2">
                <p className="text-sm text-muted-foreground">{t('adm.milestoneAwardedOutFund')}</p>
                <Button variant="outline" onClick={onCloseCreate}>{t('action.close')}</Button>
              </div>
            ) : (
              <div className="space-y-3 mt-2">
                <div className="space-y-1.5">
                  <Label required>{t('fnd.fund')}</Label>
                  <Select value={nmFundId} onChange={e => setNmFundId(e.target.value)}>
                    <option value="">— Select fund —</option>
                    {funds.map(f => <option key={f.id} value={f.id}>{f.name}</option>)}
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label required>{t('fnd.milestoneName')}</Label>
                  <Input value={nmName} onChange={e => setNmName(e.target.value)} placeholder={t('fnd.milestonePh')} autoFocus />
                </div>
                <div className="space-y-1.5">
                  <Label required>{t('fnd.awardAmount')}</Label>
                  <Input type="number" min="0" step="0.01" value={nmAmount} onChange={e => setNmAmount(e.target.value)} placeholder={t('fnd.awardPh')} />
                </div>
                <div className="space-y-1.5">
                  <Label>{t('common.description')}</Label>
                  <Input value={nmDesc} onChange={e => setNmDesc(e.target.value)} placeholder={t('fnd.milestoneDescPh')} />
                </div>
                <FormError message={error} />
                <div className="flex gap-2 pt-1">
                  <Button className="flex-1" onClick={handleCreateMilestone} disabled={isPending}>
                    {isPending ? t('action.adding') : t('fnd.addMilestone')}
                  </Button>
                  <Button variant="outline" onClick={onCloseCreate} disabled={isPending}>
                    {t('action.cancel')}
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
                    <SortTh label={t('fnd.milestone')} {...milestoneSort.sortProps('milestone')} className="px-3 py-2 font-semibold" />
                    <SortTh label={t('fnd.fund')} {...milestoneSort.sortProps('fund')} className={cn('px-3 py-2 font-semibold', COLLAPSING_CELL)} />
                    <SortTh label={t('fnd.award')} align="right" {...milestoneSort.sortProps('award')} className="px-3 py-2 font-semibold" />
                    <th scope="col" className="px-3 py-2 font-semibold"><span className="sr-only">{t('money.actions')}</span></th>
                  </tr>
                </thead>
                <tbody>
                  {milestoneSort.rows.map(m => {
                    // `m.fundName`, resolved once in `milestoneRows` above, rather than a
                    // second `funds.find` here. Both copies would agree today and the point
                    // is that they cannot drift: the column's ORDER and the two places its
                    // text is drawn are now one value.
                    return (
                      <tr key={m.id} className="border-b align-top last:border-0 sm:align-middle">
                        <td className="px-3 py-2.5">
                          <span className="font-medium">{m.name}</span>
                          {m.description && <p className="text-xs text-muted-foreground">{m.description}</p>}
                          <RowMeta>
                            <MetaIf value={m.fundName ?? undefined} prefix={t('fnd.paidFromPrefix')} />
                          </RowMeta>
                        </td>
                        <td className={cn('px-3 py-2.5 text-muted-foreground', COLLAPSING_CELL)}>{m.fundName ?? '—'}</td>
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
                <h3 className="text-sm font-semibold">{t('fnd.duesRouting')}</h3>
                <p className="text-xs text-muted-foreground mt-0.5">{t('adm.setShareEachDues')}</p>
              </div>
              {alloc.length > 0 && !editingRouting && mayEditRouting && (
                <Button size="sm" variant="outline" onClick={startEditRouting}>
                  <Pencil className="h-3.5 w-3.5" /> {t('action.edit')}
                </Button>
              )}
            </div>
            {alloc.length === 0 ? (
              <p className="text-sm text-muted-foreground">{t('fnd.createFirstRouting')}</p>
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
                      <th className="py-2 pr-3 text-left text-xs font-medium text-muted-foreground">{t('fnd.fund')}</th>
                      <th className="py-2 pr-3 text-right text-xs font-medium text-muted-foreground">{t('fnd.allocation')}</th>
                      <th className={cn('py-2 text-right text-xs font-medium text-muted-foreground', COLLAPSING_CELL)}>{t('fnd.minimum')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {alloc.map((a, i) => (
                      <tr key={a.fund_id} className="border-b align-top last:border-0 sm:align-middle">
                        <td className="py-2 pr-3 text-xs text-muted-foreground">{i + 1}</td>
                        <td className="py-2 pr-3 font-medium">
                          {a.fund_name}
                          <RowMeta>
                            <MetaIf value={fmt(dollarsToCents(a.minimum))} prefix={t('fnd.minimum')} />
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
                        <th className="py-2 pr-3 text-left text-xs font-medium text-muted-foreground">{t('fnd.priority')}</th>
                        <th className="py-2 pr-3 text-left text-xs font-medium text-muted-foreground">{t('fnd.fund')}</th>
                        <th className="py-2 pr-3 text-left text-xs font-medium text-muted-foreground">{t('fnd.allocationPct')}</th>
                        <th className={cn('py-2 text-left text-xs font-medium text-muted-foreground', COLLAPSING_CELL)}>{t('fnd.minimumDollars')}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {alloc.map((a, i) => {
                        const minimumInput = (
                          <Input type="number" min="0" step="0.01" value={a.minimum}
                            onChange={e => setAllocField(a.fund_id, 'minimum', e.target.value)}
                            aria-label={t('fnd.minimumBalanceFor', { fund: a.fund_name })}
                            className="h-8 w-28" />
                        )
                        return (
                        <tr key={a.fund_id} className="border-b align-top last:border-0 sm:align-middle">
                          <td className="py-2 pr-3">
                            <div className="flex items-center gap-1">
                              <span className="text-xs text-muted-foreground w-4 text-center">{i + 1}</span>
                              <button
                                type="button"
                                aria-label={t('fnd.moveUp')}
                                disabled={i === 0 || isPending}
                                onClick={() => moveAlloc(i, -1)}
                                className="rounded p-0.5 text-muted-foreground hover:text-foreground disabled:opacity-30 disabled:pointer-events-none"
                              >
                                <ChevronUp className="h-4 w-4" />
                              </button>
                              <button
                                type="button"
                                aria-label={t('fnd.moveDown')}
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
                              <span>{t('fnd.minimumDollarsPlain')}</span>
                              {minimumInput}
                            </RowMeta>
                          </td>
                          <td className="py-2 pr-3">
                            <Input type="number" min="0" max="100" step="0.01" value={a.percent}
                              onChange={e => setAllocField(a.fund_id, 'percent', e.target.value)}
                              aria-label={t('fnd.allocationPercentFor', { fund: a.fund_name })}
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
                    {isPending ? t('action.saving') : t('fnd.saveRoutingAction')}
                  </Button>
                  <Button size="sm" variant="ghost" onClick={cancelEditRouting} disabled={isPending}>
                    <X className="h-3.5 w-3.5" /> {t('action.cancel')}
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
