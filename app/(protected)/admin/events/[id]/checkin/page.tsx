import { redirect, notFound } from 'next/navigation'
import Link from 'next/link'
import { ChevronLeft } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { requireView } from '@/lib/auth/permissions'
import { getCheckInList } from '@/app/actions/admin/event-checkin'
import { EventCheckInClient } from '@/components/admin/EventCheckInClient'

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
    <div className="max-w-2xl mx-auto px-4 sm:px-6 py-10">
      <Link href={`/admin/events/${id}`} className="text-sm text-muted-foreground hover:text-foreground flex items-center gap-1 mb-6">
        <ChevronLeft className="h-3.5 w-3.5" /> Back to Event
      </Link>
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-1">Check-In</h1>
        <p className="text-muted-foreground">{event.name}</p>
      </div>
      <EventCheckInClient eventId={id} initialAttendees={attendees} />
    </div>
  )
}
