import { redirect, notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getEventReport, getEventAssignments, getSubEvents } from '@/app/actions/admin/events'
import { getBlueprintItems, getEventTypes } from '@/app/actions/admin/event-types'
import { getFamilyMembersWithRoles } from '@/app/actions/admin/users'
import { getFunds } from '@/app/actions/funds'
import { AdminEventDetailClient } from '@/components/admin/AdminEventDetailClient'

export const metadata = { title: 'Event Detail — Admin' }

export default async function AdminEventDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const admin = createAdminClient()
  const { data: person } = await admin.from('people').select('is_admin, can_approve').eq('user_id', user.id).maybeSingle()
  if (!person?.is_admin) redirect('/dashboard')

  const [report, assignments, members, subEvents, eventTypes, funds] = await Promise.all([
    getEventReport(id),
    getEventAssignments(id),
    getFamilyMembersWithRoles(),
    getSubEvents(id),
    getEventTypes(),
    getFunds(),
  ])

  if (!report) notFound()

  const blueprintItems = report.event.event_type_id
    ? await getBlueprintItems(report.event.event_type_id)
    : []

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 py-10">
      <AdminEventDetailClient
        report={report}
        assignments={assignments}
        blueprintItems={blueprintItems}
        members={members}
        canApprove={person?.can_approve === true}
        initialSubEvents={subEvents}
        eventTypes={eventTypes}
        funds={funds.map(f => ({ id: f.id, name: f.name, event_id: f.event_id }))}
      />
    </div>
  )
}
