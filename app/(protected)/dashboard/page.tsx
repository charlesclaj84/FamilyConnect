import { redirect } from 'next/navigation'
import {
  Calendar, MessageCircle, Camera, Store, Users,
  UserCircle, DollarSign, Clock, MapPin, ChevronRight,
} from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'

// ── Coming-soon platform features ─────────────────────────────────────────────

const features = [
  {
    title: 'Events',
    description: 'Plan and RSVP to upcoming family gatherings.',
    icon: <Calendar className="h-6 w-6" />,
  },
  {
    title: 'Chat',
    description: 'Message the whole family or create group conversations.',
    icon: <MessageCircle className="h-6 w-6" />,
  },
  {
    title: 'Photos',
    description: 'Share and tag photos from family moments.',
    icon: <Camera className="h-6 w-6" />,
  },
  {
    title: 'Vendors',
    description: 'Shop products and services from family-trusted vendors.',
    icon: <Store className="h-6 w-6" />,
  },
  {
    title: 'Directory',
    description: 'Browse and connect with all family members.',
    icon: <Users className="h-6 w-6" />,
  },
]

// ── Placeholder upcoming events ────────────────────────────────────────────────

const placeholderEvents = [
  {
    id: 1,
    title: 'Summer Family Reunion',
    date: 'Sat, Aug 2, 2026',
    time: '12:00 PM',
    location: 'Riverside Park Pavilion',
  },
  {
    id: 2,
    title: 'Annual Cookout',
    date: 'Sat, Sep 6, 2026',
    time: '2:00 PM',
    location: 'Grandma\'s Backyard',
  },
  {
    id: 3,
    title: 'Holiday Gathering',
    date: 'Thu, Nov 27, 2026',
    time: '4:00 PM',
    location: 'TBD',
  },
]

export const metadata = { title: 'Dashboard — Family Connect' }

export default async function DashboardPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const firstName = user.user_metadata?.first_name || user.email?.split('@')[0] || 'Member'
  const lastName  = user.user_metadata?.last_name ?? ''
  const initials  = [firstName[0], lastName[0]].filter(Boolean).join('').toUpperCase()

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 py-10 space-y-10">

      {/* ── Profile summary + selfie ──────────────────────────────── */}
      <div className="flex items-center gap-5 rounded-xl border bg-card px-5 py-5">
        <div className="relative shrink-0">
          <div className="w-20 h-20 rounded-full bg-muted border-2 border-dashed border-border flex items-center justify-center select-none">
            {initials ? (
              <span className="text-2xl font-semibold text-muted-foreground">{initials}</span>
            ) : (
              <UserCircle className="h-10 w-10 text-muted-foreground/40" />
            )}
          </div>
          <div
            className="absolute -bottom-1 -right-1 rounded-full bg-muted border border-border p-1"
            title="Photo upload coming soon"
          >
            <Camera className="h-3.5 w-3.5 text-muted-foreground" />
          </div>
        </div>
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold leading-tight">
            Welcome back, {firstName}!
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Your family portal is ready. Features are being added — stay tuned.
          </p>
          <p className="text-xs text-muted-foreground/60 mt-0.5">
            Profile photo upload coming soon.
          </p>
        </div>
      </div>

      {/* ── Next Due Date widget ──────────────────────────────────── */}
      <section>
        <h2 className="text-lg font-semibold mb-4">Dues</h2>
        <Card className="max-w-sm">
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
          <span className="text-xs bg-muted text-muted-foreground px-2 py-0.5 rounded-full">
            Coming Soon
          </span>
        </div>
        <div className="space-y-3">
          {placeholderEvents.map(event => (
            <div
              key={event.id}
              className="flex items-center gap-4 rounded-xl border bg-card px-4 py-4 opacity-60 select-none"
            >
              <div className="shrink-0 p-2.5 rounded-lg bg-primary/10 text-primary">
                <Calendar className="h-5 w-5" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-medium text-sm truncate">{event.title}</p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {event.date} &middot; {event.time}
                </p>
                <div className="flex items-center gap-1 mt-0.5 text-xs text-muted-foreground">
                  <MapPin className="h-3 w-3 shrink-0" />
                  <span className="truncate">{event.location}</span>
                </div>
              </div>
              <ChevronRight className="h-4 w-4 text-muted-foreground/40 shrink-0" />
            </div>
          ))}
        </div>
      </section>

      {/* ── Platform features ─────────────────────────────────────── */}
      <section>
        <h2 className="text-lg font-semibold mb-4">Platform Features</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {features.map((feature) => (
            <Card
              key={feature.title}
              className="relative opacity-70 cursor-not-allowed select-none"
            >
              <span className="absolute top-3 right-3 text-xs font-medium bg-muted text-muted-foreground px-2 py-0.5 rounded-full">
                Coming Soon
              </span>
              <CardHeader className="pb-3">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-md bg-primary/10 text-primary">
                    {feature.icon}
                  </div>
                  <CardTitle className="text-base">{feature.title}</CardTitle>
                </div>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">{feature.description}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

    </div>
  )
}
