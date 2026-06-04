import { redirect, notFound } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { getEventDetail, getMyRsvp, getMyFamilyForRsvp } from '@/app/actions/events'
import { getSubEvents } from '@/app/actions/admin/events'
import { EventRsvpClient } from '@/components/events/EventRsvpClient'
import { ChevronLeft, Calendar, MapPin, Clock, ListOrdered } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

export const metadata = { title: 'Event — Family Connect' }

export default async function EventDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const [event, myRsvp, familyMembers, subEvents] = await Promise.all([
    getEventDetail(id),
    getMyRsvp(id),
    getMyFamilyForRsvp(),
    getSubEvents(id),
  ])

  if (!event) notFound()

  const deadlinePassed = event.rsvp_deadline
    ? new Date(event.rsvp_deadline) < new Date()
    : false

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 py-10 space-y-8">
      <div>
        <Link href="/events" className="text-sm text-muted-foreground hover:text-foreground flex items-center gap-1 mb-4">
          <ChevronLeft className="h-3.5 w-3.5" /> Back to Events
        </Link>

        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold mb-1">{event.name}</h1>
            {event.event_type_name && <p className="text-sm text-muted-foreground">{event.event_type_name}</p>}
          </div>
          {event.status === 'approved' && (
            <span className="text-xs bg-green-100 text-green-700 px-2.5 py-1 rounded-full shrink-0">Confirmed</span>
          )}
        </div>

        {event.description && (
          <p className="text-muted-foreground mt-3">{event.description}</p>
        )}

        <div className="flex flex-wrap gap-4 text-sm text-muted-foreground mt-4">
          {event.event_date && (
            <span className="flex items-center gap-1.5">
              <Calendar className="h-4 w-4" />
              {new Date(event.event_date).toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric', timeZone: 'UTC' })}
            </span>
          )}
          {event.location && (
            <span className="flex items-center gap-1.5"><MapPin className="h-4 w-4" /> {event.location}</span>
          )}
          {event.rsvp_deadline && (
            <span className="flex items-center gap-1.5">
              <Clock className="h-4 w-4" />
              RSVP by {new Date(event.rsvp_deadline).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric', timeZone: 'UTC' })}
            </span>
          )}
        </div>
      </div>

      {/* Itinerary */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <ListOrdered className="h-4 w-4 text-primary" /> Itinerary
          </CardTitle>
        </CardHeader>
        <CardContent>
          {subEvents.length === 0 ? (
            <p className="text-sm text-muted-foreground">Itinerary details will appear here as the event is planned.</p>
          ) : (
            <div className="divide-y">
              {subEvents.map(sub => (
                <div key={sub.id} className="py-3">
                  <p className="text-sm font-medium">{sub.name}</p>
                  <div className="flex flex-wrap gap-3 text-xs text-muted-foreground mt-0.5">
                    {sub.event_date && (
                      <span className="flex items-center gap-1"><Calendar className="h-3 w-3" />
                        {new Date(sub.event_date).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', timeZone: 'UTC' })}
                        {sub.event_time ? ` at ${sub.event_time}` : ''}
                      </span>
                    )}
                    {sub.location && <span className="flex items-center gap-1"><MapPin className="h-3 w-3" /> {sub.location}</span>}
                  </div>
                  {sub.description && <p className="text-xs text-muted-foreground mt-1">{sub.description}</p>}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardContent className="pt-6">
          <h2 className="text-lg font-semibold mb-4">Your RSVP</h2>
          {deadlinePassed && !myRsvp ? (
            <p className="text-sm text-muted-foreground">The RSVP deadline has passed.</p>
          ) : (
            <EventRsvpClient
              eventId={id}
              familyMembers={familyMembers}
              existingRsvp={myRsvp}
              deadlinePassed={deadlinePassed}
            />
          )}
        </CardContent>
      </Card>
    </div>
  )
}
