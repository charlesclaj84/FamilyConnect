'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { getMyFamilyCode, getMyPersonId } from '@/lib/auth/family'
import { can } from '@/lib/auth/permissions'
import { createAdminClient } from '@/lib/supabase/admin'
import {
  annualTotalCents,
  installmentCents,
  nextInstallmentDate,
  currentPeriodStart,
  defaultCadence,
  type PayCadence,
} from '@/lib/dues-utils'
import { routeContribution, type RoutingFund } from '@/lib/fund-routing'

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
  cadence: PayCadence
  hasExplicitPlan: boolean
  annualTotalCents: number
  installmentCents: number
  amountPaidThisPeriodCents: number
  amountPaidTotalCents: number
  remainingBalanceCents: number
  nextInstallmentDate: string | null
  paid: boolean
  lastPayment: DuesPayment | null
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
  totalIncomeCents: number        // paid dues only
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

function mapPayment(p: any): DuesPayment {
  return {
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
  }
}

/** Load active funds with allocation % and current balance, ordered for routing. */
async function getActiveFundsForRouting(admin: AdminClient, familyCode: string): Promise<RoutingFund[]> {
  const [fundsRes, allocRes, contribRes, disbRes, expRes] = await Promise.all([
    admin.from('funds').select('id, priority, minimum_cents, created_at').eq('family_code', familyCode).eq('active', true),
    admin.from('fund_allocations').select('fund_id, basis_points').eq('family_code', familyCode),
    admin.from('fund_contributions').select('fund_id, amount_cents').eq('family_code', familyCode),
    admin.from('fund_disbursements').select('fund_id, amount_cents').eq('family_code', familyCode),
    admin.from('event_expenses').select('fund_id, amount_cents').eq('family_code', familyCode),
  ])

  const bpsByFund = new Map<string, number>((allocRes.data ?? []).map(a => [a.fund_id, a.basis_points]))
  const balByFund = new Map<string, number>()
  const add = (id: string | null, delta: number) => { if (id) balByFund.set(id, (balByFund.get(id) ?? 0) + delta) }
  for (const c of contribRes.data ?? []) add(c.fund_id, c.amount_cents)
  for (const d of disbRes.data ?? []) add(d.fund_id, -d.amount_cents)
  for (const e of expRes.data ?? []) add(e.fund_id, -e.amount_cents)

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

/** Split a paid payment into fund_contributions and stamp routed_at. Idempotent on routed_at. */
async function routePaidPayment(
  admin: AdminClient,
  familyCode: string,
  payment: { id: string; amount_cents: number; payment_date: string; routed_at?: string | null },
  recordedBy: string | null,
): Promise<void> {
  if (payment.routed_at) return
  if (!payment.amount_cents || payment.amount_cents <= 0) return

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

export async function getDuesSchedules(): Promise<DuesSchedule[]> {
  const supabase = await createClient()
  const { data } = await supabase
    .from('dues_schedules')
    .select('*')
    .eq('active', true)
    .order('label')
  return data ?? []
}

export async function createDuesSchedule(
  input: Omit<DuesSchedule, 'id' | 'active'>
): Promise<{ success: boolean; message?: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { success: false, message: 'Not authenticated' }
  const familyCode = await getMyFamilyCode(user.id)
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

export async function deleteDuesSchedule(id: string): Promise<{ success: boolean; message?: string }> {
  const admin = createAdminClient()
  const { error } = await admin.from('dues_schedules').delete().eq('id', id)
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
    supabase.from('dues_member_plans').select('schedule_id, cadence').eq('person_id', myPerson.id),
  ])

  const schedules: DuesSchedule[] = schedulesResult.data ?? []
  const payments: DuesPayment[] = (paymentsResult.data ?? []).map(p => ({ ...p, person_name: null, schedule_label: null }))
  const planBySchedule = new Map<string, PayCadence>(
    (plansResult.data ?? []).map(p => [p.schedule_id, p.cadence as PayCadence]),
  )

  return schedules.map(schedule => {
    const explicit = planBySchedule.get(schedule.id)
    const cadence = explicit ?? defaultCadence(schedule.frequency)
    const annual = annualTotalCents(schedule)
    const installment = installmentCents(annual, cadence)

    const schedulePaid = payments.filter(p => p.schedule_id === schedule.id && p.status === 'paid')
    const periodStart = currentPeriodStart(schedule)
    const paidThisPeriod = schedulePaid.filter(p => p.payment_date >= periodStart)
    const amountPaidThisPeriodCents = paidThisPeriod.reduce((s, p) => s + p.amount_cents, 0)
    const amountPaidTotalCents = schedulePaid.reduce((s, p) => s + p.amount_cents, 0)
    const remainingBalanceCents = Math.max(0, annual - amountPaidThisPeriodCents)
    const paid = remainingBalanceCents <= 0

    return {
      schedule,
      cadence,
      hasExplicitPlan: !!explicit,
      annualTotalCents: annual,
      installmentCents: installment,
      amountPaidThisPeriodCents,
      amountPaidTotalCents,
      remainingBalanceCents,
      nextInstallmentDate: paid ? null : nextInstallmentDate(schedule, cadence, paidThisPeriod.length),
      paid,
      lastPayment: payments.find(p => p.schedule_id === schedule.id) ?? null,
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

export async function clearMyDuesPlan(scheduleId: string): Promise<{ success: boolean; message?: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { success: false, message: 'Not authenticated' }
  const myPersonId = await getMyPersonId(user.id)
  if (!myPersonId) return { success: false, message: 'Profile not found' }
  const myPerson = { id: myPersonId }

  const { error } = await supabase
    .from('dues_member_plans')
    .delete()
    .eq('person_id', myPerson.id)
    .eq('schedule_id', scheduleId)
  if (error) return { success: false, message: error.message }
  revalidatePath('/account-summary')
  revalidatePath('/dashboard')
  return { success: true }
}

// ── Payments ─────────────────────────────────────────────────────────────────

export async function getAllDuesPayments(): Promise<DuesPayment[]> {
  const supabase = await createClient()
  const { data } = await supabase
    .from('dues_payments')
    .select('*, people!person_id(first_name, last_name), dues_schedules(label)')
    .order('payment_date', { ascending: false })
  return (data ?? []).map(mapPayment)
}

export async function getMyPaymentHistory(): Promise<DuesPayment[]> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return []

  const myPersonId = await getMyPersonId(user.id)
  if (!myPersonId) return []
  const myPerson = { id: myPersonId }

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
  const familyCode = await getMyFamilyCode(user.id)
  const { data: myPerson } = await supabase
    .from('people').select('id')
    .eq('user_id', user.id)
    .eq('family_code', familyCode)
    .maybeSingle()
  if (!myPerson) return { success: false, message: 'Profile not found' }

  // A non-admin may only record their own payments.
  if (!(await can(user.id, 'dues', 'edit')) && input.person_id !== myPerson.id) {
    return { success: false, message: 'You can only record your own payments.' }
  }

  const { data: payment, error } = await admin.from('dues_payments').insert({
    family_code: familyCode,
    person_id: input.person_id,
    schedule_id: input.schedule_id,
    amount_cents: input.amount_cents,
    status: input.status,
    payment_date: input.payment_date,
    payment_method: input.payment_method,
    notes: input.notes,
    recorded_by: myPerson.id,
  }).select('id, amount_cents, payment_date, routed_at').single()
  if (error || !payment) return { success: false, message: error?.message ?? 'Failed to record payment' }

  // Route paid dues into funds (waterfall split). Only paid payments contribute.
  if (input.status === 'paid') {
    await routePaidPayment(admin, familyCode, payment, myPerson.id)
  }

  revalidatePath('/account-summary')
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

  // Paid dues for the family. dues_payments has TWO foreign keys to people
  // (person_id and recorded_by), so the people embed MUST be disambiguated to
  // person_id — otherwise PostgREST errors and the result is silently empty.
  const PAYMENT_SELECT = '*, people!person_id(first_name, last_name), dues_schedules(label)'
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

  const payments: DuesPayment[] = [...paymentById.values()]
    .map(mapPayment)
    .sort((a, b) => b.payment_date.localeCompare(a.payment_date))
  const totalIncomeCents = payments.reduce((s, p) => s + (p.amount_cents ?? 0), 0)

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
