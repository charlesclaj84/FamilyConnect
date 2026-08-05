import { createClient } from '@/lib/supabase/server'
import { viewableResources } from '@/lib/auth/permissions'
import { getMyAssignmentCount } from '@/app/actions/event-planning'
import Navbar from '@/components/layout/Navbar'
import { Sidebar } from '@/components/layout/Sidebar'
import { ConfirmProvider } from '@/components/ui/confirm'

export default async function ProtectedLayout({ children }: { children: React.ReactNode }) {
  let hasAssignments = false
  let viewable: string[] = []

  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (user) {
      // The sidebar shows a page only if the member may view it. There is no
      // is_admin branch any more — group policy is the single authority.
      // Count only outstanding items (shared with the Event Planning page) so the
      // nav link hides once everything is completed or cancelled. This also sweeps
      // overdue tasks into the 'cancelled' state.
      const [resources, assignmentCount] = await Promise.all([
        viewableResources(user.id),
        getMyAssignmentCount(),
      ])
      viewable = [...resources]
      hasAssignments = assignmentCount > 0
    }
  } catch {
    // Non-fatal
  }

  // Every edit and delete in the signed-in app gates itself on useConfirm(), so
  // the provider has to sit above the whole shell — the navbar and sidebar
  // mutate state too.
  return (
    <ConfirmProvider>
      <div className="min-h-screen flex flex-col">
        <Navbar />
        <div className="flex flex-1 flex-col md:flex-row">
          <Sidebar hasAssignments={hasAssignments} viewable={viewable} />
          <main className="flex-1 min-w-0">{children}</main>
        </div>
      </div>
    </ConfirmProvider>
  )
}
