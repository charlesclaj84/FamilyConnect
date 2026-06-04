import { redirect } from 'next/navigation'
import Link from 'next/link'
import {
  Calendar, UserCircle, DollarSign, Clock, MapPin, ChevronRight,
} from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { getUpcomingEvents } from '@/app/actions/events'
import { getMyRoles } from '@/app/actions/admin/users'
import { formatRoleTitle } from '@/lib/role-utils'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'


export const metadata = { title: 'Dashboard — Family Connect' }

export default async function DashboardPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const firstName = user.user_metadata?.first_name || user.email?.split('@')[0] || 'Member'
  const lastName  = user.user_metadata?.last_name ?? ''
  const initials  = [firstName[0], lastName[0]].filter(Boolean).join('').toUpperCase()

  const [upcomingEvents, myRoles] = await Promise.all([
    getUpcomingEvents().then(e => e.slice(0, 3)),
    getMyRoles(),
  ])

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 py-10 space-y-10">

      {/* ── Profile summary + selfie ──────────────────────────────── */}
      <div className="flex items-center gap-5">
        <div className="relative shrink-0">
          <div className="w-20 h-20 rounded-full bg-muted border-2 border-dashed border-border flex items-center justify-center select-none">
            {initials ? (
              <span className="text-2xl font-semibold text-muted-foreground">{initials}</span>
            ) : (
              <UserCircle className="h-10 w-10 text-muted-foreground/40" />
            )}
          </div>

        </div>
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold leading-tight">
            Welcome back, {firstName}!
          </h1>
          {myRoles.length > 0 && (
            <div className="flex flex-wrap gap-2 mt-2">
              {myRoles.map((r, i) => (
                <span key={i} className="inline-flex items-center text-sm font-medium bg-[#0f2540] text-[#e6ecfa] px-3 py-1 rounded-full">
                  {formatRoleTitle(r)}
                </span>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* ── Next Due Date widget ──────────────────────────────────── */}
      <section className="flex flex-col items-end">
        <h2 className="text-lg font-semibold mb-4 w-full max-w-sm">Dues</h2>
        <Card className="max-w-sm w-full">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-sm text-muted-foreground font-normal">
              <div className="p-1.5 rounded-md bg-primary/10 text-primary">
                <DollarSign className="h-4 w-4" />
              </div>
              Next Due Date
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-end gap-2">
              <span className="text-2xl font-semibold">$0.00</span>
              <span className="text-sm text-muted-foreground mb-0.5">due</span>
            </div>
            <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
              <Clock className="h-3.5 w-3.5" />
              No dues scheduled
            </div>
            <Button size="sm" disabled className="w-full cursor-not-allowed opacity-60">
              Make a Payment
            </Button>
            <p className="text-xs text-muted-foreground text-center">
              Payment processing coming soon.
            </p>
          </CardContent>
        </Card>
      </section>

      {/* ── Upcoming Events ───────────────────────────────────────── */}
      <section>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold">Upcoming Events</h2>
          <Link href="/events" className="text-xs text-primary hover:underline">View all</Link>
        </div>
        {upcomingEvents.length === 0 ? (
          <p className="text-sm text-muted-foreground py-4">No upcoming events yet.</p>
        ) : (
          <div className="space-y-3">
            {upcomingEvents.map(event => (
              <Link key={event.id} href={`/events/${event.id}`}>
                <div className="flex items-center gap-4 rounded-xl border bg-card px-4 py-4 hover:shadow-sm transition-shadow cursor-pointer">
                  <div className="shrink-0 p-2.5 rounded-lg bg-primary/10 text-primary">
                    <Calendar className="h-5 w-5" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-sm truncate">{event.name}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {event.event_date
                        ? new Date(event.event_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' })
                        : 'Date TBD'}
                    </p>
                    {event.location && (
                      <div className="flex items-center gap-1 mt-0.5 text-xs text-muted-foreground">
                        <MapPin className="h-3 w-3 shrink-0" />
                        <span className="truncate">{event.location}</span>
                      </div>
                    )}
                  </div>
                  <ChevronRight className="h-4 w-4 text-muted-foreground/40 shrink-0" />
                </div>
              </Link>
            ))}
          </div>
        )}
      </section>


    </div>
  )
}
