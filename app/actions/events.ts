'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

export interface PublicEvent {
  id: string
  name: string
  description: string | null
  event_date: string | null
  location: string | null
  rsvp_deadline: string | null
  status: 'published' | 'approved'
  event_type_name: string | null
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

  const familyCode: string = user.user_metadata?.family_code ?? ''
  const admin = createAdminClient()

  const { data } = await admin
    .from('events')
    .select('id, name, description, event_date, location, rsvp_deadline, status, event_types(name)')
    .eq('family_code', familyCode)
    .in('status', ['published', 'approved'])
    .is('parent_event_id', null)
    .order('event_date', { ascending: true, nullsFirst: false })

  return (data ?? []).map(e => ({
    id:              e.id,
    name:            e.name,
    description:     e.description,
    event_date:      e.event_date,
    location:        e.location,
    rsvp_deadline:   e.rsvp_deadline,
    status:          e.status as 'published' | 'approved',
    event_type_name: (e.event_types as { name: string } | null)?.name ?? null,
  }))
}

export async function getEventDetail(eventId: string): Promise<PublicEvent | null> {
  const admin = createAdminClient()
  const { data } = await admin
    .from('events')
    .select('id, name, description, event_date, location, rsvp_deadline, status, event_types(name)')
    .eq('id', eventId)
    .in('status', ['published', 'approved'])
    .single()

  if (!data) return null
  return {
    id:              data.id,
    name:            data.name,
    description:     data.description,
    event_date:      data.event_date,
    location:        data.location,
    rsvp_deadline:   data.rsvp_deadline,
    status:          data.status as 'published' | 'approved',
    event_type_name: (data.event_types as { name: string } | null)?.name ?? null,
  }
}

export async function getMyRsvp(eventId: string): Promise<MyRsvp | null> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const admin = createAdminClient()
  const { data: rsvp } = await admin
    .from('event_rsvp')
    .select('id, is_attending')
    .eq('event_id', eventId)
    .eq('submitted_by', user.id)
    .maybeSingle()

  if (!rsvp) return null

  const { data: attendees } = await admin
    .from('event_rsvp_attendees')
    .select('person_id, is_attending')
    .eq('rsvp_id', rsvp.id)

  return {
    id:               rsvp.id,
    attendee_statuses: (attendees ?? []).map(a => ({ person_id: a.person_id, is_attending: a.is_attending })),
  }
}

export async function getMyFamilyForRsvp(): Promise<RsvpPerson[]> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return []

  const familyCode: string = user.user_metadata?.family_code ?? ''
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
