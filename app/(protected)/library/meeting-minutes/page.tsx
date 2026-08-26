import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { requireView } from '@/lib/auth/permissions'
import { resolveZone } from '@/lib/auth/zone'
import {
  getMeetingAttendeeOptions, getMeetings, mayScheduleMeeting,
} from '@/app/actions/meetings'
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
 *
 * ── WHAT IS FETCHED CHANGED ON 2026-08-22 ──────────────────────────────────────────
 * It was `getMembers()`. The dialog now asks who is coming as a BODY — a board, an office, a
 * chapter, or the whole family — rather than as a list of names, so what it needs is the
 * family's boards, its filled offices, its chapters and its ADULTS, which is
 * `getMeetingAttendeeOptions()`. `maySchedule` decides only whether the BUTTON is drawn; that
 * action gates its own read on the same grant, which is what makes §5 hold here (see the
 * comment on the call).
 */
export default async function MeetingMinutesPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  await requireView(user.id, 'library/meeting-minutes')

  // ── ONE CALL, AND IT GATES ITSELF ─────────────────────────────────────────────────
  // This was a ternary on `maySchedule` with a hand-written `{ boards: [], positions: [],
  // adults: [], names: {} }` in the else branch — a second copy of `MeetingAttendeeOptions`
  // living in a page, which stopped compiling the moment that shape grew `chapters`,
  // `everyoneIds` and `myPersonId`. `npm run typecheck` catches that, which is the good case;
  // what it cannot catch is the next person adding a field with a `?` on it.
  //
  // `getMeetingAttendeeOptions` resolves the same grant itself and returns its own empty shape
  // BEFORE it queries anything, so §5 is honoured by the ACTION rather than by the ternary: a
  // caller who cannot schedule gets nothing in the RSC payload and pays for two already-cached
  // permission checks. `NO_OPTIONS` in that file is now the only place the empty shape exists.
  const [meetings, maySchedule, attendeeOptions, zone] = await Promise.all([
    getMeetings(),
    mayScheduleMeeting(),
    getMeetingAttendeeOptions(),
    // The SCHEDULER's zone, defaulting the dialog's timezone field. A default and no more:
    // `scheduleMeeting` validates whatever it is sent (§2).
    resolveZone(user.id),
  ])

  return (
    <PageShell className="space-y-6">
      <MeetingsClient
        initialMeetings={meetings}
        zone={zone}
        maySchedule={maySchedule}
        attendeeOptions={attendeeOptions}
      />
    </PageShell>
  )
}
