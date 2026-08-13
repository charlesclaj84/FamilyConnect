import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { requireView } from '@/lib/auth/permissions'
import { getMyAssignments, getFamilyMembersForPlanning } from '@/app/actions/event-planning'
import { EventPlanningClient } from '@/components/events/EventPlanningClient'
import { PageShell } from '@/components/layout/PageShell'

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
    <PageShell>
      <div className="mb-8">
        <h1 className="mb-1 text-3xl font-bold">Event Planning</h1>
        <p className="text-muted-foreground">Tasks assigned to you. Provide a response for each item.</p>
      </div>
      <EventPlanningClient initialAssignments={assignments} familyMembers={familyMembers} />
    </PageShell>
  )
}
