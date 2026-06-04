import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import Navbar from '@/components/layout/Navbar'
import { Sidebar } from '@/components/layout/Sidebar'

export default async function ProtectedLayout({ children }: { children: React.ReactNode }) {
  let isAdmin = false
  let hasAssignments = false

  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (user) {
      const admin = createAdminClient()
      const [personResult, assignmentResult] = await Promise.all([
        admin.from('people').select('is_admin').eq('user_id', user.id).maybeSingle(),
        admin.from('event_assignments').select('id', { count: 'exact', head: true }).eq('assigned_to', user.id),
      ])
      isAdmin = personResult.data?.is_admin === true
      hasAssignments = (assignmentResult.count ?? 0) > 0
    }
  } catch {
    // Non-fatal
  }

  return (
    <div className="min-h-screen flex flex-col">
      <Navbar />
      <div className="flex flex-1 flex-col md:flex-row">
        <Sidebar isAdmin={isAdmin} hasAssignments={hasAssignments} />
        <main className="flex-1 min-w-0">{children}</main>
      </div>
    </div>
  )
}
