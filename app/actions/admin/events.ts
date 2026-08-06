'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { can } from '@/lib/auth/permissions'
import { requireRead } from '@/lib/auth/guard'
import { getMyFamilyCode, belongsToFamily } from '@/lib/auth/family'
import { createAdminClient } from '@/lib/supabase/admin'

export interface AdminEvent {
  id: string
  family_code: string
  event_type_id: string | null
  parent_event_id: string | null
  name: string
  description: string | null
  event_date: string | null
  event_time: string | null
  start_date: string | null
  end_date: string | null
  is_all_day: boolean
  start_time: string | null
  end_time: string | null
  location: string | null
  street_address: string | null
  suite: string | null
  city: string | null
  state: string | null
  zip_code: string | null
  country: string | null
  rsvp_deadline: string | null
  status: 'draft' | 'published' | 'approved' | 'cancelled'
  created_by: string | null
  approved_by: string | null
  approved_at: string | null
  created_at: string
  event_type_name?: string | null
  budget_amount_cents: number
  official_description: string | null
  budget_closed_at: string | null
  sort_order: number
}

export interface PriceEstimate {
  id: string
  hotel_booking_id: string
  room_type: string
  amount: number
  created_at: string
}

export interface HotelBookingDetail {
  id: string
  hotel_booking_id: string
  key: string
  value: string
  sort_order: number
}

export interface HotelBooking {
  id: string
  event_id: string
  hotel_name: string
  street_address: string | null
  suite: string | null
  city: string | null
  state: string | null
  zip_code: string | null
  country: string | null
  booking_code: string | null
  booking_deadline: string | null
  website: string | null
  phone: string | null
  created_at: string
  estimates: PriceEstimate[]
  details: HotelBookingDetail[]
}

export interface EventAssignment {
  id: string
  event_id: string
  blueprint_item_id: string
  blueprint_item_title: string
  assigned_to: string | null
  assigned_to_name: string | null
  is_complete: boolean
  completed_at: string | null
  due_date: string | null
  response: string | null
  response_status: 'pending' | 'submitted' | 'approved' | 'cancelled'
  approved_by: string | null
  approved_at: string | null
}

export interface EventReport {
  event: AdminEvent
  headcount: number
  attendees: { name: string; tshirt_category: string | null; tshirt_size: string | null }[]
  tshirt_breakdown: { category: string; size: string; count: number }[]
  non_respondents: { name: string }[]
  total_family_members: number
}

async function getAuthenticatedAdmin() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { user: null, admin: null, adminClient: null, familyCode: '', canApprove: false }

  const adminClient = createAdminClient()

  // Authority is `can()` alone. There is no people.is_admin / can_approve lookup
  // here any more — 20260618000002 dropped both columns.
  const [familyCode, mayEdit] = await Promise.all([
    getMyFamilyCode(user.id),
    can(user.id, 'admin/events', 'edit'),
  ])

  return {
    user,
    admin: mayEdit ? adminClient : null,
    adminClient,
    familyCode,
    canApprove: mayEdit,
  }
}

export async function getEvents(status?: AdminEvent['status']): Promise<AdminEvent[]> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return []

  const familyCode = await getMyFamilyCode(user.id)
  const admin = createAdminClient()

  let query = admin
    .from('events')
    .select('*, event_types(name)')
    .eq('family_code', familyCode)
    .is('parent_event_id', null)          // top-level events only
    .order('event_date', { ascending: true, nullsFirst: false })

  if (status) query = query.eq('status', status)

  const { data } = await query

  return (data ?? []).map(e => ({
    ...e,
    event_type_name: (e.event_types as unknown as { name: string } | null)?.name ?? null,
  })) as AdminEvent[]
}

type AddressInput = {
  street_address?: string; suite?: string; city?: string
  state?: string; zip_code?: string; country?: string
}

export async function createEvent(input: {
  name: string
  description?: string
  official_description?: string
  budget_amount_cents?: number
  event_type_id?: string
  start_date?: string
  end_date?: string
  is_all_day?: boolean
  start_time?: string
  end_time?: string
  location?: string
  rsvp_deadline?: string
} & AddressInput): Promise<{ success: boolean; id?: string; error?: string }> {
  const { user, admin, familyCode } = await getAuthenticatedAdmin()
  if (!admin) return { success: false, error: 'Not authorized' }

  const { data, error } = await admin
    .from('events')
    .insert({
      family_code:    familyCode,
      name:           input.name.trim(),
      description:    input.description?.trim() || null,
      event_type_id:  input.event_type_id || null,
      start_date:     input.start_date || null,
      end_date:       input.end_date || null,
      is_all_day:     input.is_all_day ?? true,
      start_time:     input.is_all_day ? null : (input.start_time || null),
      end_time:       input.is_all_day ? null : (input.end_time || null),
      location:       input.location?.trim() || null,
      street_address: input.street_address?.trim() || null,
      suite:          input.suite?.trim() || null,
      city:           input.city?.trim() || null,
      state:          input.state?.trim() || null,
      zip_code:       input.zip_code?.trim() || null,
      country:        input.country?.trim() || null,
      rsvp_deadline:        input.rsvp_deadline || null,
      official_description: input.official_description?.trim() || null,
      budget_amount_cents:  input.budget_amount_cents ?? 0,
      status:               'draft',
      created_by:           user!.id,
    })
    .select('id')
    .single()

  if (error) return { success: false, error: error.message }

  // Auto-include the template's linked child templates as sub-events. Single level
  // only — a child template's own sub-templates are not expanded (sub-events can't nest).
  if (input.event_type_id) {
    const { data: subLinks } = await admin
      .from('event_type_sub_templates')
      .select('child_event_type_id, sort_order')
      .eq('parent_event_type_id', input.event_type_id)
      .order('sort_order')

    if (subLinks?.length) {
      const childIds = subLinks.map(l => l.child_event_type_id)
      const { data: childTypes } = await admin.from('event_types').select('id, name').in('id', childIds)
      const nameById = Object.fromEntries((childTypes ?? []).map(t => [t.id, t.name]))

      const rows = subLinks.map((l, i) => ({
        family_code:     familyCode,
        parent_event_id: data.id,
        event_type_id:   l.child_event_type_id,
        name:            nameById[l.child_event_type_id] ?? 'Sub-Event',
        is_all_day:      true,
        status:          'draft' as const,
        sort_order:      i + 1,
        created_by:      user!.id,
      }))
      await admin.from('events').insert(rows)
    }
  }

  revalidatePath('/admin/events')
  return { success: true, id: data.id }
}

export async function createSubEvent(
  parentId: string,
  input: { name: string; description?: string; official_description?: string; start_date?: string; end_date?: string; is_all_day?: boolean; start_time?: string; end_time?: string; location?: string; event_type_id?: string } & AddressInput
): Promise<{ success: boolean; id?: string; error?: string }> {
  const { user, admin, familyCode } = await getAuthenticatedAdmin()
  if (!admin) return { success: false, error: 'Not authorized' }

  const { data: parent } = await admin.from('events').select('family_code, status, parent_event_id').eq('id', parentId).single()
  if (!parent) return { success: false, error: 'Parent event not found' }
  if (parent.parent_event_id) return { success: false, error: 'Sub-events cannot be nested further' }

  // Append to the end of the parent's existing sub-events.
  const { data: lastSub } = await admin
    .from('events').select('sort_order').eq('parent_event_id', parentId)
    .order('sort_order', { ascending: false }).limit(1).maybeSingle()

  const { data, error } = await admin
    .from('events')
    .insert({
      family_code:     familyCode,
      parent_event_id: parentId,
      sort_order:      (lastSub?.sort_order ?? 0) + 1,
      event_type_id:   input.event_type_id || null,
      name:            input.name.trim(),
      description:     input.description?.trim() || null,
      start_date:      input.start_date || null,
      end_date:        input.end_date || null,
      is_all_day:      input.is_all_day ?? true,
      start_time:      input.is_all_day ? null : (input.start_time || null),
      end_time:        input.is_all_day ? null : (input.end_time || null),
      location:        input.location?.trim() || null,
      street_address:  input.street_address?.trim() || null,
      suite:           input.suite?.trim() || null,
      city:            input.city?.trim() || null,
      state:           input.state?.trim() || null,
      zip_code:        input.zip_code?.trim() || null,
      country:              input.country?.trim() || null,
      official_description: input.official_description?.trim() || null,
      status:               parent.status,
      created_by:           user!.id,
    })
    .select('id')
    .single()

  if (error) return { success: false, error: error.message }
  revalidatePath(`/admin/events/${parentId}`)
  return { success: true, id: data?.id }
}

/**
 * Sub-events of one event. Reachable from BOTH the admin detail screen and the
 * member-facing /events/[id], so it accepts either view grant.
 *
 * `parent_event_id` carries no family of its own, so filtering on it alone returns
 * another family's itinerary to anyone who posts their event id here. The parent is
 * confirmed into the caller's family first, and the query is family-scoped anyway —
 * this runs on the service role, where RLS does nothing.
 */
export async function getSubEvents(parentId: string): Promise<AdminEvent[]> {
  const g = await requireRead('admin/events', 'events')
  if (!g.ok) return []
  if (!(await belongsToFamily('events', parentId, g.familyCode))) return []

  const admin = createAdminClient()
  const { data } = await admin
    .from('events')
    .select('*')
    .eq('family_code', g.familyCode)
    .eq('parent_event_id', parentId)
    .order('sort_order', { ascending: true })
    .order('event_date', { ascending: true, nullsFirst: false })
    .order('event_time', { ascending: true, nullsFirst: false })
  return (data ?? []) as AdminEvent[]
}

export async function moveSubEvent(
  id: string,
  parentId: string,
  direction: 'up' | 'down'
): Promise<{ success: boolean; error?: string }> {
  const { admin } = await getAuthenticatedAdmin()
  if (!admin) return { success: false, error: 'Not authorized' }

  // Same order as getSubEvents so neighbours match what's displayed.
  const { data: subs } = await admin
    .from('events')
    .select('id, sort_order')
    .eq('parent_event_id', parentId)
    .order('sort_order', { ascending: true })
    .order('event_date', { ascending: true, nullsFirst: false })
    .order('event_time', { ascending: true, nullsFirst: false })

  if (!subs?.length) return { success: false, error: 'No sub-events found' }

  const idx = subs.findIndex(s => s.id === id)
  if (idx === -1) return { success: false, error: 'Sub-event not found' }

  const swapIdx = direction === 'up' ? idx - 1 : idx + 1
  if (swapIdx < 0 || swapIdx >= subs.length) return { success: true } // at a boundary

  const current = subs[idx]
  const swap    = subs[swapIdx]
  await admin.from('events').update({ sort_order: swap.sort_order }).eq('id', current.id)
  await admin.from('events').update({ sort_order: current.sort_order }).eq('id', swap.id)

  revalidatePath(`/admin/events/${parentId}`)
  return { success: true }
}

export async function updateEvent(
  id: string,
  input: Partial<{ name: string; description: string; official_description: string; budget_amount_cents: number; start_date: string; end_date: string; is_all_day: boolean; start_time: string; end_time: string; location: string; rsvp_deadline: string; event_type_id: string } & AddressInput>
): Promise<{ success: boolean; error?: string }> {
  const { admin } = await getAuthenticatedAdmin()
  if (!admin) return { success: false, error: 'Not authorized' }

  // Passed events are read-only — mirror the UI lockout so a stale/forged client
  // can't edit history. Effective end is end_date → start_date → legacy event_date.
  const { data: existing } = await admin
    .from('events').select('event_date, start_date, end_date').eq('id', id).maybeSingle()
  const effectiveEnd = existing?.end_date ?? existing?.start_date ?? existing?.event_date
  if (effectiveEnd && effectiveEnd.slice(0, 10) < new Date().toISOString().slice(0, 10)) {
    return { success: false, error: 'This event has passed and can no longer be edited.' }
  }

  const { error } = await admin.from('events').update({
    ...input,
    name: input.name?.trim(),
    description: input.description?.trim() || null,
    location: input.location?.trim() || null,
  }).eq('id', id)

  if (error) return { success: false, error: error.message }
  revalidatePath('/admin/events')
  revalidatePath(`/admin/events/${id}`)
  return { success: true }
}

export async function publishEvent(id: string): Promise<{ success: boolean; error?: string }> {
  const { admin } = await getAuthenticatedAdmin()
  if (!admin) return { success: false, error: 'Not authorized' }

  const { error } = await admin.from('events').update({ status: 'published' }).eq('id', id)
  if (error) return { success: false, error: error.message }

  // Auto-create a photo collection for the event when it goes live
  const { getOrCreateEventCollection } = await import('@/app/actions/photos')
  await getOrCreateEventCollection(id).catch(() => null)

  revalidatePath('/admin/events')
  revalidatePath('/events')
  return { success: true }
}

export async function approveEvent(id: string): Promise<{ success: boolean; error?: string }> {
  const { user, adminClient, canApprove } = await getAuthenticatedAdmin()
  if (!user) return { success: false, error: 'Not authenticated' }
  if (!canApprove) return { success: false, error: 'You do not have event approval authority' }

  const { error } = await adminClient
    .from('events')
    .update({ status: 'approved', approved_by: user.id, approved_at: new Date().toISOString() })
    .eq('id', id)

  if (error) return { success: false, error: error.message }
  revalidatePath('/admin/events')
  revalidatePath('/events')
  return { success: true }
}

export async function cancelEvent(id: string): Promise<{ success: boolean; error?: string }> {
  const { admin } = await getAuthenticatedAdmin()
  if (!admin) return { success: false, error: 'Not authorized' }

  const { error } = await admin.from('events').update({ status: 'cancelled' }).eq('id', id)
  if (error) return { success: false, error: error.message }
  revalidatePath('/admin/events')
  revalidatePath('/events')
  return { success: true }
}

export async function deleteEvent(id: string): Promise<{ success: boolean; error?: string }> {
  const { admin } = await getAuthenticatedAdmin()
  if (!admin) return { success: false, error: 'Not authorized' }

  const { error } = await admin.from('events').delete().eq('id', id)
  if (error) return { success: false, error: error.message }
  revalidatePath('/admin/events')
  revalidatePath('/events')
  return { success: true }
}

/**
 * event_assignments has no family_code of its own — family comes from the parent
 * event — and the mutations below take a bare id from the client while running on
 * the service-role key, so RLS is not there to confine them. Without this check an
 * administrator in one family could act on another family's task by id.
 */
async function assignmentInFamily(
  admin: NonNullable<Awaited<ReturnType<typeof getAuthenticatedAdmin>>['admin']>,
  assignmentId: string,
  familyCode: string
): Promise<boolean> {
  if (!familyCode) return false
  const { data } = await admin
    .from('event_assignments')
    .select('id, events!inner(family_code)')
    .eq('id', assignmentId)
    .eq('events.family_code', familyCode)
    .maybeSingle()
  return Boolean(data)
}

/** Same confinement, for the mutations that identify the event directly. */
async function eventInFamily(
  admin: NonNullable<Awaited<ReturnType<typeof getAuthenticatedAdmin>>['admin']>,
  eventId: string,
  familyCode: string
): Promise<boolean> {
  if (!familyCode) return false
  const { data } = await admin
    .from('events')
    .select('id')
    .eq('id', eventId)
    .eq('family_code', familyCode)
    .maybeSingle()
  return Boolean(data)
}

export async function assignBlueprintItem(
  eventId: string,
  blueprintItemId: string,
  assignedTo: string,
  dueDate?: string
): Promise<{ success: boolean; error?: string }> {
  const { user, admin, familyCode } = await getAuthenticatedAdmin()
  if (!admin) return { success: false, error: 'Not authorized' }
  if (!(await eventInFamily(admin, eventId, familyCode))) {
    return { success: false, error: 'Event not found' }
  }

  const { error } = await admin
    .from('event_assignments')
    .upsert(
      { event_id: eventId, blueprint_item_id: blueprintItemId, assigned_to: assignedTo, assigned_by: user!.id, due_date: dueDate || null },
      { onConflict: 'event_id,blueprint_item_id,assigned_to', ignoreDuplicates: false }
    )

  return error ? { success: false, error: error.message } : { success: true }
}

export async function updateAssignmentDueDate(
  assignmentId: string,
  dueDate: string | null
): Promise<{ success: boolean; error?: string }> {
  const { admin, familyCode } = await getAuthenticatedAdmin()
  if (!admin) return { success: false, error: 'Not authorized' }
  if (!(await assignmentInFamily(admin, assignmentId, familyCode))) {
    return { success: false, error: 'Assignment not found' }
  }

  const { error } = await admin.from('event_assignments').update({ due_date: dueDate || null }).eq('id', assignmentId)
  return error ? { success: false, error: error.message } : { success: true }
}

export async function unassignBlueprintItem(
  assignmentId: string
): Promise<{ success: boolean; error?: string }> {
  const { admin, familyCode } = await getAuthenticatedAdmin()
  if (!admin) return { success: false, error: 'Not authorized' }
  if (!(await assignmentInFamily(admin, assignmentId, familyCode))) {
    return { success: false, error: 'Assignment not found' }
  }

  const { error } = await admin.from('event_assignments').delete().eq('id', assignmentId)
  return error ? { success: false, error: error.message } : { success: true }
}

export async function approveAssignmentResponse(
  assignmentId: string
): Promise<{ success: boolean; error?: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { success: false, error: 'Not authenticated' }

  if (!(await can(user.id, 'admin/events', 'edit'))) return { success: false, error: 'Not authorized to approve responses' }

  const adminClient = createAdminClient()
  if (!(await assignmentInFamily(adminClient, assignmentId, await getMyFamilyCode(user.id)))) {
    return { success: false, error: 'Assignment not found' }
  }

  const { error } = await adminClient
    .from('event_assignments')
    .update({ response_status: 'approved', approved_by: user.id, approved_at: new Date().toISOString() })
    .eq('id', assignmentId)

  return error ? { success: false, error: error.message } : { success: true }
}

/**
 * The planning checklist for one event, including the real names of the members
 * each item is assigned to — which is why this needs a grant and not just a login.
 */
export async function getEventAssignments(eventId: string): Promise<EventAssignment[]> {
  const g = await requireRead('admin/events')
  if (!g.ok) return []
  if (!(await belongsToFamily('events', eventId, g.familyCode))) return []

  const admin = createAdminClient()
  // Reflect lapsed tasks: cancel any still-open item whose event has ended.
  await admin.rpc('cancel_overdue_event_assignments')
  const { data } = await admin
    .from('event_assignments')
    .select('*, event_blueprint_items(title)')
    .eq('family_code', g.familyCode)
    .eq('event_id', eventId)
    .order('blueprint_item_id')

  if (!data?.length) return []

  const assignedIds = data.filter(a => a.assigned_to).map(a => a.assigned_to as string)
  const { data: people } = assignedIds.length
    ? await admin.from('people').select('user_id, first_name, last_name').in('user_id', assignedIds)
    : { data: [] }

  const nameByUserId: Record<string, string> = {}
  for (const p of people ?? []) {
    if (p.user_id) nameByUserId[p.user_id] = [p.first_name, p.last_name].filter(Boolean).join(' ')
  }

  return data.map(a => ({
    id:                   a.id,
    event_id:             a.event_id,
    blueprint_item_id:    a.blueprint_item_id,
    blueprint_item_title: (a.event_blueprint_items as unknown as { title: string } | null)?.title ?? '',
    assigned_to:          a.assigned_to,
    assigned_to_name:     a.assigned_to ? (nameByUserId[a.assigned_to] ?? 'Unknown') : null,
    is_complete:          a.is_complete,
    completed_at:         a.completed_at,
    due_date:             a.due_date ?? null,
    response:             a.response ?? null,
    response_status:      (a.response_status ?? 'pending') as 'pending' | 'submitted' | 'approved' | 'cancelled',
    approved_by:          a.approved_by ?? null,
    approved_at:          a.approved_at ?? null,
  }))
}

export async function getEventReport(eventId: string): Promise<EventReport | null> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const admin = createAdminClient()
  const familyCode = await getMyFamilyCode(user.id)

  const { data: event } = await admin.from('events').select('*, event_types(name)').eq('id', eventId).single()
  if (!event) return null

  // All RSVPs for this event
  const { data: rsvps } = await admin
    .from('event_rsvp')
    .select('id, submitted_by')
    .eq('event_id', eventId)

  const allRsvpIds = (rsvps ?? []).map(r => r.id)
  const respondentUserIds = new Set((rsvps ?? []).map(r => r.submitted_by))

  // All attendee person records (per-person is_attending)
  const { data: attendeeRows } = allRsvpIds.length
    ? await admin.from('event_rsvp_attendees').select('person_id, is_attending').in('rsvp_id', allRsvpIds).eq('is_attending', true)
    : { data: [] }

  const attendeePersonIds = (attendeeRows ?? []).map(r => r.person_id)
  const { data: attendeePeople } = attendeePersonIds.length
    ? await admin.from('people').select('id, first_name, last_name, tshirt_category, tshirt_size').in('id', attendeePersonIds)
    : { data: [] }

  // All family members with accounts for non-respondent calculation
  const { data: allMembers } = await admin
    .from('people')
    .select('user_id, first_name, last_name')
    .eq('family_code', familyCode)
    .not('user_id', 'is', null)

  const nonRespondents = (allMembers ?? [])
    .filter(m => !respondentUserIds.has(m.user_id as string))
    .map(m => ({ name: [m.first_name, m.last_name].filter(Boolean).join(' ') || 'Unknown' }))

  // T-shirt breakdown
  const tshirtMap: Record<string, number> = {}
  for (const p of attendeePeople ?? []) {
    if (p.tshirt_category && p.tshirt_size) {
      const key = `${p.tshirt_category}||${p.tshirt_size}`
      tshirtMap[key] = (tshirtMap[key] ?? 0) + 1
    }
  }
  const tshirt_breakdown = Object.entries(tshirtMap).map(([key, count]) => {
    const [category, size] = key.split('||')
    return { category, size, count }
  }).sort((a, b) => a.category.localeCompare(b.category) || a.size.localeCompare(b.size))

  return {
    event: { ...event, event_type_name: (event.event_types as unknown as { name: string } | null)?.name ?? null } as AdminEvent,
    headcount: attendeePersonIds.length,
    attendees: (attendeePeople ?? []).map(p => ({
      name: [p.first_name, p.last_name].filter(Boolean).join(' ') || 'Unknown',
      tshirt_category: p.tshirt_category,
      tshirt_size: p.tshirt_size,
    })),
    tshirt_breakdown,
    non_respondents: nonRespondents,
    total_family_members: allMembers?.length ?? 0,
  }
}

// ── Hotel bookings ─────────────────────────────────────────────────────────────

/** Hotel blocks with rates and booking codes — the admin-side twin of getEventHotels. */
export async function getHotelBookings(eventId: string): Promise<HotelBooking[]> {
  const g = await requireRead('admin/events')
  if (!g.ok) return []
  if (!(await belongsToFamily('events', eventId, g.familyCode))) return []

  const admin = createAdminClient()
  const { data: bookings } = await admin
    .from('event_hotel_bookings')
    .select('*')
    .eq('event_id', eventId)
    .order('created_at')

  if (!bookings?.length) return []

  const ids = bookings.map(b => b.id)

  const [{ data: estimates }, { data: details }] = await Promise.all([
    admin.from('event_hotel_price_estimates').select('*').in('hotel_booking_id', ids).order('created_at'),
    admin.from('event_hotel_booking_details').select('*').in('hotel_booking_id', ids).order('sort_order').order('created_at'),
  ])

  const estimatesByBooking: Record<string, PriceEstimate[]> = {}
  for (const e of estimates ?? []) {
    if (!estimatesByBooking[e.hotel_booking_id]) estimatesByBooking[e.hotel_booking_id] = []
    estimatesByBooking[e.hotel_booking_id].push(e as PriceEstimate)
  }

  const detailsByBooking: Record<string, HotelBookingDetail[]> = {}
  for (const d of details ?? []) {
    if (!detailsByBooking[d.hotel_booking_id]) detailsByBooking[d.hotel_booking_id] = []
    detailsByBooking[d.hotel_booking_id].push(d as HotelBookingDetail)
  }

  return bookings.map(b => ({
    ...b,
    estimates: estimatesByBooking[b.id] ?? [],
    details:   detailsByBooking[b.id] ?? [],
  })) as HotelBooking[]
}

type HotelInput = { hotel_name: string; street_address?: string; suite?: string; city?: string; state?: string; zip_code?: string; country?: string; booking_code?: string; booking_deadline?: string; website?: string; phone?: string }

export async function createHotelBooking(
  eventId: string,
  input: HotelInput
): Promise<{ success: boolean; id?: string; error?: string }> {
  const { user, admin } = await getAuthenticatedAdmin()
  if (!admin) return { success: false, error: 'Not authorized' }

  const { data, error } = await admin
    .from('event_hotel_bookings')
    .insert({
      event_id:       eventId,
      hotel_name:     input.hotel_name.trim(),
      street_address: input.street_address?.trim() || null,
      suite:          input.suite?.trim() || null,
      city:           input.city?.trim() || null,
      state:          input.state?.trim() || null,
      zip_code:       input.zip_code?.trim() || null,
      country:        input.country?.trim() || null,
      booking_code:     input.booking_code?.trim() || null,
      booking_deadline: input.booking_deadline || null,
      website:          input.website?.trim() || null,
      phone:            input.phone?.trim() || null,
      created_by:       user!.id,
    })
    .select('id')
    .single()

  if (error) return { success: false, error: error.message }
  return { success: true, id: data.id }
}

export async function updateHotelBooking(
  id: string,
  input: HotelInput
): Promise<{ success: boolean; error?: string }> {
  const { admin } = await getAuthenticatedAdmin()
  if (!admin) return { success: false, error: 'Not authorized' }

  const { error } = await admin.from('event_hotel_bookings').update({
    hotel_name:       input.hotel_name.trim(),
    street_address:   input.street_address?.trim() || null,
    suite:            input.suite?.trim() || null,
    city:             input.city?.trim() || null,
    state:            input.state?.trim() || null,
    zip_code:         input.zip_code?.trim() || null,
    country:          input.country?.trim() || null,
    booking_code:     input.booking_code?.trim() || null,
    booking_deadline: input.booking_deadline || null,
    website:          input.website?.trim() || null,
    phone:            input.phone?.trim() || null,
  }).eq('id', id)

  return error ? { success: false, error: error.message } : { success: true }
}

export async function deleteHotelBooking(id: string): Promise<{ success: boolean; error?: string }> {
  const { admin } = await getAuthenticatedAdmin()
  if (!admin) return { success: false, error: 'Not authorized' }

  const { error } = await admin.from('event_hotel_bookings').delete().eq('id', id)
  return error ? { success: false, error: error.message } : { success: true }
}

export async function addPriceEstimate(
  hotelBookingId: string,
  input: { room_type: string; amount: number }
): Promise<{ success: boolean; id?: string; error?: string }> {
  const { admin } = await getAuthenticatedAdmin()
  if (!admin) return { success: false, error: 'Not authorized' }

  const { data, error } = await admin
    .from('event_hotel_price_estimates')
    .insert({ hotel_booking_id: hotelBookingId, room_type: input.room_type.trim(), amount: input.amount })
    .select('id')
    .single()

  if (error) return { success: false, error: error.message }
  return { success: true, id: data.id }
}

export async function deletePriceEstimate(id: string): Promise<{ success: boolean; error?: string }> {
  const { admin } = await getAuthenticatedAdmin()
  if (!admin) return { success: false, error: 'Not authorized' }

  const { error } = await admin.from('event_hotel_price_estimates').delete().eq('id', id)
  return error ? { success: false, error: error.message } : { success: true }
}

export async function addHotelDetail(
  hotelBookingId: string,
  key: string,
  value: string
): Promise<{ success: boolean; id?: string; error?: string }> {
  const { admin } = await getAuthenticatedAdmin()
  if (!admin) return { success: false, error: 'Not authorized' }

  const { data: existing } = await admin
    .from('event_hotel_booking_details')
    .select('sort_order')
    .eq('hotel_booking_id', hotelBookingId)
    .order('sort_order', { ascending: false })
    .limit(1)
    .maybeSingle()

  const { data, error } = await admin
    .from('event_hotel_booking_details')
    .insert({ hotel_booking_id: hotelBookingId, key: key.trim(), value: value.trim(), sort_order: (existing?.sort_order ?? 0) + 1 })
    .select('id')
    .single()

  if (error) return { success: false, error: error.message }
  return { success: true, id: data.id }
}

export async function deleteHotelDetail(id: string): Promise<{ success: boolean; error?: string }> {
  const { admin } = await getAuthenticatedAdmin()
  if (!admin) return { success: false, error: 'Not authorized' }

  const { error } = await admin.from('event_hotel_booking_details').delete().eq('id', id)
  return error ? { success: false, error: error.message } : { success: true }
}

// ── Event budgets: line items + expenses + backing fund ──────────────────────

export interface EventBudgetItem {
  id: string
  event_id: string
  title: string
  description: string | null
  budget_cents: number
  sort_order: number
  spent_cents: number
}

export interface EventExpense {
  id: string
  event_id: string
  budget_item_id: string | null
  budget_item_title: string | null
  fund_id: string | null
  fund_name: string | null
  amount_cents: number
  spent_date: string
  description: string | null
  created_at: string
}

async function adminPersonId(admin: ReturnType<typeof createAdminClient>, userId: string): Promise<string | null> {
  const { data } = await admin.from('people').select('id').eq('user_id', userId).maybeSingle()
  return data?.id ?? null
}

/** Budget lines and spend-to-date for one event. Money — grant required. */
export async function getEventBudgetItems(eventId: string): Promise<EventBudgetItem[]> {
  const g = await requireRead('admin/events')
  if (!g.ok) return []
  if (!(await belongsToFamily('events', eventId, g.familyCode))) return []

  const admin = createAdminClient()
  const [itemsRes, expRes] = await Promise.all([
    admin.from('event_budget_items').select('*').eq('family_code', g.familyCode).eq('event_id', eventId).order('sort_order').order('created_at'),
    admin.from('event_expenses').select('budget_item_id, amount_cents').eq('family_code', g.familyCode).eq('event_id', eventId),
  ])
  const spentByItem = new Map<string, number>()
  for (const e of expRes.data ?? []) {
    if (e.budget_item_id) spentByItem.set(e.budget_item_id, (spentByItem.get(e.budget_item_id) ?? 0) + e.amount_cents)
  }
  return (itemsRes.data ?? []).map(i => ({
    id: i.id,
    event_id: i.event_id,
    title: i.title,
    description: i.description,
    budget_cents: i.budget_cents,
    sort_order: i.sort_order,
    spent_cents: spentByItem.get(i.id) ?? 0,
  }))
}

export async function addEventBudgetItem(
  eventId: string,
  input: { title: string; description?: string; budget_cents: number }
): Promise<{ success: boolean; id?: string; error?: string }> {
  const { user, admin, familyCode } = await getAuthenticatedAdmin()
  if (!admin || !user) return { success: false, error: 'Not authorized' }
  if (await isBudgetClosed(admin, eventId)) return { success: false, error: 'The budget is closed and can no longer be edited.' }

  const { data: last } = await admin
    .from('event_budget_items').select('sort_order').eq('event_id', eventId)
    .order('sort_order', { ascending: false }).limit(1).maybeSingle()

  const { data, error } = await admin.from('event_budget_items').insert({
    event_id: eventId,
    family_code: familyCode,
    title: input.title.trim(),
    description: input.description?.trim() || null,
    budget_cents: input.budget_cents,
    sort_order: (last?.sort_order ?? 0) + 1,
    created_by: await adminPersonId(admin, user.id),
  }).select('id').single()

  if (error) return { success: false, error: error.message }
  revalidatePath(`/admin/events/${eventId}`)
  revalidatePath('/family-finances')
  return { success: true, id: data.id }
}

export async function updateEventBudgetItem(
  id: string,
  input: Partial<{ title: string; description: string; budget_cents: number; sort_order: number }>
): Promise<{ success: boolean; error?: string }> {
  const { admin } = await getAuthenticatedAdmin()
  if (!admin) return { success: false, error: 'Not authorized' }

  const { data, error } = await admin.from('event_budget_items').update({
    ...input,
    title: input.title?.trim(),
    description: input.description?.trim() || null,
  }).eq('id', id).select('event_id').single()

  if (error) return { success: false, error: error.message }
  if (data?.event_id) revalidatePath(`/admin/events/${data.event_id}`)
  revalidatePath('/family-finances')
  return { success: true }
}

export async function deleteEventBudgetItem(id: string): Promise<{ success: boolean; error?: string }> {
  const { admin } = await getAuthenticatedAdmin()
  if (!admin) return { success: false, error: 'Not authorized' }

  const { data, error } = await admin.from('event_budget_items').delete().eq('id', id).select('event_id').single()
  if (error) return { success: false, error: error.message }
  if (data?.event_id) revalidatePath(`/admin/events/${data.event_id}`)
  revalidatePath('/family-finances')
  return { success: true }
}

/** Recorded spend for one event, with the fund each expense came out of. */
export async function getEventExpenses(eventId: string): Promise<EventExpense[]> {
  const g = await requireRead('admin/events')
  if (!g.ok) return []
  if (!(await belongsToFamily('events', eventId, g.familyCode))) return []

  const admin = createAdminClient()
  const { data } = await admin
    .from('event_expenses')
    .select('*, event_budget_items(title), funds(name)')
    .eq('family_code', g.familyCode)
    .eq('event_id', eventId)
    .order('spent_date', { ascending: false })

  return (data ?? []).map(e => ({
    id: e.id,
    event_id: e.event_id,
    budget_item_id: e.budget_item_id,
    budget_item_title: (e.event_budget_items as { title: string } | null)?.title ?? null,
    fund_id: e.fund_id,
    fund_name: (e.funds as { name: string } | null)?.name ?? null,
    amount_cents: e.amount_cents,
    spent_date: e.spent_date,
    description: e.description,
    created_at: e.created_at,
  }))
}

export async function recordEventExpense(
  eventId: string,
  input: {
    description: string
    amount_cents: number
    spent_date: string
    budget_item_id: string | null
    fund_id: string | null
  }
): Promise<{ success: boolean; id?: string; error?: string }> {
  const { user, admin, familyCode } = await getAuthenticatedAdmin()
  if (!admin || !user) return { success: false, error: 'Not authorized' }
  if (await isBudgetClosed(admin, eventId)) return { success: false, error: 'The budget is closed and can no longer be edited.' }

  // Default to the event's backing fund when none is chosen.
  let fundId = input.fund_id
  if (fundId === null) {
    const { data: backing } = await admin.from('funds').select('id').eq('event_id', eventId).maybeSingle()
    fundId = backing?.id ?? null
  }

  const { data, error } = await admin.from('event_expenses').insert({
    event_id: eventId,
    budget_item_id: input.budget_item_id,
    fund_id: fundId,
    family_code: familyCode,
    amount_cents: input.amount_cents,
    spent_date: input.spent_date,
    description: input.description.trim() || null,
    recorded_by: await adminPersonId(admin, user.id),
  }).select('id').single()

  if (error) return { success: false, error: error.message }
  revalidatePath(`/admin/events/${eventId}`)
  revalidatePath('/family-finances')
  return { success: true, id: data.id }
}

export async function deleteEventExpense(id: string): Promise<{ success: boolean; error?: string }> {
  const { admin } = await getAuthenticatedAdmin()
  if (!admin) return { success: false, error: 'Not authorized' }

  const { data, error } = await admin.from('event_expenses').delete().eq('id', id).select('event_id').single()
  if (error) return { success: false, error: error.message }
  if (data?.event_id) revalidatePath(`/admin/events/${data.event_id}`)
  revalidatePath('/family-finances')
  return { success: true }
}

/** Link (or unlink) the one fund that backs this event. Enforces the 1:1 relationship. */
export async function setEventFund(
  eventId: string,
  fundId: string | null
): Promise<{ success: boolean; error?: string }> {
  const { admin, familyCode } = await getAuthenticatedAdmin()
  if (!admin) return { success: false, error: 'Not authorized' }
  if (await isBudgetClosed(admin, eventId)) return { success: false, error: 'The budget is closed and can no longer be edited.' }

  // Clear any fund currently backing this event (partial-unique index on event_id).
  const { error: clearErr } = await admin
    .from('funds').update({ event_id: null }).eq('family_code', familyCode).eq('event_id', eventId)
  if (clearErr) return { success: false, error: clearErr.message }

  if (fundId) {
    const { error } = await admin.from('funds').update({ event_id: eventId }).eq('id', fundId)
    if (error) return { success: false, error: error.message }
  }

  revalidatePath(`/admin/events/${eventId}`)
  revalidatePath('/family-finances')
  return { success: true }
}

/** Officially close an event's budget. Once closed, line items and expenses are frozen. */
export async function closeBudget(eventId: string): Promise<{ success: boolean; error?: string; closed_at?: string }> {
  const { admin } = await getAuthenticatedAdmin()
  if (!admin) return { success: false, error: 'Not authorized' }

  const closed_at = new Date().toISOString()
  const { error } = await admin.from('events').update({ budget_closed_at: closed_at }).eq('id', eventId)
  if (error) return { success: false, error: error.message }

  revalidatePath(`/admin/events/${eventId}`)
  return { success: true, closed_at }
}

/** True once the event's budget has been officially closed. */
async function isBudgetClosed(admin: ReturnType<typeof createAdminClient>, eventId: string): Promise<boolean> {
  const { data } = await admin.from('events').select('budget_closed_at').eq('id', eventId).maybeSingle()
  return !!data?.budget_closed_at
}
