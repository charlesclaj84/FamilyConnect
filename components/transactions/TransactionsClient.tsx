'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import {
  CalendarClock,
  HeartHandshake,
  ArrowDownLeft,
  ArrowUpRight,
  CirclePlus,
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
  recordDisbursement, recordFundContribution,
  type FundMilestone, type FundDisbursement, type FundContribution,
} from '@/app/actions/funds'
import { LEDGER_LABELS, type Ledger } from '@/components/transactions/ledgers'
import { MainRail } from '@/components/layout/MainRail'

interface Person { id: string; first_name: string; last_name: string; nick_name?: string | null; date_of_birth?: string | null }
interface FundOption { id: string; name: string }

interface Props {
  initialLedger: Ledger
  /**
   * The ledgers this caller holds a view grant on, from LEDGER_RESOURCE — resolved on
   * the server, which also skips the fetch for every ledger absent from this list.
   *
   * A ledger missing here has no tab and no rows, and that is one decision rather than
   * two: the page hands down `[]` for it, so a tab rendered anyway would be an empty
   * one rather than a leak. In LEDGERS order, so the rail keeps its order without
   * sorting.
   *
   * VIEW gates the tab, CREATE gates the button inside it — the same division
   * AdminAccountShell uses for Accounting's sections. A create grant without a view
   * grant therefore shows nothing, which is visible in the grid as a row with view set
   * to "—" rather than a silent no-op.
   */
  visibleLedgers: Ledger[]
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
  /** May post a correcting entry against an existing payment. */
  canReverse: boolean
  /**
   * The caller's own name, for the optimistic row a recording form inserts.
   *
   * Every money row now carries who entered it, and the row this component adds before
   * the server answers is entered by the person using it. Without this the optimistic
   * row would read "No longer in the family" for the second between the insert and
   * `router.refresh()` — a alarming thing to flash at a treasurer about a payment they
   * are watching themselves record.
   */
  myName: string
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

const STATUS_LABELS: Record<string, string> = {
  paid: 'Paid',
  waived: 'Waived',
  // Not offered by any form here, and kept because the TABLE still allows it: the
  // pending -> paid settlement 20260806000002 leaves open is how an online payment will
  // land, and a row in that state must read as something rather than as a raw column.
  pending: 'Pending',
}

/**
 * One transaction rendered as a title and a flat list of labelled fields.
 *
 * A single shape for all four ledgers, so there is one dialog rather than four that
 * drift. Every value is pre-formatted to a string here — the dialog does no formatting
 * of its own, which is what keeps a date or an amount from being displayed one way in
 * the list and another in the detail.
 */
interface TransactionView {
  title: string
  subtitle: string
  fields: { label: string; value: string | null }[]
}

/**
 * WHO ENTERED IT is on all three of these, and it is the reason this dialog exists at
 * all: `recorded_by` has been on every money table for months with nowhere in the UI
 * that showed it. A null reads as "no longer in the family" rather than as a blank,
 * because that is what it means — recorded_by is ON DELETE SET NULL, and since
 * 20260807000002 a row cannot be inserted without it.
 */
const recorderField = (name: string | null) => ({
  label: 'Recorded by',
  value: name ?? 'No longer in the family',
})

function viewOfPayment(p: DuesPayment | undefined): TransactionView | null {
  if (!p) return null
  const isReversal = Boolean(p.reverses_id)
  const kindWord = p.schedule_kind === 'donation' ? 'Donation payment' : 'Dues payment'
  return {
    title: p.person_name ?? 'Unknown member',
    subtitle: isReversal ? `${kindWord} — correcting entry` : kindWord,
    fields: [
      { label: 'Amount', value: fmt(p.amount_cents) },
      { label: 'Status', value: STATUS_LABELS[p.status] ?? p.status },
      { label: p.schedule_kind === 'donation' ? 'Donation' : 'Schedule', value: p.schedule_label ?? 'No schedule' },
      { label: 'Date', value: formatDate(p.payment_date) },
      // Absent on a waived row by design — no money moved, so there was no method and
      // no cheque to number.
      { label: 'Payment method', value: p.payment_method },
      { label: 'Check # / Reference', value: p.payment_reference },
      { label: 'Notes', value: p.notes },
      recorderField(p.recorded_by_name),
      { label: 'Entered', value: formatDate(p.created_at) },
      ...(p.reversed_by_id ? [{ label: 'Reversed', value: 'Yes — a correcting entry cancels this payment' }] : []),
      ...(isReversal ? [{ label: 'Corrects', value: 'An earlier payment on this ledger' }] : []),
    ],
  }
}

function viewOfContribution(c: FundContribution | undefined): TransactionView | null {
  if (!c) return null
  return {
    title: c.contributor_name ?? 'Routed from a payment',
    subtitle: `Fund contribution — ${SOURCE_LABELS[c.source] ?? c.source}`,
    fields: [
      { label: 'Amount', value: fmt(c.amount_cents) },
      { label: 'Fund', value: c.fund_name ?? 'Unknown fund' },
      { label: 'Date', value: formatDate(c.contributed_date) },
      { label: 'Payment method', value: c.payment_method },
      { label: 'Check # / Reference', value: c.payment_reference },
      { label: 'Notes', value: c.notes },
      recorderField(c.recorded_by_name),
      { label: 'Entered', value: formatDate(c.created_at) },
    ],
  }
}

function viewOfDisbursement(d: FundDisbursement | undefined): TransactionView | null {
  if (!d) return null
  return {
    title: d.person_name ?? 'Unknown member',
    subtitle: 'Fund disbursement',
    fields: [
      { label: 'Amount', value: fmt(d.amount_cents) },
      { label: 'Fund', value: d.fund_name ?? 'Unknown fund' },
      { label: 'Milestone', value: d.milestone_name },
      { label: 'Date', value: formatDate(d.disbursed_date) },
      { label: 'Check # / Reference', value: d.payment_reference },
      { label: 'Notes', value: d.notes },
      recorderField(d.recorded_by_name),
      { label: 'Entered', value: formatDate(d.created_at) },
    ],
  }
}

/**
 * The chrome every ledger table shares: the scroll container, the header row, and the
 * classes that keep four tables looking like one.
 *
 * Scrolls inside its own `overflow-x-auto` rather than widening the page — the same rule
 * Member Directory and the Accounting panes follow. The `minWidth` floors are now small
 * enough that all four tables fit a phone without scrolling at all, which is the point of
 * having trimmed them to four or five columns: the scroll container stays because a long
 * fund name or a two-word surname can still overflow, not because it is expected to.
 *
 * WHAT EACH LEDGER SHOWS IS THE ANSWER TO ITS OWN QUESTION, and nothing else. Method,
 * Check # / Reference and (for contributions) Source came off all four: they are what you
 * read when you are looking INTO one transaction, not when you are scanning a page of
 * them, and seven columns meant the four figures anyone actually scans — who, what, when,
 * how much — were never on screen together on anything narrower than a laptop. Every one
 * of them is still on the row's detail dialog, which is one click away.
 */
function LedgerTable({ minWidth, columns, children }: {
  minWidth: string
  /** `right: true` for a figures column, so the heading sits over its own numbers. */
  columns: { label: string; right?: boolean; srOnly?: boolean }[]
  children: React.ReactNode
}) {
  return (
    <div className="overflow-x-auto rounded-xl border">
      <table className={cn('w-full border-collapse text-sm', minWidth)}>
        <thead>
          <tr className="border-b bg-muted/40 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            {columns.map(c => (
              <th key={c.label} scope="col"
                className={cn('px-3 py-2 font-semibold', c.right && 'text-right')}>
                {c.srOnly ? <span className="sr-only">{c.label}</span> : c.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>{children}</tbody>
      </table>
    </div>
  )
}

/**
 * A ledger row that opens its detail dialog.
 *
 * TWO WAYS IN, and both are deliberate. The `<tr>` carries the click for the mouse,
 * because a whole row is the target people aim at; the FIRST CELL carries a real
 * `<button>`, because that is the only part of this a keyboard reaches and a screen
 * reader announces. A `<tr>` cannot be given the click alone — it is not focusable and
 * `role="button"` on it would be a promise about Enter and Space that nothing here keeps
 * (same reasoning as MainRail and RowMenu).
 *
 * `stopPropagation` on any OTHER control in the row is therefore required, or a Reverse
 * click opens the dialog on its way up.
 */
function LedgerRow({ onOpen, className, children }: {
  onOpen: () => void
  className?: string
  children: React.ReactNode
}) {
  return (
    <tr
      onClick={onOpen}
      className={cn('cursor-pointer border-b align-middle transition-colors last:border-0 hover:bg-muted/50', className)}
    >
      {children}
    </tr>
  )
}

/** The keyboard-reachable trigger, in a row's primary cell. See LedgerRow. */
function LedgerRowTrigger({ onOpen, children }: { onOpen: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={e => { e.stopPropagation(); onOpen() }}
      className="text-left font-medium hover:underline focus-visible:underline focus-visible:outline-none"
    >
      {children}
    </button>
  )
}

// LedgerRowButton was here — a full-width <button> that WAS the row, back when each
// ledger was a <ul>. It cannot survive a table: a <button> may not wrap a set of <td>s,
// and the moment the row became a <tr> the trigger had to split into the row's own click
// (mouse) and a button in the primary cell (keyboard). See LedgerRow above.

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
  visibleLedgers,
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
  canReverse,
  myName,
}: Props) {
  const router = useRouter()
  const confirm = useConfirm()
  const [ledger, setLedger] = useState<Ledger>(initialLedger)
  const [recording, setRecording] = useState<Ledger | null>(null)
  // Which row's detail dialog is open. Held as {ledger, id} rather than as the row
  // itself, so the dialog re-derives from live state — a reversal posted while it is
  // open updates the entry being read instead of showing a stale snapshot of it.
  const [viewing, setViewing] = useState<{ ledger: Ledger; id: string } | null>(null)
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
        recorded_by_name: myName,
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
        recorded_by_name: myName,
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
        recorded_by_name: myName,
      }, ...prev])
      setRdPersonId(''); setRdAmount(''); setRdMilestoneId(''); setRdReference(''); setRdNotes('')
      setRecording(null)
      router.refresh()
    })
  }

  // handleDeleteDisbursement was removed with the action behind it. fund_disbursements is
  // append-only as of 20260807000002 — trigger, no DELETE policy, and the resource no
  // longer declares a delete action — so there is nothing for a button to call.

  // Resolved at render time from the live arrays, which is why `viewing` stores an id.
  // Returns null when the row has gone (a refresh dropped it), and the dialog closes
  // itself rather than rendering an empty shell.
  const viewed: TransactionView | null = !viewing
    ? null
    : viewing.ledger === 'contributions'
      ? viewOfContribution(contributions.find(c => c.id === viewing.id))
      : viewing.ledger === 'disbursements'
        ? viewOfDisbursement(disbursements.find(d => d.id === viewing.id))
        : viewOfPayment(payments.find(p => p.id === viewing.id))

  // Reachable: `transactions:view` opens the page, but each ledger is its own grant
  // since 20260808000000, so a caller can hold the page and none of its contents.
  // Better to say so than to render an empty rail over an empty pane and let them
  // wonder what broke — the same answer AdminAccountShell gives for Accounting.
  if (visibleLedgers.length === 0) {
    return (
      <div className="rounded-xl border bg-muted/40 px-4 py-6 text-sm text-muted-foreground">
        You can open Transactions, but none of its ledgers have been shared with you.
        Ask an administrator for access to the ones you need — dues, donations,
        contributions and disbursements are each granted separately.
      </div>
    )
  }

  return (
    <div>
      {/* The main rail, with the record trigger on its right — same shape as the
          Accounting admin page, so moving between the two does not move the furniture.
          It replaced a 16rem left column, which is why the pane below is now full
          width. */}
      <MainRail
        label="Transaction ledgers"
        items={visibleLedgers.map(id => ({
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
            onOpen={id => setViewing({ ledger, id })}
            pending={isPending}
          />
        )}

        {ledger === 'contributions' && (
          contributions.length === 0
            ? <p className="text-sm text-muted-foreground">No contributions yet.</p>
            : (
              /* Source came off with Method and Reference, and loses least of the three:
                 the From cell already says "Routed from a payment" for exactly the rows
                 that were tagged Routed, so the distinction survives in the column that
                 was already carrying it. */
              <LedgerTable
                minWidth="min-w-[22rem]"
                columns={[
                  { label: 'From' }, { label: 'Fund' }, { label: 'Date' },
                  { label: 'Amount', right: true },
                ]}
              >
                {contributions.map(c => (
                  <LedgerRow key={c.id} onOpen={() => setViewing({ ledger: 'contributions', id: c.id })}>
                    <td className="px-3 py-2.5">
                      <LedgerRowTrigger onOpen={() => setViewing({ ledger: 'contributions', id: c.id })}>
                        {/* A routed row has no giver — the money came from a payment, not
                            from someone handing it over. */}
                        {c.contributor_name ?? 'Routed from a payment'}
                      </LedgerRowTrigger>
                      {c.notes && <p className="text-xs text-muted-foreground">{c.notes}</p>}
                    </td>
                    <td className="px-3 py-2.5 text-muted-foreground">{c.fund_name ?? 'Unknown fund'}</td>
                    <td className="px-3 py-2.5 whitespace-nowrap text-muted-foreground">{formatDate(c.contributed_date)}</td>
                    <td className="px-3 py-2.5 text-right font-medium text-green-600 whitespace-nowrap">{fmt(c.amount_cents)}</td>
                  </LedgerRow>
                ))}
              </LedgerTable>
            )
        )}

        {ledger === 'disbursements' && (
          disbursements.length === 0
            ? <p className="text-sm text-muted-foreground">No disbursements recorded.</p>
            : (
              /* No delete column, and no permission that would bring one back:
                 fund_disbursements is append-only as of 20260807000002.

                 Fund and Milestone share ONE column. Most disbursements have no
                 milestone, so a column of its own was mostly em-dashes, and the two
                 belong together anyway: a milestone is always paid out of exactly one
                 fund, so "Reunion Fund · Graduation" is one fact, not two. */
              <LedgerTable
                minWidth="min-w-[24rem]"
                columns={[
                  { label: 'Paid to' }, { label: 'Fund / Milestone' },
                  { label: 'Date' }, { label: 'Amount', right: true },
                ]}
              >
                {disbursements.map(d => (
                  <LedgerRow key={d.id} onOpen={() => setViewing({ ledger: 'disbursements', id: d.id })}>
                    <td className="px-3 py-2.5">
                      <LedgerRowTrigger onOpen={() => setViewing({ ledger: 'disbursements', id: d.id })}>
                        {d.person_name ?? 'Unknown'}
                      </LedgerRowTrigger>
                      {d.notes && <p className="text-xs text-muted-foreground">{d.notes}</p>}
                    </td>
                    <td className="px-3 py-2.5 text-muted-foreground">
                      {d.fund_name ?? '—'}
                      {/* The separator only appears when there is a milestone to separate,
                          so a fund-only row reads as a plain fund name rather than as
                          something with a missing half. */}
                      {d.milestone_name && <span className="text-muted-foreground/60"> · {d.milestone_name}</span>}
                    </td>
                    <td className="px-3 py-2.5 whitespace-nowrap text-muted-foreground">{formatDate(d.disbursed_date)}</td>
                    <td className="px-3 py-2.5 text-right font-medium text-green-600 whitespace-nowrap">{fmt(d.amount_cents)}</td>
                  </LedgerRow>
                ))}
              </LedgerTable>
            )
        )}

        {/* Errors from the pane itself — suppressed while a dialog is up, which renders
            the same message inline. */}
        {!recording && error && <p className="text-sm text-destructive">{error}</p>}
      </div>

      {/* ── One transaction, in full ── */}
      <Dialog
        open={viewed !== null}
        onClose={() => setViewing(null)}
        title={viewed?.title ?? ''}
        description={viewed?.subtitle}
        className="max-w-lg max-h-[90vh] overflow-y-auto"
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
              <Button variant="outline" className="w-full" onClick={() => setViewing(null)}>Close</Button>
            </div>
          </div>
        )}
      </Dialog>

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

/**
 * The pill that says what happened to a payment.
 *
 * Pulled out of the row because the two payment ledgers now show it in different places.
 * Dues has a Status column and it goes there; Donations does not, so a donation shows it
 * beside the schedule name instead — see PaymentLedger.
 *
 * Reversed and Correcting entry outrank the status word itself: a reversed payment is
 * still `paid` in the column, and reading "Paid" on a row that has been cancelled is the
 * one thing this pill must never do.
 */
function PaymentStatusPill({ payment }: { payment: DuesPayment }) {
  const isReversal = Boolean(payment.reverses_id)
  const isReversed = Boolean(payment.reversed_by_id)
  return (
    <span className={cn(
      'inline-block whitespace-nowrap rounded-full px-2 py-0.5 text-[11px] font-medium',
      isReversed || isReversal ? 'bg-amber-100 text-amber-800'
        : payment.status === 'paid' ? 'bg-green-100 text-green-700'
          : payment.status === 'waived' ? 'bg-muted text-muted-foreground'
            : 'bg-amber-100 text-amber-800',
    )}>
      {isReversed ? 'Reversed'
        : isReversal ? 'Correcting entry'
          : STATUS_LABELS[payment.status] ?? payment.status}
    </span>
  )
}

/**
 * A payment ledger — Dues or Donations.
 *
 * There is no edit or delete here, and there never will be: dues_payments is
 * append-only, enforced by a database trigger the service role cannot bypass. A
 * mistake is corrected by posting a reversal — an equal and opposite row — so both
 * entries stay visible and the ledger records what actually happened, including the
 * error. Reversed originals are struck through and their reversal is marked, rather
 * than leaving two rows that merely happen to sum to zero.
 *
 * THE TWO LEDGERS NO LONGER SHOW THE SAME COLUMNS. Donations has no Status column,
 * because a donation has one status: the record form does not offer Waived (nobody owed
 * the gift) and forces `paid`, so the column was a page of identical green pills.
 *
 * But `status` is not the only thing that pill was carrying — Reversed and Correcting
 * entry rode in the same cell, and those DO happen to donations. Dropping the column
 * without moving them would have left a cancelled donation identifiable by strikethrough
 * alone, which is a styling difference and not a label. So on Donations the pill moves
 * into the Donation cell and appears only when there is something to say. Dues keeps its
 * column, where the ordinary statuses still differ row to row.
 */
function PaymentLedger({ rows, kind, canReverse, onReverse, onOpen, pending }: {
  rows: DuesPayment[]
  kind: Ledger
  canReverse: boolean
  onReverse: (payment: DuesPayment) => void
  onOpen: (id: string) => void
  pending: boolean
}) {
  if (rows.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        {kind === 'donations' ? 'No donations received yet.' : 'No dues payments recorded yet.'}
      </p>
    )
  }
  const isDonations = kind === 'donations'
  return (
    <LedgerTable
      minWidth={isDonations ? 'min-w-[24rem]' : 'min-w-[32rem]'}
      columns={[
        { label: 'Member' },
        { label: isDonations ? 'Donation' : 'Schedule' },
        { label: 'Date' },
        ...(isDonations ? [] : [{ label: 'Status' }]),
        { label: 'Amount', right: true },
        { label: 'Actions', srOnly: true },
      ]}
    >
      {rows.map(p => {
        const isReversal = Boolean(p.reverses_id)
        const isReversed = Boolean(p.reversed_by_id)
        // Only a settled, un-reversed original can be reversed. A pending row has
        // nothing to undo, and a reversal is not itself reversible.
        const reversible = canReverse && !isReversal && !isReversed && p.status !== 'pending'
        return (
          <LedgerRow key={p.id} onOpen={() => onOpen(p.id)} className={cn(isReversed && 'bg-muted/40')}>
            <td className="px-3 py-2.5">
              <span className={cn(isReversed && 'text-muted-foreground line-through')}>
                <LedgerRowTrigger onOpen={() => onOpen(p.id)}>
                  {p.person_name ?? 'Unknown'}
                </LedgerRowTrigger>
              </span>
              {p.notes && <p className="text-xs text-muted-foreground">{p.notes}</p>}
            </td>
            <td className="px-3 py-2.5 text-muted-foreground">
              <span className="flex flex-wrap items-center gap-2">
                {p.schedule_label ?? 'No schedule'}
                {/* Donations only, and only when the row is not an ordinary one: this is
                    where Reversed / Correcting entry lives once the Status column is
                    gone. A plain donation says nothing here. */}
                {isDonations && (isReversed || isReversal) && <PaymentStatusPill payment={p} />}
              </span>
            </td>
            <td className="px-3 py-2.5 whitespace-nowrap text-muted-foreground">{formatDate(p.payment_date)}</td>
            {!isDonations && (
              <td className="px-3 py-2.5">
                {/* Reversed and Correcting entry live in this column rather than under the
                    name: they ARE the row's status, and putting them anywhere else meant a
                    row could show two different answers to the same question. */}
                <PaymentStatusPill payment={p} />
              </td>
            )}
            <td className={cn(
              'px-3 py-2.5 text-right font-medium whitespace-nowrap',
              isReversed ? 'text-muted-foreground line-through'
                : isReversal ? 'text-amber-700'
                  : p.status === 'paid' ? 'text-green-600'
                    : p.status === 'waived' ? 'text-muted-foreground' : 'text-amber-600',
            )}>
              {p.status === 'waived' ? 'Waived' : fmt(p.amount_cents)}
            </td>
            <td className="w-px px-3 py-2.5 text-right">
              {reversible && (
                // stopPropagation, or this click opens the detail dialog on its way up
                // through the row. See LedgerRow.
                <Button size="sm" variant="ghost" disabled={pending}
                  className="h-7 shrink-0 px-2 text-xs text-amber-700 hover:text-amber-800"
                  onClick={e => { e.stopPropagation(); onReverse(p) }}>
                  <Undo2 className="mr-1 h-3.5 w-3.5" /> Reverse
                </Button>
              )}
            </td>
          </LedgerRow>
        )
      })}
    </LedgerTable>
  )
}
