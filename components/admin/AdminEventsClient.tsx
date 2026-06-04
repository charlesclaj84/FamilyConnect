'use client'

import { useState } from 'react'
import Link from 'next/link'
import { Plus, ChevronRight, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent } from '@/components/ui/card'
import { publishEvent, approveEvent, cancelEvent, createEvent, deleteEvent, type AdminEvent } from '@/app/actions/admin/events'
import type { EventType } from '@/app/actions/admin/event-types'
import { AddressSelects } from '@/components/ui/AddressSelects'

const STATUS_LABELS: Record<AdminEvent['status'], string> = {
  draft:     'Draft',
  published: 'Published',
  approved:  'Approved',
  cancelled: 'Cancelled',
}

const STATUS_COLORS: Record<AdminEvent['status'], string> = {
  draft:     'bg-muted text-muted-foreground',
  published: 'bg-blue-100 text-blue-700',
  approved:  'bg-green-100 text-green-700',
  cancelled: 'bg-red-100 text-red-700',
}

interface Props {
  initialEvents: AdminEvent[]
  eventTypes: EventType[]
  canApprove: boolean
}

export function AdminEventsClient({ initialEvents, eventTypes, canApprove }: Props) {
  const [events, setEvents] = useState(initialEvents)
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({ name: '', description: '', event_type_id: '', start_date: '', end_date: '', is_all_day: true, start_time: '', end_time: '', location: '', street_address: '', suite: '', city: '', state: '', zip_code: '', country: '', rsvp_deadline: '' })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [actionLoading, setActionLoading] = useState<string | null>(null)

  function updateEvent(id: string, patch: Partial<AdminEvent>) {
    setEvents(prev => prev.map(e => e.id === id ? { ...e, ...patch } : e))
  }

  async function handleCreate() {
    if (!form.name.trim()) { setError('Name is required'); return }
    setSaving(true)
    const result = await createEvent({ name: form.name, description: form.description, event_type_id: form.event_type_id || undefined, start_date: form.start_date || undefined, end_date: form.end_date || undefined, is_all_day: form.is_all_day, start_time: form.is_all_day ? undefined : form.start_time || undefined, end_time: form.is_all_day ? undefined : form.end_time || undefined, location: form.location, street_address: form.street_address, suite: form.suite, city: form.city, state: form.state, zip_code: form.zip_code, country: form.country, rsvp_deadline: form.rsvp_deadline || undefined })
    if (!result.success) { setError(result.error ?? 'Error'); setSaving(false); return }
    window.location.reload()
  }

  async function handlePublish(id: string) {
    setActionLoading(id)
    await publishEvent(id)
    updateEvent(id, { status: 'published' })
    setActionLoading(null)
  }

  async function handleApprove(id: string) {
    setActionLoading(id)
    await approveEvent(id)
    updateEvent(id, { status: 'approved' })
    setActionLoading(null)
  }

  async function handleCancel(id: string) {
    if (!confirm('Cancel this event?')) return
    setActionLoading(id)
    await cancelEvent(id)
    updateEvent(id, { status: 'cancelled' })
    setActionLoading(null)
  }

  async function handleDelete(id: string) {
    if (!confirm('Permanently delete this event? This cannot be undone.')) return
    setActionLoading(id)
    await deleteEvent(id)
    setEvents(prev => prev.filter(e => e.id !== id))
    setActionLoading(null)
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button onClick={() => setShowForm(s => !s)}>
          <Plus className="h-4 w-4" /> New Event
        </Button>
      </div>

      {showForm && (
        <Card className="border-primary/30 bg-primary/5">
          <CardContent className="pt-4 space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1.5 sm:col-span-2">
                <Label>Event Name <span className="text-destructive">*</span></Label>
                <Input placeholder="e.g. 2026 Summer Reunion" value={form.name} onChange={e => { setForm(f => ({ ...f, name: e.target.value })); setError('') }} />
              </div>
              <div className="space-y-1.5">
                <Label>Event Type <span className="text-muted-foreground text-xs">(optional)</span></Label>
                <select className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm" value={form.event_type_id} onChange={e => setForm(f => ({ ...f, event_type_id: e.target.value }))}>
                  <option value="">— None —</option>
                  {eventTypes.map(et => <option key={et.id} value={et.id}>{et.name}</option>)}
                </select>
              </div>
              <div className="space-y-1.5">
                <Label>Start Date</Label>
                <Input type="date" value={form.start_date} onChange={e => setForm(f => ({ ...f, start_date: e.target.value }))} />
              </div>
              <div className="space-y-1.5">
                <Label>End Date</Label>
                <Input type="date" value={form.end_date} onChange={e => setForm(f => ({ ...f, end_date: e.target.value }))} />
              </div>
              <div className="sm:col-span-2 flex items-center gap-2 py-1">
                <input
                  id="new_all_day"
                  type="checkbox"
                  checked={form.is_all_day}
                  onChange={e => setForm(f => ({ ...f, is_all_day: e.target.checked, start_time: '', end_time: '' }))}
                  className="h-4 w-4 rounded border-input accent-primary"
                />
                <label htmlFor="new_all_day" className="text-sm cursor-pointer select-none">All Day</label>
              </div>
              {!form.is_all_day && (
                <>
                  <div className="space-y-1.5">
                    <Label>Start Time</Label>
                    <Input type="time" value={form.start_time} onChange={e => setForm(f => ({ ...f, start_time: e.target.value }))} />
                  </div>
                  <div className="space-y-1.5">
                    <Label>End Time</Label>
                    <Input type="time" value={form.end_time} onChange={e => setForm(f => ({ ...f, end_time: e.target.value }))} />
                  </div>
                </>
              )}
              <div className="space-y-1.5">
                <Label>RSVP Deadline</Label>
                <Input type="date" value={form.rsvp_deadline} onChange={e => setForm(f => ({ ...f, rsvp_deadline: e.target.value }))} />
              </div>
              <div className="space-y-1.5">
                <Label>Venue / Location Name</Label>
                <Input placeholder="e.g. Riverside Park Pavilion" value={form.location} onChange={e => setForm(f => ({ ...f, location: e.target.value }))} />
              </div>
              <div className="space-y-1.5">
                <Label>Street Address</Label>
                <Input placeholder="123 Main St" value={form.street_address} onChange={e => setForm(f => ({ ...f, street_address: e.target.value }))} />
              </div>
              <div className="space-y-1.5">
                <Label>Suite / Apt</Label>
                <Input placeholder="Suite 100" value={form.suite} onChange={e => setForm(f => ({ ...f, suite: e.target.value }))} />
              </div>
              <div className="space-y-1.5">
                <Label>City</Label>
                <Input value={form.city} onChange={e => setForm(f => ({ ...f, city: e.target.value }))} />
              </div>
              <AddressSelects
                country={form.country}
                state={form.state}
                onCountryChange={v => setForm(f => ({ ...f, country: v }))}
                onStateChange={v => setForm(f => ({ ...f, state: v }))}
                countryId="ev_country"
                stateId="ev_state"
              />
              <div className="space-y-1.5">
                <Label>Zip Code</Label>
                <Input value={form.zip_code} onChange={e => setForm(f => ({ ...f, zip_code: e.target.value }))} />
              </div>
            </div>
            {error && <p className="text-sm text-destructive">{error}</p>}
            <div className="flex gap-2">
              <Button disabled={saving} onClick={handleCreate}>{saving ? 'Creating…' : 'Create Event'}</Button>
              <Button variant="outline" onClick={() => setShowForm(false)}>Cancel</Button>
            </div>
          </CardContent>
        </Card>
      )}

      {events.length === 0 ? (
        <p className="text-sm text-muted-foreground py-8 text-center">No events yet.</p>
      ) : (
        events.map(event => (
          <Card key={event.id}>
            <CardContent className="pt-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="font-medium truncate">{event.name}</p>
                    <span className={`text-xs px-2 py-0.5 rounded-full ${STATUS_COLORS[event.status]}`}>
                      {STATUS_LABELS[event.status]}
                    </span>
                    {event.event_type_name && (
                      <span className="text-xs text-muted-foreground">{event.event_type_name}</span>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {event.start_date ? `${event.start_date}${event.end_date && event.end_date !== event.start_date ? ` – ${event.end_date}` : ''}` : 'Date TBD'} · {event.location ?? 'Location TBD'}
                    {event.rsvp_deadline && ` · RSVP by ${event.rsvp_deadline}`}
                  </p>
                </div>

                <div className="flex items-center gap-2 shrink-0 flex-wrap">
                  {event.status === 'draft' && (
                    <Button size="sm" disabled={actionLoading === event.id} onClick={() => handlePublish(event.id)}>
                      Publish
                    </Button>
                  )}
                  {event.status === 'published' && canApprove && (
                    <Button size="sm" disabled={actionLoading === event.id} onClick={() => handleApprove(event.id)}>
                      Approve
                    </Button>
                  )}
                  <Link href={`/admin/events/${event.id}`}>
                    <Button size="sm" variant="outline">
                      Review Event <ChevronRight className="h-3.5 w-3.5" />
                    </Button>
                  </Link>
                  {canApprove && event.status !== 'cancelled' && (
                    <Button size="sm" variant="outline" disabled={actionLoading === event.id} onClick={() => handleCancel(event.id)}>
                      Cancel
                    </Button>
                  )}
                  {canApprove && (
                    <Button size="sm" variant="outline" disabled={actionLoading === event.id} onClick={() => handleDelete(event.id)} className="text-destructive hover:text-destructive">
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        ))
      )}
    </div>
  )
}
