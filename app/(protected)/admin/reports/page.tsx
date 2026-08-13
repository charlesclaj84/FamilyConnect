import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { requireView } from '@/lib/auth/permissions'
import { getOrgStats } from '@/app/actions/admin/reports'
import { AdminReportsClient } from '@/components/admin/AdminReportsClient'
import { PageShell } from '@/components/layout/PageShell'

export const metadata = { title: 'Reports — Admin' }

export default async function AdminReportsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  await requireView(user.id, 'admin/reports')

  const stats = await getOrgStats()

  return (
    <PageShell>
      <div className="mb-8">
        <h1 className="mb-1 text-3xl font-bold">Reports</h1>
        <p className="text-muted-foreground">Membership, event, dues, and attendance overview.</p>
      </div>
      <AdminReportsClient stats={stats} />
    </PageShell>
  )
}
