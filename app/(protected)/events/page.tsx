import { redirect } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { requireView } from '@/lib/auth/permissions'
import { getUpcomingEvents } from '@/app/actions/events'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Calendar, MapPin, Clock, ChevronRight, Users } from 'lucide-react'
import { formatDate } from '@/lib/date-utils'
import { PageShell } from '@/components/layout/PageShell'

export const metadata = { title: 'Events' }

export default async function EventsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  await requireView(user.id, 'events')

  const events = await getUpcomingEvents()

  return (
    <PageShell>
      <div className="mb-8">
        <h1 className="mb-1 text-3xl font-bold">Upcoming Events</h1>
        <p className="text-muted-foreground">Upcoming family events. Click an event to view details and RSVP.</p>
      </div>

      {events.length === 0 ? (
        <div className="text-center py-16">
          <Calendar className="h-10 w-10 text-muted-foreground/40 mx-auto mb-3" />
          <p className="text-muted-foreground">No upcoming events yet.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {events.map(event => (
            <Link key={event.id} href={`/events/${event.id}`}>
              <Card className="hover:shadow-md transition-shadow cursor-pointer">
                <CardHeader className="pb-2">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <CardTitle className="text-lg">{event.name}</CardTitle>
                      {event.event_type_name && (
                        <span className="text-xs text-muted-foreground">{event.event_type_name}</span>
                      )}
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      {event.status === 'approved' && (
                        <span className="text-xs bg-brand-affirm text-brand-on-affirm px-2 py-0.5 rounded-full">Confirmed</span>
                      )}
                      {event.rsvp_count > 0 && (
                        <span className="flex items-center gap-1 text-xs text-muted-foreground">
                          <Users className="h-3 w-3" /> {event.rsvp_count}
                        </span>
                      )}
                      <ChevronRight className="h-4 w-4 text-muted-foreground" />
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-1">
                  {event.description && <p className="text-sm text-muted-foreground">{event.description}</p>}
                  {event.official_description && (
                    <details className="mt-1">
                      <summary className="cursor-pointer text-xs text-primary hover:underline select-none">
                        Official Information ▸
                      </summary>
                      <p className="mt-1 text-sm text-foreground border-l-2 border-primary pl-3 py-1">{event.official_description}</p>
                    </details>
                  )}
                  <div className="flex flex-wrap gap-4 text-xs text-muted-foreground pt-1">
                    {(event.start_date || event.event_date) && (
                      <span className="flex items-center gap-1">
                        <Calendar className="h-3 w-3" />
                        {formatDate(event.start_date ?? event.event_date)}
                        {event.end_date && event.end_date !== event.start_date && ` – ${formatDate(event.end_date)}`}
                      </span>
                    )}
                    {(event.location || event.city) && (
                      <span className="flex items-center gap-1"><MapPin className="h-3 w-3" /> {[event.location, event.city, event.state].filter(Boolean).join(', ')}</span>
                    )}
                    {event.rsvp_deadline && (
                      <span className="flex items-center gap-1"><Clock className="h-3 w-3" /> RSVP by {formatDate(event.rsvp_deadline)}</span>
                    )}
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </PageShell>
  )
}
