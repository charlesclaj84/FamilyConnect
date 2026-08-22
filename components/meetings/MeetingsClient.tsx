'use client'

import { useState, useTransition } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { CalendarCheck, CheckCircle, Gavel, Plus, Users } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Dialog } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { PersonPicker } from '@/components/ui/person-picker'
import { PersonMultiSelect } from '@/components/ui/person-multi-select'
import { FormError } from '@/components/ui/form-message'
import { useServerState } from '@/lib/use-server-state'
import { formatDate, todayLocal } from '@/lib/date-utils'
import { scheduleMeeting, type MeetingSession } from '@/app/actions/meetings'

interface Person { id: string; first_name: string; last_name: string; nick_name?: string | null }

/**
 * Meeting Minutes: every meeting the family has held or scheduled.
 *
 * ── SCHEDULING IS THE FIRST STEP AND IT ASKS FOR FOUR THINGS ───────────────────────
 * A title, a date, who is coming, and who is writing it down. All four are required, and the
 * last two are what the whole feature is built on: the attendee list decides who may VOTE, and
 * the secretary is the only person who may write the minutes. Neither is a thing that can be
 * filled in later without the meeting being useless in the meantime.
 *
 * ── THE SECRETARY IS PICKED FIRST, AND IS ADDED TO THE ROOM AUTOMATICALLY ──────────
 * Somebody writing the minutes was there. The form says so under the attendee control rather
 * than silently ticking a box, and `scheduleMeeting` folds them in server-side as well — so the
 * rule holds for a caller who posts to that endpoint directly, which is the half a form cannot
 * enforce (AGENTS.md §2).
 *
 * ── UPCOMING AND PAST ARE SPLIT ────────────────────────────────────────────────────
 * Against `todayLocal()`, which is a `YYYY-MM-DD` string compared as a string — never a
 * `Date`. `new Date('2026-08-01')` is UTC midnight and reads as 31 July in any negative
 * offset, which is how a meeting comes to move a day for half the family
 * (`lib/calendar.ts`'s rule).
 */
export function MeetingsClient({ initialMeetings, members, maySchedule }: {
  initialMeetings: MeetingSession[]
  members: Person[]
  maySchedule: boolean
}) {
  const router = useRouter()
  const [meetings] = useServerState(initialMeetings)
  const [scheduling, setScheduling] = useState(false)

  const today = todayLocal()
  const upcoming = meetings.filter(m => m.meetsOn >= today)
    .sort((a, b) => a.meetsOn.localeCompare(b.meetsOn))
  const past = meetings.filter(m => m.meetsOn < today)

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="mb-1 text-3xl font-bold">Meeting Minutes</h1>
          <p className="text-muted-foreground">
            What the family met about, who was there, and what was decided. The secretary writes
            it down; the room votes.
          </p>
        </div>
        {maySchedule && (
          <Button onClick={() => setScheduling(true)}><Plus /> Schedule a meeting</Button>
        )}
      </div>

      {meetings.length === 0 ? (
        <div className="rounded-xl border bg-card px-4 py-14 text-center">
          <Gavel className="mx-auto mb-3 h-10 w-10 text-muted-foreground/30" />
          <p className="text-sm text-muted-foreground">No meetings yet.</p>
          <p className="mx-auto mt-2 max-w-md text-xs text-muted-foreground">
            Schedule one and everybody on the attendee list is told and gets it on their
            calendar. During the meeting the secretary adds a topic and writes notes under it,
            and can call a vote the room answers.
          </p>
        </div>
      ) : (
        <>
          {upcoming.length > 0 && (
            <MeetingGroup heading="Coming up" meetings={upcoming} />
          )}
          {past.length > 0 && (
            <MeetingGroup heading="Held" meetings={past} />
          )}
        </>
      )}

      {scheduling && (
        <ScheduleDialog
          members={members}
          onClose={() => setScheduling(false)}
          onScheduled={id => { setScheduling(false); router.push(`/journals/meeting-minutes/${id}`) }}
        />
      )}
    </div>
  )
}

function MeetingGroup({ heading, meetings }: { heading: string; meetings: MeetingSession[] }) {
  return (
    <section className="space-y-2">
      <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
        {heading}
      </h2>
      <ul className="divide-y rounded-xl border">
        {meetings.map(m => (
          <li key={m.id}>
            <Link href={`/journals/meeting-minutes/${m.id}`}
              className="flex flex-wrap items-center gap-x-4 gap-y-1 px-4 py-3 text-foreground transition-colors hover:bg-brand-soft/40">
              <span className="min-w-0 flex-1">
                <span className="block truncate font-medium">{m.title}</span>
                <span className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-muted-foreground">
                  <span className="inline-flex items-center gap-1">
                    <CalendarCheck className="h-3 w-3" /> {formatDate(m.meetsOn)}
                  </span>
                  <span className="inline-flex items-center gap-1">
                    <Users className="h-3 w-3" /> {m.attendees.length} attending
                  </span>
                  {m.secretaryName && <span>Minutes by {m.secretaryName}</span>}
                  <span>{m.topicCount} topic{m.topicCount === 1 ? '' : 's'}</span>
                </span>
              </span>
              {/* CLOSED IS THE STATE WORTH A PILL, and open is not: a meeting that has not been
                  closed yet is the ordinary case, and a pill on every row says nothing. */}
              {m.closedAt && (
                <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-brand-soft px-2 py-0.5 text-[11px] font-medium text-brand-on-soft">
                  <CheckCircle className="h-3 w-3" /> Minuted
                </span>
              )}
            </Link>
          </li>
        ))}
      </ul>
    </section>
  )
}

function ScheduleDialog({ members, onClose, onScheduled }: {
  members: Person[]
  onClose: () => void
  onScheduled: (id: string) => void
}) {
  const [title, setTitle] = useState('')
  const [meetsOn, setMeetsOn] = useState('')
  const [secretaryId, setSecretaryId] = useState('')
  const [attendeeIds, setAttendeeIds] = useState<string[]>([])
  const [error, setError] = useState('')
  const [isPending, startTransition] = useTransition()

  function submit() {
    if (!title.trim()) { setError('Give the meeting a title'); return }
    if (!meetsOn) { setError('Choose a date'); return }
    if (!secretaryId) { setError('Choose who is taking the minutes'); return }
    setError('')
    startTransition(async () => {
      const result = await scheduleMeeting({
        title: title.trim(), meetsOn, secretaryId, attendeeIds,
      })
      if (!result.success || !result.id) {
        setError(result.message ?? 'Could not schedule that meeting.')
        return
      }
      onScheduled(result.id)
    })
  }

  const secretary = members.find(m => m.id === secretaryId)

  return (
    <Dialog open onClose={isPending ? () => {} : onClose} title="Schedule a meeting"
      description="Everybody on the list is told and gets it on their calendar."
      className="max-w-lg">
      <div className="space-y-4">
        <div className="space-y-1.5">
          <Label htmlFor="meeting-title">Title</Label>
          <Input id="meeting-title" value={title} onChange={e => setTitle(e.target.value)}
            placeholder="Quarterly officers&rsquo; meeting" autoFocus />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="meeting-date">Date</Label>
          {/* A BARE DATE. There is no time of day and no timezone anywhere in this product —
              `meets_on` is a DATE column, exactly as a gathering's and an election's dates are,
              and a TIME here would be a time in no particular zone. */}
          <Input id="meeting-date" type="date" value={meetsOn}
            onChange={e => setMeetsOn(e.target.value)} className="max-w-[12rem]" />
        </div>

        {/* THE SECRETARY IS A `PersonPicker` AND THE ROOM IS A `PersonMultiSelect`, which are
            the two standard controls for exactly this pair — both search accents and
            punctuation, both disambiguate two Martha Allens against the WHOLE roster, and both
            are built for a family of a hundred and forty (AGENTS.md, "Build every member list
            for a hundred-member family"). */}
        <PersonPicker
          people={members}
          value={secretaryId}
          onChange={setSecretaryId}
          label="Who is taking the minutes?"
          hint="Only they can write in this meeting, and only until it is closed."
        />

        <PersonMultiSelect
          people={members}
          selected={attendeeIds}
          onChange={setAttendeeIds}
          label="Who is coming?"
          hint="Everybody here is told, gets it on their calendar, and may vote on its topics."
        />

        {secretary && !attendeeIds.includes(secretaryId) && (
          <p className="text-xs text-muted-foreground">
            {secretary.first_name} is added to the room automatically — somebody writing the
            minutes was there.
          </p>
        )}

        <FormError message={error} />

        <div className="flex gap-2">
          <Button size="sm" variant="affirm" onClick={submit} disabled={isPending}>
            {isPending ? 'Scheduling…' : 'Schedule meeting'}
          </Button>
          <Button size="sm" variant="ghost" onClick={onClose} disabled={isPending}>Cancel</Button>
        </div>
      </div>
    </Dialog>
  )
}
