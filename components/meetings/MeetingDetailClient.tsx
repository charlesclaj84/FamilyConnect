'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import {
  CalendarCheck, Check, ChevronDown, ChevronRight, Clock, Lock, LockOpen, Pencil, Plus, Trash2,
  Users, Vote,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { useConfirm } from '@/components/ui/confirm'
import { FormError } from '@/components/ui/form-message'
import { useServerState } from '@/lib/use-server-state'
import { formatDate } from '@/lib/date-utils'
import { StatedTime } from '@/components/ui/stated-time'
import {
  addMeetingNote, addMeetingTopic, castMeetingVote, deleteMeeting, deleteMeetingNote,
  deleteMeetingTopic, setMeetingClosed, setTopicVoting, updateMeetingNote, updateMeetingTopic,
  type MeetingDetail, type MeetingTopic,
} from '@/app/actions/meetings'
import { useT } from '@/components/layout/LocaleProvider'
import type { T } from '@/lib/i18n/t'

// A FUNCTION of `t`: the labels come from the reader's catalogue and cannot be resolved at
// module load. The VALUES are what `meeting_votes` stores and never move.
function choices(t: T) {
  return [
    { value: 'for', label: t('meet.vote.for') },
    { value: 'against', label: t('meet.vote.against') },
    { value: 'abstain', label: t('meet.vote.abstain') },
  ] as const
}

/**
 * One meeting: who was there, what was discussed, and what the room decided.
 *
 * ── EVERY CONTROL HANGS OFF A FACT ABOUT THE SESSION, NOT OFF A GRANT ──────────────
 * `iAmSecretary` and `iAmAttendee` come from the ROW, resolved on the server, and they are what
 * decide the writing and the voting respectively. `mayManage` and `mayDelete` are the two
 * permission-shaped answers and they govern only the session itself — changing its title, its
 * date, whether it is closed, and removing it.
 *
 * NONE OF THEM IS A GATE. Every action re-resolves the same facts from the database, because a
 * `'use server'` export has a URL whether or not a control exists (AGENTS.md §2). What these
 * buy is not showing somebody a button that will refuse them.
 *
 * ── A CLOSED MEETING IS READ-ONLY, AND THE SCREEN SAYS WHY ─────────────────────────
 * Once closed, nothing about the minutes changes — that is what makes them the thing a family
 * cites next year. The controls disappear rather than being disabled, because a row of greyed
 * buttons over a finished record invites somebody to hunt for the reason; the banner at the top
 * gives it in one line, with the way to undo it for whoever may.
 *
 * ── A VOTE IS CAST ONCE ────────────────────────────────────────────────────────────
 * There is no "change my vote" and there is no control that looks like one. Once this member
 * has voted, their choice is stated as a fact and the buttons are gone —
 * `meeting_votes_are_final` refuses an UPDATE in the database for every role, so a control
 * that offered it would be a control that cannot work.
 */
export function MeetingDetailClient({ meeting: initialMeeting, zone }: {
  meeting: MeetingDetail
  /** The READER's timezone, for the secondary "your time" line beside the stated one. */
  zone: string
}) {
  const t = useT()
  const router = useRouter()
  const confirm = useConfirm()
  const [meeting] = useServerState(initialMeeting)
  const [error, setError] = useState('')
  const [addingTopic, setAddingTopic] = useState(false)
  const [topicTitle, setTopicTitle] = useState('')
  const [isPending, startTransition] = useTransition()

  const open = meeting.closedAt === null
  const mayWrite = meeting.iAmSecretary && open

  function run(fn: () => Promise<{ success: boolean; message?: string }>) {
    setError('')
    startTransition(async () => {
      const result = await fn()
      if (!result.success) { setError(result.message ?? t('meet.wentWrong')); return }
      router.refresh()
    })
  }

  async function toggleClosed() {
    const closing = open
    const ok = await confirm({
      title: closing ? t('meet.closeConfirmTitle') : t('meet.reopenConfirmTitle'),
      description: closing
        ? t('meet.closeConfirmBody')
        : t('meet.reopenConfirmBody'),
      confirmLabel: closing ? t('meet.closeMinutes') : t('meet.reopen'),
    })
    if (!ok) return
    run(() => setMeetingClosed(meeting.id, closing))
  }

  async function removeMeeting() {
    const ok = await confirm({
      title: `Delete “${meeting.title}”?`,
      description: t('meet.deleteMeetingBody'),
      confirmLabel: t('meet.deleteMeeting'),
      destructive: true,
    })
    if (!ok) return
    setError('')
    startTransition(async () => {
      const result = await deleteMeeting(meeting.id)
      if (!result.success) { setError(result.message ?? t('meet.deleteFailed')); return }
      router.push('/library/meeting-minutes')
    })
  }

  return (
    <div className="space-y-6">
      <div>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <h1 className="text-2xl font-bold">{meeting.title}</h1>
            <p className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted-foreground">
              <span className="inline-flex items-center gap-1.5">
                <CalendarCheck className="h-3.5 w-3.5" /> {formatDate(meeting.meetsOn)}
              </span>
              {/* THE STATED TIME LEADS, the reader's own follows underneath and only when the
                  two differ. `StatedTime` owns that relationship so the gathering page and this
                  one cannot drift apart — see its header and 20260826000003's. */}
              {meeting.startTime && (
                <span className="inline-flex items-center gap-1.5">
                  <Clock className="h-3.5 w-3.5 shrink-0" />
                  <StatedTime
                    day={meeting.meetsOn}
                    time={meeting.startTime}
                    endTime={meeting.endTime}
                    zone={meeting.timeZone}
                    readerZone={zone}
                  />
                </span>
              )}
              {meeting.secretaryName && (
                <span>{t('meet.minutesBy')} <span className="font-medium text-foreground">{meeting.secretaryName}</span></span>
              )}
            </p>
          </div>
          <div className="flex gap-2">
            {(meeting.mayManage || meeting.iAmSecretary) && (
              <Button size="sm" variant="outline" onClick={toggleClosed} disabled={isPending}>
                {open ? <><Lock /> {t('meet.closeMinutes')}</> : <><LockOpen /> {t('meet.reopen')}</>}
              </Button>
            )}
            {meeting.mayDelete && (
              <Button size="sm" variant="ghost" onClick={removeMeeting} disabled={isPending}
                className="text-destructive hover:text-destructive">
                <Trash2 /> {t('action.delete')}
              </Button>
            )}
          </div>
        </div>
      </div>

      {!open && (
        <p className="rounded-lg border border-dashed bg-muted/30 px-3 py-2 text-sm text-muted-foreground">
          These minutes are closed. Nothing about the meeting changes now — which is what makes
          them the record.
        </p>
      )}

      <FormError message={error} />

      {/* ── WHO WAS THERE ─────────────────────────────────────────────────────────────
          Listed rather than counted, because the attendee list is not a statistic: it is who
          may vote, and it is what a reader checks when they want to know whether a decision
          had the room behind it. */}
      <section className="rounded-xl border bg-card p-4">
        <h2 className="mb-2 flex items-center gap-2 text-sm font-semibold">
          <Users className="h-4 w-4 text-brand-accent" />
          In the room ({meeting.attendees.length})
        </h2>
        {meeting.attendees.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t('meet.nobodyOnList')}</p>
        ) : (
          <p className="flex flex-wrap gap-1.5">
            {meeting.attendees.map(a => (
              <span key={a.personId}
                className="rounded-full bg-brand-soft px-2 py-0.5 text-xs text-brand-on-soft">
                {a.name}
                {a.personId === meeting.secretaryId && ' · secretary'}
              </span>
            ))}
          </p>
        )}
      </section>

      {/* ── THE MINUTES ───────────────────────────────────────────────────────────── */}
      <section className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-lg">{t('meet.topics')}</h2>
          {mayWrite && !addingTopic && (
            <Button size="sm" variant="affirm" onClick={() => setAddingTopic(true)}>
              <Plus /> {t('meet.addTopic')}
            </Button>
          )}
        </div>

        {mayWrite && addingTopic && (
          <div className="space-y-2 rounded-lg border bg-muted/30 p-3">
            <Label htmlFor="new-topic">{t('meet.whatTopic')}</Label>
            <Input id="new-topic" value={topicTitle} onChange={e => setTopicTitle(e.target.value)}
              placeholder={t('meet.topicPh')} autoFocus />
            <div className="flex gap-2">
              <Button size="sm" variant="affirm" disabled={isPending}
                onClick={() => {
                  if (!topicTitle.trim()) { setError(t('meet.needTopicTitle')); return }
                  setError('')
                  startTransition(async () => {
                    const result = await addMeetingTopic(meeting.id, topicTitle)
                    if (!result.success) { setError(result.message ?? t('meet.addFailed')); return }
                    setTopicTitle(''); setAddingTopic(false)
                    router.refresh()
                  })
                }}>
                {t('meet.addTopicAction')}
              </Button>
              <Button size="sm" variant="ghost" disabled={isPending}
                onClick={() => { setAddingTopic(false); setTopicTitle('') }}>
                {t('action.cancel')}
              </Button>
            </div>
          </div>
        )}

        {meeting.topics.length === 0 ? (
          <p className="rounded-xl border bg-card px-4 py-10 text-center text-sm text-muted-foreground">
            {mayWrite
              ? t('meet.nothingMinuted')
              : t('meet.nothingMinutedShort')}
          </p>
        ) : (
          <ul className="space-y-3">
            {meeting.topics.map(topic => (
              <TopicCard
                key={topic.id}
                topic={topic}
                meeting={meeting}
                mayWrite={mayWrite}
                busy={isPending}
                onRun={run}
                onError={setError}
              />
            ))}
          </ul>
        )}
      </section>
    </div>
  )
}

/**
 * One topic: its notes, and its ballot.
 *
 * ── COLLAPSED BY DEFAULT ONCE THE MEETING IS CLOSED ────────────────────────────────
 * A finished meeting is a table of contents somebody scans for the decision they remember;
 * expanding all twelve topics makes it a wall. While the meeting is OPEN they start expanded,
 * because the secretary is writing into them.
 */
function TopicCard({ topic, meeting, mayWrite, busy, onRun, onError }: {
  topic: MeetingTopic
  meeting: MeetingDetail
  mayWrite: boolean
  busy: boolean
  onRun: (fn: () => Promise<{ success: boolean; message?: string }>) => void
  onError: (message: string) => void
}) {
  const t = useT()
  const confirm = useConfirm()
  const [expanded, setExpanded] = useState(meeting.closedAt === null)
  const [noteBody, setNoteBody] = useState('')
  const [editingTitle, setEditingTitle] = useState(false)
  const [title, setTitle] = useState(topic.title)
  const [editingNote, setEditingNote] = useState<string | null>(null)
  const [noteDraft, setNoteDraft] = useState('')
  const [isPending, startTransition] = useTransition()

  const voteCalled = topic.votingOpenedAt !== null
  const voteOpen = voteCalled && topic.votingClosedAt === null
  const myVote = topic.votes.find(v => v.voterId === meeting.myPersonId)
  const tally = {
    for: topic.votes.filter(v => v.choice === 'for').length,
    against: topic.votes.filter(v => v.choice === 'against').length,
    abstain: topic.votes.filter(v => v.choice === 'abstain').length,
  }

  async function removeTopic() {
    const ok = await confirm({
      title: `Delete “${topic.title}”?`,
      description: topic.votes.length > 0
        // THE ONE WAY A VOTE EVER GOES, said in those words. `meeting_votes_are_final` refuses
        // every other route, so deleting the topic is deleting the QUESTION.
        ? topic.votes.length === 1
          ? t('meet.deleteTopicVotesOne')
          : t('meet.deleteTopicVotesMany', { n: topic.votes.length })
        : t('meet.deleteTopicBody'),
      confirmLabel: t('meet.deleteTopic'),
      destructive: true,
    })
    if (!ok) return
    onRun(() => deleteMeetingTopic(topic.id))
  }

  return (
    <li className="rounded-xl border bg-card">
      <div className="flex flex-wrap items-center gap-2 px-4 py-3">
        <button type="button" onClick={() => setExpanded(e => !e)}
          aria-expanded={expanded}
          className="flex min-w-0 flex-1 items-center gap-2 text-left">
          {expanded
            ? <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground" />
            : <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />}
          <span className="min-w-0 flex-1 truncate font-medium">{topic.title}</span>
          <span className="shrink-0 text-xs text-muted-foreground">
            {topic.notes.length} note{topic.notes.length === 1 ? '' : 's'}
            {voteCalled && ` · ${topic.votes.length} vote${topic.votes.length === 1 ? '' : 's'}`}
          </span>
        </button>

        {voteCalled && (
          <span className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] font-medium ${
            voteOpen ? 'bg-brand-legacy text-brand-on-legacy' : 'bg-brand-soft text-brand-on-soft'}`}>
            {voteOpen ? t('meet.voteOpen') : t('meet.voteClosed')}
          </span>
        )}

        {mayWrite && (
          <span className="flex shrink-0 gap-1">
            <button type="button" onClick={() => { setEditingTitle(true); setTitle(topic.title) }}
              aria-label={t('meet.renameTopic')} title={t('action.rename')}
              className="rounded-md p-1.5 text-muted-foreground hover:text-foreground">
              <Pencil className="h-3.5 w-3.5" />
            </button>
            <button type="button" onClick={removeTopic} disabled={busy || isPending}
              aria-label={t('meet.deleteTopicTitle')} title={t('meet.deleteTopic')}
              className="rounded-md p-1.5 text-destructive hover:bg-muted disabled:opacity-50">
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          </span>
        )}
      </div>

      {editingTitle && mayWrite && (
        <div className="flex flex-wrap items-center gap-2 border-t px-4 py-3">
          <Input value={title} onChange={e => setTitle(e.target.value)} className="max-w-sm"
            aria-label={t('meet.topicTitleLabel')} autoFocus />
          <Button size="sm" variant="affirm" disabled={isPending}
            onClick={() => {
              startTransition(async () => {
                const result = await updateMeetingTopic(topic.id, title)
                if (!result.success) { onError(result.message ?? t('meet.renameFailed')); return }
                setEditingTitle(false)
                onRun(async () => ({ success: true }))
              })
            }}>
            <Check /> {t('action.save')}
          </Button>
          <Button size="sm" variant="ghost" onClick={() => setEditingTitle(false)} disabled={isPending}>
            {t('action.cancel')}
          </Button>
        </div>
      )}

      {expanded && (
        <div className="space-y-4 border-t px-4 py-3">
          {/* ── THE NOTES ──────────────────────────────────────────────────────────── */}
          {topic.notes.length === 0 ? (
            <p className="text-sm text-muted-foreground">{t('notes.nothingUnder')}</p>
          ) : (
            <ul className="space-y-3">
              {topic.notes.map(note => (
                <li key={note.id} className="border-l-2 border-brand-soft pl-3">
                  {editingNote === note.id && mayWrite ? (
                    <div className="space-y-2">
                      <Textarea value={noteDraft} rows={4} aria-label={t('notes.note')}
                        onChange={e => setNoteDraft(e.target.value)} />
                      <div className="flex gap-2">
                        <Button size="sm" variant="affirm" disabled={isPending}
                          onClick={() => {
                            startTransition(async () => {
                              const result = await updateMeetingNote(note.id, noteDraft)
                              if (!result.success) { onError(result.message ?? t('meet.saveFailed')); return }
                              setEditingNote(null)
                              onRun(async () => ({ success: true }))
                            })
                          }}>{t('action.save')}</Button>
                        <Button size="sm" variant="ghost" onClick={() => setEditingNote(null)}>
                          {t('action.cancel')}
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <>
                      {/* `whitespace-pre-wrap` so a list a secretary typed stays a list. */}
                      <p className="whitespace-pre-wrap text-sm">{note.body}</p>
                      <p className="mt-1 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                        <span>{note.authorName ?? t('meet.noLongerInFamily')}</span>
                        <span>·</span>
                        <span>{formatDate(note.createdAt)}</span>
                        {note.updatedAt !== note.createdAt && <span>· edited</span>}
                        {mayWrite && (
                          <>
                            <button type="button"
                              onClick={() => { setEditingNote(note.id); setNoteDraft(note.body) }}
                              className="underline underline-offset-4 hover:text-foreground">
                              {t('action.edit')}
                            </button>
                            <button type="button" disabled={busy || isPending}
                              onClick={() => onRun(() => deleteMeetingNote(note.id))}
                              className="underline underline-offset-4 hover:text-destructive">
                              {t('action.delete')}
                            </button>
                          </>
                        )}
                      </p>
                    </>
                  )}
                </li>
              ))}
            </ul>
          )}

          {mayWrite && (
            <div className="space-y-2">
              <Label htmlFor={`note-${topic.id}`} className="text-xs">{t('notes.addNote')}</Label>
              <Textarea id={`note-${topic.id}`} value={noteBody} rows={3}
                onChange={e => setNoteBody(e.target.value)}
                placeholder={t('meet.notePh')} />
              <Button size="sm" variant="affirm" disabled={isPending || !noteBody.trim()}
                onClick={() => {
                  startTransition(async () => {
                    const result = await addMeetingNote(topic.id, noteBody)
                    if (!result.success) { onError(result.message ?? t('meet.addFailed')); return }
                    setNoteBody('')
                    onRun(async () => ({ success: true }))
                  })
                }}>
                {t('notes.addNoteAction')}
              </Button>
            </div>
          )}

          {/* ── THE BALLOT ─────────────────────────────────────────────────────────── */}
          <div className="rounded-lg border bg-muted/30 p-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h3 className="flex items-center gap-2 text-sm font-semibold">
                <Vote className="h-4 w-4 text-brand-accent" />
                {voteCalled ? t('meet.theVote') : t('meet.noVote')}
              </h3>
              {mayWrite && (
                <Button size="sm" variant="outline" disabled={busy || isPending}
                  onClick={() => onRun(() => setTopicVoting(topic.id, !voteOpen))}>
                  {voteOpen ? t('meet.closeVote') : voteCalled ? t('meet.voteClosed') : t('meet.callVote')}
                </Button>
              )}
            </div>

            {!voteCalled ? (
              <p className="mt-2 text-xs text-muted-foreground">
                {mayWrite
                  ? t('meet.callVoteHint')
                  : t('meet.noVoteCalled')}
              </p>
            ) : (
              <>
                <p className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-sm tabular-nums">
                  <span><span className="font-semibold">{tally.for}</span> for</span>
                  <span><span className="font-semibold">{tally.against}</span> against</span>
                  <span><span className="font-semibold">{tally.abstain}</span> abstained</span>
                  <span className="text-muted-foreground">
                    of {meeting.attendees.length} in the room
                  </span>
                </p>

                {/* ── HOW EACH PERSON VOTED IS ON THE RECORD ──────────────────────────
                    A meeting vote is not a secret ballot: minutes exist to state who decided
                    what. This is deliberately unlike `/community/elections`, where a member's
                    vote is theirs alone. */}
                {topic.votes.length > 0 && (
                  <ul className="mt-2 space-y-0.5 text-xs text-muted-foreground">
                    {topic.votes.map(v => (
                      <li key={v.voterId}>
                        {v.voterName} — {choices(t).find(c => c.value === v.choice)?.label}
                      </li>
                    ))}
                  </ul>
                )}

                {meeting.iAmAttendee && voteOpen && !myVote && (
                  <div className="mt-3 space-y-1.5">
                    <p className="text-xs text-muted-foreground">
                      {t('meet.voteFinal')}
                    </p>
                    <div className="flex flex-wrap gap-2">
                      {choices(t).map(c => (
                        <Button key={c.value} size="sm"
                          variant={c.value === 'for' ? 'affirm' : 'outline'}
                          disabled={busy || isPending}
                          onClick={async () => {
                            const ok = await confirm({
                              title: `Vote ${c.label.toLowerCase()}?`,
                              description: `Your vote on “${topic.title}” is recorded against your name `
                                + 'and cannot be changed or withdrawn by anybody.',
                              confirmLabel: `Vote ${c.label.toLowerCase()}`,
                            })
                            if (!ok) return
                            onRun(() => castMeetingVote(topic.id, c.value))
                          }}>
                          {c.label}
                        </Button>
                      ))}
                    </div>
                  </div>
                )}

                {myVote && (
                  <p className="mt-3 text-xs font-medium text-brand-on-soft">
                    You voted {choices(t).find(c => c.value === myVote.choice)?.label.toLowerCase()}.
                    That cannot be changed.
                  </p>
                )}

                {!meeting.iAmAttendee && voteOpen && (
                  <p className="mt-3 text-xs text-muted-foreground">
                    {t('meet.onlyAttendees')}
                  </p>
                )}
              </>
            )}
          </div>
        </div>
      )}
    </li>
  )
}
