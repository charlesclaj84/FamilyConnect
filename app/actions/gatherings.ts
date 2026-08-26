'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import {
  readOccurrences, resolveWhen, whenFromInput, writeOccurrences,
} from '@/lib/gathering-when-write'
import type { GatheringWhen } from '@/lib/gathering-when'
import { requireMember, requireRead, requireScope } from '@/lib/auth/guard'
import { canAny } from '@/lib/auth/permissions'
import { tierAllows } from '@/lib/auth/tier'
import { getMyNameInFamily } from '@/lib/auth/family'
import { todayLocal } from '@/lib/date-utils'
import { attachTemplatesToGathering } from '@/lib/gathering-instantiate'
import { notifyGatheringTaskSubmitted } from '@/lib/notifications'
import {
  parseAnswer, isGatheringTaskKind, taskProgress,
  GATHERING_STEP_KIND_HINT,
  type GatheringStatus, type GatheringTaskKind, type GatheringTaskStatus,
  type TaskProgress,
} from '@/lib/gatherings'

/**
 * GATHERINGS, member facing — the list, one gathering, my tasks, and scheduling.
 *
 * A gathering is the WORK around a date: a family authors a template (a named list of steps
 * of mixed kinds), schedules a gathering from one or more of them, hands each step to a
 * named relative as a task, and the assignee submits an answer an organizer approves or
 * denies with notes. Events is a separate, parallel product and nothing here touches it.
 *
 * ── WHICH CLIENT READS WHAT, AND WHY — read this before adding a query ───────────────
 * One rule, three parts, and the third is the one that is easy to get wrong:
 *
 *  1. **THE ROWS COME FROM THE USER CLIENT.** Which gathering and which task the caller may
 *     read is decided by the composed SELECT policies, not by a conjunct written here — so
 *     the code cannot come to disagree with the database about who may see what (AGENTS.md
 *     §2, §3). Those policies already supply `family_code = auth_family_code()` and
 *     `auth_membership_approved()`, which is why the user-client reads below carry no family
 *     conjunct of their own. **A read moved onto the admin client owes `.eq('family_code',
 *     …)` on the same line as the move.**
 *
 *  2. **FOUR LOOKUPS ARE RESOLVED ON THE ADMIN CLIENT, and they widen nothing.** A
 *     template's name, an assignee's name, the gathering a task belongs to, and a task's
 *     budget LINE. Every one is `.in('id', …)` over ids the caller has ALREADY been shown plus
 *     `.eq('family_code', …)`, so none of them can return a row the user client did not — and
 *     the first three are here because a policy that is perfectly RIGHT about its own table
 *     answers an embed with `null` (the fourth is here for the reason in rule 3, and is gated
 *     before it is called on the one screen where the money is withheld):
 *
 *       * `gathering_templates` keys on `admin/gathering-templates:view`, which an ordinary
 *         member does not hold, and `gathering_template_uses` keys on `gatherings:view` with
 *         `own_expr = 'false'` — so at scope `'own'` even a gathering's own CREATOR reads
 *         none of its template links. The task list would come back grouped under blank
 *         headings and `templates: []`, which the screen states as "built from no templates".
 *       * The `people` policy admits another relative's row only through `members:view`,
 *         which a family that restricts its Member Directory withholds; every row would read
 *         "assigned to (nobody)".
 *       * `gatherings` carries `self_expr = 'false'` while `gathering_tasks` carries
 *         `self_expr = assignee_id = auth_person_id()` — the latter written SPECIFICALLY so an
 *         assignee reads their own task in a family that has restricted `gatherings` view. RLS
 *         applies to an embedded relation, so those two facts together mean a
 *         `gatherings(...)` embed on the my-tasks read comes back null in exactly the
 *         configuration `/gatherings/my-tasks` exists to survive: a to-do list of nameless,
 *         undated gatherings, with no error anywhere. **PGRST201 is not the only way an embed
 *         answers nothing** (§8).
 *
 *     This is the argument `belongsToFamily` and `getChapters` already make: a template's
 *     NAME is family structure, the name of the relative holding a task is part of the task,
 *     and the title of the gathering a task belongs to is what makes the task legible at all.
 *
 *  3. **THE MONEY IS ADMIN-CLIENT AND GATED FIRST.** `gatherings/budget:view` is resolved
 *     with `canAny` BEFORE a single money column is selected — not fetched and hidden, which
 *     publishes it into the RSC payload regardless (§5). Once the caller is entitled to it,
 *     the figures are read on the service role for the reason `getActiveFundsForRouting`
 *     computes its balances there: a fund balance computed on the user client silently omits
 *     the transfer term for anyone without `transactions/fund-transfers:view`, and two
 *     members must never disagree about whether a gathering is over its fund.
 *
 *     **AND THE RULE IS ABSOLUTE, NOT A PREFERENCE ABOUT THE BALANCE.** Three columns hold
 *     this feature's money — `gatherings.budget_cents`, `gatherings.fund_id` and
 *     `gathering_tasks.budget_cents` — and **no read on the user client may name one, or
 *     `select('*')` on either table.** A `SELECT` grant narrowed to columns does not blank a
 *     field; PostgREST answers 42501 for the WHOLE query, which this codebase renders as
 *     "nothing here" (§8). So the cost of naming one is not a missing figure, it is a task
 *     list or a gathering list that empties itself. The note above `TASK_COLUMNS` has the
 *     full argument and `taskBudgetLines` is how the member-facing screens get their lines.
 *
 *     **ONE READ IS ON THE ADMIN CLIENT AND IS NOT GATED, AND IT IS NOT AN OVERSIGHT.**
 *     `getMyGatheringTasks` calls `taskBudgetLines` unconditionally, because the budget on a
 *     task is part of the task the member was HANDED and that list can hold nobody else's row.
 *     Its header argues it in full. Do not read "gated first" above as covering every money
 *     read in the module — it covers the two BANDS, which is what the restricted key is about.
 *
 * ── WHAT `taskCounts` COUNTS, STATED BECAUSE IT IS NOT OBVIOUS ───────────────────────
 * The tasks the CALLER MAY READ. `gatherings:view` defaults to `'any'` (a non-admin,
 * non-restricted key), so for every family that has not deliberately narrowed it the figure
 * is the whole gathering. A family that sets it to `'own'` has asked for the narrowing and
 * gets it — with the consequence that `gathering_tasks`'s `own_expr` is
 * `assignee_id = auth_person_id()`, so at that scope even a gathering's own creator sees
 * only the tasks assigned to them. That is the policy's answer, not one computed here, and
 * it is recorded rather than worked around: reading the tasks on the admin client to make
 * the count "complete" would publish rows the family has said this member may not read.
 *
 * ── EVERY WRITE IS ADMIN-CLIENT AND OWES §3 AND §4 BY HAND ──────────────────────────
 * There is no INSERT, UPDATE or DELETE policy on any of the six tables — the same shape
 * `fund_transfers` keeps — so the actions and the guard triggers ARE the write boundary and
 * the browser has none. Which means no policy is underneath any write below: every one
 * carries `.eq('family_code', g.familyCode)`, and every id arriving from a caller is checked
 * against the family BEFORE it is written onto a row.
 */

/**
 * The result every mutation in Gatherings returns.
 *
 * Stated in each of the feature's action modules rather than shared from one of them, and
 * that is deliberate: `{ success, message? }` is structurally identical wherever it is
 * declared, so a component importing it from either module type-checks against both — while
 * a single home would make one action module import another for a type and put a cycle
 * between two `'use server'` files for no gain. The KEY is what matters and it is `message`
 * everywhere in this feature: `admin/chapters` answers `error` and `dues`/`funds` answer
 * `message`, and a client reading the wrong one shows its fallback sentence for every real
 * failure.
 */
export interface ActionResult {
  success: boolean
  message?: string
}

export interface GatheringSummary {
  id: string
  title: string
  summary: string | null
  location: string | null
  startsOn: string
  endsOn: string | null
  /**
   * The ENVELOPE's times, and whether it is one block or several occasions — all three
   * materialised on `gatherings` by trigger, so a list can say when each gathering is without a
   * child join per row. `formatWhenBrief` reads them and refuses to print a range for a series.
   */
  startTime: string | null
  endTime: string | null
  isContinuous: boolean
  occurrenceCount: number
  status: GatheringStatus
  isPremier: boolean
  taskCounts: TaskProgress
}

export interface GatheringTaskRow {
  id: string
  label: string
  helpText: string | null
  kind: GatheringTaskKind
  required: boolean
  position: number
  status: GatheringTaskStatus
  dueOn: string | null
  budgetCents: number | null
  assignee: { id: string; name: string } | null
  answer: unknown | null
  templateName: string | null
  /** Latest submission, when there is one — this is how a denial reaches the member. */
  latest: {
    decision: 'pending' | 'approved' | 'denied'
    reviewNotes: string | null
    note: string | null
    createdAt: string
  } | null
}

/** `GatheringTaskRow` plus which gathering it belongs to — the my-tasks screen's row. */
export interface MyTaskRow extends GatheringTaskRow {
  gatheringId: string
  gatheringTitle: string
  gatheringStartsOn: string
}

export interface GatheringBudgetView {
  budgetCents: number | null
  fundId: string | null
  fundName: string | null
  fundBalanceCents: number | null
  lineCents: (number | null)[]
  otherCommittedCents: number
}

/**
 * WHY the money is missing, which a `null` budget on its own cannot say.
 *
 * ── THE TWO REASONS LOOK IDENTICAL AND ARE OPPOSITE ─────────────────────────────────
 * `budget: null` means the same thing to a component whether the caller was refused the grant
 * or a query failed, and the second is not a state to render silently: one transient PostgREST
 * refusal took away the budget band AND (because the screen keys the per-task Budget column on
 * `budget !== null`) every task's line, with nothing anywhere saying anything was missing. A
 * withheld figure and an unread figure are §5 and §8 respectively, and this feature is careful
 * about both everywhere else — `readBudget` returns a null BALANCE rather than a zero for
 * exactly this reason, and `getCalendarMonth` publishes `sources` so a month withheld is never
 * rendered as a month that is empty. This is that same field for the money.
 *
 *   * `'shown'`       — `budget` is populated and complete. Render the band.
 *   * `'withheld'`    — the caller does not hold `gatherings/budget:view`, so nothing was
 *                       fetched. `budget` is null and the band renders NOTHING: a placeholder
 *                       reading "Budget — hidden" tells every member of every family that this
 *                       gathering has money attached, which is the fact the key withholds.
 *   * `'unavailable'` — the caller is entitled and a read was refused. `budget` is null and
 *                       every `budgetCents` on `tasks` is null, so a screen showing figures
 *                       here would be showing zeroes it invented. This is the one state that
 *                       deserves a sentence: the money could not be read just now.
 *
 * A screen that ignores this field behaves exactly as it did before it existed, which is why
 * it is additive rather than a change to `budget`'s type.
 */
export type GatheringBudgetState = 'shown' | 'withheld' | 'unavailable'

export interface GatheringDetail extends GatheringSummary {
  /**
   * Every occasion, in entry order — what this screen PRINTS.
   *
   * The four envelope fields inherited from `GatheringSummary` are what a LIST reads; a detail
   * page has room to name each day and its times, and for a series that is the only honest
   * answer (the envelope of three Saturdays is a fortnight). NULL where the read failed, which
   * is different from a gathering with no dates — a state the database does not permit — so a
   * consumer falls back to the envelope rather than to nothing.
   */
  occurrences: { startsOn: string; startTime: string | null; endsOn: string | null; endTime: string | null }[] | null
  tasks: GatheringTaskRow[]
  /**
   * The gathering's SEGMENTS, in `position` order — the Welcome, the Picnic and the Send Off
   * inside one reunion (20260819000001).
   *
   * The task list on this screen is already grouped by template; `occursOn` and `location` are
   * what let each group heading say WHEN and WHERE that part happens. Both are nullable and mean
   * "not stated", so a group with neither reads exactly as it does today — which is most
   * gatherings, and is why these were added ADDITIVELY rather than as a new shape.
   *
   * `occursOn` IS NOT CONSTRAINED TO `startsOn..endsOn` and this screen does not police it. A
   * family member reading their own reunion is not the person who reconciles a date; the organizer
   * is, so the out-of-span marking lives on `/admin/gatherings/[id]`. Printing a warning here
   * would tell forty relatives that something is wrong with a gathering they cannot edit.
   */
  templates: {
    id: string
    name: string
    occursOn: string | null
    location: string | null
  }[]
  /**
   * null unless the caller holds `gatherings/budget:view` — NOT FETCHED otherwise (§5) — and
   * ALSO null when the figures could not be read, which `readBudget` chooses deliberately over
   * reporting an unread total as zero. `budgetState` is which of the two it was; never render a
   * null budget as a sentence about the caller's permissions without reading it.
   */
  budget: GatheringBudgetView | null
  /** Why `budget` is null, when it is. See `GatheringBudgetState`. */
  budgetState: GatheringBudgetState
  /** `admin/gatherings:edit` — shows the link across to the organizer console. */
  canManage: boolean
}

export interface PremierGathering {
  id: string
  title: string
  summary: string | null
  location: string | null
  startsOn: string
  endsOn: string | null
  taskCounts: TaskProgress
  /**
   * The band's photograph, already resolved to a URL — `null` when the family has not set one,
   * in which case the band draws the kit's traced-tree placeholder instead.
   *
   * A URL and not a path, because the ONE thing the component may not do is know which bucket
   * this lives in. `photo_path` is the storage truth (`20260820000010` argues why a path rather
   * than a URL is stored); turning it into something fetchable is this layer's job, so a future
   * decision to sign these instead of serving them publicly is a change here and nowhere else.
   */
  photoUrl: string | null
}

// ── The selects, hoisted ─────────────────────────────────────────────────────────────
//
// Named consts with hand-declared row interfaces beside them rather than inline strings,
// for the reason `DISBURSEMENT_SELECT` in app/actions/funds.ts is: supabase-js's type-LEVEL
// select parser does not understand a constraint-qualified embed and collapses the whole
// result to `GenericStringError` the moment it meets one, so every field access on the row
// becomes an error. A cast is unavoidable; a cast to a NAMED shape at least says what is
// expected back, and the string sitting next to the interface is the only place that truth
// exists while the client is untyped.
//
// THE MONEY COLUMNS ARE ABSENT FROM `GATHERING_SELECT` ON PURPOSE, for two reasons that
// happen to point the same way. `budget_cents` and `fund_id` are read only by the gated money
// path below, and selecting them here and dropping them on the way out would still have
// fetched them (§5). They are also not this client's to read at all — see the note above
// `TASK_COLUMNS`, which is the same rule on the other table.

// `start_time`, `end_time` and `is_continuous` arrived with `20260826000001` — the envelope,
// materialised from `gathering_occurrences` by trigger, so a list can say when each gathering
// is without a child join per row.
const GATHERING_SELECT = 'id, title, summary, location, starts_on, ends_on, start_time, '
  + 'end_time, is_continuous, status, is_premier, photo_path'

interface GatheringRow {
  id: string
  title: string
  summary: string | null
  location: string | null
  starts_on: string
  ends_on: string | null
  status: string
  is_premier: boolean
  photo_path: string | null
  // Added with `20260826000001` — the envelope, materialised on `gatherings` by trigger.
  start_time: string | null
  end_time: string | null
  is_continuous: boolean
}

/**
 * The gathering list, with just enough of each task to count it.
 *
 * `gathering_tasks(status)` is a BARE embed and is correct today: `gathering_tasks` has
 * exactly one foreign key to `gatherings`. `gathering_template_uses` is a junction between
 * `gatherings` and `gathering_templates` and does NOT make this ambiguous — PostgREST infers
 * a many-to-many only where a junction's two foreign-key columns ARE its primary key, and
 * every table in this feature carries a surrogate `id` precisely so that never happens
 * (AGENTS.md §8, and `announcement_unpins` is the incident that taught it). A second foreign
 * key from `gathering_tasks` to `gatherings` would break this silently — PGRST201 is an
 * empty list, not an error — so it must be constraint-named in the same commit as any such
 * column.
 */
const GATHERING_LIST_SELECT = `${GATHERING_SELECT}, gathering_tasks(status)`

interface GatheringListRow extends GatheringRow {
  gathering_tasks: { status: string }[] | null
}

/**
 * The task columns the USER CLIENT asks for — and `budget_cents` is deliberately not one.
 *
 * There used to be two of these strings, one with `budget_cents` on the end, chosen by
 * `canSeeBudget`. The §5 decision is unchanged and has simply moved one layer up: it is now
 * whether `taskBudgetLines` is CALLED, not which string is selected, so the money is still a
 * query that did not happen for a caller who may not see it rather than a field dropped on the
 * way out. What moved it is the second reason:
 *
 * ── THE THREE MONEY COLUMNS ARE READ ON THE SERVICE ROLE, EVERYWHERE IN THIS FEATURE ─
 * `gatherings.budget_cents`, `gatherings.fund_id` and `gathering_tasks.budget_cents` are the
 * three columns this feature's money lives in, and no user-client read may NAME one. A
 * column-level `SELECT` grant narrowing any of them for `authenticated` does not blank a
 * field — PostgREST answers **42501 for the whole query** — and this codebase renders a
 * refused query as "nothing here" (§8). So the failure would not be a missing budget line: it
 * would be `/gatherings/my-tasks` and the task table on `/gatherings/[id]` going empty, with
 * nothing on either screen saying why, the next time somebody tightened a grant.
 *
 * `20260819000000`'s header argues at length that a column narrowing is not what makes
 * `gatherings/budget` mean anything — `supabase/seed.sql` issues `GRANT ALL ON ALL TABLES IN
 * SCHEMA public TO anon, authenticated` after every reset, so one would be undone within
 * seconds locally and read as a protection that is not there. That argument is about whether
 * the DATABASE keeps the promise. This is a different question: whether a member's task list
 * should depend on the answer. It should not. Every money read in the feature is on the admin
 * client with `.eq('family_code', …)` applied by hand (§3), and this string is what keeps the
 * member-facing half of that true.
 */
const TASK_COLUMNS =
  'id, label, help_text, kind, required, position, status, due_on'
  + ', assignee_id, answer, template_id'

interface TaskRow {
  id: string
  label: string
  help_text: string | null
  kind: string
  required: boolean
  position: number
  status: string
  due_on: string | null
  assignee_id: string | null
  answer: unknown | null
  template_id: string | null
}

/**
 * A task with the id of the gathering it hangs off — the my-tasks read, which spans every
 * gathering.
 *
 * ── NO `gatherings(...)` EMBED, AND THAT IS THE POINT OF THIS SCREEN ─────────────────
 * `gathering_id` is a plain column here, and the title and the date come from
 * `gatheringHeadings` on the admin client. An embed would be emptied by RLS — not refused with
 * an error, answered with `null` — in precisely the family this page was written for:
 * `gathering_tasks` carries `self_expr = assignee_id = auth_person_id()` so an assignee always
 * reads their own task, while `gatherings` carries `self_expr = 'false'`, so a family that has
 * restricted `gatherings:view`, or a caller at scope `'own'` looking at a gathering somebody
 * else created, gets the task and not the gathering it belongs to. Every row would then render
 * `gatheringTitle: ''` — an empty, invisible link heading — and `gatheringStartsOn: ''`, which
 * `formatDate` answers null for, so the date would disappear too. See rule 2 in the module
 * header; this is the §8 failure in its quietest costume.
 */
const MY_TASK_SELECT = `${TASK_COLUMNS}, gathering_id`

interface MyTaskDbRow extends TaskRow {
  gathering_id: string
}

interface SubmissionRow {
  task_id: string
  decision: string
  review_notes: string | null
  note: string | null
  created_at: string
}

// ── Small shared shapes ──────────────────────────────────────────────────────────────

/**
 * A status straight off the row, cast rather than narrowed, and the cast is the decision.
 *
 * `taskProgress` handles a status it does not recognise by counting it into `total` and into
 * none of the four buckets, so the gathering reads as UNFINISHED rather than as complete —
 * the safe direction for an unknown value. Mapping an unrecognised string to `'open'` here
 * would be a second, weaker copy of that rule sitting in front of it.
 */
const asTaskStatuses = (rows: readonly { status: string }[]): { status: GatheringTaskStatus }[] =>
  rows.map(r => ({ status: r.status as GatheringTaskStatus }))

const fullName = (p: { first_name: string | null; last_name: string | null } | undefined) =>
  p ? `${p.first_name ?? ''} ${p.last_name ?? ''}`.trim() : ''

/**
 * Names for a set of `people.id`s the caller has already been shown, on the admin client.
 *
 * See rule 2 in the module header for why this is not a `people` embed on the user client.
 * It is `.in('id', ids)` AND `.eq('family_code', familyCode)`: the ids come from rows RLS
 * already released to this caller, and the family conjunct is what stops a task carrying a
 * stale `assignee_id` from another family (there is none — `tg_gathering_task_same_family`
 * refuses one — but §3's obligation is discharged by hand on this client, not assumed from a
 * trigger).
 *
 * PLAIN "First Last", not `disambiguatedName`. Two Martha Allens matter in a PICKER, where
 * the roster is on screen and the choice is between them — `getGatheringAssignableMembers`
 * is where that job lives and it has the whole roster to score against. Here the name labels
 * one row of a task table; scoring it against the handful of assignees on one gathering
 * would report a duplicate as unambiguous exactly when the family has two.
 */
async function personNames(
  ids: readonly string[],
  familyCode: string,
): Promise<Map<string, string>> {
  const unique = [...new Set(ids.filter(Boolean))]
  if (unique.length === 0) return new Map()

  const { data, error } = await createAdminClient()
    .from('people')
    .select('id, first_name, last_name')
    .in('id', unique)
    .eq('family_code', familyCode)

  // §8. `data` alone cannot tell a refused query from a family with nobody in it, and this
  // one would render a task list where every row says nobody is doing it.
  if (error) {
    console.error(`[gatherings] assignee names read failed for ${familyCode}: ${error.message}`)
    return new Map()
  }

  const out = new Map<string, string>()
  for (const row of (data ?? []) as { id: string; first_name: string | null; last_name: string | null }[]) {
    out.set(row.id, fullName(row))
  }
  return out
}

/** Template names for a set of template ids, on the admin client. Same argument as above. */
async function templateNames(
  ids: readonly (string | null)[],
  familyCode: string,
): Promise<Map<string, string>> {
  const unique = [...new Set(ids.filter((id): id is string => Boolean(id)))]
  if (unique.length === 0) return new Map()

  const { data, error } = await createAdminClient()
    .from('gathering_templates')
    .select('id, name')
    .in('id', unique)
    .eq('family_code', familyCode)

  if (error) {
    console.error(`[gatherings] template names read failed for ${familyCode}: ${error.message}`)
    return new Map()
  }

  const out = new Map<string, string>()
  for (const row of (data ?? []) as { id: string; name: string }[]) out.set(row.id, row.name)
  return out
}

/**
 * The title and start date of a set of gatherings, on the admin client.
 *
 * Same argument as `templateNames` above, and rule 2 in the module header has the whole of why
 * an embed cannot do this job. The ids come from task rows RLS has already released to this
 * caller, so nothing here is published that the caller was not already holding a task on.
 */
async function gatheringHeadings(
  ids: readonly string[],
  familyCode: string,
): Promise<Map<string, { title: string; startsOn: string }>> {
  const out = new Map<string, { title: string; startsOn: string }>()
  const unique = [...new Set(ids.filter(Boolean))]
  if (unique.length === 0) return out

  const { data, error } = await createAdminClient()
    .from('gatherings')
    .select('id, title, starts_on')
    .in('id', unique)
    .eq('family_code', familyCode)

  // §8: an empty result here IS the bug this lookup was written to fix — a to-do list of
  // nameless gatherings — so a refusal is logged rather than rendered as one.
  if (error) {
    console.error(`[gatherings] gathering headings read failed for ${familyCode}: ${error.message}`)
    return out
  }

  for (const row of (data ?? []) as { id: string; title: string; starts_on: string }[]) {
    out.set(row.id, { title: row.title, startsOn: row.starts_on })
  }
  return out
}

/**
 * The budget LINE on each of a set of tasks the caller has already been shown, on the admin
 * client. `null` — the whole return, not a value in it — means the read was refused.
 *
 * ── WHY THIS IS NOT A COLUMN ON THE TASK QUERY ──────────────────────────────────────
 * `gathering_tasks.budget_cents` is one of the three money columns no user-client read in this
 * feature may name; the note above `TASK_COLUMNS` has the whole argument. This is the fourth
 * member of the `.in('id', ids)` + `.eq('family_code', …)` family described in rule 2 of the
 * module header, and it widens nothing for the same reason the other three do not: every id
 * comes from a row RLS has already released to this caller, so no task can appear here that
 * the user client did not hand over first, and the family conjunct is §3's obligation
 * discharged by hand on the client that has no policy underneath it.
 *
 * ── A REFUSED READ IS `null`, AND `getGatheringDetail` TURNS THAT INTO A SENTENCE ────
 * An empty map and a refused query are the same shape and are not the same fact: with no
 * lines, every task's Budget cell reads "—", which states that the family has budgeted nothing
 * for any of this work. That is §8's failure in the direction that matters most — money — so
 * the two are told apart here and the caller decides what to say. `getGatheringDetail` folds
 * it into `budgetState`; `getMyGatheringTasks` logs it and shows the member no budget line,
 * which is the honest answer for a screen with no band to explain it on.
 */
async function taskBudgetLines(
  taskIds: readonly string[],
  familyCode: string,
): Promise<Map<string, number | null> | null> {
  const out = new Map<string, number | null>()
  if (taskIds.length === 0) return out

  const { data, error } = await createAdminClient()
    .from('gathering_tasks')
    .select('id, budget_cents')
    .in('id', taskIds)
    .eq('family_code', familyCode)

  if (error) {
    console.error(`[gatherings] task budget lines read failed for ${familyCode}: ${error.message}`)
    return null
  }

  for (const row of (data ?? []) as { id: string; budget_cents: number | null }[]) {
    out.set(row.id, row.budget_cents)
  }
  return out
}

/** The user-scoped client, so the one helper that takes a client cannot be handed a stray. */
type UserClient = Awaited<ReturnType<typeof createClient>>

/**
 * The latest submission per task, keyed by task id.
 *
 * ON THE CLIENT IT IS HANDED, which for the member-facing reads is the USER client: the
 * `gathering_task_submissions` policy carries `submitted_by = auth_person_id()` as its
 * `self_expr`, and that branch is what guarantees a member reads back the organizer's
 * `review_notes` on their own denial even in a family that has restricted `gatherings`
 * altogether. Losing that would break the whole feedback loop, which is the feature.
 *
 * ORDERED DESCENDING AND TAKEN FIRST-WINS, rather than filtered to `decision = 'pending'`:
 * what the screen shows is the most recent thing that happened to this task, and after a
 * denial that row is `'denied'` with the notes on it. A resubmission is a NEW row, never an
 * edit of the refused one, so "first of a descending order" is the whole rule.
 */
async function latestSubmissions(
  client: UserClient,
  taskIds: readonly string[],
): Promise<Map<string, GatheringTaskRow['latest']>> {
  const out = new Map<string, GatheringTaskRow['latest']>()
  if (taskIds.length === 0) return out

  const { data, error } = await client
    .from('gathering_task_submissions')
    .select('task_id, decision, review_notes, note, created_at')
    .in('task_id', taskIds)
    .order('created_at', { ascending: false })

  if (error) {
    console.error(`[gatherings] submissions read failed: ${error.message}`)
    return out
  }

  for (const row of (data ?? []) as SubmissionRow[]) {
    // First one wins — the order above put the newest first.
    if (out.has(row.task_id)) continue
    out.set(row.task_id, {
      decision:    row.decision as 'pending' | 'approved' | 'denied',
      reviewNotes: row.review_notes,
      note:        row.note,
      createdAt:   row.created_at,
    })
  }
  return out
}

/**
 * `budgets` is `null` for a caller who may not see the money (the query was never run) and for
 * a read that was refused (`taskBudgetLines` answered null) — both of which come out as
 * `budgetCents: null`, because a task row has nowhere to put the difference. The distinction is
 * carried on `GatheringDetail.budgetState`, one level up, where there is a band to say it on.
 */
function toTaskRow(
  row: TaskRow,
  names: Map<string, string>,
  templates: Map<string, string>,
  latest: Map<string, GatheringTaskRow['latest']>,
  budgets: Map<string, number | null> | null,
): GatheringTaskRow {
  return {
    id:           row.id,
    label:        row.label,
    helpText:     row.help_text,
    kind:         row.kind as GatheringTaskKind,
    required:     row.required,
    position:     row.position,
    status:       row.status as GatheringTaskStatus,
    dueOn:        row.due_on,
    budgetCents:  budgets?.get(row.id) ?? null,
    assignee:     row.assignee_id
      ? { id: row.assignee_id, name: names.get(row.assignee_id) ?? '' }
      : null,
    answer:       row.answer ?? null,
    templateName: row.template_id ? templates.get(row.template_id) ?? null : null,
    latest:       latest.get(row.id) ?? null,
  }
}

// ── Reads ────────────────────────────────────────────────────────────────────────────

/**
 * Every gathering the caller may see, soonest first, with each one's task progress.
 *
 * `requireRead`, not `requireScope(…, 'view')`, and that is the right guard here: unlike
 * `admin/chapters` — configuration nobody owns — a gathering HAS an owner (`created_by`), so
 * `'own'` is a legitimate way to hold view and the policy has an `own_expr` for it. This
 * answers "may they read this kind of thing at all"; the policy decides which rows.
 *
 * The list is not split into upcoming and past here. `gatheringTiming` takes `today` as a
 * parameter for the reason every date helper in this codebase does, and the screen is where
 * the clock is read — an action that split the list would be baking one server's idea of
 * today into a cached payload.
 */
export async function getGatherings(): Promise<GatheringSummary[]> {
  const g = await requireRead('gatherings')
  if (!g.ok) return []

  const supabase = await createClient()
  const { data, error } = await supabase
    .from('gatherings')
    .select(GATHERING_LIST_SELECT)
    .order('starts_on', { ascending: true })
    .order('created_at', { ascending: true })

  if (error) {
    console.error(`[gatherings] list read failed for ${g.familyCode}: ${error.message}`)
    return []
  }

  return ((data ?? []) as unknown as GatheringListRow[]).map(row => ({
    id:         row.id,
    title:      row.title,
    summary:    row.summary,
    location:   row.location,
    startsOn:   row.starts_on,
    endsOn:     row.ends_on,
    startTime:  row.start_time ? String(row.start_time).slice(0, 5) : null,
    endTime:    row.end_time ? String(row.end_time).slice(0, 5) : null,
    isContinuous: row.is_continuous !== false,
    occurrenceCount: 1,
    status:     row.status as GatheringStatus,
    isPremier:  row.is_premier,
    taskCounts: taskProgress(asTaskStatuses(row.gathering_tasks ?? [])),
  }))
}

/**
 * One gathering, its tasks, the templates it was built from, and — only when the caller
 * holds `gatherings/budget:view` — its money.
 *
 * Returns null for a gathering that is not the caller's to read, whether because it belongs
 * to another family or because the policy withholds it. The page turns that into
 * `notFound()`, which is the same answer for both and deliberately does not distinguish
 * them.
 */
export async function getGatheringDetail(gatheringId: string): Promise<GatheringDetail | null> {
  const g = await requireRead('gatherings')
  if (!g.ok) return null
  if (!gatheringId) return null

  const supabase = await createClient()
  const { data: row, error } = await supabase
    .from('gatherings')
    .select(GATHERING_SELECT)
    .eq('id', gatheringId)
    .maybeSingle()

  if (error) {
    console.error(`[gatherings] detail read failed for ${gatheringId} in ${g.familyCode}: ${error.message}`)
    return null
  }
  if (!row) return null
  const gathering = row as unknown as GatheringRow

  // THE TWO GRANTS ARE RESOLVED FIRST, IN THEIR OWN ROUND, AND THAT ORDERING IS THE SECURITY
  // MODEL. `canSeeBudget` decides which columns the task query even asks for, so it cannot be
  // resolved alongside that query — the whole of §5 is that a withheld figure has to be a fetch
  // that did not happen rather than a field dropped on the way out.
  //
  // `canAny`, not `can`: a budget is family money with no personal copy. The row a member would
  // "own" here is a gathering they created whose budget pays for a task assigned to THEMSELVES,
  // which is the abuse case — exactly the reasoning that made `canAny` exist for disbursements.
  // `permission_table_map` gives `gatherings/budget` `own_expr = 'false'` to say the same thing,
  // and the key is on `NO_OWNER_KEYS` so the grid does not render an Own switch that grants
  // nothing.
  const [canManage, canSeeBudget] = await Promise.all([
    canAny(g.userId, 'admin/gatherings', 'edit'),
    // Grant AND plan — `gatherings/budget` is `tier: 'standard'` since 2026-08-19, and the
    // tier is resolved here rather than at the page because the money columns are chosen
    // from this answer (§5). `getMyFamilyTier` is `cache()`d per request, so it costs no
    // extra query. It withholds the FETCH and never a row: see `getAdminGatherings`.
    Promise.all([
      canAny(g.userId, 'gatherings/budget', 'view'),
      tierAllows(g.userId, 'gatherings/budget'),
    ]).then(([granted, inPlan]) => granted && inPlan),
  ])

  const [tasksRes, usesRes] = await Promise.all([
    supabase
      .from('gathering_tasks')
      .select(TASK_COLUMNS)
      .eq('gathering_id', gatheringId)
      .order('position', { ascending: true })
      .order('created_at', { ascending: true }),
    // ── THE TEMPLATE-USE ROWS ARE READ ON THE ADMIN CLIENT ──────────────────────────
    // `perm:gathering_template_uses:select` carries `own_expr = 'false'`, so nothing but
    // `gatherings:view = 'any'` admits a row. A caller at scope `'own'` — the gathering's own
    // CREATOR included, since `gatherings`' `own_expr` is `created_by = auth_person_id()` —
    // therefore reads the gathering and none of its template links, and this screen would then
    // state that it was built from no templates and lose the task list's grouping. Silent, and
    // §8's shape exactly. The caller has already been shown the gathering by the read above, so
    // this publishes nothing further; §3's obligation is discharged by hand with both
    // conjuncts, which is the same bargain `templateNames` already makes for the NAMES.
    createAdminClient()
      .from('gathering_template_uses')
      // `occurs_on` and `location` — the segment's day and place, for the task group's heading.
      // They ride along on a read this screen was already making, so the two columns cost nothing.
      .select('template_id, position, occurs_on, location')
      .eq('gathering_id', gatheringId)
      .eq('family_code', g.familyCode)
      .order('position', { ascending: true }),
  ])

  if (tasksRes.error) {
    console.error(`[gatherings] task read failed for ${gatheringId} in ${g.familyCode}: ${tasksRes.error.message}`)
  }
  if (usesRes.error) {
    console.error(`[gatherings] template-use read failed for ${gatheringId} in ${g.familyCode}: ${usesRes.error.message}`)
  }
  const taskRows = (tasksRes.data ?? []) as unknown as TaskRow[]
  const useRows = (usesRes.data ?? []) as {
    template_id: string; position: number; occurs_on: string | null; location: string | null
  }[]

  const [names, templates, latest, budget, budgetLines, occurrenceMap] = await Promise.all([
    personNames(taskRows.map(t => t.assignee_id ?? ''), g.familyCode),
    templateNames([...taskRows.map(t => t.template_id), ...useRows.map(u => u.template_id)], g.familyCode),
    latestSubmissions(supabase, taskRows.map(t => t.id)),
    // NOT FETCHED rather than fetched and hidden. Props are serialized into the RSC payload
    // whether a component renders them or not (§5), so a withheld budget has to be a query
    // that did not run. THE SAME GATE COVERS BOTH MONEY READS: the band's figures and the task
    // table's per-row lines are the same restricted key, and the second used to ride along on
    // the task query as an extra column — see `TASK_COLUMNS` for why it no longer can.
    canSeeBudget ? readBudget(gatheringId, g.familyCode) : Promise.resolve(null),
    canSeeBudget ? taskBudgetLines(taskRows.map(t => t.id), g.familyCode) : Promise.resolve(null),
    // ── EVERY OCCASION, ON THE USER CLIENT ──────────────────────────────────────────
    // `gathering_occurrences` carries a SELECT policy keyed on `gatherings:view` through
    // `auth_may_see_gathering()`, so RLS does the narrowing here — and `readOccurrences`
    // applies `.eq('family_code', …)` beside it anyway, which is belt-and-braces on the user
    // client and the whole boundary on any future admin-client caller.
    //
    // NOT gated on anything: the caller has already been shown this gathering by the read
    // above, and WHEN it happens is part of what a gathering IS rather than a restricted
    // figure like the budget.
    readOccurrences(supabase, g.familyCode, [gatheringId]),
  ])

  // WITHHELD AND UNREADABLE ARE THE SAME `null` AND MUST NOT BE THE SAME SENTENCE — the whole
  // of `GatheringBudgetState`'s doc comment. Both money reads count: the band without the lines
  // reports the family's whole budget as unallocated, and the lines without the band leave the
  // task column standing under no total, so either half missing makes the figures wrong rather
  // than partial.
  const occurrences = occurrenceMap?.get(gatheringId) ?? null

  const budgetState: GatheringBudgetState = !canSeeBudget
    ? 'withheld'
    : budget !== null && budgetLines !== null ? 'shown' : 'unavailable'

  return {
    id:         gathering.id,
    title:      gathering.title,
    summary:    gathering.summary,
    location:   gathering.location,
    startsOn:   gathering.starts_on,
    endsOn:     gathering.ends_on,
    startTime:  gathering.start_time ? String(gathering.start_time).slice(0, 5) : null,
    endTime:    gathering.end_time ? String(gathering.end_time).slice(0, 5) : null,
    isContinuous: gathering.is_continuous !== false,
    // NULL on a failed read, never an empty list — §8. An empty list would render as a
    // gathering with no dates, which the database does not permit, so a consumer falling back
    // to the envelope is the honest degradation.
    occurrences: occurrences ?? null,
    // ONE unless the occurrences were read. This screen prints the whole answer from
    // `occurrences` below, so the count is only here to satisfy `formatWhenBrief` for a caller
    // that has the summary and not the detail.
    occurrenceCount: occurrences?.length ?? 1,
    status:     gathering.status as GatheringStatus,
    isPremier:  gathering.is_premier,
    taskCounts: taskProgress(asTaskStatuses(taskRows)),
    tasks:      taskRows.map(t => toTaskRow(t, names, templates, latest, budgetLines)),
    templates:  useRows.map(u => ({
      id:       u.template_id,
      name:     templates.get(u.template_id) ?? '',
      occursOn: u.occurs_on ?? null,
      location: u.location ?? null,
    })),
    budget,
    budgetState,
    canManage,
  }
}

/**
 * `'planning'` and `'scheduled'` — the statuses that still CLAIM money from a fund. The note at
 * the foot of `readBudget`'s header has why this pair is spelled out in both action modules.
 */
const LIVE_STATUSES = ['planning', 'scheduled'] as const

/**
 * The four money figures behind the budget band, on the ADMIN client.
 *
 * ONLY EVER CALLED BEHIND `gatherings/budget:view` — it does no gating of its own and must
 * not be exported.
 *
 * ── ITS `null` MEANS "COULD NOT READ", NEVER "NOT ENTITLED" ──────────────────────────
 * Entitlement is decided by the caller, which does not call this function at all when the grant
 * is missing. So a null from HERE is always a refused query (or a gathering that vanished
 * between the user-client read and this one), and `getGatheringDetail` reports it as
 * `budgetState: 'unavailable'` rather than letting it collapse into the withheld case. That
 * distinction is the whole of `GatheringBudgetState` and it exists because the two are one
 * `null` on the wire: a screen keying its Budget column on `budget !== null` took the entire
 * money picture off the page for a transient failure and said nothing.
 *
 * The failure branches below are graded on purpose rather than all answering null — the fund
 * FIGURES failing still returns the budget and the lines, because those are true, with the
 * balance null so no red line is drawn from a figure nobody read. Only a failure of the budget
 * or the lines themselves is unrecoverable, because there is no honest value to put in their
 * place: zero would state that the family has budgeted nothing.
 *
 * Three more things about it are decisions:
 *
 *  * **The balance comes from `fund_balance_cents(p_fund_id)`, through the service role.**
 *    That function is the database's own four-term definition of a balance (contributions −
 *    disbursements + transfers in − transfers out) and it has NO
 *    `authenticated` EXECUTE grant anywhere in the migration chain, so it can only be called
 *    this way. Recomputing the sum on the user client instead — which `getFunds` does — omits
 *    the transfer term for any caller without `transactions/fund-transfers:view`, and the
 *    whole point of this figure is that two members looking at the same reunion must not
 *    disagree about whether it is over its fund.
 *  * **The task lines are the WHOLE set**, read here rather than taken from the task rows
 *    above, which the `gathering_tasks` policy may have narrowed for a caller at scope
 *    `'own'`. `overAllocated` computed from a partial set of lines is a money figure that
 *    varies by viewer, which is the same failure in a second costume.
 *  * **`otherCommittedCents` counts only LIVE gatherings** — `planning` and `scheduled`. A
 *    cancelled gathering claims nothing. A COMPLETE one has already spent whatever it spent,
 *    and that spend is in the fund's balance as disbursements, so counting its budget again
 *    would subtract the same money twice and report a healthy fund as overdrawn.
 *
 * `LIVE_STATUSES` above is the same pair, under the same name, as the one in
 * `app/actions/admin/gatherings.ts`, and the two MUST agree: they compute one figure that is
 * shown on `/gatherings/[id]` and on `/admin/gatherings/[id]`, and a family reading both must
 * not be told two different things about the same fund. They are two consts rather than one
 * because a `'use server'` module may export nothing but async functions, so neither action
 * module can share a value with the other — one greppable name in both is the best substitute
 * available.
 */
async function readBudget(gatheringId: string, familyCode: string): Promise<GatheringBudgetView | null> {
  const admin = createAdminClient()

  const [moneyRes, linesRes] = await Promise.all([
    admin.from('gatherings')
      .select('budget_cents, fund_id')
      .eq('id', gatheringId).eq('family_code', familyCode).maybeSingle(),
    admin.from('gathering_tasks')
      .select('budget_cents')
      .eq('gathering_id', gatheringId).eq('family_code', familyCode),
  ])

  if (moneyRes.error || linesRes.error) {
    console.error(`[gatherings] budget read failed for ${gatheringId} in ${familyCode}: `
      + (moneyRes.error?.message ?? linesRes.error?.message))
    return null
  }
  if (!moneyRes.data) return null

  const money = moneyRes.data as { budget_cents: number | null; fund_id: string | null }
  const lineCents = ((linesRes.data ?? []) as { budget_cents: number | null }[]).map(l => l.budget_cents)

  if (!money.fund_id) {
    // No fund, so no balance and nothing else drawing on it. `gatherings_budget_needs_fund`
    // means a budget cannot exist here either, and `gatheringBudgetMath` reads a null balance
    // as "unknown" and draws no red line — not entitled to see it, and not overspent, are the
    // same answer to this function and deliberately different sentences on the screen.
    return {
      budgetCents: money.budget_cents,
      fundId: null, fundName: null, fundBalanceCents: null,
      lineCents, otherCommittedCents: 0,
    }
  }

  const [fundRes, balanceRes, othersRes] = await Promise.all([
    admin.from('funds').select('name')
      .eq('id', money.fund_id).eq('family_code', familyCode).maybeSingle(),
    admin.rpc('fund_balance_cents', { p_fund_id: money.fund_id }),
    admin.from('gatherings').select('budget_cents')
      .eq('family_code', familyCode)
      .eq('fund_id', money.fund_id)
      .neq('id', gatheringId)
      .in('status', LIVE_STATUSES),
  ])

  if (fundRes.error || balanceRes.error || othersRes.error) {
    console.error(`[gatherings] fund figures failed for ${gatheringId} in ${familyCode}: `
      + (fundRes.error?.message ?? balanceRes.error?.message ?? othersRes.error?.message))
    // The lines and the budget are still true, so they are still returned; the balance is
    // null, which `gatheringBudgetMath` reads as unknown and draws no marker for. A balance
    // we could not read must never be rendered as zero — that paints the alarm line over a
    // perfectly healthy fund and nothing on the screen could explain it.
    return {
      budgetCents: money.budget_cents,
      fundId: money.fund_id, fundName: null, fundBalanceCents: null,
      lineCents, otherCommittedCents: 0,
    }
  }

  const otherCommittedCents = ((othersRes.data ?? []) as { budget_cents: number | null }[])
    .reduce((sum, row) => sum + (row.budget_cents ?? 0), 0)

  return {
    budgetCents:      money.budget_cents,
    fundId:           money.fund_id,
    fundName:         (fundRes.data as { name: string } | null)?.name ?? null,
    fundBalanceCents: typeof balanceRes.data === 'number' ? balanceRes.data : null,
    lineCents,
    otherCommittedCents,
  }
}

/**
 * Every task assigned to the caller, across every gathering, soonest deadline first.
 *
 * ── THE USER CLIENT, AND THE `self_expr` BRANCH IS WHY ──────────────────────────────
 * `gathering_tasks`'s SELECT policy carries `assignee_id = auth_person_id()` as its
 * `self_expr`, which admits a member's own task even in a family that has restricted
 * `gatherings` view to nobody — the same argument `people` uses for a member's own profile
 * row. So this reads on the user client and adds `.eq('assignee_id', personId)`: the policy
 * is what makes the screen possible and the conjunct is what makes it this member's screen.
 *
 * `requireMember`, not `requireRead('gatherings/my-tasks')`. The key exists so the rail item
 * can be hidden and the page can gate itself; the ROWS are the caller's own work, which is
 * self-service by definition — the same class as an RSVP or a chat message. Gating the fetch
 * on a view grant would let a family switch off a member's own to-do list, which is not what
 * that switch is for.
 *
 * The assignee is the caller, so their name comes from `getMyNameInFamily` rather than from a
 * roster lookup — one query fewer, and the one name on this screen that can never be somebody
 * else's. The GATHERING each task belongs to is resolved by `gatheringHeadings` on the admin
 * client, because the one policy that makes this page work in a restricted family is also the
 * reason an embed on `gatherings` comes back null here — see `MY_TASK_SELECT`.
 *
 * ── THE BUDGET LINE IS SHOWN HERE, AND IT IS NOT GATED ON `gatherings/budget:view` ───
 * Reviewed on 2026-08-19 and kept, so the reasoning is written down rather than left to be
 * re-litigated. `gatherings/budget` gates the money BAND on `/gatherings/[id]` and
 * `/admin/gatherings/[id]` — the spec's own table says so in as many words — and what that band
 * publishes is how the family divided its money: the total, the fund, its balance, and every
 * relative's line beside every relative's name. This screen publishes one number to one person:
 * the budget on a task THEY were handed, on a list that is `.eq('assignee_id', personId)` and
 * can hold nobody else's row. "You have $200 for the flowers" is what makes the task doable, and
 * withholding it leaves an assignee unable to do the thing they were asked to do while every
 * other screen goes on telling the organizer it was funded. `MyTasksClient.tsx` carries the same
 * paragraph beside the line that renders it.
 *
 * What DID change is which client reads it. The column is read by `taskBudgetLines` on the
 * service role, family-scoped and restricted to the ids this query already returned, because no
 * user-client read in this feature may name a money column — the note above `TASK_COLUMNS` is
 * the whole argument, and the failure it prevents is this screen going blank rather than merely
 * losing a figure.
 */
export async function getMyGatheringTasks(): Promise<MyTaskRow[]> {
  const g = await requireMember()
  if (!g.ok) return []
  if (!g.personId) return []

  const supabase = await createClient()
  const { data, error } = await supabase
    .from('gathering_tasks')
    .select(MY_TASK_SELECT)
    .eq('assignee_id', g.personId)
    // Soonest first, with the undated ones last: this is a to-do list, so the most urgent
    // thing belongs at the top and a task with no deadline is not urgent. `nullsFirst: false`
    // is load-bearing — PostgREST's default puts NULLs first on an ascending order, which
    // would stack every undated task above the one due tomorrow.
    .order('due_on', { ascending: true, nullsFirst: false })
    .order('created_at', { ascending: true })

  if (error) {
    console.error(`[gatherings] my-tasks read failed for ${g.familyCode}: ${error.message}`)
    return []
  }

  const rows = (data ?? []) as unknown as MyTaskDbRow[]
  const [templates, headings, latest, myName, budgetLines] = await Promise.all([
    templateNames(rows.map(r => r.template_id), g.familyCode),
    gatheringHeadings(rows.map(r => r.gathering_id), g.familyCode),
    latestSubmissions(supabase, rows.map(r => r.id)),
    getMyNameInFamily(g.userId, g.familyCode),
    // UNCONDITIONALLY, AND NOT GATED ON `gatherings/budget:view` — see the header.
    taskBudgetLines(rows.map(r => r.id), g.familyCode),
  ])
  const names = new Map<string, string>(g.personId ? [[g.personId, myName]] : [])

  return rows.map(row => {
    const heading = headings.get(row.gathering_id)
    return {
      ...toTaskRow(row, names, templates, latest, budgetLines),
      gatheringId:       row.gathering_id,
      // '' only when the heading read itself failed, which is logged where it happens. The
      // screen decides what an absent title looks like; it is never silently normal.
      gatheringTitle:    heading?.title ?? '',
      gatheringStartsOn: heading?.startsOn ?? '',
    }
  })
}

/**
 * How many tasks are WAITING ON THE CALLER — for a rail badge.
 *
 * `'open'` and `'denied'` only, deliberately. A badge means "there is something for you to
 * do": a `'submitted'` task is waiting on an organizer and an `'approved'` one is finished,
 * so counting either gives a number that never goes down and a badge that stops meaning
 * anything. `'denied'` counts because a denial is an instruction with notes attached and is
 * precisely the thing a member needs to be told about again.
 *
 * `head: true` so no row bodies cross the wire — this runs on every render of the shell.
 *
 * ── NO SCREEN CALLS THIS YET, AND IT IS KEPT DELIBERATELY ───────────────────────────
 * Checked on 2026-08-19: the rail badge it was written for is not built, `components/layout/
 * Sidebar.tsx` renders no count beside a nav item anywhere, and `MyTasksClient.tsx` counts the
 * same two statuses itself from the list it already has (which is right — it has the rows, and a
 * second round trip for a number it can add up is waste). So its only caller today is
 * `tests/rls/cases.mjs`, twice: once for the cross-family half and once in `PENDING_CASES`,
 * where it is one of the ten that fail on the mutation `AGENTS.md` §7 demands.
 *
 * That makes deleting it a change to a file this feature's actions do not own —
 * `run.mjs`'s `loadAction` throws `has no exported function` rather than skipping, so the suite
 * would go red at load with nothing to do with isolation. It stays, and this paragraph is the
 * record that its absence from the shell is known rather than overlooked. An unused export IS a
 * public HTTP endpoint (AGENTS.md §2), which is why it gates itself like everything else here:
 * `requireMember` plus `.eq('assignee_id', personId)`, so the worst it can tell an attacker is
 * how many of their OWN tasks are waiting on them.
 */
export async function getMyGatheringTaskCount(): Promise<number> {
  const g = await requireMember()
  if (!g.ok) return 0
  if (!g.personId) return 0

  const supabase = await createClient()
  const { count, error } = await supabase
    .from('gathering_tasks')
    .select('id', { count: 'exact', head: true })
    .eq('assignee_id', g.personId)
    .in('status', ['open', 'denied'])

  if (error) {
    console.error(`[gatherings] my-task count failed for ${g.familyCode}: ${error.message}`)
    return 0
  }
  return count ?? 0
}

/**
 * The soonest premier gathering that has not finished, for the Dashboard band.
 *
 * ── WHY "SOONEST WINS" AND NOT "THE ONE THAT IS PREMIER" ─────────────────────────────
 * `is_premier` has NO uniqueness in the schema and that is a decision rather than an
 * omission: a partial unique index would make last year's premier reunion block this year's,
 * and un-flagging the old one is a chore a family should not have to remember in order to
 * announce the new one. So several gatherings may carry the flag and this read picks the one
 * that matters now — the earliest whose span has not ended. The organizer screen and the
 * manual both say so, because a flag that does not obviously decide anything reads as broken.
 *
 * `status <> 'cancelled'` rather than `status = 'scheduled'`: a gathering still in
 * `'planning'` is exactly what a family most wants on the dashboard, and `'complete'` is
 * already excluded by the span test in every case that matters while a completed gathering
 * happening today is still worth showing.
 *
 * Null means there is nothing to show, which is most families most of the time. The band
 * renders nothing at all for it — no placeholder, no badge.
 */
export async function getPremierGathering(): Promise<PremierGathering | null> {
  const g = await requireRead('gatherings')
  if (!g.ok) return null

  // THE SERVER'S OWN CLOCK, never a value from a caller — this string is interpolated into
  // the filter below. `todayLocal()` rather than an ISO timestamp sliced at ten characters:
  // `starts_on` and `ends_on` are bare DATEs with no time and no zone, and an ISO slice is UTC,
  // which is a day out for half the country every evening. This is also why the pure Gatherings
  // modules take `today` as a PARAMETER (AGENTS.md §7b) — an action is the layer allowed to
  // decide what today is. Two places in this module do: here, and `getUpcomingGatheringCount`
  // below, which reuses this read's `.or(...)` span test verbatim and says why.
  const today = todayLocal()

  const supabase = await createClient()
  const { data, error } = await supabase
    .from('gatherings')
    .select(GATHERING_LIST_SELECT)
    .eq('is_premier', true)
    .neq('status', 'cancelled')
    // "The span has not finished": either it has an end date that is today or later, or it
    // has none and its single day is today or later. Written as one `.or()` because a
    // multi-day gathering on its second day is still happening — that is the whole reason
    // `ends_on` exists, and testing `starts_on` alone would drop it off the dashboard on the
    // morning of day two.
    .or(`ends_on.gte.${today},and(ends_on.is.null,starts_on.gte.${today})`)
    .order('starts_on', { ascending: true })
    .order('created_at', { ascending: true })
    .limit(1)
    .maybeSingle()

  if (error) {
    console.error(`[gatherings] premier read failed for ${g.familyCode}: ${error.message}`)
    return null
  }
  if (!data) return null

  const row = data as unknown as GatheringListRow

  // ── THE PHOTOGRAPH, RESOLVED HERE AND NOWHERE ELSE ─────────────────────────────
  // `getPublicUrl` is a pure string build in supabase-js — no network, no await, and it
  // cannot fail — so there is no error branch to get wrong and no reason to gate it behind
  // anything. The `photos` bucket is `public: true` (asserted by `20260820000010`, because a
  // bucket that stopped being public would turn every one of these into a silent 404).
  //
  // NOT GATED ON A SEPARATE GRANT, deliberately. The photograph is on the same row as the
  // title and under the same `gatherings:view` policy, so a caller who reached this row is
  // already entitled to it — a second check here would be a control nothing else consults.
  // That is the opposite of the money band, which has its own key because a family may
  // sensibly withhold figures from people it shows the reunion to.
  const photoUrl = row.photo_path
    ? supabase.storage.from('photos').getPublicUrl(row.photo_path).data.publicUrl
    : null

  return {
    id:         row.id,
    title:      row.title,
    summary:    row.summary,
    location:   row.location,
    startsOn:   row.starts_on,
    endsOn:     row.ends_on,
    taskCounts: taskProgress(asTaskStatuses(row.gathering_tasks ?? [])),
    photoUrl,
  }
}

/**
 * How many gatherings have not finished — the figure behind the Dashboard's Upcoming
 * Gatherings tile.
 *
 * ── THE GATE IS `calendar`, NOT `gatherings`, AND THAT IS THE POINT OF THIS FUNCTION ─
 * `components/dashboard/tiles.ts` puts the rule plainly: a tile borrows the grant of ITS
 * DESTINATION, and this one's caption is the kit's own "View calendar" — it leads to
 * `/gatherings/calendar`. So the tile appears for a holder of `calendar:view`, and the count behind it has
 * to be gated on the SAME key. Gated on `gatherings` instead, the guard would refuse and answer
 * 0 for a caller who can open the calendar but whose family has narrowed `gatherings:view` —
 * and 0 is the value at which the page omits the tile. "I could not count" would be rendered as
 * "there is nothing to show", which is the §8 failure in the shape that hides a whole feature
 * from a member who is entitled to it.
 *
 * The ROWS are still the `gatherings` policy's decision, because this reads on the USER client.
 * That is the right division and it is the one `tiles.ts` already argues for: a family that
 * restricted `gatherings:view` counts zero through RLS, and a caller holding it at scope `'own'`
 * counts their own — exactly what `/gatherings/calendar` will show them when they follow the tile, since
 * `getCalendarMonth` reads gatherings on the user client for the same reason. A count on the
 * admin client would promise a month that then rendered emptier than the tile.
 *
 * ── WHY THIS EXISTS AT ALL ──────────────────────────────────────────────────────────
 * The Dashboard used to call `getGatherings()` and take `.length` of a filter over it — every
 * gathering's title, summary, location and task statuses fetched, and the whole list marshalled,
 * to render one integer. That comment said a dedicated count was owed; this is it.
 *
 * ── THE SPAN TEST IS `getPremierGathering`'s, VERBATIM, AND THEY MUST STAY THAT WAY ──
 * "Not finished" is `ends_on >= today`, or `starts_on >= today` where there is no end date. That
 * is exactly `gatheringTiming(...) !== 'past'` from `lib/gatherings.ts` given
 * `gatherings_dates_ordered` (which refuses `ends_on < starts_on`, so the later of the two IS
 * `ends_on` whenever there is one) — which matters because the page filtered the old list with
 * that function and the tile's number must not change as a side effect of counting it in SQL. A
 * multi-day reunion on its second day still counts; that is the whole reason `ends_on` exists.
 *
 * `todayLocal()`, never an ISO slice: `starts_on` and `ends_on` are bare DATEs with no time and
 * no zone, and `toISOString()` is UTC, which is a day out for half the country every evening.
 * This is the second of the two places in this module that reads the clock, and both are here
 * rather than in `lib/gatherings.ts` because a pure module takes `today` as a parameter (§7b).
 *
 * `head: true`, so no row bodies cross the wire for a number. 0 on a refused query, which omits
 * the tile — the conservative direction for a decorative figure, and the caller keeps `null` for
 * "not entitled" by not calling this at all.
 */
export async function getUpcomingGatheringCount(): Promise<number> {
  const g = await requireRead('gatherings/calendar')
  if (!g.ok) return 0

  const today = todayLocal()

  const supabase = await createClient()
  const { count, error } = await supabase
    .from('gatherings')
    .select('id', { count: 'exact', head: true })
    // A cancelled gathering is not happening. `/gatherings` still lists it with its status
    // pill — that screen owns the question — and the calendar leaves it off the grid, so this
    // agrees with the destination rather than with the table.
    .neq('status', 'cancelled')
    .or(`ends_on.gte.${today},and(ends_on.is.null,starts_on.gte.${today})`)

  if (error) {
    console.error(`[gatherings] upcoming count failed for ${g.familyCode}: ${error.message}`)
    return 0
  }
  return count ?? 0
}

/**
 * The templates this caller may schedule a gathering FROM.
 *
 * GATED THE SAME WAY `scheduleGathering` IS, which is the point of it existing: the dialog
 * must offer exactly what the action will accept, or a member picks a template and is told no
 * (AGENTS.md, gate the fetch not the button). So it resolves `gatherings:create` through the
 * guard and `admin/gatherings:create` beside it, and widens the `who_may_schedule` filter for
 * the second — an organizer may schedule from an `'admin'` template, an ordinary member may
 * not.
 *
 * ADMIN CLIENT, because `gathering_templates` keys on `admin/gathering-templates:view` — a
 * grant a member holding `gatherings:create` will not have. The alternative is a Schedule
 * dialog with nothing in it for everybody except administrators. What is published is a name
 * and a description of a template the family has explicitly marked as schedulable by any
 * member; the family conjunct is applied by hand, as it must be on this client.
 *
 * Archived templates are excluded: archiving is what a family does instead of deleting a
 * template a gathering was built from (`gathering_template_uses.template_id` is NO ACTION on
 * delete), and its meaning is "do not start anything new from this".
 */
export async function getSchedulableTemplates(): Promise<{ id: string; name: string; description: string | null }[]> {
  const g = await requireScope('gatherings', 'create')
  if (!g.ok) return []

  const asOrganizer = await canAny(g.userId, 'admin/gatherings', 'create')

  const { data, error } = await createAdminClient()
    .from('gathering_templates')
    .select('id, name, description')
    .eq('family_code', g.familyCode)
    .eq('is_archived', false)
    .in('who_may_schedule', asOrganizer ? ['family', 'admin'] : ['family'])
    .order('name', { ascending: true })

  if (error) {
    console.error(`[gatherings] schedulable templates read failed for ${g.familyCode}: ${error.message}`)
    return []
  }
  return (data ?? []) as { id: string; name: string; description: string | null }[]
}

// ── Writes ───────────────────────────────────────────────────────────────────────────

/**
 * Submit an answer to a task. SELF-SERVICE, and every word of that matters.
 *
 * ── THE GATE IS `requireMember`, AND IT IS NOT THE WHOLE CHECK ──────────────────────
 * Answering a task you were given is something a member may do by definition, so there is no
 * grant to demand — `create` and `edit` default to scope `'none'`, and requiring one here
 * would lock every family out of their own gatherings. `requireMember()` demands an APPROVED
 * membership, which is the half of the check that IS about permission: a `people` row can
 * exist without its owner having been admitted.
 *
 * "No permission needed" never means "no check needed", so the other three halves are:
 *
 *  1. **The task is in the caller's family** — a family-scoped read, on the admin client
 *     where no policy is underneath (§3). `.eq('id', taskId)` alone would let one family's
 *     member answer another family's task.
 *  2. **The task is THEIRS.** `assignee_id === g.personId`, compared against the value read
 *     back from the row, never against anything the caller sent. Without it any approved
 *     member could answer any task in the family — and, since the answer is what an organizer
 *     approves, could put words in a relative's mouth.
 *  3. **The answer is an answer.** `parseAnswer(kind, …)` against the kind stored ON THE TASK
 *     (copied from the step at instantiation, so editing the template afterwards cannot
 *     change what this member was asked). Null is refused with a sentence naming what the
 *     step wanted, rather than being written as JSONB the screens cannot render.
 *
 * ── APPROVED IS TERMINAL ────────────────────────────────────────────────────────────
 * A task an organizer has approved is refused, and the message says why. The alternative is
 * that a member can quietly replace an answer somebody already signed off — the venue, the
 * amount, the date — with the task still reading "Approved" on every screen. Reopening it is
 * an organizer's decision (`reviewGatheringTask` and `assignGatheringTask` are theirs), which
 * is the right place for it because they are the ones who approved it.
 *
 * A `'denied'` task is deliberately NOT refused: resubmitting after a denial is the entire
 * feedback loop, and the resubmission is a NEW row rather than an edit of the refused one, so
 * the organizer's notes and the answer they were about both stand.
 *
 * ── A CANCELLED GATHERING TAKES NO MORE ANSWERS ─────────────────────────────────────
 * `'cancelled'` means the gathering is not happening, and every other read in the feature
 * already treats it that way: `getCalendarMonth` leaves it off the grid, `getPremierGathering`
 * skips it, and `readBudget` counts its budget as claiming nothing. Accepting work on it was
 * the one place that did not, and the cost is not cosmetic — a submission notifies every holder
 * of `admin/gatherings:edit` and puts a row in the review queue, so a called-off gathering
 * would go on generating work for the organizers who called it off. The refusal NAMES the
 * cancellation, because a member's task list does not show the gathering's status and a "no"
 * with no reason is the thing this feature is careful about everywhere else.
 *
 * `assignGatheringTask` is deliberately NOT gated the same way. An organizer has the status
 * pill in front of them on `/admin/gatherings/[id]` and is the person who can move the status
 * back, so refusing them an assignment would block the ordinary sequence for reopening a
 * gathering; the member being refused here has no such control.
 */
export async function submitGatheringTask(input: {
  taskId: string
  answer: unknown
  note?: string
}): Promise<ActionResult> {
  const g = await requireMember()
  if (!g.ok) return { success: false, message: g.message }
  // `getMyPersonId` answers '' for a caller it cannot resolve, and '' is not a uuid — the
  // unchecked version reaches the database as `invalid input syntax for type uuid: ""` and
  // surfaces that to a member as the whole of the error message.
  if (!g.personId) return { success: false, message: 'Profile not found' }
  if (!input?.taskId) return { success: false, message: 'Task not found' }

  const admin = createAdminClient()
  const { data, error } = await admin
    .from('gathering_tasks')
    // `status` on the gathering as well as on the task — see the header on why a cancelled
    // gathering takes no more answers. Bare `gatherings(...)`: one foreign key, and this is
    // the admin client, so no policy narrows the embed either.
    .select('id, gathering_id, label, kind, status, assignee_id, gatherings(title, status)')
    .eq('id', input.taskId)
    .eq('family_code', g.familyCode)
    .maybeSingle()

  if (error) {
    console.error(`[gatherings] submit could not read task ${input.taskId} in ${g.familyCode}: ${error.message}`)
    return { success: false, message: 'Could not read that task' }
  }
  if (!data) return { success: false, message: 'Task not found' }

  const task = data as unknown as {
    id: string
    gathering_id: string
    label: string
    kind: string
    status: string
    assignee_id: string | null
    gatherings: { title: string; status: string } | null
  }

  if (task.assignee_id !== g.personId) {
    return { success: false, message: 'This task is assigned to somebody else' }
  }
  if (task.gatherings?.status === 'cancelled') {
    return {
      success: false,
      message: 'This gathering has been cancelled, so its tasks are no longer being collected. Ask an organizer if that is not right.',
    }
  }
  if (task.status === 'approved') {
    return {
      success: false,
      message: 'This task has already been approved, and an approved answer is final. Ask an organizer to reopen it if it needs to change.',
    }
  }
  if (!isGatheringTaskKind(task.kind)) {
    // The table CHECKs `kind`, so this is a row from a build that knew a kind this one does
    // not. Refusing is the only safe answer: `parseAnswer` cannot normalise it, and writing
    // the raw value would store an answer no screen in this build can render.
    console.error(`[gatherings] task ${task.id} in ${g.familyCode} has unknown kind "${task.kind}"`)
    return { success: false, message: 'This task cannot be answered in this version' }
  }

  const answer = parseAnswer(task.kind, input.answer)
  if (!answer) {
    return {
      success: false,
      message: `That is not a usable answer for “${task.label}”. ${GATHERING_STEP_KIND_HINT[task.kind]}`,
    }
  }
  const note = typeof input.note === 'string' ? input.note.trim() || null : null

  // THE SUBMISSION ROW GOES FIRST, and the order is deliberate. It is the audit trail and the
  // only record of what this member actually sent; if the second write fails, a pending
  // submission sitting under an `'open'` task is recoverable and visible, whereas a task
  // marked `'submitted'` with no submission behind it is a review queue entry with nothing to
  // review and notes with nowhere to land.
  const submissionRes = await admin.from('gathering_task_submissions').insert({
    family_code:  g.familyCode,
    task_id:      task.id,
    answer,
    note,
    submitted_by: g.personId,
    decision:     'pending',
  })
  if (submissionRes.error) {
    console.error(`[gatherings] submission insert failed for task ${task.id} in ${g.familyCode}: ${submissionRes.error.message}`)
    return { success: false, message: 'Could not record your answer' }
  }

  const taskRes = await admin
    .from('gathering_tasks')
    .update({
      status: 'submitted',
      answer,
      // CLEARED, not left standing. These two record who ruled on this task and when, and
      // after a resubmission nobody has ruled on the answer now on the row — leaving them
      // would name an organizer as having decided something they have not seen, on every
      // screen that prints "decided by".
      decided_at: null,
      decided_by: null,
    })
    .eq('id', task.id)
    .eq('family_code', g.familyCode)

  if (taskRes.error) {
    console.error(`[gatherings] task status update failed for ${task.id} in ${g.familyCode}: ${taskRes.error.message}`)
    return { success: false, message: 'Your answer was saved but the task could not be moved to review. Try again.' }
  }

  // A BELL FAILURE MUST NEVER UNDO THE DECISION IT ANNOUNCES, so this is wrapped and the
  // answer stands either way. The writer inside reads its own `error` and reports it —
  // supabase-js RETURNS errors rather than throwing, so this `catch` sees nothing PostgREST
  // produces and would otherwise make a refused insert indistinguishable from a delivered one.
  try {
    await notifyGatheringTaskSubmitted({
      familyCode:     g.familyCode,
      gatheringTitle: task.gatherings?.title ?? '',
      taskLabel:      task.label,
      submitterName:  await getMyNameInFamily(g.userId, g.familyCode),
      // The organizer console, because the people this reaches are resolved from
      // `admin/gatherings:edit` and that is the screen where they can act on it.
      link:           `/admin/gatherings/${task.gathering_id}`,
    })
  } catch (e) {
    console.error(`[gatherings] task_submitted notification threw in ${g.familyCode}: ${String(e)}`)
  }

  revalidatePath('/gatherings/my-tasks')
  revalidatePath('/gatherings')
  revalidatePath(`/gatherings/${task.gathering_id}`)
  revalidatePath('/admin/gatherings')
  revalidatePath(`/admin/gatherings/${task.gathering_id}`)
  // The premier band prints this gathering's task progress, so a submission moves a figure on
  // the Dashboard. Every mutation in the organizer module revalidates it through
  // `revalidateGathering`, and `scheduleGathering` below does too; leaving it off here made a
  // submission the one write that left that line stale until something else invalidated it.
  revalidatePath('/dashboard')
  return { success: true }
}

/**
 * Schedule a gathering from one or more templates — the FAMILY-facing create path.
 *
 * ── THE GATE HAS TWO HALVES AND BOTH ARE RESOLVED BEFORE A TEMPLATE IS READ ─────────
 * `requireScope('gatherings', 'create')` says the caller may schedule at all. Then every
 * template id must both belong to the family AND be marked `who_may_schedule = 'family'` —
 * unless the caller ALSO holds `admin/gatherings:create`, in which case an `'admin'` template
 * is allowed too, because that is the same authority `createGathering` runs on. Resolving
 * both grants first is what makes the template read a single query with the right filter in
 * it, rather than a read followed by a decision about what was read.
 *
 * `who_may_schedule` says nothing about who may EDIT a template. That is always
 * `admin/gathering-templates`, and this action never writes to one.
 *
 * ── `templateIds` MAY NOW BE EMPTY, AND THAT REVERSES WHAT THIS SAID ────────────────
 * This section read "`templateIds` MUST BE NON-EMPTY" until 2026-08-19, on the argument that a
 * gathering IS a template instantiated and that an empty list would create "a row with nothing
 * to do and no way to tell it apart from one whose tasks failed to instantiate". The second
 * half of that was the real objection and it is answered below; the first half stopped being
 * true when Standard was inserted.
 *
 * WHAT CHANGED: the tier boundary now runs between the DATE and the PLANNING.
 * `/pricing` sells "the gathering on a shared calendar" on Free — a date, a place and the
 * details — and sells the checklists, the assigned duties and the budget on Standard. A
 * template is Standard (`admin/gathering-templates`), so a Free family has none and can be
 * offered none; requiring one would leave Free selling a calendar that nothing can be put on,
 * which is a bullet that is false rather than a feature that is limited.
 *
 * SO A TEMPLATE-LESS GATHERING IS A FIRST-CLASS THING: a title, a span, a place and a summary,
 * on the calendar and on the list, with no tasks. The distinction the old note worried about —
 * telling it apart from one whose instantiation failed — is drawn where it always was and not
 * by the task count: `attachTemplatesToGathering` reports its failures and this action returns
 * them in `message` while still reporting success, because the gathering is on screen either
 * way. Nothing infers "planned" from "has tasks".
 *
 * NO TIER IS CHECKED HERE, deliberately, and that is the house rule rather than an oversight
 * (AGENTS.md: the server actions behind a paid page are not tier-checked, or the first family
 * to downgrade would find one refusing to talk about its own history). A caller who knows a
 * template id can still pass one on a Free family; what withholds the paid capability is that
 * the SCREEN offers no templates, and what stops the wrong person doing it is the permission
 * model, which is unchanged. `/admin/gatherings` gates both template reads on the plan.
 *
 * ── THE SET FORM OF §4 ──────────────────────────────────────────────────────────────
 * The ids are verified by ONE family-scoped `.in('id', …)` read that must return every id it
 * was asked for. That is `belongsToFamily` for a set, and it is deliberately the same query
 * that reads `who_may_schedule` and `is_archived`, so the check and the decision cannot
 * disagree about which row they were talking about. `instantiateTemplateTasks` re-verifies
 * each one again on its own, because it is imported by three call sites and must not trust any
 * of them.
 */
export async function scheduleGathering(input: {
  title: string
  summary?: string
  location?: string
  /**
   * WHEN it happens — one continuous block, or several occasions carrying one title.
   *
   * `startsOn`/`endsOn` below are the shape every caller sent until 2026-08-26 and are still
   * read, as a one-occasion continuous `when`, where this is absent. `whenFromInput` states why
   * that matters: this is a `'use server'` export, so a browser tab open across the deploy posts
   * the old shape, and refusing it would fail a member's schedule with a message about a field
   * their form does not have. `when` wins where both arrive.
   */
  when?: GatheringWhen
  startsOn?: string
  endsOn?: string
  templateIds: string[]
}): Promise<ActionResult & { gatheringId?: string }> {
  const g = await requireScope('gatherings', 'create')
  if (!g.ok) return { success: false, message: g.message }
  if (!g.personId) return { success: false, message: 'Profile not found' }

  const asOrganizer = await canAny(g.userId, 'admin/gatherings', 'create')

  // ── WHEN, RESOLVED BEFORE ANYTHING IS WRITTEN ──────────────────────────────────
  // `resolveWhen` runs the same `whenProblems` the form ran — the form in front of an action is
  // a convenience (§2) — and hands back the ENVELOPE, which the parent insert needs because
  // `gatherings.starts_on` is NOT NULL and the row exists before its occurrences do.
  const when = resolveWhen(whenFromInput(input))
  if (!when.ok) return { success: false, message: when.message }

  const fields = normalizeGatheringFields({
    ...input,
    startsOn: when.startsOn,
    endsOn: when.endsOn ?? undefined,
  })
  if ('message' in fields) return { success: false, message: fields.message }

  // Deduplicated before anything is checked or written: `UNIQUE (gathering_id, template_id)`
  // would refuse the second copy with a 23505 halfway through instantiation, leaving a
  // gathering built from some of the templates it was asked for.
  const templateIds = [...new Set((input.templateIds ?? []).filter(Boolean))]

  const admin = createAdminClient()

  // NO TEMPLATES IS A VALID GATHERING — see the essay above. The read below is skipped rather
  // than run with an empty `.in()`: PostgREST answers `[]` for that, `rows.length !==
  // templateIds.length` is `0 !== 0`, and it would happen to work — which is exactly the kind
  // of accident that stops working when somebody adds a filter. Skipping says what is meant.
  const { data: templates, error: templateError } = templateIds.length === 0
    ? { data: [] as unknown[], error: null }
    : await admin
      .from('gathering_templates')
      // NO `default_location` — that column is dropped (`20260819000007`). A segment linked by
      // this path states no place at all, and a template that wants one carries a step of kind
      // `'location'` for a relative to answer.
      .select('id, name, who_may_schedule, is_archived')
      .in('id', templateIds)
      .eq('family_code', g.familyCode)

  if (templateError) {
    console.error(`[gatherings] schedule could not read templates in ${g.familyCode}: ${templateError.message}`)
    return { success: false, message: 'Could not read the templates' }
  }

  const rows = (templates ?? []) as {
    id: string; name: string; who_may_schedule: string; is_archived: boolean
  }[]
  // Every id asked for came back inside the family. One missing means it is another family's
  // or does not exist, and both answer the same sentence — telling a caller which is an
  // enumeration signal about another family's data.
  if (rows.length !== templateIds.length) {
    return { success: false, message: 'Template not found' }
  }

  const allowed = asOrganizer ? new Set(['family', 'admin']) : new Set(['family'])
  for (const row of rows) {
    if (row.is_archived) {
      return { success: false, message: `“${row.name}” has been archived and cannot start a new gathering` }
    }
    if (!allowed.has(row.who_may_schedule)) {
      return { success: false, message: `Only an organizer can schedule from “${row.name}”` }
    }
  }

  // BACK INTO THE ORDER THE CALLER NAMED THEM, which is not the order `rows` is in: it came
  // out of a `.in('id', …)` read and PostgREST makes no promise about the order of a set
  // filter. Laying the work out in that order is laying it out in whatever order the database
  // happened to answer in — permanently, on the screen a family reads down, with the three
  // templates' steps interleaved because `instantiateTemplateTasks` offsets each one past the
  // last. `resolveTemplates` in the organizer module re-orders for the same reason.
  const byId = new Map(rows.map(row => [
    row.id,
    { id: row.id, name: row.name },
  ]))
  const ordered = templateIds.flatMap(id => {
    const template = byId.get(id)
    return template ? [template] : []
  })

  const { data: created, error } = await admin
    .from('gatherings')
    .insert({
      family_code: g.familyCode,
      title:       fields.title,
      summary:     fields.summary,
      location:    fields.location,
      starts_on:   fields.startsOn,
      ends_on:     fields.endsOn,
      created_by:  g.personId,
      // ── SCHEDULED WHEN THERE IS NOTHING TO PLAN, PLANNING WHEN THERE IS ───────────
      // This took the column's default of 'planning' unconditionally, on the argument that a
      // member scheduling a gathering is PROPOSING the work rather than announcing it. That is
      // right when there IS work — a set of templates whose tasks nobody has answered is
      // exactly a gathering being planned — and wrong when there is none: a bare date on the
      // family calendar with no tasks and nothing to hand out is not being planned by anybody,
      // and 'Planning' on it is a status that will never move.
      //
      // A Free family can only ever create the second kind (the template picker is Standard),
      // so this is also what makes "once a gathering is added it is scheduled" true for them —
      // WITHOUT a tier check in the action, which AGENTS.md forbids for a read and which is the
      // same instinct here. The rule is about the REQUEST, so a paid family scheduling a bare
      // date gets the same sensible answer.
      status:      templateIds.length > 0 ? 'planning' : 'scheduled',
      // ONE BLOCK OR SEVERAL OCCASIONS, on the parent because every reader that only needs to
      // know how to DRAW it should not have to count child rows — and a series with one
      // occasion entered so far is still a series.
      is_continuous: when.normalised!.isContinuous,
      // `is_premier` takes its default of false: flagging a gathering premier puts it across
      // the top of the Dashboard, which is an organizer decision with its own action and grant.
      //
      // `fund_id` and `budget_cents` are absent for a harder reason. Money on a gathering is
      // `gatherings/budget`, a RESTRICTED key, and `setGatheringBudget` is where it is set —
      // accepting either here would let a member holding only `gatherings:create` attach the
      // family's money to a gathering through a path with no money grant in it at all.
    })
    .select('id')
    .single()

  if (error || !created) {
    console.error(`[gatherings] schedule insert failed in ${g.familyCode}: ${error?.message}`)
    return { success: false, message: error?.message ?? 'Could not schedule the gathering' }
  }
  const gatheringId = (created as { id: string }).id

  // ── THE OCCURRENCES, WHICH ARE THE ONLY PLACE THE DATES REALLY LIVE ────────────
  // The parent already carries the envelope from the insert above; the trigger recomputes it
  // from these and its `WHERE` makes that a no-op. A failure here leaves the envelope and no
  // occurrences, which `tg_gathering_when_envelope`'s zero-row branch is written for: the dates
  // stay, so the gathering is on the calendar and can be fixed rather than being invisible.
  const written = await writeOccurrences(admin, g.familyCode, gatheringId, when.normalised!)
  if (!written.ok) return { success: false, message: written.message }

  // The junction rows and the tasks, template by template, in the order they were named —
  // `position` on the use row is what preserves that, and `instantiateTemplateTasks` offsets
  // each template's tasks past the last one so the gathering reads as one list of work. ONE
  // definition of that loop, shared with the organizer module's two create paths, which is also
  // what makes the sentence below true: a template whose steps do not land is unlinked again,
  // so adding it afterwards is not refused as a duplicate.
  const failures = await attachTemplatesToGathering(admin, gatheringId, g.familyCode, ordered, 0)

  revalidatePath('/gatherings')
  revalidatePath('/gatherings/calendar')
  revalidatePath('/admin/gatherings')
  revalidatePath('/dashboard')

  // THE GATHERING EXISTS, so this reports success and says what did not happen rather than
  // failing over a row that is now on screen. A caller told "could not schedule" who then
  // finds the gathering in the list has been told something false, and the recovery — add the
  // template again from the organizer console — is a real one.
  if (failures.length > 0) {
    return {
      success: true,
      gatheringId,
      message: `Scheduled, but the steps from ${failures.join(', ')} could not be added. An organizer can add them from the gathering.`,
    }
  }
  return { success: true, gatheringId }
}

/**
 * Title, summary, location and the two dates, validated once for both create paths.
 *
 * ── THE DATES MIRROR THE CHECK CONSTRAINTS DELIBERATELY ─────────────────────────────
 * `gatherings_dates_ordered` refuses `ends_on < starts_on` with a 23514, which reads to a
 * member as a bug in the product rather than as "that reunion ends before it starts". Same
 * reasoning as refusing a budget with no fund in `setGatheringBudget`: the constraint is the
 * boundary, this is the sentence.
 *
 * `parseAnswer('date', …)` is reused as the date validator rather than a second regex. It is
 * the one place in this feature that decides what a calendar date is, it round-trips the value
 * through `Date.UTC` so `2026-02-30` is refused as the impossible day it is, and it never asks
 * the local clock what a string means — which is how every date bug in this product has
 * happened.
 */
function normalizeGatheringFields(input: {
  title?: string
  summary?: string | null
  location?: string | null
  startsOn?: string
  endsOn?: string | null
}): { title: string; summary: string | null; location: string | null; startsOn: string; endsOn: string | null }
  | { message: string } {
  const title = (input.title ?? '').trim()
  if (!title) return { message: 'A gathering needs a title' }

  const start = parseAnswer('date', input.startsOn ?? '')
  if (!start || !('date' in start)) return { message: 'Choose the date the gathering starts' }

  let endsOn: string | null = null
  const rawEnd = (input.endsOn ?? '') || ''
  if (rawEnd) {
    const end = parseAnswer('date', rawEnd)
    if (!end || !('date' in end)) return { message: 'That end date is not a real date' }
    if (end.date < start.date) return { message: 'The gathering cannot end before it starts' }
    endsOn = end.date
  }

  return {
    title,
    summary:  (input.summary ?? '')?.trim() || null,
    location: (input.location ?? '')?.trim() || null,
    startsOn: start.date,
    endsOn,
  }
}
