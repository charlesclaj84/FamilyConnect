'use server'

import { createClient } from '@/lib/supabase/server'
import { getMyFamilyCode } from '@/lib/auth/family'
import { createAdminClient } from '@/lib/supabase/admin'
import { embedOne } from '@/lib/supabase/embed'

export interface FinancialActivity {
  id: string
  date: string
  type: string
  amountCents: number
  recordedBy: string | null
}

export interface OrgStats {
  /** People with an account — they can sign in. */
  totalMembers: number
  /**
   * People recorded by somebody else and holding no account: children, elders with no
   * email address, relatives who have died. Family, and not sign-ins.
   *
   * THIS REPLACED `totalMinors` on 2026-08-13, and it is not a rename. That number
   * counted `people.is_minor`, a stored boolean written only by the retired
   * /direct-lineage flow — so in production it was 0 for every family however many
   * children they had, and the Reports page said "+ 0 minors" underneath a member count
   * that was also excluding those children. The split that means something is whether
   * anybody can reach them, which is the same line the tree draws with its "Record only"
   * pill and the money pickers draw with `user_id IS NOT NULL`.
   */
  totalRecords: number
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
      totalMembers: 0, totalRecords: 0, membersByChapter: [], totalEvents: 0,
      upcomingEvents: 0, avgRsvpRate: null, duesCollectedCents: 0,
      duesOutstandingCents: 0, tshirtBreakdown: [], recentActivity: [],
    }
  }
  const familyCode = await getMyFamilyCode(user.id)

  const [
    membersResult,
    recordsResult,
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
    // The two halves of the roster, and between them they now cover it — which the pair
    // they replaced did not. `is_minor` came off with the column (20260813000006); the
    // second query flipped from "minors" to "people with no account", so a child, an
    // elder with no email and a relative who has died are all counted somewhere instead
    // of falling between the two.
    admin.from('people').select('id', { count: 'exact', head: true }).eq('family_code', familyCode).not('user_id', 'is', null),
    admin.from('people').select('id', { count: 'exact', head: true }).eq('family_code', familyCode).is('user_id', null),
    // Chapters are a membership thing — a record nobody administers has no chapter to
    // report — so this half stays scoped to people with accounts.
    admin.from('people').select('chapters(name)').eq('family_code', familyCode).not('user_id', 'is', null),
    admin.from('events').select('id, status, start_date', { count: 'exact' }).eq('family_code', familyCode).neq('status', 'cancelled'),
    admin.from('event_rsvp').select('event_id').eq('family_code', familyCode),
    admin.from('dues_payments').select('id, amount_cents, status, payment_date, recorded_by').eq('family_code', familyCode),
    admin.from('event_rsvp_attendees')
      // person_id, not checked_in_by — a bare `people(...)` is ambiguous here and
      // PostgREST refuses the whole query (PGRST201), zeroing the t-shirt counts.
      .select('people!event_rsvp_attendees_person_id_fkey(tshirt_category, tshirt_size)')
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
    const name = embedOne<{ name: string }>(p.chapters)?.name ?? 'No Chapter'
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
    const p = embedOne<{ tshirt_category: string | null; tshirt_size: string | null }>(row.people)
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
    totalRecords: recordsResult.count ?? 0,
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
