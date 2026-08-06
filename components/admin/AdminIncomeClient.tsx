'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Trash2, Pencil, X, DollarSign } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Dialog } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select } from '@/components/ui/select'
import { useConfirm } from '@/components/ui/confirm'
import { cn } from '@/lib/utils'
import { disambiguatedName } from '@/lib/name-utils'
import { formatCurrency as formatDollars } from '@/lib/currency-utils'
import { formatDate } from '@/lib/date-utils'
import { PAYMENT_METHODS } from '@/lib/payment-methods'
import { SCHEDULE_KINDS, type ScheduleKind } from '@/lib/dues-utils'
import { useServerState } from '@/lib/use-server-state'
import {
  createDuesSchedule, updateDuesSchedule, recordPayment, deleteDuesSchedule,
  type DuesSchedule, type DuesPayment,
} from '@/app/actions/dues'
import { isIncomeSection, type AccountSection } from '@/components/admin/account-sections'

interface Person { id: string; first_name: string; last_name: string; nick_name?: string | null; date_of_birth?: string | null }

interface Props {
  /** Which section the shell is showing. This component renders only its own. */
  section: AccountSection
  /** The live section, for handlers that jump after an await. See handleRecordPayment. */
  sectionRef: React.RefObject<AccountSection>
  onNavigate: (next: AccountSection) => void
  /**
   * Which kind of schedule the create dialog is open for, or null for closed. One
   * prop rather than two booleans because there is one form: the Dues and Donations
   * pages differ in the wording around it and in the `kind` it writes, nothing else.
   * Owned by the shell, which renders both triggers in the sub-nav.
   */
  creatingKind: ScheduleKind | null
  onCloseCreate: () => void
  initialSchedules: DuesSchedule[]
  initialPayments: DuesPayment[]
  members: Person[]
}

const FREQ_OPTIONS = ['annual', 'semi-annual', 'quarterly', 'monthly', 'one-time']

/**
 * Wording that differs between the two kinds. Everything else about them — the CRUD,
 * the list, the edit row, the payment form — is shared, which is the whole reason
 * donations are a `kind` on dues_schedules rather than a parallel feature.
 */
const KIND_COPY: Record<ScheduleKind, {
  noun: string
  title: string
  blurb: string
  empty: string
  labelPlaceholder: string
  amountPlaceholder: string
}> = {
  dues: {
    noun: 'dues',
    title: 'New Dues',
    blurb: 'Dues every member of the family owes on this cadence.',
    empty: 'No dues yet.',
    labelPlaceholder: 'Annual Dues',
    amountPlaceholder: '25.00',
  },
  donation: {
    noun: 'donation',
    title: 'New Donation',
    blurb: 'A drive members can give to between two dates. Nobody owes it, and it never counts against a member’s balance.',
    empty: 'No donations yet.',
    labelPlaceholder: 'Scholarship Drive',
    amountPlaceholder: '500.00',
  },
}

export function AdminIncomeClient({
  section, sectionRef, onNavigate, creatingKind, onCloseCreate,
  initialSchedules, initialPayments, members,
}: Props) {
  const router = useRouter()
  const confirm = useConfirm()
  // `useServerState`, not `useState`: the shell keeps this panel mounted across
  // section switches, so a plain initializer would be read exactly once per visit and
  // every later server render ignored — which is why a freshly added schedule used to
  // show up only after leaving the page.
  const [schedules, setSchedules] = useServerState(initialSchedules)
  const [payments, setPayments] = useServerState(initialPayments)
  // Section lives in AdminAccountShell now. Aliased to `tab` so every panel guard
  // below stays identical to the tab-strip version.
  const tab: AccountSection = section
  const [error, setError] = useState('')
  const [isPending, startTransition] = useTransition()

  // ── New schedule form ──
  // Lives in a modal opened from the sub-nav, but its fields stay on the component:
  // closing the dialog (or switching section) keeps whatever was typed, the same way
  // the inline card used to. Only a successful create clears them.
  const [nsLabel, setNsLabel] = useState('')
  const [nsAmount, setNsAmount] = useState('')
  const [nsGoal, setNsGoal] = useState('')
  const [nsFreq, setNsFreq] = useState('annual')
  const [nsStartDate, setNsStartDate] = useState('')
  const [nsEndDate, setNsEndDate] = useState('')
  const [nsDescription, setNsDescription] = useState('')

  // ── Edit schedule ──
  // `editKind` fixes which fields the open editor shows to the row being edited, not
  // to the page — they are always the same page today, but the row is the truth.
  const [editId, setEditId] = useState<string | null>(null)
  const [editKind, setEditKind] = useState<ScheduleKind>('dues')
  const [editLabel, setEditLabel] = useState('')
  const [editAmount, setEditAmount] = useState('')
  const [editGoal, setEditGoal] = useState('')
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

  // The deleted tab strip cleared `error` on every tab click; this preserves that.
  // Adjusted during render rather than in an effect on purpose — an effect runs
  // after paint, which would flash a Record Payment validation message inside the
  // New Schedule dialog for a frame. Hooks above are all called unconditionally, so
  // this bare `if` does not affect hook order.
  const [prevSection, setPrevSection] = useState(section)
  if (prevSection !== section) {
    setPrevSection(section)
    setError('')
  }

  // Same trick for the dialog: its trigger belongs to the shell, so this component
  // never sees the click that opens it and cannot clear a stale message there.
  const [prevCreating, setPrevCreating] = useState(creatingKind)
  if (prevCreating !== creatingKind) {
    setPrevCreating(creatingKind)
    setError('')
  }

  // Which kind this pane is showing. The Dues and Donations pages are the same list
  // over the same table, split by kind — so one block renders both, and `copy`
  // carries every word that differs.
  const kind: ScheduleKind = tab === 'donations' ? 'donation' : 'dues'
  const copy = KIND_COPY[creatingKind ?? kind]
  const visibleSchedules = schedules.filter(s => s.kind === kind)

  function startEdit(s: DuesSchedule) {
    setEditId(s.id)
    setEditKind(s.kind)
    setEditLabel(s.label)
    setEditAmount((s.amount_cents / 100).toFixed(2))
    setEditGoal(s.goal_cents ? (s.goal_cents / 100).toFixed(2) : '')
    setEditFreq(s.frequency)
    setEditStartDate(s.start_date ?? '')
    setEditEndDate(s.end_date ?? '')
    setEditDescription(s.description ?? '')
    setError('')
  }

  function cancelEdit() { setEditId(null); setError('') }

  async function handleSaveEdit() {
    if (!editId || !editLabel) { setError('Label required'); return }
    // Keyed off the ROW's kind, not the pane's: the row is what is being saved.
    const isDonation = editKind === 'donation'
    if (isDonation && !editGoal) { setError('A donation needs a goal'); return }
    if (!isDonation && !editAmount) { setError('Amount required'); return }

    const goalCents = editGoal ? Math.round(parseFloat(editGoal) * 100) : null
    const amountCents = Math.round(parseFloat(editAmount || '0') * 100)
    const ok = await confirm({
      title: `Save ${KIND_COPY[editKind].noun}`,
      description: isDonation
        ? `Apply your edits to "${editLabel}" (goal ${formatDollars(goalCents ?? 0)})?`
        : `Apply your edits to "${editLabel}" (${formatDollars(amountCents)} ${editFreq})?`,
      confirmLabel: 'Save changes',
    })
    if (!ok) return
    setError('')
    startTransition(async () => {
      // Only the fields this kind owns go over the wire. The action pins the rest
      // regardless, but sending an amount for a donation would be asking it to
      // ignore us.
      const changes = isDonation
        ? { goal_cents: goalCents }
        : { amount_cents: amountCents, frequency: editFreq }
      const result = await updateDuesSchedule(editId, {
        label: editLabel,
        start_date: editStartDate || null,
        end_date: editEndDate || null,
        description: editDescription.trim() || null,
        ...changes,
      })
      if (!result.success) { setError(result.message ?? 'Failed'); return }
      setSchedules(prev => prev.map(s => s.id === editId
        ? {
            ...s,
            label: editLabel,
            start_date: editStartDate || null,
            end_date: editEndDate || null,
            description: editDescription || null,
            ...changes,
          }
        : s
      ))
      setEditId(null)
    })
  }

  function handleCreateSchedule() {
    // The dialog cannot be open without a kind, but read it once so the closure that
    // runs after the await cannot see a different one.
    const newKind = creatingKind ?? 'dues'
    const isDonation = newKind === 'donation'
    if (!nsLabel) { setError('Label required'); return }
    if (isDonation && !nsGoal) { setError('A donation needs a goal'); return }
    if (!isDonation && !nsAmount) { setError('Amount required'); return }
    setError('')
    startTransition(async () => {
      const result = await createDuesSchedule({
        label: nsLabel,
        // A donation asks for nothing per period and does not recur; the action pins
        // both of these itself, and passing them keeps the type honest.
        amount_cents: isDonation ? 0 : Math.round(parseFloat(nsAmount) * 100),
        frequency: isDonation ? 'one-time' : nsFreq,
        goal_cents: isDonation ? Math.round(parseFloat(nsGoal) * 100) : null,
        due_month: null,
        due_day: null,
        start_date: nsStartDate || null,
        end_date: nsEndDate || null,
        description: nsDescription.trim() || null,
        kind: newKind,
      })
      if (!result.success || !result.schedule) { setError(result.message ?? 'Failed'); return }
      // Show it straight away, in the server's order (`getDuesSchedules` sorts by
      // label), so the list reads the same before and after the next refresh.
      const created = result.schedule
      setSchedules(prev => [...prev, created].sort((a, b) => a.label.localeCompare(b.label)))
      setNsLabel(''); setNsAmount(''); setNsGoal(''); setNsStartDate(''); setNsEndDate(''); setNsDescription('')
      onCloseCreate()
    })
  }

  async function handleDeleteSchedule(id: string) {
    const schedule = schedules.find(s => s.id === id)
    // Named from the row's own kind, not the pane's, so the confirm can never say
    // "dues" over a donation.
    const noun = KIND_COPY[schedule?.kind ?? 'dues'].noun
    const ok = await confirm({
      title: `Delete ${noun}`,
      description: schedule
        ? `Delete the ${noun} "${schedule.label}" (${formatDollars(schedule.amount_cents)} ${schedule.frequency})? This cannot be undone.`
        : `Delete this ${noun}? This cannot be undone.`,
      confirmLabel: `Delete ${noun}`,
      destructive: true,
    })
    if (!ok) return
    startTransition(async () => { await deleteDuesSchedule(id); setSchedules(prev => prev.filter(s => s.id !== id)) })
  }

  function handleRecordPayment() {
    // Schedule is required: an unattached payment never reaches a member's dues
    // summary (getMyDuesSummary buckets by schedule_id), so it would look recorded
    // to the admin and missing to the member.
    if (!rpPersonId || !rpScheduleId || !rpAmount) { setError('Member, schedule and amount required'); return }
    setError('')
    startTransition(async () => {
      const result = await recordPayment({
        person_id: rpPersonId,
        schedule_id: rpScheduleId,
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
        schedule_id: rpScheduleId,
        schedule_label: schedule?.label ?? null,
        schedule_kind: schedule?.kind ?? null,
        amount_cents: cents,
        status: rpStatus,
        payment_date: rpDate,
        payment_method: rpMethod || null,
        notes: rpNotes || null,
        created_at: new Date().toISOString(),
      }, ...prev])
      setRpPersonId(''); setRpAmount(''); setRpScheduleId(''); setRpNotes('')
      // Jump to the history so the new row is visible — but only if the admin is
      // still somewhere in Income. The save is awaited, so by now they may have moved
      // to Funds or Settings, and yanking the whole page there would be new
      // behavior the two independent tab strips could not produce.
      if (isIncomeSection(sectionRef.current)) onNavigate('payments')
      // Refresh server data so fund balances (routed payments) update too.
      router.refresh()
    })
  }

  if (!isIncomeSection(section)) return null

  return (
    <div className="space-y-6">
      {/* Dues and Donations are one pane: the same table, the same CRUD, the same
          edit row — split by `kind` and worded by KIND_COPY. The list is the page;
          adding one is an occasional act, so the form is a dialog opened from the
          sub-nav rather than a card above the thing being read. */}
      {(tab === 'dues' || tab === 'donations') && (
        <div className="space-y-4">
          {visibleSchedules.length === 0 && (
            <p className="text-sm text-muted-foreground">{KIND_COPY[kind].empty}</p>
          )}

          <Dialog
            open={creatingKind !== null}
            onClose={onCloseCreate}
            title={copy.title}
            description={copy.blurb}
            className="max-w-lg max-h-[90vh] overflow-y-auto"
          >
            <div className="space-y-3 mt-2">
              <div className="space-y-1.5">
                <Label>Label <span className="text-destructive">*</span></Label>
                <Input value={nsLabel} onChange={e => setNsLabel(e.target.value)} placeholder={copy.labelPlaceholder} autoFocus />
              </div>
              {/* The one place the two kinds really differ. Dues state what is owed
                  and how often; a donation states a target and nothing else, because
                  it asks for no particular amount and does not recur. */}
              {creatingKind === 'donation' ? (
                <div className="space-y-1.5">
                  <Label>Goal ($) <span className="text-destructive">*</span></Label>
                  <Input type="number" min="0" step="0.01" value={nsGoal} onChange={e => setNsGoal(e.target.value)} placeholder={copy.amountPlaceholder} />
                  <p className="text-xs text-muted-foreground">
                    What each member is encouraged to reach. Advisory — members give what they
                    like, and may go past it.
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label>Amount ($) <span className="text-destructive">*</span></Label>
                    <Input type="number" min="0" step="0.01" value={nsAmount} onChange={e => setNsAmount(e.target.value)} placeholder={copy.amountPlaceholder} />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Frequency</Label>
                    <Select value={nsFreq} onChange={e => setNsFreq(e.target.value)}>
                      {FREQ_OPTIONS.map(f => <option key={f} value={f}>{f.charAt(0).toUpperCase() + f.slice(1)}</option>)}
                    </Select>
                  </div>
                </div>
              )}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label>{creatingKind === 'donation' ? 'Opens' : 'Start Date (optional)'}</Label>
                  <Input type="date" value={nsStartDate} onChange={e => setNsStartDate(e.target.value)} />
                </div>
                <div className="space-y-1.5">
                  <Label>{creatingKind === 'donation' ? 'Closes' : 'End Date (optional)'}</Label>
                  <Input type="date" value={nsEndDate} onChange={e => setNsEndDate(e.target.value)} />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label>Description (optional)</Label>
                <Input value={nsDescription} onChange={e => setNsDescription(e.target.value)} placeholder={`What this ${copy.noun} is for…`} />
              </div>
              {error && <p className="text-sm text-destructive">{error}</p>}
              <div className="flex gap-2 pt-1">
                <Button className="flex-1" onClick={handleCreateSchedule} disabled={isPending}>
                  {isPending ? 'Adding…' : copy.title.replace('New', 'Add')}
                </Button>
                <Button variant="outline" onClick={onCloseCreate} disabled={isPending}>
                  Cancel
                </Button>
              </div>
            </div>
          </Dialog>

          {visibleSchedules.length > 0 && (
            <ul className="divide-y rounded-xl border overflow-hidden">
              {visibleSchedules.map(s => (
                <li key={s.id}>
                  {editId === s.id ? (
                    <div className="px-4 py-3 space-y-3 bg-muted/30">
                      {/* Mirrors the create dialog: a donation edits its goal, dues
                          edit amount and frequency. */}
                      {editKind === 'donation' ? (
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                          <div className="space-y-1.5">
                            <Label>Label</Label>
                            <Input value={editLabel} onChange={e => setEditLabel(e.target.value)} />
                          </div>
                          <div className="space-y-1.5">
                            <Label>Goal ($)</Label>
                            <Input type="number" min="0" step="0.01" value={editGoal} onChange={e => setEditGoal(e.target.value)} />
                          </div>
                        </div>
                      ) : (
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
                      )}
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div className="space-y-1.5">
                          <Label>{editKind === 'donation' ? 'Opens' : 'Start Date'}</Label>
                          <Input type="date" value={editStartDate} onChange={e => setEditStartDate(e.target.value)} />
                        </div>
                        <div className="space-y-1.5">
                          <Label>{editKind === 'donation' ? 'Closes' : 'End Date'}</Label>
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
                        {/* Description on hover, matching how a member sees the same
                            field in My Summary. Underlined only when there is
                            one, so the hint never promises an empty tooltip. */}
                        <p
                          className={cn('text-sm font-medium', s.description && 'w-fit cursor-help underline decoration-dotted decoration-muted-foreground/50 underline-offset-2')}
                          title={s.description ?? undefined}
                        >
                          {s.label}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {s.kind === 'donation'
                            ? `Goal ${formatDollars(s.goal_cents ?? 0)}`
                            : `${formatDollars(s.amount_cents)} — ${s.frequency}`}
                          {s.start_date && ` · from ${formatDate(s.start_date)}`}
                          {s.end_date && ` to ${formatDate(s.end_date)}`}
                        </p>
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
                      {p.schedule_label ?? 'No schedule'}
                      {/* One ledger for both kinds, so each row says which it was. */}
                      {p.schedule_kind && ` (${p.schedule_kind === 'donation' ? 'Donation' : 'Dues'})`}
                      {' · '}{formatDate(p.payment_date)}
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

      {tab === 'record-payment' && (
        <div className="rounded-xl border bg-card p-4 space-y-4 max-w-md">
          <div className="space-y-1.5">
            <Label>Member <span className="text-destructive">*</span></Label>
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
            <Label>Schedule <span className="text-destructive">*</span></Label>
            {/* Grouped, not merged: the two kinds are indistinguishable by label
                alone, and posting a member's dues against a donation (or the other
                way round) is invisible afterwards. */}
            <Select value={rpScheduleId} onChange={e => setRpScheduleId(e.target.value)}>
              <option value="">— Select schedule —</option>
              {SCHEDULE_KINDS.map(k => {
                const forKind = schedules.filter(s => s.kind === k)
                if (forKind.length === 0) return null
                return (
                  <optgroup key={k} label={k === 'dues' ? 'Dues' : 'Donations'}>
                    {forKind.map(s => <option key={s.id} value={s.id}>{s.label}</option>)}
                  </optgroup>
                )
              })}
            </Select>
            {schedules.length === 0 && (
              <p className="text-xs text-muted-foreground">Add a dues schedule or a donation first — a payment has to post against one.</p>
            )}
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Amount ($) <span className="text-destructive">*</span></Label>
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
              <Label>Payment Method</Label>
              {/* Same fixed list as a fund contribution's. Still optional — a waived
                  payment never had a method. */}
              <Select value={rpMethod} onChange={e => setRpMethod(e.target.value)}>
                <option value="">— Select method —</option>
                {PAYMENT_METHODS.map(m => <option key={m} value={m}>{m}</option>)}
              </Select>
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
