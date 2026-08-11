'use client'

import { useState } from 'react'
import { Phone, Globe, ChevronDown, ChevronRight, MapPin, Clock, BedDouble } from 'lucide-react'
import { formatDate } from '@/lib/date-utils'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import type { PublicHotel } from '@/app/actions/events'

function HotelCard({ hotel }: { hotel: PublicHotel }) {
  const [expanded, setExpanded] = useState(false)

  const address = [hotel.street_address, hotel.suite, hotel.city, hotel.state, hotel.zip_code, hotel.country]
    .filter(Boolean).join(', ')

  return (
    <div className="rounded-xl border bg-card">
      {/* Summary row — always visible */}
      <div className="px-4 py-4 space-y-2">
        {/* Hotel Name + expand toggle */}
        <div className="flex items-start justify-between gap-2">
          <p className="font-semibold">{hotel.hotel_name}</p>
          <button onClick={() => setExpanded(e => !e)} className="shrink-0 text-muted-foreground mt-0.5 hover:text-foreground transition-colors">
            {expanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
          </button>
        </div>

        {/* Phone / Website */}
        {(hotel.phone || hotel.website) && (
          <div className="flex flex-wrap gap-4">
            {hotel.phone && (
              <a href={`tel:${hotel.phone}`} className="flex items-center gap-1.5 text-sm text-primary hover:underline">
                <Phone className="h-3.5 w-3.5" /> {hotel.phone}
              </a>
            )}
            {hotel.website && (
              <a href={hotel.website} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1.5 text-sm text-primary hover:underline">
                <Globe className="h-3.5 w-3.5" /> Website
              </a>
            )}
          </div>
        )}

        {/* Booking Deadline */}
        {hotel.booking_deadline && (
          <p className="flex items-center gap-1.5 text-sm text-muted-foreground">
            <Clock className="h-3.5 w-3.5" />
            Book by {formatDate(hotel.booking_deadline)}
          </p>
        )}

        {/* Price Estimates */}
        {hotel.estimates.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {hotel.estimates.map(e => (
              <span key={e.id} className="text-xs bg-brand-soft text-brand-on-soft px-2 py-0.5 rounded-full">
                {e.room_type} — ${Number(e.amount).toFixed(2)}
              </span>
            ))}
          </div>
        )}

        {/* Booking Code */}
        {hotel.booking_code && (
          <p className="text-sm text-muted-foreground">
            Group Code: <span className="font-mono text-foreground">{hotel.booking_code}</span>
          </p>
        )}
      </div>

      {/* Expanded details */}
      {expanded && (address || hotel.details.length > 0) && (
        <div className="border-t px-4 py-4 space-y-3">
          {/* Address — clickable Google Maps link */}
          {address && (
            <a
              href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}`}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-start gap-1.5 text-sm text-primary hover:underline"
            >
              <MapPin className="h-3.5 w-3.5 mt-0.5 shrink-0" />
              <span>{address}</span>
            </a>
          )}

          {/* Key/value details */}
          {hotel.details.length > 0 && (
            <div className="rounded-lg border divide-y">
              {hotel.details.map(d => (
                <div key={d.id} className="flex justify-between px-3 py-1.5 text-sm">
                  <span className="text-muted-foreground">{d.key}</span>
                  <span className="font-medium">{d.value}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

export function EventHotelsClient({ hotels }: { hotels: PublicHotel[] }) {
  const [expanded, setExpanded] = useState(false)

  return (
    <Card>
      <CardHeader className="cursor-pointer select-none" onClick={() => setExpanded(e => !e)}>
        <CardTitle className="flex items-center justify-between text-lg">
          <span className="flex items-center gap-2">
            <BedDouble className="h-5 w-5 text-primary" /> Hotel Options
            <span className="text-xs font-normal text-muted-foreground">({hotels.length} {hotels.length === 1 ? 'hotel' : 'hotels'})</span>
          </span>
          {expanded
            ? <ChevronDown className="h-4 w-4 text-muted-foreground" />
            : <ChevronRight className="h-4 w-4 text-muted-foreground" />
          }
        </CardTitle>
      </CardHeader>
      {expanded && (
        <CardContent className="space-y-3">
          {hotels.map(hotel => (
            <HotelCard key={hotel.id} hotel={hotel} />
          ))}
        </CardContent>
      )}
    </Card>
  )
}
