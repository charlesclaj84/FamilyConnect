'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { getMyFamilyCode, getMyPersonId, belongsToFamily } from '@/lib/auth/family'
import { can, canAny } from '@/lib/auth/permissions'
import { createAdminClient } from '@/lib/supabase/admin'
import {
  annualTotalCents,
  installmentCents,
  nextInstallmentDate,
  currentPeriodStart,
  defaultCadence,
  type PayCadence,
  type ScheduleKind,
} from '@/lib/dues-utils'
import { routeContribution, type RoutingFund } from '@/lib/fund-routing'
import { embedOne, type PersonNameRow } from '@/lib/supabase/embed'

/**
 * A dues schedule or a donation drive — see `kind`.
 *
 * Three fields are kind-specific, and the create/update actions keep them that way
 * rather than trusting a caller:
 *
 *   dues     — amount_cents + frequency say what is owed and how often.
 *              goal_cents is null.
 *   donation — goal_cents is the target being advised. amount_cents is 0 and
 *              frequency is 'one-time' because a drive does not recur: its
 *              start_date/end_date are its whole timing story.
 */
export interface DuesSchedule {
  id: string
  label: string
  amount_cents: number
  frequency: string
  due_month: number | null
  due_day: number | null
  active: boolean
  start_date: string | null
  end_date: string | null
  description: string | null
  kind: ScheduleKind
  goal_cents: number | null
  /**
   * TRUE: every member owes this and cannot decline it.
   * FALSE: optional — a member may opt out (see DuesSummary.optedOut).
   *
   * Always false for a donation, held there by a CHECK (20260807000003): a gift nobody
   * may decline is not a gift.
   */
  required: boolean
  /**
   * DONATIONS ONLY: the people this drive is FOR — and therefore the people who cannot
   * see it, administrators included.
   *
   * A family collecting for one of its own needs the drive hidden from them, and no
   * grant-shaped answer can do that: an administrator holds scope 'any' everywhere and
   * edits the grid on Members & Access, so the people most likely to be given a gift
   * are exactly the ones a permission could not hide it from. 20260811000000 makes it
   * a set of RESTRICTIVE policies instead, which AND with every grant rather than
   * OR-ing another way in.
   *
   * ALWAYS EMPTY IN A BENEFICIARY'S OWN READ, because the schedule row does not come
   * back for them at all. Nothing here is what does the hiding — the database is —
   * and a caller holding this array is by definition not on it.
   */
  beneficiary_person_ids: string[]
}

export interface DuesPayment {
  id: string
  person_id: string
  person_name: string | null
  schedule_id: string | null
  schedule_label: string | null
  /** Whether this paid for dues or a donation. Null only for legacy schedule-less rows. */
  schedule_kind: ScheduleKind | null
  amount_cents: number
  status: string
  payment_date: string
  payment_method: string | null
  /** Cheque number or confirmation code the money arrived on. Null on waived rows. */
  payment_reference: string | null
  notes: string | null
  created_at: string
  /**
   * Who entered it. Null only where the recorder's `people` row has since been deleted
   * — recorded_by is ON DELETE SET NULL, and 20260807000002 requires it on insert.
   */
  recorded_by_name: string | null
  /** Set when THIS row is a reversal of another payment. */
  reverses_id: string | null
  /** Set when another row reverses THIS one — so the ledger can say so. */
  reversed_by_id: string | null
}

/**
 * Whether a schedule has been transacted against — which is what decides how much of
 * it is still editable (20260807000001).
 *
 * Two flags rather than one because the two kinds are at stake at different moments. A
 * DUE is used the instant any row references it, waived and pending included: each was
 * posted against these terms and each is read back through them, so repricing it
 * restates history. A DONATION is only at stake once real money arrived — an unfunded
 * drive is still just a plan, and its dates are still a plan's dates.
 */
export interface ScheduleUsage {
  /** Any payment row references this schedule, whatever its status. */
  used: boolean
  /** A settled payment references it: money genuinely arrived. */
  funded: boolean
}

export interface DuesSummary {
  schedule: DuesSchedule
  cadence: PayCadence
  hasExplicitPlan: boolean
  annualTotalCents: number
  installmentCents: number
  amountPaidThisPeriodCents: number
  amountPaidTotalCents: number
  /**
   * Forgiven against this period, in cents.
   *
   * SETTLES THE DUE WITHOUT BEING MONEY, which is the whole reason it is its own field
   * rather than folded into the paid figures beside it. Waiving is the family deciding
   * this member does not have to find it, so it reduces `remainingBalanceCents` exactly
   * as a payment does; but nothing arrived, so it must never reach a paid total, a fund
   * balance, or the family's collected figure. `recordPayment` keeps it out of the
   * routing waterfall for the same reason.
   */
  amountWaivedThisPeriodCents: number
  remainingBalanceCents: number
  nextInstallmentDate: string | null
  paid: boolean
  lastPayment: DuesPayment | null
  /** Mirrors schedule.required, lifted so consumers do not have to reach through. */
  required: boolean
  /** This member has declined this optional due. Always false for a required one. */
  optedOut: boolean
}

/**
 * One donation drive: how far the FAMILY has got toward its goal, plus this member's
 * own share of it.
 *
 * Deliberately NOT a DuesSummary: that shape is built out of obligation —
 * `remainingBalanceCents`, `nextInstallmentDate`, `paid` — and none of those mean
 * anything for a gift.
 *
 * PRIVACY: `raisedCents` is a single number for the whole family. Nothing in this
 * shape can be attributed to another member — no per-person rows, no names, no giver
 * count, no dates that would let one gift be pinned to one person. The only
 * individual figure here is the reader's own.
 */
export interface DonationSummary {
  schedule: DuesSchedule
  /** The advised target, or null if the family did not set one. Not a cap. */
  goalCents: number | null
  /** Everything the family has given to this drive, added together. */
  raisedCents: number
  /** The reader's own share of that total. Their own data, nobody else's. */
  myGivenCents: number
  /**
   * Progress toward the goal as a percentage. NOT clamped: a drive that raised twice
   * its goal reports 200, and the bar is drawn to match.
   */
  progressPercent: number
  goalMet: boolean
  /** end_date is in the past: the drive is over, so the bar is history not an ask. */
  closed: boolean
}

// ── P&L (Family Finances) ledger shape ──────────────────────────────────────

export interface PnLRoutingFund {
  fundId: string
  fundName: string
  contributedCents: number
  bySource: { label: string; cents: number }[]
}

export interface PnLFundBalance {
  fundId: string
  fundName: string
  contributedCents: number
  disbursedCents: number
  expensedCents: number
  balanceCents: number
}

export interface PnLEvent {
  eventId: string
  eventName: string
  backingFundId: string | null
  backingFundName: string | null
  lineItems: { id: string; title: string; budgetedCents: number; spentCents: number }[]
  totalBudgetedCents: number
  totalSpentCents: number
  unbudgetedSpentCents: number
}

export interface PnLData {
  totalIncomeCents: number        // paid dues + donations (both are dues_payments)
  totalContributionsCents: number // manual + member fund contributions
  totalCollectedCents: number     // dues + contributions
  totalExpenseCents: number       // actual spend (event_expenses), not budgets
  netCents: number
  payments: DuesPayment[]
  routing: PnLRoutingFund[]
  funds: PnLFundBalance[]
  events: PnLEvent[]
}

// ── Helpers ──────────────────────────────────────────────────────────────────

type AdminClient = ReturnType<typeof createAdminClient>

/**
 * Which Accounting section governs a schedule, by kind.
 *
 * Both kinds are dues_schedules rows, but they are two sections of the Accounting
 * admin page and two separate grants (20260806000007): maintaining what members owe
 * and running a donation drive are different jobs. The kind is always resolved from
 * the row — or, on create, from the same validated value the row is built with —
 * never from a caller's claim about which permission to check.
 */
const SCHEDULE_RESOURCE: Record<ScheduleKind, string> = {
  dues: 'admin/account/dues',
  donation: 'admin/account/donations',
}

/**
 * Normalize a dues_schedules row's `kind`.
 *
 * Anything that is not exactly 'donation' is dues — which covers the column being
 * absent (a database that has not run 20260805000002 yet) as well as NULL. Reads
 * therefore never lose a schedule to an unapplied migration; the worst case is that
 * donations do not exist yet, which is true.
 */
function mapSchedule(
  s: DuesSchedule & {
    kind?: string | null
    required?: boolean | null
    donation_beneficiaries?: { person_id: string }[] | null
  },
): DuesSchedule {
  const kind: ScheduleKind = s.kind === 'donation' ? 'donation' : 'dues'
  // The embed is pulled OUT of the spread rather than left to ride along: this object is
  // serialized into the RSC payload, and shipping the raw join rows beside the flattened
  // ids would put the same fact on the wire twice in two shapes.
  const { donation_beneficiaries, ...rest } = s
  return {
    ...rest,
    kind,
    goal_cents: s.goal_cents ?? null,
    // Absent whenever the caller did not ask for the embed — the insert's `.select('*')`
    // is the normal case — so it defaults to empty rather than undefined. A missing
    // embed must never read as "no beneficiaries" anywhere that DECIDES something; it
    // does not, because the deciding is done by the policies, not by this array.
    beneficiary_person_ids: (donation_beneficiaries ?? []).map(b => b.person_id),
    // A donation is never required. Defaulted rather than trusted so a database that has
    // not run 20260807000003 yet reads as "required dues, optional donations", which is
    // what every row in it means.
    required: kind === 'donation' ? false : (s.required ?? true),
  }
}

/**
 * Force the kind's invariants onto a write, whatever the caller sent.
 *
 * A donation with an amount would start showing up as an obligation; a dues schedule
 * with a goal would render a progress bar against a bill. Both are one stale client
 * away, so the shape is settled here rather than trusted. Returns only the keys it
 * owns, so it can be spread over a partial update.
 */
function kindInvariants(kind: ScheduleKind, goalCents: number | null | undefined) {
  return kind === 'donation'
    // `required: false` is forced here as well as CHECKed in the database, so a stale
    // form cannot post a donation nobody may decline and get a constraint violation
    // instead of a sensible row.
    ? { amount_cents: 0, frequency: 'one-time', goal_cents: goalCents ?? null, required: false }
    : { goal_cents: null }
}

/**
 * The columns and embeds `mapPayment` reads. Declared because the row it maps is whatever
 * the untyped client handed back — see lib/supabase/embed.ts for why that is `any` and what
 * naming the shape buys.
 */
type DuesPaymentRow = {
  id: string
  person_id: string
  people: unknown
  schedule_id: string | null
  dues_schedules: unknown
  amount_cents: number
  status: string
  payment_date: string
  payment_method: string
  payment_reference?: string | null
  notes: string | null
  created_at: string
  recorder: unknown
  reverses_id?: string | null
}

/**
 * Takes `unknown` rather than `DuesPaymentRow` because its two callers hand it rows
 * TypeScript has no useful type for, and both were previously absorbed by `p: any`:
 * `getAllDuesPayments` gets a `GenericStringError` union, which is supabase-js reporting
 * that it could not resolve the constraint-qualified select at the type level, and
 * `computeDonationTotals` gets `Record<string, unknown>` from its empty-array fallback.
 *
 * One cast, at the top, from `unknown` — not `as unknown as` at each call site. The shape
 * is asserted from the `.select()` string a few lines above each query, which is the only
 * place that truth exists while the client is untyped. Same bargain as lib/supabase/embed.ts.
 */
function mapPayment(row: unknown): DuesPayment {
  const p = row as DuesPaymentRow
  const schedule = embedOne<{ label: string; kind?: string | null }>(p.dues_schedules)
  const recorder = embedOne<PersonNameRow>(p.recorder)
  const person = embedOne<PersonNameRow>(p.people)
  return {
    id: p.id,
    person_id: p.person_id,
    person_name: person ? `${person.first_name} ${person.last_name}` : null,
    schedule_id: p.schedule_id,
    schedule_label: schedule?.label ?? null,
    schedule_kind: schedule ? (schedule.kind === 'donation' ? 'donation' : 'dues') : null,
    amount_cents: p.amount_cents,
    status: p.status,
    payment_date: p.payment_date,
    payment_method: p.payment_method,
    payment_reference: p.payment_reference ?? null,
    notes: p.notes,
    created_at: p.created_at,
    recorded_by_name: recorder ? `${recorder.first_name} ${recorder.last_name}`.trim() : null,
    reverses_id: p.reverses_id ?? null,
    reversed_by_id: null,
  }
}

/**
 * Which of this family's schedules have ledger rows against them.
 *
 * THE ADMIN CLIENT IS REQUIRED, and so is the family scoping beside it. dues_payments
 * RLS shows a member only their OWN rows, so through the user's client a treasurer
 * looking at a schedule everyone else has paid would see "never used" and be offered an
 * edit the database is about to refuse. The service role bypasses RLS entirely, which
 * is exactly why `.eq('family_code', familyCode)` has to be here by hand — the ids are
 * this family's, but nothing else would keep the aggregate to it.
 *
 * Only booleans come back. Who paid, when and how much stays inside this function.
 */
async function loadScheduleUsage(
  admin: AdminClient,
  familyCode: string,
): Promise<Record<string, ScheduleUsage>> {
  const { data } = await admin
    .from('dues_payments')
    .select('schedule_id, status')
    .eq('family_code', familyCode)
    .not('schedule_id', 'is', null)

  const usage: Record<string, ScheduleUsage> = {}
  for (const row of data ?? []) {
    const id = row.schedule_id as string
    const entry = usage[id] ?? { used: false, funded: false }
    entry.used = true
    if (row.status === 'paid') entry.funded = true
    usage[id] = entry
  }
  return usage
}

/**
 * Load active funds with allocation % and current balance, ordered for routing.
 *
 * SYSTEM FUNDS ARE EXCLUDED, and the exclusion is load-bearing rather than tidy. The
 * Donations fund (20260807000003) is a dedicated pot for gifts; leaving it in this pool
 * would let it collect dues, and `effectiveAllocations()` makes that the DEFAULT
 * outcome — with nothing configured it hands 100% to the highest-priority fund, so a
 * family that never touched the routing screen could have had every dues payment land
 * in Donations.
 */
async function getActiveFundsForRouting(admin: AdminClient, familyCode: string): Promise<RoutingFund[]> {
  const [fundsRes, allocRes, contribRes, disbRes, expRes, xferRes] = await Promise.all([
    admin.from('funds').select('id, priority, minimum_cents, created_at')
      .eq('family_code', familyCode).eq('active', true).is('system_key', null),
    admin.from('fund_allocations').select('fund_id, basis_points').eq('family_code', familyCode),
    admin.from('fund_contributions').select('fund_id, amount_cents').eq('family_code', familyCode),
    admin.from('fund_disbursements').select('fund_id, amount_cents').eq('family_code', familyCode),
    admin.from('event_expenses').select('fund_id, amount_cents').eq('family_code', familyCode),
    admin.from('fund_transfers').select('from_fund_id, to_fund_id, amount_cents').eq('family_code', familyCode),
  ])

  // THE BALANCE THE WATERFALL SEES IS THE FUND'S ACTUAL BALANCE, TODAY — the same sum
  // fund_balance_cents() and getFunds() compute, on the admin client so it cannot vary
  // with who is looking. That is what makes minimums behave the way a family expects:
  // money that routed into a fund STAYS there, a payout reduces that fund alone, and
  // the gap the payout opened is refilled by the NEXT payment, ahead of everything
  // below it. Nothing here re-derives where past money should have gone.
  //
  // Transfers are the fifth term and the only one that moves money BETWEEN funds after
  // routing, so leaving them out would make the waterfall refill a fund that has
  // already been topped up by hand — and drain past a minimum that has already been
  // emptied by hand.
  const bpsByFund = new Map<string, number>((allocRes.data ?? []).map(a => [a.fund_id, a.basis_points]))
  const balByFund = new Map<string, number>()
  const add = (id: string | null, delta: number) => { if (id) balByFund.set(id, (balByFund.get(id) ?? 0) + delta) }
  for (const c of contribRes.data ?? []) add(c.fund_id, c.amount_cents)
  for (const d of disbRes.data ?? []) add(d.fund_id, -d.amount_cents)
  for (const e of expRes.data ?? []) add(e.fund_id, -e.amount_cents)
  for (const t of xferRes.data ?? []) { add(t.to_fund_id, t.amount_cents); add(t.from_fund_id, -t.amount_cents) }

  return (fundsRes.data ?? [])
    .sort((a, b) =>
      a.priority - b.priority ||
      String(a.created_at).localeCompare(String(b.created_at)) ||
      a.id.localeCompare(b.id))
    .map(f => ({
      id: f.id,
      priority: f.priority,
      minimum_cents: f.minimum_cents,
      basis_points: bpsByFund.get(f.id) ?? 0,
      balance_cents: balByFund.get(f.id) ?? 0,
    }))
}

/**
 * Split a paid payment into fund_contributions and stamp routed_at. Idempotent on
 * routed_at.
 *
 * A DONATION DOES NOT GET SPLIT. It goes whole into the family's Donations fund — the
 * one 20260807000003 guarantees exists and refuses to let anyone delete. Before that
 * fund existed a gift went through the dues waterfall, so money given to the
 * Scholarship Drive was divided between the Reunion fund and whatever else the routing
 * table happened to say, and there was no pot whose balance answered "what have we been
 * given?".
 *
 * The kind comes from the caller, which read it off the schedule ROW — never from a
 * client — for the same reason the permission check does.
 */
async function routePaidPayment(
  admin: AdminClient,
  familyCode: string,
  payment: { id: string; amount_cents: number; payment_date: string; routed_at?: string | null },
  recordedBy: string | null,
  kind: ScheduleKind,
): Promise<void> {
  if (payment.routed_at) return
  if (!payment.amount_cents || payment.amount_cents <= 0) return

  if (kind === 'donation') {
    const { data: fund } = await admin
      .from('funds').select('id')
      .eq('family_code', familyCode).eq('system_key', 'donations')
      .maybeSingle()
    // Unreachable in a migrated database, and deliberately not fatal if it happens: the
    // payment is already posted and the member is already credited. Leaving routed_at
    // unstamped means a later call can still route it once the fund is there, which is
    // the better failure than losing the row.
    if (!fund) return
    await admin.from('fund_contributions').insert({
      fund_id: fund.id,
      family_code: familyCode,
      amount_cents: payment.amount_cents,
      source: 'dues_routing',
      dues_payment_id: payment.id,
      contributed_date: payment.payment_date,
      recorded_by: recordedBy,
    })
    await admin.from('dues_payments').update({ routed_at: new Date().toISOString() }).eq('id', payment.id)
    return
  }

  const funds = await getActiveFundsForRouting(admin, familyCode)
  const allocations = routeContribution(payment.amount_cents, funds)
  if (allocations.length > 0) {
    await admin.from('fund_contributions').insert(
      allocations.map(a => ({
        fund_id: a.fund_id,
        family_code: familyCode,
        amount_cents: a.amount_cents,
        source: 'dues_routing',
        dues_payment_id: payment.id,
        contributed_date: payment.payment_date,
        recorded_by: recordedBy,
      })),
    )
  }
  await admin.from('dues_payments').update({ routed_at: new Date().toISOString() }).eq('id', payment.id)
}

// ── Schedule actions (unchanged) ─────────────────────────────────────────────

/**
 * Every active schedule, dues AND donations. The Accounting admin page shows both
 * (on separate pages) and records payments against both, so it wants the lot;
 * callers that care about one kind filter on `kind`.
 */
export async function getDuesSchedules(): Promise<DuesSchedule[]> {
  const supabase = await createClient()
  // THE USER CLIENT IS DOING THE HIDING HERE. A drive the caller is a beneficiary of is
  // refused by the restrictive policy from 20260811000000 and simply does not come back
  // — there is no filter in this function to forget, and none should be added. The
  // embed is the beneficiary list for every drive that DID come back, which the
  // Accounting editor needs to render its "this drive is for" field.
  //
  // Only one foreign key joins donation_beneficiaries to dues_schedules, so a bare embed
  // is unambiguous here — unlike the two-path embeds AGENTS.md §8 warns about.
  const { data } = await supabase
    .from('dues_schedules')
    .select('*, donation_beneficiaries(person_id)')
    .eq('active', true)
    .order('label')
  return (data ?? []).map(mapSchedule)
}

/**
 * Replace a drive's beneficiary set.
 *
 * SERVICE ROLE, so AGENTS.md §3 applies twice over: `.eq('family_code', familyCode)` on
 * the delete, and every incoming person id verified against this family BEFORE it is
 * written. That second one is §4 — the row being inserted carries the caller's own
 * family_code and satisfies every policy, while the `person_id` it points at could be
 * anybody's. `upsertSpouse` and three others shipped exactly that bug.
 *
 * Delete-then-insert rather than a diff: the row is (schedule, person) and nothing else,
 * so there is no such thing as editing one. That is also why the table has no UPDATE
 * policy.
 *
 * Returns a message on refusal so the caller can surface it rather than half-saving.
 */
async function syncDonationBeneficiaries(
  admin: ReturnType<typeof createAdminClient>,
  scheduleId: string,
  familyCode: string,
  personIds: string[],
): Promise<{ ok: true } | { ok: false; message: string }> {
  // Deduplicated because the UNIQUE constraint would otherwise reject the whole insert
  // over a double-click, and empties dropped so a stray '' cannot reach the FK.
  const ids = [...new Set(personIds.filter(Boolean))]

  for (const personId of ids) {
    if (!(await belongsToFamily('people', personId, familyCode))) {
      return { ok: false, message: 'One of those people is not in this family.' }
    }
  }

  const { error: delError } = await admin
    .from('donation_beneficiaries')
    .delete()
    .eq('schedule_id', scheduleId)
    .eq('family_code', familyCode)
  if (delError) return { ok: false, message: delError.message }

  if (ids.length === 0) return { ok: true }

  const { error: insError } = await admin
    .from('donation_beneficiaries')
    .insert(ids.map(person_id => ({
      schedule_id: scheduleId,
      person_id,
      family_code: familyCode,
    })))
  // The guard trigger from 20260811000000 is what refuses a dues schedule, a
  // cross-family person or a mismatched family_code. Reaching it means the checks above
  // were bypassed or wrong, so the message is deliberately the raw one.
  if (insError) return { ok: false, message: insError.message }
  return { ok: true }
}

/**
 * The drives this caller is a beneficiary of, and so must not be shown.
 *
 * FOR SERVICE-ROLE READS ONLY. Anything going through `createClient()` is already
 * handled by the restrictive policies from 20260811000000 and must not filter twice —
 * a second filter there would be dead code that looks load-bearing. This exists because
 * `createAdminClient()` bypasses RLS entirely, so the admin-client reads have to re-apply
 * by hand what the policies would have done (AGENTS.md §3).
 *
 * An empty set for a caller with no person row: they are pending or not in this family,
 * and both are refused upstream rather than here.
 */
async function myHiddenDonationScheduleIds(
  admin: ReturnType<typeof createAdminClient>,
  familyCode: string,
  personId: string | null,
): Promise<Set<string>> {
  if (!personId) return new Set()
  const { data } = await admin
    .from('donation_beneficiaries')
    .select('schedule_id')
    .eq('family_code', familyCode)
    .eq('person_id', personId)
  return new Set((data ?? []).map(r => r.schedule_id as string))
}

/**
 * Which schedules have been transacted against, keyed by schedule id.
 *
 * Its own action rather than a field on DuesSchedule: the row shape is read on four
 * pages and this costs a second query, which only the Accounting editor needs. A
 * schedule missing from the map has no payments — the caller reads it as all-false.
 *
 * Gated on the same two grants that gate the schedules themselves, and for the same
 * reason: this is derived from the schedule list, and a server action is reachable on
 * its own whatever page renders it. Someone with neither grant gets nothing back.
 */
export async function getScheduleUsage(): Promise<Record<string, ScheduleUsage>> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return {}
  const [mayDues, mayDonations] = await Promise.all([
    can(user.id, 'admin/account/dues', 'view'),
    can(user.id, 'admin/account/donations', 'view'),
  ])
  if (!mayDues && !mayDonations) return {}
  const familyCode = await getMyFamilyCode(user.id)
  return loadScheduleUsage(createAdminClient(), familyCode)
}

/**
 * Returns the inserted row, not just a success flag: the admin page keeps its
 * schedule list in client state, so it needs the real row (with its real id) to
 * show the new schedule without waiting for — or depending on — a refetch.
 */
export async function createDuesSchedule(
  input: Omit<DuesSchedule, 'id' | 'active'>
): Promise<{ success: boolean; schedule?: DuesSchedule; message?: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { success: false, message: 'Not authenticated' }
  const familyCode = await getMyFamilyCode(user.id)
  // Never taken on trust: an unrecognized kind would be a schedule nobody owes and
  // nobody can donate to, invisible on both pages.
  const kind: ScheduleKind = input.kind === 'donation' ? 'donation' : 'dues'

  // Dues and Donations are separate sections of Accounting and separate grants, so
  // the kind decides which one is demanded — resolved above from the input, never
  // trusted as a permission claim, because the invariants below are forced onto the
  // row from the same value. Someone who may open a donation drive is not thereby
  // able to change what members owe.
  if (!(await canAny(user.id, SCHEDULE_RESOURCE[kind], 'create'))) {
    return { success: false, message: 'Not authorized' }
  }
  if (kind === 'donation' && !input.goal_cents) {
    return { success: false, message: 'A donation needs a goal to work toward' }
  }
  if (kind === 'dues' && !input.amount_cents) {
    return { success: false, message: 'Dues need an amount' }
  }

  // Pulled out of the spread: it is a join table, not a column, and spreading it onto
  // the insert would be a PostgREST error rather than a no-op. Dues never carry one —
  // a bill nobody can see is a bill that silently never gets paid, which is why the
  // guard trigger refuses the row as well as this line ignoring it.
  const { beneficiary_person_ids, ...columns } = input
  const beneficiaryIds = kind === 'donation' ? (beneficiary_person_ids ?? []) : []

  const { data, error } = await supabase
    .from('dues_schedules')
    .insert({
      ...columns,
      kind,
      ...kindInvariants(kind, input.goal_cents),
      family_code: familyCode,
      active: true,
    })
    .select('*')
    .single()
  if (error) return { success: false, message: error.message }

  // AFTER the insert, because the beneficiary rows point at the schedule that did not
  // exist until now. A failure here leaves a VISIBLE drive rather than a half-hidden
  // one, which is the right way round to fail: the treasurer is told, and nobody has
  // been shown something they should not see. Reported rather than swallowed for
  // exactly that reason — silence here would be a drive the beneficiary can read.
  if (beneficiaryIds.length > 0) {
    const synced = await syncDonationBeneficiaries(
      createAdminClient(), data.id as string, familyCode ?? '', beneficiaryIds,
    )
    if (!synced.ok) {
      return {
        success: false,
        message: `The drive was created, but it is VISIBLE TO EVERYONE — ${synced.message} Open it and set who it is for.`,
      }
    }
  }

  revalidatePath('/account-summary')
  revalidatePath('/admin/account')
  return { success: true, schedule: mapSchedule({ ...data, donation_beneficiaries: beneficiaryIds.map(person_id => ({ person_id })) }) }
}

export async function updateDuesSchedule(
  id: string,
  input: Partial<Omit<DuesSchedule, 'id'>>
): Promise<{ success: boolean; message?: string }> {
  const supabase = await createClient()
  const admin = createAdminClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { success: false, message: 'Not authenticated' }
  const familyCode = await getMyFamilyCode(user.id)

  // The row's own kind decides which fields are legal, so it is read rather than
  // taken from the caller — `kind` itself is not editable here. Without this an edit
  // posted from a stale form could give a donation an amount, and a donation with an
  // amount is a bill.
  //
  // Both statements are scoped to the caller's family: `admin` is the service-role
  // client and bypasses RLS, so an id is otherwise enough to edit another family's
  // schedule. The UI only ever sends ids it read from this family, but the action is
  // reachable on its own.
  const { data: existing } = await admin
    .from('dues_schedules')
    .select('kind, goal_cents, start_date, end_date, amount_cents, frequency')
    .eq('id', id).eq('family_code', familyCode).maybeSingle()
  if (!existing) return { success: false, message: 'Schedule not found' }
  const kind: ScheduleKind = existing.kind === 'donation' ? 'donation' : 'dues'

  // Gated on the ROW's kind, deliberately after it is read: this is family-wide
  // configuration with no personal copy to own, hence canAny. Checking before the read
  // would mean guessing the section from the caller's payload.
  if (!(await canAny(user.id, SCHEDULE_RESOURCE[kind], 'edit'))) {
    return { success: false, message: 'Not authorized' }
  }
  const goalCents = input.goal_cents === undefined ? existing.goal_cents : input.goal_cents
  if (kind === 'donation' && !goalCents) {
    return { success: false, message: 'A donation needs a goal to work toward' }
  }

  // ── Terms that stop being editable once the ledger has been posted against ──
  //
  // The trigger from 20260807000001 is what MAKES these rules true: this action writes
  // through the service-role client, so it is the only guard, and "the only guard" is
  // precisely what that migration exists not to rely on. Repeated here so a treasurer
  // gets a sentence rather than a raised database exception, and because the form is
  // built from the same facts via getScheduleUsage() — three statements of one rule,
  // deliberately, with the database as the one that decides.
  //
  // `undefined` means "not sent", which is not the same as "cleared to null": a partial
  // update that omits a field must not read as a change to it.
  const moved = <T>(sent: T | undefined, stored: T) =>
    sent !== undefined && (sent ?? null) !== (stored ?? null)
  const movingStart = moved(input.start_date, existing.start_date)
  const movingEnd = moved(input.end_date, existing.end_date)

  if (kind === 'dues' && movingEnd && input.end_date) {
    // Floor is yesterday, not today, and the day of slack is timezone skew rather than
    // laziness — see 20260807000001's header. `min` on the date input is what holds the
    // honest case to the browser's local today; this refuses a date that is past by
    // more than any offset could explain.
    const floor = new Date()
    floor.setUTCDate(floor.getUTCDate() - 1)
    if (input.end_date < floor.toISOString().slice(0, 10)) {
      return { success: false, message: 'The end date cannot be in the past.' }
    }
  }

  // Only looked up when something frozen is actually moving, so the ordinary edit —
  // a renamed due, a new end date — never touches the payments table.
  const movingTerms = movingStart
    || moved(input.amount_cents, existing.amount_cents)
    || moved(input.frequency, existing.frequency)
  if (movingTerms) {
    const usage = (await loadScheduleUsage(admin, familyCode))[id]
    if (kind === 'dues' && usage?.used) {
      return {
        success: false,
        message: 'Payments have been recorded against this due, so its start date, amount and frequency can no longer change. You can still change the end date.',
      }
    }
    if (kind === 'donation' && usage?.funded && movingStart) {
      return {
        success: false,
        message: 'This donation has received funds, so its start date can no longer change.',
      }
    }
  }

  // Same reason as on create: a join table cannot ride along in the column spread.
  // `undefined` means "not sent" and leaves the set alone; an explicit [] clears it,
  // which is how a drive stops being hidden from anyone.
  const { beneficiary_person_ids, ...columns } = input

  const { error } = await admin
    .from('dues_schedules')
    .update({ ...columns, kind, ...kindInvariants(kind, goalCents) })
    .eq('id', id)
    .eq('family_code', familyCode)
  if (error) return { success: false, message: error.message }

  if (kind === 'donation' && beneficiary_person_ids !== undefined) {
    const synced = await syncDonationBeneficiaries(
      admin, id, familyCode ?? '', beneficiary_person_ids,
    )
    if (!synced.ok) return { success: false, message: synced.message }
  }

  revalidatePath('/account-summary')
  revalidatePath('/admin/account')
  revalidatePath('/transactions')
  return { success: true }
}

export async function deleteDuesSchedule(id: string): Promise<{ success: boolean; message?: string }> {
  const supabase = await createClient()
  const admin = createAdminClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { success: false, message: 'Not authenticated' }
  const familyCode = await getMyFamilyCode(user.id)

  // Family-scoped for the same reason as the update above: the service-role client
  // does not apply RLS, so the id alone must not be enough. The row is read first so
  // its kind can choose the grant — deleting a schedule takes every member's
  // obligation with it, so it needs the unrestricted one.
  const { data: existing } = await admin
    .from('dues_schedules').select('kind').eq('id', id).eq('family_code', familyCode).maybeSingle()
  if (!existing) return { success: false, message: 'Schedule not found' }
  const kind: ScheduleKind = existing.kind === 'donation' ? 'donation' : 'dues'
  if (!(await canAny(user.id, SCHEDULE_RESOURCE[kind], 'delete'))) {
    return { success: false, message: 'Not authorized' }
  }

  const { error } = await admin.from('dues_schedules').delete().eq('id', id).eq('family_code', familyCode)
  if (error) return { success: false, message: error.message }
  revalidatePath('/admin/account')
  revalidatePath('/account-summary')
  return { success: true }
}

// ── Member dues summary + pay plans ──────────────────────────────────────────

export async function getMyDuesSummary(): Promise<DuesSummary[]> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return []

  // Dues are owed per family, so this must be the active family's person row.
  const myPersonId = await getMyPersonId(user.id)
  if (!myPersonId) return []
  const myPerson = { id: myPersonId }

  const [schedulesResult, paymentsResult, plansResult] = await Promise.all([
    supabase.from('dues_schedules').select('*').eq('active', true).order('label'),
    supabase.from('dues_payments').select('*').eq('person_id', myPerson.id).order('payment_date', { ascending: false }),
    supabase.from('dues_member_plans').select('schedule_id, cadence, opted_out').eq('person_id', myPerson.id),
  ])

  // Dues only. A donation is optional, so it must never reach a remaining balance, a
  // next-installment date or the dashboard's "you owe" card — every one of which is
  // computed from this list. Filtered here rather than in the query so a database
  // that has not run 20260805000002 yet still returns the member's real dues.
  const schedules: DuesSchedule[] = (schedulesResult.data ?? [])
    .map(mapSchedule)
    .filter(s => s.kind === 'dues')
  const payments: DuesPayment[] = (paymentsResult.data ?? [])
    .map(p => ({ ...p, person_name: null, schedule_label: null, schedule_kind: null }))
  const planBySchedule = new Map<string, PayCadence>(
    (plansResult.data ?? []).map(p => [p.schedule_id, p.cadence as PayCadence]),
  )
  // Which of the OPTIONAL dues this member has declined. `?? false` rather than a
  // required column read, so a database that has not run 20260807000003 reports nobody
  // opted out — which is true of it.
  const optedOutSchedules = new Set<string>(
    (plansResult.data ?? []).filter(p => p.opted_out).map(p => p.schedule_id as string),
  )

  return schedules.map(schedule => {
    const explicit = planBySchedule.get(schedule.id)
    const cadence = explicit ?? defaultCadence(schedule.frequency)
    // A required due cannot be opted out of, and the check is HERE as well as in the
    // trigger: a row that predates 20260807000003's guard, or one whose schedule was
    // made required after the member opted out, must read as owed rather than declined.
    const optedOut = !schedule.required && optedOutSchedules.has(schedule.id)
    const annual = annualTotalCents(schedule)
    const installment = installmentCents(annual, cadence)

    const scheduleRows = payments.filter(p => p.schedule_id === schedule.id)
    const schedulePaid = scheduleRows.filter(p => p.status === 'paid')
    const periodStart = currentPeriodStart(schedule)
    const paidThisPeriod = schedulePaid.filter(p => p.payment_date >= periodStart)
    // A WAIVED DUE IS SETTLED, so it comes off the balance alongside the money. Waiving
    // is the family forgiving the obligation — recordPayment refuses a method and a
    // reference on one precisely because nothing arrived — and an obligation nobody is
    // asking for any more is not a balance. Leaving it out was why waiving $50 changed
    // the ledger and left the member still owing $50.
    //
    // Same period window as a payment, and for the same reason: last year's forgiveness
    // does not settle this year's due. And the two are summed but never merged — see
    // amountWaivedThisPeriodCents on DuesSummary; only one of them is money.
    const waivedThisPeriod = scheduleRows.filter(
      p => p.status === 'waived' && p.payment_date >= periodStart,
    )
    const amountPaidThisPeriodCents = paidThisPeriod.reduce((s, p) => s + p.amount_cents, 0)
    const amountWaivedThisPeriodCents = waivedThisPeriod.reduce((s, p) => s + p.amount_cents, 0)
    const amountPaidTotalCents = schedulePaid.reduce((s, p) => s + p.amount_cents, 0)
    // Zeroed for a declined due: they owe nothing on it, and every total on the
    // dashboard and My Summary is built by summing this field.
    const remainingBalanceCents = optedOut
      ? 0
      : Math.max(0, annual - amountPaidThisPeriodCents - amountWaivedThisPeriodCents)
    const paid = remainingBalanceCents <= 0

    return {
      schedule,
      cadence,
      hasExplicitPlan: !!explicit,
      annualTotalCents: annual,
      installmentCents: installment,
      amountPaidThisPeriodCents,
      amountPaidTotalCents,
      amountWaivedThisPeriodCents,
      remainingBalanceCents,
      // Nothing is coming due on something they have declined.
      //
      // Waived rows count toward the installment tally as well as the balance: the
      // date is anchor + (settled installments × cadence step), and an installment the
      // family forgave is one the member is not being asked for again. Counting only
      // the paid ones would keep pointing at an installment that has been dealt with.
      nextInstallmentDate: paid || optedOut
        ? null
        : nextInstallmentDate(schedule, cadence, paidThisPeriod.length + waivedThisPeriod.length),
      paid,
      lastPayment: payments.find(p => p.schedule_id === schedule.id) ?? null,
      required: schedule.required,
      optedOut,
    }
  })
}

/**
 * The FAMILY's progress against each active donation drive, plus the reader's share.
 *
 * Same schedules table and same payments table as dues; none of the obligation maths.
 * There is no period to bucket by either — a drive runs from start_date to end_date
 * once, so "raised" is simply everything anyone has put in.
 *
 * WHY THE ADMIN CLIENT: dues_payments RLS shows a member only their own rows, so a
 * family-wide total is unreachable through the user's client. The service-role client
 * bypasses RLS entirely, which means the family scoping RLS would have done has to be
 * done HERE, explicitly — hence `.eq('family_code', familyCode)` on the payments read.
 *
 * WHAT COMES BACK: totals. The rows are summed inside this function and only the sums
 * cross the boundary, so a member sees how far the family has got without seeing who
 * gave what. `person_id` is selected solely to split the reader's own share back out
 * and never leaves here.
 *
 * Returns [] for a family with no donations configured, which is what lets the
 * My Summary section disappear entirely rather than sit there empty.
 */
export async function getDonationProgress(): Promise<DonationSummary[]> {
  const supabase = await createClient()
  const admin = createAdminClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return []

  const familyCode = await getMyFamilyCode(user.id)
  const myPersonId = await getMyPersonId(user.id)

  const { data: scheduleRows } = await supabase
    .from('dues_schedules').select('*').eq('active', true).order('label')
  const donations = (scheduleRows ?? []).map(mapSchedule).filter(s => s.kind === 'donation')
  if (donations.length === 0) return []

  // 'waived' has no meaning for a gift, so only real money counts toward a goal.
  const { data: paymentRows } = await admin
    .from('dues_payments')
    .select('schedule_id, person_id, amount_cents')
    .eq('family_code', familyCode)
    .eq('status', 'paid')
    .in('schedule_id', donations.map(d => d.id))

  const raisedBySchedule = new Map<string, number>()
  const mineBySchedule = new Map<string, number>()
  for (const p of paymentRows ?? []) {
    if (!p.schedule_id) continue
    raisedBySchedule.set(p.schedule_id, (raisedBySchedule.get(p.schedule_id) ?? 0) + p.amount_cents)
    if (myPersonId && p.person_id === myPersonId) {
      mineBySchedule.set(p.schedule_id, (mineBySchedule.get(p.schedule_id) ?? 0) + p.amount_cents)
    }
  }

  const today = new Date().toISOString().slice(0, 10)

  return donations.map(schedule => {
    const raisedCents = raisedBySchedule.get(schedule.id) ?? 0
    const goalCents = schedule.goal_cents
    return {
      schedule,
      goalCents,
      raisedCents,
      myGivenCents: mineBySchedule.get(schedule.id) ?? 0,
      // Unclamped on purpose: a drive that doubled its goal reports 200, and the bar
      // is drawn past the goal mark to match. Capping it here would hide the best
      // thing that can happen to a fundraiser.
      progressPercent: goalCents && goalCents > 0 ? Math.round((raisedCents / goalCents) * 100) : 0,
      goalMet: goalCents != null && goalCents > 0 && raisedCents >= goalCents,
      closed: schedule.end_date != null && schedule.end_date < today,
    }
  })
}

export async function setMyDuesPlan(
  scheduleId: string,
  cadence: PayCadence,
): Promise<{ success: boolean; message?: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { success: false, message: 'Not authenticated' }
  const familyCode = await getMyFamilyCode(user.id)
  const myPersonId = await getMyPersonId(user.id)
  if (!myPersonId) return { success: false, message: 'Profile not found' }
  const myPerson = { id: myPersonId }

  // scheduleId comes from the client. The plan row below is stamped with the
  // caller's OWN family_code, so RLS is satisfied no matter which family the
  // schedule belongs to — this check is the only thing stopping a member of one
  // family enrolling against another family's schedule.
  if (!(await belongsToFamily('dues_schedules', scheduleId, familyCode))) {
    return { success: false, message: 'Schedule not found' }
  }

  const { error } = await supabase
    .from('dues_member_plans')
    .upsert(
      { person_id: myPerson.id, schedule_id: scheduleId, cadence, family_code: familyCode, created_by: myPerson.id },
      { onConflict: 'person_id,schedule_id' },
    )
  if (error) return { success: false, message: error.message }
  revalidatePath('/account-summary')
  revalidatePath('/dashboard')
  return { success: true }
}

/**
 * Drop the caller's chosen cadence for one schedule, reverting to the default.
 *
 * Self-service under requireMember() semantics: choosing monthly versus annual is a
 * display preference, not an adjustment to a due. It changes no ledger row and no
 * annual obligation — only the installment size and next-due date shown back to the
 * member — so it needs no grant. It still owes the two checks a self-service action
 * always owes: the row is genuinely the caller's, and the id from the client belongs
 * to their family.
 *
 * The family check was missing entirely. `person_id` scoped the delete to the caller,
 * so nothing could be destroyed cross-family, but a scheduleId from another family
 * would silently match nothing and report success — and the moment this action grows
 * an upsert it becomes a real hole. Checked here rather than trusted.
 */
/**
 * Decline an OPTIONAL due, or take it back on.
 *
 * Self-service under requireMember() semantics, like setMyDuesPlan beside it: `create`
 * and `edit` default to scope 'none', so demanding a grant would mean no member could
 * ever exercise a choice the family has explicitly offered them. It still owes the two
 * checks every self-service action owes, and both are here:
 *
 *   * the row is genuinely the caller's — person_id is their own, never a parameter;
 *   * the id from the client belongs to their family — belongsToFamily, because the
 *     upsert below stamps the caller's OWN family_code, which satisfies RLS whichever
 *     family the schedule actually lives in (AGENTS.md §4).
 *
 * And one more that is specific to this action: a REQUIRED due cannot be declined. The
 * database refuses it too (dues_member_plans_optout_allowed), which is the layer that
 * actually holds — this check exists so the member is told why rather than watching a
 * raised exception. Read from the schedule ROW, never taken from the caller.
 */
export async function setMyDuesOptOut(
  scheduleId: string,
  optedOut: boolean,
): Promise<{ success: boolean; message?: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { success: false, message: 'Not authenticated' }
  const familyCode = await getMyFamilyCode(user.id)
  const myPersonId = await getMyPersonId(user.id)
  if (!myPersonId) return { success: false, message: 'Profile not found' }

  if (!(await belongsToFamily('dues_schedules', scheduleId, familyCode))) {
    return { success: false, message: 'Schedule not found' }
  }

  // Family-scoped on the admin client for the same reason every other read of a
  // client-supplied id is: the service role applies no RLS. belongsToFamily above has
  // already established the family; this reads what the row SAYS.
  const admin = createAdminClient()
  const { data: schedule } = await admin
    .from('dues_schedules').select('kind, required, label')
    .eq('id', scheduleId).eq('family_code', familyCode).maybeSingle()
  if (!schedule) return { success: false, message: 'Schedule not found' }
  if (schedule.kind === 'donation') {
    // Nothing to decline: nobody owes a donation in the first place.
    return { success: false, message: 'Donations are already optional — there is nothing to opt out of.' }
  }
  if (optedOut && schedule.required !== false) {
    return {
      success: false,
      message: `${schedule.label} is a required due, so it cannot be opted out of.`,
    }
  }

  const { error } = await supabase
    .from('dues_member_plans')
    .upsert(
      {
        person_id: myPersonId,
        schedule_id: scheduleId,
        opted_out: optedOut,
        family_code: familyCode,
        created_by: myPersonId,
      },
      { onConflict: 'person_id,schedule_id' },
    )
  if (error) return { success: false, message: error.message }
  revalidatePath('/account-summary')
  revalidatePath('/dashboard')
  return { success: true }
}

export async function clearMyDuesPlan(scheduleId: string): Promise<{ success: boolean; message?: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { success: false, message: 'Not authenticated' }
  const familyCode = await getMyFamilyCode(user.id)
  const myPersonId = await getMyPersonId(user.id)
  if (!myPersonId) return { success: false, message: 'Profile not found' }
  const myPerson = { id: myPersonId }

  if (!(await belongsToFamily('dues_schedules', scheduleId, familyCode))) {
    return { success: false, message: 'Schedule not found' }
  }

  const { error } = await supabase
    .from('dues_member_plans')
    .delete()
    .eq('person_id', myPerson.id)
    .eq('family_code', familyCode)
    .eq('schedule_id', scheduleId)
  if (error) return { success: false, message: error.message }
  revalidatePath('/account-summary')
  revalidatePath('/dashboard')
  return { success: true }
}

// ── Payments ─────────────────────────────────────────────────────────────────

export async function getAllDuesPayments(): Promise<DuesPayment[]> {
  const supabase = await createClient()
  // Three embeds, and the two into `people` are BOTH constraint-qualified: dues_payments
  // has two foreign keys there (person_id, recorded_by), so a bare `people(...)` is
  // PGRST201 and PostgREST refuses the whole query — which reads as an empty ledger
  // rather than an error (AGENTS.md §8). `recorder:` aliases the second so they do not
  // collide on one key.
  const { data } = await supabase
    .from('dues_payments')
    .select(
      '*, people!dues_payments_person_id_fkey(first_name, last_name)'
      + ', recorder:people!dues_payments_recorded_by_fkey(first_name, last_name)'
      + ', dues_schedules(label, kind)',
    )
    .order('payment_date', { ascending: false })

  const rows = (data ?? []).map(mapPayment)
  // Back-link each original to the reversal that cancels it, so the ledger can mark
  // it rather than silently showing two rows that happen to sum to zero.
  const reversedBy = new Map(rows.filter(r => r.reverses_id).map(r => [r.reverses_id as string, r.id]))
  return rows.map(r => ({ ...r, reversed_by_id: reversedBy.get(r.id) ?? null }))
}

/**
 * What the family has actually collected, in cents — the Dashboard's "Dues Collected"
 * tile and nothing else.
 *
 * RETURNS `null` FOR ANYONE WITHOUT A LEDGER GRANT, and that is the whole point of the
 * function rather than an edge case. `dues_payments`'s SELECT policy opens with
 * `person_id = auth_person_id()` — the clause that makes My Summary work regardless of
 * every grant beneath it — so a plain sum through the user client returns a member their
 * OWN payments when they hold nothing. Rendering that under the caption "Dues Collected"
 * would tell a member their $50 was the family's entire year. So the grant is checked
 * first and the query is not run at all without it.
 *
 * `canAny`, not `can`. A family-wide total has no coherent "own" version — the row a
 * member would own is precisely the misreading above — which is the case AGENTS.md names
 * for this helper. It also matches the policy, which tests `= 'any'` on both ledger keys
 * for the same reason `components/admin/resource-groups.ts` drops the 'own' button for
 * every `transactions/` key.
 *
 * EITHER ledger admits it, mirroring the policy exactly. dues_payments holds dues and
 * donations together, split by `dues_schedules.kind`, and the policy cannot separate them
 * — see 20260808000001, which explains why at length. So this total is dues AND donations
 * collected, and the tile says "Dues Collected" because that is the caption on the screen
 * it links to; if the two are ever split, they split here and in the policy together.
 *
 * THE USER CLIENT, DELIBERATELY, not the admin one. RLS already does the family isolation
 * and the grant check, so reaching past it would mean re-implementing both by hand for no
 * gain (AGENTS.md §3). There is no `.eq('family_code', …)` here because there must not be
 * one: `auth_family_code()` in the policy is the authority, and a second copy in the query
 * is a second thing to get wrong.
 *
 * `status = 'paid'` only. 'waived' settles an obligation without money arriving, and
 * 'pending' has not arrived yet. Reversals need no special handling: the ledger is
 * append-only and `reversePayment` writes `-original.amount_cents`, so they net out in the
 * sum for free.
 */
export async function getFamilyDuesCollected(): Promise<number | null> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const entitled =
    (await canAny(user.id, 'transactions/dues-payments', 'view'))
    || (await canAny(user.id, 'transactions/donation-payments', 'view'))
  if (!entitled) return null

  // `error` is read rather than discarded. `const { data }` alone turns a refused query
  // into `[]`, and `[]` sums to 0 — so a broken query would render "$0 collected" over a
  // year of payments, which is worse than rendering nothing (AGENTS.md §8).
  const { data, error } = await supabase
    .from('dues_payments')
    .select('amount_cents')
    .eq('status', 'paid')

  if (error) return null
  return (data ?? []).reduce((sum, row) => sum + (row.amount_cents ?? 0), 0)
}

export async function getMyPaymentHistory(): Promise<DuesPayment[]> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return []

  const myPersonId = await getMyPersonId(user.id)
  if (!myPersonId) return []
  const myPerson = { id: myPersonId }

  // No recorder embed, deliberately. This is the member's own history behind My Summary,
  // and who keyed the payment in is treasurer bookkeeping the member has no use for.
  // Not fetching it is the point rather than not rendering it: props are serialized into
  // the RSC payload and reach the browser whether a component reads them or not
  // (AGENTS.md §5), so leaving the embed out is what actually keeps it off the page.
  // mapPayment then resolves recorded_by_name to null on its own.
  const { data } = await supabase
    .from('dues_payments')
    .select('*, dues_schedules(label, kind)')
    .eq('person_id', myPerson.id)
    .order('payment_date', { ascending: false })

  // Dues and donations both live here, tagged by schedule_kind so the member's
  // history can say which each row was.
  return (data ?? []).map(p => ({ ...mapPayment(p), person_name: null }))
}

/**
 * `schedule_id` is required. A payment with no schedule never shows up in
 * getMyDuesSummary (which buckets strictly by schedule_id) or in a member's
 * remaining balance, so recording one is silently useless — the admin sees it in
 * Payment History and the member's dues never move.
 *
 * THIS IS THE MANUAL-ENTRY ENDPOINT, and the validation below is scoped to that. It
 * demands a method and a reference for money it is told arrived, because this row is
 * the only record that the cheque or the handover ever existed — the same argument
 * `recordFundContribution` has always made, applied to the ledger that was missing it.
 *
 * It also refuses status 'pending'. Nothing manual is pending: a treasurer typing a
 * payment in is recording something that already happened, and the two honest outcomes
 * are that the money came ('paid') or that the family let it go ('waived'). 'pending'
 * remains a legal state in the TABLE and the pending -> paid settlement remains open in
 * 20260806000002's trigger, because that is the shape an online-payment webhook needs:
 * insert at checkout, settle on confirmation. That path will have its own entry point,
 * and it is not this one.
 */
export async function recordPayment(input: {
  person_id: string
  schedule_id: string
  amount_cents: number
  status: 'paid' | 'pending' | 'waived'
  payment_date: string
  payment_method: string | null
  payment_reference: string | null
  notes: string | null
}): Promise<{ success: boolean; message?: string }> {
  const admin = createAdminClient()
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { success: false, message: 'Not authenticated' }
  const familyCode = await getMyFamilyCode(user.id)
  const { data: myPerson } = await supabase
    .from('people').select('id')
    .eq('user_id', user.id)
    .eq('family_code', familyCode)
    .maybeSingle()
  if (!myPerson) return { success: false, message: 'Profile not found' }

  // Required, and re-scoped to this family here: the insert below runs on the admin
  // client, which bypasses RLS, so nothing else would stop a schedule id belonging
  // to another family from being written onto this family's payment.
  //
  // `kind` is read from the schedule ROW, never from the client: it decides which
  // permission is demanded, so accepting it as an argument would let a caller with
  // only donation rights post a dues payment by mislabelling it.
  if (!input.schedule_id) return { success: false, message: 'A dues schedule is required' }
  const { data: schedule } = await admin
    .from('dues_schedules')
    .select('id, kind')
    .eq('id', input.schedule_id)
    .eq('family_code', familyCode)
    .maybeSingle()
  if (!schedule) return { success: false, message: 'Dues schedule not found' }

  // A drive's beneficiary may not record against it, and the wording is the same
  // "not found" the line above gives — telling them the id is real but forbidden is
  // telling them a drive exists that they are not supposed to know about.
  //
  // THIS READ IS ON THE ADMIN CLIENT, so the restrictive policies from 20260811000000
  // do not apply and this is the only thing standing here (AGENTS.md §3). The id can
  // only have come from outside the UI — the drive is absent from every list this
  // caller can fetch — so reaching this line at all means a forged or stale argument.
  const { data: hiddenFromMe } = await admin
    .from('donation_beneficiaries')
    .select('id')
    .eq('schedule_id', schedule.id)
    .eq('person_id', myPerson.id)
    .eq('family_code', familyCode)
    .maybeSingle()
  if (hiddenFromMe) return { success: false, message: 'Dues schedule not found' }

  // Recording a payment asserts that money changed hands. The person who OWES it does
  // not get to make that assertion — basic accounting, and the reason the old
  // self-payment branch is gone. The member-facing path is Pay Online, where a
  // processor attests instead of the member.
  //
  // The branch this replaces was also a live privilege escalation:
  //     if (!(await can(user.id, 'dues', 'edit')) && input.person_id !== myPerson.id)
  // can() is TRUE for scope 'own', so an own-scoped grant made the first operand false,
  // short-circuited the && , and authorised recording a payment for ANYONE.
  // (That `dues` key no longer exists at all — 20260808000001 retired it.)
  //
  // canAny, not can: these records have no coherent "own" version — a payment recorded
  // for yourself is precisely the abuse case.
  const kind: ScheduleKind = schedule.kind === 'donation' ? 'donation' : 'dues'
  const resource = kind === 'donation'
    ? 'transactions/donation-payments'
    : 'transactions/dues-payments'
  if (!(await canAny(user.id, resource, 'create'))) {
    return {
      success: false,
      message: kind === 'donation'
        ? 'You do not have permission to record donation payments.'
        : 'You do not have permission to record dues payments.',
    }
  }

  // The person being credited must be in this family. person_id is client-supplied and
  // is written onto a row stamped with the caller's own family_code, which satisfies
  // RLS regardless of where that person actually lives.
  if (!(await belongsToFamily('people', input.person_id, familyCode))) {
    return { success: false, message: 'Member not found' }
  }

  // ── What a manual entry is allowed to say happened ──
  //
  // Which statuses are open depends on the kind, and the kind came from the schedule
  // ROW above rather than the caller. Waiving a donation is meaningless — nobody owed
  // it, so there is nothing to forgive — which leaves a gift with exactly one outcome
  // worth recording. The form hides the field entirely for that reason; this is what
  // makes the hidden field true rather than merely absent.
  const allowed: readonly string[] = kind === 'donation' ? ['paid'] : ['paid', 'waived']
  if (!allowed.includes(input.status)) {
    return {
      success: false,
      message: kind === 'donation'
        ? 'A donation payment can only be recorded as paid.'
        : 'A dues payment can only be recorded as paid or waived.',
    }
  }

  // Method and reference are required for money that ARRIVED, and forced empty for
  // money that did not. A waived due has no cheque to number: carrying "Cash" and a
  // reference on it would put a payment that never happened into the evidence trail,
  // and the ledger's whole value is that its rows mean what they say.
  const waived = input.status === 'waived'
  const method = waived ? null : (input.payment_method?.trim() || null)
  const reference = waived ? null : (input.payment_reference?.trim() || null)
  if (!waived) {
    if (!method) return { success: false, message: 'Record how the payment was made' }
    if (!reference) return { success: false, message: 'Record a check number or reference for the payment' }
  }

  const { data: payment, error } = await admin.from('dues_payments').insert({
    family_code: familyCode,
    person_id: input.person_id,
    schedule_id: input.schedule_id,
    amount_cents: input.amount_cents,
    status: input.status,
    payment_date: input.payment_date,
    payment_method: method,
    payment_reference: reference,
    notes: input.notes,
    recorded_by: myPerson.id,
  }).select('id, amount_cents, payment_date, routed_at').single()
  if (error || !payment) return { success: false, message: error?.message ?? 'Failed to record payment' }

  // Route the money. Only paid payments contribute — dues split across the funds by the
  // routing table, a donation goes whole into the Donations fund.
  if (input.status === 'paid') {
    await routePaidPayment(admin, familyCode, payment, myPerson.id, kind)
  }

  revalidatePath('/account-summary')
  revalidatePath('/admin/account')
  revalidatePath('/family-finances')
  revalidatePath('/dashboard')
  return { success: true }
}

/**
 * Post a correcting entry against a payment.
 *
 * dues_payments is append-only — 20260806000002 enforces that with a trigger the
 * service role cannot bypass — so a mis-keyed amount is corrected by posting an equal
 * and opposite row, never by editing or deleting the original. Both stay visible,
 * which is the point: the ledger records what happened, including the mistake.
 *
 * THE MIRROR IS NOT A RE-RUN OF THE WATERFALL. A paid payment was split across funds
 * by routePaidPayment using the fund priorities in force AT THE TIME. Reversing it
 * must undo THAT split, so this negates the fund_contributions rows the original
 * actually produced. Re-running routeContribution would allocate against today's
 * priorities and balances, quietly moving money between funds with no record of a
 * transfer.
 */
export async function reversePayment(
  paymentId: string,
  reason: string,
): Promise<{ success: boolean; message?: string }> {
  const admin = createAdminClient()
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { success: false, message: 'Not authenticated' }
  const familyCode = await getMyFamilyCode(user.id)
  const myPersonId = await getMyPersonId(user.id)
  if (!myPersonId) return { success: false, message: 'Profile not found' }

  // Its own grant: undoing a posting is not the same authority as making one.
  if (!(await canAny(user.id, 'transactions/reversals', 'create'))) {
    return { success: false, message: 'You do not have permission to reverse payments.' }
  }

  // Read the original family-scoped — the id is client-supplied and this runs on the
  // service role, so `.eq('id', …)` alone would reach another family's ledger.
  const { data: original } = await admin
    .from('dues_payments')
    .select('id, person_id, schedule_id, amount_cents, status, payment_date, reverses_id')
    .eq('id', paymentId)
    .eq('family_code', familyCode)
    .maybeSingle()
  if (!original) return { success: false, message: 'Payment not found' }

  if (original.reverses_id) {
    return { success: false, message: 'That row is itself a reversal.' }
  }

  // The unique index on reverses_id is the real guard against double-reversal; this
  // check exists to say so in words rather than as a constraint violation.
  const { data: existing } = await admin
    .from('dues_payments')
    .select('id')
    .eq('reverses_id', paymentId)
    .maybeSingle()
  if (existing) return { success: false, message: 'That payment has already been reversed.' }

  const { data: reversal, error } = await admin.from('dues_payments').insert({
    family_code:    familyCode,
    person_id:      original.person_id,
    schedule_id:    original.schedule_id,
    amount_cents:   -original.amount_cents,
    status:         original.status,
    payment_date:   new Date().toISOString().split('T')[0],
    payment_method: null,
    notes:          reason?.trim() ? `Reversal: ${reason.trim()}` : 'Reversal',
    recorded_by:    myPersonId,
    reverses_id:    original.id,
    // Stamped immediately: the mirror below IS this row's routing, so the waterfall
    // must never run against it.
    routed_at:      new Date().toISOString(),
  }).select('id').single()
  if (error || !reversal) {
    return { success: false, message: error?.message ?? 'Failed to post the reversal' }
  }

  // Negate exactly what the original produced, fund by fund.
  const { data: originalRouting } = await admin
    .from('fund_contributions')
    .select('fund_id, amount_cents')
    .eq('family_code', familyCode)
    .eq('dues_payment_id', original.id)

  if (originalRouting?.length) {
    await admin.from('fund_contributions').insert(
      originalRouting.map(c => ({
        fund_id:          c.fund_id,
        family_code:      familyCode,
        amount_cents:     -c.amount_cents,
        source:           'reversal',
        dues_payment_id:  reversal.id,
        contributed_date: new Date().toISOString().split('T')[0],
        recorded_by:      myPersonId,
      })),
    )
  }

  revalidatePath('/account-summary')
  revalidatePath('/transactions')
  revalidatePath('/admin/account')
  revalidatePath('/family-finances')
  revalidatePath('/dashboard')
  return { success: true }
}

// ── P&L ────────────────────────────────────────────────────────────────────

export async function getFamilyPnL(): Promise<PnLData> {
  const empty: PnLData = {
    totalIncomeCents: 0, totalContributionsCents: 0, totalCollectedCents: 0,
    totalExpenseCents: 0, netCents: 0,
    payments: [], routing: [], funds: [], events: [],
  }
  const supabase = await createClient()
  const admin = createAdminClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return empty
  const familyCode = await getMyFamilyCode(user.id)

  const [fundsRes, contribRes, disbRes, budgetItemsRes, expensesRes, eventsRes] = await Promise.all([
    admin.from('funds').select('id, name, event_id, priority').eq('family_code', familyCode),
    admin.from('fund_contributions').select('fund_id, amount_cents, source, dues_payment_id').eq('family_code', familyCode),
    admin.from('fund_disbursements').select('fund_id, amount_cents').eq('family_code', familyCode),
    admin.from('event_budget_items').select('id, event_id, title, budget_cents').eq('family_code', familyCode),
    admin.from('event_expenses').select('event_id, budget_item_id, fund_id, amount_cents').eq('family_code', familyCode),
    admin.from('events').select('id, name').eq('family_code', familyCode).is('parent_event_id', null),
  ])

  // Paid dues AND donations for the family — both are rows in dues_payments, and
  // both are money the family actually collected. dues_payments has TWO foreign keys to people
  // (person_id and recorded_by), so the people embed MUST be disambiguated to
  // person_id — otherwise PostgREST errors and the result is silently empty.
  const PAYMENT_SELECT = '*, people!person_id(first_name, last_name), dues_schedules(label, kind)'
  const routedPaymentIds = [...new Set(
    (contribRes.data ?? [])
      .filter(c => c.source === 'dues_routing' && c.dues_payment_id)
      .map(c => c.dues_payment_id as string),
  )]
  const [byFamilyRes, byRoutedRes] = await Promise.all([
    admin.from('dues_payments').select(PAYMENT_SELECT).eq('family_code', familyCode).eq('status', 'paid'),
    routedPaymentIds.length
      ? admin.from('dues_payments').select(PAYMENT_SELECT).in('id', routedPaymentIds).eq('status', 'paid')
      : Promise.resolve({ data: [] as Record<string, unknown>[] }),
  ])
  const paymentById = new Map<string, Record<string, unknown>>()
  for (const p of (byFamilyRes.data ?? [])) paymentById.set(p.id as string, p)
  for (const p of (byRoutedRes.data ?? [])) paymentById.set(p.id as string, p)

  const allPayments: DuesPayment[] = [...paymentById.values()]
    .map(mapPayment)
    .sort((a, b) => b.payment_date.localeCompare(a.payment_date))

  // THE TOTAL IS COMPUTED BEFORE THE ROWS ARE FILTERED, and that order is the whole
  // decision. A drive's beneficiary loses the ROWS — the label, the giver, the amount,
  // anything that would spoil a surprise — and keeps a truthful family income figure.
  //
  // The alternative was netting the gift out of the total too, which would mean two
  // members of one family being shown two different incomes for the same bank account
  // with neither told which. A treasurer reconciling against a statement has to be able
  // to trust this number. So the cost is accepted openly: for a beneficiary the listed
  // rows do not add up to the headline, and an unexplained few hundred pounds is a far
  // weaker signal than "Gift for Martha — £450".
  const totalIncomeCents = allPayments.reduce((s, p) => s + (p.amount_cents ?? 0), 0)

  // Service-role reads throughout this function, so the policies never ran — see
  // myHiddenDonationScheduleIds.
  const hidden = await myHiddenDonationScheduleIds(
    admin, familyCode ?? '', await getMyPersonId(user.id),
  )
  const payments = hidden.size === 0
    ? allPayments
    : allPayments.filter(p => !p.schedule_id || !hidden.has(p.schedule_id))

  // Money collected outside of dues (admin top-ups + member contributions).
  const totalContributionsCents = (contribRes.data ?? [])
    .filter(c => c.source !== 'dues_routing')
    .reduce((s, c) => s + (c.amount_cents ?? 0), 0)
  const totalCollectedCents = totalIncomeCents + totalContributionsCents

  const fundNameById = new Map<string, string>((fundsRes.data ?? []).map(f => [f.id, f.name]))
  const fundPriorityById = new Map<string, number>((fundsRes.data ?? []).map(f => [f.id, f.priority ?? 100]))
  const eventNameById = new Map<string, string>((eventsRes.data ?? []).map(e => [e.id, e.name]))
  const backingFundByEvent = new Map<string, string>()  // event_id → fund_id
  for (const f of fundsRes.data ?? []) if (f.event_id) backingFundByEvent.set(f.event_id, f.id)
  const scheduleLabelByPayment = new Map<string, string | null>(payments.map(p => [p.id, p.schedule_label]))

  // ── Routing: contributions grouped by fund, with a per-source breakdown ──
  const contribByFund = new Map<string, { total: number; sources: Map<string, number> }>()
  for (const c of contribRes.data ?? []) {
    const entry = contribByFund.get(c.fund_id) ?? { total: 0, sources: new Map<string, number>() }
    entry.total += c.amount_cents
    const label = c.source === 'admin_manual'
      ? 'Manual contribution'
      : c.source === 'member_contribution'
        ? 'Member contribution'
        : (c.dues_payment_id ? (scheduleLabelByPayment.get(c.dues_payment_id) ?? 'General dues') : 'General dues')
    entry.sources.set(label, (entry.sources.get(label) ?? 0) + c.amount_cents)
    contribByFund.set(c.fund_id, entry)
  }
  const routing: PnLRoutingFund[] = [...contribByFund.entries()].map(([fundId, entry]) => ({
    fundId,
    fundName: fundNameById.get(fundId) ?? 'Unknown fund',
    contributedCents: entry.total,
    bySource: [...entry.sources.entries()].map(([label, cents]) => ({ label, cents })).sort((a, b) => b.cents - a.cents),
  })).sort((a, b) => b.contributedCents - a.contributedCents)

  // ── Fund balances ──
  const disbByFund = new Map<string, number>()
  for (const d of disbRes.data ?? []) disbByFund.set(d.fund_id, (disbByFund.get(d.fund_id) ?? 0) + d.amount_cents)
  const expByFund = new Map<string, number>()
  for (const e of expensesRes.data ?? []) if (e.fund_id) expByFund.set(e.fund_id, (expByFund.get(e.fund_id) ?? 0) + e.amount_cents)

  const funds: PnLFundBalance[] = (fundsRes.data ?? []).map(f => {
    const contributed = contribByFund.get(f.id)?.total ?? 0
    const disbursed = disbByFund.get(f.id) ?? 0
    const expensed = expByFund.get(f.id) ?? 0
    return {
      fundId: f.id,
      fundName: f.name,
      contributedCents: contributed,
      disbursedCents: disbursed,
      expensedCents: expensed,
      balanceCents: contributed - disbursed - expensed,
    }
  }).sort((a, b) =>
    (fundPriorityById.get(a.fundId) ?? 100) - (fundPriorityById.get(b.fundId) ?? 100) ||
    a.fundName.localeCompare(b.fundName))

  // ── Event ledger ──
  const spentByItem = new Map<string, number>()
  const spentByEvent = new Map<string, number>()
  const unbudgetedByEvent = new Map<string, number>()
  for (const e of expensesRes.data ?? []) {
    spentByEvent.set(e.event_id, (spentByEvent.get(e.event_id) ?? 0) + e.amount_cents)
    if (e.budget_item_id) spentByItem.set(e.budget_item_id, (spentByItem.get(e.budget_item_id) ?? 0) + e.amount_cents)
    else unbudgetedByEvent.set(e.event_id, (unbudgetedByEvent.get(e.event_id) ?? 0) + e.amount_cents)
  }
  const itemsByEvent = new Map<string, { id: string; title: string; budgetedCents: number; spentCents: number }[]>()
  for (const item of budgetItemsRes.data ?? []) {
    const list = itemsByEvent.get(item.event_id) ?? []
    list.push({ id: item.id, title: item.title, budgetedCents: item.budget_cents, spentCents: spentByItem.get(item.id) ?? 0 })
    itemsByEvent.set(item.event_id, list)
  }

  const eventIds = new Set<string>([...itemsByEvent.keys(), ...spentByEvent.keys()])
  const events: PnLEvent[] = [...eventIds].map(eventId => {
    const lineItems = itemsByEvent.get(eventId) ?? []
    const backingFundId = backingFundByEvent.get(eventId) ?? null
    return {
      eventId,
      eventName: eventNameById.get(eventId) ?? 'Unknown event',
      backingFundId,
      backingFundName: backingFundId ? (fundNameById.get(backingFundId) ?? null) : null,
      lineItems,
      totalBudgetedCents: lineItems.reduce((s, i) => s + i.budgetedCents, 0),
      totalSpentCents: spentByEvent.get(eventId) ?? 0,
      unbudgetedSpentCents: unbudgetedByEvent.get(eventId) ?? 0,
    }
  }).sort((a, b) => a.eventName.localeCompare(b.eventName))

  const totalExpenseCents = (expensesRes.data ?? []).reduce((s, e) => s + e.amount_cents, 0)

  return {
    totalIncomeCents,
    totalContributionsCents,
    totalCollectedCents,
    totalExpenseCents,
    netCents: totalCollectedCents - totalExpenseCents,
    payments,
    routing,
    funds,
    events,
  }
}
