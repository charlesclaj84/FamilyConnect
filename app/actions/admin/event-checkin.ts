'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

export interface CheckInAttendee {
  id: string
  name: string
  rsvp_submitted_by: string | null
  checked_in_at: string | null
}

export async function getCheckInList(eventId: string): Promise<CheckInAttendee[]> {
  const admin = createAdminClient()

  const { data } = await admin
    .from('event_rsvp_attendees')
    .select(`
      id,
      is_attending,
      checked_in_at,
      people(first_name, last_name),
      event_rsvp(people(first_name, last_name))
    `)
    .eq('event_id', eventId)
    .eq('is_attending', true)
    .order('id')

  return (data ?? []).map(row => {
    const attendeePerson = (row.people as any) ?? null
    const rsvpPerson = (row.event_rsvp as any)?.people ?? null

    return {
      id: row.id,
      name: attendeePerson
        ? `${attendeePerson.first_name} ${attendeePerson.last_name}`
        : 'Unknown',
      rsvp_submitted_by: rsvpPerson
        ? `${rsvpPerson.first_name} ${rsvpPerson.last_name}`
        : null,
      checked_in_at: row.checked_in_at ?? null,
    }
  })
}

export async function checkInAttendee(
  attendeeId: string,
  eventId: string,
  checkedIn: boolean
): Promise<{ success: boolean; message?: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { success: false, message: 'Not authenticated' }

  const admin = createAdminClient()
  const { data: myPerson } = await admin
    .from('people')
    .select('id, is_admin')
    .eq('user_id', user.id)
    .maybeSingle()

  if (!myPerson?.is_admin) return { success: false, message: 'Admin access required' }

  const updatePayload = checkedIn
    ? { checked_in_at: new Date().toISOString(), checked_in_by: myPerson.id }
    : { checked_in_at: null, checked_in_by: null }

  const { error } = await admin
    .from('event_rsvp_attendees')
    .update(updatePayload)
    .eq('id', attendeeId)

  if (error) return { success: false, message: error.message }

  revalidatePath(`/admin/events/${eventId}/checkin`)
  return { success: true }
}
