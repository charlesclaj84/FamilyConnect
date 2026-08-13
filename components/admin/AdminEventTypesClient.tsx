'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Plus, Trash2, ChevronDown, ChevronRight, Pencil, Check, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { useConfirm } from '@/components/ui/confirm'
import { FormError } from '@/components/ui/form-message'
import { useServerState } from '@/lib/use-server-state'
import {
  createEventType, updateEventType, deleteEventType, moveEventType,
  getBlueprintItems, addBlueprintItem, updateBlueprintItem, deleteBlueprintItem,
  updateBlueprintItemFull, moveBlueprintItem,
  getSubTemplates, addSubTemplate, removeSubTemplate,
  type EventType, type BlueprintItem, type SubTemplate,
} from '@/app/actions/admin/event-types'
import { ArrowUp, ArrowDown } from 'lucide-react'
import { formatDate } from '@/lib/date-utils'

const RESPONSE_TYPE_LABELS: Record<string, string> = { text: 'Text', date: 'Date', checkbox: 'Checkbox', list: 'List', members: 'Family Members' }

function BlueprintItemRow({ item, onDelete, onUpdate, onMove }: { item: BlueprintItem; onDelete: () => void; onUpdate: (title: string) => void; onMove: (direction: 'up' | 'down') => void }) {
  const [editing, setEditing] = useState(false)
  const [value, setValue] = useState(item.title)
  const [saving, setSaving] = useState(false)
  const confirm = useConfirm()

  async function save() {
    if (!value.trim()) return
    const ok = await confirm({
      title: 'Rename checklist item',
      description: `Rename "${item.title}" to "${value.trim()}"?`,
      confirmLabel: 'Save',
    })
    if (!ok) return
    setSaving(true)
    await updateBlueprintItem(item.id, value.trim())
    onUpdate(value.trim())
    setSaving(false)
    setEditing(false)
  }

  if (editing) return (
    <div className="flex items-center gap-2 py-1.5">
      {/* The input is the only thing naming this row while it is being edited, so it
          carries the item title rather than a bare "Name". */}
      <Input aria-label={`Rename checklist item ${item.title}`} value={value} onChange={e => setValue(e.target.value)} className="h-7 text-sm flex-1" autoFocus onKeyDown={e => { if (e.key === 'Enter') save(); if (e.key === 'Escape') setEditing(false) }} />
      <button onClick={save} disabled={saving} aria-label="Save name" className="text-primary hover:opacity-70"><Check className="h-4 w-4" /></button>
      <button onClick={() => setEditing(false)} aria-label="Cancel renaming" className="text-muted-foreground hover:opacity-70"><X className="h-4 w-4" /></button>
    </div>
  )

  return (
    <div className="group/item flex items-center gap-2 py-1.5 border-b last:border-0">
      <div className="flex-1 min-w-0">
        <span className="text-sm">{item.title}</span>
        <div className="flex gap-2 mt-0.5">
          <span className="text-xs text-muted-foreground">{RESPONSE_TYPE_LABELS[item.response_type]}</span>
          {item.due_date && <span className="text-xs text-muted-foreground">Due: {formatDate(item.due_date)}</span>}
        </div>
      </div>
      {/* `aria-label` NAMES THESE, NOT `title`. Every one of them is icon-only, so
          without a label the whole row reads as four unnamed buttons — and `title` is
          not a fix: it is never surfaced by a touch screen reader and is announced
          inconsistently by the desktop ones, so it was a tooltip pretending to be a
          name. Each label carries the ITEM, because a list of these rows otherwise
          offers a dozen identical "Delete" buttons with nothing to tell them apart. */}
      <div className="flex items-center gap-0.5 opacity-0 group-hover/item:opacity-100 transition-all">
        <button onClick={() => onMove('up')} aria-label={`Move ${item.title} up`} className="text-muted-foreground hover:text-foreground p-0.5"><ArrowUp className="h-3 w-3" /></button>
        <button onClick={() => onMove('down')} aria-label={`Move ${item.title} down`} className="text-muted-foreground hover:text-foreground p-0.5"><ArrowDown className="h-3 w-3" /></button>
        <button onClick={() => setEditing(true)} aria-label={`Rename ${item.title}`} className="text-muted-foreground hover:text-foreground p-0.5"><Pencil className="h-3.5 w-3.5" /></button>
        <button onClick={onDelete} aria-label={`Delete ${item.title}`} className="text-muted-foreground hover:text-destructive p-0.5"><Trash2 className="h-3.5 w-3.5" /></button>
      </div>
    </div>
  )
}

function EventTypeCard({ eventType, allEventTypes, onDelete, onMove, isFirst, isLast }: { eventType: EventType; allEventTypes: EventType[]; onDelete: () => void; onMove: (direction: 'up' | 'down') => void; isFirst: boolean; isLast: boolean }) {
  const [expanded, setExpanded]       = useState(false)
  const [items, setItems]             = useState<BlueprintItem[]>([])
  const [subTemplates, setSubTemplates] = useState<SubTemplate[]>([])
  const [newSubId, setNewSubId]       = useState('')
  const [addingSub, setAddingSub]     = useState(false)
  const [loaded, setLoaded]           = useState(false)
  const [newItem, setNewItem]         = useState('')
  const [newRespType, setNewRespType] = useState<'text' | 'date' | 'checkbox' | 'list' | 'members'>('text')
  const [adding, setAdding]           = useState(false)
  const [editingName, setEditingName] = useState(false)
  const [nameValue, setNameValue]     = useState(eventType.name)
  const [savingName, setSavingName]   = useState(false)
  const confirm = useConfirm()

  async function handleSaveName() {
    if (!nameValue.trim()) return
    const ok = await confirm({
      title: 'Rename event type',
      description: `Rename "${eventType.name}" to "${nameValue.trim()}"?`,
      confirmLabel: 'Save',
    })
    if (!ok) return
    setSavingName(true)
    await updateEventType(eventType.id, nameValue.trim())
    setSavingName(false)
    setEditingName(false)
  }

  async function handleExpand() {
    setExpanded(e => !e)
    if (!loaded) {
      const [itemData, subData] = await Promise.all([getBlueprintItems(eventType.id), getSubTemplates(eventType.id)])
      setItems(itemData)
      setSubTemplates(subData)
      setLoaded(true)
    }
  }

  async function handleAddSubTemplate() {
    if (!newSubId) return
    setAddingSub(true)
    const res = await addSubTemplate(eventType.id, newSubId)
    if (res.success) {
      setSubTemplates(await getSubTemplates(eventType.id))
      setNewSubId('')
    } else {
      alert(res.error ?? 'Could not add sub-event template.')
    }
    setAddingSub(false)
  }

  async function handleRemoveSubTemplate(linkId: string) {
    const sub = subTemplates.find(s => s.link_id === linkId)
    const ok = await confirm({
      title: 'Remove sub-event template',
      description: sub
        ? `Remove "${sub.name}" as a sub-event of "${eventType.name}"?`
        : `Remove this sub-event template from "${eventType.name}"?`,
      confirmLabel: 'Remove',
      destructive: true,
    })
    if (!ok) return
    await removeSubTemplate(linkId)
    setSubTemplates(prev => prev.filter(s => s.link_id !== linkId))
  }

  // Templates available to add: everything except this one and those already linked.
  const linkedChildIds = new Set(subTemplates.map(s => s.child_event_type_id))
  const subTemplateOptions = allEventTypes.filter(t => t.id !== eventType.id && !linkedChildIds.has(t.id))

  async function handleMoveItem(id: string, direction: 'up' | 'down') {
    const ok = await confirm({
      title: 'Reorder checklist',
      description: `Move "${items.find(i => i.id === id)?.title ?? 'this item'}" ${direction}?`,
      confirmLabel: 'Move',
    })
    if (!ok) return
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
    const item = items.find(i => i.id === id)
    const ok = await confirm({
      title: 'Delete checklist item',
      description: item
        ? `Delete "${item.title}" from the "${eventType.name}" checklist? This cannot be undone.`
        : 'Delete this checklist item? This cannot be undone.',
      confirmLabel: 'Delete item',
      destructive: true,
    })
    if (!ok) return
    await deleteBlueprintItem(id)
    setItems(prev => prev.filter(i => i.id !== id))
  }

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between gap-2">
          {/* The chevron and the title below are two triggers for one disclosure, so
              both carry `aria-expanded`. This one is icon-only and needs the name; the
              other is named by the title it renders. */}
          <button onClick={handleExpand} aria-expanded={expanded} aria-label={`${expanded ? 'Collapse' : 'Expand'} ${nameValue}`} className="flex items-center gap-2 text-left shrink-0">
            {expanded ? <ChevronDown className="h-4 w-4 text-muted-foreground" /> : <ChevronRight className="h-4 w-4 text-muted-foreground" />}
          </button>
          {editingName ? (
            <div className="flex items-center gap-2 flex-1">
              <Input aria-label={`Rename event type ${eventType.name}`} value={nameValue} onChange={e => setNameValue(e.target.value)} className="h-7 text-sm" autoFocus onKeyDown={e => { if (e.key === 'Enter') handleSaveName(); if (e.key === 'Escape') setEditingName(false) }} />
              <button onClick={handleSaveName} disabled={savingName} aria-label="Save name" className="text-primary hover:opacity-70"><Check className="h-4 w-4" /></button>
              <button onClick={() => { setEditingName(false); setNameValue(eventType.name) }} aria-label="Cancel renaming" className="text-muted-foreground hover:opacity-70"><X className="h-4 w-4" /></button>
            </div>
          ) : (
            <button onClick={handleExpand} aria-expanded={expanded} className="flex-1 text-left">
              <CardTitle className="text-base">{nameValue}</CardTitle>
            </button>
          )}
          {/* See the note on BlueprintItemRow's controls: `aria-label`, not `title`, and
              each one names the event type so a page of these cards does not present a
              column of identical unlabelled buttons. */}
          <div className="flex items-center gap-1.5 shrink-0">
            <button onClick={() => onMove('up')} disabled={isFirst} aria-label={`Move ${nameValue} up`} className="text-muted-foreground hover:text-foreground transition-colors disabled:opacity-30 disabled:cursor-default"><ArrowUp className="h-3.5 w-3.5" /></button>
            <button onClick={() => onMove('down')} disabled={isLast} aria-label={`Move ${nameValue} down`} className="text-muted-foreground hover:text-foreground transition-colors disabled:opacity-30 disabled:cursor-default"><ArrowDown className="h-3.5 w-3.5" /></button>
            {!editingName && <button onClick={() => setEditingName(true)} aria-label={`Rename ${nameValue}`} className="text-muted-foreground hover:text-foreground transition-colors"><Pencil className="h-3.5 w-3.5" /></button>}
            <button onClick={onDelete} aria-label={`Delete ${nameValue}`} className="text-muted-foreground hover:text-destructive transition-colors"><Trash2 className="h-4 w-4" /></button>
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

          {/* Auto-included sub-event templates */}
          <div className="space-y-2 pt-3 mt-1 border-t">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Auto-included sub-events</p>
            {subTemplates.length > 0 ? (
              <div>
                {subTemplates.map(s => (
                  <div key={s.link_id} className="group/sub flex items-center gap-2 py-1.5 border-b last:border-0">
                    <span className="text-sm flex-1 min-w-0 truncate">{s.name}</span>
                    <button onClick={() => handleRemoveSubTemplate(s.link_id)} aria-label={`Remove sub-event template ${s.name}`} className="text-muted-foreground hover:text-destructive p-0.5 opacity-0 group-hover/sub:opacity-100 transition-all">
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-xs text-muted-foreground">None. Added templates are auto-created as sub-events whenever an event uses this template.</p>
            )}
            {subTemplateOptions.length > 0 && (
              <div className="flex gap-2 pt-1">
                <select className="h-8 text-sm rounded border border-input bg-background px-2 flex-1" value={newSubId} onChange={e => setNewSubId(e.target.value)}>
                  <option value="">— Add a template as sub-event —</option>
                  {subTemplateOptions.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                </select>
                <Button size="sm" disabled={!newSubId || addingSub} onClick={handleAddSubTemplate}>
                  <Plus className="h-3.5 w-3.5" />
                </Button>
              </div>
            )}
          </div>
        </CardContent>
      )}
    </Card>
  )
}

export function AdminEventTypesClient({ initialEventTypes }: { initialEventTypes: EventType[] }) {
  const router = useRouter()
  const confirm = useConfirm()
  // `useServerState`: `handleCreate` refreshes rather than building a row, so
  // adopting the refreshed props is what makes the new type appear.
  const [eventTypes, setEventTypes] = useServerState(initialEventTypes)
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
    setName(''); setDescription('')
    setShowForm(false)
    setSaving(false)
    router.refresh()
  }

  async function handleDelete(id: string) {
    const eventType = eventTypes.find(t => t.id === id)
    const ok = await confirm({
      title: 'Delete event type',
      description: eventType
        ? `Delete "${eventType.name}" and all of its checklist items? This cannot be undone.`
        : 'Delete this event type and all its checklist items? This cannot be undone.',
      confirmLabel: 'Delete event type',
      destructive: true,
    })
    if (!ok) return
    await deleteEventType(id)
    setEventTypes(prev => prev.filter(t => t.id !== id))
  }

  async function handleMove(id: string, direction: 'up' | 'down') {
    const ok = await confirm({
      title: 'Reorder event types',
      description: `Move "${eventTypes.find(t => t.id === id)?.name ?? 'this event type'}" ${direction}?`,
      confirmLabel: 'Move',
    })
    if (!ok) return
    setEventTypes(prev => {
      const idx = prev.findIndex(t => t.id === id)
      const swapIdx = direction === 'up' ? idx - 1 : idx + 1
      if (idx === -1 || swapIdx < 0 || swapIdx >= prev.length) return prev
      const next = [...prev]
      ;[next[idx], next[swapIdx]] = [next[swapIdx], next[idx]]
      return next
    })
    await moveEventType(id, direction)
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
              <Label required>Name</Label>
              <Input placeholder="e.g. Family Reunion" value={name} onChange={e => { setName(e.target.value); setError('') }} />
            </div>
            <div className="space-y-1.5">
              <Label>Description <span className="text-muted-foreground text-xs">(optional)</span></Label>
              <Input placeholder="Brief description of this event type" value={description} onChange={e => setDescription(e.target.value)} />
            </div>
            <FormError message={error} />
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
        eventTypes.map((et, i) => <EventTypeCard key={et.id} eventType={et} allEventTypes={eventTypes} onDelete={() => handleDelete(et.id)} onMove={dir => handleMove(et.id, dir)} isFirst={i === 0} isLast={i === eventTypes.length - 1} />)
      )}
    </div>
  )
}
