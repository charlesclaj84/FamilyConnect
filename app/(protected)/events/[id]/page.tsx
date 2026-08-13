import { redirect, notFound } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { requireView } from '@/lib/auth/permissions'
import { getEventDetail, getMyRsvp, getMyFamilyForRsvp, getEventHotels, getEventRsvpSummary } from '@/app/actions/events'
import { getSubEvents } from '@/app/actions/admin/events'
import { getOrCreateEventCollection } from '@/app/actions/photos'
import { EventRsvpClient } from '@/components/events/EventRsvpClient'
import { EventHotelsClient } from '@/components/events/EventHotelsClient'
import { EventItineraryClient } from '@/components/events/EventItineraryClient'
import { ChevronLeft, Calendar, MapPin, Clock, ClipboardList, Users, Camera } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { formatDate } from '@/lib/date-utils'

export const metadata = { title: 'Event' }

export default async function EventDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  await requireView(user.id, 'events')

  const [event, myRsvp, familyMembers, subEvents, hotels, rsvpSummary, photoCollection] = await Promise.all([
    getEventDetail(id),
    getMyRsvp(id),
    getMyFamilyForRsvp(),
    getSubEvents(id),
    getEventHotels(id),
    getEventRsvpSummary(id),
    getOrCreateEventCollection(id),
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
            <span className="text-xs bg-brand-affirm text-brand-on-affirm px-2.5 py-1 rounded-full shrink-0">Confirmed</span>
          )}
        </div>

        {event.description && (
          <p className="text-muted-foreground mt-3">{event.description}</p>
        )}

        <div className="flex flex-wrap gap-4 text-sm text-muted-foreground mt-4">
          {(event.start_date || event.event_date) && (
            <span className="flex items-center gap-1.5">
              <Calendar className="h-4 w-4" />
              {formatDate(event.start_date ?? event.event_date)}
              {event.end_date && event.end_date !== event.start_date && ` – ${formatDate(event.end_date)}`}
            </span>
          )}
          {(event.location || event.city) && (
            <span className="flex items-center gap-1.5"><MapPin className="h-4 w-4" /> {[event.location, event.city, event.state].filter(Boolean).join(', ')}</span>
          )}
          {event.rsvp_deadline && (
            <span className="flex items-center gap-1.5">
              <Clock className="h-4 w-4" />
              RSVP by {formatDate(event.rsvp_deadline)}
            </span>
          )}
        </div>
      </div>

      {/* Hotel Options */}
      {hotels.length > 0 && <EventHotelsClient hotels={hotels} />}

      {/* Itinerary — expandable */}
      <EventItineraryClient subEvents={subEvents} />

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <ClipboardList className="h-5 w-5 text-primary" /> Your RSVP
          </CardTitle>
        </CardHeader>
        <CardContent>
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

      {/* Photo Collection link */}
      {photoCollection && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <Camera className="h-5 w-5 text-primary" /> Photos
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Link
              href={`/photos/${photoCollection.id}`}
              className="text-sm text-primary hover:underline"
            >
              Browse &amp; upload event photos →
            </Link>
          </CardContent>
        </Card>
      )}

      {/* Who's Coming — flat attending list sorted by first name */}
      {(() => {
        // Deduplicate by person_id — any "attending" mark wins
        const seenIds = new Map<string, string>()
        for (const entry of rsvpSummary) {
          for (const a of entry.attendees) {
            if (a.is_attending) seenIds.set(a.person_id, a.name)
          }
        }
        const deduped = [...seenIds.values()].sort((a, b) => a.localeCompare(b))
        return deduped.length > 0 ? (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <Users className="h-5 w-5 text-primary" /> Who&apos;s Coming ({deduped.length})
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="divide-y">
                {deduped.map((name, i) => (
                  <li key={i} className="py-2 text-sm">{name}</li>
                ))}
              </ul>
            </CardContent>
          </Card>
        ) : null
      })()}
    </div>
  )
}
