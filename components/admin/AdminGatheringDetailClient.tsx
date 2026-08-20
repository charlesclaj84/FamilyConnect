'use client'

import { useMemo, useState, useTransition } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { ArrowLeft, Plus, Star, Trash2 } from 'lucide-react'
import { Button, buttonVariants } from '@/components/ui/button'
import { Dialog } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { useConfirm } from '@/components/ui/confirm'
import { FormError, FieldError } from '@/components/ui/form-message'
import { COLLAPSING_CELL, RowMeta, MetaDot, MetaIf } from '@/components/ui/table-collapse'
import { PersonPicker } from '@/components/ui/person-picker'
import { HelpLink } from '@/components/help/HelpLink'
import type { SelectablePerson } from '@/components/ui/person-multi-select'
import { GatheringStatusPill, TaskStatusPill } from '@/components/gatherings/StatusPill'
import { BudgetBand } from '@/components/gatherings/BudgetBand'
import { AnswerText } from '@/components/gatherings/AnswerText'
import { GATHERING_PILL_SHAPE, GATHERING_PREMIER_PILL } from '@/components/gatherings/status'
import { cn } from '@/lib/utils'
import { useServerState } from '@/lib/use-server-state'
import { disambiguatedName } from '@/lib/name-utils'
import { formatDate, formatDateRange } from '@/lib/date-utils'
import { formatCurrency, dollarsToCents } from '@/lib/currency-utils'
import {
  GATHERING_STATUSES, GATHERING_STATUS_LABEL, type GatheringStatus,
} from '@/lib/gatherings'
import {
  updateGathering, deleteGathering, setGatheringPremier, setGatheringBudget,
  addGatheringTemplate, removeGatheringTemplate, setGatheringSegment,
  assignGatheringTask, setGatheringTaskBudget, reviewGatheringTask, reopenGatheringTask,
  type AdminGatheringDetail, type AdminGatheringTaskRow, type GatheringBudgetView,
} from '@/app/actions/admin/gatherings'

/**
 * ONE GATHERING, from the organizer's side.
 *
 * Five panels and a task table, in the order the work happens: what it is, whether it goes on
 * the Dashboard, what it may spend, which segments it is made of, and who is doing each thing.
 *
 * ── THE BUDGET BAND IS READ-ONLY AND THE FORM SITS BESIDE IT ────────────────────────
 * `components/gatherings/BudgetBand.tsx` is shared with the member-facing gathering page and
 * contains no controls at all, deliberately: the figures and the red line have to read
 * identically on both screens, and a band that sometimes carried an editor would be two
 * components wearing one name. So this screen renders the band and puts its own fund picker and
 * amount box next to it, calling `setGatheringBudget`.
 *
 * The whole panel is absent unless `gathering.budget` is non-null, and that is not a hidden
 * control: `getAdminGatheringDetail` resolves `gatherings/budget:view` itself and never SELECTS
 * `budget_cents` or `fund_id` without it, so there is nothing here to hide (§5).
 *
 * ── THE OVER-FUND LINE IS `--destructive`, AND IT IS NOT AN ERROR TO PREVENT ────────
 * A family plans a $12,000 reunion in January and raises the money by June, so a budget that
 * exceeds its fund is a state the product must be able to hold and SHOW. Nothing in the
 * database or the action refuses it; the band says so in red. (`--brand-withheld` is for a
 * capability being withheld, which this is not.)
 *
 * ── A LINKED TEMPLATE IS A SEGMENT, WITH ITS OWN DAY AND ITS OWN PLACE ──────────────
 * A Family Reunion is a three-day event made of the Welcome, the Picnic and the Send Off, and
 * each of those is an event of its own. A gathering could already hold three templates before
 * 20260819000001; what the three had nowhere to say was that they happen on different days in
 * different places. `gathering_template_uses.occurs_on` and `.location` are that, so the pill
 * list here became a TABLE — a template linked to a gathering is not a tag on it, it is a part
 * of it with facts of its own, and a pill cannot hold a date, a place and a count.
 *
 * Both columns are NULLABLE and mean "not stated": a one-day gathering in one place states
 * neither and reads as it always did. The day and the place are edited in the row through
 * `setGatheringSegment` rather than in a dialog, because two fields are not a form — and each
 * row owns its own `useTransition`, so saving the Picnic does not grey out the Send Off.
 *
 * ── AN OUT-OF-SPAN DAY IS ACCEPTED AND SAID OUT LOUD, NEVER REFUSED ─────────────────
 * 20260819000001 deliberately has no CHECK and no trigger tying a segment inside
 * `starts_on..ends_on`, and its header argues why at length: a gathering's dates MOVE. An
 * organizer shifts the weekend, which is an ordinary edit to the form above — and a constraint
 * would refuse it with a 23514 naming a table they were not looking at, about a row they did not
 * touch. Their own sequence, "shift the weekend and then fix the three segments", would be
 * unreachable, because each half refuses while the other is still wrong.
 *
 * So `addGatheringTemplate` and `setGatheringSegment` both answer `{ success: true, warning }`
 * for a day outside the span, and THE SENTENCE IS THEIRS. This screen renders `result.warning`
 * verbatim and composes nothing of its own: the comparison lives once, in the action, beside the
 * write it is about — a copy here would be a second answer to drift from the first, and the
 * migration's whole argument is that there is one right place to say this.
 *
 * It is `--brand-withheld` and never `--destructive` (AGENTS.md, "Colours live in one place"):
 * nothing failed, the write landed, and the organizer has a date to reconcile. Reporting a
 * FAILURE is `form-message.tsx`'s job, which is why this one line is not a `FormError` — the two
 * appear in the same place and say different kinds of thing, and the colour is how a reader
 * tells them apart at a glance.
 *
 * ── ASSIGNING GOES THROUGH A DIALOG BECAUSE `PersonPicker` IS THE CONTROL ───────────
 * Choosing one relative out of a hundred and forty is a search box over a bounded scrolling
 * radio group — that is what `PersonPicker` is, and it does not fit in a table cell. So the
 * row's Manage button opens one dialog holding everything about that one task: who is doing it,
 * when it is due, what it may spend, and — when an answer is waiting — the ruling. Names inside
 * it come from `disambiguatedName` computed against the WHOLE roster, never a filtered subset,
 * because two Martha Allens are likelier in a large family rather than less.
 *
 * ── DENY DEMANDS NOTES; REOPEN DOES NOT ─────────────────────────────────────────────
 * `reviewGatheringTask` refuses a denial with no `reviewNotes`, because the notes ARE what the
 * member reads before submitting again — the whole loop the feature exists for, and the reason
 * `GATHERING_TASK_STATUS_LABEL.denied` reads "Needs another look" rather than "Denied". The
 * form requires them first and says why, so nobody is refused after committing to a decision.
 *
 * `reopenGatheringTask` makes its reason OPTIONAL, and the dialog follows the action rather than
 * imposing its own rule: a wrong approval sometimes needs no explaining. That control appears
 * only on an approved task and is what the member-facing copy has promised since the feature
 * shipped — `submitGatheringTask` refuses an approved task with "Ask an organizer to reopen it if
 * it needs to change", and for one day there was nothing here to press.
 */

interface TemplateOption {
  id: string
  name: string
  description: string | null
  /**
   * THERE IS NO `defaultLocation` HERE ANY MORE. A template used to state where its gatherings
   * were usually held, this screen pre-filled the segment's place from it, and
   * `addGatheringTemplate` copied it anyway when the box was left empty. `20260819000007` drops
   * the column: a venue belongs to one occasion, not to a template, and a template that wants
   * one now carries a step of kind **A place** for a named relative to settle. The box below
   * starts empty and an empty box means "not stated".
   */
}

interface FundOption {
  id: string
  name: string
  balanceCents: number
}

interface Props {
  gathering: AdminGatheringDetail
  /** Everybody who can hold a task — accounts and account-less relatives alike. */
  members: SelectablePerson[]
  funds: FundOption[]
  templates: TemplateOption[]
  mayEdit: boolean
  mayDelete: boolean
  mayManageBudget: boolean
  /**
   * `gatherings:view` — whether the **Member view** button is offered.
   *
   * A DIFFERENT KEY from everything else on this screen. `/gatherings/[id]` gates on its own
   * `gatherings` key and 404s a caller without it, and a family that restricts the member-facing
   * list while granting an organizer the console is a state Members & Access can produce — so
   * the button is offered on the destination's grant, never on this page's.
   */
  mayViewMemberPage: boolean
  /**
   * `admin/account:view` — whether the "no fund yet" sentence may link to Accounting.
   *
   * The likeliest of these to be missing: the money and the gatherings are exactly the two jobs
   * a family splits between two people.
   */
  mayViewAccounting: boolean
}

export function AdminGatheringDetailClient({
  gathering, members, funds, templates, mayEdit, mayDelete, mayManageBudget,
  mayViewMemberPage, mayViewAccounting,
}: Props) {
  const router = useRouter()
  const confirm = useConfirm()

  // Every one of these is `useServerState`, and each holds a PRIMITIVE rather than the whole
  // gathering. That matters: `useServerState` adopts by identity, so an object prop would be
  // adopted on every server render and would discard a half-typed title on any unrelated
  // refresh, while a string is only adopted when the string itself changed.
  const [title, setTitle] = useServerState(gathering.title)
  const [summary, setSummary] = useServerState(gathering.summary ?? '')
  const [location, setLocation] = useServerState(gathering.location ?? '')
  const [startsOn, setStartsOn] = useServerState(gathering.startsOn)
  const [endsOn, setEndsOn] = useServerState(gathering.endsOn ?? '')
  const [status, setStatus] = useServerState<GatheringStatus>(gathering.status)
  const [isPremier, setIsPremier] = useServerState(gathering.isPremier)
  const [budget, setBudget] = useServerState<GatheringBudgetView | null>(gathering.budget)
  const [usedTemplates, setUsedTemplates] = useServerState(gathering.templates)
  const [tasks, setTasks] = useServerState(gathering.tasks)

  const [detailsError, setDetailsError] = useState('')
  const [premierError, setPremierError] = useState('')
  const [templateError, setTemplateError] = useState('')
  const [taskError, setTaskError] = useState('')
  const [addingTemplateId, setAddingTemplateId] = useState('')
  const [addingDay, setAddingDay] = useState('')
  const [addingPlace, setAddingPlace] = useState('')
  // The action's own sentence about a day outside the gathering's span, kept apart from
  // `templateError` because it arrives WITH `success: true` and the two must never be rendered
  // in the same treatment. See the header.
  const [templateWarning, setTemplateWarning] = useState('')
  const [managingTaskId, setManagingTaskId] = useState('')
  const [isPending, startTransition] = useTransition()

  /**
   * The roster's display names, resolved ONCE against the whole roster.
   *
   * `disambiguatedName` scores a name against every other name it is shown beside, so scoring
   * it against a filtered subset would make two Martha Allens read as unambiguous at exactly
   * the moment a search had separated them. `PersonPicker` does its own scoring internally
   * against the same whole list; this map is for the table and the dialog's headings, and it
   * falls back to the name the server composed for a caller who was never handed a roster.
   */
  const memberNames = useMemo(
    () => new Map(members.map(m => [m.id, disambiguatedName(m, members)])),
    [members],
  )
  const nameOf = (person: { id: string; name: string } | null): string | null =>
    person ? memberNames.get(person.id) ?? person.name : null

  const detailsDirty = title.trim() !== gathering.title
    || summary.trim() !== (gathering.summary ?? '')
    || location.trim() !== (gathering.location ?? '')
    || startsOn !== gathering.startsOn
    || endsOn !== (gathering.endsOn ?? '')
    || status !== gathering.status

  function handleSaveDetails() {
    const nextTitle = title.trim()
    if (!nextTitle) { setDetailsError('A gathering needs a title'); return }
    if (!startsOn) { setDetailsError('Choose the date the gathering starts'); return }
    // Checked here as well as in the action, which reads the STORED row to compare a field the
    // form did not send. `gatherings_dates_ordered` is the boundary; this is the sentence.
    if (endsOn && endsOn < startsOn) {
      setDetailsError('The gathering cannot end before it starts')
      return
    }
    setDetailsError('')
    startTransition(async () => {
      const result = await updateGathering({
        gatheringId: gathering.id,
        title:       nextTitle,
        summary:     summary.trim() || null,
        location:    location.trim() || null,
        startsOn,
        endsOn:      endsOn || null,
        status,
      })
      if (!result.success) { setDetailsError(result.message ?? 'Could not save that gathering'); return }
      setTitle(nextTitle)
    })
  }

  function handlePremier(next: boolean) {
    setPremierError('')
    // Optimistic, and put back on refusal: this control IS the flag, so leaving it switched
    // after a failed write would be the screen lying about what the Dashboard will show.
    setIsPremier(next)
    startTransition(async () => {
      const result = await setGatheringPremier({ gatheringId: gathering.id, isPremier: next })
      if (!result.success) {
        setPremierError(result.message ?? 'Could not change that')
        setIsPremier(!next)
      }
    })
  }

  function handleAddTemplate() {
    if (!addingTemplateId) return
    setTemplateError('')
    setTemplateWarning('')
    const chosen = templates.find(t => t.id === addingTemplateId)
    // Read out of state BEFORE the transition and used for both the argument and the optimistic
    // row, so the row cannot end up describing a day or a place the write did not carry.
    const occursOn = addingDay || null
    const stated = addingPlace.trim() || null
    startTransition(async () => {
      const result = await addGatheringTemplate({
        gatheringId: gathering.id, templateId: addingTemplateId,
        occursOn, location: stated,
      })
      if (!result.success) { setTemplateError(result.message ?? 'Could not add that template'); return }
      setAddingTemplateId('')
      setAddingDay('')
      setAddingPlace('')
      // VERBATIM, and only when the action said something. A day outside the gathering's span is
      // saved and remarked on, never refused — the header has the argument, and the sentence is
      // the action's because the comparison is.
      if (result.warning) setTemplateWarning(result.warning)
      // The new tasks come with the refresh — they are instantiated server-side from the
      // template's steps, and inventing them here would be a second copy of that logic. The
      // place is `stated` and nothing else: there is no default left for the action to copy,
      // so an empty box here and an empty cell a moment later are the same fact.
      if (chosen) {
        setUsedTemplates(prev => [...prev, {
          id: chosen.id, name: chosen.name, occursOn, location: stated,
        }])
      }
      router.refresh()
    })
  }

  async function handleRemoveTemplate(template: { id: string; name: string }) {
    const ok = await confirm({
      title: 'Remove template',
      description: `Take “${template.name}” off this gathering? Its steps that nobody has been `
        + 'given yet are deleted. If any of them has been assigned or answered, nothing is '
        + 'removed and you will be told how many — reassign or approve those first.',
      confirmLabel: 'Remove template',
      destructive: true,
    })
    if (!ok) return
    setTemplateError('')
    startTransition(async () => {
      const result = await removeGatheringTemplate({
        gatheringId: gathering.id, templateId: template.id,
      })
      if (!result.success) {
        // Verbatim: the action refuses when any task from this template is assigned or
        // answered, and its sentence names how many and what to do about it.
        setTemplateError(result.message ?? 'Could not remove that template')
        return
      }
      setUsedTemplates(prev => prev.filter(t => t.id !== template.id))
      setTasks(prev => prev.filter(t => t.templateId !== template.id))
    })
  }

  async function handleDelete() {
    const ok = await confirm({
      title: 'Delete gathering',
      description: `Delete “${gathering.title}”? Every task on it goes with it, and so does `
        + 'every answer and note anybody has written. If it is simply not happening, set its '
        + 'status to Cancelled instead — nothing is lost and it can be reopened. This cannot '
        + 'be undone.',
      confirmLabel: 'Delete gathering',
      destructive: true,
    })
    if (!ok) return
    setDetailsError('')
    startTransition(async () => {
      const result = await deleteGathering(gathering.id)
      if (!result.success) {
        setDetailsError(result.message ?? 'Could not delete that gathering')
        return
      }
      router.push('/admin/gatherings')
    })
  }

  function patchTask(taskId: string, next: Partial<AdminGatheringTaskRow>) {
    setTasks(prev => prev.map(t => (t.id === taskId ? { ...t, ...next } : t)))
  }

  const managing = tasks.find(t => t.id === managingTaskId) ?? null
  const addable = templates.filter(t => !usedTemplates.some(u => u.id === t.id))

  /**
   * How many tasks each segment put on this gathering.
   *
   * Counted off `tasks` rather than asked of the server, because the two must agree and the task
   * table below is rendered from this same list — a figure fetched separately would disagree with
   * it the moment `removeGatheringTemplate` filtered a row out optimistically.
   *
   * A task whose `template_id` has gone NULL (the column is `ON DELETE SET NULL`, because a task
   * must outlive the template it was copied from) is in no segment's count and that is right: it
   * is still on the gathering, and the task table is where it shows.
   */
  const taskCountBySegment = useMemo(() => {
    const counts = new Map<string, number>()
    for (const task of tasks) {
      if (!task.templateId) continue
      counts.set(task.templateId, (counts.get(task.templateId) ?? 0) + 1)
    }
    return counts
  }, [tasks])

  return (
    <div className="space-y-8">
      {/* ── Who and when ─────────────────────────────────────────────────────────── */}
      <div className="space-y-3">
        {/* `next/link` for a static internal route — the lint rule that demands it is about
            the client-side transition, not about styling, so the explicit accent colour stays:
            `globals.css` paints every anchor `--brand-accent` anyway and being explicit is what
            keeps a future `className` from silently recolouring it. */}
        <Link href="/admin/gatherings" className="inline-flex items-center gap-1 text-sm text-brand-accent">
          <ArrowLeft className="h-3.5 w-3.5" /> Gathering Management
        </Link>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <h1 className="mb-1 text-3xl font-bold">{gathering.title}</h1>
            <p className="text-muted-foreground">
              {formatDateRange(gathering.startsOn, gathering.endsOn) ?? 'No dates yet'}
              {gathering.location && ` · ${gathering.location}`}
              {gathering.createdBy && ` · started by ${nameOf(gathering.createdBy)}`}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <GatheringStatusPill status={gathering.status} />
            {/* The marker, in the product's one styling for it — Warmth rather than gold, for
                the reason `GATHERING_PREMIER_PILL` records: it sits BESIDE the status pill on
                every screen that renders it, and gold is already what `scheduled` fills with. */}
            {isPremier && (
              <span className={GATHERING_PREMIER_PILL}>
                <Star className="h-3 w-3" aria-hidden="true" /> Premier
              </span>
            )}
            {/* `Link`, and only when the caller may open it. A raw `<a>` here was a full
                document load — the whole React tree discarded and the root layout re-run — and
                `/gatherings/[id]` gates on `gatherings:view`, its own key, which a family that
                restricts the member-facing list can withhold from an organizer. `buttonVariants`
                on a `Link` because `Button` renders a `<button>` and has no `asChild`; the
                variant supplies the text colour a link needs. */}
            {mayViewMemberPage && (
              <Link
                href={`/gatherings/${gathering.id}`}
                className={buttonVariants({ size: 'sm', variant: 'outline' })}
              >
                Member view
              </Link>
            )}
          </div>
        </div>
        {gathering.summary && <p className="max-w-3xl text-sm">{gathering.summary}</p>}
      </div>

      {/* ── Details ──────────────────────────────────────────────────────────────── */}
      {mayEdit ? (
        <section className="space-y-3 rounded-xl border bg-card p-4 sm:p-5">
          <div>
            <h2 className="text-lg">Details</h2>
            <p className="text-sm text-muted-foreground">
              Status is a statement rather than something the calendar works out: a gathering can
              be cancelled without moving its dates, and Complete is your word for it.
            </p>
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="gathering-title" required>Title</Label>
              <Input
                id="gathering-title"
                value={title}
                disabled={isPending}
                onChange={e => { setTitle(e.target.value); setDetailsError('') }}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="gathering-status">Status</Label>
              <Select
                id="gathering-status"
                value={status}
                disabled={isPending}
                onChange={e => setStatus(e.target.value as GatheringStatus)}
              >
                {GATHERING_STATUSES.map(s => (
                  <option key={s} value={s}>{GATHERING_STATUS_LABEL[s]}</option>
                ))}
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="gathering-starts" required>Starts</Label>
              <Input
                id="gathering-starts" type="date"
                value={startsOn}
                disabled={isPending}
                onChange={e => { setStartsOn(e.target.value); setDetailsError('') }}
              />
            </div>
            <div className="space-y-1.5">
              {/* `min` IS THE START DATE — added 2026-08-20 across every start/end pair in the
                  app. `gatherings_dates_ordered` refuses `ends_on < starts_on` in the database
                  and the action turns that 23514 into a sentence, which is the right boundary
                  and the wrong first line of defence: a picker that greys out the impossible
                  days never produces one, so nobody meets the refusal at all. The CHECK stays
                  underneath for a caller that is not this form. */}
              <Label htmlFor="gathering-ends">Ends</Label>
              <Input
                id="gathering-ends" type="date"
                min={startsOn || undefined}
                value={endsOn}
                disabled={isPending}
                onChange={e => { setEndsOn(e.target.value); setDetailsError('') }}
              />
              <p className="text-xs text-muted-foreground">Leave empty for a single day.</p>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="gathering-location">Location</Label>
              <Input
                id="gathering-location"
                value={location}
                disabled={isPending}
                onChange={e => setLocation(e.target.value)}
              />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="gathering-summary">Summary</Label>
            <Textarea
              id="gathering-summary"
              autoGrow rows={1}
              value={summary}
              disabled={isPending}
              onChange={e => setSummary(e.target.value)}
            />
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button disabled={!detailsDirty || isPending} onClick={handleSaveDetails}>
              {isPending ? 'Saving…' : 'Save changes'}
            </Button>
            {mayDelete && (
              <Button variant="destructive" disabled={isPending} onClick={handleDelete}>
                <Trash2 className="h-4 w-4" /> Delete gathering
              </Button>
            )}
          </div>
          <FormError message={detailsError} />
        </section>
      ) : (
        <div className="rounded-xl border bg-muted/40 px-4 py-3 text-sm text-muted-foreground">
          You can see this gathering’s plan but not change it.
        </div>
      )}

      {/* ── Premier ──────────────────────────────────────────────────────────────── */}
      {mayEdit && (
        <section className="space-y-2 rounded-xl border bg-card p-4 sm:p-5">
          <h2 className="text-lg">Dashboard band</h2>
          <label className="flex cursor-pointer items-center gap-2 select-none">
            <input
              type="checkbox"
              checked={isPremier}
              disabled={isPending}
              onChange={e => handlePremier(e.target.checked)}
              className="h-4 w-4 rounded border-input accent-primary"
            />
            <span className="text-sm font-medium">Show this across the top of the Dashboard</span>
          </label>
          <p className="text-sm text-muted-foreground">
            Several gatherings may be flagged at once — the Dashboard shows the soonest one that
            has not finished yet, so last year’s reunion never blocks this year’s. Nothing
            appears there when no flagged gathering is still upcoming.
          </p>
          <FormError message={premierError} />
        </section>
      )}

      {/* ── Money ────────────────────────────────────────────────────────────────── */}
      {budget && (
        <section className="space-y-4 rounded-xl border bg-card p-4 sm:p-5">
          <div>
            {/* ONE OF THREE PLACED HELP LINKS IN THE FEATURE. `gathering-management#money` is
                the paragraph an organizer standing here needs and would not go looking for:
                that a budget needs a fund before it can be set at all, that several gatherings
                may draw on one fund and the band counts the others, and that nothing here is a
                payment — no ledger row is written by any control on this screen.

                THERE ARE DELIBERATELY TWO QUESTION MARKS IN THIS PANEL, ~10 lines apart, and
                that is a judgement rather than an oversight. `BudgetBand` below carries its own
                link to `gatherings#budget`, which explains what the four FIGURES mean, and it
                carries it on both screens that render it because the band is one component with
                one reading (see its header). This one explains what an organizer may SET and
                what happens when they do. Different questions, different chapters, and the
                alternative — a prop that suppresses the band's link here — would make the band
                render differently on the two screens, which is the one thing it must not do.

                `icon`: the words would compete with the heading, and the lede under it is
                already carrying a sentence. */}
            <div className="flex items-center gap-1">
              <h2 className="text-lg">Fund and budget</h2>
              <HelpLink
                slug="gathering-management"
                section="money"
                label="How a gathering's fund and budget work"
              />
            </div>
            <p className="text-sm text-muted-foreground">
              A budget is always drawn on a fund, and it may exceed what that fund holds — the
              figures say so rather than refusing it, because a family plans a reunion before it
              has raised the money for one.
            </p>
          </div>
          {/* Read-only, and shared with the member-facing gathering page so the two cannot
              disagree about what the money says. */}
          {/* `budgetState`, not `budget !== null`: a failed money read is not a withheld one,
              and this screen is the sharper case of the two because its caller holds the console
              and expects the figures to be there. */}
          <BudgetBand budget={budget} state={gathering.budgetState} />
          {mayEdit && (
            <BudgetForm
              gatheringId={gathering.id}
              budget={budget}
              funds={funds}
              mayViewAccounting={mayViewAccounting}
              onSaved={next => setBudget(next)}
            />
          )}
        </section>
      )}

      {/* ── Segments ─────────────────────────────────────────────────────────────── */}
      <section className="space-y-3 rounded-xl border bg-card p-4 sm:p-5">
        <div>
          <h2 className="text-lg">Segments</h2>
          <p className="text-sm text-muted-foreground">
            A gathering is made of parts, and each is an occasion of its own: a reunion is the
            Welcome, the Picnic and the Send Off, on their own days in their own places. Every
            template you add is one of those, and its steps become tasks here. Nothing about the
            template reaches the tasks already on this gathering — each one keeps its own copy of
            what it asked.
          </p>
        </div>
        {usedTemplates.length === 0 ? (
          <p className="rounded-xl border bg-muted/40 px-4 py-6 text-sm text-muted-foreground">
            No templates are linked to this gathering, so it has no segments yet.
          </p>
        ) : (
          /* `overflow-visible` and NO `min-w-*` floor: the table folds on a phone rather than
             scrolling sideways (AGENTS.md, "On a phone a table narrows"), and there is no
             absolutely positioned menu in a row here to be clipped. */
          <div className="overflow-visible rounded-xl border">
            <table className="w-full border-collapse text-sm">
              <thead>
                <tr className="border-b bg-muted/40 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  <th scope="col" className="px-3 py-2 font-semibold">Segment</th>
                  {/* Day, Place and Tasks fold, and each `<th>` folds WITH its cells — hide the
                      cells and leave the headings and every remaining cell is announced under the
                      wrong column. Both halves of the day and the place are the same control
                      rendered twice; see `SegmentRow`. */}
                  <th scope="col" className={cn('px-3 py-2 font-semibold', COLLAPSING_CELL)}>Day</th>
                  <th scope="col" className={cn('px-3 py-2 font-semibold', COLLAPSING_CELL)}>Place</th>
                  <th scope="col" className={cn('px-3 py-2 text-right font-semibold', COLLAPSING_CELL)}>Tasks</th>
                  <th scope="col" className="px-3 py-2 font-semibold"><span className="sr-only">Actions</span></th>
                </tr>
              </thead>
              <tbody>
                {usedTemplates.map(segment => (
                  <SegmentRow
                    // Keyed by the template id, which is per-family — so switching family
                    // replaces the ids and React remounts every row, and a half-typed place
                    // cannot go on describing the family the organizer just left.
                    key={segment.id}
                    gatheringId={gathering.id}
                    segment={segment}
                    taskCount={taskCountBySegment.get(segment.id) ?? 0}
                    mayEdit={mayEdit}
                    onSaved={next => setUsedTemplates(prev =>
                      prev.map(u => (u.id === segment.id ? { ...u, ...next } : u)))}
                    onRemove={() => handleRemoveTemplate(segment)}
                  />
                ))}
              </tbody>
            </table>
          </div>
        )}
        {mayEdit && addable.length > 0 && (
          <div className="space-y-2 border-t pt-4">
            <div className="flex flex-wrap items-end gap-2">
              <div className="min-w-0 flex-1 space-y-1.5 sm:max-w-xs">
                <Label htmlFor="add-template">Add another segment</Label>
                <Select
                  id="add-template"
                  value={addingTemplateId}
                  disabled={isPending}
                  onChange={e => {
                    const chosenId = e.target.value
                    setAddingTemplateId(chosenId)
                    setTemplateError('')
                    setTemplateWarning('')
                    // CLEARED, not pre-filled. It used to seed from the template's usual place;
                    // that column is gone (see `TemplateOption`), and clearing is what stops a
                    // place typed for one template silently following the organizer to the next
                    // one they pick.
                    setAddingPlace('')
                  }}
                >
                  <option value="">— Choose a template —</option>
                  {addable.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                </Select>
              </div>
              <div className="min-w-0 space-y-1.5 sm:w-44">
                <Label htmlFor="add-template-day">Day</Label>
                {/* `type="date"` over a bare `YYYY-MM-DD` string, which is what the column holds
                    and what the action validates — no `Date` is constructed on either side of
                    the wire. */}
                <Input
                  id="add-template-day" type="date"
                  value={addingDay}
                  disabled={isPending || !addingTemplateId}
                  onChange={e => { setAddingDay(e.target.value); setTemplateError('') }}
                />
              </div>
              <div className="min-w-0 flex-1 space-y-1.5 sm:max-w-xs">
                <Label htmlFor="add-template-place">Place</Label>
                <Input
                  id="add-template-place"
                  placeholder="The template’s usual place"
                  value={addingPlace}
                  disabled={isPending || !addingTemplateId}
                  onChange={e => { setAddingPlace(e.target.value); setTemplateError('') }}
                />
              </div>
              <Button variant="affirm" disabled={!addingTemplateId || isPending} onClick={handleAddTemplate}>
                <Plus className="h-4 w-4" /> {isPending ? 'Adding…' : 'Add its steps'}
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              Both are optional. Leave the day empty for a gathering that happens all at once, and
              the place empty to use whatever the template usually uses.
            </p>
          </div>
        )}
        {/* WITHHELD, NOT DESTRUCTIVE, and not a `FormError`: this arrives beside `success: true`
            and the write has landed. See the header. */}
        {templateWarning && (
          <p className="text-sm text-brand-withheld">{templateWarning}</p>
        )}
        <FormError message={templateError} />
      </section>

      {/* ── Tasks ────────────────────────────────────────────────────────────────── */}
      <section className="space-y-3">
        <div>
          <h2 className="text-lg">Tasks</h2>
          <p className="text-sm text-muted-foreground">
            {gathering.taskCounts.total === 0
              ? 'No tasks yet. Add a template above and its steps become tasks here.'
              : `${gathering.taskCounts.approved} of ${gathering.taskCounts.total} approved`
                + (gathering.taskCounts.submitted > 0 ? ` · ${gathering.taskCounts.submitted} waiting for review` : '')
                + (gathering.taskCounts.denied > 0 ? ` · ${gathering.taskCounts.denied} sent back` : '')}
          </p>
        </div>

        {tasks.length > 0 && (
          <div className="overflow-visible rounded-xl border">
            <table className="w-full border-collapse text-sm">
              <thead>
                <tr className="border-b bg-muted/40 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  <th scope="col" className="px-3 py-2 font-semibold">Task</th>
                  <th scope="col" className={cn('px-3 py-2 font-semibold', COLLAPSING_CELL)}>Assigned to</th>
                  <th scope="col" className={cn('px-3 py-2 font-semibold', COLLAPSING_CELL)}>Due</th>
                  {mayManageBudget && (
                    <th scope="col" className={cn('px-3 py-2 text-right font-semibold', COLLAPSING_CELL)}>Budget</th>
                  )}
                  <th scope="col" className="px-3 py-2 font-semibold">Status</th>
                  <th scope="col" className="px-3 py-2 font-semibold"><span className="sr-only">Actions</span></th>
                </tr>
              </thead>
              <tbody>
                {tasks.map(task => {
                  const assignee = nameOf(task.assignee)
                  return (
                    <tr key={task.id} className="border-b align-top last:border-0 sm:align-middle">
                      <td className="px-3 py-2.5">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-medium">{task.label}</span>
                          {task.required && (
                            <span className={cn(GATHERING_PILL_SHAPE, 'bg-brand-soft text-brand-on-soft')}>
                              Required
                            </span>
                          )}
                        </div>
                        {task.helpText && (
                          <p className="mt-0.5 text-xs text-muted-foreground">{task.helpText}</p>
                        )}
                        {task.status === 'approved' && (
                          // A `<div>` rather than a `<p>`: `AnswerText` owns its own element,
                          // and a block inside a paragraph is invalid HTML that browsers unnest.
                          <div className="mt-0.5 text-xs text-muted-foreground">
                            <AnswerText kind={task.kind} answer={task.answer} />
                          </div>
                        )}
                        <RowMeta className="gap-x-2">
                          <MetaIf value={assignee ?? 'Nobody yet'} />
                          {task.dueOn && <MetaDot />}
                          <MetaIf value={task.dueOn ? `due ${formatDate(task.dueOn)}` : null} />
                          {mayManageBudget && task.budgetCents != null && (
                            <>
                              <MetaDot />
                              <MetaIf value={formatCurrency(task.budgetCents)} />
                            </>
                          )}
                        </RowMeta>
                      </td>
                      <td className={cn('px-3 py-2.5', COLLAPSING_CELL)}>
                        {assignee ?? <span className="text-muted-foreground">Nobody yet</span>}
                      </td>
                      <td className={cn('px-3 py-2.5 text-muted-foreground', COLLAPSING_CELL)}>
                        {task.dueOn ? formatDate(task.dueOn) : '—'}
                      </td>
                      {mayManageBudget && (
                        <td className={cn('px-3 py-2.5 text-right tabular-nums', COLLAPSING_CELL)}>
                          {task.budgetCents == null
                            ? <span className="text-muted-foreground">—</span>
                            : formatCurrency(task.budgetCents)}
                        </td>
                      )}
                      <td className="px-3 py-2.5">
                        <TaskStatusPill status={task.status} />
                      </td>
                      <td className="w-px px-3 py-2.5">
                        <div className="flex items-center justify-end">
                          <Button
                            size="sm"
                            variant={task.status === 'submitted' ? 'affirm' : 'outline'}
                            disabled={isPending}
                            onClick={() => { setTaskError(''); setManagingTaskId(task.id) }}
                          >
                            {task.status === 'submitted' ? 'Review' : mayEdit ? 'Manage' : 'Open'}
                          </Button>
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
        <FormError message={taskError} />
      </section>

      {managing && (
        // Keyed by the task, so opening a different row remounts the dialog and its drafts are
        // seeded from that task rather than carrying the last one's.
        <TaskDialog
          key={managing.id}
          task={managing}
          gatheringTitle={gathering.title}
          members={members}
          memberNames={memberNames}
          mayEdit={mayEdit}
          mayManageBudget={mayManageBudget}
          onClose={() => setManagingTaskId('')}
          onPatch={next => patchTask(managing.id, next)}
        />
      )}
    </div>
  )
}

// ── One segment ──────────────────────────────────────────────────────────────────────

/**
 * ONE PART OF THE GATHERING: the template it came from, the day it happens on, the place it is
 * held, and how many tasks it put on the board.
 *
 * ── IT IS ITS OWN COMPONENT FOR ITS OWN `useTransition` ─────────────────────────────
 * The parent holds one `isPending` covering the details form, the premier flag and the template
 * list, which is right for controls that are alternatives to each other. Segments are not: an
 * organizer fixing three days in a row would watch each save grey out the other two rows,
 * including the boxes they had already typed into. One transition per row is one save per row.
 *
 * ── THE DAY AND THE PLACE ARE ONE CONTROL EACH, RENDERED TWICE ──────────────────────
 * Both columns fold below `sm`, and AGENTS.md is exact about what that costs: "a column holding
 * a CONTROL folds by moving the control, not by describing it", or the field goes read-only on a
 * phone. So each input is assigned to a variable and rendered in two places — once in the first
 * cell's `<RowMeta>` and once in its own `COLLAPSING_CELL` `<td>`. Both copies are in the DOM,
 * only one is ever visible or focusable, and both are bound to the same state, so they cannot
 * disagree. Neither carries an `id` (two elements cannot share one) and both carry an
 * `aria-label` naming the segment, since the heading that named the column has folded away.
 *
 * ── `useServerState`, AND ON THE PRIMITIVES ─────────────────────────────────────────
 * `setGatheringSegment` ends in a `revalidateGathering`, and `router.refresh()` merges the new
 * payload WITHOUT discarding client state — so a plain `useState` seed would be read once and
 * every later server value ignored, which is the row still showing yesterday's date after
 * somebody else moved the picnic. It adopts by identity, which is why these hold the two STRINGS
 * rather than the segment object: an object prop is a fresh reference on every server render and
 * would discard a half-typed place on any unrelated refresh.
 *
 * ── SAVE SENDS BOTH FIELDS, ALWAYS ─────────────────────────────────────────────────
 * `setGatheringSegment` reads an absent key as "leave it alone" and an explicit `null` as "clear
 * it", which is what lets a future screen offer one field without wiping the other. This one
 * offers both in one row under one button, so both are sent every time — an emptied box has to
 * reach the action as `null` or clearing a day would be impossible, and "nothing to change" is
 * unreachable because the button only appears once something differs.
 */
function SegmentRow({
  gatheringId, segment, taskCount, mayEdit, onSaved, onRemove,
}: {
  gatheringId: string
  segment: { id: string; name: string; occursOn: string | null; location: string | null }
  taskCount: number
  mayEdit: boolean
  onSaved: (next: { occursOn: string | null; location: string | null }) => void
  onRemove: () => void
}) {
  const [day, setDay] = useServerState(segment.occursOn ?? '')
  const [place, setPlace] = useServerState(segment.location ?? '')
  const [error, setError] = useState('')
  // The action's sentence about a day outside the gathering's span. Held apart from `error`
  // because it arrives with `success: true`: the save landed, and there is a date to reconcile.
  const [warning, setWarning] = useState('')
  const [isPending, startTransition] = useTransition()

  const dirty = day !== (segment.occursOn ?? '') || place.trim() !== (segment.location ?? '')

  function handleSave() {
    const nextOccursOn = day || null
    const nextLocation = place.trim() || null
    setError('')
    setWarning('')
    startTransition(async () => {
      const result = await setGatheringSegment({
        gatheringId, templateId: segment.id,
        occursOn: nextOccursOn, location: nextLocation,
      })
      if (!result.success) {
        setError(result.message ?? 'Could not save that segment')
        return
      }
      // VERBATIM AND UNCONDITIONALLY WHEN PRESENT. The comparison against the gathering's span
      // lives in the action beside the write; a copy of it here would be a second answer, and
      // the one that drifts is always the copy.
      if (result.warning) setWarning(result.warning)
      onSaved({ occursOn: nextOccursOn, location: nextLocation })
    })
  }

  // ── The two controls, each rendered in the meta line AND in its own folding cell ──
  // Only these two. The name and the count are rendered once, in the cell that never folds, so
  // neither is hoisted into a variable — a variable in this file now MEANS "used in both places".
  const dayControl = mayEdit ? (
    <Input
      type="date"
      className="h-7 w-full sm:w-40"
      value={day}
      disabled={isPending}
      aria-label={`The day “${segment.name}” happens on`}
      onChange={e => { setDay(e.target.value); setError(''); setWarning('') }}
    />
  ) : (
    // An em-dash holds the grid open in a COLUMN; the meta line below simply omits what is not
    // there, which is why the read-only branch is the one place the two copies differ.
    <span className="text-muted-foreground">{formatDate(segment.occursOn) ?? '—'}</span>
  )

  const placeControl = mayEdit ? (
    <Input
      className="h-7 w-full"
      value={place}
      disabled={isPending}
      placeholder="Not stated"
      aria-label={`Where “${segment.name}” is held`}
      onChange={e => { setPlace(e.target.value); setError('') }}
    />
  ) : (
    <span className="text-muted-foreground">{segment.location || '—'}</span>
  )

  return (
    <tr className="border-b align-top last:border-0 sm:align-middle">
      <td className="px-3 py-2.5">
        <span className="font-medium">{segment.name || 'Template'}</span>
        {/* THE COUNT, which is the segment's own share of the task table below. It is here as
            well as in its folding column because it is the one figure that says whether adding
            this template actually put any work on the board. */}
        <p className="mt-0.5 text-xs text-muted-foreground">
          {taskCount === 0
            ? 'No tasks from this one'
            : `${taskCount} ${taskCount === 1 ? 'task' : 'tasks'}`}
        </p>
        {/* THE CONTROLS THEMSELVES, not a description of them — the folded `<td>` is
            `display: none` and takes its input out of the accessibility tree with it, so a meta
            line that merely named the day would leave the field unreachable on a phone.
            LABELLED, for the same reason the step table's meta line labels its three: the
            heading that told a date box from a place box is not in the document at all down
            here. STACKED rather than in a row, and with no `MetaDot` — two full-width boxes side
            by side at 390px are two boxes nobody can type in, and an interpunct between two
            stacked lines reads as a bullet rather than as a separator. */}
        <RowMeta className="flex-col items-stretch gap-2">
          <span className="flex items-center gap-1.5">
            <span className="w-10 shrink-0">Day</span>{dayControl}
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-10 shrink-0">Place</span>{placeControl}
          </span>
        </RowMeta>
        {warning && <p className="mt-1 text-xs text-brand-withheld">{warning}</p>}
        <FormError message={error} className="mt-1" />
      </td>
      <td className={cn('px-3 py-2.5', COLLAPSING_CELL)}>{dayControl}</td>
      <td className={cn('px-3 py-2.5', COLLAPSING_CELL)}>{placeControl}</td>
      <td className={cn('px-3 py-2.5 text-right tabular-nums', COLLAPSING_CELL)}>{taskCount}</td>
      <td className="w-px px-3 py-2.5">
        <div className="flex items-center justify-end gap-1">
          {mayEdit && dirty && (
            <Button size="sm" disabled={isPending} onClick={handleSave}>
              {isPending ? 'Saving…' : 'Save'}
            </Button>
          )}
          {/* REMOVAL RUNS IN THE PARENT'S TRANSITION, not this row's: unlinking a template also
              prunes the tasks it put on the gathering, and that list lives up there. So this
              button's `disabled` is about this row's own save being in flight — pressing Remove
              while a day is being written would leave the confirmation dialog asking about a
              segment whose write has not landed. */}
          {mayEdit && (
            <button
              type="button"
              disabled={isPending}
              className="rounded-full p-1 text-destructive hover:bg-destructive/10 disabled:opacity-50"
              title={`Remove ${segment.name} from this gathering`}
              aria-label={`Remove ${segment.name} from this gathering`}
              onClick={onRemove}
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
      </td>
    </tr>
  )
}

// ── The budget form ──────────────────────────────────────────────────────────────────

/**
 * The fund and the amount, saved TOGETHER.
 *
 * `gatherings_budget_needs_fund` is a constraint over the pair, so there is an order in which
 * saving them one at a time leaves the row invalid — clear the fund first and the CHECK refuses
 * a budget that was already there. `setGatheringBudget` takes both for that reason, and this
 * form posts both every time.
 *
 * The amount box is disabled with no fund chosen, which mirrors the same constraint as a
 * sentence instead of a 23514 naming something the reader has never heard of.
 */
function BudgetForm({
  gatheringId, budget, funds, mayViewAccounting, onSaved,
}: {
  gatheringId: string
  budget: GatheringBudgetView
  funds: FundOption[]
  /** Whether the "no fund yet" sentence may link to Accounting. See `Props`. */
  mayViewAccounting: boolean
  onSaved: (next: GatheringBudgetView) => void
}) {
  const [fundId, setFundId] = useServerState(budget.fundId ?? '')
  const [amount, setAmount] = useServerState(
    budget.budgetCents == null ? '' : (budget.budgetCents / 100).toFixed(2),
  )
  const [error, setError] = useState('')
  const [isPending, startTransition] = useTransition()

  function handleSave() {
    setError('')
    const budgetCents = fundId && amount.trim() !== '' ? dollarsToCents(amount) : null
    startTransition(async () => {
      const result = await setGatheringBudget({
        gatheringId, fundId: fundId || null, budgetCents,
      })
      if (!result.success) { setError(result.message ?? 'Could not save that budget'); return }
      const fund = funds.find(f => f.id === fundId) ?? null
      const fundChanged = (fundId || null) !== budget.fundId
      onSaved({
        ...budget,
        fundId:           fundId || null,
        fundName:         fund?.name ?? null,
        // The balance comes from the fund the picker offered, which is the same figure
        // `fund_balance_cents` produced for the page. A fund we have no row for leaves it
        // null, and `gatheringBudgetMath` reads null as "unknown" and draws no red line —
        // which is the only safe answer, because "not read" is not "overspent".
        fundBalanceCents: fund ? fund.balanceCents : null,
        // ZEROED WHEN THE FUND MOVED, for the same reason and it is not the same field.
        // `otherCommittedCents` was computed by `budgetsFor` against the fund that has just
        // been REPLACED, and `gatheringBudgetMath` derives `totalCommittedCents` and
        // `overFundWithOthers` from it — so carrying it across makes the band alarm about the
        // NEW fund using the old fund's claims ("Other live gatherings already claim $8,000 of
        // the same fund") when the new one may have none at all. 0 is the field's documented
        // "unknown" value and suppresses that second sentence rather than asserting a false
        // one; `setGatheringBudget`'s `revalidateGathering` supplies the real figure moments
        // later. The adjacent field was already handled this way and this one was missed.
        otherCommittedCents: fundChanged ? 0 : budget.otherCommittedCents,
        budgetCents,
      })
    })
  }

  if (funds.length === 0) {
    return (
      <p className="rounded-lg border border-dashed px-3 py-2 text-xs text-muted-foreground">
        There is no active fund to draw a budget on.{' '}
        {/* `/admin/accounting` is a different key, and the money and the gatherings are exactly the
            two jobs a family splits — so an organizer with no Accounting grant would be sent
            from here to a 404. Unlinked words in that case; the sentence still says what has to
            happen and who it needs. */}
        {mayViewAccounting
          ? <>Create one under <Link href="/admin/accounting?section=funds">Accounting</Link> and it becomes available here.</>
          : <>Somebody who runs the family&rsquo;s Accounting has to create one, and it becomes available here.</>}
      </p>
    )
  }

  return (
    <div className="space-y-3 border-t pt-4">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="budget-fund">Fund</Label>
          <Select
            id="budget-fund"
            value={fundId}
            disabled={isPending}
            onChange={e => { setFundId(e.target.value); setError('') }}
          >
            <option value="">— No fund —</option>
            {funds.map(f => (
              <option key={f.id} value={f.id}>{f.name} — {formatCurrency(f.balanceCents)}</option>
            ))}
          </Select>
          <p className="text-xs text-muted-foreground">
            Several gatherings may draw on one fund. Clearing the fund clears the budget with it.
          </p>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="budget-amount">Budget ($)</Label>
          <Input
            id="budget-amount"
            type="number" min="0" step="0.01"
            placeholder={fundId ? 'No budget set' : 'Choose a fund first'}
            value={amount}
            disabled={isPending || !fundId}
            onChange={e => setAmount(e.target.value)}
          />
        </div>
      </div>
      <Button disabled={isPending} onClick={handleSave}>
        {isPending ? 'Saving…' : 'Save budget'}
      </Button>
      <FormError message={error} />
    </div>
  )
}

// ── One task ─────────────────────────────────────────────────────────────────────────

/**
 * Everything about one task in one dialog: who is doing it, when it is due, what it may spend,
 * and — depending on where it has got to — the ruling on an answer that is waiting, or the way to
 * take back one that was approved.
 *
 * The submissions are the audit trail, newest first. A denial keeps its own `review_notes` and a
 * resubmission is a NEW row rather than an edit of the refused one, so the whole exchange is
 * readable here rather than only its last line. A REOPEN adds nothing to that trail and removes
 * nothing from it — the trail records what was submitted and ruled on, and a reopen is a fact
 * about the task instead.
 *
 * The two decision blocks are mutually exclusive by status and that is deliberate: `'submitted'`
 * gets Approve / Send back, `'approved'` gets Reopen, and the other two get neither because they
 * are already with the member. Both actions refuse the wrong status server-side, so the point of
 * matching them here is that nobody is offered a button that will be refused.
 */
function TaskDialog({
  task, gatheringTitle, members, memberNames, mayEdit, mayManageBudget, onClose, onPatch,
}: {
  task: AdminGatheringTaskRow
  gatheringTitle: string
  members: SelectablePerson[]
  memberNames: Map<string, string>
  mayEdit: boolean
  mayManageBudget: boolean
  onClose: () => void
  onPatch: (next: Partial<AdminGatheringTaskRow>) => void
}) {
  const confirm = useConfirm()
  const [assigneeId, setAssigneeId] = useState(task.assignee?.id ?? '')
  const [dueOn, setDueOn] = useState(task.dueOn ?? '')
  const [amount, setAmount] = useState(
    task.budgetCents == null ? '' : (task.budgetCents / 100).toFixed(2),
  )
  const [sendingBack, setSendingBack] = useState(false)
  const [notes, setNotes] = useState('')
  const [notesError, setNotesError] = useState('')
  // The reopen panel is opened by a link rather than standing open, because reopening an answer
  // the family has already signed off is rare and the reason box would otherwise sit under every
  // approved task inviting somebody to undo one.
  const [reopening, setReopening] = useState(false)
  const [reason, setReason] = useState('')
  const [error, setError] = useState('')
  const [isPending, startTransition] = useTransition()

  const nameFor = (id: string): string | null =>
    id ? memberNames.get(id) ?? null : null

  const assignmentDirty = assigneeId !== (task.assignee?.id ?? '') || dueOn !== (task.dueOn ?? '')
  const nextLineCents = amount.trim() === '' ? null : dollarsToCents(amount)
  const budgetDirty = nextLineCents !== task.budgetCents
  const latest = task.submissions[0] ?? null

  function handleSaveAssignment() {
    setError('')
    startTransition(async () => {
      const result = await assignGatheringTask({
        taskId:     task.id,
        assigneeId: assigneeId || null,
        dueOn:      dueOn || null,
      })
      if (!result.success) { setError(result.message ?? 'Could not save that'); return }
      onPatch({
        assignee: assigneeId
          ? { id: assigneeId, name: nameFor(assigneeId) ?? '' }
          : null,
        dueOn: dueOn || null,
      })
    })
  }

  function handleSaveBudget() {
    setError('')
    startTransition(async () => {
      const result = await setGatheringTaskBudget({ taskId: task.id, budgetCents: nextLineCents })
      if (!result.success) { setError(result.message ?? 'Could not save that budget line'); return }
      onPatch({ budgetCents: nextLineCents })
    })
  }

  async function handleApprove() {
    const ok = await confirm({
      title: 'Approve this answer',
      description: `Approve “${task.label}” on ${gatheringTitle}? Approving is final — it `
        + 'becomes the family’s record of it and the person who submitted it cannot change it '
        + 'afterwards. Send it back instead if anything still needs work.',
      confirmLabel: 'Approve',
    })
    if (!ok) return
    setError('')
    startTransition(async () => {
      const result = await reviewGatheringTask({ taskId: task.id, decision: 'approved' })
      if (!result.success) { setError(result.message ?? 'Could not approve that answer'); return }
      onPatch({ status: 'approved' })
      onClose()
    })
  }

  function handleSendBack() {
    const trimmed = notes.trim()
    // Required here as well as in the action. Being refused after deciding to hand something
    // back is the worst moment to discover the notes were the whole point of doing so.
    if (!trimmed) {
      setNotesError('Say what needs to change — this is what they read before trying again.')
      return
    }
    setNotesError('')
    setError('')
    startTransition(async () => {
      const result = await reviewGatheringTask({
        taskId: task.id, decision: 'denied', reviewNotes: trimmed,
      })
      if (!result.success) { setError(result.message ?? 'Could not send that task back'); return }
      onPatch({ status: 'denied' })
      onClose()
    })
  }

  /**
   * Take an approval back, so the assignee can change their answer.
   *
   * The reason is OPTIONAL here because `reopenGatheringTask` makes it optional — a wrong
   * approval sometimes needs no explaining, and demanding notes for one would be the mirror of
   * the mistake `Send back` fixes. It is offered all the same, and it travels to the member in
   * the same bell entry a send-back uses, because from their side the two are one event: the task
   * is theirs again and there may be a reason attached.
   *
   * `useConfirm` and not a bare press: this is the one control on the screen that undoes a
   * decision the family has recorded, and the description says what survives it — the answer and
   * the whole trail — because a reader's fear is that reopening throws the work away.
   */
  async function handleReopen() {
    const trimmed = reason.trim()
    const ok = await confirm({
      title: 'Reopen this task',
      description: `Reopen “${task.label}” on ${gatheringTitle}? It goes back to `
        + `${task.assignee ? nameFor(task.assignee.id) ?? 'the person holding it' : 'nobody, because it is unassigned'}`
        + ', who can then change the answer and submit it again. Nothing is erased — their answer '
        + 'stays on the task as a starting point and every submission stays in the record.',
      confirmLabel: 'Reopen',
    })
    if (!ok) return
    setError('')
    startTransition(async () => {
      const result = await reopenGatheringTask({
        taskId: task.id,
        ...(trimmed ? { reason: trimmed } : {}),
      })
      if (!result.success) { setError(result.message ?? 'Could not reopen that task'); return }
      // The action clears both, so the local row must too or the card goes on printing
      // "Approved by … on …" under a task that is open again.
      onPatch({ status: 'open', decidedAt: null, decidedBy: null })
      onClose()
    })
  }

  return (
    <Dialog
      open
      onClose={onClose}
      title={task.label}
      description={task.helpText ?? undefined}
      className="max-w-lg"
    >
      <div className="mt-2 space-y-4">
        <div className="flex flex-wrap items-center gap-2">
          <TaskStatusPill status={task.status} />
          {task.required && (
            <span className={cn(GATHERING_PILL_SHAPE, 'bg-brand-soft text-brand-on-soft')}>
              Required
            </span>
          )}
          {task.templateName && (
            <span className="text-xs text-muted-foreground">from {task.templateName}</span>
          )}
        </div>

        {/* ── What has been answered ────────────────────────────────────────────── */}
        {task.status !== 'open' && (
          <div className="space-y-2 rounded-lg border bg-muted/40 px-3 py-2 text-sm">
            <p className="text-xs font-medium text-muted-foreground">
              {task.status === 'approved' ? 'The approved answer' : 'Their answer'}
            </p>
            <AnswerText kind={task.kind} answer={task.answer} />
            {latest?.note && (
              <p className="whitespace-pre-wrap text-xs text-muted-foreground">
                Their note: {latest.note}
              </p>
            )}
            {task.decidedAt && (
              <p className="text-xs text-muted-foreground">
                {task.status === 'approved' ? 'Approved' : 'Sent back'}
                {task.decidedBy && ` by ${memberNames.get(task.decidedBy.id) ?? task.decidedBy.name}`}
                {` on ${formatDate(task.decidedAt.slice(0, 10))}`}
              </p>
            )}
          </div>
        )}

        {task.submissions.length > 1 && (
          <details className="rounded-lg border px-3 py-2 text-sm">
            <summary className="cursor-pointer text-xs font-medium text-muted-foreground">
              Everything that has been submitted ({task.submissions.length})
            </summary>
            <ul className="mt-2 space-y-2">
              {task.submissions.map(submission => (
                <li key={submission.id} className="border-t pt-2 first:border-0 first:pt-0">
                  <p className="text-xs text-muted-foreground">
                    {formatDate(submission.createdAt.slice(0, 10))}
                    {submission.submittedBy && ` · ${memberNames.get(submission.submittedBy.id) ?? submission.submittedBy.name}`}
                    {submission.decision !== 'pending' && ` · ${submission.decision === 'approved' ? 'approved' : 'sent back'}`}
                  </p>
                  <AnswerText kind={task.kind} answer={submission.answer} />
                  {submission.reviewNotes && (
                    <p className="whitespace-pre-wrap text-xs text-brand-withheld">
                      Notes back: {submission.reviewNotes}
                    </p>
                  )}
                </li>
              ))}
            </ul>
          </details>
        )}

        {!mayEdit && (
          <div className="rounded-xl border bg-muted/40 px-4 py-3 text-sm text-muted-foreground">
            You can read this task but not assign it or rule on it.
          </div>
        )}

        {mayEdit && (
          <>
            {/* ── Who is doing it ───────────────────────────────────────────────── */}
            <div className="space-y-2">
              <PersonPicker
                people={members}
                value={assigneeId}
                onChange={setAssigneeId}
                label="Assigned to"
                hint="Anybody the family has approved, whether or not they have an account — a relative with no login can still be asked to bring the photographs."
                emptyMessage="Nobody in this family has been approved yet."
              />
              {assigneeId && (
                <Button
                  size="sm" variant="ghost" disabled={isPending}
                  onClick={() => setAssigneeId('')}
                >
                  Leave it unassigned
                </Button>
              )}
              <div className="space-y-1.5">
                <Label htmlFor={`due-${task.id}`}>Due</Label>
                <Input
                  id={`due-${task.id}`}
                  type="date"
                  value={dueOn}
                  disabled={isPending}
                  onChange={e => setDueOn(e.target.value)}
                />
              </div>
              <Button disabled={!assignmentDirty || isPending} onClick={handleSaveAssignment}>
                {isPending ? 'Saving…' : 'Save who and when'}
              </Button>
            </div>

            {/* ── What it may spend ─────────────────────────────────────────────── */}
            {mayManageBudget && (
              <div className="space-y-1.5 border-t pt-4">
                <Label htmlFor={`line-${task.id}`}>Budget line ($)</Label>
                <Input
                  id={`line-${task.id}`}
                  type="number" min="0" step="0.01"
                  placeholder="Nothing set"
                  value={amount}
                  disabled={isPending}
                  onChange={e => setAmount(e.target.value)}
                />
                <p className="text-xs text-muted-foreground">
                  What this one task is expected to cost. Empty means it costs the family
                  nothing. The lines together are what the band above compares to the budget.
                </p>
                <Button disabled={!budgetDirty || isPending} onClick={handleSaveBudget}>
                  {isPending ? 'Saving…' : 'Save budget line'}
                </Button>
              </div>
            )}

            {/* ── The ruling ────────────────────────────────────────────────────── */}
            {task.status === 'submitted' && (
              <div className="space-y-3 border-t pt-4">
                {/* Preflight resets `h3` size and weight to `inherit` and the base layer gives
                    it only a colour, so a class-less `<h3>` is body text in terracotta. */}
                <h3 className="text-sm font-semibold">Review</h3>
                {sendingBack && (
                  <div className="space-y-1.5">
                    <Label htmlFor={`notes-${task.id}`} required>What needs to change</Label>
                    <Textarea
                      id={`notes-${task.id}`}
                      autoGrow rows={2}
                      placeholder="The caterer needs a phone number as well as a name."
                      value={notes}
                      disabled={isPending}
                      onChange={e => { setNotes(e.target.value); setNotesError('') }}
                    />
                    <p className="text-xs text-muted-foreground">
                      Sent with the task to {nameFor(assigneeId) ?? 'whoever holds it'}. A task
                      handed back with no notes leaves them nothing to act on, which is why this
                      is required.
                    </p>
                    <FieldError message={notesError} />
                  </div>
                )}
                <div className="flex flex-wrap items-center gap-2">
                  <Button variant="affirm" disabled={isPending} onClick={handleApprove}>
                    {isPending ? 'Saving…' : 'Approve'}
                  </Button>
                  {sendingBack ? (
                    <>
                      <Button variant="outline" disabled={isPending} onClick={handleSendBack}>
                        {isPending ? 'Sending…' : 'Send back with notes'}
                      </Button>
                      <Button
                        variant="ghost" disabled={isPending}
                        onClick={() => { setSendingBack(false); setNotes(''); setNotesError('') }}
                      >
                        Cancel
                      </Button>
                    </>
                  ) : (
                    <Button variant="outline" disabled={isPending} onClick={() => setSendingBack(true)}>
                      Send back…
                    </Button>
                  )}
                </div>
              </div>
            )}

            {/* ── Taking an approval back ───────────────────────────────────────── */}
            {/* This is the control the member-facing copy has always promised:
                `submitGatheringTask` refuses an approved task with "Ask an organizer to reopen it
                if it needs to change", and until this shipped there was nothing here to press.
                It sits under the ruling block and appears only for an approved task, so the
                dialog offers exactly one decision at a time — `reopenGatheringTask` refuses
                anything that is not approved, and a button that is always visible and usually
                refused is worse than one that appears when it applies. */}
            {task.status === 'approved' && (
              <div className="space-y-3 border-t pt-4">
                <h3 className="text-sm font-semibold">This answer is approved</h3>
                <p className="text-xs text-muted-foreground">
                  It is the family’s record of {task.label.toLowerCase()} and the person who
                  submitted it cannot change it. Reopen it if it has to change — the answer and
                  every submission stay exactly as they are, and it goes back to them to edit.
                </p>
                {reopening && (
                  <div className="space-y-1.5">
                    <Label htmlFor={`reason-${task.id}`}>Why, if you want to say (optional)</Label>
                    <Textarea
                      id={`reason-${task.id}`}
                      autoGrow rows={2}
                      placeholder="The hall changed the booking, so the time needs redoing."
                      value={reason}
                      disabled={isPending}
                      onChange={e => setReason(e.target.value)}
                    />
                    <p className="text-xs text-muted-foreground">
                      Sent with the task to {task.assignee ? nameFor(task.assignee.id) ?? 'whoever holds it' : 'nobody — this task is unassigned, so nobody is told'}.
                    </p>
                  </div>
                )}
                <div className="flex flex-wrap items-center gap-2">
                  {reopening ? (
                    <>
                      <Button variant="outline" disabled={isPending} onClick={handleReopen}>
                        {isPending ? 'Reopening…' : 'Reopen'}
                      </Button>
                      <Button
                        variant="ghost" disabled={isPending}
                        onClick={() => { setReopening(false); setReason('') }}
                      >
                        Cancel
                      </Button>
                    </>
                  ) : (
                    <Button variant="outline" disabled={isPending} onClick={() => setReopening(true)}>
                      Reopen…
                    </Button>
                  )}
                </div>
              </div>
            )}
          </>
        )}

        <FormError message={error} />

        <div className="flex gap-2 pt-1">
          <Button variant="outline" className="flex-1" onClick={onClose} disabled={isPending}>
            Close
          </Button>
        </div>
      </div>
    </Dialog>
  )
}
