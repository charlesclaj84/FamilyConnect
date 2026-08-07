'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import {
  CalendarClock,
  HeartHandshake,
  ArrowDownLeft,
  ArrowUpRight,
  CirclePlus,
  Trash2,
  Undo2,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Dialog } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select } from '@/components/ui/select'
import { useConfirm } from '@/components/ui/confirm'
import { disambiguatedName } from '@/lib/name-utils'
import { formatCurrency as fmt, dollarsToCents } from '@/lib/currency-utils'
import { formatDate, todayLocal } from '@/lib/date-utils'
import { PAYMENT_METHODS } from '@/lib/payment-methods'
import { type ScheduleKind } from '@/lib/dues-utils'
import { useServerState } from '@/lib/use-server-state'
import { recordPayment, reversePayment, type DuesSchedule, type DuesPayment } from '@/app/actions/dues'
import {
  recordDisbursement, deleteDisbursement, recordFundContribution,
  type FundMilestone, type FundDisbursement, type FundContribution,
} from '@/app/actions/funds'
import { LEDGERS, LEDGER_LABELS, type Ledger } from '@/components/transactions/ledgers'
import { MainRail } from '@/components/layout/MainRail'

interface Person { id: string; first_name: string; last_name: string; nick_name?: string | null; date_of_birth?: string | null }
interface FundOption { id: string; name: string }

interface Props {
  initialLedger: Ledger
  initialPayments: DuesPayment[]
  initialContributions: FundContribution[]
  initialDisbursements: FundDisbursement[]
  schedules: DuesSchedule[]
  funds: FundOption[]
  milestones: FundMilestone[]
  members: Person[]
  /**
   * One grant per add button, resolved on the server from LEDGER_RESOURCE. Four
   * separate booleans rather than the old two, so a treasurer can be allowed to
   * record dues without also being allowed to record donations, and someone can log
   * a contribution without being able to pay money out.
   */
  canRecordDues: boolean
  canRecordDonations: boolean
  canRecordContributions: boolean
  canRecordDisbursements: boolean
  /** Erasing the record of money paid out is separable from paying it out. */
  canDeleteDisbursements: boolean
  /** May post a correcting entry against an existing payment. */
  canReverse: boolean
}

type IconComponent = React.ComponentType<{ className?: string }>

const LEDGER_ICONS: Record<Ledger, IconComponent> = {
  dues: CalendarClock,
  donations: HeartHandshake,
  contributions: ArrowDownLeft,
  disbursements: ArrowUpRight,
}

/** The button that opens each ledger's record form. */
const RECORD_LABELS: Record<Ledger, string> = {
  dues: 'New Dues Payment',
  donations: 'New Donation Payment',
  contributions: 'New Contribution',
  disbursements: 'New Disbursement',
}

/** Sentinel for "the giver is not a member" — reveals the free-text name field. */
const NON_MEMBER = 'non-member'

/**
 * How a contribution reached the fund, in the ledger's words rather than the
 * column's. 'dues_routing' is the automatic split of a paid dues or donation payment;
 * the other two are money someone handed over and someone recorded.
 */
const SOURCE_LABELS: Record<string, string> = {
  dues_routing: 'Routed',
  admin_manual: 'Recorded',
  member_contribution: 'From a member',
}

/**
 * Every transaction the family has recorded, and the forms that add to them.
 *
 * This is the operational half of Accounting, and it is NOT an admin page: reading
 * the ledgers needs only `transactions` view, which every member has unless the
 * family restricts it. Recording is separate, and now granular — one grant per add
 * button, resolved from LEDGER_RESOURCE and enforced identically by the server
 * actions, so a member who may look but not write simply sees no button rather than a
 * form that fails on submit.
 *
 * No member can record their own dues here, by design. Recording a payment asserts
 * that money changed hands, and letting the person who owes it make that assertion is
 * what basic accounting exists to prevent. The member-facing path is Pay Online, where
 * a processor attests instead.
 *
 * Dues and Donations are split because they answer different questions even though
 * they share a table: "is everyone paid up" and "how is the drive going" are not the
 * same review. A payment with no schedule at all can only be a legacy row from before
 * schedule became required, and it files under Dues, which is what it was.
 */
export function TransactionsClient({
  initialLedger,
  initialPayments,
  initialContributions,
  initialDisbursements,
  schedules,
  funds,
  milestones,
  members,
  canRecordDues,
  canRecordDonations,
  canRecordContributions,
  canRecordDisbursements,
  canDeleteDisbursements,
  canReverse,
}: Props) {
  const router = useRouter()
  const confirm = useConfirm()
  const [ledger, setLedger] = useState<Ledger>(initialLedger)
  const [recording, setRecording] = useState<Ledger | null>(null)
  const [error, setError] = useState('')
  const [isPending, startTransition] = useTransition()

  // `useServerState`, not `useState`: nothing here unmounts on a ledger switch, so a
  // plain initializer would be read once per visit and every later server render
  // ignored — a row recorded on another tab would never appear.
  const [payments, setPayments] = useServerState(initialPayments)
  const [contributions, setContributions] = useServerState(initialContributions)
  const [disbursements, setDisbursements] = useServerState(initialDisbursements)

  // ── Record payment (dues or donation, decided by the ledger it opened from) ──
  // 'pending' is gone from this union: a treasurer typing an entry in is recording
  // something that already happened, so the honest outcomes are that the money came or
  // that the family let it go. recordPayment refuses 'pending' for the same reason, and
  // explains where the settlement path lives.
  const [rpPersonId, setRpPersonId] = useState('')
  const [rpScheduleId, setRpScheduleId] = useState('')
  const [rpAmount, setRpAmount] = useState('')
  const [rpDate, setRpDate] = useState(todayLocal())
  const [rpMethod, setRpMethod] = useState('')
  const [rpReference, setRpReference] = useState('')
  const [rpStatus, setRpStatus] = useState<'paid' | 'waived'>('paid')
  const [rpNotes, setRpNotes] = useState('')

  // ── Record contribution ──
  const [fcFundId, setFcFundId] = useState('')
  const [fcGiver, setFcGiver] = useState('')
  const [fcGiverName, setFcGiverName] = useState('')
  const [fcMethod, setFcMethod] = useState('')
  const [fcReference, setFcReference] = useState('')
  const [fcAmount, setFcAmount] = useState('')
  const [fcDate, setFcDate] = useState(todayLocal())
  const [fcNotes, setFcNotes] = useState('')

  // ── Record disbursement ──
  const [rdFundId, setRdFundId] = useState('')
  const [rdMilestoneId, setRdMilestoneId] = useState('')
  const [rdPersonId, setRdPersonId] = useState('')
  const [rdAmount, setRdAmount] = useState('')
  const [rdDate, setRdDate] = useState(todayLocal())
  const [rdReference, setRdReference] = useState('')
  const [rdNotes, setRdNotes] = useState('')

  // Adjusted during render rather than in an effect: an effect runs after paint,
  // which would flash one form's validation message inside another for a frame.
  const [prevLedger, setPrevLedger] = useState(ledger)
  if (prevLedger !== ledger) { setPrevLedger(ledger); setError('') }
  const [prevRecording, setPrevRecording] = useState(recording)
  if (prevRecording !== recording) {
    setPrevRecording(recording)
    setError('')
    if (recording) {
      // Every calendar in here opens on today. The initializers above run ONCE — this
      // component is never unmounted, by design, so a tab left open overnight would
      // otherwise keep offering yesterday's date to every entry made the next morning.
      //
      // This does cost the contribution form its remembered date, which used to survive
      // between entries so a batch of back-dated cheques could share one. Opening on
      // today is the rule that was asked for; a batch dated other than today now needs
      // the date set once per cheque.
      const today = todayLocal()
      setRpDate(today); setFcDate(today); setRdDate(today)
      // Status resets with them. It is hidden for a donation and must be 'paid' there,
      // so a 'waived' left behind by a dues entry would be both invisible and wrong.
      setRpStatus('paid')
    }
  }

  function selectLedger(next: Ledger) {
    setLedger(next)
    setRecording(null)
    // Rebuilt from the live search string so a switch never drops another param, and
    // replaceState so Back leaves the page instead of walking the ledgers.
    const params = new URLSearchParams(window.location.search)
    params.set('ledger', next)
    window.history.replaceState(null, '', `${window.location.pathname}?${params}`)
  }

  // The payment form serves both income ledgers; which one opened it decides the
  // kind, and the schedule list is filtered to match. Posting a member's dues against
  // a donation is invisible afterwards, so the form never offers the chance.
  const payingKind: ScheduleKind = recording === 'donations' ? 'donation' : 'dues'
  const payableSchedules = schedules.filter(s => s.kind === payingKind)

  const duesPayments = payments.filter(p => p.schedule_kind !== 'donation')
  const donationPayments = payments.filter(p => p.schedule_kind === 'donation')
  const filteredMilestones = rdFundId ? milestones.filter(m => m.fund_id === rdFundId) : []

  // One boolean per ledger, so the visible button always matches the grant the
  // server action will demand. RECORD_BY_LEDGER is keyed the same way LEDGER_RESOURCE
  // is, which is what keeps the two in step.
  const RECORD_BY_LEDGER: Record<Ledger, boolean> = {
    dues:          canRecordDues,
    donations:     canRecordDonations,
    contributions: canRecordContributions,
    disbursements: canRecordDisbursements,
  }
  const canRecord = RECORD_BY_LEDGER[ledger]

  /**
   * Reverse a posted payment.
   *
   * Confirmed rather than instant: it writes a permanent second row, and unlike most
   * destructive-looking actions it cannot be undone by repeating it — the unique index
   * on reverses_id allows exactly one reversal per payment.
   */
  async function handleReverse(payment: DuesPayment) {
    const ok = await confirm({
      title: 'Reverse this payment',
      description:
        `Post a correcting entry of ${fmt(-payment.amount_cents)} against ${payment.person_name ?? 'this member'}'s `
        + `${fmt(payment.amount_cents)} payment? The original stays on the ledger — reversing is how a `
        + 'mistake is corrected, because posted payments cannot be edited or deleted. '
        + 'Any money this payment routed into funds is taken back out of the same funds.',
      confirmLabel: 'Post reversal',
      destructive: true,
    })
    if (!ok) return
    setError('')
    startTransition(async () => {
      const result = await reversePayment(payment.id, '')
      if (!result.success) { setError(result.message ?? 'Failed to reverse'); return }
      router.refresh()
    })
  }

  function handleRecordPayment() {
    if (!rpPersonId || !rpScheduleId || !rpAmount) { setError('Member, schedule and amount required'); return }
    // A donation has no waived form — nobody owed it — so the dialog hides Status and
    // this is always false there.
    const waived = payingKind !== 'donation' && rpStatus === 'waived'
    if (!waived) {
      if (!rpMethod) { setError('Choose how the payment was made'); return }
      if (!rpReference.trim()) { setError('Enter the check number or reference for the payment'); return }
    }
    setError('')
    const kind = payingKind
    // Forced rather than read for a donation: the field is not on screen, so its state
    // is not something the person filling the form can see or correct.
    const status = kind === 'donation' ? 'paid' as const : rpStatus
    // Nothing to record about a payment that never happened.
    const method = waived ? null : rpMethod
    const reference = waived ? null : (rpReference.trim() || null)
    startTransition(async () => {
      const result = await recordPayment({
        person_id: rpPersonId,
        schedule_id: rpScheduleId,
        amount_cents: Math.round(parseFloat(rpAmount) * 100),
        status,
        payment_date: rpDate,
        payment_method: method,
        payment_reference: reference,
        notes: rpNotes || null,
      })
      if (!result.success) { setError(result.message ?? 'Failed'); return }
      const cents = Math.round(parseFloat(rpAmount) * 100)
      const member = members.find(m => m.id === rpPersonId)
      const schedule = schedules.find(s => s.id === rpScheduleId)
      setPayments(prev => [{
        id: `temp-${Date.now()}`,
        person_id: rpPersonId,
        person_name: member ? `${member.first_name} ${member.last_name}` : null,
        schedule_id: rpScheduleId,
        schedule_label: schedule?.label ?? null,
        schedule_kind: kind,
        amount_cents: cents,
        status,
        payment_date: rpDate,
        payment_method: method,
        payment_reference: reference,
        notes: rpNotes || null,
        created_at: new Date().toISOString(),
        reverses_id: null,
        reversed_by_id: null,
      }, ...prev])
      setRpPersonId(''); setRpAmount(''); setRpScheduleId(''); setRpReference(''); setRpNotes('')
      setRecording(null)
      // A paid payment routes into funds, so re-read the server for the balances.
      router.refresh()
    })
  }

  function handleRecordContribution() {
    if (!fcFundId || !fcAmount) { setError('Fund and amount required'); return }
    if (!fcGiver) { setError('Choose who the contribution came from'); return }
    if (fcGiver === NON_MEMBER && !fcGiverName.trim()) { setError('Name who the contribution came from'); return }
    if (!fcMethod) { setError('Choose how the contribution was given'); return }
    if (!fcReference.trim()) { setError('Enter the check number or reference for the contribution'); return }
    setError('')
    const cents = dollarsToCents(fcAmount)
    const fundId = fcFundId
    const isMember = fcGiver !== NON_MEMBER
    startTransition(async () => {
      const res = await recordFundContribution({
        fund_id: fundId,
        amount_cents: cents,
        contributed_date: fcDate,
        contributor_person_id: isMember ? fcGiver : null,
        contributor_name: isMember ? null : fcGiverName.trim(),
        payment_method: fcMethod,
        payment_reference: fcReference.trim() || null,
        notes: fcNotes || null,
      })
      if (!res.success) { setError(res.message ?? 'Failed'); return }
      const fund = funds.find(f => f.id === fundId)
      const giver = members.find(m => m.id === fcGiver)
      setContributions(prev => [{
        id: `temp-${Date.now()}`,
        fund_id: fundId,
        fund_name: fund?.name ?? null,
        amount_cents: cents,
        source: 'admin_manual',
        contributor_name: isMember
          ? (giver ? `${giver.first_name} ${giver.last_name}` : null)
          : fcGiverName.trim(),
        payment_method: fcMethod,
        payment_reference: fcReference.trim() || null,
        contributed_date: fcDate,
        notes: fcNotes || null,
        created_at: new Date().toISOString(),
      }, ...prev])
      // Fund and method survive — contributions get entered in batches, and a stack of
      // cheques shares both. The date used to survive with them; it now re-opens on
      // today, so a back-dated batch sets it per entry. The GIVER is always cleared:
      // silently re-attributing the next amount to the last person is the one mistake
      // this form must not make.
      setFcGiver(''); setFcGiverName('')
      setFcAmount(''); setFcReference(''); setFcNotes('')
      setRecording(null)
      router.refresh()
    })
  }

  function handleRecordDisbursement() {
    if (!rdFundId || !rdPersonId || !rdAmount) { setError('Fund, member, and amount required'); return }
    if (!rdReference.trim()) { setError('Enter the check number or reference for the disbursement'); return }
    setError('')
    const cents = Math.round(parseFloat(rdAmount) * 100)
    const fundId = rdFundId, personId = rdPersonId, milestoneId = rdMilestoneId || null
    const date = rdDate, notes = rdNotes || null, reference = rdReference.trim() || null
    startTransition(async () => {
      const result = await recordDisbursement({
        fund_id: fundId,
        milestone_id: milestoneId,
        person_id: personId,
        amount_cents: cents,
        disbursed_date: date,
        payment_reference: reference,
        notes,
      })
      if (!result.success) { setError(result.message ?? 'Failed'); return }
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
        payment_reference: reference,
        notes,
        created_at: new Date().toISOString(),
      }, ...prev])
      setRdPersonId(''); setRdAmount(''); setRdMilestoneId(''); setRdReference(''); setRdNotes('')
      setRecording(null)
      router.refresh()
    })
  }

  async function handleDeleteDisbursement(id: string) {
    const d = disbursements.find(x => x.id === id)
    const ok = await confirm({
      title: 'Delete disbursement',
      description: d
        ? `Delete the ${fmt(d.amount_cents)} disbursement to ${d.person_name ?? 'this member'} from ${d.fund_name ?? 'the fund'}? The amount returns to the fund balance. This cannot be undone.`
        : 'Delete this disbursement? The amount returns to the fund balance. This cannot be undone.',
      confirmLabel: 'Delete disbursement',
      destructive: true,
    })
    if (!ok) return
    startTransition(async () => {
      const res = await deleteDisbursement(id)
      if (!res.success) { setError(res.message ?? 'Failed'); return }
      setDisbursements(prev => prev.filter(x => x.id !== id))
      router.refresh()
    })
  }

  return (
    <div>
      {/* The main rail, with the record trigger on its right — same shape as the
          Accounting admin page, so moving between the two does not move the furniture.
          It replaced a 16rem left column, which is why the pane below is now full
          width. */}
      <MainRail
        label="Transaction ledgers"
        items={LEDGERS.map(id => ({
          id,
          label: LEDGER_LABELS[id],
          icon: LEDGER_ICONS[id],
          href: `/transactions?ledger=${id}`,
        }))}
        active={ledger}
        onSelect={selectLedger}
        action={canRecord && (
          // Green rather than the default navy: navy is exactly what the ACTIVE rail
          // item looks like, so a navy trigger here read as another ledger.
          <Button
            className="bg-[#6bbe6b] text-[#0f2540] hover:opacity-90"
            onClick={() => { setError(''); setRecording(ledger) }}
          >
            <CirclePlus className="h-4 w-4 mr-1" /> {RECORD_LABELS[ledger]}
          </Button>
        )}
      />

      <div className="mt-5 min-w-0 space-y-4">
        {/* ── Dues and Donations: two views of dues_payments, split by kind ── */}
        {(ledger === 'dues' || ledger === 'donations') && (
          <PaymentLedger
            rows={ledger === 'dues' ? duesPayments : donationPayments}
            kind={ledger}
            canReverse={canReverse}
            onReverse={handleReverse}
            pending={isPending}
          />
        )}

        {ledger === 'contributions' && (
          contributions.length === 0
            ? <p className="text-sm text-muted-foreground">No contributions yet.</p>
            : (
              <ul className="divide-y rounded-xl border overflow-hidden">
                {contributions.map(c => (
                  <li key={c.id} className="flex items-center gap-3 px-4 py-3">
                    <div className="min-w-0 flex-1">
                      <p className="flex flex-wrap items-center gap-2 text-sm font-medium">
                        {/* A routed row has no giver — the money came from a payment,
                            not from someone handing it over. */}
                        {c.contributor_name ?? 'Routed from a payment'}
                        <span className={cn(
                          'shrink-0 rounded-full px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide',
                          c.source === 'dues_routing' ? 'bg-muted text-muted-foreground' : 'bg-emerald-100 text-emerald-700',
                        )}>
                          {SOURCE_LABELS[c.source] ?? c.source}
                        </span>
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {c.fund_name ?? 'Unknown fund'} · {formatDate(c.contributed_date)}
                        {c.payment_method && ` · ${c.payment_method}`}
                        {c.payment_reference && ` · Ref: ${c.payment_reference}`}
                      </p>
                      {c.notes && <p className="text-xs text-muted-foreground">{c.notes}</p>}
                    </div>
                    <span className="text-sm font-medium text-green-600 whitespace-nowrap">{fmt(c.amount_cents)}</span>
                  </li>
                ))}
              </ul>
            )
        )}

        {ledger === 'disbursements' && (
          disbursements.length === 0
            ? <p className="text-sm text-muted-foreground">No disbursements recorded.</p>
            : (
              <ul className="divide-y rounded-xl border overflow-hidden">
                {disbursements.map(d => (
                  <li key={d.id} className="flex items-center gap-3 px-4 py-3">
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium">{d.person_name ?? 'Unknown'}</p>
                      <p className="text-xs text-muted-foreground">
                        {d.fund_name} {d.milestone_name ? `· ${d.milestone_name}` : ''} · {formatDate(d.disbursed_date)}
                        {d.payment_reference && ` · Ref: ${d.payment_reference}`}
                      </p>
                      {d.notes && <p className="text-xs text-muted-foreground">{d.notes}</p>}
                    </div>
                    <span className="text-sm font-medium text-green-600 whitespace-nowrap">{fmt(d.amount_cents)}</span>
                    {canDeleteDisbursements && (
                      <Button size="sm" variant="ghost" className="text-destructive hover:text-destructive h-7 w-7 p-0" onClick={() => handleDeleteDisbursement(d.id)}>
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    )}
                  </li>
                ))}
              </ul>
            )
        )}

        {/* Errors from the pane itself (a failed delete) — suppressed while a dialog
            is up, which renders the same message inline. */}
        {!recording && error && <p className="text-sm text-destructive">{error}</p>}
      </div>

      {/* ── Record a payment (dues or donation) ── */}
      <Dialog
        open={recording === 'dues' || recording === 'donations'}
        onClose={() => setRecording(null)}
        title={payingKind === 'donation' ? 'New Donation Payment' : 'New Dues Payment'}
        description={payingKind === 'donation'
          ? 'Record a gift a member has already given.'
          : 'Record dues a member has already paid.'}
        className="max-w-lg max-h-[90vh] overflow-y-auto"
      >
        <div className="space-y-3 mt-2">
          <div className="space-y-1.5">
            <Label>Member <span className="text-destructive">*</span></Label>
            <Select value={rpPersonId} onChange={e => setRpPersonId(e.target.value)} autoFocus>
              <option value="">— Select member —</option>
              {members.map(m => <option key={m.id} value={m.id}>{disambiguatedName(m, members)}</option>)}
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>{payingKind === 'donation' ? 'Donation' : 'Schedule'} <span className="text-destructive">*</span></Label>
            <Select value={rpScheduleId} onChange={e => setRpScheduleId(e.target.value)}>
              <option value="">— Select —</option>
              {payableSchedules.map(s => <option key={s.id} value={s.id}>{s.label}</option>)}
            </Select>
            {payableSchedules.length === 0 && (
              <p className="text-xs text-muted-foreground">
                None set up yet — an admin adds these under Accounting.
              </p>
            )}
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Amount ($) <span className="text-destructive">*</span></Label>
              <Input type="number" min="0" step="0.01" value={rpAmount} onChange={e => setRpAmount(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>Date <span className="text-destructive">*</span></Label>
              <Input type="date" value={rpDate} onChange={e => setRpDate(e.target.value)} />
            </div>
          </div>
          {/* Status is a dues field only. A gift has one outcome worth recording —
              waiving a donation would be forgiving something nobody owed — so for a
              donation it is set to Paid rather than shown as a one-option select.
              recordPayment enforces both halves; this only decides what is asked. */}
          {payingKind !== 'donation' && (
            <div className="space-y-1.5">
              <Label>Status</Label>
              <Select value={rpStatus} onChange={e => setRpStatus(e.target.value as typeof rpStatus)}>
                <option value="paid">Paid</option>
                <option value="waived">Waived</option>
              </Select>
              {rpStatus === 'waived' && (
                <p className="text-xs text-muted-foreground">
                  Waiving forgives the due. No money changed hands, so there is no
                  method or reference to record.
                </p>
              )}
            </div>
          )}
          {/* Both required, and both hidden for a waived due: they describe how money
              arrived, and on a waived row no money did. */}
          {rpStatus !== 'waived' && (
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Payment Method <span className="text-destructive">*</span></Label>
                <Select value={rpMethod} onChange={e => setRpMethod(e.target.value)}>
                  <option value="">— Select method —</option>
                  {PAYMENT_METHODS.map(m => <option key={m} value={m}>{m}</option>)}
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Check # / Reference <span className="text-destructive">*</span></Label>
                <Input value={rpReference} onChange={e => setRpReference(e.target.value)} placeholder="Check #1043" />
              </div>
            </div>
          )}
          <div className="space-y-1.5">
            <Label>Notes</Label>
            <Input value={rpNotes} onChange={e => setRpNotes(e.target.value)} placeholder="Optional notes" />
          </div>
          {error && <p className="text-sm text-destructive">{error}</p>}
          <div className="flex gap-2 pt-1">
            <Button className="flex-1" onClick={handleRecordPayment} disabled={isPending}>
              {isPending ? 'Recording…' : 'Record Payment'}
            </Button>
            <Button variant="outline" onClick={() => setRecording(null)} disabled={isPending}>Cancel</Button>
          </div>
        </div>
      </Dialog>

      {/* ── Record a contribution ── */}
      <Dialog
        open={recording === 'contributions'}
        onClose={() => setRecording(null)}
        title="New Contribution"
        description="Money added to a fund directly, outside of dues routing."
        className="max-w-lg max-h-[90vh] overflow-y-auto"
      >
        <div className="space-y-3 mt-2">
          <div className="space-y-1.5">
            <Label>Fund <span className="text-destructive">*</span></Label>
            <Select value={fcFundId} onChange={e => setFcFundId(e.target.value)} autoFocus>
              <option value="">— Select fund —</option>
              {funds.map(f => <option key={f.id} value={f.id}>{f.name}</option>)}
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Who gave it <span className="text-destructive">*</span></Label>
            <Select value={fcGiver} onChange={e => setFcGiver(e.target.value)}>
              <option value="">— Select —</option>
              {members.map(m => <option key={m.id} value={m.id}>{disambiguatedName(m, members)}</option>)}
              <option value={NON_MEMBER}>Someone or something else…</option>
            </Select>
          </div>
          {fcGiver === NON_MEMBER && (
            <div className="space-y-1.5">
              <Label>Name or source <span className="text-destructive">*</span></Label>
              <Input
                value={fcGiverName}
                onChange={e => setFcGiverName(e.target.value)}
                placeholder="Aunt Ruby's estate, 2026 reunion surplus…"
              />
            </div>
          )}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Payment Method <span className="text-destructive">*</span></Label>
              <Select value={fcMethod} onChange={e => setFcMethod(e.target.value)}>
                <option value="">— Select method —</option>
                {PAYMENT_METHODS.map(m => <option key={m} value={m}>{m}</option>)}
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Check # / Reference <span className="text-destructive">*</span></Label>
              <Input value={fcReference} onChange={e => setFcReference(e.target.value)} placeholder="Check #1043" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Amount ($) <span className="text-destructive">*</span></Label>
              <Input type="number" min="0" step="0.01" value={fcAmount} onChange={e => setFcAmount(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>Date <span className="text-destructive">*</span></Label>
              <Input type="date" value={fcDate} onChange={e => setFcDate(e.target.value)} />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>Notes</Label>
            <Input value={fcNotes} onChange={e => setFcNotes(e.target.value)} placeholder="Optional notes" />
          </div>
          {error && <p className="text-sm text-destructive">{error}</p>}
          <div className="flex gap-2 pt-1">
            <Button className="flex-1" onClick={handleRecordContribution} disabled={isPending}>
              {isPending ? 'Recording…' : 'Add Contribution'}
            </Button>
            <Button variant="outline" onClick={() => setRecording(null)} disabled={isPending}>Cancel</Button>
          </div>
        </div>
      </Dialog>

      {/* ── Record a disbursement ── */}
      <Dialog
        open={recording === 'disbursements'}
        onClose={() => setRecording(null)}
        title="New Disbursement"
        description="Money paid out of a fund to a member."
        className="max-w-lg max-h-[90vh] overflow-y-auto"
      >
        <div className="space-y-3 mt-2">
          <div className="space-y-1.5">
            <Label>Fund <span className="text-destructive">*</span></Label>
            <Select value={rdFundId} onChange={e => { setRdFundId(e.target.value); setRdMilestoneId('') }} autoFocus>
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
            <Label>Recipient <span className="text-destructive">*</span></Label>
            <Select value={rdPersonId} onChange={e => setRdPersonId(e.target.value)}>
              <option value="">— Select member —</option>
              {members.map(m => <option key={m.id} value={m.id}>{disambiguatedName(m, members)}</option>)}
            </Select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Amount ($) <span className="text-destructive">*</span></Label>
              <Input type="number" min="0" step="0.01" value={rdAmount} onChange={e => setRdAmount(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>Date <span className="text-destructive">*</span></Label>
              <Input type="date" value={rdDate} onChange={e => setRdDate(e.target.value)} />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>Check # / Reference <span className="text-destructive">*</span></Label>
            <Input value={rdReference} onChange={e => setRdReference(e.target.value)} placeholder="Check #1043" />
          </div>
          <div className="space-y-1.5">
            <Label>Notes</Label>
            <Input value={rdNotes} onChange={e => setRdNotes(e.target.value)} placeholder="Optional notes" />
          </div>
          {error && <p className="text-sm text-destructive">{error}</p>}
          <div className="flex gap-2 pt-1">
            <Button className="flex-1" onClick={handleRecordDisbursement} disabled={isPending}>
              {isPending ? 'Recording…' : 'Record Disbursement'}
            </Button>
            <Button variant="outline" onClick={() => setRecording(null)} disabled={isPending}>Cancel</Button>
          </div>
        </div>
      </Dialog>
    </div>
  )
}

/** Dues and donation payments render identically; only the empty state differs. */
/**
 * A payment ledger.
 *
 * There is no edit or delete here, and there never will be: dues_payments is
 * append-only, enforced by a database trigger the service role cannot bypass. A
 * mistake is corrected by posting a reversal — an equal and opposite row — so both
 * entries stay visible and the ledger records what actually happened, including the
 * error. Reversed originals are struck through and their reversal is marked, rather
 * than leaving two rows that merely happen to sum to zero.
 */
function PaymentLedger({ rows, kind, canReverse, onReverse, pending }: {
  rows: DuesPayment[]
  kind: Ledger
  canReverse: boolean
  onReverse: (payment: DuesPayment) => void
  pending: boolean
}) {
  if (rows.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        {kind === 'donations' ? 'No donations received yet.' : 'No dues payments recorded yet.'}
      </p>
    )
  }
  return (
    <ul className="divide-y rounded-xl border overflow-hidden">
      {rows.map(p => {
        const isReversal = Boolean(p.reverses_id)
        const isReversed = Boolean(p.reversed_by_id)
        // Only a settled, un-reversed original can be reversed. A pending row has
        // nothing to undo, and a reversal is not itself reversible.
        const reversible = canReverse && !isReversal && !isReversed && p.status !== 'pending'
        return (
          <li key={p.id} className={cn('flex items-center gap-3 px-4 py-3', isReversed && 'bg-muted/40')}>
            <div className="min-w-0 flex-1">
              <p className={cn('text-sm font-medium', isReversed && 'line-through text-muted-foreground')}>
                {p.person_name ?? 'Unknown'}
              </p>
              {/* The reference is shown here for the same reason the other two ledgers
                  show theirs: it is now required on the way in, and a mandatory field
                  that never appears again is a field nobody can reconcile against. */}
              <p className="text-xs text-muted-foreground">
                {p.schedule_label ?? 'No schedule'} · {formatDate(p.payment_date)}
                {p.payment_method && ` · ${p.payment_method}`}
                {p.payment_reference && ` · Ref: ${p.payment_reference}`}
              </p>
              {p.notes && <p className="text-xs text-muted-foreground">{p.notes}</p>}
              {isReversed && <p className="text-xs font-medium text-amber-700">Reversed</p>}
              {isReversal && <p className="text-xs font-medium text-amber-700">Correcting entry</p>}
            </div>
            <span className={cn(
              'text-sm font-medium whitespace-nowrap',
              isReversed ? 'text-muted-foreground line-through'
                : isReversal ? 'text-amber-700'
                  : p.status === 'paid' ? 'text-green-600'
                    : p.status === 'waived' ? 'text-muted-foreground' : 'text-amber-600',
            )}>
              {p.status === 'waived' ? 'Waived' : fmt(p.amount_cents)}
            </span>
            {reversible && (
              <Button size="sm" variant="ghost" disabled={pending}
                className="h-7 shrink-0 px-2 text-xs text-amber-700 hover:text-amber-800"
                onClick={() => onReverse(p)}>
                <Undo2 className="mr-1 h-3.5 w-3.5" /> Reverse
              </Button>
            )}
          </li>
        )
      })}
    </ul>
  )
}
