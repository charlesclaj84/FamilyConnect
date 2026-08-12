import type { Metadata } from 'next'
import { createClient } from '@/lib/supabase/server'
import { viewableResources } from '@/lib/auth/permissions'
import { getMyAssignmentCount } from '@/app/actions/event-planning'
import Navbar from '@/components/layout/Navbar'
import { Sidebar } from '@/components/layout/Sidebar'
import { ConfirmProvider } from '@/components/ui/confirm'

/**
 * The signed-in app says "do not index me", on every route beneath this layout.
 *
 * This is the tool `app/robots.ts` argues for and then does not reach for. Its
 * comment makes the case correctly — `Disallow` prevents CRAWLING, not indexing,
 * so a disallowed URL can still appear as a bare link if anything out there points
 * at it, and the instruction that actually keeps a page out of the index is
 * `noindex`, which has to be crawlable to be read. It then declines to list these
 * routes in robots.txt for a good separate reason (a world-readable file naming
 * /family-finances, /transactions and /direct-lineage is a free feature inventory)
 * and the noindex half never got written. This is that half.
 *
 * It is defence in depth rather than the primary control, which remains
 * `requireView` redirecting anonymous callers to /login. The gap it closes is
 * narrow and real: anything that fetches one of these URLs while holding a session
 * — an in-page link scanner, a preview crawler, a browser extension that submits
 * URLs — gets a rendered page rather than a redirect, and nothing in the markup
 * previously said it should not be indexed.
 *
 * `robots` is replaced wholesale by the deepest segment that defines it, so this
 * cleanly overrides the root layout's `index: true` for the entire subtree, and a
 * new page added under (protected) inherits it without having to remember.
 */
export const metadata: Metadata = {
  robots: { index: false, follow: false, nocache: true },
}

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
