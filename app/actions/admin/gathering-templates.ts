'use server'

import { revalidatePath } from 'next/cache'
import { requireDelete, requireEdit, requireRead, requireScope } from '@/lib/auth/guard'
import { belongsToFamily } from '@/lib/auth/family'
import { scopeFor } from '@/lib/auth/permissions'
import { createAdminClient } from '@/lib/supabase/admin'
import {
  GATHERING_TEMPLATE_SCHEDULERS, isGatheringStepKind,
  type GatheringStepKind, type GatheringTemplateScheduler,
} from '@/lib/gatherings'
import type { T } from '@/lib/i18n/t'

/**
 * The template library — `/admin/gatherings/templates`.
 *
 * A template is a named, ordered list of STEPS. Scheduling a gathering from one copies
 * every step into `gathering_tasks`, and that copy is the whole reason this screen is safe
 * to edit: `label`, `help_text`, `kind` and `required` are duplicated onto the task at
 * instantiation, never read back through `step_id`. Editing a template afterwards therefore
 * cannot rewrite what a relative was already asked, or what they already answered. Every
 * write below is written on that understanding, and each one says so where it matters.
 *
 * ── THE GRANT IS `admin/gathering-templates`, AND IT IS AN ADMIN KEY ────────────────
 * A template is family CONFIGURATION, the same class of thing as a dues schedule — which is
 * why its RLS policy keys on this admin resource rather than on the member-facing
 * `gatherings`. Members never read the library; they read the TASKS instantiated from it,
 * which key on `gatherings`. Since `20260819000000` the key is registered with
 * `category = 'admin'`, so its visibility fails CLOSED for a family with no
 * `resource_visibility` row (AGENTS.md §6) and the Administrators grant is what opens it.
 *
 * ── WHY EVERY WRITE IS `canAny` EVEN THOUGH THE TABLE HAS AN OWNER ─────────────────
 * `permission_table_map` gives `gathering_templates` an `own_expr` of
 * `created_by = auth_person_id()`, so scope 'own' means something here — but it means it for
 * READING. `who_may_schedule` on this row decides whether an ordinary member may commit the
 * family to a whole gathering, and `budget_default_cents` on its steps decides what money
 * gets suggested; those are not things somebody's authorship of a draft should authorize.
 * So the writes go through `requireScope`/`requireEdit`/`requireDelete`, which are `canAny`,
 * and the own scope buys exactly one thing: an author can see the template they wrote.
 * `gathering_template_steps` has `own_expr = 'false'` for the same reason — there is no such
 * thing as "my step".
 *
 * ── §3: THESE ALL RUN ON THE SERVICE ROLE, SO FAMILY SCOPING IS BY HAND ────────────
 * `.eq('family_code', g.familyCode)` is on every read, every write and every delete in this
 * file, and `belongsToFamily` is called on every id that arrives from a caller before it is
 * written onto a row (§4). The reads could mostly run on the user client; they do not,
 * because `usedByCount` and the step list have to be the same answer for every holder of
 * this screen's grant — see `getGatheringTemplates`.
 *
 * ── §8: NOTHING HERE EMBEDS `people` ───────────────────────────────────────────────
 * Deliberately. `gathering_templates` has ONE foreign key to `people` (`created_by`), so a
 * bare embed would resolve today — and the author's name is not on this screen, so the
 * cheapest correct answer is not to ask. `gathering_tasks` and `gathering_task_submissions`
 * are the two tables in this feature with two `people` foreign keys each; every embed on
 * those must name its constraint, and none of them is in this file.
 */

/** The uniform mutation result for the whole feature (spec §4). */
export interface ActionResult {
  success: boolean
  message?: string
}

export interface TemplateStep {
  id: string
  position: number
  label: string
  helpText: string | null
  kind: GatheringStepKind
  required: boolean
  budgetDefaultCents: number | null
  /**
   * For a step of kind `'template'`: the template this step INCLUDES. Null for every other
   * kind, and the database locks the two together in both directions
   * (`gathering_template_steps_child_matches_kind`).
   *
   * A step of this kind is not answered by anybody. When a gathering is built, it expands
   * into the child template's own steps — see `instantiateTemplateTasks`, which is where the
   * recursion lives and where the depth guard is.
   */
  childTemplateId: string | null
  /**
   * The child's name, for the screen. Resolved from the templates already read rather than
   * joined, because the library read has all of them in hand — and because a step whose child
   * the caller cannot see (an 'own'-scope grant, a template somebody else authored) gets
   * `null` here rather than a name leaking out of a row that was filtered out.
   */
  childTemplateName: string | null
}

export interface GatheringTemplate {
  id: string
  name: string
  description: string | null
  whoMaySchedule: GatheringTemplateScheduler
  isArchived: boolean
  /**
   * THERE IS NO `defaultLocation` ANY MORE, and its absence is the decision rather than an
   * omission. `gathering_templates.default_location` was a template AUTHOR stating where this
   * kind of gathering is usually held, copied onto every segment built from it — a guess at a
   * fact that belongs to one occasion, which then had to be corrected on each segment it
   * landed on. `20260819000007` drops the column and the answer is a step of kind
   * `'location'`: the template says somebody has to settle the venue, and a named relative
   * settles it with a due date and a review, like every other fact about a gathering.
   *
   * `gathering_template_uses.location` is untouched. A segment's own place is still stated per
   * segment, by `setGatheringSegment`, and every value already copied onto one stayed there.
   */
  steps: TemplateStep[]
  /**
   * Gatherings built from this template — the count of `gathering_template_uses` rows.
   *
   * The screen greys its Delete at anything above zero, and `deleteGatheringTemplate`
   * re-derives it rather than trusting this. That split is the same relationship
   * `getScopeUsage` has with `deleteChapter`: disabling a button is about not offering a
   * refusal, not about being the thing that refuses.
   */
  usedByCount: number
}

const RESOURCE = 'admin/gatherings/templates'

/** Every route whose content changes when the library does. */
function revalidateLibrary(): void {
  revalidatePath('/admin/gatherings/templates')
  // `getSchedulableTemplates()` on /gatherings and the new-gathering dialog on
  // /admin/gatherings both read this table, and both are filtered by `is_archived` and
  // `who_may_schedule` — so an archive or a scheduler change is visible on all three.
  revalidatePath('/gatherings')
  revalidatePath('/admin/gatherings')
}

/** A `who_may_schedule` that arrived from a caller, checked at RUNTIME. */
function isScheduler(value: unknown): value is GatheringTemplateScheduler {
  return typeof value === 'string'
    && (GATHERING_TEMPLATE_SCHEDULERS as readonly string[]).includes(value)
}

/**
 * A suggested budget from a caller, in cents.
 *
 * MIRRORS `gathering_template_steps_budget_non_negative` so the author reads a sentence
 * instead of a bare 23514, and refuses a FRACTION for the reason `parseAnswer` does: cents
 * are integers everywhere in this schema, and 12.5 arriving here means a form posted dollars
 * — which is a factor of a hundred, silently, if it is rounded instead of refused.
 */
function readBudget(value: number | null | undefined): { ok: true; cents: number | null } | { ok: false } {
  if (value === undefined || value === null) return { ok: true, cents: null }
  if (!Number.isInteger(value) || value < 0) return { ok: false }
  return { ok: true, cents: value }
}

/**
 * The `childTemplateId` a caller sent, checked against the `kind` they sent with it.
 *
 * The database locks the two together in both directions
 * (`gathering_template_steps_child_matches_kind`), so this is the layer that turns each half
 * of that CHECK into a sentence somebody can act on rather than a 23514. It does NOT verify
 * the id belongs to the family — that is §4 and it needs a query, so it stays at the call
 * sites where the family code is in hand.
 */
function readChild(
  kind: GatheringStepKind,
  value: string | null | undefined,
  /** The caller's language. A pure validator, so it is handed one rather than resolving it. */
  t: T,
): { ok: true; templateId: string | null } | { ok: false; message: string } {
  if (kind === 'template') {
    const id = typeof value === 'string' ? value.trim() : ''
    if (!id) return { ok: false, message: t('act.pickTemplateStepIncludes') }
    return { ok: true, templateId: id }
  }
  // A child on any other kind is a reference nothing would ever read — refused rather than
  // dropped silently, because a caller sending one has misunderstood what they are building.
  if (value) return { ok: false, message: t('act.onlyTemplateStepCanInclude') }
  return { ok: true, templateId: null }
}

// ── Reading the library ────────────────────────────────────────────────────────

/** The row shapes the three reads below return, declared rather than inferred. */
interface TemplateRow {
  id: string
  name: string
  description: string | null
  who_may_schedule: string
  is_archived: boolean
  created_by: string | null
}

interface StepRow {
  id: string
  template_id: string
  position: number
  label: string
  help_text: string | null
  kind: string
  required: boolean
  budget_default_cents: number | null
  child_template_id: string | null
}

/**
 * The whole library: every template with its steps in order and its usage count.
 *
 * ── THREE QUERIES, NOT ONE PER TEMPLATE ────────────────────────────────────────────
 * Templates, all their steps, and all their uses — then bucketed in memory. A family with
 * fifteen templates would otherwise be thirty-one round trips, and the screen renders all
 * of them at once.
 *
 * ── THE ADMIN CLIENT, AND WHY THE USER CLIENT IS WRONG HERE ────────────────────────
 * §3's obligation is discharged by hand on all three queries. The user client would answer
 * something incoherent rather than something narrower: `gathering_template_steps` has
 * `own_expr = 'false'`, so a caller holding this key at scope 'own' would read their own
 * templates with NO STEPS IN THEM — a library of empty lists — and
 * `gathering_template_uses` keys on the `gatherings` resource, so `usedByCount` would come
 * back 0 for an administrator who happens not to hold `gatherings:view`, greying nothing and
 * offering a Delete that then refuses.
 *
 * ── WHICH IS WHY THE 'own' NARROWING IS DONE HERE, EXPLICITLY ──────────────────────
 * `requireRead` uses `can()`, so scope 'own' passes it — and reading the whole family's
 * library for somebody granted only their own is precisely the §5 failure ("decide what the
 * caller may see, fetch only that"). So the scope is resolved and the list is filtered to
 * `created_by = personId` when it is 'own'. That is the policy's own `own_expr`, applied by
 * the hand that took the policy out of the path. Steps and uses are then bucketed only for
 * the templates that survived, so nothing about a template the caller may not see reaches
 * the payload.
 */
export async function getGatheringTemplates(): Promise<GatheringTemplate[]> {
  const g = await requireRead(RESOURCE)
  if (!g.ok) return []

  const scope = await scopeFor(g.userId, RESOURCE, 'view')
  const ownPersonId = scope === 'own' ? g.personId : null
  // 'own' with no person row resolves to nothing at all rather than to everything. An
  // unresolvable caller must never widen a scope — the empty string that would otherwise be
  // written into the filter is the `invalid input syntax for type uuid: ""` the money
  // actions record as having reached a treasurer verbatim.
  if (scope === 'own' && !ownPersonId) return []

  const admin = createAdminClient()
  const base = admin
    .from('gathering_templates')
    .select('id, name, description, who_may_schedule, is_archived, created_by')
    .eq('family_code', g.familyCode)
  // The narrowing goes on BEFORE the ordering, because `.order()` returns a transform
  // builder that has no `.eq()` left on it — a filter chained after a sort does not compile.
  const scoped = ownPersonId ? base.eq('created_by', ownPersonId) : base

  // Live templates first, then alphabetically. Archived ones stay in the list because this
  // is the only screen that can un-archive them.
  const { data: templateData, error: templateError } = await scoped
    .order('is_archived')
    .order('name')

  // §8: `data` alone cannot tell a refused query from an empty library, and this screen
  // would render "no templates yet" over a family that has eleven.
  if (templateError) {
    console.error(`[gathering-templates] library read failed for ${g.familyCode}: ${templateError.message}`)
    return []
  }

  const templates = (templateData ?? []) as unknown as TemplateRow[]
  if (templates.length === 0) return []
  const ids = templates.map(t => t.id)

  const [stepsRes, usesRes] = await Promise.all([
    admin.from('gathering_template_steps')
      .select('id, template_id, position, label, help_text, kind, required, budget_default_cents, child_template_id')
      .eq('family_code', g.familyCode)
      .in('template_id', ids)
      // `ORDER BY position, created_at` — the read order the migration's comment names,
      // and the reason there is deliberately no UNIQUE on (template_id, position): a tie
      // resolves to a stable, harmless outcome instead of blocking a reorder.
      .order('position')
      .order('created_at'),
    admin.from('gathering_template_uses')
      .select('template_id')
      .eq('family_code', g.familyCode)
      .in('template_id', ids),
  ])

  // Names for the `template` steps, and ONLY of templates this read already returned. A step
  // whose child was filtered out by the 'own' narrowing gets a null name and the screen says
  // so — resolving it with a second query would publish the name of a template the caller was
  // deliberately not shown (§5).
  const nameById = new Map<string, string>(templates.map(t => [t.id, t.name]))

  const stepsByTemplate = new Map<string, TemplateStep[]>()
  if (stepsRes.error) {
    // Logged and left empty rather than failing the whole screen: a library with no steps
    // rendered is recoverable by a refresh, and refusing the page would take the archive
    // and rename controls away with it.
    console.error(`[gathering-templates] steps read failed for ${g.familyCode}: ${stepsRes.error.message}`)
  } else {
    for (const row of (stepsRes.data ?? []) as unknown as StepRow[]) {
      const list = stepsByTemplate.get(row.template_id) ?? []
      list.push({
        id:                 row.id,
        position:           row.position,
        label:              row.label,
        helpText:           row.help_text ?? null,
        // The column CHECKs the same nine values, so this is a narrowing rather than a
        // guess — and `isGatheringStepKind` is what makes it one the compiler can see.
        kind:               isGatheringStepKind(row.kind) ? row.kind : 'text',
        required:           row.required,
        budgetDefaultCents: row.budget_default_cents ?? null,
        childTemplateId:    row.child_template_id ?? null,
        childTemplateName:  row.child_template_id ? nameById.get(row.child_template_id) ?? null : null,
      })
      stepsByTemplate.set(row.template_id, list)
    }
  }

  const uses = new Map<string, number>()
  if (usesRes.error) {
    // A failed count reads as 0 here and the screen greys nothing. That is safe ONLY
    // because `deleteGatheringTemplate` re-derives the count itself and refuses on its own
    // error — this number decides whether a button looks available, never whether a
    // template can go.
    console.error(`[gathering-templates] usage read failed for ${g.familyCode}: ${usesRes.error.message}`)
  } else {
    for (const row of (usesRes.data ?? []) as unknown as { template_id: string }[]) {
      uses.set(row.template_id, (uses.get(row.template_id) ?? 0) + 1)
    }
  }

  return templates.map(t => ({
    id:             t.id,
    name:           t.name,
    description:    t.description ?? null,
    whoMaySchedule: isScheduler(t.who_may_schedule) ? t.who_may_schedule : 'admin',
    isArchived:     t.is_archived,
    steps:          stepsByTemplate.get(t.id) ?? [],
    usedByCount:    uses.get(t.id) ?? 0,
  }))
}

// ── Templates ──────────────────────────────────────────────────────────────────

export async function createGatheringTemplate(input: {
  name: string
  description?: string
  whoMaySchedule: GatheringTemplateScheduler
}): Promise<ActionResult & { templateId?: string }> {
  const g = await requireScope(RESOURCE, 'create')
  if (!g.ok) return { success: false, message: g.message }
  const { t } = g

  const name = input.name?.trim()
  if (!name) return { success: false, message: t('act.templateNeedsName') }
  // A `GatheringTemplateScheduler` annotation is erased at runtime and this function is a
  // public HTTP endpoint, so the string is checked rather than trusted — otherwise the
  // table's CHECK refuses the insert with a 23514 that reads as a bug.
  if (!isScheduler(input.whoMaySchedule)) {
    return { success: false, message: t('act.chooseWhoMayScheduleFrom') }
  }
  // `created_by` REFERENCES `people(id)`, not `auth.users` — and it is this row's whole
  // `own_expr`, so a null makes the template unreadable to its own author under an 'own'
  // grant. Refused rather than written as null, and refused on the empty string too:
  // `funds.ts` records that the unchecked version surfaced `invalid input syntax for type
  // uuid: ""` to a treasurer as the entire error message.
  if (!g.personId) return { success: false, message: t('act.profileNotFound') }

  const { data, error } = await createAdminClient()
    .from('gathering_templates')
    .insert({
      family_code:      g.familyCode,
      name,
      description:      input.description?.trim() || null,
      who_may_schedule: input.whoMaySchedule,
      created_by:       g.personId,
    })
    .select('id')
    .single()

  if (error) {
    // UNIQUE (family_code, name). The author typed a name that is already in the library,
    // which is an ordinary mistake and deserves a sentence rather than a constraint name.
    if (error.code === '23505') {
      return { success: false, message: t('tmpl.nameExists', { name }) }
    }
    return { success: false, message: error.message }
  }

  revalidateLibrary()
  return { success: true, templateId: data.id }
}

/**
 * Rename a template, re-describe it, change who may schedule from it, archive or restore it.
 *
 * NONE OF THIS TOUCHES A GATHERING ALREADY BUILT FROM IT, and that is the point of the copy
 * (see the header). Renaming the template does not rename anybody's tasks, and archiving it
 * hides it from the schedule-from pickers without disturbing a single gathering.
 *
 * Only the fields the caller actually sent are written. An absent key is "leave it alone";
 * an explicit `null` on `description` is "clear it" — which is why that one is typed
 * `string | null` and the others are not.
 */
export async function updateGatheringTemplate(input: {
  templateId: string
  name?: string
  description?: string | null
  whoMaySchedule?: GatheringTemplateScheduler
  isArchived?: boolean
}): Promise<ActionResult> {
  const g = await requireEdit(RESOURCE)
  if (!g.ok) return { success: false, message: g.message }
  const { t } = g

  // §4/§3. The id arrives from the client and the update runs on the service role, where no
  // policy is underneath it: `.eq('id', …)` alone would let one family rename another's
  // templates. Checked before anything is built, and the write below carries the family
  // conjunct as well — both, not either.
  if (!(await belongsToFamily('gathering_templates', input.templateId, g.familyCode))) {
    return { success: false, message: t('act.templateNotFound') }
  }

  const patch: Record<string, unknown> = {}
  // Kept beside the patch rather than read back out of it, so the duplicate-name message
  // below cannot interpolate `undefined` for a 23505 raised by a write that carried no name.
  let nextName: string | null = null
  if (input.name !== undefined) {
    const name = input.name.trim()
    if (!name) return { success: false, message: t('act.templateNeedsName') }
    patch.name = name
    nextName = name
  }
  if (input.description !== undefined) {
    patch.description = input.description?.trim() || null
  }
  if (input.whoMaySchedule !== undefined) {
    if (!isScheduler(input.whoMaySchedule)) {
      return { success: false, message: t('act.chooseWhoMayScheduleFrom') }
    }
    patch.who_may_schedule = input.whoMaySchedule
  }
  if (input.isArchived !== undefined) {
    if (typeof input.isArchived !== 'boolean') {
      return { success: false, message: t('act.archivedMustYesNo') }
    }
    patch.is_archived = input.isArchived
  }

  // Refused rather than reported as saved. Every control on the screen sends at least one
  // field, so an empty patch is a caller that has misunderstood — and answering "saved" to
  // a request that wrote nothing is the failure this whole file is careful about.
  if (Object.keys(patch).length === 0) return { success: false, message: t('act.nothingChange') }

  const { error } = await createAdminClient()
    .from('gathering_templates')
    .update(patch)
    .eq('id', input.templateId)
    .eq('family_code', g.familyCode)

  if (error) {
    // UNIQUE (family_code, name) is the only unique constraint on this table, so a 23505 here
    // is always the rename colliding with a template already in the library.
    if (error.code === '23505') {
      return {
        success: false,
        message: nextName
          ? t('tmpl.nameExists', { name: nextName })
          : 'Another template already has that name',
      }
    }
    return { success: false, message: error.message }
  }

  revalidateLibrary()
  return { success: true }
}

/**
 * Delete a template — refused once a gathering has been built from it.
 *
 * ── WHY IT IS REFUSED RATHER THAN CASCADED ─────────────────────────────────────────
 * `gathering_template_uses.template_id` is NO ACTION on delete, so the database already
 * refuses this. What it refuses with is `violates foreign key constraint
 * gathering_template_uses_template_id_fkey`, which tells an administrator nothing about the
 * three reunions that were planned from it and offers them nowhere to go. That is the same
 * gap `lib/scope-attached.ts` and `lib/money-attached.ts` exist to close, and this refusal
 * is written in their shape: name the count, name what deleting would cost, and name the
 * way forward — which here is archiving, the reason `is_archived` is on the table at all.
 *
 * ── WHAT A PERMITTED DELETE DOES TAKE ──────────────────────────────────────────────
 * The template's steps, by cascade. Nothing else: no gathering was built from it (that is
 * what was just checked), so there is no task anywhere carrying a copy of one of those
 * steps, and no answer to lose.
 *
 * ── A FAILED COUNT REFUSES ─────────────────────────────────────────────────────────
 * `moneyAttachedTo`'s asymmetry, for the same reason: a false "nothing attached" here is a
 * delete that should not have happened, while a false "something attached" is a retry.
 */
export async function deleteGatheringTemplate(templateId: string): Promise<ActionResult> {
  const g = await requireDelete(RESOURCE)
  if (!g.ok) return { success: false, message: g.message }
  const { t } = g

  const admin = createAdminClient()
  // §3: read the row INSIDE the family before deciding anything about it. The name is for
  // the message; the family conjunct is what makes this an existence check for one family's
  // library rather than for the whole table.
  const { data: existing, error: readError } = await admin
    .from('gathering_templates')
    .select('name')
    .eq('id', templateId)
    .eq('family_code', g.familyCode)
    .maybeSingle()
  if (readError) {
    console.error(`[gathering-templates] delete lookup failed for ${g.familyCode}: ${readError.message}`)
    return { success: false, message: t('act.couldNotReadTemplateTry') }
  }
  if (!existing) return { success: false, message: t('act.templateNotFound') }

  const { count, error: countError } = await admin
    .from('gathering_template_uses')
    .select('id', { count: 'exact', head: true })
    .eq('family_code', g.familyCode)
    .eq('template_id', templateId)

  if (countError) {
    console.error(`[gathering-templates] use count failed for template ${templateId}: ${countError.message}`)
    return {
      success: false,
      message: t('act.couldNotCheckWhetherAny'),
    }
  }

  const used = count ?? 0
  if (used > 0) {
    return {
      success: false,
      message: t(used === 1
        ? 'tmpl.usedCannotDeleteOne'
        : 'tmpl.usedCannotDeleteMany', {
        name: existing.name, n: String(used),
      }),
    }
  }

  const { error } = await admin
    .from('gathering_templates')
    .delete()
    .eq('id', templateId)
    .eq('family_code', g.familyCode)
  if (error) return { success: false, message: error.message }

  revalidateLibrary()
  return { success: true }
}

// ── Steps ──────────────────────────────────────────────────────────────────────

/**
 * ── A STEP MAY BE ANOTHER TEMPLATE, AND `childTemplateId` IS HOW ───────────────────
 * Kind `'template'` and a `childTemplateId` are locked to each other in both directions, by
 * the database (`gathering_template_steps_child_matches_kind`) and by the two branches below.
 * Such a step is never handed to anybody: it expands into the child template's own steps when
 * a gathering is built — `instantiateTemplateTasks` is where the recursion and its depth guard
 * live.
 *
 * `childTemplateId` IS AN ID FROM THE CLIENT, so it gets §4's treatment exactly as
 * `templateId` does: it is verified to belong to this family before it is written. The
 * database refuses it underneath as well — `tg_gathering_template_step_same_family()` was
 * widened to walk it — because this runs on the SERVICE ROLE and no policy is in the path.
 *
 * AND IT MUST NOT MAKE A LOOP. A template containing itself, directly or through three hops,
 * makes instantiation non-terminating. The trigger refuses it in SQL with a recursive walk,
 * which is the layer that cannot be skipped by a second write path; this action does not
 * re-walk the graph in TypeScript, because two implementations of one rule is how they come
 * to disagree — it surfaces the trigger's own sentence instead.
 */
export async function addTemplateStep(input: {
  templateId: string
  label: string
  kind: GatheringStepKind
  helpText?: string
  required?: boolean
  budgetDefaultCents?: number | null
  /** Required when `kind` is `'template'`, and refused for every other kind. */
  childTemplateId?: string | null
}): Promise<ActionResult & { stepId?: string }> {
  const g = await requireScope(RESOURCE, 'create')
  if (!g.ok) return { success: false, message: g.message }
  const { t } = g

  const label = input.label?.trim()
  if (!label) return { success: false, message: t('act.stepNeedsLabel') }
  // Checked at runtime for the reason `isGatheringStepKind`'s own comment gives: the
  // annotation is erased, the endpoint is public, and the only thing left underneath is a
  // CHECK whose 23514 reads as a bug rather than as "that is not one of the nine".
  if (!isGatheringStepKind(input.kind)) return { success: false, message: t('act.chooseWhatStepAsks') }
  const budget = readBudget(input.budgetDefaultCents)
  if (!budget.ok) return { success: false, message: t('act.suggestedBudgetMustWholeNumber') }

  const child = readChild(input.kind, input.childTemplateId, t)
  if (!child.ok) return { success: false, message: child.message }

  // §4. The step carries the caller's own family_code — which satisfies every policy — while
  // `template_id` could name another family's template. Verified before it is written.
  if (!(await belongsToFamily('gathering_templates', input.templateId, g.familyCode))) {
    return { success: false, message: t('act.templateNotFound') }
  }
  // The SECOND id from the client, and it gets the same look. The one-hop loop is refused
  // here as well as by a CHECK, so the caller reads a sentence rather than a constraint name.
  if (child.templateId) {
    if (child.templateId === input.templateId) {
      return { success: false, message: t('act.templateCannotIncludeItself') }
    }
    if (!(await belongsToFamily('gathering_templates', child.templateId, g.familyCode))) {
      return { success: false, message: t('act.templateNotFound3') }
    }
  }

  const admin = createAdminClient()
  // The next position, read inside the family and inside the template. Starting from -1 so
  // the first step of a template lands on 0, matching the column's own DEFAULT.
  const { data: last, error: lastError } = await admin
    .from('gathering_template_steps')
    .select('position')
    .eq('family_code', g.familyCode)
    .eq('template_id', input.templateId)
    .order('position', { ascending: false })
    .limit(1)
    .maybeSingle()
  if (lastError) {
    console.error(`[gathering-templates] position read failed for template ${input.templateId}: ${lastError.message}`)
    return { success: false, message: t('act.couldNotAddStepTry') }
  }

  const { data, error } = await admin
    .from('gathering_template_steps')
    .insert({
      family_code:          g.familyCode,
      template_id:          input.templateId,
      position:             (last?.position ?? -1) + 1,
      label,
      help_text:            input.helpText?.trim() || null,
      kind:                 input.kind,
      required:             input.required === true,
      budget_default_cents: budget.cents,
      child_template_id:    child.templateId,
    })
    .select('id')
    .single()

  // The trigger's own sentence, surfaced verbatim when it is one a person can act on. A loop
  // through several templates is refused in SQL and nowhere else — see the header — so
  // swallowing this into "Could not add that step" would leave an author with no idea which
  // of the templates they picked closed the circle.
  if (error) return { success: false, message: error.message }
  revalidatePath('/admin/gatherings/templates')
  return { success: true, stepId: data.id }
}

/**
 * Edit a step.
 *
 * IT DOES NOT REACH A TASK ALREADY INSTANTIATED FROM THIS STEP, and that is deliberate
 * rather than an omission — see the header. A relative who was asked for a phone number and
 * answered with one keeps being asked for a phone number, whatever the template says
 * afterwards; the next gathering scheduled from the template gets the new wording.
 * `gathering_tasks.step_id` is provenance only.
 */
export async function updateTemplateStep(input: {
  stepId: string
  label?: string
  kind?: GatheringStepKind
  helpText?: string | null
  required?: boolean
  budgetDefaultCents?: number | null
  childTemplateId?: string | null
}): Promise<ActionResult> {
  const g = await requireEdit(RESOURCE)
  if (!g.ok) return { success: false, message: g.message }
  const { t } = g

  if (!(await belongsToFamily('gathering_template_steps', input.stepId, g.familyCode))) {
    return { success: false, message: t('act.stepNotFound') }
  }

  const patch: Record<string, unknown> = {}
  if (input.label !== undefined) {
    const label = input.label.trim()
    if (!label) return { success: false, message: t('act.stepNeedsLabel') }
    patch.label = label
  }
  // KIND AND CHILD MOVE TOGETHER OR NOT AT ALL, because the database locks them to each other
  // and a patch that changed one alone would be refused by a CHECK with nothing useful to say.
  // Sending `kind` without `childTemplateId` is therefore read as "and clear the child", which
  // is exactly right for retyping a template step into a short-answer one; the screen sends
  // both, and this is what makes a caller that does not still write a coherent row.
  if (input.kind !== undefined) {
    if (!isGatheringStepKind(input.kind)) return { success: false, message: t('act.chooseWhatStepAsks') }
    const child = readChild(input.kind, input.childTemplateId, t)
    if (!child.ok) return { success: false, message: child.message }
    patch.kind = input.kind
    patch.child_template_id = child.templateId
  } else if (input.childTemplateId !== undefined) {
    // A child without a kind is a caller changing which template a `template` step includes.
    // The kind is not read back off the row for it: the CHECK underneath refuses the pair if
    // the row is not a `template` step, and a read-modify-write here would race a concurrent
    // retype of the same step.
    if (!input.childTemplateId) {
      return { success: false, message: t('act.pickTemplateStepIncludes') }
    }
    patch.child_template_id = input.childTemplateId
  }
  if (input.helpText !== undefined) patch.help_text = input.helpText?.trim() || null
  if (input.required !== undefined) {
    if (typeof input.required !== 'boolean') return { success: false, message: t('act.requiredMustYesNo') }
    patch.required = input.required
  }
  if (input.budgetDefaultCents !== undefined) {
    const budget = readBudget(input.budgetDefaultCents)
    if (!budget.ok) return { success: false, message: t('act.suggestedBudgetMustWholeNumber') }
    patch.budget_default_cents = budget.cents
  }

  if (Object.keys(patch).length === 0) return { success: false, message: t('act.nothingChange') }

  // §4 on the second id, same as `addTemplateStep`. The one-hop loop is caught here so the
  // author reads a sentence; the multi-hop one is the trigger's, whose message is surfaced.
  if (typeof patch.child_template_id === 'string') {
    const childId = patch.child_template_id
    if (!(await belongsToFamily('gathering_templates', childId, g.familyCode))) {
      return { success: false, message: t('act.templateNotFound3') }
    }
  }

  const { error } = await createAdminClient()
    .from('gathering_template_steps')
    .update(patch)
    .eq('id', input.stepId)
    .eq('family_code', g.familyCode)

  if (error) return { success: false, message: error.message }
  revalidatePath('/admin/gatherings/templates')
  return { success: true }
}

/**
 * Delete a step from a template.
 *
 * NOT REFUSED WHEN THE TEMPLATE HAS BEEN USED, and this is the one delete in this file that
 * takes no count first. `gathering_tasks.step_id` is ON DELETE SET NULL and the task's
 * `label`, `help_text`, `kind` and `required` are its own copies, so deleting a step loses
 * one thing — the pointer back to where the task came from — and destroys no answer, no
 * assignment and no decision. Nobody's work is on the other end of this constraint.
 *
 * The positions of the remaining steps are left alone. Reads are `ORDER BY position,
 * created_at`, so a gap in the numbering is invisible; renumbering would be writes nobody
 * asked for on rows nobody touched.
 */
export async function deleteTemplateStep(stepId: string): Promise<ActionResult> {
  const g = await requireDelete(RESOURCE)
  if (!g.ok) return { success: false, message: g.message }
  const { t } = g

  const admin = createAdminClient()
  // §3, as in `deleteGatheringTemplate`: the id alone must never be the whole predicate.
  const { data: existing, error: readError } = await admin
    .from('gathering_template_steps')
    .select('id')
    .eq('id', stepId)
    .eq('family_code', g.familyCode)
    .maybeSingle()
  if (readError) {
    console.error(`[gathering-templates] step lookup failed for ${g.familyCode}: ${readError.message}`)
    return { success: false, message: t('act.couldNotReadStepTry') }
  }
  if (!existing) return { success: false, message: t('act.stepNotFound') }

  const { error } = await admin
    .from('gathering_template_steps')
    .delete()
    .eq('id', stepId)
    .eq('family_code', g.familyCode)
  if (error) return { success: false, message: error.message }

  revalidatePath('/admin/gatherings/templates')
  return { success: true }
}

/**
 * Move a step one place up or down.
 *
 * ── WHY THERE IS NO UNIQUE ON (template_id, position), AND WHAT THAT COSTS HERE ────
 * A unique constraint would make this three writes through a temporary value that violates
 * it, which is the classic swap problem; the migration therefore leaves ties legal and
 * resolves them by `created_at` on read. The cost lands in this function, and it is one
 * branch: two rows can legitimately hold the SAME position, and swapping two equal numbers
 * moves nothing. So
 *
 *   * positions differ  → the ordinary two-update swap, and the pair is done;
 *   * positions are EQUAL → the template is renumbered densely from the order the move
 *     asked for, because there is no pair of values to exchange that would express it.
 *
 * The renumber is the same read order the screen uses, so it changes what is stored without
 * changing what anybody was looking at. It writes every step of one template — a handful of
 * rows — and only in the tie case, which a library built through `addTemplateStep` never
 * reaches (that function assigns max+1). A tie arrives from a `DEFAULT 0` insert made
 * anywhere else, and this is what makes the arrows work anyway rather than silently not.
 *
 * ── THE READ IS THE WHOLE SIBLING LIST, NOT A NEIGHBOUR QUERY ──────────────────────
 * "The greatest position below mine" cannot break a tie, so a neighbour resolved in SQL
 * would disagree with the order on screen exactly when two rows share a position. Reading
 * the list and indexing into it is the only version that agrees with what the member sees.
 */
export async function moveTemplateStep(input: {
  stepId: string
  direction: 'up' | 'down'
}): Promise<ActionResult> {
  const g = await requireEdit(RESOURCE)
  if (!g.ok) return { success: false, message: g.message }
  const { t } = g

  if (input.direction !== 'up' && input.direction !== 'down') {
    return { success: false, message: t('act.moveStepUpDown') }
  }

  const admin = createAdminClient()
  // §3. The step's own row, read inside the family — which is also how `template_id` is
  // obtained, so the sibling read below is scoped by a value from the database rather than
  // by one from the caller.
  const { data: step, error: stepError } = await admin
    .from('gathering_template_steps')
    .select('id, template_id, position')
    .eq('id', input.stepId)
    .eq('family_code', g.familyCode)
    .maybeSingle()
  if (stepError) {
    console.error(`[gathering-templates] move lookup failed for ${g.familyCode}: ${stepError.message}`)
    return { success: false, message: t('act.couldNotMoveStepTry') }
  }
  if (!step) return { success: false, message: t('act.stepNotFound') }

  const { data: siblingData, error: siblingError } = await admin
    .from('gathering_template_steps')
    .select('id, position')
    .eq('family_code', g.familyCode)
    .eq('template_id', step.template_id)
    .order('position')
    .order('created_at')
  if (siblingError) {
    console.error(`[gathering-templates] sibling read failed for template ${step.template_id}: ${siblingError.message}`)
    return { success: false, message: t('act.couldNotMoveStepTry') }
  }

  const siblings = (siblingData ?? []) as unknown as { id: string; position: number }[]
  const index = siblings.findIndex(s => s.id === step.id)
  // Unreachable unless the row went away between the two reads; treated as not found
  // rather than as a move of nothing.
  if (index === -1) return { success: false, message: t('act.stepNotFound') }

  const targetIndex = input.direction === 'up' ? index - 1 : index + 1
  if (targetIndex < 0 || targetIndex >= siblings.length) {
    return {
      success: false,
      message: input.direction === 'up' ? 'That step is already first' : 'That step is already last',
    }
  }

  const moving = siblings[index]
  const neighbour = siblings[targetIndex]

  if (moving.position !== neighbour.position) {
    const [a, b] = await Promise.all([
      admin.from('gathering_template_steps').update({ position: neighbour.position })
        .eq('id', moving.id).eq('family_code', g.familyCode),
      admin.from('gathering_template_steps').update({ position: moving.position })
        .eq('id', neighbour.id).eq('family_code', g.familyCode),
    ])
    // Both errors are reported, and a partial swap leaves two rows sharing a position —
    // legal, and resolved by created_at on the next read, which is exactly why the tie
    // case above exists rather than being an error state.
    const failure = a.error ?? b.error
    if (failure) return { success: false, message: failure.message }
  } else {
    const reordered = siblings.slice()
    reordered.splice(index, 1)
    reordered.splice(targetIndex, 0, moving)
    const writes = await Promise.all(reordered.map((s, i) =>
      admin.from('gathering_template_steps').update({ position: i })
        .eq('id', s.id).eq('family_code', g.familyCode)))
    const failure = writes.find(w => w.error)?.error
    if (failure) return { success: false, message: failure.message }
  }

  revalidatePath('/admin/gatherings/templates')
  return { success: true }
}
