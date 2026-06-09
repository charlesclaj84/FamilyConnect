'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

export interface Fund {
  id: string
  name: string
  description: string | null
  goal_cents: number | null
  active: boolean
  created_at: string
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
  notes: string | null
  created_at: string
}

export interface FundWithStats extends Fund {
  total_disbursed_cents: number
  milestone_count: number
}

// -------------------------------------------------------
// Reads
// -------------------------------------------------------

export async function getFunds(): Promise<FundWithStats[]> {
  const supabase = await createClient()
  const { data } = await supabase
    .from('funds')
    .select('*, fund_milestones(id), fund_disbursements(amount_cents)')
    .eq('active', true)
    .order('name')

  return (data ?? []).map(f => ({
    id: f.id,
    name: f.name,
    description: f.description,
    goal_cents: f.goal_cents,
    active: f.active,
    created_at: f.created_at,
    total_disbursed_cents: ((f.fund_disbursements as any[]) ?? []).reduce(
      (sum: number, d: any) => sum + (d.amount_cents ?? 0),
      0
    ),
    milestone_count: ((f.fund_milestones as any[]) ?? []).length,
  }))
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
}): Promise<{ success: boolean; id?: string; message?: string }> {
  const supabase = await createClient()
  const admin = createAdminClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { success: false, message: 'Not authenticated' }

  const familyCode: string = user.user_metadata?.family_code ?? ''
  const { data: myPerson } = await supabase.from('people').select('id').eq('user_id', user.id).maybeSingle()

  const { data, error } = await admin.from('funds').insert({
    family_code: familyCode,
    name: input.name.trim(),
    description: input.description.trim() || null,
    goal_cents: input.goal_cents,
    created_by: myPerson?.id ?? null,
  }).select('id').single()

  if (error) return { success: false, message: error.message }
  revalidatePath('/account-summary')
  revalidatePath('/admin/account')
  return { success: true, id: data.id }
}

export async function updateFund(
  id: string,
  input: { name?: string; description?: string; goal_cents?: number | null; active?: boolean }
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

export async function createMilestone(
  fundId: string,
  input: { name: string; description: string; amount_cents: number; sort_order?: number }
): Promise<{ success: boolean; message?: string }> {
  const supabase = await createClient()
  const admin = createAdminClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { success: false, message: 'Not authenticated' }

  const familyCode: string = user.user_metadata?.family_code ?? ''
  const { error } = await admin.from('fund_milestones').insert({
    fund_id: fundId,
    family_code: familyCode,
    name: input.name.trim(),
    description: input.description.trim() || null,
    amount_cents: input.amount_cents,
    sort_order: input.sort_order ?? 0,
  })

  if (error) return { success: false, message: error.message }
  revalidatePath('/admin/account')
  return { success: true }
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
  notes: string | null
}): Promise<{ success: boolean; message?: string }> {
  const supabase = await createClient()
  const admin = createAdminClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { success: false, message: 'Not authenticated' }

  const familyCode: string = user.user_metadata?.family_code ?? ''
  const { data: myPerson } = await supabase.from('people').select('id').eq('user_id', user.id).maybeSingle()

  const { error } = await admin.from('fund_disbursements').insert({
    fund_id: input.fund_id,
    milestone_id: input.milestone_id,
    family_code: familyCode,
    person_id: input.person_id,
    amount_cents: input.amount_cents,
    disbursed_date: input.disbursed_date,
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
