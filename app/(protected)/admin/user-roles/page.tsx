import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getAllRolesWithGlobal } from '@/app/actions/admin/chapters'
import { AdminUserRolesClient } from '@/components/admin/AdminUserRolesClient'

export const metadata = { title: 'User Roles — Admin' }

export default async function AdminUserRolesPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const admin = createAdminClient()
  const { data: person } = await admin.from('people').select('is_admin').eq('user_id', user.id).maybeSingle()
  if (!person?.is_admin) redirect('/dashboard')

  const roles = await getAllRolesWithGlobal()

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 py-10">
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-1">User Roles</h1>
        <p className="text-muted-foreground">View global roles and create custom roles for your family organization.</p>
      </div>
      <AdminUserRolesClient initialRoles={roles} />
    </div>
  )
}
