import { redirect, notFound } from 'next/navigation'
import Link from 'next/link'
import { ChevronLeft } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { requireView } from '@/lib/auth/permissions'
import { getCheckInList } from '@/app/actions/admin/event-checkin'
import { EventCheckInClient } from '@/components/admin/EventCheckInClient'
import { PageShell } from '@/components/layout/PageShell'

export const metadata = { title: 'Event Check-In — Admin' }

export default async function EventCheckInPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const admin = createAdminClient()
  await requireView(user.id, 'admin/events')

  const { data: event } = await admin.from('events').select('name').eq('id', id).maybeSingle()
  if (!event) notFound()

  const attendees = await getCheckInList(id)

  return (
    <PageShell>
      <Link href={`/admin/events/${id}`} className="text-sm text-muted-foreground hover:text-foreground flex items-center gap-1 mb-6">
        <ChevronLeft className="h-3.5 w-3.5" /> Back to Event
      </Link>
      <div className="mb-8">
        <h1 className="mb-1 text-3xl font-bold">Check-In</h1>
        <p className="text-muted-foreground">{event.name}</p>
      </div>
      <EventCheckInClient eventId={id} initialAttendees={attendees} />
    </PageShell>
  )
}
