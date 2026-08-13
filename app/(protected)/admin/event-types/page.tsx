import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { requireView } from '@/lib/auth/permissions'
import { getEventTypes } from '@/app/actions/admin/event-types'
import { AdminEventTypesClient } from '@/components/admin/AdminEventTypesClient'
import { PageShell } from '@/components/layout/PageShell'

export const metadata = { title: 'Event Templates — Admin' }

export default async function AdminEventTypesPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  await requireView(user.id, 'admin/event-types')

  const eventTypes = await getEventTypes()

  return (
    <PageShell>
      <div className="mb-8">
        <h1 className="mb-1 text-3xl font-bold">Event Templates</h1>
        <p className="text-muted-foreground">Define reusable event templates with custom planning checklists.</p>
      </div>
      <AdminEventTypesClient initialEventTypes={eventTypes} />
    </PageShell>
  )
}
