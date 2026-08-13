import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { requireView } from '@/lib/auth/permissions'
import { getAllRolesWithGlobal } from '@/app/actions/admin/chapters'
import { AdminUserRolesClient } from '@/components/admin/AdminUserRolesClient'
import { PageShell } from '@/components/layout/PageShell'

export const metadata = { title: 'Board Positions — Admin' }

export default async function AdminBoardPositionsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  await requireView(user.id, 'admin/boardpositions')

  const roles = await getAllRolesWithGlobal()

  return (
    <PageShell>
      <div className="mb-8">
        <h1 className="mb-1 text-3xl font-bold">Board Positions</h1>
        <p className="text-muted-foreground">Choose which board positions your family uses, and create your own custom positions.</p>
      </div>
      <AdminUserRolesClient initialRoles={roles} />
    </PageShell>
  )
}
