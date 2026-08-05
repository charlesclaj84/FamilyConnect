import Link from 'next/link'
import { Users, CalendarDays, Bell } from 'lucide-react'

interface Props {
  memberCount: number
  daysToNextEvent: number | null
  nextEventId?: string | null
  unreadCount: number
  /** False while Events is still on the roadmap — see lib/features.ts. */
  eventsLive: boolean
}

function StatCard({ icon: Icon, label, value, color }: {
  icon: React.ElementType
  label: string
  value: string
  color: string
}) {
  return (
    <div className="flex items-center gap-3 rounded-xl border bg-card px-4 py-3 w-full hover:shadow-sm transition-shadow">
      <div className={`p-2 rounded-md ${color}`}>
        <Icon className="h-4 w-4" />
      </div>
      <div>
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className="text-lg font-semibold leading-tight">{value}</p>
      </div>
    </div>
  )
}

export function DashboardStats({ memberCount, daysToNextEvent, nextEventId, unreadCount, eventsLive }: Props) {
  const eventLabel = daysToNextEvent === null
    ? 'No events'
    : daysToNextEvent === 0
      ? 'Today!'
      : `${daysToNextEvent}d away`

  return (
    <div className="flex flex-col sm:flex-row gap-3">
      <Link href="/members" className="flex-1">
        <StatCard icon={Users} label="Members" value={String(memberCount)} color="bg-blue-100 text-blue-700" />
      </Link>

      {/* Omitted entirely until Events ships, rather than shown as "coming soon".
          The row simply narrows to the stats that mean something today. */}
      {!eventsLive ? null : nextEventId ? (
        <Link href={`/events/${nextEventId}`} className="flex-1">
          <StatCard icon={CalendarDays} label="Next Event" value={eventLabel} color="bg-purple-100 text-purple-700" />
        </Link>
      ) : (
        <div className="flex-1">
          <StatCard icon={CalendarDays} label="Next Event" value={eventLabel} color="bg-purple-100 text-purple-700" />
        </div>
      )}

      <div className="flex-1">
        <StatCard
          icon={Bell}
          label="Unread"
          value={unreadCount === 0 ? 'All clear' : String(unreadCount)}
          color={unreadCount > 0 ? 'bg-amber-100 text-amber-700' : 'bg-green-100 text-green-700'}
        />
      </div>
    </div>
  )
}
