import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { requireView } from '@/lib/auth/permissions'
import { getMeetings, mayScheduleMeeting } from '@/app/actions/meetings'
import { getMembers } from '@/app/actions/members'
import { MeetingsClient } from '@/components/meetings/MeetingsClient'
import { PageShell } from '@/components/layout/PageShell'

export const metadata = { title: 'Meeting Minutes' }

/**
 * Meeting Minutes — the family's record of what it met about and decided.
 *
 * ── IT CAME OUT OF THE OFFICER'S JOURNAL ON 2026-08-22 ─────────────────────────────
 * `20260822000001` put a meeting in a journal entry as a `kind`, with a date and an attendee
 * list beside it. One day of use was enough: a meeting belongs to the FAMILY rather than to one
 * office, it has a SECRETARY (a job for one named person, which a journal's "any holder of the
 * office" rule cannot express), and it has VOTES, which a journal has nowhere to put.
 * `20260822000019` builds the five tables and drops the columns it replaces.
 *
 * ── WHO READS IT: EVERYBODY. WHO WRITES IT: THE SECRETARY OF THAT MEETING ──────────
 * The SELECT policies test family and approval and nothing else, which is the opposite of the
 * journal's rule and is deliberate: minutes are the family's record of its own decisions, so a
 * member who was not in the room still reads what was decided. `library/meeting-minutes:view`
 * gates this SCREEN so a family can switch the feature off; it decides no row.
 *
 * THE ROSTER IS FETCHED FOR THE SCHEDULING FORM, and only for a caller who may schedule (§5):
 * a hundred and forty names in the RSC payload is both a leak and a payload for a member who
 * cannot open the dialog they would fill.
 */
export default async function MeetingMinutesPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  await requireView(user.id, 'library/meeting-minutes')

  const [meetings, maySchedule] = await Promise.all([
    getMeetings(),
    mayScheduleMeeting(),
  ])
  // NOT FETCHED AT ALL for somebody who cannot schedule. `getMembers` resolves its own grant
  // as well, so this is the outer of two narrowings rather than the only one.
  const members = maySchedule ? await getMembers() : []

  return (
    <PageShell className="space-y-6">
      <MeetingsClient
        initialMeetings={meetings}
        maySchedule={maySchedule}
        members={members.map(m => ({
          id: m.id,
          first_name: m.first_name,
          last_name: m.last_name,
          nick_name: m.nick_name,
        }))}
      />
    </PageShell>
  )
}
