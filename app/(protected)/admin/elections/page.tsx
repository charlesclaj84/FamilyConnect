import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { requireView } from '@/lib/auth/permissions'
import { getAllElections } from '@/app/actions/elections'
import { getAllRoles } from '@/app/actions/admin/users'
import { AdminElectionsClient } from '@/components/admin/AdminElectionsClient'
import { PageShell } from '@/components/layout/PageShell'

export const metadata = { title: 'Election Management — Admin' }

export default async function AdminElectionsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  await requireView(user.id, 'admin/elections')

  const [elections, roles] = await Promise.all([getAllElections(), getAllRoles()])

  return (
    <PageShell>
      <div className="mb-8">
        <h1 className="mb-1 text-3xl font-bold">Election Management</h1>
        <p className="text-muted-foreground">Create and manage family officer elections.</p>
      </div>
      <AdminElectionsClient initialElections={elections} roles={roles.map(r => r.name)} />
    </PageShell>
  )
}
