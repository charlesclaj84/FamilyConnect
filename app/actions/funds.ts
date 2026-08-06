'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { canAny } from '@/lib/auth/permissions'
import { getMyFamilyCode, getMyPersonId, belongsToFamily } from '@/lib/auth/family'
import { createAdminClient } from '@/lib/supabase/admin'
import { effectiveAllocations } from '@/lib/fund-routing'

export interface Fund {
  id: string
  name: string
  description: string | null
  goal_cents: number | null
  active: boolean
  created_at: string
  priority: number
  minimum_cents: number
  event_id: string | null
  open_contributions: boolean
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
}

export interface FundWithStats extends Fund {
  total_disbursed_cents: number
  total_contributed_cents: number
  balance_cents: number
  milestone_count: number
  allocation_bps: number
}

// -------------------------------------------------------
// Reads
// -------------------------------------------------------

export async function getFunds(): Promise<FundWithStats[]> {
  const supabase = await createClient()
  const { data } = await supabase
    .from('funds')
    .select('*, fund_milestones(id), fund_disbursements(amount_cents), fund_allocations(basis_points), fund_contributions(amount_cents), event_expenses(amount_cents)')
    .eq('active', true)
    .order('priority')
    .order('name')

  const rows = data ?? []
  const storedBps = new Map<string, number>(
    rows.map(f => [f.id, (f.fund_allocations as { basis_points: number }[] | null)?.[0]?.basis_points ?? 0]),
  )
  const effective = effectiveAllocations(rows.map(f => ({ id: f.id })), storedBps)
  const sum = (arr: any[] | null | undefined) => (arr ?? []).reduce((s: number, x: any) => s + (x.amount_cents ?? 0), 0)

  return rows.map(f => {
    const disbursed = sum(f.fund_disbursements as any[])
    const contributed = sum(f.fund_contributions as any[])
    const expensed = sum(f.event_expenses as any[])
    return {
      id: f.id,
      name: f.name,
      description: f.description,
      goal_cents: f.goal_cents,
      active: f.active,
      created_at: f.created_at,
      priority: f.priority ?? 100,
      minimum_cents: f.minimum_cents ?? 0,
      event_id: f.event_id ?? null,
      open_contributions: f.open_contributions ?? false,
      total_disbursed_cents: disbursed,
      total_contributed_cents: contributed,
      balance_cents: contributed - disbursed - expensed,
      milestone_count: ((f.fund_milestones as any[]) ?? []).length,
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
 * Every disbursement, newest first.
 *
 * The people embed MUST name fund_disbursements_person_id_fkey. The table has TWO
 * foreign keys to people — person_id (who was paid) and recorded_by (who entered
 * it) — and an ambiguous `people(...)` makes PostgREST refuse the whole query with
 * PGRST201. Because the error is dropped on the floor here, that surfaces as an
 * empty ledger rather than a failure. Same trap as getFundContributions below.
 */
export async function getAllDisbursements(): Promise<FundDisbursement[]> {
  const supabase = await createClient()
  const { data } = await supabase
    .from('fund_disbursements')
    .select('*, funds(name), fund_milestones(name), people!fund_disbursements_person_id_fkey(first_name, last_name)')
    .order('disbursed_date', { ascending: false })

  return (data ?? []).map(d => ({
    id: d.id,
    fund_id: d.fund_id,
    fund_name: (d.funds as any)?.name ?? null,
    milestone_id: d.milestone_id,
    milestone_name: (d.fund_milestones as any)?.name ?? null,
    person_id: d.person_id,
    person_name: d.people
      ? `${(d.people as any).first_name} ${(d.people as any).last_name}`
      : null,
    amount_cents: d.amount_cents,
    disbursed_date: d.disbursed_date,
    payment_reference: d.payment_reference ?? null,
    notes: d.notes,
    created_at: d.created_at,
  }))
}

/**
 * The contributions ledger, newest first.
 *
 * Read through the user's client, not the admin one, so RLS does the family scoping
 * and the permission model decides who may see it — this is a page, not a background
 * job, and 'family-finances' is exactly the right gate.
 *
 * The people embed MUST be disambiguated to contributor_person_id: fund_contributions
 * has TWO foreign keys to people (the giver and whoever recorded it), and an
 * ambiguous embed makes PostgREST error out into a silently empty list. The same trap
 * is documented on dues_payments in getFamilyPnL.
 */
export async function getFundContributions(): Promise<FundContribution[]> {
  const supabase = await createClient()
  const { data } = await supabase
    .from('fund_contributions')
    .select('*, funds(name), people!contributor_person_id(first_name, last_name)')
    .order('contributed_date', { ascending: false })
    .order('created_at', { ascending: false })

  return (data ?? []).map(c => {
    const person = c.people as { first_name: string; last_name: string } | null
    return {
      id: c.id,
      fund_id: c.fund_id,
      fund_name: (c.funds as { name: string } | null)?.name ?? null,
      amount_cents: c.amount_cents,
      source: c.source,
      // A member giver wins over the free-text one; a routed row has neither.
      contributor_name: person ? `${person.first_name} ${person.last_name}` : (c.contributor_name ?? null),
      payment_method: c.payment_method ?? null,
      payment_reference: c.payment_reference ?? null,
      contributed_date: c.contributed_date,
      notes: c.notes,
      created_at: c.created_at,
    }
  })
}

/** As getAllDisbursements, narrowed to one fund — and with the same embed trap. */
export async function getDisbursementsForFund(fundId: string): Promise<FundDisbursement[]> {
  const supabase = await createClient()
  const { data } = await supabase
    .from('fund_disbursements')
    .select('*, funds(name), fund_milestones(name), people!fund_disbursements_person_id_fkey(first_name, last_name)')
    .eq('fund_id', fundId)
    .order('disbursed_date', { ascending: false })

  return (data ?? []).map(d => ({
    id: d.id,
    fund_id: d.fund_id,
    fund_name: (d.funds as any)?.name ?? null,
    milestone_id: d.milestone_id,
    milestone_name: (d.fund_milestones as any)?.name ?? null,
    person_id: d.person_id,
    person_name: d.people
      ? `${(d.people as any).first_name} ${(d.people as any).last_name}`
      : null,
    amount_cents: d.amount_cents,
    disbursed_date: d.disbursed_date,
    payment_reference: d.payment_reference ?? null,
    notes: d.notes,
    created_at: d.created_at,
  }))
}

// -------------------------------------------------------
// Fund CRUD (admin only)
// -------------------------------------------------------

export async function createFund(input: {
  name: string
  description: string
  goal_cents: number | null
  open_contributions?: boolean
}): Promise<{ success: boolean; id?: string; message?: string }> {
  const supabase = await createClient()
  const admin = createAdminClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { success: false, message: 'Not authenticated' }

  const familyCode = await getMyFamilyCode(user.id)
  // A fund is family-wide configuration with no personal copy, so scope 'own' is not
  // a grant that means anything here — see canAny. Checked in the action because a
  // server action is reachable directly, whatever gates the page that renders it.
  // Creating a fund is Accounting configuration, not a transaction.
  if (!(await canAny(user.id, 'admin/account/funds', 'create'))) return { success: false, message: 'Not authorized' }
  const { data: myPerson } = await supabase.from('people').select('id').eq('user_id', user.id).maybeSingle()

  // New funds go to the end of the priority order (lowest precedence).
  const { data: last } = await admin
    .from('funds').select('priority').eq('family_code', familyCode)
    .order('priority', { ascending: false }).limit(1).maybeSingle()

  const { data, error } = await admin.from('funds').insert({
    family_code: familyCode,
    name: input.name.trim(),
    description: input.description.trim() || null,
    goal_cents: input.goal_cents,
    priority: (last?.priority ?? 0) + 1,
    open_contributions: input.open_contributions ?? false,
    created_by: myPerson?.id ?? null,
  }).select('id').single()

  if (error) return { success: false, message: error.message }
  revalidatePath('/account-summary')
  revalidatePath('/admin/account')
  revalidatePath('/family-finances')
  return { success: true, id: data.id }
}

export async function updateFund(
  id: string,
  input: { name?: string; description?: string; goal_cents?: number | null; active?: boolean; priority?: number; open_contributions?: boolean }
): Promise<{ success: boolean; message?: string }> {
  const supabase = await createClient()
  const admin = createAdminClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { success: false, message: 'Not authenticated' }
  if (!(await canAny(user.id, 'admin/account/funds', 'edit'))) return { success: false, message: 'Not authorized' }
  const familyCode = await getMyFamilyCode(user.id)

  const { error } = await admin.from('funds').update(input).eq('id', id).eq('family_code', familyCode)
  if (error) return { success: false, message: error.message }
  revalidatePath('/account-summary')
  revalidatePath('/admin/account')
  return { success: true }
}

export async function deleteFund(id: string): Promise<{ success: boolean; message?: string }> {
  const supabase = await createClient()
  const admin = createAdminClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { success: false, message: 'Not authenticated' }
  if (!(await canAny(user.id, 'admin/account/funds', 'delete'))) return { success: false, message: 'Not authorized' }
  const familyCode = await getMyFamilyCode(user.id)

  // Family-scoped: this deletes a balance and every milestone hanging off it, and the
  // service-role client would otherwise let an id alone reach another family.
  const { error } = await admin.from('funds').delete().eq('id', id).eq('family_code', familyCode)
  if (error) return { success: false, message: error.message }
  revalidatePath('/account-summary')
  revalidatePath('/admin/account')
  return { success: true }
}

// -------------------------------------------------------
// Milestone CRUD (admin only)
// -------------------------------------------------------

/** Returns the inserted row so the admin page can list it without a refetch. */
export async function createMilestone(
  fundId: string,
  input: { name: string; description: string; amount_cents: number; sort_order?: number }
): Promise<{ success: boolean; milestone?: FundMilestone; message?: string }> {
  const supabase = await createClient()
  const admin = createAdminClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { success: false, message: 'Not authenticated' }

  const familyCode = await getMyFamilyCode(user.id)
  // What an award is worth — its own section, its own grant.
  if (!(await canAny(user.id, 'admin/account/milestones', 'create'))) return { success: false, message: 'Not authorized' }

  // The fund must be this family's — the insert below bypasses RLS.
  const { data: fund } = await admin
    .from('funds').select('id').eq('id', fundId).eq('family_code', familyCode).maybeSingle()
  if (!fund) return { success: false, message: 'Fund not found' }

  const { data, error } = await admin.from('fund_milestones').insert({
    fund_id: fundId,
    family_code: familyCode,
    name: input.name.trim(),
    description: input.description.trim() || null,
    amount_cents: input.amount_cents,
    sort_order: input.sort_order ?? 0,
  }).select('id, fund_id, name, description, amount_cents, sort_order').single()

  if (error) return { success: false, message: error.message }
  revalidatePath('/admin/account')
  return { success: true, milestone: data }
}

export async function updateMilestone(
  id: string,
  input: { name?: string; description?: string; amount_cents?: number; sort_order?: number }
): Promise<{ success: boolean; message?: string }> {
  const supabase = await createClient()
  const admin = createAdminClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { success: false, message: 'Not authenticated' }
  if (!(await canAny(user.id, 'admin/account/milestones', 'edit'))) return { success: false, message: 'Not authorized' }
  const familyCode = await getMyFamilyCode(user.id)

  const { error } = await admin.from('fund_milestones').update(input).eq('id', id).eq('family_code', familyCode)
  if (error) return { success: false, message: error.message }
  revalidatePath('/admin/account')
  return { success: true }
}

export async function deleteMilestone(id: string): Promise<{ success: boolean; message?: string }> {
  const supabase = await createClient()
  const admin = createAdminClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { success: false, message: 'Not authenticated' }
  if (!(await canAny(user.id, 'admin/account/milestones', 'delete'))) return { success: false, message: 'Not authorized' }
  const familyCode = await getMyFamilyCode(user.id)

  const { error } = await admin.from('fund_milestones').delete().eq('id', id).eq('family_code', familyCode)
  if (error) return { success: false, message: error.message }
  revalidatePath('/admin/account')
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
  const supabase = await createClient()
  const admin = createAdminClient()
  const { data: { user } } = await supabase.auth.getUser()
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
  // 'transactions/fund-disbursements' create. canAny throughout — the disbursement
  // paying the caller THEMSELVES is the abuse case, so scope 'own' must never admit.
  if (!(await canAny(user.id, 'transactions/fund-disbursements', 'create'))) return { success: false, message: 'Not authorized' }
  const { data: myPerson } = await supabase.from('people').select('id').eq('user_id', user.id).maybeSingle()

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
    payment_reference: input.payment_reference?.trim() || null,
    notes: input.notes,
    recorded_by: myPerson?.id ?? null,
  })

  if (error) return { success: false, message: error.message }
  revalidatePath('/account-summary')
  revalidatePath('/admin/account')
  revalidatePath('/transactions')
  revalidatePath('/family-finances')
  return { success: true }
}

export async function deleteDisbursement(id: string): Promise<{ success: boolean; message?: string }> {
  const supabase = await createClient()
  const admin = createAdminClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { success: false, message: 'Not authenticated' }
  // Same reasoning as recordDisbursement, canAny included: deleting your own payout is
  // how you would cover up having recorded it.
  // Erasing the record of a payout is a distinct authority from making one.
  if (!(await canAny(user.id, 'transactions/fund-disbursements', 'delete'))) return { success: false, message: 'Not authorized' }
  const familyCode = await getMyFamilyCode(user.id)

  const { error } = await admin.from('fund_disbursements').delete().eq('id', id).eq('family_code', familyCode)
  if (error) return { success: false, message: error.message }
  revalidatePath('/account-summary')
  revalidatePath('/admin/account')
  revalidatePath('/transactions')
  revalidatePath('/family-finances')
  return { success: true }
}

// -------------------------------------------------------
// Fund routing configuration (admin only)
// -------------------------------------------------------

export async function getFundAllocations(): Promise<FundAllocationRow[]> {
  const supabase = await createClient()
  const [fundsRes, allocRes] = await Promise.all([
    supabase.from('funds').select('id, name, priority, minimum_cents').eq('active', true).order('priority').order('name'),
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
  const supabase = await createClient()
  const admin = createAdminClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { success: false, message: 'Not authenticated' }
  const familyCode = await getMyFamilyCode(user.id)
  // Redrawing the split that every future payment follows.
  if (!(await canAny(user.id, 'admin/account/routing', 'edit'))) return { success: false, message: 'Not authorized' }
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

  revalidatePath('/admin/account')
  revalidatePath('/family-finances')
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
  const supabase = await createClient()
  const admin = createAdminClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { success: false, message: 'Not authenticated' }
  const familyCode = await getMyFamilyCode(user.id)
  // Logging money INTO a fund by hand.
  if (!(await canAny(user.id, 'transactions/fund-contributions', 'create'))) return { success: false, message: 'Not authorized' }
  const myPersonId = await getMyPersonId(user.id)

  const contributorName = input.contributor_name?.trim() || null
  if (!input.contributor_person_id && !contributorName) {
    return { success: false, message: 'Record who the contribution came from' }
  }
  if (!input.payment_method) return { success: false, message: 'Record how the contribution was given' }

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
    payment_reference: input.payment_reference?.trim() || null,
    notes: input.notes,
    recorded_by: myPersonId,
  })
  if (error) return { success: false, message: error.message }
  revalidatePath('/admin/account')
  revalidatePath('/transactions')
  revalidatePath('/family-finances')
  return { success: true }
}

// contributeToFund was removed here. It was an exported 'use server' function that
// inserted into fund_contributions through the service role with no permission check
// at all — reachable by any signed-in member via a direct POST. It appeared safe only
// because the one UI that called it sat behind a hardcoded `false`. A boolean hiding a
// button is not a gate, and an ungated service-role INSERT into the family's money is
// not something to leave lying around for the flag to be flipped later.
//
// If open member giving becomes a product feature it returns with its own permission
// resource under Accounting > Transactions, like the other four recording paths.
