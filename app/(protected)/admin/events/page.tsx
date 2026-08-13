import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { can } from '@/lib/auth/permissions'
import { requireView } from '@/lib/auth/permissions'
import { getEvents } from '@/app/actions/admin/events'
import { getEventTypes } from '@/app/actions/admin/event-types'
import { AdminEventsClient } from '@/components/admin/AdminEventsClient'
import { PageShell } from '@/components/layout/PageShell'

export const metadata = { title: 'Event Management — Admin' }

export default async function AdminEventsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  await requireView(user.id, 'admin/events')

  const [events, eventTypes] = await Promise.all([getEvents(), getEventTypes()])

  return (
    <PageShell>
      <div className="mb-8">
        <h1 className="mb-1 text-3xl font-bold">Event Management</h1>
        <p className="text-muted-foreground">Create, publish, and manage family events.</p>
      </div>
      <AdminEventsClient
        initialEvents={events}
        eventTypes={eventTypes}
        canApprove={await can(user.id, 'admin/events', 'edit')}
      />
    </PageShell>
  )
}
