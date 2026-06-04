import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getFamilyMembersWithRoles, getAllRoles } from '@/app/actions/admin/users'
import { getChapters } from '@/app/actions/admin/chapters'
import { AdminUsersClient } from '@/components/admin/AdminUsersClient'

export const metadata = { title: 'Users — Admin' }

export default async function AdminUsersPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const admin = createAdminClient()
  const { data: person } = await admin.from('people').select('is_admin').eq('user_id', user.id).maybeSingle()
  if (!person?.is_admin) redirect('/dashboard')

  const [members, roles, chapters] = await Promise.all([getFamilyMembersWithRoles(), getAllRoles(), getChapters()])

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 py-10">
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-1">Users</h1>
        <p className="text-muted-foreground">Manage admin flags, approval authority, and organizational roles.</p>
      </div>
      <AdminUsersClient members={members} roles={roles} chapters={chapters} currentUserId={user.id} />
    </div>
  )
}
