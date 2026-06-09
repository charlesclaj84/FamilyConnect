'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

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
}

export interface PnLData {
  totalIncomeCents: number
  totalExpenseCents: number
  payments: DuesPayment[]
  eventBudgets: { id: string; name: string; budget_amount_cents: number }[]
}

export interface DuesPayment {
  id: string
  person_id: string
  person_name: string | null
  schedule_id: string | null
  schedule_label: string | null
  amount_cents: number
  status: string
  payment_date: string
  payment_method: string | null
  notes: string | null
  created_at: string
}

export interface DuesSummary {
  schedule: DuesSchedule
  paid: boolean
  lastPayment: DuesPayment | null
}

export async function getDuesSchedules(): Promise<DuesSchedule[]> {
  const supabase = await createClient()
  const { data } = await supabase
    .from('dues_schedules')
    .select('*')
    .eq('active', true)
    .order('label')
  return data ?? []
}

export async function getMyDuesSummary(): Promise<DuesSummary[]> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return []

  const { data: myPerson } = await supabase
    .from('people')
    .select('id')
    .eq('user_id', user.id)
    .maybeSingle()
  if (!myPerson) return []

  const [schedulesResult, paymentsResult] = await Promise.all([
    supabase.from('dues_schedules').select('*').eq('active', true).order('label'),
    supabase
      .from('dues_payments')
      .select('*')
      .eq('person_id', myPerson.id)
      .order('payment_date', { ascending: false }),
  ])

  const schedules: DuesSchedule[] = schedulesResult.data ?? []
  const payments: DuesPayment[] = (paymentsResult.data ?? []).map(p => ({
    ...p,
    person_name: null,
    schedule_label: null,
  }))

  return schedules.map(schedule => {
    const schedulePayments = payments.filter(p => p.schedule_id === schedule.id)
    const lastPayment = schedulePayments[0] ?? null
    return { schedule, paid: !!lastPayment && lastPayment.status === 'paid', lastPayment }
  })
}

export async function getAllDuesPayments(): Promise<DuesPayment[]> {
  const supabase = await createClient()
  const { data } = await supabase
    .from('dues_payments')
    .select('*, people(first_name, last_name), dues_schedules(label)')
    .order('payment_date', { ascending: false })

  return (data ?? []).map(p => ({
    id: p.id,
    person_id: p.person_id,
    person_name: p.people
      ? `${(p.people as { first_name: string; last_name: string }).first_name} ${(p.people as { first_name: string; last_name: string }).last_name}`
      : null,
    schedule_id: p.schedule_id,
    schedule_label: (p.dues_schedules as { label: string } | null)?.label ?? null,
    amount_cents: p.amount_cents,
    status: p.status,
    payment_date: p.payment_date,
    payment_method: p.payment_method,
    notes: p.notes,
    created_at: p.created_at,
  }))
}

export async function createDuesSchedule(
  input: Omit<DuesSchedule, 'id' | 'active'>
): Promise<{ success: boolean; message?: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { success: false, message: 'Not authenticated' }
  const familyCode: string = user.user_metadata?.family_code ?? ''
  const { error } = await supabase.from('dues_schedules').insert({ ...input, family_code: familyCode, active: true })
  if (error) return { success: false, message: error.message }
  revalidatePath('/account-summary')
  revalidatePath('/admin/account')
  return { success: true }
}

export async function updateDuesSchedule(
  id: string,
  input: Partial<Omit<DuesSchedule, 'id'>>
): Promise<{ success: boolean; message?: string }> {
  const admin = createAdminClient()
  const { error } = await admin.from('dues_schedules').update(input).eq('id', id)
  if (error) return { success: false, message: error.message }
  revalidatePath('/account-summary')
  revalidatePath('/admin/account')
  return { success: true }
}

export async function getFamilyPnL(): Promise<PnLData> {
  const supabase = await createClient()
  const admin = createAdminClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { totalIncomeCents: 0, totalExpenseCents: 0, payments: [], eventBudgets: [] }

  const familyCode: string = user.user_metadata?.family_code ?? ''

  const [paymentsRes, eventsRes] = await Promise.all([
    supabase  // RLS scopes to user's family automatically
      .from('dues_payments')
      .select('*, people(first_name, last_name), dues_schedules(label)')
      .eq('status', 'paid')
      .order('payment_date', { ascending: false }),
    admin
      .from('events')
      .select('id, name, budget_amount_cents')
      .eq('family_code', familyCode)
      .in('status', ['published', 'approved'])
      .is('parent_event_id', null)
      .gt('budget_amount_cents', 0),
  ])

  const payments: DuesPayment[] = (paymentsRes.data ?? []).map(p => ({
    id: p.id,
    person_id: p.person_id,
    person_name: p.people
      ? `${(p.people as any).first_name} ${(p.people as any).last_name}`
      : null,
    schedule_id: p.schedule_id,
    schedule_label: (p.dues_schedules as any)?.label ?? null,
    amount_cents: p.amount_cents,
    status: p.status,
    payment_date: p.payment_date,
    payment_method: p.payment_method,
    notes: p.notes,
    created_at: p.created_at,
  }))

  const eventBudgets = (eventsRes.data ?? []).map(e => ({
    id: e.id,
    name: e.name,
    budget_amount_cents: e.budget_amount_cents,
  }))

  const totalIncomeCents = payments.reduce((sum, p) => sum + (p.amount_cents ?? 0), 0)
  const totalExpenseCents = eventBudgets.reduce((sum, e) => sum + (e.budget_amount_cents ?? 0), 0)

  return { totalIncomeCents, totalExpenseCents, payments, eventBudgets }
}

export async function recordPayment(input: {
  person_id: string
  schedule_id: string | null
  amount_cents: number
  status: 'paid' | 'pending' | 'waived'
  payment_date: string
  payment_method: string | null
  notes: string | null
}): Promise<{ success: boolean; message?: string }> {
  const admin = createAdminClient()
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { success: false, message: 'Not authenticated' }
  const familyCode: string = user.user_metadata?.family_code ?? ''
  const { data: myPerson } = await supabase.from('people').select('id').eq('user_id', user.id).maybeSingle()

  const { error } = await admin.from('dues_payments').insert({
    family_code: familyCode,
    person_id: input.person_id,
    schedule_id: input.schedule_id,
    amount_cents: input.amount_cents,
    status: input.status,
    payment_date: input.payment_date,
    payment_method: input.payment_method,
    notes: input.notes,
    recorded_by: myPerson?.id ?? null,
  })
  if (error) return { success: false, message: error.message }
  revalidatePath('/account-summary')
  revalidatePath('/admin/account')
  return { success: true }
}

export async function getMyPaymentHistory(): Promise<DuesPayment[]> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return []

  const { data: myPerson } = await supabase
    .from('people').select('id').eq('user_id', user.id).maybeSingle()
  if (!myPerson) return []

  const { data } = await supabase
    .from('dues_payments')
    .select('*, dues_schedules(label)')
    .eq('person_id', myPerson.id)
    .order('payment_date', { ascending: false })

  return (data ?? []).map(p => ({
    id: p.id,
    person_id: p.person_id,
    person_name: null,
    schedule_id: p.schedule_id,
    schedule_label: (p.dues_schedules as { label: string } | null)?.label ?? null,
    amount_cents: p.amount_cents,
    status: p.status,
    payment_date: p.payment_date,
    payment_method: p.payment_method,
    notes: p.notes,
    created_at: p.created_at,
  }))
}

export async function deleteDuesSchedule(id: string): Promise<{ success: boolean; message?: string }> {
  const admin = createAdminClient()
  const { error } = await admin.from('dues_schedules').delete().eq('id', id)
  if (error) return { success: false, message: error.message }
  revalidatePath('/admin/account')
  revalidatePath('/account-summary')
  return { success: true }
}
