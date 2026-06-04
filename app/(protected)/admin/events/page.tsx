import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getEvents } from '@/app/actions/admin/events'
import { getEventTypes } from '@/app/actions/admin/event-types'
import { AdminEventsClient } from '@/components/admin/AdminEventsClient'

export const metadata = { title: 'Events — Admin' }

export default async function AdminEventsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const admin = createAdminClient()
  const { data: person } = await admin.from('people').select('is_admin, can_approve').eq('user_id', user.id).maybeSingle()
  if (!person?.is_admin) redirect('/dashboard')

  const [events, eventTypes] = await Promise.all([getEvents(), getEventTypes()])

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 py-10">
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-1">Events</h1>
        <p className="text-muted-foreground">Create, publish, and manage family events.</p>
      </div>
      <AdminEventsClient
        initialEvents={events}
        eventTypes={eventTypes}
        canApprove={person?.can_approve === true}
      />
    </div>
  )
}
