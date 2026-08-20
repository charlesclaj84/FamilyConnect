'use client'

import { useId, useState, useTransition } from 'react'
import { ArrowDown, ArrowUp, ChevronRight, Plus, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { useConfirm } from '@/components/ui/confirm'
import { FormError } from '@/components/ui/form-message'
import { COLLAPSING_CELL, RowMeta, MetaDot } from '@/components/ui/table-collapse'
import { cn } from '@/lib/utils'
import { useServerState } from '@/lib/use-server-state'
import { formatCurrency, dollarsToCents } from '@/lib/currency-utils'
import {
  GATHERING_STEP_KINDS, GATHERING_STEP_KIND_LABEL, GATHERING_STEP_KIND_HINT,
  GATHERING_TEMPLATE_SCHEDULERS,
  type GatheringStepKind, type GatheringTemplateScheduler,
} from '@/lib/gatherings'
import {
  createGatheringTemplate, updateGatheringTemplate, deleteGatheringTemplate,
  addTemplateStep, updateTemplateStep, deleteTemplateStep, moveTemplateStep,
  type GatheringTemplate, type TemplateStep,
} from '@/app/actions/admin/gathering-templates'

/**
 * THE TEMPLATE LIBRARY — a card per template, a table of steps inside each.
 *
 * ── THERE IS NO **USUAL LOCATION**, AND A STEP IS WHY ──────────────────────────────
 * `gathering_templates.default_location` was a field on this screen until 2026-08-19: where a
 * segment built from this template is USUALLY held, copied onto `gathering_template_uses.location`
 * at the moment of linking. `20260819000007` drops it, and the replacement is a step of kind
 * **A place**.
 *
 * The old field was a template AUTHOR guessing at a fact that belongs to one occasion — this
 * year's reunion is at the lodge, last year's was at Zilker — and the guess then had to be
 * corrected on every segment it had been copied onto. A step inverts it: the template says
 * somebody has to settle the venue, a gathering hands that job to a named relative with a due
 * date, and the answer is reviewed like every other answer on the screen. Moving a segment that
 * already exists is still `setGatheringSegment` on `/admin/gatherings/[id]`, which is where a
 * place people have been told about is changed.
 *
 * ── A STEP MAY BE ANOTHER TEMPLATE ─────────────────────────────────────────────────
 * Kind **Another template** with a `childTemplateId`: the step is not handed to anybody, it
 * EXPANDS into that template's own steps when a gathering is built. A family that runs the same
 * five-step catering checklist inside three different occasions writes it once.
 *
 * Three things about it show up in this file. The picker offers only the OTHER templates, so a
 * one-hop loop cannot be chosen (it is refused by a CHECK constraint underneath as well); a
 * template step's Required and Suggested-budget controls are not merely hidden but FORCED off,
 * because a step nobody answers cannot be required and has no line to budget; and a longer loop —
 * A includes B includes A — is refused in SQL by a recursive walk in
 * `tg_gathering_template_step_same_family()`, whose sentence the action surfaces verbatim,
 * because this screen cannot see the whole graph and must not pretend it can.
 *
 * ── WHY A CARD PER TEMPLATE AND A TABLE PER CARD ────────────────────────────────────
 * A template is a small form (name, description, who may schedule from it) sitting over an
 * ORDERED LIST of steps, and those two things want different treatments. The steps are rows
 * answering the same questions about each other — what does it ask for, is it required, what
 * does it suggest spending — so they are a real `<table>` with `<th scope="col">`, folding on
 * a phone through `COLLAPSING_CELL` rather than scrolling sideways (AGENTS.md, "A table is a
 * table" and "On a phone a table narrows"). The template's own fields are a form and are laid
 * out as one.
 *
 * ── EVERY FOLDING STEP COLUMN IS ONE ELEMENT RENDERED TWICE ─────────────────────────
 * Three of the step columns hold a CONTROL, and all three fold. A folded column that merely
 * describes its control in the meta line goes read-only on a phone, so each control is
 * assigned to a variable and rendered in both places: once inside the first cell's
 * `<RowMeta>` and once in its own collapsing `<td>`. Both copies are in the DOM, only one is
 * ever visible or focusable, and both are bound to the same state so they cannot disagree. No
 * `id` on any of them — two elements cannot share one — so each carries an `aria-label`
 * naming the step, since the column heading that named it has folded away.
 *
 * ── DELETE IS NOT PRE-DISABLED ON THE USE COUNT, AND THAT IS DELIBERATE ─────────────
 * `gathering_template_uses.template_id` is NO ACTION on delete, so a template a gathering was
 * built from genuinely cannot go — the record of where those tasks came from would go with
 * it. `deleteGatheringTemplate` counts the uses itself and REFUSES with a sentence naming the
 * count and offering archiving. This screen prints `usedByCount` beside the button so the
 * refusal is predictable, and then handles the refusal anyway: the count arrived with the page
 * and a gathering scheduled in another tab since makes it stale, so the greyed title is a
 * courtesy and never the gate. When the refusal comes back, the message is shown verbatim and
 * an **Archive it instead** button appears next to it — the thing the sentence just told the
 * reader to do, one click away rather than somewhere else on the card.
 *
 * ── EDITING A TEMPLATE IS SAFE, AND THE SCREEN SAYS SO ──────────────────────────────
 * Steps are COPIED into `gathering_tasks` at instantiation (`label`, `help_text`, `kind`,
 * `required`), so nothing here reaches a relative who has already been asked something. That
 * is the fact which makes an always-editable library reasonable rather than reckless, and it
 * is stated on the card rather than left for somebody to worry about.
 *
 * Each row's edits are LOCAL until Save. A control that wrote on change would make the row's
 * five fields five round trips, and would fire one per keystroke of the label beside them;
 * one Save per row is one statement, and it only appears once something is actually dirty.
 */

interface Props {
  initialTemplates: GatheringTemplate[]
  mayCreate: boolean
  mayEdit: boolean
  mayDelete: boolean
}

/**
 * The two `who_may_schedule` values, captioned for the screen.
 *
 * The vocabulary is `GATHERING_TEMPLATE_SCHEDULERS` in `lib/gatherings.ts` and the CAPTIONS
 * are here — the same split `components/gatherings/status.ts` keeps for the status pills. The
 * values are shared with the server so the action and the picker cannot disagree about what is
 * being chosen between; the words are a screen's decision.
 */
const SCHEDULER_LABEL: Record<GatheringTemplateScheduler, string> = {
  admin:  'Administrators only',
  family: 'Any member',
}

const SCHEDULER_HINT: Record<GatheringTemplateScheduler, string> = {
  admin:  'Only somebody who can manage gatherings may start one from this template.',
  family: 'Any member who may schedule a gathering can start one from this template. They still cannot edit the template itself.',
}

/** Live templates first, then alphabetically — the order `getGatheringTemplates` returns. */
function sortTemplates(list: GatheringTemplate[]): GatheringTemplate[] {
  return [...list].sort((a, b) =>
    Number(a.isArchived) - Number(b.isArchived) || a.name.localeCompare(b.name))
}

const usedCaption = (n: number) =>
  n === 0 ? 'Not used by any gathering yet' : `Used by ${n} ${n === 1 ? 'gathering' : 'gatherings'}`

export function AdminGatheringTemplatesClient({
  initialTemplates, mayCreate, mayEdit, mayDelete,
}: Props) {
  // `useServerState`, never `useState`: every write below ends in a `revalidatePath`, and
  // `router.refresh()` merges the new payload WITHOUT discarding client state — a plain
  // initializer is read once per visit and every later server render ignored, which is what
  // makes a freshly added row appear only after navigating away and back.
  const [templates, setTemplates] = useServerState(initialTemplates)
  const [newName, setNewName] = useState('')
  const [newScheduler, setNewScheduler] = useState<GatheringTemplateScheduler>('admin')
  const [createError, setCreateError] = useState('')
  const [isPending, startTransition] = useTransition()

  function patchTemplate(id: string, next: Partial<GatheringTemplate>) {
    setTemplates(prev => sortTemplates(prev.map(t => (t.id === id ? { ...t, ...next } : t))))
  }

  function handleCreate() {
    const name = newName.trim()
    if (!name) return
    setCreateError('')
    startTransition(async () => {
      const result = await createGatheringTemplate({ name, whoMaySchedule: newScheduler })
      if (!result.success || !result.templateId) {
        setCreateError(result.message ?? 'Could not add that template')
        return
      }
      const templateId = result.templateId
      setNewName('')
      // THE OPTIMISTIC ROW CARRIES EVERY FIELD THE INTERFACE DECLARES, including the ones this
      // form does not offer. That is the reason a widened interface is not a free change: a row
      // built here that is missing a field is not a stale render, it is a type error — which is
      // the right failure, and is how the `defaultLocation` one was found before that column was
      // dropped again.
      setTemplates(prev => sortTemplates([...prev, {
        id: templateId, name, description: null,
        whoMaySchedule: newScheduler, isArchived: false, steps: [], usedByCount: 0,
      }]))
    })
  }

  return (
    <div className="space-y-8">
      {mayCreate && (
        <section className="space-y-3">
          <div>
            <h2 className="text-lg">Add a template</h2>
            <p className="text-sm text-muted-foreground">
              Name it for the occasion — “Family Reunion”, “Memorial Service”, “Scholarship
              Banquet”. Add its steps and a description once it is on the list below.
            </p>
          </div>
          <div className="flex flex-wrap items-end gap-2">
            <div className="min-w-0 flex-1 space-y-1.5 sm:max-w-xs">
              <Label htmlFor="new-template" required>Template name</Label>
              <Input
                id="new-template"
                placeholder="e.g. Family Reunion"
                value={newName}
                onChange={e => { setNewName(e.target.value); setCreateError('') }}
                onKeyDown={e => { if (e.key === 'Enter') handleCreate() }}
              />
            </div>
            {/* NO "Usual location" FIELD, since 2026-08-19, and its absence is a decision. The
                template used to state where this kind of gathering is usually held and that value
                was copied onto every segment built from it — a template AUTHOR guessing at a fact
                that belongs to one occasion, which then had to be corrected on each segment it
                landed on. A step of kind **A place** does the job properly: the template says
                somebody has to settle the venue, and a named relative settles it with a due date
                and a review. `20260819000007` dropped the column. */}
            <div className="min-w-0 space-y-1.5 sm:w-56">
              <Label htmlFor="new-template-scheduler">Who can schedule from this</Label>
              <Select
                id="new-template-scheduler"
                value={newScheduler}
                onChange={e => setNewScheduler(e.target.value as GatheringTemplateScheduler)}
              >
                {GATHERING_TEMPLATE_SCHEDULERS.map(s => (
                  <option key={s} value={s}>{SCHEDULER_LABEL[s]}</option>
                ))}
              </Select>
            </div>
            {/* `affirm`, like Add step further down and like every other create trigger in the
                feature. It was the default burgundy, which is what an ACTIVE RAIL ITEM looks
                like — and having the two inline create controls on one screen in two different
                colours was the visible cost. The icon stays a bare `Plus`: `CirclePlus` is the
                tree's glyph for a create trigger in a `MainRail` action slot (AdminAccountShell,
                TransactionsClient, and this feature's own two), and every inline "Add …" beside
                its own form uses `Plus`. */}
            <Button variant="affirm" disabled={!newName.trim() || isPending} onClick={handleCreate}>
              <Plus className="h-4 w-4" /> {isPending ? 'Adding…' : 'Add template'}
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">{SCHEDULER_HINT[newScheduler]}</p>
          <FormError message={createError} />
        </section>
      )}

      {templates.length === 0 ? (
        <p className="rounded-xl border bg-muted/40 px-4 py-6 text-sm text-muted-foreground">
          No gathering templates yet.{' '}
          {mayCreate
            ? 'Add one above, then give it a step for each thing somebody has to do.'
            : 'Somebody who can add templates has to create the first one.'}
        </p>
      ) : (
        <div className="space-y-6">
          {templates.map(template => (
            // Keyed by the row id, which is per-family — so switching family replaces the ids
            // and React remounts every card, and the drafts inside cannot go on describing
            // the family the member just left (AGENTS.md, "Switching family remounts the page").
            <TemplateCard
              key={template.id}
              template={template}
              // Every OTHER template, live or archived, so a "Another template" step can name
              // one. Archived is deliberately IN: archiving means "do not start anything NEW
              // from this", which is about scheduling a gathering, not about whether an
              // existing template may still compose it. Excluding this one is what makes the
              // one-hop loop unofferable rather than merely refused.
              siblings={templates.filter(t => t.id !== template.id).map(t => ({ id: t.id, name: t.name }))}
              mayCreate={mayCreate}
              mayEdit={mayEdit}
              mayDelete={mayDelete}
              onPatch={next => patchTemplate(template.id, next)}
              onRemove={() => setTemplates(prev => prev.filter(t => t.id !== template.id))}
            />
          ))}
        </div>
      )}
    </div>
  )
}

// ── One template ──────────────────────────────────────────────────────────────────────

function TemplateCard({
  template, siblings, mayCreate, mayEdit, mayDelete, onPatch, onRemove,
}: {
  template: GatheringTemplate
  /**
   * Every OTHER template in the library, for the "Another template" step kind.
   *
   * It is the caller's own list rather than a fetch of its own, so a template the reader was
   * not shown (an 'own'-scope grant) is not offered here either — and it excludes THIS one,
   * because a template including itself is refused by a CHECK constraint and there is no
   * reason to offer a choice that always fails. Loops through several templates are refused
   * by the trigger, whose sentence the action surfaces verbatim; this list cannot prevent them
   * and does not pretend to.
   */
  siblings: { id: string; name: string }[]
  mayCreate: boolean
  mayEdit: boolean
  mayDelete: boolean
  onPatch: (next: Partial<GatheringTemplate>) => void
  onRemove: () => void
}) {
  const confirm = useConfirm()
  const [name, setName] = useState(template.name)
  const [description, setDescription] = useState(template.description ?? '')
  const [scheduler, setScheduler] = useState<GatheringTemplateScheduler>(template.whoMaySchedule)
  const [error, setError] = useState('')
  // Set when `deleteGatheringTemplate` refuses because a gathering was built from this
  // template. Its sentence tells the reader to archive it instead; this is what puts that
  // action beside the sentence rather than somewhere else on the card.
  const [offerArchive, setOfferArchive] = useState(false)
  const [stepError, setStepError] = useState('')
  const [isPending, startTransition] = useTransition()

  /**
   * ── THE CARD IS COLLAPSED UNTIL YOU OPEN IT ───────────────────────────────────────
   * A template card is a two-field form, a description box, a Save button and a table of every
   * step with four controls per row — 400px and up, each. A family with eight templates had a
   * page nobody could scan: finding the one you came for meant scrolling past every step of
   * every other, and the library is the screen whose whole job is "what have we got?".
   *
   * COLLAPSED BY DEFAULT, which is the decision rather than the default. Open-by-default would
   * make the first visit identical to the page this replaces, so the change would buy nothing
   * for the family it is for; and the header carries the two facts somebody scanning actually
   * wants — the name and how many steps — so a shut card is not a blank one.
   *
   * `hidden` RATHER THAN UNMOUNTING, and it matters here more than usual: the body holds
   * uncommitted edits (`name`, `description`, `scheduler` are all local state) and a step row
   * mid-edit. Unmounting would throw those away every time somebody shut a card to look at
   * another, which is exactly what they would do while comparing two templates. `hidden` also
   * takes the subtree out of the accessibility tree and the tab order, which is what a
   * `sr-only`-style hide would not.
   */
  const [open, setOpen] = useState(false)
  const bodyId = useId()

  const dirty = name.trim() !== template.name
    || description.trim() !== (template.description ?? '')
    || scheduler !== template.whoMaySchedule

  function handleSaveDetails() {
    const nextName = name.trim()
    if (!nextName) { setError('A template needs a name'); return }
    setError('')
    setOfferArchive(false)
    startTransition(async () => {
      const result = await updateGatheringTemplate({
        templateId:     template.id,
        name:           nextName,
        description:    description.trim() || null,
        whoMaySchedule: scheduler,
      })
      if (!result.success) { setError(result.message ?? 'Could not save that template'); return }
      onPatch({
        name: nextName, description: description.trim() || null,
        whoMaySchedule: scheduler,
      })
    })
  }

  function handleArchive(next: boolean) {
    setError('')
    setOfferArchive(false)
    startTransition(async () => {
      const result = await updateGatheringTemplate({ templateId: template.id, isArchived: next })
      if (!result.success) {
        setError(result.message
          ?? (next ? 'Could not archive that template' : 'Could not restore that template'))
        return
      }
      onPatch({ isArchived: next })
    })
  }

  async function handleDelete() {
    const ok = await confirm({
      title: 'Delete template',
      description: `Delete “${template.name}” and ${template.steps.length === 1 ? 'its step' : `its ${template.steps.length} steps`}? `
        + 'No gathering already built from it changes — every task keeps its own copy of what '
        + 'it asked and what was answered. This cannot be undone.',
      confirmLabel: 'Delete template',
      destructive: true,
    })
    if (!ok) return
    setError('')
    setOfferArchive(false)
    startTransition(async () => {
      const result = await deleteGatheringTemplate(template.id)
      if (!result.success) {
        // Surfaced VERBATIM. The action's sentence names how many gatherings were built from
        // this template and says to archive it instead; anything this screen composed from a
        // count that arrived with the page could be stale and would say less.
        setError(result.message ?? 'Could not delete that template')
        setOfferArchive(!template.isArchived)
        return
      }
      onRemove()
    })
  }

  function handleMoveStep(step: TemplateStep, direction: 'up' | 'down') {
    const index = template.steps.findIndex(s => s.id === step.id)
    const target = direction === 'up' ? index - 1 : index + 1
    if (index < 0 || target < 0 || target >= template.steps.length) return
    setStepError('')
    // Optimistic, and put back on refusal: the ORDER is the state these two buttons edit, so
    // leaving the list showing the new order after a failed write would be the screen lying
    // about the template.
    const reordered = [...template.steps]
    const [moved] = reordered.splice(index, 1)
    reordered.splice(target, 0, moved)
    onPatch({ steps: reordered })
    startTransition(async () => {
      const result = await moveTemplateStep({ stepId: step.id, direction })
      if (!result.success) {
        setStepError(result.message ?? 'Could not move that step')
        onPatch({ steps: template.steps })
      }
    })
  }

  async function handleDeleteStep(step: TemplateStep) {
    const ok = await confirm({
      title: 'Delete step',
      description: `Delete the “${step.label}” step from ${template.name}? Any task already `
        + 'created from it keeps its own wording, its assignee and its answer — only the '
        + 'template loses the step. This cannot be undone.',
      confirmLabel: 'Delete step',
      destructive: true,
    })
    if (!ok) return
    setStepError('')
    startTransition(async () => {
      const result = await deleteTemplateStep(step.id)
      if (!result.success) { setStepError(result.message ?? 'Could not delete that step'); return }
      onPatch({ steps: template.steps.filter(s => s.id !== step.id) })
    })
  }

  return (
    <section className={cn('rounded-xl border bg-card p-4 sm:p-5', template.isArchived && 'opacity-80')}>
      <div className="space-y-5">
        {/* ── The template itself ─────────────────────────────────────────────────── */}
        <div className="flex flex-wrap items-start justify-between gap-3">
          {/* ── THE DISCLOSURE IS A BUTTON ON THE TITLE, NOT A HANDLER ON THE CARD ──────
              A `<section>` with an onClick is unreachable by keyboard and invisible to a screen
              reader, and this header already holds two real buttons — Archive and Delete — so a
              click handler on the container would fire underneath both unless each one
              remembered `stopPropagation`. The same reasoning `MemberDetailsDialog`'s trigger
              records, and the reason this is not a native `<details>`/`<summary>` either:
              nesting those buttons inside a `<summary>` is not something to rely on.

              The button's text IS its accessible name, so it says the template's name and the
              step count and needs no `aria-label`. `aria-expanded` and `aria-controls` are what
              make it a disclosure rather than a link to nowhere. */}
          <div className="min-w-0">
            <button
              type="button"
              onClick={() => setOpen(o => !o)}
              aria-expanded={open}
              aria-controls={bodyId}
              className="group flex items-start gap-2 text-left"
            >
              {/* `mt-1` to sit the chevron on the title's cap-height rather than its box, and
                  `shrink-0` so a long template name wraps beside it instead of squashing it.
                  The rotation is the open/shut state — no second glyph to keep in step. */}
              <ChevronRight
                className={cn(
                  'mt-1 h-4 w-4 shrink-0 text-muted-foreground transition-transform duration-200 motion-reduce:transition-none',
                  open && 'rotate-90',
                )}
                aria-hidden="true"
              />
              <span className="min-w-0">
                <span className="block text-lg group-hover:text-brand-accent">{template.name}</span>
                <span className="block text-sm text-muted-foreground">
                  {template.steps.length === 1 ? '1 step' : `${template.steps.length} steps`}
                  {' · '}{usedCaption(template.usedByCount)}
                  {template.isArchived && ' · Archived, so nothing new can be started from it'}
                  {/* UNSAVED EDITS ARE ANNOUNCED ON THE SHUT CARD, because collapsing one is
                      how they become invisible. `dirty` is already computed for the Save
                      button; without this a reader shuts a card mid-edit and has no way to
                      know which of eight templates is holding a change. */}
                  {!open && dirty && ' · Unsaved changes'}
                </span>
              </span>
            </button>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {mayEdit && (
              <Button
                size="sm" variant="outline" disabled={isPending}
                title={template.isArchived
                  ? `Put ${template.name} back in the schedule-from list`
                  : `Take ${template.name} out of the schedule-from list, leaving every gathering as it is`}
                onClick={() => handleArchive(!template.isArchived)}
              >
                {template.isArchived ? 'Restore' : 'Archive'}
              </Button>
            )}
            {mayDelete && (
              <Button
                size="sm" variant="ghost"
                className="h-7 w-7 p-0 text-destructive hover:text-destructive"
                disabled={isPending}
                /* NOT disabled on the use count. The count came with the page and the action
                   re-derives it; the title is what makes the refusal predictable. */
                title={template.usedByCount > 0
                  ? `${template.name} has been used to build ${template.usedByCount} ${template.usedByCount === 1 ? 'gathering' : 'gatherings'}, so it cannot be deleted. Archive it instead.`
                  : `Delete the ${template.name} template`}
                aria-label={`Delete the ${template.name} template`}
                onClick={handleDelete}
              >
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            )}
          </div>
        </div>

        {/* EVERYTHING BELOW THE HEADER IS THE COLLAPSIBLE BODY. `hidden` keeps the subtree
            mounted — see the note on `open` — so uncommitted edits and a half-edited step row
            survive a card being shut and reopened. */}
        <div id={bodyId} hidden={!open} className="space-y-5">
        {mayEdit ? (
          <div className="space-y-3">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor={`name-${template.id}`} required>Name</Label>
                <Input
                  id={`name-${template.id}`}
                  value={name}
                  disabled={isPending}
                  onChange={e => { setName(e.target.value); setError('') }}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor={`scheduler-${template.id}`}>Who can schedule from this</Label>
                <Select
                  id={`scheduler-${template.id}`}
                  value={scheduler}
                  disabled={isPending}
                  onChange={e => setScheduler(e.target.value as GatheringTemplateScheduler)}
                >
                  {GATHERING_TEMPLATE_SCHEDULERS.map(s => (
                    <option key={s} value={s}>{SCHEDULER_LABEL[s]}</option>
                  ))}
                </Select>
                <p className="text-xs text-muted-foreground">{SCHEDULER_HINT[scheduler]}</p>
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor={`description-${template.id}`}>Description</Label>
              <Textarea
                id={`description-${template.id}`}
                autoGrow rows={1}
                placeholder="What this template is for, and anything an organizer should know before scheduling from it."
                value={description}
                disabled={isPending}
                onChange={e => setDescription(e.target.value)}
              />
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Button disabled={!dirty || isPending} onClick={handleSaveDetails}>
                {isPending ? 'Saving…' : 'Save changes'}
              </Button>
              {offerArchive && (
                <Button variant="outline" disabled={isPending} onClick={() => handleArchive(true)}>
                  Archive it instead
                </Button>
              )}
            </div>
            <FormError message={error} />
          </div>
        ) : (
          <div className="space-y-2">
            {template.description && <p className="text-sm">{template.description}</p>}
            <p className="text-sm text-muted-foreground">
              Who can schedule from this: {SCHEDULER_LABEL[template.whoMaySchedule]}
            </p>
            <div className="rounded-xl border bg-muted/40 px-4 py-3 text-sm text-muted-foreground">
              You can view this template but not change it.
            </div>
            <FormError message={error} />
          </div>
        )}

        {/* ── Its steps ───────────────────────────────────────────────────────────── */}
        <div className="space-y-3">
          <div>
            {/* Preflight resets `h3` size and weight to `inherit` and `globals.css`'s base layer
                gives it only a COLOUR, so a class-less `<h3>` is body text in terracotta —
                indistinguishable in weight from the paragraph it heads. */}
            <h3 className="text-sm font-semibold">Steps</h3>
            <p className="text-sm text-muted-foreground">
              One per thing somebody has to do or decide, in the order they will be handed out.
              They are copied onto the tasks of every gathering scheduled from this template, so
              editing one here never changes a gathering already running.
            </p>
          </div>

          {template.steps.length === 0 ? (
            <p className="rounded-xl border bg-muted/40 px-4 py-6 text-sm text-muted-foreground">
              No steps yet. A template with no steps builds a gathering with no work in it.
            </p>
          ) : (
            <div className="overflow-visible rounded-xl border">
              <table className="w-full border-collapse text-sm">
                <thead>
                  <tr className="border-b bg-muted/40 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    <th scope="col" className="px-3 py-2 font-semibold">Step</th>
                    <th scope="col" className={cn('px-3 py-2 font-semibold', COLLAPSING_CELL)}>Asks for</th>
                    <th scope="col" className={cn('px-3 py-2 font-semibold', COLLAPSING_CELL)}>Required</th>
                    <th scope="col" className={cn('px-3 py-2 text-right font-semibold', COLLAPSING_CELL)}>Suggested budget</th>
                    <th scope="col" className="px-3 py-2 font-semibold"><span className="sr-only">Actions</span></th>
                  </tr>
                </thead>
                <tbody>
                  {template.steps.map((step, index) => (
                    <StepRow
                      key={step.id}
                      step={step}
                      siblings={siblings}
                      templateName={template.name}
                      mayEdit={mayEdit}
                      mayDelete={mayDelete}
                      isFirst={index === 0}
                      isLast={index === template.steps.length - 1}
                      parentPending={isPending}
                      onError={setStepError}
                      onPatch={next => onPatch({
                        steps: template.steps.map(s => (s.id === step.id ? { ...s, ...next } : s)),
                      })}
                      onMove={direction => handleMoveStep(step, direction)}
                      onDelete={() => handleDeleteStep(step)}
                    />
                  ))}
                </tbody>
              </table>
            </div>
          )}
          <FormError message={stepError} />

          {mayCreate && (
            <AddStepForm
              templateId={template.id}
              siblings={siblings}
              nextPosition={template.steps.length}
              onAdded={step => onPatch({ steps: [...template.steps, step] })}
            />
          )}
        </div>
        </div>
      </div>
    </section>
  )
}

// ── One step ──────────────────────────────────────────────────────────────────────────

function StepRow({
  step, siblings, templateName, mayEdit, mayDelete, isFirst, isLast, parentPending,
  onError, onPatch, onMove, onDelete,
}: {
  step: TemplateStep
  siblings: { id: string; name: string }[]
  templateName: string
  mayEdit: boolean
  mayDelete: boolean
  isFirst: boolean
  isLast: boolean
  parentPending: boolean
  onError: (message: string) => void
  onPatch: (next: Partial<TemplateStep>) => void
  onMove: (direction: 'up' | 'down') => void
  onDelete: () => void
}) {
  const [label, setLabel] = useState(step.label)
  const [helpText, setHelpText] = useState(step.helpText ?? '')
  const [kind, setKind] = useState<GatheringStepKind>(step.kind)
  const [childId, setChildId] = useState(step.childTemplateId ?? '')
  const [required, setRequired] = useState(step.required)
  // A DOLLAR string in the box, integer cents on the wire — `dollarsToCents` converts once at
  // submit. Nothing in this feature ever stores or posts dollars.
  const [budget, setBudget] = useState(
    step.budgetDefaultCents == null ? '' : (step.budgetDefaultCents / 100).toFixed(2),
  )
  const [isPending, startTransition] = useTransition()
  const busy = isPending || parentPending

  // A TEMPLATE STEP IS ANSWERED BY NOBODY, so neither of these applies to it: there is no
  // task to be required, and no line to budget. Both are FORCED here rather than merely
  // hidden — a step retyped from `money` to `template` would otherwise keep a suggested
  // budget nothing will ever read, and the row would look priced.
  const isChild = kind === 'template'
  const nextRequired = isChild ? false : required
  const nextBudgetCents = isChild || budget.trim() === '' ? null : dollarsToCents(budget)
  const nextChildId = isChild ? childId : null

  const dirty = label.trim() !== step.label
    || helpText.trim() !== (step.helpText ?? '')
    || kind !== step.kind
    || nextChildId !== (step.childTemplateId ?? null)
    || nextRequired !== step.required
    || nextBudgetCents !== step.budgetDefaultCents

  function handleSave() {
    const nextLabel = label.trim()
    if (!nextLabel) { onError('A step needs a label'); return }
    if (isChild && !nextChildId) { onError('Pick the template this step includes'); return }
    onError('')
    startTransition(async () => {
      const result = await updateTemplateStep({
        stepId:             step.id,
        label:              nextLabel,
        kind,
        // Sent WITH the kind, always, because the two are locked to each other in the
        // database and the action reads a kind with no child as "and clear the child".
        childTemplateId:    nextChildId,
        helpText:           helpText.trim() || null,
        required:           nextRequired,
        budgetDefaultCents: nextBudgetCents,
      })
      if (!result.success) { onError(result.message ?? 'Could not save that step'); return }
      onPatch({
        label: nextLabel, kind, helpText: helpText.trim() || null,
        childTemplateId: nextChildId,
        childTemplateName: nextChildId
          ? siblings.find(t => t.id === nextChildId)?.name ?? null
          : null,
        required: nextRequired, budgetDefaultCents: nextBudgetCents,
      })
    })
  }

  /**
   * The child picker, which replaces Required and Suggested budget for a `template` step.
   *
   * Rendered as one element and used twice, exactly like the three below it — see the module
   * header on why a folded copy is the SAME element rather than a second implementation.
   */
  const childSelect = mayEdit ? (
    <Select
      className="h-7 w-full sm:w-44"
      value={childId}
      disabled={busy}
      aria-label={`The template the “${step.label}” step includes`}
      onChange={e => { setChildId(e.target.value); onError('') }}
    >
      <option value="">Pick a template…</option>
      {siblings.map(t => (
        <option key={t.id} value={t.id}>{t.name}</option>
      ))}
    </Select>
  ) : (
    <span className="text-muted-foreground">{step.childTemplateName ?? 'A template'}</span>
  )

  // ── THE THREE CONTROLS THAT FOLD, EACH ONE ELEMENT USED TWICE ─────────────────────
  // See the module header. No `id` on any of them, so each names its row through
  // `aria-label`: below `sm` the column heading that named it is not in the document at all.
  const kindSelect = mayEdit ? (
    <Select
      className="h-7 w-full sm:w-44"
      value={kind}
      disabled={busy}
      aria-label={`What the “${step.label}” step asks for`}
      title={GATHERING_STEP_KIND_HINT[kind]}
      onChange={e => setKind(e.target.value as GatheringStepKind)}
    >
      {GATHERING_STEP_KINDS.map(k => (
        <option key={k} value={k}>{GATHERING_STEP_KIND_LABEL[k]}</option>
      ))}
    </Select>
  ) : (
    <span className="text-muted-foreground">{GATHERING_STEP_KIND_LABEL[step.kind]}</span>
  )

  const requiredBox = mayEdit ? (
    <input
      type="checkbox"
      className="h-4 w-4 rounded border-input accent-primary"
      checked={required}
      disabled={busy}
      aria-label={`“${step.label}” must be answered`}
      onChange={e => setRequired(e.target.checked)}
    />
  ) : (
    <span className="text-muted-foreground">{step.required ? 'Yes' : 'No'}</span>
  )

  const budgetInput = mayEdit ? (
    <Input
      type="number" min="0" step="0.01"
      className="h-7 w-full text-right sm:w-28"
      placeholder="—"
      value={budget}
      disabled={busy}
      aria-label={`Suggested budget for “${step.label}”, in dollars`}
      onChange={e => setBudget(e.target.value)}
    />
  ) : (
    <span className="text-muted-foreground">
      {step.budgetDefaultCents == null ? '—' : formatCurrency(step.budgetDefaultCents)}
    </span>
  )

  return (
    <tr className="border-b align-top last:border-0 sm:align-middle">
      <td className="px-3 py-2.5">
        {mayEdit ? (
          <div className="space-y-1.5">
            <Input
              className="h-7"
              value={label}
              disabled={busy}
              aria-label={`Label for the “${step.label}” step`}
              onChange={e => { setLabel(e.target.value); onError('') }}
            />
            <Textarea
              autoGrow rows={1}
              className="text-xs"
              placeholder="Help text the assignee reads (optional)"
              value={helpText}
              disabled={busy}
              aria-label={`Help text for “${step.label}”`}
              onChange={e => setHelpText(e.target.value)}
            />
          </div>
        ) : (
          <div>
            <span className="font-medium">{step.label}</span>
            {step.helpText && (
              <p className="mt-0.5 text-xs text-muted-foreground">{step.helpText}</p>
            )}
          </div>
        )}
        {/* LABELLED, because a bare select and a bare number box under a step's name are a
            coin toss once the headings that told them apart have folded away. */}
        <RowMeta className="gap-x-2">
          <span className="flex items-center gap-1.5"><span>Asks for</span>{kindSelect}</span>
          <MetaDot />
          {isChild ? (
            <span className="flex items-center gap-1.5"><span>Includes</span>{childSelect}</span>
          ) : (
            <>
              <span className="flex items-center gap-1.5"><span>Required</span>{requiredBox}</span>
              <MetaDot />
              <span className="flex items-center gap-1.5"><span>Budget $</span>{budgetInput}</span>
            </>
          )}
        </RowMeta>
      </td>
      <td className={cn('px-3 py-2.5', COLLAPSING_CELL)}>
        {kindSelect}
        {/* Authoring guidance, not a control — which is why it is NOT part of the element
            rendered twice: the folded copy carries it as the select's `title` instead. A hint
            per row inside a `RowMeta` would be a paragraph under every step. */}
        <p className="mt-1 max-w-44 text-xs text-muted-foreground">
          {GATHERING_STEP_KIND_HINT[mayEdit ? kind : step.kind]}
        </p>
      </td>
      {/* ONE CELL SPANNING TWO FOR A TEMPLATE STEP, rather than a picker in one column and an
          em dash in the other. Neither Required nor a budget means anything for a step nobody
          answers, and a blank cell under a heading reads as a value somebody forgot. */}
      {isChild ? (
        <td className={cn('px-3 py-2.5', COLLAPSING_CELL)} colSpan={2}>{childSelect}</td>
      ) : (
        <>
          <td className={cn('px-3 py-2.5', COLLAPSING_CELL)}>{requiredBox}</td>
          <td className={cn('px-3 py-2.5 text-right tabular-nums', COLLAPSING_CELL)}>{budgetInput}</td>
        </>
      )}
      <td className="w-px px-3 py-2.5">
        <div className="flex items-center justify-end gap-1">
          {mayEdit && dirty && (
            <Button size="sm" disabled={busy} onClick={handleSave}>
              {isPending ? 'Saving…' : 'Save'}
            </Button>
          )}
          {mayEdit && (
            <>
              <Button
                size="sm" variant="ghost" className="h-7 w-7 p-0"
                disabled={busy || isFirst}
                title={`Move “${step.label}” earlier in ${templateName}`}
                aria-label={`Move “${step.label}” earlier`}
                onClick={() => onMove('up')}
              >
                <ArrowUp className="h-3.5 w-3.5" />
              </Button>
              <Button
                size="sm" variant="ghost" className="h-7 w-7 p-0"
                disabled={busy || isLast}
                title={`Move “${step.label}” later in ${templateName}`}
                aria-label={`Move “${step.label}” later`}
                onClick={() => onMove('down')}
              >
                <ArrowDown className="h-3.5 w-3.5" />
              </Button>
            </>
          )}
          {mayDelete && (
            <Button
              size="sm" variant="ghost"
              className="h-7 w-7 p-0 text-destructive hover:text-destructive"
              disabled={busy}
              title={`Delete the “${step.label}” step`}
              aria-label={`Delete the “${step.label}” step`}
              onClick={onDelete}
            >
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          )}
        </div>
      </td>
    </tr>
  )
}

// ── Adding a step ─────────────────────────────────────────────────────────────────────

/**
 * The add-step form, which is where the KIND HINT earns its place.
 *
 * This is the moment the choice between the seven kinds is actually made, and it is the one
 * place with room for a sentence about it — so `GATHERING_STEP_KIND_HINT` for the selected
 * kind is printed under the picker and changes with it. A row in the table above prints the
 * same line in its own cell, and carries it as the select's `title` where that cell folds.
 */
function AddStepForm({
  templateId, siblings, nextPosition, onAdded,
}: {
  templateId: string
  siblings: { id: string; name: string }[]
  nextPosition: number
  onAdded: (step: TemplateStep) => void
}) {
  const [label, setLabel] = useState('')
  const [kind, setKind] = useState<GatheringStepKind>('text')
  const [childId, setChildId] = useState('')
  const [helpText, setHelpText] = useState('')
  const [required, setRequired] = useState(false)
  const [budget, setBudget] = useState('')
  const [error, setError] = useState('')
  const [isPending, startTransition] = useTransition()

  // See `StepRow`: a template step is answered by nobody, so it carries no help text for an
  // assignee, cannot be required and cannot be budgeted. Forced rather than hidden, so a form
  // half-filled under one kind cannot post values under another.
  const isChild = kind === 'template'

  function handleAdd() {
    const nextLabel = label.trim()
    if (!nextLabel) return
    if (isChild && !childId) { setError('Pick the template this step includes'); return }
    setError('')
    const budgetDefaultCents = isChild || budget.trim() === '' ? null : dollarsToCents(budget)
    const nextRequired = isChild ? false : required
    const childTemplateId = isChild ? childId : null
    startTransition(async () => {
      const result = await addTemplateStep({
        templateId,
        label:    nextLabel,
        kind,
        childTemplateId,
        helpText: isChild ? undefined : helpText.trim() || undefined,
        required: nextRequired,
        budgetDefaultCents,
      })
      if (!result.success || !result.stepId) {
        setError(result.message ?? 'Could not add that step')
        return
      }
      const stepId = result.stepId
      const addedHelpText = isChild ? null : helpText.trim() || null
      const childName = childTemplateId
        ? siblings.find(t => t.id === childTemplateId)?.name ?? null
        : null
      setLabel(''); setHelpText(''); setBudget(''); setRequired(false); setChildId('')
      onAdded({
        id: stepId, position: nextPosition, label: nextLabel,
        helpText: addedHelpText, kind, required: nextRequired, budgetDefaultCents,
        childTemplateId, childTemplateName: childName,
      })
    })
  }

  return (
    <div className="space-y-3 rounded-xl border border-dashed p-3 sm:p-4">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor={`step-label-${templateId}`} required>Add a step</Label>
          <Input
            id={`step-label-${templateId}`}
            placeholder="e.g. Book the hall"
            value={label}
            onChange={e => { setLabel(e.target.value); setError('') }}
            onKeyDown={e => { if (e.key === 'Enter') handleAdd() }}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor={`step-kind-${templateId}`}>What it asks for</Label>
          <Select
            id={`step-kind-${templateId}`}
            value={kind}
            onChange={e => { setKind(e.target.value as GatheringStepKind); setError('') }}
          >
            {GATHERING_STEP_KINDS.map(k => (
              // "Another template" is offered only where there IS another template. A picker
              // whose one interesting option leads to an empty second picker is worse than not
              // offering it — and a family with a single template genuinely has nothing to
              // include.
              (k !== 'template' || siblings.length > 0) && (
                <option key={k} value={k}>{GATHERING_STEP_KIND_LABEL[k]}</option>
              )
            ))}
          </Select>
          <p className="text-xs text-muted-foreground">{GATHERING_STEP_KIND_HINT[kind]}</p>
        </div>
      </div>

      {/* ── The template this step includes ────────────────────────────────────────
          Only for the one kind it belongs to. It sits on its own row rather than beside the
          kind picker because picking a kind is what makes it appear, and a control that
          materialises next to the one you just used is easier to miss than one below it. */}
      {isChild && (
        <div className="space-y-1.5">
          <Label htmlFor={`step-child-${templateId}`} required>Template to include</Label>
          <Select
            id={`step-child-${templateId}`}
            value={childId}
            onChange={e => { setChildId(e.target.value); setError('') }}
          >
            <option value="">Pick a template…</option>
            {siblings.map(t => (
              <option key={t.id} value={t.id}>{t.name}</option>
            ))}
          </Select>
          <p className="text-xs text-muted-foreground">
            Every step of that template becomes a task of its own here, in its own order, at
            this point in the list. Nobody answers this step — it is the checklist, not a
            question. A template cannot include itself, or anything that leads back to it.
          </p>
        </div>
      )}
      {!isChild && (
      <div className="space-y-1.5">
        <Label htmlFor={`step-help-${templateId}`}>Help text</Label>
        <Textarea
          id={`step-help-${templateId}`}
          autoGrow rows={1}
          placeholder="What the assignee should know — who to call, what counts as done."
          value={helpText}
          onChange={e => setHelpText(e.target.value)}
        />
      </div>
      )}
      {!isChild && (
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div className="space-y-1.5">
          <label className="flex cursor-pointer items-center gap-2 select-none">
            <input
              type="checkbox"
              checked={required}
              onChange={e => setRequired(e.target.checked)}
              className="h-4 w-4 rounded border-input accent-primary"
            />
            <span className="text-sm font-medium">Required</span>
          </label>
          <p className="text-xs text-muted-foreground">
            {required
              ? 'The gathering is not finished until this one is answered and approved.'
              : 'Useful but optional — the gathering can be completed without it.'}
          </p>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor={`step-budget-${templateId}`}>Suggested budget ($)</Label>
          <Input
            id={`step-budget-${templateId}`}
            type="number" min="0" step="0.01"
            placeholder="Optional"
            value={budget}
            onChange={e => setBudget(e.target.value)}
          />
          <p className="text-xs text-muted-foreground">
            A starting figure copied onto the task. An organizer can change it on the
            gathering, and the money that counts is the gathering’s own budget.
          </p>
        </div>
      </div>
      )}
      <FormError message={error} />
      <Button variant="affirm" disabled={!label.trim() || isPending} onClick={handleAdd}>
        <Plus className="h-4 w-4" /> {isPending ? 'Adding…' : 'Add step'}
      </Button>
    </div>
  )
}
