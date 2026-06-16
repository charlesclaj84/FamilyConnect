'use server'

import { createClient } from '@/lib/supabase/server'
import { getMyFamilyCode } from '@/lib/auth/family'
import { createAdminClient } from '@/lib/supabase/admin'

export interface FinancialActivity {
  id: string
  date: string
  type: string
  amountCents: number
  recordedBy: string | null
}

export interface OrgStats {
  totalMembers: number
  totalMinors: number
  membersByChapter: { chapter_name: string; count: number }[]
  totalEvents: number
  upcomingEvents: number
  avgRsvpRate: number | null
  duesCollectedCents: number
  duesOutstandingCents: number
  tshirtBreakdown: { category: string; size: string; count: number }[]
  recentActivity: FinancialActivity[]
}

export async function getOrgStats(): Promise<OrgStats> {
  const supabase = await createClient()
  const admin = createAdminClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return {
      totalMembers: 0, totalMinors: 0, membersByChapter: [], totalEvents: 0,
      upcomingEvents: 0, avgRsvpRate: null, duesCollectedCents: 0,
      duesOutstandingCents: 0, tshirtBreakdown: [], recentActivity: [],
    }
  }
  const familyCode = await getMyFamilyCode(user.id)

  const [
    membersResult,
    minorsResult,
    chapterResult,
    eventsResult,
    rsvpResult,
    duesPaidResult,
    tshirtResult,
    peopleNamesResult,
    contributionsResult,
    disbursementsResult,
    expensesResult,
  ] = await Promise.all([
    admin.from('people').select('id', { count: 'exact', head: true }).eq('family_code', familyCode).eq('is_minor', false).not('user_id', 'is', null),
    admin.from('people').select('id', { count: 'exact', head: true }).eq('family_code', familyCode).eq('is_minor', true),
    admin.from('people').select('chapters(name)').eq('family_code', familyCode).eq('is_minor', false).not('user_id', 'is', null),
    admin.from('events').select('id, status, start_date', { count: 'exact' }).eq('family_code', familyCode).neq('status', 'cancelled'),
    admin.from('event_rsvp').select('event_id').eq('family_code', familyCode),
    admin.from('dues_payments').select('id, amount_cents, status, payment_date, recorded_by').eq('family_code', familyCode),
    admin.from('event_rsvp_attendees')
      .select('people(tshirt_category, tshirt_size)')
      .eq('is_attending', true)
      .not('people', 'is', null),
    admin.from('people').select('id, first_name, last_name').eq('family_code', familyCode),
    admin.from('fund_contributions').select('id, amount_cents, contributed_date, recorded_by').eq('family_code', familyCode),
    admin.from('fund_disbursements').select('id, amount_cents, disbursed_date, recorded_by').eq('family_code', familyCode),
    admin.from('event_expenses').select('id, amount_cents, spent_date, recorded_by').eq('family_code', familyCode),
  ])

  // Members by chapter
  const chapterCounts = new Map<string, number>()
  for (const p of chapterResult.data ?? []) {
    const name = (p.chapters as any)?.name ?? 'No Chapter'
    chapterCounts.set(name, (chapterCounts.get(name) ?? 0) + 1)
  }
  const membersByChapter = [...chapterCounts.entries()]
    .map(([chapter_name, count]) => ({ chapter_name, count }))
    .sort((a, b) => b.count - a.count)

  // Events
  const events = eventsResult.data ?? []
  const upcomingEvents = events.filter(e => e.start_date && new Date(e.start_date) >= new Date()).length

  // RSVP rate (unique events with at least one RSVP / total published events)
  const eventsWithRsvp = new Set((rsvpResult.data ?? []).map(r => r.event_id)).size
  const publishedEvents = events.filter(e => e.status === 'published' || e.status === 'approved').length
  const avgRsvpRate = publishedEvents > 0 ? Math.round((eventsWithRsvp / publishedEvents) * 100) : null

  // Dues
  const payments = duesPaidResult.data ?? []
  const duesCollectedCents = payments.filter(p => p.status === 'paid').reduce((sum, p) => sum + (p.amount_cents ?? 0), 0)
  const duesOutstandingCents = payments.filter(p => p.status === 'pending').reduce((sum, p) => sum + (p.amount_cents ?? 0), 0)

  // T-shirt breakdown
  const shirtCounts = new Map<string, number>()
  for (const row of tshirtResult.data ?? []) {
    const p = (row.people as any) ?? null
    if (p?.tshirt_category && p.tshirt_size) {
      const key = `${p.tshirt_category}::${p.tshirt_size}`
      shirtCounts.set(key, (shirtCounts.get(key) ?? 0) + 1)
    }
  }
  const tshirtBreakdown = [...shirtCounts.entries()]
    .map(([key, count]) => {
      const [category, size] = key.split('::')
      return { category, size, count }
    })
    .sort((a, b) => b.count - a.count)

  // Recent financial activity — tagged with the user who recorded each entry.
  const nameById = new Map<string, string>(
    (peopleNamesResult.data ?? []).map(p => [p.id, `${p.first_name} ${p.last_name}`.trim()]),
  )
  const nameOf = (id: string | null) => (id ? (nameById.get(id) ?? null) : null)
  const recentActivity: FinancialActivity[] = [
    ...(duesPaidResult.data ?? []).filter(p => p.status === 'paid').map(p => ({
      id: `pay-${p.id}`, date: p.payment_date, type: 'Dues payment', amountCents: p.amount_cents, recordedBy: nameOf(p.recorded_by),
    })),
    ...(contributionsResult.data ?? []).map(c => ({
      id: `con-${c.id}`, date: c.contributed_date, type: 'Fund contribution', amountCents: c.amount_cents, recordedBy: nameOf(c.recorded_by),
    })),
    ...(disbursementsResult.data ?? []).map(d => ({
      id: `dis-${d.id}`, date: d.disbursed_date, type: 'Fund disbursement', amountCents: -d.amount_cents, recordedBy: nameOf(d.recorded_by),
    })),
    ...(expensesResult.data ?? []).map(e => ({
      id: `exp-${e.id}`, date: e.spent_date, type: 'Event expense', amountCents: -e.amount_cents, recordedBy: nameOf(e.recorded_by),
    })),
  ]
    .sort((a, b) => b.date.localeCompare(a.date))
    .slice(0, 20)

  return {
    totalMembers: membersResult.count ?? 0,
    totalMinors: minorsResult.count ?? 0,
    membersByChapter,
    totalEvents: eventsResult.count ?? 0,
    upcomingEvents,
    avgRsvpRate,
    duesCollectedCents,
    duesOutstandingCents,
    tshirtBreakdown,
    recentActivity,
  }
}
