'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { can } from '@/lib/auth/permissions'
import { getMyFamilyCode, getMyPersonId } from '@/lib/auth/family'
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

export async function getAllDisbursements(): Promise<FundDisbursement[]> {
  const supabase = await createClient()
  const { data } = await supabase
    .from('fund_disbursements')
    .select('*, funds(name), fund_milestones(name), people(first_name, last_name)')
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

export async function getDisbursementsForFund(fundId: string): Promise<FundDisbursement[]> {
  const supabase = await createClient()
  const { data } = await supabase
    .from('fund_disbursements')
    .select('*, funds(name), fund_milestones(name), people(first_name, last_name)')
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
  const admin = createAdminClient()
  const { error } = await admin.from('funds').update(input).eq('id', id)
  if (error) return { success: false, message: error.message }
  revalidatePath('/account-summary')
  revalidatePath('/admin/account')
  return { success: true }
}

export async function deleteFund(id: string): Promise<{ success: boolean; message?: string }> {
  const admin = createAdminClient()
  const { error } = await admin.from('funds').delete().eq('id', id)
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
  const admin = createAdminClient()
  const { error } = await admin.from('fund_milestones').update(input).eq('id', id)
  if (error) return { success: false, message: error.message }
  revalidatePath('/admin/account')
  return { success: true }
}

export async function deleteMilestone(id: string): Promise<{ success: boolean; message?: string }> {
  const admin = createAdminClient()
  const { error } = await admin.from('fund_milestones').delete().eq('id', id)
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
  const { data: myPerson } = await supabase.from('people').select('id').eq('user_id', user.id).maybeSingle()

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
  return { success: true }
}

export async function deleteDisbursement(id: string): Promise<{ success: boolean; message?: string }> {
  const admin = createAdminClient()
  const { error } = await admin.from('fund_disbursements').delete().eq('id', id)
  if (error) return { success: false, message: error.message }
  revalidatePath('/account-summary')
  revalidatePath('/admin/account')
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
  if (!(await can(user.id, 'family-finances', 'edit'))) return { success: false, message: 'Not authorized' }
  const myPersonId = await getMyPersonId(user.id)

  // Allocations must total exactly 100% (or all zero to disable routing).
  const totalBps = rows.reduce((s, r) => s + Math.round(r.basis_points), 0)
  if (totalBps !== 0 && totalBps !== 10000) {
    return { success: false, message: `Allocations must total 100% (currently ${(totalBps / 100).toFixed(2)}%)` }
  }

  // Persist priority/minimum onto the funds themselves.
  for (const r of rows) {
    const { error } = await admin
      .from('funds')
      .update({ priority: Math.round(r.priority), minimum_cents: Math.round(r.minimum_cents) })
      .eq('id', r.fund_id)
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
  if (!(await can(user.id, 'family-finances', 'edit'))) return { success: false, message: 'Not authorized' }
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
  revalidatePath('/family-finances')
  return { success: true }
}

/** Voluntary member contribution to a fund flagged open_contributions. Any family member may use this. */
export async function contributeToFund(input: {
  fund_id: string
  amount_cents: number
  notes: string | null
}): Promise<{ success: boolean; message?: string }> {
  const supabase = await createClient()
  const admin = createAdminClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { success: false, message: 'Not authenticated' }
  if (input.amount_cents <= 0) return { success: false, message: 'Enter an amount greater than $0' }

  const familyCode = await getMyFamilyCode(user.id)
  const myPersonId = await getMyPersonId(user.id)
  if (!myPersonId) return { success: false, message: 'Profile not found' }

  // The fund must belong to this family and be open to member contributions.
  const { data: fund } = await admin
    .from('funds').select('id, open_contributions').eq('id', input.fund_id).eq('family_code', familyCode).maybeSingle()
  if (!fund) return { success: false, message: 'Fund not found' }
  if (!fund.open_contributions) return { success: false, message: 'This fund is not open to member contributions' }

  const { error } = await admin.from('fund_contributions').insert({
    fund_id: input.fund_id,
    family_code: familyCode,
    amount_cents: input.amount_cents,
    source: 'member_contribution',
    contributed_date: new Date().toISOString().slice(0, 10),
    // Giver and recorder are the same person here, by definition of this path.
    contributor_person_id: myPersonId,
    notes: input.notes,
    recorded_by: myPersonId,
  })
  if (error) return { success: false, message: error.message }
  revalidatePath('/family-finances')
  revalidatePath('/admin/account')
  return { success: true }
}
