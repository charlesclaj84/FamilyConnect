import { redirect } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getMyFamilyCode } from '@/lib/auth/family'
import { requireView } from '@/lib/auth/permissions'
import { getEvents } from '@/app/actions/admin/events'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { UsersRound, ListChecks, CalendarClock, Clock } from 'lucide-react'
import { formatDate } from '@/lib/date-utils'

export const metadata = { title: 'Admin' }

export default async function AdminPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const admin = createAdminClient()
  const familyCode = await getMyFamilyCode(user.id)

  await requireView(user.id, 'admin/users')

  const [membersResult, draftEvents] = await Promise.all([
    admin.from('people').select('id', { count: 'exact', head: true }).eq('family_code', familyCode).not('user_id', 'is', null),
    getEvents('draft'),
  ])

  const memberCount = membersResult.count ?? 0
  const pendingCount = draftEvents.length

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 py-10 space-y-8">
      <div>
        <h1 className="text-3xl font-bold mb-1">Administration</h1>
        <p className="text-muted-foreground">Manage your family organization.</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card>
          <CardContent className="pt-6">
            <p className="text-3xl font-bold">{memberCount}</p>
            <p className="text-sm text-muted-foreground mt-1">Family Members</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <p className="text-3xl font-bold">{pendingCount}</p>
            <p className="text-sm text-muted-foreground mt-1">Draft Events</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {[
          { href: '/admin/users',       icon: UsersRound,   label: 'Members & Access', desc: 'Who is in the family, and the permission template deciding what each can do.' },
          { href: '/admin/event-types', icon: ListChecks,   label: 'Event Types',    desc: 'Create reusable event templates with planning checklists.' },
          { href: '/admin/events',      icon: CalendarClock, label: 'Events',        desc: 'Create, publish, and manage family events.' },
        ].map(({ href, icon: Icon, label, desc }) => (
          <Link key={href} href={href}>
            <Card className="h-full hover:shadow-md transition-shadow cursor-pointer">
              <CardHeader className="pb-2">
                <CardTitle className="flex items-center gap-2 text-base">
                  <Icon className="h-4 w-4 text-primary" /> {label}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">{desc}</p>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>

      {pendingCount > 0 && (
        <div>
          <h2 className="text-lg font-semibold mb-3 flex items-center gap-2">
            <Clock className="h-4 w-4" /> Draft Events
          </h2>
          <div className="space-y-2">
            {draftEvents.slice(0, 5).map(e => (
              <Link key={e.id} href={`/admin/events/${e.id}`} className="block rounded-lg border bg-card px-4 py-3 hover:shadow-sm transition-shadow">
                <p className="font-medium text-sm">{e.name}</p>
                <p className="text-xs text-muted-foreground">{e.event_date ? formatDate(e.event_date) : 'Date TBD'} · {e.location ?? 'Location TBD'}</p>
              </Link>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
