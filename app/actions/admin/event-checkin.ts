'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { can } from '@/lib/auth/permissions'
import { requireRead } from '@/lib/auth/guard'
import { createAdminClient } from '@/lib/supabase/admin'
import { getMyPersonId, belongsToFamily } from '@/lib/auth/family'
import { embedOne, type PersonNameRow } from '@/lib/supabase/embed'

/** `event_rsvp` has no foreign key to `people` (AGENTS.md §8), so only the id comes back. */
type RsvpSubmitter = { submitted_by: string | null }

export interface CheckInAttendee {
  id: string
  name: string
  rsvp_submitted_by: string | null
  checked_in_at: string | null
}

/**
 * The check-in roster for one event.
 *
 * Two embed hazards, both of which used to make this return an empty list —
 * PostgREST reports them as errors and the discarded `error` turned that into
 * "nobody is attending":
 *
 *   * `people` is ambiguous on event_rsvp_attendees (person_id, checked_in_by),
 *     so the attendee side must name person_id explicitly (PGRST201).
 *   * event_rsvp has NO foreign key to people at all — it records submitted_by,
 *     an auth.users id — so `event_rsvp(people(...))` is not a relationship
 *     PostgREST can walk (PGRST200). The submitter's name is resolved with a
 *     second lookup keyed on user_id instead.
 */
/**
 * The day-of check-in roster: every attending person's real name plus who submitted
 * their RSVP. Keyed on event_id, which carries no family, so the event is confirmed
 * into the caller's family first — the page gates on 'admin/events' and so does this.
 */
export async function getCheckInList(eventId: string): Promise<CheckInAttendee[]> {
  const g = await requireRead('admin/events')
  if (!g.ok) return []
  if (!(await belongsToFamily('events', eventId, g.familyCode))) return []

  const admin = createAdminClient()

  const { data } = await admin
    .from('event_rsvp_attendees')
    .select(`
      id,
      is_attending,
      checked_in_at,
      people!event_rsvp_attendees_person_id_fkey(first_name, last_name),
      event_rsvp(submitted_by)
    `)
    .eq('event_id', eventId)
    .eq('is_attending', true)
    .order('id')

  const rows = data ?? []

  const submitterIds = [...new Set(
    rows
      .map(r => embedOne<RsvpSubmitter>(r.event_rsvp)?.submitted_by)
      .filter((id): id is string => Boolean(id)),
  )]

  const nameByUserId = new Map<string, string>()
  if (submitterIds.length) {
    // Family-scoped too: user_id is an auth id, and a multi-family submitter has a
    // people row in each of their families. Without this the name could be resolved
    // from the wrong family's row.
    const { data: submitters } = await admin
      .from('people')
      .select('user_id, first_name, last_name')
      .eq('family_code', g.familyCode)
      .in('user_id', submitterIds)
    for (const p of submitters ?? []) {
      if (p.user_id) nameByUserId.set(p.user_id, `${p.first_name} ${p.last_name}`)
    }
  }

  return rows.map(row => {
    const attendeePerson = embedOne<PersonNameRow>(row.people)
    const submittedBy = embedOne<RsvpSubmitter>(row.event_rsvp)?.submitted_by

    return {
      id: row.id,
      name: attendeePerson
        ? `${attendeePerson.first_name} ${attendeePerson.last_name}`
        : 'Unknown',
      rsvp_submitted_by: submittedBy ? nameByUserId.get(submittedBy) ?? null : null,
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
  if (!(await can(user.id, 'admin/events', 'edit'))) return { success: false, message: 'Admin access required' }
  const myPersonId = await getMyPersonId(user.id)

  const updatePayload = checkedIn
    ? { checked_in_at: new Date().toISOString(), checked_in_by: myPersonId }
    : { checked_in_at: null, checked_in_by: null }

  const { error } = await admin
    .from('event_rsvp_attendees')
    .update(updatePayload)
    .eq('id', attendeeId)

  if (error) return { success: false, message: error.message }

  revalidatePath(`/admin/events/${eventId}/checkin`)
  return { success: true }
}
