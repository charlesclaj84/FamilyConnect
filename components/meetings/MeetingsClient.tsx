'use client'

import { useMemo, useState, useTransition } from 'react'
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
import { resolveBoardAttendees } from '@/lib/meeting-boards'
import {
  scheduleMeeting, type MeetingAttendeeOptions, type MeetingSession,
} from '@/app/actions/meetings'

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
export function MeetingsClient({ initialMeetings, attendeeOptions, maySchedule }: {
  initialMeetings: MeetingSession[]
  /**
   * The boards, offices and adults the scheduling dialog is built from. EMPTY for a caller who
   * cannot schedule — the page does not fetch it and the action would refuse it anyway (§5):
   * this is the family's roster plus who holds which office, and it has no business in the RSC
   * payload of somebody who cannot open the dialog.
   */
  attendeeOptions: MeetingAttendeeOptions
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
            Schedule one by picking who is coming — a whole board, a whole office, or people
            by name — and everybody in the room is told and gets it on their calendar. During
            the meeting the secretary adds a topic and writes notes under it, and can call a
            vote the room answers.
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
          options={attendeeOptions}
          onClose={() => setScheduling(false)}
          onScheduled={id => { setScheduling(false); router.push(`/library/meeting-minutes/${id}`) }}
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
            <Link href={`/library/meeting-minutes/${m.id}`}
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

/**
 * Scheduling a meeting: what it is, when it is, who is writing it down, and who is in the room.
 *
 * ── WHO IS COMING IS A BODY, NOT A LIST OF NAMES ───────────────────────────────────
 * Rebuilt 2026-08-22. It was one `PersonMultiSelect` over the whole family, which is the right
 * control for "pick some relatives" and the wrong one for what a family meeting actually is:
 * the national board, one chapter's board, every chapter president. Ticking eleven names to
 * describe the national board is tedious once and wrong next month, when somebody has been
 * replaced and the list still names their predecessor.
 *
 * So the dialog offers BOARDS and POSITIONS first, and individual people second. The client
 * sends the ids of the bodies; `scheduleMeeting` resolves who is in them, against whoever
 * holds the office at the moment it is scheduled. It never sends the resolved names — that
 * would be the client deciding who is on the board.
 *
 * ── ONE ROOM, THREE SOURCES, AND THE COUNT IS RENDERED FROM ALL THREE ──────────────
 * The three inputs UNION. A person on the national board and named individually is one
 * attendee, and `resolveBoardAttendees` and the action both de-duplicate — but the reader
 * needs to see that before they submit, or a room of nine looks like a room of eleven. The
 * summary below the controls resolves the same union in the browser and lists the names.
 *
 * That is a SECOND resolution of the same rule, which is normally the thing to avoid. It is
 * admissible here because both resolutions call the same pure function on the same data
 * (`resolveBoardAttendees` in `lib/meeting-boards.ts`), and because this one is a preview
 * rather than an authority: the action re-resolves server-side and its answer is the one that
 * is written.
 *
 * ── ADULTS ONLY, IN TWO PLACES, AND FOR TWO DIFFERENT REASONS ──────────────────────
 * The secretary picker and the additional-attendee picker both list `options.adults`, which
 * the server filtered. That is §5 — a minor is not in the payload rather than hidden from a
 * control. The action refuses one anyway, because a server action is a public HTTP endpoint.
 *
 * BOARDS ARE NOT FILTERED, and the copy does not claim they are. See `scheduleMeeting`'s
 * header: silently dropping an officer from the room over a recorded birthday would be the
 * product overruling an appointment the family made.
 */
function ScheduleDialog({ options, onClose, onScheduled }: {
  options: MeetingAttendeeOptions
  onClose: () => void
  onScheduled: (id: string) => void
}) {
  const [title, setTitle] = useState('')
  const [meetsOn, setMeetsOn] = useState('')
  const [secretaryId, setSecretaryId] = useState('')
  const [boardIds, setBoardIds] = useState<string[]>([])
  const [positionIds, setPositionIds] = useState<string[]>([])
  const [additionalIds, setAdditionalIds] = useState<string[]>([])
  const [error, setError] = useState('')
  const [isPending, startTransition] = useTransition()

  // The same union the action will compute, from the same function — see the header.
  const room = useMemo(() => {
    const fromBodies = resolveBoardAttendees({
      boardIds, positionIds, boards: options.boards, positions: options.positions,
    })
    const all = new Set([...fromBodies, ...additionalIds])
    if (secretaryId) all.add(secretaryId)
    return [...all]
      .map(id => ({ id, name: options.names[id] ?? 'Somebody' }))
      .sort((a, b) => a.name.localeCompare(b.name))
  }, [boardIds, positionIds, additionalIds, secretaryId, options])

  function toggle(list: string[], set: (next: string[]) => void, id: string) {
    set(list.includes(id) ? list.filter(x => x !== id) : [...list, id])
  }

  function submit() {
    if (!title.trim()) { setError('Give the meeting a title'); return }
    if (!meetsOn) { setError('Choose a date'); return }
    if (!secretaryId) { setError('Choose who is taking the minutes'); return }
    setError('')
    startTransition(async () => {
      const result = await scheduleMeeting({
        title: title.trim(), meetsOn, secretaryId, boardIds, positionIds, additionalIds,
      })
      if (!result.success || !result.id) {
        setError(result.message ?? 'Could not schedule that meeting.')
        return
      }
      onScheduled(result.id)
    })
  }

  const hasBodies = options.boards.length > 0 || options.positions.length > 0

  return (
    <Dialog open onClose={isPending ? () => {} : onClose} title="Schedule a meeting"
      description="Everybody in the room is told and gets it on their calendar."
      className="max-w-lg">
      <div className="space-y-5">
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

        {/* THE SECRETARY IS A `PersonPicker` over the ADULTS. It is the standard single-select
            control — searches accents and punctuation, disambiguates two Martha Allens against
            the whole set, built for a family of a hundred and forty. The list is adults only
            because the server filtered it, not because this control did. */}
        <PersonPicker
          people={options.adults}
          value={secretaryId}
          onChange={setSecretaryId}
          label="Who is taking the minutes?"
          hint="An adult. Only they can write in this meeting, and only until it is closed."
          emptyMessage="This family has no adult members recorded yet."
        />

        <fieldset className="space-y-3">
          <legend className="text-sm font-medium">Who is coming?</legend>

          {hasBodies ? (
            <>
              {options.boards.length > 0 && (
                <CheckGroup
                  legend="Boards"
                  hint="Everybody holding an office there, as it stands today."
                  items={options.boards}
                  selected={boardIds}
                  onToggle={id => toggle(boardIds, setBoardIds, id)}
                  disabled={isPending}
                />
              )}
              {options.positions.length > 0 && (
                <CheckGroup
                  legend="Positions"
                  hint="One office across every region or chapter that fills it — every chapter president, say."
                  items={options.positions}
                  selected={positionIds}
                  onToggle={id => toggle(positionIds, setPositionIds, id)}
                  disabled={isPending}
                />
              )}
            </>
          ) : (
            // NOT AN EMPTY CHECKBOX LIST. A family that has not set up its board positions
            // has no boards to offer, and a heading over nothing reads as a control that is
            // broken rather than one there is nothing to put in.
            <p className="rounded-lg border border-dashed px-3 py-2 text-xs text-muted-foreground">
              Nobody in this family holds a board position yet, so there is no board to invite.
              Add the people coming by name below, or set the offices up on{' '}
              <strong>Members &rarr; Organization</strong>.
            </p>
          )}

          <PersonMultiSelect
            people={options.adults}
            selected={additionalIds}
            onChange={setAdditionalIds}
            label="Anybody else (optional)"
            hint="Adults only. Everybody in the room is told, gets it on their calendar, and may vote on its topics."
            emptyMessage="This family has no adult members recorded yet."
            disabled={isPending}
          />
        </fieldset>

        {/* ── WHAT THAT ADDS UP TO ────────────────────────────────────────────────────
            The whole point of picking a body is not having to read eleven names, so this is
            a count with the names behind a disclosure rather than a list. It is also the only
            thing on the screen that shows the de-duplication happening: somebody on the
            national board who is also named individually appears once. */}
        <div className="rounded-lg border bg-muted/30 px-3 py-2">
          {room.length === 0 ? (
            <p className="text-xs text-muted-foreground">Nobody in the room yet.</p>
          ) : (
            <details>
              <summary className="cursor-pointer text-xs text-muted-foreground">
                {room.length} {room.length === 1 ? 'person' : 'people'} in the room — see who
              </summary>
              <ul className="mt-2 flex flex-wrap gap-1.5">
                {room.map(person => (
                  <li key={person.id}
                    className="rounded-full bg-brand-soft px-2 py-0.5 text-xs text-brand-on-soft">
                    {person.name}
                    {person.id === secretaryId && <span className="opacity-70"> · minutes</span>}
                  </li>
                ))}
              </ul>
            </details>
          )}
        </div>

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

/**
 * A group of real checkboxes with a count on each.
 *
 * REAL `<input type="checkbox">` INSIDE A `<fieldset>`, not buttons with `aria-pressed`. These
 * are several independent choices that submit together, which is exactly what a checkbox group
 * is, and it gets keyboard behaviour and grouped announcement for free. The same reasoning
 * `MainRail` uses in reverse when it declines `role="tablist"`: claim the role the markup
 * actually is.
 *
 * THE COUNT IS NOT DECORATION. A board with one person on it and a board with eleven are very
 * different things to tick, and the label alone does not say which this is.
 */
function CheckGroup({ legend, hint, items, selected, onToggle, disabled }: {
  legend: string
  hint: string
  items: readonly { id: string; label: string; personIds: string[] }[]
  selected: string[]
  onToggle: (id: string) => void
  disabled: boolean
}) {
  return (
    <fieldset className="space-y-1.5">
      <legend className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        {legend}
      </legend>
      <p className="text-xs text-muted-foreground">{hint}</p>
      <ul className="max-h-44 space-y-0.5 overflow-y-auto rounded-lg border p-1.5">
        {items.map(item => (
          <li key={item.id}>
            <label className="flex cursor-pointer items-center gap-2 rounded px-1.5 py-1 text-sm hover:bg-brand-soft/40">
              <input
                type="checkbox"
                checked={selected.includes(item.id)}
                onChange={() => onToggle(item.id)}
                disabled={disabled}
                className="h-4 w-4 shrink-0 accent-[var(--brand-primary)]"
              />
              <span className="min-w-0 flex-1 truncate">{item.label}</span>
              <span className="shrink-0 text-xs text-muted-foreground">
                {item.personIds.length}
              </span>
            </label>
          </li>
        ))}
      </ul>
    </fieldset>
  )
}
