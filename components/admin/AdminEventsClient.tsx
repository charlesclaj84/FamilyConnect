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
  const [form, setForm] = useState({ name: '', description: '', event_type_id: '', event_date: '', location: '', rsvp_deadline: '' })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [actionLoading, setActionLoading] = useState<string | null>(null)

  function updateEvent(id: string, patch: Partial<AdminEvent>) {
    setEvents(prev => prev.map(e => e.id === id ? { ...e, ...patch } : e))
  }

  async function handleCreate() {
    if (!form.name.trim()) { setError('Name is required'); return }
    setSaving(true)
    const result = await createEvent({ name: form.name, description: form.description, event_type_id: form.event_type_id || undefined, event_date: form.event_date || undefined, location: form.location, rsvp_deadline: form.rsvp_deadline || undefined })
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
                <Label>Event Date</Label>
                <Input type="date" value={form.event_date} onChange={e => setForm(f => ({ ...f, event_date: e.target.value }))} />
              </div>
              <div className="space-y-1.5">
                <Label>Location</Label>
                <Input placeholder="e.g. Riverside Park" value={form.location} onChange={e => setForm(f => ({ ...f, location: e.target.value }))} />
              </div>
              <div className="space-y-1.5">
                <Label>RSVP Deadline</Label>
                <Input type="date" value={form.rsvp_deadline} onChange={e => setForm(f => ({ ...f, rsvp_deadline: e.target.value }))} />
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
                    {event.event_date ?? 'Date TBD'} · {event.location ?? 'Location TBD'}
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
                  {event.status !== 'cancelled' && (
                    <Button size="sm" variant="outline" disabled={actionLoading === event.id} onClick={() => handleCancel(event.id)}>
                      Cancel
                    </Button>
                  )}
                  <Link href={`/admin/events/${event.id}`}>
                    <Button size="sm" variant="outline">
                      Details <ChevronRight className="h-3.5 w-3.5" />
                    </Button>
                  </Link>
                  <Button size="sm" variant="outline" disabled={actionLoading === event.id} onClick={() => handleDelete(event.id)} className="text-destructive hover:text-destructive">
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        ))
      )}
    </div>
  )
}
