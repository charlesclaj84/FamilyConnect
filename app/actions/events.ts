'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { getMyFamilyCode } from '@/lib/auth/family'
import { createAdminClient } from '@/lib/supabase/admin'

export interface PublicEvent {
  id: string
  name: string
  description: string | null
  official_description: string | null
  event_date: string | null
  start_date: string | null
  end_date: string | null
  location: string | null
  city: string | null
  state: string | null
  rsvp_deadline: string | null
  status: 'published' | 'approved'
  event_type_name: string | null
  rsvp_count: number
}

export interface RsvpPerson {
  person_id: string
  first_name: string | null
  last_name: string | null
  is_minor: boolean
  tshirt_category: string | null
  tshirt_size: string | null
  relationship: string
}

export interface MyRsvp {
  id: string
  attendee_statuses: { person_id: string; is_attending: boolean }[]
}

export async function getUpcomingEvents(): Promise<PublicEvent[]> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return []

  const familyCode = await getMyFamilyCode(user.id)
  const admin = createAdminClient()

  const { data } = await admin
    .from('events')
    .select('id, name, description, official_description, event_date, start_date, end_date, location, city, state, rsvp_deadline, status, event_types(name)')
    .eq('family_code', familyCode)
    .in('status', ['published', 'approved'])
    .is('parent_event_id', null)
    .order('event_date', { ascending: true, nullsFirst: false })

  // Drop events whose end has already passed. The effective "end" of an event is
  // its end_date, falling back to start_date, then the legacy event_date — so a
  // multi-day event stays visible while it's ongoing and only drops off the day
  // after it finishes. Events with no date at all (Date TBD) are kept. Compared
  // as YYYY-MM-DD strings to sidestep timezone drift.
  const today = new Date().toISOString().slice(0, 10)
  const events = (data ?? []).filter(e => {
    const effectiveEnd = e.end_date ?? e.start_date ?? e.event_date
    return !effectiveEnd || effectiveEnd.slice(0, 10) >= today
  })
  const eventIds = events.map(e => e.id)

  // Count total individual attending people per event (from event_rsvp_attendees)
  const rsvpCountMap: Record<string, number> = {}
  if (eventIds.length) {
    // Get all RSVP ids for these events
    const { data: rsvps } = await supabase
      .from('event_rsvp')
      .select('id, event_id')
      .in('event_id', eventIds)

    if ((rsvps ?? []).length) {
      const rsvpIds = (rsvps ?? []).map(r => r.id)
      const rsvpToEvent: Record<string, string> = {}
      for (const r of rsvps ?? []) rsvpToEvent[r.id] = r.event_id

      // Count unique people marked as attending — deduplicate by person_id per event
      const { data: attendees } = await supabase
        .from('event_rsvp_attendees')
        .select('rsvp_id, person_id')
        .in('rsvp_id', rsvpIds)
        .eq('is_attending', true)

      // Track unique person_id per event to avoid counting the same person twice
      const seenByEvent: Record<string, Set<string>> = {}
      for (const a of attendees ?? []) {
        const eventId = rsvpToEvent[a.rsvp_id]
        if (!eventId) continue
        if (!seenByEvent[eventId]) seenByEvent[eventId] = new Set()
        seenByEvent[eventId].add(a.person_id)
      }
      for (const [eventId, people] of Object.entries(seenByEvent)) {
        rsvpCountMap[eventId] = people.size
      }
    }
  }

  return events.map(e => ({
    id:                   e.id,
    name:                 e.name,
    description:          e.description,
    official_description: (e as any).official_description ?? null,
    event_date:           e.event_date,
    start_date:           e.start_date ?? null,
    end_date:             e.end_date ?? null,
    location:             e.location,
    city:                 e.city ?? null,
    state:                e.state ?? null,
    rsvp_deadline:        e.rsvp_deadline,
    status:               e.status as 'published' | 'approved',
    event_type_name:      (e.event_types as unknown as { name: string } | null)?.name ?? null,
    rsvp_count:           rsvpCountMap[e.id] ?? 0,
  }))
}

export async function getEventDetail(eventId: string): Promise<PublicEvent | null> {
  const admin = createAdminClient()
  const { data } = await admin
    .from('events')
    .select('id, name, description, official_description, event_date, start_date, end_date, location, city, state, rsvp_deadline, status, event_types(name)')
    .eq('id', eventId)
    .in('status', ['published', 'approved'])
    .single()

  if (!data) return null
  return {
    id:                   data.id,
    name:                 data.name,
    description:          data.description,
    official_description: (data as any).official_description ?? null,
    event_date:           data.event_date,
    start_date:           data.start_date ?? null,
    end_date:             data.end_date ?? null,
    location:             data.location,
    city:                 data.city ?? null,
    state:                data.state ?? null,
    rsvp_deadline:        data.rsvp_deadline,
    status:               data.status as 'published' | 'approved',
    event_type_name:      (data.event_types as unknown as { name: string } | null)?.name ?? null,
    rsvp_count:           0,
  }
}

export async function getMyRsvp(eventId: string): Promise<MyRsvp | null> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const admin = createAdminClient()

  // Get the current user's own RSVP row (needed for id when saving)
  const { data: myRsvp } = await admin
    .from('event_rsvp')
    .select('id')
    .eq('event_id', eventId)
    .eq('submitted_by', user.id)
    .maybeSingle()

  // Get ALL RSVP submissions for this event to build merged per-person status
  const { data: allRsvps } = await supabase
    .from('event_rsvp')
    .select('id')
    .eq('event_id', eventId)

  if (!allRsvps?.length) return myRsvp ? { id: myRsvp.id, attendee_statuses: [] } : null

  const allRsvpIds = allRsvps.map(r => r.id)

  // Get all per-person attendance across ALL submissions
  const { data: allAttendees } = await supabase
    .from('event_rsvp_attendees')
    .select('person_id, is_attending, rsvp_id')
    .in('rsvp_id', allRsvpIds)

  // Merge: build baseline from all other submissions first, then apply the current
  // user's own RSVP entries on top so their submission always takes priority.
  const statusByPerson: Record<string, boolean> = {}
  const myRsvpId = myRsvp?.id
  for (const a of allAttendees ?? []) {
    if (a.rsvp_id !== myRsvpId) statusByPerson[a.person_id] = a.is_attending
  }
  for (const a of allAttendees ?? []) {
    if (a.rsvp_id === myRsvpId) statusByPerson[a.person_id] = a.is_attending
  }

  return {
    id: myRsvp?.id ?? '',
    attendee_statuses: Object.entries(statusByPerson).map(([person_id, is_attending]) => ({ person_id, is_attending })),
  }
}

export async function getMyFamilyForRsvp(): Promise<RsvpPerson[]> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return []

  const familyCode = await getMyFamilyCode(user.id)
  const admin = createAdminClient()

  // Get current user's people record
  const { data: me } = await admin
    .from('people')
    .select('id, first_name, last_name, is_minor, tshirt_category, tshirt_size')
    .eq('user_id', user.id)
    .maybeSingle()

  if (!me) return []

  // Get relationship types for spouse and children
  const { data: relTypes } = await admin
    .from('relationship_types')
    .select('id, name')
    .in('name', ['Husband', 'Wife', 'Partner', 'Son', 'Daughter'])

  const typeIds = relTypes?.map(t => t.id) ?? []
  const typeNameById = Object.fromEntries((relTypes ?? []).map(t => [t.id, t.name]))

  const { data: relationships } = await admin
    .from('person_relationships')
    .select('related_person_id, relationship_type_id')
    .eq('person_id', me.id)
    .in('relationship_type_id', typeIds)

  if (!relationships?.length) {
    return [{ person_id: me.id, first_name: me.first_name, last_name: me.last_name, is_minor: me.is_minor, tshirt_category: me.tshirt_category, tshirt_size: me.tshirt_size, relationship: 'Me' }]
  }

  const relatedIds = relationships.map(r => r.related_person_id)
  const { data: related } = await admin
    .from('people')
    .select('id, first_name, last_name, is_minor, tshirt_category, tshirt_size')
    .in('id', relatedIds)

  const relatedById = Object.fromEntries((related ?? []).map(p => [p.id, p]))

  const family: RsvpPerson[] = [
    { person_id: me.id, first_name: me.first_name, last_name: me.last_name, is_minor: me.is_minor, tshirt_category: me.tshirt_category, tshirt_size: me.tshirt_size, relationship: 'Me' },
  ]

  for (const rel of relationships) {
    const person = relatedById[rel.related_person_id]
    if (!person) continue
    const relName = typeNameById[rel.relationship_type_id] ?? 'Family Member'
    family.push({
      person_id:       person.id,
      first_name:      person.first_name,
      last_name:       person.last_name,
      is_minor:        person.is_minor,
      tshirt_category: person.tshirt_category,
      tshirt_size:     person.tshirt_size,
      relationship:    relName,
    })
  }

  return family
}

export async function submitRsvp(
  eventId: string,
  personStatuses: { person_id: string; is_attending: boolean }[]
): Promise<{ success: boolean; error?: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { success: false, error: 'Not authenticated' }

  const admin = createAdminClient()
  const anyAttending = personStatuses.some(p => p.is_attending)

  // Upsert RSVP row (is_attending = true if any person is attending)
  const { data: rsvp, error: rsvpError } = await admin
    .from('event_rsvp')
    .upsert({ event_id: eventId, submitted_by: user.id, is_attending: anyAttending, submitted_at: new Date().toISOString() },
             { onConflict: 'event_id,submitted_by' })
    .select('id')
    .single()

  if (rsvpError || !rsvp) return { success: false, error: rsvpError?.message ?? 'Failed to save RSVP' }

  // Replace all per-person attendee rows
  await admin.from('event_rsvp_attendees').delete().eq('rsvp_id', rsvp.id)

  if (personStatuses.length) {
    const { error: attendeeError } = await admin
      .from('event_rsvp_attendees')
      .insert(personStatuses.map(p => ({ rsvp_id: rsvp.id, person_id: p.person_id, is_attending: p.is_attending })))

    if (attendeeError) return { success: false, error: attendeeError.message }
  }

  revalidatePath(`/events/${eventId}`)
  return { success: true }
}

export interface RsvpSummaryEntry {
  submitted_by: string
  submitter_name: string
  attendees: { person_id: string; name: string; is_attending: boolean }[]
}

export async function getEventRsvpSummary(eventId: string): Promise<RsvpSummaryEntry[]> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return []

  const admin = createAdminClient()
  const familyCode = await getMyFamilyCode(user.id)

  // All RSVP submissions for this event
  const { data: rsvps } = await supabase
    .from('event_rsvp')
    .select('id, submitted_by')
    .eq('event_id', eventId)

  if (!rsvps?.length) return []

  const rsvpIds  = rsvps.map(r => r.id)
  const userIds  = rsvps.map(r => r.submitted_by)

  // Attendee rows for all submissions
  const { data: attendeeRows } = await supabase
    .from('event_rsvp_attendees')
    .select('rsvp_id, person_id, is_attending')
    .in('rsvp_id', rsvpIds)

  // Person names
  const personIds = (attendeeRows ?? []).map(a => a.person_id)
  const { data: people } = personIds.length
    ? await admin.from('people').select('id, first_name, last_name').in('id', personIds)
    : { data: [] }
  const personName = (id: string) => {
    const p = (people ?? []).find(p => p.id === id)
    return p ? [p.first_name, p.last_name].filter(Boolean).join(' ') || 'Family Member' : 'Family Member'
  }

  // Submitter names (from people table via user_id)
  const { data: submitters } = userIds.length
    ? await admin.from('people').select('user_id, first_name, last_name').in('user_id', userIds).eq('family_code', familyCode)
    : { data: [] }
  const submitterName = (uid: string) => {
    const p = (submitters ?? []).find(p => p.user_id === uid)
    return p ? [p.first_name, p.last_name].filter(Boolean).join(' ') || 'Family Member' : 'Family Member'
  }

  // Group attendees by rsvp_id
  const attendeesByRsvp: Record<string, { person_id: string; name: string; is_attending: boolean }[]> = {}
  for (const a of attendeeRows ?? []) {
    if (!attendeesByRsvp[a.rsvp_id]) attendeesByRsvp[a.rsvp_id] = []
    attendeesByRsvp[a.rsvp_id].push({ person_id: a.person_id, name: personName(a.person_id), is_attending: a.is_attending })
  }

  return rsvps.map(r => ({
    submitted_by:   r.submitted_by,
    submitter_name: submitterName(r.submitted_by),
    attendees:      attendeesByRsvp[r.id] ?? [],
  }))
}

export interface PublicHotel {
  id: string
  hotel_name: string
  phone: string | null
  website: string | null
  booking_code: string | null
  booking_deadline: string | null
  street_address: string | null
  suite: string | null
  city: string | null
  state: string | null
  zip_code: string | null
  country: string | null
  estimates: { id: string; room_type: string; amount: number }[]
  details: { id: string; key: string; value: string }[]
}

export async function getEventHotels(eventId: string): Promise<PublicHotel[]> {
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

  const estMap: Record<string, PublicHotel['estimates']> = {}
  for (const e of estimates ?? []) {
    if (!estMap[e.hotel_booking_id]) estMap[e.hotel_booking_id] = []
    estMap[e.hotel_booking_id].push({ id: e.id, room_type: e.room_type, amount: Number(e.amount) })
  }
  const detMap: Record<string, PublicHotel['details']> = {}
  for (const d of details ?? []) {
    if (!detMap[d.hotel_booking_id]) detMap[d.hotel_booking_id] = []
    detMap[d.hotel_booking_id].push({ id: d.id, key: d.key, value: d.value })
  }

  return bookings.map(b => ({
    id:               b.id,
    hotel_name:       b.hotel_name,
    phone:            b.phone ?? null,
    website:          b.website ?? null,
    booking_code:     b.booking_code ?? null,
    booking_deadline: b.booking_deadline ?? null,
    street_address:   b.street_address ?? null,
    suite:            b.suite ?? null,
    city:             b.city ?? null,
    state:            b.state ?? null,
    zip_code:         b.zip_code ?? null,
    country:          b.country ?? null,
    estimates:        estMap[b.id] ?? [],
    details:          detMap[b.id] ?? [],
  }))
}
