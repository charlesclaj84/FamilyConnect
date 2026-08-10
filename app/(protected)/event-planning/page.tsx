import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { requireView } from '@/lib/auth/permissions'
import { getMyAssignments, getFamilyMembersForPlanning } from '@/app/actions/event-planning'
import { EventPlanningClient } from '@/components/events/EventPlanningClient'

export const metadata = { title: 'Event Planning' }

export default async function EventPlanningPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  await requireView(user.id, 'event-planning')

  const [assignments, familyMembers] = await Promise.all([
    getMyAssignments(),
    getFamilyMembersForPlanning(),
  ])

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 py-10">
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-1">Event Planning</h1>
        <p className="text-muted-foreground">Tasks assigned to you. Provide a response for each item.</p>
      </div>
      <EventPlanningClient initialAssignments={assignments} familyMembers={familyMembers} />
    </div>
  )
}
