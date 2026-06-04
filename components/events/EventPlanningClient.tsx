'use client'

import { useState } from 'react'
import { Check, X, Pencil } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { submitAssignmentResponse, type MyAssignment } from '@/app/actions/event-planning'

const STATUS_COLORS = {
  pending:   'bg-muted text-muted-foreground',
  submitted: 'bg-blue-100 text-blue-700',
  approved:  'bg-green-100 text-green-700',
}

const STATUS_LABELS = {
  pending:   'No response yet',
  submitted: 'Response submitted — awaiting approval',
  approved:  'Approved',
}

function ResponseDisplay({ response, type, className = 'text-muted-foreground' }: { response: string; type: string; className?: string }) {
  if (type === 'checkbox') return <p className={`text-sm ${className}`}>{response === 'true' ? '✓ Marked complete' : '✗ Not complete'}</p>
  if (type === 'list') {
    const items: string[] = (() => { try { return JSON.parse(response) } catch { return [] } })()
    return (
      <ul className={`text-sm space-y-0.5 ${className}`}>
        {items.filter(Boolean).map((item, i) => <li key={i}>• {item}</li>)}
      </ul>
    )
  }
  return <p className={`text-sm italic ${className}`}>"{response}"</p>
}

function ListInput({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const items: string[] = (() => { try { return JSON.parse(value || '[]') } catch { return [] } })()

  function update(newItems: string[]) { onChange(JSON.stringify(newItems)) }

  return (
    <div className="space-y-2">
      {items.map((item, i) => (
        <div key={i} className="flex gap-2 items-center">
          <input
            type="text"
            value={item}
            onChange={e => { const n = [...items]; n[i] = e.target.value; update(n) }}
            className="flex-1 rounded border border-input bg-background px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-ring/50"
          />
          <button onClick={() => update(items.filter((_, j) => j !== i))} className="text-muted-foreground hover:text-destructive transition-colors">
            <span className="text-xs">✕</span>
          </button>
        </div>
      ))}
      <button
        onClick={() => update([...items, ''])}
        className="text-xs text-primary hover:opacity-70 transition-opacity flex items-center gap-1"
      >
        + Add item
      </button>
    </div>
  )
}

function AssignmentRow({ assignment }: { assignment: MyAssignment }) {
  const [editing, setEditing]   = useState(false)
  const [response, setResponse] = useState(assignment.response ?? '')
  const [draft, setDraft]       = useState(assignment.response ?? '')
  const [saving, setSaving]     = useState(false)
  const [error, setError]       = useState('')
  const [status, setStatus]     = useState(assignment.response_status)

  const isLocked = status === 'approved'

  async function handleSave() {
    if (!draft.trim()) { setError('Response cannot be empty'); return }
    setSaving(true)
    setError('')
    const result = await submitAssignmentResponse(assignment.id, draft.trim())
    setSaving(false)
    if (result.success) {
      setResponse(draft.trim())
      setStatus('submitted')
      setEditing(false)
    } else {
      setError(result.error ?? 'Failed to save')
    }
  }

  return (
    <div className="border-b last:border-0 py-3 space-y-2">
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="text-sm font-medium">{assignment.blueprint_item_title}</p>
          <p className="text-xs text-muted-foreground">
            {assignment.event_name}
            {assignment.event_date ? ` · ${assignment.event_date}` : ''}
            {assignment.event_time ? ` at ${assignment.event_time}` : ''}
            {assignment.due_date ? ` · Due: ${assignment.due_date}` : ''}
          </p>
        </div>
        <span className={`text-xs px-2 py-0.5 rounded-full shrink-0 ${STATUS_COLORS[status]}`}>
          {status === 'pending' ? 'Pending' : status === 'submitted' ? 'Submitted' : 'Approved'}
        </span>
      </div>

      <p className="text-xs text-muted-foreground">{STATUS_LABELS[status]}</p>

      {!isLocked && !editing && (
        <button
          onClick={() => { setDraft(response); setEditing(true) }}
          className="flex items-center gap-1 text-xs text-primary hover:opacity-70 transition-opacity"
        >
          <Pencil className="h-3.5 w-3.5" />
          {response ? 'Edit response' : 'Add response'}
        </button>
      )}

      {editing && (
        <div className="space-y-2">
          {assignment.response_type === 'checkbox' ? (
            <label className="flex items-center gap-2 cursor-pointer text-sm">
              <input
                type="checkbox"
                checked={draft === 'true'}
                onChange={e => setDraft(e.target.checked ? 'true' : 'false')}
                className="h-4 w-4 rounded border-input accent-primary"
              />
              Mark as complete
            </label>
          ) : assignment.response_type === 'list' ? (
            <ListInput value={draft} onChange={setDraft} />
          ) : assignment.response_type === 'date' ? (
            <input
              type="date"
              value={draft}
              onChange={e => { setDraft(e.target.value); setError('') }}
              className="rounded-lg border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring/50"
            />
          ) : (
            <textarea
              value={draft}
              onChange={e => { setDraft(e.target.value); setError('') }}
              placeholder="Enter your response…"
              rows={3}
              className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring/50 resize-none"
            />
          )}
          {error && <p className="text-xs text-destructive">{error}</p>}
          <div className="flex gap-2">
            <Button size="sm" disabled={saving} onClick={handleSave}>
              <Check className="h-3.5 w-3.5" /> {saving ? 'Saving…' : 'Submit Response'}
            </Button>
            <Button size="sm" variant="ghost" onClick={() => { setEditing(false); setDraft(response); setError('') }}>
              <X className="h-3.5 w-3.5" /> Cancel
            </Button>
          </div>
        </div>
      )}

      {!editing && response && !isLocked && (
        <ResponseDisplay response={response} type={assignment.response_type} />
      )}
      {isLocked && response && (
        <div className="rounded-lg bg-green-50 border border-green-200 px-3 py-2">
          <ResponseDisplay response={response} type={assignment.response_type} className="text-green-800" />
          <p className="text-xs text-green-600 mt-1">Approved — response is locked.</p>
        </div>
      )}
    </div>
  )
}

export function EventPlanningClient({ initialAssignments }: { initialAssignments: MyAssignment[] }) {
  if (initialAssignments.length === 0) {
    return (
      <div className="text-center py-16">
        <p className="text-muted-foreground">You have no tasks assigned to you yet.</p>
      </div>
    )
  }

  // Group by event
  const byEvent: Record<string, MyAssignment[]> = {}
  for (const a of initialAssignments) {
    if (!byEvent[a.event_id]) byEvent[a.event_id] = []
    byEvent[a.event_id].push(a)
  }

  return (
    <div className="space-y-6">
      {Object.entries(byEvent).map(([eventId, items]) => (
        <Card key={eventId}>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">{items[0].event_name}</CardTitle>
            {items[0].event_date && (
              <p className="text-xs text-muted-foreground">
                {items[0].event_date}{items[0].event_time ? ` at ${items[0].event_time}` : ''}
              </p>
            )}
          </CardHeader>
          <CardContent>
            {items.map(a => <AssignmentRow key={a.id} assignment={a} />)}
          </CardContent>
        </Card>
      ))}
    </div>
  )
}
