import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { requireView } from '@/lib/auth/permissions'
import { createAdminClient } from '@/lib/supabase/admin'
import { getEventTypes } from '@/app/actions/admin/event-types'
import { AdminEventTypesClient } from '@/components/admin/AdminEventTypesClient'

export const metadata = { title: 'Event Templates — Admin' }

export default async function AdminEventTypesPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const admin = createAdminClient()
  await requireView(user.id, 'admin/event-types')

  const eventTypes = await getEventTypes()

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 py-10">
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-1">Event Templates</h1>
        <p className="text-muted-foreground">Define reusable event templates with custom planning checklists.</p>
      </div>
      <AdminEventTypesClient initialEventTypes={eventTypes} />
    </div>
  )
}
