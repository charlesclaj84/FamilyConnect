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
import { cn } from '@/lib/utils'
import { useServerState } from '@/lib/use-server-state'
import { formatDate, todayLocal } from '@/lib/date-utils'
import { resolveMeetingRoom } from '@/lib/meeting-boards'
import {
  scheduleMeeting, type MeetingAttendeeOptions, type MeetingSession,
} from '@/app/actions/meetings'

/**
 * Meeting Minutes: every meeting the family has held or scheduled.
 *
 * ── SCHEDULING ASKS FOR FOUR THINGS, OVER THREE STEPS SINCE 2026-08-22 ─────────────
 * A title, a date, who is coming, and who is writing it down. All four are required, and the
 * last two are what the whole feature is built on: the attendee list decides who may VOTE, and
 * the secretary is the only person who may write the minutes. Neither is a thing that can be
 * filled in later without the meeting being useless in the meantime.
 *
 * `ScheduleDialog` is a three-step wizard rather than one long form, and its header argues the
 * split. The four things did not change; where they are asked did.
 *
 * ── THE SECRETARY IS PICKED FIRST, AND IS ADDED TO THE ROOM AUTOMATICALLY ──────────
 * Somebody writing the minutes was there. `scheduleMeeting` folds them in server-side as well —
 * so the rule holds for a caller who posts to that endpoint directly, which is the half a form
 * cannot enforce (AGENTS.md §2) — and the form says so on the step where the room is shown.
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
   * The bodies and adults the scheduling dialog is built from — boards, offices, chapters, the
   * whole family, and the caller's own person id for the secretary default. EMPTY for a caller
   * who cannot schedule: `getMeetingAttendeeOptions` gates itself on the same grant and returns
   * nothing (§5), because this is the family's roster plus who holds which office and it has no
   * business in the RSC payload of somebody who cannot open the dialog.
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
            Schedule one by saying what kind of meeting it is — the whole family, a chapter, a
            board, one office across every area, or just the people you name — and everybody in
            the room is told and gets it on their calendar. During the meeting the secretary
            adds a topic and writes notes under it, and can call a vote the room answers.
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
 * THE FIVE KINDS OF ROOM STEP 2 OFFERS, in the order it offers them.
 *
 * ── WIDEST-CONFIGURED FIRST, AND THE FIFTH IS THE ESCAPE HATCH ─────────────────────
 * The first four are the ask, and each one is a body the family has already told the product
 * about. The fifth is not a body at all and exists so the step can be REQUIRED: before this
 * wizard, a meeting could be a handful of people named by hand, and making an audience
 * mandatory without it would have deleted that — a three-person ad-hoc committee is a real
 * meeting and there is no board for it.
 *
 * `hint` is what the choice actually resolves to, in people rather than in vocabulary, because
 * "a positions meeting" means nothing to somebody who has not read the Organization screen.
 */
const AUDIENCES = [
  {
    id: 'general',
    label: 'A general family meeting',
    hint: 'Every adult in the family.',
  },
  {
    id: 'chapter',
    label: 'A chapter meeting',
    hint: 'Everybody in a chapter, officer or not.',
  },
  {
    id: 'board',
    label: 'A board meeting',
    hint: 'Everybody holding an office on one board — national, a region, or a chapter.',
  },
  {
    id: 'positions',
    label: 'A positions meeting',
    hint: 'One office across every area that fills it — every chapter president, say.',
  },
  {
    id: 'named',
    label: 'Just the people I name',
    hint: 'Nobody to start with. You add them on the next step.',
  },
] as const

type Audience = (typeof AUDIENCES)[number]['id']

/** Which of the three steps the dialog is on, and what each is called. */
const STEPS = ['The basics', 'Who is coming', 'Anybody else'] as const

/**
 * Scheduling a meeting: three steps, with Next and Back.
 *
 * ── WHY IT IS STEPPED AT ALL ───────────────────────────────────────────────────────
 * It was one screen and it asked for six things at once — a title, a date, a secretary, two
 * checkbox lists over the family's boards and offices, and a searchable multi-select over a
 * hundred and forty adults, with a room summary under the lot. On a phone that is a form you
 * scroll four times before you know what it wants, and the two controls doing the most work
 * (the pickers) are the two furthest down. Reported as: scheduling a meeting is a REALLY long
 * form.
 *
 * The split is not arbitrary — it is the three questions the meeting itself has:
 *
 *   1. WHAT and WHEN, and who writes it down. All three are required and none depends on the
 *      others, so this step can be filled without a single decision about people.
 *   2. WHO IS COMING, as a KIND first and then as a choice within that kind. This is the step
 *      that used to be four controls stacked; asking "what kind of meeting is this?" first
 *      means at most one of them is ever on screen.
 *   3. ANYBODY ELSE, by name, on top of the body — with the room's own count beside it, which
 *      is where somebody actually wants to see it.
 *
 * ── WHO IS COMING IS A BODY, NOT A LIST OF NAMES ───────────────────────────────────
 * The client sends the IDS OF BODIES; `scheduleMeeting` resolves who is in them, against
 * whoever holds the office (or lives in the chapter) at the moment it is scheduled. It never
 * sends the resolved names — that would be the client deciding who is on the board, and a
 * server action is a public HTTP endpoint. "The whole family" is a BOOLEAN for the same
 * reason: there is no list for a client to substitute.
 *
 * ── THE SELECTION IS DERIVED FROM THE AUDIENCE, WHICH IS THE ONE SUBTLE PART ────────
 * `selection` reads the tick lists through `audience`, so a member who picks two boards, goes
 * Back, and switches to a general family meeting does not silently carry those boards into the
 * room. Clearing the lists on change would work too and is worse: pressing Back to check
 * something and returning would have thrown the ticks away.
 *
 * ── ONE ROOM, AND THE COUNT IS RENDERED FROM ALL OF IT ─────────────────────────────
 * Every source UNIONS. A person on the national board and named individually is one attendee,
 * and `resolveMeetingRoom` and the action both de-duplicate — but the reader needs to see that
 * before they submit, or a room of nine looks like a room of eleven.
 *
 * That is a SECOND resolution of the same rule, which is normally the thing to avoid. It is
 * admissible because both resolutions call the same pure function on the same data
 * (`resolveMeetingRoom` in `lib/meeting-boards.ts`), and because this one is a preview rather
 * than an authority: the action re-resolves server-side and its answer is what is written.
 *
 * ── ADULTS ONLY, AND WHERE THAT IS AND IS NOT TRUE ─────────────────────────────────
 * The secretary picker, the by-name picker, the chapter bodies and the whole-family body are
 * all built from the adults the SERVER filtered. That is §5 — a minor is not in the payload
 * rather than hidden from a control — and the action re-checks the two a person chooses freely.
 *
 * BOARDS AND POSITIONS ARE NOT FILTERED, and the copy does not claim they are. See
 * `scheduleMeeting`'s header: silently dropping an officer from the room over a recorded
 * birthday would be the product overruling an appointment the family made.
 */
function ScheduleDialog({ options, onClose, onScheduled }: {
  options: MeetingAttendeeOptions
  onClose: () => void
  onScheduled: (id: string) => void
}) {
  const [step, setStep] = useState(0)
  const [title, setTitle] = useState('')
  const [meetsOn, setMeetsOn] = useState('')
  // ── THE CALLER IS THE SECRETARY UNTIL THEY SAY OTHERWISE ─────────────────────────
  // Whoever schedules a meeting is usually the one who will write it down, and making them
  // find their own name in a picker of a hundred and forty is the friction that gets a
  // required field stared at. It is a plain initial value, not a `useServerState`: the moment
  // the dialog is open this is the member's field and a re-render must not reclaim it.
  const [secretaryId, setSecretaryId] = useState(options.myPersonId ?? '')
  const [audience, setAudience] = useState<Audience | ''>('')
  const [boardIds, setBoardIds] = useState<string[]>([])
  const [positionIds, setPositionIds] = useState<string[]>([])
  const [chapterIds, setChapterIds] = useState<string[]>([])
  const [additionalIds, setAdditionalIds] = useState<string[]>([])
  const [error, setError] = useState('')
  const [isPending, startTransition] = useTransition()

  // READ THROUGH `audience`, so a body from an abandoned choice cannot reach the room. See
  // the header — this is the reason the tick lists are not cleared when the kind changes.
  const selection = useMemo(() => ({
    boardIds:    audience === 'board' ? boardIds : [],
    positionIds: audience === 'positions' ? positionIds : [],
    chapterIds:  audience === 'chapter' ? chapterIds : [],
    wholeFamily: audience === 'general',
  }), [audience, boardIds, positionIds, chapterIds])

  // The same union the action will compute, from the same function — see the header.
  const room = useMemo(() => {
    const all = new Set(resolveMeetingRoom(selection, options))
    for (const id of additionalIds) all.add(id)
    if (secretaryId) all.add(secretaryId)
    return [...all]
      .map(id => ({ id, name: options.names[id] ?? 'Somebody' }))
      .sort((a, b) => a.name.localeCompare(b.name))
  }, [selection, additionalIds, secretaryId, options])

  function toggle(list: string[], set: (next: string[]) => void, id: string) {
    set(list.includes(id) ? list.filter(x => x !== id) : [...list, id])
  }

  /**
   * What is still missing on a step, or '' when it is complete.
   *
   * ONE FUNCTION PER STEP RATHER THAN ONE AT THE END, because the point of stepping is that a
   * mistake is reported beside the control that caused it. Step 1's three checks are the same
   * three `submit` used to run at the very end, where a missing title was reported under a
   * picker four scrolls below it.
   */
  function stepError(which: number): string {
    if (which === 0) {
      if (!title.trim()) return 'Give the meeting a title'
      if (!meetsOn) return 'Choose a date'
      if (!secretaryId) return 'Choose who is taking the minutes'
      return ''
    }
    if (which === 1) {
      if (!audience) return 'Choose what kind of meeting this is'
      if (audience === 'board' && boardIds.length === 0) return 'Choose at least one board'
      if (audience === 'positions' && positionIds.length === 0) return 'Choose at least one position'
      if (audience === 'chapter' && chapterIds.length === 0) return 'Choose at least one chapter'
      return ''
    }
    return ''
  }

  function next() {
    const problem = stepError(step)
    if (problem) { setError(problem); return }
    setError('')
    setStep(step + 1)
  }

  function back() {
    setError('')
    setStep(Math.max(0, step - 1))
  }

  function submit() {
    // BOTH EARLIER STEPS RE-CHECKED, not just this one. Nothing stops somebody clearing the
    // title after passing step 1, and the action would refuse it with a message they would
    // read three steps away from the field.
    const problem = stepError(0) || stepError(1)
    if (problem) {
      setError(problem)
      setStep(stepError(0) ? 0 : 1)
      return
    }
    setError('')
    startTransition(async () => {
      const result = await scheduleMeeting({
        title: title.trim(),
        meetsOn,
        secretaryId,
        ...selection,
        additionalIds,
      })
      if (!result.success || !result.id) {
        setError(result.message ?? 'Could not schedule that meeting.')
        return
      }
      onScheduled(result.id)
    })
  }

  /**
   * Why a kind of meeting cannot be chosen, or null when it can.
   *
   * SAID RATHER THAN HIDDEN. A family that has not set up its offices has no boards to
   * invite, and dropping the choice off the list would leave them wondering whether the
   * product can do it at all — where a disabled row with a sentence tells them what to go and
   * do. It is the same judgement `CheckGroup`'s empty state used to make one level down.
   */
  function unavailable(id: Audience): string | null {
    if (id === 'board' && options.boards.length === 0) {
      return 'Nobody holds a board position yet — set the offices up on Members → Organization.'
    }
    if (id === 'positions' && options.positions.length === 0) {
      return 'No office is filled yet — set them up on Members → Organization.'
    }
    if (id === 'chapter' && options.chapters.length === 0) {
      return 'No chapter has anybody recorded in it yet.'
    }
    if ((id === 'general' || id === 'named') && options.adults.length === 0) {
      return 'This family has no adult members recorded yet.'
    }
    return null
  }

  return (
    <Dialog open onClose={isPending ? () => {} : onClose} title="Schedule a meeting"
      description="Everybody in the room is told and gets it on their calendar."
      className="max-w-lg">
      <div className="space-y-5">
        {/* ── WHERE YOU ARE ────────────────────────────────────────────────────────
            A SENTENCE, and a bar that is `aria-hidden` behind it. "Step 2 of 3 · Who is
            coming" is the whole of what a screen reader needs; three coloured segments say
            the same thing to a sighted reader faster and say nothing at all without it, so
            duplicating them into the accessibility tree would only be noise. */}
        <div className="space-y-1.5">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Step {step + 1} of {STEPS.length} · {STEPS[step]}
          </p>
          <div aria-hidden="true" className="flex gap-1">
            {STEPS.map((name, i) => (
              <span
                key={name}
                className={cn(
                  'h-1 flex-1 rounded-full',
                  i <= step ? 'bg-brand-primary' : 'bg-muted',
                )}
              />
            ))}
          </div>
        </div>

        {step === 0 && (
          <div className="space-y-5">
            <div className="space-y-1.5">
              <Label htmlFor="meeting-title">Title</Label>
              <Input id="meeting-title" value={title} onChange={e => setTitle(e.target.value)}
                placeholder="Quarterly officers&rsquo; meeting" autoFocus />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="meeting-date">Date</Label>
              {/* A BARE DATE. There is no time of day and no timezone anywhere in this
                  product — `meets_on` is a DATE column, exactly as a gathering's and an
                  election's dates are, and a TIME here would be a time in no particular
                  zone. */}
              <Input id="meeting-date" type="date" value={meetsOn}
                onChange={e => setMeetsOn(e.target.value)} className="max-w-[12rem]" />
            </div>

            {/* THE SECRETARY IS A `PersonPicker` over the ADULTS, pre-set to the caller. It
                is the standard single-select control — searches accents and punctuation,
                disambiguates two Martha Allens against the whole set, built for a family of a
                hundred and forty. The list is adults only because the server filtered it, not
                because this control did. */}
            <PersonPicker
              people={options.adults}
              value={secretaryId}
              onChange={setSecretaryId}
              label="Who is taking the minutes?"
              hint="An adult, and you by default. Only they can write in this meeting, and only until it is closed."
              emptyMessage="This family has no adult members recorded yet."
            />
          </div>
        )}

        {step === 1 && (
          <div className="space-y-4">
            <fieldset className="space-y-2">
              <legend className="text-sm font-medium">What kind of meeting is this?</legend>
              {/* REAL RADIOS IN A FIELDSET. One choice out of five that submits with the
                  rest of the form, which is what a radio group is — and arrow-key movement
                  between the options comes free. Buttons with `aria-checked` would owe that
                  behaviour and not have it, the trap `MainRail` avoids by refusing
                  `role="tablist"`. */}
              <ul className="space-y-1.5">
                {AUDIENCES.map(choice => {
                  const why = unavailable(choice.id)
                  return (
                    <li key={choice.id}>
                      <label className={cn(
                        'flex gap-2.5 rounded-lg border px-3 py-2',
                        why
                          ? 'cursor-not-allowed opacity-70'
                          : 'cursor-pointer hover:bg-brand-soft/40',
                        audience === choice.id && !why && 'border-brand-primary bg-brand-soft/40',
                      )}>
                        <input
                          type="radio"
                          name="meeting-audience"
                          className="mt-0.5 h-4 w-4 shrink-0 accent-[var(--brand-primary)]"
                          checked={audience === choice.id}
                          disabled={Boolean(why) || isPending}
                          onChange={() => { setAudience(choice.id); setError('') }}
                        />
                        <span className="min-w-0">
                          <span className="block text-sm font-medium">{choice.label}</span>
                          <span className="block text-xs text-muted-foreground">
                            {why ?? choice.hint}
                          </span>
                        </span>
                      </label>
                    </li>
                  )
                })}
              </ul>
            </fieldset>

            {/* ── AND THEN, AND ONLY THEN, WHAT THERE IS TO PICK ─────────────────────
                At most one of these is ever on screen. That is the whole gain of asking the
                kind first: the four lists that used to be stacked are now one list whose
                heading the member chose. */}
            {audience === 'board' && (
              <CheckGroup
                legend="Which board?"
                hint="Everybody holding an office there, as it stands today."
                items={options.boards}
                selected={boardIds}
                onToggle={id => toggle(boardIds, setBoardIds, id)}
                disabled={isPending}
              />
            )}
            {audience === 'positions' && (
              <CheckGroup
                legend="Which office?"
                hint="Taken across every region or chapter that fills it."
                items={options.positions}
                selected={positionIds}
                onToggle={id => toggle(positionIds, setPositionIds, id)}
                disabled={isPending}
              />
            )}
            {audience === 'chapter' && (
              <CheckGroup
                legend="Which chapter?"
                hint="Every adult recorded in it. This is the whole chapter, not its board."
                items={options.chapters}
                selected={chapterIds}
                onToggle={id => toggle(chapterIds, setChapterIds, id)}
                disabled={isPending}
              />
            )}
            {audience === 'general' && (
              // A COUNT, because there is nothing to choose and "every adult in the family"
              // is a promise somebody should see the size of before they make it.
              <p className="rounded-lg border bg-muted/30 px-3 py-2 text-xs text-muted-foreground">
                {options.everyoneIds.length === 1
                  ? 'That is 1 adult.'
                  : `That is all ${options.everyoneIds.length} adults in the family.`}{' '}
                Nobody under eighteen is invited to a meeting.
              </p>
            )}
            {audience === 'named' && (
              <p className="rounded-lg border bg-muted/30 px-3 py-2 text-xs text-muted-foreground">
                Nobody is in the room yet. Add them by name on the next step.
              </p>
            )}
          </div>
        )}

        {step === 2 && (
          <div className="space-y-4">
            <PersonMultiSelect
              people={options.adults}
              selected={additionalIds}
              onChange={setAdditionalIds}
              label="Anybody else (optional)"
              hint="Adults only. Everybody in the room is told, gets it on their calendar, and may vote on its topics."
              emptyMessage="This family has no adult members recorded yet."
              disabled={isPending}
            />

            {/* ── WHAT THAT ADDS UP TO ────────────────────────────────────────────────
                ON THE LAST STEP, not on all three. The whole point of picking a body is not
                having to read eleven names, so this is a count with the names behind a
                disclosure — and it is the only thing on the screen that shows the
                de-duplication happening: somebody on the national board who is also named
                individually appears once. */}
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
          </div>
        )}

        {/* WITH THE BUTTONS, not with the field. The dialog's body scrolls and its footer
            does not, so a message rendered beside the control it is about can be off-screen
            at the moment somebody presses the button again. */}
        <FormError message={error} />

        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            {step > 0 && (
              <Button size="sm" variant="ghost" onClick={back} disabled={isPending}>Back</Button>
            )}
          </div>
          <div className="flex gap-2">
            {step < STEPS.length - 1 ? (
              <Button size="sm" onClick={next} disabled={isPending}>Next</Button>
            ) : (
              <Button size="sm" variant="affirm" onClick={submit} disabled={isPending}>
                {isPending ? 'Scheduling…' : 'Schedule meeting'}
              </Button>
            )}
            <Button size="sm" variant="ghost" onClick={onClose} disabled={isPending}>Cancel</Button>
          </div>
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
 *
 * IT NO LONGER HAS AN EMPTY STATE, and that is because the step in front of it does. A kind of
 * meeting with nothing to pick cannot be selected at all — the radio is disabled and says why —
 * so this list is only ever rendered with something in it.
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
