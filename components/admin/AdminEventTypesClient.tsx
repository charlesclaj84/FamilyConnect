'use client'

import { useState } from 'react'
import { Plus, Trash2, ChevronDown, ChevronRight, Pencil, Check, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  createEventType, updateEventType, deleteEventType,
  getBlueprintItems, addBlueprintItem, updateBlueprintItem, deleteBlueprintItem,
  updateBlueprintItemFull, moveBlueprintItem,
  type EventType, type BlueprintItem,
} from '@/app/actions/admin/event-types'
import { ArrowUp, ArrowDown } from 'lucide-react'

const RESPONSE_TYPE_LABELS: Record<string, string> = { text: 'Text', date: 'Date', checkbox: 'Checkbox', list: 'List', members: 'Family Members' }

function BlueprintItemRow({ item, onDelete, onUpdate, onMove }: { item: BlueprintItem; onDelete: () => void; onUpdate: (title: string) => void; onMove: (direction: 'up' | 'down') => void }) {
  const [editing, setEditing] = useState(false)
  const [value, setValue] = useState(item.title)
  const [saving, setSaving] = useState(false)

  async function save() {
    if (!value.trim()) return
    setSaving(true)
    await updateBlueprintItem(item.id, value.trim())
    onUpdate(value.trim())
    setSaving(false)
    setEditing(false)
  }

  if (editing) return (
    <div className="flex items-center gap-2 py-1.5">
      <Input value={value} onChange={e => setValue(e.target.value)} className="h-7 text-sm flex-1" autoFocus onKeyDown={e => { if (e.key === 'Enter') save(); if (e.key === 'Escape') setEditing(false) }} />
      <button onClick={save} disabled={saving} className="text-primary hover:opacity-70"><Check className="h-4 w-4" /></button>
      <button onClick={() => setEditing(false)} className="text-muted-foreground hover:opacity-70"><X className="h-4 w-4" /></button>
    </div>
  )

  return (
    <div className="group/item flex items-center gap-2 py-1.5 border-b last:border-0">
      <div className="flex-1 min-w-0">
        <span className="text-sm">{item.title}</span>
        <div className="flex gap-2 mt-0.5">
          <span className="text-xs text-muted-foreground">{RESPONSE_TYPE_LABELS[item.response_type]}</span>
          {item.due_date && <span className="text-xs text-muted-foreground">Due: {item.due_date}</span>}
        </div>
      </div>
      <div className="flex items-center gap-0.5 opacity-0 group-hover/item:opacity-100 transition-all">
        <button onClick={() => onMove('up')} className="text-muted-foreground hover:text-foreground p-0.5" title="Move up"><ArrowUp className="h-3 w-3" /></button>
        <button onClick={() => onMove('down')} className="text-muted-foreground hover:text-foreground p-0.5" title="Move down"><ArrowDown className="h-3 w-3" /></button>
        <button onClick={() => setEditing(true)} className="text-muted-foreground hover:text-foreground p-0.5"><Pencil className="h-3.5 w-3.5" /></button>
        <button onClick={onDelete} className="text-muted-foreground hover:text-destructive p-0.5"><Trash2 className="h-3.5 w-3.5" /></button>
      </div>
    </div>
  )
}

function EventTypeCard({ eventType, onDelete }: { eventType: EventType; onDelete: () => void }) {
  const [expanded, setExpanded]       = useState(false)
  const [items, setItems]             = useState<BlueprintItem[]>([])
  const [loaded, setLoaded]           = useState(false)
  const [newItem, setNewItem]         = useState('')
  const [newRespType, setNewRespType] = useState<'text' | 'date' | 'checkbox' | 'list' | 'members'>('text')
  const [adding, setAdding]           = useState(false)
  const [editingName, setEditingName] = useState(false)
  const [nameValue, setNameValue]     = useState(eventType.name)
  const [savingName, setSavingName]   = useState(false)

  async function handleSaveName() {
    if (!nameValue.trim()) return
    setSavingName(true)
    await updateEventType(eventType.id, nameValue.trim())
    setSavingName(false)
    setEditingName(false)
  }

  async function handleExpand() {
    setExpanded(e => !e)
    if (!loaded) {
      const data = await getBlueprintItems(eventType.id)
      setItems(data)
      setLoaded(true)
    }
  }

  async function handleMoveItem(id: string, direction: 'up' | 'down') {
    await moveBlueprintItem(id, eventType.id, direction)
    const data = await getBlueprintItems(eventType.id)
    setItems(data)
  }

  async function handleAddItem() {
    if (!newItem.trim()) return
    setAdding(true)
    await addBlueprintItem(eventType.id, newItem.trim(), { response_type: newRespType })
    const data = await getBlueprintItems(eventType.id)
    setItems(data)
    setNewItem('')
    setNewRespType('text')
    setAdding(false)
  }

  async function handleDeleteItem(id: string) {
    await deleteBlueprintItem(id)
    setItems(prev => prev.filter(i => i.id !== id))
  }

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between gap-2">
          <button onClick={handleExpand} className="flex items-center gap-2 text-left shrink-0">
            {expanded ? <ChevronDown className="h-4 w-4 text-muted-foreground" /> : <ChevronRight className="h-4 w-4 text-muted-foreground" />}
          </button>
          {editingName ? (
            <div className="flex items-center gap-2 flex-1">
              <Input value={nameValue} onChange={e => setNameValue(e.target.value)} className="h-7 text-sm" autoFocus onKeyDown={e => { if (e.key === 'Enter') handleSaveName(); if (e.key === 'Escape') setEditingName(false) }} />
              <button onClick={handleSaveName} disabled={savingName} className="text-primary hover:opacity-70"><Check className="h-4 w-4" /></button>
              <button onClick={() => { setEditingName(false); setNameValue(eventType.name) }} className="text-muted-foreground hover:opacity-70"><X className="h-4 w-4" /></button>
            </div>
          ) : (
            <button onClick={handleExpand} className="flex-1 text-left">
              <CardTitle className="text-base">{nameValue}</CardTitle>
            </button>
          )}
          <div className="flex items-center gap-1.5 shrink-0">
            {!editingName && <button onClick={() => setEditingName(true)} className="text-muted-foreground hover:text-foreground transition-colors"><Pencil className="h-3.5 w-3.5" /></button>}
            <button onClick={onDelete} className="text-muted-foreground hover:text-destructive transition-colors"><Trash2 className="h-4 w-4" /></button>
          </div>
        </div>
        {eventType.description && <p className="text-xs text-muted-foreground pl-6">{eventType.description}</p>}
      </CardHeader>

      {expanded && (
        <CardContent className="pt-0 space-y-2">
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Checklist Items</p>
          {items.length > 0 ? (
            <div>
              {items.map(item => (
                <BlueprintItemRow
                  key={item.id}
                  item={item}
                  onDelete={() => handleDeleteItem(item.id)}
                  onUpdate={title => setItems(prev => prev.map(i => i.id === item.id ? { ...i, title } : i))}
                  onMove={dir => handleMoveItem(item.id, dir)}
                />
              ))}
            </div>
          ) : (
            <p className="text-xs text-muted-foreground">No checklist items yet.</p>
          )}
          <div className="space-y-2 pt-1">
            <div className="flex gap-2">
              <Input placeholder="Add checklist item…" value={newItem} onChange={e => setNewItem(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') handleAddItem() }} className="h-8 text-sm flex-1" />
              <select className="h-8 text-xs rounded border border-input bg-background px-2" value={newRespType} onChange={e => setNewRespType(e.target.value as 'text' | 'date' | 'checkbox' | 'list' | 'members')}>
                <option value="text">Text</option>
                <option value="date">Date</option>
                <option value="checkbox">Checkbox</option>
                <option value="list">List</option>
                <option value="members">Family Members</option>
              </select>
              <Button size="sm" disabled={!newItem.trim() || adding} onClick={handleAddItem}>
                <Plus className="h-3.5 w-3.5" />
              </Button>
            </div>
          </div>
        </CardContent>
      )}
    </Card>
  )
}

export function AdminEventTypesClient({ initialEventTypes }: { initialEventTypes: EventType[] }) {
  const [eventTypes, setEventTypes] = useState(initialEventTypes)
  const [showForm, setShowForm] = useState(false)
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  async function handleCreate() {
    if (!name.trim()) { setError('Name is required'); return }
    setSaving(true)
    const result = await createEventType(name.trim(), description.trim())
    if (!result.success) { setError(result.error ?? 'Error'); setSaving(false); return }
    const { data } = await import('@/app/actions/admin/event-types').then(m => Promise.resolve({ data: null }))
    window.location.reload()
  }

  async function handleDelete(id: string) {
    if (!confirm('Delete this event type and all its checklist items?')) return
    await deleteEventType(id)
    setEventTypes(prev => prev.filter(t => t.id !== id))
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button onClick={() => setShowForm(s => !s)}>
          <Plus className="h-4 w-4" /> New Event Type
        </Button>
      </div>

      {showForm && (
        <Card className="border-primary/30 bg-primary/5">
          <CardContent className="pt-4 space-y-3">
            <div className="space-y-1.5">
              <Label>Name <span className="text-destructive">*</span></Label>
              <Input placeholder="e.g. Family Reunion" value={name} onChange={e => { setName(e.target.value); setError('') }} />
            </div>
            <div className="space-y-1.5">
              <Label>Description <span className="text-muted-foreground text-xs">(optional)</span></Label>
              <Input placeholder="Brief description of this event type" value={description} onChange={e => setDescription(e.target.value)} />
            </div>
            {error && <p className="text-sm text-destructive">{error}</p>}
            <div className="flex gap-2">
              <Button disabled={saving} onClick={handleCreate}>{saving ? 'Creating…' : 'Create'}</Button>
              <Button variant="outline" onClick={() => { setShowForm(false); setName(''); setDescription(''); setError('') }}>Cancel</Button>
            </div>
          </CardContent>
        </Card>
      )}

      {eventTypes.length === 0 && !showForm ? (
        <p className="text-sm text-muted-foreground py-8 text-center">No event types yet. Create one to get started.</p>
      ) : (
        eventTypes.map(et => <EventTypeCard key={et.id} eventType={et} onDelete={() => handleDelete(et.id)} />)
      )}
    </div>
  )
}
