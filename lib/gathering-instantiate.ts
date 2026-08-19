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
}

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
    admin.from('gathering_template_steps')
      .select('id, position, label, help_text, kind, required, budget_default_cents')
      .eq('template_id', templateId)
      .eq('family_code', familyCode)
      // The read order the whole table is designed around — see the migration on why there
      // is no UNIQUE on (template_id, position). `created_at` is the tie-break, so two steps
      // sharing a position come out in the order they were authored rather than at random.
      .order('position', { ascending: true })
      .order('created_at', { ascending: true }),
    admin.from('gathering_tasks')
      .select('position')
      .eq('gathering_id', gatheringId)
      .eq('family_code', familyCode)
      .order('position', { ascending: false })
      .limit(1)
      .maybeSingle(),
  ])

  if (stepsRes.error) {
    console.error(`[gatherings] instantiate could not read steps of ${templateId} in ${familyCode}: ${stepsRes.error.message}`)
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

  const steps = (stepsRes.data ?? []) as TemplateStepRow[]
  if (steps.length === 0) {
    // NOT a failure. A template with no steps yet is an ordinary state — it is what every
    // template looks like for the minute between being created and having its first step
    // added — and a gathering scheduled from one is a gathering with no tasks, which
    // `taskProgress` deliberately does not report as complete (`total > 0`).
    return { success: true, created: 0 }
  }

  const offset = ((lastRes.data as { position: number } | null)?.position ?? -1) + 1

  const { error } = await admin.from('gathering_tasks').insert(
    steps.map((step, index) => ({
      family_code:  familyCode,
      gathering_id: gatheringId,
      template_id:  templateId,
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
 * `location` FALLS BACK TO THE TEMPLATE'S `default_location`, AND THE DATABASE DELIBERATELY DOES
 * NOT. That migration's header argues it out and asserts the absence: there is no DEFAULT
 * expression and no trigger, so a freshly linked segment comes out NULL unless something in the
 * application puts a value there. This is that something, and it is here rather than in
 * `addGatheringTemplate` so that all THREE create paths get it — `createGathering`,
 * `scheduleGathering` and `addGatheringTemplate` — which is the same argument that moved this
 * whole loop into this module: written per call site it was written twice and the two copies
 * disagreed.
 *
 * A TRIGGER WOULD BE WRONG TWICE OVER and the reason belongs beside the code that replaces it.
 * It would fire on UPDATE as well as INSERT, so it would re-copy the template's place over an
 * organizer's per-segment edit every time anything else on the row changed; and a DEFAULT
 * expression cannot see the row it is defaulting for, so it could not reach `template_id` at all.
 * The copy has to happen ONCE, at the moment of linking, which is exactly here.
 *
 * PER-TEMPLATE RATHER THAN PER-CALL, which is why these three live on the element and not in a
 * fifth parameter. `addGatheringTemplate` links one template and states both fields; the two
 * create paths link several and state neither. A `{ occursOn, location }` argument applied to
 * the whole call would silently give three segments of a three-day reunion the same day.
 *
 * ── MEASURED, 2026-08-19, AND CHECKED BY MUTATION ─────────────────────────
 * Against the real local Postgres, three templates linked in one call — Welcome with a default
 * and no stated place, Picnic with a default AND a stated place, Send Off with neither — and a
 * Send Off dated 2026-10-14, outside a 1–3 September span:
 *
 *     position 0  occurs_on 2026-09-01  location 'The lodge'    (default copied)
 *     position 1  occurs_on 2026-09-02  location 'Zilker'       (stated place wins)
 *     position 2  occurs_on 2026-10-14  location NULL           (neither, and out of span: stored)
 *
 * Then the fall-back order was REVERSED — `defaultLocation ?? location` — and the Picnic came
 * back as **'The pavilion'**: the organizer's per-segment place silently overwritten by the
 * template's usual one, which is the whole failure the copy-not-reference rule exists to
 * prevent, arriving through the one line that implements it. A green run is not evidence until
 * it has been seen to fail (AGENTS.md §7).
 *
 * THAT MEASUREMENT HAS NO PERMANENT HOME YET, and it is worth saying so rather than leaving the
 * paragraph looking like a test. It was a throwaway probe, not a committed one: `lib/**` under
 * `npm test` is deliberately a boundary with no Supabase in it (§7b), and the runner that calls
 * an action for real against real policies is `tests/rls`. A case there for
 * `admin/gatherings.setGatheringSegment` and the widened `addGatheringTemplate` is owed — attack,
 * positive control and an `alphaPending` — and until it exists this comment is the only record
 * that the copy was ever run.
 */
export async function attachTemplatesToGathering(
  admin: AdminClient,
  gatheringId: string,
  familyCode: string,
  templates: readonly {
    id: string
    name: string
    /** `gathering_templates.default_location`, used only when the element states no `location`. */
    defaultLocation?: string | null
    /** This segment's day, `YYYY-MM-DD`. Already validated by the caller; null is "not stated". */
    occursOn?: string | null
    /** This segment's place. Overrides `defaultLocation` when stated. */
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
      // THE FALL-BACK, and the order is load-bearing: an explicitly stated place wins over the
      // template's usual one, and `null` from the caller means "not stated" rather than "use the
      // default". `?? ` and not `||`, so a caller clearing a location to '' is not silently
      // handed the template's — the actions trim to null before they get here.
      location:     template.location ?? template.defaultLocation ?? null,
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
