'use server'

import { requireRead } from '@/lib/auth/guard'
import { createAdminClient } from '@/lib/supabase/admin'
import { embedOne } from '@/lib/supabase/embed'
import { todayLocal } from '@/lib/date-utils'

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
  /**
   * GATHERINGS, NOT EVENTS, since 2026-08-19. These two counted `events` and were the
   * headline of a KPI card captioned "Events"; that product is retired, and the count that
   * means the same thing now is of gatherings. `avgRsvpRate` went with it and has NO
   * replacement — nothing in this product records who is coming to anything — so the card is
   * gone rather than showing a dash forever.
   */
  totalGatherings: number
  upcomingGatherings: number
  duesCollectedCents: number
  duesOutstandingCents: number
  /**
   * READ OFF `people` NOW, not off RSVP attendees.
   *
   * It used to count `event_rsvp_attendees` joined to `people`, which answered "what will we
   * need to print for the people who said they are coming". There is no attendee list any
   * more, and the sizes themselves never lived there — `tshirt_category` and `tshirt_size` are
   * columns on a member's own profile. So this is now the whole family's sizes, which is a
   * different and simpler question ("what does this family wear") and the one the data can
   * actually answer.
   */
  tshirtBreakdown: { category: string; size: string; count: number }[]
  recentActivity: FinancialActivity[]
}

/** Every figure absent. Returned when the caller may not read this screen at all. */
const NOTHING: OrgStats = {
  totalMembers: 0, totalRecords: 0, membersByChapter: [], totalGatherings: 0,
  upcomingGatherings: 0, duesCollectedCents: 0, duesOutstandingCents: 0,
  tshirtBreakdown: [], recentActivity: [],
}

/**
 * ── IT DEMANDED NOTHING BUT A SESSION UNTIL 2026-08-19 ──────────────────────────────
 * This is a `'use server'` export, so it has a URL, and it publishes the family's dues
 * collected, its dues outstanding and its twenty most recent money entries with the name of
 * whoever recorded each. `/admin/reports` being `status: 'future'` withheld the PAGE and did
 * nothing whatever to this (AGENTS.md, "Coming Soon withholds a page. It does not withhold an
 * action") — the same shape `/admin/chapters` and `/admin/boardpositions` were both found in
 * on being relit. `requireRead` matches the `requireView` the page already makes.
 */
export async function getOrgStats(): Promise<OrgStats> {
  const g = await requireRead('admin/reports')
  if (!g.ok) return NOTHING

  const admin = createAdminClient()
  const familyCode = g.familyCode

  const [
    membersResult,
    recordsResult,
    chapterResult,
    gatheringsResult,
    duesPaidResult,
    tshirtResult,
    peopleNamesResult,
    contributionsResult,
    disbursementsResult,
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
    // A cancelled gathering is not one the family has, exactly as a cancelled event was not.
    // `ends_on` comes back so "upcoming" can use the same span reading the calendar does: a
    // reunion running over today has not happened yet.
    admin.from('gatherings').select('id, starts_on, ends_on', { count: 'exact' }).eq('family_code', familyCode).neq('status', 'cancelled'),
    admin.from('dues_payments').select('id, amount_cents, status, payment_date, recorded_by').eq('family_code', familyCode),
    // The sizes live on the member's own profile — see the note on `tshirtBreakdown`. Only
    // approved members are counted: an applicant has not joined, and a size entered while
    // waiting is not something to order against.
    admin.from('people').select('tshirt_category, tshirt_size')
      .eq('family_code', familyCode)
      .eq('membership_status', 'approved'),
    admin.from('people').select('id, first_name, last_name').eq('family_code', familyCode),
    admin.from('fund_contributions').select('id, amount_cents, contributed_date, recorded_by').eq('family_code', familyCode),
    admin.from('fund_disbursements').select('id, amount_cents, disbursed_date, recorded_by').eq('family_code', familyCode),
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

  // Gatherings. `todayLocal()` and a string comparison, never `new Date(...) >= new Date()`:
  // `starts_on` is a bare DATE, and `new Date('2026-08-19')` is UTC midnight, which is a day
  // out for half the country every evening. Same rule `lib/calendar.ts` states at length —
  // and the old events version above got it wrong, which is why this one is written out.
  //
  // A multi-day gathering counts as upcoming on every day it covers, which is
  // `gatheringTiming(...) !== 'past'` said in one line.
  const today = todayLocal()
  const gatherings = (gatheringsResult.data ?? []) as { starts_on: string | null; ends_on: string | null }[]
  const upcomingGatherings = gatherings.filter(row => {
    if (!row.starts_on) return false
    const last = row.ends_on && row.ends_on > row.starts_on ? row.ends_on : row.starts_on
    return last >= today
  }).length

  // Dues
  const payments = duesPaidResult.data ?? []
  const duesCollectedCents = payments.filter(p => p.status === 'paid').reduce((sum, p) => sum + (p.amount_cents ?? 0), 0)
  const duesOutstandingCents = payments.filter(p => p.status === 'pending').reduce((sum, p) => sum + (p.amount_cents ?? 0), 0)

  // T-shirt breakdown, straight off the profiles — no embed, so no PGRST201 to guard against.
  const shirtCounts = new Map<string, number>()
  for (const p of (tshirtResult.data ?? []) as { tshirt_category: string | null; tshirt_size: string | null }[]) {
    if (p.tshirt_category && p.tshirt_size) {
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
    // THERE WAS A FOURTH KIND HERE — 'Event expense', off `event_expenses` — and that table
    // is dropped (`20260819000006`) along with its term in `fund_balance_cents()`. A
    // disbursement is now the only outgoing this product records, so these three are the
    // whole of the family's money movement.
  ]
    .sort((a, b) => b.date.localeCompare(a.date))
    .slice(0, 20)

  return {
    totalMembers: membersResult.count ?? 0,
    totalRecords: recordsResult.count ?? 0,
    membersByChapter,
    totalGatherings: gatheringsResult.count ?? 0,
    upcomingGatherings,
    duesCollectedCents,
    duesOutstandingCents,
    tshirtBreakdown,
    recentActivity,
  }
}
