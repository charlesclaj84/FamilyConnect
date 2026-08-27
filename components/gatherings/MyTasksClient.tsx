'use client'

import { useId, useState, useTransition } from 'react'
import Link from 'next/link'
import { Send, Undo2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { FieldError, FormError } from '@/components/ui/form-message'
import { HelpLink } from '@/components/help/HelpLink'
import { cn } from '@/lib/utils'
import { formatCurrency } from '@/lib/currency-utils'
import { formatDate } from '@/lib/date-utils'
import { useServerState } from '@/lib/use-server-state'
import { GATHERING_TASK_STATUS_LABEL, isCompleteAnswer } from '@/lib/gatherings'
import { AnswerText } from '@/components/gatherings/AnswerText'
import { TaskStatusPill } from '@/components/gatherings/StatusPill'
import { AnswerInput, answerFromDraft, draftFromAnswer } from '@/components/gatherings/AnswerInput'
import { submitGatheringTask, type MyTaskRow } from '@/app/actions/gatherings'
import { useIntlTag, useT } from '@/components/layout/LocaleProvider'

/**
 * `/gatherings/my-tasks` — every gathering task assigned to the caller, with the form to
 * answer it and the organizer's notes when it came back.
 *
 * ── THE FEEDBACK LOOP IS THE SCREEN, NOT A DETAIL OF IT ─────────────────────────────
 * `gathering_task_submissions.review_notes` is the whole reason that table exists: a denial
 * is not a rejection, it is the task handed back WITH INSTRUCTIONS, and the member resubmits
 * as a new row so the notes and the answer they were about both stand. So a denied task
 * renders those notes FIRST, above its own form, in the largest treatment on the card — and
 * `GATHERING_TASK_STATUS_LABEL.denied` says "Needs another look" rather than "Denied", which
 * is `lib/gatherings.ts`'s decision and must not be relabelled here.
 *
 * A denial with no notes is refused by `reviewGatheringTask`, so the empty case below should
 * be unreachable; it is handled anyway, because a row from before that rule, or written by
 * hand, must not render as a task with nothing wrong with it.
 *
 * ── WITHHELD, NOT DESTRUCTIVE, FOR BOTH RETURNED AND OVERDUE ────────────────────────
 * `--brand-withheld` is Warmth and has no `on-` partner, so it appears here as a foreground
 * and as a /10 tint under one, exactly the way `components/gatherings/status.ts` uses it for
 * the pill. `--destructive` reads as alarm because it IS alarm: inside this feature it is
 * reserved for the over-budget line on the money band, and painting a handed-back task in it
 * would tell the member they broke something. An overdue task takes the same token for the
 * same reason `DuesProjectionsClient` prints an unpaid balance in it — nobody has failed at
 * anything by not having done it yet, and this is the member's own to-do list.
 *
 * ── ONE LIST, IN THE ORDER THE ACTION GAVE IT ───────────────────────────────────────
 * `getMyGatheringTasks` orders by `due_on` ascending with `nullsFirst: false`, so the most
 * urgent thing is at the top and an undated task is at the bottom. This component does not
 * re-sort and does not split the list into sections: two orderings of one list is two answers,
 * and the ordering that matters is a deadline. What it does add is the count line above, which
 * is the same definition the rail badge uses — `'open'` and `'denied'` are waiting on the
 * member, `'submitted'` is waiting on an organizer, and `'approved'` is finished.
 *
 * ── THE MONEY ON A TASK IS SHOWN HERE AND IS NOT A BUDGET BAND ──────────────────────
 * `gatherings/budget` is a restricted key gating the money band on `/gatherings/[id]`, where
 * every relative's line together IS how the family divided its money. A member's own line is
 * part of the task they were handed — "you have $200 for the flowers" is what makes it
 * actionable — and `getMyGatheringTasks` selects it unconditionally for that stated reason.
 * Withholding it here would leave an assignee unable to do the thing they were asked to do.
 *
 * ── WHY EACH CARD OWNS ITS OWN DRAFT ────────────────────────────────────────────────
 * A member can have a dozen tasks open and a submission is per task, so the draft, the note,
 * the two error slots and the pending flag all belong to the card. The parent holds only the
 * list — through `useServerState`, so a `revalidatePath` landing from the action replaces the
 * rows rather than being ignored by a frozen initializer. Each card is keyed by task id, so a
 * family switch (which remounts the whole page under `<main key={familyCode}>` anyway) and a
 * refreshed list both replace the ids and React remounts the cards.
 */

export interface MyTasksClientProps {
  initialTasks: MyTaskRow[]
  /** `todayLocal()` from the page. Passed in rather than read here — a component that reads
   *  the clock during render is what `react-hooks/purity` flags, and `YYYY-MM-DD` strings
   *  compare exactly, which no `new Date()` comparison does. */
  today: string
}

export function MyTasksClient({ initialTasks, today }: MyTasksClientProps) {
  const t = useT()
  const [tasks, setTasks] = useServerState(initialTasks)

  /**
   * What a card reports back after a successful submit, applied optimistically.
   *
   * The action has already written the submission row and moved the task to `'submitted'`,
   * and its `revalidatePath` will land the same change from the server — this is what stops
   * the card showing "Not started" in the meantime. `useServerState` adopts the whole array
   * when the server value arrives, so the two cannot end up disagreeing.
   */
  function applySubmission(taskId: string, answer: unknown, note: string) {
    setTasks(prev => prev.map(task => task.id === taskId
      ? {
        ...task,
        status: 'submitted' as const,
        answer,
        latest: {
          decision: 'pending' as const,
          reviewNotes: null,
          note: note.length > 0 ? note : null,
          createdAt: new Date().toISOString(),
        },
      }
      : task))
  }

  if (tasks.length === 0) {
    return (
      // A SENTENCE, NEVER AN EMPTY TABLE. "No rows" over a set of column headings reads as a
      // screen that failed to load; this says what is true, which is that nobody has asked
      // this member for anything yet.
      <p className="rounded-xl border bg-muted/40 px-4 py-6 text-sm text-muted-foreground">
        Nothing is assigned to you at the moment. When an organizer hands you part of a
        gathering, it appears here with what to send back and by when.
      </p>
    )
  }

  const waiting = tasks.filter(t => t.status === 'open' || t.status === 'denied').length
  const returned = tasks.filter(t => t.status === 'denied').length

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        {waiting === 0
          ? t('tasks.allIn')
          : `${waiting} ${waiting === 1 ? 'task is' : 'tasks are'} waiting on you`}
        {returned > 0 && (
          <span className="text-brand-withheld">
            {` · ${returned} ${returned === 1 ? 'needs' : 'need'} another look`}
          </span>
        )}
      </p>

      <ul className="space-y-4">
        {tasks.map(task => (
          <TaskCard key={task.id} task={task} today={today} onSubmitted={applySubmission} />
        ))}
      </ul>
    </div>
  )
}

function TaskCard({ task, today, onSubmitted }: {
  task: MyTaskRow
  today: string
  onSubmitted: (taskId: string, answer: unknown, note: string) => void
}) {
  const intl = useIntlTag()
  const t = useT()
  const uid = useId()
  // The stored answer, in the field. `useServerState` over a STRING adopts by value, so a
  // refreshed list re-seeds the field only when the answer actually changed — a member
  // half-way through an edit does not lose it to an unrelated revalidation.
  const [draft, setDraft] = useServerState(draftFromAnswer(task.kind, task.answer))
  const [note, setNote] = useState('')
  // TWO SLOTS, because they are two different failures and AGENTS.md draws the line by what
  // failed rather than by size. `FieldError` is one input — there is nothing in the answer
  // field yet. `FormError` is a refused OPERATION, and it sits beside the button that caused
  // it, which is also where it stays visible on a phone.
  const [fieldError, setFieldError] = useState('')
  const [formError, setFormError] = useState('')
  const [isPending, startTransition] = useTransition()

  const kind = task.kind
  const approved = task.status === 'approved'
  const denied = task.status === 'denied'
  // An approved task can no longer be late, and saying so would be scolding somebody for a
  // deadline that no longer applies.
  const overdue = !!task.dueOn && task.dueOn < today && !approved

  const fieldId = `${uid}-answer`
  const gatheringDate = formatDate(task.gatheringStartsOn, intl)
  const dueDate = formatDate(task.dueOn, intl)

  /**
   * WHETHER THERE IS A BUDGET LINE AT ALL — asked once, read three times below, so the guard
   * and the two things that depend on it cannot drift.
   *
   * `!= null` and NOT `!== null`, deliberately. `formatCurrency` is
   * `format((cents ?? 0) / 100)`, so it renders BOTH `null` and `undefined` as "$0.00" — and a
   * task whose budget line is absent would then read as a task budgeted at nothing, which is a
   * different statement from "no budget was set on this" and the wrong one. `budgetCents` is
   * typed `number | null` and `mapTaskRow` writes `row.budget_cents ?? null`, so today the two
   * comparisons are identical; the loose one is what keeps this correct if that ever becomes an
   * optional field, which is live because `getGatheringDetail` already selects `budget_cents`
   * conditionally on `gatherings/budget:view`. The strict version would let an `undefined`
   * through to a confident "$0.00". Every other absence guard in the feature is `!= null` for
   * the same reason; this was the one that was not.
   */
  const hasBudgetLine = task.budgetCents != null

  function handleSubmit() {
    const answer = answerFromDraft(kind, draft)
    // `isCompleteAnswer` answers "is this an answer", NOT "was the step required" — a blank
    // is not an answer whatever the flag says, and a task that is not required is simply left
    // alone rather than submitted empty. It is the same rule the action applies, because both
    // are `parseAnswer(…) !== null`.
    if (!isCompleteAnswer(kind, answer)) {
      setFieldError(t('tasks.fillFirst'))
      return
    }
    setFieldError('')
    setFormError('')
    const trimmedNote = note.trim()

    startTransition(async () => {
      const result = await submitGatheringTask({
        taskId: task.id,
        answer,
        note: trimmedNote.length > 0 ? trimmedNote : undefined,
      })
      // `{ success, message }` — every Gatherings action returns that pair. Reading
      // `result.error` here (which is what `admin/chapters` returns) would show the fallback
      // sentence for every real failure.
      if (!result.success) {
        setFormError(result.message ?? t('tasks.sendFailed'))
        return
      }
      onSubmitted(task.id, answer, trimmedNote)
      setNote('')
    })
  }

  return (
    <li className="space-y-3 rounded-xl border bg-card p-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <h3 className="text-base font-semibold">{task.label}</h3>
          <p className="mt-0.5 text-xs text-muted-foreground">
            <Link href={`/gatherings/${task.gatheringId}`} className="hover:underline">
              {task.gatheringTitle}
            </Link>
            {gatheringDate && <> · {gatheringDate}</>}
            {task.templateName && <> · {task.templateName}</>}
          </p>
        </div>
        <TaskStatusPill status={task.status} />
      </div>

      {/* A META LINE, WHERE AN ABSENT VALUE IS SIMPLY NOT A LINE — no em-dash, because there
          is no column here holding a grid open. The whole paragraph is withheld when neither
          half has anything to say. */}
      {(dueDate || hasBudgetLine) && (
        <p className="text-xs text-muted-foreground">
          {dueDate && (
            <span className={cn(overdue && 'font-medium text-brand-withheld')}>
              {overdue ? `Was due ${dueDate}` : `Due ${dueDate}`}
            </span>
          )}
          {dueDate && hasBudgetLine && <> · </>}
          {hasBudgetLine && <>Budget {formatCurrency(task.budgetCents, intl)}</>}
        </p>
      )}

      {task.helpText && (
        <p className="text-sm whitespace-pre-wrap text-muted-foreground">{task.helpText}</p>
      )}

      {denied && (
        // THE PROMINENT HALF OF THE FEEDBACK LOOP. Above the form, not beside it, and in the
        // withheld tint rather than the destructive one: the organizer wants something
        // changed, and this is what they said.
        <div className="space-y-1.5 rounded-lg border border-brand-withheld/40 bg-brand-withheld/5 p-3">
          <p className="flex items-center gap-1.5 text-sm font-semibold text-brand-withheld">
            <Undo2 aria-hidden="true" className="h-4 w-4" />
            {t('tasks.whatAsked')}
          </p>
          {task.latest?.reviewNotes
            ? <p className="text-sm whitespace-pre-wrap">{task.latest.reviewNotes}</p>
            : (
              <p className="text-sm text-muted-foreground">
                {t('tasks.backNoNotes')}
              </p>
            )}
          {/* ONE OF THREE PLACED HELP LINKS IN THE FEATURE, and this is the strongest of them.
              A member reading this box has had work handed back and is about to guess at what
              happens next: whether the old answer is gone, whether they get another go, whether
              anybody is told. `gathering-tasks#sent-back` answers all three, and none of it is
              on this screen — which is exactly `HelpLink`'s test, a paragraph somebody standing
              here needs and would not think to go looking for.

              `inline`, not `icon`: this block is prose already, there is room for the words, and
              a bare question mark inside a warning-tinted panel reads as part of the warning.
              The words carry their own colour (`--brand-accent`) rather than the panel's
              withheld tone, which is right — the link is a way out, not more of the complaint. */}
          <HelpLink
            variant="inline"
            slug="gathering-tasks"
            section="sent-back"
            label="What happens when a task comes back"
          />
        </div>
      )}

      {approved ? (
        <div className="space-y-1 rounded-lg border border-brand-affirm/40 bg-brand-affirm/10 p-3">
          <p className="text-xs font-medium text-brand-affirm">
            {GATHERING_TASK_STATUS_LABEL.approved} — this answer is final.
          </p>
          <div className="text-sm">
            <AnswerText kind={kind} answer={task.answer} />
          </div>
          <p className="text-xs text-muted-foreground">
            {t('tasks.askReopen')}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {/* WHAT WAS SENT LAST TIME, above the form that replaces it. On a returned task it
              is the thing the notes are about; on one waiting for review it is what an
              organizer is looking at, and seeing it is how a member knows whether to correct
              it before anybody does. */}
          {task.latest && (
            <div className="rounded-lg border bg-muted/40 p-3 text-sm">
              <p className="text-xs font-medium text-muted-foreground">
                {task.status === 'submitted' ? 'Sent for review' : 'What you sent'}
                {formatDate(task.latest.createdAt, intl) && ` · ${formatDate(task.latest.createdAt, intl)}`}
              </p>
              <div className="mt-1">
                <AnswerText kind={kind} answer={task.answer} />
              </div>
              {task.latest.note && (
                <p className="mt-1 text-xs whitespace-pre-wrap text-muted-foreground">
                  Your note: {task.latest.note}
                </p>
              )}
            </div>
          )}

          <div className="space-y-1.5">
            {/* `required` is the LABEL's marker and sets no native `required` attribute —
                this form validates on submit and renders its own message, and the native
                bubble would be a second, differently worded one. */}
            <Label htmlFor={fieldId} required={task.required}>{t('tasks.yourAnswer')}</Label>
            <AnswerInput
              kind={kind}
              value={draft}
              onChange={next => { setDraft(next); setFieldError('') }}
              disabled={isPending}
              fieldId={fieldId}
              groupName={`${uid}-choice`}
              ariaLabel={`Your answer for ${task.label}`}
            />
            <FieldError message={fieldError} />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor={`${uid}-note`}>{t('tasks.anythingToTell')}</Label>
            <Textarea
              id={`${uid}-note`}
              autoGrow
              rows={1}
              value={note}
              disabled={isPending}
              placeholder={t('tasks.optional')}
              onChange={e => setNote(e.target.value)}
            />
          </div>

          <FormError message={formError} />

          <div className="flex flex-wrap items-center gap-2">
            <Button variant="affirm" size="sm" disabled={isPending} onClick={handleSubmit}>
              <Send aria-hidden="true" className="mr-1 h-4 w-4" />
              {isPending
                ? 'Sending…'
                : denied ? 'Send it again' : task.status === 'submitted' ? 'Replace my answer' : 'Send for review'}
            </Button>
            <span className="text-xs text-muted-foreground">
              {t('tasks.reviewNote')}
            </span>
          </div>
        </div>
      )}
    </li>
  )
}
