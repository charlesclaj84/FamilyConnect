'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { ChevronLeft, ChevronDown, Pencil, Plus, Check, X, UserPlus, UserMinus, Trash2, Lock, ArrowUp, ArrowDown } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { useConfirm } from '@/components/ui/confirm'
import {
  publishEvent, approveEvent, cancelEvent, updateEvent, deleteEvent,
  assignBlueprintItem, unassignBlueprintItem, approveAssignmentResponse,
  updateAssignmentDueDate,
  createSubEvent, moveSubEvent,
  getHotelBookings, createHotelBooking, updateHotelBooking, deleteHotelBooking,
  addPriceEstimate, deletePriceEstimate,
  addHotelDetail, deleteHotelDetail,
  getEventBudgetItems, addEventBudgetItem, deleteEventBudgetItem,
  getEventExpenses, recordEventExpense, deleteEventExpense, setEventFund,
  closeBudget,
  type AdminEvent, type EventAssignment, type EventReport,
  type HotelBooking, type PriceEstimate, type HotelBookingDetail,
  type EventBudgetItem, type EventExpense,
} from '@/app/actions/admin/events'
import type { BlueprintItem } from '@/app/actions/admin/event-types'
import type { MemberWithRoles } from '@/app/actions/admin/users'
import { AddressSelects } from '@/components/ui/AddressSelects'
import { COUNTRIES, REGIONS, type Country } from '@/lib/regions'
import { formatCurrency, dollarsToCents } from '@/lib/currency-utils'
import { formatDate } from '@/lib/date-utils'
import { cn } from '@/lib/utils'

interface BudgetFund { id: string; name: string; event_id: string | null }

const STATUS_COLORS: Record<AdminEvent['status'], string> = {
  draft:     'bg-muted text-muted-foreground',
  published: 'bg-blue-100 text-blue-700',
  approved:  'bg-green-100 text-green-700',
  cancelled: 'bg-red-100 text-red-700',
}

const RESPONSE_STATUS_COLORS = {
  pending:   'text-muted-foreground',
  submitted: 'text-blue-600',
  approved:  'text-green-600',
  cancelled: 'text-destructive',
}

interface Props {
  report: EventReport
  assignments: EventAssignment[]
  blueprintItems: BlueprintItem[]
  members: MemberWithRoles[]
  canApprove: boolean
  initialSubEvents: AdminEvent[]
  eventTypes: import('@/app/actions/admin/event-types').EventType[]
  funds: BudgetFund[]
}

// ── Collapsible section wrapper ─────────────────────────────────────────────────

// A Card whose body collapses behind its title. `action` renders to the right of
// the title (e.g. an Add or Close button). When `canToggle` is false the header
// stays expanded and the chevron is dimmed — used to keep an open budget visible.
function CollapsibleSection({ title, open, onToggle, canToggle = true, action, children }: {
  title: React.ReactNode
  open: boolean
  onToggle: () => void
  canToggle?: boolean
  action?: React.ReactNode
  children: React.ReactNode
}) {
  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between gap-2">
          <button
            type="button"
            onClick={canToggle ? onToggle : undefined}
            aria-expanded={open}
            disabled={!canToggle}
            className={cn('flex items-center gap-2 min-w-0 flex-1 text-left', canToggle ? 'cursor-pointer' : 'cursor-default')}
          >
            <ChevronDown className={cn('h-4 w-4 shrink-0 text-muted-foreground transition-transform', open ? '' : '-rotate-90', !canToggle && 'opacity-30')} />
            <CardTitle className="truncate">{title}</CardTitle>
          </button>
          {action && <div className="shrink-0">{action}</div>}
        </div>
      </CardHeader>
      {open && children}
    </Card>
  )
}

// ── Edit Event Form ────────────────────────────────────────────────────────────

function EventFormFields({ form, setForm, isSubEvent = false }: {
  form: Record<string, string>
  setForm: React.Dispatch<React.SetStateAction<Record<string, string>>>
  isSubEvent?: boolean
}) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
      <div className="space-y-1.5 sm:col-span-2">
        <Label>Name <span className="text-destructive">*</span></Label>
        <Input value={form.name ?? ''} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} />
      </div>
      <div className="space-y-1.5 sm:col-span-2">
        <Label>Description</Label>
        <Input value={form.description ?? ''} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} />
      </div>
      <div className="space-y-1.5 sm:col-span-2">
        <Label>Official Description <span className="text-muted-foreground text-xs">(published to Upcoming Events)</span></Label>
        <textarea
          className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm min-h-[72px] resize-y"
          value={form.official_description ?? ''}
          onChange={e => setForm(f => ({ ...f, official_description: e.target.value }))}
          placeholder="Publicly visible information about this event…"
        />
      </div>
      <div className="space-y-1.5">
        <Label>Budget ($)</Label>
        <Input
          type="number"
          min="0"
          step="0.01"
          placeholder="0.00"
          value={form.budget_dollars ?? ''}
          onChange={e => setForm(f => ({ ...f, budget_dollars: e.target.value }))}
        />
      </div>
      <div className="space-y-1.5">
        <Label>Start Date</Label>
        <Input type="date" value={form.start_date ?? ''} onChange={e => setForm(f => ({ ...f, start_date: e.target.value }))} />
      </div>
      <div className="space-y-1.5">
        <Label>End Date</Label>
        <Input type="date" value={form.end_date ?? ''} onChange={e => setForm(f => ({ ...f, end_date: e.target.value }))} />
      </div>

      {/* All Day toggle */}
      <div className="sm:col-span-2 flex items-center gap-2 py-1">
        <input
          id="is_all_day"
          type="checkbox"
          checked={form.is_all_day !== 'false'}
          onChange={e => setForm(f => ({ ...f, is_all_day: e.target.checked ? 'true' : 'false', start_time: '', end_time: '' }))}
          className="h-4 w-4 rounded border-input accent-primary"
        />
        <label htmlFor="is_all_day" className="text-sm cursor-pointer select-none">All Day</label>
      </div>

      {form.is_all_day === 'false' && (
        <>
          <div className="space-y-1.5">
            <Label>Start Time</Label>
            <Input type="time" value={form.start_time ?? ''} onChange={e => setForm(f => ({ ...f, start_time: e.target.value }))} />
          </div>
          <div className="space-y-1.5">
            <Label>End Time</Label>
            <Input type="time" value={form.end_time ?? ''} onChange={e => setForm(f => ({ ...f, end_time: e.target.value }))} />
          </div>
        </>
      )}
      {!isSubEvent && (
        <div className="space-y-1.5">
          <Label>RSVP Deadline</Label>
          <Input type="date" value={form.rsvp_deadline ?? ''} onChange={e => setForm(f => ({ ...f, rsvp_deadline: e.target.value }))} />
        </div>
      )}
      <div className="space-y-1.5">
        <Label>Venue / Location Name</Label>
        <Input placeholder="e.g. Grand Ballroom" value={form.location ?? ''} onChange={e => setForm(f => ({ ...f, location: e.target.value }))} />
      </div>
      {/* Country first, then address */}
      <div className="space-y-1.5 sm:col-span-2">
        <Label htmlFor="ef_country">Country</Label>
        <select id="ef_country" className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm" value={form.country ?? ''} onChange={e => setForm(f => ({ ...f, country: e.target.value, state: '' }))}>
          <option value="">— Select country —</option>
          {COUNTRIES.map(c => <option key={c} value={c}>{c}</option>)}
        </select>
      </div>
      <div className="space-y-1.5">
        <Label>Street Address</Label>
        <Input placeholder="123 Main St" value={form.street_address ?? ''} onChange={e => setForm(f => ({ ...f, street_address: e.target.value }))} />
      </div>
      <div className="space-y-1.5">
        <Label>Suite / Apt</Label>
        <Input placeholder="Suite 200" value={form.suite ?? ''} onChange={e => setForm(f => ({ ...f, suite: e.target.value }))} />
      </div>
      <div className="space-y-1.5">
        <Label>City</Label>
        <Input value={form.city ?? ''} onChange={e => setForm(f => ({ ...f, city: e.target.value }))} />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="ef_state">State / Province</Label>
        {form.country && form.country in REGIONS ? (
          <select id="ef_state" className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm" value={form.state ?? ''} onChange={e => setForm(f => ({ ...f, state: e.target.value }))}>
            <option value="">— Select state —</option>
            {REGIONS[form.country as Country].map(r => <option key={r} value={r}>{r}</option>)}
          </select>
        ) : (
          <Input id="ef_state" value={form.state ?? ''} onChange={e => setForm(f => ({ ...f, state: e.target.value }))} />
        )}
      </div>
      <div className="space-y-1.5">
        <Label>Zip Code</Label>
        <Input value={form.zip_code ?? ''} onChange={e => setForm(f => ({ ...f, zip_code: e.target.value }))} />
      </div>
    </div>
  )
}

function EditEventForm({ event, onSaved, onCancel }: { event: AdminEvent; onSaved: (e: Partial<AdminEvent>) => void; onCancel: () => void }) {
  const [form, setForm] = useState<Record<string, string>>({
    name:                event.name,
    description:         event.description ?? '',
    official_description: event.official_description ?? '',
    budget_dollars:      event.budget_amount_cents > 0 ? (event.budget_amount_cents / 100).toFixed(2) : '',
    start_date:          event.start_date ?? '',
    end_date:            event.end_date ?? '',
    is_all_day:          event.is_all_day === false ? 'false' : 'true',
    start_time:          event.start_time ?? '',
    end_time:            event.end_time ?? '',
    location:            event.location ?? '',
    street_address:      event.street_address ?? '',
    suite:               event.suite ?? '',
    city:                event.city ?? '',
    state:               event.state ?? '',
    zip_code:            event.zip_code ?? '',
    country:             event.country ?? '',
    rsvp_deadline:       event.rsvp_deadline ?? '',
  })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const confirm = useConfirm()

  async function handleSave() {
    if (!form.name.trim()) { setError('Name is required'); return }
    const ok = await confirm({
      title: 'Save event changes',
      description: `Apply your edits to "${event.name}"?`,
      confirmLabel: 'Save changes',
    })
    if (!ok) return
    setSaving(true)
    const isAllDay = form.is_all_day !== 'false'
    const result = await updateEvent(event.id, {
      ...form,
      is_all_day: isAllDay,
      start_time: isAllDay ? undefined : form.start_time || undefined,
      end_time:   isAllDay ? undefined : form.end_time || undefined,
      budget_amount_cents: form.budget_dollars ? Math.round(parseFloat(form.budget_dollars) * 100) : 0,
      official_description: form.official_description || undefined,
    })
    if (!result.success) { setError(result.error ?? 'Error'); setSaving(false); return }
    onSaved(form)
  }

  return (
    <Card className="border-primary/30 bg-primary/5">
      <CardContent className="pt-4 space-y-3">
        <EventFormFields form={form} setForm={setForm} />
        {error && <p className="text-sm text-destructive">{error}</p>}
        <div className="flex gap-2">
          <Button disabled={saving} onClick={handleSave}>{saving ? 'Saving…' : 'Save Changes'}</Button>
          <Button variant="outline" onClick={onCancel}>Cancel</Button>
        </div>
      </CardContent>
    </Card>
  )
}

// ── Sub-event form ─────────────────────────────────────────────────────────────

function AddSubEventForm({ parentId, eventTypes, onAdded, onCancel }: {
  parentId: string
  eventTypes: import('@/app/actions/admin/event-types').EventType[]
  onAdded: (e: AdminEvent) => void
  onCancel: () => void
}) {
  const [form, setForm] = useState<Record<string, string>>({ name: '', description: '', official_description: '', budget_dollars: '', start_date: '', end_date: '', is_all_day: 'true', start_time: '', end_time: '', location: '', street_address: '', suite: '', city: '', state: '', zip_code: '', country: '', event_type_id: '' })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  async function handleSave() {
    if (!form.name.trim()) { setError('Name is required'); return }
    setSaving(true)
    const isAllDay = form.is_all_day !== 'false'
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const result = await createSubEvent(parentId, {
      ...(form as any),
      is_all_day: isAllDay,
      start_time: isAllDay ? undefined : form.start_time || undefined,
      end_time:   isAllDay ? undefined : form.end_time || undefined,
      budget_amount_cents: form.budget_dollars ? Math.round(parseFloat(form.budget_dollars) * 100) : 0,
      official_description: form.official_description || undefined,
    })
    if (!result.success) { setError(result.error ?? 'Error'); setSaving(false); return }
    window.location.reload()
  }

  return (
    <Card className="border-primary/30 bg-primary/5">
      <CardContent className="pt-4 space-y-3">
        <div className="space-y-1.5">
          <Label>Event Template <span className="text-muted-foreground text-xs">(optional — adds a planning checklist)</span></Label>
          <select className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm" value={form.event_type_id} onChange={e => setForm(f => ({ ...f, event_type_id: e.target.value }))}>
            <option value="">— None —</option>
            {eventTypes.map(et => <option key={et.id} value={et.id}>{et.name}</option>)}
          </select>
        </div>
        <EventFormFields form={form} setForm={setForm} isSubEvent />
        {error && <p className="text-sm text-destructive">{error}</p>}
        <div className="flex gap-2">
          <Button disabled={saving} onClick={handleSave}>{saving ? 'Adding…' : 'Add Sub-Event'}</Button>
          <Button variant="outline" onClick={onCancel}>Cancel</Button>
        </div>
      </CardContent>
    </Card>
  )
}

// ── Hotel Bookings ─────────────────────────────────────────────────────────────

function HotelBookingsSection({ eventId, hotels, readOnly = false, open, onToggle, onLoad, onAdd, onUpdate, onDelete, onAddEstimate, onDeleteEstimate, onAddDetail, onDeleteDetail }: {
  eventId: string
  hotels: HotelBooking[]
  readOnly?: boolean
  open: boolean
  onToggle: () => void
  onLoad: () => Promise<void>
  onAdd: (b: HotelBooking) => void
  onUpdate: (id: string, patch: Partial<HotelBooking>) => void
  onDelete: (id: string) => void
  onAddEstimate: (hotelId: string, est: PriceEstimate) => void
  onDeleteEstimate: (hotelId: string, estId: string) => void
  onAddDetail: (hotelId: string, detail: HotelBookingDetail) => void
  onDeleteDetail: (hotelId: string, detailId: string) => void
}) {
  const emptyForm = { hotel_name: '', street_address: '', suite: '', city: '', state: '', zip_code: '', country: '', booking_code: '', booking_deadline: '', website: '', phone: '' }
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState(emptyForm)
  const [editingHotelId, setEditingHotelId] = useState<string | null>(null)
  const [editForm, setEditForm] = useState(emptyForm)
  const [saving, setSaving] = useState(false)
  const [addingEst, setAddingEst] = useState<string | null>(null)
  const [estForm, setEstForm] = useState({ room_type: '', amount: '' })
  const [addingDetail, setAddingDetail] = useState<string | null>(null)
  const [detailForm, setDetailForm] = useState({ key: '', value: '' })
  const confirm = useConfirm()

  // Auto-load on mount
  useEffect(() => { onLoad() }, [])  // eslint-disable-line react-hooks/exhaustive-deps

  async function handleAddHotel() {
    if (!form.hotel_name.trim()) return
    setSaving(true)
    const result = await createHotelBooking(eventId, form)
    if (result.success && result.id) {
      onAdd({ id: result.id, event_id: eventId, hotel_name: form.hotel_name, street_address: form.street_address || null, suite: form.suite || null, city: form.city || null, state: form.state || null, zip_code: form.zip_code || null, country: form.country || null, booking_code: form.booking_code || null, booking_deadline: form.booking_deadline || null, website: form.website || null, phone: form.phone || null, created_at: new Date().toISOString(), estimates: [], details: [] })
      setForm(emptyForm)
      setShowForm(false)
    }
    setSaving(false)
  }

  async function handleUpdateHotel() {
    if (!editingHotelId || !editForm.hotel_name.trim()) return
    const ok = await confirm({
      title: 'Save hotel booking',
      description: `Apply your edits to "${editForm.hotel_name}"?`,
      confirmLabel: 'Save changes',
    })
    if (!ok) return
    setSaving(true)
    const result = await updateHotelBooking(editingHotelId, editForm)
    if (result.success) {
      onUpdate(editingHotelId, {
        hotel_name: editForm.hotel_name, street_address: editForm.street_address || null,
        suite: editForm.suite || null, city: editForm.city || null, state: editForm.state || null,
        zip_code: editForm.zip_code || null, country: editForm.country || null,
        booking_code: editForm.booking_code || null, booking_deadline: editForm.booking_deadline || null,
        website: editForm.website || null, phone: editForm.phone || null,
      })
      setEditingHotelId(null)
    }
    setSaving(false)
  }

  async function handleAddDetail(hotelId: string) {
    if (!detailForm.key.trim() || !detailForm.value.trim()) return
    const result = await addHotelDetail(hotelId, detailForm.key, detailForm.value)
    if (result.success && result.id) {
      onAddDetail(hotelId, { id: result.id, hotel_booking_id: hotelId, key: detailForm.key, value: detailForm.value, sort_order: 0 })
      setDetailForm({ key: '', value: '' })
      setAddingDetail(null)
    }
  }

  async function handleAddEstimate(hotelId: string) {
    if (!estForm.room_type.trim() || !estForm.amount) return
    const result = await addPriceEstimate(hotelId, { room_type: estForm.room_type, amount: parseFloat(estForm.amount) })
    if (result.success && result.id) {
      onAddEstimate(hotelId, { id: result.id, hotel_booking_id: hotelId, room_type: estForm.room_type, amount: parseFloat(estForm.amount), created_at: new Date().toISOString() })
      setEstForm({ room_type: '', amount: '' })
      setAddingEst(null)
    }
  }

  return (
    <CollapsibleSection
      title="Hotel Bookings"
      open={open}
      onToggle={onToggle}
      action={!readOnly && (
        <Button size="sm" variant="outline" onClick={() => { if (!open) onToggle(); setShowForm(s => !s) }}><Plus className="h-3.5 w-3.5" /> Add Hotel</Button>
      )}
    >
      <CardContent className="space-y-4">
        {showForm && (
          <div className="rounded-lg border bg-muted/30 p-4 space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1.5 sm:col-span-2"><Label>Hotel Name <span className="text-destructive">*</span></Label><Input value={form.hotel_name} onChange={e => setForm(f => ({ ...f, hotel_name: e.target.value }))} autoFocus /></div>
              <div className="space-y-1.5"><Label>Phone Number</Label><Input type="tel" placeholder="(555) 000-0000" value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} /></div>
              <div className="space-y-1.5 sm:col-span-2"><Label>Website</Label><Input type="url" placeholder="https://..." value={form.website} onChange={e => setForm(f => ({ ...f, website: e.target.value }))} /></div>
              <div className="space-y-1.5"><Label>Booking Code</Label><Input placeholder="Group rate / reservation code" value={form.booking_code} onChange={e => setForm(f => ({ ...f, booking_code: e.target.value }))} /></div>
              <div className="space-y-1.5"><Label>Booking Deadline</Label><Input type="date" value={form.booking_deadline} onChange={e => setForm(f => ({ ...f, booking_deadline: e.target.value }))} /></div>
              {/* Country — full row */}
              <div className="space-y-1.5 sm:col-span-2">
                <Label htmlFor="hotel_country">Country</Label>
                <select id="hotel_country" className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm" value={form.country} onChange={e => setForm(f => ({ ...f, country: e.target.value, state: '' }))}>
                  <option value="">— Select country —</option>
                  {COUNTRIES.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
              {/* Address line */}
              <div className="space-y-1.5"><Label>Street Address</Label><Input value={form.street_address} onChange={e => setForm(f => ({ ...f, street_address: e.target.value }))} /></div>
              <div className="space-y-1.5"><Label>Suite / Apt</Label><Input value={form.suite} onChange={e => setForm(f => ({ ...f, suite: e.target.value }))} /></div>
              {/* City, State, Zip */}
              <div className="space-y-1.5"><Label>City</Label><Input value={form.city} onChange={e => setForm(f => ({ ...f, city: e.target.value }))} /></div>
              <div className="space-y-1.5">
                <Label htmlFor="hotel_state">State / Province</Label>
                {form.country && form.country in REGIONS ? (
                  <select id="hotel_state" className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm" value={form.state} onChange={e => setForm(f => ({ ...f, state: e.target.value }))}>
                    <option value="">— Select state —</option>
                    {REGIONS[form.country as Country].map(r => <option key={r} value={r}>{r}</option>)}
                  </select>
                ) : (
                  <Input id="hotel_state" value={form.state} onChange={e => setForm(f => ({ ...f, state: e.target.value }))} placeholder="State / Province" />
                )}
              </div>
              <div className="space-y-1.5"><Label>Zip Code</Label><Input value={form.zip_code} onChange={e => setForm(f => ({ ...f, zip_code: e.target.value }))} /></div>
            </div>
            <div className="flex gap-2">
              <Button size="sm" disabled={!form.hotel_name.trim() || saving} onClick={handleAddHotel}>{saving ? 'Saving…' : 'Add Hotel'}</Button>
              <Button size="sm" variant="outline" onClick={() => setShowForm(false)}>Cancel</Button>
            </div>
          </div>
        )}

        {hotels.length === 0 && !showForm && <p className="text-sm text-muted-foreground">No hotel bookings yet.</p>}

        {hotels.map(hotel => (
          <div key={hotel.id} className="rounded-lg border p-4 space-y-3">
            <div className="flex items-start justify-between gap-2">
              <div>
                <p className="font-medium text-sm">{hotel.hotel_name}</p>
                {hotel.booking_code && <p className="text-xs text-muted-foreground">Code: <span className="font-mono">{hotel.booking_code}</span></p>}
                {hotel.booking_deadline && <p className="text-xs text-muted-foreground">Book by: {formatDate(hotel.booking_deadline)}</p>}
                {(hotel.city || hotel.street_address) && (
                  <p className="text-xs text-muted-foreground">
                    {[hotel.street_address, hotel.suite, hotel.city, hotel.state, hotel.zip_code].filter(Boolean).join(', ')}
                  </p>
                )}
                {hotel.phone && (
                  <a href={`tel:${hotel.phone}`} className="text-xs text-primary hover:underline block">{hotel.phone}</a>
                )}
                {hotel.website && (
                  <a href={hotel.website} target="_blank" rel="noopener noreferrer" className="text-xs text-primary hover:underline truncate block max-w-[200px]">{hotel.website}</a>
                )}
              </div>
              {!readOnly && (
                <div className="flex items-center gap-1.5 shrink-0">
                  <button onClick={() => { setEditingHotelId(hotel.id); setEditForm({ hotel_name: hotel.hotel_name, phone: hotel.phone ?? '', website: hotel.website ?? '', booking_code: hotel.booking_code ?? '', booking_deadline: hotel.booking_deadline ?? '', country: hotel.country ?? '', street_address: hotel.street_address ?? '', suite: hotel.suite ?? '', city: hotel.city ?? '', state: hotel.state ?? '', zip_code: hotel.zip_code ?? '' }) }} className="text-muted-foreground hover:text-foreground transition-colors"><Pencil className="h-3.5 w-3.5" /></button>
                  <button onClick={async () => {
                    const ok = await confirm({
                      title: 'Delete hotel booking',
                      description: `Delete "${hotel.hotel_name}" and its rates and details? This cannot be undone.`,
                      confirmLabel: 'Delete booking',
                      destructive: true,
                    })
                    if (!ok) return
                    await deleteHotelBooking(hotel.id)
                    onDelete(hotel.id)
                  }} className="text-muted-foreground hover:text-destructive transition-colors"><Trash2 className="h-3.5 w-3.5" /></button>
                </div>
              )}
            </div>

            {/* Inline edit form */}
            {editingHotelId === hotel.id && (
              <div className="rounded-lg border bg-muted/30 p-3 space-y-3">
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Edit Hotel</p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <div className="space-y-1.5 sm:col-span-2"><Label>Hotel Name</Label><Input value={editForm.hotel_name} onChange={e => setEditForm(f => ({ ...f, hotel_name: e.target.value }))} /></div>
                  <div className="space-y-1.5"><Label>Phone</Label><Input type="tel" value={editForm.phone} onChange={e => setEditForm(f => ({ ...f, phone: e.target.value }))} /></div>
                  <div className="space-y-1.5 sm:col-span-2"><Label>Website</Label><Input type="url" value={editForm.website} onChange={e => setEditForm(f => ({ ...f, website: e.target.value }))} /></div>
                  <div className="space-y-1.5"><Label>Booking Code</Label><Input value={editForm.booking_code} onChange={e => setEditForm(f => ({ ...f, booking_code: e.target.value }))} /></div>
                  <div className="space-y-1.5"><Label>Booking Deadline</Label><Input type="date" value={editForm.booking_deadline} onChange={e => setEditForm(f => ({ ...f, booking_deadline: e.target.value }))} /></div>
                  <div className="space-y-1.5 sm:col-span-2">
                    <Label>Country</Label>
                    <select className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm" value={editForm.country} onChange={e => setEditForm(f => ({ ...f, country: e.target.value, state: '' }))}>
                      <option value="">— Select country —</option>
                      {COUNTRIES.map(c => <option key={c} value={c}>{c}</option>)}
                    </select>
                  </div>
                  <div className="space-y-1.5"><Label>Street Address</Label><Input value={editForm.street_address} onChange={e => setEditForm(f => ({ ...f, street_address: e.target.value }))} /></div>
                  <div className="space-y-1.5"><Label>Suite / Apt</Label><Input value={editForm.suite} onChange={e => setEditForm(f => ({ ...f, suite: e.target.value }))} /></div>
                  <div className="space-y-1.5"><Label>City</Label><Input value={editForm.city} onChange={e => setEditForm(f => ({ ...f, city: e.target.value }))} /></div>
                  <div className="space-y-1.5">
                    <Label>State / Province</Label>
                    {editForm.country && editForm.country in REGIONS ? (
                      <select className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm" value={editForm.state} onChange={e => setEditForm(f => ({ ...f, state: e.target.value }))}>
                        <option value="">— Select —</option>
                        {REGIONS[editForm.country as Country].map(r => <option key={r} value={r}>{r}</option>)}
                      </select>
                    ) : (
                      <Input value={editForm.state} onChange={e => setEditForm(f => ({ ...f, state: e.target.value }))} />
                    )}
                  </div>
                  <div className="space-y-1.5"><Label>Zip Code</Label><Input value={editForm.zip_code} onChange={e => setEditForm(f => ({ ...f, zip_code: e.target.value }))} /></div>
                </div>
                <div className="flex gap-2">
                  <Button size="sm" disabled={saving} onClick={handleUpdateHotel}>{saving ? 'Saving…' : 'Save Changes'}</Button>
                  <Button size="sm" variant="outline" onClick={() => setEditingHotelId(null)}>Cancel</Button>
                </div>
              </div>
            )}

            {/* Price estimates */}
            <div className="space-y-1.5">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Price Estimates</p>
              {hotel.estimates.length > 0 && (
                <div className="divide-y rounded border">
                  {hotel.estimates.map(est => (
                    <div key={est.id} className="flex items-center justify-between px-3 py-1.5 text-sm">
                      <span>{est.room_type}</span>
                      <div className="flex items-center gap-2">
                        <span className="font-medium">${Number(est.amount).toFixed(2)}</span>
                        {!readOnly && <button onClick={async () => {
                          const ok = await confirm({
                            title: 'Delete price estimate',
                            description: `Delete the "${est.room_type}" estimate from ${hotel.hotel_name}?`,
                            confirmLabel: 'Delete estimate',
                            destructive: true,
                          })
                          if (!ok) return
                          await deletePriceEstimate(est.id)
                          onDeleteEstimate(hotel.id, est.id)
                        }} className="text-muted-foreground hover:text-destructive"><X className="h-3 w-3" /></button>}
                      </div>
                    </div>
                  ))}
                </div>
              )}
              {readOnly ? null : addingEst === hotel.id ? (
                <div className="flex gap-2 items-center">
                  <Input placeholder="Room type" value={estForm.room_type} onChange={e => setEstForm(f => ({ ...f, room_type: e.target.value }))} className="h-7 text-sm" />
                  <Input placeholder="Amount" type="number" min="0" step="0.01" value={estForm.amount} onChange={e => setEstForm(f => ({ ...f, amount: e.target.value }))} className="h-7 text-sm w-28" />
                  <button onClick={() => handleAddEstimate(hotel.id)} className="text-primary hover:opacity-70"><Check className="h-4 w-4" /></button>
                  <button onClick={() => { setAddingEst(null); setEstForm({ room_type: '', amount: '' }) }} className="text-muted-foreground hover:opacity-70"><X className="h-4 w-4" /></button>
                </div>
              ) : (
                <button onClick={() => { setAddingEst(hotel.id); setEstForm({ room_type: '', amount: '' }) }} className="text-xs text-primary hover:opacity-70 flex items-center gap-1">
                  <Plus className="h-3 w-3" /> Add estimate
                </button>
              )}
            </div>

            {/* Key/value details */}
            <div className="space-y-1.5">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Details</p>
              {hotel.details.length > 0 && (
                <div className="divide-y rounded border">
                  {hotel.details.map(d => (
                    <div key={d.id} className="flex items-center justify-between px-3 py-1.5 text-sm">
                      <span className="text-muted-foreground shrink-0 mr-2">{d.key}</span>
                      <span className="flex-1 text-right">{d.value}</span>
                      {!readOnly && <button onClick={async () => {
                        const ok = await confirm({
                          title: 'Delete detail',
                          description: `Delete "${d.key}" from ${hotel.hotel_name}?`,
                          confirmLabel: 'Delete detail',
                          destructive: true,
                        })
                        if (!ok) return
                        await deleteHotelDetail(d.id)
                        onDeleteDetail(hotel.id, d.id)
                      }} className="text-muted-foreground hover:text-destructive ml-2 shrink-0"><X className="h-3 w-3" /></button>}
                    </div>
                  ))}
                </div>
              )}
              {readOnly ? null : addingDetail === hotel.id ? (
                <div className="flex gap-2 items-center">
                  <Input placeholder="Key (e.g. Check-in)" value={detailForm.key} onChange={e => setDetailForm(f => ({ ...f, key: e.target.value }))} className="h-7 text-sm" />
                  <Input placeholder="Value (e.g. 3:00 PM)" value={detailForm.value} onChange={e => setDetailForm(f => ({ ...f, value: e.target.value }))} className="h-7 text-sm" />
                  <button onClick={() => handleAddDetail(hotel.id)} className="text-primary hover:opacity-70"><Check className="h-4 w-4" /></button>
                  <button onClick={() => { setAddingDetail(null); setDetailForm({ key: '', value: '' }) }} className="text-muted-foreground hover:opacity-70"><X className="h-4 w-4" /></button>
                </div>
              ) : (
                <button onClick={() => { setAddingDetail(hotel.id); setDetailForm({ key: '', value: '' }) }} className="text-xs text-primary hover:opacity-70 flex items-center gap-1">
                  <Plus className="h-3 w-3" /> Add detail
                </button>
              )}
            </div>
          </div>
        ))}
      </CardContent>
    </CollapsibleSection>
  )
}

// ── Main component ─────────────────────────────────────────────────────────────

// ── Event Budget (line items + expenses + backing fund) ─────────────────────

function EventBudgetSection({ eventId, funds, closed, closedAt, onClose, open, onToggle }: {
  eventId: string
  funds: BudgetFund[]
  closed: boolean
  closedAt: string | null
  onClose: () => void
  open: boolean
  onToggle: () => void
}) {
  // A closed budget is frozen — reuse the existing read-only gating throughout.
  const readOnly = closed
  const [items, setItems]       = useState<EventBudgetItem[]>([])
  const [expenses, setExpenses] = useState<EventExpense[]>([])
  const [backingFundId, setBackingFundId] = useState(funds.find(f => f.event_id === eventId)?.id ?? '')
  const [busy, setBusy]   = useState(false)
  const [error, setError] = useState('')
  const confirm = useConfirm()

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      const [bi, ex] = await Promise.all([getEventBudgetItems(eventId), getEventExpenses(eventId)])
      if (!cancelled) { setItems(bi); setExpenses(ex) }
    })()
    return () => { cancelled = true }
  }, [eventId])

  // New line item
  const [itTitle, setItTitle]   = useState('')
  const [itBudget, setItBudget] = useState('')
  // New expense
  const [exDesc, setExDesc]     = useState('')
  const [exAmount, setExAmount] = useState('')
  const [exDate, setExDate]     = useState(new Date().toISOString().split('T')[0])
  const [exItem, setExItem]     = useState('')
  const [exFund, setExFund]     = useState('')

  const totalBudgeted = items.reduce((s, i) => s + i.budget_cents, 0)
  const totalSpent    = expenses.reduce((s, e) => s + e.amount_cents, 0)

  async function changeBackingFund(fundId: string) {
    const fundName = funds.find(f => f.id === fundId)?.name
    const ok = await confirm({
      title: fundId ? 'Change backing fund' : 'Clear backing fund',
      description: fundId
        ? `Back this event's budget with "${fundName}"? Expenses recorded here will draw against that fund.`
        : 'Remove the backing fund from this event’s budget?',
      confirmLabel: fundId ? 'Change fund' : 'Clear fund',
      destructive: !fundId,
    })
    if (!ok) return
    setBackingFundId(fundId)
    setBusy(true)
    const res = await setEventFund(eventId, fundId || null)
    setBusy(false)
    if (!res.success) setError(res.error ?? 'Could not set backing fund')
  }

  async function addItem() {
    if (!itTitle.trim() || !itBudget) { setError('Line item needs a title and budget'); return }
    setError(''); setBusy(true)
    const res = await addEventBudgetItem(eventId, { title: itTitle, budget_cents: dollarsToCents(itBudget) })
    setBusy(false)
    if (!res.success || !res.id) { setError(res.error ?? 'Failed'); return }
    setItems(prev => [...prev, { id: res.id!, event_id: eventId, title: itTitle.trim(), description: null, budget_cents: dollarsToCents(itBudget), sort_order: prev.length + 1, spent_cents: 0 }])
    setItTitle(''); setItBudget('')
  }

  async function removeItem(id: string) {
    const item = items.find(i => i.id === id)
    const ok = await confirm({
      title: 'Delete budget line item',
      description: item
        ? `Delete the line item "${item.title}" (${formatCurrency(item.budget_cents)} budgeted)? This cannot be undone.`
        : 'Delete this budget line item? This cannot be undone.',
      confirmLabel: 'Delete line item',
      destructive: true,
    })
    if (!ok) return
    setBusy(true)
    await deleteEventBudgetItem(id)
    setBusy(false)
    setItems(prev => prev.filter(i => i.id !== id))
  }

  async function addExpense() {
    if (!exDesc.trim() || !exAmount) { setError('Expense needs a description and amount'); return }
    setError(''); setBusy(true)
    const fundId = exFund || backingFundId || null
    const res = await recordEventExpense(eventId, {
      description: exDesc,
      amount_cents: dollarsToCents(exAmount),
      spent_date: exDate,
      budget_item_id: exItem || null,
      fund_id: fundId,
    })
    setBusy(false)
    if (!res.success || !res.id) { setError(res.error ?? 'Failed'); return }
    const item = items.find(i => i.id === exItem)
    const fund = funds.find(f => f.id === fundId)
    setExpenses(prev => [{
      id: res.id!, event_id: eventId, budget_item_id: exItem || null, budget_item_title: item?.title ?? null,
      fund_id: fundId, fund_name: fund?.name ?? null, amount_cents: dollarsToCents(exAmount),
      spent_date: exDate, description: exDesc.trim(), created_at: new Date().toISOString(),
    }, ...prev])
    if (exItem) setItems(prev => prev.map(i => i.id === exItem ? { ...i, spent_cents: i.spent_cents + dollarsToCents(exAmount) } : i))
    setExDesc(''); setExAmount(''); setExItem('')
  }

  async function removeExpense(e: EventExpense) {
    const ok = await confirm({
      title: 'Delete expense',
      description: `Delete the ${formatCurrency(e.amount_cents)} expense "${e.description}"? The amount will be credited back to its line item. This cannot be undone.`,
      confirmLabel: 'Delete expense',
      destructive: true,
    })
    if (!ok) return
    setBusy(true)
    await deleteEventExpense(e.id)
    setBusy(false)
    setExpenses(prev => prev.filter(x => x.id !== e.id))
    if (e.budget_item_id) setItems(prev => prev.map(i => i.id === e.budget_item_id ? { ...i, spent_cents: Math.max(0, i.spent_cents - e.amount_cents) } : i))
  }

  return (
    <CollapsibleSection
      title="Budget & Expenses"
      open={open}
      onToggle={onToggle}
      // An open budget can't be collapsed — it stays visible until officially closed.
      canToggle={closed}
      action={closed ? (
        <span className="inline-flex items-center gap-1 text-xs px-2.5 py-1 rounded-full bg-muted text-muted-foreground">
          <Lock className="h-3 w-3" /> Closed{closedAt ? ` ${formatDate(closedAt)}` : ''}
        </span>
      ) : (
        <Button size="sm" variant="outline" onClick={onClose}>
          <Lock className="h-3.5 w-3.5" /> Close Budget
        </Button>
      )}
    >
      <CardContent className="space-y-5">
        {/* Backing fund */}
        <div className="flex flex-col sm:flex-row sm:items-center gap-2">
          <Label className="sm:w-40">Backing fund</Label>
          <select
            value={backingFundId}
            disabled={busy || readOnly}
            onChange={e => changeBackingFund(e.target.value)}
            className="h-8 rounded-lg border border-input bg-background px-2.5 text-sm w-full sm:w-64 disabled:opacity-70"
          >
            <option value="">— None —</option>
            {funds.map(f => <option key={f.id} value={f.id}>{f.name}</option>)}
          </select>
          {!readOnly && <span className="text-xs text-muted-foreground">Expenses default to drawing down this fund.</span>}
        </div>

        {error && <p className="text-sm text-destructive">{error}</p>}

        {/* Line items */}
        <div className="space-y-2">
          <p className="text-sm font-semibold">Budget Line Items</p>
          {items.length === 0 ? (
            <p className="text-sm text-muted-foreground">No line items yet.</p>
          ) : (
            <div className="divide-y rounded-xl border">
              {items.map(i => {
                const remaining = i.budget_cents - i.spent_cents
                return (
                  <div key={i.id} className="flex items-center gap-3 px-4 py-2.5">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium">{i.title}</p>
                      <p className="text-xs text-muted-foreground">
                        Budget {formatCurrency(i.budget_cents)} · Spent {formatCurrency(i.spent_cents)} ·{' '}
                        <span className={remaining < 0 ? 'text-destructive' : 'text-green-600'}>
                          {remaining < 0 ? `${formatCurrency(-remaining)} over` : `${formatCurrency(remaining)} left`}
                        </span>
                      </p>
                    </div>
                    {!readOnly && (
                      <Button size="sm" variant="ghost" className="text-destructive hover:text-destructive h-7 w-7 p-0" disabled={busy} onClick={() => removeItem(i.id)}>
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    )}
                  </div>
                )
              })}
            </div>
          )}
          {!readOnly && (
            <div className="flex flex-wrap items-end gap-2">
              <div className="space-y-1">
                <Label className="text-xs">Line item</Label>
                <Input value={itTitle} onChange={e => setItTitle(e.target.value)} placeholder="Catering" className="h-8 w-44" />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Budget ($)</Label>
                <Input type="number" min="0" step="0.01" value={itBudget} onChange={e => setItBudget(e.target.value)} className="h-8 w-28" />
              </div>
              <Button size="sm" disabled={busy} onClick={addItem}><Plus className="h-3.5 w-3.5" /> Add Item</Button>
            </div>
          )}
        </div>

        {/* Expenses */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <p className="text-sm font-semibold">Expenses</p>
            <p className="text-xs text-muted-foreground">Budgeted {formatCurrency(totalBudgeted)} · Spent {formatCurrency(totalSpent)}</p>
          </div>
          {expenses.length === 0 ? (
            <p className="text-sm text-muted-foreground">No expenses recorded.</p>
          ) : (
            <div className="divide-y rounded-xl border">
              {expenses.map(e => (
                <div key={e.id} className="flex items-center gap-3 px-4 py-2.5">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium">{e.description ?? 'Expense'}</p>
                    <p className="text-xs text-muted-foreground">
                      {formatDate(e.spent_date)}{e.budget_item_title ? ` · ${e.budget_item_title}` : ''}{e.fund_name ? ` · from ${e.fund_name}` : ''}
                    </p>
                  </div>
                  <span className="text-sm font-medium text-destructive">{formatCurrency(e.amount_cents)}</span>
                  {!readOnly && (
                    <Button size="sm" variant="ghost" className="text-destructive hover:text-destructive h-7 w-7 p-0" disabled={busy} onClick={() => removeExpense(e)}>
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  )}
                </div>
              ))}
            </div>
          )}
          {!readOnly && (
            <div className="flex flex-wrap items-end gap-2">
              <div className="space-y-1">
                <Label className="text-xs">Description</Label>
                <Input value={exDesc} onChange={e => setExDesc(e.target.value)} placeholder="Deposit" className="h-8 w-40" />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Amount ($)</Label>
                <Input type="number" min="0" step="0.01" value={exAmount} onChange={e => setExAmount(e.target.value)} className="h-8 w-28" />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Date</Label>
                <Input type="date" value={exDate} onChange={e => setExDate(e.target.value)} className="h-8 w-40" />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Line item</Label>
                <select value={exItem} onChange={e => setExItem(e.target.value)} className="h-8 rounded-lg border border-input bg-background px-2.5 text-sm w-40">
                  <option value="">— Unbudgeted —</option>
                  {items.map(i => <option key={i.id} value={i.id}>{i.title}</option>)}
                </select>
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Paid from</Label>
                <select value={exFund} onChange={e => setExFund(e.target.value)} className="h-8 rounded-lg border border-input bg-background px-2.5 text-sm w-40">
                  <option value="">{backingFundId ? 'Backing fund' : 'General cash'}</option>
                  {funds.map(f => <option key={f.id} value={f.id}>{f.name}</option>)}
                </select>
              </div>
              <Button size="sm" disabled={busy} onClick={addExpense}><Plus className="h-3.5 w-3.5" /> Add Expense</Button>
            </div>
          )}
        </div>
      </CardContent>
    </CollapsibleSection>
  )
}

export function AdminEventDetailClient({ report: initialReport, assignments: initialAssignments, blueprintItems, members, canApprove, initialSubEvents, eventTypes, funds }: Props) {
  const confirm = useConfirm()
  const [report, setReport]           = useState(initialReport)
  const [assignments, setAssignments] = useState(initialAssignments)
  const [subEvents, setSubEvents]     = useState(initialSubEvents)
  const [hotels, setHotels]           = useState<HotelBooking[]>([])
  const [editing, setEditing]         = useState(false)
  const [showAddSub, setShowAddSub]   = useState(false)
  const [actionLoading, setActionLoading] = useState(false)
  const [assignLoading, setAssignLoading] = useState<string | null>(null)
  const [addMemberForItem, setAddMemberForItem] = useState<string | null>(null)
  const [newAssigneeId, setNewAssigneeId]       = useState('')
  const [newAssigneeDue, setNewAssigneeDue]     = useState('')

  const event = report.event

  // A passed event is read-only: its core details can be viewed but not edited.
  // "Passed" uses the effective end (end_date → start_date → legacy event_date),
  // compared as YYYY-MM-DD strings. Today is captured once via a lazy initializer
  // to keep render pure.
  const [today] = useState(() => new Date().toISOString().slice(0, 10))
  const effectiveEnd = event.end_date ?? event.start_date ?? event.event_date
  const isPast = !!effectiveEnd && effectiveEnd.slice(0, 10) < today

  // Budget stays open (editable, and cannot be collapsed) until officially closed —
  // even after the event has passed — so late invoices can still be recorded.
  const [budgetClosedAt, setBudgetClosedAt] = useState<string | null>(event.budget_closed_at ?? null)
  const budgetClosed = !!budgetClosedAt

  // Per-section collapse state. Everything starts expanded.
  const [openSections, setOpenSections] = useState<Record<string, boolean>>({
    hotels: true, budget: true, subEvents: true, checklist: true, tshirts: true, attendees: true,
  })
  const toggleSection = (key: string) => setOpenSections(s => ({ ...s, [key]: !s[key] }))

  async function handleCloseBudget() {
    const ok = await confirm({
      title: 'Close budget',
      description: 'Officially close this budget? Line items and expenses can no longer be added or edited.',
      confirmLabel: 'Close budget',
      destructive: true,
    })
    if (!ok) return
    const res = await closeBudget(event.id)
    if (res.success) setBudgetClosedAt(res.closed_at ?? new Date().toISOString())
    else alert(res.error ?? 'Could not close the budget.')
  }

  async function handleMoveSub(id: string, direction: 'up' | 'down') {
    const ok = await confirm({
      title: 'Reorder sub-events',
      description: `Move "${subEvents.find(s => s.id === id)?.name ?? 'this sub-event'}" ${direction} in the schedule?`,
      confirmLabel: 'Move',
    })
    if (!ok) return
    setSubEvents(prev => {
      const idx = prev.findIndex(s => s.id === id)
      const swapIdx = direction === 'up' ? idx - 1 : idx + 1
      if (idx === -1 || swapIdx < 0 || swapIdx >= prev.length) return prev
      const next = [...prev]
      ;[next[idx], next[swapIdx]] = [next[swapIdx], next[idx]]
      return next
    })
    await moveSubEvent(id, event.id, direction)
  }

  // Group assignments by blueprint item
  const assignmentsByItemId: Record<string, EventAssignment[]> = {}
  for (const a of assignments) {
    if (!assignmentsByItemId[a.blueprint_item_id]) assignmentsByItemId[a.blueprint_item_id] = []
    assignmentsByItemId[a.blueprint_item_id].push(a)
  }

  async function handlePublish() {
    const ok = await confirm({
      title: 'Publish event',
      description: `Publish "${event.name}"? Members will be able to see it and RSVP.`,
      confirmLabel: 'Publish',
    })
    if (!ok) return
    setActionLoading(true)
    await publishEvent(event.id)
    setReport(r => ({ ...r, event: { ...r.event, status: 'published' } }))
    setActionLoading(false)
  }

  async function handleApprove() {
    const ok = await confirm({
      title: 'Approve event',
      description: `Approve "${event.name}"?`,
      confirmLabel: 'Approve',
    })
    if (!ok) return
    setActionLoading(true)
    await approveEvent(event.id)
    setReport(r => ({ ...r, event: { ...r.event, status: 'approved' } }))
    setActionLoading(false)
  }

  async function handleCancel() {
    const ok = await confirm({
      title: 'Cancel event',
      description: `Cancel "${event.name}"? Members who have RSVP'd will see it as cancelled.`,
      confirmLabel: 'Cancel event',
      cancelLabel: 'Keep event',
      destructive: true,
    })
    if (!ok) return
    setActionLoading(true)
    await cancelEvent(event.id)
    setReport(r => ({ ...r, event: { ...r.event, status: 'cancelled' } }))
    setActionLoading(false)
  }

  async function handleAddAssignee(blueprintItemId: string) {
    if (!newAssigneeId) return
    setAssignLoading(blueprintItemId)
    await assignBlueprintItem(event.id, blueprintItemId, newAssigneeId, newAssigneeDue || undefined)
    const member = members.find(m => m.user_id === newAssigneeId)
    const name = member ? [member.first_name, member.last_name].filter(Boolean).join(' ') : 'Unknown'
    setAssignments(prev => [...prev, {
      id: Date.now().toString(), event_id: event.id, blueprint_item_id: blueprintItemId,
      blueprint_item_title: blueprintItems.find(i => i.id === blueprintItemId)?.title ?? '',
      assigned_to: newAssigneeId, assigned_to_name: name,
      is_complete: false, completed_at: null, due_date: newAssigneeDue || null,
      response: null, response_status: 'pending' as const, approved_by: null, approved_at: null,
    }])
    setNewAssigneeId('')
    setNewAssigneeDue('')
    setAddMemberForItem(null)
    setAssignLoading(null)
  }

  async function handleUnassign(assignmentId: string) {
    const assignment = assignments.find(a => a.id === assignmentId)
    const ok = await confirm({
      title: 'Remove assignee',
      description: assignment
        ? `Remove ${assignment.assigned_to_name} from "${assignment.blueprint_item_title}"? Any response they submitted is removed with them.`
        : 'Remove this assignee? Any response they submitted is removed with them.',
      confirmLabel: 'Remove',
      destructive: true,
    })
    if (!ok) return
    await unassignBlueprintItem(assignmentId)
    setAssignments(prev => prev.filter(a => a.id !== assignmentId))
  }

  async function handleApproveResponse(assignmentId: string) {
    const assignment = assignments.find(a => a.id === assignmentId)
    const ok = await confirm({
      title: 'Approve response',
      description: assignment
        ? `Approve ${assignment.assigned_to_name}'s response for "${assignment.blueprint_item_title}"?`
        : 'Approve this response?',
      confirmLabel: 'Approve',
    })
    if (!ok) return
    await approveAssignmentResponse(assignmentId)
    setAssignments(prev => prev.map(a => a.id === assignmentId
      ? { ...a, response_status: 'approved' }
      : a
    ))
  }

  const alreadyAssignedIds = (itemId: string) => new Set(
    (assignmentsByItemId[itemId] ?? []).map(a => a.assigned_to)
  )

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <Link
            href={event.parent_event_id ? `/admin/events/${event.parent_event_id}` : '/admin/events'}
            className="text-sm text-muted-foreground hover:text-foreground flex items-center gap-1 mb-2"
          >
            <ChevronLeft className="h-3.5 w-3.5" />
            {event.parent_event_id ? 'Back to Event' : 'Back to Events'}
          </Link>
          <h1 className="text-3xl font-bold">{event.name}</h1>
          <div className="flex items-center gap-2 mt-1 flex-wrap">
            <span className={`text-xs px-2 py-0.5 rounded-full ${STATUS_COLORS[event.status]}`}>{event.status}</span>
            {event.event_type_name && <span className="text-xs text-muted-foreground">{event.event_type_name}</span>}
            {event.event_date && <span className="text-sm text-muted-foreground">{formatDate(event.event_date)}{event.event_time ? ` at ${event.event_time}` : ''}</span>}
            {event.location && <span className="text-sm text-muted-foreground">· {event.location}</span>}
          </div>
        </div>

        <div className="flex gap-2 shrink-0 flex-wrap items-center">
          {isPast ? (
            <span className="inline-flex items-center gap-1 text-xs px-2.5 py-1 rounded-full bg-muted text-muted-foreground">
              <Lock className="h-3 w-3" /> View only — event has passed
            </span>
          ) : !editing && (
            <Button variant="outline" disabled={actionLoading} onClick={() => setEditing(true)}>
              <Pencil className="h-3.5 w-3.5" /> Edit
            </Button>
          )}
          {!isPast && event.status === 'draft' && <Button disabled={actionLoading} onClick={handlePublish}>Publish</Button>}
          {!isPast && event.status === 'published' && canApprove && <Button disabled={actionLoading} onClick={handleApprove}>Approve</Button>}
          {!isPast && event.status !== 'cancelled' && <Button variant="outline" disabled={actionLoading} onClick={handleCancel}>Cancel</Button>}
        </div>
      </div>

      {editing && !isPast && (
        <EditEventForm
          event={event}
          onSaved={patch => {
            setReport(r => ({ ...r, event: { ...r.event, ...patch } }))
            setEditing(false)
          }}
          onCancel={() => setEditing(false)}
        />
      )}

      {/* Hotel Bookings — shown first for main events */}
      {event.parent_event_id === null && (
        <HotelBookingsSection
          eventId={event.id}
          hotels={hotels}
          readOnly={isPast}
          open={openSections.hotels}
          onToggle={() => toggleSection('hotels')}
          onLoad={async () => {
            const data = await getHotelBookings(event.id)
            setHotels(data)
          }}
          onAdd={b => setHotels(prev => [...prev, b])}
          onUpdate={(id, patch) => setHotels(prev => prev.map(h => h.id === id ? { ...h, ...patch } : h))}
          onDelete={id => setHotels(prev => prev.filter(h => h.id !== id))}
          onAddEstimate={(hotelId, est) => setHotels(prev => prev.map(h => h.id === hotelId ? { ...h, estimates: [...h.estimates, est] } : h))}
          onDeleteEstimate={(hotelId, estId) => setHotels(prev => prev.map(h => h.id === hotelId ? { ...h, estimates: h.estimates.filter(e => e.id !== estId) } : h))}
          onAddDetail={(hotelId, detail) => setHotels(prev => prev.map(h => h.id === hotelId ? { ...h, details: [...h.details, detail] } : h))}
          onDeleteDetail={(hotelId, detailId) => setHotels(prev => prev.map(h => h.id === hotelId ? { ...h, details: h.details.filter(d => d.id !== detailId) } : h))}
        />
      )}

      {/* Budget & Expenses — top-level events only. Stays open/editable until closed. */}
      {event.parent_event_id === null && (
        <EventBudgetSection
          eventId={event.id}
          funds={funds}
          closed={budgetClosed}
          closedAt={budgetClosedAt}
          onClose={handleCloseBudget}
          open={openSections.budget}
          onToggle={() => toggleSection('budget')}
        />
      )}

      {/* Sub-events — only shown for top-level events */}
      {event.parent_event_id && (
        <div className="text-xs text-muted-foreground bg-muted/40 rounded-lg px-3 py-2">
          This is a sub-event. Sub-events cannot have their own sub-events.
        </div>
      )}
      {!event.parent_event_id && <CollapsibleSection
        title="Sub-Events"
        open={openSections.subEvents}
        onToggle={() => toggleSection('subEvents')}
        action={!isPast && (
          <Button size="sm" variant="outline" onClick={() => { if (!openSections.subEvents) toggleSection('subEvents'); setShowAddSub(s => !s) }}>
            <Plus className="h-3.5 w-3.5" /> Add
          </Button>
        )}
      >
        <CardContent className="space-y-3">
          {showAddSub && <AddSubEventForm parentId={event.id} eventTypes={eventTypes} onAdded={e => setSubEvents(prev => [...prev, e])} onCancel={() => setShowAddSub(false)} />}
          {subEvents.length === 0 && !showAddSub ? (
            <p className="text-sm text-muted-foreground">No sub-events yet. Use "Add" to break this event into days or sessions.</p>
          ) : (
            subEvents.map((sub, i) => (
              <div key={sub.id} className="flex items-center justify-between border rounded-lg px-3 py-2.5">
                <div>
                  <Link href={`/admin/events/${sub.id}`} className="text-sm font-medium hover:underline">{sub.name}</Link>
                  <p className="text-xs text-muted-foreground">
                    {sub.event_date ? formatDate(sub.event_date) : 'Date TBD'}{sub.event_time ? ` at ${sub.event_time}` : ''}{sub.location ? ` · ${sub.location}` : ''}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <span className={`text-xs px-2 py-0.5 rounded-full ${STATUS_COLORS[sub.status]}`}>{sub.status}</span>
                  {!isPast && (
                    <>
                      <button onClick={() => handleMoveSub(sub.id, 'up')} disabled={i === 0} className="text-muted-foreground hover:text-foreground transition-colors disabled:opacity-30 disabled:cursor-default" title="Move up">
                        <ArrowUp className="h-3.5 w-3.5" />
                      </button>
                      <button onClick={() => handleMoveSub(sub.id, 'down')} disabled={i === subEvents.length - 1} className="text-muted-foreground hover:text-foreground transition-colors disabled:opacity-30 disabled:cursor-default" title="Move down">
                        <ArrowDown className="h-3.5 w-3.5" />
                      </button>
                      <button
                        onClick={async () => {
                          const ok = await confirm({
                            title: 'Delete sub-event',
                            description: `Permanently delete "${sub.name}" and everything attached to it? This cannot be undone.`,
                            confirmLabel: 'Delete sub-event',
                            destructive: true,
                          })
                          if (!ok) return
                          await deleteEvent(sub.id)
                          setSubEvents(prev => prev.filter(s => s.id !== sub.id))
                        }}
                        className="text-muted-foreground hover:text-destructive transition-colors"
                        title="Delete sub-event"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </>
                  )}
                </div>
              </div>
            ))
          )}
        </CardContent>
      </CollapsibleSection>}

      {/* Blueprint assignments */}
      {blueprintItems.length > 0 && (
        <CollapsibleSection title="Planning Checklist" open={openSections.checklist} onToggle={() => toggleSection('checklist')}>
          <CardContent className="space-y-4">
            {blueprintItems.map(item => {
              const itemAssignments = assignmentsByItemId[item.id] ?? []
              const assigned = alreadyAssignedIds(item.id)
              const availableMembers = members.filter(m => !assigned.has(m.user_id))

              return (
                <div key={item.id} className="border rounded-lg p-3 space-y-2">
                  <p className="text-sm font-medium">{item.title}</p>

                  {/* Assignees */}
                  {itemAssignments.map(a => (
                    <div key={a.id} className="flex items-start justify-between gap-2 bg-muted/40 rounded-lg px-3 py-2">
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-medium">{a.assigned_to_name ?? 'Unknown'}</p>
                        {a.due_date && <p className="text-xs text-muted-foreground">Due: {formatDate(a.due_date)}</p>}
                        {a.response && (
                          <p className="text-xs text-muted-foreground mt-0.5 italic">"{a.response}"</p>
                        )}
                        <span className={`text-xs font-medium ${RESPONSE_STATUS_COLORS[a.response_status]}`}>
                          {a.response_status === 'pending' ? 'No response yet'
                            : a.response_status === 'submitted' ? 'Response submitted'
                            : a.response_status === 'cancelled' ? 'Cancelled — event ended'
                            : '✓ Approved'}
                        </span>
                      </div>
                      {!isPast && (
                        <div className="flex items-center gap-1.5 shrink-0">
                          {a.response_status === 'submitted' && canApprove && (
                            <button onClick={() => handleApproveResponse(a.id)} className="text-xs text-green-600 hover:opacity-70 flex items-center gap-0.5">
                              <Check className="h-3.5 w-3.5" /> Approve
                            </button>
                          )}
                          <button onClick={() => handleUnassign(a.id)} className="text-muted-foreground hover:text-destructive transition-colors">
                            <UserMinus className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      )}
                    </div>
                  ))}

                  {/* Add assignee */}
                  {isPast ? null : addMemberForItem === item.id ? (
                    <div className="flex flex-wrap gap-2 items-center">
                      <select
                        className="flex-1 text-xs rounded border border-input bg-background px-2 py-1.5 min-w-[140px]"
                        value={newAssigneeId}
                        onChange={e => setNewAssigneeId(e.target.value)}
                      >
                        <option value="">— Select member —</option>
                        {availableMembers.map(m => (
                          <option key={m.user_id} value={m.user_id}>
                            {[m.first_name, m.last_name].filter(Boolean).join(' ') || 'Member'}
                          </option>
                        ))}
                      </select>
                      <input
                        type="date"
                        value={newAssigneeDue}
                        onChange={e => setNewAssigneeDue(e.target.value)}
                        className="text-xs rounded border border-input bg-background px-2 py-1.5 w-32"
                        title="Due date (optional)"
                      />
                      <button
                        onClick={() => handleAddAssignee(item.id)}
                        disabled={!newAssigneeId || assignLoading === item.id}
                        className="text-primary hover:opacity-70 transition-opacity"
                      >
                        <Check className="h-4 w-4" />
                      </button>
                      <button onClick={() => { setAddMemberForItem(null); setNewAssigneeId(''); setNewAssigneeDue('') }} className="text-muted-foreground hover:opacity-70">
                        <X className="h-4 w-4" />
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={() => { setAddMemberForItem(item.id); setNewAssigneeId('') }}
                      className="flex items-center gap-1 text-xs text-primary hover:opacity-70 transition-opacity"
                    >
                      <UserPlus className="h-3.5 w-3.5" /> Assign someone
                    </button>
                  )}
                </div>
              )
            })}
          </CardContent>
        </CollapsibleSection>
      )}

      {/* Report metrics */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card><CardContent className="pt-6"><p className="text-3xl font-bold">{report.headcount}</p><p className="text-sm text-muted-foreground">Attending</p></CardContent></Card>
        <Card><CardContent className="pt-6"><p className="text-3xl font-bold">{report.non_respondents.length}</p><p className="text-sm text-muted-foreground">No RSVP Yet</p></CardContent></Card>
        <Card><CardContent className="pt-6"><p className="text-3xl font-bold">{report.total_family_members}</p><p className="text-sm text-muted-foreground">Total Members</p></CardContent></Card>
      </div>

      {report.tshirt_breakdown.length > 0 && (
        <CollapsibleSection title="T-Shirt Summary" open={openSections.tshirts} onToggle={() => toggleSection('tshirts')}>
          <CardContent>
            <div className="divide-y">
              {report.tshirt_breakdown.map(t => (
                <div key={`${t.category}-${t.size}`} className="flex justify-between py-1.5 text-sm">
                  <span>{t.category} / {t.size}</span>
                  <span className="font-medium">{t.count}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </CollapsibleSection>
      )}

      {report.attendees.length > 0 && (
        <CollapsibleSection title={`Attendees (${report.attendees.length})`} open={openSections.attendees} onToggle={() => toggleSection('attendees')}>
          <CardContent>
            <div className="divide-y">
              {report.attendees.map((a, i) => (
                <div key={i} className="flex justify-between py-1.5 text-sm">
                  <span>{a.name}</span>
                  <span className="text-muted-foreground">{a.tshirt_category && a.tshirt_size ? `${a.tshirt_category} / ${a.tshirt_size}` : '—'}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </CollapsibleSection>
      )}
    </div>
  )
}
