'use client'

import { useState } from 'react'
import Link from 'next/link'
import { ChevronLeft, Pencil, Plus, Check, X, UserPlus, UserMinus, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  publishEvent, approveEvent, cancelEvent, updateEvent, deleteEvent,
  assignBlueprintItem, unassignBlueprintItem, approveAssignmentResponse,
  updateAssignmentDueDate,
  createSubEvent, type AdminEvent, type EventAssignment, type EventReport,
} from '@/app/actions/admin/events'
import type { BlueprintItem } from '@/app/actions/admin/event-types'
import type { MemberWithRoles } from '@/app/actions/admin/users'

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
}

interface Props {
  report: EventReport
  assignments: EventAssignment[]
  blueprintItems: BlueprintItem[]
  members: MemberWithRoles[]
  canApprove: boolean
  initialSubEvents: AdminEvent[]
  eventTypes: import('@/app/actions/admin/event-types').EventType[]
}

// ── Edit Event Form ────────────────────────────────────────────────────────────

function EditEventForm({ event, onSaved, onCancel }: { event: AdminEvent; onSaved: (e: Partial<AdminEvent>) => void; onCancel: () => void }) {
  const [form, setForm] = useState({
    name:          event.name,
    description:   event.description ?? '',
    event_date:    event.event_date ?? '',
    event_time:    event.event_time ?? '',
    location:      event.location ?? '',
    rsvp_deadline: event.rsvp_deadline ?? '',
  })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  async function handleSave() {
    if (!form.name.trim()) { setError('Name is required'); return }
    setSaving(true)
    const result = await updateEvent(event.id, form)
    if (!result.success) { setError(result.error ?? 'Error'); setSaving(false); return }
    onSaved(form)
  }

  return (
    <Card className="border-primary/30 bg-primary/5">
      <CardContent className="pt-4 space-y-3">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="space-y-1.5 sm:col-span-2">
            <Label>Name <span className="text-destructive">*</span></Label>
            <Input value={form.name} onChange={e => { setForm(f => ({ ...f, name: e.target.value })); setError('') }} />
          </div>
          <div className="space-y-1.5 sm:col-span-2">
            <Label>Description</Label>
            <Input value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} />
          </div>
          <div className="space-y-1.5">
            <Label>Date</Label>
            <Input type="date" value={form.event_date} onChange={e => setForm(f => ({ ...f, event_date: e.target.value }))} />
          </div>
          <div className="space-y-1.5">
            <Label>Time <span className="text-muted-foreground text-xs">(optional)</span></Label>
            <Input type="time" value={form.event_time} onChange={e => setForm(f => ({ ...f, event_time: e.target.value }))} />
          </div>
          <div className="space-y-1.5">
            <Label>Location</Label>
            <Input value={form.location} onChange={e => setForm(f => ({ ...f, location: e.target.value }))} />
          </div>
          <div className="space-y-1.5">
            <Label>RSVP Deadline</Label>
            <Input type="date" value={form.rsvp_deadline} onChange={e => setForm(f => ({ ...f, rsvp_deadline: e.target.value }))} />
          </div>
        </div>
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
  const [form, setForm] = useState({ name: '', description: '', event_date: '', event_time: '', location: '', event_type_id: '' })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  async function handleSave() {
    if (!form.name.trim()) { setError('Name is required'); return }
    setSaving(true)
    const result = await createSubEvent(parentId, form)
    if (!result.success) { setError(result.error ?? 'Error'); setSaving(false); return }
    // Reload to get the new sub-event
    window.location.reload()
  }

  return (
    <Card className="border-primary/30 bg-primary/5">
      <CardContent className="pt-4 space-y-3">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="space-y-1.5 sm:col-span-2">
            <Label>Name <span className="text-destructive">*</span></Label>
            <Input placeholder="e.g. Day 1 — Welcome Party" value={form.name} onChange={e => { setForm(f => ({ ...f, name: e.target.value })); setError('') }} autoFocus />
          </div>
          <div className="space-y-1.5 sm:col-span-2">
            <Label>Event Template <span className="text-muted-foreground text-xs">(gives this sub-event a planning checklist)</span></Label>
            <select
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              value={form.event_type_id}
              onChange={e => setForm(f => ({ ...f, event_type_id: e.target.value }))}
            >
              <option value="">— None —</option>
              {eventTypes.map(et => <option key={et.id} value={et.id}>{et.name}</option>)}
            </select>
          </div>
          <div className="space-y-1.5">
            <Label>Date</Label>
            <Input type="date" value={form.event_date} onChange={e => setForm(f => ({ ...f, event_date: e.target.value }))} />
          </div>
          <div className="space-y-1.5">
            <Label>Time <span className="text-muted-foreground text-xs">(optional)</span></Label>
            <Input type="time" value={form.event_time} onChange={e => setForm(f => ({ ...f, event_time: e.target.value }))} />
          </div>
          <div className="space-y-1.5">
            <Label>Location</Label>
            <Input placeholder="Venue / Location" value={form.location} onChange={e => setForm(f => ({ ...f, location: e.target.value }))} />
          </div>
          <div className="space-y-1.5">
            <Label>Description</Label>
            <Input value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} />
          </div>
        </div>
        {error && <p className="text-sm text-destructive">{error}</p>}
        <div className="flex gap-2">
          <Button disabled={saving} onClick={handleSave}>{saving ? 'Adding…' : 'Add Sub-Event'}</Button>
          <Button variant="outline" onClick={onCancel}>Cancel</Button>
        </div>
      </CardContent>
    </Card>
  )
}

// ── Main component ─────────────────────────────────────────────────────────────

export function AdminEventDetailClient({ report: initialReport, assignments: initialAssignments, blueprintItems, members, canApprove, initialSubEvents, eventTypes }: Props) {
  const [report, setReport]           = useState(initialReport)
  const [assignments, setAssignments] = useState(initialAssignments)
  const [subEvents, setSubEvents]     = useState(initialSubEvents)
  const [editing, setEditing]         = useState(false)
  const [showAddSub, setShowAddSub]   = useState(false)
  const [actionLoading, setActionLoading] = useState(false)
  const [assignLoading, setAssignLoading] = useState<string | null>(null)
  const [addMemberForItem, setAddMemberForItem] = useState<string | null>(null)
  const [newAssigneeId, setNewAssigneeId]       = useState('')
  const [newAssigneeDue, setNewAssigneeDue]     = useState('')

  const event = report.event

  // Group assignments by blueprint item
  const assignmentsByItemId: Record<string, EventAssignment[]> = {}
  for (const a of assignments) {
    if (!assignmentsByItemId[a.blueprint_item_id]) assignmentsByItemId[a.blueprint_item_id] = []
    assignmentsByItemId[a.blueprint_item_id].push(a)
  }

  async function handlePublish() {
    setActionLoading(true)
    await publishEvent(event.id)
    setReport(r => ({ ...r, event: { ...r.event, status: 'published' } }))
    setActionLoading(false)
  }

  async function handleApprove() {
    setActionLoading(true)
    await approveEvent(event.id)
    setReport(r => ({ ...r, event: { ...r.event, status: 'approved' } }))
    setActionLoading(false)
  }

  async function handleCancel() {
    if (!confirm('Cancel this event?')) return
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
    await unassignBlueprintItem(assignmentId)
    setAssignments(prev => prev.filter(a => a.id !== assignmentId))
  }

  async function handleApproveResponse(assignmentId: string) {
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
          <Link href="/admin/events" className="text-sm text-muted-foreground hover:text-foreground flex items-center gap-1 mb-2">
            <ChevronLeft className="h-3.5 w-3.5" /> Back to Events
          </Link>
          <div className="flex items-center gap-2">
            <h1 className="text-3xl font-bold">{event.name}</h1>
            <button onClick={() => setEditing(e => !e)} className="text-muted-foreground hover:text-foreground transition-colors">
              <Pencil className="h-4 w-4" />
            </button>
          </div>
          <div className="flex items-center gap-2 mt-1 flex-wrap">
            <span className={`text-xs px-2 py-0.5 rounded-full ${STATUS_COLORS[event.status]}`}>{event.status}</span>
            {event.event_type_name && <span className="text-xs text-muted-foreground">{event.event_type_name}</span>}
            {event.event_date && <span className="text-sm text-muted-foreground">{event.event_date}{event.event_time ? ` at ${event.event_time}` : ''}</span>}
            {event.location && <span className="text-sm text-muted-foreground">· {event.location}</span>}
          </div>
        </div>

        <div className="flex gap-2 shrink-0 flex-wrap">
          {event.status === 'draft' && <Button disabled={actionLoading} onClick={handlePublish}>Publish</Button>}
          {event.status === 'published' && canApprove && <Button disabled={actionLoading} onClick={handleApprove}>Approve</Button>}
          {event.status !== 'cancelled' && <Button variant="outline" disabled={actionLoading} onClick={handleCancel}>Cancel</Button>}
        </div>
      </div>

      {editing && (
        <EditEventForm
          event={event}
          onSaved={patch => {
            setReport(r => ({ ...r, event: { ...r.event, ...patch } }))
            setEditing(false)
          }}
          onCancel={() => setEditing(false)}
        />
      )}

      {/* Sub-events */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Sub-Events</CardTitle>
            <Button size="sm" variant="outline" onClick={() => setShowAddSub(s => !s)}>
              <Plus className="h-3.5 w-3.5" /> Add
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          {showAddSub && <AddSubEventForm parentId={event.id} eventTypes={eventTypes} onAdded={e => setSubEvents(prev => [...prev, e])} onCancel={() => setShowAddSub(false)} />}
          {subEvents.length === 0 && !showAddSub ? (
            <p className="text-sm text-muted-foreground">No sub-events yet. Use "Add" to break this event into days or sessions.</p>
          ) : (
            subEvents.map(sub => (
              <div key={sub.id} className="flex items-center justify-between border rounded-lg px-3 py-2.5">
                <div>
                  <Link href={`/admin/events/${sub.id}`} className="text-sm font-medium hover:underline">{sub.name}</Link>
                  <p className="text-xs text-muted-foreground">
                    {sub.event_date ?? 'Date TBD'}{sub.event_time ? ` at ${sub.event_time}` : ''}{sub.location ? ` · ${sub.location}` : ''}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <span className={`text-xs px-2 py-0.5 rounded-full ${STATUS_COLORS[sub.status]}`}>{sub.status}</span>
                  <button
                    onClick={async () => {
                      if (!confirm(`Delete "${sub.name}"?`)) return
                      await deleteEvent(sub.id)
                      setSubEvents(prev => prev.filter(s => s.id !== sub.id))
                    }}
                    className="text-muted-foreground hover:text-destructive transition-colors"
                    title="Delete sub-event"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            ))
          )}
        </CardContent>
      </Card>

      {/* Blueprint assignments */}
      {blueprintItems.length > 0 && (
        <Card>
          <CardHeader><CardTitle>Planning Checklist</CardTitle></CardHeader>
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
                        {a.due_date && <p className="text-xs text-muted-foreground">Due: {a.due_date}</p>}
                        {a.response && (
                          <p className="text-xs text-muted-foreground mt-0.5 italic">"{a.response}"</p>
                        )}
                        <span className={`text-xs font-medium ${RESPONSE_STATUS_COLORS[a.response_status]}`}>
                          {a.response_status === 'pending' ? 'No response yet' : a.response_status === 'submitted' ? 'Response submitted' : '✓ Approved'}
                        </span>
                      </div>
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
                    </div>
                  ))}

                  {/* Add assignee */}
                  {addMemberForItem === item.id ? (
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
        </Card>
      )}

      {/* Report metrics */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card><CardContent className="pt-6"><p className="text-3xl font-bold">{report.headcount}</p><p className="text-sm text-muted-foreground">Attending</p></CardContent></Card>
        <Card><CardContent className="pt-6"><p className="text-3xl font-bold">{report.non_respondents.length}</p><p className="text-sm text-muted-foreground">No RSVP Yet</p></CardContent></Card>
        <Card><CardContent className="pt-6"><p className="text-3xl font-bold">{report.total_family_members}</p><p className="text-sm text-muted-foreground">Total Members</p></CardContent></Card>
      </div>

      {report.tshirt_breakdown.length > 0 && (
        <Card>
          <CardHeader><CardTitle>T-Shirt Summary</CardTitle></CardHeader>
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
        </Card>
      )}

      {report.attendees.length > 0 && (
        <Card>
          <CardHeader><CardTitle>Attendees ({report.attendees.length})</CardTitle></CardHeader>
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
        </Card>
      )}
    </div>
  )
}
