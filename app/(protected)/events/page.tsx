import { redirect } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { getUpcomingEvents } from '@/app/actions/events'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Calendar, MapPin, Clock, ChevronRight } from 'lucide-react'

export const metadata = { title: 'Events — Family Connect' }

export default async function EventsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const events = await getUpcomingEvents()

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 py-10">
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-1">Events</h1>
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
                        <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full">Confirmed</span>
                      )}
                      <ChevronRight className="h-4 w-4 text-muted-foreground" />
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-1">
                  {event.description && <p className="text-sm text-muted-foreground">{event.description}</p>}
                  <div className="flex flex-wrap gap-4 text-xs text-muted-foreground pt-1">
                    {event.event_date && (
                      <span className="flex items-center gap-1"><Calendar className="h-3 w-3" /> {new Date(event.event_date).toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric', timeZone: 'UTC' })}</span>
                    )}
                    {event.location && (
                      <span className="flex items-center gap-1"><MapPin className="h-3 w-3" /> {event.location}</span>
                    )}
                    {event.rsvp_deadline && (
                      <span className="flex items-center gap-1"><Clock className="h-3 w-3" /> RSVP by {new Date(event.rsvp_deadline).toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' })}</span>
                    )}
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
