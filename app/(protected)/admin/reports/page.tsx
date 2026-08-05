import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { requireView } from '@/lib/auth/permissions'
import { createAdminClient } from '@/lib/supabase/admin'
import { getOrgStats } from '@/app/actions/admin/reports'
import { AdminReportsClient } from '@/components/admin/AdminReportsClient'

export const metadata = { title: 'Reports — Admin' }

export default async function AdminReportsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const admin = createAdminClient()
  await requireView(user.id, 'admin/reports')

  const stats = await getOrgStats()

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 py-10">
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-1">Reports</h1>
        <p className="text-muted-foreground">Membership, event, dues, and attendance overview.</p>
      </div>
      <AdminReportsClient stats={stats} />
    </div>
  )
}
