'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
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
  response_status: 'pending' | 'submitted' | 'approved'
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
  if (!user) return { user: null, admin: null, familyCode: '', canApprove: false }

  const adminClient = createAdminClient()
  const { data: person } = await adminClient
    .from('people')
    .select('is_admin, can_approve')
    .eq('user_id', user.id)
    .maybeSingle()

  const familyCode: string = user.user_metadata?.family_code ?? ''
  return {
    user,
    admin: person?.is_admin ? adminClient : null,
    adminClient,
    familyCode,
    canApprove: person?.can_approve === true,
  }
}

export async function getEvents(status?: AdminEvent['status']): Promise<AdminEvent[]> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return []

  const familyCode: string = user.user_metadata?.family_code ?? ''
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

  const { data, error } = await admin
    .from('events')
    .insert({
      family_code:     familyCode,
      parent_event_id: parentId,
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

export async function getSubEvents(parentId: string): Promise<AdminEvent[]> {
  const admin = createAdminClient()
  const { data } = await admin
    .from('events')
    .select('*')
    .eq('parent_event_id', parentId)
    .order('event_date', { ascending: true, nullsFirst: false })
    .order('event_time', { ascending: true, nullsFirst: false })
  return (data ?? []) as AdminEvent[]
}

export async function updateEvent(
  id: string,
  input: Partial<{ name: string; description: string; official_description: string; budget_amount_cents: number; start_date: string; end_date: string; is_all_day: boolean; start_time: string; end_time: string; location: string; rsvp_deadline: string; event_type_id: string } & AddressInput>
): Promise<{ success: boolean; error?: string }> {
  const { admin } = await getAuthenticatedAdmin()
  if (!admin) return { success: false, error: 'Not authorized' }

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
  const { user, admin, adminClient, canApprove } = await getAuthenticatedAdmin()
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

export async function assignBlueprintItem(
  eventId: string,
  blueprintItemId: string,
  assignedTo: string,
  dueDate?: string
): Promise<{ success: boolean; error?: string }> {
  const { user, admin } = await getAuthenticatedAdmin()
  if (!admin) return { success: false, error: 'Not authorized' }

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
  const { admin } = await getAuthenticatedAdmin()
  if (!admin) return { success: false, error: 'Not authorized' }

  const { error } = await admin.from('event_assignments').update({ due_date: dueDate || null }).eq('id', assignmentId)
  return error ? { success: false, error: error.message } : { success: true }
}

export async function unassignBlueprintItem(
  assignmentId: string
): Promise<{ success: boolean; error?: string }> {
  const { admin } = await getAuthenticatedAdmin()
  if (!admin) return { success: false, error: 'Not authorized' }

  const { error } = await admin.from('event_assignments').delete().eq('id', assignmentId)
  return error ? { success: false, error: error.message } : { success: true }
}

export async function approveAssignmentResponse(
  assignmentId: string
): Promise<{ success: boolean; error?: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { success: false, error: 'Not authenticated' }

  const adminClient = createAdminClient()
  const { data: person } = await adminClient.from('people').select('can_approve').eq('user_id', user.id).maybeSingle()
  if (!person?.can_approve) return { success: false, error: 'Not authorized to approve responses' }

  const { error } = await adminClient
    .from('event_assignments')
    .update({ response_status: 'approved', approved_by: user.id, approved_at: new Date().toISOString() })
    .eq('id', assignmentId)

  return error ? { success: false, error: error.message } : { success: true }
}

export async function getEventAssignments(eventId: string): Promise<EventAssignment[]> {
  const admin = createAdminClient()
  const { data } = await admin
    .from('event_assignments')
    .select('*, event_blueprint_items(title)')
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
    response_status:      (a.response_status ?? 'pending') as 'pending' | 'submitted' | 'approved',
    approved_by:          a.approved_by ?? null,
    approved_at:          a.approved_at ?? null,
  }))
}

export async function getEventReport(eventId: string): Promise<EventReport | null> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const admin = createAdminClient()
  const familyCode: string = user.user_metadata?.family_code ?? ''

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

export async function getHotelBookings(eventId: string): Promise<HotelBooking[]> {
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
