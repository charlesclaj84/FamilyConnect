'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { canAny } from '@/lib/auth/permissions'
import { requireScope } from '@/lib/auth/guard'
import { getMyFamilyCode, getMyPersonId, belongsToFamily } from '@/lib/auth/family'
import { createAdminClient } from '@/lib/supabase/admin'
import { moneyAttachedTo, moneyAttachedMessage } from '@/lib/money-attached'
import { effectiveAllocations } from '@/lib/fund-routing'
import { embedMany } from '@/lib/supabase/embed'
import { formatCurrency } from '@/lib/currency-utils'
import { currentUser } from '@/lib/auth/current-user'

export interface Fund {
  id: string
  name: string
  description: string | null
  goal_cents: number | null
  active: boolean
  created_at: string
  priority: number
  minimum_cents: number
  open_contributions: boolean
  /**
   * Set when the application depends on this fund existing. 'donations' holds every
   * donation the family receives (20260807000003).
   *
   * A fund with a system_key cannot be deleted or switched off, so the UI hides its delete
   * control. That is now the WHOLE of what the flag withholds.
   *
   * IT USED TO ALSO MEAN "takes no share of dues — the routing screen omits it", and that
   * stopped being true on 2026-08-20: the Donations fund is in the routing table and in the
   * waterfall like any other. What keeps that safe is its PRIORITY of 1000 rather than this
   * flag — `effectiveAllocations` gives 100% to the first fund by priority when nothing is
   * configured, so it sorts last and cannot become an unconfigured family's default.
   */
  system_key: string | null
}

export interface FundAllocationRow {
  fund_id: string
  fund_name: string
  basis_points: number
  priority: number
  minimum_cents: number
}

export interface FundMilestone {
  id: string
  fund_id: string
  name: string
  description: string | null
  amount_cents: number
  sort_order: number
}

export interface FundDisbursement {
  id: string
  fund_id: string
  fund_name: string | null
  milestone_id: string | null
  milestone_name: string | null
  person_id: string
  person_name: string | null
  amount_cents: number
  disbursed_date: string
  /** Check number or transfer confirmation the money went out on. */
  payment_reference: string | null
  notes: string | null
  created_at: string
  /**
   * Who entered it. Null only where the recorder's `people` row has since been deleted
   * — recorded_by is ON DELETE SET NULL, and 20260807000002 requires it on insert.
   */
  recorded_by_name: string | null
}

/**
 * One row of the contributions ledger — money INTO a fund, however it got there.
 *
 * `source` is what separates the two ways that happens: 'dues_routing' rows are
 * created automatically when a paid dues or donation payment is split across funds,
 * while 'admin_manual' and 'member_contribution' rows are money someone handed over
 * and someone recorded. Only the latter have a giver, a method or a reference — a
 * routed row's payer is reachable through `dues_payment_id` instead, which is why it
 * is not duplicated onto the row.
 */
export interface FundContribution {
  id: string
  fund_id: string
  fund_name: string | null
  amount_cents: number
  source: string
  /** Who gave it: a member's name, or the free-text source for a non-member. */
  contributor_name: string | null
  payment_method: string | null
  payment_reference: string | null
  contributed_date: string
  notes: string | null
  created_at: string
  /** Who entered it. Null for a routed row whose recorder has since been deleted. */
  recorded_by_name: string | null
}

/**
 * One movement of money between two of the family's own funds.
 *
 * Internal, so it is neither income nor expense: it nets to zero family-wide and
 * appears in no P&L. What it does change is which pot the money is in — which is the
 * only thing that ever moves money between funds once dues have routed. See
 * `transferBetweenFunds` for why that matters and 20260812000002 for why it is a
 * table of its own rather than a disbursement paired with a contribution.
 */
export interface FundTransfer {
  id: string
  from_fund_id: string
  from_fund_name: string | null
  to_fund_id: string
  to_fund_name: string | null
  amount_cents: number
  transferred_date: string
  /** Why the money moved. Required — it is the only free-text field on the row. */
  reason: string
  created_at: string
  /** Who entered it. Null only where the recorder's `people` row has since been deleted. */
  recorded_by_name: string | null
}

export interface FundWithStats extends Fund {
  total_disbursed_cents: number
  total_contributed_cents: number
  /**
   * Transfers IN minus transfers OUT. Signed, and shown wherever the three figures
   * above are shown together — without it `contributed − disbursed` stops reconciling
   * to `balance_cents` for any fund that has ever taken part in a transfer, and a
   * reader has no way to tell that from an arithmetic bug.
   */
  net_transfers_cents: number
  balance_cents: number
  milestone_count: number
  allocation_bps: number
}

// -------------------------------------------------------
// Reads
// -------------------------------------------------------

export async function getFunds(): Promise<FundWithStats[]> {
  const supabase = await createClient()
  // ── THERE WAS AN `event_expenses` TERM HERE AND IT IS GONE (2026-08-19) ────────────
  // Five embeds and a sixth read, briefly on the admin client, because `event_expenses`
  // subtracted from a fund's balance. `20260819000006` drops that table and takes the same
  // term out of `fund_balance_cents()`, so this sum and the database's own answer still agree
  // — which is the only thing that ever mattered about it.
  //
  // TRANSFERS ARE A SECOND QUERY, NOT A SIXTH EMBED, and the reason is the one
  // DISBURSEMENT_SELECT records below: fund_transfers has TWO foreign keys to `funds`
  // — the source and the destination — so both embeds would need
  // `alias:fund_transfers!constraint(...)`, and supabase-js's type-LEVEL select parser
  // collapses the WHOLE result to GenericStringError the moment it meets that form
  // inline. Rescuing this select would mean hoisting it to a named const and casting
  // every field access on a row that is otherwise inferred correctly. One more
  // round-trip, run concurrently, buys all of that back.
  //
  // Same client, so the same RLS: like the disbursement and contribution embeds beside
  // it, a caller without `transactions/fund-transfers:view` sees no transfer rows and
  // the balances they are shown are computed without them. That is the behaviour every
  // term of this sum already has, not something transfers introduce — and it is why
  // getActiveFundsForRouting (app/actions/dues.ts) computes the routing balance on the
  // ADMIN client instead, where the answer cannot depend on who is looking.
  const [{ data }, { data: transfers }] = await Promise.all([
    supabase
      .from('funds')
      .select('*, fund_milestones(id), fund_disbursements(amount_cents), fund_allocations(basis_points), fund_contributions(amount_cents)')
      .eq('active', true)
      .order('priority')
      .order('name'),
    supabase.from('fund_transfers').select('from_fund_id, to_fund_id, amount_cents'),
  ])

  // Signed, per fund: in is positive, out is negative, and a fund on both sides of the
  // same transfer is impossible (fund_transfers_distinct_funds).
  const netTransfers = new Map<string, number>()
  const bump = (id: string, delta: number) => netTransfers.set(id, (netTransfers.get(id) ?? 0) + delta)
  for (const t of transfers ?? []) {
    bump(t.to_fund_id, t.amount_cents)
    bump(t.from_fund_id, -t.amount_cents)
  }

  const rows = data ?? []
  const storedBps = new Map<string, number>(
    rows.map(f => [f.id, (f.fund_allocations as { basis_points: number }[] | null)?.[0]?.basis_points ?? 0]),
  )
  // SYSTEM FUNDS ARE IN THE ALLOCATION MATHS SINCE 2026-08-20, matching getFundAllocations
  // and getActiveFundsForRouting — all three moved together, which is the property that
  // matters: a share shown here that the waterfall does not honour, or one it honours that is
  // shown nowhere, are both worse than either behaviour.
  //
  // The objection this replaces was real and is answered by the PRIORITY rather than by the
  // filter: "effectiveAllocations hands 100% to the first fund when nothing is configured, so
  // an unconfigured family would see 100% of dues on the Donations fund". It sorts LAST at
  // priority 1000, so the first fund is never it — unless it is the family's only fund, in
  // which case 100% is the truth and showing it is the point.
  //
  // `rows` IS ALREADY IN PRIORITY ORDER from the query above, which this depends on:
  // `effectiveAllocations` takes "funds already ordered by priority (top first)" and picks
  // `[0]`. Sorting here as well would be a second ordering to keep in step.
  const effective = effectiveAllocations(
    rows.map(f => ({ id: f.id })),
    storedBps,
  )
  const sum = (embedded: unknown) =>
    embedMany<{ amount_cents: number | null }>(embedded)
      .reduce((s, x) => s + (x.amount_cents ?? 0), 0)

  return rows.map(f => {
    const disbursed = sum(f.fund_disbursements)
    const contributed = sum(f.fund_contributions)
    const transferred = netTransfers.get(f.id) ?? 0
    return {
      id: f.id,
      name: f.name,
      description: f.description,
      goal_cents: f.goal_cents,
      active: f.active,
      created_at: f.created_at,
      priority: f.priority ?? 100,
      minimum_cents: f.minimum_cents ?? 0,
      open_contributions: f.open_contributions ?? false,
      system_key: f.system_key ?? null,
      total_disbursed_cents: disbursed,
      total_contributed_cents: contributed,
      net_transfers_cents: transferred,
      // The one definition of a fund balance, and it is the database's too — see
      // fund_balance_cents() (20260812000002, rewritten by 20260819000006), which is what
      // transferBetweenFunds asks before letting money leave a fund. Money that routed here
      // STAYS here: a disbursement reduces this fund and no other, and nothing re-runs the
      // dues waterfall over history. The only way an amount leaves for another fund is a
      // fund_transfers row, which is why the term is here rather than implied.
      //
      // FOUR TERMS SINCE 2026-08-19, down from five. `event_expenses` was the fifth and its
      // table is dropped; the same term came out of `fund_balance_cents()` in the same
      // migration, so the two definitions still agree.
      balance_cents: contributed - disbursed + transferred,
      milestone_count: embedMany(f.fund_milestones).length,
      allocation_bps: effective.get(f.id) ?? 0,
    }
  })
}

export async function getFundWithMilestones(fundId: string): Promise<{
  fund: Fund | null
  milestones: FundMilestone[]
}> {
  const supabase = await createClient()
  const [fundRes, milestonesRes] = await Promise.all([
    supabase.from('funds').select('*').eq('id', fundId).maybeSingle(),
    supabase.from('fund_milestones').select('*').eq('fund_id', fundId).order('sort_order'),
  ])
  return { fund: fundRes.data ?? null, milestones: milestonesRes.data ?? [] }
}

/**
 * The disbursement embed, named once because three readers use it and a fourth would
 * otherwise get it subtly wrong.
 *
 * BOTH people embeds are constraint-qualified, and both have to be. fund_disbursements
 * has two foreign keys to `people` — person_id (who was paid) and recorded_by (who
 * entered it) — so a bare `people(...)` is PGRST201 and PostgREST refuses the WHOLE
 * query, which this codebase surfaces as an empty ledger rather than an error
 * (AGENTS.md §8). The second embed is aliased `recorder:` so the two arrive under
 * different keys instead of one overwriting the other.
 */
const DISBURSEMENT_SELECT =
  '*, funds(name), fund_milestones(name)'
  + ', people!fund_disbursements_person_id_fkey(first_name, last_name)'
  + ', recorder:people!fund_disbursements_recorded_by_fkey(first_name, last_name)'

/**
 * A `people` embed as it arrives — the two columns every one of these selects asks for.
 */
interface EmbeddedPerson { first_name: string; last_name: string }

const fullName = (p: EmbeddedPerson | null) =>
  p ? `${p.first_name} ${p.last_name}`.trim() : null

/**
 * The row shapes the two selects above return.
 *
 * Declared rather than left to inference, and rather than typed `any`, because
 * supabase-js's type-LEVEL select parser does not understand the `alias:table!fk(...)`
 * form and collapses the whole result to `GenericStringError` when it meets one — so
 * every field access on the row becomes an error. A cast is unavoidable; a cast to a
 * named shape at least says what is expected to come back.
 */
interface DisbursementRow {
  id: string
  fund_id: string
  milestone_id: string | null
  person_id: string
  amount_cents: number
  disbursed_date: string
  payment_reference: string | null
  notes: string | null
  created_at: string
  funds: { name: string } | null
  fund_milestones: { name: string } | null
  people: EmbeddedPerson | null
  recorder: EmbeddedPerson | null
}

interface ContributionRow {
  id: string
  fund_id: string
  amount_cents: number
  source: string
  contributor_name: string | null
  payment_method: string | null
  payment_reference: string | null
  contributed_date: string
  notes: string | null
  created_at: string
  funds: { name: string } | null
  people: EmbeddedPerson | null
  recorder: EmbeddedPerson | null
}

function mapDisbursement(d: DisbursementRow): FundDisbursement {
  return {
    id: d.id,
    fund_id: d.fund_id,
    fund_name: d.funds?.name ?? null,
    milestone_id: d.milestone_id,
    milestone_name: d.fund_milestones?.name ?? null,
    person_id: d.person_id,
    person_name: fullName(d.people),
    amount_cents: d.amount_cents,
    disbursed_date: d.disbursed_date,
    payment_reference: d.payment_reference ?? null,
    notes: d.notes,
    created_at: d.created_at,
    recorded_by_name: fullName(d.recorder),
  }
}

export async function getAllDisbursements(): Promise<FundDisbursement[]> {
  const supabase = await createClient()
  const { data } = await supabase
    .from('fund_disbursements')
    .select(DISBURSEMENT_SELECT)
    .order('disbursed_date', { ascending: false })

  return ((data ?? []) as unknown as DisbursementRow[]).map(mapDisbursement)
}

/**
 * BOTH people embeds are constraint-qualified: fund_contributions has TWO foreign keys
 * to people — the giver and whoever recorded it — and an ambiguous embed is PGRST201,
 * which refuses the whole query and reads as an empty ledger (AGENTS.md §8). The
 * recorder is aliased `recorder:` so the two land under different keys.
 *
 * A named const, not an inline literal, for the same reason DISBURSEMENT_SELECT is: the
 * supabase-js type-LEVEL select parser does not understand `alias:table!fk(...)` and
 * degrades the entire result to GenericStringError when it sees one inline.
 */
const CONTRIBUTION_SELECT =
  '*, funds(name)'
  + ', people!fund_contributions_contributor_person_id_fkey(first_name, last_name)'
  + ', recorder:people!fund_contributions_recorded_by_fkey(first_name, last_name)'

/**
 * The contributions ledger, newest first.
 *
 * Read through the user's client, not the admin one, so RLS does the family scoping
 * and the permission model decides who may see it — this is a page, not a background
 * job, and 'reporting/pl-summary' is exactly the right gate.
 */
export async function getFundContributions(): Promise<FundContribution[]> {
  const supabase = await createClient()
  const { data } = await supabase
    .from('fund_contributions')
    .select(CONTRIBUTION_SELECT)
    .order('contributed_date', { ascending: false })
    .order('created_at', { ascending: false })

  return ((data ?? []) as unknown as ContributionRow[]).map(c => ({
    id: c.id,
    fund_id: c.fund_id,
    fund_name: c.funds?.name ?? null,
    amount_cents: c.amount_cents,
    source: c.source,
    // A member giver wins over the free-text one; a routed row has neither.
    contributor_name: fullName(c.people) ?? c.contributor_name ?? null,
    payment_method: c.payment_method ?? null,
    payment_reference: c.payment_reference ?? null,
    contributed_date: c.contributed_date,
    notes: c.notes,
    created_at: c.created_at,
    recorded_by_name: fullName(c.recorder),
  }))
}

/**
 * BOTH fund embeds are constraint-qualified, and both have to be: fund_transfers has
 * TWO foreign keys to `funds` — where the money left and where it landed — so a bare
 * `funds(name)` is PGRST201 and PostgREST refuses the WHOLE query, which this codebase
 * surfaces as an empty ledger rather than an error (AGENTS.md §8). They are aliased so
 * the two arrive under different keys instead of one overwriting the other.
 *
 * `recorder:` is qualified too. There is only one people foreign key here today, so it
 * is not strictly needed — it is written this way so that adding a second one is a
 * schema change rather than a silent PGRST201 in a ledger nobody is watching.
 */
const TRANSFER_SELECT =
  '*'
  + ', source:funds!fund_transfers_from_fund_id_fkey(name)'
  + ', destination:funds!fund_transfers_to_fund_id_fkey(name)'
  + ', recorder:people!fund_transfers_recorded_by_fkey(first_name, last_name)'

interface TransferRow {
  id: string
  from_fund_id: string
  to_fund_id: string
  amount_cents: number
  transferred_date: string
  reason: string
  created_at: string
  source: { name: string } | null
  destination: { name: string } | null
  recorder: EmbeddedPerson | null
}

/**
 * The transfers ledger, newest first.
 *
 * Read through the user's client so RLS does the family scoping and
 * `transactions/fund-transfers:view` decides who sees it — this is a page, not a
 * background job.
 */
export async function getFundTransfers(): Promise<FundTransfer[]> {
  const supabase = await createClient()
  const { data } = await supabase
    .from('fund_transfers')
    .select(TRANSFER_SELECT)
    .order('transferred_date', { ascending: false })
    .order('created_at', { ascending: false })

  return ((data ?? []) as unknown as TransferRow[]).map(t => ({
    id: t.id,
    from_fund_id: t.from_fund_id,
    from_fund_name: t.source?.name ?? null,
    to_fund_id: t.to_fund_id,
    to_fund_name: t.destination?.name ?? null,
    amount_cents: t.amount_cents,
    transferred_date: t.transferred_date,
    reason: t.reason,
    created_at: t.created_at,
    recorded_by_name: fullName(t.recorder),
  }))
}

/** As getAllDisbursements, narrowed to one fund — same select, same embed trap. */
export async function getDisbursementsForFund(fundId: string): Promise<FundDisbursement[]> {
  const supabase = await createClient()
  const { data } = await supabase
    .from('fund_disbursements')
    .select(DISBURSEMENT_SELECT)
    .eq('fund_id', fundId)
    .order('disbursed_date', { ascending: false })

  return ((data ?? []) as unknown as DisbursementRow[]).map(mapDisbursement)
}

// -------------------------------------------------------
// Fund CRUD (admin only)
// -------------------------------------------------------

/**
 * `minimum_cents`, NOT a goal, and the swap is the point rather than a rename.
 *
 * A goal was a number nothing read. `funds.goal_cents` is drawn as a progress target on
 * My Summary and consulted by nothing else — in particular not by `routeContribution`,
 * which fills funds toward their MINIMUM in priority order and is the one mechanism that
 * decides where a dues payment lands. So a family setting up a fund answered the question
 * that has no consequence and left the one that does at zero, then found the Routing
 * screen showing a minimum of $0.00 for a fund they had just given a target.
 *
 * The minimum asked for here is written straight onto the row the routing screen reads,
 * so what was typed at creation is what that screen shows. `goal_cents` is untouched and
 * still nullable: the column stays for the drives that already carry one, and
 * `FundsSection` already falls back to the minimum when there is no goal.
 */
export async function createFund(input: {
  name: string
  description: string
  /** The balance the routing waterfall tops this fund up to before filling lower ones. */
  minimum_cents: number | null
  open_contributions?: boolean
}): Promise<{ success: boolean; id?: string; message?: string }> {
  const supabase = await createClient()
  const admin = createAdminClient()
  const { user } = await currentUser()
  if (!user) return { success: false, message: 'Not authenticated' }

  const familyCode = await getMyFamilyCode(user.id)
  // A fund is family-wide configuration with no personal copy, so scope 'own' is not
  // a grant that means anything here — see canAny. Checked in the action because a
  // server action is reachable directly, whatever gates the page that renders it.
  // Creating a fund is Accounting configuration, not a transaction.
  if (!(await canAny(user.id, 'admin/accounting/funds', 'create'))) return { success: false, message: 'Not authorized' }
  const { data: myPerson } = await supabase.from('people').select('id').eq('user_id', user.id).maybeSingle()

  // New funds go to the end of the priority order (lowest precedence).
  const { data: last } = await admin
    .from('funds').select('priority').eq('family_code', familyCode)
    .order('priority', { ascending: false }).limit(1).maybeSingle()

  // Rounded and floored here rather than trusted: this is a `'use server'` export, so the
  // number input in the dialog is not in its request path. `minimum_cents` is NOT NULL
  // with a zero default, so an omitted or unparseable value becomes the same zero the
  // column already means.
  const minimum = Math.max(0, Math.round(input.minimum_cents ?? 0)) || 0

  const { data, error } = await admin.from('funds').insert({
    family_code: familyCode,
    name: input.name.trim(),
    description: input.description.trim() || null,
    minimum_cents: minimum,
    priority: (last?.priority ?? 0) + 1,
    open_contributions: input.open_contributions ?? false,
    created_by: myPerson?.id ?? null,
  }).select('id').single()

  if (error) return { success: false, message: error.message }
  revalidatePath('/accounting/summary')
  revalidatePath('/admin/accounting')
  revalidatePath('/reporting/pl-summary')
  return { success: true, id: data.id }
}

export async function updateFund(
  id: string,
  input: { name?: string; description?: string; goal_cents?: number | null; active?: boolean; priority?: number; open_contributions?: boolean }
): Promise<{ success: boolean; message?: string }> {
  const admin = createAdminClient()
  const { user } = await currentUser()
  if (!user) return { success: false, message: 'Not authenticated' }
  if (!(await canAny(user.id, 'admin/accounting/funds', 'edit'))) return { success: false, message: 'Not authorized' }
  const familyCode = await getMyFamilyCode(user.id)

  // Deactivating a system fund is deleting it by another name — an inactive fund drops
  // out of every read — so it is refused here and by the trigger. RENAMING is allowed on
  // purpose: a family that calls them Gifts should be able to say so, and nothing looks
  // the fund up by name.
  if (input.active === false) {
    const { data: existing } = await admin
      .from('funds').select('name, system_key').eq('id', id).eq('family_code', familyCode).maybeSingle()
    if (existing?.system_key) {
      return { success: false, message: `${existing.name} is built in and cannot be switched off.` }
    }
  }

  const { error } = await admin.from('funds').update(input).eq('id', id).eq('family_code', familyCode)
  if (error) return { success: false, message: error.message }
  revalidatePath('/accounting/summary')
  revalidatePath('/admin/accounting')
  return { success: true }
}

export async function deleteFund(id: string): Promise<{ success: boolean; message?: string }> {
  const admin = createAdminClient()
  const { user } = await currentUser()
  if (!user) return { success: false, message: 'Not authenticated' }
  if (!(await canAny(user.id, 'admin/accounting/funds', 'delete'))) return { success: false, message: 'Not authorized' }
  const familyCode = await getMyFamilyCode(user.id)

  // A system fund is permanent. 20260807000003's trigger is what actually refuses this —
  // it binds the service-role client the delete below runs on — and this check exists so
  // an administrator gets a sentence naming the fund rather than a raised exception.
  const { data: existing } = await admin
    .from('funds').select('name, system_key').eq('id', id).eq('family_code', familyCode).maybeSingle()
  if (!existing) return { success: false, message: 'Fund not found' }
  if (existing.system_key) {
    return {
      success: false,
      message: `${existing.name} is built in and cannot be deleted. Every donation the family receives is held here.`,
    }
  }

  // ── MONEY, ALL FOUR KINDS OF IT ────────────────────────────────────────────────
  // This was a transfers-only check until 2026-08-17, and the reasoning it carried is
  // still right and still recorded in lib/money-attached.ts: the guard belongs in the
  // action rather than in a RESTRICT constraint, because RESTRICT would make a fund
  // permanently undeletable with a bare 23503 for a message and would deadlock the RLS
  // fixture's teardown against the append-only triggers, whose only permitted delete path
  // is precisely the cascade.
  //
  // What it was WRONG about is which money counts. `fund_contributions.fund_id` and
  // `fund_disbursements.fund_id` are both ON DELETE CASCADE, so deleting a fund with a
  // balance did not orphan its ledger — it ERASED it, and the family's collected total
  // silently dropped. The transfer case was caught because it changes another fund's
  // balance; the plainer case, of destroying this fund's own history, was not.
  //
  // `event_expenses.fund_id` was a third kind of money on this list — an event's spend
  // charged to nothing being a figure with no source — and that table is dropped
  // (20260819000006), so contributions, disbursements and transfers are the whole of it.
  const attached = await moneyAttachedTo('fund', id, familyCode)
  if (attached.any) {
    return { success: false, message: moneyAttachedMessage(existing.name, attached) }
  }

  // Family-scoped: this deletes a balance and every milestone hanging off it, and the
  // service-role client would otherwise let an id alone reach another family.
  const { error } = await admin.from('funds').delete().eq('id', id).eq('family_code', familyCode)
  if (error) return { success: false, message: error.message }
  revalidatePath('/accounting/summary')
  revalidatePath('/admin/accounting')
  return { success: true }
}

// -------------------------------------------------------
// Milestone CRUD (admin only)
// -------------------------------------------------------

/**
 * Returns the inserted row so the admin page can list it without a refetch.
 *
 * ── THE PREAMBLE IS `requireScope` NOW, AND THAT IS THE FIX FOR A REAL REPORT ──────
 * All three milestone actions hand-rolled the §2 preamble — `createClient()`, `getUser()`,
 * `if (!user) return 'Not authenticated'`, then `canAny`, then `getMyFamilyCode` — which is
 * exactly the shape AGENTS.md says to stop writing, because "it cannot be half-written" is the
 * whole argument for the guard existing. This one was half-written in the way that matters:
 * its `getUser()` DISCARDED the error, so a GoTrue timeout or an access token that could not
 * be refreshed came back to an administrator as "Not authenticated" while they were plainly
 * signed in, with nothing logged anywhere. That was the reported bug — adding a milestone
 * answering "Not authenticated" — and `lib/auth/guard.ts`'s `caller()` now separates "could
 * not verify" from "signed out" and logs the first, so every action behind the guard reports
 * it honestly. These three were not behind the guard, which is why they had to move.
 *
 * `requireScope` is the right one rather than `requireOwn`: it is `canAny` underneath, which is
 * what these already used and what §2 requires for family-wide configuration. A milestone is
 * what an award is worth — there is no member's own copy of it. Two things come free with the
 * move and are the reason it is not merely tidier: `requireFamilyActive` and `requireTier`,
 * neither of which any of the three was applying.
 */
export async function createMilestone(
  fundId: string,
  input: { name: string; description: string; amount_cents: number; sort_order?: number }
): Promise<{ success: boolean; milestone?: FundMilestone; message?: string }> {
  // What an award is worth — its own section, its own grant.
  const g = await requireScope('admin/accounting/milestones', 'create')
  if (!g.ok) return { success: false, message: g.message }

  const admin = createAdminClient()

  // §4. The fund must be this family's — the insert below bypasses RLS.
  const { data: fund } = await admin
    .from('funds').select('id').eq('id', fundId).eq('family_code', g.familyCode).maybeSingle()
  if (!fund) return { success: false, message: 'Fund not found' }

  const { data, error } = await admin.from('fund_milestones').insert({
    fund_id: fundId,
    family_code: g.familyCode,
    name: input.name.trim(),
    description: input.description.trim() || null,
    amount_cents: input.amount_cents,
    sort_order: input.sort_order ?? 0,
  }).select('id, fund_id, name, description, amount_cents, sort_order').single()

  if (error) return { success: false, message: error.message }
  revalidatePath('/admin/accounting')
  return { success: true, milestone: data }
}

/** See `createMilestone` on why the preamble is the guard. */
export async function updateMilestone(
  id: string,
  input: { name?: string; description?: string; amount_cents?: number; sort_order?: number }
): Promise<{ success: boolean; message?: string }> {
  const g = await requireScope('admin/accounting/milestones', 'edit')
  if (!g.ok) return { success: false, message: g.message }

  const admin = createAdminClient()
  const { error } = await admin.from('fund_milestones').update(input).eq('id', id).eq('family_code', g.familyCode)
  if (error) return { success: false, message: error.message }
  revalidatePath('/admin/accounting')
  return { success: true }
}

/** See `createMilestone` on why the preamble is the guard. */
export async function deleteMilestone(id: string): Promise<{ success: boolean; message?: string }> {
  const g = await requireScope('admin/accounting/milestones', 'delete')
  if (!g.ok) return { success: false, message: g.message }

  const admin = createAdminClient()
  const familyCode = g.familyCode

  // A milestone is what a disbursement was FOR, and `fund_disbursements.milestone_id` is
  // ON DELETE SET NULL — so deleting one that has been paid against leaves the payout in
  // the ledger attributed to nothing, permanently, because that table is append-only and
  // permits no update. The money is still counted; the reason it left is gone.
  //
  // The name is read for the message rather than for the delete: `.eq('family_code', …)`
  // below is what scopes the write, and this row would be `null` for another family's id.
  const { data: existing } = await admin
    .from('fund_milestones').select('name').eq('id', id).eq('family_code', familyCode).maybeSingle()
  if (!existing) return { success: false, message: 'Milestone not found' }

  const attached = await moneyAttachedTo('fund_milestone', id, familyCode)
  if (attached.any) {
    return {
      success: false,
      message: moneyAttachedMessage(existing.name ? `“${existing.name}”` : 'This milestone', attached),
    }
  }

  const { error } = await admin.from('fund_milestones').delete().eq('id', id).eq('family_code', familyCode)
  if (error) return { success: false, message: error.message }
  revalidatePath('/admin/accounting')
  return { success: true }
}

// -------------------------------------------------------
// Disbursement CRUD (admin only)
// -------------------------------------------------------

export async function recordDisbursement(input: {
  fund_id: string
  milestone_id: string | null
  person_id: string
  amount_cents: number
  disbursed_date: string
  payment_reference: string | null
  notes: string | null
}): Promise<{ success: boolean; message?: string }> {
  const admin = createAdminClient()
  const { user } = await currentUser()
  if (!user) return { success: false, message: 'Not authenticated' }

  const familyCode = await getMyFamilyCode(user.id)
  // Paying money out is an edit of the family's finances, and this action is now
  // reachable from a member-facing page — so it checks the permission itself rather
  // than inheriting one from whichever page happened to render the form.
  //
  // canAny, not can: the row a member would "own" here is a disbursement paying money
  // to THEMSELVES, so honouring scope 'own' would authorize precisely the payout a
  // restricted grant exists to prevent.
  // Paying money OUT of a fund. Its own grant, separate from logging money in:
  // 'accounting/transactions/fund-disbursements' create. canAny throughout — the disbursement
  // paying the caller THEMSELVES is the abuse case, so scope 'own' must never admit.
  if (!(await canAny(user.id, 'accounting/transactions/fund-disbursements', 'create'))) return { success: false, message: 'Not authorized' }

  // WHO PAID IT OUT. Required, not best-effort — this is money leaving the family, and
  // an unattributed payout is the one row in the ledger that cannot be asked about.
  //
  // What this replaces was `myPerson?.id ?? null` over a `people` lookup keyed on
  // user_id ALONE. Two faults, and they compounded: the query was not family-scoped, so
  // a member of two families matched two rows and maybeSingle() failed outright; and the
  // `?? null` then swallowed that failure and wrote the disbursement anyway. The result
  // was that a multi-family treasurer's payouts were the ones with no name on them.
  // getMyPersonId resolves the ACTIVE family's row, which is the same family the row
  // below is stamped with. 20260807000002 refuses the insert if this is ever null again.
  const myPersonId = await getMyPersonId(user.id)
  if (!myPersonId) return { success: false, message: 'Profile not found' }

  // Required, which is what 20260805000001 added the column for and stopped one step
  // short of: money going OUT with no identifier cannot be matched to a bank statement,
  // and cannot be answered when a member says the check never came. Required on the way
  // in rather than chased later, because there is no editing a disbursement afterwards
  // to add what should have been captured.
  const reference = input.payment_reference?.trim() || null
  if (!reference) {
    return { success: false, message: 'Record a check number or reference for the disbursement' }
  }

  // Fund, recipient AND milestone are re-scoped to this family: the insert below runs
  // on the service-role client, which bypasses RLS, so ids alone must not be enough.
  //
  // milestone_id was previously written straight from the caller. It is nullable and
  // optional, so it looked harmless — but it is a client-supplied id landing on a row
  // stamped with the caller's own family_code, which satisfies every policy. Naming
  // another family's fund_milestones id attached this family's payout to their
  // milestone and corrupted that fund's progress accounting.
  const [{ data: fund }, { data: recipient }, milestoneOk] = await Promise.all([
    admin.from('funds').select('id').eq('id', input.fund_id).eq('family_code', familyCode).maybeSingle(),
    admin.from('people').select('id').eq('id', input.person_id).eq('family_code', familyCode).maybeSingle(),
    input.milestone_id
      ? belongsToFamily('fund_milestones', input.milestone_id, familyCode)
      : Promise.resolve(true),
  ])
  if (!fund) return { success: false, message: 'Fund not found' }
  if (!recipient) return { success: false, message: 'Recipient not found in this family' }
  if (!milestoneOk) return { success: false, message: 'Milestone not found' }

  const { error } = await admin.from('fund_disbursements').insert({
    fund_id: input.fund_id,
    milestone_id: input.milestone_id,
    family_code: familyCode,
    person_id: input.person_id,
    amount_cents: input.amount_cents,
    disbursed_date: input.disbursed_date,
    payment_reference: reference,
    notes: input.notes,
    recorded_by: myPersonId,
  })

  if (error) return { success: false, message: error.message }
  revalidatePath('/accounting/summary')
  revalidatePath('/admin/accounting')
  revalidatePath('/accounting/transactions')
  revalidatePath('/reporting/pl-summary')
  return { success: true }
}

// deleteDisbursement was removed here, and its removal is enforced rather than
// declared: 20260807000002 makes fund_disbursements append-only with a trigger the
// service role cannot bypass, drops the RLS DELETE policy, and narrows the
// 'accounting/transactions/fund-disbursements' resource to {view,create} so Members & Access stops
// offering a Delete column for it. Deleting the record of money that left the family is
// not a capability this app has.
//
// KNOWN GAP, stated so it is a decision and not a surprise: there is no reversal path
// for a disbursement either. dues_payments has one — reversePayment posts an equal and
// opposite row — and this table does not, so a mis-keyed payout is permanent and the
// only correction available is a compensating fund_contribution with a note explaining
// it. The right fix is a reversal mirroring reversePayment, and it is not this change.

// -------------------------------------------------------
// Fund routing configuration (admin only)
// -------------------------------------------------------

/**
 * The routing table: which share of a dues payment each fund receives.
 *
 * SYSTEM FUNDS ARE INCLUDED SINCE 2026-08-20, and this said the opposite: "the Donations fund
 * does not take a share of dues — it takes donations, whole — so offering it a percentage here
 * would be offering a setting that nothing reads." The setting is read now.
 * `getActiveFundsForRouting` in dues.ts dropped the same exclusion in the same commit, and the
 * two must keep agreeing — a fund offered a share here that the waterfall does not consult is
 * precisely the setting-nothing-reads this note used to be about, running the other way.
 *
 * The Donations fund's priority of 1000 is what makes it safe to list: `effectiveAllocations`
 * gives 100% to the first fund by priority when nothing is configured, so it sorts last and
 * cannot become an unconfigured family's default recipient.
 */
export async function getFundAllocations(): Promise<FundAllocationRow[]> {
  const supabase = await createClient()
  const [fundsRes, allocRes] = await Promise.all([
    supabase.from('funds').select('id, name, priority, minimum_cents')
      .eq('active', true).order('priority').order('name'),
    supabase.from('fund_allocations').select('fund_id, basis_points'),
  ])
  const funds = fundsRes.data ?? []
  const stored = new Map<string, number>((allocRes.data ?? []).map(a => [a.fund_id, a.basis_points]))
  const effective = effectiveAllocations(funds.map(f => ({ id: f.id })), stored)
  return funds.map(f => ({
    fund_id: f.id,
    fund_name: f.name,
    basis_points: effective.get(f.id) ?? 0,
    priority: f.priority ?? 100,
    minimum_cents: f.minimum_cents ?? 0,
  }))
}

export async function saveFundAllocations(
  rows: { fund_id: string; basis_points: number; priority: number; minimum_cents: number }[]
): Promise<{ success: boolean; message?: string }> {
  const admin = createAdminClient()
  const { user } = await currentUser()
  if (!user) return { success: false, message: 'Not authenticated' }
  const familyCode = await getMyFamilyCode(user.id)
  // Redrawing the split that every future payment follows.
  if (!(await canAny(user.id, 'admin/accounting/routing', 'edit'))) return { success: false, message: 'Not authorized' }
  const myPersonId = await getMyPersonId(user.id)

  // Allocations must total exactly 100% (or all zero to disable routing).
  const totalBps = rows.reduce((s, r) => s + Math.round(r.basis_points), 0)
  if (totalBps !== 0 && totalBps !== 10000) {
    return { success: false, message: `Allocations must total 100% (currently ${(totalBps / 100).toFixed(2)}%)` }
  }

  // Every fund_id is checked against this family BEFORE anything is written. The
  // writes below go through the service-role client, so without this a caller could
  // reorder another family's funds by id, and the upsert would stamp this family's
  // code onto an allocation row pointing at a foreign fund.
  const { data: ownFunds } = await admin.from('funds').select('id').eq('family_code', familyCode)
  const ownIds = new Set((ownFunds ?? []).map(f => f.id as string))
  if (rows.some(r => !ownIds.has(r.fund_id))) {
    return { success: false, message: 'Fund not found' }
  }

  // Persist priority/minimum onto the funds themselves.
  for (const r of rows) {
    const { error } = await admin
      .from('funds')
      .update({ priority: Math.round(r.priority), minimum_cents: Math.round(r.minimum_cents) })
      .eq('id', r.fund_id)
      .eq('family_code', familyCode)
    if (error) return { success: false, message: error.message }
  }

  if (rows.length > 0) {
    const { error } = await admin.from('fund_allocations').upsert(
      rows.map(r => ({
        family_code: familyCode,
        fund_id: r.fund_id,
        basis_points: Math.round(r.basis_points),
        created_by: myPersonId,
      })),
      { onConflict: 'family_code,fund_id' },
    )
    if (error) return { success: false, message: error.message }
  }

  revalidatePath('/admin/accounting')
  revalidatePath('/reporting/pl-summary')
  return { success: true }
}

/**
 * Money an admin adds to a fund by hand.
 *
 * The giver and the method are required, because this row is the only record that
 * a cheque or a cash handover ever existed — unlike a dues-routed contribution,
 * there is no payment behind it to look the payer up from. A giver who is not a
 * member is carried as free text in `contributor_name` instead.
 */
export async function recordFundContribution(input: {
  fund_id: string
  amount_cents: number
  contributed_date: string
  contributor_person_id: string | null
  contributor_name: string | null
  payment_method: string | null
  payment_reference: string | null
  notes: string | null
}): Promise<{ success: boolean; message?: string }> {
  const admin = createAdminClient()
  const { user } = await currentUser()
  if (!user) return { success: false, message: 'Not authenticated' }
  const familyCode = await getMyFamilyCode(user.id)
  // Logging money INTO a fund by hand.
  if (!(await canAny(user.id, 'accounting/transactions/fund-contributions', 'create'))) return { success: false, message: 'Not authorized' }

  // WHO RECORDED IT. Checked rather than assumed: getMyPersonId returns '' when it
  // cannot resolve a row, and an empty string is not a uuid — so the unchecked version
  // failed at the database with `invalid input syntax for type uuid: ""` and surfaced
  // that to a treasurer as the whole error message.
  const myPersonId = await getMyPersonId(user.id)
  if (!myPersonId) return { success: false, message: 'Profile not found' }

  const contributorName = input.contributor_name?.trim() || null
  if (!input.contributor_person_id && !contributorName) {
    return { success: false, message: 'Record who the contribution came from' }
  }
  if (!input.payment_method) return { success: false, message: 'Record how the contribution was given' }
  // Required for the same reason the method is, and the reason is in this function's
  // own doc comment: nothing sits behind this row. A dues-routed contribution can be
  // traced back to the payment that produced it; a hand-recorded one is the only
  // record that exists, so "which cheque was this?" has to be answerable from it.
  const reference = input.payment_reference?.trim() || null
  if (!reference) {
    return { success: false, message: 'Record a check number or reference for the contribution' }
  }

  // Both ids are re-scoped to this family: the insert below uses the admin client,
  // which bypasses RLS, so nothing else stops another family's fund or person from
  // being written onto this family's ledger.
  const { data: fund } = await admin
    .from('funds').select('id').eq('id', input.fund_id).eq('family_code', familyCode).maybeSingle()
  if (!fund) return { success: false, message: 'Fund not found' }

  if (input.contributor_person_id) {
    const { data: contributor } = await admin
      .from('people').select('id').eq('id', input.contributor_person_id).eq('family_code', familyCode).maybeSingle()
    if (!contributor) return { success: false, message: 'Contributor not found in this family' }
  }

  const { error } = await admin.from('fund_contributions').insert({
    fund_id: input.fund_id,
    family_code: familyCode,
    amount_cents: input.amount_cents,
    source: 'admin_manual',
    contributed_date: input.contributed_date,
    // A member giver is stored by id; only a non-member falls back to the name.
    contributor_person_id: input.contributor_person_id,
    contributor_name: input.contributor_person_id ? null : contributorName,
    payment_method: input.payment_method,
    payment_reference: reference,
    notes: input.notes,
    recorded_by: myPersonId,
  })
  if (error) return { success: false, message: error.message }
  revalidatePath('/admin/accounting')
  revalidatePath('/accounting/transactions')
  revalidatePath('/reporting/pl-summary')
  return { success: true }
}

// -------------------------------------------------------
// Fund transfers
// -------------------------------------------------------

/**
 * Move money from one of the family's funds to another.
 *
 * THIS IS THE ONLY WAY MONEY CHANGES FUNDS after it has been routed, and that is the
 * whole point of the feature. A dues payment is split across funds ONCE, by
 * routePaidPayment, using the priorities and minimums in force at the time; the
 * fund_contributions rows it writes are then permanent. Paying $300 out of the Reunion
 * fund reduces the Reunion fund by $300 and touches no other — and the next dues
 * payment refills Reunion toward its minimum ahead of everything below it, because
 * getActiveFundsForRouting reads the same per-fund balance this action does. Nothing
 * re-runs the waterfall over history; reversePayment says so in as many words, and
 * this action is what a family reaches for when they genuinely DO want money moved.
 *
 * WHAT IS CHECKED, and why each one is here rather than assumed:
 *
 *   canAny, not can          There is no personal copy of a movement between the
 *                            family's pots, so scope 'own' would be a narrowed grant
 *                            that means exactly what the unrestricted one means. Its
 *                            own resource key, separate from disbursements: paying a
 *                            member what they are owed and re-deciding what the family
 *                            saved for are different judgements.
 *   both funds re-scoped     AGENTS.md §4. The insert below runs on the service-role
 *                            client, and even on the user client a row stamped with
 *                            the caller's own family_code satisfies every policy while
 *                            pointing at another family's fund. 20260812000002's
 *                            trigger states the same rule in the database, where the
 *                            service role cannot step around it; this is what turns
 *                            that exception into a sentence.
 *   sufficient balance       Asked of fund_balance_cents() in the database rather than
 *                            recomputed here, so the guard and the figure on screen
 *                            cannot drift apart. Unlike a disbursement — which records
 *                            something that already happened outside the system, and
 *                            so may legitimately be back-dated into an overdraft — a
 *                            transfer IS the event. Moving money a fund does not have
 *                            invents it.
 *
 * The Donations fund is deliberately NOT excluded from either end. It takes no share
 * of dues (20260807000003), but the money in it is real, and moving a gift into the
 * fund it was given for is the most obvious use this feature has.
 */
export async function transferBetweenFunds(input: {
  from_fund_id: string
  to_fund_id: string
  amount_cents: number
  transferred_date: string
  reason: string
}): Promise<{ success: boolean; message?: string }> {
  const admin = createAdminClient()
  const { user } = await currentUser()
  if (!user) return { success: false, message: 'Not authenticated' }

  const familyCode = await getMyFamilyCode(user.id)
  if (!(await canAny(user.id, 'accounting/transactions/fund-transfers', 'create'))) {
    return { success: false, message: 'Not authorized' }
  }

  // WHO MOVED IT. Checked rather than assumed: getMyPersonId returns '' when it cannot
  // resolve a row, the database refuses an unattributed transfer, and an empty string
  // is not a uuid — so the unchecked version would surface `invalid input syntax for
  // type uuid: ""` to a treasurer as the whole error message.
  const myPersonId = await getMyPersonId(user.id)
  if (!myPersonId) return { success: false, message: 'Profile not found' }

  if (input.from_fund_id === input.to_fund_id) {
    return { success: false, message: 'Choose two different funds' }
  }
  const amount = Math.round(input.amount_cents)
  if (!Number.isFinite(amount) || amount <= 0) {
    return { success: false, message: 'Enter an amount greater than zero' }
  }
  const reason = input.reason?.trim() || null
  if (!reason) {
    return { success: false, message: 'Record why the money is being moved' }
  }

  // Both ends, both family-scoped. `.eq('id', …)` alone would let one family move
  // another's money.
  const [{ data: from }, { data: to }] = await Promise.all([
    admin.from('funds').select('id, name').eq('id', input.from_fund_id).eq('family_code', familyCode).maybeSingle(),
    admin.from('funds').select('id, name').eq('id', input.to_fund_id).eq('family_code', familyCode).maybeSingle(),
  ])
  if (!from) return { success: false, message: 'Fund not found' }
  if (!to) return { success: false, message: 'Destination fund not found' }

  // The database's own definition of a balance, on the service-role client so the
  // answer does not depend on what this caller may see. An error here is fatal rather
  // than permissive: a balance we could not read is not a balance we may spend.
  const { data: balance, error: balanceError } = await admin
    .rpc('fund_balance_cents', { p_fund_id: input.from_fund_id })
  if (balanceError) {
    return { success: false, message: `Could not read the balance of ${from.name}` }
  }
  const available = typeof balance === 'number' ? balance : 0
  if (amount > available) {
    return {
      success: false,
      message: `${from.name} holds ${formatCurrency(available)}. Transfer that or less.`,
    }
  }

  const { error } = await admin.from('fund_transfers').insert({
    family_code: familyCode,
    from_fund_id: input.from_fund_id,
    to_fund_id: input.to_fund_id,
    amount_cents: amount,
    transferred_date: input.transferred_date,
    reason,
    recorded_by: myPersonId,
  })
  if (error) return { success: false, message: error.message }

  revalidatePath('/accounting/summary')
  revalidatePath('/admin/accounting')
  revalidatePath('/accounting/transactions')
  revalidatePath('/reporting/pl-summary')
  return { success: true }
}

// There is no updateTransfer and no deleteTransfer, and 20260812000002 enforces that
// with a trigger the service role cannot bypass. This table needs neither: unlike a
// disbursement — whose known gap is that a mis-keyed payout is permanent — the inverse
// of a transfer is a transfer, so a mistake is corrected by moving the money back and
// both rows stand.

// contributeToFund was removed here. It was an exported 'use server' function that
// inserted into fund_contributions through the service role with no permission check
// at all — reachable by any signed-in member via a direct POST. It appeared safe only
// because the one UI that called it sat behind a hardcoded `false`. A boolean hiding a
// button is not a gate, and an ungated service-role INSERT into the family's money is
// not something to leave lying around for the flag to be flipped later.
//
// If open member giving becomes a product feature it returns with its own permission
// resource under Accounting > Transactions, like the other four recording paths.
