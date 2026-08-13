'use client'

import { useState } from 'react'
import { ChevronDown, ChevronRight, Calendar, MapPin, ListOrdered, Clock } from 'lucide-react'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { formatTime, formatDateRange } from '@/lib/date-utils'
import type { AdminEvent } from '@/app/actions/admin/events'

function SubEventEntry({ sub }: { sub: AdminEvent }) {
  const [open, setOpen] = useState(false)

  const dateLabel = formatDateRange(sub.start_date ?? sub.event_date, sub.end_date)
  const timeLabel = sub.is_all_day === false
    ? [sub.start_time ? formatTime(sub.start_time) : null, sub.end_time ? formatTime(sub.end_time) : null].filter(Boolean).join(' – ')
    : null

  const address = [sub.street_address, sub.suite, sub.city, sub.state, sub.zip_code, sub.country].filter(Boolean).join(', ')
  const mapsUrl = address ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}` : null

  return (
    <div className="border rounded-lg overflow-hidden">
      {/* Summary row — always visible, click to expand */}
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between px-4 py-3 text-left hover:bg-muted/30 transition-colors"
      >
        <div className="flex-1 min-w-0 space-y-0.5">
          <p className="text-sm font-medium">{sub.name}</p>
          <div className="flex flex-wrap gap-3 text-xs text-muted-foreground">
            {dateLabel && (
              <span className="flex items-center gap-1">
                <Calendar className="h-3 w-3" /> {dateLabel}
              </span>
            )}
            {timeLabel && (
              <span className="flex items-center gap-1">
                <Clock className="h-3 w-3" /> {timeLabel}
              </span>
            )}
            {sub.location && (
              <span className="flex items-center gap-1">
                <MapPin className="h-3 w-3" /> {sub.location}
              </span>
            )}
          </div>
        </div>
        <span className="shrink-0 text-muted-foreground ml-2">
          {open ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
        </span>
      </button>

      {/* Expanded details */}
      {open && (
        <div className="border-t px-4 py-3 space-y-2 bg-muted/20">
          {sub.description && (
            <p className="text-sm text-muted-foreground">{sub.description}</p>
          )}
          {sub.official_description && (
            <div className="rounded-md border-l-4 border-primary bg-primary/5 px-3 py-2">
              <p className="text-xs font-semibold text-primary mb-0.5">Official Information</p>
              <p className="text-sm">{sub.official_description}</p>
            </div>
          )}
          {sub.event_type_name && (
            <p className="text-xs text-muted-foreground">Type: {sub.event_type_name}</p>
          )}
          {address && (
            mapsUrl ? (
              <a
                href={mapsUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-start gap-1.5 text-xs text-primary hover:underline"
              >
                <MapPin className="h-3.5 w-3.5 mt-0.5 shrink-0" />
                <span>{address}</span>
              </a>
            ) : (
              <p className="flex items-start gap-1.5 text-xs text-muted-foreground">
                <MapPin className="h-3.5 w-3.5 mt-0.5 shrink-0" />
                {address}
              </p>
            )
          )}
        </div>
      )}
    </div>
  )
}

export function EventItineraryClient({ subEvents }: { subEvents: AdminEvent[] }) {
  const [expanded, setExpanded] = useState(false)

  return (
    <Card>
      <CardHeader className="cursor-pointer select-none" onClick={() => setExpanded(e => !e)}>
        <CardTitle className="flex items-center justify-between text-lg">
          <span className="flex items-center gap-2">
            <ListOrdered className="h-5 w-5 text-primary" /> Itinerary
            {subEvents.length > 0 && (
              <span className="text-xs font-normal text-muted-foreground">
                ({subEvents.length} {subEvents.length === 1 ? 'item' : 'items'})
              </span>
            )}
          </span>
          {expanded
            ? <ChevronDown className="h-4 w-4 text-muted-foreground" />
            : <ChevronRight className="h-4 w-4 text-muted-foreground" />
          }
        </CardTitle>
      </CardHeader>

      {expanded && (
        <CardContent className="space-y-2">
          {subEvents.length === 0 ? (
            <p className="text-sm text-muted-foreground">Itinerary details will appear here as the event is planned.</p>
          ) : (
            subEvents.map(sub => <SubEventEntry key={sub.id} sub={sub} />)
          )}
        </CardContent>
      )}
    </Card>
  )
}
