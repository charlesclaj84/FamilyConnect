import { createAdminClient } from '@/lib/supabase/admin'

/**
 * Copying a template's steps onto a gathering as TASKS — the one place it happens.
 *
 * ── WHY THIS IS A PLAIN MODULE AND MUST NEVER BECOME `'use server'` ─────────────────
 * The same reason `lib/notifications.ts` and `lib/invitations.ts` are plain modules:
 * everything exported from a `'use server'` file gets a URL, and both functions here take a
 * gathering id, a family code and a template id and write rows through the SERVICE ROLE.
 * Exported from an action module either would be an endpoint any signed-in user could POST
 * with another family's code and another family's template id, and every row it wrote would
 * be stamped with whatever they sent. Neither has a caller to authorize because neither is
 * reachable; the three actions that reach them gate themselves first (AGENTS.md §2).
 *
 * ── AND WHY THE SHARED HALF HAD TO COME HERE ────────────────────────────────────────
 * A `'use server'` module may export nothing but async functions, so neither of the feature's
 * two action modules can share a plain helper with the other. The attach-and-instantiate loop
 * was therefore written twice — once in each create path — and the second copy is how one of
 * them came to leave a template linked to a gathering with none of its tasks on it while the
 * other did not. This is the only place in the feature that can hold ONE definition of it, so
 * it holds it.
 *
 * ── WHY IT RE-VERIFIES ITS OWN ARGUMENTS ────────────────────────────────────────────
 * ONE call site today — `attachTemplatesToGathering` below, which the three create paths all
 * go through — and the SECOND one is who this is written for. Every caller it has checks the
 * template against the family before calling; one added later by somebody reading the
 * signature rather than the callers would not, and the failure is silent in the direction
 * that matters: the rows would carry the passed `familyCode`, so every policy and every
 * `.eq('family_code', …)` afterwards agrees with them, while their labels, help text and
 * suggested budgets were copied out of another family's template.
 *
 * The `tg_gathering_task_same_family()` trigger is underneath this and would refuse the
 * insert — it checks `gathering_id`, `template_id` and `step_id` against `NEW.family_code`
 * — but it refuses with a 23514, which reads to a caller as a bug rather than as "that
 * template is not yours". Two layers, and this is the one that can produce a sentence.
 *
 * ── WHAT IS COPIED, AND WHY IT IS COPIED RATHER THAN JOINED ─────────────────────────
 * `label`, `help_text`, `kind`, `required` and the suggested budget are COPIED onto the
 * task. That is the single most important decision in `gathering_tasks` and it is not an
 * optimisation: a task is a thing a named relative was asked to do, and editing the
 * template next month must not rewrite what they were asked or invalidate what they
 * answered. `template_id` and `step_id` are kept for provenance only, both
 * `ON DELETE SET NULL`, so deleting the step leaves the task and its answer standing.
 */

type AdminClient = ReturnType<typeof createAdminClient>

/** One template step, in the order it will be handed out. */
interface TemplateStepRow {
  id: string
  position: number
  label: string
  help_text: string | null
  kind: string
  required: boolean
  budget_default_cents: number | null
  /** Set only on a step of kind `'template'`, which expands rather than becoming a task. */
  child_template_id: string | null
}

/** A step, flattened, with the template it actually LIVES on — see `expandSteps`. */
interface FlatStep {
  templateId: string
  step: TemplateStepRow
}

/**
 * How deep a template may include another template.
 *
 * Cycles are refused by `tg_gathering_template_step_same_family()` in SQL, which walks the
 * graph on every write, so this is not what stops a loop — `visited` below is not what stops
 * one either. Both are here because instantiation is the place a loop would COST something
 * (a request that never returns, on a public endpoint), and a bug that gets past the trigger
 * should hit a wall rather than a fan.
 *
 * Five is a product judgement rather than a technical bound: a reunion whose checklist is six
 * templates deep is a checklist nobody can read, and refusing it here says so at the moment
 * somebody tries to build it. Raise it if a family ever has a reason.
 */
const MAX_TEMPLATE_DEPTH = 5

export interface InstantiateResult {
  success: boolean
  message?: string
  /** How many tasks were written. 0 with `success: true` means the template has no steps. */
  created: number
}

/**
 * Copy every step of `templateId` onto `gatheringId` as tasks, after whatever is already
 * there.
 *
 * `admin` is passed in rather than created here so a caller doing several of these — a
 * gathering scheduled from three templates — makes one client and the tasks it writes all
 * arrive through the same connection in the order the templates were named.
 *
 * ── POSITION IS OFFSET, NOT RESTARTED ───────────────────────────────────────────────
 * A gathering built from three templates is one list of tasks, not three lists that all
 * start at 0. Reads are `ORDER BY position`, so restarting would interleave the three
 * templates' steps in an order nobody chose — the caterer's step 1, the venue's step 1, the
 * invitations' step 1 — and a family reading down the page would see the work shuffled. The
 * offset is read from the tasks ALREADY on the gathering, so `addGatheringTemplate` months
 * later appends rather than colliding.
 *
 * There is no `UNIQUE (gathering_id, position)` to fight, deliberately (see the migration),
 * so a tie from a concurrent second call is a stable, harmless outcome rather than a failed
 * insert: `ORDER BY position, created_at` breaks it by when the row was written.
 */
export async function instantiateTemplateTasks(
  admin: AdminClient,
  gatheringId: string,
  familyCode: string,
  templateId: string,
): Promise<InstantiateResult> {
  if (!gatheringId || !familyCode || !templateId) {
    return { success: false, message: 'Gathering or template not found', created: 0 }
  }

  // §4, both ids, on the service-role client where no policy is underneath at all. The
  // gathering is checked as well as the template: it is the row every task hangs off, and
  // `.eq('id', …)` alone would let one family's tasks be written onto another's gathering.
  const [gatheringRes, templateRes] = await Promise.all([
    admin.from('gatherings').select('id')
      .eq('id', gatheringId).eq('family_code', familyCode).maybeSingle(),
    admin.from('gathering_templates').select('id, is_archived')
      .eq('id', templateId).eq('family_code', familyCode).maybeSingle(),
  ])

  // §8: an error here is not an empty result, and reading `data` alone would turn a refused
  // query into "that template is not yours" — a sentence that sends the reader looking for a
  // permission problem that does not exist.
  if (gatheringRes.error || templateRes.error) {
    console.error(`[gatherings] instantiate could not resolve ${gatheringId}/${templateId} in ${familyCode}: `
      + (gatheringRes.error?.message ?? templateRes.error?.message))
    return { success: false, message: 'Could not read the gathering', created: 0 }
  }
  if (!gatheringRes.data) return { success: false, message: 'Gathering not found', created: 0 }
  if (!templateRes.data) return { success: false, message: 'Template not found', created: 0 }

  const [stepsRes, lastRes] = await Promise.all([
    expandSteps(admin, familyCode, templateId),
    admin.from('gathering_tasks')
      .select('position')
      .eq('gathering_id', gatheringId)
      .eq('family_code', familyCode)
      .order('position', { ascending: false })
      .limit(1)
      .maybeSingle(),
  ])

  if (stepsRes.error) {
    console.error(`[gatherings] instantiate could not read steps of ${templateId} in ${familyCode}: ${stepsRes.error}`)
    return { success: false, message: 'Could not read the template steps', created: 0 }
  }
  // A FAILED OFFSET READ IS FATAL RATHER THAN DEFAULTED TO 0. Falling back would append the
  // new template's steps on top of the positions already in use, which is not an error
  // anywhere — the rows insert, and the gathering's task list silently interleaves two
  // templates for the rest of its life with nothing to say why.
  if (lastRes.error) {
    console.error(`[gatherings] instantiate could not read task positions on ${gatheringId} in ${familyCode}: ${lastRes.error.message}`)
    return { success: false, message: 'Could not read the gathering tasks', created: 0 }
  }

  const steps = stepsRes.steps
  if (steps.length === 0) {
    // NOT a failure. A template with no steps yet is an ordinary state — it is what every
    // template looks like for the minute between being created and having its first step
    // added — and a gathering scheduled from one is a gathering with no tasks, which
    // `taskProgress` deliberately does not report as complete (`total > 0`).
    return { success: true, created: 0 }
  }

  const offset = ((lastRes.data as { position: number } | null)?.position ?? -1) + 1

  const { error } = await admin.from('gathering_tasks').insert(
    steps.map(({ templateId: stepTemplateId, step }, index) => ({
      family_code:  familyCode,
      gathering_id: gatheringId,
      // THE TEMPLATE THE STEP LIVES ON, which for a nested one is the CHILD rather than the
      // root. It has to be: `tg_gathering_task_same_family()` refuses a task whose `step_id`
      // is not a step of its `template_id`, so writing the root here would fail every nested
      // task with a 23514. It is also the right answer — `templateName` on the row is what
      // the detail screen groups by, so a family that includes "Test" inside "Family Reunion"
      // reads two headed groups rather than one long list, which is what they built.
      template_id:  stepTemplateId,
      step_id:      step.id,
      label:        step.label,
      help_text:    step.help_text,
      kind:         step.kind,
      required:     step.required,
      position:     offset + index,
      // The template's SUGGESTION becomes the task's real line, editable per gathering
      // through `setGatheringTaskBudget`. Copied for the same reason the label is: changing
      // what a step suggests next year must not re-price a reunion already being paid for.
      budget_cents: step.budget_default_cents,
      // `assignee_id`, `due_on`, `answer`, `decided_at` and `decided_by` are deliberately
      // left to their defaults. Instantiation creates the WORK; who does it and by when is
      // `assignGatheringTask`, which is a decision an organizer makes per relative and per
      // task, and a template cannot know either.
    })),
  )

  if (error) {
    console.error(`[gatherings] instantiate insert failed for ${gatheringId}/${templateId} in ${familyCode}: ${error.message}`)
    return { success: false, message: 'Could not add the template steps to this gathering', created: 0 }
  }

  return { success: true, created: steps.length }
}

/**
 * Every step of `templateId`, in order, with the steps of any template it INCLUDES spliced in
 * where the including step sits.
 *
 * ── A `template` STEP IS NOT A TASK ────────────────────────────────────────────────
 * Kind `'template'` names another template through `child_template_id`, and it expands: the
 * child's steps take its place, at its position, each carrying the child's own id as the
 * template it came from. Nobody is ever handed the step itself — there is nothing to answer —
 * which is why `gathering_tasks.kind` deliberately does NOT allow `'template'`
 * (`20260819000007` asserts the two CHECKs disagree).
 *
 * ── IT RETURNS A REASON RATHER THAN THROWING ───────────────────────────────────────
 * Every caller is on a public endpoint's path and every one of them already turns a failure
 * into a sentence naming the template that could not be attached. A throw here would surface
 * as a 500 on a screen that has a perfectly good way to say what went wrong.
 *
 * ── THE THREE THINGS THAT STOP IT RUNNING AWAY ─────────────────────────────────────
 * `visited` (a template already expanded on this path is not expanded again), `depth`
 * (`MAX_TEMPLATE_DEPTH`), and — underneath both, and the one that actually holds — the
 * trigger that refuses to WRITE a cycle in the first place. Two of the three are redundant
 * today and are kept because the cost of being wrong here is a request that never returns.
 *
 * A template included twice on DIFFERENT branches is legitimate and is expanded both times:
 * `visited` is carried down a path, not across the whole walk. A family whose Welcome and
 * Send Off both include the same Catering checklist wants both sets of tasks.
 */
async function expandSteps(
  admin: AdminClient,
  familyCode: string,
  templateId: string,
  visited: readonly string[] = [],
  depth = 0,
): Promise<{ steps: FlatStep[]; error?: string }> {
  if (depth > MAX_TEMPLATE_DEPTH) {
    return { steps: [], error: `template nesting deeper than ${MAX_TEMPLATE_DEPTH} levels at ${templateId}` }
  }
  // Not an error, and deliberately so: the database cannot hold a cycle, so reaching here
  // means one was written by something that bypassed the trigger. Dropping the branch is the
  // recoverable answer — the gathering still gets every task that is not on the loop.
  if (visited.includes(templateId)) return { steps: [] }

  const { data, error } = await admin
    .from('gathering_template_steps')
    .select('id, position, label, help_text, kind, required, budget_default_cents, child_template_id')
    .eq('template_id', templateId)
    .eq('family_code', familyCode)
    // The read order the whole table is designed around — see the migration on why there
    // is no UNIQUE on (template_id, position). `created_at` is the tie-break, so two steps
    // sharing a position come out in the order they were authored rather than at random.
    .order('position', { ascending: true })
    .order('created_at', { ascending: true })

  if (error) return { steps: [], error: error.message }

  const rows = (data ?? []) as unknown as TemplateStepRow[]
  const out: FlatStep[] = []
  const path = [...visited, templateId]

  for (const step of rows) {
    if (step.kind !== 'template') {
      out.push({ templateId, step })
      continue
    }
    // The CHECK constraint makes this unreachable — `kind = 'template'` and a null child
    // cannot both be true — so a row that gets here is a schema that has drifted, and
    // skipping is the only honest thing to do with a step that names nothing.
    if (!step.child_template_id) continue

    const nested = await expandSteps(admin, familyCode, step.child_template_id, path, depth + 1)
    // FATAL RATHER THAN PARTIAL. A child whose steps could not be read would otherwise land a
    // gathering with a template attached and half its work missing, which is precisely the
    // half-failure `attachTemplatesToGathering` compensates for at the other end.
    if (nested.error) return { steps: [], error: nested.error }
    out.push(...nested.steps)
  }

  return { steps: out }
}

/**
 * Link a set of templates to a gathering, in the order given, and instantiate each one's
 * steps. This is the whole of what "build this gathering from these templates" means, and all
 * three create paths go through it — `createGathering`, `scheduleGathering` and
 * `addGatheringTemplate`.
 *
 * `templates` is consumed IN ORDER and the caller owns that order. `position` on the use row is
 * what records it, and `instantiateTemplateTasks` offsets each template's tasks past the last,
 * so the gathering reads as one list of work rather than three interleaved ones. A caller
 * handing this the raw result of a `.in('id', …)` read is handing it whatever order PostgREST
 * answered in — which is an order nobody chose, and it is permanent.
 *
 * ── THE JUNCTION ROW IS ROLLED BACK WHEN THE STEPS DO NOT LAND ──────────────────────
 * The use row has to be written first: it is the record that this gathering was built from this
 * template, and it is what `position` hangs off. There is no transaction available through
 * PostgREST, so a failure between the two writes used to leave the template LINKED with none of
 * its tasks — and then every caller's advice ("add the template again from the gathering") was
 * refused forever by `addGatheringTemplate`'s duplicate guard. The organizer was told it
 * failed, told it already existed, and left to work out unaided that removing it first is the
 * way through.
 *
 * So a failed instantiation deletes the use row again. That is a COMPENSATION rather than a
 * rollback, and it is only safe to make here because `instantiateTemplateTasks` writes its
 * tasks in ONE insert: a failure means there are no task rows for the unlink to orphan. If the
 * compensation itself fails there is nothing further to try from here, so it says so loudly in
 * the log and the template is still reported as failed — the caller's sentence is about what
 * did not happen, which is true either way.
 *
 * Returns the NAMES of the templates that could not be attached. It never throws and never
 * touches the gathering itself: the honest answer to a half-failure is a gathering that exists
 * with the templates that worked and a sentence naming the ones that did not.
 *
 * ── THE SEGMENT'S DAY AND PLACE ARE WRITTEN HERE, AND THE COPY IS THE POINT ─────
 * A use row is a SEGMENT since 20260819000001: the Welcome, the Picnic and the Send Off inside
 * one reunion, each with its own `occurs_on` and its own `location`. Both are nullable and mean
 * "not stated", so a one-day gathering in one place needs neither and reads exactly as it did
 * before the columns existed.
 *
 * `location` NO LONGER FALLS BACK TO ANYTHING, since 2026-08-19. It fell back to the template's
 * `default_location` — a place the template AUTHOR had stated once, copied onto every segment
 * built from it — and `20260819000007` dropped that column: a venue belongs to one occasion, and
 * the answer is a step of kind `'location'` handing the job to a named relative. So a freshly
 * linked segment is NULL unless the caller states a place, which is what the database already
 * did on its own (that migration asserts there is no DEFAULT expression and no trigger doing it).
 *
 * The fall-back had a real property worth remembering if one is ever wanted again: a STATED place
 * won over the default, never the other way round. Reversing the two — measured against the local
 * database on 2026-08-19 — silently overwrote an organizer's per-segment place with the
 * template's usual one, which is the whole failure the copy-not-reference rule exists to prevent,
 * arriving through the one line that implemented it.
 *
 * PER-TEMPLATE RATHER THAN PER-CALL, which is why `occursOn` and `location` live on the element
 * and not in a fifth parameter. `addGatheringTemplate` links one template and states both; the
 * two create paths link several and state neither. A `{ occursOn, location }` argument applied to
 * the whole call would silently give three segments of a three-day reunion the same day.
 *
 * A CASE IN `tests/rls` IS STILL OWED for `admin/gatherings.setGatheringSegment` and the widened
 * `addGatheringTemplate` — attack, positive control and an `alphaPending`. `lib/**` under
 * `npm test` is deliberately a boundary with no Supabase in it (§7b), so the runner that can call
 * these for real against real policies is the other one.
 */
export async function attachTemplatesToGathering(
  admin: AdminClient,
  gatheringId: string,
  familyCode: string,
  templates: readonly {
    id: string
    name: string
    /** This segment's day, `YYYY-MM-DD`. Already validated by the caller; null is "not stated". */
    occursOn?: string | null
    /** This segment's place. Null is "not stated"; there is no default to fall back to. */
    location?: string | null
  }[],
  positionFrom: number,
): Promise<string[]> {
  const failures: string[] = []

  for (const [index, template] of templates.entries()) {
    const useRes = await admin.from('gathering_template_uses').insert({
      family_code:  familyCode,
      gathering_id: gatheringId,
      template_id:  template.id,
      position:     positionFrom + index,
      // `?? null` on both, so an element that states nothing writes NULL rather than
      // `undefined` — which PostgREST omits from the payload, leaving the column to a default
      // this table deliberately does not have. Same answer either way today; stated so it stays
      // the same answer if one is ever added.
      occurs_on:    template.occursOn ?? null,
      // No fall-back — see the header. `?? null` rather than `|| null` so the shape matches
      // `occurs_on` above; the actions trim an empty box to null before it gets here.
      location:     template.location ?? null,
    })
    if (useRes.error) {
      console.error(`[gatherings] template use insert failed for ${gatheringId}/${template.id} in ${familyCode}: ${useRes.error.message}`)
      failures.push(template.name)
      continue
    }

    const result = await instantiateTemplateTasks(admin, gatheringId, familyCode, template.id)
    if (result.success) continue
    failures.push(template.name)

    // §3 applies to the compensation exactly as it does to the write it undoes: the pair of
    // ids is the predicate and the family conjunct goes on it too. There is no policy
    // underneath this client, so a delete keyed on two ids alone is keyed on nothing that
    // proves the row is this family's.
    const undoRes = await admin
      .from('gathering_template_uses')
      .delete()
      .eq('gathering_id', gatheringId)
      .eq('template_id', template.id)
      .eq('family_code', familyCode)

    if (undoRes.error) {
      console.error(`[gatherings] could not unlink ${template.id} from ${gatheringId} in ${familyCode} after its steps failed: ${undoRes.error.message}`
        + ' — the template is linked with no tasks on it, and removing it from the gathering will clear it.')
    }
  }

  return failures
}
