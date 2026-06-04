import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getMyAssignments } from '@/app/actions/event-planning'
import { EventPlanningClient } from '@/components/events/EventPlanningClient'

export const metadata = { title: 'Event Planning — Family Connect' }

export default async function EventPlanningPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const assignments = await getMyAssignments()

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 py-10">
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-1">Event Planning</h1>
        <p className="text-muted-foreground">Tasks assigned to you. Provide a response for each item.</p>
      </div>
      <EventPlanningClient initialAssignments={assignments} />
    </div>
  )
}
