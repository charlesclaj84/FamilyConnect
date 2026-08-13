'use client'

import { useState } from 'react'
import { Pencil } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useConfirm } from '@/components/ui/confirm'
import { FormError } from '@/components/ui/form-message'
import { submitRsvp, type RsvpPerson, type MyRsvp } from '@/app/actions/events'

interface Props {
  eventId: string
  familyMembers: RsvpPerson[]
  existingRsvp: MyRsvp | null
  deadlinePassed: boolean
}

function buildInitialStatuses(
  members: RsvpPerson[],
  rsvp: MyRsvp | null
): Record<string, boolean> {
  const map: Record<string, boolean> = {}
  for (const m of members) {
    const saved = rsvp?.attendee_statuses.find(s => s.person_id === m.person_id)
    map[m.person_id] = saved?.is_attending ?? false
  }
  return map
}

export function EventRsvpClient({ eventId, familyMembers, existingRsvp, deadlinePassed }: Props) {
  const confirm = useConfirm()
  const hasPersonalRsvp            = !!(existingRsvp?.id)
  const [statuses, setStatuses]   = useState(() => buildInitialStatuses(familyMembers, existingRsvp))
  // Pre-populate edit form with any inherited (parent-submitted) statuses so the
  // child sees their existing RSVP when they open the form for the first time.
  const [editStatuses, setEditStatuses] = useState<Record<string, boolean>>(
    () => hasPersonalRsvp ? {} : buildInitialStatuses(familyMembers, existingRsvp)
  )
  const [editing, setEditing]     = useState(!hasPersonalRsvp)   // edit mode if no personal submission yet
  const [saving, setSaving]       = useState(false)
  const [saved, setSaved]         = useState(hasPersonalRsvp)
  const [error, setError]         = useState('')

  function startEdit() {
    setEditStatuses({ ...statuses })
    setEditing(true)
    setSaved(false)
    setError('')
  }

  function cancelEdit() {
    setEditing(false)
    setEditStatuses({})
    setError('')
  }

  // NO `togglePerson`. There was one, unreferenced: the row offers an explicit Yes and an
  // explicit No rather than one control that flips, so nothing ever needed to negate the
  // current value. Both buttons set the answer they name (see the row below).

  async function handleSave() {
    const personStatuses = familyMembers.map(m => ({
      person_id:    m.person_id,
      is_attending: editStatuses[m.person_id] ?? false,
    }))
    const attending = personStatuses.filter(p => p.is_attending).length
    const ok = await confirm({
      title: hasPersonalRsvp ? 'Update RSVP' : 'Submit RSVP',
      description: `${hasPersonalRsvp ? 'Update' : 'Submit'} your RSVP with ${attending} of ${personStatuses.length} attending?`,
      confirmLabel: hasPersonalRsvp ? 'Update RSVP' : 'Submit RSVP',
    })
    if (!ok) return
    setSaving(true)
    setError('')
    const result = await submitRsvp(eventId, personStatuses)
    setSaving(false)
    if (result.success) {
      setStatuses({ ...editStatuses })
      setEditing(false)
      setSaved(true)
    } else {
      setError(result.error ?? 'Failed to save RSVP')
    }
  }

  if (familyMembers.length === 0) {
    return <p className="text-sm text-muted-foreground">No family members found for RSVP.</p>
  }

  // ── View state ─────────────────────────────────────────────────────────────
  if (!editing) {
    return (
      <div className="space-y-3">
        <div className="divide-y rounded-lg border">
          {familyMembers.map(person => {
            const name = [person.first_name, person.last_name].filter(Boolean).join(' ') || 'Family Member'
            const attending = statuses[person.person_id] ?? false
            return (
              <div key={person.person_id} className="flex items-center justify-between px-3 py-2.5">
                <div>
                  <p className="text-sm font-medium">{name}</p>
                  <p className="text-xs text-muted-foreground">{person.relationship}</p>
                </div>
                <span className={`text-sm font-medium ${attending ? 'text-brand-affirm' : 'text-muted-foreground'}`}>
                  {attending ? '✓ Attending' : '✗ Not attending'}
                </span>
              </div>
            )
          })}
        </div>

        {saved && <p className="text-xs text-muted-foreground">Response saved.</p>}

        {!deadlinePassed && (
          <Button variant="outline" size="sm" onClick={startEdit}>
            <Pencil className="h-3.5 w-3.5" /> Edit RSVP
          </Button>
        )}
        {deadlinePassed && <p className="text-xs text-muted-foreground">The RSVP deadline has passed — your response is locked.</p>}
      </div>
    )
  }

  // ── Edit state ─────────────────────────────────────────────────────────────
  return (
    <div className="space-y-4">
      <div className="divide-y rounded-lg border">
        {familyMembers.map(person => {
          const name = [person.first_name, person.last_name].filter(Boolean).join(' ') || 'Family Member'
          const shirt = person.tshirt_category && person.tshirt_size ? `${person.tshirt_category} / ${person.tshirt_size}` : 'No t-shirt on file'
          const attending = editStatuses[person.person_id] ?? false

          return (
            <div key={person.person_id} className="flex items-center justify-between px-3 py-2.5">
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium">{name}</p>
                <p className="text-xs text-muted-foreground">{person.relationship} · {shirt}</p>
              </div>

              {/* Per-person attending toggle */}
              <div className="flex rounded-md border overflow-hidden shrink-0 ml-3">
                <button
                  type="button"
                  onClick={() => setEditStatuses(prev => ({ ...prev, [person.person_id]: true }))}
                  className={`px-3 py-1.5 text-xs font-medium transition-colors ${
                    attending ? 'bg-brand-affirm text-brand-on-affirm' : 'text-muted-foreground hover:bg-muted/50'
                  }`}
                >
                  Yes
                </button>
                <button
                  type="button"
                  onClick={() => setEditStatuses(prev => ({ ...prev, [person.person_id]: false }))}
                  className={`px-3 py-1.5 text-xs font-medium transition-colors border-l ${
                    !attending ? 'bg-muted text-foreground' : 'text-muted-foreground hover:bg-muted/50'
                  }`}
                >
                  No
                </button>
              </div>
            </div>
          )
        })}
      </div>

      <FormError message={error} />

      <div className="flex gap-2">
        <Button onClick={handleSave} disabled={saving}>
          {saving ? 'Saving…' : 'Save RSVP'}
        </Button>
        {hasPersonalRsvp && (
          <Button variant="outline" onClick={cancelEdit}>Cancel</Button>
        )}
      </div>
    </div>
  )
}
