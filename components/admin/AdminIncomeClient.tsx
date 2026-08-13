'use client'

import { useState, useTransition } from 'react'
import { Trash2, Pencil } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Dialog } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select } from '@/components/ui/select'
import { useConfirm } from '@/components/ui/confirm'
import { COLLAPSING_CELL, RowMeta, MetaIf } from '@/components/ui/table-collapse'
import { PersonMultiSelect, type SelectablePerson } from '@/components/ui/person-multi-select'
import { cn } from '@/lib/utils'
import { formatCurrency as formatDollars } from '@/lib/currency-utils'
import { formatDate, todayLocal } from '@/lib/date-utils'
import { disambiguatedName } from '@/lib/name-utils'
import { APP_NAME } from '@/lib/brand'
import { type ScheduleKind } from '@/lib/dues-utils'
import { useServerState } from '@/lib/use-server-state'

/**
 * Start and End as ONE line, for the meta line the two date columns fold into.
 *
 * An open-ended schedule is the common case and reads better as "from 1 Jan 2026" than
 * as "1 Jan 2026 — —"; a schedule with neither date says nothing at all rather than
 * printing a bare dash under its own name.
 */
function dateRange(start: string | null | undefined, end: string | null | undefined): string | null {
  const from = formatDate(start)
  const to = formatDate(end)
  if (from && to) return `${from} – ${to}`
  if (from) return `from ${from}`
  if (to) return `until ${to}`
  return null
}
import {
  createDuesSchedule, updateDuesSchedule, deleteDuesSchedule,
  type DuesSchedule, type ScheduleUsage,
} from '@/app/actions/dues'
import {
  isIncomeSection, type AccountSection, type AccountRights,
} from '@/components/admin/account-sections'

interface Props {
  /** Which section the shell is showing. This component renders only its own. */
  section: AccountSection
  /**
   * Which section's create dialog the shell has open, or null for none. Passed raw
   * rather than as a boolean per dialog: this panel owns two of them (new dues, new
   * donation) and already reads `section` the same way.
   */
  creating: AccountSection | null
  onCloseCreate: () => void
  initialSchedules: DuesSchedule[]
  /**
   * Which schedules the ledger has been posted against, keyed by schedule id, from
   * `getScheduleUsage()`. A missing id means no payments.
   *
   * This decides what the edit row lets anyone touch — see LOCK_NOTE. It is advisory
   * here in the strict sense: `updateDuesSchedule` re-derives it, and the trigger from
   * 20260807000001 enforces it against the service-role client the action writes
   * through. Disabling the input is so a treasurer is not offered an edit that is
   * going to be refused, not the thing that refuses it.
   */
  scheduleUsage: Record<string, ScheduleUsage>
  /**
   * Per-section grants. Dues and Donations are separate resources even though both
   * are dues_schedules rows, so someone can maintain what members owe without also
   * being able to open a donation drive.
   */
  rights: AccountRights
  /**
   * The adults a donation drive can be FOR. Empty unless the caller may see the
   * Donations section — the page gates the fetch, not the field (AGENTS.md §5).
   */
  members: BeneficiaryOption[]
}

/**
 * A member as the beneficiary picker needs them — an alias for the shared control's
 * shape, not a second definition of it. The page builds this list and it flows through
 * the shell unchanged, so the two must stay the same type by construction.
 */
export type BeneficiaryOption = SelectablePerson

const FREQ_OPTIONS = ['annual', 'semi-annual', 'quarterly', 'monthly', 'one-time']

/**
 * Wording that differs between the two kinds. Everything else about them — the CRUD,
 * the list, the editor, the payment form — is shared, which is the whole reason
 * donations are a `kind` on dues_schedules rather than a parallel feature.
 */
const KIND_COPY: Record<ScheduleKind, {
  noun: string
  title: string
  editTitle: string
  blurb: string
  empty: string
  labelPlaceholder: string
  amountPlaceholder: string
}> = {
  dues: {
    noun: 'dues',
    title: 'New Dues',
    editTitle: 'Edit Dues',
    blurb: 'Dues every member of the family owes on this cadence.',
    empty: 'No dues yet.',
    labelPlaceholder: 'Annual Dues',
    amountPlaceholder: '25.00',
  },
  donation: {
    noun: 'donation',
    title: 'New Donation',
    editTitle: 'Edit Donation',
    blurb: 'A drive members can give to between two dates. Nobody owes it, and it never counts against a member’s balance.',
    empty: 'No donations yet.',
    labelPlaceholder: 'Scholarship Drive',
    amountPlaceholder: '500.00',
  },
}

/**
 * Every field a dues schedule or a donation is made of, as the form holds them — dollars
 * as typed rather than cents, dates as the `<input type="date">` strings.
 */
interface ScheduleForm {
  label: string
  /** Dues only. */
  amount: string
  /** Donations only. */
  goal: string
  frequency: string
  startDate: string
  endDate: string
  description: string
  required: boolean
  /** Donations only. The people the drive is for, and so the people who cannot see it. */
  beneficiaryIds: string[]
}

const EMPTY_SCHEDULE_FORM: ScheduleForm = {
  label: '', amount: '', goal: '', frequency: 'annual',
  startDate: '', endDate: '', description: '', required: true,
  beneficiaryIds: [],
}

/** A stored row, as the editor's form. */
function formOfSchedule(s: DuesSchedule): ScheduleForm {
  return {
    label: s.label,
    amount: (s.amount_cents / 100).toFixed(2),
    goal: s.goal_cents ? (s.goal_cents / 100).toFixed(2) : '',
    frequency: s.frequency,
    startDate: s.start_date ?? '',
    endDate: s.end_date ?? '',
    description: s.description ?? '',
    required: s.required,
    beneficiaryIds: s.beneficiary_person_ids,
  }
}

/**
 * Required vs optional, for a dues schedule.
 *
 * A checkbox rather than a select, and phrased as the AFFIRMATIVE ("Required") rather
 * than as an opt-out ("Optional"), because required is the default and the safer reading:
 * an admin who never touches this control has created something every member owes, which
 * is what a dues schedule has always been.
 *
 * The hint spells out the consequence rather than restating the label. "Optional" on its
 * own does not tell an admin that members will be able to decline it, and that is the
 * whole difference the flag makes.
 */
function RequiredToggle({ checked, onChange }: {
  checked: boolean
  onChange: (next: boolean) => void
}) {
  return (
    <div className="space-y-1.5">
      <label className="flex cursor-pointer items-center gap-2 select-none">
        <input
          type="checkbox"
          checked={checked}
          onChange={e => onChange(e.target.checked)}
          className="h-4 w-4 rounded border-input accent-primary"
        />
        <span className="text-sm font-medium">Required</span>
      </label>
      <p className="text-xs text-muted-foreground">
        {checked
          ? 'Every member owes this and cannot decline it.'
          : 'Members can opt out of this from My Summary, and it will not count toward what they owe.'}
      </p>
    </div>
  )
}

/**
 * The fields, once — used by BOTH the create dialog and the edit dialog.
 *
 * They were two near-identical copies before, differing only in ways nobody had decided:
 * the editor had no placeholders, no required markers and no goal hint, because it had
 * been written second. Now the same block renders in both, and the two things that
 * genuinely differ arrive as props with a reason attached.
 *
 * `locked` freezes what a posted payment has already fixed. It is advisory — the action
 * re-derives it and 20260807000001's trigger enforces it against the service-role client
 * the action writes through — so disabling the input is about not offering an edit that is
 * going to be refused, not about being the thing that refuses it.
 *
 * `endDateMin` is the editor's only other addition: an existing due may not have its end
 * date MOVED into the past, because that would retire it behind the payments already
 * recorded against it. Creating one with a past end date stays allowed, deliberately —
 * that is how a treasurer enters last year's dues in order to record its history.
 */
function ScheduleFields({ kind, form, onChange, members, locked = false, endDateMin, autoFocus = false }: {
  kind: ScheduleKind
  form: ScheduleForm
  onChange: (patch: Partial<ScheduleForm>) => void
  members: BeneficiaryOption[]
  locked?: boolean
  endDateMin?: string
  autoFocus?: boolean
}) {
  const copy = KIND_COPY[kind]
  const isDonation = kind === 'donation'
  return (
    <>
      <div className="space-y-1.5">
        <Label>Name <span className="text-destructive">*</span></Label>
        <Input
          value={form.label}
          onChange={e => onChange({ label: e.target.value })}
          placeholder={copy.labelPlaceholder}
          autoFocus={autoFocus}
        />
      </div>

      {/* The one place the two kinds really differ. Dues state what is owed and how
          often; a donation states a target and nothing else, because it asks for no
          particular amount and does not recur. */}
      {isDonation ? (
        <div className="space-y-1.5">
          <Label>Goal Amount <span className="text-destructive">*</span></Label>
          <Input type="number" min="0" step="0.01" value={form.goal}
            onChange={e => onChange({ goal: e.target.value })} placeholder={copy.amountPlaceholder} />
          <p className="text-xs text-muted-foreground">
            What each member is encouraged to reach. Advisory — members give what they
            like, and may go past it.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label>Due Amount <span className="text-destructive">*</span></Label>
            <Input type="number" min="0" step="0.01" disabled={locked} value={form.amount}
              onChange={e => onChange({ amount: e.target.value })} placeholder={copy.amountPlaceholder} />
          </div>
          {/* Amount and frequency travel together: annualTotalCents is one multiplied by
              the other, so freezing the amount alone would leave the same restatement one
              field over. */}
          <div className="space-y-1.5">
            <Label>Frequency</Label>
            <Select value={form.frequency} disabled={locked} onChange={e => onChange({ frequency: e.target.value })}>
              {FREQ_OPTIONS.map(f => <option key={f} value={f}>{f.charAt(0).toUpperCase() + f.slice(1)}</option>)}
            </Select>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div className="space-y-1.5">
          {/* Both kinds name these the same. Only dues carry the "(optional)" hint, which
              is where the wording already was. */}
          <Label>Start Date{!isDonation && ' (optional)'}</Label>
          <Input type="date" disabled={locked} value={form.startDate}
            onChange={e => onChange({ startDate: e.target.value })} />
        </div>
        <div className="space-y-1.5">
          <Label>End Date{!isDonation && ' (optional)'}</Label>
          {/* `min` is the browser's local today, which is the honest boundary to show; the
              action and the trigger allow a day of timezone slack so an evening in Pacific
              time is not refused its own date. */}
          <Input type="date" min={endDateMin} value={form.endDate}
            onChange={e => onChange({ endDate: e.target.value })} />
        </div>
      </div>

      {/* Dues only. A donation is optional by definition — the field would be a checkbox
          that cannot be unticked. */}
      {!isDonation && <RequiredToggle checked={form.required} onChange={next => onChange({ required: next })} />}

      {/* Donations only, and not for want of a use on dues: a bill nobody can see is a
          bill that silently never gets paid, so the guard trigger in 20260811000000
          refuses a beneficiary on a dues row outright. */}
      {isDonation && (
        <PersonMultiSelect
          people={members}
          selected={form.beneficiaryIds}
          onChange={next => onChange({ beneficiaryIds: next })}
          label="This drive is for (optional)"
          // Spelled out rather than left to the word "beneficiary". Ticking a name here
          // does something no other control in Accounting does — takes a page away from
          // someone holding every grant the family can confer — and the switch that
          // would normally undo that, on Members & Access, has no power over this one.
          hint={`Anyone named here cannot see this drive anywhere in ${APP_NAME} — not the `
            + 'goal, not the progress, not a single gift to it. That holds for '
            + 'administrators too, so a collection can be kept from the person it is '
            + 'meant to surprise. Everyone else sees who it is for.'}
        />
      )}

      <div className="space-y-1.5">
        <Label>Description (optional)</Label>
        <Input value={form.description} onChange={e => onChange({ description: e.target.value })}
          placeholder={`What this ${copy.noun} is for…`} />
      </div>
    </>
  )
}

/**
 * "Martha Allen and George Allen", or null when there is nothing to say.
 *
 * Null rather than an empty string so `MetaIf` drops the whole item, prefix included —
 * a bare "For" on every ordinary drive would be noise on the rows that are the norm.
 *
 * An id with no matching member resolves to nothing and is skipped: `members` is the
 * adult roster and a beneficiary could in principle have been removed from it, in which
 * case the drive is still hidden from them and this caption simply says less. Never
 * render a raw uuid at a reader.
 */
function beneficiaryCaption(s: DuesSchedule, members: BeneficiaryOption[]): string | null {
  if (s.kind !== 'donation' || s.beneficiary_person_ids.length === 0) return null
  const names = s.beneficiary_person_ids
    .map(id => members.find(m => m.id === id))
    .filter((m): m is BeneficiaryOption => !!m)
    .map(m => disambiguatedName(m, members))
  if (names.length === 0) return null
  if (names.length === 1) return names[0]
  return `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}`
}

/** What is frozen once a schedule has been transacted against, in the editor's words. */
const LOCK_NOTE: Record<ScheduleKind, string> = {
  dues: 'Payments have been recorded against this due, so its start date, amount and frequency are fixed — every one of those payments was made against these terms. The end date can still change.',
  donation: 'This donation has received funds, so its start date is fixed.',
}

export function AdminIncomeClient({
  section, creating, onCloseCreate, initialSchedules, scheduleUsage, rights, members,
}: Props) {
  // The section on screen decides which grant applies: a Dues row is governed by
  // admin/account/dues, a Donation row by admin/account/donations.
  const mayEdit = rights[section]?.edit ?? false
  const mayDelete = rights[section]?.delete ?? false
  // Dues and Donations share one schedule form; which rail button was pressed is the
  // only thing that tells them apart.
  const creatingKind: ScheduleKind | null =
    creating === 'dues' ? 'dues' : creating === 'donations' ? 'donation' : null
  const confirm = useConfirm()
  // `useServerState`, not `useState`: the shell keeps this panel mounted across
  // section switches, so a plain initializer would be read exactly once per visit and
  // every later server render ignored — which is why a freshly added schedule used to
  // show up only after leaving the page.
  const [schedules, setSchedules] = useServerState(initialSchedules)
  // Section lives in AdminAccountShell now. Aliased to `tab` so every panel guard
  // below stays identical to the tab-strip version.
  const tab: AccountSection = section
  const [error, setError] = useState('')
  const [isPending, startTransition] = useTransition()

  // ── New schedule form ──
  // Lives in a modal opened from the sub-nav, but its fields stay on the component:
  // closing the dialog (or switching section) keeps whatever was typed, the same way
  // the inline card used to. Only a successful create clears them.
  // `required` defaults true, which is what every schedule in the table meant before the
  // flag existed.
  const [newForm, setNewForm] = useState<ScheduleForm>(EMPTY_SCHEDULE_FORM)
  const patchNew = (patch: Partial<ScheduleForm>) => setNewForm(f => ({ ...f, ...patch }))

  // ── Edit schedule ──
  // WHICH row is being edited, as one object rather than four parallel useStates — every
  // field of it is a fact about that row and they are only ever set together.
  //
  // `kind` and `locked` are fixed at the moment the editor opens, from the ROW: which
  // fields to show and which of them are frozen are properties of the thing being edited,
  // not of the pane it was opened from (always the same page today, but the row is the
  // truth). `name` is the label as STORED, so the dialog can keep saying which record it
  // is after the name field has been typed in.
  const [editing, setEditing] = useState<{
    id: string; kind: ScheduleKind; name: string; locked: boolean
  } | null>(null)
  const [editForm, setEditForm] = useState<ScheduleForm>(EMPTY_SCHEDULE_FORM)
  const patchEdit = (patch: Partial<ScheduleForm>) => setEditForm(f => ({ ...f, ...patch }))

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

  // Same trick for the dialogs: their triggers belong to the shell, so this component
  // never sees the click that opens one and cannot clear a stale message there.
  const [prevCreating, setPrevCreating] = useState(creating)
  if (prevCreating !== creating) {
    setPrevCreating(creating)
    setError('')
    // The calendar opens on today. Only the start date: an end date of today would
    // retire a brand-new schedule the day it was created, and the field says
    // "(optional)" for dues because leaving it open is the normal case.
    if (creating) patchNew({ startDate: todayLocal(), required: true })
  }

  // Which kind this pane is showing. The Dues and Donations pages are the same list
  // over the same table, split by kind — so one block renders both, and `copy`
  // carries every word that differs.
  const kind: ScheduleKind = tab === 'donations' ? 'donation' : 'dues'
  const copy = KIND_COPY[creatingKind ?? kind]
  const visibleSchedules = schedules.filter(s => s.kind === kind)

  function startEdit(s: DuesSchedule) {
    // A due is locked by ANY payment against it, a donation only by money actually
    // received — see ScheduleUsage for why the two differ.
    const usage = scheduleUsage[s.id]
    setEditing({
      id: s.id,
      kind: s.kind,
      name: s.label,
      locked: s.kind === 'donation' ? (usage?.funded ?? false) : (usage?.used ?? false),
    })
    setEditForm(formOfSchedule(s))
    setError('')
  }

  function cancelEdit() { setEditing(null); setError('') }

  async function handleSaveEdit() {
    if (!editing) return
    // Keyed off the ROW's kind, not the pane's: the row is what is being saved. Read once,
    // so the closure that runs after the await cannot see a different row.
    const { id, kind: editKind } = editing
    const isDonation = editKind === 'donation'
    if (!editForm.label) { setError('Name required'); return }
    if (isDonation && !editForm.goal) { setError('A donation needs a goal'); return }
    if (!isDonation && !editForm.amount) { setError('Amount required'); return }

    // Only when the value MOVES. A due that ended last March can still have its name
    // corrected, and rejecting the save over an end date nobody touched would make that
    // impossible. `min` on the input already discourages it; this is the message.
    const stored = schedules.find(s => s.id === id)
    if (!isDonation
        && editForm.endDate
        && editForm.endDate !== (stored?.end_date ?? '')
        && editForm.endDate < todayLocal()) {
      setError('The end date cannot be in the past.')
      return
    }

    const goalCents = editForm.goal ? Math.round(parseFloat(editForm.goal) * 100) : null
    const amountCents = Math.round(parseFloat(editForm.amount || '0') * 100)
    // The confirm now opens on top of the edit dialog. That works — it portals to body at
    // z-[100] — and it is the reason ConfirmDialog takes Escape in the capture phase; see
    // the comment there.
    const ok = await confirm({
      title: `Save ${KIND_COPY[editKind].noun}`,
      description: isDonation
        ? `Apply your edits to "${editForm.label}" (goal ${formatDollars(goalCents ?? 0)})?`
        : `Apply your edits to "${editForm.label}" (${formatDollars(amountCents)} ${editForm.frequency})?`,
      confirmLabel: 'Save changes',
    })
    if (!ok) return
    setError('')
    startTransition(async () => {
      // Only the fields this kind owns go over the wire. The action pins the rest
      // regardless, but sending an amount for a donation would be asking it to
      // ignore us.
      // `required` travels with amount and frequency because it is the same kind of
      // fact — what the member owes. A donation never carries it; the action forces it
      // false and a CHECK holds it there.
      const changes = isDonation
        // Always sent for a donation, including as []: `undefined` means "not sent" to
        // the action and leaves the set alone, so an omitted key could never REMOVE the
        // last beneficiary. Un-hiding a drive has to be expressible.
        ? { goal_cents: goalCents, beneficiary_person_ids: editForm.beneficiaryIds }
        : { amount_cents: amountCents, frequency: editForm.frequency, required: editForm.required }
      const result = await updateDuesSchedule(id, {
        label: editForm.label,
        start_date: editForm.startDate || null,
        end_date: editForm.endDate || null,
        description: editForm.description.trim() || null,
        ...changes,
      })
      if (!result.success) { setError(result.message ?? 'Failed'); return }
      setSchedules(prev => prev.map(s => s.id === id
        ? {
            ...s,
            label: editForm.label,
            start_date: editForm.startDate || null,
            end_date: editForm.endDate || null,
            description: editForm.description || null,
            ...changes,
          }
        : s
      ))
      setEditing(null)
    })
  }

  function handleCreateSchedule() {
    // The dialog cannot be open without a kind, but read it once so the closure that
    // runs after the await cannot see a different one.
    const newKind = creatingKind ?? 'dues'
    const isDonation = newKind === 'donation'
    if (!newForm.label) { setError('Name required'); return }
    if (isDonation && !newForm.goal) { setError('A donation needs a goal'); return }
    if (!isDonation && !newForm.amount) { setError('Amount required'); return }
    setError('')
    startTransition(async () => {
      const result = await createDuesSchedule({
        label: newForm.label,
        // A donation asks for nothing per period and does not recur; the action pins
        // both of these itself, and passing them keeps the type honest.
        amount_cents: isDonation ? 0 : Math.round(parseFloat(newForm.amount) * 100),
        frequency: isDonation ? 'one-time' : newForm.frequency,
        goal_cents: isDonation ? Math.round(parseFloat(newForm.goal) * 100) : null,
        // Forced false for a donation rather than sent as-is: nobody owes a gift, and
        // the CHECK in 20260807000003 would refuse the row anyway.
        required: isDonation ? false : newForm.required,
        due_month: null,
        due_day: null,
        start_date: newForm.startDate || null,
        end_date: newForm.endDate || null,
        description: newForm.description.trim() || null,
        kind: newKind,
        // Empty for dues, and the action drops it there anyway rather than trusting
        // this line — same belt-and-braces as `required` above.
        beneficiary_person_ids: isDonation ? newForm.beneficiaryIds : [],
      })
      if (!result.success || !result.schedule) { setError(result.message ?? 'Failed'); return }
      // Show it straight away, in the server's order (`getDuesSchedules` sorts by
      // label), so the list reads the same before and after the next refresh.
      const created = result.schedule
      setSchedules(prev => [...prev, created].sort((a, b) => a.label.localeCompare(b.label)))
      setNewForm(EMPTY_SCHEDULE_FORM)
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
            className="max-w-lg"
          >
            <div className="space-y-3 mt-2">
              <ScheduleFields
                kind={creatingKind ?? kind}
                form={newForm}
                onChange={patchNew}
                members={members}
                autoFocus
              />
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

          {/* ── Edit, in a dialog ──
              It used to take over the row it belonged to: a full-width `colSpan` cell
              holding eight fields inside the table it was editing. That is what the table
              had to grow around, and it cost more than it looked like. The row's own
              columns vanished while you edited it, so the values you were changing were no
              longer next to the values you were changing them against; the table jumped by
              a couple of hundred pixels on every pencil click; and on a phone the form was
              inside a horizontally scrolling container, so half of it sat off-screen.

              A dialog also means the editor and the create form can be the same fields —
              they are, now, via ScheduleFields — because they finally have the same amount
              of room to be the same in.

              `editing` carries the row, so the dialog cannot be open without one, and the
              fields it shows follow the ROW's kind rather than the pane's. */}
          <Dialog
            open={editing !== null}
            onClose={cancelEdit}
            title={editing ? KIND_COPY[editing.kind].editTitle : ''}
            /* The name as STORED, so it still says which record this is after the Name
               field has been typed in. */
            description={editing?.name}
            className="max-w-lg"
          >
            {editing && (
              <div className="space-y-3 mt-2">
                {/* Said once, above the fields it explains, rather than as a tooltip on
                    each disabled input: a greyed-out box with no reason beside it reads as
                    a bug. */}
                {editing.locked && (
                  <p className="rounded-lg border bg-muted/40 px-3 py-2 text-xs text-muted-foreground">
                    {LOCK_NOTE[editing.kind]}
                  </p>
                )}
                <ScheduleFields
                  kind={editing.kind}
                  form={editForm}
                  onChange={patchEdit}
                  members={members}
                  locked={editing.locked}
                  endDateMin={editing.kind === 'dues' ? todayLocal() : undefined}
                  autoFocus
                />
                {error && <p className="text-sm text-destructive">{error}</p>}
                <div className="flex gap-2 pt-1">
                  <Button className="flex-1" onClick={handleSaveEdit} disabled={isPending}>
                    {isPending ? 'Saving…' : 'Save changes'}
                  </Button>
                  <Button variant="outline" onClick={cancelEdit} disabled={isPending}>
                    Cancel
                  </Button>
                </div>
              </div>
            )}
          </Dialog>

          {/* A table, matching Member Directory and the Funds pane. The columns differ by
              kind because the two kinds ARE different facts: dues state what is owed, how
              often, and whether it can be declined; a donation states a target.
              Nothing about editing lives in here any more — the pencil opens the dialog
              above, so a row is only ever a row and the table's shape never changes under
              the reader. */}
          {visibleSchedules.length > 0 && (
            /* Everything but Name, the money figure and the row's controls folds below
               `sm` — see components/ui/table-collapse.tsx. The two dates fold as a PAIR
               and are restated as a single range, because "1 Jan 2026 · 31 Dec 2026" is
               one fact about a schedule and two columns were only ever the way to line
               them up. */
            <div className="overflow-visible rounded-xl border">
              <table className="w-full border-collapse text-sm">
                <thead>
                  <tr className="border-b bg-muted/40 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    <th scope="col" className="px-3 py-2 font-semibold">Name</th>
                    {kind === 'donation' ? (
                      <th scope="col" className="px-3 py-2 text-right font-semibold">Goal</th>
                    ) : (
                      <>
                        <th scope="col" className="px-3 py-2 text-right font-semibold">Due Amount</th>
                        <th scope="col" className={cn('px-3 py-2 font-semibold', COLLAPSING_CELL)}>Frequency</th>
                        <th scope="col" className={cn('px-3 py-2 font-semibold', COLLAPSING_CELL)}>Payment</th>
                      </>
                    )}
                    <th scope="col" className={cn('px-3 py-2 font-semibold', COLLAPSING_CELL)}>Start Date</th>
                    <th scope="col" className={cn('px-3 py-2 font-semibold', COLLAPSING_CELL)}>End Date</th>
                    <th scope="col" className="px-3 py-2 font-semibold"><span className="sr-only">Actions</span></th>
                  </tr>
                </thead>
                <tbody>
              {visibleSchedules.map(s => (
                <tr key={s.id} className="border-b align-top last:border-0 sm:align-middle">
                      <td className="px-3 py-2.5">
                        {/* Description on hover, matching how a member sees the same
                            field in My Summary. Underlined only when there is
                            one, so the hint never promises an empty tooltip. */}
                        <span
                          className={cn('font-medium', s.description && 'cursor-help underline decoration-dotted decoration-muted-foreground/50 underline-offset-2')}
                          title={s.description ?? undefined}
                        >
                          {s.label}
                        </span>
                        <RowMeta className="gap-x-2">
                          {s.kind !== 'donation' && (
                            <>
                              <span className="capitalize">{s.frequency}</span>
                              <span className={cn(
                                'inline-block whitespace-nowrap rounded-full px-2 py-0.5 text-[11px] font-medium',
                                s.required
                                  ? 'bg-brand-soft text-brand-on-soft'
                                  : 'bg-brand-warm text-brand-on-warm',
                              )}>
                                {s.required ? 'Required' : 'Optional'}
                              </span>
                            </>
                          )}
                          <MetaIf value={dateRange(s.start_date, s.end_date)} />
                          {/* Who the drive is for — which is also the list of people it
                              is hidden from, so it earns a place on the row rather than
                              living only inside the editor. A reader seeing this caption
                              is by definition not on it: the row would not have come
                              back from the database at all if they were. */}
                          <MetaIf value={beneficiaryCaption(s, members)} prefix="For" />
                        </RowMeta>
                      </td>
                      {s.kind === 'donation' ? (
                        <td className="px-3 py-2.5 text-right font-medium whitespace-nowrap">
                          {formatDollars(s.goal_cents ?? 0)}
                        </td>
                      ) : (
                        <>
                          <td className="px-3 py-2.5 text-right font-medium whitespace-nowrap">
                            {formatDollars(s.amount_cents)}
                          </td>
                          <td className={cn('px-3 py-2.5 capitalize text-muted-foreground', COLLAPSING_CELL)}>{s.frequency}</td>
                          <td className={cn('px-3 py-2.5', COLLAPSING_CELL)}>
                            {/* Required takes the resting pill and Optional the filled
                                Warmth chip, because optional is the exception worth
                                spotting — it is the row a member can decline. Warmth
                                and not gold: this is a category the schedule belongs
                                to, not a state anybody has to act on. */}
                            <span className={cn(
                              'inline-block whitespace-nowrap rounded-full px-2 py-0.5 text-[11px] font-medium',
                              s.required
                                ? 'bg-brand-soft text-brand-on-soft'
                                : 'bg-brand-warm text-brand-on-warm',
                            )}>
                              {s.required ? 'Required' : 'Optional'}
                            </span>
                          </td>
                        </>
                      )}
                      <td className={cn('px-3 py-2.5 whitespace-nowrap text-muted-foreground', COLLAPSING_CELL)}>
                        {formatDate(s.start_date) ?? '—'}
                      </td>
                      <td className={cn('px-3 py-2.5 whitespace-nowrap text-muted-foreground', COLLAPSING_CELL)}>
                        {formatDate(s.end_date) ?? '—'}
                      </td>
                      <td className="w-px px-3 py-2.5">
                        <div className="flex items-center justify-end gap-1">
                          {mayEdit && (
                            <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={() => startEdit(s)}>
                              <Pencil className="h-3.5 w-3.5" />
                            </Button>
                          )}
                          {mayDelete && (
                            <Button size="sm" variant="ghost" className="h-7 w-7 p-0 text-destructive hover:text-destructive" onClick={() => handleDeleteSchedule(s.id)}>
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
        </div>
      )}

    </div>
  )
}
