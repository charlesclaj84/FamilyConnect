'use server'

import { revalidatePath } from 'next/cache'
import { createAdminClient } from '@/lib/supabase/admin'
import { requireDelete, requireEdit, requireScope } from '@/lib/auth/guard'
import { canAny } from '@/lib/auth/permissions'
import { tierAllows } from '@/lib/auth/tier'
import { belongsToFamily } from '@/lib/auth/family'
import { embedOne, type PersonNameRow } from '@/lib/supabase/embed'
import { attachTemplatesToGathering } from '@/lib/gathering-instantiate'
import {
  notifyGatheringTaskAssigned, notifyGatheringTaskReviewed, notifyGatheringTaskReopened,
} from '@/lib/notifications'
import {
  parseAnswer, taskProgress,
  GATHERING_STATUSES,
  type GatheringStatus, type GatheringTaskKind, type GatheringTaskStatus,
  type TaskProgress,
} from '@/lib/gatherings'

/**
 * GATHERINGS, the organizer console — scheduling, money, handing work out, and ruling on it.
 *
 * The member-facing half is `app/actions/gatherings.ts` and its header carries the
 * which-client-reads-what rule that both modules follow. What is different here, and it is
 * the whole difference:
 *
 * ── THIS MODULE READS ON THE ADMIN CLIENT, ON PURPOSE ────────────────────────────────
 * An organizer's job is to see the whole gathering: every task whoever it is assigned to,
 * every budget line, the whole submission trail with the names on it. The composed SELECT
 * policies cannot answer that for a caller whose `gatherings:view` is `'own'` — that scope's
 * `own_expr` on `gathering_tasks` is `assignee_id = auth_person_id()`, so the user client
 * would hand back the organizer's own tasks and nothing else, and the review queue would be
 * permanently empty with no error anywhere.
 *
 * So the reads here are service-role reads, and §3's obligation is discharged BY HAND on
 * every one of them: `.eq('family_code', g.familyCode)` on every read, write and delete,
 * with the family code coming from the caller's own membership through the guard and never
 * from an argument. The gate that replaces the policy is `admin/gatherings` at scope `'any'`
 * — see the note on `getAdminGatherings` for why `'any'` and not `can()`.
 *
 * ── EVERY WRITE IN THE FEATURE LIVES HERE OR IN THE SELF-SERVICE SUBMIT ─────────────
 * There is no INSERT, UPDATE or DELETE policy on any of the six tables (the shape
 * `fund_transfers` keeps), so the browser has no write path at all and these actions plus the
 * four guard triggers ARE the boundary. That makes AGENTS.md §4 the rule that matters most
 * here: a row stamped with the caller's own `family_code` satisfies everything while the
 * `fund_id`, `template_id`, `assignee_id` or `step_id` it carries points into another
 * family. Every one of those is checked against the family BEFORE it is written.
 *
 * ── WHY EVERY `people` EMBED NAMES ITS CONSTRAINT ───────────────────────────────────
 * `gathering_tasks` has TWO foreign keys to `people` (`assignee_id`, `decided_by`) and so
 * does `gathering_task_submissions` (`submitted_by`, `reviewed_by`). A bare `people(...)` on
 * either is **PGRST201**, which PostgREST answers by refusing the WHOLE query — and this
 * codebase renders that as "nothing here" over data that exists (AGENTS.md §8). So each is
 * `alias:people!<constraint>(first_name, last_name)`, hoisted into a named const with a
 * hand-declared row interface beside it: supabase-js's type-LEVEL select parser collapses the
 * entire result to `GenericStringError` the moment it meets that form inline, which is the
 * same reason `DISBURSEMENT_SELECT` in app/actions/funds.ts is written that way. The embeds
 * are then read through `embedOne`, which normalises the object-vs-one-element-array
 * cardinality PostgREST decides per query.
 */

/**
 * The result every mutation in Gatherings returns. See the note on the member-facing copy for
 * why it is declared in each module rather than shared, and why the key is `message`.
 */
export interface ActionResult {
  success: boolean
  message?: string
}

/**
 * The budget shape, re-exported so a screen can take it from whichever module it already
 * imports. Written as an inline `import(...)` type alias rather than `export type { … }`,
 * following `app/actions/admin/users.ts`'s `MyRoleSummary`: it is a type-only export, so
 * nothing about it reaches the runtime and the `'use server'` rule that every export must be
 * an async function is not engaged. There is no import cycle for the same reason.
 */
export type GatheringBudgetView = import('@/app/actions/gatherings').GatheringBudgetView

/**
 * And the state beside it, taken from the same place for the same reason.
 *
 * `'withheld'` versus `'unavailable'` is what a `null` budget cannot say on its own — the member
 * module's declaration carries the whole argument. It is re-exported rather than re-declared so
 * the two screens cannot come to hold different vocabularies for the same three states, which is
 * this module's standing rule about money: a family reading `/gatherings/[id]` and
 * `/admin/gatherings/[id]` must not be told two different things about the same fund.
 */
export type GatheringBudgetState = import('@/app/actions/gatherings').GatheringBudgetState

export interface AdminGatheringRow {
  id: string
  title: string
  summary: string | null
  location: string | null
  startsOn: string
  endsOn: string | null
  status: GatheringStatus
  isPremier: boolean
  createdBy: { id: string; name: string } | null
  taskCounts: TaskProgress
  /**
   * The gathering's SEGMENTS, in `position` order — the Welcome, the Picnic and the Send Off
   * inside one reunion (20260819000001).
   *
   * `occursOn` and `location` are both nullable and both mean "not stated": a one-day gathering
   * in one place has neither, and the screen renders exactly what it did before these existed.
   * They were added ADDITIVELY on purpose — four clients compile against this interface — so a
   * component that ignores them behaves as it always did.
   *
   * NOTHING CONSTRAINS `occursOn` TO THE GATHERING'S SPAN, and the screen is what says so. The
   * migration argues it at length: a gathering's dates move, and a constraint would then refuse
   * an ordinary edit to `starts_on` with a 23514 naming a table the organizer was not looking at.
   * `/admin/gatherings/[id]` MARKS a segment outside `startsOn..endsOn` in `--brand-withheld`,
   * never `--destructive` — nothing failed and nothing is an error; there is a date to reconcile.
   */
  templates: {
    id: string
    name: string
    occursOn: string | null
    location: string | null
  }[]
  /**
   * null unless the caller holds `gatherings/budget:view` — NOT FETCHED otherwise (§5) — and
   * ALSO null when the figures could not be read, which `budgetsFor` chooses deliberately over
   * reporting an unread total as zero. `budgetState` is which of the two it was; never render a
   * null budget as a sentence about the caller's permissions without reading it.
   */
  budget: GatheringBudgetView | null
  /**
   * Why `budget` is null, when it is. See `GatheringBudgetState`.
   *
   * `'unavailable'` is the one worth handling on this screen in particular: the fund-and-budget
   * panel is absent for it exactly as it is for a withheld key, while the task table's Budget
   * column is gated on the caller's grant rather than on the figures and so stays, printing "—"
   * on every row. "—" means "no line on this task", so an organizer entitled to the money reads
   * a refused query as a reunion nobody has budgeted a cent of.
   */
  budgetState: GatheringBudgetState
}

export interface GatheringSubmissionRow {
  id: string
  answer: unknown
  note: string | null
  decision: 'pending' | 'approved' | 'denied'
  reviewNotes: string | null
  submittedBy: { id: string; name: string } | null
  reviewedBy: { id: string; name: string } | null
  reviewedAt: string | null
  createdAt: string
}

export interface AdminGatheringTaskRow {
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
  templateId: string | null
  templateName: string | null
  decidedAt: string | null
  decidedBy: { id: string; name: string } | null
  /** The whole trail, newest first. A denial keeps its notes; a resubmission is a new row. */
  submissions: GatheringSubmissionRow[]
}

export interface AdminGatheringDetail extends AdminGatheringRow {
  tasks: AdminGatheringTaskRow[]
}

export interface ReviewQueueRow {
  taskId: string
  label: string
  kind: GatheringTaskKind
  required: boolean
  dueOn: string | null
  answer: unknown | null
  gatheringId: string
  gatheringTitle: string
  gatheringStartsOn: string
  assignee: { id: string; name: string } | null
  /** The member's own note on the submission being reviewed, and when it arrived. */
  note: string | null
  submittedAt: string | null
}

/**
 * A member as `PersonPicker` and `PersonMultiSelect` name them.
 *
 * The same shape as `SelectablePerson`, declared here rather than imported: those live in a
 * `'use client'` module, and `app/actions/dues.ts`'s `ProjectionPerson` sets the precedent for
 * restating the four fields on the server side. Structural typing means the picker takes this
 * unchanged, and `disambiguatedName` works on it as-is — which is the point of carrying
 * `nick_name` and `date_of_birth` at all.
 */
export interface AssignableMember {
  id: string
  first_name: string
  last_name: string
  nick_name: string | null
  date_of_birth: string | null
}

/**
 * The name the contract gives that shape, so both resolve from here.
 *
 * `getGatheringAssignableMembers` is specified as returning `SelectablePerson[]`, and the
 * canonical declaration of that type lives in `components/ui/person-multi-select.tsx` — a
 * `'use client'` module, which a server module must not import. A screen following the contract
 * literally would otherwise get a missing-export error for a type that is right here. Two names
 * for one shape is a cost worth paying once; a second DECLARATION would not be, which is why
 * this is an alias and not a copy. Type-only, so nothing about it reaches the runtime and the
 * `'use server'` rule that every export be an async function is not engaged.
 */
export type SelectablePerson = AssignableMember

type AdminClient = ReturnType<typeof createAdminClient>

// ── The selects, hoisted, with their row shapes beside them ──────────────────────────

const CREATOR_EMBED = 'creator:people!gatherings_created_by_fkey(first_name, last_name)'

const GATHERING_COLUMNS =
  'id, title, summary, location, starts_on, ends_on, status, is_premier, created_by'

/**
 * Two select strings, and the difference between them is §5.
 *
 * `budget_cents` and `fund_id` are only ever asked for when the caller holds
 * `gatherings/budget:view`. Selecting them always and dropping them on the way out would
 * still have fetched them — props are serialized into the RSC payload whether a component
 * renders them or not — so the withholding has to be a column that was never read.
 */
const GATHERING_SELECT = `${GATHERING_COLUMNS}, ${CREATOR_EMBED}`
const GATHERING_SELECT_WITH_MONEY = `${GATHERING_COLUMNS}, budget_cents, fund_id, ${CREATOR_EMBED}`

interface GatheringDbRow {
  id: string
  title: string
  summary: string | null
  location: string | null
  starts_on: string
  ends_on: string | null
  status: string
  is_premier: boolean
  created_by: string | null
  budget_cents?: number | null
  fund_id?: string | null
  creator: PersonNameRow | null
}

/**
 * The organizer's task table. TWO STRINGS, and the difference between them is §5.
 *
 * `budget_cents` is asked for only when the caller holds `gatherings/budget:view`. The task
 * table on `/admin/gatherings/[id]` lists every relative's line and together those lines ARE
 * how the family divided its money — the same thing the band above them reports — so a caller
 * without that grant must not have them fetched at all. Selecting the column always and
 * blanking it on the way out would still have fetched it: props are serialized into the RSC
 * payload whether a component renders them or not.
 */
const TASK_COLUMNS =
  'id, gathering_id, template_id, step_id, label, help_text, kind, required, position'
  + ', status, due_on, assignee_id, answer, decided_at, decided_by'
  + ', assignee:people!gathering_tasks_assignee_id_fkey(first_name, last_name)'
  + ', decider:people!gathering_tasks_decided_by_fkey(first_name, last_name)'

const TASK_COLUMNS_WITH_MONEY = `${TASK_COLUMNS}, budget_cents`

interface TaskDbRow {
  id: string
  gathering_id: string
  template_id: string | null
  step_id: string | null
  label: string
  help_text: string | null
  kind: string
  required: boolean
  position: number
  status: string
  due_on: string | null
  /** Absent when the caller does not hold `gatherings/budget:view` — see above. */
  budget_cents?: number | null
  assignee_id: string | null
  answer: unknown | null
  decided_at: string | null
  decided_by: string | null
  assignee: PersonNameRow | null
  decider: PersonNameRow | null
}

const SUBMISSION_SELECT =
  'id, task_id, answer, note, decision, review_notes, submitted_by, reviewed_by'
  + ', reviewed_at, created_at'
  + ', submitter:people!gathering_task_submissions_submitted_by_fkey(first_name, last_name)'
  + ', reviewer:people!gathering_task_submissions_reviewed_by_fkey(first_name, last_name)'

interface SubmissionDbRow {
  id: string
  task_id: string
  answer: unknown
  note: string | null
  decision: string
  review_notes: string | null
  submitted_by: string | null
  reviewed_by: string | null
  reviewed_at: string | null
  created_at: string
  submitter: PersonNameRow | null
  reviewer: PersonNameRow | null
}

/**
 * The review queue's task rows — every `'submitted'` task in the family, with the gathering it
 * belongs to.
 *
 * `gatherings(...)` is BARE and correct: `gathering_tasks` has exactly one foreign key to
 * `gatherings`, and §2.3 of the spec commits to `created_by` staying the table's only actor
 * column so it remains unambiguous. A second foreign key added later must constraint-name this
 * embed in the same commit — PGRST201 is an empty queue, not an error.
 */
const QUEUE_SELECT =
  'id, gathering_id, label, kind, required, due_on, answer, assignee_id'
  + ', assignee:people!gathering_tasks_assignee_id_fkey(first_name, last_name)'
  + ', gatherings(id, title, starts_on)'

interface QueueDbRow {
  id: string
  gathering_id: string
  label: string
  kind: string
  required: boolean
  due_on: string | null
  answer: unknown | null
  assignee_id: string | null
  assignee: PersonNameRow | null
  gatherings: { id: string; title: string; starts_on: string } | null
}

// ── Small shared shapes ──────────────────────────────────────────────────────────────

const fullName = (p: PersonNameRow | null): string =>
  p ? `${p.first_name ?? ''} ${p.last_name ?? ''}`.trim() : ''

const personRef = (id: string | null, embedded: unknown): { id: string; name: string } | null =>
  id ? { id, name: fullName(embedOne<PersonNameRow>(embedded)) } : null

/**
 * A status straight off the row, cast rather than narrowed — see the same helper in the
 * member-facing module. `taskProgress` counts a status it does not recognise into `total` and
 * none of the four buckets, so an unfamiliar value makes the gathering read as UNFINISHED
 * rather than as complete, and re-mapping it here would put a weaker copy of that rule in
 * front of it.
 */
const asTaskStatuses = (rows: readonly { status: string }[]): { status: GatheringTaskStatus }[] =>
  rows.map(r => ({ status: r.status as GatheringTaskStatus }))

/** `'planning'` and `'scheduled'` — see `budgetsFor` below for why those two and no more. */
const LIVE_STATUSES = ['planning', 'scheduled'] as const

/**
 * The budget figures for a set of gatherings, on the ADMIN client. Only ever called behind
 * `gatherings/budget:view`.
 *
 * ── THE BALANCE COMES FROM `fund_balance_cents(p_fund_id)`, THROUGH THE SERVICE ROLE ─
 * That function is the database's own four-term definition of a balance (contributions −
 * disbursements + transfers in − transfers out), it is `STABLE` with
 * `SET search_path = ''`, and it has NO `authenticated` EXECUTE grant anywhere in the
 * migration chain — so `createAdminClient().rpc(...)` is the only way to call it, exactly as
 * its one other call site in the app does (`transferBetweenFunds`). Recomputing the sum on the
 * user client, which `getFunds` does, omits the transfer term for any caller lacking
 * `transactions/fund-transfers:view`; the whole point of this figure is that two members
 * looking at the same reunion must not disagree about whether it is over its fund.
 *
 * One RPC per DISTINCT fund rather than one per gathering: several gatherings legitimately
 * draw on one Family Reunion fund (there is deliberately no unique index on `fund_id`), so the
 * balance is looked up once and shared.
 *
 * `otherCommittedCents` counts only LIVE gatherings — `'planning'` and `'scheduled'`. A
 * cancelled gathering claims nothing. A COMPLETE one has already spent whatever it spent, and
 * that spend is in the balance as disbursements, so counting its budget again would subtract
 * the same money twice and report a healthy fund as overdrawn. It is QUERIED from the family
 * rather than derived from the array this function was handed — see the query for why that
 * distinction was a bug and not a style.
 */
async function budgetsFor(
  admin: AdminClient,
  familyCode: string,
  // No `status` on these rows: what draws on the fund is decided by the claims QUERY below,
  // not by the statuses of whatever set the caller passed in.
  gatherings: readonly { id: string; fund_id?: string | null; budget_cents?: number | null }[],
): Promise<Map<string, GatheringBudgetView>> {
  const out = new Map<string, GatheringBudgetView>()
  if (gatherings.length === 0) return out

  const fundIds = [...new Set(gatherings.map(g => g.fund_id).filter((id): id is string => Boolean(id)))]

  const linesRes = await admin.from('gathering_tasks')
    .select('gathering_id, budget_cents')
    .eq('family_code', familyCode)
    .in('gathering_id', gatherings.map(g => g.id))

  // §8, AND THE ASYMMETRY IS THE WHOLE POINT: A FIGURE NOBODY READ IS NOT ZERO.
  // An empty `data` cannot be told apart from a query PostgREST refused, and here the
  // difference reaches the screen as money. With no lines, `gatheringBudgetMath` reports
  // `linesTotalCents: 0`, `unallocatedCents: budgetCents` and `overAllocated: false` —
  // "nothing allocated yet, the whole budget still free" — stated as fact about a family that
  // may have divided every cent of it. So no budget view is returned at all, and the band
  // renders no figures rather than wrong ones. `readBudget` in the member-facing module
  // answers null on the same failure for the same reason, so the two screens agree about when
  // they do not know.
  if (linesRes.error) {
    console.error(`[admin/gatherings] budget lines read failed for ${familyCode}: ${linesRes.error.message}`)
    return out
  }

  const linesByGathering = new Map<string, (number | null)[]>()
  for (const row of (linesRes.data ?? []) as { gathering_id: string; budget_cents: number | null }[]) {
    const list = linesByGathering.get(row.gathering_id) ?? []
    list.push(row.budget_cents)
    linesByGathering.set(row.gathering_id, list)
  }

  const fundNames = new Map<string, string>()
  const fundBalances = new Map<string, number | null>()
  /** Every LIVE claim on each of these funds, keyed by fund id. Read, never derived. */
  const claimsByFund = new Map<string, { id: string; budgetCents: number }[]>()

  if (fundIds.length > 0) {
    const [fundsRes, othersRes] = await Promise.all([
      admin.from('funds')
        .select('id, name').eq('family_code', familyCode).in('id', fundIds),
      // ── `otherCommittedCents` IS QUERIED, NOT FILTERED OUT OF THE ARRAY ABOVE ──────
      // It used to be `gatherings.filter(o => o.id !== g.id && o.fund_id === fundId && …)`,
      // which is correct when that array IS the whole family — `getAdminGatherings` — and
      // structurally ZERO when it is one row, which is exactly what
      // `getAdminGatheringDetail` passes. So the organizer's own gathering screen, the one
      // screen where the fund decision actually gets made, reported that nothing else was
      // drawing on the fund and could never draw the over-fund-with-others line, while
      // `/gatherings/[id]` beside it reported the truth from `readBudget`'s own query. Two
      // screens disagreeing about the same money is precisely what this module's header says
      // must not happen, so the figure is asked of the family rather than of whatever the
      // caller happened to hand in. `LIVE_STATUSES` stays the one definition of "live".
      admin.from('gatherings')
        .select('id, fund_id, budget_cents')
        .eq('family_code', familyCode)
        .in('fund_id', fundIds)
        .in('status', LIVE_STATUSES),
    ])

    if (fundsRes.error) {
      console.error(`[admin/gatherings] fund names read failed for ${familyCode}: ${fundsRes.error.message}`)
    }
    for (const fund of (fundsRes.data ?? []) as { id: string; name: string }[]) {
      fundNames.set(fund.id, fund.name)
    }

    let claimsUnknown = false
    if (othersRes.error) {
      console.error(`[admin/gatherings] other fund claims read failed for ${familyCode}: ${othersRes.error.message}`)
      claimsUnknown = true
    } else {
      for (const row of (othersRes.data ?? []) as { id: string; fund_id: string | null; budget_cents: number | null }[]) {
        if (!row.fund_id) continue
        const list = claimsByFund.get(row.fund_id) ?? []
        list.push({ id: row.id, budgetCents: row.budget_cents ?? 0 })
        claimsByFund.set(row.fund_id, list)
      }
    }

    // A BALANCE WE COULD NOT READ IS `null`, NEVER 0. `gatheringBudgetMath` reads null as
    // "unknown" and draws no marker for it, which is the only safe answer: rendering an
    // unreadable balance as zero paints the alarm line over a perfectly healthy fund, and
    // nothing on the screen could explain it. ONE RPC PER DISTINCT FUND, because several
    // gatherings legitimately draw on one Family Reunion fund.
    const balances = await Promise.all(fundIds.map(async id => {
      const { data, error } = await admin.rpc('fund_balance_cents', { p_fund_id: id })
      if (error) {
        console.error(`[admin/gatherings] fund_balance_cents failed for ${id} in ${familyCode}: ${error.message}`)
        return [id, null] as const
      }
      return [id, typeof data === 'number' ? data : null] as const
    }))
    for (const [id, balance] of balances) fundBalances.set(id, balance)

    // A CLAIM SET WE COULD NOT READ MAKES THE BALANCE UNKNOWN TOO, which is what forces both
    // over-fund flags off in `gatheringBudgetMath`. Keeping the balance and reporting zero
    // other claims would draw the comparison from half a picture — right about this
    // gathering's own budget and silently wrong about the fund's whole commitment, in the
    // direction that reports an over-committed fund as healthy. `readBudget` collapses its
    // three fund reads into one failure branch for exactly this reason.
    if (claimsUnknown) for (const id of fundIds) fundBalances.set(id, null)
  }

  for (const g of gatherings) {
    const fundId = g.fund_id ?? null
    // THIS gathering is excluded, the same way `readBudget` excludes it with `.neq('id', …)`:
    // its own budget is reported separately and `gatheringBudgetMath` is what adds the two.
    const otherCommittedCents = fundId
      ? (claimsByFund.get(fundId) ?? [])
        .filter(o => o.id !== g.id)
        .reduce((sum, o) => sum + o.budgetCents, 0)
      : 0

    out.set(g.id, {
      budgetCents:      g.budget_cents ?? null,
      fundId,
      fundName:         fundId ? fundNames.get(fundId) ?? null : null,
      fundBalanceCents: fundId ? fundBalances.get(fundId) ?? null : null,
      lineCents:        linesByGathering.get(g.id) ?? [],
      // NOT the whole family's committed budget — only what draws on THIS gathering's fund.
      otherCommittedCents,
    })
  }
  return out
}

// ── Reads ────────────────────────────────────────────────────────────────────────────

/**
 * Every gathering in the family, for the organizer console's list pane.
 *
 * ── `requireScope(…, 'view')` RATHER THAN `requireRead`, AND THAT IS DELIBERATE ──────
 * `requireRead` goes through `can()`, which is true for scope `'own'`. There is no coherent
 * "own" version of the organizer console: it reads every relative's tasks and the whole
 * family's review queue, and this read is on the SERVICE ROLE, so nothing narrows it
 * afterwards. Admitting `'own'` here would hand the whole console to a grant that was meant
 * to restrict it — the same argument `getRegions` makes for `admin/chapters`, and the same one
 * `canAny` exists for.
 *
 * (`/gatherings/[id]` is where a member with a narrower grant reads a gathering, and that one
 * is on the user client so the policy decides. This is the organizer's screen.)
 */
export async function getAdminGatherings(): Promise<AdminGatheringRow[]> {
  const g = await requireScope('admin/gatherings', 'view')
  if (!g.ok) return []

  // Resolved BEFORE the select string is chosen, which is what makes the withholding a
  // fetch that did not happen rather than a field that was dropped (§5).
  // AND THE PLAN, SINCE 2026-08-19. `gatherings/budget` is `tier: 'standard'` — a registry row
  // in `lib/features.ts` carries it, because the key has no route of its own and would
  // otherwise inherit `/gatherings`, which is Free. It is anded in HERE rather than only at
  // the page for §5's reason: the money columns are chosen from this answer, so a tier
  // resolved upstairs and passed down would be a figure fetched and then hidden.
  //
  // THIS NARROWS AND DOES NOT REFUSE, which is the line `getGatheringFundOptions` below is
  // written about at length: every gathering still comes back, with `budget: null` where the
  // money is withheld. A tier that made this function answer `[]` would be telling a Free
  // family it has no gatherings, and the RLS suite's positive control catches exactly that.
  //
  // IT WITHHOLDS THE FETCH AND NOT THE ROW. The columns stay on `gatherings` and
  // `gathering_tasks`, whose SELECT policy is keyed on `gatherings:view`, and no grant and no
  // plan can narrow a column — the migration that created this key says so at length. A family
  // that lapses to Free keeps every budget it ever set and reads it again on the day it moves
  // back up. This is a screen band, which is all a tier may ever be.
  const canSeeBudget = await canAny(g.userId, 'gatherings/budget', 'view')
    && await tierAllows(g.userId, 'gatherings/budget')

  const admin = createAdminClient()
  const [gatheringsRes, tasksRes, usesRes, templatesRes] = await Promise.all([
    admin.from('gatherings')
      .select(canSeeBudget ? GATHERING_SELECT_WITH_MONEY : GATHERING_SELECT)
      .eq('family_code', g.familyCode)
      .order('starts_on', { ascending: true })
      .order('created_at', { ascending: true }),
    admin.from('gathering_tasks')
      .select('gathering_id, status')
      .eq('family_code', g.familyCode),
    admin.from('gathering_template_uses')
      // `occurs_on` and `location` — the segment's day and place. Selected for the LIST as well
      // as the detail because the list is where an organizer notices a three-day reunion whose
      // middle segment is dated in the wrong month.
      .select('gathering_id, template_id, position, occurs_on, location')
      .eq('family_code', g.familyCode)
      .order('position', { ascending: true }),
    admin.from('gathering_templates')
      .select('id, name')
      .eq('family_code', g.familyCode),
  ])

  // §8 on all four: `data` alone cannot tell a refused query from a family with no gatherings,
  // and this screen would render "none yet" over a family running three reunions.
  if (gatheringsRes.error) {
    console.error(`[admin/gatherings] list read failed for ${g.familyCode}: ${gatheringsRes.error.message}`)
    return []
  }
  if (tasksRes.error) {
    console.error(`[admin/gatherings] task-count read failed for ${g.familyCode}: ${tasksRes.error.message}`)
  }
  if (usesRes.error) {
    console.error(`[admin/gatherings] template-use read failed for ${g.familyCode}: ${usesRes.error.message}`)
  }
  if (templatesRes.error) {
    console.error(`[admin/gatherings] template-name read failed for ${g.familyCode}: ${templatesRes.error.message}`)
  }

  const rows = (gatheringsRes.data ?? []) as unknown as GatheringDbRow[]
  const taskRows = (tasksRes.data ?? []) as { gathering_id: string; status: string }[]
  const useRows = (usesRes.data ?? []) as {
    gathering_id: string; template_id: string; position: number
    occurs_on: string | null; location: string | null
  }[]
  const templateNames = new Map<string, string>(
    ((templatesRes.data ?? []) as { id: string; name: string }[]).map(t => [t.id, t.name]),
  )

  const budgets = canSeeBudget ? await budgetsFor(admin, g.familyCode, rows) : new Map<string, GatheringBudgetView>()

  // WITHHELD AND UNREADABLE ARE THE SAME `null` AND MUST NOT BE THE SAME SENTENCE. `budgetsFor`
  // returns a view for every gathering it is handed unless a read was refused, in which case it
  // returns none at all rather than reporting an unread total as zero — so a missing entry for a
  // caller who IS entitled is a failure, and this is the only place that can still tell.
  const stateFor = (id: string): GatheringBudgetState =>
    !canSeeBudget ? 'withheld' : budgets.has(id) ? 'shown' : 'unavailable'

  return rows.map(row => ({
    id:         row.id,
    title:      row.title,
    summary:    row.summary,
    location:   row.location,
    startsOn:   row.starts_on,
    endsOn:     row.ends_on,
    status:     row.status as GatheringStatus,
    isPremier:  row.is_premier,
    createdBy:  personRef(row.created_by, row.creator),
    taskCounts: taskProgress(asTaskStatuses(taskRows.filter(t => t.gathering_id === row.id))),
    templates:  useRows
      .filter(u => u.gathering_id === row.id)
      .map(u => ({
        id:       u.template_id,
        name:     templateNames.get(u.template_id) ?? '',
        occursOn: u.occurs_on ?? null,
        location: u.location ?? null,
      })),
    budget:      budgets.get(row.id) ?? null,
    budgetState: stateFor(row.id),
  }))
}

/**
 * One gathering with its whole task table and every submission on it.
 *
 * Null for an id that is not in the caller's family — the page turns that into `notFound()`,
 * which is the same answer for "another family's gathering" and "no such gathering" and
 * deliberately does not distinguish them.
 */
export async function getAdminGatheringDetail(gatheringId: string): Promise<AdminGatheringDetail | null> {
  const g = await requireScope('admin/gatherings', 'view')
  if (!g.ok) return null
  if (!gatheringId) return null

  // AND THE PLAN, SINCE 2026-08-19. `gatherings/budget` is `tier: 'standard'` — a registry row
  // in `lib/features.ts` carries it, because the key has no route of its own and would
  // otherwise inherit `/gatherings`, which is Free. It is anded in HERE rather than only at
  // the page for §5's reason: the money columns are chosen from this answer, so a tier
  // resolved upstairs and passed down would be a figure fetched and then hidden.
  //
  // THIS NARROWS AND DOES NOT REFUSE, which is the line `getGatheringFundOptions` below is
  // written about at length: every gathering still comes back, with `budget: null` where the
  // money is withheld. A tier that made this function answer `[]` would be telling a Free
  // family it has no gatherings, and the RLS suite's positive control catches exactly that.
  //
  // IT WITHHOLDS THE FETCH AND NOT THE ROW. The columns stay on `gatherings` and
  // `gathering_tasks`, whose SELECT policy is keyed on `gatherings:view`, and no grant and no
  // plan can narrow a column — the migration that created this key says so at length. A family
  // that lapses to Free keeps every budget it ever set and reads it again on the day it moves
  // back up. This is a screen band, which is all a tier may ever be.
  const canSeeBudget = await canAny(g.userId, 'gatherings/budget', 'view')
    && await tierAllows(g.userId, 'gatherings/budget')

  const admin = createAdminClient()
  const { data, error } = await admin
    .from('gatherings')
    .select(canSeeBudget ? GATHERING_SELECT_WITH_MONEY : GATHERING_SELECT)
    // §3: `.eq('id', …)` alone is not a predicate on this client. Both conjuncts, every time.
    .eq('id', gatheringId)
    .eq('family_code', g.familyCode)
    .maybeSingle()

  if (error) {
    console.error(`[admin/gatherings] detail read failed for ${gatheringId} in ${g.familyCode}: ${error.message}`)
    return null
  }
  if (!data) return null
  const row = data as unknown as GatheringDbRow

  const [tasksRes, usesRes, templatesRes] = await Promise.all([
    admin.from('gathering_tasks')
      .select(canSeeBudget ? TASK_COLUMNS_WITH_MONEY : TASK_COLUMNS)
      .eq('gathering_id', gatheringId)
      .eq('family_code', g.familyCode)
      .order('position', { ascending: true })
      .order('created_at', { ascending: true }),
    admin.from('gathering_template_uses')
      // The segment's day and place, for the row that is now editable inline.
      .select('template_id, position, occurs_on, location')
      .eq('gathering_id', gatheringId)
      .eq('family_code', g.familyCode)
      .order('position', { ascending: true }),
    admin.from('gathering_templates')
      .select('id, name')
      .eq('family_code', g.familyCode),
  ])

  // §8 ON ALL THREE, and the two below were the omission worth naming: `data` alone cannot
  // tell a refused query from a gathering built from no templates, so a PostgREST refusal on
  // either would render "built from no templates" and blank the template name on every row of
  // the task table, with nothing anywhere saying a query had been refused. `getAdminGatherings`
  // logs the same two.
  if (tasksRes.error) {
    console.error(`[admin/gatherings] task read failed for ${gatheringId} in ${g.familyCode}: ${tasksRes.error.message}`)
  }
  if (usesRes.error) {
    console.error(`[admin/gatherings] template-use read failed for ${gatheringId} in ${g.familyCode}: ${usesRes.error.message}`)
  }
  if (templatesRes.error) {
    console.error(`[admin/gatherings] template-name read failed for ${gatheringId} in ${g.familyCode}: ${templatesRes.error.message}`)
  }
  const taskRows = (tasksRes.data ?? []) as unknown as TaskDbRow[]
  const useRows = (usesRes.data ?? []) as {
    template_id: string; position: number; occurs_on: string | null; location: string | null
  }[]
  const templateNames = new Map<string, string>(
    ((templatesRes.data ?? []) as { id: string; name: string }[]).map(t => [t.id, t.name]),
  )

  const [submissions, budgets] = await Promise.all([
    submissionsFor(admin, g.familyCode, taskRows.map(t => t.id)),
    canSeeBudget
      ? budgetsFor(admin, g.familyCode, [row])
      : Promise.resolve(new Map<string, GatheringBudgetView>()),
  ])

  return {
    id:         row.id,
    title:      row.title,
    summary:    row.summary,
    location:   row.location,
    startsOn:   row.starts_on,
    endsOn:     row.ends_on,
    status:     row.status as GatheringStatus,
    isPremier:  row.is_premier,
    createdBy:  personRef(row.created_by, row.creator),
    taskCounts: taskProgress(asTaskStatuses(taskRows)),
    templates:  useRows.map(u => ({
      id:       u.template_id,
      name:     templateNames.get(u.template_id) ?? '',
      occursOn: u.occurs_on ?? null,
      location: u.location ?? null,
    })),
    budget:     budgets.get(row.id) ?? null,
    // See `stateFor` in `getAdminGatherings` — same rule, one row. A missing view for a caller
    // who holds the grant is a refused read, not an absence of money.
    budgetState: !canSeeBudget ? 'withheld' : budgets.has(row.id) ? 'shown' : 'unavailable',
    tasks:      taskRows.map(t => ({
      id:           t.id,
      label:        t.label,
      helpText:     t.help_text,
      kind:         t.kind as GatheringTaskKind,
      required:     t.required,
      position:     t.position,
      status:       t.status as GatheringTaskStatus,
      dueOn:        t.due_on,
      // null for a caller without `gatherings/budget:view`, because the column was never
      // selected for them — see `TASK_COLUMNS_WITH_MONEY`.
      budgetCents:  t.budget_cents ?? null,
      assignee:     personRef(t.assignee_id, t.assignee),
      answer:       t.answer ?? null,
      templateId:   t.template_id,
      templateName: t.template_id ? templateNames.get(t.template_id) ?? null : null,
      decidedAt:    t.decided_at,
      decidedBy:    personRef(t.decided_by, t.decider),
      submissions:  submissions.get(t.id) ?? [],
    })),
  }
}

/** Every submission on a set of tasks, newest first, grouped by task. */
async function submissionsFor(
  admin: AdminClient,
  familyCode: string,
  taskIds: readonly string[],
): Promise<Map<string, GatheringSubmissionRow[]>> {
  const out = new Map<string, GatheringSubmissionRow[]>()
  if (taskIds.length === 0) return out

  const { data, error } = await admin
    .from('gathering_task_submissions')
    .select(SUBMISSION_SELECT)
    .in('task_id', taskIds)
    .eq('family_code', familyCode)
    .order('created_at', { ascending: false })

  if (error) {
    console.error(`[admin/gatherings] submission read failed for ${familyCode}: ${error.message}`)
    return out
  }

  for (const row of (data ?? []) as unknown as SubmissionDbRow[]) {
    const list = out.get(row.task_id) ?? []
    list.push({
      id:          row.id,
      answer:      row.answer,
      note:        row.note,
      decision:    row.decision as 'pending' | 'approved' | 'denied',
      reviewNotes: row.review_notes,
      submittedBy: personRef(row.submitted_by, row.submitter),
      reviewedBy:  personRef(row.reviewed_by, row.reviewer),
      reviewedAt:  row.reviewed_at,
      createdAt:   row.created_at,
    })
    out.set(row.task_id, list)
  }
  return out
}

/**
 * Every task in the family waiting for a ruling — the Review queue pane.
 *
 * The member's own note and the time it arrived come from the LATEST PENDING submission, which
 * is the row `reviewGatheringTask` will decide. A task reading `'submitted'` with no pending
 * submission behind it is a drift this read shows honestly (`note: null`,
 * `submittedAt: null`) rather than hiding, because the queue is where somebody would notice.
 */
export async function getGatheringReviewQueue(): Promise<ReviewQueueRow[]> {
  const g = await requireScope('admin/gatherings', 'view')
  if (!g.ok) return []

  const admin = createAdminClient()
  const { data, error } = await admin
    .from('gathering_tasks')
    .select(QUEUE_SELECT)
    .eq('family_code', g.familyCode)
    .eq('status', 'submitted')
    .order('due_on', { ascending: true, nullsFirst: false })
    .order('created_at', { ascending: true })

  if (error) {
    console.error(`[admin/gatherings] review queue read failed for ${g.familyCode}: ${error.message}`)
    return []
  }

  const rows = (data ?? []) as unknown as QueueDbRow[]
  if (rows.length === 0) return []

  const pendingRes = await admin
    .from('gathering_task_submissions')
    .select('task_id, note, created_at')
    .in('task_id', rows.map(r => r.id))
    .eq('family_code', g.familyCode)
    .eq('decision', 'pending')
    .order('created_at', { ascending: false })

  if (pendingRes.error) {
    console.error(`[admin/gatherings] pending submission read failed for ${g.familyCode}: ${pendingRes.error.message}`)
  }
  const pending = new Map<string, { note: string | null; created_at: string }>()
  for (const row of (pendingRes.data ?? []) as { task_id: string; note: string | null; created_at: string }[]) {
    if (!pending.has(row.task_id)) pending.set(row.task_id, row)   // newest first, so first wins
  }

  return rows.map(row => ({
    taskId:            row.id,
    label:             row.label,
    kind:              row.kind as GatheringTaskKind,
    required:          row.required,
    dueOn:             row.due_on,
    answer:            row.answer ?? null,
    gatheringId:       row.gathering_id,
    gatheringTitle:    row.gatherings?.title ?? '',
    gatheringStartsOn: row.gatherings?.starts_on ?? '',
    assignee:          personRef(row.assignee_id, row.assignee),
    note:              pending.get(row.id)?.note ?? null,
    submittedAt:       pending.get(row.id)?.created_at ?? null,
  }))
}

/**
 * The family's funds and what each holds, for the budget panel's fund picker.
 *
 * ── THE BALANCE IS COMPUTED ON THE ADMIN CLIENT, THROUGH THE RPC ────────────────────
 * `fund_balance_cents(p_fund_id)` is the database's own four-term definition — contributions
 * minus disbursements, plus transfers in, minus transfers out — and it
 * has **no `authenticated` EXECUTE grant** anywhere in the migration chain, so the service
 * role is the only caller it has. That is not merely a permission detail: a balance
 * recomputed on the USER client (which is what `getFunds` does) silently omits the transfer
 * term for anyone without `transactions/fund-transfers:view`, so two organizers would be shown
 * different balances for the same fund and would disagree about whether a gathering is over
 * it. `getActiveFundsForRouting` moved to the admin client for exactly this reason, and this
 * is the same decision.
 *
 * GATED ON `gatherings/budget:view` as well as on the console's own key, because a fund
 * balance IS the money this key withholds — returning `[]` is a fetch that did not happen
 * rather than a picker rendered empty (§5).
 *
 * Active funds only, and the Donations fund is deliberately NOT excluded: it takes no share of
 * dues, but the money in it is real, and a gift given for the reunion is the most obvious
 * thing a reunion's budget would draw on. Same call `transferBetweenFunds` makes.
 */
export async function getGatheringFundOptions(): Promise<{ id: string; name: string; balanceCents: number }[]> {
  const g = await requireScope('admin/gatherings', 'view')
  if (!g.ok) return []
  // ── NO TIER CHECK HERE, AND THAT IS A CORRECTION RATHER THAN AN OMISSION ──────────
  // One was added on 2026-08-19 when `gatherings/budget` became `tier: 'standard'`, and
  // `npm run test:rls` refused it within the hour — not the attack half, the POSITIVE CONTROL:
  // ALPHA's own administrator, entitled to this call, got `[]` because the fixture's families
  // are on the default plan. That is the failure AGENTS.md describes in advance ("the first
  // time a family downgraded, one would start answering 'Not authorized' for their own
  // history"), reproduced on the first run.
  //
  // THE LINE IS BETWEEN NARROWING AND REFUSING, and it is the whole reason two of the three
  // budget resolutions in this feature DO consult the plan while this one does not:
  //
  //   narrowing  `getAdminGatherings` and `getGatheringDetail` choose which COLUMNS to select
  //              and answer `budget: null` for a caller who may not see money. A tier folded
  //              into that answer withholds a screen band and returns every row — which is
  //              what a tier is for, and it is the same shape `getResources()` has used to
  //              tier-filter the permission grid since 20260813000003.
  //   refusing   this function's whole return value IS the money. A tier here does not narrow
  //              anything; it answers "no funds" to an administrator whose family has funds,
  //              which is a lie about their own records rather than a screen they have not
  //              bought.
  //
  // What withholds the fund picker from a Free family is therefore the PAGE:
  // `/admin/gatherings` and `/admin/gatherings/[id]` both and `tierAllows()` into
  // `mayManageBudget` and skip this call entirely, so §5 is discharged by the request never
  // being made. That is also where `/reporting/transactions` puts it for its Plus ledger.
  if (!(await canAny(g.userId, 'gatherings/budget', 'view'))) return []

  const admin = createAdminClient()
  const { data, error } = await admin
    .from('funds')
    .select('id, name')
    .eq('family_code', g.familyCode)
    .eq('active', true)
    .order('name', { ascending: true })

  if (error) {
    console.error(`[admin/gatherings] fund options read failed for ${g.familyCode}: ${error.message}`)
    return []
  }
  const funds = (data ?? []) as { id: string; name: string }[]
  if (funds.length === 0) return []

  // 0 rather than null for an unreadable balance, unlike the budget band: this picker prints
  // "Reunion — $12,400.00" beside a name, and a fund whose balance could not be read still
  // has to be pickable. The RED LINE is computed from `GatheringBudgetView.fundBalanceCents`,
  // which stays null in that case precisely so no marker is drawn from a figure nobody read.
  return Promise.all(funds.map(async fund => {
    const { data, error } = await admin.rpc('fund_balance_cents', { p_fund_id: fund.id })
    if (error) {
      console.error(`[admin/gatherings] fund_balance_cents failed for ${fund.id} in ${g.familyCode}: ${error.message}`)
    }
    return { id: fund.id, name: fund.name, balanceCents: typeof data === 'number' ? data : 0 }
  }))
}

/**
 * Everybody who can hold a task.
 *
 * ── ACCOUNTS AND ACCOUNT-LESS PEOPLE ALIKE, AND THAT IS THE WHOLE POINT ─────────────
 * `gathering_tasks.assignee_id` keys on `people.id`, never on `auth.users.id`, so a recorded
 * grandmother with no login can be asked to bring the photographs. `event_assignments` keys on
 * an auth id and cannot do that — one auth id is identical across every family the account
 * belongs to, which is why every query against it needs an `!inner` join and why an
 * account-less relative can never hold an event assignment.
 *
 * `membership_status = 'approved'` is still required. Somebody who has not been admitted has
 * not joined, and handing them work is not something to do before the family has said yes.
 * The test is POSITIVE (`= 'approved'`) rather than `<> 'pending'`, which is the rule that
 * made `'disabled'` need no sweep when it was added.
 *
 * ── A ROSTER READ GATED ON THE WRITE GRANT, AND THAT IS DELIBERATE ──────────────────
 * `'edit'`, not `'view'`, which is the one place in this module where a READ demands more than
 * the console's view key. This list exists to fill the assignee `PersonPicker` and nothing else
 * consumes it: `assignGatheringTask` is the only action that takes an id from it, and that
 * action requires `admin/gatherings:edit`. So a caller who cannot assign has no use for the
 * roster, and what the roster carries is not incidental — `first_name`, `last_name`,
 * `nick_name` and `date_of_birth` for every approved person in the family, because
 * `disambiguatedName` needs the birthday to tell two Martha Allens apart. That is PII, and §5's
 * rule is that the least-entitled caller who can act is the boundary, not the most.
 *
 * It was `'view'` until 2026-08-19, and `/admin/gatherings/[id]` was already asking for it only
 * behind `edit` — its header says in terms that a server action is a public HTTP endpoint with
 * the page nowhere in its request path, so the ENFORCED gate was the wider one and the page's
 * caution bought nothing. This closes that gap at the endpoint, where it is the only place it
 * can be closed. **If that page's paragraph still says the enforced gate is `view`, it is
 * describing the code as it was.**
 */
export async function getGatheringAssignableMembers(): Promise<AssignableMember[]> {
  const g = await requireScope('admin/gatherings', 'edit')
  if (!g.ok) return []

  const { data, error } = await createAdminClient()
    .from('people')
    .select('id, first_name, last_name, nick_name, date_of_birth')
    .eq('family_code', g.familyCode)
    .eq('membership_status', 'approved')
    .order('last_name', { ascending: true })
    .order('first_name', { ascending: true })

  if (error) {
    console.error(`[admin/gatherings] assignable members read failed for ${g.familyCode}: ${error.message}`)
    return []
  }
  return (data ?? []) as AssignableMember[]
}

// ── Writes: the gathering ────────────────────────────────────────────────────────────

/** Every route a change to a gathering makes stale. */
function revalidateGathering(gatheringId?: string): void {
  revalidatePath('/gatherings')
  revalidatePath('/gatherings/my-tasks')
  revalidatePath('/gatherings/calendar')
  revalidatePath('/admin/gatherings')
  // The premier band and the At a Glance tile both read gatherings.
  revalidatePath('/dashboard')
  if (gatheringId) {
    revalidatePath(`/gatherings/${gatheringId}`)
    revalidatePath(`/admin/gatherings/${gatheringId}`)
  }
}

/**
 * Title, summary, location and the two dates, validated once for create and update.
 *
 * ── THE DATES MIRROR `gatherings_dates_ordered` DELIBERATELY ────────────────────────
 * The CHECK refuses `ends_on < starts_on` with a 23514, which reads to an organizer as a bug
 * in the product rather than as "that reunion ends before it starts". The constraint is the
 * boundary; this is the sentence. Same reasoning as refusing a budget with no fund below.
 *
 * `parseAnswer('date', …)` is reused as the date validator rather than a second regex: it is
 * the one place in this feature that decides what a calendar date is, it round-trips the value
 * through `Date.UTC` so `2026-02-30` is refused as the impossible day it is, and it never asks
 * the local clock what a string means — which is how every date bug in this product happened.
 */
function normalizeDate(value: string | null | undefined): string | null | undefined {
  if (value == null || value === '') return null
  const parsed = parseAnswer('date', value)
  // `undefined` means "that is not a date"; `null` means "there is no date". A STRING sentinel
  // would be indistinguishable from a real date at the type level, which is how the check for
  // it comes to be dropped in a later edit.
  return parsed && 'date' in parsed ? parsed.date : undefined
}

/**
 * Schedule a gathering from one or more templates — the ORGANIZER's create path.
 *
 * The family-facing counterpart is `scheduleGathering` in `app/actions/gatherings.ts`, and the
 * three differences are all deliberate:
 *
 *  * **Any non-archived template.** `who_may_schedule` exists to say which templates an
 *    ordinary member may start a gathering from; a holder of `admin/gatherings:create` is the
 *    authority that setting defers to, so it does not constrain them.
 *  * **Money and the premier flag are accepted here.** Both are organizer decisions. `fund_id`
 *    is §4-checked before it is written, and a `budgetCents` with no fund is refused with a
 *    sentence rather than left to `gatherings_budget_needs_fund`'s 23514.
 *  * **`status` still takes its default of `'planning'`.** Creating the work and announcing it
 *    are two decisions; `updateGathering` moves it.
 *
 * `templateIds` MAY BE EMPTY IN BOTH, as of 2026-08-19, and this said the opposite — "a
 * gathering is scheduled FROM a template … the requirement the whole feature is shaped by".
 * Standard moved the boundary: Free sells the gathering on a shared calendar (a date, a place
 * and the details) and Standard sells the planning, so the template LIBRARY is
 * `tier: 'standard'` while this console is Free, and an organizer on Free has no template to
 * build from. `scheduleGathering`'s header carries the full argument and the answer to the old
 * objection — nothing distinguishes a planned gathering by its task count, and a partial
 * instantiation is reported in `message` rather than inferred from what is missing.
 *
 * NO TIER IS CHECKED HERE, and that is the house rule rather than an omission: the actions
 * behind a paid page are not tier-checked, or the first family to downgrade would meet one
 * refusing to talk about its own history. The PAGE withholds both template reads on the plan.
 */
export async function createGathering(input: {
  title: string
  summary?: string
  location?: string
  startsOn: string
  endsOn?: string
  templateIds: string[]
  fundId?: string | null
  budgetCents?: number | null
  isPremier?: boolean
}): Promise<ActionResult & { gatheringId?: string }> {
  const g = await requireScope('admin/gatherings', 'create')
  if (!g.ok) return { success: false, message: g.message }
  // `getMyPersonId` answers '' for a caller it cannot resolve, and '' is not a uuid — the
  // unchecked version surfaces `invalid input syntax for type uuid: ""` as the whole error.
  if (!g.personId) return { success: false, message: 'Profile not found' }

  const title = (input.title ?? '').trim()
  if (!title) return { success: false, message: 'A gathering needs a title' }

  const startsOn = normalizeDate(input.startsOn)
  if (startsOn == null) return { success: false, message: 'Choose the date the gathering starts' }
  const endsOn = normalizeDate(input.endsOn)
  if (endsOn === undefined) return { success: false, message: 'That end date is not a real date' }
  if (endsOn !== null && endsOn < startsOn) {
    return { success: false, message: 'The gathering cannot end before it starts' }
  }

  const money = normalizeBudget(input.fundId ?? null, input.budgetCents ?? null)
  if ('message' in money) return { success: false, message: money.message }

  // §4, before the id is written onto the row. The insert is on the service role, so no policy
  // is underneath it — and even on the user client a row stamped with this family's code
  // satisfies every policy while the fund it names is another family's money.
  // `tg_gathering_same_family()` states the same rule in the database, where the service role
  // cannot step around it; this is what turns that exception into a sentence.
  if (money.fundId && !(await belongsToFamily('funds', money.fundId, g.familyCode))) {
    return { success: false, message: 'Fund not found' }
  }

  // NO TEMPLATES IS A VALID GATHERING — a date on the family calendar with no tasks. See the
  // header. `resolveTemplates` is skipped rather than called with an empty set: it would answer
  // `{ rows: [] }` by accident (its completeness check is `0 !== 0`, which passes) and an
  // accident is a thing that stops being true the day somebody adds a filter to that query.
  const templateIds = [...new Set((input.templateIds ?? []).filter(Boolean))]

  const admin = createAdminClient()
  const templates = templateIds.length === 0
    ? { rows: [] as { id: string; name: string }[] }
    : await resolveTemplates(admin, g.familyCode, templateIds)
  if ('message' in templates) return { success: false, message: templates.message }

  const { data: created, error } = await admin
    .from('gatherings')
    .insert({
      family_code:  g.familyCode,
      title,
      summary:      (input.summary ?? '').trim() || null,
      location:     (input.location ?? '').trim() || null,
      starts_on:    startsOn,
      ends_on:      endsOn,
      fund_id:      money.fundId,
      budget_cents: money.budgetCents,
      is_premier:   input.isPremier === true,
      created_by:   g.personId,
    })
    .select('id')
    .single()

  if (error || !created) {
    console.error(`[admin/gatherings] create failed in ${g.familyCode}: ${error?.message}`)
    return { success: false, message: error?.message ?? 'Could not create the gathering' }
  }
  const gatheringId = (created as { id: string }).id

  // `templates.rows` is in the order the caller named them (`resolveTemplates` puts it back
  // into that order), and `attachTemplatesToGathering` consumes it in order — which is what
  // `position` on the use row records and what the task list is then read in.
  const failures = await attachTemplatesToGathering(admin, gatheringId, g.familyCode, templates.rows, 0)
  revalidateGathering(gatheringId)

  // THE GATHERING EXISTS, so this reports success and names what did not happen. A caller told
  // "could not create" who then finds the gathering in the list has been told something false,
  // and adding the template again is a real recovery.
  if (failures.length > 0) {
    return {
      success: true,
      gatheringId,
      message: `Created, but the steps from ${failures.join(', ')} could not be added. Add the template again from the gathering.`,
    }
  }
  return { success: true, gatheringId }
}

/**
 * A fund and a budget, checked against each other before either is written.
 *
 * MIRRORS `gatherings_budget_needs_fund`. The CHECK is `budget_cents IS NULL OR fund_id IS NOT
 * NULL`, and it exists because `funds.fund_id` is `ON DELETE SET NULL`: without it, deleting a
 * fund would leave a budget attached to nothing. Refusing here means an organizer reads "choose
 * the fund this budget is drawn on" instead of a 23514 naming a constraint they have never
 * heard of.
 *
 * NOTHING HERE REFUSES AN OVER-FUND BUDGET, and that is the red line the product exists to
 * show rather than an error to prevent. The requirement is explicit: a family plans a $12,000
 * reunion in January and raises the money by June, and the months in between are exactly when
 * they need the screen to say so. `lib/gathering-budget.ts` computes the comparison and the
 * band renders it in `--destructive`; there is deliberately no trigger and no check for it.
 */
function normalizeBudget(
  fundId: string | null,
  budgetCents: number | null,
): { fundId: string | null; budgetCents: number | null } | { message: string } {
  const fund = fundId || null

  if (budgetCents == null) return { fundId: fund, budgetCents: null }
  if (!Number.isFinite(budgetCents)) return { message: 'Enter a budget amount' }

  // ── A FRACTION IS REFUSED, NEVER ROUNDED ──────────────────────────────────────────
  // `120.5` arriving here means a form posted DOLLARS, and rounding it writes 121 cents —
  // $1.21 where $120.50 was meant, a factor of a hundred, silently, into the column that holds
  // the family's reunion money. Refusing is the only answer that tells anybody. The two other
  // money validators in this feature already say so in the same terms — `readBudget` in
  // app/actions/admin/gathering-templates.ts and `parseAnswer('money', …)` in lib/gatherings.ts
  // — and a feature holding two opposite rules for one class of input is how the wrong one gets
  // copied next. The client converts once, at submit, with `dollarsToCents()`.
  //
  // Nothing underneath catches it: this is a public HTTP endpoint, the `number` annotation is
  // erased at runtime, and the column CHECKs `>= 0` and has no opinion about integers.
  if (!Number.isInteger(budgetCents)) {
    return { message: 'A budget must be a whole number of cents, and not negative' }
  }
  if (budgetCents < 0) return { message: 'A budget cannot be negative' }
  if (!fund) return { message: 'Choose the fund this budget is drawn on' }
  return { fundId: fund, budgetCents }
}

/**
 * The set form of §4 for template ids.
 *
 * ONE family-scoped `.in('id', …)` read that must return every id it was asked for. That is
 * `belongsToFamily` for a set, and it is deliberately the same query that reads `is_archived`
 * so the check and the decision cannot disagree about which row they were talking about.
 * `instantiateTemplateTasks` re-verifies each one again on its own, because it is imported by
 * three call sites and must not trust any of them.
 *
 * IT NO LONGER PROJECTS `default_location`. That column is dropped (`20260819000007`): a
 * template stated where its gatherings were usually held and the value was copied onto every
 * segment built from it, which is a template author guessing at a fact belonging to one
 * occasion. A step of kind `'location'` asks a named relative instead, so there is nothing left
 * for this read to carry across.
 */
async function resolveTemplates(
  admin: AdminClient,
  familyCode: string,
  templateIds: readonly string[],
): Promise<
  { rows: { id: string; name: string }[] } | { message: string }
> {
  const { data, error } = await admin
    .from('gathering_templates')
    .select('id, name, is_archived')
    .in('id', templateIds)
    .eq('family_code', familyCode)

  if (error) {
    console.error(`[admin/gatherings] template read failed in ${familyCode}: ${error.message}`)
    return { message: 'Could not read the templates' }
  }

  const rows = (data ?? []) as { id: string; name: string; is_archived: boolean }[]
  // Every id asked for came back inside the family. One missing means it is another family's or
  // does not exist, and both answer the same sentence — telling a caller which is an
  // enumeration signal about another family's data.
  if (rows.length !== templateIds.length) return { message: 'Template not found' }

  const archived = rows.find(r => r.is_archived)
  if (archived) {
    return { message: `“${archived.name}” has been archived and cannot start a new gathering` }
  }

  // Back into the order the caller named them, so the tasks come out in that order.
  const byId = new Map(rows.map(r => [r.id, { id: r.id, name: r.name }]))
  return {
    rows: templateIds.flatMap(id => {
      const row = byId.get(id)
      return row ? [row] : []
    }),
  }
}

/**
 * Edit a gathering's details, or move its status.
 *
 * ── THE DATE CHECK IS MADE AGAINST THE STORED ROW, NOT THE INPUT ────────────────────
 * A form that sends only `endsOn` still has to be checked against the `starts_on` already on
 * the row, and a form that sends only `startsOn` against the stored `ends_on`. Validating each
 * field in isolation is how a reunion comes to end before it begins with the CHECK constraint
 * as the only thing that notices — a 23514 naming `gatherings_dates_ordered`, which is not a
 * sentence for a person.
 *
 * `status` is checked against `GATHERING_STATUSES` rather than trusted: the parameter's type
 * annotation is erased at runtime and this is a public HTTP endpoint, so the only thing
 * underneath a bad value is the table's CHECK.
 */
export async function updateGathering(input: {
  gatheringId: string
  title?: string
  summary?: string | null
  location?: string | null
  startsOn?: string
  endsOn?: string | null
  status?: GatheringStatus
}): Promise<ActionResult> {
  const g = await requireEdit('admin/gatherings')
  if (!g.ok) return { success: false, message: g.message }
  if (!input?.gatheringId) return { success: false, message: 'Gathering not found' }

  const admin = createAdminClient()
  const { data, error } = await admin
    .from('gatherings')
    .select('id, starts_on, ends_on')
    .eq('id', input.gatheringId)
    .eq('family_code', g.familyCode)
    .maybeSingle()

  if (error) {
    console.error(`[admin/gatherings] update could not read ${input.gatheringId} in ${g.familyCode}: ${error.message}`)
    return { success: false, message: 'Could not read that gathering' }
  }
  if (!data) return { success: false, message: 'Gathering not found' }
  const current = data as { starts_on: string; ends_on: string | null }

  const patch: Record<string, unknown> = {}

  if (input.title !== undefined) {
    const title = (input.title ?? '').trim()
    if (!title) return { success: false, message: 'A gathering needs a title' }
    patch.title = title
  }
  if (input.summary !== undefined) patch.summary = (input.summary ?? '').trim() || null
  if (input.location !== undefined) patch.location = (input.location ?? '').trim() || null

  let startsOn = current.starts_on
  if (input.startsOn !== undefined) {
    const parsed = normalizeDate(input.startsOn)
    if (parsed == null) return { success: false, message: 'Choose the date the gathering starts' }
    startsOn = parsed
    patch.starts_on = parsed
  }
  let endsOn = current.ends_on
  if (input.endsOn !== undefined) {
    const parsed = normalizeDate(input.endsOn)
    if (parsed === undefined) return { success: false, message: 'That end date is not a real date' }
    endsOn = parsed
    patch.ends_on = parsed
  }
  if (endsOn !== null && endsOn < startsOn) {
    return { success: false, message: 'The gathering cannot end before it starts' }
  }

  if (input.status !== undefined) {
    if (!(GATHERING_STATUSES as readonly string[]).includes(input.status)) {
      return { success: false, message: 'That is not a gathering status' }
    }
    patch.status = input.status
  }

  if (Object.keys(patch).length === 0) return { success: true }

  const { error: updateError } = await admin
    .from('gatherings')
    .update(patch)
    .eq('id', input.gatheringId)
    .eq('family_code', g.familyCode)

  if (updateError) {
    console.error(`[admin/gatherings] update failed for ${input.gatheringId} in ${g.familyCode}: ${updateError.message}`)
    return { success: false, message: updateError.message }
  }
  revalidateGathering(input.gatheringId)
  return { success: true }
}

/**
 * Delete a gathering — refused once anybody's answer has been approved.
 *
 * ── WHY IT REFUSES RATHER THAN CASCADING ────────────────────────────────────────────
 * `gathering_tasks` and `gathering_template_uses` are `ON DELETE CASCADE` on `gathering_id`,
 * and `gathering_task_submissions` cascades from the tasks — so this delete quietly destroys
 * every answer fourteen relatives gave and every note an organizer wrote back. `'cancelled'`
 * exists precisely so a gathering can be called off without any of that being erased. Same
 * shape as `removeGatheringTemplate` below and as `deleteGatheringTemplate` offering
 * archiving: destroying somebody's work as a side effect is not a thing to do quietly.
 *
 * ── THE TEST IS "HAS ANYBODY ANSWERED", NOT "HAS ANYTHING BEEN APPROVED" ───────────
 * A task off `'open'` is a task with an answer on it. `'submitted'` is a relative's work
 * waiting to be read, `'denied'` is that work plus the notes an organizer wrote back, and
 * `'approved'` is a decision the family has recorded — the cascade destroys all three, and
 * nobody but the person who wrote it can type an answer again. Counting only `'approved'` left
 * the largest version of this harm freely deletable: a gathering where fourteen relatives had
 * submitted and nothing had yet been ruled on.
 *
 * ── AN ASSIGNMENT ALONE DOES NOT BLOCK IT ───────────────────────────────────────────
 * Which is the one difference from `removeGatheringTemplate`, and it is deliberate. Unlinking a
 * template withdraws work from under a named relative while the gathering STAYS on screen with
 * the rest of its tasks, and nothing tells them why theirs went. Deleting the gathering takes
 * the whole thing, so a task nobody has written into goes with the thing it was part of — and
 * an organizer who assigned thirty tasks on a duplicate they created this morning can still
 * delete it, which is the case this has to stay usable for.
 */
export async function deleteGathering(gatheringId: string): Promise<ActionResult> {
  const g = await requireDelete('admin/gatherings')
  if (!g.ok) return { success: false, message: g.message }
  if (!gatheringId) return { success: false, message: 'Gathering not found' }

  const admin = createAdminClient()
  // §3: the id alone must never be the whole predicate on this client.
  const { data: existing, error } = await admin
    .from('gatherings')
    .select('id, title')
    .eq('id', gatheringId)
    .eq('family_code', g.familyCode)
    .maybeSingle()

  if (error) {
    console.error(`[admin/gatherings] delete could not read ${gatheringId} in ${g.familyCode}: ${error.message}`)
    return { success: false, message: 'Could not read that gathering' }
  }
  if (!existing) return { success: false, message: 'Gathering not found' }

  const { count, error: countError } = await admin
    .from('gathering_tasks')
    .select('id', { count: 'exact', head: true })
    .eq('gathering_id', gatheringId)
    .eq('family_code', g.familyCode)
    // Every status but `'open'` — see the header. `.neq` rather than an `.in()` of the other
    // three, so a status added to the CHECK later counts as answered by default: that is the
    // safe direction for a guard over somebody else's work.
    .neq('status', 'open')

  // A COUNT WE COULD NOT READ REFUSES THE DELETE. Defaulting to zero would make a transient
  // failure the path by which a family's answers are destroyed, which is the one outcome this
  // guard exists to prevent.
  if (countError) {
    console.error(`[admin/gatherings] answered-task count failed for ${gatheringId} in ${g.familyCode}: ${countError.message}`)
    return { success: false, message: 'Could not check what work has been answered on this gathering' }
  }
  if ((count ?? 0) > 0) {
    return {
      success: false,
      message: `${count} task${count === 1 ? ' on' : 's on'} “${(existing as { title: string }).title}” ${count === 1 ? 'has' : 'have'} been answered, so it cannot be deleted. Set its status to Cancelled instead — nothing is lost and it can be reopened.`,
    }
  }

  const { error: deleteError } = await admin
    .from('gatherings')
    .delete()
    .eq('id', gatheringId)
    .eq('family_code', g.familyCode)

  if (deleteError) {
    console.error(`[admin/gatherings] delete failed for ${gatheringId} in ${g.familyCode}: ${deleteError.message}`)
    return { success: false, message: deleteError.message }
  }
  revalidateGathering(gatheringId)
  return { success: true }
}

/**
 * Flag or unflag a gathering as premier.
 *
 * NO UNIQUENESS, DELIBERATELY. Several gatherings may carry the flag: a partial unique index
 * would make last year's premier reunion block this year's, and un-flagging the old one is a
 * chore a family should not have to remember in order to announce the new one. The Dashboard
 * band renders the SOONEST flagged gathering whose span has not finished — `getPremierGathering`
 * — and the console and the manual both say so, because a flag that does not obviously decide
 * anything reads as broken.
 */
export async function setGatheringPremier(input: {
  gatheringId: string
  isPremier: boolean
}): Promise<ActionResult> {
  const g = await requireEdit('admin/gatherings')
  if (!g.ok) return { success: false, message: g.message }
  if (!input?.gatheringId) return { success: false, message: 'Gathering not found' }

  const admin = createAdminClient()
  if (!(await belongsToFamily('gatherings', input.gatheringId, g.familyCode))) {
    return { success: false, message: 'Gathering not found' }
  }

  const { error } = await admin
    .from('gatherings')
    .update({ is_premier: input.isPremier === true })
    .eq('id', input.gatheringId)
    .eq('family_code', g.familyCode)

  if (error) {
    console.error(`[admin/gatherings] premier update failed for ${input.gatheringId} in ${g.familyCode}: ${error.message}`)
    return { success: false, message: error.message }
  }
  revalidateGathering(input.gatheringId)
  return { success: true }
}

/**
 * Set the fund a gathering draws on and how much it budgets.
 *
 * ── `canAny`, NEVER `can` ───────────────────────────────────────────────────────────
 * `requireEdit` is `canAny` under the hood, and that is the point: a gathering budget is
 * family money with no personal copy to own. The row a member would "own" here is a gathering
 * they created whose budget pays for a task assigned to THEMSELVES, which is the abuse case —
 * exactly the reasoning that made `canAny` exist for disbursements. Scope `'own'` on this must
 * never open it, `permission_table_map` gives `gatherings/budget` `own_expr = 'false'`, and the
 * key is on `NO_OWNER_KEYS` so the grid does not render an Own switch that grants nothing.
 *
 * ── BOTH VALUES MOVE TOGETHER, WHICH IS WHY THE SIGNATURE TAKES BOTH ────────────────
 * `gatherings_budget_needs_fund` is a constraint over the pair, so setting them one at a time
 * has an order in which the row is invalid — clear the fund first and the CHECK refuses a
 * budget that was already there. One statement, both columns, no read-modify-write to race.
 *
 * ── IT DOES NOT REFUSE AN OVER-FUND BUDGET ──────────────────────────────────────────
 * That is the red line, not an error. See `normalizeBudget`.
 */
export async function setGatheringBudget(input: {
  gatheringId: string
  fundId: string | null
  budgetCents: number | null
}): Promise<ActionResult> {
  const g = await requireEdit('admin/gatherings')
  if (!g.ok) return { success: false, message: g.message }
  if (!input?.gatheringId) return { success: false, message: 'Gathering not found' }

  const money = normalizeBudget(input.fundId ?? null, input.budgetCents ?? null)
  if ('message' in money) return { success: false, message: money.message }

  const admin = createAdminClient()
  if (!(await belongsToFamily('gatherings', input.gatheringId, g.familyCode))) {
    return { success: false, message: 'Gathering not found' }
  }
  // §4. The gathering is ours, so the row satisfies every policy — while the fund it names
  // could be anybody's. Checked BEFORE it is written, not validated afterwards.
  if (money.fundId && !(await belongsToFamily('funds', money.fundId, g.familyCode))) {
    return { success: false, message: 'Fund not found' }
  }

  const { error } = await admin
    .from('gatherings')
    .update({ fund_id: money.fundId, budget_cents: money.budgetCents })
    .eq('id', input.gatheringId)
    .eq('family_code', g.familyCode)

  if (error) {
    console.error(`[admin/gatherings] budget update failed for ${input.gatheringId} in ${g.familyCode}: ${error.message}`)
    return { success: false, message: error.message }
  }
  revalidateGathering(input.gatheringId)
  return { success: true }
}

// ── Writes: segments on a gathering ──────────────────────────────────────────────────
//
// A `gathering_template_uses` row is a SEGMENT since 20260819000001: one template's steps, on
// one day, in one place. The Welcome, the Picnic and the Send Off inside a three-day reunion.
// `occurs_on` and `location` are both nullable and mean "not stated", so a one-day gathering in
// one place has neither and the two screens read exactly as they always did.

/**
 * A segment's day against its gathering's span — a SENTENCE, or null when there is nothing to say.
 *
 * ── IT WARNS. IT NEVER REFUSES, AND THAT IS THE DECISION 20260819000001 IS ABOUT ────
 * That migration's header argues it at length and its probe asserts the acceptance in BOTH
 * directions. The short version: a gathering's dates MOVE. An organizer shifts the weekend, which
 * is an ordinary edit to `gatherings.starts_on` on the gathering's own form — and a trigger tying
 * segments inside the span would refuse it with a 23514 naming a table they were not looking at,
 * about a row they did not touch. Their own sequence, "shift the weekend and then fix the three
 * segments", becomes unreachable, because each half refuses while the other is still wrong.
 *
 * So: CORRECT OR SURFACE, NEVER REFUSE — the choice
 * `person_relationships_marriage_is_not_blood` makes in its own way (AGENTS.md §4c). Here there is
 * nothing to correct, because only a person knows which of the two dates is the wrong one, so it
 * surfaces instead.
 *
 * ── STRING COMPARISON, DELIBERATELY, WITH NO `Date` ANYWHERE IN IT ────────────
 * All three values are `YYYY-MM-DD`, which is lexicographically ordered by construction, so `<`
 * and `>` on the strings ARE the calendar comparison — exact, zoneless, and the same thing
 * `updateGathering` already does for `ends_on < starts_on` a few functions up. Parsing them into
 * `Date`s to compare would be three more chances to read UTC midnight in the local zone, for
 * nothing. Every value reaching here has been through `normalizeDate` or came out of the column.
 *
 * `endsOn` NULL IS A ONE-DAY GATHERING, so the span is `startsOn` alone and a segment on any other
 * day is outside it. That is the right answer rather than a lenient one: an organizer who has
 * given no end date has said the gathering is one day long.
 *
 * IT OPENS WITH "Saved." because it is returned BESIDE `success: true`. A sentence that reads like
 * a refusal on an operation that succeeded is worse than no sentence — which is also why the
 * screen renders it in `--brand-withheld` and never `--destructive` (AGENTS.md: reporting a
 * failure is `form-message.tsx`'s job, and this is not one).
 */
function segmentSpanWarning(
  occursOn: string | null | undefined,
  startsOn: string,
  endsOn: string | null,
): string | null {
  if (!occursOn) return null
  const last = endsOn ?? startsOn
  if (occursOn >= startsOn && occursOn <= last) return null
  return startsOn === last
    ? `Saved. That day is outside the gathering, which is on ${startsOn}.`
    : `Saved. That day is outside the gathering, which runs ${startsOn} to ${last}.`
}

/**
 * A gathering's span, family-scoped, or null when it could not be read.
 *
 * ONLY CALLED WHEN A DAY WAS ACTUALLY STATED, so the ordinary path — add a template, say nothing
 * about when — costs no extra round trip. `.eq('family_code', …)` beside `.eq('id', …)` because
 * this is the service-role client and §3's obligation does not lapse for a read whose only purpose
 * is to compose a warning: a span borrowed from another family's gathering would produce a
 * sentence about dates this family has never seen.
 *
 * A NULL RETURN SKIPS THE WARNING AND NEVER REFUSES THE WRITE. The write's own predicate is what
 * decides whether it lands; this read only decides whether there is something to say about it,
 * and a failed read has nothing to say.
 */
async function gatheringSpan(
  admin: AdminClient,
  gatheringId: string,
  familyCode: string,
): Promise<{ startsOn: string; endsOn: string | null } | null> {
  const { data, error } = await admin
    .from('gatherings')
    .select('starts_on, ends_on')
    .eq('id', gatheringId)
    .eq('family_code', familyCode)
    .maybeSingle()

  if (error) {
    console.error(`[admin/gatherings] span read failed for ${gatheringId} in ${familyCode}: ${error.message}`)
    return null
  }
  if (!data) return null
  const row = data as { starts_on: string; ends_on: string | null }
  return { startsOn: row.starts_on, endsOn: row.ends_on }
}

/**
 * Add another SEGMENT to a gathering that already exists — another template's steps, on its own
 * day, in its own place.
 *
 * The tasks are appended past whatever is already on the gathering — see
 * `instantiateTemplateTasks` on why `position` is offset rather than restarted. Any
 * non-archived template of the family's, for the reason `createGathering` accepts any:
 * `who_may_schedule` constrains an ordinary member, not the authority it defers to.
 *
 * ── THE DAY AND THE PLACE ARE BOTH OPTIONAL, AND NEITHER HAS A DEFAULT ────────
 * Both absent is the ordinary case and leaves the segment reading exactly as one linked before
 * 20260819000001 did. `location` fell back to the template's `default_location` until
 * 20260819000007 dropped that column — a template author stating a venue that belongs to one
 * occasion — so an unstated place is now simply unstated, and a template that wants one carries
 * a step of kind `'location'` for a named relative to answer.
 *
 * `occursOn` IS VALIDATED AND NOT MERELY TYPED. `normalizeDate` is the same validator the
 * gathering's own dates go through, which round-trips the value through `Date.UTC` so
 * `2026-02-30` is refused as the impossible day it is — never `new Date(string)`, which reads
 * UTC midnight in the local zone and is a day out west of Greenwich. The annotation is erased at
 * runtime and this is a public HTTP endpoint, so the check is the only thing there is.
 *
 * AND AN OUT-OF-SPAN DAY IS ACCEPTED, WITH A WARNING. Not refused: a gathering's dates move, and
 * the organizer's own sequence — shift the weekend, then fix the three segments — has to be
 * reachable. `segmentSpanWarning` is the sentence, and `/admin/gatherings/[id]` marks the row
 * persistently in `--brand-withheld` from the data, so the warning is a courtesy at the point of
 * entry rather than the only place it is ever said.
 */
export async function addGatheringTemplate(input: {
  gatheringId: string
  templateId: string
  /** This segment's day, `YYYY-MM-DD`. Absent or null is "not stated". */
  occursOn?: string | null
  /** This segment's place. Absent or null is "not stated"; there is no default. */
  location?: string | null
}): Promise<ActionResult & { warning?: string }> {
  const g = await requireEdit('admin/gatherings')
  if (!g.ok) return { success: false, message: g.message }
  if (!input?.gatheringId || !input?.templateId) {
    return { success: false, message: 'Gathering or template not found' }
  }

  const occursOn = normalizeDate(input.occursOn)
  if (occursOn === undefined) {
    return { success: false, message: 'That is not a date this segment can happen on' }
  }

  const admin = createAdminClient()
  if (!(await belongsToFamily('gatherings', input.gatheringId, g.familyCode))) {
    return { success: false, message: 'Gathering not found' }
  }
  const templates = await resolveTemplates(admin, g.familyCode, [input.templateId])
  if ('message' in templates) return { success: false, message: templates.message }

  const { data: existing, error: existingError } = await admin
    .from('gathering_template_uses')
    .select('id')
    .eq('gathering_id', input.gatheringId)
    .eq('template_id', input.templateId)
    .eq('family_code', g.familyCode)
    .maybeSingle()

  if (existingError) {
    console.error(`[admin/gatherings] template-use read failed for ${input.gatheringId} in ${g.familyCode}: ${existingError.message}`)
    return { success: false, message: 'Could not read this gathering’s templates' }
  }
  // Checked rather than left to `UNIQUE (gathering_id, template_id)`: a 23505 reads as a bug,
  // and "already part of this gathering" is what actually happened.
  if (existing) {
    return { success: false, message: `“${templates.rows[0].name}” is already part of this gathering` }
  }

  const { data: last, error: lastError } = await admin
    .from('gathering_template_uses')
    .select('position')
    .eq('gathering_id', input.gatheringId)
    .eq('family_code', g.familyCode)
    .order('position', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (lastError) {
    console.error(`[admin/gatherings] template-use position read failed for ${input.gatheringId}: ${lastError.message}`)
    return { success: false, message: 'Could not read this gathering’s templates' }
  }

  // `.trim() || null` so an empty box is "not stated" rather than a stated place of no
  // characters — the same expression every optional text field in this feature applies, and the
  // one thing `??` cannot decide for itself, because '' is a value.
  const stated = (input.location ?? '').trim() || null
  const failures = await attachTemplatesToGathering(
    admin, input.gatheringId, g.familyCode,
    templates.rows.map(t => ({ ...t, occursOn, location: stated })),
    ((last as { position: number } | null)?.position ?? -1) + 1,
  )
  revalidateGathering(input.gatheringId)
  if (failures.length > 0) {
    // NOTHING IS LEFT BEHIND, WHICH IS WHAT MAKES "try again" HONEST ADVICE.
    // `attachTemplatesToGathering` unlinks the template again when its steps do not land, so
    // the duplicate check above will not refuse the retry. Before it did: the organizer was
    // told the add had failed, then told the template was already part of the gathering, and
    // was left to work out unaided that removing it first was the way through.
    return {
      success: false,
      message: `Could not add the steps from ${failures.join(', ')}. Nothing was changed — try again.`,
    }
  }

  // The out-of-span courtesy, and only when a day was actually stated — see `segmentSpanWarning`.
  // AFTER the write, deliberately: this is something to say about a segment that now exists, not a
  // condition on creating it, and computing it first would invite somebody to turn it into one.
  if (occursOn) {
    const span = await gatheringSpan(admin, input.gatheringId, g.familyCode)
    const warning = span ? segmentSpanWarning(occursOn, span.startsOn, span.endsOn) : null
    if (warning) return { success: true, warning }
  }
  return { success: true }
}

/**
 * Move a segment: set the day it happens on, and the place it is held.
 *
 * ── WHY THIS IS ITS OWN ACTION AND NOT PART OF `updateGathering` ──────────────
 * A gathering has one row and its segments have several, so a single "save the gathering" call
 * would have to take an array and decide what a MISSING element means — delete that segment, or
 * leave it alone? Both answers are wrong for one of the two screens that would send it. One
 * segment per call, addressed by its (gathering, template) pair, which is exactly the identity
 * `UNIQUE (gathering_id, template_id)` already gives the row.
 *
 * ── ABSENT IS "LEAVE IT ALONE"; EXPLICIT NULL IS "CLEAR IT" ──────────────────
 * The convention `updateGatheringTemplate` and `updateGathering` already use, and the reason both
 * fields are typed `string | null` rather than `string | undefined`. A "set both, always" version
 * would mean a screen offering only the location silently clears the day, and this feature has
 * three screens that could grow such a control. An empty patch is REFUSED rather than answered
 * "saved", for `updateGatheringTemplate`'s reason: every control on the screen sends at least one
 * field, so nothing to change is a caller that has misunderstood.
 *
 * ── §3 AND §4, AND THERE IS NO POLICY UNDERNEATH THIS AT ALL ─────────────────
 * `gathering_template_uses` has exactly one policy, `perm:gathering_template_uses:select`, and no
 * INSERT, UPDATE or DELETE policy — 20260819000000 chose that boundary deliberately and
 * 20260819000001 asserts it is still true, with a note that anybody adding an UPDATE policy to
 * make inline editing "work" from the browser is about to open the table to every approved member.
 * So this UPDATE runs on the service role with nothing beneath it, and both obligations are
 * discharged by hand:
 *
 *   * BOTH ids are verified against the family BEFORE anything is written — the gathering
 *     (§4: the row would be legitimately ours while the id it names is somebody else's) and the
 *     template. `resolveTemplates` is reused for the second so that "not yours", "does not exist"
 *     and "archived" answer with the same sentences they do everywhere else in this file.
 *   * The write carries `.eq('family_code', …)` beside the two ids anyway. Both, not either: the
 *     verification is what produces a sentence, and the conjunct is what keeps the statement
 *     itself safe if a check is ever moved or removed above it.
 *
 * ── IT DOES NOT CREATE A SEGMENT ────────────────────────────────────
 * A (gathering, template) pair with no row is reported as not found, never upserted into
 * existence. Linking a template instantiates its whole step list — `addGatheringTemplate`'s job,
 * several writes and a compensation — so an upsert here would create a segment with a day, a place
 * and NONE OF ITS TASKS, which is a gathering the organizer cannot tell from a failed
 * instantiation.
 */
export async function setGatheringSegment(input: {
  gatheringId: string
  templateId: string
  /** `YYYY-MM-DD`, or null to clear the day. Absent leaves it as it is. */
  occursOn?: string | null
  /** The place, or null to clear it. Absent leaves it as it is. */
  location?: string | null
}): Promise<ActionResult & { warning?: string }> {
  const g = await requireEdit('admin/gatherings')
  if (!g.ok) return { success: false, message: g.message }
  if (!input?.gatheringId || !input?.templateId) {
    return { success: false, message: 'Segment not found' }
  }

  const patch: Record<string, unknown> = {}
  // Kept beside the patch rather than read back out of it, so the warning below cannot be composed
  // from a value that was never sent.
  let nextOccursOn: string | null = null

  if (input.occursOn !== undefined) {
    const parsed = normalizeDate(input.occursOn)
    // `undefined` from `normalizeDate` means "that is not a date" and `null` means "there is no
    // date". A STRING sentinel would be indistinguishable from a real date at the type level,
    // which is how the check for it comes to be dropped in a later edit. That validator
    // round-trips through `Date.UTC`, so 2026-02-30 is refused as the impossible day it is and no
    // local clock is ever asked what the string means.
    if (parsed === undefined) {
      return { success: false, message: 'That is not a date this segment can happen on' }
    }
    patch.occurs_on = parsed
    nextOccursOn = parsed
  }
  if (input.location !== undefined) {
    patch.location = input.location?.trim() || null
  }

  if (Object.keys(patch).length === 0) return { success: false, message: 'Nothing to change' }

  const admin = createAdminClient()
  // §4 on the gathering, before the template: the cheaper check first, and the one whose failure
  // means the caller is looking at another family's screen entirely.
  if (!(await belongsToFamily('gatherings', input.gatheringId, g.familyCode))) {
    return { success: false, message: 'Gathering not found' }
  }
  const templates = await resolveTemplates(admin, g.familyCode, [input.templateId])
  if ('message' in templates) return { success: false, message: templates.message }

  const { data, error } = await admin
    .from('gathering_template_uses')
    .update(patch)
    .eq('gathering_id', input.gatheringId)
    .eq('template_id', input.templateId)
    .eq('family_code', g.familyCode)
    // WHICH ROWS MOVED, because an `.update()` matching nothing is not an error. Without this the
    // action would report "saved" for a template that is not part of this gathering — a stale tab,
    // or a segment another organizer removed a moment ago — and the screen would then show a day
    // nothing stored.
    .select('template_id')

  if (error) {
    console.error(`[admin/gatherings] segment update failed for ${input.gatheringId}/${input.templateId} in ${g.familyCode}: ${error.message}`)
    return { success: false, message: 'Could not save that segment just now. Try again.' }
  }
  if (((data ?? []) as unknown[]).length === 0) {
    return { success: false, message: `“${templates.rows[0].name}” is not part of this gathering` }
  }

  revalidateGathering(input.gatheringId)

  // Only when a day was actually SENT — clearing a location must not warn about a date the caller
  // did not touch. See `segmentSpanWarning` for why this warns rather than refuses.
  if (nextOccursOn) {
    const span = await gatheringSpan(admin, input.gatheringId, g.familyCode)
    const warning = span ? segmentSpanWarning(nextOccursOn, span.startsOn, span.endsOn) : null
    if (warning) return { success: true, warning }
  }
  return { success: true }
}

/**
 * Unlink a template from a gathering, and delete the tasks it put there.
 *
 * ── ONLY TASKS STILL `'open'` AND UNASSIGNED GO, AND THE REST REFUSE THE WHOLE THING ─
 * Destroying somebody's approved answer because a template was unlinked is not a thing to do
 * quietly, and neither is silently withdrawing work a relative has already been asked to do
 * and may have started. So this counts first: if ANY task from this template has been assigned
 * or has moved off `'open'`, the unlink is refused with a sentence naming the count, and the
 * organizer's options are to reassign or to leave it. Only when every one of them is still
 * untouched does anything get deleted.
 *
 * The delete restates `status = 'open'` and `assignee_id IS NULL` in its own predicate as well.
 * That is not belt-and-braces for its own sake: the count and the delete are two statements
 * with no transaction between them, so a task assigned in the seconds between the two would
 * otherwise be destroyed by a decision made before it existed.
 *
 * A task whose `template_id` has gone NULL — its template was deleted — cannot be matched here
 * and is deliberately left alone. It is somebody's work with provenance lost, not an orphan to
 * tidy up.
 */
export async function removeGatheringTemplate(input: {
  gatheringId: string
  templateId: string
}): Promise<ActionResult> {
  const g = await requireEdit('admin/gatherings')
  if (!g.ok) return { success: false, message: g.message }
  if (!input?.gatheringId || !input?.templateId) {
    return { success: false, message: 'Gathering or template not found' }
  }

  const admin = createAdminClient()
  const { data: use, error: useError } = await admin
    .from('gathering_template_uses')
    .select('id')
    .eq('gathering_id', input.gatheringId)
    .eq('template_id', input.templateId)
    .eq('family_code', g.familyCode)
    .maybeSingle()

  if (useError) {
    console.error(`[admin/gatherings] template-use read failed for ${input.gatheringId} in ${g.familyCode}: ${useError.message}`)
    return { success: false, message: 'Could not read this gathering’s templates' }
  }
  // Both ids and the family in one predicate, so this read IS the §4 check for the pair.
  if (!use) return { success: false, message: 'That template is not part of this gathering' }

  const { data: tasks, error: taskError } = await admin
    .from('gathering_tasks')
    .select('id, status, assignee_id')
    .eq('gathering_id', input.gatheringId)
    .eq('template_id', input.templateId)
    .eq('family_code', g.familyCode)

  if (taskError) {
    console.error(`[admin/gatherings] task read failed for ${input.gatheringId}/${input.templateId}: ${taskError.message}`)
    return { success: false, message: 'Could not read the tasks from this template' }
  }

  const rows = (tasks ?? []) as { id: string; status: string; assignee_id: string | null }[]
  const inFlight = rows.filter(t => t.status !== 'open' || t.assignee_id !== null)
  if (inFlight.length > 0) {
    return {
      success: false,
      message: `${inFlight.length} task${inFlight.length === 1 ? ' from this template has' : 's from this template have'} been assigned or answered, so it cannot be removed. Reassign or approve them first.`,
    }
  }

  if (rows.length > 0) {
    const { error: deleteTasksError } = await admin
      .from('gathering_tasks')
      .delete()
      .eq('gathering_id', input.gatheringId)
      .eq('template_id', input.templateId)
      .eq('family_code', g.familyCode)
      .eq('status', 'open')
      .is('assignee_id', null)
    if (deleteTasksError) {
      console.error(`[admin/gatherings] task delete failed for ${input.gatheringId}/${input.templateId}: ${deleteTasksError.message}`)
      return { success: false, message: deleteTasksError.message }
    }
  }

  const { error: deleteUseError } = await admin
    .from('gathering_template_uses')
    .delete()
    .eq('gathering_id', input.gatheringId)
    .eq('template_id', input.templateId)
    .eq('family_code', g.familyCode)

  if (deleteUseError) {
    console.error(`[admin/gatherings] template-use delete failed for ${input.gatheringId}/${input.templateId}: ${deleteUseError.message}`)
    return { success: false, message: deleteUseError.message }
  }
  revalidateGathering(input.gatheringId)
  return { success: true }
}

// ── Writes: tasks ────────────────────────────────────────────────────────────────────

/**
 * Hand a task to a relative, or take it back, and optionally set its deadline.
 *
 * ── THREE CHECKS, AND THE THIRD IS THE PRODUCT DECISION ─────────────────────────────
 *  * The task is in the caller's family — a scoped read, on the service role where nothing
 *    else applies one.
 *  * The assignee is in the caller's family — §4, `belongsToFamily('people', …)`, before the
 *    id is written onto the row. The row carries this family's code and so satisfies every
 *    policy while the person it names is another family's relative;
 *    `tg_gathering_task_same_family()` says the same thing in the database and this is what
 *    turns its 23514 into a sentence.
 *  * The assignee's membership is `'approved'`. A `people` row can exist without its owner
 *    having been admitted, and handing work to somebody the family has not admitted is not
 *    something to do before they say yes. Positive test, never `<> 'pending'`.
 *
 * ACCOUNT-LESS RELATIVES ARE ELIGIBLE. `assignee_id` is a `people.id`, so a recorded
 * grandmother with no login can be asked to bring the photographs — that is the whole reason
 * this table does not key on an auth id.
 *
 * `dueOn` is only touched when the key is PRESENT. An organizer changing who is doing a task
 * has not said anything about when it is due, and `undefined` meaning "clear it" would silently
 * drop deadlines on every reassignment.
 *
 * The notification fires only when the task moves to somebody NEW: re-saving the same assignee
 * is what a form does when a due date changes, and a bell that announces it is a bell nobody
 * reads.
 */
export async function assignGatheringTask(input: {
  taskId: string
  assigneeId: string | null
  dueOn?: string | null
}): Promise<ActionResult> {
  const g = await requireEdit('admin/gatherings')
  if (!g.ok) return { success: false, message: g.message }
  if (!input?.taskId) return { success: false, message: 'Task not found' }

  const admin = createAdminClient()
  const { data, error } = await admin
    .from('gathering_tasks')
    .select('id, gathering_id, label, assignee_id, due_on, gatherings(title)')
    .eq('id', input.taskId)
    .eq('family_code', g.familyCode)
    .maybeSingle()

  if (error) {
    console.error(`[admin/gatherings] assign could not read task ${input.taskId} in ${g.familyCode}: ${error.message}`)
    return { success: false, message: 'Could not read that task' }
  }
  if (!data) return { success: false, message: 'Task not found' }
  const task = data as unknown as {
    id: string
    gathering_id: string
    label: string
    assignee_id: string | null
    due_on: string | null
    gatherings: { title: string } | null
  }

  const assigneeId = input.assigneeId || null
  if (assigneeId) {
    if (!(await belongsToFamily('people', assigneeId, g.familyCode))) {
      return { success: false, message: 'That person is not in this family' }
    }
    const { data: person, error: personError } = await admin
      .from('people')
      .select('membership_status')
      .eq('id', assigneeId)
      .eq('family_code', g.familyCode)
      .maybeSingle()
    if (personError) {
      console.error(`[admin/gatherings] assignee status read failed for ${assigneeId} in ${g.familyCode}: ${personError.message}`)
      return { success: false, message: 'Could not check that person’s membership' }
    }
    if ((person as { membership_status: string } | null)?.membership_status !== 'approved') {
      return { success: false, message: 'That person’s membership has not been approved yet' }
    }
  }

  const patch: Record<string, unknown> = { assignee_id: assigneeId }
  let dueOn = task.due_on
  if (input.dueOn !== undefined) {
    const parsed = normalizeDate(input.dueOn)
    if (parsed === undefined) return { success: false, message: 'That due date is not a real date' }
    dueOn = parsed
    patch.due_on = parsed
  }

  const { error: updateError } = await admin
    .from('gathering_tasks')
    .update(patch)
    .eq('id', input.taskId)
    .eq('family_code', g.familyCode)

  if (updateError) {
    console.error(`[admin/gatherings] assign failed for ${input.taskId} in ${g.familyCode}: ${updateError.message}`)
    return { success: false, message: updateError.message }
  }

  if (assigneeId && assigneeId !== task.assignee_id) {
    // Wrapped, because a bell failure must never undo the decision it announces. The writer
    // inside reads its own `error` — supabase-js RETURNS errors rather than throwing, so this
    // `catch` sees nothing PostgREST produces.
    try {
      await notifyGatheringTaskAssigned({
        familyCode:       g.familyCode,
        assigneePersonId: assigneeId,
        gatheringTitle:   task.gatherings?.title ?? '',
        taskLabel:        task.label,
        dueOn,
        // Their own task list, not the organizer console — the link has to land where the
        // person being told can act.
        link:             '/gatherings/my-tasks',
      })
    } catch (e) {
      console.error(`[admin/gatherings] task_assigned notification threw in ${g.familyCode}: ${String(e)}`)
    }
  }

  revalidateGathering(task.gathering_id)
  return { success: true }
}

/**
 * Set (or clear) one task's budget line.
 *
 * A null line means "this task costs the family nothing", NOT "unknown" — there is no such
 * state, and `gatheringBudgetMath` sums a null as zero for exactly that reason. The lines are
 * deliberately NOT constrained against the gathering's budget: lines exceeding the budget is
 * the quieter of the two overruns the band reports, and refusing it would stop an organizer
 * writing down what the reunion actually costs.
 */
export async function setGatheringTaskBudget(input: {
  taskId: string
  budgetCents: number | null
}): Promise<ActionResult> {
  const g = await requireEdit('admin/gatherings')
  if (!g.ok) return { success: false, message: g.message }
  if (!input?.taskId) return { success: false, message: 'Task not found' }

  let cents: number | null = null
  if (input.budgetCents != null) {
    if (!Number.isFinite(input.budgetCents)) return { success: false, message: 'Enter an amount' }
    // REFUSED, NOT ROUNDED, for the whole argument written out above `normalizeBudget`: a
    // fraction arriving here means a form posted dollars, and rounding it writes $1.21 where
    // $120.50 was meant. The same two things the column CHECKs, plus the integer the column
    // cannot check.
    if (!Number.isInteger(input.budgetCents)) {
      return { success: false, message: 'A budget line must be a whole number of cents, and not negative' }
    }
    if (input.budgetCents < 0) return { success: false, message: 'A budget line cannot be negative' }
    cents = input.budgetCents
  }

  const admin = createAdminClient()
  const { data, error } = await admin
    .from('gathering_tasks')
    .select('id, gathering_id')
    .eq('id', input.taskId)
    .eq('family_code', g.familyCode)
    .maybeSingle()

  if (error) {
    console.error(`[admin/gatherings] task budget could not read ${input.taskId} in ${g.familyCode}: ${error.message}`)
    return { success: false, message: 'Could not read that task' }
  }
  if (!data) return { success: false, message: 'Task not found' }

  const { error: updateError } = await admin
    .from('gathering_tasks')
    .update({ budget_cents: cents })
    .eq('id', input.taskId)
    .eq('family_code', g.familyCode)

  if (updateError) {
    console.error(`[admin/gatherings] task budget update failed for ${input.taskId} in ${g.familyCode}: ${updateError.message}`)
    return { success: false, message: updateError.message }
  }
  revalidateGathering((data as { gathering_id: string }).gathering_id)
  return { success: true }
}

/**
 * Approve a submitted answer, or send it back with notes.
 *
 * ── A DENIAL WITHOUT NOTES IS REFUSED, AND THAT IS THE FEATURE ──────────────────────
 * `review_notes` is the instruction: the member reads it and submits again. A denial with
 * nothing in it stops the task dead — the member is told their answer was not accepted and
 * nothing on any screen says what to change — which is precisely the thing the request asked
 * not to happen. So `'denied'` demands a non-blank note and `'approved'` does not.
 *
 * ── ONE SUBMISSION ROW IS UPDATED, THE LATEST PENDING ONE ───────────────────────────
 * By id, after reading it, and never `.eq('decision', 'pending')` as a bulk update: the table
 * is an audit trail, a denial from March keeps its own notes, and rewriting every pending row
 * would rewrite history if two submissions ever sat unruled. Ordered by `created_at DESC` and
 * taken first, because a resubmission is a NEW row.
 *
 * ── THE TASK MUST BE `'submitted'` ──────────────────────────────────────────────────
 * There is nothing to rule on otherwise, and admitting an `'open'` task would let an organizer
 * approve an answer nobody has given. An already-`'approved'` task is refused for the same
 * reason `submitGatheringTask` refuses one: approved is terminal on both sides.
 *
 * ── WHO IS TOLD ─────────────────────────────────────────────────────────────────────
 * The person who SUBMITTED the answer, falling back to the current assignee. Those are the same
 * person almost always, and where they differ — a task reassigned after it was answered — the
 * one who needs the notes is the one who wrote the answer they are about.
 */
export async function reviewGatheringTask(input: {
  taskId: string
  decision: 'approved' | 'denied'
  reviewNotes?: string
}): Promise<ActionResult> {
  const g = await requireEdit('admin/gatherings')
  if (!g.ok) return { success: false, message: g.message }
  if (!g.personId) return { success: false, message: 'Profile not found' }
  if (!input?.taskId) return { success: false, message: 'Task not found' }

  // The annotation is erased at runtime and this is a public HTTP endpoint, so the value is
  // checked rather than trusted — the alternative underneath is the table's CHECK.
  if (input.decision !== 'approved' && input.decision !== 'denied') {
    return { success: false, message: 'Choose Approve or Send back' }
  }
  const reviewNotes = (input.reviewNotes ?? '').trim() || null
  if (input.decision === 'denied' && !reviewNotes) {
    return { success: false, message: 'Say what needs to change — sending a task back without notes leaves nothing to act on' }
  }

  const admin = createAdminClient()
  const { data, error } = await admin
    .from('gathering_tasks')
    .select('id, gathering_id, label, status, assignee_id, gatherings(title)')
    .eq('id', input.taskId)
    .eq('family_code', g.familyCode)
    .maybeSingle()

  if (error) {
    console.error(`[admin/gatherings] review could not read task ${input.taskId} in ${g.familyCode}: ${error.message}`)
    return { success: false, message: 'Could not read that task' }
  }
  if (!data) return { success: false, message: 'Task not found' }
  const task = data as unknown as {
    id: string
    gathering_id: string
    label: string
    status: string
    assignee_id: string | null
    gatherings: { title: string } | null
  }

  if (task.status !== 'submitted') {
    return {
      success: false,
      message: task.status === 'approved'
        ? 'This task has already been approved, and an approved answer is final.'
        : 'There is nothing waiting for review on this task.',
    }
  }

  const { data: pending, error: pendingError } = await admin
    .from('gathering_task_submissions')
    .select('id, submitted_by')
    .eq('task_id', input.taskId)
    .eq('family_code', g.familyCode)
    .eq('decision', 'pending')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (pendingError) {
    console.error(`[admin/gatherings] pending submission read failed for ${input.taskId} in ${g.familyCode}: ${pendingError.message}`)
    return { success: false, message: 'Could not read the submission' }
  }

  const submission = pending as { id: string; submitted_by: string | null } | null
  const decidedAt = new Date().toISOString()

  if (submission) {
    const { error: submissionError } = await admin
      .from('gathering_task_submissions')
      .update({
        decision:     input.decision,
        review_notes: reviewNotes,
        reviewed_by:  g.personId,
        reviewed_at:  decidedAt,
      })
      // By id, and family-scoped: one row, the one that was read.
      .eq('id', submission.id)
      .eq('family_code', g.familyCode)
    if (submissionError) {
      console.error(`[admin/gatherings] submission update failed for ${submission.id} in ${g.familyCode}: ${submissionError.message}`)
      return { success: false, message: 'Could not record the decision' }
    }
  } else {
    // A `'submitted'` task with no pending submission is drift — the only way to reach it is a
    // failed second write in `submitGatheringTask`, which reports that failure to the member.
    // The organizer's ruling still stands on the TASK, and the notes still reach the member
    // through the bell, so this proceeds and says so in the log rather than refusing a decision
    // over a missing audit row.
    console.warn(`[admin/gatherings] task ${input.taskId} in ${g.familyCode} is 'submitted' with no pending submission; ruling recorded on the task only.`)
  }

  const { error: taskError } = await admin
    .from('gathering_tasks')
    .update({ status: input.decision, decided_at: decidedAt, decided_by: g.personId })
    .eq('id', input.taskId)
    .eq('family_code', g.familyCode)

  if (taskError) {
    console.error(`[admin/gatherings] task decision failed for ${input.taskId} in ${g.familyCode}: ${taskError.message}`)
    return { success: false, message: taskError.message }
  }

  const tellPersonId = submission?.submitted_by ?? task.assignee_id
  if (tellPersonId) {
    try {
      await notifyGatheringTaskReviewed({
        familyCode:       g.familyCode,
        assigneePersonId: tellPersonId,
        gatheringTitle:   task.gatherings?.title ?? '',
        taskLabel:        task.label,
        decision:         input.decision,
        reviewNotes,
        link:             '/gatherings/my-tasks',
      })
    } catch (e) {
      console.error(`[admin/gatherings] task_${input.decision} notification threw in ${g.familyCode}: ${String(e)}`)
    }
  }

  revalidateGathering(task.gathering_id)
  return { success: true }
}

/**
 * Reopen an APPROVED task, so the assignee can change their answer.
 *
 * ── THIS EXISTS BECAUSE A MESSAGE ALREADY PROMISED IT ───────────────────────────────
 * `submitGatheringTask` refuses an approved task with "Ask an organizer to reopen it if it needs
 * to change", and until 2026-08-19 there was no reopen path anywhere: `reviewGatheringTask`
 * demands `status = 'submitted'`, so an approved task was terminal for the organizer as well as
 * for the member. A member reading that sentence went to an organizer who then had no control to
 * press. Naming a control that does not exist is precisely what AGENTS.md's manual rule is
 * written against, and the cheaper fix — softening the sentence — would leave the product with no
 * way at all to correct a wrong approval short of `deleteGathering`, which this module refuses for
 * any gathering somebody has answered.
 *
 * ── "APPROVED IS FINAL" STAYS TRUE FROM THE MEMBER'S SIDE, WHICH IS THE REQUIREMENT ──
 * The member cannot reopen their own task, cannot overwrite an answer somebody signed off, and
 * cannot make an approved line stop being approved. What changes is that the person who APPROVED
 * it can take that back — which is not a weakening of the rule, it is the rule having an owner.
 * `canAny` (through `requireEdit`) rather than `can`, on the module's standing argument: the task
 * an organizer would "own" is one assigned to themselves, and an approval of their own answer
 * that they can then quietly reopen and re-approve is the abuse case, exactly the reasoning
 * `canAny` exists for.
 *
 * ── NOTHING IS ERASED. THE HISTORY IS THE POINT ─────────────────────────────────────
 * The answer stays on the task and every `gathering_task_submissions` row stays exactly as it
 * is — including the approved one, with the organizer who approved it and when. Two reasons, and
 * both are load-bearing:
 *
 *  * That table is the audit trail. A reopen is a new fact about the task, not a reason to
 *    rewrite the record of what was submitted and ruled on; `reviewGatheringTask`'s own header
 *    refuses a bulk update of pending rows for the same reason.
 *  * The last answer is what the member will EDIT. `/gatherings/my-tasks` seeds each card's
 *    draft from `task.answer`, so clearing it would hand somebody a blank box and ask them to
 *    retype a venue, a list of names or an amount they had already got right. A correction is
 *    usually one word.
 *
 * `decided_at` and `decided_by` ARE cleared, and that is not an inconsistency with the above:
 * they say who ruled on the answer now on the row, and after a reopen nobody has. Leaving them
 * would name an organizer as having decided something they have since taken back, on every screen
 * that prints "decided by" — the same reasoning `submitGatheringTask` clears them on a
 * resubmission.
 *
 * ── WHAT THE MEMBER IS TOLD ──────────────────────────────────────────────────────────
 * `notifyGatheringTaskReopened`, its own writer with its own `type` (`'task_reopened'`).
 *
 * THIS ACTION ORIGINALLY CALLED `notifyGatheringTaskReviewed({ decision: 'denied' })`, on the
 * argument that from the member's side a reopen and a send-back are the same event — their task
 * is in their hands again with the organizer's reason attached, which is exactly what that
 * writer's copy says. The argument was decided against on 2026-08-19, on a ground this action
 * cannot see from where it sits: WHAT THE MEMBER LAST HEARD. A send-back follows a submission
 * they are waiting on, so "was sent back with notes" names the thing they just did. A reopen
 * follows an APPROVAL — the last word that member had on this task was "approved", possibly weeks
 * ago — so the same sentence reads as their latest answer having been refused. It was not; it was
 * accepted, and then an organizer changed their mind. A member who cannot tell those apart goes
 * looking for a submission they never made. The full argument is in `lib/notifications.ts`.
 *
 * The cost is real and is stated there too: "show me what came back to me" now has to name both
 * types rather than one. That is the correct direction — a surface can enumerate two words, and
 * no surface can un-conflate two events that were stored as one.
 *
 * THE ASSIGNEE IS TOLD, not the person who submitted the approved answer — which is the one place
 * this differs from `reviewGatheringTask`, deliberately. That action's notes are ABOUT an answer,
 * so they go to whoever wrote it. A reopen is a request for work, and after it only the current
 * assignee can do that work: `submitGatheringTask` demands `assignee_id === personId`. Telling a
 * relative who has since been unassigned would be asking somebody to act on a task the product
 * will refuse them.
 *
 * ── TWO THINGS THAT LOOK LIKE OMISSIONS AND ARE NOT ─────────────────────────────────
 *  * **No `belongsToFamily(taskId)` call.** The read below is `.eq('id', …)` AND
 *    `.eq('family_code', g.familyCode)`, which IS that check for the row being updated, and it
 *    also supplies the status the refusal is about — one query instead of two. `belongsToFamily`
 *    earns its place where an id arriving from a caller is WRITTEN ONTO a row (§4), which is why
 *    `assignGatheringTask` calls it for `assigneeId` and neither it nor `reviewGatheringTask`
 *    calls it for the task. Same shape as `removeGatheringTemplate`'s scoped read of the pair.
 *  * **A cancelled gathering is not refused.** `submitGatheringTask` does refuse one, so a task
 *    reopened on a cancelled gathering cannot then be resubmitted — but the organizer pressing
 *    this has the status pill in front of them and is the person who can move it, and refusing
 *    them would block the ordinary sequence for reviving a called-off gathering. That is
 *    `assignGatheringTask`'s decision, stated in its header, and this follows it rather than
 *    inventing a second rule for the same situation.
 */
export async function reopenGatheringTask(input: {
  taskId: string
  /** Why, in the organizer's words. Optional — a wrong approval sometimes needs no explaining. */
  reason?: string
}): Promise<ActionResult> {
  const g = await requireEdit('admin/gatherings')
  if (!g.ok) return { success: false, message: g.message }
  if (!input?.taskId) return { success: false, message: 'Task not found' }

  const reason = (input.reason ?? '').trim() || null

  const admin = createAdminClient()
  const { data, error } = await admin
    .from('gathering_tasks')
    // §3: the id alone is never the whole predicate on this client. Bare `gatherings(...)`:
    // `gathering_tasks` has exactly one foreign key to it, and this is the admin client, so no
    // policy narrows the embed either.
    .select('id, gathering_id, label, status, assignee_id, gatherings(title)')
    .eq('id', input.taskId)
    .eq('family_code', g.familyCode)
    .maybeSingle()

  if (error) {
    console.error(`[admin/gatherings] reopen could not read task ${input.taskId} in ${g.familyCode}: ${error.message}`)
    return { success: false, message: 'Could not read that task' }
  }
  if (!data) return { success: false, message: 'Task not found' }
  const task = data as unknown as {
    id: string
    gathering_id: string
    label: string
    status: string
    assignee_id: string | null
    gatherings: { title: string } | null
  }

  // ONLY AN APPROVED TASK, and the refusal says what is already true rather than "not
  // authorized" — the caller holds the grant, there is simply nothing here to take back. A
  // `'submitted'` task belongs to `reviewGatheringTask`, and `'open'` and `'denied'` are already
  // in the member's hands, so reopening either would be a write that changed nothing while
  // clearing the two fields that record a denial.
  if (task.status !== 'approved') {
    return {
      success: false,
      message: task.status === 'submitted'
        ? 'This task is waiting for review, so there is nothing to reopen — approve it or send it back.'
        : 'This task has not been approved, so there is nothing to reopen. It is already with the member.',
    }
  }

  const { error: updateError } = await admin
    .from('gathering_tasks')
    // `answer` is deliberately absent from this patch, and so is every submission row — see the
    // header. What moves is the status and the two fields that name who ruled on it.
    .update({ status: 'open', decided_at: null, decided_by: null })
    .eq('id', input.taskId)
    .eq('family_code', g.familyCode)

  if (updateError) {
    console.error(`[admin/gatherings] reopen failed for ${input.taskId} in ${g.familyCode}: ${updateError.message}`)
    return { success: false, message: updateError.message }
  }

  if (task.assignee_id) {
    // Wrapped, because a bell failure must never undo the decision it announces. The writer
    // inside reads its own `error` — supabase-js RETURNS errors rather than throwing, so this
    // `catch` sees nothing PostgREST produces.
    try {
      await notifyGatheringTaskReopened({
        familyCode:       g.familyCode,
        assigneePersonId: task.assignee_id,
        gatheringTitle:   task.gatherings?.title ?? '',
        taskLabel:        task.label,
        reason,
        // Their own task list, not the console — the link has to land where the person being
        // told can act, and after a reopen that is the card with the submit form on it.
        link:             '/gatherings/my-tasks',
      })
    } catch (e) {
      console.error(`[admin/gatherings] reopen notification threw in ${g.familyCode}: ${String(e)}`)
    }
  }

  // The same routes `reviewGatheringTask` invalidates, through the same helper: a reopen moves a
  // task out of `'approved'`, so it changes the progress line on `/gatherings`, the member's
  // to-do list, the console, and the premier band's "6 of 9 approved" on the Dashboard.
  revalidateGathering(task.gathering_id)
  return { success: true }
}
