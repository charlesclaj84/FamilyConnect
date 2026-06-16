import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getMyAssignmentCount } from '@/app/actions/event-planning'
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
      // Count only outstanding items (shared with the Event Planning page) so the
      // nav link hides once everything is completed or cancelled. This also sweeps
      // overdue tasks into the 'cancelled' state.
      const [personResult, assignmentCount] = await Promise.all([
        admin.from('people').select('is_admin').eq('user_id', user.id).maybeSingle(),
        getMyAssignmentCount(),
      ])
      isAdmin = personResult.data?.is_admin === true
      hasAssignments = assignmentCount > 0
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
