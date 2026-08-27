'use client'

import { useState, useTransition } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { CalendarDays, CirclePlus, ClipboardCheck, LayoutList, Star, Trash2 } from 'lucide-react'
import { Button, buttonVariants } from '@/components/ui/button'
import { Dialog } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { useConfirm } from '@/components/ui/confirm'
import { FormError, FieldError } from '@/components/ui/form-message'
import { COLLAPSING_CELL, RowMeta, MetaDot, MetaIf } from '@/components/ui/table-collapse'
import { MainRail } from '@/components/layout/MainRail'
import { AdminGatheringTemplatesClient } from '@/components/admin/AdminGatheringTemplatesClient'
import { ADMIN_GATHERING_PANES, type AdminGatheringPane } from '@/lib/gathering-panes'
import type { GatheringTemplate } from '@/app/actions/admin/gathering-templates'
import { GatheringStatusPill } from '@/components/gatherings/StatusPill'
import { AnswerText } from '@/components/gatherings/AnswerText'
import { GATHERING_PILL_SHAPE, GATHERING_PREMIER_PILL } from '@/components/gatherings/status'
import { formatWhenBrief } from '@/lib/gathering-when'
import { cn } from '@/lib/utils'
import { useServerState } from '@/lib/use-server-state'
import { formatDate, todayLocal } from '@/lib/date-utils'
import { formatCurrency, dollarsToCents } from '@/lib/currency-utils'
import { gatheringBudgetMath } from '@/lib/gathering-budget'
import type { TaskProgress } from '@/lib/gatherings'
import {
  createGathering, deleteGathering, reviewGatheringTask,
  type AdminGatheringRow, type ReviewQueueRow, type GatheringBudgetView,
} from '@/app/actions/admin/gatherings'
import { useIntlTag, useT } from '@/components/layout/LocaleProvider'
import type { T } from '@/lib/i18n/t'

/**
 * THE ORGANIZER CONSOLE — the gathering list and the review queue, on one `MainRail`.
 *
 * ── WHY THESE TWO PANES AND NOT TWO ROUTES ──────────────────────────────────────────
 * They are two views of one job: what the family is running, and what it is waiting on. An
 * organizer moves between them constantly — rule on three submissions, then look at whether
 * the reunion is still inside its budget — and a rail keeps that a click rather than a
 * navigation. Both items supply an `href`, so cmd-click, middle-click and copy-link-address
 * work and the pane is bookmarkable, while a plain left click is intercepted: a real
 * navigation would refetch the RSC payload and remount the pane, throwing away a half-typed
 * denial note (AGENTS.md, "The main rail is a standard component").
 *
 * ── EVERY INTERNAL DESTINATION IS `next/link`, INCLUDING THE ONES DRESSED AS BUTTONS ─
 * A raw `<a href>` to an in-app route is a full document load: the React tree is discarded, the
 * root layout re-runs server-side (auth plus `viewableResources()`) and the JS is downloaded
 * again. On the review queue that is not merely slow — the queue is a PANE of this component, so
 * following a raw anchor out of it throws away every half-typed denial note in every open
 * `ReviewCard`, which is the exact loss the rail's `href` interception above exists to prevent.
 * `buttonVariants` on a real `<Link>` is the house pattern for a link that looks like a button
 * (`Button` renders a `<button>` and has no `asChild`), and the variant carries its own text
 * colour, which an anchor needs because `globals.css` paints every bare `<a>` `--brand-accent`.
 * `eslint` catches none of this: `@next/next/no-html-link-for-pages` only fires for a `pages/`
 * directory.
 *
 * ── THE CREATE TRIGGER IS `affirm`, NEVER THE DEFAULT ───────────────────────────────
 * `--brand-primary` is exactly what an ACTIVE rail item looks like, so a primary button in the
 * rail's action slot reads as a third pane. Affirmative actions — create, record, pay — are
 * `--brand-affirm`.
 *
 * ── DENY DEMANDS NOTES, AND THE FORM DEMANDS THEM FIRST ─────────────────────────────
 * `reviewGatheringTask` refuses a denial with no `reviewNotes`, and that refusal is the
 * feature rather than validation: the notes ARE the instruction the member reads before
 * submitting again, and a task sent back with nothing in it stops dead — the relative is told
 * their answer was not accepted and no screen anywhere says what to change. So the Send-back
 * control opens a required notes box, says why it is required, and will not submit empty. The
 * action still checks; this is so nobody types a decision and is refused after committing to
 * it.
 *
 * ── APPROVING GOES THROUGH `useConfirm` AND DELETING GOES THROUGH IT DIFFERENTLY ────
 * Approval is IRREVERSIBLE on both sides — `submitGatheringTask` refuses an approved task and
 * says approved is final — so it is confirmed, without the destructive treatment, because
 * nothing is being destroyed. Deleting a gathering IS destructive (its tasks and every
 * submission cascade), so that one is `destructive: true` and names the consequence. The
 * action refuses outright once any answer has been approved and offers `'cancelled'` instead;
 * that sentence is surfaced verbatim.
 */

/**
 * THE PANE IDS LIVE IN `lib/gathering-panes.ts`, not here.
 *
 * This file is `'use client'`, and the PAGE has to validate `?pane=` before it decides what to
 * fetch. A Server Component importing a runtime value out of a client module gets a client
 * REFERENCE rather than the value — `/community/announcements` rendered its error boundary on exactly
 * that, `ANNOUNCEMENT_PANES.includes is not a function` — so ids and order are pure data and
 * only the ICONS and LABELS, which are client concerns, are here.
 */
function paneLabel(t: T): Record<AdminGatheringPane, string> {
  return {
    gatherings: t('agat.pane.gatherings'),
    queue:      t('agat.pane.queue'),
    templates:  t('agat.pane.templates'),
  }
}

const PANE_ICON = {
  gatherings: CalendarDays,
  queue:      ClipboardCheck,
  templates:  LayoutList,
} as const

interface TemplateOption {
  id: string
  name: string
  description: string | null
}

interface FundOption {
  id: string
  name: string
  balanceCents: number
}

interface Props {
  initialPane: AdminGatheringPane
  initialGatherings: AdminGatheringRow[]
  initialQueue: ReviewQueueRow[]
  templates: TemplateOption[]
  funds: FundOption[]
  mayCreate: boolean
  mayEdit: boolean
  mayDelete: boolean
  /**
   * `admin/gatherings:view` — whether the Gatherings and Review queue panes exist at all.
   *
   * FALSE IS A REAL STATE since the template library became a pane here: a family may grant
   * somebody the library and not the console, and that caller lands on this screen with
   * Templates as the only tab. The PAGE 404s a caller holding neither, and skips both fetches
   * when this is false — so `initialGatherings` and `initialQueue` are empty rather than
   * fetched-and-hidden (§5).
   */
  mayViewConsole: boolean

  // ── The Templates pane ────────────────────────────────────────────────────────────
  /** `admin/gathering-templates:view`. False means the library was never read. */
  mayViewTemplates: boolean
  libraryTemplates: GatheringTemplate[]
  mayCreateTemplates: boolean
  mayEditTemplates: boolean
  mayDeleteTemplates: boolean
  /** `gatherings/budget:view`. False means no money was fetched at all, not merely hidden. */
  mayManageBudget: boolean
  /**
   * `admin/gathering-templates:view` — whether the two sentences on this screen that mention the
   * template library may LINK to it.
   *
   * A different key from everything else here, and a family really does split them: an organizer
   * who schedules gatherings is not necessarily a template author. `/admin/gatherings/templates`
   * 404s a caller without `view` on its own key, so a link offered on any other basis is a link
   * to a 404 — the standard `/gatherings` already sets for its own one-sentence link.
   */
  mayAuthorTemplates: boolean
}

/** "6 of 9 approved · 2 waiting", or the honest empty version. */
function progressCaption(counts: TaskProgress, t: T): string {
  if (counts.total === 0) return t('gath.noTasks')
  // BOTH HALVES ARE WHOLE KEYS. `${a} of ${b} approved` puts an English word order and a
  // participle agreement in the source; Spanish and French both inflect the participle.
  const parts = [t('agat.progress', { done: counts.approved, total: counts.total })]
  if (counts.submitted > 0) parts.push(t('agat.waiting', { n: counts.submitted }))
  if (counts.denied > 0) parts.push(`${counts.denied} sent back`)
  return parts.join(' · ')
}

export function AdminGatheringsClient({
  initialPane, initialGatherings, initialQueue, templates, funds,
  mayCreate, mayEdit, mayDelete, mayManageBudget, mayAuthorTemplates,
  mayViewConsole, mayViewTemplates, libraryTemplates,
  mayCreateTemplates, mayEditTemplates, mayDeleteTemplates,
}: Props) {
  const t = useT()
  const router = useRouter()
  const confirm = useConfirm()
  const [pane, setPane] = useState<AdminGatheringPane>(initialPane)
  const [gatherings, setGatherings] = useServerState(initialGatherings)
  const [queue, setQueue] = useServerState(initialQueue)
  const [creating, setCreating] = useState(false)
  const [listError, setListError] = useState('')
  const [isPending, startTransition] = useTransition()

  function selectPane(next: AdminGatheringPane) {
    setPane(next)
    setListError('')
    // Rebuilt from the live search string so switching never drops another param, and
    // `replaceState` so Back leaves the page instead of walking the two panes.
    const params = new URLSearchParams(window.location.search)
    params.set('pane', next)
    window.history.replaceState(null, '', `${window.location.pathname}?${params}`)
  }

  async function handleDelete(row: AdminGatheringRow) {
    const ok = await confirm({
      title: t('agat.delete'),
      description: `Delete “${row.title}”? Every task on it goes with it, and so does every `
        + 'answer and note anybody has already written. If it is simply not happening, set its '
        + 'status to Cancelled instead — nothing is lost and it can be reopened. This cannot '
        + 'be undone.',
      confirmLabel: t('agat.delete'),
      destructive: true,
    })
    if (!ok) return
    setListError('')
    startTransition(async () => {
      const result = await deleteGathering(row.id)
      if (!result.success) {
        // Verbatim: the action refuses once anybody's answer has been approved and its
        // sentence names how many and what to do instead.
        setListError(result.message ?? t('agat.deleteFailed'))
        return
      }
      setGatherings(prev => prev.filter(g => g.id !== row.id))
    })
  }

  return (
    <div className="space-y-5">
      {/* Built from what the caller may actually see, so a visible tab always leads somewhere
          they can go. The two console panes share one grant and travel together; Templates has
          its own, and a family really does split them — an organizer who runs the gatherings is
          not necessarily the person who authors the checklists.

          The create trigger is PER PANE. "New gathering" belongs to the list and would be a
          non sequitur over the library, whose own inline "Add a template" form is part of the
          pane (see `AdminGatheringTemplatesClient`) rather than a rail action. */}
      <MainRail
        label={t('agat.rail')}
        items={ADMIN_GATHERING_PANES
          .filter(id => (id === 'templates' ? mayViewTemplates : mayViewConsole))
          .map(id => ({
            id,
            label: id === 'queue' && queue.length > 0
              ? `${paneLabel(t)[id]} (${queue.length})`
              : paneLabel(t)[id],
            icon: PANE_ICON[id],
            href: `/admin/gatherings?pane=${id}`,
          }))}
        active={pane}
        onSelect={selectPane}
        action={pane !== 'templates' && mayCreate && (
          <Button variant="affirm" onClick={() => setCreating(true)}>
            <CirclePlus className="h-4 w-4 mr-1" /> {t('agat.new')}
          </Button>
        )}
      />

      <div className="mt-5 min-w-0 space-y-4">
        {pane === 'templates' ? (
          // Both conjuncts kept, as everywhere else in this tree: the page falls back to a pane
          // the caller can open, so the second should never decide anything — which is exactly
          // why it is written down. A stale `?pane=` plus a grant removed mid-session must not
          // render a library over `[]` and call it empty.
          mayViewTemplates && (
            <AdminGatheringTemplatesClient
              initialTemplates={libraryTemplates}
              mayCreate={mayCreateTemplates}
              mayEdit={mayEditTemplates}
              mayDelete={mayDeleteTemplates}
            />
          )
        ) : pane === 'gatherings' ? (
          <>
            <FormError message={listError} />
            {gatherings.length === 0 ? (
              <p className="rounded-xl border bg-muted/40 px-4 py-6 text-sm text-muted-foreground">
                No gatherings yet.{' '}
                {mayCreate
                  ? t('agat.pressNew')
                  : t('agat.somebodySchedule')}
              </p>
            ) : (
              <div className="overflow-visible rounded-xl border">
                <table className="w-full border-collapse text-sm">
                  <thead>
                    <tr className="border-b bg-muted/40 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                      <th scope="col" className="px-3 py-2 font-semibold">{t('cal.kind.gathering')}</th>
                      <th scope="col" className={cn('px-3 py-2 font-semibold', COLLAPSING_CELL)}>{t('agat.when')}</th>
                      <th scope="col" className="px-3 py-2 font-semibold">{t('money.status')}</th>
                      {/* The money column exists only where the money was fetched. A caller
                          without `gatherings/budget:view` has `budget: null` on every row, so
                          a rendered column would be a column of em-dashes suggesting nothing
                          is budgeted. */}
                      {mayManageBudget && (
                        <th scope="col" className={cn('px-3 py-2 text-right font-semibold', COLLAPSING_CELL)}>{t('budget.heading')}</th>
                      )}
                      <th scope="col" className={cn('px-3 py-2 font-semibold', COLLAPSING_CELL)}>{t('gath.tasks')}</th>
                      <th scope="col" className="px-3 py-2 font-semibold"><span className="sr-only">{t('money.actions')}</span></th>
                    </tr>
                  </thead>
                  <tbody>
                    {gatherings.map(row => (
                      <tr key={row.id} className="border-b align-top last:border-0 sm:align-middle">
                        <td className="px-3 py-2.5">
                          <div className="flex flex-wrap items-center gap-2">
                            <Link href={`/admin/gatherings/${row.id}`} className="font-medium text-brand-accent">
                              {row.title}
                            </Link>
                            {row.isPremier && <PremierPill />}
                          </div>
                          {row.location && (
                            <p className="mt-0.5 text-xs text-muted-foreground">{row.location}</p>
                          )}
                          <RowMeta className="gap-x-2">
                            {/* The whole answer, never a range over the envelope — see `formatWhenBrief`. */}
                            <MetaIf value={formatWhenBrief(row)} />
                            <MetaDot />
                            <MetaIf value={progressCaption(row.taskCounts, t)} />
                            {mayManageBudget && row.budget && (
                              <>
                                <MetaDot />
                                <span><MoneyText budget={row.budget} /></span>
                              </>
                            )}
                            {/* The folded copy of the cell below, and it owes the same
                                distinction: a caller behind `mayManageBudget` holds the key, so a
                                missing figure here is a failed read and not a withheld one. */}
                            {mayManageBudget && row.budgetState === 'unavailable' && (
                              <>
                                <MetaDot />
                                <span>{t('agat.budgetUnavailable')}</span>
                              </>
                            )}
                          </RowMeta>
                        </td>
                        <td className={cn('px-3 py-2.5 text-muted-foreground', COLLAPSING_CELL)}>
                          {formatWhenBrief(row) ?? '—'}
                        </td>
                        <td className="px-3 py-2.5">
                          <GatheringStatusPill status={row.status} />
                        </td>
                        {mayManageBudget && (
                          <td className={cn('px-3 py-2.5 text-right', COLLAPSING_CELL)}>
                            {/* THREE OUTCOMES, NOT TWO, and the em-dash is only one of them.
                                This whole column is behind `mayManageBudget`, so nobody reaching
                                it has had the money withheld — which means a null `budget` is
                                either "the family budgeted nothing for this one" or "the figures
                                did not come back", and an em-dash asserts the first. `budgetState`
                                is the only thing that can tell them apart by the time the row
                                gets here. */}
                            {row.budget
                              ? <MoneyCell budget={row.budget} />
                              : row.budgetState === 'unavailable'
                                ? <span className="text-muted-foreground italic">{t('agat.unavailable')}</span>
                                : <span className="text-muted-foreground">—</span>}
                          </td>
                        )}
                        <td className={cn('px-3 py-2.5 text-muted-foreground', COLLAPSING_CELL)}>
                          {progressCaption(row.taskCounts, t)}
                        </td>
                        <td className="w-px px-3 py-2.5">
                          <div className="flex items-center justify-end gap-1">
                            {/* `buttonVariants` on a real `Link`, which is the house pattern
                                for a link that looks like a button — `Button` renders a
                                `<button>` and has no `asChild`. The variant carries its own
                                text colour, which a link needs: `globals.css` paints every
                                bare anchor with `--brand-accent`. */}
                            <Link
                              href={`/admin/gatherings/${row.id}`}
                              className={buttonVariants({ size: 'sm', variant: 'outline' })}
                            >
                              {t('agat.open')}
                            </Link>
                            {mayDelete && (
                              <Button
                                size="sm" variant="ghost"
                                className="h-7 w-7 p-0 text-destructive hover:text-destructive"
                                disabled={isPending}
                                title={`Delete ${row.title}`}
                                aria-label={`Delete ${row.title}`}
                                onClick={() => handleDelete(row)}
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </Button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </>
        ) : (
          <ReviewQueuePane
            queue={queue}
            mayEdit={mayEdit}
            onDecided={taskId => setQueue(prev => prev.filter(r => r.taskId !== taskId))}
          />
        )}
      </div>

      {mayCreate && (
        <NewGatheringDialog
          open={creating}
          onClose={() => setCreating(false)}
          templates={templates}
          funds={funds}
          mayManageBudget={mayManageBudget}
          mayAuthorTemplates={mayAuthorTemplates}
          onCreated={id => router.push(`/admin/gatherings/${id}`)}
        />
      )}
    </div>
  )
}

/**
 * The premier marker, in the one styling this product has for it.
 *
 * The classes are `GATHERING_PREMIER_PILL` from `components/gatherings/status.ts`, which is
 * where the Warmth-not-gold argument lives — this screen made that call first and the constant
 * is that call applied to all four surfaces that render the marker. What stays here is the
 * `title`, which is about the FEATURE rather than the paint: several gatherings may be flagged
 * (there is deliberately no uniqueness on the column) and the Dashboard band shows the soonest
 * upcoming one, which is not deducible from a chip saying "Premier".
 */
function PremierPill() {
  const t = useT()
  return (
    <span
      className={GATHERING_PREMIER_PILL}
      title={t('agat.premierHint')}
    >
      <Star className="h-3 w-3" aria-hidden="true" /> {t('gath.premier')}
    </span>
  )
}

// ── The money, in a table cell and in a meta line ────────────────────────────────────

/**
 * The budget against its fund, for the list.
 *
 * The arithmetic is `gatheringBudgetMath` and nothing here re-derives any of it: `overFund` is
 * false whenever the balance is null, which is what stops "we could not read the balance" from
 * rendering as an alarm line over a perfectly healthy fund. The RED LINE is `--destructive`
 * rather than `--brand-withheld` — an overrun is a state the family has to act on, not a
 * capability being held back (spec §3.2).
 */
function MoneyCell({ budget }: { budget: GatheringBudgetView }) {
  const intl = useIntlTag()
  const t = useT()
  const math = gatheringBudgetMath({
    budgetCents:         budget.budgetCents,
    lineCents:           budget.lineCents,
    fundBalanceCents:    budget.fundBalanceCents,
    otherCommittedCents: budget.otherCommittedCents,
  })

  if (math.budgetCents == null) {
    return (
      <span className="text-muted-foreground">
        {budget.fundName ? `No budget · ${budget.fundName}` : t('agat.noBudget')}
      </span>
    )
  }

  return (
    <div className="space-y-0.5">
      <p className={cn('tabular-nums', math.overFund && 'text-destructive')}>
        {formatCurrency(math.budgetCents, intl)}
      </p>
      <p className="text-xs text-muted-foreground">
        {budget.fundName ?? t('agat.noFund')}
        {math.fundBalanceCents != null && ` · ${formatCurrency(math.fundBalanceCents, intl)} in it`}
      </p>
      {math.overFund && (
        <p className="text-xs text-destructive">
          Over by {formatCurrency(math.overFundByCents, intl)}
        </p>
      )}
      {!math.overFund && math.overFundWithOthers && (
        <p className="text-xs text-destructive">
          Over with the other gatherings on this fund by {formatCurrency(math.overFundWithOthersByCents, intl)}
        </p>
      )}
    </div>
  )
}

/** The same figures as one line, for the folded meta row. */
function MoneyText({ budget }: { budget: GatheringBudgetView }) {
  const intl = useIntlTag()
  const t = useT()
  const math = gatheringBudgetMath({
    budgetCents:         budget.budgetCents,
    lineCents:           budget.lineCents,
    fundBalanceCents:    budget.fundBalanceCents,
    otherCommittedCents: budget.otherCommittedCents,
  })
  if (math.budgetCents == null) return <>{t('agat.noBudget')}</>
  const over = math.overFund || math.overFundWithOthers
  return (
    <span className={cn(over && 'text-destructive')}>
      {formatCurrency(math.budgetCents, intl)}
      {budget.fundName && ` on ${budget.fundName}`}
      {over && ' · over the fund'}
    </span>
  )
}

// ── The review queue ─────────────────────────────────────────────────────────────────

function ReviewQueuePane({
  queue, mayEdit, onDecided,
}: {
  queue: ReviewQueueRow[]
  mayEdit: boolean
  onDecided: (taskId: string) => void
}) {
  const t = useT()
  if (queue.length === 0) {
    return (
      <p className="rounded-xl border bg-muted/40 px-4 py-6 text-sm text-muted-foreground">
        Nothing is waiting for review. A task appears here the moment the relative it was
        handed to submits an answer.
      </p>
    )
  }

  return (
    <div className="space-y-4">
      {!mayEdit && (
        <div className="rounded-xl border bg-muted/40 px-4 py-3 text-sm text-muted-foreground">
          {t('agat.queueReadOnly')}
        </div>
      )}
      {queue.map(row => (
        <ReviewCard key={row.taskId} row={row} mayEdit={mayEdit} onDecided={onDecided} />
      ))}
    </div>
  )
}

function ReviewCard({
  row, mayEdit, onDecided,
}: {
  row: ReviewQueueRow
  mayEdit: boolean
  onDecided: (taskId: string) => void
}) {
  const intl = useIntlTag()
  const t = useT()
  const confirm = useConfirm()
  const [sendingBack, setSendingBack] = useState(false)
  const [notes, setNotes] = useState('')
  const [notesError, setNotesError] = useState('')
  const [error, setError] = useState('')
  const [isPending, startTransition] = useTransition()

  async function handleApprove() {
    const ok = await confirm({
      title: t('agat.approveThis'),
      description: `Approve “${row.label}” on ${row.gatheringTitle}? Approving is final — `
        + 'the answer is the family’s record of it and the person who submitted it cannot '
        + 'change it afterwards. Send it back instead if anything still needs work.',
      confirmLabel: t('agat.approve'),
    })
    if (!ok) return
    setError('')
    startTransition(async () => {
      const result = await reviewGatheringTask({ taskId: row.taskId, decision: 'approved' })
      if (!result.success) { setError(result.message ?? t('agat.approveFailed')); return }
      onDecided(row.taskId)
    })
  }

  function handleSendBack() {
    const trimmed = notes.trim()
    // Checked here as well as in the action, because being refused AFTER deciding to send
    // something back is the worst moment to find out the notes were the point.
    if (!trimmed) {
      setNotesError(t('agat.sayWhatChangesMember'))
      return
    }
    setNotesError('')
    setError('')
    startTransition(async () => {
      const result = await reviewGatheringTask({
        taskId: row.taskId, decision: 'denied', reviewNotes: trimmed,
      })
      if (!result.success) { setError(result.message ?? t('agat.sendBackFailed')); return }
      onDecided(row.taskId)
    })
  }

  return (
    <section className="space-y-3 rounded-xl border bg-card p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          {/* `h3`-`h6` get a colour from the base layer and NOTHING else — Preflight has
              already reset their size and weight to `inherit`, so a class-less `<h3>` is body
              text in terracotta. This is the subject of the card and has to outweigh the muted
              line under it. */}
          <h3 className="text-base font-semibold">{row.label}</h3>
          <p className="text-sm text-muted-foreground">
            {/* `Link`, not `<a>`: this one sits INSIDE the review pane, so a real navigation
                would remount it and discard every open denial draft. See the header. */}
            <Link href={`/admin/gatherings/${row.gatheringId}`} className="text-brand-accent">
              {row.gatheringTitle}
            </Link>
            {row.assignee && ` · ${row.assignee.name}`}
            {row.dueOn && ` · due ${formatDate(row.dueOn, intl)}`}
            {row.submittedAt && ` · submitted ${formatDate(row.submittedAt.slice(0, 10), intl)}`}
          </p>
        </div>
        {row.required && (
          <span className={cn(GATHERING_PILL_SHAPE, 'bg-brand-soft text-brand-on-soft')}>
            {t('common.required')}
          </span>
        )}
      </div>

      <div className="rounded-lg border bg-muted/40 px-3 py-2 text-sm">
        <p className="text-xs font-medium text-muted-foreground">{t('agat.theirAnswer')}</p>
        {/* `describeAnswer` returns '' for anything it cannot read, and `AnswerText` renders
            null for that — so the screen decides what absence looks like rather than printing
            an empty line where a figure should be. */}
        <AnswerText kind={row.kind} answer={row.answer} />
        {!row.answer && <p className="text-muted-foreground">{t('agat.nothingRecorded')}</p>}
      </div>

      {row.note && (
        <div className="rounded-lg border px-3 py-2 text-sm">
          <p className="text-xs font-medium text-muted-foreground">{t('agat.theirNote')}</p>
          <p className="whitespace-pre-wrap">{row.note}</p>
        </div>
      )}

      {mayEdit && (
        <div className="space-y-3">
          {sendingBack && (
            <div className="space-y-1.5">
              <Label htmlFor={`notes-${row.taskId}`} required>{t('agat.whatNeedsChange')}</Label>
              <Textarea
                id={`notes-${row.taskId}`}
                autoGrow rows={2}
                placeholder={t('agat.notePh1')}
                value={notes}
                disabled={isPending}
                onChange={e => { setNotes(e.target.value); setNotesError('') }}
              />
              <p className="text-xs text-muted-foreground">
                Sent to {row.assignee ? row.assignee.name : 'whoever holds this task'} with the
                task. A task sent back with no notes leaves them nothing to act on, which is why
                this is required.
              </p>
              <FieldError message={notesError} />
            </div>
          )}
          <div className="flex flex-wrap items-center gap-2">
            <Button variant="affirm" disabled={isPending} onClick={handleApprove}>
              {isPending ? t('action.saving') : t('agat.approve')}
            </Button>
            {sendingBack ? (
              <>
                <Button variant="outline" disabled={isPending} onClick={handleSendBack}>
                  {isPending ? t('security.sending') : t('agat.sendBackWithNotes')}
                </Button>
                <Button
                  variant="ghost" disabled={isPending}
                  onClick={() => { setSendingBack(false); setNotes(''); setNotesError('') }}
                >
                  {t('action.cancel')}
                </Button>
              </>
            ) : (
              <Button variant="outline" disabled={isPending} onClick={() => setSendingBack(true)}>
                {t('agat.sendBack')}
              </Button>
            )}
          </div>
          <FormError message={error} />
        </div>
      )}
    </section>
  )
}

// ── Creating a gathering ─────────────────────────────────────────────────────────────

/**
 * TEMPLATE-FIRST, AND THE TEMPLATE IS OPTIONAL — two things that used to be one.
 *
 * This said "a gathering can only be built from a template" and the picker was REQUIRED. As of
 * 2026-08-19 `createGathering` accepts an empty list, because Standard moved the tier boundary
 * to run between the DATE and the PLANNING: Free sells the gathering on a shared calendar, the
 * template library is `tier: 'standard'`, and this console is Free — so an organizer on Free
 * has no template to build from and must still be able to put the reunion on the calendar. The
 * full argument is in `scheduleGathering`'s header.
 *
 * FIRST is kept and REQUIRED is dropped, and the two were never the same claim. Choosing a
 * template changes what the rest of the form is for, so it still leads; a `RequiredMark` on a
 * group the form will submit without teaches an organizer that the mark means nothing.
 *
 * The money fields appear only where the money grant is held AND the family has an active
 * fund. `gatherings_budget_needs_fund` refuses a budget with no fund — mirrored here as a
 * disabled box with a sentence, so an organizer reads "choose the fund this budget is drawn
 * on" rather than a CHECK violation.
 */
function NewGatheringDialog({
  open, onClose, templates, funds, mayManageBudget, mayAuthorTemplates, onCreated,
}: {
  open: boolean
  onClose: () => void
  templates: TemplateOption[]
  funds: FundOption[]
  mayManageBudget: boolean
  /** Whether the empty-state sentence may link to the library. See `Props`. */
  mayAuthorTemplates: boolean
  onCreated: (gatheringId: string) => void
}) {
  const intl = useIntlTag()
  const t = useT()
  const [templateIds, setTemplateIds] = useState<string[]>([])
  const [title, setTitle] = useState('')
  const [summary, setSummary] = useState('')
  const [location, setLocation] = useState('')
  const [startsOn, setStartsOn] = useState(todayLocal())
  const [endsOn, setEndsOn] = useState('')
  const [fundId, setFundId] = useState('')
  const [budget, setBudget] = useState('')
  const [isPremier, setIsPremier] = useState(false)
  const [error, setError] = useState('')
  // Set when the gathering was created and something about it still needs saying — a template
  // whose steps could not be added. The row EXISTS, so navigating away silently would lose the
  // sentence, and reporting a failure would be false.
  const [createdId, setCreatedId] = useState('')
  const [isPending, startTransition] = useTransition()

  // Adjusted DURING RENDER rather than in an effect: an effect runs after paint, which would
  // flash the previous attempt's message inside a freshly opened dialog for a frame. The
  // initializers above run once — a tab left open overnight would otherwise keep offering
  // yesterday to every gathering scheduled the next morning.
  const [wasOpen, setWasOpen] = useState(open)
  if (wasOpen !== open) {
    setWasOpen(open)
    setError('')
    setCreatedId('')
    if (open) setStartsOn(todayLocal())
  }

  function toggleTemplate(id: string) {
    setError('')
    setTemplateIds(prev => (prev.includes(id) ? prev.filter(t => t !== id) : [...prev, id]))
  }

  function handleCreate() {
    const trimmedTitle = title.trim()
    if (!trimmedTitle) { setError('A gathering needs a title'); return }
    setError('')
    startTransition(async () => {
      const result = await createGathering({
        title:       trimmedTitle,
        summary:     summary.trim() || undefined,
        location:    location.trim() || undefined,
        startsOn,
        endsOn:      endsOn || undefined,
        templateIds,
        fundId:      fundId || null,
        budgetCents: fundId && budget.trim() !== '' ? dollarsToCents(budget) : null,
        isPremier,
      })
      if (!result.success || !result.gatheringId) {
        setError(result.message ?? t('agat.createFailed'))
        return
      }
      // `success: true` WITH a message means the gathering exists and one of its templates
      // did not attach. Both facts are true and both are said.
      if (result.message) {
        setError(result.message)
        setCreatedId(result.gatheringId)
        return
      }
      onCreated(result.gatheringId)
    })
  }

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={t('agat.new')}
      description={t('agat.pickTemplates')}
      className="max-w-lg"
    >
      <div className="mt-2 space-y-3">
        {/* A `<fieldset>`/`<legend>` rather than a `Label`, because this group is several
            checkboxes and a `<label>` may name only one control — a bare `<Label>` with no
            `htmlFor` and no nested input labels NOTHING, so the seven checkboxes below were
            announced as an unnamed group. (The `RequiredMark` that used to sit in this legend
            is gone — a template is optional now — but the `<fieldset>`/`<legend>` reasoning is
            about NAMING the group and is unaffected by that.) `GatheringsClient`'s copy of this dialog already does
            it this way; the two must not diverge. */}
        <fieldset className="space-y-1.5">
          <legend className="text-sm font-medium">{t('gath.builtFrom')}</legend>
          {templates.length === 0 ? (
            // NOT AN OBSTACLE ANY MORE, WHICH IS WHY THE SENTENCE CHANGED. It used to say a
            // gathering "needs at least one" template, which was true and is not. What it says
            // now is what happens if you carry on — a date with no tasks — and what a template
            // would buy. `mayAuthorTemplates` is grant AND plan, resolved on the page, so the
            // link cannot land on `/upgrade` or a 404; a Free family gets the second branch,
            // which is the same sentence a member without the grant gets and is true of both.
            <p className="rounded-lg border border-dashed px-3 py-2 text-xs text-muted-foreground">
              There are no templates to build from, so this will be a date on the family
              calendar with no tasks.{' '}
              {mayAuthorTemplates
                ? <>{t('agat.addOneIn')} <Link href="/admin/gatherings/templates">template library</Link> and a
                    gathering becomes a checklist handed out as tasks.</>
                : <>A template is a checklist handed out as tasks — somebody who can author
                    templates has to add the first.</>}
            </p>
          ) : (
            <>
              {/* Real checkboxes rather than a multi-select: this is a list of the family's
                  own templates, which is a handful, and the description under each name is
                  the thing that tells them apart. `PersonMultiSelect` is the control for a
                  list of PEOPLE, where 150 is the size to build for. */}
              <div className="max-h-52 space-y-1 overflow-y-auto rounded-lg border p-2">
                {templates.map(t => (
                  <label
                    key={t.id}
                    className="flex cursor-pointer items-start gap-2 rounded-md px-2 py-1.5 select-none hover:bg-muted/60"
                  >
                    <input
                      type="checkbox"
                      className="mt-0.5 h-4 w-4 rounded border-input accent-primary"
                      checked={templateIds.includes(t.id)}
                      onChange={() => toggleTemplate(t.id)}
                    />
                    <span className="min-w-0">
                      <span className="block text-sm font-medium">{t.name}</span>
                      {t.description && (
                        <span className="block text-xs text-muted-foreground">{t.description}</span>
                      )}
                    </span>
                  </label>
                ))}
              </div>
              <p className="text-xs text-muted-foreground">
                {templateIds.length === 0
                  ? t('agat.everyStep')
                  : `${templateIds.length} chosen · their steps become this gathering’s tasks, in the order shown`}
              </p>
            </>
          )}
        </fieldset>

        <div className="space-y-1.5">
          <Label htmlFor="gathering-title" required>{t('field.title')}</Label>
          <Input
            id="gathering-title"
            placeholder={t('gath.titlePh')}
            value={title}
            onChange={e => { setTitle(e.target.value); setError('') }}
          />
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="gathering-starts" required>{t('agat.starts')}</Label>
            <Input
              id="gathering-starts" type="date"
              value={startsOn}
              onChange={e => setStartsOn(e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            {/* `min` IS THE START DATE — added 2026-08-20 across every start/end pair in the
                app. `gatherings_dates_ordered` refuses `ends_on < starts_on` in the database
                and the action turns that 23514 into a sentence, which is the right boundary
                and the wrong first line of defence: a picker that greys out the impossible
                days never produces one, so nobody meets the refusal at all. The CHECK stays
                underneath for a caller that is not this form. */}
            <Label htmlFor="gathering-ends">{t('agat.ends')}</Label>
            <Input
              id="gathering-ends" type="date"
              min={startsOn || undefined}
              value={endsOn}
              onChange={e => setEndsOn(e.target.value)}
            />
            <p className="text-xs text-muted-foreground">{t('agat.singleDay')}</p>
          </div>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="gathering-location">{t('agat.location')}</Label>
          <Input
            id="gathering-location"
            placeholder={t('gath.wherePh')}
            value={location}
            onChange={e => setLocation(e.target.value)}
          />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="gathering-summary">{t('agat.summary')}</Label>
          <Textarea
            id="gathering-summary"
            autoGrow rows={1}
            placeholder={t('agat.summaryPh')}
            value={summary}
            onChange={e => setSummary(e.target.value)}
          />
        </div>

        {mayManageBudget && funds.length > 0 && (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="gathering-fund">{t('fnd.fund')}</Label>
              <Select
                id="gathering-fund"
                value={fundId}
                onChange={e => { setFundId(e.target.value); setError('') }}
              >
                <option value="">— No fund —</option>
                {funds.map(f => (
                  <option key={f.id} value={f.id}>
                    {f.name} — {formatCurrency(f.balanceCents, intl)}
                  </option>
                ))}
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="gathering-budget">{t('agat.budgetDollars')}</Label>
              <Input
                id="gathering-budget"
                type="number" min="0" step="0.01"
                placeholder={fundId ? t('common.optional') : t('agat.chooseFundFirst')}
                value={budget}
                disabled={!fundId}
                onChange={e => setBudget(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">
                A budget is always drawn on a fund. It may exceed what the fund holds — the
                gathering says so in red rather than refusing it.
              </p>
            </div>
          </div>
        )}

        <div className="space-y-1.5">
          <label className="flex cursor-pointer items-center gap-2 select-none">
            <input
              type="checkbox"
              checked={isPremier}
              onChange={e => setIsPremier(e.target.checked)}
              className="h-4 w-4 rounded border-input accent-primary"
            />
            <span className="text-sm font-medium">{t('agat.showAcrossTop')}</span>
          </label>
          <p className="text-xs text-muted-foreground">
            Several gatherings may be flagged at once — the Dashboard shows the soonest one that
            has not finished, so last year’s reunion never blocks this year’s.
          </p>
        </div>

        <FormError message={error} />

        <div className="flex gap-2 pt-1">
          {createdId ? (
            <Button className="flex-1" onClick={() => onCreated(createdId)}>
              {t('agat.openGathering')}
            </Button>
          ) : (
            <Button
              className="flex-1"
              disabled={isPending || templates.length === 0}
              onClick={handleCreate}
            >
              {isPending ? t('action.creating') : t('agat.create')}
            </Button>
          )}
          <Button variant="outline" onClick={onClose} disabled={isPending}>{t('action.cancel')}</Button>
        </div>
      </div>
    </Dialog>
  )
}
