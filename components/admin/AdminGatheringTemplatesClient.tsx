'use client'

import { useId, useState, useTransition } from 'react'
import { ArrowDown, ArrowUp, ChevronRight, Pencil, Plus, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Dialog } from '@/components/ui/dialog'
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
 * ── EVERYTHING IS READ-ONLY UNTIL YOU OPEN A DIALOG, SINCE 2026-08-20 ──────────────
 * This screen used to be editable in place: the template's name, description and scheduler
 * were live inputs on the card, every step row held four live controls, and both "add" forms
 * were permanently expanded blocks. It read as a form with a hundred fields on it rather than
 * as a library, and the cost was concentrated in the one thing the screen exists for —
 * answering *what have we got?*
 *
 * Four consequences, and each is why the shape below is what it is:
 *
 *   * **A card states facts.** Name, description, who may schedule, and a table of steps as
 *     TEXT. Nothing on it can be typed into, so it can be scanned.
 *   * **One Edit button per thing, and it opens a dialog.** `TemplateDialog` for the template,
 *     `StepDialog` for a step. Both are also the ADD form, with no template or step passed —
 *     which is the whole reason they are one component each: an add form and an edit form for
 *     the same record that drift apart is how a field ends up settable in one and not the
 *     other.
 *   * **No uncommitted state on the card at all.** The old version held `name`, `description`
 *     and `scheduler` in the card and five more per step row, which needed a `dirty` flag, an
 *     "Unsaved changes" note on the collapsed header, and a Save button per row. All of it is
 *     gone: a dialog either saves or is dismissed, so there is no third state to describe.
 *   * **A folded column prints a VALUE now.** The old rows carried controls, and a folded
 *     column holding a control goes read-only on a phone — so each one had to be rendered
 *     twice, once in its cell and once in the `RowMeta`, bound to the same state. Read-only
 *     rows need none of that: `RowMeta` restates the same strings the cells hold.
 *
 * ── THE CARD IS STILL COLLAPSED UNTIL YOU OPEN IT ──────────────────────────────────
 * A card is now much shorter, and the argument survives at a smaller scale: a family with
 * eight templates and sixty steps between them still cannot scan a page that draws every step
 * of every template. The header carries the name, the step count and how many gatherings were
 * built from it, so a shut card is not a blank one.
 *
 * `hidden` RATHER THAN UNMOUNTING, and the reason CHANGED with this redesign — it used to be
 * that the body held uncommitted edits which unmounting would discard. It holds none now. What
 * is left is smaller and still real: `hidden` keeps the table's DOM and scroll position across
 * a shut-and-reopen, and it takes the subtree out of the accessibility tree and the tab order,
 * which is what a `sr-only`-style hide would not. Unmounting would also be defensible today;
 * this is the cheaper of two correct answers rather than the only correct one.
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
 * A template is a few facts (name, description, who may schedule from it) sitting over an
 * ORDERED LIST of steps, and those two things want different treatments. The steps are rows
 * answering the same questions about each other — what does it ask for, is it required, what
 * does it suggest spending — so they are a real `<table>` with `<th scope="col">`, folding on
 * a phone through `COLLAPSING_CELL` rather than scrolling sideways (AGENTS.md, "A table is a
 * table" and "On a phone a table narrows").
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

/**
 * A THREE-ROW BOX, NEVER AN AUTO-GROWING ONE, for every long-text field in this file.
 *
 * `Textarea` takes `autoGrow`, and both of these fields used it with `rows={1}` — a box that
 * starts at one line and stretches to fit whatever is in it, up to eight. On this screen that
 * was the wrong default twice over: an existing template with a paragraph of description
 * rendered an eight-row box, and a step's help text did the same INSIDE A TABLE CELL, so one
 * wordy step made its row four times the height of its neighbours and the table stopped being
 * scannable.
 *
 * Three fixed rows is enough to see what you are editing and short enough that the dialog's
 * Save button stays on screen on a phone, which is the failure `components/ui/dialog.tsx` caps
 * its own height to avoid. Past three rows it scrolls, which is the ordinary behaviour of a
 * textarea and is what somebody typing a long description expects.
 */
const LONG_TEXT_ROWS = 3

// ── The template dialog: ADD and EDIT are one component ───────────────────────────────

/**
 * Add a template, or change one — the same three fields either way.
 *
 * ONE COMPONENT FOR BOTH, and it is the point rather than a saving. The old screen had an
 * inline "Add a template" section offering name and scheduler, and a separate in-card form
 * offering name, scheduler AND description; so a template could not be given a description
 * until after it existed, for no reason anybody had decided — the add form simply had less
 * room. Two forms over one record drift, and that was the drift.
 *
 * `template === null` is the add case. Everything else — the fields, the validation, the
 * scheduler hint — is shared by construction.
 */
function TemplateDialog({
  template, onClose, onSaved,
}: {
  /** The template being edited, or null to add a new one. */
  template: GatheringTemplate | null
  onClose: () => void
  /**
   * Handed the saved values. The parent owns the list, so it decides whether this is a patch
   * or an append — this component never touches `templates`.
   */
  onSaved: (values: {
    name: string
    description: string | null
    whoMaySchedule: GatheringTemplateScheduler
    /** Present only when a template was just created. */
    createdId?: string
  }) => void
}) {
  const adding = template === null
  const [name, setName] = useState(template?.name ?? '')
  const [description, setDescription] = useState(template?.description ?? '')
  const [scheduler, setScheduler] = useState<GatheringTemplateScheduler>(
    template?.whoMaySchedule ?? 'admin')
  const [error, setError] = useState('')
  const [isPending, startTransition] = useTransition()

  // Disabled while nothing has changed, so a dialog opened to look at a template cannot spend
  // a round trip saying nothing. On the add form there is nothing to compare against, so the
  // name being non-empty is the whole test.
  const dirty = adding || name.trim() !== template.name
    || description.trim() !== (template.description ?? '')
    || scheduler !== template.whoMaySchedule

  function handleSave() {
    const nextName = name.trim()
    if (!nextName) { setError('A template needs a name'); return }
    setError('')
    const nextDescription = description.trim() || null

    startTransition(async () => {
      if (adding) {
        const result = await createGatheringTemplate({
          name: nextName,
          // `undefined` rather than null: the action's parameter is `description?: string`,
          // and a create has nothing to clear.
          description: nextDescription ?? undefined,
          whoMaySchedule: scheduler,
        })
        if (!result.success || !result.templateId) {
          setError(result.message ?? 'Could not add that template')
          return
        }
        onSaved({
          name: nextName, description: nextDescription, whoMaySchedule: scheduler,
          createdId: result.templateId,
        })
      } else {
        const result = await updateGatheringTemplate({
          templateId:     template.id,
          name:           nextName,
          description:    nextDescription,
          whoMaySchedule: scheduler,
        })
        if (!result.success) {
          setError(result.message ?? 'Could not save that template')
          return
        }
        onSaved({ name: nextName, description: nextDescription, whoMaySchedule: scheduler })
      }
      onClose()
    })
  }

  return (
    <Dialog
      open
      onClose={onClose}
      title={adding ? 'Add a template' : `Edit ${template.name}`}
      description={adding
        ? 'Name it for the occasion — “Family Reunion”, “Memorial Service”, “Scholarship Banquet”. Its steps are added on the card once it is on the list.'
        : 'Changing a template never changes a gathering already built from it — every task keeps its own copy of what it asked.'}
      className="max-w-xl"
    >
      <div className="mt-2 space-y-4">
        <div className="space-y-1.5">
          <Label htmlFor="template-name" required>Template name</Label>
          <Input
            id="template-name"
            placeholder="e.g. Family Reunion"
            value={name}
            disabled={isPending}
            onChange={e => { setName(e.target.value); setError('') }}
            // Enter saves from the name field, which is where somebody adding a template stops
            // typing. Not on the textarea below, where Enter is a newline.
            onKeyDown={e => { if (e.key === 'Enter') handleSave() }}
          />
        </div>

        {/* NO "Usual location" FIELD, since 2026-08-19, and its absence is a decision — see the
            module header. A step of kind **A place** does that job properly. */}
        <div className="space-y-1.5">
          <Label htmlFor="template-description">Description</Label>
          <Textarea
            id="template-description"
            rows={LONG_TEXT_ROWS}
            placeholder="What this template is for, and anything an organizer should know before scheduling from it."
            value={description}
            disabled={isPending}
            onChange={e => setDescription(e.target.value)}
          />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="template-scheduler">Who can schedule from this</Label>
          <Select
            id="template-scheduler"
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

        <FormError message={error} />

        {/* The message sits with the buttons rather than beside the field it is about: the
            dialog body scrolls and this footer does not, so a message rendered next to an
            input can be off-screen at the moment somebody presses Save again. */}
        <div className="flex flex-col-reverse gap-2 border-t pt-4 sm:flex-row sm:justify-end">
          <Button variant="outline" disabled={isPending} onClick={onClose}>Cancel</Button>
          <Button
            variant={adding ? 'affirm' : 'default'}
            disabled={!name.trim() || !dirty || isPending}
            onClick={handleSave}
          >
            {adding
              ? (isPending ? 'Adding…' : 'Add template')
              : (isPending ? 'Saving…' : 'Save changes')}
          </Button>
        </div>
      </div>
    </Dialog>
  )
}

// ── The step dialog: ADD and EDIT are one component ───────────────────────────────────

/**
 * Add a step, or change one.
 *
 * ONE COMPONENT FOR BOTH, for `TemplateDialog`'s reason and with a sharper example of the
 * drift it prevents: the old add form omitted help text for a `template` step (`helpText:
 * isChild ? undefined : …`) while the old edit row sent it regardless. Two code paths, one
 * record, and a field that behaved differently depending on which one you used.
 *
 * ── THIS IS WHERE THE KIND HINT EARNS ITS PLACE ────────────────────────────────────
 * Choosing between the seven kinds happens here, and this is the one surface with room for a
 * sentence about it — so `GATHERING_STEP_KIND_HINT` for the selected kind is printed under the
 * picker and changes with it. The read-only table behind the dialog prints the same line in its
 * own cell.
 */
function StepDialog({
  step, templateId, templateName, siblings, nextPosition, onClose, onSaved,
}: {
  /** The step being edited, or null to add one. */
  step: TemplateStep | null
  templateId: string
  templateName: string
  siblings: { id: string; name: string }[]
  /** Where an added step lands. Ignored when editing. */
  nextPosition: number
  onClose: () => void
  onSaved: (step: TemplateStep) => void
}) {
  const adding = step === null
  const [label, setLabel] = useState(step?.label ?? '')
  const [kind, setKind] = useState<GatheringStepKind>(step?.kind ?? 'text')
  const [childId, setChildId] = useState(step?.childTemplateId ?? '')
  const [helpText, setHelpText] = useState(step?.helpText ?? '')
  const [required, setRequired] = useState(step?.required ?? false)
  // A DOLLAR string in the box, integer cents on the wire — `dollarsToCents` converts once at
  // submit. Nothing in this feature ever stores or posts dollars.
  const [budget, setBudget] = useState(
    step?.budgetDefaultCents == null ? '' : (step.budgetDefaultCents / 100).toFixed(2))
  const [error, setError] = useState('')
  const [isPending, startTransition] = useTransition()

  // A TEMPLATE STEP IS ANSWERED BY NOBODY, so none of these applies to it: there is no task to
  // be required, no line to budget, and no assignee to read help text. All three are FORCED
  // here rather than merely hidden — a form half-filled under one kind must not post values
  // under another, and a step retyped from `money` to `template` must not keep a suggested
  // budget nothing will ever read.
  const isChild = kind === 'template'
  const nextRequired = isChild ? false : required
  const nextBudgetCents = isChild || budget.trim() === '' ? null : dollarsToCents(budget)
  const nextChildId = isChild ? childId : null
  const nextHelpText = isChild ? null : helpText.trim() || null

  const dirty = adding
    || label.trim() !== step.label
    || kind !== step.kind
    || nextChildId !== (step.childTemplateId ?? null)
    || nextHelpText !== (step.helpText ?? null)
    || nextRequired !== step.required
    || nextBudgetCents !== step.budgetDefaultCents

  function handleSave() {
    const nextLabel = label.trim()
    if (!nextLabel) { setError('A step needs a label'); return }
    if (isChild && !nextChildId) { setError('Pick the template this step includes'); return }
    setError('')

    const childName = nextChildId
      ? siblings.find(t => t.id === nextChildId)?.name ?? null
      : null

    startTransition(async () => {
      if (adding) {
        const result = await addTemplateStep({
          templateId,
          label:    nextLabel,
          kind,
          childTemplateId:    nextChildId,
          helpText:           nextHelpText ?? undefined,
          required:           nextRequired,
          budgetDefaultCents: nextBudgetCents,
        })
        if (!result.success || !result.stepId) {
          setError(result.message ?? 'Could not add that step')
          return
        }
        onSaved({
          id: result.stepId, position: nextPosition, label: nextLabel,
          helpText: nextHelpText, kind, required: nextRequired,
          budgetDefaultCents: nextBudgetCents,
          childTemplateId: nextChildId, childTemplateName: childName,
        })
      } else {
        const result = await updateTemplateStep({
          stepId: step.id,
          label:  nextLabel,
          kind,
          // Sent WITH the kind, always, because the two are locked to each other in the
          // database and the action reads a kind with no child as "and clear the child".
          childTemplateId:    nextChildId,
          helpText:           nextHelpText,
          required:           nextRequired,
          budgetDefaultCents: nextBudgetCents,
        })
        if (!result.success) {
          setError(result.message ?? 'Could not save that step')
          return
        }
        onSaved({
          ...step,
          label: nextLabel, kind, helpText: nextHelpText,
          childTemplateId: nextChildId, childTemplateName: childName,
          required: nextRequired, budgetDefaultCents: nextBudgetCents,
        })
      }
      onClose()
    })
  }

  return (
    <Dialog
      open
      onClose={onClose}
      title={adding ? `Add a step to ${templateName}` : `Edit “${step.label}”`}
      description="One step per thing somebody has to do or decide. Steps are copied onto the tasks of every gathering scheduled from this template, so editing one never changes a gathering already running."
      className="max-w-xl"
    >
      <div className="mt-2 space-y-4">
        <div className="space-y-1.5">
          <Label htmlFor="step-label" required>Step</Label>
          <Input
            id="step-label"
            placeholder="e.g. Book the hall"
            value={label}
            disabled={isPending}
            onChange={e => { setLabel(e.target.value); setError('') }}
            onKeyDown={e => { if (e.key === 'Enter') handleSave() }}
          />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="step-kind">What it asks for</Label>
          <Select
            id="step-kind"
            value={kind}
            disabled={isPending}
            onChange={e => { setKind(e.target.value as GatheringStepKind); setError('') }}
          >
            {GATHERING_STEP_KINDS.map(k => (
              // "Another template" is offered only where there IS another template, or where
              // this step is already one — a step that has been saved as a `template` kind must
              // keep its own kind in the picker, or opening its dialog would silently retype
              // it. A family with a single template genuinely has nothing to include.
              (k !== 'template' || siblings.length > 0 || step?.kind === 'template') && (
                <option key={k} value={k}>{GATHERING_STEP_KIND_LABEL[k]}</option>
              )
            ))}
          </Select>
          <p className="text-xs text-muted-foreground">{GATHERING_STEP_KIND_HINT[kind]}</p>
        </div>

        {/* ── The template this step includes ────────────────────────────────────────
            Only for the one kind it belongs to. It sits on its own row rather than beside the
            kind picker because picking a kind is what makes it appear, and a control that
            materialises next to the one you just used is easier to miss than one below it. */}
        {isChild && (
          <div className="space-y-1.5">
            <Label htmlFor="step-child" required>Template to include</Label>
            <Select
              id="step-child"
              value={childId}
              disabled={isPending}
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
            <Label htmlFor="step-help">Help text</Label>
            <Textarea
              id="step-help"
              rows={LONG_TEXT_ROWS}
              placeholder="What the assignee should know — who to call, what counts as done."
              value={helpText}
              disabled={isPending}
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
                  disabled={isPending}
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
              <Label htmlFor="step-budget">Suggested budget ($)</Label>
              <Input
                id="step-budget"
                type="number" min="0" step="0.01"
                placeholder="Optional"
                value={budget}
                disabled={isPending}
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

        <div className="flex flex-col-reverse gap-2 border-t pt-4 sm:flex-row sm:justify-end">
          <Button variant="outline" disabled={isPending} onClick={onClose}>Cancel</Button>
          <Button
            variant={adding ? 'affirm' : 'default'}
            disabled={!label.trim() || !dirty || isPending}
            onClick={handleSave}
          >
            {adding
              ? (isPending ? 'Adding…' : 'Add step')
              : (isPending ? 'Saving…' : 'Save changes')}
          </Button>
        </div>
      </div>
    </Dialog>
  )
}

// ── The library ───────────────────────────────────────────────────────────────────────

export function AdminGatheringTemplatesClient({
  initialTemplates, mayCreate, mayEdit, mayDelete,
}: Props) {
  // `useServerState`, never `useState`: every write below ends in a `revalidatePath`, and
  // `router.refresh()` merges the new payload WITHOUT discarding client state — a plain
  // initializer is read once per visit and every later server render ignored, which is what
  // makes a freshly added row appear only after navigating away and back.
  const [templates, setTemplates] = useServerState(initialTemplates)
  const [adding, setAdding] = useState(false)

  function patchTemplate(id: string, next: Partial<GatheringTemplate>) {
    setTemplates(prev => sortTemplates(prev.map(t => (t.id === id ? { ...t, ...next } : t))))
  }

  return (
    <div className="space-y-6">
      {mayCreate && (
        <div className="flex justify-end">
          {/* `affirm`, like every other create trigger in this feature. It was the default
              burgundy once, which is what an ACTIVE RAIL ITEM looks like. The icon is a bare
              `Plus`: `CirclePlus` is the tree's glyph for a create trigger in a `MainRail`
              action slot, and every other "Add …" button uses `Plus`. */}
          <Button variant="affirm" onClick={() => setAdding(true)}>
            <Plus className="h-4 w-4" /> Add template
          </Button>
        </div>
      )}

      {adding && (
        <TemplateDialog
          template={null}
          onClose={() => setAdding(false)}
          onSaved={values => {
            if (!values.createdId) return
            // THE OPTIMISTIC ROW CARRIES EVERY FIELD THE INTERFACE DECLARES, including the
            // ones the form does not offer. That is the reason a widened interface is not a
            // free change: a row built here that is missing a field is not a stale render, it
            // is a type error — which is the right failure, and is how the `defaultLocation`
            // one was found before that column was dropped again.
            setTemplates(prev => sortTemplates([...prev, {
              id: values.createdId!, name: values.name, description: values.description,
              whoMaySchedule: values.whoMaySchedule, isArchived: false,
              steps: [], usedByCount: 0,
            }]))
          }}
        />
      )}

      {templates.length === 0 ? (
        <p className="rounded-xl border bg-muted/40 px-4 py-6 text-sm text-muted-foreground">
          No gathering templates yet.{' '}
          {mayCreate
            ? 'Add one, then give it a step for each thing somebody has to do.'
            : 'Somebody who can add templates has to create the first one.'}
        </p>
      ) : (
        <div className="space-y-6">
          {templates.map(template => (
            // Keyed by the row id, which is per-family — so switching family replaces the ids
            // and React remounts every card, and nothing inside can go on describing the
            // family the member just left (AGENTS.md, "Switching family remounts the page").
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
  const [error, setError] = useState('')
  // Set when `deleteGatheringTemplate` refuses because a gathering was built from this
  // template. Its sentence tells the reader to archive it instead; this is what puts that
  // action beside the sentence rather than somewhere else on the card.
  const [offerArchive, setOfferArchive] = useState(false)
  const [stepError, setStepError] = useState('')
  const [isPending, startTransition] = useTransition()

  // ── WHICH DIALOG IS OPEN ──────────────────────────────────────────────────────────
  // Three booleans-or-ids rather than one union, because they answer different questions and
  // only one can be true at a time anyway (a dialog is modal). `editingStep` holds the STEP
  // rather than its id: the dialog needs every field, and looking the id back up would go
  // stale against the optimistic patch that a save has just applied.
  const [editingTemplate, setEditingTemplate] = useState(false)
  const [addingStep, setAddingStep] = useState(false)
  const [editingStep, setEditingStep] = useState<TemplateStep | null>(null)

  /**
   * ── THE CARD IS COLLAPSED UNTIL YOU OPEN IT ───────────────────────────────────────
   * See the module header for why, and for why this is `hidden` rather than an unmount.
   */
  const [open, setOpen] = useState(false)
  const bodyId = useId()

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
        {/* ── The header ──────────────────────────────────────────────────────────── */}
        <div className="flex flex-wrap items-start justify-between gap-3">
          {/* ── THE DISCLOSURE IS A BUTTON ON THE TITLE, NOT A HANDLER ON THE CARD ──────
              A `<section>` with an onClick is unreachable by keyboard and invisible to a screen
              reader, and this header already holds real buttons — Edit, Archive, Delete — so a
              click handler on the container would fire underneath all of them unless each one
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
                  {/* NO "Unsaved changes" NOTE, and nothing to put in one: every edit now
                      happens in a dialog that either saves or is dismissed, so a shut card
                      cannot be holding a draft. That note existed because it could. */}
                </span>
              </span>
            </button>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {mayEdit && (
              <Button
                size="sm" variant="outline" disabled={isPending}
                aria-label={`Edit the ${template.name} template`}
                onClick={() => setEditingTemplate(true)}
              >
                <Pencil className="mr-1.5 h-3.5 w-3.5" aria-hidden="true" /> Edit
              </Button>
            )}
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

        {/* EVERYTHING BELOW THE HEADER IS THE COLLAPSIBLE BODY. */}
        <div id={bodyId} hidden={!open} className="space-y-5">
          {/* ── The template's own facts, as facts ─────────────────────────────────────
              A definition list rather than a two-column table: these are labelled values
              about ONE subject, which is what `<dt>`/`<dd>` says — the same treatment
              `MemberDetailsDialog` and the money ledgers use for one record in full. */}
          <dl className="divide-y text-sm">
            <div className="flex gap-4 py-2">
              <dt className="w-40 shrink-0 text-muted-foreground">Description</dt>
              {/* An em-dash for absent, which is what a missing value looks like everywhere
                  else in this product. `whitespace-pre-line` so a description written with
                  paragraphs reads back the way it was typed. */}
              <dd className="min-w-0 flex-1 whitespace-pre-line break-words">
                {template.description || '—'}
              </dd>
            </div>
            <div className="flex gap-4 py-2">
              <dt className="w-40 shrink-0 text-muted-foreground">Who can schedule</dt>
              <dd className="min-w-0 flex-1">
                {SCHEDULER_LABEL[template.whoMaySchedule]}
                <span className="mt-0.5 block text-xs text-muted-foreground">
                  {SCHEDULER_HINT[template.whoMaySchedule]}
                </span>
              </dd>
            </div>
          </dl>

          {!mayEdit && (
            <div className="rounded-xl border bg-muted/40 px-4 py-3 text-sm text-muted-foreground">
              You can view this template but not change it.
            </div>
          )}

          <div className="flex flex-wrap items-center gap-2">
            {offerArchive && (
              <Button variant="outline" disabled={isPending} onClick={() => handleArchive(true)}>
                Archive it instead
              </Button>
            )}
          </div>
          <FormError message={error} />

          {/* ── Its steps ───────────────────────────────────────────────────────────── */}
          <div className="space-y-3">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div>
                {/* Preflight resets `h3` size and weight to `inherit` and `globals.css`'s base
                    layer gives it only a COLOUR, so a class-less `<h3>` is body text in
                    terracotta — indistinguishable in weight from the paragraph it heads. */}
                <h3 className="text-sm font-semibold">Steps</h3>
                <p className="text-sm text-muted-foreground">
                  One per thing somebody has to do or decide, in the order they will be handed
                  out. They are copied onto the tasks of every gathering scheduled from this
                  template, so editing one here never changes a gathering already running.
                </p>
              </div>
              {mayCreate && (
                <Button variant="affirm" size="sm" onClick={() => setAddingStep(true)}>
                  <Plus className="h-4 w-4" /> Add step
                </Button>
              )}
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
                        templateName={template.name}
                        mayEdit={mayEdit}
                        mayDelete={mayDelete}
                        isFirst={index === 0}
                        isLast={index === template.steps.length - 1}
                        busy={isPending}
                        onEdit={() => setEditingStep(step)}
                        onMove={direction => handleMoveStep(step, direction)}
                        onDelete={() => handleDeleteStep(step)}
                      />
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            <FormError message={stepError} />
          </div>
        </div>
      </div>

      {/* ── The dialogs ──────────────────────────────────────────────────────────────
          MOUNTED ONLY WHILE OPEN, and the step one is KEYED ON THE STEP. The key is what
          discards the previous step's field values when a second row's Edit is pressed — the
          same mechanism AGENTS.md uses at `<main key={familyCode}>`, and the reason these
          dialogs need no reset logic of their own. Without it, opening one step after another
          would render the first one's values under the second one's title.

          Rendered OUTSIDE the collapsible body: a dialog is `fixed` and modal, so its position
          in the tree is not where it draws — but `hidden` on an ancestor takes the subtree out
          of the accessibility tree, which would silence the dialog for a screen reader if a
          card were somehow shut while one was open. */}
      {editingTemplate && (
        <TemplateDialog
          template={template}
          onClose={() => setEditingTemplate(false)}
          onSaved={values => onPatch({
            name: values.name,
            description: values.description,
            whoMaySchedule: values.whoMaySchedule,
          })}
        />
      )}
      {addingStep && (
        <StepDialog
          step={null}
          templateId={template.id}
          templateName={template.name}
          siblings={siblings}
          nextPosition={template.steps.length}
          onClose={() => setAddingStep(false)}
          onSaved={step => onPatch({ steps: [...template.steps, step] })}
        />
      )}
      {editingStep && (
        <StepDialog
          key={editingStep.id}
          step={editingStep}
          templateId={template.id}
          templateName={template.name}
          siblings={siblings}
          nextPosition={template.steps.length}
          onClose={() => setEditingStep(null)}
          onSaved={next => onPatch({
            steps: template.steps.map(s => (s.id === next.id ? next : s)),
          })}
        />
      )}
    </section>
  )
}

// ── One step, read-only ───────────────────────────────────────────────────────────────

/**
 * A step as a row of FACTS, with its actions at the end.
 *
 * IT HOLDS NO STATE AT ALL, which is the whole of what the dialog redesign bought here. This
 * component was five `useState` calls, a `dirty` computation, a save handler and three
 * controls each rendered twice — once in its own collapsing `<td>` and once inside the
 * `RowMeta`, bound to the same state so the two copies could not disagree. A read-only row
 * needs none of it: the `RowMeta` restates the same strings the folded cells hold, so there is
 * nothing to keep in step.
 */
function StepRow({
  step, templateName, mayEdit, mayDelete, isFirst, isLast, busy,
  onEdit, onMove, onDelete,
}: {
  step: TemplateStep
  templateName: string
  mayEdit: boolean
  mayDelete: boolean
  isFirst: boolean
  isLast: boolean
  busy: boolean
  onEdit: () => void
  onMove: (direction: 'up' | 'down') => void
  onDelete: () => void
}) {
  const isChild = step.kind === 'template'
  const budgetText = step.budgetDefaultCents == null
    ? '—' : formatCurrency(step.budgetDefaultCents)

  return (
    <tr className="border-b align-top last:border-0 sm:align-middle">
      <td className="px-3 py-2.5">
        <div>
          <span className="font-medium">{step.label}</span>
          {step.helpText && (
            <p className="mt-0.5 text-xs text-muted-foreground">{step.helpText}</p>
          )}
        </div>
        {/* LABELLED, because two bare values under a step's name are a coin toss once the
            headings that told them apart have folded away. A template step says what it
            includes instead of Required and a budget, which mean nothing for a step nobody
            answers. */}
        <RowMeta className="gap-x-2">
          <span>{GATHERING_STEP_KIND_LABEL[step.kind]}</span>
          <MetaDot />
          {isChild ? (
            <span>Includes {step.childTemplateName ?? 'a template'}</span>
          ) : (
            <>
              <span>{step.required ? 'Required' : 'Optional'}</span>
              <MetaDot />
              <span>Budget {budgetText}</span>
            </>
          )}
        </RowMeta>
      </td>
      <td className={cn('px-3 py-2.5', COLLAPSING_CELL)}>
        {GATHERING_STEP_KIND_LABEL[step.kind]}
        {/* Authoring guidance rather than a value, which is why the folded copy above does
            NOT carry it: a hint per row inside a `RowMeta` would be a paragraph under every
            step. The dialog prints the same line under its picker, where the choice is made. */}
        <p className="mt-1 max-w-44 text-xs text-muted-foreground">
          {GATHERING_STEP_KIND_HINT[step.kind]}
        </p>
      </td>
      {/* ONE CELL SPANNING TWO FOR A TEMPLATE STEP, rather than a value in one column and an
          em dash in the other. Neither Required nor a budget means anything for a step nobody
          answers, and a blank cell under a heading reads as a value somebody forgot. */}
      {isChild ? (
        <td className={cn('px-3 py-2.5 text-muted-foreground', COLLAPSING_CELL)} colSpan={2}>
          Includes {step.childTemplateName ?? 'a template'}
        </td>
      ) : (
        <>
          <td className={cn('px-3 py-2.5 text-muted-foreground', COLLAPSING_CELL)}>
            {step.required ? 'Yes' : 'No'}
          </td>
          <td className={cn('px-3 py-2.5 text-right tabular-nums text-muted-foreground', COLLAPSING_CELL)}>
            {budgetText}
          </td>
        </>
      )}
      <td className="w-px px-3 py-2.5">
        <div className="flex items-center justify-end gap-1">
          {mayEdit && (
            <>
              <Button
                size="sm" variant="ghost" className="h-7 w-7 p-0"
                disabled={busy}
                title={`Edit the “${step.label}” step`}
                aria-label={`Edit the “${step.label}” step`}
                onClick={onEdit}
              >
                <Pencil className="h-3.5 w-3.5" />
              </Button>
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
