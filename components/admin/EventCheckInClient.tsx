'use client'

import { useState, useTransition } from 'react'
import { Search, CheckCircle, Circle } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { useConfirm } from '@/components/ui/confirm'
import { checkInAttendee, type CheckInAttendee } from '@/app/actions/admin/event-checkin'

interface Props {
  eventId: string
  initialAttendees: CheckInAttendee[]
}

export function EventCheckInClient({ eventId, initialAttendees }: Props) {
  const confirm = useConfirm()
  const [attendees, setAttendees] = useState(initialAttendees)
  const [query, setQuery] = useState('')
  const [isPending, startTransition] = useTransition()

  const filtered = attendees.filter(a =>
    a.name.toLowerCase().includes(query.toLowerCase())
  )

  const checkedIn = attendees.filter(a => !!a.checked_in_at).length

  async function handleToggle(attendeeId: string, currentlyCheckedIn: boolean) {
    const name = attendees.find(a => a.id === attendeeId)?.name ?? 'this attendee'
    const ok = await confirm({
      title: currentlyCheckedIn ? 'Undo check-in' : 'Check in',
      description: currentlyCheckedIn
        ? `Undo the check-in for ${name}?`
        : `Check in ${name}?`,
      confirmLabel: currentlyCheckedIn ? 'Undo check-in' : 'Check in',
      destructive: currentlyCheckedIn,
    })
    if (!ok) return
    startTransition(async () => {
      const result = await checkInAttendee(attendeeId, eventId, !currentlyCheckedIn)
      if (result.success) {
        setAttendees(prev => prev.map(a =>
          a.id === attendeeId
            ? { ...a, checked_in_at: !currentlyCheckedIn ? new Date().toISOString() : null }
            : a
        ))
      }
    })
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          {checkedIn} of {attendees.length} checked in
        </p>
        <div className="relative w-56">
          <Search className="absolute left-2.5 top-2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search…"
            value={query}
            onChange={e => setQuery(e.target.value)}
            className="pl-8 h-8"
          />
        </div>
      </div>

      {filtered.length === 0 ? (
        <p className="text-sm text-muted-foreground py-4 text-center">No attendees match your search.</p>
      ) : (
        <ul className="divide-y rounded-xl border overflow-hidden">
          {filtered.map(a => (
            <li
              key={a.id}
              className={`flex items-center gap-3 px-4 py-3 cursor-pointer hover:bg-muted/50 transition-colors ${a.checked_in_at ? 'bg-green-50 dark:bg-green-950/20' : ''}`}
              onClick={() => !isPending && handleToggle(a.id, !!a.checked_in_at)}
            >
              {a.checked_in_at ? (
                <CheckCircle className="h-5 w-5 text-green-600 shrink-0" />
              ) : (
                <Circle className="h-5 w-5 text-muted-foreground/40 shrink-0" />
              )}
              <div className="flex-1">
                <p className="text-sm font-medium">{a.name}</p>
                {a.rsvp_submitted_by && (
                  <p className="text-xs text-muted-foreground">RSVP by {a.rsvp_submitted_by}</p>
                )}
              </div>
              {a.checked_in_at && (
                <span className="text-xs text-green-600">
                  {new Date(a.checked_in_at).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}
                </span>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
