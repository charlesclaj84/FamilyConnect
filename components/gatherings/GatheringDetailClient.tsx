'use client'

import { useMemo, useState } from 'react'
import { Input } from '@/components/ui/input'
import { Label, RequiredMark } from '@/components/ui/label'
import { Select } from '@/components/ui/select'
import { COLLAPSING_CELL, MetaDot, RowMeta } from '@/components/ui/table-collapse'
import { AnswerText } from '@/components/gatherings/AnswerText'
import { TaskStatusPill } from '@/components/gatherings/StatusPill'
import { GATHERING_TASK_STATUSES, GATHERING_TASK_STATUS_LABEL, isCompleteAnswer, type GatheringTaskStatus, type TaskProgress } from '@/lib/gatherings'
import { formatCurrency } from '@/lib/currency-utils'
import { formatDate } from '@/lib/date-utils'
import { normalizePersonSearch } from '@/lib/person-search'
import { cn } from '@/lib/utils'
import type { GatheringTaskRow } from '@/app/actions/gatherings'

/**
 * Every job on a gathering, grouped by the template it came from.
 *
 * ── WHY THIS IS A CLIENT COMPONENT AT ALL ───────────────────────────────────────────
 * Nothing here writes: a member reads this screen and submits their own answers on
 * `/gatherings/my-tasks`. What it needs the browser for is FINDING one row. A gathering built
 * from three templates has thirty or forty tasks, which is the same problem AGENTS.md sets out
 * for a member list — "build every member list for a hundred-member family", and the failure
 * mode is not performance but that the row you came for is three screens down. So there is a
 * status filter and a search box, and neither can be a server round trip on a page whose data
 * is already in the payload.
 *
 * The controls only appear once there are enough rows to need them (`FILTER_THRESHOLD`). A
 * filter box over four tasks is furniture, and the same argument the dashboard makes about
 * omitting a zero tile: a control that can only ever narrow four rows to three is noise on the
 * screen of the family that has just started.
 *
 * ── WHY THE SEARCH USES `normalizePersonSearch` AND NOT `matchesPersonQuery` ─────────
 * The query has to match a task LABEL as well as an assignee, and the assignee arrives here as
 * one formatted, already-disambiguated string rather than as `{ first_name, last_name }` — so
 * `matchesPersonQuery`, which takes a `SearchablePerson`, does not fit. What it exports beside
 * it does: `normalizePersonSearch` is the fold (NFD, strip combining marks, drop
 * non-alphanumerics, lowercase) that makes "jose" find "José" and "oconnor" find "O'Connor".
 * Using it rather than a bare `.toLowerCase().includes()` is the whole point of that module
 * existing — AGENTS.md records that the Member Directory got accent-insensitive search and the
 * photo tagger did not, because the rule lived inside a component both times.
 *
 * ── GROUPED BY FIRST APPEARANCE, NOT BY THE `templates` LIST ────────────────────────
 * The tasks arrive ordered by `position`, and `instantiateTemplateTasks` offsets each
 * template's block past the last, so first appearance IS the order the templates were named
 * when the gathering was scheduled. Grouping off `GatheringDetail.templates` instead would
 * silently drop any task whose template has since been unlinked or deleted — `template_id` is
 * `ON DELETE SET NULL` on purpose, because a task is a thing a named relative was asked to do
 * and it must outlive the template it was copied from. Those tasks get their own group at the
 * end rather than vanishing.
 *
 * ── A GROUP IS A SEGMENT, SO ITS HEADING CARRIES THE DAY AND THE PLACE ──────────────
 * A Family Reunion is a three-day event made of the Welcome, the Picnic and the Send Off, and
 * since 20260819000001 each linked template records the day it happens on and the place it is
 * held (`gathering_template_uses.occurs_on` / `.location`). The task list was already grouped by
 * template, so the heading is exactly where those two facts belong: a member reading "Picnic"
 * over eleven jobs has no way to know it is the Saturday, at Zilker, and the page header above
 * can only state the whole span and the gathering's own location.
 *
 * BOTH ARE NULLABLE AND MEAN "NOT STATED", and a group with neither renders precisely as it did
 * before this existed — one `<h3>` and the table. That is not a coincidence to be maintained by
 * care: the subline is inside a wrapper that holds only the heading when there is nothing to add,
 * so the absent case has no branch of its own to get wrong. Most gatherings are one day in one
 * place and must not grow furniture for a distinction they do not make.
 *
 * ── MATCHED BY NAME, WHICH IS A KEY HERE AND NOT A GUESS ────────────────────────────
 * The groups are keyed by `templateName` (see `groupByTemplate`), and `GatheringTaskRow` carries
 * no template id at all — so the segment is looked up by name. That is sound rather than lucky:
 * `gathering_templates` is `UNIQUE (family_code, name)`, so within one family a name identifies
 * one template. A group with no matching segment simply has nothing to add, which is what the
 * orphan group ("Not from a template") always is, and also what a segment unlinked since the page
 * was rendered becomes — the right answer in both cases, and neither is an error.
 *
 * ── NOTHING HERE POLICES THE DATE, DELIBERATELY ─────────────────────────────────────
 * A segment's day is NOT constrained to the gathering's span — the migration argues why at length
 * (a gathering's dates move, and a constraint would refuse an ordinary edit to `starts_on`) — and
 * this screen does not mark one that falls outside it. A relative reading their own reunion is
 * not the person who reconciles a date; the organizer is, so the marking lives on
 * `/admin/gatherings/[id]`. Printing a warning here would tell forty people something is wrong
 * with a gathering they cannot edit. `getGatheringDetail`'s own comment on `templates` says the
 * same thing from the other side.
 *
 * ── THE TABLE FOLDS, IT DOES NOT SCROLL ─────────────────────────────────────────────
 * Task and Status stay at every width; Assigned to, Due, Budget and Answer fold with
 * `COLLAPSING_CELL` on the `<th>` AND every `<td>` — both, or every remaining cell is announced
 * under the wrong column — and are restated in a `RowMeta` inside the first cell. Status keeps
 * its column rather than folding because the pill carries its meaning in its colour, and
 * restating it as grey text would render the row's most important fact as its least visible
 * one.
 */

/**
 * How many tasks before the filter controls are worth their space.
 *
 * Eight is a judgement, not a measurement: it is about the point at which a list stops being
 * something you read and starts being something you search. Below it every row is on screen at
 * once on a laptop.
 */
const FILTER_THRESHOLD = 8

type StatusFilter = 'all' | GatheringTaskStatus

interface Props {
  tasks: GatheringTaskRow[]
  taskCounts: TaskProgress
  /**
   * Whether the per-task budget column is rendered at all — `budgetState === 'shown'` on the
   * page, which is `gatherings/budget:view` being held AND the figures having come back.
   *
   * It reads `budgetState` and not `budget !== null` because those are the same value today and
   * express different intentions: the column is withheld when the money was WITHHELD, and it is
   * also withheld when the read FAILED, since `taskBudgetLines` returning null is one of the two
   * things that produces `'unavailable'` — so there is genuinely nothing to put in it either way.
   * The band above is where the difference is spoken (`BudgetBand`'s header has the argument);
   * repeating it as a column of "unavailable" cells would say it once per task.
   *
   * THIS IS NOT WHAT PROTECTS THE MONEY, and it matters that the next reader knows it.
   * `getGatheringDetail` selects `TASK_COLUMNS_WITH_MONEY` or `TASK_COLUMNS` from that same
   * grant, so for a caller who does not hold it `budget_cents` is never asked for and every
   * `budgetCents` here is already `null` — the withholding is a query that did not run (§5),
   * on the server, where it belongs. What this flag decides is only whether the column and its
   * `<th>` are drawn at all, because a rendered column of em-dashes reads as "nothing is
   * budgeted" rather than as "you are not being shown this".
   *
   * Written the other way round — "the screen is what must not print the money" — this comment
   * invited a future refactor to delete the action's column gate as redundant. It is not
   * redundant; it is the gate.
   */
  showTaskBudgets: boolean
  /**
   * The gathering's SEGMENTS — `GatheringDetail.templates`, in `position` order.
   *
   * Optional, and it renders nothing at all when it is absent: a group with no segment behind it
   * reads exactly as every group did before 20260819000001, which is the same answer this
   * component already gives for the orphan group. So a caller that has not been updated to pass
   * it loses the day and the place and nothing else — no empty heading, no dash, no error.
   *
   * `readonly` because this component only ever looks names up in it.
   */
  segments?: readonly {
    id: string
    name: string
    occursOn: string | null
    location: string | null
  }[]
}

export function GatheringDetailClient({ tasks, taskCounts, showTaskBudgets, segments }: Props) {
  const [status, setStatus] = useState<StatusFilter>('all')
  const [query, setQuery] = useState('')

  const filtered = useMemo(() => {
    const needle = normalizePersonSearch(query)
    return tasks.filter(task => {
      if (status !== 'all' && task.status !== status) return false
      if (!needle) return true
      // The label and the assignee are both folded the same way, so a query matches either —
      // "linens" finds the job and "martha" finds everything Martha was given.
      const haystack = normalizePersonSearch(`${task.label} ${task.assignee?.name ?? ''}`)
      return haystack.includes(needle)
    })
  }, [tasks, status, query])

  const groups = useMemo(() => groupByTemplate(filtered), [filtered])

  /**
   * Segment by template NAME, because that is what a group is keyed by — see the header.
   *
   * Built even when `segments` is absent (an empty map answers every lookup with `undefined`),
   * so there is one code path through the heading rather than two.
   */
  const segmentByName = useMemo(
    () => new Map((segments ?? []).map(seg => [seg.name, seg])),
    [segments],
  )

  // The counts come from the SERVER's `taskProgress` over every task, never from the filtered
  // list: a summary that moved as somebody typed would be a different figure from the one the
  // gathering card on `/gatherings` shows, computed from the same rows.
  const summary = [
    `${taskCounts.total} ${taskCounts.total === 1 ? 'task' : 'tasks'}`,
    taskCounts.approved > 0 ? `${taskCounts.approved} approved` : null,
    taskCounts.submitted > 0 ? `${taskCounts.submitted} waiting for review` : null,
    taskCounts.denied > 0 ? `${taskCounts.denied} need another look` : null,
  ].filter(Boolean).join(' · ')

  return (
    <section className="space-y-3">
      <div className="flex flex-wrap items-end justify-between gap-x-4 gap-y-2">
        <div>
          <h2 className="text-lg">Tasks</h2>
          <p className="mt-0.5 text-xs text-muted-foreground">
            {taskCounts.total === 0
              ? 'Nothing has been added to this gathering yet.'
              : summary}
          </p>
        </div>

        {tasks.length > FILTER_THRESHOLD && (
          <div className="flex flex-wrap items-end gap-2">
            <div className="min-w-0 space-y-1.5">
              <Label htmlFor="task-search">Find a task</Label>
              <Input
                id="task-search"
                value={query}
                placeholder="Job or name"
                className="sm:w-48"
                onChange={e => setQuery(e.target.value)}
              />
            </div>
            <div className="min-w-0 space-y-1.5">
              <Label htmlFor="task-status">Showing</Label>
              <Select
                id="task-status"
                className="sm:w-44"
                value={status}
                onChange={e => setStatus(e.target.value as StatusFilter)}
              >
                <option value="all">Every task</option>
                {GATHERING_TASK_STATUSES.map(s => (
                  <option key={s} value={s}>{GATHERING_TASK_STATUS_LABEL[s]}</option>
                ))}
              </Select>
            </div>
          </div>
        )}
      </div>

      {taskCounts.total === 0 ? (
        <p className="rounded-xl border bg-muted/40 px-4 py-6 text-sm text-muted-foreground">
          No tasks yet. A gathering&rsquo;s tasks come from the templates it was built from, so an
          organizer adding a template here adds its jobs to this list.
        </p>
      ) : groups.length === 0 ? (
        /* NEVER A SILENTLY SHORT LIST. The filter is the only thing that can empty a table that
           has rows, and saying so is what stops somebody concluding a task was deleted. */
        <p className="rounded-xl border bg-muted/40 px-4 py-6 text-sm text-muted-foreground">
          No task matches what you are looking for. {taskCounts.total}{' '}
          {taskCounts.total === 1 ? 'task is' : 'tasks are'} on this gathering.
        </p>
      ) : (
        <div className="space-y-6">
          {groups.map(group => {
            const segment = segmentByName.get(group.name)
            return (
              <TaskGroup
                key={group.key}
                heading={group.name}
                occursOn={segment?.occursOn ?? null}
                location={segment?.location ?? null}
                tasks={group.tasks}
                showTaskBudgets={showTaskBudgets}
              />
            )
          })}
        </div>
      )}
    </section>
  )
}

/** One SEGMENT's block of work — its name, when and where it happens, and its tasks. */
function TaskGroup({ heading, occursOn, location, tasks, showTaskBudgets }: {
  heading: string
  /** The segment's day, `YYYY-MM-DD`, or null for "not stated". */
  occursOn: string | null
  /** The segment's place, or null for "not stated". */
  location: string | null
  tasks: GatheringTaskRow[]
  showTaskBudgets: boolean
}) {
  /*
   * WHEN AND WHERE, as one line, assembled as a list so the interpunct lands between whatever is
   * actually there rather than around a value that turned out to be absent — the same shape
   * `RowMeta` is built from below.
   *
   * `formatDate` answers null for a null or unparseable date, so there is nothing to guard: an
   * absent day and a garbled one both drop out of the line. No icons, unlike the page header
   * above: at `text-xs` a pair of 14px glyphs is noise, and this line sits directly under the
   * name it belongs to rather than in a row of unrelated facts.
   */
  const when = formatDate(occursOn)
  const meta = [when, location].filter(Boolean).join(' · ')

  return (
    <div className="space-y-2">
      {/* The wrapper holds only the `<h3>` when there is nothing to add, so a segment that states
          neither a day nor a place renders exactly as every group did before segments existed —
          `space-y-2` puts the same gap above the table either way. */}
      <div>
        {/* `h3` is painted `--brand-accent` and stays in Inter by the base layer, deliberately —
            Cormorant goes thin and hard to read at the size a functional subhead runs at. */}
        <h3 className="text-sm font-semibold">{heading}</h3>
        {meta && <p className="mt-0.5 text-xs text-muted-foreground">{meta}</p>}
      </div>
      <div className="overflow-visible rounded-xl border">
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr className="border-b bg-muted/40 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              <th scope="col" className="px-3 py-2 font-semibold">Task</th>
              <th scope="col" className={cn('px-3 py-2 font-semibold', COLLAPSING_CELL)}>Assigned to</th>
              <th scope="col" className="px-3 py-2 font-semibold">Status</th>
              <th scope="col" className={cn('px-3 py-2 font-semibold', COLLAPSING_CELL)}>Due</th>
              {showTaskBudgets && (
                <th scope="col" className={cn('px-3 py-2 text-right font-semibold', COLLAPSING_CELL)}>Budget</th>
              )}
              <th scope="col" className={cn('px-3 py-2 font-semibold', COLLAPSING_CELL)}>Answer</th>
            </tr>
          </thead>
          <tbody>
            {tasks.map(task => (
              <TaskRow key={task.id} task={task} showTaskBudgets={showTaskBudgets} />
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function TaskRow({ task, showTaskBudgets }: { task: GatheringTaskRow; showTaskBudgets: boolean }) {
  // `isCompleteAnswer` is `parseAnswer(...) !== null` — it answers "is this an answer", NOT "was
  // the step required", and a blank is not an answer. Asking it here rather than testing
  // `task.answer != null` is what stops a `{}` written by some future path rendering as an
  // answered task with nothing in it.
  const answered = task.answer != null && isCompleteAnswer(task.kind, task.answer)
  const due = formatDate(task.dueOn)
  const answerNode = answered ? <AnswerText kind={task.kind} answer={task.answer} /> : null

  // The meta line, built as a list so the interpuncts land between whatever is actually there
  // rather than around a value that turned out to be absent.
  const meta: React.ReactNode[] = []
  if (task.assignee?.name) meta.push(<span key="who">{task.assignee.name}</span>)
  else meta.push(<span key="who">Nobody yet</span>)
  if (due) meta.push(<span key="due">Due {due}</span>)
  if (showTaskBudgets && task.budgetCents != null) {
    meta.push(<span key="budget" className="tabular-nums">{formatCurrency(task.budgetCents)}</span>)
  }
  // LABELLED, because the heading that named it has folded away. A bare sentence under a task
  // label reads as part of the label.
  if (answerNode) meta.push(<span key="answer">Answered {answerNode}</span>)

  return (
    <tr className="border-b align-top last:border-0 sm:align-middle">
      <td className="px-3 py-2.5">
        <span className="font-medium">
          {task.label}
          {/* The marker for a step the template said must be answered. `RequiredMark` rather
              than an asterisk typed here: it is `--brand-accent` (a task nobody has done yet
              is not an error state), sized as an annotation, and announced as "(required)". */}
          {task.required && <RequiredMark />}
        </span>
        {task.helpText && (
          <p className="mt-0.5 text-xs text-muted-foreground">{task.helpText}</p>
        )}
        {/* WHAT A DENIAL SAID, wherever the task is read. `/gatherings/my-tasks` is where these
            notes are prominent, because that is where the member acts on them — here it is the
            one line that explains why a task reads "Needs another look" rather than leaving the
            pill unexplained. Withheld, never destructive: the organizer handed the task back
            with notes, which is the feedback loop working rather than an error. */}
        {task.status === 'denied' && task.latest?.reviewNotes && (
          <p className="mt-1 text-xs text-brand-withheld">{task.latest.reviewNotes}</p>
        )}
        <RowMeta className="gap-x-2">
          {meta.flatMap((node, i) => i === 0 ? [node] : [<MetaDot key={`dot-${i}`} />, node])}
        </RowMeta>
      </td>

      <td className={cn('px-3 py-2.5', COLLAPSING_CELL)}>
        {task.assignee?.name ?? <span className="text-muted-foreground">Nobody yet</span>}
      </td>

      <td className="px-3 py-2.5">
        <TaskStatusPill status={task.status} />
      </td>

      {/* An em-dash is what a missing value looks like in a COLUMN — the cell has to hold the
          grid open. In the meta line above, a value we do not have is simply not a line. */}
      <td className={cn('px-3 py-2.5 text-muted-foreground', COLLAPSING_CELL)}>{due ?? '—'}</td>

      {showTaskBudgets && (
        <td className={cn('px-3 py-2.5 text-right tabular-nums text-muted-foreground', COLLAPSING_CELL)}>
          {task.budgetCents != null ? formatCurrency(task.budgetCents) : '—'}
        </td>
      )}

      <td className={cn('px-3 py-2.5', COLLAPSING_CELL)}>
        {answerNode ?? <span className="text-muted-foreground">—</span>}
      </td>
    </tr>
  )
}

/**
 * Split the tasks into their template blocks, in the order the templates first appear.
 *
 * The `null` group is tasks whose template has been unlinked or deleted (`template_id` is
 * `ON DELETE SET NULL`, because a task must outlive the template it was copied from), and it is
 * forced to the END rather than left wherever its first row happened to sit — a group headed
 * "Not from a template" in the middle of two named ones reads as a mistake.
 */
function groupByTemplate(tasks: GatheringTaskRow[]): { key: string; name: string; tasks: GatheringTaskRow[] }[] {
  const byName = new Map<string, GatheringTaskRow[]>()
  const orphans: GatheringTaskRow[] = []

  for (const task of tasks) {
    if (!task.templateName) { orphans.push(task); continue }
    const existing = byName.get(task.templateName)
    if (existing) existing.push(task)
    else byName.set(task.templateName, [task])
  }

  const groups = [...byName.entries()].map(([name, rows]) => ({ key: name, name, tasks: rows }))
  if (orphans.length > 0) {
    // The React key for the orphan group has to be one no `gathering_templates.name` can ever
    // be, because every other group is keyed by its template's NAME — and that column is only
    // `UNIQUE (family_code, name)`, so any printable sentinel is a name somebody could type.
    //
    // It is written as the two-character ESCAPE and must never be the raw byte. A literal NUL
    // in the source makes the whole file `data` rather than text: git diffs it as "Binary
    // files differ" with no hunks, and ripgrep answers "Binary file … matches" instead of a
    // line number. Every gate in this repo that sweeps the tree is grep-shaped
    // (`scripts/people-writes.mjs`, `help:check`, the colour and rebrand sweeps that finish
    // with `git grep` returning nothing), so a file grep skips is a file every future sweep
    // declares clean. Neither Node nor SWC objects to the byte, which is why nothing catches
    // it. `npm run lint` on this file is not evidence; `file` reporting UTF-8 text is.
    groups.push({ key: '\u0000orphans', name: 'Not from a template', tasks: orphans })
  }
  return groups
}
